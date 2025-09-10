import React from 'react'
import { loadSeed, type StrategySeed } from '@/sandbox/bridge/contracts'

export const StrategyContextPanel: React.FC<{ decisionId?: string }> = ({ decisionId = 'debug-test-board' }) => {
  const [seed, setSeed] = React.useState<StrategySeed | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  React.useEffect(() => {
    try {
      const s = loadSeed(decisionId)
      setSeed(s)
      setError(null)
    } catch (e) {
      setError('Failed to load strategy seed')
      setSeed(null)
    }
  }, [decisionId])

  return (
    <div className="p-4 overflow-auto">
      <h3 className="text-sm font-semibold mb-2">Strategy Context</h3>
      {error ? (
        <div role="status" className="text-sm text-red-600">{error}</div>
      ) : !seed ? (
        <div className="text-sm text-gray-500">Loading…</div>
      ) : (
        <div className="space-y-4 text-sm">
          <div>
            <div className="font-medium">Goals</div>
            <ul className="list-disc ml-5">
              {seed.goals.map((g: StrategySeed['goals'][number]) => (
                <li key={g.id}>{g.title}</li>
              ))}
            </ul>
          </div>
          <div>
            <div className="font-medium">Objectives</div>
            <ul className="list-disc ml-5">
              {seed.objectives.map((o: StrategySeed['objectives'][number]) => (
                <li key={o.id}>{o.title}</li>
              ))}
            </ul>
          </div>
          <div>
            <div className="font-medium">Key Results</div>
            <ul className="list-disc ml-5">
              {seed.keyResults.map((kr: StrategySeed['keyResults'][number]) => (
                <li key={kr.id}>{kr.title}</li>
              ))}
            </ul>
          </div>
          <div>
            <div className="font-medium">Strategy Blocks</div>
            <ul className="list-disc ml-5">
              {seed.strategyBlocks.map((sb: StrategySeed['strategyBlocks'][number]) => (
                <li key={sb.id}>{sb.title}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
