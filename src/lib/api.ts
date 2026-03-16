// API 层 — 统一数据获取接口
// 根据配置自动切换 Mock 数据 / OpenClaw Gateway WebSocket JSON-RPC

import { loadConfig } from './config'
import { getGatewayClient } from './gateway-client'
import type {
  AgentSummary,
  AgentsListResult,
  AgentsFileEntry,
  SessionsListParams,
  SessionsListResult,
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
import * as mock from '../data/mock'

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
  private get client() {
    const c = getGatewayClient()
    if (!c || !c.isConnected) throw new Error('Gateway not connected')
    return c
  }

  async getHealth() {
    const result = await this.client.request<{ ok: boolean }>(GATEWAY_METHODS.HEALTH)
    return { ok: result?.ok ?? true, uptimeMs: this.client.currentSnapshot?.uptimeMs }
  }

  async getSnapshot() {
    return this.client.currentSnapshot
  }

  async getPresence() {
    const result = await this.client.request<PresenceEntry[]>(GATEWAY_METHODS.SYSTEM_PRESENCE)
    return result ?? []
  }

  async getAgents() {
    const result = await this.client.request<AgentsListResult>(GATEWAY_METHODS.AGENTS_LIST)
    return result?.agents ?? []
  }

  async createAgent(params: AgentsCreateParams) {
    return this.client.request<{ agentId: string }>(GATEWAY_METHODS.AGENTS_CREATE, params)
  }

  async updateAgent(params: AgentsUpdateParams) {
    await this.client.request(GATEWAY_METHODS.AGENTS_UPDATE, params)
  }

  async deleteAgent(params: AgentsDeleteParams) {
    await this.client.request(GATEWAY_METHODS.AGENTS_DELETE, params)
  }

  async agentFilesList(agentId: string) {
    const result = await this.client.request<{ files: AgentsFileEntry[] }>(
      GATEWAY_METHODS.AGENTS_FILES_LIST, { agentId }
    )
    return result?.files ?? []
  }

  async agentFilesGet(agentId: string, path: string) {
    const result = await this.client.request<{ content: string }>(
      GATEWAY_METHODS.AGENTS_FILES_GET, { agentId, path }
    )
    return result?.content ?? ''
  }

  async agentFilesSet(agentId: string, path: string, content: string) {
    await this.client.request(GATEWAY_METHODS.AGENTS_FILES_SET, { agentId, path, content })
  }

  async installSkill(skillId: string) {
    await this.client.request(GATEWAY_METHODS.SKILLS_INSTALL, { skillId })
  }

  async getSessions(params?: SessionsListParams) {
    const result = await this.client.request<SessionsListResult>(GATEWAY_METHODS.SESSIONS_LIST, {
      limit: 100,
      includeDerivedTitles: true,
      includeLastMessage: true,
      ...params,
    })
    return result
  }

  async patchSession(params: SessionsPatchParams) {
    await this.client.request(GATEWAY_METHODS.SESSIONS_PATCH, params)
  }

  async resetSession(key: string) {
    await this.client.request(GATEWAY_METHODS.SESSIONS_RESET, { key })
  }

  async deleteSession(key: string) {
    await this.client.request(GATEWAY_METHODS.SESSIONS_DELETE, { key })
  }

  async getSessionsUsage(params?: SessionsUsageParams) {
    return this.client.request<SessionsUsageResult>(GATEWAY_METHODS.SESSIONS_USAGE, params)
  }

  async getChannelsStatus() {
    return this.client.request<ChannelsStatusResult>(GATEWAY_METHODS.CHANNELS_STATUS, { probe: false })
  }

  async getCronJobs() {
    const result = await this.client.request<{ jobs: CronJob[] }>(GATEWAY_METHODS.CRON_LIST)
    return result?.jobs ?? []
  }

  async addCronJob(params: CronAddParams) {
    return this.client.request<{ id: string }>(GATEWAY_METHODS.CRON_ADD, params)
  }

  async updateCronJob(params: CronUpdateParams) {
    await this.client.request(GATEWAY_METHODS.CRON_UPDATE, params)
  }

  async removeCronJob(params: CronRemoveParams) {
    await this.client.request(GATEWAY_METHODS.CRON_REMOVE, params)
  }

  async runCronJob(params: CronRunParams) {
    await this.client.request(GATEWAY_METHODS.CRON_RUN, params)
  }

  async getCronRuns(params: CronRunsParams) {
    const result = await this.client.request<{ runs: CronRunLogEntry[] }>(GATEWAY_METHODS.CRON_RUNS, params)
    return result?.runs ?? []
  }

  async getLogs(params?: LogsTailParams) {
    const result = await this.client.request<LogsTailResult>(GATEWAY_METHODS.LOGS_TAIL, {
      limit: 200,
      ...params,
    })
    // OpenClaw 返回原始行，需要前端解析
    return parseLogLines(result?.lines ?? [])
  }

  async getModels() {
    const result = await this.client.request<{ models: ModelChoice[] }>(GATEWAY_METHODS.MODELS_LIST)
    return result?.models ?? []
  }

  async getSkills() {
    const result = await this.client.request<{ skills: SkillEntry[] }>(GATEWAY_METHODS.SKILLS_STATUS)
    return result?.skills ?? []
  }

  async getNodes() {
    const result = await this.client.request<{ nodes: NodeListNode[] }>(GATEWAY_METHODS.NODE_LIST)
    return result?.nodes ?? []
  }

  async getConfig() {
    return this.client.request<Record<string, unknown>>(GATEWAY_METHODS.CONFIG_GET)
  }

  async getExecApprovals() {
    const result = await this.client.request<{ requests: ExecApprovalRequest[] }>(GATEWAY_METHODS.EXEC_APPROVALS_GET)
    return result?.requests ?? []
  }

  async resolveExecApproval(requestId: string, decision: 'approved' | 'denied') {
    await this.client.request(GATEWAY_METHODS.EXEC_APPROVAL_RESOLVE, { requestId, decision })
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

const mockAPI: DataAPI = {
  async getHealth() { return { ok: true, uptimeMs: 86400000 } },
  async getSnapshot() { return mock.mockSnapshot },
  async getPresence() { return mock.mockPresence },
  async getAgents() { return mock.mockAgents },
  async createAgent() { return { agentId: 'new-agent' } },
  async updateAgent() {},
  async deleteAgent() {},
  async agentFilesList() { return [] },
  async agentFilesGet() { return '' },
  async agentFilesSet() {},
  async installSkill() {},
  async getSessions() { return mock.mockSessionsList },
  async patchSession() {},
  async resetSession() {},
  async deleteSession() {},
  async getSessionsUsage() { return mock.mockUsage },
  async getChannelsStatus() { return mock.mockChannelsStatus },
  async getCronJobs() { return mock.mockCronJobs },
  async addCronJob() { return { id: 'new-cron' } },
  async updateCronJob() {},
  async removeCronJob() {},
  async runCronJob() {},
  async getCronRuns() { return mock.mockCronRuns },
  async getLogs() { return mock.mockLogs },
  async getModels() { return mock.mockModels },
  async getSkills() { return mock.mockSkills },
  async getNodes() { return mock.mockNodes },
  async getConfig() { return mock.mockConfig },
  async getExecApprovals() { return mock.mockExecApprovals },
  async resolveExecApproval() {},
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
