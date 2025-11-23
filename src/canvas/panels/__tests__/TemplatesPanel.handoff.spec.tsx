/**
 * P0-3: Template Action Semantics + Hand-off Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { TemplatesPanel } from '../TemplatesPanel'
import { useCanvasStore } from '../../store'
import * as plotAdapter from '../../../adapters/plot'

// Mock dependencies
vi.mock('../../../adapters/plot', () => ({
  plot: {
    templates: vi.fn(),
    template: vi.fn()
  },
  adapterName: 'httpv1'
}))

vi.mock('../../hooks/useTemplatesRun', () => ({
  useTemplatesRun: () => ({
    loading: false,
    progress: 0,
    canCancel: false,
    result: null,
    error: null,
    run: vi.fn().mockResolvedValue(undefined),
    cancel: vi.fn(),
    clearError: vi.fn()
  })
}))

vi.mock('../../store', () => {
  const actualStore = vi.importActual('../../store')
  return {
    ...actualStore,
    useCanvasStore: {
      getState: vi.fn(() => ({
        isDirty: false,
        nodes: [],
        edges: [],
        setShowResultsPanel: vi.fn()
      })),
      setState: vi.fn()
    }
  }
})

describe('TemplatesPanel - P0-3: Hand-off and semantics', () => {
  const mockOnClose = vi.fn()
  const mockOnInsertBlueprint = vi.fn()
  const mockSetShowResultsPanel = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()

    // Setup default mocks
    vi.mocked(plotAdapter.plot.templates).mockResolvedValue({
      items: [
        { id: 'template-1', name: 'Test Template', description: 'Test description' }
      ]
    })

    vi.mocked(plotAdapter.plot.template).mockResolvedValue({
      id: 'template-1',
      name: 'Test Template',
      description: 'Test description',
      default_seed: 1337,
      graph: {
        nodes: [{ id: 'n1', label: 'Node 1', kind: 'goal' }],
        edges: []
      }
    })

    // Mock store getState
    vi.mocked(useCanvasStore.getState).mockReturnValue({
      isDirty: false,
      nodes: [],
      edges: [],
      setShowResultsPanel: mockSetShowResultsPanel
    } as any)
  })

  it('closes Templates panel and opens Results panel when Run is clicked', async () => {
    const mockRun = vi.fn().mockResolvedValue(undefined)

    vi.mock('../../hooks/useTemplatesRun', () => ({
      useTemplatesRun: () => ({
        loading: false,
        progress: 0,
        canCancel: false,
        result: null,
        error: null,
        run: mockRun,
        cancel: vi.fn(),
        clearError: vi.fn()
      })
    }))

    render(
      <TemplatesPanel
        isOpen={true}
        onClose={mockOnClose}
        onInsertBlueprint={mockOnInsertBlueprint}
      />
    )

    // Wait for templates to load
    await waitFor(() => {
      expect(screen.getByText('Test Template')).toBeInTheDocument()
    })

    // Click primary "Start from Template" button to select template
    const insertButton = screen.getByRole('button', { name: /start from .*template/i })
    fireEvent.click(insertButton)

    // Wait for template details to load
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /run analysis/i })).toBeInTheDocument()
    })

    const runButton = screen.getByRole('button', { name: /run analysis/i })
    fireEvent.click(runButton)

    // Should close Templates panel
    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalled()
    })

    // Should open Results panel
    await waitFor(() => {
      expect(mockSetShowResultsPanel).toHaveBeenCalledWith(true)
    })
  })

  it('confirms before inserting template when there are unsaved changes', async () => {
    // Mock store with unsaved changes
    vi.mocked(useCanvasStore.getState).mockReturnValue({
      isDirty: true,
      nodes: [{ id: 'n1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Existing' } }],
      edges: [],
      setShowResultsPanel: mockSetShowResultsPanel
    } as any)

    // Mock window.confirm to return false (cancel)
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)

    render(
      <TemplatesPanel
        isOpen={true}
        onClose={mockOnClose}
        onInsertBlueprint={mockOnInsertBlueprint}
      />
    )

    // Wait for templates to load
    await waitFor(() => {
      expect(screen.getByText('Test Template')).toBeInTheDocument()
    })

    // Click Insert
    const insertButton = screen.getByRole('button', { name: /insert/i })
    fireEvent.click(insertButton)

    // Should show confirmation dialog
    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalledWith(
        expect.stringContaining('unsaved changes')
      )
    })

    // Should not insert template
    expect(mockOnInsertBlueprint).not.toHaveBeenCalled()

    confirmSpy.mockRestore()
  })

  it('proceeds with template insertion when user confirms unsaved changes', async () => {
    // Mock store with unsaved changes
    vi.mocked(useCanvasStore.getState).mockReturnValue({
      isDirty: true,
      nodes: [{ id: 'n1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Existing' } }],
      edges: [],
      setShowResultsPanel: mockSetShowResultsPanel
    } as any)

    // Mock window.confirm to return true (confirm)
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(
      <TemplatesPanel
        isOpen={true}
        onClose={mockOnClose}
        onInsertBlueprint={mockOnInsertBlueprint}
      />
    )

    // Wait for templates to load
    await waitFor(() => {
      expect(screen.getByText('Test Template')).toBeInTheDocument()
    })

    // Click Insert
    const insertButton = screen.getByRole('button', { name: /insert/i })
    fireEvent.click(insertButton)

    // Should show confirmation dialog
    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalled()
    })

    // Should insert template
    await waitFor(() => {
      expect(mockOnInsertBlueprint).toHaveBeenCalled()
    })

    confirmSpy.mockRestore()
  })

  it('does not confirm when inserting template with no unsaved changes', async () => {
    // Mock store with no changes
    vi.mocked(useCanvasStore.getState).mockReturnValue({
      isDirty: false,
      nodes: [],
      edges: [],
      setShowResultsPanel: mockSetShowResultsPanel
    } as any)

    const confirmSpy = vi.spyOn(window, 'confirm')

    render(
      <TemplatesPanel
        isOpen={true}
        onClose={mockOnClose}
        onInsertBlueprint={mockOnInsertBlueprint}
      />
    )

    // Wait for templates to load
    await waitFor(() => {
      expect(screen.getByText('Test Template')).toBeInTheDocument()
    })

    // Click Insert
    const insertButton = screen.getByRole('button', { name: /insert/i })
    fireEvent.click(insertButton)

    // Should NOT show confirmation dialog
    await waitFor(() => {
      expect(mockOnInsertBlueprint).toHaveBeenCalled()
    })

    expect(confirmSpy).not.toHaveBeenCalled()

    confirmSpy.mockRestore()
  })

  it('has clear Run button semantics', async () => {
    render(
      <TemplatesPanel
        isOpen={true}
        onClose={mockOnClose}
        onInsertBlueprint={mockOnInsertBlueprint}
      />
    )

    // Wait for templates to load
    await waitFor(() => {
      expect(screen.getByText('Test Template')).toBeInTheDocument()
    })

    // Click primary "Start from Template" button to select template
    const insertButton = screen.getByRole('button', { name: /start from .*template/i })
    fireEvent.click(insertButton)

    // Wait for Run button to appear
    await waitFor(() => {
      const runButton = screen.getByRole('button', { name: /▶ run analysis/i })
      expect(runButton).toBeInTheDocument()
      expect(runButton).not.toBeDisabled()
    })
  })
})
