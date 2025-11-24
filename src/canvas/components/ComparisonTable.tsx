import { useState } from 'react'
import { Plus, Star, TrendingUp } from 'lucide-react'
import { useISLComparison } from '../../hooks/useISLComparison'
import { useCanvasStore } from '../store'
import { typography } from '../../styles/typography'
import { Spinner } from '../../components/Spinner'
import { buildRichGraphPayload } from '../utils/graphPayload'

export function ComparisonTableSection() {
  const nodes = useCanvasStore(s => s.nodes)
  const edges = useCanvasStore(s => s.edges)
  const [scenarios, setScenarios] = useState<Array<{ name: string; modifications: Record<string, any> }>>([])
  const { data, loading, compare } = useISLComparison()

  const handleCompare = async () => {
    if (nodes.length === 0 || scenarios.length === 0) return

    try {
      await compare({
        graph: buildRichGraphPayload(nodes, edges),
        options: {
          comparison_scenarios: scenarios,
        },
      })
    } catch (err) {
      console.error('Comparison failed:', err)
    }
  }

  const handleAddScenario = () => {
    setScenarios([...scenarios, { name: `Scenario ${scenarios.length + 1}`, modifications: {} }])
  }

  if (nodes.length === 0) {
    return (
      <div className="p-4">
        <p className={`${typography.body} text-ink-900/50 text-center py-8`}>
          Add nodes to your graph to enable scenario comparison
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h3 className={typography.h4}>Scenario Comparison</h3>
        <button
          onClick={handleAddScenario}
          className={`
            ${typography.button} inline-flex items-center gap-1 px-3 py-1.5 rounded
            bg-sky-500 text-white hover:bg-sky-600
          `}
        >
          <Plus className="w-3 h-3" />
          Add Scenario
        </button>
      </div>

      {scenarios.length > 0 && (
        <>
          <div className="space-y-2">
            {scenarios.map((scenario, i) => (
              <div key={i} className="p-3 bg-paper-50 border border-sand-200 rounded">
                <input
                  type="text"
                  value={scenario.name}
                  onChange={(e) => {
                    const updated = [...scenarios]
                    updated[i].name = e.target.value
                    setScenarios(updated)
                  }}
                  className={`${typography.body} w-full px-2 py-1 border border-sand-200 rounded`}
                  placeholder="Scenario name"
                />
              </div>
            ))}
          </div>

          <button
            onClick={handleCompare}
            disabled={loading}
            className={`
              ${typography.button} w-full py-2.5 rounded
              bg-sky-500 text-white hover:bg-sky-600
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Spinner size="sm" className="text-white" />
                <span>Comparing...</span>
              </span>
            ) : (
              'Compare Scenarios'
            )}
          </button>
        </>
      )}

      {data && (
        <div className="space-y-4">
          {/* Recommended Scenario */}
          {data.recommended_scenario && (
            <div className="p-3 bg-mint-50 border border-mint-200 rounded-lg">
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5 text-mint-600" />
                <p className={`${typography.label} text-mint-900`}>
                  Recommended: {data.alternative_scenarios.find(s => s.id === data.recommended_scenario)?.name || 'Base'}
                </p>
              </div>
            </div>
          )}

          {/* Comparison Table */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-sand-200">
                  <th className={`${typography.label} text-left p-2`}>Scenario</th>
                  <th className={`${typography.label} text-right p-2`}>Expected Value</th>
                  <th className={`${typography.label} text-right p-2`}>Risk-Adjusted</th>
                </tr>
              </thead>
              <tbody>
                {/* Base Scenario */}
                <tr className="border-b border-sand-200">
                  <td className={`${typography.body} p-2`}>
                    {data.base_scenario.name}
                  </td>
                  <td className={`${typography.body} text-right p-2 font-mono`}>
                    {Object.values(data.base_scenario.outcome_predictions)[0]?.toFixed(2) || 'N/A'}
                  </td>
                  <td className={`${typography.body} text-right p-2 font-mono`}>
                    {Object.values(data.comparison_metrics.risk_adjusted_value)[0]?.toFixed(2) || 'N/A'}
                  </td>
                </tr>

                {/* Alternative Scenarios */}
                {data.alternative_scenarios.map(scenario => (
                  <tr key={scenario.id} className="border-b border-sand-200">
                    <td className={`${typography.body} p-2 flex items-center gap-2`}>
                      {scenario.name}
                      {scenario.id === data.recommended_scenario && (
                        <Star className="w-3 h-3 text-mint-600" />
                      )}
                    </td>
                    <td className={`${typography.body} text-right p-2 font-mono`}>
                      {Object.values(scenario.outcome_predictions)[0]?.toFixed(2) || 'N/A'}
                    </td>
                    <td className={`${typography.body} text-right p-2 font-mono`}>
                      {Object.values(data.comparison_metrics.risk_adjusted_value)[scenario.id]?.toFixed(2) || 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
