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
      schema: 'templates.v1',
      items: [
        { id: 'template-1', name: 'Test Template', description: 'Test description', version: '1.0' }
      ]
    } as any)

    vi.mocked(plotAdapter.plot.template).mockResolvedValue({
      schema: 'template.v1',
      id: 'template-1',
      name: 'Test Template',
      description: 'Test description',
      version: '1.0',
      default_seed: 1337,
      graph: {
        nodes: [{ id: 'n1', label: 'Node 1', kind: 'goal' }],
        edges: []
      }
    } as any)

    // Mock store getState
    vi.mocked(useCanvasStore.getState).mockReturnValue({
      isDirty: false,
      nodes: [],
      edges: [],
      setShowResultsPanel: mockSetShowResultsPanel
    } as any)
  })


  // The two Run-button tests here are DELETED with the panel's run leg: it
  // no longer computes, so there is no hand-off to Results to assert. The
  // template INSERT / unsaved-changes behaviour below is unchanged.
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
})
