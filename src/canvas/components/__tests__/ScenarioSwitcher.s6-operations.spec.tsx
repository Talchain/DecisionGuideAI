/**
 * S6-SCENARIO: Rename/Duplicate/Save As Tests
 *
 * Comprehensive tests for scenario management operations:
 * - Rename scenario (with keyboard shortcuts)
 * - Duplicate scenario
 * - Save As functionality
 * - Dialog keyboard handling (Enter/Escape)
 * - Edge cases
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ScenarioSwitcher } from '../ScenarioSwitcher'
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
  deleteScenario: vi.fn(),
  importScenarioFromFile: vi.fn(),
  exportScenario: vi.fn()
}))

// Mock ToastContext
vi.mock('../../ToastContext', () => ({
  useToast: () => ({
    showToast: vi.fn()
  })
}))

describe('S6-SCENARIO: Rename/Duplicate/Save As Operations', () => {
  const mockSaveCurrentScenario = vi.fn()
  const mockLoadScenario = vi.fn()
  const mockDuplicateCurrentScenario = vi.fn()
  const mockRenameCurrentScenario = vi.fn()
  const mockDeleteScenario = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()

    // Default store state
    vi.mocked(useCanvasStore).mockImplementation((selector: any) => {
      const state = {
        currentScenarioId: 'scenario-1',
        isDirty: false,
        isSaving: false,
        lastSavedAt: null,
        nodes: [],
        edges: [],
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

    vi.mocked(scenarios.getScenario).mockReturnValue({
      id: 'scenario-1',
      name: 'Test Scenario',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      graph: { nodes: [], edges: [] }
    })
  })

  describe('Rename Scenario', () => {
    // ⭐ 14 Aug 2026 (Paul's ruling): rename moved from a buried MODAL DIALOG to
    // an INLINE editor on the trigger. These seven tests keep their original
    // intent — open, pre-populate, commit, commit-on-Enter, cancel-on-Escape,
    // dropdown behaviour, refuse-empty — retargeted at the interaction that
    // now ships. Coverage is preserved, not dropped; only the affordance moved.
    it('should open the inline editor when the rename button is clicked', async () => {
      render(<ScenarioSwitcher />)

      // Open dropdown
      const button = screen.getByRole('button', { expanded: false })
      fireEvent.click(button)

      await waitFor(() => {
        expect(button).toHaveAttribute('aria-expanded', 'true')
      })

      // Click rename button
      fireEvent.click(screen.getByRole('menuitem', { name: /rename/i }))

      // Inline editor should appear
      await waitFor(() => {
        expect(screen.getByTestId('scenario-name-input')).toBeInTheDocument()
      })
    })

    it('should pre-populate the inline editor with the current scenario name', async () => {
      render(<ScenarioSwitcher />)

      fireEvent.click(screen.getByRole('button', { expanded: false }))
      await waitFor(() => {
        fireEvent.click(screen.getByRole('menuitem', { name: /rename/i }))
      })

      await waitFor(() => {
        const input = screen.getByTestId('scenario-name-input') as HTMLInputElement
        expect(input.value).toBe('Test Scenario')
      })
    })

    it('should call renameCurrentScenario when the edit is committed by blur', async () => {
      render(<ScenarioSwitcher />)

      fireEvent.click(screen.getByRole('button', { expanded: false }))
      await waitFor(() => {
        fireEvent.click(screen.getByRole('menuitem', { name: /rename/i }))
      })

      const input = await screen.findByTestId('scenario-name-input')
      fireEvent.change(input, { target: { value: 'New Scenario Name' } })
      fireEvent.blur(input)

      expect(mockRenameCurrentScenario).toHaveBeenCalledWith('New Scenario Name')
    })

    it('should submit rename on Enter key', async () => {
      render(<ScenarioSwitcher />)

      fireEvent.click(screen.getByRole('button', { expanded: false }))
      await waitFor(() => {
        fireEvent.click(screen.getByRole('menuitem', { name: /rename/i }))
      })

      const input = await screen.findByTestId('scenario-name-input')
      fireEvent.change(input, { target: { value: 'Renamed via Enter' } })
      fireEvent.keyDown(input, { key: 'Enter' })

      expect(mockRenameCurrentScenario).toHaveBeenCalledWith('Renamed via Enter')
    })

    it('should close the inline editor on Escape WITHOUT renaming', async () => {
      render(<ScenarioSwitcher />)

      fireEvent.click(screen.getByRole('button', { expanded: false }))
      await waitFor(() => {
        fireEvent.click(screen.getByRole('menuitem', { name: /rename/i }))
      })

      const input = await screen.findByTestId('scenario-name-input')
      fireEvent.change(input, { target: { value: 'Discarded name' } })
      fireEvent.keyDown(input, { key: 'Escape' })

      await waitFor(() => {
        expect(screen.queryByTestId('scenario-name-input')).not.toBeInTheDocument()
      })
      // Escape must survive the blur that follows it — the old dialog had a
      // Cancel button for this; inline editing has only the key.
      expect(mockRenameCurrentScenario).not.toHaveBeenCalled()
    })

    it('should close the dropdown when the inline editor opens', async () => {
      render(<ScenarioSwitcher />)

      fireEvent.click(screen.getByRole('button', { expanded: false }))
      await waitFor(() => {
        fireEvent.click(screen.getByRole('menuitem', { name: /rename/i }))
      })

      await waitFor(() => {
        expect(screen.queryByTestId('scenario-switcher-menu')).not.toBeInTheDocument()
      })
    })

    it('should refuse an empty or whitespace name, keeping the previous one', async () => {
      render(<ScenarioSwitcher />)

      fireEvent.click(screen.getByRole('button', { expanded: false }))
      await waitFor(() => {
        fireEvent.click(screen.getByRole('menuitem', { name: /rename/i }))
      })

      const input = await screen.findByTestId('scenario-name-input')
      fireEvent.change(input, { target: { value: '   ' } })
      fireEvent.keyDown(input, { key: 'Enter' })

      expect(mockRenameCurrentScenario).not.toHaveBeenCalled()
      expect(screen.getByTestId('scenario-name-button')).toHaveTextContent('Test Scenario')
    })

    it('should not show rename button when no current scenario', () => {
      vi.mocked(useCanvasStore).mockImplementation((selector: any) => {
        const state = {
          currentScenarioId: null,
          isDirty: false,
          isSaving: false,
          lastSavedAt: null,
          nodes: [],
          edges: [],
          saveCurrentScenario: mockSaveCurrentScenario,
          loadScenario: mockLoadScenario,
          duplicateCurrentScenario: mockDuplicateCurrentScenario,
          renameCurrentScenario: mockRenameCurrentScenario,
          deleteScenario: mockDeleteScenario
        }
        return selector(state)
      })

      render(<ScenarioSwitcher />)

      // Open dropdown
      fireEvent.click(screen.getByRole('button', { expanded: false }))

      // Rename button should not exist
      expect(screen.queryByRole('menuitem', { name: /rename/i })).not.toBeInTheDocument()
    })
  })

  describe('Duplicate Scenario', () => {
    it('should call duplicateCurrentScenario when duplicate button clicked', async () => {
      render(<ScenarioSwitcher />)

      // Open dropdown
      fireEvent.click(screen.getByRole('button', { expanded: false }))

      await waitFor(() => {
        const duplicateButton = screen.getByRole('menuitem', { name: /duplicate/i })
        fireEvent.click(duplicateButton)
      })

      expect(mockDuplicateCurrentScenario).toHaveBeenCalledWith('Test Scenario (Copy)')
    })

    it('should close dropdown after duplicating', async () => {
      render(<ScenarioSwitcher />)

      // Open dropdown
      const button = screen.getByRole('button', { expanded: false })
      fireEvent.click(button)

      await waitFor(() => {
        expect(button).toHaveAttribute('aria-expanded', 'true')
      })

      // Click duplicate
      const duplicateButton = screen.getByRole('menuitem', { name: /duplicate/i })
      fireEvent.click(duplicateButton)

      // Dropdown should close
      await waitFor(() => {
        expect(button).toHaveAttribute('aria-expanded', 'false')
      })
    })

    it('should not show duplicate button when no current scenario', () => {
      vi.mocked(useCanvasStore).mockImplementation((selector: any) => {
        const state = {
          currentScenarioId: null,
          isDirty: false,
          isSaving: false,
          lastSavedAt: null,
          nodes: [],
          edges: [],
          saveCurrentScenario: mockSaveCurrentScenario,
          loadScenario: mockLoadScenario,
          duplicateCurrentScenario: mockDuplicateCurrentScenario,
          renameCurrentScenario: mockRenameCurrentScenario,
          deleteScenario: mockDeleteScenario
        }
        return selector(state)
      })

      render(<ScenarioSwitcher />)

      // Open dropdown
      fireEvent.click(screen.getByRole('button', { expanded: false }))

      // Duplicate button should not exist
      expect(screen.queryByRole('menuitem', { name: /duplicate/i })).not.toBeInTheDocument()
    })

    it('should use "Scenario (Copy)" if current scenario has no name', async () => {
      vi.mocked(scenarios.getScenario).mockReturnValue({
        id: 'scenario-1',
        name: '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        graph: { nodes: [], edges: [] }
      })

      render(<ScenarioSwitcher />)

      // Open dropdown and click duplicate
      fireEvent.click(screen.getByRole('button', { expanded: false }))
      await waitFor(() => {
        fireEvent.click(screen.getByRole('menuitem', { name: /duplicate/i }))
      })

      expect(mockDuplicateCurrentScenario).toHaveBeenCalledWith('Scenario (Copy)')
    })
  })

  describe('Save and Save As', () => {
    it('should show "Save" button for existing scenario', async () => {
      render(<ScenarioSwitcher />)

      // Open dropdown
      fireEvent.click(screen.getByRole('button', { expanded: false }))

      await waitFor(() => {
        const saveButton = screen.getByRole('menuitem', { name: /^Save$/i })
        expect(saveButton).toBeInTheDocument()
      })
    })

    it('should show "Save as..." button for unsaved scenario', async () => {
      vi.mocked(useCanvasStore).mockImplementation((selector: any) => {
        const state = {
          currentScenarioId: null,
          isDirty: true,
          isSaving: false,
          lastSavedAt: null,
          nodes: [],
          edges: [],
          saveCurrentScenario: mockSaveCurrentScenario,
          loadScenario: mockLoadScenario,
          duplicateCurrentScenario: mockDuplicateCurrentScenario,
          renameCurrentScenario: mockRenameCurrentScenario,
          deleteScenario: mockDeleteScenario
        }
        return selector(state)
      })

      render(<ScenarioSwitcher />)

      // Open dropdown
      fireEvent.click(screen.getByRole('button', { expanded: false }))

      await waitFor(() => {
        const saveButton = screen.getByRole('menuitem', { name: /save as\.\.\./i })
        expect(saveButton).toBeInTheDocument()
      })
    })

    it('should call saveCurrentScenario directly for existing scenario', async () => {
      render(<ScenarioSwitcher />)

      // Open dropdown
      fireEvent.click(screen.getByRole('button', { expanded: false }))

      await waitFor(() => {
        const saveButton = screen.getByRole('menuitem', { name: /^Save$/i })
        fireEvent.click(saveButton)
      })

      expect(mockSaveCurrentScenario).toHaveBeenCalled()
    })

    it('should open save dialog for new scenario', async () => {
      vi.mocked(useCanvasStore).mockImplementation((selector: any) => {
        const state = {
          currentScenarioId: null,
          isDirty: true,
          isSaving: false,
          lastSavedAt: null,
          nodes: [],
          edges: [],
          saveCurrentScenario: mockSaveCurrentScenario,
          loadScenario: mockLoadScenario,
          duplicateCurrentScenario: mockDuplicateCurrentScenario,
          renameCurrentScenario: mockRenameCurrentScenario,
          deleteScenario: mockDeleteScenario
        }
        return selector(state)
      })

      render(<ScenarioSwitcher />)

      // Open dropdown
      fireEvent.click(screen.getByRole('button', { expanded: false }))

      await waitFor(() => {
        const saveButton = screen.getByRole('menuitem', { name: /save as\.\.\./i })
        fireEvent.click(saveButton)
      })

      // Save dialog should appear
      await waitFor(() => {
        expect(screen.getByText('Save scenario')).toBeInTheDocument()
      })
    })

    it('should pre-populate save dialog with "New scenario"', async () => {
      vi.mocked(useCanvasStore).mockImplementation((selector: any) => {
        const state = {
          currentScenarioId: null,
          isDirty: true,
          isSaving: false,
          lastSavedAt: null,
          nodes: [],
          edges: [],
          saveCurrentScenario: mockSaveCurrentScenario,
          loadScenario: mockLoadScenario,
          duplicateCurrentScenario: mockDuplicateCurrentScenario,
          renameCurrentScenario: mockRenameCurrentScenario,
          deleteScenario: mockDeleteScenario
        }
        return selector(state)
      })

      render(<ScenarioSwitcher />)

      // Open dropdown and click save
      fireEvent.click(screen.getByRole('button', { expanded: false }))
      await waitFor(() => {
        fireEvent.click(screen.getByRole('menuitem', { name: /save as\.\.\./i }))
      })

      // Input should have default name
      await waitFor(() => {
        const input = screen.getByPlaceholderText('Scenario name') as HTMLInputElement
        expect(input.value).toBe('New scenario')
      })
    })

    it('should call saveCurrentScenario with new name when save dialog submitted', async () => {
      vi.mocked(useCanvasStore).mockImplementation((selector: any) => {
        const state = {
          currentScenarioId: null,
          isDirty: true,
          isSaving: false,
          lastSavedAt: null,
          nodes: [],
          edges: [],
          saveCurrentScenario: mockSaveCurrentScenario,
          loadScenario: mockLoadScenario,
          duplicateCurrentScenario: mockDuplicateCurrentScenario,
          renameCurrentScenario: mockRenameCurrentScenario,
          deleteScenario: mockDeleteScenario
        }
        return selector(state)
      })

      render(<ScenarioSwitcher />)

      // Open dropdown and click save
      fireEvent.click(screen.getByRole('button', { expanded: false }))
      await waitFor(() => {
        fireEvent.click(screen.getByRole('menuitem', { name: /save as\.\.\./i }))
      })

      // Change name and submit
      await waitFor(() => {
        const input = screen.getByPlaceholderText('Scenario name')
        fireEvent.change(input, { target: { value: 'My New Scenario' } })
      })

      const submitButton = screen.getByRole('button', { name: 'Save' })
      fireEvent.click(submitButton)

      expect(mockSaveCurrentScenario).toHaveBeenCalledWith('My New Scenario')
    })

    it('should submit save dialog on Enter key', async () => {
      vi.mocked(useCanvasStore).mockImplementation((selector: any) => {
        const state = {
          currentScenarioId: null,
          isDirty: true,
          isSaving: false,
          lastSavedAt: null,
          nodes: [],
          edges: [],
          saveCurrentScenario: mockSaveCurrentScenario,
          loadScenario: mockLoadScenario,
          duplicateCurrentScenario: mockDuplicateCurrentScenario,
          renameCurrentScenario: mockRenameCurrentScenario,
          deleteScenario: mockDeleteScenario
        }
        return selector(state)
      })

      render(<ScenarioSwitcher />)

      // Open dropdown and click save
      fireEvent.click(screen.getByRole('button', { expanded: false }))
      await waitFor(() => {
        fireEvent.click(screen.getByRole('menuitem', { name: /save as\.\.\./i }))
      })

      // Change name and press Enter
      await waitFor(() => {
        const input = screen.getByPlaceholderText('Scenario name')
        fireEvent.change(input, { target: { value: 'Quick Save' } })
        fireEvent.keyDown(input, { key: 'Enter' })
      })

      expect(mockSaveCurrentScenario).toHaveBeenCalledWith('Quick Save')
    })

    it('should close save dialog on Escape key', async () => {
      vi.mocked(useCanvasStore).mockImplementation((selector: any) => {
        const state = {
          currentScenarioId: null,
          isDirty: true,
          isSaving: false,
          lastSavedAt: null,
          nodes: [],
          edges: [],
          saveCurrentScenario: mockSaveCurrentScenario,
          loadScenario: mockLoadScenario,
          duplicateCurrentScenario: mockDuplicateCurrentScenario,
          renameCurrentScenario: mockRenameCurrentScenario,
          deleteScenario: mockDeleteScenario
        }
        return selector(state)
      })

      render(<ScenarioSwitcher />)

      // Open dropdown and click save
      fireEvent.click(screen.getByRole('button', { expanded: false }))
      await waitFor(() => {
        fireEvent.click(screen.getByRole('menuitem', { name: /save as\.\.\./i }))
      })

      // Press Escape
      await waitFor(() => {
        const input = screen.getByPlaceholderText('Scenario name')
        fireEvent.keyDown(input, { key: 'Escape' })
      })

      // Dialog should be gone
      await waitFor(() => {
        expect(screen.queryByText('Save scenario')).not.toBeInTheDocument()
      })
    })

    it('should disable Save button if name is empty or whitespace', async () => {
      vi.mocked(useCanvasStore).mockImplementation((selector: any) => {
        const state = {
          currentScenarioId: null,
          isDirty: true,
          isSaving: false,
          lastSavedAt: null,
          nodes: [],
          edges: [],
          saveCurrentScenario: mockSaveCurrentScenario,
          loadScenario: mockLoadScenario,
          duplicateCurrentScenario: mockDuplicateCurrentScenario,
          renameCurrentScenario: mockRenameCurrentScenario,
          deleteScenario: mockDeleteScenario
        }
        return selector(state)
      })

      render(<ScenarioSwitcher />)

      // Open dropdown and click save
      fireEvent.click(screen.getByRole('button', { expanded: false }))
      await waitFor(() => {
        fireEvent.click(screen.getByRole('menuitem', { name: /save as\.\.\./i }))
      })

      // Clear input
      await waitFor(() => {
        const input = screen.getByPlaceholderText('Scenario name')
        fireEvent.change(input, { target: { value: '   ' } })
      })

      const submitButton = screen.getByRole('button', { name: 'Save' })
      expect(submitButton).toBeDisabled()
    })
  })

  describe('Edge Cases', () => {
    it('should trim whitespace from scenario names', async () => {
      vi.mocked(useCanvasStore).mockImplementation((selector: any) => {
        const state = {
          currentScenarioId: null,
          isDirty: true,
          isSaving: false,
          lastSavedAt: null,
          nodes: [],
          edges: [],
          saveCurrentScenario: mockSaveCurrentScenario,
          loadScenario: mockLoadScenario,
          duplicateCurrentScenario: mockDuplicateCurrentScenario,
          renameCurrentScenario: mockRenameCurrentScenario,
          deleteScenario: mockDeleteScenario
        }
        return selector(state)
      })

      render(<ScenarioSwitcher />)

      // Open dropdown and click save
      fireEvent.click(screen.getByRole('button', { expanded: false }))
      await waitFor(() => {
        fireEvent.click(screen.getByRole('menuitem', { name: /save as\.\.\./i }))
      })

      // Enter name with leading/trailing whitespace
      await waitFor(() => {
        const input = screen.getByPlaceholderText('Scenario name')
        fireEvent.change(input, { target: { value: '  Trimmed Name  ' } })
      })

      const submitButton = screen.getByRole('button', { name: 'Save' })
      fireEvent.click(submitButton)

      expect(mockSaveCurrentScenario).toHaveBeenCalledWith('Trimmed Name')
    })

    it('should close dropdown after successful save', async () => {
      vi.mocked(useCanvasStore).mockImplementation((selector: any) => {
        const state = {
          currentScenarioId: null,
          isDirty: true,
          isSaving: false,
          lastSavedAt: null,
          nodes: [],
          edges: [],
          saveCurrentScenario: mockSaveCurrentScenario,
          loadScenario: mockLoadScenario,
          duplicateCurrentScenario: mockDuplicateCurrentScenario,
          renameCurrentScenario: mockRenameCurrentScenario,
          deleteScenario: mockDeleteScenario
        }
        return selector(state)
      })

      render(<ScenarioSwitcher />)

      // Open dropdown
      const button = screen.getByRole('button', { expanded: false })
      fireEvent.click(button)

      await waitFor(() => {
        expect(button).toHaveAttribute('aria-expanded', 'true')
      })

      // Click save and submit dialog
      await waitFor(() => {
        fireEvent.click(screen.getByRole('menuitem', { name: /save as\.\.\./i }))
      })

      await waitFor(() => {
        const input = screen.getByPlaceholderText('Scenario name')
        fireEvent.change(input, { target: { value: 'New Save' } })
      })

      const submitButton = screen.getByRole('button', { name: 'Save' })
      fireEvent.click(submitButton)

      // Dropdown should close
      await waitFor(() => {
        expect(button).toHaveAttribute('aria-expanded', 'false')
      })
    })

    it.skip('should clear input value after closing save dialog', async () => {
      vi.mocked(useCanvasStore).mockImplementation((selector: any) => {
        const state = {
          currentScenarioId: null,
          isDirty: true,
          isSaving: false,
          lastSavedAt: null,
          nodes: [],
          edges: [],
          saveCurrentScenario: mockSaveCurrentScenario,
          loadScenario: mockLoadScenario,
          duplicateCurrentScenario: mockDuplicateCurrentScenario,
          renameCurrentScenario: mockRenameCurrentScenario,
          deleteScenario: mockDeleteScenario
        }
        return selector(state)
      })

      render(<ScenarioSwitcher />)

      // Open dropdown and save dialog
      const button = screen.getByTestId('scenario-switcher-trigger')
      fireEvent.click(button)
      await waitFor(() => {
        fireEvent.click(screen.getByRole('menuitem', { name: /save as\.\.\./i }))
      })

      // Change input and cancel
      await waitFor(() => {
        const input = screen.getByPlaceholderText('Scenario name')
        fireEvent.change(input, { target: { value: 'Should be cleared' } })
      })

      const cancelButton = screen.getByRole('button', { name: 'Cancel' })
      fireEvent.click(cancelButton)

      // Wait for dialog to close
      await waitFor(() => {
        expect(screen.queryByText('Save scenario')).not.toBeInTheDocument()
      })

      // Open dropdown again
      fireEvent.click(button)

      // Wait for dropdown to open and save button to be available
      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: /save as\.\.\./i })).toBeInTheDocument()
      })

      // Click save to open dialog
      fireEvent.click(screen.getByRole('menuitem', { name: /save as\.\.\./i }))

      // Check input value - should be reset to default
      await waitFor(() => {
        const input = screen.getByPlaceholderText('Scenario name') as HTMLInputElement
        expect(input.value).toBe('New scenario')
      })
    })
  })
})
