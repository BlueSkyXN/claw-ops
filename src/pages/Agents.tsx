import { useState, useEffect } from 'react'
import { getAPI } from '../lib/api'
import type { AgentSummary } from '../types/openclaw'

function AgentCard({ agent, onDelete }: { agent: AgentSummary; onDelete: (id: string) => void }) {
  return (
    <div className="card-hover p-5">
      <div className="flex items-start gap-3 mb-3">
        <span className="text-3xl">{agent.identity?.emoji || '🤖'}</span>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-text-primary truncate">{agent.name || agent.id}</h3>
          <p className="text-xs text-text-muted font-mono truncate">{agent.id}</p>
        </div>
        <button
          onClick={() => onDelete(agent.id)}
          className="text-text-muted hover:text-accent-red transition-colors text-sm leading-none p-1"
          title="删除智能体"
        >
          ✕
        </button>
      </div>

      {/* Identity theme */}
      {agent.identity?.theme && (
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="badge badge-blue text-[10px]">{agent.identity.theme}</span>
        </div>
      )}
    </div>
  )
}

function CreateAgentModal({ open, onClose, onCreated }: {
  open: boolean
  onClose: () => void
  onCreated: () => void
}) {
  const [name, setName] = useState('')
  const [workspace, setWorkspace] = useState('')
  const [loading, setLoading] = useState(false)

  if (!open) return null

  const handleSubmit = async () => {
    if (!name.trim()) return
    setLoading(true)
    try {
      await getAPI().createAgent({ name: name.trim(), workspace: workspace.trim() || undefined })
      setName('')
      setWorkspace('')
      onCreated()
      onClose()
    } catch (err) {
      console.error('Failed to create agent:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="card p-6 w-96 shadow-xl">
        <h3 className="text-base font-semibold text-text-primary mb-4">创建智能体</h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-text-secondary block mb-1">名称 *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：Coder"
              className="w-full bg-surface-bg border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-blue"
            />
          </div>
          <div>
            <label className="text-xs text-text-secondary block mb-1">工作空间</label>
            <input
              type="text"
              value={workspace}
              onChange={(e) => setWorkspace(e.target.value)}
              placeholder="可选，例如：~/.openclaw/workspaces/coder"
              className="w-full bg-surface-bg border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-blue"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="btn-secondary text-xs">取消</button>
          <button onClick={handleSubmit} disabled={!name.trim() || loading} className="btn-primary text-xs disabled:opacity-50">
            {loading ? '创建中...' : '创建'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Agents() {
  const [agents, setAgents] = useState<AgentSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)

  const fetchAgents = async () => {
    try {
      const data = await getAPI().getAgents()
      setAgents(data)
    } catch (err) {
      console.error('Failed to fetch agents:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAgents() }, [])

  const handleDelete = async (agentId: string) => {
    if (!confirm(`确认删除智能体 "${agentId}"？`)) return
    try {
      await getAPI().deleteAgent({ agentId })
      fetchAgents()
    } catch (err) {
      console.error('Failed to delete agent:', err)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-text-secondary text-sm">
        加载中...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">
          智能体列表
          <span className="ml-2 text-text-muted font-normal">({agents.length})</span>
        </h3>
        <button onClick={() => setShowCreate(true)} className="btn-primary text-xs flex items-center gap-1.5">
          <span>＋</span> 创建智能体
        </button>
      </div>

      {/* Agent grid */}
      {agents.length === 0 ? (
        <div className="card p-12 text-center text-text-secondary text-sm">
          暂无智能体，点击上方按钮创建
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {agents.map((a) => (
            <AgentCard key={a.id} agent={a} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {/* Create modal */}
      <CreateAgentModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={fetchAgents}
      />
    </div>
  )
}
