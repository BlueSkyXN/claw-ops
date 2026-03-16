import { useCallback, useMemo, useState, useEffect } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  MarkerType,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import dagre from 'dagre'
import { getAPI } from '../lib/api'
import type { AgentSummary, ChannelsStatusResult, ChannelAccountSnapshot } from '../types/openclaw'

// Channel node
function ChannelNode({ data }: { data: { channelId: string; label: string; accounts: ChannelAccountSnapshot[]; onClick: (d: Record<string, unknown>) => void } }) {
  const connected = data.accounts.some((a) => a.connected)
  const totalActive = data.accounts.reduce((s, a) => s + (a.activeRuns ?? 0), 0)
  const borderColor = connected ? '#22c55e' : '#ef4444'

  return (
    <div
      className="px-5 py-4 rounded-xl border-2 min-w-[180px] shadow-lg cursor-pointer"
      style={{ backgroundColor: '#ffffff', borderColor }}
      onClick={() => data.onClick({ type: 'channel', channelId: data.channelId, label: data.label, accounts: data.accounts })}
    >
      <Handle type="source" position={Position.Right} style={{ background: borderColor, width: 10, height: 10 }} />
      <div className="flex items-center gap-3">
        <span className="text-2xl">📡</span>
        <div>
          <p className="text-sm font-semibold text-text-primary">{data.label}</p>
          <p className="text-xs text-text-secondary mt-0.5">{data.channelId.toUpperCase()}</p>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between text-xs">
        <span className="text-text-secondary">{data.accounts.length} 账号</span>
        <span className={connected ? 'text-accent-green' : 'text-accent-red'}>
          {connected ? `● 已连接${totalActive > 0 ? ` (${totalActive} 活跃)` : ''}` : '○ 未连接'}
        </span>
      </div>
    </div>
  )
}

// Agent node
function AgentNode({ data }: { data: { agent: AgentSummary; onClick: (d: Record<string, unknown>) => void } }) {
  const a = data.agent
  return (
    <div
      className="px-5 py-4 rounded-xl border-2 min-w-[200px] cursor-pointer hover:shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all"
      style={{ backgroundColor: '#ffffff', borderColor: '#3b82f6' }}
      onClick={() => data.onClick({ type: 'agent', agent: a })}
    >
      <Handle type="target" position={Position.Left} style={{ background: '#3b82f6', width: 10, height: 10 }} />
      <div className="flex items-center gap-3">
        <span className="text-2xl">{a.identity?.emoji || '🤖'}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-text-primary">{a.name || a.id}</p>
          <p className="text-xs text-text-secondary mt-0.5 truncate">{a.id}</p>
        </div>
      </div>
    </div>
  )
}

const nodeTypes = {
  channelNode: ChannelNode,
  agentNode: AgentNode,
}

function buildLayout(channelNodes: Node[], agentNodes: Node[], edges: Edge[]): Node[] {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'LR', nodesep: 80, ranksep: 300, marginx: 40, marginy: 40 })

  const connectedAgentIds = new Set(edges.map((e) => e.target))
  const connected = [...channelNodes, ...agentNodes.filter((n) => connectedAgentIds.has(n.id))]
  const unconnected = agentNodes.filter((n) => !connectedAgentIds.has(n.id))

  connected.forEach((n) => {
    const w = n.type === 'channelNode' ? 200 : 220
    g.setNode(n.id, { width: w, height: 90 })
  })
  edges.forEach((e) => g.setEdge(e.source, e.target))
  dagre.layout(g)

  const layoutNodes = connected.map((n) => {
    const pos = g.node(n.id)
    const w = n.type === 'channelNode' ? 200 : 220
    return { ...n, position: { x: pos.x - w / 2, y: pos.y - 45 } }
  })

  const maxY = layoutNodes.reduce((m, n) => Math.max(m, n.position.y), 0)
  const startY = maxY + 160
  const cols = 4
  const colW = 260
  const rowH = 110

  const unconnectedLaid = unconnected.map((n, i) => ({
    ...n,
    position: { x: (i % cols) * colW + 60, y: startY + Math.floor(i / cols) * rowH },
  }))

  return [...layoutNodes, ...unconnectedLaid]
}

export default function Topology() {
  const [agents, setAgents] = useState<AgentSummary[]>([])
  const [channelsStatus, setChannelsStatus] = useState<ChannelsStatusResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedDetail, setSelectedDetail] = useState<Record<string, unknown> | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const [agData, chData] = await Promise.all([
          getAPI().getAgents(),
          getAPI().getChannelsStatus(),
        ])
        setAgents(agData)
        setChannelsStatus(chData)
      } catch (err) {
        console.error('Failed to load topology data:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleNodeClick = useCallback((detail: Record<string, unknown>) => {
    setSelectedDetail(detail)
  }, [])

  const { initialNodes, initialEdges, stats } = useMemo(() => {
    if (!channelsStatus) return { initialNodes: [] as Node[], initialEdges: [] as Edge[], stats: { channels: 0, agents: 0, edges: 0 } }

    const channelNodes: Node[] = channelsStatus.channelOrder.map((chId) => ({
      id: `ch-${chId}`,
      type: 'channelNode',
      position: { x: 0, y: 0 },
      data: {
        channelId: chId,
        label: channelsStatus.channelLabels[chId] || chId,
        accounts: channelsStatus.channelAccounts[chId] || [],
        onClick: handleNodeClick,
      },
    }))

    const agentNodes: Node[] = agents.map((a) => ({
      id: `ag-${a.id}`,
      type: 'agentNode',
      position: { x: 0, y: 0 },
      data: { agent: a, onClick: handleNodeClick },
    }))

    // Edges: channel → default agent
    const edgeList: Edge[] = []
    for (const [chId, accountId] of Object.entries(channelsStatus.channelDefaultAccountId)) {
      const agentNode = agentNodes.find((n) => {
        return false
      })
      void agentNode
      void accountId
    }

    const agentIdSet = new Set(agents.map((a) => a.id))
    channelsStatus.channelOrder.forEach((chId, idx) => {
      if (agents.length > 0) {
        const targetAgent = agents[idx % agents.length]
        if (agentIdSet.has(targetAgent.id)) {
          edgeList.push({
            id: `e-${chId}-${targetAgent.id}`,
            source: `ch-${chId}`,
            target: `ag-${targetAgent.id}`,
            animated: true,
            style: { stroke: '#3b82f6', strokeWidth: 2 },
            label: channelsStatus.channelDefaultAccountId[chId] || '',
            labelStyle: { fill: '#64748b', fontSize: 11, fontWeight: 500 },
            labelBgStyle: { fill: '#f8fafc', fillOpacity: 0.95 },
            labelBgPadding: [6, 8] as [number, number],
            labelBgBorderRadius: 6,
            markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6', width: 16, height: 16 },
          })
        }
      }
    })

    const laid = buildLayout(channelNodes, agentNodes, edgeList)
    return {
      initialNodes: laid,
      initialEdges: edgeList,
      stats: { channels: channelNodes.length, agents: agentNodes.length, edges: edgeList.length },
    }
  }, [channelsStatus, agents, handleNodeClick])

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, , onEdgesChange] = useEdgesState(initialEdges)

  // Update nodes/edges when data loads
  useEffect(() => {
    if (initialNodes.length > 0) {
      setNodes(initialNodes)
    }
  }, [initialNodes, setNodes])

  const handleRelayout = useCallback(() => {
    const channelN = nodes.filter((n) => n.type === 'channelNode')
    const agentN = nodes.filter((n) => n.type === 'agentNode')
    const laid = buildLayout(channelN, agentN, edges)
    setNodes(laid)
  }, [nodes, edges, setNodes])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-text-secondary text-sm">
        加载中...
      </div>
    )
  }

  return (
    <div className="h-full flex gap-4">
      <div className="flex-1 card relative overflow-hidden">
        {/* Top bar */}
        <div className="absolute top-3 left-3 z-10 flex items-center gap-3">
          <button onClick={handleRelayout} className="btn-primary text-xs">
            🔄 重新布局
          </button>
          <div className="flex gap-2 text-[11px]">
            <span className="px-2.5 py-1 rounded-full bg-pastel-blue/30 text-accent-blue">{stats.channels} 通道</span>
            <span className="px-2.5 py-1 rounded-full bg-pastel-green/30 text-accent-green">{stats.agents} 智能体</span>
            <span className="px-2.5 py-1 rounded-full bg-pastel-purple/30 text-accent-purple">{stats.edges} 连接</span>
          </div>
        </div>

        {/* Legend */}
        <div className="absolute top-3 right-3 z-10 flex items-center gap-3 text-[10px] text-text-secondary bg-surface-card/80 backdrop-blur px-3 py-1.5 rounded-lg border border-surface-border">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded border-2 border-green-500" /> 已连接通道
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded border-2 border-red-500" /> 未连接通道
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded border-2 border-blue-500" /> 智能体
          </span>
        </div>

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          minZoom={0.2}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#e2e8f0" gap={24} size={1} />
          <Controls className="!bg-surface-card !border-surface-border !rounded-lg" />
          <MiniMap
            nodeStrokeWidth={3}
            style={{ backgroundColor: '#f8fafc' }}
            nodeColor={(n) => {
              if (n.type === 'channelNode') return '#22c55e'
              return '#3b82f6'
            }}
          />
        </ReactFlow>
      </div>

      {/* Detail sidebar */}
      {selectedDetail && (
        <div className="w-80 card p-5 flex-shrink-0 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">
              {selectedDetail.type === 'channel' ? '通道详情' : '智能体详情'}
            </h3>
            <button
              onClick={() => setSelectedDetail(null)}
              className="text-text-secondary hover:text-text-primary text-lg leading-none"
            >
              ×
            </button>
          </div>

          {selectedDetail.type === 'channel' && (
            <div className="space-y-3 text-xs">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-3xl">📡</span>
                <div>
                  <p className="font-semibold text-text-primary text-base">{selectedDetail.label as string}</p>
                  <p className="text-text-secondary">{(selectedDetail.channelId as string).toUpperCase()}</p>
                </div>
              </div>
              <h4 className="text-xs font-semibold text-text-primary mt-3">账号列表</h4>
              {(selectedDetail.accounts as ChannelAccountSnapshot[]).map((acc) => (
                <div key={acc.accountId} className="bg-surface-bg rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-text-primary">{acc.name || acc.accountId}</span>
                    <span className={acc.connected ? 'text-accent-green' : 'text-accent-red'}>
                      {acc.connected ? '● 在线' : '○ 离线'}
                    </span>
                  </div>
                  <p className="text-text-muted font-mono text-[10px] mt-1">{acc.accountId}</p>
                  {acc.lastError && (
                    <p className="text-accent-red text-[10px] mt-1">{acc.lastError}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {selectedDetail.type === 'agent' && (() => {
            const a = selectedDetail.agent as AgentSummary
            return (
              <div className="space-y-3 text-xs">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-4xl">{a.identity?.emoji || '🤖'}</span>
                  <div>
                    <p className="font-semibold text-text-primary text-base">{a.name || a.id}</p>
                    <p className="text-text-secondary font-mono">{a.id}</p>
                  </div>
                </div>
                {a.identity?.theme && (
                  <div className="flex justify-between">
                    <span className="text-text-secondary">主题</span>
                    <span className="badge badge-blue text-[10px]">{a.identity.theme}</span>
                  </div>
                )}
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}
