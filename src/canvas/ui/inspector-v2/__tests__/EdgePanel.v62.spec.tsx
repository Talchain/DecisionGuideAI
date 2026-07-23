/**
 * EdgePanel v6.2 — redesign-specific tests.
 *
 * Covers: context group fragility gate, quick-set active state,
 * tech mode editable inputs, coaching fallback.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EdgePanel } from '../panels/EdgePanel'
import { useCanvasStore } from '../../../store'
import { useGuidanceStore } from '../../../stores/guidanceStore'

function setStore(overrides: Record<string, unknown> = {}) {
  const state = useCanvasStore.getState()
  useCanvasStore.setState({
    ...state,
    nodes: [
      { id: 'fac1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Marketing budget' } },
      { id: 'out1', type: 'outcome', position: { x: 100, y: 0 }, data: { label: 'Revenue' } },
    ],
    edges: [
      { id: 'e1', source: 'fac1', target: 'out1', data: { weight: 0.35, direction: 'positive', beliefExists: 0.82, strengthStd: 0.15 } },
    ],
    results: { status: 'none', report: null },
    ...overrides,
  } as any)
}

const panelProps = {
  edgeId: 'e1',
  techMode: false,
  onClose: vi.fn(),
  onNavigate: vi.fn(),
}

beforeEach(() => {
  useCanvasStore.setState(useCanvasStore.getState(), true)
  useGuidanceStore.setState({ guidanceItems: [], _prefillChat: null, _sendMessage: null })
})

describe('EdgePanel v6.2 — context group', () => {
  it('omits context group when edge is not fragile', () => {
    setStore({ results: { status: 'complete', report: { robustness: { fragile_edges: [] } } } })
    const { container } = render(<EdgePanel {...panelProps} />)
    expect(container.querySelector('[data-panel-group="context"]')).toBeNull()
  })

  it('shows context group with sensitivity statement when edge is fragile', () => {
    setStore({
      results: {
        status: 'complete',
        report: {
          robustness: {
            fragile_edges: [{ edge_id: 'e1', from: 'fac1', to: 'out1', switch_probability: 0.65 }],
          },
        },
      },
    })
    const { container } = render(<EdgePanel {...panelProps} />)
    expect(container.querySelector('[data-panel-group="context"]')).not.toBeNull()
    expect(screen.getByText('Sensitive assumption')).toBeTruthy()
    expect(screen.getByText(/Small changes here could shift which option performs best/)).toBeTruthy()
    expect(screen.getByText('65% flip risk')).toBeTruthy()
  })
})

describe('EdgePanel v6.2 — your input group', () => {
  it('renders strength question and quick-set buttons', () => {
    setStore()
    render(<EdgePanel {...panelProps} />)
    expect(screen.getByText('How strong is this effect?')).toBeTruthy()
    // StrengthBandButtons renders the four labels
    expect(screen.getByText('Slight')).toBeTruthy()
    expect(screen.getByText('Moderate')).toBeTruthy()
    expect(screen.getByText('Strong')).toBeTruthy()
    expect(screen.getByText('Very strong')).toBeTruthy()
  })

  it('renders existence slider with percentage', () => {
    setStore()
    render(<EdgePanel {...panelProps} />)
    expect(screen.getByText('Does this connection exist?')).toBeTruthy()
    expect(screen.getByText('82%')).toBeTruthy()
    expect(screen.getByText('Unlikely')).toBeTruthy()
    expect(screen.getByText('Very likely')).toBeTruthy()
  })

  it('shows editable β input in tech mode', () => {
    setStore()
    render(<EdgePanel {...panelProps} techMode={true} />)
    expect(screen.getByText('β =')).toBeTruthy()
  })

  it('shows editable P(exists) input in tech mode', () => {
    setStore()
    render(<EdgePanel {...panelProps} techMode={true} />)
    expect(screen.getByText('P(exists) =')).toBeTruthy()
  })

  it('shows editable σ input in tech mode', () => {
    setStore()
    render(<EdgePanel {...panelProps} techMode={true} />)
    expect(screen.getByText('σ =')).toBeTruthy()
  })

  it('hides uncertainty section in default mode', () => {
    setStore()
    render(<EdgePanel {...panelProps} techMode={false} />)
    expect(screen.queryByText('σ =')).toBeNull()
    expect(screen.queryByText('Strength uncertainty')).toBeNull()
  })
})

describe('EdgePanel v6.2 — evidence group', () => {
  // The permanently-empty "No evidence yet" placeholder was removed (honesty
  // sweep): DraftChat strips per-edge provenance upstream, so it rendered a
  // fixed note for every edge that never reflected real evidence.
  it('does NOT render the removed no-evidence placeholder', () => {
    setStore()
    render(<EdgePanel {...panelProps} />)
    expect(screen.queryByText('No evidence yet')).toBeNull()
    expect(screen.queryByText(/Olumi estimated this from your brief/)).toBeNull()
  })

  it('omits the Evidence group entirely for a non-contested edge', () => {
    setStore()
    const { container } = render(<EdgePanel {...panelProps} />)
    expect(container.querySelector('[data-panel-group="evidence"]')).toBeNull()
  })

  it('renders the Evidence group with the live contested-validation calibration', () => {
    // The contested-validation surface is live (CEE multi-pass disagreement on
    // edge.data.validation) — it must survive the note removal.
    const contestedValidation = {
      status: 'contested',
      contested_reasons: ['raw_magnitude'],
      pass1: { strength_mean: 0.35, strength_std: 0.15, exists_probability: 0.82 },
      pass2: {
        strength_mean: 0.62,
        strength_std: 0.2,
        exists_probability: 0.7,
        reasoning: 'Second pass read the brief as a stronger link.',
        basis: 'domain_prior',
        needs_user_input: true,
      },
      max_divergence: 0.27,
      distance_to_goal: 1,
      evoi_rank: null,
      evoi_impact: null,
      surfaced: true,
      was_shown: false,
      user_action: 'pending',
      resolved_value: null,
      resolved_by: 'default',
    }
    setStore({
      edges: [
        {
          id: 'e1',
          source: 'fac1',
          target: 'out1',
          data: {
            weight: 0.35,
            direction: 'positive',
            beliefExists: 0.82,
            strengthStd: 0.15,
            validation: contestedValidation,
          },
        },
      ],
    })
    const { container } = render(<EdgePanel {...panelProps} />)
    expect(container.querySelector('[data-panel-group="evidence"]')).not.toBeNull()
    expect(screen.getByText('Needs your judgement')).toBeTruthy()
    expect(screen.getByText(/Second pass read the brief as a stronger link/)).toBeTruthy()
  })
})

describe('EdgePanel v6.2 — coaching', () => {
  it('renders static coaching fallback when no guidance items', () => {
    setStore()
    useGuidanceStore.setState({ _prefillChat: vi.fn() })
    render(<EdgePanel {...panelProps} />)
    expect(screen.getByText(/generated automatically/)).toBeTruthy()
  })

  it('renders orchestrator guidance when matching item exists', () => {
    setStore()
    useGuidanceStore.setState({
      guidanceItems: [{
        item_id: 'g1',
        signal_code: 'edge_calibration',
        category: 'should_fix' as const,
        source: 'analysis' as const,
        title: 'Orchestrator edge coaching',
        primary_action: { type: 'discuss' as const, prompt: 'Tell me more' },
        target_object: { type: 'edge' as const, id: 'e1' },
        priority: 80,
      }],
      _prefillChat: vi.fn(),
    })
    render(<EdgePanel {...panelProps} />)
    expect(screen.getByText(/Orchestrator edge coaching/)).toBeTruthy()
  })
})
