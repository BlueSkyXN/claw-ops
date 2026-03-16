import { useMemo } from 'react'
import type { LoadedExperiencePreset } from '../lib/orchestration'
import type { OrchestrationHealth } from '../lib/health-analyzer'
import { buildRoleLoadMap, type TaskTrackerSummary, type TrackedTask } from '../lib/task-tracker'
import AgentLayerBadge from './AgentLayerBadge'

function riskTone(state: 'normal' | 'warn' | 'critical') {
  switch (state) {
    case 'critical':
      return 'badge-red'
    case 'warn':
      return 'badge-yellow'
    default:
      return 'badge-green'
  }
}

export default function ExecutivePerformanceBoard({
  activePreset,
  tasks,
  taskSummary,
  health,
}: {
  activePreset: LoadedExperiencePreset | null
  tasks: TrackedTask[]
  taskSummary: TaskTrackerSummary | null
  health: OrchestrationHealth | null
}) {
  const roleRows = useMemo(() => {
    if (!activePreset) return []
    const roleLoadMap = buildRoleLoadMap(tasks)
    return activePreset.roles
      .map((role) => {
        const load = roleLoadMap.get(role.manifest.id) ?? {
          activeTasks: 0,
          waitingTasks: 0,
          blockedTasks: 0,
          completedTasks: 0,
          failedTasks: 0,
          pendingApprovals: 0,
        }
        const queue = load.activeTasks + load.waitingTasks + load.blockedTasks
        const capacity = Math.max(1, role.authority.maxConcurrent || role.manifest.defaultMaxConcurrent || 1)
        const utilization = queue / capacity
        const state: 'normal' | 'warn' | 'critical' = load.blockedTasks > 0 || load.pendingApprovals > 0
          ? 'warn'
          : utilization > 1
            ? 'critical'
            : 'normal'
        return { role, load, queue, capacity, utilization, state }
      })
      .sort((left, right) => {
        if (right.queue !== left.queue) return right.queue - left.queue
        if (right.load.pendingApprovals !== left.load.pendingApprovals) return right.load.pendingApprovals - left.load.pendingApprovals
        return right.load.activeTasks - left.load.activeTasks
      })
  }, [activePreset, tasks])

  const demandSources = useMemo(() => {
    const byChannel = new Map<string, number>()
    tasks
      .filter((task) => task.status === 'active' || task.status === 'waiting' || task.status === 'blocked')
      .forEach((task) => {
        byChannel.set(task.originChannel, (byChannel.get(task.originChannel) ?? 0) + 1)
      })
    return Array.from(byChannel.entries())
      .sort((left, right) => right[1] - left[1])
      .slice(0, 4)
  }, [tasks])

  if (!activePreset || !taskSummary || !health) {
    return (
      <div className="card p-5 text-sm text-text-secondary">
        激活团队编排后，这里会显示吞吐、治理压力、组织热点和交付风险。
      </div>
    )
  }

  const cards = [
    {
      label: '任务吞吐',
      value: `${health.dimensions.throughput.perHour}`,
      sub: '任务 / 小时',
      tone: 'text-brand-600',
      icon: '📈',
    },
    {
      label: '治理压力',
      value: `${taskSummary.pendingApprovals + taskSummary.blocked}`,
      sub: `审批 ${taskSummary.pendingApprovals} · 阻断 ${taskSummary.blocked}`,
      tone: 'text-accent-yellow',
      icon: '🛡️',
    },
    {
      label: '组织热点',
      value: (roleRows[0]?.queue ?? 0) > 0 ? roleRows[0]?.role.manifest.name ?? '—' : '—',
      sub: (roleRows[0]?.queue ?? 0) > 0 ? `队列 ${roleRows[0].queue} / 容量 ${roleRows[0].capacity}` : '暂无热点角色',
      tone: 'text-accent-purple',
      icon: '🔥',
    },
    {
      label: '交付风险',
      value: `${taskSummary.stalled + taskSummary.failed}`,
      sub: `停滞 ${taskSummary.stalled} · 失败 ${taskSummary.failed}`,
      tone: 'text-accent-red',
      icon: '⚠️',
    },
  ]

  return (
    <div className="card p-5 space-y-4">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-text-primary">经营绩效板</p>
          <p className="text-xs text-text-secondary mt-1">把既有运行态数据翻译成 CEO 可直接决策的组织口径。</p>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px] text-text-secondary">
          {demandSources.map(([channel, count]) => (
            <span key={channel} className="badge badge-cyan">{channel}: {count}</span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-2xl border border-surface-border bg-surface-bg px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-text-secondary">{card.label}</p>
              <span className="text-lg">{card.icon}</span>
            </div>
            <p className={`text-lg font-semibold mt-2 ${card.tone}`}>{card.value}</p>
            <p className="text-[11px] text-text-secondary mt-1">{card.sub}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-surface-border bg-surface-bg overflow-hidden">
        <div className="grid grid-cols-[minmax(0,1.4fr)_90px_88px_88px_96px_80px] gap-3 border-b border-surface-border px-4 py-3 text-[11px] font-semibold text-text-secondary">
          <span>角色</span>
          <span>承载中</span>
          <span>排队中</span>
          <span>审批</span>
          <span>容量比</span>
          <span>状态</span>
        </div>
        <div className="divide-y divide-surface-border">
          {roleRows.slice(0, 5).map((row) => (
            <div key={row.role.manifest.id} className="grid grid-cols-[minmax(0,1.4fr)_90px_88px_88px_96px_80px] gap-3 px-4 py-3 text-xs">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span>{row.role.manifest.emoji}</span>
                  <span className="font-semibold text-text-primary truncate">{row.role.manifest.name}</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <AgentLayerBadge layer={row.role.manifest.layer} />
                  <span className="text-text-muted truncate">{row.role.manifest.modelTier}</span>
                </div>
              </div>
              <span className="text-text-primary">{row.load.activeTasks}</span>
              <span className="text-text-primary">{row.load.waitingTasks + row.load.blockedTasks}</span>
              <span className="text-text-primary">{row.load.pendingApprovals}</span>
              <span className="text-text-secondary">{Math.round(row.utilization * 100)}%</span>
              <span className={`badge ${riskTone(row.state)}`}>
                {row.state === 'critical' ? '过载' : row.state === 'warn' ? '门禁' : '正常'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
