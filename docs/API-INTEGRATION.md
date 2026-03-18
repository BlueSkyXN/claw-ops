# claw-ops — API 集成文档

> 本文档描述 **当前仓库实际实现** 的 API 集成，而不是 OpenClaw 全量协议设计稿。
> 代码 source of truth：
>
> - `src/lib/api.ts`
> - `src/lib/gateway-client.ts`
> - `src/lib/bridge-client.ts`
> - `src/types/openclaw.ts`
> - `src/lib/config.ts`

## 1. 当前 provider 结构

`getAPI()` 会按当前配置返回四种 provider 之一：

| Provider | 触发条件 | 说明 |
|---|---|---|
| `mockAPI` | `config.useMockData === true` | demo 模式，读写 mock 工作区 |
| `GatewayAPI` | 仅启用 Gateway | 通过 WebSocket JSON-RPC 调 OpenClaw Gateway |
| `BridgeAPI` | 仅启用 bridge | 通过本地 HTTP bridge 调本机受控能力 |
| `HybridAPI` | 同时启用 bridge + Gateway | 按方法选择 Gateway 优先或 bridge 优先 |

相关代码：

- `src/lib/api.ts`
- `src/lib/config.ts`

## 2. 运行模式与传输

| 模式 | Gateway | Bridge | `getAPI()` 返回 |
|---|---:|---:|---|
| `demo` | 否 | 否 | `mockAPI` |
| `realtime` | 是 | 否 | `GatewayAPI` |
| `cli` | 否 | 是 | `BridgeAPI` |
| `hybrid` | 是 | 是 | `HybridAPI` |

说明：

- `usesGatewayTransport()` 在 `realtime` / `hybrid` 下返回 `true`
- `usesBridgeTransport()` 在 `cli` / `hybrid` 下返回 `true`

## 3. Gateway 连接流程

Gateway 客户端由 `src/lib/gateway-client.ts` 实现，当前行为如下：

1. 建立 WebSocket 连接
2. 等待服务端发送 `connect.challenge`
3. 客户端发送 `type: "req"` / `method: "connect"`
4. 收到 `type: "res"` 且 `payload` 为 `HelloOk`
5. 缓存 `snapshot`，状态切换为 `connected`

### 3.1 `connect` 请求体

```json
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
    "scopes": ["operator.read", "operator.write", "operator.admin"],
    "auth": {
      "token": "<token>"
    }
  }
}
```

### 3.2 认证方式

当前 Setup UI 支持：

- `token`
- `password`

类型层还保留 `none` / `trusted-proxy` / `deviceToken` 等协议字段，但这不代表当前 UI 暴露了这些入口。

## 4. Bridge 集成

Bridge 客户端由 `src/lib/bridge-client.ts` 实现：

- 健康检查：`GET /health`
- 能力探测：`GET /capabilities`
- RPC：`POST /rpc`

Bridge 使用的鉴权头：

```http
X-Claw-Ops-Bridge-Token: <token>
```

bridge 只在 `cli` / `hybrid` 下启用。

## 5. `DataAPI` 当前接口

以下内容与 `src/lib/api.ts` 保持一致：

```ts
interface DataAPI {
  getHealth(): Promise<{ ok: boolean; uptimeMs?: number }>
  getSnapshot(): Promise<Snapshot | null>
  getPresence(): Promise<PresenceEntry[]>

  getAgents(): Promise<AgentSummary[]>
  createAgent(params: AgentsCreateParams): Promise<{ agentId: string }>
  updateAgent(params: AgentsUpdateParams): Promise<void>
  deleteAgent(params: AgentsDeleteParams): Promise<void>

  agentFilesList(agentId: string): Promise<AgentsFileEntry[]>
  agentFilesGet(agentId: string, path: string): Promise<string>
  agentFilesSet(agentId: string, path: string, content: string): Promise<void>
  installSkill(skillId: string): Promise<void>

  getSessions(params?: SessionsListParams): Promise<SessionsListResult>
  patchSession(params: SessionsPatchParams): Promise<void>
  resetSession(key: string): Promise<void>
  deleteSession(key: string): Promise<void>
  getSessionsUsage(params?: SessionsUsageParams): Promise<SessionsUsageResult>
  getUsageCost(params?: UsageCostParams): Promise<UsageCostSummary>

  sendChatMessage(params: ChatSendParams): Promise<ChatSendResult>

  getChannelsStatus(): Promise<ChannelsStatusResult>

  getCronJobs(): Promise<CronJob[]>
  addCronJob(params: CronAddParams): Promise<{ id: string }>
  updateCronJob(params: CronUpdateParams): Promise<void>
  removeCronJob(params: CronRemoveParams): Promise<void>
  runCronJob(params: CronRunParams): Promise<void>
  getCronRuns(params: CronRunsParams): Promise<CronRunLogEntry[]>

  getLogs(params?: LogsTailParams): Promise<LogEntry[]>

  getModels(): Promise<ModelChoice[]>
  getSkills(): Promise<SkillEntry[]>
  getNodes(): Promise<NodeListNode[]>
  getConfig(): Promise<Record<string, unknown>>

  getExecApprovals(): Promise<ExecApprovalRequest[]>
  resolveExecApproval(requestId: string, decision: 'approved' | 'denied'): Promise<void>
}
```

## 6. Gateway JSON-RPC 映射

### 6.1 当前实际用到的方法

| `DataAPI` 方法 | Gateway 方法 |
|---|---|
| `getHealth()` | `health` |
| `getPresence()` | `system-presence` |
| `getAgents()` | `agents.list` |
| `createAgent()` | `agents.create` |
| `updateAgent()` | `agents.update` |
| `deleteAgent()` | `agents.delete` |
| `agentFilesList()` | `agents.files.list` |
| `agentFilesGet()` | `agents.files.get` |
| `agentFilesSet()` | `agents.files.set` |
| `installSkill()` | `skills.install` |
| `getSessions()` | `sessions.list` |
| `patchSession()` | `sessions.patch` |
| `resetSession()` | `sessions.reset` |
| `deleteSession()` | `sessions.delete` |
| `getSessionsUsage()` | `sessions.usage` |
| `getUsageCost()` | `usage.cost` |
| `sendChatMessage()` | `chat.send` |
| `getChannelsStatus()` | `channels.status` |
| `getCronJobs()` | `cron.list` |
| `addCronJob()` | `cron.add` |
| `updateCronJob()` | `cron.update` |
| `removeCronJob()` | `cron.remove` |
| `runCronJob()` | `cron.run` |
| `getCronRuns()` | `cron.runs` |
| `getLogs()` | `logs.tail` |
| `getModels()` | `models.list` |
| `getSkills()` | `skills.status` |
| `getNodes()` | `node.list` |
| `getConfig()` | `config.get` |
| `getExecApprovals()` | `exec.approvals.get` |
| `resolveExecApproval()` | `exec.approval.resolve` |

### 6.2 Gateway 特殊处理

- `agents.update` 在 Gateway 出口只会发送 `agentId`、`name`、`model`、`avatar`
- `getSessions()` 默认附带：
  - `limit: 100`
  - `includeDerivedTitles: true`
  - `includeLastMessage: true`
- `getChannelsStatus()` 会固定发送 `{ probe: false }`
- `getLogs()` 默认附带 `limit: 200`

## 7. `chat.send` 当前约定

`ChatSendParams` 定义在 `src/types/openclaw.ts`。

### 7.1 当前核心字段

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

  // 控制面内部 routing hints
  agentId?: string
  channel?: string
  to?: string
  model?: string
  maxTokens?: number
  parentId?: string
  metadata?: Record<string, unknown>
}
```

### 7.2 不同 provider 的处理差异

#### GatewayAPI

Gateway 出口只保留官方字段：

- `sessionKey`
- `message`
- `thinking`
- `deliver`
- `attachments`
- `timeoutMs`
- `systemInputProvenance`
- `systemProvenanceReceipt`
- `idempotencyKey`

也就是说 `agentId` / `channel` / `to` / `metadata` 不会发给 Gateway。

#### BridgeAPI

bridge 适配会转换为：

```ts
{
  sessionKey,
  text: message,
  agentId,
  thinking,
  metadata
}
```

## 8. 编排控制面如何调用 API

编排运行时在 `src/lib/orchestration-runtime.ts`。

### 8.1 加载数据

`loadOrchestrationRuntime()` 并行读取：

- `getAgents()`
- `getSessions({ limit: 200, includeGlobal: true, includeDerivedTitles: true, includeLastMessage: true })`
- `getSessionsUsage()`
- `getChannelsStatus()`
- `getExecApprovals()`
- `getLogs({ limit: 200 })`
- `getNodes()`
- `getConfig()`

### 8.2 实时 / 轮询刷新

`subscribeToOrchestrationEvents()` 的当前行为：

- `demo`：不订阅事件
- 无实时事件能力：每 5~15 秒 polling 失效刷新
- 有 Gateway 实时能力时，监听以下事件并触发重载：
  - `agent`
  - `chat`
  - `presence`
  - `health`
  - `cron`
  - `exec.approval.requested`
  - `exec.approval.resolved`
  - `session.update`
  - `agent.status`

## 9. Hybrid 当前行为

`HybridAPI` 不是“所有方法都聚合”，而是按方法分配：

### 9.1 bridge 优先 / bridge 独占

- `getAgents`
- `createAgent`
- `updateAgent`
- `deleteAgent`
- `agentFiles*`
- `installSkill`

### 9.2 Gateway 优先，失败时 bridge 降级

- `getHealth`
- `getSnapshot`
- `getPresence`
- `getSessions`
- `getSessionsUsage`
- `getUsageCost`
- `sendChatMessage`
- `getChannelsStatus`
- `getCronJobs`
- `addCronJob`
- `updateCronJob`
- `removeCronJob`
- `runCronJob`
- `getCronRuns`
- `getLogs`
- `getModels`
- `getSkills`
- `getNodes`
- `getConfig`
- `getExecApprovals`

### 9.3 Gateway 独占

- `patchSession`
- `resetSession`
- `deleteSession`
- `resolveExecApproval`

## 10. CLI / bridge capability 注意事项

前端会把 bridge 健康检查中上报的 capability 记录到配置里，用于页面降级提示。

当前 capability 结构见 `src/types/bridge.ts`，主要包括：

- `snapshot`
- `presence`
- `agentCrud`
- `agentFiles`
- `skillInstall`
- `sessionMutations`
- `approvals`
- `realtimeEvents`
- `cronCrud`
- `usage`
- `logs`

例如：

- `Sessions` 页面会在纯 `cli` 且 `sessionMutations === false` 时禁用重置 / 删除按钮
- orchestration runtime 会在没有实时事件能力时回退为 polling

## 11. 用量接口兼容性

`src/pages/Usage.tsx` 对旧网关做了日期参数兼容处理：

- 默认会尝试发送 `mode: 'specific'` + `utcOffset`
- 若网关报错为不支持这些字段，会记录兼容缓存
- 后续对该 gateway URL 不再发送这些字段

因此文档中如果看到“总是传 mode / utcOffset”的描述，应以 `Usage.tsx` 当前兼容逻辑为准。

## 12. 相关文档

- `docs/ARCHITECTURE.md`
- `docs/PAGES.md`
- `docs/CLI-HYBRID-INTEGRATION.md`
- `OPENCLAW_API_REFERENCE.md`
