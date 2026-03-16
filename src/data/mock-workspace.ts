import type {
  AgentSummary,
  AgentsCreateParams,
  AgentsDeleteParams,
  AgentsFileEntry,
  AgentsUpdateParams,
  ChannelAccountSnapshot,
  ChannelsStatusResult,
  CronJob,
  CronRunLogEntry,
  ExecApprovalRequest,
  GatewaySessionRow,
  LogEntry,
  ModelChoice,
  NodeListNode,
  PresenceEntry,
  SessionsListResult,
  SessionsPatchParams,
  SessionsUsageResult,
  SkillEntry,
  Snapshot,
} from '../types/openclaw'
import {
  mockAgents,
  mockChannelsStatus,
  mockConfig,
  mockCronJobs,
  mockCronRuns,
  mockExecApprovals,
  mockLogs,
  mockModels,
  mockNodes,
  mockPresence,
  mockSessionsList,
  mockSkills,
  mockSnapshot,
  mockUsage,
} from './mock'

const STORAGE_KEY = 'claw-ops-mock-workspace-v2'

type LayerId = 'L0' | 'L1' | 'L2' | 'L3'

export interface MockQuickStartSummary {
  id: string
  title: string
  user: string
  channel: string
  prompt: string
}

export interface MockExperienceSummary {
  id: string
  name: string
  tagline: string
  description: string
  templateId: string
  roleIds: string[]
  quickStarts: MockQuickStartSummary[]
  quickStartCount: number
  layerCounts: Record<LayerId, number>
  handoffCount: number
  channelIds: string[]
  importedAtMs: number
}

export interface MockWorkspaceSeed {
  agents: AgentSummary[]
  agentFiles?: Record<string, Record<string, string>>
  sessionsList: SessionsListResult
  usage: SessionsUsageResult
  channelsStatus: ChannelsStatusResult
  cronJobs?: CronJob[]
  cronRuns?: CronRunLogEntry[]
  logs?: LogEntry[]
  skills?: SkillEntry[]
  nodes?: NodeListNode[]
  config?: Record<string, unknown>
  execApprovals?: ExecApprovalRequest[]
  presence?: PresenceEntry[]
  snapshot?: Snapshot
  experience?: MockExperienceSummary | null
}

interface MockWorkspaceState {
  agents: AgentSummary[]
  agentFiles: Record<string, Record<string, string>>
  sessionsList: SessionsListResult
  usage: SessionsUsageResult
  channelsStatus: ChannelsStatusResult
  cronJobs: CronJob[]
  cronRuns: CronRunLogEntry[]
  logs: LogEntry[]
  models: ModelChoice[]
  skills: SkillEntry[]
  nodes: NodeListNode[]
  config: Record<string, unknown>
  execApprovals: ExecApprovalRequest[]
  presence: PresenceEntry[]
  snapshot: Snapshot
  experience: MockExperienceSummary | null
}

function clone<T>(value: T): T {
  if (typeof globalThis.structuredClone === 'function') {
    return globalThis.structuredClone(value)
  }
  return JSON.parse(JSON.stringify(value)) as T
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function workspaceSuffix(workspace?: string): string | null {
  if (!workspace) return null
  const segments = workspace.split(/[\\/]/).filter(Boolean)
  const last = segments[segments.length - 1]
  return last ? slugify(last) : null
}

function uniqueAgentId(candidate: string, agents: AgentSummary[]): string {
  const normalized = candidate || `agent-${agents.length + 1}`
  if (!agents.some((agent) => agent.id === normalized)) return normalized

  let seq = 2
  while (agents.some((agent) => agent.id === `${normalized}-${seq}`)) {
    seq += 1
  }
  return `${normalized}-${seq}`
}

function detectSessionAgent(session: GatewaySessionRow, agents: AgentSummary[]): AgentSummary | undefined {
  return agents.find((agent) => session.key.includes(agent.id))
}

function buildDailyUsage(totalTokens: number, totalCost: number, totalCalls: number) {
  const days = 14
  const today = new Date()
  const weights = [0.52, 0.58, 0.63, 0.68, 0.74, 0.8, 0.9, 0.86, 0.78, 0.71, 0.67, 0.72, 0.84, 0.95]
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0)

  return Array.from({ length: days }, (_, index) => {
    const d = new Date(today)
    d.setDate(today.getDate() - (days - index - 1))
    const share = weights[index] / weightSum
    const tokens = Math.max(1200, Math.round(totalTokens * share))
    const calls = Math.max(2, Math.round(totalCalls * share))
    return {
      date: d.toISOString().slice(0, 10),
      tokens,
      cost: +(totalCost * share).toFixed(4),
      messages: Math.max(3, calls),
      toolCalls: Math.max(1, Math.round(calls * 0.45)),
      errors: index % 6 === 0 ? 1 : 0,
    }
  })
}

export function deriveUsageFromSessions(
  sessions: GatewaySessionRow[],
  agents: AgentSummary[],
  previousDaily?: SessionsUsageResult['aggregates']['daily'],
): SessionsUsageResult {
  const sessionUsageEntries = sessions.map((session) => {
    const totalTokens = session.totalTokens ?? 0
    const inputTokens = session.inputTokens ?? Math.round(totalTokens * 0.42)
    const outputTokens = session.outputTokens ?? Math.max(0, totalTokens - inputTokens)
    const calls = Math.max(2, Math.round(totalTokens / 3200) || 0)
    const errors = session.abortedLastRun ? 1 : 0

    return {
      key: session.key,
      label: session.label,
      updatedAt: session.updatedAt ?? undefined,
      agentId: detectSessionAgent(session, agents)?.id,
      channel: session.channel,
      modelProvider: session.modelProvider,
      model: session.model,
      usage: {
        totals: {
          inputTokens,
          outputTokens,
          totalTokens,
          totalCost: +(totalTokens * 0.000015).toFixed(4),
          calls,
          errors,
          toolCalls: Math.max(1, Math.round(calls * 0.4)),
        },
      },
    }
  })

  const totals = sessionUsageEntries.reduce((acc, entry) => {
    const entryTotals = entry.usage?.totals
    if (!entryTotals) return acc
    acc.inputTokens += entryTotals.inputTokens
    acc.outputTokens += entryTotals.outputTokens
    acc.totalTokens += entryTotals.totalTokens
    acc.totalCost += entryTotals.totalCost
    acc.calls += entryTotals.calls
    acc.errors += entryTotals.errors
    acc.toolCalls += entryTotals.toolCalls ?? 0
    return acc
  }, {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    totalCost: 0,
    calls: 0,
    errors: 0,
    toolCalls: 0,
  })

  const byModel = new Map<string, { count: number; totals: SessionsUsageResult['totals'] }>()
  const byProvider = new Map<string, { count: number; totals: SessionsUsageResult['totals'] }>()
  const byAgent = new Map<string, SessionsUsageResult['totals']>()
  const byChannel = new Map<string, SessionsUsageResult['totals']>()

  const emptyTotals = () => ({
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    totalCost: 0,
    calls: 0,
    errors: 0,
    toolCalls: 0,
  })

  const mergeTotals = (target: SessionsUsageResult['totals'], source: SessionsUsageResult['totals']) => {
    target.inputTokens += source.inputTokens
    target.outputTokens += source.outputTokens
    target.totalTokens += source.totalTokens
    target.totalCost += source.totalCost
    target.calls += source.calls
    target.errors += source.errors
    target.toolCalls = (target.toolCalls ?? 0) + (source.toolCalls ?? 0)
  }

  sessionUsageEntries.forEach((entry) => {
    const usage = entry.usage?.totals
    if (!usage) return

    if (entry.model) {
      const existing = byModel.get(entry.model) ?? { count: 0, totals: emptyTotals() }
      existing.count += 1
      mergeTotals(existing.totals, usage)
      byModel.set(entry.model, existing)
    }

    if (entry.modelProvider) {
      const existing = byProvider.get(entry.modelProvider) ?? { count: 0, totals: emptyTotals() }
      existing.count += 1
      mergeTotals(existing.totals, usage)
      byProvider.set(entry.modelProvider, existing)
    }

    if (entry.agentId) {
      const existing = byAgent.get(entry.agentId) ?? emptyTotals()
      mergeTotals(existing, usage)
      byAgent.set(entry.agentId, existing)
    }

    if (entry.channel) {
      const existing = byChannel.get(entry.channel) ?? emptyTotals()
      mergeTotals(existing, usage)
      byChannel.set(entry.channel, existing)
    }
  })

  agents.forEach((agent) => {
    if (!byAgent.has(agent.id)) byAgent.set(agent.id, emptyTotals())
  })

  const daily = previousDaily && previousDaily.length > 0
    ? previousDaily
    : buildDailyUsage(totals.totalTokens, totals.totalCost, totals.calls)

  return {
    updatedAt: Date.now(),
    startDate: daily[0]?.date ?? new Date().toISOString().slice(0, 10),
    endDate: daily[daily.length - 1]?.date ?? new Date().toISOString().slice(0, 10),
    sessions: sessionUsageEntries,
    totals: {
      ...totals,
      totalCost: +totals.totalCost.toFixed(4),
      cacheReadTokens: Math.round(totals.totalTokens * 0.07),
      cacheWriteTokens: Math.round(totals.totalTokens * 0.02),
      reasoningTokens: Math.round(totals.totalTokens * 0.12),
    },
    aggregates: {
      messages: {
        inbound: Math.max(0, Math.round(totals.calls * 0.48)),
        outbound: Math.max(0, Math.round(totals.calls * 0.52)),
        total: totals.calls,
      },
      tools: {
        calls: totals.toolCalls,
        errors: totals.errors,
      },
      byModel: Array.from(byModel.entries()).map(([model, data]) => ({
        model,
        count: data.count,
        totals: { ...data.totals, totalCost: +data.totals.totalCost.toFixed(4) },
      })),
      byProvider: Array.from(byProvider.entries()).map(([provider, data]) => ({
        provider,
        count: data.count,
        totals: { ...data.totals, totalCost: +data.totals.totalCost.toFixed(4) },
      })),
      byAgent: Array.from(byAgent.entries()).map(([agentId, data]) => ({
        agentId,
        totals: { ...data, totalCost: +data.totalCost.toFixed(4) },
      })),
      byChannel: Array.from(byChannel.entries()).map(([channel, data]) => ({
        channel,
        totals: { ...data, totalCost: +data.totalCost.toFixed(4) },
      })),
      daily,
    },
  }
}

function createDefaultWorkspace(): MockWorkspaceState {
  return syncWorkspaceState({
    agents: clone(mockAgents),
    agentFiles: {},
    sessionsList: clone(mockSessionsList),
    usage: clone(mockUsage),
    channelsStatus: clone(mockChannelsStatus),
    cronJobs: clone(mockCronJobs),
    cronRuns: clone(mockCronRuns),
    logs: clone(mockLogs),
    models: clone(mockModels),
    skills: clone(mockSkills),
    nodes: clone(mockNodes),
    config: clone(mockConfig),
    execApprovals: clone(mockExecApprovals),
    presence: clone(mockPresence),
    snapshot: clone(mockSnapshot),
    experience: null,
  })
}

let cachedWorkspace: MockWorkspaceState | null = null

function persistWorkspace(state: MockWorkspaceState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (error) {
    console.warn('Failed to persist mock workspace', error)
  }
}

function syncWorkspaceState(state: MockWorkspaceState): MockWorkspaceState {
  state.sessionsList.count = state.sessionsList.sessions.length
  state.sessionsList.ts = Date.now()
  state.usage = deriveUsageFromSessions(state.sessionsList.sessions, state.agents, state.usage.aggregates.daily)

  const channelIds = state.channelsStatus.channelOrder
  state.config = {
    ...state.config,
    agents: state.agents.map((agent) => ({
      id: agent.id,
      name: agent.name,
      emoji: agent.identity?.emoji,
      theme: agent.identity?.theme,
    })),
    channels: channelIds.reduce<Record<string, { enabled: boolean }>>((acc, channelId) => {
      acc[channelId] = { enabled: true }
      return acc
    }, {}),
    experience: state.experience ?? undefined,
  }

  const activeRuns = Object.values(state.channelsStatus.channelAccounts)
    .flat()
    .reduce((sum, account) => sum + (account.activeRuns ?? 0), 0)

  state.snapshot = {
    ...state.snapshot,
    presence: state.presence,
    health: {
      ...(state.snapshot.health ?? {}),
      ok: true,
      services: {
        gateway: 'ok',
        agents: state.agents.length > 0 ? 'ok' : 'idle',
        channels: channelIds.length > 0 ? 'ok' : 'idle',
      },
      orchestration: state.experience
        ? {
            templateId: state.experience.templateId,
            importedAtMs: state.experience.importedAtMs,
            activeRuns,
          }
        : undefined,
    },
    sessionDefaults: {
      defaultAgentId: state.agents[0]?.id ?? 'default',
      mainKey: 'sess-main',
      mainSessionKey: 'main',
      scope: 'operator.read',
    },
  }

  return state
}

function ensureWorkspace(): MockWorkspaceState {
  if (cachedWorkspace) return cachedWorkspace

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      cachedWorkspace = syncWorkspaceState(JSON.parse(raw) as MockWorkspaceState)
      return cachedWorkspace
    }
  } catch (error) {
    console.warn('Failed to restore mock workspace', error)
  }

  cachedWorkspace = createDefaultWorkspace()
  return cachedWorkspace
}

function commitWorkspace(mutate: (workspace: MockWorkspaceState) => void): MockWorkspaceState {
  const workspace = ensureWorkspace()
  mutate(workspace)
  const synced = syncWorkspaceState(workspace)
  cachedWorkspace = synced
  persistWorkspace(synced)
  return synced
}

function upsertAccountActivity(accounts: Record<string, ChannelAccountSnapshot[]>, channelId: string) {
  const channelAccounts = accounts[channelId]
  if (!channelAccounts || channelAccounts.length === 0) return
  channelAccounts[0] = {
    ...channelAccounts[0],
    connected: true,
    running: true,
    enabled: true,
    configured: true,
    linked: true,
    activeRuns: clamp((channelAccounts[0].activeRuns ?? 0) + 1, 1, 9),
    lastInboundAt: Date.now(),
    lastOutboundAt: Date.now(),
  }
}

export function peekMockWorkspace(): MockWorkspaceState {
  return ensureWorkspace()
}

export function resetMockWorkspace(): MockWorkspaceState {
  cachedWorkspace = createDefaultWorkspace()
  persistWorkspace(cachedWorkspace)
  return cachedWorkspace
}

export function applyMockWorkspaceSeed(seed: MockWorkspaceSeed): MockWorkspaceState {
  const next = createDefaultWorkspace()
  next.agents = clone(seed.agents)
  next.agentFiles = clone(seed.agentFiles ?? {})
  next.sessionsList = clone(seed.sessionsList)
  next.usage = clone(seed.usage)
  next.channelsStatus = clone(seed.channelsStatus)
  next.cronJobs = clone(seed.cronJobs ?? next.cronJobs)
  next.cronRuns = clone(seed.cronRuns ?? next.cronRuns)
  next.logs = clone(seed.logs ?? next.logs)
  next.skills = clone(seed.skills ?? next.skills)
  next.nodes = clone(seed.nodes ?? next.nodes)
  next.config = { ...next.config, ...(seed.config ?? {}) }
  next.execApprovals = clone(seed.execApprovals ?? next.execApprovals)
  next.presence = clone(seed.presence ?? next.presence)
  next.snapshot = clone(seed.snapshot ?? next.snapshot)
  next.experience = seed.experience ?? null

  cachedWorkspace = syncWorkspaceState(next)
  persistWorkspace(cachedWorkspace)
  return cachedWorkspace
}

export function getMockSnapshot(): Snapshot {
  return clone(ensureWorkspace().snapshot)
}

export function getMockPresence(): PresenceEntry[] {
  return clone(ensureWorkspace().presence)
}

export function getMockAgents(): AgentSummary[] {
  return clone(ensureWorkspace().agents)
}

export function getMockSessionsList(): SessionsListResult {
  return clone(ensureWorkspace().sessionsList)
}

export function getMockUsage(): SessionsUsageResult {
  return clone(ensureWorkspace().usage)
}

export function getMockChannelsStatus(): ChannelsStatusResult {
  return clone(ensureWorkspace().channelsStatus)
}

export function getMockCronJobs(): CronJob[] {
  return clone(ensureWorkspace().cronJobs)
}

export function getMockCronRuns(): CronRunLogEntry[] {
  return clone(ensureWorkspace().cronRuns)
}

export function getMockLogs(): LogEntry[] {
  return clone(ensureWorkspace().logs)
}

export function getMockModels(): ModelChoice[] {
  return clone(ensureWorkspace().models)
}

export function getMockSkills(): SkillEntry[] {
  return clone(ensureWorkspace().skills)
}

export function getMockNodes(): NodeListNode[] {
  return clone(ensureWorkspace().nodes)
}

export function getMockConfig(): Record<string, unknown> {
  return clone(ensureWorkspace().config)
}

export function getMockExecApprovals(): ExecApprovalRequest[] {
  return clone(ensureWorkspace().execApprovals)
}

export function createMockAgent(params: AgentsCreateParams): { agentId: string } {
  let agentId = ''

  commitWorkspace((workspace) => {
    const preferredId = workspaceSuffix(params.workspace) ?? slugify(params.name)
    agentId = uniqueAgentId(preferredId, workspace.agents)
    workspace.agents.push({
      id: agentId,
      name: params.name,
      identity: {
        name: params.name,
        emoji: '🤖',
      },
    })
    workspace.agentFiles[agentId] = workspace.agentFiles[agentId] ?? {}
  })

  return { agentId }
}

export function updateMockAgent(params: AgentsUpdateParams): void {
  commitWorkspace((workspace) => {
    workspace.agents = workspace.agents.map((agent) => {
      if (agent.id !== params.agentId) return agent
      return {
        ...agent,
        name: params.name ?? agent.name,
        identity: {
          ...agent.identity,
          name: params.name ?? agent.identity?.name ?? agent.name,
          emoji: params.emoji ?? agent.identity?.emoji,
          avatar: params.avatar ?? agent.identity?.avatar,
        },
      }
    })
  })
}

export function deleteMockAgent(params: AgentsDeleteParams): void {
  commitWorkspace((workspace) => {
    workspace.agents = workspace.agents.filter((agent) => agent.id !== params.agentId)
    delete workspace.agentFiles[params.agentId]
    workspace.sessionsList.sessions = workspace.sessionsList.sessions.filter((session) => !session.key.includes(params.agentId))
    workspace.execApprovals = workspace.execApprovals.filter((approval) => approval.agentId !== params.agentId)
  })
}

export function listMockAgentFiles(agentId: string): AgentsFileEntry[] {
  const files = ensureWorkspace().agentFiles[agentId] ?? {}
  return Object.entries(files).map(([path, content]) => ({
    path,
    size: content.length,
    updatedAt: Date.now(),
  }))
}

export function getMockAgentFile(agentId: string, path: string): string {
  return ensureWorkspace().agentFiles[agentId]?.[path] ?? ''
}

export function setMockAgentFile(agentId: string, path: string, content: string): void {
  commitWorkspace((workspace) => {
    workspace.agentFiles[agentId] = workspace.agentFiles[agentId] ?? {}
    workspace.agentFiles[agentId][path] = content
  })
}

export function installMockSkill(skillId: string): void {
  commitWorkspace((workspace) => {
    const existing = workspace.skills.find((skill) => skill.name === skillId)
    if (existing) {
      existing.status = 'installed'
      return
    }
    workspace.skills.push({
      name: skillId,
      version: '0.1.0',
      status: 'installed',
      description: '由预设团队自动安装',
    })
  })
}

export function patchMockSession(params: SessionsPatchParams): void {
  commitWorkspace((workspace) => {
    workspace.sessionsList.sessions = workspace.sessionsList.sessions.map((session) => {
      if (session.key !== params.key) return session
      return {
        ...session,
        label: params.label === null ? undefined : (params.label ?? session.label),
        thinkingLevel: params.thinkingLevel === null ? undefined : (params.thinkingLevel ?? session.thinkingLevel),
        verboseLevel: params.verboseLevel === null ? undefined : (params.verboseLevel ?? session.verboseLevel),
        reasoningLevel: params.reasoningLevel === null ? undefined : (params.reasoningLevel ?? session.reasoningLevel),
        responseUsage: params.responseUsage === null ? undefined : (params.responseUsage ?? session.responseUsage),
        elevatedLevel: params.elevatedLevel === null ? undefined : (params.elevatedLevel ?? session.elevatedLevel),
        model: params.model === null ? undefined : (params.model ?? session.model),
        sendPolicy: params.sendPolicy === null ? undefined : (params.sendPolicy ?? session.sendPolicy),
        updatedAt: Date.now(),
      }
    })
  })
}

export function resetMockSession(key: string): void {
  commitWorkspace((workspace) => {
    workspace.sessionsList.sessions = workspace.sessionsList.sessions.map((session) => {
      if (session.key !== key) return session
      return {
        ...session,
        updatedAt: Date.now(),
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        lastMessagePreview: '会话已重置，等待新的编排任务',
      }
    })
  })
}

export function deleteMockSession(key: string): void {
  commitWorkspace((workspace) => {
    workspace.sessionsList.sessions = workspace.sessionsList.sessions.filter((session) => session.key !== key)
  })
}

export function addMockLog(entry: LogEntry): void {
  commitWorkspace((workspace) => {
    workspace.logs = [entry, ...workspace.logs].slice(0, 200)
  })
}

export function bumpMockChannelActivity(channelId: string): void {
  commitWorkspace((workspace) => {
    upsertAccountActivity(workspace.channelsStatus.channelAccounts, channelId)
  })
}
