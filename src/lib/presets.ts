// 预设角色加载与部署服务
// 从 public/presets/ 加载角色包清单，按需获取角色详情，编排一键导入流程

import { getAPI } from './api'
import type {
  PresetLibraryManifest,
  PresetRoleManifest,
  PresetRoleCapabilities,
  PresetRoleAuthority,
  PresetRoleWorkflow,
  PresetTeamTemplate,
} from '../types/presets'

// ==========================================
// 类型定义
// ==========================================

/** 角色完整数据（清单 + 各配置文件 + SOUL.md 正文） */
export interface PresetRoleDetail {
  manifest: PresetRoleManifest
  capabilities: PresetRoleCapabilities
  authority: PresetRoleAuthority
  workflow: PresetRoleWorkflow
  soulContent: string
  rolepackContent: string
}

/** 部署进度回调参数 */
export interface DeployProgress {
  step: 'create' | 'update' | 'soul' | 'rolepack' | 'skills' | 'done'
  current: number
  total: number
  label: string
}

// ==========================================
// 常量
// ==========================================

const PRESET_BASE = '/presets/enterprise-command-center'
export const ROLEPACK_FILE_NAME = 'claw-ops.rolepack.json'

// ==========================================
// 清单缓存 (使用 Promise 消除并发请求的竞态条件)
// ==========================================

let manifestPromise: Promise<PresetLibraryManifest> | null = null

/** 加载预设库清单（带缓存，并发安全） */
export async function loadManifest(): Promise<PresetLibraryManifest> {
  if (manifestPromise) return manifestPromise
  manifestPromise = (async () => {
    const resp = await fetch(`${PRESET_BASE}/manifest.json`)
    if (!resp.ok) throw new Error(`无法加载预设清单: ${resp.status}`)
    return await resp.json() as PresetLibraryManifest
  })()
  // 请求失败时清除缓存，允许下次重试
  manifestPromise.catch(() => { manifestPromise = null })
  return manifestPromise
}

/** 清除清单缓存（供刷新使用） */
export function clearManifestCache(): void {
  manifestPromise = null
}

// ==========================================
// 角色详情加载
// ==========================================

/** 校验 fetch 响应状态 */
function ensureOk(resp: Response, label: string): Response {
  if (!resp.ok) throw new Error(`加载 ${label} 失败: HTTP ${resp.status}`)
  return resp
}

function formatInlineList(items: string[]): string {
  return items.length > 0 ? items.map((item) => `\`${item}\``).join('、') : '无'
}

function buildCompiledSoulContent(
  manifest: PresetRoleManifest,
  capabilities: PresetRoleCapabilities,
  authority: PresetRoleAuthority,
  workflow: PresetRoleWorkflow,
  sourceSoul: string,
): string {
  const orchestrationRules = [
    '## OpenClaw 原生编排约束',
    '',
    '### 角色运行边界',
    `- 角色 ID：\`${manifest.id}\``,
    `- 当前层级：${manifest.layer} / ${manifest.layerName}`,
    `- 可调度下游：${formatInlineList(authority.allowAgents)}`,
    `- 升级路径：${formatInlineList(authority.escalateTo)}`,
    `- 必须通知：${formatInlineList(authority.mustNotify)}`,
    `- 最大并发子任务：${authority.maxConcurrent || manifest.defaultMaxConcurrent}`,
    `- 工具画像：${formatInlineList(capabilities.toolingProfile)}`,
    `- 沙箱策略：\`${capabilities.sandbox.mode}\`${capabilities.sandbox.scope ? ` / ${capabilities.sandbox.scope}` : ''}`,
    '',
    '### 阶段职责',
    `- 负责阶段：${formatInlineList(workflow.ownedStages)}`,
    `- 可接受来源：${formatInlineList(workflow.acceptsFrom)}`,
    `- 典型交接目标：${formatInlineList(workflow.handoffTo)}`,
    `- 必须检查：${formatInlineList(workflow.mandatoryChecks)}`,
    `- 必需产物：${formatInlineList(workflow.requiredArtifacts)}`,
    '',
    '### 自编排执行规则',
    '- 接收到入口任务后，先判断是否属于你当前负责阶段，再决定继续推进、交接还是升级。',
    authority.allowAgents.length > 0
      ? `- 需要下发子任务时，只能调度以下角色：${formatInlineList(authority.allowAgents)}。`
      : '- 你没有下游调度权限，不得自行创造新的执行角色或私自扩散任务。',
    '- 如需协作，优先使用 OpenClaw 原生的子会话 / spawn 能力推进下游，而不是通过普通闲聊伪造工作流。',
    '- 每次交接都必须附带：任务目标、成功标准、当前结论、风险、所需产物、下一次同步时间。',
    authority.escalateTo.length > 0
      ? `- 发现超出边界、需要治理决策或无法继续推进时，按升级路径上报：${formatInlineList(authority.escalateTo)}。`
      : '- 发现超出边界或无法继续推进时，必须明确说明阻塞原因与所需决策，不得静默等待。',
    authority.mustNotify.length > 0
      ? `- 以下角色必须同步知情：${formatInlineList(authority.mustNotify)}。`
      : '- 完成当前阶段后，必须输出结构化摘要并明确下一步交接对象。',
    manifest.layer === 'L0'
      ? '- 你属于治理层，遇到高风险、不可逆或需要放行/驳回的动作时，必须先发起执行审批请求，再继续推进。'
      : '- 遇到高风险、不可逆或跨边界动作时，先请求审批或升级，不得直接越权执行。',
    '',
    '### claw-ops 观察面要求',
    '- 你的阶段性回报必须清晰标出：当前阶段、已完成事项、关键证据、风险与下一步动作。',
    '- 若任务进入等待、阻塞或失败状态，必须给出可供控制面观察和干预的明确信号。',
  ]

  return `${sourceSoul.trim()}\n\n---\n\n${orchestrationRules.join('\n')}\n`
}

function buildRolepackContent(
  manifest: PresetRoleManifest,
  capabilities: PresetRoleCapabilities,
  authority: PresetRoleAuthority,
  workflow: PresetRoleWorkflow,
): string {
  return JSON.stringify({
    schema: 'claw-ops/rolepack/v1',
    manifest: {
      id: manifest.id,
      version: manifest.version,
      name: manifest.name,
      layer: manifest.layer,
      layerName: manifest.layerName,
      category: manifest.category,
      organizationalUnit: manifest.organizationalUnit,
    },
    authority,
    workflow,
    capabilities,
  }, null, 2)
}

/** 加载单个角色的完整数据 */
export async function loadRoleDetail(roleId: string): Promise<PresetRoleDetail> {
  const manifest = await loadManifest()
  const entry = manifest.roles.find(r => r.id === roleId)
  if (!entry) throw new Error(`角色 ${roleId} 不存在`)

  const basePath = `${PRESET_BASE}/roles/${roleId}`

  const [roleJson, capsJson, authJson, wfJson, soulText] = await Promise.all([
    fetch(`${basePath}/role.json`).then(r => ensureOk(r, 'role.json').json()) as Promise<PresetRoleManifest>,
    fetch(`${basePath}/capabilities.json`).then(r => ensureOk(r, 'capabilities.json').json()) as Promise<PresetRoleCapabilities>,
    fetch(`${basePath}/authority.json`).then(r => ensureOk(r, 'authority.json').json()) as Promise<PresetRoleAuthority>,
    fetch(`${basePath}/workflow.json`).then(r => ensureOk(r, 'workflow.json').json()) as Promise<PresetRoleWorkflow>,
    fetch(`${basePath}/SOUL.md`).then(r => ensureOk(r, 'SOUL.md').text()),
  ])

  return {
    manifest: roleJson,
    capabilities: capsJson,
    authority: authJson,
    workflow: wfJson,
    soulContent: buildCompiledSoulContent(roleJson, capsJson, authJson, wfJson, soulText),
    rolepackContent: buildRolepackContent(roleJson, capsJson, authJson, wfJson),
  }
}

/** 加载团队模板 */
export async function loadTeamTemplate(templateId: string): Promise<PresetTeamTemplate> {
  const manifest = await loadManifest()
  const entry = manifest.teamTemplates.find(t => t.id === templateId)
  if (!entry) throw new Error(`团队模板 ${templateId} 不存在`)
  const resp = await fetch(`${PRESET_BASE}/${entry.path}`)
  if (!resp.ok) throw new Error(`无法加载团队模板: ${resp.status}`)
  return resp.json() as Promise<PresetTeamTemplate>
}

// ==========================================
// 部署编排
// ==========================================

/**
 * 部署单个预设角色到 OpenClaw Gateway
 * 流程: agents.create → agents.update(emoji) → agents.files.set(SOUL.md) →
 *       agents.files.set(claw-ops.rolepack.json) → skills.install
 */
export async function deployRole(
  roleId: string,
  onProgress?: (p: DeployProgress) => void,
): Promise<string> {
  const detail = await loadRoleDetail(roleId)
  const api = getAPI()
  const { manifest, capabilities, soulContent, rolepackContent } = detail

  // 总步骤: create(1) + update(1) + files(2) + skills(N)
  const skillCount = capabilities.requiredSkills.length
  const totalSteps = 2 + 2 + skillCount + 1
  let step = 0

  const progress = (s: DeployProgress['step'], label: string) => {
    step++
    onProgress?.({ step: s, current: step, total: totalSteps, label })
  }

  // 1. 创建智能体
  progress('create', `创建智能体 ${manifest.name}（${manifest.id}）...`)
  const { agentId } = await api.createAgent({
    name: manifest.id,
    workspace: `~/.openclaw/workspaces/${capabilities.oneClickDefaults.workspaceSuffix}`,
  })

  // 后续步骤如果失败，回滚删除已创建的智能体
  try {
    // 2. 更新元数据 (emoji)
    progress('update', '设置名称、emoji 与元数据...')
    await api.updateAgent({ agentId, name: manifest.name, emoji: manifest.emoji })

    // 3. 写入 SOUL.md
    progress('soul', '写入 SOUL.md 人设文件...')
    await api.agentFilesSet(agentId, 'SOUL.md', soulContent)

    // 4. 写入 claw-ops 控制面 rolepack
    progress('rolepack', `写入 ${ROLEPACK_FILE_NAME} 控制面元数据...`)
    await api.agentFilesSet(agentId, ROLEPACK_FILE_NAME, rolepackContent)

    // 5. 安装技能
    for (const skillId of capabilities.requiredSkills) {
      progress('skills', `安装技能: ${skillId}...`)
      try {
        await api.installSkill(skillId)
      } catch {
        // 技能安装失败不阻断流程，仅跳过
        console.warn(`技能 ${skillId} 安装失败，已跳过`)
      }
    }
  } catch (err) {
    // 部署中途失败，回滚: 删除已创建的智能体
    try { await api.deleteAgent({ agentId }) } catch { /* 回滚失败不抛出 */ }
    throw err
  }

  progress('done', '部署完成！')
  return agentId
}

/**
 * 批量部署团队模板（按顺序逐角色部署）
 */
export async function deployTeam(
  templateId: string,
  onProgress?: (roleId: string, p: DeployProgress) => void,
): Promise<string[]> {
  const template = await loadTeamTemplate(templateId)
  const agentIds: string[] = []

  for (const roleId of template.roles) {
    const id = await deployRole(roleId, (p) => onProgress?.(roleId, p))
    agentIds.push(id)
  }

  return agentIds
}
