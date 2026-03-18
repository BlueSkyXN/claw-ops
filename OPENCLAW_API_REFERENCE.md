# OpenClaw API Reference for claw-ops

> 本文档记录 **claw-ops 当前实际接入并在代码中使用的 OpenClaw / bridge 接口**。
> 它不是 OpenClaw 全量公共 API 的镜像文档。
>
> Source of truth:
>
> - `src/lib/api.ts`
> - `src/lib/gateway-client.ts`
> - `src/lib/orchestration-runtime.ts`
> - `src/types/openclaw.ts`

## 1. 连接协议

claw-ops 通过 WebSocket JSON-RPC 连接 OpenClaw Gateway。

### 握手过程

1. 建立 WebSocket
2. 等待 `connect.challenge`
3. 发送 `connect`
4. 收到 `HelloOk`
5. 后续通过 `req` / `res` / `event` 帧通信

### 请求帧

```ts
interface RequestFrame {
  type: 'req'
  id: string
  method: string
  params?: Record<string, unknown>
}
```

### 响应帧

```ts
interface ResponseFrame {
  type: 'res'
  id: string
  ok: boolean
  payload?: unknown
  error?: ErrorShape
}
```

### 事件帧

```ts
interface EventFrame {
  type: 'event'
  event: string
  payload?: unknown
  seq?: number
  stateVersion?: StateVersion
}
```

## 2. 认证与 scopes

当前类型层定义的 scopes：

- `operator.read`
- `operator.write`
- `operator.admin`
- `operator.approvals`
- `operator.pairing`

当前 Setup UI 提供的认证方式：

- token
- password

## 3. 当前实际使用的方法

| 分类 | 方法 |
|---|---|
| 状态 | `health`, `system-presence` |
| 智能体 | `agents.list`, `agents.create`, `agents.update`, `agents.delete` |
| Agent 文件 | `agents.files.list`, `agents.files.get`, `agents.files.set` |
| 技能 | `skills.status`, `skills.install` |
| 会话 | `sessions.list`, `sessions.patch`, `sessions.reset`, `sessions.delete` |
| 用量 | `sessions.usage`, `usage.cost` |
| Chat | `chat.send` |
| 渠道 | `channels.status` |
| 定时任务 | `cron.list`, `cron.add`, `cron.update`, `cron.remove`, `cron.run`, `cron.runs` |
| 日志 | `logs.tail` |
| 模型 / 节点 / 配置 | `models.list`, `node.list`, `config.get` |
| 审批 | `exec.approvals.get`, `exec.approval.resolve` |

## 4. `chat.send`

### 当前核心入参

```ts
interface ChatSendParams {
  sessionKey: string
  message: string
  idempotencyKey: string
}
```

### claw-ops 扩展提示字段

控制面内部还会携带：

- `agentId`
- `channel`
- `to`
- `metadata`

但这些只用于 mock / bridge / 本地运行时适配。

Gateway 出口会在发送前剥离这些字段，仅保留官方 `chat.send` 支持的参数。

## 5. 当前主要类型

### `GatewaySessionRow`

```ts
interface GatewaySessionRow {
  key: string
  kind: 'direct' | 'group' | 'global' | 'unknown'
  agentId?: string
  label?: string
  displayName?: string
  derivedTitle?: string
  lastMessagePreview?: string
  channel?: string
  updatedAt: number | null
  sendPolicy?: 'allow' | 'deny'
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
  modelProvider?: string
  model?: string
  metadata?: Record<string, unknown>
}
```

### `ChatSendParams`

```ts
interface ChatSendParams {
  sessionKey: string
  message: string
  idempotencyKey: string
  attachments?: ChatAttachment[]
  thinking?: string
  deliver?: boolean
  timeoutMs?: number
  systemInputProvenance?: Record<string, unknown>
  systemProvenanceReceipt?: string
  agentId?: string
  channel?: string
  to?: string
  model?: string
  maxTokens?: number
  parentId?: string
  metadata?: Record<string, unknown>
}
```

### `ChannelsStatusResult`

```ts
interface ChannelsStatusResult {
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
```

### `SessionsUsageResult`

```ts
interface SessionsUsageResult {
  updatedAt: number
  startDate: string
  endDate: string
  sessions: SessionUsageEntry[]
  totals: UsageTotals
  aggregates: SessionsUsageAggregates
}
```

### `CronJob`

```ts
interface CronJob {
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
}
```

## 6. 当前使用的事件

### Layout 监听

- `exec.approval.requested`
- `exec.approval.resolved`

### 编排运行时监听

- `agent`
- `chat`
- `presence`
- `health`
- `cron`
- `exec.approval.requested`
- `exec.approval.resolved`
- `session.update`
- `agent.status`

> Gateway 协议本身可能还有更多事件，但本仓库当前 UI 只对以上事件建立明确逻辑。

## 7. bridge 接口

bridge 不是 OpenClaw Gateway 的一部分，但它是 claw-ops 当前运行路径的一部分。

### HTTP

- `GET /health`
- `GET /capabilities`
- `POST /rpc`

### 鉴权头

```http
X-Claw-Ops-Bridge-Token: <token>
```

## 8. 相关文档

- `docs/API-INTEGRATION.md`
- `docs/ARCHITECTURE.md`
- `docs/PAGES.md`
