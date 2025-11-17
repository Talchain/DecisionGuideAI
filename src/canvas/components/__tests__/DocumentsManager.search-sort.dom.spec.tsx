/**
 * S7-FILEOPS: DocumentsManager Search & Sort Tests (RTL DOM)
 * Tests search filtering, sorting by multiple fields, and session persistence
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { DocumentsManager } from '../DocumentsManager'
import { useCanvasStore } from '../../store'
import type { Document } from '../../share/types'

// Mock Zustand store
vi.mock('../../store', () => ({
  useCanvasStore: vi.fn(),
}))

describe('DocumentsManager - Search & Sort (S7-FILEOPS)', () => {
  const mockDocuments: Document[] = [
    {
      id: 'doc1',
      name: 'alpha-requirements.pdf',
      type: 'pdf',
      uploadedAt: new Date('2025-01-01'),
      size: 1024 * 200, // 200KB
      text: 'content',
    },
    {
      id: 'doc2',
      name: 'beta-notes.txt',
      type: 'txt',
      uploadedAt: new Date('2025-01-03'),
      size: 1024 * 50, // 50KB
      text: 'content',
    },
    {
      id: 'doc3',
      name: 'gamma-data.csv',
      type: 'csv',
      uploadedAt: new Date('2025-01-02'),
      size: 1024 * 150, // 150KB
      text: 'content',
    },
    {
      id: 'doc4',
      name: 'delta-readme.md',
      type: 'md',
      uploadedAt: new Date('2025-01-04'),
      size: 1024 * 75, // 75KB
      text: 'content',
    },
  ]

  let mockRenameDocument: ReturnType<typeof vi.fn>
  let mockRemoveDocument: ReturnType<typeof vi.fn>
  let mockSetSearchQuery: ReturnType<typeof vi.fn>
  let mockSetSort: ReturnType<typeof vi.fn>
  let searchQuery: string
  let sortField: 'name' | 'date' | 'size' | 'type'
  let sortDirection: 'asc' | 'desc'

  beforeEach(() => {
    mockRenameDocument = vi.fn()
    mockRemoveDocument = vi.fn()
    searchQuery = ''
    sortField = 'date'
    sortDirection = 'desc'

    mockSetSearchQuery = vi.fn((query: string) => {
      searchQuery = query
    })

    mockSetSort = vi.fn((field: typeof sortField, direction: typeof sortDirection) => {
      sortField = field
      sortDirection = direction
    })

    vi.mocked(useCanvasStore).mockImplementation((selector: any) => {
      const state = {
        documents: mockDocuments,
        documentSearchQuery: searchQuery,
        documentSortField: sortField,
        documentSortDirection: sortDirection,
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

  describe('Search UI', () => {
    it('shows search input when documents present', () => {
      render(<DocumentsManager onUpload={vi.fn()} />)

      expect(screen.getByPlaceholderText('Search documents...')).toBeInTheDocument()
    })

    it('hides search controls when no documents', () => {
      vi.mocked(useCanvasStore).mockImplementation((selector: any) => {
        const state = {
          documents: [],
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

      render(<DocumentsManager onUpload={vi.fn()} />)

      expect(screen.queryByPlaceholderText('Search documents...')).not.toBeInTheDocument()
    })

    it('shows clear button when search query present', () => {
      searchQuery = 'test'
      vi.mocked(useCanvasStore).mockImplementation((selector: any) => {
        const state = {
          documents: mockDocuments,
          documentSearchQuery: 'test',
          documentSortField: sortField,
          documentSortDirection: sortDirection,
          removeDocument: mockRemoveDocument,
          renameDocument: mockRenameDocument,
          setDocumentSearchQuery: mockSetSearchQuery,
          setDocumentSort: mockSetSort,
        }
        return selector(state)
      })

      render(<DocumentsManager onUpload={vi.fn()} />)

      expect(screen.getByLabelText('Clear search')).toBeInTheDocument()
    })

    it('hides clear button when search query empty', () => {
      render(<DocumentsManager onUpload={vi.fn()} />)

      expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument()
    })

    it('has proper accessibility attributes on search input', () => {
      render(<DocumentsManager onUpload={vi.fn()} />)

      const searchInput = screen.getByPlaceholderText('Search documents...')
      expect(searchInput).toHaveAttribute('aria-label', 'Search documents')
      expect(searchInput).toHaveAttribute('type', 'text')
    })
  })

  describe('Search Behavior', () => {
    it('calls setSearchQuery when typing in search box', () => {
      render(<DocumentsManager onUpload={vi.fn()} />)

      const searchInput = screen.getByPlaceholderText('Search documents...')
      fireEvent.change(searchInput, { target: { value: 'alpha' } })

      expect(mockSetSearchQuery).toHaveBeenCalledWith('alpha')
    })

    it('calls setSearchQuery with empty string when clear button clicked', () => {
      searchQuery = 'test'
      vi.mocked(useCanvasStore).mockImplementation((selector: any) => {
        const state = {
          documents: mockDocuments,
          documentSearchQuery: 'test',
          documentSortField: sortField,
          documentSortDirection: sortDirection,
          removeDocument: mockRemoveDocument,
          renameDocument: mockRenameDocument,
          setDocumentSearchQuery: mockSetSearchQuery,
          setDocumentSort: mockSetSort,
        }
        return selector(state)
      })

      render(<DocumentsManager onUpload={vi.fn()} />)

      const clearButton = screen.getByLabelText('Clear search')
      fireEvent.click(clearButton)

      expect(mockSetSearchQuery).toHaveBeenCalledWith('')
    })

    it('shows filtered result count when search active', () => {
      searchQuery = 'alpha'
      vi.mocked(useCanvasStore).mockImplementation((selector: any) => {
        const state = {
          documents: mockDocuments,
          documentSearchQuery: 'alpha',
          documentSortField: sortField,
          documentSortDirection: sortDirection,
          removeDocument: mockRemoveDocument,
          renameDocument: mockRenameDocument,
          setDocumentSearchQuery: mockSetSearchQuery,
          setDocumentSort: mockSetSort,
        }
        return selector(state)
      })

      render(<DocumentsManager onUpload={vi.fn()} />)

      // Should show filtered count (1 out of 4)
      expect(screen.getByText(/4 documents/i)).toBeInTheDocument()
      expect(screen.getByText(/\(1 filtered\)/i)).toBeInTheDocument()
    })

    it('shows "no documents match" message when search returns no results', () => {
      searchQuery = 'xyz'
      vi.mocked(useCanvasStore).mockImplementation((selector: any) => {
        const state = {
          documents: mockDocuments,
          documentSearchQuery: 'xyz',
          documentSortField: sortField,
          documentSortDirection: sortDirection,
          removeDocument: mockRemoveDocument,
          renameDocument: mockRenameDocument,
          setDocumentSearchQuery: mockSetSearchQuery,
          setDocumentSort: mockSetSort,
        }
        return selector(state)
      })

      render(<DocumentsManager onUpload={vi.fn()} />)

      expect(screen.getByText("No documents match 'xyz'")).toBeInTheDocument()
      expect(screen.getByText('Try a different search term')).toBeInTheDocument()
    })

    it('displays only matching documents', () => {
      searchQuery = 'notes'
      vi.mocked(useCanvasStore).mockImplementation((selector: any) => {
        const state = {
          documents: mockDocuments,
          documentSearchQuery: 'notes',
          documentSortField: sortField,
          documentSortDirection: sortDirection,
          removeDocument: mockRemoveDocument,
          renameDocument: mockRenameDocument,
          setDocumentSearchQuery: mockSetSearchQuery,
          setDocumentSort: mockSetSort,
        }
        return selector(state)
      })

      render(<DocumentsManager onUpload={vi.fn()} />)

      // Should show beta-notes.txt
      expect(screen.getByText('beta-notes.txt')).toBeInTheDocument()

      // Should not show other documents
      expect(screen.queryByText('alpha-requirements.pdf')).not.toBeInTheDocument()
      expect(screen.queryByText('gamma-data.csv')).not.toBeInTheDocument()
      expect(screen.queryByText('delta-readme.md')).not.toBeInTheDocument()
    })
  })

  describe('Sort UI', () => {
    it('shows sort buttons for all fields', () => {
      render(<DocumentsManager onUpload={vi.fn()} />)

      expect(screen.getByRole('button', { name: /sort by name/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /sort by date/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /sort by size/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /sort by type/i })).toBeInTheDocument()
    })

    it('highlights active sort field', () => {
      render(<DocumentsManager onUpload={vi.fn()} />)

      const dateButton = screen.getByRole('button', { name: /sort by date.*descending/i })
      expect(dateButton).toHaveClass('bg-blue-100', 'text-blue-700')
    })

    it('shows sort direction indicator on active field', () => {
      render(<DocumentsManager onUpload={vi.fn()} />)

      const dateButton = screen.getByRole('button', { name: /sort by date.*descending/i })
      expect(dateButton.textContent).toContain('↓')
    })

    it('hides sort controls when no documents', () => {
      vi.mocked(useCanvasStore).mockImplementation((selector: any) => {
        const state = {
          documents: [],
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

      render(<DocumentsManager onUpload={vi.fn()} />)

      expect(screen.queryByText(/sort by:/i)).not.toBeInTheDocument()
    })
  })

  describe('Sort Behavior', () => {
    it('calls setSort with asc when clicking inactive field', () => {
      render(<DocumentsManager onUpload={vi.fn()} />)

      const nameButton = screen.getByRole('button', { name: /sort by name$/i })
      fireEvent.click(nameButton)

      expect(mockSetSort).toHaveBeenCalledWith('name', 'asc')
    })

    it('toggles direction when clicking active field', () => {
      render(<DocumentsManager onUpload={vi.fn()} />)

      // Date is already active with desc, should toggle to asc
      const dateButton = screen.getByRole('button', { name: /sort by date/i })
      fireEvent.click(dateButton)

      expect(mockSetSort).toHaveBeenCalledWith('date', 'asc')
    })

    it('shows ascending indicator after toggle', () => {
      sortDirection = 'asc'
      vi.mocked(useCanvasStore).mockImplementation((selector: any) => {
        const state = {
          documents: mockDocuments,
          documentSearchQuery: '',
          documentSortField: 'date' as const,
          documentSortDirection: 'asc' as const,
          removeDocument: mockRemoveDocument,
          renameDocument: mockRenameDocument,
          setDocumentSearchQuery: mockSetSearchQuery,
          setDocumentSort: mockSetSort,
        }
        return selector(state)
      })

      render(<DocumentsManager onUpload={vi.fn()} />)

      const dateButton = screen.getByRole('button', { name: /sort by date.*ascending/i })
      expect(dateButton.textContent).toContain('↑')
    })

    it('applies correct ARIA label with current direction', () => {
      render(<DocumentsManager onUpload={vi.fn()} />)

      const dateButton = screen.getByRole('button', { name: /sort by date, currently descending/i })
      expect(dateButton).toBeInTheDocument()
    })

    it('changes sort field when clicking different field', () => {
      render(<DocumentsManager onUpload={vi.fn()} />)

      const sizeButton = screen.getByRole('button', { name: /sort by size$/i })
      fireEvent.click(sizeButton)

      expect(mockSetSort).toHaveBeenCalledWith('size', 'asc')
    })

    it('can cycle through all sort fields', () => {
      render(<DocumentsManager onUpload={vi.fn()} />)

      const fields = ['name', 'size', 'type'] as const

      fields.forEach(field => {
        const button = screen.getByRole('button', { name: new RegExp(`sort by ${field}$`, 'i') })
        fireEvent.click(button)
        expect(mockSetSort).toHaveBeenCalledWith(field, 'asc')
      })
    })
  })

  describe('Sort + Search Integration', () => {
    it('sorts filtered results', () => {
      searchQuery = 'a'
      sortField = 'name'
      sortDirection = 'asc'

      vi.mocked(useCanvasStore).mockImplementation((selector: any) => {
        const state = {
          documents: mockDocuments,
          documentSearchQuery: 'a',
          documentSortField: 'name' as const,
          documentSortDirection: 'asc' as const,
          removeDocument: mockRemoveDocument,
          renameDocument: mockRenameDocument,
          setDocumentSearchQuery: mockSetSearchQuery,
          setDocumentSort: mockSetSort,
        }
        return selector(state)
      })

      render(<DocumentsManager onUpload={vi.fn()} />)

      // Should show 3 docs with 'a': alpha, gamma, delta
      // Sorted by name asc: alpha, delta, gamma
      const names = screen.getAllByText(/alpha|delta|gamma/)
      expect(names[0].textContent).toContain('alpha')
      expect(names[1].textContent).toContain('delta')
      expect(names[2].textContent).toContain('gamma')
    })

    it('shows active sort indicator when sorting by size', () => {
      vi.mocked(useCanvasStore).mockImplementation((selector: any) => {
        const state = {
          documents: mockDocuments,
          documentSearchQuery: '',
          documentSortField: 'size' as const,
          documentSortDirection: 'desc' as const,
          removeDocument: mockRemoveDocument,
          renameDocument: mockRenameDocument,
          setDocumentSearchQuery: mockSetSearchQuery,
          setDocumentSort: mockSetSort,
        }
        return selector(state)
      })

      render(<DocumentsManager onUpload={vi.fn()} />)

      // Verify size button is highlighted
      const sizeButton = screen.getByRole('button', { name: /sort by size.*descending/i })
      expect(sizeButton).toHaveClass('bg-blue-100', 'text-blue-700')
      expect(sizeButton.textContent).toContain('↓')

      // All documents should be displayed
      expect(screen.getByText('alpha-requirements.pdf')).toBeInTheDocument()
      expect(screen.getByText('gamma-data.csv')).toBeInTheDocument()
      expect(screen.getByText('delta-readme.md')).toBeInTheDocument()
      expect(screen.getByText('beta-notes.txt')).toBeInTheDocument()
    })

    it('shows correct filtered count when both active', () => {
      searchQuery = 'data'
      vi.mocked(useCanvasStore).mockImplementation((selector: any) => {
        const state = {
          documents: mockDocuments,
          documentSearchQuery: 'data',
          documentSortField: 'name' as const,
          documentSortDirection: 'asc' as const,
          removeDocument: mockRemoveDocument,
          renameDocument: mockRenameDocument,
          setDocumentSearchQuery: mockSetSearchQuery,
          setDocumentSort: mockSetSort,
        }
        return selector(state)
      })

      render(<DocumentsManager onUpload={vi.fn()} />)

      expect(screen.getByText(/4 documents/i)).toBeInTheDocument()
      expect(screen.getByText(/\(1 filtered\)/i)).toBeInTheDocument()
    })
  })

  describe('Performance & Edge Cases', () => {
    it('handles empty search query gracefully', () => {
      render(<DocumentsManager onUpload={vi.fn()} />)

      const searchInput = screen.getByPlaceholderText('Search documents...')
      fireEvent.change(searchInput, { target: { value: '' } })

      // Should show all documents
      expect(screen.getByText('alpha-requirements.pdf')).toBeInTheDocument()
      expect(screen.getByText('beta-notes.txt')).toBeInTheDocument()
      expect(screen.getByText('gamma-data.csv')).toBeInTheDocument()
      expect(screen.getByText('delta-readme.md')).toBeInTheDocument()
    })

    it('handles case-insensitive search', () => {
      searchQuery = 'ALPHA'
      vi.mocked(useCanvasStore).mockImplementation((selector: any) => {
        const state = {
          documents: mockDocuments,
          documentSearchQuery: 'ALPHA',
          documentSortField: sortField,
          documentSortDirection: sortDirection,
          removeDocument: mockRemoveDocument,
          renameDocument: mockRenameDocument,
          setDocumentSearchQuery: mockSetSearchQuery,
          setDocumentSort: mockSetSort,
        }
        return selector(state)
      })

      render(<DocumentsManager onUpload={vi.fn()} />)

      expect(screen.getByText('alpha-requirements.pdf')).toBeInTheDocument()
    })

    it('displays all documents when sorting by type', () => {
      // Documents with same type should be sorted by addedAt as tie-breaker (tested in unit tests)
      const docsWithSameType: Document[] = [
        {
          id: 'pdf1',
          name: 'z.pdf',
          type: 'pdf',
          uploadedAt: new Date('2025-01-03'),
          size: 1000,
          text: '',
        },
        {
          id: 'pdf2',
          name: 'a.pdf',
          type: 'pdf',
          uploadedAt: new Date('2025-01-01'),
          size: 1000,
          text: '',
        },
        {
          id: 'pdf3',
          name: 'm.pdf',
          type: 'pdf',
          uploadedAt: new Date('2025-01-02'),
          size: 1000,
          text: '',
        },
      ]

      vi.mocked(useCanvasStore).mockImplementation((selector: any) => {
        const state = {
          documents: docsWithSameType,
          documentSearchQuery: '',
          documentSortField: 'type' as const,
          documentSortDirection: 'asc' as const,
          removeDocument: mockRemoveDocument,
          renameDocument: mockRenameDocument,
          setDocumentSearchQuery: mockSetSearchQuery,
          setDocumentSort: mockSetSort,
        }
        return selector(state)
      })

      render(<DocumentsManager onUpload={vi.fn()} />)

      // Verify type button is highlighted
      const typeButton = screen.getByRole('button', { name: /sort by type.*ascending/i })
      expect(typeButton).toHaveClass('bg-blue-100', 'text-blue-700')

      // All documents should be displayed
      expect(screen.getByText('a.pdf')).toBeInTheDocument()
      expect(screen.getByText('m.pdf')).toBeInTheDocument()
      expect(screen.getByText('z.pdf')).toBeInTheDocument()
    })
  })
})
