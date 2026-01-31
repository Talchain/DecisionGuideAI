/**
 * InterventionDisplay Component (Phase 1.2)
 *
 * Displays the interventions (causal changes) for an option.
 * Units are derived from the target NODE, not stored on the intervention.
 *
 * Shows:
 * - Target variable name
 * - Intervention value with unit
 * - Source indicator (from brief, user set, inferred)
 * - Low confidence warning if applicable
 */

import { AlertTriangle, ArrowRight, Info } from 'lucide-react'
import type { Node } from '@xyflow/react'
import { typography } from '../../styles/typography'
import type { UIInterventionValue } from '../../types/options'

// ============================================================================
// Types
// ============================================================================

interface InterventionDisplayProps {
  /** Map of node IDs to intervention values */
  interventions: Record<string, UIInterventionValue>
  /** Canvas nodes for looking up labels and units */
  nodes: Node[]
  /** Compact display mode */
  compact?: boolean
  /** Max interventions to show before "and N more" */
  maxVisible?: number
}

interface NodeData {
  label?: string
  // Support both camelCase and snake_case for observed state
  observedState?: {
    value?: number
    baseline?: number
    unit?: string
  }
  observed_state?: {
    value?: number
    baseline?: number
    unit?: string
  }
  // Unit precedence: intervention_unit takes priority
  intervention_unit?: string
}

// ============================================================================
// Formatting Helpers
// ============================================================================

/**
 * Format a value with its unit.
 * Unit comes from the target NODE, not the intervention.
 * Task 4: "sets to [value]" format when no unit
 */
function formatValue(value: number, unit?: string): string {
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
}

/**
 * Format the source of an intervention value.
 */
function formatSource(source: UIInterventionValue['source']): string {
  switch (source) {
    case 'brief_extraction':
      return 'from brief'
    case 'user_specified':
      return 'you set this'
    case 'cee_hypothesis':
      return 'inferred'
    default:
      return source
  }
}

/**
 * Get CSS class for source badge.
 */
function getSourceClass(source: UIInterventionValue['source']): string {
  switch (source) {
    case 'brief_extraction':
      return 'bg-sky-100 text-sky-700'
    case 'user_specified':
      return 'bg-mint-100 text-mint-700'
    case 'cee_hypothesis':
      return 'bg-banana-100 text-banana-700'
    default:
      return 'bg-sand-100 text-sand-600'
  }
}

// ============================================================================
// Component
// ============================================================================

export function InterventionDisplay({
  interventions,
  nodes,
  compact = false,
  maxVisible = 5,
}: InterventionDisplayProps) {
  const entries = Object.entries(interventions)

  // Empty state
  if (entries.length === 0) {
    return (
      <div
        className={`flex items-center gap-2 ${
          compact ? 'text-xs' : ''
        } text-carrot-600`}
        data-testid="intervention-empty"
      >
        <AlertTriangle className={compact ? 'h-3 w-3' : 'h-4 w-4'} />
        <span>No interventions specified</span>
      </div>
    )
  }

  // Create a lookup for node data
  const nodeMap = new Map(nodes.map((n) => [n.id, n.data as NodeData]))

  // Determine visible entries
  const visibleEntries = entries.slice(0, maxVisible)
  const hiddenCount = entries.length - visibleEntries.length

  if (compact) {
    return (
      <div className="flex flex-wrap gap-1.5" data-testid="intervention-display-compact">
        {visibleEntries.map(([nodeId, intervention]) => {
          const nodeData = nodeMap.get(nodeId)
          const label = nodeData?.label ?? nodeId
          // Unit precedence: intervention_unit → observedState.unit → observed_state.unit
          const unit = nodeData?.intervention_unit ?? nodeData?.observedState?.unit ?? nodeData?.observed_state?.unit

          return (
            <span
              key={nodeId}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-sand-100 rounded text-xs"
              title={`${label} → ${formatValue(intervention.value, unit)} (${formatSource(intervention.source)})`}
            >
              <span className="text-ink-600 truncate max-w-[80px]">{label}</span>
              <ArrowRight className="h-3 w-3 text-ink-400" />
              <span className="font-medium text-ink-800">
                {formatValue(intervention.value, unit)}
              </span>
              {intervention.value_confidence === 'low' && (
                <AlertTriangle className="h-3 w-3 text-banana-500" />
              )}
            </span>
          )
        })}
        {hiddenCount > 0 && (
          <span className="inline-flex items-center px-2 py-0.5 bg-sand-50 rounded text-xs text-ink-500">
            +{hiddenCount} more
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-2" data-testid="intervention-display">
      <div className="flex items-center gap-2">
        <span className={`${typography.caption} font-medium text-ink-600 uppercase tracking-wide`}>
          Changes
        </span>
        <Info className="h-3 w-3 text-ink-400" />
      </div>

      <div className="space-y-1.5">
        {visibleEntries.map(([nodeId, intervention]) => {
          const nodeData = nodeMap.get(nodeId)
          const label = nodeData?.label ?? nodeId
          // Unit precedence: intervention_unit → observedState.unit → observed_state.unit
          const unit = nodeData?.intervention_unit ?? nodeData?.observedState?.unit ?? nodeData?.observed_state?.unit

          return (
            <div
              key={nodeId}
              className="flex items-center justify-between gap-2 px-3 py-2 bg-sand-50 rounded-lg"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className={`${typography.bodySmall} text-ink-700 truncate`}>
                  {label}
                </span>
                <ArrowRight className="h-4 w-4 text-ink-400 flex-shrink-0" />
                <span className={`${typography.body} font-semibold text-ink-900`}>
                  {formatValue(intervention.value, unit)}
                </span>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <span
                  className={`${typography.caption} px-1.5 py-0.5 rounded ${getSourceClass(
                    intervention.source
                  )}`}
                >
                  {formatSource(intervention.source)}
                </span>
                {intervention.value_confidence === 'low' && (
                  <span
                    className="text-banana-500"
                    title="Low confidence estimate"
                  >
                    <AlertTriangle className="h-4 w-4" />
                  </span>
                )}
              </div>
            </div>
          )
        })}

        {hiddenCount > 0 && (
          <div className="px-3 py-2 text-center">
            <span className={`${typography.caption} text-ink-500`}>
              and {hiddenCount} more intervention{hiddenCount > 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>

      {/* Match confidence summary if any low confidence */}
      {entries.some(([, iv]) => iv.target_match?.confidence === 'low') && (
        <div className="flex items-start gap-2 px-3 py-2 bg-banana-50 rounded-lg">
          <Info className="h-4 w-4 text-banana-600 flex-shrink-0 mt-0.5" />
          <p className={`${typography.caption} text-banana-700`}>
            Some interventions were matched with low confidence. Consider reviewing
            the target variables.
          </p>
        </div>
      )}
    </div>
  )
}

/**
 * Simple inline intervention summary for headers/lists.
 */
export function InterventionSummary({
  interventions,
  nodes,
}: {
  interventions: Record<string, UIInterventionValue>
  nodes: Node[]
}) {
  const count = Object.keys(interventions).length

  if (count === 0) {
    return (
      <span className="text-carrot-600 text-xs">No interventions</span>
    )
  }

  // Show first intervention as preview
  const [firstId, firstIntervention] = Object.entries(interventions)[0]
  const nodeData = nodes.find((n) => n.id === firstId)?.data as NodeData | undefined
  const label = nodeData?.label ?? firstId
  // Unit precedence: intervention_unit → observedState.unit → observed_state.unit
  const unit = nodeData?.intervention_unit ?? nodeData?.observedState?.unit ?? nodeData?.observed_state?.unit

  if (count === 1) {
    return (
      <span className="text-ink-600 text-xs">
        {label} → {formatValue(firstIntervention.value, unit)}
      </span>
    )
  }

  return (
    <span className="text-ink-600 text-xs">
      {label} → {formatValue(firstIntervention.value, unit)}{' '}
      <span className="text-ink-400">+{count - 1} more</span>
    </span>
  )
}
