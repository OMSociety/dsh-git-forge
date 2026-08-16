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
 * Whether a shell command is a git write that may change remotes or push.
 */
export function classifyGitWriteCommand(command) {
  const cmd = String(command || '')
  // rough detection of git push / remote mutations (including git -C path push)
  const isGit = /(^|[;&|\n\r(`])\s*(?:sudo\s+)?git(?:\s|$)/.test(cmd)
    || /\bgit\s+(-C\s+\S+\s+)*/.test(cmd)
  if (!isGit && !/\bgit\b/.test(cmd)) {
    return { kind: 'none' }
  }

  if (/\bgit\b[\s\S]*\bpush\b/.test(cmd)) {
    return { kind: 'push', targets: extractGitTargets(cmd) }
  }
  if (/\bgit\b[\s\S]*\bremote\b[\s\S]*\b(add|set-url)\b/.test(cmd)) {
    return { kind: 'remote_write', targets: extractGitTargets(cmd) }
  }
  if (/\bgh\b[\s\S]*\brepo\b[\s\S]*\bcreate\b/.test(cmd)
    || /\bgh\b[\s\S]*\bpr\b[\s\S]*\bcreate\b/.test(cmd)) {
    return { kind: 'gh_write', targets: extractGitTargets(cmd) }
  }
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
