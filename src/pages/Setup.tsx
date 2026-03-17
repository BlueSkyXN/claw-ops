import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  loadConfig,
  saveConfig,
  usesBridgeTransport,
  usesGatewayTransport,
  type OpenClawConfig,
  type AppMode,
  MODE_LABELS,
} from '../lib/config'
import { getBridgeHealth } from '../lib/bridge-client'
import { GatewayClient, buildGatewayClientOptionsFromConfig, type ConnectionState } from '../lib/gateway-client'
import type { BridgeHealthResponse } from '../types/bridge'
import type { Snapshot } from '../types/openclaw'

type Step = 'mode' | 'connection' | 'test' | 'done'

const STEPS: { key: Step; label: string; icon: string }[] = [
  { key: 'mode', label: '运行模式', icon: '🎯' },
  { key: 'connection', label: '连接配置', icon: '🔌' },
  { key: 'test', label: '连接测试', icon: '🧪' },
  { key: 'done', label: '完成', icon: '✅' },
]

const MODE_OPTIONS: { mode: AppMode; icon: string; title: string; desc: string; tag?: string }[] = [
  { mode: 'demo', icon: '🎭', title: '演示体验', desc: '内置 Mock 数据驱动所有功能，即刻上手体验', tag: '推荐' },
  { mode: 'realtime', icon: '🔗', title: '实时对接', desc: '通过 WebSocket 连接 OpenClaw Gateway，获取真实智能体运行数据' },
  { mode: 'cli', icon: '⌨️', title: 'CLI 对接', desc: '通过本地 bridge 调用 openclaw CLI 与本地 workspace，不直接暴露浏览器到本机文件系统' },
  { mode: 'hybrid', icon: '🪢', title: '混合模式', desc: 'bridge 负责本地 CLI / agent files，Gateway 保留实时观测与控制能力' },
]

const CAPABILITY_ITEMS: Array<{ key: keyof BridgeHealthResponse['capabilities']['supported']; label: string }> = [
  { key: 'agentFiles', label: 'Agent 文件读写' },
  { key: 'agentCrud', label: 'Agent 创建 / 更新 / 删除' },
  { key: 'cronCrud', label: 'Cron 管理' },
  { key: 'logs', label: '日志读取' },
  { key: 'sessionMutations', label: '会话 patch / reset / delete' },
  { key: 'approvals', label: '审批读取 / 处理' },
  { key: 'realtimeEvents', label: '实时事件订阅' },
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

function formatBridgeErrorMessage(rawMessage: string): string {
  const message = rawMessage.trim()
  return `Bridge 连接失败：${message || '未知错误'}`
}

function ConnectionSummaryCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="p-3 rounded-lg bg-surface-card border border-surface-border text-center">
      <div className="text-lg font-bold text-accent-blue break-words">{value}</div>
      <div className="text-[11px] text-text-muted mt-1">{label}</div>
      {hint && <div className="text-[10px] text-text-muted mt-1">{hint}</div>}
    </div>
  )
}

export default function Setup() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('mode')
  const [config, setConfig] = useState<OpenClawConfig>(loadConfig())
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'fail'>('idle')
  const [testMessage, setTestMessage] = useState('')
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [bridgeHealth, setBridgeHealth] = useState<BridgeHealthResponse | null>(null)
  const [connState, setConnState] = useState<ConnectionState>('disconnected')
  const clientRef = useRef<GatewayClient | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setConfig(loadConfig())
  }, [])

  useEffect(() => {
    return () => {
      clientRef.current?.disconnect()
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  const currentIdx = STEPS.findIndex((entry) => entry.key === step)
  const modeInfo = MODE_LABELS[config.mode]
  const bridgeEnabled = usesBridgeTransport(config)
  const gatewayEnabled = usesGatewayTransport(config)

  const testTargets = useMemo(() => [
    ...(bridgeEnabled ? [{ icon: '⌨️', label: '本地 Bridge', detail: config.bridgeUrl }] : []),
    ...(gatewayEnabled ? [{ icon: '🔗', label: 'Gateway', detail: config.gatewayUrl }] : []),
  ], [bridgeEnabled, gatewayEnabled, config.bridgeUrl, config.gatewayUrl])

  const update = (partial: Partial<OpenClawConfig>) => {
    setConfig((prev) => ({ ...prev, ...partial }))
  }

  const selectMode = (mode: AppMode) => {
    update({ mode, useMockData: mode === 'demo' })
  }

  const resetTransientTestState = () => {
    clientRef.current?.disconnect()
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setTestStatus('idle')
    setTestMessage('')
    setSnapshot(null)
    setBridgeHealth(null)
    setConnState('disconnected')
  }

  const next = () => {
    if (config.mode === 'demo' && step === 'mode') {
      saveConfig({ ...config, useMockData: true })
      setStep('done')
      return
    }
    const idx = STEPS.findIndex((entry) => entry.key === step)
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1].key)
  }

  const prev = () => {
    if (step === 'test') {
      resetTransientTestState()
    }
    const idx = STEPS.findIndex((entry) => entry.key === step)
    if (idx > 0) setStep(STEPS[idx - 1].key)
  }

  const testGatewayConnection = useCallback((currentConfig: OpenClawConfig) => {
    return new Promise<Snapshot>((resolve, reject) => {
      clientRef.current?.disconnect()
      if (timeoutRef.current) clearTimeout(timeoutRef.current)

      let settled = false
      const settle = (action: () => void) => {
        if (settled) return
        settled = true
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        action()
      }

      const client = new GatewayClient({
        ...buildGatewayClientOptionsFromConfig(currentConfig),
        reconnect: false,
        onStateChange: (state) => {
          setConnState(state)
          if (state === 'connecting') {
            setTestMessage(bridgeEnabled ? 'Bridge 已连通，正在建立 Gateway WebSocket 连接...' : '正在建立 WebSocket 连接...')
          }
        },
        onSnapshot: (nextSnapshot) => {
          settle(() => resolve(nextSnapshot))
        },
        onError: (err) => {
          settle(() => reject(err))
        },
      })

      clientRef.current = client

      try {
        client.connect()
      } catch (err) {
        settle(() => reject(err))
        return
      }

      timeoutRef.current = setTimeout(() => {
        client.disconnect()
        settle(() => reject(new Error('未能在 10 秒内完成 Gateway 握手'))) 
      }, 10000)
    })
  }, [bridgeEnabled])

  const runTest = useCallback(async () => {
    resetTransientTestState()
    setTestStatus('testing')
    setTestMessage(
      bridgeEnabled && gatewayEnabled
        ? '正在依次测试 Bridge 与 Gateway...'
        : bridgeEnabled
          ? '正在连接本地 Bridge...'
          : '正在建立 WebSocket 连接...'
    )

    try {
      let nextBridgeHealth: BridgeHealthResponse | null = null
      let nextSnapshot: Snapshot | null = null

      if (bridgeEnabled) {
        setTestMessage('正在连接本地 Bridge...')
        nextBridgeHealth = await getBridgeHealth(config)
        setBridgeHealth(nextBridgeHealth)
      }

      if (gatewayEnabled) {
        nextSnapshot = await testGatewayConnection(config)
        setSnapshot(nextSnapshot)
      }

      saveConfig({
        ...config,
        useMockData: config.mode === 'demo',
        bridgeCapabilities: nextBridgeHealth?.capabilities ?? config.bridgeCapabilities ?? null,
      })

      setTestStatus('success')
      if (bridgeEnabled && gatewayEnabled) {
        setTestMessage('Bridge 与 Gateway 均连接成功。')
      } else if (bridgeEnabled) {
        setTestMessage('Bridge 连接成功。')
      } else {
        setTestMessage('Gateway 连接成功。')
      }
    } catch (err) {
      setTestStatus('fail')
      const message = err instanceof Error ? err.message : '未知错误'
      if (bridgeEnabled && !gatewayEnabled) {
        setTestMessage(formatBridgeErrorMessage(message))
      } else if (gatewayEnabled && !bridgeEnabled) {
        setTestMessage(formatConnectionErrorMessage(message))
      } else if (!snapshot) {
        setTestMessage(formatBridgeErrorMessage(message))
      } else {
        setTestMessage(formatConnectionErrorMessage(message))
      }
    }
  }, [bridgeEnabled, config, gatewayEnabled, snapshot, testGatewayConnection])

  const skipTest = () => {
    clientRef.current?.disconnect()
    saveConfig({
      ...config,
      useMockData: config.mode === 'demo',
      bridgeCapabilities: bridgeHealth?.capabilities ?? config.bridgeCapabilities ?? null,
    })
    setStep('done')
  }

  return (
    <div className="min-h-screen bg-surface-bg flex items-center justify-center p-8">
      <div className="w-full max-w-3xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-brand-500 to-accent-purple bg-clip-text text-transparent">
            claw-ops
          </h1>
          <p className="text-text-secondary mt-1">Multi-Agent Operations Dashboard · 初始配置</p>
        </div>

        <div className="flex items-center justify-center gap-1 mb-8">
          {STEPS.map((entry, index) => (
            <div key={entry.key} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                  index < currentIdx
                    ? 'bg-accent-green text-white'
                    : index === currentIdx
                      ? 'bg-brand-500 text-white shadow-md'
                      : 'bg-surface-hover text-text-muted'
                }`}
              >
                {index < currentIdx ? '✓' : entry.icon}
              </div>
              {index < STEPS.length - 1 && (
                <div className={`w-12 h-0.5 mx-1 ${index < currentIdx ? 'bg-accent-green' : 'bg-surface-border'}`} />
              )}
            </div>
          ))}
        </div>

        <div className="card p-8">
          {step === 'mode' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-text-primary mb-2">选择运行模式</h2>
                <p className="text-text-secondary text-sm">
                  claw-ops 既可以独立运行，也可以连接真实 OpenClaw。CLI / Hybrid 模式通过本地 bridge 隔离浏览器与本机文件系统的边界。
                </p>
              </div>
              <div className="space-y-3">
                {MODE_OPTIONS.map((option) => (
                  <button
                    key={option.mode}
                    onClick={() => selectMode(option.mode)}
                    className={`w-full p-5 rounded-xl border-2 text-left transition-all flex items-start gap-4 ${
                      config.mode === option.mode
                        ? 'border-brand-500 bg-brand-50 shadow-md'
                        : 'border-surface-border hover:border-brand-300 hover:bg-surface-hover'
                    }`}
                  >
                    <div className="text-2xl flex-shrink-0 mt-0.5">{option.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-text-primary">{option.title}</span>
                        {option.tag && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent-green/15 text-accent-green font-medium">
                            {option.tag}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-text-secondary mt-1">{option.desc}</div>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mt-1 flex items-center justify-center ${
                      config.mode === option.mode ? 'border-brand-500' : 'border-surface-border'
                    }`}>
                      {config.mode === option.mode && <div className="w-2.5 h-2.5 rounded-full bg-brand-500" />}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 'connection' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-text-primary mb-2">连接配置</h2>
                <p className="text-text-secondary text-sm">
                  {config.mode === 'realtime' && '配置 Gateway WebSocket 地址和认证方式。'}
                  {config.mode === 'cli' && '配置本地 bridge 地址与访问令牌，bridge 将代表浏览器调用 openclaw CLI。'}
                  {config.mode === 'hybrid' && '同时配置 bridge 与 Gateway。推荐先保证 bridge 可用，再接入 Gateway 实时能力。'}
                </p>
              </div>

              {bridgeEnabled && (
                <div className="rounded-2xl border border-surface-border bg-surface-bg p-5 space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary">⌨️ 本地 Bridge</h3>
                    <p className="text-xs text-text-secondary mt-1">浏览器只访问 bridge HTTP 接口，bridge 再调用本机 `openclaw` CLI 与读取 agent workspace。</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-2">Bridge URL</label>
                    <input
                      type="url"
                      value={config.bridgeUrl}
                      onChange={(event) => update({ bridgeUrl: event.target.value })}
                      placeholder="http://127.0.0.1:18796"
                      className="w-full px-4 py-3 rounded-xl border border-surface-border bg-white text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all font-mono text-sm"
                    />
                    <p className="text-xs text-text-muted mt-2">推荐把 bridge 绑定到 `127.0.0.1` 并启用 token 校验。</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-2">Bridge Token（可选）</label>
                    <input
                      type="password"
                      value={config.bridgeAuthToken}
                      onChange={(event) => update({ bridgeAuthToken: event.target.value })}
                      placeholder="若 bridge 启用了认证，请填写令牌"
                      className="w-full px-4 py-3 rounded-xl border border-surface-border bg-white text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all"
                    />
                  </div>
                </div>
              )}

              {gatewayEnabled && (
                <div className="rounded-2xl border border-surface-border bg-surface-bg p-5 space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary">🔗 OpenClaw Gateway</h3>
                    <p className="text-xs text-text-secondary mt-1">保持当前 WebSocket 握手与作用域模型不变，Hybrid 模式仍通过 Gateway 获得实时快照与事件流。</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-2">Gateway URL</label>
                    <input
                      type="url"
                      value={config.gatewayUrl}
                      onChange={(event) => update({ gatewayUrl: event.target.value })}
                      placeholder="ws://127.0.0.1:18789"
                      className="w-full px-4 py-3 rounded-xl border border-surface-border bg-white text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all font-mono text-sm"
                    />
                    <p className="text-xs text-text-muted mt-2">支持 ws:// 或 wss:// 协议，将自动追加 `/api/gateway` 路径。</p>
                  </div>

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

                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-2">
                      {config.authType === 'token' ? 'Auth Token' : '密码'}
                    </label>
                    <input
                      type="password"
                      value={config.authType === 'token' ? config.authToken : config.authPassword}
                      onChange={(event) =>
                        config.authType === 'token'
                          ? update({ authToken: event.target.value })
                          : update({ authPassword: event.target.value })
                      }
                      placeholder={config.authType === 'token' ? '输入认证 Token...' : '输入密码...'}
                      className="w-full px-4 py-3 rounded-xl border border-surface-border bg-white text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-all"
                    />
                    <p className="text-xs text-text-muted mt-2">
                      凭据仅保存在浏览器本地，不会上传到任何第三方。留空则不发送认证信息。
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 'test' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-text-primary mb-2">连接测试</h2>
                <p className="text-text-secondary text-sm">
                  按当前模式测试 bridge / Gateway，并记录 bridge 能力矩阵，供 CLI 模式下的页面降级判断使用。
                </p>
              </div>

              <div className="p-6 rounded-xl border border-surface-border bg-surface-bg space-y-4">
                {testStatus === 'idle' && (
                  <div className="text-center space-y-3">
                    <div className="text-4xl">🧪</div>
                    <p className="text-text-secondary">点击下方按钮开始测试当前连接配置</p>
                    <div className="space-y-1 text-xs text-text-muted font-mono">
                      {testTargets.map((target) => (
                        <div key={target.label}>{target.icon} {target.label}: {target.detail}</div>
                      ))}
                    </div>
                  </div>
                )}

                {testStatus === 'testing' && (
                  <div className="text-center space-y-3">
                    <div className="text-4xl animate-bounce">📡</div>
                    <p className="text-text-secondary">{testMessage}</p>
                    {gatewayEnabled && (
                      <div className="flex items-center justify-center gap-2 text-xs text-text-muted">
                        <span className={`w-2 h-2 rounded-full animate-pulse ${connState === 'connecting' ? 'bg-accent-yellow' : 'bg-accent-blue'}`} />
                        <span>{connState === 'connecting' ? '正在握手...' : connState}</span>
                      </div>
                    )}
                  </div>
                )}

                {testStatus === 'success' && (
                  <div className="space-y-5">
                    <div className="text-center">
                      <div className="text-4xl mb-2">✅</div>
                      <p className="text-accent-green font-medium">{testMessage}</p>
                    </div>

                    {bridgeHealth && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="badge badge-blue">Bridge</span>
                          <span className="text-xs text-text-secondary">已通过本地 HTTP bridge 连通 `openclaw` CLI</span>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <ConnectionSummaryCard label="Bridge 版本" value={bridgeHealth.bridgeVersion} hint={bridgeHealth.cliVersion ? `openclaw ${bridgeHealth.cliVersion}` : undefined} />
                          <ConnectionSummaryCard label="可见智能体" value={String(bridgeHealth.agentsCount)} />
                          <ConnectionSummaryCard label="可见会话" value={String(bridgeHealth.sessionsCount)} />
                        </div>
                        <div className="rounded-xl border border-surface-border bg-white p-4">
                          <div className="flex flex-wrap gap-2">
                            {CAPABILITY_ITEMS.map((item) => {
                              const supported = bridgeHealth.capabilities.supported[item.key]
                              return (
                                <span
                                  key={item.key}
                                  className={`text-[11px] px-2.5 py-1 rounded-full border ${supported ? 'bg-pastel-green/30 text-accent-green border-accent-green/20' : 'bg-pastel-red/20 text-accent-red border-accent-red/20'}`}
                                >
                                  {supported ? '✓' : '✕'} {item.label}
                                </span>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    )}

                    {snapshot && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="badge badge-purple">Gateway</span>
                          <span className="text-xs text-text-secondary">WebSocket 握手与快照拉取成功</span>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <ConnectionSummaryCard label="运行时间" value={formatUptime(snapshot.uptimeMs)} />
                          <ConnectionSummaryCard label="认证模式" value={snapshot.authMode ?? 'none'} />
                          <ConnectionSummaryCard label="在线客户端" value={String(snapshot.presence.length)} />
                        </div>
                      </div>
                    )}

                    {config.mode === 'cli' && bridgeHealth && !bridgeHealth.capabilities.supported.sessionMutations && (
                      <div className="rounded-xl border border-accent-yellow/30 bg-pastel-yellow/20 px-4 py-3 text-xs text-accent-yellow">
                        当前 CLI 模式不支持会话 patch / reset / delete 与审批处理；相关按钮会明确降级，而不是伪装成功。
                      </div>
                    )}
                  </div>
                )}

                {testStatus === 'fail' && (
                  <div className="text-center space-y-3">
                    <div className="text-4xl">❌</div>
                    <p className="text-accent-red font-medium text-sm">{testMessage}</p>
                    <p className="text-xs text-text-muted">请检查 bridge / gateway 地址、认证信息与 OpenClaw 本地环境，或跳过测试稍后配置。</p>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button onClick={runTest} className="btn-primary flex-1" disabled={testStatus === 'testing'}>
                  {testStatus === 'testing' ? '测试中...' : testStatus === 'fail' ? '重新测试' : '开始测试'}
                </button>
                <button onClick={skipTest} className="btn-secondary flex-1">
                  跳过，直接完成
                </button>
              </div>
            </div>
          )}

          {step === 'done' && (
            <div className="space-y-6 text-center">
              <div className="text-5xl">🎉</div>
              <div>
                <h2 className="text-xl font-semibold text-text-primary mb-2">配置完成！</h2>
                <p className="text-text-secondary text-sm">{modeInfo.desc}</p>
              </div>
              <div className="p-4 rounded-xl bg-surface-bg text-left space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-text-secondary">运行模式</span>
                  <span className="text-text-primary font-medium">{modeInfo.icon} {modeInfo.name}</span>
                </div>
                {bridgeEnabled && (
                  <>
                    <div className="flex justify-between gap-3">
                      <span className="text-text-secondary">Bridge 地址</span>
                      <span className="text-text-primary font-medium font-mono text-xs break-all text-right">{config.bridgeUrl}</span>
                    </div>
                    {bridgeHealth && (
                      <div className="flex justify-between gap-3">
                        <span className="text-text-secondary">Bridge 可见智能体 / 会话</span>
                        <span className="text-text-primary font-medium">{bridgeHealth.agentsCount} / {bridgeHealth.sessionsCount}</span>
                      </div>
                    )}
                  </>
                )}
                {gatewayEnabled && (
                  <>
                    <div className="flex justify-between gap-3">
                      <span className="text-text-secondary">Gateway 地址</span>
                      <span className="text-text-primary font-medium font-mono text-xs break-all text-right">{config.gatewayUrl}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-text-secondary">认证方式</span>
                      <span className="text-text-primary font-medium">{config.authType === 'token' ? '🔑 Token' : '🔒 密码'}</span>
                    </div>
                    {snapshot && (
                      <div className="flex justify-between gap-3">
                        <span className="text-text-secondary">Gateway 在线客户端</span>
                        <span className="text-text-primary font-medium">{snapshot.presence.length}</span>
                      </div>
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
                {config.mode === 'demo' && step === 'mode' ? '直接开始 →' : '下一步 →'}
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

        <p className="text-center text-xs text-text-muted mt-6">
          配置保存在浏览器本地 · 可随时在设置中修改 · GPLv3 开源
        </p>
      </div>
    </div>
  )
}
