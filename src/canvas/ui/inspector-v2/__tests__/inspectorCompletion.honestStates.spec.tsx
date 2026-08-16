/**
 * Inspector completion — L-40 (self-contradictions) + L-24 (add-path divergence).
 *
 * RED-first. Each case is bound to its object by IDENTITY (panel-group testids,
 * node ids, string-table constants), never by a value predicate another element
 * could satisfy.
 *
 * L-40 half A (S02): "This option doesn't change any factors yet" rendered
 * DIRECTLY ABOVE a populated Connections list. The empty-state was derived from
 * `data.interventions` while the connections list was derived from `edges` —
 * two different data sources answering the same user-facing question. The fix
 * derives the empty state from the SAME edge data the connections list reads.
 *
 * L-40 half B (S04): the Decision inspector said "No connections yet." while
 * the canvas showed its edges. `otherConnections` EXCLUDES option edges by
 * design (options live in the Input group), so a decision whose only edges are
 * its options rendered a flat denial of edges the user can see. The fix counts
 * what the user sees, or names the concept honestly.
 *
 * L-24: the Impact group was gated on GLOBAL results mode. An option added
 * after the last run therefore rendered the same "unavailable for this analysis
 * run" copy as an option the run genuinely returned nothing for — two different
 * situations under one sentence. The fix derives the state PER NODE.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

import { OptionPanel } from '../panels/OptionPanel'
import { DecisionPanel } from '../panels/DecisionPanel'
import { InspectorRouter } from '../InspectorRouter'
import { useCanvasStore } from '../../../store'
import { useGuidanceStore } from '../../../stores/guidanceStore'
import { EMPTY_STATES, OPTION_STRINGS, DECISION_STRINGS } from '../inspectorStrings'

vi.mock('@xyflow/react', () => ({
  useViewport: () => ({ x: 0, y: 0, zoom: 1 }),
}))

vi.mock('../../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(),
}))

import { useNodeDisplayMetadata } from '../../../hooks/useNodeDisplayMetadata'
const mockDisplayMetadata = useNodeDisplayMetadata as ReturnType<typeof vi.fn>

const baseMetadata = {
  sensitivityRank: null,
  influence: null,
  confidence: null,
  valueOfInformation: null,
  inSensitivityAnalysis: false,
  winRate: null,
}

const optionProps = {
  nodeId: 'optA',
  techMode: false,
  onClose: vi.fn(),
  onNavigate: vi.fn(),
}

const decisionProps = {
  nodeId: 'dec1',
  techMode: false,
  onClose: vi.fn(),
  onNavigate: vi.fn(),
}

function setStore(patch: Record<string, unknown>) {
  useCanvasStore.setState({
    ...useCanvasStore.getState(),
    results: { status: 'none', report: null },
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
    ...patch,
  } as never)
}

beforeEach(() => {
  vi.clearAllMocks()
  mockDisplayMetadata.mockReturnValue(baseMetadata)
  useGuidanceStore.setState({
    guidanceItems: [],
    _sendMessage: null,
    _prefillChat: null,
    _dispatchAction: null,
  } as never)
})

// ─────────────────────────────────────────────────────────────────────
// L-40 half A — the option empty-state must agree with the connections list
// ─────────────────────────────────────────────────────────────────────

describe('L-40 · OptionPanel does not deny factor links it is simultaneously listing', () => {
  /**
   * The exact S02 shape: an add-path option with NO `interventions` map but
   * three real outbound edges to factors. The Connections group renders three
   * rows from `edges`; the Input group must not deny them.
   */
  function setContradictionStore() {
    setStore({
      nodes: [
        { id: 'optA', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Hire aggressively', description: '' } },
        { id: 'fac1', type: 'factor', position: { x: 1, y: 0 }, data: { label: 'Team productivity', category: 'controllable' } },
        { id: 'fac2', type: 'factor', position: { x: 2, y: 0 }, data: { label: 'Hiring spend', category: 'controllable' } },
        { id: 'fac3', type: 'factor', position: { x: 3, y: 0 }, data: { label: 'Onboarding load', category: 'controllable' } },
      ],
      edges: [
        { id: 'e1', source: 'optA', target: 'fac1', data: {} },
        { id: 'e2', source: 'optA', target: 'fac2', data: {} },
        { id: 'e3', source: 'optA', target: 'fac3', data: {} },
      ],
    })
  }

  it('renders the three factor connections (fixture precondition — pinned in-test)', () => {
    setContradictionStore()
    const { container } = render(<OptionPanel {...optionProps} />)
    const connections = container.querySelector('[data-panel-group="connections"]')
    expect(connections).not.toBeNull()
    // Pin the precondition: this fixture DOES render a populated list. Without
    // this the absence assertion below could pass on an empty panel.
    expect(connections?.textContent).toContain('Team productivity')
    expect(connections?.textContent).toContain('Hiring spend')
    expect(connections?.textContent).toContain('Onboarding load')
    expect(connections?.textContent).not.toContain(EMPTY_STATES.noInterventions)
  })

  it('does NOT render the "changes no factors" denial while those connections are on screen', () => {
    setContradictionStore()
    const { container } = render(<OptionPanel {...optionProps} />)
    const input = container.querySelector('[data-panel-group="input"]')
    expect(input).not.toBeNull()
    expect(input?.textContent).not.toContain(EMPTY_STATES.noInterventions)
  })

  it('names the unset-values state honestly, counting the same edges the list reads', () => {
    setContradictionStore()
    render(<OptionPanel {...optionProps} />)
    expect(screen.getByTestId('option-links-without-values')).toBeTruthy()
    expect(screen.getByTestId('option-links-without-values').textContent).toContain('3')
  })

  it('still shows the true empty state when there are no factor links at all', () => {
    setStore({
      nodes: [
        { id: 'optA', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Do nothing', description: '' } },
        { id: 'dec1', type: 'decision', position: { x: 1, y: 0 }, data: { label: 'The decision' } },
      ],
      // Only the organisational decision→option edge exists.
      edges: [{ id: 'e0', source: 'dec1', target: 'optA', data: {} }],
    })
    const { container } = render(<OptionPanel {...optionProps} />)
    const input = container.querySelector('[data-panel-group="input"]')
    expect(input?.textContent).toContain(EMPTY_STATES.noInterventions)
    expect(screen.queryByTestId('option-links-without-values')).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────
// L-40 half B — the Decision inspector must not deny edges the canvas draws
// ─────────────────────────────────────────────────────────────────────

describe('L-40 · DecisionPanel does not claim "no connections" while its options are edges', () => {
  function setDecisionStore() {
    setStore({
      nodes: [
        { id: 'dec1', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'Launch strategy', description: '' } },
        { id: 'optA', type: 'option', position: { x: 1, y: 0 }, data: { label: 'Option A', interventions: {} } },
        { id: 'optB', type: 'option', position: { x: 2, y: 0 }, data: { label: 'Option B', interventions: {} } },
      ],
      edges: [
        { id: 'e1', source: 'dec1', target: 'optA', data: {} },
        { id: 'e2', source: 'dec1', target: 'optB', data: {} },
      ],
    })
  }

  it('lists both options (fixture precondition — pinned in-test)', () => {
    setDecisionStore()
    const { container } = render(<DecisionPanel {...decisionProps} />)
    const input = container.querySelector('[data-panel-group="input"]')
    expect(input?.textContent).toContain('Option A')
    expect(input?.textContent).toContain('Option B')
  })

  it('does NOT render the flat "No connections yet." denial', () => {
    setDecisionStore()
    const { container } = render(<DecisionPanel {...decisionProps} />)
    const connections = container.querySelector('[data-panel-group="connections"]')
    expect(connections).not.toBeNull()
    expect(connections?.textContent).not.toContain(EMPTY_STATES.noConnectionsFlat)
  })

  it('names where those connections are, counting the option edges the canvas draws', () => {
    setDecisionStore()
    render(<DecisionPanel {...decisionProps} />)
    const el = screen.getByTestId('decision-connections-are-options')
    expect(el.textContent).toContain('2')
  })

  it('still shows the plain empty state for a decision with genuinely no edges', () => {
    setStore({
      nodes: [{ id: 'dec1', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'Untouched decision' } }],
      edges: [],
    })
    const { container } = render(<DecisionPanel {...decisionProps} />)
    const connections = container.querySelector('[data-panel-group="connections"]')
    expect(connections?.textContent).toContain(EMPTY_STATES.noConnectionsFlat)
    expect(screen.queryByTestId('decision-connections-are-options')).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────
// L-24 — per-node Impact gating + a real router fallback
// ─────────────────────────────────────────────────────────────────────

describe('L-24 · OptionPanel Impact group is derived per node, not from global results mode', () => {
  const analysedReport = {
    option_comparison: [
      { option_id: 'optOld', win_probability: 0.62, label: 'Existing option' },
    ],
  }

  function setAddPathStore() {
    setStore({
      nodes: [
        { id: 'optA', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Newly added option' } },
        { id: 'optOld', type: 'option', position: { x: 1, y: 0 }, data: { label: 'Existing option' } },
      ],
      edges: [],
      results: { status: 'complete', report: analysedReport },
    })
  }

  it('tells a node added since the last run WHY it has no impact, not "unavailable"', () => {
    setAddPathStore()
    mockDisplayMetadata.mockReturnValue({ ...baseMetadata, winRate: null })
    const { container } = render(<OptionPanel {...optionProps} />)
    const impact = container.querySelector('[data-panel-group="impact"]')
    expect(impact).not.toBeNull()
    expect(screen.getByTestId('option-impact-not-in-run')).toBeTruthy()
    // The generic sentence must NOT be what an add-path node gets: it conflates
    // "the run did not cover you" with "the run returned nothing for you".
    expect(impact?.textContent).not.toContain(OPTION_STRINGS.impactUnavailable)
  })

  it('keeps the honest generic fallback for a node the run DID cover but returned nothing for', () => {
    setStore({
      nodes: [
        { id: 'optA', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Covered option' } },
      ],
      edges: [],
      // optA IS in the comparison, but with no win_probability.
      results: { status: 'complete', report: { option_comparison: [{ option_id: 'optA', label: 'Covered option' }] } },
    })
    mockDisplayMetadata.mockReturnValue({ ...baseMetadata, winRate: null })
    const { container } = render(<OptionPanel {...optionProps} />)
    const impact = container.querySelector('[data-panel-group="impact"]')
    expect(impact?.textContent).toContain(OPTION_STRINGS.impactUnavailable)
    expect(screen.queryByTestId('option-impact-not-in-run')).toBeNull()
  })

  it('renders no Impact group at all before any analysis has run', () => {
    setStore({
      nodes: [{ id: 'optA', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Fresh option' } }],
      edges: [],
      results: { status: 'none', report: null },
    })
    const { container } = render(<OptionPanel {...optionProps} />)
    expect(container.querySelector('[data-panel-group="impact"]')).toBeNull()
  })
})

describe('L-24 · InspectorRouter never renders NOTHING for a selected node', () => {
  it.each([
    ['action', { id: 'n1', type: 'action', data: { label: 'Draft the brief', kind: 'action' }, position: { x: 0, y: 0 } }],
    ['constraint', { id: 'n1', type: 'constraint', data: { label: 'Budget cap', kind: 'constraint' }, position: { x: 0, y: 0 } }],
    ['ghost-option', { id: 'n1', type: 'ghost-option', data: { label: 'Suggested option', kind: 'ghost-option' }, position: { x: 0, y: 0 } }],
  ])('renders a fallback panel for a %s node', (_kind, node) => {
    setStore({ nodes: [node], edges: [] })
    const { container } = render(
      <InspectorRouter nodeId="n1" edgeId={null} onClose={vi.fn()} />,
    )
    expect(container.innerHTML).not.toBe('')
    expect(screen.getByTestId('inspector-generic-panel')).toBeTruthy()
    // The element's own name must be on screen — the fallback is a panel, not a
    // placeholder that loses the user's selection.
    expect(container.textContent).toContain(String((node as { data: { label: string } }).data.label))
  })

  it('still renders nothing when the selection resolves to no node at all', () => {
    setStore({ nodes: [], edges: [] })
    const { container } = render(
      <InspectorRouter nodeId="missing" edgeId={null} onClose={vi.fn()} />,
    )
    expect(container.innerHTML).toBe('')
  })
})

describe('string table — the honest-state copy exists and is user language', () => {
  it('exposes the constants the panels bind to', () => {
    expect(typeof EMPTY_STATES.noConnectionsFlat).toBe('string')
    expect(typeof OPTION_STRINGS.impactNotInLastRun).toBe('string')
    expect(typeof OPTION_STRINGS.linksWithoutValues).toBe('string')
    expect(typeof DECISION_STRINGS.connectionsAreOptions).toBe('string')
  })

  it('carries no raw enum or engineering tokens', () => {
    const copy = [
      EMPTY_STATES.noConnectionsFlat,
      OPTION_STRINGS.impactNotInLastRun,
      OPTION_STRINGS.linksWithoutValues,
      DECISION_STRINGS.connectionsAreOptions,
    ].join(' ')
    expect(copy).not.toMatch(/_[a-z]+_/)
    expect(copy).not.toMatch(/\b(null|undefined|winRate|option_comparison)\b/)
  })
})
