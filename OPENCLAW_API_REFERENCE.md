# OpenClaw API Surface Reference

**Generated:** $(date)
**Sources:** OpenClaw Gateway Protocol & Server Methods
**Version:** Latest (main branch)

---

## Table of Contents
1. [Connection Protocol](#connection-protocol)
2. [Method Categories](#method-categories)
3. [Scopes & Authorization](#scopes--authorization)
4. [WebSocket Frame Types](#websocket-frame-types)
5. [Auto-Subscribed Events](#auto-subscribed-events)
6. [Type Definitions](#type-definitions)
7. [HTTP Endpoints](#http-endpoints)
8. [Built-in UI Tabs](#built-in-ui-tabs)

---

## Connection Protocol

### GatewayClient Class
**Location:** `src/gateway/client.ts`

```typescript
export class GatewayClient {
  constructor(opts: GatewayClientOptions)
  start(): void
  stop(): void
  request(method: string, params?: Record<string, unknown>): Promise<unknown>
  send(data: unknown): void
}
```

### GatewayClientOptions
```typescript
{
  url?: string                          // ws://127.0.0.1:18789
  connectDelayMs?: number
  tickWatchMinIntervalMs?: number
  token?: string
  deviceToken?: string
  password?: string
  instanceId?: string
  clientName?: GatewayClientName        // "cli", "ui", "webchat", etc.
  clientDisplayName?: string
  clientVersion?: string
  platform?: string
  deviceFamily?: string
  mode?: GatewayClientMode              // "default", "probe", etc.
  role?: string                         // "operator" or "node"
  scopes?: string[]                     // ["operator.read", "operator.write", ...]
  caps?: string[]                       // Capabilities
  commands?: string[]
  permissions?: Record<string, boolean>
  pathEnv?: string
  deviceIdentity?: DeviceIdentity
  minProtocol?: number
  maxProtocol?: number
  tlsFingerprint?: string
  
  // Callbacks
  onEvent?: (evt: EventFrame) => void
  onHelloOk?: (hello: HelloOk) => void
  onConnectError?: (err: Error) => void
  onClose?: (code: number, reason: string) => void
  onGap?: (info: { expected: number; received: number }) => void
}
```

### ConnectParams (Hello Frame)
```typescript
{
  minProtocol: number                   // Min supported protocol version
  maxProtocol: number                   // Max supported protocol version
  client: {
    id: string                          // CONTROL_UI, CLI, WEBCHAT, etc.
    displayName?: string
    version: string                     // e.g., "1.0.0"
    platform: string                    // "darwin", "linux", "windows", "web"
    deviceFamily?: string               // "desktop", "mobile", "tablet"
    modelIdentifier?: string
    mode: string                        // "default", "probe"
    instanceId?: string
  }
  caps?: string[]                       // ["canvas", "voice", etc.]
  commands?: string[]
  permissions?: Record<string, boolean>
  pathEnv?: string
  role?: string                         // "operator" or "node"
  scopes?: string[]
  device?: {
    id: string
    publicKey: string                   // Base64-encoded
    signature: string
    signedAt: number                    // Unix ms
    nonce: string
  }
  auth?: {
    token?: string
    deviceToken?: string
    password?: string
  }
  locale?: string                       // e.g., "en-US"
  userAgent?: string
}
```

### HelloOk Response
```typescript
{
  type: "hello-ok"
  protocol: number                      // Negotiated protocol version
  server: {
    version: string
    connId: string                      // Unique connection ID
  }
  features: {
    methods: string[]                   // Available methods list
    events: string[]                    // Subscribable events
  }
  snapshot: Snapshot                    // Current system state
  canvasHostUrl?: string
  auth?: {
    deviceToken: string                 // New device token (store locally)
    role: string
    scopes: string[]
    issuedAtMs?: number
  }
}
```

---

## WebSocket Frame Types

### RequestFrame
**Request from client to server**
```typescript
{
  id: string                            // Unique request ID
  method: string                        // Method name
  params?: Record<string, unknown>      // Method parameters
}
```

### ResponseFrame
**Response from server to client**
```typescript
{
  id: string                            // Matches request ID
  ok: boolean                           // Success indicator
  result?: unknown                      // Return value (if ok=true)
  error?: ErrorShape                    // Error details (if ok=false)
}
```

### EventFrame
**Server-pushed event**
```typescript
{
  event: string                         // Event name
  seq: number                           // Sequence number
  data?: unknown                        // Event payload
}
```

### ErrorShape
```typescript
{
  code: string                          // Error code (e.g., "INVALID_REQUEST")
  message: string                       // Human-readable message
  details?: Record<string, unknown>     // Additional context
}
```

---

## Scopes & Authorization

### Available Scopes
```typescript
ADMIN_SCOPE = "operator.admin"          // Full access
READ_SCOPE = "operator.read"            // Read-only
WRITE_SCOPE = "operator.write"          // Write operations
APPROVALS_SCOPE = "operator.approvals"  // Execution approvals
PAIRING_SCOPE = "operator.pairing"      // Device/node pairing
```

### Scope Hierarchy
- `operator.admin` → All methods
- `operator.write` → Includes `operator.read` methods
- `operator.read` → Explicit read methods only
- `operator.approvals` → Only approval methods
- `operator.pairing` → Only pairing methods

---

## Method Categories

### AGENTS (10 methods)
**Scope:** Mixed (READ/WRITE/ADMIN)

| Method | Scope | Params | Returns |
|--------|-------|--------|---------|
| `agents.list` | READ | {} | AgentsListResult |
| `agents.create` | ADMIN | AgentsCreateParams | AgentsCreateResult |
| `agents.update` | ADMIN | AgentsUpdateParams | AgentsUpdateResult |
| `agents.delete` | ADMIN | AgentsDeleteParams | AgentsDeleteResult |
| `agents.files.list` | READ | AgentsFilesListParams | AgentsFilesListResult |
| `agents.files.get` | READ | AgentsFilesGetParams | AgentsFilesGetResult |
| `agents.files.set` | ADMIN | AgentsFilesSetParams | AgentsFilesSetResult |
| `agent.identity.get` | READ | { agentId?: string; sessionKey?: string } | GatewayAgentIdentity |
| `agent` | WRITE | AgentWaitParams | { ok: true; result: unknown } |
| `agent.wait` | WRITE | AgentWaitParams | { ok: true; result: unknown } |

#### AgentWaitParams
```typescript
{
  sessionKey: string                    // Session identifier
  runId?: string                        // Optional run ID
  timeoutMs?: number                    // Timeout in ms
}
```

### SESSIONS (8 methods)
**Scope:** Mixed (READ/WRITE/ADMIN)

| Method | Scope | Params | Returns |
|--------|-------|--------|---------|
| `sessions.list` | READ | SessionsListParams | SessionsListResult |
| `sessions.preview` | READ | SessionsPreviewParams | SessionsPreviewResult |
| `sessions.resolve` | READ | SessionsResolveParams | SessionEntry |
| `sessions.get` | READ | { key: string } | SessionEntry |
| `sessions.patch` | ADMIN | SessionsPatchParams | SessionsPatchResult |
| `sessions.reset` | ADMIN | SessionsResetParams | { ok: true; result: unknown } |
| `sessions.delete` | ADMIN | SessionsDeleteParams | { removed: boolean; moved?: boolean } |
| `sessions.compact` | ADMIN | SessionsCompactParams | { compacted: number; freed: number } |

#### SessionsListParams
```typescript
{
  limit?: number                        // Max results (default: 100)
  offset?: number                       // Pagination offset
  query?: string                        // Search/filter string
  agentId?: string                      // Filter by agent
  channel?: string                      // Filter by channel
  sortBy?: "updatedAtMs" | "createdAtMs" | "key"
  sortDir?: "asc" | "desc"
}
```

#### SessionEntry (Response Type)
```typescript
{
  key: string                           // Session key (agent:sessionId format)
  sessionId: string                     // Unique session ID
  agentId?: string                      // Associated agent
  createdAtMs: number
  updatedAtMs: number
  origin?: SessionOrigin                // Channel/user origin
  lastMessageAt?: number
  messageCount?: number
  modelOverride?: string
  providerOverride?: string
  acp?: SessionAcpMeta
  archived?: boolean
}
```

### CHAT (4 methods)
**Scope:** WRITE

| Method | Scope | Params | Returns |
|--------|-------|--------|---------|
| `chat.send` | WRITE | ChatSendParams | ChatMessage[] |
| `chat.history` | READ | ChatHistoryParams | ChatMessage[] |
| `chat.abort` | WRITE | ChatAbortParams | { aborted: boolean; reason?: string } |
| `chat.inject` | ADMIN | ChatInjectParams | { ok: true; messageId?: string } |

#### ChatSendParams
```typescript
{
  sessionKey: string                    // Session identifier
  message: string                       // Message text
  idempotencyKey: string                // Client-generated dedupe key
  attachments?: ChatAttachment[]        // Uploaded files
  thinking?: boolean
  deliver?: boolean
  timeoutMs?: number
  systemInputProvenance?: string
  systemProvenanceReceipt?: string
}
```

> 注意：`chat.send` 当前 schema 为 `additionalProperties: false`。旧版 `text`、`agentId`、`channel`、`to`、`metadata` 等字段已经不再被 Gateway 接受。

#### ChatMessage (Response Type)
```typescript
{
  id: string                            // Message ID
  role: "user" | "assistant"
  text: string
  timestamp?: number                    // Unix ms
  modelUsage?: {
    input_tokens?: number
    output_tokens?: number
    cost?: number
  }
  attachments?: ChatAttachment[]
}
```

### CRON (7 methods)
**Scope:** Mixed (READ/WRITE/ADMIN)

| Method | Scope | Params | Returns |
|--------|-------|--------|---------|
| `cron.list` | READ | CronListParams | { count: number; jobs: CronJob[] } |
| `cron.status` | READ | {} | { running: boolean; nextMs?: number } |
| `cron.add` | ADMIN | CronAddParams | CronJob |
| `cron.update` | ADMIN | CronUpdateParams | CronJob |
| `cron.remove` | ADMIN | { id: string } | { removed: boolean } |
| `cron.run` | ADMIN | { id: string; mode?: "force" \| "due" } | CronRunResult |
| `cron.runs` | READ | CronRunsParams | { runs: CronRun[] } |

#### CronJob (Type)
```typescript
{
  id: string
  name: string
  description?: string
  schedule: CronSchedule                // See below
  payload: CronPayload                  // Execution payload
  delivery?: CronDelivery               // Delivery config
  failureAlert?: CronFailureAlert
  enabled?: boolean
  createdAtMs?: number
  updatedAtMs?: number
  nextRunAtMs?: number
  lastRunAtMs?: number
  tags?: string[]
}
```

#### CronSchedule (Type)
```typescript
// At specific time
{ kind: "at"; at: string }              // ISO 8601 timestamp

// Every N milliseconds
{ kind: "every"; everyMs: number; anchorMs?: number }

// Cron expression
{
  kind: "cron";
  expr: string                          // "0 9 * * *" (9am daily)
  tz?: string                           // "America/New_York"
  staggerMs?: number                    // Randomization window
}
```

### CONFIG (5 methods)
**Scope:** Mixed (READ/ADMIN)

| Method | Scope | Params | Returns |
|--------|-------|--------|---------|
| `config.get` | READ | {} | ConfigSnapshot |
| `config.schema` | READ | {} | ConfigSchema |
| `config.schema.lookup` | READ | { path: string } | ConfigSchemaEntry |
| `config.set` | ADMIN | ConfigSetParams | ConfigSetResult |
| `config.patch` | ADMIN | ConfigPatchParams | ConfigPatchResult |
| `config.apply` | ADMIN | ConfigApplyParams | ConfigApplyResult |

#### ConfigSnapshot (Response Type)
```typescript
{
  exists: boolean
  valid: boolean
  hash?: string                         // Base hash for concurrent edits
  config?: OpenClawConfig               // Full config object
  errors?: ValidationError[]
}
```

### CHANNELS (2 methods)
**Scope:** Mixed (READ/ADMIN)

| Method | Scope | Params | Returns |
|--------|-------|--------|---------|
| `channels.status` | READ | { probe?: boolean; timeoutMs?: number } | ChannelsStatusResult |
| `channels.logout` | ADMIN | { channel: string; accountId?: string } | ChannelLogoutPayload |

#### ChannelsStatusResult (Response Type)
```typescript
{
  ts: number                            // Timestamp
  channelOrder: string[]
  channelLabels: Record<string, string>
  channelDetailLabels: Record<string, string>
  channelSystemImages: Record<string, string>
  channelMeta: Record<string, unknown>
  channels: Record<string, unknown>     // Channel summaries
  channelAccounts: Record<string, ChannelAccountSnapshot[]>
  channelDefaultAccountId: Record<string, string>
}
```

### USAGE (3 methods)
**Scope:** READ

| Method | Scope | Params | Returns |
|--------|-------|--------|---------|
| `usage.status` | READ | {} | UsageStatusResult |
| `usage.cost` | READ | { startDate?: string; endDate?: string } | CostSummary |
| `sessions.usage` | READ | SessionsUsageParams | SessionsUsageResult |

#### SessionsUsageResult (Response Type)
```typescript
{
  updatedAt: number
  startDate: string                     // ISO 8601
  endDate: string
  sessions: SessionUsageEntry[]
  totals: {
    input_tokens?: number
    output_tokens?: number
    total_cost?: number
    cache_read_tokens?: number
    cache_write_tokens?: number
  }
  aggregates: {
    messages: SessionMessageCounts
    tools: SessionToolUsage
    byModel: SessionModelUsage[]
    byProvider: SessionModelUsage[]
    byAgent: Array<{ agentId: string; totals: any }>
    byChannel: Array<{ channel: string; totals: any }>
    daily: Array<{ date: string; tokens: number; cost: number }>
  }
}
```

### LOGS (1 method)
**Scope:** READ

| Method | Scope | Params | Returns |
|--------|-------|--------|---------|
| `logs.tail` | READ | LogsTailParams | LogsTailResult |

#### LogsTailParams
```typescript
{
  cursor?: number                       // File position for tailing
  limit?: number                        // Max lines (1-5000, default 500)
  maxBytes?: number                     // Max bytes (1B-1MB, default 250KB)
}
```

#### LogsTailResult
```typescript
{
  file: string                          // Log file path
  cursor: number                        // Updated file position
  size: number                          // File size
  lines: string[]                       // Log lines
  truncated: boolean                    // File was truncated
  reset: boolean                        // Cursor was beyond EOF
}
```

### HEALTH & STATUS (3 methods)
**Scope:** READ/None

| Method | Scope | Params | Returns |
|--------|-------|--------|---------|
| `health` | None | {} | HealthStatus |
| `status` | READ | {} | SystemStatus |
| `system-presence` | READ | {} | SystemPresence[] |

#### HealthStatus (Response Type)
```typescript
{
  ok: boolean
  uptime?: number                       // Seconds
  message?: string
}
```

### MODELS (1 method)
**Scope:** READ

| Method | Scope | Params | Returns |
|--------|-------|--------|---------|
| `models.list` | READ | ModelsListParams | ModelChoice[] |

#### ModelChoice (Response Type)
```typescript
{
  id: string
  name: string
  provider?: string
  capabilities?: string[]
  maxTokens?: number
  costPer1MInput?: number
  costPer1MOutput?: number
}
```

### SKILLS (3 methods)
**Scope:** Mixed (READ/ADMIN)

| Method | Scope | Params | Returns |
|--------|-------|--------|---------|
| `skills.status` | READ | {} | SkillsStatus |
| `skills.install` | ADMIN | SkillsInstallParams | { installed: boolean } |
| `skills.update` | ADMIN | SkillsUpdateParams | { updated: boolean } |

### NODES (7 methods)
**Scope:** Mixed (READ/WRITE/PAIRING)

| Method | Scope | Params | Returns |
|--------|-------|--------|---------|
| `node.list` | READ | NodeListParams | NodeInfo[] |
| `node.describe` | READ | NodeDescribeParams | NodeInfo |
| `node.invoke` | WRITE | NodeInvokeParams | NodeInvokeResult |
| `node.pair.request` | PAIRING | NodePairRequestParams | { code: string } |
| `node.pair.list` | PAIRING | NodePairListParams | PairingRequest[] |
| `node.pair.approve` | PAIRING | NodePairApproveParams | { approved: boolean } |
| `node.pair.reject` | PAIRING | NodePairRejectParams | { rejected: boolean } |

---

## Auto-Subscribed Events

**17 Gateway Events (automatically subscribed on connection)**

```typescript
export const GATEWAY_EVENTS = [
  "connect.challenge",                  // Auth challenge
  "agent",                              // Agent execution event
  "chat",                               // Chat message
  "presence",                           // System presence change
  "tick",                               // Heartbeat/ping
  "talk.mode",                          // Voice mode change
  "shutdown",                           // Server shutdown
  "health",                             // Health status
  "heartbeat",                          // Periodic heartbeat
  "cron",                               // Cron job execution
  "node.pair.requested",                // Node pairing request
  "node.pair.resolved",                 // Node pairing resolved
  "node.invoke.request",                // Node invoke request
  "device.pair.requested",              // Device pairing request
  "device.pair.resolved",               // Device pairing resolved
  "voicewake.changed",                  // Voice wake config
  "exec.approval.requested",            // Execution approval needed
  "exec.approval.resolved",             // Approval resolved
  "update.available",                   // Update notification
];
```

### Event Frame Structure
```typescript
{
  event: string                         // Event name from list above
  seq: number                           // Monotonic sequence
  data?: {                              // Event-specific payload
    // Varies by event type
  }
}
```

### Key Event Payloads

#### "agent" Event
```typescript
{
  sessionKey: string
  runId: string
  status: "started" | "thinking" | "responding" | "done" | "error"
  result?: unknown
  message?: string
}
```

#### "chat" Event
```typescript
{
  sessionKey: string
  role: "user" | "assistant"
  text: string
  id?: string
  timestamp?: number
}
```

#### "tick" Event
```typescript
{
  ts: number                            // Unix ms
}
```

#### "shutdown" Event
```typescript
{
  reason: string
  restartExpectedMs?: number
}
```

---

## Type Definitions

### Session Types

#### SessionOrigin
```typescript
{
  label?: string
  provider?: string                     // Channel name (slack, discord, etc.)
  surface?: string                      // Direct, group, channel, etc.
  chatType?: string
  from?: string                         // User/channel identifier
  to?: string                           // Bot/user identifier
  accountId?: string                    // Multi-account support
  threadId?: string | number            // Thread/conversation ID
}
```

#### SessionAcpMeta
```typescript
{
  identity?: SessionAcpIdentity         // Control plane identity
  runtimeOptions?: AcpSessionRuntimeOptions
}
```

### Agent Types

#### GatewayAgentIdentity
```typescript
{
  name?: string
  theme?: string                        // Color theme
  emoji?: string                        // Display emoji
  avatar?: string                       // Avatar data/base64
  avatarUrl?: string                    // Avatar URL
}
```

#### GatewayAgentRow
```typescript
{
  id: string
  name?: string
  identity?: GatewayAgentIdentity
}
```

### Cost/Usage Types

#### CostUsageTotals
```typescript
{
  input: number                         // Input tokens
  output: number                        // Output tokens
  cacheRead: number                     // Cache read tokens
  cacheWrite: number                    // Cache write tokens
  totalTokens: number
  totalCost: number                     // USD
  inputCost: number
  outputCost: number
  cacheReadCost: number
  cacheWriteCost: number
  missingCostEntries: number
}
```

#### SessionCostSummary
```typescript
{
  updatedAtMs?: number
  messageCount?: number
  toolCallCount?: number
  errorCount?: number
  totals?: CostUsageTotals
  byModel?: SessionModelUsage[]
  daily?: SessionDailyUsage[]
}
```

### Channel Types

#### ChannelAccountSnapshot
```typescript
{
  accountId: string
  enabled: boolean
  configured?: boolean
  loggedOut?: boolean
  lastProbeAt?: number
  lastInboundAt?: number
  lastOutboundAt?: number
  probe?: unknown                       // Probe result
  audit?: unknown                       // Audit result
}
```

---

## HTTP Endpoints

**Location:** `src/gateway/server-http.ts`

### Health Checks
- `GET /health` → 200 if live
- `GET /healthz` → 200 if live
- `GET /ready` → 200 if ready
- `GET /readyz` → 200 if ready

### WebSocket
- `WS ws://127.0.0.1:18789` → Gateway WebSocket endpoint
- `WSS wss://127.0.0.1:18789` → Secure endpoint

### Channel Webhooks
- `POST /api/channels/mattermost/command` → Mattermost slash commands
- `POST /api/channels/{channel}/{action}` → Channel-specific endpoints

### Plugin Routes
- `GET/POST /plugins/{pluginId}/{path}` → Plugin HTTP handlers

### OpenAI Compatibility
- `POST /v1/*` → OpenAI-compatible endpoints

### Canvas Host
- `WS /canvas/*` → Canvas-specific WebSocket path

---

## Built-in UI Tabs

**Location:** `ui/src/ui/navigation.ts`

### Tab Groups
```typescript
[
  { label: "chat", tabs: ["chat"] },
  {
    label: "control",
    tabs: ["overview", "channels", "instances", "sessions", "usage", "cron"]
  },
  { label: "agent", tabs: ["agents", "skills", "nodes"] },
  { label: "settings", tabs: ["config", "debug", "logs"] }
]
```

### All Tabs
| Tab | Icon | Path | Group |
|-----|------|------|-------|
| chat | messageSquare | /chat | Chat |
| overview | barChart | /overview | Control |
| channels | link | /channels | Control |
| instances | radio | /instances | Control |
| sessions | fileText | /sessions | Control |
| usage | barChart | /usage | Control |
| cron | loader | /cron | Control |
| agents | folder | /agents | Agent |
| skills | zap | /skills | Agent |
| nodes | monitor | /nodes | Agent |
| config | settings | /config | Settings |
| debug | bug | /debug | Settings |
| logs | scrollText | /logs | Settings |

---

## Method Summary

### Total Methods: 100+

**By Scope:**
- READ: 27 methods
- WRITE: 10 methods
- ADMIN: 40+ methods
- APPROVALS: 3 methods
- PAIRING: 8 methods
- NONE: 1 method (health)

**By Category:**
- Agents: 10 methods
- Sessions: 8 methods
- Chat: 4 methods
- Cron: 7 methods
- Config: 6 methods
- Channels: 2 methods
- Usage: 3 methods
- Logs: 1 method
- Health/Status: 3 methods
- Models: 1 method
- Skills: 3 methods
- Nodes: 7+ methods
- Device/Pairing: 8+ methods
- Execution Approvals: 5+ methods
- Other: 20+ methods (TTS, WebLogin, Wizard, Talk, Browser, etc.)

---

## Implementation Notes

### Protocol Constants
```typescript
export const PROTOCOL_VERSION = 3       // Current protocol version
export const GATEWAY_HEARTBEAT_INTERVAL_MS = 30_000
export const GATEWAY_CLIENT_TIMEOUT_MS = 60_000
```

### Client Modes
```typescript
"default"    // Normal operation
"probe"      // Health check only
```

### Client Names (IDs)
```typescript
"control-ui"
"webchat"
"cli"
"mobile"
"canvas"
"node"
```

### Gateway Client Capabilities
```typescript
GATEWAY_CLIENT_CAPS = {
  CANVAS: "canvas"
  VOICE: "voice"
  THINKING: "thinking"
  FILES: "files"
  // ... others
}
```

---

## Error Codes

```typescript
"INVALID_REQUEST"     // Malformed request
"UNAVAILABLE"        // Temporary service issue
"FORBIDDEN"          // Authorization failed
"NOT_FOUND"          // Resource not found
"TIMEOUT"            // Operation timeout
```

---

## File References

**Core Files:**
- `/src/gateway/server-methods-list.ts` - Method registry
- `/src/gateway/method-scopes.ts` - Scope definitions
- `/src/gateway/client.ts` - GatewayClient implementation
- `/src/gateway/probe.ts` - Health probe protocol
- `/src/gateway/server-http.ts` - HTTP endpoint handlers
- `/src/gateway/server-methods.ts` - Method dispatcher
- `/src/gateway/protocol/index.ts` - Protocol types
- `/src/gateway/events.ts` - Event definitions

**Method Handlers:**
- `/src/gateway/server-methods/agents.ts` - Agent methods
- `/src/gateway/server-methods/sessions.ts` - Session methods
- `/src/gateway/server-methods/cron.ts` - Cron methods
- `/src/gateway/server-methods/channels.ts` - Channel methods
- `/src/gateway/server-methods/config.ts` - Config methods
- `/src/gateway/server-methods/usage.ts` - Usage methods
- `/src/gateway/server-methods/chat.ts` - Chat methods
- `/src/gateway/server-methods/logs.ts` - Log methods
- `/src/gateway/server-methods/agent.ts` - Agent execution
- Plus 25+ additional method handler modules

**Type Definitions:**
- `/src/shared/session-types.ts` - Session types
- `/src/shared/usage-types.ts` - Usage types
- `/src/cron/types.ts` - Cron job types
- `/src/infra/session-cost-usage.ts` - Cost/usage types
- `/src/config/sessions/types.ts` - Session configuration
- `/src/gateway/protocol/schema/types.ts` - Protocol types

**UI:**
- `/ui/src/ui/navigation.ts` - Built-in UI tabs
