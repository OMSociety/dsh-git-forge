import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'

function check(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) check(path)
    else if (/\.[cm]?js$/.test(path)) execFileSync(process.execPath, ['--check', path], { stdio: 'inherit' })
  }
}
for (const dir of ['lib', 'scripts']) check(dir)
