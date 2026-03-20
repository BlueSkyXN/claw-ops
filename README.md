# 🐾 claw-ops

**OpenClaw Operations Dashboard — 面向 OpenClaw 的运维与编排控制面**

claw-ops 是一个纯前端 SPA，用来观察和控制 OpenClaw 运行态。当前代码库已经支持：

- 智能体管理
- 会话与发送策略管理
- 渠道状态观测
- 定时任务 CRUD 与运行记录
- 用量 / 成本分析
- 日志查看与导出
- 企业编排控制面：Mission 发令、任务追踪、审批处理、任务干预、团队模板导入、拓扑可视化

> 当前文档以 `src/` 中的实现为准。历史设计稿仍保留在 `docs/`，但会明确标注为设计 / 规划材料。

## 功能总览

| 页面 | 路径 | 当前实现 |
|---|---|---|
| 总览 | `/` | KPI、编排健康条、Mission 发令台、经营绩效板、任务列表、任务活动、用量趋势、最近会话 |
| 智能体 | `/agents` | 智能体列表、创建 / 删除、预设角色库导入 |
| 会话 | `/sessions` | 会话筛选、详情查看、重置 / 删除（是否可用取决于当前运行能力） |
| 渠道 | `/channels` | 渠道卡片、账号状态、4 态状态灯、最近活动时间 |
| 定时任务 | `/cron` | 任务新增 / 编辑 / 删除 / 手动触发、运行记录 |
| 用量分析 | `/usage` | `sessions.usage` + `usage.cost` 双接口统计、日期范围筛选、模型 / 供应商 / 智能体 / 渠道聚合 |
| 编排 | `/orchestration/*` | 分为 `overview` / `tasks` / `execution` / `topology` 四个子视图 |
| 日志 | `/logs` | 日志筛选、自动刷新、CSV 导出 |
| 配置 | `/setup` | 4 步向导，支持 `demo` / `realtime` / `cli` / `hybrid` |

## 编排页当前结构

编排页已经不是单一 `/orchestration` 视图，而是内部拆分为四个子视图：

- `/orchestration/overview`：运行态摘要、**OperationsMonitorBoard**、Mission 发令、团队模板
- `/orchestration/tasks`：**TaskKanbanBoard**、任务列表、任务活动、单任务控制卡
- `/orchestration/execution`：**WorkflowExecutionPanel**、workflow instance 上下文、节点状态、关联日志
- `/orchestration/topology`：执行图谱 / 入口拓扑 / 组织架构三种画布视图

兼容路由：

- `/orchestration` 会落到编排页并默认显示 overview
- `/topology` 会重定向到 `/orchestration/topology`

## 运行模式

当前实现的运行模式定义在 `src/lib/config.ts`：

| 模式 | 说明 | 数据通路 |
|---|---|---|
| `demo` | 内置 mock 工作区 | `mockAPI` |
| `realtime` | 仅连接 OpenClaw Gateway | `GatewayAPI` |
| `cli` | 仅连接本地 bridge | `BridgeAPI` |
| `hybrid` | bridge + Gateway 同时启用 | `HybridAPI` |

### CLI / Hybrid 当前状态

CLI / Hybrid 已经落地，不再只是设计稿：

- `npm run bridge` 可启动本地 bridge
- Setup 支持 bridge / gateway 分别测试
- `getAPI()` 会根据配置返回 `BridgeAPI` 或 `HybridAPI`
- `Sessions` 页面会根据 bridge 上报的 capability 显式禁用不支持的会话变更动作

当前仍需注意：

- 纯 `cli` 模式下，是否支持会话变更 / 审批处理 / 实时事件，取决于 bridge capability
- `hybrid` 下部分高权限动作仍优先走 Gateway
- 纯 CLI 观测刷新会退化为 polling，而不是 Gateway 事件流

## 快速开始

```bash
npm install

# 默认开发模式（通常是 demo）
npm run dev

# 显式 demo
npm run dev:demo

# 启动本地 bridge
npm run bridge

# 构建
npm run build

# 预览
npm run preview
```

默认开发地址通常为 Vite 输出地址，例如 `http://localhost:5173`；以终端实际输出为准。

## 配置真实 OpenClaw

1. 打开 `/setup`
2. 选择运行模式：`realtime`、`cli` 或 `hybrid`
3. 若模式包含 Gateway，填写 WebSocket 地址，例如 `ws://127.0.0.1:18789`
4. 若模式包含 bridge，填写 HTTP 地址，例如 `http://127.0.0.1:18796`
5. 在测试步骤验证连接并保存

注意：

- Gateway URL 不会自动追加额外路径，文档中如果看到 `/api/gateway` 一类旧说法，应以当前配置页和 `GatewayClient.normalizeUrl()` 的行为为准
- 浏览器只把 bridge 当作 HTTP 服务调用，不会直接访问本机文件系统

## API 集成概览

claw-ops 的统一数据入口是 `src/lib/api.ts` 中的 `DataAPI`：

- `mockAPI`
- `GatewayAPI`
- `BridgeAPI`
- `HybridAPI`

控制面当前实际使用的主要能力包括：

- `agents.list/create/update/delete`
- `agents.files.list/get/set`
- `sessions.list/patch/reset/delete`
- `sessions.usage`
- `usage.cost`
- `chat.send`
- `channels.status`
- `cron.list/add/update/remove/run/runs`
- `logs.tail`
- `models.list`
- `skills.status/install`
- `node.list`
- `config.get`
- `exec.approvals.get`
- `exec.approval.resolve`

### `chat.send` 当前参数

当前控制面与类型定义都已切到新版字段：

```ts
{
  sessionKey: string
  message: string
  idempotencyKey: string
}
```

其中：

- `sessionKey`、`message`、`idempotencyKey` 是 Gateway 官方出口的核心字段
- `agentId`、`channel`、`to`、`metadata` 等字段仅作为 mock / bridge / 控制面适配提示使用
- `GatewayAPI` 在发送前会剥离这些非官方字段

## 架构速览

```text
页面组件
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
      -> workflow-definition
      -> workflow-observer
```

关键文件：

- `src/App.tsx`：路由定义
- `src/components/Layout.tsx`：主导航与顶栏刷新 / 审批提示
- `src/lib/config.ts`：运行模式与持久化配置
- `src/lib/api.ts`：统一 DataAPI
- `src/lib/gateway-client.ts`：WebSocket Gateway 客户端
- `src/lib/bridge-client.ts`：bridge HTTP 客户端
- `src/lib/orchestration-runtime.ts`：编排页运行时装配与控制动作
- `src/lib/workflow-definition.ts`：workflow 定义骨架与从预设/任务导出的 definition
- `src/lib/workflow-observer.ts`：把任务与步骤映射成 workflow execution 视图
- `src/types/workflow.ts`：workflow definition / execution 类型
- `src/types/openclaw.ts`：OpenClaw / 控制面使用的主要类型

## 文档导航

| 文档 | 用途 |
|---|---|
| `docs/ARCHITECTURE.md` | 当前代码架构说明 |
| `docs/API-INTEGRATION.md` | 当前仓库实际接入的 API 与 provider 说明 |
| `docs/PAGES.md` | 页面 / 路由 / 子视图说明 |
| `docs/CLI-HYBRID-INTEGRATION.md` | CLI / Hybrid 的当前实现边界与后续规划 |
| `docs/ORCHESTRATION-UX-DESIGN.md` | 编排 UX 设计稿，**不是当前行为的 source of truth** |
| `OPENCLAW_API_REFERENCE.md` | 本仓库实际使用的 OpenClaw 接口参考 |

## 许可证

[GPL-3.0-only](LICENSE)
