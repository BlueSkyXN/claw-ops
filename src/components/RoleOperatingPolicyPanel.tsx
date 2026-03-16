import type { PresetRoleDetail } from '../lib/presets'
import type { RoleLoadInfo } from '../lib/task-tracker'
import AgentLayerBadge from './AgentLayerBadge'

function governanceState(role: PresetRoleDetail, load: RoleLoadInfo) {
  const queue = load.activeTasks + load.waitingTasks + load.blockedTasks
  const capacity = Math.max(1, role.authority.maxConcurrent || role.manifest.defaultMaxConcurrent || 1)
  if (load.blockedTasks > 0) return { label: '阻断中', tone: 'badge-red', queue, capacity }
  if (load.pendingApprovals > 0 || load.waitingTasks > 0) return { label: '审批门禁中', tone: 'badge-yellow', queue, capacity }
  if (queue > capacity) return { label: '过载', tone: 'badge-red', queue, capacity }
  if (queue >= Math.max(1, Math.ceil(capacity * 0.75))) return { label: '接近上限', tone: 'badge-yellow', queue, capacity }
  return { label: '正常', tone: 'badge-green', queue, capacity }
}

export default function RoleOperatingPolicyPanel({
  role,
  load,
}: {
  role: PresetRoleDetail
  load: RoleLoadInfo
}) {
  const state = governanceState(role, load)

  return (
    <div className="grid grid-cols-1 gap-3 text-xs">
      <div className="rounded-2xl border border-surface-border bg-surface-bg p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AgentLayerBadge layer={role.manifest.layer} />
            <span className="font-semibold text-text-primary">Authority Now</span>
          </div>
          <span className={`badge ${state.tone}`}>{state.label}</span>
        </div>
        <p className="text-text-primary">当前承载：{state.queue} / {state.capacity}</p>
        <p className="text-text-secondary">审批 {load.pendingApprovals} · 待处理 {load.waitingTasks + load.blockedTasks} · 升级路径 {role.authority.escalateTo.join('、') || '—'}</p>
        <p className="text-text-secondary">必须通知：{role.authority.mustNotify.join('、') || '—'} · 协同模式：{role.authority.coordinationMode || '—'}</p>
      </div>

      <div className="rounded-2xl border border-surface-border bg-surface-bg p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <span className="font-semibold text-text-primary">Workflow Gate Status</span>
          <span className="badge badge-blue">{role.workflow.ownedStages.length} 个阶段</span>
        </div>
        <p className="text-text-primary">Owned stages：{role.workflow.ownedStages.join('、') || '—'}</p>
        <p className="text-text-secondary">接收：{role.workflow.acceptsFrom.join('、') || '—'} · 移交：{role.workflow.handoffTo.join('、') || '—'}</p>
        <p className="text-text-secondary">强制检查：{role.workflow.mandatoryChecks.join('、') || '—'}</p>
      </div>

      <div className="rounded-2xl border border-surface-border bg-surface-bg p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <span className="font-semibold text-text-primary">Capability Envelope</span>
          <div className="flex flex-wrap gap-2">
            <span className="badge badge-blue">{role.manifest.modelTier}</span>
            <span className="badge badge-purple">{role.manifest.costTier}</span>
          </div>
        </div>
        <p className="text-text-primary">Sandbox：{role.capabilities.sandbox.mode}</p>
        <p className="text-text-secondary">必需技能：{role.capabilities.requiredSkills.join('、') || '—'}</p>
        <p className="text-text-secondary">工具画像：{role.capabilities.toolingProfile.join('、') || '—'}</p>
      </div>
    </div>
  )
}
