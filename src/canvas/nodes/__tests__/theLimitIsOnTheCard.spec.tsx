/**
 * ⭐⭐ "KEEP MONTHLY CHURN UNDER 4%" WAS A SEVEN-PIXEL DOT BEHIND A FEATURE FLAG.
 *
 * A constraint is a boundary the reader chose. On the canvas it was a 12px
 * circle holding a 7px target icon, its number reachable only by hovering — and
 * the whole thing gated on `VITE_FEATURE_GRAPH_BADGES`, which has no entry in
 * `netlify.toml` and sits commented out in `.env.example`. Hover has no touch
 * equivalent.
 *
 * The gate is now split: the BADGE is decoration and stays flagged, the LIMIT
 * is the reader's own data and is not a feature.
 *
 * ## And it was a second formatter
 *
 * `FactorNode` hand-built `Constrained: {label} {operator} {value ?? '-'}`.
 * `GoalAdvancedEditor` had already collapsed that exact shape into
 * `goalConstraintText` and recorded why: the wire's ASCII `<=` shown to a
 * reader, a placeholder where a number is missing, and no PROVENANCE — so a
 * limit Olumi inferred read identically to one the founder stated. These tests
 * pin the ruled vocabulary, not a copy of it.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { FactorNode } from '../FactorNode'
import { useCanvasStore } from '../../store'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})
vi.mock('../../../flags', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  // ⛔ The badges flag is forced OFF for every test in this file. That is the
  // whole claim: the limit must reach the card with the decoration disabled.
  return { ...actual, isGraphBadgesEnabled: () => false }
})

const ID = 'fac_churn'
const state = (constraints: unknown[]) => ({
  selectedNodeId: null, hoveredOptionId: null, nodes: [], edges: [],
  ceeAnalysisReady: null, results: { status: 'idle', report: null },
  highlightedNodes: new Set(), dimmedNodeIds: new Set(), editedSinceRunNodeIds: new Set(),
  analysisHighlight: { source: null, edgeIds: new Set(), nodeIds: new Set() },
  lens: { active: null, _dimmedNodeIds: new Set(), _hiddenNodeIds: new Set(), _evidenceNodeClass: new Map() },
  goalThreshold: null, goalConstraints: constraints, viewMode: 'standard', lodRung: 'full',
  guidanceItems: [],
})

vi.mock('../../store', () => ({ useCanvasStore: vi.fn((s) => s(state([]))) }))

const props = {
  type: 'factor', position: { x: 0, y: 0 }, selected: false, isConnectable: true,
  positionAbsoluteX: 0, positionAbsoluteY: 0, dragging: false, zIndex: 0,
  deletable: true, selectable: true, draggable: true, width: 240, height: 100,
  sourcePosition: undefined, targetPosition: undefined,
}

function renderWith(constraints: unknown[]) {
  vi.mocked(useCanvasStore).mockImplementation((sel) => (sel as (s: unknown) => unknown)(state(constraints) as never))
  render(
    <ReactFlowProvider>
      <FactorNode {...props} id={ID} data={{ label: 'Monthly churn', kind: 'factor' }} />
    </ReactFlowProvider>,
  )
  // Positive control: the card mounted before any absence is asserted (trap 13).
  expect(screen.getByTestId('node-title'), 'the card did not mount').toBeTruthy()
}

const line = () => screen.getByTestId('factor-constraint-lines')

describe('the reader\u2019s own limit reaches the card', () => {
  it('\u2b50 shows the limit with the badges flag OFF', () => {
    renderWith([{ node_id: ID, operator: '<=', value: 4, unit: '%' }])
    expect(line()).toHaveTextContent('Limit \u2264 4%')
  })

  it('renders the ruled glyph, never the wire\u2019s ASCII', () => {
    renderWith([{ node_id: ID, operator: '<=', value: 4, unit: '%' }])
    expect(line()).not.toHaveTextContent('<=')
  })

  it('\u2b50 an INFERRED limit says so \u2014 it must not read like one the reader stated', () => {
    renderWith([{ node_id: ID, operator: '<=', value: 4, unit: '%', provenance: 'inferred' }])
    expect(line()).toHaveTextContent('Inferred limit')
  })

  it('\u26d4 CONTRAST: a stated limit carries NO provenance suffix', () => {
    renderWith([{ node_id: ID, operator: '<=', value: 4, unit: '%' }])
    expect(line()).not.toHaveTextContent('Inferred limit')
  })

  it('\u26d4 a missing operator does NOT become a direction', () => {
    renderWith([{ node_id: ID, value: 4, unit: '%' }])
    expect(line()).toHaveTextContent('Limit not captured')
    expect(line().textContent ?? '').not.toMatch(/[\u2264\u2265<>]/)
  })

  /**
   * \u26d4 THE DISCRIMINATING TWIN. Without it, a card that rendered every
   * constraint in the store would pass all of the above \u2014 and would print a
   * limit the reader never set on this factor.
   */
  it('\u2b50 a PERCENT limit prefers the reader\u2019s verbatim words over our reconstruction', () => {
    renderWith([{ node_id: ID, operator: '>=', value: 1.1, unit: '%',
      source_quote: 'net revenue retention above 110%' }])
    expect(line()).toHaveTextContent('net revenue retention above 110%')
    // \u26d4 The discriminating half. The producer sends 1.1 on a percent unit
    // and there is no raw twin to reconstruct 110 from, so the old form
    // rendered "1.1%" \u2014 a hundred times under the brief, while the goal card
    // on the same screen said "Target: 110%". Measured in the running app.
    expect(line().textContent ?? '').not.toContain('1.1%')
  })

  it('\u26d4 CONTRAST: a CURRENCY limit keeps the compact reconstruction', () => {
    // No scale ambiguity on a currency unit \u2014 49 is \u00a349 \u2014 so the tidier form
    // wins and the quote is not preferred. Without this, "prefer the quote"
    // would silently widen to every unit, which `factorGoalContent.spec`
    // caught once already.
    renderWith([{ node_id: ID, operator: '<=', value: 49, unit: '\u00a3',
      source_quote: 'Keep the monthly price at or below \u00a349' }])
    expect(line()).toHaveTextContent('\u2264 \u00a349')
    expect(line().textContent ?? '').not.toContain('Keep the monthly price')
  })

  it('\u26d4 CONTRAST: a constraint naming a DIFFERENT node never appears here', () => {
    renderWith([{ node_id: 'fac_somewhere_else', operator: '<=', value: 4, unit: '%' }])
    expect(screen.queryByTestId('factor-constraint-lines')).toBeNull()
  })
})
