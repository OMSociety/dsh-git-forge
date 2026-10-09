import { normalizeGitHost } from './account-summary.js'

/**
 * Extract git remote-like URLs / scp-style hosts from a shell command string.
 * Best-effort; used only for push / remote policy checks.
 */
export function extractGitTargets(command) {
  const cmd = String(command || '')
  const targets = []
  const seen = new Set()

  const pushUrl = (raw) => {
    const host = hostFromGitUrl(raw)
    if (!host) return
    const key = host + '|' + String(raw)
    if (seen.has(key)) return
    seen.add(key)
    targets.push({ raw: String(raw), host })
  }

  // scp-style: git@host:owner/repo.git
  const scp = /(?:^|[\s'"])((?:git@)?[A-Za-z0-9._-]+(?::\d+)?):([A-Za-z0-9._~/-]+\.git|[A-Za-z0-9._~/-]+)/g
  let m
  while ((m = scp.exec(cmd)) !== null) {
    const left = m[1]
    // avoid matching plain flags like -u:something poorly; require @ or looks like host
    if (!left.includes('@') && !left.includes('.')) continue
    pushUrl(m[0].trim().replace(/^['"]|['"]$/g, ''))
  }

  // https / ssh urls
  const urlRe = /(?:https?:\/\/|git:\/\/|ssh:\/\/)[^\s'"\\]+/gi
  while ((m = urlRe.exec(cmd)) !== null) {
    pushUrl(m[0].replace(/[;,]+$/, ''))
  }

  return targets
}

/** Parse hostname from a git remote URL or scp form. */
export function hostFromGitUrl(raw) {
  const s = String(raw || '').trim()
  if (!s) return ''

  // git@host:path or host:path
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s) && s.includes(':') && !s.includes('://')) {
    const left = s.split(':')[0]
    const hostPart = left.includes('@') ? left.split('@').pop() : left
    return normalizeGitHost(hostPart)
  }

  try {
    const u = new URL(s)
    return normalizeGitHost(u.hostname)
  } catch {
    return normalizeGitHost(s)
  }
}

/**
 * Strip single/double-quoted regions from a shell command. Utility export —
 * classification no longer blanket-strips quotes (quoted payloads are
 * classified via recursion instead).
 */
export function stripShellQuotes(command) {
  return String(command || '')
    .replace(/'(?:\\'|[^'])*'/g, "''")
    .replace(/"(?:\\"|[^"])*"/g, '""')
}

/** Git global flags that consume a separate value token. */
const GIT_GLOBAL_FLAGS_WITH_VALUE = new Set([
  '-C', '-c', '--git-dir', '--work-tree', '--exec-path', '--namespace', '--super-prefix',
])

/** Command wrappers that may precede git without changing the subcommand. */
const WRAPPER_COMMANDS = new Set(['sudo', 'time', 'command', 'exec', 'env'])

function strippedToken(t) {
  return String(t || '').replace(/[)\]}]+$/, '')
}

/**
 * Quote-aware segment splitter: breaks on \n \r ; | & without cutting inside
 * quoted strings, and unfolds $() / backtick command substitutions so the
 * inner command line is visible to classification.
 */
function splitShellSegments(command) {
  const s = String(command || '')
  const parts = []
  let cur = ''
  let quote = ''
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (quote) {
      cur += ch
      if (ch === quote) quote = ''
      continue
    }
    if (ch === '"' || ch === "'") {
      quote = ch
      cur += ch
      continue
    }
    if (ch === '$' && s[i + 1] === '(') {
      parts.push(cur)
      cur = ''
      i++
      continue
    }
    if (ch === '`') {
      parts.push(cur)
      cur = ''
      continue
    }
    if (/[\n\r;|&]/.test(ch)) {
      parts.push(cur)
      cur = ''
      continue
    }
    cur += ch
  }
  parts.push(cur)
  return parts.map((p) => p.trim()).filter(Boolean)
}

/**
 * Payloads of `bash -lc '…'` / `sh -c "…"` quoted strings, for recursive
 * classification. Unquoted payloads are ignored on purpose: `bash -c git push`
 * runs `git` with $0=push, which is not a push.
 */
function shellPayloads(seg) {
  const payloads = []
  const re = /(?:^|\s)-(?:lc|c)\s+(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)')/g
  let m
  while ((m = re.exec(seg)) !== null) {
    const p = m[1] !== undefined ? m[1] : m[2]
    if (p) payloads.push(p.replace(/\\(.)/g, '$1'))
  }
  return payloads
}

/**
 * Locate the git subcommand after the `git` token: skip global flags
 * (value-taking ones consume their value token), return the first non-flag
 * word. Returns '' when no subcommand follows.
 */
function gitSubcommandFrom(tokens, gitIdx) {
  let i = gitIdx + 1
  while (i < tokens.length) {
    const t = strippedToken(tokens[i])
    if (t.startsWith('-')) {
      i += !t.includes('=') && GIT_GLOBAL_FLAGS_WITH_VALUE.has(t) ? 2 : 1
      continue
    }
    return t
  }
  return ''
}

function classifySegment(seg) {
  const tokens = seg.split(/\s+/).filter(Boolean)
  const isEnvAssign = (t) => /^[A-Za-z_][A-Za-z0-9_]*=/.test(t)
  const out = { push: false, remoteWrite: false, ghWrite: false }

  let i = 0
  while (i < tokens.length && isEnvAssign(tokens[i])) i++
  let word = strippedToken(tokens[i] || '')
  if (WRAPPER_COMMANDS.has(word)) {
    i++
    while (i < tokens.length && isEnvAssign(tokens[i])) i++
    word = strippedToken(tokens[i] || '')
  }

  if (word === 'git') {
    const sub = gitSubcommandFrom(tokens, i)
    if (sub === 'push') out.push = true
    if (sub === 'remote' && /\b(?:add|set-url)\b/.test(seg)) out.remoteWrite = true
  } else if (word === 'gh') {
    if (/\brepo\b/.test(seg) && /\bcreate\b/.test(seg)) out.ghWrite = true
    if (/\bpr\b/.test(seg) && /\bcreate\b/.test(seg)) out.ghWrite = true
  } else if (word === 'bash' || word === 'sh') {
    for (const payload of shellPayloads(seg)) {
      const inner = classifyGitWriteCommand(payload)
      if (inner.kind === 'push') out.push = true
      else if (inner.kind === 'remote_write') out.remoteWrite = true
      else if (inner.kind === 'gh_write') out.ghWrite = true
    }
  }
  return out
}

/**
 * Whether a shell command is a git write that may change remotes or push.
 * Detection anchors on the subcommand token after `git` (global flags and
 * env assignments skipped) instead of scanning for the word "push", so
 * prose inside quoted strings no longer triggers false positives, while
 * quoted payloads of bash -lc / sh -c are classified recursively.
 */
export function classifyGitWriteCommand(command) {
  const raw = String(command || '')
  const segments = splitShellSegments(raw)
  let sawPush = false
  let sawRemoteWrite = false
  let sawGhWrite = false
  for (const seg of segments) {
    const r = classifySegment(seg)
    if (r.push) sawPush = true
    if (r.remoteWrite) sawRemoteWrite = true
    if (r.ghWrite) sawGhWrite = true
  }
  // extract targets from full raw command (URLs often outside quotes)
  if (sawPush) return { kind: 'push', targets: extractGitTargets(raw) }
  if (sawRemoteWrite) return { kind: 'remote_write', targets: extractGitTargets(raw) }
  if (sawGhWrite) return { kind: 'gh_write', targets: extractGitTargets(raw) }
  return { kind: 'none' }
}

/**
 * Evaluate whether targets are allowed under project grants.
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function evaluatePushPolicy(opts) {
  const {
    projectPathKey,
    accountIds,
    accounts,
    enforce,
    classification,
  } = opts

  if (!classification || classification.kind === 'none') return { ok: true }

  const granted = Array.isArray(accountIds) ? accountIds : []
  // No grants configured for this project → open (same convenience as unbound SSH tools not existing)
  if (!granted.length) {
    if (enforce === 'deny_unbound') {
      return {
        ok: false,
        reason: `git-forge: project "${projectPathKey || '(unknown)'}" has no authorized forge accounts; grant accounts in the Git Forge sidebar before push/remote writes.`,
      }
    }
    return { ok: true }
  }

  const allowedHosts = new Set()
  const byId = new Map((accounts || []).map((a) => [a.id, a]))
  for (const id of granted) {
    const a = byId.get(id)
    if (!a) continue
    const h = normalizeGitHost(a.gitHost)
    if (h) allowedHosts.add(h)
    // api host may differ slightly; also allow hostname of apiBase
    try {
      if (a.apiBase) {
        const u = new URL(a.apiBase)
        const ah = normalizeGitHost(u.hostname)
        if (ah) allowedHosts.add(ah)
      }
    } catch { /* ignore */ }
  }

  if (!allowedHosts.size) {
    return {
      ok: false,
      reason: `git-forge: granted accounts have no gitHost configured for project "${projectPathKey}".`,
    }
  }

  const targets = classification.targets || []
  // push without explicit URL still dangerous: block if command mentions a disallowed host string,
  // otherwise allow and rely on remote already set (we cannot resolve git config here synchronously without shell).
  if (!targets.length) {
    // Heuristic: if command text contains a known non-allowed popular host while grants exist, block.
    const cmd = String(opts.command || '').toLowerCase()
    const popular = ['github.com', 'gitee.com', 'gitlab.com', 'bitbucket.org']
    for (const h of popular) {
      if (cmd.includes(h) && !allowedHosts.has(h)) {
        return {
          ok: false,
          reason: `git-forge: blocked ${classification.kind} mentioning "${h}"; this project may only use: ${[...allowedHosts].join(', ')}`,
        }
      }
    }
    // No explicit URL — allow (remote may already be correct). Soft note via reason empty.
    return { ok: true }
  }

  for (const t of targets) {
    const host = normalizeGitHost(t.host)
    if (!host) continue
    if (!allowedHosts.has(host)) {
      return {
        ok: false,
        reason: `git-forge: blocked ${classification.kind} to "${host}" (from ${t.raw}). Project "${projectPathKey}" may only push/remote to: ${[...allowedHosts].join(', ')}`,
      }
    }
  }
  return { ok: true }
}
