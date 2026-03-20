export type WorkflowNodeType =
  | 'trigger'
  | 'role-task'
  | 'approval'
  | 'decision'
  | 'parallel'
  | 'merge'
  | 'deterministic-subflow'
  | 'wait'

export type WorkflowEdgeType = 'entry' | 'handoff' | 'escalation'

export type WorkflowExecutionStatus =
  | 'idle'
  | 'pending'
  | 'running'
  | 'waiting'
  | 'blocked'
  | 'failed'
  | 'completed'

export interface WorkflowNode {
  id: string
  type: WorkflowNodeType
  label: string
  description?: string
  roleId?: string
  metadata?: Record<string, unknown>
}

export interface WorkflowEdge {
  id: string
  from: string
  to: string
  type: WorkflowEdgeType
  condition?: string
  mandatory?: boolean
}

export interface WorkflowDefinition {
  id: string
  version: string
  name: string
  description?: string
  entryNodeIds: string[]
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
}

export interface WorkflowNodeExecution {
  nodeId: string
  type: WorkflowNodeType
  status: WorkflowExecutionStatus
  roleId?: string
  sessionKey?: string
  updatedAt?: number
  totalTokens: number
  totalCost: number
  note?: string
  branchId?: string
}

export interface WorkflowExecutionView {
  workflowId: string
  workflowVersion: string
  executionId: string
  taskId: string
  taskTitle: string
  definition: WorkflowDefinition
  nodes: WorkflowNodeExecution[]
  currentNodeIds: string[]
  pendingApprovalCount: number
  branchIds: string[]
  totalTokens: number
  totalCost: number
  status: WorkflowExecutionStatus
  context: Array<{ label: string; value: string }>
}
