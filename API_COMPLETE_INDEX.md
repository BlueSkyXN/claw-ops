# API Documentation Index

本仓库当前建议按以下顺序阅读 API 文档：

1. `docs/API-INTEGRATION.md`
   - 仓库实际实现的 provider、Gateway / bridge 接入方式
2. `OPENCLAW_API_REFERENCE.md`
   - claw-ops 当前实际使用的接口与关键类型
3. `API_MAPPING_SUMMARY.md`
   - 快速映射速查

## 说明

历史版本的 API 文档曾把外部 OpenClaw 设计材料、假定的网关方法和旧实现草稿混在一起。当前索引已经收敛为：

- 只记录本仓库代码里已经接入或明确依赖的方法
- 把“设计 / 愿景”与“当前实现”分开
- 把 `chat.send`、CLI / Hybrid、编排路由等近期变更反映到文档中

## 当前关注点

### 1. Orchestration 路由已拆分

当前编排页不是单一路由说明，而是：

- `/orchestration/overview`
- `/orchestration/tasks`
- `/orchestration/topology`

### 2. `chat.send` 已使用新版关键字段

```ts
{
  sessionKey,
  message,
  idempotencyKey
}
```

### 3. CLI / Hybrid 已进入实现态

当前仓库已有：

- `BridgeAPI`
- `HybridAPI`
- Setup 中的 bridge / Gateway 测试
- capability 驱动的页面降级

### 4. 历史设计文档不等于当前 source of truth

以下文档应按“设计 / 规划”阅读：

- `docs/ORCHESTRATION-UX-DESIGN.md`
- `docs/ENTERPRISE-AGENT-ARCHITECTURE.md`
- `docs/cleanroom-spec/*`
