/**
 * YourExpertise spec — Brief 5 Task 1 expand-in-place behaviour.
 *
 * Covers:
 * - Empty-model case: no chevron, Paul's "Your model is fully calibrated" copy.
 * - Brief-only case: summary renders, no expansion affordance.
 * - Expandable case: click/chevron/keyboard toggles `aria-expanded` and DOM.
 * - Expanded state renders AI estimates and Missing data groups conditionally.
 * - "Audit all relationships in Model tab" link preserves the existing
 *   setActiveOutputTab('diagnostics') deep-link.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { YourExpertise } from '../YourExpertise'
import type { ImprovementItem } from '../../hooks/usePreAnalysisData'
import type { Node } from '@xyflow/react'

// Stub UI store so tests can assert the deep-link call without pulling in the
// real zustand store.
const setActiveOutputTab = vi.fn()
vi.mock('@/stores/uiStore', () => ({
  useUIStore: Object.assign(
    () => ({ setActiveOutputTab }),
    { getState: () => ({ setActiveOutputTab }) },
  ),
}))

function makeVerifyItem(nodeId: string, label: string): ImprovementItem {
  return {
    key: `verify-${nodeId}`,
    category: 'verify',
    label,
    detail: 'AI estimate',
    subgroup: 'cee_inference',
    focus: { type: 'node', id: nodeId, label },
    action: { label: 'Confirm value', kind: 'confirm', targetId: nodeId, targetType: 'node' },
  }
}

function makeFactorNode(id: string, label: string, observedValue: number | null = null): Node {
  const node: Node = {
    id,
    position: { x: 0, y: 0 },
    data: {
      kind: 'factor',
      label,
      observedState: observedValue == null ? {} : { value: observedValue },
    },
  }
  return node
}

describe('YourExpertise — Brief 5 Task 1 expand-in-place', () => {
  beforeEach(() => {
    setActiveOutputTab.mockClear()
  })

  it('renders empty-model copy with no chevron when AI estimates and missing data are both zero', () => {
    render(
      <YourExpertise
        improvementsByCategory={{ verify: [] }}
        contestedEdges={[]}
        nodes={[]}
        edges={[]}
      />
    )

    expect(screen.getByText('Your model is fully calibrated')).toBeInTheDocument()
    // No expansion affordance — no header button, no chevron.
    expect(screen.queryByTestId('your-expertise-header')).not.toBeInTheDocument()
    expect(screen.queryByTestId('your-expertise-expanded')).not.toBeInTheDocument()
  })

  it('renders brief-only summary with no chevron but keeps a Model-tab deep-link as the row action', () => {
    const briefItem: ImprovementItem = {
      key: 'brief-f1',
      category: 'verify',
      label: 'Factor from brief',
      detail: 'Extracted from brief',
      subgroup: 'brief_extraction',
      focus: { type: 'node', id: 'f1', label: 'Factor from brief' },
    }
    render(
      <YourExpertise
        improvementsByCategory={{ verify: [briefItem] }}
        contestedEdges={[]}
        nodes={[makeFactorNode('f1', 'Factor from brief', 0.5)]}
        edges={[]}
      />
    )

    expect(screen.getByTestId('expertise-summary')).toHaveTextContent('1 from brief')
    // No chevron / expansion affordance …
    expect(screen.queryByTestId('your-expertise-header')).not.toBeInTheDocument()
    expect(screen.queryByTestId('your-expertise-expanded')).not.toBeInTheDocument()
    // … but the row stays clickable as a Model-tab deep-link so users can
    // still audit factors without an expansion target.
    const deepLinkRow = screen.getByTestId('your-expertise-section')
    expect(deepLinkRow.tagName).toBe('BUTTON')
    expect(deepLinkRow).toHaveAttribute(
      'aria-label',
      'Open Model tab to audit factors and relationships',
    )
    expect(screen.getByTestId('your-expertise-model-link')).toHaveTextContent(
      'Audit in Model tab',
    )
    fireEvent.click(deepLinkRow)
    expect(setActiveOutputTab).toHaveBeenCalledWith('diagnostics')
  })

  it('collapses the expanded state when analysisRunKey changes (rerun parity)', () => {
    const ai = makeVerifyItem('f1', 'X')
    const { rerender } = render(
      <YourExpertise
        improvementsByCategory={{ verify: [ai] }}
        contestedEdges={[]}
        nodes={[]}
        edges={[]}
        analysisRunKey="run-before"
      />
    )
    fireEvent.click(screen.getByTestId('your-expertise-header'))
    expect(screen.getByTestId('your-expertise-header')).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByTestId('your-expertise-expanded')).toBeInTheDocument()

    // New analysis run completes → key changes → expansion collapses.
    rerender(
      <YourExpertise
        improvementsByCategory={{ verify: [ai] }}
        contestedEdges={[]}
        nodes={[]}
        edges={[]}
        analysisRunKey="run-after"
      />
    )
    expect(screen.getByTestId('your-expertise-header')).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByTestId('your-expertise-expanded')).not.toBeInTheDocument()
  })

  it('offers an expandable header when there are AI estimates, and toggles aria-expanded on click', () => {
    const ai = makeVerifyItem('f1', 'Dedicated Design Expertise')
    render(
      <YourExpertise
        improvementsByCategory={{ verify: [ai] }}
        contestedEdges={[]}
        nodes={[]}
        edges={[]}
      />
    )

    const header = screen.getByTestId('your-expertise-header')
    expect(header).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByTestId('your-expertise-expanded')).not.toBeInTheDocument()

    fireEvent.click(header)
    expect(header).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByTestId('your-expertise-expanded')).toBeInTheDocument()

    fireEvent.click(header)
    expect(header).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByTestId('your-expertise-expanded')).not.toBeInTheDocument()
  })

  it('expanded surface renders AI estimates group when aiN > 0', () => {
    const ai = makeVerifyItem('f1', 'Dedicated Design Expertise')
    render(
      <YourExpertise
        improvementsByCategory={{ verify: [ai] }}
        contestedEdges={[]}
        nodes={[]}
        edges={[]}
      />
    )
    fireEvent.click(screen.getByTestId('your-expertise-header'))

    // AI-estimates SubgroupDivider renders "Estimated (1)" label.
    expect(screen.getByText(/Estimated \(1\)/)).toBeInTheDocument()
    expect(screen.queryByText(/Missing data \(/)).not.toBeInTheDocument()
  })

  it('expanded surface renders Missing data group when missingN > 0 and hides Estimated group when aiN is zero', () => {
    render(
      <YourExpertise
        improvementsByCategory={{ verify: [] }}
        contestedEdges={[]}
        nodes={[makeFactorNode('f2', 'Missing factor', null)]}
        edges={[]}
      />
    )
    fireEvent.click(screen.getByTestId('your-expertise-header'))

    expect(screen.queryByText(/Estimated \(/)).not.toBeInTheDocument()
    expect(screen.getByText(/Missing data \(1\)/)).toBeInTheDocument()
  })

  it('"Audit all relationships in Model tab" link calls setActiveOutputTab(diagnostics) — existing deep-link preserved', () => {
    const ai = makeVerifyItem('f1', 'Dedicated Design Expertise')
    render(
      <YourExpertise
        improvementsByCategory={{ verify: [ai] }}
        contestedEdges={[]}
        nodes={[]}
        edges={[]}
      />
    )
    fireEvent.click(screen.getByTestId('your-expertise-header'))

    const link = screen.getByTestId('your-expertise-model-link')
    expect(link).toHaveTextContent('Audit all relationships in Model tab')

    fireEvent.click(link)
    expect(setActiveOutputTab).toHaveBeenCalledWith('diagnostics')
    expect(setActiveOutputTab).toHaveBeenCalledTimes(1)
  })

  it('keyboard: Enter toggles expansion', () => {
    const ai = makeVerifyItem('f1', 'X')
    render(
      <YourExpertise
        improvementsByCategory={{ verify: [ai] }}
        contestedEdges={[]}
        nodes={[]}
        edges={[]}
      />
    )
    const header = screen.getByTestId('your-expertise-header')
    header.focus()
    fireEvent.keyDown(header, { key: 'Enter' })
    expect(header).toHaveAttribute('aria-expanded', 'true')
    fireEvent.keyDown(header, { key: 'Enter' })
    expect(header).toHaveAttribute('aria-expanded', 'false')
  })

  it('chevron rotates 90° when expanded (class-based transform)', () => {
    const ai = makeVerifyItem('f1', 'X')
    const { container } = render(
      <YourExpertise
        improvementsByCategory={{ verify: [ai] }}
        contestedEdges={[]}
        nodes={[]}
        edges={[]}
      />
    )
    const header = screen.getByTestId('your-expertise-header')
    // Chevron is the last svg inside the header (after the Info icon).
    const getChevron = () => {
      const svgs = container.querySelectorAll('[data-testid="your-expertise-header"] svg')
      return svgs[svgs.length - 1]
    }
    const chevronClass = () => (getChevron()?.getAttribute('class') ?? '')

    expect(chevronClass()).not.toContain('rotate-90')
    fireEvent.click(header)
    expect(chevronClass()).toContain('rotate-90')
  })
})
