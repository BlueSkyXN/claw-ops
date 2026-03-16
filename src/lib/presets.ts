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
}

/** 部署进度回调参数 */
export interface DeployProgress {
  step: 'create' | 'update' | 'soul' | 'workflow' | 'authority' | 'capabilities' | 'skills' | 'done'
  current: number
  total: number
  label: string
}

// ==========================================
// 常量
// ==========================================

const PRESET_BASE = '/presets/enterprise-command-center'

// ==========================================
// 清单缓存
// ==========================================

let manifestCache: PresetLibraryManifest | null = null

/** 加载预设库清单（带缓存） */
export async function loadManifest(): Promise<PresetLibraryManifest> {
  if (manifestCache) return manifestCache
  const resp = await fetch(`${PRESET_BASE}/manifest.json`)
  if (!resp.ok) throw new Error(`无法加载预设清单: ${resp.status}`)
  manifestCache = await resp.json() as PresetLibraryManifest
  return manifestCache
}

/** 清除清单缓存（供刷新使用） */
export function clearManifestCache(): void {
  manifestCache = null
}

// ==========================================
// 角色详情加载
// ==========================================

/** 校验 fetch 响应状态 */
function ensureOk(resp: Response, label: string): Response {
  if (!resp.ok) throw new Error(`加载 ${label} 失败: HTTP ${resp.status}`)
  return resp
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
    soulContent: soulText,
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
 *       agents.files.set(workflow/authority/capabilities) → skills.install
 */
export async function deployRole(
  roleId: string,
  onProgress?: (p: DeployProgress) => void,
): Promise<string> {
  const detail = await loadRoleDetail(roleId)
  const api = getAPI()
  const { manifest, capabilities, authority, workflow, soulContent } = detail

  // 总步骤: create(1) + update(1) + files(4) + skills(N)
  const skillCount = capabilities.requiredSkills.length
  const totalSteps = 2 + 4 + skillCount
  let step = 0

  const progress = (s: DeployProgress['step'], label: string) => {
    step++
    onProgress?.({ step: s, current: step, total: totalSteps, label })
  }

  // 1. 创建智能体
  progress('create', `创建智能体 ${manifest.name}...`)
  const { agentId } = await api.createAgent({ name: manifest.name })

  // 后续步骤如果失败，回滚删除已创建的智能体
  try {
    // 2. 更新元数据 (emoji)
    progress('update', '设置 emoji 与元数据...')
    await api.updateAgent({ agentId, emoji: manifest.emoji })

    // 3. 写入 SOUL.md
    progress('soul', '写入 SOUL.md 人设文件...')
    await api.agentFilesSet(agentId, 'SOUL.md', soulContent)

    // 4. 写入 workflow.json
    progress('workflow', '写入工作流配置...')
    await api.agentFilesSet(agentId, 'workflow.json', JSON.stringify(workflow, null, 2))

    // 5. 写入 authority.json
    progress('authority', '写入权限矩阵...')
    await api.agentFilesSet(agentId, 'authority.json', JSON.stringify(authority, null, 2))

    // 6. 写入 capabilities.json
    progress('capabilities', '写入能力配置...')
    await api.agentFilesSet(agentId, 'capabilities.json', JSON.stringify(capabilities, null, 2))

    // 7. 安装技能
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
