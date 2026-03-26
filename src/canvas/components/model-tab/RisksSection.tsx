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
import { typography } from '../../../styles/typography'
import { SectionErrorBoundary } from '../GraphTextView'
import { Accordion } from '../../../components/results/Accordion'
import { focusNodeById } from '../../utils/focusHelpers'
import { DetailToggleContext } from './DetailToggleContext'

interface RisksSectionProps {
  riskNodes: Node[]
  allNodes: Node[]
  edges: Edge[]
}

function RiskRow({ risk, triggerFactors }: { risk: Node; triggerFactors: Node[] }) {
  const { showDetail } = useContext(DetailToggleContext)
  const data = risk.data as Record<string, unknown>
  const label = String(data?.label ?? risk.id)

  const triggerText = triggerFactors.length > 0
    ? triggerFactors.map(f => String((f.data as Record<string, unknown>)?.label ?? f.id)).join(', ')
    : null

  return (
    <div className="py-1.5 border-b border-panel-border last:border-b-0" data-testid={`risk-card-${risk.id}`}>
      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          type="button"
          onClick={() => focusNodeById(risk.id)}
          className={`${typography.panelBody} text-text-body hover:text-info transition-colors`}
        >
          {label}
        </button>
        {triggerText && (
          <span className={`${typography.panelMeta} text-text-light`}>
            Triggered by: {triggerText}
          </span>
        )}
      </div>
      {/* Full detail: node ID */}
      {showDetail && (
        <div className="mt-1">
          <span className={`${typography.panelMeta} text-text-light`}>Node ID: </span>
          <span className={`${typography.panelMeta} text-text-body font-mono`}>{risk.id}</span>
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
    <Accordion
      title="Risks"
      badgeCount={riskNodes.length}
      defaultExpanded={false}
      testId="model-risks-section"
    >
      {riskNodes.map(risk => {
        const sourceIds = inboundMap.get(risk.id) ?? []
        const triggerFactors = sourceIds
          .map(id => allNodes.find(n => n.id === id))
          .filter((n): n is Node => n !== undefined && (n.data as Record<string, unknown>)?.kind === 'factor')
        return (
          <RiskRow key={risk.id} risk={risk} triggerFactors={triggerFactors} />
        )
      })}
    </Accordion>
  )
}

export function RisksSection(props: RisksSectionProps) {
  return (
    <SectionErrorBoundary section="risks">
      <RisksSectionInner {...props} />
    </SectionErrorBoundary>
  )
}
