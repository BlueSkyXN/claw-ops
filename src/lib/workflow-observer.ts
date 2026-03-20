import type { LoadedExperiencePreset } from './orchestration'
import type { TaskStep, TrackedTask } from './task-tracker'
import {
  buildWorkflowDefinitionFromExperience,
  buildWorkflowDefinitionFromTask,
  workflowRoleNodeId,
  workflowTriggerNodeId,
} from './workflow-definition'
import type {
  WorkflowExecutionStatus,
  WorkflowExecutionView,
  WorkflowNodeExecution,
} from '../types/workflow'

function toWorkflowStatus(status: TrackedTask['status'] | TaskStep['status']): WorkflowExecutionStatus {
  switch (status) {
    case 'active':
    case 'running':
      return 'running'
    case 'waiting':
      return 'waiting'
    case 'blocked':
      return 'blocked'
    case 'failed':
      return 'failed'
    case 'completed':
      return 'completed'
    case 'pending':
      return 'pending'
    case 'stalled':
      return 'blocked'
    default:
      return 'idle'
  }
}

const executionRank: Record<WorkflowExecutionStatus, number> = {
  idle: 0,
  completed: 1,
  pending: 2,
  running: 3,
  waiting: 4,
  blocked: 5,
  failed: 6,
}

function mergeExecutionStatus(
  current: WorkflowExecutionStatus,
  next: WorkflowExecutionStatus,
): WorkflowExecutionStatus {
  return executionRank[next] > executionRank[current] ? next : current
}

function ensureNodeExecution(
  map: Map<string, WorkflowNodeExecution>,
  node: WorkflowExecutionView['definition']['nodes'][number],
): WorkflowNodeExecution {
  const existing = map.get(node.id)
  if (existing) return existing

  const created: WorkflowNodeExecution = {
    nodeId: node.id,
    type: node.type,
    status: 'idle',
    roleId: node.roleId,
    totalTokens: 0,
    totalCost: 0,
  }
  map.set(node.id, created)
  return created
}

function orderedNodeExecutions(
  definition: WorkflowExecutionView['definition'],
  executions: Map<string, WorkflowNodeExecution>,
): WorkflowNodeExecution[] {
  return definition.nodes.map((node) => executions.get(node.id) ?? {
    nodeId: node.id,
    type: node.type,
    status: 'idle',
    roleId: node.roleId,
    totalTokens: 0,
    totalCost: 0,
  })
}

function shouldUseExperienceDefinition(task: TrackedTask, experience: LoadedExperiencePreset | null): boolean {
  if (!experience) return false

  const experienceRoleIds = new Set(experience.template.roles)
  if (task.ownerRoleId && experienceRoleIds.has(task.ownerRoleId)) return true
  if (task.steps.some((step) => experienceRoleIds.has(step.roleId))) return true
  if (task.entryNodeId && experience.summary.quickStarts.some((quickStart) => quickStart.id === task.entryNodeId)) {
    return true
  }
  return false
}

export function buildWorkflowExecutionView(options: {
  task: TrackedTask | null
  experience: LoadedExperiencePreset | null
}): WorkflowExecutionView | null {
  const { task, experience } = options
  if (!task) return null

  const useExperienceDefinition = shouldUseExperienceDefinition(task, experience)
  const definition = useExperienceDefinition
    ? buildWorkflowDefinitionFromExperience(experience!)
    : buildWorkflowDefinitionFromTask(task)
  const executions = new Map<string, WorkflowNodeExecution>()

  definition.nodes.forEach((node) => {
    ensureNodeExecution(executions, node)
  })

  const entryId = workflowTriggerNodeId(task.entryNodeId ?? 'manual-dispatch')
  if (!executions.has(entryId)) {
    const definitionWithEntry = definition.nodes.concat({
      id: entryId,
      type: 'trigger' as const,
      label: task.entryNodeId ? task.title : 'Manual Dispatch',
      description: `${task.originUser} · ${task.originChannel}`,
    })
    definition.nodes = definitionWithEntry
    definition.entryNodeIds = Array.from(new Set([...definition.entryNodeIds, entryId]))
    ensureNodeExecution(executions, definitionWithEntry[definitionWithEntry.length - 1])
  }

  const triggerExecution = executions.get(entryId)!
  triggerExecution.status = task.status === 'failed' ? 'failed' : 'completed'
  triggerExecution.updatedAt = task.startedAt
  triggerExecution.note = `${task.originUser} · ${task.originChannel}`

  task.steps.forEach((step) => {
    const nodeId = step.workflowNodeId ?? workflowRoleNodeId(step.roleId)
    let node = definition.nodes.find((entry) => entry.id === nodeId)
    if (!node) {
      node = {
        id: nodeId,
        type: 'role-task',
        label: step.agentName,
        roleId: step.roleId,
      }
      definition.nodes = [...definition.nodes, node]
      ensureNodeExecution(executions, node)
    }
    const execution = ensureNodeExecution(executions, node)
    execution.status = mergeExecutionStatus(execution.status, toWorkflowStatus(step.status))
    execution.roleId = step.roleId
    execution.sessionKey = step.sessionKey
    execution.updatedAt = Math.max(execution.updatedAt ?? 0, step.updatedAt)
    execution.totalTokens += step.totalTokens
    execution.totalCost += step.totalCost
    execution.note = step.note
    if (!execution.branchId && step.workflowBranchId) {
      execution.branchId = step.workflowBranchId
    }
  })

  const nodeExecutions = orderedNodeExecutions(definition, executions)
  const currentNodeIds = nodeExecutions
    .filter((node) => ['running', 'waiting', 'blocked', 'failed'].includes(node.status))
    .map((node) => node.nodeId)
  const currentNodeLabel = (
    definition.nodes.find((node) => node.id === task.workflowCurrentNodeId)
    ?? definition.nodes.find((node) => currentNodeIds.includes(node.id))
  )?.label

  return {
    workflowId: useExperienceDefinition ? task.workflowId ?? definition.id : definition.id,
    workflowVersion: useExperienceDefinition ? task.workflowVersion ?? definition.version : definition.version,
    executionId: task.workflowExecutionId,
    taskId: task.id,
    taskTitle: task.title,
    definition,
    nodes: nodeExecutions,
    currentNodeIds,
    pendingApprovalCount: task.pendingApprovals.length,
    branchIds: task.workflowBranchIds,
    totalTokens: task.totalTokens,
    totalCost: task.totalCost,
    status: toWorkflowStatus(task.status),
    context: [
      { label: '来源', value: `${task.originUser} · ${task.originChannel}` },
      { label: 'Owner', value: task.ownerRoleName ?? task.ownerRoleId ?? '—' },
      { label: '当前节点', value: currentNodeLabel ?? task.currentAgentName ?? task.currentAgentId ?? '—' },
      { label: 'Root Session', value: task.rootSessionKey },
      { label: 'Current Session', value: task.currentSessionKey ?? '—' },
      { label: '优先级', value: task.missionPriority ?? '—' },
      { label: '成功标准', value: task.successCriteria ?? '—' },
    ],
  }
}
