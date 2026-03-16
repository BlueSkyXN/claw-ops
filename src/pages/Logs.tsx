import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { getAPI } from '../lib/api'
import { exportToCSV } from '../lib/export'
import type { LogEntry } from '../types/openclaw'

type LogLevel = 'info' | 'warn' | 'error' | 'debug'

const levelConfig: Record<string, { label: string; cls: string }> = {
  info: { label: 'INFO', cls: 'bg-pastel-blue/30 text-accent-blue' },
  warn: { label: 'WARN', cls: 'bg-pastel-yellow/30 text-accent-yellow' },
  error: { label: 'ERROR', cls: 'bg-pastel-red/30 text-accent-red' },
  debug: { label: 'DEBUG', cls: 'bg-surface-hover text-text-secondary' },
}

const allLevels: LogLevel[] = ['info', 'warn', 'error', 'debug']

function formatTs(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN', {
    month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

export default function Logs() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [levelFilter, setLevelFilter] = useState<string>('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [searchText, setSearchText] = useState('')
  const [autoRefresh, setAutoRefresh] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  const fetchLogs = useCallback(async () => {
    try {
      const params: Record<string, unknown> = { lines: 200 }
      if (levelFilter) params.level = levelFilter
      if (sourceFilter.trim()) params.source = sourceFilter.trim()
      const data = await getAPI().getLogs(params as never)
      setLogs(data)
    } catch (err) {
      console.error('Failed to fetch logs:', err)
    } finally {
      setLoading(false)
    }
  }, [levelFilter, sourceFilter])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  // Auto-refresh every 5 seconds
  useEffect(() => {
    if (!autoRefresh) return
    const timer = setInterval(fetchLogs, 5000)
    return () => clearInterval(timer)
  }, [autoRefresh, fetchLogs])

  // Auto-scroll to bottom
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [logs])

  const filteredLogs = useMemo(() => {
    if (!searchText.trim()) return logs
    const q = searchText.toLowerCase()
    return logs.filter(
      (l) => l.message.toLowerCase().includes(q) || (l.source && l.source.toLowerCase().includes(q))
    )
  }, [logs, searchText])

  const handleExport = () => {
    exportToCSV('logs-export.csv',
      ['时间戳', '级别', '来源', '消息'],
      filteredLogs.map((l) => [
        new Date(l.ts).toISOString(),
        l.level,
        l.source || '',
        l.message,
      ])
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-text-secondary text-sm">
        加载中...
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Filter bar */}
      <div className="card p-4">
        <div className="flex items-center gap-4 flex-wrap">
          {/* Level dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-secondary flex-shrink-0">级别：</span>
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              className="bg-surface-bg border border-surface-border rounded-lg px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-accent-blue"
            >
              <option value="">全部</option>
              {allLevels.map((lv) => (
                <option key={lv} value={lv}>{levelConfig[lv].label}</option>
              ))}
            </select>
          </div>

          <div className="w-px h-5 bg-surface-border" />

          {/* Source filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-secondary">来源：</span>
            <input
              type="text"
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              placeholder="例如 gateway, agent:coder"
              className="bg-surface-bg border border-surface-border rounded-lg px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-accent-blue w-40"
            />
          </div>

          <div className="w-px h-5 bg-surface-border" />

          {/* Search */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-secondary">搜索：</span>
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="消息关键词..."
              className="bg-surface-bg border border-surface-border rounded-lg px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-accent-blue w-40"
            />
          </div>

          <div className="flex-1" />

          {/* Export */}
          <button onClick={handleExport} className="btn-ghost flex items-center gap-1.5 text-xs">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            导出CSV
          </button>

          {/* Auto-refresh toggle */}
          <button
            onClick={() => setAutoRefresh((v) => !v)}
            className={`btn-ghost text-xs flex items-center gap-1 ${autoRefresh ? 'text-accent-blue' : ''}`}
          >
            {autoRefresh ? '🔄' : '⏸️'}
            {autoRefresh ? '自动刷新' : '暂停刷新'}
          </button>

          {/* Count */}
          <span className="text-[11px] text-text-secondary">
            {filteredLogs.length} 条
          </span>
        </div>
      </div>

      {/* Log table */}
      <div ref={listRef} className="flex-1 card overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-surface-card z-10">
            <tr className="border-b border-surface-border">
              <th className="text-left py-2.5 px-4 text-text-secondary font-normal w-36">时间</th>
              <th className="text-left py-2.5 px-2 text-text-secondary font-normal w-16">级别</th>
              <th className="text-left py-2.5 px-2 text-text-secondary font-normal w-36">来源</th>
              <th className="text-left py-2.5 px-2 text-text-secondary font-normal">消息</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.map((log, i) => {
              const cfg = levelConfig[log.level] || levelConfig.info
              return (
                <tr key={`${log.ts}-${i}`} className="border-b border-surface-border/30 hover:bg-surface-hover transition-colors">
                  <td className="py-2 px-4 text-text-secondary whitespace-nowrap font-mono text-[11px]">
                    {formatTs(log.ts)}
                  </td>
                  <td className="py-2 px-2">
                    <span className={`badge ${cfg.cls} text-[10px]`}>{cfg.label}</span>
                  </td>
                  <td className="py-2 px-2 text-text-primary whitespace-nowrap">{log.source || '—'}</td>
                  <td className="py-2 px-2 text-text-primary">{log.message}</td>
                </tr>
              )
            })}
            {filteredLogs.length === 0 && (
              <tr>
                <td colSpan={4} className="py-12 text-center text-text-secondary">
                  无匹配日志
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
