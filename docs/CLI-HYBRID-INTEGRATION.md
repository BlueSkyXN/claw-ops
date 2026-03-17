# claw-ops — CLI / Hybrid 对接设计规格

> 状态：**部分已实现（Bridge MVP 已落地）**
>
> 本文档定义 claw-ops 如何在现有 `demo` / `realtime` 之外，引入基于 OpenClaw CLI、本地 bridge，以及可选 edict-style backend 的集成模式。当前仓库已经落地 bridge MVP、`cli` / `hybrid` 模式、`Setup` 双路径测试与部分能力降级；本文仍然保留后续扩展的目标形态。

## 1. 背景

当前 claw-ops 的正式运行形态只有两种：

- `demo`：浏览器内 Mock 数据
- `realtime`：浏览器通过 WebSocket JSON-RPC 直连 OpenClaw Gateway

这条链路已经足够支撑实时监控和控制面干预，但还不覆盖另一类在 OpenClaw 生态里已经被证明有效的本地集成方式：

- 通过 `openclaw` CLI 唤醒或投递 Agent
- 读取 `~/.openclaw` 下的 workspace / sessions / logs
- 通过 localhost bridge 或专用 backend 提供更强的本机能力

参考材料：

- `local/edict-openclaw-analysis.md`
- `local/danghuangshang-openclaw-analysis.md`

## 2. 目标与非目标

### 2.1 目标

- 保留现有 `demo` / `realtime` 架构，不推翻已经可用的 Gateway 直连能力。
- 为本机部署场景增加 `CLI` / `Hybrid` 集成路径，使 claw-ops 能接入 OpenClaw CLI、本地文件系统和可选的适配 backend。
- 尽量复用现有 `DataAPI`、`Setup`、页面组件和运行时语义层，而不是分叉成第二套 UI。
- 在设计层明确 source-of-truth、降级行为和安全边界，避免后续实现时边做边猜。

### 2.2 非目标

- 不允许浏览器直接执行任意 shell / CLI 命令。
- 不允许浏览器直接读取本地 `~/.openclaw` 文件。
- 不计划用 CLI / Hybrid 替换 Gateway JSON-RPC；推荐方向始终是 **Hybrid first**，而不是“抛弃 Gateway”。
- 不要求第一阶段就复制 edict 的完整 Postgres + Redis + Worker 体系。

## 3. 设计原则

1. **Hybrid first**：保留 Gateway 作为实时事件与标准 JSON-RPC 主入口，在本地 bridge 可提供额外本机能力和降级能力时再叠加。
2. **Bridge as trust boundary**：所有 CLI 执行、本地文件访问、进程/健康检查，都必须经过本地 bridge/backend，而不是前端直接触达操作系统。
3. **Capability-driven UI**：前端不根据模式名盲猜能力，而是根据 bridge / Gateway 探测到的 capabilities 决定可用功能。
4. **Source-of-truth 明确**：同一类数据只允许一个“主事实来源”，其他来源作为补充或降级来源。
5. **安全白名单**：bridge 只能暴露命名操作，不暴露通用 shell 执行能力。

## 4. 集成模式

| 模式 | 状态 | 核心链路 | 适用场景 |
|------|------|----------|----------|
| `demo` | 已实现 | Browser -> `mockAPI` | 演示、开发、离线体验 |
| `realtime` | 已实现 | Browser -> `GatewayAPI` -> OpenClaw Gateway | 纯 Gateway 控制面 |
| `cli` | 部分已实现 | Browser -> local bridge -> CLI / filesystem | 本机单机运维、Gateway 不可用时的受限运维 |
| `hybrid` | 部分已实现 | Browser -> `GatewayAPI` + `BridgeAPI` | 同时需要实时事件和本机能力的主流方案 |

> 当前实现状态：
>
> - 已落地：`bridge/server.mjs`、`BridgeAPI`、`HybridAPI`、Setup 的 bridge/gateway 测试、CLI 模式 polling 降级
> - 已落地：sessions 页面会对纯 CLI 下不支持的 reset/delete 给出显式禁用提示
> - 仍未支持：纯 CLI 的 `sessions.patch/reset/delete`、审批处理、真实事件订阅

## 5. 总体架构

### 5.1 推荐拓扑

```text
┌──────────────────────────────────────────────────────────────┐
│                         Browser UI                           │
│  Dashboard / Orchestration / Agents / Setup / Logs / ...    │
└──────────────────────────────┬───────────────────────────────┘
                               │ getAPI()
              ┌────────────────┴────────────────┐
              │                                 │
     ┌────────▼────────┐               ┌────────▼────────┐
     │   GatewayAPI     │               │    BridgeAPI     │
     │ WebSocket JSON-RPC│              │ localhost HTTP   │
     └────────┬─────────┘               └────────┬─────────┘
              │                                  │
     ┌────────▼────────┐          ┌──────────────▼────────────────────┐
     │ OpenClaw Gateway │          │ Local bridge / adapter service    │
     └─────────────────┘          │ - whitelist CLI ops               │
                                  │ - workspace/session file access    │
                                  │ - health / capability probing      │
                                  │ - optional edict backend adapter   │
                                  └──────────────┬────────────────────┘
                                                 │
             ┌───────────────────────────────────┼───────────────────────────────────┐
             │                                   │                                   │
     ┌───────▼────────┐                  ┌───────▼────────┐                 ┌────────▼────────┐
     │ openclaw CLI    │                  │ ~/.openclaw     │                 │ optional backend │
     │ agent / cron ...│                  │ workspace/logs  │                 │ edict-style API  │
     └────────────────┘                  └────────────────┘                 └─────────────────┘
```

### 5.2 为什么必须有 bridge

当前 claw-ops 是浏览器前端。浏览器天然无法安全地：

- 直接执行 `openclaw agent --agent ... -m ...`
- 直接读取 `~/.openclaw/agents/*/sessions/*.jsonl`
- 直接检测本机进程和本地日志文件

因此 CLI / Hybrid 的核心不是“前端多加一个 mode”，而是引入一个**本地 bridge 进程**，把这些本机能力收敛为受控接口。

## 6. 配置模型（目标形态）

当前实现中的 `OpenClawConfig` 只有 `demo | realtime` 两种模式。为了支持 CLI / Hybrid，推荐将配置模型扩展为分层结构，而不是继续在根对象上堆字段。

```ts
type IntegrationMode = 'demo' | 'realtime' | 'cli' | 'hybrid'

type BridgeProviderType =
  | 'openclaw-bridge'
  | 'edict-backend'
  | 'custom-local-bridge'

interface GatewayConnectionConfig {
  url: string
  authType: 'token' | 'password'
  authToken: string
  authPassword: string
  scopes: GatewayScope[]
}

interface BridgeConnectionConfig {
  url: string                 // 例如 http://127.0.0.1:18795
  providerType: BridgeProviderType
  commandTimeoutMs: number
  healthTimeoutMs: number
}

interface IntegrationCapabilities {
  gatewayEvents: boolean
  cliDispatch: boolean
  workspaceFiles: boolean
  sessionFiles: boolean
  localLogs: boolean
  processStatus: boolean
  taskBoard: boolean
}

interface OpenClawConfigV2 {
  mode: IntegrationMode
  gateway?: GatewayConnectionConfig
  bridge?: BridgeConnectionConfig
  sourcePriority: 'gateway-first' | 'bridge-first'
  dangerousActionsRequireApproval: boolean
  detectedCapabilities?: IntegrationCapabilities
}
```

### 6.1 配置原则

- `gateway` 与 `bridge` 独立配置，避免“有 CLI 就必须有 Gateway”或反之。
- `sourcePriority` 只决定聚合时的优先读取顺序，不改变 UI 功能边界。
- `detectedCapabilities` 来自探测结果，不由用户手填。

## 7. DataAPI 与 capability 归属

当前 `DataAPI` 已经是前端最稳定的抽象边界。CLI / Hybrid 应优先扩展 provider，而不是让页面直接知道“现在是 bridge 还是 gateway”。

### 7.1 provider 分层

- `mockAPI`：已实现，给 `demo` 使用
- `GatewayAPI`：已实现，给 `realtime` 使用
- `BridgeAPI`：规划中，给 `cli` 使用
- `HybridAPI`：规划中，组合 `GatewayAPI` + `BridgeAPI`

### 7.2 能力矩阵

| DataAPI / 能力 | `demo` | `realtime` | `cli` | `hybrid` |
|----------------|--------|------------|-------|----------|
| `getHealth()` | Mock | Gateway | Bridge | Gateway + Bridge 聚合 |
| `getAgents()` | Mock | Gateway | Bridge（CLI / config / filesystem） | Gateway 优先，Bridge 降级 |
| `getSessions()` | Mock | Gateway | Bridge（sessions files） | Gateway 优先，Bridge 补洞 |
| `getLogs()` | Mock | Gateway | Bridge（本地日志） | 双来源聚合或按优先级选择 |
| `getNodes()` | Mock | Gateway | Bridge（CLI） | Gateway / Bridge 二选一 |
| `sendChatMessage()` | Mock | Gateway `chat.send` | Bridge `openclaw agent ...` 或 provider-specific dispatch | 按 capability 决定走 Gateway 或 Bridge |
| `agentFiles*()` | Mock | Gateway | Bridge（workspace 文件） | Gateway / Bridge 二选一 |
| `installSkill()` | Mock | Gateway | Bridge（如果 provider 暴露安全安装接口） | Gateway / Bridge 二选一 |
| `getChannelsStatus()` | Mock | Gateway | 不保证首期支持 | Gateway 为主 |
| `getExecApprovals()` | Mock | Gateway | 不保证首期支持 | Gateway 为主 |
| `getCronJobs()` | Mock | Gateway | Bridge（若 provider 提供只读/写接口） | Gateway 优先 |
| `Task board / kanban` 聚合视图 | Mock | 前端推断 | Bridge / backend | Hybrid 聚合 |

### 7.3 MVP 建议边界

首期 CLI / Hybrid 不应试图一次性覆盖所有页面。建议优先保证：

- 健康检查
- Agents / Sessions / Logs / Nodes 读取
- 通过 CLI 唤醒或向指定 Agent 投递任务
- Setup 中的 capability 检测和降级提示

审批、渠道状态、Cron 高级管理等更适合继续以 Gateway 为主。

## 8. Setup 流程（目标形态）

### 8.1 新流程

1. 选择模式：`demo` / `realtime` / `cli` / `hybrid`
2. 如果模式包含 Gateway，配置 Gateway URL、认证方式和 scopes
3. 如果模式包含 bridge，配置 bridge URL 与 provider 类型
4. 依次执行健康检查：
   - Gateway 握手与 snapshot
   - bridge `/health`
   - bridge `/capabilities`
5. 展示 capability matrix 和不可用项
6. 保存配置并进入应用

### 8.2 UI 约束

- 不允许因为 bridge 健康失败就把整个 Setup 卡死；应允许用户保存“部分可用”配置。
- 在 `hybrid` 模式下，Setup 必须明确告诉用户：
  - 哪些页面/动作仍依赖 Gateway
  - 哪些动作已由 bridge 接管

## 9. Source-of-truth 与一致性策略

### 9.1 推荐事实来源

| 数据域 | 推荐主来源 | 说明 |
|--------|------------|------|
| presence / approvals / channel live status | Gateway | 事件驱动、实时性最好 |
| 本地 workspace 文件 | Bridge | 浏览器不能直接读取本地文件 |
| sessions 文件索引 / JSONL | Bridge | 本机最可靠 |
| kanban / task board（若对接 edict） | edict backend / bridge adapter | 不应混入 Gateway session 原始字段 |
| 最终控制面聚合任务 | claw-ops runtime layer | 基于已选择的数据源聚合 |

### 9.2 冲突规则

- 如果 Gateway 与 Bridge 同时提供同一类资源，优先使用 `sourcePriority` 指定来源。
- 如果 Bridge 数据落后于 Gateway，UI 必须显式标注“stale”。
- 如果 edict task id 与 OpenClaw session key 需要映射，必须在 bridge 层给出稳定映射表，不把歧义推给前端页面。

## 10. 失败与降级语义

| 场景 | UI 行为 |
|------|---------|
| Gateway 在线，Bridge 离线 | 维持 `realtime` 能力；CLI/本地文件相关动作置灰并提示 |
| Bridge 在线，Gateway 离线 | 允许进入受限 `cli` 观察/派发能力；标明无实时事件与审批 |
| Gateway 与 Bridge 都在线，但 capability 不完整 | 显示部分可用矩阵，不伪装成功能完整 |
| CLI 命令执行成功但状态回写延迟 | 对相关视图打上 `pending sync` / `stale` 标记 |
| 本地文件缺失或权限不足 | Bridge 返回结构化错误，不在前端 silent fallback |

## 11. 安全模型

### 11.1 bridge 只暴露命名操作

禁止提供通用的“执行任意命令”接口。Bridge 应该只暴露类似：

- `POST /bridge/dispatch-agent-turn`
- `GET /bridge/health`
- `GET /bridge/capabilities`
- `GET /bridge/agents`
- `GET /bridge/sessions`
- `GET /bridge/logs`

### 11.2 CLI 白名单

首期仅允许与 claw-ops 页面直接对应的受控操作，例如：

- `openclaw agent --agent <id> -m <message> [--timeout ...]`
- 只读的 node / cron / status / health 命令（以 bridge 适配层实际验证为准）

禁止：

- 任意 shell 拼接
- 任意路径读写
- 任意环境变量透传

### 11.3 文件访问边界

- 仅允许读取配置指定范围内的 OpenClaw runtime/workspace 目录。
- 所有路径必须在 bridge 侧做规范化与越界校验。
- 高风险写操作（如 workspace 文件写入、技能安装）应支持二次确认或单独 capability 开关。

## 12. 与 edict / danghuangshang 的关系

- `danghuangshang` 证明了 **文件系统 + CLI + localhost server** 路线是实用的。
- `edict` 证明了 **bridge/backend + 状态机 / task board** 可以把本地 orchestration 能力暴露给看板。

对 claw-ops 的建议不是复制它们，而是：

1. 先引入通用的 local bridge 抽象
2. 再把 `openclaw` CLI 和本地 runtime 文件接进去
3. 最后再考虑是否增加 `edict-backend` 适配 provider

## 13. 推荐实施顺序

### Phase 1：bridge MVP

- 已完成：本地 bridge 服务
- 已完成：`/health` + `/capabilities`
- 已完成：`getAgents` / `getSessions` / `getLogs` / `getNodes`
- 已完成：Setup capability 探测
- 进行中：受控 Agent dispatch 的更完整端到端验证与 UI 收口

### Phase 2：Hybrid 聚合

- 已完成：`HybridAPI`
- 已完成：Setup 的双健康检查和降级说明
- 待完善：source priority / stale 标记

### Phase 3：高级本机能力

- 已完成：workspace 文件浏览 / 编辑（受限文件类型白名单）
- 已完成：skills / cron 的 bridge 适配（skills install 仍显式降级）
- edict task board adapter

## 14. 当前文档关系

- `README.md`：只保留高层定位和当前能力边界
- `docs/ARCHITECTURE.md`：记录当前已实现架构，并指向本文档
- `docs/API-INTEGRATION.md`：记录当前 Gateway API 实现，并补充未来 provider 扩展边界
- `docs/PAGES.md`：记录当前 Setup 页面现状，并提示 CLI / Hybrid 尚未上线
