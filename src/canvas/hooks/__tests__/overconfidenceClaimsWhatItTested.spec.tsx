/**
 * OVERCONFIDENCE MUST CLAIM ONLY WHAT IT TESTED.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE DEFECT, MEASURED AT THE BYTES (18 Sep 2026)
 * ═══════════════════════════════════════════════════════════════════════════
 * `useModelReadiness` raises an overconfidence trigger from
 *
 *     const hasInferredFactor = factorNodes.some(n => os?.extractionType === 'inferred')
 *
 * — a `.some()`, i.e. AT LEAST ONE factor — and then renders the sentence
 * **"Overconfidence: top factor unvalidated"**. The code's OWN comment says
 * *"any factor is inferred"*. So the product tells the reader the TOP factor is
 * unvalidated on the strength of a test that says SOME factor is. Where the most
 * influential factor was stated explicitly and a minor one was inferred, the
 * rendered sentence is simply false.
 *
 * It reaches a user: `DecisionNode.tsx:1197` maps `readiness.biasTriggers` to
 * visible rows on the anchor card, so this is shipped copy, not a latent string.
 *
 * ⛔ THE FIX IS THE WORDING, NOT THE PREDICATE, AND THAT IS DELIBERATE.
 * `inferredCount` looks like the obvious substitute and is a DIFFERENT
 * POPULATION: its loop puts a value-less factor in `missingCount` first and
 * skips `category === 'external'` entirely, so swapping it in would silently
 * change WHICH graphs raise the signal while claiming to fix a sentence. A
 * predicate change dressed as a copy change is how this estate ships surprises.
 * The predicate is therefore untouched, and §2 exists to prove it is untouched.
 *
 * ⚠ WHY A SIBLING SURFACE IS LEFT ALONE. `useScienceIcons` raises the same
 * signal id from a THIRD predicate (`sensitivityRank === 1 || === 2`), and its
 * copy already says *"No supporting evidence RECORDED for this assumption"* —
 * which names the act rather than asserting a universal absence, and is already
 * honest. Three surfaces sharing one signal NAME while answering different
 * questions is trap 21, and the remedy there is to name the questions apart, not
 * to align three predicates into one. Recorded, not "fixed".
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

vi.mock('../../store', () => ({ useCanvasStore: vi.fn() }))

import { useCanvasStore } from '../../store'
import { useModelReadiness } from '../useModelReadiness'
import { overconfidenceSentence } from '../../utils/observedStateHelpers'

const factor = (id: string, extractionType: string | undefined, value: number | null = 10) => ({
  id, type: 'factor', position: { x: 0, y: 0 },
  data: { type: 'factor', label: id, observedState: { value, extractionType } },
})
// Two options and two risks keep the OTHER bias triggers quiet, so any assertion
// below is about the overconfidence row and not about a neighbour's wording.
const QUIET = [
  { id: 'o1', type: 'option', position: { x: 0, y: 0 }, data: { type: 'option' } },
  { id: 'o2', type: 'option', position: { x: 0, y: 0 }, data: { type: 'option' } },
  { id: 'o3', type: 'option', position: { x: 0, y: 0 }, data: { type: 'option' } },
  { id: 'r1', type: 'risk', position: { x: 0, y: 0 }, data: { type: 'risk' } },
  { id: 'r2', type: 'risk', position: { x: 0, y: 0 }, data: { type: 'risk' } },
]

const withNodes = (nodes: unknown[]) => {
  const state = { nodes: [...QUIET, ...nodes], edges: [] }
  vi.mocked(useCanvasStore as unknown as (s: (x: unknown) => unknown) => unknown)
    .mockImplementation((selector: (s: unknown) => unknown) => selector(state as never))
  return renderHook(() => useModelReadiness()).result.current
}
const overconfidenceRow = (triggers: string[]) =>
  triggers.filter(t => /overconfidence/i.test(t))

beforeEach(() => { vi.clearAllMocks() })   // braces: the arrow must not return VitestUtils as a cleanup callback

describe('the overconfidence trigger claims only what its predicate tested', () => {
  // ── §1 THE DISCRIMINATING CASE ──────────────────────────────────────────
  // The most influential factor is EXPLICIT; a minor one is INFERRED. The
  // predicate fires (correctly — an unvalidated estimate is present). The
  // sentence must not therefore assert that the TOP factor is the unvalidated
  // one, because nothing here established that.
  it('does not claim the TOP factor when a non-top factor is the inferred one', () => {
    const r = withNodes([factor('Most influential', 'explicit'), factor('Minor', 'inferred')])
    const rows = overconfidenceRow(r.biasTriggers)
    expect(rows).toHaveLength(1)                 // still fires — not a suppression
    expect(rows[0]).not.toMatch(/top factor/i)   // ⛔ RED before the fix
  })

  it('says what was actually tested — that a factor is an unvalidated estimate', () => {
    const r = withNodes([factor('Most influential', 'explicit'), factor('Minor', 'inferred')])
    expect(overconfidenceRow(r.biasTriggers)[0]).toBe('Overconfidence: a factor is an unvalidated estimate')
  })

  // ── §2 THE PREDICATE IS UNTOUCHED ───────────────────────────────────────
  // Without this pair the fix could pass by firing always, or by firing never.
  it('POSITIVE CONTROL: fires when ANY factor is inferred, including the only one', () => {
    expect(overconfidenceRow(withNodes([factor('Only', 'inferred')]).biasTriggers)).toHaveLength(1)
  })

  it('CONTRAST CONTROL: does NOT fire when no factor is inferred', () => {
    const rows = overconfidenceRow(withNodes([factor('A', 'explicit'), factor('B', 'explicit')]).biasTriggers)
    expect(rows).toHaveLength(0)
  })

  it('CONTRAST CONTROL: a value-less factor is still NOT the inferred population', () => {
    // `inferredCount` would bucket this as `missing`; `hasInferredFactor` reads
    // `extractionType` alone and so DOES fire. Pinning the difference is what
    // stops a later tidy-up substituting one for the other.
    expect(overconfidenceRow(withNodes([factor('Valueless', 'inferred', null)]).biasTriggers)).toHaveLength(1)
    expect(withNodes([factor('Valueless', 'inferred', null)]).inferredCount).toBe(0)
  })
})

// ── §3 THE PANEL SENTENCE ────────────────────────────────────────────────────
// The sibling half of the same defect, at PreAnalysisPanel.tsx:1600. The panel
// now calls this builder rather than interpolating its own string, so there is
// one place this claim is written and one place it is pinned.
describe('the overconfidence sentence claims only what topInfluence established', () => {
  const s = overconfidenceSentence('Monthly Churn Rate')

  it('does not assert a review-priority ranking, which influence cannot establish', () => {
    expect(s).not.toMatch(/highest-priority/i)
    expect(s).not.toMatch(/among the/i)
  })

  it('does not assert a universal absence of evidence — it names the carrier checked', () => {
    // "no supporting evidence" is a claim about every carrier; the test reads one.
    expect(s).not.toMatch(/no supporting evidence/i)
    expect(s).toMatch(/no uncertainty drivers are recorded/i)
  })

  it('still says what topInfluence DID establish, and still prescribes the action', () => {
    expect(s).toMatch(/most influential factor/i)
    expect(s).toMatch(/Validate it before relying on it/)
  })

  it('binds to the factor it was called for, by identity rather than by shape', () => {
    // A builder that ignored its argument would satisfy every assertion above.
    expect(s).toContain('Monthly Churn Rate')
    expect(overconfidenceSentence('Pro Plan Price')).toContain('Pro Plan Price')
    expect(overconfidenceSentence('Pro Plan Price')).not.toContain('Monthly Churn Rate')
  })
})
