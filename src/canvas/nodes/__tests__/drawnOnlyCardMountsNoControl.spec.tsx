/**
 * ⛔ A CARD DRAWN FROM THE LIVING MODEL ALONE MOUNTS NO EDIT CONTROL (#2921 review: the quick actions were still
 * mounted and tabbable, and More actions → Delete sent `remove_node` for an id the store does not hold).
 *
 * Each card is the one `drawLivingModel` builds from a SYNTHETIC living model, rendered by its real node component with
 * the real `Handle`, and NOT seeded into the store, as on the canvas. Contrast: the same component with a store node of
 * the same kind mounts its controls and connectable handles.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
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
import { HOVER_CARD_OPEN_DELAY_MS } from '../../components/hoverCard/hoverCardPlacement'

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

type View = 'standard' | 'expert'
type Phase = 'pre' | 'post'

function renderCard(node: Pick<Node, 'id' | 'type' | 'data'>, storeNodes: Node[], view: View = 'standard', phase: Phase = 'pre') {
  useCanvasStore.setState({ nodes: storeNodes, edges: [], lodRung: 'full', viewMode: view,
    results: phase === 'post' ? { status: 'complete', hash: 'run-1', report: {} } : { status: 'idle', report: null } } as never)
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

/** Every view a card has (Standard and Detailed, before and after a Run), hovered so its hover card opens too. */
const MATRIX = ['staff_hours', 'stock_level', 'supplier_fails'].flatMap((id) =>
  (['standard', 'expert'] as const).flatMap((view) => (['pre', 'post'] as const).map((phase) => [id, view, phase] as const)))

/** Hover the card so its hover card opens, then list every control on the page (the hover card portals to the body). */
async function controlsAfterHover(card: HTMLElement): Promise<string[]> {
  fireEvent.mouseEnter(card)
  fireEvent.mouseEnter(card.querySelector('[role="group"]')!)
  await act(async () => { vi.advanceTimersByTime(HOVER_CARD_OPEN_DELAY_MS + 600) })
  return [...document.body.querySelectorAll(CONTROLS)].map((el) => el.outerHTML.slice(0, 120))
}

describe('a drawn-only card', () => {
  it.each(MATRIX)('⛔ %s (%s view, %s-Run): no button, field or focus stop anywhere it opens, and no handle a link can start from', async (id, view, phase) => {
    vi.useFakeTimers()
    try {
      const card = renderCard(drawn.find((n) => n.id === id)!, [], view, phase)
      expect(card.querySelector(`[data-testid="${NOT_IN_CALCULATION_TEST_ID}"]`)).not.toBeNull()
      expect(card.querySelectorAll('.react-flow__handle').length).toBe(2)
      expect(card.querySelectorAll('.react-flow__handle.connectable').length).toBe(0)
      expect(await controlsAfterHover(card)).toEqual([])
    } finally {
      vi.useRealTimers()
    }
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

describe('a drawn-only card answers a hover with its read-only details', () => {
  it('⭐ its hover card opens and its Status row says CEE\'s reason in plain words', async () => {
    vi.useFakeTimers()
    try {
      const node = drawLivingModel([], [], { ...graph, withheld: [{ id: 'supplier_fails', reason: 'risk_window_not_goal_window' }] }).nodes
        .find((n) => n.id === 'supplier_fails')!
      const card = renderCard(node, [])
      fireEvent.mouseEnter(screen.getByTestId('node-title').closest('[role="group"]')!)
      await act(async () => { vi.advanceTimersByTime(HOVER_CARD_OPEN_DELAY_MS + 50) })
      expect(screen.getByTestId('node-hover-card-title').textContent).toBe('Supplier goes under')
      expect(screen.getByTestId('node-hover-card-status').textContent).toContain('Not in the calculation yet: its time window differs from the goal’s')
      expect(card.querySelectorAll(CONTROLS).length).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  })
})
