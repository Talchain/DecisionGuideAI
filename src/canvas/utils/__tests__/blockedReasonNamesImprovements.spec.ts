/**
 * The panel must not say "ask in the chat" while holding the answer.
 *
 * ⚠ WITNESSED. A mounted footer read "Not ready for analysis yet. Olumi needs
 * something more from this model before the next analysis. Ask in the chat and
 * it will explain what is missing." — while the `graph-readiness` payload that
 * same panel had just received carried three specific, human-readable actions
 * ("Choose the missing effect value for X on Y", and two more). The chat recited
 * all three faithfully when asked. The panel discarded detail it was holding and
 * sent the user elsewhere for it.
 *
 * ⚠ SCOPE. This pins the GRAPH-readiness fall-through only. The richer path —
 * `composeAnalysisBlockedReason` over the analysis authority's blockers — is
 * unchanged and still preferred; this rung only runs when that authority is
 * absent and the structured rungs above did not match.
 */
import { describe, it, expect } from 'vitest'
import { composeReadinessBlockedReason, BLOCKED_REASON_COPY } from '../composeBlockedReason'
import type { GraphReadiness } from '../../hooks/useGraphReadiness'
import { IMPROVEMENT_ACTION_PLACEHOLDER } from '../improvementActionPlaceholder'

const ACTION_A = 'Choose the missing effect value for "rebuild our product" on "Cash runway consumed".'
const ACTION_B = 'Choose which factor "discount hard to win logos back" changes and by how much.'

const readinessWith = (improvements: unknown[]): GraphReadiness => ({
  readiness_score: 40,
  readiness_level: 'needs_work',
  can_run_analysis: false,
  confidence_explanation: '',
  improvements,
} as unknown as GraphReadiness)

describe('the blocked reason names the producer\'s own remedies', () => {
  it('names a single improvement rather than deferring to the chat', () => {
    const out = composeReadinessBlockedReason(readinessWith([{ action: ACTION_A }]))
    expect(out).toContain('Cash runway consumed')
    expect(out).not.toBe(BLOCKED_REASON_COPY.unspecified)
  })

  it('names ALL of them — withholding some understates the work outstanding', () => {
    const out = composeReadinessBlockedReason(readinessWith([{ action: ACTION_A }, { action: ACTION_B }]))
    expect(out).toContain('Cash runway consumed')
    expect(out).toContain('discount hard to win logos back')
  })

  it('de-duplicates rather than repeating one remedy', () => {
    const out = composeReadinessBlockedReason(readinessWith([{ action: ACTION_A }, { action: ACTION_A }]))
    expect(out.split('Cash runway consumed').length - 1).toBe(1)
  })

  /*
   * ⭐ DEGRADE TO LESS SPECIFIC TRUE COPY, NEVER TO A DIFFERENT CLAIM. This
   * module's standing rule, and the reason each case below returns the generic
   * sentence rather than a partial list that would read as complete.
   */
  it('degrades to the generic sentence when there are no improvements', () => {
    expect(composeReadinessBlockedReason(readinessWith([]))).toBe(BLOCKED_REASON_COPY.unspecified)
  })

  it('degrades when ANY entry is unusable — never a partial list', () => {
    const out = composeReadinessBlockedReason(readinessWith([{ action: ACTION_A }, { action: '   ' }]))
    expect(out, 'a blank entry must degrade the whole sentence, not silently drop one remedy')
      .toBe(BLOCKED_REASON_COPY.unspecified)
  })

  it('degrades when the payload is not the declared shape', () => {
    expect(composeReadinessBlockedReason(readinessWith([{ notAnAction: 1 }])))
      .toBe(BLOCKED_REASON_COPY.unspecified)
    expect(composeReadinessBlockedReason(null)).toBe(BLOCKED_REASON_COPY.unspecified)
  })

  /*
   * ⚠ THE STALE SHORT-CIRCUIT MUST STILL WIN. A stale verdict's improvements
   * describe a graph the user has already changed, so naming them would tell
   * someone to do something they may have just done.
   */
  /**
   * ⚠ THE STORE FABRICATES. `readinessStore` maps
   * `action: imp.action || imp.recommendation || IMPROVEMENT_ACTION_PLACEHOLDER`,
   * so an improvement the producer sent with NO action still arrives here as a
   * non-empty string. This rung's whole claim is that the sentence is the
   * PRODUCER naming what is missing — so rendering the synthesised line would
   * present a UI invention as the producer's own words, which is a worse failure
   * than the generic sentence it replaced: the generic one is visibly generic,
   * this one is indistinguishable from a real remedy.
   *
   * Bound by IDENTITY to the store's exported constant, never to a copy of the
   * literal — a copy would keep passing the day the wording changes.
   */
  it('REFUSES the store\'s synthesised action — a fabrication is not producer prose', () => {
    const out = composeReadinessBlockedReason(
      readinessWith([{ action: IMPROVEMENT_ACTION_PLACEHOLDER }]),
    )
    expect(out).not.toContain(IMPROVEMENT_ACTION_PLACEHOLDER)
    expect(out).toBe(BLOCKED_REASON_COPY.unspecified)
  })

  it('MIXED — one synthesised action degrades the WHOLE sentence, not just its own row', () => {
    const out = composeReadinessBlockedReason(
      readinessWith([{ action: ACTION_A }, { action: IMPROVEMENT_ACTION_PLACEHOLDER }]),
    )
    expect(out).not.toContain(IMPROVEMENT_ACTION_PLACEHOLDER)
    expect(out).not.toContain(ACTION_A)
    expect(out).toBe(BLOCKED_REASON_COPY.unspecified)
  })

  it('never quotes improvements from a STALE verdict', () => {
    const out = composeReadinessBlockedReason(readinessWith([{ action: ACTION_A }]), [], true)
    expect(out).not.toContain('Cash runway consumed')
  })
})
