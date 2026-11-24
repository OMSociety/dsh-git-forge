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
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
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
} from './shared/account-summary.js'
import {
  classifyGitWriteCommand,
  evaluatePushPolicy,
  grantedGitHosts,
  hostFromGitUrl,
} from './shared/git-policy.js'
import { enrichPushClassification } from './shared/remote-resolve.js'

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
export const inject = ['webServer', 'connection', 'sessions', 'tools']

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
  let text
  try { text = readFileSync(path, 'utf8') } catch (error) {
    if (error.code === 'ENOENT') return fallback
    throw new Error(`Cannot read ${path}; check file permissions before saving`)
  }
  try { return JSON.parse(text) } catch {
    const quarantine = `${path}.corrupt-${randomUUID()}`
    try { renameSync(path, quarantine) } catch {
      throw new Error(`Cannot archive ${path}; back up the original and repair its JSON or directory permissions before saving`)
    }
    console.warn(`[dsh-git-forge] Invalid JSON archived at ${quarantine}`)
    return fallback
  }
}

function writeJsonFile(path, data, mode = 0o600) {
  ensureDataDir()
  const temp = `${path}.${randomUUID()}.tmp`
  try {
    writeFileSync(temp, JSON.stringify(data, null, 2) + '\n', { flag: 'wx', mode })
    renameSync(temp, path)
  } finally { rmSync(temp, { force: true }) }
}

function sessionCwdOf(ctx, sessionId) {
  try { return sessionId ? normalizeProjectKey(ctx.sessions?.get?.(sessionId)?.header?.cwd) : '' } catch { return '' }
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
  if (authMethod === 'ssh') delete sec.token
  else if (input.token !== undefined) {
    if (input.token === '' || input.token == null) delete sec.token
    else sec.token = String(input.token)
  }

  const idx = doc.accounts.findIndex((a) => a.id === id)
  if (idx >= 0) doc.accounts[idx] = record
  else doc.accounts.push(record)
  secrets.byAccountId[id] = sec
  if (!Object.keys(sec).length) delete secrets.byAccountId[id]
  if (authMethod === 'ssh') { saveSecrets(secrets); saveAccounts(doc) }
  else { saveAccounts(doc); saveSecrets(secrets) }
  return publicAccount(record, secrets)
}

function deleteAccountRecord(id) {
  const doc = loadAccounts()
  const before = doc.accounts.length
  doc.accounts = doc.accounts.filter((a) => a.id !== id)
  if (doc.accounts.length === before) throw new Error('account not found')
  const secrets = loadSecrets()
  const grants = loadGrants()
  delete secrets.byAccountId[id]
  saveSecrets(secrets)
  saveAccounts(doc)
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
    const res = await fetch(url, { headers, redirect: 'error', signal: ac.signal })
    const text = await res.text()
    let login = ''
    try {
      const j = JSON.parse(text)
      const value = account.provider === 'gitlab' ? j?.username : account.provider === 'bitbucket' ? j?.uuid : j?.login
      if (typeof value === 'string') login = value.trim()
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
      }
    }
    if (!login) {
      return {
        ok: false,
        mode: 'token',
        status: res.status,
        url,
        apiBase,
        message: `Expected a user profile for ${account.provider}; check the API root`,
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
        : `API request failed; check DNS, TLS and API root`,
      gitHost: account.gitHost,
    }
  } finally {
    clearTimeout(timer)
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
  try { return JSON.parse(raw) } catch { throw new Error('Invalid JSON request') }
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
    const projectPathKey = sessionCwdOf(ctx, sessionId)
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
    const grants = getProjectGrants(sessionCwdOf(ctx, body.sessionId))
    return { ...grants, allowedHosts: grantedGitHosts(grants.accountIds, loadAccounts().accounts) }
  }

  if (method === 'setGrants') {
    return setProjectGrants(
      sessionCwdOf(ctx, body.sessionId),
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
    const projectPathKey = sessionCwdOf(ctx, body.sessionId)
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
      allowedHosts: grantedGitHosts(grants.accountIds, accounts),
      grants,
    }
  }

  throw new Error('unknown method: ' + method)
}

export function createApiHandler(ctx, dispatch = handleApi) {
  return async (req, res, peer) => {
    // 0.2.2-rc.5: the browser owner is a singleton. Registered API peers may also have kind=owner.
    if (typeof ctx.connection.requestRejection === 'function') {
      let admission
      try { admission = ctx.connection.admit?.(req) } catch { /* fail closed */ }
      if (admission?.rejection === 401 || admission?.rejection === 403) {
        res.statusCode = admission.rejection
        res.end()
        return
      }
      peer = admission?.peer === ctx.connection.browserPeer ? admission?.peer : undefined
    }
    if (peer?.principal?.kind !== 'owner') {
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
      const result = await dispatch(method, body, ctx)
      writeJson(res, 200, result)
    } catch (error) {
      writeJson(res, 500, {
        ok: false,
        error: String(error && error.message ? error.message : error),
      })
    }
  }
}

function resolveProjectFromExec(ctx, exec) {
  return normalizeProjectKey(exec?.agent?.session?.header?.cwd)
}

function registerPushGuard(ctx) {
  if (!ctx.tools || typeof ctx.tools.guard !== 'function') return () => {}
  return ctx.tools.guard((exec) => {
    try {
      const name = exec?.name || exec?.toolName || ''
      if (name !== 'bash' && name !== 'pwsh') return undefined
      const args = exec.arguments || exec.args || {}
      const command = String(args.command || '')
      if (!command) return undefined
      let classification = classifyGitWriteCommand(command)
      if (classification.kind === 'none') return undefined

      if (!resolveProjectFromExec(ctx, exec)) return 'git-forge: session workspace unavailable'

      // Bare `git push` / `git push origin` — resolve configured remote URL (timeout-bounded).
      if (classification.kind === 'push' && !classification.targets?.length && !/^git\s+push(?:\s+(?:--force-with-lease|-u|--set-upstream|[a-zA-Z0-9_./:-]+))*$/.test(command.trim())) {
        classification = { kind: 'push', targets: [], resolveError: true }
      } else if (classification.kind === 'push') {
        const workdir =
          resolve(resolveProjectFromExec(ctx, exec), args.workdir || '')
        classification = enrichPushClassification({
          workdir: String(workdir),
          command,
          classification,
        })
      }

      const projectPathKey = resolveProjectFromExec(ctx, exec)
      const g = getProjectGrants(projectPathKey)
      if (g.enforcePush === false) return undefined
      const enforceMode = g.accountIds.length ? 'enforce' : (g.unboundPolicy || 'allow')

      // A bare `git push` whose remote URL could not be resolved (git missing, workdir gone,
      // repeated timeout) must not silently pass in enforce mode: the guard cannot vouch for
      // the target, so it declines. Unbound-allow projects keep their progressive-enablement
      // promise and are not blocked here.
      if (
        enforceMode === 'enforce' &&
        classification.kind === 'push' &&
        classification.resolveError &&
        !(classification.targets || []).length
      ) {
        return 'git-forge: push blocked — the remote URL could not be resolved, so the push guard cannot verify the target'
      }

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
      'Inspect project-scoped Git forge policy (GitHub/Gitea/etc). Use list_accounts / get_policy / check_remote. Never returns tokens. Preflight checks direct Git push and remote add/set-url in bash and pwsh.',
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
            allowedHosts: grantedGitHosts(grants.accountIds, modelAccounts),
            credentialHelper: {
              projectEnv: 'DSH_GIT_FORGE_PROJECT',
              projectSources: ['env'],
              r1: 'exactly one authorized token account per git host',
              notes:
                'HTTPS fill requires the session workspace (env). Tokens never appear in tool output.',
            },
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

/**
 * git `!<cmd>` credential helper command, written for gitconfig file syntax.
 *
 * The gitconfig parser consumes `"` as quoting, so a value of `!"C:\\dir with space\\node.exe"`
 * reaches the shell as the bare `C:\dir with space\node.exe` and splits on its spaces. Git then
 * fails with `line 1: C:dir: command not found` and the helper never runs. Escaping the inner
 * quotes as `\"` keeps them in the parsed value; git runs the `!` command through a shell.
 */
function helperCommand() {
  const quote = (p) => `\\"${p.replaceAll('\\', '\\\\')}\\"`
  return `!${quote(process.execPath)} ${quote(HELPER_JS)}`
}

/**
 * The user's own global gitconfig, if one exists. `GIT_CONFIG_GLOBAL` replaces the whole global
 * scope for agent shells, so without an `include` the user's identity and proxy settings would
 * vanish there (agent-side `git commit` fails without user.name).
 */
function ensureHelperGitconfig() {
  ensureDataDir()
  if (!existsSync(HELPER_JS)) throw new Error('Git Forge credential helper missing')
  const home = process.env.HOME || homedir()
  const explicit = process.env.GIT_CONFIG_GLOBAL
  const sources = explicit === undefined
    ? [join(process.env.XDG_CONFIG_HOME || join(home, '.config'), 'git', 'config'), join(home, '.gitconfig')]
    : [explicit]
  const includeLines = sources.filter(Boolean).map(normalizeProjectKey)
    .filter(path => path !== normalizeProjectKey(GITCONFIG_PATH))
    .flatMap(path => ['[include]', `\tpath = ${JSON.stringify(path.replaceAll('\\', '/'))}`])
  const content = [
    '# Generated by dsh-git-forge — do not put tokens here',
    ...includeLines,
    '[credential]',
    // An empty helper value clears every `credential.helper` accumulated so far. Git for Windows
    // registers a system-level `helper = helper-selector`, a GUI app that blocks forever when no
    // dialog can be answered (headless agent shell). `credential.helper` is a list variable and
    // entries accumulate across scopes, so without this reset the selector would run first.
    '\thelper =',
    `\thelper = ${helperCommand()}`,
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

/**
 * Point agent shell git children at our helper without writing ~/.gitconfig.
 *
 * The reset and the helper both live in the generated gitconfig (see `ensureHelperGitconfig`),
 * so no environment variables are involved. An earlier attempt injected
 * `GIT_CONFIG_COUNT` / `GIT_CONFIG_KEY_n` / `GIT_CONFIG_VALUE_n` instead: those keys do not
 * reach agent shells here, which left a `GIT_CONFIG_COUNT` with no matching keys and made every
 * git command fail with `fatal: unable to parse command-line config`.
 */
function registerGitConfigGlobal() {
  const path = ensureHelperGitconfig()
  const prev = process.env.GIT_CONFIG_GLOBAL
  process.env.GIT_CONFIG_GLOBAL = path
  return () => {
    if (prev === undefined) delete process.env.GIT_CONFIG_GLOBAL
    else process.env.GIT_CONFIG_GLOBAL = prev
  }
}

/** Non-secret diagnostics + session project key for agent shells (DSH_* only). */
function registerShellEnvHints(ctx) {
  const shellEnv = ctx.get?.('shellEnv')
  if (!shellEnv || typeof shellEnv.register !== 'function') {
    console.warn(
      '[dsh-git-forge] shellEnv service unavailable; DSH_GIT_FORGE_* shell hints are not registered',
    )
    return () => {}
  }
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
        DSH_GIT_FORGE_PROJECT: {
          description:
            'DSH session workspace path used as grants projectPathKey (preferred over git cwd for monorepo subfolders).',
        },
      },
      resolve(execution) {
        const project = resolveProjectFromExec(ctx, execution) || ''
        return {
          DSH_GIT_FORGE_HELPER: HELPER_JS,
          DSH_GIT_FORGE_GITCONFIG: GITCONFIG_PATH,
          DSH_GIT_FORGE_PROJECT: project,
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
  if (!sp || typeof sp.section !== 'function') {
    console.warn(
      '[dsh-git-forge] systemPrompt service unavailable; the git-forge policy section is not injected',
    )
    return () => {}
  }
  return sp.section({
    name: 'git-forge-policy',
    order: 118,
    text: [
      'Git forge policy (dsh-git-forge):',
      '- Users authorize GitHub/Gitea/etc accounts per project in the right sidebar "Git Credentials" tab.',
      '- When a project has grants with enforcePush, bash and pwsh direct git push / git remote add|set-url to other hosts is blocked (including bare `git push` after resolving configured push URLs).',
      '- Prefer GitForge tool (list_accounts / get_policy / check_remote) for the current project before pushing.',
      '- Never ask the user to paste tokens into chat; tokens are stored only via the sidebar UI.',
      '- HTTPS git in agent shells uses the dsh-git-forge credential helper when the project has exactly one authorized token account for the remote host (R1). Tokens never appear in chat.',
      '- Project grants key is the DSH session workspace path (env DSH_GIT_FORGE_PROJECT). Git worktrees under that path (monorepo packages) still use the workspace grant.',
      '- If HTTPS auth fails with multiple token accounts for the same host, keep exactly one granted token account for that host in the Git Forge tab.',
    ].join('\n'),
  })
}

export function apply(ctx) {
  ensureDataDir()

  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: 'prefix',
        path: '/dsh-git-forge/api',
        handler: createApiHandler(ctx),
      }),
    'dsh-git-forge: api',
  )

  ctx.effect(() => registerGitConfigGlobal(), 'dsh-git-forge: GIT_CONFIG_GLOBAL')
  ctx.effect(() => registerShellEnvHints(ctx), 'dsh-git-forge: shellEnv hints')
  ctx.effect(() => registerGitForgeTool(ctx), 'dsh-git-forge: GitForge tool')
  ctx.effect(() => registerPushGuard(ctx), 'dsh-git-forge: push guard')
  ctx.effect(() => registerPrompt(ctx), 'dsh-git-forge: prompt')
}
