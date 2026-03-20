import type { LoadedExperiencePreset } from './orchestration'
import type { TrackedTask } from './task-tracker'
import type { WorkflowDefinition, WorkflowEdge, WorkflowNode } from '../types/workflow'

export function workflowTriggerNodeId(value: string): string {
  return `trigger:${value}`
}

export function workflowRoleNodeId(value: string): string {
  return `role:${value}`
}

export function buildWorkflowDefinitionFromExperience(
  experience: LoadedExperiencePreset,
): WorkflowDefinition {
  const nodes: WorkflowNode[] = []
  const edges: WorkflowEdge[] = []
  const entryNodeIds: string[] = []

  if (experience.summary.quickStarts.length > 0) {
    experience.summary.quickStarts.forEach((quickStart) => {
      const nodeId = workflowTriggerNodeId(quickStart.id)
      entryNodeIds.push(nodeId)
      nodes.push({
        id: nodeId,
        type: 'trigger',
        label: quickStart.title,
        description: `${quickStart.user} · ${quickStart.channel}`,
        metadata: { channel: quickStart.channel, ownerRoleId: quickStart.ownerRoleId },
      })
      edges.push({
        id: `entry:${quickStart.id}:${quickStart.ownerRoleId}`,
        from: nodeId,
        to: workflowRoleNodeId(quickStart.ownerRoleId),
        type: 'entry',
        condition: '入口触发',
        mandatory: true,
      })
    })
  } else {
    const manualNodeId = workflowTriggerNodeId('manual-dispatch')
    nodes.push({
      id: manualNodeId,
      type: 'trigger',
      label: 'Manual Dispatch',
      description: '控制面直接下发的入口 Mission',
    })
    entryNodeIds.push(manualNodeId)
  }

  experience.template.roles.forEach((roleId) => {
    const role = experience.roles.find((entry) => entry.manifest.id === roleId)
    nodes.push({
      id: workflowRoleNodeId(roleId),
      type: 'role-task',
      label: role?.manifest.name ?? roleId,
      description: role?.manifest.description,
      roleId,
      metadata: role
        ? {
            layer: role.manifest.layer,
            modelTier: role.manifest.modelTier,
            costTier: role.manifest.costTier,
          }
        : undefined,
    })
  })

  experience.template.workflow.forEach((step) => {
    edges.push({
      id: `handoff:${step.from}:${step.to}`,
      from: workflowRoleNodeId(step.from),
      to: workflowRoleNodeId(step.to),
      type: 'handoff',
      condition: step.condition,
      mandatory: step.mandatory,
    })
  })

  return {
    id: experience.template.id,
    version: experience.manifest.version,
    name: experience.summary.name,
    description: experience.summary.description,
    entryNodeIds,
    nodes,
    edges,
  }
}

export function buildWorkflowDefinitionFromTask(task: TrackedTask): WorkflowDefinition {
  const triggerId = workflowTriggerNodeId(task.entryNodeId ?? 'manual-dispatch')
  const nodes: WorkflowNode[] = [
    {
      id: triggerId,
      type: 'trigger',
      label: task.entryNodeId ? task.title : 'Manual Dispatch',
      description: `${task.originUser} · ${task.originChannel}`,
    },
  ]
  const edges: WorkflowEdge[] = []
  const seenRoles = new Set<string>()

  task.steps.forEach((step) => {
    const nodeId = step.workflowNodeId ?? workflowRoleNodeId(step.roleId)
    if (!seenRoles.has(nodeId)) {
      nodes.push({
        id: nodeId,
        type: 'role-task',
        label: step.agentName,
        roleId: step.roleId,
      })
      seenRoles.add(nodeId)
    }
    if (step.fromRoleId) {
      edges.push({
        id: `handoff:${step.fromRoleId}:${step.roleId}`,
        from: workflowRoleNodeId(step.fromRoleId),
        to: nodeId,
        type: 'handoff',
        condition: step.note,
        mandatory: step.mandatory,
      })
    }
  })

  if (task.ownerRoleId) {
    edges.unshift({
      id: `entry:${task.entryNodeId ?? 'manual-dispatch'}:${task.ownerRoleId}`,
      from: triggerId,
      to: workflowRoleNodeId(task.ownerRoleId),
      type: 'entry',
      condition: '入口触发',
      mandatory: true,
    })
  }

  return {
    id: task.workflowId ?? `task:${task.id}`,
    version: task.workflowVersion ?? 'draft',
    name: task.title,
    description: task.summary,
    entryNodeIds: [triggerId],
    nodes,
    edges,
  }
}
