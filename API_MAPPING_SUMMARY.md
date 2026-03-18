# API Mapping Summary

> 这是面向本仓库的简明映射，不是 OpenClaw 全量公共 API 目录。

## 当前接入面概览

### Provider

- `mockAPI`
- `GatewayAPI`
- `BridgeAPI`
- `HybridAPI`

### 运行模式

- `demo`
- `realtime`
- `cli`
- `hybrid`

## `DataAPI` 到底层实现的映射

| 能力 | Gateway | Bridge | Hybrid |
|---|---|---|---|
| 智能体读取 / 创建 / 删除 | ✅ | ✅ | bridge 优先 |
| agent 文件 | ✅ | ✅ | bridge 优先 |
| 会话列表 | ✅ | ✅ | Gateway 优先，失败降级 |
| 会话变更 | ✅ | bridge 取决于 capability | Gateway |
| 用量 / 成本 | ✅ | ✅ | Gateway 优先，失败降级 |
| `chat.send` | ✅ | ✅ | Gateway 优先，失败降级 |
| 渠道状态 | ✅ | ✅ | Gateway 优先，失败降级 |
| cron | ✅ | ✅ | Gateway 优先，失败降级 |
| 日志 | ✅ | ✅ | Gateway 优先，失败降级 |
| 审批读取 | ✅ | ✅ | Gateway 优先，失败降级 |
| 审批处理 | ✅ | bridge 不保证 | Gateway |

## 当前实际使用的 Gateway 方法

```text
health
system-presence

agents.list
agents.create
agents.update
agents.delete
agents.files.list
agents.files.get
agents.files.set

skills.status
skills.install

sessions.list
sessions.patch
sessions.reset
sessions.delete
sessions.usage
usage.cost

chat.send

channels.status

cron.list
cron.add
cron.update
cron.remove
cron.run
cron.runs

logs.tail
models.list
node.list
config.get

exec.approvals.get
exec.approval.resolve
```

## `chat.send` 当前关键点

当前控制面使用的核心字段：

```ts
{
  sessionKey,
  message,
  idempotencyKey
}
```

说明：

- 旧文档里如果出现其他历史字段，应以当前类型定义和 `normalizeGatewayChatSendParams()` 为准
- `agentId` / `channel` / `to` / `metadata` 是控制面内部提示字段，不会直接发给 Gateway

## 编排页当前路由

```text
/orchestration/overview
/orchestration/tasks
/orchestration/topology
```

兼容入口：

```text
/topology -> /orchestration/topology
```

## 当前关键组件

- `OperationsMonitorBoard`
- `TaskKanbanBoard`
- `MissionDispatchPanel`
- `ActiveTasksPanel`
- `OrchestratorHealthStrip`

## 推荐继续查阅

- `docs/API-INTEGRATION.md`
- `docs/PAGES.md`
- `docs/ARCHITECTURE.md`
- `OPENCLAW_API_REFERENCE.md`
