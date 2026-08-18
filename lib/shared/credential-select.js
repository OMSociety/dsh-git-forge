/**
 * Pure R1 selection: exactly one authorized token account per gitHost.
 * No I/O — secrets lookup stays in the credential helper / Host.
 */

import { normalizeGitHost } from './account-summary.js'
import { normalizeProjectKey } from './path.js'

/**
 * @typedef {{ id: string, gitHost?: string, authMethod?: string, username?: string }} ForgeAccount
 * @typedef {{ accountIds?: string[] }} ProjectGrants
 * @typedef {{ ok: true, account: ForgeAccount } | { ok: false, code: string, message: string }} SelectResult
 */

/**
 * Select exactly one token account for HTTPS git credential fill (R1).
 * @param {{ projectPathKey: string, host: string, grants: ProjectGrants, accounts: ForgeAccount[] }} input
 * @returns {SelectResult}
 */
export function selectTokenAccountForHost(input) {
  const projectPathKey = normalizeProjectKey(input.projectPathKey || '')
  if (!projectPathKey) {
    return { ok: false, code: 'no_project', message: 'no project path for git credential helper' }
  }
  const host = normalizeGitHost(input.host || '')
  if (!host) {
    return { ok: false, code: 'no_grant', message: 'missing git host' }
  }
  const ids = new Set((input.grants && input.grants.accountIds) || [])
  if (!ids.size) {
    return {
      ok: false,
      code: 'no_grant',
      message: `no forge accounts authorized for project ${projectPathKey}`,
    }
  }
  const granted = (input.accounts || []).filter((a) => a && ids.has(a.id))
  const hostMatches = granted.filter((a) => normalizeGitHost(a.gitHost || '') === host)
  if (!hostMatches.length) {
    return { ok: false, code: 'no_grant', message: `no authorized account for host ${host}` }
  }
  const tokenAccounts = hostMatches.filter((a) => (a.authMethod || 'token') === 'token')
  if (hostMatches.length > 0 && tokenAccounts.length === 0) {
    return {
      ok: false,
      code: 'ssh_only',
      message: `only SSH accounts authorized for ${host}; use an SSH remote or system ssh-agent`,
    }
  }
  if (tokenAccounts.length > 1) {
    return {
      ok: false,
      code: 'ambiguous',
      message: `multiple token accounts authorized for ${host}; keep exactly one granted token account for this project (R1)`,
    }
  }
  if (tokenAccounts.length === 1) {
    return { ok: true, account: tokenAccounts[0] }
  }
  return { ok: false, code: 'no_token_account', message: `no token account for ${host}` }
}
