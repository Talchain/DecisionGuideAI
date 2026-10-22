/**
 * ⛔ A CARD DRAWN FROM THE LIVING MODEL ALONE MOUNTS NO EDIT CONTROL (#2921 review: the quick actions were still
 * mounted and tabbable, and More actions → Delete sent `remove_node` for an id the store does not hold).
 *
 * Each card is the one `drawLivingModel` builds from a SYNTHETIC living model, rendered by its real node component with
 * the real `Handle`, and NOT seeded into the store, as on the canvas. Contrast: the same component with a store node of
 * the same kind mounts its controls and connectable handles.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { ReactFlowProvider, type Node } from '@xyflow/react'

vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => ({
    sensitivityRank: null, influence: null, confidence: null,
    inSensitivityAnalysis: false, achievementProbability: null, stabilityPercentage: null,
  })),
}))

import { useCanvasStore } from '../../store'
import { FactorNode } from '../FactorNode'
import { OutcomeNode } from '../OutcomeNode'
import { RiskNode } from '../RiskNode'
import { drawLivingModel, NOT_IN_CALCULATION_TEST_ID } from '../../domain/livingModelCanvas'

/** Everything that acts. A read-only mark (`CardMark`: `role="img"`, a tooltip and nothing else) may still take focus. */
const CONTROLS = 'button, input, textarea, select, a[href], [role="button"], [contenteditable="true"], [tabindex]:not([tabindex="-1"]):not([role="img"])'
const COMPONENT = { factor: FactorNode, outcome: OutcomeNode, risk: RiskNode } as const

const graph = {
  nodes: [], edges: [],
  living_model: {
    factors: [
      { id: 'staff_hours', kind: 'factor', label: 'Staff hours' },
      { id: 'stock_level', kind: 'outcome', label: 'Stock on the shelf' },
    ],
    risks: [{ id: 'supplier_fails', label: 'Supplier goes under', occurrence: { low: 0.1, high: 0.3, estimate_by: 'olumi' }, horizon_months: 6, horizon_by: null, source: 'olumi', mitigations: [] }],
    links: [],
  },
}
const drawn = drawLivingModel([], [], graph).nodes

function renderCard(node: Pick<Node, 'id' | 'type' | 'data'>, storeNodes: Node[]) {
  useCanvasStore.setState({ nodes: storeNodes, edges: [], lodRung: 'full', viewMode: 'standard', results: { status: 'idle', report: null } } as never)
  const Card = COMPONENT[node.type as keyof typeof COMPONENT]
  render(
    <ReactFlowProvider>
      <Card id={node.id} type={node.type!} data={node.data as never} selected={false} isConnectable={false}
        positionAbsoluteX={0} positionAbsoluteY={0} dragging={false} zIndex={0} deletable={false} selectable={false} draggable={false} />
    </ReactFlowProvider>,
  )
  return screen.getByTestId('node-title').closest('[role="group"]')!.parentElement!
}

afterEach(() => { cleanup(); useCanvasStore.setState({ nodes: [], edges: [] } as never) })

describe('a drawn-only card', () => {
  it.each(['staff_hours', 'stock_level', 'supplier_fails'])('⛔ %s: no button, field or focus stop, and no handle a link can start from', (id) => {
    const node = drawn.find((n) => n.id === id)!
    const card = renderCard(node, [])
    expect(card.querySelector(`[data-testid="${NOT_IN_CALCULATION_TEST_ID}"]`)).not.toBeNull()
    expect([...card.querySelectorAll(CONTROLS)].map((el) => el.outerHTML.slice(0, 120))).toEqual([])
    expect(card.querySelectorAll('.react-flow__handle').length).toBe(2)
    expect(card.querySelectorAll('.react-flow__handle.connectable').length).toBe(0)
  })

  it.each(['staff_hours', 'stock_level', 'supplier_fails'])('CONTRAST %s: the same card held in the store mounts its controls', (id) => {
    const { data, type } = drawn.find((n) => n.id === id)!
    const { livingOnly: _drawnOnly, ...engineData } = data as Record<string, unknown>
    const node = { id, type, position: { x: 0, y: 0 }, data: engineData } as Node
    const card = renderCard(node, [node])
    expect(card.querySelector(`[data-testid="${NOT_IN_CALCULATION_TEST_ID}"]`)).toBeNull()
    expect(card.querySelectorAll(CONTROLS).length).toBeGreaterThan(0)
    expect(card.querySelectorAll('.react-flow__handle.connectable').length).toBe(2)
  })
})
