/**
 * S7-FILEOPS: DocumentsManager Rename Tests (RTL DOM)
 * Tests inline rename with validation, keyboard shortcuts, and undo/redo
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { DocumentsManager } from '../DocumentsManager'
import { useCanvasStore } from '../../store'
import type { Document } from '../../share/types'

// Mock Zustand store
vi.mock('../../store', () => ({
  useCanvasStore: vi.fn(),
}))

// Helper to type into an input
const typeInto = (element: HTMLElement, value: string) => {
  fireEvent.change(element, { target: { value } })
}

// Helper to clear an input
const clearInput = (element: HTMLElement) => {
  fireEvent.change(element, { target: { value: '' } })
}

describe('DocumentsManager - Rename (S7-FILEOPS)', () => {
  const mockDocuments: Document[] = [
    {
      id: 'doc1',
      name: 'requirements.pdf',
      type: 'pdf',
      uploadedAt: new Date('2025-01-01'),
      size: 1024 * 100,
      text: 'content',
    },
    {
      id: 'doc2',
      name: 'notes.txt',
      type: 'txt',
      uploadedAt: new Date('2025-01-02'),
      size: 1024 * 50,
      text: 'content',
    },
  ]

  let mockRenameDocument: ReturnType<typeof vi.fn>
  let mockRemoveDocument: ReturnType<typeof vi.fn>
  let mockSetSearchQuery: ReturnType<typeof vi.fn>
  let mockSetSort: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockRenameDocument = vi.fn()
    mockRemoveDocument = vi.fn()
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

  describe('Rename Button', () => {
    it('shows rename button for each document', () => {
      render(<DocumentsManager onUpload={vi.fn()} />)

      const renameButtons = screen.getAllByLabelText('Rename document')
      expect(renameButtons).toHaveLength(2)
    })

    it('enters rename mode when rename button clicked', () => {
      render(<DocumentsManager onUpload={vi.fn()} />)

      const renameButtons = screen.getAllByLabelText('Rename document')
      fireEvent.click(renameButtons[0])

      // Should show input with current name
      const input = screen.getByDisplayValue('requirements.pdf')
      expect(input).toBeInTheDocument()
      expect(input).toHaveFocus()
    })

    it('shows save and cancel buttons in rename mode', () => {
      render(<DocumentsManager onUpload={vi.fn()} />)

      const renameButtons = screen.getAllByLabelText('Rename document')
      fireEvent.click(renameButtons[0])

      expect(screen.getByLabelText('Save rename')).toBeInTheDocument()
      expect(screen.getByLabelText('Cancel rename')).toBeInTheDocument()
    })
  })

  describe('F2 Keyboard Shortcut', () => {
    it('enters rename mode when F2 pressed on document card', async () => {
      const { container } = render(<DocumentsManager onUpload={vi.fn()} />)

      // Find focusable card containers (divs with tabIndex)
      const focusableCards = container.querySelectorAll('[tabindex="0"]')
      const firstCard = focusableCards[0] as HTMLElement

      // Focus the card
      firstCard.focus()

      // Press F2
      fireEvent.keyDown(firstCard, { key: 'F2' })

      // Should show input
      await waitFor(() => {
        expect(screen.getByDisplayValue('requirements.pdf')).toBeInTheDocument()
      })
    })

    it('does not trigger rename when F2 pressed while already renaming', () => {
      render(<DocumentsManager onUpload={vi.fn()} />)

      const renameButtons = screen.getAllByLabelText('Rename document')
      fireEvent.click(renameButtons[0])

      const input = screen.getByDisplayValue('requirements.pdf')

      // Press F2 again
      fireEvent.keyDown(input, { key: 'F2' })

      // Should still be in rename mode with same input
      expect(input).toBeInTheDocument()
      expect(input).toHaveFocus()
    })
  })

  describe('Rename Validation', () => {
    it('shows error for empty name', () => {
      render(<DocumentsManager onUpload={vi.fn()} />)

      const renameButtons = screen.getAllByLabelText('Rename document')
      fireEvent.click(renameButtons[0])

      const input = screen.getByDisplayValue('requirements.pdf')
      clearInput(input)
      fireEvent.click(screen.getByLabelText('Save rename'))

      // Should show validation error
      expect(screen.getByRole('alert')).toHaveTextContent('Document name cannot be empty')
      expect(mockRenameDocument).not.toHaveBeenCalled()
    })

    it('shows error for whitespace-only name', () => {
      render(<DocumentsManager onUpload={vi.fn()} />)

      const renameButtons = screen.getAllByLabelText('Rename document')
      fireEvent.click(renameButtons[0])

      const input = screen.getByDisplayValue('requirements.pdf')
      typeInto(input, '   ')
      fireEvent.click(screen.getByLabelText('Save rename'))

      expect(screen.getByRole('alert')).toHaveTextContent('Document name cannot be empty')
      expect(mockRenameDocument).not.toHaveBeenCalled()
    })

    it('shows error for duplicate name (case-insensitive)', () => {
      render(<DocumentsManager onUpload={vi.fn()} />)

      const renameButtons = screen.getAllByLabelText('Rename document')
      fireEvent.click(renameButtons[0])

      const input = screen.getByDisplayValue('requirements.pdf')
      typeInto(input, 'NOTES.TXT') // Duplicate of second document
      fireEvent.click(screen.getByLabelText('Save rename'))

      expect(screen.getByRole('alert')).toHaveTextContent('A document with this name already exists')
      expect(mockRenameDocument).not.toHaveBeenCalled()
    })

    it('shows error for name exceeding 120 characters', () => {
      render(<DocumentsManager onUpload={vi.fn()} />)

      const renameButtons = screen.getAllByLabelText('Rename document')
      fireEvent.click(renameButtons[0])

      const input = screen.getByDisplayValue('requirements.pdf')
      typeInto(input, 'a'.repeat(121))
      fireEvent.click(screen.getByLabelText('Save rename'))

      expect(screen.getByRole('alert')).toHaveTextContent('Name must be 120 characters or less')
      expect(mockRenameDocument).not.toHaveBeenCalled()
    })

    it('clears validation error when user types', () => {
      render(<DocumentsManager onUpload={vi.fn()} />)

      const renameButtons = screen.getAllByLabelText('Rename document')
      fireEvent.click(renameButtons[0])

      const input = screen.getByDisplayValue('requirements.pdf')
      clearInput(input)
      fireEvent.click(screen.getByLabelText('Save rename'))

      // Error should appear
      expect(screen.getByRole('alert')).toBeInTheDocument()

      // Type something
      typeInto(input, 'new')

      // Error should disappear
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('enforces maxLength of 120 characters on input', () => {
      render(<DocumentsManager onUpload={vi.fn()} />)

      const renameButtons = screen.getAllByLabelText('Rename document')
      fireEvent.click(renameButtons[0])

      const input = screen.getByDisplayValue('requirements.pdf') as HTMLInputElement
      expect(input).toHaveAttribute('maxLength', '120')
    })
  })

  describe('Rename Commit', () => {
    it('calls renameDocument with trimmed name when save button clicked', () => {
      render(<DocumentsManager onUpload={vi.fn()} />)

      const renameButtons = screen.getAllByLabelText('Rename document')
      fireEvent.click(renameButtons[0])

      const input = screen.getByDisplayValue('requirements.pdf')
      typeInto(input, '  new-name.pdf  ')
      fireEvent.click(screen.getByLabelText('Save rename'))

      expect(mockRenameDocument).toHaveBeenCalledWith('doc1', 'new-name.pdf')
    })

    it('calls renameDocument when Enter key pressed', () => {
      render(<DocumentsManager onUpload={vi.fn()} />)

      const renameButtons = screen.getAllByLabelText('Rename document')
      fireEvent.click(renameButtons[0])

      const input = screen.getByDisplayValue('requirements.pdf')
      typeInto(input, 'new-name.pdf')
      fireEvent.keyDown(input, { key: 'Enter' })

      expect(mockRenameDocument).toHaveBeenCalledWith('doc1', 'new-name.pdf')
    })

    it('exits rename mode without calling renameDocument when name unchanged', () => {
      render(<DocumentsManager onUpload={vi.fn()} />)

      const renameButtons = screen.getAllByLabelText('Rename document')
      fireEvent.click(renameButtons[0])

      // Don't change the name
      fireEvent.click(screen.getByLabelText('Save rename'))

      expect(mockRenameDocument).not.toHaveBeenCalled()
      expect(screen.queryByDisplayValue('requirements.pdf')).not.toBeInTheDocument()
    })

    it('exits rename mode after successful rename', () => {
      render(<DocumentsManager onUpload={vi.fn()} />)

      const renameButtons = screen.getAllByLabelText('Rename document')
      fireEvent.click(renameButtons[0])

      const input = screen.getByDisplayValue('requirements.pdf')
      typeInto(input, 'new-name.pdf')
      fireEvent.click(screen.getByLabelText('Save rename'))

      // Input should be gone
      expect(screen.queryByDisplayValue('new-name.pdf')).not.toBeInTheDocument()
    })

    it('commits rename on blur', async () => {
      render(<DocumentsManager onUpload={vi.fn()} />)

      const renameButtons = screen.getAllByLabelText('Rename document')
      fireEvent.click(renameButtons[0])

      const input = screen.getByDisplayValue('requirements.pdf')
      typeInto(input, 'new-name.pdf')

      // Blur the input
      fireEvent.blur(input)

      await waitFor(() => {
        expect(mockRenameDocument).toHaveBeenCalledWith('doc1', 'new-name.pdf')
      })
    })
  })

  describe('Rename Cancel', () => {
    it('cancels rename when cancel button clicked', () => {
      render(<DocumentsManager onUpload={vi.fn()} />)

      const renameButtons = screen.getAllByLabelText('Rename document')
      fireEvent.click(renameButtons[0])

      const input = screen.getByDisplayValue('requirements.pdf')
      typeInto(input, 'new-name.pdf')
      fireEvent.click(screen.getByLabelText('Cancel rename'))

      // Should exit rename mode without saving
      expect(mockRenameDocument).not.toHaveBeenCalled()
      expect(screen.queryByDisplayValue('new-name.pdf')).not.toBeInTheDocument()
    })

    it('cancels rename when Escape key pressed', () => {
      render(<DocumentsManager onUpload={vi.fn()} />)

      const renameButtons = screen.getAllByLabelText('Rename document')
      fireEvent.click(renameButtons[0])

      const input = screen.getByDisplayValue('requirements.pdf')
      typeInto(input, 'new-name.pdf')
      fireEvent.keyDown(input, { key: 'Escape' })

      // Should exit rename mode without saving
      expect(mockRenameDocument).not.toHaveBeenCalled()
      expect(screen.queryByDisplayValue('new-name.pdf')).not.toBeInTheDocument()
    })

    it('restores original name after cancel', () => {
      render(<DocumentsManager onUpload={vi.fn()} />)

      const renameButtons = screen.getAllByLabelText('Rename document')
      fireEvent.click(renameButtons[0])

      const input = screen.getByDisplayValue('requirements.pdf')
      typeInto(input, 'new-name.pdf')
      fireEvent.click(screen.getByLabelText('Cancel rename'))

      // Original name should still be displayed
      expect(screen.getByText('requirements.pdf')).toBeInTheDocument()
    })

    it('clears validation error when cancel clicked', () => {
      render(<DocumentsManager onUpload={vi.fn()} />)

      const renameButtons = screen.getAllByLabelText('Rename document')
      fireEvent.click(renameButtons[0])

      const input = screen.getByDisplayValue('requirements.pdf')
      clearInput(input)
      fireEvent.click(screen.getByLabelText('Save rename'))

      // Error should appear
      expect(screen.getByRole('alert')).toBeInTheDocument()

      // Cancel
      fireEvent.click(screen.getByLabelText('Cancel rename'))

      // Error should be gone
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA label on rename input', () => {
      render(<DocumentsManager onUpload={vi.fn()} />)

      const renameButtons = screen.getAllByLabelText('Rename document')
      fireEvent.click(renameButtons[0])

      const input = screen.getByLabelText('Rename document requirements.pdf')
      expect(input).toBeInTheDocument()
    })

    it('sets aria-invalid when validation error present', () => {
      render(<DocumentsManager onUpload={vi.fn()} />)

      const renameButtons = screen.getAllByLabelText('Rename document')
      fireEvent.click(renameButtons[0])

      const input = screen.getByDisplayValue('requirements.pdf')
      expect(input).toHaveAttribute('aria-invalid', 'false')

      clearInput(input)
      fireEvent.click(screen.getByLabelText('Save rename'))

      expect(input).toHaveAttribute('aria-invalid', 'true')
    })

    it('associates error message with input via aria-describedby', () => {
      render(<DocumentsManager onUpload={vi.fn()} />)

      const renameButtons = screen.getAllByLabelText('Rename document')
      fireEvent.click(renameButtons[0])

      const input = screen.getByDisplayValue('requirements.pdf')
      clearInput(input)
      fireEvent.click(screen.getByLabelText('Save rename'))

      const errorId = input.getAttribute('aria-describedby')
      expect(errorId).toBeTruthy()

      const error = screen.getByRole('alert')
      expect(error).toHaveAttribute('id', errorId)
    })

    it('shows tooltip hints on rename buttons', () => {
      render(<DocumentsManager onUpload={vi.fn()} />)

      const renameButtons = screen.getAllByTitle('Rename (F2)')
      expect(renameButtons).toHaveLength(2)
    })

    it('shows tooltip hints on save/cancel buttons', () => {
      render(<DocumentsManager onUpload={vi.fn()} />)

      const renameButtons = screen.getAllByLabelText('Rename document')
      fireEvent.click(renameButtons[0])

      expect(screen.getByTitle('Save (Enter)')).toBeInTheDocument()
      expect(screen.getByTitle('Cancel (Escape)')).toBeInTheDocument()
    })
  })

  describe('Multiple Documents', () => {
    it('can rename different documents independently', () => {
      render(<DocumentsManager onUpload={vi.fn()} />)

      // Rename first document
      let renameButtons = screen.getAllByLabelText('Rename document')
      fireEvent.click(renameButtons[0])
      const input1 = screen.getByDisplayValue('requirements.pdf')
      typeInto(input1, 'reqs-v2.pdf')
      fireEvent.keyDown(input1, { key: 'Enter' })

      expect(mockRenameDocument).toHaveBeenCalledWith('doc1', 'reqs-v2.pdf')

      // Rename second document
      renameButtons = screen.getAllByLabelText('Rename document')
      fireEvent.click(renameButtons[1])
      const input2 = screen.getByDisplayValue('notes.txt')
      typeInto(input2, 'meeting-notes.txt')
      fireEvent.keyDown(input2, { key: 'Enter' })

      expect(mockRenameDocument).toHaveBeenCalledWith('doc2', 'meeting-notes.txt')
    })

    it('only one document in rename mode at a time', () => {
      render(<DocumentsManager onUpload={vi.fn()} />)

      const renameButtons = screen.getAllByLabelText('Rename document')
      fireEvent.click(renameButtons[0])

      // Should have exactly one input visible
      const inputs = screen.getAllByRole('textbox')
      expect(inputs).toHaveLength(2) // One rename input + one search input
    })
  })
})
