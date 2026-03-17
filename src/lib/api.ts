// API 层 — 统一数据获取接口
// 根据配置自动切换 Mock 数据 / OpenClaw Gateway WebSocket JSON-RPC

import { loadConfig } from './config'
import { ensureGatewayClientReady } from './gateway-client'
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
  sendChatMessage(params: ChatSendParams): Promise<ChatMessage[]>

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
    const { agentId, name, model, identity, emoji, avatar } = params
    const nextIdentity = {
      ...(identity ?? {}),
      ...(emoji ? { emoji } : {}),
      ...(avatar ? { avatar } : {}),
    }

    return {
      agentId,
      ...(name ? { name } : {}),
      ...(model ? { model } : {}),
      ...(Object.keys(nextIdentity).length > 0 ? { identity: nextIdentity } : {}),
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

  async agentFilesGet(agentId: string, path: string) {
    const result = await this.request<{ content: string }>(
      GATEWAY_METHODS.AGENTS_FILES_GET, { agentId, path }
    )
    return result?.content ?? ''
  }

  async agentFilesSet(agentId: string, path: string, content: string) {
    await this.request(GATEWAY_METHODS.AGENTS_FILES_SET, { agentId, path, content })
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
    return this.request<ChatMessage[]>(GATEWAY_METHODS.CHAT_SEND, params)
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

export function getAPI(): DataAPI {
  const config = loadConfig()

  if (config.useMockData) {
    return mockAPI
  }

  if (!cachedGatewayAPI) {
    cachedGatewayAPI = new GatewayAPI()
  }
  return cachedGatewayAPI
}

export function resetAPIClient(): void {
  cachedGatewayAPI = null
}
