/**
 * FactorObservablePanel — Inspector for observable factors (spec §8)
 * Lighter than controllable: no uncertainty drivers, no intervention editing.
 * Provenance emphasises data recency.
 */

import { memo, useMemo } from 'react'
import { Link } from 'lucide-react'
import { useCanvasStore } from '../../../store'
import type { NodeType } from '../../../domain/nodes'
import { InspectorCoaching } from '../shared/InspectorCoaching'
import { useNodeDisplayMetadata } from '../../../hooks/useNodeDisplayMetadata'
import { typography } from '../../../../styles/typography'
import { useStaleGuard } from '../useStaleGuard'
import { shouldShowNormalised } from '../normalisedDisplay'
import { unwrapInterventionValue } from '../../../utils/labelUtils'
import { SECTION_TITLES, getExtractionLabel, getProvenanceLabel } from '../inspectorStrings'
import { SectionTitle } from '../shared/SectionTitle'
import { ConnectionRow } from '../shared/ConnectionRow'
import { StaleGuardBanner } from '../shared/StaleGuardBanner'
import { TechnicalDisclosure } from '../shared/TechnicalDisclosure'
import { DataBar } from '../../shared/DataBar'
import type { InspectorPanelProps } from '../types'
import { resolveCoaching } from '../coachingConfig'
import { FactorObservableEditor } from '../editors/FactorObservableEditor'

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
  // Defensive unwrap: observedState.raw_value / value / cap should be plain
  // numbers, but CEE/legacy paths can wrap them in `{ value, unit, ... }`
  // objects. Casting unknown→number lies; the values then reach
  // .toLocaleString() and render as "[object Object]". unwrapInterventionValue
  // is generic numeric defense (handles both number and `{ value: number }`)
  // and returns null when the input cannot resolve to a finite number.
  const rawValue = unwrapInterventionValue(obs?.raw_value) ?? undefined
  const value = unwrapInterventionValue(obs?.value) ?? undefined
  const cap = unwrapInterventionValue(obs?.cap) ?? undefined
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

  // Contextual guidance based on sensitivity rank
  const sensitivityGuidance = isResultsMode && displayMetadata.sensitivityRank != null
    ? displayMetadata.sensitivityRank <= 2
      ? 'This is one of the most influential measurements in your model.'
      : displayMetadata.sensitivityRank <= 5
      ? 'This measurement has moderate influence on the results.'
      : null
    : null

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

      {/* Impact — above value to motivate updating */}
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

      {/* Investigation value (post-analysis, VoI) */}
      {isResultsMode && displayMetadata.valueOfInformation !== null && (
        <>
          <SectionTitle icon={SECTION_TITLES.investigationValue.icon} label={SECTION_TITLES.investigationValue.label} />
          <div className="bg-panel border border-panel-border rounded-lg p-2.5">
            <DataBar
              value={displayMetadata.valueOfInformation}
              label="Investigation value"
              colour="info"
              trailingLabel={
                displayMetadata.valueOfInformation >= 0.7 ? 'High'
                : displayMetadata.valueOfInformation >= 0.4 ? 'Medium'
                : 'Low'
              }
            />
            <p className={`${typography.panelMeta} text-text-light mt-1.5`}>
              {displayMetadata.valueOfInformation >= 0.7
                ? 'Updating this measurement could significantly improve the analysis.'
                : displayMetadata.valueOfInformation >= 0.4
                ? 'More recent data here would moderately sharpen the analysis.'
                : 'Further investigation here is unlikely to change the outcome.'}
            </p>
          </div>
        </>
      )}

      {/* Contextual guidance */}
      {sensitivityGuidance && (
        <p className={`${typography.panelBody} text-text-body mt-2`}>{sensitivityGuidance}</p>
      )}

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
        {techMode && cap != null && (
          <div className={`${typography.panelMeta} text-text-light mt-0.5`}>
            Cap: {cap.toLocaleString()}{unit ? ` ${unit}` : ''}
          </div>
        )}
        {/* Provenance inline below value */}
        {source && (
          <div className="flex items-center gap-1 mt-2 pt-2 border-t border-panel-border">
            <Link size={12} className="text-info" />
            <span className={`${typography.panelMeta} text-info`}>{getProvenanceLabel(source)}</span>
          </div>
        )}
      </div>

      {/* Coaching — after value, before connections */}
      <InspectorCoaching
        elementId={nodeId}
        panelType="factor-observable"
        fallbackText={resolveCoaching('factorObservableData', { factorName: String(node.data?.label ?? '') })}
        labelContext={{ label: String(node.data?.label ?? '') }}
      />

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

      {/* Technical disclosure — structured advanced editor */}
      <TechnicalDisclosure visible={techMode}>
        <FactorObservableEditor nodeId={nodeId} />
      </TechnicalDisclosure>
    </div>
  )
})
