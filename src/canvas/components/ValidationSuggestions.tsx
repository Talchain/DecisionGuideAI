import { useEffect } from 'react'
import { AlertCircle, CheckCircle, AlertTriangle, Wrench } from 'lucide-react'
import { useISLValidation } from '../../hooks/useISLValidation'
import { useCanvasStore } from '../store'
import { typography } from '../../styles/typography'
import { Spinner } from '../../components/Spinner'
import type { ISLValidationSuggestion } from '../../adapters/isl/types'
import { buildRichGraphPayload } from '../utils/graphPayload'

export function ValidationSuggestionsSection() {
  const nodes = useCanvasStore(s => s.nodes)
  const edges = useCanvasStore(s => s.edges)
  const { data, loading, error, validate } = useISLValidation()

  // Auto-validate on graph changes (debounced)
  useEffect(() => {
    if (nodes.length === 0 || loading) return

    const timer = setTimeout(() => {
      validate({
        graph: buildRichGraphPayload(nodes, edges),
      }).catch(console.error)
    }, 1000)

    return () => clearTimeout(timer)
  }, [nodes, edges, validate, loading])

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

// Tailwind-safe class mappings for suggestion severity
const getSeverityClasses = (severity: 'error' | 'warning' | 'info') => {
  const classMap = {
    error: {
      container: 'border-carrot-200 bg-carrot-50',
      icon: 'text-carrot-600',
      text: 'text-carrot-900',
      caption: 'text-carrot-700',
      button: 'bg-carrot-500 hover:bg-carrot-600',
    },
    warning: {
      container: 'border-sun-200 bg-sun-50',
      icon: 'text-sun-600',
      text: 'text-sun-900',
      caption: 'text-sun-700',
      button: 'bg-sun-500 hover:bg-sun-600',
    },
    info: {
      container: 'border-sky-200 bg-sky-50',
      icon: 'text-sky-600',
      text: 'text-sky-900',
      caption: 'text-sky-700',
      button: 'bg-sky-500 hover:bg-sky-600',
    },
  }
  return classMap[severity]
}

function SuggestionCard({ suggestion }: SuggestionCardProps) {
  const iconMap = {
    error: AlertCircle,
    warning: AlertTriangle,
    info: CheckCircle,
  }

  const Icon = iconMap[suggestion.severity]
  const classes = getSeverityClasses(suggestion.severity)

  const handleQuickFix = () => {
    if (!suggestion.quickFix) return
    console.log('Quick fix:', suggestion.quickFix)
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
  )
}
