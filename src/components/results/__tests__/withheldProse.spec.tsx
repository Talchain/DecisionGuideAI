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
import { COMPARATIVE_COPY } from '../utils/goalAnchorCopy'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { useAskOlumiStore } from '../coaching/askOlumiStore'
import { V7EvidenceDisclosure } from '../v7/V7EvidenceDisclosure'
import type { V7EvidenceModel } from '../v7/buildV7Lenses'
import { V7_LENS_COPY } from '../v7/v7LensCopy'
import { flipThresholdStatusNote } from '../utils/flipThresholdStatusNote'
import { StressTestSection } from '../StressTestSection'
import { FragileEdgeGroupCard, type ChallengeFragileEdge } from '../FragileEdgeGroupCard'
import {
  fragileDiscussDraft,
  fragileEValueNote,
  fragileEdgeConsequence,
  fragileEdgeGroupHeader,
} from '../utils/fragileEdgeCopy'
import { buildCertaintyCopy } from '../utils/certaintyCopy'
import { NO_CLAIM_VERDICT } from '../../../lib/decisionVerdict'
import type { DriverItem } from '../types'
import {
  HIGH_ID,
  HIGH_LABEL,
  MID_LABEL,
  PERMITTED_VERDICT,
  WITHHELD_VERDICT,
} from '../__fixtures__/withheldDesignations.fixtures'
// R-12: the disclosure open/switch sequence — one definition, see the helper.
import { openDisclosureHeader, switchEvidenceView } from '../../../test/helpers/resolveNextView'

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
/**
 * ⚠ F6 — UNION, NEVER REPLACE. This alternation is a BLINDNESS probe: the
 * withheld-branch assertions below prove a sweep of rendered text contains
 * NO leader presupposition, and the probe can only prove that for the shapes
 * it knows. The re-anchoring pass REPLACED `your recommendation` with the new
 * shape instead of adding to it, which silently made every withheld sweep
 * blind to the retired vocabulary — so a reintroduced legacy string would
 * have sailed through the very guard written to catch it.
 *
 * Retired shapes stay in the alternation permanently. They cost one token
 * each and they are the only thing standing between a reverted file and a
 * green suite. (`HERO_CLAIM_RE` was correctly unioned in the same pass; these
 * two were not — the inconsistency is the tell.)
 */
const LEADER_PRESUPPOSITION_RE =
  /leading option|likely leader|more likely than .+ to hit your goal|your recommendation|the recommendation/i

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
    // V7-C slice 1 (ROADMAP 2.141): the Resolve next view names factors, never
    // an option, so it carries no leader claim for the withheld-prose sweep to
    // catch. `null` keeps this fixture's scope unchanged — the ranking's own
    // withheld behaviour is pinned in its dedicated spec.
    resolveNext: null,
    designationsWithheld,
  }
}

/**
 * Build THIS spec's evidence model, then open the disclosure on one of its views.
 *
 * R-12: the two-click sequence is no longer written here — `openDisclosureHeader`
 * / `switchEvidenceView` come from `src/test/helpers/resolveNextView.tsx`, along
 * with the `fireEvent`-not-`node.click()` rationale this copy used to be the sole
 * carrier of (the raw DOM call escapes React's `act()`, the disclosure never
 * re-renders, and every assertion afterwards reads a COLLAPSED section — a false
 * green that looks exactly like a real one). What stays local is the part that is
 * genuinely local: the `designationsWithheld` model this file is about.
 */
function openEvidence(designationsWithheld: boolean, view: 'flipRisks' | 'tradeOffs') {
  const utils = render(<V7EvidenceDisclosure evidence={evidenceModel(designationsWithheld)} />)
  openDisclosureHeader()
  switchEvidenceView(view)
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
    expect(text).toContain(`What would have to change for ${MID_LABEL} to become more likely than ${HIGH_LABEL} to hit your goal?`)
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
// SURFACE 6 — the stress-test FRAGILE-FACTOR cards (FragileEdgeGroupCard)
//
// The surface SURFACE 4 missed, one component over. #503 gated the two
// UI-authored thinking-pattern cards on the verdict and recorded that
// "sensitive assumptions and fragile factors are producer data and keep
// rendering". True — and it settled their VISIBILITY, not their PROSE.
// `FragileEdgeGroupCard` took no verdict at all, so on a withheld run its
// header asserted "N factors could flip the result to <named option>" directly
// beneath the panel's own "the analysis did not put an option forward".
//
// The line drawn here is the file's line: DATA STAYS (counts, factor labels,
// E-values, Review chips, the stability pill — all asserted below on the
// withheld run), CLAIMS GO.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The fragile card's own claim vocabulary.
 *
 * Distinct from `LEADER_PRESUPPOSITION_RE` because this card presupposes the
 * recommendation without ever saying "leading option" or "your recommendation"
 * — which is precisely why the #503 matcher, pointed at the same panel, could
 * not see it. "the recommendation" (bare definite article) and "flip the
 * result to" are the claims: both presuppose that a result/recommendation
 * exists to be flipped.
 */
// SUPERSEDED 2026-07-31: `the recommendation` is retired as an un-anchored
// noun, so this probe must name the wording the PERMITTED branch emits TODAY
// or it would pass by testing nothing (trap 13).
//
// ⚠ F6 — but the retired shapes are KEPT in the alternation, not swapped out.
// This probe's job in the WITHHELD assertions is to prove an absence, and a
// probe that has forgotten the old vocabulary cannot see it come back. Union;
// never replace.
const FRAGILE_CLAIM_RE =
  /flip the result to|result could flip to|which option is most likely to hit your goal|the recommendation/i

const FRAGILE_FROM = 'Team capacity'
const FRAGILE_FROM_2 = 'Delivery risk'

function fragileEdge(overrides: Partial<ChallengeFragileEdge> = {}): ChallengeFragileEdge {
  return {
    edge_id: 'e_capacity',
    from_id: 'fac_capacity',
    from_label: FRAGILE_FROM,
    to_label: 'Value delivered',
    switch_probability: 0.48,
    alternative_winner_id: HIGH_ID,
    alternative_winner_label: HIGH_LABEL,
    ...overrides,
  }
}

/** Mount the LIVE path: ResultsBody → StressTestSection → FragileEdgeGroupCard. */
function renderFragile(designationsWithheld: boolean, edges: ChallengeFragileEdge[]) {
  const utils = render(
    <StressTestSection
      drivers={[]}
      fragileEdges={edges}
      winnerLabel={HIGH_LABEL}
      alternativeLabel={MID_LABEL}
      designationsWithheld={designationsWithheld}
    />,
  )
  return { ...utils, subsection: () => screen.getByTestId('stress-test-fragile-subsection') }
}

/**
 * Assertions read the FRAGILE SUBSECTION, never the whole container: the
 * thinking-pattern cards above it also carry claim vocabulary and are already
 * suppressed by #503, so a container-wide `not.toMatch` on a withheld run
 * would pass on someone else's fix.
 */
function fragileText(designationsWithheld: boolean, edges: ChallengeFragileEdge[]): string {
  const { subsection } = renderFragile(designationsWithheld, edges)
  return subsection().textContent ?? ''
}

describe('StressTestSection fragile factors — STRING 1: the grouped header', () => {
  const twoEdges = [
    fragileEdge(),
    fragileEdge({ edge_id: 'e_risk', from_id: 'fac_risk', from_label: FRAGILE_FROM_2, switch_probability: 0.31 }),
  ]

  it('ANTI-VACUITY: the PERMITTED header carries the claim the matcher hunts', () => {
    const text = fragileText(false, twoEdges)
    expect(text).toContain('2 factors could flip the result to')
    expect(text).toMatch(FRAGILE_CLAIM_RE)
    expect(screen.getByTestId('fragile-alt-winner').textContent).toBe(HIGH_LABEL)
  })

  it('WITHHELD: the header drops the presupposing verb', () => {
    const text = fragileText(true, twoEdges)
    expect(text).toContain('2 factors could shift the comparison towards')
    expect(text).not.toMatch(FRAGILE_CLAIM_RE)
  })

  /**
   * ORCHESTRATOR RULING: the presupposition is the defect; the NAME is data.
   * `alternative_winner_label` is directional sensitivity — which option this
   * edge's fragility points toward — and `heroCopy.flipRiskWithAlternative`
   * (canonical for this field) keeps it on a withheld run. Dropping it here
   * would both over-suppress and make one screen treat one producer field two
   * ways. This case is the over-suppression control for that ruling.
   */
  it('WITHHELD: the alternative is still NAMED — the name is data, not a claim', () => {
    renderFragile(true, twoEdges)
    expect(screen.getByTestId('fragile-alt-winner').textContent).toBe(HIGH_LABEL)
    expect(screen.getByTestId('stress-test-fragile-subsection').textContent ?? '')
      .toContain(HIGH_LABEL)
  })

  it('PERMITTED: the header is byte-identical to today', () => {
    expect(
      fragileEdgeGroupHeader({ altWinnerLabel: HIGH_LABEL, edgeCount: 2, hasEValue: false, designationsWithheld: false }),
    ).toEqual({ kind: 'altWinner', lead: '2 factors could flip the result to ', altWinnerLabel: HIGH_LABEL })
  })

  it('WITHHELD: the header keeps the altWinner SHAPE — only the lead changes', () => {
    // Pinned as a shape, not just a substring: a fix that returned a plain
    // sentence would drop the `fragile-alt-winner` element and the name with it.
    expect(
      fragileEdgeGroupHeader({ altWinnerLabel: HIGH_LABEL, edgeCount: 2, hasEValue: false, designationsWithheld: true }),
    ).toEqual({ kind: 'altWinner', lead: '2 factors could shift the comparison towards ', altWinnerLabel: HIGH_LABEL })
  })
})

describe('StressTestSection fragile factors — STRING 2: the singleton header', () => {
  it('ANTI-VACUITY: the PERMITTED singleton header carries the claim', () => {
    const text = fragileText(false, [fragileEdge()])
    expect(text).toContain('Result could flip to')
    expect(text).toMatch(FRAGILE_CLAIM_RE)
  })

  it('WITHHELD: the singleton header presupposes no result to flip, and still names the alternative', () => {
    const text = fragileText(true, [fragileEdge()])
    expect(text).toContain('The comparison could shift towards')
    expect(text).not.toMatch(FRAGILE_CLAIM_RE)
    expect(screen.getByTestId('fragile-alt-winner').textContent).toBe(HIGH_LABEL)
  })

  it('PERMITTED: the singleton header is byte-identical to today', () => {
    expect(
      fragileEdgeGroupHeader({ altWinnerLabel: HIGH_LABEL, edgeCount: 1, hasEValue: false, designationsWithheld: false }),
    ).toEqual({ kind: 'altWinner', lead: 'Result could flip to ', altWinnerLabel: HIGH_LABEL })
  })

  it('WITHHELD: the singleton header keeps the altWinner shape', () => {
    expect(
      fragileEdgeGroupHeader({ altWinnerLabel: HIGH_LABEL, edgeCount: 1, hasEValue: false, designationsWithheld: true }),
    ).toEqual({ kind: 'altWinner', lead: 'The comparison could shift towards ', altWinnerLabel: HIGH_LABEL })
  })

  it('NO ALT-WINNER: both headers are byte-identical in BOTH verdict states', () => {
    // The verdict-independent branch — a control against a fix that rewrote
    // copy it had no reason to touch.
    for (const designationsWithheld of [false, true]) {
      expect(fragileEdgeGroupHeader({ altWinnerLabel: null, edgeCount: 1, hasEValue: false, designationsWithheld }))
        .toEqual({ kind: 'plain', text: 'Fragile relationship' })
      expect(fragileEdgeGroupHeader({ altWinnerLabel: null, edgeCount: 2, hasEValue: true, designationsWithheld }))
        .toEqual({ kind: 'plain', text: 'Fragile result, verify key assumptions' })
    }
  })
})

describe('StressTestSection fragile factors — STRING 3: the per-edge consequence', () => {
  // Rendered only when the group has NO named alt-winner.
  const orphanEdge = [fragileEdge({ alternative_winner_id: undefined, alternative_winner_label: undefined })]

  it('ANTI-VACUITY: the PERMITTED clause names the re-anchored object (SUPERSEDED: was "the recommendation")', () => {
    const text = fragileText(false, orphanEdge)
    expect(text).toContain('which option is most likely to hit your goal could change')
    expect(text).toMatch(FRAGILE_CLAIM_RE)
  })

  it('WITHHELD: the clause names the comparison instead', () => {
    const text = fragileText(true, orphanEdge)
    expect(text).toContain('the comparison could change')
    expect(text).not.toMatch(FRAGILE_CLAIM_RE)
  })

  it('PERMITTED: the clause is byte-identical to today', () => {
    expect(fragileEdgeConsequence({ designationsWithheld: false })).toBe('which option is most likely to hit your goal could change')
  })
})

describe('StressTestSection fragile factors — STRING 4: the expert E-value note', () => {
  /**
   * REACHABILITY, stated precisely (CLAUDE.md — name the claim type).
   * This string is NOT reachable on the live path today, and is now
   * unreachable from ANY path: `e_value` used to reach `FragileEdgeGroupCard`
   * only from `ChallengeSection`, which merged `edgeEValues` — but
   * `ChallengeSection` had no production call site and was DELETED in the
   * 2026-07-27 dead-code sweep. The sole remaining caller,
   * `StressTestSection`, passes `ChallengeFragileEdge[]`, which carries no
   * `e_value`. The string is fixed and pinned here because it is the same
   * defect in the same component and one prop away from live.
   */
  const eValueEdges = [{ ...fragileEdge({ alternative_winner_label: undefined }), e_value: 2.0 }]

  function renderCard(designationsWithheld: boolean) {
    return render(
      <FragileEdgeGroupCard
        altWinnerLabel={null}
        edges={eValueEdges}
        expertMode
        designationsWithheld={designationsWithheld}
      />,
    )
  }

  it('ANTI-VACUITY: the PERMITTED note says "change which option is most likely to hit your goal"', () => {
    const { container } = renderCard(false)
    expect(container.textContent ?? '').toContain('2.0x wrong to change which option is most likely to hit your goal.')
    expect(container.textContent ?? '').toMatch(FRAGILE_CLAIM_RE)
  })

  it('WITHHELD: the note says what would change without naming a recommendation', () => {
    const { container } = renderCard(true)
    expect(container.textContent ?? '').toContain('2.0x wrong to change the comparison.')
    expect(container.textContent ?? '').not.toMatch(FRAGILE_CLAIM_RE)
  })

  it('WITHHELD DATA PRESERVED: the E-value number itself still renders', () => {
    const { container } = renderCard(true)
    expect(container.textContent ?? '').toContain('E-value 2.0')
  })

  it('PERMITTED: the note is byte-identical to today', () => {
    expect(fragileEValueNote({ eValue: 2.0, designationsWithheld: false }))
      .toBe('E-value 2.0: assumptions would only need to be 2.0x wrong to change which option is most likely to hit your goal.')
  })
})

describe('StressTestSection fragile factors — STRING 5: the Ask-Olumi draft', () => {
  // In scope for the reason #503 put the two thinking-pattern drafts in scope:
  // a draft is prose the product hands the user to send in their own name.
  const base = { edgeCount: 2, fromLabel: FRAGILE_FROM, toLabel: 'Value delivered' }

  it('ANTI-VACUITY: the PERMITTED grouped draft names the flip target', () => {
    const draft = fragileDiscussDraft({ ...base, altWinnerLabel: HIGH_LABEL, designationsWithheld: false })
    expect(draft).toBe(`Are these 2 relationships that could flip the result to ${HIGH_LABEL} reliable?`)
    expect(draft).toMatch(FRAGILE_CLAIM_RE)
  })

  it('WITHHELD: the grouped draft asks about the comparison, still naming the alternative', () => {
    const draft = fragileDiscussDraft({ ...base, altWinnerLabel: HIGH_LABEL, designationsWithheld: true })
    expect(draft).toBe(`Are these 2 relationships that could shift the comparison towards ${HIGH_LABEL} reliable?`)
    expect(draft).not.toMatch(FRAGILE_CLAIM_RE)
    // The user's own question carries every fact the analysis computed.
    expect(draft).toContain(HIGH_LABEL)
  })

  /**
   * The pure-function cases above cannot go red against the pristine
   * component (they exercise the new module directly). This one drives the
   * LIVE path — mount, click the sparkle, read what the drawer was handed —
   * so the draft's gate is proven the same way strings 1-4 are.
   */
  function draftFromCta(designationsWithheld: boolean): string {
    useAskOlumiStore.setState({ draft: '' })
    render(
      <StressTestSection
        drivers={[]}
        fragileEdges={[
          fragileEdge(),
          fragileEdge({ edge_id: 'e_risk', from_id: 'fac_risk', from_label: FRAGILE_FROM_2, switch_probability: 0.31 }),
        ]}
        winnerLabel={HIGH_LABEL}
        alternativeLabel={MID_LABEL}
        designationsWithheld={designationsWithheld}
        onSendMessage={() => {}}
      />,
    )
    const subsection = screen.getByTestId('stress-test-fragile-subsection')
    fireEvent.click(within(subsection).getByTestId('discuss-with-ai'))
    return useAskOlumiStore.getState().draft
  }

  it('ANTI-VACUITY: the PERMITTED sparkle prefills the flip-target draft', () => {
    const draft = draftFromCta(false)
    expect(draft).toBe(`Are these 2 relationships that could flip the result to ${HIGH_LABEL} reliable?`)
    expect(draft).toMatch(FRAGILE_CLAIM_RE)
  })

  it('WITHHELD: the sparkle prefills a draft with no presupposition', () => {
    const draft = draftFromCta(true)
    expect(draft).toBe(`Are these 2 relationships that could shift the comparison towards ${HIGH_LABEL} reliable?`)
    expect(draft).not.toMatch(FRAGILE_CLAIM_RE)
    expect(draft).toContain(HIGH_LABEL)
  })

  it('the two already-neutral drafts are byte-identical in BOTH verdict states', () => {
    for (const designationsWithheld of [false, true]) {
      expect(fragileDiscussDraft({ ...base, edgeCount: 1, altWinnerLabel: HIGH_LABEL, designationsWithheld }))
        .toBe(`Is the relationship between ${FRAGILE_FROM} and Value delivered reliable?`)
      expect(fragileDiscussDraft({ ...base, altWinnerLabel: null, designationsWithheld }))
        .toBe('Are these 2 fragile relationships in my model reliable?')
    }
  })
})

describe('StressTestSection fragile factors — OVER-SUPPRESSION CONTROLS', () => {
  const twoEdges = [
    fragileEdge(),
    fragileEdge({ edge_id: 'e_risk', from_id: 'fac_risk', from_label: FRAGILE_FROM_2, switch_probability: 0.31 }),
  ]

  it('WITHHELD: the fragile subsection still renders, with its producer count', () => {
    // StressTestSection.tsx:79-82 keeps fragile factors visible on a withheld
    // run BY DESIGN. A fix that silenced the section would pass every string
    // gate above and be a worse product than the defect.
    renderFragile(true, twoEdges)
    const subsection = screen.getByTestId('stress-test-fragile-subsection')
    expect(subsection.textContent ?? '').toContain('Fragile factors (2)')
  })

  it('WITHHELD: every source factor and Review chip still renders', () => {
    renderFragile(true, twoEdges)
    const text = screen.getByTestId('stress-test-fragile-subsection').textContent ?? ''
    expect(text).toContain(FRAGILE_FROM)
    expect(text).toContain(FRAGILE_FROM_2)
    expect(text).toContain('If')
    expect(text).toContain('shifts')
    expect(screen.getAllByTestId('fragile-card-stability-pill').length).toBeGreaterThan(0)
  })

  it('WITHHELD: the header count is the same number the permitted run shows', () => {
    const { unmount } = renderFragile(false, twoEdges)
    const permitted = screen.getByTestId('accordion-stress-test').textContent ?? ''
    unmount()
    renderFragile(true, twoEdges)
    const withheld = screen.getByTestId('accordion-stress-test').textContent ?? ''
    // #503 removes the two thinking-pattern cards (4 → 2); the two FRAGILE
    // rows must survive both counts. Asserted on the subsection header, which
    // counts only this subsection.
    expect(permitted).toContain('4')
    expect(withheld).toContain('2')
    expect(screen.getByTestId('stress-test-fragile-subsection').textContent ?? '')
      .toContain('Fragile factors (2)')
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
      .toBe(`${HIGH_LABEL} ${COMPARATIVE_COPY.phraseNoMagnitude}`)
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
