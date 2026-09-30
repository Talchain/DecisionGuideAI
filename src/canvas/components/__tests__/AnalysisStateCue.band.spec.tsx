/**
 * AnalysisStateCue — the canvas FOOT line, painted BENEATH the graph.
 *
 * ⭐ THE DEFECT (canvas-8ffc sbs-post DIFF item 8, 27 Sep 2026). On Paul's
 * `mrr-90b8f080` board, stale landing at 1280x800, the cue rendered as a white
 * bordered pill at x 460.5–804, y 760–788 — the band's bottom-RIGHT cell — and
 * `elementFromPoint` at the Goal glyph centre (481, 770.8) and at the only
 * fragile-edge cue (495, 771.1) both returned `analysis-state-cue`. Contract
 * v3.1 puts the sentence in the canvas foot: small muted text, bottom-LEFT,
 * off the graph (`#canvasFoot`, 10px, muted).
 *
 * ⛔ WHY THE FIT INSET ALONE CANNOT FIX IT — measured, not assumed. The band is
 * ALREADY a `computeFitPadding` contributor (bottom inset = band + 16px), and
 * the cue still covered the Goal: 90b8 does not fit at the legibility floor,
 * so the landing fit clamps at 0.50 and TOP-ANCHORS (`useFitViewOnLayoutVersion`,
 * `topAnchoredViewportWhenClamped`), and the board overflows the pane's bottom
 * edge — the Goal card sat at y 772.5–821 in an 800px pane. On such a board no
 * bottom slot is card-free at landing, and moving an OVERLAY to bottom-left
 * would only move the collision: a 10px line from x 70 runs to ~x 325, across
 * the Goal title "MRR" (x 308–329, y 778.5–789.5 in the same dump).
 *
 * So the line keeps the band's bottom-left SLOT (arbitration, left edge, width)
 * but is PAINTED BENEATH THE GRAPH: it renders inside `.react-flow` (the
 * stacking context xyflow gives z-index 0) at a z-index below
 * `.react-flow__renderer`, so every card, edge and cue paints over it and no
 * hit-test can land on it. It cannot cover graph content in any camera state.
 *
 * ⚠ THE OLD PINS THIS FILE REPLACES encoded the defect itself: "declared in
 * the bottom-right cell" and "lands INSIDE the bottom-right cell" are exactly
 * the placement that drew the pill over the Goal.
 *
 * ⚠ SCOPE, STATED: jsdom computes no layout and applies no stylesheet. The
 * paint-order claim is pinned STRUCTURALLY — the cue's stylesheet z-index read
 * against xyflow's own stylesheet bytes, and the mount site read out of
 * `ReactFlowGraph.tsx` — never as a pixel reading.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, within, act } from '@testing-library/react'
import { createPortal } from 'react-dom'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createRequire } from 'node:module'

/** The composed verdict both the cue and the lens panel read — mutable, so the CONTRAST can say "current". */
const trust = vi.hoisted(() => ({ semantic: 'changed' as string }))
vi.mock('../../hooks/useAnalysisTrust', () => ({
  useAnalysisTrust: () => ({ semantic: trust.semantic }),
}))

import {
  CanvasOverlayBand,
  CanvasOverlayBandProvider,
  OVERLAY_BAND_BOTTOM,
  OVERLAY_BAND_HEIGHT,
  OVERLAY_BAND_LEFT_PAD,
  OVERLAY_BAND_SELECTOR,
  OVERLAY_PRIORITY,
  useOverlayCell,
  type OverlayCell,
} from '../CanvasOverlayBand'
import {
  AnalysisStateCue,
  ANALYSIS_STATE_CUE_COPY,
  ANALYSIS_STATE_CUE_MIN_WIDTH_PX,
  ANALYSIS_STATE_CUE_TESTID,
} from '../AnalysisStateCue'
import { LensInfoPanel, LENS_INFO_STALE_TESTID } from '../LensInfoPanel'
import { useCanvasStore } from '../../store'
import { LAST_RUN_PREFIX } from '../../nodes/shared/metricVocabulary'

const SLOT_TESTID = `${ANALYSIS_STATE_CUE_TESTID}-fit`

/** A stand-in claimant under a REAL id — the band arbitrates by id, not by component. */
function Claimant({ cell, id }: { cell: OverlayCell; id: string }) {
  const { granted, target } = useOverlayCell(cell, id)
  if (!granted) return null
  const body = <div data-testid={id}>{id}</div>
  return target ? createPortal(body, target) : body
}

/**
 * jsdom lays nothing out, so every rect is 0x0 — which the cue must read as a
 * starved cell. Give the band's bottom-left cell a real width, by identity.
 */
function stubLeftCellWidth(width: number) {
  const real = HTMLElement.prototype.getBoundingClientRect
  const spy = vi
    .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
    .mockImplementation(function (this: HTMLElement) {
      if (this.getAttribute('data-overlay-cell') === 'bottom-left') {
        return { x: OVERLAY_BAND_LEFT_PAD, y: 724, width, height: OVERLAY_BAND_HEIGHT, top: 724, left: OVERLAY_BAND_LEFT_PAD, right: OVERLAY_BAND_LEFT_PAD + width, bottom: 788, toJSON: () => ({}) } as DOMRect
      }
      return real.call(this)
    })
  return spy
}

afterEach(() => {
  vi.restoreAllMocks()
  trust.semantic = 'changed'
})

// The cue claims findings are shown as Last run, so every row here holds a renderable report (R3 fresh-browser oob).
beforeEach(() => {
  useCanvasStore.setState({ results: { status: 'complete', report: { option_comparison: [{ option_id: 'a', outcome: { mean: 1, p10: 0, p50: 1, p90: 2 } }] } } } as never)
})

const CUE_CSS = readFileSync(resolve(__dirname, '../AnalysisStateCue.module.css'), 'utf8')
const XYFLOW_CSS = readFileSync(
  createRequire(import.meta.url).resolve('@xyflow/react/dist/style.css'),
  'utf8',
)

/** The declaration block of `selector` (first match), or '' — comments stripped first. */
function ruleBody(css: string, selector: string): string {
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const re = new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`)
  return re.exec(stripped)?.[1] ?? ''
}
function zIndexOf(css: string, selector: string): number {
  const m = /z-index\s*:\s*(-?\d+)/.exec(ruleBody(css, selector))
  return m ? Number(m[1]) : Number.NaN
}

describe('AnalysisStateCue — the bottom-left foot line (DIFF item 8)', () => {
  it('claims the bottom-LEFT slot — the contract foot — and no longer the bottom-right one', () => {
    expect(OVERLAY_PRIORITY['bottom-left']).toContain(ANALYSIS_STATE_CUE_TESTID)
    expect(OVERLAY_PRIORITY['bottom-right']).not.toContain(ANALYSIS_STATE_CUE_TESTID)
  })

  it('a live, user-opened lens panel outranks it for the slot; it outranks the (ruled-off) footer caption', () => {
    const left = OVERLAY_PRIORITY['bottom-left']
    expect(left.indexOf('lens-info-panel')).toBeGreaterThanOrEqual(0)
    expect(left.indexOf('lens-info-panel')).toBeLessThan(left.indexOf(ANALYSIS_STATE_CUE_TESTID))
    expect(left.indexOf(ANALYSIS_STATE_CUE_TESTID)).toBeLessThan(left.indexOf('canvas-footer-summary'))
  })

  it('⭐ is NOT drawn inside the band — the band paints ABOVE the graph, so nothing in it may carry this line', () => {
    stubLeftCellWidth(363)
    const CENTRE = OVERLAY_PRIORITY['bottom-centre'][0]
    render(
      <CanvasOverlayBandProvider>
        <CanvasOverlayBand />
        <Claimant cell="bottom-centre" id={CENTRE} />
        <AnalysisStateCue />
      </CanvasOverlayBandProvider>,
    )
    const cue = screen.getByTestId(ANALYSIS_STATE_CUE_TESTID)
    expect(cue.textContent).toBe(ANALYSIS_STATE_CUE_COPY)
    expect(cue.closest('[data-overlay-cell]'), 'the cue was portalled into a band cell').toBeNull()
    expect(cue.closest(OVERLAY_BAND_SELECTOR), 'the cue was drawn inside the band').toBeNull()
    // The bottom-left cell it holds stays EMPTY, and the centre occupant keeps its own cell.
    const leftCell = document.querySelector('[data-overlay-cell="bottom-left"]')
    expect(leftCell?.childElementCount).toBe(0)
    expect(screen.getByTestId(CENTRE).closest('[data-overlay-cell]')?.getAttribute('data-overlay-cell')).toBe(
      'bottom-centre',
    )
  })

  it('occupies the band’s bottom-left SLOT: the band’s left pad, bottom gap, height, and its cell’s measured width', () => {
    stubLeftCellWidth(363)
    render(
      <CanvasOverlayBandProvider>
        <CanvasOverlayBand />
        <AnalysisStateCue />
      </CanvasOverlayBandProvider>,
    )
    const slot = screen.getByTestId(SLOT_TESTID)
    expect(slot.style.left).toBe(`${OVERLAY_BAND_LEFT_PAD}px`)
    expect(slot.style.bottom).toBe(`${OVERLAY_BAND_BOTTOM}px`)
    expect(slot.style.height).toBe(`${OVERLAY_BAND_HEIGHT}px`)
    expect(slot.style.width).toBe('363px')
  })


  it('withdraws when its cell is narrower than it can be read in — and not a pixel sooner', () => {
    expect(ANALYSIS_STATE_CUE_MIN_WIDTH_PX).toBe(200)
    const spy = stubLeftCellWidth(ANALYSIS_STATE_CUE_MIN_WIDTH_PX - 1)
    const { unmount } = render(
      <CanvasOverlayBandProvider>
        <CanvasOverlayBand />
        <AnalysisStateCue />
      </CanvasOverlayBandProvider>,
    )
    expect(screen.queryByTestId(ANALYSIS_STATE_CUE_TESTID)).toBeNull()
    unmount()
    spy.mockRestore()
    // CONTRAST: at the threshold itself it shows.
    stubLeftCellWidth(ANALYSIS_STATE_CUE_MIN_WIDTH_PX)
    render(
      <CanvasOverlayBandProvider>
        <CanvasOverlayBand />
        <AnalysisStateCue />
      </CanvasOverlayBandProvider>,
    )
    expect(screen.getByTestId(ANALYSIS_STATE_CUE_TESTID)).toBeInTheDocument()
  })

  it('⭐ PAINTS BENEATH THE GRAPH: its z-index sits between xyflow’s background and its renderer', () => {
    // Read from xyflow's OWN stylesheet — the one `ReactFlowGraph.tsx` imports —
    // so an xyflow upgrade that re-layers the renderer REDs this, rather than a
    // restated number drifting silently.
    const renderer = zIndexOf(XYFLOW_CSS, '.react-flow__renderer')
    const background = zIndexOf(XYFLOW_CSS, '.react-flow__background')
    expect(renderer, 'POSITIVE CONTROL: the renderer z-index is readable').toBe(4)
    expect(background, 'POSITIVE CONTROL: the background z-index is readable').toBe(-1)
    const slot = zIndexOf(CUE_CSS, '.slot')
    expect(Number.isFinite(slot), 'the foot line declares no z-index of its own').toBe(true)
    expect(slot, 'the line would paint OVER the cards (at or above the renderer)').toBeLessThan(renderer)
    expect(slot, 'the line would paint under the canvas ground and vanish').toBeGreaterThan(background)
    expect(ruleBody(CUE_CSS, '.slot')).toMatch(/position\s*:\s*absolute/)
    expect(ruleBody(CUE_CSS, '.slot')).toMatch(/pointer-events\s*:\s*none/)
  })

  it('⭐ is MOUNTED INSIDE the main <ReactFlow> — the only place a z-index below the renderer means “under the cards”', () => {
    const graph = readFileSync(resolve(__dirname, '../../ReactFlowGraph.tsx'), 'utf8')
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')
    // The main canvas is the <ReactFlow> that carries <LodSync /> ("main canvas only").
    const blocks = [...graph.matchAll(/<ReactFlow\b[\s\S]*?<\/ReactFlow>/g)].map((m) => m[0])
    const main = blocks.filter((b) => b.includes('<LodSync />'))
    expect(main, 'POSITIVE CONTROL: exactly one main <ReactFlow> block was found').toHaveLength(1)
    expect(main[0]).toContain('<AnalysisStateCue />')
    // …and nowhere else: a second mount outside the flow would paint over the graph again.
    expect(graph.match(/<AnalysisStateCue\b/g) ?? []).toHaveLength(1)
  })
})

/**
 * ⭐⭐ OUTRANKED IS NOT SILENCED (reviewer blocker on this change, 27 Sep 2026).
 *
 * The lens panel outranks the foot line for the bottom-left slot. On staging
 * (`VITE_FEATURE_GRAPH_LENS=true`) that meant: open the Robustness lens on a
 * changed-since-run model and the panel showed last-run figures —
 * `switch_probability` NN%, sensitive assumptions, "focus on X → Y", all from
 * `results.report` — while the one sentence that says they are LAST-RUN
 * figures had yielded the slot and rendered nothing. N3's rule is that the
 * whole-graph stale cue is never hidden by another occupant, so the occupant
 * that takes the slot takes the sentence with it.
 *
 * ⚠ These mount the REAL `LensInfoPanel` against the REAL band arbitration —
 * a stand-in claimant under the panel's id is what let the old "yields the
 * slot" pin assert the regression as if it were the design.
 */
describe('AnalysisStateCue — the stale fact survives a lens panel taking its slot', () => {
  const LENS_MODES = ['causal', 'evidence', 'robustness'] as const
  type LensModeOpen = (typeof LENS_MODES)[number]

  function seedLens(active: LensModeOpen | 'full') {
    localStorage.setItem('feature.graphLens', '1')
    useCanvasStore.setState({
      nodes: [
        { id: 'price', data: { label: 'Price' }, position: { x: 0, y: 0 } },
        { id: 'revenue', data: { label: 'Revenue' }, position: { x: 0, y: 0 } },
      ] as never,
      results: {
        status: 'complete',
        progress: 100,
        report: {
          robustness: {
            fragile_edges: [{ from_id: 'price', to_id: 'revenue', switch_probability: 0.85 }],
          },
        },
      } as never,
      lens: { ...useCanvasStore.getState().lens, active },
    } as never)
  }

  afterEach(() => {
    localStorage.removeItem('feature.graphLens')
    useCanvasStore.setState({
      results: { status: 'idle', progress: 0 } as never,
      nodes: [] as never,
      lens: { ...useCanvasStore.getState().lens, active: 'full' },
    } as never)
  })

  function renderLensAndCue() {
    stubLeftCellWidth(363)
    return render(
      <CanvasOverlayBandProvider>
        <CanvasOverlayBand />
        <LensInfoPanel />
        <AnalysisStateCue />
      </CanvasOverlayBandProvider>,
    )
  }

  /** Times the sentence is on screen, counted in the page's text — a second copy anywhere REDs. */
  function timesSaid(): number {
    return (document.body.textContent ?? '').split(ANALYSIS_STATE_CUE_COPY).length - 1
  }

  it.each(LENS_MODES)(
    '⭐ %s lens open on a changed model: the panel holds the slot AND says the stale sentence — once, on the canvas',
    (mode) => {
      seedLens(mode)
      renderLensAndCue()
      const panel = screen.getByTestId('lens-info-panel')
      // Precondition — the REAL panel won the slot through the band's arbitration.
      expect(panel.closest('[data-overlay-cell]')?.getAttribute('data-overlay-cell')).toBe('bottom-left')
      // One slot, one occupant: the foot line is not rendered…
      expect(screen.queryByTestId(ANALYSIS_STATE_CUE_TESTID)).toBeNull()
      // …and the fact it states is still on screen, in the occupant that displaced it.
      const stale = within(panel).getByTestId(LENS_INFO_STALE_TESTID)
      expect(stale.textContent).toBe(ANALYSIS_STATE_CUE_COPY)
      expect(stale.getAttribute('role')).toBe('status')
      expect(timesSaid(), 'the stale sentence must be said exactly once on the canvas').toBe(1)
    },
  )

  it('⭐ Robustness: the run figures are labelled `Last run ·`, and the stale sentence opens the panel above them', () => {
    seedLens('robustness')
    renderLensAndCue()
    const panel = screen.getByTestId('lens-info-panel')
    const figures = within(panel).getByTestId('lens-info-robustness')
    // POSITIVE CONTROL: the run's figures really are on screen, so the label below is not vacuous.
    expect(figures.textContent).toContain('85%')
    expect(figures.textContent).toContain('focus on: Price → Revenue')
    expect(within(panel).getByTestId('lens-info-robustness-heading').textContent).toBe(`${LAST_RUN_PREFIX}Robustness`)
    const stale = within(panel).getByTestId(LENS_INFO_STALE_TESTID)
    expect(
      stale.compareDocumentPosition(figures) & Node.DOCUMENT_POSITION_FOLLOWING,
      'the stale sentence must come before the figures it qualifies',
    ).toBeTruthy()
  })

  it('closing the lens hands the sentence back to the foot line in one render — still said once', () => {
    seedLens('robustness')
    renderLensAndCue()
    expect(within(screen.getByTestId('lens-info-panel')).getByTestId(LENS_INFO_STALE_TESTID)).toBeInTheDocument()
    act(() => {
      useCanvasStore.setState({ lens: { ...useCanvasStore.getState().lens, active: 'full' } } as never)
    })
    expect(screen.queryByTestId('lens-info-panel')).toBeNull()
    expect(screen.getByTestId(ANALYSIS_STATE_CUE_TESTID).textContent).toBe(ANALYSIS_STATE_CUE_COPY)
    expect(timesSaid()).toBe(1)
  })

  it('CONTRAST: the same panel on a CURRENT model shows the same figures with no stale sentence and no label', () => {
    trust.semantic = 'current'
    seedLens('robustness')
    renderLensAndCue()
    const panel = screen.getByTestId('lens-info-panel')
    // The same figures render — so the absences below are about the state, not a missing panel.
    expect(within(panel).getByTestId('lens-info-robustness').textContent).toContain('85%')
    expect(within(panel).queryByTestId(LENS_INFO_STALE_TESTID)).toBeNull()
    expect(within(panel).getByTestId('lens-info-robustness-heading').textContent).toBe('Robustness')
    expect(screen.queryByTestId(ANALYSIS_STATE_CUE_TESTID)).toBeNull()
    expect(timesSaid()).toBe(0)
  })
})
