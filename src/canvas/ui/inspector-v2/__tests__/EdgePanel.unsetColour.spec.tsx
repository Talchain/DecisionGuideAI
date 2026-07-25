/**
 * EdgePanel — the existence readout must not COLOUR a value nobody set.
 *
 * WHAT THIS PINS
 * --------------
 * `thresholdColor(v: number)` had three branches (`>= 0.7` green, `>= 0.4`
 * amber, else red) and no branch that could express "not set". An edge with no
 * `beliefExists` fell through to `EDGE_CONSTRAINTS.beliefExists.default` (0.7)
 * and an edge drawn with `USER_EDGE_DEFAULTS` carries 0.8 — so BOTH of the
 * states a real unset edge can be in rendered GREEN, underneath this same
 * panel's coaching sentence "Nobody has said how likely this connection is to
 * exist yet."
 *
 * CLAIM TYPE — read this before adding an assertion here.
 * ------------------------------------------------------
 * Every assertion below is a **rendered-attribute** claim: the `class` string
 * on the readout element, and the presence/absence of the track-fill node.
 * jsdom cannot prove VISIBILITY, contrast, or layout (platform trap 3), and no
 * test in this file claims any of those. "Green" here means *the element
 * carries `text-success`*, nothing more.
 *
 * REACHABILITY POSITIVE CONTROL
 * -----------------------------
 * The unset fixtures are not hand-written objects — `drawEdgeThroughProduct`
 * builds the edge through `useCanvasStore.addEdge` with `USER_EDGE_DEFAULTS`,
 * which is the exact call `ReactFlowGraph.tsx:1614` makes when a user drags a
 * connection. A gate that only fires for a fixture nobody can produce is the
 * dead read gate this whole track exists to close, so the "unset" branch is
 * proved reachable FROM THE PRODUCT, and the set-value cases below prove the
 * same code path still discriminates in the other direction.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EdgePanel } from '../panels/EdgePanel'
import { useCanvasStore } from '../../../store'
import { useGuidanceStore } from '../../../stores/guidanceStore'
import { USER_EDGE_DEFAULTS, EDGE_CONSTRAINTS } from '../../../domain/edges'

const panelProps = {
  edgeId: 'e1',
  techMode: false,
  onClose: vi.fn(),
  onNavigate: vi.fn(),
}

const NODES = [
  { id: 'fac1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Marketing budget' } },
  { id: 'out1', type: 'outcome', position: { x: 100, y: 0 }, data: { label: 'Revenue' } },
]

function seedNodes() {
  useCanvasStore.setState({
    ...useCanvasStore.getState(),
    nodes: NODES,
    edges: [],
    results: { status: 'none', report: null },
  } as never)
}

/** Seed an edge whose `data` is written verbatim (for the SET cases). */
function seedEdge(data: Record<string, unknown>) {
  seedNodes()
  useCanvasStore.setState({
    ...useCanvasStore.getState(),
    edges: [{ id: 'e1', source: 'fac1', target: 'out1', type: 'styled', data }],
  } as never)
}

/**
 * REACHABILITY: build the edge the way the product does, then rename it to the
 * id the panel props use. No hand-authored `data` — whatever `addEdge` +
 * `USER_EDGE_DEFAULTS` produce is what the panel sees.
 */
function drawEdgeThroughProduct() {
  seedNodes()
  const result = useCanvasStore
    .getState()
    .addEdge({ source: 'fac1', target: 'out1', data: { ...USER_EDGE_DEFAULTS } } as never)
  expect((result as { created: boolean }).created).toBe(true)
  const drawn = useCanvasStore.getState().edges
  expect(drawn).toHaveLength(1)
  useCanvasStore.setState({
    ...useCanvasStore.getState(),
    edges: [{ ...drawn[0], id: 'e1' }],
  } as never)
  return drawn[0]
}

function readout(): HTMLElement {
  return screen.getByTestId('edge-existence-readout')
}

function trackFill(container: HTMLElement): HTMLElement | null {
  return container.querySelector('[data-testid="inspector-slider-track-fill"]')
}

beforeEach(() => {
  useCanvasStore.setState(useCanvasStore.getState(), true)
  useGuidanceStore.setState({ guidanceItems: [], _prefillChat: null, _sendMessage: null })
})

describe('EdgePanel — existence readout colour is provenance-gated', () => {
  it('POSITIVE CONTROL: an edge drawn through the product renders no verdict colour', () => {
    const drawn = drawEdgeThroughProduct()
    // The state under test is real: the product's own edge-creation path
    // supplies a beliefExists number and NO source stamp.
    expect(typeof (drawn.data as Record<string, unknown>).beliefExists).toBe('number')
    expect((drawn.data as Record<string, unknown>).beliefExistsSource).toBeUndefined()

    const { container } = render(<EdgePanel {...panelProps} />)

    const cls = readout().className
    expect(cls).not.toContain('text-success')
    expect(cls).not.toContain('text-warning')
    expect(cls).not.toContain('text-danger')
    expect(cls).toContain('text-text-light')
    // The coloured track fill is the same verdict in a second channel.
    expect(trackFill(container)).toBeNull()
  })

  it('POSITIVE CONTROL (other direction): a user-set high value still renders green', () => {
    seedEdge({ weight: 0.35, direction: 'positive', beliefExists: 0.82, beliefExistsSource: 'user' })
    const { container } = render(<EdgePanel {...panelProps} />)

    expect(readout().className).toContain('text-success')
    expect(readout().className).not.toContain('text-text-light')
    const fill = trackFill(container)
    expect(fill).not.toBeNull()
    expect(fill!.getAttribute('style')).toContain('var(--success)')
  })

  it('discriminates the moderate band for a set value', () => {
    seedEdge({ beliefExists: 0.5, beliefExistsSource: 'cee' })
    render(<EdgePanel {...panelProps} />)
    expect(readout().className).toContain('text-warning')
  })

  it('discriminates the low band for a set value', () => {
    seedEdge({ beliefExists: 0.2, beliefExistsSource: 'template' })
    render(<EdgePanel {...panelProps} />)
    expect(readout().className).toContain('text-danger')
  })

  it('back-compat: a pre-marker CEE edge (exists_probability) is still coloured', () => {
    // `edgeValueSource` accepts `exists_probability` as producer evidence, so
    // graphs saved before the marker existed must not regress to neutral.
    seedEdge({ beliefExists: 0.9, exists_probability: 0.9 })
    render(<EdgePanel {...panelProps} />)
    expect(readout().className).toContain('text-success')
  })

  it('an edge with NO beliefExists at all falls to the 0.7 default and must stay neutral', () => {
    // This is the exact path named in the defect: `EDGE_CONSTRAINTS
    // .beliefExists.default` is 0.7, which `thresholdColor` banded as green.
    expect(EDGE_CONSTRAINTS.beliefExists.default).toBe(0.7)
    seedEdge({ weight: 0.35, direction: 'positive' })
    render(<EdgePanel {...panelProps} />)
    expect(screen.getByText('70%')).toBeTruthy()
    expect(readout().className).not.toContain('text-success')
    expect(readout().className).toContain('text-text-light')
  })

  it('CONTRADICTION: the panel cannot say "nobody has said" and colour it green at once', () => {
    drawEdgeThroughProduct()
    render(<EdgePanel {...panelProps} />)
    // The prose disclosure is present…
    expect(
      screen.getByText(/Nobody has said how likely this connection is to exist yet/),
    ).toBeTruthy()
    // …so the colour channel must not contradict it.
    expect(readout().className).not.toContain('text-success')
  })
})
