# claw-ops — 架构文档

> 本文档描述当前代码结构和运行路径。历史设计 / 规划请看：
>
> - `docs/CLI-HYBRID-INTEGRATION.md`
> - `docs/ORCHESTRATION-UX-DESIGN.md`

## 1. 总体架构

```text
React Router + Layout
  -> 页面组件
  -> getAPI()
  -> DataAPI
     -> mockAPI
     -> GatewayAPI
     -> BridgeAPI
     -> HybridAPI
  -> orchestration runtime
     -> task-tracker
     -> flow-tracer
     -> health-analyzer
```

对外连接：

- Gateway：WebSocket JSON-RPC
- bridge：本地 HTTP

## 2. 当前目录结构

```text
src/
├── App.tsx
├── components/
├── data/
├── lib/
├── pages/
├── types/
└── main.tsx
```

重点目录：

- `src/pages/`：页面入口
- `src/components/`：共享卡片、控制面板、图谱部件
- `src/lib/`：配置、API、编排运行时、推断与可视化逻辑
- `src/types/`：OpenClaw / bridge 类型
- `src/data/`：mock 数据与 mock 工作区

## 3. 路由结构

当前路由由 `src/App.tsx` 定义：

| 路径 | 组件 |
|---|---|
| `/setup` | `Setup` |
| `/` | `Dashboard` |
| `/agents` | `Agents` |
| `/sessions` | `Sessions` |
| `/channels` | `Channels` |
| `/cron` | `CronJobs` |
| `/usage` | `Usage` |
| `/orchestration/*` | `Orchestration` |
| `/topology` | 重定向到 `/orchestration/topology` |
| `/logs` | `Logs` |
| `*` | 重定向到 `/` |

### 编排页内部结构

`Orchestration.tsx` 通过路径前缀解析四个 section：

- `overview`
- `tasks`
- `execution`
- `topology`

因此 `/orchestration` 不再是单一拓扑页，而是编排控制面的入口。

## 4. 运行模式

当前配置模型在 `src/lib/config.ts`：

```ts
type AppMode = 'demo' | 'realtime' | 'cli' | 'hybrid'
```

### 各模式能力

| 模式 | 说明 |
|---|---|
| `demo` | mock 数据 + 本地持久化 mock 工作区 |
| `realtime` | 通过 Gateway 读写真实 OpenClaw |
| `cli` | 通过 bridge 调 CLI / 本地受控能力 |
| `hybrid` | bridge + Gateway 组合 |

### 配置持久化

存储键：

```text
localStorage['claw-ops-config']
```

主要字段：

- `mode`
- `gatewayUrl`
- `authType`
- `authToken`
- `authPassword`
- `bridgeUrl`
- `bridgeAuthToken`
- `bridgeCapabilities`
- `scopes`
- `refreshInterval`
- `activeExperienceTemplateId`
- `activeExperienceSummary`

## 5. API 层架构

统一入口是 `src/lib/api.ts` 中的 `DataAPI`。

### 5.1 provider 分工

#### mockAPI

- demo 模式使用
- 支持 mock 会话、任务、审批、日志、配置等本地闭环演示

#### GatewayAPI

- 所有调用都通过 `GatewayClient.request()` 发送 JSON-RPC
- `chat.send` 会剥离控制面内部 routing hints

#### BridgeAPI

- 所有调用都经 `bridgeRpc()` 或 `bridgeFetch()`
- 依赖本地 bridge 进程暴露受控接口

#### HybridAPI

- 不是简单双写
- 一部分方法由 bridge 独占
- 一部分方法 Gateway 优先，失败时 bridge 降级
- 一部分高风险动作仍要求 Gateway

## 6. Gateway 客户端

`src/lib/gateway-client.ts`

### 当前行为

- WebSocket 建连
- 等待 `connect.challenge`
- 发送 `connect`
- 缓存 `snapshot`
- 提供 `request()` 和 `on()`
- 可选自动重连

### 当前状态机

```ts
type ConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error'
```

## 7. Bridge 客户端

`src/lib/bridge-client.ts`

### 当前 HTTP 接口

- `GET /health`
- `GET /capabilities`
- `POST /rpc`

### 当前作用

- 给 `cli` / `hybrid` 提供本机能力入口
- 浏览器不直接访问本机文件系统
- bridge token 通过 `X-Claw-Ops-Bridge-Token` 传递

## 8. 编排运行时语义层

`src/lib/orchestration-runtime.ts` 负责把原始 API 数据装配成控制面运行态。

### 8.1 加载内容

并行读取：

- agents
- sessions
- usage
- channels
- approvals
- logs
- nodes
- config

### 8.2 派生语义

运行时进一步生成：

- `tasks`
- `taskSummary`
- `health`
- `selectedExperience`
- `activeExperiencePreset`
- `workflow execution view`

### 8.3 控制动作

封装在：

- `dispatchMission()`
- `performTaskIntervention()`

控制动作包括：

- pause / resume
- reset
- nudge
- approve / deny
- reroute
- switch-model

### 8.4 workflow core

当前已新增最小 workflow core：

- `src/types/workflow.ts`：定义 workflow definition / node / edge / execution view
- `src/lib/workflow-definition.ts`：从预设团队或任务实例导出 workflow definition
- `src/lib/workflow-observer.ts`：把 `TrackedTask` + 当前 preset 映射成 workflow instance 视图
- `src/lib/orchestration-metadata.ts`：补充 `workflowId / workflowExecutionId / workflowNodeId` 等 metadata 键

## 9. 编排页组件分层

### overview 子视图

- `OperationsMonitorBoard`
- `MissionDispatchPanel`
- `TeamPresetsPanel`
- `DetailPanel`

### tasks 子视图

- `TaskKanbanBoard`
- `ActiveTasksPanel`
- `TaskActivityFeed`
- `TaskControlCard`

### execution 子视图

- `WorkflowExecutionPanel`
- `ActiveTasksPanel`
- `TaskActivityFeed`
- `TaskControlCard`

### topology 子视图

- 执行图谱
- 入口拓扑
- 组织架构
- React Flow + dagre

## 10. 事件与刷新

### Layout 级别

`Layout.tsx` 会：

- 轮询审批数量
- 监听：
  - `exec.approval.requested`
  - `exec.approval.resolved`

### Orchestration / Dashboard 级别

通过 `subscribeToOrchestrationEvents()`：

- 有 Gateway 实时能力时监听：
  - `agent`
  - `chat`
  - `presence`
  - `health`
  - `cron`
  - `exec.approval.requested`
  - `exec.approval.resolved`
  - `session.update`
  - `agent.status`
- 无实时能力时回退为 polling

## 11. 历史 / 未作为当前 source-of-truth 的文件

### `src/pages/Topology.tsx`

- 旧拓扑页实现
- 仍保留在仓库中
- 当前不在主路由里使用

### 设计文档

以下文档主要用于设计讨论，不应用来判断“当前已上线行为”：

- `docs/ORCHESTRATION-UX-DESIGN.md`
- `docs/ENTERPRISE-AGENT-ARCHITECTURE.md`
- `docs/cleanroom-spec/*`

## 12. 技术栈

| 技术 | 作用 |
|---|---|
| React 18 | UI |
| TypeScript 5 | 类型与构建 |
| Vite 6 | 开发 / 构建 |
| Tailwind CSS | 样式系统 |
| React Router 6 | 路由 |
| `@xyflow/react` | 图谱可视化 |
| dagre | 自动布局 |
| Recharts | 图表 |
| Zustand | 状态管理依赖 |
