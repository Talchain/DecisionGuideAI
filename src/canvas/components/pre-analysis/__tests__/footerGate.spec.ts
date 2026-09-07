/**
 * The legacy pre-analysis footer must refuse what the banner already refuses.
 *
 * ⚠⚠ SCOPE FIRST, BECAUSE THE EARLIER VERSION OF THIS HEADER OVERSTATED IT.
 * These tests pin `applyAnalysisHold` and its call site in `PreAnalysisPanel`,
 * which is the FLAG-OFF reinstatement branch: `OutputsDock.tsx:3132` mounts
 * `PreAnalysisPanelV3` instead whenever `isPreAnalysisV3Enabled()`, and
 * `netlify.toml:179` bakes `VITE_FEATURE_PRE_ANALYSIS_V3 = "1"`. So a green run
 * here is evidence about the reinstatement branch and about NOTHING a fresh
 * staging user renders. The V3 surface already refuses the hold through the run
 * gate (`OutputsDock.tsx:1279` → `canRunAnalysis.ts:826` → `PanelFooter.tsx:69`).
 * An earlier revision of this file cited a witnessed deployed no-op as the
 * defect under test; that attribution is WITHDRAWN and is not re-made here.
 *
 * What the tests bind to are the two properties that make the button actually
 * refuse, because either alone leaves the gap standing:
 *   1. `hasBlockers` is raised, AND
 *   2. `blockerCount > 0` — `StickyFooter` disables on the CONJUNCTION, so a
 *      raised flag with a zero count changes nothing on screen.
 */
import { describe, it, expect } from 'vitest'
import { applyAnalysisHold, type FooterGate } from '../footerGate'
import { ANALYSIS_HELD_NOTICE } from '../../../utils/analysisHeldOnInjectedModel'

const READY: FooterGate = { isReady: true, hasBlockers: false, blockerCount: 0, blockedReason: undefined }
const HELD = ANALYSIS_HELD_NOTICE.starter

/**
 * ⚠ A RESTATEMENT, NOT THE AUTHORITY. `StickyFooter.tsx:57`'s `isHardBlocked`
 * owns this rule and `StickyFooter.spec.tsx` is the spec that pins it — a
 * reviewer measured that dropping the `(hasBlockers && _blockerCount > 0)`
 * conjunct from the component leaves THIS file 6/6 green while
 * `StickyFooter.spec.tsx` reds. So treat a green here as a statement about
 * `applyAnalysisHold`'s output, never as proof the component still disables.
 * It is kept because it makes the assertions read as the thing the USER
 * experiences rather than as field names.
 */
const footerWouldDisable = (g: FooterGate) => g.hasBlockers && g.blockerCount > 0

describe('applyAnalysisHold', () => {
  it('DISABLES the footer when the model is held — both conjuncts, not just the flag', () => {
    const g = applyAnalysisHold(READY, HELD)
    expect(g.hasBlockers, 'blocker flag not raised').toBe(true)
    expect(g.blockerCount, 'count left at 0 — StickyFooter would still enable').toBeGreaterThan(0)
    expect(footerWouldDisable(g), 'the button would still be clickable').toBe(true)
    expect(g.isReady).toBe(false)
  })

  it('shows the hold sentence, and the SAME one the banner shows', () => {
    // ⭐ PINNED BY IMPORT, not by a second copy of the sentence. `HELD` IS the
    // shipped constant `StarterProvenanceBanner` and the run gate both render,
    // so the "SAME one" in this test's name is structural and cannot drift.
    // Deliberately NOT re-asserted against a literal here: this sentence has
    // exactly one author by design, enforced by the `src/**` sweep in
    // `analyseAffordanceTruthfulness.spec.ts`, and a hardcoded copy would be
    // the hand-maintained mirror that guard exists to prevent (trap 12).
    // The earlier revision quoted a RETIRED em-dash form of it in its header
    // while using the compliant one here; the import removes that second copy.
    expect(applyAnalysisHold(READY, HELD).blockedReason).toBe(HELD)
  })

  it('lets the hold outrank a calibration reason — it is unconditional and has a reachable remedy', () => {
    const calibrating: FooterGate = { isReady: false, hasBlockers: true, blockerCount: 3, blockedReason: 'Confirm 3 assumptions' }
    expect(applyAnalysisHold(calibrating, HELD).blockedReason).toBe(HELD)
    // ...and never LOWERS an existing count, or a held-but-also-blocked model
    // would report fewer issues than it has.
    expect(applyAnalysisHold(calibrating, HELD).blockerCount).toBe(3)
  })

  it('is the IDENTITY on a drafted model — the blast radius is the held case only', () => {
    // The safety argument, asserted rather than claimed: not held ⟹ nothing moves.
    expect(applyAnalysisHold(READY, null)).toEqual(READY)
    const blocked: FooterGate = { isReady: false, hasBlockers: true, blockerCount: 2, blockedReason: 'Add an option' }
    expect(applyAnalysisHold(blocked, null)).toEqual(blocked)
    // ⚠ PRECONDITION PINNED: if the fixture above could not disable anyway,
    // the identity claim would be vacuous for the interesting case.
    expect(footerWouldDisable(blocked)).toBe(true)
  })

  it('does not treat the EMPTY STRING as "not held"', () => {
    // A falsy-check (`if (!heldNotice)`) instead of `=== null` would reopen the
    // gap for any provenance whose sentence is ever empty. The contract is
    // `string | null`, so only `null` means not held.
    const g = applyAnalysisHold(READY, '')
    expect(footerWouldDisable(g), 'empty string read as not-held').toBe(true)
  })
})

/**
 * ⭐ THE WIRING GUARD — because "we build more than we plug in" is this
 * estate's chronic failure #1, and a pure helper with a perfect test suite and
 * no call site is exactly that failure wearing a green tick.
 *
 * ⚠ It proves the helper is CALLED, not that the surface calling it is mounted.
 * On the current staging flag posture it is not — see the scope note above.
 */
describe('the panel actually uses it', () => {
  it('passes the hold authority into the gate at the render site', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    // ⚠ NOT `import.meta.url` — under vitest's transform it is not a `file:`
    // URL and `readFileSync` throws ERR_INVALID_URL_SCHEME. Measured, not
    // assumed: the first version of this guard failed exactly that way.
    const file = path.resolve(process.cwd(), 'src/canvas/components/pre-analysis/PreAnalysisPanel.tsx')
    expect(fs.existsSync(file), `guard pointed at nothing: ${file}`).toBe(true)
    const src = fs.readFileSync(file, 'utf8')
    // CONTRAST CONTROL: prove the file was read before believing any absence.
    expect(src.length, 'PreAnalysisPanel.tsx read as empty').toBeGreaterThan(1000)
    expect(src).toContain('applyAnalysisHold(')
    expect(src).toContain('analysisHeldNotice(nodes)')
    expect(src).toContain("from './footerGate'")
  })
})
