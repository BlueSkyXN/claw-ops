import type { ChannelsStatusResult, SessionsUsageResult } from '../types/openclaw'
import type { OrchestrationHealth } from '../lib/health-analyzer'
import type { TaskTrackerSummary } from '../lib/task-tracker'

function formatCost(value: number): string {
  if (value >= 1) return `$${value.toFixed(2)}`
  return `$${value.toFixed(4)}`
}

function formatTokens(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return String(value)
}

function formatMedianAge(value: number): string {
  const minutes = Math.max(0, Math.round(value / 60_000))
  if (minutes < 60) return `${minutes} 分钟`
  const hours = Math.floor(minutes / 60)
  const remain = minutes % 60
  return remain > 0 ? `${hours} 小时 ${remain} 分钟` : `${hours} 小时`
}

export default function OperationsMonitorBoard({
  taskSummary,
  health,
  usage,
  channels,
}: {
  taskSummary: TaskTrackerSummary | null
  health: OrchestrationHealth | null
  usage: SessionsUsageResult | null
  channels: ChannelsStatusResult | null
}) {
  const accounts = channels ? Object.values(channels.channelAccounts).flat() : []
  const connectedAccounts = accounts.filter((account) => account.connected).length
  const onlineChannels = channels
    ? channels.channelOrder.filter((channelId) => (channels.channelAccounts[channelId] ?? []).some((account) => account.connected)).length
    : 0
  const activeRuns = accounts.reduce((sum, account) => sum + (account.activeRuns ?? 0), 0)
  const latestDaily = usage?.aggregates.daily[usage.aggregates.daily.length - 1] ?? null
  const suggestions = health?.suggestions.slice(0, 2) ?? []
  const alerts = health?.alerts.slice(0, 3) ?? []

  return (
    <div className="card p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">运营监控板</h3>
          <p className="text-xs text-text-secondary mt-1">把审批压力、渠道值守、成本脉冲和编排风险放在一屏里。</p>
        </div>
        {health && <span className="badge badge-purple">健康分 {health.score}</span>}
      </div>

      <div className="grid gap-4 xl:grid-cols-4 md:grid-cols-2">
        <div className="rounded-3xl border border-surface-border bg-surface-bg p-4 space-y-2">
          <p className="text-xs font-semibold text-text-secondary">任务压力</p>
          <p className="text-2xl font-bold text-text-primary">{taskSummary?.active ?? 0}</p>
          <p className="text-xs text-text-secondary">执行中任务</p>
          <div className="flex flex-wrap gap-2 text-[11px] text-text-secondary">
            <span className="badge badge-yellow">{taskSummary?.waiting ?? 0} 待审批</span>
            <span className="badge badge-red">{taskSummary?.blocked ?? 0} 阻塞</span>
            <span className="badge badge-purple">{taskSummary?.pendingApprovals ?? 0} 审批项</span>
          </div>
        </div>

        <div className="rounded-3xl border border-surface-border bg-surface-bg p-4 space-y-2">
          <p className="text-xs font-semibold text-text-secondary">渠道值守</p>
          <p className="text-2xl font-bold text-text-primary">{onlineChannels} / {channels?.channelOrder.length ?? 0}</p>
          <p className="text-xs text-text-secondary">在线渠道</p>
          <div className="flex flex-wrap gap-2 text-[11px] text-text-secondary">
            <span>{connectedAccounts} / {accounts.length} 账号在线</span>
            <span>{activeRuns} 条运行中</span>
          </div>
        </div>

        <div className="rounded-3xl border border-surface-border bg-surface-bg p-4 space-y-2">
          <p className="text-xs font-semibold text-text-secondary">成本脉冲</p>
          <p className="text-2xl font-bold text-text-primary">{formatCost(usage?.totals.totalCost ?? 0)}</p>
          <p className="text-xs text-text-secondary">累计成本</p>
          <div className="flex flex-wrap gap-2 text-[11px] text-text-secondary">
            <span>{formatTokens(usage?.totals.totalTokens ?? 0)} tokens</span>
            <span>{usage?.totals.calls ?? 0} calls</span>
            <span>{latestDaily ? `今日 ${formatCost(latestDaily.cost)}` : '暂无日汇总'}</span>
          </div>
        </div>

        <div className="rounded-3xl border border-surface-border bg-surface-bg p-4 space-y-2">
          <p className="text-xs font-semibold text-text-secondary">覆盖与瓶颈</p>
          <p className="text-2xl font-bold text-text-primary">{health?.dimensions.coverage.missingLayers.length ?? 0}</p>
          <p className="text-xs text-text-secondary">缺失层级</p>
          <div className="space-y-1 text-[11px] text-text-secondary">
            <p>最忙角色：{health?.dimensions.bottleneck.busiestAgentId ?? '暂无'}</p>
            <p>中位任务龄：{formatMedianAge(taskSummary?.medianAgeMs ?? 0)}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div className="rounded-3xl border border-surface-border bg-surface-bg p-4 space-y-3">
          <p className="text-xs font-semibold text-text-secondary">控制面建议</p>
          {suggestions.length > 0 ? (
            suggestions.map((suggestion) => (
              <p key={suggestion} className="text-xs leading-5 text-text-primary">• {suggestion}</p>
            ))
          ) : (
            <p className="text-xs text-text-secondary">当前没有额外建议，运行态整体平稳。</p>
          )}
        </div>

        <div className="rounded-3xl border border-surface-border bg-surface-bg p-4 space-y-3">
          <p className="text-xs font-semibold text-text-secondary">风险提示</p>
          {alerts.length > 0 ? (
            alerts.map((alert) => (
              <div
                key={alert.id}
                className={`rounded-2xl border px-3 py-2 text-xs ${
                  alert.severity === 'critical'
                    ? 'border-accent-red/30 bg-pastel-red/20 text-accent-red'
                    : alert.severity === 'warn'
                      ? 'border-accent-yellow/30 bg-pastel-yellow/20 text-accent-yellow'
                      : 'border-surface-border bg-white text-text-secondary'
                }`}
              >
                <p className="font-semibold">{alert.title}</p>
                <p className="mt-1 leading-5">{alert.detail}</p>
              </div>
            ))
          ) : (
            <p className="text-xs text-text-secondary">暂无高优先级风险提示。</p>
          )}
        </div>
      </div>
    </div>
  )
}
