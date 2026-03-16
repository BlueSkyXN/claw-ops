# claw-ops — 架构文档

## 整体架构

```
┌────────────────────────────────────────────────────────────┐
│                         claw-ops                            │
│                                                            │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                     React Router                       │  │
│  │  /setup  /  /agents  /sessions  /channels  /cron      │  │
│  │  /usage  /topology  /logs                              │  │
│  └──────────────────────┬────────────────────────────────┘  │
│                         │                                   │
│  ┌──────────────────────▼────────────────────────────────┐  │
│  │               Layout (共享 Shell)                       │  │
│  │  ┌────────┐  ┌─────────────────────────────────────┐  │  │
│  │  │ 侧边栏  │  │             内容区域                  │  │  │
│  │  │ NavLink │  │  <Outlet key={refreshKey} />        │  │  │
│  │  │ 8 items │  │                                     │  │  │
│  │  └────────┘  └─────────────────────────────────────┘  │  │
│  │  顶栏: 页面标题 | 连接状态 | 手动刷新                     │  │
│  └───────────────────────────────────────────────────────┘  │
│                         │                                   │
│  ┌──────────────────────▼────────────────────────────────┐  │
│  │                    数据层                                │  │
│  │  ┌──────────┐  ┌───────────┐  ┌──────────────────┐   │  │
│  │  │ mock.ts  │  │ api.ts    │  │ config.ts        │   │  │
│  │  │ (Mock)   │──│ (DataAPI) │──│ (配置/localStorage)│   │  │
│  │  └──────────┘  └─────┬─────┘  └──────────────────┘   │  │
│  │                      │                                 │  │
│  │           ┌──────────▼──────────┐                      │  │
│  │           │  gateway-client.ts  │                      │  │
│  │           │  WebSocket JSON-RPC │                      │  │
│  │           │  OpenClaw 协议        │                      │  │
│  │           └──────────┬──────────┘                      │  │
│  └──────────────────────┼────────────────────────────────┘  │
└─────────────────────────┼───────────────────────────────────┘
                          │ ws://
                ┌─────────▼──────────┐
                │  OpenClaw Gateway  │
                │  :18789            │
                └────────────────────┘
```

## 目录结构

```
claw-ops/
├── docs/                        # 文档目录
│   ├── ARCHITECTURE.md          # 本文件 — 架构说明
│   ├── COLOR-SYSTEM.md          # 色彩系统（五层 Design Token）
│   ├── API-INTEGRATION.md       # API 对接文档
│   ├── PAGES.md                 # 页面功能文档
│   └── cleanroom-spec/          # 历史规格文档
├── src/
│   ├── types/
│   │   └── openclaw.ts          # OpenClaw 协议类型定义 (686 行)
│   ├── data/
│   │   └── mock.ts              # Mock 数据层 (318 行)
│   ├── lib/
│   │   ├── api.ts               # 统一 DataAPI 接口 (280 行)
│   │   ├── config.ts            # 运行配置 (109 行)
│   │   ├── gateway-client.ts    # WebSocket JSON-RPC 客户端 (343 行)
│   │   └── export.ts            # CSV 导出工具
│   ├── components/
│   │   └── Layout.tsx           # 共享布局（侧边栏 + 顶栏 + Outlet）
│   ├── pages/
│   │   ├── Dashboard.tsx        # 总览
│   │   ├── Agents.tsx           # 智能体管理
│   │   ├── Sessions.tsx         # 会话管理
│   │   ├── Channels.tsx         # 渠道状态
│   │   ├── CronJobs.tsx         # 定时任务
│   │   ├── Usage.tsx            # 用量分析
│   │   ├── Topology.tsx         # 拓扑视图
│   │   ├── Logs.tsx             # 日志查看
│   │   └── Setup.tsx            # 配置向导
│   ├── App.tsx                  # 路由配置
│   ├── main.tsx                 # 入口
│   ├── index.css                # Tailwind 组件层
│   └── vite-env.d.ts            # Vite 类型声明
├── tailwind.config.js           # Tailwind 配置
├── vite.config.ts               # Vite 配置（手动分包）
├── index.html                   # HTML 入口
├── package.json                 # 依赖管理
├── LICENSE                      # GPLv3
└── README.md                    # 项目文档
```

## 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 18.3+ | UI 框架 |
| TypeScript | 5.6+ | 类型安全 |
| Vite | 6.0+ | 构建工具 |
| Tailwind CSS | 3.4+ | 样式系统 |
| @xyflow/react | 12+ | 拓扑图可视化 |
| Recharts | 2.15+ | 图表（面积图、柱状图） |
| Zustand | 5+ | 状态管理 |
| dagre | 0.8+ | 图自动布局 |
| React Router | 6+ | SPA 路由 |

## 数据流

### Mock 模式（standalone / demo）

```
Page Component → useEffect → getAPI() → mockAPI → src/data/mock.ts → 返回 Mock 数据
```

`mockAPI` 返回静态 Mock 数据的 Promise，页面组件通过 `useEffect` + `useState` 异步加载，具备 loading 和 error 处理。

### 实时模式（realtime）

```
Page Component → useEffect → getAPI() → GatewayAPI → GatewayClient.request(method, params)
                                                          │
                                                          ▼ WebSocket JSON-RPC
                                                     OpenClaw Gateway
```

`GatewayAPI` 通过 `GatewayClient` 发送 JSON-RPC 请求。客户端在首次 `getAPI()` 调用时单例创建并缓存。

### WebSocket 连接流程

```
1. new WebSocket(url)
2. onopen → 发送 connect 帧（协议版本 + 客户端信息 + 认证凭据 + scopes）
3. Gateway 返回 hello.ok（含 Snapshot: presence/health/uptimeMs）
4. setState('connected')，缓存 Snapshot
5. 之后通过 request() 发送 JSON-RPC 请求，通过 on() 监听事件
6. 断线自动重连（可配置间隔，默认 3 秒）
```

### JSON-RPC 帧格式（OpenClaw 协议）

请求帧（`type: 'req'`）：

```json
{
  "type": "req",
  "id": "req-1",
  "method": "agents.list",
  "params": {}
}
```

响应帧（`type: 'res'`）：

```json
{
  "type": "res",
  "id": "req-1",
  "ok": true,
  "payload": { ... }
}
```

事件帧（`type: 'event'`）：

```json
{
  "type": "event",
  "event": "presence",
  "payload": { ... },
  "seq": 42,
  "stateVersion": { "presence": 5, "health": 3 }
}
```

### 配置持久化

```
config.ts → localStorage['claw-ops-config'] → JSON
```

- `loadConfig()` — 从 localStorage 读取，缺失时返回默认值
- `saveConfig()` — 写入 localStorage
- `clearConfig()` — 清除配置
- `isConfigured()` — 检查 realtime 模式是否已完整配置
- URL 自动迁移：HTTP URL 自动转换为 WS（`http://` → `ws://`，`https://` → `wss://`）

## 配置模型

```typescript
interface OpenClawConfig {
  mode: 'standalone' | 'demo' | 'realtime'
  gatewayUrl: string               // WebSocket 地址，如 ws://127.0.0.1:18789
  authType: 'token' | 'password'
  authToken: string                // Token 认证凭据
  authPassword: string             // Password 认证凭据
  scopes: GatewayScope[]           // 授权范围
  refreshInterval: number          // 自动刷新间隔（秒），Mock 模式用
  useMockData: boolean             // 自动设定：mode !== 'realtime'
  detectedAuthMode?: AuthMode      // 网关报告的认证模式
}

type GatewayScope = 'operator.read' | 'operator.write' | 'operator.admin'
                  | 'operator.approvals' | 'operator.pairing'
```

## 路由表

| 路径 | 组件 | Layout | 说明 |
|------|------|--------|------|
| `/setup` | Setup | ❌ | 独立配置向导（4 步） |
| `/` | Dashboard | ✅ | 总览（KPI + 趋势 + 智能体状态） |
| `/agents` | Agents | ✅ | 智能体管理（创建/删除） |
| `/sessions` | Sessions | ✅ | 会话管理（筛选/详情/重置/删除） |
| `/channels` | Channels | ✅ | 渠道状态（连接/账户） |
| `/cron` | CronJobs | ✅ | 定时任务（CRUD + 运行日志） |
| `/usage` | Usage | ✅ | 用量分析（多维聚合 + 图表） |
| `/topology` | Topology | ✅ | 拓扑视图（渠道↔智能体 DAG） |
| `/logs` | Logs | ✅ | 日志查看（筛选 + 自动滚动） |
| `*` | — | — | 重定向到 `/` |

## 三运行模式

| 模式 | 环境变量 | 数据源 | 用途 |
|------|----------|--------|------|
| `standalone` | `VITE_APP_MODE=standalone` | Mock | 独立开发，无需 OpenClaw |
| `demo` | `VITE_APP_MODE=demo` | Mock | 演示展示 |
| `realtime` | — | WebSocket → OpenClaw Gateway | 生产使用 |

模式选择优先级：
1. 环境变量 `VITE_APP_MODE`
2. localStorage 中已保存的配置
3. 默认值 `standalone`

## 事件订阅模型

连接 OpenClaw Gateway 后，自动订阅以下 17 种事件：

| 事件 | 说明 |
|------|------|
| `connect.challenge` | 连接认证挑战 |
| `agent` | 智能体状态变更 |
| `chat` | 聊天消息 |
| `presence` | 在线状态变更 |
| `tick` | 心跳 tick |
| `health` | 健康状态变更 |
| `heartbeat` | 心跳 |
| `cron` | 定时任务事件 |
| `exec.approval.requested` | 执行审批请求 |
| `exec.approval.resolved` | 执行审批结果 |
| `node.pair.requested` / `resolved` | 节点配对 |
| `device.pair.requested` / `resolved` | 设备配对 |
| `shutdown` | 网关关闭 |
| `talk.mode` | 对话模式变更 |
| `voicewake.changed` | 语音唤醒变更 |
| `update.available` | 更新可用 |

页面组件可通过 `GatewayClient.on(event, handler)` 监听事件实现实时 UI 更新。

## 构建配置

- **Vite 手动分包**：`vendor-react`、`vendor-flow`（xyflow + dagre）、`vendor-charts`（recharts）
- **TypeScript strict 模式**，但 `noUnusedLocals` 和 `noUnusedParameters` 关闭
- **环境变量** `VITE_APP_MODE` 控制默认运行模式
- **构建命令**：`tsc -b && vite build`
