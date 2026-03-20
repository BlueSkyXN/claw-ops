import type { GatewaySessionRow } from '../types/openclaw'

export interface OrchestrationSessionMetadata {
  controlPlane: 'claw-ops'
  orchestrationTaskId: string
  orchestrationRootSessionKey: string
  orchestrationOwnerRoleId?: string
  orchestrationParentSessionKey?: string
  orchestrationFromRoleId?: string
  orchestrationToRoleId?: string
  orchestrationEntryNodeId?: string
  controlAction?: string
  taskTitle?: string
  originUser?: string
  missionPriority?: string
  successCriteria?: string
  workflowId?: string
  workflowVersion?: string
  workflowExecutionId?: string
  workflowNodeId?: string
  workflowParentNodeId?: string
  workflowBranchId?: string
  workflowInputRef?: string
  workflowOutputRef?: string
  workflowRetryCount?: number
}

type OrchestrationMetadataInput = Omit<OrchestrationSessionMetadata, 'controlPlane'>

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

export function buildOrchestrationSessionMetadata(
  input: OrchestrationMetadataInput,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries({
      controlPlane: 'claw-ops',
      ...input,
    }).filter(([, value]) => value != null && value !== ''),
  )
}

export function getOrchestrationSessionMetadata(
  value: Pick<GatewaySessionRow, 'key' | 'metadata'> | Record<string, unknown> | null | undefined,
): OrchestrationSessionMetadata | null {
  const source = asRecord(value && 'metadata' in value ? value.metadata : value)
  if (!source) return null

  const controlPlane = asString(source.controlPlane ?? source.control_plane)
  const legacyTaskId = asString(source.taskId ?? source.task_id)
  const legacyRootSessionKey = asString(source.rootSessionKey ?? source.root_session_key ?? source.sourceSessionKey ?? source.source_session_key)
  const hasLegacyShape = legacyTaskId
    || asString(source.ownerRoleId ?? source.owner_role_id)
    || asString(source.targetRoleId ?? source.target_role_id)
    || asString(source.sourceSessionKey ?? source.source_session_key)

  if (controlPlane && controlPlane !== 'claw-ops') return null
  if (!controlPlane && !hasLegacyShape) return null

  const orchestrationTaskId = asString(source.orchestrationTaskId ?? source.orchestration_task_id) ?? legacyTaskId
  const orchestrationRootSessionKey = asString(source.orchestrationRootSessionKey ?? source.orchestration_root_session_key)
    ?? legacyRootSessionKey
    ?? asString(value && 'key' in value ? value.key : undefined)
  if (!orchestrationTaskId || !orchestrationRootSessionKey) return null

  return {
    controlPlane: 'claw-ops',
    orchestrationTaskId,
    orchestrationRootSessionKey,
    orchestrationOwnerRoleId: asString(
      source.orchestrationOwnerRoleId
      ?? source.orchestration_owner_role_id
      ?? source.ownerRoleId
      ?? source.owner_role_id,
    ),
    orchestrationParentSessionKey: asString(
      source.orchestrationParentSessionKey
      ?? source.orchestration_parent_session_key
      ?? source.sourceSessionKey
      ?? source.source_session_key,
    ),
    orchestrationFromRoleId: asString(
      source.orchestrationFromRoleId
      ?? source.orchestration_from_role_id
      ?? source.fromRoleId
      ?? source.from_role_id,
    ),
    orchestrationToRoleId: asString(
      source.orchestrationToRoleId
      ?? source.orchestration_to_role_id
      ?? source.toRoleId
      ?? source.to_role_id
      ?? source.targetRoleId
      ?? source.target_role_id,
    ),
    orchestrationEntryNodeId: asString(source.orchestrationEntryNodeId ?? source.orchestration_entry_node_id ?? source.entryNodeId),
    controlAction: asString(source.controlAction ?? source.control_action),
    taskTitle: asString(source.taskTitle ?? source.task_title),
    originUser: asString(source.originUser ?? source.origin_user),
    missionPriority: asString(source.missionPriority ?? source.mission_priority),
    successCriteria: asString(source.successCriteria ?? source.success_criteria),
    workflowId: asString(source.workflowId ?? source.workflow_id),
    workflowVersion: asString(source.workflowVersion ?? source.workflow_version),
    workflowExecutionId: asString(source.workflowExecutionId ?? source.workflow_execution_id ?? source.executionId ?? source.execution_id),
    workflowNodeId: asString(source.workflowNodeId ?? source.workflow_node_id ?? source.nodeId ?? source.node_id),
    workflowParentNodeId: asString(source.workflowParentNodeId ?? source.workflow_parent_node_id ?? source.parentNodeId ?? source.parent_node_id),
    workflowBranchId: asString(source.workflowBranchId ?? source.workflow_branch_id ?? source.branchId ?? source.branch_id),
    workflowInputRef: asString(source.workflowInputRef ?? source.workflow_input_ref ?? source.inputRef ?? source.input_ref),
    workflowOutputRef: asString(source.workflowOutputRef ?? source.workflow_output_ref ?? source.outputRef ?? source.output_ref),
    workflowRetryCount: asNumber(source.workflowRetryCount ?? source.workflow_retry_count ?? source.retryCount ?? source.retry_count),
  }
}

export function getOrchestrationParentSessionKey(
  session: Pick<GatewaySessionRow, 'spawnedBy' | 'metadata'>,
): string | null {
  return session.spawnedBy ?? getOrchestrationSessionMetadata(session)?.orchestrationParentSessionKey ?? null
}
