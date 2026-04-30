/**
 * Tests for DraftStrengthenSection.
 *
 * Critical invariants:
 *  - empty/absent strengthenItems → renders nothing (no empty container)
 *  - provenance pill is derived ONLY from canvas node lookup, never invented
 *  - no raw entity IDs (fac_, opt_, dec_) appear in rendered text
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DraftStrengthenSection } from '../DraftStrengthenSection'
import { useCanvasStore } from '../../../store'

beforeEach(() => {
  useCanvasStore.setState({
    nodes: [],
    edges: [],
    draftCoaching: null,
  })
})

describe('DraftStrengthenSection', () => {
  it('renders nothing when draftCoaching is null', () => {
    const { container } = render(<DraftStrengthenSection />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when strengthenItems is empty', () => {
    useCanvasStore.setState({
      draftCoaching: { summary: null, strengthenItems: [], wideningLog: [], biasSignals: [] },
    })
    const { container } = render(<DraftStrengthenSection />)
    expect(container.firstChild).toBeNull()
  })

  it('renders TriageCard label and detail when items present', () => {
    useCanvasStore.setState({
      draftCoaching: {
        summary: null,
        strengthenItems: [{ id: 'price', label: 'Add price evidence', detail: 'Source the baseline.' }],
        wideningLog: [],
        biasSignals: [],
      },
    })
    render(<DraftStrengthenSection />)
    expect(screen.getByText('Add price evidence')).toBeInTheDocument()
    expect(screen.getByText('Source the baseline.')).toBeInTheDocument()
  })

  it('shows "From brief" pill when matched node has provenance from_brief', () => {
    useCanvasStore.setState({
      nodes: [{ id: 'price', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Price', kind: 'factor', provenance: 'from_brief' } }],
      draftCoaching: {
        summary: null,
        strengthenItems: [{ id: 'price', label: 'Confirm price', detail: 'Looks accurate.' }],
        wideningLog: [],
        biasSignals: [],
      },
    })
    render(<DraftStrengthenSection />)
    expect(screen.getByText('From brief')).toBeInTheDocument()
  })

  it('shows "AI estimate" pill when matched node has provenance ai_inferred', () => {
    useCanvasStore.setState({
      nodes: [{ id: 'price', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Price', kind: 'factor', provenance: 'ai_inferred' } }],
      draftCoaching: {
        summary: null,
        strengthenItems: [{ id: 'price', label: 'Confirm price', detail: 'Best estimate available.' }],
        wideningLog: [],
        biasSignals: [],
      },
    })
    render(<DraftStrengthenSection />)
    expect(screen.getByText('AI estimate')).toBeInTheDocument()
  })

  it('does NOT show a pill when no matching node exists (no invented provenance)', () => {
    useCanvasStore.setState({
      nodes: [],
      draftCoaching: {
        summary: null,
        strengthenItems: [{ id: 'unknown_id', label: 'Add evidence', detail: 'Source needed.' }],
        wideningLog: [],
        biasSignals: [],
      },
    })
    render(<DraftStrengthenSection />)
    expect(screen.queryByText('From brief')).not.toBeInTheDocument()
    expect(screen.queryByText('AI estimate')).not.toBeInTheDocument()
  })

  it('does NOT render raw entity IDs', () => {
    useCanvasStore.setState({
      nodes: [{ id: 'fac_price', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Price', kind: 'factor', provenance: 'from_brief' } }],
      draftCoaching: {
        summary: null,
        strengthenItems: [{ id: 'fac_price', label: 'Strengthen price', detail: 'Add a source.' }],
        wideningLog: [],
        biasSignals: [],
      },
    })
    const { container } = render(<DraftStrengthenSection />)
    expect(container.textContent ?? '').not.toContain('fac_price')
  })

  // DELIBERATE BRIEF DEVIATION: the original brief asked for actionType to be
  // "actionable (button/chip)". We render it as a passive metadata tag because
  // no dispatcher exists. See DraftStrengthenSection.tsx header comment.
  it('renders actionType and biasCategory as passive metadata tags (no click affordance)', () => {
    useCanvasStore.setState({
      nodes: [],
      draftCoaching: {
        summary: null,
        strengthenItems: [{
          id: 'price',
          label: 'Add price evidence',
          detail: 'Source the baseline.',
          actionType: 'add_source',
          biasCategory: 'anchoring_bias',
        }],
        wideningLog: [],
        biasSignals: [],
      },
    })
    render(<DraftStrengthenSection />)
    const tagRow = screen.getByTestId('strengthen-item-tags')
    expect(tagRow).toBeInTheDocument()
    expect(tagRow.textContent).toContain('Add source')
    expect(tagRow.textContent).toContain('Anchoring bias')
    // Badges are spans, not buttons or links — assert no clickable affordance.
    expect(tagRow.querySelectorAll('button')).toHaveLength(0)
    expect(tagRow.querySelectorAll('a')).toHaveLength(0)
  })

  it('does NOT render the tag row when neither actionType nor biasCategory is present', () => {
    useCanvasStore.setState({
      nodes: [],
      draftCoaching: {
        summary: null,
        strengthenItems: [{ id: 'price', label: 'Add price evidence', detail: 'Source the baseline.' }],
        wideningLog: [],
        biasSignals: [],
      },
    })
    render(<DraftStrengthenSection />)
    expect(screen.queryByTestId('strengthen-item-tags')).not.toBeInTheDocument()
  })
})
