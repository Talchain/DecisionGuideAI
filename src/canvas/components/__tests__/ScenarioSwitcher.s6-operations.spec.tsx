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
    it('should open rename dialog when rename button clicked', async () => {
      render(<ScenarioSwitcher />)

      // Open dropdown
      const button = screen.getByRole('button', { expanded: false })
      fireEvent.click(button)

      await waitFor(() => {
        expect(button).toHaveAttribute('aria-expanded', 'true')
      })

      // Click rename button
      const renameButton = screen.getByRole('menuitem', { name: /rename/i })
      fireEvent.click(renameButton)

      // Rename dialog should appear
      await waitFor(() => {
        expect(screen.getByText('Rename scenario')).toBeInTheDocument()
      })
    })

    it('should pre-populate rename dialog with current scenario name', async () => {
      render(<ScenarioSwitcher />)

      // Open dropdown
      fireEvent.click(screen.getByRole('button', { expanded: false }))

      // Click rename
      await waitFor(() => {
        const renameButton = screen.getByRole('menuitem', { name: /rename/i })
        fireEvent.click(renameButton)
      })

      // Input should have current scenario name
      await waitFor(() => {
        const input = screen.getByPlaceholderText('Scenario name') as HTMLInputElement
        expect(input.value).toBe('Test Scenario')
      })
    })

    it('should call renameCurrentScenario when rename submitted', async () => {
      render(<ScenarioSwitcher />)

      // Open dropdown and click rename
      fireEvent.click(screen.getByRole('button', { expanded: false }))
      await waitFor(() => {
        fireEvent.click(screen.getByRole('menuitem', { name: /rename/i }))
      })

      // Change name and submit
      await waitFor(() => {
        const input = screen.getByPlaceholderText('Scenario name')
        fireEvent.change(input, { target: { value: 'New Scenario Name' } })
      })

      const submitButton = screen.getByRole('button', { name: 'Rename' })
      fireEvent.click(submitButton)

      expect(mockRenameCurrentScenario).toHaveBeenCalledWith('New Scenario Name')
    })

    it('should submit rename on Enter key', async () => {
      render(<ScenarioSwitcher />)

      // Open dropdown and click rename
      fireEvent.click(screen.getByRole('button', { expanded: false }))
      await waitFor(() => {
        fireEvent.click(screen.getByRole('menuitem', { name: /rename/i }))
      })

      // Change name and press Enter
      await waitFor(() => {
        const input = screen.getByPlaceholderText('Scenario name')
        fireEvent.change(input, { target: { value: 'Renamed via Enter' } })
        fireEvent.keyDown(input, { key: 'Enter' })
      })

      expect(mockRenameCurrentScenario).toHaveBeenCalledWith('Renamed via Enter')
    })

    it('should close rename dialog on Escape key', async () => {
      render(<ScenarioSwitcher />)

      // Open dropdown and click rename
      fireEvent.click(screen.getByRole('button', { expanded: false }))
      await waitFor(() => {
        fireEvent.click(screen.getByRole('menuitem', { name: /rename/i }))
      })

      // Press Escape
      await waitFor(() => {
        const input = screen.getByPlaceholderText('Scenario name')
        fireEvent.keyDown(input, { key: 'Escape' })
      })

      // Dialog should be gone
      await waitFor(() => {
        expect(screen.queryByText('Rename scenario')).not.toBeInTheDocument()
      })
    })

    it('should close rename dialog on Cancel button', async () => {
      render(<ScenarioSwitcher />)

      // Open dropdown and click rename
      fireEvent.click(screen.getByRole('button', { expanded: false }))
      await waitFor(() => {
        fireEvent.click(screen.getByRole('menuitem', { name: /rename/i }))
      })

      // Click Cancel
      await waitFor(() => {
        const cancelButton = screen.getByRole('button', { name: 'Cancel' })
        fireEvent.click(cancelButton)
      })

      // Dialog should be gone
      await waitFor(() => {
        expect(screen.queryByText('Rename scenario')).not.toBeInTheDocument()
      })
    })

    it('should disable Rename button if name is empty or whitespace', async () => {
      render(<ScenarioSwitcher />)

      // Open dropdown and click rename
      fireEvent.click(screen.getByRole('button', { expanded: false }))
      await waitFor(() => {
        fireEvent.click(screen.getByRole('menuitem', { name: /rename/i }))
      })

      // Clear input
      await waitFor(() => {
        const input = screen.getByPlaceholderText('Scenario name')
        fireEvent.change(input, { target: { value: '   ' } })
      })

      const submitButton = screen.getByRole('button', { name: 'Rename' })
      expect(submitButton).toBeDisabled()
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
      const button = screen.getByRole('button', { name: /untitled scenario/i })
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
