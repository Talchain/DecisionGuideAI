/**
 * Canvas visual contract v3.1 — the inspector BODY (DESIGN-GAP-v31 rows 32, 33).
 *
 *   Detail rows (`.detail-row`, 12px, 1px `#EEE9E1` rules), one
 *   `.section-highlight`, a 10px note — no box inside a box, no generic
 *   coaching card, no italic placeholder reading as content.
 *   Risk (unset): "Likelihood and impact are not recorded … does not imply low
 *   risk" — never "Not set. Click to enter." over controls that cannot save.
 *   No "simulation" wording (the contract has none).
 *   The Question inspector must not list its options under "Your input".
 *
 * Truth rule held throughout: a control that cannot persist must not LOOK
 * editable. The router mounts the risk pane `readOnly` (its likelihood/impact
 * writers have no carrier), so that pane now states values as rows.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'

vi.mock('@xyflow/react', () => ({ useViewport: () => ({ x: 0, y: 0, zoom: 1 }) }))
vi.mock('../../../conversation/revealOlumi', () => ({ revealOlumiSurface: vi.fn() }))

import { InspectorRouter } from '../InspectorRouter'
import { RiskPanel, INSPECTOR_RISK_ABSENCE } from '../panels/RiskPanel'
import { useCanvasStore } from '../../../store'
import { useGuidanceStore, type GuidanceItem } from '../../../stores/guidanceStore'
import { COACHING } from '../coachingConfig'
import { DESCRIPTION_PLACEHOLDERS, INSPECTOR_DESCRIPTION_EMPTY, EMPTY_STATES, GOAL_CONSTRAINT_COPY } from '../inspectorStrings'

const INSPECTOR_NO_ANALYSIS_RESULTS = EMPTY_STATES.noAnalysis

const NODES = [
  { id: 'g1', type: 'goal', data: { label: 'Revenue target', kind: 'goal' }, position: { x: 0, y: 0 } },
  { id: 'd1', type: 'decision', data: { label: 'Strategy', kind: 'decision' }, position: { x: 0, y: 0 } },
  { id: 'o1', type: 'option', data: { label: 'Grow', kind: 'option', interventions: { fc: 0.8 } }, position: { x: 0, y: 0 } },
  { id: 'o2', type: 'option', data: { label: 'Hold', kind: 'option' }, position: { x: 0, y: 0 } },
  { id: 'fc', type: 'factor', data: { label: 'Budget', kind: 'factor', category: 'controllable', value: 0.4 }, position: { x: 0, y: 0 } },
  { id: 'fe', type: 'factor', data: { label: 'Competition', kind: 'factor', category: 'external' }, position: { x: 0, y: 0 } },
  { id: 'fo', type: 'factor', data: { label: 'Churn', kind: 'factor', category: 'observable' }, position: { x: 0, y: 0 } },
  { id: 'oc', type: 'outcome', data: { label: 'Revenue', kind: 'outcome' }, position: { x: 0, y: 0 } },
  { id: 'r1', type: 'risk', data: { label: 'Op risk', kind: 'risk' }, position: { x: 0, y: 0 } },
]
const EDGES = [
  { id: 'e-d1-o1', source: 'd1', target: 'o1', data: {} },
  { id: 'e-d1-o2', source: 'd1', target: 'o2', data: {} },
  { id: 'e-o1-fc', source: 'o1', target: 'fc', data: {} },
  { id: 'e1', source: 'fc', target: 'oc', data: { weight: 0.5, weightSource: 'user', direction: 'positive' } },
  { id: 'e2', source: 'fe', target: 'r1', data: { weight: 0.4, weightSource: 'user', direction: 'positive' } },
]

const NODE_PANES = ['g1', 'd1', 'o1', 'fc', 'fe', 'fo', 'oc', 'r1'] as const
// The static fallback sentences the generic card rendered. `goalNoTarget` is
// excluded BY KEY: its words are also the goal pane's own sentence under its
// target control (`GOAL_CONSTRAINT_COPY.targetUnlocks`, a conditional fact
// shown only while no target exists) — pane copy, not the card.
const GENERIC_COACHING = Object.entries(COACHING)
  .filter(([k, v]) => typeof v === 'string' && k !== 'goalNoTarget')
  .map(([, v]) => v as string)
expect(GOAL_CONSTRAINT_COPY.targetUnlocks.startsWith(COACHING.goalNoTarget)).toBe(true)

function seed(nodes: ReadonlyArray<Record<string, unknown>> = NODES) {
  useCanvasStore.setState({
    nodes: nodes as never[],
    edges: EDGES as never[],
    results: { status: 'idle' },
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
    goalThreshold: null,
    confirmedNodeIds: new Set(),
    _internal: {},
  } as never)
}

function guidanceFor(id: string, title: string): GuidanceItem {
  return {
    item_id: `gi-${id}`,
    signal_code: 'evidence_gap',
    category: 'should_fix',
    source: 'analysis',
    title,
    detail: '',
    primary_action: { type: 'discuss', prompt: `Discuss ${id}` },
    target_object: { type: 'node', id, label: id },
    priority: 80,
  } as GuidanceItem
}

beforeEach(() => {
  useGuidanceStore.setState({ guidanceItems: [], _prefillChat: vi.fn(), _sendMessage: null, _dispatchAction: null } as never)
  seed()
})

describe('v3.1 body — no box in a box, no generic coaching, no italic placeholder', () => {
  for (const id of NODE_PANES) {
    it(`${id}: flat body, clearly-empty description, no generic card, no simulation wording`, () => {
      const { container } = render(<InspectorRouter nodeId={id} edgeId={null} onClose={vi.fn()} />)
      const body = screen.getByTestId('inspector-body')
      const text = body.textContent ?? ''

      // No generic lightbulb coaching card: no glyph, and none of the static
      // fallback sentences, when no grounded guidance item targets the element.
      expect(container.querySelector('svg.lucide-lightbulb')).toBeNull()
      for (const generic of GENERIC_COACHING) expect(text).not.toContain(generic)

      // Placeholders never read as content: none of the prompt questions, and
      // nothing italic.
      for (const placeholder of Object.values(DESCRIPTION_PLACEHOLDERS)) expect(text).not.toContain(placeholder)
      expect(body.querySelectorAll('.italic')).toHaveLength(0)
      const empty = screen.queryByTestId('inspector-description-empty')
      if (empty) expect(empty.textContent).toBe(INSPECTOR_DESCRIPTION_EMPTY)

      // Flat: the primary control area is not a bordered box.
      for (const card of screen.queryAllByTestId('primary-control-card')) {
        expect(card.className).not.toMatch(/\bborder\b|rounded/)
      }

      // The contract has no simulation wording.
      expect(text).not.toMatch(/simulation/i)
    })
  }

  it('⭐ CONTRAST — a GROUNDED guidance item for the element still renders, flat, with its action', () => {
    useGuidanceStore.setState({ guidanceItems: [guidanceFor('r1', 'Evidence here would most reduce uncertainty.')] } as never)
    render(<InspectorRouter nodeId="r1" edgeId={null} onClose={vi.fn()} />)
    const card = screen.getByTestId('inspector-guidance')
    expect(card).toHaveTextContent('Evidence here would most reduce uncertainty.')
    expect(card.querySelector('svg.lucide-lightbulb')).toBeNull()
    expect(within(card).getByRole('button', { name: 'Discuss' })).not.toBeDisabled()
  })

  it('option: its factor targets are flat rows, not cards inside a card', () => {
    render(<InspectorRouter nodeId="o1" edgeId={null} onClose={vi.fn()} />)
    const row = screen.getByTestId('inspector-intervention-fc')
    expect(row.className).not.toMatch(/rounded|bg-panel/)
    expect(row.className).toContain('border-b')
  })
})

describe('v3.1 — the Question inspector does not list its options under "Your input"', () => {
  it('lists them as Alternatives (flat, navigable), and no group is labelled "Your input"', () => {
    const { container } = render(<InspectorRouter nodeId="d1" edgeId={null} onClose={vi.fn()} />)
    const groups = Array.from(container.querySelectorAll('[data-panel-group]'))
    const labels = groups.map(g => g.firstElementChild?.textContent ?? '')
    expect(labels).not.toContain('Your input')
    const alternatives = container.querySelector('[data-panel-group="alternatives"]') as HTMLElement
    expect(alternatives).not.toBeNull()
    expect(within(alternatives).getByText('Grow')).toBeTruthy()
    expect(within(alternatives).getByText('Hold')).toBeTruthy()
  })
})

describe('v3.1 — goal and risk copy', () => {
  it('goal with a stated target, pre-run: no "Run the simulation…"; the absence is stated plainly', () => {
    seed(NODES.map(n => n.id === 'g1'
      ? { ...n, data: { ...n.data, goal_threshold_raw: 0.8 } }
      : n))
    useCanvasStore.setState({ goalThreshold: 0.8 } as never)
    const { container } = render(<InspectorRouter nodeId="g1" edgeId={null} onClose={vi.fn()} />)
    // PRECONDITION: the mounted target block is on screen, with a probability
    // line under it (else this is vacuous).
    expect(screen.getByTestId('goal-panel-target-block')).toBeTruthy()
    expect(screen.getByTestId('goal-probability-absent')).toHaveTextContent(INSPECTOR_NO_ANALYSIS_RESULTS)
    expect(container.textContent).not.toMatch(/simulation/i)
  })

  it('risk (unset, as mounted): absence copy, no controls that cannot save, no severity sentence', () => {
    render(<InspectorRouter nodeId="r1" edgeId={null} onClose={vi.fn()} />)
    expect(screen.getByTestId('risk-absence')).toHaveTextContent(INSPECTOR_RISK_ABSENCE)
    expect(INSPECTOR_RISK_ABSENCE).toMatch(/not recorded/)
    expect(INSPECTOR_RISK_ABSENCE).toMatch(/does not imply low risk/)
    expect(screen.queryByTestId('risk-probability-display')).toBeNull()
    for (const level of ['low', 'medium', 'high', 'critical']) {
      expect(screen.queryByTestId(`risk-impact-${level}`)).toBeNull()
    }
    expect(screen.queryByText('Not set. Click to enter.')).toBeNull()
    expect(screen.queryByText(/Severity combines/)).toBeNull()
  })

  it('⭐ CONTRAST — a risk WITH recorded values states them as rows, and no absence copy', () => {
    seed(NODES.map(n => n.id === 'r1' ? { ...n, data: { ...n.data, probability: 0.3, impact: 'high' } } : n))
    render(<InspectorRouter nodeId="r1" edgeId={null} onClose={vi.fn()} />)
    expect(screen.queryByTestId('risk-absence')).toBeNull()
    expect(screen.getByTestId('risk-likelihood-row')).toHaveTextContent('30%')
    expect(screen.getByTestId('risk-impact-row')).toHaveTextContent('High')
    expect(screen.getByTestId('risk-severity-badge')).toBeTruthy()
    expect(screen.queryByTestId('risk-probability-display')).toBeNull()
  })

  it('⭐ CONTRAST — where the pane is NOT read-only, its editors are still there (for when a carrier lands)', () => {
    render(<RiskPanel nodeId="r1" techMode={false} onClose={vi.fn()} onNavigate={vi.fn()} />)
    expect(screen.getByTestId('risk-probability-display')).toBeTruthy()
    expect(screen.getByTestId('risk-impact-high')).toBeTruthy()
  })
})
