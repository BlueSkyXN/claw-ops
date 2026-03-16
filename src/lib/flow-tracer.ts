import type { TrackedTask } from './task-tracker'

export interface ExecutionTrace {
  taskId: string
  completedNodes: string[]
  activeNodes: string[]
  waitingNodes: string[]
  blockedNodes: string[]
  completedEdges: string[]
  activeEdges: string[]
  waitingEdges: string[]
  blockedEdges: string[]
}

function push(set: Set<string>, value: string | null | undefined) {
  if (value) set.add(value)
}

export function buildExecutionTrace(task: TrackedTask | null): ExecutionTrace | null {
  if (!task) return null

  const completedNodes = new Set<string>()
  const activeNodes = new Set<string>()
  const waitingNodes = new Set<string>()
  const blockedNodes = new Set<string>()
  const completedEdges = new Set<string>()
  const activeEdges = new Set<string>()
  const waitingEdges = new Set<string>()
  const blockedEdges = new Set<string>()

  const ownerRoleId = task.ownerRoleId ?? task.steps[0]?.roleId ?? null
  push(activeNodes, `channel-${task.originChannel}`)

  if (task.entryNodeId && ownerRoleId) {
    const edgeId = `entry-${task.entryNodeId}-${ownerRoleId}`
    if (task.status === 'completed') {
      completedEdges.add(edgeId)
      completedNodes.add(`quickstart-${task.entryNodeId}`)
    } else {
      activeEdges.add(edgeId)
      activeNodes.add(`quickstart-${task.entryNodeId}`)
    }
  }

  if (ownerRoleId) {
    const channelEdgeId = `channel-entry-${task.originChannel}-${ownerRoleId}`
    if (task.status === 'completed') {
      completedEdges.add(channelEdgeId)
    } else {
      activeEdges.add(channelEdgeId)
    }
  }

  task.steps.forEach((step) => {
    const nodeId = `role-${step.roleId}`
    if (step.status === 'completed') completedNodes.add(nodeId)
    if (step.status === 'running') activeNodes.add(nodeId)
    if (step.status === 'waiting') waitingNodes.add(nodeId)
    if (step.status === 'blocked' || step.status === 'failed') blockedNodes.add(nodeId)

    if (!step.fromRoleId) return
    const edgeId = `handoff-${step.fromRoleId}-${step.roleId}`
    if (step.status === 'completed') completedEdges.add(edgeId)
    if (step.status === 'running') activeEdges.add(edgeId)
    if (step.status === 'waiting') waitingEdges.add(edgeId)
    if (step.status === 'blocked' || step.status === 'failed') blockedEdges.add(edgeId)
  })

  return {
    taskId: task.id,
    completedNodes: Array.from(completedNodes),
    activeNodes: Array.from(activeNodes),
    waitingNodes: Array.from(waitingNodes),
    blockedNodes: Array.from(blockedNodes),
    completedEdges: Array.from(completedEdges),
    activeEdges: Array.from(activeEdges),
    waitingEdges: Array.from(waitingEdges),
    blockedEdges: Array.from(blockedEdges),
  }
}
