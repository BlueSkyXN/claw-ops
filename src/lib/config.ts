// claw-ops 连接配置
// demo: 内置 Mock 数据
// realtime: 仅通过 Gateway WebSocket 连接 OpenClaw
// cli: 仅通过本地 bridge + openclaw CLI 连接 OpenClaw
// hybrid: bridge 负责本地文件/CLI 面，Gateway 保留实时观测与控制

import type { MockExperienceSummary } from '../data/mock-workspace'
import type { GatewayScope, AuthMode } from '../types/openclaw'
import type { BridgeCapabilities } from '../types/bridge'

export type AppMode = 'demo' | 'realtime' | 'cli' | 'hybrid'

export interface OpenClawConfig {
  // 运行模式
  mode: AppMode
  // OpenClaw Gateway 地址 (realtime 模式，如 ws://127.0.0.1:18789)
  gatewayUrl: string
  // 认证方式
  authType: 'token' | 'password'
  // 认证 Token（authType=token 时使用）
  authToken: string
  // 认证密码（authType=password 时使用）
  authPassword: string
  // 本地 bridge 地址（cli / hybrid 模式）
  bridgeUrl: string
  // 本地 bridge 访问令牌（可选）
  bridgeAuthToken: string
  // 最近一次 Setup 连接测试记录到的 bridge 能力
  bridgeCapabilities?: BridgeCapabilities | null
  // 请求的权限范围
  scopes: GatewayScope[]
  // 数据刷新间隔 (秒，用于 mock 模式的模拟刷新)
  refreshInterval: number
  // 兼容字段：demo → true, realtime → false
  useMockData: boolean
  // 实时模式下记录最近一次由控制面导入/激活的团队模板
  activeExperienceTemplateId?: string
  // 网关未回写 experience 时，保留一份本地体验摘要供 UI 恢复
  activeExperienceSummary?: MockExperienceSummary | null
  // 连接后由 gateway 报告的认证模式
  detectedAuthMode?: AuthMode
}

const STORAGE_KEY = 'claw-ops-config'
const REQUIRED_GATEWAY_SCOPES: GatewayScope[] = ['operator.read', 'operator.write', 'operator.admin']

function getEnvMode(): AppMode | null {
  try {
    const envMode = import.meta.env.VITE_APP_MODE as string | undefined
    if (envMode === 'demo' || envMode === 'realtime' || envMode === 'cli' || envMode === 'hybrid') {
      return envMode
    }
    // 兼容旧配置：standalone 映射为 demo
    if (envMode === 'standalone') return 'demo'
  } catch {
    // ignore
  }
  return null
}

const DEFAULT_CONFIG: OpenClawConfig = {
  mode: getEnvMode() ?? 'demo',
  gatewayUrl: 'ws://127.0.0.1:18789',
  authType: 'token',
  authToken: '',
  authPassword: '',
  bridgeUrl: 'http://127.0.0.1:18796',
  bridgeAuthToken: '',
  bridgeCapabilities: null,
  scopes: REQUIRED_GATEWAY_SCOPES,
  refreshInterval: 30,
  useMockData: true,
}

function normalizeScopes(scopes?: GatewayScope[]): GatewayScope[] {
  const normalized = new Set<GatewayScope>(scopes ?? [])
  for (const scope of REQUIRED_GATEWAY_SCOPES) {
    normalized.add(scope)
  }
  return Array.from(normalized)
}

function normalizeConfig(raw: Partial<OpenClawConfig>): OpenClawConfig {
  const config = { ...DEFAULT_CONFIG, ...raw }
  config.scopes = normalizeScopes(config.scopes)
  // 兼容旧配置：standalone 映射为 demo
  if ((config.mode as string) === 'standalone') config.mode = 'demo'
  config.useMockData = config.mode === 'demo'
  // 迁移旧 http URL 到 ws
  if (config.gatewayUrl.startsWith('http://')) {
    config.gatewayUrl = config.gatewayUrl.replace('http://', 'ws://')
  } else if (config.gatewayUrl.startsWith('https://')) {
    config.gatewayUrl = config.gatewayUrl.replace('https://', 'wss://')
  }
  if (config.bridgeUrl.endsWith('/')) {
    config.bridgeUrl = config.bridgeUrl.replace(/\/+$/, '')
  }
  return config
}

export function loadConfig(): OpenClawConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return normalizeConfig(JSON.parse(stored))
    }
  } catch {
    // ignore parse errors
  }
  return normalizeConfig({})
}

export function saveConfig(config: OpenClawConfig): void {
  const normalized = normalizeConfig(config)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized))
  } catch {
    // localStorage 可能在隐私模式或存储满时抛出异常
    console.warn('Failed to save config to localStorage')
  }
}

export function clearConfig(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // localStorage 可能不可用
  }
}

export function isConfigured(): boolean {
  const config = loadConfig()
  if (config.mode === 'demo') return true
  if (usesBridgeTransport(config) && !config.bridgeUrl) return false
  if (usesGatewayTransport(config) && !config.gatewayUrl) return false
  return true
}

export function getDefaultConfig(): OpenClawConfig {
  return normalizeConfig({})
}

export function isMockMode(config: OpenClawConfig): boolean {
  return config.mode === 'demo'
}

export function usesGatewayTransport(config: OpenClawConfig): boolean {
  return config.mode === 'realtime' || config.mode === 'hybrid'
}

export function usesBridgeTransport(config: OpenClawConfig): boolean {
  return config.mode === 'cli' || config.mode === 'hybrid'
}

export interface RuntimeCapabilitySummary {
  realtimeEvents: boolean
  sessionMutations: boolean
  approvals: boolean
  agentFiles: boolean
  bridgeEnabled: boolean
  gatewayEnabled: boolean
}

export function getRuntimeCapabilities(config: OpenClawConfig = loadConfig()): RuntimeCapabilitySummary {
  if (config.mode === 'demo') {
    return {
      realtimeEvents: false,
      sessionMutations: true,
      approvals: true,
      agentFiles: true,
      bridgeEnabled: false,
      gatewayEnabled: false,
    }
  }

  if (config.mode === 'realtime') {
    return {
      realtimeEvents: true,
      sessionMutations: true,
      approvals: true,
      agentFiles: true,
      bridgeEnabled: false,
      gatewayEnabled: true,
    }
  }

  if (config.mode === 'hybrid') {
    return {
      realtimeEvents: true,
      sessionMutations: true,
      approvals: true,
      agentFiles: true,
      bridgeEnabled: true,
      gatewayEnabled: true,
    }
  }

  const bridgeSupported = config.bridgeCapabilities?.supported
  return {
    realtimeEvents: false,
    sessionMutations: Boolean(bridgeSupported?.sessionMutations),
    approvals: Boolean(bridgeSupported?.approvals),
    agentFiles: Boolean(bridgeSupported?.agentFiles),
    bridgeEnabled: true,
    gatewayEnabled: false,
  }
}

export const MODE_LABELS: Record<AppMode, { name: string; icon: string; desc: string }> = {
  demo:     { name: '演示模式', icon: '🎭', desc: '内置 Mock 数据，即刻体验全部功能' },
  realtime: { name: '实时模式', icon: '🔗', desc: '仅通过 Gateway WebSocket 对接 OpenClaw' },
  cli:      { name: 'CLI 模式', icon: '⌨️', desc: '通过本地 bridge + openclaw CLI 读取与管理 OpenClaw' },
  hybrid:   { name: '混合模式', icon: '🪢', desc: 'bridge 负责本地 CLI/文件能力，Gateway 保留实时观测与控制' },
}
