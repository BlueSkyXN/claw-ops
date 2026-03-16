import type { MockExperienceSummary } from '../data/mock-workspace'
import type {
  ChannelsStatusResult,
  ExecApprovalRequest,
  NodeListNode,
  SessionsUsageResult,
} from '../types/openclaw'
import type { PresetLayer } from '../types/presets'
import type { LoadedExperiencePreset } from './orchestration'
import type { TrackedTask } from './task-tracker'

export interface HealthAlert {
  id: string
  severity: 'info' | 'warn' | 'critical'
  title: string
  detail: string
}

export interface OrchestrationHealth {
  overall: 'healthy' | 'degraded' | 'critical'
  score: number
  dimensions: {
    coverage: {
      layerCounts: Record<PresetLayer, number>
      missingLayers: PresetLayer[]
      workflowCoveragePercent: number
    }
    throughput: {
      totalTasks: number
      activeTasks: number
      waitingTasks: number
      completedLastHour: number
      perHour: number
    }
    latency: {
      medianActiveMinutes: number
      stalledTasks: number
      slowestAgentId: string | null
    }
    bottleneck: {
      busiestAgentId: string | null
      queueDepth: number
      pendingApprovals: number
    }
    cost: {
      avgTokensPerTask: number
      avgCostPerTask: number
      priciestAgentId: string | null
    }
  }
  alerts: HealthAlert[]
  suggestions: string[]
}

interface HealthInput {
  experience: MockExperienceSummary | null
  loadedExperience: LoadedExperiencePreset | null
  tasks: TrackedTask[]
  usage: SessionsUsageResult | null
  channels: ChannelsStatusResult | null
  nodes: NodeListNode[]
  approvals: ExecApprovalRequest[]
}

const emptyLayerCounts: Record<PresetLayer, number> = {
  L0: 0,
  L1: 0,
  L2: 0,
  L3: 0,
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((left, right) => left - right)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid]
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items))
}

export function analyzeOrchestrationHealth({
  experience,
  loadedExperience,
  tasks,
  usage,
  channels,
  nodes,
  approvals,
}: HealthInput): OrchestrationHealth | null {
  if (!experience && !loadedExperience && tasks.length === 0) return null

  const layerCounts = experience?.layerCounts ?? loadedExperience?.summary.layerCounts ?? emptyLayerCounts
  const missingLayers = (Object.keys(layerCounts) as PresetLayer[]).filter((layer) => (layerCounts[layer] ?? 0) <= 0)
  const usedRoles = unique(tasks.flatMap((task) => task.steps.map((step) => step.roleId)))
  const totalRoles = loadedExperience?.template.roles.length ?? experience?.roleIds.length ?? 0
  const workflowCoveragePercent = totalRoles > 0 ? Math.round((usedRoles.length / totalRoles) * 100) : 0

  const activeTasks = tasks.filter((task) => task.status === 'active' || task.status === 'blocked' || task.status === 'waiting')
  const waitingTasks = tasks.filter((task) => task.status === 'waiting').length
  const stalledTasks = tasks.filter((task) => task.status === 'stalled').length
  const completedLastHour = tasks.filter((task) => task.status === 'completed' && Date.now() - task.updatedAt <= 60 * 60_000).length
  const perHour = tasks.filter((task) => Date.now() - task.updatedAt <= 60 * 60_000).length

  const medianActiveMinutes = Math.round(median(activeTasks.map((task) => task.durationMs)) / 60_000)

  const agentLoad = new Map<string, number>()
  activeTasks.forEach((task) => {
    if (!task.currentAgentId) return
    agentLoad.set(task.currentAgentId, (agentLoad.get(task.currentAgentId) ?? 0) + 1)
  })
  const busiestAgent = [...agentLoad.entries()].sort((left, right) => right[1] - left[1])[0] ?? null
  const busiestAgentId = busiestAgent?.[0] ?? null
  const queueDepth = busiestAgent?.[1] ?? 0

  const offlineChannels = channels
    ? Object.entries(channels.channelAccounts).flatMap(([channelId, accounts]) =>
        accounts.some((account) => account.connected) ? [] : [channelId],
      )
    : []
  const offlineNodes = nodes.filter((node) => node.status !== 'online')

  const usageByAgent = [...(usage?.aggregates.byAgent ?? [])].sort((left, right) => right.totals.totalCost - left.totals.totalCost)
  const priciestAgentId = usageByAgent[0]?.agentId ?? null
  const totalTokens = tasks.reduce((sum, task) => sum + task.totalTokens, 0)
  const totalCost = tasks.reduce((sum, task) => sum + task.totalCost, 0)
  const avgTokensPerTask = tasks.length > 0 ? Math.round(totalTokens / tasks.length) : 0
  const avgCostPerTask = tasks.length > 0 ? +(totalCost / tasks.length).toFixed(4) : 0

  const slowestAgent = [...new Map(
    activeTasks
      .filter((task) => task.currentAgentId)
      .map((task) => [task.currentAgentId as string, task.durationMs]),
  ).entries()].sort((left, right) => right[1] - left[1])[0] ?? null

  const alerts: HealthAlert[] = []
  const suggestions = new Set<string>()

  if (missingLayers.length > 0) {
    alerts.push({
      id: 'missing-layers',
      severity: 'warn',
      title: '组织层级未完全覆盖',
      detail: `缺少 ${missingLayers.join(' / ')} 能力层，复杂任务可能无法闭环。`,
    })
    suggestions.add('从预设中补齐缺失层级，让治理、决策、协调、执行形成完整链路。')
  }

  if (approvals.length > 0) {
    alerts.push({
      id: 'approval-backlog',
      severity: approvals.length >= 3 ? 'critical' : 'warn',
      title: '审批积压',
      detail: `当前有 ${approvals.length} 个待处理审批请求，可能阻塞任务推进。`,
    })
    suggestions.add('优先清理待审批事项，避免 mandatory checks 成为吞吐瓶颈。')
  }

  if (stalledTasks > 0) {
    alerts.push({
      id: 'stalled-tasks',
      severity: 'warn',
      title: '存在停滞任务',
      detail: `${stalledTasks} 个任务在最近 45 分钟内没有新进展。`,
    })
    suggestions.add('对停滞任务执行催办或重派，并检查当前负责角色是否过载。')
  }

  if (offlineChannels.length > 0) {
    alerts.push({
      id: 'offline-channels',
      severity: 'warn',
      title: '入口渠道离线',
      detail: `${offlineChannels.join('、')} 当前没有在线账号，可能影响任务入口与反馈回路。`,
    })
    suggestions.add('优先恢复离线渠道，确保需求入口和状态回传保持可用。')
  }

  if (offlineNodes.length > 0) {
    alerts.push({
      id: 'offline-nodes',
      severity: 'info',
      title: '部分节点不在线',
      detail: `${offlineNodes.length} 个运行节点处于非在线状态，观察是否影响执行弹性。`,
    })
    suggestions.add('检查运行节点可用性，避免单节点过载导致编排韧性下降。')
  }

  if (queueDepth >= 2 && busiestAgentId) {
    alerts.push({
      id: 'busiest-agent',
      severity: queueDepth >= 3 ? 'critical' : 'warn',
      title: '单角色负载偏高',
      detail: `${busiestAgentId} 当前承接 ${queueDepth} 个活跃任务，存在排队风险。`,
    })
    suggestions.add('考虑为热点角色降级模型、拆分责任，或通过重派缓解集中负载。')
  }

  let score = 100
  score -= missingLayers.length * 10
  score -= approvals.length * 6
  score -= stalledTasks * 12
  score -= tasks.filter((task) => task.status === 'failed').length * 16
  score -= offlineChannels.length * 6
  score -= offlineNodes.length * 4
  if (queueDepth >= 2) score -= 8
  score = Math.max(0, Math.min(100, score))

  const overall = score >= 82 ? 'healthy' : score >= 58 ? 'degraded' : 'critical'

  if (score >= 90 && suggestions.size === 0) {
    suggestions.add('保持当前编排节奏，继续利用审批与复盘信息优化模型成本与角色分工。')
  }

  return {
    overall,
    score,
    dimensions: {
      coverage: {
        layerCounts,
        missingLayers,
        workflowCoveragePercent,
      },
      throughput: {
        totalTasks: tasks.length,
        activeTasks: activeTasks.length,
        waitingTasks,
        completedLastHour,
        perHour,
      },
      latency: {
        medianActiveMinutes,
        stalledTasks,
        slowestAgentId: slowestAgent?.[0] ?? null,
      },
      bottleneck: {
        busiestAgentId,
        queueDepth,
        pendingApprovals: approvals.length,
      },
      cost: {
        avgTokensPerTask,
        avgCostPerTask,
        priciestAgentId,
      },
    },
    alerts,
    suggestions: Array.from(suggestions),
  }
}
