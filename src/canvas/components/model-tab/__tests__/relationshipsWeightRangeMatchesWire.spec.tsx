/**
 * The weight chip may not advertise a range the wire refuses.
 *
 * ⭐ THE DEFECT, as a user meets it. `validateWeight` accepted `n <= 2` and the
 * chip's own tooltip read "Weight (0–2). Click to edit." The wire refuses any
 * magnitude above 1. So every value in (1, 2] repainted the line, stamped
 * `weightSource: 'user'`, sent NOTHING, said nothing, and was gone on reload —
 * half the advertised range was a silent lie, and it is the identical "a
 * control that looks like it saves and does not" defect the strength lane
 * exists to close, re-opened one field along.
 *
 * ⚠ THE BOUND IS NOT HARDCODED IN THIS FILE, ON PURPOSE. A test asserting
 * `1` would be a second hand-maintained copy of the contract's number and would
 * drift from it exactly as the `2` did. Instead each case asserts AGREEMENT:
 * the chip accepts a value if and only if `buildEdgeStrengthEditEvent` — which
 * enforces the contract's `magnitude: z.number().finite().min(0).max(1)` — can
 * carry it. If the contract's bound ever moves, this guard follows it and the
 * control is what goes RED.
 *
 * ⚠ EVERY ASSERTION BINDS BY IDENTITY. The chip is addressed by its edge-id
 * testid, and a SECOND edge is rendered so an assertion that matched "some
 * weight field" would fail on the wrong object (CLAUDE.md trap 19).
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import type { Edge, Node } from '@xyflow/react'

import { RelationshipsSection } from '../RelationshipsSection'
import { edgeValueSourcePatch } from '../../../domain/edgeValueProvenance'
import { buildEdgeStrengthEditEvent } from '../../../conversation/edgeStrengthEdit'

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

const { mockUpdateEdge, mockStoreState } = vi.hoisted(() => {
  const updateEdge = vi.fn()
  return {
    mockUpdateEdge: updateEdge,
    mockStoreState: {
      updateEdge,
      setHighlightedEdges: vi.fn(),
      setHighlightedNodes: vi.fn(),
      highlightedEdges: new Set<string>(),
      edges: [] as unknown[],
    },
  }
})

vi.mock('../../../store', () => {
  const useCanvasStore = Object.assign(
    vi.fn((selector: (s: unknown) => unknown) => selector(mockStoreState)),
    { getState: () => mockStoreState },
  )
  return { useCanvasStore }
})

vi.mock('../../../utils/focusHelpers', () => ({
  focusEdgeById: vi.fn(),
  focusNodeById: vi.fn(),
}))

vi.mock('../../../utils/evidenceCoverage', () => ({
  NON_EVIDENCE_PROVENANCE: ['assumption', 'template', 'ai-suggested'],
}))

vi.mock('../../GraphTextView', () => ({
  SectionErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('../../../ui/inspector/SignedStrengthSlider', () => ({
  SignedStrengthSlider: () => <input type="range" data-testid="mock-strength-slider" />,
}))

const EDGE = 'e_price_revenue'
const OTHER_EDGE = 'e_churn_revenue'

const nodes: Node[] = [
  { id: 'f1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Price' } },
  { id: 'f2', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Revenue' } },
]

/** A CEE-stated edge, with the server statement recorded as ingestion records it. */
function edge(id: string, source: string, target: string): Edge {
  return {
    id,
    source,
    target,
    data: {
      weight: 0.4,
      direction: 'positive',
      beliefExists: 0.7,
      provenance: 'assumption',
      serverStrength: { mean: 0.4, effect_direction: 'positive' },
      ...edgeValueSourcePatch({ weight: 'cee', beliefExists: 'cee', direction: 'cee' }),
    },
  } as Edge
}

const EDGES = [edge(EDGE, 'f1', 'f2'), edge(OTHER_EDGE, 'f2', 'f1')]

/** Would the wire carry this magnitude on THIS edge? The contract, via the builder. */
function wireWouldCarry(magnitude: number): boolean {
  return (
    buildEdgeStrengthEditEvent({
      edge: { id: EDGE, source: 'f1', target: 'f2', data: EDGES[0].data } as Edge,
      requestedMean: magnitude,
      preserveDirection: true,
    }) !== null
  )
}

/** Expand the card and type `typed` into ITS weight chip; return whether it committed. */
function typeWeight(typed: string): boolean {
  // Explicit — auto-cleanup runs between TESTS, and several cases below drive
  // the chip twice in one test (a boundary needs both of its sides).
  cleanup()
  mockUpdateEdge.mockClear()
  render(<RelationshipsSection nodes={nodes} edges={EDGES} />)
  fireEvent.click(screen.getByTestId(`edge-card-${EDGE}`))
  fireEvent.click(screen.getByTestId(`edge-${EDGE}-weight-display`))
  const input = screen.getByTestId(`edge-${EDGE}-weight`)
  fireEvent.change(input, { target: { value: typed } })
  fireEvent.keyDown(input, { key: 'Enter' })
  return mockUpdateEdge.mock.calls.length > 0
}

beforeEach(() => {
  mockStoreState.edges = EDGES
  mockUpdateEdge.mockClear()
})

describe('the weight chip advertises exactly the range the wire accepts', () => {
  /**
   * The precondition this whole file rests on: the fixture edge really is
   * wire-encodable at an in-range value. Without this, every case below could
   * pass by the builder refusing for some unrelated reason (CLAUDE.md trap 13b
   * — a discriminator must pin its own precondition).
   */
  it('the fixture edge is genuinely assertable on the wire (precondition)', () => {
    expect(wireWouldCarry(0.8)).toBe(true)
  })

  it('accepts a value the wire can carry', () => {
    expect(wireWouldCarry(0.8)).toBe(true)
    expect(typeWeight('0.8')).toBe(true)
  })

  /**
   * ⭐ THE CASE THAT WAS THE DEFECT. 1.5 sits inside the tooltip's advertised
   * "0–2" and outside everything the wire will carry.
   */
  it('REFUSES a value the wire cannot carry, rather than writing it locally in silence', () => {
    expect(wireWouldCarry(1.5)).toBe(false)
    expect(typeWeight('1.5')).toBe(false)
  })

  it('refuses at 2 — the top of the range the tooltip used to advertise', () => {
    expect(wireWouldCarry(2)).toBe(false)
    expect(typeWeight('2')).toBe(false)
  })

  /**
   * The boundary itself, from both sides. A guard that only tested 1.5 would
   * pass against a control that refused everything above 0.5 too.
   */
  it('accepts exactly 1 and refuses just above it — the boundary is inclusive', () => {
    expect(wireWouldCarry(1)).toBe(true)
    expect(typeWeight('1')).toBe(true)
    expect(wireWouldCarry(1.01)).toBe(false)
    expect(typeWeight('1.01')).toBe(false)
  })

  it('still accepts 0, and still refuses a negative magnitude', () => {
    expect(typeWeight('0')).toBe(true)
    expect(typeWeight('-0.5')).toBe(false)
  })

  it('the tooltip states the range it actually accepts', () => {
    cleanup()
    render(<RelationshipsSection nodes={nodes} edges={EDGES} />)
    fireEvent.click(screen.getByTestId(`edge-card-${EDGE}`))
    const chip = screen.getByTestId(`edge-${EDGE}-weight-display`)
    // Bound to THIS edge's chip by testid, never to "a title containing 0–1".
    expect(chip.getAttribute('title')).toBe('Weight (0–1). Click to edit.')
  })
})
