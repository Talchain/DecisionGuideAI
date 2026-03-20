/**
 * ContestedEdgeCard — unit tests
 */

import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ContestedEdgeCard } from '../ContestedEdgeCard'
import type { Edge, Node } from '@xyflow/react'
import type { ValidationMetadata } from '../../../domain/validation'

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

vi.mock('../../../utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusEdgeById: vi.fn(),
}))

vi.mock('../../../utils/evidenceCoverage', () => ({
  NON_EVIDENCE_PROVENANCE: ['assumption', 'template', 'ai-suggested'],
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeNode(id: string, label: string): Node {
  return { id, type: 'factor', position: { x: 0, y: 0 }, data: { label } }
}

function makeValidation(overrides: Partial<ValidationMetadata> = {}): ValidationMetadata {
  return {
    status: 'contested',
    contested_reasons: ['strength_band_change'],
    pass1: { strength_mean: 0.6, strength_std: 0.08, exists_probability: 0.7 },
    pass2: {
      strength_mean: 0.35,
      strength_std: 0.12,
      exists_probability: 0.7,
      reasoning: 'Typical B2B ROI shows moderate conversion effects',
      basis: 'domain_prior',
      needs_user_input: false,
    },
    max_divergence: 0.5,
    distance_to_goal: 1,
    evoi_rank: null,
    evoi_impact: null,
    was_shown: false,
    user_action: 'pending',
    resolved_value: null,
    resolved_by: 'default',
    ...overrides,
  }
}

function makeEdge(id: string, source: string, target: string, validation?: ValidationMetadata): Edge {
  return {
    id,
    source,
    target,
    data: {
      weight: 0.6,
      direction: 'positive',
      beliefExists: 0.7,
      provenance: 'assumption',
      ...(validation ? { validation } : {}),
    },
  }
}

const nodes = [makeNode('n1', 'Factor A'), makeNode('n2', 'Factor B')]
const mockResolve = vi.fn()

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ContestedEdgeCard', () => {
  it('renders edge label with from and to node names', () => {
    render(
      <ContestedEdgeCard
        edge={makeEdge('e1', 'n1', 'n2', makeValidation())}
        nodes={nodes}
        validation={makeValidation()}
        isFragile={false}
        onResolve={mockResolve}
      />
    )
    // Labels appear inside the estimate-block question text
    expect(screen.getByText(/How strongly does Factor A affect Factor B/)).toBeInTheDocument()
  })

  it('shows "contested" pill when pending', () => {
    render(
      <ContestedEdgeCard
        edge={makeEdge('e1', 'n1', 'n2', makeValidation())}
        nodes={nodes}
        validation={makeValidation()}
        isFragile={false}
        onResolve={mockResolve}
      />
    )
    expect(screen.getByTestId('contested-pill-e1')).toHaveTextContent('contested')
  })

  it('shows fragile pill when isFragile=true', () => {
    render(
      <ContestedEdgeCard
        edge={makeEdge('e1', 'n1', 'n2', makeValidation())}
        nodes={nodes}
        validation={makeValidation()}
        isFragile={true}
        onResolve={mockResolve}
      />
    )
    expect(screen.getByText('fragile')).toBeInTheDocument()
  })

  it('does not show fragile pill when isFragile=false', () => {
    render(
      <ContestedEdgeCard
        edge={makeEdge('e1', 'n1', 'n2', makeValidation())}
        nodes={nodes}
        validation={makeValidation()}
        isFragile={false}
        onResolve={mockResolve}
      />
    )
    expect(screen.queryByText('fragile')).not.toBeInTheDocument()
  })

  it('shows pass1 and pass2 strength labels', () => {
    render(
      <ContestedEdgeCard
        edge={makeEdge('e1', 'n1', 'n2', makeValidation())}
        nodes={nodes}
        validation={makeValidation()}
        isFragile={false}
        onResolve={mockResolve}
      />
    )
    expect(screen.getByTestId('contested-pass1-e1')).toHaveTextContent('Strong positive effect')
    expect(screen.getByTestId('contested-pass2-e1')).toHaveTextContent('Moderate positive effect')
  })

  it('basis label always precedes reasoning text in the DOM', () => {
    render(
      <ContestedEdgeCard
        edge={makeEdge('e1', 'n1', 'n2', makeValidation())}
        nodes={nodes}
        validation={makeValidation()}
        isFragile={false}
        onResolve={mockResolve}
      />
    )
    const basisEl = screen.getByTestId('contested-basis-label-e1')
    const reasoningEl = screen.getByTestId('contested-reasoning-e1')
    // Basis must appear before reasoning in DOM order
    expect(
      basisEl.compareDocumentPosition(reasoningEl) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    expect(basisEl).toHaveTextContent('Based on general domain knowledge')
    expect(reasoningEl).toHaveTextContent('Typical B2B ROI shows moderate conversion effects')
  })

  it('shows all basis labels correctly', () => {
    const bases = [
      ['brief_explicit', 'Based on your brief'],
      ['structural_inference', 'Inferred from model structure'],
      ['domain_prior', 'Based on general domain knowledge'],
      ['weak_guess', 'Uncertain — your input would help'],
    ] as const
    for (const [basis, expectedLabel] of bases) {
      const { unmount } = render(
        <ContestedEdgeCard
          edge={makeEdge('e1', 'n1', 'n2', makeValidation({ pass2: { ...makeValidation().pass2, basis } }))}
          nodes={nodes}
          validation={makeValidation({ pass2: { ...makeValidation().pass2, basis } })}
          isFragile={false}
          onResolve={mockResolve}
        />
      )
      expect(screen.getByTestId('contested-basis-label-e1')).toHaveTextContent(expectedLabel)
      unmount()
    }
  })

  it('does NOT show evoi impact when evoi_impact is null', () => {
    render(
      <ContestedEdgeCard
        edge={makeEdge('e1', 'n1', 'n2', makeValidation())}
        nodes={nodes}
        validation={makeValidation({ evoi_impact: null })}
        isFragile={false}
        onResolve={mockResolve}
      />
    )
    expect(screen.queryByTestId('contested-evoi-e1')).not.toBeInTheDocument()
  })

  it('shows evoi impact statement when evoi_impact is set', () => {
    render(
      <ContestedEdgeCard
        edge={makeEdge('e1', 'n1', 'n2', makeValidation())}
        nodes={nodes}
        validation={makeValidation({ evoi_impact: 12 })}
        isFragile={false}
        onResolve={mockResolve}
      />
    )
    expect(screen.getByTestId('contested-evoi-e1')).toHaveTextContent('12 percentage points')
  })

  it('calls onResolve with accepted_pass1 when "Accept current" clicked', () => {
    const onResolve = vi.fn()
    render(
      <ContestedEdgeCard
        edge={makeEdge('e1', 'n1', 'n2', makeValidation())}
        nodes={nodes}
        validation={makeValidation()}
        isFragile={false}
        onResolve={onResolve}
      />
    )
    fireEvent.click(screen.getByTestId('contested-accept-pass1-e1'))
    expect(onResolve).toHaveBeenCalledWith('e1', 'accepted_pass1')
  })

  it('calls onResolve with accepted_pass2 when "Accept review" clicked', () => {
    const onResolve = vi.fn()
    render(
      <ContestedEdgeCard
        edge={makeEdge('e1', 'n1', 'n2', makeValidation())}
        nodes={nodes}
        validation={makeValidation()}
        isFragile={false}
        onResolve={onResolve}
      />
    )
    fireEvent.click(screen.getByTestId('contested-accept-pass2-e1'))
    expect(onResolve).toHaveBeenCalledWith('e1', 'accepted_pass2')
  })

  it('calls onResolve with dismissed when "Dismiss" clicked', () => {
    const onResolve = vi.fn()
    render(
      <ContestedEdgeCard
        edge={makeEdge('e1', 'n1', 'n2', makeValidation())}
        nodes={nodes}
        validation={makeValidation()}
        isFragile={false}
        onResolve={onResolve}
      />
    )
    fireEvent.click(screen.getByTestId('contested-dismiss-e1'))
    expect(onResolve).toHaveBeenCalledWith('e1', 'dismissed')
  })

  it('shows "Enter your own" custom input when button clicked', () => {
    render(
      <ContestedEdgeCard
        edge={makeEdge('e1', 'n1', 'n2', makeValidation())}
        nodes={nodes}
        validation={makeValidation()}
        isFragile={false}
        onResolve={mockResolve}
      />
    )
    fireEvent.click(screen.getByTestId('contested-enter-own-e1'))
    expect(screen.getByTestId('contested-custom-input-e1-display')).toBeInTheDocument()
  })

  it('calls onResolve with overridden + signed custom mean when custom confirmed', () => {
    const onResolve = vi.fn()
    render(
      <ContestedEdgeCard
        edge={makeEdge('e1', 'n1', 'n2', makeValidation())}
        nodes={nodes}
        validation={makeValidation()}
        isFragile={false}
        onResolve={onResolve}
      />
    )
    fireEvent.click(screen.getByTestId('contested-enter-own-e1'))
    // Input starts in display mode; click to edit
    fireEvent.click(screen.getByTestId('contested-custom-input-e1-display'))
    const input = screen.getByTestId('contested-custom-input-e1')
    fireEvent.change(input, { target: { value: '0.45' } })
    fireEvent.blur(input)
    fireEvent.click(screen.getByTestId('contested-custom-confirm-e1'))
    expect(onResolve).toHaveBeenCalledWith('e1', 'overridden', 0.45)
  })

  it('shows resolved confirmation with check icon when resolved', () => {
    render(
      <ContestedEdgeCard
        edge={makeEdge('e1', 'n1', 'n2', makeValidation())}
        nodes={nodes}
        validation={makeValidation({ user_action: 'accepted_pass1' })}
        isFragile={false}
        onResolve={mockResolve}
      />
    )
    expect(screen.getByTestId('contested-resolved-e1')).toBeInTheDocument()
    expect(screen.getByTestId('contested-resolved-e1')).toHaveTextContent('Kept current model value')
    // Resolve actions should be gone
    expect(screen.queryByTestId('contested-actions-e1')).not.toBeInTheDocument()
  })

  it('shows resolved pill text when dismissed', () => {
    render(
      <ContestedEdgeCard
        edge={makeEdge('e1', 'n1', 'n2', makeValidation())}
        nodes={nodes}
        validation={makeValidation({ user_action: 'dismissed' })}
        isFragile={false}
        onResolve={mockResolve}
      />
    )
    expect(screen.getByTestId('contested-pill-e1')).toHaveTextContent('Dismissed')
  })

  it('hides estimate block when resolved', () => {
    render(
      <ContestedEdgeCard
        edge={makeEdge('e1', 'n1', 'n2', makeValidation())}
        nodes={nodes}
        validation={makeValidation({ user_action: 'accepted_pass2' })}
        isFragile={false}
        onResolve={mockResolve}
      />
    )
    // pass1/pass2 elements are inside the estimate block which is hidden when resolved
    expect(screen.queryByTestId('contested-pass1-e1')).not.toBeInTheDocument()
    expect(screen.queryByTestId('contested-pass2-e1')).not.toBeInTheDocument()
  })

  it('does not show full detail section without DetailToggleContext', () => {
    // Default context value is showDetail=false — detail panel should be absent
    render(
      <ContestedEdgeCard
        edge={makeEdge('e1', 'n1', 'n2', makeValidation())}
        nodes={nodes}
        validation={makeValidation()}
        isFragile={false}
        onResolve={mockResolve}
      />
    )
    expect(screen.queryByTestId('contested-detail-e1')).not.toBeInTheDocument()
  })

  it('applies selection ring when isSelected=true', () => {
    render(
      <ContestedEdgeCard
        edge={makeEdge('e1', 'n1', 'n2', makeValidation())}
        nodes={nodes}
        validation={makeValidation()}
        isFragile={false}
        isSelected={true}
        onResolve={mockResolve}
      />
    )
    expect(screen.getByTestId('contested-card-e1').className).toMatch(/ring-1/)
  })

  it('does not apply selection ring when isSelected=false', () => {
    render(
      <ContestedEdgeCard
        edge={makeEdge('e1', 'n1', 'n2', makeValidation())}
        nodes={nodes}
        validation={makeValidation()}
        isFragile={false}
        isSelected={false}
        onResolve={mockResolve}
      />
    )
    expect(screen.getByTestId('contested-card-e1').className).not.toMatch(/ring-1/)
  })

  it('shows contested reason label', () => {
    render(
      <ContestedEdgeCard
        edge={makeEdge('e1', 'n1', 'n2', makeValidation())}
        nodes={nodes}
        validation={makeValidation({ contested_reasons: ['sign_flip'] })}
        isFragile={false}
        onResolve={mockResolve}
      />
    )
    expect(
      screen.getByText('Our reviews disagree on whether this effect is positive or negative')
    ).toBeInTheDocument()
  })
})
