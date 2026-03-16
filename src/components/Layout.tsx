import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useState, useRef, useEffect } from 'react'
import { loadConfig, MODE_LABELS } from '../lib/config'

const navItems = [
  { path: '/', label: '总览', icon: '📊' },
  { path: '/agents', label: '智能体', icon: '🤖' },
  { path: '/sessions', label: '会话', icon: '💬' },
  { path: '/channels', label: '渠道', icon: '📡' },
  { path: '/cron', label: '定时任务', icon: '⏰' },
  { path: '/usage', label: '用量分析', icon: '📈' },
  { path: '/topology', label: '拓扑', icon: '🔗' },
  { path: '/logs', label: '日志', icon: '📜' },
]

const pageTitles: Record<string, string> = {
  '/': '总览',
  '/agents': '智能体管理',
  '/sessions': '会话管理',
  '/channels': '渠道状态',
  '/cron': '定时任务',
  '/usage': '用量分析',
  '/topology': '拓扑视图',
  '/logs': '运行日志',
}

export default function Layout() {
  const location = useLocation()
  const [refreshKey, setRefreshKey] = useState(0)
  const title = pageTitles[location.pathname] || 'claw-ops'
  const config = loadConfig()
  const modeInfo = MODE_LABELS[config.mode]

  // Auto-refresh
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [countdown, setCountdown] = useState(config.refreshInterval)
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    if (!autoRefresh) {
      setCountdown(config.refreshInterval)
      return
    }
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          setIsRefreshing(true)
          setRefreshKey(k => k + 1)
          setTimeout(() => setIsRefreshing(false), 600)
          return config.refreshInterval
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [autoRefresh, config.refreshInterval])

  return (
    <div className="flex h-screen overflow-hidden bg-surface-bg">
      {/* Sidebar */}
      <aside className="w-60 flex-shrink-0 bg-surface-sidebar border-r border-surface-border shadow-sidebar flex flex-col">
        {/* Logo */}
        <div className="p-5 border-b border-surface-divider">
          <h1 className="text-xl font-bold gradient-text tracking-wide">
            claw-ops
          </h1>
          <p className="text-xs text-text-muted mt-1">OpenClaw Operations Dashboard</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150 ${
                  isActive
                    ? 'bg-brand-50 text-brand-600 border-l-3 border-brand-500 font-medium'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover border-l-3 border-transparent'
                }`
              }
            >
              <span className="text-base">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* System status */}
        <div className="p-4 border-t border-surface-divider">
          <NavLink
            to="/setup"
            className="flex items-center gap-2 text-xs text-text-secondary hover:text-brand-500 transition-colors mb-2"
          >
            <span>🛠️</span>
            <span>{config.mode === 'standalone' ? '模式设置' : '连接设置'}</span>
          </NavLink>
          <div className="flex items-center gap-2 text-xs text-text-secondary">
            <span className="w-2 h-2 rounded-full bg-accent-green animate-pulse" />
            <span>{modeInfo.icon} {modeInfo.name}</span>
          </div>
          <p className="text-[10px] text-text-muted mt-1">
            v0.2.0{config.mode === 'realtime' ? ' · Gateway' : ' · Mock'}
          </p>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-14 flex-shrink-0 bg-surface-card border-b border-surface-border shadow-topbar flex items-center justify-between px-6">
          <h2 className="text-base font-semibold text-text-primary">{title}</h2>
          <div className="flex items-center gap-2">
            {/* Auto-refresh toggle */}
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-colors ${
                autoRefresh ? 'bg-brand-50 text-brand-600' : 'bg-surface-hover text-text-secondary hover:text-text-primary'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${autoRefresh ? 'bg-accent-green animate-pulse' : 'bg-text-muted'}`} />
              自动刷新
              {autoRefresh && <span className="font-mono ml-0.5">{countdown}s</span>}
            </button>
            <button
              onClick={() => {
                setIsRefreshing(true)
                setRefreshKey((k) => k + 1)
                setTimeout(() => setIsRefreshing(false), 600)
              }}
              className="btn-ghost flex items-center gap-1.5"
            >
              <svg className={`w-4 h-4 transition-transform ${isRefreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              刷新
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet key={refreshKey} />
        </main>
      </div>
    </div>
  )
}
