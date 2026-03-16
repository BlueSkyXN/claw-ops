import type { MockExperienceSummary } from '../data/mock-workspace'
import type {
  AgentSummary,
  ExecApprovalRequest,
  GatewaySessionRow,
  LogEntry,
  SessionsUsageResult,
} from '../types/openclaw'
import type { PresetLayer, PresetTeamWorkflowStep } from '../types/presets'
import type { LoadedExperiencePreset } from './orchestration'

export type TaskStatus = 'active' | 'waiting' | 'completed' | 'stalled' | 'failed' | 'blocked'
export type TaskStepStatus = 'pending' | 'running' | 'completed' | 'waiting' | 'blocked' | 'failed'

export interface TaskStep {
  id: string
  roleId: string
  agentId: string
  agentName: string
  layer: PresetLayer | null
  fromRoleId: string | null
  sessionKey?: string
  startedAt: number
  updatedAt: number
  status: TaskStepStatus
  note: string
  mandatory: boolean
  totalTokens: number
  totalCost: number
}

export interface TrackedTask {
  id: string
  title: string
  summary: string
  status: TaskStatus
  startedAt: number
  updatedAt: number
  durationMs: number
  originChannel: string
  originUser: string
  rootSessionKey: string
  currentSessionKey: string | null
  currentAgentId: string | null
  currentAgentName: string | null
  currentLayer: PresetLayer | null
  currentSendPolicy: 'allow' | 'deny' | null
  ownerRoleId: string | null
  ownerRoleName: string | null
  entryNodeId: string | null
  steps: TaskStep[]
  pendingApprovals: ExecApprovalRequest[]
  relatedSessionKeys: string[]
  totalTokens: number
  totalCost: number
  latestEvent: string | null
  recommendedTargets: string[]
}

export interface TaskTrackerSummary {
  total: number
  active: number
  waiting: number
  completed: number
  stalled: number
  failed: number
  blocked: number
  pendingApprovals: number
  medianAgeMs: number
}

export interface RoleLoadInfo {
  activeTasks: number
  waitingTasks: number
  blockedTasks: number
  completedTasks: number
  failedTasks: number
  pendingApprovals: number
}

interface TaskTrackerInput {
  experience: MockExperienceSummary | null
  loadedExperience: LoadedExperiencePreset | null
  agents: AgentSummary[]
  sessions: GatewaySessionRow[]
  usage: SessionsUsageResult | null
  approvals: ExecApprovalRequest[]
  logs: LogEntry[]
}

interface ParsedSessionKey {
  kind: 'entry' | 'handoff' | 'main' | 'unknown'
  channel: string | null
  roleId: string | null
  fromRoleId: string | null
  toRoleId: string | null
  taskHint: string | null
}

interface WorkflowSessionMatch {
  workflowStep: PresetTeamWorkflowStep
  session: GatewaySessionRow
  parsed: ParsedSessionKey
}

const statusPriority: Record<TaskStatus, number> = {
  active: 0,
  waiting: 1,
  blocked: 2,
  stalled: 3,
  failed: 4,
  completed: 5,
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function normalizeText(value: string | null | undefined): string {
  if (!value) return ''
  return value.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '')
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((left, right) => left - right)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid]
}

function parseSessionKey(sessionKey: string, roleIds: string[]): ParsedSessionKey {
  const sortedRoleIds = [...roleIds].sort((left, right) => right.length - left.length)

  if (sessionKey.startsWith('sess-main')) {
    return { kind: 'main', channel: null, roleId: null, fromRoleId: null, toRoleId: null, taskHint: null }
  }

  if (sessionKey.startsWith('sess-api-')) {
    const handoffKey = sessionKey.slice('sess-api-'.length)
    for (const toRoleId of sortedRoleIds) {
      const toSuffix = `-${toRoleId}`
      if (!handoffKey.endsWith(toSuffix)) continue
      const beforeTo = handoffKey.slice(0, -toSuffix.length)
      for (const fromRoleId of sortedRoleIds) {
        const fromSuffix = `-${fromRoleId}`
        if (!beforeTo.endsWith(fromSuffix)) continue
        const taskHint = beforeTo.slice(0, -fromSuffix.length).replace(/^-+|-+$/g, '')
        return {
          kind: 'handoff',
          channel: 'api',
          roleId: toRoleId,
          fromRoleId,
          toRoleId,
          taskHint: taskHint || null,
        }
      }
    }
  }

  if (sessionKey.startsWith('sess-')) {
    const entryKey = sessionKey.slice('sess-'.length)
    for (const roleId of sortedRoleIds) {
      const roleSuffix = `-${roleId}`
      if (!entryKey.endsWith(roleSuffix)) continue
      const beforeRole = entryKey.slice(0, -roleSuffix.length)
      const [channel] = beforeRole.split('-')
      return {
        kind: 'entry',
        channel: channel || null,
        roleId,
        fromRoleId: null,
        toRoleId: null,
        taskHint: null,
      }
    }
  }

  return { kind: 'unknown', channel: null, roleId: null, fromRoleId: null, toRoleId: null, taskHint: null }
}

function buildWorkflowByFrom(workflow: PresetTeamWorkflowStep[]): Map<string, PresetTeamWorkflowStep[]> {
  const result = new Map<string, PresetTeamWorkflowStep[]>()
  workflow.forEach((step) => {
    const current = result.get(step.from) ?? []
    current.push(step)
    result.set(step.from, current)
  })
  return result
}

function matchQuickStart(
  session: GatewaySessionRow,
  quickStarts: LoadedExperiencePreset['summary']['quickStarts'],
  ownerRoleId: string | null,
) {
  const title = normalizeText(session.label ?? session.derivedTitle)
  const user = normalizeText(session.displayName)
  const channel = session.channel ?? session.lastChannel ?? ''
  const matches = quickStarts
    .filter((quickStart) => {
      if (ownerRoleId && quickStart.ownerRoleId !== ownerRoleId) return false
      if (channel && quickStart.channel !== channel) return false
      return true
    })
    .map((quickStart) => {
      let score = 0
      if (title !== '' && normalizeText(quickStart.title) === title) score += 3
      if (user !== '' && normalizeText(quickStart.user) === user) score += 2
      if (session.key.includes(slug(quickStart.id))) score += 4
      return { quickStart, score }
    })
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score)

  if (matches.length === 0) return null
  if (matches.length === 1 || matches[0].score > matches[1].score) return matches[0].quickStart
  return null
}

function buildTaskHintCandidates(session: GatewaySessionRow, matchedQuickStartId: string | null): Set<string> {
  const candidates = new Set<string>()
  const values = [
    matchedQuickStartId,
    session.label,
    session.derivedTitle,
    session.displayName,
    session.key,
  ]
  values.forEach((value) => {
    if (!value) return
    const candidate = slug(value)
    if (candidate) candidates.add(candidate)
  })
  return candidates
}

function buildRealizedWorkflowSessions(
  workflowByFrom: Map<string, PresetTeamWorkflowStep[]>,
  ownerRoleId: string | null,
  sessions: GatewaySessionRow[],
  roleIds: string[],
): WorkflowSessionMatch[] {
  if (!ownerRoleId) return []

  const candidates = sessions
    .map((session) => ({ session, parsed: parseSessionKey(session.key, roleIds) }))
    .filter(({ parsed }) => parsed.kind === 'handoff' && parsed.fromRoleId != null && parsed.toRoleId != null)
    .map(({ session, parsed }) => {
      const workflowStep = (workflowByFrom.get(parsed.fromRoleId!) ?? []).find((step) => step.to === parsed.toRoleId)
      return workflowStep ? { workflowStep, session, parsed } : null
    })
    .filter((candidate): candidate is WorkflowSessionMatch => candidate != null)
    .sort((left, right) => (left.session.updatedAt ?? 0) - (right.session.updatedAt ?? 0))

  const reachableRoles = new Set<string>([ownerRoleId])
  const selected: WorkflowSessionMatch[] = []
  let changed = true

  while (changed) {
    changed = false
    candidates.forEach((candidate) => {
      if (selected.some((entry) => entry.session.key === candidate.session.key)) return
      if (!candidate.parsed.fromRoleId || !reachableRoles.has(candidate.parsed.fromRoleId)) return
      selected.push(candidate)
      if (candidate.parsed.toRoleId && !reachableRoles.has(candidate.parsed.toRoleId)) {
        reachableRoles.add(candidate.parsed.toRoleId)
        changed = true
      }
    })
  }

  return selected
}

function buildPendingWorkflowSteps(
  workflowByFrom: Map<string, PresetTeamWorkflowStep[]>,
  frontierRoleIds: string[],
  realizedRoutes: Set<string>,
): PresetTeamWorkflowStep[] {
  const seen = new Set<string>()
  const pending: PresetTeamWorkflowStep[] = []

  frontierRoleIds.forEach((roleId) => {
    ;(workflowByFrom.get(roleId) ?? []).forEach((step) => {
      const routeKey = `${step.from}->${step.to}`
      if (seen.has(routeKey) || realizedRoutes.has(routeKey) || !step.mandatory) return
      seen.add(routeKey)
      pending.push(step)
    })
  })

  return pending
}

function isWorkflowRouteReachable(
  workflowByFrom: Map<string, PresetTeamWorkflowStep[]>,
  ownerRoleId: string | null,
  fromRoleId: string,
  toRoleId: string,
): boolean {
  if (!ownerRoleId) return false

  const visited = new Set<string>([ownerRoleId])
  const queue = [ownerRoleId]

  while (queue.length > 0) {
    const current = queue.shift()!
    const outgoing = workflowByFrom.get(current) ?? []
    for (const step of outgoing) {
      if (step.from === fromRoleId && step.to === toRoleId) return true
      if (!visited.has(step.to)) {
        visited.add(step.to)
        queue.push(step.to)
      }
    }
  }

  return false
}

function resolveFallbackRootSessionKey(
  handoffSession: GatewaySessionRow,
  handoffParsed: ParsedSessionKey,
  rootSessions: Array<{ session: GatewaySessionRow; parsed: ParsedSessionKey }>,
  workflowByFrom: Map<string, PresetTeamWorkflowStep[]>,
): string | null {
  if (!handoffParsed.fromRoleId || !handoffParsed.toRoleId) return null

  const candidateRoots = rootSessions.filter(({ session, parsed }) => {
    if (!isWorkflowRouteReachable(workflowByFrom, parsed.roleId, handoffParsed.fromRoleId!, handoffParsed.toRoleId!)) {
      return false
    }
    return Math.abs((session.updatedAt ?? 0) - (handoffSession.updatedAt ?? 0)) <= 90 * 60_000
  })

  if (candidateRoots.length !== 1) return null
  return candidateRoots[0].session.key
}

function resolveRoleName(roleId: string | null, roleNameById: Map<string, string>, agentNameById: Map<string, string>): string {
  if (!roleId) return '未分配'
  return roleNameById.get(roleId) ?? agentNameById.get(roleId) ?? roleId
}

function resolveRoleLayer(roleId: string | null, layerById: Map<string, PresetLayer>): PresetLayer | null {
  if (!roleId) return null
  return layerById.get(roleId) ?? null
}

function dedupe<T>(items: T[]): T[] {
  return Array.from(new Set(items))
}

function sumUsage(usage: SessionsUsageResult | null, sessionKeys: string[]) {
  const byKey = new Map(
    usage?.sessions.map((entry) => [entry.key, entry.usage?.totals ?? null]) ?? [],
  )

  return sessionKeys.reduce((acc, key) => {
    const totals = byKey.get(key)
    if (!totals) return acc
    acc.totalTokens += totals.totalTokens
    acc.totalCost += totals.totalCost
    return acc
  }, { totalTokens: 0, totalCost: 0 })
}

function buildLatestEvent(logs: LogEntry[], relatedSessionKeys: string[], title: string): string | null {
  const entry = logs.find((log) => relatedSessionKeys.some((key) => log.raw.includes(key)))
  if (entry) return entry.message
  return logs.find((log) => log.message.includes(title))?.message ?? null
}

function findCurrentSession(
  sessions: GatewaySessionRow[],
  steps: TaskStep[],
  approvals: ExecApprovalRequest[],
): GatewaySessionRow | null {
  const waitingStep = steps.find((step) => step.status === 'waiting' || step.status === 'blocked' || step.status === 'running' || step.status === 'failed')
  if (waitingStep?.sessionKey) {
    return sessions.find((session) => session.key === waitingStep.sessionKey) ?? null
  }
  const latestApproval = approvals[0]
  if (latestApproval) {
    return sessions.find((session) => session.key === latestApproval.sessionKey) ?? null
  }
  return sessions[0] ?? null
}

export function buildTrackedTasks({
  experience,
  loadedExperience,
  agents,
  sessions,
  usage,
  approvals,
  logs,
}: TaskTrackerInput): TrackedTask[] {
  const roles = loadedExperience?.roles ?? []
  const roleIds = roles.map((role) => role.manifest.id)
  const roleNameById = new Map(roles.map((role) => [role.manifest.id, role.manifest.name]))
  const layerById = new Map(roles.map((role) => [role.manifest.id, role.manifest.layer]))
  const authorityById = new Map(roles.map((role) => [role.manifest.id, role.authority]))
  const agentNameById = new Map(agents.map((agent) => [agent.id, agent.name ?? agent.identity?.name ?? agent.id]))
  const workflow = loadedExperience?.template.workflow ?? []
  const workflowByFrom = buildWorkflowByFrom(workflow)
  const parsedSessions = sessions
    .filter((session) => session.kind !== 'global')
    .map((session) => ({ session, parsed: parseSessionKey(session.key, roleIds) }))
  const rootSessions = parsedSessions.filter(({ parsed }) => parsed.kind !== 'handoff')
  const quickStarts = loadedExperience?.summary.quickStarts ?? []

  const tasks = rootSessions.map(({ session: rootSession, parsed }) => {
    const ownerRoleId = parsed.roleId
    const matchedQuickStart = matchQuickStart(rootSession, quickStarts, ownerRoleId)
    const taskId = rootSession.key
    const hintCandidates = buildTaskHintCandidates(rootSession, matchedQuickStart?.id ?? null)
    const relatedHandoffSessions = parsedSessions
      .filter(({ parsed: candidate }) => candidate.kind === 'handoff')
      .filter(({ session, parsed: candidate }) => {
        if (!candidate.toRoleId || !candidate.fromRoleId) return false
        const onTaskPath = isWorkflowRouteReachable(workflowByFrom, ownerRoleId, candidate.fromRoleId, candidate.toRoleId)
        if (!onTaskPath) return false
        if (candidate.taskHint) return hintCandidates.has(slug(candidate.taskHint))
        if (rootSessions.length === 1) return true
        return resolveFallbackRootSessionKey(session, candidate, rootSessions, workflowByFrom) === rootSession.key
      })
      .map(({ session }) => session)

    const relatedSessions = [rootSession, ...relatedHandoffSessions]
      .sort((left, right) => (right.updatedAt ?? 0) - (left.updatedAt ?? 0))
    const relatedSessionKeys = dedupe(relatedSessions.map((session) => session.key))
    const relevantApprovals = approvals
      .filter((approval) => relatedSessionKeys.includes(approval.sessionKey))
      .sort((left, right) => right.ts - left.ts)

    const usageTotals = sumUsage(usage, relatedSessionKeys)
    const sessionByKey = new Map(relatedSessions.map((session) => [session.key, session]))
    const realizedWorkflowSessions = buildRealizedWorkflowSessions(workflowByFrom, ownerRoleId, relatedHandoffSessions, roleIds)
    const realizedRoutes = new Set(
      realizedWorkflowSessions
        .filter((entry) => entry.parsed.fromRoleId && entry.parsed.toRoleId)
        .map((entry) => `${entry.parsed.fromRoleId}->${entry.parsed.toRoleId}`),
    )

    const allTimestamps = relatedSessions
      .map((session) => session.updatedAt ?? 0)
      .filter((value) => value > 0)
    const startedAt = allTimestamps.length > 0 ? Math.min(...allTimestamps) : Date.now()
    const updatedAt = allTimestamps.length > 0 ? Math.max(...allTimestamps) : Date.now()

    const steps: TaskStep[] = []
    const rootTotals = usage?.sessions.find((entry) => entry.key === rootSession.key)?.usage?.totals
    const rootApproval = relevantApprovals.find((approval) => approval.sessionKey === rootSession.key)
    steps.push({
      id: `${taskId}-owner`,
      roleId: ownerRoleId ?? rootSession.key,
      agentId: ownerRoleId ?? rootSession.key,
      agentName: resolveRoleName(ownerRoleId, roleNameById, agentNameById),
      layer: resolveRoleLayer(ownerRoleId, layerById),
      fromRoleId: null,
      sessionKey: rootSession.key,
      startedAt,
      updatedAt: rootSession.updatedAt ?? updatedAt,
      status: rootApproval
        ? 'waiting'
        : rootSession.abortedLastRun
          ? 'failed'
          : rootSession.sendPolicy === 'deny'
            ? 'blocked'
            : realizedWorkflowSessions.length > 0
              ? 'completed'
              : 'running',
      note: rootSession.lastMessagePreview ?? matchedQuickStart?.outcome ?? '任务已进入编排网络。',
      mandatory: false,
      totalTokens: rootTotals?.totalTokens ?? rootSession.totalTokens ?? 0,
      totalCost: rootTotals?.totalCost ?? 0,
    })

    realizedWorkflowSessions.forEach(({ workflowStep, session, parsed: realizedKey }) => {
      const approval = relevantApprovals.find((item) => item.sessionKey === session.key)
      const usageEntry = usage?.sessions.find((entry) => entry.key === session.key)?.usage?.totals
      const hasDownstreamRealized = realizedWorkflowSessions.some((candidate) => {
        if (!candidate.parsed.fromRoleId || !realizedKey.toRoleId) return false
        return candidate.parsed.fromRoleId === realizedKey.toRoleId && (candidate.session.updatedAt ?? 0) >= (session.updatedAt ?? 0)
      })

      steps.push({
        id: `${taskId}-${workflowStep.from}-${workflowStep.to}`,
        roleId: workflowStep.to,
        agentId: workflowStep.to,
        agentName: resolveRoleName(workflowStep.to, roleNameById, agentNameById),
        layer: resolveRoleLayer(workflowStep.to, layerById),
        fromRoleId: workflowStep.from,
        sessionKey: session.key,
        startedAt: session.updatedAt ?? updatedAt,
        updatedAt: session.updatedAt ?? updatedAt,
        status: approval
          ? 'waiting'
          : session.abortedLastRun
            ? 'failed'
            : session.sendPolicy === 'deny'
              ? 'blocked'
              : hasDownstreamRealized
                ? 'completed'
                : 'running',
        note: approval?.description ?? session.lastMessagePreview ?? workflowStep.condition,
        mandatory: workflowStep.mandatory,
        totalTokens: usageEntry?.totalTokens ?? session.totalTokens ?? 0,
        totalCost: usageEntry?.totalCost ?? 0,
      })
    })

    const frontierRoleIds = dedupe(
      steps
        .filter((step) => step.status === 'running' || step.status === 'completed')
        .map((step) => step.roleId),
    )
    const pendingWorkflowSteps = buildPendingWorkflowSteps(workflowByFrom, frontierRoleIds, realizedRoutes)
    pendingWorkflowSteps.forEach((workflowStep) => {
      steps.push({
        id: `${taskId}-${workflowStep.from}-${workflowStep.to}-pending`,
        roleId: workflowStep.to,
        agentId: workflowStep.to,
        agentName: resolveRoleName(workflowStep.to, roleNameById, agentNameById),
        layer: resolveRoleLayer(workflowStep.to, layerById),
        fromRoleId: workflowStep.from,
        startedAt: updatedAt,
        updatedAt,
        status: 'pending',
        note: workflowStep.condition,
        mandatory: workflowStep.mandatory,
        totalTokens: 0,
        totalCost: 0,
      })
    })

    const latestOpenStep = [...steps]
      .filter((step) => ['running', 'waiting', 'blocked', 'failed'].includes(step.status))
      .sort((left, right) => right.updatedAt - left.updatedAt)[0] ?? null
    const latestTouchedStep = [...steps]
      .sort((left, right) => right.updatedAt - left.updatedAt)[0] ?? null
    const latestStepUpdatedAt = latestOpenStep?.updatedAt ?? latestTouchedStep?.updatedAt ?? updatedAt
    const hasPendingApprovals = relevantApprovals.length > 0
    const currentSession = latestOpenStep?.sessionKey ? sessionByKey.get(latestOpenStep.sessionKey) ?? null : null
    const now = Date.now()
    const completionThreshold = 8 * 60_000
    const staleThreshold = 45 * 60_000

    let status: TaskStatus
    if (steps.some((step) => step.status === 'failed')) {
      status = 'failed'
    } else if (steps.some((step) => step.status === 'blocked') || currentSession?.sendPolicy === 'deny') {
      status = 'blocked'
    } else if (hasPendingApprovals || steps.some((step) => step.status === 'waiting')) {
      status = 'waiting'
    } else if (pendingWorkflowSteps.length === 0 && now - latestStepUpdatedAt > completionThreshold) {
      status = 'completed'
    } else if (now - latestStepUpdatedAt > staleThreshold) {
      status = 'stalled'
    } else {
      status = 'active'
    }

    if (status === 'completed') {
      steps.forEach((step) => {
        if (step.status === 'running') step.status = 'completed'
      })
    }

    const currentStep = [...steps]
      .filter((step) => ['running', 'waiting', 'blocked', 'failed'].includes(step.status))
      .sort((left, right) => right.updatedAt - left.updatedAt)[0]
      ?? (status === 'completed'
        ? [...steps].sort((left, right) => right.updatedAt - left.updatedAt)[0]
        : null)
    const currentRoleId = currentStep?.roleId ?? null
    const currentLayer = currentStep?.layer ?? null

    const currentSessionForTask = findCurrentSession(relatedSessions, steps, relevantApprovals)
    const currentRoleName = resolveRoleName(currentRoleId, roleNameById, agentNameById)
    const latestEvent = buildLatestEvent(logs, relatedSessionKeys, rootSession.label ?? matchedQuickStart?.title ?? rootSession.key)
    const currentAuthority = currentRoleId ? authorityById.get(currentRoleId) : null

    return {
      id: taskId,
      title: rootSession.label ?? rootSession.derivedTitle ?? matchedQuickStart?.title ?? rootSession.key,
      summary: latestEvent ?? currentSessionForTask?.lastMessagePreview ?? matchedQuickStart?.outcome ?? '正在进行跨角色协同。',
      status,
      startedAt,
      updatedAt,
      durationMs: Math.max(1, updatedAt - startedAt),
      originChannel: rootSession.channel ?? rootSession.lastChannel ?? matchedQuickStart?.channel ?? 'api',
      originUser: rootSession.displayName ?? matchedQuickStart?.user ?? 'Operator',
      rootSessionKey: rootSession.key,
      currentSessionKey: currentSessionForTask?.key ?? null,
      currentAgentId: currentRoleId,
      currentAgentName: currentRoleId ? currentRoleName : null,
      currentLayer,
      currentSendPolicy: currentSessionForTask?.sendPolicy ?? null,
      ownerRoleId,
      ownerRoleName: ownerRoleId ? resolveRoleName(ownerRoleId, roleNameById, agentNameById) : null,
      entryNodeId: matchedQuickStart?.id ?? null,
      steps,
      pendingApprovals: relevantApprovals,
      relatedSessionKeys,
      totalTokens: usageTotals.totalTokens || relatedSessions.reduce((sum, session) => sum + (session.totalTokens ?? 0), 0),
      totalCost: usageTotals.totalCost,
      latestEvent,
      recommendedTargets: dedupe(currentAuthority?.escalateTo.filter((roleId) => roleNameById.has(roleId)) ?? []),
    } satisfies TrackedTask
  })

  return tasks.sort((left, right) => {
    const statusDiff = statusPriority[left.status] - statusPriority[right.status]
    if (statusDiff !== 0) return statusDiff
    return right.updatedAt - left.updatedAt
  })
}

export function summarizeTrackedTasks(tasks: TrackedTask[]): TaskTrackerSummary {
  const ages = tasks
    .filter((task) => task.status !== 'completed')
    .map((task) => task.durationMs)

  return {
    total: tasks.length,
    active: tasks.filter((task) => task.status === 'active').length,
    waiting: tasks.filter((task) => task.status === 'waiting').length,
    completed: tasks.filter((task) => task.status === 'completed').length,
    stalled: tasks.filter((task) => task.status === 'stalled').length,
    failed: tasks.filter((task) => task.status === 'failed').length,
    blocked: tasks.filter((task) => task.status === 'blocked').length,
    pendingApprovals: tasks.reduce((sum, task) => sum + task.pendingApprovals.length, 0),
    medianAgeMs: median(ages),
  }
}

export function buildRoleLoadMap(tasks: TrackedTask[]): Map<string, RoleLoadInfo> {
  const result = new Map<string, RoleLoadInfo>()

  const ensureRole = (roleId: string) => {
    if (!result.has(roleId)) {
      result.set(roleId, {
        activeTasks: 0,
        waitingTasks: 0,
        blockedTasks: 0,
        completedTasks: 0,
        failedTasks: 0,
        pendingApprovals: 0,
      })
    }
    return result.get(roleId)!
  }

  tasks.forEach((task) => {
    task.steps.forEach((step) => {
      const info = ensureRole(step.roleId)
      if (step.status === 'running') info.activeTasks += 1
      if (step.status === 'waiting') info.waitingTasks += 1
      if (step.status === 'blocked') info.blockedTasks += 1
      if (step.status === 'completed') info.completedTasks += 1
      if (step.status === 'failed') info.failedTasks += 1
    })
    task.pendingApprovals.forEach((approval) => {
      if (!approval.agentId) return
      ensureRole(approval.agentId).pendingApprovals += 1
    })
  })

  return result
}
