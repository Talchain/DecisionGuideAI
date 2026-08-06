/**
 * ResultsBody — staleness must not switch OFF a mutation affordance
 * (ROADMAP 2.651, the UI half of Paul's Ruling 3; design §3.3.2 lock U1).
 *
 * THE RULING. The graph is always editable. Staleness is a DISPLAYED PROPERTY
 * of results — "Model changed since this analysis. Re-run to update." — and
 * never a lock on what the user may do. CEE #834 built that server-side; this
 * file pins the consumer half.
 *
 * WHAT THE LOCK WAS. `ResultsBody` derived
 *   const suppressMutations = isStale || isRunning
 * and withheld `onConfirmFactor` / `onSetFactorValue` from the triage cards.
 * Because `isStale` is OutputsDock's `analysisNotConfirmedFresh` (displayed
 * 'stale' OR 'unknown'), and ANY analysis-affecting local edit downgrades a
 * retained 'fresh' verdict to 'unknown' (`resolveDisplayedFreshness`), the
 * user's FIRST edit switched "Confirm AI estimate" — pillar P4's
 * human-confirms-the-AI affordance — off for the rest of the session.
 *
 * WHAT SURVIVES. The `isRunning` limb. Committing a factor edit against a
 * display whose run is being replaced is a genuine hazard and is NOT what the
 * ruling retires. The mutant pair below proves the two limbs are independently
 * bound: restoring the stale limb REDs only the stale tests; deleting the
 * running limb REDs only the running test.
 *
 * ⚠ SURFACE BINDING (CLAUDE.md trap 3b) — READ BEFORE ADDING A CASE.
 * `netlify.toml` `[context.staging.environment]` sets
 * `VITE_FEATURE_ANALYSIS_HERO_PANEL = "1"`, and ResultsBody mounts the triage
 * surfaces that carry this affordance (`AnalysisHeroV17` /
 * `DecisionConfidencePanel`) ONLY inside its `!isAnalysisHeroPanelEnabled()`
 * arm. So on DEPLOYED STAGING this affordance does not render at all — the
 * arm under test here is the flag-OFF one (the `defaultValue: false` posture:
 * local dev, and production, which does not inherit the staging context).
 * The last test asserts that mount fork in BOTH directions so this file can
 * never quietly become a test about a component no deployment renders, and so
 * it fails loud the day the flag moves.
 *
 * ⚠ SCOPE (CLAUDE.md trap 3): DOM-presence and handler-call assertions only.
 * Nothing here claims anything about layout, visibility or the fold.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { ResultsBody } from '../ResultsBody'
import type { ResultsSectionDataReturn } from '../useResultsSectionData'
import type {
  ConfidenceSectionData,
  DecisionResultData,
  DriversSectionData,
  EvidenceGapItem,
  ImprovementsSectionData,
  OptionResult,
} from '../types'

vi.mock('../../../canvas/utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusByTarget: vi.fn(),
  focusExistingTarget: vi.fn(),
  focusModelTarget: vi.fn(() => true),
}))

vi.mock('@/flags', async () => {
  const actual = await vi.importActual<typeof import('@/flags')>('@/flags')
  return {
    ...actual,
    isAnalysisHeroV17Enabled: vi.fn(() => false),
    isAnalysisHeroCompareEnabled: vi.fn(() => false),
    isFocusNowPanelEnabled: vi.fn(() => true),
    isAiPanelV2Enabled: vi.fn(() => true),
    isAnalysisHeroPanelEnabled: vi.fn(() => false),
  }
})

import { isAnalysisHeroPanelEnabled } from '@/flags'
import { useCanvasStore } from '@/canvas/store'
import { useUIStore } from '@/stores/uiStore'

/**
 * The one factor this spec is about, named once. Every assertion below binds
 * to THIS id — never to "a card with an editor" or "the first confirm button"
 * (CLAUDE.md trap 19: an assertion must bind to its object by identity, never
 * by a predicate another object could satisfy). The handler-call assertions
 * check the argument, which is the strongest identity binding available: only
 * this card can produce this id.
 */
const TARGET_NODE_ID = 'node_underinformed_factor'
const TARGET_LABEL = 'Ramp-up time'

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

  /**
   * An evidence gap is what mints a triage card carrying the inline value
   * editor + "Confirm AI estimate" (`mapEvidenceGapsToActions` →
   * `TriageCard` → `InlineValueControls`). `targetNodeId` is the id the
   * confirm handler must receive.
   */
  const gap: EvidenceGapItem = {
    factorId: 'fac_ramp',
    factorLabel: TARGET_LABEL,
    confidence: 40,
    voi: 0.5,
    suggestion: 'This estimate is the AI’s, not yours.',
    targetNodeId: TARGET_NODE_ID,
  }

  const confidence = {
    tier: { tier: 'strong', icon: 'Check', label: 'Tier', description: 'd' },
    qualityScore: 80,
    uncertainties: [],
    topUncertainties: [],
    improvements: [],
    topImprovements: [],
    evidenceGaps: [gap],
    topEvidenceGaps: [gap],
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

interface Handlers {
  onConfirmFactor: ReturnType<typeof vi.fn>
  onSetFactorValue: ReturnType<typeof vi.fn>
}

function renderBody(props: { isStale?: boolean; isRunning?: boolean } = {}): Handlers {
  const onConfirmFactor = vi.fn()
  const onSetFactorValue = vi.fn()
  render(
    <ResultsBody
      resultsSectionData={makeData()}
      tornadoData={{ rows: [], expectedOutcome: null }}
      onSendMessage={() => {}}
      onConfirmFactor={onConfirmFactor}
      onSetFactorValue={onSetFactorValue}
      nodeValueLookup={{
        [TARGET_NODE_ID]: { value: 12, unit: 'weeks', cap: null },
      }}
      isStale={props.isStale}
      isRunning={props.isRunning}
    />,
  )
  return { onConfirmFactor, onSetFactorValue }
}

/**
 * The triage card for THIS factor, by identity — scoped to the triage queue
 * (the factor's label also appears in the v7 sharpen line, which carries no
 * affordance) and then narrowed to the enclosing card element. A second card
 * appearing later cannot satisfy these assertions by accident, and the
 * handler-argument checks pin the identity a second time at the call.
 */
function targetCard(): HTMLElement {
  const queue = screen.getByTestId('unified-triage-queue')
  const label = within(queue).getByText(TARGET_LABEL)
  const card = label.closest('[data-testid^="unified-triage-"]') as HTMLElement | null
  expect(card, `no triage card found for "${TARGET_LABEL}"`).not.toBeNull()
  return card!
}

describe('ResultsBody — staleness never switches off a mutation affordance (2.651 / U1)', () => {
  beforeEach(() => {
    vi.mocked(isAnalysisHeroPanelEnabled).mockReturnValue(false)
    useCanvasStore.setState({
      analysisFreshness: null,
      analysisFreshnessDirty: false,
      draftCoaching: null,
    })
    useUIStore.setState({ activeOutputTab: 'results', activeOutputTabVersion: 0 })
  })

  /**
   * CONTROL (CLAUDE.md trap 13). Every "the affordance is present" assertion
   * below is worthless unless this fixture can render the affordance at all.
   * This proves a PRESENCE before anything asserts one, and it doubles as the
   * fresh-results baseline invariant (c) compares the stale case against.
   */
  it('control — on CURRENT results the affordance renders and confirms this factor by id', () => {
    const { onConfirmFactor } = renderBody({ isStale: false, isRunning: false })
    const confirm = within(targetCard()).getByRole('button', { name: 'Confirm AI estimate' })
    fireEvent.click(confirm)
    expect(onConfirmFactor).toHaveBeenCalledTimes(1)
    expect(onConfirmFactor).toHaveBeenCalledWith(TARGET_NODE_ID)
  })

  /**
   * RED at pristine. This is the user's first edit: any analysis-affecting
   * change downgrades the retained 'fresh' verdict to 'unknown', OutputsDock
   * turns that into `isStale`, and P4's confirm button vanished for the rest
   * of the session.
   */
  it('after an edit makes results stale, "Confirm AI estimate" is STILL offered', () => {
    renderBody({ isStale: true, isRunning: false })
    expect(
      within(targetCard()).getByRole('button', { name: 'Confirm AI estimate' }),
    ).toBeInTheDocument()
  })

  /**
   * Invariant (c): it does not merely RENDER — the confirmation LANDS, with
   * the same argument the fresh-results control asserts. A button that draws
   * but reports nothing would satisfy presence and still fail the user.
   */
  it('on stale results the confirmation lands exactly as it does on fresh results', () => {
    const { onConfirmFactor } = renderBody({ isStale: true, isRunning: false })
    fireEvent.click(within(targetCard()).getByRole('button', { name: 'Confirm AI estimate' }))
    expect(onConfirmFactor).toHaveBeenCalledTimes(1)
    expect(onConfirmFactor).toHaveBeenCalledWith(TARGET_NODE_ID)
  })

  /**
   * The value editor is the same withheld pair (`onSetFactorValue` feeds
   * `editorConfig`, whose absence removes the whole inline control, not just
   * the confirm icon). Staleness must not remove the user's ability to
   * override the AI's number either — that is the other half of P4.
   */
  it('on stale results the inline value editor still commits an override', () => {
    const { onSetFactorValue } = renderBody({ isStale: true, isRunning: false })
    const card = targetCard()
    const input = within(card).getByRole('spinbutton', { name: `Value for ${TARGET_LABEL}` })
    fireEvent.change(input, { target: { value: '20' } })
    fireEvent.click(within(card).getByRole('button', { name: 'Edit value' }))
    expect(onSetFactorValue).toHaveBeenCalledWith(TARGET_NODE_ID, 20)
  })

  /**
   * ⭐ THE LIMB THAT SURVIVES, byte-identically. Mid-run suppression is not
   * what the ruling retires: committing a factor edit against a display whose
   * run is being replaced is a real hazard. This test must be GREEN before
   * AND after the change, and the mutant pair proves it is bound to the
   * RUNNING limb specifically rather than passing because everything is open.
   */
  it('while a run is IN FLIGHT the mutation affordances stay suppressed', () => {
    renderBody({ isStale: false, isRunning: true })
    expect(
      within(targetCard()).queryByRole('button', { name: 'Confirm AI estimate' }),
    ).not.toBeInTheDocument()
    expect(
      within(targetCard()).queryByRole('spinbutton', { name: `Value for ${TARGET_LABEL}` }),
    ).not.toBeInTheDocument()
  })

  it('stale AND running still suppresses — the surviving limb is not weakened by the other', () => {
    renderBody({ isStale: true, isRunning: true })
    expect(
      within(targetCard()).queryByRole('button', { name: 'Confirm AI estimate' }),
    ).not.toBeInTheDocument()
  })

  /**
   * ⚠ TRAP 3b — THE MOUNT FORK ITSELF, ASSERTED IN BOTH DIRECTIONS.
   *
   * Asserted here so this file states its own scope as an executable fact
   * rather than a comment that can rot. Flag OFF, the triage surface mounts
   * and everything above is a real claim. Flag ON — the DEPLOYED STAGING
   * posture per `netlify.toml` — the analysis-hero arm replaces it and
   * carries no triage confirm affordance at all, so nothing above describes
   * what a staging user currently sees.
   *
   * If the flag is ever promoted, retired, or inverted, this test goes RED
   * and forces the question rather than leaving a green suite pointed at a
   * component the deployment does not render.
   */
  it('mount fork — flag OFF (default / production posture) mounts the triage surface that carries this affordance', () => {
    vi.mocked(isAnalysisHeroPanelEnabled).mockReturnValue(false)
    renderBody({ isStale: false, isRunning: false })
    expect(screen.getByTestId('decision-confidence-panel')).toBeInTheDocument()
    expect(screen.getByTestId('unified-triage-queue')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirm AI estimate' })).toBeInTheDocument()
  })

  it('mount fork — flag ON (the DEPLOYED STAGING posture) replaces it with the hero arm, which carries NO confirm affordance', () => {
    vi.mocked(isAnalysisHeroPanelEnabled).mockReturnValue(true)
    renderBody({ isStale: false, isRunning: false })
    expect(screen.getByTestId('analysis-hero-panel')).toBeInTheDocument()
    expect(screen.queryByTestId('decision-confidence-panel')).not.toBeInTheDocument()
    expect(screen.queryByTestId('unified-triage-queue')).not.toBeInTheDocument()
    // The corrected premise of ROADMAP 2.651, as an executable fact: on
    // staging this affordance does not render, so the U1 lock currently gates
    // a surface no staging user reaches. Promoting/retiring the flag REDs this.
    expect(screen.queryByRole('button', { name: 'Confirm AI estimate' })).not.toBeInTheDocument()
  })
})
