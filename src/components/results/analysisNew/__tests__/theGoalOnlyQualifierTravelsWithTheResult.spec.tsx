/**
 * ⭐ THE "GOAL ONLY" QUALIFIER TRAVELS WITH THE RESULT IT QUALIFIES — through a
 * later turn, a reload and a replacement (Codex pre-read on #1922, 5804383098;
 * the shared carrier is Canvas #1921, source-approved 5804795332).
 *
 * THE DEFECT. "How the options compare" said "Goal only: your limits aren't in
 * these shares." only while the session-local `analysisStateV1` envelope still
 * carried `leader_claim.withheld_reason === 'constraint_verdict_withheld'`. That
 * envelope is never persisted and is cleared by any turn that omits
 * `analysis_state`, so the SAME saved 81% / 17% / 2% came back bare after a
 * reload or an ordinary follow-up turn — reading as a ranking of the whole
 * decision.
 *
 * THE RULE UNDER TEST. The tab reads the producer's cause off the RESULT:
 * `results.report.producer_leader_permission.producer_cause`, only where that
 * stamp is an explicit refusal (`permitted === false`), never inferred from the
 * generic `withheld_reason` and never from the live envelope.
 *
 * ⭐ THE HARNESS IS THE PRODUCTION SEAM, NOT A FIXTURE PROP. `OutputsDock`
 * hands the tab `useResultsSectionData()` (`OutputsDock.tsx`), so `WiredTab`
 * below does the same: the shares on screen are the ones the store holds, and
 * the store is driven through the REAL chain — `applyV5State` → canvas store →
 * autosave (localStorage) → `restoreAnalysisFromAutosave` — the same chain
 * `canvas/__tests__/constraintCauseSurvivesReload.spec.ts` (#1921) witnesses
 * for the carrier itself.
 *
 * ⚠ THE V5 SHAPES BELOW MIRROR #1921's `constraintCauseSurvivesReload.spec.ts`.
 * They are not imported because a spec module registers its own tests when
 * imported. They are the contract shape (`AnalysisStateV1Schema` is `.strict()`),
 * and each test asserts its own PRECONDITION on the store rather than trusting
 * the mirror.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, within } from '@testing-library/react'
vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))
import { openAllSections } from './openNamedGroups'
import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { ANALYSIS_NEW_COPY as COPY, leaderWithholdCause } from '../analysisNewCopy'
import { useResultsSectionData } from '../../useResultsSectionData'
import { useCanvasStore } from '../../../../canvas/store'
import { loadAutosave } from '../../../../canvas/store/scenarios'
import { restoreAnalysisFromAutosave } from '../../../../canvas/store/restoreAnalysisFromAutosave'
import { applyV5State, type V5ApplicatorStore } from '../../../../v5/applyV5State'

const SCENARIO_ID = 'c475a0c1-fb3c-448e-b3ef-91ae5cd01f8d'
/** The exact token CEE sent on Paul's run (scenario 099b031f, 23 Sep). */
const LIMITS_UNSCORED = 'constraint_verdict_withheld'
const OTHER_REASON = 'separation_unavailable'
const TESTID = 'analysis-new-options'

// ── the wire, as #1921 drives it ────────────────────────────────────────────

const ANALYSIS_BLOCK = {
  type: 'analysis_result' as const,
  summary: 'Buy Freehold Unit Outright leads.',
  leading_option_id: 'opt_freehold',
  win_probabilities: { opt_freehold: 0.71, opt_relocate: 0.22 },
  enrichment: {
    robustness: { recommended_option_id: 'opt_freehold' },
    decision_brief: {
      headline_banded: { band: 'clearly_ahead', leader_option_id: 'opt_freehold' },
    },
    option_comparison: [
      { option_id: 'opt_freehold', option_label: 'Buy freehold', win_probability: 0.71 },
      { option_id: 'opt_relocate', option_label: 'Relocate', win_probability: 0.22 },
    ],
  },
}

function analysisState(permitted: boolean, withheldReason: string) {
  return {
    run_state: { kind: 'complete_current', computed_at: '2026-09-04T10:00:00Z' },
    readiness: { status: 'ready', blockers: [] },
    leader_claim: permitted ? { permitted: true } : { permitted: false, withheld_reason: withheldReason },
    robustness: {},
    usable_for_prose: permitted,
    usable_for_chips: permitted,
    usable_for_followup: permitted,
    requires_rerun: !permitted,
    blocked_unusable: false,
    contradictions: [],
  }
}

function analysisTurn(permitted: boolean, withheldReason = LIMITS_UNSCORED, block: object = ANALYSIS_BLOCK) {
  return {
    response_version: 2,
    assistant_text: '',
    blocks: [block],
    suggested_actions: [],
    insights: [],
    stage_indicator: 'analyse',
    analysis_state: analysisState(permitted, withheldReason),
  } as never
}

/** An ordinary follow-up turn: no analysis block, and NO `analysis_state`. */
const IDEATION_TURN = {
  response_version: 2,
  assistant_text: 'Another idea to consider.',
  blocks: [],
  suggested_actions: [],
  insights: [],
  stage_indicator: 'ideate',
} as never

/** The applicator store, built from the REAL canvas store — not a double. */
function realApplicatorStore(): V5ApplicatorStore {
  const s = useCanvasStore.getState()
  return {
    setCurrentStage: s.setCurrentStage,
    updateNode: s.updateNode,
    updateEdgeData: s.updateEdgeData,
    setRunMeta: s.setRunMeta,
    setCeeAnalysisReady: s.setCeeAnalysisReady,
    setAnalysisFreshness: s.setAnalysisFreshness,
    setAnalysisStateV1: s.setAnalysisStateV1,
    resultsComplete: s.resultsComplete,
    resultsWithholdLeaderClaim: s.resultsWithholdLeaderClaim,
    resultsRestoreLeaderClaim: s.resultsRestoreLeaderClaim,
    nodes: s.nodes,
    edges: s.edges,
    currentResultsHash: s.results.hash ?? null,
  } as V5ApplicatorStore
}

const applyTurn = (response: never) => act(() => { applyV5State(response, realApplicatorStore()) })

/** Everything a reload destroys: a brand-new page load. */
function simulateReturnToAFreshPage(): void {
  useCanvasStore.setState({
    results: { status: 'idle', progress: 0 },
    hasCompletedFirstRun: false,
    analysisStateV1: null,
  } as never)
}

// ── store reads, for PRECONDITIONS only ─────────────────────────────────────

type Stamp = { permitted?: boolean; withheld_reason?: string; producer_cause?: string }
const stamp = (): Stamp | undefined =>
  (useCanvasStore.getState().results.report as { producer_leader_permission?: Stamp } | null | undefined)
    ?.producer_leader_permission
const liveEnvelope = () => useCanvasStore.getState().analysisStateV1 ?? null

// ── the production seam ─────────────────────────────────────────────────────

/** What `OutputsDock` mounts: the tab fed by `useResultsSectionData()`. */
function WiredTab() {
  const data = useResultsSectionData()
  const hash = useCanvasStore((s) => s.results.hash ?? undefined)
  return (
    <AnalysisNewTabBody
      resultsSectionData={data}
      isPreRun={false}
      isRunning={false}
      isStale={false}
      responseHash={hash}
    />
  )
}

function mountTab() {
  render(<WiredTab />)
  openAllSections()
}

const qualifier = () => screen.queryByTestId(`${TESTID}-goal-only`)

/** PRECONDITION for every "no qualifier" assertion: the shares ARE on screen,
 *  so an absent line is the rule working, not an empty section. */
function expectSharesOnScreen() {
  const section = screen.getByTestId(TESTID)
  // ⚠ V2 (Reasoning V2, #1925): win shares left this section's resting view
  // (they live in "About this analysis"), so a '%' on screen no longer proves
  // the section is describing figures. What the precondition guards is
  // unchanged: the analysed options are on screen, and the section is NOT in
  // its no-figures state, so the qualifier is the line that must speak.
  expect(within(section).getAllByTestId('analysis-new-options-row').length, 'PRECONDITION: options on screen').toBeGreaterThan(0)
  expect(within(section).queryByTestId('analysis-new-options-no-figures'), 'PRECONDITION: not the no-figures state').toBeNull()
}

/**
 * The qualifier sits on the figures, and the producer's cause is said ONCE in
 * the section that holds both: "What remains uncertain" states it, so the
 * qualifier below does not append it again. Served V2 (c3a39ae7, scenario
 * 3d00c023) printed the cause twice at rest, a few lines apart.
 */
function expectQualified() {
  expectSharesOnScreen()
  const line = qualifier()
  expect(line, 'the "Goal only" qualifier is missing').not.toBeNull()
  expect(line!.textContent).toContain(COPY.optionFigures.goalOnlyQualifier)
  const cause = leaderWithholdCause(LIMITS_UNSCORED) as string
  const zone = screen.getByTestId('analysis-new-commitment')
  expect(zone.textContent!.split(cause).length - 1, 'the cause is said once in "Move towards commitment"').toBe(1)
  expect(screen.getByTestId('analysis-new-commitment-open-text').textContent).toBe(cause)
}

beforeEach(() => {
  localStorage.clear()
  useCanvasStore.setState({
    nodes: [
      { id: 'opt_freehold', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Buy freehold', kind: 'option' } },
      { id: 'opt_relocate', type: 'option', position: { x: 200, y: 0 }, data: { label: 'Relocate', kind: 'option' } },
    ],
    edges: [],
    results: { status: 'idle', progress: 0 },
    hasCompletedFirstRun: false,
    analysisStateV1: null,
    analysisFreshnessDirty: false,
    currentScenarioId: SCENARIO_ID,
  } as never)
})

afterEach(() => {
  cleanup()
  localStorage.clear()
  useCanvasStore.setState({ analysisStateV1: null, results: { status: 'idle', progress: 0 } } as never)
})

describe('the qualifier is read off the RESULT, not the session envelope', () => {
  it('⭐ (a) the cause is on the result and there is NO live envelope → the qualifier shows', () => {
    applyTurn(analysisTurn(false, LIMITS_UNSCORED))
    useCanvasStore.setState({ analysisStateV1: null } as never)
    expect(liveEnvelope(), 'PRECONDITION: no live envelope').toBeNull()
    expect(stamp()?.permitted, 'PRECONDITION: the result carries a refusal').toBe(false)
    expect(stamp()?.producer_cause, 'PRECONDITION: …with the producer cause').toBe(LIMITS_UNSCORED)

    mountTab()
    expectQualified()
  })

  it('⭐ (b) a later turn clears the live envelope while the result is unchanged → the qualifier stays', () => {
    applyTurn(analysisTurn(false, LIMITS_UNSCORED))
    const heldHash = useCanvasStore.getState().results.hash
    mountTab()
    expectQualified()

    applyTurn(IDEATION_TURN)
    expect(liveEnvelope(), 'PRECONDITION: the later turn really cleared the envelope').toBeNull()
    expect(useCanvasStore.getState().results.hash, 'PRECONDITION: the same result is displayed').toBe(heldHash)
    expectQualified()
  })

  it('⭐ (c) save → fresh page → restore from autosave → the qualifier shows on the restored shares', () => {
    applyTurn(analysisTurn(false, LIMITS_UNSCORED))
    act(() => simulateReturnToAFreshPage())
    expect(useCanvasStore.getState().results.report ?? null, 'PRECONDITION: the reload really emptied it').toBeNull()

    act(() => { restoreAnalysisFromAutosave(loadAutosave(), useCanvasStore.getState().resultsLoadHistorical) })
    expect(liveEnvelope(), 'PRECONDITION: no live envelope after a reload').toBeNull()
    expect(stamp()?.producer_cause, 'PRECONDITION: the cause came back with the result').toBe(LIMITS_UNSCORED)

    mountTab()
    expectQualified()
  })

  it('⛔ (d) the result is REPLACED by a permitted one → the qualifier goes', () => {
    applyTurn(analysisTurn(false, LIMITS_UNSCORED))
    mountTab()
    expectQualified()

    const nextRun = { ...ANALYSIS_BLOCK, summary: 'A new run.', win_probabilities: { opt_freehold: 0.6, opt_relocate: 0.4 } }
    applyTurn(analysisTurn(true, LIMITS_UNSCORED, nextRun))
    expect(stamp(), 'PRECONDITION: the replacement carries no refusal').toBeUndefined()
    expectSharesOnScreen()
    expect(qualifier()).toBeNull()
  })

  it('⛔ (e) withheld for a DIFFERENT reason → no qualifier (the reason is carried as itself)', () => {
    applyTurn(analysisTurn(false, OTHER_REASON))
    expect(stamp()?.permitted, 'PRECONDITION: withheld').toBe(false)
    expect(stamp()?.producer_cause, 'PRECONDITION').toBe(OTHER_REASON)
    mountTab()
    expectSharesOnScreen()
    expect(qualifier()).toBeNull()
  })
})

describe('nothing is inferred', () => {
  it('⛔ a generic refusal stamp with NO producer cause (a report saved before #1921) → no qualifier', () => {
    applyTurn(analysisTurn(false, LIMITS_UNSCORED))
    const report = useCanvasStore.getState().results.report as unknown as Record<string, unknown>
    act(() => {
      useCanvasStore.setState((s) => ({
        results: { ...s.results, report: { ...report, producer_leader_permission: { permitted: false, withheld_reason: 'leader_claim_withheld' } } },
        analysisStateV1: null,
      }) as never)
    })
    expect(stamp()?.withheld_reason, 'PRECONDITION: the generic stamp is there').toBe('leader_claim_withheld')
    mountTab()
    expectSharesOnScreen()
    expect(qualifier()).toBeNull()
  })

  // A contrast, not a discriminator of the hook's own permission check: on a
  // permitting stamp the builder's `leaderCode` also stops the line.
  it('⛔ a stamp that does not refuse (`permitted: true`) carrying a cause → no qualifier', () => {
    applyTurn(analysisTurn(false, LIMITS_UNSCORED))
    const report = useCanvasStore.getState().results.report as unknown as Record<string, unknown>
    act(() => {
      useCanvasStore.setState((s) => ({
        results: { ...s.results, report: { ...report, producer_leader_permission: { permitted: true, producer_cause: LIMITS_UNSCORED } } },
        analysisStateV1: null,
      }) as never)
    })
    mountTab()
    expectSharesOnScreen()
    expect(qualifier()).toBeNull()
  })

  /**
   * ⭐ THE INVERSE, AND THE ONE CASE WHERE THIS CHANGE REMOVES A LINE #1922
   * WOULD HAVE SHOWN. The leader IS withheld on the result (a generic stamp, as
   * a report saved before #1921 carries), and the live envelope names the
   * limits — but nothing binds that envelope to THIS result. Same contrast as
   * the canvas card's (`OptionNode.shareGoalOnlyWhenLimitsWithheld.spec.tsx`),
   * so the two surfaces agree.
   */
  it('⛔ a live envelope naming the limits, but the RESULT carries no cause → no qualifier (the tab reads the result, not the session)', () => {
    applyTurn(analysisTurn(false, LIMITS_UNSCORED))
    const report = useCanvasStore.getState().results.report as unknown as Record<string, unknown>
    act(() => {
      useCanvasStore.setState((s) => ({
        results: { ...s.results, report: { ...report, producer_leader_permission: { permitted: false, withheld_reason: 'leader_claim_withheld' } } },
      }) as never)
    })
    expect(liveEnvelope()?.leader_claim, 'PRECONDITION: the live envelope names the limits cause')
      .toEqual({ permitted: false, withheld_reason: LIMITS_UNSCORED })
    expect(stamp()?.permitted, 'PRECONDITION: the leader is withheld on the result').toBe(false)
    expect(stamp()?.producer_cause, 'PRECONDITION: …with no cause carried').toBeUndefined()
    mountTab()
    expectSharesOnScreen()
    expect(qualifier()).toBeNull()
  })
})
