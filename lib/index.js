/**
 * dsh-git-forge — host half
 * Multi-forge account library + project-scoped grants + push policy guard + GitForge tool.
 */
import { createRequire } from 'node:module'
import { randomUUID } from 'node:crypto'
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { normalizeProjectKey } from './shared/path.js'
import {
  FORGE_PROVIDERS,
  PROVIDER_DEFAULTS,
  normalizeProvider,
  normalizeGitHost,
  normalizeApiBase,
  publicAccount,
  modelAccountSummary,
  accountTokenConfigured,
} from './shared/account-summary.js'
import {
  classifyGitWriteCommand,
  evaluatePushPolicy,
  hostFromGitUrl,
} from './shared/git-policy.js'

// Out-of-tree plugins cannot reliably resolve @deepseek-ai/dsh-tools (see modlens / dsh-ssh-tunnel).
// Register a raw JSON-Schema tool definition via ctx.tools.register instead of defineTool.
const requireSelf = createRequire(import.meta.url)
const PLUGIN_DIR = dirname(dirname(fileURLToPath(import.meta.url)))
const HELPER_JS = join(PLUGIN_DIR, 'scripts', 'git-credential-dsh-git-forge.mjs')

let PLUGIN_VERSION = '0.0.0'
try {
  PLUGIN_VERSION = String(requireSelf('../package.json').version || PLUGIN_VERSION)
} catch {}

export const name = 'dsh-git-forge'
export const inject = ['webServer', 'sessions', 'tools']

/** Set true after GitForge successfully enters the tools registry. */
let gitForgeRegistered = false

const VERSION = PLUGIN_VERSION
const DATA_DIR = process.env.DSH_HOME
  ? join(process.env.DSH_HOME, 'git-forge')
  : join(homedir(), '.dsh/git-forge')
const ACCOUNTS_PATH = join(DATA_DIR, 'accounts.json')
const SECRETS_PATH = join(DATA_DIR, 'secrets.json')
const GRANTS_PATH = join(DATA_DIR, 'grants.json')
const GITCONFIG_PATH = join(DATA_DIR, 'gitconfig')

function ensureDataDir() {
  mkdirSync(DATA_DIR, { recursive: true })
  try { chmodSync(DATA_DIR, 0o700) } catch { /* ignore */ }
}

function readJson(path, fallback) {
  try {
    if (!existsSync(path)) return fallback
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return fallback
  }
}

function writeJsonFile(path, data, mode = 0o600) {
  ensureDataDir()
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n', { mode })
  try { chmodSync(path, mode) } catch { /* ignore */ }
}

function sessionCwdOf(ctx, sessionId, clientCwd) {
  try {
    const headerCwd = ctx.sessions?.get?.(sessionId)?.header?.cwd
    if (headerCwd) return normalizeProjectKey(headerCwd)
  } catch { /* ignore */ }
  if (clientCwd) return normalizeProjectKey(clientCwd)
  return normalizeProjectKey(process.cwd()) || '/workspace'
}

function emptyAccounts() {
  return { version: 1, accounts: [] }
}

function loadAccounts() {
  const data = readJson(ACCOUNTS_PATH, emptyAccounts())
  if (!Array.isArray(data.accounts)) data.accounts = []
  data.version = 1
  return data
}

function saveAccounts(data) {
  writeJsonFile(ACCOUNTS_PATH, { version: 1, accounts: data.accounts || [] }, 0o600)
}

function loadSecrets() {
  return readJson(SECRETS_PATH, { version: 1, byAccountId: {} })
}

function saveSecrets(data) {
  writeJsonFile(SECRETS_PATH, { version: 1, byAccountId: data.byAccountId || {} }, 0o600)
}

function loadGrants() {
  return readJson(GRANTS_PATH, { version: 1, projects: {}, unboundPolicy: 'allow' })
}

function saveGrants(data) {
  writeJsonFile(GRANTS_PATH, {
    version: 1,
    projects: data.projects || {},
    unboundPolicy: data.unboundPolicy === 'deny_unbound' ? 'deny_unbound' : 'allow',
  }, 0o600)
}

function getAccountById(id) {
  return loadAccounts().accounts.find((a) => a.id === id) || null
}

function upsertAccountRecord(input) {
  const doc = loadAccounts()
  const secrets = loadSecrets()
  const id = (input.id && String(input.id).trim()) || randomUUID()
  const existing = doc.accounts.find((a) => a.id === id)
  const provider = normalizeProvider(input.provider ?? existing?.provider) || 'github'
  const defaults = PROVIDER_DEFAULTS[provider] || {}
  const authMethod = input.authMethod || existing?.authMethod || 'token'
  if (authMethod !== 'token' && authMethod !== 'ssh') {
    throw new Error('authMethod must be token or ssh')
  }
  let gitHost = normalizeGitHost(input.gitHost !== undefined ? input.gitHost : existing?.gitHost || defaults.gitHost)
  let apiBase = normalizeApiBase(
    provider,
    input.apiBase !== undefined ? input.apiBase : existing?.apiBase || defaults.apiBase || '',
  )
  if (apiBase) {
    try {
      const u = new URL(apiBase)
      if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('bad proto')
    } catch {
      throw new Error('apiBase must be a valid http(s) URL')
    }
  }
  if (!gitHost && apiBase) {
    try { gitHost = normalizeGitHost(new URL(apiBase).hostname) } catch { /* ignore */ }
  }
  if (!gitHost) throw new Error('gitHost is required (hostname used to match git remotes)')

  const record = {
    id,
    name: String(input.name || existing?.name || gitHost || provider).trim() || provider,
    provider,
    gitHost,
    apiBase,
    authMethod,
    username: String(input.username !== undefined ? input.username : existing?.username || '').trim(),
    defaultOwner: String(input.defaultOwner !== undefined ? input.defaultOwner : existing?.defaultOwner || '').trim(),
    source: input.source || existing?.source || 'manual',
    updatedAt: Date.now(),
  }

  const sec = Object.assign({}, secrets.byAccountId[id] || {})
  if (input.token !== undefined) {
    if (input.token === '' || input.token == null) delete sec.token
    else sec.token = String(input.token)
  }

  const idx = doc.accounts.findIndex((a) => a.id === id)
  if (idx >= 0) doc.accounts[idx] = record
  else doc.accounts.push(record)
  saveAccounts(doc)
  secrets.byAccountId[id] = sec
  if (!Object.keys(sec).length) delete secrets.byAccountId[id]
  saveSecrets(secrets)
  return publicAccount(record, secrets)
}

function deleteAccountRecord(id) {
  const doc = loadAccounts()
  const before = doc.accounts.length
  doc.accounts = doc.accounts.filter((a) => a.id !== id)
  if (doc.accounts.length === before) throw new Error('account not found')
  saveAccounts(doc)
  const secrets = loadSecrets()
  delete secrets.byAccountId[id]
  saveSecrets(secrets)
  // strip from all grants
  const grants = loadGrants()
  for (const key of Object.keys(grants.projects || {})) {
    const g = grants.projects[key]
    if (!g || !Array.isArray(g.accountIds)) continue
    g.accountIds = g.accountIds.filter((x) => x !== id)
    g.updatedAt = Date.now()
  }
  saveGrants(grants)
  return { ok: true, id }
}

function getProjectGrants(projectPathKey) {
  const key = normalizeProjectKey(projectPathKey)
  const grants = loadGrants()
  const g = (key && grants.projects[key]) || { accountIds: [], enforcePush: true, updatedAt: 0 }
  return {
    projectPathKey: key,
    accountIds: [...(g.accountIds || [])],
    enforcePush: g.enforcePush !== false,
    unboundPolicy: grants.unboundPolicy || 'allow',
    updatedAt: g.updatedAt || 0,
  }
}

function setProjectGrants(projectPathKey, accountIds, enforcePush) {
  const key = normalizeProjectKey(projectPathKey)
  if (!key) throw new Error('projectPathKey required')
  const grants = loadGrants()
  const ids = [...new Set((accountIds || []).map(String).filter(Boolean))]
  // validate ids exist
  const known = new Set(loadAccounts().accounts.map((a) => a.id))
  for (const id of ids) {
    if (!known.has(id)) throw new Error('unknown account id: ' + id)
  }
  grants.projects[key] = {
    accountIds: ids,
    enforcePush: enforcePush !== false,
    updatedAt: Date.now(),
  }
  saveGrants(grants)
  return getProjectGrants(key)
}

function setUnboundPolicy(policy) {
  const grants = loadGrants()
  grants.unboundPolicy = policy === 'deny_unbound' ? 'deny_unbound' : 'allow'
  saveGrants(grants)
  return { unboundPolicy: grants.unboundPolicy }
}

function allowedAccountsForProject(projectPathKey) {
  const g = getProjectGrants(projectPathKey)
  const secrets = loadSecrets()
  const all = loadAccounts().accounts
  const map = new Map(all.map((a) => [a.id, a]))
  const list = g.accountIds.map((id) => map.get(id)).filter(Boolean)
  return {
    grants: g,
    accounts: list.map((a) => publicAccount(a, secrets)),
    modelAccounts: list.map((a) => modelAccountSummary(a, secrets)),
  }
}

async function probeAccount(id) {
  const account = getAccountById(id)
  if (!account) throw new Error('account not found')
  const secrets = loadSecrets()
  if (account.authMethod === 'ssh') {
    return {
      ok: true,
      mode: 'ssh',
      message: 'SSH auth — use system git/ssh; no API token probe',
      gitHost: account.gitHost,
      apiBase: account.apiBase || '',
    }
  }
  const token = secrets.byAccountId[id]?.token
  if (!token) {
    return {
      ok: false,
      mode: 'token',
      message: 'token not configured — edit the account and paste a PAT',
      gitHost: account.gitHost,
      apiBase: account.apiBase || '',
    }
  }

  const rawBase = String(account.apiBase || '').trim()
  const apiBase = normalizeApiBase(account.provider, rawBase)
  if (!apiBase) {
    return {
      ok: false,
      mode: 'token',
      message: 'apiBase not configured',
      gitHost: account.gitHost,
      apiBase: '',
    }
  }

  // Persist normalized apiBase when user saved site root (e.g. missing /api/v1)
  if (apiBase !== rawBase.replace(/\/+$/, '')) {
    try {
      const doc = loadAccounts()
      const idx = doc.accounts.findIndex((a) => a.id === id)
      if (idx >= 0) {
        doc.accounts[idx] = { ...doc.accounts[idx], apiBase, updatedAt: Date.now() }
        saveAccounts(doc)
      }
    } catch { /* ignore */ }
  }

  let url = apiBase.replace(/\/$/, '') + '/user'
  const headers = { 'user-agent': 'dsh-git-forge/' + VERSION, accept: 'application/json' }
  if (account.provider === 'gitlab') {
    headers['PRIVATE-TOKEN'] = token
  } else if (account.provider === 'gitea') {
    headers.authorization = 'token ' + token
  } else if (account.provider === 'gitee') {
    headers.authorization = 'Bearer ' + token
  } else if (account.provider === 'bitbucket') {
    headers.authorization = 'Bearer ' + token
  } else {
    headers.authorization = 'Bearer ' + token
  }

  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), 10000)
  try {
    const res = await fetch(url, { headers, redirect: 'follow', signal: ac.signal })
    const text = await res.text()
    let login = ''
    let parseOk = false
    try {
      const j = JSON.parse(text)
      parseOk = true
      login = j.login || j.username || j.name || ''
    } catch { /* ignore */ }
    if (!res.ok) {
      let hint = ''
      if (res.status === 401 || res.status === 403) {
        hint = ' — check token scopes / validity'
      } else if (res.status === 404) {
        hint = account.provider === 'gitea'
          ? ' — expected Gitea API under /api/v1/user (apiBase should end with /api/v1)'
          : ' — check apiBase path'
      }
      return {
        ok: false,
        mode: 'token',
        status: res.status,
        url,
        apiBase,
        message: `API probe failed HTTP ${res.status} at ${url}${hint}`,
        gitHost: account.gitHost,
        bodyHead: String(text || '').slice(0, 80),
      }
    }
    if (!parseOk) {
      return {
        ok: false,
        mode: 'token',
        status: res.status,
        url,
        apiBase,
        message: `API returned non-JSON at ${url} — is apiBase the API root?`,
        gitHost: account.gitHost,
      }
    }
    return {
      ok: true,
      mode: 'token',
      status: res.status,
      url,
      apiBase,
      login: login || undefined,
      message: login ? `ok as ${login}` : 'ok',
      gitHost: account.gitHost,
      normalizedFrom: rawBase !== apiBase ? rawBase : undefined,
    }
  } catch (e) {
    const aborted = e && (e.name === 'AbortError' || /aborted/i.test(String(e.message || e)))
    return {
      ok: false,
      mode: 'token',
      url,
      apiBase,
      message: aborted
        ? `probe timed out (10s) reaching ${url} — check LAN DNS/TLS/firewall from the DSH host`
        : `probe error for ${url}: ${String(e && e.message ? e.message : e)}`,
      gitHost: account.gitHost,
    }
  } finally {
    clearTimeout(timer)
  }
}

function isLoopbackHostname(hostname) {
  const h = String(hostname || '').replace(/^\[|\]$/g, '').toLowerCase()
  return h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '0.0.0.0'
}

function isTrusted(req, trustedHosts) {
  try {
    const hostHeader = req.headers?.host || req.headers?.Host
    if (!hostHeader) return false
    const url = new URL('http://' + hostHeader)
    if (isLoopbackHostname(url.hostname)) return true
    const list = Array.isArray(trustedHosts) ? trustedHosts : []
    return list.some((entry) => {
      const e = String(entry)
      return e === hostHeader || e === url.hostname || e === url.host
    })
  } catch {
    return false
  }
}

function writeJson(res, status, body) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(body))
}

async function readJsonBody(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  if (!chunks.length) return {}
  const raw = Buffer.concat(chunks).toString('utf8')
  if (!raw.trim()) return {}
  return JSON.parse(raw)
}

async function handleApi(method, body, ctx) {
  if (method === 'health') {
    return {
      ok: true,
      version: VERSION,
      name: 'dsh-git-forge',
      gitForgeRegistered,
      gitCredentialHelper: existsSync(HELPER_JS),
      gitconfigPath: GITCONFIG_PATH,
      gitConfigGlobalActive: process.env.GIT_CONFIG_GLOBAL === GITCONFIG_PATH,
    }
  }

  if (method === 'getProjectContext') {
    const sessionId = body.sessionId || ''
    const projectPathKey = sessionCwdOf(ctx, sessionId, body.cwd)
    return { sessionId, projectPathKey, hasProject: !!projectPathKey }
  }

  if (method === 'listAccounts') {
    const secrets = loadSecrets()
    return {
      accounts: loadAccounts().accounts.map((a) => publicAccount(a, secrets)),
      providers: FORGE_PROVIDERS,
      defaults: PROVIDER_DEFAULTS,
    }
  }

  if (method === 'saveAccount') {
    return { ok: true, account: upsertAccountRecord(body.account || body) }
  }

  if (method === 'deleteAccount') {
    return deleteAccountRecord(String(body.id || ''))
  }

  if (method === 'getGrants') {
    return getProjectGrants(body.projectPathKey || body.cwd || '')
  }

  if (method === 'setGrants') {
    return setProjectGrants(
      body.projectPathKey || body.cwd,
      body.accountIds || body.ids || [],
      body.enforcePush,
    )
  }

  if (method === 'setUnboundPolicy') {
    return setUnboundPolicy(body.unboundPolicy || body.policy)
  }

  if (method === 'getUnboundPolicy') {
    return { unboundPolicy: loadGrants().unboundPolicy || 'allow' }
  }

  if (method === 'probeAccount') {
    return probeAccount(String(body.id || ''))
  }

  if (method === 'checkRemote') {
    const projectPathKey = normalizeProjectKey(body.projectPathKey || body.cwd || '')
    const url = String(body.url || body.remote || '')
    const host = hostFromGitUrl(url)
    const { grants, accounts } = allowedAccountsForProject(projectPathKey)
    const classification = { kind: 'push', targets: host ? [{ raw: url, host }] : [] }
    const decision = evaluatePushPolicy({
      projectPathKey,
      accountIds: grants.accountIds,
      accounts,
      enforce: grants.accountIds.length
        ? (grants.enforcePush ? 'enforce' : 'off')
        : (grants.unboundPolicy || 'allow'),
      classification: grants.enforcePush === false ? { kind: 'none' } : classification,
      command: url,
    })
    return {
      ok: decision.ok,
      host,
      url,
      reason: decision.reason || '',
      allowedHosts: accounts.map((a) => a.gitHost).filter(Boolean),
      grants,
    }
  }

  throw new Error('unknown method: ' + method)
}

function resolveProjectFromExec(ctx, exec) {
  const args = exec?.arguments || exec?.args || {}
  const workdir = args.workdir || args.working_directory || ''
  try {
    const agent = exec?.agent
    const sessionId = agent?.session?.id || agent?.id
    if (sessionId && ctx.sessions) {
      return sessionCwdOf(ctx, sessionId, workdir)
    }
  } catch { /* ignore */ }
  if (workdir) return normalizeProjectKey(workdir)
  try {
    const list = ctx.sessions?.list?.() || []
    // prefer a running session cwd if unique-ish
    for (const s of list) {
      const cwd = s?.header?.cwd
      if (cwd) return normalizeProjectKey(cwd)
    }
  } catch { /* ignore */ }
  return normalizeProjectKey(process.cwd()) || '/workspace'
}

function registerPushGuard(ctx) {
  if (!ctx.tools || typeof ctx.tools.guard !== 'function') return () => {}
  return ctx.tools.guard((exec) => {
    try {
      const name = exec?.name || exec?.toolName || ''
      if (name !== 'bash') return undefined
      const args = exec.arguments || exec.args || {}
      const command = String(args.command || '')
      if (!command) return undefined
      const classification = classifyGitWriteCommand(command)
      if (classification.kind === 'none') return undefined

      const projectPathKey = resolveProjectFromExec(ctx, exec)
      const g = getProjectGrants(projectPathKey)
      if (g.enforcePush === false) return undefined

      const accounts = loadAccounts().accounts
      const decision = evaluatePushPolicy({
        projectPathKey,
        accountIds: g.accountIds,
        accounts,
        enforce: g.accountIds.length ? 'enforce' : (g.unboundPolicy || 'allow'),
        classification,
        command,
      })
      if (!decision.ok) return decision.reason
      return undefined
    } catch (e) {
      return 'git-forge: policy check failed: ' + String(e && e.message ? e.message : e)
    }
  })
}

function registerGitForgeTool(ctx) {
  if (!ctx.tools || typeof ctx.tools.register !== 'function') {
    console.error('[dsh-git-forge] tools service unavailable; GitForge tool not registered')
    return () => {}
  }

  // Raw tool definition (JSON Schema parameters) — same pattern as modlens / dsh-ssh-tunnel.
  const tool = {
    name: 'GitForge',
    description:
      'Inspect project-scoped Git forge policy (GitHub/Gitea/etc). Use list_accounts / get_policy / check_remote. Never returns tokens. Push to unauthorized hosts is blocked by a host guard when the project has grants.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['list_accounts', 'list_project_accounts', 'get_policy', 'check_remote'],
          description: 'list_accounts | list_project_accounts | get_policy | check_remote',
        },
        project_path: {
          type: 'string',
          description: 'Optional project path; defaults to the current session workspace cwd.',
        },
        url: {
          type: 'string',
          description: 'Remote URL for check_remote.',
        },
      },
      required: ['action'],
      additionalProperties: false,
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          text: { type: 'string' },
          isError: { type: 'boolean' },
        },
        required: ['text'],
      },
      render: (_args, value) => [{ type: 'text', text: value.text }],
    },
    async execute(args, exec) {
      const ok = (obj) => ({
        text: typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2),
        isError: false,
      })
      const fail = (t) => ({ text: `GitForge failed: ${t}`, isError: true })
      try {
        const action = String(args.action || '')
        const projectPathKey =
          normalizeProjectKey(args.project_path || '') || resolveProjectFromExec(ctx, exec)

        if (action === 'list_accounts') {
          const secrets = loadSecrets()
          return ok({
            accounts: loadAccounts().accounts.map((a) => modelAccountSummary(a, secrets)),
          })
        }
        if (action === 'list_project_accounts' || action === 'get_policy') {
          const { grants, modelAccounts } = allowedAccountsForProject(projectPathKey)
          return ok({
            projectPathKey,
            accountIds: grants.accountIds,
            enforcePush: grants.enforcePush,
            unboundPolicy: grants.unboundPolicy,
            accounts: modelAccounts,
          })
        }
        if (action === 'check_remote') {
          const url = String(args.url || '')
          if (!url) throw new Error('url required for check_remote')
          const host = hostFromGitUrl(url)
          const { grants, accounts, modelAccounts } = allowedAccountsForProject(projectPathKey)
          const classification = { kind: 'push', targets: host ? [{ raw: url, host }] : [] }
          const decision = evaluatePushPolicy({
            projectPathKey,
            accountIds: grants.accountIds,
            accounts,
            enforce: grants.accountIds.length
              ? grants.enforcePush
                ? 'enforce'
                : 'off'
              : grants.unboundPolicy || 'allow',
            classification: grants.enforcePush === false ? { kind: 'none' } : classification,
            command: url,
          })
          return ok({
            ok: decision.ok,
            host,
            url,
            reason: decision.reason || null,
            projectPathKey,
            allowed_accounts: modelAccounts,
          })
        }
        throw new Error('invalid action: ' + action)
      } catch (e) {
        return fail(e && e.message ? e.message : String(e))
      }
    },
  }

  try {
    const dispose = ctx.tools.register(tool)
    gitForgeRegistered = true
    return () => {
      gitForgeRegistered = false
      try {
        dispose()
      } catch {}
    }
  } catch (error) {
    gitForgeRegistered = false
    console.error(
      '[dsh-git-forge] GitForge registration failed:',
      error && error.message ? error.message : error,
    )
    return () => {}
  }
}

function ensureHelperGitconfig() {
  ensureDataDir()
  if (!existsSync(HELPER_JS)) {
    console.error('[dsh-git-forge] credential helper missing:', HELPER_JS)
  }
  const nodeExec = process.execPath
  // git "!cmd" is run via shell; JSON.stringify quotes paths safely.
  const content = [
    '# Generated by dsh-git-forge — do not put tokens here',
    '[credential]',
    `\thelper = !${JSON.stringify(nodeExec)} ${JSON.stringify(HELPER_JS)}`,
    '\tuseHttpPath = true',
    '',
  ].join('\n')
  let prev = ''
  try {
    prev = readFileSync(GITCONFIG_PATH, 'utf8')
  } catch {
    /* missing */
  }
  if (prev !== content) {
    writeFileSync(GITCONFIG_PATH, content, { mode: 0o600 })
  }
  try {
    chmodSync(GITCONFIG_PATH, 0o600)
  } catch {
    /* ignore */
  }
  return GITCONFIG_PATH
}

/** Point agent shell git children at our helper without writing ~/.gitconfig. */
function registerGitConfigGlobal() {
  const path = ensureHelperGitconfig()
  const prev = process.env.GIT_CONFIG_GLOBAL
  process.env.GIT_CONFIG_GLOBAL = path
  return () => {
    if (prev === undefined) delete process.env.GIT_CONFIG_GLOBAL
    else process.env.GIT_CONFIG_GLOBAL = prev
  }
}

/** Non-secret diagnostics for agent shells (shellEnv only allows DSH_*). */
function registerShellEnvHints(ctx) {
  const shellEnv = ctx.get?.('shellEnv')
  if (!shellEnv || typeof shellEnv.register !== 'function') return () => {}
  try {
    return shellEnv.register({
      name: 'dsh-git-forge-hints',
      variables: {
        DSH_GIT_FORGE_HELPER: {
          description: 'Absolute path of the dsh-git-forge git credential helper script.',
        },
        DSH_GIT_FORGE_GITCONFIG: {
          description:
            'Absolute path of the dsh-git-forge generated gitconfig (Host also sets GIT_CONFIG_GLOBAL).',
        },
      },
      resolve() {
        ensureHelperGitconfig()
        return {
          DSH_GIT_FORGE_HELPER: HELPER_JS,
          DSH_GIT_FORGE_GITCONFIG: GITCONFIG_PATH,
        }
      },
    })
  } catch (e) {
    console.warn(
      '[dsh-git-forge] shellEnv hints skipped:',
      e && e.message ? e.message : e,
    )
    return () => {}
  }
}

function registerPrompt(ctx) {
  const sp = ctx.get?.('systemPrompt') || ctx.systemPrompt
  if (!sp || typeof sp.section !== 'function') return () => {}
  return sp.section({
    name: 'git-forge-policy',
    order: 118,
    text: [
      'Git forge policy (dsh-git-forge):',
      '- Users authorize GitHub/Gitea/etc accounts per project in the better-sidebar "Git Forge" tab.',
      '- When a project has grants with enforcePush, bash git push / git remote add|set-url to other hosts is blocked.',
      '- Prefer GitForge tool to list allowed accounts for the current project before pushing.',
      '- Never ask the user to paste tokens into chat; tokens are stored only via the sidebar UI.',
      '- HTTPS git in agent bash uses the dsh-git-forge credential helper when the project has exactly one authorized token account for the remote host (R1). Tokens never appear in chat.',
      '- If HTTPS auth fails with multiple token accounts for the same host, keep exactly one granted token account for that host in the Git Forge tab.',
    ].join('\n'),
  })
}

export function apply(ctx) {
  ensureDataDir()
  ensureHelperGitconfig()

  const trustedHosts = () => {
    try {
      return ctx.webRuntime?.trustedHosts || []
    } catch {
      return []
    }
  }

  // webRuntime is optional
  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: 'prefix',
        path: '/dsh-git-forge/api',
        handler: async (req, res) => {
          if (!isTrusted(req, trustedHosts())) {
            writeJson(res, 403, { ok: false, error: 'forbidden' })
            return
          }
          if (req.method !== 'POST') {
            writeJson(res, 405, { ok: false, error: 'method not allowed' })
            return
          }
          const pathname = new URL(req.url || '/', 'http://dsh.internal').pathname
          const prefix = '/dsh-git-forge/api/'
          if (!pathname.startsWith(prefix)) {
            writeJson(res, 404, { ok: false, error: 'not found' })
            return
          }
          const method = pathname.slice(prefix.length)
          if (!method || method.includes('/')) {
            writeJson(res, 404, { ok: false, error: 'not found' })
            return
          }
          try {
            const body = await readJsonBody(req)
            const result = await handleApi(method, body, ctx)
            writeJson(res, 200, result)
          } catch (error) {
            writeJson(res, 500, {
              ok: false,
              error: String(error && error.message ? error.message : error),
            })
          }
        },
      }),
    'dsh-git-forge: api',
  )

  ctx.effect(() => registerGitConfigGlobal(), 'dsh-git-forge: GIT_CONFIG_GLOBAL')
  ctx.effect(() => registerShellEnvHints(ctx), 'dsh-git-forge: shellEnv hints')
  ctx.effect(() => registerGitForgeTool(ctx), 'dsh-git-forge: GitForge tool')
  ctx.effect(() => registerPushGuard(ctx), 'dsh-git-forge: push guard')
  ctx.effect(() => registerPrompt(ctx), 'dsh-git-forge: prompt')
}
