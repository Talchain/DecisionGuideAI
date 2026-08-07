/**
 * FactorsSection — factor cards sorted by influence (post-analysis) or alphabetically.
 *
 * Each card shows:
 *   - Label (clickable → canvas focus)
 *   - Category pill (Controllable / Observable / External)
 *   - Value chip (editable, auto-tags source: 'user')
 *   - Source provenance pill
 *   - Influence bar (post-analysis only)
 *
 * External factors show prior range instead of value.
 * "Show full detail" expansion: normalised value, cap, uncertainty drivers, node ID.
 */

import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { Node } from '@xyflow/react'
import { Check, MessageCircle } from 'lucide-react'
import { typography } from '../../../styles/typography'
import { SectionErrorBoundary } from '../GraphTextView'
import { useNodeMutations } from '../../ui/inspector-v2/useInspectorMutations'
import { useOptionalConversationContext } from '../../conversation/ConversationContext'
import { buildFactorValueEditEvent } from '../../conversation/factorValueEdit'
import { captureOptimisticFactorEdit } from '../../conversation/optimisticFactorEdit'
import { Accordion } from '../../../components/results/Accordion'
import { focusNodeById } from '../../utils/focusHelpers'
import { formatSmartNumber, formatValueWithUnit, getPrimaryValue, countFactorsToVerify } from './utils'
import { classifyUnit } from '../../utils/labelUtils'
import { InlineEdit } from './InlineEdit'
import { SourceProvenancePill } from './SourceProvenancePill'
import { DataBar } from '../../ui/shared/DataBar'
import { DetailToggleContext } from './DetailToggleContext'
import { CoachingCard } from './CoachingCard'
import type { ObservedState, FactorInfluenceMap } from './types'
import {
  factorConfidenceDisclosure,
  type FactorConfidenceDisplay,
} from '../../../components/results/driverConfidenceDisplayPolicy'

// ── Category badge ─────────────────────────────────────────────────────────────

const CATEGORY_STYLES: Record<string, { border: string; label: string }> = {
  controllable: { border: 'border-info/30', label: 'Controllable' },
  observable:   { border: 'border-factor/30', label: 'Observable' },
  external:     { border: 'border-warning/30', label: 'External' },
}

function CategoryBadge({ category }: { category?: string }) {
  if (!category) return null
  const style = CATEGORY_STYLES[category]
  if (!style) return null
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full ${typography.panelMeta} font-medium bg-transparent border ${style.border} text-text-body`}
    >
      {style.label}
    </span>
  )
}

// ── Attribution stability pill ────────────────────────────────────────────────

const STABILITY_STYLES: Record<string, { border: string; label: string }> = {
  high:       { border: 'border-success/30', label: 'High stability' },
  moderate:   { border: 'border-info/30', label: 'Moderate stability' },
  low:        { border: 'border-warning/30', label: 'Low stability' },
  negligible: { border: 'border-danger/30', label: 'Negligible stability' },
}

function AttributionStabilityPill({ level }: { level: string | undefined }) {
  if (!level) return null
  const style = STABILITY_STYLES[level]
  if (!style) return null
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full ${typography.panelMeta} font-medium bg-transparent border ${style.border} text-text-body`}
      data-testid="attribution-stability-pill"
    >
      {style.label}
    </span>
  )
}

// ── Range derivation badge ───────────────────────────────────────────────────

/** Non-confirmed tiers that warrant an "Estimated range" badge */
const ESTIMATED_RANGE_SOURCES = new Set([
  'inferred_baseline', 'inferred_value', 'inferred_spread', 'default',
])

function RangeDerivationBadge({ source }: { source: string | undefined }) {
  if (!source || !ESTIMATED_RANGE_SOURCES.has(source)) return null
  const tooltip = `Range estimated from ${source.replace(/_/g, ' ')}. Consider confirming the plausible range.`
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full ${typography.panelMeta} font-medium bg-transparent border border-danger/30 text-text-body`}
      title={tooltip}
      data-testid="range-derivation-badge"
    >
      Estimated range
    </span>
  )
}

// ── Synthesised prior ─────────────────────────────────────────────────────────

export interface SynthesisedPrior {
  rangeMin: number
  rangeMax: number
}

// ── Factor card ────────────────────────────────────────────────────────────────

function FactorCard({
  node,
  influence,
  synthesisedPrior,
  isSelected,
  attributionStability,
  showAttributionStability,
  hasAnalysisData,
  elasticity,
  rankFlipRate,
  factorConfidence,
}: {
  node: Node
  influence: number | undefined
  synthesisedPrior?: SynthesisedPrior
  isSelected?: boolean
  /** Attribution stability label from PLoT (when present) */
  attributionStability?: string
  /** Whether to show the stability pill — hidden when all factors share same label */
  showAttributionStability?: boolean
  /** Whether post-analysis data is available */
  hasAnalysisData?: boolean
  /** Elasticity value from PLoT */
  elasticity?: number
  /** Rank flip rate from PLoT bootstrap */
  rankFlipRate?: number
  /**
   * Factor confidence RESOLVED THROUGH THE DISPLAY POLICY (F9).
   *
   * This was `factorConfidence?: number` — a bare number with no provenance
   * companion, so any future caller could re-open the display fork silently,
   * with no call to `resolveFactorConfidenceDisplay` anywhere in the diff.
   * The policy module's own header claimed that could not happen. Taking the
   * union makes the claim true by construction.
   */
  factorConfidence?: FactorConfidenceDisplay
}) {
  const cardRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (isSelected) {
      cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [isSelected])
  const { showDetail } = useContext(DetailToggleContext)
  const [cardExpanded, setCardExpanded] = useState(false)

  // ROADMAP 2.121 slice 1 — the Model tab writes through the SANCTIONED setters
  // (the `NODE_SETTER_FIELDS` manifest the writtenFields guard spec enforces),
  // never a hand-rolled `updateNode`. The four hand-rolled handlers that used to
  // live below spread a `data` object captured at RENDER time back over the node
  // on every commit, and one of them (`handleRawValueSave`) wrote `raw_value`
  // without recomputing the model-scale `value`.
  const mutations = useNodeMutations(node.id)

  // ROADMAP 2.121 slice 1 / #513 — a Model-tab value commit is a REAL TURN.
  //
  // Optional by design, exactly as `FactorControllablePanel` does it: the Model
  // tab renders in surfaces that are not inside the ConversationProvider (and in
  // unit tests), and a missing provider must degrade to "local edit only", never
  // throw. Routing through the context's `sendSystemEvent` is also what puts
  // these edits behind `useConversation`'s deferral buffer — an edit committed
  // during a running analysis is queued and flushed when the in-flight lock
  // clears, identically to an inspector edit. A private transport here would
  // have bypassed that.
  const sendSystemEvent = useOptionalConversationContext()?.sendSystemEvent

  const data = node.data as Record<string, unknown>
  const label = String(data?.label ?? node.id)
  const category = data?.category as string | undefined
  const obs: ObservedState = ((data?.observedState ?? data?.observed_state ?? {}) as ObservedState)
  const isExternal = category === 'external'
  const rangeDerivationSource = obs.range_derivation_source as string | undefined

  const explicitPriorMin: number | undefined = (data?.prior as Record<string, unknown>)?.range_min as number | undefined
  const explicitPriorMax: number | undefined = (data?.prior as Record<string, unknown>)?.range_max as number | undefined
  const hasExplicitPrior = explicitPriorMin !== undefined && explicitPriorMax !== undefined
  const priorSource = (data?.prior as Record<string, unknown>)?.source as string | undefined

  // Fall back to synthesised prior when no explicit prior set
  const priorRangeMin = hasExplicitPrior ? explicitPriorMin : synthesisedPrior?.rangeMin
  const priorRangeMax = hasExplicitPrior ? explicitPriorMax : synthesisedPrior?.rangeMax
  const hasPriorRange = priorRangeMin !== undefined && priorRangeMax !== undefined
  const isSynthesisedPrior = hasExplicitPrior
    ? priorSource === 'synthesised_from_observed_state'
    : synthesisedPrior !== undefined

  const primaryValue = getPrimaryValue(obs)
  const normalisedValue = obs.value !== undefined ? formatSmartNumber(obs.value) : null

  const validateNumeric = useCallback((s: string) => !isNaN(parseFloat(s)), [])

  /**
   * ONE commit path for BOTH value inputs — the raw-value chip and the
   * normalised-value chip. It used to be two handlers, and that duplication was
   * the split-brain: the raw one wrote `raw_value` and left the model-scale
   * `value` at its old number, so the card showed the new figure while the
   * engine kept consuming the old one.
   *
   * `buildFactorValueEditEvent` owns the scale contract (`resolveValueInputSeed`
   * decides, from the node's OWN cap/unit, whether the typed number is a
   * user-unit magnitude or an already-model-scale one; `normaliseRawFactorValue`
   * does the conversion). That is why one handler can serve both chips: the
   * scale is derived from the node, not from which chip was clicked. Building
   * the event FIRST and feeding both the store write and the wire from it is
   * what makes the two structurally unable to disagree.
   */
  const handleValueCommit = useCallback((val: string) => {
    const num = parseFloat(val)
    if (isNaN(num)) return

    const event = buildFactorValueEditEvent({
      nodeId: node.id,
      typedValue: num,
      // The node's data as it is BEFORE the local write — its cap/unit is what
      // decides the scale of what the user typed.
      nodeData: data,
    })
    // Fail CLOSED: an unencodable edit (no id, non-finite number) writes
    // nothing rather than committing a number the wire cannot carry.
    if (!event) return
    const { value: modelValue, raw_value: rawMagnitude } = event.payload as {
      value: number
      raw_value?: number
    }

    // ROADMAP 2.129 (b) — capture the undo BEFORE the write, from the same
    // pre-write `data` the event was built from. The optimistic write below is
    // what makes the canvas responsive; this is what stops it becoming a lie when
    // CEE refuses the number (out-of-cap, live-proven: canvas showed 25 months
    // and stamped "User edited" while the engine held 3).
    const undo = captureOptimisticFactorEdit(node.id, modelValue, data)

    // Local write first, in ONE update: value + raw_value + the provenance
    // stamp. `source: 'user'` is preserved from the old handlers — it is what
    // flips the pill to "User edited" and drops the factor out of the
    // "N to verify" count.
    mutations.setObservedValue(modelValue, rawMagnitude, { source: 'user' })

    // Then the wire. Before this, the chain ENDED at the store write: the edit
    // never reached CEE, its graph_hash never moved, and the re-run the
    // freshness strip invited could not possibly reflect the change.
    if (!sendSystemEvent) return
    void Promise.resolve(
      // The undo travels WITH the send, not around it: the dispatcher owns the
      // reply (and the deferral buffer, so an edit made mid-analysis is resolved
      // by the same path). A `.then` here could not see a DEFERRED edit's reply
      // at all — that promise resolves with SEND_DEFERRED before the turn exists.
      sendSystemEvent(event, undo ? { optimisticFactorEdit: undo } : undefined),
    ).catch(() => {
      // Swallowed deliberately: a genuine send failure is already recorded by
      // the conversation's own failure channel (see FactorControllablePanel for
      // why this catch is NOT what protects an edit made during a running
      // analysis — the dispatcher's deferral buffer is). A server REFUSAL is not
      // a failure and never reaches here; the dispatcher's revert handles it.
    })
  }, [node.id, data, mutations, sendSystemEvent])

  /**
   * Baseline is NOT the value, and no longer pretends to be.
   *
   * The old handler stamped `observedState.source = 'user'` on a baseline edit.
   * `source` describes the provenance of the observed VALUE — it drives the
   * "AI estimate" pill and the "N to verify" count — so stamping it here
   * asserted that the user had confirmed a number they never touched. The
   * sanctioned setter writes the baseline and nothing else, which is the honest
   * write; the false provenance claim goes with the handler.
   */
  const handleBaselineSave = useCallback((val: string) => {
    const num = parseFloat(val)
    if (isNaN(num)) return
    mutations.setObservedBaseline(num)
  }, [mutations])

  // `setPriorRange` commits BOTH bounds, which also closes a latent bug in the
  // old per-bound handlers: on a SYNTHESISED prior (the displayed bounds come
  // from the repair map, not from `data.prior`) writing one bound left
  // `hasExplicitPrior` false, so the card kept rendering the synthesised pair
  // and the user's edit was invisible. Both chips only render when both bounds
  // are known, and the guard below fails closed if that ever stops holding
  // rather than writing an `undefined` bound.
  const handlePriorMinSave = useCallback((val: string) => {
    const num = parseFloat(val)
    if (isNaN(num) || priorRangeMax === undefined) return
    mutations.setPriorRange(num, priorRangeMax)
  }, [mutations, priorRangeMax])

  const handlePriorMaxSave = useCallback((val: string) => {
    const num = parseFloat(val)
    if (isNaN(num) || priorRangeMin === undefined) return
    mutations.setPriorRange(priorRangeMin, num)
  }, [mutations, priorRangeMin])

  // Task 7: Coaching on defaulted controllable factors
  const isDefaultedControllable =
    category === 'controllable' &&
    obs.value === 0 &&
    obs.source === 'cee_inference'

  const coachingDismissKey = `olumi:coach:factor-default:${node.id}`
  const [coachingDismissed, setCoachingDismissed] = useState(() =>
    sessionStorage.getItem(coachingDismissKey) === '1'
  )

  const dismissCoaching = useCallback(() => {
    sessionStorage.setItem(coachingDismissKey, '1')
    setCoachingDismissed(true)
  }, [coachingDismissKey])

  // Task 8: Verify/confirm button
  const showConfirmButton = obs.source !== 'user' && (primaryValue !== null || normalisedValue !== null)
  const [confirmFlash, setConfirmFlash] = useState(false)
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (flashTimerRef.current) clearTimeout(flashTimerRef.current) }, [])

  // Confirm changes the PROVENANCE of the existing number, not the number. It
  // therefore has no value to put on the wire (`factor_value_edit.field` is the
  // literal `'value'` and the contract carries no confirm event), and routes
  // through the sanctioned source setter only. Stated plainly rather than
  // hidden: a confirm is a local annotation today, not a turn.
  const handleConfirmValue = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    mutations.setObservedSource('user')
    // Flash success
    setConfirmFlash(true)
    flashTimerRef.current = setTimeout(() => setConfirmFlash(false), 300)
    // Auto-dismiss coaching if it was showing
    if (isDefaultedControllable && !coachingDismissed) {
      sessionStorage.setItem(coachingDismissKey, '1')
      setCoachingDismissed(true)
    }
  }, [mutations, isDefaultedControllable, coachingDismissed, coachingDismissKey])

  const uncertaintyDrivers = obs.uncertainty_drivers

  return (
    <div
      ref={cardRef}
      className={`bg-panel-hover rounded-lg p-2.5 mb-2 last:mb-0 transition-shadow cursor-pointer${isSelected ? ' ring-1 ring-info/50' : ''}`}
      data-testid={`factor-card-${node.id}`}
      onClick={() => setCardExpanded(prev => !prev)}
    >
      {/* Header row: label + badges */}
      <div className="flex items-start gap-1.5 mb-1.5 flex-wrap">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); focusNodeById(node.id) }}
          className={`${typography.panelHeader} text-text-header hover:text-info hover:underline flex-1 min-w-0 text-left leading-snug transition-colors`}
        >
          {label}
        </button>
        <CategoryBadge category={category} />
        <SourceProvenancePill source={obs.source} />
        <RangeDerivationBadge source={rangeDerivationSource} />
      </div>

      {isExternal ? (
        /* External: prior range */
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`${typography.panelMeta} text-text-light w-12 shrink-0`}>Prior</span>
            {hasPriorRange ? (
              <>
                <InlineEdit
                  value={String(priorRangeMin)}
                  displayValue={formatSmartNumber(priorRangeMin!)}
                  onSave={handlePriorMinSave}
                  validate={validateNumeric}
                  maxWidth="max-w-[60px]"
                  numeric
                  testId={`factor-${node.id}-prior-min`}
                />
                <span className={`${typography.panelMeta} text-text-light`}>–</span>
                <InlineEdit
                  value={String(priorRangeMax)}
                  displayValue={formatSmartNumber(priorRangeMax!)}
                  onSave={handlePriorMaxSave}
                  validate={validateNumeric}
                  maxWidth="max-w-[60px]"
                  numeric
                  testId={`factor-${node.id}-prior-max`}
                />
                {isSynthesisedPrior && (
                  <span className={`${typography.panelMeta} text-text-light`}>· from model repair</span>
                )}
                {!obs.unit && !isSynthesisedPrior && (
                  <span className={`${typography.panelMeta} text-text-light`} data-testid={`factor-${node.id}-normalised-range`}>(normalised)</span>
                )}
              </>
            ) : (
              <>
                <span
                  className={`${typography.panelMeta} text-text-light`}
                  data-testid={`factor-${node.id}-default-range`}
                >
                  0 – 1 (uniform)
                </span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); focusNodeById(node.id) }}
                  className={`inline-flex items-center px-2 py-0.5 rounded-full border border-info/30 text-text-body hover:bg-panel-hover transition-colors ${typography.panelMeta} font-medium`}
                  data-testid={`factor-${node.id}-refine-range`}
                >
                  Refine range
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        /* Non-external: value + baseline + source + influence */
        <div className="space-y-1">
          {/* Value row */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`${typography.panelMeta} text-text-light w-12 shrink-0`}>Value</span>
            {primaryValue !== null ? (
              <InlineEdit
                value={String(obs.raw_value ?? obs.value ?? '')}
                displayValue={primaryValue}
                onSave={handleValueCommit}
                validate={validateNumeric}
                maxWidth="max-w-[100px]"
                numeric
                tooltip="Click to edit value"
                testId={`factor-${node.id}-raw-value`}
              />
            ) : normalisedValue !== null ? (
              <>
                <InlineEdit
                  value={String(obs.value ?? '')}
                  displayValue={normalisedValue}
                  onSave={handleValueCommit}
                  validate={validateNumeric}
                  maxWidth="max-w-[80px]"
                  numeric
                  tooltip="Click to edit value"
                  testId={`factor-${node.id}-value`}
                />
                <span className={`${typography.panelMeta} text-text-light`} data-testid={`factor-${node.id}-normalised-label`}>(normalised)</span>
              </>
            ) : (
              <span
                className={`${typography.panelBody} text-text-light`}
                data-testid={`factor-${node.id}-not-set`}
              >
                Not set
              </span>
            )}
            {showDetail && obs.value !== undefined && (
              <span className={`${typography.panelMeta} text-text-light font-mono`} data-testid={`factor-${node.id}-inline-norm`}>
                n:{obs.value.toFixed(2)}
              </span>
            )}
            {showConfirmButton && (
              <button
                type="button"
                onClick={handleConfirmValue}
                className={`inline-flex items-center p-0.5 rounded border transition-colors ${
                  confirmFlash
                    ? 'border-success/60 text-success bg-success/10'
                    : 'border-success/30 text-text-light hover:text-success hover:bg-success/10'
                } ${typography.panelMeta}`}
                title="Confirm this value is correct"
                data-testid={`factor-${node.id}-confirm`}
              >
                <Check className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Coaching: defaulted controllable factors */}
          {isDefaultedControllable && !coachingDismissed && (
            <div className="flex items-start gap-1.5 mt-1 p-2 rounded-lg bg-warning/[0.06] border border-warning/25" data-testid={`factor-${node.id}-coaching`}>
              <span className={`${typography.panelMeta} text-text-light leading-relaxed italic flex-1`}>
                This factor defaulted to 0. Set a value or confirm it's correct.
              </span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); dismissCoaching() }}
                className={`${typography.panelMeta} text-text-light hover:text-text-body shrink-0`}
                aria-label="Dismiss coaching"
                data-testid={`factor-${node.id}-coaching-dismiss`}
              >
                ×
              </button>
            </div>
          )}

          {/* Baseline row */}
          {cardExpanded && obs.baseline !== undefined && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={`${typography.panelMeta} text-text-light w-12 shrink-0`}>Baseline</span>
              <InlineEdit
                value={String(obs.baseline)}
                onSave={handleBaselineSave}
                validate={validateNumeric}
                maxWidth="max-w-[80px]"
                numeric
                suffix={obs.unit && classifyUnit(obs.unit).kind !== 'placeholder' ? obs.unit : undefined}
                testId={`factor-${node.id}-baseline`}
              />
            </div>
          )}

          {/* Influence bar + stability pill (post-analysis only) */}
          {cardExpanded && influence !== undefined && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={`${typography.panelMeta} text-text-light w-12 shrink-0`}>Influence</span>
              <DataBar value={influence} label="Influence" colour="info" trailingLabel={`${Math.round(influence * 100)}%`} />
              {hasAnalysisData && showAttributionStability && <AttributionStabilityPill level={attributionStability} />}
            </div>
          )}

          {/* ⛔ REMOVED: the EVPI chip — "Worth {evpiPp}pp if resolved: your
              knowledge of {label} would improve confidence by {evpiPp}
              percentage points". The strongest value claim the product made
              about a single factor, and it was refuted by our own compute
              layer: ISL measured 0.0pp for the very factors PLoT scored at
              12.3 / 10.2 / 6.6 in the same payload. Do not reinstate. */}
        </div>
      )}

      {/* Full detail expansion */}
      {cardExpanded && showDetail && (
        <div className="mt-2 pt-2 border-t border-panel-border">
          {/* Group 1: Current state — only shown when there is something to display */}
          {(isExternal ? (priorRangeMin !== undefined && priorRangeMax !== undefined) : obs.value !== undefined || obs.cap !== undefined) && (
            <>
              <div className={`${typography.panelMeta} text-text-light font-medium mb-1`}>Current state</div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                {isExternal && priorRangeMin !== undefined && priorRangeMax !== undefined && (
                  <>
                    <span className={`${typography.panelMeta} text-text-light`}>Prior range</span>
                    <span className={`${typography.panelBody} text-text-body font-mono text-right`}>
                      {formatSmartNumber(priorRangeMin)} – {formatSmartNumber(priorRangeMax)}
                    </span>
                  </>
                )}
                {!isExternal && obs.value !== undefined && (
                  <>
                    <span className={`${typography.panelMeta} text-text-light`}>Normalised value</span>
                    <span className={`${typography.panelBody} text-text-body font-mono text-right`}>
                      {obs.value.toFixed(2)}
                    </span>
                  </>
                )}
                {obs.cap !== undefined && (
                  <>
                    <span className={`${typography.panelMeta} text-text-light`}>Cap</span>
                    <span className={`${typography.panelBody} text-text-body font-mono text-right`}>
                      {obs.unit ? formatValueWithUnit(obs.cap, obs.unit) : formatSmartNumber(obs.cap)}
                    </span>
                  </>
                )}
              </div>
            </>
          )}

          {/* Group 2: Sensitivity — only shown when at least one sensitivity metric exists */}
          {((uncertaintyDrivers && uncertaintyDrivers.length > 0) || elasticity != null || rankFlipRate != null || factorConfidence?.show === true) && (
            <div className="border-t border-panel-border mt-2 pt-2">
              <div className={`${typography.panelMeta} text-text-light font-medium mb-1`}>Sensitivity</div>
              {uncertaintyDrivers && uncertaintyDrivers.length > 0 && (
                <div className="mb-1">
                  <span className={`${typography.panelMeta} text-text-light`}>Uncertainty drivers</span>
                  <p className={`${typography.panelBody} text-text-body mt-0.5`}>{uncertaintyDrivers.join(', ')}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                {/* ⛔ REMOVED: the `EVPI  {evpiPp}pp` metric row. Same refuted
                    figure as the chip above, presented as a precise metric. */}
                {elasticity != null && (
                  <>
                    <span className={`${typography.panelMeta} text-text-light`}>Elasticity</span>
                    <span className={`${typography.panelBody} text-text-body font-mono text-right`}>
                      {elasticity.toFixed(2)}
                    </span>
                  </>
                )}
                {rankFlipRate != null && (
                  <>
                    <span className={`${typography.panelMeta} text-text-light`}>Rank flip rate</span>
                    <span className={`${typography.panelBody} text-text-body font-mono text-right`}>
                      {rankFlipRate.toFixed(2)}
                    </span>
                  </>
                )}
                {factorConfidence?.show === true && (
                  <>
                    <span
                      className={`${typography.panelMeta} text-text-light`}
                      title={factorConfidenceDisclosure(factorConfidence) ?? undefined}
                    >
                      Confidence
                    </span>
                    <span className={`${typography.panelBody} text-text-body font-mono text-right`}>
                      {Math.round(factorConfidence.value * 100)}%
                    </span>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Group 3: Metadata */}
          <div className="border-t border-panel-border mt-2 pt-2">
            <div className={`${typography.panelMeta} text-text-light font-medium mb-1`}>Metadata</div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
              <span className={`${typography.panelMeta} text-text-light`}>Node ID</span>
              <span className={`${typography.panelBody} text-text-body font-mono text-right`} style={{ overflowWrap: 'anywhere', wordBreak: 'break-all' }}>
                {node.id}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Section ────────────────────────────────────────────────────────────────────

interface FactorsSectionProps {
  factorNodes: Node[]
  factorInfluence?: FactorInfluenceMap
  synthesisedPriorMap?: Map<string, SynthesisedPrior>
  selectedNodeIds?: Set<string>
  /** Attribution stability map: factorId → level string */
  attributionStabilityMap?: Map<string, string>
  /** Elasticity map: factorId → raw elasticity */
  elasticityMap?: Map<string, number>
  /** Rank flip rate map: factorId → rate */
  rankFlipRateMap?: Map<string, number>
  /** Factor confidence map: factorId → resolved display (F9; never a bare number). */
  factorConfidenceMap?: Map<string, FactorConfidenceDisplay>
  /** Whether post-analysis data is available */
  hasAnalysisData?: boolean
  onSendMessage?: (message: string) => void
  /** Controlled expansion state */
  isExpanded?: boolean
  /** Callback when expansion state changes */
  onExpandChange?: (expanded: boolean) => void
}

function FactorsSectionInner({
  factorNodes, factorInfluence, synthesisedPriorMap, selectedNodeIds,
  attributionStabilityMap, elasticityMap, rankFlipRateMap, factorConfidenceMap,
  hasAnalysisData, onSendMessage, isExpanded, onExpandChange,
}: FactorsSectionProps) {
  // All hooks must run before any conditional return (Rules of Hooks)

  // Only show stability pills when there is differentiation across factors.
  // If every factor has the same label (or none have data), pills add no information.
  const showAttributionStability = useMemo(() => {
    if (!attributionStabilityMap || attributionStabilityMap.size === 0) return false
    const labels = new Set(attributionStabilityMap.values())
    return labels.size > 1
  }, [attributionStabilityMap])

  const sorted = useMemo(() => {
    // ⛔ The EVPI-descending branch that used to sit here is REMOVED. Ordering
    // is a claim: #477 landed one commit earlier specifically to close the
    // "NON-TEXT channels — order, bar, stroke — that still spoke the default",
    // and an EVPI-ranked list under a visible 'ranked by EVPI' label was that
    // exact class. Influence — PLoT's normalised impact, already the fallback
    // whenever EVPI was absent — now orders the list in every post-analysis
    // case, so this is the file's own pre-existing second choice, not a new
    // ranking invented here.
    // Post-analysis: sort by influence descending
    if (hasAnalysisData && factorInfluence && factorInfluence.size > 0) {
      return [...factorNodes].sort((a, b) => {
        const ia = factorInfluence.get(a.id) ?? -1
        const ib = factorInfluence.get(b.id) ?? -1
        return ib - ia
      })
    }
    // Pre-analysis: alphabetical
    return [...factorNodes].sort((a, b) => {
      const la = String((a.data as Record<string, unknown>)?.label ?? a.id).toLowerCase()
      const lb = String((b.data as Record<string, unknown>)?.label ?? b.id).toLowerCase()
      return la.localeCompare(lb)
    })
  }, [factorNodes, factorInfluence, hasAnalysisData])

  const toVerifyCount = useMemo(() => countFactorsToVerify(factorNodes), [factorNodes])

  if (factorNodes.length === 0) return null

  return (
    <Accordion
      title="Factors"
      badgeCount={factorNodes.length}
      tierLabel={toVerifyCount > 0 ? `${toVerifyCount} to verify` : undefined}
      tierVariant={toVerifyCount > 0 ? 'needs_work' : undefined}
      defaultExpanded
      isExpanded={isExpanded}
      onExpandChange={onExpandChange}
      testId="model-factors-section"
    >
      {toVerifyCount > 0 && (
        <CoachingCard sectionId="factors-verify">
          Factors marked 'AI estimate' use the AI's assumptions. Your knowledge improves the analysis.
        </CoachingCard>
      )}

      {sorted.map(node => (
        <FactorCard
          key={node.id}
          node={node}
          influence={factorInfluence?.get(node.id)}
          synthesisedPrior={synthesisedPriorMap?.get(node.id)}
          isSelected={selectedNodeIds?.has(node.id)}
          attributionStability={attributionStabilityMap?.get(node.id)}
          showAttributionStability={showAttributionStability}
          elasticity={elasticityMap?.get(node.id)}
          rankFlipRate={rankFlipRateMap?.get(node.id)}
          factorConfidence={factorConfidenceMap?.get(node.id)}
          hasAnalysisData={hasAnalysisData}
        />
      ))}

      {onSendMessage && (
        <div className="flex items-center justify-between mt-2">
          <button
            type="button"
            onClick={() => onSendMessage('I want to add a new factor to the model')}
            className={`${typography.panelMeta} text-info hover:underline cursor-pointer`}
            data-testid="factors-add-cta"
          >
            + Add a factor
          </button>
          <button
            type="button"
            onClick={() => onSendMessage('Help me review the factors in my model and whether the values are reasonable')}
            className="text-text-light hover:text-info cursor-pointer transition-colors"
            title="Discuss this with the AI"
            data-testid="factors-discuss"
          >
            <MessageCircle className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </Accordion>
  )
}

export function FactorsSection(props: FactorsSectionProps) {
  return (
    <SectionErrorBoundary section="factors">
      <FactorsSectionInner {...props} />
    </SectionErrorBoundary>
  )
}
