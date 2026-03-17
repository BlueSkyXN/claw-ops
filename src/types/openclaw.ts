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
  id: GatewayClientId
  displayName?: string
  version: string
  platform: string
  deviceFamily?: string
  modelIdentifier?: string
  mode: GatewayClientMode
  instanceId?: string
}

export type GatewayClientId =
  | 'webchat-ui'
  | 'openclaw-control-ui'
  | 'webchat'
  | 'cli'
  | 'gateway-client'
  | 'openclaw-macos'
  | 'openclaw-ios'
  | 'openclaw-android'
  | 'node-host'
  | 'test'
  | 'fingerprint'
  | 'openclaw-probe'

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
  emoji?: string
  avatar?: string
}

export interface AgentsUpdateParams {
  agentId: string
  name?: string
  workspace?: string
  model?: string
  avatar?: string
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
  agentId?: string
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
  spawnedBy?: string
  metadata?: Record<string, unknown>
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
  message: string
  idempotencyKey: string
  attachments?: ChatAttachment[]
  thinking?: string
  deliver?: boolean
  timeoutMs?: number
  systemInputProvenance?: Record<string, unknown>
  systemProvenanceReceipt?: string
  // 以下字段是控制面在 mock / bridge 适配层使用的传输提示，
  // Gateway 出口会在发送前剥离，仅保留官方 chat.send 支持的字段。
  agentId?: string
  channel?: string
  to?: string
  model?: string
  maxTokens?: number
  parentId?: string
  metadata?: Record<string, unknown>
}

export type ChatSendResult =
  | ChatMessage[]
  | {
      runId?: string
      messageId?: string
      channel?: string
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

export interface UsageCostParams {
  startDate?: string
  endDate?: string
  days?: number
  mode?: 'utc' | 'gateway' | 'specific'
  utcOffset?: string
}

export interface SessionOriginInfo {
  label?: string
  provider?: string
  surface?: string
  chatType?: string
  from?: string
  to?: string
  accountId?: string
  threadId?: string | number
}

export interface SessionDailyUsage {
  date: string
  tokens: number
  cost: number
}

export interface SessionDailyMessageCounts {
  date: string
  total: number
  user: number
  assistant: number
  toolCalls: number
  toolResults: number
  errors: number
}

export interface SessionLatencyStats {
  count: number
  avgMs: number
  p95Ms: number
  minMs: number
  maxMs: number
}

export interface SessionDailyLatency extends SessionLatencyStats {
  date: string
}

export interface SessionUsageEntry {
  key: string
  label?: string
  sessionId?: string
  updatedAt?: number
  agentId?: string
  channel?: string
  chatType?: string
  origin?: SessionOriginInfo
  modelOverride?: string
  providerOverride?: string
  modelProvider?: string
  model?: string
  usage: SessionCostSummary | null
  contextWeight?: Record<string, unknown> | null
}

export interface SessionMessageCounts {
  total: number
  user?: number
  assistant?: number
  toolCalls?: number
  toolResults?: number
  errors?: number
  inbound?: number
  outbound?: number
}

export interface SessionToolUsage {
  totalCalls: number
  uniqueTools: number
  tools: Array<{ name: string; count: number }>
  calls?: number
  errors?: number
}

export interface SessionModelUsage {
  provider?: string | null
  model?: string | null
  count: number
  totals: UsageTotals
}

export interface SessionDailyModelUsage {
  date: string
  provider?: string | null
  model?: string | null
  tokens: number
  cost: number
  count: number
}

export interface SessionCostSummary extends UsageTotals {
  totals?: UsageTotals | null
  sessionId?: string
  sessionFile?: string
  firstActivity?: number
  lastActivity?: number
  durationMs?: number
  activityDates?: string[]
  dailyBreakdown?: SessionDailyUsage[]
  dailyMessageCounts?: SessionDailyMessageCounts[]
  dailyLatency?: SessionDailyLatency[]
  dailyModelUsage?: SessionDailyModelUsage[]
  messageCounts?: SessionMessageCounts
  toolUsage?: SessionToolUsage
  modelUsage?: SessionModelUsage[]
  latency?: SessionLatencyStats
}

export type CostUsageSummary = SessionCostSummary

export interface UsageTotals {
  input?: number | null
  output?: number | null
  cacheRead?: number | null
  cacheWrite?: number | null
  totalTokens: number
  totalCost: number
  inputCost?: number | null
  outputCost?: number | null
  cacheReadCost?: number | null
  cacheWriteCost?: number | null
  missingCostEntries?: number | null
  inputTokens?: number | null
  outputTokens?: number | null
  cacheReadTokens?: number | null
  cacheWriteTokens?: number | null
  reasoningTokens?: number | null
  calls?: number | null
  errors?: number | null
  toolCalls?: number | null
}

export interface SessionsUsageAggregates {
  messages: SessionMessageCounts
  tools: SessionToolUsage
  byModel: SessionModelUsage[]
  byProvider: SessionModelUsage[]
  byAgent: Array<{ agentId: string; totals: UsageTotals }>
  byChannel: Array<{ channel: string; totals: UsageTotals }>
  latency?: SessionLatencyStats
  dailyLatency?: SessionDailyLatency[]
  modelDaily?: SessionDailyModelUsage[]
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

export interface UsageCostDailyEntry extends UsageTotals {
  date: string
}

export interface UsageCostSummary {
  updatedAt: number
  days: number
  daily: UsageCostDailyEntry[]
  totals: UsageTotals
}

// ==========================================
// Channel 类型
// ==========================================

export interface ChannelAccountSnapshot {
  accountId: string
  name?: string | null
  enabled?: boolean | null
  configured?: boolean | null
  linked?: boolean | null
  running?: boolean | null
  connected?: boolean | null
  reconnectAttempts?: number | null
  lastConnectedAt?: number | null
  lastError?: string | null
  lastStartAt?: number | null
  lastStopAt?: number | null
  lastInboundAt?: number | null
  lastOutboundAt?: number | null
  lastProbeAt?: number | null
  busy?: boolean | null
  activeRuns?: number | null
  lastRunActivityAt?: number | null
  mode?: string | null
  dmPolicy?: string | null
  allowFrom?: string[] | null
  tokenSource?: string | null
  botTokenSource?: string | null
  appTokenSource?: string | null
  credentialSource?: string | null
  audienceType?: string | null
  audience?: string | null
  webhookPath?: string | null
  webhookUrl?: string | null
  baseUrl?: string | null
  allowUnmentionedGroups?: boolean | null
  cliPath?: string | null
  dbPath?: string | null
  port?: number | null
  probe?: unknown
  audit?: unknown
  application?: unknown
  [key: string]: unknown
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
