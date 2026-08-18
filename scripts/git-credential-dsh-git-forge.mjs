#!/usr/bin/env node
/**
 * git credential helper for dsh-git-forge.
 * gitconfig: helper = !/path/to/node /path/to/git-credential-dsh-git-forge.mjs
 *
 * Protocol: https://git-scm.com/docs/gitcredentials
 * Only "get" fills credentials. store/erase are no-ops (secrets stay in secrets.json).
 *
 * Never log password/token. Optional DSH_GIT_FORGE_HELPER_DEBUG=1 enables non-secret stderr.
 */
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve as pathResolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { normalizeProjectKey } from '../lib/shared/path.js'
import { selectTokenAccountForHost } from '../lib/shared/credential-select.js'

function dataDir() {
  const home = process.env.DSH_HOME || join(homedir(), '.dsh')
  return join(home, 'git-forge')
}

function readJson(path, fallback) {
  try {
    if (!existsSync(path)) return fallback
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return fallback
  }
}

/** @param {string} text */
export function parseCredentialInput(text) {
  const out = {}
  for (const line of String(text || '').split(/\r?\n/)) {
    if (!line || !line.includes('=')) continue
    const i = line.indexOf('=')
    out[line.slice(0, i)] = line.slice(i + 1)
  }
  return out
}

async function readStdin() {
  const chunks = []
  for await (const c of process.stdin) chunks.push(c)
  return Buffer.concat(chunks).toString('utf8')
}

function debug(msg) {
  if (process.env.DSH_GIT_FORGE_HELPER_DEBUG === '1') {
    console.error(`[dsh-git-forge-helper] ${msg}`)
  }
}

async function runGet() {
  const raw = await readStdin()
  const req = parseCredentialInput(raw)
  const host = req.host || ''
  const projectPathKey =
    normalizeProjectKey(process.env.DSH_GIT_FORGE_PROJECT || '') ||
    normalizeProjectKey(process.cwd())

  const dir = dataDir()
  const accountsDoc = readJson(join(dir, 'accounts.json'), { version: 1, accounts: [] })
  const grantsDoc = readJson(join(dir, 'grants.json'), { version: 1, projects: {} })
  const secretsDoc = readJson(join(dir, 'secrets.json'), { version: 1, byAccountId: {} })
  const grants = (grantsDoc.projects && grantsDoc.projects[projectPathKey]) || { accountIds: [] }

  const selected = selectTokenAccountForHost({
    projectPathKey,
    host,
    grants,
    accounts: accountsDoc.accounts || [],
  })
  if (!selected.ok) {
    debug(`${selected.code}: ${selected.message}`)
    return
  }
  const token =
    secretsDoc.byAccountId && secretsDoc.byAccountId[selected.account.id]
      ? secretsDoc.byAccountId[selected.account.id].token
      : ''
  if (!token) {
    debug('token missing in secrets store')
    return
  }
  const username = selected.account.username || 'git'
  process.stdout.write(`username=${username}\npassword=${token}\n\n`)
}

async function main() {
  const action = process.argv[2] || 'get'
  if (action !== 'get') {
    process.exit(0)
  }
  try {
    await runGet()
    process.exit(0)
  } catch (e) {
    debug(e && e.message ? e.message : String(e))
    process.exit(1)
  }
}

const selfPath = fileURLToPath(import.meta.url)
const entryPath = process.argv[1] ? pathResolve(process.argv[1]) : ''
if (entryPath && selfPath === entryPath) {
  main()
}
