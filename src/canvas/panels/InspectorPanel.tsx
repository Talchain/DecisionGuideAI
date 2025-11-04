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
import { EDGE_CONSTRAINTS, clampBelief, trimProvenance } from '../domain/edges'
import type { Edge } from '@xyflow/react'
import type { EdgeData } from '../domain/edges'

interface InspectorPanelProps {
  isOpen: boolean
  onClose: () => void
}

export function InspectorPanel({ isOpen, onClose }: InspectorPanelProps): JSX.Element | null {
  const panelRef = useRef<HTMLDivElement>(null)
  const edges = useCanvasStore(state => state.edges)
  const selection = useCanvasStore(state => state.selection)
  const updateEdge = useCanvasStore(state => state.updateEdge)

  // Get selected edge (only support single-edge editing)
  const hasMultipleEdges = selection.edgeIds.size > 1
  const selectedEdgeId = selection.edgeIds.size === 1 ? Array.from(selection.edgeIds)[0] : null
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

    const original = selectedEdge.data || {}
    const changed =
      belief !== (original.belief ?? 0.5) ||
      provenance !== (original.provenance ?? '') ||
      weight !== (original.weight ?? 1.0)

    setHasChanges(changed)
  }, [belief, provenance, weight, selectedEdge])

  // Validate current state
  const validate = useCallback((): boolean => {
    const errors: string[] = []

    // Belief must be 0-1
    if (belief < 0 || belief > 1) {
      errors.push('Belief must be between 0 and 1')
    }

    // Weight must be 0.1-5.0 (visual) or 0-1 (API normalized)
    if (weight < EDGE_CONSTRAINTS.weight.min || weight > EDGE_CONSTRAINTS.weight.max) {
      errors.push(`Weight must be between ${EDGE_CONSTRAINTS.weight.min} and ${EDGE_CONSTRAINTS.weight.max}`)
    }

    // Provenance max length
    if (provenance.length > EDGE_CONSTRAINTS.provenance.maxLength) {
      errors.push(`Provenance must be ≤${EDGE_CONSTRAINTS.provenance.maxLength} characters`)
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

    // Update edge in store
    updateEdge(selectedEdge.id, {
      data: {
        ...selectedEdge.data,
        belief: clampedBelief,
        provenance: trimmedProvenance,
        weight,
      }
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
      <button
        onClick={handleReset}
        className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
        type="button"
        disabled={!hasChanges}
      >
        Reset
      </button>
      <button
        onClick={handleApply}
        className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        type="button"
        disabled={!hasChanges || validationErrors.length > 0}
      >
        Apply
      </button>
    </>
  ) : undefined

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-[1999]"
        onClick={handleClose}
      />

      {/* Panel Shell */}
      <div className="fixed right-0 top-0 bottom-0 z-[2000]" ref={panelRef}>
        <PanelShell
          icon={<Settings className="w-5 h-5" />}
          title="Inspector"
          onClose={handleClose}
          footer={footer}
          width="420px"
        >
          {/* Empty state or multi-selection message */}
          {!selectedEdge && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Settings className="w-12 h-12 text-gray-300 mb-4" />
              {hasMultipleEdges ? (
                <>
                  <p className="text-sm text-gray-600 mb-2">Multiple edges selected</p>
                  <p className="text-xs text-gray-500">
                    Inspector only supports editing one edge at a time. <br />
                    Select a single edge to continue.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm text-gray-600 mb-2">Select an edge to inspect</p>
                  <p className="text-xs text-gray-500">
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

              {/* Belief slider */}
              <PanelSection title="Belief (Epistemic Uncertainty)">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label htmlFor="belief-slider" className="text-sm text-gray-700">
                      Uncertainty level
                    </label>
                    <input
                      type="number"
                      value={belief.toFixed(2)}
                      onChange={(e) => setBelief(parseFloat(e.target.value) || 0)}
                      className="w-20 px-2 py-1 text-sm text-right border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-600"
                      min={EDGE_CONSTRAINTS.belief.min}
                      max={EDGE_CONSTRAINTS.belief.max}
                      step={EDGE_CONSTRAINTS.belief.step}
                    />
                  </div>
                  <input
                    id="belief-slider"
                    type="range"
                    value={belief}
                    onChange={(e) => setBelief(parseFloat(e.target.value))}
                    className="w-full"
                    min={EDGE_CONSTRAINTS.belief.min}
                    max={EDGE_CONSTRAINTS.belief.max}
                    step={EDGE_CONSTRAINTS.belief.step}
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Certain (0)</span>
                    <span>Maximum uncertainty (1)</span>
                  </div>
                </div>
              </PanelSection>

              {/* Weight slider */}
              <PanelSection title="Weight">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label htmlFor="weight-slider" className="text-sm text-gray-700">
                      Edge weight
                    </label>
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
                    id="weight-slider"
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

              {/* Provenance */}
              <PanelSection title="Provenance">
                <div className="space-y-2">
                  <textarea
                    value={provenance}
                    onChange={(e) => setProvenance(e.target.value)}
                    placeholder="Source or rationale for this edge..."
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
