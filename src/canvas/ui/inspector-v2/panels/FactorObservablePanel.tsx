/**
 * FactorObservablePanel — Inspector for observable factors (spec §8)
 * Lighter than controllable: no uncertainty drivers, no intervention editing.
 * Provenance emphasises data recency.
 */

import { memo, useMemo } from 'react'
import { Link } from 'lucide-react'
import { useCanvasStore } from '../../../store'
import type { NodeType } from '../../../domain/nodes'
import { InspectorGuidanceSection } from '../../inspector/InspectorGuidanceSection'
import { IntelligenceSection } from '../shared/IntelligenceSection'
import { isNodeIntelligenceEnabled } from '../../../../flags'
import { useNodeDisplayMetadata } from '../../../hooks/useNodeDisplayMetadata'
import { typography } from '../../../../styles/typography'
import { useStaleGuard } from '../useStaleGuard'
import { shouldShowNormalised } from '../normalisedDisplay'
import { SECTION_TITLES, getExtractionLabel, getProvenanceLabel } from '../inspectorStrings'
import { SectionTitle } from '../shared/SectionTitle'
import { ConnectionRow } from '../shared/ConnectionRow'
import { CoachingCard } from '../shared/CoachingCard'
import { StaleGuardBanner } from '../shared/StaleGuardBanner'
import { TechnicalDisclosure } from '../shared/TechnicalDisclosure'
import type { InspectorPanelProps } from '../types'
import { COACHING } from '../coachingConfig'

export const FactorObservablePanel = memo(function FactorObservablePanel({
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
  const displayMetadata = useNodeDisplayMetadata(nodeId ?? '', 'factor')

  const obs = (node?.data as Record<string, unknown>)?.observedState as Record<string, unknown> | undefined
  const rawValue = obs?.raw_value as number | undefined
  const value = obs?.value as number | undefined
  const unit = obs?.unit as string | undefined
  const source = obs?.source as string | undefined

  // Outbound influences
  const influences = useMemo(() => {
    return edges
      .filter(e => e.source === nodeId)
      .map(e => {
        const tgt = nodes.find(n => n.id === e.target)
        const kind = (tgt?.type || tgt?.data?.kind || 'factor') as NodeType
        return {
          edgeId: e.id,
          nodeId: e.target,
          nodeKind: kind,
          label: String(tgt?.data?.label ?? e.target),
          strength: { weight: e.data?.weight ?? 0, direction: (e.data?.direction ?? 'positive') as 'positive' | 'negative' },
        }
      })
  }, [edges, nodes, nodeId])

  if (!nodeId || !node) return null

  const formatValue = (v: number) => {
    if (unit === '\u00A3' || unit === '$' || unit === '\u20AC') return `${unit}${v.toLocaleString()}`
    return unit ? `${v.toLocaleString()} ${unit}` : `${v}`
  }

  return (
    <div>
      {/* Type badges */}
      <div className="flex gap-1.5 mt-2.5">
        <span className={`${typography.panelMeta} font-medium inline-flex items-center px-2.5 py-0.5 rounded-full bg-transparent text-text-body border border-factor/30`}>
          You measure this
        </span>
        <span className={`${typography.panelMeta} font-medium inline-flex items-center px-2.5 py-0.5 rounded-full bg-transparent text-text-body border border-success/30`}>
          {getExtractionLabel(source)}
        </span>
      </div>

      {/* Value */}
      <SectionTitle icon={SECTION_TITLES.value.icon} label={SECTION_TITLES.value.label} />
      <div className="bg-panel border border-panel-border rounded-lg p-3">
        {rawValue != null ? (
          <span className={`${typography.panelHeader} text-xl`}>{formatValue(rawValue)}</span>
        ) : value != null ? (
          <span className={`${typography.panelHeader} text-xl`}>{formatValue(value)}</span>
        ) : (
          <span className={`${typography.panelMeta} text-text-light italic`}>No value set</span>
        )}
        {shouldShowNormalised(techMode, rawValue) && value != null && (
          <div className={`${typography.panelMeta} text-text-light mt-0.5`}>
            System: model value: {value.toFixed(3)}
          </div>
        )}
      </div>

      {/* Where this comes from — emphasise recency */}
      <SectionTitle icon={SECTION_TITLES.whereThisComes.icon} label={SECTION_TITLES.whereThisComes.label} />
      {source && (
        <div className="flex items-center gap-1">
          <Link size={12} className="text-info" />
          <span className={`${typography.panelMeta} text-info`}>{getProvenanceLabel(source)}</span>
        </div>
      )}

      {/* Impact */}
      <SectionTitle icon={SECTION_TITLES.impact.icon} label={SECTION_TITLES.impact.label} />
      <StaleGuardBanner isStale={isStale} hasResults={isResultsMode}>
        {isResultsMode && displayMetadata.sensitivityRank !== null && (
          <div>
            <span className={`${typography.panelHeader} text-lg text-info`}>
              {displayMetadata.sensitivityRank === 1 ? '1st'
                : displayMetadata.sensitivityRank === 2 ? '2nd'
                : displayMetadata.sensitivityRank === 3 ? '3rd'
                : `${displayMetadata.sensitivityRank}th`}
            </span>
            <span className={`${typography.panelMeta} text-text-light ml-1`}>most influential</span>
          </div>
        )}
      </StaleGuardBanner>

      {/* Influences */}
      <SectionTitle icon={SECTION_TITLES.connections.icon} label="Influences" />
      {influences.map(conn => (
        <ConnectionRow
          key={conn.edgeId}
          nodeKind={conn.nodeKind}
          label={conn.label}
          strength={conn.strength}
          techMode={techMode}
          onClick={() => onNavigate(conn.nodeId)}
        />
      ))}

      {/* Coaching */}
      <CoachingCard
        text={COACHING.factorObservableData}
        action={{ label: 'Ask about this', onClick: () => {} }}
      />

      <InspectorGuidanceSection elementId={nodeId} />

      {/* Intelligence (Phase 3A) */}
      {isNodeIntelligenceEnabled() && (
        <IntelligenceSection nodeId={nodeId} />
      )}

      <TechnicalDisclosure visible={techMode}>
        <div>System: node_id: {nodeId}</div>
        <div>System: kind: factor (observable)</div>
        {value != null && <div>System: observed_state.value: {value}</div>}
      </TechnicalDisclosure>
    </div>
  )
})
