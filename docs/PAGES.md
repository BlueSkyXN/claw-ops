# claw-ops — 页面与路由文档

> 本文档以 `src/App.tsx`、`src/components/Layout.tsx` 和各页面组件当前实现为准。

## 1. 路由总览

| 路径 | 页面 | 文件 | 说明 |
|---|---|---|---|
| `/setup` | 配置向导 | `src/pages/Setup.tsx` | 独立页面，不使用 `Layout` |
| `/` | 总览 | `src/pages/Dashboard.tsx` | 经营概览 + Mission 发令 + 任务监控 |
| `/agents` | 智能体 | `src/pages/Agents.tsx` | 智能体列表 + 预设角色库 |
| `/sessions` | 会话 | `src/pages/Sessions.tsx` | 会话列表与详情 |
| `/channels` | 渠道 | `src/pages/Channels.tsx` | 渠道 / 账号状态 |
| `/cron` | 定时任务 | `src/pages/CronJobs.tsx` | 定时任务 CRUD |
| `/usage` | 用量分析 | `src/pages/Usage.tsx` | 用量与成本统计 |
| `/orchestration/*` | 编排控制面 | `src/pages/Orchestration.tsx` | 内部分为 overview / tasks / topology |
| `/topology` | 兼容入口 | `src/App.tsx` | 重定向到 `/orchestration/topology` |
| `/logs` | 日志 | `src/pages/Logs.tsx` | 日志过滤 / 导出 |

> 仓库里仍有 `src/pages/Topology.tsx`，但当前 `App.tsx` 不再直接路由到它。运行时入口是 `/orchestration/topology`。

## 2. Layout 共享能力

除 `/setup` 外，所有主页面都运行在 `src/components/Layout.tsx` 中。

### 2.1 侧边栏菜单

| 标签 | 路径 |
|---|---|
| 总览 | `/` |
| 智能体 | `/agents` |
| 会话 | `/sessions` |
| 渠道 | `/channels` |
| 定时任务 | `/cron` |
| 用量分析 | `/usage` |
| 编排 | `/orchestration` |
| 日志 | `/logs` |

### 2.2 顶栏能力

- 基于路径自动显示标题
- 手动刷新：重新挂载当前 `<Outlet>`
- 自动刷新：按配置的 `refreshInterval` 倒计时刷新
- 全局审批数徽章：定期读取 `getExecApprovals()`，并监听
  - `exec.approval.requested`
  - `exec.approval.resolved`

### 2.3 模式显示

当前底部模式文案来自 `MODE_LABELS`：

- demo
- realtime
- cli
- hybrid

## 3. 总览页 `/`

**文件**：`src/pages/Dashboard.tsx`

### 当前模块

1. `QuickStartBanner`
   - 仅当 `runtime.experience === null` 时显示
   - 支持一键导入 `opc-super-assistant`
   - “预览编排”跳转到 `/orchestration`

2. KPI 卡片
   - 活跃任务
   - 治理压力
   - 任务动向
   - 交付风险

3. `OrchestratorHealthStrip`
   - 显示编排健康分、缺失层、瓶颈与建议

4. `MissionDispatchPanel`
   - 直接派发 Mission
   - 通过 `dispatchMission()` 调用 `chat.send`

5. `ExecutivePerformanceBoard`
   - 将用量 / 渠道 / 任务态翻译成经营视角指标

6. `ActiveTasksPanel`
   - 支持暂停 / 恢复、催办、重置、审批通过 / 驳回

7. `TaskActivityFeed`
   - 聚合任务过程与日志

8. 14 天趋势图
   - `AreaChart`
   - 数据来自 `runtime.usage.aggregates.daily`

9. 模型分布图
   - `BarChart`
   - 数据来自 `runtime.usage.aggregates.byModel`

10. 最近会话
   - 最近 8 条

### 数据来源

通过 `loadOrchestrationRuntime()` 聚合读取：

- `agents`
- `sessions`
- `sessions.usage`
- `channels.status`
- `logs.tail`
- `exec.approvals.get`
- `node.list`
- `config.get`

并通过 `subscribeToOrchestrationEvents()` 刷新。

## 4. 智能体页 `/agents`

**文件**：`src/pages/Agents.tsx`

### 当前结构

顶部为双标签：

- `🤖 智能体`
- `📦 预设角色库`

### 智能体标签

- 三列卡片网格
- 每卡显示：
  - emoji
  - 名称
  - `agent.id`
  - identity theme（如存在）
- 支持删除
- 顶部支持空白创建

### 预设角色库标签

- 由 `PresetBrowser` 承载
- 支持浏览角色详情与导入

> 当前 `Agents` 页没有“团队”独立标签；若其他设计稿提到该标签，属于规划而非当前实现。

## 5. 会话页 `/sessions`

**文件**：`src/pages/Sessions.tsx`

### 当前功能

- KPI：
  - 总会话数
  - direct 数
  - group 数
  - 总 token
- 筛选：
  - channel
  - kind
  - search
- 表格：
  - 标签 / key
  - 渠道
  - 类型
  - 模型
  - token
  - 更新时间
- 详情弹窗：
  - 渠道、模型、供应商、sendPolicy、智能体、token
  - thinkingLevel / reasoningLevel / responseUsage / contextTokens

### 运行能力降级

`cli` 模式下会根据 `getRuntimeCapabilities(config).sessionMutations` 决定是否禁用：

- 重置会话
- 删除会话

因此会话页不是“永远可变更”的，文档需要结合当前运行能力理解。

## 6. 渠道页 `/channels`

**文件**：`src/pages/Channels.tsx`

### 当前功能

- KPI：
  - 总渠道数
  - 总账号数
  - 已连接账号数
  - 错误数
- 渠道卡片
- 展开后账号详情

### 账号详情字段

- `configured`
- `linked`
- `running`
- `connected`
- `lastConnectedAt`
- `lastInboundAt`
- `lastOutboundAt`
- `activeRuns`
- `reconnectAttempts`
- `lastError`
- `mode`
- `dmPolicy`
- `allowFrom`

## 7. 定时任务页 `/cron`

**文件**：`src/pages/CronJobs.tsx`

### 当前功能

- 任务列表
- 新增任务弹窗
- 编辑任务
- 删除任务
- 手动运行
- 运行记录

### 支持的 schedule

- `at`
- `every`
- `cron`

### 支持的 payload

- `agentTurn`
- `systemEvent`

## 8. 用量分析页 `/usage`

**文件**：`src/pages/Usage.tsx`

### 当前功能

- 开始 / 结束日期筛选
- 并行请求：
  - `getSessionsUsage()`
  - `getUsageCost()`
- 图表：
  - 日维度趋势
  - 模型 / 供应商 / 智能体 / 渠道聚合
  - Top 会话
- 兼容旧 gateway 对 `mode` / `utcOffset` 参数的拒绝

### 当前限制

- 会话抓取上限 `SESSION_FETCH_LIMIT = 1000`
- 模型 / 供应商 / 会话等表格都有限定条数，避免 UI 过载

## 9. 编排控制面 `/orchestration/*`

**文件**：`src/pages/Orchestration.tsx`

编排页已经拆成三个内部 section，由路径决定：

| section | 路径前缀 | 说明 |
|---|---|---|
| `overview` | `/orchestration/overview` 或 `/orchestration` | 总览与团队激活 |
| `tasks` | `/orchestration/tasks` | 任务工作台 |
| `topology` | `/orchestration/topology` | 画布与拓扑 |

### 9.1 Overview 子视图

当前模块：

- 顶部编排控制面摘要
- `OrchestratorHealthStrip`
- `OperationsMonitorBoard`
- `MissionDispatchPanel`
- `TeamPresetsPanel`
- quick start 卡片
- 右侧运行态摘要
- 详情面板

### 9.2 Tasks 子视图

当前模块：

- `TaskKanbanBoard`
- `ActiveTasksPanel`
- `TaskActivityFeed`
- `TaskControlCard`

`TaskControlCard` 目前支持：

- 暂停 / 恢复接收
- 催办
- 重置会话
- 审批通过 / 驳回
- 快速重派

### 9.3 Topology 子视图

当前模块：

- 视图切换：
  - 执行图谱 `graph`
  - 入口拓扑 `channels`
  - 组织架构 `org`
- 交互模式：
  - 浏览锁定
  - 布局拖动
- 操作：
  - 重新布局
  - 保存布局
  - 重置布局
  - 专注阅读

### 9.4 详情类型

右侧详情面板当前支持：

- team
- quickstart
- channel
- role

### 9.5 数据与刷新

通过 `loadOrchestrationRuntime()` 加载；通过 `subscribeToOrchestrationEvents()` 刷新。

## 10. 日志页 `/logs`

**文件**：`src/pages/Logs.tsx`

### 当前功能

- 级别筛选
- 来源筛选
- 文本搜索
- 自动刷新开关
- CSV 导出

### 当前实现注意点

- 页面本地每 5 秒自动刷新一次（当开关打开时）
- `getLogs()` 返回的已是前端解析后的 `LogEntry[]`
- 导出字段为：时间戳、级别、来源、消息

## 11. 配置页 `/setup`

**文件**：`src/pages/Setup.tsx`

### 4 步流程

1. `mode`
2. `connection`
3. `test`
4. `done`

### 当前支持的模式

- `demo`
- `realtime`
- `cli`
- `hybrid`

### connection 步骤

根据模式动态显示：

- bridge 配置
  - `bridgeUrl`
  - `bridgeAuthToken`
- gateway 配置
  - `gatewayUrl`
  - `authType`
  - `authToken` / `authPassword`

### test 步骤

可能测试：

- bridge `/health`
- gateway 握手与 snapshot

保存时还会把 `bridgeCapabilities` 写回本地配置。

> 当前 Setup 没有“预设团队”额外步骤；如果某些设计文档提到插入 presets step，那是后续设想。

## 12. 兼容与历史文件

### `/topology`

- 当前仅作兼容重定向
- 真正的拓扑入口是 `/orchestration/topology`

### `src/pages/Topology.tsx`

- 仍保留旧拓扑实现文件
- 当前未被 `App.tsx` 使用
- 可视为历史页面实现，不是当前导航结构的一部分
