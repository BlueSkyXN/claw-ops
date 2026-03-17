import { useState, useEffect, useMemo } from 'react'
import { getAPI } from '../lib/api'
import type { ChannelsStatusResult, ChannelAccountSnapshot } from '../types/openclaw'

const defaultChannelEmoji: Record<string, string> = {
  telegram: '📱', feishu: '🐦', discord: '🎮', slack: '💬', whatsapp: '📞', api: '🔌', webchat: '🌐',
}

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

function getAccountStatus(account: ChannelAccountSnapshot): { label: string; cls: string; dot: string } {
  if (account.enabled === false) return { label: '已禁用', cls: 'bg-surface-hover text-text-secondary', dot: 'bg-text-muted' }
  if (account.lastError) return { label: '错误', cls: 'bg-pastel-red/30 text-accent-red', dot: 'bg-accent-red' }
  if (account.connected) return { label: '已连接', cls: 'bg-pastel-green/30 text-accent-green', dot: 'bg-accent-green' }
  if (account.running) return { label: '运行中', cls: 'bg-pastel-yellow/30 text-accent-yellow', dot: 'bg-accent-yellow' }
  return { label: '离线', cls: 'bg-surface-hover text-text-secondary', dot: 'bg-text-muted' }
}

function StatusDot({ active, label }: { active: boolean | null | undefined; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px]">
      <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-accent-green' : 'bg-surface-border'}`} />
      <span className={active ? 'text-text-primary' : 'text-text-muted'}>{label}</span>
    </span>
  )
}

function AccountRow({ account }: { account: ChannelAccountSnapshot }) {
  const status = getAccountStatus(account)

  return (
    <div className="bg-surface-bg rounded-xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-medium text-text-primary">{account.name || account.accountId}</h4>
          <span className={`badge text-[10px] ${status.cls}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${status.dot} mr-1`} />
            {status.label}
          </span>
        </div>
        <span className="text-[10px] text-text-secondary font-mono">{account.accountId}</span>
      </div>

      {/* Status indicators */}
      <div className="flex items-center gap-4">
        <StatusDot active={account.configured} label="已配置" />
        <StatusDot active={account.linked} label="已关联" />
        <StatusDot active={account.running} label="运行中" />
        <StatusDot active={account.connected} label="已连接" />
      </div>

      {/* Activity times */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="flex justify-between">
          <span className="text-text-secondary">最后连接</span>
          <span className="text-text-primary">{relativeTime(account.lastConnectedAt)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-secondary">最后入站</span>
          <span className="text-text-primary">{relativeTime(account.lastInboundAt)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-secondary">最后出站</span>
          <span className="text-text-primary">{relativeTime(account.lastOutboundAt)}</span>
        </div>
        {account.activeRuns !== undefined && (
          <div className="flex justify-between">
            <span className="text-text-secondary">活跃运行</span>
            <span className="text-text-primary">{account.activeRuns}</span>
          </div>
        )}
      </div>

      {/* Reconnect info */}
      {(account.reconnectAttempts ?? 0) > 0 && (
        <div className="text-xs text-accent-yellow flex items-center gap-1">
          ⚠️ 重连尝试: {account.reconnectAttempts} 次
        </div>
      )}

      {/* Error message */}
      {account.lastError && (
        <div className="bg-pastel-red/10 border border-accent-red/20 rounded-lg p-2.5 text-xs text-accent-red">
          ❌ {account.lastError}
        </div>
      )}

      {/* Additional info */}
      <div className="flex items-center gap-3 text-[10px] text-text-secondary">
        {account.mode && <span>模式: {account.mode}</span>}
        {account.dmPolicy && <span>DM策略: {account.dmPolicy}</span>}
        {account.allowFrom && account.allowFrom.length > 0 && (
          <span>允许来源: {account.allowFrom.join(', ')}</span>
        )}
      </div>
    </div>
  )
}

function ChannelCard({ channelId, label, emoji, accounts, isExpanded, onToggle }: {
  channelId: string
  label: string
  emoji: string
  accounts: ChannelAccountSnapshot[]
  isExpanded: boolean
  onToggle: () => void
}) {
  const connectedCount = accounts.filter(a => a.connected).length
  const errorCount = accounts.filter(a => a.lastError).length
  const hasError = errorCount > 0
  const allConnected = connectedCount === accounts.length && accounts.length > 0

  return (
    <div className={`card-hover overflow-hidden transition-all ${isExpanded ? 'col-span-full' : ''}`}>
      <div
        className="p-5 cursor-pointer"
        onClick={onToggle}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{emoji}</span>
            <div>
              <h3 className="text-sm font-semibold text-text-primary">{label}</h3>
              <p className="text-xs text-text-secondary">{accounts.length} 个账号</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {hasError && (
              <span className="badge bg-pastel-red/30 text-accent-red text-[10px]">
                {errorCount} 错误
              </span>
            )}
            {allConnected ? (
              <span className="badge bg-pastel-green/30 text-accent-green text-[10px]">
                <span className="w-1.5 h-1.5 rounded-full bg-accent-green mr-1" />
                全部在线
              </span>
            ) : connectedCount > 0 ? (
              <span className="badge bg-pastel-yellow/30 text-accent-yellow text-[10px]">
                {connectedCount}/{accounts.length} 在线
              </span>
            ) : (
              <span className="badge bg-surface-hover text-text-secondary text-[10px]">
                离线
              </span>
            )}

            <svg
              className={`w-4 h-4 text-text-secondary transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {isExpanded && accounts.length > 0 && (
        <div className="px-5 pb-5 space-y-3 border-t border-surface-border pt-4">
          {accounts.map(account => (
            <AccountRow key={account.accountId} account={account} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function Channels() {
  const [data, setData] = useState<ChannelsStatusResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedChannels, setExpandedChannels] = useState<Set<string>>(new Set())

  const loadData = () => {
    setLoading(true)
    getAPI().getChannelsStatus()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadData() }, [])

  const toggleChannel = (id: string) => {
    setExpandedChannels(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const channelOrder = data?.channelOrder ?? []
  const channelLabels = data?.channelLabels ?? {}
  const channelAccounts = data?.channelAccounts ?? {}

  const getEmoji = (channelId: string): string => {
    const meta = Array.isArray(data?.channelMeta)
      ? data.channelMeta.find((entry) => entry.id === channelId)
      : undefined
    return meta?.systemImage || data?.channelSystemImages?.[channelId] || defaultChannelEmoji[channelId] || '📡'
  }

  const stats = useMemo(() => {
    const allAccounts = Object.values(channelAccounts).flat()
    const totalChannels = channelOrder.length
    const connectedAccounts = allAccounts.filter(a => a.connected).length
    const totalErrors = allAccounts.filter(a => a.lastError).length
    const totalAccounts = allAccounts.length
    return { totalChannels, connectedAccounts, totalErrors, totalAccounts }
  }, [channelOrder, channelAccounts])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm text-text-secondary">加载中...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="stat-card">
          <span className="stat-label">渠道总数</span>
          <span className="stat-value">{stats.totalChannels}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">账号总数</span>
          <span className="stat-value">{stats.totalAccounts}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">已连接账号</span>
          <span className="stat-value text-accent-green">{stats.connectedAccounts}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">错误数</span>
          <span className={`stat-value ${stats.totalErrors > 0 ? 'text-accent-red' : ''}`}>
            {stats.totalErrors}
          </span>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">渠道列表</h3>
        <button onClick={loadData} className="btn-ghost text-xs flex items-center gap-1">
          🔄 刷新
        </button>
      </div>

      {/* Channel Grid */}
      <div className="grid grid-cols-2 gap-4">
        {channelOrder.map(channelId => {
          const accounts = channelAccounts[channelId] ?? []
          return (
            <ChannelCard
              key={channelId}
              channelId={channelId}
              label={channelLabels[channelId] || channelId}
              emoji={getEmoji(channelId)}
              accounts={accounts}
              isExpanded={expandedChannels.has(channelId)}
              onToggle={() => toggleChannel(channelId)}
            />
          )
        })}
      </div>

      {channelOrder.length === 0 && (
        <div className="card p-12 text-center">
          <p className="text-text-secondary text-sm">暂无渠道数据</p>
        </div>
      )}
    </div>
  )
}
