/**
 * ⭐ DESIGN-GAP ROW 23 — THE ATTENTION CUE SURVIVES AN EDIT, LABELLED AS THE
 * LAST RUN'S (visual contract v3 §02: stale tooltip "Last run focus: these
 * reasons refer to the previous model.").
 *
 * Before: `useNodeAttention` passed run inputs only while the run was current,
 * so the moment the user edited the model the card's cue vanished — the run's
 * focus silently deleted rather than labelled.
 *
 * The rule, one composed verdict (`useModelChangedSinceRun`, the `'changed'`
 * state every other card surface labels `Last run ·` from):
 *   · `current`        → the cue as before, "Worth reviewing: …", unlabelled;
 *   · `changed`        → the SAME run's reasons, led by the contract sentence;
 *   · `cannot_confirm` → nothing run-derived (no "last run" is manufactured);
 *   · never run        → nothing run-derived.
 *
 * ⚠ ADDITIVE FOR THE INSPECTOR: `reasons` keeps its contract (current-only), so
 * `InspectorRouter`, which renders it verbatim, cannot present a last-run reason
 * as current. The last run's reasons ride in `fromLastRun`, separately.
 *
 * Bound by identity: the card's own marker test id and its accessible name;
 * the hook's reason KIND, not a text predicate another reason could satisfy.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { FactorNode } from '../FactorNode'
import { useCanvasStore } from '../../store'
import { useAnalysisTrust } from '../../hooks/useAnalysisTrust'
import { useNodeAttention } from '../shared/useNodeAttention'
import { ATTENTION_MARKER_TESTID_PREFIX } from '../shared/NodeAttentionMarker'
import { ATTENTION_BUDGET, attentionCueSentence, LAST_RUN_FOCUS_LEAD, type AttentionReason } from '../shared/nodeAttention'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

let displayMetadata: Record<string, unknown> = {}
vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => displayMetadata),
}))

vi.mock('../shared/NodePopover', () => ({
  NodePopover: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="factor-node-popover">{children}</div>
  ),
}))

const FACTOR_ID = 'fac_hiring_speed'
const UNVALUED = { label: 'Hiring speed', type: 'factor', category: 'external' }
const LAST_RUN_FOCUS = 'Last run focus: these reasons refer to the previous model.'

const RANKED = {
  sensitivityRank: 1, influence: 1, influenceProvenance: 'normalised_elasticity',
  influenceImportanceBasis: null, influenceSetSize: 5, influenceRankedCount: 3, confidence: null,
  confidenceIsDefaulted: false, confidenceIsProvisional: false, inSensitivityAnalysis: true,
  achievementProbability: null, achievementProbabilityIsModelledBasis: false,
  stabilityPercentage: null, winRate: null, isResultsMode: true, predictedOutcome: null,
  valueOfInformation: null, voiRank: null,
}

const REPORT = {
  option_probabilities: {
    opt_a: { status: 'computed', win_probability: 0.72 },
    opt_b: { status: 'computed', win_probability: 0.28 },
  },
  robustness: { near_tie: { is_tie: false, top_option_id: 'opt_a' } },
  flip_thresholds: [
    { node_id: FACTOR_ID, label: 'Hiring speed', current_value: 8, flip_value: 6.5, unit: '%', flip_reason: 'found', value_scale: 'display' },
  ],
}

/** `wireKind` is the ONE variable for the run cases; `null` = never run. */
const seed = (wireKind: 'complete_current' | 'complete_stale' | 'refused' | null) => {
  const ran = wireKind !== null
  useCanvasStore.setState({
    nodes: [{ id: FACTOR_ID, type: 'factor', position: { x: 0, y: 0 }, data: UNVALUED }],
    edges: [], ceeAnalysisReady: null, viewMode: 'standard', lodRung: 'full',
    analysisStateV1: ran ? {
      run_state: { kind: wireKind, computed_at: '2026-09-23T00:00:00.000Z' },
      readiness: { status: 'ready', blockers: [] },
      leader_claim: { permitted: true, separation: 'separated' },
      robustness: { aggregate_level: 'low' },
      usable_for_prose: true, usable_for_chips: true, usable_for_followup: true,
      requires_rerun: false, blocked_unusable: false, contradictions: [],
    } : null,
    analysisFreshness: ran
      ? { freshness: 'fresh', freshnessReason: 'graph_hash_match', computedAt: '2026-09-23T00:00:00.000Z' }
      : null,
    analysisFreshnessDirty: false,
    importPendingServerRegistration: false, currentScenarioId: 'stale-cue-scenario',
    v5AnalysisFact: ran ? { scenarioId: 'stale-cue-scenario', analysisHash: 'run-1', hasRunAnalysisFact: true } : null,
    hasCompletedFirstRun: ran,
    results: ran ? { status: 'complete', hash: 'run-1', report: REPORT } : { status: 'idle', report: null },
  } as never)
}

function TrustProbe() {
  return <span data-testid="trust-probe" data-semantic={useAnalysisTrust().semantic} />
}
const semantic = () => screen.getByTestId('trust-probe').getAttribute('data-semantic')

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

const marker = () => screen.queryByTestId(`${ATTENTION_MARKER_TESTID_PREFIX}${FACTOR_ID}`)
/** A PRESENT control from the same render for every absence below. */
const cardTitle = () => screen.getAllByText('Hiring speed')[0]

beforeEach(() => { displayMetadata = RANKED })
afterEach(() => {
  cleanup()
  useCanvasStore.setState({
    analysisStateV1: null, analysisFreshness: null, analysisFreshnessDirty: false,
    v5AnalysisFact: null, results: { status: 'idle', report: null }, lodRung: 'full', viewMode: 'standard',
  } as never)
})

describe('row 23 — the card keeps the attention cue after an edit, labelled as the last run', () => {
  it('CONTRAST — current run → the cue is "Worth reviewing: …", with no last-run label', () => {
    seed('complete_current')
    renderFactor()
    expect(semantic()).toBe('current')
    const name = marker()?.getAttribute('aria-label') ?? ''
    expect(name).toMatch(/^Worth reviewing: /)
    expect(name).not.toContain('Last run focus')
  })

  it('model changed since the run → the SAME marker stays, led by the contract sentence, with the run reasons', () => {
    seed('complete_stale')
    renderFactor()
    expect(semantic()).toBe('changed')
    const m = marker()
    expect(m, 'the stale cue must not disappear').not.toBeNull()
    const name = m!.getAttribute('aria-label') ?? ''
    expect(name.startsWith(LAST_RUN_FOCUS)).toBe(true)
    // The previous model's reason is labelled, not deleted: the turning-point sentence rides with it.
    expect(name).toMatch(/turning point|6\.5/i)
    // Never presented as a current finding.
    expect(name).not.toMatch(/^Worth reviewing:/)
  })

  it('cannot confirm the run → NO cue (no "last run" is manufactured)', () => {
    seed('refused')
    renderFactor()
    expect(semantic()).toBe('cannot_confirm')
    expect(cardTitle()).toBeInTheDocument()
    expect(marker()).toBeNull()
  })

  it('never run → NO run-derived cue', () => {
    seed(null)
    renderFactor()
    expect(cardTitle()).toBeInTheDocument()
    expect(marker()).toBeNull()
  })
})

function AttentionProbe() {
  const a = useNodeAttention(FACTOR_ID)
  return (
    <>
      <span data-testid="current-kinds">{a.reasons.map(r => r.kind).join(',')}</span>
      <span data-testid="last-run-kinds">{a.fromLastRun ? a.fromLastRun.reasons.map(r => r.kind).join(',') : 'none'}</span>
      <span data-testid="last-run-marked">{String(a.fromLastRun?.marked ?? false)}</span>
    </>
  )
}

describe('row 23 — useNodeAttention stays additive for its other readers (the inspector)', () => {
  const renderProbe = () => render(<><TrustProbe /><AttentionProbe /></>)

  it('changed → `reasons` stays current-only; the last run rides in `fromLastRun`', () => {
    seed('complete_stale')
    renderProbe()
    expect(semantic()).toBe('changed')
    expect(screen.getByTestId('current-kinds').textContent ?? '').not.toMatch(/turning_point|top_driver|evidence_gap|fragile_link/)
    expect(screen.getByTestId('last-run-kinds').textContent).toContain('turning_point')
    expect(screen.getByTestId('last-run-marked').textContent).toBe('true')
  })

  it('CONTRAST — current → the reason is current, and there is no last-run set', () => {
    seed('complete_current')
    renderProbe()
    expect(screen.getByTestId('current-kinds').textContent).toContain('turning_point')
    expect(screen.getByTestId('last-run-kinds').textContent).toBe('none')
  })

  it('cannot confirm → neither set carries a run-derived reason', () => {
    seed('refused')
    renderProbe()
    expect(semantic()).toBe('cannot_confirm')
    expect(screen.getByTestId('current-kinds').textContent ?? '').not.toMatch(/turning_point/)
    expect(screen.getByTestId('last-run-kinds').textContent).toBe('none')
  })
})

describe('row 23 — the one cue sentence (pure)', () => {
  const R: AttentionReason = { kind: 'fragile_link', order: 1, label: 'The comparison depends on a link from here. How sure are you of it?' }
  const base = { reasons: [] as AttentionReason[], marked: false, markedCount: 0, candidateCount: 0 }

  it('the contract sentence is verbatim', () => {
    expect(LAST_RUN_FOCUS_LEAD).toBe(LAST_RUN_FOCUS)
  })

  it('a current mark wins, unlabelled, with its selection disclosure', () => {
    const s = attentionCueSentence({ ...base, reasons: [R], marked: true, markedCount: 1, candidateCount: 4,
      fromLastRun: { reasons: [R], marked: true, markedCount: 1, candidateCount: 1 } }, false)
    expect(s).toMatch(/^Worth reviewing: /)
    expect(s).toContain('Olumi marks 1 of 4')
  })

  it('a last-run mark is led by the contract sentence and makes no claim about the details panel', () => {
    const s = attentionCueSentence({ ...base, fromLastRun: { reasons: [R], marked: true, markedCount: 1, candidateCount: 4 } }, false)
    expect(s).toBe(`${LAST_RUN_FOCUS} ${R.label}`)
  })

  it('no mark in either set → no cue; an absent `fromLastRun` (a stubbed hook) reads as none', () => {
    expect(attentionCueSentence({ ...base, reasons: [R] }, false)).toBeNull()
    expect(attentionCueSentence({ ...base, fromLastRun: { reasons: [R], marked: false, markedCount: 0, candidateCount: 1 } }, false)).toBeNull()
  })
})

/**
 * ⭐ THE LAST RUN'S CUE SHARES THE BOARD'S BUDGET (#1984 review 5825619572: a
 * mutant that gave the last-run plan the FULL `ATTENTION_BUDGET` survived).
 * The board never carries more than `ATTENTION_BUDGET` markers in total: the
 * last run gets only what the current plan left. Seeded so the discrimination
 * is real — the current plan marks one card (a grounded bias finding, which is
 * not run-derived), and the last run has MORE turning points than the
 * remainder, so a full-budget last-run plan would overspend.
 */
describe('row 23 — the last-run cue spends only what the current plan left', () => {
  const IDS = ['fac_a', 'fac_b', 'fac_c', 'fac_d', 'fac_e'] as const

  function BudgetProbe() {
    // One call per id, in a fixed order — a hook inside `IDS.map` breaks
    // rules-of-hooks (the CI lint step reads specs too).
    const all = [
      useNodeAttention(IDS[0]),
      useNodeAttention(IDS[1]),
      useNodeAttention(IDS[2]),
      useNodeAttention(IDS[3]),
      useNodeAttention(IDS[4]),
    ]
    const current = all.find((a) => a.reasons.length > 0)
    const last = all.find((a) => a.fromLastRun)?.fromLastRun
    return (
      <span
        data-testid="budget-probe"
        data-current-marked={String(current?.markedCount ?? 0)}
        data-last-marked={String(last?.markedCount ?? 0)}
        data-last-candidates={String(last?.candidateCount ?? 0)}
      />
    )
  }

  it('changed → current marks + last-run marks never exceed ATTENTION_BUDGET', () => {
    seed('complete_stale')
    useCanvasStore.setState({
      nodes: IDS.map((id, i) => ({ id, type: 'factor', position: { x: i * 10, y: 0 }, data: { label: `Factor ${id}`, type: 'factor', category: 'external' } })),
      ceeAnalysisReady: { bias_findings: [{ id: 'b1', code: 'anchoring', severity: 'medium', target_factor_id: 'fac_e', explanation: 'x' }] },
      results: {
        status: 'complete', hash: 'run-1',
        report: {
          ...REPORT,
          flip_thresholds: ['fac_a', 'fac_b', 'fac_c', 'fac_d'].map((id, i) => ({
            node_id: id, label: `Factor ${id}`, current_value: 8 + i, flip_value: 6 + i, unit: '%', flip_reason: 'found', value_scale: 'display',
          })),
        },
      },
    } as never)
    render(<><TrustProbe /><BudgetProbe /></>)
    const p = screen.getByTestId('budget-probe')
    const currentMarked = Number(p.getAttribute('data-current-marked'))
    const lastMarked = Number(p.getAttribute('data-last-marked'))
    const lastCandidates = Number(p.getAttribute('data-last-candidates'))

    expect(semantic(), 'precondition: the model changed since the run').toBe('changed')
    expect(currentMarked, 'precondition: the current plan marks a card').toBeGreaterThanOrEqual(1)
    expect(lastCandidates, 'precondition: the last run has more candidates than the remainder').toBeGreaterThan(
      ATTENTION_BUDGET - currentMarked,
    )
    expect(currentMarked + lastMarked, 'the board carries at most ATTENTION_BUDGET markers').toBeLessThanOrEqual(ATTENTION_BUDGET)
    expect(lastMarked, 'the last run spends exactly the remainder').toBe(ATTENTION_BUDGET - currentMarked)
  })
})
