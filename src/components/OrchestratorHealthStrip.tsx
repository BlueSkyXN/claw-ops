import { Link } from 'react-router-dom'
import type { MockExperienceSummary } from '../data/mock-workspace'
import AgentLayerBadge from './AgentLayerBadge'

const layers = ['L0', 'L1', 'L2', 'L3'] as const

export default function OrchestratorHealthStrip({
  experience,
}: {
  experience: MockExperienceSummary | null
}) {
  if (!experience) {
    return (
      <div className="card p-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-text-primary">🧩 编排体验未激活</p>
          <p className="text-xs text-text-secondary mt-1">导入任一团队模板后，这里会显示层级覆盖、快速体验入口和编排健康摘要。</p>
        </div>
        <Link to="/orchestration" className="btn-primary text-xs whitespace-nowrap">
          打开编排页
        </Link>
      </div>
    )
  }

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-text-primary">🏢 当前编排：{experience.name}</p>
          <p className="text-xs text-text-secondary mt-1">{experience.tagline}</p>
        </div>
        <Link to="/orchestration" className="btn-secondary text-xs whitespace-nowrap">
          进入编排
        </Link>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {layers.map((layer) => {
          const count = experience.layerCounts[layer]
          const healthy = count > 0
          return (
            <div key={layer} className={`rounded-2xl border p-3 ${healthy ? 'border-surface-border bg-surface-bg' : 'border-dashed border-surface-border bg-surface-hover'}`}>
              <div className="flex items-center justify-between gap-2 mb-2">
                <AgentLayerBadge layer={layer} />
                <span className={`text-xs font-semibold ${healthy ? 'text-text-primary' : 'text-accent-red'}`}>
                  {healthy ? `${count} 个` : '缺失'}
                </span>
              </div>
              <p className="text-[11px] text-text-secondary">
                {healthy ? '角色已覆盖，可参与混合编排。' : '建议从预设补全该层能力。'}
              </p>
            </div>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[11px] text-text-secondary">
        <span className="badge badge-blue">{experience.roleIds.length} 角色</span>
        <span className="badge badge-purple">{experience.handoffCount} 条交接链路</span>
        <span className="badge badge-green">{experience.quickStartCount} 个快速体验入口</span>
        <span className="badge badge-cyan">{experience.channelIds.length} 个触发渠道</span>
      </div>
    </div>
  )
}
