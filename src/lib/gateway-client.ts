// OpenClaw Gateway WebSocket JSON-RPC 客户端
// 实现 OpenClaw 协议的连接、认证、请求/响应、事件订阅

import type {
  ConnectParams,
  HelloOk,
  GatewayClientId,
  GatewayScope,
  GatewayClientMode,
  ResponseFrame,
  EventFrame,
  ErrorShape,
  Snapshot,
  PresenceEntry,
} from '../types/openclaw'

const PROTOCOL_VERSION = 3
const DEFAULT_GATEWAY_CLIENT_ID: GatewayClientId = 'openclaw-control-ui'

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error'

export interface GatewayClientOptions {
  url: string
  token?: string
  password?: string
  scopes?: GatewayScope[]
  clientName?: GatewayClientId
  clientDisplayName?: string
  clientMode?: GatewayClientMode
  instanceId?: string
  onStateChange?: (state: ConnectionState) => void
  onEvent?: (event: string, payload: unknown) => void
  onSnapshot?: (snapshot: Snapshot) => void
  onError?: (error: Error) => void
  reconnect?: boolean
  reconnectInterval?: number
}

type PendingRequest = {
  resolve: (result: unknown) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}

export class GatewayClient {
  private ws: WebSocket | null = null
  private state: ConnectionState = 'disconnected'
  private options: GatewayClientOptions
  private pendingRequests = new Map<string, PendingRequest>()
  private requestCounter = 0
  private snapshot: Snapshot | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private eventListeners = new Map<string, Set<(payload: unknown) => void>>()
  private intentionalClose = false
  // 服务器在连接时发送的 challenge nonce，客户端必须在 connect 时引用
  private challengeNonce: string | null = null

  constructor(options: GatewayClientOptions) {
    this.options = {
      scopes: ['operator.read', 'operator.write'],
      clientName: DEFAULT_GATEWAY_CLIENT_ID,
      clientDisplayName: 'claw-ops',
      clientMode: 'webchat',
      instanceId: crypto.randomUUID(),
      reconnect: true,
      reconnectInterval: 3000,
      ...options,
    }
  }

  get connectionState(): ConnectionState {
    return this.state
  }

  get currentSnapshot(): Snapshot | null {
    return this.snapshot
  }

  get isConnected(): boolean {
    return this.state === 'connected'
  }

  // 连接到 Gateway
  connect(): void {
    if (this.ws) {
      this.disconnect()
    }
    this.intentionalClose = false
    this.challengeNonce = null
    this.setState('connecting')

    const wsUrl = this.normalizeUrl(this.options.url)
    try {
      this.ws = new WebSocket(wsUrl)
    } catch (err) {
      this.setState('error')
      this.options.onError?.(err instanceof Error ? err : new Error(String(err)))
      return
    }

    // 不在 onopen 发送 connect — 等待服务器的 connect.challenge 事件
    this.ws.onopen = () => {
      // 等待服务器发送 connect.challenge
    }

    this.ws.onmessage = (event) => {
      try {
        const frame = JSON.parse(event.data as string)
        this.handleFrame(frame)
      } catch {
        // ignore parse errors
      }
    }

    this.ws.onerror = () => {
      this.setState('error')
      this.options.onError?.(new Error('WebSocket connection error'))
    }

    this.ws.onclose = () => {
      const wasConnected = this.state === 'connected'
      this.setState('disconnected')
      this.rejectAllPending('Connection closed')
      if (!this.intentionalClose && this.options.reconnect && wasConnected) {
        this.scheduleReconnect()
      }
    }
  }

  // 断开连接
  disconnect(): void {
    this.intentionalClose = true
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.rejectAllPending('Client disconnected')
    this.setState('disconnected')
  }

  // 发送 JSON-RPC 请求 — 帧类型为 "req"，响应为 "res"
  async request<T = unknown>(method: string, params?: object, timeoutMs = 30000): Promise<T> {
    if (!this.ws || this.state !== 'connected') {
      throw new Error('Not connected to gateway')
    }

    const id = `req-${++this.requestCounter}`
    // OpenClaw 协议: 请求帧类型为 "req"
    const frame = {
      type: 'req',
      id,
      method,
      params: params ?? {},
    }

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id)
        reject(new Error(`Request timeout: ${method}`))
      }, timeoutMs)

      this.pendingRequests.set(id, {
        resolve: resolve as (r: unknown) => void,
        reject,
        timer,
      })

      try {
        this.ws!.send(JSON.stringify(frame))
      } catch (err) {
        clearTimeout(timer)
        this.pendingRequests.delete(id)
        reject(err)
      }
    })
  }

  // 监听特定事件
  on(event: string, handler: (payload: unknown) => void): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set())
    }
    this.eventListeners.get(event)!.add(handler)
    return () => {
      this.eventListeners.get(event)?.delete(handler)
    }
  }

  // ==========================================
  // 内部方法
  // ==========================================

  private normalizeUrl(url: string): string {
    let wsUrl = url.replace(/\/+$/, '')
    // http → ws, https → wss
    wsUrl = wsUrl.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:')
    // 如果没有协议前缀
    if (!wsUrl.startsWith('ws://') && !wsUrl.startsWith('wss://')) {
      wsUrl = `ws://${wsUrl}`
    }
    return wsUrl
  }

  // 发送 connect 请求 — 作为标准 req 帧，method 为 "connect"
  private sendConnect(): void {
    const params: ConnectParams = {
      minProtocol: PROTOCOL_VERSION,
      maxProtocol: PROTOCOL_VERSION,
      client: {
        id: this.options.clientName ?? DEFAULT_GATEWAY_CLIENT_ID,
        displayName: this.options.clientDisplayName,
        version: '0.1.0',
        platform: 'web',
        mode: this.options.clientMode || 'webchat',
        instanceId: this.options.instanceId,
      },
      role: 'operator',
      scopes: this.options.scopes,
    }
    // 认证信息嵌套在 auth 对象中
    if (this.options.token || this.options.password) {
      params.auth = {}
      if (this.options.token) {
        params.auth.token = this.options.token
      }
      if (this.options.password) {
        params.auth.password = this.options.password
      }
    }

    const id = `req-${++this.requestCounter}`
    // connect 作为标准 req 帧发送
    const frame = {
      type: 'req',
      id,
      method: 'connect',
      params,
    }

    // 注册 pending request 以接收 hello-ok 作为 res 帧
    this.pendingRequests.set(id, {
      resolve: (result: unknown) => {
        this.handleHelloOk(result as HelloOk)
      },
      reject: (error: Error) => {
        this.setState('error')
        this.options.onError?.(error)
      },
      timer: setTimeout(() => {
        this.pendingRequests.delete(id)
        this.setState('error')
        this.options.onError?.(new Error('Connect handshake timeout'))
      }, 15000),
    })

    this.ws?.send(JSON.stringify(frame))
  }

  private handleFrame(frame: { type: string; [key: string]: unknown }): void {
    switch (frame.type) {
      case 'res':
        this.handleResponse(frame as unknown as ResponseFrame)
        break
      case 'event':
        this.handleEvent(frame as unknown as EventFrame)
        break
      case 'error':
        this.handleProtocolError(frame as unknown as { error: ErrorShape })
        break
    }
  }

  private handleHelloOk(hello: HelloOk): void {
    this.snapshot = hello.snapshot
    this.setState('connected')
    this.options.onSnapshot?.(hello.snapshot)
  }

  private handleResponse(frame: ResponseFrame): void {
    const pending = this.pendingRequests.get(frame.id)
    if (!pending) return

    this.pendingRequests.delete(frame.id)
    clearTimeout(pending.timer)

    if (frame.ok) {
      // OpenClaw 协议: 响应数据字段为 "payload"
      pending.resolve(frame.payload)
    } else {
      const err = frame.error
      pending.reject(new Error(err ? `${err.code}: ${err.message}` : 'Unknown error'))
    }
  }

  private handleEvent(frame: EventFrame): void {
    const { event, payload } = frame

    // 处理 connect.challenge — 服务器在连接后首先发送
    if (event === 'connect.challenge') {
      const challenge = payload as { nonce: string; ts: number } | undefined
      this.challengeNonce = challenge?.nonce ?? null
      // 收到 challenge 后发送 connect 请求
      this.sendConnect()
      return
    }

    // 通知全局回调
    this.options.onEvent?.(event, payload)
    // 通知特定事件监听器
    const listeners = this.eventListeners.get(event)
    if (listeners) {
      for (const handler of listeners) {
        try {
          handler(payload)
        } catch {
          // ignore listener errors
        }
      }
    }

    // 处理内置事件
    if (this.snapshot && event === 'presence') {
      this.snapshot.presence = payload as PresenceEntry[]
      this.snapshot.stateVersion.presence++
    }
  }

  private handleProtocolError(frame: { error: ErrorShape }): void {
    this.setState('error')
    this.options.onError?.(new Error(`Protocol error: ${frame.error.message}`))
    this.disconnect()
  }

  private setState(newState: ConnectionState): void {
    if (this.state !== newState) {
      this.state = newState
      this.options.onStateChange?.(newState)
    }
  }

  private rejectAllPending(reason: string): void {
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timer)
      pending.reject(new Error(reason))
      this.pendingRequests.delete(id)
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      if (this.state === 'disconnected' && !this.intentionalClose) {
        this.connect()
      }
    }, this.options.reconnectInterval)
  }
}

// ==========================================
// 全局单例管理
// ==========================================

let globalClient: GatewayClient | null = null

export function getGatewayClient(): GatewayClient | null {
  return globalClient
}

export function setGatewayClient(client: GatewayClient | null): void {
  if (globalClient && globalClient !== client) {
    globalClient.disconnect()
  }
  globalClient = client
}

export function createGatewayClient(options: GatewayClientOptions): GatewayClient {
  const client = new GatewayClient(options)
  setGatewayClient(client)
  return client
}
