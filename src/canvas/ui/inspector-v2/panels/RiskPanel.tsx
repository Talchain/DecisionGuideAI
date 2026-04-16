/**
 * RiskPanel — Inspector for risk nodes (v6.2 three-group layout)
 *
 * Mirrors OutcomePanel structure. Danger-themed where appropriate.
 * Groups: Context → Risk exposure → What drives this
 */

import { memo, useMemo } from 'react'
import { useCanvasStore } from '../../../store'
import type { NodeType } from '../../../domain/nodes'
import { InspectorCoaching } from '../shared/InspectorCoaching'
import { typography } from '../../../../styles/typography'
import { useStaleGuard } from '../useStaleGuard'
import {
  SECTION_TITLES,
  GROUP_LABELS,
  INLINE_LABELS,
  DESCRIPTION_PLACEHOLDERS,
} from '../inspectorStrings'
import { SectionTitle } from '../shared/SectionTitle'
import { PanelGroup } from '../shared/PanelGroup'
import { EmptyDescriptionPrompt } from '../shared/EmptyDescriptionPrompt'
import { DriversList, type DriverItem } from '../shared/DriversList'
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

  // Inbound factors (drivers)
  const inboundFactors: DriverItem[] = useMemo(() => {
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
      {/* ── Context group ─────────────────────────────────────── */}
      <PanelGroup kind="context" label={GROUP_LABELS.context}>
        {description
          ? <p className={`${typography.panelBody} text-text-body`}>{description}</p>
          : <EmptyDescriptionPrompt placeholder={DESCRIPTION_PLACEHOLDERS.risk} />
        }
      </PanelGroup>

      {/* ── Risk exposure group ────────────────────────────────── */}
      <PanelGroup kind="impact">
        <SectionTitle icon={SECTION_TITLES.riskExposure.icon} label={SECTION_TITLES.riskExposure.label} />
        <StaleGuardBanner isStale={isStale} hasResults={isResultsMode}>
          {isResultsMode ? (
            <div className="bg-panel border border-panel-border rounded-lg p-3">
              <p className={`${typography.panelMeta} text-text-light`}>
                {INLINE_LABELS.riskExposurePlaceholder}
              </p>
            </div>
          ) : null}
        </StaleGuardBanner>
        {!isResultsMode && (
          <p className={`${typography.panelMeta} text-text-light mt-2`}>
            {INLINE_LABELS.runAnalysisRisk}
          </p>
        )}
      </PanelGroup>

      {/* ── What drives this group ────────────────────────────── */}
      <PanelGroup kind="connections" label={INLINE_LABELS.drivers}>
        <DriversList drivers={inboundFactors} techMode={techMode} onNavigate={onNavigate} />
        {inboundFactors.length === 0 && (
          <p className={`${typography.panelMeta} text-text-light`}>No inbound connections yet.</p>
        )}
        <InspectorCoaching
          elementId={nodeId}
          panelType="risk"
          fallbackText={COACHING.riskControlLevers}
          labelContext={{ label: String(node.data?.label ?? '') }}
          actionLabel="Explore trade-off"
        />
      </PanelGroup>

      {/* ── Expert-only model detail ──────────────────────────── */}
      <TechnicalDisclosure visible={techMode}>
        <RiskAdvancedEditor nodeId={nodeId} />
      </TechnicalDisclosure>
    </div>
  )
})
