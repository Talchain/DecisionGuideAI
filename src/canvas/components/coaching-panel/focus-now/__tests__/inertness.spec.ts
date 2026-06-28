/**
 * Inertness guard (CI tripwire).
 *
 * Focus Now is render-only, unmounted, and behind no feature flag. This test
 * fails if ANY file outside `coaching-panel/focus-now/` imports the module —
 * proving it is not wired into the app. When the deliberate mount PR lands, that
 * PR must update/remove this guard, which keeps the "inert until mounted"
 * invariant honest rather than implicit.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const SRC = resolve(process.cwd(), 'src')
const MODULE_DIR = join(SRC, 'canvas', 'components', 'coaching-panel', 'focus-now')
const NEEDLE = 'coaching-panel/focus-now'

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist') continue
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full, acc)
    else if (/\.(ts|tsx)$/.test(name)) acc.push(full)
  }
  return acc
}

describe('Focus Now inertness', () => {
  it('is not imported by any file outside its own module', () => {
    const offenders = walk(SRC)
      .filter((f) => !f.startsWith(MODULE_DIR))
      .filter((f) => readFileSync(f, 'utf8').includes(NEEDLE))
      .map((f) => f.slice(SRC.length - 3)) // show as src/...

    expect(
      offenders,
      `Focus Now is render-only/unmounted; nothing outside its module may import it yet. Offenders: ${offenders.join(', ')}`,
    ).toEqual([])
  })
})
