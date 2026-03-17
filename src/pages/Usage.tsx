import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { getAPI } from '../lib/api'
import { loadConfig } from '../lib/config'
import {
  buildUsageCostSummary,
  getInputTokens,
  getMessageInbound,
  getMessageOutbound,
  getOutputTokens,
  getSessionUsageTotals,
  getUsageCalls,
  getUsageErrors,
} from '../lib/usage'
import type {
  SessionUsageEntry,
  SessionsUsageParams,
  SessionsUsageResult,
  UsageCostParams,
  UsageCostSummary,
} from '../types/openclaw'

const CHART_COLORS = ['#6366f1', '#06b6d4', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#ec4899']
const SESSION_FETCH_LIMIT = 1000
const MAX_MODEL_ROWS = 12
const MAX_PROVIDER_ROWS = 6
const MAX_AGENT_ROWS = 20
const MAX_CHANNEL_ROWS = 12
const MAX_SESSION_ROWS = 20
const LEGACY_USAGE_DATE_PARAMS_STORAGE_KEY = 'claw-ops.usage.date-params.v1'
const LEGACY_USAGE_DATE_PARAMS_DEFAULT_GATEWAY_KEY = '__default__'
const LEGACY_USAGE_DATE_PARAMS_MODE_RE = /unexpected property ['"]mode['"]/i
const LEGACY_USAGE_DATE_PARAMS_OFFSET_RE = /unexpected property ['"]utcoffset['"]/i
const LEGACY_USAGE_DATE_PARAMS_INVALID_RE = /invalid (?:sessions\.usage|usage\.cost) params/i

let legacyUsageDateParamsCache: Set<string> | null = null

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function formatCost(n: number): string {
  if (n >= 1) return `$${n.toFixed(2)}`
  return `$${n.toFixed(4)}`
}

function getLocalStorage(): Storage | null {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage
  }
  if (typeof localStorage !== 'undefined') {
    return localStorage
  }
  return null
}

function loadLegacyUsageDateParamsCache(): Set<string> {
  const storage = getLocalStorage()
  if (!storage) return new Set<string>()
  try {
    const raw = storage.getItem(LEGACY_USAGE_DATE_PARAMS_STORAGE_KEY)
    if (!raw) return new Set<string>()
    const parsed = JSON.parse(raw) as { unsupportedGatewayKeys?: unknown } | null
    if (!parsed || !Array.isArray(parsed.unsupportedGatewayKeys)) {
      return new Set<string>()
    }
    return new Set(
      parsed.unsupportedGatewayKeys
        .filter((entry): entry is string => typeof entry === 'string')
        .map((entry) => entry.trim())
        .filter(Boolean),
    )
  } catch {
    return new Set<string>()
  }
}

function persistLegacyUsageDateParamsCache(cache: Set<string>) {
  const storage = getLocalStorage()
  if (!storage) return
  try {
    storage.setItem(
      LEGACY_USAGE_DATE_PARAMS_STORAGE_KEY,
      JSON.stringify({ unsupportedGatewayKeys: Array.from(cache) }),
    )
  } catch {
    // Ignore storage quota / private mode failures.
  }
}

function getLegacyUsageDateParamsCache(): Set<string> {
  if (!legacyUsageDateParamsCache) {
    legacyUsageDateParamsCache = loadLegacyUsageDateParamsCache()
  }
  return legacyUsageDateParamsCache
}

function normalizeGatewayCompatibilityKey(gatewayUrl?: string): string {
  const trimmed = gatewayUrl?.trim()
  if (!trimmed) return LEGACY_USAGE_DATE_PARAMS_DEFAULT_GATEWAY_KEY
  try {
    const parsed = new URL(trimmed)
    const pathname = parsed.pathname === '/' ? '' : parsed.pathname
    return `${parsed.protocol}//${parsed.host}${pathname}`.toLowerCase()
  } catch {
    return trimmed.toLowerCase()
  }
}

function shouldSendLegacyDateInterpretation(): boolean {
  const gatewayUrl = loadConfig().gatewayUrl
  return !getLegacyUsageDateParamsCache().has(normalizeGatewayCompatibilityKey(gatewayUrl))
}

function rememberLegacyDateInterpretation() {
  const cache = getLegacyUsageDateParamsCache()
  cache.add(normalizeGatewayCompatibilityKey(loadConfig().gatewayUrl))
  persistLegacyUsageDateParamsCache(cache)
}

function formatUtcOffset(timezoneOffsetMinutes: number): string {
  const offsetFromUtcMinutes = -timezoneOffsetMinutes
  const sign = offsetFromUtcMinutes >= 0 ? '+' : '-'
  const absMinutes = Math.abs(offsetFromUtcMinutes)
  const hours = Math.floor(absMinutes / 60)
  const minutes = absMinutes % 60
  return minutes === 0
    ? `UTC${sign}${hours}`
    : `UTC${sign}${hours}:${minutes.toString().padStart(2, '0')}`
}

function buildDateInterpretationParams(): Pick<SessionsUsageParams, 'mode' | 'utcOffset'> {
  return {
    mode: 'specific',
    utcOffset: formatUtcOffset(new Date().getTimezoneOffset()),
  }
}

function isLegacyDateInterpretationUnsupportedError(err: unknown): boolean {
  const message = toErrorMessage(err)
  return LEGACY_USAGE_DATE_PARAMS_INVALID_RE.test(message)
    && (LEGACY_USAGE_DATE_PARAMS_MODE_RE.test(message) || LEGACY_USAGE_DATE_PARAMS_OFFSET_RE.test(message))
}

function toErrorMessage(err: unknown): string {
  if (typeof err === 'string') return err
  if (err instanceof Error && err.message.trim()) return err.message
  if (err && typeof err === 'object') {
    try {
      const serialized = JSON.stringify(err)
      if (serialized) return serialized
    } catch {
      // ignore
    }
  }
  return '请求失败'
}

function providerLabel(provider?: string | null): string {
  return provider?.trim() || 'unknown'
}

function modelLabel(model?: string | null, provider?: string | null): string {
  if (model?.trim()) return model
  if (provider?.trim()) return `${provider}:default`
  return 'unknown'
}

function sessionMessageCount(entry: SessionUsageEntry): number {
  const totals = getSessionUsageTotals(entry.usage)
  return getUsageCalls(totals, entry.usage?.messageCounts)
}

function sessionErrorCount(entry: SessionUsageEntry): number {
  const totals = getSessionUsageTotals(entry.usage)
  return getUsageErrors(totals, entry.usage?.messageCounts)
}

export default function Usage() {
  const [data, setData] = useState<SessionsUsageResult | null>(null)
  const [costSummary, setCostSummary] = useState<UsageCostSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const fetchUsage = useCallback(async () => {
    setLoading(true)
    setError(null)

    const api = getAPI()
    const sessionsParams: SessionsUsageParams = {
      limit: SESSION_FETCH_LIMIT,
    }
    const costParams: UsageCostParams = {}

    if (startDate) {
      sessionsParams.startDate = startDate
      costParams.startDate = startDate
    }
    if (endDate) {
      sessionsParams.endDate = endDate
      costParams.endDate = endDate
    }

    const runUsageRequests = async (includeDateInterpretation: boolean) => {
      const dateInterpretation = includeDateInterpretation ? buildDateInterpretationParams() : {}
      const [sessionsRes, costRes] = await Promise.allSettled([
        api.getSessionsUsage({
          ...sessionsParams,
          ...dateInterpretation,
        }),
        api.getUsageCost({
          ...costParams,
          ...dateInterpretation,
        }),
      ])

      if (sessionsRes.status === 'rejected') {
        throw sessionsRes.reason
      }
      if (costRes.status === 'rejected' && isLegacyDateInterpretationUnsupportedError(costRes.reason)) {
        throw costRes.reason
      }

      return {
        sessions: sessionsRes.value,
        cost: costRes.status === 'fulfilled'
          ? costRes.value
          : buildUsageCostSummary(sessionsRes.value),
      }
    }

    try {
      const includeDateInterpretation = shouldSendLegacyDateInterpretation()
      try {
        const result = await runUsageRequests(includeDateInterpretation)
        setData(result.sessions)
        setCostSummary(result.cost)
      } catch (err) {
        if (includeDateInterpretation && isLegacyDateInterpretationUnsupportedError(err)) {
          rememberLegacyDateInterpretation()
          const result = await runUsageRequests(false)
          setData(result.sessions)
          setCostSummary(result.cost)
        } else {
          throw err
        }
      }
    } catch (err) {
      setError(toErrorMessage(err))
      setData(null)
      setCostSummary(null)
    } finally {
      setLoading(false)
    }
  }, [endDate, startDate])

  useEffect(() => {
    void fetchUsage()
  }, [fetchUsage])

  const summary = costSummary ?? (data ? buildUsageCostSummary(data) : null)
  const totals = summary?.totals ?? data?.totals ?? null
  const messages = data?.aggregates.messages
  const totalMessages = messages?.total ?? 0
  const inboundMessages = getMessageInbound(messages)
  const outboundMessages = getMessageOutbound(messages)
  const totalErrors = messages?.errors ?? 0
  const errorRate = totalMessages > 0 ? `${((totalErrors / totalMessages) * 100).toFixed(1)}%` : '0%'

  const trendData = useMemo(() => {
    if (summary?.daily.length) {
      return summary.daily.map((entry) => ({
        date: entry.date,
        tokens: entry.totalTokens,
        cost: entry.totalCost,
      }))
    }

    return (data?.aggregates.daily ?? []).map((entry) => ({
      date: entry.date,
      tokens: entry.tokens,
      cost: entry.cost,
    }))
  }, [data?.aggregates.daily, summary?.daily])

  const topModels = useMemo(() => {
    if (!data) return []
    return [...data.aggregates.byModel]
      .sort((a, b) => b.totals.totalTokens - a.totals.totalTokens)
      .slice(0, MAX_MODEL_ROWS)
      .map((entry) => ({
        model: modelLabel(entry.model, entry.provider).length > 26
          ? `${modelLabel(entry.model, entry.provider).slice(0, 24)}…`
          : modelLabel(entry.model, entry.provider),
        tokens: entry.totals.totalTokens,
        cost: entry.totals.totalCost,
        count: entry.count,
      }))
  }, [data])

  const providerData = useMemo(() => {
    if (!data) return []
    const sorted = [...data.aggregates.byProvider].sort((a, b) => b.totals.totalTokens - a.totals.totalTokens)
    const visible = sorted.slice(0, MAX_PROVIDER_ROWS)
    const hidden = sorted.slice(MAX_PROVIDER_ROWS)
    const rows = visible.map((entry) => ({
      provider: providerLabel(entry.provider),
      tokens: entry.totals.totalTokens,
      cost: entry.totals.totalCost,
      count: entry.count,
    }))

    if (hidden.length === 0) return rows

    const collapsed = hidden.reduce((acc, entry) => {
      acc.tokens += entry.totals.totalTokens
      acc.cost += entry.totals.totalCost
      acc.count += entry.count
      return acc
    }, { provider: '其他', tokens: 0, cost: 0, count: 0 })

    return [...rows, collapsed]
  }, [data])

  const topAgents = useMemo(() => {
    if (!data) return []
    return [...data.aggregates.byAgent]
      .sort((a, b) => b.totals.totalCost - a.totals.totalCost)
      .slice(0, MAX_AGENT_ROWS)
  }, [data])

  const topChannels = useMemo(() => {
    if (!data) return []
    return [...data.aggregates.byChannel]
      .sort((a, b) => b.totals.totalCost - a.totals.totalCost)
      .slice(0, MAX_CHANNEL_ROWS)
  }, [data])

  const topSessions = useMemo(() => {
    if (!data) return []
    const hasCostRanking = data.sessions.some((entry) => (getSessionUsageTotals(entry.usage)?.totalCost ?? 0) > 0)
    return [...data.sessions]
      .filter((entry) => {
        const totals = getSessionUsageTotals(entry.usage)
        return hasCostRanking
          ? ((totals?.totalCost ?? 0) > 0 || (totals?.totalTokens ?? 0) > 0)
          : (totals?.totalTokens ?? 0) > 0
      })
      .sort((a, b) => {
        const left = getSessionUsageTotals(a.usage)
        const right = getSessionUsageTotals(b.usage)
        if (hasCostRanking) {
          const costDiff = (right?.totalCost ?? 0) - (left?.totalCost ?? 0)
          if (costDiff !== 0) return costDiff
        }
        return (right?.totalTokens ?? 0) - (left?.totalTokens ?? 0)
      })
      .slice(0, MAX_SESSION_ROWS)
  }, [data])

  const visualCapNotes = useMemo(() => {
    if (!data) return []
    const notes: string[] = []
    if (data.aggregates.byModel.length > MAX_MODEL_ROWS) notes.push(`模型图表仅展示前 ${MAX_MODEL_ROWS} 个`)
    if (data.aggregates.byProvider.length > MAX_PROVIDER_ROWS) notes.push(`提供商图表合并展示尾部数据`)
    if (data.aggregates.byAgent.length > MAX_AGENT_ROWS) notes.push(`智能体表仅展示前 ${MAX_AGENT_ROWS} 个`)
    if (data.aggregates.byChannel.length > MAX_CHANNEL_ROWS) notes.push(`通道表仅展示前 ${MAX_CHANNEL_ROWS} 个`)
    if (data.sessions.length >= SESSION_FETCH_LIMIT) notes.push(`会话样本已按 ${SESSION_FETCH_LIMIT} 条上限拉取`)
    return notes
  }, [data])

  const providerTotals = useMemo(() => {
    return providerData.reduce((acc, entry) => {
      acc.tokens += entry.tokens
      acc.cost += entry.cost
      return acc
    }, { tokens: 0, cost: 0 })
  }, [providerData])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-text-secondary text-sm">
        加载中...
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="flex items-center justify-center min-h-[320px]">
        <div className="text-center space-y-3">
          <div className="text-4xl">⚠️</div>
          <p className="text-sm text-text-secondary">{error}</p>
          <button type="button" onClick={() => void fetchUsage()} className="btn-secondary text-sm">
            重新加载
          </button>
        </div>
      </div>
    )
  }

  if (!data || !totals) {
    return (
      <div className="flex items-center justify-center h-64 text-text-secondary text-sm">
        无法加载用量数据
      </div>
    )
  }

  const aggregateToolCalls = data.aggregates.tools.totalCalls ?? data.aggregates.tools.calls ?? 0
  const aggregateToolKinds = data.aggregates.tools.uniqueTools ?? data.aggregates.tools.tools.length
  const inputTokens = getInputTokens(totals)
  const outputTokens = getOutputTokens(totals)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">用量分析</h3>
          <p className="text-[11px] text-text-secondary mt-1">
            已对齐 OpenClaw 的 `sessions.usage` + `usage.cost` 双接口设计。
          </p>
        </div>
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
          <button type="button" onClick={() => void fetchUsage()} className="btn-ghost text-xs">
            刷新
          </button>
        </div>
      </div>

      {error && (
        <div className="card border border-accent-yellow/30 bg-pastel-yellow/10 p-4 text-xs text-accent-yellow">
          读取成本汇总时发生降级处理：{error}
        </div>
      )}

      {visualCapNotes.length > 0 && (
        <div className="card border border-surface-border p-4 text-xs text-text-secondary flex flex-wrap gap-2">
          {visualCapNotes.map((note) => (
            <span key={note} className="badge bg-surface-hover text-text-secondary">
              {note}
            </span>
          ))}
        </div>
      )}

      <div className="grid grid-cols-4 gap-4">
        <div className="stat-card">
          <p className="stat-label">总费用</p>
          <p className="stat-value gradient-text">{formatCost(totals.totalCost)}</p>
          <p className="text-[10px] text-text-muted">{data.startDate} — {data.endDate}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">总 Token</p>
          <p className="stat-value">{formatTokens(totals.totalTokens)}</p>
          <p className="text-[10px] text-text-muted">输入 {formatTokens(inputTokens)} / 输出 {formatTokens(outputTokens)}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">总消息</p>
          <p className="stat-value">{totalMessages.toLocaleString()}</p>
          <p className="text-[10px] text-text-muted">入 {inboundMessages.toLocaleString()} / 出 {outboundMessages.toLocaleString()}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">错误率</p>
          <p className="stat-value">{errorRate}</p>
          <p className="text-[10px] text-text-muted">{totalErrors.toLocaleString()} 错误 / {aggregateToolCalls.toLocaleString()} 工具调用</p>
        </div>
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-semibold text-text-primary">每日趋势</h4>
          <span className="text-[11px] text-text-secondary">
            工具调用 {aggregateToolCalls.toLocaleString()} · 工具种类 {aggregateToolKinds.toLocaleString()}
          </span>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
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
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={(value: string) => value.slice(5)} />
              <YAxis yAxisId="tokens" tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={formatTokens} />
              <YAxis yAxisId="cost" orientation="right" tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={(value: number) => `$${value.toFixed(2)}`} />
              <Tooltip
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, fontSize: 12 }}
                formatter={(value: number, name: string) => {
                  if (name === 'tokens') return [formatTokens(value), 'Token']
                  if (name === 'cost') return [formatCost(value), '费用']
                  return [value, name]
                }}
              />
              <Area yAxisId="tokens" type="monotone" dataKey="tokens" name="tokens" stroke="#6366f1" fill="url(#colorTokens)" strokeWidth={2} isAnimationActive={false} />
              <Area yAxisId="cost" type="monotone" dataKey="cost" name="cost" stroke="#06b6d4" fill="url(#colorCost)" strokeWidth={2} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 card p-5">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-semibold text-text-primary">按模型分布</h4>
            <span className="text-[11px] text-text-secondary">按 Token 排序，最多展示 {MAX_MODEL_ROWS} 个</span>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topModels} layout="vertical" margin={{ top: 5, right: 20, left: 100, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={formatTokens} />
                <YAxis type="category" dataKey="model" tick={{ fontSize: 11, fill: '#64748b' }} width={120} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, fontSize: 12 }}
                  formatter={(value: number) => [formatTokens(value), 'Token']}
                />
                <Bar dataKey="tokens" name="Token" fill="#6366f1" radius={[0, 4, 4, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-semibold text-text-primary">按提供商</h4>
            <span className="text-[11px] text-text-secondary">Top {MAX_PROVIDER_ROWS}</span>
          </div>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={providerData.map((entry) => ({ name: entry.provider, value: entry.tokens, cost: entry.cost }))}
                  cx="50%"
                  cy="50%"
                  innerRadius={42}
                  outerRadius={72}
                  paddingAngle={3}
                  dataKey="value"
                  isAnimationActive={false}
                >
                  {providerData.map((_, index) => (
                    <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, fontSize: 12 }}
                  formatter={(value: number, _name: string, item) => [`${formatTokens(value)} / ${formatCost(item.payload?.cost ?? 0)}`, item.payload?.name ?? '提供商']}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 space-y-2">
            {providerData.map((entry, index) => {
              const share = providerTotals.tokens > 0 ? ((entry.tokens / providerTotals.tokens) * 100).toFixed(0) : '0'
              return (
                <div key={entry.provider} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                    />
                    <span className="truncate text-text-primary">{entry.provider}</span>
                  </div>
                  <span className="text-text-secondary">{share}% · {formatTokens(entry.tokens)}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

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
              </tr>
            </thead>
            <tbody>
              {topAgents.map((row) => (
                <tr key={row.agentId} className="border-b border-surface-border/30 hover:bg-surface-hover">
                  <td className="py-2 px-3 text-text-primary font-medium">{row.agentId}</td>
                  <td className="py-2 px-3 text-right text-text-primary">{formatTokens(row.totals.totalTokens)}</td>
                  <td className="py-2 px-3 text-right text-text-secondary">{formatTokens(getInputTokens(row.totals))}</td>
                  <td className="py-2 px-3 text-right text-text-secondary">{formatTokens(getOutputTokens(row.totals))}</td>
                  <td className="py-2 px-3 text-right text-accent-purple font-medium">{formatCost(row.totals.totalCost)}</td>
                </tr>
              ))}
              {topAgents.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-text-secondary">暂无智能体用量数据</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card p-5">
        <h4 className="text-sm font-semibold text-text-primary mb-4">按通道分布</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-surface-border">
                <th className="text-left py-2 px-3 text-text-secondary font-normal">通道</th>
                <th className="text-right py-2 px-3 text-text-secondary font-normal">总 Token</th>
                <th className="text-right py-2 px-3 text-text-secondary font-normal">费用</th>
              </tr>
            </thead>
            <tbody>
              {topChannels.map((row) => (
                <tr key={row.channel} className="border-b border-surface-border/30 hover:bg-surface-hover">
                  <td className="py-2 px-3 text-text-primary font-medium">{row.channel}</td>
                  <td className="py-2 px-3 text-right text-text-primary">{formatTokens(row.totals.totalTokens)}</td>
                  <td className="py-2 px-3 text-right text-accent-purple font-medium">{formatCost(row.totals.totalCost)}</td>
                </tr>
              ))}
              {topChannels.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-8 text-center text-text-secondary">暂无通道用量数据</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-semibold text-text-primary">会话用量 Top {MAX_SESSION_ROWS}</h4>
          <span className="text-[11px] text-text-secondary">会话计数使用 session usage 明细；无定价时自动回退到 Token 排序</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-surface-border">
                <th className="text-left py-2 px-3 text-text-secondary font-normal">会话</th>
                <th className="text-left py-2 px-3 text-text-secondary font-normal">智能体</th>
                <th className="text-left py-2 px-3 text-text-secondary font-normal">通道</th>
                <th className="text-right py-2 px-3 text-text-secondary font-normal">总 Token</th>
                <th className="text-right py-2 px-3 text-text-secondary font-normal">费用</th>
                <th className="text-right py-2 px-3 text-text-secondary font-normal">消息</th>
                <th className="text-right py-2 px-3 text-text-secondary font-normal">错误</th>
              </tr>
            </thead>
            <tbody>
              {topSessions.map((entry) => {
                const sessionTotals = getSessionUsageTotals(entry.usage)
                return (
                  <tr key={entry.key} className="border-b border-surface-border/30 hover:bg-surface-hover">
                    <td className="py-2 px-3 text-text-primary">
                      <span className="font-medium">{entry.label || entry.key}</span>
                      {entry.label && <span className="ml-2 text-text-muted font-mono text-[10px]">{entry.key}</span>}
                    </td>
                    <td className="py-2 px-3 text-text-secondary">{entry.agentId || '—'}</td>
                    <td className="py-2 px-3 text-text-secondary">{entry.channel || '—'}</td>
                    <td className="py-2 px-3 text-right text-text-primary">{formatTokens(sessionTotals?.totalTokens ?? 0)}</td>
                    <td className="py-2 px-3 text-right text-accent-purple font-medium">{formatCost(sessionTotals?.totalCost ?? 0)}</td>
                    <td className="py-2 px-3 text-right text-text-secondary">{sessionMessageCount(entry)}</td>
                    <td className="py-2 px-3 text-right text-text-secondary">{sessionErrorCount(entry)}</td>
                  </tr>
                )
              })}
              {topSessions.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-text-secondary">暂无会话用量数据</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
