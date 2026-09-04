/**
 * `scripts/lib/type-scale.d.mts` must not drift from `type-scale.mjs`.
 *
 * ⚠ WHY THIS EXISTS. The runtime is plain `.mjs` so BOTH the `.mjs` census
 * script (plain node) and a vitest `.ts` spec can import it; the types live in a
 * hand-written sidecar. That sidecar is a HAND-MAINTAINED MIRROR of the module's
 * exports — the dominant defect class in this estate — and it sits outside both
 * gates that would otherwise catch drift: `eslint.config.js` ignores `scripts/**`,
 * and the typecheck gate does not load the `.mjs`. So a renamed or removed export
 * would leave the sidecar lying, and a consumer would typecheck green against a
 * function that no longer exists.
 *
 * A reviewer flagged the gap. This is the derivation that closes it: the
 * declaration's export names are compared against the RUNTIME's, so the mirror
 * fails loud instead of assuming good.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as runtime from '../../scripts/lib/type-scale.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const DTS = path.join(ROOT, 'scripts', 'lib', 'type-scale.d.mts')

describe('type-scale.d.mts mirrors type-scale.mjs', () => {
  const dts = readFileSync(DTS, 'utf8')
  const declared = new Set(
    [...dts.matchAll(/^export declare (?:const|function)\s+([A-Za-z_$][\w$]*)/gm)].map(m => m[1]),
  )
  const runtimeExports = Object.keys(runtime).sort()

  it('the probe can SEE declarations (positive control)', () => {
    expect(declared.size, 'no declarations parsed — the regex is blind, not the file empty').toBeGreaterThan(0)
    expect(runtimeExports.length, 'the runtime module exported nothing').toBeGreaterThan(0)
  })

  it('every RUNTIME export is declared — a missing one types as `any` or errors', () => {
    expect(runtimeExports.filter(n => !declared.has(n))).toEqual([])
  })

  it('every DECLARED export exists at runtime — a stale one is a lie that typechecks', () => {
    expect([...declared].filter(n => !runtimeExports.includes(n)).sort()).toEqual([])
  })
})
