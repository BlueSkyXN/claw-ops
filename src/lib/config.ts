// claw-ops 连接配置
// 支持三种运行模式：standalone / demo / realtime
// realtime 模式通过 WebSocket JSON-RPC 连接 OpenClaw Gateway

import type { GatewayScope, AuthMode } from '../types/openclaw'

export type AppMode = 'standalone' | 'demo' | 'realtime'

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
  // 请求的权限范围
  scopes: GatewayScope[]
  // 数据刷新间隔 (秒，用于 mock 模式的模拟刷新)
  refreshInterval: number
  // 兼容字段：standalone/demo → true, realtime → false
  useMockData: boolean
  // 连接后由 gateway 报告的认证模式
  detectedAuthMode?: AuthMode
}

const STORAGE_KEY = 'claw-ops-config'

function getEnvMode(): AppMode | null {
  try {
    const envMode = import.meta.env.VITE_APP_MODE as string | undefined
    if (envMode === 'standalone' || envMode === 'demo' || envMode === 'realtime') {
      return envMode
    }
  } catch {
    // ignore
  }
  return null
}

const DEFAULT_CONFIG: OpenClawConfig = {
  mode: getEnvMode() ?? 'standalone',
  gatewayUrl: 'ws://127.0.0.1:18789',
  authType: 'token',
  authToken: '',
  authPassword: '',
  scopes: ['operator.read', 'operator.write'],
  refreshInterval: 30,
  useMockData: true,
}

function normalizeConfig(raw: Partial<OpenClawConfig>): OpenClawConfig {
  const config = { ...DEFAULT_CONFIG, ...raw }
  config.useMockData = config.mode !== 'realtime'
  // 迁移旧 http URL 到 ws
  if (config.gatewayUrl.startsWith('http://')) {
    config.gatewayUrl = config.gatewayUrl.replace('http://', 'ws://')
  } else if (config.gatewayUrl.startsWith('https://')) {
    config.gatewayUrl = config.gatewayUrl.replace('https://', 'wss://')
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
  config.useMockData = config.mode !== 'realtime'
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
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
  if (config.mode !== 'realtime') return false
  if (!config.gatewayUrl) return false
  if (config.authType === 'token' && !config.authToken) return false
  if (config.authType === 'password' && !config.authPassword) return false
  return true
}

export function getDefaultConfig(): OpenClawConfig {
  return normalizeConfig({})
}

export function isMockMode(config: OpenClawConfig): boolean {
  return config.mode !== 'realtime'
}

export const MODE_LABELS: Record<AppMode, { name: string; icon: string; desc: string }> = {
  standalone: { name: '独立开发', icon: '🖥️', desc: '纯 Web 看板，内置 Mock 数据' },
  demo:       { name: '演示模式', icon: '🎭', desc: '完整 Mock 数据演示体验' },
  realtime:   { name: '实时模式', icon: '🔗', desc: 'WebSocket 连接 OpenClaw Gateway' },
}
