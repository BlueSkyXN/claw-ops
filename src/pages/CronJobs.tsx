import { useState, useEffect, useMemo, useRef } from 'react'
import { getAPI } from '../lib/api'
import type { CronJob, CronRunLogEntry, CronSchedule, CronPayload } from '../types/openclaw'

function relativeTime(ts: number | undefined | null): string {
  if (!ts) return '—'
  const diff = Date.now() - ts
  const min = Math.floor(diff / 60000)
  if (min < 1) return '刚刚'
  if (min < 60) return `${min} 分钟前`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h} 小时前`
  return `${Math.floor(h / 24)} 天前`
}

function futureTime(ts: number | undefined | null): string {
  if (!ts) return '—'
  const diff = ts - Date.now()
  if (diff <= 0) return '即将执行'
  const min = Math.floor(diff / 60000)
  if (min < 60) return `${min} 分钟后`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h} 小时后`
  return `${Math.floor(h / 24)} 天后`
}

function formatDuration(ms: number | undefined): string {
  if (!ms) return '—'
  if (ms < 1000) return `${ms}ms`
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(1)}s`
  return `${Math.floor(s / 60)}m ${Math.floor(s % 60)}s`
}

function formatInterval(ms: number): string {
  const sec = ms / 1000
  if (sec < 60) return `${sec} 秒`
  const min = sec / 60
  if (min < 60) return `${min} 分钟`
  const hour = min / 60
  return `${hour} 小时`
}

function scheduleDisplay(schedule: CronSchedule): { label: string; detail: string } {
  switch (schedule.kind) {
    case 'at':
      return { label: '⏰ 定时', detail: `每天 ${schedule.at}` }
    case 'every':
      return { label: '🔁 循环', detail: `每 ${formatInterval(schedule.everyMs)}` }
    case 'cron':
      return { label: '📋 Cron', detail: schedule.expr + (schedule.tz ? ` (${schedule.tz})` : '') }
  }
}

const runStatusConfig: Record<string, { label: string; cls: string }> = {
  ok: { label: '成功', cls: 'bg-pastel-green/30 text-accent-green' },
  error: { label: '失败', cls: 'bg-pastel-red/30 text-accent-red' },
  skipped: { label: '跳过', cls: 'bg-pastel-yellow/30 text-accent-yellow' },
}

// ==========================================
// Add CronJob Modal
// ==========================================

function AddCronJobModal({ onClose, onSave }: {
  onClose: () => void
  onSave: (params: { name: string; schedule: CronSchedule; payload: CronPayload; agentId?: string; description?: string }) => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [scheduleKind, setScheduleKind] = useState<'at' | 'every' | 'cron'>('at')
  const [atTime, setAtTime] = useState('09:00')
  const [everyMs, setEveryMs] = useState(3600_000)
  const [cronExpr, setCronExpr] = useState('0 * * * *')
  const [cronTz, setCronTz] = useState('')
  const [message, setMessage] = useState('')
  const [agentId, setAgentId] = useState('')
  const [payloadKind, setPayloadKind] = useState<'agentTurn' | 'systemEvent'>('agentTurn')

  const handleSubmit = () => {
    if (!name.trim() || !message.trim()) return

    let schedule: CronSchedule
    if (scheduleKind === 'at') schedule = { kind: 'at', at: atTime }
    else if (scheduleKind === 'every') schedule = { kind: 'every', everyMs }
    else schedule = { kind: 'cron', expr: cronExpr, ...(cronTz ? { tz: cronTz } : {}) }

    const payload: CronPayload = payloadKind === 'agentTurn'
      ? { kind: 'agentTurn', message }
      : { kind: 'systemEvent', text: message }

    onSave({
      name: name.trim(),
      schedule,
      payload,
      ...(agentId ? { agentId } : {}),
      ...(description ? { description } : {}),
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-surface-card border border-surface-border rounded-2xl w-[520px] max-h-[85vh] overflow-y-auto p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-text-primary">新建定时任务</h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary text-xl leading-none p-1">×</button>
        </div>

        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="text-xs text-text-secondary block mb-1">任务名称 *</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-surface-bg border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-blue"
              placeholder="例如：每日数据报告"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs text-text-secondary block mb-1">描述</label>
            <input
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full bg-surface-bg border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-blue"
              placeholder="可选描述"
            />
          </div>

          {/* Schedule kind */}
          <div>
            <label className="text-xs text-text-secondary block mb-1">调度类型</label>
            <div className="flex gap-2">
              {(['at', 'every', 'cron'] as const).map(k => (
                <button
                  key={k}
                  onClick={() => setScheduleKind(k)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    scheduleKind === k
                      ? 'bg-brand-100 text-brand-700 border border-brand-200'
                      : 'bg-surface-bg text-text-secondary border border-surface-border hover:bg-surface-hover'
                  }`}
                >
                  {k === 'at' ? '⏰ 定时' : k === 'every' ? '🔁 循环' : '📋 Cron'}
                </button>
              ))}
            </div>
          </div>

          {/* Schedule details */}
          {scheduleKind === 'at' && (
            <div>
              <label className="text-xs text-text-secondary block mb-1">执行时间 (HH:MM)</label>
              <input
                type="time"
                value={atTime}
                onChange={e => setAtTime(e.target.value)}
                className="bg-surface-bg border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-blue"
              />
            </div>
          )}
          {scheduleKind === 'every' && (
            <div>
              <label className="text-xs text-text-secondary block mb-1">间隔</label>
              <select
                value={everyMs}
                onChange={e => setEveryMs(Number(e.target.value))}
                className="bg-surface-bg border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-blue"
              >
                <option value={300_000}>5 分钟</option>
                <option value={900_000}>15 分钟</option>
                <option value={1800_000}>30 分钟</option>
                <option value={3600_000}>1 小时</option>
                <option value={7200_000}>2 小时</option>
                <option value={21600_000}>6 小时</option>
                <option value={43200_000}>12 小时</option>
              </select>
            </div>
          )}
          {scheduleKind === 'cron' && (
            <div className="space-y-2">
              <div>
                <label className="text-xs text-text-secondary block mb-1">Cron 表达式</label>
                <input
                  value={cronExpr}
                  onChange={e => setCronExpr(e.target.value)}
                  className="w-full bg-surface-bg border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary font-mono focus:outline-none focus:border-accent-blue"
                  placeholder="0 9 * * *"
                />
              </div>
              <div>
                <label className="text-xs text-text-secondary block mb-1">时区（可选）</label>
                <input
                  value={cronTz}
                  onChange={e => setCronTz(e.target.value)}
                  className="w-full bg-surface-bg border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-blue"
                  placeholder="Asia/Shanghai"
                />
              </div>
            </div>
          )}

          {/* Payload kind */}
          <div>
            <label className="text-xs text-text-secondary block mb-1">载荷类型</label>
            <div className="flex gap-2">
              <button
                onClick={() => setPayloadKind('agentTurn')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  payloadKind === 'agentTurn'
                    ? 'bg-brand-100 text-brand-700 border border-brand-200'
                    : 'bg-surface-bg text-text-secondary border border-surface-border hover:bg-surface-hover'
                }`}
              >
                🤖 智能体消息
              </button>
              <button
                onClick={() => setPayloadKind('systemEvent')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  payloadKind === 'systemEvent'
                    ? 'bg-brand-100 text-brand-700 border border-brand-200'
                    : 'bg-surface-bg text-text-secondary border border-surface-border hover:bg-surface-hover'
                }`}
              >
                ⚡ 系统事件
              </button>
            </div>
          </div>

          {/* Message */}
          <div>
            <label className="text-xs text-text-secondary block mb-1">消息内容 *</label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={3}
              className="w-full bg-surface-bg border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-blue resize-none"
              placeholder="发送给智能体或系统的消息..."
            />
          </div>

          {/* Agent */}
          {payloadKind === 'agentTurn' && (
            <div>
              <label className="text-xs text-text-secondary block mb-1">智能体 ID（可选）</label>
              <input
                value={agentId}
                onChange={e => setAgentId(e.target.value)}
                className="w-full bg-surface-bg border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-blue"
                placeholder="例如: default, coder, analyst"
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 mt-6 pt-4 border-t border-surface-border">
          <button onClick={onClose} className="btn-secondary text-sm">取消</button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim() || !message.trim()}
            className="btn-primary text-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            创建任务
          </button>
        </div>
      </div>
    </div>
  )
}

// ==========================================
// Run History
// ==========================================

function RunHistory({ jobId, runs }: { jobId: string; runs: CronRunLogEntry[] }) {
  const jobRuns = runs.filter(r => r.jobId === jobId)

  if (jobRuns.length === 0) {
    return <p className="text-xs text-text-secondary py-3 text-center">暂无执行记录</p>
  }

  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-surface-border/50">
          <th className="text-left py-2 px-3 text-text-secondary font-normal">时间</th>
          <th className="text-left py-2 px-3 text-text-secondary font-normal w-16">状态</th>
          <th className="text-left py-2 px-3 text-text-secondary font-normal w-20">耗时</th>
          <th className="text-left py-2 px-3 text-text-secondary font-normal w-24">投递</th>
          <th className="text-left py-2 px-3 text-text-secondary font-normal">错误</th>
        </tr>
      </thead>
      <tbody>
        {jobRuns.map(run => {
          const st = runStatusConfig[run.status] || runStatusConfig.ok
          return (
            <tr key={run.id} className="border-b border-surface-border/20">
              <td className="py-1.5 px-3 text-text-secondary">{relativeTime(run.startedAtMs)}</td>
              <td className="py-1.5 px-3">
                <span className={`badge text-[10px] ${st.cls}`}>{st.label}</span>
              </td>
              <td className="py-1.5 px-3 text-text-primary tabular-nums">{formatDuration(run.durationMs)}</td>
              <td className="py-1.5 px-3 text-text-secondary">
                {run.deliveryStatus === 'delivered' ? '✅ 已投递' :
                 run.deliveryStatus === 'not-delivered' ? '❌ 未投递' :
                 run.deliveryStatus === 'not-requested' ? '— 无需' : '❓ 未知'}
              </td>
              <td className="py-1.5 px-3 text-accent-red truncate max-w-[200px]">{run.error || ''}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

// ==========================================
// Main Component
// ==========================================

export default function CronJobs() {
  const [jobs, setJobs] = useState<CronJob[]>([])
  const [runs, setRuns] = useState<CronRunLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedJob, setExpandedJob] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const runNowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 组件卸载时清理 handleRunNow 延时定时器
  useEffect(() => {
    return () => { if (runNowTimerRef.current) clearTimeout(runNowTimerRef.current) }
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [jobsData, runsData] = await Promise.all([
        getAPI().getCronJobs(),
        getAPI().getCronRuns({ limit: 50, sort: 'desc' }),
      ])
      setJobs(jobsData)
      setRuns(runsData)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const stats = useMemo(() => {
    const total = jobs.length
    const enabled = jobs.filter(j => j.enabled).length
    const recentRuns = runs.slice(0, 5)
    const lastRunOk = recentRuns.length > 0 ? recentRuns[0].status : null
    const nextJob = jobs.filter(j => j.enabled && j.nextRunAtMs).sort((a, b) => (a.nextRunAtMs ?? Infinity) - (b.nextRunAtMs ?? Infinity))[0]
    return { total, enabled, lastRunOk, nextRun: nextJob?.nextRunAtMs }
  }, [jobs, runs])

  const handleToggleEnabled = async (job: CronJob) => {
    try {
      await getAPI().updateCronJob({ id: job.id, patch: { enabled: !job.enabled } })
      loadData()
    } catch (e) { console.error(e) }
  }

  const handleRunNow = async (job: CronJob) => {
    try {
      await getAPI().runCronJob({ id: job.id })
      if (runNowTimerRef.current) clearTimeout(runNowTimerRef.current)
      runNowTimerRef.current = setTimeout(loadData, 1000)
    } catch (e) { console.error(e) }
  }

  const handleDelete = async (job: CronJob) => {
    if (!confirm(`确定要删除定时任务「${job.name}」？`)) return
    try {
      await getAPI().removeCronJob({ id: job.id })
      loadData()
    } catch (e) { console.error(e) }
  }

  const handleAdd = async (params: { name: string; schedule: CronSchedule; payload: CronPayload; agentId?: string; description?: string }) => {
    try {
      await getAPI().addCronJob({ ...params, enabled: true })
      setShowAddModal(false)
      loadData()
    } catch (e) { console.error(e) }
  }

  const toggleExpand = (jobId: string) => {
    setExpandedJob(prev => prev === jobId ? null : jobId)
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="stat-card">
          <span className="stat-label">总任务数</span>
          <span className="stat-value">{stats.total}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">已启用</span>
          <span className="stat-value text-accent-green">{stats.enabled}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">最近执行</span>
          <span className={`stat-value text-lg ${
            stats.lastRunOk === 'ok' ? 'text-accent-green' :
            stats.lastRunOk === 'error' ? 'text-accent-red' :
            stats.lastRunOk === 'skipped' ? 'text-accent-yellow' : ''
          }`}>
            {stats.lastRunOk === 'ok' ? '✅ 成功' :
             stats.lastRunOk === 'error' ? '❌ 失败' :
             stats.lastRunOk === 'skipped' ? '⏭️ 跳过' : '—'}
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-label">下次执行</span>
          <span className="stat-value text-lg">{futureTime(stats.nextRun)}</span>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">定时任务列表</h3>
        <div className="flex items-center gap-2">
          <button onClick={loadData} className="btn-ghost text-xs flex items-center gap-1">
            🔄 刷新
          </button>
          <button onClick={() => setShowAddModal(true)} className="btn-primary text-xs flex items-center gap-1">
            ➕ 新建任务
          </button>
        </div>
      </div>

      {/* Jobs Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-text-secondary text-sm">加载中...</div>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-surface-card">
              <tr className="border-b border-surface-border">
                <th className="text-left py-2.5 px-4 text-text-secondary font-normal">任务名称</th>
                <th className="text-left py-2.5 px-3 text-text-secondary font-normal w-28">调度方式</th>
                <th className="text-left py-2.5 px-3 text-text-secondary font-normal">调度详情</th>
                <th className="text-left py-2.5 px-3 text-text-secondary font-normal w-20">智能体</th>
                <th className="text-center py-2.5 px-3 text-text-secondary font-normal w-16">状态</th>
                <th className="text-left py-2.5 px-3 text-text-secondary font-normal w-24">下次执行</th>
                <th className="text-left py-2.5 px-3 text-text-secondary font-normal w-24">上次执行</th>
                <th className="text-right py-2.5 px-4 text-text-secondary font-normal w-36">操作</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map(job => {
                const sched = scheduleDisplay(job.schedule)
                const isExpanded = expandedJob === job.id
                return (
                  <tr key={job.id} className="group">
                    <td colSpan={8} className="p-0">
                      <div>
                        {/* Main row */}
                        <div
                          className={`flex items-center border-b transition-colors cursor-pointer hover:bg-surface-hover ${
                            isExpanded ? 'border-surface-border bg-surface-hover/50' : 'border-surface-border/30'
                          }`}
                          onClick={() => toggleExpand(job.id)}
                        >
                          <div className="flex-1 py-2.5 px-4 font-medium text-text-primary flex items-center gap-2">
                            <svg
                              className={`w-3.5 h-3.5 text-text-secondary transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                            <span className={!job.enabled ? 'text-text-secondary' : ''}>{job.name}</span>
                            {job.description && (
                              <span className="text-[10px] text-text-secondary hidden group-hover:inline">
                                {job.description}
                              </span>
                            )}
                          </div>
                          <div className="w-28 py-2.5 px-3">
                            <span className="badge bg-surface-hover text-text-secondary text-[10px]">{sched.label}</span>
                          </div>
                          <div className="flex-1 py-2.5 px-3 text-text-secondary font-mono text-[11px]">
                            {sched.detail}
                          </div>
                          <div className="w-20 py-2.5 px-3 text-text-primary">
                            {job.agentId || '—'}
                          </div>
                          <div className="w-16 py-2.5 px-3 text-center">
                            <button
                              onClick={e => { e.stopPropagation(); handleToggleEnabled(job) }}
                              className={`w-9 h-5 rounded-full transition-colors relative ${
                                job.enabled ? 'bg-accent-green' : 'bg-surface-border'
                              }`}
                            >
                              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                                job.enabled ? 'left-[18px]' : 'left-0.5'
                              }`} />
                            </button>
                          </div>
                          <div className="w-24 py-2.5 px-3 text-text-secondary whitespace-nowrap">
                            {futureTime(job.nextRunAtMs)}
                          </div>
                          <div className="w-24 py-2.5 px-3 text-text-secondary whitespace-nowrap">
                            {relativeTime(job.lastRunAtMs)}
                          </div>
                          <div className="w-36 py-2.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                              <button
                                onClick={() => handleRunNow(job)}
                                className="btn-ghost text-[11px] px-2 py-1"
                                title="立即执行"
                              >
                                ▶️
                              </button>
                              <button
                                onClick={() => handleDelete(job)}
                                className="btn-ghost text-[11px] px-2 py-1 hover:text-accent-red"
                                title="删除"
                              >
                                🗑️
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Expanded details */}
                        {isExpanded && (
                          <div className="bg-surface-bg/50 border-b border-surface-border px-6 py-4 space-y-4">
                            {/* Job info */}
                            <div className="grid grid-cols-3 gap-3">
                              <div className="bg-surface-card rounded-lg p-3">
                                <p className="text-[10px] text-text-secondary mb-0.5">载荷类型</p>
                                <p className="text-xs text-text-primary">
                                  {job.payload.kind === 'agentTurn' ? '🤖 智能体消息' : '⚡ 系统事件'}
                                </p>
                              </div>
                              <div className="bg-surface-card rounded-lg p-3">
                                <p className="text-[10px] text-text-secondary mb-0.5">消息内容</p>
                                <p className="text-xs text-text-primary line-clamp-2">
                                  {job.payload.kind === 'agentTurn' ? job.payload.message : job.payload.text}
                                </p>
                              </div>
                              <div className="bg-surface-card rounded-lg p-3">
                                <p className="text-[10px] text-text-secondary mb-0.5">创建时间</p>
                                <p className="text-xs text-text-primary">{relativeTime(job.createdAtMs)}</p>
                              </div>
                            </div>

                            {/* Delivery info for agentTurn */}
                            {job.payload.kind === 'agentTurn' && (job.payload.deliver || job.payload.channel) && (
                              <div className="flex items-center gap-3 text-xs text-text-secondary">
                                {job.payload.deliver && <span>📤 自动投递</span>}
                                {job.payload.channel && <span>📡 渠道: {job.payload.channel}</span>}
                                {job.payload.to && <span>👤 目标: {job.payload.to}</span>}
                              </div>
                            )}

                            {/* Run history */}
                            <div>
                              <h4 className="text-xs font-semibold text-text-primary mb-2">执行记录</h4>
                              <div className="bg-surface-card rounded-lg overflow-hidden">
                                <RunHistory jobId={job.id} runs={runs} />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {jobs.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-text-secondary">
                    暂无定时任务
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <AddCronJobModal onClose={() => setShowAddModal(false)} onSave={handleAdd} />
      )}
    </div>
  )
}
