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
import { getDisplayEdgeId } from '../../utils/edgeIdentity'
import { NON_EVIDENCE_PROVENANCE } from '../../utils/evidenceCoverage'
import { trackMeasurement } from '../../../telemetry/measurementEvents'
import { bucketDwellMs } from '../../../telemetry/measurementConfig'
import type { ValidationMetadata, UserAction } from '../../domain/validation'
import { SignedStrengthSlider } from '../../ui/inspector/SignedStrengthSlider'
import {
  getDirectionalStrengthLabel,
  getStrengthBand,
  getConfidenceLabel,
  getExistenceLabel,
  getBasisLabel,
  getContestedReasonLabel,
  getSignedMidpoint,
  STRENGTH_BAND_MIDPOINTS,
  type StrengthBand,
} from './strengthBands'
import {
  resolveEdgeDirectionDisplay,
  directionFromProducerSignedMean,
  type EdgeValueSource,
} from '../../domain/edgeValueProvenance'

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
  /**
   * `directionSource` carries the PROVENANCE OF THE SIGN in `customMean`
   * (ROADMAP 2.263): `'user'` when the user stated the direction themselves,
   * `'cee'`/`'template'` when the sign rode along from a producer, and `null`
   * when nothing states one — in which case the writer must leave `direction`
   * and its stamp alone rather than deriving a direction from the number.
   */
  onResolve: (
    edgeId: string,
    action: UserAction,
    customMean?: number,
    directionSource?: EdgeValueSource | null,
  ) => void
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

  // Use canonical display edge id for highlight wiring (matches the rest of
  // RelationshipsSection / EdgeCard). Existing `edge.id` callsites in this
  // component (resolve handlers, slider) are preserved as-is.
  const displayEdgeId = getDisplayEdgeId(edge)

  // Bidirectional row → graph hover highlight. Cleanup on unmount guards
  // against the "tab switch while hovered" case where onMouseLeave never fires.
  useEffect(() => {
    return () => {
      const state = useCanvasStore.getState()
      if (state.highlightedEdges?.has(displayEdgeId)) {
        state.setHighlightedEdges([])
      }
    }
  }, [displayEdgeId])

  // ── contested_edge_viewed (ROADMAP 1.68) ───────────────────────────────────
  //
  // "Time on contested edges" is one of 1.68's named signals, and this card is
  // the surface the phrase literally refers to. Emitted on UNMOUNT, because the
  // dwell is only known then.
  //
  // ⚠ CLAIM SCOPE, stated honestly: this measures MOUNTED-IN-THE-DOM time, not
  // proven visibility. jsdom cannot prove visibility (CLAUDE.md trap 3) and
  // neither can this event — a card scrolled off-screen still counts. Read it
  // as "the card was in the rendered tree for about this long", and do not let
  // a dashboard label promote it to "the user looked at it".
  //
  // `dwell_ms` is BUCKETED (measurementConfig.dwellBucketsMs). A raw ms dwell
  // is a high-resolution behavioural fingerprint and the measures need the band.
  //
  // NEVER-CAPTURE: the edge ID and the strength BAND (an enum member from the
  // existing strengthBands vocabulary) — never the edge label, never
  // `pass1.strength_mean` itself, which is a model-authored number the card
  // renders three decimal places of.
  const dwellStartRef = useRef<number>(Date.now())
  const bandForDwellRef = useRef<StrengthBand>(getStrengthBand(validation.pass1.strength_mean))
  bandForDwellRef.current = getStrengthBand(validation.pass1.strength_mean)
  useEffect(() => {
    dwellStartRef.current = Date.now()
    return () => {
      trackMeasurement('contested_edge_viewed', {
        edge_id: displayEdgeId,
        dwell_ms: bucketDwellMs(Date.now() - dwellStartRef.current),
        strength_band: bandForDwellRef.current,
        scenario_id: useCanvasStore.getState().currentScenarioId ?? null,
      })
    }
  }, [displayEdgeId])

  const handleHoverEnter = useCallback(() => {
    const state = useCanvasStore.getState()
    state.setHighlightedEdges([displayEdgeId])
    state.setHighlightedNodes([])
  }, [displayEdgeId])

  const handleHoverLeave = useCallback(() => {
    const state = useCanvasStore.getState()
    state.setHighlightedEdges([])
  }, [])

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
    // The signed slider IS a direction statement — the user chose the sign.
    onResolve(edgeId, 'overridden', customSignedMean, 'user')
    setShowCustomInput(false)
  }, [edgeId, customSignedMean, onResolve])

  // Quick-set: tap Weak/Moderate/Strong to resolve with the band midpoint.
  //
  // ROADMAP 2.263 — this was `rawDirection === 'negative' ? 'negative' :
  // 'positive'`, so an edge with no stated direction quick-set to a POSITIVE
  // midpoint. That is worse than a bad label: `onResolve` WRITES the value, so
  // a fabricated direction became the user's own recorded resolution.
  //
  // ⚠ AND THE SIGN'S PROVENANCE IS NOT THE USER'S. These pills set a MAGNITUDE
  // — "this effect is moderate" — and say nothing about direction. The sign
  // comes from the edge's stated direction, or failing that from the producer's
  // own pass-2 mean; either way it is the PRODUCER's claim riding along, so it
  // is stamped with that source rather than 'user'. The weight is the user's;
  // the direction is not. (The signed slider below IS a direction statement,
  // and stamps 'user' accordingly.)
  const directionDisplay = resolveEdgeDirectionDisplay(data)

  const handleQuickSet = useCallback((band: Exclude<StrengthBand, 'negligible'>) => {
    const resolved = directionDisplay.show
      ? directionDisplay
      : directionFromProducerSignedMean(validation.pass2.strength_mean)

    // Nothing states a direction — not the edge, and not a finite pass-2 mean.
    // Write the MAGNITUDE alone and let the resolver keep reading "not stated";
    // `null` tells the writer to touch neither `direction` nor its stamp. The
    // old code wrote a constant 'positive' here.
    if (!resolved.show) {
      onResolve(edgeId, 'overridden', STRENGTH_BAND_MIDPOINTS[band], null)
      return
    }
    onResolve(edgeId, 'overridden', getSignedMidpoint(band, resolved.direction), resolved.source)
  }, [edgeId, directionDisplay, validation.pass2.strength_mean, onResolve])

  // ── Derived display values ─────────────────────────────────────────────────

  const pass1Mean   = validation.pass1.strength_mean
  const pass2Mean   = validation.pass2.strength_mean
  // Both pass means are PRODUCER-SIGNED by the CEE two-pass validator, and each
  // pass has no direction field of its own — the sign IS that pass's stated
  // direction. Reading it is not the banned magnitude inference; see
  // `directionFromProducerSignedMean`'s header for the distinction.
  const pass1Label  = getDirectionalStrengthLabel(pass1Mean, directionFromProducerSignedMean(pass1Mean))
  const pass2Label  = getDirectionalStrengthLabel(pass2Mean, directionFromProducerSignedMean(pass2Mean))
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

  // Active band for the quick-set pills — always the band of the current model
  // value (pass1.strength_mean), so the pill highlight reflects "where the edge
  // sits today" rather than "what we're about to set". Rendered only while pending.
  const activeBand: StrengthBand = getStrengthBand(pass1Mean)

  return (
    <div
      ref={cardRef}
      className={cardClass}
      data-testid={`contested-card-${edgeId}`}
      onMouseEnter={handleHoverEnter}
      onMouseLeave={handleHoverLeave}
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
          Resolving this is worth ~{validation.evoi_impact} percentage points of confidence in which option is most likely to hit your goal.
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

      {/* ── Quick-set pills (pending only) ──────────────────────────────────── */}
      {!isResolved && !showCustomInput && (
        <div
          className="flex items-center gap-1.5 mb-1.5 flex-wrap"
          data-testid={`contested-quickset-${edgeId}`}
        >
          <span className={`${typography.panelMeta} text-text-light shrink-0`}>Quick set:</span>
          {(['weak', 'moderate', 'strong'] as const).map(band => {
            const isActive = activeBand === band
            return (
              <button
                key={band}
                type="button"
                onClick={() => handleQuickSet(band)}
                className={`px-2 py-0.5 rounded-full ${typography.panelMeta} bg-transparent border transition-colors ${
                  isActive
                    ? 'border-info/30 text-info'
                    : 'border-panel-border text-text-body hover:border-info/30'
                }`}
                data-testid={`contested-quickset-${band}-${edgeId}`}
              >
                {band.charAt(0).toUpperCase() + band.slice(1)}
              </button>
            )
          })}
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
                  {isFragile ? 'Sensitive' : 'Stable'}
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
