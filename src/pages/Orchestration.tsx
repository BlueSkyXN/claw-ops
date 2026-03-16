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
import type { ChannelAccountSnapshot, ChannelsStatusResult } from '../types/openclaw'
import { getAPI } from '../lib/api'
import {
  getChannelDisplay,
  getRoleLayerLabel,
  getRoleLayerTone,
  importExperiencePreset,
  listExperiencePresets,
  type ExperiencePresetSummary,
  type ExperienceQuickStart,
} from '../lib/orchestration'
import { buildExecutionTrace, type ExecutionTrace } from '../lib/flow-tracer'
import { loadOrchestrationRuntime, performTaskIntervention, subscribeToOrchestrationEvents, isExperienceSummary } from '../lib/orchestration-runtime'
import { buildRoleLoadMap, type RoleLoadInfo, type TrackedTask } from '../lib/task-tracker'
import type { PresetRoleDetail } from '../lib/presets'
import ActiveTasksPanel, { type ActiveTaskPanelAction } from '../components/ActiveTasksPanel'
import AgentLayerBadge from '../components/AgentLayerBadge'
import OrchestratorHealthStrip from '../components/OrchestratorHealthStrip'
import TaskStepTimeline from '../components/TaskStepTimeline'
import TeamPresetsPanel from '../components/TeamPresetsPanel'

type ViewMode = 'graph' | 'channels' | 'org'
type InteractionMode = 'read' | 'edit'
type NodeTraceState = 'idle' | 'active' | 'completed' | 'waiting' | 'blocked'

type SelectedDetail =
  | { type: 'role'; role: PresetRoleDetail; load: RoleLoadInfo }
  | { type: 'channel'; channelId: string; label: string; detailLabel?: string; accounts: ChannelAccountSnapshot[]; activeTasks: number }
  | { type: 'quickstart'; quickStart: ExperienceQuickStart }
  | { type: 'team'; summary: ExperiencePresetSummary }

interface SummaryNodeData {
  title: string
  subtitle: string
  emoji: string
  tone: string
  highlighted?: boolean
  badge?: string
  onSelect?: () => void
}

interface RoleNodeData {
  role: PresetRoleDetail
  load: RoleLoadInfo
  traceState: NodeTraceState
  onSelect: (detail: SelectedDetail) => void
}

interface ChannelNodeData {
  channelId: string
  label: string
  detailLabel?: string
  accounts: ChannelAccountSnapshot[]
  activeTasks: number
  highlighted: boolean
  onSelect: (detail: SelectedDetail) => void
}

const EMPTY_LOAD: RoleLoadInfo = {
  activeTasks: 0,
  waitingTasks: 0,
  blockedTasks: 0,
  completedTasks: 0,
  failedTasks: 0,
  pendingApprovals: 0,
}

function applyLayout(nodes: Node[], edges: Edge[], direction: 'LR' | 'TB') {
  const graph = new dagre.graphlib.Graph()
  graph.setDefaultEdgeLabel(() => ({}))
  graph.setGraph({ rankdir: direction, nodesep: 60, ranksep: direction === 'TB' ? 110 : 160, marginx: 40, marginy: 40 })

  nodes.forEach((node) => {
    graph.setNode(node.id, { width: 230, height: node.type === 'summaryNode' ? 100 : 136 })
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
        x: position.x - 115,
        y: position.y - (node.type === 'summaryNode' ? 50 : 68),
      },
    }
  })
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

function buildChannelTaskCounts(tasks: TrackedTask[]): Map<string, number> {
  const counts = new Map<string, number>()
  tasks.forEach((task) => {
    if (task.status !== 'active') return
    counts.set(task.originChannel, (counts.get(task.originChannel) ?? 0) + 1)
  })
  return counts
}

function getTraceState(roleId: string, trace: ExecutionTrace | null): NodeTraceState {
  if (!trace) return 'idle'
  if (trace.blockedNodes.includes(`role-${roleId}`)) return 'blocked'
  if (trace.waitingNodes.includes(`role-${roleId}`)) return 'waiting'
  if (trace.activeNodes.includes(`role-${roleId}`)) return 'active'
  if (trace.completedNodes.includes(`role-${roleId}`)) return 'completed'
  return 'idle'
}

function edgeTraceProps(edgeId: string, trace: ExecutionTrace | null, defaults: { color: string; width: number; dash?: string }) {
  if (trace?.blockedEdges.includes(edgeId)) {
    return {
      animated: false,
      style: { stroke: '#ef4444', strokeWidth: 2.6, strokeDasharray: '5 4' },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#ef4444' },
    }
  }
  if (trace?.waitingEdges.includes(edgeId)) {
    return {
      animated: true,
      style: { stroke: '#f59e0b', strokeWidth: 2.6, strokeDasharray: '5 4' },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#f59e0b' },
    }
  }
  if (trace?.activeEdges.includes(edgeId)) {
    return {
      animated: true,
      style: { stroke: '#3b82f6', strokeWidth: 2.8 },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' },
    }
  }
  if (trace?.completedEdges.includes(edgeId)) {
    return {
      animated: false,
      style: { stroke: '#10b981', strokeWidth: 2.4 },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#10b981' },
    }
  }
  return {
    animated: false,
    style: { stroke: defaults.color, strokeWidth: defaults.width, strokeDasharray: defaults.dash },
    markerEnd: { type: MarkerType.ArrowClosed, color: defaults.color },
  }
}

function ChannelNode({ data }: { data: ChannelNodeData }) {
  const online = data.accounts.some((account) => account.connected)
  const activeRuns = data.accounts.reduce((sum, account) => sum + (account.activeRuns ?? 0), 0)
  const display = getChannelDisplay(data.channelId)

  return (
    <button
      type="button"
      onClick={() => data.onSelect({ type: 'channel', channelId: data.channelId, label: data.label, detailLabel: data.detailLabel, accounts: data.accounts, activeTasks: data.activeTasks })}
      className={`w-[230px] rounded-2xl border-2 bg-white text-left p-4 shadow-card hover:shadow-card-hover transition-all ${data.highlighted ? 'ring-2 ring-brand-300' : ''}`}
      style={{ borderColor: data.highlighted ? '#3b82f6' : online ? '#60a5fa' : '#fca5a5' }}
    >
      <Handle type="source" position={Position.Right} style={{ background: data.highlighted ? '#3b82f6' : online ? '#60a5fa' : '#ef4444', width: 10, height: 10 }} />
      <div className="flex items-center gap-3">
        <span className="text-2xl">{display.emoji}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-text-primary">{data.label}</p>
          <p className="text-[11px] text-text-secondary truncate">{data.detailLabel ?? data.channelId}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between text-[11px] text-text-secondary">
        <span>{data.accounts.length} 个账号</span>
        <span className={online ? 'text-accent-green' : 'text-accent-red'}>{online ? `${activeRuns} 条运行中` : '等待连接'}</span>
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-text-secondary">
        <span>活跃任务</span>
        <span className="font-semibold text-text-primary">{data.activeTasks}</span>
      </div>
    </button>
  )
}

function SummaryNode({ data }: { data: SummaryNodeData }) {
  return (
    <button
      type="button"
      onClick={data.onSelect}
      className={`w-[230px] rounded-2xl border border-surface-border bg-gradient-to-br ${data.tone} p-4 text-left shadow-card hover:shadow-card-hover transition-all ${data.highlighted ? 'ring-2 ring-brand-300 border-brand-200' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-2xl">{data.emoji}</span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-text-primary truncate">{data.title}</p>
            <p className="text-[11px] text-text-secondary mt-1 leading-5">{data.subtitle}</p>
          </div>
        </div>
        {data.badge && <span className="badge badge-blue text-[10px]">{data.badge}</span>}
      </div>
    </button>
  )
}

function RoleNode({ data }: { data: RoleNodeData }) {
  const tone = getRoleLayerTone(data.role.manifest.layer)
  const traceBorder = data.traceState === 'active'
    ? '#3b82f6'
    : data.traceState === 'completed'
      ? '#10b981'
      : data.traceState === 'waiting'
        ? '#f59e0b'
        : data.traceState === 'blocked'
          ? '#ef4444'
          : tone.border
  const ringClass = data.traceState === 'idle' ? '' : 'ring-2 ring-offset-0'
  const ringColor = data.traceState === 'active'
    ? 'ring-brand-300'
    : data.traceState === 'completed'
      ? 'ring-accent-green/30'
      : data.traceState === 'waiting'
        ? 'ring-accent-yellow/30'
        : 'ring-accent-red/30'

  return (
    <button
      type="button"
      onClick={() => data.onSelect({ type: 'role', role: data.role, load: data.load })}
      className={`w-[230px] rounded-2xl border bg-gradient-to-br ${tone.card} p-4 text-left shadow-card hover:shadow-card-hover transition-all ${ringClass} ${ringColor}`}
      style={{ borderColor: traceBorder }}
    >
      <Handle type="target" position={Position.Left} style={{ background: traceBorder, width: 10, height: 10 }} />
      <Handle type="source" position={Position.Right} style={{ background: traceBorder, width: 10, height: 10 }} />
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <span className="text-2xl">{data.role.manifest.emoji}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-text-primary">{data.role.manifest.name}</p>
              {data.traceState !== 'idle' && <span className={`badge text-[10px] ${data.traceState === 'active' ? 'badge-blue' : data.traceState === 'completed' ? 'badge-green' : data.traceState === 'waiting' ? 'badge-yellow' : 'badge-red'}`}>{data.traceState === 'active' ? '执行中' : data.traceState === 'completed' ? '已完成' : data.traceState === 'waiting' ? '待审批' : '已阻断'}</span>}
            </div>
            <p className="text-[11px] text-text-secondary truncate">{data.role.manifest.nameEn}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 text-[10px]">
          <AgentLayerBadge layer={data.role.manifest.layer} />
          <span className="badge badge-blue">{data.role.manifest.modelTier}</span>
          <span className="badge badge-purple">{data.role.manifest.costTier}</span>
          {data.load.pendingApprovals > 0 && <span className="badge badge-yellow">{data.load.pendingApprovals} 审批</span>}
        </div>
        <div className="grid grid-cols-2 gap-2 text-[11px] text-text-secondary">
          <div>
            <p>执行中</p>
            <p className="font-semibold text-text-primary mt-1">{data.load.activeTasks}</p>
          </div>
          <div>
            <p>待处理</p>
            <p className="font-semibold text-text-primary mt-1">{data.load.waitingTasks + data.load.blockedTasks}</p>
          </div>
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
  experience: NonNullable<Awaited<ReturnType<typeof loadOrchestrationRuntime>>['selectedExperience']>,
  roleLoadMap: Map<string, RoleLoadInfo>,
  tasks: TrackedTask[],
  onSelect: (detail: SelectedDetail) => void,
  trace: ExecutionTrace | null,
) {
  if (!channelsStatus) return { nodes: [] as Node[], edges: [] as Edge[] }
  const channelCounts = buildChannelTaskCounts(tasks)
  const quickRoute = new Map<string, string>()
  experience.summary.quickStarts.forEach((quickStart) => {
    if (!quickRoute.has(quickStart.channel)) {
      quickRoute.set(quickStart.channel, quickStart.ownerRoleId)
    }
  })

  const channelNodes: Node[] = channelsStatus.channelOrder.map((channelId) => ({
    id: `channel-${channelId}`,
    type: 'channelNode',
    position: { x: 0, y: 0 },
    data: {
      channelId,
      label: channelsStatus.channelLabels[channelId] ?? channelId,
      detailLabel: channelsStatus.channelDetailLabels?.[channelId],
      accounts: channelsStatus.channelAccounts[channelId] ?? [],
      activeTasks: channelCounts.get(channelId) ?? 0,
      highlighted: trace?.activeNodes.includes(`channel-${channelId}`) ?? false,
      onSelect,
    } satisfies ChannelNodeData,
  }))

  const roleNodes: Node[] = experience.roles.map((role) => ({
    id: `role-${role.manifest.id}`,
    type: 'roleNode',
    position: { x: 0, y: 0 },
    data: {
      role,
      load: roleLoadMap.get(role.manifest.id) ?? EMPTY_LOAD,
      traceState: getTraceState(role.manifest.id, trace),
      onSelect,
    } satisfies RoleNodeData,
  }))

  const edges: Edge[] = channelsStatus.channelOrder.flatMap((channelId, index) => {
    const targetRoleId = quickRoute.get(channelId) ?? experience.roles[index % Math.max(experience.roles.length, 1)]?.manifest.id
    if (!targetRoleId) return []
    const edgeId = `channel-entry-${channelId}-${targetRoleId}`
    const traceProps = edgeTraceProps(edgeId, trace, { color: '#6366f1', width: 2 })
    return [{
      id: edgeId,
      source: `channel-${channelId}`,
      target: `role-${targetRoleId}`,
      label: channelsStatus.channelDefaultAccountId[channelId] ?? '',
      labelStyle: { fill: '#64748b', fontSize: 10, fontWeight: 500 },
      labelBgStyle: { fill: '#ffffff', fillOpacity: 0.92 },
      labelBgPadding: [5, 6] as [number, number],
      labelBgBorderRadius: 6,
      ...traceProps,
    } satisfies Edge]
  })

  return {
    nodes: applyLayout([...channelNodes, ...roleNodes], edges, 'LR'),
    edges,
  }
}

function buildOrchestrationGraph(
  experience: NonNullable<Awaited<ReturnType<typeof loadOrchestrationRuntime>>['selectedExperience']>,
  roleLoadMap: Map<string, RoleLoadInfo>,
  onSelect: (detail: SelectedDetail) => void,
  trace: ExecutionTrace | null,
) {
  const nodes: Node[] = []
  const edges: Edge[] = []
  const layerOrder = ['L0', 'L1', 'L2', 'L3'] as const
  const xByLayer: Record<(typeof layerOrder)[number], number> = {
    L0: 340,
    L1: 700,
    L2: 1060,
    L3: 1420,
  }

  experience.summary.quickStarts.forEach((quickStart, index) => {
    nodes.push({
      id: `quickstart-${quickStart.id}`,
      type: 'summaryNode',
      position: { x: 20, y: 70 + index * 160 },
      data: {
        title: quickStart.title,
        subtitle: `${quickStart.user} · ${quickStart.channel}`,
        emoji: getChannelDisplay(quickStart.channel).emoji,
        tone: 'from-brand-50 to-white',
        highlighted: trace?.activeNodes.includes(`quickstart-${quickStart.id}`) || trace?.completedNodes.includes(`quickstart-${quickStart.id}`),
        badge: quickStart.ownerRoleId,
        onSelect: () => onSelect({ type: 'quickstart', quickStart }),
      } satisfies SummaryNodeData,
    })

    const edgeId = `entry-${quickStart.id}-${quickStart.ownerRoleId}`
    const traceProps = edgeTraceProps(edgeId, trace, { color: '#38bdf8', width: 1.8, dash: '6 4' })
    edges.push({
      id: edgeId,
      source: `quickstart-${quickStart.id}`,
      target: `role-${quickStart.ownerRoleId}`,
      label: '入口触发',
      labelStyle: { fill: '#0f172a', fontSize: 10 },
      labelBgStyle: { fill: '#ffffff', fillOpacity: 0.92 },
      labelBgPadding: [4, 5] as [number, number],
      labelBgBorderRadius: 6,
      ...traceProps,
    })
  })

  layerOrder.forEach((layer) => {
    experience.rolesByLayer[layer].forEach((role, index) => {
      const load = roleLoadMap.get(role.manifest.id) ?? EMPTY_LOAD
      nodes.push({
        id: `role-${role.manifest.id}`,
        type: 'roleNode',
        position: { x: xByLayer[layer], y: 80 + index * 170 },
        data: {
          role,
          load,
          traceState: getTraceState(role.manifest.id, trace),
          onSelect,
        } satisfies RoleNodeData,
      })
    })
  })

  nodes.push({
    id: 'deliverable-node',
    type: 'summaryNode',
    position: { x: 1780, y: 200 },
    data: {
      title: '交付结果',
      subtitle: '计划、实现、内容、复盘与治理结论归并为最终交付口径。',
      emoji: '📦',
      tone: 'from-pastel-green/50 to-white',
      highlighted: trace?.completedNodes.includes('deliverable-node'),
      onSelect: () => onSelect({ type: 'team', summary: experience.summary }),
    } satisfies SummaryNodeData,
  })

  experience.template.workflow.forEach((step) => {
    const edgeId = `handoff-${step.from}-${step.to}`
    const traceProps = edgeTraceProps(edgeId, trace, { color: step.mandatory ? '#6366f1' : '#94a3b8', width: step.mandatory ? 2.4 : 1.6 })
    edges.push({
      id: edgeId,
      source: `role-${step.from}`,
      target: `role-${step.to}`,
      label: step.mandatory ? `🔒 ${step.condition}` : step.condition,
      labelStyle: { fill: '#475569', fontSize: 10, fontWeight: 500 },
      labelBgStyle: { fill: '#ffffff', fillOpacity: 0.92 },
      labelBgPadding: [4, 6] as [number, number],
      labelBgBorderRadius: 6,
      ...traceProps,
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
        const edgeId = `escalate-${key}`
        const traceProps = edgeTraceProps(edgeId, trace, { color: '#f59e0b', width: 1.8, dash: '6 4' })
        edges.push({
          id: edgeId,
          source: `role-${role.manifest.id}`,
          target: `role-${targetId}`,
          label: '升级',
          labelStyle: { fill: '#b45309', fontSize: 10 },
          labelBgStyle: { fill: '#fff7ed', fillOpacity: 0.98 },
          labelBgPadding: [4, 5] as [number, number],
          labelBgBorderRadius: 6,
          ...traceProps,
        })
      })
  })

  const finalRoles = experience.template.workflow
    .map((step) => step.to)
    .filter((roleId, index, array) => array.indexOf(roleId) === index)
    .filter((roleId) => !experience.template.workflow.some((step) => step.from === roleId))

  finalRoles.forEach((roleId, index) => {
    const edgeId = `deliver-${roleId}`
    const traceProps = edgeTraceProps(edgeId, trace, { color: '#10b981', width: 2 })
    edges.push({
      id: edgeId,
      source: `role-${roleId}`,
      target: 'deliverable-node',
      label: index === 0 ? '结果归并' : '',
      ...traceProps,
    })
  })

  return { nodes, edges }
}

function buildOrgGraph(
  experience: NonNullable<Awaited<ReturnType<typeof loadOrchestrationRuntime>>['selectedExperience']>,
  roleLoadMap: Map<string, RoleLoadInfo>,
  onSelect: (detail: SelectedDetail) => void,
  trace: ExecutionTrace | null,
) {
  const nodes: Node[] = [{
    id: `team-${experience.summary.id}`,
    type: 'summaryNode',
    position: { x: 0, y: 0 },
    data: {
      title: experience.summary.name,
      subtitle: experience.summary.promise,
      emoji: '🏢',
      tone: 'from-brand-100 to-white',
      highlighted: false,
      onSelect: () => onSelect({ type: 'team', summary: experience.summary }),
    } satisfies SummaryNodeData,
  }]
  const edges: Edge[] = []

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
      } satisfies SummaryNodeData,
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
          load: roleLoadMap.get(role.manifest.id) ?? EMPTY_LOAD,
          traceState: getTraceState(role.manifest.id, trace),
          onSelect,
        } satisfies RoleNodeData,
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
        选择任务、角色、渠道或入口节点，可以查看对应的编排细节和控制信息。
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
          <span className="badge badge-green">{detail.summary.quickStarts.length} 入口</span>
        </div>
        <p className="text-xs text-text-muted leading-6">{detail.summary.promise}</p>
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
        <div className="rounded-2xl border border-surface-border bg-surface-bg p-4 text-xs space-y-2">
          <p className="font-semibold text-text-secondary">控制面观察</p>
          <p className="text-text-primary">当前通过该渠道进入的活跃任务：{detail.activeTasks} 个</p>
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
        {detail.load.pendingApprovals > 0 && <span className="badge badge-yellow">{detail.load.pendingApprovals} 审批</span>}
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
          <p className="font-semibold text-text-secondary">运行负载</p>
          <p className="text-text-primary">执行中：{detail.load.activeTasks} · 待处理：{detail.load.waitingTasks + detail.load.blockedTasks}</p>
          <p className="text-text-primary">已完成：{detail.load.completedTasks} · 失败：{detail.load.failedTasks}</p>
        </div>
        <div className="rounded-2xl border border-surface-border bg-surface-bg p-4 space-y-2">
          <p className="font-semibold text-text-secondary">必需技能</p>
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

function TaskControlCard({
  task,
  activePreset,
  busyKey,
  onAction,
}: {
  task: TrackedTask | null
  activePreset: Awaited<ReturnType<typeof loadOrchestrationRuntime>>['activeExperiencePreset']
  busyKey: string | null
  onAction: (action: ActiveTaskPanelAction | 'reroute', task: TrackedTask, approvalId?: string, targetRoleId?: string) => void
}) {
  if (!task) {
    return (
      <div className="card p-5 text-sm text-text-secondary">
        选择一个任务后，这里会显示完整步骤、最新信号和重派入口。
      </div>
    )
  }

  const rerouteTargets = task.recommendedTargets
    .map((targetRoleId) => ({
      id: targetRoleId,
      name: activePreset?.roles.find((role) => role.manifest.id === targetRoleId)?.manifest.name ?? targetRoleId,
    }))

  return (
    <div className="card p-5 space-y-4">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`badge ${task.status === 'active' ? 'badge-blue' : task.status === 'waiting' ? 'badge-yellow' : task.status === 'completed' ? 'badge-green' : task.status === 'blocked' ? 'badge-red' : 'badge-purple'}`}>
            {task.status}
          </span>
          {task.pendingApprovals.length > 0 && <span className="badge badge-yellow">{task.pendingApprovals.length} 个审批</span>}
        </div>
        <h3 className="text-sm font-semibold text-text-primary mt-2">{task.title}</h3>
        <p className="text-xs text-text-secondary mt-1">{task.originUser} · {task.originChannel} · 当前负责 {task.currentAgentName ?? task.ownerRoleName ?? '未分配'}</p>
      </div>

      <div className="rounded-2xl border border-surface-border bg-surface-bg p-4 text-xs space-y-2">
        <p className="font-semibold text-text-secondary">最近信号</p>
        <p className="text-text-primary leading-6">{task.latestEvent ?? task.summary}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => onAction(task.currentSendPolicy === 'deny' || task.status === 'blocked' ? 'resume' : 'pause', task)} className="btn-secondary text-xs" disabled={busyKey === `${task.id}:${task.currentSendPolicy === 'deny' || task.status === 'blocked' ? 'resume' : 'pause'}`}>
          {task.currentSendPolicy === 'deny' || task.status === 'blocked' ? '▶ 恢复接收' : '⏸ 暂停接收'}
        </button>
        <button type="button" onClick={() => onAction('nudge', task)} className="btn-secondary text-xs" disabled={busyKey === `${task.id}:nudge`}>
          📣 催办
        </button>
        <button type="button" onClick={() => onAction('reset', task)} className="btn-secondary text-xs" disabled={busyKey === `${task.id}:reset`}>
          ↺ 重置会话
        </button>
        {task.pendingApprovals[0] && (
          <>
            <button type="button" onClick={() => onAction('approve', task, task.pendingApprovals[0]?.id)} className="btn-secondary text-xs" disabled={busyKey === `${task.id}:approve`}>
              ✅ 通过审批
            </button>
            <button type="button" onClick={() => onAction('deny', task, task.pendingApprovals[0]?.id)} className="btn-secondary text-xs" disabled={busyKey === `${task.id}:deny`}>
              ❌ 驳回审批
            </button>
          </>
        )}
      </div>

      {rerouteTargets.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-text-secondary">快速重派</p>
          <div className="flex flex-wrap gap-2">
            {rerouteTargets.map((target) => (
              <button
                key={target.id}
                type="button"
                onClick={() => onAction('reroute', task, undefined, target.id)}
                className="btn-secondary text-xs"
                disabled={busyKey === `${task.id}:reroute:${target.id}`}
              >
                ↗ 重派至 {target.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <TaskStepTimeline steps={task.steps} />
    </div>
  )
}

export default function Orchestration() {
  const [viewMode, setViewMode] = useState<ViewMode>('graph')
  const [interactionMode, setInteractionMode] = useState<InteractionMode>('read')
  const [focusMode, setFocusMode] = useState(false)
  const [presets, setPresets] = useState<ExperiencePresetSummary[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [runtime, setRuntime] = useState<Awaited<ReturnType<typeof loadOrchestrationRuntime>> | null>(null)
  const [loading, setLoading] = useState(true)
  const [importingId, setImportingId] = useState<string | null>(null)
  const [selectedDetail, setSelectedDetail] = useState<SelectedDetail | null>(null)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [actionBusyKey, setActionBusyKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const previousLayoutStorageKeyRef = useRef<string | null>(null)

  const loadRuntime = useCallback(async (templateId: string) => {
    setLoading(true)
    setError(null)
    try {
      const nextRuntime = await loadOrchestrationRuntime({ templateId })
      setRuntime(nextRuntime)
      setSelectedTaskId((current) => nextRuntime.tasks.some((task) => task.id === current) ? current : nextRuntime.tasks[0]?.id ?? null)
      if (nextRuntime.selectedExperience) {
        setSelectedDetail({ type: 'team', summary: nextRuntime.selectedExperience.summary })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载编排数据失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function bootstrap() {
      setLoading(true)
      setError(null)
      try {
        const [presetList, config] = await Promise.all([
          listExperiencePresets(),
          getAPI().getConfig(),
        ])
        if (cancelled) return
        setPresets(presetList)
        const defaultId = (isExperienceSummary(config.experience) ? config.experience.templateId : null) ?? presetList[0]?.id ?? null
        setSelectedTemplateId(defaultId)
        if (!defaultId) {
          setLoading(false)
        }
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : '加载预设失败')
        setLoading(false)
      }
    }
    void bootstrap()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!selectedTemplateId) return
    void loadRuntime(selectedTemplateId)
  }, [selectedTemplateId, loadRuntime])

  useEffect(() => {
    if (!selectedTemplateId) return
    return subscribeToOrchestrationEvents(() => {
      void loadRuntime(selectedTemplateId)
    })
  }, [loadRuntime, selectedTemplateId])

  const handleImport = useCallback(async (templateId: string) => {
    setImportingId(templateId)
    setError(null)
    try {
      await importExperiencePreset(templateId)
      setSelectedTemplateId(templateId)
      await loadRuntime(templateId)
    } catch (err) {
      setError(err instanceof Error ? err.message : '导入模板失败')
    } finally {
      setImportingId(null)
    }
  }, [loadRuntime])

  const loadedExperience = runtime?.selectedExperience ?? null
  const activePreset = runtime?.activeExperiencePreset ?? null
  const selectedTask = useMemo(
    () => runtime?.tasks.find((task) => task.id === selectedTaskId) ?? null,
    [runtime?.tasks, selectedTaskId],
  )
  const trace = useMemo(() => buildExecutionTrace(selectedTask), [selectedTask])
  const graphTasks = useMemo(() => {
    if (!runtime || !loadedExperience || !activePreset) return []
    return loadedExperience.template.id === activePreset.template.id ? runtime.tasks : []
  }, [runtime, loadedExperience, activePreset])
  const roleLoadMap = useMemo(() => buildRoleLoadMap(graphTasks), [graphTasks])

  const graph = useMemo(() => {
    if (!loadedExperience) return { nodes: [] as Node[], edges: [] as Edge[] }
    if (viewMode === 'channels') {
      return buildChannelTopology(runtime?.channels ?? null, loadedExperience, roleLoadMap, runtime?.tasks ?? [], setSelectedDetail, trace)
    }
    if (viewMode === 'org') {
      return buildOrgGraph(loadedExperience, roleLoadMap, setSelectedDetail, trace)
    }
    return buildOrchestrationGraph(loadedExperience, roleLoadMap, setSelectedDetail, trace)
  }, [loadedExperience, viewMode, runtime?.channels, runtime?.tasks, roleLoadMap, trace])

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

  const handleTaskAction = useCallback(async (action: ActiveTaskPanelAction | 'reroute', task: TrackedTask, approvalId?: string, targetRoleId?: string) => {
    const busyKey = action === 'reroute' && targetRoleId ? `${task.id}:${action}:${targetRoleId}` : `${task.id}:${action}`
    setActionBusyKey(busyKey)
    setError(null)
    try {
      switch (action) {
        case 'pause':
          await performTaskIntervention({ kind: 'pause', task })
          break
        case 'resume':
          await performTaskIntervention({ kind: 'resume', task })
          break
        case 'reset':
          await performTaskIntervention({ kind: 'reset', task })
          break
        case 'nudge':
          await performTaskIntervention({ kind: 'nudge', task })
          break
        case 'approve':
          await performTaskIntervention({ kind: 'approve', task, approvalId })
          break
        case 'deny':
          await performTaskIntervention({ kind: 'deny', task, approvalId })
          break
        case 'reroute':
          if (!targetRoleId) return
          await performTaskIntervention({ kind: 'reroute', task, targetRoleId })
          break
      }
      if (selectedTemplateId) {
        await loadRuntime(selectedTemplateId)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '控制动作执行失败')
    } finally {
      setActionBusyKey(null)
    }
  }, [loadRuntime, selectedTemplateId])

  const viewingActiveTemplate = loadedExperience?.template.id === activePreset?.template.id
  const headerStats = useMemo(() => {
    if (!loadedExperience || !runtime) return []
    return [
      { label: '团队角色', value: String(loadedExperience.summary.roleCount) },
      { label: '工作流交接', value: String(loadedExperience.summary.handoffCount) },
      { label: '活跃任务', value: String(runtime.taskSummary.active) },
      { label: '待审批', value: String(runtime.taskSummary.pendingApprovals) },
    ]
  }, [loadedExperience, runtime])

  if (loading && !runtime) {
    return <div className="flex items-center justify-center h-80 text-text-secondary text-sm">加载编排控制面...</div>
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
                <span className="badge badge-purple">编排控制面</span>
                {activePreset && <span className="badge badge-green">当前运行：{activePreset.summary.name}</span>}
                {!viewingActiveTemplate && <span className="badge badge-yellow">当前为模板预览视图</span>}
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

      <OrchestratorHealthStrip experience={runtime?.experience ?? null} health={runtime?.health ?? null} taskSummary={runtime?.taskSummary ?? null} />

      {error && (
        <div className="rounded-2xl border border-accent-red/30 bg-pastel-red/20 px-4 py-3 text-sm text-accent-red">
          {error}
        </div>
      )}

      {!viewingActiveTemplate && activePreset && (
        <div className="rounded-2xl border border-accent-yellow/30 bg-pastel-yellow/20 px-4 py-3 text-sm text-accent-yellow">
          当前正在运行的是 <span className="font-semibold">{activePreset.summary.name}</span>，画布展示的是 <span className="font-semibold">{loadedExperience?.summary.name}</span> 模板预览，因此任务高亮与负载数据不会映射到该预览模板。
        </div>
      )}

      <div className={`grid gap-6 items-start ${focusMode ? 'grid-cols-1' : 'grid-cols-[minmax(0,1fr)_380px]'}`}>
        <div className="space-y-4 min-w-0">
          <div className="card p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => setViewMode('graph')} className={`px-3 py-1.5 rounded-xl text-sm transition-colors ${viewMode === 'graph' ? 'bg-brand-50 text-brand-600 font-semibold' : 'bg-surface-hover text-text-secondary hover:text-text-primary'}`}>
                  🧩 执行图谱
                </button>
                <button onClick={() => setViewMode('channels')} className={`px-3 py-1.5 rounded-xl text-sm transition-colors ${viewMode === 'channels' ? 'bg-brand-50 text-brand-600 font-semibold' : 'bg-surface-hover text-text-secondary hover:text-text-primary'}`}>
                  🔗 入口拓扑
                </button>
                <button onClick={() => setViewMode('org')} className={`px-3 py-1.5 rounded-xl text-sm transition-colors ${viewMode === 'org' ? 'bg-brand-50 text-brand-600 font-semibold' : 'bg-surface-hover text-text-secondary hover:text-text-primary'}`}>
                  🏢 组织架构
                </button>
              </div>
              <div className="text-xs text-text-secondary">
                {viewMode === 'graph' && '高亮当前任务路径、门禁与交付归并'}
                {viewMode === 'channels' && '查看任务如何从渠道进入组织网络'}
                {viewMode === 'org' && '查看层级覆盖与角色负载'}
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
              <span className="badge badge-blue">蓝色：当前执行路径</span>
              <span className="badge badge-green">绿色：已完成</span>
              <span className="badge badge-yellow">黄色：待审批 / 门禁</span>
              <span className="badge badge-red">红色：阻断 / 失败</span>
              <span className="badge badge-purple">{interactionMode === 'read' ? '拖动画布浏览' : '拖动节点调整布局'}</span>
            </div>
          </div>

          <div className={`card relative overflow-hidden ${focusMode ? 'h-[860px]' : 'h-[760px]'}`}>
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
                  const data = node.data as Partial<RoleNodeData> & Partial<SummaryNodeData> & Partial<ChannelNodeData> | undefined
                  if (data?.traceState === 'active') return '#3b82f6'
                  if (data?.traceState === 'completed') return '#10b981'
                  if (data?.traceState === 'waiting') return '#f59e0b'
                  if (data?.traceState === 'blocked') return '#ef4444'
                  if (node.id.startsWith('channel-')) return '#60a5fa'
                  if (node.id.startsWith('quickstart-')) return '#c084fc'
                  if (node.id === 'deliverable-node') return '#34d399'
                  if (node.id.startsWith('role-')) return '#94a3b8'
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
            <ActiveTasksPanel
              title="运行态任务"
              subtitle={activePreset ? `当前控制面观测 ${activePreset.summary.name}` : '尚未激活运行中的企业编排团队'}
              tasks={runtime?.tasks ?? []}
              selectedTaskId={selectedTaskId}
              onSelectTask={(task) => setSelectedTaskId(task.id)}
              onAction={handleTaskAction}
              busyKey={actionBusyKey}
            />
            <TaskControlCard task={selectedTask} activePreset={activePreset} busyKey={actionBusyKey} onAction={handleTaskAction} />
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
