#!/usr/bin/env node
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export function packProblems(pkg, paths) {
  const problems = []
  const files = paths.map(p => p.replaceAll('\\', '/'))
  function check(path, directory = false) {
    const target = path.replace(/^\.\//, '').replace(/\/$/, '')
    const pattern = new RegExp('^' + target.split('*').map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*') + '$')
    if (!files.some(p => pattern.test(p) || (directory && p.startsWith(target + '/')))) problems.push(target)
  }
  function visit(target) {
    if (typeof target === 'string' && target.startsWith('./')) check(target)
    else if (target && typeof target === 'object') Object.values(target).forEach(visit)
  }
  visit(pkg.exports)
  for (const p of [pkg.main, pkg.icon, pkg.dsh.bundle.patch, 'package.json']) check(p)
  for (const p of pkg.files.filter(p => !p.startsWith('!'))) check(p, true)
  return problems.concat(files.filter(p => /(^|\/)(node_modules|\.git)\//.test(p)))
}

if (fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
  const report = JSON.parse(execSync('npm pack --dry-run --json', { encoding: 'utf8' }))
  const [meta] = Object.values(report)
  const problems = packProblems(pkg, meta.files.map(f => f.path))
  if (problems.length) throw new Error('Invalid package manifest: ' + problems.join(', '))
  console.log(`[check-pack] ok: ${meta.files.length} packed files`)
}
