// 预设角色浏览器
// 展示预设库中所有角色与团队模板，支持单角色导入与批量导入

import { useState, useEffect, useCallback, useRef } from 'react'
import { loadManifest, loadRoleDetail, loadTeamTemplate, deployRole } from '../lib/presets'
import { importExperiencePreset } from '../lib/orchestration'
import type { PresetLibraryManifest, PresetLayer, PresetTeamTemplate } from '../types/presets'
import type { PresetRoleDetail, DeployProgress } from '../lib/presets'

// ==========================================
// 层级配色
// ==========================================

const LAYER_STYLES: Record<PresetLayer, { bg: string; border: string; text: string; badge: string }> = {
  L0: { bg: 'bg-red-500/5', border: 'border-red-500/20', text: 'text-red-400', badge: 'bg-red-500/10 text-red-400 border-red-500/20' },
  L1: { bg: 'bg-amber-500/5', border: 'border-amber-500/20', text: 'text-amber-400', badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  L2: { bg: 'bg-blue-500/5', border: 'border-blue-500/20', text: 'text-blue-400', badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  L3: { bg: 'bg-emerald-500/5', border: 'border-emerald-500/20', text: 'text-emerald-400', badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
}

const MODEL_TIER_LABELS: Record<string, string> = {
  fast: '⚡ 快速',
  strong: '💪 强力',
  reasoning: '🧠 推理',
}

const COST_TIER_LABELS: Record<string, string> = {
  low: '💚 低',
  medium: '💛 中',
  high: '💔 高',
}

// ==========================================
// 子组件: 角色卡片
// ==========================================

function RoleCard({
  role,
  layerStyle,
  onSelect,
}: {
  role: PresetLibraryManifest['roles'][0]
  layerStyle: typeof LAYER_STYLES[PresetLayer]
  onSelect: (roleId: string) => void
}) {
  return (
    <button
      onClick={() => onSelect(role.id)}
      className={`w-full text-left p-4 rounded-xl border ${layerStyle.border} ${layerStyle.bg} hover:brightness-110 transition-all duration-150 group`}
    >
      <div className="flex items-center gap-2.5 mb-2">
        <span className="text-xl group-hover:scale-110 transition-transform">
          {/* 角色 emoji 在详情中，这里用层级通用图标 */}
          {role.category === 'governance' ? '🛡️' :
           role.category === 'strategy' ? '🎯' :
           role.category === 'coordination' ? '📋' : '⚙️'}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-text-primary truncate">{role.name}</p>
          <p className="text-[10px] text-text-muted font-mono">{role.nameEn}</p>
        </div>
        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${layerStyle.badge}`}>
          {role.layer}
        </span>
      </div>
    </button>
  )
}

// ==========================================
// 子组件: 团队模板卡片
// ==========================================

function TeamTemplateCard({
  template,
  featured,
  busy,
  onDeploy,
}: {
  template: PresetTeamTemplate
  featured: boolean
  busy: boolean
  onDeploy: () => void
}) {
  return (
    <div className={`rounded-2xl border p-4 transition-all ${featured ? 'border-brand-200 bg-brand-50/60 shadow-sm' : 'border-surface-border bg-surface-card hover:border-brand-100 hover:bg-surface-hover'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-text-primary">{template.name}</p>
            {featured && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-100 text-brand-700 border border-brand-200">
                完整角色库
              </span>
            )}
          </div>
          <p className="text-[11px] text-text-muted mt-1">{template.nameEn}</p>
          <p className="text-xs text-text-secondary mt-2 leading-relaxed">{template.description}</p>
          <div className="flex flex-wrap gap-1.5 mt-3">
            <span className="text-[10px] px-2 py-0.5 rounded-full border border-surface-border bg-surface-hover text-text-secondary">
              {template.roles.length} 个角色
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full border border-surface-border bg-surface-hover text-text-secondary">
              {template.workflow.length} 条协作链路
            </span>
          </div>
        </div>
        <button
          onClick={onDeploy}
          disabled={busy}
          className="btn-primary text-xs whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy ? '导入中...' : featured ? '🚀 一键导入' : '导入团队'}
        </button>
      </div>
    </div>
  )
}

// ==========================================
// 子组件: 角色详情面板
// ==========================================

function RoleDetailPanel({
  detail,
  deploying,
  deployDisabled,
  deployProgress,
  onDeploy,
  onClose,
}: {
  detail: PresetRoleDetail
  deploying: boolean
  deployDisabled: boolean
  deployProgress: DeployProgress | null
  onDeploy: () => void
  onClose: () => void
}) {
  const { manifest, capabilities, authority } = detail
  const style = LAYER_STYLES[manifest.layer as PresetLayer]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-surface-card border border-surface-border rounded-2xl shadow-xl w-[560px] max-h-[85vh] flex flex-col overflow-hidden">
        {/* 头部 */}
        <div className={`px-6 py-5 border-b border-surface-divider ${style.bg}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{manifest.emoji}</span>
              <div>
                <h3 className="text-base font-semibold text-text-primary">{manifest.name}</h3>
                <p className="text-xs text-text-muted">{manifest.nameEn} · {manifest.organizationalUnit}</p>
              </div>
            </div>
            <button onClick={onClose} className="text-text-muted hover:text-text-primary text-lg leading-none p-1">✕</button>
          </div>
          <p className="text-sm text-text-secondary leading-relaxed">{manifest.description}</p>
          <div className="flex gap-2 mt-3 flex-wrap">
            <span className={`text-[10px] px-2 py-0.5 rounded-full border ${style.badge}`}>
              {manifest.layerName}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full border border-surface-border bg-surface-hover text-text-secondary">
              {MODEL_TIER_LABELS[manifest.modelTier] || manifest.modelTier}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full border border-surface-border bg-surface-hover text-text-secondary">
              成本 {COST_TIER_LABELS[manifest.costTier] || manifest.costTier}
            </span>
          </div>
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* 技能 */}
          <section>
            <h4 className="text-xs font-semibold text-text-secondary mb-2">📦 推荐技能</h4>
            <div className="flex flex-wrap gap-1.5">
              {capabilities.requiredSkills.map(s => (
                <span key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-brand-50 text-brand-600 border border-brand-100">
                  {s}
                </span>
              ))}
              {capabilities.optionalSkills.map(s => (
                <span key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-surface-hover text-text-muted border border-surface-border">
                  {s} (可选)
                </span>
              ))}
            </div>
          </section>

          {/* 权限 */}
          <section>
            <h4 className="text-xs font-semibold text-text-secondary mb-2">🔐 通信权限</h4>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <p className="text-text-muted mb-1">可调用</p>
                <div className="flex flex-wrap gap-1">
                  {authority.allowAgents.map(a => (
                    <span key={a} className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">{a}</span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-text-muted mb-1">升级到</p>
                <div className="flex flex-wrap gap-1">
                  {authority.escalateTo.map(a => (
                    <span key={a} className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">{a}</span>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* SOUL 预览 */}
          <section>
            <h4 className="text-xs font-semibold text-text-secondary mb-2">📜 SOUL.md 预览</h4>
            <pre className="text-[11px] text-text-secondary bg-surface-bg rounded-lg p-3 max-h-40 overflow-y-auto whitespace-pre-wrap leading-relaxed border border-surface-border">
              {detail.soulContent.slice(0, 800)}
              {detail.soulContent.length > 800 && '\n\n... (已截断)'}
            </pre>
          </section>

          {/* 部署文件清单 */}
          <section>
            <h4 className="text-xs font-semibold text-text-secondary mb-2">📂 部署文件</h4>
            <div className="text-[11px] text-text-muted space-y-0.5">
              <p>• SOUL.md — 编译后的人设与原生自编排约束</p>
            </div>
          </section>
        </div>

        {/* 底部操作 */}
        <div className="px-6 py-4 border-t border-surface-divider flex items-center justify-between">
          {deploying && deployProgress ? (
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-text-secondary">{deployProgress.label}</span>
                <span className="text-[10px] text-text-muted">{deployProgress.current}/{deployProgress.total}</span>
              </div>
              <div className="w-full h-1.5 bg-surface-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand-500 rounded-full transition-all duration-300"
                  style={{ width: `${(deployProgress.current / deployProgress.total) * 100}%` }}
                />
              </div>
            </div>
          ) : (
            <>
              <button onClick={onClose} className="btn-secondary text-xs">取消</button>
              <button
                onClick={onDeploy}
                disabled={deployDisabled}
                className="btn-primary text-xs flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                🚀 一键导入到 OpenClaw
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ==========================================
// 主组件: PresetBrowser
// ==========================================

export default function PresetBrowser({ onImported }: { onImported: () => void }) {
  const [manifest, setManifest] = useState<PresetLibraryManifest | null>(null)
  const [teamTemplates, setTeamTemplates] = useState<PresetTeamTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeLayer, setActiveLayer] = useState<PresetLayer | 'all'>('all')

  // 详情弹窗状态
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null)
  const [roleDetail, setRoleDetail] = useState<PresetRoleDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  // 部署状态
  const [deploying, setDeploying] = useState(false)
  const [deployProgress, setDeployProgress] = useState<DeployProgress | null>(null)
  const [deployingTeamId, setDeployingTeamId] = useState<string | null>(null)
  const [teamDeployProgress, setTeamDeployProgress] = useState<{
    templateId: string
    templateName: string
    roleName: string
    currentRole: number
    totalRoles: number
    step: DeployProgress
  } | null>(null)
  const deployTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const anyDeploying = deploying || Boolean(deployingTeamId)

  // 清理定时器
  useEffect(() => {
    return () => {
      if (deployTimerRef.current) clearTimeout(deployTimerRef.current)
    }
  }, [])

  const loadPresetData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const nextManifest = await loadManifest()
      const nextTeamTemplates = await Promise.all(
        nextManifest.teamTemplates.map((template) => loadTeamTemplate(template.id)),
      )
      setManifest(nextManifest)
      setTeamTemplates(nextTeamTemplates)
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  // 加载清单与团队模板
  useEffect(() => {
    void loadPresetData()
  }, [loadPresetData])

  // 选中角色 → 加载详情
  const handleSelect = useCallback(async (roleId: string) => {
    if (anyDeploying) return
    setSelectedRoleId(roleId)
    setLoadingDetail(true)
    try {
      const detail = await loadRoleDetail(roleId)
      setRoleDetail(detail)
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoadingDetail(false)
    }
  }, [anyDeploying])

  // 部署角色
  const handleDeploy = useCallback(async () => {
    if (!selectedRoleId) return
    setDeploying(true)
    setDeployProgress(null)
    try {
      await deployRole(selectedRoleId, setDeployProgress)
      // 部署成功，短暂延迟后关闭弹窗
      deployTimerRef.current = setTimeout(() => {
        setDeploying(false)
        setSelectedRoleId(null)
        setRoleDetail(null)
        setDeployProgress(null)
        onImported()
      }, 800)
    } catch (e) {
      setError(e instanceof Error ? e.message : '部署失败')
      setDeploying(false)
    }
  }, [selectedRoleId, onImported])

  // 批量部署团队/完整角色库
  const handleDeployTeam = useCallback(async (templateId: string) => {
    const template = teamTemplates.find((item) => item.id === templateId) ?? await loadTeamTemplate(templateId)
    setDeployingTeamId(templateId)
    setTeamDeployProgress(null)
    try {
      await importExperiencePreset(templateId, (roleId, step) => {
        const roleIndex = template.roles.indexOf(roleId)
        const roleName = manifest?.roles.find((role) => role.id === roleId)?.name ?? roleId
        setTeamDeployProgress({
          templateId,
          templateName: template.name,
          roleName,
          currentRole: roleIndex >= 0 ? roleIndex + 1 : 1,
          totalRoles: template.roles.length,
          step,
        })
      })

      deployTimerRef.current = setTimeout(() => {
        setDeployingTeamId(null)
        setTeamDeployProgress(null)
        setSelectedRoleId(null)
        setRoleDetail(null)
        setDeployProgress(null)
        onImported()
      }, 800)
    } catch (e) {
      setError(e instanceof Error ? e.message : '批量部署失败')
      setDeployingTeamId(null)
      setTeamDeployProgress(null)
    }
  }, [manifest, onImported, teamTemplates])

  const handleCloseDetail = useCallback(() => {
    if (anyDeploying) return
    setSelectedRoleId(null)
    setRoleDetail(null)
  }, [anyDeploying])

  if (loading) {
    return <div className="text-center text-text-muted text-sm py-12">加载预设库...</div>
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-accent-red text-sm mb-2">⚠️ {error}</p>
        <button onClick={() => void loadPresetData()} className="btn-secondary text-xs">
          重试
        </button>
      </div>
    )
  }

  if (!manifest) return null

  // 按层分组
  const layers: PresetLayer[] = ['L0', 'L1', 'L2', 'L3']
  const rolesByLayer = layers.reduce((acc, layer) => {
    acc[layer] = manifest.roles.filter(r => r.layer === layer)
    return acc
  }, {} as Record<PresetLayer, typeof manifest.roles>)

  const visibleLayers = activeLayer === 'all' ? layers : [activeLayer]
  const sortedTeamTemplates = [...teamTemplates].sort((left, right) => {
    if (left.id === 'full-enterprise-command-center') return -1
    if (right.id === 'full-enterprise-command-center') return 1
    return left.name.localeCompare(right.name, 'zh-CN')
  })

  return (
    <div className="space-y-4">
      {/* 预设库标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            📦 {manifest.name}
            <span className="text-[10px] text-text-muted font-normal">v{manifest.version}</span>
          </h4>
          <p className="text-xs text-text-muted mt-0.5">{manifest.description}</p>
        </div>
      </div>

      {/* 团队模板 / 一键导入完整角色库 */}
      {sortedTeamTemplates.length > 0 && (
        <div className="space-y-3">
          <div>
            <h5 className="text-xs font-semibold text-text-secondary mb-1">🏢 团队模板</h5>
            <p className="text-xs text-text-muted">除了单个角色导入，现在也支持按团队模板批量部署；完整模板会一次性导入整套预设角色库。</p>
          </div>

          {teamDeployProgress && (
            <div className="rounded-2xl border border-brand-200 bg-brand-50/60 p-4">
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-text-primary truncate">{teamDeployProgress.templateName}</p>
                  <p className="text-xs text-text-secondary mt-1">
                    正在导入第 {teamDeployProgress.currentRole}/{teamDeployProgress.totalRoles} 个角色：{teamDeployProgress.roleName}
                  </p>
                </div>
                <span className="text-[10px] text-text-muted whitespace-nowrap">
                  {teamDeployProgress.step.current}/{teamDeployProgress.step.total}
                </span>
              </div>
              <p className="text-xs text-text-secondary mb-2">{teamDeployProgress.step.label}</p>
              <div className="w-full h-2 bg-surface-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand-500 rounded-full transition-all duration-300"
                  style={{
                    width: `${((((teamDeployProgress.currentRole - 1) * teamDeployProgress.step.total) + teamDeployProgress.step.current) / (teamDeployProgress.totalRoles * teamDeployProgress.step.total)) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {sortedTeamTemplates.map((template) => (
              <TeamTemplateCard
                key={template.id}
                template={template}
                featured={template.id === 'full-enterprise-command-center'}
                busy={deployingTeamId === template.id}
                onDeploy={() => void handleDeployTeam(template.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* 层级筛选标签 */}
      <div className="flex gap-1.5">
        <button
          onClick={() => setActiveLayer('all')}
          className={`text-[11px] px-2.5 py-1 rounded-lg transition-colors ${
            activeLayer === 'all'
              ? 'bg-brand-50 text-brand-600 border border-brand-100'
              : 'bg-surface-hover text-text-muted border border-transparent hover:text-text-secondary'
          }`}
        >
          全部 ({manifest.roles.length})
        </button>
        {manifest.organization.layers.map(layer => (
          <button
            key={layer.id}
            onClick={() => setActiveLayer(layer.id)}
            className={`text-[11px] px-2.5 py-1 rounded-lg transition-colors ${
              activeLayer === layer.id
                ? `${LAYER_STYLES[layer.id].badge} border`
                : 'bg-surface-hover text-text-muted border border-transparent hover:text-text-secondary'
            }`}
          >
            {layer.id} {layer.name} ({rolesByLayer[layer.id]?.length || 0})
          </button>
        ))}
      </div>

      {/* 角色网格（按层分组） */}
      {visibleLayers.map(layer => {
        const roles = rolesByLayer[layer]
        if (!roles?.length) return null
        const layerInfo = manifest.organization.layers.find(l => l.id === layer)
        return (
          <div key={layer}>
            <h5 className={`text-xs font-medium mb-2 ${LAYER_STYLES[layer].text}`}>
              {layer} · {layerInfo?.name} — {layerInfo?.organizationalUnit}
            </h5>
            <div className="grid grid-cols-3 gap-2.5">
              {roles.map(role => (
                <RoleCard
                  key={role.id}
                  role={role}
                  layerStyle={LAYER_STYLES[layer]}
                  onSelect={handleSelect}
                />
              ))}
            </div>
          </div>
        )
      })}

      {/* 详情弹窗 */}
      {selectedRoleId && loadingDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-surface-card border border-surface-border rounded-2xl p-8 text-center">
            <p className="text-sm text-text-secondary">加载角色详情...</p>
          </div>
        </div>
      )}

      {selectedRoleId && roleDetail && !loadingDetail && (
        <RoleDetailPanel
          detail={roleDetail}
          deploying={deploying}
          deployDisabled={Boolean(deployingTeamId)}
          deployProgress={deployProgress}
          onDeploy={handleDeploy}
          onClose={handleCloseDetail}
        />
      )}
    </div>
  )
}
