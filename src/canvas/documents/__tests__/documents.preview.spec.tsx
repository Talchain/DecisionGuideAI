/**
 * N3: Documents Preview Tests
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DocumentsDrawer } from '../DocumentsDrawer'

describe('Documents Preview', () => {
  const mockDocuments = [
    {
      id: 'd1',
      filename: 'test.txt',
      content: 'Line 1\nLine 2\nLine 3',
      size: 1024
    }
  ]

  it('renders preview with line numbers', () => {
    render(<DocumentsDrawer documents={mockDocuments as any} isOpen={true} onClose={vi.fn()} />)

    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('shows file type chip', () => {
    render(<DocumentsDrawer documents={mockDocuments as any} isOpen={true} onClose={vi.fn()} />)

    expect(screen.getByText('TXT')).toBeInTheDocument()
  })

  it('shows file size', () => {
    render(<DocumentsDrawer documents={mockDocuments as any} isOpen={true} onClose={vi.fn()} />)

    expect(screen.getByText('1.0 KB')).toBeInTheDocument()
  })

  it('shows truncation message for large files', () => {
    const largeDoc = {
      id: 'd2',
      filename: 'large.txt',
      content: 'x'.repeat(6000),
      size: 6000
    }

    render(<DocumentsDrawer documents={[largeDoc] as any} isOpen={true} onClose={vi.fn()} />)

    expect(screen.getByText(/Content truncated at 5,000 characters/)).toBeInTheDocument()
  })

  it('shows warning for oversized files', () => {
    const oversized = {
      id: 'd3',
      filename: 'big.pdf',
      content: '',
      size: 2 * 1024 * 1024 // 2 MB
    }

    render(<DocumentsDrawer documents={[oversized] as any} isOpen={true} onClose={vi.fn()} />)

    expect(screen.getByText(/File exceeds 1 MB limit/)).toBeInTheDocument()
  })
})
