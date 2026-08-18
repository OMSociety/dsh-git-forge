#!/usr/bin/env node
/**
 * Offline smoke tests (no network, no DSH process).
 * Run: node scripts/smoke-test.mjs
 */
import assert from 'node:assert/strict'
import { normalizeProjectKey, resolveGrantsProjectKey } from '../lib/shared/path.js'
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
  assert.equal(normalizeProjectKey('/workspace/DSH-plugin/'), '/workspace/DSH-plugin')
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
    normalizeApiBase('gitea', 'https://gitea.mi.pp00.top'),
    'https://gitea.mi.pp00.top/api/v1',
  )
  assert.equal(
    normalizeApiBase('gitea', 'https://gitea.mi.pp00.top/api/v1'),
    'https://gitea.mi.pp00.top/api/v1',
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
  const projects = {
    '/workspace/DSH-plugin': { accountIds: ['a1'] },
  }
  const r = resolveGrantsProjectKey('/workspace/DSH-plugin/dsh-git-forge', projects)
  assert.equal(r.key, '/workspace/DSH-plugin')
  assert.equal(r.source, 'walk')
  const exact = resolveGrantsProjectKey('/workspace/DSH-plugin', projects)
  assert.equal(exact.source, 'cwd')
})

test('resolveHelperProjectKey prefers env over cwd walk', () => {
  const projects = { '/workspace/DSH-plugin': { accountIds: ['a1'] } }
  const r = resolveHelperProjectKey({
    envProject: '/workspace/DSH-plugin',
    cwd: '/workspace/other/pkg',
    projects,
  })
  assert.equal(r.source, 'env')
  assert.equal(r.key, '/workspace/DSH-plugin')
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
