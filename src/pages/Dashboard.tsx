import { useState, useEffect, useMemo } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { getAPI } from '../lib/api'
import type { AgentSummary, GatewaySessionRow, SessionsUsageResult, ChannelsStatusResult } from '../types/openclaw'

// ==========================================
// Tooltip
// ==========================================

const ChartTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string }) => {
  if (!active || !payload) return null
  return (
    <div className="bg-surface-card border border-surface-border rounded-lg px-3 py-2 shadow-xl">
      <p className="text-xs text-text-secondary mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-xs" style={{ color: p.color }}>
          {p.name}: {typeof p.value === 'number' ? p.value.toLocaleString() : p.value}
        </p>
      ))}
    </div>
  )
}

// ==========================================
// Helpers
// ==========================================

function formatCost(cost: number): string {
  if (cost < 0.01) return `$${cost.toFixed(4)}`
  if (cost < 1) return `$${cost.toFixed(3)}`
  return `$${cost.toFixed(2)}`
}

function relativeTime(ts: number | null): string {
  if (!ts) return '-'
  const diff = Date.now() - ts
  const min = Math.floor(diff / 60000)
  if (min < 1) return '刚刚'
  if (min < 60) return `${min} 分钟前`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h} 小时前`
  return `${Math.floor(h / 24)} 天前`
}

const CHANNEL_ICONS: Record<string, string> = {
  telegram: '✈️',
  discord: '🎮',
  slack: '💬',
  wechat: '💚',
  whatsapp: '📱',
  web: '🌐',
  cli: '⌨️',
  api: '🔌',
}

function channelIcon(ch: string): string {
  const key = ch.toLowerCase()
  for (const [k, v] of Object.entries(CHANNEL_ICONS)) {
    if (key.includes(k)) return v
  }
  return '📡'
}

// ==========================================
// Loading skeleton
// ==========================================

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-surface-hover rounded ${className}`} />
}

// ==========================================
// Dashboard
// ==========================================

export default function Dashboard() {
  const [loading, setLoading] = useState(true)
  const [agents, setAgents] = useState<AgentSummary[]>([])
  const [sessions, setSessions] = useState<GatewaySessionRow[]>([])
  const [usage, setUsage] = useState<SessionsUsageResult | null>(null)
  const [channels, setChannels] = useState<ChannelsStatusResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadData() {
      setLoading(true)
      setError(null)
      try {
        const api = getAPI()
        const [agentsRes, sessionsRes, usageRes, channelsRes] = await Promise.all([
          api.getAgents(),
          api.getSessions({ limit: 100, includeDerivedTitles: true, includeLastMessage: true }),
          api.getSessionsUsage(),
          api.getChannelsStatus(),
        ])
        if (cancelled) return
        setAgents(agentsRes)
        setSessions(sessionsRes.sessions)
        setUsage(usageRes)
        setChannels(channelsRes)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : '数据加载失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadData()
    return () => { cancelled = true }
  }, [])

  // Derived data
  const connectedAccounts = useMemo(() => {
    if (!channels) return 0
    let count = 0
    for (const accounts of Object.values(channels.channelAccounts)) {
      for (const acc of accounts as Array<{ connected?: boolean }>) {
        if (acc.connected) count++
      }
    }
    return count
  }, [channels])

  const totalChannels = useMemo(() => {
    return channels?.channelOrder.length ?? 0
  }, [channels])

  const activeSessions = useMemo(() => {
    const now = Date.now()
    const threshold = 30 * 60 * 1000 // 30 minutes
    return sessions.filter(s => s.updatedAt && (now - s.updatedAt) < threshold).length
  }, [sessions])

  const dailyData = useMemo(() => {
    if (!usage?.aggregates?.daily) return []
    return usage.aggregates.daily.map(d => ({
      date: d.date.slice(5), // MM-DD
      tokens: d.tokens,
      cost: d.cost,
      messages: d.messages,
    }))
  }, [usage])

  const modelData = useMemo(() => {
    if (!usage?.aggregates?.byModel) return []
    return usage.aggregates.byModel
      .sort((a, b) => b.totals.totalTokens - a.totals.totalTokens)
      .slice(0, 8)
      .map(m => ({
        model: m.model.length > 20 ? m.model.slice(0, 18) + '…' : m.model,
        tokens: m.totals.totalTokens,
        cost: m.totals.totalCost,
        calls: m.count,
      }))
  }, [usage])

  const recentSessions = useMemo(() => {
    return [...sessions]
      .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
      .slice(0, 8)
  }, [sessions])

  const statCards = [
    {
      label: '智能体数量',
      value: agents.length,
      icon: '🤖',
      color: 'text-accent-blue',
      bg: 'bg-pastel-blue/20',
    },
    {
      label: '活跃会话',
      value: activeSessions,
      sub: `共 ${sessions.length} 个`,
      icon: '💬',
      color: 'text-accent-cyan',
      bg: 'bg-pastel-cyan/20',
    },
    {
      label: '已连接渠道',
      value: connectedAccounts,
      sub: `共 ${totalChannels} 个渠道`,
      icon: '📡',
      color: 'text-accent-green',
      bg: 'bg-pastel-green/20',
    },
    {
      label: '总费用',
      value: usage ? formatCost(usage.totals.totalCost) : '-',
      sub: usage ? `${usage.totals.totalTokens.toLocaleString()} tokens` : undefined,
      icon: '💰',
      color: 'text-accent-yellow',
      bg: 'bg-pastel-yellow/20',
    },
  ]

  // Error state
  if (error && !loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-3">
          <div className="text-4xl">⚠️</div>
          <p className="text-text-secondary">{error}</p>
          <button onClick={() => window.location.reload()} className="btn-secondary text-sm">
            重新加载
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4">
        {statCards.map(s => (
          <div key={s.label} className="stat-card">
            <div className="flex items-center justify-between">
              <span className="stat-label">{s.label}</span>
              <span className={`w-8 h-8 rounded-lg ${s.bg} flex items-center justify-center text-sm`}>
                {s.icon}
              </span>
            </div>
            {loading ? (
              <Skeleton className="h-8 w-20 mt-1" />
            ) : (
              <span className={`stat-value ${s.color}`}>{s.value}</span>
            )}
            {s.sub && <span className="text-[11px] text-text-secondary">{s.sub}</span>}
          </div>
        ))}
      </div>

      {/* Daily usage trend */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-text-primary mb-4">用量趋势 · 近 14 天</h3>
        {loading ? (
          <Skeleton className="h-[240px] w-full" />
        ) : dailyData.length > 0 ? (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={dailyData}>
              <defs>
                <linearGradient id="gradTokens" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradCost" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={{ stroke: '#e2e8f0' }} />
              <YAxis yAxisId="tokens" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={{ stroke: '#e2e8f0' }} />
              <YAxis yAxisId="cost" orientation="right" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={{ stroke: '#e2e8f0' }} tickFormatter={(v: number) => `$${v}`} />
              <Tooltip content={<ChartTooltip />} />
              <Area yAxisId="tokens" type="monotone" dataKey="tokens" name="Tokens" stroke="#3b82f6" fill="url(#gradTokens)" strokeWidth={2} />
              <Area yAxisId="cost" type="monotone" dataKey="cost" name="费用 ($)" stroke="#22c55e" fill="url(#gradCost)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[240px] flex items-center justify-center text-text-muted text-sm">暂无用量数据</div>
        )}
        {usage && !loading && (
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-surface-border text-xs text-text-secondary">
            <span>总消耗: {usage.totals.totalTokens.toLocaleString()} tokens</span>
            <span>总费用: {formatCost(usage.totals.totalCost)}</span>
            <span>API 调用: {usage.totals.calls.toLocaleString()} 次</span>
          </div>
        )}
      </div>

      {/* Model usage distribution */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-text-primary mb-4">模型用量分布</h3>
        {loading ? (
          <Skeleton className="h-[200px] w-full" />
        ) : modelData.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={modelData} layout="vertical" margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={{ stroke: '#e2e8f0' }} tickFormatter={(v: number) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)} />
              <YAxis type="category" dataKey="model" tick={{ fontSize: 11, fill: '#94a3b8' }} width={120} axisLine={{ stroke: '#e2e8f0' }} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="tokens" name="Tokens" fill="#818cf8" radius={[0, 4, 4, 0]} barSize={18} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[200px] flex items-center justify-center text-text-muted text-sm">暂无模型数据</div>
        )}
      </div>

      {/* Bottom split: Recent sessions + Agents */}
      <div className="grid grid-cols-2 gap-6">
        {/* Recent sessions */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-3">最近会话</h3>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : recentSessions.length > 0 ? (
            <div className="space-y-1">
              {recentSessions.map(s => (
                <div key={s.key} className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-surface-hover transition-colors">
                  <span className="text-base flex-shrink-0">{channelIcon(s.channel ?? s.lastChannel ?? '')}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-text-primary truncate font-medium">
                        {s.derivedTitle || s.label || s.displayName || s.key}
                      </p>
                      {s.kind && s.kind !== 'unknown' && (
                        <span className={`badge text-[10px] ${
                          s.kind === 'direct' ? 'badge-blue' : s.kind === 'group' ? 'badge-purple' : 'badge-cyan'
                        }`}>
                          {s.kind}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-text-muted truncate">
                      {s.lastMessagePreview || '暂无消息'}
                    </p>
                  </div>
                  <div className="flex flex-col items-end flex-shrink-0 gap-1">
                    <span className="text-[10px] text-text-muted">{relativeTime(s.updatedAt)}</span>
                    {(s.totalTokens != null && s.totalTokens > 0) && (
                      <span className="text-[10px] text-text-secondary">
                        {s.totalTokens.toLocaleString()} tk
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-text-muted text-sm">暂无会话</div>
          )}
        </div>

        {/* Agent list */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-3">智能体列表</h3>
          {loading ? (
            <div className="grid grid-cols-2 gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : agents.length > 0 ? (
            <div className="grid grid-cols-2 gap-2">
              {agents.map(a => (
                <div key={a.id} className="flex items-center gap-3 p-3 rounded-xl border border-surface-border hover:bg-surface-hover transition-colors">
                  <span className="text-xl flex-shrink-0">{a.identity?.emoji || '🤖'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text-primary font-medium truncate">{a.name || a.id}</p>
                    <p className="text-[11px] text-text-muted truncate">{a.id}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-text-muted text-sm">暂无智能体</div>
          )}
        </div>
      </div>
    </div>
  )
}
