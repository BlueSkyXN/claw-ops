// API 层 — 统一数据获取接口
// 根据配置自动切换 Mock 数据 / OpenClaw Gateway WebSocket JSON-RPC

import { loadConfig, usesBridgeTransport, usesGatewayTransport } from './config'
import { ensureGatewayClientReady } from './gateway-client'
import { bridgeRpc, getBridgeHealth } from './bridge-client'
import type {
  AgentSummary,
  AgentsListResult,
  AgentsFileEntry,
  SessionsListParams,
  SessionsListResult,
  UsageCostParams,
  UsageCostSummary,
  SessionsUsageParams,
  SessionsUsageResult,
  ChannelsStatusResult,
  CronJob,
  CronRunLogEntry,
  CronAddParams,
  CronUpdateParams,
  CronRemoveParams,
  CronRunParams,
  CronRunsParams,
  ChatSendParams,
  ChatSendResult,
  ChatMessage,
  LogEntry,
  LogsTailParams,
  LogsTailResult,
  ModelChoice,
  SkillEntry,
  NodeListNode,
  Snapshot,
  PresenceEntry,
  SessionsPatchParams,
  AgentsCreateParams,
  AgentsUpdateParams,
  AgentsDeleteParams,
  ExecApprovalRequest,
} from '../types/openclaw'
import { GATEWAY_METHODS } from '../types/openclaw'
import * as mockWorkspace from '../data/mock-workspace'
import {
  normalizeChannelsStatusResult,
  normalizeSessionsUsageResult,
  normalizeUsageCostSummary,
} from './openclaw-normalizers'
import { buildUsageCostSummary } from './usage'

function getAPIErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
    return err.message
  }
  return String(err)
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function isMissingScopeError(err: unknown, scopes?: string | string[]): boolean {
  const message = getAPIErrorMessage(err)
  if (!/missing scope:/i.test(message)) return false
  if (!scopes) return true
  const expected = Array.isArray(scopes) ? scopes : [scopes]
  return expected.some((scope) => new RegExp(`missing scope:\\s*${escapeRegExp(scope)}`, 'i').test(message))
}

function toUsageDateKey(ts: number | null | undefined, params?: Pick<SessionsUsageParams, 'mode' | 'utcOffset'>): string {
  if (!ts) return ''

  if (params?.mode === 'utc') {
    return new Date(ts).toISOString().slice(0, 10)
  }

  if (params?.mode === 'specific' && params.utcOffset) {
    const match = params.utcOffset.match(/^UTC([+-])(\d{1,2})(?::?(\d{2}))?$/i)
    if (match) {
      const sign = match[1] === '-' ? -1 : 1
      const hours = Number.parseInt(match[2], 10)
      const minutes = Number.parseInt(match[3] ?? '0', 10)
      const offsetMinutes = sign * (hours * 60 + minutes)
      return new Date(ts + offsetMinutes * 60_000).toISOString().slice(0, 10)
    }
  }

  const localDate = new Date(ts)
  const year = localDate.getFullYear()
  const month = `${localDate.getMonth() + 1}`.padStart(2, '0')
  const day = `${localDate.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function applyUsageWindow<T extends SessionsUsageParams | UsageCostParams | undefined>(params: T): T {
  if (!params || !('days' in params) || typeof params.days !== 'number' || params.startDate || params.endDate) {
    return params
  }
  const end = new Date()
  const start = new Date()
  start.setDate(end.getDate() - Math.max(0, params.days - 1))
  return {
    ...params,
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  } as T
}

function filterSessionsForUsage(sessions: SessionsListResult['sessions'], params?: SessionsUsageParams): SessionsListResult['sessions'] {
  const normalized = applyUsageWindow(params)

  return sessions.filter((session) => {
    if (normalized?.key && session.key !== normalized.key) return false

    const dateKey = toUsageDateKey(session.updatedAt, normalized)
    if (normalized?.startDate && dateKey && dateKey < normalized.startDate) return false
    if (normalized?.endDate && dateKey && dateKey > normalized.endDate) return false

    return true
  })
}

function normalizeGatewayChatSendParams(params: ChatSendParams): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries({
      sessionKey: params.sessionKey,
      message: params.message,
      thinking: params.thinking,
      deliver: params.deliver,
      attachments: params.attachments?.length ? params.attachments : undefined,
      timeoutMs: params.timeoutMs,
      systemInputProvenance: params.systemInputProvenance,
      systemProvenanceReceipt: params.systemProvenanceReceipt,
      idempotencyKey: params.idempotencyKey,
    }).filter(([, value]) => value != null),
  )
}

function normalizeBridgeChatSendParams(params: ChatSendParams): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries({
      sessionKey: params.sessionKey,
      text: params.message,
      agentId: params.agentId,
      thinking: params.thinking,
      metadata: params.metadata,
    }).filter(([, value]) => value != null),
  )
}

// ==========================================
// 统一 API 接口
// ==========================================

export interface DataAPI {
  // 状态
  getHealth(): Promise<{ ok: boolean; uptimeMs?: number }>
  getSnapshot(): Promise<Snapshot | null>
  getPresence(): Promise<PresenceEntry[]>

  // Agents
  getAgents(): Promise<AgentSummary[]>
  createAgent(params: AgentsCreateParams): Promise<{ agentId: string }>
  updateAgent(params: AgentsUpdateParams): Promise<void>
  deleteAgent(params: AgentsDeleteParams): Promise<void>

  // Agent Files — 用于预设角色导入 (SOUL.md, config 等)
  agentFilesList(agentId: string): Promise<AgentsFileEntry[]>
  agentFilesGet(agentId: string, path: string): Promise<string>
  agentFilesSet(agentId: string, path: string, content: string): Promise<void>

  // Skills — 技能安装
  installSkill(skillId: string): Promise<void>

  // Sessions
  getSessions(params?: SessionsListParams): Promise<SessionsListResult>
  patchSession(params: SessionsPatchParams): Promise<void>
  resetSession(key: string): Promise<void>
  deleteSession(key: string): Promise<void>
  getSessionsUsage(params?: SessionsUsageParams): Promise<SessionsUsageResult>
  getUsageCost(params?: UsageCostParams): Promise<UsageCostSummary>

  // Chat
  sendChatMessage(params: ChatSendParams): Promise<ChatSendResult>

  // Channels
  getChannelsStatus(): Promise<ChannelsStatusResult>

  // Cron
  getCronJobs(): Promise<CronJob[]>
  addCronJob(params: CronAddParams): Promise<{ id: string }>
  updateCronJob(params: CronUpdateParams): Promise<void>
  removeCronJob(params: CronRemoveParams): Promise<void>
  runCronJob(params: CronRunParams): Promise<void>
  getCronRuns(params: CronRunsParams): Promise<CronRunLogEntry[]>

  // Logs
  getLogs(params?: LogsTailParams): Promise<LogEntry[]>

  // Models & Skills
  getModels(): Promise<ModelChoice[]>
  getSkills(): Promise<SkillEntry[]>

  // Nodes
  getNodes(): Promise<NodeListNode[]>

  // Config
  getConfig(): Promise<Record<string, unknown>>

  // Exec Approvals
  getExecApprovals(): Promise<ExecApprovalRequest[]>
  resolveExecApproval(requestId: string, decision: 'approved' | 'denied'): Promise<void>
}

// ==========================================
// OpenClaw Gateway 实现 (WebSocket JSON-RPC)
// ==========================================

class GatewayAPI implements DataAPI {
  private async getClient() {
    return ensureGatewayClientReady(loadConfig())
  }

  private async request<T = unknown>(method: string, params?: object) {
    const client = await this.getClient()
    return client.request<T>(method, params)
  }

  private normalizeAgentUpdateParams(params: AgentsUpdateParams): Record<string, unknown> {
    // 网关 agents.update 只接受: agentId, name, workspace, model, avatar
    // 不接受 identity / emoji（emoji 仅 agents.create 支持）
    const { agentId, name, model, avatar } = params
    return {
      agentId,
      ...(name ? { name } : {}),
      ...(model ? { model } : {}),
      ...(avatar ? { avatar } : {}),
    }
  }

  async getHealth() {
    const client = await this.getClient()
    const result = await client.request<{ ok: boolean }>(GATEWAY_METHODS.HEALTH)
    return { ok: result?.ok ?? true, uptimeMs: client.currentSnapshot?.uptimeMs }
  }

  async getSnapshot() {
    const client = await this.getClient()
    return client.currentSnapshot
  }

  async getPresence() {
    const result = await this.request<PresenceEntry[]>(GATEWAY_METHODS.SYSTEM_PRESENCE)
    return result ?? []
  }

  async getAgents() {
    const result = await this.request<AgentsListResult>(GATEWAY_METHODS.AGENTS_LIST)
    return result?.agents ?? []
  }

  async createAgent(params: AgentsCreateParams) {
    return this.request<{ agentId: string }>(GATEWAY_METHODS.AGENTS_CREATE, params)
  }

  async updateAgent(params: AgentsUpdateParams) {
    await this.request(GATEWAY_METHODS.AGENTS_UPDATE, this.normalizeAgentUpdateParams(params))
  }

  async deleteAgent(params: AgentsDeleteParams) {
    await this.request(GATEWAY_METHODS.AGENTS_DELETE, params)
  }

  async agentFilesList(agentId: string) {
    const result = await this.request<{ files: AgentsFileEntry[] }>(
      GATEWAY_METHODS.AGENTS_FILES_LIST, { agentId }
    )
    return result?.files ?? []
  }

  async agentFilesGet(agentId: string, name: string) {
    const result = await this.request<{ content: string }>(
      GATEWAY_METHODS.AGENTS_FILES_GET, { agentId, name }
    )
    return result?.content ?? ''
  }

  async agentFilesSet(agentId: string, name: string, content: string) {
    await this.request(GATEWAY_METHODS.AGENTS_FILES_SET, { agentId, name, content })
  }

  async installSkill(skillId: string) {
    await this.request(GATEWAY_METHODS.SKILLS_INSTALL, { skillId })
  }

  async getSessions(params?: SessionsListParams) {
    const result = await this.request<SessionsListResult>(GATEWAY_METHODS.SESSIONS_LIST, {
      limit: 100,
      includeDerivedTitles: true,
      includeLastMessage: true,
      ...params,
    })
    return result
  }

  async patchSession(params: SessionsPatchParams) {
    await this.request(GATEWAY_METHODS.SESSIONS_PATCH, params)
  }

  async resetSession(key: string) {
    await this.request(GATEWAY_METHODS.SESSIONS_RESET, { key })
  }

  async deleteSession(key: string) {
    await this.request(GATEWAY_METHODS.SESSIONS_DELETE, { key })
  }

  async getSessionsUsage(params?: SessionsUsageParams) {
    const result = await this.request<SessionsUsageResult>(GATEWAY_METHODS.SESSIONS_USAGE, params)
    return normalizeSessionsUsageResult(result)
  }

  async getUsageCost(params?: UsageCostParams) {
    const result = await this.request<UsageCostSummary>(GATEWAY_METHODS.USAGE_COST, params)
    return normalizeUsageCostSummary(result)
  }

  async sendChatMessage(params: ChatSendParams) {
    return this.request<ChatSendResult>(GATEWAY_METHODS.CHAT_SEND, normalizeGatewayChatSendParams(params))
  }

  async getChannelsStatus() {
    const result = await this.request<ChannelsStatusResult>(GATEWAY_METHODS.CHANNELS_STATUS, { probe: false })
    return normalizeChannelsStatusResult(result)
  }

  async getCronJobs() {
    const result = await this.request<{ jobs: CronJob[] }>(GATEWAY_METHODS.CRON_LIST)
    return result?.jobs ?? []
  }

  async addCronJob(params: CronAddParams) {
    return this.request<{ id: string }>(GATEWAY_METHODS.CRON_ADD, params)
  }

  async updateCronJob(params: CronUpdateParams) {
    await this.request(GATEWAY_METHODS.CRON_UPDATE, params)
  }

  async removeCronJob(params: CronRemoveParams) {
    await this.request(GATEWAY_METHODS.CRON_REMOVE, params)
  }

  async runCronJob(params: CronRunParams) {
    await this.request(GATEWAY_METHODS.CRON_RUN, params)
  }

  async getCronRuns(params: CronRunsParams) {
    const result = await this.request<{ runs: CronRunLogEntry[] }>(GATEWAY_METHODS.CRON_RUNS, params)
    return result?.runs ?? []
  }

  async getLogs(params?: LogsTailParams) {
    const result = await this.request<LogsTailResult>(GATEWAY_METHODS.LOGS_TAIL, {
      limit: 200,
      ...params,
    })
    // OpenClaw 返回原始行，需要前端解析
    return parseLogLines(result?.lines ?? [])
  }

  async getModels() {
    const result = await this.request<{ models: ModelChoice[] }>(GATEWAY_METHODS.MODELS_LIST)
    return result?.models ?? []
  }

  async getSkills() {
    const result = await this.request<{ skills: SkillEntry[] }>(GATEWAY_METHODS.SKILLS_STATUS)
    return result?.skills ?? []
  }

  async getNodes() {
    const result = await this.request<{ nodes: NodeListNode[] }>(GATEWAY_METHODS.NODE_LIST)
    return result?.nodes ?? []
  }

  async getConfig() {
    return this.request<Record<string, unknown>>(GATEWAY_METHODS.CONFIG_GET)
  }

  async getExecApprovals() {
    const result = await this.request<{ requests: ExecApprovalRequest[] }>(GATEWAY_METHODS.EXEC_APPROVALS_GET)
    return result?.requests ?? []
  }

  async resolveExecApproval(requestId: string, decision: 'approved' | 'denied') {
    await this.request(GATEWAY_METHODS.EXEC_APPROVAL_RESOLVE, { requestId, decision })
  }
}

class BridgeAPI implements DataAPI {
  private async request<T = unknown>(method: string, params?: object) {
    return bridgeRpc<T>(method, params)
  }

  async getHealth() {
    const result = await getBridgeHealth()
    return {
      ok: result.ok,
      uptimeMs: result.uptimeMs,
    }
  }

  async getSnapshot() {
    return this.request<Snapshot>('getSnapshot')
  }

  async getPresence() {
    return this.request<PresenceEntry[]>('getPresence')
  }

  async getAgents() {
    return this.request<AgentSummary[]>('getAgents')
  }

  async createAgent(params: AgentsCreateParams) {
    return this.request<{ agentId: string }>('createAgent', params)
  }

  async updateAgent(params: AgentsUpdateParams) {
    await this.request('updateAgent', params)
  }

  async deleteAgent(params: AgentsDeleteParams) {
    await this.request('deleteAgent', params)
  }

  async agentFilesList(agentId: string) {
    return this.request<AgentsFileEntry[]>('agentFilesList', { agentId })
  }

  async agentFilesGet(agentId: string, path: string) {
    return this.request<string>('agentFilesGet', { agentId, path })
  }

  async agentFilesSet(agentId: string, path: string, content: string) {
    await this.request('agentFilesSet', { agentId, path, content })
  }

  async installSkill(skillId: string) {
    await this.request('installSkill', { skillId })
  }

  async getSessions(params?: SessionsListParams) {
    return this.request<SessionsListResult>('getSessions', {
      limit: 100,
      includeDerivedTitles: true,
      includeLastMessage: true,
      ...params,
    })
  }

  async patchSession(params: SessionsPatchParams) {
    await this.request('patchSession', params)
  }

  async resetSession(key: string) {
    await this.request('resetSession', { key })
  }

  async deleteSession(key: string) {
    await this.request('deleteSession', { key })
  }

  async getSessionsUsage(params?: SessionsUsageParams) {
    const [agents, sessionsResult] = await Promise.all([
      this.getAgents(),
      this.getSessions({
        limit: params?.limit ?? 1000,
        includeGlobal: true,
        includeUnknown: true,
        includeDerivedTitles: true,
        includeLastMessage: true,
      }),
    ])

    return normalizeSessionsUsageResult(
      mockWorkspace.deriveUsageFromSessions(
        filterSessionsForUsage(sessionsResult.sessions, params),
        agents,
      ),
    )
  }

  async getUsageCost(params?: UsageCostParams) {
    const usage = await this.getSessionsUsage(applyUsageWindow(params))
    return normalizeUsageCostSummary(buildUsageCostSummary(usage))
  }

  async sendChatMessage(params: ChatSendParams) {
    return this.request<ChatSendResult>('sendChatMessage', normalizeBridgeChatSendParams(params))
  }

  async getChannelsStatus() {
    const result = await this.request<ChannelsStatusResult>('getChannelsStatus')
    return normalizeChannelsStatusResult(result)
  }

  async getCronJobs() {
    return this.request<CronJob[]>('getCronJobs')
  }

  async addCronJob(params: CronAddParams) {
    return this.request<{ id: string }>('addCronJob', params)
  }

  async updateCronJob(params: CronUpdateParams) {
    await this.request('updateCronJob', params)
  }

  async removeCronJob(params: CronRemoveParams) {
    await this.request('removeCronJob', params)
  }

  async runCronJob(params: CronRunParams) {
    await this.request('runCronJob', params)
  }

  async getCronRuns(params: CronRunsParams) {
    return this.request<CronRunLogEntry[]>('getCronRuns', params)
  }

  async getLogs(params?: LogsTailParams) {
    return this.request<LogEntry[]>('getLogs', {
      limit: 200,
      ...params,
    })
  }

  async getModels() {
    return this.request<ModelChoice[]>('getModels')
  }

  async getSkills() {
    return this.request<SkillEntry[]>('getSkills')
  }

  async getNodes() {
    return this.request<NodeListNode[]>('getNodes')
  }

  async getConfig() {
    return this.request<Record<string, unknown>>('getConfig')
  }

  async getExecApprovals() {
    return this.request<ExecApprovalRequest[]>('getExecApprovals')
  }

  async resolveExecApproval(requestId: string, decision: 'approved' | 'denied') {
    await this.request('resolveExecApproval', { requestId, decision })
  }
}

class HybridAPI implements DataAPI {
  private readonly gateway = new GatewayAPI()
  private readonly bridge = new BridgeAPI()

  private async gatewayFirst<T>(gatewayCall: () => Promise<T>, bridgeCall: () => Promise<T>): Promise<T> {
    try {
      return await gatewayCall()
    } catch {
      return bridgeCall()
    }
  }

  async getHealth() {
    return this.gatewayFirst(() => this.gateway.getHealth(), () => this.bridge.getHealth())
  }

  async getSnapshot() {
    return this.gatewayFirst(() => this.gateway.getSnapshot(), () => this.bridge.getSnapshot())
  }

  async getPresence() {
    return this.gatewayFirst(() => this.gateway.getPresence(), () => this.bridge.getPresence())
  }

  async getAgents() {
    return this.bridge.getAgents()
  }

  async createAgent(params: AgentsCreateParams) {
    return this.bridge.createAgent(params)
  }

  async updateAgent(params: AgentsUpdateParams) {
    await this.bridge.updateAgent(params)
  }

  async deleteAgent(params: AgentsDeleteParams) {
    await this.bridge.deleteAgent(params)
  }

  async agentFilesList(agentId: string) {
    return this.bridge.agentFilesList(agentId)
  }

  async agentFilesGet(agentId: string, path: string) {
    return this.bridge.agentFilesGet(agentId, path)
  }

  async agentFilesSet(agentId: string, path: string, content: string) {
    await this.bridge.agentFilesSet(agentId, path, content)
  }

  async installSkill(skillId: string) {
    await this.bridge.installSkill(skillId)
  }

  async getSessions(params?: SessionsListParams) {
    return this.gatewayFirst(() => this.gateway.getSessions(params), () => this.bridge.getSessions(params))
  }

  async patchSession(params: SessionsPatchParams) {
    await this.gateway.patchSession(params)
  }

  async resetSession(key: string) {
    await this.gateway.resetSession(key)
  }

  async deleteSession(key: string) {
    await this.gateway.deleteSession(key)
  }

  async getSessionsUsage(params?: SessionsUsageParams) {
    return this.gatewayFirst(() => this.gateway.getSessionsUsage(params), () => this.bridge.getSessionsUsage(params))
  }

  async getUsageCost(params?: UsageCostParams) {
    return this.gatewayFirst(() => this.gateway.getUsageCost(params), () => this.bridge.getUsageCost(params))
  }

  async sendChatMessage(params: ChatSendParams) {
    return this.gatewayFirst(() => this.gateway.sendChatMessage(params), () => this.bridge.sendChatMessage(params))
  }

  async getChannelsStatus() {
    return this.gatewayFirst(() => this.gateway.getChannelsStatus(), () => this.bridge.getChannelsStatus())
  }

  async getCronJobs() {
    return this.gatewayFirst(() => this.gateway.getCronJobs(), () => this.bridge.getCronJobs())
  }

  async addCronJob(params: CronAddParams) {
    return this.gatewayFirst(() => this.gateway.addCronJob(params), () => this.bridge.addCronJob(params))
  }

  async updateCronJob(params: CronUpdateParams) {
    await this.gatewayFirst(() => this.gateway.updateCronJob(params), () => this.bridge.updateCronJob(params))
  }

  async removeCronJob(params: CronRemoveParams) {
    await this.gatewayFirst(() => this.gateway.removeCronJob(params), () => this.bridge.removeCronJob(params))
  }

  async runCronJob(params: CronRunParams) {
    await this.gatewayFirst(() => this.gateway.runCronJob(params), () => this.bridge.runCronJob(params))
  }

  async getCronRuns(params: CronRunsParams) {
    return this.gatewayFirst(() => this.gateway.getCronRuns(params), () => this.bridge.getCronRuns(params))
  }

  async getLogs(params?: LogsTailParams) {
    return this.gatewayFirst(() => this.gateway.getLogs(params), () => this.bridge.getLogs(params))
  }

  async getModels() {
    return this.gatewayFirst(() => this.gateway.getModels(), () => this.bridge.getModels())
  }

  async getSkills() {
    return this.gatewayFirst(() => this.gateway.getSkills(), () => this.bridge.getSkills())
  }

  async getNodes() {
    return this.gatewayFirst(() => this.gateway.getNodes(), () => this.bridge.getNodes())
  }

  async getConfig() {
    return this.gatewayFirst(() => this.gateway.getConfig(), () => this.bridge.getConfig())
  }

  async getExecApprovals() {
    return this.gatewayFirst(() => this.gateway.getExecApprovals(), () => this.bridge.getExecApprovals())
  }

  async resolveExecApproval(requestId: string, decision: 'approved' | 'denied') {
    await this.gateway.resolveExecApproval(requestId, decision)
  }
}

// ==========================================
// 日志行解析（OpenClaw logs.tail 返回原始字符串行）
// ==========================================

function parseLogLines(lines: string[]): LogEntry[] {
  return lines.map((line) => {
    // 尝试解析常见日志格式: [timestamp] LEVEL source: message
    const match = line.match(/^\[?(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}[^\]]*)\]?\s+(INFO|WARN|ERROR|DEBUG|TRACE|VERBOSE)\s+(?:(\S+?):\s+)?(.*)$/i)
    if (match) {
      return {
        ts: new Date(match[1]).getTime() || Date.now(),
        level: match[2].toLowerCase(),
        source: match[3] || undefined,
        message: match[4],
        raw: line,
      }
    }
    // 无法解析时作为 info 原始行
    return {
      ts: Date.now(),
      level: 'info',
      message: line,
      raw: line,
    }
  })
}

// ==========================================
// Mock 实现
// ==========================================

function filterMockSessions(base: SessionsListResult, params?: SessionsListParams): SessionsListResult {
  let sessions = [...base.sessions]

  if (!params?.includeGlobal) {
    sessions = sessions.filter((session) => session.kind !== 'global')
  }
  if (!params?.includeUnknown) {
    sessions = sessions.filter((session) => session.kind !== 'unknown')
  }
  if (params?.label) {
    sessions = sessions.filter((session) => session.label?.includes(params.label ?? ''))
  }
  if (params?.limit) {
    sessions = sessions.slice(0, params.limit)
  }

  return {
    ...base,
    ts: Date.now(),
    count: sessions.length,
    sessions,
  }
}

function filterMockCronRuns(runs: CronRunLogEntry[], params?: CronRunsParams): CronRunLogEntry[] {
  let filtered = [...runs]

  if (params?.id || params?.jobId) {
    const jobId = params.id ?? params.jobId
    filtered = filtered.filter((run) => run.jobId === jobId)
  }
  if (params?.status && params.status !== 'all') {
    filtered = filtered.filter((run) => run.status === params.status)
  }
  filtered.sort((left, right) => params?.sort === 'asc' ? left.startedAtMs - right.startedAtMs : right.startedAtMs - left.startedAtMs)
  if (params?.limit) {
    filtered = filtered.slice(0, params.limit)
  }
  return filtered
}

function filterMockLogs(entries: LogEntry[], params?: LogsTailParams): LogEntry[] {
  const limit = params?.limit ?? 200
  return entries.slice(0, limit)
}

const mockAPI: DataAPI = {
  async getHealth() {
    const snapshot = mockWorkspace.getMockSnapshot()
    return { ok: true, uptimeMs: snapshot.uptimeMs }
  },
  async getSnapshot() { return mockWorkspace.getMockSnapshot() },
  async getPresence() { return mockWorkspace.getMockPresence() },
  async getAgents() { return mockWorkspace.getMockAgents() },
  async createAgent(params) { return mockWorkspace.createMockAgent(params) },
  async updateAgent(params) { mockWorkspace.updateMockAgent(params) },
  async deleteAgent(params) { mockWorkspace.deleteMockAgent(params) },
  async agentFilesList(agentId) { return mockWorkspace.listMockAgentFiles(agentId) },
  async agentFilesGet(agentId, path) { return mockWorkspace.getMockAgentFile(agentId, path) },
  async agentFilesSet(agentId, path, content) { mockWorkspace.setMockAgentFile(agentId, path, content) },
  async installSkill(skillId) { mockWorkspace.installMockSkill(skillId) },
  async getSessions(params) { return filterMockSessions(mockWorkspace.getMockSessionsList(), params) },
  async patchSession(params) { mockWorkspace.patchMockSession(params) },
  async resetSession(key) { mockWorkspace.resetMockSession(key) },
  async deleteSession(key) { mockWorkspace.deleteMockSession(key) },
  async getSessionsUsage() { return normalizeSessionsUsageResult(mockWorkspace.getMockUsage()) },
  async getUsageCost() { return normalizeUsageCostSummary(mockWorkspace.getMockUsageCost()) },
  async sendChatMessage(params) { return mockWorkspace.sendMockChatMessage(params) },
  async getChannelsStatus() { return normalizeChannelsStatusResult(mockWorkspace.getMockChannelsStatus()) },
  async getCronJobs() { return mockWorkspace.getMockCronJobs() },
  async addCronJob() { return { id: 'new-cron' } },
  async updateCronJob() {},
  async removeCronJob() {},
  async runCronJob() {},
  async getCronRuns(params) { return filterMockCronRuns(mockWorkspace.getMockCronRuns(), params) },
  async getLogs(params) { return filterMockLogs(mockWorkspace.getMockLogs(), params) },
  async getModels() { return mockWorkspace.getMockModels() },
  async getSkills() { return mockWorkspace.getMockSkills() },
  async getNodes() { return mockWorkspace.getMockNodes() },
  async getConfig() { return mockWorkspace.getMockConfig() },
  async getExecApprovals() { return mockWorkspace.getMockExecApprovals() },
  async resolveExecApproval(requestId, decision) { mockWorkspace.resolveMockExecApproval(requestId, decision) },
}

// ==========================================
// API 获取（自动切换 Mock/Real）
// ==========================================

let cachedGatewayAPI: GatewayAPI | null = null
let cachedBridgeAPI: BridgeAPI | null = null
let cachedHybridAPI: HybridAPI | null = null

export function getAPI(): DataAPI {
  const config = loadConfig()

  if (config.useMockData) {
    return mockAPI
  }

  if (usesBridgeTransport(config) && usesGatewayTransport(config)) {
    if (!cachedHybridAPI) {
      cachedHybridAPI = new HybridAPI()
    }
    return cachedHybridAPI
  }

  if (usesBridgeTransport(config)) {
    if (!cachedBridgeAPI) {
      cachedBridgeAPI = new BridgeAPI()
    }
    return cachedBridgeAPI
  }

  if (!cachedGatewayAPI) {
    cachedGatewayAPI = new GatewayAPI()
  }
  return cachedGatewayAPI
}

export function resetAPIClient(): void {
  cachedGatewayAPI = null
  cachedBridgeAPI = null
  cachedHybridAPI = null
}
