export interface BridgeCapabilityFlags {
  snapshot: boolean
  presence: boolean
  agentCrud: boolean
  agentFiles: boolean
  skillInstall: boolean
  sessionMutations: boolean
  approvals: boolean
  realtimeEvents: boolean
  cronCrud: boolean
  usage: boolean
  logs: boolean
}

export interface BridgeCapabilities {
  supported: BridgeCapabilityFlags
  methods: string[]
  detectedAt: number
}

export interface BridgeHealthResponse {
  ok: boolean
  bridgeVersion: string
  cliVersion?: string
  detectedAt: number
  uptimeMs?: number
  configPath?: string
  openclawHome?: string
  defaultAgentId?: string
  agentsCount: number
  sessionsCount: number
  channelsConfigured: number
  channelsRunning: number
  capabilities: BridgeCapabilities
}

export interface BridgeRpcError {
  code: string
  message: string
  details?: unknown
}

export interface BridgeRpcResponse<T = unknown> {
  ok: boolean
  result?: T
  error?: BridgeRpcError
}
