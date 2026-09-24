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
