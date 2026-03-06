/**
 * OutcomePanel — Inspector for outcome nodes (spec §11)
 * Primarily read surface. Simple range bars + text (no density charts for PoC).
 */

import { memo, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useCanvasStore } from '../../../store'
import type { NodeType } from '../../../domain/nodes'
import { InspectorGuidanceSection } from '../../inspector/InspectorGuidanceSection'
import { typography } from '../../../../styles/typography'
import { useStaleGuard } from '../useStaleGuard'
import { SECTION_TITLES } from '../inspectorStrings'
import { SectionTitle } from '../shared/SectionTitle'
import { ConnectionRow } from '../shared/ConnectionRow'
import { CoachingCard } from '../shared/CoachingCard'
import { StaleGuardBanner } from '../shared/StaleGuardBanner'
import { TechnicalDisclosure } from '../shared/TechnicalDisclosure'
import type { InspectorPanelProps } from '../types'

export const OutcomePanel = memo(function OutcomePanel({
  nodeId,
  techMode,
  onClose,
  onNavigate,
}: InspectorPanelProps) {
  const nodes = useCanvasStore(s => s.nodes)
  const edges = useCanvasStore(s => s.edges)
  const resultsStatus = useCanvasStore(s => s.results?.status)
  const isResultsMode = resultsStatus === 'complete'

  const node = nodeId ? nodes.find(n => n.id === nodeId) : undefined
  const { isStale } = useStaleGuard()

  const [driversOpen, setDriversOpen] = useState(false)

  // Inbound factors
  const inboundFactors = useMemo(() => {
    return edges
      .filter(e => e.target === nodeId)
      .map(e => {
        const src = nodes.find(n => n.id === e.source)
        const kind = (src?.type || src?.data?.kind || 'factor') as NodeType
        const category = src?.data?.category as string | undefined
        return {
          edgeId: e.id,
          nodeId: e.source,
          nodeKind: kind,
          label: String(src?.data?.label ?? e.source),
          category,
          strength: { weight: e.data?.weight ?? 0, direction: (e.data?.direction ?? 'positive') as 'positive' | 'negative' },
        }
      })
  }, [edges, nodes, nodeId])

  if (!nodeId || !node) return null

  const description = String(node.data?.description ?? '')

  return (
    <div>
      {description && (
        <p className={`${typography.panelBody} text-text-body mt-3`}>{description}</p>
      )}

      {/* Predicted range by option */}
      <SectionTitle icon={SECTION_TITLES.predictedRange.icon} label={SECTION_TITLES.predictedRange.label} />
      <StaleGuardBanner isStale={isStale} hasResults={isResultsMode}>
        {isResultsMode ? (
          <div className="bg-panel border border-panel-border rounded-lg p-3">
            <p className={`${typography.panelMeta} text-text-light`}>
              Distribution data will be displayed here when available from analysis results.
            </p>
          </div>
        ) : null}
      </StaleGuardBanner>

      {/* Goal contribution bar — TODO: wire width to real contribution from results */}
      <div className="flex items-center gap-2 mt-3 px-3 py-2 bg-panel border border-success/30 rounded-lg">
        <span className={`${typography.panelHeader} text-xs`}>Contributes to your goal</span>
        <div className="flex-1 h-1.5 bg-panel-border rounded-full overflow-hidden">
          <div className="h-full bg-success rounded-full" style={{ width: '45%' }} />
        </div>
      </div>

      {/* What drives this (behind disclosure for PoC) */}
      <button
        type="button"
        onClick={() => setDriversOpen(o => !o)}
        className={`${typography.panelMeta} mt-3 bg-transparent border-none cursor-pointer text-info flex items-center gap-1 p-0 hover:underline`}
        aria-expanded={driversOpen}
      >
        {driversOpen ? <ChevronDown size={12} className="text-info" /> : <ChevronRight size={12} className="text-info" />}
        What drives this
      </button>
      {driversOpen && (
        <div className="mt-1">
          {inboundFactors.map(conn => (
            <ConnectionRow
              key={conn.edgeId}
              nodeKind={conn.nodeKind}
              label={conn.label}
              badge={conn.category ? (
                <span className={`${typography.panelMeta} font-medium px-2 py-0.5 rounded-full bg-transparent text-text-body border border-factor/30`}>
                  {conn.category === 'controllable' ? 'You can change this'
                    : conn.category === 'observable' ? 'You measure this'
                    : conn.category === 'external' ? 'Outside your control'
                    : ''}
                </span>
              ) : undefined}
              strength={conn.strength}
              techMode={techMode}
              onClick={() => onNavigate(conn.nodeId)}
            />
          ))}
        </div>
      )}

      <CoachingCard
        text="Consider whether all the relevant factors driving this outcome are captured in the model."
        action={{ label: 'Ask about this', onClick: () => {} }}
      />

      <InspectorGuidanceSection elementId={nodeId} />

      <TechnicalDisclosure visible={techMode}>
        <div>System: node_id: {nodeId}</div>
        <div>System: kind: outcome</div>
        <div>System: inbound_factors: {inboundFactors.length}</div>
      </TechnicalDisclosure>
    </div>
  )
})
