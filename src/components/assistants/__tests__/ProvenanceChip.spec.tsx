/**
 * ProvenanceChip Tests (Phase B - M2.5)
 *
 * Verifies:
 * - Renders source count correctly (0, 1, multiple)
 * - Snippet redaction (≤100 chars when redacted)
 * - Expand/collapse toggle
 * - Redaction toggle button
 * - Document metadata display (name, snippet, offset)
 * - Empty state (no render when documents.length === 0)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ProvenanceChip, useProvenanceSettings } from '../ProvenanceChip'
import { renderHook, act } from '@testing-library/react'

describe('ProvenanceChip', () => {
  const mockDocuments = [
    {
      id: 'doc1',
      name: 'Research Paper.pdf',
      snippet: 'This is a short snippet that should not be truncated when redacted.',
      char_offset: 123,
    },
    {
      id: 'doc2',
      name: 'Data Analysis.csv',
      snippet: 'x'.repeat(150), // 150 chars - should be truncated
      char_offset: 456,
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Rendering states', () => {
    it('should return null when no documents provided', () => {
      const { container } = render(<ProvenanceChip documents={[]} />)
      expect(container.firstChild).toBeNull()
    })

    it('should render single source correctly', () => {
      render(<ProvenanceChip documents={[mockDocuments[0]]} />)

      expect(screen.getByText('1 source')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '1 source' })).toBeInTheDocument()
    })

    it('should render multiple sources correctly', () => {
      render(<ProvenanceChip documents={mockDocuments} />)

      expect(screen.getByText('2 sources')).toBeInTheDocument()
    })

    it('should show tooltip with all document names', () => {
      render(<ProvenanceChip documents={mockDocuments} />)

      const button = screen.getByRole('button', { name: '2 sources' })
      expect(button).toHaveAttribute('title', 'Sources: Research Paper.pdf, Data Analysis.csv')
    })
  })

  describe('Expand/collapse behavior', () => {
    it('should not show expanded view initially', () => {
      render(<ProvenanceChip documents={mockDocuments} />)

      expect(screen.queryByText('Document Sources')).not.toBeInTheDocument()
    })

    it('should expand on click', () => {
      render(<ProvenanceChip documents={mockDocuments} />)

      const button = screen.getByRole('button', { name: '2 sources' })
      fireEvent.click(button)

      expect(screen.getByText('Document Sources')).toBeInTheDocument()
      expect(screen.getByText('Research Paper.pdf')).toBeInTheDocument()
      expect(screen.getByText('Data Analysis.csv')).toBeInTheDocument()
    })

    it('should collapse on second click', () => {
      render(<ProvenanceChip documents={mockDocuments} />)

      const button = screen.getByRole('button', { name: '2 sources' })
      fireEvent.click(button) // Expand
      fireEvent.click(button) // Collapse

      expect(screen.queryByText('Document Sources')).not.toBeInTheDocument()
    })
  })

  describe('Redaction behavior', () => {
    it('should redact snippets by default (≤100 chars)', () => {
      render(<ProvenanceChip documents={mockDocuments} redacted={true} />)

      const button = screen.getByRole('button', { name: '2 sources' })
      fireEvent.click(button)

      // Long snippet should be truncated to 100 chars + '...'
      const truncatedSnippet = 'x'.repeat(100) + '...'
      expect(screen.getByText(`"${truncatedSnippet}"`)).toBeInTheDocument()
    })

    it('should not redact when redacted=false', () => {
      render(<ProvenanceChip documents={mockDocuments} redacted={false} />)

      const button = screen.getByRole('button', { name: '2 sources' })
      fireEvent.click(button)

      // Long snippet should not be truncated
      const fullSnippet = 'x'.repeat(150)
      expect(screen.getByText(`"${fullSnippet}"`)).toBeInTheDocument()
    })

    it('should not truncate short snippets even when redacted', () => {
      render(<ProvenanceChip documents={[mockDocuments[0]]} redacted={true} />)

      const button = screen.getByRole('button', { name: '1 source' })
      fireEvent.click(button)

      expect(screen.getByText(`"${mockDocuments[0].snippet}"`)).toBeInTheDocument()
    })

    it('should show redaction toggle button when provided', () => {
      const onToggle = vi.fn()
      render(<ProvenanceChip documents={mockDocuments} redacted={true} onToggleRedaction={onToggle} />)

      const button = screen.getByRole('button', { name: '2 sources' })
      fireEvent.click(button)

      expect(screen.getByText('Show full')).toBeInTheDocument()
    })

    it('should call onToggleRedaction when toggle clicked', () => {
      const onToggle = vi.fn()
      render(<ProvenanceChip documents={mockDocuments} redacted={true} onToggleRedaction={onToggle} />)

      const button = screen.getByRole('button', { name: '2 sources' })
      fireEvent.click(button)

      const toggleButton = screen.getByText('Show full').closest('button')
      fireEvent.click(toggleButton!)

      expect(onToggle).toHaveBeenCalledTimes(1)
    })

    it('should show "Redact" when not redacted', () => {
      const onToggle = vi.fn()
      render(<ProvenanceChip documents={mockDocuments} redacted={false} onToggleRedaction={onToggle} />)

      const button = screen.getByRole('button', { name: '2 sources' })
      fireEvent.click(button)

      expect(screen.getByText('Redact')).toBeInTheDocument()
    })

    it('should not show toggle button when onToggleRedaction not provided', () => {
      render(<ProvenanceChip documents={mockDocuments} redacted={true} />)

      const button = screen.getByRole('button', { name: '2 sources' })
      fireEvent.click(button)

      expect(screen.queryByText('Show full')).not.toBeInTheDocument()
      expect(screen.queryByText('Redact')).not.toBeInTheDocument()
    })
  })

  describe('Document metadata display', () => {
    it('should display document name', () => {
      render(<ProvenanceChip documents={[mockDocuments[0]]} />)

      const button = screen.getByRole('button', { name: '1 source' })
      fireEvent.click(button)

      expect(screen.getByText('Research Paper.pdf')).toBeInTheDocument()
    })

    it('should display snippet when provided', () => {
      render(<ProvenanceChip documents={[mockDocuments[0]]} redacted={false} />)

      const button = screen.getByRole('button', { name: '1 source' })
      fireEvent.click(button)

      expect(screen.getByText(`"${mockDocuments[0].snippet}"`)).toBeInTheDocument()
    })

    it('should display char_offset when provided', () => {
      render(<ProvenanceChip documents={[mockDocuments[0]]} />)

      const button = screen.getByRole('button', { name: '1 source' })
      fireEvent.click(button)

      expect(screen.getByText('Offset: 123')).toBeInTheDocument()
    })

    it('should handle missing snippet gracefully', () => {
      const docWithoutSnippet = { id: 'doc3', name: 'No Snippet.txt' }
      render(<ProvenanceChip documents={[docWithoutSnippet]} redacted={false} />)

      const button = screen.getByRole('button', { name: '1 source' })
      fireEvent.click(button)

      expect(screen.getByText('No Snippet.txt')).toBeInTheDocument()
      // Snippet div should not render when snippet is undefined
      expect(screen.queryByText(/^".*"$/)).not.toBeInTheDocument()
    })

    it('should not display offset when undefined', () => {
      const docWithoutOffset = { id: 'doc3', name: 'No Offset.txt', snippet: 'Test' }
      render(<ProvenanceChip documents={[docWithoutOffset]} />)

      const button = screen.getByRole('button', { name: '1 source' })
      fireEvent.click(button)

      expect(screen.queryByText(/offset:/i)).not.toBeInTheDocument()
    })
  })

  describe('Edge cases', () => {
    it('should handle exactly 100 char snippet (boundary)', () => {
      const exactDoc = {
        id: 'exact',
        name: 'Exact.txt',
        snippet: 'x'.repeat(100),
      }
      render(<ProvenanceChip documents={[exactDoc]} redacted={true} />)

      const button = screen.getByRole('button', { name: '1 source' })
      fireEvent.click(button)

      // Should not truncate 100 chars
      expect(screen.getByText(`"${'x'.repeat(100)}"`)).toBeInTheDocument()
    })

    it('should handle exactly 101 char snippet (just over boundary)', () => {
      const overDoc = {
        id: 'over',
        name: 'Over.txt',
        snippet: 'x'.repeat(101),
      }
      render(<ProvenanceChip documents={[overDoc]} redacted={true} />)

      const button = screen.getByRole('button', { name: '1 source' })
      fireEvent.click(button)

      // Should truncate to 100 + '...'
      expect(screen.getByText(`"${'x'.repeat(100)}..."`)).toBeInTheDocument()
    })
  })
})

describe('useProvenanceSettings', () => {
  it('should default to redacted=true', () => {
    const { result } = renderHook(() => useProvenanceSettings())

    expect(result.current.redacted).toBe(true)
  })

  it('should toggle redaction state', () => {
    const { result } = renderHook(() => useProvenanceSettings())

    act(() => {
      result.current.toggleRedaction()
    })

    expect(result.current.redacted).toBe(false)

    act(() => {
      result.current.toggleRedaction()
    })

    expect(result.current.redacted).toBe(true)
  })
})
