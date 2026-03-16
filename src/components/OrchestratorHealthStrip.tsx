import { Link } from 'react-router-dom'
import type { MockExperienceSummary } from '../data/mock-workspace'
import type { OrchestrationHealth } from '../lib/health-analyzer'
import type { TaskTrackerSummary } from '../lib/task-tracker'
import AgentLayerBadge from './AgentLayerBadge'

const layers = ['L0', 'L1', 'L2', 'L3'] as const

function healthMeta(overall: OrchestrationHealth['overall'] | undefined) {
  switch (overall) {
    case 'healthy':
      return { tone: 'badge-green', label: '健康', accent: 'text-accent-green' }
    case 'critical':
      return { tone: 'badge-red', label: '紧急', accent: 'text-accent-red' }
    default:
      return { tone: 'badge-yellow', label: '需关注', accent: 'text-accent-yellow' }
  }
}

export default function OrchestratorHealthStrip({
  experience,
  health,
  taskSummary,
}: {
  experience: MockExperienceSummary | null
  health?: OrchestrationHealth | null
  taskSummary?: TaskTrackerSummary | null
}) {
  if (!experience) {
    return (
      <div className="card p-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-text-primary">🧩 编排体验未激活</p>
          <p className="text-xs text-text-secondary mt-1">导入任一团队模板后，这里会显示任务吞吐、门禁积压与编排健康摘要。</p>
        </div>
        <Link to="/orchestration" className="btn-primary text-xs whitespace-nowrap">
          打开编排页
        </Link>
      </div>
    )
  }

  if (!health || !taskSummary) {
    return (
      <div className="card p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-text-primary">🏢 当前编排：{experience.name}</p>
            <p className="text-xs text-text-secondary mt-1">{experience.tagline}</p>
          </div>
          <Link to="/orchestration" className="btn-secondary text-xs whitespace-nowrap">
            进入编排
          </Link>
        </div>

        <div className="grid grid-cols-4 gap-3">
          {layers.map((layer) => {
            const count = experience.layerCounts[layer]
            const healthy = count > 0
            return (
              <div key={layer} className={`rounded-2xl border p-3 ${healthy ? 'border-surface-border bg-surface-bg' : 'border-dashed border-surface-border bg-surface-hover'}`}>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <AgentLayerBadge layer={layer} />
                  <span className={`text-xs font-semibold ${healthy ? 'text-text-primary' : 'text-accent-red'}`}>
                    {healthy ? `${count} 个` : '缺失'}
                  </span>
                </div>
                <p className="text-[11px] text-text-secondary">
                  {healthy ? '角色已覆盖，可参与混合编排。' : '建议从预设补全该层能力。'}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const meta = healthMeta(health.overall)

  return (
    <div className="card p-5 space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-text-primary">🏢 当前编排：{experience.name}</p>
            <span className={`badge ${meta.tone}`}>健康度 {meta.label}</span>
          </div>
          <p className="text-xs text-text-secondary">{experience.tagline}</p>
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-text-secondary">
            <span className="badge badge-blue">{taskSummary.active} 执行中</span>
            <span className="badge badge-yellow">{taskSummary.pendingApprovals} 待审批</span>
            <span className="badge badge-purple">{health.dimensions.throughput.perHour} 任务 / 小时</span>
            <span className="badge badge-cyan">中位耗时 {health.dimensions.latency.medianActiveMinutes} 分钟</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="rounded-2xl border border-surface-border bg-surface-bg px-4 py-3 text-center min-w-[110px]">
            <p className="text-[11px] text-text-secondary">编排健康度</p>
            <p className={`text-2xl font-bold mt-1 ${meta.accent}`}>{health.score}</p>
          </div>
          <Link to="/orchestration" className="btn-secondary text-xs whitespace-nowrap">
            进入编排
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {layers.map((layer) => {
          const count = health.dimensions.coverage.layerCounts[layer]
          const missing = health.dimensions.coverage.missingLayers.includes(layer)
          return (
            <div key={layer} className={`rounded-2xl border p-3 ${missing ? 'border-dashed border-accent-red/30 bg-pastel-red/20' : 'border-surface-border bg-surface-bg'}`}>
              <div className="flex items-center justify-between gap-2 mb-2">
                <AgentLayerBadge layer={layer} />
                <span className={`text-xs font-semibold ${missing ? 'text-accent-red' : 'text-text-primary'}`}>
                  {missing ? '缺失' : `${count} 个`}
                </span>
              </div>
              <p className="text-[11px] text-text-secondary">
                {missing ? '该层能力不足，影响端到端闭环。' : '层级已覆盖，可参与编排决策。'}
              </p>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <div className="rounded-2xl border border-surface-border bg-surface-bg p-4 text-xs space-y-2">
          <p className="font-semibold text-text-secondary">吞吐与成本</p>
          <p className="text-text-primary">活跃任务 {taskSummary.active + taskSummary.waiting} 个，单任务均耗 {health.dimensions.cost.avgTokensPerTask.toLocaleString()} tokens。</p>
          <p className="text-text-secondary">平均成本 ${health.dimensions.cost.avgCostPerTask.toFixed(3)} / 任务</p>
        </div>
        <div className="rounded-2xl border border-surface-border bg-surface-bg p-4 text-xs space-y-2">
          <p className="font-semibold text-text-secondary">瓶颈观察</p>
          <p className="text-text-primary">当前最忙角色：{health.dimensions.bottleneck.busiestAgentId ?? '暂无'}{health.dimensions.bottleneck.queueDepth > 0 ? ` · 队列 ${health.dimensions.bottleneck.queueDepth}` : ''}</p>
          <p className="text-text-secondary">最慢环节：{health.dimensions.latency.slowestAgentId ?? '暂无明显瓶颈'}</p>
        </div>
        <div className="rounded-2xl border border-surface-border bg-surface-bg p-4 text-xs space-y-2">
          <p className="font-semibold text-text-secondary">控制面建议</p>
          {health.suggestions.slice(0, 2).map((suggestion) => (
            <p key={suggestion} className="text-text-primary leading-5">• {suggestion}</p>
          ))}
          {health.suggestions.length === 0 && <p className="text-text-secondary">暂无额外建议，当前编排运行平稳。</p>}
        </div>
      </div>

      {health.alerts.length > 0 && (
        <div className="space-y-2">
          {health.alerts.slice(0, 2).map((alert) => (
            <div key={alert.id} className={`rounded-2xl border px-4 py-3 text-xs ${alert.severity === 'critical' ? 'border-accent-red/30 bg-pastel-red/20 text-accent-red' : alert.severity === 'warn' ? 'border-accent-yellow/30 bg-pastel-yellow/20 text-accent-yellow' : 'border-surface-border bg-surface-bg text-text-secondary'}`}>
              <p className="font-semibold">{alert.title}</p>
              <p className="mt-1 leading-5">{alert.detail}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
