/**
 * ScenarioSwitcher - the model's name control + dropdown for saved scenarios
 *
 * Features:
 * - Shows the current model name, INLINE-EDITABLE in one click
 * - Dropdown with all scenarios (sorted by most recently updated)
 * - Actions: Save, Duplicate, Rename, Delete
 * - Dirty indicator (unsaved changes)
 * - Keyboard accessible (Tab, Enter, Escape)
 *
 * ⭐ 14 Aug 2026 (Paul's ruling) — this is now the SINGLE NAME AUTHORITY. The
 * TopBar's separate plain-title control is gone. See `displayName`/`onRename`.
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { Save, Copy, Edit2, Trash2, ChevronDown, Folder, AlertCircle, Download, Upload } from 'lucide-react'
import { useCanvasStore } from '../store'
import { loadScenarios, getScenario, type Scenario, importScenarioFromFile } from '../store/scenarios'
import { markGraphImported } from '../store/importRegistrationMarker'
import { SaveStatusPill } from './SaveStatusPill'
import { useDraftStore, graphWriteWithheldFor } from '../stores/draftStore'
import { exportScenario } from '../export/exportScenario'
import { useToast } from '../ToastContext'
import { typography } from '../../styles/typography'
import { SCENARIO_RENAME_REQUEST_EVENT } from './scenarioRenameEvent'

/** Matches the character budget the removed TopBar title input enforced. */
const MAX_NAME_LENGTH = 60

/** Paul, 14 Aug 2026: "decision" -> "model" on the naming surface. */
export const UNTITLED_MODEL = 'Untitled model'

interface ScenarioSwitcherProps {
  /**
   * Which side of the trigger the dropdown opens on.
   * 'above' (default) suits a bottom-anchored toolbar; 'below' is for the
   * fixed TopBar mount (Lane 4 P5), where opening upward would leave the
   * viewport.
   */
  dropdownPosition?: 'above' | 'below'
  /**
   * ⭐ THE NAME THIS CONTROL DISPLAYS, when the mount is the name authority.
   *
   * Absent, the switcher falls back to the localStorage scenario record — which
   * is what it did exclusively until 14 Aug 2026, and why it LIED on the
   * authenticated path: `loadSupabaseScenario` hydrates `currentScenarioId`
   * with a Supabase UUID and never writes a localStorage row, so `getScenario`
   * returned null and the trigger read "Untitled decision" for every persisted
   * model, whatever its real name.
   *
   * The TopBar passes the name CanvasMVP derives (localStorage name, else
   * `framing.title`, else the fallback), so the control tells the truth in both
   * guest and authenticated sessions.
   */
  displayName?: string
  /**
   * Commit handler for a rename. Absent, renames go to the localStorage record
   * only (`renameCurrentScenario`).
   *
   * The TopBar passes CanvasMVP's `handleTitleChange`, which writes BOTH the
   * framing title (-> Supabase `scenarios.framing`) and the localStorage name.
   * Supplying this prop is also what marks a mount as the name AUTHORITY: only
   * that mount answers a kebab rename request.
   */
  onRename?: (name: string) => void
  /**
   * ⭐ DOES THIS SESSION PERSIST TO THE SERVER? (the canonical
   * `lib/persistenceActive` predicate, threaded down from `CanvasMVP` through
   * the TopBar's `isPersisted`.)
   *
   * When true, this control's SCENARIO-COLLECTION half is hidden, because every
   * part of it is wrong for a signed-in user — not merely redundant:
   *
   *   LIST   `loadScenarios()` reads localStorage only, and a persisted
   *          session's decisions live in Supabase with no localStorage row, so
   *          the list shows the wrong set (empty, or stale guest records).
   *   SWITCH `store.loadScenario` is the localStorage load path and finds no
   *          record for a Supabase decision.
   *   DELETE `store.deleteScenario` removes a localStorage record — it deletes
   *          a local artefact, not the user's decision, while reporting success.
   *
   * Hiding them leaves `ScenarioListPage` as the single switch/delete surface:
   * ONE owner, rather than a second steering wheel connected to nothing. The
   * NAME/RENAME half is correct on both paths (it commits through `onRename` to
   * the framing title) and is deliberately kept.
   *
   * Defaults to FALSE so the guest/toolbar mounts — the sessions these controls
   * are actually for, where localStorage IS the store of record — are unchanged.
   */
  isPersisted?: boolean
}

export function ScenarioSwitcher({
  dropdownPosition = 'above',
  displayName,
  onRename,
  isPersisted = false,
}: ScenarioSwitcherProps = {}) {
  const currentScenarioId = useCanvasStore(s => s.currentScenarioId)
  const isDirty = useCanvasStore(s => s.isDirty)
  const isSaving = useCanvasStore(s => s.isSaving)
  const lastSavedAt = useCanvasStore(s => s.lastSavedAt)
  /**
   * ⚠ SUBSCRIBED, NOT `getState()`. The pill must stop claiming durability the
   * moment the phase moves, and a one-shot read in render would keep the stale
   * claim on screen for the whole draft.
   */
  const graphWriteWithheld = useDraftStore(s => graphWriteWithheldFor(s, currentScenarioId))
  const loadScenario = useCanvasStore(s => s.loadScenario)
  const saveCurrentScenario = useCanvasStore(s => s.saveCurrentScenario)
  const duplicateCurrentScenario = useCanvasStore(s => s.duplicateCurrentScenario)
  const renameCurrentScenario = useCanvasStore(s => s.renameCurrentScenario)
  const deleteScenario = useCanvasStore(s => s.deleteScenario)
  // React #185 PERF: nodes/edges only needed in import callback, use getState() to avoid re-renders

  const [isOpen, setIsOpen] = useState(false)
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { showToast } = useToast()

  const currentScenario = currentScenarioId ? getScenario(currentScenarioId) : null

  // ---------------------------------------------------------------------
  // Inline rename (Paul, 14 Aug 2026) — replaces the buried modal dialog AND
  // the TopBar's separate plain-title control.
  // ---------------------------------------------------------------------

  /**
   * The name on screen. `displayName` wins when the mount is the authority;
   * the localStorage record is the fallback for the toolbar mount.
   */
  const resolvedName = (displayName ?? currentScenario?.name ?? '').trim() || UNTITLED_MODEL

  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState('')

  /**
   * Escape must not be undone by the blur that follows it, and Enter must not
   * commit twice when the unmounting input fires a trailing blur. One ref
   * settles both: the first terminal action for an editing session wins.
   */
  const renameSettledRef = useRef(false)

  const startRename = useCallback(() => {
    renameSettledRef.current = false
    setRenameValue(resolvedName)
    setIsRenaming(true)
    setIsOpen(false)
  }, [resolvedName])

  const commitRename = useCallback(() => {
    if (renameSettledRef.current) return
    renameSettledRef.current = true

    const next = renameValue.trim().slice(0, MAX_NAME_LENGTH)
    // An empty name is REFUSED — the previous name stands. A model with no name
    // is worse than one called "Untitled model": the fallback at least tells the
    // truth about being unnamed.
    if (next && next !== resolvedName) {
      if (onRename) {
        onRename(next)
      } else {
        renameCurrentScenario(next)
      }
    }
    setIsRenaming(false)
  }, [renameValue, resolvedName, onRename, renameCurrentScenario])

  const cancelRename = useCallback(() => {
    renameSettledRef.current = true
    setIsRenaming(false)
  }, [])

  // The kebab menu's "Rename" item reaches us through this. Only the authority
  // mount answers: a non-authoritative switcher opening an editor would write
  // to a different place than the one the user is looking at.
  const isNameAuthority = onRename != null
  useEffect(() => {
    if (!isNameAuthority) return
    const handler = () => startRename()
    window.addEventListener(SCENARIO_RENAME_REQUEST_EVENT, handler)
    return () => window.removeEventListener(SCENARIO_RENAME_REQUEST_EVENT, handler)
  }, [isNameAuthority, startRename])

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
      // PERF: Use getState() to get current nodes/edges at import time (avoids subscription)
      const { nodes, edges } = useCanvasStore.getState()
      const result = importScenarioFromFile(content, nodes, edges)

      if (result.success && result.scenario) {
        // ROADMAP 2.467/2.483 — THE SECOND IMPORT ROUTE, and until now the
        // unguarded one. This path never touches `store.importCanvas`, so
        // `markGraphImported` was never called and `loadScenario`'s derivation
        // returned FALSE: a graph the server has never seen was installed with
        // the hold OFF, and one Rerun could re-attach an affirmative to CEE's
        // own pre-import model. Marked HERE, before `loadScenario` derives the
        // flag from the graph it installs — the ordering is the whole point.
        //
        // The graph is read back from the scenario the import just created,
        // because `importScenarioFromFile` RESEEDS node ids: marking the file's
        // original ids would compute a digest for a graph that never reaches
        // the canvas, and the hold would silently never match.
        const created = getScenario(result.scenario.id)
        if (created?.graph) {
          markGraphImported(created.graph.nodes, created.graph.edges)
        }

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
        {/* Trigger pill. TWO controls in one shell, deliberately: clicking the
            NAME edits it (Paul: renaming must be obvious and quick — one
            click), clicking the chevron opens the scenario menu. Nested
            buttons are invalid HTML, so the shell is a div. */}
        <div
          className={`flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 ${typography.label} text-gray-700 bg-white border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-info focus-within:ring-offset-2 transition-colors`}
          data-testid="scenario-switcher-pill"
        >
          <Folder className="w-4 h-4 shrink-0 text-gray-500" aria-hidden="true" />

          {isRenaming ? (
            <input
              type="text"
              value={renameValue}
              onChange={e => setRenameValue(e.target.value.slice(0, MAX_NAME_LENGTH))}
              onBlur={commitRename}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  commitRename()
                } else if (e.key === 'Escape') {
                  e.preventDefault()
                  cancelRename()
                }
              }}
              maxLength={MAX_NAME_LENGTH}
              className="w-[150px] bg-transparent border-b border-info outline-none px-0.5"
              aria-label="Model name"
              data-testid="scenario-name-input"
              autoFocus
            />
          ) : (
            <button
              onClick={startRename}
              className="max-w-[150px] truncate cursor-text text-left rounded px-0.5 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-info transition-colors"
              type="button"
              title="Rename model"
              aria-label={`Rename model, currently ${resolvedName}`}
              data-testid="scenario-name-button"
            >
              {resolvedName}
            </button>
          )}

          {/* P0-2: Replace dot with reactive save status */}
          <SaveStatusPill
            isSaving={isSaving}
            lastSavedAt={lastSavedAt}
            graphWriteWithheld={graphWriteWithheld}
          />

          <button
            onClick={() => setIsOpen(!isOpen)}
            className="shrink-0 p-0.5 rounded hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-info transition-colors"
            type="button"
            aria-expanded={isOpen}
            aria-haspopup="true"
            aria-label="Open model menu"
            data-testid="scenario-switcher-trigger"
          >
            <ChevronDown className="w-4 h-4 text-gray-400" aria-hidden="true" />
          </button>
        </div>

        {/* Dropdown menu */}
        {isOpen && (
          <div
            className={`absolute ${dropdownPosition === 'below' ? 'top-full mt-1' : 'bottom-full mb-1'} left-0 w-72 bg-white border border-gray-200 rounded-lg shadow-panel z-50`}
            role="menu"
            data-testid="scenario-switcher-menu"
          >
            {/* Current scenario actions */}
            <div className="p-2 border-b border-gray-200">
              <div className="flex flex-col gap-1">
                {/* Save row */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleSave}
                    className={`flex-1 flex items-center gap-2 px-3 py-2 ${typography.body} text-gray-700 hover:bg-gray-100 rounded transition-colors`}
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
                        className={`px-3 py-2 ${typography.body} text-gray-700 hover:bg-gray-100 rounded transition-colors`}
                        type="button"
                        role="menuitem"
                        title="Export scenario"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        onClick={handleDuplicate}
                        className={`px-3 py-2 ${typography.body} text-gray-700 hover:bg-gray-100 rounded transition-colors`}
                        type="button"
                        role="menuitem"
                        title="Duplicate"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={startRename}
                        className={`px-3 py-2 ${typography.body} text-gray-700 hover:bg-gray-100 rounded transition-colors`}
                        type="button"
                        role="menuitem"
                        title="Rename"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {/* Deletes a localStorage RECORD. On a persisted session
                          that is not the user's decision — see `isPersisted`.
                          The Decisions page owns delete there. */}
                      {!isPersisted && (
                        <button
                          onClick={() => handleDelete(currentScenarioId)}
                          className={`px-3 py-2 ${typography.body} text-danger-600 hover:bg-panel-hover rounded transition-colors`}
                          type="button"
                          role="menuitem"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </>
                  )}
                </div>

                {/* Import row */}
                <button
                  onClick={handleImport}
                  className={`w-full flex items-center gap-2 px-3 py-2 ${typography.body} text-gray-700 hover:bg-gray-100 rounded transition-colors`}
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

            {/* Scenario list — localStorage-backed, and therefore the WRONG set
                for a persisted session (see `isPersisted`). Replaced there by a
                pointer to the surface that does own decisions, so the control
                disappearing does not read as something broken. */}
            {isPersisted ? (
              <div
                className={`px-4 py-3 ${typography.body} text-gray-500`}
                data-testid="scenario-switcher-persisted-notice"
              >
                Your decisions are on the Decisions page.
              </div>
            ) : (
            <div className="max-h-64 overflow-y-auto">
              {scenarios.length === 0 ? (
                <div className={`px-4 py-3 ${typography.body} text-gray-500 text-center`}>
                  No saved scenarios yet
                </div>
              ) : (
                <>
                  {/* Recent scenarios (first 5) */}
                  {scenarios.length > 0 && (
                    <>
                      <div className={`px-4 py-2 ${typography.caption} font-semibold text-gray-500 uppercase tracking-wide`}>
                        Recent
                      </div>
                      {scenarios.slice(0, 5).map(scenario => (
                        <button
                          key={scenario.id}
                          onClick={() => handleLoadScenario(scenario.id)}
                          className={`w-full text-left px-4 py-2 ${typography.body} hover:bg-gray-100 transition-colors ${
                            scenario.id === currentScenarioId ? 'bg-panel-hover text-info-700 font-medium' : 'text-gray-700'
                          }`}
                          type="button"
                          role="menuitem"
                        >
                          <div className="flex items-center justify-between">
                            <span className="truncate flex-1">{scenario.name}</span>
                            {scenario.id === currentScenarioId && isDirty && (
                              <span className="flex-shrink-0 ml-2" title="Unsaved changes">
                                <AlertCircle className="w-3 h-3 text-warning-500" aria-hidden="true" />
                              </span>
                            )}
                          </div>
                          <div className={`${typography.caption} text-gray-500 mt-0.5`}>
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
                      <div className={`px-4 py-2 ${typography.caption} font-semibold text-gray-500 uppercase tracking-wide`}>
                        All Scenarios
                      </div>
                      {scenarios.slice(5).map(scenario => (
                        <button
                          key={scenario.id}
                          onClick={() => handleLoadScenario(scenario.id)}
                          className={`w-full text-left px-4 py-2 ${typography.body} hover:bg-gray-100 transition-colors ${
                            scenario.id === currentScenarioId ? 'bg-panel-hover text-info-700 font-medium' : 'text-gray-700'
                          }`}
                          type="button"
                          role="menuitem"
                        >
                          <div className="flex items-center justify-between">
                            <span className="truncate flex-1">{scenario.name}</span>
                            {scenario.id === currentScenarioId && isDirty && (
                              <span className="flex-shrink-0 ml-2" title="Unsaved changes">
                                <AlertCircle className="w-3 h-3 text-warning-500" aria-hidden="true" />
                              </span>
                            )}
                          </div>
                          <div className={`${typography.caption} text-gray-500 mt-0.5`}>
                            {formatTimestamp(scenario.updatedAt)}
                          </div>
                        </button>
                      ))}
                    </>
                  )}
                </>
              )}
            </div>
            )}
          </div>
        )}
      </div>

      {/* Save dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[2001]">
          <div className="bg-white rounded-lg p-6 w-96 shadow-panel">
            <h3 className={`${typography.h4} text-gray-900 mb-4`}>Save scenario</h3>
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
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-info focus:ring-offset-2"
              placeholder="Scenario name"
              autoFocus
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleSaveDialogSubmit}
                disabled={!inputValue.trim()}
                className="flex-1 px-4 py-2 text-text-on-color bg-info-600 hover:bg-info-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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

      {/* The rename DIALOG is gone (14 Aug 2026): rename is inline on the
          trigger, and the dropdown's pencil opens that same editor. One rename
          path, not two — and the old dialog was dead on the authenticated path
          anyway (it required a localStorage record that never exists there). */}
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
