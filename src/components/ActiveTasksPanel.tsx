import ApprovalBadge from './ApprovalBadge'
import TaskStepTimeline from './TaskStepTimeline'
import type { TrackedTask } from '../lib/task-tracker'

export type ActiveTaskPanelAction = 'pause' | 'resume' | 'reset' | 'nudge' | 'approve' | 'deny'

function formatDuration(durationMs: number): string {
  const minutes = Math.max(1, Math.round(durationMs / 60_000))
  if (minutes < 60) return `${minutes} 分钟`
  const hours = Math.floor(minutes / 60)
  const remain = minutes % 60
  return remain > 0 ? `${hours} 小时 ${remain} 分钟` : `${hours} 小时`
}

function formatRelative(ts: number): string {
  const diff = Date.now() - ts
  const minutes = Math.max(0, Math.floor(diff / 60_000))
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  return `${Math.floor(hours / 24)} 天前`
}

function taskMeta(status: TrackedTask['status']) {
  switch (status) {
    case 'active':
      return { icon: '●', tone: 'badge-blue', label: '执行中' }
    case 'waiting':
      return { icon: '⏸', tone: 'badge-yellow', label: '待审批' }
    case 'blocked':
      return { icon: '⛔', tone: 'badge-red', label: '已阻断' }
    case 'stalled':
      return { icon: '⏳', tone: 'badge-purple', label: '停滞' }
    case 'failed':
      return { icon: '⚠', tone: 'badge-red', label: '失败' }
    default:
      return { icon: '✓', tone: 'badge-green', label: '已完成' }
  }
}

export default function ActiveTasksPanel({
  tasks,
  title = '活跃任务',
  subtitle,
  selectedTaskId,
  onSelectTask,
  onAction,
  busyKey,
  maxItems,
  emptyMessage = '当前没有可观测任务。',
}: {
  tasks: TrackedTask[]
  title?: string
  subtitle?: string
  selectedTaskId?: string | null
  onSelectTask?: (task: TrackedTask) => void
  onAction?: (action: ActiveTaskPanelAction, task: TrackedTask, approvalId?: string) => void
  busyKey?: string | null
  maxItems?: number
  emptyMessage?: string
}) {
  const visibleTasks = maxItems ? tasks.slice(0, maxItems) : tasks

  return (
    <div className="card p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
          {subtitle && <p className="text-xs text-text-secondary mt-1">{subtitle}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-text-secondary">
          <span className="badge badge-blue">{tasks.filter((task) => task.status === 'active').length} 执行中</span>
          <ApprovalBadge count={tasks.reduce((sum, task) => sum + task.pendingApprovals.length, 0)} compact />
        </div>
      </div>

      {visibleTasks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-surface-border bg-surface-bg px-4 py-8 text-center text-sm text-text-muted">
          {emptyMessage}
        </div>
      ) : (
        <div className="space-y-3">
          {visibleTasks.map((task) => {
            const meta = taskMeta(task.status)
            const selected = selectedTaskId === task.id
            const approval = task.pendingApprovals[0]
            const actionKeyPrefix = `${task.id}:`
            const isPauseState = task.currentSendPolicy === 'deny' || task.status === 'blocked'

            return (
              <div
                key={task.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelectTask?.(task)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onSelectTask?.(task)
                  }
                }}
                className={`rounded-2xl border p-4 transition-all ${selected ? 'border-brand-300 bg-brand-50/60 shadow-card' : 'border-surface-border bg-surface-bg hover:border-brand-200 hover:bg-white'}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`badge ${meta.tone}`}>{meta.icon} {meta.label}</span>
                      <ApprovalBadge count={task.pendingApprovals.length} compact />
                    </div>
                    <h4 className="text-sm font-semibold text-text-primary mt-2 truncate">{task.title}</h4>
                    <p className="text-xs text-text-secondary mt-1 truncate">
                      {task.originUser} · {task.originChannel} → {task.currentAgentName ?? task.ownerRoleName ?? '等待分配'}
                    </p>
                  </div>
                  <div className="text-right text-[11px] text-text-muted">
                    <p>{formatRelative(task.updatedAt)}</p>
                    <p className="mt-1">耗时 {formatDuration(task.durationMs)}</p>
                  </div>
                </div>

                <p className="mt-3 text-xs text-text-secondary leading-5">{task.summary}</p>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-text-secondary">
                  <span>{task.totalTokens.toLocaleString()} tokens</span>
                  <span>${task.totalCost.toFixed(3)}</span>
                  <span>{task.steps.length} 个阶段</span>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {approval && onAction && (
                    <>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          onAction('approve', task, approval.id)
                        }}
                        className="btn-secondary text-xs"
                        disabled={busyKey === `${actionKeyPrefix}approve`}
                      >
                        ✅ 通过
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          onAction('deny', task, approval.id)
                        }}
                        className="btn-secondary text-xs"
                        disabled={busyKey === `${actionKeyPrefix}deny`}
                      >
                        ❌ 驳回
                      </button>
                    </>
                  )}
                  {onAction && (
                    <>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          onAction(isPauseState ? 'resume' : 'pause', task)
                        }}
                        className="btn-secondary text-xs"
                        disabled={busyKey === `${actionKeyPrefix}${isPauseState ? 'resume' : 'pause'}`}
                      >
                        {isPauseState ? '▶ 恢复' : '⏸ 暂停'}
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          onAction('nudge', task)
                        }}
                        className="btn-secondary text-xs"
                        disabled={busyKey === `${actionKeyPrefix}nudge`}
                      >
                        📣 催办
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          onAction('reset', task)
                        }}
                        className="btn-secondary text-xs"
                        disabled={busyKey === `${actionKeyPrefix}reset`}
                      >
                        ↺ 重置
                      </button>
                    </>
                  )}
                </div>

                {selected && (
                  <div className="mt-4 border-t border-surface-border pt-4">
                    <TaskStepTimeline steps={task.steps} dense />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
