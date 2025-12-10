/**
 * ThresholdDisplay - Shows identified critical thresholds/tipping points
 *
 * Displays thresholds where small input changes cause large outcome shifts:
 * - Edge function thresholds (step functions, S-curves)
 * - High-sensitivity nodes from conformal analysis
 * - CEE-suggested thresholds (when available)
 *
 * Features:
 * - Collapsible panel with summary header
 * - Visual threshold indicator
 * - Click to focus on source node/edge in canvas
 * - Provenance badges showing data source
 */

import { memo, useState, useCallback, useMemo } from 'react'
import {
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  TrendingUp,
  Zap,
  Target,
  ArrowRight,
} from 'lucide-react'
import { useCanvasStore } from '../store'
import { focusNodeById, focusEdgeById } from '../utils/focusHelpers'
import { typography } from '../../styles/typography'
import { ProvenanceBadge } from './ProvenanceBadge'
import { useISLConformal } from '../../hooks/useISLConformal'
import { buildRichGraphPayload } from '../utils/graphPayload'
import {
  identifyThresholds,
  formatThresholdValue,
  type IdentifiedThreshold,
} from '../utils/thresholdIdentification'

interface ThresholdDisplayProps {
  /** Start expanded */
  defaultExpanded?: boolean
  /** Maximum thresholds to show */
  maxVisible?: number
}

// Impact styling
const impactConfig: Record<'high' | 'medium' | 'low', {
  bgColor: string
  borderColor: string
  textColor: string
  label: string
}> = {
  high: {
    bgColor: 'bg-carrot-50',
    borderColor: 'border-carrot-200',
    textColor: 'text-carrot-700',
    label: 'High impact',
  },
  medium: {
    bgColor: 'bg-banana-50',
    borderColor: 'border-banana-200',
    textColor: 'text-banana-700',
    label: 'Medium impact',
  },
  low: {
    bgColor: 'bg-sand-50',
    borderColor: 'border-sand-200',
    textColor: 'text-sand-600',
    label: 'Low impact',
  },
}

// Type icon mapping
const typeIcons: Record<IdentifiedThreshold['type'], typeof AlertTriangle> = {
  edge_function: Target,
  sensitivity: TrendingUp,
  cee_suggested: Zap,
}

export const ThresholdDisplay = memo(function ThresholdDisplay({
  defaultExpanded = false,
  maxVisible = 5,
}: ThresholdDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  const nodes = useCanvasStore((s) => s.nodes)
  const edges = useCanvasStore((s) => s.edges)
  const results = useCanvasStore((s) => s.results)
  const setHighlightedNodes = useCanvasStore((s) => s.setHighlightedNodes)
  const setHighlightedEdges = useCanvasStore((s) => s.setHighlightedEdges)

  // Get conformal predictions if available
  const { data: conformalData } = useISLConformal()

  // Identify thresholds from current graph state
  const { thresholds, summary } = useMemo(() => {
    if (nodes.length === 0 || edges.length === 0) {
      return { thresholds: [], summary: 'Build your model to identify thresholds' }
    }

    return identifyThresholds(
      nodes,
      edges,
      conformalData?.predictions
    )
  }, [nodes, edges, conformalData])

  // Visible thresholds (limited)
  const visibleThresholds = useMemo(() =>
    thresholds.slice(0, maxVisible),
    [thresholds, maxVisible]
  )

  const hiddenCount = thresholds.length - visibleThresholds.length

  // Focus handler
  const handleFocus = useCallback((threshold: IdentifiedThreshold) => {
    if (!threshold.sourceId) return

    if (threshold.sourceType === 'node') {
      setHighlightedNodes([threshold.sourceId])
      focusNodeById(threshold.sourceId)
      setTimeout(() => setHighlightedNodes([]), 3000)
    } else if (threshold.sourceType === 'edge') {
      setHighlightedEdges([threshold.sourceId])
      focusEdgeById(threshold.sourceId)
      setTimeout(() => setHighlightedEdges([]), 3000)
    }
  }, [setHighlightedNodes, setHighlightedEdges])

  // Don't render if no analysis run yet
  const hasResults = results?.status === 'complete' || results?.status === 'success'
  if (!hasResults && thresholds.length === 0) {
    return null
  }

  // Empty state
  if (thresholds.length === 0) {
    return (
      <div
        className="p-4 bg-sand-50 border border-sand-200 rounded-xl"
        data-testid="threshold-display-empty"
      >
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-sand-400 flex-shrink-0" aria-hidden="true" />
          <div>
            <p className={`${typography.body} text-sand-600`}>No critical thresholds</p>
            <p className={`${typography.caption} text-sand-500`}>
              {summary}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="bg-paper-50 border border-sand-200 rounded-xl overflow-hidden"
      data-testid="threshold-display"
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-sand-50 transition-colors"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-3">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-ink-500" />
          ) : (
            <ChevronRight className="h-4 w-4 text-ink-500" />
          )}
          <AlertTriangle className="h-4 w-4 text-carrot-500" aria-hidden="true" />
          <span className={`${typography.body} font-medium text-ink-800`}>
            Critical Thresholds
          </span>
        </div>

        <span className={`${typography.caption} text-ink-500`}>
          {thresholds.length} identified
        </span>
      </button>

      {/* Threshold list */}
      {isExpanded && (
        <div className="border-t border-sand-200 divide-y divide-sand-100">
          {visibleThresholds.map((threshold) => {
            const impact = impactConfig[threshold.impactMagnitude || 'low']
            const TypeIcon = typeIcons[threshold.type]
            const hasTarget = threshold.sourceId

            return (
              <div
                key={threshold.id}
                className={`px-4 py-3 ${hasTarget ? 'cursor-pointer hover:bg-sand-50' : ''} transition-colors`}
                onClick={hasTarget ? () => handleFocus(threshold) : undefined}
                role={hasTarget ? 'button' : undefined}
                tabIndex={hasTarget ? 0 : undefined}
                onKeyDown={(e) => {
                  if (hasTarget && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault()
                    handleFocus(threshold)
                  }
                }}
              >
                <div className="flex items-start gap-3">
                  {/* Type icon */}
                  <div className={`p-1.5 rounded ${impact.bgColor} flex-shrink-0`}>
                    <TypeIcon className={`h-4 w-4 ${impact.textColor}`} aria-hidden="true" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {/* Header row */}
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className={`${typography.body} text-ink-800 truncate`}>
                        {threshold.label}
                      </span>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`${typography.caption} font-semibold ${impact.textColor}`}>
                          {formatThresholdValue(threshold.thresholdValue)}
                        </span>
                        <ProvenanceBadge
                          type={threshold.provenance === 'cee' ? 'ai-suggested' : 'inferred'}
                          compact
                        />
                      </div>
                    </div>

                    {/* Description */}
                    <p className={`${typography.caption} text-ink-600 mb-2`}>
                      {threshold.description}
                    </p>

                    {/* Effect visualization */}
                    <div className="flex items-center gap-2 text-xs">
                      <span className={`px-2 py-1 rounded bg-sky-50 text-sky-700`}>
                        Below: {threshold.belowEffect}
                      </span>
                      <ArrowRight className="h-3 w-3 text-ink-400" aria-hidden="true" />
                      <span className={`px-2 py-1 rounded ${impact.bgColor} ${impact.textColor}`}>
                        Above: {threshold.aboveEffect}
                      </span>
                    </div>

                    {/* Focus hint */}
                    {hasTarget && (
                      <span className={`${typography.caption} text-sky-600 mt-2 block`}>
                        Click to focus on {threshold.sourceType}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}

          {/* Hidden count footer */}
          {hiddenCount > 0 && (
            <div className="px-4 py-2 bg-sand-50">
              <span className={`${typography.caption} text-ink-500`}>
                +{hiddenCount} more threshold{hiddenCount !== 1 ? 's' : ''}
              </span>
            </div>
          )}

          {/* Confidence note */}
          <div className="px-4 py-2 bg-sand-50 border-t border-sand-200">
            <span className={`${typography.caption} text-ink-500`}>
              Thresholds identify where small input changes cause large outcome shifts
            </span>
          </div>
        </div>
      )}
    </div>
  )
})
