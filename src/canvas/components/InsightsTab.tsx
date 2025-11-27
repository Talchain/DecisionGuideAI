import { useEffect, useState } from 'react'
import { CheckCircle, AlertCircle } from 'lucide-react'
import { shallow } from 'zustand/shallow'
import { useCEEInsights } from '../../hooks/useCEEInsights'
import { useCanvasStore } from '../store'
import { typography } from '../../styles/typography'
import { Spinner } from '../../components/Spinner'
import type { CEEBiasFinding } from '../../adapters/cee/types'
import { StructuralHealthSection } from './StructuralHealth'
import { useTransportability } from '../../hooks/useTransportability'

export function InsightsTabBody() {
  // React #185 FIX: Use shallow comparison for combined selector with arrays
  const { nodes, edges } = useCanvasStore(
    s => ({ nodes: s.nodes, edges: s.edges }),
    shallow
  )
  const { data, loading, error, analyze } = useCEEInsights()
  const [checkedBiases, setCheckedBiases] = useState<Set<string>>(new Set())
  const [expandedBiases, setExpandedBiases] = useState<Set<string>>(new Set())

  // Auto-analyze on graph changes (debounced)
  useEffect(() => {
    if (nodes.length === 0 || loading) return

    const timer = setTimeout(() => {
      analyze({
        nodes: nodes.map(n => ({ id: n.id, label: n.data?.label || '', type: n.type || 'decision' })),
        edges: edges.map(e => ({ from: e.source, to: e.target })),
      }).catch(console.error)
    }, 1000)

    return () => clearTimeout(timer)
  }, [nodes, edges, analyze, loading])

  const highPriorityBiases = data?.bias_findings
    .filter(b => b.severity === 'high')
    .sort((a, b) => a.type.localeCompare(b.type))
    .slice(0, 3) || []

  const handleToggleBias = (biasId: string) => {
    setCheckedBiases(prev => {
      const next = new Set(prev)
      if (next.has(biasId)) {
        next.delete(biasId)
      } else {
        next.add(biasId)
      }
      return next
    })
  }

  const handleExpandBias = (biasId: string) => {
    setExpandedBiases(prev => {
      const next = new Set(prev)
      if (next.has(biasId)) {
        next.delete(biasId)
      } else {
        next.add(biasId)
      }
      return next
    })
  }

  if (nodes.length === 0) {
    return (
      <div className="p-4">
        <p className={`${typography.body} text-ink-900/50 text-center py-8`}>
          Add nodes to your graph to see insights
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4">
      {/* Decision Health Summary */}
      {loading && (
        <div className="flex items-center gap-2">
          <Spinner size="sm" />
          <span className={typography.body}>Analyzing decision...</span>
        </div>
      )}

      {data && (
        <>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className={typography.h3}>Decision Health</h3>
              <span className={`
                ${typography.h2} tabular-nums
                ${data.quality_overall >= 7 ? 'text-mint-600' :
                  data.quality_overall >= 4 ? 'text-sun-600' : 'text-carrot-600'}
              `}>
                {data.quality_overall}/10
              </span>
            </div>

            <div className={`flex items-center gap-4 ${typography.body}`}>
              <span className={`${typography.bodySmall} text-ink-900/70`}>
                {data.bias_findings.filter(b => b.severity === 'high').length} high-priority biases
              </span>
              <span className={`${typography.bodySmall} text-ink-900/70`}>
                {data.structural_health.warnings.length} structural warnings
              </span>
            </div>
          </div>

          {/* Priority Actions */}
          {highPriorityBiases.length > 0 && (
            <div className="space-y-3">
              <h4 className={typography.h4}>Priority Actions</h4>

              <div className="space-y-2">
                {highPriorityBiases.map(bias => (
                  <BiasCard
                    key={bias.id}
                    bias={bias}
                    checked={checkedBiases.has(bias.id)}
                    expanded={expandedBiases.has(bias.id)}
                    onToggle={() => handleToggleBias(bias.id)}
                    onExpand={() => handleExpandBias(bias.id)}
                  />
                ))}
              </div>

              {data.bias_findings.length > 3 && (
                <button className={`${typography.caption} text-sky-600 underline hover:text-sky-700`}>
                  View all {data.bias_findings.length} findings
                </button>
              )}
            </div>
          )}

          {/* Completion Celebration */}
          {highPriorityBiases.length === 0 && (
            <div className="flex items-center gap-2 p-3 bg-mint-50 border border-mint-200 rounded-lg">
              <CheckCircle className="w-5 h-5 text-mint-600" />
              <span className={`${typography.body} text-mint-800`}>
                Decision analysis complete
              </span>
            </div>
          )}

          <StructuralHealthSection insights={data} />

          {/* Phase 2: Transportability Section */}
          <TransportabilitySection />
        </>
      )}
    </div>
  )
}

/**
 * Phase 2: Transportability - Cross-Market Validation
 */
function TransportabilitySection() {
  // React #185 FIX: Use shallow comparison for combined selector with arrays
  const { nodes, edges } = useCanvasStore(
    s => ({ nodes: s.nodes, edges: s.edges }),
    shallow
  )
  const [targetContext, setTargetContext] = useState('Germany')
  const { data, loading, check } = useTransportability()

  const handleCheck = async () => {
    if (nodes.length === 0) return

    await check({
      graph: {
        nodes: nodes.map(n => ({
          id: n.id,
          label: String(n.data?.label || ''),
          type: n.type || 'decision'
        })),
        edges: edges.map(e => ({ from: e.source, to: e.target })),
      },
      sourceContext: 'UK Market',
      targetContext,
    }).catch(() => {
      // Error handled by hook
    })
  }

  return (
    <div className="space-y-3 pt-4 border-t border-sand-200">
      <h4 className={typography.h4}>Cross-Market Validation</h4>

      <div className="flex gap-2">
        <input
          type="text"
          value={targetContext}
          onChange={(e) => setTargetContext(e.target.value)}
          placeholder="Target market..."
          className="flex-1 px-3 py-2 rounded border border-sand-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
        />
        <button
          onClick={handleCheck}
          disabled={loading || !targetContext}
          className={`
            ${typography.button} px-4 py-2 rounded
            bg-sky-500 text-white hover:bg-sky-600
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors
          `}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <Spinner size="sm" className="text-white" />
              Checking...
            </span>
          ) : (
            'Check'
          )}
        </button>
      </div>

      {data && (
        <div
          className={`p-3 rounded ${
            data.transferable
              ? 'bg-mint-50 border border-mint-200'
              : 'bg-carrot-50 border border-carrot-200'
          }`}
        >
          <p className={`${typography.body} mb-2`}>
            {data.transferable ? '✓' : '⚠️'}
            {' '}
            {data.transferable
              ? `Likely transferable (${Math.round(data.confidence * 100)}%)`
              : 'May not transfer'}
          </p>

          {data.requiredAssumptions.length > 0 && (
            <div className="mt-2">
              <p className={`${typography.label} mb-1`}>Verify:</p>
              <ul className={`${typography.bodySmall} list-disc list-inside space-y-0.5`}>
                {data.requiredAssumptions.map((assumption, i) => (
                  <li key={i}>{assumption}</li>
                ))}
              </ul>
            </div>
          )}

          {data.missingData.length > 0 && (
            <div className="mt-2">
              <p className={`${typography.label} mb-1`}>Missing data:</p>
              <ul className={`${typography.bodySmall} list-disc list-inside space-y-0.5`}>
                {data.missingData.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          {data.adaptations.length > 0 && (
            <div className="mt-2">
              <p className={`${typography.label} mb-1`}>Recommended adaptations:</p>
              <div className="space-y-1">
                {data.adaptations.map((adaptation, i) => (
                  <div key={i} className={`${typography.bodySmall}`}>
                    <strong>{adaptation.what}:</strong> {adaptation.why}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

interface BiasCardProps {
  bias: CEEBiasFinding
  checked: boolean
  expanded: boolean
  onToggle: () => void
  onExpand: () => void
}

function BiasCard({ bias, checked, expanded, onToggle, onExpand }: BiasCardProps) {
  const quickFix = bias.interventions.find(i => i.effort === 'quick')

  return (
    <div className="border border-sand-200 rounded-lg p-3 space-y-2">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          className="w-4 h-4 mt-0.5 flex-shrink-0"
        />

        <div className="flex-1 space-y-2">
          <div>
            <span className={`${typography.label} text-carrot-700`}>
              {bias.severity === 'high' ? '[High]' : '[Medium]'} {bias.type}
            </span>
            <p className={`${typography.bodySmall} text-ink-900/70 mt-1`}>
              {bias.description}
            </p>
          </div>

          {quickFix && (
            <div className="flex items-start gap-2 p-2 bg-sky-50 rounded">
              <span className={typography.body}>💡</span>
              <div className="flex-1">
                <p className={`${typography.bodySmall} text-sky-800`}>
                  Quick fix ({quickFix.estimatedMinutes} min): {quickFix.action}
                </p>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={onExpand}
              className={`${typography.caption} text-sky-600 underline hover:text-sky-700`}
            >
              {expanded ? 'Hide details' : 'Why this matters'}
            </button>

            {bias.interventions.length > 1 && (
              <button className={`${typography.caption} text-sky-600 underline hover:text-sky-700`}>
                More actions
              </button>
            )}
          </div>

          {expanded && bias.mechanism && (
            <div className="p-2 bg-paper-50 rounded border-l-2 border-sky-500">
              <p className={`${typography.bodySmall} text-ink-900/70`}>
                {bias.mechanism}
              </p>
              {bias.citation && (
                <p className={`${typography.caption} text-ink-900/50 mt-1`}>
                  {bias.citation}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
