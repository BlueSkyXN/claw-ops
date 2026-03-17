// ==========================================
// claw-ops Mock 数据层
// 基于 OpenClaw Gateway 真实数据结构
// ==========================================

import type {
  AgentSummary,
  GatewaySessionRow,
  SessionsListResult,
  SessionsUsageResult,
  SessionsUsageAggregates,
  UsageTotals,
  DailyUsage,
  ChannelsStatusResult,
  ChannelAccountSnapshot,
  CronJob,
  CronRunLogEntry,
  LogEntry,
  ModelChoice,
  SkillEntry,
  NodeListNode,
  Snapshot,
  PresenceEntry,
  ExecApprovalRequest,
} from '../types/openclaw'

// ==========================================
// Agents (OpenClaw agents.list 返回)
// ==========================================

export const mockAgents: AgentSummary[] = [
  { id: 'default', name: 'Default Agent', identity: { name: 'Default Agent', emoji: '🤖' } },
  { id: 'coder', name: 'Coder', identity: { name: 'Coder', emoji: '💻' } },
  { id: 'writer', name: 'Writer', identity: { name: 'Writer', emoji: '✍️' } },
  { id: 'analyst', name: 'Data Analyst', identity: { name: 'Data Analyst', emoji: '📊' } },
  { id: 'ops', name: 'DevOps Agent', identity: { name: 'DevOps Agent', emoji: '⚙️' } },
  { id: 'translator', name: 'Translator', identity: { name: 'Translator', emoji: '🌐' } },
]

// ==========================================
// Sessions (OpenClaw sessions.list 返回)
// ==========================================

const now = Date.now()
const hour = 3600_000
const day = 86400_000

const mockSessions: GatewaySessionRow[] = [
  { key: 'sess-telegram-alice-default', kind: 'direct', label: '项目需求讨论', displayName: 'Alice', channel: 'telegram', updatedAt: now - 10 * 60_000, totalTokens: 45200, inputTokens: 12300, outputTokens: 32900, model: 'claude-sonnet-4-20250514', modelProvider: 'anthropic', lastMessagePreview: '好的，我来整理一下需求文档...', sendPolicy: 'allow' },
  { key: 'sess-feishu-bob-coder', kind: 'direct', label: '代码审查', displayName: 'Bob', channel: 'feishu', updatedAt: now - 30 * 60_000, totalTokens: 128500, inputTokens: 38000, outputTokens: 90500, model: 'claude-sonnet-4-20250514', modelProvider: 'anthropic', lastMessagePreview: '这段代码有一个潜在的并发问题...', sendPolicy: 'allow' },
  { key: 'sess-discord-charlie-writer', kind: 'direct', label: '博客文章撰写', displayName: 'Charlie', channel: 'discord', updatedAt: now - 2 * hour, totalTokens: 67800, inputTokens: 15600, outputTokens: 52200, model: 'gpt-4o', modelProvider: 'openai', lastMessagePreview: '我已经完成了文章的初稿...', sendPolicy: 'allow' },
  { key: 'sess-telegram-group-devteam', kind: 'group', label: '开发团队群', groupChannel: 'telegram', channel: 'telegram', updatedAt: now - 4 * hour, totalTokens: 234100, inputTokens: 89000, outputTokens: 145100, model: 'claude-sonnet-4-20250514', modelProvider: 'anthropic', lastMessagePreview: '部署脚本已经更新完毕', sendPolicy: 'allow' },
  { key: 'sess-slack-david-analyst', kind: 'direct', label: '数据报表生成', displayName: 'David', channel: 'slack', updatedAt: now - 6 * hour, totalTokens: 89300, inputTokens: 31000, outputTokens: 58300, model: 'claude-sonnet-4-20250514', modelProvider: 'anthropic', lastMessagePreview: '报表已生成，请查收附件', sendPolicy: 'allow' },
  { key: 'sess-feishu-eve-ops', kind: 'direct', label: '服务器监控告警', displayName: 'Eve', channel: 'feishu', updatedAt: now - 8 * hour, totalTokens: 23400, inputTokens: 8900, outputTokens: 14500, model: 'gpt-4o-mini', modelProvider: 'openai', lastMessagePreview: 'CPU 使用率已恢复正常水平', sendPolicy: 'allow' },
  { key: 'sess-discord-frank-translator', kind: 'direct', label: '文档翻译', displayName: 'Frank', channel: 'discord', updatedAt: now - 12 * hour, totalTokens: 156000, inputTokens: 78000, outputTokens: 78000, model: 'gpt-4o', modelProvider: 'openai', lastMessagePreview: '中文版本已翻译完成', sendPolicy: 'allow' },
  { key: 'sess-telegram-grace-default', kind: 'direct', label: '日程安排', displayName: 'Grace', channel: 'telegram', updatedAt: now - 1 * day, totalTokens: 12800, inputTokens: 5200, outputTokens: 7600, model: 'claude-sonnet-4-20250514', modelProvider: 'anthropic', lastMessagePreview: '已为您安排好明天的会议', sendPolicy: 'allow' },
  { key: 'sess-api-internal-coder', kind: 'direct', label: 'CI/CD Pipeline', channel: 'api', updatedAt: now - 1.5 * day, totalTokens: 345000, inputTokens: 120000, outputTokens: 225000, model: 'claude-sonnet-4-20250514', modelProvider: 'anthropic', lastMessagePreview: 'Pipeline 执行完成，所有测试通过', sendPolicy: 'allow' },
  { key: 'sess-feishu-group-product', kind: 'group', label: '产品讨论组', groupChannel: 'feishu', channel: 'feishu', updatedAt: now - 2 * day, totalTokens: 187600, inputTokens: 72000, outputTokens: 115600, model: 'gpt-4o', modelProvider: 'openai', lastMessagePreview: '新功能的原型设计已经完成', sendPolicy: 'allow' },
  { key: 'sess-main', kind: 'global', label: 'Main Session', updatedAt: now - 3 * day, totalTokens: 892000, inputTokens: 345000, outputTokens: 547000, model: 'claude-sonnet-4-20250514', modelProvider: 'anthropic', sendPolicy: 'allow' },
  { key: 'sess-slack-henry-analyst', kind: 'direct', label: '财务数据分析', displayName: 'Henry', channel: 'slack', updatedAt: now - 3 * day, totalTokens: 56700, inputTokens: 23000, outputTokens: 33700, model: 'claude-sonnet-4-20250514', modelProvider: 'anthropic', lastMessagePreview: 'Q3 财务报告已生成', sendPolicy: 'allow' },
]

export const mockSessionsList: SessionsListResult = {
  ts: now,
  path: '~/.openclaw/sessions',
  count: mockSessions.length,
  defaults: { modelProvider: 'anthropic', model: 'claude-sonnet-4-20250514', contextTokens: 200000 },
  sessions: mockSessions,
}

// ==========================================
// Usage (OpenClaw sessions.usage 返回)
// ==========================================

const dailyUsage: DailyUsage[] = Array.from({ length: 14 }, (_, i) => {
  const d = new Date(now - (13 - i) * day)
  const base = 50000 + Math.floor(Math.random() * 80000)
  return {
    date: d.toISOString().slice(0, 10),
    tokens: base,
    cost: +(base * 0.000015).toFixed(4),
    messages: 30 + Math.floor(Math.random() * 70),
    toolCalls: 5 + Math.floor(Math.random() * 25),
    errors: Math.floor(Math.random() * 3),
  }
})

const totalTokens = dailyUsage.reduce((s, d) => s + d.tokens, 0)
const totalCost = dailyUsage.reduce((s, d) => s + d.cost, 0)
const totalMessages = dailyUsage.reduce((s, d) => s + d.messages, 0)

const mockTotals = {
  inputTokens: Math.floor(totalTokens * 0.38),
  outputTokens: Math.floor(totalTokens * 0.52),
  totalTokens,
  totalCost: +totalCost.toFixed(4),
  cacheReadTokens: Math.floor(totalTokens * 0.08),
  cacheWriteTokens: Math.floor(totalTokens * 0.02),
  reasoningTokens: Math.floor(totalTokens * 0.1),
  calls: totalMessages,
  errors: dailyUsage.reduce((s, d) => s + d.errors, 0),
  toolCalls: dailyUsage.reduce((s, d) => s + d.toolCalls, 0),
} satisfies UsageTotals

const mockAggregates: SessionsUsageAggregates = {
  messages: {
    total: totalMessages,
    user: Math.floor(totalMessages * 0.45),
    assistant: Math.floor(totalMessages * 0.55),
    inbound: Math.floor(totalMessages * 0.45),
    outbound: Math.floor(totalMessages * 0.55),
    toolCalls: mockTotals.toolCalls ?? 0,
    toolResults: mockTotals.toolCalls ?? 0,
    errors: mockTotals.errors ?? 0,
  },
  tools: {
    totalCalls: mockTotals.toolCalls ?? 0,
    uniqueTools: 3,
    tools: [
      { name: 'search', count: Math.max(1, Math.floor((mockTotals.toolCalls ?? 0) * 0.45)) },
      { name: 'read', count: Math.max(1, Math.floor((mockTotals.toolCalls ?? 0) * 0.35)) },
      { name: 'write', count: Math.max(1, Math.floor((mockTotals.toolCalls ?? 0) * 0.2)) },
    ],
    calls: mockTotals.toolCalls ?? 0,
    errors: mockTotals.errors ?? 0,
  },
  byModel: [
    { model: 'claude-sonnet-4-20250514', count: Math.floor(totalMessages * 0.55), totals: { ...mockTotals, totalTokens: Math.floor(totalTokens * 0.55), totalCost: +(totalCost * 0.55).toFixed(4), inputTokens: Math.floor(mockTotals.inputTokens * 0.55), outputTokens: Math.floor(mockTotals.outputTokens * 0.55), calls: Math.floor(totalMessages * 0.55), errors: 2, toolCalls: 45 } },
    { model: 'gpt-4o', count: Math.floor(totalMessages * 0.3), totals: { ...mockTotals, totalTokens: Math.floor(totalTokens * 0.3), totalCost: +(totalCost * 0.3).toFixed(4), inputTokens: Math.floor(mockTotals.inputTokens * 0.3), outputTokens: Math.floor(mockTotals.outputTokens * 0.3), calls: Math.floor(totalMessages * 0.3), errors: 1, toolCalls: 28 } },
    { model: 'gpt-4o-mini', count: Math.floor(totalMessages * 0.15), totals: { ...mockTotals, totalTokens: Math.floor(totalTokens * 0.15), totalCost: +(totalCost * 0.15).toFixed(4), inputTokens: Math.floor(mockTotals.inputTokens * 0.15), outputTokens: Math.floor(mockTotals.outputTokens * 0.15), calls: Math.floor(totalMessages * 0.15), errors: 0, toolCalls: 12 } },
  ],
  byProvider: [
    { provider: 'anthropic', count: Math.floor(totalMessages * 0.55), totals: { ...mockTotals, totalTokens: Math.floor(totalTokens * 0.55), totalCost: +(totalCost * 0.55).toFixed(4), inputTokens: Math.floor(mockTotals.inputTokens * 0.55), outputTokens: Math.floor(mockTotals.outputTokens * 0.55), calls: Math.floor(totalMessages * 0.55), errors: 2, toolCalls: 45 } },
    { provider: 'openai', count: Math.floor(totalMessages * 0.45), totals: { ...mockTotals, totalTokens: Math.floor(totalTokens * 0.45), totalCost: +(totalCost * 0.45).toFixed(4), inputTokens: Math.floor(mockTotals.inputTokens * 0.45), outputTokens: Math.floor(mockTotals.outputTokens * 0.45), calls: Math.floor(totalMessages * 0.45), errors: 1, toolCalls: 40 } },
  ],
  byAgent: mockAgents.map(a => ({
    agentId: a.id,
    totals: { ...mockTotals, totalTokens: Math.floor(totalTokens / mockAgents.length), totalCost: +(totalCost / mockAgents.length).toFixed(4), inputTokens: Math.floor(mockTotals.inputTokens / mockAgents.length), outputTokens: Math.floor(mockTotals.outputTokens / mockAgents.length), calls: Math.floor(totalMessages / mockAgents.length), errors: 0, toolCalls: 10 },
  })),
  byChannel: [
    { channel: 'telegram', totals: { ...mockTotals, totalTokens: Math.floor(totalTokens * 0.3), totalCost: +(totalCost * 0.3).toFixed(4), inputTokens: 0, outputTokens: 0, calls: Math.floor(totalMessages * 0.3), errors: 0, toolCalls: 0 } },
    { channel: 'feishu', totals: { ...mockTotals, totalTokens: Math.floor(totalTokens * 0.25), totalCost: +(totalCost * 0.25).toFixed(4), inputTokens: 0, outputTokens: 0, calls: Math.floor(totalMessages * 0.25), errors: 0, toolCalls: 0 } },
    { channel: 'discord', totals: { ...mockTotals, totalTokens: Math.floor(totalTokens * 0.2), totalCost: +(totalCost * 0.2).toFixed(4), inputTokens: 0, outputTokens: 0, calls: Math.floor(totalMessages * 0.2), errors: 0, toolCalls: 0 } },
    { channel: 'slack', totals: { ...mockTotals, totalTokens: Math.floor(totalTokens * 0.15), totalCost: +(totalCost * 0.15).toFixed(4), inputTokens: 0, outputTokens: 0, calls: Math.floor(totalMessages * 0.15), errors: 0, toolCalls: 0 } },
    { channel: 'api', totals: { ...mockTotals, totalTokens: Math.floor(totalTokens * 0.1), totalCost: +(totalCost * 0.1).toFixed(4), inputTokens: 0, outputTokens: 0, calls: Math.floor(totalMessages * 0.1), errors: 0, toolCalls: 0 } },
  ],
  daily: dailyUsage,
}

export const mockUsage: SessionsUsageResult = {
  updatedAt: now,
  startDate: dailyUsage[0].date,
  endDate: dailyUsage[dailyUsage.length - 1].date,
  sessions: mockSessions.map(s => ({
    key: s.key,
    label: s.label,
    agentId: s.key.split('-').pop(),
    channel: s.channel,
    usage: (() => {
      const totalMessagesForSession = 10 + Math.floor(Math.random() * 50)
      const totals = {
        inputTokens: s.inputTokens ?? 0,
        outputTokens: s.outputTokens ?? 0,
        totalTokens: s.totalTokens ?? 0,
        totalCost: +((s.totalTokens ?? 0) * 0.000015).toFixed(4),
        calls: totalMessagesForSession,
        errors: 0,
      }
      return {
        ...totals,
        totals,
        input: totals.inputTokens,
        output: totals.outputTokens,
        cacheRead: 0,
        cacheWrite: 0,
        inputCost: 0,
        outputCost: totals.totalCost,
        cacheReadCost: 0,
        cacheWriteCost: 0,
        missingCostEntries: 0,
        inputTokens: totals.inputTokens,
        outputTokens: totals.outputTokens,
        calls: totals.calls,
        errors: totals.errors,
        toolCalls: 2 + Math.floor(Math.random() * 8),
        reasoningTokens: Math.floor((s.totalTokens ?? 0) * 0.08),
      }
    })(),
  })).map((entry) => ({
    ...entry,
    usage: {
      ...(entry.usage ?? {}),
      messageCounts: {
        total: entry.usage?.calls ?? 0,
        user: Math.max(1, Math.round((entry.usage?.calls ?? 0) * 0.45)),
        assistant: Math.max(1, Math.round((entry.usage?.calls ?? 0) * 0.55)),
        toolCalls: entry.usage?.toolCalls ?? 0,
        toolResults: entry.usage?.toolCalls ?? 0,
        errors: 0,
      },
    },
  })),
  totals: mockTotals,
  aggregates: mockAggregates,
}

// ==========================================
// Channels (OpenClaw channels.status 返回)
// ==========================================

const mockChannelAccounts: Record<string, ChannelAccountSnapshot[]> = {
  telegram: [
    { accountId: 'tg-bot-main', name: 'ClawBot', enabled: true, configured: true, linked: true, running: true, connected: true, lastConnectedAt: now - 5 * 60_000, lastInboundAt: now - 10 * 60_000, lastOutboundAt: now - 8 * 60_000, activeRuns: 1 },
  ],
  feishu: [
    { accountId: 'feishu-bot-1', name: 'OpenClaw 飞书', enabled: true, configured: true, linked: true, running: true, connected: true, lastConnectedAt: now - 15 * 60_000, lastInboundAt: now - 30 * 60_000, lastOutboundAt: now - 25 * 60_000, activeRuns: 0 },
  ],
  discord: [
    { accountId: 'discord-bot-1', name: 'ClawBot Discord', enabled: true, configured: true, linked: true, running: true, connected: true, lastConnectedAt: now - 2 * hour, lastInboundAt: now - 2 * hour, lastOutboundAt: now - 2 * hour, activeRuns: 0 },
  ],
  slack: [
    { accountId: 'slack-bot-1', name: 'OpenClaw Slack', enabled: true, configured: true, linked: true, running: false, connected: false, lastConnectedAt: now - 6 * hour, lastError: 'Token expired, needs re-authentication', reconnectAttempts: 3 },
  ],
  whatsapp: [
    { accountId: 'wa-1', name: 'WhatsApp Business', enabled: false, configured: true, linked: false, running: false, connected: false },
  ],
}

export const mockChannelsStatus: ChannelsStatusResult = {
  ts: now,
  channelOrder: ['telegram', 'feishu', 'discord', 'slack', 'whatsapp'],
  channelLabels: { telegram: 'Telegram', feishu: '飞书', discord: 'Discord', slack: 'Slack', whatsapp: 'WhatsApp' },
  channelDetailLabels: { telegram: 'Telegram Bot API', feishu: 'Feishu Open Platform', discord: 'Discord Bot', slack: 'Slack App', whatsapp: 'WhatsApp Business API' },
  channelMeta: [
    { id: 'telegram', label: 'Telegram', detailLabel: 'Telegram Bot API', systemImage: '📱' },
    { id: 'feishu', label: '飞书', detailLabel: 'Feishu Open Platform', systemImage: '🐦' },
    { id: 'discord', label: 'Discord', detailLabel: 'Discord Bot', systemImage: '🎮' },
    { id: 'slack', label: 'Slack', detailLabel: 'Slack App', systemImage: '💬' },
    { id: 'whatsapp', label: 'WhatsApp', detailLabel: 'WhatsApp Business API', systemImage: '📞' },
  ],
  channels: { telegram: {}, feishu: {}, discord: {}, slack: {}, whatsapp: {} },
  channelAccounts: mockChannelAccounts,
  channelDefaultAccountId: { telegram: 'tg-bot-main', feishu: 'feishu-bot-1', discord: 'discord-bot-1', slack: 'slack-bot-1', whatsapp: 'wa-1' },
}

// ==========================================
// Cron Jobs (OpenClaw cron.list 返回)
// ==========================================

export const mockCronJobs: CronJob[] = [
  { id: 'cron-daily-report', name: '每日数据报告', enabled: true, schedule: { kind: 'at', at: '09:00' }, payload: { kind: 'agentTurn', message: '请生成今天的数据分析日报，包括关键指标和趋势分析' }, agentId: 'analyst', description: '每天早上 9 点生成数据日报', nextRunAtMs: now + 8 * hour, lastRunAtMs: now - 16 * hour, createdAtMs: now - 30 * day, updatedAtMs: now - 2 * day },
  { id: 'cron-health-check', name: '系统健康检查', enabled: true, schedule: { kind: 'every', everyMs: 1800_000 }, payload: { kind: 'agentTurn', message: '执行系统健康检查，检查所有服务状态和性能指标' }, agentId: 'ops', description: '每 30 分钟检查系统健康状态', nextRunAtMs: now + 15 * 60_000, lastRunAtMs: now - 15 * 60_000, createdAtMs: now - 60 * day, updatedAtMs: now - 7 * day },
  { id: 'cron-weekly-summary', name: '周报生成', enabled: true, schedule: { kind: 'cron', expr: '0 10 * * 1', tz: 'Asia/Shanghai' }, payload: { kind: 'agentTurn', message: '生成本周工作周报，汇总各项目进展和下周计划', deliver: true, channel: 'feishu' }, agentId: 'writer', description: '每周一上午 10 点生成周报', nextRunAtMs: now + 3 * day, lastRunAtMs: now - 4 * day, createdAtMs: now - 45 * day, updatedAtMs: now - 10 * day },
  { id: 'cron-code-review', name: '代码仓库扫描', enabled: true, schedule: { kind: 'at', at: '02:00' }, payload: { kind: 'agentTurn', message: '扫描代码仓库，检查安全漏洞和代码质量问题' }, agentId: 'coder', description: '每天凌晨 2 点扫描代码仓库', nextRunAtMs: now + 20 * hour, lastRunAtMs: now - 4 * hour, createdAtMs: now - 20 * day, updatedAtMs: now - 5 * day },
  { id: 'cron-translate-sync', name: '文档翻译同步', enabled: false, schedule: { kind: 'every', everyMs: 7200_000 }, payload: { kind: 'agentTurn', message: '检查是否有新的文档需要翻译，并同步翻译结果' }, agentId: 'translator', description: '每 2 小时检查文档翻译状态（已暂停）', nextRunAtMs: undefined, lastRunAtMs: now - 3 * day, createdAtMs: now - 15 * day, updatedAtMs: now - 3 * day },
  { id: 'cron-backup', name: '数据备份', enabled: true, schedule: { kind: 'cron', expr: '0 3 * * *' }, payload: { kind: 'systemEvent', text: '执行数据备份' }, description: '每天凌晨 3 点备份数据', nextRunAtMs: now + 21 * hour, lastRunAtMs: now - 3 * hour, createdAtMs: now - 90 * day, updatedAtMs: now - 30 * day },
]

export const mockCronRuns: CronRunLogEntry[] = [
  { id: 'run-1', jobId: 'cron-daily-report', jobName: '每日数据报告', status: 'ok', startedAtMs: now - 16 * hour, durationMs: 45000, deliveryStatus: 'delivered' },
  { id: 'run-2', jobId: 'cron-health-check', jobName: '系统健康检查', status: 'ok', startedAtMs: now - 15 * 60_000, durationMs: 8000, deliveryStatus: 'not-requested' },
  { id: 'run-3', jobId: 'cron-health-check', jobName: '系统健康检查', status: 'ok', startedAtMs: now - 45 * 60_000, durationMs: 7500, deliveryStatus: 'not-requested' },
  { id: 'run-4', jobId: 'cron-code-review', jobName: '代码仓库扫描', status: 'ok', startedAtMs: now - 4 * hour, durationMs: 120000, deliveryStatus: 'delivered' },
  { id: 'run-5', jobId: 'cron-weekly-summary', jobName: '周报生成', status: 'ok', startedAtMs: now - 4 * day, durationMs: 65000, deliveryStatus: 'delivered' },
  { id: 'run-6', jobId: 'cron-health-check', jobName: '系统健康检查', status: 'error', startedAtMs: now - 2 * hour, durationMs: 30000, error: 'Timeout: agent response exceeded 30s', deliveryStatus: 'not-requested' },
  { id: 'run-7', jobId: 'cron-backup', jobName: '数据备份', status: 'ok', startedAtMs: now - 3 * hour, durationMs: 15000, deliveryStatus: 'not-requested' },
  { id: 'run-8', jobId: 'cron-translate-sync', jobName: '文档翻译同步', status: 'skipped', startedAtMs: now - 3 * day, durationMs: 0, deliveryStatus: 'not-requested' },
]

// ==========================================
// Logs (OpenClaw logs.tail 返回)
// ==========================================

export const mockLogs: LogEntry[] = [
  { ts: now - 2 * 60_000, level: 'info', source: 'gateway', message: 'Client connected: claw-ops (ui mode)', raw: '[2025-01-15T10:58:00Z] INFO gateway: Client connected: claw-ops (ui mode)' },
  { ts: now - 5 * 60_000, level: 'info', source: 'agent:default', message: 'Agent turn completed for session sess-telegram-alice-default', raw: '[2025-01-15T10:55:00Z] INFO agent:default: Agent turn completed for session sess-telegram-alice-default' },
  { ts: now - 8 * 60_000, level: 'info', source: 'channel:telegram', message: 'Inbound message from user Alice', raw: '[2025-01-15T10:52:00Z] INFO channel:telegram: Inbound message from user Alice' },
  { ts: now - 12 * 60_000, level: 'warn', source: 'channel:slack', message: 'Connection lost, attempting reconnect (attempt 3)', raw: '[2025-01-15T10:48:00Z] WARN channel:slack: Connection lost, attempting reconnect (attempt 3)' },
  { ts: now - 15 * 60_000, level: 'info', source: 'cron', message: 'Cron job completed: cron-health-check (ok, 8000ms)', raw: '[2025-01-15T10:45:00Z] INFO cron: Cron job completed: cron-health-check (ok, 8000ms)' },
  { ts: now - 20 * 60_000, level: 'info', source: 'agent:coder', message: 'Agent turn completed for session sess-feishu-bob-coder', raw: '[2025-01-15T10:40:00Z] INFO agent:coder: Agent turn completed for session sess-feishu-bob-coder' },
  { ts: now - 25 * 60_000, level: 'error', source: 'channel:slack', message: 'Authentication failed: Token expired', raw: '[2025-01-15T10:35:00Z] ERROR channel:slack: Authentication failed: Token expired' },
  { ts: now - 30 * 60_000, level: 'info', source: 'gateway', message: 'Config reloaded successfully', raw: '[2025-01-15T10:30:00Z] INFO gateway: Config reloaded successfully' },
  { ts: now - 45 * 60_000, level: 'info', source: 'agent:writer', message: 'Agent turn completed for session sess-discord-charlie-writer', raw: '[2025-01-15T10:15:00Z] INFO agent:writer: Agent turn completed for session sess-discord-charlie-writer' },
  { ts: now - 1 * hour, level: 'debug', source: 'gateway', message: 'Heartbeat tick (uptime: 86400000ms, clients: 3)', raw: '[2025-01-15T10:00:00Z] DEBUG gateway: Heartbeat tick (uptime: 86400000ms, clients: 3)' },
  { ts: now - 1.5 * hour, level: 'info', source: 'channel:feishu', message: 'Outbound message delivered to group', raw: '[2025-01-15T09:30:00Z] INFO channel:feishu: Outbound message delivered to group' },
  { ts: now - 2 * hour, level: 'error', source: 'cron', message: 'Cron job failed: cron-health-check (timeout)', raw: '[2025-01-15T09:00:00Z] ERROR cron: Cron job failed: cron-health-check (timeout)' },
  { ts: now - 2.5 * hour, level: 'warn', source: 'agent:ops', message: 'Tool execution slow: shell command took 15s', raw: '[2025-01-15T08:30:00Z] WARN agent:ops: Tool execution slow: shell command took 15s' },
  { ts: now - 3 * hour, level: 'info', source: 'gateway', message: 'New device paired: MacBook Pro (node-host)', raw: '[2025-01-15T08:00:00Z] INFO gateway: New device paired: MacBook Pro (node-host)' },
  { ts: now - 4 * hour, level: 'info', source: 'agent:coder', message: 'Code review scan completed: 3 issues found', raw: '[2025-01-15T07:00:00Z] INFO agent:coder: Code review scan completed: 3 issues found' },
  { ts: now - 5 * hour, level: 'info', source: 'channel:discord', message: 'Bot reconnected to Discord gateway', raw: '[2025-01-15T06:00:00Z] INFO channel:discord: Bot reconnected to Discord gateway' },
  { ts: now - 6 * hour, level: 'info', source: 'cron', message: 'Cron job completed: cron-backup (ok, 15000ms)', raw: '[2025-01-15T05:00:00Z] INFO cron: Cron job completed: cron-backup (ok, 15000ms)' },
  { ts: now - 8 * hour, level: 'warn', source: 'gateway', message: 'High memory usage detected: 78% of limit', raw: '[2025-01-15T03:00:00Z] WARN gateway: High memory usage detected: 78% of limit' },
  { ts: now - 10 * hour, level: 'info', source: 'agent:analyst', message: 'Daily report generated and delivered via Slack', raw: '[2025-01-15T01:00:00Z] INFO agent:analyst: Daily report generated and delivered via Slack' },
  { ts: now - 12 * hour, level: 'info', source: 'gateway', message: 'Gateway started on port 18789 (v0.8.2, protocol 3)', raw: '[2025-01-14T23:00:00Z] INFO gateway: Gateway started on port 18789 (v0.8.2, protocol 3)' },
]

// ==========================================
// Models (OpenClaw models.list 返回)
// ==========================================

export const mockModels: ModelChoice[] = [
  { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', provider: 'anthropic', contextWindow: 200000, maxOutput: 64000 },
  { id: 'claude-opus-4-20250514', name: 'Claude Opus 4', provider: 'anthropic', contextWindow: 200000, maxOutput: 32000 },
  { id: 'claude-haiku-3.5', name: 'Claude 3.5 Haiku', provider: 'anthropic', contextWindow: 200000, maxOutput: 8192 },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', contextWindow: 128000, maxOutput: 16384 },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai', contextWindow: 128000, maxOutput: 16384 },
  { id: 'gpt-4.1', name: 'GPT-4.1', provider: 'openai', contextWindow: 1048576, maxOutput: 32768 },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'google', contextWindow: 1048576, maxOutput: 65536 },
]

// ==========================================
// Skills (OpenClaw skills.status 返回)
// ==========================================

export const mockSkills: SkillEntry[] = [
  { name: 'web-search', version: '1.2.0', status: 'installed', description: '网络搜索' },
  { name: 'code-interpreter', version: '2.0.1', status: 'installed', description: '代码解释器' },
  { name: 'file-manager', version: '1.0.0', status: 'installed', description: '文件管理' },
  { name: 'image-gen', version: '0.9.0', status: 'available', description: '图片生成' },
  { name: 'browser', version: '1.1.0', status: 'installed', description: '浏览器控制' },
  { name: 'shell', version: '1.3.0', status: 'installed', description: 'Shell 命令执行' },
]

// ==========================================
// Nodes (OpenClaw node.list 返回)
// ==========================================

export const mockNodes: NodeListNode[] = [
  { nodeId: 'node-macbook-1', name: 'MacBook Pro (开发机)', status: 'online', lastSeenAt: now - 60_000, capabilities: ['shell', 'browser', 'code-interpreter'], platform: 'darwin', version: '0.8.2' },
  { nodeId: 'node-server-1', name: 'Production Server', status: 'online', lastSeenAt: now - 30_000, capabilities: ['shell', 'file-manager'], platform: 'linux', version: '0.8.2' },
  { nodeId: 'node-windows-1', name: 'Windows Workstation', status: 'offline', lastSeenAt: now - 2 * day, capabilities: ['shell', 'browser'], platform: 'win32', version: '0.8.1' },
]

// ==========================================
// Config (OpenClaw config.get 返回)
// ==========================================

export const mockConfig: Record<string, unknown> = {
  version: '0.8.2',
  agents: mockAgents.map(a => ({ id: a.id, name: a.name })),
  channels: { telegram: { enabled: true }, feishu: { enabled: true }, discord: { enabled: true }, slack: { enabled: true } },
  security: { authMode: 'token', execHost: 'sandboxed' },
}

// ==========================================
// Exec Approvals
// ==========================================

export const mockExecApprovals: ExecApprovalRequest[] = [
  { id: 'approval-1', sessionKey: 'sess-feishu-bob-coder', agentId: 'coder', tool: 'bash', description: '执行 rm -rf /tmp/build-artifacts', ts: now - 5 * 60_000 },
  { id: 'approval-2', sessionKey: 'sess-telegram-alice-default', agentId: 'default', tool: 'browser', description: '访问 https://api.example.com/admin', ts: now - 15 * 60_000 },
]

// ==========================================
// Presence & Snapshot
// ==========================================

export const mockPresence: PresenceEntry[] = [
  { host: 'MacBook-Pro.local', version: '0.8.2', platform: 'darwin', mode: 'ui', ts: now - 60_000, instanceId: 'ui-001', scopes: ['operator.read', 'operator.write'] },
  { host: 'macbook-pro', version: '0.8.2', platform: 'darwin', mode: 'cli', ts: now - 300_000, instanceId: 'cli-001', scopes: ['operator.read', 'operator.write', 'operator.admin'] },
  { host: 'prod-server-1', version: '0.8.2', platform: 'linux', mode: 'node', ts: now - 30_000, instanceId: 'node-001', scopes: ['operator.read'] },
]

export const mockSnapshot: Snapshot = {
  presence: mockPresence,
  health: { ok: true, services: { gateway: 'ok', agents: 'ok', channels: 'degraded' } },
  stateVersion: { presence: 42, health: 15 },
  uptimeMs: 86400000,
  configPath: '~/.openclaw/openclaw.json',
  stateDir: '~/.openclaw/state',
  sessionDefaults: { defaultAgentId: 'default', mainKey: 'sess-main', mainSessionKey: 'main', scope: 'operator.read' },
  authMode: 'token',
}
