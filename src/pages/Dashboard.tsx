import { useCallback, useEffect, useMemo, useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { useNavigate } from 'react-router-dom'
import type { ActiveTaskPanelAction } from '../components/ActiveTasksPanel'
import ActiveTasksPanel from '../components/ActiveTasksPanel'
import OrchestratorHealthStrip from '../components/OrchestratorHealthStrip'
import QuickStartBanner from '../components/QuickStartBanner'
import { importExperiencePreset } from '../lib/orchestration'
import { loadOrchestrationRuntime, performTaskIntervention, subscribeToOrchestrationEvents } from '../lib/orchestration-runtime'
import type { TrackedTask } from '../lib/task-tracker'

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
  for (const [iconKey, icon] of Object.entries(CHANNEL_ICONS)) {
    if (key.includes(iconKey)) return icon
  }
  return '📡'
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-surface-hover rounded ${className}`} />
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [runtime, setRuntime] = useState<Awaited<ReturnType<typeof loadOrchestrationRuntime>> | null>(null)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [actionBusyKey, setActionBusyKey] = useState<string | null>(null)
  const [importingPreset, setImportingPreset] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    setError(null)
    try {
      const nextRuntime = await loadOrchestrationRuntime()
      setRuntime(nextRuntime)
      setSelectedTaskId((current) => nextRuntime.tasks.some((task) => task.id === current) ? current : nextRuntime.tasks[0]?.id ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : '数据加载失败')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => subscribeToOrchestrationEvents(() => {
    void loadData(true)
  }), [loadData])

  const handleQuickImport = useCallback(async () => {
    let shouldReset = true
    setImportingPreset(true)
    try {
      await importExperiencePreset('opc-super-assistant')
      await loadData()
      shouldReset = false
      setImportingPreset(false)
      navigate('/orchestration')
    } catch (err) {
      setError(err instanceof Error ? err.message : '导入 OPC 模板失败')
    } finally {
      if (shouldReset) {
        setImportingPreset(false)
      }
    }
  }, [loadData, navigate])

  const handleTaskAction = useCallback(async (action: ActiveTaskPanelAction, task: TrackedTask, approvalId?: string) => {
    const busyKey = `${task.id}:${action}`
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
      }
      await loadData(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : '任务操作失败')
    } finally {
      setActionBusyKey(null)
    }
  }, [loadData])

  const connectedAccounts = useMemo(() => {
    if (!runtime?.channels) return 0
    let count = 0
    for (const accounts of Object.values(runtime.channels.channelAccounts)) {
      for (const acc of accounts) {
        if (acc.connected) count += 1
      }
    }
    return count
  }, [runtime?.channels])

  const totalChannels = useMemo(() => runtime?.channels.channelOrder.length ?? 0, [runtime?.channels])

  const dailyData = useMemo(() => {
    if (!runtime?.usage.aggregates?.daily) return []
    return runtime.usage.aggregates.daily.map((entry) => ({
      date: entry.date.slice(5),
      tokens: entry.tokens,
      cost: entry.cost,
      messages: entry.messages,
    }))
  }, [runtime?.usage])

  const modelData = useMemo(() => {
    if (!runtime?.usage.aggregates?.byModel) return []
    return [...runtime.usage.aggregates.byModel]
      .sort((a, b) => b.totals.totalTokens - a.totals.totalTokens)
      .slice(0, 8)
      .map((entry) => ({
        model: entry.model.length > 20 ? `${entry.model.slice(0, 18)}…` : entry.model,
        tokens: entry.totals.totalTokens,
        cost: entry.totals.totalCost,
        calls: entry.count,
      }))
  }, [runtime?.usage])

  const recentSessions = useMemo(() => {
    return runtime?.sessions
      ? [...runtime.sessions].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0)).slice(0, 8)
      : []
  }, [runtime?.sessions])

  const statCards = [
    {
      label: '活跃任务',
      value: runtime?.taskSummary.active ?? 0,
      sub: runtime ? `等待 ${runtime.taskSummary.waiting} 个` : undefined,
      icon: '🧠',
      color: 'text-accent-blue',
      bg: 'bg-pastel-blue/20',
    },
    {
      label: '待审批',
      value: runtime?.taskSummary.pendingApprovals ?? 0,
      sub: runtime ? `停滞 ${runtime.taskSummary.stalled} 个` : undefined,
      icon: '🔒',
      color: 'text-accent-yellow',
      bg: 'bg-pastel-yellow/20',
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
      value: runtime ? formatCost(runtime.usage.totals.totalCost) : '-',
      sub: runtime ? `${runtime.usage.totals.totalTokens.toLocaleString()} tokens` : undefined,
      icon: '💰',
      color: 'text-accent-cyan',
      bg: 'bg-pastel-cyan/20',
    },
  ]

  if (error && !loading && !runtime) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-3">
          <div className="text-4xl">⚠️</div>
          <p className="text-text-secondary">{error}</p>
          <button onClick={() => void loadData()} className="btn-secondary text-sm">
            重新加载
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {!loading && runtime?.experience === null && (
        <QuickStartBanner
          title="还没有激活团队编排？直接导入 OPC 超级助理"
          description="一键拉起策略、产品、研发、内容、运维与复盘角色，并同步生成真实可观测的任务、审批与编排控制面。"
          busy={importingPreset}
          onPreview={() => navigate('/orchestration')}
          onImport={handleQuickImport}
        />
      )}

      <div className="grid grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <div key={stat.label} className="stat-card">
            <div className="flex items-center justify-between">
              <span className="stat-label">{stat.label}</span>
              <span className={`w-8 h-8 rounded-lg ${stat.bg} flex items-center justify-center text-sm`}>
                {stat.icon}
              </span>
            </div>
            {loading ? (
              <Skeleton className="h-8 w-20 mt-1" />
            ) : (
              <span className={`stat-value ${stat.color}`}>{stat.value}</span>
            )}
            {stat.sub && <span className="text-[11px] text-text-secondary">{stat.sub}</span>}
          </div>
        ))}
      </div>

      <OrchestratorHealthStrip experience={runtime?.experience ?? null} health={runtime?.health ?? null} taskSummary={runtime?.taskSummary ?? null} />

      <ActiveTasksPanel
        title="运行中任务"
        subtitle={runtime?.activeExperiencePreset ? `当前控制面正在观测 ${runtime.activeExperiencePreset.summary.name}` : '当前尚未激活企业编排模板'}
        tasks={runtime?.tasks ?? []}
        selectedTaskId={selectedTaskId}
        onSelectTask={(task) => setSelectedTaskId(task.id)}
        onAction={handleTaskAction}
        busyKey={actionBusyKey}
        maxItems={4}
      />

      {error && (
        <div className="rounded-2xl border border-accent-red/30 bg-pastel-red/20 px-4 py-3 text-sm text-accent-red">
          {error}
        </div>
      )}

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
              <YAxis yAxisId="cost" orientation="right" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={{ stroke: '#e2e8f0' }} tickFormatter={(value: number) => `$${value}`} />
              <Tooltip content={<ChartTooltip />} />
              <Area yAxisId="tokens" type="monotone" dataKey="tokens" name="Tokens" stroke="#3b82f6" fill="url(#gradTokens)" strokeWidth={2} />
              <Area yAxisId="cost" type="monotone" dataKey="cost" name="费用 ($)" stroke="#22c55e" fill="url(#gradCost)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[240px] flex items-center justify-center text-text-muted text-sm">暂无用量数据</div>
        )}
        {runtime && !loading && (
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-surface-border text-xs text-text-secondary">
            <span>总消耗: {runtime.usage.totals.totalTokens.toLocaleString()} tokens</span>
            <span>总费用: {formatCost(runtime.usage.totals.totalCost)}</span>
            <span>API 调用: {runtime.usage.totals.calls.toLocaleString()} 次</span>
          </div>
        )}
      </div>

      <div className="card p-5">
        <h3 className="text-sm font-semibold text-text-primary mb-4">模型用量分布</h3>
        {loading ? (
          <Skeleton className="h-[200px] w-full" />
        ) : modelData.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={modelData} layout="vertical" margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={{ stroke: '#e2e8f0' }} tickFormatter={(value: number) => value >= 1000000 ? `${(value / 1000000).toFixed(1)}M` : value >= 1000 ? `${(value / 1000).toFixed(0)}K` : String(value)} />
              <YAxis type="category" dataKey="model" tick={{ fontSize: 11, fill: '#94a3b8' }} width={120} axisLine={{ stroke: '#e2e8f0' }} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="tokens" name="Tokens" fill="#818cf8" radius={[0, 4, 4, 0]} barSize={18} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[200px] flex items-center justify-center text-text-muted text-sm">暂无模型数据</div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-3">最近会话</h3>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-12 w-full" />
              ))}
            </div>
          ) : recentSessions.length > 0 ? (
            <div className="space-y-1">
              {recentSessions.map((session) => (
                <div key={session.key} className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-surface-hover transition-colors">
                  <span className="text-base flex-shrink-0">{channelIcon(session.channel ?? session.lastChannel ?? '')}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-text-primary truncate font-medium">
                        {session.derivedTitle || session.label || session.displayName || session.key}
                      </p>
                      {session.kind && session.kind !== 'unknown' && (
                        <span className={`badge text-[10px] ${
                          session.kind === 'direct' ? 'badge-blue' : session.kind === 'group' ? 'badge-purple' : 'badge-cyan'
                        }`}>
                          {session.kind}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-text-muted truncate">
                      {session.lastMessagePreview || '暂无消息'}
                    </p>
                  </div>
                  <div className="flex flex-col items-end flex-shrink-0 gap-1">
                    <span className="text-[10px] text-text-muted">{relativeTime(session.updatedAt)}</span>
                    {(session.totalTokens != null && session.totalTokens > 0) && (
                      <span className="text-[10px] text-text-secondary">
                        {session.totalTokens.toLocaleString()} tk
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

        <div className="card p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-3">智能体列表</h3>
          {loading ? (
            <div className="grid grid-cols-2 gap-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-16 w-full" />
              ))}
            </div>
          ) : runtime?.agents.length ? (
            <div className="grid grid-cols-2 gap-2">
              {runtime.agents.map((agent) => (
                <div key={agent.id} className="flex items-center gap-3 p-3 rounded-xl border border-surface-border hover:bg-surface-hover transition-colors">
                  <span className="text-xl flex-shrink-0">{agent.identity?.emoji || '🤖'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text-primary font-medium truncate">{agent.name || agent.id}</p>
                    <p className="text-[11px] text-text-muted truncate">{agent.id}</p>
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
