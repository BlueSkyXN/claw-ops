# claw-ops — 编排工作流升级 UX 设计规范
**版本**: 1.0  |  **作者**: UI Design  |  **日期**: 2025

> 将 claw-ops 从"拓扑查看器"升级为 Coze/Dify 风格的多智能体编排中心，
> 同时完整保留现有马卡龙色彩系统与组件语言，并提供开箱即用的 OPC 超级助理团队预设入口。

---

## 目录

1. [当前状态分析](#1-当前状态分析)
2. [升级目标与设计原则](#2-升级目标与设计原则)
3. [信息架构重组](#3-信息架构重组)
4. [页面变更清单](#4-页面变更清单)
5. [Dashboard 升级方案](#5-dashboard-升级方案)
6. [Agents 页升级方案](#6-agents-页升级方案)
7. [编排画布 — Orchestration 新页面](#7-编排画布--orchestration-新页面)
8. [预设导入入口系统](#8-预设导入入口系统)
9. [多智能体编排的数据呈现方式](#9-多智能体编排的数据呈现方式)
10. [新增组件规范](#10-新增组件规范)
11. [设计令牌扩展](#11-设计令牌扩展)
12. [实现路线图](#12-实现路线图)

---

## 1. 当前状态分析

### 现有页面清单

| 路由 | 文件 | 当前职责 | 升级优先级 |
|------|------|----------|-----------|
| `/` | Dashboard.tsx | KPI + 趋势图 + 近期会话 + 智能体列表 | 🔴 高 — 需增加编排健康感知 |
| `/agents` | Agents.tsx | 智能体 CRUD + 预设浏览器 | 🔴 高 — 需增团队视角 |
| `/topology` | Topology.tsx | 渠道→智能体拓扑图（只读） | 🔴 高 — 需升级为编排画布 |
| `/sessions` | Sessions.tsx | 会话表格 | 🟡 中 — 增加智能体归因标注 |
| `/channels` | Channels.tsx | 渠道连接状态 | 🟢 低 — 保持不变 |
| `/cron` | CronJobs.tsx | 定时任务 | 🟢 低 — 保持不变 |
| `/usage` | Usage.tsx | 用量分析 | 🟢 低 — 保持不变 |
| `/logs` | Logs.tsx | 运行日志 | 🟢 低 — 保持不变 |
| `/setup` | Setup.tsx | 配置向导 | 🟡 中 — 在完成步骤插入预设 CTA |

### 现有优势（必须保留）

- **设计系统成熟**: 马卡龙色系、`card` / `btn-primary` / `badge-*` 组件类、Tailwind 令牌体系完备
- **ReactFlow 已集成**: 拓扑图基础设施、dagre 布局、自定义节点类型已就绪
- **预设系统完整**: `presets.ts` 已有 `deployRole()` / `deployTeam()` / `loadTeamTemplate()`，三套团队模板已存在
- **类型定义丰富**: `PresetRoleWorkflow` (handoffTo/acceptsFrom)、`PresetRoleAuthority` (allowAgents/escalateTo) 已有，可直接驱动编排图边关系

### 核心能力缺口

1. **无团队视角**: 15 个角色只能逐个查看，看不到它们共同构成的编排网络
2. **预设入口太深**: 需进 `/agents` → 点"预设角色库"标签 → 才看到导入，用户发现率极低
3. **拓扑只读、无语义**: 现有 Topology 仅显示渠道→智能体的基础连接，缺少层级、工作流阶段等语义
4. **无编排健康感知**: Dashboard 不告诉用户"L2 协调层缺失"或"有 3 个待升级通知"
5. **无 OPC 超级助理概念**: 用户不知道部署完整团队意味着什么，缺少价值主张入口

---

## 2. 升级目标与设计原则

### 核心目标

> **让用户在 3 次点击内**完成：发现预设团队 → 了解架构 → 一键导入完整 OPC 超级助理体验。

### 设计原则

| 原则 | 含义 | 实现方式 |
|------|------|----------|
| **渐进披露** | 先展示价值，再展示复杂度 | Dashboard 快捷入口 → Agents 团队预览 → 编排画布详情 |
| **语义可视化** | 图形承载业务含义，而非纯技术拓扑 | 四层泳道、角色层级徽章、工作流边类型 |
| **品牌一致** | 完全复用现有马卡龙色系 | 使用 LAYER_STYLES 已有 4 色映射到 L0-L3 |
| **数据驱动** | 界面元素与后端数据直接绑定 | 从 workflow.json/authority.json 生成边，from agentFilesGet |
| **空状态即入口** | 空画布是导入的最佳机会 | 0 智能体时显示 OPC 团队 CTA，覆盖全屏 |

---

## 3. 信息架构重组

### 侧边栏导航变更

```
【 现有 】                        【 升级后 】
📊  总览         /               📊  总览         /
🤖  智能体       /agents    →    🤖  智能体       /agents   （强化）
💬  会话         /sessions       💬  会话         /sessions
📡  渠道         /channels       📡  渠道         /channels
⏰  定时任务     /cron           ⏰  定时任务     /cron
📈  用量分析     /usage          📈  用量分析     /usage
🔗  拓扑         /topology  →    🧩  编排         /orchestration （重命名+重建）
📜  日志         /logs           📜  日志         /logs
```

**变更说明**:
- `/topology` → `/orchestration`，路由迁移（旧路由重定向到新路由）
- 图标从 🔗 改为 🧩，标签从"拓扑"改为"编排"，传达可操作的编排工作台概念
- 其余路由不变

### 新增路由

```tsx
// App.tsx 新增
<Route path="/orchestration" element={<Orchestration />} />
<Route path="/topology" element={<Navigate to="/orchestration" replace />} />
```

---

## 4. 页面变更清单

### 必须改动（Phase 1）

| 文件 | 改动类型 | 关键变更 |
|------|----------|---------|
| `src/App.tsx` | 路由 | 增加 `/orchestration`，`/topology` 重定向 |
| `src/components/Layout.tsx` | 导航 | 拓扑→编排，图标更新 |
| `src/pages/Dashboard.tsx` | 内容扩展 | 加编排健康条 + 快速开始 Banner |
| `src/pages/Agents.tsx` | 标签扩展 | 加"团队"标签，升级 AgentCard |
| `src/pages/Topology.tsx` (→ Orchestration) | 全面重构 | 三视图画布 |

### 新增文件（Phase 1）

| 文件 | 职责 |
|------|------|
| `src/pages/Orchestration.tsx` | 编排画布页面（三视图） |
| `src/components/OrchestrationGraph.tsx` | 智能体→智能体工作流 ReactFlow 画布 |
| `src/components/OrchestratorHealthStrip.tsx` | Dashboard 编排健康横条 |
| `src/components/TeamPresetsPanel.tsx` | 团队模板浏览器（区别于单角色的 PresetBrowser）|
| `src/components/AgentLayerBadge.tsx` | 层级徽章原子组件（L0-L3 颜色映射）|
| `src/components/QuickStartBanner.tsx` | 空状态 OPC 超级助理 CTA |

### 渐进改动（Phase 2）

| 文件 | 改动 |
|------|------|
| `src/pages/Sessions.tsx` | 在每行加 `AgentLayerBadge`，显示响应该会话的智能体层级 |
| `src/pages/Setup.tsx` | 在 `done` 步骤之前插入"配置预设团队"可选步骤 |

---

## 5. Dashboard 升级方案

### 整体布局（升级后）

```
┌─────────────────────────────────────────────────────────────┐
│  [QuickStartBanner — 仅在 agents.length === 0 时显示]       │
│  🚀 一键部署 OPC 超级助理团队  [预览架构] [立即部署]        │
└─────────────────────────────────────────────────────────────┘

┌──────────┬──────────┬──────────┬──────────┐
│ 智能体数 │ 活跃会话 │ 已连接渠 │  总费用  │  ← 现有 4 个 stat-card，不变
└──────────┴──────────┴──────────┴──────────┘

┌─────────────────────────────────────────────────────────────┐
│  OrchestratorHealthStrip — 编排架构健康状态                  │
│  [L0 治理 ✓ 3]  [L1 决策 ✓ 3]  [L2 协调 ⚠ 缺失]  [L3 执行 ✓ 6]  │
│  右侧: "补全缺失层 →" 链接                                  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────┬───────────────────────────┐
│  14 天用量趋势图（现有）         │  团队架构摘要卡（新增）    │
│                                 │  显示已部署的团队模板名称   │
│                                 │  + 各层角色数量迷你饼图     │
└─────────────────────────────────┴───────────────────────────┘

┌─────────────────────────────────┬───────────────────────────┐
│  最近会话（现有，稍微增强）       │  模型用量分布（现有）      │
└─────────────────────────────────┴───────────────────────────┘
```

### QuickStartBanner 规格

**显示条件**: `agents.length === 0`
**位置**: stat-card 行上方，全宽
**视觉**: `bg-gradient-blue` 渐变背景，白色文字，圆角 2xl

```
┌─────────────────────────────────────────────────────────────┐
│  ✨  还没有智能体？一键部署 OPC 企业级超级助理团队           │
│                                                             │
│  包含 15 个预设角色：L0 治理层（3）· L1 决策层（3）·        │
│  L2 协调层（3）· L3 执行层（6）                              │
│                                                             │
│  [预览团队架构]  [🚀 一键部署完整团队]  [× 暂时忽略]       │
└─────────────────────────────────────────────────────────────┘
```

**交互**:
- "预览团队架构" → 打开 `TeamPresetsPanel` modal，展示 `full-enterprise-command-center` 模板
- "一键部署完整团队" → 直接调用 `deployTeam('full-enterprise-command-center')` + 进度 toast
- "暂时忽略" → 隐藏 banner，写入 localStorage `'claw-ops-banner-dismissed'`，30天内不再显示

### OrchestratorHealthStrip 规格

**显示条件**: 始终显示（`agents.length > 0` 时）
**数据来源**: 从已加载的 `agents[]` 列表中，通过 `agentFilesGet(id, 'workflow.json')` 按需获取层级信息（并缓存）

**视觉结构**:
```
┌─────────────────────────────────────────────────────────────┐
│ 🏢 编排架构                                      [进入编排 →]│
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ L0 治理  │  │ L1 决策  │  │ L2 协调  │  │ L3 执行  │  │
│  │  ✓ 3个  │  │  ✓ 3个  │  │  ⚠ 0个  │  │  ✓ 6个  │  │
│  │ 红色边框 │  │ 琥珀边框 │  │ 红色警告 │  │ 绿色边框 │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
│                              从预设补全 ↗                   │
└─────────────────────────────────────────────────────────────┘
```

**颜色映射**（复用 PresetBrowser 中现有 LAYER_STYLES）:
- L0: `bg-red-500/5 border-red-500/20 text-red-400`（治理/审计 = 红色权威）
- L1: `bg-amber-500/5 border-amber-500/20 text-amber-400`（决策 = 琥珀判断）
- L2: `bg-blue-500/5 border-blue-500/20 text-blue-400`（协调 = 蓝色协同）
- L3: `bg-emerald-500/5 border-emerald-500/20 text-emerald-400`（执行 = 绿色交付）

**层级缺失状态**: 改用 `bg-surface-hover border-dashed border-surface-border text-text-muted`，内容文字"⚠ 缺失"加"从预设补全"链接

**性能优化**: 层级信息从 `workflow.json` 的 `tier` 字段读取，仅第一次进入页面时批量拉取并缓存到组件 state；mock 模式直接从 mock 数据补全

---

## 6. Agents 页升级方案

### 标签结构（升级后）

```
🤖 智能体 (15)  |  🏢 团队  |  📦 预设角色库
                              ↑ 现有 PresetBrowser，保持不变
```

**新增"团队"标签**内容：

```
┌─────────────────────────────────────────────────────────────┐
│ 已部署团队模板                              [+ 部署新团队]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 🏢 企业级超级编排中心  v0.1.0          [查看架构图]  │  │
│  │ 15个角色 · L0(3) L1(3) L2(3) L3(6)                  │  │
│  │ 已部署: ✓ quality-director  ✓ security-officer ...   │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 🚀 产品交付战队  v0.1.0                [查看架构图]  │  │
│  │ 部分角色未部署  [补全缺失角色]                        │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**"查看架构图"**: 跳转到 `/orchestration?view=graph&template=<id>`

### AgentCard 升级规格

**现有 AgentCard**:
```
emoji + name + agentId + delete button + theme badge
```

**升级后 AgentCard**:
```
┌────────────────────────────────┐
│  🛡️  质量总监         [L0]  ✕  │  ← emoji + name + LayerBadge + delete
│  quality-director               │  ← agentId mono
├────────────────────────────────┤
│  ⚡ 推理模型  💔 高成本          │  ← modelTier + costTier badges (pastel)
│  阶段: planning, review         │  ← ownedStages from workflow.json (截断)
│  协作: 5 个智能体  上报: L1     │  ← allowAgents.length + escalateTo
├────────────────────────────────┤
│  [编辑配置]  [查看工作流]        │  ← actions row
└────────────────────────────────┘
```

**实现说明**:
- `[L0]` 徽章: `AgentLayerBadge` 组件，颜色由 LAYER_STYLES 映射
- modelTier / costTier: 从 `capabilities.json` 读取（agentFilesGet 缓存）
- ownedStages / allowAgents: 从 `workflow.json` / `authority.json` 读取（同一缓存批次）
- mock 模式: 在 `mock.ts` 中补充对应字段
- **性能**: 文件读取按需懒加载（卡片展开/hover 时触发），并缓存到 React context

### 创建智能体按钮升级

```
[现有]  [+ 创建智能体]

[升级后]  [+ 创建智能体 ▾]
            ├ 空白创建
            ├ 📦 从预设角色导入
            └ 🏢 部署团队模板
```

下拉菜单用 `relative + absolute` 实现，无需引入额外库。

---

## 7. 编排画布 — Orchestration 新页面

### 页面结构

路由: `/orchestration`
文件: `src/pages/Orchestration.tsx`

```
┌─────────────────────────────────────────────────────────────┐
│ 顶部工具栏                                                   │
│ [🔗 通道拓扑] [🧩 编排图谱] [🏢 组织架构]  ←视图切换      │
│                          [重新布局] [导出] [缩放控件]       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ReactFlow Canvas                     右侧详情 Panel       │
│   （主画布区，flex-1）                 （w-80，按需展开）   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 视图一：通道拓扑（Channel Topology）

**与现有 Topology.tsx 保持一致**，迁移后增强：
- 节点内增加实时在线账户计数角标
- 边上增加"上次消息"时间标注
- 支持点击渠道节点直接跳转 `/channels`
- 保留 MiniMap + Controls

### 视图二：编排图谱（Orchestration Graph）⭐ 核心新功能

**画布布局模式：四层泳道（Swimlane）**

```
  ┌──── L0 治理层 ─────────────────────────────────────────┐
  │   [🛡️ 质量总监]  [🔒 安全官]  [⚖️ 合规官]             │
  └───────────────────────────────────────────────────────────┘
         ↑ escalateTo edges（虚线琥珀）
  ┌──── L1 决策层 ─────────────────────────────────────────┐
  │   [📋 总调度官]  [🎯 策略顾问]  [🏗️ 解决方案架构师]   │
  └───────────────────────────────────────────────────────────┘
         ↑ handoffTo edges（实线靛蓝）
  ┌──── L2 协调层 ─────────────────────────────────────────┐
  │   [📌 项目经理]  [⚡ 技术负责人]  [🔑 角色治理官]      │
  └───────────────────────────────────────────────────────────┘
         ↑ handoffTo edges（实线靛蓝）
  ┌──── L3 执行层 ─────────────────────────────────────────┐
  │   [💻 后端]  [🎨 前端]  [🖥️ 运维]  [📊 数据]  [📝 内容] │
  └───────────────────────────────────────────────────────────┘
```

**节点设计（OrchestrationAgentNode）**:

```
┌──────────────────────────┐
│  🛡️  质量总监            │  ← emoji + name（14px semibold）
│  [L0] [🧠推理] [💔高]    │  ← LayerBadge + modelTier + costTier（10px pill）
│  ─────────────────────── │
│  planning · review       │  ← ownedStages（11px text-muted，最多 2 项）
│  ● 0 活跃                │  ← 实时活跃会话数（来自 sessions.list agentId 过滤）
└──────────────────────────┘
 左侧 Handle（acceptsFrom）    右侧 Handle（handoffTo）
 底部 Handle（escalateTo）
```

节点背景/边框颜色按层级（LAYER_STYLES 映射）：
- L0: 浅红底色 + 红色边框
- L1: 浅琥珀底色 + 琥珀边框
- L2: 浅蓝底色 + 蓝色边框
- L3: 浅绿底色 + 绿色边框

**边设计（3 种类型）**:

| 边类型 | 数据来源 | 样式 | 含义 |
|--------|----------|------|------|
| `handoff` | `workflow.json → handoffTo` | 实线 `#6366f1`（brand-500），箭头 | 工作流正向传递 |
| `accept` | `workflow.json → acceptsFrom` | 虚线 `#3b82f6`（accent-blue），无箭头 | 接受来源标注 |
| `escalate` | `authority.json → escalateTo` | 虚线 `#f59e0b`（accent-yellow），箭头 | 升级上报 |

边标签（条件文字）从 `teamTemplate.workflow[].condition` 读取：
```tsx
label: step.condition,
labelStyle: { fill: '#64748b', fontSize: 10 },
labelBgStyle: { fill: '#f8fafc', fillOpacity: 0.95 },
```

**泳道实现方案**:

用 ReactFlow `Background` + 自定义 SVG 泳道层（绝对定位的半透明矩形），按 dagre 计算每层 y 区间后渲染，不干扰节点拖拽：

```tsx
// 泳道背景组件（z-index: -1 in React Flow）
function SwimlaneBackground({ lanes }: { lanes: LaneInfo[] }) {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {lanes.map(lane => (
        <div
          key={lane.id}
          className="absolute left-0 right-0 border-l-4"
          style={{
            top: lane.y,
            height: lane.height,
            borderColor: LAYER_COLORS[lane.id].border,
            backgroundColor: LAYER_COLORS[lane.id].bg,
          }}
        >
          <span className="absolute left-2 top-2 text-xs font-medium opacity-40">
            {lane.id} {lane.name}
          </span>
        </div>
      ))}
    </div>
  )
}
```

**空画布状态**:

当没有智能体时，画布中央显示：
```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│           🧩  编排画布为空                              │
│                                                         │
│   部署智能体后，这里将显示完整的编排架构图谱            │
│                                                         │
│   [📦 从预设导入角色]   [🏢 部署完整团队]              │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 视图三：组织架构（Org Chart View）

树状图展示 L0-L3 层级关系，使用 ReactFlow 的树布局：

```
                  [🏢 企业级超级编排中心]
                 /          |           \
         [L0 治理]      [L1 决策]      ...
        /    |    \    /    |    \
    [质量] [安全] [合规] [调度] [策略] [架构]
                              |
                    [L2 协调] ...
                         |
                    [L3 执行] ...
```

节点简化，仅显示 emoji + name，用于快速了解组织全景。

### 右侧详情 Panel（统一复用现有 selectedDetail 模式）

点击任意节点，展开右侧 w-80 详情面板，内容按节点类型渲染：

**智能体详情**（增强版）:
- 头部: emoji + 名称 + agentId + LayerBadge
- 标签页: `概览 | 工作流 | 权限 | 技能 | SOUL预览`
- 概览: modelTier + costTier + timeout + maxConcurrent
- 工作流: ownedStages 列表 + 流转条件 + 成功/阻塞退出条件
- 权限: allowAgents + forbiddenAgents + escalateTo + mustNotify
- 技能: requiredSkills + optionalSkills + toolingProfile
- SOUL预览: 现有 `<pre>` 展示，复用 PresetBrowser 中已有代码
- 底部操作: `[重新导入]  [删除智能体]`

---

## 8. 预设导入入口系统

### 五个入口的完整体系

```
入口 1：Dashboard QuickStartBanner（最高曝光）
  → 显示条件：agents.length === 0
  → 行动: 一键部署团队 / 预览架构
  → 组件: QuickStartBanner.tsx

入口 2：Dashboard OrchestratorHealthStrip（问题引导）
  → 显示条件：某层级 count === 0
  → 行动: 点击"从预设补全" → 打开 PresetBrowser，预筛选缺失层级
  → 组件: OrchestratorHealthStrip.tsx 内联链接

入口 3：Agents 页 Header 分裂按钮（常驻主入口）
  → [+ 创建智能体 ▾]  → [空白创建 / 从预设导入 / 部署团队模板]
  → 组件: Agents.tsx 内

入口 4：Orchestration 画布空状态（场景引导）
  → 显示条件：nodes.length === 0
  → 行动: [📦 从预设导入角色] [🏢 部署完整团队]
  → 组件: OrchestrationGraph.tsx 空状态内

入口 5：Setup 向导完成步骤（首次配置引导）
  → 在 step='done' 之前插入 step='presets'
  → 内容: "推荐配置预设团队" + 三种团队模板选项
  → 用户可跳过，直接进入仪表盘
```

### TeamPresetsPanel 组件规格

区别于现有 `PresetBrowser`（单角色粒度），`TeamPresetsPanel` 以**团队模板**为展示粒度：

```
┌─────────────────────────────────────────────────────────────┐
│ 🏢 团队模板库                                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────┐                        │
│  │ 🏢 企业级超级编排中心  ⭐ 推荐  │                        │
│  │ 完整四层架构，适合全链路团队     │                        │
│  │                                 │                        │
│  │  L0 ●●●  L1 ●●●  L2 ●●●  L3 ●●●●●● │                  │
│  │  15 个角色  ·  15 个技能包       │                        │
│  │                                 │                        │
│  │  [预览工作流图]  [一键部署团队]  │                        │
│  └─────────────────────────────────┘                        │
│                                                             │
│  ┌─────────────────────────────────┐                        │
│  │ 🚀 产品交付战队                 │                        │
│  │ 适合专注于产品交付的精简团队     │                        │
│  │  L1 ●●  L2 ●●  L3 ●●●          │                        │
│  │  [预览工作流图]  [一键部署团队]  │                        │
│  └─────────────────────────────────┘                        │
│                                                             │
│  ┌─────────────────────────────────┐                        │
│  │ ⚖️ 治理审查单元                 │                        │
│  │ 专注合规、安全、质量门控         │                        │
│  │  L0 ●●●                         │                        │
│  │  [预览工作流图]  [一键部署团队]  │                        │
│  └─────────────────────────────────┘                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**"预览工作流图"**：打开一个精简的 ReactFlow 弹窗，只展示该模板的 `workflow[]` 步骤图（无需实际数据），用于说明价值。

**"一键部署团队"**：调用 `deployTeam(templateId, progressCallback)`，展示多角色部署进度：

```
┌─────────────────────────────────────────────────────────────┐
│  🚀 正在部署企业级超级编排中心...                           │
│                                                             │
│  ✓ 质量总监                                                 │
│  ✓ 安全官                                                   │
│  ⟳ 合规官 — 写入 SOUL.md... (3/7)                         │
│  ○ 总调度官                                                 │
│  ○ 策略顾问... (共 15 个角色)                              │
│                                                             │
│  [████████░░░░░░░░░░░░] 3 / 15 角色                         │
└─────────────────────────────────────────────────────────────┘
```

实现：外层进度条用 `deployTeam` 的角色序号计算，内层步骤文字用 `DeployProgress.label`。

---

## 9. 多智能体编排的数据呈现方式

### 核心数据概念映射

| 业务概念 | 数据来源 | UI 呈现 |
|----------|----------|---------|
| 智能体层级 | `workflow.json → tier` | LayerBadge (L0-L3 + 颜色) |
| 工作流阶段 | `workflow.json → ownedStages[]` | 节点内 tag 列表 |
| 工作流传递 | `workflow.json → handoffTo[]` | 实线靛蓝有向边 |
| 升级上报 | `authority.json → escalateTo[]` | 虚线琥珀有向边 |
| 协作许可 | `authority.json → allowAgents[]` | 节点 tooltip + 详情面板 |
| 模型能力 | `capabilities.json → modelTier` | ⚡/💪/🧠 图标徽章 |
| 成本档位 | `capabilities.json → costTier` | 💚/💛/💔 图标徽章 |
| 技能清单 | `capabilities.json → requiredSkills[]` | 详情面板技能 chip |
| 实时活跃度 | `sessions.list → agentId 过滤` | 节点 "● N 活跃" 计数 |
| 渠道连接 | `channels.status` | 通道拓扑视图（现有）|

### "OPC 超级助理"概念的 UI 表达

OPC（OpenClaw Platform Command）超级助理 = 完整四层编排团队部署后的整体能力。

在 UI 中通过以下方式表达：

1. **团队覆盖率指示器**（OrchestratorHealthStrip）
   - 四层全绿 = OPC 超级助理完整体验
   - 有缺失层 = 降级模式，提示补全

2. **会话智能路由可视化**（Sessions 页增强）
   - 每条会话显示"由哪个层级的智能体响应"标注
   - L3 执行层直接响应 = 普通模式
   - L1 决策层协调多个 L3 = OPC 编排模式

3. **编排图谱中的"路径高亮"**（Orchestration Graph）
   - 选中会话后，高亮该会话经历的智能体路径
   - 动画：从渠道节点出发，沿边流向参与的智能体节点

### 混合编排状态的视觉编码

| 状态 | 节点视觉 | 边视觉 |
|------|----------|--------|
| 正常/待机 | 标准样式，无特殊效果 | 静态边 |
| 活跃中 | 节点边框 `animate-pulse`，蓝色光晕 | 边 `animated: true` |
| 阻塞/等待审批 | 节点背景转为 `pastel-yellow/20`，加⚠️ | 边变琥珀色 |
| 错误/失败 | 节点边框 `border-accent-red`，加❌ | 边变红色 |
| 离线 | 节点整体 `opacity-40`，加⊘ | 边变 `surface-border` 灰 |

---

## 10. 新增组件规范

### AgentLayerBadge.tsx

```tsx
// 用法: <AgentLayerBadge layer="L0" />
// Props: layer: PresetLayer | undefined; size?: 'sm' | 'md'

const LAYER_BADGE_STYLES: Record<PresetLayer, string> = {
  L0: 'bg-red-500/10 text-red-500 border border-red-500/20',
  L1: 'bg-amber-500/10 text-amber-500 border border-amber-500/20',
  L2: 'bg-blue-500/10 text-blue-500 border border-blue-500/20',
  L3: 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20',
}

// 渲染: <span className={`text-[10px] px-1.5 py-0.5 rounded ${style}`}>{layer}</span>
```

### OrchestrationGraph.tsx（核心画布组件）

**Props Interface**:
```tsx
interface OrchestrationGraphProps {
  agents: AgentSummary[]                      // 基础智能体列表
  agentFiles: Map<string, AgentFileCache>     // 预加载的文件数据缓存
  teamWorkflow?: PresetTeamWorkflowStep[]     // 可选：团队模板工作流边数据
  activeSessions?: GatewaySessionRow[]        // 可选：活跃会话（用于节点活跃度）
  onAgentClick: (agentId: string) => void    // 节点点击回调
  onImportRequest: () => void                // 空状态导入请求
}

interface AgentFileCache {
  workflow?: PresetRoleWorkflow
  authority?: PresetRoleAuthority
  capabilities?: PresetRoleCapabilities
  loading: boolean
  error?: string
}
```

**节点类型注册**:
```tsx
const nodeTypes = {
  channelNode: ChannelNode,          // 复用现有
  agentNode: AgentNode,              // 复用现有（通道拓扑用）
  orchestrationAgentNode: OrchestrationAgentNode,  // 新增（编排图谱用）
  swimlaneLabel: SwimlaneLabelNode,  // 新增（泳道标签）
}
```

**布局策略**:
- 泳道布局不使用 dagre，而是**手动分层 Y 坐标**：
  - L0: y = 0
  - L1: y = 180
  - L2: y = 360
  - L3: y = 540
  - 同层节点按 X 均匀分布
- 层间边的起止点从下层节点上边缘/上层节点下边缘连接

### OrchestratorHealthStrip.tsx

**Props**:
```tsx
interface OrchestratorHealthStripProps {
  agents: AgentSummary[]
  agentLayers: Map<string, PresetLayer>  // agentId → layer
  loading: boolean
  onNavigateToOrchestration: () => void
  onNavigateToPresets: (filterLayer?: PresetLayer) => void
}
```

**层级计数逻辑**:
```tsx
const layerCounts = useMemo(() => {
  const counts: Record<PresetLayer, number> = { L0: 0, L1: 0, L2: 0, L3: 0 }
  for (const [, layer] of agentLayers) {
    if (layer in counts) counts[layer]++
  }
  return counts
}, [agentLayers])
```

---

## 11. 设计令牌扩展

在 `tailwind.config.js` 中补充以下令牌（不破坏现有）：

```js
// tailwind.config.js → theme.extend 内追加
colors: {
  // 层级色（与 LAYER_STYLES 对齐）
  layer: {
    'l0-bg':     'rgba(239, 68, 68, 0.05)',    // L0 治理层背景
    'l0-border': 'rgba(239, 68, 68, 0.2)',
    'l0-text':   '#ef4444',
    'l1-bg':     'rgba(245, 158, 11, 0.05)',   // L1 决策层背景
    'l1-border': 'rgba(245, 158, 11, 0.2)',
    'l1-text':   '#f59e0b',
    'l2-bg':     'rgba(59, 130, 246, 0.05)',   // L2 协调层背景
    'l2-border': 'rgba(59, 130, 246, 0.2)',
    'l2-text':   '#3b82f6',
    'l3-bg':     'rgba(16, 185, 129, 0.05)',   // L3 执行层背景
    'l3-border': 'rgba(16, 185, 129, 0.2)',
    'l3-text':   '#10b981',
  }
},
// 新增动画（编排节点活跃状态用）
animation: {
  'glow-pulse': 'glowPulse 2s ease-in-out infinite',
},
keyframes: {
  glowPulse: {
    '0%, 100%': { boxShadow: '0 0 0 0 rgba(99, 102, 241, 0)' },
    '50%': { boxShadow: '0 0 0 6px rgba(99, 102, 241, 0.2)' },
  },
},
```

在 `src/index.css` 中追加编排画布专用样式：

```css
/* 泳道标签 */
.orchestration-swimlane-label {
  @apply absolute left-3 text-xs font-medium opacity-30 pointer-events-none select-none;
}

/* 编排节点激活态 */
.react-flow__node.orchestration-active > div {
  @apply animate-[glowPulse_2s_ease-in-out_infinite];
}

/* 团队进度条 */
.team-deploy-progress {
  @apply w-full h-1.5 bg-surface-border rounded-full overflow-hidden;
}
.team-deploy-progress-bar {
  @apply h-full bg-gradient-blue rounded-full transition-all duration-300;
}
```

---

## 12. 实现路线图

### Phase 1 — 骨架与入口（约 3-4 天）

| 序号 | 任务 | 文件 | 工作量 |
|------|------|------|--------|
| 1.1 | 创建 `AgentLayerBadge.tsx` | 新文件 | 0.5h |
| 1.2 | Layout 导航项：拓扑→编排，`/topology` redirect | Layout.tsx + App.tsx | 0.5h |
| 1.3 | Dashboard 加 `QuickStartBanner`（仅 CTA，无部署逻辑） | Dashboard.tsx | 2h |
| 1.4 | Dashboard 加 `OrchestratorHealthStrip`（静态版，固定 mock 数据） | 新文件 + Dashboard.tsx | 3h |
| 1.5 | Agents 页加"团队"标签，创建 `TeamPresetsPanel`（仅列表，无部署） | Agents.tsx + 新文件 | 3h |
| 1.6 | Agents 页 Header 分裂按钮（下拉菜单） | Agents.tsx | 1h |

### Phase 2 — 编排画布（约 5-7 天）

| 序号 | 任务 | 文件 | 工作量 |
|------|------|------|--------|
| 2.1 | 创建 `Orchestration.tsx` 页面骨架 + 视图切换标签 | 新文件 | 2h |
| 2.2 | 视图一：迁移现有 Topology 内容到 Orchestration | 迁移 | 1h |
| 2.3 | 创建 `OrchestrationGraph.tsx`：节点类型 + 泳道布局 | 新文件 | 8h |
| 2.4 | 从 `agentFilesGet` 批量加载 workflow/authority 数据 + 缓存 | OrchestrationGraph | 3h |
| 2.5 | 边类型（handoff/escalate）+ 团队模板工作流边覆盖 | OrchestrationGraph | 4h |
| 2.6 | 视图三：Org Chart 树状图（基于 ReactFlow tree layout） | Orchestration.tsx | 4h |
| 2.7 | 右侧详情 Panel 标签页 + SOUL.md 预览 | Orchestration.tsx | 4h |
| 2.8 | 空画布状态 CTA | OrchestrationGraph.tsx | 1h |

### Phase 3 — 部署流程完善（约 2-3 天）

| 序号 | 任务 | 文件 | 工作量 |
|------|------|------|--------|
| 3.1 | `TeamPresetsPanel` 接入 `deployTeam()` + 多角色进度 UI | TeamPresetsPanel.tsx | 4h |
| 3.2 | `QuickStartBanner` 接入 `deployTeam()` | QuickStartBanner.tsx | 2h |
| 3.3 | `OrchestratorHealthStrip` 接入真实 agentFiles 数据 | OrchestratorHealthStrip.tsx | 3h |
| 3.4 | AgentCard 接入 workflow/capabilities 数据 | Agents.tsx | 3h |
| 3.5 | Setup 向导 `presets` 步骤插入 | Setup.tsx | 2h |

### Phase 4 — 增强与打磨（按需）

| 序号 | 任务 |
|------|------|
| 4.1 | Sessions 页：每行加 AgentLayerBadge + 编排路径 tooltip |
| 4.2 | OrchestrationGraph：选中会话后高亮参与的智能体路径（动画） |
| 4.3 | 节点实时活跃度：接入 sessions.list agentId 过滤 + 30s 刷新 |
| 4.4 | 节点状态（阻塞/错误）：接入 logs.tail 解析 + 事件驱动更新 |
| 4.5 | 工作流图谱导出为 PNG（ReactFlow toObject + html2canvas） |

---

## 附录 A：Mock 数据补充建议

为支持 demo/standalone 模式下的编排画布预览，在 `src/data/mock.ts` 补充：

```ts
// 模拟智能体文件缓存（用于 demo 模式下的编排图谱）
export const MOCK_AGENT_FILES: Record<string, {
  layer: PresetLayer,
  ownedStages: string[],
  handoffTo: string[],
  escalateTo: string[],
  allowAgents: string[],
  modelTier: ModelTier,
  costTier: 'low' | 'medium' | 'high',
}> = {
  'quality-director': {
    layer: 'L0', ownedStages: ['review', 'audit'],
    handoffTo: [], escalateTo: [],
    allowAgents: ['dispatch-director', 'solution-architect'],
    modelTier: 'reasoning', costTier: 'high',
  },
  // ... 其余 14 个角色
}

// 模拟团队工作流边（用于 OrchestrationGraph）
export const MOCK_TEAM_WORKFLOW: PresetTeamWorkflowStep[] = [
  { from: 'dispatch-director', to: 'strategy-advisor', condition: '复杂或跨团队任务', mandatory: true },
  // ... 从 full-enterprise-command-center.json 直接引用
]
```

---

## 附录 B：无障碍性要求

| 元素 | 要求 |
|------|------|
| LayerBadge 颜色编码 | 必须同时用文字（L0/L1/L2/L3）表达，不能仅靠颜色区分层级 |
| ReactFlow 画布 | 所有节点添加 `aria-label`，包含名称 + 层级 + 活跃状态 |
| 部署进度 | 使用 `aria-live="polite"` 区域播报进度变化 |
| 空状态 CTA | 按钮焦点顺序：预览架构 → 一键部署 → 暂时忽略 |
| 图表颜色 | 所有 pastel 色系颜色对比度需满足 WCAG AA（已有设计令牌保证） |

---

## 附录 C：与现有代码的关键衔接点

| 现有代码 | 如何复用 |
|----------|----------|
| `LAYER_STYLES` in PresetBrowser.tsx | 提取到 `src/lib/layerStyles.ts`，共享给 AgentLayerBadge、OrchestrationGraph、OrchestratorHealthStrip |
| `deployRole()` / `deployTeam()` in presets.ts | TeamPresetsPanel、QuickStartBanner 直接调用，无需修改 |
| `DeployProgress` type in presets.ts | 直接用于多角色进度条展示 |
| `PresetRoleWorkflow.handoffTo/acceptsFrom` | 作为 OrchestrationGraph 边的数据源 |
| `PresetRoleAuthority.escalateTo` | 作为升级边数据源 |
| `ReactFlow + dagre` 已安装 | OrchestrationGraph 直接使用，泳道布局用手动坐标替代 dagre |
| `cardHover` CSS 类 | TeamPresetsPanel 团队卡片直接使用 |
| `btn-primary` / `btn-secondary` | 所有新 CTA 按钮复用 |
| `Skeleton` 组件 (Dashboard.tsx 内) | 提取为 `src/components/Skeleton.tsx`，供新页面复用 |
