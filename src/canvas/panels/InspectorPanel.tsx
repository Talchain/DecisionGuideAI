/**
 * InspectorPanel - Edge metadata inspector and editor
 *
 * Features:
 * - View/edit edge belief (epistemic uncertainty 0-1)
 * - View/edit edge provenance (source/rationale ≤100 chars)
 * - View/edit edge weight (normalized 0-1 for API)
 * - Inline validation with visual feedback
 * - Integration with /v1/validate API
 * - Unified panel design (PanelShell/PanelSection)
 *
 * UX:
 * - Sliders for numeric values with live preview
 * - Character counter for provenance
 * - Apply button (primary, disabled when unchanged/invalid)
 * - Reset button (ghost, reverts to saved state)
 * - Empty state when no edge selected
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { Settings } from 'lucide-react'
import { useCanvasStore } from '../store'
import { PanelShell } from './_shared/PanelShell'
import { PanelSection } from './_shared/PanelSection'
import { Tooltip } from '../components/Tooltip'
import { FieldLabel } from '../../components/ui/FieldLabel'
import { EDGE_CONSTRAINTS, clampBelief, trimProvenance, DEFAULT_EDGE_DATA } from '../domain/edges'
import { EDGE_TERMINOLOGY } from '../../config/terminology'
import {
  beliefToConfidencePercent,
  formatConfidencePercent,
} from '../utils/beliefDisplay'
import type { Edge } from '@xyflow/react'
import type { EdgeData } from '../domain/edges'

interface InspectorPanelProps {
  isOpen: boolean
  onClose: () => void
}

export function InspectorPanel({ isOpen, onClose }: InspectorPanelProps): JSX.Element | null {
  const panelRef = useRef<HTMLDivElement>(null)
  const edges = useCanvasStore(state => state.edges) as Edge<EdgeData>[]
  // React #185 FIX: Use individual selectors to avoid re-renders from selection.anchorPosition changes
  const edgeIdsSize = useCanvasStore(state => state.selection.edgeIds.size)
  const selectedEdgeId = useCanvasStore(state => {
    const ids = state.selection.edgeIds
    if (ids.size !== 1) return null
    return ids.values().next().value ?? null
  })
  const updateEdge = useCanvasStore(state => state.updateEdge)

  // Get selected edge (only support single-edge editing)
  const hasMultipleEdges = edgeIdsSize > 1
  const selectedEdge = selectedEdgeId ? edges.find(e => e.id === selectedEdgeId) : null

  // Local state for editing
  const [belief, setBelief] = useState<number>(0.5)
  const [provenance, setProvenance] = useState<string>('')
  const [weight, setWeight] = useState<number>(1.0)
  const [hasChanges, setHasChanges] = useState(false)

  // Validation state
  const [validationErrors, setValidationErrors] = useState<string[]>([])

  // Load edge data when selection changes
  useEffect(() => {
    if (selectedEdge) {
      setBelief(selectedEdge.data?.belief ?? 0.5)
      setProvenance(selectedEdge.data?.provenance ?? '')
      setWeight(selectedEdge.data?.weight ?? 1.0)
      setHasChanges(false)
      setValidationErrors([])
    } else {
      // Reset to defaults when no selection
      setBelief(0.5)
      setProvenance('')
      setWeight(1.0)
      setHasChanges(false)
      setValidationErrors([])
    }
  }, [selectedEdge])

  // Track changes
  useEffect(() => {
    if (!selectedEdge) {
      setHasChanges(false)
      return
    }

    const original: EdgeData = selectedEdge.data ?? DEFAULT_EDGE_DATA
    const changed =
      belief !== (original.belief ?? 0.5) ||
      provenance !== (original.provenance ?? '') ||
      weight !== (original.weight ?? 1.0)

    setHasChanges(changed)
  }, [belief, provenance, weight, selectedEdge])

  // Validate current state
  const validate = useCallback((): boolean => {
    const errors: string[] = []

    // Weight must be 0.1-5.0 (visual) or 0-1 (API normalized)
    if (weight < EDGE_CONSTRAINTS.weight.min || weight > EDGE_CONSTRAINTS.weight.max) {
      errors.push(`Weight must be between ${EDGE_CONSTRAINTS.weight.min} and ${EDGE_CONSTRAINTS.weight.max}`)
    }

    // Lint: missing provenance when belief ≥ 0.7
    if (belief >= 0.7 && !provenance.trim()) {
      errors.push('High belief (≥0.7) requires provenance justification')
    }

    setValidationErrors(errors)
    return errors.length === 0
  }, [belief, provenance, weight])

  // Validate on change
  useEffect(() => {
    if (hasChanges) {
      validate()
    }
  }, [hasChanges, validate])

  const handleApply = useCallback(() => {
    if (!selectedEdge || !validate()) return

    // Clamp and trim values
    const clampedBelief = clampBelief(belief)
    const trimmedProvenance = trimProvenance(provenance)

    // Update edge in store with safe defaults
    const current: EdgeData = selectedEdge.data ?? DEFAULT_EDGE_DATA
    updateEdge(selectedEdge.id, {
      data: {
        ...current,
        belief: clampedBelief,
        provenance: trimmedProvenance,
        weight,
      },
    })

    setHasChanges(false)
    setValidationErrors([])

    // TODO: Call /v1/validate API in next step
  }, [selectedEdge, belief, provenance, weight, updateEdge, validate])

  const handleReset = useCallback(() => {
    if (!selectedEdge) return

    setBelief(selectedEdge.data?.belief ?? 0.5)
    setProvenance(selectedEdge.data?.provenance ?? '')
    setWeight(selectedEdge.data?.weight ?? 1.0)
    setHasChanges(false)
    setValidationErrors([])
  }, [selectedEdge])

  const handleClose = useCallback(() => {
    onClose()
  }, [onClose])

  // Keyboard shortcut: Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, handleClose])

  // Focus management
  useEffect(() => {
    if (isOpen && panelRef.current) {
      const firstInput = panelRef.current.querySelector<HTMLInputElement>('input[type="range"]')
      firstInput?.focus()
    }
  }, [isOpen])

  if (!isOpen) return null

  // Footer with Apply and Reset buttons
  const footer = selectedEdge ? (
    <>
      <Tooltip content={hasChanges ? 'Reset changes' : 'No changes to reset'}>
        <span className="inline-block">
          <button
            onClick={handleReset}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            type="button"
            disabled={!hasChanges}
          >
            Reset
          </button>
        </span>
      </Tooltip>
      <Tooltip
        content={
          !hasChanges
            ? 'No changes to apply'
            : validationErrors.length > 0
            ? `Cannot apply: ${validationErrors[0]}`
            : 'Apply changes'
        }
      >
        <span className="inline-block flex-1">
          <button
            onClick={handleApply}
            className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            type="button"
            disabled={!hasChanges || validationErrors.length > 0}
          >
            Apply
          </button>
        </span>
      </Tooltip>
    </>
  ) : undefined

  return (
    <>
      {/* Backdrop (constrained to top/bottom bars so it never covers the toolbar) */}
      <div
        className="fixed inset-x-0 bg-black/50 z-[1999]"
        style={{ top: 'var(--topbar-h)', bottom: 'var(--bottombar-h)' }}
        onClick={handleClose}
      />

      {/* Panel Shell container (also respects top/bottom layout bars) */}
      <div
        className="fixed right-0 z-[2000]"
        ref={panelRef}
        style={{ top: 'var(--topbar-h)', bottom: 'var(--bottombar-h)' }}
      >
        <PanelShell
          icon={<Settings className="w-5 h-5" />}
          title="Inspector"
          onClose={handleClose}
          footer={footer}
          width="420px"
        >
          {/* Empty state or multi-selection message */}
          {!selectedEdge && (
            <div className="flex flex-col items-center justify-center py-12 text-center text-ink-900/70">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-sand-50">
                <Settings className="w-6 h-6 text-ink-900/50" aria-hidden="true" />
              </div>
              {hasMultipleEdges ? (
                <>
                  <p className="text-sm font-medium">Multiple edges selected</p>
                  <p className="mt-1 text-xs text-ink-900/60">
                    Inspector only supports editing one edge at a time. Select a single edge to continue.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium">Select an edge to inspect</p>
                  <p className="mt-1 text-xs text-ink-900/60">
                    Click an edge on the canvas to view and edit its metadata.
                  </p>
                </>
              )}
            </div>
          )}

          {/* Edge details */}
          {selectedEdge && (
            <>
              {/* Basic info */}
              <PanelSection title="Edge Details">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">ID</span>
                    <code className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">{selectedEdge.id}</code>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">From</span>
                    <code className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">{selectedEdge.source}</code>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">To</span>
                    <code className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">{selectedEdge.target}</code>
                  </div>
                  {selectedEdge.label && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Label</span>
                      <span className="text-xs">{selectedEdge.label}</span>
                    </div>
                  )}
                </div>
              </PanelSection>

              {/* Belief & confidence controls */}
              <PanelSection title="Belief & confidence">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <FieldLabel
                      label="Uncertainty level"
                      technicalTerm="Belief"
                      technicalDescription="0 = certain, 1 = maximum uncertainty"
                      htmlFor="belief-input"
                    />
                    <input
                      id="belief-input"
                      type="number"
                      aria-label="Uncertainty level"
                      value={belief.toFixed(2)}
                      onChange={(e) => {
                        const next = parseFloat(e.target.value)
                        setBelief(Number.isFinite(next) ? next : 0)
                      }}
                      className="w-24 px-2 py-1 text-sm text-right border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-600"
                      min={0}
                      max={1}
                      step={0.01}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>Confidence</span>
                      <span>{formatConfidencePercent(beliefToConfidencePercent(belief))}</span>
                    </div>
                    <input
                      id="belief-confidence-slider"
                      type="range"
                      aria-label="Belief / confidence"
                      value={belief}
                      onChange={(e) => {
                        const next = parseFloat(e.target.value)
                        setBelief(Number.isFinite(next) ? next : 0)
                      }}
                      className="w-full"
                      min={0}
                      max={1}
                      step={0.01}
                    />
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>0 (Very uncertain)</span>
                      <span>1 (Very certain)</span>
                    </div>
                  </div>
                </div>
              </PanelSection>

              {/* Influence slider (Phase 1A.2: renamed from Weight) */}
              <PanelSection title={EDGE_TERMINOLOGY.weight.userLabel}>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <FieldLabel
                      label={EDGE_TERMINOLOGY.weight.userLabel}
                      technicalTerm={EDGE_TERMINOLOGY.weight.technicalTerm}
                      technicalDescription={EDGE_TERMINOLOGY.weight.description}
                      htmlFor="influence-slider"
                    />
                    <input
                      type="number"
                      value={weight.toFixed(1)}
                      onChange={(e) => setWeight(parseFloat(e.target.value) || 1)}
                      className="w-20 px-2 py-1 text-sm text-right border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-600"
                      min={EDGE_CONSTRAINTS.weight.min}
                      max={EDGE_CONSTRAINTS.weight.max}
                      step={EDGE_CONSTRAINTS.weight.step}
                    />
                  </div>
                  <input
                    id="influence-slider"
                    type="range"
                    value={weight}
                    onChange={(e) => setWeight(parseFloat(e.target.value))}
                    className="w-full"
                    min={EDGE_CONSTRAINTS.weight.min}
                    max={EDGE_CONSTRAINTS.weight.max}
                    step={EDGE_CONSTRAINTS.weight.step}
                  />
                </div>
              </PanelSection>

              {/* Source (Phase 1A.2: renamed from Provenance) */}
              <PanelSection title={EDGE_TERMINOLOGY.provenance.userLabel}>
                <div className="space-y-2">
                  <FieldLabel
                    label={EDGE_TERMINOLOGY.provenance.userLabel}
                    technicalTerm={EDGE_TERMINOLOGY.provenance.technicalTerm}
                    technicalDescription={EDGE_TERMINOLOGY.provenance.description}
                    htmlFor="source-textarea"
                  />
                  <textarea
                    id="source-textarea"
                    value={provenance}
                    onChange={(e) => setProvenance(e.target.value)}
                    placeholder="Source or rationale for this connection..."
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 resize-none"
                    rows={3}
                    maxLength={EDGE_CONSTRAINTS.provenance.maxLength}
                  />
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Source/rationale</span>
                    <span className={provenance.length > EDGE_CONSTRAINTS.provenance.maxLength * 0.9 ? 'text-amber-600 font-medium' : 'text-gray-500'}>
                      {provenance.length}/{EDGE_CONSTRAINTS.provenance.maxLength}
                    </span>
                  </div>
                </div>
              </PanelSection>

              {/* Validation errors */}
              {validationErrors.length > 0 && (
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                  <div className="text-xs font-semibold text-amber-800 mb-2">Validation Issues:</div>
                  <ul className="space-y-1 text-xs text-amber-700">
                    {validationErrors.map((error, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span>•</span>
                        <span>{error}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </PanelShell>
      </div>
    </>
  )
}
