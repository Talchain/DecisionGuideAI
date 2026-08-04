/**
 * ResultsBody — MOUNT-PATH PROOF AT THE DEPLOYED FLAG VALUES (ROADMAP 2.466).
 *
 * ## Why this spec exists, stated bluntly
 *
 * Lane 1's DSK grounding badge shipped DARK three layers deep: it was hosted
 * on the V17 hero, which mounts only when `analysisHeroPanel` is OFF — and
 * staging deploys `VITE_FEATURE_ANALYSIS_HERO_PANEL=1`. jsdom specs at
 * default flag values proved the component worked while the deployed posture
 * never mounted it. This spec is the named check that failure class demands:
 * it proves the key-question surface renders ON THE DEPLOYED POSTURE
 * (analysisHeroPanel=1), fed by a REAL captured V5 analysis turn driven
 * through the REAL applicator into the REAL canvas store.
 *
 * ## Flag injection — through the flag system's own seam, NOT a mock
 *
 * `vi.mock('@/flags')` would prove the mock, not the posture. `makeFlag`
 * (flagFactory.ts:58-92) checks localStorage AT CALL TIME before the env
 * snapshot, and `'1'`/`'0'` resolve through the same truthiness the deployed
 * `VITE_FEATURE_ANALYSIS_HERO_PANEL=1` uses — so
 * `localStorage.setItem('feature.analysisHeroPanel', '1')` exercises the real
 * `isAnalysisHeroPanelEnabled` end to end. A parity assertion below pins that
 * the injection actually flips the real function.
 *
 * ## The fixture is the live wire
 *
 * `live-analysis-turn-walkA-2026-08-04.json` is the verbatim body of a real
 * staging analysis turn captured by the walk-train audit (runA, rerun turn) —
 * 13 blocks, blocks[0].enrichment.decision_review.decision_quality_prompts
 * carrying DSK-T-002/strong + DSK-T-003/medium. Identity-bound assertions use
 * ITS exact strings; it is pinned to that historical capture and must never
 * be refreshed to track a current payload.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { ResultsBody } from '../ResultsBody'
import type { ResultsSectionDataReturn } from '../useResultsSectionData'
import type {
  ConfidenceSectionData,
  DecisionResultData,
  DriversSectionData,
  ImprovementsSectionData,
  OptionResult,
} from '../types'
import { isAnalysisHeroPanelEnabled } from '@/flags'
import { useCanvasStore } from '@/canvas/store'
import { useUIStore } from '@/stores/uiStore'
import { applyV5State } from '../../../v5/applyV5State'
import walkTurnFixture from '../../../v5/__tests__/fixtures/live-analysis-turn-walkA-2026-08-04.json'

vi.mock('../../../canvas/utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusByTarget: vi.fn(),
  focusExistingTarget: vi.fn(),
  focusModelTarget: vi.fn(() => true),
}))

// ── The walk turn's OWN strings — identity anchors, never paraphrased ──────
const WALK_Q1 =
  'What external data would most shift your confidence in the Self-Serve Product Tier as a growth channel?'
const WALK_Q1_PRINCIPLE = 'Outside view and reference class forecasting'

/** Strip the fixture's provenance keys; what remains is the captured turn. */
const PROVENANCE_KEYS = ['__source__', '__captured_at__', '__captured_against__', '__notes__']
function walkTurn(): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(walkTurnFixture as Record<string, unknown>).filter(
      ([k]) => !PROVENANCE_KEYS.includes(k),
    ),
  )
}

/**
 * Drive the REAL applicator exactly as useConversation.ts:4532-4551 does: a
 * spread of the live store's getState() plus the spliced currentResultsHash.
 * No staleness options — same as the historical no-gating behaviour the
 * applicator documents for callers that omit them.
 */
function applyWalkTurnToRealStore(): void {
  const s = useCanvasStore.getState()
  applyV5State(walkTurn() as never, {
    ...s,
    currentResultsHash: s.results?.hash ?? null,
  } as never)
}

/** Minimal completed-analysis VM stub — same pattern as heroPlacement's makeData. */
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
  const runnerUp = {
    id: 'opt_b',
    label: 'Option B',
    expected: 0.4,
    outcome: { mean: 0.4, p10: 0.2, p50: 0.38, p90: 0.6 },
    p10: 0.2,
    p50: 0.38,
    p90: 0.6,
    isRecommended: false,
    winProbability: 0.3,
    goalProbability: 0.3,
  } as unknown as OptionResult
  const recommendation = {
    recommendedOption: winner,
    allOptions: [winner, runnerUp],
    goalLabel: 'Maximise success',
    goalThreshold: 0.6,
    isSingleOption: false,
    analysisStatus: 'computed',
    recommendationStability: 0.92,
    robustnessLevel: 'high',
    isNormalised: false,
    coachingReadiness: 'ready',
    coachingReadinessDimensions: { evidence: 0.8, robustness: 0.75, clarity: 0.85 },
  } as DecisionResultData
  const drivers: DriversSectionData = {
    drivers: [],
    topDrivers: [],
    driversStatus: 'computed',
    totalCount: 0,
    hasMagnitudeData: false,
  }
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

function renderBody() {
  return render(
    <ResultsBody
      resultsSectionData={makeData()}
      tornadoData={{ rows: [], expectedOutcome: null }}
      onSendMessage={() => {}}
    />,
  )
}

describe('2.466 mount-path proof — deployed posture (analysisHeroPanel=1), live turn data', () => {
  beforeEach(() => {
    localStorage.removeItem('feature.analysisHeroPanel')
    useCanvasStore.setState({
      analysisFreshness: null,
      analysisFreshnessDirty: false,
      results: { status: 'idle', progress: 0 },
      runMeta: null,
    } as never)
    useUIStore.setState({ activeOutputTab: 'results', activeOutputTabVersion: 0 })
  })
  afterEach(() => {
    localStorage.removeItem('feature.analysisHeroPanel')
    cleanup()
  })

  it('POSITIVE CONTROL — the real applicator lands the walk turn DQP in runMeta.decisionReview030', () => {
    // Proves the spec can SEE the data before asserting anything renders
    // (trap 13): fixture → readDecisionReviewWireState → setRunMeta, all real.
    applyWalkTurnToRealStore()
    const review = useCanvasStore.getState().runMeta?.decisionReview030
    expect(review, 'walk turn must classify v0_30 and reach runMeta').toBeTruthy()
    const prompts = (review as unknown as { decision_quality_prompts: unknown[] })
      .decision_quality_prompts
    expect(prompts).toHaveLength(2)
    expect((prompts[0] as Record<string, unknown>).dsk_claim_id).toBe('DSK-T-002')
    expect((prompts[0] as Record<string, unknown>).question).toBe(WALK_Q1)
    expect((prompts[1] as Record<string, unknown>).dsk_claim_id).toBe('DSK-T-003')
  })

  it('flag injection parity — localStorage "1" flips the REAL isAnalysisHeroPanelEnabled', () => {
    expect(isAnalysisHeroPanelEnabled()).toBe(false)
    localStorage.setItem('feature.analysisHeroPanel', '1')
    expect(isAnalysisHeroPanelEnabled()).toBe(true)
  })

  it('DEPLOYED POSTURE: flag ON + live walk turn ⇒ the key question and its DSK grounding RENDER', () => {
    localStorage.setItem('feature.analysisHeroPanel', '1')
    applyWalkTurnToRealStore()
    renderBody()

    // The lens-hero arm is active (the V17/legacy slot must NOT mount).
    expect(screen.queryByTestId('decision-confidence-panel')).toBeNull()

    // The card, fed from the live turn — identity-bound to the walk's own strings.
    expect(screen.getByTestId('key-question-card')).toBeInTheDocument()
    expect(screen.getByTestId('key-question-text')).toHaveTextContent(WALK_Q1)

    const grounding = screen.getByTestId('dsk-grounding')
    expect(grounding).toHaveAttribute('data-dsk-claim-id', 'DSK-T-002')
    expect(grounding).toHaveAttribute('data-dsk-protocol-id', 'DSK-P-002')
    expect(grounding.textContent).toBe(
      `Grounded in: ${WALK_Q1_PRINCIPLE} · strong evidence`,
    )

    // Exactly ONE grounding surface in the whole document — no double render.
    expect(document.querySelectorAll('[data-testid="dsk-grounding"]')).toHaveLength(1)
  })

  it('INVERSE CONTROL: flag OFF ⇒ the V17/legacy arm mounts and this surface does not', () => {
    localStorage.setItem('feature.analysisHeroPanel', '0')
    applyWalkTurnToRealStore()
    renderBody()

    // The legacy arm proves which branch we are in (V17 flag itself defaults
    // off, so the legacy DecisionConfidencePanel is the slot's occupant).
    expect(screen.getByTestId('decision-confidence-panel')).toBeInTheDocument()
    expect(screen.queryByTestId('key-question-card')).toBeNull()
    // And no grounding line renders ANYWHERE at flag-off: the V17 card's
    // legacy feed (m1ReviewAssumptions + reviewStatus) is absent on a live V5
    // turn — that is precisely the dark-ship this lane re-hosts around.
    expect(document.querySelectorAll('[data-testid="dsk-grounding"]')).toHaveLength(0)
  })
})
