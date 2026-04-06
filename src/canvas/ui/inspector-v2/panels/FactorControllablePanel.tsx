/**
 * FactorControllablePanel — Inspector for controllable factors (spec §7)
 * Phase 2. No confidence slider — provenance indicators only (spec §14).
 */

import { memo, useState, useMemo, useCallback } from 'react'
import { Link } from 'lucide-react'
import { useCanvasStore } from '../../../store'
import type { NodeType } from '../../../domain/nodes'
import { useEditConfirmation } from '../useEditConfirmation'
import { EditConfirmation } from '../shared/EditConfirmation'
import { InlineRerunPrompt } from '../shared/InlineRerunPrompt'
import { InspectorCoaching } from '../shared/InspectorCoaching'
import { useNodeDisplayMetadata } from '../../../hooks/useNodeDisplayMetadata'
import { typography } from '../../../../styles/typography'
import { useNodeMutations } from '../useInspectorMutations'
import { useStaleGuard } from '../useStaleGuard'
import { shouldShowNormalised } from '../normalisedDisplay'
import {
  SECTION_TITLES,
  getExtractionLabel,
  getProvenanceLabel,
} from '../inspectorStrings'
import { SectionTitle } from '../shared/SectionTitle'
import { ConnectionRow } from '../shared/ConnectionRow'
import { StaleGuardBanner } from '../shared/StaleGuardBanner'
import { TechnicalDisclosure } from '../shared/TechnicalDisclosure'
import { DataBar } from '../../shared/DataBar'
import type { InspectorPanelProps } from '../types'
import { resolveCoaching } from '../coachingConfig'
import { FactorControllableEditor } from '../editors/FactorControllableEditor'
import { ResultsLink } from '../shared/ResultsLink'

export const FactorControllablePanel = memo(function FactorControllablePanel({
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
  const mutations = useNodeMutations(nodeId ?? '')
  const { isStale } = useStaleGuard()
  const { confirm: confirmEdit, lastConfirmed, isStaleAfterEdit } = useEditConfirmation()
  const displayMetadata = useNodeDisplayMetadata(nodeId ?? '', 'factor')

  const obs = (node?.data as Record<string, unknown>)?.observedState as Record<string, unknown> | undefined
  const rawValue = obs?.raw_value as number | undefined
  const value = obs?.value as number | undefined
  const unit = obs?.unit as string | undefined
  const source = obs?.source as string | undefined
  const uncertaintyDrivers = (node?.data as Record<string, unknown>)?.uncertainty_drivers as string[] | undefined

  // Local draft for editable value input
  const displayValue = rawValue ?? value
  const [draftValue, setDraftValue] = useState<string>(displayValue != null ? String(displayValue) : '')
  const handleValueBlur = useCallback(() => {
    const parsed = parseFloat(draftValue)
    if (!isNaN(parsed) && parsed !== value) {
      mutations.setObservedValue(parsed)
      confirmEdit('value')
    }
  }, [draftValue, value, mutations, confirmEdit])

  // Connections: options that set this + outbound influences
  const setByOptions = useMemo(() => {
    return edges
      .filter(e => e.target === nodeId)
      .map(e => {
        const src = nodes.find(n => n.id === e.source)
        const kind = (src?.type || src?.data?.kind || 'factor') as NodeType
        if (kind !== 'option') return null
        const ivs = (src?.data as Record<string, unknown>)?.interventions as Record<string, number> | undefined
        const ivValue = ivs?.[nodeId]
        return {
          nodeId: e.source,
          label: String(src?.data?.label ?? e.source),
          interventionValue: ivValue,
          unit,
        }
      })
      .filter(Boolean) as Array<{ nodeId: string; label: string; interventionValue?: number; unit?: string }>
  }, [edges, nodes, nodeId, unit])

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

  // Contextual guidance sentence based on sensitivity rank
  const sensitivityGuidance = isResultsMode && displayMetadata.sensitivityRank != null
    ? displayMetadata.sensitivityRank <= 2
      ? 'This is one of the most influential factors in your model. Changes here noticeably affect the result.'
      : displayMetadata.sensitivityRank <= 5
      ? 'This factor has moderate influence on the results.'
      : null
    : null

  return (
    <div>
      {/* §7.1 Type badges */}
      <div className="flex gap-1.5 mt-2.5">
        {node.data?.factorType && (
          <span className={`${typography.panelMeta} font-medium inline-flex items-center px-2.5 py-0.5 rounded-full bg-transparent text-text-body border border-factor/30`}>
            {String(node.data.factorType)}
          </span>
        )}
        <span className={`${typography.panelMeta} font-medium inline-flex items-center px-2.5 py-0.5 rounded-full bg-transparent text-text-body border border-success/30`}>
          {getExtractionLabel(source)}
        </span>
      </div>

      {/* §7.4 Impact context — shown ABOVE value to motivate editing */}
      <SectionTitle icon={SECTION_TITLES.impact.icon} label={SECTION_TITLES.impact.label} />
      <StaleGuardBanner isStale={isStale} hasResults={isResultsMode}>
        {isResultsMode && displayMetadata.inSensitivityAnalysis && (
          <div className="flex items-center gap-3">
            {displayMetadata.sensitivityRank !== null && (
              <div className="text-center">
                <div className={`${typography.panelHeader} text-lg text-info`}>
                  {displayMetadata.sensitivityRank === 1 ? '1st'
                    : displayMetadata.sensitivityRank === 2 ? '2nd'
                    : displayMetadata.sensitivityRank === 3 ? '3rd'
                    : `${displayMetadata.sensitivityRank}th`}
                </div>
                <div className={`${typography.panelMeta} text-text-light`}>most influential</div>
                <ResultsLink label="See all drivers" tab="results" />
              </div>
            )}
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
                ? 'Gathering more evidence here could significantly improve confidence.'
                : displayMetadata.valueOfInformation >= 0.4
                ? 'Additional evidence here would moderately sharpen the analysis.'
                : 'Further investigation here is unlikely to change the outcome.'}
            </p>
          </div>
        </>
      )}

      {/* Contextual guidance — why this factor matters */}
      {sensitivityGuidance && (
        <p className={`${typography.panelBody} text-text-body mt-2`}>{sensitivityGuidance}</p>
      )}

      {/* §7.2 Value — editable */}
      <SectionTitle icon={SECTION_TITLES.value.icon} label={SECTION_TITLES.value.label} />
      <div className="bg-panel border border-panel-border rounded-lg p-3">
        <div className={`flex items-center ${unit && (unit === '\u00A3' || unit === '$' || unit === '\u20AC') ? 'gap-0' : 'gap-1.5'}`}>
          {unit && (unit === '\u00A3' || unit === '$' || unit === '\u20AC') && (
            <span className={`${typography.panelHeader} text-xl`}>{unit}</span>
          )}
          <input
            type="number"
            value={draftValue}
            onChange={e => setDraftValue(e.target.value)}
            onBlur={handleValueBlur}
            onKeyDown={e => { if (e.key === 'Enter') { e.currentTarget.blur() } }}
            placeholder="Enter value"
            className={`${typography.panelHeader} text-xl w-full bg-transparent border-b border-panel-border focus:border-primary outline-none py-0.5 transition-colors`}
          />
          {unit && unit !== '\u00A3' && unit !== '$' && unit !== '\u20AC' && (
            <span className={`${typography.panelMeta} text-text-light`}>{unit}</span>
          )}
        </div>
        {shouldShowNormalised(techMode, rawValue) && value != null && (
          <div className={`${typography.panelMeta} text-text-light mt-0.5`}>
            System: model value: {value.toFixed(3)}
          </div>
        )}
        {techMode && obs?.cap != null && (
          <div className={`${typography.panelMeta} text-text-light mt-0.5`}>
            Cap: {typeof obs.cap === 'number' ? obs.cap.toLocaleString() : String(obs.cap)}{unit ? ` ${unit}` : ''}
          </div>
        )}
        {/* Provenance inline below value (no separate section title) */}
        {source && (
          <div className="flex items-center gap-1 mt-2 pt-2 border-t border-panel-border">
            <Link size={12} className="text-info" />
            <span className={`${typography.panelMeta} text-info`}>{getProvenanceLabel(source)}</span>
          </div>
        )}
        {uncertaintyDrivers && uncertaintyDrivers.length > 0 && (
          <div className="flex gap-1.5 flex-wrap mt-1.5">
            {uncertaintyDrivers.map((d, i) => (
              <span
                key={i}
                className={`${typography.panelMeta} font-medium inline-flex items-center px-2.5 py-0.5 rounded-full bg-transparent text-text-body`}
                style={{ border: '1px solid var(--color-warning)4D' }}
              >
                {d}
              </span>
            ))}
          </div>
        )}
      </div>
      {/* Edit feedback */}
      {lastConfirmed?.field === 'value' && (
        <div className="flex items-center gap-2 mt-1">
          <EditConfirmation trigger={lastConfirmed.ts} />
          <InlineRerunPrompt visible={isStaleAfterEdit} />
        </div>
      )}

      {/* Coaching + Guidance — positioned after value for evidence quality nudges */}
      <InspectorCoaching
        elementId={nodeId}
        panelType="factor-controllable"
        fallbackText={resolveCoaching('factorControllableEvidence', { factorName: String(node.data?.label ?? '') })}
        labelContext={{ label: String(node.data?.label ?? '') }}
      />

      {/* §7.5 Connections */}
      <SectionTitle icon={SECTION_TITLES.connections.icon} label={SECTION_TITLES.connections.label} />
      {setByOptions.length > 0 && (
        <>
          <div className={`${typography.panelMeta} text-text-light mb-1`}>Set by options:</div>
          {setByOptions.map(o => (
            <ConnectionRow
              key={o.nodeId}
              nodeKind="option"
              label={o.label}
              badge={o.interventionValue != null ? (
                <span className={`${typography.panelMeta} font-medium inline-flex items-center px-2 py-0.5 rounded-full bg-transparent text-text-body border border-option/30`}>
                  {o.unit ? `${o.unit}${o.interventionValue.toLocaleString()}` : o.interventionValue}
                </span>
              ) : undefined}
              techMode={techMode}
              onClick={() => onNavigate(o.nodeId)}
            />
          ))}
        </>
      )}
      {influences.length > 0 && (
        <>
          <div className={`${typography.panelMeta} text-text-light mb-1 ${setByOptions.length > 0 ? 'mt-2' : ''}`}>Influences:</div>
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
        </>
      )}

      {/* Technical disclosure — structured advanced editor */}
      <TechnicalDisclosure visible={techMode}>
        <FactorControllableEditor nodeId={nodeId} />
      </TechnicalDisclosure>
    </div>
  )
})
