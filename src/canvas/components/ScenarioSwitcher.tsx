/**
 * ScenarioSwitcher - Dropdown UI for switching between saved scenarios
 *
 * Features:
 * - Shows current scenario name (or "Unsaved scenario")
 * - Dropdown with all scenarios (sorted by most recently updated)
 * - Actions: Save, Duplicate, Rename, Delete
 * - Dirty indicator (unsaved changes)
 * - Keyboard accessible (Tab, Enter, Escape)
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { Save, Copy, Edit2, Trash2, ChevronDown, Folder, AlertCircle, Download, Upload } from 'lucide-react'
import { useCanvasStore } from '../store'
import { loadScenarios, getScenario, type Scenario, importScenarioFromFile } from '../store/scenarios'
import { SaveStatusPill } from './SaveStatusPill'
import { exportScenario } from '../export/exportScenario'
import { useToast } from '../ToastContext'

export function ScenarioSwitcher() {
  const currentScenarioId = useCanvasStore(s => s.currentScenarioId)
  const isDirty = useCanvasStore(s => s.isDirty)
  const isSaving = useCanvasStore(s => s.isSaving)
  const lastSavedAt = useCanvasStore(s => s.lastSavedAt)
  const loadScenario = useCanvasStore(s => s.loadScenario)
  const saveCurrentScenario = useCanvasStore(s => s.saveCurrentScenario)
  const duplicateCurrentScenario = useCanvasStore(s => s.duplicateCurrentScenario)
  const renameCurrentScenario = useCanvasStore(s => s.renameCurrentScenario)
  const deleteScenario = useCanvasStore(s => s.deleteScenario)

  const [isOpen, setIsOpen] = useState(false)
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [showRenameDialog, setShowRenameDialog] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { showToast } = useToast()

  const currentScenario = currentScenarioId ? getScenario(currentScenarioId) : null

  // Refresh scenarios when dropdown opens
  const refreshScenarios = useCallback(() => {
    setScenarios(loadScenarios())
  }, [])

  useEffect(() => {
    if (isOpen) {
      refreshScenarios()
    }
  }, [isOpen, refreshScenarios])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleSave = useCallback(() => {
    if (currentScenarioId) {
      // Update existing scenario
      saveCurrentScenario()
      setIsOpen(false)
    } else {
      // Prompt for name for new scenario
      setShowSaveDialog(true)
      setInputValue('New scenario')
    }
  }, [currentScenarioId, saveCurrentScenario])

  const handleSaveAs = useCallback(() => {
    setShowSaveDialog(true)
    setInputValue(currentScenario?.name || 'New scenario')
  }, [currentScenario])

  const handleSaveDialogSubmit = useCallback(() => {
    if (inputValue.trim()) {
      saveCurrentScenario(inputValue.trim())
      setShowSaveDialog(false)
      setInputValue('')
      setIsOpen(false)
      refreshScenarios()
    }
  }, [inputValue, saveCurrentScenario, refreshScenarios])

  const handleDuplicate = useCallback(() => {
    if (currentScenarioId) {
      const newName = `${currentScenario?.name || 'Scenario'} (Copy)`
      duplicateCurrentScenario(newName)
      setIsOpen(false)
      refreshScenarios()
    }
  }, [currentScenarioId, currentScenario, duplicateCurrentScenario, refreshScenarios])

  const handleRename = useCallback(() => {
    if (currentScenarioId && currentScenario) {
      setShowRenameDialog(true)
      setInputValue(currentScenario.name)
    }
  }, [currentScenarioId, currentScenario])

  const handleRenameDialogSubmit = useCallback(() => {
    if (inputValue.trim() && currentScenarioId) {
      renameCurrentScenario(inputValue.trim())
      setShowRenameDialog(false)
      setInputValue('')
      refreshScenarios()
    }
  }, [inputValue, currentScenarioId, renameCurrentScenario, refreshScenarios])

  const handleDelete = useCallback((id: string) => {
    const scenario = getScenario(id)
    if (!scenario) return

    if (window.confirm(`Delete scenario "${scenario.name}"?`)) {
      deleteScenario(id)
      setIsOpen(false)
      refreshScenarios()
    }
  }, [deleteScenario, refreshScenarios])

  const handleLoadScenario = useCallback((id: string) => {
    // Warn if there are unsaved changes
    if (isDirty) {
      if (!window.confirm('You have unsaved changes. Switch anyway?')) {
        return
      }
    }

    loadScenario(id)
    setIsOpen(false)
  }, [isDirty, loadScenario])

  const handleExport = useCallback(() => {
    if (currentScenarioId && currentScenario) {
      exportScenario(currentScenario)
      setIsOpen(false)
    }
  }, [currentScenarioId, currentScenario])

  const handleImport = useCallback(() => {
    // Warn if there are unsaved changes
    if (isDirty) {
      if (!window.confirm('You have unsaved changes. Import anyway?')) {
        return
      }
    }

    // Trigger file picker
    fileInputRef.current?.click()
  }, [isDirty])

  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const content = await file.text()
      const result = importScenarioFromFile(content)

      if (result.success && result.scenario) {
        // Load the imported scenario
        loadScenario(result.scenario.id)
        showToast(`Imported "${result.scenario.name}" successfully`, 'success')
        setIsOpen(false)
        refreshScenarios()
      } else {
        showToast(result.error || 'Failed to import scenario', 'error')
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to read file', 'error')
    }

    // Reset file input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [loadScenario, showToast, refreshScenarios])

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        {/* Trigger button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-info-500 transition-colors"
          type="button"
          aria-expanded={isOpen}
          aria-haspopup="true"
        >
          <Folder className="w-4 h-4 text-gray-500" />
          <span className="max-w-[150px] truncate">
            {currentScenario?.name || 'Untitled scenario'}
          </span>
          {/* P0-2: Replace dot with reactive save status */}
          <SaveStatusPill
            isSaving={isSaving}
            lastSavedAt={lastSavedAt}
          />
          <ChevronDown className="w-4 h-4 text-gray-400" />
        </button>

        {/* Dropdown menu */}
        {isOpen && (
          <div
            className="absolute bottom-full left-0 mb-1 w-72 bg-white border border-gray-200 rounded-lg shadow-lg z-50"
            role="menu"
          >
            {/* Current scenario actions */}
            <div className="p-2 border-b border-gray-200">
              <div className="flex flex-col gap-1">
                {/* Save row */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleSave}
                    className="flex-1 flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded transition-colors"
                    type="button"
                    role="menuitem"
                  >
                    <Save className="w-4 h-4" />
                    {currentScenarioId ? 'Save' : 'Save as...'}
                  </button>
                  {currentScenarioId && (
                    <>
                      <button
                        onClick={handleExport}
                        className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded transition-colors"
                        type="button"
                        role="menuitem"
                        title="Export scenario"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        onClick={handleDuplicate}
                        className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded transition-colors"
                        type="button"
                        role="menuitem"
                        title="Duplicate"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={handleRename}
                        className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded transition-colors"
                        type="button"
                        role="menuitem"
                        title="Rename"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(currentScenarioId)}
                        className="px-3 py-2 text-sm text-danger-600 hover:bg-danger-50 rounded transition-colors"
                        type="button"
                        role="menuitem"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>

                {/* Import row */}
                <button
                  onClick={handleImport}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded transition-colors"
                  type="button"
                  role="menuitem"
                >
                  <Upload className="w-4 h-4" />
                  Import scenario...
                </button>
              </div>
            </div>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".olumi.json,application/json"
              onChange={handleFileSelect}
              className="hidden"
            />

            {/* Scenario list */}
            <div className="max-h-64 overflow-y-auto">
              {scenarios.length === 0 ? (
                <div className="px-4 py-3 text-sm text-gray-500 text-center">
                  No saved scenarios yet
                </div>
              ) : (
                <>
                  {/* Recent scenarios (first 5) */}
                  {scenarios.length > 0 && (
                    <>
                      <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Recent
                      </div>
                      {scenarios.slice(0, 5).map(scenario => (
                        <button
                          key={scenario.id}
                          onClick={() => handleLoadScenario(scenario.id)}
                          className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 transition-colors ${
                            scenario.id === currentScenarioId ? 'bg-info-50 text-info-700 font-medium' : 'text-gray-700'
                          }`}
                          type="button"
                          role="menuitem"
                        >
                          <div className="flex items-center justify-between">
                            <span className="truncate flex-1">{scenario.name}</span>
                            {scenario.id === currentScenarioId && isDirty && (
                              <AlertCircle className="w-3 h-3 text-warning-500 flex-shrink-0 ml-2" title="Unsaved changes" />
                            )}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {formatTimestamp(scenario.updatedAt)}
                          </div>
                        </button>
                      ))}
                    </>
                  )}

                  {/* All scenarios (if more than 5) */}
                  {scenarios.length > 5 && (
                    <>
                      <div className="border-t border-gray-200 my-1" />
                      <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        All Scenarios
                      </div>
                      {scenarios.slice(5).map(scenario => (
                        <button
                          key={scenario.id}
                          onClick={() => handleLoadScenario(scenario.id)}
                          className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 transition-colors ${
                            scenario.id === currentScenarioId ? 'bg-info-50 text-info-700 font-medium' : 'text-gray-700'
                          }`}
                          type="button"
                          role="menuitem"
                        >
                          <div className="flex items-center justify-between">
                            <span className="truncate flex-1">{scenario.name}</span>
                            {scenario.id === currentScenarioId && isDirty && (
                              <AlertCircle className="w-3 h-3 text-warning-500 flex-shrink-0 ml-2" title="Unsaved changes" />
                            )}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {formatTimestamp(scenario.updatedAt)}
                          </div>
                        </button>
                      ))}
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Save dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[2001]">
          <div className="bg-white rounded-lg p-6 w-96 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Save scenario</h3>
            <input
              type="text"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleSaveDialogSubmit()
                if (e.key === 'Escape') {
                  setShowSaveDialog(false)
                  setInputValue('')
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-info-500"
              placeholder="Scenario name"
              autoFocus
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleSaveDialogSubmit}
                disabled={!inputValue.trim()}
                className="flex-1 px-4 py-2 text-white bg-info-600 hover:bg-info-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                type="button"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setShowSaveDialog(false)
                  setInputValue('')
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                type="button"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename dialog */}
      {showRenameDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[2001]">
          <div className="bg-white rounded-lg p-6 w-96 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Rename scenario</h3>
            <input
              type="text"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleRenameDialogSubmit()
                if (e.key === 'Escape') {
                  setShowRenameDialog(false)
                  setInputValue('')
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-info-500"
              placeholder="Scenario name"
              autoFocus
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleRenameDialogSubmit}
                disabled={!inputValue.trim()}
                className="flex-1 px-4 py-2 text-white bg-info-600 hover:bg-info-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                type="button"
              >
                Rename
              </button>
              <button
                onClick={() => {
                  setShowRenameDialog(false)
                  setInputValue('')
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                type="button"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/**
 * Format timestamp as relative time
 */
function formatTimestamp(ts: number): string {
  const now = Date.now()
  const diff = now - ts
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (minutes > 0) return `${minutes}m ago`
  return 'Just now'
}
