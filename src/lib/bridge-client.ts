import { loadConfig, usesBridgeTransport, type OpenClawConfig } from './config'
import type { BridgeCapabilities, BridgeHealthResponse, BridgeRpcResponse } from '../types/bridge'

const BRIDGE_TOKEN_HEADER = 'X-Claw-Ops-Bridge-Token'

function normalizeBridgeBaseUrl(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed
}

function buildBridgeUrl(baseUrl: string, pathname: string): string {
  const normalizedBase = normalizeBridgeBaseUrl(baseUrl)
  if (!normalizedBase) {
    throw new Error('Bridge URL 未配置')
  }
  return `${normalizedBase}${pathname}`
}

function buildBridgeHeaders(config: OpenClawConfig): HeadersInit {
  return {
    'Content-Type': 'application/json',
    ...(config.bridgeAuthToken ? { [BRIDGE_TOKEN_HEADER]: config.bridgeAuthToken } : {}),
  }
}

async function parseBridgeResponse<T>(response: Response): Promise<T> {
  const payload = await response.json() as BridgeRpcResponse<T> | T

  if (!response.ok) {
    const message = (payload as BridgeRpcResponse<T>)?.error?.message
      ?? (payload && typeof payload === 'object' && 'message' in payload && typeof payload.message === 'string' ? payload.message : response.statusText)
    throw new Error(message || 'Bridge 请求失败')
  }

  if (payload && typeof payload === 'object' && 'ok' in payload && 'result' in payload) {
    const bridgePayload = payload as BridgeRpcResponse<T>
    if (!bridgePayload.ok) {
      throw new Error(bridgePayload.error?.message || 'Bridge RPC 请求失败')
    }
    return bridgePayload.result as T
  }

  return payload as T
}

export async function bridgeFetch<T>(pathname: string, init: RequestInit = {}, config: OpenClawConfig = loadConfig()): Promise<T> {
  if (!usesBridgeTransport(config)) {
    throw new Error('当前运行模式未启用 Bridge')
  }

  const response = await fetch(buildBridgeUrl(config.bridgeUrl, pathname), {
    ...init,
    headers: {
      ...buildBridgeHeaders(config),
      ...(init.headers ?? {}),
    },
  })

  return parseBridgeResponse<T>(response)
}

export async function bridgeRpc<T>(method: string, params?: object, config: OpenClawConfig = loadConfig()): Promise<T> {
  return bridgeFetch<T>('/rpc', {
    method: 'POST',
    body: JSON.stringify({ method, params }),
  }, config)
}

export async function getBridgeHealth(config: OpenClawConfig = loadConfig()): Promise<BridgeHealthResponse> {
  return bridgeFetch<BridgeHealthResponse>('/health', { method: 'GET' }, config)
}

export async function getBridgeCapabilities(config: OpenClawConfig = loadConfig()): Promise<BridgeCapabilities> {
  return bridgeFetch<BridgeCapabilities>('/capabilities', { method: 'GET' }, config)
}
