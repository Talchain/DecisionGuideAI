/**
 * InspectorRouter — resolves selection type and renders correct panel
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { InspectorRouter } from '../InspectorRouter'
import { useCanvasStore } from '../../../store'
import { DECISION_NODE_LABEL } from '../../../domain/vocabulary'

// Mock ReactFlow viewport hook
vi.mock('@xyflow/react', () => ({
  useViewport: () => ({ x: 0, y: 0, zoom: 1 }),
}))

function setStoreState(nodes: unknown[], edges: unknown[] = []) {
  useCanvasStore.setState({
    nodes: nodes as never[],
    edges: edges as never[],
    results: { status: 'idle' },
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
  } as never)
}

describe('InspectorRouter', () => {
  const onClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    useCanvasStore.setState({
      nodes: [],
      edges: [],
      results: { status: 'idle' },
      selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
      goalThreshold: null,
      confirmedNodeIds: new Set(),
      _internal: {},
    } as never)
  })

  it('renders nothing when no selection', () => {
    setStoreState([])
    const { container } = render(
      <InspectorRouter nodeId={null} edgeId={null} onClose={onClose} />,
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders goal panel for goal node', () => {
    setStoreState([
      { id: 'g1', type: 'goal', data: { label: 'Revenue target', kind: 'goal' }, position: { x: 0, y: 0 } },
    ])
    render(<InspectorRouter nodeId="g1" edgeId={null} onClose={onClose} />)
    expect(screen.getByText('Revenue target')).toBeTruthy()
    expect(screen.getByText('Goal')).toBeTruthy()
  })

  it('renders option panel for option node', () => {
    setStoreState([
      { id: 'o1', type: 'option', data: { label: 'Aggressive growth', kind: 'option' }, position: { x: 0, y: 0 } },
    ])
    render(<InspectorRouter nodeId="o1" edgeId={null} onClose={onClose} />)
    expect(screen.getByText('Aggressive growth')).toBeTruthy()
    expect(screen.getByText('Option')).toBeTruthy()
  })

  it('renders factor-controllable panel for controllable factor', () => {
    setStoreState([
      { id: 'f1', type: 'factor', data: { label: 'Budget', kind: 'factor', category: 'controllable' }, position: { x: 0, y: 0 } },
    ])
    render(<InspectorRouter nodeId="f1" edgeId={null} onClose={onClose} />)
    expect(screen.getByText('Budget')).toBeTruthy()
    expect(screen.getByText('You can change this')).toBeTruthy()
  })

  it('renders factor-external panel for external factor', () => {
    setStoreState([
      { id: 'f2', type: 'factor', data: { label: 'Competition', kind: 'factor', category: 'external' }, position: { x: 0, y: 0 } },
    ])
    render(<InspectorRouter nodeId="f2" edgeId={null} onClose={onClose} />)
    expect(screen.getByText('Competition')).toBeTruthy()
    // "Outside your control" appears in both InspectorShell typePill and the panel Context pill
    expect(screen.getAllByText('Outside your control').length).toBeGreaterThanOrEqual(1)
  })

  it('renders edge panel when edge selected', () => {
    setStoreState(
      [
        { id: 'f1', type: 'factor', data: { label: 'Marketing', kind: 'factor' }, position: { x: 0, y: 0 } },
        { id: 'o1', type: 'outcome', data: { label: 'Revenue', kind: 'outcome' }, position: { x: 100, y: 0 } },
      ],
      [
        { id: 'e1', source: 'f1', target: 'o1', data: { weight: 0.5, direction: 'positive', beliefExists: 0.7, strengthStd: 0.15 } },
      ],
    )
    render(<InspectorRouter nodeId={null} edgeId="e1" onClose={onClose} />)
    expect(screen.getByText('Relationship')).toBeTruthy()
  })

  it('renders decision panel for decision node', () => {
    setStoreState([
      { id: 'd1', type: 'decision', data: { label: 'Market strategy', kind: 'decision' }, position: { x: 0, y: 0 } },
    ])
    render(<InspectorRouter nodeId="d1" edgeId={null} onClose={onClose} />)
    expect(screen.getByText('Market strategy')).toBeTruthy()
    // The TYPE pill, asserted against the vocabulary constant rather than a
    // literal — a hardcoded word here would be the same hand-maintained
    // mirror the constant was introduced to abolish.
    expect(screen.getByText(DECISION_NODE_LABEL)).toBeTruthy()
  })

  it('renders risk panel for risk node', () => {
    setStoreState([
      { id: 'r1', type: 'risk', data: { label: 'Operational risk', kind: 'risk' }, position: { x: 0, y: 0 } },
    ])
    render(<InspectorRouter nodeId="r1" edgeId={null} onClose={onClose} />)
    expect(screen.getByText('Operational risk')).toBeTruthy()
    expect(screen.getByText('Risk')).toBeTruthy()
  })

  it('renders outcome panel for outcome node', () => {
    setStoreState([
      { id: 'out1', type: 'outcome', data: { label: 'Revenue growth', kind: 'outcome' }, position: { x: 0, y: 0 } },
    ])
    render(<InspectorRouter nodeId="out1" edgeId={null} onClose={onClose} />)
    expect(screen.getByText('Revenue growth')).toBeTruthy()
    expect(screen.getByText('Outcome')).toBeTruthy()
  })

  // ─── Regression: label truncation ─────────────────────────────────
  it('truncates normalised range notation from display label', () => {
    setStoreState([
      { id: 'f1', type: 'factor', data: { label: 'Pro Plan Price (0-1, share of £100)', kind: 'factor', category: 'controllable' }, position: { x: 0, y: 0 } },
    ])
    render(<InspectorRouter nodeId="f1" edgeId={null} onClose={onClose} />)
    expect(screen.getByText('Pro Plan Price')).toBeTruthy()
    expect(screen.queryByText('Pro Plan Price (0-1, share of £100)')).toBeNull()
  })

  it('does not truncate labels without range notation', () => {
    setStoreState([
      { id: 'f1', type: 'factor', data: { label: 'Marketing Budget', kind: 'factor', category: 'controllable' }, position: { x: 0, y: 0 } },
    ])
    render(<InspectorRouter nodeId="f1" edgeId={null} onClose={onClose} />)
    expect(screen.getByText('Marketing Budget')).toBeTruthy()
  })

  // ─── Regression: outcome contribution bar ─────────────────────────
  it('shows contribution percentage when outcome has goal edge', () => {
    setStoreState(
      [
        { id: 'out1', type: 'outcome', data: { label: 'Revenue', kind: 'outcome' }, position: { x: 0, y: 0 } },
        { id: 'g1', type: 'goal', data: { label: 'Target', kind: 'goal' }, position: { x: 100, y: 0 } },
      ],
      [
        { id: 'e1', source: 'out1', target: 'g1', data: { weight: 0.65, direction: 'positive', weightSource: 'cee' } },
      ],
    )
    render(<InspectorRouter nodeId="out1" edgeId={null} onClose={onClose} />)
    expect(screen.getByText('65%')).toBeTruthy()
    expect(screen.getByText('Contributes to your goal')).toBeTruthy()
  })

  it('hides contribution bar when outcome has no goal edge', () => {
    setStoreState([
      { id: 'out1', type: 'outcome', data: { label: 'Revenue', kind: 'outcome' }, position: { x: 0, y: 0 } },
    ])
    render(<InspectorRouter nodeId="out1" edgeId={null} onClose={onClose} />)
    expect(screen.queryByText('Contributes to your goal')).toBeNull()
  })

  // ─── Regression: outcome contribution bar pre/post-analysis copy ──
  it('shows "Based on model structure" helper pre-analysis when contribution bar is visible', () => {
    setStoreState(
      [
        { id: 'out1', type: 'outcome', data: { label: 'Revenue', kind: 'outcome' }, position: { x: 0, y: 0 } },
        { id: 'g1', type: 'goal', data: { label: 'Target', kind: 'goal' }, position: { x: 100, y: 0 } },
      ],
      [
        { id: 'e1', source: 'out1', target: 'g1', data: { weight: 0.5, direction: 'positive', weightSource: 'cee' } },
      ],
    )
    // results status is 'idle' — pre-analysis
    render(<InspectorRouter nodeId="out1" edgeId={null} onClose={onClose} />)
    expect(screen.getByText('Based on model structure')).toBeTruthy()
  })

  it('hides "Based on model structure" helper post-analysis', () => {
    setStoreState(
      [
        { id: 'out1', type: 'outcome', data: { label: 'Revenue', kind: 'outcome' }, position: { x: 0, y: 0 } },
        { id: 'g1', type: 'goal', data: { label: 'Target', kind: 'goal' }, position: { x: 100, y: 0 } },
      ],
      [
        { id: 'e1', source: 'out1', target: 'g1', data: { weight: 0.5, direction: 'positive', weightSource: 'cee' } },
      ],
    )
    useCanvasStore.setState({ results: { status: 'complete' } } as never)
    render(<InspectorRouter nodeId="out1" edgeId={null} onClose={onClose} />)
    expect(screen.queryByText('Based on model structure')).toBeNull()
  })

  // ─── Regression: currency value display in controllable factor inspector ──
  it('renders GBP currency symbol adjacent to input for controllable factor (£49 — no space)', () => {
    setStoreState([
      {
        id: 'f1', type: 'factor',
        data: { label: 'Price', kind: 'factor', category: 'controllable', observedState: { raw_value: 49, value: 0.49, unit: '\u00A3' } },
        position: { x: 0, y: 0 },
      },
    ])
    const { container } = render(<InspectorRouter nodeId="f1" edgeId={null} onClose={onClose} />)
    // Symbol span and input must be in the same gap-0 flex container (no visual space)
    const symbolSpan = container.querySelector('span.text-xl')
    expect(symbolSpan?.textContent).toBe('\u00A3')
    const valueInput = container.querySelector('input[type="number"]') as HTMLInputElement | null
    expect(valueInput).not.toBeNull()
    expect(valueInput!.value).toBe('49')
    // Symbol and input must be siblings in the same flex wrapper — no intermediate gap element
    expect(symbolSpan?.nextElementSibling?.tagName).toBe('INPUT')
  })

  it('renders USD currency symbol adjacent to input ($500 — no space)', () => {
    setStoreState([
      {
        id: 'f2', type: 'factor',
        data: { label: 'Cost', kind: 'factor', category: 'controllable', observedState: { raw_value: 500, value: 0.5, unit: '$' } },
        position: { x: 0, y: 0 },
      },
    ])
    const { container } = render(<InspectorRouter nodeId="f2" edgeId={null} onClose={onClose} />)
    const symbolSpan = container.querySelector('span.text-xl')
    expect(symbolSpan?.textContent).toBe('$')
    const valueInput = container.querySelector('input[type="number"]') as HTMLInputElement | null
    expect(valueInput!.value).toBe('500')
    expect(symbolSpan?.nextElementSibling?.tagName).toBe('INPUT')
  })

  it('renders non-currency unit after input (CHF 1000 — unit appears after)', () => {
    setStoreState([
      {
        id: 'f3', type: 'factor',
        data: { label: 'Reserve', kind: 'factor', category: 'controllable', observedState: { raw_value: 1000, value: 0.5, unit: 'CHF' } },
        position: { x: 0, y: 0 },
      },
    ])
    const { container } = render(<InspectorRouter nodeId="f3" edgeId={null} onClose={onClose} />)
    // No prefix symbol span for CHF
    const symbolSpan = container.querySelector('span.text-xl')
    expect(symbolSpan).toBeNull()
    // Unit appears as trailing label
    expect(screen.getByText('CHF')).toBeTruthy()
    const valueInput = container.querySelector('input[type="number"]') as HTMLInputElement | null
    expect(valueInput!.value).toBe('1000')
  })
})

// ---------------------------------------------------------------------------
// F3 — the ConfidenceBadge spoke the UI default, and AVERAGED it
// ---------------------------------------------------------------------------
//
// This path is live: `InspectorModal.tsx:16` is `const USE_INSPECTOR_V2 = true`.
// `getEdgeConfidence` returns `beliefExists` raw — `0.8` on an edge the user
// merely drew — so clicking a fresh edge showed a "high · 80%" badge.
//
// The node case is worse: the badge is the MEAN of inbound edge confidence, so
// on a freshly drawn graph every inbound edge contributed the same 0.8 and the
// goal node showed "high · 80%" — a synthetic aggregate of a constant. An
// aggregate reads as far more evidentiary than a single field.
describe('InspectorRouter — confidence badges are provenance-gated', () => {
  const onClose = vi.fn()
  const drawn = { weight: 0.3, direction: 'positive', beliefExists: 0.8 }
  const characterised = { ...drawn, beliefExists: 0.8, beliefExistsSource: 'user' }

  function graph(edgeData: Record<string, unknown>) {
    return {
      nodes: [
        { id: 'f1', type: 'factor', data: { label: 'Price', kind: 'factor' }, position: { x: 0, y: 0 } },
        { id: 'g1', type: 'goal', data: { label: 'Revenue target', kind: 'goal' }, position: { x: 0, y: 0 } },
      ],
      edges: [{ id: 'e1', source: 'f1', target: 'g1', data: edgeData }],
    }
  }

  it('POSITIVE CONTROL: a characterised edge DOES show its confidence badge', () => {
    const g = graph(characterised)
    setStoreState(g.nodes, g.edges)
    render(<InspectorRouter nodeId={null} edgeId="e1" onClose={onClose} />)
    expect(screen.getByTestId('inspector-confidence-badge').textContent ?? '').toMatch(/80%/)
  })

  it('shows NO confidence badge for an edge nobody characterised', () => {
    const g = graph(drawn)
    setStoreState(g.nodes, g.edges)
    render(<InspectorRouter nodeId={null} edgeId="e1" onClose={onClose} />)
    // Scoped to the header BADGE — the F3 finding. The panel body's
    // "Does this connection exist?" slider is a separate ungated surface,
    // recorded as a new finding rather than silently folded in here.
    expect(screen.queryByTestId('inspector-confidence-badge')).toBeNull()
  })

  /**
   * ⚠ THIS CONTROL NOW USES TWO EDGES THAT DIFFER (22 Sep 2026), and it had to.
   * It previously passed on a SINGLE edge at 0.8 — which is the very shape the
   * node badge's own call-site comment calls "a synthetic aggregate of a
   * constant", and which `nodeConfidenceBadgeReadout` now withholds. A positive
   * control satisfied by the defect is not a control. 0.9 and 0.7 average to
   * the same 80%, so the assertion is unchanged and the fixture is honest.
   */
  it('POSITIVE CONTROL: the goal node DOES average characterised inbound edges', () => {
    setStoreState(
      [
        { id: 'f1', type: 'factor', data: { label: 'Price', kind: 'factor' }, position: { x: 0, y: 0 } },
        { id: 'f2', type: 'factor', data: { label: 'Demand', kind: 'factor' }, position: { x: 0, y: 0 } },
        { id: 'g1', type: 'goal', data: { label: 'Revenue target', kind: 'goal' }, position: { x: 0, y: 0 } },
      ],
      [
        { id: 'e1', source: 'f1', target: 'g1', data: { ...drawn, beliefExists: 0.9, beliefExistsSource: 'user' } },
        { id: 'e2', source: 'f2', target: 'g1', data: { ...drawn, beliefExists: 0.7, beliefExistsSource: 'user' } },
      ],
    )
    render(<InspectorRouter nodeId="g1" edgeId={null} onClose={onClose} />)
    expect(screen.getByTestId('inspector-confidence-badge').textContent ?? '').toMatch(/80%/)
  })

  it('withholds the NODE badge when every characterised inbound edge is the same number', () => {
    // Paul's board, bundle `482ec9e0`: both inbound goal edges carry
    // `belief_exists: 0.8` with `belief_exists_source: "cee"` — real
    // provenance, so the gate above passes them — and the panel rendered
    // `✓ 80%`. An average with no spread is the constant restated.
    setStoreState(
      [
        { id: 'f1', type: 'factor', data: { label: 'Price', kind: 'factor' }, position: { x: 0, y: 0 } },
        { id: 'f2', type: 'factor', data: { label: 'Demand', kind: 'factor' }, position: { x: 0, y: 0 } },
        { id: 'g1', type: 'goal', data: { label: 'Revenue target', kind: 'goal' }, position: { x: 0, y: 0 } },
      ],
      [
        { id: 'e1', source: 'f1', target: 'g1', data: { ...drawn, beliefExists: 0.8, beliefExistsSource: 'cee' } },
        { id: 'e2', source: 'f2', target: 'g1', data: { ...drawn, beliefExists: 0.8, beliefExistsSource: 'cee' } },
      ],
    )
    render(<InspectorRouter nodeId="g1" edgeId={null} onClose={onClose} />)
    expect(screen.queryByTestId('inspector-confidence-badge')).toBeNull()
  })

  it('does NOT synthesise a node-level aggregate out of defaulted edges', () => {
    const g = graph(drawn)
    setStoreState(g.nodes, g.edges)
    render(<InspectorRouter nodeId="g1" edgeId={null} onClose={onClose} />)
    expect(screen.queryByTestId('inspector-confidence-badge')).toBeNull()
  })

  it('averages ONLY the characterised edges, never counting a default as 0.8', () => {
    setStoreState(
      [
        { id: 'f1', type: 'factor', data: { label: 'Price', kind: 'factor' }, position: { x: 0, y: 0 } },
        { id: 'f2', type: 'factor', data: { label: 'Demand', kind: 'factor' }, position: { x: 0, y: 0 } },
        { id: 'f3', type: 'factor', data: { label: 'Churn', kind: 'factor' }, position: { x: 0, y: 0 } },
        { id: 'g1', type: 'goal', data: { label: 'Revenue target', kind: 'goal' }, position: { x: 0, y: 0 } },
      ],
      [
        { id: 'e1', source: 'f1', target: 'g1', data: { beliefExists: 0.4, beliefExistsSource: 'user' } },
        // ⚠ A SECOND CHARACTERISED EDGE, ADDED 22 Sep 2026, AND IT MAKES THIS
        // STRONGER. With one survivor the badge is now withheld for a DIFFERENT
        // reason (zero spread), so the assertion could no longer tell "the
        // default was excluded" from "the readout declined" — the two answers
        // would be byte-identical. Two differing survivors keep the exclusion
        // observable.
        { id: 'e3', source: 'f3', target: 'g1', data: { beliefExists: 0.6, beliefExistsSource: 'user' } },
        // Unstamped: must be EXCLUDED from the mean, not folded in as 0.8.
        { id: 'e2', source: 'f2', target: 'g1', data: { beliefExists: 0.8 } },
      ],
    )
    render(<InspectorRouter nodeId="g1" edgeId={null} onClose={onClose} />)
    const text = screen.getByTestId('inspector-confidence-badge').textContent ?? ''
    // Mean of the two characterised edges = 0.5 → 50%. Folding the default in
    // would give (0.4 + 0.6 + 0.8) / 3 = 0.6 → 60%.
    expect(text).toMatch(/50%/)
    expect(text).not.toMatch(/60%/)
  })
})

describe('InspectorRouter — semantic controls fail closed without GraphV3 authority', () => {
  const onClose = vi.fn()

  it('states the authority boundary and disables the whole node panel editor', () => {
    // ⚠ THIS WAS A RISK NODE, AND CANNOT BE ONE ANY MORE (A10, 25 Sep 2026).
    // `risk` joined `InspectorRouter`'s `AUTHORITY_OWNING_PANELS` — its two
    // writers now fence themselves inside `RiskPanel`, under
    // `INSPECTOR_RISK_REASON`, not the generic notice this case pins. An
    // unresolved node kind falls through to `GenericNodePanel`, still
    // blanket-wrapped and the last node panel that is.
    setStoreState([
      {
        id: 'r1',
        type: 'milestone',
        data: { label: 'Operational risk', kind: 'milestone', description: 'No bespoke panel exists for this node kind yet.' },
        position: { x: 0, y: 0 },
      },
    ])
    render(<InspectorRouter nodeId="r1" edgeId={null} onClose={onClose} />)

    // ⚠ ASSERTED IN BOTH DIRECTIONS since schemas 0.50.0, because the notice
    // now makes TWO claims and a single fragment could not tell them apart:
    // the NAME saves, and the rest of the panel does not. A test that only
    // checked the read-only half would stay green if the copy silently went
    // back to claiming the name cannot be saved either.
    expect(screen.getByTestId('inspector-authority-notice')).toHaveTextContent(
      "can't yet be saved",
    )
    expect(screen.getByTestId('inspector-authority-notice')).toHaveTextContent(
      'You can rename this',
    )
    const boundary = document.querySelector<HTMLFieldSetElement>('fieldset[data-authority="disabled"]')
    expect(boundary).not.toBeNull()
    expect(boundary).toBeDisabled()
    expect(screen.getByRole('button', { name: /close/i })).toBeEnabled()
  })

  it('applies the same boundary to relationship controls', () => {
    setStoreState(
      [
        { id: 'f1', type: 'factor', data: { label: 'Marketing' }, position: { x: 0, y: 0 } },
        { id: 'g1', type: 'goal', data: { label: 'Revenue' }, position: { x: 0, y: 0 } },
      ],
      [{ id: 'e1', source: 'f1', target: 'g1', data: { weight: 0.5, direction: 'positive' } }],
    )
    render(<InspectorRouter nodeId={null} edgeId="e1" onClose={onClose} />)
    expect(document.querySelector('fieldset[data-authority="disabled"]')).toBeDisabled()
    expect(screen.getByTestId('inspector-authority-notice')).toBeInTheDocument()
  })
})
