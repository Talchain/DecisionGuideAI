/**
 * A3: ScenarioSwitcher Tests
 *
 * Tests for saving/saved states, pill rendering, and dropdown behaviour
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ScenarioSwitcher } from '../ScenarioSwitcher'
import { ToastProvider } from '../../ToastContext'
import { useCanvasStore } from '../../store'
import * as scenarios from '../../store/scenarios'

// Mock store
vi.mock('../../store', () => ({
  useCanvasStore: vi.fn()
}))

// Mock scenarios
vi.mock('../../store/scenarios', () => ({
  loadScenarios: vi.fn(() => []),
  getScenario: vi.fn(),
  createScenario: vi.fn(),
  updateScenario: vi.fn(),
  deleteScenario: vi.fn()
}))

describe('ScenarioSwitcher (A3)', () => {
  const mockSaveCurrentScenario = vi.fn()
  const mockLoadScenario = vi.fn()
  const mockDuplicateCurrentScenario = vi.fn()
  const mockRenameCurrentScenario = vi.fn()
  const mockDeleteScenario = vi.fn()

  const renderWithToast = () => render(
    <ToastProvider>
      <ScenarioSwitcher />
    </ToastProvider>
  )

  beforeEach(() => {
    vi.clearAllMocks()

    // Default store state
    vi.mocked(useCanvasStore).mockImplementation((selector: any) => {
      const state = {
        currentScenarioId: 'scenario-1',
        isDirty: false,
        isSaving: false,
        lastSavedAt: null,
        saveCurrentScenario: mockSaveCurrentScenario,
        loadScenario: mockLoadScenario,
        duplicateCurrentScenario: mockDuplicateCurrentScenario,
        renameCurrentScenario: mockRenameCurrentScenario,
        deleteScenario: mockDeleteScenario
      }
      return selector(state)
    })

    vi.mocked(scenarios.loadScenarios).mockReturnValue([
      {
        id: 'scenario-1',
        name: 'Test Scenario',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        graph: { nodes: [], edges: [] }
      }
    ])
  })

  it('shows "Saving..." pill when isSaving is true', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector: any) => {
      const state = {
        currentScenarioId: 'scenario-1',
        isDirty: true,
        isSaving: true,
        lastSavedAt: null,
        saveCurrentScenario: mockSaveCurrentScenario,
        loadScenario: mockLoadScenario,
        duplicateCurrentScenario: mockDuplicateCurrentScenario,
        renameCurrentScenario: mockRenameCurrentScenario,
        deleteScenario: mockDeleteScenario
      }
      return selector(state)
    })

    renderWithToast()

    expect(screen.getByTestId('save-status-saving')).toBeInTheDocument()
    expect(screen.getByText('Saving…')).toBeInTheDocument()
  })

  it('shows "Saved just now ✓" pill when recently saved', () => {
    const recentTime = Date.now() - 5000 // 5 seconds ago

    vi.mocked(useCanvasStore).mockImplementation((selector: any) => {
      const state = {
        currentScenarioId: 'scenario-1',
        isDirty: false,
        isSaving: false,
        lastSavedAt: recentTime,
        saveCurrentScenario: mockSaveCurrentScenario,
        loadScenario: mockLoadScenario,
        duplicateCurrentScenario: mockDuplicateCurrentScenario,
        renameCurrentScenario: mockRenameCurrentScenario,
        deleteScenario: mockDeleteScenario
      }
      return selector(state)
    })

    renderWithToast()

    expect(screen.getByTestId('save-status-saved')).toBeInTheDocument()
    expect(screen.getByText(/Saved just now/)).toBeInTheDocument()
  })

  it('shows "Saved Xs ago" pill for older saves', () => {
    const thirtySecondsAgo = Date.now() - 30000

    vi.mocked(useCanvasStore).mockImplementation((selector: any) => {
      const state = {
        currentScenarioId: 'scenario-1',
        isDirty: false,
        isSaving: false,
        lastSavedAt: thirtySecondsAgo,
        saveCurrentScenario: mockSaveCurrentScenario,
        loadScenario: mockLoadScenario,
        duplicateCurrentScenario: mockDuplicateCurrentScenario,
        renameCurrentScenario: mockRenameCurrentScenario,
        deleteScenario: mockDeleteScenario
      }
      return selector(state)
    })

    renderWithToast()

    expect(screen.getByText(/Saved 30s ago/)).toBeInTheDocument()
  })

  it('dropdown opens while saving (pill visible)', async () => {
    vi.mocked(useCanvasStore).mockImplementation((selector: any) => {
      const state = {
        currentScenarioId: 'scenario-1',
        isDirty: true,
        isSaving: true,
        lastSavedAt: null,
        saveCurrentScenario: mockSaveCurrentScenario,
        loadScenario: mockLoadScenario,
        duplicateCurrentScenario: mockDuplicateCurrentScenario,
        renameCurrentScenario: mockRenameCurrentScenario,
        deleteScenario: mockDeleteScenario
      }
      return selector(state)
    })

    renderWithToast()

    // Saving pill should be visible
    expect(screen.getByTestId('save-status-saving')).toBeInTheDocument()

    // Click to open dropdown (button contains scenario name + pill text)
    const button = screen.getByRole('button', { expanded: false })
    fireEvent.click(button)

    // Dropdown should be open (aria-expanded="true")
    await waitFor(() => {
      expect(button).toHaveAttribute('aria-expanded', 'true')
    })

    // Saving pill should still be visible
    expect(screen.getByTestId('save-status-saving')).toBeInTheDocument()
  })

  it('rename flow remains intact', async () => {
    vi.mocked(useCanvasStore).mockImplementation((selector: any) => {
      const state = {
        currentScenarioId: 'scenario-1',
        isDirty: false,
        isSaving: false,
        lastSavedAt: null,
        saveCurrentScenario: mockSaveCurrentScenario,
        loadScenario: mockLoadScenario,
        duplicateCurrentScenario: mockDuplicateCurrentScenario,
        renameCurrentScenario: mockRenameCurrentScenario,
        deleteScenario: mockDeleteScenario
      }
      return selector(state)
    })

    // Mock getScenario to return current scenario
    vi.mocked(scenarios.getScenario).mockReturnValue({
      id: 'scenario-1',
      name: 'Test Scenario',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      graph: { nodes: [], edges: [] }
    })

    renderWithToast()

    // Open dropdown
    const button = screen.getByRole('button', { expanded: false })
    fireEvent.click(button)

    // Wait for dropdown to be open
    await waitFor(() => {
      expect(button).toHaveAttribute('aria-expanded', 'true')
    })

    // Click rename button
    const renameButton = screen.getByRole('menuitem', { name: /rename/i })
    fireEvent.click(renameButton)

    // Wait for rename dialog to appear
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Scenario name')).toBeInTheDocument()
    })

    // Type new name
    const input = screen.getByPlaceholderText('Scenario name')
    fireEvent.change(input, { target: { value: 'New Name' } })

    // Click "Rename" button in dialog
    const submitButton = screen.getByRole('button', { name: 'Rename' })
    fireEvent.click(submitButton)

    // Should call renameCurrentScenario with new name
    await waitFor(() => {
      expect(mockRenameCurrentScenario).toHaveBeenCalledWith('New Name')
    })
  })

  it('displays "Untitled scenario" when no current scenario', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector: any) => {
      const state = {
        currentScenarioId: null,
        isDirty: false,
        isSaving: false,
        lastSavedAt: null,
        saveCurrentScenario: mockSaveCurrentScenario,
        loadScenario: mockLoadScenario,
        duplicateCurrentScenario: mockDuplicateCurrentScenario,
        renameCurrentScenario: mockRenameCurrentScenario,
        deleteScenario: mockDeleteScenario
      }
      return selector(state)
    })

    vi.mocked(scenarios.loadScenarios).mockReturnValue([])

    renderWithToast()

    expect(screen.getByText('Untitled scenario')).toBeInTheDocument()
  })

  it('pill does not show when not saving and no lastSavedAt', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector: any) => {
      const state = {
        currentScenarioId: 'scenario-1',
        isDirty: false,
        isSaving: false,
        lastSavedAt: null,
        saveCurrentScenario: mockSaveCurrentScenario,
        loadScenario: mockLoadScenario,
        duplicateCurrentScenario: mockDuplicateCurrentScenario,
        renameCurrentScenario: mockRenameCurrentScenario,
        deleteScenario: mockDeleteScenario
      }
      return selector(state)
    })

    renderWithToast()

    expect(screen.queryByTestId('save-status-saving')).not.toBeInTheDocument()
    expect(screen.queryByTestId('save-status-saved')).not.toBeInTheDocument()
  })

  it('save button triggers saveCurrentScenario', async () => {
    renderWithToast()

    // Open dropdown
    const button = screen.getByRole('button', { expanded: false })
    fireEvent.click(button)

    // Wait for dropdown
    await waitFor(() => {
      expect(button).toHaveAttribute('aria-expanded', 'true')
    })

    // Click save button
    const saveButton = screen.getByRole('menuitem', { name: /save/i })
    fireEvent.click(saveButton)

    expect(mockSaveCurrentScenario).toHaveBeenCalled()
  })
})
