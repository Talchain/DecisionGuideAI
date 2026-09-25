/**
 * ⭐ AT THE LANDING ZOOM THE CHANGE ROWS STACK; AT ORDINARY NORMAL ZOOM THEY KEEP
 * THE CONTRACT GRID (S5, 24 Sep 2026 — Paul: "the content on the nodes is an
 * absolute mess"; "make it fit on a standard laptop screen").
 *
 * ⛔ UPDATED LATER ON 24 Sep 2026: THE LANDING ZOOM IS NO LONGER THE `quiet` RUNG.
 * Paul's ruling "the landing view counts as Normal zoom" (gap-audit row 3) moved
 * the `full` floor from `ICON_LEGIBLE_ZOOM` (≈0.714) to `LABEL_LEGIBLE_ZOOM` (0.5),
 * so the landing band (0.5–0.53) is now `full` and the resting icons show there.
 * `quiet` is reached only by zooming OUT past the landing floor. The ruling named
 * icons, not row layout, and the measurement below is why the rows did not
 * follow the rung: they keep the grid only at or above the OLD Normal floor
 * (`anchorRailFloor.selectAtOrAboveIconLegibleZoom`), and stack below it —
 * landing included. The last describe block pins this through the REAL zoom
 * (`resolveLodRung` + `anchorRailFitsBesideAtZoom`), not a hand-set rung.
 *
 * MEASURED on the S3+S4 build (Chromium, 1440×900, dock open, `market-entry`,
 * landing zoom 0.5 → `--canvas-label-scale` 2, then the `quiet` rung): the contract grid
 * `minmax(0,1fr) fit-content(60%)` gives the LABEL column 45px on screen, so
 * "Germany market…" wrapped onto FOUR lines (dt 45×55px) and the option card
 * stood 171px tall carrying two rows; `vendor-selection` 222px. The grid is the
 * contract's rule at 100% (`.delta-rows`), where the label column holds ~22
 * characters; at the counter-scale bound it holds ~6. The layout reserves every
 * card's height AT that bound (`measureNodeHeightsAtLabelBound`), so those wrapped
 * lines are paid for in the whole graph's height — the fit Paul asked for.
 *
 * So below Normal zoom (the rung the contract calls far: "readable identity"),
 * each row is two full-width lines — label, then value + mark — and at Normal
 * zoom it is the contract grid, unchanged. Same rows, same order, same bytes.
 *
 * HEIGHT SAFETY (why this cannot overlap the row beneath): the layout measures
 * at scale 2. If it measures at `quiet`, it reserves the STACKED height at scale
 * 2; a later zoom to `full` renders the GRID at scale ≤ 1.47, whose rows are
 * shorter (smaller type AND a wider label column). (Since the floor above, the
 * grid renders only at zoom ≥ `ICON_LEGIBLE_ZOOM`, i.e. scale ≤ 1.4.) If it measures at `full`, it
 * reserves the GRID at scale 2 — the tallest form of all. Both directions leave
 * the reservation ≥ the rendered card. The browser geometry gates are the pixel
 * witness; this file pins the DOM contract (trap 3: jsdom proves no pixels).
 *
 * ⭐ RE-POINTED BY THE BOUNDED ANATOMY (ED #63 5809278282, 24 Sep 2026: "The
 * fuller S3 reasoning detail — change rows … — can move to the existing
 * hover/focus popover and inspector rather than expanding layout geometry").
 * In STANDARD view the rows left the card body for the option's popover, which
 * is portalled outside the React Flow transform (`--canvas-label-scale` is 1
 * there at every rung) — so there the stack is moot and the rows are ALWAYS the
 * contract grid. The stack/grid switch survives where the rows still sit inline
 * on the card: DETAILED view. Both halves are pinned below; nothing was deleted.
 */
/**
 * ⭐ CONTRACT v3.1 — THE OPTION CARD'S POLISH DELTAS, PINNED BY IDENTITY.
 *
 * Source: `olumi-canvas-visual-contract-v31.html` <style> + fixture, and Paul's
 * 23 Sep points (9: "make the driver bar neutral, so it does not compete with
 * attention"; 13: bounded heights, no truncated reasoning). Each block names
 * the audited delta id it pins. Every assertion is bound to a test id, an exact
 * class token or exact text — never a value predicate another element could
 * satisfy — and each one fails on the pre-change card (`3eb22326`).
 *
 * CLAIM SCOPE (CLAUDE.md trap 3): jsdom. These prove the CLASS TOKENS, TEXT and
 * DOM ORDER the card emits. They do not prove rendered pixels; the height
 * argument for each change is in the component's own comments.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { OptionNode } from '../OptionNode'
import { resolveLodRung, ICON_LEGIBLE_ZOOM, LABEL_LEGIBLE_ZOOM } from '../../utils/zoomLegibility'
import { anchorRailFitsBesideAtZoom, setAnchorRailFitsBeside } from '../shared/anchorRailFloor'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

const FACTOR_HEAD = {
  id: 'f-head', type: 'factor',
  data: { label: 'Developer headcount', type: 'factor', observedState: { value: 0, unit: 'count' }, unit: 'count' },
}
const FACTOR_COST = { id: 'f-cost', type: 'factor', data: { label: 'Coordination cost', type: 'factor' } }
const FACTOR_RISK = { id: 'f-risk', type: 'factor', data: { label: 'Delivery risk', type: 'factor' } }
const OPTION_1 = { id: 'option-1', type: 'option', data: { label: 'Hire two developers', type: 'option' } }
const OPTION_2 = { id: 'option-2', type: 'option', data: { label: 'Hire a tech lead', type: 'option' } }
const BASELINE_SETS_VALUES = {
  id: 'option-b', type: 'option',
  data: { label: 'Status quo', type: 'option', is_baseline: true, interventions: { 'f-head': { value: 0, display_value: '0 engineers' } } },
}
const CEE_READY = {
  options: [
    { id: 'option-1', interventions: { 'f-head': { value: 3, display_value: '3 engineers' } } },
    { id: 'option-2', interventions: { 'f-cost': 5 } },
  ],
}

let winRate: number | null = null

const makeStoreState = (overrides: Record<string, unknown> = {}) => ({
  hoveredOptionId: null,
  nodes: [FACTOR_HEAD, FACTOR_COST, FACTOR_RISK, OPTION_1, OPTION_2, BASELINE_SETS_VALUES],
  edges: [],
  ceeAnalysisReady: CEE_READY,
  results: { status: 'idle' },
  highlightedNodes: new Set(),
  dimmedNodeIds: new Set(),
  lens: { _dimmedNodeIds: new Set() },
  goalThreshold: null,
  goalConstraints: [],
  setHoveredOption: vi.fn(),
  viewMode: 'standard',
  ...overrides,
})

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector) => selector(makeStoreState())),
}))

vi.mock('../shared/NodePopover', () => ({
  NodePopover: ({ children }: { children: React.ReactNode }) => <div data-testid="node-popover">{children}</div>,
}))

vi.mock('../../layoutStore', () => ({
  useLayoutStore: vi.fn(((selector: (s: { layoutNodeWidth: number | null }) => unknown) =>
    selector({ layoutNodeWidth: null })) as unknown as (...args: never[]) => unknown),
}))

vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => ({
    sensitivityRank: null,
    influence: null,
    confidence: null,
    inSensitivityAnalysis: false,
    achievementProbability: null,
    stabilityPercentage: null,
    winRate,
    isResultsMode: useCanvasStore((state) => state.results.status) === 'complete',
    predictedOutcome: null,
    valueOfInformation: null,
    voiRank: null,
  })),
}))

import { useCanvasStore } from '../../store'

const baseProps = {
  type: 'option',
  position: { x: 0, y: 0 },
  selected: false,
  isConnectable: true,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  dragging: false,
  zIndex: 0,
  deletable: true,
  selectable: true,
  draggable: true,
}

const renderCard = (
  { id = 'option-1', data = {}, store = {} }: { id?: string; data?: Record<string, unknown>; store?: Record<string, unknown> } = {},
) => {
  vi.mocked(useCanvasStore).mockImplementation((selector) => selector(makeStoreState(store) as any))
  return render(
    <ReactFlowProvider>
      <OptionNode {...baseProps} id={id} data={{ label: 'Hire two developers', type: 'option', ...data }} />
    </ReactFlowProvider>,
  )
}

const rowsEl = () => screen.getByTestId('option-change-rows-option-1')
const listEl = () => rowsEl().querySelector('dl') as HTMLElement
const rowText = () => screen.getByTestId('option-change-row-option-1-f-head').textContent
const inPopover = (el: Element) => document.querySelector('[data-testid="node-popover"]')?.contains(el) ?? false

describe('S5: in DETAILED view the inline change rows stack below Normal zoom, grid at Normal zoom', () => {
  beforeEach(() => { winRate = null; setAnchorRailFitsBeside(true) })
  const expert = { viewMode: 'expert' }

  it('quiet rung (reached only by zooming out past the landing floor): rows are STACKED — no two-column grid', () => {
    renderCard({ store: { ...expert, lodRung: 'quiet' } })
    // Precondition: Detailed keeps the rows ON THE CARD (not the popover).
    expect(inPopover(rowsEl())).toBe(false)
    expect(rowsEl().getAttribute('data-row-layout')).toBe('stacked')
    expect(listEl().className).not.toMatch(/grid-cols-\[/)
    const dd = screen.getByTestId('option-change-row-option-1-f-head')
    expect(dd.className.split(/\s+/)).toContain('text-left')
    expect(dd.className.split(/\s+/)).not.toContain('text-right')
  })

  it('line rung: also stacked', () => {
    renderCard({ store: { ...expert, lodRung: 'line' } })
    expect(rowsEl().getAttribute('data-row-layout')).toBe('stacked')
  })

  it('CONTRAST — full rung (Normal zoom): the contract grid, unchanged', () => {
    renderCard({ store: { ...expert, lodRung: 'full' } })
    expect(rowsEl().getAttribute('data-row-layout')).toBe('grid')
    expect(listEl().className).toContain('grid-cols-[minmax(0,1fr)_fit-content(calc((100%_-_8px)*0.6))]')
    const dd = screen.getByTestId('option-change-row-option-1-f-head')
    expect(dd.className.split(/\s+/)).toContain('text-right')
  })

  it('IDENTITY — the same row carries byte-identical text in both layouts', () => {
    const a = renderCard({ store: { ...expert, lodRung: 'full' } })
    const full = rowText()
    a.unmount()
    renderCard({ store: { ...expert, lodRung: 'quiet' } })
    expect(rowText()).toBe(full)
    expect(full).toContain('3 engineers')
  })
})

/**
 * ⭐ STANDARD VIEW: THE ROWS ARE ON THE CARD, THE CONTRACT GRID AT EVERY RUNG
 * (Paul 25 Sep: the prototype's resting rows supersede ED 5809278282's popover
 * placement). The Standard rows never stack: each label is ONE CSS-truncating
 * line (its full text in its title) and the value wraps if it must, so the body
 * is identical at every rung — no rung-triggered re-layout. The Detailed stack
 * above is unchanged.
 */
describe('resting anatomy: in STANDARD view the rows are ON THE CARD, the contract grid at EVERY rung', () => {
  beforeEach(() => { winRate = null })

  for (const lodRung of ['quiet', 'line', 'full'] as const) {
    it(`${lodRung} rung: the card rows are the grid, rendered once, and never in the popover`, () => {
      renderCard({ store: { lodRung } })
      expect(inPopover(rowsEl()), 'the rows render on the card').toBe(false)
      expect(document.querySelectorAll('[data-testid="option-change-rows-option-1"]').length).toBe(1)
      expect(rowsEl().getAttribute('data-row-layout')).toBe('grid')
      expect(listEl().className).toContain('grid-cols-[minmax(0,1fr)_fit-content(calc((100%_-_8px)*0.6))]')
    })
  }

  it('IDENTITY — the card row\'s value is byte-identical to the Detailed inline row', () => {
    const a = renderCard({ store: { viewMode: 'expert', lodRung: 'quiet' } })
    const inline = rowText()
    a.unmount()
    renderCard({ store: { lodRung: 'quiet' } })
    expect(inPopover(screen.getByTestId('option-change-row-option-1-f-head'))).toBe(false)
    expect(rowText()).toBe(inline)
  })
})

/**
 * ⭐ DRIVEN BY THE REAL ZOOM, NOT A HAND-SET RUNG. Both inputs the card reads are
 * derived from one zoom exactly as `LodSync` derives them from the viewport: the
 * rung (`resolveLodRung`, no previous rung — a fresh landing) and the old-Normal
 * floor (`anchorRailFitsBesideAtZoom`).
 */
describe('Detailed change rows at the REAL landing zoom: rung is Normal, rows still STACK', () => {
  const expert = { viewMode: 'expert' }
  const renderAtZoom = (zoom: number) => {
    setAnchorRailFitsBeside(anchorRailFitsBesideAtZoom(zoom))
    return renderCard({ store: { ...expert, lodRung: resolveLodRung(zoom) } })
  }
  beforeEach(() => { winRate = null; setAnchorRailFitsBeside(true) })

  for (const zoom of [LABEL_LEGIBLE_ZOOM, 0.53]) {
    it(`landing zoom ${zoom}: the rung IS Normal (the ruling) and the rows are STACKED (the measured fit)`, () => {
      expect(resolveLodRung(zoom), 'precondition: landing counts as Normal').toBe('full')
      renderAtZoom(zoom)
      expect(rowsEl().getAttribute('data-row-layout')).toBe('stacked')
      expect(listEl().className).not.toMatch(/grid-cols-\[/)
    })
  }

  it('CONTRAST — at the old Normal floor and above: the contract grid', () => {
    for (const zoom of [ICON_LEGIBLE_ZOOM, 1]) {
      const r = renderAtZoom(zoom)
      expect(rowsEl().getAttribute('data-row-layout'), `zoom ${zoom}`).toBe('grid')
      r.unmount()
    }
  })

  it('CONTRAST — zoomed out past the landing floor (quiet): stacked', () => {
    const zoom = 0.48
    expect(resolveLodRung(zoom), 'precondition').toBe('quiet')
    renderAtZoom(zoom)
    expect(rowsEl().getAttribute('data-row-layout')).toBe('stacked')
  })
})
