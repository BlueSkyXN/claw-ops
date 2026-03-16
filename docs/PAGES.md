# claw-ops — 页面功能文档

## 页面一览

| 序号 | 页面 | 路径 | 核心功能 | 数据来源 (JSON-RPC) |
|------|------|------|----------|---------------------|
| 1 | 总览 | `/` | KPI + 趋势图 + 最近会话 + 智能体状态 | `agents.list` `sessions.list` `sessions.usage` `channels.status` |
| 2 | 智能体 | `/agents` | 智能体卡片 + 创建/删除 | `agents.list` `agents.create` `agents.delete` |
| 3 | 会话 | `/sessions` | 会话表格 + 筛选 + 详情 + 操作 | `sessions.list` `sessions.reset` `sessions.delete` |
| 4 | 渠道 | `/channels` | 渠道连接状态 + 账户详情 | `channels.status` |
| 5 | 定时任务 | `/cron` | Cron CRUD + 运行日志 + 手动触发 | `cron.list` `cron.add` `cron.update` `cron.remove` `cron.run` `cron.runs` |
| 6 | 用量分析 | `/usage` | Token/费用趋势 + 多维聚合 | `sessions.usage` |
| 7 | 拓扑 | `/topology` | 渠道↔智能体 DAG 图 | `agents.list` `channels.status` |
| 8 | 日志 | `/logs` | 实时日志 + 筛选 + 导出 | `logs.tail` |
| 9 | 配置 | `/setup` | 4 步配置向导 | `health`（连接测试） |

---

## 1. 总览 (Dashboard)

**路径**：`/`  |  **文件**：`src/pages/Dashboard.tsx`  |  **数据**：`getAgents()` `getSessions()` `getSessionsUsage()` `getChannelsStatus()`

### 功能模块

#### KPI 指标卡（4 项）
- 智能体总数
- 活跃会话数
- 已连接渠道数
- 总费用（$）

#### 14 天用量趋势图
- 面积图：Token 消耗 + 费用趋势
- X 轴日期，双 Y 轴
- 使用 Recharts `AreaChart` 渲染

#### 模型使用分布
- 柱状图：按模型展示 Token 消耗分布
- 使用 Recharts `BarChart` 渲染

#### 最近会话列表
- 按更新时间排序，显示最近 8 条
- 显示：会话标签 + 渠道 + 智能体 + Token 用量 + 相对时间

#### 智能体状态网格
- 2 列网格布局
- 每卡片显示：Emoji + 名称 + agentId + 模型 + 供应商

#### 错误与加载处理
- Loading 骨架屏动画
- Error 状态提示

---

## 2. 智能体管理 (Agents)

**路径**：`/agents`  |  **文件**：`src/pages/Agents.tsx`  |  **数据**：`getAgents()` `createAgent()` `deleteAgent()`

### 功能模块

#### 智能体卡片网格
- 3 列网格布局
- 每卡片显示：
  - Emoji + 名称 + agentId
  - 模型 + 模型供应商
  - 工作区（workspace）
  - 描述文字
  - 删除按钮

#### 创建智能体对话框
- 输入字段：名称、工作区
- 创建成功后自动刷新列表

#### 删除智能体确认
- 确认对话框显示智能体名称
- 删除后自动刷新列表

---

## 3. 会话管理 (Sessions)

**路径**：`/sessions`  |  **文件**：`src/pages/Sessions.tsx`  |  **数据**：`getSessions()` `resetSession()` `deleteSession()`

### 功能模块

#### KPI 指标卡（4 项）
- 总会话数
- 私聊会话数 (direct)
- 群聊会话数 (group)
- 总 Token 用量

#### 筛选栏
- 渠道筛选：下拉菜单（telegram / discord / slack / feishu 等）
- 类型筛选：direct / group / global
- 文本搜索：匹配会话标签

#### 会话表格
- 列：标签 | 渠道 | 类型 | 智能体 | 模型 | Token 数 | 更新时间 | 最后消息
- 点击行打开详情面板
- 渠道 Emoji 图标

#### 会话详情面板
- 类型（kind）
- 渠道 + 模型 + 供应商
- 发送策略（sendPolicy）
- 绑定智能体
- Token 用量
- Thinking / Reasoning 级别
- 上下文窗口大小
- 元数据（metadata）

#### 会话操作
- 重置会话（resetSession）
- 删除会话（deleteSession）+ 确认对话框

---

## 4. 渠道状态 (Channels)

**路径**：`/channels`  |  **文件**：`src/pages/Channels.tsx`  |  **数据**：`getChannelsStatus()`

### 功能模块

#### KPI 指标卡（4 项）
- 总渠道数
- 总账户数
- 已连接账户数
- 错误数

#### 渠道卡片（2 列网格）
- 每渠道一张可展开卡片
- 卡片头部：渠道 Emoji + 标签 + 账户数
- 整体连接状态指示器（绿=全连/黄=部分/红=断开）

#### 账户详情（展开后）
- 每账户行显示：
  - 名称 + accountId
  - 状态徽章（connected / running / offline / error）
  - **4 态状态灯**：configured / linked / running / connected
  - 最近活动时间：lastConnectedAt / lastInboundAt / lastOutboundAt
  - 重连次数（reconnectAttempts）
  - 错误信息
  - 模式（mode）、DM 策略（dmPolicy）、允许来源（allowFrom）

#### 交互
- 点击渠道卡片展开/折叠账户详情

---

## 5. 定时任务 (CronJobs)

**路径**：`/cron`  |  **文件**：`src/pages/CronJobs.tsx`  |  **数据**：`getCronJobs()` `addCronJob()` `updateCronJob()` `removeCronJob()` `runCronJob()` `getCronRuns()`

### 功能模块

#### 任务列表
- 每条显示：名称 + 描述 + 调度类型 + 启用状态 + 下次运行 + 上次运行
- 调度类型展示：
  - `at`：每日定时（如 09:00）
  - `every`：间隔执行（如 30m）
  - `cron`：Cron 表达式
- 负载类型：
  - `agentTurn`：发送消息给智能体
  - `systemEvent`：触发系统事件

#### 新增任务对话框
- 字段：名称、描述、调度类型、调度详情、负载类型、消息内容、智能体选择

#### 任务操作
- 编辑（updateCronJob）
- 删除（removeCronJob）
- 手动运行（runCronJob）

#### 运行日志
- 显示最近运行记录
- 状态徽章：success（绿）/ error（红）/ skipped（黄）
- 运行时长格式化
- 投递状态（delivered / not-delivered / unknown）

---

## 6. 用量分析 (Usage)

**路径**：`/usage`  |  **文件**：`src/pages/Usage.tsx`  |  **数据**：`getSessionsUsage()`

### 功能模块

#### 日期范围选择器
- 开始日期 + 结束日期（YYYY-MM-DD 格式）
- 筛选指定时间范围的用量数据

#### 多维聚合分析
- **按模型聚合**：各模型的 Token 用量和费用
- **按供应商聚合**：各供应商的 Token 用量和费用
- **按智能体聚合**：各智能体的 Token 用量和费用
- **按渠道聚合**：各渠道的 Token 用量和费用
- **按日期聚合**：每日 Token 用量趋势

#### 图表
- 使用 Recharts 渲染趋势图和分布图
- Token 格式化：M（百万）/ K（千）
- 费用格式化：$

#### Top 20 会话
- 按费用降序排列的前 20 个会话
- 显示：会话标签 + 模型 + Token 数 + 费用

#### 错误率
- 计算并显示错误率统计

---

## 7. 拓扑视图 (Topology)

**路径**：`/topology`  |  **文件**：`src/pages/Topology.tsx`  |  **数据**：`getAgents()` `getChannelsStatus()`

### 功能模块

#### 交互式 DAG 拓扑图
- **左侧**：渠道节点（来自 `channels.status`）
- **右侧**：智能体节点（来自 `agents.list`）
- **连线**：渠道→智能体的关联关系
- **布局**：dagre 自动布局（LR 从左到右方向）

#### 渠道节点样式
- 连接状态颜色：绿=已连接，红=断开
- 显示：渠道图标 + 名称 + 活跃运行数

#### 智能体节点样式
- 显示：Emoji + 名称 + 模型 + 供应商标签

#### 交互能力
- 缩放 / 平移 / 拖拽节点
- MiniMap 小地图
- Controls 控制栏
- 点击节点查看详情

---

## 8. 日志查看 (Logs)

**路径**：`/logs`  |  **文件**：`src/pages/Logs.tsx`  |  **数据**：`getLogs()`

### 功能模块

#### 筛选栏
- 级别筛选：下拉菜单（info / warn / error / debug）
- 来源筛选：文本输入
- 文本搜索：匹配消息内容或来源

#### 日志列表
- 每条显示：时间戳（HH:MM:SS）+ 级别徽章 + 来源 + 消息
- 级别颜色编码：info=蓝 / warn=黄 / error=红 / debug=灰

#### 自动刷新
- 开关按钮：开启后每 5 秒自动拉取新日志

#### 自动滚动
- 新日志到达时自动滚动到底部

#### CSV 导出
- 导出当前筛选结果为 CSV 文件
- UTF-8 BOM 头，Excel 中文兼容

---

## 9. 配置向导 (Setup)

**路径**：`/setup`  |  **文件**：`src/pages/Setup.tsx`  |  **独立页面**（不使用 Layout）

### 4 步流程

#### Step 1: 运行模式
- 三选一卡片：
  - **独立开发 (standalone)**：纯前端 Mock 数据，无需后端
  - **Demo 演示 (demo)**：Mock 数据展示完整功能
  - **实时对接 (realtime)**：连接 OpenClaw Gateway
- 各模式配有说明文字

#### Step 2: 网关配置（实时模式专属）
- WebSocket 地址输入（默认 `ws://127.0.0.1:18789`）
- 认证方式选择：Token / Password
- 认证凭据输入
- 授权范围（scopes）配置

#### Step 3: 连接测试（实时模式专属）
- WebSocket 握手测试（10 秒超时）
- 尝试获取 Snapshot 验证连接
- 状态显示：测试中 / 成功（显示 uptime）/ 失败（显示错误）
- 可跳过测试

#### Step 4: 完成
- 配置摘要展示
- 保存配置到 localStorage
- 「进入 claw-ops」按钮（导航到 `/`）

---

## 共享功能

### Layout 共享组件

所有主页面（除 Setup）共享以下 Layout 能力：

| 功能 | 位置 | 说明 |
|------|------|------|
| 侧边栏导航 | 左侧 | 8 项菜单 + 品牌标识 + 模式指示 |
| 页面标题 | 顶栏 | 根据路径自动匹配 |
| 连接状态 | 顶栏 | 实时模式显示 WebSocket 连接状态 |
| 手动刷新 | 顶栏 | 触发 `<Outlet key={refreshKey}/>` 重新挂载 |

#### 侧边栏菜单项

| 图标 | 标签 | 路径 |
|------|------|------|
| 📊 | 总览 | `/` |
| 🤖 | 智能体 | `/agents` |
| 💬 | 会话 | `/sessions` |
| 📡 | 渠道 | `/channels` |
| ⏰ | 定时任务 | `/cron` |
| 📈 | 用量分析 | `/usage` |
| 🔗 | 拓扑 | `/topology` |
| 📜 | 日志 | `/logs` |

### CSV 导出

通过 `src/lib/export.ts` 提供：
- UTF-8 BOM 头 (`\uFEFF`)，中文 Excel 直接打开无乱码
- 自动生成文件名（含日期）
- 浏览器端下载（Blob + URL.createObjectURL）
