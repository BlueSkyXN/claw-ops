import http from 'node:http'
import { spawn } from 'node:child_process'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'

const BRIDGE_VERSION = '0.1.0'
const BRIDGE_STARTED_AT = Date.now()
const BRIDGE_HOST = process.env.CLAW_OPS_BRIDGE_HOST || '127.0.0.1'
const BRIDGE_PORT = Number.parseInt(process.env.CLAW_OPS_BRIDGE_PORT || '18796', 10)
const BRIDGE_TOKEN = process.env.CLAW_OPS_BRIDGE_TOKEN || ''
const OPENCLAW_BIN = process.env.CLAW_OPS_OPENCLAW_BIN || 'openclaw'
const OPENCLAW_HOME = process.env.CLAW_OPS_OPENCLAW_HOME ? expandHome(process.env.CLAW_OPS_OPENCLAW_HOME) : null
const BRIDGE_REGISTRY_FILE = 'claw-ops-bridge.json'
const WORKSPACE_FILE_EXTENSIONS = new Set(['.md', '.txt', '.json', '.yaml', '.yml'])

const BRIDGE_CAPABILITIES = {
  supported: {
    snapshot: true,
    presence: true,
    agentCrud: true,
    agentFiles: true,
    skillInstall: false,
    sessionMutations: false,
    approvals: false,
    realtimeEvents: false,
    cronCrud: true,
    usage: true,
    logs: true,
  },
  methods: [
    'getHealth',
    'getSnapshot',
    'getPresence',
    'getAgents',
    'createAgent',
    'updateAgent',
    'deleteAgent',
    'agentFilesList',
    'agentFilesGet',
    'agentFilesSet',
    'installSkill',
    'getSessions',
    'patchSession',
    'resetSession',
    'deleteSession',
    'sendChatMessage',
    'getChannelsStatus',
    'getCronJobs',
    'addCronJob',
    'updateCronJob',
    'removeCronJob',
    'runCronJob',
    'getCronRuns',
    'getLogs',
    'getModels',
    'getSkills',
    'getNodes',
    'getConfig',
    'getExecApprovals',
    'resolveExecApproval',
  ],
  detectedAt: Date.now(),
}

class BridgeError extends Error {
  constructor(message, code = 'BRIDGE_ERROR', status = 500, details) {
    super(message)
    this.name = 'BridgeError'
    this.code = code
    this.status = status
    this.details = details
  }
}

function expandHome(value) {
  if (!value) return value
  if (value.startsWith('~/')) {
    return path.join(os.homedir(), value.slice(2))
  }
  return value
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function withCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Claw-Ops-Bridge-Token')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
}

function sendJson(res, status, payload) {
  withCorsHeaders(res)
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(payload))
}

function getRequestToken(req) {
  const header = req.headers['x-claw-ops-bridge-token']
  if (Array.isArray(header)) return header[0] || ''
  return typeof header === 'string' ? header : ''
}

function requireBridgeAuth(req) {
  if (!BRIDGE_TOKEN) return
  if (getRequestToken(req) !== BRIDGE_TOKEN) {
    throw new BridgeError('Bridge token invalid or missing', 'UNAUTHORIZED', 401)
  }
}

async function parseJsonBody(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > 1024 * 1024) {
      throw new BridgeError('Request body too large', 'PAYLOAD_TOO_LARGE', 413)
    }
    chunks.push(chunk)
  }
  if (chunks.length === 0) return {}
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new BridgeError('Request body must be valid JSON', 'INVALID_JSON', 400)
  }
}

function parseJsonLine(line) {
  try {
    return JSON.parse(line)
  } catch {
    return null
  }
}

function tryParseJsonCandidate(text) {
  const trimmed = text.trim()
  if (!trimmed) return null
  try {
    return JSON.parse(trimmed)
  } catch {
    // keep scanning
  }

  for (let index = 0; index < trimmed.length; index += 1) {
    const char = trimmed[index]
    if (char !== '{' && char !== '[') continue
    try {
      return JSON.parse(trimmed.slice(index))
    } catch {
      // keep scanning
    }
  }

  return null
}

function stripAnsi(text) {
  return String(text).replace(/\u001B\[[0-?]*[ -/]*[@-~]/g, '')
}

function readArrayResult(result, key) {
  if (Array.isArray(result)) return result
  if (result && typeof result === 'object' && Array.isArray(result[key])) return result[key]
  return []
}

function extractJsonPayload(stdout, stderr) {
  for (const source of [stdout, stderr, `${stdout}\n${stderr}`]) {
    const parsed = tryParseJsonCandidate(source)
    if (parsed != null) return parsed
  }
  throw new BridgeError('Failed to parse JSON output from openclaw CLI', 'CLI_INVALID_JSON', 502)
}

function extractNdjsonPayload(stdout, stderr) {
  const lines = `${stdout}\n${stderr}`
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  const objects = lines
    .filter((line) => line.startsWith('{') || line.startsWith('['))
    .map(parseJsonLine)
    .filter(Boolean)

  if (objects.length === 0) {
    throw new BridgeError('Failed to parse JSON lines from openclaw CLI', 'CLI_INVALID_JSON_LINES', 502)
  }
  return objects
}

async function runCliRaw(args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(OPENCLAW_BIN, args, {
      env: process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf8')
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8')
    })
    child.on('error', (error) => {
      reject(new BridgeError(`Failed to start openclaw CLI: ${error.message}`, 'CLI_SPAWN_FAILED', 502))
    })
    child.on('close', (code) => {
      const cleanStdout = stripAnsi(stdout)
      const cleanStderr = stripAnsi(stderr)
      if (code !== 0) {
        const message = cleanStderr.trim() || cleanStdout.trim() || `openclaw exited with code ${code}`
        reject(new BridgeError(message, 'CLI_FAILED', 502, { code }))
        return
      }
      resolve({ stdout: cleanStdout, stderr: cleanStderr })
    })

    if (options.stdin) {
      child.stdin.write(options.stdin)
    }
    child.stdin.end()
  })
}

async function runCliJson(args, options = {}) {
  const { stdout, stderr } = await runCliRaw(args, options)
  return extractJsonPayload(stdout, stderr)
}

async function runCliNdjson(args, options = {}) {
  const { stdout, stderr } = await runCliRaw(args, options)
  return extractNdjsonPayload(stdout, stderr)
}

let cachedConfigPath = null

async function getConfigPath() {
  if (OPENCLAW_HOME) {
    return path.join(OPENCLAW_HOME, 'openclaw.json')
  }
  if (cachedConfigPath) return cachedConfigPath
  const { stdout } = await runCliRaw(['config', 'file'])
  const candidate = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .pop()
  if (!candidate) {
    throw new BridgeError('Unable to resolve OpenClaw config path', 'CONFIG_PATH_MISSING', 500)
  }
  cachedConfigPath = candidate
  return cachedConfigPath
}

async function getOpenClawHome() {
  if (OPENCLAW_HOME) return OPENCLAW_HOME
  return path.dirname(await getConfigPath())
}

async function readJsonFile(filePath) {
  const content = await fs.readFile(filePath, 'utf8')
  return JSON.parse(content)
}

async function readJsonFileIfExists(filePath) {
  try {
    return await readJsonFile(filePath)
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return null
    }
    throw error
  }
}

async function loadBridgeRegistry() {
  const home = await getOpenClawHome()
  const filePath = path.join(home, BRIDGE_REGISTRY_FILE)
  const parsed = await readJsonFileIfExists(filePath)
  if (!parsed || typeof parsed !== 'object') {
    return { filePath, data: { version: 1, sessionAliases: {} } }
  }
  const sessionAliases = parsed.sessionAliases && typeof parsed.sessionAliases === 'object' ? parsed.sessionAliases : {}
  return {
    filePath,
    data: {
      version: 1,
      sessionAliases,
    },
  }
}

async function saveBridgeRegistry(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8')
}

function sanitizeHealthSummary(rawHealth, configPath, openclawHome) {
  const agents = Array.isArray(rawHealth?.agents) ? rawHealth.agents : []
  const channels = rawHealth?.channels && typeof rawHealth.channels === 'object' ? Object.values(rawHealth.channels) : []
  const channelsConfigured = channels.filter((entry) => entry && typeof entry === 'object' && entry.configured).length
  const channelsRunning = channels.filter((entry) => entry && typeof entry === 'object' && entry.running).length
  const sessionsCount = agents.reduce((sum, agent) => sum + (agent?.sessions?.count ?? 0), 0)

  return {
    ok: Boolean(rawHealth?.ok),
    bridgeVersion: BRIDGE_VERSION,
    cliVersion: awaitCliVersion,
    detectedAt: Date.now(),
    uptimeMs: Date.now() - BRIDGE_STARTED_AT,
    configPath,
    openclawHome,
    defaultAgentId: typeof rawHealth?.defaultAgentId === 'string' ? rawHealth.defaultAgentId : undefined,
    agentsCount: agents.length,
    sessionsCount,
    channelsConfigured,
    channelsRunning,
    capabilities: BRIDGE_CAPABILITIES,
  }
}

let awaitCliVersion = null

async function getCliVersion() {
  if (awaitCliVersion) return awaitCliVersion
  const { stdout } = await runCliRaw(['--version'])
  awaitCliVersion = stdout.trim() || 'unknown'
  return awaitCliVersion
}

async function getHealthSummary() {
  const [health, configPath, openclawHome, cliVersion] = await Promise.all([
    runCliJson(['health', '--json']),
    getConfigPath(),
    getOpenClawHome(),
    getCliVersion(),
  ])
  awaitCliVersion = cliVersion
  return {
    ok: Boolean(health?.ok),
    bridgeVersion: BRIDGE_VERSION,
    cliVersion,
    detectedAt: Date.now(),
    uptimeMs: Date.now() - BRIDGE_STARTED_AT,
    configPath,
    openclawHome,
    defaultAgentId: typeof health?.defaultAgentId === 'string' ? health.defaultAgentId : undefined,
    agentsCount: Array.isArray(health?.agents) ? health.agents.length : 0,
    sessionsCount: Array.isArray(health?.agents)
      ? health.agents.reduce((sum, agent) => sum + (agent?.sessions?.count ?? 0), 0)
      : 0,
    channelsConfigured: health?.channelOrder?.length ?? 0,
    channelsRunning: Array.isArray(health?.agents) ? Object.values(health?.channels ?? {}).filter((entry) => entry?.running).length : 0,
    capabilities: BRIDGE_CAPABILITIES,
  }
}

function inferChannelFromKey(sessionKey) {
  const parts = String(sessionKey || '').split(':')
  if (parts[0] !== 'agent') return null
  if (!parts[2] || parts[2] === 'main' || parts[2] === 'cron') return null
  return parts[2]
}

function inferLabelFromSession(row) {
  return row.label || row.displayName || row.subject || row.derivedTitle || row.lastMessagePreview || row.key
}

function normalizeDateString(ts, params = {}) {
  if (!ts) return ''
  if (params.mode === 'utc') {
    return new Date(ts).toISOString().slice(0, 10)
  }
  if (params.mode === 'specific' && typeof params.utcOffset === 'string') {
    const match = params.utcOffset.match(/^UTC([+-])(\d{1,2})(?::?(\d{2}))?$/i)
    if (match) {
      const sign = match[1] === '-' ? -1 : 1
      const hours = Number.parseInt(match[2], 10)
      const minutes = Number.parseInt(match[3] || '0', 10)
      const offsetMinutes = sign * (hours * 60 + minutes)
      return new Date(ts + offsetMinutes * 60_000).toISOString().slice(0, 10)
    }
  }
  const local = new Date(ts)
  const year = local.getFullYear()
  const month = `${local.getMonth() + 1}`.padStart(2, '0')
  const day = `${local.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function extractTextFromContent(content) {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .map((item) => {
      if (!item || typeof item !== 'object') return ''
      if (typeof item.text === 'string') return item.text
      if (typeof item.content === 'string') return item.content
      return ''
    })
    .filter(Boolean)
    .join('\n')
}

function isNoisePreview(text) {
  return text.startsWith('✅ New session started') || text.includes('A new session was started via /new or /reset.')
}

async function readSessionMessages(sessionFile, limit = 6) {
  if (!sessionFile) return []
  try {
    const raw = await fs.readFile(sessionFile, 'utf8')
    const lines = raw.split(/\r?\n/).filter(Boolean)
    const entries = []
    for (const line of lines) {
      const parsed = parseJsonLine(line)
      if (!parsed || parsed.type !== 'message' || !parsed.message) continue
      const text = extractTextFromContent(parsed.message.content).trim()
      if (!text) continue
      if (isNoisePreview(text)) continue
      entries.push({
        id: parsed.id || `${parsed.timestamp || Date.now()}`,
        role: parsed.message.role || 'other',
        text,
        timestamp: parsed.message.timestamp || Date.parse(parsed.timestamp || '') || undefined,
      })
    }
    return entries.slice(-limit)
  } catch {
    return []
  }
}

async function readLastMessagePreview(sessionFile) {
  const messages = await readSessionMessages(sessionFile, 4)
  const last = messages[messages.length - 1]
  return last ? last.text.slice(0, 240) : undefined
}

async function loadSessionStoreEntries(stores) {
  const entriesByKey = new Map()
  for (const store of stores || []) {
    if (!store?.path) continue
    const parsed = await readJsonFileIfExists(store.path)
    if (!parsed || typeof parsed !== 'object') continue
    for (const [sessionKey, value] of Object.entries(parsed)) {
      entriesByKey.set(sessionKey, value && typeof value === 'object'
        ? { ...value, __storeAgentId: store.agentId }
        : value)
    }
  }
  return entriesByKey
}

async function loadAgentIndex() {
  const result = await runCliJson(['agents', 'list', '--json'])
  const items = readArrayResult(result, 'agents')
  return {
    defaultId: typeof result?.defaultId === 'string' ? result.defaultId : items.find((agent) => agent.isDefault)?.id || items[0]?.id || 'main',
    mainKey: typeof result?.mainKey === 'string' ? result.mainKey : 'main',
    scope: typeof result?.scope === 'string' ? result.scope : 'global',
    agents: items,
    byId: new Map(items.map((agent) => [agent.id, agent])),
  }
}

function cloneMetadata(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? JSON.parse(JSON.stringify(value))
    : undefined
}

function buildAliasMaps(sessionAliases) {
  const byRequestedKey = new Map()
  const bySessionId = new Map()
  const byActualSessionKey = new Map()

  for (const [requestedKey, alias] of Object.entries(sessionAliases || {})) {
    if (!alias || typeof alias !== 'object') continue
    const enriched = { requestedKey, ...alias }
    byRequestedKey.set(requestedKey, enriched)
    if (typeof alias.sessionId === 'string' && alias.sessionId) bySessionId.set(alias.sessionId, enriched)
    if (typeof alias.actualSessionKey === 'string' && alias.actualSessionKey) byActualSessionKey.set(alias.actualSessionKey, enriched)
  }

  return { byRequestedKey, bySessionId, byActualSessionKey }
}

async function loadSessionsData(params = {}, options = {}) {
  const sessionArgs = ['sessions', '--all-agents', '--json']
  if (typeof params.activeMinutes === 'number' && Number.isFinite(params.activeMinutes)) {
    sessionArgs.splice(2, 0, '--active', String(params.activeMinutes))
  }
  const result = await runCliJson(sessionArgs)
  const stores = Array.isArray(result?.stores) ? result.stores : []
  const sessionStoreEntries = await loadSessionStoreEntries(stores)
  const registry = await loadBridgeRegistry()
  const aliasMaps = buildAliasMaps(registry.data.sessionAliases)
  const rows = []

  for (const rawSession of Array.isArray(result?.sessions) ? result.sessions : []) {
    const storeEntry = sessionStoreEntries.get(rawSession.key)
    const aliasEntry = aliasMaps.bySessionId.get(rawSession.sessionId) || aliasMaps.byActualSessionKey.get(rawSession.key) || null
    const key = aliasEntry?.requestedKey || rawSession.key
    const metadata = {
      ...(cloneMetadata(storeEntry?.metadata) || {}),
      ...(cloneMetadata(aliasEntry?.metadata) || {}),
    }
    if (aliasEntry?.actualSessionKey) {
      metadata.actualSessionKey = aliasEntry.actualSessionKey
    } else {
      metadata.actualSessionKey = rawSession.key
    }

    const sessionFile = typeof storeEntry?.sessionFile === 'string' ? storeEntry.sessionFile : undefined
    const row = {
      ...rawSession,
      key,
      kind: rawSession.kind || 'unknown',
      agentId: rawSession.agentId || storeEntry?.__storeAgentId,
      chatType: storeEntry?.chatType || storeEntry?.origin?.chatType || rawSession.chatType,
      channel: storeEntry?.origin?.surface || storeEntry?.deliveryContext?.channel || rawSession.channel || inferChannelFromKey(rawSession.key),
      displayName: storeEntry?.displayName || rawSession.displayName,
      label: aliasEntry?.label || storeEntry?.label || storeEntry?.origin?.label || rawSession.label,
      derivedTitle: rawSession.derivedTitle,
      subject: storeEntry?.origin?.label || rawSession.subject,
      lastChannel: storeEntry?.deliveryContext?.channel || rawSession.lastChannel || storeEntry?.origin?.surface || inferChannelFromKey(rawSession.key),
      lastTo: storeEntry?.lastTo || storeEntry?.deliveryContext?.to || rawSession.lastTo,
      lastAccountId: storeEntry?.lastAccountId || storeEntry?.deliveryContext?.accountId || storeEntry?.origin?.accountId || rawSession.lastAccountId,
      modelProvider: rawSession.modelProvider || storeEntry?.modelProvider,
      model: rawSession.model || storeEntry?.model,
      contextTokens: rawSession.contextTokens || storeEntry?.contextTokens,
      inputTokens: rawSession.inputTokens ?? storeEntry?.inputTokens,
      outputTokens: rawSession.outputTokens ?? storeEntry?.outputTokens,
      totalTokens: rawSession.totalTokens ?? storeEntry?.totalTokens,
      totalTokensFresh: rawSession.totalTokensFresh ?? storeEntry?.totalTokensFresh,
      sendPolicy: storeEntry?.sendPolicy || rawSession.sendPolicy || null,
      sessionId: rawSession.sessionId || storeEntry?.sessionId,
      spawnedBy: typeof aliasEntry?.metadata?.orchestrationParentSessionKey === 'string'
        ? aliasEntry.metadata.orchestrationParentSessionKey
        : storeEntry?.spawnedBy || null,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      sessionFile,
      actualSessionKey: rawSession.key,
    }
    if (options.includeLastMessage !== false) {
      row.lastMessagePreview = rawSession.lastMessagePreview || await readLastMessagePreview(sessionFile)
    }
    row.derivedTitle = row.derivedTitle || row.label || row.displayName || row.subject || row.lastMessagePreview || row.key
    rows.push(row)
  }

  let sessions = rows
  if (!params.includeGlobal) {
    sessions = sessions.filter((session) => session.kind !== 'global')
  }
  if (!params.includeUnknown) {
    sessions = sessions.filter((session) => session.kind !== 'unknown')
  }
  if (params.agentId) {
    sessions = sessions.filter((session) => session.agentId === params.agentId)
  }
  if (params.spawnedBy) {
    sessions = sessions.filter((session) => session.spawnedBy === params.spawnedBy)
  }
  if (params.label) {
    sessions = sessions.filter((session) => String(session.label || '').includes(params.label))
  }
  if (params.search) {
    const query = String(params.search).trim().toLowerCase()
    sessions = sessions.filter((session) => {
      const haystack = [
        session.label,
        session.displayName,
        session.derivedTitle,
        session.subject,
        session.channel,
        session.key,
        session.lastMessagePreview,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(query)
    })
  }
  if (typeof params.activeMinutes === 'number' && Number.isFinite(params.activeMinutes)) {
    const cutoff = Date.now() - params.activeMinutes * 60_000
    sessions = sessions.filter((session) => (session.updatedAt ?? 0) >= cutoff)
  }

  sessions.sort((left, right) => (right.updatedAt ?? 0) - (left.updatedAt ?? 0))
  if (typeof params.limit === 'number' && Number.isFinite(params.limit) && params.limit > 0) {
    sessions = sessions.slice(0, params.limit)
  }

  return {
    ts: Date.now(),
    path: result?.path ?? null,
    count: sessions.length,
    defaults: {
      modelProvider: typeof result?.defaults?.modelProvider === 'string' ? result.defaults.modelProvider : null,
      model: typeof result?.defaults?.model === 'string' ? result.defaults.model : null,
      contextTokens: typeof result?.defaults?.contextTokens === 'number' ? result.defaults.contextTokens : null,
    },
    sessions,
    stores,
    registry,
  }
}

function ensureObject(value, message = 'Parameters must be an object') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new BridgeError(message, 'INVALID_PARAMS', 400)
  }
  return value
}

function ensureString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new BridgeError(`${field} is required`, 'INVALID_PARAMS', 400)
  }
  return value.trim()
}

async function resolveAgentWorkspace(agentId) {
  const { byId } = await loadAgentIndex()
  const agent = byId.get(agentId)
  if (!agent) {
    throw new BridgeError(`Agent not found: ${agentId}`, 'AGENT_NOT_FOUND', 404)
  }
  const workspace = agent.workspace ? expandHome(agent.workspace) : null
  if (!workspace) {
    throw new BridgeError(`Agent workspace unavailable: ${agentId}`, 'AGENT_WORKSPACE_MISSING', 404)
  }
  return { workspace, agent }
}

function validateWorkspaceFilePath(relativePath) {
  const normalized = relativePath.replace(/\\/g, '/').replace(/^\/+/, '')
  if (!normalized || normalized.startsWith('..') || normalized.includes('/../')) {
    throw new BridgeError('Invalid workspace file path', 'INVALID_WORKSPACE_PATH', 400)
  }
  const extension = path.extname(normalized).toLowerCase()
  if (!WORKSPACE_FILE_EXTENSIONS.has(extension)) {
    throw new BridgeError(`Unsupported workspace file extension: ${extension || '(none)'}`, 'UNSUPPORTED_FILE_TYPE', 400)
  }
  return normalized
}

function resolveWorkspaceFile(workspace, relativePath) {
  const safeRelativePath = validateWorkspaceFilePath(relativePath)
  const targetPath = path.resolve(workspace, safeRelativePath)
  const normalizedWorkspace = path.resolve(workspace)
  if (targetPath !== normalizedWorkspace && !targetPath.startsWith(`${normalizedWorkspace}${path.sep}`)) {
    throw new BridgeError('Workspace path escape denied', 'WORKSPACE_ESCAPE_DENIED', 403)
  }
  return { safeRelativePath, targetPath }
}

async function listWorkspaceFiles(workspace) {
  const items = []
  const entries = await fs.readdir(workspace, { withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isFile()) continue
    const extension = path.extname(entry.name).toLowerCase()
    if (!WORKSPACE_FILE_EXTENSIONS.has(extension)) continue
    const fullPath = path.join(workspace, entry.name)
    const stat = await fs.stat(fullPath)
    items.push({
      path: entry.name,
      size: stat.size,
      updatedAt: stat.mtimeMs,
    })
  }
  return items.sort((left, right) => left.path.localeCompare(right.path))
}

async function getAgents() {
  const { agents } = await loadAgentIndex()
  return agents.map((agent) => ({
    id: agent.id,
    name: agent.name,
    identity: {
      name: agent.name,
      avatar: agent.avatar,
      emoji: agent.emoji,
      theme: agent.theme,
    },
  }))
}

async function createAgent(params) {
  const name = ensureString(params.name, 'name')
  const workspace = params.workspace ? expandHome(ensureString(params.workspace, 'workspace')) : path.join(await getOpenClawHome(), 'workspaces', slugify(name) || name)
  const args = ['agents', 'add', name, '--workspace', workspace, '--non-interactive', '--json']
  const result = await runCliJson(args)

  let agentId = typeof result?.agentId === 'string'
    ? result.agentId
    : typeof result?.id === 'string'
      ? result.id
      : typeof result?.agent?.id === 'string'
        ? result.agent.id
        : name

  if (params.emoji || params.avatar || params.name) {
    const identityArgs = ['agents', 'set-identity', '--agent', agentId, '--json']
    if (params.name) identityArgs.push('--name', params.name)
    if (params.emoji) identityArgs.push('--emoji', params.emoji)
    if (params.avatar) identityArgs.push('--avatar', params.avatar)
    await runCliJson(identityArgs)
  }

  return { agentId }
}

async function updateAgent(params) {
  const agentId = ensureString(params.agentId, 'agentId')
  const updateArgs = ['agents', 'set-identity', '--agent', agentId, '--json']
  let hasIdentityChange = false
  if (params.name) {
    updateArgs.push('--name', params.name)
    hasIdentityChange = true
  }
  if (params.avatar) {
    updateArgs.push('--avatar', params.avatar)
    hasIdentityChange = true
  }
  if (hasIdentityChange) {
    await runCliJson(updateArgs)
  }

  if (!params.workspace && !params.model) return

  const configPath = await getConfigPath()
  const config = await readJsonFile(configPath)
  const list = Array.isArray(config?.agents?.list) ? config.agents.list : []
  const index = list.findIndex((entry) => entry?.id === agentId)
  if (index === -1) {
    throw new BridgeError(`Agent not found in config: ${agentId}`, 'AGENT_NOT_FOUND', 404)
  }

  if (params.workspace) {
    await runCliRaw(['config', 'set', `agents.list[${index}].workspace`, JSON.stringify(expandHome(params.workspace)), '--strict-json'])
  }
  if (params.model) {
    await runCliRaw(['config', 'set', `agents.list[${index}].model.primary`, JSON.stringify(params.model), '--strict-json'])
  }
}

async function deleteAgent(params) {
  const agentId = ensureString(params.agentId, 'agentId')
  await runCliJson(['agents', 'delete', agentId, '--json'])
}

async function agentFilesList(params) {
  const agentId = ensureString(params.agentId, 'agentId')
  const { workspace } = await resolveAgentWorkspace(agentId)
  return listWorkspaceFiles(workspace)
}

async function agentFilesGet(params) {
  const agentId = ensureString(params.agentId, 'agentId')
  const filePath = ensureString(params.path, 'path')
  const { workspace } = await resolveAgentWorkspace(agentId)
  const { targetPath } = resolveWorkspaceFile(workspace, filePath)
  return fs.readFile(targetPath, 'utf8')
}

async function agentFilesSet(params) {
  const agentId = ensureString(params.agentId, 'agentId')
  const filePath = ensureString(params.path, 'path')
  const content = typeof params.content === 'string' ? params.content : ''
  const { workspace } = await resolveAgentWorkspace(agentId)
  const { targetPath } = resolveWorkspaceFile(workspace, filePath)
  await fs.mkdir(path.dirname(targetPath), { recursive: true })
  await fs.writeFile(targetPath, content, 'utf8')
}

async function installSkill(params) {
  const skillId = ensureString(params.skillId, 'skillId')
  const result = await runCliJson(['skills', 'list', '--json'])
  const skills = readArrayResult(result, 'skills')
  const match = skills.find((entry) => entry?.name === skillId)
  if (match) return
  throw new BridgeError(`Skill ${skillId} is not installed locally, and bridge install is not supported yet`, 'SKILL_INSTALL_UNSUPPORTED', 501)
}

async function sendChatMessage(params) {
  const sessionKey = ensureString(params.sessionKey, 'sessionKey')
  const text = ensureString(params.text, 'text')
  const agentId = typeof params.agentId === 'string' && params.agentId.trim() ? params.agentId.trim() : null
  const sessionStateBefore = await loadSessionsData({ limit: 400 }, { includeLastMessage: false })
  const registry = await loadBridgeRegistry()
  const alias = registry.data.sessionAliases[sessionKey]
  const directSession = sessionStateBefore.sessions.find((session) => session.key === sessionKey || session.actualSessionKey === sessionKey)
  const targetSessionId = typeof alias?.sessionId === 'string'
    ? alias.sessionId
    : typeof directSession?.sessionId === 'string'
      ? directSession.sessionId
      : null

  if (!targetSessionId && !agentId && !directSession?.agentId) {
    throw new BridgeError('sendChatMessage requires agentId for a new CLI bridge session', 'MISSING_AGENT_ID', 400)
  }

  const args = ['agent']
  if (targetSessionId) {
    args.push('--session-id', targetSessionId)
  } else {
    args.push('--agent', agentId || directSession?.agentId)
  }
  if (params.thinking) {
    args.push('--thinking', 'medium')
  }
  args.push('--message', text, '--json')

  const result = await runCliJson(args)
  const sessionStateAfter = await loadSessionsData({ limit: 400 }, { includeLastMessage: false })
  const beforeById = new Map(sessionStateBefore.sessions.map((session) => [session.sessionId, session]))
  let selected = null

  if (targetSessionId) {
    selected = sessionStateAfter.sessions.find((session) => session.sessionId === targetSessionId) || null
  }

  if (!selected && result && typeof result === 'object') {
    const candidates = []
    const stack = [result]
    while (stack.length > 0) {
      const current = stack.pop()
      if (!current || typeof current !== 'object') continue
      for (const [key, value] of Object.entries(current)) {
        if ((key === 'sessionId' || key === 'id') && typeof value === 'string' && value.includes('-')) {
          candidates.push(value)
        } else if (value && typeof value === 'object') {
          stack.push(value)
        }
      }
    }
    selected = sessionStateAfter.sessions.find((session) => candidates.includes(session.sessionId)) || null
  }

  if (!selected) {
    const updatedCandidates = sessionStateAfter.sessions
      .filter((session) => session.agentId === (agentId || directSession?.agentId))
      .filter((session) => {
        const before = beforeById.get(session.sessionId)
        if (!before) return true
        return (session.updatedAt ?? 0) >= (before.updatedAt ?? 0)
      })
      .sort((left, right) => (right.updatedAt ?? 0) - (left.updatedAt ?? 0))
    selected = updatedCandidates[0] || null
  }

  if (!selected || !selected.sessionId) {
    throw new BridgeError('Unable to resolve session created by openclaw agent command', 'SESSION_RESOLUTION_FAILED', 502)
  }

  registry.data.sessionAliases[sessionKey] = {
    requestedKey: sessionKey,
    sessionId: selected.sessionId,
    actualSessionKey: selected.actualSessionKey || selected.key,
    agentId: agentId || selected.agentId || directSession?.agentId || null,
    metadata: params.metadata && typeof params.metadata === 'object' && !Array.isArray(params.metadata) ? params.metadata : undefined,
    label: typeof params.metadata?.taskTitle === 'string' ? params.metadata.taskTitle : undefined,
    updatedAt: Date.now(),
  }
  await saveBridgeRegistry(registry.filePath, registry.data)

  const latestSessions = await loadSessionsData({ limit: 400 }, { includeLastMessage: true })
  const latest = latestSessions.sessions.find((session) => session.sessionId === selected.sessionId) || selected
  const messages = await readSessionMessages(latest.sessionFile, 6)
  return messages
}

async function getChannelsStatus() {
  return runCliJson(['channels', 'status', '--json'])
}

function pushCronScheduleArgs(args, schedule) {
  if (!schedule || typeof schedule !== 'object') {
    throw new BridgeError('cron schedule is required', 'INVALID_PARAMS', 400)
  }
  if (schedule.kind === 'at' && schedule.at) {
    args.push('--at', schedule.at)
    return
  }
  if (schedule.kind === 'every' && typeof schedule.everyMs === 'number') {
    const minutes = Math.max(1, Math.round(schedule.everyMs / 60_000))
    args.push('--every', `${minutes}m`)
    return
  }
  if (schedule.kind === 'cron' && schedule.expr) {
    args.push('--cron', schedule.expr)
    if (schedule.tz) args.push('--tz', schedule.tz)
    return
  }
  throw new BridgeError('Unsupported cron schedule', 'INVALID_CRON_SCHEDULE', 400)
}

function pushCronPayloadArgs(args, payload) {
  if (!payload || typeof payload !== 'object') {
    throw new BridgeError('cron payload is required', 'INVALID_PARAMS', 400)
  }
  if (payload.kind === 'systemEvent' && payload.text) {
    args.push('--system-event', payload.text)
    return
  }
  if (payload.kind === 'agentTurn' && payload.message) {
    args.push('--message', payload.message)
    if (payload.model) args.push('--model', payload.model)
    if (payload.deliver) args.push('--announce')
    if (payload.channel) args.push('--channel', payload.channel)
    if (payload.to) args.push('--to', payload.to)
    return
  }
  throw new BridgeError('Unsupported cron payload', 'INVALID_CRON_PAYLOAD', 400)
}

async function getCronJobs() {
  const result = await runCliJson(['cron', 'list', '--json'])
  return Array.isArray(result?.jobs) ? result.jobs : []
}

async function addCronJob(params) {
  const payload = ensureObject(params.payload, 'payload is required')
  const schedule = ensureObject(params.schedule, 'schedule is required')
  const args = ['cron', 'add', '--name', ensureString(params.name, 'name'), '--json']
  pushCronScheduleArgs(args, schedule)
  pushCronPayloadArgs(args, payload)
  if (typeof params.agentId === 'string' && params.agentId) args.push('--agent', params.agentId)
  if (typeof params.sessionKey === 'string' && params.sessionKey) args.push('--session-key', params.sessionKey)
  if (typeof params.description === 'string' && params.description) args.push('--description', params.description)
  if (params.enabled === false) args.push('--disabled')
  if (params.deleteAfterRun) args.push('--delete-after-run')
  const result = await runCliJson(args)
  return { id: result?.id || result?.jobId || params.name }
}

async function updateCronJob(params) {
  const id = ensureString(params.id || params.jobId, 'id')
  const patch = ensureObject(params.patch, 'patch is required')
  const args = ['cron', 'edit', id, '--json']
  if (patch.name) args.push('--name', patch.name)
  if (patch.description) args.push('--description', patch.description)
  if (typeof patch.enabled === 'boolean') args.push(patch.enabled ? '--enable' : '--disable')
  if (typeof patch.deleteAfterRun === 'boolean') args.push(patch.deleteAfterRun ? '--delete-after-run' : '--keep-after-run')
  if (patch.schedule) pushCronScheduleArgs(args, patch.schedule)
  if (patch.payload) pushCronPayloadArgs(args, patch.payload)
  if (patch.agentId) args.push('--agent', patch.agentId)
  if (patch.sessionKey) args.push('--session-key', patch.sessionKey)
  await runCliJson(args)
}

async function removeCronJob(params) {
  const id = ensureString(params.id || params.jobId, 'id')
  await runCliJson(['cron', 'rm', id, '--json'])
}

async function runCronJobNow(params) {
  const id = ensureString(params.id || params.jobId, 'id')
  await runCliRaw(['cron', 'run', id])
}

async function getCronRuns(params = {}) {
  const jobs = await getCronJobs()
  const targetIds = typeof params.id === 'string' || typeof params.jobId === 'string'
    ? [params.id || params.jobId]
    : jobs.map((job) => job.id || job.jobId).filter(Boolean)

  const runs = []
  for (const id of targetIds) {
    const result = await runCliJson(['cron', 'runs', '--id', id, '--json'])
    if (Array.isArray(result?.runs)) {
      runs.push(...result.runs)
    }
  }

  const filtered = typeof params.status === 'string' && params.status !== 'all'
    ? runs.filter((run) => run.status === params.status)
    : runs
  filtered.sort((left, right) => params.sort === 'asc'
    ? left.startedAtMs - right.startedAtMs
    : right.startedAtMs - left.startedAtMs)
  return typeof params.limit === 'number' && params.limit > 0 ? filtered.slice(0, params.limit) : filtered
}

async function getLogs(params = {}) {
  const limit = typeof params.limit === 'number' && params.limit > 0 ? params.limit : 200
  const lines = await runCliNdjson(['logs', '--json', '--limit', String(limit)])
  return lines
    .filter((entry) => entry?.type === 'log')
    .map((entry) => ({
      ts: Date.parse(entry.time || '') || Date.now(),
      level: entry.level || 'info',
      source: entry.source || undefined,
      message: entry.message || entry.raw || '',
      raw: entry.raw || JSON.stringify(entry),
    }))
}

async function getModels() {
  const result = await runCliJson(['models', 'list', '--json'])
  const items = readArrayResult(result, 'models')
  return items.map((model) => ({
    id: model.key || model.id || model.name,
    name: model.name || model.key,
    provider: typeof model.key === 'string' && model.key.includes('/') ? model.key.split('/')[0] : model.provider,
    contextWindow: model.contextWindow,
    maxOutput: model.maxOutput,
  }))
}

async function getSkills() {
  const result = await runCliJson(['skills', 'list', '--json'])
  const items = readArrayResult(result, 'skills')
  return items.map((skill) => ({
    name: skill.name,
    status: skill.eligible && !skill.disabled && !skill.blockedByAllowlist ? 'installed' : 'available',
    description: skill.description,
    version: skill.version,
  }))
}

async function getNodes() {
  const result = await runCliJson(['nodes', 'status', '--json'])
  const items = readArrayResult(result, 'nodes')
  return items.map((node) => ({
    nodeId: node.nodeId || node.id || node.name,
    name: node.name,
    status: node.status || 'unknown',
    lastSeenAt: node.lastSeenAt || node.ts,
    capabilities: node.capabilities,
    platform: node.platform,
    version: node.version,
  }))
}

async function getPresence() {
  return runCliJson(['system', 'presence', '--json'])
}

async function getSnapshot() {
  const [health, presence] = await Promise.all([getHealthSummary(), getPresence()])
  const defaultAgentId = health.defaultAgentId || 'main'
  return {
    presence,
    health: {
      ok: health.ok,
      bridgeVersion: health.bridgeVersion,
      cliVersion: health.cliVersion,
      sessionsCount: health.sessionsCount,
      channelsConfigured: health.channelsConfigured,
      channelsRunning: health.channelsRunning,
    },
    stateVersion: {
      presence: Date.now(),
      health: Date.now(),
    },
    uptimeMs: health.uptimeMs,
    configPath: health.configPath,
    stateDir: health.openclawHome,
    sessionDefaults: {
      defaultAgentId,
      mainKey: 'main',
      mainSessionKey: `agent:${defaultAgentId}:main`,
      scope: 'global',
    },
    authMode: 'none',
  }
}

async function getConfig() {
  const [agents, channels, health] = await Promise.all([getAgents(), getChannelsStatus(), getHealthSummary()])
  return {
    source: 'bridge',
    bridgeVersion: BRIDGE_VERSION,
    cliVersion: health.cliVersion,
    configPath: health.configPath,
    defaultAgentId: health.defaultAgentId,
    agents: agents.map((agent) => ({
      id: agent.id,
      name: agent.name,
      emoji: agent.identity?.emoji,
      theme: agent.identity?.theme,
    })),
    channels: channels.channelOrder.reduce((acc, channelId) => {
      acc[channelId] = { configured: true }
      return acc
    }, {}),
  }
}

async function getExecApprovals() {
  return []
}

async function patchSession() {
  throw new BridgeError('CLI bridge does not support sessions.patch yet', 'SESSIONS_PATCH_UNSUPPORTED', 501)
}

async function resetSession() {
  throw new BridgeError('CLI bridge does not support sessions.reset yet', 'SESSIONS_RESET_UNSUPPORTED', 501)
}

async function deleteSession() {
  throw new BridgeError('CLI bridge does not support sessions.delete yet', 'SESSIONS_DELETE_UNSUPPORTED', 501)
}

async function resolveExecApproval() {
  throw new BridgeError('CLI bridge does not support exec approval resolution yet', 'EXEC_APPROVAL_UNSUPPORTED', 501)
}

const handlers = {
  getHealth: async () => getHealthSummary(),
  getSnapshot: async () => getSnapshot(),
  getPresence: async () => getPresence(),
  getAgents: async () => getAgents(),
  createAgent: async (params) => createAgent(ensureObject(params)),
  updateAgent: async (params) => updateAgent(ensureObject(params)),
  deleteAgent: async (params) => deleteAgent(ensureObject(params)),
  agentFilesList: async (params) => agentFilesList(ensureObject(params)),
  agentFilesGet: async (params) => agentFilesGet(ensureObject(params)),
  agentFilesSet: async (params) => agentFilesSet(ensureObject(params)),
  installSkill: async (params) => installSkill(ensureObject(params)),
  getSessions: async (params) => loadSessionsData(ensureObject(params || {}), { includeLastMessage: true }).then(({ ts, path: sessionsPath, count, defaults, sessions }) => ({ ts, path: sessionsPath, count, defaults, sessions })),
  patchSession: async (params) => patchSession(ensureObject(params)),
  resetSession: async (params) => resetSession(ensureObject(params)),
  deleteSession: async (params) => deleteSession(ensureObject(params)),
  sendChatMessage: async (params) => sendChatMessage(ensureObject(params)),
  getChannelsStatus: async () => getChannelsStatus(),
  getCronJobs: async () => getCronJobs(),
  addCronJob: async (params) => addCronJob(ensureObject(params)),
  updateCronJob: async (params) => updateCronJob(ensureObject(params)),
  removeCronJob: async (params) => removeCronJob(ensureObject(params)),
  runCronJob: async (params) => runCronJobNow(ensureObject(params)),
  getCronRuns: async (params) => getCronRuns(ensureObject(params || {})),
  getLogs: async (params) => getLogs(ensureObject(params || {})),
  getModels: async () => getModels(),
  getSkills: async () => getSkills(),
  getNodes: async () => getNodes(),
  getConfig: async () => getConfig(),
  getExecApprovals: async () => getExecApprovals(),
  resolveExecApproval: async (params) => resolveExecApproval(ensureObject(params)),
}

function toErrorPayload(error) {
  if (error instanceof BridgeError) {
    return {
      code: error.code,
      message: error.message,
      details: error.details,
    }
  }
  return {
    code: 'INTERNAL_ERROR',
    message: error instanceof Error ? error.message : String(error),
  }
}

const server = http.createServer(async (req, res) => {
  try {
    if (!req.url) {
      throw new BridgeError('Request URL missing', 'INVALID_REQUEST', 400)
    }

    if (req.method === 'OPTIONS') {
      withCorsHeaders(res)
      res.writeHead(204)
      res.end()
      return
    }

    const url = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`)

    if (url.pathname === '/health' && req.method === 'GET') {
      requireBridgeAuth(req)
      const result = await getHealthSummary()
      sendJson(res, 200, result)
      return
    }

    if (url.pathname === '/capabilities' && req.method === 'GET') {
      requireBridgeAuth(req)
      sendJson(res, 200, BRIDGE_CAPABILITIES)
      return
    }

    if (url.pathname === '/rpc' && req.method === 'POST') {
      requireBridgeAuth(req)
      const body = await parseJsonBody(req)
      const method = ensureString(body.method, 'method')
      const handler = handlers[method]
      if (!handler) {
        throw new BridgeError(`Unsupported bridge method: ${method}`, 'METHOD_NOT_SUPPORTED', 404)
      }
      const result = await handler(body.params)
      sendJson(res, 200, { ok: true, result })
      return
    }

    throw new BridgeError('Not found', 'NOT_FOUND', 404)
  } catch (error) {
    const status = error instanceof BridgeError ? error.status : 500
    sendJson(res, status, { ok: false, error: toErrorPayload(error) })
  }
})

server.listen(BRIDGE_PORT, BRIDGE_HOST, async () => {
  const cliVersion = await getCliVersion().catch(() => 'unknown')
  process.stdout.write(`claw-ops bridge listening on http://${BRIDGE_HOST}:${BRIDGE_PORT} (openclaw ${cliVersion})\n`)
})
