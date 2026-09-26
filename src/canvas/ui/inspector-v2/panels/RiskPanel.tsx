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
import { RiskNodeDataSchema, type NodeType, type RiskImpact } from '../../../domain/nodes'
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
import { inspectorDetailRow } from '../inspectorStyle'
import { useNodeMutations, RENAME_AUTHORITY_CLAUSE } from '../useInspectorMutations'
import { useEditConfirmation } from '../useEditConfirmation'
import {
  calculateRiskSeverity,
  getRiskSeverityColors,
} from '../../../utils/graphDisplayCalculations'
import type { InspectorPanelProps } from '../types'
import { COACHING } from '../coachingConfig'
import { RiskAdvancedEditor } from '../editors/RiskAdvancedEditor'
import { resolveEdgeSignedStrengthDisplay } from '../../../domain/edgeValueProvenance'
import { resolveElementLabel } from '../../../domain/elementLabel'

/** Impact enum options, ordered low → critical. Labels are the capitalised enum. */
const IMPACT_OPTIONS: { value: RiskImpact; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
]
/** The same labels, keyed — `impact` is schema-parsed, so every value has one. */
const IMPACT_LABEL = Object.fromEntries(IMPACT_OPTIONS.map(o => [o.value, o.label])) as Record<RiskImpact, string>

/**
 * A10 — likelihood and impact write through `setProbability`/`setImpact`,
 * which commit via a bare `updateNode` (no wire carrier), the same class as
 * the goal pane's own `GoalThresholdEditor`. That write stays fenced; the
 * fence just moved from the Router's panel-wide wrap (which also inerted the
 * coaching card's Ask/Dismiss/Explore buttons below, none of which write
 * anything) to here, scoped to the controls that do.
 *
 * ⛔ THEY ARE NOT THE PANE'S ONLY WRITERS (review 2038 on `1cd208f5`). The
 * advanced editor under "Show model detail" holds a Description textarea that
 * commits `setDescription` — also a bare store write, spelled in ANOTHER FILE.
 * It is fenced separately (`data-writer-fence="advanced-editor"`), and this
 * notice leaves the complement open rather than naming likelihood and impact
 * as the whole of what is unsaved.
 */
export const INSPECTOR_RISK_REASON =
  `Renaming ${RENAME_AUTHORITY_CLAUSE}. Likelihood, impact and other edits here are not yet saved to the shared model — ask Olumi to record them in the chat instead.`

/**
 * ⭐ v3.1 (DESIGN-GAP-v31 row 33): the absence copy for a risk with nothing
 * recorded. The contract: "Likelihood and impact are not recorded … does not
 * imply low risk". An unset risk must never read as a LOW one — and must never
 * sit under controls that cannot save ("Not set. Click to enter." over a
 * fenced trigger, Low/Medium/High/Critical pills that did nothing).
 */
export const INSPECTOR_RISK_ABSENCE =
  'Likelihood and impact are not recorded. That does not imply low risk.'

export const RiskPanel = memo(function RiskPanel({
  nodeId,
  techMode,
  onNavigate,
  readOnly = false,
}: InspectorPanelProps) {
  const nodes = useCanvasStore(s => s.nodes)
  const edges = useCanvasStore(s => s.edges)

  const node = nodeId ? nodes.find(n => n.id === nodeId) : undefined
  const mutations = useNodeMutations(nodeId ?? '')
  const { confirm: confirmEdit, lastConfirmed, isStaleAfterEdit } = useEditConfirmation()

  // Match the card's existing input contract; invalid imported values are not estimates.
  const probabilityInput = RiskNodeDataSchema.shape.probability.safeParse(node?.data?.probability)
  const impactInput = RiskNodeDataSchema.shape.impact.safeParse(node?.data?.impact)
  const probability = probabilityInput.success ? probabilityInput.data : undefined
  const impact = impactInput.success ? impactInput.data : undefined
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
          label: resolveElementLabel(src?.data),
          strength: resolveEdgeSignedStrengthDisplay(e.data as Record<string, unknown> | undefined),
        }
      })
  }, [edges, nodes, nodeId])

  if (!nodeId || !node) return null

  const description = typeof node.data?.description === 'string' && node.data.description.trim() ? node.data.description : null
  const body = typeof node.data?.body === 'string' && node.data.body.trim() ? node.data.body : null
  const context = description && body && body.trim() !== description.trim()
    ? `${description}\n\n${body}`
    : description ?? body
  const showEditFeedback = lastConfirmed?.field === 'probability' || lastConfirmed?.field === 'impact'

  return (
    <div>
      {/* ── Context group ─────────────────────────────────────── */}
      <PanelGroup kind="context" label={GROUP_LABELS.context}>
        {context
          ? <p data-testid="risk-authored-context" className={`${typography.panelBody} text-text-body whitespace-pre-wrap break-words`}>{context}</p>
          : <EmptyDescriptionPrompt placeholder={DESCRIPTION_PLACEHOLDERS.risk} />
        }
      </PanelGroup>

      {/* ── Likelihood × impact ─────────────────────────────────
          ⭐⭐ v3.1 (DESIGN-GAP-v31 row 33) — A CONTROL THAT CANNOT SAVE MUST
          LOOK AND BEHAVE READ-ONLY. `setProbability`/`setImpact` commit through
          a bare `updateNode` with no wire carrier, so the Router mounts this
          pane `readOnly` and the writers were fenced — but a fenced trigger
          reading "Not set. Click to enter." beside four impact pills still
          LOOKED editable, and "Severity combines the likelihood and impact
          entered above" was said over nothing entered. So, when `readOnly`:
          the recorded values as detail rows, the absence stated when there are
          none, and NO writer mounted at all (a stronger fence than a disabled
          one). The editable arm below is unchanged and returns the day a
          carrier lands and the Router stops passing `readOnly`. */}
      {readOnly ? (
        <PanelGroup kind="input" label={GROUP_LABELS.riskAssessment}>
          {probability == null && impact == null ? (
            <p data-testid="risk-absence" className={`${typography.panelBody} text-text-body m-0`}>
              {INSPECTOR_RISK_ABSENCE}
            </p>
          ) : (
            <div>
              <div data-testid="risk-likelihood-row" className={inspectorDetailRow}>
                <span className="text-text-light">{INLINE_LABELS.riskLikelihood}</span>
                <span className="text-right text-text-body">{probabilityPct != null ? `${probabilityPct}%` : 'Not recorded'}</span>
              </div>
              <div data-testid="risk-impact-row" className={inspectorDetailRow}>
                <span className="text-text-light">{INLINE_LABELS.riskImpact}</span>
                <span className="text-right text-text-body">
                  {impact != null ? IMPACT_LABEL[impact] : 'Not recorded'}
                </span>
              </div>
              {severity && (
                <div className={inspectorDetailRow}>
                  <span className="text-text-light">{INLINE_LABELS.riskSeverity}</span>
                  <span
                    data-testid="risk-severity-badge"
                    className={`${severityColors.bg} ${severityColors.border} ${severityColors.text} border rounded px-1.5 py-0.5 ${typography.panelMeta}`}
                  >
                    {severity.charAt(0).toUpperCase() + severity.slice(1)}
                  </span>
                </div>
              )}
            </div>
          )}
        </PanelGroup>
      ) : (
      <PanelGroup kind="input" label={GROUP_LABELS.input}>
        <fieldset disabled={readOnly} className="contents" data-writer-fence="probability-impact">
        <PrimaryControlCard>
          {(probability != null || impact != null) && (
            <p className={`${typography.panelMeta} text-text-light mb-2`}>Entered estimate</p>
          )}
          {/* Likelihood — click-to-edit percentage */}
          <div>
            <div className={`${typography.panelMeta} text-text-light mb-1`}>{INLINE_LABELS.riskLikelihood}</div>
            <InlineNumberEditor
              readout={probabilityPct != null ? `${probabilityPct}%` : null}
              placeholder={INLINE_LABELS.riskNotSet}
              // Exact percent (unrounded) so opening + blurring a 0.376 (shown
              // "38%") is a no-op and preserves the entered precision (P1-4).
              value={probability != null ? probability * 100 : null}
              onSave={handleProbabilitySave}
              displayTestId="risk-probability-display"
              inputTestId="risk-probability-input"
              title="Click to set likelihood"
              min={0}
              max={100}
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
                    className={`${typography.panelMeta} inline-flex items-center px-2.5 py-1 rounded-full border transition-colors cursor-pointer ${
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
              <p className={`${typography.panelMeta} text-text-light mt-1`}>{INLINE_LABELS.riskImpactNotSet}</p>
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
        </fieldset>

        {/* Only once something is entered — never said over nothing. */}
        {(probability != null || impact != null) && (
          <p className={`${typography.panelMeta} text-text-light mt-2`}>Severity combines the likelihood and impact entered above.</p>
        )}
      </PanelGroup>
      )}

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
      {/* ⚠ `RiskAdvancedEditor`'s Description field commits `setDescription`,
          a bare store write with no carrier — fenced here exactly as the factor
          pane fences its editor (review 2038). */}
      <TechnicalDisclosure visible={techMode}>
        <fieldset disabled={readOnly} className="contents" data-writer-fence="advanced-editor">
          <RiskAdvancedEditor nodeId={nodeId} />
        </fieldset>
      </TechnicalDisclosure>
    </div>
  )
})
