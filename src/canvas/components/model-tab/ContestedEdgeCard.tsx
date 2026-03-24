/**
 * ContestedEdgeCard — renders a contested edge with both AI estimates,
 * plain-language explanation, and quick-resolve actions.
 *
 * Rendering rules (from validation_ui_data_contract_v1.md):
 *  - Basis label ALWAYS precedes pass2.reasoning (mandatory contract rule)
 *  - evoi_impact: show only when not null, never a placeholder
 *  - Resolved state: success border, reduced opacity, confirmation text + tick
 *  - "Show full detail" expansion controlled by DetailToggleContext
 */

import { useCallback, useContext, useRef, useEffect, useState } from 'react'
import type { Edge, Node } from '@xyflow/react'
import { AlertTriangle, Check } from 'lucide-react'
import { typography } from '../../../styles/typography'
import { DetailToggleContext } from './DetailToggleContext'
import { focusNodeById, focusEdgeById } from '../../utils/focusHelpers'
import { useCanvasStore } from '../../store'
import { NON_EVIDENCE_PROVENANCE } from '../../utils/evidenceCoverage'
import type { ValidationMetadata, UserAction } from '../../domain/validation'
import { SignedStrengthSlider } from '../../ui/inspector/SignedStrengthSlider'
import {
  getStrengthLabel,
  getStrengthBand,
  getConfidenceLabel,
  getExistenceLabel,
  getBasisLabel,
  getContestedReasonLabel,
} from './strengthBands'

// ── Props ─────────────────────────────────────────────────────────────────────

interface ContestedEdgeCardProps {
  edge: Edge
  nodes: Node[]
  validation: ValidationMetadata
  isFragile: boolean
  /** Whether robustness data is available (analysis has run) — enables robustness row in detail */
  hasRobustnessData?: boolean
  isSelected?: boolean
  /** Called when user resolves the edge. */
  onResolve: (edgeId: string, action: UserAction, customMean?: number) => void
}

// ── Resolved confirmation copy ────────────────────────────────────────────────

function resolvedLabel(action: UserAction): string {
  switch (action) {
    case 'accepted_pass1': return 'Kept current value'
    case 'accepted_pass2': return 'Used review value'
    case 'overridden':     return 'Custom value entered'
    case 'dismissed':      return 'Skipped'
    default:               return 'Resolved'
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ContestedEdgeCard({
  edge,
  nodes,
  validation,
  isFragile,
  hasRobustnessData,
  isSelected,
  onResolve,
}: ContestedEdgeCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (isSelected) {
      cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [isSelected])

  const { showDetail } = useContext(DetailToggleContext)

  // Custom-value override state — slider outputs signed mean directly
  // Clamp initial value to [-1, 1] to stay within slider range
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [customSignedMean, setCustomSignedMean] = useState(
    Math.max(-1, Math.min(1, validation.pass1.strength_mean))
  )

  const edgeId = edge.id
  const data = edge.data as Record<string, unknown>

  const sourceNode = nodes.find(n => n.id === edge.source)
  const targetNode = nodes.find(n => n.id === edge.target)
  const fromLabel = String((sourceNode?.data as Record<string, unknown>)?.label ?? edge.source)
  const toLabel   = String((targetNode?.data as Record<string, unknown>)?.label ?? edge.target)

  // Edge label takes precedence over from → to when present
  const edgeLabel = (data?.label as string | undefined) || null

  const isResolved = validation.user_action !== 'pending'

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleAcceptPass1 = useCallback(() => {
    onResolve(edgeId, 'accepted_pass1')
  }, [edgeId, onResolve])

  const handleAcceptPass2 = useCallback(() => {
    onResolve(edgeId, 'accepted_pass2')
  }, [edgeId, onResolve])

  const handleDismiss = useCallback(() => {
    onResolve(edgeId, 'dismissed')
  }, [edgeId, onResolve])

  const handleEnterOwn = useCallback(() => {
    setShowCustomInput(true)
  }, [])

  const handleSliderConfirm = useCallback(() => {
    onResolve(edgeId, 'overridden', customSignedMean)
    setShowCustomInput(false)
  }, [edgeId, customSignedMean, onResolve])

  // ── Derived display values ─────────────────────────────────────────────────

  const pass1Mean   = validation.pass1.strength_mean
  const pass2Mean   = validation.pass2.strength_mean
  const pass1Label  = getStrengthLabel(pass1Mean)
  const pass2Label  = getStrengthLabel(pass2Mean)
  const pass1Band   = getStrengthBand(pass1Mean)
  const pass2Band   = getStrengthBand(pass2Mean)

  // Basis label + reasoning (mandatory: basis label always precedes reasoning)
  const basisLabel  = getBasisLabel(validation.pass2.basis)
  const reasoning   = validation.pass2.reasoning

  // Reason labels (first one only in main card; full list in detail)
  const primaryReason = validation.contested_reasons[0]
    ? getContestedReasonLabel(validation.contested_reasons[0])
    : null

  // Delta magnitude between the two estimates
  const deltaMagnitude = Math.abs(pass1Mean - pass2Mean)

  // evoi_impact: show only when not null
  const hasEvoiImpact = validation.evoi_impact !== null && validation.evoi_impact !== undefined

  // Provenance for detail panel
  const provenance = data?.provenance as string | undefined
  const hasEvidence = provenance && !NON_EVIDENCE_PROVENANCE.includes(provenance)

  // ── Card border class ──────────────────────────────────────────────────────

  const cardClass = [
    'rounded-lg p-2.5 mb-2 last:mb-0 border transition-all',
    isResolved
      ? 'border-success/50 opacity-65 bg-panel'
      : 'border-warning/30 bg-panel',
    isSelected ? 'ring-1 ring-info/50' : '',
  ].filter(Boolean).join(' ')

  return (
    <div
      ref={cardRef}
      className={cardClass}
      data-testid={`contested-card-${edgeId}`}
    >
      {/* ── Header row ──────────────────────────────────────────────────────── */}
      <div className="flex items-start gap-1.5 mb-1.5 flex-wrap">
        <button
          type="button"
          onClick={() => {
            useCanvasStore.getState().selectEdgeWithoutHistory(edgeId)
            focusEdgeById(edgeId)
          }}
          className={`${typography.panelBody} font-medium text-info hover:underline cursor-pointer flex-1 min-w-0 leading-snug text-left`}
        >
          {edgeLabel ?? (
            <>
              {fromLabel}
              <span className="text-text-light mx-1" aria-hidden="true">→</span>
              {toLabel}
            </>
          )}
        </button>
        {/* contested pill */}
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full ${typography.panelMeta} bg-transparent border border-info/30 text-text-body shrink-0`}
          data-testid={`contested-pill-${edgeId}`}
        >
          {isResolved ? resolvedLabel(validation.user_action) : 'contested'}
        </span>
        {/* fragile pill */}
        {isFragile && (
          <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full ${typography.panelMeta} bg-transparent border border-warning/30 text-text-body shrink-0`}>
            <AlertTriangle className="w-2.5 h-2.5 shrink-0" aria-hidden="true" />
            fragile
          </span>
        )}
      </div>

      {/* ── Contested reason + delta magnitude ────────────────────────────── */}
      {primaryReason && !isResolved && (
        <p className={`${typography.panelMeta} text-text-light mb-1`}>
          {primaryReason}
          <span className={`${typography.panelMeta} font-semibold text-warning ml-1`}>
            Δ {deltaMagnitude.toFixed(2)}
          </span>
        </p>
      )}

      {/* ── EVOI impact statement (only when not null) ───────────────────────── */}
      {hasEvoiImpact && !isResolved && (
        <p className={`${typography.panelBody} text-text-body mb-2`} data-testid={`contested-evoi-${edgeId}`}>
          Resolving this is worth ~{validation.evoi_impact} percentage points of confidence in the recommendation.
        </p>
      )}

      {/* ── Estimate block ───────────────────────────────────────────────────── */}
      {!isResolved && (
        <div className="bg-panel-hover rounded-lg p-2 mb-2">
          <p className={`${typography.panelMeta} text-text-light mb-1.5`}>
            How strongly does {fromLabel} affect {toLabel}?
          </p>

          {/* Current model estimate */}
          <div className="flex items-center gap-1.5 mb-1" data-testid={`contested-pass1-${edgeId}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-info shrink-0" aria-hidden="true" />
            <span className={`${typography.panelMeta} text-text-light`}>Current model:</span>
            <span className={`${typography.panelMeta} font-medium text-text-header`}>
              {pass1Label} ({pass1Mean >= 0 ? '+' : ''}{pass1Mean.toFixed(2)})
            </span>
          </div>

          {/* Independent review estimate */}
          <div className="flex items-center gap-1.5 mb-2" data-testid={`contested-pass2-${edgeId}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-option shrink-0" aria-hidden="true" />
            <span className={`${typography.panelMeta} text-text-light`}>Independent review:</span>
            <span className={`${typography.panelMeta} font-medium text-text-header`}>
              {pass2Label} ({pass2Mean >= 0 ? '+' : ''}{pass2Mean.toFixed(2)})
            </span>
          </div>

          {/* Basis prefix + reasoning — mandatory contract format: "Based on {basis}: {reasoning}" */}
          <p
            className={`${typography.panelMeta} text-text-body leading-relaxed`}
            data-testid={`contested-basis-reasoning-${edgeId}`}
          >
            <span className="font-medium text-info" data-testid={`contested-basis-label-${edgeId}`}>
              {basisLabel}:
            </span>{' '}
            <span data-testid={`contested-reasoning-${edgeId}`}>{reasoning}</span>
          </p>
        </div>
      )}

      {/* ── Custom value slider (when "Enter your own" is active) ────────────── */}
      {showCustomInput && !isResolved && (
        <div className="bg-panel-hover rounded-lg p-2 mb-2" data-testid={`contested-custom-slider-${edgeId}`}>
          <p className={`${typography.panelMeta} text-text-light mb-1.5`}>Drag to set your estimate</p>
          <SignedStrengthSlider
            value={customSignedMean}
            onChange={setCustomSignedMean}
            debounceMs={80}
          />
          <div className="flex items-center gap-2 mt-2">
            <button
              type="button"
              onClick={handleSliderConfirm}
              className={`px-3 py-0.5 rounded-lg border border-info/30 ${typography.panelMeta} text-info hover:bg-panel-hover transition-colors`}
              data-testid={`contested-custom-confirm-${edgeId}`}
            >
              Confirm
            </button>
            <button
              type="button"
              onClick={() => setShowCustomInput(false)}
              className={`${typography.panelMeta} text-text-light hover:text-text-body transition-colors`}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Resolve actions (pending only) ───────────────────────────────────── */}
      {!isResolved && (
        <div className="flex gap-1.5 flex-wrap" data-testid={`contested-actions-${edgeId}`}>
          <button
            type="button"
            onClick={handleAcceptPass1}
            className={`px-2.5 py-1 rounded-lg border border-panel-border bg-panel ${typography.panelMeta} text-text-body hover:border-info/30 hover:bg-panel-hover transition-colors`}
            data-testid={`contested-accept-pass1-${edgeId}`}
          >
            Keep current ({pass1Band})
          </button>
          <button
            type="button"
            onClick={handleAcceptPass2}
            className={`px-2.5 py-1 rounded-lg border border-panel-border bg-panel ${typography.panelMeta} text-text-body hover:border-info/30 hover:bg-panel-hover transition-colors`}
            data-testid={`contested-accept-pass2-${edgeId}`}
          >
            Use review ({pass2Band})
          </button>
          {!showCustomInput && (
            <button
              type="button"
              onClick={handleEnterOwn}
              className={`px-2.5 py-1 rounded-lg border border-panel-border bg-panel ${typography.panelMeta} text-text-body hover:border-info/30 hover:bg-panel-hover transition-colors`}
              data-testid={`contested-enter-own-${edgeId}`}
            >
              Enter your own
            </button>
          )}
          <button
            type="button"
            onClick={handleDismiss}
            className={`px-2.5 py-1 rounded-lg border border-transparent ${typography.panelMeta} text-text-light hover:text-text-body transition-colors`}
            data-testid={`contested-dismiss-${edgeId}`}
          >
            Skip
          </button>
        </div>
      )}

      {/* ── "Why this was flagged" expandable detail ──────────────────────── */}
      {!isResolved && (
        <details className="mt-1.5 mb-1" data-testid={`contested-why-${edgeId}`}>
          <summary className={`${typography.panelMeta} text-text-light cursor-pointer hover:text-info inline-flex items-center gap-1`}>
            Why this was flagged
          </summary>
          <div className={`${typography.panelMeta} text-text-light leading-relaxed mt-1.5 p-2 bg-panel-hover rounded-lg`}>
            Pass 1 estimated {pass1Label} ({pass1Mean >= 0 ? '+' : ''}{pass1Mean.toFixed(2)}),
            review estimated {pass2Label} ({pass2Mean >= 0 ? '+' : ''}{pass2Mean.toFixed(2)}).
            Delta: {deltaMagnitude.toFixed(2)}{pass1Band !== pass2Band ? ' crosses the strength band boundary' : ''}.
          </div>
        </details>
      )}

      {/* ── Resolved confirmation ────────────────────────────────────────────── */}
      {isResolved && (
        <div
          className={`flex items-center gap-1.5 ${typography.panelMeta} text-success`}
          data-testid={`contested-resolved-${edgeId}`}
        >
          <Check className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          {resolvedLabel(validation.user_action)}
        </div>
      )}

      {/* ── Full detail expansion ────────────────────────────────────────────── */}
      {showDetail && (
        <div className="mt-2 pt-2 border-t border-panel-border" data-testid={`contested-detail-${edgeId}`}>
          <div className={`${typography.panelMeta} text-text-light font-mono mb-1`}>
            Strength mean (β coefficient) / epistemic uncertainty
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
            <span className={`${typography.panelMeta} text-text-light`}>Strength mean</span>
            <span className={`${typography.panelMeta} text-text-body font-mono text-right`}>
              {pass1Mean >= 0 ? '+' : ''}{pass1Mean.toFixed(3)}
            </span>
            <span className={`${typography.panelMeta} text-text-light`}>Strength std</span>
            <span className={`${typography.panelMeta} text-text-body font-mono text-right`}>
              ±{validation.pass1.strength_std.toFixed(3)}
            </span>
            <span className={`${typography.panelMeta} text-text-light`}>Exists probability</span>
            <span className={`${typography.panelMeta} text-text-body font-mono text-right`}>
              {validation.pass1.exists_probability.toFixed(2)}
            </span>
            <span className={`${typography.panelMeta} text-text-light`}>Effect direction</span>
            <span className={`${typography.panelMeta} text-text-body text-right`}>
              {pass1Mean >= 0 ? 'positive' : 'negative'}
            </span>
            <span className={`${typography.panelMeta} text-text-light`}>Confidence</span>
            <span className={`${typography.panelMeta} text-text-body text-right`}>
              {getConfidenceLabel(validation.pass1.strength_std)}
            </span>
            <span className={`${typography.panelMeta} text-text-light`}>Existence</span>
            <span className={`${typography.panelMeta} text-text-body text-right`}>
              {getExistenceLabel(validation.pass1.exists_probability)}
            </span>
            {hasEvidence && (
              <>
                <span className={`${typography.panelMeta} text-text-light`}>Evidence</span>
                <span className={`${typography.panelMeta} text-text-body text-right`}>{provenance}</span>
              </>
            )}
            <span className={`${typography.panelMeta} text-text-light`}>Edge ID</span>
            <span className={`${typography.panelMeta} text-text-body font-mono text-right truncate`}>
              {edgeId}
            </span>
            {hasRobustnessData && (
              <>
                <span className={`${typography.panelMeta} text-text-light`}>Robustness</span>
                <span
                  className={`${typography.panelMeta} text-right ${isFragile ? 'text-warning' : 'text-success'}`}
                  data-testid={`contested-robustness-${edgeId}`}
                >
                  {isFragile ? 'Fragile' : 'Stable'}
                </span>
              </>
            )}
          </div>
          {/* Contested reasons full list */}
          {validation.contested_reasons.length > 0 && (
            <div className="mt-2">
              <span className={`${typography.panelMeta} text-text-light`}>
                Reasons: {validation.contested_reasons.map(getContestedReasonLabel).join('; ')}
              </span>
            </div>
          )}
          {/* Node reference badges */}
          <div className="flex items-center gap-2 mt-2">
            <button
              type="button"
              onClick={() => sourceNode && focusNodeById(sourceNode.id)}
              className={`${typography.panelMeta} px-2 py-0.5 rounded-full border border-panel-border text-text-body hover:bg-panel-hover transition-colors`}
              data-testid={`contested-node-ref-source-${edgeId}`}
            >
              {fromLabel}
            </button>
            <span className={`${typography.panelMeta} text-text-light`} aria-hidden="true">→</span>
            <button
              type="button"
              onClick={() => targetNode && focusNodeById(targetNode.id)}
              className={`${typography.panelMeta} px-2 py-0.5 rounded-full border border-panel-border text-text-body hover:bg-panel-hover transition-colors`}
              data-testid={`contested-node-ref-target-${edgeId}`}
            >
              {toLabel}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
