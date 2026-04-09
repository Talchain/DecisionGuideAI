/**
 * RisksSection — compact risk rows, collapsed by default.
 *
 * Each row: risk label (clickable → canvas focus) + "Triggered by: factor1, factor2"
 * "Show full detail" expansion: node ID.
 */

import { useContext, useMemo } from 'react'
import type { Node, Edge } from '@xyflow/react'
import { MessageCircle } from 'lucide-react'
import { typography } from '../../../styles/typography'
import { SectionErrorBoundary } from '../GraphTextView'
import { Accordion } from '../../../components/results/Accordion'
import { focusNodeById } from '../../utils/focusHelpers'
import { DetailToggleContext } from './DetailToggleContext'

interface RisksSectionProps {
  riskNodes: Node[]
  allNodes: Node[]
  edges: Edge[]
  /** Controlled expansion state */
  isExpanded?: boolean
  /** Callback when expansion state changes */
  onExpandChange?: (expanded: boolean) => void
  /** Whether fragile edges exist (for coaching) */
  hasFragileEdges?: boolean
  onSendMessage?: (message: string) => void
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
          className={`${typography.panelBody} text-text-body hover:text-info hover:underline cursor-pointer transition-colors`}
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

function RisksSectionInner({ riskNodes, allNodes, edges, isExpanded, onExpandChange, hasFragileEdges, onSendMessage }: RisksSectionProps) {
  // Build inbound edge map: risk node ID → source node IDs
  // (hooks must run before conditional returns)
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

  if (riskNodes.length === 0) {
    // Pre-analysis empty state: coaching card
    return (
      <Accordion
        title="Risks"
        badgeCount={0}
        defaultExpanded={false}
        isExpanded={isExpanded}
        onExpandChange={onExpandChange}
        testId="model-risks-section"
      >
        <div className="bg-panel-hover rounded-lg p-2.5" data-testid="risks-empty-coaching">
          <p className={`${typography.panelMeta} text-text-light leading-relaxed`}>
            No risk paths identified in your model. Consider: what would guarantee this decision fails?
          </p>
          {onSendMessage && (
            <button
              type="button"
              onClick={() => onSendMessage('I want to identify potential risks that could cause this decision to fail')}
              className={`${typography.panelMeta} text-info hover:underline cursor-pointer mt-1.5`}
              data-testid="risks-add-cta"
            >
              Tell the AI about potential risks
            </button>
          )}
        </div>
      </Accordion>
    )
  }

  return (
    <Accordion
      title="Risks"
      badgeCount={riskNodes.length}
      defaultExpanded={false}
      isExpanded={isExpanded}
      onExpandChange={onExpandChange}
      testId="model-risks-section"
    >
      {riskNodes.map(risk => {
        const sourceIds = inboundMap.get(risk.id) ?? []
        const triggerFactors = sourceIds
          .map(id => allNodes.find(n => n.id === id))
          .filter((n): n is Node => n !== undefined && (
            n.type === 'factor' ||
            (n.data as Record<string, unknown>)?.kind === 'factor' ||
            (n.data as Record<string, unknown>)?.type === 'factor'
          ))
        return (
          <RiskRow key={risk.id} risk={risk} triggerFactors={triggerFactors} />
        )
      })}
      {hasFragileEdges && (
        <p className={`${typography.panelMeta} text-text-light mt-2`} data-testid="risks-fragile-coaching">
          Strengthening evidence on fragile relationships reduces these risks
        </p>
      )}
      {onSendMessage && (
        <div className="flex justify-end mt-2">
          <button
            type="button"
            onClick={() => onSendMessage('Help me understand the risks in my model and how to mitigate them')}
            className="text-text-light hover:text-info cursor-pointer transition-colors"
            title="Discuss this with the AI"
            data-testid="risks-discuss"
          >
            <MessageCircle className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
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
