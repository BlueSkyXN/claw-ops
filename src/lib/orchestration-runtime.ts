import type { MockExperienceSummary } from '../data/mock-workspace'
import type { ChatSendParams, LogEntry } from '../types/openclaw'
import { getAPI, isMissingScopeError } from './api'
import { ensureGatewayClient } from './gateway-client'
import {
  loadExperiencePreset,
  type LoadedExperiencePreset,
} from './orchestration'
import {
  analyzeOrchestrationHealth,
  type OrchestrationHealth,
} from './health-analyzer'
import {
  buildTrackedTasks,
  summarizeTrackedTasks,
  type TaskTrackerSummary,
  type TrackedTask,
} from './task-tracker'
import { buildOrchestrationSessionMetadata } from './orchestration-metadata'

export interface OrchestrationRuntime {
  agents: Awaited<ReturnType<ReturnType<typeof getAPI>['getAgents']>>
  sessions: Awaited<ReturnType<ReturnType<typeof getAPI>['getSessions']>>['sessions']
  usage: Awaited<ReturnType<ReturnType<typeof getAPI>['getSessionsUsage']>>
  channels: Awaited<ReturnType<ReturnType<typeof getAPI>['getChannelsStatus']>>
  approvals: Awaited<ReturnType<ReturnType<typeof getAPI>['getExecApprovals']>>
  logs: LogEntry[]
  nodes: Awaited<ReturnType<ReturnType<typeof getAPI>['getNodes']>>
  config: Record<string, unknown>
  experience: MockExperienceSummary | null
  selectedExperience: LoadedExperiencePreset | null
  activeExperiencePreset: LoadedExperiencePreset | null
  tasks: TrackedTask[]
  taskSummary: TaskTrackerSummary
  health: OrchestrationHealth | null
}

export interface MissionDispatchInput {
  title: string
  brief: string
  successCriteria: string
  ownerRoleId: string
  priority: 'normal' | 'high' | 'critical'
}

export type TaskInterventionAction =
  | { kind: 'pause'; task: TrackedTask }
  | { kind: 'resume'; task: TrackedTask }
  | { kind: 'reset'; task: TrackedTask }
  | { kind: 'nudge'; task: TrackedTask }
  | { kind: 'approve'; task: TrackedTask; approvalId?: string }
  | { kind: 'deny'; task: TrackedTask; approvalId?: string }
  | { kind: 'reroute'; task: TrackedTask; targetRoleId: string }
  | { kind: 'switch-model'; task: TrackedTask; model: string }

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function isExperienceSummary(value: unknown): value is MockExperienceSummary {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  return typeof candidate.templateId === 'string' && typeof candidate.name === 'string' && typeof candidate.layerCounts === 'object'
}

async function safeLoadPreset(templateId: string | null): Promise<LoadedExperiencePreset | null> {
  if (!templateId) return null
  try {
    return await loadExperiencePreset(templateId)
  } catch {
    return null
  }
}

async function safeGetExecApprovals(api: ReturnType<typeof getAPI>) {
  try {
    return await api.getExecApprovals()
  } catch (err) {
    if (isMissingScopeError(err, ['operator.admin', 'operator.approvals'])) {
      return []
    }
    throw err
  }
}

export async function loadOrchestrationRuntime(options?: { templateId?: string | null }): Promise<OrchestrationRuntime> {
  const api = getAPI()
  const [agents, sessionsResult, usage, channels, approvals, logs, nodes, config] = await Promise.all([
    api.getAgents(),
    api.getSessions({ limit: 200, includeGlobal: true, includeDerivedTitles: true, includeLastMessage: true }),
    api.getSessionsUsage(),
    api.getChannelsStatus(),
    safeGetExecApprovals(api),
    api.getLogs({ limit: 200 }),
    api.getNodes(),
    api.getConfig(),
  ])

  const experience = isExperienceSummary(config.experience) ? config.experience : null
  const selectedTemplateId = options?.templateId ?? experience?.templateId ?? null
  const activeTemplateId = experience?.templateId ?? null
  const [selectedExperience, activeExperiencePreset] = await Promise.all([
    safeLoadPreset(selectedTemplateId),
    safeLoadPreset(activeTemplateId),
  ])

  const runtimePreset = activeExperiencePreset ?? selectedExperience
  const tasks = buildTrackedTasks({
    experience,
    loadedExperience: runtimePreset,
    agents,
    sessions: sessionsResult.sessions,
    usage,
    approvals,
    logs,
  })
  const taskSummary = summarizeTrackedTasks(tasks)
  const health = analyzeOrchestrationHealth({
    experience,
    loadedExperience: runtimePreset,
    tasks,
    usage,
    channels,
    nodes,
    approvals,
  })

  return {
    agents,
    sessions: sessionsResult.sessions,
    usage,
    channels,
    approvals,
    logs,
    nodes,
    config,
    experience,
    selectedExperience,
    activeExperiencePreset,
    tasks,
    taskSummary,
    health,
  }
}

export function subscribeToOrchestrationEvents(onInvalidate: () => void): () => void {
  const client = ensureGatewayClient()
  if (!client) return () => {}

  const events = [
    'agent',
    'chat',
    'presence',
    'health',
    'cron',
    'exec.approval.requested',
    'exec.approval.resolved',
    'session.update',
    'agent.status',
  ]

  const unsubs = events.map((event) => client.on(event, () => onInvalidate()))
  return () => {
    unsubs.forEach((unsubscribe) => unsubscribe())
  }
}

function buildControlMessage(task: TrackedTask, action: 'nudge' | 'reroute', targetRoleId?: string): string {
  if (action === 'nudge') {
    return `[claw-ops orchestration control] 请立即同步任务「${task.title}」的当前进展、阻塞点和下一步计划。`
  }
  return `[claw-ops orchestration control] 请接手任务「${task.title}」，并基于现有上下文继续推进。当前负责角色：${task.currentAgentName ?? task.ownerRoleName ?? '未指定'}。重派目标：${targetRoleId ?? '未指定'}。`
}

function buildMissionDispatchMessage(input: MissionDispatchInput): string {
  return [
    '[claw-ops executive mission]',
    `任务：${input.title}`,
    `目标：${input.brief}`,
    `成功标准：${input.successCriteria}`,
    `优先级：${input.priority}`,
    '你收到的是入口 Mission。控制面只负责投递入口，后续请优先使用 OpenClaw 原生的子会话 / 委派能力继续编排下游，而不是用普通闲聊模拟工作流。',
    '请立即接单，拆解执行路径，识别阻塞项，并持续同步阶段性进展、风险与下一步动作。',
  ].join('\n')
}

function buildMissionSessionKey(taskId: string, ownerRoleId: string): string {
  return `sess-web-dispatch-${taskId}-${ownerRoleId}`
}

function buildRerouteParams(task: TrackedTask, targetRoleId: string): ChatSendParams {
  const fromRoleId = task.currentAgentId ?? task.ownerRoleId ?? targetRoleId
  const parentSessionKey = task.currentSessionKey ?? task.rootSessionKey
  return {
    sessionKey: `sess-api-${slug(task.id)}-${fromRoleId}-${targetRoleId}`,
    text: buildControlMessage(task, 'reroute', targetRoleId),
    agentId: targetRoleId,
    channel: 'api',
    to: targetRoleId,
    metadata: buildOrchestrationSessionMetadata({
      orchestrationTaskId: task.id,
      orchestrationRootSessionKey: task.rootSessionKey,
      orchestrationOwnerRoleId: task.ownerRoleId ?? undefined,
      orchestrationParentSessionKey: parentSessionKey,
      orchestrationFromRoleId: fromRoleId,
      orchestrationToRoleId: targetRoleId,
      orchestrationEntryNodeId: task.entryNodeId ?? undefined,
      controlAction: 'reroute',
      taskTitle: task.title,
      originUser: task.originUser,
    }),
  }
}

export async function dispatchMission(input: MissionDispatchInput): Promise<void> {
  const api = getAPI()
  const taskId = `mission-${slug(input.title)}-${Date.now()}`
  const sessionKey = buildMissionSessionKey(taskId, input.ownerRoleId)
  await api.sendChatMessage({
    sessionKey,
    text: buildMissionDispatchMessage(input),
    agentId: input.ownerRoleId,
    channel: 'web',
    metadata: buildOrchestrationSessionMetadata({
      orchestrationTaskId: taskId,
      orchestrationRootSessionKey: sessionKey,
      orchestrationOwnerRoleId: input.ownerRoleId,
      controlAction: 'mission-dispatch',
      taskTitle: input.title,
      missionPriority: input.priority,
      successCriteria: input.successCriteria,
      originUser: 'CEO',
    }),
  })
}

export async function performTaskIntervention(action: TaskInterventionAction): Promise<void> {
  const api = getAPI()

  switch (action.kind) {
    case 'pause': {
      const key = action.task.currentSessionKey ?? action.task.rootSessionKey
      await api.patchSession({ key, sendPolicy: 'deny' })
      return
    }
    case 'resume': {
      const key = action.task.currentSessionKey ?? action.task.rootSessionKey
      await api.patchSession({ key, sendPolicy: 'allow' })
      return
    }
    case 'reset': {
      const key = action.task.currentSessionKey ?? action.task.rootSessionKey
      await api.resetSession(key)
      return
    }
    case 'nudge': {
      const params: ChatSendParams = {
        sessionKey: action.task.currentSessionKey ?? action.task.rootSessionKey,
        text: buildControlMessage(action.task, 'nudge'),
        agentId: action.task.currentAgentId ?? action.task.ownerRoleId ?? undefined,
        metadata: buildOrchestrationSessionMetadata({
          orchestrationTaskId: action.task.id,
          orchestrationRootSessionKey: action.task.rootSessionKey,
          orchestrationOwnerRoleId: action.task.ownerRoleId ?? undefined,
          orchestrationParentSessionKey: action.task.currentSessionKey ?? action.task.rootSessionKey,
          orchestrationEntryNodeId: action.task.entryNodeId ?? undefined,
          controlAction: 'nudge',
          taskTitle: action.task.title,
          originUser: 'CEO',
        }),
      }
      await api.sendChatMessage(params)
      return
    }
    case 'approve': {
      const approvalId = action.approvalId ?? action.task.pendingApprovals[0]?.id
      if (!approvalId) return
      await api.resolveExecApproval(approvalId, 'approved')
      return
    }
    case 'deny': {
      const approvalId = action.approvalId ?? action.task.pendingApprovals[0]?.id
      if (!approvalId) return
      await api.resolveExecApproval(approvalId, 'denied')
      return
    }
    case 'reroute': {
      await api.sendChatMessage(buildRerouteParams(action.task, action.targetRoleId))
      return
    }
    case 'switch-model': {
      const agentId = action.task.currentAgentId ?? action.task.ownerRoleId
      if (!agentId) return
      await api.updateAgent({ agentId, model: action.model })
      return
    }
  }
}
