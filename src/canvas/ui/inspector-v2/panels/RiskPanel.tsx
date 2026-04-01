/**
 * RiskPanel — Inspector for risk nodes (spec §12)
 * Same structure as outcome but negative framing.
 * Simple horizontal bars for exposure (no density charts for PoC).
 */

import { memo, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useCanvasStore } from '../../../store'
import type { NodeType } from '../../../domain/nodes'
import { InspectorCoaching } from '../shared/InspectorCoaching'
import { typography } from '../../../../styles/typography'
import { useStaleGuard } from '../useStaleGuard'
import { SECTION_TITLES } from '../inspectorStrings'
import { SectionTitle } from '../shared/SectionTitle'
import { ConnectionRow } from '../shared/ConnectionRow'
import { StaleGuardBanner } from '../shared/StaleGuardBanner'
import { TechnicalDisclosure } from '../shared/TechnicalDisclosure'
import type { InspectorPanelProps } from '../types'
import { COACHING } from '../coachingConfig'
import { RiskAdvancedEditor } from '../editors/RiskAdvancedEditor'

export const RiskPanel = memo(function RiskPanel({
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
        return {
          edgeId: e.id,
          nodeId: e.source,
          nodeKind: kind,
          label: String(src?.data?.label ?? e.source),
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

      {/* Risk exposure by option */}
      <SectionTitle icon={SECTION_TITLES.riskExposure.icon} label={SECTION_TITLES.riskExposure.label} />
      <StaleGuardBanner isStale={isStale} hasResults={isResultsMode}>
        {isResultsMode ? (
          <div className="bg-panel border border-panel-border rounded-lg p-3">
            <p className={`${typography.panelMeta} text-text-light`}>
              Risk exposure data will be displayed here when available from analysis results.
            </p>
          </div>
        ) : null}
      </StaleGuardBanner>

      {/* Goal drag — shows only when analysis provides real risk data */}
      {!isResultsMode && (
        <p className={`${typography.panelMeta} text-text-light mt-3 px-3`}>
          Run analysis to see how this risk affects the goal.
        </p>
      )}

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
              strength={conn.strength}
              techMode={techMode}
              onClick={() => onNavigate(conn.nodeId)}
            />
          ))}
        </div>
      )}

      <InspectorCoaching
        elementId={nodeId}
        panelType="risk"
        fallbackText={COACHING.riskControlLevers}
        labelContext={{ label: String(node.data?.label ?? '') }}
        actionLabel="Explore trade-off"
      />

      {/* Technical disclosure — structured advanced editor */}
      <TechnicalDisclosure visible={techMode}>
        <RiskAdvancedEditor nodeId={nodeId} />
      </TechnicalDisclosure>
    </div>
  )
})
