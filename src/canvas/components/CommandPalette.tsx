import { useState, useEffect, useRef, useCallback } from 'react'
import { useCanvasStore } from '../store'
import { runLayoutWithProgress } from '../layout/runLayoutWithProgress'
import { useReactFlow } from '@xyflow/react'
import { plot } from '../../adapters/plot'
import { executeCanonicalRun } from '../analysis/canonicalRunRegistry'
import { ValidationBanner, type ValidationError } from './ValidationBanner'
import { useValidationFeedback } from '../hooks/useValidationFeedback'
import { trackRunAttempt } from '../utils/sandboxTelemetry'
import { computeFitPadding } from '../utils/computeFitPadding'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import { cameraDuration } from '../utils/cameraMotion'
import { typography } from '../../styles/typography'

interface Action {
  id: string
  label: string
  shortcut?: string
  execute: () => void | Promise<void>
}

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
}

interface CommandPalettePropsExtended extends CommandPaletteProps {
  onOpenInspector?: () => void
}

export function CommandPalette({ isOpen, onClose, onOpenInspector }: CommandPalettePropsExtended) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [isExecuting, setIsExecuting] = useState(false)
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([])
  const [validationViolations, setValidationViolations] = useState<ValidationError[]>([]) // v1.2: coaching warnings
  const inputRef = useRef<HTMLInputElement>(null)
  const triggerRef = useRef<Element | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  // React #185 FIX: Use individual selectors for actions to avoid entire-store subscription
  const addNode = useCanvasStore(s => s.addNode)
  const selectAll = useCanvasStore(s => s.selectAll)
  const saveSnapshot = useCanvasStore(s => s.saveSnapshot)
  // React #185 FIX: Use shallow comparison for array selectors
  const nodes = useCanvasStore(s => s.nodes)
  const edges = useCanvasStore(s => s.edges)
  const { fitView } = useReactFlow()
  const { formatErrors, focusError } = useValidationFeedback()
  const prefersReducedMotion = usePrefersReducedMotion() // F1: reduced-motion guard for Zoom to Fit

  const actions: Action[] = [
    // Analysis actions
    {
      id: 'run-analysis',
      label: 'Run Analysis',
      shortcut: '⌘R',
      execute: async () => {
        // Clear previous validation errors and violations
        setValidationErrors([])
        setValidationViolations([])

        // Check if graph has nodes
        if (nodes.length === 0) {
          setValidationErrors([{
            code: 'EMPTY_GRAPH',
            message: 'Cannot run analysis: Graph is empty. Add at least one node.',
            severity: 'error' as const
          }])
          trackRunAttempt({ canRun: false, reason: 'empty', message: '' })
          return
        }

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
              // Show validation errors in banner (keep dialog open)
              const formattedErrors = formatErrors(validationResult.errors)
              setValidationErrors(formattedErrors)
              trackRunAttempt({ canRun: false, reason: 'validation', message: '' })
              return
            }
          }

          // Local validation passed: track the CLICK now — sandbox.run.clicked
          // counts user intent on a locally-valid graph (the dom spec pins
          // this), not pipeline success. Outcome-specific telemetry below.
          trackRunAttempt({ canRun: true, reason: 'ok', message: '' })
          setIsExecuting(true)

          // Run-path convergence: execute the one canonical pipeline
          // registered by OutputsDock instead of building a thin legacy
          // request here. Blocked runs surface their reason in the banner —
          // never a silent no-op.
          const outcome = await executeCanonicalRun({ source: 'command-palette' })
          if (outcome.status === 'unavailable') {
            // No runner host mounted — an environment condition, not a
            // gate-block: surface it, but do not count it as 'blocked'.
            setValidationErrors([{
              code: 'RUN_UNAVAILABLE',
              message: outcome.reason,
              severity: 'error' as const
            }])
            return
          }
          if (outcome.status === 'already-running') {
            // A run is in flight: inform, keep the palette open, no false
            // 'started another run' telemetry, no silent close.
            setValidationErrors([{
              code: 'RUN_IN_PROGRESS',
              message: 'An analysis is already running.',
              severity: 'error' as const
            }])
            return
          }
          if (outcome.status === 'blocked') {
            setValidationErrors([{
              code: 'RUN_BLOCKED',
              message: outcome.reason,
              severity: 'error' as const
            }])
            trackRunAttempt({ canRun: false, reason: 'validation', message: outcome.reason })
            return
          }

          // Close dialog after the run has been started
          onClose()
        } catch (err: any) {
          console.error('[CommandPalette] Run failed:', err)
          setValidationErrors([{
            code: 'RUN_ERROR',
            message: err.message || 'Failed to run analysis',
            severity: 'error' as const
          }])
        } finally {
          setIsExecuting(false)
        }
      }
    },
    // Node type actions (Rich Node Types)
    { id: 'add-goal', label: 'Add Goal Node', execute: () => addNode(undefined, 'goal') },
    { id: 'add-decision', label: 'Add Decision Node', execute: () => addNode(undefined, 'decision') },
    { id: 'add-option', label: 'Add Option Node', execute: () => addNode(undefined, 'option') },
    { id: 'add-factor', label: 'Add Factor Node', execute: () => addNode(undefined, 'factor') },
    { id: 'add-risk', label: 'Add Risk Node', execute: () => addNode(undefined, 'risk') },
    { id: 'add-outcome', label: 'Add Outcome Node', execute: () => addNode(undefined, 'outcome') },
    // Panel actions
    { id: 'open-inspector', label: 'Open Inspector', shortcut: '⌘I', execute: () => onOpenInspector?.() },
    // General actions
    { id: 'tidy-layout', label: 'Tidy Layout', execute: async () => {
      setIsExecuting(true)
      try {
        await runLayoutWithProgress()
        onClose()
      } finally {
        setIsExecuting(false)
      }
    }},
    { id: 'select-all', label: 'Select All', shortcut: '⌘A', execute: () => selectAll() },
    { id: 'zoom-fit', label: 'Zoom to Fit', execute: () => fitView({ padding: computeFitPadding(), duration: cameraDuration(300, prefersReducedMotion) }) },
    { id: 'save-snapshot', label: 'Save Snapshot', shortcut: '⌘S', execute: () => saveSnapshot() },
  ]

  const filteredActions = query.trim() === ''
    ? actions
    : actions.filter(a => a.label.toLowerCase().includes(query.toLowerCase()))

  // Focus restoration: capture trigger element on open, restore on close
  useEffect(() => {
    if (isOpen) {
      triggerRef.current = document.activeElement
      inputRef.current?.focus()
      setQuery('')
      setSelectedIndex(0)
      setValidationErrors([])
      setValidationViolations([])
    } else if (triggerRef.current instanceof HTMLElement) {
      triggerRef.current.focus()
      triggerRef.current = null
    }
  }, [isOpen])

  // Focus trap: keep Tab cycling within the dialog
  const handleFocusTrap = useCallback((e: KeyboardEvent) => {
    if (e.key !== 'Tab' || !dialogRef.current) return
    const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
      'input, button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )
    if (focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }, [])

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      handleFocusTrap(e)
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(i => Math.min(i + 1, filteredActions.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(i => Math.max(i - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const action = filteredActions[selectedIndex]
        if (action) {
          const result = action.execute()
          // Sync actions (add node, select all, etc.) — close immediately
          if (!(result instanceof Promise)) {
            onClose()
          }
          // Async actions (Run Analysis, Tidy Layout) manage their own close
          // on success and keep the dialog open on error for feedback.
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, filteredActions, selectedIndex, onClose, handleFocusTrap])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[3000] flex items-start justify-center pt-32 bg-black/50" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="bg-white rounded-lg shadow-panel w-full max-w-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="px-4 py-3 border-b border-gray-200">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelectedIndex(0)
            }}
            placeholder="Search actions..."
            aria-activedescendant={filteredActions[selectedIndex] ? `cmd-action-${filteredActions[selectedIndex].id}` : undefined}
            className="w-full text-lg outline-none"
          />
        </div>

        {/* Validation Error Banner (ValidationBanner has built-in aria-live) */}
        {(validationErrors.length > 0 || validationViolations.length > 0) && (
          <div className="mx-4 mt-3">
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

        {/* Actions List */}
        <div className="max-h-96 overflow-y-auto" role="group" aria-label="Available actions">
          {isExecuting ? (
            <div className="px-4 py-8 text-center text-gray-500">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-carrot-500"></div>
              <p className="mt-2">Executing...</p>
            </div>
          ) : filteredActions.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500">
              No actions found
            </div>
          ) : (
            filteredActions.map((action, index) => (
              <button
                key={action.id}
                id={`cmd-action-${action.id}`}
                aria-current={index === selectedIndex ? 'true' : undefined}
                onClick={async () => {
                  const result = action.execute()
                  if (!(result instanceof Promise)) {
                    onClose()
                  }
                  // Async actions (Run Analysis, Tidy Layout) close themselves on success
                }}
                disabled={isExecuting}
                className={`w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  index === selectedIndex ? 'bg-carrot-500/10' : ''
                }`}
              >
                <span className="font-medium text-gray-900">{action.label}</span>
                {action.shortcut && (
                  <span className={`${typography.body} text-gray-500`}>{action.shortcut}</span>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
