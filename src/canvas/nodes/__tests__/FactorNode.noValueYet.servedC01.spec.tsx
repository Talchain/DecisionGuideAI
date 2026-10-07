/**
 * ⭐ PJ-B3 ON THE CARD — a factor the run ranked but held NO value for never
 * shows a bare "Driver N of M" (Canvas owner, 28 Sep 2026; R&C #72 5866297058).
 *
 * THE DEFECT, served: DL run `pj-20260928T075802Z/C01` ranks "Monthly churn" #2
 * in `factor_sensitivity` with no `value_source` and no `observed_state`
 * value. The coaching card says "has no value yet … that ranking comes from how
 * the model is built, not from your figures"; this card printed "Driver 2 of M".
 *
 * THE OWNER'S RULING, pinned here by factor id:
 *   1. the rank stays, and the card adds "no value yet";
 *   2. in the slot, the longest owner form that fits at the landing bound
 *      (`Driver 2 · no value yet`; stale `Last run · no value yet`);
 *   3. the accessible name and the hover carry the full sentence;
 *   4. same caption style — no new colour or badge.
 *
 * ⚠ REAL PATH, NOT A MOCKED HOOK. The report is the product's own
 * `mapV5AnalysisToReport` over the served journey-C `analysis_result`
 * (`fixtures/served-pj-c-213830Z.unvalued-drivers.json`, CEE #2154's fixture,
 * verbatim), and `useNodeDisplayMetadata` is NOT mocked: the feed, the rank
 * rule and the no-value fact are the product's. `c01Shaped` makes the ONE
 * change C01 carries — #1 "Pro paying subscribers" valued — so exactly one
 * ranked row lacks a `value_source` while the others carry one.
 *
 * CLAIM SCOPE: jsdom — strings, test ids, classes and accessible names; the
 * width claim uses the Chromium-measured advances (`__helpers__/driverCaptionFit.ts`).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { FactorNode } from '../FactorNode'
import { useCanvasStore } from '../../store'
import { useAnalysisTrust } from '../../hooks/useAnalysisTrust'
import { mapV5AnalysisToReport } from '../../../v5/mapV5AnalysisToReport'
import { attentionPlanFor } from '../shared/useNodeAttention'
import { MAX_LABEL_COUNTER_SCALE } from '../../utils/zoomLegibility'
import { FACTOR_SLOT_MEASURE_PX, captionWidthPx } from './__helpers__/driverCaptionFit'
import servedC from './fixtures/served-pj-c-213830Z.unvalued-drivers.json'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

type Row = { factor_id: string; value_source?: string }
type Block = { enrichment: { factor_sensitivity: Row[] } }

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T
const served = (): Block => clone(servedC.analysis_block) as unknown as Block
/** C01: #1 valued (the one change); #2 "Monthly churn" still carries no `value_source`. */
function c01Shaped(): Block {
  const block = served()
  block.enrichment.factor_sensitivity.find((r) => r.factor_id === 'pro_paying_subscribers')!.value_source = 'brief_extraction'
  return block
}
function allValued(): Block {
  const block = served()
  for (const r of block.enrichment.factor_sensitivity) r.value_source ??= 'cee_inference'
  return block
}
function noneCarry(): Block {
  const block = served()
  for (const r of block.enrichment.factor_sensitivity) delete r.value_source
  return block
}

const FACTORS = servedC.draft.nodes as ReadonlyArray<{ id: string; label: string }>
const FRESH_VERDICT = { freshness: 'fresh', freshnessReason: 'graph_hash_match', computedAt: '2026-09-28T07:58:02.000Z' }

function seed(block: Block, extra: Record<string, unknown> = {}) {
  const report = mapV5AnalysisToReport(block as never)
  useCanvasStore.setState({
    nodes: FACTORS.map((n, i) => ({
      id: n.id, type: 'factor', position: { x: i * 300, y: 0 },
      data: { label: n.label, type: 'factor' },
    })),
    edges: [], ceeAnalysisReady: null, viewMode: 'standard', lodRung: 'full',
    analysisStateV1: null, analysisFreshness: FRESH_VERDICT, analysisFreshnessDirty: false,
    importPendingServerRegistration: false, currentScenarioId: 'pj-c01',
    v5AnalysisFact: { scenarioId: 'pj-c01', analysisHash: 'run-1', hasRunAnalysisFact: true },
    hasCompletedFirstRun: true,
    results: { status: 'complete', hash: 'run-1', report },
    ...extra,
  } as never)
  return report
}

function TrustProbe() {
  return <span data-testid="trust-probe" data-semantic={useAnalysisTrust().semantic} />
}
const semantic = () => screen.getByTestId('trust-probe').getAttribute('data-semantic')

function renderBoard(block: Block, extra: Record<string, unknown> = {}) {
  seed(block, extra)
  return render(
    <ReactFlowProvider>
      <TrustProbe />
      {FACTORS.map((n) => (
        <FactorNode
          key={n.id}
          id={n.id} type="factor" data={{ label: n.label, type: 'factor' } as never} selected={false}
          isConnectable positionAbsoluteX={0} positionAbsoluteY={0}
          dragging={false} zIndex={0} deletable selectable draggable
        />
      ))}
    </ReactFlowProvider>,
  )
}

const band = (id: string) => screen.getByTestId(`factor-bottom-marks-${id}`)
const caption = (id: string) => within(band(id)).queryByTestId('factor-driver-line-caption')?.getAttribute('aria-label') ?? null
const lineOf = (id: string) => within(band(id)).getByTestId('factor-driver-line')
const nameOf = (id: string) => lineOf(id).getAttribute('aria-label') ?? ''

const FULL_SENTENCE = 'Driver 2 of 2 ranked in this run — ranked by how the model is built; this factor has no value yet'

afterEach(() => {
  cleanup()
  useCanvasStore.setState({
    analysisStateV1: null, analysisFreshness: null, analysisFreshnessDirty: false,
    v5AnalysisFact: null, results: { status: 'idle', report: null }, lodRung: 'full',
    viewMode: 'standard', nodes: [],
  } as never)
})

describe('the owner\'s second condition (Canvas, 28 Sep 2026): the factor must ALSO hold no stated value now', () => {
  it('a row with no value_source on a factor that DOES hold a value on the canvas says nothing extra (PLoT omits value_source for some factors)', () => {
    const block = c01Shaped()
    const report = mapV5AnalysisToReport(block as never)
    useCanvasStore.setState({
      nodes: FACTORS.map((n, i) => ({
        id: n.id, type: 'factor', position: { x: i * 300, y: 0 },
        data: n.id === 'monthly_churn'
          ? { label: n.label, type: 'factor', observed_state: { value: 0.03, display_value: '3% / month' } }
          : { label: n.label, type: 'factor' },
      })),
      edges: [], ceeAnalysisReady: null, viewMode: 'standard', lodRung: 'full',
      analysisStateV1: null, analysisFreshness: FRESH_VERDICT, analysisFreshnessDirty: false,
      importPendingServerRegistration: false, currentScenarioId: 'pj-c01',
      v5AnalysisFact: { scenarioId: 'pj-c01', analysisHash: 'run-1', hasRunAnalysisFact: true },
      hasCompletedFirstRun: true,
      results: { status: 'complete', hash: 'run-1', report },
    } as never)
    render(
      <ReactFlowProvider>
        {FACTORS.map((n) => (
          <FactorNode
            key={n.id}
            id={n.id} type="factor" data={{ label: n.label, type: 'factor' } as never} selected={false}
            isConnectable positionAbsoluteX={0} positionAbsoluteY={0}
            dragging={false} zIndex={0} deletable selectable draggable
          />
        ))}
      </ReactFlowProvider>,
    )
    expect(caption('monthly_churn')).toBe('Driver 2 of 2 ranked')
    expect(nameOf('monthly_churn')).not.toMatch(/no value yet/)
  })
})

describe('C01: Monthly churn keeps its rank and says "no value yet"; the valued #1 is unchanged', () => {
  it('the slot prints the longest owner form that fits at the landing bound — "Driver 2 · no value yet"', () => {
    renderBoard(c01Shaped())
    expect(semantic()).toBe('current')
    expect(caption('monthly_churn')).toBe('Driver 2 · no value yet')
    // The valued #1 is exactly as before (contrast inside the same board).
    expect(caption('pro_paying_subscribers')).toBe('Driver 1 of 2 ranked')
    expect(nameOf('pro_paying_subscribers')).toMatch(/^Driver 1 of 2 ranked in this run\. Ranked by how strongly/)
    // The levers the run did not rank still show no rank at all.
    expect(caption('pro_plan_price')).toBeNull()
  })

  it('the accessible name carries the owner’s full sentence (and the bar), not the value question', () => {
    renderBoard(c01Shaped())
    const name = nameOf('monthly_churn')
    expect(name.startsWith(`${FULL_SENTENCE}. `), name).toBe(true)
    expect(name).toContain('Bar: relative sensitivity, 50% of the top-ranked driver.')
    expect(name).not.toContain('How sure are you of its value?')
    expect(name).not.toContain('Ranked by how strongly the comparison responds')
    // Label in name: the visible words appear, in order, in the name.
    expect(name).toMatch(/^Driver 2 .*no value yet/)
  })

  it('the hover carries the same full sentence', async () => {
    renderBoard(c01Shaped())
    fireEvent.mouseEnter(lineOf('monthly_churn'))
    const tip = await screen.findByRole('tooltip')
    expect(tip).toHaveTextContent(FULL_SENTENCE)
  })

  it('no new colour or badge: the caption keeps the valued line’s exact classes', () => {
    renderBoard(c01Shaped())
    const cls = (id: string) => within(band(id)).getByTestId('factor-driver-line-caption').className
    expect(cls('monthly_churn')).toBe(cls('pro_paying_subscribers'))
    expect(within(band('monthly_churn')).queryByTestId(/badge/)).toBeNull()
  })

  it('stale: "Last run · no value yet"; the name keeps the rank under the same label', () => {
    renderBoard(c01Shaped())
    act(() => useCanvasStore.setState({ analysisFreshnessDirty: true }))
    expect(semantic()).toBe('changed')
    expect(caption('monthly_churn')).toBe('Last run · no value yet')
    expect(nameOf('monthly_churn').startsWith(
      'Last run · Driver 2 of 2 ranked — ranked by how the model is built; this factor has no value yet. ',
    )).toBe(true)
    expect(caption('pro_paying_subscribers')).toBe('Last run · Driver 1 of 2')
  })

  it('Detailed (free-flowing, wraps): the whole rank sentence plus "no value yet"', () => {
    renderBoard(c01Shaped(), { viewMode: 'expert' })
    const detail = screen.getAllByTestId('factor-driver-line-detail-caption').map((el) => el.getAttribute('aria-label'))
    expect(detail).toContain('Driver 2 of 2 ranked in this run · no value yet')
    expect(detail).toContain('Driver 1 of 2 ranked in this run')
  })

  it('every slot caption on the board, fresh and stale, fits the 220px measure at the landing bound', () => {
    const seen: string[] = []
    for (const stale of [false, true]) {
      cleanup()
      renderBoard(c01Shaped())
      if (stale) act(() => useCanvasStore.setState({ analysisFreshnessDirty: true }))
      for (const el of screen.getAllByTestId('factor-driver-line-caption')) {
        const text = el.textContent ?? ''
        seen.push(text)
        expect(captionWidthPx(text, MAX_LABEL_COUNTER_SCALE), text).toBeLessThanOrEqual(FACTOR_SLOT_MEASURE_PX)
      }
    }
    expect(seen).toEqual(['Driver 1 of 2 ranked', 'Driver 2 · no value yet', 'Last run · Driver 1 of 2', 'Last run · no value yet'])
  })

  it('far zoom: the reduced line states the same fitted words, never a bare rank', () => {
    renderBoard(c01Shaped(), { lodRung: 'line' })
    const lod = (id: string) =>
      within(screen.getByTestId(`factor-driver-slot-${id}`).closest('[role="group"]') as HTMLElement)
        .getByTestId('node-lod-line-text').textContent
    expect(lod('monthly_churn')).toBe('Driver 2 · no value yet')
    expect(lod('pro_paying_subscribers')).toBe('Driver 1 of 2 ranked in this run')
  })

  it('"Worth reviewing": the reason on Monthly churn says the same, and asks for the value', () => {
    const report = seed(c01Shaped())
    const nodes = FACTORS.map((n) => ({ id: n.id, type: 'factor', data: { label: n.label, type: 'factor' } }))
    const plan = attentionPlanFor(nodes as never, report, true, [], [], false)
    const reasons = plan.reasonsByNode.get('monthly_churn')?.filter((r) => r.kind === 'top_driver').map((r) => r.label)
    expect(reasons).toEqual([`${FULL_SENTENCE}. What is its value today?`])
    expect(plan.reasonsByNode.get('pro_paying_subscribers')?.find((r) => r.kind === 'top_driver')?.label)
      .toBe('Driver 1 of 2 ranked in this run: the comparison responds strongly to it. How sure are you of its value?')
  })
})

describe('CONTROLS — the words need the typed fact AND its contrast', () => {
  it('every row valued → Monthly churn reads "Driver 2 of 2 ranked", no "no value yet" anywhere', () => {
    renderBoard(allValued())
    expect(caption('monthly_churn')).toBe('Driver 2 of 2 ranked')
    expect(nameOf('monthly_churn')).toMatch(/^Driver 2 of 2 ranked in this run\. /)
    expect(document.body.textContent).not.toContain('no value yet')
  })

  it('NO row carries value_source (older payloads) → no "no value yet", the rank as before', () => {
    renderBoard(noneCarry())
    // Positive control: the rank is still there, so the silence is the rule's.
    expect(caption('monthly_churn')).toBe('Driver 2 of 2 ranked')
    expect(caption('pro_paying_subscribers')).toBe('Driver 1 of 2 ranked')
    expect(document.body.textContent).not.toContain('no value yet')
  })
})

describe('served journey C (both ranked rows unvalued): both cards say it', () => {
  it('Driver 1 and Driver 2 each add "no value yet"', () => {
    renderBoard(served())
    expect(caption('pro_paying_subscribers')).toBe('Driver 1 · no value yet')
    expect(caption('monthly_churn')).toBe('Driver 2 · no value yet')
  })
})
