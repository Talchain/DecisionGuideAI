/**
 * `var(--…)` resolution guard.
 *
 * THE DEFECT CLASS: a `var(--foo)` in TS/TSX naming a custom property that
 * is defined NOWHERE. CSS resolves it to the hardcoded fallback hex — so
 * the surface renders, looks plausible, and is permanently deaf to the
 * design system. `var(--panel-border, #EEE6D8)` looked like a token
 * reference for as long as it existed; Tailwind maps `panel.border` to
 * `--border-default`, so the property `--panel-border` never existed and
 * every lookup fell through. Worse, a reference with NO fallback
 * (`var(--success-600)`) resolves to nothing at all and the declaration is
 * dropped — the KPI comparison text simply inherited its colour.
 *
 * Nothing catches this: it is not a type error, not a lint error, and the
 * rendered result is a plausible colour. Only a census of both sides of
 * the contract can see it.
 *
 * Both sides are DERIVED by scripts/css-var-census.mjs — definitions from
 * the .css files plus runtime setProperty() calls, references from the
 * TypeScript AST. There is no hand-maintained list of tokens here, because
 * a list a human must remember to sync is this repo's dominant defect
 * class (trap 12).
 *
 * The census carries its own positive control (`selfTest`): a fixture tree
 * containing one of each defect it claims to catch. An empty scan would
 * satisfy every absence assertion below while testing nothing (trap 13),
 * so the self-test is asserted FIRST.
 */
import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import path from 'node:path'

const SCRIPT = path.resolve(__dirname, '../../scripts/css-var-census.mjs')

interface Census {
  errors: string[]
  counts: {
    cssFiles: number
    tsFiles: number
    definitions: number
    references: number
    dynamicSites: number
    resolvedDynamicNames: number
  }
  undefinedRefs: { name: string; sites: string[] }[]
  unresolvable: { at: string; pattern: string; reason: string }[]
  cssUndefined: { name: string; sites: string[] }[]
  selfTest: { ok: boolean; failures: string[] }
}

function runCensus(): Census {
  // The census exits 1 when it finds defects; that is a finding, not a
  // crash, so a non-zero status must not abort the spec run.
  try {
    const out = execFileSync('node', [SCRIPT, '--json'], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
    return JSON.parse(out) as Census
  } catch (err) {
    const e = err as { stdout?: string }
    if (e.stdout) return JSON.parse(e.stdout) as Census
    throw err
  }
}

/**
 * Legacy numeric-shade palette (`--sky-600`, `--ink-700`, `--sand-100`, …)
 * referenced by three CSS modules but never defined: brand.css defines only
 * the `-500` aliases (`--sky-500`) and `--ink-900` / `--sand-200`. These are
 * LIVE surfaces (AIClarifierChat is lazy-rendered by ReactFlowGraph), so
 * every one of these declarations is currently dropped by the browser.
 *
 * Quarantined rather than fixed here: repairing them means choosing 22
 * replacement colours on live UI, which is a design ruling and overlaps the
 * open DS token work in #369. This is an EXACT pin, not an allowlist — it
 * fails on a new dangling property AND on a repaired one, so the set cannot
 * drift silently in either direction.
 */
const KNOWN_UNDEFINED_CSS_PALETTE = [
  '--carrot-50',
  '--carrot-100',
  '--carrot-200',
  '--carrot-300',
  '--carrot-600',
  '--carrot-700',
  '--ink-400',
  '--ink-500',
  '--ink-600',
  '--ink-700',
  '--ink-800',
  '--sand-50',
  '--sand-100',
  '--sand-300',
  '--sky-100',
  '--sky-300',
  '--sky-600',
  '--sky-700',
  '--sun-100',
  '--sun-300',
  '--sun-700',
  '--sun-800',
].sort()

describe('css custom-property resolution guard', () => {
  const census = runCensus()

  it('the census can SEE the code it is asserting about (positive control)', () => {
    // Self-test first: proves the scanner detects an undefined TS reference,
    // an undefined CSS reference and an unresolvable dynamic name, while NOT
    // flagging comment placeholders, setProperty definitions, or resolvable
    // literal unions. Without this the assertions below are vacuous.
    expect(census.selfTest.failures).toEqual([])
    expect(census.selfTest.ok).toBe(true)

    expect(census.errors).toEqual([])
    expect(census.counts.cssFiles).toBeGreaterThan(10)
    expect(census.counts.tsFiles).toBeGreaterThan(1000)
    expect(census.counts.definitions).toBeGreaterThan(100)
    expect(census.counts.references).toBeGreaterThan(50)
  })

  it('every var(--…) in TS/TSX names a property that is actually defined', () => {
    const detail = census.undefinedRefs
      .map((u) => `  ${u.name}\n${u.sites.map((s) => `      ${s}`).join('\n')}`)
      .join('\n')
    expect(
      census.undefinedRefs.map((u) => u.name),
      `these var() references resolve to nothing and silently use their hardcoded ` +
        `fallback (or no colour at all) — map each to a real token in src/styles/brand.css ` +
        `or src/index.css:\n${detail}`,
    ).toEqual([])
  })

  it('no dynamic var(--${…}) reference is unresolvable', () => {
    // A scanner that skips what it cannot parse is how this defect class
    // survived. Interpolated names must resolve to a string-literal union
    // so every possible property name is checked.
    const detail = census.unresolvable.map((u) => `  ${u.at} var(${u.pattern}) — ${u.reason}`).join('\n')
    expect(census.unresolvable, `unresolvable dynamic var() reference(s):\n${detail}`).toEqual([])
  })

  it('resolves the dynamic references it does find (not by finding none)', () => {
    // Guards the guard: if the template-literal walk regressed to zero
    // dynamic sites, the assertion above would pass by seeing nothing.
    expect(census.counts.dynamicSites).toBeGreaterThanOrEqual(2)
    expect(census.counts.resolvedDynamicNames).toBeGreaterThanOrEqual(census.counts.dynamicSites)
  })

  it('CSS-side dangling properties stay pinned to the known legacy palette', () => {
    const found = census.cssUndefined.map((u) => u.name).sort()
    const added = found.filter((n) => !KNOWN_UNDEFINED_CSS_PALETTE.includes(n))
    const fixed = KNOWN_UNDEFINED_CSS_PALETTE.filter((n) => !found.includes(n))
    expect(
      found,
      added.length
        ? `NEW dangling CSS custom propert${added.length === 1 ? 'y' : 'ies'}: ${added.join(', ')} — ` +
            'define the property or reference a real token.'
        : `${fixed.join(', ')} no longer dangle — remove them from ` +
            'KNOWN_UNDEFINED_CSS_PALETTE so the pin keeps matching reality.',
    ).toEqual(KNOWN_UNDEFINED_CSS_PALETTE)
  })
})
