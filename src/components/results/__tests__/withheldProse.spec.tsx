/**
 * WITHHELD RUNS MAY NOT PRESUPPOSE A LEADER — results-panel prose
 * (ROADMAP 1.267, follow-up to PR #501).
 *
 * `withheldDesignations.spec.tsx` (this directory) pins the designations a
 * string matcher cannot see — order, ordinals, crowns, screen-reader cues.
 * `ownedLeaderClaim.surfaces.spec.ts` pins the HEADLINE prose. This file
 * closes the surfaces neither reached: sentences elsewhere on the panel that
 * quietly PRESUPPOSE a leading option on a run where CEE declined to name
 * one.
 *
 *   · V7 evidence disclosure — the two lead-in notes above the flip-risk and
 *     trade-off rows. The whole V7 top group is FLAGLESS, so these shipped on
 *     every run.
 *   · "What could change the result" — the flip-threshold status note, gated
 *     only on the producer's `flipThresholdsStatus`.
 *   · Stress-test thinking patterns — four UI-AUTHORED strings naming "your
 *     recommendation", gated only on `winnerLabel` being non-empty.
 *   · certaintyCopy's `verdict` parameter — the compile-time hole.
 *
 * ## The line this file draws
 *
 * DATA STAYS. Every flip probability, every driver, every fragile factor,
 * every producer number keeps rendering on a withheld run; each surface below
 * has a case asserting exactly that. A change that silenced the withheld turn
 * by deleting the evidence would fail here, and would be a worse product than
 * the defect.
 *
 * CLAIMS GO. What is removed is the presupposition: "the leading option",
 * "your recommendation", "becomes the likely leader".
 *
 * ## Scope of the claim (CLAUDE.md trap 3)
 *
 * jsdom proves rendered text, presence and absence. It cannot prove layout or
 * visual order. Nothing here claims a visual property.
 */
import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { V7EvidenceDisclosure } from '../v7/V7EvidenceDisclosure'
import type { V7EvidenceModel } from '../v7/buildV7Lenses'
import { V7_LENS_COPY } from '../v7/v7LensCopy'
import { flipThresholdStatusNote } from '../utils/flipThresholdStatusNote'
import { StressTestSection } from '../StressTestSection'
import { buildCertaintyCopy } from '../utils/certaintyCopy'
import { NO_CLAIM_VERDICT } from '../../../lib/decisionVerdict'
import type { DriverItem } from '../types'
import {
  HIGH_LABEL,
  MID_LABEL,
  PERMITTED_VERDICT,
  WITHHELD_VERDICT,
} from '../__fixtures__/withheldDesignations.fixtures'

/**
 * Anything that asserts, or presupposes, that one option is out in front.
 *
 * Narrower than the fixture's `DESIGNATION_RE` on purpose: that one bans
 * "leads" outright, which would also condemn a producer-supplied CONDITIONAL
 * ("if X is above V, Y leads; below it, Z leads") — a symmetric, producer-
 * owned statement that names both options and asserts no current leader.
 * This matcher targets the unconditional leader NOUN and the possessive
 * "your recommendation", which are the claims the verdict withholds.
 */
const LEADER_PRESUPPOSITION_RE = /leading option|likely leader|your recommendation/i

// ─────────────────────────────────────────────────────────────────────────────
// SURFACE 1 — the V7 evidence disclosure notes (flagless)
// ─────────────────────────────────────────────────────────────────────────────

function evidenceModel(designationsWithheld: boolean): V7EvidenceModel {
  return {
    drivers: [
      { factorKey: 'fac_tco', label: 'Three-Year Total Cost of Ownership', direction: 'negative', isEstimate: false, focusId: undefined },
    ],
    flipRisks: [
      { fromId: 'fac_capacity', toId: 'out_value', edgeId: 'e1', fromLabel: 'Team capacity', toLabel: 'Value delivered', switchProbability: 0.48 },
    ],
    tradeOffs: [
      { factorLabel: 'Team capacity', factorId: 'fac_capacity', splitValue: 30, splitUnit: '%', highWinnerLabel: HIGH_LABEL, lowWinnerLabel: MID_LABEL },
    ],
    designationsWithheld,
  }
}

/** Open the disclosure and switch to one of its three views. */
function openEvidence(designationsWithheld: boolean, view: 'flipRisks' | 'tradeOffs') {
  const utils = render(<V7EvidenceDisclosure evidence={evidenceModel(designationsWithheld)} />)
  // fireEvent, not node.click(): the raw DOM call escapes React's act() and
  // the disclosure never re-renders, which makes every assertion below read a
  // collapsed section — a false green that looks exactly like a real one.
  fireEvent.click(screen.getByRole('button', { name: /Why, and what could change it/i }))
  fireEvent.click(screen.getByTestId(`v7-evidence-tab-${view}`))
  return utils
}

describe('V7 evidence disclosure — the two lead-in notes', () => {
  it('ANTI-VACUITY: the PERMITTED notes carry the presupposition the matcher hunts', () => {
    // Positive control for LEADER_PRESUPPOSITION_RE. Without this, the two
    // withheld cases below could pass by matching nothing at all.
    expect(V7_LENS_COPY.evidence.flipRisksNote(false)).toMatch(LEADER_PRESUPPOSITION_RE)
    expect(V7_LENS_COPY.evidence.tradeOffsNote(false)).toMatch(LEADER_PRESUPPOSITION_RE)
  })

  it('WITHHELD: the flip-risks note presupposes no leader', () => {
    const { container } = openEvidence(true, 'flipRisks')
    expect(container.textContent ?? '').not.toMatch(LEADER_PRESUPPOSITION_RE)
  })

  it('WITHHELD: the trade-offs note presupposes no leader', () => {
    const { container } = openEvidence(true, 'tradeOffs')
    expect(V7_LENS_COPY.evidence.tradeOffsNote(true)).not.toMatch(LEADER_PRESUPPOSITION_RE)
    expect(container.textContent ?? '').toContain(V7_LENS_COPY.evidence.tradeOffsNote(true))
  })

  it('WITHHELD DATA PRESERVED: the flip-risk row and its producer probability still render', () => {
    openEvidence(true, 'flipRisks')
    expect(screen.getByTestId('v7-evidence-flip-risks').textContent ?? '').toContain('Team capacity')
    expect(screen.getByTestId('v7-evidence-flip-risks').textContent ?? '').toContain('48%')
  })

  it('WITHHELD DATA PRESERVED: the producer trade-off narration still names both options', () => {
    openEvidence(true, 'tradeOffs')
    const body = screen.getByTestId('v7-evidence-trade-offs').textContent ?? ''
    expect(body).toContain(HIGH_LABEL)
    expect(body).toContain(MID_LABEL)
  })

  it('PERMITTED: both notes are byte-identical to today', () => {
    expect(V7_LENS_COPY.evidence.flipRisksNote(false)).toBe(
      'Relationships whose plausible range can change the leading option.',
    )
    expect(V7_LENS_COPY.evidence.tradeOffsNote(false)).toBe(
      'Where the leading option depends on an assumption.',
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// SURFACE 3 — the flip-threshold status note ("What could change the result")
// ─────────────────────────────────────────────────────────────────────────────

describe('flipThresholdStatusNote', () => {
  const withheld = (status: string, hasUnresolved = false) =>
    flipThresholdStatusNote({ status, hasUnresolved, designationsWithheld: true })
  const permitted = (status: string, hasUnresolved = false) =>
    flipThresholdStatusNote({ status, hasUnresolved, designationsWithheld: false })

  it('ANTI-VACUITY: all three PERMITTED sentences carry the presupposition', () => {
    expect(permitted('all_no_effect')).toMatch(LEADER_PRESUPPOSITION_RE)
    expect(permitted('partial_no_effect')).toMatch(LEADER_PRESUPPOSITION_RE)
    expect(permitted('partial_no_effect', true)).toMatch(LEADER_PRESUPPOSITION_RE)
  })

  it('WITHHELD: none of the three sentences presupposes a leader', () => {
    for (const s of [withheld('all_no_effect'), withheld('partial_no_effect'), withheld('partial_no_effect', true)]) {
      expect(s, `status note leaked a presupposition: "${s}"`).not.toMatch(LEADER_PRESUPPOSITION_RE)
    }
  })

  it('WITHHELD DATA PRESERVED: each status still says what the producer found', () => {
    expect(withheld('all_no_effect')).toContain('No single tested factor changed')
    expect(withheld('partial_no_effect')).toContain('Some factors did not change')
    expect(withheld('partial_no_effect', true)).toContain('others could not be resolved')
    // The unresolved variant is still DISTINCT from the plain one — the two
    // branches did not collapse into one sentence.
    expect(withheld('partial_no_effect', true)).not.toBe(withheld('partial_no_effect'))
  })

  it('PERMITTED: all three sentences are byte-identical to today', () => {
    expect(permitted('all_no_effect')).toBe(
      'No single tested factor changed the leading option within the current range.',
    )
    expect(permitted('partial_no_effect')).toBe(
      'Some factors did not change the leading option within the current range.',
    )
    expect(permitted('partial_no_effect', true)).toBe(
      'Some factors did not change the leading option within the current range, and others could not be resolved.',
    )
  })

  it('an unclassified status renders NO line, in either verdict state', () => {
    // Null rather than '' — the caller must not emit an empty paragraph.
    expect(withheld('computed')).toBeNull()
    expect(permitted('computed')).toBeNull()
    expect(withheld(undefined as unknown as string)).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// SURFACE 4 — the stress-test thinking patterns
// ─────────────────────────────────────────────────────────────────────────────

const STRESS_DRIVER: DriverItem = {
  factorKey: 'fac_capacity',
  factorLabel: 'Team capacity',
  rankFlipRate: 0.31,
  confidence: 0.6,
  confidenceProvenance: 'producer',
  normalisedInfluence: 1,
  rank: 1,
  canFocus: false,
} as unknown as DriverItem

function renderStressTest(designationsWithheld: boolean) {
  return render(
    <StressTestSection
      drivers={[STRESS_DRIVER]}
      fragileEdges={[]}
      winnerLabel={HIGH_LABEL}
      alternativeLabel={MID_LABEL}
      designationsWithheld={designationsWithheld}
    />,
  )
}

describe('StressTestSection — the UI-authored thinking patterns', () => {
  /**
   * The finding this case records: the sweep asked whether these surfaces
   * might ALREADY be dark on a withheld run, because `winnerLabel` comes from
   * `recommendedOption`. They are not. `recommendedOption` is resolved by
   * `determineWinnerSelection` from `robustness.recommended_option_id` — which
   * CEE still sends on a withheld turn (see WITHHELD_REPORT in the shared
   * fixture, whose `recommended_option_id` is populated) — so `winnerLabel`
   * resolves and the only gate stays open.
   */
  it('ANTI-VACUITY: with the gate off, all four authored strings are present', () => {
    const { container } = renderStressTest(false)
    const text = container.textContent ?? ''
    expect(text).toMatch(LEADER_PRESUPPOSITION_RE)
    expect(text).toContain(`switch your recommendation from ${HIGH_LABEL} to ${MID_LABEL}`)
    expect(text).toContain(`does ${HIGH_LABEL} usually outperform ${MID_LABEL}`)
    expect(screen.getByTestId('stress-test-thinking-subsection')).toBeInTheDocument()
  })

  it('WITHHELD: the thinking-pattern cards do not render', () => {
    renderStressTest(true)
    expect(screen.queryByTestId('stress-test-thinking-subsection')).toBeNull()
    expect(screen.queryByTestId('stress-test-disconfirmation')).toBeNull()
    expect(screen.queryByTestId('stress-test-outside-view')).toBeNull()
  })

  it('WITHHELD: no rendered string presupposes a leader or a recommendation', () => {
    const { container } = renderStressTest(true)
    expect(container.textContent ?? '').not.toMatch(LEADER_PRESUPPOSITION_RE)
  })

  /**
   * #501's lesson applied: a designation suppressed from the list but still
   * counted in the header is only half-suppressed. The count must move too.
   */
  it('WITHHELD: the header count drops by exactly the two cards', () => {
    const { unmount } = renderStressTest(false)
    const permittedCount = Number(screen.getByTestId('accordion-stress-test').textContent?.match(/\d+/)?.[0])
    unmount()
    renderStressTest(true)
    const withheldCount = Number(screen.getByTestId('accordion-stress-test').textContent?.match(/\d+/)?.[0])
    expect(permittedCount - withheldCount).toBe(2)
  })

  it('WITHHELD DATA PRESERVED: the sensitive-assumption row still renders', () => {
    renderStressTest(true)
    expect(screen.getByTestId('stress-test-sensitive-subsection').textContent ?? '')
      .toContain('Team capacity')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// SURFACE 5 — certaintyCopy's verdict parameter, now REQUIRED
//
// The compile-time half of this fix cannot be asserted at runtime (a missing
// required property is a type error, not a thrown exception), so the runtime
// half pins the BEHAVIOUR the required parameter guarantees: the fall-through
// that `undefined` used to reach is now unreachable without an explicit
// no-claim verdict, and that verdict lands on the withheld headline.
// ─────────────────────────────────────────────────────────────────────────────

describe('buildCertaintyCopy — no caller can reach the leader rules without a verdict', () => {
  const base = {
    winnerLabel: HIGH_LABEL,
    confidenceTier: 'strong' as const,
    coachingReadiness: 'ready' as const,
    recommendationStability: 0.9,
    analysisStatus: 'computed' as const,
    optionCount: 3,
    winProbabilityGap: 30,
  }

  it('ANTI-VACUITY: a PERMITTED verdict still reaches the leader-asserting rule', () => {
    expect(buildCertaintyCopy({ ...base, verdict: PERMITTED_VERDICT }).headline)
      .toBe(`${HIGH_LABEL} is the leading option`)
  })

  it('the explicit no-claim verdict lands on the withheld headline, not a leader claim', () => {
    const copy = buildCertaintyCopy({ ...base, verdict: NO_CLAIM_VERDICT })
    expect(copy.headline).toBe('the analysis did not put an option forward')
    expect(copy.headline).not.toMatch(LEADER_PRESUPPOSITION_RE)
    // conservative: true is what blocks the producer's coaching headline from
    // overriding this line in DecisionConfidencePanel.
    expect(copy.conservative).toBe(true)
  })

  it('the shared WITHHELD fixture verdict behaves identically to NO_CLAIM_VERDICT', () => {
    expect(buildCertaintyCopy({ ...base, verdict: WITHHELD_VERDICT }))
      .toEqual(buildCertaintyCopy({ ...base, verdict: NO_CLAIM_VERDICT }))
  })

  it('NO_CLAIM_VERDICT is the no-claim shape, not a denial', () => {
    // 'unknown', never 'tied': a denial ("no clear leading option") is a
    // second claim this verdict equally has no authority for.
    expect(NO_CLAIM_VERDICT.hasLeadingOption).toBe(false)
    expect(NO_CLAIM_VERDICT.separation).toBe('unknown')
    expect(NO_CLAIM_VERDICT.source).toBe('none')
  })
})
