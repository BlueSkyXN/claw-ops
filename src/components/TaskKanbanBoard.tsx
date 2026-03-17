import ApprovalBadge from './ApprovalBadge'
import type { TrackedTask } from '../lib/task-tracker'

type LaneId = 'active' | 'waiting' | 'risk' | 'completed'

interface LaneConfig {
  id: LaneId
  title: string
  subtitle: string
  tone: string
}

const lanes: LaneConfig[] = [
  { id: 'active', title: '执行中', subtitle: '正在推进的任务', tone: 'border-brand-200 bg-brand-50/50' },
  { id: 'waiting', title: '待审批', subtitle: '等待门禁或确认', tone: 'border-accent-yellow/30 bg-pastel-yellow/20' },
  { id: 'risk', title: '风险池', subtitle: '阻塞、停滞或失败', tone: 'border-accent-red/30 bg-pastel-red/20' },
  { id: 'completed', title: '已完成', subtitle: '最近完成的交付', tone: 'border-accent-green/30 bg-pastel-green/20' },
]

function laneForTask(task: TrackedTask): LaneId {
  switch (task.status) {
    case 'active':
      return 'active'
    case 'waiting':
      return 'waiting'
    case 'completed':
      return 'completed'
    default:
      return 'risk'
  }
}

function statusLabel(task: TrackedTask): string {
  switch (task.status) {
    case 'active':
      return '执行中'
    case 'waiting':
      return '待审批'
    case 'blocked':
      return '阻塞'
    case 'stalled':
      return '停滞'
    case 'failed':
      return '失败'
    default:
      return '已完成'
  }
}

export default function TaskKanbanBoard({
  tasks,
  selectedTaskId,
  onSelectTask,
}: {
  tasks: TrackedTask[]
  selectedTaskId?: string | null
  onSelectTask?: (task: TrackedTask) => void
}) {
  const lanesMap = new Map<LaneId, TrackedTask[]>(lanes.map((lane) => [lane.id, []]))
  tasks.forEach((task) => {
    lanesMap.get(laneForTask(task))?.push(task)
  })

  return (
    <div className="card p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">任务看板</h3>
          <p className="text-xs text-text-secondary mt-1">先用状态泳道扫一眼全局，再深入到下方列表和单任务控制。</p>
        </div>
        <div className="text-[11px] text-text-secondary">
          共 {tasks.length} 个任务
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-4 md:grid-cols-2">
        {lanes.map((lane) => {
          const laneTasks = (lanesMap.get(lane.id) ?? [])
            .slice()
            .sort((left, right) => right.updatedAt - left.updatedAt)
          const visibleTasks = laneTasks.slice(0, 4)
          const hiddenCount = Math.max(0, laneTasks.length - visibleTasks.length)

          return (
            <div key={lane.id} className={`rounded-3xl border p-4 space-y-3 ${lane.tone}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-text-primary">{lane.title}</p>
                  <p className="text-[11px] text-text-secondary mt-1">{lane.subtitle}</p>
                </div>
                <span className="badge badge-purple">{laneTasks.length}</span>
              </div>

              {visibleTasks.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-surface-border bg-white/60 px-3 py-6 text-center text-xs text-text-muted">
                  当前泳道暂无任务
                </div>
              ) : (
                <div className="space-y-2">
                  {visibleTasks.map((task) => {
                    const selected = selectedTaskId === task.id
                    return (
                      <button
                        key={task.id}
                        type="button"
                        onClick={() => onSelectTask?.(task)}
                        className={`w-full rounded-2xl border p-3 text-left transition-all ${
                          selected
                            ? 'border-brand-300 bg-white shadow-card'
                            : 'border-surface-border bg-white/80 hover:border-brand-200 hover:bg-white'
                        }`}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="badge badge-blue">{statusLabel(task)}</span>
                          <ApprovalBadge count={task.pendingApprovals.length} compact />
                        </div>
                        <p className="mt-2 text-sm font-semibold text-text-primary line-clamp-2">{task.title}</p>
                        <p className="mt-1 text-[11px] text-text-secondary truncate">
                          {task.currentAgentName ?? task.ownerRoleName ?? '等待分配'} · {task.originChannel}
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-text-muted">
                          <span>{task.steps.length} 阶段</span>
                          <span>{task.totalTokens.toLocaleString()} tokens</span>
                          <span>${task.totalCost.toFixed(3)}</span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}

              {hiddenCount > 0 && (
                <p className="text-[11px] text-text-secondary">还有 {hiddenCount} 个任务可在下方列表继续查看。</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
