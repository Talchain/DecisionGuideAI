/**
 * ⭐⭐ ONE DERIVATION, DECLARED ONCE — and the guard that was supposed to hold it
 * was a third copy of the thing it guarded.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE DEFECT, MEASURED AT TIP 3b0c9463
 * ═══════════════════════════════════════════════════════════════════════════
 * `GOAL_LABEL_EDIT_CONNECTED` was declared THREE times:
 *
 *   1. `hero/HeroSection.tsx:87`                    — the owner, and NOT exported
 *   2. `PreAnalysisPanelV3.tsx:~37`                 — the panel's own copy
 *   3. `goalLabelProvenance.honesty.spec.tsx:76`    — THE GUARD'S OWN COPY
 *
 * `SUCCESS_TARGET_EDIT_CONNECTED` was declared twice, (1) and (2).
 *
 * ⛔ WHY THE COMMENT ON COPY 2 WAS FALSE. It read: *"These constants must stay in
 * step with the hero's … the specs assert focus, so a divergence REDs."* No spec
 * compares the two copies. The only spec that names the derivation DECLARES ITS
 * OWN (copy 3) and branches on it, so it agrees with itself and would stay green
 * while copies 1 and 2 diverged — it reads neither of them. That is a guard
 * agreeing with itself (trap 13b), and it is worse than an unguarded mirror
 * because the comment stops the next reader looking.
 *
 * ⚠ AND COPY 3 WAS HALF-DERIVED, WHICH IS THE SUBTLE PART. Its docblock says it
 * reads *"from the REAL module rather than restated as a literal"* — and it does
 * read `CANONICAL_EDIT_AUTHORITY` from the real module. But it RESTATES THE
 * CONJUNCTION. So it tracks the INPUTS and not the FORMULA: add a third conjunct
 * to the hero's derivation and copy 3 silently keeps testing the old rule while
 * looking derived. Trap 12d — deriving a guard from a list moves the risk, it
 * does not remove it.
 *
 * ⚠ WHY A SOURCE-TEXT ASSERTION AND NOT A VALUE COMPARISON. Once the duplicates
 * import the owner, any test comparing them is comparing a binding to itself and
 * proves nothing — it would pass forever, including on the day someone pastes a
 * fourth copy back in. The thing that must not recur is a SECOND DECLARATION, so
 * that is what this counts. Reading source in a spec is precedented here
 * (`pre-analysis-v3/__tests__/flagGate.spec.ts` matches against `flagsSource`).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'

const SRC = resolve(__dirname, '../../../..')

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) sourceFiles(full, out)
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full)
  }
  return out
}

/** Every .ts/.tsx under src/, read once. */
const FILES = sourceFiles(SRC).map(path => ({ path, text: readFileSync(path, 'utf8') }))

const declarationsOf = (name: string) =>
  FILES.filter(f => new RegExp(`(?:^|\\n)\\s*(?:export\\s+)?const\\s+${name}\\s*=`).test(f.text))
    .map(f => f.path.slice(SRC.length + 1))

describe('the edit-authority derivations are declared exactly once', () => {
  it('POSITIVE CONTROL: the sweep can see source and finds the owning module', () => {
    // Without this, "declared once" is indistinguishable from a sweep that read
    // nothing — the failure mode that makes an absence assertion vacuous.
    expect(FILES.length).toBeGreaterThan(500)
    expect(declarationsOf('GOAL_LABEL_EDIT_CONNECTED')).toContain(
      'canvas/components/pre-analysis-v3/hero/HeroSection.tsx',
    )
  })

  it('NEGATIVE CONTROL: a name that does not exist is found nowhere', () => {
    expect(declarationsOf('ZZZ_NOT_A_REAL_DERIVATION')).toEqual([])
  })

  it('GOAL_LABEL_EDIT_CONNECTED is declared in exactly one file', () => {
    // ⛔ RED before the fix: three files — the hero, the panel, and the spec that
    // was meant to guard it.
    expect(declarationsOf('GOAL_LABEL_EDIT_CONNECTED')).toHaveLength(1)
  })

  it('SUCCESS_TARGET_EDIT_CONNECTED is declared in exactly one file', () => {
    expect(declarationsOf('SUCCESS_TARGET_EDIT_CONNECTED')).toHaveLength(1)
  })

  it('and the one declaration is EXPORTED, so a consumer has something to import', () => {
    // The original hero declared both unexported, which is why the panel could not
    // simply import them and copied the derivation instead. Un-exporting them
    // would recreate the pressure that produced the mirror.
    const hero = FILES.find(f => f.path.endsWith('pre-analysis-v3/hero/HeroSection.tsx'))!
    expect(hero.text).toMatch(/export const GOAL_LABEL_EDIT_CONNECTED\s*=/)
    expect(hero.text).toMatch(/export const SUCCESS_TARGET_EDIT_CONNECTED\s*=/)
  })
})
