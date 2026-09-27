/**
 * ⭐ THE FACTOR DRIVER LINE ON PAUL'S TWO REAL MRR RUNS — side-by-side DIFF
 * items 3, 4 and 11 (27 Sep 2026, `canvas-8ffc-work/sbs-post/DIFF.md`).
 *
 * Authority: NODE-ANATOMY v3.2 factor row ("ONLY if the run RANKED it:
 * `Driver N of M ranked in this run` + thin neutral bar") and contract v3.1
 * point 5, ACCEPTED by Paul: "M is the number of factors the run ranked. Show
 * every one of the M ranks on its card … Stale form: `Last run · Driver N of M
 * ranked`." The contract's `driver()` draws the bar at `n.relative` — relative
 * sensitivity with rank 1 = 100 (fixture 100/57/34) — and its detail says "Bar
 * length is relative to the strongest ranked factor in the same model".
 *
 * What the served canvas did on these runs (the DIFF, measured in-page):
 *   (3) 17d1: `Driver 1 of 5 analysed`, `Driver 2 of 5 analysed`, then three
 *       factor cards with no rank — "of 5" counted factors the canvas never
 *       ranks, so the missing 3–5 read as accidentally omitted (Paul pt 5).
 *   (4) the rank is ordered by sensitivity, but the bar was `influence_score`
 *       over the max of ALL factors — `pro_plan_price` (1.0), a factor the card
 *       calls unranked — so Driver 1 drew 81% "of the strongest factor".
 *   (11) stale at landing: `Last run · Driver 1 of 6 analys…` (truncated).
 *
 * ⚠ REAL DATA, NOT A HAND FIXTURE. The report is the product's own
 * `mapV5AnalysisToReport` over each board's served `analysis_result` block
 * (`e2e/geometry/fixtures/mrr-*.fixture.json`, the same block the geometry
 * harness hydrates through `applyV5State`), and `useNodeDisplayMetadata` is NOT
 * mocked: the rank rule, the tie gate and the feed are the product's. Freshness
 * is not mocked either (`changed` comes from the real composed verdict).
 *
 * ⚠ IDENTITY-BOUND. Every row binds a factor id to its slot's test id and an
 * exact string. The expected bar figures are pinned as literals worked from the
 * wire's own `sensitivity_score` (the magnitude the feed ranks on for these
 * blocks, `extractPolicyRow`), and cross-checked against the wire in the same
 * test — not recomputed through the product's code:
 *   17d1: |0.40|, |0.15|           → 100%, 37.5% → 38%
 *   90b8: |−0.48875|, |0.40|, |0.15| → 100%, 81.8% → 82%, 30.7% → 31%
 *
 * CLAIM SCOPE: jsdom — strings, test ids, inline widths and accessible names.
 * Not pixels. Whether a caption FITS at landing (item 11) is a width claim: the
 * last test budgets each rendered caption with Chromium-measured Inter advances
 * (`__helpers__/driverCaptionFit.ts`); the browser measurement is the evidence.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, within } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { FactorNode } from '../FactorNode'
import { useCanvasStore } from '../../store'
import { useAnalysisTrust } from '../../hooks/useAnalysisTrust'
import { mapV5AnalysisToReport } from '../../../v5/mapV5AnalysisToReport'
import fx17d1 from '../../../../e2e/geometry/fixtures/mrr-17d1cd3a.fixture.json'
import fx90b8 from '../../../../e2e/geometry/fixtures/mrr-90b8f080.fixture.json'
import { MAX_LABEL_COUNTER_SCALE } from '../../utils/zoomLegibility'
import { FACTOR_SLOT_MEASURE_PX, captionWidthPx } from './__helpers__/driverCaptionFit'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

/** The two boards' JSON differ in shape (90b8 carries `win_probabilities`), so read both through the fields used. */
type Fixture = {
  draft: { nodes: ReadonlyArray<unknown> }
  analysis_block: { enrichment: { factor_sensitivity: ReadonlyArray<unknown> } }
}
type WireRow = { factor_id: string; sensitivity_score?: number }

const FRESH_VERDICT = {
  freshness: 'fresh', freshnessReason: 'graph_hash_match',
  computedAt: '2026-09-27T00:00:00.000Z',
}

const factorsOf = (fx: Fixture) =>
  (fx.draft.nodes as ReadonlyArray<{ id: string; kind: string; label: string }>).filter((n) => n.kind === 'factor')

function seed(fx: Fixture) {
  const report = mapV5AnalysisToReport(fx.analysis_block as never)
  useCanvasStore.setState({
    nodes: factorsOf(fx).map((n, i) => ({
      id: n.id, type: 'factor', position: { x: i * 300, y: 0 },
      data: { label: n.label, type: 'factor' },
    })),
    edges: [], ceeAnalysisReady: null, viewMode: 'standard', lodRung: 'full',
    analysisStateV1: null, analysisFreshness: FRESH_VERDICT, analysisFreshnessDirty: false,
    importPendingServerRegistration: false, currentScenarioId: 'mrr-real-run',
    v5AnalysisFact: { scenarioId: 'mrr-real-run', analysisHash: 'run-1', hasRunAnalysisFact: true },
    hasCompletedFirstRun: true,
    results: { status: 'complete', hash: 'run-1', report },
  } as never)
}

function TrustProbe() {
  return <span data-testid="trust-probe" data-semantic={useAnalysisTrust().semantic} />
}
const semantic = () => screen.getByTestId('trust-probe').getAttribute('data-semantic')

function renderBoard(fx: Fixture) {
  seed(fx)
  return render(
    <ReactFlowProvider>
      <TrustProbe />
      {factorsOf(fx).map((n) => (
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

const slot = (id: string) => screen.getByTestId(`factor-driver-slot-${id}`)
const caption = (id: string) => within(slot(id)).queryByTestId('factor-driver-line-caption')?.textContent ?? null
const lineOf = (id: string) => within(slot(id)).getByTestId('factor-driver-line')
const fillWidth = (id: string) => within(slot(id)).getByTestId('factor-driver-line-bar-fill').style.width

/** Every factor card on the board that SHOWS a rank — the set M must count. */
const shownRanks = (fx: Fixture) => factorsOf(fx).filter((n) => caption(n.id) !== null).map((n) => n.id)

const wireSensitivity = (fx: Fixture, id: string) => {
  const rows = fx.analysis_block.enrichment.factor_sensitivity as ReadonlyArray<WireRow>
  const row = rows.find((r) => r.factor_id === id)
  if (!row || typeof row.sensitivity_score !== 'number') throw new Error(`no wire sensitivity for ${id}`)
  return Math.abs(row.sensitivity_score)
}

afterEach(() => {
  cleanup()
  useCanvasStore.setState({
    analysisStateV1: null, analysisFreshness: null, analysisFreshnessDirty: false,
    v5AnalysisFact: null, results: { status: 'idle', report: null }, lodRung: 'full',
    viewMode: 'standard', nodes: [],
  } as never)
})

describe('item 3 — M is the ranked set, and every one of the M ranks is shown', () => {
  it('17d1 (5 factors, 2 ranked): "Driver 1 of 2" and "Driver 2 of 2", ranked in this run; the other 3 carry no rank', () => {
    renderBoard(fx17d1)
    expect(semantic()).toBe('current')
    expect(caption('other_mrr_growth')).toBe('Driver 1 of 2 ranked in this run')
    expect(caption('pro_paying_subscribers')).toBe('Driver 2 of 2 ranked in this run')
    for (const id of ['monthly_churn', 'monthly_new_pro_subscribers', 'pro_plan_price']) {
      expect(caption(id), `${id} shows no rank`).toBeNull()
      // Contrast: the card mounted, and its AT statement says why there is no rank.
      expect(within(slot(id).closest('[role="group"]') as HTMLElement).getByTestId('factor-driver-not-ranked').textContent)
        .toBe('Not ranked in this run')
    }
    // ⭐ THE DENOMINATOR IS CHECKABLE BY COUNTING: M equals the cards that show a rank.
    expect(shownRanks(fx17d1)).toEqual(['pro_paying_subscribers', 'other_mrr_growth'])
    expect(document.body.textContent).not.toMatch(/of 5 analysed/)
  })

  it('90b8 (6 factors, 3 ranked): 1, 2 and 3 "of 3 ranked in this run", and exactly 3 cards show a rank', () => {
    renderBoard(fx90b8)
    expect(semantic()).toBe('current')
    expect(caption('fac_existing_customers_grandfathered')).toBe('Driver 1 of 3 ranked in this run')
    expect(caption('other_mrr_growth')).toBe('Driver 2 of 3 ranked in this run')
    expect(caption('pro_paying_subscribers')).toBe('Driver 3 of 3 ranked in this run')
    expect(shownRanks(fx90b8)).toHaveLength(3)
    for (const id of ['pro_plan_price', 'monthly_churn', 'monthly_new_pro_subscribers']) {
      expect(caption(id), `${id} shows no rank`).toBeNull()
    }
  })

  it('the hover/description defines M as the ranked count and says why other factors carry no rank', () => {
    renderBoard(fx17d1)
    const note = lineOf('other_mrr_growth').getAttribute('aria-description') ?? ''
    expect(note).toContain('This run ranked 2 factors by relative sensitivity; each shows its own rank.')
    expect(note).not.toMatch(/counts the factors in the last analysis/)
  })
})

describe('item 4 — the bar is relative sensitivity, rank 1 = 100%, monotone with rank', () => {
  it('wire cross-check: the literals below are |sensitivity_score| over rank 1’s, from the served block', () => {
    const r17 = wireSensitivity(fx17d1, 'pro_paying_subscribers') / wireSensitivity(fx17d1, 'other_mrr_growth')
    expect(Math.round(r17 * 100)).toBe(38)
    const top = wireSensitivity(fx90b8, 'fac_existing_customers_grandfathered')
    expect(Math.round((wireSensitivity(fx90b8, 'other_mrr_growth') / top) * 100)).toBe(82)
    expect(Math.round((wireSensitivity(fx90b8, 'pro_paying_subscribers') / top) * 100)).toBe(31)
  })

  it('17d1: Driver 1 draws 100% (it drew 81% of an unranked factor), Driver 2 draws 38%', () => {
    renderBoard(fx17d1)
    expect(fillWidth('other_mrr_growth')).toBe('max(4px, 100%)')
    expect(fillWidth('pro_paying_subscribers')).toBe('max(4px, 38%)')
  })

  it('90b8: 100% / 82% / 31% for ranks 1 / 2 / 3', () => {
    renderBoard(fx90b8)
    expect(fillWidth('fac_existing_customers_grandfathered')).toBe('max(4px, 100%)')
    expect(fillWidth('other_mrr_growth')).toBe('max(4px, 82%)')
    expect(fillWidth('pro_paying_subscribers')).toBe('max(4px, 31%)')
  })

  it('the accessible name says what the bar is relative to — the top-ranked driver, not "the strongest factor"', () => {
    renderBoard(fx90b8)
    const name = lineOf('other_mrr_growth').getAttribute('aria-label') ?? ''
    expect(name).toMatch(/^Driver 2 of 3 ranked in this run\. /)
    expect(name).toContain('Bar: relative sensitivity, 82% of the top-ranked driver.')
    expect(name).not.toContain('of the strongest factor')
    expect(name).not.toMatch(/structural influence/i)
    expect(lineOf('fac_existing_customers_grandfathered').getAttribute('aria-label'))
      .toContain('Bar: relative sensitivity, 100% of the top-ranked driver.')
  })
})

describe('item 11 — the stale caption drops "in this run" so it fits: "Last run · Driver N of M ranked"', () => {
  it('90b8 stale: every ranked card reads the short stale form, and the name still opens with it', () => {
    renderBoard(fx90b8)
    act(() => useCanvasStore.setState({ analysisFreshnessDirty: true }))
    expect(semantic()).toBe('changed')
    expect(caption('fac_existing_customers_grandfathered')).toBe('Last run · Driver 1 of 3 ranked')
    expect(caption('other_mrr_growth')).toBe('Last run · Driver 2 of 3 ranked')
    expect(caption('pro_paying_subscribers')).toBe('Last run · Driver 3 of 3 ranked')
    expect(lineOf('other_mrr_growth').getAttribute('aria-label')).toMatch(/^Last run · Driver 2 of 3 ranked\. /)
    expect(lineOf('other_mrr_growth').getAttribute('aria-description'))
      .toContain('The last run ranked 3 factors by relative sensitivity; each shows its own rank.')
    // The stale bar is the SAME last-run figure, not re-derived.
    expect(fillWidth('other_mrr_growth')).toBe('max(4px, 82%)')
  })

  it('17d1 stale: "Last run · Driver 2 of 2 ranked" (was "… 2 of 5 analys…" at landing)', () => {
    renderBoard(fx17d1)
    act(() => useCanvasStore.setState({ analysisFreshnessDirty: true }))
    expect(semantic()).toBe('changed')
    expect(caption('pro_paying_subscribers')).toBe('Last run · Driver 2 of 2 ranked')
  })

  it('item 11 on the real boards: every ranked caption, fresh and stale, fits its slot on its own at the landing bound; the bar is whole or wrapped away', () => {
    // A WIDTH claim, from Chromium-measured Inter advances (jsdom has no
    // layout; `__helpers__/driverCaptionFit.ts`). The first fix pinned class
    // tokens here and the caption still ellipsised: 201 > 200 in Chromium.
    const seen: string[] = []
    for (const fx of [fx17d1, fx90b8]) {
      for (const stale of [false, true]) {
        cleanup()
        renderBoard(fx)
        if (stale) act(() => useCanvasStore.setState({ analysisFreshnessDirty: true }))
        const lines = screen.getAllByTestId('factor-driver-line')
        expect(lines.length).toBeGreaterThan(0)
        for (const line of lines) {
          const text = within(line).getByTestId('factor-driver-line-caption').textContent ?? ''
          seen.push(text)
          expect(captionWidthPx(text, MAX_LABEL_COUNTER_SCALE), text).toBeLessThanOrEqual(FACTOR_SLOT_MEASURE_PX)
          // The bar never shrinks, so its fill always reads against the whole track.
          const bar = within(line).getByTestId('factor-driver-line-bar').className.split(/\s+/)
          expect(bar).toContain('shrink-0')
          expect(bar.some((t) => t.includes('flex-shrink') || t === 'min-w-0')).toBe(false)
          expect(line.className.split(/\s+/)).toContain('flex-wrap')
        }
      }
    }
    // Positive control: both forms were actually measured (2 + 3 ranked cards, fresh and stale).
    expect(seen).toHaveLength(10)
    expect(seen).toContain('Driver 1 of 3 ranked in this run')
    expect(seen).toContain('Last run · Driver 1 of 2 ranked')
  })
})
