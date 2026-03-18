# claw-ops — CLI / Hybrid 集成说明

> 状态：**已部分实现**
>
> 本文档同时包含两类信息：
>
> 1. **当前实现边界**：以 `src/lib/api.ts`、`src/lib/config.ts`、`src/pages/Setup.tsx` 为准
> 2. **后续扩展方向**：明确标为“规划”

## 1. 当前已实现内容

### 1.1 模式

当前 `AppMode` 已经包含：

- `demo`
- `realtime`
- `cli`
- `hybrid`

### 1.2 provider

当前 `getAPI()` 已实现：

- `BridgeAPI`
- `HybridAPI`

不再只是设计稿。

### 1.3 Setup

`src/pages/Setup.tsx` 当前已支持：

- 选择 `cli` / `hybrid`
- 配置 `bridgeUrl`
- 配置可选 `bridgeAuthToken`
- 在测试步骤调用：
  - `GET /health`
  - Gateway 握手（若模式包含 Gateway）
- 将 `bridgeCapabilities` 写回本地配置

### 1.4 bridge 客户端

`src/lib/bridge-client.ts` 当前已实现：

- `bridgeFetch()`
- `bridgeRpc()`
- `getBridgeHealth()`
- `getBridgeCapabilities()`

### 1.5 页面降级

前端已经按 capability 做部分降级，而不是只按 mode 名字硬编码：

- `Sessions` 页会在纯 CLI 且 `sessionMutations` 不支持时禁用重置 / 删除
- orchestration runtime 没有实时事件能力时会回退为 polling

## 2. 当前实际架构

```text
Browser UI
  ├─ demo      -> mockAPI
  ├─ realtime  -> GatewayAPI -> OpenClaw Gateway
  ├─ cli       -> BridgeAPI  -> local bridge
  └─ hybrid    -> HybridAPI  -> Gateway + bridge
```

### 2.1 bridge 作用

bridge 的职责是作为浏览器与本机能力之间的受控边界：

- 提供健康检查
- 暴露能力矩阵
- 通过 RPC 暴露受控 CLI / 文件 / 本地状态能力

浏览器不会直接执行 shell，也不会直接读取本机 OpenClaw 目录。

## 3. 当前 provider 行为

### 3.1 `BridgeAPI`

当前 `BridgeAPI` 已暴露与 `DataAPI` 对齐的方法，例如：

- `getAgents`
- `createAgent`
- `updateAgent`
- `deleteAgent`
- `agentFiles*`
- `getSessions`
- `getSessionsUsage`
- `getUsageCost`
- `sendChatMessage`
- `getChannelsStatus`
- `getCronJobs`
- `getLogs`
- `getModels`
- `getSkills`
- `getNodes`
- `getConfig`
- `getExecApprovals`

是否所有能力都真正可用，取决于 bridge 服务端支持情况和 capability 上报。

### 3.2 `HybridAPI`

当前 `HybridAPI` 的策略不是“简单合并”，而是分三类：

#### bridge 独占

- agent CRUD
- `agentFiles*`
- `installSkill`

#### Gateway 优先，失败时 bridge 降级

- 读取类能力
- `sendChatMessage`
- 多数 cron / logs / usage / config / approvals 读取

#### Gateway 独占

- `patchSession`
- `resetSession`
- `deleteSession`
- `resolveExecApproval`

## 4. 当前 capability 模型

bridge 健康数据里会返回：

```ts
interface BridgeCapabilityFlags {
  snapshot: boolean
  presence: boolean
  agentCrud: boolean
  agentFiles: boolean
  skillInstall: boolean
  sessionMutations: boolean
  approvals: boolean
  realtimeEvents: boolean
  cronCrud: boolean
  usage: boolean
  logs: boolean
}
```

这份 capability 会被 Setup 写入本地配置，供页面判断是否降级。

## 5. 当前明确限制

以下内容不能笼统视为“CLI 已完全支持”：

### 5.1 会话变更

虽然 `BridgeAPI` 定义了：

- `patchSession`
- `resetSession`
- `deleteSession`

但纯 CLI 模式下是否真的可用，仍以 bridge capability 为准。前端已经对此做显式禁用提示。

### 5.2 审批处理

`resolveExecApproval()` 在 `HybridAPI` 中仍走 Gateway。

因此没有 Gateway 时，不应把审批处理视为必然可用。

### 5.3 实时事件

纯 CLI 模式下不应宣称具备 Gateway 同等级实时事件流。

当前前端的回退策略是：

- 有 `realtimeEvents`：可按事件刷新
- 无 `realtimeEvents`：polling

## 6. 当前 source of truth

判断 CLI / Hybrid 是否“已经支持某能力”时，请以以下文件为准：

- `src/lib/config.ts`
- `src/lib/api.ts`
- `src/lib/bridge-client.ts`
- `src/pages/Setup.tsx`
- `src/types/bridge.ts`

## 7. 后续规划

以下仍属于后续扩展方向，而不是当前保证：

- 更完整的 source priority / stale 标记
- 更细粒度的 bridge capability 驱动 UI
- 更强的本地文件编辑 / 技能安装 / cron 写入验证
- 统一的桥接事件流
- 更明确的 bridge / Gateway 聚合冲突策略

## 8. 设计原则

这些原则仍然有效：

1. **Hybrid first**：保留 Gateway 作为标准实时入口
2. **Bridge as trust boundary**：浏览器不直接接触本机系统能力
3. **Capability-driven UI**：按 capability 决定行为，不只看 mode
4. **Source-of-truth 明确**：同类数据优先有唯一事实来源
5. **安全白名单**：bridge 暴露命名操作，而不是任意命令执行
