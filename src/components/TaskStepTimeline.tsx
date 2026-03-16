import type { TaskStep } from '../lib/task-tracker'

function formatRelative(ts: number): string {
  const diff = Date.now() - ts
  const minutes = Math.max(0, Math.floor(diff / 60_000))
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  return `${Math.floor(hours / 24)} 天前`
}

function statusMeta(status: TaskStep['status']) {
  switch (status) {
    case 'running':
      return { icon: '▶', tone: 'text-brand-600', dot: 'bg-brand-500', label: '执行中' }
    case 'completed':
      return { icon: '✓', tone: 'text-accent-green', dot: 'bg-accent-green', label: '已完成' }
    case 'waiting':
      return { icon: '⏸', tone: 'text-accent-yellow', dot: 'bg-accent-yellow', label: '待审批' }
    case 'blocked':
      return { icon: '⛔', tone: 'text-accent-red', dot: 'bg-accent-red', label: '已阻断' }
    case 'failed':
      return { icon: '⚠', tone: 'text-accent-red', dot: 'bg-accent-red', label: '失败' }
    default:
      return { icon: '○', tone: 'text-text-muted', dot: 'bg-text-muted', label: '待执行' }
  }
}

export default function TaskStepTimeline({ steps, dense = false }: { steps: TaskStep[]; dense?: boolean }) {
  return (
    <div className={dense ? 'space-y-2' : 'space-y-3'}>
      {steps.map((step) => {
        const meta = statusMeta(step.status)
        return (
          <div key={step.id} className="flex items-start gap-3">
            <div className="flex flex-col items-center pt-0.5">
              <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full bg-surface-bg text-xs font-semibold ${meta.tone}`}>
                {meta.icon}
              </span>
              <span className={`mt-1 h-6 w-px ${dense ? 'bg-surface-border' : 'bg-surface-divider'}`} />
            </div>
            <div className="min-w-0 flex-1 rounded-2xl border border-surface-border bg-surface-bg px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-text-primary truncate">
                    {step.fromRoleId ? `${step.agentName}（承接自 ${step.fromRoleId}）` : step.agentName}
                  </p>
                  <p className="text-[11px] text-text-secondary mt-0.5">{meta.label} · {step.layer ?? '未分层'}</p>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-text-secondary">
                  <span className={`inline-flex h-2.5 w-2.5 rounded-full ${meta.dot}`} />
                  <span>{formatRelative(step.updatedAt)}</span>
                </div>
              </div>
              <p className="text-xs text-text-secondary mt-2 leading-5">{step.note}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-text-muted">
                {step.mandatory && <span className="badge badge-yellow">强制门禁</span>}
                {step.totalTokens > 0 && <span>{step.totalTokens.toLocaleString()} tokens</span>}
                {step.totalCost > 0 && <span>${step.totalCost.toFixed(3)}</span>}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
