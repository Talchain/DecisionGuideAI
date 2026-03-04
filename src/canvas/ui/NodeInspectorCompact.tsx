/**
 * @deprecated Phase 2 (S.1) removed compact inspector routing — single-click
 * now opens the full 4-section inspector directly. This file is retained
 * temporarily to avoid import breakage. Safe to delete once all references
 * are confirmed removed. See commit 8320510e.
 *
 * Compact node inspector for contextual popover
 * Shows: node icon, type label, node label (read-only), key metric, expand button.
 * No structural editing controls (type/label change requires full inspector).
 * British English: visualisation, colour
 */

import { memo, useCallback, useRef, useEffect, useMemo } from 'react'
import { Maximize2, AlertTriangle, ArrowRight } from 'lucide-react'
import { useCanvasStore } from '../store'
import { NODE_REGISTRY } from '../domain/nodes'
import type { NodeType } from '../domain/nodes'
import { renderIcon } from '../helpers/renderIcon'
import { useNodeDisplayMetadata } from '../hooks/useNodeDisplayMetadata'
import { typography } from '../../styles/typography'

interface NodeInspectorCompactProps {
  nodeId: string
  onClose: () => void
  onExpandToFull: () => void
}

interface InterventionRow {
  factorId: string
  factorLabel: string
  value: number
  unit: string
}

export const NodeInspectorCompact = memo(({ nodeId, onClose, onExpandToFull }: NodeInspectorCompactProps) => {
  const nodes = useCanvasStore(s => s.nodes)
  const setHighlightedNodes = useCanvasStore(s => s.setHighlightedNodes)

  const node = nodes.find(n => n.id === nodeId)
  const currentType = (node?.type || 'decision') as NodeType
  const isOptionNode = currentType === 'option'

  // Get display metadata for insights section (only meaningful for factors in Results mode)
  const displayMetadata = useNodeDisplayMetadata(nodeId, currentType)

  // Get interventions for option nodes
  // Unit precedence: intervention_unit → observed_state.unit → null
  const interventionRows = useMemo<InterventionRow[]>(() => {
    if (!isOptionNode) return []
    const interventions = node?.data?.interventions as Record<string, number> | undefined
    if (!interventions) return []

    return Object.entries(interventions).map(([factorId, value]) => {
      const factorNode = nodes.find(n => n.id === factorId)
      const factorLabel = factorNode?.data?.label || factorId
      // Task 4: Unit precedence - intervention_unit → observed_state.unit → ''
      const factorData = factorNode?.data as any
      const observedState = factorData?.observedState ?? factorData?.observed_state
      const unit = factorData?.intervention_unit ?? observedState?.unit ?? ''
      return { factorId, factorLabel, value, unit }
    })
  }, [isOptionNode, node?.data?.interventions, nodes])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }, [onClose])

  // Task 6: Debounced hover highlight for intervention rows (50ms delay)
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleInterventionHover = useCallback((factorId: string | null) => {
    // Clear any pending timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = null
    }

    if (factorId) {
      // Debounce highlight on enter
      hoverTimeoutRef.current = setTimeout(() => {
        setHighlightedNodes([factorId])
      }, 50)
    } else {
      // Clear immediately on leave
      setHighlightedNodes([])
    }
  }, [setHighlightedNodes])

  // Cleanup hover timeout on unmount to prevent stale highlights
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current)
      }
    }
  }, [])

  // Format intervention value with unit
  // Task 4: "sets to [value]" format when no unit
  const formatInterventionValue = useCallback((value: number, unit: string): string => {
    if (!unit) {
      return `sets to ${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
    }

    switch (unit.toLowerCase()) {
      case 'gbp':
      case '£':
        return `£${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
      case 'usd':
      case '$':
        return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
      case 'eur':
      case '€':
        return `€${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
      case 'percent':
      case '%':
        return `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`
      default:
        return `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${unit}`
    }
  }, [])

  if (!node) return null

  const metadata = NODE_REGISTRY[currentType] || NODE_REGISTRY.decision

  return (
    <div
      className="p-3 bg-panel rounded-lg shadow-3 border border-panel-border"
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-label="Node properties"
      aria-labelledby="compact-node-inspector-title"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-panel-border">
        <div className="flex items-center gap-2">
          {renderIcon(metadata.icon, 16) ?? <span aria-hidden="true">•</span>}
          <span
            id="compact-node-inspector-title"
            className={`${typography.panelMeta} text-text-body min-w-0`}
          >
            {metadata.label}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onExpandToFull}
            className="p-1 text-text-light hover:text-text-body rounded"
            aria-label="Expand to full inspector"
            title="Expand"
          >
            <Maximize2 size={14} />
          </button>
          <button
            onClick={onClose}
            className={`p-1 text-text-light hover:text-text-body rounded ${typography.panelHeader} leading-none`}
            aria-label="Close"
          >
            ×
          </button>
        </div>
      </div>

      {/* Node label — 1 line, truncated */}
      <p
        className={`${typography.panelBody} text-text-body truncate mb-2`}
        title={String(node.data?.label ?? '')}
      >
        {node.data?.label || 'Untitled'}
      </p>

      {/* Key metric: Factor current value */}
      {currentType === 'factor' && (node.data?.observedState as any)?.value !== undefined && (
        <div className="flex items-center justify-between px-2 py-1 bg-panel rounded border border-panel-border mb-2">
          <span className={`${typography.panelMeta} text-text-light`}>Current value</span>
          <span className={`${typography.panelMeta} text-text-body tabular-nums`}>
            {(node.data?.observedState as any).value}
          </span>
        </div>
      )}

      {/* Factor Insights (only for factors in Results mode) */}
      {currentType === 'factor' && displayMetadata.isResultsMode && (
        <div className="mb-3 pt-2 border-t border-panel-border">
          <h4 className={`${typography.panelMeta} text-text-body mb-2 flex items-center gap-2`}>
            Insights
            {displayMetadata.sensitivityRank !== null && (
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded ${typography.panelMeta} bg-warning-light text-warning`}>
                #{displayMetadata.sensitivityRank}
              </span>
            )}
          </h4>

          {/* Not in sensitivity analysis (e.g., root "Value" node) */}
          {!displayMetadata.inSensitivityAnalysis && (
            <p className={`${typography.panelMeta} text-text-light italic`}>
              Insights not available for this factor
            </p>
          )}

          {/* In sensitivity analysis - show actual values */}
          {displayMetadata.inSensitivityAnalysis && (
            <>
              {/* Influence bar */}
              {displayMetadata.influence !== null && (
                <div className="mb-2">
                  <div className="flex justify-between items-center mb-1">
                    <span className={`${typography.panelMeta} text-text-light`}>Influence</span>
                    <span className={`${typography.panelMeta} text-text-body`}>
                      {Math.round(displayMetadata.influence * 100)}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-panel-border rounded-full overflow-hidden">
                    <div
                      className="h-full bg-info rounded-full transition-all duration-300"
                      style={{ width: `${Math.max(displayMetadata.influence * 100, 2)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Confidence bar */}
              {displayMetadata.confidence !== null && (
                <div className="mb-2">
                  <div className="flex justify-between items-center mb-1">
                    <span className={`${typography.panelMeta} text-text-light`}>Confidence</span>
                    <span className={`${typography.panelMeta} text-text-body`}>
                      {Math.round(displayMetadata.confidence * 100)}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-panel-border rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        displayMetadata.confidence < 0.5 ? 'bg-warning' : 'bg-success'
                      }`}
                      style={{ width: `${Math.max(displayMetadata.confidence * 100, 2)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Coaching hint for high-influence low-confidence factors */}
              {displayMetadata.influence !== null &&
               displayMetadata.confidence !== null &&
               displayMetadata.influence >= 0.7 &&
               displayMetadata.confidence < 0.5 && (
                <div className={`flex items-start gap-1.5 p-2 bg-warning-light border border-warning/30 rounded ${typography.panelMeta} text-warning`}>
                  <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
                  <span>High influence but low confidence. Consider gathering more data to reduce uncertainty.</span>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Interventions section for Option nodes */}
      {isOptionNode && (
        <div className="pt-2 border-t border-panel-border">
          <h4 className={`${typography.panelMeta} text-text-body mb-2`}>Interventions</h4>

          {/* Mode-aware empty state for baseline options */}
          {interventionRows.length === 0 ? (
            <p className={`${typography.panelMeta} text-text-light italic`}>
              {displayMetadata.isResultsMode
                ? 'No interventions — this option represents the baseline'
                : 'No interventions — this option maintains current values'}
            </p>
          ) : (
            <div className="space-y-1.5">
              {interventionRows.map((row) => (
                <div
                  key={row.factorId}
                  className="flex items-center gap-2 hover:bg-panel-hover rounded px-1 py-0.5 -mx-1 transition-colors cursor-default"
                  onMouseEnter={() => handleInterventionHover(row.factorId)}
                  onMouseLeave={() => handleInterventionHover(null)}
                >
                  <ArrowRight size={10} className="flex-shrink-0 text-text-light" aria-hidden="true" />
                  <span className={`${typography.panelBody} text-text-body flex-1 min-w-0 truncate`} title={row.factorLabel}>
                    {row.factorLabel}
                  </span>
                  <span className={`${typography.panelBody} text-text-body flex-shrink-0`}>
                    {formatInterventionValue(row.value, row.unit)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
})

NodeInspectorCompact.displayName = 'NodeInspectorCompact'
