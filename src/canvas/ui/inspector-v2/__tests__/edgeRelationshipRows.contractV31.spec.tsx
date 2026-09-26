/**
 * Canvas visual contract v3.1 — the edge inspector's relationship rows
 * (DESIGN-GAP-v31 row 12).
 *
 *   v3.1: "Edge tooltip is one line; the edge inspector has Direction /
 *   Stroke width / Existence rows. No percentages." The prototype's
 *   `edgeInspector()` opens with a `.section-highlight` ("Modelled
 *   relationship") and three `.detail-row`s, then keeps "the existing
 *   relationship inspector" below them.
 *
 * Every row value is read from the SAME resolver the canvas stroke reads —
 * `resolveEdgeDirectionDisplay` (glyph/colour), `readContestedState` (the amber
 * sign dispute), `resolveEdgeSignedStrengthDisplay` (stroke width) and
 * `resolveExistenceDash` (the dash) — so the row can never describe a line the
 * canvas does not draw. Bound by test id, and each case has its contrast.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@xyflow/react', () => ({ useViewport: () => ({ x: 0, y: 0, zoom: 1 }) }))

import { InspectorRouter } from '../InspectorRouter'
import { useCanvasStore } from '../../../store'

const NODES = [
  { id: 'fac1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Marketing budget', kind: 'factor' } },
  { id: 'out1', type: 'outcome', position: { x: 100, y: 0 }, data: { label: 'Revenue', kind: 'outcome' } },
  { id: 'dec1', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'Strategy', kind: 'decision' } },
  { id: 'opt1', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Grow', kind: 'option' } },
]

const STATED = {
  weight: 0.35, weightSource: 'user',
  direction: 'positive', directionSource: 'user',
  beliefExists: 0.5, beliefExistsSource: 'user',
}

function seed(data: Record<string, unknown>, source = 'fac1', target = 'out1') {
  useCanvasStore.setState({
    nodes: NODES as never[],
    edges: [{ id: 'e1', source, target, data }] as never[],
    results: { status: 'idle' },
    selection: { nodeIds: new Set(), edgeIds: new Set(['e1']), anchorPosition: null },
    confirmedNodeIds: new Set(),
    _internal: {},
  } as never)
}

const row = (id: string) => screen.getByTestId(`edge-detail-${id}`)
const valueOf = (id: string) => row(id).lastElementChild?.textContent

describe('v3.1 row 12 — the edge inspector states Direction / Stroke width / Existence', () => {
  beforeEach(() => seed(STATED))

  it('a characterised causal link: the section and all three rows, from the stroke\'s own resolvers', () => {
    render(<InspectorRouter nodeId={null} edgeId="e1" onClose={vi.fn()} />)
    const summary = screen.getByTestId('edge-relationship-summary')
    expect(summary).toHaveTextContent('Modelled relationship')
    expect(valueOf('direction')).toBe('Positive (+)')
    expect(valueOf('stroke-width')).toBe('Modelled strength magnitude')
    // 0.5 is a stated likelihood below the solid cut → the dashed line.
    expect(valueOf('existence')).toBe('A stated doubt')
    // No percentages in the summary (v3.1: "No percentages").
    expect(screen.getByTestId('edge-detail-rows').textContent).not.toMatch(/%/)
  })

  it('⭐ CONTRAST — nothing stated: the rows say so, never a default read as a value', () => {
    seed({ weight: 0.3, direction: 'positive', beliefExists: 0.8 })
    render(<InspectorRouter nodeId={null} edgeId="e1" onClose={vi.fn()} />)
    expect(valueOf('direction')).toBe('Not set yet')
    expect(valueOf('stroke-width')).toBe('Strength not set yet')
    expect(valueOf('existence')).toBe('No dashed exception shown')
  })

  it('a negative stated direction, and a stated likelihood at or above the cut, draw solid', () => {
    seed({ ...STATED, direction: 'negative', beliefExists: 0.9 })
    render(<InspectorRouter nodeId={null} edgeId="e1" onClose={vi.fn()} />)
    expect(valueOf('direction')).toBe('Negative (−)')
    expect(valueOf('existence')).toBe('No dashed exception shown')
  })

  it('a sign disputed by Olumi\'s review is never stated as a direction', () => {
    seed({
      ...STATED,
      validation: { status: 'contested', user_action: 'pending', max_divergence: 0.4, contested_reasons: ['sign_flip'] },
    })
    render(<InspectorRouter nodeId={null} edgeId="e1" onClose={vi.fn()} />)
    expect(valueOf('direction')).toBe('AI review disagrees')
  })

  it('⭐ CONTRAST — a structural link (Question → option) carries no causal rows', () => {
    seed({}, 'dec1', 'opt1')
    render(<InspectorRouter nodeId={null} edgeId="e1" onClose={vi.fn()} />)
    expect(screen.getByRole('region', { name: 'Inspector panel' })).toBeTruthy()
    expect(screen.queryByTestId('edge-relationship-summary')).toBeNull()
    expect(screen.queryByTestId('edge-detail-rows')).toBeNull()
  })
})
