/**
 * ⭐⭐ D1a — THE FACTOR CARD'S TWO REASONING SIGNALS AT REST.
 *
 * Locked Experience Design (Paul-approved 23 Sep 2026): at rest a factor card
 * shows its title, its value, a tiny RELATIVE driver line where the analysis
 * publishes a rank, and at most ONE mini-visual — a real turning point first, a
 * genuine range second, otherwise nothing. No pseudo-precision.
 *
 * What is pinned here, each by IDENTITY (node ids, exact labels), never by a
 * value predicate another row could satisfy:
 *
 *   (a) a top-ranked fresh factor reads `Driver #1 of 5` beside a bar, and NO
 *       percentage is on the face of the card;
 *   (b) an unranked factor keeps the bar and says no `#N`;
 *   (c) once the model has CHANGED since the run the rank stays and is labelled
 *       `Last run · ` (Paul's Ruling 3, and his accepted Q2 of 22 Sep: keep the
 *       figure and the rank, labelled, when the model has changed) — while
 *       `cannot_confirm` still withholds it (control);
 *   (d) a turning point renders ONLY from a PLoT `flip_thresholds[]` row that
 *       names THIS node and says `flip_reason: 'found'`;
 *   (e) an external factor with a prior and no turning point keeps its range;
 *   (f) a factor with neither renders no mini-visual;
 *   (g) the Detailed view keeps today's influence figure (control).
 *
 * Freshness is NOT mocked: every stale case runs through the real store and the
 * real composed verdict, and asserts the verdict it needs first.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { FactorNode } from '../FactorNode'
import { useCanvasStore } from '../../store'
import { useAnalysisTrust } from '../../hooks/useAnalysisTrust'
import { resolveFactorPriorRange } from '../shared/factorPriorRange'
import { formatFlipValue } from '../../../components/results/utils/flipThresholdDisplay'
import { OPEN_FULL_INSPECTOR_EVENT } from '../../utils/openEdgeStrengthEditor'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

let displayMetadata: Record<string, unknown> = {}
vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => displayMetadata),
}))

const FACTOR_ID = 'fac_hiring_speed'
const OTHER_FACTOR_ID = 'fac_delivery_capacity'

/** The exact disclosure the locked design specifies for the driver line. */
const DRIVER_DISCLOSURE = 'Relative model sensitivity in this analysis, not an absolute causal percentage.'

/** No stated value and no prior — neither a value line nor a range. */
const PLAIN = { label: 'Hiring speed', type: 'factor', category: 'controllable' }
/** An external factor whose only figure is its prior range. */
const EXTERNAL_WITH_PRIOR = {
  label: 'Hiring speed', type: 'factor', category: 'external',
  prior: { range_min: 0.2, range_max: 0.8 },
}
/** An unconfirmed estimate — the population the "Confirm this first?" chip asks about. */
const INFERRED = {
  label: 'Hiring speed', type: 'factor', category: 'controllable', extractionType: 'inferred',
  observedState: { value: 0.5, source: 'cee_inference', extractionType: 'inferred' },
}

const metadata = (rank: number | null, setSize: number | null, influence: number) => ({
  sensitivityRank: rank,
  influence,
  influenceProvenance: 'normalised_elasticity',
  influenceImportanceBasis: null,
  influenceSetSize: setSize,
  confidence: null,
  confidenceIsDefaulted: false,
  confidenceIsProvisional: false,
  inSensitivityAnalysis: true,
  achievementProbability: null,
  achievementProbabilityIsModelledBasis: false,
  stabilityPercentage: null,
  winRate: null,
  isResultsMode: true,
  predictedOutcome: null,
  valueOfInformation: null,
  voiRank: null,
})

const FRESH_VERDICT = {
  freshness: 'fresh', freshnessReason: 'graph_hash_match',
  computedAt: '2026-09-23T00:00:00.000Z',
}

/** A PLoT flip row, shaped as `flip-threshold-denormaliser.ts` emits it (keyed `factor_id`). */
const flipRow = (overrides: Record<string, unknown> = {}) => ({
  factor_id: FACTOR_ID,
  factor_label: 'Hiring speed',
  current_value: 0.6,
  flip_value: 0.25,
  unit: '',
  alternative_winner_label: 'Two developers',
  flip_reason: 'found',
  ...overrides,
})

const seedCompletedRun = (
  nodeData: Record<string, unknown>,
  { report = {}, ...extra }: { report?: Record<string, unknown> } & Record<string, unknown> = {},
) => {
  useCanvasStore.setState({
    nodes: [
      { id: FACTOR_ID, type: 'factor', position: { x: 0, y: 0 }, data: nodeData },
      { id: OTHER_FACTOR_ID, type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Delivery capacity', type: 'factor' } },
    ],
    edges: [], ceeAnalysisReady: null, viewMode: 'standard', lodRung: 'full',
    analysisStateV1: null, analysisFreshness: FRESH_VERDICT, analysisFreshnessDirty: false,
    importPendingServerRegistration: false, currentScenarioId: 'driver-line-scenario',
    v5AnalysisFact: {
      scenarioId: 'driver-line-scenario', analysisHash: 'last-run', hasRunAnalysisFact: true,
    },
    hasCompletedFirstRun: true,
    results: { status: 'complete', hash: 'last-run', report: {
      option_probabilities: {
        opt_a: { status: 'computed', win_probability: 0.72 },
        opt_b: { status: 'computed', win_probability: 0.28 },
      },
      robustness: { near_tie: { is_tie: false, top_option_id: 'opt_a' } },
      ...report,
    } },
    ...extra,
  } as never)
}

/** The local edit that makes the composed verdict 'changed' (real store path). */
const editTheModel = () => act(() => useCanvasStore.setState({ analysisFreshnessDirty: true }))

function TrustProbe() {
  return <span data-testid="trust-probe" data-semantic={useAnalysisTrust().semantic} />
}

const renderFactor = (nodeData: Record<string, unknown>) =>
  render(
    <ReactFlowProvider>
      <TrustProbe />
      <div data-testid="card-under-test">
        <FactorNode
          id={FACTOR_ID} type="factor" data={nodeData as never} selected={false}
          isConnectable positionAbsoluteX={0} positionAbsoluteY={0}
          dragging={false} zIndex={0} deletable selectable draggable
        />
      </div>
    </ReactFlowProvider>,
  )

const semantic = () => screen.getByTestId('trust-probe').getAttribute('data-semantic')
const cardText = () => screen.getByTestId('card-under-test').textContent ?? ''
const barFillWidth = () =>
  (screen.getByTestId('factor-driver-bar').firstElementChild as HTMLElement | null)?.style.width

beforeEach(() => {
  displayMetadata = metadata(null, null, 0.62)
})

afterEach(() => {
  cleanup()
  useCanvasStore.setState({
    analysisStateV1: null, analysisFreshness: null, analysisFreshnessDirty: false,
    v5AnalysisFact: null, results: { status: 'idle', report: null }, lodRung: 'full',
    viewMode: 'standard',
  } as never)
})

describe('(a)(b) the driver line — Standard view, at rest', () => {
  it('(a) a top-ranked fresh factor reads "Driver #1 of 5" beside a bar, and NO percentage is on the card', () => {
    displayMetadata = metadata(1, 5, 1)
    seedCompletedRun(PLAIN)
    renderFactor(PLAIN)
    expect(semantic()).toBe('current')

    const line = screen.getByTestId('factor-driver-line')
    expect(line.textContent).toBe('Driver #1 of 5')
    // The bar is the EXISTING normalised display value — no new normalisation.
    expect(barFillWidth()).toBe('max(4px, 100%)')
    // ⛔ No absolute-looking figure anywhere on the face of the card at rest.
    expect(cardText()).not.toMatch(/\d\s*%/)
    // The row it replaces is gone, so there is one rank channel in the body.
    expect(screen.queryByTestId('factor-influence-row')).toBeNull()

    // The disclosure, and the NO-HIDING half: the figure is still reachable,
    // stated WITH the scale that makes it relative.
    const name = line.getAttribute('aria-label') ?? ''
    expect(name.startsWith('Driver #1 of 5')).toBe(true)
    expect(name).toContain(DRIVER_DISCLOSURE)
    expect(name).toContain('100% of the strongest factor')
  })

  it('(b) an unranked factor keeps the bar and says no "#N"', () => {
    displayMetadata = metadata(null, null, 0.62)
    seedCompletedRun(PLAIN)
    renderFactor(PLAIN)
    expect(semantic()).toBe('current')

    const line = screen.getByTestId('factor-driver-line')
    expect(line.textContent).toBe('')
    expect(line.textContent).not.toContain('#')
    expect(barFillWidth()).toBe('max(4px, 62%)')
    expect(cardText()).not.toMatch(/\d\s*%/)
    expect(line.getAttribute('aria-label')).toContain(DRIVER_DISCLOSURE)
  })
})

describe('(c) a stale run — labelled on "changed", withheld on "cannot_confirm"', () => {
  it('"changed" keeps the rank and the bar and opens with "Last run · "', () => {
    displayMetadata = metadata(1, 5, 1)
    seedCompletedRun(PLAIN)
    renderFactor(PLAIN)
    expect(semantic()).toBe('current')
    expect(screen.getByTestId('factor-driver-line').textContent).toBe('Driver #1 of 5')

    editTheModel()
    expect(semantic()).toBe('changed')
    const line = screen.getByTestId('factor-driver-line')
    expect(line.textContent).toBe('Last run · Driver #1 of 5')
    expect(barFillWidth()).toBe('max(4px, 100%)')
    // Label in Name: the visible words open the spoken ones.
    expect((line.getAttribute('aria-label') ?? '').startsWith('Last run · Driver #1 of 5')).toBe(true)
  })

  it('CONTROL — "cannot_confirm" is not "changed": no rank is named, labelled or not', () => {
    displayMetadata = metadata(1, 5, 1)
    seedCompletedRun(PLAIN, {
      analysisFreshness: { ...FRESH_VERDICT, freshness: 'unknown', freshnessReason: 'cee_unknown' },
    })
    renderFactor(PLAIN)
    expect(semantic()).toBe('cannot_confirm')
    expect(cardText()).not.toContain('#1')
    expect(cardText()).not.toContain('Most influential')
    expect(cardText()).not.toContain('Last run')
  })

  it('CONTROL — the top-influence coaching chip still never outlives a stale run', () => {
    displayMetadata = metadata(1, 5, 1)
    seedCompletedRun(INFERRED)
    renderFactor(INFERRED)
    expect(semantic()).toBe('current')
    // Precondition: the fresh top-ranked estimate DOES get the sharper question.
    expect(screen.queryByText('Confirm this first?')).not.toBeNull()

    editTheModel()
    expect(semantic()).toBe('changed')
    expect(screen.queryByText('Confirm this first?')).toBeNull()
  })
})

describe('(d) the turning point — a PLoT flip row for THIS node, marked "found"', () => {
  it('renders a compact track with the formatted flip value, and opens the inspector on click', () => {
    seedCompletedRun(PLAIN, { report: { flip_thresholds: [flipRow()] } })
    renderFactor(PLAIN)
    expect(semantic()).toBe('current')

    const track = screen.getByTestId('factor-flip-track')
    expect(within(track).getByText('Turning point')).toBeTruthy()
    // The shared formatter — never a second unit rule.
    expect(within(track).getByText(formatFlipValue(0.25, ''))).toBeTruthy()
    expect(within(track).getByTestId('factor-flip-track-current')).toBeTruthy()
    expect(within(track).getByTestId('factor-flip-track-flip')).toBeTruthy()

    const opened = vi.fn()
    window.addEventListener(OPEN_FULL_INSPECTOR_EVENT, opened)
    fireEvent.click(track)
    window.removeEventListener(OPEN_FULL_INSPECTOR_EVENT, opened)
    expect(opened).toHaveBeenCalledTimes(1)
    // `openNodeInspector` selects through `selectNodeWithoutHistory`, which
    // writes `selection.nodeIds` — the set `InspectorModal` reads.
    expect([...useCanvasStore.getState().selection.nodeIds]).toEqual([FACTOR_ID])
  })

  it('reads the legacy nested `robustness.flip_thresholds` too, bound by `node_id`', () => {
    seedCompletedRun(PLAIN, {
      report: {
        robustness: {
          near_tie: { is_tie: false, top_option_id: 'opt_a' },
          flip_thresholds: [{ ...flipRow({ factor_id: undefined }), node_id: FACTOR_ID }],
        },
      },
    })
    renderFactor(PLAIN)
    expect(screen.getByTestId('factor-flip-track')).toBeTruthy()
  })

  it('IDENTITY CONTROL — a found row for ANOTHER node id does not render here', () => {
    seedCompletedRun(PLAIN, { report: { flip_thresholds: [flipRow({ factor_id: OTHER_FACTOR_ID })] } })
    renderFactor(PLAIN)
    expect(screen.queryByTestId('factor-flip-track')).toBeNull()
  })

  it('REASON CONTROL — a row that is not "found" does not render, even carrying a flip value', () => {
    // `insufficient_precision` ships a NON-null flip_value (PLoT
    // `analysis/flip-thresholds.ts`), so only the reason gate can refuse it.
    seedCompletedRun(PLAIN, {
      report: { flip_thresholds: [flipRow({ flip_reason: 'insufficient_precision' })] },
    })
    renderFactor(PLAIN)
    expect(screen.queryByTestId('factor-flip-track')).toBeNull()
  })

  it('a stale run labels the turning point "Last run · " and keeps it', () => {
    seedCompletedRun(PLAIN, { report: { flip_thresholds: [flipRow()] } })
    renderFactor(PLAIN)
    editTheModel()
    expect(semantic()).toBe('changed')
    expect(within(screen.getByTestId('factor-flip-track')).getByText('Last run · Turning point')).toBeTruthy()
  })
})

describe('(e)(f) one mini-visual at most — range second, otherwise nothing', () => {
  const rangeText = () => resolveFactorPriorRange({
    data: EXTERNAL_WITH_PRIOR, nodeCategory: 'external', observedState: undefined, valueDisplay: null,
  })

  it('(e) an external factor with a prior and no turning point renders the range and no track', () => {
    expect(rangeText(), 'the fixture must carry a printable range').not.toBeNull()
    seedCompletedRun(EXTERNAL_WITH_PRIOR)
    renderFactor(EXTERNAL_WITH_PRIOR)
    expect(screen.getByText(rangeText() as string)).toBeTruthy()
    expect(screen.queryByTestId('factor-flip-track')).toBeNull()
  })

  it('a turning point takes precedence over the range at rest — one mini-visual, not two', () => {
    seedCompletedRun(EXTERNAL_WITH_PRIOR, { report: { flip_thresholds: [flipRow()] } })
    renderFactor(EXTERNAL_WITH_PRIOR)
    expect(screen.getByTestId('factor-flip-track')).toBeTruthy()
    expect(screen.queryByText(rangeText() as string)).toBeNull()
  })

  it('(f) a factor with neither renders no mini-visual', () => {
    seedCompletedRun(PLAIN)
    renderFactor(PLAIN)
    expect(screen.queryByTestId('factor-flip-track')).toBeNull()
    expect(cardText()).not.toContain('Range')
  })
})

describe('(g) the Detailed view keeps today\'s influence treatment', () => {
  it('CONTROL — the Detailed bar row still states the relative figure', () => {
    seedCompletedRun(PLAIN, { viewMode: 'expert' })
    renderFactor(PLAIN)
    expect(semantic()).toBe('current')
    expect(screen.getByRole('group', { name: 'Relative influence' }).textContent).toBe('Relative influence62%')
    expect(screen.queryByTestId('factor-driver-line')).toBeNull()
  })
})
