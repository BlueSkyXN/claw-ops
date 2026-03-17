import { useState, useEffect, useMemo } from 'react'
import { getAPI } from '../lib/api'
import { getRuntimeCapabilities, loadConfig, MODE_LABELS } from '../lib/config'
import type { GatewaySessionRow, SessionsListResult, AgentSummary } from '../types/openclaw'

const channelEmoji: Record<string, string> = {
  telegram: '📱', feishu: '🐦', discord: '🎮', slack: '💬', whatsapp: '📞', api: '🔌', webchat: '🌐',
}

const kindConfig: Record<string, { label: string; cls: string }> = {
  direct: { label: '私聊', cls: 'bg-pastel-blue/30 text-accent-blue' },
  group: { label: '群聊', cls: 'bg-pastel-purple/30 text-accent-purple' },
  global: { label: '全局', cls: 'bg-pastel-cyan/30 text-accent-cyan' },
  unknown: { label: '未知', cls: 'bg-surface-hover text-text-secondary' },
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function relativeTime(ts: number | null): string {
  if (!ts) return '—'
  const diff = Date.now() - ts
  const min = Math.floor(diff / 60000)
  if (min < 1) return '刚刚'
  if (min < 60) return `${min} 分钟前`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h} 小时前`
  return `${Math.floor(h / 24)} 天前`
}

function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return '未知错误'
}

function SessionDetailPanel({ session, agents, onClose, onDelete, onReset, allowSessionMutations, mutationHint }: {
  session: GatewaySessionRow
  agents: AgentSummary[]
  onClose: () => void
  onDelete: (key: string) => void
  onReset: (key: string) => void
  allowSessionMutations: boolean
  mutationHint?: string
}) {
  const agent = agents.find(a => session.key.includes(a.id))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-surface-card border border-surface-border rounded-2xl w-[600px] max-h-[80vh] overflow-y-auto p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              {session.channel && (
                <span className="text-lg">{channelEmoji[session.channel] || '📡'}</span>
              )}
              <h2 className="text-lg font-semibold text-text-primary">
                {session.label || session.displayName || session.key}
              </h2>
            </div>
            <p className="text-xs text-text-secondary font-mono">{session.key}</p>
          </div>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary text-xl leading-none p-1">×</button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="bg-surface-bg rounded-lg p-3">
            <p className="text-[10px] text-text-secondary mb-0.5">类型</p>
            <span className={`badge text-[10px] ${kindConfig[session.kind]?.cls}`}>
              {kindConfig[session.kind]?.label}
            </span>
          </div>
          <div className="bg-surface-bg rounded-lg p-3">
            <p className="text-[10px] text-text-secondary mb-0.5">渠道</p>
            <p className="text-sm text-text-primary">{session.channel || '—'}</p>
          </div>
          <div className="bg-surface-bg rounded-lg p-3">
            <p className="text-[10px] text-text-secondary mb-0.5">模型</p>
            <p className="text-sm text-text-primary">{session.model || '—'}</p>
          </div>
          <div className="bg-surface-bg rounded-lg p-3">
            <p className="text-[10px] text-text-secondary mb-0.5">提供商</p>
            <p className="text-sm text-text-primary">{session.modelProvider || '—'}</p>
          </div>
          <div className="bg-surface-bg rounded-lg p-3">
            <p className="text-[10px] text-text-secondary mb-0.5">发送策略</p>
            <span className={`badge text-[10px] ${session.sendPolicy === 'allow' ? 'bg-pastel-green/30 text-accent-green' : 'bg-pastel-red/30 text-accent-red'}`}>
              {session.sendPolicy === 'allow' ? '允许' : '禁止'}
            </span>
          </div>
          <div className="bg-surface-bg rounded-lg p-3">
            <p className="text-[10px] text-text-secondary mb-0.5">智能体</p>
            <p className="text-sm text-text-primary">
              {agent ? `${agent.identity?.emoji || ''} ${agent.name || agent.id}` : '—'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="stat-card !p-3">
            <span className="stat-label">输入 Token</span>
            <span className="text-sm font-semibold text-text-primary">{formatTokens(session.inputTokens ?? 0)}</span>
          </div>
          <div className="stat-card !p-3">
            <span className="stat-label">输出 Token</span>
            <span className="text-sm font-semibold text-text-primary">{formatTokens(session.outputTokens ?? 0)}</span>
          </div>
          <div className="stat-card !p-3">
            <span className="stat-label">总 Token</span>
            <span className="text-sm font-semibold text-text-primary">{formatTokens(session.totalTokens ?? 0)}</span>
          </div>
        </div>

        {session.lastMessagePreview && (
          <div className="mb-5">
            <h3 className="text-sm font-semibold mb-2">最后消息</h3>
            <div className="bg-surface-bg rounded-lg p-3 text-xs text-text-primary">
              {session.lastMessagePreview}
            </div>
          </div>
        )}

        {/* Additional metadata */}
        <div className="space-y-2 mb-5 text-xs">
          {session.thinkingLevel && (
            <div className="flex justify-between"><span className="text-text-secondary">思考级别</span><span className="text-text-primary">{session.thinkingLevel}</span></div>
          )}
          {session.reasoningLevel && (
            <div className="flex justify-between"><span className="text-text-secondary">推理级别</span><span className="text-text-primary">{session.reasoningLevel}</span></div>
          )}
          {session.responseUsage && (
            <div className="flex justify-between"><span className="text-text-secondary">响应用量</span><span className="text-text-primary">{session.responseUsage}</span></div>
          )}
          {session.contextTokens && (
            <div className="flex justify-between"><span className="text-text-secondary">上下文窗口</span><span className="text-text-primary">{formatTokens(session.contextTokens)}</span></div>
          )}
        </div>

        <div className="flex items-center gap-3 pt-4 border-t border-surface-border">
          {!allowSessionMutations && mutationHint && (
            <div className="flex-1 text-[11px] text-accent-yellow bg-pastel-yellow/20 border border-accent-yellow/20 rounded-xl px-3 py-2">
              {mutationHint}
            </div>
          )}
          <button
            onClick={() => onReset(session.key)}
            disabled={!allowSessionMutations}
            className="btn-secondary text-xs disabled:opacity-40 disabled:cursor-not-allowed"
          >
            🔄 重置会话
          </button>
          <button
            onClick={() => onDelete(session.key)}
            disabled={!allowSessionMutations}
            className="px-4 py-2 bg-pastel-red/20 text-accent-red border border-accent-red/20 rounded-xl hover:bg-pastel-red/40 transition-all text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed"
          >
            🗑️ 删除会话
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Sessions() {
  const runtimeConfig = loadConfig()
  const runtimeCaps = getRuntimeCapabilities(runtimeConfig)
  const [data, setData] = useState<SessionsListResult | null>(null)
  const [agents, setAgents] = useState<AgentSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [channelFilter, setChannelFilter] = useState('')
  const [kindFilter, setKindFilter] = useState('')
  const [search, setSearch] = useState('')
  const [selectedSession, setSelectedSession] = useState<GatewaySessionRow | null>(null)
  const [notice, setNotice] = useState<{ type: 'info' | 'error'; message: string } | null>(null)

  const mutationHint = runtimeConfig.mode === 'cli' && !runtimeCaps.sessionMutations
    ? '当前 CLI 模式未接入官方 sessions.patch/reset/delete；会话详情仍可查看，但重置/删除按钮被显式禁用。'
    : undefined

  const loadData = () => {
    setLoading(true)
    setNotice((current) => (current?.type === 'error' ? null : current))
    Promise.all([
      getAPI().getSessions({ limit: 200, includeGlobal: true, includeUnknown: true, includeDerivedTitles: true, includeLastMessage: true }),
      getAPI().getAgents(),
    ])
      .then(([sessionsResult, agentsList]) => {
        setData(sessionsResult)
        setAgents(agentsList)
      })
      .catch((error) => {
        console.error(error)
        setNotice({
          type: 'error',
          message: `会话数据加载失败：${formatErrorMessage(error)}`,
        })
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadData() }, [])

  const sessions = data?.sessions ?? []

  const channels = useMemo(() => {
    const set = new Set(sessions.map(s => s.channel).filter(Boolean) as string[])
    return Array.from(set).sort()
  }, [sessions])

  const filtered = useMemo(() => {
    return sessions
      .filter(s => {
        if (channelFilter && s.channel !== channelFilter) return false
        if (kindFilter && s.kind !== kindFilter) return false
        if (search) {
          const q = search.toLowerCase()
          const haystack = [s.label, s.displayName, s.key, s.lastMessagePreview, s.channel].filter(Boolean).join(' ').toLowerCase()
          if (!haystack.includes(q)) return false
        }
        return true
      })
      .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
  }, [sessions, channelFilter, kindFilter, search])

  const stats = useMemo(() => {
    const total = sessions.length
    const direct = sessions.filter(s => s.kind === 'direct').length
    const group = sessions.filter(s => s.kind === 'group').length
    const tokens = sessions.reduce((sum, s) => sum + (s.totalTokens ?? 0), 0)
    return { total, direct, group, tokens }
  }, [sessions])

  const findAgent = (session: GatewaySessionRow) => {
    return agents.find(a => session.key.includes(a.id))
  }

  const handleDelete = async (key: string) => {
    if (!runtimeCaps.sessionMutations) {
      setNotice({ type: 'info', message: mutationHint ?? '当前模式不支持删除会话。' })
      return
    }
    if (!confirm('确定要删除此会话？此操作不可撤销。')) return
    try {
      await getAPI().deleteSession(key)
      setSelectedSession(null)
      setNotice(null)
      loadData()
    } catch (error) {
      console.error(error)
      setNotice({
        type: 'error',
        message: `删除会话失败：${formatErrorMessage(error)}`,
      })
    }
  }

  const handleReset = async (key: string) => {
    if (!runtimeCaps.sessionMutations) {
      setNotice({ type: 'info', message: mutationHint ?? '当前模式不支持重置会话。' })
      return
    }
    if (!confirm('确定要重置此会话？历史消息将被清除。')) return
    try {
      await getAPI().resetSession(key)
      setSelectedSession(null)
      setNotice(null)
      loadData()
    } catch (error) {
      console.error(error)
      setNotice({
        type: 'error',
        message: `重置会话失败：${formatErrorMessage(error)}`,
      })
    }
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="stat-card">
          <span className="stat-label">总会话</span>
          <span className="stat-value">{stats.total}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">私聊会话</span>
          <span className="stat-value">{stats.direct}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">群聊会话</span>
          <span className="stat-value">{stats.group}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">总 Token 消耗</span>
          <span className="stat-value">{formatTokens(stats.tokens)}</span>
        </div>
      </div>

      {(mutationHint || notice) && (
        <div
          className={`card p-4 text-sm ${
            notice?.type === 'error'
              ? 'border border-accent-red/20 bg-pastel-red/20 text-accent-red'
              : 'border border-accent-yellow/20 bg-pastel-yellow/20 text-accent-yellow'
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              {mutationHint && (
                <div className="font-medium mb-1">
                  {MODE_LABELS[runtimeConfig.mode].icon} {MODE_LABELS[runtimeConfig.mode].name} 能力提示
                </div>
              )}
              <div>{notice?.message ?? mutationHint}</div>
            </div>
            {notice && (
              <button
                onClick={() => setNotice(null)}
                className="text-xs opacity-70 hover:opacity-100"
              >
                关闭
              </button>
            )}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-secondary">渠道：</span>
            <select
              value={channelFilter}
              onChange={e => setChannelFilter(e.target.value)}
              className="bg-surface-bg border border-surface-border rounded-lg px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-accent-blue"
            >
              <option value="">全部</option>
              {channels.map(ch => (
                <option key={ch} value={ch}>{channelEmoji[ch] || '📡'} {ch}</option>
              ))}
            </select>
          </div>

          <div className="w-px h-5 bg-surface-border" />

          <div className="flex items-center gap-2">
            <span className="text-xs text-text-secondary">类型：</span>
            <select
              value={kindFilter}
              onChange={e => setKindFilter(e.target.value)}
              className="bg-surface-bg border border-surface-border rounded-lg px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-accent-blue"
            >
              <option value="">全部</option>
              <option value="direct">私聊</option>
              <option value="group">群聊</option>
              <option value="global">全局</option>
            </select>
          </div>

          <div className="w-px h-5 bg-surface-border" />

          <div className="flex items-center gap-2">
            <span className="text-xs text-text-secondary">搜索：</span>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="标签、名称、消息内容..."
              className="bg-surface-bg border border-surface-border rounded-lg px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-accent-blue w-52"
            />
          </div>

          <div className="flex-1" />

          <button onClick={loadData} className="btn-ghost text-xs flex items-center gap-1">
            🔄 刷新
          </button>

          <span className="text-[11px] text-text-secondary">
            {filtered.length}/{sessions.length} 个会话
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-text-secondary text-sm">加载中...</div>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-surface-card">
              <tr className="border-b border-surface-border">
                <th className="text-left py-2.5 px-4 text-text-secondary font-normal">标签</th>
                <th className="text-left py-2.5 px-3 text-text-secondary font-normal w-24">渠道</th>
                <th className="text-left py-2.5 px-3 text-text-secondary font-normal w-16">类型</th>
                <th className="text-left py-2.5 px-3 text-text-secondary font-normal w-28">智能体</th>
                <th className="text-left py-2.5 px-3 text-text-secondary font-normal w-36">模型</th>
                <th className="text-right py-2.5 px-3 text-text-secondary font-normal w-20">Token</th>
                <th className="text-left py-2.5 px-3 text-text-secondary font-normal w-24">更新时间</th>
                <th className="text-left py-2.5 px-3 text-text-secondary font-normal">最后消息</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(session => {
                const kc = kindConfig[session.kind] || kindConfig.unknown
                const agent = findAgent(session)
                return (
                  <tr
                    key={session.key}
                    className="border-b border-surface-border/30 hover:bg-surface-hover transition-colors cursor-pointer"
                    onClick={() => setSelectedSession(session)}
                  >
                    <td className="py-2.5 px-4 text-text-primary font-medium">
                      {session.label || session.displayName || session.key.slice(0, 24)}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      {session.channel ? (
                        <span className="inline-flex items-center gap-1">
                          <span>{channelEmoji[session.channel] || '📡'}</span>
                          <span className="text-text-secondary">{session.channel}</span>
                        </span>
                      ) : (
                        <span className="text-text-muted/40">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`badge text-[10px] ${kc.cls}`}>{kc.label}</span>
                    </td>
                    <td className="py-2.5 px-3 text-text-primary whitespace-nowrap">
                      {agent ? `${agent.identity?.emoji || ''} ${agent.name || agent.id}` : '—'}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="badge bg-surface-hover text-text-secondary text-[10px]">
                        {session.model || '—'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right text-text-primary tabular-nums">
                      {formatTokens(session.totalTokens ?? 0)}
                    </td>
                    <td className="py-2.5 px-3 text-text-secondary whitespace-nowrap">
                      {relativeTime(session.updatedAt)}
                    </td>
                    <td className="py-2.5 px-3 text-text-secondary truncate max-w-[200px]">
                      {session.lastMessagePreview || '—'}
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-text-secondary">
                    {sessions.length === 0 ? '暂无会话数据' : '无匹配会话'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Detail Modal */}
      {selectedSession && (
        <SessionDetailPanel
          session={selectedSession}
          agents={agents}
          onClose={() => setSelectedSession(null)}
          onDelete={handleDelete}
          onReset={handleReset}
          allowSessionMutations={runtimeCaps.sessionMutations}
          mutationHint={mutationHint}
        />
      )}
    </div>
  )
}
