/**
 * Best-effort resolution of bare `git push` targets from repo remotes.
 * Used by push guard when the command has no inline URL.
 */
import { spawnSync } from 'node:child_process'
import { hostFromGitUrl } from './git-policy.js'
import { normalizeProjectKey } from './path.js'

function runGit(args, cwd, timeoutMs = 3000) {
  // Retry once: a transient spawn/lock hiccup must not be mistaken for
  // "no such remote", which the guard treats differently (fail-closed).
  for (let attempt = 0; attempt < 2; attempt++) {
    const r = spawnSync('git', args, {
      cwd: cwd || process.cwd(),
      encoding: 'utf8',
      timeout: timeoutMs,
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: '0',
        GIT_ASKPASS: '',
        // Avoid recursive helper prompts while resolving URLs.
        GCM_INTERACTIVE: 'never',
      },
    })
    if (!r.error && r.status === 0) return String(r.stdout || '').trim()
  }
  return ''
}

/**
 * Parse remote name from a push command when no URL is present.
 * e.g. `git push`, `git push origin`, `git -C x push --force-with-lease origin main`
 */
export function guessPushRemoteName(command) {
  const cmd = String(command || '')
  // After the last `push`, skip flags, take first non-flag token that is not a refspec with :
  const idx = cmd.toLowerCase().lastIndexOf('push')
  if (idx < 0) return 'origin'
  const rest = cmd.slice(idx + 4)
  const tokens = rest.split(/\s+/).filter(Boolean)
  for (const t of tokens) {
    if (t.startsWith('-')) continue
    // skip env-like or path URLs
    if (t.includes('://') || t.includes('@') || t.includes('\\')) continue
    // refspec a:b — not a remote name for our purpose if contains /
    if (t.includes(':') && !t.includes('/')) {
      // could be remote:branch rare; treat left as remote if no slash
      const left = t.split(':')[0]
      if (left && !left.includes('/')) return left
      continue
    }
    if (/^[A-Za-z0-9._-]+$/.test(t)) return t
    break
  }
  return 'origin'
}

/**
 * @param {{ workdir?: string, command: string, classification: { kind: string, targets?: Array<{raw:string,host:string}> } }} input
 * @returns {{ kind: string, targets: Array<{raw:string,host:string}>, resolvedFromRemote?: string, resolveError?: boolean }}
 */
export function enrichPushClassification(input) {
  const classification = input.classification || { kind: 'none' }
  if (classification.kind !== 'push') return classification
  if (Array.isArray(classification.targets) && classification.targets.length > 0) {
    return classification
  }

  const workdir = normalizeProjectKey(input.workdir || '') || process.cwd()
  const toplevel = runGit(['rev-parse', '--show-toplevel'], workdir) || workdir
  const remote = guessPushRemoteName(input.command)
  let url = runGit(['remote', 'get-url', '--push', remote], toplevel)
  if (!url) url = runGit(['remote', 'get-url', remote], toplevel)
  if (!url) {
    // Both lookups failed: the guard cannot verify the target, so surface a
    // resolveError (push guard rejects when enforcement is on).
    return { ...classification, targets: classification.targets || [], resolveError: true }
  }
  const host = hostFromGitUrl(url)
  if (!host) return { ...classification, targets: classification.targets || [] }
  return {
    kind: 'push',
    targets: [{ raw: url, host }],
    resolvedFromRemote: remote,
  }
}
