/**
 * Contract v3.1 pt 5 (and pt 9's "thinner") on the factor card's driver line.
 *
 * Pt 5, verbatim: "“Driver N of M ranked in this run”, where M is the number of
 * factors the run ranked. Show every one of the M ranks on its card; its hover
 * and detail define the denominator. A factor the run did not rank shows no
 * rank, and its detail says “Not ranked in this run”, so a missing rank never
 * reads as an omission. Stale form: “Last run · Driver N of M ranked”."
 *
 * The served defect (screenshot A, OpenAI PoC after a run that published no
 * ranks): every factor showed "Structural influence" with a relative bar, three
 * of four nearly empty — it read as broken.
 *
 * ⭐ SUPERSEDED IN PART BY ED #63 5806207128 (24 Sep, "Factor anatomy"): the
 * ranked caption is `Driver N of M analysed` (stale `Last run · Driver N of M
 * analysed`) and "Denominator = eligible analysed factors, not 'number of
 * ranks we happen to render'" — the served wording and M from before pt 5.
 * The unranked half of pt 5 (no line, "Not ranked in this run" to AT) stands.
 *
 * ⚠ IDENTITY, NOT A VALUE PREDICATE. Every assertion binds a test id AND an
 * exact string. The ranked cases run a discriminating pair: the analysed set
 * (`influenceSetSize` 6) and the ranked count (`influenceRankedCount` 3) differ,
 * so a caption that prints the ranked count goes red.
 *
 * Freshness is NOT mocked: `current` / `changed` / `cannot_confirm` come from
 * the real store and the real composed verdict (harness from
 * `staleRun.labelsLastRun.spec.tsx`).
 *
 * CLAIM SCOPE: jsdom — strings, test ids, classes and accessible names. Not
 * pixels.
 *
 * ⭐ RE-POINTED FOR THE BOUNDED ANATOMY (ED #63 5809278282, 24 Sep): the
 * Standard driver line moved off the card body into the factor's popover.
 * Every ranked assertion now binds the line INSIDE the popover (its own test
 * id) and asserts it is NOT on the card face; every absence is document-wide,
 * so it covers the popover too (the mock below renders the popover's content).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, within } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { FactorNode } from '../FactorNode'
import { useCanvasStore } from '../../store'
import { useAnalysisTrust } from '../../hooks/useAnalysisTrust'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

let displayMetadata: Record<string, unknown> = {}
vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => displayMetadata),
}))

// ED 5809278282: the Standard driver line lives in the popover — transparent,
// identity-bearing, so its content is observable and absences cover it.
vi.mock('../shared/NodePopover', () => ({
  NodePopover: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="factor-node-popover">{children}</div>
  ),
}))
const face = () => screen.getByTestId('node-title').closest('[role="group"]') as HTMLElement
/**
 * The Standard driver line: ON the card face, never repeated in the popover
 * (prototype, Paul 25 Sep 2026 — superseding ED 5809278282's move to the popover).
 */
const popoverLine = (testId = 'factor-driver-line') => {
  const pop = screen.queryByTestId('factor-node-popover')
  if (pop) expect(within(pop).queryByTestId(testId), `${testId} is repeated in the popover`).toBeNull()
  return within(face()).getByTestId(testId)
}

const FACTOR_ID = 'fac_conversion'
const UNVALUED = { label: 'Trial conversion', type: 'factor', category: 'external' }

const metadata = (
  rank: number | null,
  setSize: number | null,
  rankedCount: number | null,
  influence: number,
) => ({
  sensitivityRank: rank,
  influence,
  influenceProvenance: 'influence_score',
  influenceImportanceBasis: null,
  influenceSetSize: setSize,
  influenceRankedCount: rankedCount,
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
  computedAt: '2026-09-24T00:00:00.000Z',
}

const seedCompletedRun = (extra: Record<string, unknown> = {}) => {
  useCanvasStore.setState({
    nodes: [{ id: FACTOR_ID, type: 'factor', position: { x: 0, y: 0 }, data: UNVALUED }],
    edges: [], ceeAnalysisReady: null, viewMode: 'standard', lodRung: 'full',
    analysisStateV1: null, analysisFreshness: FRESH_VERDICT, analysisFreshnessDirty: false,
    importPendingServerRegistration: false, currentScenarioId: 'driver-v31-scenario',
    v5AnalysisFact: {
      scenarioId: 'driver-v31-scenario', analysisHash: 'run-1', hasRunAnalysisFact: true,
    },
    hasCompletedFirstRun: true,
    results: { status: 'complete', hash: 'run-1', report: {
      option_probabilities: {
        opt_a: { status: 'computed', win_probability: 0.6 },
        opt_b: { status: 'computed', win_probability: 0.4 },
      },
      robustness: { near_tie: { is_tie: false, top_option_id: 'opt_a' } },
    } },
    ...extra,
  } as never)
}

const editTheModel = () => act(() => useCanvasStore.setState({ analysisFreshnessDirty: true }))

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

beforeEach(() => {
  displayMetadata = metadata(null, 6, 3, 0.12)
})

afterEach(() => {
  cleanup()
  useCanvasStore.setState({
    analysisStateV1: null, analysisFreshness: null, analysisFreshnessDirty: false,
    v5AnalysisFact: null, results: { status: 'idle', report: null }, lodRung: 'full',
    viewMode: 'standard',
  } as never)
})

describe('contract v3.1 pt 5 — an UNRANKED factor shows no rank, no line and no bar', () => {
  it('Standard view, current run: no driver line or bar; AT hears "Not ranked in this run"', () => {
    seedCompletedRun()
    renderFactor()
    expect(semantic()).toBe('current')
    // Contrast: the card mounted.
    expect(screen.getByTestId('node-title')).toBeTruthy()
    expect(screen.queryByTestId('factor-driver-line')).toBeNull()
    expect(screen.queryByTestId('factor-driver-line-bar')).toBeNull()
    expect(document.body.textContent).not.toContain('Structural influence')
    const notRanked = screen.getByTestId('factor-driver-not-ranked')
    expect(notRanked.textContent).toBe('Not ranked in this run')
    // Nothing on the card face: an out-of-flow statement only.
    expect(notRanked.className).toContain('sr-only')
  })

  it('Detailed view: no Detailed driver line either, and the statement is said ONCE', () => {
    seedCompletedRun({ viewMode: 'expert' })
    renderFactor()
    expect(screen.getByTestId('node-title')).toBeTruthy()
    expect(screen.queryByTestId('factor-driver-line-detail')).toBeNull()
    expect(screen.getAllByTestId('factor-driver-not-ranked')).toHaveLength(1)
  })

  it('stale run: the statement takes the stale form "Last run · Not ranked"', () => {
    seedCompletedRun()
    renderFactor()
    editTheModel()
    expect(semantic()).toBe('changed')
    expect(screen.getByTestId('factor-driver-not-ranked').textContent).toBe('Last run · Not ranked')
    expect(screen.queryByTestId('factor-driver-line')).toBeNull()
  })

  it('never-run: no "Not ranked" claim — no past analysis is invented', () => {
    seedCompletedRun({ results: { status: 'idle', report: null }, v5AnalysisFact: null, hasCompletedFirstRun: false })
    renderFactor()
    expect(screen.getByTestId('node-title')).toBeTruthy()
    expect(screen.queryByTestId('factor-driver-not-ranked')).toBeNull()
    expect(screen.queryByTestId('factor-driver-line')).toBeNull()
  })

  it('cannot-confirm: no "Not ranked" claim and no line', () => {
    seedCompletedRun({ analysisFreshness: { ...FRESH_VERDICT, freshness: 'unknown', freshnessReason: 'cee_unknown' } })
    renderFactor()
    expect(semantic()).toBe('cannot_confirm')
    expect(screen.getByTestId('node-title')).toBeTruthy()
    expect(screen.queryByTestId('factor-driver-not-ranked')).toBeNull()
    expect(screen.queryByTestId('factor-driver-line')).toBeNull()
  })
})

describe('ED 5806207128 — a RANKED factor reads "Driver N of M analysed", M = the eligible analysed factors', () => {
  it('current run: M is the analysed set (6), never the ranked count (3)', () => {
    displayMetadata = metadata(2, 6, 3, 0.57)
    seedCompletedRun()
    renderFactor()
    expect(semantic()).toBe('current')
    const caption = popoverLine('factor-driver-line-caption').textContent
    expect(caption).toBe('Driver 2 of 6 analysed')
    expect(caption).not.toContain('of 3')
    // The line keeps its bar, and says nothing about being unranked.
    expect(popoverLine('factor-driver-line-bar')).toBeTruthy()
    expect(screen.queryByTestId('factor-driver-not-ranked')).toBeNull()
    // Hover/description define the denominator.
    expect(popoverLine().getAttribute('aria-description')).toContain(
      '“of 6” counts the factors in the last analysis.',
    )
  })

  it('DISCRIMINATING — a different analysed set prints a different M (4), whatever the ranked count', () => {
    displayMetadata = metadata(1, 4, 2, 1)
    seedCompletedRun()
    renderFactor()
    expect(popoverLine('factor-driver-line-caption').textContent).toBe('Driver 1 of 4 analysed')
  })

  it('stale run: "Last run · Driver N of M analysed", and the name still opens with it', () => {
    displayMetadata = metadata(2, 6, 3, 0.57)
    seedCompletedRun()
    renderFactor()
    editTheModel()
    expect(semantic()).toBe('changed')
    expect(popoverLine('factor-driver-line-caption').textContent).toBe('Last run · Driver 2 of 6 analysed')
    const line = popoverLine()
    expect(line.getAttribute('aria-label')).toMatch(/^Last run · Driver 2 of 6 analysed\. /)
    expect(line.getAttribute('aria-description')).toContain('“of 6” counts the factors in the last analysis.')
  })

  it('reduced line: the same caption and the same stale form', () => {
    displayMetadata = metadata(2, 6, 3, 0.57)
    seedCompletedRun({ lodRung: 'line' })
    renderFactor()
    expect(screen.getByTestId('node-lod-line-text').textContent).toBe('Driver 2 of 6 analysed')
    editTheModel()
    expect(screen.getByTestId('node-lod-line-text').textContent).toBe('Last run · Driver 2 of 6 analysed')
  })

  it('the ranked count still GUARDS publication: a rank beyond it states no rank (fail closed)', () => {
    displayMetadata = metadata(3, 6, 2, 0.4)
    seedCompletedRun()
    renderFactor()
    expect(semantic()).toBe('current')
    expect(screen.getByTestId('node-title')).toBeTruthy()
    expect(screen.queryByTestId('factor-driver-line')).toBeNull()
  })

  it('pt 9: the bar is neutral and thinner (30 × 3px track, text-light fill)', () => {
    displayMetadata = metadata(1, 6, 3, 1)
    seedCompletedRun()
    renderFactor()
    // 30 × 3px counter-scaled with the caption (audit F3; NODE-ANATOMY v3.2).
    const track = new Set(popoverLine('factor-driver-line-bar').className.split(/\s+/))
    expect(track.has('h-[calc(3px*var(--canvas-label-scale,1))]')).toBe(true)
    expect(track.has('w-[calc(30px*var(--canvas-label-scale,1))]')).toBe(true)
    expect(popoverLine('factor-driver-line-bar-fill').className).toContain('bg-text-light')
  })
})
