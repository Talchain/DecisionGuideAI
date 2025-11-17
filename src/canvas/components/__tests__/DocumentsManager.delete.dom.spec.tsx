/**
 * S8-DELETE-TOAST: DocumentsManager Delete Tests (RTL DOM)
 *
 * Goal: Verify the host receives the full Document in onDelete(id, doc)
 * so that filename toasts can be shown. We do not assert on the toast here.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DocumentsManager } from '../DocumentsManager'
import { useCanvasStore } from '../../store'
import type { Document } from '../../share/types'

// Mock Zustand store
vi.mock('../../store', () => ({
  useCanvasStore: vi.fn(),
}))

describe('DocumentsManager - Delete (S8-DELETE-TOAST)', () => {
  const mockDocuments: Document[] = [
    {
      id: 'doc1',
      name: 'requirements.pdf',
      type: 'pdf',
      uploadedAt: new Date('2025-01-01'),
      size: 1024 * 100,
      content: 'content',
    },
    {
      id: 'doc2',
      name: 'notes.txt',
      type: 'txt',
      uploadedAt: new Date('2025-01-02'),
      size: 1024 * 50,
      content: 'content',
    },
  ]

  let mockRemoveDocument: ReturnType<typeof vi.fn>
  let mockRenameDocument: ReturnType<typeof vi.fn>
  let mockSetSearchQuery: ReturnType<typeof vi.fn>
  let mockSetSort: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockRemoveDocument = vi.fn()
    mockRenameDocument = vi.fn()
    mockSetSearchQuery = vi.fn()
    mockSetSort = vi.fn()

    vi.mocked(useCanvasStore).mockImplementation((selector: any) => {
      const state = {
        documents: mockDocuments,
        documentSearchQuery: '',
        documentSortField: 'date' as const,
        documentSortDirection: 'desc' as const,
        removeDocument: mockRemoveDocument,
        renameDocument: mockRenameDocument,
        setDocumentSearchQuery: mockSetSearchQuery,
        setDocumentSort: mockSetSort,
      }
      return selector(state)
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('calls onDelete with id and full Document before removing from store', () => {
    const callOrder: string[] = []
    const onDelete = vi.fn((_id: string, _doc?: Document) => {
      callOrder.push('onDelete')
    })

    // Track when removeDocument is invoked
    mockRemoveDocument.mockImplementation(() => {
      callOrder.push('remove')
    })

    render(<DocumentsManager onUpload={vi.fn()} onDelete={onDelete} />)

    // Click delete on one of the documents
    const deleteButtons = screen.getAllByLabelText('Delete document')
    expect(deleteButtons).toHaveLength(2)

    fireEvent.click(deleteButtons[0])

    expect(onDelete).toHaveBeenCalledTimes(1)
    expect(mockRemoveDocument).toHaveBeenCalledTimes(1)
    const [id, doc] = onDelete.mock.calls[0] as [string, Document]

    // Host should receive the exact Document object from the store
    const expectedDoc = mockDocuments.find(d => d.id === id)
    expect(expectedDoc).toBeDefined()
    expect(doc).toBe(expectedDoc)

    // Ensure onDelete was called before removeDocument
    expect(callOrder).toEqual(['onDelete', 'remove'])
  })
})

