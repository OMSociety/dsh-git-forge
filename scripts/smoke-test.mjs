#!/usr/bin/env node
/**
 * Offline smoke tests (no network, no DSH process).
 * Run: node scripts/smoke-test.mjs
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { normalizeProjectKey, isPathInsideRoots, resolveGrantsProjectKey } from '../lib/shared/path.js'
import {
  publicAccount,
  modelAccountSummary,
  assertNoSecretFields,
  normalizeGitHost,
  normalizeApiBase,
} from '../lib/shared/account-summary.js'
import {
  hostFromGitUrl,
  extractGitTargets,
  classifyGitWriteCommand,
  evaluatePushPolicy,
} from '../lib/shared/git-policy.js'
import { selectTokenAccountForHost } from '../lib/shared/credential-select.js'
import { guessPushRemoteName } from '../lib/shared/remote-resolve.js'
import {
  parseCredentialInput,
  resolveHelperProjectKey,
} from './git-credential-dsh-git-forge.mjs'

let failed = 0
function test(name, fn) {
  try {
    fn()
    console.log('ok  ', name)
  } catch (e) {
    failed++
    console.error('FAIL', name, e && e.message ? e.message : e)
  }
}

test('normalizeProjectKey', () => {
  const key = normalizeProjectKey('/workspace/DSH-plugin/')
  assert.equal(key, normalizeProjectKey('/workspace/DSH-plugin'))
  assert.ok(!key.endsWith('/') && !key.endsWith('\\'), 'no trailing separator')
  assert.equal(normalizeProjectKey(''), '')
})

test('normalizeProjectKey resolves real paths idempotently', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dgf-real-'))
  try {
    const key = normalizeProjectKey(dir)
    assert.equal(normalizeProjectKey(key), key, 'idempotent on its own output')
    assert.equal(key, realpathSync(dir), 'existing paths collapse to the real path')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('isPathInsideRoots handles platform separators', () => {
  const root = normalizeProjectKey('/workspace/DSH-plugin')
  const child = normalizeProjectKey('/workspace/DSH-plugin/sub/file.txt')
  const outside = normalizeProjectKey('/workspace/other')
  assert.equal(isPathInsideRoots(child, [root]), true)
  assert.equal(isPathInsideRoots(root, [root]), true)
  assert.equal(isPathInsideRoots(outside, [root]), false)
})

test('isPathInsideRoots accepts children of filesystem roots', () => {
  const root = normalizeProjectKey('/')
  assert.equal(isPathInsideRoots(normalizeProjectKey('/etc/passwd'), [root]), true)
  assert.equal(isPathInsideRoots(root, [root]), true)
})

test('hostFromGitUrl scp and https', () => {
  assert.equal(hostFromGitUrl('git@github.com:org/repo.git'), 'github.com')
  assert.equal(hostFromGitUrl('https://gitea.example.com/org/repo.git'), 'gitea.example.com')
  assert.equal(hostFromGitUrl('ssh://git@github.com/org/repo.git'), 'github.com')
})

test('extractGitTargets finds hosts', () => {
  const t = extractGitTargets('git push git@github.com:a/b.git')
  assert.ok(t.some((x) => x.host === 'github.com'))
  const t2 = extractGitTargets('git remote set-url origin https://gitea.company/x/y.git')
  assert.ok(t2.some((x) => x.host === 'gitea.company'))
})

test('classifyGitWriteCommand', () => {
  assert.equal(classifyGitWriteCommand('git status').kind, 'none')
  assert.equal(classifyGitWriteCommand('git push origin main').kind, 'push')
  assert.equal(classifyGitWriteCommand('git remote set-url origin https://github.com/a/b.git').kind, 'remote_write')
  // commit message must not look like a push
  assert.equal(
    classifyGitWriteCommand('git commit -m "fix: bare git push guard"').kind,
    'none',
  )
  // path dsh-git-forge + URL must not be push without git push subcommand
  assert.equal(
    classifyGitWriteCommand('node -e "fetch(\'http://127.0.0.1:3080/dsh-git-forge/api/health\')"').kind,
    'none',
  )
})

test('classifyGitWriteCommand quoted payloads and anchored subcommand', () => {
  assert.equal(classifyGitWriteCommand("bash -lc 'git push origin main'").kind, 'push')
  assert.equal(classifyGitWriteCommand('sh -c "git push origin main"').kind, 'push')
  assert.equal(classifyGitWriteCommand('echo please git push now').kind, 'none')
  assert.equal(classifyGitWriteCommand("git commit -m 'please push'").kind, 'none')
  assert.equal(classifyGitWriteCommand('git -C sub push').kind, 'push')
})

test('strip-mount removes CRLF blocks and keeps EOL style', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dgf-strip-'))
  try {
    const file = join(dir, 'cordis.patch.yml')
    writeFileSync(file, 'packages:\r\n- insert:\r\n    - id: git-forge\r\n      name: dsh-git-forge\r\n')
    const stripMount = fileURLToPath(new URL('./lib/strip-mount.cjs', import.meta.url))
    execFileSync(process.execPath, [stripMount, file, 'git-forge'])
    assert.equal(readFileSync(file, 'utf8'), 'packages:\r\n', 'block removed, CRLF preserved')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('evaluatePushPolicy blocks wrong host when granted', () => {
  const accounts = [
    { id: 'a1', gitHost: 'gitea.local', apiBase: 'https://gitea.local/api/v1' },
  ]
  const bad = evaluatePushPolicy({
    projectPathKey: '/workspace/secret',
    accountIds: ['a1'],
    accounts,
    enforce: 'enforce',
    classification: {
      kind: 'push',
      targets: [{ raw: 'git@github.com:x/y.git', host: 'github.com' }],
    },
    command: 'git push git@github.com:x/y.git',
  })
  assert.equal(bad.ok, false)
  assert.match(bad.reason, /github.com/)

  const good = evaluatePushPolicy({
    projectPathKey: '/workspace/secret',
    accountIds: ['a1'],
    accounts,
    enforce: 'enforce',
    classification: {
      kind: 'push',
      targets: [{ raw: 'git@gitea.local:x/y.git', host: 'gitea.local' }],
    },
    command: 'git push git@gitea.local:x/y.git',
  })
  assert.equal(good.ok, true)
})

test('unbound allow vs deny', () => {
  const allow = evaluatePushPolicy({
    projectPathKey: '/workspace/x',
    accountIds: [],
    accounts: [],
    enforce: 'allow',
    classification: { kind: 'push', targets: [{ raw: 'https://github.com/a/b', host: 'github.com' }] },
    command: 'git push https://github.com/a/b',
  })
  assert.equal(allow.ok, true)

  const deny = evaluatePushPolicy({
    projectPathKey: '/workspace/x',
    accountIds: [],
    accounts: [],
    enforce: 'deny_unbound',
    classification: { kind: 'push', targets: [{ raw: 'https://github.com/a/b', host: 'github.com' }] },
    command: 'git push https://github.com/a/b',
  })
  assert.equal(deny.ok, false)
})

test('publicAccount never leaks token', () => {
  const account = {
    id: 'a1',
    name: 'gh',
    provider: 'github',
    gitHost: 'github.com',
    apiBase: 'https://api.github.com',
    authMethod: 'token',
  }
  const secrets = { byAccountId: { a1: { token: 'ghp_secret' } } }
  const pub = publicAccount(account, secrets)
  assert.equal(pub.credentialStatus, 'saved')
  assert.equal('token' in pub, false)
  assertNoSecretFields(pub)
  assertNoSecretFields(modelAccountSummary(account, secrets))
})

test('normalizeGitHost', () => {
  assert.equal(normalizeGitHost('https://GitHub.com/foo'), 'github.com')
})

test('normalizeApiBase gitea appends /api/v1', () => {
  assert.equal(
    normalizeApiBase('gitea', 'https://gitea.example.invalid'),
    'https://gitea.example.invalid/api/v1',
  )
  assert.equal(
    normalizeApiBase('gitea', 'https://gitea.example.invalid/api/v1'),
    'https://gitea.example.invalid/api/v1',
  )
})

test('R1 selects single token account', () => {
  const r = selectTokenAccountForHost({
    projectPathKey: '/workspace/app',
    host: 'github.com',
    grants: { accountIds: ['a1'] },
    accounts: [{ id: 'a1', gitHost: 'github.com', authMethod: 'token', username: 'u' }],
  })
  assert.equal(r.ok, true)
  assert.equal(r.account.id, 'a1')
})

test('R1 rejects ambiguous token accounts', () => {
  const r = selectTokenAccountForHost({
    projectPathKey: '/workspace/app',
    host: 'GitHub.COM',
    grants: { accountIds: ['a1', 'a2'] },
    accounts: [
      { id: 'a1', gitHost: 'github.com', authMethod: 'token', username: 'u1' },
      { id: 'a2', gitHost: 'github.com', authMethod: 'token', username: 'u2' },
    ],
  })
  assert.equal(r.ok, false)
  assert.equal(r.code, 'ambiguous')
})

test('R1 ssh_only when no token account', () => {
  const r = selectTokenAccountForHost({
    projectPathKey: '/workspace/app',
    host: 'github.com',
    grants: { accountIds: ['s1'] },
    accounts: [{ id: 's1', gitHost: 'github.com', authMethod: 'ssh', username: 'git' }],
  })
  assert.equal(r.ok, false)
  assert.equal(r.code, 'ssh_only')
})

test('parseCredentialInput', () => {
  const o = parseCredentialInput('protocol=https\nhost=github.com\npath=org/repo.git\n\n')
  assert.equal(o.protocol, 'https')
  assert.equal(o.host, 'github.com')
  assert.equal(o.path, 'org/repo.git')
})

test('resolveGrantsProjectKey walks monorepo child to workspace grant', () => {
  const wsKey = normalizeProjectKey('/workspace/DSH-plugin')
  const child = normalizeProjectKey('/workspace/DSH-plugin/dsh-git-forge')
  const projects = {
    [wsKey]: { accountIds: ['a1'] },
  }
  const r = resolveGrantsProjectKey(child, projects)
  assert.equal(r.key, wsKey)
  assert.equal(r.source, 'walk')
  const exact = resolveGrantsProjectKey(wsKey, projects)
  assert.equal(exact.source, 'cwd')
})

test('resolveHelperProjectKey prefers env over cwd walk', () => {
  const wsKey = normalizeProjectKey('/workspace/DSH-plugin')
  const other = normalizeProjectKey('/workspace/other/pkg')
  const projects = { [wsKey]: { accountIds: ['a1'] } }
  const r = resolveHelperProjectKey({
    envProject: wsKey,
    cwd: other,
    projects,
  })
  assert.equal(r.source, 'env')
  assert.equal(r.key, wsKey)
})

test('guessPushRemoteName', () => {
  assert.equal(guessPushRemoteName('git push'), 'origin')
  assert.equal(guessPushRemoteName('git push origin main'), 'origin')
  assert.equal(guessPushRemoteName('git push --force-with-lease upstream HEAD'), 'upstream')
})

if (failed) {
  console.error(`\n${failed} failed`)
  process.exit(1)
}
console.log('\nall passed')
