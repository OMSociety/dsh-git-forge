import { isAbsolute, join, normalize, resolve as pathResolve } from 'node:path'

/** Normalize a project path key (absolute, no trailing slash except root). */
export function normalizeProjectKey(raw) {
  if (!raw || typeof raw !== 'string') return ''
  let p = raw.trim()
  if (!p) return ''
  try {
    p = pathResolve(p)
  } catch {
    return ''
  }
  p = normalize(p)
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1)
  return p
}

/**
 * Whether abs is inside one of the allowed roots.
 */
export function isPathInsideRoots(absPath, roots) {
  const abs = normalizeProjectKey(absPath)
  if (!abs) return false
  const list = (roots || []).map(normalizeProjectKey).filter(Boolean)
  for (const root of list) {
    if (abs === root || abs.startsWith(root + '/')) return true
  }
  return false
}

export function joinUnderRoot(root, relOrAbs) {
  const r = normalizeProjectKey(root) || '/workspace'
  let abs = String(relOrAbs || r)
  if (!isAbsolute(abs)) abs = join(r, abs)
  abs = pathResolve(abs)
  if (!isPathInsideRoots(abs, [r, '/workspace'])) {
    throw new Error('path outside allowed roots')
  }
  return abs
}

export { isAbsolute, join, normalize, pathResolve }
