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

    // 14 Aug 2026: rename is now the INLINE editor on the trigger, not a modal.
    await waitFor(() => {
      expect(screen.getByTestId('scenario-name-input')).toBeInTheDocument()
    })

    // Type new name and commit
    const input = screen.getByTestId('scenario-name-input')
    fireEvent.change(input, { target: { value: 'New Name' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    // Should call renameCurrentScenario with new name
    await waitFor(() => {
      expect(mockRenameCurrentScenario).toHaveBeenCalledWith('New Name')
    })
  })

  // ⭐ 14 Aug 2026 — THE AUTHENTICATED-PATH FIX, pinned where it is observable.
  //
  // `loadSupabaseScenario` hydrates `currentScenarioId` with a Supabase UUID and
  // never writes a localStorage row, so `getScenario` returns null (or, worse, a
  // STALE row from an earlier guest session). Reading localStorage first is what
  // made this control display "Untitled decision" for every persisted model.
  //
  // These two cases need a localStorage name that DIFFERS from `displayName`;
  // the TopBar spec cannot see the precedence at all, because no localStorage
  // record exists there and both orderings resolve to the same string.
  it('prefers the displayName prop over a stale localStorage name', () => {
    vi.mocked(scenarios.getScenario).mockReturnValue({
      id: 'scenario-1',
      name: 'Stale local name',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      graph: { nodes: [], edges: [] }
    })

    render(
      <ToastProvider>
        <ScenarioSwitcher displayName="Real model name" onRename={vi.fn()} />
      </ToastProvider>
    )

    expect(screen.getByTestId('scenario-name-button')).toHaveTextContent('Real model name')
    expect(screen.queryByText('Stale local name')).not.toBeInTheDocument()
  })

  it('commits a rename through onRename, NOT through renameCurrentScenario', () => {
    const onRename = vi.fn()
    vi.mocked(scenarios.getScenario).mockReturnValue({
      id: 'scenario-1',
      name: 'Stale local name',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      graph: { nodes: [], edges: [] }
    })

    render(
      <ToastProvider>
        <ScenarioSwitcher displayName="Real model name" onRename={onRename} />
      </ToastProvider>
    )

    fireEvent.click(screen.getByTestId('scenario-name-button'))
    const input = screen.getByTestId('scenario-name-input')
    fireEvent.change(input, { target: { value: 'Renamed model' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    // The authority writer reaches BOTH the framing title (-> Supabase) and the
    // localStorage record. `renameCurrentScenario` reaches only the latter, and
    // is a silent no-op on the authenticated path.
    expect(onRename).toHaveBeenCalledWith('Renamed model')
    expect(mockRenameCurrentScenario).not.toHaveBeenCalled()
  })

  it('displays "Untitled model" when no current scenario', () => {
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

    // Paul, 14 Aug 2026: "decision" -> "model" on the naming surface.
    expect(screen.getByText('Untitled model')).toBeInTheDocument()
    expect(screen.queryByText('Untitled decision')).not.toBeInTheDocument()
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
