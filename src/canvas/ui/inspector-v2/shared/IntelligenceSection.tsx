/**
 * IntelligenceSection — "Intelligence" panel for factor node inspectors.
 *
 * Shows:
 * - Observed data status (has data / no data)
 * - Connectivity (outgoing influences, incoming influences)
 * - Top sensitivity driver pill (post-analysis only, from results store)
 *
 * Feature-gated by VITE_FEATURE_NODE_INTELLIGENCE.
 * Used by FactorControllablePanel, FactorObservablePanel, FactorExternalPanel.
 */

import { memo, useMemo } from 'react'
import { useCanvasStore } from '../../../store'
import { useResultsStore } from '../../../stores'
import { hasObservedData } from '../../../utils/observedStateHelpers'
import { SectionTitle } from './SectionTitle'
import { typography } from '../../../../styles/typography'

// ---------------------------------------------------------------------------
// useNodeConnectivity — single useMemo, two filter passes
// ---------------------------------------------------------------------------

interface NodeConnectivity {
  outgoing: number
  incoming: number
}

/**
 * Derives outgoing and incoming edge counts for a node in a single memoised pass.
 * Avoids two separate filter subscriptions per render.
 */
function useNodeConnectivity(nodeId: string): NodeConnectivity {
  const edges = useCanvasStore(s => s.edges)
  return useMemo(() => {
    let outgoing = 0
    let incoming = 0
    for (const e of edges) {
      if (e.source === nodeId) outgoing++
      if (e.target === nodeId) incoming++
    }
    return { outgoing, incoming }
  }, [edges, nodeId])
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface IntelligenceSectionProps {
  nodeId: string
}

export const IntelligenceSection = memo(function IntelligenceSection({ nodeId }: IntelligenceSectionProps) {
  const node = useCanvasStore(s => s.nodes.find(n => n.id === nodeId))
  const { outgoing, incoming } = useNodeConnectivity(nodeId)

  // Use primitive selector to avoid array reference churn on every results update
  const driverRank = useResultsStore(s =>
    s.drivers?.findIndex(d => d.kind === 'node' && d.id === nodeId) ?? -1,
  )
  const resultsStatus = useResultsStore(s => s.status)
  const isTopDriver = driverRank >= 0 && driverRank < 3 && resultsStatus === 'complete'

  if (!node) return null

  const hasData = hasObservedData(node.data)

  const ordinal = (n: number) => {
    if (n === 0) return '1st'
    if (n === 1) return '2nd'
    if (n === 2) return '3rd'
    return `${n + 1}th`
  }

  return (
    <div>
      <SectionTitle icon="Activity" label="Intelligence" />

      <div className="space-y-2">
        {/* Observed data status */}
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full flex-shrink-0 ${hasData ? 'bg-success' : 'bg-factor'}`}
            aria-hidden="true"
          />
          <span className={`${typography.panelMeta} ${hasData ? 'text-text-body' : 'text-text-light'}`}>
            {hasData ? 'Has observed data' : 'No observed data'}
          </span>
        </div>

        {/* Connectivity */}
        <div className={`${typography.panelMeta} text-text-light`}>
          {outgoing === 0 && incoming === 0 ? (
            'Not connected to any other nodes'
          ) : (
            <>
              <span>
                Influences{' '}
                <span className="text-text-body font-medium">
                  {outgoing === 0 ? 'none' : outgoing}
                </span>
              </span>
              <span className="mx-1.5 text-panel-border">·</span>
              <span>
                Influenced by{' '}
                <span className="text-text-body font-medium">
                  {incoming === 0 ? 'none' : incoming}
                </span>
              </span>
            </>
          )}
        </div>

        {/* Top driver pill (post-analysis only) */}
        {isTopDriver && (
          <div>
            <span
              className={`${typography.panelMeta} inline-flex items-center px-2 py-0.5 rounded-full
                bg-transparent border border-info/30 text-info font-medium`}
            >
              Top sensitivity driver · {ordinal(driverRank)}
            </span>
          </div>
        )}
      </div>
    </div>
  )
})
