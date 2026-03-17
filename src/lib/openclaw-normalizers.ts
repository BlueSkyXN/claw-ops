import type {
  ChannelAccountSnapshot,
  ChannelUiMeta,
  ChannelsStatusResult,
  SessionCostSummary,
  SessionDailyMessageCounts,
  SessionDailyUsage,
  SessionMessageCounts,
  SessionModelUsage,
  SessionToolUsage,
  SessionUsageEntry,
  SessionsUsageResult,
  UsageCostSummary,
  UsageTotals,
} from '../types/openclaw'

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined
}

function asStringArray(value: unknown): string[] | undefined {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : undefined
}

function isNonNull<T>(value: T | null): value is T {
  return value !== null
}

function numberFrom(...values: unknown[]): number | undefined {
  for (const value of values) {
    const parsed = asNumber(value)
    if (parsed !== undefined) return parsed
  }
  return undefined
}

function normalizeUsageTotals(raw: unknown): UsageTotals {
  const source = asRecord(raw) ?? {}
  const input = numberFrom(source.input, source.inputTokens, source.input_tokens) ?? 0
  const output = numberFrom(source.output, source.outputTokens, source.output_tokens) ?? 0
  const cacheRead = numberFrom(source.cacheRead, source.cacheReadTokens, source.cache_read, source.cache_read_tokens) ?? 0
  const cacheWrite = numberFrom(source.cacheWrite, source.cacheWriteTokens, source.cache_write, source.cache_write_tokens) ?? 0
  const totalTokens = numberFrom(source.totalTokens, source.total_tokens) ?? (input + output + cacheRead + cacheWrite)
  const totalCost = numberFrom(source.totalCost, source.total_cost) ?? 0
  const inputCost = numberFrom(source.inputCost, source.input_cost) ?? 0
  const outputCost = numberFrom(source.outputCost, source.output_cost) ?? 0
  const cacheReadCost = numberFrom(source.cacheReadCost, source.cache_read_cost) ?? 0
  const cacheWriteCost = numberFrom(source.cacheWriteCost, source.cache_write_cost) ?? 0
  const missingCostEntries = numberFrom(source.missingCostEntries, source.missing_cost_entries) ?? 0

  return {
    input,
    output,
    cacheRead,
    cacheWrite,
    totalTokens,
    totalCost,
    inputCost,
    outputCost,
    cacheReadCost,
    cacheWriteCost,
    missingCostEntries,
    inputTokens: input,
    outputTokens: output,
    cacheReadTokens: cacheRead,
    cacheWriteTokens: cacheWrite,
    reasoningTokens: numberFrom(source.reasoningTokens, source.reasoning_tokens) ?? 0,
    calls: numberFrom(source.calls, source.callCount, source.call_count, source.messageCount, source.message_count) ?? 0,
    errors: numberFrom(source.errors, source.errorCount, source.error_count) ?? 0,
    toolCalls: numberFrom(source.toolCalls, source.toolCallCount, source.tool_call_count) ?? 0,
  }
}

function normalizeMessageCounts(raw: unknown, fallbackTotals?: UsageTotals): SessionMessageCounts {
  const source = asRecord(raw) ?? {}
  return {
    total: numberFrom(source.total, source.messageCount, source.message_count, fallbackTotals?.calls) ?? 0,
    user: numberFrom(source.user, source.inbound) ?? 0,
    assistant: numberFrom(source.assistant, source.outbound) ?? 0,
    toolCalls: numberFrom(source.toolCalls, source.toolCallCount, source.tool_call_count, fallbackTotals?.toolCalls) ?? 0,
    toolResults: numberFrom(source.toolResults, source.toolResultCount, source.tool_result_count, source.toolCalls, source.toolCallCount) ?? 0,
    errors: numberFrom(source.errors, source.errorCount, source.error_count, fallbackTotals?.errors) ?? 0,
    inbound: numberFrom(source.inbound, source.user) ?? 0,
    outbound: numberFrom(source.outbound, source.assistant) ?? 0,
  }
}

function normalizeToolUsage(raw: unknown, fallbackTotals?: UsageTotals): SessionToolUsage {
  const source = asRecord(raw) ?? {}
  const tools = Array.isArray(source.tools)
    ? source.tools
        .map((entry) => {
          const record = asRecord(entry)
          const name = asString(record?.name)
          if (!name) return null
          return { name, count: numberFrom(record?.count) ?? 0 }
        })
        .filter((entry): entry is { name: string; count: number } => entry !== null)
    : []

  return {
    totalCalls: numberFrom(source.totalCalls, source.calls, fallbackTotals?.toolCalls) ?? 0,
    uniqueTools: numberFrom(source.uniqueTools, source.unique_tools) ?? tools.length,
    tools,
    calls: numberFrom(source.calls, source.totalCalls, fallbackTotals?.toolCalls) ?? 0,
    errors: numberFrom(source.errors, source.errorCount, fallbackTotals?.errors) ?? 0,
  }
}

function normalizeDailyUsageEntries(raw: unknown): SessionDailyUsage[] | undefined {
  if (!Array.isArray(raw)) return undefined
  return raw
    .map((entry) => {
      const record = asRecord(entry)
      const date = asString(record?.date)
      if (!date) return null
      return {
        date,
        tokens: numberFrom(record?.tokens, record?.totalTokens, record?.total_tokens) ?? 0,
        cost: numberFrom(record?.cost, record?.totalCost, record?.total_cost) ?? 0,
      }
    })
    .filter((entry): entry is SessionDailyUsage => entry !== null)
}

function normalizeDailyMessageCounts(raw: unknown): SessionDailyMessageCounts[] | undefined {
  if (!Array.isArray(raw)) return undefined
  return raw
    .map((entry) => {
      const record = asRecord(entry)
      const date = asString(record?.date)
      if (!date) return null
      return {
        date,
        total: numberFrom(record?.total, record?.messageCount, record?.message_count) ?? 0,
        user: numberFrom(record?.user, record?.inbound) ?? 0,
        assistant: numberFrom(record?.assistant, record?.outbound) ?? 0,
        toolCalls: numberFrom(record?.toolCalls, record?.toolCallCount, record?.tool_call_count) ?? 0,
        toolResults: numberFrom(record?.toolResults, record?.toolResultCount, record?.tool_result_count) ?? 0,
        errors: numberFrom(record?.errors, record?.errorCount, record?.error_count) ?? 0,
      }
    })
    .filter((entry): entry is SessionDailyMessageCounts => entry !== null)
}

function normalizeSessionUsage(raw: unknown): SessionCostSummary | null {
  const source = asRecord(raw)
  if (!source) return null

  const totals = normalizeUsageTotals(source.totals ?? source)
  const messageCounts = normalizeMessageCounts(source.messageCounts ?? source.message_counts ?? source, totals)
  const toolUsage = normalizeToolUsage(source.toolUsage ?? source.tool_usage ?? source, totals)
  const rawModelUsage = Array.isArray(source.modelUsage)
    ? source.modelUsage
    : Array.isArray(source.model_usage)
      ? source.model_usage
      : null
  const rawLatency = asRecord(source.latency)

  return {
    ...totals,
    totals,
    sessionId: asString(source.sessionId ?? source.session_id),
    sessionFile: asString(source.sessionFile ?? source.session_file),
    firstActivity: numberFrom(source.firstActivity, source.first_activity),
    lastActivity: numberFrom(source.lastActivity, source.last_activity),
    durationMs: numberFrom(source.durationMs, source.duration_ms),
    activityDates: asStringArray(source.activityDates ?? source.activity_dates),
    dailyBreakdown: normalizeDailyUsageEntries(source.dailyBreakdown ?? source.daily_breakdown ?? source.daily),
    dailyMessageCounts: normalizeDailyMessageCounts(source.dailyMessageCounts ?? source.daily_message_counts),
    messageCounts,
    toolUsage,
    modelUsage: rawModelUsage
      ? rawModelUsage
          .map((entry): SessionModelUsage | null => {
            const record = asRecord(entry)
            if (!record) return null
            return {
              provider: asString(record.provider) ?? null,
              model: asString(record.model) ?? null,
              count: numberFrom(record.count) ?? 0,
              totals: normalizeUsageTotals(record.totals ?? record),
            }
          })
          .filter(isNonNull)
      : undefined,
    latency: rawLatency
      ? {
          count: numberFrom(rawLatency.count) ?? 0,
          avgMs: numberFrom(rawLatency.avgMs, rawLatency.avg_ms) ?? 0,
          p95Ms: numberFrom(rawLatency.p95Ms, rawLatency.p95_ms) ?? 0,
          minMs: numberFrom(rawLatency.minMs, rawLatency.min_ms) ?? 0,
          maxMs: numberFrom(rawLatency.maxMs, rawLatency.max_ms) ?? 0,
        }
      : undefined,
  }
}

export function normalizeSessionsUsageResult(raw: SessionsUsageResult): SessionsUsageResult {
  const source = asRecord(raw) ?? {}
  const rawAggregates = asRecord(source.aggregates) ?? {}
  const totals = normalizeUsageTotals(source.totals ?? source)
  const messages = normalizeMessageCounts(rawAggregates.messages ?? source, totals)
  const tools = normalizeToolUsage(rawAggregates.tools ?? rawAggregates.toolUsage ?? source, totals)

  const sessions: SessionUsageEntry[] = Array.isArray(source.sessions)
    ? source.sessions
        .map((entry): SessionUsageEntry | null => {
          const record = asRecord(entry)
          if (!record) return null
          const usage = normalizeSessionUsage(record.usage)
          return {
            key: asString(record.key) ?? 'unknown-session',
            label: asString(record.label),
            sessionId: asString(record.sessionId ?? record.session_id),
            updatedAt: numberFrom(record.updatedAt, record.updated_at),
            agentId: asString(record.agentId ?? record.agent_id),
            channel: asString(record.channel),
            chatType: asString(record.chatType ?? record.chat_type),
            origin: asRecord(record.origin)
              ? {
                  label: asString(asRecord(record.origin)?.label),
                  provider: asString(asRecord(record.origin)?.provider),
                  surface: asString(asRecord(record.origin)?.surface),
                  chatType: asString(asRecord(record.origin)?.chatType ?? asRecord(record.origin)?.chat_type),
                  from: asString(asRecord(record.origin)?.from),
                  to: asString(asRecord(record.origin)?.to),
                  accountId: asString(asRecord(record.origin)?.accountId ?? asRecord(record.origin)?.account_id),
                  threadId: (asRecord(record.origin)?.threadId ?? asRecord(record.origin)?.thread_id) as string | number | undefined,
                }
              : undefined,
            modelOverride: asString(record.modelOverride ?? record.model_override),
            providerOverride: asString(record.providerOverride ?? record.provider_override),
            modelProvider: asString(record.modelProvider ?? record.model_provider),
            model: asString(record.model),
            usage,
            contextWeight: asRecord(record.contextWeight ?? record.context_weight) ?? undefined,
          }
        })
        .filter(isNonNull)
    : []

  const normalizeAggregateRows = (entries: unknown): SessionModelUsage[] => {
    if (!Array.isArray(entries)) return []
    return entries
      .map((entry): SessionModelUsage | null => {
        const record = asRecord(entry)
        if (!record) return null
        return {
          provider: asString(record.provider) ?? null,
          model: asString(record.model) ?? null,
          count: numberFrom(record.count) ?? 0,
          totals: normalizeUsageTotals(record.totals ?? record),
        }
      })
      .filter(isNonNull)
  }

  const rawByAgent = Array.isArray(rawAggregates.byAgent)
    ? rawAggregates.byAgent
    : Array.isArray(rawAggregates.by_agent)
      ? rawAggregates.by_agent
      : []
  const rawByChannel = Array.isArray(rawAggregates.byChannel)
    ? rawAggregates.byChannel
    : Array.isArray(rawAggregates.by_channel)
      ? rawAggregates.by_channel
      : []

  return {
    updatedAt: numberFrom(source.updatedAt, source.updated_at) ?? Date.now(),
    startDate: asString(source.startDate ?? source.start_date) ?? new Date().toISOString().slice(0, 10),
    endDate: asString(source.endDate ?? source.end_date) ?? new Date().toISOString().slice(0, 10),
    sessions,
    totals,
    aggregates: {
      messages,
      tools,
      byModel: normalizeAggregateRows(rawAggregates.byModel ?? rawAggregates.by_model),
      byProvider: normalizeAggregateRows(rawAggregates.byProvider ?? rawAggregates.by_provider),
      byAgent: rawByAgent
        .map((entry): SessionsUsageResult['aggregates']['byAgent'][number] | null => {
              const record = asRecord(entry)
              if (!record) return null
              return {
                agentId: asString(record.agentId ?? record.agent_id) ?? 'unknown-agent',
                totals: normalizeUsageTotals(record.totals ?? record),
              }
            })
            .filter(isNonNull),
      byChannel: rawByChannel
            .map((entry): SessionsUsageResult['aggregates']['byChannel'][number] | null => {
              const record = asRecord(entry)
              if (!record) return null
              return {
                channel: asString(record.channel) ?? 'unknown-channel',
                totals: normalizeUsageTotals(record.totals ?? record),
              }
            })
            .filter(isNonNull),
      daily: Array.isArray(rawAggregates.daily)
        ? rawAggregates.daily
            .map((entry) => {
              const record = asRecord(entry)
              const date = asString(record?.date)
              if (!date) return null
              return {
                date,
                tokens: numberFrom(record?.tokens, record?.totalTokens, record?.total_tokens) ?? 0,
                cost: numberFrom(record?.cost, record?.totalCost, record?.total_cost) ?? 0,
                messages: numberFrom(record?.messages, record?.total, record?.messageCount, record?.message_count) ?? 0,
                toolCalls: numberFrom(record?.toolCalls, record?.toolCallCount, record?.tool_call_count) ?? 0,
                errors: numberFrom(record?.errors, record?.errorCount, record?.error_count) ?? 0,
              }
            })
            .filter((entry): entry is SessionsUsageResult['aggregates']['daily'][number] => entry !== null)
        : [],
    },
  }
}

export function normalizeUsageCostSummary(raw: UsageCostSummary): UsageCostSummary {
  const source = asRecord(raw) ?? {}
  return {
    updatedAt: numberFrom(source.updatedAt, source.updated_at) ?? Date.now(),
    days: numberFrom(source.days) ?? (Array.isArray(source.daily) ? source.daily.length : 0),
    daily: Array.isArray(source.daily)
      ? source.daily
          .map((entry) => {
            const record = asRecord(entry)
            const date = asString(record?.date)
            if (!date) return null
            return {
              ...normalizeUsageTotals(record),
              date,
            }
          })
          .filter((entry): entry is UsageCostSummary['daily'][number] => entry !== null)
      : [],
    totals: normalizeUsageTotals(source.totals ?? source),
  }
}

function normalizeChannelMeta(raw: unknown, fallbackId?: string): ChannelUiMeta | null {
  const source = asRecord(raw)
  if (!source) return null
  const id = asString(source.id) ?? fallbackId
  const label = asString(source.label)
  const detailLabel = asString(source.detailLabel ?? source.detail_label)
  if (!id || !label || !detailLabel) return null
  return {
    id,
    label,
    detailLabel,
    systemImage: asString(source.systemImage ?? source.system_image),
  }
}

function normalizeChannelAccount(raw: unknown): ChannelAccountSnapshot | null {
  const source = asRecord(raw)
  const accountId = asString(source?.accountId ?? source?.account_id)
  if (!source || !accountId) return null
  return {
    ...source,
    accountId,
    name: asString(source.name) ?? null,
    enabled: asBoolean(source.enabled),
    configured: asBoolean(source.configured),
    linked: asBoolean(source.linked),
    running: asBoolean(source.running),
    connected: asBoolean(source.connected),
    reconnectAttempts: numberFrom(source.reconnectAttempts, source.reconnect_attempts) ?? null,
    lastConnectedAt: numberFrom(source.lastConnectedAt, source.last_connected_at) ?? null,
    lastError: asString(source.lastError ?? source.last_error) ?? null,
    lastStartAt: numberFrom(source.lastStartAt, source.last_start_at) ?? null,
    lastStopAt: numberFrom(source.lastStopAt, source.last_stop_at) ?? null,
    lastInboundAt: numberFrom(source.lastInboundAt, source.last_inbound_at) ?? null,
    lastOutboundAt: numberFrom(source.lastOutboundAt, source.last_outbound_at) ?? null,
    lastProbeAt: numberFrom(source.lastProbeAt, source.last_probe_at) ?? null,
    mode: asString(source.mode) ?? null,
    dmPolicy: asString(source.dmPolicy ?? source.dm_policy) ?? null,
    allowFrom: asStringArray(source.allowFrom ?? source.allow_from) ?? null,
    tokenSource: asString(source.tokenSource ?? source.token_source) ?? null,
    botTokenSource: asString(source.botTokenSource ?? source.bot_token_source) ?? null,
    appTokenSource: asString(source.appTokenSource ?? source.app_token_source) ?? null,
    credentialSource: asString(source.credentialSource ?? source.credential_source) ?? null,
    audienceType: asString(source.audienceType ?? source.audience_type) ?? null,
    audience: asString(source.audience) ?? null,
    webhookPath: asString(source.webhookPath ?? source.webhook_path) ?? null,
    webhookUrl: asString(source.webhookUrl ?? source.webhook_url) ?? null,
    baseUrl: asString(source.baseUrl ?? source.base_url) ?? null,
    allowUnmentionedGroups: asBoolean(source.allowUnmentionedGroups ?? source.allow_unmentioned_groups),
    cliPath: asString(source.cliPath ?? source.cli_path) ?? null,
    dbPath: asString(source.dbPath ?? source.db_path) ?? null,
    port: numberFrom(source.port) ?? null,
  }
}

export function normalizeChannelsStatusResult(raw: ChannelsStatusResult): ChannelsStatusResult {
  const source = asRecord(raw) ?? {}
  const channelLabels = asRecord(source.channelLabels) ?? {}
  const channelDetailLabels = asRecord(source.channelDetailLabels ?? source.channel_detail_labels) ?? {}
  const channelSystemImages = asRecord(source.channelSystemImages ?? source.channel_system_images) ?? {}
  const channelOrder = Array.isArray(source.channelOrder)
    ? source.channelOrder.filter((entry): entry is string => typeof entry === 'string')
    : Object.keys(channelLabels)

  const rawMeta = source.channelMeta ?? source.channel_meta
  const rawMetaRecord = asRecord(rawMeta)
  const channelMeta = Array.isArray(rawMeta)
    ? rawMeta.map((entry) => normalizeChannelMeta(entry)).filter((entry): entry is ChannelUiMeta => entry !== null)
    : rawMetaRecord
      ? Object.entries(rawMetaRecord)
          .map(([channelId, meta]) => normalizeChannelMeta(meta, channelId))
          .filter((entry): entry is ChannelUiMeta => entry !== null)
      : channelOrder.map((channelId) => ({
          id: channelId,
          label: asString(channelLabels[channelId]) ?? channelId,
          detailLabel: asString(channelDetailLabels[channelId]) ?? (asString(channelLabels[channelId]) ?? channelId),
          systemImage: asString(channelSystemImages[channelId]),
        }))

  const channelAccountsSource = asRecord(source.channelAccounts ?? source.channel_accounts) ?? {}
  const channelAccounts = Object.fromEntries(
    Object.entries(channelAccountsSource).map(([channelId, accounts]) => [
      channelId,
      Array.isArray(accounts)
        ? accounts.map(normalizeChannelAccount).filter((entry): entry is ChannelAccountSnapshot => entry !== null)
        : [],
    ]),
  )

  const defaultAccountSource = asRecord(source.channelDefaultAccountId ?? source.channel_default_account_id) ?? {}
  const channelDefaultAccountId = Object.fromEntries(
    Object.entries(defaultAccountSource)
      .map(([channelId, accountId]) => [channelId, asString(accountId)])
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  )

  return {
    ts: numberFrom(source.ts) ?? Date.now(),
    channelOrder,
    channelLabels: Object.fromEntries(
      Object.entries(channelLabels)
        .map(([key, value]) => [key, asString(value)])
        .filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
    ),
    channelDetailLabels: Object.fromEntries(
      Object.entries(channelDetailLabels)
        .map(([key, value]) => [key, asString(value)])
        .filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
    ),
    channelSystemImages: Object.fromEntries(
      Object.entries(channelSystemImages)
        .map(([key, value]) => [key, asString(value)])
        .filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
    ),
    channelMeta,
    channels: asRecord(source.channels) ?? {},
    channelAccounts,
    channelDefaultAccountId,
  }
}
