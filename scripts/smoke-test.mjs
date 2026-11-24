#!/usr/bin/env node
/**
 * Offline smoke tests (no network, no DSH process).
 * Run: node scripts/smoke-test.mjs
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { syncBuiltinESMExports } from 'node:module'
import fs, { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { normalizeProjectKey, isPathInsideRoots } from '../lib/shared/path.js'
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
import { packProblems } from './check-pack.mjs'
const temp = mkdtempSync(join(tmpdir(), 'forge-test-'))
process.env.DSH_HOME = temp
process.env.HOME = temp
process.env.XDG_CONFIG_HOME = join(temp, 'xdg')
delete process.env.GIT_CONFIG_GLOBAL
process.env.GIT_CONFIG_NOSYSTEM = '1'
const { createApiHandler, inject, apply } = await import('../lib/index.js')
process.on('exit', () => rmSync(temp, { recursive: true, force: true }))
import {
  parseCredentialInput,
  resolveHelperProjectKey,
} from './git-credential-dsh-git-forge.mjs'

const tests = []
function test(name, fn) {
  tests.push({ name, fn })
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

test('helper requires explicit session workspace', () => {
  assert.equal(resolveHelperProjectKey({ cwd: temp }).key, '')
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
  assert.equal(guessPushRemoteName('git push'), '')
  assert.equal(guessPushRemoteName('git push origin main'), 'origin')
  assert.equal(guessPushRemoteName('git push --force-with-lease upstream HEAD'), 'upstream')
})

function createOfflineRequest(events) {
  return {
    method: 'POST',
    get url() {
      events.push('url')
      return '/dsh-git-forge/api/listAccounts'
    },
    async *[Symbol.asyncIterator]() {
      events.push('body')
      yield Buffer.from('{"offline":true}')
    },
  }
}

function createOfflineResponse(events) {
  return {
    statusCode: 200,
    headers: {},
    setHeader(name, value) {
      this.headers[name] = value
    },
    end(body = '') {
      events.push('end')
      this.body = body
      this.ended = true
    },
  }
}

async function assertRejectedApiRequest(status) {
  const events = []
  const req = createOfflineRequest(events)
  const res = createOfflineResponse(events)
  let dispatchCalls = 0
  const ctx = {
    connection: {
      requestRejection() {},
      admit(request) {
        assert.equal(request, req)
        events.push('authorize')
        return { rejection: status }
      },
    },
  }
  const handler = createApiHandler(ctx, async () => {
    dispatchCalls++
    throw new Error('rejected request reached dispatch')
  })
  await handler(req, res)
  assert.equal(res.statusCode, status)
  assert.equal(res.ended, true)
  assert.equal(res.body, '')
  assert.equal(dispatchCalls, 0)
  assert.deepEqual(events, ['authorize', 'end'])
}

test('API handler returns 401 before URL, body, or dispatch access', async () => {
  assert.ok(inject.includes('connection'))
  await assertRejectedApiRequest(401)
})

test('API handler returns 403 before URL, body, or dispatch access', async () => {
  await assertRejectedApiRequest(403)
})

test('API handler continues only after access check allows request', async () => {
  const events = []
  const req = createOfflineRequest(events)
  const res = createOfflineResponse(events)
  const ctx = {
    connection: {
      requestRejection() {},
      admit(request) {
        assert.equal(request, req)
        events.push('authorize')
        return { peer: this.browserPeer }
      },
      browserPeer: fakePeer('owner'),
    },
  }
  const handler = createApiHandler(ctx, async (method, body, dispatchCtx) => {
    events.push('dispatch')
    assert.equal(method, 'listAccounts')
    assert.deepEqual(body, { offline: true })
    assert.equal(dispatchCtx, ctx)
    return { ok: true, offline: true }
  })
  await handler(req, res)
  assert.equal(res.statusCode, 200)
  assert.deepEqual(JSON.parse(res.body), { ok: true, offline: true })
  assert.deepEqual(events, ['authorize', 'url', 'body', 'dispatch', 'end'])
})

function fakePeer(kind) {
  return { principal: { kind } }
}

test('API handler continues on new host when an owner peer is passed', async () => {
  const events = []
  const req = createOfflineRequest(events)
  const res = createOfflineResponse(events)
  const ctx = { connection: {} }
  const handler = createApiHandler(ctx, async (method, body, dispatchCtx) => {
    events.push('dispatch')
    assert.equal(method, 'listAccounts')
    assert.deepEqual(body, { offline: true })
    assert.equal(dispatchCtx, ctx)
    return { ok: true, offline: true }
  })
  await handler(req, res, fakePeer('owner'))
  assert.equal(res.statusCode, 200)
  assert.deepEqual(JSON.parse(res.body), { ok: true, offline: true })
  assert.deepEqual(events, ['url', 'body', 'dispatch', 'end'])
})

test('API handler answers 403 on new host for a non-owner peer before URL or body', async () => {
  const events = []
  const req = createOfflineRequest(events)
  const res = createOfflineResponse(events)
  let dispatchCalls = 0
  const handler = createApiHandler({ connection: {} }, async () => {
    dispatchCalls++
    throw new Error('non-owner peer reached dispatch')
  })
  await handler(req, res, fakePeer('anonymous'))
  assert.equal(res.statusCode, 403)
  assert.equal(res.ended, true)
  assert.equal(JSON.parse(res.body).ok, false)
  assert.equal(dispatchCalls, 0)
  assert.deepEqual(events, ['end'])
})

test('API handler answers 403 on new host when no peer is passed', async () => {
  const events = []
  const req = createOfflineRequest(events)
  const res = createOfflineResponse(events)
  let dispatchCalls = 0
  const handler = createApiHandler({ connection: {} }, async () => {
    dispatchCalls++
  })
  await handler(req, res)
  assert.equal(res.statusCode, 403)
  assert.equal(JSON.parse(res.body).ok, false)
  assert.equal(dispatchCalls, 0)
  assert.deepEqual(events, ['end'])
})

test('rc.5 API peer, missing admission and missing browser principal fail before dispatch', async () => {
  for (const connection of [
    { browserPeer: fakePeer('owner'), admit: () => ({ peer: fakePeer('owner') }) },
    {}, { admit: () => ({}) },
  ]) {
    const events = [], response = createOfflineResponse(events)
    await createApiHandler({ connection: { requestRejection() {}, ...connection } })(createOfflineRequest(events), response, fakePeer('owner'))
    assert.equal(response.statusCode, 403)
    assert.deepEqual(events, ['end'])
  }
})

function fixture() {
  const contexts = [], host = { sessions: { get: id => id === 's' ? { header: { cwd: temp } } : undefined }, connection: {},
    effect(fn) { contexts.unshift(fn()) }, webServer: { register(route) { host.handler = route.handler } },
    tools: { register(tool) { host.tool = tool; return () => {} }, guard(fn) { host.guard = fn } },
    get(name) { return name === 'shellEnv' ? { register(c) { host.hints = c } } : { section() {} } },
  }
  apply(host)
  host.close = () => contexts.forEach(fn => fn?.())
  host.call = async (method, body = {}) => {
    const res = createOfflineResponse([])
    await host.handler({ method: 'POST', url: '/dsh-git-forge/api/' + method,
      async *[Symbol.asyncIterator]() { yield Buffer.from(JSON.stringify(body)) },
    }, res, fakePeer('owner'))
    return JSON.parse(res.body)
  }
  return host
}

test('Git reads XDG then HOME or explicit global; disposal restores original scope', () => {
  const xdg = join(process.env.XDG_CONFIG_HOME, 'git'); mkdirSync(xdg, { recursive: true })
  writeFileSync(join(xdg, 'config'), '[fixture]\nfromxdg=true\norder=xdg\n')
  writeFileSync(join(temp, '.gitconfig'), '[fixture]\norder=home\n')
  const custom = join(temp, 'explicit'); writeFileSync(custom, '[fixture]\norder=explicit\n')
  const git = key => execFileSync('git', ['config', '--global', '--includes', '--get', 'fixture.' + key], { encoding: 'utf8', cwd: temp }).trim()
  for (const original of [undefined, custom]) {
    if (original) process.env.GIT_CONFIG_GLOBAL = original
    const f = fixture()
    try { assert.equal(git('order'), original ? 'explicit' : 'home'); if (!original) assert.equal(git('fromxdg'), 'true') }
    finally { f.close() }
    assert.equal(process.env.GIT_CONFIG_GLOBAL, original)
  }
  delete process.env.GIT_CONFIG_GLOBAL
})

test('session grants, saved policy projection, Bash and Pwsh preflight and SSH cleanup', async () => {
  const f = fixture(), exec = { agent: { session: { header: { cwd: temp } } } }
  const fetchBefore = globalThis.fetch
  try {
    const empty = await f.call('getProjectContext', { cwd: temp }); assert.equal(empty.hasProject, false)
    assert.equal((await f.call('setGrants', { cwd: temp })).ok, false)
    assert.equal((await f.call('getProjectContext', { sessionId: 's' })).projectPathKey, normalizeProjectKey(temp))
    assert.equal(f.hints.resolve({}).DSH_GIT_FORGE_PROJECT, '')
    assert.equal(f.hints.resolve(exec).DSH_GIT_FORGE_PROJECT, normalizeProjectKey(temp))
    const { account } = await f.call('saveAccount', { gitHost: 'git.example.invalid', apiBase: 'https://api.example.invalid', token: 'fixture' })
    await f.call('setGrants', { sessionId: 's', accountIds: [account.id] })
    assert.deepEqual((await f.call('getGrants', { sessionId: 's' })).allowedHosts, ['git.example.invalid'])
    for (const name of ['bash', 'pwsh']) for (const op of ['push', 'remote add origin', 'remote set-url origin']) {
      const check = host => f.guard({ ...exec, name, arguments: { command: `git ${op} https://${host}/demo.git` } })
      assert.equal(check('git.example.invalid'), undefined); assert.match(check('api.example.invalid'), /blocked/)
    }
    const repo = join(temp, 'repository'); mkdirSync(repo)
    const git = (...args) => execFileSync('git', args, { cwd: repo, stdio: 'ignore' })
    git('init'); git('remote', 'add', 'fixture', 'https://git.example.invalid/demo'); git('config', 'remote.pushDefault', 'fixture')
    const bare = () => f.guard({ ...exec, name: 'pwsh', arguments: { command: 'git push', workdir: 'repository' } })
    assert.equal(bare(), undefined)
    git('remote', 'set-url', '--add', '--push', 'fixture', 'https://git.example.invalid/one')
    git('remote', 'set-url', '--add', '--push', 'fixture', 'https://second.example.invalid/two')
    assert.match(bare(), /blocked/)
    for (const [payload, ok] of [[{}, false], [{ login: 'sample' }, true]]) {
      globalThis.fetch = async () => new Response(JSON.stringify(payload))
      assert.equal((await f.call('probeAccount', { id: account.id })).ok, ok)
    }
    globalThis.fetch = async () => new Response('private upstream detail', { status: 403 })
    assert.doesNotMatch(JSON.stringify(await f.call('probeAccount', { id: account.id })), /private upstream detail/)
    await f.call('saveAccount', { id: account.id, authMethod: 'ssh' })
    const secrets = JSON.parse(readFileSync(join(temp, 'git-forge', 'secrets.json')))
    assert.equal(Object.hasOwn(secrets.byAccountId[account.id] || {}, 'token'), false)
  } finally { globalThis.fetch = fetchBefore; f.close() }
})

test('a failed quarantine preserves damaged bytes and blocks a save', async () => {
  const f = fixture(), original = fs.renameSync, file = join(temp, 'git-forge', 'accounts.json')
  const before = readFileSync(file); writeFileSync(file, '{')
  try {
    fs.renameSync = (src, dest) => { if (src === file) throw new Error('fixture archive error'); return original(src, dest) }
    syncBuiltinESMExports()
    const result = await f.call('saveAccount', { gitHost: 'example.invalid' })
    assert.equal(result.ok, false); assert.match(result.error, /Cannot archive/)
    assert.equal(readFileSync(file, 'utf8'), '{')
  } finally { fs.renameSync = original; syncBuiltinESMExports(); writeFileSync(file, before); f.close() }
})

test('pack validator rejects missing literal exports and files independently', () => {
  const pkg = { main: 'index.js', icon: 'icon.svg', dsh: { bundle: { patch: 'patch.yml' } }, files: ['index.js'], exports: { '.': './index.js' } }
  const paths = ['index.js', 'icon.svg', 'patch.yml', 'package.json']
  assert.deepEqual(packProblems(pkg, paths), [])
  assert.deepEqual(packProblems({ ...pkg, files: ['missing.txt'] }, paths), ['missing.txt'])
  assert.deepEqual(packProblems({ ...pkg, exports: { '.': { import: './missing.js' } } }, paths), ['missing.js'])
})

test('browser entry has only its host-provided React module', () => {
  const source = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
  assert.deepEqual([...source.matchAll(/\brequire\(["']([^"']+)["']\)/g)].map(m => m[1]), ['react'])
  assert.doesNotMatch(source, /\bimport\s*(?:\(|["'{*]|[\w$]+\s+from)|node:/)
})

let failed = 0
for (const { name, fn } of tests) {
  try {
    await fn()
    console.log('ok  ', name)
  } catch (e) {
    failed++
    console.error('FAIL', name, e && e.stack ? e.stack : e)
  }
}

if (failed) {
  console.error(`\n${failed} failed`)
  process.exit(1)
}
console.log(`\n${tests.length} tests passed`)
