/**
 * RisksSection — risk nodes with trigger context.
 *
 * Each risk card shows:
 *   - Risk label (clickable → canvas focus)
 *   - Trigger factors: list of factor nodes that have edges pointing into this risk
 *   - Probability if available on the node
 *
 * "Show full detail" expansion: node ID, probability value.
 */

import { useContext, useMemo } from 'react'
import type { Node, Edge } from '@xyflow/react'
import { AlertTriangle } from 'lucide-react'
import { typography } from '../../../styles/typography'
import { SectionErrorBoundary } from '../GraphTextView'
import { focusNodeById } from '../../utils/focusHelpers'
import { DetailToggleContext } from './DetailToggleContext'

interface RisksSectionProps {
  riskNodes: Node[]
  allNodes: Node[]
  edges: Edge[]
}

function RiskCard({ risk, triggerFactors }: { risk: Node; triggerFactors: Node[] }) {
  const { showDetail } = useContext(DetailToggleContext)
  const data = risk.data as Record<string, unknown>
  const label = String(data?.label ?? risk.id)
  const probability = data?.probability as number | undefined
  const observedState = (data?.observedState ?? data?.observed_state) as Record<string, unknown> | undefined
  const stateValue = observedState?.value as number | undefined

  const displayProb = probability ?? stateValue

  return (
    <div
      className="bg-panel-hover rounded-lg p-2.5 mb-2 last:mb-0"
      data-testid={`risk-card-${risk.id}`}
    >
      {/* Header row */}
      <div className="flex items-start gap-2 mb-1.5">
        <AlertTriangle className="w-3.5 h-3.5 text-danger shrink-0 mt-0.5" aria-hidden="true" />
        <button
          type="button"
          onClick={() => focusNodeById(risk.id)}
          className={`${typography.panelHeader} text-text-header hover:text-info hover:underline flex-1 min-w-0 text-left leading-snug transition-colors`}
        >
          {label}
        </button>
        {displayProb !== undefined && (
          <span className={`${typography.panelMeta} text-text-light shrink-0`}>
            {Math.round(displayProb * 100)}%
          </span>
        )}
      </div>

      {/* Trigger factors */}
      {triggerFactors.length > 0 && (
        <div className="pl-5">
          <span className={`${typography.panelMeta} text-text-light`}>Triggered by: </span>
          {triggerFactors.map((f, i) => (
            <span key={f.id}>
              <button
                type="button"
                onClick={() => focusNodeById(f.id)}
                className={`${typography.panelMeta} text-text-body hover:text-info transition-colors`}
              >
                {String((f.data as Record<string, unknown>)?.label ?? f.id)}
              </button>
              {i < triggerFactors.length - 1 && (
                <span className={`${typography.panelMeta} text-text-light`}>, </span>
              )}
            </span>
          ))}
        </div>
      )}

      {triggerFactors.length === 0 && (
        <div className="pl-5">
          <span className={`${typography.panelMeta} text-text-light`}>No connected factors</span>
        </div>
      )}

      {/* Full detail expansion */}
      {showDetail && (
        <div className="mt-2 pt-2 border-t border-panel-border pl-5">
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
            {displayProb !== undefined && (
              <>
                <span className={`${typography.panelMeta} text-text-light`}>Probability</span>
                <span className={`${typography.panelMeta} text-text-body font-mono text-right`}>
                  {displayProb.toFixed(4)}
                </span>
              </>
            )}
            <span className={`${typography.panelMeta} text-text-light`}>Node ID</span>
            <span className={`${typography.panelMeta} text-[10px] text-text-body font-mono text-right truncate`}>
              {risk.id}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

function RisksSectionInner({ riskNodes, allNodes, edges }: RisksSectionProps) {
  if (riskNodes.length === 0) return null

  // Build inbound edge map: risk node ID → source node IDs
  const inboundMap = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const risk of riskNodes) {
      map.set(risk.id, [])
    }
    for (const edge of edges) {
      if (map.has(edge.target)) {
        map.get(edge.target)!.push(edge.source)
      }
    }
    return map
  }, [riskNodes, edges])

  return (
    <div className="bg-panel border border-panel-border rounded-xl p-3" data-testid="model-risks-section">
      {/* Section header */}
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="w-3 h-3 text-danger shrink-0" aria-hidden="true" />
        <span className={`${typography.panelHeader} text-text-header`}>Risks</span>
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full bg-transparent border border-panel-border text-text-body ${typography.panelMeta} font-medium`}>
          {riskNodes.length}
        </span>
      </div>

      {riskNodes.map(risk => {
        const sourceIds = inboundMap.get(risk.id) ?? []
        const triggerFactors = sourceIds
          .map(id => allNodes.find(n => n.id === id))
          .filter((n): n is Node => n !== undefined && (n.data as Record<string, unknown>)?.kind === 'factor')
        return (
          <RiskCard key={risk.id} risk={risk} triggerFactors={triggerFactors} />
        )
      })}
    </div>
  )
}

export function RisksSection(props: RisksSectionProps) {
  return (
    <SectionErrorBoundary section="risks">
      <RisksSectionInner {...props} />
    </SectionErrorBoundary>
  )
}
