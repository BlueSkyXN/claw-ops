import type { WorkflowExecutionView } from '../types/workflow'

function formatStatus(status: WorkflowExecutionView['status'] | WorkflowExecutionView['nodes'][number]['status']) {
  switch (status) {
    case 'running':
      return { label: '执行中', badge: 'badge-blue' }
    case 'waiting':
      return { label: '等待中', badge: 'badge-yellow' }
    case 'blocked':
      return { label: '阻断', badge: 'badge-red' }
    case 'failed':
      return { label: '失败', badge: 'badge-red' }
    case 'completed':
      return { label: '已完成', badge: 'badge-green' }
    case 'pending':
      return { label: '待执行', badge: 'badge-purple' }
    default:
      return { label: '空闲', badge: 'badge-cyan' }
  }
}

function formatNodeType(type: WorkflowExecutionView['definition']['nodes'][number]['type']) {
  switch (type) {
    case 'trigger':
      return '入口'
    case 'role-task':
      return '角色任务'
    case 'approval':
      return '审批'
    case 'decision':
      return '判断'
    case 'parallel':
      return '并行'
    case 'merge':
      return '汇合'
    case 'deterministic-subflow':
      return '确定性子流'
    default:
      return '等待'
  }
}

function formatCost(value: number) {
  return value >= 1 ? `$${value.toFixed(2)}` : `$${value.toFixed(4)}`
}

export default function WorkflowExecutionPanel({
  execution,
}: {
  execution: WorkflowExecutionView | null
}) {
  if (!execution) {
    return (
      <div className="card p-5 text-sm text-text-secondary">
        选择一个任务后，这里会显示 workflow instance、节点状态和执行上下文。
      </div>
    )
  }

  const definitionById = new Map(execution.definition.nodes.map((node) => [node.id, node]))
  const status = formatStatus(execution.status)

  return (
    <div className="space-y-4">
      <div className="card p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-text-primary">Workflow Execution</p>
              <span className={`badge ${status.badge}`}>{status.label}</span>
            </div>
            <p className="text-xs text-text-secondary mt-1">
              {execution.taskTitle} · {execution.workflowId}@{execution.workflowVersion}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-[11px]">
            <span className="badge badge-blue">{execution.nodes.filter((node) => node.status === 'running').length} 执行中</span>
            <span className="badge badge-yellow">{execution.pendingApprovalCount} 审批</span>
            <span className="badge badge-purple">{execution.branchIds.length} 分支</span>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-surface-border bg-surface-bg px-4 py-3">
            <p className="text-[11px] text-text-secondary">Execution ID</p>
            <p className="mt-1 text-sm font-semibold text-text-primary break-all">{execution.executionId}</p>
          </div>
          <div className="rounded-2xl border border-surface-border bg-surface-bg px-4 py-3">
            <p className="text-[11px] text-text-secondary">总消耗</p>
            <p className="mt-1 text-sm font-semibold text-text-primary">{execution.totalTokens.toLocaleString()} tokens</p>
          </div>
          <div className="rounded-2xl border border-surface-border bg-surface-bg px-4 py-3">
            <p className="text-[11px] text-text-secondary">总成本</p>
            <p className="mt-1 text-sm font-semibold text-text-primary">{formatCost(execution.totalCost)}</p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {execution.context.map((entry) => (
            <div key={entry.label} className="rounded-2xl border border-surface-border bg-white px-4 py-3">
              <p className="text-[11px] text-text-secondary">{entry.label}</p>
              <p className="mt-1 text-xs text-text-primary break-all">{entry.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="card p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">节点执行状态</h3>
            <p className="text-xs text-text-secondary mt-1">把当前任务映射成 workflow node，而不是只看会话列表。</p>
          </div>
          <div className="flex flex-wrap gap-2 text-[11px] text-text-secondary">
            <span className="badge badge-green">绿：已完成</span>
            <span className="badge badge-blue">蓝：执行中</span>
            <span className="badge badge-yellow">黄：等待/审批</span>
            <span className="badge badge-red">红：阻断/失败</span>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          {execution.nodes.map((nodeExecution) => {
            const definition = definitionById.get(nodeExecution.nodeId)
            const nodeStatus = formatStatus(nodeExecution.status)
            const isCurrent = execution.currentNodeIds.includes(nodeExecution.nodeId)

            return (
              <div
                key={nodeExecution.nodeId}
                className={`rounded-2xl border p-4 transition-colors ${
                  isCurrent
                    ? 'border-brand-300 bg-brand-50/50'
                    : 'border-surface-border bg-surface-bg'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-text-primary">{definition?.label ?? nodeExecution.nodeId}</p>
                      <span className="badge badge-cyan">{formatNodeType(nodeExecution.type)}</span>
                      <span className={`badge ${nodeStatus.badge}`}>{nodeStatus.label}</span>
                      {isCurrent && <span className="badge badge-purple">当前节点</span>}
                    </div>
                    {definition?.description && (
                      <p className="mt-2 text-xs text-text-secondary leading-5">{definition.description}</p>
                    )}
                  </div>
                  <div className="text-right text-[11px] text-text-secondary">
                    <p>{nodeExecution.totalTokens.toLocaleString()} tokens</p>
                    <p className="mt-1">{formatCost(nodeExecution.totalCost)}</p>
                  </div>
                </div>

                <div className="mt-3 grid gap-2 text-[11px] text-text-secondary sm:grid-cols-2">
                  <p>Role：{nodeExecution.roleId ?? '—'}</p>
                  <p>Branch：{nodeExecution.branchId ?? '主线'}</p>
                  <p className="sm:col-span-2 break-all">Session：{nodeExecution.sessionKey ?? '—'}</p>
                </div>

                {nodeExecution.note && (
                  <div className="mt-3 rounded-2xl border border-surface-border bg-white px-3 py-3 text-xs text-text-primary leading-5">
                    {nodeExecution.note}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
