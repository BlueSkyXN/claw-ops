import { useMemo } from 'react'
import type { TrackedTask, TaskStep } from '../lib/task-tracker'
import type { LogEntry } from '../types/openclaw'

function relativeTime(ts: number): string {
  const diff = Date.now() - ts
  const min = Math.max(0, Math.floor(diff / 60_000))
  if (min < 1) return '刚刚'
  if (min < 60) return `${min} 分钟前`
  const hours = Math.floor(min / 60)
  if (hours < 24) return `${hours} 小时前`
  return `${Math.floor(hours / 24)} 天前`
}

function statusBadge(status: TrackedTask['status'] | TaskStep['status']) {
  switch (status) {
    case 'active':
    case 'running':
      return 'badge-blue'
    case 'waiting':
      return 'badge-yellow'
    case 'blocked':
    case 'failed':
      return 'badge-red'
    case 'completed':
      return 'badge-green'
    default:
      return 'badge-purple'
  }
}

function levelTone(level: string) {
  switch (level) {
    case 'error':
      return 'text-accent-red'
    case 'warn':
      return 'text-accent-yellow'
    default:
      return 'text-text-primary'
  }
}

export default function TaskActivityFeed({
  tasks,
  logs,
  selectedTask = null,
  title = '任务动向与日志',
  subtitle = '优先看过程推进、门禁变化和关键日志，不再把注意力放在成本图上。',
  maxItems = 6,
}: {
  tasks: TrackedTask[]
  logs: LogEntry[]
  selectedTask?: TrackedTask | null
  title?: string
  subtitle?: string
  maxItems?: number
}) {
  const taskItems = useMemo(() => {
    if (selectedTask) {
      return [...selectedTask.steps]
        .sort((left, right) => right.updatedAt - left.updatedAt)
        .slice(0, maxItems)
        .map((step) => ({
          id: step.id,
          title: step.agentName,
          subtitle: step.fromRoleId ? `承接自 ${step.fromRoleId}` : '任务入口',
          detail: step.note,
          status: step.status,
          updatedAt: step.updatedAt,
        }))
    }

    return [...tasks]
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .slice(0, maxItems)
      .map((task) => ({
        id: task.id,
        title: task.title,
        subtitle: `当前负责 ${task.currentAgentName ?? task.ownerRoleName ?? '未分配'}`,
        detail: task.latestEvent ?? task.summary,
        status: task.status,
        updatedAt: task.updatedAt,
      }))
  }, [maxItems, selectedTask, tasks])

  const relevantLogs = useMemo(() => {
    const baseLogs = selectedTask
      ? logs.filter((log) => selectedTask.relatedSessionKeys.some((key) => log.raw.includes(key)) || log.message.includes(selectedTask.title))
      : logs
    return [...baseLogs]
      .sort((left, right) => right.ts - left.ts)
      .slice(0, maxItems)
  }, [logs, maxItems, selectedTask])

  return (
    <div className="card p-5 space-y-4">
      <div>
        <p className="text-sm font-semibold text-text-primary">{title}</p>
        <p className="text-xs text-text-secondary mt-1">{subtitle}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <p className="text-xs font-semibold text-text-secondary">{selectedTask ? '过程进展' : '任务动向'}</p>
          <div className="space-y-2">
            {taskItems.length > 0 ? taskItems.map((item) => (
              <div key={item.id} className="rounded-2xl border border-surface-border bg-surface-bg px-4 py-3 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-text-primary truncate">{item.title}</p>
                    <p className="text-text-secondary mt-1 truncate">{item.subtitle}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`badge ${statusBadge(item.status)}`}>{item.status}</span>
                    <span className="text-text-muted">{relativeTime(item.updatedAt)}</span>
                  </div>
                </div>
                <p className="text-text-secondary mt-2 leading-5">{item.detail || '暂无额外说明'}</p>
              </div>
            )) : (
              <div className="rounded-2xl border border-surface-border bg-surface-bg px-4 py-6 text-xs text-text-secondary">
                暂无过程进展数据。
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-xs font-semibold text-text-secondary">相关日志</p>
          <div className="space-y-2">
            {relevantLogs.length > 0 ? relevantLogs.map((log, index) => (
              <div key={`${log.ts}-${index}`} className="rounded-2xl border border-surface-border bg-surface-bg px-4 py-3 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className={`font-semibold ${levelTone(log.level)}`}>{log.source ?? 'runtime-log'}</p>
                    <p className="text-text-secondary mt-1 truncate">{relativeTime(log.ts)}</p>
                  </div>
                  <span className={`badge ${log.level === 'error' ? 'badge-red' : log.level === 'warn' ? 'badge-yellow' : 'badge-blue'}`}>{log.level}</span>
                </div>
                <p className="text-text-primary mt-2 leading-5">{log.message}</p>
              </div>
            )) : (
              <div className="rounded-2xl border border-surface-border bg-surface-bg px-4 py-6 text-xs text-text-secondary">
                暂无相关日志。
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
