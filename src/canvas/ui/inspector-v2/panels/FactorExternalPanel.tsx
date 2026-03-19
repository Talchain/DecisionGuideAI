/**
 * FactorExternalPanel — Inspector for external factors (spec §9)
 * QuickSetButtons ABOVE range display as primary input affordance.
 */

import { memo, useState, useMemo, useCallback } from 'react'
import { useCanvasStore } from '../../../store'
import type { NodeType } from '../../../domain/nodes'
import { InspectorGuidanceSection } from '../../inspector/InspectorGuidanceSection'
import { IntelligenceSection } from '../shared/IntelligenceSection'
import { isNodeIntelligenceEnabled } from '../../../../flags'
import { useNodeDisplayMetadata } from '../../../hooks/useNodeDisplayMetadata'
import { typography } from '../../../../styles/typography'
import { useNodeMutations } from '../useInspectorMutations'
import { useStaleGuard } from '../useStaleGuard'
import { SECTION_TITLES } from '../inspectorStrings'
import { SectionTitle } from '../shared/SectionTitle'
import { ConnectionRow } from '../shared/ConnectionRow'
import { CoachingCard } from '../shared/CoachingCard'
import { StaleGuardBanner } from '../shared/StaleGuardBanner'
import { TechnicalDisclosure } from '../shared/TechnicalDisclosure'
import type { InspectorPanelProps } from '../types'
import { COACHING } from '../coachingConfig'

// Quick-set presets
const QUICK_SET = {
  low:       { label: 'Low',       min: 0,   max: 0.4, description: 'Low level expected' },
  moderate:  { label: 'Moderate',  min: 0.3, max: 0.7, description: 'Moderate level expected' },
  high:      { label: 'High',      min: 0.6, max: 1.0, description: 'High level expected' },
  uncertain: { label: 'Uncertain', min: 0,   max: 1.0, description: 'Level unknown' },
} as const

type QuickSetKey = keyof typeof QUICK_SET

export const FactorExternalPanel = memo(function FactorExternalPanel({
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
  const displayMetadata = useNodeDisplayMetadata(nodeId ?? '', 'factor')

  const [description, setDescription] = useState(String(node?.data?.description ?? ''))

  // Prior range
  const prior = (node?.data as Record<string, unknown>)?.prior as Record<string, unknown> | number | undefined
  const rangeMin = typeof prior === 'object' ? (prior as Record<string, unknown>)?.range_min as number | undefined : undefined
  const rangeMax = typeof prior === 'object' ? (prior as Record<string, unknown>)?.range_max as number | undefined : undefined

  // Determine current quick-set selection
  // Local drafts for tech mode editable inputs
  const [localMin, setLocalMin] = useState<string>(rangeMin != null ? rangeMin.toFixed(2) : '')
  const [localMax, setLocalMax] = useState<string>(rangeMax != null ? rangeMax.toFixed(2) : '')

  const handleMinBlur = useCallback(() => {
    const parsed = parseFloat(localMin)
    if (!isNaN(parsed)) {
      setSelected(null)
      mutations.setPriorRange(parsed, rangeMax ?? parsed)
    }
  }, [localMin, rangeMax, mutations])

  const handleMaxBlur = useCallback(() => {
    const parsed = parseFloat(localMax)
    if (!isNaN(parsed)) {
      setSelected(null)
      mutations.setPriorRange(rangeMin ?? 0, parsed)
    }
  }, [localMax, rangeMin, mutations])

  const [selected, setSelected] = useState<QuickSetKey | null>(() => {
    if (rangeMin == null || rangeMax == null) return null
    for (const [key, preset] of Object.entries(QUICK_SET)) {
      if (Math.abs(rangeMin - preset.min) < 0.05 && Math.abs(rangeMax - preset.max) < 0.05) {
        return key as QuickSetKey
      }
    }
    return null
  })

  const handleQuickSet = useCallback((key: QuickSetKey) => {
    setSelected(key)
    setLocalMin(QUICK_SET[key].min.toFixed(2))
    setLocalMax(QUICK_SET[key].max.toFixed(2))
    mutations.setPriorRange(QUICK_SET[key].min, QUICK_SET[key].max)
  }, [mutations])

  // Outbound connections
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

  return (
    <div>
      {/* Description */}
      <div className="mt-3">
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          onBlur={() => mutations.setDescription(description)}
          placeholder="Describe this external factor..."
          rows={2}
          maxLength={500}
          className={`${typography.panelBody} w-full border border-panel-border rounded-lg px-2.5 py-1.5 bg-panel resize-none`}
        />
      </div>

      {/* §9.1 Your estimate — QuickSetButtons ABOVE range display */}
      <SectionTitle icon={SECTION_TITLES.yourEstimate.icon} label={SECTION_TITLES.yourEstimate.label} />
      <div className="bg-panel border border-panel-border rounded-lg p-3">
        <div className={`${typography.panelBody} mb-2`}>How would you describe the level?</div>

        {/* Quick-set buttons */}
        <div className="flex gap-1.5 flex-wrap mb-2.5">
          {(Object.keys(QUICK_SET) as QuickSetKey[]).map(key => (
            <button
              key={key}
              onClick={() => handleQuickSet(key)}
              className={`${typography.panelMeta} px-2.5 py-1 rounded-full cursor-pointer capitalize transition-colors ${
                selected === key
                  ? 'border border-info text-info font-semibold bg-panel'
                  : 'border border-panel-border text-text-light bg-panel hover:bg-panel-hover'
              }`}
            >
              {QUICK_SET[key].label}
            </button>
          ))}
        </div>

        {/* Qualitative summary */}
        {selected && (
          <p className={`${typography.panelBody} text-text-body italic mb-2`}>
            {QUICK_SET[selected].description}
          </p>
        )}

        {/* Range bar visualisation */}
        <div className="relative h-5">
          <div className="absolute top-2 left-0 right-0 h-1 bg-panel-border rounded-full" />
          {rangeMin != null && rangeMax != null && (
            <div
              className="absolute top-2 h-1 rounded-full transition-all duration-300"
              style={{
                left: `${rangeMin * 100}%`,
                width: `${(rangeMax - rangeMin) * 100}%`,
                background: 'linear-gradient(to right, var(--color-success) 40%, var(--color-factor), var(--color-danger) 80%)',
                opacity: 0.6,
              }}
            />
          )}
        </div>

        {/* Tech mode: editable numerical inputs */}
        {techMode && (
          <div className="flex gap-2 mt-2">
            <label className="flex-1">
              <span className={`${typography.panelMeta} text-text-light`}>Min</span>
              <input
                type="number"
                step="0.01"
                value={localMin}
                onChange={e => setLocalMin(e.target.value)}
                onBlur={handleMinBlur}
                onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
                className={`${typography.panelMeta} w-full mt-0.5 bg-transparent border-b border-panel-border focus:border-primary outline-none py-0.5 tabular-nums transition-colors`}
              />
            </label>
            <label className="flex-1">
              <span className={`${typography.panelMeta} text-text-light`}>Max</span>
              <input
                type="number"
                step="0.01"
                value={localMax}
                onChange={e => setLocalMax(e.target.value)}
                onBlur={handleMaxBlur}
                onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
                className={`${typography.panelMeta} w-full mt-0.5 bg-transparent border-b border-panel-border focus:border-primary outline-none py-0.5 tabular-nums transition-colors`}
              />
            </label>
          </div>
        )}
      </div>

      {/* §9.2 Impact */}
      <SectionTitle icon={SECTION_TITLES.impact.icon} label={SECTION_TITLES.impact.label} />
      <StaleGuardBanner isStale={isStale} hasResults={isResultsMode}>
        {isResultsMode && displayMetadata.sensitivityRank !== null && (
          <div className="bg-panel border border-danger/30 p-2.5 rounded-lg">
            <div className={`${typography.panelBody} font-medium`}>
              Responsible for significant uncertainty in your results
            </div>
            {displayMetadata.sensitivityRank != null && (
              <div className={`${typography.panelMeta} text-text-light mt-1`}>
                Ranked {displayMetadata.sensitivityRank === 1 ? '1st'
                  : displayMetadata.sensitivityRank === 2 ? '2nd'
                  : displayMetadata.sensitivityRank === 3 ? '3rd'
                  : `${displayMetadata.sensitivityRank}th`} in influence
              </div>
            )}
          </div>
        )}
      </StaleGuardBanner>

      {/* §9.3 Connections */}
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
        text={COACHING.factorExternalUncertainty}
        action={{ label: 'Narrow the range', onClick: () => {} }}
      />

      <InspectorGuidanceSection elementId={nodeId} />

      {/* Intelligence (Phase 3A) */}
      {isNodeIntelligenceEnabled() && (
        <IntelligenceSection nodeId={nodeId} />
      )}

      <TechnicalDisclosure visible={techMode}>
        <div>System: node_id: {nodeId}</div>
        <div>System: kind: factor (external)</div>
        {rangeMin != null && <div>System: prior.range_min: {rangeMin}</div>}
        {rangeMax != null && <div>System: prior.range_max: {rangeMax}</div>}
      </TechnicalDisclosure>
    </div>
  )
})
