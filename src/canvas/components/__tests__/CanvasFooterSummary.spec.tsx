/**
 * CanvasFooterSummary — DESIGN-GAP-AUDIT row 6 (MISSING, 24 Sep 2026,
 * gap-frame-footer lane).
 *
 * Contract v3.1 `.canvas-foot`: "Model-relative findings · 11 nodes · 17
 * connections" plus a "Visual key" link. Bound by identity (testids, exact
 * text) and by a CONTRAST case (ghost cards/edges must not inflate the
 * count) — the property that made this genuinely new rather than a rename.
 *
 * Uses the REAL `useCanvasStore` (zustand), the same convention
 * `FirstModelNotice.spec.tsx` and `StarterProvenanceBanner`'s siblings use —
 * not a mock one level below the component, since the count IS the store's
 * `nodes`/`edges` filtered by the shared `isGhostNode` predicate, and a mock
 * would test that the component reads a number rather than that it derives
 * the right one.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import type { Edge, Node } from '@xyflow/react'
import type { EdgeData } from '../../domain/edges'
import { useCanvasStore } from '../../store'
import { CanvasFooterSummary, composeCanvasFooterLine } from '../CanvasFooterSummary'
import { OVERLAY_PRIORITY } from '../CanvasOverlayBand'
import { GHOST_OPTION_NODE_ID } from '../../utils/fitTargets'

const node = (id: string, type = 'decision'): Node =>
  ({ id, type, position: { x: 0, y: 0 }, data: { type, label: id } }) as unknown as Node
const edge = (id: string, source: string, target: string): Edge<EdgeData> =>
  ({ id, source, target, data: {} }) as unknown as Edge<EdgeData>

afterEach(() => {
  cleanup()
  useCanvasStore.setState({ nodes: [], edges: [] })
})

describe('composeCanvasFooterLine — the counted, pluralised sentence', () => {
  it('states the contract’s exact shape for a plural count', () => {
    expect(composeCanvasFooterLine(11, 17)).toBe('Model-relative findings · 11 nodes · 17 connections')
  })

  it('singular nodes and connections do not read as plurals', () => {
    expect(composeCanvasFooterLine(1, 1)).toBe('Model-relative findings · 1 node · 1 connection')
  })

  it('zero connections is stated, not hidden — a model with no edges is a real state', () => {
    expect(composeCanvasFooterLine(3, 0)).toBe('Model-relative findings · 3 nodes · 0 connections')
  })
})

describe('CanvasFooterSummary — declared in the band', () => {
  it('is declared in bottom-left, alongside lens-info-panel', () => {
    expect(OVERLAY_PRIORITY['bottom-left']).toContain('canvas-footer-summary')
    expect(OVERLAY_PRIORITY['bottom-left']).toContain('lens-info-panel')
  })
})

describe('CanvasFooterSummary — renders real counts', () => {
  it('counts real nodes and edges', () => {
    useCanvasStore.setState({
      nodes: [node('q'), node('o1', 'option'), node('o2', 'option')],
      edges: [edge('e1', 'q', 'o1'), edge('e2', 'q', 'o2')],
    })
    render(<CanvasFooterSummary />)
    expect(screen.getByTestId('canvas-footer-summary-text').textContent).toBe(
      'Model-relative findings · 3 nodes · 2 connections',
    )
  })

  it('CONTRAST — a ghost row-end prompt card is NOT counted as a node, nor its edge as a connection', () => {
    useCanvasStore.setState({
      nodes: [node('q'), node('o1', 'option'), node(GHOST_OPTION_NODE_ID, 'option')],
      // A structural edge into the ghost, exactly the shape a row-end prompt
      // would carry if one were ever wired — excluded on EITHER endpoint.
      edges: [edge('e1', 'q', 'o1'), edge('e-ghost', 'q', GHOST_OPTION_NODE_ID)],
    })
    render(<CanvasFooterSummary />)
    expect(screen.getByTestId('canvas-footer-summary-text').textContent).toBe(
      'Model-relative findings · 2 nodes · 1 connection',
    )
  })

  it('renders the "Visual key" trigger, which opens the SAME legend the toolbar uses', () => {
    useCanvasStore.setState({ nodes: [node('q')], edges: [] })
    render(<CanvasFooterSummary />)
    const trigger = screen.getByTestId('canvas-footer-visual-key')
    expect(trigger.textContent).toBe('Visual key')
    expect(screen.queryByTestId('canvas-legend-popover')).toBeNull()
    fireEvent.click(trigger)
    expect(screen.getByTestId('canvas-legend-popover')).toBeInTheDocument()
  })

  it('renders nothing on an empty canvas — no model, no claim', () => {
    useCanvasStore.setState({ nodes: [], edges: [] })
    const { container } = render(<CanvasFooterSummary />)
    expect(container.firstChild).toBeNull()
  })
})

/**
 * ⛔ THE FOOTER YIELDS; IT NEVER RENDERS AS A CLIPPED COLUMN.
 *
 * Served 25 Sep on UI `580d135b` (deploy `6ab5f3822afa870008107e6e`), 1280x800,
 * dock open, "Saved example" banner showing:
 * - the band's columns read `0px 644px 0px`;
 * - the footer drew 70px wide and 5 lines tall (90px), its bottom at 814px on
 *   an 800px viewport, overlapping the banner.
 * Same mechanism as N3 (`CanvasOverlayBand.cueColumnReserve.spec.tsx`): the
 * `auto` centre track is sized before the `fr` side tracks.
 *
 * The banner is a provenance disclosure and outranks a standing count, so the
 * band does NOT reserve a floor for this cell (that would squeeze the banner
 * instead). The footer withdraws below the width at which it stops fitting the
 * band. Measured on the served build, the line heights by cell width are:
 * 160px → 54px (3 lines, inside the 64px band); 140px → 72px; 120px → 90px.
 * The "Visual key" legend stays reachable from the toolbar, so nothing but the
 * count line is missing while it withdraws.
 *
 * ⚠ SCOPE: jsdom computes no layout. These are STRUCTURAL pins, the same
 * convention as the cue's guard. The pixel readings are in the PR.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { CANVAS_FOOTER_MIN_WIDTH_PX, CANVAS_FOOTER_SUMMARY_TESTID } from '../CanvasFooterSummary'
import { OVERLAY_BAND_HEIGHT } from '../CanvasOverlayBand'

const FOOTER_CSS = (() => {
  try {
    return readFileSync(resolve(__dirname, '../CanvasFooterSummary.module.css'), 'utf8')
  } catch {
    return ''
  }
})()

describe('CanvasFooterSummary — withdraws instead of squeezing into a column', () => {
  it('the wrapper is an inline-size container that adds no width to the band', () => {
    expect(FOOTER_CSS).toMatch(/\.fit\s*\{[^}]*container-type:\s*inline-size/)
    expect(FOOTER_CSS).toMatch(/\.fit\s*\{[^}]*min-width:\s*0/)
  })

  it('the stylesheet hides the footer below CANVAS_FOOTER_MIN_WIDTH_PX, bound to one number', () => {
    const m = FOOTER_CSS.match(
      /@container\s*\(\s*max-width:\s*(\d+)px\s*\)\s*\{\s*\.footer\s*\{\s*display:\s*none/,
    )
    expect(m, 'an @container rule hiding .footer').not.toBeNull()
    expect(Number(m![1]) + 1).toBe(CANVAS_FOOTER_MIN_WIDTH_PX)
  })

  it('at the threshold the measured 3 lines of 18px still fit the band', () => {
    expect(CANVAS_FOOTER_MIN_WIDTH_PX).toBe(160)
    expect(3 * 18).toBeLessThanOrEqual(OVERLAY_BAND_HEIGHT)
  })

  it('renders the footer body inside the container wrapper', () => {
    useCanvasStore.setState({ nodes: [node('q'), node('o1', 'option')], edges: [] })
    render(<CanvasFooterSummary />)
    const body = screen.getByTestId(CANVAS_FOOTER_SUMMARY_TESTID)
    const fit = screen.getByTestId(`${CANVAS_FOOTER_SUMMARY_TESTID}-fit`)
    expect(fit.contains(body)).toBe(true)
    expect(fit).not.toBe(body)
  })
})
