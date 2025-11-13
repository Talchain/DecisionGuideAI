import { useState, useRef, useEffect } from 'react'
import { PanelsTopLeft } from 'lucide-react'
import { useCanvasStore } from './store'
import { useReactFlow } from '@xyflow/react'
import { SnapshotManager } from './components/SnapshotManager'
import { ImportExportDialog } from './components/ImportExportDialog'
import { LayoutPopover } from './components/LayoutPopover'
import { BottomSheet } from './components/BottomSheet'
import { StatusChips } from './components/StatusChips'
import { ConnectivityChip } from './components/ConnectivityChip'
import { ScenarioSwitcher } from './components/ScenarioSwitcher'
import { NODE_REGISTRY } from './domain/nodes'
import type { NodeType } from './domain/nodes'
import { renderIcon } from './helpers/renderIcon'
import { plot } from '../adapters/plot'
import { useResultsRun } from './hooks/useResultsRun'
import { ValidationBanner, type ValidationError } from './components/ValidationBanner'
import { useValidationFeedback } from './hooks/useValidationFeedback'
import { useToast } from './ToastContext'
import { checkLimits, formatLimitError } from './utils/limitGuard'
import { useEngineLimits } from './hooks/useEngineLimits'
import { Tooltip } from './components/Tooltip'
import { EdgeLabelToggle } from './components/EdgeLabelToggle'
import { LimitsPanel } from './components/LimitsPanel'

export function CanvasToolbar() {
  const [isMinimized, setIsMinimized] = useState(false)
  const [showSnapshots, setShowSnapshots] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [showNodeMenu, setShowNodeMenu] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [showLimits, setShowLimits] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([])
  const [validationViolations, setValidationViolations] = useState<ValidationError[]>([]) // v1.2: coaching warnings
  const nodeMenuRef = useRef<HTMLDivElement>(null)
  const templatesButtonRef = useRef<HTMLButtonElement>(null)
  const { undo, redo, canUndo, canRedo, addNode, resetCanvas, nodes, edges, outcomeNodeId, setShowResultsPanel, openTemplatesPanel } = useCanvasStore()
  const { fitView, zoomIn, zoomOut } = useReactFlow()
  const { run } = useResultsRun()
  const { formatErrors, focusError } = useValidationFeedback()
  const { showToast } = useToast()
  const { limits } = useEngineLimits() // v1.2: Shared limits hook

  // v1.2: Check if node capacity is reached
  const isAtNodeCapacity = limits && nodes.length >= limits.nodes.max

  // Close node menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (nodeMenuRef.current && !nodeMenuRef.current.contains(e.target as Node)) {
        setShowNodeMenu(false)
      }
    }
    if (showNodeMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showNodeMenu])

  const handleAddNode = (type: NodeType) => {
    // v1.2: Gate on node capacity with consistent error messaging
    if (limits) {
      const limitCheck = checkLimits(nodes.length, edges.length, 1, 0, limits)
      if (!limitCheck.allowed) {
        const error = formatLimitError(limitCheck, 1, 0)
        showToast(error, 'warning')
        setShowNodeMenu(false)
        return
      }
    }

    addNode(undefined, type)
    setShowNodeMenu(false)
  }

  const handleRunAnalysis = async () => {
    if (nodes.length === 0) return

    // Clear previous validation errors and violations
    setValidationErrors([])
    setValidationViolations([])
    setIsRunning(true)

    // Force open Results panel BEFORE running
    setShowResultsPanel(true)

    try {
      // Validate graph using adapter (if validate is available)
      const adapter = plot as any
      if (adapter.validate && typeof adapter.validate === 'function') {
        const validationResult = await adapter.validate({ nodes, edges })

        // v1.2: Handle violations (non-blocking coaching warnings)
        if (validationResult.violations && validationResult.violations.length > 0) {
          const formattedViolations = formatErrors(validationResult.violations)
          setValidationViolations(formattedViolations)
        }

        // Only block on hard errors
        if (!validationResult.valid) {
          // Show validation errors in banner
          const formattedErrors = formatErrors(validationResult.errors)
          setValidationErrors(formattedErrors)
          setIsRunning(false)
          return
        }
      }

      // Run analysis with default seed and outcome node (if set)
      await run({
        template_id: 'canvas-graph',
        seed: 1337,
        graph: { nodes, edges },
        outcome_node: outcomeNodeId || undefined
      })
    } catch (err: any) {
      console.error('[CanvasToolbar] Run failed:', err)
      setValidationErrors([{
        code: 'RUN_ERROR',
        message: err.message || 'Failed to run analysis',
        severity: 'error' as const
      }])
    } finally {
      setIsRunning(false)
    }
  }

  // Helper to close all panels
  const closeAllPanels = () => {
    setShowSnapshots(false)
    setShowImport(false)
    setShowExport(false)
  }

  // Helpers to open specific panels (closes others first)
  const openSnapshots = () => {
    closeAllPanels()
    setShowSnapshots(true)
  }

  const openImport = () => {
    closeAllPanels()
    setShowImport(true)
  }

  const openExport = () => {
    closeAllPanels()
    setShowExport(true)
  }

  if (isMinimized) {
    return (
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[1000]">
        <button
          onClick={() => setIsMinimized(false)}
          className="px-3 py-2 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200 hover:bg-white transition-colors"
          title="Show toolbar"
          aria-label="Show toolbar"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        </button>
      </div>
    )
  }

  return (
    <>
      {/* Status Chips (top-right corner) */}
      <div className="fixed top-4 right-4 z-[999] flex flex-col gap-2 items-end">
        <ConnectivityChip />
        <StatusChips currentNodes={nodes.length} currentEdges={edges.length} onClick={() => setShowLimits(true)} />
        {/* P1 Polish: Edge label toggle (human ⇄ numeric) */}
        {edges.length > 0 && <EdgeLabelToggle showLabel={false} />}
      </div>

      {/* Validation Banner (positioned above toolbar) */}
      {(validationErrors.length > 0 || validationViolations.length > 0) && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[1001] w-full max-w-2xl px-4">
          <ValidationBanner
            errors={validationErrors}
            violations={validationViolations}
            onDismiss={() => {
              setValidationErrors([])
              setValidationViolations([])
            }}
            onFixNow={focusError}
          />
        </div>
      )}

      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[1000]">
        <div
          role="toolbar"
          aria-label="Canvas editing toolbar"
          className="flex items-center gap-2 px-4 py-2 bg-white/90 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200"
        >
        {/* Scenario Switcher */}
        <ScenarioSwitcher />

        {/* Divider */}
        <div className="w-px h-6 bg-gray-300" />

        {/* Add Node with Type Menu */}
        <div className="relative" ref={nodeMenuRef}>
          <Tooltip
            content={isAtNodeCapacity ? `Node limit reached (${nodes.length}/${limits?.nodes.max})` : 'Add Node'}
          >
            <span className="inline-block">
              <button
                onClick={() => !isAtNodeCapacity && setShowNodeMenu(!showNodeMenu)}
                disabled={isAtNodeCapacity}
                className={`p-1.5 text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 flex items-center gap-1.5 ${
                  isAtNodeCapacity
                    ? 'text-gray-400 bg-gray-200 cursor-not-allowed'
                    : 'text-white bg-carrot-500 hover:bg-carrot-600 focus:ring-carrot-500'
                }`}
                aria-label={isAtNodeCapacity ? `Node limit reached` : 'Add node to canvas'}
                aria-expanded={showNodeMenu}
                aria-haspopup="menu"
                data-testid="btn-node-menu"
              >
                <span className="text-base leading-none">+</span>
                <span>Node</span>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </span>
          </Tooltip>
          
          {showNodeMenu && (
            <div
              role="menu"
              className="absolute bottom-full mb-2 left-0 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50"
            >
              {(Object.keys(NODE_REGISTRY) as NodeType[]).map((type) => {
                const meta = NODE_REGISTRY[type]
                return (
                  <button
                    key={type}
                    role="menuitem"
                    onClick={() => handleAddNode(type)}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 transition-colors flex items-center gap-2"
                    aria-label={`Add ${meta.label} node`}
                  >
                    {renderIcon(meta.icon, 16)}
                    <span>Add {meta.label}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Templates Button */}
        <button
          ref={templatesButtonRef}
          onClick={() => openTemplatesPanel(templatesButtonRef.current || undefined)}
          className="p-1.5 text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 flex items-center gap-1.5 text-gray-700 bg-white hover:bg-gray-100 focus:ring-gray-400 border border-gray-300"
          title="Browse ready-made scenarios (T)"
          aria-label="Open templates panel"
          data-testid="btn-open-templates-toolbar"
        >
          <PanelsTopLeft className="w-4 h-4" />
          <span>Templates</span>
        </button>

        {/* Run Analysis Button (visible when nodes.length >= 1) */}
        {nodes.length >= 1 && (
          <button
            onClick={handleRunAnalysis}
            disabled={isRunning || validationErrors.length > 0}
            className="px-3 py-1.5 text-sm font-medium text-white bg-info-500 hover:bg-info-600 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-info-500 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            title={validationErrors.length > 0 ? "Fix issues to run" : isRunning ? "Analysis in progress..." : "Run Analysis (⌘R)"}
            aria-label={validationErrors.length > 0 ? "Cannot run - fix validation issues first" : isRunning ? "Analysis running - please wait" : "Run analysis on current graph"}
            data-testid="btn-run-analysis"
          >
            {isRunning ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Running...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
                Run
              </>
            )}
          </button>
        )}

        <div className="w-px h-6 bg-gray-300" role="separator" />

        {/* Undo/Redo - Wrap in span to allow tooltips on disabled state */}
        <Tooltip content={canUndo() ? 'Undo (⌘Z)' : 'No actions to undo'}>
          <span className="inline-block">
            <button
              onClick={undo}
              disabled={!canUndo()}
              className="p-1.5 text-gray-900 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 shadow-sm"
              aria-label="Undo last action"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
            </button>
          </span>
        </Tooltip>

        <Tooltip content={canRedo() ? 'Redo (⌘Y)' : 'No actions to redo'}>
          <span className="inline-block">
            <button
              onClick={redo}
              disabled={!canRedo()}
              className="p-1.5 text-gray-900 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 shadow-sm"
              aria-label="Redo last undone action"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
              </svg>
            </button>
          </span>
        </Tooltip>

        <div className="w-px h-6 bg-gray-300" role="separator" />

        {/* Zoom */}
        <button
          onClick={() => zoomIn()}
          className="p-1.5 text-gray-900 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 shadow-sm"
          title="Zoom In"
          aria-label="Zoom in"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
          </svg>
        </button>

        <button
          onClick={() => zoomOut()}
          className="p-1.5 text-gray-900 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 shadow-sm"
          title="Zoom Out"
          aria-label="Zoom out"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM7 10h6" />
          </svg>
        </button>

        <button
          onClick={() => fitView({ padding: 0.2, duration: 300 })}
          className="p-1.5 text-gray-900 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 shadow-sm"
          title="Fit View"
          aria-label="Fit all nodes in view"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
        </button>

        <div className="w-px h-6 bg-gray-300" role="separator" />

        {/* Layout Options */}
        <LayoutPopover />

        {/* Snapshots */}
        <button
          onClick={openSnapshots}
          className="p-1.5 text-gray-900 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 shadow-sm"
          title="Manage Snapshots (⌘S)"
          aria-label="Open snapshot manager"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>

        <div className="w-px h-6 bg-gray-300" role="separator" />

        {/* Import */}
        <button
          onClick={openImport}
          className="p-1.5 text-gray-900 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 shadow-sm"
          title="Import Canvas"
          aria-label="Import canvas from file"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
        </button>

        {/* Export */}
        <button
          onClick={openExport}
          className="p-1.5 text-gray-900 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 shadow-sm"
          title="Export Canvas"
          aria-label="Export canvas to file"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        </button>

        <div className="w-px h-6 bg-gray-300" role="separator" />

        {/* Reset - Wrap in span to allow tooltips on disabled state */}
        <Tooltip content={nodes.length === 0 && edges.length === 0 ? 'Canvas is already empty' : 'Reset Canvas'}>
          <span className="inline-block">
            <button
              onClick={() => setShowResetConfirm(true)}
              disabled={nodes.length === 0 && edges.length === 0}
              className="p-1.5 text-danger-600 bg-danger-50 rounded hover:bg-danger-100 transition-colors focus:outline-none focus:ring-2 focus:ring-danger-400 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              aria-label="Reset canvas"
              data-testid="btn-reset-canvas"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </span>
        </Tooltip>

        {/* Minimize */}
        <button
          onClick={() => setIsMinimized(true)}
          className="p-1.5 text-gray-900 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 shadow-sm"
          title="Minimize toolbar"
          aria-label="Minimize toolbar"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Modals */}
      <SnapshotManager isOpen={showSnapshots} onClose={() => setShowSnapshots(false)} />
      <ImportExportDialog isOpen={showImport} onClose={() => setShowImport(false)} mode="import" />
      <ImportExportDialog isOpen={showExport} onClose={() => setShowExport(false)} mode="export" />
      
      {/* Reset Confirmation */}
      <BottomSheet isOpen={showResetConfirm} onClose={() => setShowResetConfirm(false)} title="Reset canvas?">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">This clears all nodes and edges. You can still undo.</p>
          <div className="flex gap-2">
            <button
              onClick={() => setShowResetConfirm(false)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                resetCanvas()
                setShowResetConfirm(false)
              }}
              className="flex-1 px-4 py-2 bg-danger-600 text-white rounded hover:bg-danger-700"
              data-testid="btn-confirm-reset"
            >
              Reset
            </button>
          </div>
        </div>
      </BottomSheet>

      {/* Limits Panel (B5 P1 Polish) */}
      <LimitsPanel
        isOpen={showLimits}
        onClose={() => setShowLimits(false)}
        currentNodes={nodes.length}
        currentEdges={edges.length}
      />
      </div>
    </>
  )
}
