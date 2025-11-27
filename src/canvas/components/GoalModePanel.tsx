import { useState } from 'react'
import { Target, TrendingUp, X } from 'lucide-react'
import { useContrastiveExplanation } from '../../hooks/useContrastiveExplanation'
import { useCanvasStore } from '../store'
import { typography } from '../../styles/typography'
import { Spinner } from '../../components/Spinner'

interface GoalModePanelProps {
  onClose: () => void
}

export function GoalModePanel({ onClose }: GoalModePanelProps) {
  // React #185 FIX: Use shallow comparison for array selectors
  const nodes = useCanvasStore(s => s.nodes)
  const edges = useCanvasStore(s => s.edges)

  const [targetNodeId, setTargetNodeId] = useState('')
  const [targetValue, setTargetValue] = useState('')

  const { data, loading, error, findPath } = useContrastiveExplanation()

  const outcomeNodes = nodes.filter(n => n.type === 'outcome')

  const handleFindPath = async () => {
    if (!targetNodeId || !targetValue) return

    // Validate target value is a valid number
    const parsedValue = parseFloat(targetValue)
    if (Number.isNaN(parsedValue)) {
      return
    }

    await findPath({
      graph: {
        nodes: nodes.map(n => ({
          id: n.id,
          label: n.data?.label || '',
          type: n.type || 'decision',
        })),
        edges: edges.map(e => ({ from: e.source, to: e.target })),
      },
      currentState: {},
      targetState: {
        nodeId: targetNodeId,
        targetValue: parsedValue,
      },
      constraints: {
        maxChanges: 3,
      },
    }).catch(() => {
      // Error handled by hook
    })
  }

  return (
    <div className="w-full max-w-2xl bg-white rounded-lg border-2 border-sand-200 shadow-panel">
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-sky-600" />
            <h3 className={typography.h3}>Goal Mode</h3>
          </div>
          <button
            onClick={onClose}
            className="text-ink-900/60 hover:text-ink-900 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Input Form */}
        <div className="space-y-3">
          <div>
            <label className={`${typography.label} block mb-2`}>
              I want this outcome:
            </label>
            <select
              value={targetNodeId}
              onChange={(e) => setTargetNodeId(e.target.value)}
              className="w-full px-3 py-2 rounded border border-sand-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="">Select outcome...</option>
              {outcomeNodes.map(n => (
                <option key={n.id} value={n.id}>
                  {n.data?.label || n.id}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={`${typography.label} block mb-2`}>
              To reach this value:
            </label>
            <input
              type="number"
              value={targetValue}
              onChange={(e) => setTargetValue(e.target.value)}
              placeholder="e.g., 50000"
              className="w-full px-3 py-2 rounded border border-sand-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <button
            onClick={handleFindPath}
            disabled={!targetNodeId || !targetValue || Number.isNaN(parseFloat(targetValue)) || loading}
            className={`
              ${typography.button} w-full py-2.5 rounded
              bg-sky-500 text-white hover:bg-sky-600
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors
            `}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Spinner size="sm" className="text-white" />
                Finding path...
              </span>
            ) : (
              'Find Path to Goal'
            )}
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="p-3 bg-carrot-50 border border-carrot-200 rounded">
            <p className={`${typography.body} text-carrot-800`}>
              {error.message}
            </p>
          </div>
        )}

        {/* Results Display */}
        {data && (
          <div className="space-y-3 pt-3 border-t border-sand-200">
            <div className="flex items-center justify-between">
              <h4 className={typography.h4}>Recommended Path</h4>
              <span
                className={`
                  ${typography.caption} px-2 py-1 rounded
                  ${
                    data.feasibility === 'easy'
                      ? 'bg-mint-50 text-mint-700'
                      : data.feasibility === 'moderate'
                      ? 'bg-sun-50 text-sun-700'
                      : 'bg-carrot-50 text-carrot-700'
                  }
                `}
              >
                {data.feasibility} to implement
              </span>
            </div>

            {/* Intervention Steps */}
            <div className="space-y-2">
              {data.path.map((step, i) => (
                <div key={i} className="p-3 bg-paper-50 rounded border border-sand-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`${typography.label} text-ink-900`}>
                      {i + 1}. {step.nodeLabel}
                    </span>
                    <span
                      className={`
                        ${typography.caption} px-2 py-0.5 rounded
                        ${
                          step.effort === 'low'
                            ? 'bg-mint-100 text-mint-700'
                            : step.effort === 'moderate'
                            ? 'bg-sun-100 text-sun-700'
                            : 'bg-carrot-100 text-carrot-700'
                        }
                      `}
                    >
                      {step.effort} effort
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mb-2">
                    <span className={`${typography.body} text-ink-900/70`}>
                      {step.currentValue} → {step.targetValue}
                    </span>
                    <TrendingUp className="w-4 h-4 text-mint-600" />
                    <span className={`${typography.body} text-mint-600 font-semibold`}>
                      {step.change > 0 ? '+' : ''}
                      {step.change}
                    </span>
                  </div>

                  {step.impact.sideEffects.length > 0 && (
                    <div className={`${typography.caption} text-ink-900/60`}>
                      Side effects: {step.impact.sideEffects[0].nodeLabel}
                      {step.impact.sideEffects[0].expectedChange > 0 ? ' +' : ' '}
                      {step.impact.sideEffects[0].expectedChange.toFixed(1)}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Expected Outcome */}
            <div className="p-3 bg-mint-50 border border-mint-200 rounded">
              <p className={`${typography.body} text-mint-800`}>
                Expected outcome: {data.expectedOutcome.value.toFixed(2)}
                ({Math.round(data.expectedOutcome.confidence * 100)}% confidence)
              </p>
            </div>

            {/* Alternatives */}
            {data.alternatives && data.alternatives.length > 0 && (
              <details className="pt-2">
                <summary className={`${typography.label} cursor-pointer text-sky-600 hover:text-sky-700`}>
                  Show {data.alternatives.length} alternative path{data.alternatives.length > 1 ? 's' : ''}
                </summary>
                <div className="mt-2 space-y-2">
                  {data.alternatives.map((alt, i) => (
                    <div key={i} className="p-2 bg-sky-50 border border-sky-200 rounded">
                      <p className={`${typography.bodySmall} text-sky-800`}>
                        {alt.path.length} steps — {alt.tradeoff}
                      </p>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
