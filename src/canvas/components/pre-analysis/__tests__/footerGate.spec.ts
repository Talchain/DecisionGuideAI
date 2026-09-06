/**
 * The footer must refuse what the banner already refuses.
 *
 * ⚠ WITNESSED, NOT IMAGINED. On deployed `a2fd0656`, a saved example showed
 * BOTH `Run analysis` buttons enabled and silently no-op — 12 polls over 30 s,
 * `aria-busy` 0 throughout, `POST /bff/cee/graph-readiness → 200` and no
 * analysis turn — while `StarterProvenanceBanner` on the SAME surface said
 * *"Analysis is held on a saved example — re-draft it live to run one"*.
 *
 * These tests bind to the two properties that make the button actually refuse,
 * because either alone leaves the defect standing:
 *   1. `hasBlockers` is raised, AND
 *   2. `blockerCount > 0` — `StickyFooter` disables on the CONJUNCTION, so a
 *      raised flag with a zero count changes nothing on screen.
 */
import { describe, it, expect } from 'vitest'
import { applyAnalysisHold, type FooterGate } from '../footerGate'

const READY: FooterGate = { isReady: true, hasBlockers: false, blockerCount: 0, blockedReason: undefined }
const HELD = 'Analysis is held on a saved example. Re-draft it live to run one.'

/** `StickyFooter`'s own disable rule, restated once so the tests assert the
 *  thing the USER experiences rather than the field names. Mirrors
 *  `StickyFooter.tsx`'s `isHardBlocked` for the not-analysing/not-loading case. */
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
    // defect for any provenance whose sentence is ever empty. The contract is
    // `string | null`, so only `null` means not held.
    const g = applyAnalysisHold(READY, '')
    expect(footerWouldDisable(g), 'empty string read as not-held').toBe(true)
  })
})

/**
 * ⭐ THE WIRING GUARD — because "we build more than we plug in" is this
 * estate's chronic failure #1, and a pure helper with a perfect test suite and
 * no call site is exactly that failure wearing a green tick.
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
