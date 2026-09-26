/**
 * ⭐ A FACTOR CARD'S RUN CUES TAKE BOTH THEIR VISIBILITY AND THEIR LABEL FROM
 * ONE COMPOSED CURRENCY VERDICT (Codex EARLY_REVIEW, #63 5801431996).
 *
 * The defect: `FactorNode` decided whether the driver line and turning point
 * show from the local-only `useAnalysisResultsAreCurrent() ||
 * useModelChangedSinceRun()`, but labelled them `Last run ·` from the composed
 * verdict alone. The composed selector gives CEE's `analysis_state` priority
 * (`analysisStateSelector.ts`), and `refused` / `unknown_degraded` both mean
 * cannot-confirm. With a retained complete report and locally fresh fields,
 * those wire verdicts left an UNQUALIFIED cue on the card, so an unconfirmed
 * finding read as current knowledge about the person's model.
 *
 * The rule (one verdict, `useRunCurrency()`):
 *   · `current`     → cues shown, unqualified;
 *   · `changed`     → cues shown, `Last run ·` in visible and accessible copy;
 *   · `unconfirmed` → no run cue on the card (the report stays reachable in
 *                     its own results surface);
 *   · `none`        → no run cue.
 *
 * ⚠ THE DISCRIMINATING CONTROL: everything except the wire's run-state kind is
 * held constant — one completed report, locally fresh fields, a compatible-units
 * `flip_reason: 'found'` entry. `staleRun.labelsLastRun.spec` seeds
 * `analysisStateV1: null`, so it cannot see this conflict.
 *
 * ⭐ RE-POINTED FOR THE BOUNDED ANATOMY (ED #63 5809278282, 24 Sep): in the
 * Standard view both cues moved off the card body into the factor's popover,
 * so the shown cases bind them INSIDE the popover (and absent from the face),
 * and the withheld cases stay document-wide — which now covers the popover.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { FactorNode } from '../FactorNode'
import { useCanvasStore } from '../../store'
import { useAnalysisTrust } from '../../hooks/useAnalysisTrust'
import { useNodeAttention } from '../shared/useNodeAttention'
import { useInfluenceRank } from '../../hooks/useInfluenceRank'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

let displayMetadata: Record<string, unknown> = {}
vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => displayMetadata),
}))

// ED 5809278282: the cues live in the Standard popover — transparent and
// identity-bearing, so its content is observable and absences cover it.
vi.mock('../shared/NodePopover', () => ({
  NodePopover: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="factor-node-popover">{children}</div>
  ),
}))
const face = () => screen.getByTestId('node-title').closest('[role="group"]') as HTMLElement
/** A run cue: ON the card face, never repeated in the popover (prototype, Paul 25 Sep; superseding ED 5809278282). */
const cue = (testId: string) => {
  const pop = screen.queryByTestId('factor-node-popover')
  if (pop) expect(within(pop).queryByTestId(testId), `${testId} is repeated in the popover`).toBeNull()
  return within(face()).getByTestId(testId)
}

const FACTOR_ID = 'fac_hiring_speed'
const UNVALUED = { label: 'Hiring speed', type: 'factor', category: 'external' }

const RANKED = {
  sensitivityRank: 1, influence: 1, influenceProvenance: 'normalised_elasticity',
  // Contract v3.1 pt 5: the printed M is the ranked count (3), not the set (5).
  influenceImportanceBasis: null, influenceSetSize: 5, influenceRankedCount: 3, confidence: null,
  confidenceIsDefaulted: false, confidenceIsProvisional: false, inSensitivityAnalysis: true,
  achievementProbability: null, achievementProbabilityIsModelledBasis: false,
  stabilityPercentage: null, winRate: null, isResultsMode: true, predictedOutcome: null,
  valueOfInformation: null, voiRank: null,
}

const seed = (wireKind: string | null) => {
  useCanvasStore.setState({
    nodes: [{ id: FACTOR_ID, type: 'factor', position: { x: 0, y: 0 }, data: UNVALUED }],
    edges: [], ceeAnalysisReady: null, viewMode: 'standard', lodRung: 'full',
    // THE ONE VARIABLE.
    analysisStateV1: wireKind === null ? null : {
      // A complete, schema-shaped envelope (as `mergeServerGraph.starterReload.spec` seeds one);
      // only `run_state.kind` varies between cases.
      run_state: { kind: wireKind, computed_at: '2026-09-23T00:00:00.000Z' },
      readiness: { status: 'ready', blockers: [] },
      leader_claim: { permitted: true, separation: 'separated' },
      robustness: { aggregate_level: 'low' },
      usable_for_prose: true, usable_for_chips: true, usable_for_followup: true,
      requires_rerun: false, blocked_unusable: false, contradictions: [],
    },
    // Held constant: locally FRESH, a completed report on screen.
    analysisFreshness: { freshness: 'fresh', freshnessReason: 'graph_hash_match', computedAt: '2026-09-23T00:00:00.000Z' },
    analysisFreshnessDirty: false,
    importPendingServerRegistration: false, currentScenarioId: 'currency-scenario',
    v5AnalysisFact: { scenarioId: 'currency-scenario', analysisHash: 'run-1', hasRunAnalysisFact: true },
    hasCompletedFirstRun: true,
    results: { status: 'complete', hash: 'run-1', report: {
      option_probabilities: {
        opt_a: { status: 'computed', win_probability: 0.72 },
        opt_b: { status: 'computed', win_probability: 0.28 },
      },
      robustness: { near_tie: { is_tie: false, top_option_id: 'opt_a' } },
      flip_thresholds: [
        { node_id: FACTOR_ID, label: 'Hiring speed', current_value: 8, flip_value: 6.5, unit: '%', flip_reason: 'found', value_scale: 'display' },
      ],
    } },
  } as never)
}

function TrustProbe() {
  return <span data-testid="trust-probe" data-semantic={useAnalysisTrust().semantic} />
}

const renderFactor = () =>
  render(
    <ReactFlowProvider>
      <TrustProbe />
      <FactorNode
        id={FACTOR_ID} type="factor" data={UNVALUED as never} selected={false}
        isConnectable positionAbsoluteX={0} positionAbsoluteY={0}
        dragging={false} zIndex={0} deletable selectable draggable
      />
    </ReactFlowProvider>,
  )

const semantic = () => screen.getByTestId('trust-probe').getAttribute('data-semantic')
/** The card's own title, a PRESENT control from the same render for every absence below. */
const cardTitle = () => screen.getAllByText('Hiring speed')[0]

beforeEach(() => { displayMetadata = RANKED })
afterEach(() => {
  cleanup()
  useCanvasStore.setState({
    analysisStateV1: null, analysisFreshness: null, analysisFreshnessDirty: false,
    v5AnalysisFact: null, results: { status: 'idle', report: null }, lodRung: 'full', viewMode: 'standard',
  } as never)
})

describe('run cues follow the ONE composed currency verdict (Codex 5801431996)', () => {
  it('wire complete_current → driver line and turning point shown, UNQUALIFIED', () => {
    seed('complete_current')
    renderFactor()
    expect(semantic()).toBe('current')
    const caption = cue('factor-driver-line-caption').textContent ?? ''
    expect(caption).toBe('Driver 1 of 3 ranked in this run')
    expect(caption).not.toMatch(/Last run/)
    expect(cue('factor-turning-point')).toBeInTheDocument()
    expect(cue('factor-turning-point').textContent ?? '').not.toMatch(/Last run/)
  })

  it('wire complete_stale → cues shown AND labelled "Last run ·" (visible + accessible)', () => {
    seed('complete_stale')
    renderFactor()
    expect(semantic()).toBe('changed')
    expect(cue('factor-driver-line-caption').textContent ?? '').toMatch(/^Last run · /)
    expect(cue('factor-driver-line').getAttribute('aria-label') ?? '').toMatch(/^Last run · /)
    expect(cue('factor-turning-point').textContent ?? '').toMatch(/Last run/)
  })

  for (const kind of ['refused', 'unknown_degraded'] as const) {
    it(`wire ${kind} → cannot-confirm → NO driver line and NO turning point, though the local fields are fresh`, () => {
      seed(kind)
      renderFactor()
      expect(semantic()).toBe('cannot_confirm')
      expect(cardTitle()).toBeInTheDocument()
      expect(screen.queryByTestId('factor-driver-line')).not.toBeInTheDocument()
      expect(screen.queryByTestId('factor-turning-point')).not.toBeInTheDocument()
      // Nor any other run-derived claim in words: an unconfirmed run licenses no
      // turning-point sentence, including a "no turning point" one.
      expect(document.body.textContent ?? '').not.toMatch(/turning point|Driver \d+ of \d+/i)
      // Contract v3.1 pt 5: nor a "Not ranked" claim — no run is vouched for.
      expect(screen.queryByTestId('factor-driver-not-ranked')).not.toBeInTheDocument()
    })
  }

  it('CONTRAST — no wire state, locally fresh → the legacy composed verdict (current) still shows the cues', () => {
    seed(null)
    renderFactor()
    expect(semantic()).toBe('current')
    expect(cue('factor-driver-line')).toBeInTheDocument()
    expect(cue('factor-turning-point')).toBeInTheDocument()
  })
})

/**
 * ⭐ THE SAME VERDICT GOVERNS THE "WORTH REVIEWING" REASONS AND THE REDUCED
 * LINE'S RANK (reviewer blocker on Paul 23 Sep contract feedback points 11/14).
 * `InspectorRouter` renders `useNodeAttention(nodeId).reasons` verbatim
 * (`InspectorAttentionContext`, and the Ask context), and `BaseNode`'s far-zoom
 * line reads `useInfluenceRank`. Probing the two hooks under the same seeds
 * proves what those surfaces can print.
 */
function AttentionProbe() {
  const { reasons } = useNodeAttention(FACTOR_ID)
  const rank = useInfluenceRank(1, 5)
  return (
    <>
      <span data-testid="attention-kinds">{reasons.map(r => r.kind).join(',')}</span>
      <span data-testid="attention-text">{reasons.map(r => r.label).join(' | ')}</span>
      <span data-testid="influence-rank">{rank === null ? 'null' : 'licensed'}</span>
    </>
  )
}

describe('the attention reasons and the reduced-line rank follow the same composed verdict', () => {
  const renderProbe = () => render(<><TrustProbe /><AttentionProbe /></>)

  it('CONTRAST — wire complete_current → the turning-point reason and the rank are available', () => {
    seed('complete_current')
    renderProbe()
    expect(semantic()).toBe('current')
    expect(screen.getByTestId('attention-kinds').textContent).toContain('turning_point')
    expect(screen.getByTestId('influence-rank').textContent).toBe('licensed')
  })

  for (const kind of ['refused', 'unknown_degraded'] as const) {
    it(`wire ${kind} → NO run-derived reason and NO rank, though the local fields are fresh`, () => {
      seed(kind)
      renderProbe()
      expect(semantic()).toBe('cannot_confirm')
      const kinds = screen.getByTestId('attention-kinds').textContent ?? ''
      expect(kinds).not.toMatch(/turning_point|top_driver|evidence_gap|fragile_link/)
      expect(screen.getByTestId('attention-text').textContent ?? '').not.toMatch(/turning point|Driver \d+ of \d+/i)
      expect(screen.getByTestId('influence-rank').textContent).toBe('null')
    })
  }
})
