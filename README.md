# 🐾 claw-ops

**OpenClaw Operations Dashboard — OpenClaw 企业级编排控制面**

OpenClaw Gateway 的配套运维可视化前端（纯前端 SPA）。通过 WebSocket JSON-RPC (OpenClaw 协议) 连接 OpenClaw 网关，提供智能体管理、会话监控、渠道状态、定时任务、用量分析、日志查看，以及面向企业组织的编排控制面：任务追踪、路径高亮、审批门禁、干预动作与健康分析。

> 🎨 马卡龙清新配色 · 🔌 WebSocket JSON-RPC · 🤖 智能体管理 · 💬 会话监控 · 📡 渠道状态 · ⏰ 定时任务 · 📈 用量分析 · 🧩 编排工作台 · 📜 实时日志

## ✨ 核心功能

| 页面 | 功能说明 |
|------|----------|
| 📊 **总览** (Dashboard) | KPI 指标卡（活跃任务/待审批/渠道/费用）、编排健康条、任务列表、用量趋势、模型分布、最近会话 |
| 🤖 **智能体** (Agents) | 智能体卡片网格（模型/供应商/工作区）、创建智能体、删除智能体 |
| 💬 **会话** (Sessions) | 会话列表表格（渠道/类型/Token 用量）、筛选搜索、会话详情、重置/删除操作 |
| 📡 **渠道** (Channels) | 渠道连接状态、账户列表、4 态状态灯（configured/linked/running/connected）、出入站活动时间 |
| ⏰ **定时任务** (CronJobs) | Cron 任务 CRUD、调度类型（at/every/cron）、运行日志、手动触发 |
| 📈 **用量分析** (Usage) | Token 消耗/费用趋势图、按模型/供应商/智能体/渠道/日期聚合、Top 20 会话 |
| 🧩 **编排** (Orchestration) | 企业级编排控制面：任务追踪、路径高亮、审批门禁、暂停/催办/重派、通道拓扑、组织架构 |
| 📜 **日志** (Logs) | 实时日志流、级别/来源筛选、自动滚动、CSV 导出 |
| ⚙️ **配置** (Setup) | 4 步配置向导：模式选择 → 网关地址与认证 → 连接测试 → 完成 |

## 🔌 三模式运行

### 独立开发模式 (standalone)（默认）

纯前端看板，无需 OpenClaw 实例，使用内置 Mock 数据即刻体验全部页面功能。现在支持持久化 mock 工作区与一键导入团队模板，刷新后仍可继续体验。

### Demo 演示模式 (demo)

同样使用 Mock 数据，适合演示和评估。推荐直接进入 `🧩 编排` 页面导入 `OPC 超级助理` 或其他团队模板，快速展示多 Agent 混合编排能力。

### 实时模式 (realtime)

通过 WebSocket 连接真实 OpenClaw Gateway：

1. 访问 `/setup` 进入配置向导
2. 选择「实时模式」→ 填写网关 WebSocket 地址（如 `ws://127.0.0.1:18789`）
3. 选择认证方式（Token 或 Password）→ 配置授权范围（scopes）
4. 连接测试通过后自动切换为实时数据源

实时模式下，所有页面通过 `GatewayClient` 发送 JSON-RPC 请求获取数据，并自动订阅 17 种网关事件实现实时更新。

## 🚀 快速开始

```bash
# 安装依赖
npm install

# 开发模式（默认独立开发 Mock 模式）
npm run dev

# 指定模式运行
npm run dev:standalone   # 独立开发（Mock 数据）
npm run dev:demo         # Demo 演示（Mock 数据）

# 构建生产版本
npm run build            # tsc -b && vite build

# 预览生产版本
npm run preview
```

访问 `http://localhost:39527` 即可使用。

### 推荐体验路径

1. 启动 `npm run dev` 或 `npm run dev:demo`
2. 打开首页，直接点击 `🚀 一键导入 OPC 超级助理`
3. 进入 `🧩 编排` 页面，查看任务追踪、执行路径、审批门禁、通道拓扑 / 组织架构三种视图
4. 打开 `🤖 智能体` 页面，可继续使用现有预设角色库按角色补强团队

### 连接真实 OpenClaw Gateway

1. 启动 OpenClaw Gateway（默认监听 `ws://127.0.0.1:18789`）
2. 运行 `npm run dev`，打开浏览器访问 `http://localhost:39527/setup`
3. 选择「实时模式」→ 输入网关地址 → 配置认证 Token → 测试连接 → 进入看板

## 🏗️ 架构概览

```
┌─ 页面组件 ─────────────────────────────────────────────────────┐
│  Dashboard / Agents / Sessions / Channels / Orchestration / ... │
└──────────────────────────┬──────────────────────────────────────┘
                           │ getAPI()
┌──────────────────────────▼──────────────────────────────────────┐
│                        DataAPI 接口                              │
│  getAgents() / getSessions() / getLogs() / getExecApprovals()   │
│  sendChatMessage() / patchSession() / resolveExecApproval() ...  │
├─────────────────┬───────────────────────────────────────────────┤
│  mockAPI        │  GatewayAPI                                    │
│  (standalone/   │  (realtime 模式)                                │
│   demo 模式)    │                                                  │
│  mock-workspace │  GatewayClient.request() + GatewayClient.on()   │
└─────────────────┴──────────────────┬────────────────────────────┘
                                      │ 任务 / 日志 / 审批 / 事件
                    ┌─────────────────▼──────────────────┐
                    │  Orchestration Runtime Layer        │
                    │  task-tracker / flow-tracer /       │
                    │  health-analyzer / runtime loader   │
                    └─────────────────┬──────────────────┘
                                      │ WebSocket JSON-RPC
                            ┌─────────▼─────────┐
                            │  OpenClaw Gateway  │
                            │  OpenClaw 协议       │
                            └───────────────────┘
```

- **`src/lib/config.ts`** — 运行配置（mode / gatewayUrl / authType / scopes），localStorage 持久化
- **`src/lib/api.ts`** — 统一 `DataAPI` 接口，`getAPI()` 根据配置返回 mockAPI 或 GatewayAPI
- **`src/lib/gateway-client.ts`** — WebSocket JSON-RPC 客户端（OpenClaw 协议），支持连接/认证/请求/事件订阅/自动重连
- **`src/types/openclaw.ts`** — 完整 OpenClaw 协议类型定义（686 行，40+ 类型）
- **`src/data/mock.ts`** — Mock 基础数据
- **`src/data/mock-workspace.ts`** — 持久化 mock 工作区（角色/文件/会话/技能/编排体验）
- **`src/lib/orchestration.ts`** — 团队模板摘要、OPC 体验种子、一键导入编排服务
- **`src/lib/task-tracker.ts`** — 前端任务推断引擎（由 sessions/logs/approvals 推导任务）
- **`src/lib/flow-tracer.ts`** — 执行路径高亮与节点/边状态映射
- **`src/lib/health-analyzer.ts`** — 编排健康分析（覆盖度、吞吐、延迟、瓶颈、成本）
- **`src/lib/orchestration-runtime.ts`** — 编排控制面运行时装配、事件订阅与干预动作封装

## 🛠️ 技术栈

| 技术 | 用途 |
|------|------|
| **React 18** + **TypeScript 5.6** | UI 框架 + 类型安全 |
| **Vite 6** | 极速开发与构建 |
| **Tailwind CSS 3.4** | 马卡龙清新主题（五层 Design Token） |
| **@xyflow/react 12** | 拓扑图可视化 |
| **Recharts 2.15** | 数据图表（面积图、柱状图） |
| **Zustand 5** | 状态管理 |
| **dagre** | 图自动布局算法 |
| **React Router 6** | SPA 路由 |

## 🎨 设计风格

马卡龙/糖果色清新 Light Theme 设计：

- **白底 + 圆角卡片 + 淡投影** — 清爽简洁
- **五层 Design Token** — surface / text / pastel / accent / brand 色彩系统
- **CSS 组件类** — `.card` `.badge-*` `.btn-primary` `.btn-secondary` `.btn-ghost` `.stat-card`
- 详见 [docs/COLOR-SYSTEM.md](docs/COLOR-SYSTEM.md)

## 📁 项目结构

```
src/
├── types/
│   └── openclaw.ts          # OpenClaw 协议类型定义（686 行）
├── data/
│   ├── mock.ts              # Mock 基础数据
│   └── mock-workspace.ts    # 持久化 mock 工作区（可写 demo / 预设导入）
├── lib/
│   ├── api.ts               # 统一 DataAPI 接口（Mock / Gateway 双模式）
│   ├── config.ts            # 运行配置（AppMode / Auth / localStorage）
│   ├── gateway-client.ts    # WebSocket JSON-RPC 客户端（连接/认证/请求/事件/重连）
│   ├── orchestration.ts     # OPC / 团队模板与 mock 运行态种子
│   ├── orchestration-runtime.ts # 编排控制面运行时装配与干预动作
│   ├── task-tracker.ts      # 任务推断引擎
│   ├── flow-tracer.ts       # 路径高亮引擎
│   ├── health-analyzer.ts   # 编排健康分析
│   └── export.ts            # CSV 数据导出（支持 BOM 中文编码）
├── components/
│   ├── Layout.tsx           # 共享 Shell（侧边栏 8 项 + 顶栏 + 自动刷新 + Outlet）
│   ├── ActiveTasksPanel.tsx # 任务卡片与内联控制
│   ├── QuickStartBanner.tsx # 首页 OPC 一键体验 Banner
│   ├── OrchestratorHealthStrip.tsx # 编排健康条
│   ├── TaskStepTimeline.tsx # 任务步骤时间线
│   └── TeamPresetsPanel.tsx # 团队模板浏览器
├── pages/
│   ├── Dashboard.tsx        # 总览（KPI + 趋势 + 模型分布 + 最近会话）
│   ├── Agents.tsx           # 智能体管理（卡片 + 创建/删除）
│   ├── Sessions.tsx         # 会话管理（表格 + 筛选 + 详情 + 重置/删除）
│   ├── Channels.tsx         # 渠道状态（渠道卡片 + 账户详情 + 4 态状态灯）
│   ├── CronJobs.tsx         # 定时任务（CRUD + 运行日志 + 手动触发）
│   ├── Usage.tsx            # 用量分析（日期范围 + 多维聚合 + 图表）
│   ├── Orchestration.tsx    # 编排工作台（工作流图谱 / 通道拓扑 / 组织架构）
│   ├── Topology.tsx         # 兼容旧拓扑页（已重定向到编排页）
│   ├── Logs.tsx             # 日志查看（筛选 + 自动滚动 + CSV 导出）
│   └── Setup.tsx            # 配置向导（4 步：模式→网关→测试→完成）
├── App.tsx                  # 路由配置
├── main.tsx                 # 入口
└── index.css                # Tailwind 组件层
```

## 📖 OpenClaw 协议参考

claw-ops 使用的 OpenClaw JSON-RPC 方法（通过 WebSocket 调用）：

| 分类 | 方法 | 说明 |
|------|------|------|
| 状态 | `health` `status` `system-presence` | 健康检查、系统快照、在线状态 |
| 智能体 | `agents.list` `agents.create` `agents.update` `agents.delete` | 智能体 CRUD |
| 会话 | `sessions.list` `sessions.patch` `sessions.reset` `sessions.delete` `sessions.usage` | 会话管理与用量 |
| Chat | `chat.send` | 控制面催办 / 重派 / 主动干预 |
| 渠道 | `channels.status` | 渠道连接状态 |
| 定时 | `cron.list` `cron.add` `cron.update` `cron.remove` `cron.run` `cron.runs` | 定时任务管理 |
| 日志 | `logs.tail` | 日志流 |
| 模型 | `models.list` | 可用模型 |
| 审批 | `exec.approvals.get` `exec.approval.resolve` | 执行审批 |

网关自动订阅 17 种事件（`agent` / `chat` / `presence` / `health` / `cron` / `exec.approval.requested` 等），详见 [OPENCLAW_API_REFERENCE.md](./OPENCLAW_API_REFERENCE.md)。

## 📚 更多文档

| 文档 | 说明 |
|------|------|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | 架构详解（数据流、路由、配置模型） |
| [docs/API-INTEGRATION.md](docs/API-INTEGRATION.md) | API 对接（JSON-RPC 方法、类型、认证） |
| [docs/PAGES.md](docs/PAGES.md) | 页面功能详解（每页的模块与数据源） |
| [docs/COLOR-SYSTEM.md](docs/COLOR-SYSTEM.md) | 色彩系统（五层 Design Token） |
| [OPENCLAW_API_REFERENCE.md](./OPENCLAW_API_REFERENCE.md) | OpenClaw 完整 API 参考 |
| [API_MAPPING_SUMMARY.md](./API_MAPPING_SUMMARY.md) | API 映射速览 |

## 📝 许可证

本项目采用 [GNU General Public License v3.0](LICENSE) 许可。

---

*claw-ops v0.1.0 — OpenClaw Operations Dashboard*
