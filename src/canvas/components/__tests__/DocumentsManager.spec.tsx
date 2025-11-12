/**
 * M5: Documents Manager Tests
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DocumentsManager } from '../DocumentsManager'
import type { Document } from '../../share/types'

describe('DocumentsManager (M5)', () => {
  const mockDocuments: Document[] = [
    {
      id: 'doc1',
      name: 'requirements.pdf',
      type: 'pdf',
      uploadedAt: new Date('2025-01-01'),
      size: 1024 * 100, // 100KB
      metadata: { tags: ['requirements'] },
    },
    {
      id: 'doc2',
      name: 'notes.txt',
      type: 'txt',
      uploadedAt: new Date('2025-01-02'),
      size: 1024 * 50, // 50KB
    },
  ]

  it('renders document list', () => {
    const onUpload = vi.fn()
    const onDelete = vi.fn()

    render(
      <DocumentsManager
        documents={mockDocuments}
        onUpload={onUpload}
        onDelete={onDelete}
      />
    )

    expect(screen.getByText('requirements.pdf')).toBeInTheDocument()
    expect(screen.getByText('notes.txt')).toBeInTheDocument()
  })

  it('shows empty state when no documents', () => {
    const onUpload = vi.fn()
    const onDelete = vi.fn()

    render(
      <DocumentsManager
        documents={[]}
        onUpload={onUpload}
        onDelete={onDelete}
      />
    )

    expect(screen.getByText(/no documents yet/i)).toBeInTheDocument()
  })

  it('displays file sizes correctly', () => {
    const onUpload = vi.fn()
    const onDelete = vi.fn()

    render(
      <DocumentsManager
        documents={mockDocuments}
        onUpload={onUpload}
        onDelete={onDelete}
      />
    )

    expect(screen.getByText(/100\.0 KB/i)).toBeInTheDocument()
    expect(screen.getByText(/50\.0 KB/i)).toBeInTheDocument()
  })

  it('calls onDelete when delete button is clicked', () => {
    const onUpload = vi.fn()
    const onDelete = vi.fn()

    render(
      <DocumentsManager
        documents={mockDocuments}
        onUpload={onUpload}
        onDelete={onDelete}
      />
    )

    const deleteButtons = screen.getAllByTitle('Delete')
    fireEvent.click(deleteButtons[0])

    expect(onDelete).toHaveBeenCalledWith('doc1')
  })

  it('shows tags when available', () => {
    const onUpload = vi.fn()
    const onDelete = vi.fn()

    render(
      <DocumentsManager
        documents={mockDocuments}
        onUpload={onUpload}
        onDelete={onDelete}
      />
    )

    expect(screen.getByText('requirements')).toBeInTheDocument()
  })

  it('shows upload area', () => {
    const onUpload = vi.fn()
    const onDelete = vi.fn()

    render(
      <DocumentsManager
        documents={mockDocuments}
        onUpload={onUpload}
        onDelete={onDelete}
      />
    )

    expect(screen.getByText(/drag & drop files here/i)).toBeInTheDocument()
    expect(screen.getByText(/browse files/i)).toBeInTheDocument()
  })

  it('shows document count in header', () => {
    const onUpload = vi.fn()
    const onDelete = vi.fn()

    render(
      <DocumentsManager
        documents={mockDocuments}
        onUpload={onUpload}
        onDelete={onDelete}
      />
    )

    expect(screen.getByText(/2 documents/i)).toBeInTheDocument()
  })

  it('displays file type icons', () => {
    const onUpload = vi.fn()
    const onDelete = vi.fn()

    const { container } = render(
      <DocumentsManager
        documents={mockDocuments}
        onUpload={onUpload}
        onDelete={onDelete}
      />
    )

    // PDF and TXT emojis should be present
    expect(container.textContent).toContain('📄') // PDF
    expect(container.textContent).toContain('📝') // TXT
  })
})
