import { useState, useEffect, useMemo } from 'react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { getAPI } from '../lib/api'
import type { SessionsUsageResult, DailyUsage, SessionsUsageParams } from '../types/openclaw'

const CHART_COLORS = ['#6366f1', '#06b6d4', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#ec4899']

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function formatCost(n: number): string {
  if (n >= 1) return `$${n.toFixed(2)}`
  return `$${n.toFixed(4)}`
}

export default function Usage() {
  const [data, setData] = useState<SessionsUsageResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const fetchUsage = async () => {
    setLoading(true)
    try {
      const params: SessionsUsageParams = {}
      if (startDate) params.startDate = startDate
      if (endDate) params.endDate = endDate
      const result = await getAPI().getSessionsUsage(params)
      setData(result)
    } catch (err) {
      console.error('Failed to fetch usage:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchUsage() }, [startDate, endDate])

  const errorRate = useMemo(() => {
    if (!data) return '0%'
    const { calls, errors } = data.totals
    if (calls === 0) return '0%'
    return `${((errors / calls) * 100).toFixed(1)}%`
  }, [data])

  // Sort sessions by cost descending
  const topSessions = useMemo(() => {
    if (!data) return []
    return [...data.sessions]
      .filter((s) => s.usage?.totals.totalCost)
      .sort((a, b) => (b.usage?.totals.totalCost ?? 0) - (a.usage?.totals.totalCost ?? 0))
      .slice(0, 20)
  }, [data])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-text-secondary text-sm">
        加载中...
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64 text-text-secondary text-sm">
        无法加载用量数据
      </div>
    )
  }

  const { totals, aggregates } = data

  return (
    <div className="space-y-6">
      {/* Date range selector */}
      <div className="flex items-center gap-4">
        <h3 className="text-sm font-semibold text-text-primary">用量分析</h3>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-secondary">日期范围：</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="bg-surface-bg border border-surface-border rounded-lg px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-accent-blue"
          />
          <span className="text-xs text-text-muted">至</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="bg-surface-bg border border-surface-border rounded-lg px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-accent-blue"
          />
        </div>
      </div>

      {/* Top stat cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="stat-card">
          <p className="stat-label">总费用</p>
          <p className="stat-value gradient-text">{formatCost(totals.totalCost)}</p>
          <p className="text-[10px] text-text-muted">{data.startDate} — {data.endDate}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">总 Token</p>
          <p className="stat-value">{formatTokens(totals.totalTokens)}</p>
          <p className="text-[10px] text-text-muted">输入 {formatTokens(totals.inputTokens)} / 输出 {formatTokens(totals.outputTokens)}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">总消息</p>
          <p className="stat-value">{aggregates.messages.total}</p>
          <p className="text-[10px] text-text-muted">入 {aggregates.messages.inbound} / 出 {aggregates.messages.outbound}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">错误率</p>
          <p className="stat-value">{errorRate}</p>
          <p className="text-[10px] text-text-muted">{totals.errors} 错误 / {totals.calls} 调用</p>
        </div>
      </div>

      {/* Daily trend chart */}
      <div className="card p-5">
        <h4 className="text-sm font-semibold text-text-primary mb-4">每日趋势（14天）</h4>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={aggregates.daily} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="colorTokens" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={(v: string) => v.slice(5)} />
              <YAxis yAxisId="tokens" tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={formatTokens} />
              <YAxis yAxisId="cost" orientation="right" tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={(v: number) => `$${v.toFixed(2)}`} />
              <Tooltip
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, fontSize: 12 }}
                formatter={(value: number, name: string) => {
                  if (name === 'tokens') return [formatTokens(value), 'Token']
                  if (name === 'cost') return [formatCost(value), '费用']
                  return [value, name]
                }}
              />
              <Legend />
              <Area yAxisId="tokens" type="monotone" dataKey="tokens" name="tokens" stroke="#6366f1" fill="url(#colorTokens)" strokeWidth={2} />
              <Area yAxisId="cost" type="monotone" dataKey="cost" name="cost" stroke="#06b6d4" fill="url(#colorCost)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* By-model and by-provider row */}
      <div className="grid grid-cols-3 gap-4">
        {/* By-model bar chart */}
        <div className="col-span-2 card p-5">
          <h4 className="text-sm font-semibold text-text-primary mb-4">按模型分布</h4>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={aggregates.byModel} layout="vertical" margin={{ top: 5, right: 20, left: 80, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={formatTokens} />
                <YAxis type="category" dataKey="model" tick={{ fontSize: 11, fill: '#64748b' }} width={100} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, fontSize: 12 }}
                  formatter={(value: number, name: string) => {
                    if (name === 'Token') return [formatTokens(value), 'Token']
                    return [formatCost(value), '费用']
                  }}
                />
                <Bar dataKey="totals.totalTokens" name="Token" fill="#6366f1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* By-provider pie */}
        <div className="card p-5">
          <h4 className="text-sm font-semibold text-text-primary mb-4">按提供商</h4>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={aggregates.byProvider.map((p) => ({ name: p.provider, value: p.totals.totalTokens }))}
                  cx="50%" cy="50%"
                  innerRadius={45} outerRadius={75}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, percent }: { name: string; percent: number }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {aggregates.byProvider.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, fontSize: 12 }}
                  formatter={(value: number) => formatTokens(value)}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* By-agent breakdown table */}
      <div className="card p-5">
        <h4 className="text-sm font-semibold text-text-primary mb-4">按智能体分布</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-surface-border">
                <th className="text-left py-2 px-3 text-text-secondary font-normal">智能体</th>
                <th className="text-right py-2 px-3 text-text-secondary font-normal">总 Token</th>
                <th className="text-right py-2 px-3 text-text-secondary font-normal">输入</th>
                <th className="text-right py-2 px-3 text-text-secondary font-normal">输出</th>
                <th className="text-right py-2 px-3 text-text-secondary font-normal">费用</th>
                <th className="text-right py-2 px-3 text-text-secondary font-normal">调用</th>
              </tr>
            </thead>
            <tbody>
              {aggregates.byAgent.map((row) => (
                <tr key={row.agentId} className="border-b border-surface-border/30 hover:bg-surface-hover">
                  <td className="py-2 px-3 text-text-primary font-medium">{row.agentId}</td>
                  <td className="py-2 px-3 text-right text-text-primary">{formatTokens(row.totals.totalTokens)}</td>
                  <td className="py-2 px-3 text-right text-text-secondary">{formatTokens(row.totals.inputTokens)}</td>
                  <td className="py-2 px-3 text-right text-text-secondary">{formatTokens(row.totals.outputTokens)}</td>
                  <td className="py-2 px-3 text-right text-accent-purple font-medium">{formatCost(row.totals.totalCost)}</td>
                  <td className="py-2 px-3 text-right text-text-secondary">{row.totals.calls}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* By-channel breakdown table */}
      <div className="card p-5">
        <h4 className="text-sm font-semibold text-text-primary mb-4">按通道分布</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-surface-border">
                <th className="text-left py-2 px-3 text-text-secondary font-normal">通道</th>
                <th className="text-right py-2 px-3 text-text-secondary font-normal">总 Token</th>
                <th className="text-right py-2 px-3 text-text-secondary font-normal">费用</th>
                <th className="text-right py-2 px-3 text-text-secondary font-normal">调用</th>
              </tr>
            </thead>
            <tbody>
              {aggregates.byChannel.map((row) => (
                <tr key={row.channel} className="border-b border-surface-border/30 hover:bg-surface-hover">
                  <td className="py-2 px-3 text-text-primary font-medium">{row.channel}</td>
                  <td className="py-2 px-3 text-right text-text-primary">{formatTokens(row.totals.totalTokens)}</td>
                  <td className="py-2 px-3 text-right text-accent-purple font-medium">{formatCost(row.totals.totalCost)}</td>
                  <td className="py-2 px-3 text-right text-text-secondary">{row.totals.calls}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Session-level usage table */}
      <div className="card p-5">
        <h4 className="text-sm font-semibold text-text-primary mb-4">会话用量 Top 20</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-surface-border">
                <th className="text-left py-2 px-3 text-text-secondary font-normal">会话</th>
                <th className="text-left py-2 px-3 text-text-secondary font-normal">智能体</th>
                <th className="text-left py-2 px-3 text-text-secondary font-normal">通道</th>
                <th className="text-right py-2 px-3 text-text-secondary font-normal">总 Token</th>
                <th className="text-right py-2 px-3 text-text-secondary font-normal">费用</th>
                <th className="text-right py-2 px-3 text-text-secondary font-normal">调用</th>
              </tr>
            </thead>
            <tbody>
              {topSessions.map((s) => (
                <tr key={s.key} className="border-b border-surface-border/30 hover:bg-surface-hover">
                  <td className="py-2 px-3 text-text-primary">
                    <span className="font-medium">{s.label || s.key}</span>
                    {s.label && <span className="ml-2 text-text-muted font-mono text-[10px]">{s.key}</span>}
                  </td>
                  <td className="py-2 px-3 text-text-secondary">{s.agentId || '—'}</td>
                  <td className="py-2 px-3 text-text-secondary">{s.channel || '—'}</td>
                  <td className="py-2 px-3 text-right text-text-primary">{formatTokens(s.usage?.totals.totalTokens ?? 0)}</td>
                  <td className="py-2 px-3 text-right text-accent-purple font-medium">{formatCost(s.usage?.totals.totalCost ?? 0)}</td>
                  <td className="py-2 px-3 text-right text-text-secondary">{s.usage?.totals.calls ?? 0}</td>
                </tr>
              ))}
              {topSessions.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-text-secondary">暂无会话用量数据</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
