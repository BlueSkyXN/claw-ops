import { useEffect, useMemo, useState } from 'react'
import type { ExperienceQuickStart } from '../lib/orchestration'
import type { PresetRoleDetail } from '../lib/presets'
import type { MissionDispatchInput } from '../lib/orchestration-runtime'
import AgentLayerBadge from './AgentLayerBadge'

export type MissionPriority = 'normal' | 'high' | 'critical'

function preferredOwnerRoleId(roles: PresetRoleDetail[]): string {
  return roles.find((role) => role.manifest.layer === 'L1')?.manifest.id
    ?? roles.find((role) => role.manifest.layer === 'L2')?.manifest.id
    ?? roles[0]?.manifest.id
    ?? ''
}

function priorityMeta(priority: MissionPriority) {
  switch (priority) {
    case 'critical':
      return { badge: 'badge-red', label: '紧急推进', hint: '优先触发治理关注与升级同步' }
    case 'high':
      return { badge: 'badge-yellow', label: '高优先级', hint: '优先分配带宽，要求快速反馈' }
    default:
      return { badge: 'badge-blue', label: '标准推进', hint: '按常规节奏执行并回传阶段进度' }
  }
}

export default function MissionDispatchPanel({
  roles,
  quickStarts,
  compact = false,
  busy = false,
  disabledReason = null,
  title = 'CEO 发令台',
  subtitle = '直接向组织下达目标，统一从控制面入口发起，让编排从观察走向主动驱动。',
  onDispatch,
}: {
  roles: PresetRoleDetail[]
  quickStarts: ExperienceQuickStart[]
  compact?: boolean
  busy?: boolean
  disabledReason?: string | null
  title?: string
  subtitle?: string
  onDispatch: (input: MissionDispatchInput) => Promise<void> | void
}) {
  const [form, setForm] = useState<MissionDispatchInput>({
    title: '',
    brief: '',
    successCriteria: '',
    ownerRoleId: preferredOwnerRoleId(roles),
    priority: 'high',
  })

  useEffect(() => {
    setForm((current) => ({
      ...current,
      ownerRoleId: roles.some((role) => role.manifest.id === current.ownerRoleId)
        ? current.ownerRoleId
        : preferredOwnerRoleId(roles),
    }))
  }, [roles])

  const selectedRole = useMemo(
    () => roles.find((role) => role.manifest.id === form.ownerRoleId) ?? null,
    [form.ownerRoleId, roles],
  )

  const priority = priorityMeta(form.priority)
  const canSubmit = form.title.trim() !== '' && form.brief.trim() !== '' && form.successCriteria.trim() !== '' && form.ownerRoleId !== '' && !busy && !disabledReason

  const applyQuickStart = (quickStart: ExperienceQuickStart) => {
    setForm({
      title: quickStart.title,
      brief: quickStart.prompt,
      successCriteria: quickStart.outcome,
      ownerRoleId: quickStart.ownerRoleId,
      priority: 'high',
    })
  }

  const handleDispatch = async () => {
    if (!canSubmit) return
    try {
      await onDispatch({
        title: form.title.trim(),
        brief: form.brief.trim(),
        successCriteria: form.successCriteria.trim(),
        ownerRoleId: form.ownerRoleId,
        priority: form.priority,
      })
      setForm((current) => ({
        ...current,
        title: '',
        brief: '',
        successCriteria: '',
        priority: 'high',
      }))
    } catch {
      // parent surfaces dispatch failure
    }
  }

  return (
    <div className="card p-5 space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-text-primary">{title}</p>
            <span className="badge badge-purple">Mission Dispatch</span>
          </div>
          <p className="text-xs text-text-secondary mt-1 leading-5">{subtitle}</p>
        </div>
        <div className="text-[11px] text-text-secondary rounded-2xl border border-surface-border bg-surface-bg px-3 py-2">
          通过 `chat.send` 直接把目标投递给组织负责人，统一从控制面入口发起，保持纯前端架构。
        </div>
      </div>

      {quickStarts.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-text-secondary">常用经营场景</p>
          <div className="flex flex-wrap gap-2">
            {quickStarts.slice(0, compact ? 3 : 5).map((quickStart) => (
              <button
                key={quickStart.id}
                type="button"
                onClick={() => applyQuickStart(quickStart)}
                className="rounded-xl border border-surface-border bg-surface-bg px-3 py-2 text-left text-xs text-text-primary hover:bg-surface-hover transition-colors"
                disabled={busy}
              >
                <span className="font-medium">{quickStart.title}</span>
                <span className="block text-text-muted mt-1">典型发起人：{quickStart.user}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {disabledReason && (
        <div className="rounded-2xl border border-accent-yellow/30 bg-pastel-yellow/20 px-4 py-3 text-xs text-accent-yellow">
          {disabledReason}
        </div>
      )}

      <div className={`grid gap-4 ${compact ? 'grid-cols-1' : 'grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]'}`}>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5 text-xs text-text-secondary">
              <span>任务标题</span>
              <input
                type="text"
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="例如：48 小时内推出新产品上线战役"
                className="w-full rounded-xl border border-surface-border bg-white px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-300"
                disabled={busy || !!disabledReason}
              />
            </label>
            <label className="space-y-1.5 text-xs text-text-secondary">
              <span>成功标准</span>
              <input
                type="text"
                value={form.successCriteria}
                onChange={(event) => setForm((current) => ({ ...current, successCriteria: event.target.value }))}
                placeholder="例如：今天产出方案，明天上线 MVP，后天复盘"
                className="w-full rounded-xl border border-surface-border bg-white px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-300"
                disabled={busy || !!disabledReason}
              />
            </label>
          </div>

          <label className="space-y-1.5 text-xs text-text-secondary block">
            <span>目标简报</span>
            <textarea
              value={form.brief}
              onChange={(event) => setForm((current) => ({ ...current, brief: event.target.value }))}
              placeholder="描述业务背景、期望动作、关键约束和交付时点。"
              className={`w-full rounded-2xl border border-surface-border bg-white px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-300 ${compact ? 'min-h-[110px]' : 'min-h-[140px]'}`}
              disabled={busy || !!disabledReason}
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5 text-xs text-text-secondary">
              <span>负责人</span>
              <select
                value={form.ownerRoleId}
                onChange={(event) => setForm((current) => ({ ...current, ownerRoleId: event.target.value }))}
                className="w-full rounded-xl border border-surface-border bg-white px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-300"
                disabled={busy || !!disabledReason}
              >
                {roles.map((role) => (
                  <option key={role.manifest.id} value={role.manifest.id}>
                    {role.manifest.name} · {role.manifest.layer}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1.5 text-xs text-text-secondary">
              <span>优先级</span>
              <select
                value={form.priority}
                onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value as MissionPriority }))}
                className="w-full rounded-xl border border-surface-border bg-white px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-300"
                disabled={busy || !!disabledReason}
              >
                <option value="normal">标准推进</option>
                <option value="high">高优先级</option>
                <option value="critical">紧急推进</option>
              </select>
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-surface-border pt-3">
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-text-secondary">
              <span className={`badge ${priority.badge}`}>{priority.label}</span>
              <span>{priority.hint}</span>
              <span className="badge badge-cyan">统一入口 Web</span>
            </div>
            <button type="button" onClick={() => void handleDispatch()} className="btn-primary text-xs" disabled={!canSubmit}>
              {busy ? '正在下达...' : '🚀 下达 Mission'}
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-2xl border border-surface-border bg-surface-bg p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-text-secondary">策略预览</p>
              {selectedRole && <AgentLayerBadge layer={selectedRole.manifest.layer} />}
            </div>
            {selectedRole ? (
              <>
                <div>
                  <p className="text-sm font-semibold text-text-primary">{selectedRole.manifest.name}</p>
                  <p className="text-xs text-text-secondary mt-1">{selectedRole.manifest.description}</p>
                </div>
                <div className="flex flex-wrap gap-2 text-[11px]">
                  <span className="badge badge-blue">{selectedRole.manifest.modelTier}</span>
                  <span className="badge badge-purple">{selectedRole.manifest.costTier}</span>
                  <span className="badge badge-cyan">并发上限 {selectedRole.authority.maxConcurrent || selectedRole.manifest.defaultMaxConcurrent}</span>
                </div>
                <div className="grid gap-3 text-xs">
                  <div className="rounded-2xl border border-surface-border bg-white px-3 py-3">
                    <p className="font-semibold text-text-secondary">门禁与升级</p>
                    <p className="text-text-primary mt-2">强制检查：{selectedRole.workflow.mandatoryChecks.join('、') || '—'}</p>
                    <p className="text-text-secondary mt-1">升级路径：{selectedRole.authority.escalateTo.join('、') || '—'}</p>
                  </div>
                  <div className="rounded-2xl border border-surface-border bg-white px-3 py-3">
                    <p className="font-semibold text-text-secondary">执行能力边界</p>
                    <p className="text-text-primary mt-2">Owned stages：{selectedRole.workflow.ownedStages.join('、') || '—'}</p>
                    <p className="text-text-secondary mt-1">必需技能：{selectedRole.capabilities.requiredSkills.join('、') || '—'}</p>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-xs text-text-secondary">选择负责人后，这里会显示本次 Mission 的治理与执行边界。</p>
            )}
          </div>

          <div className="rounded-2xl border border-surface-border bg-surface-bg p-4 text-xs text-text-secondary">
            <p className="font-semibold text-text-primary mb-2">投递结果</p>
            <p className="leading-6">
              Mission 会作为新的入口会话进入组织，由负责人接单，并通过现有任务推断、审批、健康分析与路径高亮自动进入控制面。
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
