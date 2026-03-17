# 🐾 claw-ops

**OpenClaw Operations Dashboard — OpenClaw 企业级编排控制面**

OpenClaw Gateway 的配套运维可视化前端（纯前端 SPA）。通过 WebSocket JSON-RPC (OpenClaw 协议) 连接 OpenClaw 网关，提供智能体管理、会话监控、渠道状态、定时任务、用量分析、日志查看，以及面向企业组织的编排控制面：Mission 发令、任务追踪、路径高亮、审批门禁、活策略面板、干预动作与健康分析。

> 🎨 马卡龙清新配色 · 🔌 WebSocket JSON-RPC · 🤖 智能体管理 · 💬 会话监控 · 📡 渠道状态 · ⏰ 定时任务 · 📈 用量分析 · 🧩 编排工作台 · 📜 实时日志

## ✨ 核心功能

| 页面 | 功能说明 |
|------|----------|
| 📊 **总览** (Dashboard) | CEO 发令台、KPI 指标卡、编排健康条、经营绩效板、任务列表、用量趋势、模型分布、最近会话 |
| 🤖 **智能体** (Agents) | 智能体卡片网格（模型/供应商/工作区）、创建智能体、删除智能体 |
| 💬 **会话** (Sessions) | 会话列表表格（渠道/类型/Token 用量）、筛选搜索、会话详情、重置/删除操作 |
| 📡 **渠道** (Channels) | 渠道连接状态、账户列表、4 态状态灯（configured/linked/running/connected）、出入站活动时间 |
| ⏰ **定时任务** (CronJobs) | Cron 任务 CRUD、调度类型（at/every/cron）、运行日志、手动触发 |
| 📈 **用量分析** (Usage) | 对齐 OpenClaw `sessions.usage` + `usage.cost` 双接口、Token/费用趋势图、按模型/供应商/智能体/渠道聚合、Top 20 会话、真实数据渲染上限保护 |
| 🧩 **编排** (Orchestration) | 企业级编排控制面：Mission 发令、任务追踪、路径高亮、活策略面板、审批门禁、暂停/催办/重派、通道拓扑、组织架构；控制面负责入口投递，后续优先由角色原生自编排推进 |
| 📜 **日志** (Logs) | 实时日志流、级别/来源筛选、自动滚动、CSV 导出 |
| ⚙️ **配置** (Setup) | 当前为 4 步配置向导：模式选择 → 连接配置 → 连接测试 → 完成；已支持 `demo` / `realtime` / `cli` / `hybrid` 四种模式 |

## 🔌 当前支持的运行模式

### Demo 模式 (demo，默认 Mock 模式)

纯前端看板，无需 OpenClaw 实例，使用内置 Mock 数据即刻体验全部页面功能。现在支持持久化 mock 工作区与一键导入团队模板，刷新后仍可继续体验。

历史上的 `standalone` 环境变量与 `npm run dev:standalone` 仍然可用，但在当前实现里会被兼容映射到同一个 `demo`/Mock 运行态。

### 实时模式 (realtime)

通过 WebSocket 连接真实 OpenClaw Gateway：

1. 访问 `/setup` 进入配置向导
2. 选择「实时模式」→ 填写网关 WebSocket 地址（如 `ws://127.0.0.1:18789`）
3. 选择认证方式（Token 或 Password）→ 填写认证凭据
4. 连接测试通过后完成配置，并进入实时看板

实时模式下，所有页面通过 `GatewayClient` 发送 JSON-RPC 请求获取数据，并自动订阅 17 种网关事件实现实时更新。`📈 用量分析` 页面会并行读取 `sessions.usage` 与 `usage.cost`，并兼容旧网关对 `mode` / `utcOffset` 参数的拒绝回退；`📡 渠道` 页面按 `channels.status` 的 schema-light 快照渲染，兼容插件扩展字段。

### CLI / Hybrid 对接（Bridge MVP 已落地）

当前版本已经落地第一版 `cli` / `hybrid` 集成：

- 新增本地 bridge 服务：`npm run bridge`
- Setup 已支持 `demo` / `realtime` / `cli` / `hybrid`
- `cli` 模式通过 bridge 读取 agents / sessions / channels / cron / logs / models / skills
- `hybrid` 模式会保留 Gateway 实时能力，并叠加本地 bridge 的 CLI / agent file 能力

当前仍然**显式未支持**的纯 CLI 能力包括：

- `sessions.patch` / `sessions.reset` / `sessions.delete`
- `exec approval resolve`
- 真正的实时事件订阅（纯 CLI 仍采用 polling 降级）

详见 [`docs/CLI-HYBRID-INTEGRATION.md`](docs/CLI-HYBRID-INTEGRATION.md)。

## 🚀 快速开始

```bash
# 安装依赖
npm install

# 开发模式（默认 Demo / Mock 模式）
npm run dev

# 指定模式运行
npm run dev:standalone   # 历史别名，仍映射到当前 Mock 模式
npm run dev:demo         # Demo / Mock 模式
npm run bridge           # 启动本地 CLI bridge（默认 http://127.0.0.1:18796）

# 构建生产版本
npm run build            # tsc -b && vite build

# 预览生产版本
npm run preview
```

访问 `http://localhost:39527` 即可使用。

### 推荐体验路径

1. 启动 `npm run dev` 或 `npm run dev:demo`
2. 打开首页，直接点击 `🚀 一键导入 OPC 超级助理`
3. 通过 `📊 总览` 或 `🧩 编排` 页面上的 Mission 发令台主动下达经营目标
4. 进入 `🧩 编排` 页面，查看任务追踪、执行路径、审批门禁、通道拓扑 / 组织架构三种视图
4. 打开 `🤖 智能体` 页面，可继续使用现有预设角色库按角色补强团队

### 连接真实 OpenClaw Gateway

1. 启动 OpenClaw Gateway（默认监听 `ws://127.0.0.1:18789`）
2. 运行 `npm run dev`，打开浏览器访问 `http://localhost:39527/setup`
3. 选择「实时模式」→ 输入网关地址 → 配置认证 Token/Password → 测试连接 → 完成配置后进入看板

### 使用本地 CLI / Hybrid

1. 确保本机可执行 `openclaw` CLI
2. 运行 `npm run bridge`
3. 再运行 `npm run dev`，打开 `http://localhost:39527/setup`
4. 选择「CLI 模式」或「混合模式」
5. 配置 bridge 地址（默认 `http://127.0.0.1:18796`）；`hybrid` 模式额外填写 Gateway 地址并完成双连接测试

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
- **预设导入约定** — 设计期资产保留 `workflow.json` / `authority.json` / `capabilities.json`，部署期则编译进最终 `SOUL.md`，并额外写入 `claw-ops.rolepack.json` 供控制面追踪
- **`src/lib/task-tracker.ts`** — 前端任务推断引擎（由 sessions/logs/approvals 推导任务）
- **`src/lib/flow-tracer.ts`** — 执行路径高亮与节点/边状态映射
- **`src/lib/health-analyzer.ts`** — 编排健康分析（覆盖度、吞吐、延迟、瓶颈、成本）
- **`src/lib/orchestration-runtime.ts`** — 编排控制面运行时装配、事件订阅与干预动作封装
- **`src/components/MissionDispatchPanel.tsx`** — CEO 发令台：主动下达 Mission / Goal Brief
- **`src/components/ExecutivePerformanceBoard.tsx`** — 经营绩效板：吞吐、治理压力、热点角色、交付风险
- **`src/components/RoleOperatingPolicyPanel.tsx`** — 活策略面板：Authority / Workflow / Capability 的运行态解释

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
│   ├── ExecutivePerformanceBoard.tsx # 经营绩效板
│   ├── QuickStartBanner.tsx # 首页 OPC 一键体验 Banner
│   ├── MissionDispatchPanel.tsx # CEO 发令台
│   ├── OrchestratorHealthStrip.tsx # 编排健康条
│   ├── RoleOperatingPolicyPanel.tsx # 活策略面板
│   ├── TaskStepTimeline.tsx # 任务步骤时间线
│   └── TeamPresetsPanel.tsx # 团队模板浏览器
├── pages/
│   ├── Dashboard.tsx        # 总览（CEO 发令台 + 经营绩效 + 任务控制）
│   ├── Agents.tsx           # 智能体管理（卡片 + 创建/删除）
│   ├── Sessions.tsx         # 会话管理（表格 + 筛选 + 详情 + 重置/删除）
│   ├── Channels.tsx         # 渠道状态（渠道卡片 + 账户详情 + 4 态状态灯）
│   ├── CronJobs.tsx         # 定时任务（CRUD + 运行日志 + 手动触发）
│   ├── Usage.tsx            # 用量分析（日期范围 + 多维聚合 + 图表）
│   ├── Orchestration.tsx    # 编排控制面（Mission 发令 / 图谱 / 活策略 / 拓扑）
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
| 状态 | `health` `system-presence` | 健康检查、在线状态；系统快照来自连接握手的 `hello.ok` payload |
| 智能体 | `agents.list` `agents.create` `agents.update` `agents.delete` | 智能体 CRUD |
| 会话 / 用量 | `sessions.list` `sessions.patch` `sessions.reset` `sessions.delete` `sessions.usage` `usage.cost` | 会话管理与用量分析 |
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
| [docs/CLI-HYBRID-INTEGRATION.md](docs/CLI-HYBRID-INTEGRATION.md) | CLI / Hybrid 对接正式设计规格（规划中能力） |
| [docs/PAGES.md](docs/PAGES.md) | 页面功能详解（每页的模块与数据源） |
| [docs/COLOR-SYSTEM.md](docs/COLOR-SYSTEM.md) | 色彩系统（五层 Design Token） |
| [OPENCLAW_API_REFERENCE.md](./OPENCLAW_API_REFERENCE.md) | OpenClaw 完整 API 参考 |
| [API_MAPPING_SUMMARY.md](./API_MAPPING_SUMMARY.md) | API 映射速览 |

## 📝 许可证

本项目采用 [GNU General Public License v3.0](LICENSE) 许可。

---

*claw-ops v0.1.0 — OpenClaw Operations Dashboard*
