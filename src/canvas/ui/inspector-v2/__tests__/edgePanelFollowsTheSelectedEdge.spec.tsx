/**
 * The inspector must describe the edge you SELECTED, not the one you left.
 *
 * `<EdgePanel>` is mounted without a `key`, while the node panels two branches
 * down are keyed `key={nodeId}` (`InspectorRouter.tsx:533,541`). So selecting a
 * different EDGE reuses the same component instance, every `useState(...)`
 * initialiser keeps its first value, and the panel goes on reporting the
 * previous edge's strength. A fresh mount is correct; a switch is not — which is
 * why this cannot be caught by a spec that renders once.
 *
 * ⛔ THE DISCRIMINATING CONTROL IS THE FRESH-MOUNT ARM, and without it this spec
 * would pass for the wrong reason: if both arms mounted fresh, both would be
 * right and the defect would be invisible. The two arms differ ONLY in whether
 * the component instance survived.
 *
 * Adjacent but NOT the same as the stale-state defect fixed in #1544: that one
 * was a handler writing the store without its own state, on the edge the user
 * was already looking at. This is the panel not following a change of SUBJECT.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

import { InspectorRouter } from '../InspectorRouter'
import { useCanvasStore } from '../../../store'

vi.mock('@xyflow/react', () => ({ useViewport: () => ({ x: 0, y: 0, zoom: 1 }) }))

const NODES = [
  { id: '2891dabb', type: 'factor', data: { label: 'Marketing' }, position: { x: 0, y: 0 } },
  { id: 'c12af5de', type: 'goal', data: { label: 'Revenue' }, position: { x: 0, y: 0 } },
]

/**
 * Two edges the SERVER holds, at values in different bands.
 *
 * ⚠ `weightSource: 'cee'` ADDED — the fixture always MEANT these to be
 * server-held (its own comment says so) but never said it in the field the
 * provenance gate reads. Once the panel withholds a strength whose `weight`
 * carries no source, a fixture without one describes an edge NOBODY has
 * characterised, which is not this file's subject: it asks whether the panel
 * FOLLOWS THE SELECTED EDGE. Measured on the deployed board, real edges carry
 * `weightSource: 'cee'` on 37 of 37 — so this is the fixture catching up with
 * both its own intent and the wire, not a gate being worked around.
 */
const EDGES = [
  {
    id: 'e-strong', source: '2891dabb', target: 'c12af5de',
    data: { weight: 0.85, weightSource: 'cee', direction: 'positive', serverStrength: { mean: 0.85, effect_direction: 'positive' } },
  },
  {
    id: 'e-weak', source: '2891dabb', target: 'c12af5de',
    data: { weight: 0.30, weightSource: 'cee', direction: 'positive', serverStrength: { mean: 0.30, effect_direction: 'positive' } },
  },
]

function seed(selectedId: string) {
  useCanvasStore.setState({
    nodes: NODES as never[],
    edges: EDGES as never[],
    results: { status: 'idle' },
    selection: { nodeIds: new Set(), edgeIds: new Set([selectedId]), anchorPosition: null },
    goalThreshold: null,
    confirmedNodeIds: new Set(),
    _internal: {},
  } as never)
}

const bands = () => screen.queryAllByRole('button')
  .filter((b) => /^(Slight|Moderate|Strong|Very strong)/.test(b.textContent ?? ''))
const pressed = () => bands().find((b) => b.getAttribute('aria-pressed') === 'true')?.textContent ?? null

beforeEach(() => { vi.clearAllMocks(); cleanup() })

describe('the edge inspector follows the edge you selected', () => {
  it('CONTROL — a FRESH mount of the weak edge reads Moderate 0.30', () => {
    seed('e-weak')
    render(<InspectorRouter nodeId={null} edgeId="e-weak" onClose={vi.fn()} />)
    expect(bands().length, 'the panel did not mount at all').toBeGreaterThan(0)
    expect(pressed()).toMatch(/^Moderate/)
  })

  it('CONTROL — a FRESH mount of the strong edge reads Very strong 0.85', () => {
    seed('e-strong')
    render(<InspectorRouter nodeId={null} edgeId="e-strong" onClose={vi.fn()} />)
    expect(bands().length, 'the panel did not mount at all').toBeGreaterThan(0)
    expect(pressed()).toMatch(/^Very strong/)
  })

  it('⭐ SWITCHING selection WITHOUT unmount must follow the new edge', () => {
    seed('e-strong')
    const { rerender } = render(<InspectorRouter nodeId={null} edgeId="e-strong" onClose={vi.fn()} />)
    expect(pressed(), 'precondition: the strong edge is shown first').toMatch(/^Very strong/)

    // The same component instance, a different subject — exactly what selecting
    // another edge on the canvas does.
    seed('e-weak')
    rerender(<InspectorRouter nodeId={null} edgeId="e-weak" onClose={vi.fn()} />)

    expect(pressed(), 'the panel is still describing the edge you left').toMatch(/^Moderate/)
  })
})
