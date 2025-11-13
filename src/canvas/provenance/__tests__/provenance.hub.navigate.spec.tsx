/**
 * N3: Provenance Hub Navigation Tests
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ProvenanceHub } from '../ProvenanceHub'

describe('Provenance Hub Navigation', () => {
  const mockCitations = [
    {
      id: 'c1',
      nodeId: 'n1',
      text: 'Citation from document',
      source: 'document-1'
    },
    {
      id: 'c2',
      edgeId: 'e1',
      text: 'Citation from metric',
      source: 'metric-1'
    }
  ]

  it('renders search input', () => {
    render(
      <ProvenanceHub
        citations={mockCitations as any}
        onGoToNode={vi.fn()}
        onGoToEdge={vi.fn()}
        redactionEnabled={true}
        onToggleRedaction={vi.fn()}
      />
    )

    expect(screen.getByPlaceholderText('Search citations...')).toBeInTheDocument()
  })

  it('filters citations by search query', () => {
    render(
      <ProvenanceHub
        citations={mockCitations as any}
        onGoToNode={vi.fn()}
        onGoToEdge={vi.fn()}
        redactionEnabled={true}
        onToggleRedaction={vi.fn()}
      />
    )

    const searchInput = screen.getByPlaceholderText('Search citations...')
    fireEvent.change(searchInput, { target: { value: 'document' } })

    expect(screen.getByText(/"Citation from document"/)).toBeInTheDocument()
    expect(screen.queryByText(/"Citation from metric"/)).not.toBeInTheDocument()
  })

  it('filters by source type', () => {
    render(
      <ProvenanceHub
        citations={mockCitations as any}
        onGoToNode={vi.fn()}
        onGoToEdge={vi.fn()}
        redactionEnabled={true}
        onToggleRedaction={vi.fn()}
      />
    )

    const documentFilter = screen.getByLabelText('Filter by document')
    fireEvent.click(documentFilter)

    expect(screen.getByText(/"Citation from document"/)).toBeInTheDocument()
  })

  it('calls onGoToNode when "Go to node" clicked', () => {
    const onGoToNode = vi.fn()
    render(
      <ProvenanceHub
        citations={mockCitations as any}
        onGoToNode={onGoToNode}
        onGoToEdge={vi.fn()}
        redactionEnabled={true}
        onToggleRedaction={vi.fn()}
      />
    )

    const goToButtons = screen.getAllByText(/Go to node/)
    fireEvent.click(goToButtons[0])

    expect(onGoToNode).toHaveBeenCalledWith('n1')
  })

  it('redacts long quotes by default', () => {
    const longCitation = {
      id: 'c3',
      nodeId: 'n2',
      text: 'x'.repeat(200),
      source: 'long-source'
    }

    render(
      <ProvenanceHub
        citations={[longCitation] as any}
        onGoToNode={vi.fn()}
        onGoToEdge={vi.fn()}
        redactionEnabled={true}
        onToggleRedaction={vi.fn()}
      />
    )

    const text = screen.getByText(/"x/)
    expect(text.textContent?.length).toBeLessThan(150) // Truncated
  })

  it('shows reveal button in dev mode', () => {
    render(
      <ProvenanceHub
        citations={mockCitations as any}
        onGoToNode={vi.fn()}
        onGoToEdge={vi.fn()}
        redactionEnabled={true}
        onToggleRedaction={vi.fn()}
      />
    )

    if (import.meta.env.DEV) {
      expect(screen.getByText(/Reveal Full Quotes/)).toBeInTheDocument()
    }
  })
})
