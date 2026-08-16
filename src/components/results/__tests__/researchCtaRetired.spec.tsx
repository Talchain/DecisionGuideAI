/**
 * ROADMAP 2.816 — THE RESEARCH CTA IS RETIRED, ON EVERY ARM THAT MOUNTS IT.
 *
 * ## The defect this pins
 *
 * The dominant-factor nudge carried a "Research <factor>" chip that opened the
 * Ask-Olumi drawer prefilled with *"Can you research <factor> and suggest a
 * reasonable estimate with sources?"*. Pressing Send created an ORDINARY chat
 * turn: there is no typed research action, no research-tool transport and no
 * producer anywhere in the estate, so CEE answers *"I can't fetch external
 * sources"*. The product advertised an action that reliably terminates in
 * refusal — a trust defect strictly worse than a dark capability, because a
 * dark capability disappoints nobody whereas an advertised one spends the
 * user's trust at the moment they act on it.
 *
 * Register direction (ROADMAP.md row 2.816, verbatim): *"Two honest fixes:
 * remove the CTA, or build the producer. There is no third option that leaves
 * the button where it is."* This spec pins the first.
 *
 * ## Why it asserts on the MOUNT PATH and not just the component (trap 3b)
 *
 * `TriageActionCardsBody` USED to be composed by THREE hosts, and which one a
 * real user loaded was decided by a deployed flag, not by this file's
 * defaults:
 *   · `ResultsBody`'s `hero-arm-triage-actions`  — the staging surface;
 *   · `DecisionConfidencePanel`                  — the dark arm;
 *   · `AnalysisHeroV17`                          — passed `useV17Copy`, which
 *     already suppressed the chip, which is exactly why a v17-only absence
 *     test proved nothing about what users actually loaded.
 *
 * ⚠ NARROWED, BY DELETION OF THE SUBJECT (PX-C analysis-cockpit
 * consolidation, and stated explicitly because narrowing a guard is normally
 * how a guard stops biting — CLAUDE.md 13b). The last two hosts are GONE:
 * `DecisionConfidencePanel` and `AnalysisHeroV17` were deleted with the dark
 * arm, and the flag that selected it no longer exists. There is now exactly
 * ONE host, mounted unconditionally inside the cockpit — so the coverage this
 * file loses is coverage of components that no longer exist, and none of the
 * coverage of the live surface. The absence assertions below still sweep the
 * WHOLE tree, so a re-host anywhere REDs them.
 *
 * ## Why each case pins its own precondition (traps 13 / 13b / 19)
 *
 * An absence assertion is vacuous unless the surface it searches is proven to
 * have rendered. Every case below first asserts the nudge MOUNTED and that its
 * sibling **Validate** chip is present — a positive control that REDs if the
 * host stops rendering, if the fixture stops clearing the dominance gate, or
 * if a refactor drops all chips. Only then is the Research CTA's absence
 * asserted, and it is bound BY IDENTITY to the exact generated accessible name
 * (`Research ${DOMINANT_LABEL}`), never to a substring another control could
 * satisfy — `StressTestSection`'s unrelated "Research this" chip is a live
 * example of a label a loose `^Research` predicate would collide with.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import { ResultsBody } from '../ResultsBody'
import { TriageActionCardsBody } from '../TriageActionCardsBody'
import type { ResultsSectionDataReturn } from '../useResultsSectionData'
import type {
  ConfidenceSectionData,
  DecisionResultData,
  DriverItem,
  DriversSectionData,
  ImprovementsSectionData,
  OptionResult,
} from '../types'
import { useCanvasStore } from '@/canvas/store'
import { useUIStore } from '@/stores/uiStore'

vi.mock('../../../canvas/utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusByTarget: vi.fn(),
  focusExistingTarget: vi.fn(),
  focusModelTarget: vi.fn(() => true),
}))

/**
 * The fixture's dominant factor. Identity anchor for every assertion below:
 * the retired chip's accessible name was exactly `Research ${DOMINANT_LABEL}`
 * and the surviving sibling's is exactly `Validate ${DOMINANT_LABEL} on canvas`.
 */
const DOMINANT_LABEL = 'Pricing power'
const RESEARCH_CTA_LABEL = `Research ${DOMINANT_LABEL}`
const VALIDATE_CTA_LABEL = `Validate ${DOMINANT_LABEL} on canvas`

function makeDriver(): DriverItem {
  return {
    factorKey: 'fac_top',
    factorLabel: DOMINANT_LABEL,
    rawElasticity: 1,
    normalisedInfluence: 1,
    // The nudge gates on an ABSOLUTE producer basis: `displayProvenance ===
    // 'influence_score'` with a display influence >= 0.8. Both are set so the
    // fixture clears the gate deliberately rather than by accident.
    influenceScore: 0.9,
    displayInfluence: 0.9,
    displayProvenance: 'influence_score',
    rank: 1,
    direction: 'positive',
    semanticLabel: 'biggest',
    canFocus: true,
    matchedNodeId: 'node_top',
  } as unknown as DriverItem
}

function makeData(): ResultsSectionDataReturn {
  const winner = {
    id: 'opt_a',
    label: 'Option A',
    expected: 0.8,
    outcome: { mean: 0.8, p10: 0.6, p50: 0.78, p90: 0.95 },
    p10: 0.6,
    p50: 0.78,
    p90: 0.95,
    isRecommended: true,
    winProbability: 0.7,
    goalProbability: 0.7,
  } as unknown as OptionResult

  const recommendation = {
    recommendedOption: winner,
    allOptions: [winner],
    goalLabel: 'Maximise success',
    goalThreshold: 0.6,
    isSingleOption: true,
    analysisStatus: 'computed',
    recommendationStability: 0.92,
    robustnessLevel: 'high',
    isNormalised: false,
    coachingReadiness: 'ready',
    coachingReadinessDimensions: { evidence: 0.8, robustness: 0.75, clarity: 0.85 },
  } as DecisionResultData

  const drivers: DriversSectionData = {
    drivers: [makeDriver()],
    topDrivers: [makeDriver()],
    driversStatus: 'computed',
    totalCount: 1,
    hasMagnitudeData: true,
    dominantFactorId: 'node_top',
    dominantFactorLabel: DOMINANT_LABEL,
  } as unknown as DriversSectionData

  const confidence = {
    tier: { tier: 'strong', icon: 'Check', label: 'Tier', description: 'd' },
    qualityScore: 80,
    uncertainties: [],
    topUncertainties: [],
    improvements: [],
    topImprovements: [],
    evidenceGaps: [],
    topEvidenceGaps: [],
    nextActions: [],
    topNextActions: [],
  } as unknown as ConfidenceSectionData

  const improvements: ImprovementsSectionData = {
    improvements: [],
    count: 0,
    hasHighPriority: false,
  } as ImprovementsSectionData

  return {
    recommendation,
    drivers,
    confidence,
    improvements,
    isLoading: false,
    isError: false,
    goalLabel: 'Maximise success',
    completeness: { status: 'full', missing: [], reasons: [] },
    autoNoiseProvenance: null,
  } as unknown as ResultsSectionDataReturn
}

/**
 * The shared obligation for every arm: the nudge MOUNTED, its surviving
 * Validate chip is present (positive control — the absence claim below is only
 * meaningful because this query, on this element, finds a chip), and the
 * retired Research CTA is gone by exact accessible name.
 */
function expectNudgeWithoutResearchCta(nudge: HTMLElement): void {
  // ── PRECONDITION / POSITIVE CONTROL ────────────────────────────────────
  // If the fixture ever stops clearing the dominance gate, or a refactor
  // drops the chip row wholesale, this REDs instead of letting the absence
  // assertion below pass by testing nothing.
  expect(nudge).toHaveTextContent('Dominant factor')
  expect(nudge).toHaveTextContent(DOMINANT_LABEL)
  expect(
    within(nudge).getByLabelText(VALIDATE_CTA_LABEL),
    'the sibling Validate chip must render, or this absence assertion is vacuous',
  ).toBeInTheDocument()

  // ── THE CLAIM ──────────────────────────────────────────────────────────
  expect(within(nudge).queryByLabelText(RESEARCH_CTA_LABEL)).toBeNull()
  expect(within(nudge).queryByRole('button', { name: 'Research' })).toBeNull()
}

function renderResultsBody() {
  return render(
    <ResultsBody
      resultsSectionData={makeData()}
      tornadoData={{ rows: [], expectedOutcome: null }}
      onFocusNode={() => {}}
      onSendMessage={() => {}}
    />,
  )
}

beforeEach(() => {
  useCanvasStore.setState({
    draftCoaching: null,
    analysisFreshness: null,
    analysisFreshnessDirty: false,
    results: { status: 'idle', progress: 0 },
    runMeta: null,
  } as never)
  useUIStore.setState({ activeOutputTab: 'results', activeOutputTabVersion: 0 })
})

afterEach(() => {
  cleanup()
})

describe('ROADMAP 2.816 — the dead-end Research CTA is retired from the results surface', () => {
  it('the cockpit nudge mounts and carries NO Research CTA', () => {
    renderResultsBody()

    // MOUNT-PATH PRECONDITION: the one host rendered, and the deleted fork
    // did not come back under another name.
    const heroArm = screen.getByTestId('hero-arm-triage-actions')
    expect(screen.queryByTestId('decision-confidence-panel')).toBeNull()

    const nudge = within(heroArm).getByTestId('t1-dominant-nudge')
    expectNudgeWithoutResearchCta(nudge)

    // And nowhere else in the tree either — a re-host is still a dead end.
    expect(screen.queryByLabelText(RESEARCH_CTA_LABEL)).toBeNull()
  })

  it('the cockpit host is the ONLY analysis host — the fork is gone', () => {
    renderResultsBody()

    // The point of this case has changed with the consolidation. It used to
    // prove the legacy arm was also clean; it now proves there IS no other
    // arm — nothing selects a different analysis, so the absence asserted
    // above is the absence every user gets.
    expect(screen.getByTestId('hero-arm-triage-actions')).toBeInTheDocument()
    expect(screen.queryByTestId('decision-confidence-panel')).toBeNull()

    expectNudgeWithoutResearchCta(screen.getByTestId('t1-dominant-nudge'))
    expect(screen.queryByLabelText(RESEARCH_CTA_LABEL)).toBeNull()
  })

  it('TriageActionCardsBody in legacy copy mode has NO Research CTA', () => {
    // The shared host, in the copy mode `ResultsBody`'s hero arm and the
    // legacy panel both use (`useV17Copy` false). v17 mode already suppressed
    // the chip, so testing only v17 proved nothing — this is the arm that
    // shipped it.
    //
    // Note what is NOT passed: `onSendMessage`. It was the chip's "chat is
    // available" gate and this component no longer declares it, so the chip
    // cannot be reinstated without re-threading a handler through two hosts —
    // the removal is structural, not just a deleted element.
    render(
      <TriageActionCardsBody
        data={makeData()}
        useV17Copy={false}
        onFocusNode={() => {}}
      />,
    )
    expectNudgeWithoutResearchCta(screen.getByTestId('t1-dominant-nudge'))
  })
})
