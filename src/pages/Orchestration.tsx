import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import dagre from 'dagre'
import type { ChannelAccountSnapshot, ChannelsStatusResult, GatewaySessionRow } from '../types/openclaw'
import { getAPI } from '../lib/api'
import {
  getChannelDisplay,
  getRoleLayerLabel,
  getRoleLayerTone,
  importExperiencePreset,
  listExperiencePresets,
  loadExperiencePreset,
  type ExperiencePresetSummary,
  type ExperienceQuickStart,
  type LoadedExperiencePreset,
} from '../lib/orchestration'
import TeamPresetsPanel from '../components/TeamPresetsPanel'
import AgentLayerBadge from '../components/AgentLayerBadge'
import type { MockExperienceSummary } from '../data/mock-workspace'
import type { PresetRoleDetail } from '../lib/presets'

type ViewMode = 'graph' | 'channels' | 'org'
type InteractionMode = 'read' | 'edit'

type SelectedDetail =
  | { type: 'role'; role: PresetRoleDetail; activeSessions: number }
  | { type: 'channel'; channelId: string; label: string; detailLabel?: string; accounts: ChannelAccountSnapshot[] }
  | { type: 'quickstart'; quickStart: ExperienceQuickStart }
  | { type: 'team'; summary: ExperiencePresetSummary }

function applyLayout(nodes: Node[], edges: Edge[], direction: 'LR' | 'TB') {
  const graph = new dagre.graphlib.Graph()
  graph.setDefaultEdgeLabel(() => ({}))
  graph.setGraph({ rankdir: direction, nodesep: 60, ranksep: direction === 'TB' ? 110 : 160, marginx: 40, marginy: 40 })

  nodes.forEach((node) => {
    graph.setNode(node.id, { width: 220, height: node.type === 'summaryNode' ? 96 : 122 })
  })
  edges.forEach((edge) => {
    graph.setEdge(edge.source, edge.target)
  })

  dagre.layout(graph)

  return nodes.map((node) => {
    const position = graph.node(node.id)
    return {
      ...node,
      position: {
        x: position.x - 110,
        y: position.y - (node.type === 'summaryNode' ? 48 : 61),
      },
    }
  })
}

function isExperienceSummary(value: unknown): value is MockExperienceSummary {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  return typeof candidate.templateId === 'string' && typeof candidate.name === 'string' && typeof candidate.layerCounts === 'object'
}

function makeLayoutStorageKey(templateId: string | null, viewMode: ViewMode): string | null {
  if (!templateId) return null
  return `claw-ops-orchestration-layout:${templateId}:${viewMode}`
}

function readSavedNodePositions(storageKey: string | null, nodes: Node[]): Node[] {
  if (!storageKey) return nodes
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return nodes
    const saved = JSON.parse(raw) as Array<{ id: string; position: { x: number; y: number } }>
    const map = new Map(saved.map((entry) => [entry.id, entry.position]))
    return nodes.map((node) => {
      const position = map.get(node.id)
      return position ? { ...node, position } : node
    })
  } catch {
    return nodes
  }
}

function sortRoleIdsBySpecificity(roleIds: string[]) {
  return [...roleIds].sort((left, right) => right.length - left.length)
}

function findTrailingRoleId(sessionKey: string, sortedRoleIds: string[]) {
  return sortedRoleIds.find((roleId) => sessionKey.endsWith(`-${roleId}`)) ?? null
}

function getSessionRoleIds(sessionKey: string, sortedRoleIds: string[]) {
  if (sessionKey.startsWith('sess-api-')) {
    const handoffKey = sessionKey.slice('sess-api-'.length)
    for (const fromRoleId of sortedRoleIds) {
      const prefix = `${fromRoleId}-`
      if (!handoffKey.startsWith(prefix)) continue
      const toRoleId = handoffKey.slice(prefix.length)
      if (sortedRoleIds.includes(toRoleId)) {
        return fromRoleId === toRoleId ? [fromRoleId] : [fromRoleId, toRoleId]
      }
    }
  }

  const trailingRoleId = findTrailingRoleId(sessionKey, sortedRoleIds)
  return trailingRoleId ? [trailingRoleId] : []
}

function buildRoleSessionCounts(sessions: GatewaySessionRow[], roleIds: string[]) {
  const sortedRoleIds = sortRoleIdsBySpecificity(roleIds)
  const counts = new Map<string, number>()

  sessions.forEach((session) => {
    getSessionRoleIds(session.key, sortedRoleIds).forEach((roleId) => {
      counts.set(roleId, (counts.get(roleId) ?? 0) + 1)
    })
  })

  return { counts, sortedRoleIds }
}

function ChannelNode({ data }: { data: { channelId: string; label: string; detailLabel?: string; accounts: ChannelAccountSnapshot[]; onSelect: (detail: SelectedDetail) => void } }) {
  const activeRuns = data.accounts.reduce((sum, account) => sum + (account.activeRuns ?? 0), 0)
  const online = data.accounts.some((account) => account.connected)
  const display = getChannelDisplay(data.channelId)

  return (
    <button
      type="button"
      onClick={() => data.onSelect({ type: 'channel', channelId: data.channelId, label: data.label, detailLabel: data.detailLabel, accounts: data.accounts })}
      className="w-[220px] rounded-2xl border-2 border-surface-border bg-white text-left p-4 shadow-card hover:shadow-card-hover transition-all"
      style={{ borderColor: online ? '#60a5fa' : '#fca5a5' }}
    >
      <Handle type="source" position={Position.Right} style={{ background: online ? '#3b82f6' : '#ef4444', width: 10, height: 10 }} />
      <div className="flex items-center gap-3">
        <span className="text-2xl">{display.emoji}</span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-text-primary">{data.label}</p>
          <p className="text-[11px] text-text-secondary truncate">{data.detailLabel ?? data.channelId}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between text-[11px] text-text-secondary">
        <span>{data.accounts.length} 个账号</span>
        <span className={online ? 'text-accent-green' : 'text-accent-red'}>{online ? `${activeRuns} 条运行中` : '等待连接'}</span>
      </div>
    </button>
  )
}

function SummaryNode({ data }: { data: { title: string; subtitle: string; emoji: string; tone: string; onSelect?: () => void } }) {
  return (
    <button
      type="button"
      onClick={data.onSelect}
      className={`w-[220px] rounded-2xl border border-surface-border bg-gradient-to-br ${data.tone} p-4 text-left shadow-card hover:shadow-card-hover transition-all`}
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl">{data.emoji}</span>
        <div>
          <p className="text-sm font-semibold text-text-primary">{data.title}</p>
          <p className="text-[11px] text-text-secondary mt-1 leading-5">{data.subtitle}</p>
        </div>
      </div>
    </button>
  )
}

function RoleNode({ data }: { data: { role: PresetRoleDetail; activeSessions: number; onSelect: (detail: SelectedDetail) => void } }) {
  const tone = getRoleLayerTone(data.role.manifest.layer)
  return (
    <button
      type="button"
      onClick={() => data.onSelect({ type: 'role', role: data.role, activeSessions: data.activeSessions })}
      className={`w-[220px] rounded-2xl border border-surface-border bg-gradient-to-br ${tone.card} p-4 text-left shadow-card hover:shadow-card-hover transition-all`}
      style={{ borderColor: tone.border }}
    >
      <Handle type="target" position={Position.Left} style={{ background: tone.border, width: 10, height: 10 }} />
      <Handle type="source" position={Position.Right} style={{ background: tone.border, width: 10, height: 10 }} />
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <span className="text-2xl">{data.role.manifest.emoji}</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-text-primary">{data.role.manifest.name}</p>
            <p className="text-[11px] text-text-secondary truncate">{data.role.manifest.nameEn}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 text-[10px]">
          <AgentLayerBadge layer={data.role.manifest.layer} />
          <span className="badge badge-blue">{data.role.manifest.modelTier}</span>
          <span className="badge badge-purple">{data.role.manifest.costTier}</span>
        </div>
        <div className="text-[11px] text-text-secondary space-y-1">
          <p>阶段：{data.role.workflow.ownedStages.slice(0, 2).join(' · ') || '待定义'}</p>
          <p>活跃会话：{data.activeSessions} 个</p>
        </div>
      </div>
    </button>
  )
}

const nodeTypes = {
  channelNode: ChannelNode,
  summaryNode: SummaryNode,
  roleNode: RoleNode,
}

function buildChannelTopology(
  channelsStatus: ChannelsStatusResult | null,
  roles: PresetRoleDetail[],
  sessions: GatewaySessionRow[],
  onSelect: (detail: SelectedDetail) => void,
) {
  if (!channelsStatus) return { nodes: [] as Node[], edges: [] as Edge[] }
  const { counts: roleSessionCounts, sortedRoleIds } = buildRoleSessionCounts(sessions, roles.map((role) => role.manifest.id))

  const channelNodes: Node[] = channelsStatus.channelOrder.map((channelId) => ({
    id: `channel-${channelId}`,
    type: 'channelNode',
    position: { x: 0, y: 0 },
    data: {
      channelId,
      label: channelsStatus.channelLabels[channelId] ?? channelId,
      detailLabel: channelsStatus.channelDetailLabels?.[channelId],
      accounts: channelsStatus.channelAccounts[channelId] ?? [],
      onSelect,
    },
  }))

  const roleNodes: Node[] = roles.map((role) => ({
    id: `role-${role.manifest.id}`,
    type: 'roleNode',
    position: { x: 0, y: 0 },
    data: {
      role,
      activeSessions: roleSessionCounts.get(role.manifest.id) ?? 0,
      onSelect,
    },
  }))

  const quickRoute = new Map<string, string>()
  sessions.forEach((session) => {
    if (session.channel && session.kind === 'direct') {
      const roleId = findTrailingRoleId(session.key, sortedRoleIds)
      if (roleId && !quickRoute.has(session.channel)) {
        quickRoute.set(session.channel, roleId)
      }
    }
  })

  const edges: Edge[] = channelsStatus.channelOrder.flatMap((channelId, index) => {
    const targetRoleId = quickRoute.get(channelId) ?? roles[index % Math.max(roles.length, 1)]?.manifest.id
    if (!targetRoleId) return []
    return [{
      id: `edge-${channelId}-${targetRoleId}`,
      source: `channel-${channelId}`,
      target: `role-${targetRoleId}`,
      animated: true,
      label: channelsStatus.channelDefaultAccountId[channelId] ?? '',
      style: { stroke: '#6366f1', strokeWidth: 2 },
      labelStyle: { fill: '#64748b', fontSize: 10, fontWeight: 500 },
      labelBgStyle: { fill: '#ffffff', fillOpacity: 0.92 },
      labelBgPadding: [5, 6] as [number, number],
      labelBgBorderRadius: 6,
      markerEnd: { type: MarkerType.ArrowClosed, color: '#6366f1' },
    }]
  })

  return {
    nodes: applyLayout([...channelNodes, ...roleNodes], edges, 'LR'),
    edges,
  }
}

function buildOrchestrationGraph(
  experience: LoadedExperiencePreset,
  sessions: GatewaySessionRow[],
  onSelect: (detail: SelectedDetail) => void,
) {
  const nodes: Node[] = []
  const edges: Edge[] = []
  const layerOrder = ['L0', 'L1', 'L2', 'L3'] as const
  const xByLayer: Record<(typeof layerOrder)[number], number> = {
    L0: 320,
    L1: 660,
    L2: 1000,
    L3: 1340,
  }
  const { counts: roleSessionCounts } = buildRoleSessionCounts(sessions, experience.roles.map((role) => role.manifest.id))

  experience.summary.quickStarts.forEach((quickStart, index) => {
    nodes.push({
      id: `quickstart-${quickStart.id}`,
      type: 'summaryNode',
      position: { x: 20, y: 70 + index * 150 },
      data: {
        title: quickStart.title,
        subtitle: quickStart.user,
        emoji: getChannelDisplay(quickStart.channel).emoji,
        tone: 'from-brand-50 to-white',
        onSelect: () => onSelect({ type: 'quickstart', quickStart }),
      },
    })

    edges.push({
      id: `entry-${quickStart.id}-${quickStart.ownerRoleId}`,
      source: `quickstart-${quickStart.id}`,
      target: `role-${quickStart.ownerRoleId}`,
      animated: true,
      style: { stroke: '#38bdf8', strokeDasharray: '6 4', strokeWidth: 1.8 },
      label: '入口触发',
      labelStyle: { fill: '#0f172a', fontSize: 10 },
      labelBgStyle: { fill: '#ffffff', fillOpacity: 0.92 },
      labelBgPadding: [4, 5] as [number, number],
      labelBgBorderRadius: 6,
      markerEnd: { type: MarkerType.ArrowClosed, color: '#38bdf8' },
    })
  })

  layerOrder.forEach((layer) => {
    experience.rolesByLayer[layer].forEach((role, index) => {
      const y = 80 + index * 160
      const activeSessions = roleSessionCounts.get(role.manifest.id) ?? 0
      nodes.push({
        id: `role-${role.manifest.id}`,
        type: 'roleNode',
        position: { x: xByLayer[layer], y },
        data: {
          role,
          activeSessions,
          onSelect,
        },
      })
    })
  })

  nodes.push({
    id: 'deliverable-node',
    type: 'summaryNode',
    position: { x: 1680, y: 180 },
    data: {
      title: '交付结果',
      subtitle: '计划、实现、内容、复盘与治理结论汇总到最终交付口径。',
      emoji: '📦',
      tone: 'from-pastel-green/50 to-white',
      onSelect: () => onSelect({ type: 'team', summary: experience.summary }),
    },
  })

  experience.template.workflow.forEach((step) => {
    edges.push({
      id: `handoff-${step.from}-${step.to}`,
      source: `role-${step.from}`,
      target: `role-${step.to}`,
      label: step.condition,
      style: {
        stroke: step.mandatory ? '#6366f1' : '#94a3b8',
        strokeWidth: step.mandatory ? 2.4 : 1.6,
      },
      labelStyle: { fill: '#475569', fontSize: 10, fontWeight: 500 },
      labelBgStyle: { fill: '#ffffff', fillOpacity: 0.92 },
      labelBgPadding: [4, 6] as [number, number],
      labelBgBorderRadius: 6,
      markerEnd: { type: MarkerType.ArrowClosed, color: step.mandatory ? '#6366f1' : '#94a3b8' },
    })
  })

  const seenEscalations = new Set<string>()
  experience.roles.forEach((role) => {
    role.authority.escalateTo
      .filter((targetId) => experience.template.roles.includes(targetId))
      .forEach((targetId) => {
        const key = `${role.manifest.id}-${targetId}`
        if (seenEscalations.has(key)) return
        seenEscalations.add(key)
        edges.push({
          id: `escalate-${key}`,
          source: `role-${role.manifest.id}`,
          target: `role-${targetId}`,
          label: '升级',
          style: { stroke: '#f59e0b', strokeDasharray: '6 4', strokeWidth: 1.8 },
          labelStyle: { fill: '#b45309', fontSize: 10 },
          labelBgStyle: { fill: '#fff7ed', fillOpacity: 0.98 },
          labelBgPadding: [4, 5] as [number, number],
          labelBgBorderRadius: 6,
          markerEnd: { type: MarkerType.ArrowClosed, color: '#f59e0b' },
        })
      })
  })

  const finalRoles = experience.template.workflow
    .map((step) => step.to)
    .filter((roleId, index, array) => array.indexOf(roleId) === index)
    .filter((roleId) => !experience.template.workflow.some((step) => step.from === roleId))

  finalRoles.forEach((roleId, index) => {
    edges.push({
      id: `deliver-${roleId}`,
      source: `role-${roleId}`,
      target: 'deliverable-node',
      label: index === 0 ? '结果归并' : '',
      style: { stroke: '#10b981', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#10b981' },
    })
  })

  return { nodes, edges }
}

function buildOrgGraph(
  experience: LoadedExperiencePreset,
  sessions: GatewaySessionRow[],
  onSelect: (detail: SelectedDetail) => void,
) {
  const nodes: Node[] = [
    {
      id: `team-${experience.summary.id}`,
      type: 'summaryNode',
      position: { x: 0, y: 0 },
      data: {
        title: experience.summary.name,
        subtitle: experience.summary.promise,
        emoji: '🏢',
        tone: 'from-brand-100 to-white',
        onSelect: () => onSelect({ type: 'team', summary: experience.summary }),
      },
    },
  ]

  const edges: Edge[] = []
  const { counts: roleSessionCounts } = buildRoleSessionCounts(sessions, experience.roles.map((role) => role.manifest.id))

  ;(['L0', 'L1', 'L2', 'L3'] as const).forEach((layer) => {
    nodes.push({
      id: `layer-${layer}`,
      type: 'summaryNode',
      position: { x: 0, y: 0 },
      data: {
        title: `${layer} · ${getRoleLayerLabel(layer)}`,
        subtitle: `${experience.summary.layerCounts[layer]} 个角色`,
        emoji: layer === 'L0' ? '🛡️' : layer === 'L1' ? '🎯' : layer === 'L2' ? '📋' : '⚙️',
        tone: 'from-surface-hover to-white',
      },
    })

    edges.push({
      id: `team-${layer}`,
      source: `team-${experience.summary.id}`,
      target: `layer-${layer}`,
      style: { stroke: '#94a3b8', strokeWidth: 1.8 },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8' },
    })

    experience.rolesByLayer[layer].forEach((role) => {
      nodes.push({
        id: `role-${role.manifest.id}`,
        type: 'roleNode',
        position: { x: 0, y: 0 },
        data: {
          role,
          activeSessions: roleSessionCounts.get(role.manifest.id) ?? 0,
          onSelect,
        },
      })
      edges.push({
        id: `layer-${layer}-${role.manifest.id}`,
        source: `layer-${layer}`,
        target: `role-${role.manifest.id}`,
        style: { stroke: '#cbd5e1', strokeWidth: 1.4 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#cbd5e1' },
      })
    })
  })

  return {
    nodes: applyLayout(nodes, edges, 'TB'),
    edges,
  }
}

function DetailPanel({ detail }: { detail: SelectedDetail | null }) {
  if (!detail) {
    return (
      <div className="card p-5 text-sm text-text-secondary">
        选择画布中的任意节点，可以查看该角色、渠道或快速体验入口的详细信息。
      </div>
    )
  }

  if (detail.type === 'team') {
    return (
      <div className="card p-5 space-y-4">
        <div>
          <p className="text-sm font-semibold text-text-primary">{detail.summary.name}</p>
          <p className="text-xs text-text-secondary mt-1">{detail.summary.description}</p>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px]">
          <span className="badge badge-blue">{detail.summary.roleCount} 角色</span>
          <span className="badge badge-purple">{detail.summary.handoffCount} 交接</span>
          <span className="badge badge-green">{detail.summary.quickStarts.length} 快速入口</span>
        </div>
        <p className="text-xs text-text-muted">{detail.summary.promise}</p>
      </div>
    )
  }

  if (detail.type === 'quickstart') {
    return (
      <div className="card p-5 space-y-4">
        <div>
          <p className="text-sm font-semibold text-text-primary">{detail.quickStart.title}</p>
          <p className="text-xs text-text-secondary mt-1">用户：{detail.quickStart.user} · 渠道：{detail.quickStart.channel}</p>
        </div>
        <div className="rounded-2xl bg-surface-bg border border-surface-border p-4 text-xs text-text-primary leading-6">
          {detail.quickStart.prompt}
        </div>
        <div>
          <p className="text-xs font-semibold text-text-secondary mb-2">期望结果</p>
          <p className="text-xs text-text-primary leading-6">{detail.quickStart.outcome}</p>
        </div>
      </div>
    )
  }

  if (detail.type === 'channel') {
    return (
      <div className="card p-5 space-y-4">
        <div>
          <p className="text-sm font-semibold text-text-primary">{detail.label}</p>
          <p className="text-xs text-text-secondary mt-1">{detail.detailLabel ?? detail.channelId}</p>
        </div>
        <div className="space-y-3">
          {detail.accounts.map((account) => (
            <div key={account.accountId} className="rounded-2xl border border-surface-border bg-surface-bg p-4 text-xs space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-text-primary">{account.name ?? account.accountId}</span>
                <span className={account.connected ? 'text-accent-green' : 'text-accent-red'}>
                  {account.connected ? '● 已连接' : '○ 未连接'}
                </span>
              </div>
              <p className="text-text-muted font-mono">{account.accountId}</p>
              <p className="text-text-secondary">活跃运行：{account.activeRuns ?? 0}</p>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-start gap-3">
        <span className="text-3xl">{detail.role.manifest.emoji}</span>
        <div>
          <p className="text-sm font-semibold text-text-primary">{detail.role.manifest.name}</p>
          <p className="text-xs text-text-secondary mt-1">{detail.role.manifest.nameEn}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 text-[11px]">
        <AgentLayerBadge layer={detail.role.manifest.layer} />
        <span className="badge badge-blue">{detail.role.manifest.modelTier}</span>
        <span className="badge badge-purple">{detail.role.manifest.costTier}</span>
      </div>
      <p className="text-xs text-text-primary leading-6">{detail.role.manifest.description}</p>
      <div className="grid grid-cols-1 gap-3 text-xs">
        <div className="rounded-2xl border border-surface-border bg-surface-bg p-4 space-y-2">
          <p className="font-semibold text-text-secondary">工作流阶段</p>
          <p className="text-text-primary">{detail.role.workflow.ownedStages.join(' · ') || '—'}</p>
        </div>
        <div className="rounded-2xl border border-surface-border bg-surface-bg p-4 space-y-2">
          <p className="font-semibold text-text-secondary">上游 / 下游</p>
          <p className="text-text-primary">接收：{detail.role.workflow.acceptsFrom.join('、') || '—'}</p>
          <p className="text-text-primary">移交：{detail.role.workflow.handoffTo.join('、') || '—'}</p>
        </div>
        <div className="rounded-2xl border border-surface-border bg-surface-bg p-4 space-y-2">
          <p className="font-semibold text-text-secondary">强制检查</p>
          <p className="text-text-primary">{detail.role.workflow.mandatoryChecks.join('、') || '—'}</p>
        </div>
        <div className="rounded-2xl border border-surface-border bg-surface-bg p-4 space-y-2">
          <p className="font-semibold text-text-secondary">活跃会话与技能</p>
          <p className="text-text-primary">活跃会话：{detail.activeSessions}</p>
          <div className="flex flex-wrap gap-1.5">
            {detail.role.capabilities.requiredSkills.map((skill) => (
              <span key={skill} className="badge badge-cyan">{skill}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Orchestration() {
  const [viewMode, setViewMode] = useState<ViewMode>('graph')
  const [interactionMode, setInteractionMode] = useState<InteractionMode>('read')
  const [focusMode, setFocusMode] = useState(false)
  const [presets, setPresets] = useState<ExperiencePresetSummary[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [loadedExperience, setLoadedExperience] = useState<LoadedExperiencePreset | null>(null)
  const [channelsStatus, setChannelsStatus] = useState<ChannelsStatusResult | null>(null)
  const [sessions, setSessions] = useState<GatewaySessionRow[]>([])
  const [activeExperience, setActiveExperience] = useState<MockExperienceSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [importingId, setImportingId] = useState<string | null>(null)
  const [selectedDetail, setSelectedDetail] = useState<SelectedDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const previousLayoutStorageKeyRef = useRef<string | null>(null)

  const loadRuntimeData = useCallback(async () => {
    const api = getAPI()
    const [channels, sessionsResult, config] = await Promise.all([
      api.getChannelsStatus(),
      api.getSessions({ limit: 200, includeGlobal: true, includeDerivedTitles: true, includeLastMessage: true }),
      api.getConfig(),
    ])

    setChannelsStatus(channels)
    setSessions(sessionsResult.sessions)
    setActiveExperience(isExperienceSummary(config.experience) ? config.experience : null)
  }, [])

  useEffect(() => {
    let cancelled = false
    async function bootstrap() {
      setLoading(true)
      setError(null)
      try {
        const [presetList] = await Promise.all([
          listExperiencePresets(),
          loadRuntimeData(),
        ])
        if (cancelled) return
        setPresets(presetList)
        const defaultId = ((await getAPI().getConfig()).experience as MockExperienceSummary | undefined)?.templateId ?? presetList[0]?.id ?? null
        setSelectedTemplateId(defaultId)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : '加载编排数据失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    bootstrap()
    return () => {
      cancelled = true
    }
  }, [loadRuntimeData])

  useEffect(() => {
    if (!selectedTemplateId) return
    let cancelled = false
    loadExperiencePreset(selectedTemplateId)
      .then((experience) => {
        if (!cancelled) {
          setLoadedExperience(experience)
          setSelectedDetail({ type: 'team', summary: experience.summary })
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : '加载模板详情失败')
      })
    return () => {
      cancelled = true
    }
  }, [selectedTemplateId])

  const handleImport = useCallback(async (templateId: string) => {
    setImportingId(templateId)
    setError(null)
    try {
      const experience = await importExperiencePreset(templateId)
      setLoadedExperience(experience)
      setSelectedTemplateId(templateId)
      setSelectedDetail({ type: 'team', summary: experience.summary })
      await loadRuntimeData()
    } catch (err) {
      setError(err instanceof Error ? err.message : '导入模板失败')
    } finally {
      setImportingId(null)
    }
  }, [loadRuntimeData])

  const graph = useMemo(() => {
    if (!loadedExperience) return { nodes: [] as Node[], edges: [] as Edge[] }
    if (viewMode === 'channels') {
      return buildChannelTopology(channelsStatus, loadedExperience.roles, sessions, setSelectedDetail)
    }
    if (viewMode === 'org') {
      return buildOrgGraph(loadedExperience, sessions, setSelectedDetail)
    }
    return buildOrchestrationGraph(loadedExperience, sessions, setSelectedDetail)
  }, [loadedExperience, viewMode, channelsStatus, sessions])

  const layoutStorageKey = useMemo(() => makeLayoutStorageKey(selectedTemplateId, viewMode), [selectedTemplateId, viewMode])

  useEffect(() => {
    const layoutChanged = previousLayoutStorageKeyRef.current !== layoutStorageKey
    previousLayoutStorageKeyRef.current = layoutStorageKey

    setNodes((currentNodes) => {
      if (layoutChanged) {
        return readSavedNodePositions(layoutStorageKey, graph.nodes)
      }

      const positionMap = new Map(currentNodes.map((node) => [node.id, node.position]))
      return graph.nodes.map((node) => {
        const position = positionMap.get(node.id)
        return position ? { ...node, position } : node
      })
    })
    setEdges(graph.edges)
  }, [graph.nodes, graph.edges, layoutStorageKey, setEdges, setNodes])

  const handleSaveLayout = useCallback(() => {
    if (!layoutStorageKey) return
    try {
      localStorage.setItem(layoutStorageKey, JSON.stringify(nodes.map((node) => ({ id: node.id, position: node.position }))))
    } catch {
      setError('当前布局保存失败，请检查浏览器存储空间。')
    }
  }, [layoutStorageKey, nodes])

  const handleResetLayout = useCallback(() => {
    if (layoutStorageKey) {
      try {
        localStorage.removeItem(layoutStorageKey)
      } catch {
        // ignore
      }
    }
    setNodes(graph.nodes)
  }, [graph.nodes, layoutStorageKey, setNodes])

  const handleAutoLayout = useCallback(() => {
    setNodes(graph.nodes)
  }, [graph.nodes, setNodes])

  const headerStats = useMemo(() => {
    const summary = loadedExperience?.summary
    if (!summary) return []
    return [
      { label: '团队角色', value: String(summary.roleCount), tone: 'badge-blue' },
      { label: '工作流交接', value: String(summary.handoffCount), tone: 'badge-purple' },
      { label: '快速体验入口', value: String(summary.quickStarts.length), tone: 'badge-green' },
      { label: '活跃会话', value: String(sessions.length), tone: 'badge-cyan' },
    ]
  }, [loadedExperience, sessions.length])

  if (loading) {
    return <div className="flex items-center justify-center h-80 text-text-secondary text-sm">加载编排体验...</div>
  }

  if (error && !loadedExperience) {
    return (
      <div className="card p-10 text-center space-y-3">
        <div className="text-4xl">⚠️</div>
        <p className="text-text-secondary">{error}</p>
        <button onClick={() => window.location.reload()} className="btn-secondary text-xs">重新加载</button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {loadedExperience && (
        <div className={`rounded-3xl bg-gradient-to-r ${loadedExperience.summary.accentClass} p-[1px] shadow-card`}>
          <div className="rounded-[calc(1.5rem-1px)] bg-white/90 backdrop-blur px-6 py-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-text-secondary">
                <span className="badge badge-purple">编排工作台</span>
                {activeExperience && <span className="badge badge-green">已激活：{activeExperience.name}</span>}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-text-primary">{loadedExperience.summary.name}</h2>
                <p className="text-sm text-text-secondary mt-1 max-w-4xl leading-6">{loadedExperience.summary.tagline}</p>
              </div>
              <p className="text-xs text-text-muted max-w-4xl">{loadedExperience.summary.promise}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {headerStats.map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-surface-border bg-surface-bg px-4 py-3 min-w-[110px]">
                  <p className="text-[11px] text-text-secondary">{stat.label}</p>
                  <p className="text-lg font-semibold text-text-primary mt-1">{stat.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-accent-red/30 bg-pastel-red/20 px-4 py-3 text-sm text-accent-red">
          {error}
        </div>
      )}

      <div className={`grid gap-6 items-start ${focusMode ? 'grid-cols-1' : 'grid-cols-[minmax(0,1fr)_360px]'}`}>
        <div className="space-y-4 min-w-0">
          <div className="card p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => setViewMode('graph')} className={`px-3 py-1.5 rounded-xl text-sm transition-colors ${viewMode === 'graph' ? 'bg-brand-50 text-brand-600 font-semibold' : 'bg-surface-hover text-text-secondary hover:text-text-primary'}`}>
                  🧩 编排图谱
                </button>
                <button onClick={() => setViewMode('channels')} className={`px-3 py-1.5 rounded-xl text-sm transition-colors ${viewMode === 'channels' ? 'bg-brand-50 text-brand-600 font-semibold' : 'bg-surface-hover text-text-secondary hover:text-text-primary'}`}>
                  🔗 通道拓扑
                </button>
                <button onClick={() => setViewMode('org')} className={`px-3 py-1.5 rounded-xl text-sm transition-colors ${viewMode === 'org' ? 'bg-brand-50 text-brand-600 font-semibold' : 'bg-surface-hover text-text-secondary hover:text-text-primary'}`}>
                  🏢 组织架构
                </button>
              </div>
              <div className="text-xs text-text-secondary">
                {viewMode === 'graph' && '按层显示角色、交接链与升级链'}
                {viewMode === 'channels' && '查看入口渠道如何流入团队'}
                {viewMode === 'org' && '查看团队层级与角色覆盖'}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-surface-border pt-3">
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => setInteractionMode('read')} className={`px-3 py-1.5 rounded-xl text-sm transition-colors ${interactionMode === 'read' ? 'bg-brand-50 text-brand-600 font-semibold' : 'bg-surface-hover text-text-secondary hover:text-text-primary'}`}>
                  👀 阅读模式
                </button>
                <button onClick={() => setInteractionMode('edit')} className={`px-3 py-1.5 rounded-xl text-sm transition-colors ${interactionMode === 'edit' ? 'bg-brand-50 text-brand-600 font-semibold' : 'bg-surface-hover text-text-secondary hover:text-text-primary'}`}>
                  ✍️ 编辑模式
                </button>
                <button onClick={() => setFocusMode((current) => !current)} className="btn-secondary text-xs">
                  {focusMode ? '退出专注' : '专注阅读'}
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button onClick={handleAutoLayout} className="btn-secondary text-xs">🔄 重新布局</button>
                <button onClick={handleSaveLayout} className="btn-secondary text-xs" disabled={interactionMode !== 'edit'}>
                  💾 保存布局
                </button>
                <button onClick={handleResetLayout} className="btn-secondary text-xs">↩︎ 重置布局</button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[11px] text-text-secondary">
              <span className="badge badge-blue">实线：主交接链</span>
              <span className="badge badge-yellow">虚线：升级链</span>
              <span className="badge badge-cyan">入口触发：快速体验</span>
              <span className="badge badge-purple">{interactionMode === 'read' ? '拖动画布浏览' : '拖动节点调整布局'}</span>
            </div>
          </div>

          <div className={`card relative overflow-hidden ${focusMode ? 'h-[840px]' : 'h-[760px]'}`}>
            {viewMode === 'graph' && loadedExperience && (
              <div className="absolute inset-y-20 left-4 right-4 z-[1] grid grid-cols-4 gap-3 pointer-events-none opacity-60">
                {(['L0', 'L1', 'L2', 'L3'] as const).map((layer) => {
                  const tone = getRoleLayerTone(layer)
                  return (
                    <div key={layer} className={`rounded-3xl bg-gradient-to-b ${tone.card} border border-surface-border`} />
                  )
                })}
              </div>
            )}
            {viewMode === 'graph' && loadedExperience && (
              <div className="absolute left-4 right-4 top-4 z-10 grid grid-cols-4 gap-3 pointer-events-none">
                {(['L0', 'L1', 'L2', 'L3'] as const).map((layer) => (
                  <div key={layer} className="rounded-xl border border-surface-border bg-white/85 backdrop-blur px-3 py-2 text-[11px] text-text-secondary shadow-sm">
                    <div className="flex items-center justify-between gap-2">
                      <AgentLayerBadge layer={layer} />
                      <span>{loadedExperience.summary.layerCounts[layer]} 角色</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              nodeTypes={nodeTypes}
              fitView
              fitViewOptions={{ padding: 0.22 }}
              minZoom={0.2}
              maxZoom={2}
              panOnDrag={interactionMode === 'read'}
              nodesDraggable={interactionMode === 'edit'}
              selectionOnDrag={interactionMode === 'edit'}
              zoomOnDoubleClick={interactionMode === 'edit'}
              proOptions={{ hideAttribution: true }}
            >
              <Background color="#e2e8f0" gap={22} size={1} />
              <Controls className="!bg-surface-card !border-surface-border !rounded-xl" />
              <MiniMap
                nodeStrokeWidth={3}
                style={{ backgroundColor: '#ffffff' }}
                nodeColor={(node) => {
                  if (node.id.startsWith('channel-')) return '#60a5fa'
                  if (node.id.startsWith('quickstart-')) return '#c084fc'
                  if (node.id === 'deliverable-node') return '#34d399'
                  if (node.id.startsWith('role-')) {
                    const role = loadedExperience?.roles.find((entry) => `role-${entry.manifest.id}` === node.id)
                    return role ? getRoleLayerTone(role.manifest.layer).border : '#94a3b8'
                  }
                  return '#cbd5e1'
                }}
              />
            </ReactFlow>
          </div>

          {loadedExperience && (
            <div className="grid grid-cols-3 gap-4">
              {loadedExperience.summary.quickStarts.map((quickStart) => (
                <button
                  key={quickStart.id}
                  type="button"
                  onClick={() => setSelectedDetail({ type: 'quickstart', quickStart })}
                  className="card-hover p-4 text-left space-y-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-text-primary">{quickStart.title}</p>
                      <p className="text-[11px] text-text-secondary mt-1">{quickStart.user} · {quickStart.channel}</p>
                    </div>
                    <span className="text-2xl">{getChannelDisplay(quickStart.channel).emoji}</span>
                  </div>
                  <p className="text-xs text-text-muted leading-5">{quickStart.prompt}</p>
                </button>
              ))}
            </div>
          )}

          {focusMode && <DetailPanel detail={selectedDetail} />}
        </div>

        {!focusMode && (
          <div className="space-y-4 sticky top-6">
            <TeamPresetsPanel
              presets={presets}
              selectedId={selectedTemplateId}
              importingId={importingId}
              onSelect={setSelectedTemplateId}
              onImport={handleImport}
            />
            <DetailPanel detail={selectedDetail} />
          </div>
        )}
      </div>
    </div>
  )
}
