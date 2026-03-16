import type { ExperiencePresetSummary } from '../lib/orchestration'

export default function TeamPresetsPanel({
  presets,
  selectedId,
  importingId,
  onSelect,
  onImport,
}: {
  presets: ExperiencePresetSummary[]
  selectedId: string | null
  importingId: string | null
  onSelect: (id: string) => void
  onImport: (id: string) => void
}) {
  return (
    <div className="card p-5 space-y-4">
      <div>
        <p className="text-sm font-semibold text-text-primary">🏢 团队模板库</p>
        <p className="text-xs text-text-secondary mt-1">导入团队后，Dashboard、会话、日志、编排画布会同步切换到对应体验场景。</p>
      </div>

      <div className="space-y-3">
        {presets.map((preset) => {
          const selected = preset.id === selectedId
          return (
            <div
              key={preset.id}
              className={`w-full rounded-2xl border p-4 transition-all ${selected ? 'border-brand-300 bg-brand-50/70 shadow-sm' : 'border-surface-border hover:border-brand-200 hover:bg-surface-hover'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <button
                  type="button"
                  onClick={() => onSelect(preset.id)}
                  className="space-y-2 min-w-0 flex-1 text-left"
                >
                  <div>
                    <p className="text-sm font-semibold text-text-primary">{preset.name}</p>
                    <p className="text-[11px] text-text-secondary mt-1 line-clamp-2">{preset.tagline}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5 text-[10px]">
                    <span className="badge badge-blue">{preset.roleCount} 角色</span>
                    <span className="badge badge-purple">{preset.handoffCount} 交接</span>
                    <span className="badge badge-green">{preset.quickStarts.length} 入口</span>
                  </div>
                  <p className="text-[11px] text-text-muted">{preset.audience}</p>
                </button>
                <button
                  type="button"
                  onClick={() => onImport(preset.id)}
                  className="btn-primary text-xs whitespace-nowrap"
                  disabled={importingId === preset.id}
                >
                  {importingId === preset.id ? '导入中...' : '导入'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
