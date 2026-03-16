// OpenClaw Gateway 类型定义
// 基于 OpenClaw 协议定义的前端类型

// ==========================================
// 连接与协议
// ==========================================

export type AuthMode = 'none' | 'token' | 'password' | 'trusted-proxy'

export type GatewayScope =
  | 'operator.read'
  | 'operator.write'
  | 'operator.admin'
  | 'operator.approvals'
  | 'operator.pairing'

export interface ConnectParams {
  minProtocol: number
  maxProtocol: number
  client: GatewayClientInfo
  // 认证信息嵌套在 auth 对象中
  auth?: {
    token?: string
    deviceToken?: string
    password?: string
  }
  scopes?: GatewayScope[]
  caps?: string[]
  commands?: string[]
  permissions?: Record<string, boolean>
  role?: string
  locale?: string
  userAgent?: string
}

export interface GatewayClientInfo {
  id: string
  displayName?: string
  version: string
  platform: string
  deviceFamily?: string
  modelIdentifier?: string
  mode: GatewayClientMode
  instanceId?: string
}

export type GatewayClientMode = 'ui' | 'cli' | 'backend' | 'node' | 'probe' | 'test' | 'webchat'

export interface HelloOk {
  protocol: number
  server: {
    version: string
    connId: string
  }
  features: {
    methods: string[]
    events: string[]
  }
  snapshot: Snapshot
  canvasHostUrl?: string
  auth?: {
    deviceToken: string
    role: string
    scopes: string[]
    issuedAtMs?: number
  }
  policy: {
    maxPayload: number
    maxBufferedBytes: number
    tickIntervalMs: number
  }
}

export interface Snapshot {
  presence: PresenceEntry[]
  health: Record<string, unknown>
  stateVersion: StateVersion
  uptimeMs: number
  configPath?: string
  stateDir?: string
  sessionDefaults?: SessionDefaults
  authMode?: AuthMode
  updateAvailable?: {
    currentVersion: string
    latestVersion: string
    channel: string
  }
}

export interface SessionDefaults {
  defaultAgentId: string
  mainKey: string
  mainSessionKey: string
  scope?: string
}

export interface StateVersion {
  presence: number
  health: number
}

export interface PresenceEntry {
  host?: string
  ip?: string
  version?: string
  platform?: string
  deviceFamily?: string
  modelIdentifier?: string
  mode?: string
  lastInputSeconds?: number
  reason?: string
  tags?: string[]
  text?: string
  ts: number
  deviceId?: string
  roles?: string[]
  scopes?: string[]
  instanceId?: string
}

// ==========================================
// WebSocket 帧
// ==========================================

export interface RequestFrame {
  type: 'req'
  id: string
  method: string
  params?: Record<string, unknown>
}

export interface ResponseFrame {
  type: 'res'
  id: string
  ok: boolean
  payload?: unknown
  error?: ErrorShape
}

export interface EventFrame {
  type: 'event'
  event: string
  payload?: unknown
  seq?: number
  stateVersion?: StateVersion
}

export interface ErrorShape {
  code: string
  message: string
  details?: unknown
  retryable?: boolean
  retryAfterMs?: number
}

export type GatewayFrame = RequestFrame | ResponseFrame | EventFrame | { type: 'error'; error: ErrorShape }

// ==========================================
// Agent 类型
// ==========================================

export interface AgentIdentityInfo {
  name?: string
  theme?: string
  emoji?: string
  avatar?: string
  avatarUrl?: string
}

export interface AgentSummary {
  id: string
  name?: string
  identity?: AgentIdentityInfo
}

export interface AgentsListResult {
  defaultId: string
  mainKey: string
  scope: 'per-sender' | 'global'
  agents: AgentSummary[]
}

export interface AgentIdentity {
  agentId: string
  name?: string
  avatar?: string
  emoji?: string
}

export interface AgentsCreateParams {
  name: string
  workspace?: string
}

export interface AgentsUpdateParams {
  agentId: string
  name?: string
  model?: string
  avatar?: string
  emoji?: string
}

export interface AgentsDeleteParams {
  agentId: string
}

export interface AgentsFileEntry {
  path: string
  size?: number
  updatedAt?: number
}

// ==========================================
// Session 类型
// ==========================================

export type SessionKind = 'direct' | 'group' | 'global' | 'unknown'

export interface GatewaySessionRow {
  key: string
  kind: SessionKind
  label?: string
  displayName?: string
  derivedTitle?: string
  lastMessagePreview?: string
  channel?: string
  subject?: string
  groupChannel?: string
  space?: string
  chatType?: string
  updatedAt: number | null
  sessionId?: string
  systemSent?: boolean
  abortedLastRun?: boolean
  thinkingLevel?: string
  verboseLevel?: string
  reasoningLevel?: string
  elevatedLevel?: string
  sendPolicy?: 'allow' | 'deny'
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
  totalTokensFresh?: boolean
  responseUsage?: 'on' | 'off' | 'tokens' | 'full'
  modelProvider?: string
  model?: string
  contextTokens?: number
  lastChannel?: string
  lastTo?: string
  lastAccountId?: string
}

export interface SessionsListParams {
  limit?: number
  activeMinutes?: number
  includeGlobal?: boolean
  includeUnknown?: boolean
  includeDerivedTitles?: boolean
  includeLastMessage?: boolean
  label?: string
  spawnedBy?: string
  agentId?: string
  search?: string
}

export interface SessionsListResult {
  ts: number
  path: string
  count: number
  defaults: {
    modelProvider: string | null
    model: string | null
    contextTokens: number | null
  }
  sessions: GatewaySessionRow[]
}

export interface SessionPreviewItem {
  role: 'user' | 'assistant' | 'tool' | 'system' | 'other'
  text: string
}

export interface SessionsPreviewEntry {
  key: string
  status: 'ok' | 'empty' | 'missing' | 'error'
  items: SessionPreviewItem[]
}

export interface SessionsPatchParams {
  key: string
  label?: string | null
  thinkingLevel?: string | null
  verboseLevel?: string | null
  reasoningLevel?: string | null
  responseUsage?: 'off' | 'tokens' | 'full' | 'on' | null
  elevatedLevel?: string | null
  model?: string | null
  sendPolicy?: 'allow' | 'deny' | null
}

export interface SessionsResetParams {
  key: string
  reason?: 'new' | 'reset'
}

export interface SessionsDeleteParams {
  key: string
  deleteTranscript?: boolean
}

// ==========================================
// Chat 类型
// ==========================================

export interface ChatAttachment {
  name?: string
  mimeType?: string
  size?: number
  url?: string
}

export interface ChatSendParams {
  sessionKey: string
  text: string
  attachments?: ChatAttachment[]
  agentId?: string
  channel?: string
  to?: string
  model?: string
  maxTokens?: number
  thinking?: boolean
  parentId?: string
  metadata?: Record<string, unknown>
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'tool' | 'system' | 'other'
  text: string
  timestamp?: number
  modelUsage?: {
    input_tokens?: number
    output_tokens?: number
    cost?: number
  }
  attachments?: ChatAttachment[]
}

// ==========================================
// Usage / Cost 类型
// ==========================================

export interface SessionsUsageParams {
  key?: string
  startDate?: string // YYYY-MM-DD
  endDate?: string   // YYYY-MM-DD
  mode?: 'utc' | 'gateway' | 'specific'
  utcOffset?: string
  limit?: number
  includeContextWeight?: boolean
}

export interface SessionUsageEntry {
  key: string
  label?: string
  sessionId?: string
  updatedAt?: number
  agentId?: string
  channel?: string
  chatType?: string
  modelProvider?: string
  model?: string
  usage: CostUsageSummary | null
}

export interface CostUsageSummary {
  totals: UsageTotals
}

export interface UsageTotals {
  inputTokens: number
  outputTokens: number
  totalTokens: number
  totalCost: number
  cacheReadTokens?: number
  cacheWriteTokens?: number
  reasoningTokens?: number
  calls: number
  errors: number
  toolCalls?: number
}

export interface SessionsUsageAggregates {
  messages: { inbound: number; outbound: number; total: number }
  tools: { calls: number; errors: number }
  byModel: Array<{ model: string; count: number; totals: UsageTotals }>
  byProvider: Array<{ provider: string; count: number; totals: UsageTotals }>
  byAgent: Array<{ agentId: string; totals: UsageTotals }>
  byChannel: Array<{ channel: string; totals: UsageTotals }>
  daily: DailyUsage[]
}

export interface DailyUsage {
  date: string
  tokens: number
  cost: number
  messages: number
  toolCalls: number
  errors: number
}

export interface SessionsUsageResult {
  updatedAt: number
  startDate: string
  endDate: string
  sessions: SessionUsageEntry[]
  totals: UsageTotals
  aggregates: SessionsUsageAggregates
}

// ==========================================
// Channel 类型
// ==========================================

export interface ChannelAccountSnapshot {
  accountId: string
  name?: string
  enabled?: boolean
  configured?: boolean
  linked?: boolean
  running?: boolean
  connected?: boolean
  reconnectAttempts?: number
  lastConnectedAt?: number
  lastError?: string
  lastStartAt?: number
  lastStopAt?: number
  lastInboundAt?: number
  lastOutboundAt?: number
  busy?: boolean
  activeRuns?: number
  lastRunActivityAt?: number
  mode?: string
  dmPolicy?: string
  allowFrom?: string[]
}

export interface ChannelUiMeta {
  id: string
  label: string
  detailLabel: string
  systemImage?: string
}

export interface ChannelsStatusResult {
  ts: number
  channelOrder: string[]
  channelLabels: Record<string, string>
  channelDetailLabels?: Record<string, string>
  channelSystemImages?: Record<string, string>
  channelMeta?: ChannelUiMeta[]
  channels: Record<string, unknown>
  channelAccounts: Record<string, ChannelAccountSnapshot[]>
  channelDefaultAccountId: Record<string, string>
}

// ==========================================
// Cron 类型
// ==========================================

export type CronScheduleKind = 'at' | 'every' | 'cron'

export type CronSchedule =
  | { kind: 'at'; at: string }
  | { kind: 'every'; everyMs: number; anchorMs?: number }
  | { kind: 'cron'; expr: string; tz?: string; staggerMs?: number }

export type CronPayload =
  | { kind: 'systemEvent'; text: string }
  | { kind: 'agentTurn'; message: string; model?: string; deliver?: boolean; channel?: string; to?: string }

export interface CronJob {
  id: string
  jobId?: string
  name: string
  enabled: boolean
  schedule: CronSchedule
  payload: CronPayload
  agentId?: string
  sessionKey?: string
  description?: string
  deleteAfterRun?: boolean
  nextRunAtMs?: number
  lastRunAtMs?: number
  createdAtMs?: number
  updatedAtMs?: number
}

export type CronRunStatus = 'ok' | 'error' | 'skipped'

export interface CronRunLogEntry {
  id: string
  jobId: string
  jobName?: string
  status: CronRunStatus
  startedAtMs: number
  durationMs?: number
  error?: string
  deliveryStatus?: 'delivered' | 'not-delivered' | 'unknown' | 'not-requested'
}

export interface CronAddParams {
  name: string
  schedule: CronSchedule
  payload: CronPayload
  agentId?: string | null
  sessionKey?: string | null
  description?: string
  enabled?: boolean
  deleteAfterRun?: boolean
}

export interface CronUpdateParams {
  id?: string
  jobId?: string
  patch: Partial<Omit<CronAddParams, 'name'>> & { name?: string }
}

export interface CronRemoveParams {
  id?: string
  jobId?: string
}

export interface CronRunParams {
  id?: string
  jobId?: string
}

export interface CronRunsParams {
  id?: string
  jobId?: string
  limit?: number
  status?: 'all' | 'ok' | 'error' | 'skipped'
  sort?: 'asc' | 'desc'
}

// ==========================================
// Logs 类型
// ==========================================

export interface LogsTailParams {
  cursor?: number
  limit?: number
  maxBytes?: number
}

// OpenClaw logs.tail 返回原始行，非结构化日志条目
export interface LogsTailResult {
  file: string
  cursor: number
  size: number
  lines: string[]
  truncated?: boolean
  reset?: boolean
}

// 前端解析后的日志条目（从 lines 解析得到）
export interface LogEntry {
  ts: number
  level: string
  source?: string
  message: string
  raw: string
}

// ==========================================
// Config 类型
// ==========================================

export interface ConfigGetParams {
  path?: string
}

export interface ConfigPatchParams {
  [key: string]: unknown
}

// ==========================================
// Exec Approvals 类型
// ==========================================

export interface ExecApprovalRequest {
  id: string
  sessionKey: string
  agentId?: string
  tool?: string
  description?: string
  ts: number
}

export interface ExecApprovalResolveParams {
  requestId: string
  decision: 'approved' | 'denied'
}

// ==========================================
// Node 类型
// ==========================================

export interface NodeListNode {
  nodeId: string
  name?: string
  status: 'online' | 'offline' | 'unknown'
  lastSeenAt?: number
  capabilities?: string[]
  platform?: string
  version?: string
}

// ==========================================
// Models & Skills 类型
// ==========================================

export interface ModelChoice {
  id: string
  name?: string
  provider?: string
  contextWindow?: number
  maxOutput?: number
}

export interface SkillEntry {
  name: string
  version?: string
  status: 'installed' | 'available' | 'updating' | 'error'
  description?: string
}

// ==========================================
// 事件类型 (17 auto-subscribed events)
// ==========================================

export type GatewayEventType =
  | 'connect.challenge'
  | 'agent'
  | 'chat'
  | 'presence'
  | 'tick'
  | 'talk.mode'
  | 'shutdown'
  | 'health'
  | 'heartbeat'
  | 'cron'
  | 'node.pair.requested'
  | 'node.pair.resolved'
  | 'node.invoke.request'
  | 'device.pair.requested'
  | 'device.pair.resolved'
  | 'voicewake.changed'
  | 'exec.approval.requested'
  | 'exec.approval.resolved'
  | 'session.update'
  | 'agent.status'
  | 'update.available'

export interface AgentEvent {
  runId: string
  seq: number
  stream: string
  ts: number
  data: Record<string, unknown>
}

export interface ChatEvent {
  sessionKey?: string
  role?: string
  text?: string
  ts: number
}

export interface TickEvent {
  ts: number
  uptimeMs: number
}

// ==========================================
// 方法名常量
// ==========================================

export const GATEWAY_METHODS = {
  // 健康 & 状态
  HEALTH: 'health',
  STATUS: 'status',
  SYSTEM_PRESENCE: 'system-presence',
  LOGS_TAIL: 'logs.tail',

  // Agents
  AGENTS_LIST: 'agents.list',
  AGENTS_CREATE: 'agents.create',
  AGENTS_UPDATE: 'agents.update',
  AGENTS_DELETE: 'agents.delete',
  AGENTS_FILES_LIST: 'agents.files.list',
  AGENTS_FILES_GET: 'agents.files.get',
  AGENTS_FILES_SET: 'agents.files.set',
  AGENT_IDENTITY_GET: 'agent.identity.get',

  // Sessions
  SESSIONS_LIST: 'sessions.list',
  SESSIONS_PREVIEW: 'sessions.preview',
  SESSIONS_PATCH: 'sessions.patch',
  SESSIONS_RESET: 'sessions.reset',
  SESSIONS_DELETE: 'sessions.delete',
  SESSIONS_COMPACT: 'sessions.compact',
  SESSIONS_USAGE: 'sessions.usage',

  // Chat
  CHAT_HISTORY: 'chat.history',
  CHAT_SEND: 'chat.send',
  CHAT_ABORT: 'chat.abort',

  // Channels
  CHANNELS_STATUS: 'channels.status',
  CHANNELS_LOGOUT: 'channels.logout',

  // Cron
  CRON_LIST: 'cron.list',
  CRON_STATUS: 'cron.status',
  CRON_ADD: 'cron.add',
  CRON_UPDATE: 'cron.update',
  CRON_REMOVE: 'cron.remove',
  CRON_RUN: 'cron.run',
  CRON_RUNS: 'cron.runs',

  // Config
  CONFIG_GET: 'config.get',
  CONFIG_SET: 'config.set',
  CONFIG_APPLY: 'config.apply',
  CONFIG_PATCH: 'config.patch',

  // Usage
  USAGE_STATUS: 'usage.status',
  USAGE_COST: 'usage.cost',

  // Models & Skills
  MODELS_LIST: 'models.list',
  TOOLS_CATALOG: 'tools.catalog',
  SKILLS_STATUS: 'skills.status',
  SKILLS_INSTALL: 'skills.install',

  // Nodes
  NODE_LIST: 'node.list',
  NODE_DESCRIBE: 'node.describe',
  NODE_INVOKE: 'node.invoke',

  // Exec Approvals
  EXEC_APPROVALS_GET: 'exec.approvals.get',
  EXEC_APPROVALS_SET: 'exec.approvals.set',
  EXEC_APPROVAL_RESOLVE: 'exec.approval.resolve',

  // Device Pairing
  DEVICE_PAIR_LIST: 'device.pair.list',
  DEVICE_PAIR_APPROVE: 'device.pair.approve',
  DEVICE_PAIR_REJECT: 'device.pair.reject',

  // Send & Agent
  SEND: 'send',
  AGENT: 'agent',
  WAKE: 'wake',
} as const
