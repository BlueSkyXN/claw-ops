import type {
  SessionCostSummary,
  SessionMessageCounts,
  SessionsUsageResult,
  UsageCostSummary,
  UsageTotals,
} from '../types/openclaw'

function asNumber(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

export function createEmptyUsageTotals(): UsageTotals {
  return {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 0,
    totalCost: 0,
    inputCost: 0,
    outputCost: 0,
    cacheReadCost: 0,
    cacheWriteCost: 0,
    missingCostEntries: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    reasoningTokens: 0,
    calls: 0,
    errors: 0,
    toolCalls: 0,
  }
}

export function mergeUsageTotals(target: UsageTotals, source: UsageTotals | null | undefined): UsageTotals {
  if (!source) return target
  target.input = asNumber(target.input) + asNumber(source.input)
  target.output = asNumber(target.output) + asNumber(source.output)
  target.cacheRead = asNumber(target.cacheRead) + asNumber(source.cacheRead)
  target.cacheWrite = asNumber(target.cacheWrite) + asNumber(source.cacheWrite)
  target.totalTokens += asNumber(source.totalTokens)
  target.totalCost += asNumber(source.totalCost)
  target.inputCost = asNumber(target.inputCost) + asNumber(source.inputCost)
  target.outputCost = asNumber(target.outputCost) + asNumber(source.outputCost)
  target.cacheReadCost = asNumber(target.cacheReadCost) + asNumber(source.cacheReadCost)
  target.cacheWriteCost = asNumber(target.cacheWriteCost) + asNumber(source.cacheWriteCost)
  target.missingCostEntries = asNumber(target.missingCostEntries) + asNumber(source.missingCostEntries)
  target.inputTokens = asNumber(target.inputTokens) + getInputTokens(source)
  target.outputTokens = asNumber(target.outputTokens) + getOutputTokens(source)
  target.cacheReadTokens = asNumber(target.cacheReadTokens) + getCacheReadTokens(source)
  target.cacheWriteTokens = asNumber(target.cacheWriteTokens) + getCacheWriteTokens(source)
  target.reasoningTokens = asNumber(target.reasoningTokens) + getReasoningTokens(source)
  target.calls = asNumber(target.calls) + asNumber(source.calls)
  target.errors = asNumber(target.errors) + asNumber(source.errors)
  target.toolCalls = asNumber(target.toolCalls) + asNumber(source.toolCalls)
  return target
}

export function getInputTokens(totals: UsageTotals | null | undefined): number {
  return asNumber(totals?.inputTokens ?? totals?.input)
}

export function getOutputTokens(totals: UsageTotals | null | undefined): number {
  return asNumber(totals?.outputTokens ?? totals?.output)
}

export function getCacheReadTokens(totals: UsageTotals | null | undefined): number {
  return asNumber(totals?.cacheReadTokens ?? totals?.cacheRead)
}

export function getCacheWriteTokens(totals: UsageTotals | null | undefined): number {
  return asNumber(totals?.cacheWriteTokens ?? totals?.cacheWrite)
}

export function getReasoningTokens(totals: UsageTotals | null | undefined): number {
  return asNumber(totals?.reasoningTokens)
}

export function getUsageCalls(
  totals: UsageTotals | null | undefined,
  messageCounts?: Pick<SessionMessageCounts, 'total'> | null,
): number {
  return asNumber(messageCounts?.total ?? totals?.calls)
}

export function getUsageErrors(
  totals: UsageTotals | null | undefined,
  messageCounts?: Pick<SessionMessageCounts, 'errors'> | null,
): number {
  return asNumber(messageCounts?.errors ?? totals?.errors)
}

export function getUsageToolCalls(
  totals: UsageTotals | null | undefined,
  messageCounts?: Pick<SessionMessageCounts, 'toolCalls'> | null,
): number {
  return asNumber(messageCounts?.toolCalls ?? totals?.toolCalls)
}

export function getMessageInbound(messages: SessionMessageCounts | null | undefined): number {
  return asNumber(messages?.inbound ?? messages?.user)
}

export function getMessageOutbound(messages: SessionMessageCounts | null | undefined): number {
  return asNumber(messages?.outbound ?? messages?.assistant)
}

export function getSessionUsageTotals(usage: SessionCostSummary | null | undefined): UsageTotals | null {
  if (!usage) return null
  return usage.totals ?? usage
}

export function buildUsageCostSummary(usage: SessionsUsageResult): UsageCostSummary {
  return {
    updatedAt: usage.updatedAt,
    days: usage.aggregates.daily.length,
    daily: usage.aggregates.daily.map((entry) => ({
      date: entry.date,
      totalTokens: entry.tokens,
      totalCost: entry.cost,
      calls: entry.messages,
      errors: entry.errors,
      toolCalls: entry.toolCalls,
    })),
    totals: usage.totals ?? usage,
  }
}
