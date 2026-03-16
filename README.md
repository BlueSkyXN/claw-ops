# 🐾 claw-ops

**OpenClaw Operations Dashboard — OpenClaw 网关运维看板**

OpenClaw Gateway 的配套运维可视化前端（纯前端 SPA）。通过 WebSocket JSON-RPC (OpenClaw 协议) 连接 OpenClaw 网关，提供智能体管理、会话监控、渠道状态、定时任务、用量分析、拓扑可视化、日志查看等 9 大看板，覆盖 OpenClaw 多智能体系统全生命周期运维。

> 🎨 马卡龙清新配色 · 🔌 WebSocket JSON-RPC · 🤖 智能体管理 · 💬 会话监控 · 📡 渠道状态 · ⏰ 定时任务 · 📈 用量分析 · 🔗 拓扑视图 · 📜 实时日志

## ✨ 核心功能

| 页面 | 功能说明 |
|------|----------|
| 📊 **总览** (Dashboard) | KPI 指标卡（智能体/活跃会话/渠道/费用）、14 天用量趋势、模型分布、最近会话、智能体状态 |
| 🤖 **智能体** (Agents) | 智能体卡片网格（模型/供应商/工作区）、创建智能体、删除智能体 |
| 💬 **会话** (Sessions) | 会话列表表格（渠道/类型/Token 用量）、筛选搜索、会话详情、重置/删除操作 |
| 📡 **渠道** (Channels) | 渠道连接状态、账户列表、4 态状态灯（configured/linked/running/connected）、出入站活动时间 |
| ⏰ **定时任务** (CronJobs) | Cron 任务 CRUD、调度类型（at/every/cron）、运行日志、手动触发 |
| 📈 **用量分析** (Usage) | Token 消耗/费用趋势图、按模型/供应商/智能体/渠道/日期聚合、Top 20 会话 |
| 🔗 **拓扑** (Topology) | 渠道↔智能体 DAG 拓扑图（@xyflow/react + dagre 自动布局）、缩放拖拽 |
| 📜 **日志** (Logs) | 实时日志流、级别/来源筛选、自动滚动、CSV 导出 |
| ⚙️ **配置** (Setup) | 4 步配置向导：模式选择 → 网关地址与认证 → 连接测试 → 完成 |

## 🔌 三模式运行

### 独立开发模式 (standalone)（默认）

纯前端看板，无需 OpenClaw 实例，使用内置 Mock 数据即刻体验全部页面功能。

### Demo 演示模式 (demo)

同样使用 Mock 数据，适合演示和评估。

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

### 连接真实 OpenClaw Gateway

1. 启动 OpenClaw Gateway（默认监听 `ws://127.0.0.1:18789`）
2. 运行 `npm run dev`，打开浏览器访问 `http://localhost:39527/setup`
3. 选择「实时模式」→ 输入网关地址 → 配置认证 Token → 测试连接 → 进入看板

## 🏗️ 架构概览

```
┌─ 页面组件 ──────────────────────────────────────────┐
│  Dashboard / Agents / Sessions / Channels / ...     │
└──────────────────────┬──────────────────────────────┘
                       │ getAPI()
┌──────────────────────▼──────────────────────────────┐
│                  DataAPI 接口                         │
│  getAgents() / getSessions() / getChannelsStatus()  │
│  getCronJobs() / getSessionsUsage() / getLogs() ... │
├─────────────────┬───────────────────────────────────┤
│  mockAPI        │  GatewayAPI                        │
│  (standalone/   │  (realtime 模式)                    │
│   demo 模式)    │                                    │
│  src/data/mock  │  GatewayClient.request()           │
└─────────────────┴──────────────┬────────────────────┘
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
- **`src/data/mock.ts`** — Mock 数据层

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
│   └── mock.ts              # Mock 数据层（智能体 + 会话 + 渠道 + 用量）
├── lib/
│   ├── api.ts               # 统一 DataAPI 接口（Mock / Gateway 双模式）
│   ├── config.ts            # 运行配置（AppMode / Auth / localStorage）
│   ├── gateway-client.ts    # WebSocket JSON-RPC 客户端（连接/认证/请求/事件/重连）
│   └── export.ts            # CSV 数据导出（支持 BOM 中文编码）
├── components/
│   └── Layout.tsx           # 共享 Shell（侧边栏 8 项 + 顶栏 + 自动刷新 + Outlet）
├── pages/
│   ├── Dashboard.tsx        # 总览（KPI + 趋势 + 模型分布 + 最近会话）
│   ├── Agents.tsx           # 智能体管理（卡片 + 创建/删除）
│   ├── Sessions.tsx         # 会话管理（表格 + 筛选 + 详情 + 重置/删除）
│   ├── Channels.tsx         # 渠道状态（渠道卡片 + 账户详情 + 4 态状态灯）
│   ├── CronJobs.tsx         # 定时任务（CRUD + 运行日志 + 手动触发）
│   ├── Usage.tsx            # 用量分析（日期范围 + 多维聚合 + 图表）
│   ├── Topology.tsx         # 拓扑视图（React Flow + dagre 自动布局）
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
