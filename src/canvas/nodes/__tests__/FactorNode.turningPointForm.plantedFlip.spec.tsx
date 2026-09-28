/**
 * ⭐ THE TURNING POINT'S FORM ON THE RESTING CARD — post-run side-by-side DIFF
 * item 10 (27 Sep 2026, `canvas-8ffc-work/sbs-post/DIFF.md`), against contract
 * v3.1 `flipPlot` and point 3.
 *
 * Contract: `Below 6.5%, the current model comparison changes.` (at most two
 * lines), then a FULL-WIDTH track — a 2px line, a FILLED Info-blue diamond at
 * the threshold, a 7px dark dot at the current value, labels beneath. The
 * served card (planted 17d1, below) read `Below 700 GBP MRR added per month,
 * the current model comparison shifts towards Keep current £49 price.` over
 * three lines, beside a 54×4 track with a hollow body-ink diamond.
 *
 * ⚠⚠ PLANTED DATA, SAID ONCE AND LOUDLY. Neither real MRR run carries a found
 * turning point on a ranked factor at rest: 17d1's `other_mrr_growth` row is
 * `structurally_invariant` (the precondition test pins that). The one edit is
 * the DIFF's own (`sbs-post/shootpost.mjs`, `mrr-17d1cd3a-plantedflip`):
 * that row → `found`, 1000 → 700, display scale, alternative "Keep current £49
 * price". The planted DOMAIN (last block) is a second, separate edit: no
 * producer emits a display range today (plot-lite-service `staging`
 * `flip-threshold-denormaliser.ts`, 28 Sep 2026), so the to-scale form is only
 * reachable with planted data, and the served boards keep the not-to-scale one.
 *
 * Everything else is REAL: the served block through the product's own
 * `mapV5AnalysisToReport`, the draft's own node mapped by `mapDraftNodeToCanvas`
 * (so the card's value line and unit are the served ones), and the rank rule,
 * the display policy and the freshness verdict are the product's, unmocked.
 *
 * CLAIM SCOPE: jsdom — strings, test ids, classes and inline positions. Line
 * count at 1280×800 is a layout claim: the browser capture is its evidence
 * (`canvas-8ffc-work/r3/design/after-mrr-17d1cd3a-plantedflip-*`).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within, fireEvent } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { FactorNode } from '../FactorNode'
import { useCanvasStore } from '../../store'
import { mapDraftNodeToCanvas } from '../../utils/applyDraftResult'
import { mapV5AnalysisToReport } from '../../../v5/mapV5AnalysisToReport'
import fx17d1 from '../../../../e2e/geometry/fixtures/mrr-17d1cd3a.fixture.json'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

type Row = Record<string, unknown>
type WireNode = { id: string; kind: string } & Record<string, unknown>
const FACTOR = 'other_mrr_growth'

const FRESH_VERDICT = {
  freshness: 'fresh', freshnessReason: 'graph_hash_match',
  computedAt: '2026-09-28T00:00:00.000Z',
}

/** The served block, deep-copied, with the flip row of `other_mrr_growth` replaced by `edit(row)`. */
function blockWith(edit: ((row: Row) => Row) | null): Row {
  const block = JSON.parse(JSON.stringify(fx17d1.analysis_block)) as { enrichment: { flip_thresholds: Row[] } }
  if (edit) {
    const rows = block.enrichment.flip_thresholds
    const i = rows.findIndex((r) => r.factor_id === FACTOR)
    rows[i] = edit(rows[i])
  }
  return block as unknown as Row
}

/** ⚠ PLANTED — the DIFF's own edit (`shootpost.mjs`), verbatim in its fields. */
const PLANTED_FLIP = (row: Row): Row => ({
  ...row,
  flip_reason: 'found', no_flip_in_range: false, direction: 'decrease', value_scale: 'display',
  current_value: 1000, flip_value: 700,
  current_display: '1000 GBP MRR added per month', flip_display: '700 GBP MRR added per month',
  alternative_winner_id: 'keep_current_49_price', alternative_winner_label: 'Keep current £49 price',
})

/** ⚠ PLANTED, SEPARATELY — a stated display range on the same planted row. */
const PLANTED_DOMAIN = (row: Row): Row => ({ ...PLANTED_FLIP(row), display_range_min: 0, display_range_max: 2000 })

function renderFactor(block: Row, { stale = false }: { stale?: boolean } = {}) {
  const report = mapV5AnalysisToReport(block as never)
  const factors = (fx17d1.draft.nodes as WireNode[]).filter((n) => n.kind === 'factor')
  const mapped = factors.map((n, i) => {
    const m = mapDraftNodeToCanvas(n) as { id: string; data: Record<string, unknown> }
    return { id: m.id, type: 'factor', position: { x: i * 300, y: 0 }, data: { ...m.data, type: 'factor' } }
  })
  useCanvasStore.setState({
    nodes: mapped,
    edges: [], ceeAnalysisReady: null, viewMode: 'standard', lodRung: 'full',
    analysisStateV1: null, analysisFreshness: FRESH_VERDICT, analysisFreshnessDirty: false,
    importPendingServerRegistration: false, currentScenarioId: 'mrr-planted-flip',
    v5AnalysisFact: { scenarioId: 'mrr-planted-flip', analysisHash: 'run-1', hasRunAnalysisFact: true },
    hasCompletedFirstRun: true,
    results: { status: 'complete', hash: 'run-1', report },
  } as never)
  if (stale) useCanvasStore.getState().markAnalysisFreshnessDirty()
  const node = mapped.find((n) => n.id === FACTOR)!
  return render(
    <ReactFlowProvider>
      <FactorNode
        id={FACTOR} type="factor" data={node.data as never} selected={false}
        isConnectable positionAbsoluteX={0} positionAbsoluteY={0}
        dragging={false} zIndex={0} deletable selectable draggable
      />
    </ReactFlowProvider>,
  )
}

const tp = () => screen.getByTestId('factor-turning-point')
const inTp = (id: string) => within(tp()).getByTestId(id)
const queryInTp = (id: string) => within(tp()).queryByTestId(id)

afterEach(() => {
  cleanup()
  useCanvasStore.setState({
    analysisStateV1: null, analysisFreshness: null, analysisFreshnessDirty: false,
    v5AnalysisFact: null, results: { status: 'idle', report: null }, lodRung: 'full',
    viewMode: 'standard', nodes: [],
  } as never)
})

describe('PRECONDITION — the real run shows no turning point here, so the found row below is PLANTED', () => {
  it('17d1 served: other_mrr_growth is structurally_invariant and its card paints no track', () => {
    const served = (fx17d1.analysis_block.enrichment.flip_thresholds as Row[]).find((r) => r.factor_id === FACTOR)!
    expect(served.flip_reason).toBe('structurally_invariant')
    expect(served.unit).toBe('GBP MRR added per month')
    renderFactor(blockWith(null))
    expect(screen.queryByTestId('factor-turning-point')).toBeNull()
    // Contrast from the same render: the card is ranked (the at-rest gate).
    expect(screen.getByTestId('factor-driver-line-caption').textContent).toBe('Driver 1 of 2 ranked')
  })
})

describe('⭐ PLANTED flip — the caption is the contract sentence in the card\'s notation', () => {
  it('reads "Below £700, the current model comparison changes." — no raw unit, no scope on the card', () => {
    renderFactor(blockWith(PLANTED_FLIP))
    expect(inTp('factor-turning-point-caption').textContent).toBe('Below £700, the current model comparison changes.')
    expect(tp().textContent).not.toMatch(/GBP|MRR added per month/)
    expect(tp().textContent).not.toContain('shifts towards')
  })

  it('the scope the producer named is kept one step away: in the spoken name and the tooltip', async () => {
    renderFactor(blockWith(PLANTED_FLIP))
    const name = tp().getAttribute('aria-label') ?? ''
    // Label in Name: the visible sentence opens it; the scope and the unit in full follow.
    expect(name.startsWith('Below £700, the current model comparison changes. It shifts towards Keep current £49 price. ')).toBe(true)
    expect(name).toContain('The track marks the turning point (£700 MRR added / month) and £1,000 MRR added / month in this run')
    expect(name).toContain('spacing is not to scale and shows no uncertainty.')
    fireEvent.mouseEnter(tp())
    const tip = await screen.findByRole('tooltip')
    expect(tip.textContent!.startsWith('It shifts towards Keep current £49 price. The track marks')).toBe(true)
  })

  it('the card\'s own value line reads in the same notation (one owner: `compactUnitParts`)', () => {
    renderFactor(blockWith(PLANTED_FLIP))
    const value = screen.getByTestId('factor-recorded-value').textContent ?? ''
    expect(value.replace(/\s+/g, ' ')).toContain('£1,000 MRR added / month')
  })

  it('stale: "Last run · " opens the caption and the run\'s value is the last run\'s', () => {
    renderFactor(blockWith(PLANTED_FLIP), { stale: true })
    expect(inTp('factor-turning-point-caption').textContent).toBe('Last run · Below £700, the model comparison changes.')
    expect(inTp('factor-turning-point-run-value').textContent).toBe('£1,000 in last run')
    expect(tp().getAttribute('aria-label')).toContain('In that run it shifts towards Keep current £49 price.')
  })
})

describe('⭐ PLANTED flip — the track is the contract\'s: full width, filled Info diamond, 7px dot, labels beneath', () => {
  it('no domain on the wire → the NOT-TO-SCALE form, declared as such', () => {
    renderFactor(blockWith(PLANTED_FLIP))
    const plot = inTp('factor-turning-point-plot')
    expect(plot.getAttribute('data-scale')).toBe('not-to-scale')
    const track = inTp('factor-turning-point-track')
    // Full width, a 2px line in the design system's border token — no fixed 54px.
    expect(track.className).toContain('w-full')
    expect(track.className).not.toMatch(/min-w-\[54px\]/)
    expect(track.className).toContain('h-[calc(2px*var(--canvas-label-scale,1))]')
    expect(track.className).toContain('bg-border-emphasis')
    // The threshold: a FILLED Info-blue diamond (contract `fill="#277A9D"`), not a hollow outline.
    const flip = inTp('factor-turning-point-flip')
    expect(flip.className).toMatch(/\bbg-info\b/)
    expect(flip.className).toContain('rotate-45')
    expect(flip.className).not.toMatch(/\bborder-2\b|\bbg-panel\b/)
    // The run's value: a 7px dark dot.
    const current = inTp('factor-turning-point-current')
    expect(current.className).toContain('rounded-full')
    expect(current.className).toContain('bg-text-body')
    expect(current.className).toContain('w-[calc(7px*var(--canvas-label-scale,1))]')
    // In order of value: 700 < 1,000, so the diamond is left of the dot.
    expect(parseFloat(flip.style.left)).toBeLessThan(parseFloat(current.style.left))
    // The label sits BENEATH the line (a row of its own), in the card's notation;
    // the turning point's number is in the caption, printed once.
    const label = inTp('factor-turning-point-run-value')
    expect(label.textContent).toBe('£1,000 in this run')
    expect(track.contains(label)).toBe(false)
    expect(plot.lastElementChild!.contains(label)).toBe(true)
    expect(queryInTp('factor-turning-point-value')).toBeNull()
    // No domain ends are invented.
    expect(queryInTp('factor-turning-point-domain-min')).toBeNull()
    expect(queryInTp('factor-turning-point-domain-max')).toBeNull()
  })

  it('PLANTED DOMAIN (0–2,000) → drawn TO SCALE, both ends labelled, and the name says what the range is', () => {
    renderFactor(blockWith(PLANTED_DOMAIN))
    expect(inTp('factor-turning-point-plot').getAttribute('data-scale')).toBe('domain')
    expect(parseFloat(inTp('factor-turning-point-flip').style.left)).toBeCloseTo(35, 6)
    expect(parseFloat(inTp('factor-turning-point-current').style.left)).toBeCloseTo(50, 6)
    expect(inTp('factor-turning-point-domain-min').textContent).toBe('£0')
    expect(inTp('factor-turning-point-domain-max').textContent).toBe('£2,000')
    expect(inTp('factor-turning-point-run-value').textContent).toBe('£1,000 in this run')
    const name = tp().getAttribute('aria-label') ?? ''
    expect(name).toContain('The track is a £0–£2,000 display range, not uncertainty;')
    expect(name).not.toContain('not to scale')
  })

  it('⛔ a stated range that cannot hold the run\'s value is not this track\'s domain → not to scale', () => {
    renderFactor(blockWith((row) => ({ ...PLANTED_FLIP(row), display_range_min: 0, display_range_max: 900 })))
    expect(inTp('factor-turning-point-plot').getAttribute('data-scale')).toBe('not-to-scale')
    expect(queryInTp('factor-turning-point-domain-max')).toBeNull()
  })
})
