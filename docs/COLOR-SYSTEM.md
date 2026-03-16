# claw-ops — 色彩系统文档

## 设计理念

claw-ops 采用 **马卡龙/糖果色** 清新设计风格（Light Theme），以白色为基底，搭配柔和的蓝紫色系品牌色和丰富的 Pastel 色板，打造专业但不沉闷的企业工具视觉体验。

## 五层色彩架构

### 第一层：Surface（结构层）

用于页面骨架、卡片、边框等结构性元素。

| Token | 色值 | 用途 |
|-------|------|------|
| `surface-bg` | `#f8fafc` | 页面背景 |
| `surface-card` | `#ffffff` | 卡片背景 |
| `surface-sidebar` | `#ffffff` | 侧边栏背景 |
| `surface-border` | `#e2e8f0` | 边框颜色 |
| `surface-hover` | `#f1f5f9` | 悬停背景 |
| `surface-divider` | `#f1f5f9` | 分隔线 |

### 第二层：Text（文字层）

用于各级文字的颜色区分。

| Token | 色值 | 用途 |
|-------|------|------|
| `text-primary` | `#1e293b` | 主要文字 |
| `text-secondary` | `#64748b` | 次要文字 |
| `text-muted` | `#94a3b8` | 弱化文字 |
| `text-inverse` | `#ffffff` | 反色文字（深色背景上） |

### 第三层：Pastel（柔和色板）

用于标签背景、状态指示等需要柔和色彩的场景。

| Token | 色值 | 用途 |
|-------|------|------|
| `pastel-blue` | `#93c5fd` | 信息类标签 |
| `pastel-purple` | `#c4b5fd` | 品牌相关 |
| `pastel-green` | `#86efac` | 成功/在线 |
| `pastel-yellow` | `#fde68a` | 警告 |
| `pastel-red` | `#fca5a5` | 错误/危险 |
| `pastel-pink` | `#f9a8d4` | 装饰 |
| `pastel-cyan` | `#67e8f9` | 辅助信息 |
| `pastel-orange` | `#fdba74` | 注意 |

### 第四层：Accent（强调色）

用于按钮、图标、图表等需要醒目色彩的场景。

| Token | 色值 | 用途 |
|-------|------|------|
| `accent-blue` | `#3b82f6` | 链接、主操作 |
| `accent-purple` | `#a855f7` | 品牌辅助 |
| `accent-green` | `#22c55e` | 成功、在线 |
| `accent-yellow` | `#eab308` | 警告 |
| `accent-red` | `#ef4444` | 错误、危险 |
| `accent-pink` | `#ec4899` | 装饰 |
| `accent-cyan` | `#06b6d4` | 数据可视化 |
| `accent-orange` | `#f97316` | 注意 |

### 第五层：Brand（品牌色）

基于 Indigo 色阶，用于品牌标识、主按钮、选中状态。

| Token | 色值 | 用途 |
|-------|------|------|
| `brand-50` | `#eef2ff` | 极浅品牌背景 |
| `brand-100` | `#e0e7ff` | 浅品牌背景 |
| `brand-200` | `#c7d2fe` | 选中行背景 |
| `brand-300` | `#a5b4fc` | 边框高亮 |
| `brand-400` | `#818cf8` | 次要品牌元素 |
| `brand-500` | `#6366f1` | 主品牌色 |
| `brand-600` | `#4f46e5` | 主按钮/链接 |
| `brand-700` | `#4338ca` | 深色品牌 |

## CSS 组件类

在 `src/index.css` 中定义的可复用样式类：

### `.card`
```css
白色卡片，圆角 12px，border 1px surface-border，shadow-card
```

### `.card-hover`
```css
继承 .card，悬停时 shadow-card-hover + 上移 1px 动效
```

### `.badge`
```css
内联块，圆角全圆，px-2.5 py-0.5，10px 字号
变体: .badge-info (蓝), .badge-success (绿), .badge-warning (黄), .badge-error (红)
```

### `.btn-primary`
```css
品牌渐变背景 (brand-500 → brand-600)，白色文字，hover 加深
```

### `.btn-secondary`
```css
白色背景，brand-600 文字，品牌边框，hover 品牌浅色背景
```

### `.btn-ghost`
```css
透明背景，hover 时 surface-hover 背景
```

### `.stat-card`
```css
卡片变体，左侧 3px 品牌色竖线装饰
```

## 图表配色方案

### 24h 趋势图 (Dashboard)
- 任务数: `#3b82f6` (accent-blue)
- 消息数: `#22c55e` (accent-green)

### Token 消耗堆叠图 (Dashboard)
- 消息分拣: `#06b6d4` (accent-cyan)
- 任务规划: `#3b82f6` (accent-blue)
- 质量审核: `#a855f7` (accent-purple)
- 任务调度: `#fb923c` (accent-orange)
- 执行组: `#22c55e` (accent-green)
- 专家组: `#eab308` (accent-yellow)

### 通信矩阵热力图 (Matrix)
- 无通信: `#f8fafc` (surface-bg)
- 低频: `#dbeafe` (blue-100)
- 中频: `#93c5fd` (pastel-blue)
- 高频: `#3b82f6` (accent-blue)

### 工作流节点 (Workflow)
- 通过: `#22c55e` (accent-green)
- 驳回: `#ef4444` (accent-red)
- 进行中: `#3b82f6` (accent-blue)
- 待处理: `#e2e8f0` (surface-border)
- R-badge 审议轮次: `#a855f7` (accent-purple)

### 运维中心 (OpsCenter)
- 流水线各阶段: 各 accent-* 色（蓝=待处理，青=分拣，蓝=规划，紫=审议，橙=派发，绿=执行中，绿=完成，红=取消/阻塞）
- 智能体状态灯: 绿=online，蓝=busy，灰=idle，红=offline
- 准奏按钮: `#22c55e` (accent-green)
- 封驳按钮: `#ef4444` (accent-red)
- 瓶颈阈值: accent-red (>5s) / accent-green (≤5s)

## 阴影系统

| Token | 值 | 用途 |
|-------|-----|------|
| `card` | `0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)` | 卡片默认 |
| `card-hover` | `0 10px 25px -5px rgba(0,0,0,0.08), 0 8px 10px -6px rgba(0,0,0,0.04)` | 卡片悬停 |
| `sidebar` | `2px 0 8px rgba(0,0,0,0.04)` | 侧边栏 |
| `topbar` | `0 1px 3px rgba(0,0,0,0.05)` | 顶栏 |

## 渐变系统

| Token | 值 | 用途 |
|-------|-----|------|
| `gradient-blue` | `135deg, #93c5fd, #60a5fa` | 蓝色渐变 |
| `gradient-green` | `135deg, #86efac, #4ade80` | 绿色渐变 |
| `gradient-orange` | `135deg, #fdba74, #fb923c` | 橙色渐变 |
| `gradient-cyan` | `135deg, #67e8f9, #22d3ee` | 青色渐变 |
| `gradient-purple` | `135deg, #c4b5fd, #a78bfa` | 紫色渐变 |
| `gradient-warm` | `135deg, #fde68a, #fdba74` | 暖色渐变 |
| `gradient-header` | `135deg, #6366f1, #8b5cf6` | 品牌标识渐变 |

## 使用约定

1. **结构颜色** 只用 `surface-*` Token
2. **文字颜色** 只用 `text-*` Token
3. **标签/徽章** 背景用 `pastel-*`，文字用 `accent-*` 的深色变体
4. **按钮** 用 `.btn-primary` / `.btn-secondary` / `.btn-ghost` 类
5. **图表** 颜色从 `accent-*` 取值，保持全站一致
6. **状态色** — 绿=成功/在线，红=错误/危险，黄=警告，蓝=信息
