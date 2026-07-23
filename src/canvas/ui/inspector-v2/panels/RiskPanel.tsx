/**
 * RiskPanel — Inspector for risk nodes (v6.2 three-group layout)
 *
 * Mirrors OutcomePanel structure. Danger-themed where appropriate.
 * Groups: Context → Your input (likelihood × impact) → What drives this
 *
 * P1.7 — the "Risk exposure" placeholder is replaced by a real probability ×
 * impact editing surface. Likelihood is click-to-edit (following
 * FactorObservablePanel); impact is a segmented control over the RiskImpact enum.
 * Edits route through useNodeMutations (setProbability/setImpact), which stale the
 * analysis via hasAnalyticalNodeChange exactly like a factor observedState edit.
 */

import { memo, useMemo, useCallback } from 'react'
import { useCanvasStore } from '../../../store'
import type { NodeType, RiskImpact } from '../../../domain/nodes'
import { InspectorCoaching } from '../shared/InspectorCoaching'
import { typography } from '../../../../styles/typography'
import {
  GROUP_LABELS,
  INLINE_LABELS,
  EMPTY_STATES,
  DESCRIPTION_PLACEHOLDERS,
} from '../inspectorStrings'
import { PanelGroup } from '../shared/PanelGroup'
import { PrimaryControlCard } from '../shared/PrimaryControlCard'
import { InlineNumberEditor } from '../shared/InlineNumberEditor'
import { EmptyDescriptionPrompt } from '../shared/EmptyDescriptionPrompt'
import { DriversList, type DriverItem } from '../shared/DriversList'
import { EditConfirmation } from '../shared/EditConfirmation'
import { InlineRerunPrompt } from '../shared/InlineRerunPrompt'
import { TechnicalDisclosure } from '../shared/TechnicalDisclosure'
import { useNodeMutations } from '../useInspectorMutations'
import { useEditConfirmation } from '../useEditConfirmation'
import {
  calculateRiskSeverity,
  getRiskSeverityColors,
} from '../../../utils/graphDisplayCalculations'
import type { InspectorPanelProps } from '../types'
import { COACHING } from '../coachingConfig'
import { RiskAdvancedEditor } from '../editors/RiskAdvancedEditor'

/** Impact enum options, ordered low → critical. Labels are the capitalised enum. */
const IMPACT_OPTIONS: { value: RiskImpact; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
]

export const RiskPanel = memo(function RiskPanel({
  nodeId,
  techMode,
  onNavigate,
}: InspectorPanelProps) {
  const nodes = useCanvasStore(s => s.nodes)
  const edges = useCanvasStore(s => s.edges)

  const node = nodeId ? nodes.find(n => n.id === nodeId) : undefined
  const mutations = useNodeMutations(nodeId ?? '')
  const { confirm: confirmEdit, lastConfirmed, isStaleAfterEdit } = useEditConfirmation()

  // Canonical scales (RiskNodeDataSchema): probability is 0-1, impact is the enum.
  const probability = node?.data?.probability as number | undefined
  const impact = node?.data?.impact as RiskImpact | undefined
  const probabilityPct = typeof probability === 'number' ? Math.round(probability * 100) : null
  const severity = calculateRiskSeverity(probability, impact)
  const severityColors = getRiskSeverityColors(severity)

  // Click-to-edit likelihood (shared InlineNumberEditor, same field as the
  // factor observed-value editor).
  const handleProbabilitySave = useCallback((parsed: number) => {
    // UI-SEM-092: percentage input → canonical 0-1 store value (format
    // conversion, same class as UI-SEM-058). setProbability clamps to [0,1].
    mutations.setProbability(parsed / 100)
    confirmEdit('probability')
  }, [mutations, confirmEdit])

  const handleImpactSelect = useCallback((value: RiskImpact) => {
    mutations.setImpact(value)
    confirmEdit('impact')
  }, [mutations, confirmEdit])

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
  const showEditFeedback = lastConfirmed?.field === 'probability' || lastConfirmed?.field === 'impact'

  return (
    <div>
      {/* ── Context group ─────────────────────────────────────── */}
      <PanelGroup kind="context" label={GROUP_LABELS.context}>
        {description
          ? <p className={`${typography.panelBody} text-text-body`}>{description}</p>
          : <EmptyDescriptionPrompt placeholder={DESCRIPTION_PLACEHOLDERS.risk} />
        }
      </PanelGroup>

      {/* ── Your input: likelihood × impact (P1.7) ─────────────── */}
      <PanelGroup kind="input" label={GROUP_LABELS.input}>
        <PrimaryControlCard>
          {/* Likelihood — click-to-edit percentage */}
          <div>
            <div className={`${typography.panelMeta} text-text-light mb-1`}>{INLINE_LABELS.riskLikelihood}</div>
            <InlineNumberEditor
              readout={probabilityPct != null ? `${probabilityPct}%` : null}
              placeholder={INLINE_LABELS.riskNotSet}
              editSeed={probabilityPct != null ? String(probabilityPct) : ''}
              onSave={handleProbabilitySave}
              displayTestId="risk-probability-display"
              inputTestId="risk-probability-input"
              title="Click to set likelihood"
              min={0}
              max={100}
              step={1}
              ariaLabel="Likelihood percentage"
            />
          </div>

          {/* Impact — segmented control over the RiskImpact enum */}
          <div className="mt-3 pt-3 border-t border-panel-border">
            <div className={`${typography.panelMeta} text-text-light mb-1`}>{INLINE_LABELS.riskImpact}</div>
            <div role="radiogroup" aria-label="Impact" className="flex gap-1 flex-wrap">
              {IMPACT_OPTIONS.map(opt => {
                const active = impact === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    data-testid={`risk-impact-${opt.value}`}
                    onClick={() => handleImpactSelect(opt.value)}
                    className={`${typography.panelMeta} font-medium inline-flex items-center px-2.5 py-1 rounded-full border transition-colors cursor-pointer ${
                      active
                        ? 'border-primary bg-panel-hover text-text-body'
                        : 'border-panel-border bg-transparent text-text-light hover:bg-panel-hover'
                    }`}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
            {impact == null && (
              <p className={`${typography.panelMeta} text-text-light italic mt-1`}>{INLINE_LABELS.riskImpactNotSet}</p>
            )}
          </div>

          {/* Derived severity — reuses calculateRiskSeverity; renders only when
              BOTH inputs exist (the derivation returns null otherwise — no
              fabricated severity). */}
          {severity && (
            <div className="mt-3 pt-3 border-t border-panel-border flex items-center gap-2">
              <span className={`${typography.panelMeta} text-text-light`}>{INLINE_LABELS.riskSeverity}</span>
              <span
                data-testid="risk-severity-badge"
                className={`${severityColors.bg} ${severityColors.border} ${severityColors.text} border rounded px-1.5 py-0.5 ${typography.panelMeta}`}
              >
                {severity.charAt(0).toUpperCase() + severity.slice(1)}
              </span>
            </div>
          )}

          {/* Edit feedback + re-run nudge (shared with the factor editors) */}
          {showEditFeedback && (
            <div className="flex items-center gap-2 mt-2">
              <EditConfirmation trigger={lastConfirmed?.ts ?? null} />
              <InlineRerunPrompt visible={isStaleAfterEdit} />
            </div>
          )}
        </PrimaryControlCard>

        <p className={`${typography.panelMeta} text-text-light mt-2`}>{INLINE_LABELS.riskExposureHint}</p>
      </PanelGroup>

      {/* ── What drives this group ────────────────────────────── */}
      <PanelGroup kind="connections" label={INLINE_LABELS.drivers}>
        <DriversList drivers={inboundFactors} techMode={techMode} onNavigate={onNavigate} />
        {inboundFactors.length === 0 && (
          <p className={`${typography.panelMeta} text-text-light`}>{EMPTY_STATES.noInboundConnections}</p>
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
