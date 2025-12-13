import { useEffect, useState, useRef, useMemo } from 'react'
import { AlertCircle, CheckCircle, AlertTriangle, Wrench, Eye, RefreshCw } from 'lucide-react'
import { useISLValidation } from '../../hooks/useISLValidation'
import { useCanvasStore } from '../store'
import { typography } from '../../styles/typography'
import { Spinner } from '../../components/Spinner'
import type { ISLValidationSuggestion } from '../../adapters/isl/types'
import { buildRichGraphPayload } from '../utils/graphPayload'
import { getSeverityClasses } from '../utils/severityMapping'

/**
 * Simple hash of graph structure for change detection
 * Only re-validate when graph content actually changes
 */
function computeGraphHash(nodes: unknown[], edges: unknown[]): string {
  // Use JSON stringify of IDs and key data for lightweight hashing
  const nodeIds = nodes.map((n: any) => `${n.id}:${n.type}:${n.data?.label ?? ''}`).sort().join('|')
  const edgeIds = edges.map((e: any) => `${e.source}->${e.target}`).sort().join('|')
  return `${nodeIds}::${edgeIds}`
}

export function ValidationSuggestionsSection() {
  // React #185 FIX: Use shallow comparison for array selectors
  const nodes = useCanvasStore(s => s.nodes)
  const edges = useCanvasStore(s => s.edges)
  const { data, loading, error, validate } = useISLValidation()

  // Track last validated graph hash to avoid redundant requests
  const lastValidatedHashRef = useRef<string | null>(null)
  // Track if we hit a persistent error (4xx) to stop auto-retry
  const persistentErrorRef = useRef(false)
  // Manual retry trigger
  const [retryCount, setRetryCount] = useState(0)

  // Compute current graph hash
  const currentHash = useMemo(
    () => computeGraphHash(nodes, edges),
    [nodes, edges]
  )

  // Reset persistent error flag when graph changes substantially
  useEffect(() => {
    if (lastValidatedHashRef.current !== currentHash) {
      persistentErrorRef.current = false
    }
  }, [currentHash])

  // Auto-validate on graph changes (debounced) - with retry protection
  useEffect(() => {
    // Skip if: no nodes, already loading, hash unchanged, or persistent error
    if (
      nodes.length === 0 ||
      loading ||
      lastValidatedHashRef.current === currentHash ||
      persistentErrorRef.current
    ) {
      return
    }

    const timer = setTimeout(() => {
      lastValidatedHashRef.current = currentHash
      validate({
        graph: buildRichGraphPayload(nodes, edges),
      }).catch((err) => {
        // Mark as persistent error for 4xx responses to stop auto-retry
        if (err?.status >= 400 && err?.status < 500) {
          persistentErrorRef.current = true
        }
        console.error('ISL validation failed:', err)
      })
    }, 1000)

    return () => clearTimeout(timer)
  }, [nodes, edges, validate, loading, currentHash, retryCount])

  // Manual retry handler
  const handleRetry = () => {
    persistentErrorRef.current = false
    lastValidatedHashRef.current = null
    setRetryCount(c => c + 1)
  }

  if (nodes.length === 0) {
    return (
      <div className="p-4">
        <p className={`${typography.body} text-ink-900/50 text-center py-8`}>
          Add nodes to your graph to see validation suggestions
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h3 className={typography.h4}>Validation</h3>
        {loading && <Spinner size="sm" />}
      </div>

      {data && (
        <>
          {/* Health Summary */}
          <div className="grid grid-cols-3 gap-2">
            <HealthMetric
              label="Complete"
              value={data.graph_health.completeness}
            />
            <HealthMetric
              label="Connected"
              value={data.graph_health.connectivity}
            />
            <HealthMetric
              label="Logical"
              value={data.graph_health.logical_consistency}
            />
          </div>

          {/* Suggestions */}
          {data.suggestions.length > 0 ? (
            <div className="space-y-2">
              <h4 className={typography.label}>Suggestions ({data.suggestions.length})</h4>
              {data.suggestions.map(suggestion => (
                <SuggestionCard key={suggestion.id} suggestion={suggestion} />
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 p-3 bg-mint-50 border border-mint-200 rounded-lg">
              <CheckCircle className="w-5 h-5 text-mint-600" />
              <span className={`${typography.body} text-mint-800`}>
                All validation checks passed
              </span>
            </div>
          )}
        </>
      )}

      {error && (
        <div className="p-3 bg-carrot-50 border border-carrot-200 rounded-lg">
          <p className={`${typography.body} text-carrot-800`}>
            Failed to validate: {error.message}
          </p>
          <button
            onClick={handleRetry}
            className={`${typography.button} mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-carrot-300 text-carrot-700 hover:bg-carrot-100 transition-colors`}
          >
            <RefreshCw className="w-3 h-3" />
            Retry
          </button>
        </div>
      )}
    </div>
  )
}

interface HealthMetricProps {
  label: string
  value: number
}

// Tailwind-safe class mappings for health metrics
const getHealthClasses = (value: number) => {
  if (value >= 0.8) {
    return {
      container: 'bg-mint-50 border-mint-200',
      heading: 'text-mint-700',
      caption: 'text-mint-600',
    }
  } else if (value >= 0.5) {
    return {
      container: 'bg-sun-50 border-sun-200',
      heading: 'text-sun-700',
      caption: 'text-sun-600',
    }
  } else {
    return {
      container: 'bg-carrot-50 border-carrot-200',
      heading: 'text-carrot-700',
      caption: 'text-carrot-600',
    }
  }
}

function HealthMetric({ label, value }: HealthMetricProps) {
  const percentage = Math.round(value * 100)
  const classes = getHealthClasses(value)

  return (
    <div className={`p-2 rounded border ${classes.container}`}>
      <div className={`${typography.h3} ${classes.heading} font-bold`}>
        {percentage}%
      </div>
      <div className={`${typography.caption} ${classes.caption}`}>
        {label}
      </div>
    </div>
  )
}

interface SuggestionCardProps {
  suggestion: ISLValidationSuggestion
}

// Tailwind-safe class mappings imported from ../utils/severityMapping

function SuggestionCard({ suggestion }: SuggestionCardProps) {
  const [isHighlighting, setIsHighlighting] = useState(false)

  const iconMap = {
    error: AlertCircle,
    warning: AlertTriangle,
    info: CheckCircle,
  }

  const Icon = iconMap[suggestion.severity]
  const classes = getSeverityClasses(suggestion.severity)

  const handleHighlight = () => {
    setIsHighlighting(!isHighlighting)
    // Phase 1A.4: Highlight affected nodes visually
    // This would ideally update node styling, but for now we show the button state
    if (import.meta.env.DEV && suggestion.affectedNodes.length > 0) {
      console.log('Highlighting nodes:', suggestion.affectedNodes)
    }
  }

  const handleQuickFix = () => {
    if (!suggestion.quickFix) return
    if (import.meta.env.DEV) {
      console.log('Quick fix:', suggestion.quickFix)
    }
    // TODO: Implement quick fix actions
    // - add_edge: Create edge between nodes
    // - add_node: Create new node
    // - update_data: Update node data
    // - remove_node: Remove node
  }

  return (
    <div className={`p-3 rounded border ${classes.container}`}>
      <div className="flex items-start gap-3">
        <Icon className={`w-5 h-5 ${classes.icon} flex-shrink-0 mt-0.5`} />
        <div className="flex-1 space-y-2">
          <p className={`${typography.body} ${classes.text}`}>
            {suggestion.message}
          </p>

          {suggestion.affectedNodes.length > 0 && (
            <p className={`${typography.caption} ${classes.caption}`}>
              Affects: {suggestion.affectedNodes.join(', ')}
            </p>
          )}

          {/* Phase 1A.4: Highlight button for affected nodes */}
          <div className="flex gap-2 mt-2">
            {suggestion.affectedNodes.length > 0 && (
              <button
                onClick={handleHighlight}
                className={`
                  ${typography.button} inline-flex items-center gap-1 px-3 py-1.5 rounded border
                  ${isHighlighting
                    ? `${classes.button} text-white`
                    : 'border-ink-300 text-ink-700 hover:bg-ink-50'
                  }
                  transition-colors
                `}
                title="Highlight affected nodes on canvas"
              >
                <Eye className="w-3 h-3" />
                {isHighlighting ? 'Unhighlight' : 'Highlight'}
              </button>
            )}

            {suggestion.quickFix && (
              <button
                onClick={handleQuickFix}
                className={`
                  ${typography.button} inline-flex items-center gap-1 px-3 py-1.5 rounded
                  ${classes.button} text-white transition-colors
                `}
              >
                <Wrench className="w-3 h-3" />
                {suggestion.quickFix.label}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
