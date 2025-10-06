// src/components/ResultsPanel.tsx
// Right panel showing scenario results and thresholds

interface ResultsPanelProps {
  flowResult: any
  isLiveData: boolean
  biases: any[]
  biasesSource: 'live' | 'demo'
}

// Mini chart component for scenario visualization
function ScenarioChart({ results }: { results: any }) {
  const scenarios = [
    { key: 'conservative', label: 'Conservative', color: 'bg-amber-400', textColor: 'text-amber-900' },
    { key: 'most_likely', label: 'Most Likely', color: 'bg-indigo-400', textColor: 'text-indigo-900' },
    { key: 'optimistic', label: 'Optimistic', color: 'bg-teal-400', textColor: 'text-teal-900' }
  ]

  // Extract numeric values
  const values = scenarios.map(s => {
    const result = results[s.key]
    if (!result) return 0
    const val = result.cost_delta || result.value
    if (typeof val === 'string') {
      return parseFloat(val.replace(/[^0-9.-]/g, '')) || 0
    }
    return typeof val === 'number' ? val : 0
  })

  const maxAbs = Math.max(...values.map(Math.abs), 1)
  const hasNegative = values.some(v => v < 0)

  return (
    <div className="space-y-1.5">
      {scenarios.map((scenario, i) => {
        const value = values[i]
        const percentage = (Math.abs(value) / maxAbs) * 100
        const isNegative = value < 0
        
        return (
          <div key={scenario.key} className="flex items-center gap-2">
            <div className={`text-[10px] font-semibold w-20 text-right ${scenario.textColor}`}>
              {scenario.label}
            </div>
            <div className="flex-1 h-5 bg-gray-100 rounded relative overflow-hidden">
              {hasNegative && (
                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gray-300" />
              )}
              <div
                className={`absolute top-0 bottom-0 ${scenario.color} transition-all`}
                style={{
                  [isNegative ? 'right' : 'left']: hasNegative ? '50%' : '0',
                  width: `${percentage}%`
                }}
              />
            </div>
            <div className={`text-xs font-bold w-16 ${scenario.textColor}`}>
              {value >= 0 ? '+' : ''}{value.toFixed(0)}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function ResultsPanel({ flowResult, isLiveData, biases, biasesSource }: ResultsPanelProps) {
  if (!flowResult) {
    return (
      <div className="absolute right-4 top-24 w-80 z-20">
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Results</h3>
          <div className="text-sm text-gray-500">Run a scenario to see results</div>
        </div>
      </div>
    )
  }

  return (
    <div className="absolute right-4 top-24 w-80 z-20 max-h-[calc(100vh-120px)] overflow-y-auto space-y-4">
      {/* Results Card */}
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-gray-900">Results</h3>
          {isLiveData ? (
            <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded">Live</span>
          ) : (
            <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded" title="Using demo data">Demo</span>
          )}
        </div>

        {flowResult.results && (
          <>
            {/* Mini Chart */}
            <div className="mb-3">
              <ScenarioChart results={flowResult.results} />
            </div>

            {/* Detailed Cards */}
            <div className="space-y-2">
              {flowResult.results.conservative && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-2">
                  <div className="text-[10px] font-semibold text-amber-900 mb-0.5">Conservative</div>
                  <div className="text-sm font-bold text-amber-900">
                    {flowResult.results.conservative.cost_delta || flowResult.results.conservative.value}
                  </div>
                  {(flowResult.results.conservative.risk || flowResult.results.conservative.confidence) && (
                    <div className="text-[10px] text-amber-700 mt-0.5">
                      {flowResult.results.conservative.confidence 
                        ? `Confidence: ${flowResult.results.conservative.confidence}` 
                        : `Risk: ${flowResult.results.conservative.risk}`}
                    </div>
                  )}
                </div>
              )}

              {flowResult.results.most_likely && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-2">
                  <div className="text-[10px] font-semibold text-indigo-900 mb-0.5">Most Likely</div>
                  <div className="text-sm font-bold text-indigo-900">
                    {flowResult.results.most_likely.cost_delta || flowResult.results.most_likely.value}
                  </div>
                  {(flowResult.results.most_likely.risk || flowResult.results.most_likely.confidence) && (
                    <div className="text-[10px] text-indigo-700 mt-0.5">
                      {flowResult.results.most_likely.confidence 
                        ? `Confidence: ${flowResult.results.most_likely.confidence}` 
                        : `Risk: ${flowResult.results.most_likely.risk}`}
                    </div>
                  )}
                </div>
              )}

              {flowResult.results.optimistic && (
                <div className="bg-teal-50 border border-teal-200 rounded-lg p-2">
                  <div className="text-[10px] font-semibold text-teal-900 mb-0.5">Optimistic</div>
                  <div className="text-sm font-bold text-teal-900">
                    {flowResult.results.optimistic.cost_delta || flowResult.results.optimistic.value}
                  </div>
                  {(flowResult.results.optimistic.risk || flowResult.results.optimistic.confidence) && (
                    <div className="text-[10px] text-teal-700 mt-0.5">
                      {flowResult.results.optimistic.confidence 
                        ? `Confidence: ${flowResult.results.optimistic.confidence}` 
                        : `Risk: ${flowResult.results.optimistic.risk}`}
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Thresholds */}
      {flowResult.thresholds && flowResult.thresholds.length > 0 && (
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4">
          <h3 className="text-base font-semibold text-gray-900 mb-3">Thresholds</h3>
          <div className="flex flex-wrap gap-2">
            {flowResult.thresholds.map((t: any, i: number) => {
              const isCrossed = t.crossed || t.breached
              const displayText = t.label || t.name || `Threshold ${i + 1}`
              return (
                <span
                  key={i}
                  className={`px-2 py-1 text-xs font-medium rounded ${
                    isCrossed
                      ? 'bg-red-100 text-red-800 border border-red-300'
                      : 'bg-green-100 text-green-800 border border-green-300'
                  }`}
                >
                  {displayText}{t.crossed ? ' ✕' : ' ✓'}
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* Biases */}
      {biases.length > 0 && (
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold text-gray-900">Biases</h3>
            {biasesSource === 'demo' && (
              <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 rounded">Demo</span>
            )}
          </div>
          <div className="space-y-2">
            {biases.slice(0, 3).map((bias: any, i: number) => (
              <div key={i} className="p-2 bg-gradient-to-r from-amber-50 to-orange-50 rounded border border-amber-200">
                <div className="font-semibold text-xs text-gray-900 mb-0.5">{bias.name}</div>
                <div className="text-[10px] text-gray-700">{bias.description}</div>
                {bias.mitigation && (
                  <div className="text-[10px] text-indigo-700 font-medium mt-1">
                    💡 {bias.mitigation}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
