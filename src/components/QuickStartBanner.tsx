export default function QuickStartBanner({
  title,
  description,
  busy,
  onPreview,
  onImport,
}: {
  title: string
  description: string
  busy?: boolean
  onPreview: () => void
  onImport: () => void
}) {
  return (
    <div className="rounded-3xl bg-gradient-to-r from-brand-500 via-accent-purple to-accent-cyan text-white p-6 shadow-card">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-2 max-w-3xl">
          <p className="text-xs uppercase tracking-[0.22em] text-white/80">OPC Quick Start</p>
          <h3 className="text-2xl font-bold">{title}</h3>
          <p className="text-sm leading-6 text-white/90">{description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={onPreview} className="px-4 py-2 rounded-xl bg-white/15 hover:bg-white/20 transition-colors text-sm font-medium border border-white/20">
            预览编排
          </button>
          <button onClick={onImport} disabled={busy} className="px-4 py-2 rounded-xl bg-white text-brand-600 hover:opacity-90 transition-colors text-sm font-semibold disabled:opacity-60">
            {busy ? '导入中...' : '🚀 一键导入'}
          </button>
        </div>
      </div>
    </div>
  )
}
