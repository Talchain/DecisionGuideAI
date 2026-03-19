/**
 * OptionPanel — Inspector panel for option nodes (spec §6)
 * Phase 1 priority. Primary editing surface: intervention inputs MUST be editable.
 */

import { memo, useState, useMemo, useCallback } from 'react'
import { useCanvasStore } from '../../../store'
import type { NodeType } from '../../../domain/nodes'
import { InspectorGuidanceSection } from '../../inspector/InspectorGuidanceSection'
import { useNodeDisplayMetadata } from '../../../hooks/useNodeDisplayMetadata'
import { typography } from '../../../../styles/typography'
import { useNodeMutations } from '../useInspectorMutations'
import { useStaleGuard } from '../useStaleGuard'
import {
  SECTION_TITLES,
  EMPTY_STATES,
} from '../inspectorStrings'
import { SectionTitle } from '../shared/SectionTitle'
import { InterventionRow } from '../shared/InterventionRow'
import { CoachingCard } from '../shared/CoachingCard'
import { StaleGuardBanner } from '../shared/StaleGuardBanner'
import { TechnicalDisclosure } from '../shared/TechnicalDisclosure'
import { ProbabilityArc } from '../shared/ProbabilityArc'
import type { InspectorPanelProps } from '../types'
import { COACHING } from '../coachingConfig'

export const OptionPanel = memo(function OptionPanel({
  nodeId,
  techMode,
  onClose,
  onNavigate,
}: InspectorPanelProps) {
  const nodes = useCanvasStore(s => s.nodes)
  const edges = useCanvasStore(s => s.edges)
  const resultsStatus = useCanvasStore(s => s.results?.status)
  const isResultsMode = resultsStatus === 'complete'
  const optionComparison = useCanvasStore(s => s.results?.report?.option_comparison)
  const storyHeadlines = useCanvasStore(s => s.results?.report?.story_headlines)

  const node = nodeId ? nodes.find(n => n.id === nodeId) : undefined
  const mutations = useNodeMutations(nodeId ?? '')
  const { isStale } = useStaleGuard()
  const displayMetadata = useNodeDisplayMetadata(nodeId ?? '', 'option')

  // Description
  const [description, setDescription] = useState(String(node?.data?.description ?? ''))

  // Interventions
  const interventions = useMemo(() => {
    const raw = (node?.data as Record<string, unknown>)?.interventions as Record<string, number> | undefined
    if (!raw) return []
    return Object.entries(raw).map(([factorId, value]) => {
      const factorNode = nodes.find(n => n.id === factorId)
      const obs = (factorNode?.data as Record<string, unknown>)?.observedState as Record<string, unknown> | undefined
      return {
        factorId,
        factorLabel: String(factorNode?.data?.label ?? factorId),
        baseline: obs?.value as number | undefined,
        rawBaseline: obs?.raw_value as number | undefined,
        unit: obs?.unit as string | undefined,
        value,
      }
    })
  }, [node?.data, nodes])

  // All option results for comparison bars
  const allOptions = useMemo(() => {
    if (!optionComparison || !Array.isArray(optionComparison)) return []
    return (optionComparison as Array<{ option_id: string; win_probability?: number; label?: string }>).map(o => ({
      id: o.option_id,
      label: String(nodes.find(n => n.id === o.option_id)?.data?.label ?? o.label ?? o.option_id),
      winPct: typeof o.win_probability === 'number' ? Math.round(o.win_probability * 100) : 0,
      isCurrent: o.option_id === nodeId,
    }))
  }, [optionComparison, nodes, nodeId])

  const headline = storyHeadlines && typeof storyHeadlines === 'object' && nodeId
    ? (storyHeadlines as Record<string, string>)[nodeId]
    : undefined

  if (!nodeId || !node) return null

  return (
    <div>
      {/* Description */}
      <div className="mt-3">
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          onBlur={() => mutations.setDescription(description)}
          placeholder="What would choosing this option actually mean in practice?"
          rows={2}
          maxLength={500}
          className={`${typography.panelBody} w-full border border-panel-border rounded-lg px-2.5 py-1.5 bg-panel resize-none`}
        />
      </div>

      {/* §6.2 What this option changes */}
      <SectionTitle icon={SECTION_TITLES.whatThisChanges.icon} label={SECTION_TITLES.whatThisChanges.label} />

      {interventions.length === 0 ? (
        <div className="py-3 text-center">
          <p className={`${typography.panelMeta} text-text-light`}>
            {EMPTY_STATES.noInterventions}
          </p>
        </div>
      ) : (
        interventions.map(iv => (
          <InterventionRow
            key={iv.factorId}
            factorId={iv.factorId}
            factorLabel={iv.factorLabel}
            baseline={iv.baseline}
            currentValue={iv.value}
            unit={iv.unit}
            onChange={v => mutations.setIntervention(iv.factorId, v)}
            onNavigate={() => onNavigate(iv.factorId)}
            disabled={false}
            techMode={techMode}
            normalisedValue={techMode ? iv.value : undefined}
          />
        ))
      )}

      {/* Add a change button */}
      <button
        type="button"
        className={`${typography.panelMeta} w-full py-2 rounded-lg border border-dashed border-panel-border bg-transparent text-info hover:bg-panel-hover transition-colors mt-1`}
      >
        + Add a change
      </button>

      {/* §6.3 Impact (post-analysis, StaleGuard-wrapped) */}
      <SectionTitle icon={SECTION_TITLES.impact.icon} label={SECTION_TITLES.impact.label} />
      <StaleGuardBanner isStale={isStale} hasResults={isResultsMode}>
        {isResultsMode && (
          <div>
            {/* Win probability hero */}
            {displayMetadata.winRate !== null && (
              <div className="flex items-center gap-3">
                <div className="text-center">
                  <div className={`${typography.panelHeader} text-2xl`} style={{ color: 'var(--color-option)' }}>
                    {Math.round(displayMetadata.winRate * 100)}%
                  </div>
                  <div className={`${typography.panelMeta} text-text-light`}>Chance of winning</div>
                </div>
              </div>
            )}

            {/* Story headline */}
            {headline && (
              <div className="bg-panel border rounded-lg p-2.5 mt-2" style={{ borderColor: 'var(--color-option)4D' }}>
                <p className={`${typography.panelBody} italic text-text-body`}>&ldquo;{headline}&rdquo;</p>
              </div>
            )}

            {/* Comparison bars */}
            {allOptions.length > 1 && (
              <div className="mt-2">
                {allOptions.map(o => (
                  <div key={o.id} className="flex items-center gap-2 py-0.5">
                    <span
                      className={`${typography.panelMeta} w-[110px] truncate ${o.isCurrent ? 'font-semibold' : ''} text-text-light`}
                    >
                      {o.label}
                    </span>
                    <div className="flex-1 h-1.5 bg-panel-border rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${o.winPct}%`,
                          background: o.isCurrent ? 'var(--color-option)' : 'var(--color-text-light)',
                        }}
                      />
                    </div>
                    <span className={`${typography.panelMeta} w-7 text-right ${o.isCurrent ? 'font-semibold' : ''} text-text-light`}>
                      {o.winPct}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </StaleGuardBanner>

      {/* Coaching */}
      {interventions.length > 0 && (
        <CoachingCard
          text={COACHING.optionCoverage}
          action={{ label: 'Ask about this', onClick: () => {} }}
        />
      )}

      {/* Guidance */}
      <InspectorGuidanceSection elementId={nodeId} />

      {/* Technical disclosure */}
      <TechnicalDisclosure visible={techMode}>
        <div>System: node_id: {nodeId}</div>
        <div>System: kind: option</div>
        <div>System: interventions: {interventions.length}</div>
        {interventions.map(iv => (
          <div key={iv.factorId}>System: {iv.factorId} = {iv.value}</div>
        ))}
      </TechnicalDisclosure>
    </div>
  )
})
