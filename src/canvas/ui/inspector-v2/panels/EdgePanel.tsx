/**
 * EdgePanel — Inspector panel for edges (v6.2 three-group layout)
 *
 * Groups: Context → Your input → Evidence
 * Master pattern for all other panel redesigns.
 */

import { memo, useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useCanvasStore } from '../../../store'
import { useRobustness, useEdgeEValues } from '../useAnalysisResults'
import { useEditConfirmation } from '../useEditConfirmation'
import { EditConfirmation } from '../shared/EditConfirmation'
import { InlineRerunPrompt } from '../shared/InlineRerunPrompt'
import { EDGE_CONSTRAINTS } from '../../../domain/edges'
import type { NodeType } from '../../../domain/nodes'
import { SignedStrengthSlider } from '../../inspector/SignedStrengthSlider'
import { InspectorCoaching } from '../shared/InspectorCoaching'
import { typography } from '../../../../styles/typography'
import { useEdgeMutations, type EdgeStrengthConfirmOutcome, type EdgeStrengthCommitOutcome } from '../useInspectorMutations'
import type { SystemEventSendSettlement } from '../../../conversation/settleSystemEventSend'
import {
  GROUP_LABELS,
  INLINE_LABELS,
  ACTION_LABELS,
  EDGE_LINK_NOTICES,
  EDGE_COPY,
  resolveEdgeLinkTemplate,
} from '../inspectorStrings'
import { PanelGroup } from '../shared/PanelGroup'
import { PrimaryControlCard } from '../shared/PrimaryControlCard'
import { ExpertAnnotation } from '../shared/ExpertAnnotation'
import { StaleGuardBanner } from '../shared/StaleGuardBanner'
import { TechnicalDisclosure } from '../shared/TechnicalDisclosure'
import { UncertaintyBand } from '../shared/UncertaintyBand'
import { ResultsLink } from '../shared/ResultsLink'
import type { InspectorPanelProps } from '../types'
import { isEdgeFragile, getFragileEdgeSwitchProbability } from '../../../utils/fragileEdgeMatch'
import { resolveEdgeValuesCoaching } from '../coachingConfig'
import {
  edgeValueBand,
  edgeValueSource,
  resolveEdgeValueDisplay,
  resolveEdgeSignedStrengthDisplay,
  withLiveEdgeValue,
  type EdgeValueBand,
} from '../../../domain/edgeValueProvenance'
import { METRIC_UNSET } from '../../../nodes/shared/metricVocabulary'
import { useEditImpactPreview } from '../../../hooks/useEditImpactPreview'
import { StrengthBandButtons } from '../shared/StrengthBandButtons'
import { EdgeAdvancedEditor } from '../editors/EdgeAdvancedEditor'
import { EdgeReviewDisagreement } from '../shared/EdgeReviewDisagreement'
import { resolveElementLabel } from '../../../domain/elementLabel'
import { edgeStrengthEditIsAssertable } from '../../../conversation/edgeStrengthEdit'
import { serverStatedStrengthOf } from '../../../conversation/edgeServerStatedStrength'
import { formatNumber } from '../../../utils/formatValueWithUnit'

// ─── Slider component for confidence and uncertainty ───────────────
function InspectorSlider({
  value,
  min,
  max,
  step,
  onChange,
  color,
  trackFillColor,
  valueText,
  'aria-label': ariaLabel,
}: {
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  color?: string
  trackFillColor?: string
  /**
   * Human-readable substitute for the numeric value, announced INSTEAD of
   * `aria-valuenow` by assistive tech when present. Used when the value is a
   * fabricated default nobody stated: the visible readout withholds the number,
   * and this stops the accessibility tree announcing the very figure the
   * visible surface refuses to print.
   */
  valueText?: string
  'aria-label': string
}) {
  const debounceRef = useRef<NodeJS.Timeout>()

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => onChange(v), 120)
  }, [onChange])

  useEffect(() => () => clearTimeout(debounceRef.current), [])

  const pct = ((value - min) / (max - min)) * 100

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 relative">
        {trackFillColor && (
          <div className="absolute inset-y-0 flex items-center pointer-events-none" style={{ left: 0, right: 0 }}>
            <div className="w-full h-1 bg-panel-border rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-100"
                style={{ width: `${pct}%`, backgroundColor: trackFillColor }}
                data-testid="inspector-slider-track-fill"
              />
            </div>
          </div>
        )}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={handleChange}
          aria-label={ariaLabel}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          {...(valueText ? { 'aria-valuetext': valueText } : {})}
          className={`w-full ${trackFillColor ? 'relative z-10' : ''}`}
          style={color ? { accentColor: color } : undefined}
        />
      </div>
    </div>
  )
}

// ─── Existence band → channel tokens ───────────────────────────────
//
// ⛔ These used to be `thresholdColor(v: number)` / `thresholdTrackVar(v:
// number)`: three branches each, `>= 0.7` green / `>= 0.4` amber / else red,
// and NO branch that could express "nobody set this". `beliefExists` falls
// through to `EDGE_CONSTRAINTS.beliefExists.default` (0.7) when absent and
// `USER_EDGE_DEFAULTS` pins it at 0.8 when the user simply drew the edge — so
// BOTH unset states banded GREEN, directly beneath this panel's own coaching
// sentence "Nobody has said how likely this connection is to exist yet."
// #472/#473 gated the number; the colour carried the same claim wordlessly,
// and pre-attentively, which makes it the harder one to disbelieve.
//
// The input is now `EdgeValueBand`, which is derived from `EdgeValueDisplay`
// and therefore cannot be produced without a provenance verdict — a future
// caller has no way to ask for "the colour of 0.7, source unknown". `Record`
// rather than `switch`: adding a band is a type error here, not a silent
// inheritance of a neighbour's colour.
const EXISTENCE_BAND_TEXT: Record<EdgeValueBand, string> = {
  unset: 'text-text-light',
  low: 'text-danger',
  moderate: 'text-warning',
  high: 'text-success',
}

// `undefined` ⇒ `InspectorSlider` renders no fill overlay at all. An unset
// value gets a plain track, not a grey bar sized to a number nobody chose.
const EXISTENCE_BAND_TRACK: Record<EdgeValueBand, string | undefined> = {
  unset: undefined,
  low: 'var(--danger)',
  moderate: 'var(--warning)',
  high: 'var(--success)',
}

export const EdgePanel = memo(function EdgePanel({
  edgeId,
  techMode,
  onClose,
  onNavigate,
}: InspectorPanelProps) {
  const edges = useCanvasStore(s => s.edges)
  const nodes = useCanvasStore(s => s.nodes)
  const robustness = useRobustness()
  const edgeEValues = useEdgeEValues()
  const resultsStatus = useCanvasStore(s => s.results?.status)
  const isResultsMode = resultsStatus === 'complete'

  const edge = edgeId ? edges.find(e => e.id === edgeId) : undefined
  const mutations = useEdgeMutations(edgeId ?? '')
  const { confirm: confirmEdit, lastConfirmed, isStaleAfterEdit } = useEditConfirmation()

  // Source/target nodes
  const sourceNode = useMemo(() => nodes.find(n => n.id === edge?.source), [nodes, edge?.source])
  const targetNode = useMemo(() => nodes.find(n => n.id === edge?.target), [nodes, edge?.target])
  // The id tail (`?? edge?.source`) is gone: an endpoint with no name now reads
  // as the honest no-name fallback rather than as a graph key. These two feed
  // the shell title, the intervention notice sentence and the coaching label
  // context, so the id was reaching the user in three places at once.
  const sourceLabel = resolveElementLabel(sourceNode?.data)
  const targetLabel = resolveElementLabel(targetNode?.data)
  const sourceKind = (sourceNode?.type || sourceNode?.data?.kind || 'factor') as NodeType
  const targetKind = (targetNode?.type || targetNode?.data?.kind || 'factor') as NodeType

  // Organisational / intervention edge gate
  const isOrganisational = sourceKind === 'decision' && targetKind === 'option'
  const isIntervention = sourceKind === 'option' && targetKind === 'factor'

  // ⛔ PROVENANCE DISCLOSURE. The coaching card under this group used to say
  // "This value was generated automatically." unconditionally. On a freshly
  // drawn edge nothing generated either value — they are USER_EDGE_DEFAULTS —
  // and on an edge the user had just adjusted the sentence was false in the
  // other direction. A disclosure that answers "where did this come from?"
  // with a fixed string is a stronger over-claim than the number it sits
  // under, so it is now derived from the edge's actual stamps.
  const edgeValuesCoaching = useMemo(
    () => resolveEdgeValuesCoaching({
      strength: edgeValueSource(edge?.data as Record<string, unknown> | undefined, 'weight'),
      existence: edgeValueSource(edge?.data as Record<string, unknown> | undefined, 'beliefExists'),
    }),
    [edge?.data],
  )

  // A confirm-as-is action is licensed only by a real producer value. A bare
  // UI default has no source and is not an estimate the user can honestly
  // confirm. Keep the exact store number visible beside the action so consent
  // covers the number that will receive the user provenance stamp.
  /**
   * ⛔⛔ GATED ON THE AUTHORITY THE ACT ACTUALLY REQUIRES, NOT ON A SECOND
   * FUNCTION THAT AGREES WITH IT TODAY.
   *
   * This asked only `edgeValueSource(data,'weight') === 'cee'` — *"did a producer
   * originate this number?"* — while `confirmCurrentStrength` succeeds only when
   * `serverStatedStrengthOf(data)` returns a tuple — *"does the SERVER hold this
   * number?"*. Different questions over different fields, and
   * `edgeServerStatedStrength.ts` exists precisely because they were conflated
   * once before: `'cee'` is stamped by paths that write a producer's number
   * locally BEFORE any server write exists. An edge in that state satisfied the
   * render and failed the act, so the person read *"Olumi's current estimate is
   * 0.3. Confirm this estimate"*, clicked, and nothing happened anywhere.
   *
   * ⭐ MEASURED, since the divergence was decidable and the frequency was not:
   * on a real drafted graph (29 edges, served `afcb2e2b`, scenario `52cf4a0c`)
   * **29/29 carry `serverStrength` and 0/29 are in the divergent class.** So this
   * is a latent seam rather than a live defect — which is exactly why it is worth
   * closing by CONSTRUCTION now rather than by a frequency argument that the next
   * ingestion path could falsify.
   *
   * ⚠ THE SECOND CONJUNCT, NOT A REPLACEMENT, AND THE CHOICE IS DELIBERATE.
   * Deriving the magnitude itself from `serverStatedStrengthOf` also closes the
   * divergence, but it silently changes WHICH NUMBER IS SHOWN — from the live
   * `weight` to the server's last stated mean. Those differ exactly when a store
   * refresh has moved `weight`, and a sibling spec pins the control reading the
   * LIVE value. Closing a gate divergence must not quietly re-point a display.
   * ⚠ RESIDUAL, NAMED NOT FIXED: the number shown is `weight`, the number
   * confirmed is `expected.mean`. They agree on every real edge measured above;
   * where a refresh moves one and not the other they would not, and that is a
   * DISPLAY honesty question with its own answer, not this gate's job.
   */
  const currentEstimatedWeight = useMemo(() => {
    const data = edge?.data as Record<string, unknown> | undefined
    const value = data?.weight
    return edgeValueSource(data, 'weight') === 'cee' &&
      // the act's own authority — one function, both readers
      serverStatedStrengthOf(data) !== null &&
      typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1
      ? value
      : null
  }, [edge?.data])

  /**
   * ⛔⛔ THE HOUSE BOUND ERASES SMALL MAGNITUDES, SO IT CANNOT BE USED ALONE.
   * THIS IS THE CANONICAL EXPLANATION FOR ALL THREE READOUTS THIS CHANGE TOUCHES
   * (`InterventionRow`'s disabled target and `FactorObservablePanel`'s unitless
   * readout carry a back-reference rather than a copy of it).
   *
   * `formatNumber`'s bound is `maximumFractionDigits: 4`, which is right for the
   * defect it was adopted to close (a 17-figure raw double reaching the founder)
   * and WRONG below 5e-5, where it renders a real non-zero magnitude as `0` —
   * and `-0.00001` as `-0`, which is worse, because the SIGN survives while the
   * MAGNITUDE does not: the reader is given the direction of a quantity that is
   * simultaneously reported as nothing.
   *
   * ⚠ THE PATH THIS REPLACED DID NOT HAVE THAT FAULT. `String(v)` printed
   * `0.00001` faithfully. So the collapse is a REGRESSION INTRODUCED HERE, not a
   * pre-existing behaviour of the estate — an earlier version of this comment
   * called it a "residual", and that classification was wrong. Changing a caller
   * makes that caller's behaviour yours.
   *
   * ⚠⚠ AND ON THIS SURFACE IT IS AN HONESTY DEFECT, NOT A COSMETIC ONE.
   * `confirmCurrentStrength` commits the STORED magnitude. If the sentence reads
   * `0` while the write carries 0.00001, the screen and the write disagree on
   * the one control that asks the user to ratify a number.
   *
   * ── THE RULE ───────────────────────────────────────────────────────────────
   * Keep the house bound; fall back to significant digits ONLY when the house
   * bound has erased a non-zero magnitude. `Number(housed) === 0` is the test
   * for "erased", and it also covers `'-0'` (`-0 === 0` is true in JS). A value
   * at or above 1000 formats with thousand separators, so `Number('22,500.5')`
   * is `NaN`, `NaN === 0` is false, and large values can never enter this
   * branch — which matters, because applying significant digits to THEM would
   * round 22,500.5 to 22,500, i.e. round a producer value to solve a display
   * problem. That is banned here and is pinned as a control in the spec.
   *
   * ⚠ TWO significant digits, deliberately: enough to make the magnitude and
   * its sign visible, few enough not to imply precision this class of value
   * does not have.
   *
   * ⚠ THE `!== 0` CONJUNCT IS DEFENSIVE, NOT LOAD-BEARING, AND IS LABELLED THAT
   * WAY BECAUSE A MUTANT PROVED IT. Removing it leaves all 27 spec cases green:
   * `formatNumber(0, 2)` is also `'0'`, so it only ever routes a true zero to a
   * formatter that returns the same string. It is kept because it states the
   * intent — never substitute anything for a real zero — and would start
   * mattering the moment the fallback stopped being a plain numeric format. It
   * is NOT what makes the zero control pass; a mutant that returns `'<0.0001'`
   * without it REDs on all three zero controls, which is the case that guards
   * the actual risk. (A stored `-0` renders `-0` here, in both arms: that is the
   * value the model holds, not an erased magnitude, so the guard leaves it be.)
   *
   * ⚠ IT PASSES `significantDigits`, WHOSE DOCBLOCK SAYS SINGLE-VALUE CALLERS
   * MUST NOT. Named rather than hidden: that note reserves the parameter for
   * CONTRAST callers on the grounds that the house bound is "the honest one" for
   * everyone else — and for this value class the house bound is demonstrably NOT
   * honest, it reports nothing where the model holds something. The durable fix
   * is for `formatNumber` itself to stop erasing small magnitudes, which would
   * fix every consumer in the estate at once; that file has a different owner,
   * so this is the bounded display-only fix at the three callers changed here.
   */
  const currentEstimatedWeightDisplay = useMemo(() => {
    if (currentEstimatedWeight === null) return null
    const housed = formatNumber(currentEstimatedWeight)
    return Number(housed) === 0 && currentEstimatedWeight !== 0
      ? formatNumber(currentEstimatedWeight, 2)
      : housed
  }, [currentEstimatedWeight])

  // UI-SEM-029: Edge weight/direction defaults for display (0.5 / 'positive').
  const weight = edge?.data?.weight ?? 0.5
  const direction = edge?.data?.direction ?? 'positive'
  const signedValue = direction === 'negative' ? -weight : weight
  const beliefExists = edge?.data?.beliefExists ?? EDGE_CONSTRAINTS.beliefExists.default
  const strengthStd = edge?.data?.strengthStd ?? 0.15

  // Local slider state
  const [localStrength, setLocalStrength] = useState(signedValue)
  // Kept OUT of `useEditConfirmation` on purpose: that hook's `lastConfirmed`
  // is what gates `InlineRerunPrompt`, and a confirmation changes no value, so
  // it must not invite a re-run.
  const [strengthConfirm, setStrengthConfirm] =
    useState<{ ts: number; outcome: EdgeStrengthConfirmOutcome } | null>(null)
  /**
   * ⭐ HOW THE LAST STRENGTH **EDIT** SETTLED. Separate state from
   * `strengthConfirm` above, and deliberately so: confirming and editing are
   * two acts with two carriers (CLAUDE.md trap 21), and pooling them under one
   * name is how the confirm path's fix failed to reach the edit path at all.
   * `null` means no settlement has arrived yet — which is the honest state for
   * the window between the press and the server's answer.
   */
  const [strengthEditSend, setStrengthEditSend] =
    useState<{ ts: number; settlement: SystemEventSendSettlement | 'not_sent' } | null>(null)
  const [localBelief, setLocalBelief] = useState(beliefExists)
  const [localStd, setLocalStd] = useState(strengthStd)

  // Canvas-wide edge label mode. The numeric form was fully built — the store
  // below, its localStorage persistence, `formatNumericLabel`, and StyledEdge's
  // monospace treatment — and NOTHING in the product called `setMode`, so no
  // user could ever see an edge's number. This panel is where a person is
  // already looking at that number, so the control lives here. It is a display
  // preference only: it changes no model value and sends nothing.

  // Existence band for the colour + track-fill channels. Provenance comes from
  // the STORE (the only thing that knows whether anyone set this); the value
  // comes from the live slider, so the colour bands the number on screen rather
  // than one a debounce tick behind it. `withLiveEdgeValue` cannot upgrade an
  // unset verdict, so this composition cannot fabricate a source.
  /**
   * ⭐⭐ ONE UNION, READ BY EVERY CHANNEL ON THIS CONTROL.
   *
   * This used to be computed inline for the COLOUR alone, while the NUMBER
   * three hundred lines below read `localBelief` raw. The colour was gated and
   * the number was not, so the panel printed "80%" directly beneath its own
   * sentence "Nobody has said how likely this connection is to exist yet."
   * One surface, two verdicts, one edge.
   *
   * `show: true` REQUIRES a source in the union's own type, so a value nobody
   * stated is unrepresentable rather than merely discouraged — a guard can be
   * bypassed; a union member that does not exist cannot.
   *
   * ⚠ `withLiveEdgeValue` PRESERVES `show: false` (`edgeValueProvenance.ts:609`),
   * which is what makes this safe to hang the number on: dragging the slider
   * cannot fake provenance. It does not need to, because `setExistsProbability`
   * writes `beliefExistsSource` alongside the value, so the instant a human
   * states it the union opens and the number appears. Silence is for "nobody
   * has said", never for "the user is saying it now".
   */
  const existenceDisplay = useMemo(
    () =>
      withLiveEdgeValue(
        resolveEdgeValueDisplay(edge?.data as Record<string, unknown> | undefined, 'beliefExists'),
        localBelief,
      ),
    [edge?.data, localBelief],
  )
  const existenceBand: EdgeValueBand = useMemo(
    () => edgeValueBand(existenceDisplay),
    [existenceDisplay],
  )

  // Fragility check
  const isFragile = useMemo(() => {
    if (!robustness?.fragile_edges) return false
    return isEdgeFragile(
      edgeId ?? '',
      edge?.source ?? '',
      edge?.target ?? '',
      robustness.fragile_edges as import('../../../utils/fragileEdgeMatch').FragileEdgeCandidate[],
    )
  }, [robustness, edgeId, edge?.source, edge?.target])

  // E-value for this edge
  const edgeEValue = useMemo(() => {
    if (!edgeEValues || !edgeId) return null
    const entry = edgeEValues.find(ev => ev.edge_id === edgeId)
    return entry?.e_value ?? null
  }, [edgeEValues, edgeId])

  // Switch probability for fragile edge
  const fragileEdgeSwitchProb = useMemo(() => {
    if (!isFragile || !robustness?.fragile_edges) return null
    return getFragileEdgeSwitchProbability(
      edgeId ?? '',
      edge?.source ?? '',
      edge?.target ?? '',
      robustness.fragile_edges as unknown[],
    )
  }, [isFragile, robustness, edgeId, edge?.source, edge?.target])

  // Edit impact preview
  const { previewEdit, clearPreview } = useEditImpactPreview()
  const origStrengthRef = useRef(signedValue)

  // Handlers
  /**
   * ⭐ ONE SETTLEMENT HANDLER FOR EVERY STRENGTH CONTROL ON THIS PANEL.
   * The bands, the fine-tune slider and the Advanced β field all write the same
   * edge through the same carrier, so they must all answer for it the same way.
   * Three copies of this closure would be three chances to drift.
   */
  const handleStrengthSendSettled = useCallback(
    (settlement: SystemEventSendSettlement) => setStrengthEditSend({ ts: Date.now(), settlement }),
    [],
  )

  /**
   * ⛔⛔ A SETTLEMENT DOES NOT ALWAYS ARRIVE, AND MY FIRST VERSION ASSUMED IT DID.
   *
   * `setStrength` returns BEFORE the send on two paths — `not_wire_encodable`
   * (the edge has no assertable `expected`) and `local_only` (no conversation
   * carrier at all). On both, the local write happens and `settleSystemEventSend`
   * is never reached, so nothing ever resolves the pending state.
   *
   * Left as-is, the panel said **"Sending to Olumi…" forever** — which is itself
   * a false statement, since nothing is being sent and nothing will be. I
   * replaced one lie with a quieter one that never resolves.
   *
   * ⭐ The outcome token is the answer and it was already being returned and
   * discarded. `dispatched` is the ONLY value that promises a settlement; every
   * other one is terminal the moment it is returned.
   */
  const noteStrengthOutcome = useCallback((outcome: EdgeStrengthCommitOutcome) => {
    if (outcome === 'dispatched') return
    setStrengthEditSend({ ts: Date.now(), settlement: 'not_sent' })
  }, [])

  const handleStrengthChange = useCallback((v: number) => {
    setLocalStrength(v)
    // A drag is one gesture that fires repeatedly (`SignedStrengthSlider`
    // debounces `onChange` by 120ms), so the settlement of the LATEST send is
    // the one that describes where the value ended up. Clearing first means a
    // stale "not recorded" can never survive over a later send that landed.
    setStrengthEditSend(null)
    noteStrengthOutcome(mutations.setStrength(v, { onSendSettled: handleStrengthSendSettled }))
    if (edgeId) previewEdit(edgeId, v - origStrengthRef.current)
  }, [mutations, edgeId, previewEdit, handleStrengthSendSettled])

  const handleStrengthBlur = useCallback(() => {
    clearPreview()
    origStrengthRef.current = localStrength
    confirmEdit('strength')
  }, [clearPreview, localStrength, confirmEdit])

  const handleStrengthPresetChange = useCallback((v: number) => {
    // A preset click is a complete edit, not a continuously-dragged preview.
    // Reuse the canonical strength writer, then close the same confirmation
    // seam the fine-tune slider closes on blur so stale analysis exposes the
    // existing rerun affordance.
    setLocalStrength(v)
    // Presets choose magnitude only. The sign is retained visually by
    // StrengthBandButtons, but retaining a sign is not the same as the user
    // stating it: preserve both direction and directionSource byte-for-byte.
    setStrengthEditSend(null)
    noteStrengthOutcome(mutations.setStrength(v, {
      preserveDirection: true,
      onSendSettled: handleStrengthSendSettled,
    }))
    clearPreview()
    origStrengthRef.current = v
    confirmEdit('strength')
  }, [mutations, clearPreview, confirmEdit, handleStrengthSendSettled])

  /**
   * ⛔⛔ THIS HANDLER SENT AN ACT THE SERVER REFUSES AND THEN REPORTED SUCCESS.
   * Wire-witnessed on served `1d0306a0`, scenario `52cf4a0c`, not reasoned:
   *
   *   - it called `setStrength(currentEstimatedWeight)`, which emits
   *     `intent: 'set'` at a magnitude EQUAL to the persisted value — the exact
   *     `set_target_unchanged` case. CEE answered *"That link already has
   *     exactly that strength and direction, so I haven't recorded it as your
   *     judgement."* `blocks: []`, `graph_hash` unchanged, `weightSource` still
   *     `cee`. Nothing was recorded.
   *   - it then called `confirmEdit('strength')` UNCONDITIONALLY, which rendered
   *     `EditConfirmation` at its defaults — **"Updated" in success green** —
   *     and, 2s later, `InlineRerunPrompt`: *"Re-run to see how this affects the
   *     results."* So the person was told their agreement was saved and invited
   *     to spend an analysis on a change that did not exist.
   *
   * ⚠ NOT A DEAD BUTTON — A BUTTON THAT REPORTED THE OPPOSITE OF WHAT HAPPENED.
   * The truthful sentence went to the Olumi conversation, a surface the person
   * must open deliberately; it appeared NOWHERE in the canvas view.
   *
   * Both halves are closed here. The act now rides `confirm_current`, the only
   * carrier that can land it. And the feedback is kept SEPARATE from
   * `confirmEdit`: a confirmation changes no value, so it must not mark the
   * panel edited — that is what raised the re-run prompt. `EditConfirmation`'s
   * own header supplied `label`/`tone` for exactly this caller and warned that
   * *"it stops being harmless the moment a pane unfences."* It unfenced.
   */
  const handleConfirmCurrentStrength = useCallback(() => {
    if (currentEstimatedWeight === null) return
    // ⛔ EVERY OUTCOME IS NAMED, AND THE SILENT ONE IS WHY. `dispatched` says
    // SENT, never saved. Anything else means NO statement left this client, and
    // the person still pressed a button — so it says so rather than doing
    // nothing. `no_carrier` in particular is a fact about the render context
    // (no conversation to send through), NOT about the edge, so the render gate
    // above cannot eliminate it: silence there would be permanent, not transient.
    setStrengthConfirm({ ts: Date.now(), outcome: mutations.confirmCurrentStrength() })
  }, [currentEstimatedWeight, mutations])

  const handleBeliefChange = useCallback((v: number) => {
    setLocalBelief(v)
    mutations.setExistsProbability(v)
    confirmEdit('existence')
  }, [mutations, confirmEdit])

  const handleStdChange = useCallback((v: number) => {
    setLocalStd(v)
    mutations.setStd(v)
  }, [mutations])

  /**
   * ⭐ MAY THIS EDGE'S STRENGTH REACH THE MODEL AT ALL?
   *
   * Asked of the emitter, never re-derived here — `edgeStrengthEditIsAssertable`
   * calls `buildEdgeStrengthEditEvent` and reports whether it would build. An
   * edge whose weight came from `DEFAULT_EDGE_DATA` has no assertable `expected`
   * tuple, so the event cannot be built and `setStrength` would return
   * `not_wire_encodable` before anything left the browser.
   *
   * ⛔ IT FAILS CLOSED, and that direction is the point: an editable edge that
   * renders disabled is a disclosure, while an editor whose write cannot land is
   * the lie this panel is being unfenced to stop.
   */
  /**
   * ⛔⛔ TWO HARMS, TWO PREDICATES — NEVER ONE (CLAUDE.md trap 22b).
   *
   * `blocked` and `refused` mean the statement is NOT in the model: `blocked`
   * never reached the server, and on `refused` the server's own line certifies
   * it wrote nothing. Saying "Updated" there is false, and offering a re-run
   * there invites the person to SPEND AN ANALYSIS on a change that does not
   * exist — the precise harm the ⛔⛔ banner on `handleConfirmCurrentStrength`
   * records as wire-witnessed, closed for confirm and left open for edit.
   *
   * `unverified` is the OPPOSITE harm and must not share the predicate: the
   * change MAY have landed, so suppressing the re-run would hide a real result
   * and telling the person nothing was recorded would be a second false claim.
   * It gets its own wording and KEEPS the affordance.
   */
  const strengthEditSettlement = strengthEditSend?.settlement
  /**
   * ⭐ THE PENDING WINDOW IS A THIRD STATE, NOT AN ABSENCE OF THE OTHER TWO.
   * Every edit passes through it — a settlement cannot arrive in the same tick
   * (`settleSystemEventSend` settles a promise), so `null` here is the NORMAL
   * state at the instant of the press, not an edge case. Falling through to
   * `EditConfirmation`'s defaults here is what kept the "Updated ✓ in success
   * green" claim alive for the whole window this change was written to close.
   */
  const strengthEditIsPending = strengthEditSettlement === undefined
  const strengthEditNotSent = strengthEditSettlement === 'not_sent'
  const strengthEditIsQueued = strengthEditSettlement === 'queued'
  const strengthEditDidNotLand =
    strengthEditSettlement === 'blocked' || strengthEditSettlement === 'refused'
  const strengthEditIsUnverified = strengthEditSettlement === 'unverified'

  const strengthReachesTheModel = edgeStrengthEditIsAssertable(edge)

  /**
   * ⭐⭐ A DIFFERENT QUESTION FROM THE ONE ABOVE, AND THAT IS THE WHOLE DESIGN.
   *
   * `strengthReachesTheModel` asks *"can I build an EDIT event for this edge?"*
   * and rightly answers no for a link the user just drew — `edge_strength_edit`
   * EDITS an edge the server already holds, and the server has never received
   * this one. **That fence is correct and is deliberately left alone.**
   *
   * This asks *"did this link stand down for want of a stated strength?"* — and
   * if so the user has never been offered a way to state one. The answer rides
   * `structural_add_edge`, which ADDS the link WITH the magnitude the person
   * supplies. Two populations, two carriers, two controls (CLAUDE.md trap 21);
   * giving them one control is what made the old copy impossible to write
   * honestly.
   *
   * ⛔ NOTHING HERE INVENTS A MAGNITUDE. Until the person picks one the link
   * stays on the canvas and says so.
   */
  // `edge` is narrowed a few lines below, not here — optional access, because the
  // repo's typecheck GATE flags what a bare `tsc --noEmit` let through.
  const awaitingStatedStrength =
    (edge?.data as { structuralAddStandDown?: string } | undefined)?.structuralAddStandDown ===
    'strength_not_stated'

  /**
   * States the strength for a link that has never reached the model, with the
   * provenance stamps that make it a CLAIM rather than a default. The store's
   * `updateEdge` sees a recorded stand-down plus a now-stated strength and
   * re-runs the capture exactly once — see `retryStructuralAddEdgeCapture`.
   */
  const handleStateStrengthForSave = useCallback(
    (v: number) => {
      if (!edgeId) return
      // ⭐ THE PANEL'S OWN STATE, NOT JUST THE STORE'S. `localStrength` is
      // `useState(signedValue)` — its initialiser runs ONCE, at mount, and
      // nothing resyncs it from the store. Writing only to the store left the
      // band derived from the mount-time value, so a person who chose "Strong"
      // watched "Moderate 0.30" light up: the FABRICATED DEFAULT this panel
      // already refuses to propose BEFORE a save, reappearing after it.
      // Measured on served `e6d7971b` — stated 0.55 showed 0.30, stated 0.85
      // showed 0.30, both saved correctly. The model was right; the screen was
      // wrong about the user's own choice.
      setLocalStrength(v)
      // ⭐ AND THE PREVIEW BASELINE, which both siblings already maintain —
      // `handleStrengthBlur` (:290) and `handleStrengthPresetChange` (:305).
      // `origStrengthRef` is what every impact delta is measured from
      // (`previewEdit(edgeId, v - origStrengthRef.current)`), and it is seeded at
      // MOUNT. Leaving it behind here meant the first fine-tune after a save
      // measured from the fabricated 0.3 default instead of the strength the
      // person actually stated.
      //
      // ⛔ THE ERROR INVERTS THE SIGN, it does not merely shift it. Stating 0.85
      // then easing to 0.55 is a WEAKENING of −0.30; against the stale baseline
      // it previews as +0.25 — the product showing the user the opposite of the
      // adjustment they just made. Measured, not reasoned.
      //
      // ⚠ NOT closed by #1546's `key={edgeId}`: a key only remounts when the key
      // CHANGES. Switching edges re-seeds this ref and is fixed there; staying on
      // the SAME edge across a save never remounts, which is exactly where the
      // save happens.
      origStrengthRef.current = v
      useCanvasStore.getState().updateEdgeData(edgeId, {
        weight: Math.abs(v),
        weightSource: 'user',
        direction: v >= 0 ? 'positive' : 'negative',
        directionSource: 'user',
      } as never)
    },
    [edgeId],
  )

  if (!edgeId || !edge) return null

  // ─── Render ──────────────────────────────────────────────────────

  return (
    <div>
      {/* ── Organisational / intervention link notices ────────── */}
      {isOrganisational ? (
        <div className="mt-3">
          <p className={`${typography.panelMeta} text-text-light`}>{EDGE_LINK_NOTICES.organisational.title}</p>
          <p className={`${typography.panelMeta} text-text-light mt-1`}>{EDGE_LINK_NOTICES.organisational.body}</p>
        </div>
      ) : isIntervention ? (
        <div className="mt-3" data-testid="intervention-edge-notice">
          <p className={`${typography.panelMeta} text-text-light`}>{EDGE_LINK_NOTICES.intervention.title}</p>
          <p className={`${typography.panelMeta} text-text-light mt-1`}>
            {resolveEdgeLinkTemplate({ sourceLabel, targetLabel })}
          </p>
        </div>
      ) : (
        <>
          {/* ── Context group ─────────────────────────────────── */}
          {isFragile && isResultsMode && (
            <PanelGroup kind="context" label={GROUP_LABELS.context}>
              <StaleGuardBanner hasResults={isResultsMode}>
                <div className="bg-panel border border-danger/30 p-2.5 rounded-lg">
                  <div className={`${typography.panelBody} text-danger flex items-center gap-1`}>
                    <AlertTriangle size={13} className="text-danger" />
                    {INLINE_LABELS.sensitiveAssumption}
                  </div>
                  <p className={`${typography.panelBody} text-text-body mt-1`}>
                    {EDGE_COPY.sensitiveContext}
                  </p>
                  {fragileEdgeSwitchProb !== null && (
                    <p
                      className={`${typography.panelMeta} text-danger mt-1.5`}
                      title={EDGE_COPY.flipRiskTooltip(Math.round(fragileEdgeSwitchProb * 100))}
                    >
                      {Math.round(fragileEdgeSwitchProb * 100)}% flip risk
                    </p>
                  )}
                  {edgeEValue != null && (
                    <p className={`${typography.panelMeta} mt-1.5 ${edgeEValue > 3 ? 'text-success' : edgeEValue >= 1.5 ? 'text-warning' : 'text-danger'}`}>
                      Assumption robustness: {edgeEValue.toFixed(1)}x
                      {!techMode && `. This assumption would need to be ${edgeEValue.toFixed(1)}x wrong to change the result`}
                    </p>
                  )}
                </div>
              </StaleGuardBanner>
              <div className="mt-2">
                <ResultsLink label={INLINE_LABELS.seeSensitivity} tab="results" />
              </div>
            </PanelGroup>
          )}

          {/* ── Your input group ──────────────────────────────── */}
          <PanelGroup kind="input" label={GROUP_LABELS.input}>
            {/* Strength — primary editing surface. THE ONE CONTROL IN THIS PANEL
                WITH A WIRE CARRIER (`edge_strength_edit`), so it is the one that
                may present itself as a shared-model edit. The fieldset is the
                same mechanism `InspectorRouter` used to apply to the whole
                panel — kept, but pointed at the question that actually decides
                it: can THIS edge's strength be asserted? */}
            {awaitingStatedStrength ? (
              /* ⭐ THE ADD CONTROL. Rendered INSTEAD of the edit fieldset, never
                 beside it: two strength controls on one edge would be two
                 answers to one question, which is the defect this panel already
                 carries a trap-21 note about one fence down. */
              <PrimaryControlCard>
                <p
                  className={`${typography.panelBody} text-text-body mb-1.5`}
                  data-testid="edge-state-strength-for-save"
                >
                  {INLINE_LABELS.strengthQuestionForSave}
                </p>
                {/* ⛔ `unset` DERIVED FROM THE PROVENANCE GATE, never from the
                    branch we are already inside. Asking the gate keeps this
                    honest if the branch's condition ever changes: it is the same
                    reader `captureStructuralAddEdge` is handed, so the control
                    can only ever highlight a number that reader calls SET. */}
                <StrengthBandButtons
                  value={localStrength}
                  onChange={handleStateStrengthForSave}
                  unset={!resolveEdgeSignedStrengthDisplay(edge?.data as Record<string, unknown> | undefined).show}
                />
              </PrimaryControlCard>
            ) : (
            <>
            {/* ⚠ MARKED `no-strength-basis`, NOT `disabled`, AND THE NAME IS THE
                POINT. Two fences now live in this panel and they answer
                DIFFERENT questions (CLAUDE.md trap 21): the one below asks
                "does this control have a wire carrier at all?", this one asks
                "does THIS edge have a strength the server stated, to assert
                against?". Marking both `data-authority="disabled"` gave the
                estate's escape guard two regions where it resolves exactly one
                — it read the FIRST and reported the existence slider, which is
                genuinely fenced, as an escapee. Named apart, each guard keeps
                measuring the region it was written for. */}
            <fieldset
              disabled={!strengthReachesTheModel}
              data-testid="edge-strength-controls"
              className="contents"
              {...(strengthReachesTheModel
                ? {}
                : { 'data-authority': 'no-strength-basis', 'aria-describedby': 'inspector-authority-notice' })}
            >
            <PrimaryControlCard>
              <p className={`${typography.panelBody} text-text-body mb-1.5`}>
                {INLINE_LABELS.strengthQuestion}
              </p>
              <StrengthBandButtons value={localStrength} onChange={handleStrengthPresetChange} />
              <ExpertAnnotation techMode={techMode} editable value={localStrength} onChange={(v) => { handleStrengthChange(v); }} suffix="β =" step={0.01} min={-1} max={1} />
              {currentEstimatedWeight !== null && (
                <div className="mt-2 rounded-md border border-accent/20 bg-panel px-2 py-1.5">
                  <p className={`${typography.panelMeta} text-text-body`}>
                    {/* ⛔⛔ `formatNumber`, NOT `String`. This printed the raw
                        double: the founder read *"Olumi's current estimate is
                        0.5428571428571428."* A sibling edge showed a clean
                        `0.45` only because that value is short — the formatting
                        was ABSENT, not inconsistent, so nothing would have
                        caught it drifting. Seventeen significant figures assert
                        a precision this quantity does not have: it is minted by
                        a CEE rescale (a raw float division) and is not stable
                        even in its ORDERING between two passes — the measured
                        argument is at `formatValueWithUnit.ts:41-60`, whose
                        four-decimal house bound this now adopts — bounded
                        against small-magnitude erasure, see
                        `currentEstimatedWeightDisplay` above.

                        ⚠ DISPLAY ONLY, AND THAT IS LOAD-BEARING HERE.
                        `handleConfirmCurrentStrength` calls
                        `mutations.confirmCurrentStrength()`, which reads the
                        edge from the STORE — it never reads this string. So
                        consent still lands on the exact stored magnitude; only
                        the claim made to the reader about its precision changes.

                        ⚠ NOT `formatValueWithUnit`: that entry point turns an
                        unqualified 0-1 value into a WORD ("moderate"), which
                        would make this sentence unable to name the number the
                        button ratifies. The number is the point of the
                        sentence. */}
                    Olumi’s current estimate is <span className="font-mono">{currentEstimatedWeightDisplay}</span>.
                  </p>
                  <button
                    type="button"
                    data-testid="edge-confirm-current-strength"
                    onClick={handleConfirmCurrentStrength}
                    className={`${typography.panelMeta} mt-1 text-accent underline underline-offset-2`}
                  >
                    {ACTION_LABELS.confirmCurrentStrength}
                  </button>
                </div>
              )}
              {/* Confirmation feedback — SENT, not saved, and no re-run prompt:
                  ratifying the existing estimate changes no value. */}
              {strengthConfirm !== null && (
                <div
                  className="flex items-center gap-2 mt-1"
                  data-testid="edge-strength-confirm-sent"
                  data-outcome={strengthConfirm.outcome}
                >
                  <EditConfirmation
                    trigger={strengthConfirm.ts}
                    label={strengthConfirm.outcome === 'dispatched'
                      ? ACTION_LABELS.strengthConfirmSent
                      : ACTION_LABELS.strengthConfirmNotSent}
                    tone="pending"
                  />
                </div>
              )}
              {/* Edit feedback — SETTLEMENT-AWARE. See the two predicates above. */}
              {lastConfirmed?.field === 'strength' && (
                <div
                  className="flex items-center gap-2 mt-1"
                  data-testid="edge-strength-edit-feedback"
                  data-settlement={strengthEditSettlement ?? 'pending'}
                >
                  {/* ⛔ NEVER `tone="success"`, NEVER "Updated". `settleSystemEventSend`'s
                      own header: `'sent'` means a POST left and the server has not
                      answered — "a row that rendered 'saved' on it would be an
                      optimistic write wearing a receipt." Whether the MODEL changed
                      arrives separately, on the turn. This mirrors
                      `FactorControllablePanel:852-858`, which already states all
                      three of its outcomes this way, rather than inventing a fourth
                      spelling of one rule. */}
                  <EditConfirmation
                    trigger={strengthEditSend?.ts ?? lastConfirmed.ts}
                    label={strengthEditIsPending
                      ? ACTION_LABELS.strengthEditSending
                      : strengthEditIsQueued
                        ? ACTION_LABELS.strengthEditQueued
                      : strengthEditNotSent
                        ? ACTION_LABELS.strengthConfirmNotSent
                        : strengthEditDidNotLand
                          ? ACTION_LABELS.strengthEditNotRecorded
                          : strengthEditIsUnverified
                            ? ACTION_LABELS.strengthEditUnverified
                            : ACTION_LABELS.strengthConfirmSent}
                    tone="pending"
                    hold={strengthEditIsPending}
                  />
                  {/* Withheld where the model provably does not hold the value, and
                      while we do not yet know. `unverified` keeps it — it may have
                      landed, and hiding a real result is the opposite harm. */}
                  {/* ⛔ WITHHELD ONLY WHERE THE MODEL PROVABLY LACKS THE VALUE.
                      My first version also withheld it while PENDING, and that
                      was over-reach caught by `elicitationChain.spec.ts` — a
                      journey test walking CTA → editor → canonical write →
                      stale → rerun. During the pending window the LOCAL value
                      has already changed, so the results genuinely ARE stale
                      and offering the re-run is the honest thing. Staleness is
                      a fact about the graph on screen; it does not wait on the
                      server's answer. */}
                  <InlineRerunPrompt
                    visible={isStaleAfterEdit && !strengthEditDidNotLand}
                  />
                </div>
              )}
              {/* Fine-tune slider */}
              <details className="mt-2">
                <summary className={`${typography.panelMeta} text-info cursor-pointer`}>
                  {INLINE_LABELS.fineTune}
                </summary>
                <div className="mt-1.5">
                  <div className="relative mb-2">
                    <UncertaintyBand strength={localStrength} std={localStd} />
                    {/* ⛔⛔ `techMode={true}` IS A LITERAL ON PURPOSE, AND IT IS NOT THE
                        TECH TOGGLE. Measured 19 Sep 2026: this prop's ONLY consumer
                        inside `SignedStrengthSlider` is its `{!techMode && …}` endpoint-
                        caption block, so on that component the flag means *"SUPPRESS my
                        own captions — my host renders its own scale"*. It does not reveal
                        a figure; the slider renders no visible number at all. The name is
                        backwards and #1751's prop doc says so, naming the honest spelling
                        `hostRendersItsOwnScale` and leaving the rename to this file's
                        owner because this is its ONLY caller.

                        THIS PANEL ALWAYS RENDERS ITS OWN SCALE — the `EDGE_COPY` row
                        immediately below is an unconditional sibling of the slider, in
                        this same `<details>`. So the honest answer to *"does the host
                        render its own scale?"* is a constant `true`, and passing the tech
                        toggle answered a DIFFERENT QUESTION (CLAUDE.md trap 21). At the
                        toggle's default — `useTechToggle` starts `false`, i.e. EVERY
                        default user — it asserted "no scale here", the slider helpfully
                        added its own, and the user read "Strong negative / No effect /
                        Strong positive" TWICE. Measured at pristine `a40ca56a`: 2/2/2 at
                        `techMode=false`, 1/1/1 at `techMode=true`.

                        ⛔ NOT a `techMode` gate on the caption row itself — that would
                        hide the scale from every default user, which is the trap #1751
                        documents. The row below stays UNCONDITIONAL; only the slider's
                        duplicate is suppressed. `endpointScaleIsNotDuplicated.spec.tsx`
                        REDs if either state stops reading exactly one. */}
                    <SignedStrengthSlider value={localStrength} onChange={handleStrengthChange} onBlur={handleStrengthBlur} std={localStd} techMode={true} />
                  </div>
                  {/* The panel's OWN endpoint scale — direction anchors for the track
                      above, never band words (`SignedStrengthSlider`'s header names them
                      apart from `CANVAS_STRENGTH_BANDS` and that ruling is untouched
                      here). `data-testid` so the spec can bind the surviving captions to
                      THIS row by identity rather than by string value, which the slider
                      could also satisfy. */}
                  <div className="flex justify-between" data-testid="edge-strength-endpoint-scale">
                    <span className={`${typography.panelMeta} text-text-light`}>{EDGE_COPY.sliderStrongNegative}</span>
                    <span className={`${typography.panelMeta} text-text-light`}>{EDGE_COPY.sliderNoEffect}</span>
                    <span className={`${typography.panelMeta} text-text-light`}>{EDGE_COPY.sliderStrongPositive}</span>
                  </div>
                </div>
              </details>
            </PrimaryControlCard>
            </fieldset>
            </>
            )}

            {/* ⛔ EVERYTHING BELOW WRITES NOTHING TO THE SHARED MODEL.
                `setExistsProbability` and `setStd` each perform ONE local
                `updateEdge` and emit no wire event, so a control that looked
                saveable here would be destroyed by the next server rehydrate.
                Unfencing this panel was a DUTY to fence these, not a licence to
                let them through with the strength control. */}
            <fieldset
              disabled
              aria-describedby="inspector-authority-notice"
              data-authority="disabled"
              className="contents"
            >

            {/* Existence slider — secondary control, outside card */}
            <div className="mt-3">
              <p className={`${typography.panelBody} text-text-body mb-1`} title={EDGE_COPY.existenceTooltip}>
                {INLINE_LABELS.existenceQuestion}
              </p>
              <div className="flex justify-between mb-1">
                <span className={`${typography.panelMeta} text-text-light`}>{EDGE_COPY.sliderMinUnlikely}</span>
                <span className={`${typography.panelMeta} text-text-light`}>{EDGE_COPY.sliderMaxVeryLikely}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <InspectorSlider
                    value={localBelief}
                    min={0}
                    max={1}
                    step={0.05}
                    onChange={handleBeliefChange}
                    trackFillColor={EXISTENCE_BAND_TRACK[existenceBand]}
                    valueText={existenceDisplay.show ? undefined : METRIC_UNSET.standalone}
                    aria-label="Connection existence probability"
                  />
                </div>
                <span data-testid="edge-existence-readout" className={`${typography.panelBody} min-w-[32px] text-right ${EXISTENCE_BAND_TEXT[existenceBand]}`}>
                  {existenceDisplay.show
                    ? `${Math.round(localBelief * 100)}%`
                    : METRIC_UNSET.standalone}
                </span>
              </div>
              {/* The same fabricated figure in a third channel. Gated on the
                  same union so techMode cannot reveal what the panel withholds. */}
              {existenceDisplay.show && (
                <ExpertAnnotation techMode={techMode} editable value={localBelief} onChange={handleBeliefChange} suffix="P(exists) =" step={0.01} min={0} max={1} />
              )}
            </div>

            {/* ⛔ THE LABEL-MODE TOGGLE USED TO SIT HERE AND WAS INERT.
                `EdgePanel`'s only mount is inside `InspectorRouter`'s
                unconditional `<fieldset disabled>`, which natively inerts every
                form-associated descendant, so `setMode` was never reachable from
                a real render. It now mounts OUTSIDE that boundary as
                `<EdgeLabelModeToggle />` — it writes no model value, so it is a
                presentation control and does not belong under a notice saying
                these fields cannot be saved. Do not move it back. */}

            {/* Uncertainty — expert mode only */}
            {techMode && (
              <div className="mt-3">
                <p className={`${typography.panelMeta} text-text-light mb-1`}>
                  {INLINE_LABELS.strengthUncertainty}
                </p>
                <div className="flex justify-between mb-1">
                  <span className={`${typography.panelMeta} text-text-light`}>{EDGE_COPY.sliderMinPrecise}</span>
                  <span className={`${typography.panelMeta} text-text-light`}>{EDGE_COPY.sliderMaxUncertain}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <InspectorSlider
                      value={localStd}
                      min={0.01}
                      max={0.5}
                      step={0.01}
                      onChange={handleStdChange}
                      aria-label="Strength uncertainty"
                    />
                  </div>
                  <ExpertAnnotation techMode={techMode} editable value={localStd} onChange={handleStdChange} suffix="σ =" step={0.01} min={0.01} max={0.5} />
                </div>
              </div>
            )}
            </fieldset>

            {/* Coaching */}
            <InspectorCoaching
              elementId={edgeId}
              panelType="edge"
              fallbackText={edgeValuesCoaching}
              labelContext={{ label: `${sourceLabel} \u2192 ${targetLabel}`, sourceLabel, targetLabel }}
            />
          </PanelGroup>

          {/* ── Evidence group ─────────────────────────────────── */}
          {/* The generic "No evidence yet" note was removed: DraftChat strips
              per-edge provenance upstream, so it rendered a fixed placeholder
              for EVERY edge — never real evidence. Re-add an evidence surface
              here when DraftChat stops stripping edge provenance. The
              contested-validation calibration below is live (CEE multi-pass
              disagreement, edge.data.validation) so the group renders only when
              an edge is actually contested. */}
          {(() => {
            const validation = (edge?.data as Record<string, unknown>)?.validation as
              import('../../../../canvas/domain/validation').ValidationMetadata | undefined
            if (!validation || validation.status !== 'contested') return null
            return (
              <PanelGroup kind="evidence" label={GROUP_LABELS.evidence}>
                {/* L-38 — this block used to print raw enum tokens
                    (`contested_reasons.join(', ')`, `pass2.basis`) and the
                    internal "Pass 1 (current) / Pass 2 (review)" stat grid.
                    The user-language surface, and the progressive disclosure
                    that keeps the numbers, live in EdgeReviewDisagreement. */}
                <EdgeReviewDisagreement validation={validation} techMode={techMode} />
              </PanelGroup>
            )
          })()}

          {/* ── Expert-only model detail ───────────────────────── */}
          <TechnicalDisclosure visible={techMode} label={INLINE_LABELS.modelDetail}>
            {fragileEdgeSwitchProb !== null && (
              <div>switch_probability: {fragileEdgeSwitchProb.toFixed(2)} · in fragile_edges[]</div>
            )}
            {/* This arm is reached only when the edge is NEITHER
                organisational NOR an intervention, so its strength IS read by
                the analysis. Passed explicitly rather than defaulted: the
                class is stated at every call site, never inferred. */}
            <EdgeAdvancedEditor edgeId={edgeId} linkKind="causal" onSendSettled={handleStrengthSendSettled} />
          </TechnicalDisclosure>
        </>
      )}

      {/* For org/intervention edges, still show tech disclosure */}
      {(isOrganisational || isIntervention) && (
        <TechnicalDisclosure visible={techMode} label={INLINE_LABELS.modelDetail}>
          <EdgeAdvancedEditor
            edgeId={edgeId}
            linkKind={isIntervention ? 'intervention' : 'organisational'}
            onSendSettled={handleStrengthSendSettled}
          />
        </TechnicalDisclosure>
      )}

      {/* Live region for announcements */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only" />
    </div>
  )
})
