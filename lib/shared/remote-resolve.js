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
 * e.g. `git push`, `git push origin`, `git push --force-with-lease origin main`
 */
export function guessPushRemoteName(command) {
  const cmd = String(command || '')
  const args = cmd.trim().match(/^git\s+push(?:\s+(.*))?$/)?.[1] || ''
  const name = args.split(/\s+/).find(arg => arg && !arg.startsWith('-'))
  return name && /^[a-zA-Z0-9_.-]+$/.test(name) ? name : ''
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
  const name = guessPushRemoteName(input.command)
  const branch = name ? '' : runGit(['symbolic-ref', '--quiet', '--short', 'HEAD'], workdir)
  const config = key => runGit(['config', '--get', key], workdir)
  const remotes = name ? [] : runGit(['remote'], workdir).split(/\r?\n/).filter(Boolean)
  const remote = name || (branch && config(`branch.${branch}.pushRemote`)) || config('remote.pushDefault') ||
    (branch && config(`branch.${branch}.remote`)) || (remotes.length === 1 ? remotes[0] : 'origin')
  const urls = runGit(['remote', 'get-url', '--push', '--all', '--', remote], workdir)
  const targets = urls ? urls.split(/\r?\n/).map(raw => ({ raw, host: hostFromGitUrl(raw) })) : []
  if (!targets.length || targets.some(target => !target.host)) return { kind: 'push', targets: [], resolveError: true }
  return { kind: 'push', targets, resolvedFromRemote: remote }
}
