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
 * the .css files, `index.html` and runtime setProperty() calls; references
 * from the TypeScript AST over `src/**` plus `tailwind.config.js` (the
 * mapping layer that produced the original defect). There is no
 * hand-maintained list of tokens here, because a list a human must
 * remember to sync is this repo's dominant defect class (trap 12). The two
 * pins below are the exceptions, and both fail loud in BOTH directions.
 *
 * The census carries its own positive control (`selfTest`): a fixture tree
 * containing one of each defect it claims to catch, spanning both script
 * extensions (.ts AND .tsx), the config-script path and the markup path.
 * An empty scan would satisfy every absence assertion below while testing
 * nothing (trap 13), so the self-test is asserted FIRST.
 */
import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import path from 'node:path'

const SCRIPT = path.resolve(__dirname, '../../scripts/css-var-census.mjs')

interface Census {
  errors: string[]
  counts: {
    cssFiles: number
    scriptFiles: number
    markupFiles: number
    definitions: number
    references: number
    dynamicSites: number
    resolvedDynamicNames: number
    fallbackUses: number
    proseMentions: number
  }
  undefinedRefs: { name: string; sites: string[] }[]
  unresolvable: { at: string; pattern: string; reason: string }[]
  cssUndefined: { name: string; sites: string[] }[]
  fallbackDrift: { name: string; fallback: string; declared: string[]; sites: string[] }[]
  fallbackUncomparable: { name: string; fallback: string; reason: string; sites: string[] }[]
  resolvedDynamicNameList: string[]
  dynamicSiteFiles: string[]
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
 * referenced by three CSS modules but defined nowhere: brand.css defines
 * only the `-500` aliases (`--sky-500`) and `--ink-900` / `--sand-200`.
 *
 * THESE 22 WERE NEVER A DELETED PALETTE. A scan of every locally-available
 * commit shows 21 of the 22 were never defined at ANY commit — they were
 * wrong when they were typed. Only `--sky-600` ever existed, and it was
 * removed on 2026-02-03 in 95cc45e8.
 *
 * REACHABILITY — the mechanism is real (all 39 sites are bare `var(--x)`
 * with no fallback, so each declaration is dropped outright), but the
 * present user-visible impact of all 22 is ZERO:
 *
 *   · CoachingNudge.module.css — 24 of the 39 sites, and 10 of the 22
 *     tokens exclusively — is NOT IN THE PRODUCTION BUNDLE AT ALL. Its
 *     only importer, useCEECoaching.ts:9, is a TYPE-ONLY import
 *     (`import type { NudgeData }`), erased at compile; there is no
 *     `<CoachingNudge` JSX anywhere. ReactFlowGraph.tsx:77 records the
 *     removal in a comment. Verified against a production build: the
 *     stylesheet's hashed classes appear in no dist chunk (positive
 *     control: a sibling module's `_closeButton_12qh7_39` IS present).
 *   · AIClarifierChat.module.css — 13 sites — is lazy-IMPORTED
 *     (ReactFlowGraph.tsx:75) but NEVER RENDERED. The gate at :2119 is
 *     `showAIClarifier`, whose initial state is false (store.ts:1446); no
 *     call site anywhere sets it true (every setter passes `false`), and
 *     it is absent from UIPreferences so it cannot rehydrate true.
 *   · RightPanel.module.css — 2 sites — sits behind the same gates.
 *     `showProvenanceHub` likewise has no true-setter. It USED to be
 *     reachable anyway, because unlike showAIClarifier it was persisted AND
 *     rehydrated (saveUIPreference → loadUIPreferences at store.ts:1376), so
 *     a returning user carrying a stale `ui.showProvenanceHub=true` from a
 *     pre-c80f0fe8 build still got the panel. Closed 2026-07-19:
 *     loadUIPreferences no longer reads that key, so BOTH panels are now
 *     unreachable by the same argument. The degradation if either were ever
 *     revived: `.closeButton` colour falls back to inherited and the hover
 *     background is missing.
 *
 * So: two dead stylesheets and two unreachable panels. Quarantined rather
 * than fixed because repairing them means choosing 22 replacement colours,
 * which is a design ruling and overlaps the open DS token work in #369 —
 * and choosing colours for surfaces nobody can see is the wrong order.
 *
 * THE PIN EXISTS FOR TWO REASONS, neither of which is "these are fine":
 *   1. To stop the set GROWING — a new dangling property on a LIVE surface
 *      fails this test immediately.
 *   2. To force a decision when these surfaces are revived or deleted.
 *      Reviving one makes its dangling tokens user-visible; deleting the
 *      stylesheets makes the entries here fail as "no longer dangling".
 *      Either way the pin fails and somebody must choose.
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

/**
 * FALLBACK DRIFT. `var(--success, #67C89E)` carries a hand-copied duplicate
 * of the token's value. Nothing keeps the copy in step with brand.css, so
 * the first retint leaves a stale colour behind — and it surfaces only in
 * the one situation the fallback exists for, which is why it can rot for
 * years unseen. This is the repo's dominant defect class (trap 12) wearing
 * a different hat.
 *
 * The census derives BOTH sides — it parses each fallback (balanced-paren
 * aware, so nested `var(--a, var(--b))` is seen) and compares it against
 * the token's declared value, following one level of `var()` indirection
 * (`--text-primary: var(--text-header)`). Fallbacks that cannot be compared
 * — the token is defined only at runtime via setProperty, or the fallback
 * is itself a token chain — are reported as UNCOMPARABLE, never skipped.
 *
 * Every entry below is a fallback that ALREADY disagrees with brand.css.
 * They are pinned, not fixed, for the same reason as the palette above:
 * each one is a colour/measure decision. An EXACT pin, so a new drifted
 * fallback fails and a repaired one fails too.
 *
 * NOTE the six fallbacks this PR introduced — `--success, #67C89E`,
 * `--danger, #EA7B4B`, `--option, #AAA7E4`, `--text-light, #908D8D`,
 * `--text-body, #3F3F3E`, `--border-default, #EEE6D8` — are
 * deliberately ABSENT from this list: they match brand.css exactly, and
 * this guard is what will notice the day they stop matching.
 *
 * `--border-emphasis, #DDD4C4` was the sixth until the ghost-option outline
 * moved to `--text-body` on WCAG 1.4.11 grounds; the retarget to
 * `--border-emphasis` fixed the dangling reference but moved contrast by
 * nothing (1.46:1 → 1.46:1 against the panel fill), so it was rejected.
 * `--border-emphasis` is still defined and still referenced bare at
 * TornadoChart.tsx:563, so it does not dangle — it simply no longer has a
 * hardcoded fallback anywhere for this guard to compare.
 */
const KNOWN_FALLBACK_DRIFT = [
  '--bg-panel|#FEF9F3',
  '--bg-panel|#FFFDF7',
  '--bg-panel-hover|#F5EEE0',
  '--bg-panel-hover|rgba(0,0,0,0.02)',
  '--border-default|#d4d4d8',
  '--border-default|#E4E2E0',
  '--border-default|#E8E5E1',
  '--bottombar-h|0',
  '--bottombar-h|0px',
  '--danger|#ef4444',
  '--dock-right-expanded|24rem',
  '--factor|#6b7280',
  '--factor-light|rgba(176,168,153,0.3)',
  '--goal|#f59e0b',
  '--info|#2B7FA2',
  '--info|#3b82f6',
  '--info-hover|#2B7FA2',
  '--leftsidebar-w|52px',
  '--option|#7BAD55',
  '--option|#8b5cf6',
  '--primary|#2B7FA2',
  '--semantic-danger|#ef4444',
  '--semantic-info|#2B7FA2',
  '--semantic-info|#3b82f6',
  '--semantic-success|#22c55e',
  '--semantic-warning|#eab308',
  '--shadow-2|0 4px 12px rgba(0,0,0,0.08)',
  '--sky-500|#2B7FA2',
  '--success|#10b981',
  '--success-light|rgba(103,200,158,0.3)',
  '--surface-card|#FEF9F3',
  '--text-body|#262626',
  '--text-body|#2A2A2A',
  '--text-body|#404040',
  '--text-body|#4A4642',
  '--text-muted|#9ca3af',
  '--text-secondary|#6B6B6A',
  '--topbar-h|56px',
  '--warning-light|rgba(255,166,86,0.3)',
].sort()

/**
 * The dynamic `var(--${…})` sites in the tree, pinned by FILE and by
 * the concrete property names they expand to.
 *
 * A `>= 2` floor here was near-worthless: a real blinding mutation dropped
 * the resolved-name count 6 → 3 while `dynamicSites` stayed at 2, and the
 * assertion still passed. Pinning the expansion is what bites — and note
 * `evaluative.ts` is a `.ts` file, so this pin also fails outright if the
 * file walk ever stops covering `.ts` (the exact hole a partial blinding
 * exploited).
 *
 * Was TWO files until 2026-07-19: `src/components/shared/StabilityGauge.tsx`
 * left `src/` for `archive/dead-ui-components-2026-07/` (zero consumers). The
 * pin is NARROWED to match the tree, not weakened — it stays exact and
 * bidirectional, so re-adding a dynamic site anywhere still fails here.
 * `EXPECTED_DYNAMIC_NAMES` is unchanged: `evaluative.ts` expands to the same
 * success|warning|danger union StabilityGauge did, so no name was lost —
 * verified by this suite, which failed on the FILE list alone.
 */
const EXPECTED_DYNAMIC_SITE_FILES = ['src/styles/evaluative.ts'].sort()
const EXPECTED_DYNAMIC_NAMES = ['--danger', '--success', '--warning'].sort()

describe('css custom-property resolution guard', () => {
  const census = runCensus()

  it('the census can SEE the code it is asserting about (positive control)', () => {
    // Self-test first: proves the scanner detects an undefined reference in
    // a .ts file, in a .tsx file, in the config script, in CSS and in
    // markup; a reference nested inside a fallback; an unresolvable dynamic
    // name; a malformed property name; and a drifted fallback — while NOT
    // flagging comment placeholders, prose inside string literals,
    // setProperty definitions, matching fallbacks, one-level indirection,
    // or resolvable literal unions. Without this the assertions below are
    // vacuous.
    expect(census.selfTest.failures).toEqual([])
    expect(census.selfTest.ok).toBe(true)

    expect(census.errors).toEqual([])

    // Floors are self-describing: each carries the figure observed when it
    // was set, so a drop is obvious rather than merely "still above a
    // number". They sit ~10% under reality, NOT one count under it — the
    // previous `references > 50` floor had a margin of exactly ONE against
    // a partial blinding that yielded 50.
    const c = census.counts
    expect(c.cssFiles, `css files: ${c.cssFiles} (was 18 when this floor was set)`).toBeGreaterThanOrEqual(15)
    expect(c.scriptFiles, `script files: ${c.scriptFiles} (was 2590)`).toBeGreaterThanOrEqual(2300)
    expect(c.markupFiles, `markup files: ${c.markupFiles} (index.html)`).toBe(1)
    expect(c.definitions, `definitions: ${c.definitions} (was 152)`).toBeGreaterThanOrEqual(135)
    expect(c.references, `referenced properties: ${c.references} (was 90)`).toBeGreaterThanOrEqual(80)
    expect(c.fallbackUses, `fallbacks compared: ${c.fallbackUses} (was 530)`).toBeGreaterThanOrEqual(450)
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

  it('no dynamic var(--${…}) reference is unresolvable, and no property name is malformed', () => {
    // A scanner that skips what it cannot parse is how this defect class
    // survived. Interpolated names must resolve to a string-literal union
    // so every possible property name is checked; a name region that was
    // reaching for a custom property and got it wrong is reported here too.
    const detail = census.unresolvable.map((u) => `  ${u.at} var(${u.pattern}) — ${u.reason}`).join('\n')
    expect(census.unresolvable, `unresolvable / malformed var() reference(s):\n${detail}`).toEqual([])
  })

  it('resolves the dynamic references it does find (not by finding none)', () => {
    // Guards the guard. An exact pin, because the previous
    // `resolvedDynamicNames >= dynamicSites` floor survived a mutation that
    // halved the resolved names.
    expect(
      census.dynamicSiteFiles,
      'the set of files carrying a dynamic var(--${…}) changed — add or remove the file here, ' +
        'and check the census still resolves it rather than having gone blind to it.',
    ).toEqual(EXPECTED_DYNAMIC_SITE_FILES)
    expect(
      census.resolvedDynamicNameList,
      'the property names the dynamic references expand to changed — if this SHRANK, ' +
        'the type checker stopped seeing a union member and the guard has gone partially blind.',
    ).toEqual(EXPECTED_DYNAMIC_NAMES)
    // Each site × the three-member evaluative union. DERIVED from the pins
    // above, not re-typed: these were hardcoded `2` and `6`, a hand-maintained
    // mirror of the same two constants, and it drifted the moment
    // StabilityGauge.tsx was archived (2026-07-19) — two literals to update
    // for one real change is how a pin rots. Still an exact pin, and still
    // bidirectional: adding a dynamic site without listing it above fails on
    // the file-set assertion, and losing a union member fails here.
    expect(census.counts.dynamicSites).toBe(EXPECTED_DYNAMIC_SITE_FILES.length)
    expect(census.counts.resolvedDynamicNames).toBe(
      EXPECTED_DYNAMIC_SITE_FILES.length * EXPECTED_DYNAMIC_NAMES.length,
    )
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

  it('hardcoded var() fallbacks stay pinned to the known drift set', () => {
    const found = census.fallbackDrift.map((d) => `${d.name}|${d.fallback}`).sort()
    const added = census.fallbackDrift.filter((d) => !KNOWN_FALLBACK_DRIFT.includes(`${d.name}|${d.fallback}`))
    const fixed = KNOWN_FALLBACK_DRIFT.filter((k) => !found.includes(k))
    expect(
      found,
      added.length
        ? `NEW fallback drift — a hardcoded fallback disagrees with the token it shadows:\n` +
            added
              .map((d) => `  var(${d.name}, ${d.fallback}) but ${d.name} is ${d.declared.join(' | ')}\n` +
                d.sites.map((s) => `      ${s}`).join('\n'))
              .join('\n') +
            '\nMatch the fallback to brand.css, or drop the fallback and let the token speak.'
        : `${fixed.join(', ')} no longer drift — remove them from ` +
            'KNOWN_FALLBACK_DRIFT so the pin keeps matching reality.',
    ).toEqual(KNOWN_FALLBACK_DRIFT)
  })

  it('reports fallbacks it cannot compare rather than skipping them', () => {
    // Trap 12 again: the failure mode to avoid is a comparison that
    // quietly does nothing. Anything uncomparable must surface WITH a
    // reason, so the gap in coverage is legible rather than assumed-good.
    for (const u of census.fallbackUncomparable) {
      expect(u.reason, `var(${u.name}, ${u.fallback}) reported uncomparable with no reason`).toBeTruthy()
    }
  })
})
