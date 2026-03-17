import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { loadConfig, saveConfig, type OpenClawConfig, type AppMode, MODE_LABELS } from '../lib/config'
import { GatewayClient, buildGatewayClientOptionsFromConfig, type ConnectionState } from '../lib/gateway-client'
import type { Snapshot } from '../types/openclaw'

type Step = 'mode' | 'gateway' | 'test' | 'done'

const STEPS: { key: Step; label: string; icon: string }[] = [
  { key: 'mode', label: '运行模式', icon: '🎯' },
  { key: 'gateway', label: '连接配置', icon: '🌐' },
  { key: 'test', label: '连接测试', icon: '🧪' },
  { key: 'done', label: '完成', icon: '✅' },
]

const MODE_OPTIONS: { mode: AppMode; icon: string; title: string; desc: string; tag?: string }[] = [
  { mode: 'demo', icon: '🎭', title: '演示体验', desc: '内置 Mock 数据驱动所有功能，即刻上手体验', tag: '推荐' },
  { mode: 'realtime', icon: '🔗', title: '实时对接', desc: '通过 WebSocket 连接 OpenClaw Gateway，获取真实智能体运行数据' },
]

function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s} 秒`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} 分钟`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} 小时 ${m % 60} 分钟`
  const d = Math.floor(h / 24)
  return `${d} 天 ${h % 24} 小时`
}

function formatConnectionErrorMessage(rawMessage: string): string {
  const message = rawMessage.trim()
  if (message.includes('INVALID_REQUEST: invalid connect params')) {
    if (message.includes('/client/id')) {
      return '连接失败：客户端握手参数不符合 Gateway 协议（client.id 无效）。请升级到包含最新 Gateway 握手修复的 claw-ops 版本后重试。'
    }
    return '连接失败：客户端握手参数不符合 Gateway 协议。请升级 claw-ops 或检查握手配置后重试。'
  }
  if (message.includes('protocol mismatch')) {
    return '连接失败：claw-ops 与当前 OpenClaw Gateway 的协议版本不兼容。请升级到兼容同一协议版本的 claw-ops / Gateway 后重试。'
  }
  return `连接失败：${message}`
}

export default function Setup() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('mode')
  const [config, setConfig] = useState<OpenClawConfig>(loadConfig())
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'fail'>('idle')
  const [testMessage, setTestMessage] = useState('')
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [connState, setConnState] = useState<ConnectionState>('disconnected')
  const clientRef = useRef<GatewayClient | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setConfig(loadConfig())
  }, [])

  // Cleanup client and timeout on unmount
  useEffect(() => {
    return () => {
      clientRef.current?.disconnect()
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  const currentIdx = STEPS.findIndex(s => s.key === step)

  const update = (partial: Partial<OpenClawConfig>) => {
    setConfig(prev => ({ ...prev, ...partial }))
  }

  const selectMode = (mode: AppMode) => {
    update({ mode, useMockData: mode !== 'realtime' })
  }

  const next = () => {
    if (config.mode !== 'realtime' && step === 'mode') {
      saveConfig({ ...config, useMockData: true })
      setStep('done')
      return
    }
    const idx = STEPS.findIndex(s => s.key === step)
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1].key)
  }

  const prev = () => {
    if (step === 'test') {
      clientRef.current?.disconnect()
      setTestStatus('idle')
      setTestMessage('')
      setSnapshot(null)
    }
    const idx = STEPS.findIndex(s => s.key === step)
    if (idx > 0) setStep(STEPS[idx - 1].key)
  }

  const runTest = useCallback(async () => {
    // Disconnect previous attempt and clear pending timeout
    clientRef.current?.disconnect()
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setTestStatus('testing')
    setTestMessage('正在建立 WebSocket 连接...')
    setSnapshot(null)

    const client = new GatewayClient({
      ...buildGatewayClientOptionsFromConfig(config),
      reconnect: false,
      onStateChange: (state) => {
        setConnState(state)
        if (state === 'connecting') {
          setTestMessage('正在建立 WebSocket 连接...')
        }
      },
      onSnapshot: (snap) => {
        setSnapshot(snap)
        setTestStatus('success')
        setTestMessage('连接成功！Gateway 已响应。')
        saveConfig(config)
      },
      onError: (err) => {
        setTestStatus('fail')
        setTestMessage(formatConnectionErrorMessage(err.message))
      },
    })

    clientRef.current = client

    try {
      client.connect()
    } catch (err) {
      setTestStatus('fail')
      setTestMessage(formatConnectionErrorMessage(err instanceof Error ? err.message : '未知错误'))
      return
    }

    // Timeout after 10s
    timeoutRef.current = setTimeout(() => {
      if (client.connectionState !== 'connected') {
        client.disconnect()
        setTestStatus(prev => prev === 'testing' ? 'fail' : prev)
        setTestMessage(prev => prev === '正在建立 WebSocket 连接...' ? '连接超时：未能在 10 秒内建立连接' : prev)
      }
    }, 10000)
  }, [config])

  const skipTest = () => {
    clientRef.current?.disconnect()
    saveConfig(config)
    setStep('done')
  }

  const modeInfo = MODE_LABELS[config.mode]

  return (
    <div className="min-h-screen bg-surface-bg flex items-center justify-center p-8">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-brand-500 to-accent-purple bg-clip-text text-transparent">
            claw-ops
          </h1>
          <p className="text-text-secondary mt-1">Multi-Agent Operations Dashboard · 初始配置</p>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-center gap-1 mb-8">
          {STEPS.map((s, i) => (
            <div key={s.key} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                  i < currentIdx
                    ? 'bg-accent-green text-white'
                    : i === currentIdx
                    ? 'bg-brand-500 text-white shadow-md'
                    : 'bg-surface-hover text-text-muted'
                }`}
              >
                {i < currentIdx ? '✓' : s.icon}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`w-12 h-0.5 mx-1 ${i < currentIdx ? 'bg-accent-green' : 'bg-surface-border'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="card p-8">
          {/* Step 1: Mode Selection */}
          {step === 'mode' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-text-primary mb-2">选择运行模式</h2>
                <p className="text-text-secondary text-sm">
                  claw-ops 支持独立运行，无需绑定 OpenClaw。你也可以选择连接 OpenClaw 获取实时数据。
                </p>
              </div>
              <div className="space-y-3">
                {MODE_OPTIONS.map(opt => (
                  <button
                    key={opt.mode}
                    onClick={() => selectMode(opt.mode)}
                    className={`w-full p-5 rounded-xl border-2 text-left transition-all flex items-start gap-4 ${
                      config.mode === opt.mode
                        ? 'border-brand-500 bg-brand-50 shadow-md'
                        : 'border-surface-border hover:border-brand-300 hover:bg-surface-hover'
                    }`}
                  >
                    <div className="text-2xl flex-shrink-0 mt-0.5">{opt.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-text-primary">{opt.title}</span>
                        {opt.tag && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent-green/15 text-accent-green font-medium">
                            {opt.tag}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-text-secondary mt-1">{opt.desc}</div>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mt-1 flex items-center justify-center ${
                      config.mode === opt.mode ? 'border-brand-500' : 'border-surface-border'
                    }`}>
                      {config.mode === opt.mode && <div className="w-2.5 h-2.5 rounded-full bg-brand-500" />}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Gateway Connection Config */}
          {step === 'gateway' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-text-primary mb-2">WebSocket 连接配置</h2>
                <p className="text-text-secondary text-sm">配置 OpenClaw Gateway 的 WebSocket 地址和认证方式。</p>
              </div>

              {/* Gateway URL */}
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">Gateway URL</label>
                <input
                  type="url"
                  value={config.gatewayUrl}
                  onChange={e => update({ gatewayUrl: e.target.value })}
                  placeholder="ws://127.0.0.1:18789"
                  className="w-full px-4 py-3 rounded-xl border border-surface-border bg-white text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all font-mono text-sm"
                />
                <p className="text-xs text-text-muted mt-2">
                  支持 ws:// 或 wss:// 协议，将自动追加 /api/gateway 路径
                </p>
              </div>

              {/* Auth Type */}
              <div>
                <label className="block text-sm font-medium text-text-primary mb-3">认证方式</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => update({ authType: 'token' })}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      config.authType === 'token'
                        ? 'border-brand-500 bg-brand-50'
                        : 'border-surface-border hover:border-brand-300 hover:bg-surface-hover'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">🔑</span>
                      <span className="font-medium text-text-primary text-sm">Token 认证</span>
                    </div>
                    <p className="text-xs text-text-secondary">使用 API Token 进行身份验证</p>
                  </button>
                  <button
                    onClick={() => update({ authType: 'password' })}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      config.authType === 'password'
                        ? 'border-brand-500 bg-brand-50'
                        : 'border-surface-border hover:border-brand-300 hover:bg-surface-hover'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">🔒</span>
                      <span className="font-medium text-text-primary text-sm">密码认证</span>
                    </div>
                    <p className="text-xs text-text-secondary">使用密码进行身份验证</p>
                  </button>
                </div>
              </div>

              {/* Credential Input */}
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  {config.authType === 'token' ? 'Auth Token' : '密码'}
                </label>
                <input
                  type="password"
                  value={config.authType === 'token' ? config.authToken : config.authPassword}
                  onChange={e =>
                    config.authType === 'token'
                      ? update({ authToken: e.target.value })
                      : update({ authPassword: e.target.value })
                  }
                  placeholder={config.authType === 'token' ? '输入认证 Token...' : '输入密码...'}
                  className="w-full px-4 py-3 rounded-xl border border-surface-border bg-white text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all"
                />
                <p className="text-xs text-text-muted mt-2">
                  凭据仅保存在浏览器本地，不会上传到任何服务器。留空则不发送认证信息。
                </p>
              </div>
            </div>
          )}

          {/* Step 3: Connection Test */}
          {step === 'test' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-text-primary mb-2">WebSocket 连接测试</h2>
                <p className="text-text-secondary text-sm">
                  通过 WebSocket 连接 OpenClaw Gateway 并获取系统快照。
                </p>
              </div>

              <div className="p-6 rounded-xl border border-surface-border bg-surface-bg">
                {testStatus === 'idle' && (
                  <div className="text-center space-y-3">
                    <div className="text-4xl">🧪</div>
                    <p className="text-text-secondary">点击下方按钮开始 WebSocket 连接测试</p>
                    <p className="text-xs text-text-muted font-mono">{config.gatewayUrl}</p>
                  </div>
                )}

                {testStatus === 'testing' && (
                  <div className="text-center space-y-3">
                    <div className="text-4xl animate-bounce">📡</div>
                    <p className="text-text-secondary">{testMessage}</p>
                    <div className="flex items-center justify-center gap-2 text-xs text-text-muted">
                      <span className={`w-2 h-2 rounded-full animate-pulse ${
                        connState === 'connecting' ? 'bg-accent-yellow' : 'bg-accent-blue'
                      }`} />
                      <span>{connState === 'connecting' ? '正在握手...' : connState}</span>
                    </div>
                  </div>
                )}

                {testStatus === 'success' && (
                  <div className="space-y-4">
                    <div className="text-center">
                      <div className="text-4xl mb-2">✅</div>
                      <p className="text-accent-green font-medium">{testMessage}</p>
                    </div>
                    {snapshot && (
                      <div className="grid grid-cols-3 gap-3 mt-4">
                        <div className="p-3 rounded-lg bg-surface-card border border-surface-border text-center">
                          <div className="text-lg font-bold text-accent-blue">
                            {formatUptime(snapshot.uptimeMs)}
                          </div>
                          <div className="text-[11px] text-text-muted mt-1">运行时间</div>
                        </div>
                        <div className="p-3 rounded-lg bg-surface-card border border-surface-border text-center">
                          <div className="text-lg font-bold text-accent-purple">
                            {snapshot.authMode ?? 'none'}
                          </div>
                          <div className="text-[11px] text-text-muted mt-1">认证模式</div>
                        </div>
                        <div className="p-3 rounded-lg bg-surface-card border border-surface-border text-center">
                          <div className="text-lg font-bold text-accent-cyan">
                            {snapshot.presence.length}
                          </div>
                          <div className="text-[11px] text-text-muted mt-1">在线客户端</div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {testStatus === 'fail' && (
                  <div className="text-center space-y-3">
                    <div className="text-4xl">❌</div>
                    <p className="text-accent-red font-medium text-sm">{testMessage}</p>
                    <p className="text-xs text-text-muted">请检查网关地址、认证方式与协议兼容性，或跳过测试稍后配置</p>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button onClick={runTest} className="btn-primary flex-1" disabled={testStatus === 'testing'}>
                  {testStatus === 'testing' ? '连接中...' : testStatus === 'fail' ? '重新测试' : '开始测试'}
                </button>
                <button onClick={skipTest} className="btn-secondary flex-1">
                  跳过，直接完成
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Done */}
          {step === 'done' && (
            <div className="space-y-6 text-center">
              <div className="text-5xl">🎉</div>
              <div>
                <h2 className="text-xl font-semibold text-text-primary mb-2">配置完成！</h2>
                <p className="text-text-secondary text-sm">
                  {config.mode === 'demo'
                    ? '演示模式已激活，你可以体验全部功能。随时可在设置中切换为实时模式。'
                    : '实时模式已配置，数据将通过 WebSocket 从 OpenClaw Gateway 获取。'}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-surface-bg text-left space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-secondary">运行模式</span>
                  <span className="text-text-primary font-medium">{modeInfo.icon} {modeInfo.name}</span>
                </div>
                {config.mode === 'realtime' && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-text-secondary">网关地址</span>
                      <span className="text-text-primary font-medium font-mono text-xs">{config.gatewayUrl}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-secondary">认证方式</span>
                      <span className="text-text-primary font-medium">
                        {config.authType === 'token' ? '🔑 Token' : '🔒 密码'}
                      </span>
                    </div>
                    {snapshot && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-text-secondary">Gateway 运行</span>
                          <span className="text-accent-green font-medium">{formatUptime(snapshot.uptimeMs)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-secondary">在线客户端</span>
                          <span className="text-text-primary font-medium">{snapshot.presence.length}</span>
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
              <button
                onClick={() => {
                  clientRef.current?.disconnect()
                  navigate('/')
                }}
                className="btn-primary inline-block w-full text-center"
              >
                进入 claw-ops →
              </button>
            </div>
          )}

          {/* Navigation */}
          {step !== 'done' && step !== 'test' && (
            <div className="flex justify-between mt-8 pt-6 border-t border-surface-border">
              <button
                onClick={prev}
                disabled={currentIdx === 0}
                className="btn-secondary disabled:opacity-30 disabled:cursor-not-allowed"
              >
                ← 上一步
              </button>
              <button onClick={next} className="btn-primary">
                {config.mode !== 'realtime' && step === 'mode' ? '直接开始 →' : '下一步 →'}
              </button>
            </div>
          )}
          {step === 'test' && (
            <div className="flex justify-between mt-8 pt-6 border-t border-surface-border">
              <button onClick={prev} className="btn-secondary">← 上一步</button>
              {testStatus === 'success' && (
                <button onClick={() => setStep('done')} className="btn-primary">完成 →</button>
              )}
            </div>
          )}
        </div>

        {/* Footer hint */}
        <p className="text-center text-xs text-text-muted mt-6">
          配置保存在浏览器本地 · 可随时在设置中修改 · GPLv3 开源
        </p>
      </div>
    </div>
  )
}
