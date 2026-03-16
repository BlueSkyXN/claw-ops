import { loadConfig } from './config'
import {
  deployTeam,
  loadManifest,
  loadRoleDetail,
  loadTeamTemplate,
  type PresetRoleDetail,
} from './presets'
import {
  applyMockWorkspaceSeed,
  deriveUsageFromSessions,
  type MockExperienceSummary,
  type MockQuickStartSummary,
  type MockWorkspaceSeed,
} from '../data/mock-workspace'
import type {
  AgentSummary,
  ChannelAccountSnapshot,
  ChannelsStatusResult,
  CronJob,
  CronRunLogEntry,
  ExecApprovalRequest,
  GatewaySessionRow,
  LogEntry,
  NodeListNode,
  PresenceEntry,
  SessionsListResult,
  SessionsUsageResult,
  SkillEntry,
  Snapshot,
} from '../types/openclaw'
import type { PresetLayer, PresetLibraryManifest, PresetTeamTemplate } from '../types/presets'

type LayerId = 'L0' | 'L1' | 'L2' | 'L3'

interface ChannelBlueprint {
  id: string
  label: string
  detailLabel: string
  systemImage: string
  accountId: string
  accountName: string
  connected?: boolean
  activeRuns?: number
}

export interface ExperienceQuickStart {
  id: string
  title: string
  user: string
  channel: string
  prompt: string
  outcome: string
  ownerRoleId: string
}

interface ExperiencePresetMeta {
  title: string
  tagline: string
  description: string
  promise: string
  audience: string
  accentClass: string
  channelBlueprints: ChannelBlueprint[]
  quickStarts: ExperienceQuickStart[]
  cronBlueprints: Array<{ id: string; name: string; description: string; agentId: string; at?: string; everyMs?: number }>
}

export interface ExperiencePresetSummary {
  id: string
  name: string
  description: string
  tagline: string
  promise: string
  audience: string
  accentClass: string
  roleCount: number
  handoffCount: number
  layerCounts: Record<LayerId, number>
  quickStarts: ExperienceQuickStart[]
  channelBlueprints: ChannelBlueprint[]
}

export interface LoadedExperiencePreset {
  summary: ExperiencePresetSummary
  manifest: PresetLibraryManifest
  template: PresetTeamTemplate
  roles: PresetRoleDetail[]
  rolesByLayer: Record<LayerId, PresetRoleDetail[]>
}

const PRESET_ORDER = [
  'opc-super-assistant',
  'product-delivery-squad',
  'full-enterprise-command-center',
  'governance-review-cell',
] as const

const EXPERIENCE_META: Record<string, ExperiencePresetMeta> = {
  'opc-super-assistant': {
    title: 'OPC 超级助理',
    tagline: '把策略、产品、研发、内容、运营和复盘压缩成一个随时待命的 AI 团队。',
    description: '面向一人公司/独立开发者/超级个体的开箱即用团队模板，默认围绕需求分流、方案设计、工程交付、内容触达与经营复盘展开混合编排。',
    promise: '3 次点击完成导入，马上体验像 Coze / Dify 工作流一样的多 Agent 混合调度。',
    audience: '创始人 / 独立开发者 / 超级个体',
    accentClass: 'from-brand-500 via-accent-purple to-accent-cyan',
    channelBlueprints: [
      { id: 'telegram', label: 'Telegram', detailLabel: 'Founder Inbox', systemImage: '📱', accountId: 'opc-telegram', accountName: 'Founder Bot', connected: true, activeRuns: 3 },
      { id: 'web', label: 'Web', detailLabel: 'Landing Chat', systemImage: '🌐', accountId: 'opc-web', accountName: 'Website Concierge', connected: true, activeRuns: 2 },
      { id: 'api', label: 'API', detailLabel: 'Automation Hooks', systemImage: '🔌', accountId: 'opc-api', accountName: 'Workflow Hooks', connected: true, activeRuns: 4 },
      { id: 'feishu', label: '飞书', detailLabel: 'Execution War Room', systemImage: '🐦', accountId: 'opc-feishu', accountName: 'Founder Ops', connected: true, activeRuns: 1 },
    ],
    quickStarts: [
      {
        id: 'founder-idea',
        title: '创始人新想法分流',
        user: 'Founder',
        channel: 'telegram',
        prompt: '我想在 48 小时内上线一个 AI 营销登陆页，帮我拆需求、排优先级、给上线方案。',
        outcome: '自动拆到策略、方案、研发、内容与上线复盘，形成可执行计划。',
        ownerRoleId: 'dispatch-director',
      },
      {
        id: 'lead-capture',
        title: '潜在客户线索转化',
        user: 'Growth Lead',
        channel: 'web',
        prompt: '新访客留下了对定制 AI 客服的需求，请给出产品方案、报价思路和跟进内容。',
        outcome: '生成售前方案摘要、行动清单与内容跟进脚本。',
        ownerRoleId: 'strategy-advisor',
      },
      {
        id: 'ops-fire',
        title: '线上告警自动协同',
        user: 'Ops Watcher',
        channel: 'api',
        prompt: '生产环境支付 webhook 出现抖动，请先止损再给出修复、验证与对外同步方案。',
        outcome: '触发工程、运维、质量三方并行处理并沉淀复盘。',
        ownerRoleId: 'program-manager',
      },
    ],
    cronBlueprints: [
      { id: 'opc-daily-pulse', name: '经营脉搏晨报', description: '每天生成创始人晨报，汇总线索、版本、告警和现金流信号。', agentId: 'data-analyst', at: '08:30' },
      { id: 'opc-content-recycle', name: '内容再利用流水线', description: '把本周交付沉淀成案例、FAQ 和渠道内容。', agentId: 'content-strategist', everyMs: 6 * 3600_000 },
      { id: 'opc-quality-sweep', name: '上线质量巡检', description: '每日自动对近期变更执行质量抽检。', agentId: 'quality-director', at: '21:00' },
    ],
  },
  'product-delivery-squad': {
    title: '产品交付战队',
    tagline: '让产品需求从 intake 到 release 全链路可视、可交付、可复盘。',
    description: '偏向产品/研发团队的交付协同模板，保留质量与安全门禁，适合展示复杂需求如何被拆解并并行落地。',
    promise: '一键导入即可看到需求分发、方案评审、开发交付与上线复盘的完整链路。',
    audience: '产品团队 / 研发团队 / 交付团队',
    accentClass: 'from-accent-blue via-brand-500 to-accent-green',
    channelBlueprints: [
      { id: 'feishu', label: '飞书', detailLabel: '产品协作群', systemImage: '🐦', accountId: 'delivery-feishu', accountName: 'Delivery Room', connected: true, activeRuns: 2 },
      { id: 'slack', label: 'Slack', detailLabel: 'Engineering Channel', systemImage: '💬', accountId: 'delivery-slack', accountName: 'Build Ops', connected: true, activeRuns: 2 },
      { id: 'api', label: 'API', detailLabel: 'CI/CD Events', systemImage: '🔌', accountId: 'delivery-api', accountName: 'Pipeline Trigger', connected: true, activeRuns: 3 },
    ],
    quickStarts: [
      { id: 'prd-split', title: '复杂需求拆解', user: 'PM Alice', channel: 'feishu', prompt: '帮我把跨端 dashboard 升级需求拆成技术方案、排期和质量门禁。', outcome: '生成 PRD 执行计划与角色分工。', ownerRoleId: 'dispatch-director' },
      { id: 'incident-hotfix', title: '热修复协同', user: 'Incident Commander', channel: 'api', prompt: '线上支付页异常，需要快速修复并安排回归。', outcome: '自动路由到工程、运维和质量链路。', ownerRoleId: 'engineering-lead' },
      { id: 'release-readiness', title: '发布准备检查', user: 'QA Eva', channel: 'slack', prompt: '今晚发版前需要一份可发布检查清单和风险摘要。', outcome: '输出发布门禁结果和回滚建议。', ownerRoleId: 'quality-director' },
    ],
    cronBlueprints: [
      { id: 'delivery-plan', name: '每日交付站会', description: '输出跨角色交付进度与阻塞。', agentId: 'program-manager', at: '10:00' },
      { id: 'delivery-release', name: '发布健康巡检', description: '发布窗口前自动校验环境与质量门禁。', agentId: 'platform-ops', at: '18:00' },
    ],
  },
  'full-enterprise-command-center': {
    title: '企业级超级编排中心',
    tagline: '四层组织完整上阵，把治理、策略、协调与执行全部放上同一块画布。',
    description: '完整展示 OpenClaw 预设资产的旗舰模板，适合强调平台能力上限、治理能力和跨职能协同。',
    promise: '一次导入 15 个角色，瞬间看到企业级多 Agent 混合编排的全貌。',
    audience: '平台演示 / 企业售前 / 管理驾驶舱',
    accentClass: 'from-accent-purple via-brand-500 to-accent-orange',
    channelBlueprints: [
      { id: 'telegram', label: 'Telegram', detailLabel: 'Executive Inbox', systemImage: '📱', accountId: 'ecc-telegram', accountName: 'Executive Bot', connected: true, activeRuns: 2 },
      { id: 'feishu', label: '飞书', detailLabel: 'Program Office', systemImage: '🐦', accountId: 'ecc-feishu', accountName: 'PMO Desk', connected: true, activeRuns: 3 },
      { id: 'discord', label: 'Discord', detailLabel: 'Community Ops', systemImage: '🎮', accountId: 'ecc-discord', accountName: 'Community Relay', connected: true, activeRuns: 1 },
      { id: 'api', label: 'API', detailLabel: 'Business Automation', systemImage: '🔌', accountId: 'ecc-api', accountName: 'Ops Automation', connected: true, activeRuns: 4 },
      { id: 'slack', label: 'Slack', detailLabel: 'Engineering Ops', systemImage: '💬', accountId: 'ecc-slack', accountName: 'Delivery Hub', connected: true, activeRuns: 2 },
    ],
    quickStarts: [
      { id: 'board-request', title: '董事会级任务派发', user: 'COO Mia', channel: 'telegram', prompt: '我们要上线一个跨区域合规的新产品，请给我完整推进方案与治理链路。', outcome: '自动触发治理、策略、架构、交付与合规链路。', ownerRoleId: 'dispatch-director' },
      { id: 'security-escalation', title: '高风险安全变更', user: 'Security Desk', channel: 'api', prompt: '检测到外部接口权限模型变化，需要安全与合规联审。', outcome: '拉起质量、安全、合规与工程闭环。', ownerRoleId: 'security-officer' },
      { id: 'launch-war-room', title: '发布战情室', user: 'Program Office', channel: 'feishu', prompt: '下周要举行大型版本发布，请准备跨团队编排与质量门禁。', outcome: '产出发布计划、升级路径与同步脚本。', ownerRoleId: 'program-manager' },
    ],
    cronBlueprints: [
      { id: 'ecc-governance', name: '治理周检', description: '定期执行质量、安全、合规三线联合审查。', agentId: 'quality-director', everyMs: 24 * 3600_000 },
      { id: 'ecc-pulse', name: '编排健康脉搏', description: '输出全局编排健康度与阻塞升级。', agentId: 'dispatch-director', at: '09:00' },
    ],
  },
  'governance-review-cell': {
    title: '治理审查单元',
    tagline: '把质量、安全、合规作为内建门禁，而不是上线前最后一秒的补丁。',
    description: '强调治理层与风险控制的模板，适合展示多门禁、多升级路径的编排能力。',
    promise: '快速体验治理层如何对复杂任务形成审查闭环。',
    audience: '治理团队 / 安全团队 / 合规团队',
    accentClass: 'from-accent-red via-accent-yellow to-brand-500',
    channelBlueprints: [
      { id: 'slack', label: 'Slack', detailLabel: 'Review Cell', systemImage: '💬', accountId: 'gov-slack', accountName: 'Review Desk', connected: true, activeRuns: 2 },
      { id: 'api', label: 'API', detailLabel: 'Policy Events', systemImage: '🔌', accountId: 'gov-api', accountName: 'Policy Hooks', connected: true, activeRuns: 2 },
    ],
    quickStarts: [
      { id: 'policy-change', title: '政策变更审查', user: 'Risk Office', channel: 'api', prompt: '新的隐私政策上线前，请完成风险审查并给出放行建议。', outcome: '生成审查意见、风险清单与升级决策。', ownerRoleId: 'compliance-officer' },
      { id: 'security-review', title: '安全边界复核', user: 'Infra Team', channel: 'slack', prompt: '我们要开放一个新的 webhook，需要质量、安全、法律联合把关。', outcome: '形成联审结果与上线建议。', ownerRoleId: 'security-officer' },
    ],
    cronBlueprints: [
      { id: 'gov-cell-review', name: '治理快审', description: '定时对高风险变更进行复核。', agentId: 'compliance-officer', at: '15:00' },
    ],
  },
}

const channelEmoji: Record<string, string> = {
  telegram: '📱',
  feishu: '🐦',
  slack: '💬',
  discord: '🎮',
  api: '🔌',
  web: '🌐',
}

const experienceCache = new Map<string, Promise<LoadedExperiencePreset>>()
const summariesCache = new Map<string, ExperiencePresetSummary>()

function emptyLayerCounts(): Record<LayerId, number> {
  return { L0: 0, L1: 0, L2: 0, L3: 0 }
}

function countLayers(roleIds: string[], manifest: PresetLibraryManifest): Record<LayerId, number> {
  const counts = emptyLayerCounts()
  roleIds.forEach((roleId) => {
    const role = manifest.roles.find((entry) => entry.id === roleId)
    if (role && role.layer in counts) {
      counts[role.layer as LayerId] += 1
    }
  })
  return counts
}

function presetMeta(templateId: string, template: PresetTeamTemplate): ExperiencePresetMeta {
  const configured = EXPERIENCE_META[templateId]
  if (configured) return configured

  return {
    title: template.name,
    tagline: template.description,
    description: template.description,
    promise: '导入后立即查看团队工作流与编排画布。',
    audience: '平台体验',
    accentClass: 'from-brand-500 to-accent-cyan',
    channelBlueprints: [
      { id: 'api', label: 'API', detailLabel: 'Automation Hooks', systemImage: '🔌', accountId: `${templateId}-api`, accountName: `${template.name} Hooks`, connected: true, activeRuns: 1 },
    ],
    quickStarts: [
      {
        id: `${templateId}-quickstart`,
        title: '团队快速体验',
        user: 'Operator',
        channel: 'api',
        prompt: `请基于 ${template.name} 模板处理一个复杂的跨角色任务。`,
        outcome: '输出跨角色执行摘要。',
        ownerRoleId: template.roles[0] ?? 'dispatch-director',
      },
    ],
    cronBlueprints: [],
  }
}

function modelForTier(role: PresetRoleDetail): { model: string; provider: string } {
  switch (role.manifest.modelTier) {
    case 'reasoning':
      return { model: 'claude-opus-4-20250514', provider: 'anthropic' }
    case 'fast':
      return { model: 'gpt-4o-mini', provider: 'openai' }
    default:
      return { model: 'claude-sonnet-4-20250514', provider: 'anthropic' }
  }
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function groupRolesByLayer(roles: PresetRoleDetail[]): Record<LayerId, PresetRoleDetail[]> {
  return roles.reduce<Record<LayerId, PresetRoleDetail[]>>((acc, role) => {
    const layer = role.manifest.layer as LayerId
    acc[layer].push(role)
    return acc
  }, { L0: [], L1: [], L2: [], L3: [] })
}

function buildExperienceSummary(
  templateId: string,
  manifest: PresetLibraryManifest,
  template: PresetTeamTemplate,
): ExperiencePresetSummary {
  const meta = presetMeta(templateId, template)
  return {
    id: template.id,
    name: meta.title,
    description: meta.description,
    tagline: meta.tagline,
    promise: meta.promise,
    audience: meta.audience,
    accentClass: meta.accentClass,
    roleCount: template.roles.length,
    handoffCount: template.workflow.length,
    layerCounts: countLayers(template.roles, manifest),
    quickStarts: meta.quickStarts,
    channelBlueprints: meta.channelBlueprints,
  }
}

export async function listExperiencePresets(): Promise<ExperiencePresetSummary[]> {
  const manifest = await loadManifest()
  const templates = await Promise.all(manifest.teamTemplates.map((teamTemplate) => loadTeamTemplate(teamTemplate.id)))

  const summaries = templates.map((template) => {
    const summary = buildExperienceSummary(template.id, manifest, template)
    summariesCache.set(template.id, summary)
    return summary
  })

  return summaries.sort((left, right) => {
    const leftIndex = PRESET_ORDER.indexOf(left.id as (typeof PRESET_ORDER)[number])
    const rightIndex = PRESET_ORDER.indexOf(right.id as (typeof PRESET_ORDER)[number])
    return (leftIndex === -1 ? 999 : leftIndex) - (rightIndex === -1 ? 999 : rightIndex)
  })
}

export async function loadExperiencePreset(templateId: string): Promise<LoadedExperiencePreset> {
  const cached = experienceCache.get(templateId)
  if (cached) return cached

  const promise = (async () => {
    const manifest = await loadManifest()
    const template = await loadTeamTemplate(templateId)
    const roles = await Promise.all(template.roles.map((roleId) => loadRoleDetail(roleId)))
    const summary = summariesCache.get(templateId) ?? buildExperienceSummary(templateId, manifest, template)
    const rolesByLayer = groupRolesByLayer(roles)
    return { summary, manifest, template, roles, rolesByLayer }
  })()

  experienceCache.set(templateId, promise)
  return promise
}

function buildAgents(roles: PresetRoleDetail[]): { agents: AgentSummary[]; agentFiles: Record<string, Record<string, string>> } {
  const agents: AgentSummary[] = roles.map((role) => ({
    id: role.manifest.id,
    name: role.manifest.name,
    identity: {
      name: role.manifest.name,
      emoji: role.manifest.emoji,
      theme: `${role.manifest.layer} · ${role.manifest.layerName}`,
    },
  }))

  const agentFiles = roles.reduce<Record<string, Record<string, string>>>((acc, role) => {
    acc[role.manifest.id] = {
      'SOUL.md': role.soulContent,
      'workflow.json': JSON.stringify(role.workflow, null, 2),
      'authority.json': JSON.stringify(role.authority, null, 2),
      'capabilities.json': JSON.stringify(role.capabilities, null, 2),
    }
    return acc
  }, {})

  return { agents, agentFiles }
}

function buildChannels(summary: ExperiencePresetSummary): ChannelsStatusResult {
  const now = Date.now()
  const channelAccounts = summary.channelBlueprints.reduce<Record<string, ChannelAccountSnapshot[]>>((acc, channel) => {
    acc[channel.id] = [
      {
        accountId: channel.accountId,
        name: channel.accountName,
        enabled: true,
        configured: true,
        linked: true,
        running: channel.connected ?? true,
        connected: channel.connected ?? true,
        lastConnectedAt: now - 5 * 60_000,
        lastInboundAt: now - 10 * 60_000,
        lastOutboundAt: now - 4 * 60_000,
        activeRuns: channel.activeRuns ?? 1,
      },
    ]
    return acc
  }, {})

  return {
    ts: now,
    channelOrder: summary.channelBlueprints.map((channel) => channel.id),
    channelLabels: summary.channelBlueprints.reduce<Record<string, string>>((acc, channel) => {
      acc[channel.id] = channel.label
      return acc
    }, {}),
    channelDetailLabels: summary.channelBlueprints.reduce<Record<string, string>>((acc, channel) => {
      acc[channel.id] = channel.detailLabel
      return acc
    }, {}),
    channelMeta: summary.channelBlueprints.map((channel) => ({
      id: channel.id,
      label: channel.label,
      detailLabel: channel.detailLabel,
      systemImage: channel.systemImage,
    })),
    channels: summary.channelBlueprints.reduce<Record<string, unknown>>((acc, channel) => {
      acc[channel.id] = {}
      return acc
    }, {}),
    channelAccounts,
    channelDefaultAccountId: summary.channelBlueprints.reduce<Record<string, string>>((acc, channel) => {
      acc[channel.id] = channel.accountId
      return acc
    }, {}),
  }
}

function findRole(roleId: string, roles: PresetRoleDetail[]): PresetRoleDetail {
  const role = roles.find((entry) => entry.manifest.id === roleId)
  if (!role) {
    throw new Error(`Role ${roleId} not found in loaded experience`)
  }
  return role
}

type WorkflowStep = PresetTeamTemplate['workflow'][number]

type GeneratedTaskScenarioStep = WorkflowStep & {
  sessionKey: string
  updatedAt: number
  totalTokens: number
  state: 'running' | 'waiting' | 'completed'
}

interface GeneratedTaskScenario {
  id: string
  quickStart: ExperienceQuickStart
  owner: PresetRoleDetail
  rootSessionKey: string
  rootUpdatedAt: number
  rootTotalTokens: number
  status: 'active' | 'waiting' | 'completed'
  steps: GeneratedTaskScenarioStep[]
}

function collectWorkflowSteps(workflow: PresetTeamTemplate['workflow'], ownerRoleId: string): PresetTeamTemplate['workflow'] {
  const reachable = new Set<string>([ownerRoleId])
  const selected: PresetTeamTemplate['workflow'] = []

  let changed = true
  while (changed) {
    changed = false
    workflow.forEach((step) => {
      const stepKey = `${step.from}->${step.to}`
      if (!reachable.has(step.from) || selected.some((entry) => `${entry.from}->${entry.to}` === stepKey)) {
        return
      }
      selected.push(step)
      if (!reachable.has(step.to)) {
        reachable.add(step.to)
        changed = true
      }
    })
  }

  return selected
}

function buildTaskScenarios(
  summary: ExperiencePresetSummary,
  template: PresetTeamTemplate,
  roles: PresetRoleDetail[],
): GeneratedTaskScenario[] {
  const now = Date.now()
  const profiles: Array<'active' | 'waiting' | 'completed'> = ['active', 'waiting', 'completed']

  return summary.quickStarts.map((quickStart, index) => {
    const owner = findRole(quickStart.ownerRoleId, roles)
    const taskSlug = slug(quickStart.id)
    const workflowSteps = collectWorkflowSteps(template.workflow, owner.manifest.id)
    const profile = profiles[index % profiles.length]
    const startedAt = now - (index * 36 + 28) * 60_000
    const progressIndex = workflowSteps.length === 0
      ? 0
      : profile === 'completed'
        ? workflowSteps.length - 1
        : profile === 'waiting'
          ? Math.max(0, workflowSteps.findIndex((step) => step.mandatory))
          : Math.min(1, workflowSteps.length - 1)
    const rootSessionKey = `sess-${quickStart.channel}-${slug(quickStart.user)}-${taskSlug}-${owner.manifest.id}`

    const steps = workflowSteps
      .filter((_, stepIndex) => stepIndex <= progressIndex)
      .map((step, stepIndex) => {
        const isCurrent = stepIndex === progressIndex
        return {
          ...step,
          sessionKey: `sess-api-${taskSlug}-${step.from}-${step.to}`,
          updatedAt: startedAt + (stepIndex + 1) * 6 * 60_000,
          totalTokens: 9000 + stepIndex * 2400 + index * 1700,
          state: profile === 'completed'
            ? 'completed'
            : isCurrent
              ? profile === 'waiting'
                ? 'waiting'
                : 'running'
              : 'completed',
        } as GeneratedTaskScenarioStep
      })

    return {
      id: quickStart.id,
      quickStart,
      owner,
      rootSessionKey,
      rootUpdatedAt: startedAt,
      rootTotalTokens: 32000 + roles.length * 1800 + index * 5400,
      status: profile,
      steps,
    }
  })
}

function buildSessions(
  summary: ExperiencePresetSummary,
  template: PresetTeamTemplate,
  roles: PresetRoleDetail[],
): SessionsListResult {
  const now = Date.now()
  const sessions: GatewaySessionRow[] = []
  const taskScenarios = buildTaskScenarios(summary, template, roles)

  taskScenarios.forEach((scenario) => {
    const ownerModel = modelForTier(scenario.owner)
    sessions.push({
      key: scenario.rootSessionKey,
      kind: 'direct',
      label: scenario.quickStart.title,
      displayName: scenario.quickStart.user,
      channel: scenario.quickStart.channel,
      updatedAt: scenario.rootUpdatedAt,
      totalTokens: scenario.rootTotalTokens,
      inputTokens: Math.round(scenario.rootTotalTokens * 0.44),
      outputTokens: Math.round(scenario.rootTotalTokens * 0.56),
      model: ownerModel.model,
      modelProvider: ownerModel.provider,
      lastMessagePreview: scenario.quickStart.outcome,
      sendPolicy: 'allow',
      reasoningLevel: scenario.owner.manifest.modelTier,
      contextTokens: 200000,
      responseUsage: 'full',
    })

    scenario.steps.forEach((step) => {
      const fromRole = findRole(step.from, roles)
      const toRole = findRole(step.to, roles)
      const model = modelForTier(toRole)
      sessions.push({
        key: step.sessionKey,
        kind: 'direct',
        label: `${scenario.quickStart.title} · ${fromRole.manifest.name} → ${toRole.manifest.name}`,
        displayName: fromRole.manifest.name,
        channel: 'api',
        updatedAt: step.updatedAt,
        totalTokens: step.totalTokens,
        inputTokens: Math.round(step.totalTokens * 0.4),
        outputTokens: Math.round(step.totalTokens * 0.6),
        model: model.model,
        modelProvider: model.provider,
        lastMessagePreview: step.state === 'waiting'
          ? `等待门禁：${step.condition}`
          : step.state === 'running'
            ? `正在推进：${step.condition}`
            : `已完成：${step.condition}`,
        sendPolicy: step.state === 'waiting' ? 'deny' : 'allow',
        thinkingLevel: step.mandatory ? 'deep' : 'standard',
        reasoningLevel: toRole.manifest.modelTier,
        contextTokens: 200000,
        responseUsage: 'tokens',
      })
    })
  })

  sessions.push({
    key: `sess-main-${template.id}-${template.roles[0]}`,
    kind: 'global',
    label: `${summary.name} 主控台`,
    updatedAt: now - 3 * 60_000,
    totalTokens: 124000,
    inputTokens: 51000,
    outputTokens: 73000,
    model: 'claude-sonnet-4-20250514',
    modelProvider: 'anthropic',
    lastMessagePreview: '编排已激活，等待新的目标进入 intake。',
    sendPolicy: 'allow',
    responseUsage: 'full',
    contextTokens: 200000,
  })

  return {
    ts: now,
    path: '~/.openclaw/sessions',
    count: sessions.length,
    defaults: {
      modelProvider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      contextTokens: 200000,
    },
    sessions,
  }
}

function buildSkills(manifest: PresetLibraryManifest, roles: PresetRoleDetail[]): SkillEntry[] {
  const requiredSkills = new Set(roles.flatMap((role) => role.capabilities.requiredSkills))
  return manifest.skills.map((skill) => ({
    name: skill.id,
    version: skill.version,
    status: requiredSkills.has(skill.id) ? 'installed' : 'available',
    description: skill.name,
  }))
}

function buildLogs(
  summary: ExperiencePresetSummary,
  template: PresetTeamTemplate,
  roles: PresetRoleDetail[],
): LogEntry[] {
  const now = Date.now()
  const entries: LogEntry[] = []
  const taskScenarios = buildTaskScenarios(summary, template, roles)

  taskScenarios.forEach((scenario, index) => {
    entries.push({
      ts: scenario.rootUpdatedAt,
      level: 'info',
      source: `channel:${scenario.quickStart.channel}`,
      message: `${scenario.quickStart.user} 发起场景：${scenario.quickStart.title}`,
      raw: `[${new Date(scenario.rootUpdatedAt).toISOString()}] INFO channel:${scenario.quickStart.channel}: ${scenario.quickStart.user} 发起场景：${scenario.quickStart.title}`,
    })

    scenario.steps.forEach((step) => {
      const fromRole = findRole(step.from, roles)
      const toRole = findRole(step.to, roles)
      entries.push({
        ts: step.updatedAt,
        level: step.state === 'waiting' ? 'warn' : step.mandatory ? 'info' : 'debug',
        source: `agent:${fromRole.manifest.id}`,
        message: step.state === 'waiting'
          ? `${scenario.quickStart.title} 等待 ${toRole.manifest.name} 门禁：${step.condition}`
          : `已将任务移交给 ${toRole.manifest.name}：${step.condition}`,
        raw: `[${new Date(step.updatedAt).toISOString()}] ${step.state === 'waiting' ? 'WARN' : 'INFO'} agent:${fromRole.manifest.id}: ${step.state === 'waiting' ? `${scenario.quickStart.title} 等待 ${toRole.manifest.name} 门禁：${step.condition}` : `已将任务移交给 ${toRole.manifest.name}：${step.condition}`}`,
      })
    })

    entries.push({
      ts: now - index * 3 * 60_000,
      level: scenario.status === 'completed' ? 'info' : 'debug',
      source: `agent:${scenario.owner.manifest.id}`,
      message: scenario.status === 'completed'
        ? `${scenario.quickStart.title} 已形成可交付结果`
        : `${scenario.quickStart.title} 当前由 ${scenario.owner.manifest.name} 继续推进`,
      raw: `[${new Date(now - index * 3 * 60_000).toISOString()}] INFO agent:${scenario.owner.manifest.id}: ${scenario.status === 'completed' ? `${scenario.quickStart.title} 已形成可交付结果` : `${scenario.quickStart.title} 当前由 ${scenario.owner.manifest.name} 继续推进`}`,
    })
  })

  entries.push({
    ts: now - 2 * 60_000,
    level: 'info',
    source: 'gateway',
    message: `${summary.name} 编排模板已激活`,
    raw: `[${new Date(now - 2 * 60_000).toISOString()}] INFO gateway: ${summary.name} 编排模板已激活`,
  })

  return entries.sort((left, right) => right.ts - left.ts)
}

function buildCronArtifacts(
  summary: ExperiencePresetSummary,
  meta: ExperiencePresetMeta,
): { cronJobs: CronJob[]; cronRuns: CronRunLogEntry[] } {
  const now = Date.now()
  const cronJobs: CronJob[] = meta.cronBlueprints.map((blueprint, index) => ({
    id: blueprint.id,
    name: blueprint.name,
    enabled: true,
    schedule: blueprint.at
      ? { kind: 'at', at: blueprint.at }
      : { kind: 'every', everyMs: blueprint.everyMs ?? 4 * 3600_000 },
    payload: {
      kind: 'agentTurn',
      message: blueprint.description,
      deliver: true,
      channel: summary.channelBlueprints[0]?.id,
    },
    agentId: blueprint.agentId,
    description: blueprint.description,
    nextRunAtMs: now + (index + 1) * 3600_000,
    lastRunAtMs: now - (index + 2) * 3600_000,
    createdAtMs: now - 10 * 24 * 3600_000,
    updatedAtMs: now - index * 3600_000,
  }))

  const cronRuns: CronRunLogEntry[] = cronJobs.map((job, index) => ({
    id: `run-${job.id}`,
    jobId: job.id,
    jobName: job.name,
    status: 'ok',
    startedAtMs: now - (index + 1) * 2 * 3600_000,
    durationMs: 12000 + index * 4000,
    deliveryStatus: 'delivered',
  }))

  return { cronJobs, cronRuns }
}

function buildNodes(summary: ExperiencePresetSummary, roles: PresetRoleDetail[]): NodeListNode[] {
  const requiredSkills = Array.from(new Set(roles.flatMap((role) => role.capabilities.requiredSkills)))
  return [
    {
      nodeId: `${summary.id}-control-plane`,
      name: `${summary.name} Control Plane`,
      status: 'online',
      lastSeenAt: Date.now() - 60_000,
      capabilities: requiredSkills.slice(0, 4),
      platform: 'darwin',
      version: '0.9.0',
    },
    {
      nodeId: `${summary.id}-runner`,
      name: 'Workflow Runner',
      status: 'online',
      lastSeenAt: Date.now() - 45_000,
      capabilities: ['shell', 'browser', 'workflow-reporting'],
      platform: 'linux',
      version: '0.9.0',
    },
    {
      nodeId: `${summary.id}-observer`,
      name: 'Observability Node',
      status: 'online',
      lastSeenAt: Date.now() - 15_000,
      capabilities: ['observability-ops', 'workflow-reporting'],
      platform: 'linux',
      version: '0.9.0',
    },
  ]
}

function buildExecApprovals(taskScenarios: GeneratedTaskScenario[]): ExecApprovalRequest[] {
  return taskScenarios
    .flatMap((scenario, scenarioIndex) => scenario.steps
      .filter((step) => step.state === 'waiting')
      .map((step, stepIndex) => ({
        id: `approval-${slug(scenario.id)}-${stepIndex + 1}`,
        sessionKey: step.sessionKey,
        agentId: step.to,
        tool: 'workflow',
        description: `等待 ${step.to} 确认：${step.condition}`,
        ts: step.updatedAt + (scenarioIndex + 1) * 30_000,
      })))
}

function buildPresence(summary: ExperiencePresetSummary): PresenceEntry[] {
  const now = Date.now()
  return [
    { host: 'workflow-hub.local', version: '0.9.0', platform: 'darwin', mode: 'ui', ts: now - 30_000, instanceId: `${summary.id}-ui`, scopes: ['operator.read', 'operator.write'] },
    { host: 'workflow-runner', version: '0.9.0', platform: 'linux', mode: 'node', ts: now - 20_000, instanceId: `${summary.id}-runner`, scopes: ['operator.read', 'operator.write'] },
    { host: 'workflow-cli', version: '0.9.0', platform: 'darwin', mode: 'cli', ts: now - 90_000, instanceId: `${summary.id}-cli`, scopes: ['operator.read', 'operator.admin'] },
  ]
}

function buildSnapshot(summary: ExperiencePresetSummary, presence: PresenceEntry[], channels: ChannelsStatusResult): Snapshot {
  return {
    presence,
    health: {
      ok: true,
      services: {
        gateway: 'ok',
        agents: 'ok',
        channels: 'ok',
      },
      orchestration: {
        templateId: summary.id,
        handoffCount: summary.handoffCount,
      },
    },
    stateVersion: { presence: 64, health: 23 },
    uptimeMs: 7 * 24 * 3600_000,
    configPath: '~/.openclaw/openclaw.json',
    stateDir: '~/.openclaw/state',
    sessionDefaults: {
      defaultAgentId: channels.channelOrder[0] ? summary.quickStarts[0]?.ownerRoleId ?? 'dispatch-director' : 'dispatch-director',
      mainKey: 'sess-main',
      mainSessionKey: 'main',
      scope: 'operator.read',
    },
    authMode: 'token',
  }
}

function buildExperienceState(experience: LoadedExperiencePreset): MockWorkspaceSeed {
  const meta = presetMeta(experience.summary.id, experience.template)
  const taskScenarios = buildTaskScenarios(experience.summary, experience.template, experience.roles)
  const { agents, agentFiles } = buildAgents(experience.roles)
  const channelsStatus = buildChannels(experience.summary)
  const sessionsList = buildSessions(experience.summary, experience.template, experience.roles)
  const usage: SessionsUsageResult = deriveUsageFromSessions(sessionsList.sessions, agents)
  const { cronJobs, cronRuns } = buildCronArtifacts(experience.summary, meta)
  const logs = buildLogs(experience.summary, experience.template, experience.roles)
  const skills = buildSkills(experience.manifest, experience.roles)
  const nodes = buildNodes(experience.summary, experience.roles)
  const execApprovals = buildExecApprovals(taskScenarios)
  const presence = buildPresence(experience.summary)
  const snapshot = buildSnapshot(experience.summary, presence, channelsStatus)

  const quickStarts: MockQuickStartSummary[] = experience.summary.quickStarts.map((quickStart) => ({
    id: quickStart.id,
    title: quickStart.title,
    user: quickStart.user,
    channel: quickStart.channel,
    prompt: quickStart.prompt,
  }))

  const experienceSummary: MockExperienceSummary = {
    id: experience.summary.id,
    name: experience.summary.name,
    tagline: experience.summary.tagline,
    description: experience.summary.description,
    templateId: experience.template.id,
    roleIds: experience.template.roles,
    quickStarts,
    quickStartCount: quickStarts.length,
    layerCounts: experience.summary.layerCounts,
    handoffCount: experience.summary.handoffCount,
    channelIds: experience.summary.channelBlueprints.map((channel) => channel.id),
    importedAtMs: Date.now(),
  }

  return {
    agents,
    agentFiles,
    sessionsList,
    usage,
    channelsStatus,
    cronJobs,
    cronRuns,
    logs,
    skills,
    nodes,
    execApprovals,
    presence,
    snapshot,
    config: {
      version: '0.9.0',
      teamTemplate: experience.template.id,
      teamName: experience.summary.name,
      experience: experienceSummary,
    },
    experience: experienceSummary,
  }
}

export async function importExperiencePreset(templateId: string): Promise<LoadedExperiencePreset> {
  const experience = await loadExperiencePreset(templateId)
  const config = loadConfig()

  if (config.useMockData) {
    applyMockWorkspaceSeed(buildExperienceState(experience))
  } else {
    await deployTeam(templateId)
  }

  return experience
}

export function getRoleLayerLabel(layer: PresetLayer): string {
  switch (layer) {
    case 'L0':
      return '治理层'
    case 'L1':
      return '决策层'
    case 'L2':
      return '协调层'
    case 'L3':
      return '执行层'
    default:
      return layer
  }
}

export function getRoleLayerTone(layer: PresetLayer): { badge: string; card: string; border: string } {
  switch (layer) {
    case 'L0':
      return { badge: 'bg-pastel-red/40 text-accent-red', card: 'from-pastel-red/40 to-white', border: '#fda4af' }
    case 'L1':
      return { badge: 'bg-pastel-yellow/40 text-accent-yellow', card: 'from-pastel-yellow/40 to-white', border: '#fcd34d' }
    case 'L2':
      return { badge: 'bg-pastel-blue/40 text-accent-blue', card: 'from-pastel-blue/40 to-white', border: '#93c5fd' }
    case 'L3':
      return { badge: 'bg-pastel-green/40 text-accent-green', card: 'from-pastel-green/40 to-white', border: '#86efac' }
    default:
      return { badge: 'bg-surface-hover text-text-secondary', card: 'from-surface-hover to-white', border: '#cbd5e1' }
  }
}

export function getChannelDisplay(channelId: string): { emoji: string; label: string } {
  return {
    emoji: channelEmoji[channelId] || '📡',
    label: channelId,
  }
}
