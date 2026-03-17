# claw-ops — API 对接文档

## 概述

当前已实现的 claw-ops 集成方式有两种：

- `demo`：`mockAPI`
- `realtime`：`GatewayAPI`，通过 WebSocket JSON-RPC（OpenClaw 协议）连接 OpenClaw Gateway

统一的 `DataAPI` 接口负责隔离页面组件与底层 provider。CLI / Hybrid 目前**尚未实现**，但已经形成正式设计规格，见 [`docs/CLI-HYBRID-INTEGRATION.md`](./CLI-HYBRID-INTEGRATION.md)。

**通信协议**：WebSocket JSON-RPC（非 REST）
**客户端**：`src/lib/gateway-client.ts` — `GatewayClient` 类
**统一接口**：`src/lib/api.ts` — `DataAPI` 接口
**类型定义**：`src/types/openclaw.ts` — 686 行完整协议类型

## WebSocket 连接流程

```
1. 建立 WebSocket 连接
   new WebSocket('ws://127.0.0.1:18789')

2. 等待 Gateway 发送 `connect.challenge` 事件

3. 发送 `type: "req"` / `method: "connect"` 的握手请求
   {
      "type": "req",
      "id": "req-1",
      "method": "connect",
      "params": {
        "minProtocol": 3,
        "maxProtocol": 3,
        "client": {
          "id": "openclaw-control-ui",
          "displayName": "claw-ops",
          "version": "0.1.0",
          "platform": "web",
          "mode": "webchat",
          "instanceId": "<uuid>"
        },
        "role": "operator",
        "auth": {                  // 认证信息嵌套在 auth 对象中
          "token": "<auth-token>"  // 或 "password": "<password>"
        },
        "scopes": ["operator.read", "operator.write", "operator.admin"]
      }
    }

4. 收到 `res` 帧，payload 为 `hello.ok`
    {
      "type": "res",
      "id": "req-1",
      "ok": true,
      "payload": {
        "protocol": 3,
        "snapshot": {
          "presence": [...],
          "health": {...},
          "stateVersion": {...},
          "uptimeMs": 123456
        }
      }
    }

5. 连接建立完成，可继续发送其它 JSON-RPC 请求
```

## 认证方式

OpenClaw Gateway 协议层支持多种认证模式：

| 模式 | connect.auth 参数 | 说明 |
|------|-------------------|------|
| `token` | `"auth": { "token": "<token>" }` | Bearer Token 认证 |
| `password` | `"auth": { "password": "<password>" }` | 密码认证 |
| `none` | `auth` 省略 | 无认证（开发环境） |
| `trusted-proxy` | 由代理处理 | 反向代理信任模式 |

当前 `src/pages/Setup.tsx` 只提供 `token` / `password` 两种 UI 选项，并将凭据存储在 localStorage。协议层支持并不等于当前 UI 已全部开放。

## 授权范围 (Scopes)

| Scope | 说明 |
|-------|------|
| `operator.read` | 读取系统状态、智能体、会话、渠道等 |
| `operator.write` | 创建/修改/删除智能体、会话、定时任务等 |
| `operator.admin` | 系统管理操作 |
| `operator.approvals` | 执行审批操作 |
| `operator.pairing` | 设备/节点配对操作 |

## DataAPI 接口定义

```typescript
interface DataAPI {
  // 状态
  getHealth(): Promise<{ ok: boolean; uptimeMs?: number }>
  getSnapshot(): Promise<Snapshot | null>
  getPresence(): Promise<PresenceEntry[]>

  // 智能体
  getAgents(): Promise<AgentSummary[]>
  createAgent(params: { name: string; workspace?: string }): Promise<{ agentId: string }>
  updateAgent(params: { agentId: string; [key: string]: unknown }): Promise<void>
  deleteAgent(params: { agentId: string }): Promise<void>

  // Agent Files
  agentFilesList(agentId: string): Promise<AgentsFileEntry[]>
  agentFilesGet(agentId: string, path: string): Promise<string>
  agentFilesSet(agentId: string, path: string, content: string): Promise<void>

  // Skills
  installSkill(skillId: string): Promise<void>

  // 会话
  getSessions(params?: SessionsListParams): Promise<SessionsListResult>
  patchSession(params: { key: string; [key: string]: unknown }): Promise<void>
  resetSession(key: string): Promise<void>
  deleteSession(key: string): Promise<void>
  getSessionsUsage(params?: SessionsUsageParams): Promise<SessionsUsageResult>
  getUsageCost(params?: UsageCostParams): Promise<UsageCostSummary>

  // Chat
  sendChatMessage(params: ChatSendParams): Promise<ChatSendResult>

  // 渠道
  getChannelsStatus(): Promise<ChannelsStatusResult>

  // 定时任务
  getCronJobs(): Promise<CronJob[]>
  addCronJob(params: CronAddParams): Promise<{ id: string }>
  updateCronJob(params: CronUpdateParams): Promise<void>
  removeCronJob(params: CronRemoveParams): Promise<void>
  runCronJob(params: CronRunParams): Promise<void>
  getCronRuns(params: CronRunsParams): Promise<CronRunLogEntry[]>

  // 日志（返回前端解析后的 LogEntry[]，原始数据是 LogsTailResult 的 string lines）
  getLogs(params?: LogsTailParams): Promise<LogEntry[]>

  // 模型与技能
  getModels(): Promise<ModelChoice[]>
  getSkills(): Promise<SkillEntry[]>

  // 节点
  getNodes(): Promise<NodeListNode[]>

  // 配置
  getConfig(): Promise<Record<string, unknown>>

  // 执行审批
  getExecApprovals(): Promise<ExecApprovalRequest[]>
  resolveExecApproval(requestId: string, decision: 'approved' | 'denied'): Promise<void>
}
```

## JSON-RPC 方法映射

DataAPI 方法与 OpenClaw Gateway JSON-RPC 方法的映射关系：

### 状态与健康

| DataAPI 方法 | JSON-RPC 方法 | 说明 |
|-------------|--------------|------|
| `getHealth()` | `health` | 健康检查 |
| `getSnapshot()` | 连接时自动获取 | 系统快照（presence + health + uptime） |
| `getPresence()` | `system-presence` | 在线状态列表 |

### 智能体

| DataAPI 方法 | JSON-RPC 方法 | 说明 |
|-------------|--------------|------|
| `getAgents()` | `agents.list` | 列出所有智能体 |
| `createAgent()` | `agents.create` | 创建智能体 |
| `updateAgent()` | `agents.update` | 更新智能体 |
| `deleteAgent()` | `agents.delete` | 删除智能体 |

> 说明：网关 `agents.update` 仅接受 `agentId`、`name`、`workspace`、`model`、`avatar` 五个字段（`additionalProperties: false`）。`emoji` 仅在 `agents.create` 阶段通过 IDENTITY.md 写入。

### Agent 文件与技能

| DataAPI 方法 | JSON-RPC 方法 | 说明 |
|-------------|--------------|------|
| `agentFilesList()` | `agents.files.list` | 列出 agent 工作区文件 |
| `agentFilesGet()` | `agents.files.get` | 读取文件内容 |
| `agentFilesSet()` | `agents.files.set` | 写入文件内容 |
| `installSkill()` | `skills.install` | 安装技能 |

### 会话

| DataAPI 方法 | JSON-RPC 方法 | 默认参数 |
|-------------|--------------|---------|
| `getSessions()` | `sessions.list` | `limit:100, includeDerivedTitles:true` |
| `patchSession()` | `sessions.patch` | — |
| `resetSession()` | `sessions.reset` | `{ key }` |
| `deleteSession()` | `sessions.delete` | `{ key }` |
| `getSessionsUsage()` | `sessions.usage` | — |
| `getUsageCost()` | `usage.cost` | 用量费用汇总 |

### Chat

| DataAPI 方法 | JSON-RPC 方法 | 说明 |
|-------------|--------------|------|
| `sendChatMessage()` | `chat.send` | 主动消息、催办、重派等控制面发令 |

说明：Gateway `chat.send` 已切换到新版请求体，核心字段为 `sessionKey`、`message`、`idempotencyKey`；控制面在 mock / bridge 路径上仍可携带内部 routing hints，但 Gateway 适配层会在发出前剥离这些非官方字段。

### 渠道

| DataAPI 方法 | JSON-RPC 方法 | 说明 |
|-------------|--------------|------|
| `getChannelsStatus()` | `channels.status` | 所有渠道 + 账户状态 |

### 定时任务

| DataAPI 方法 | JSON-RPC 方法 |
|-------------|--------------|
| `getCronJobs()` | `cron.list` |
| `addCronJob()` | `cron.add` |
| `updateCronJob()` | `cron.update` |
| `removeCronJob()` | `cron.remove` |
| `runCronJob()` | `cron.run` |
| `getCronRuns()` | `cron.runs` |

### 日志、模型、节点、审批

| DataAPI 方法 | JSON-RPC 方法 |
|-------------|--------------|
| `getLogs()` | `logs.tail` |
| `getModels()` | `models.list` |
| `getSkills()` | `skills.status` |
| `getNodes()` | `node.list` |
| `getConfig()` | `config.get` |
| `getExecApprovals()` | `exec.approvals.get` |
| `resolveExecApproval()` | `exec.approval.resolve` |

## 规划中的 CLI / Hybrid provider（未实现）

当前 `getAPI()` 只会返回 `mockAPI` 或 `GatewayAPI`。未来如果引入 CLI / Hybrid，对应新增 provider 的职责应为：

- `BridgeAPI`：通过 localhost bridge 暴露 CLI、本地文件与本机健康检查能力
- `HybridAPI`：聚合 `GatewayAPI` + `BridgeAPI`，并在 UI 中显式体现 capability 与降级状态

详细设计见 [`docs/CLI-HYBRID-INTEGRATION.md`](./CLI-HYBRID-INTEGRATION.md)。

## 核心类型定义

完整类型定义见 `src/types/openclaw.ts`，以下为关键类型。

### AgentSummary（智能体摘要）

```typescript
interface AgentIdentityInfo {
  name?: string
  theme?: string
  emoji?: string
  avatar?: string
  avatarUrl?: string
}

interface AgentSummary {
  id: string                     // 注意：是 id，不是 agentId
  name?: string
  identity?: AgentIdentityInfo   // emoji/avatar/theme 嵌套在 identity 对象中
}
```

### GatewaySessionRow（会话条目）

```typescript
interface GatewaySessionRow {
  key: string
  kind: 'direct' | 'group' | 'global' | 'unknown'
  label?: string
  displayName?: string
  derivedTitle?: string
  lastMessagePreview?: string
  channel?: string
  subject?: string
  updatedAt: number | null
  sessionId?: string
  thinkingLevel?: string
  reasoningLevel?: string
  sendPolicy?: 'allow' | 'deny'
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
  modelProvider?: string
  model?: string
  contextTokens?: number
  // ... 其他可选字段见 src/types/openclaw.ts
}
```

### ChannelsStatusResult（渠道状态）

```typescript
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

interface ChannelAccountSnapshot {
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
  lastInboundAt?: number
  lastOutboundAt?: number
  mode?: string
  dmPolicy?: string
  allowFrom?: string[]
}
```

### CronJob（定时任务）

```typescript
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
  createdAtMs?: number
  updatedAtMs?: number
}

type CronSchedule =
  | { kind: 'at'; at: string }                                     // 每日定时，如 "09:00"
  | { kind: 'every'; everyMs: number; anchorMs?: number }          // 间隔执行（毫秒）
  | { kind: 'cron'; expr: string; tz?: string; staggerMs?: number } // Cron 表达式

type CronPayload =
  | { kind: 'agentTurn'; message: string; model?: string; deliver?: boolean; channel?: string; to?: string }
  | { kind: 'systemEvent'; text: string }
```

### LogsTailResult（日志尾部结果）

OpenClaw `logs.tail` 返回原始字符串行，前端负责解析：

```typescript
interface LogsTailResult {
  file: string
  cursor: number
  size: number
  lines: string[]       // 原始日志行，非结构化
  truncated?: boolean
  reset?: boolean
}

// 前端解析后的日志条目（从 lines 解析得到）
interface LogEntry {
  ts: number
  level: string
  source?: string
  message: string
  raw: string           // 保留原始行文本
}
```

### SessionsListResult（会话列表结果）

```typescript
interface SessionsListResult {
  ts: number
  path: string            // 会话存储路径
  count: number           // 会话总数
  defaults: {
    modelProvider: string | null
    model: string | null
    contextTokens: number | null
  }
  sessions: GatewaySessionRow[]
}
```

### SessionsUsageResult（用量统计）

```typescript
interface SessionsUsageResult {
  updatedAt: number
  startDate: string
  endDate: string
  sessions: SessionUsageEntry[]
  totals: UsageTotals
  aggregates: SessionsUsageAggregates
}

interface SessionUsageEntry {
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

interface UsageTotals {
  inputTokens: number
  outputTokens: number
  totalTokens: number
  totalCost: number
  calls: number
  errors: number
  // ... cacheReadTokens, reasoningTokens, toolCalls 等可选
}
```

## Mock 数据结构

`src/data/mock.ts` 提供与 DataAPI 接口完全一致的返回数据结构，包含：

- **智能体**：多个示例 Agent（含 model/provider/workspace）
- **会话**：多种类型的会话（direct/group/global，不同渠道）
- **渠道状态**：多渠道多账户（含连接状态、活动时间）
- **定时任务**：不同调度类型的示例（at/every/cron）
- **用量数据**：含 Token 数和费用的多日数据
- **日志**：多级别日志条目

Mock 数据通过 `mockAPI` 以 Promise 形式返回，与 GatewayAPI 接口一致，页面组件无需区分数据来源。

## 错误处理

### GatewayClient 错误

```typescript
// 请求超时
throw new Error('Request timeout: agents.list')

// 未连接
throw new Error('Not connected to gateway')

// 响应错误（网关返回 error 帧）
throw new Error(errorShape.message)  // ErrorShape { code, message, data? }
```

### 页面组件错误处理模式

```typescript
const [data, setData] = useState<T[]>([])
const [loading, setLoading] = useState(true)
const [error, setError] = useState<string | null>(null)

useEffect(() => {
  getAPI().getAgents()
    .then(setData)
    .catch(err => setError(err.message))
    .finally(() => setLoading(false))
}, [])
```

所有页面组件均实现 loading 骨架屏和 error 状态显示。

## 缓存策略

- `getAPI()` 对 `GatewayAPI` 实例单例缓存
- `GatewayClient` 连接时获取 Snapshot 并缓存
- Mock 模式无缓存需求（数据为静态导入）
