/**
 * InterventionRow — Factor link + baseline → editable input + Δ%
 * Used in OptionPanel §6.2: "What this option changes"
 */

import { useState, useCallback, useEffect, useRef, type KeyboardEvent } from 'react'
import { ArrowRight } from 'lucide-react'
import { NodeShapeIndicator } from '../../../nodes/NodeShapeIndicator'
import { typography } from '../../../../styles/typography'
import {
  classifyInterventionProvenance,
  type ValueProvenanceKind,
} from '../../../domain/valueProvenance'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * ⭐⭐ WHO CHOSE THIS TARGET — THE INSPECTOR'S REGISTER (B1-b)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * `valueProvenance` owns the KIND and says so in its own header: *"Each surface
 * keeps its own register (the Model tab is terse, the inspector writes
 * sentences) but must be TOTAL over `ValueProvenanceKind` — a
 * `Record<ValueProvenanceKind, …>` makes a missing kind a type error rather than
 * a silent fallback."* This is the Inspector's.
 *
 * ⚠⚠ NOT ONE NEW WORD. Every string below is one this surface ALREADY says
 * through `inspectorStrings`: `getExtractionLabel('brief_extraction')` is "From
 * your brief", `getExtractionLabel('cee_inference')` is "Estimated by Olumi",
 * and `ATTRIBUTED_LABEL` supplies the other four. The spec's T-VOICE asserts
 * that agreement pair by pair against `getExtractionLabel` itself, so this is a
 * DERIVED register rather than a fourth hand-maintained copy of the same concept
 * (CLAUDE.md trap 12). If the Inspector changes its voice, this REDs.
 *
 * ⚠⚠ AND THE REASON IT IS NOT SIMPLY `getExtractionLabel(source)`, WHICH WAS THE
 * FIRST THING THIS LANE TRIED. That function classifies through
 * `classifyValueProvenance` — the NODE `observed_state.source` vocabulary. Two
 * of the three intervention literals are not members of it, so both fall through
 * to its default arm:
 *
 *   · `cee_hypothesis` → "Estimated by Olumi" — right, by accident
 *   · `user_specified` → **"Estimated by Olumi"** — the machine claiming
 *     authorship of a number the user typed, which is the exact inversion this
 *     component exists to prevent
 *
 * The vocabularies overlap on `brief_extraction` ONLY, which is what makes the
 * reuse look harmless (trap 21 — two authorities answering different questions
 * under one field name). `T-VOCAB` pins the inversion so nobody "simplifies"
 * this back to the helper.
 *
 * ⚠ FOUR ARMS ARE UNREACHABLE ON THIS TIP, stated rather than discovered later:
 * `classifyInterventionProvenance` maps the contract's three literals onto
 * `brief`, `ai` and `edited` only. `confirmed`, `assumption`, `human` and
 * `panel` exist here so a future kind lands with COPY instead of a type hole —
 * they are not covered by any render test and must not be claimed as such.
 * `T-REACH` pins the reachable set, so a schemas minor that adds a literal REDs
 * rather than arriving silently on an arm nobody has read since it was typed.
 */
export const INSPECTOR_INTERVENTION_PROVENANCE_LABEL: Record<ValueProvenanceKind, string> = {
  brief: 'From your brief',
  ai: 'Estimated by Olumi',
  edited: 'Set by you',
  confirmed: 'Confirmed by you',
  assumption: 'Your assumption',
  /** No intervention literal reaches this kind today — see T-VOICE. */
  human: 'Set by you',
  panel: 'From your panel',
}

/** Border tint per kind. TEXT is the mark; this only reinforces it. */
const INSPECTOR_INTERVENTION_PROVENANCE_BORDER: Record<ValueProvenanceKind, string> = {
  brief: 'border-info/30',
  ai: 'border-warning/30',
  edited: 'border-success/30',
  confirmed: 'border-success/30',
  assumption: 'border-success/30',
  human: 'border-success/30',
  panel: 'border-info/30',
}

/**
 * ⭐ ONE PLACE FOR THIS ROW'S WORDS, so a test asserts the same string the user
 * reads and a reviewer can see the whole claim surface at once. Each of these
 * replaced a sentence that claimed more than the record supports — see the
 * comments at each use site for which one and why.
 */
export const INTERVENTION_ROW_STRINGS = {
  /** What the factor's record holds. NEVER "Currently" — see the use site. */
  referenceLabel: 'Recorded',
  /** Names the editable number when it is not on the reference's scale. */
  modelValueLabel: 'model value',
  /**
   * ⚠ "vs the recorded value", not "vs baseline". The percentage is measured
   * from `observedState.value`, and `observedState.baseline` is a DIFFERENT
   * field that may also be present — calling the first one "baseline" put two
   * questions under one name on the surface where the answer is read.
   */
  deltaTitle: 'change vs the recorded value',
  /** Shown when the record holds a second, differing reference. */
  contestedNote: 'The record holds a second reference for this factor on an unstated scale, so no change is shown against it.',
} as const

interface InterventionRowProps {
  factorId: string
  factorLabel: string
  /**
   * The value the delta is measured FROM, on the SAME SCALE as `currentValue`
   * — in practice the factor's normalised 0-1 model value.
   *
   * ⚠ THIS DOC USED TO SAY "Baseline value in raw units". It was false, and the
   * falsehood WAS the defect: `OptionPanel` passes `observedState.value`
   * (normalised) with `unit: observedState.unit` ('£'), so the formatter
   * rendered `£0.59` for a £59 price and `£0.2` for a perception score.
   * Witnessed on staging `d913bd1f`. Never decorate this value with a unit —
   * pass `rawBaseline` for display instead.
   */
  baseline?: number
  /**
   * The same quantity in the factor's REAL units, for DISPLAY ONLY — never for
   * the delta. Supplied by the producer as `observedState.raw_value`; absent on
   * most factors (3 of 34 in the shipped starter corpus carry a unit at all).
   * When absent the normalised value is shown with NO unit, because the
   * normalisation factor is not on the wire and inferring it would invent one.
   */
  rawBaseline?: number
  /**
   * ⭐ THE FACTOR'S OWN `observed_state.baseline`, WHEN THE RECORD CARRIES ONE.
   *
   * NOT a value to display, and deliberately not named `baseline` — it is here
   * so the row can tell when its comparison reference is CONTESTED, and stop
   * making a claim it cannot support.
   *
   * ⚠ ITS ROLE IS UNDECLARED AT THE CONTRACT, verified rather than assumed.
   * `ObservedStateSchema` (`olumi-schemas` `src/graph.ts`) declares it as a bare
   * `baseline: z.number().optional()` with NO doc comment, in an object where
   * `source`, `declared_scale` and `elicited_from` each carry a full producer
   * rule, consumer rule and absence semantics running to paragraphs. So the
   * silence is not a style lapse: every other optional member of this exact
   * object was given the treatment and this one was not. Nothing states whether
   * it is the status-quo level, a prior period, or a reference for `std`; and
   * nothing states its SCALE — the live capture has `value 0.59 / raw 59` beside
   * `baseline 49`, i.e. a raw-looking baseline next to a normalised value in one
   * object.
   *
   * ⛔ SO IT IS NEVER RENDERED AND NEVER ADOPTED AS "the current value". Doing
   * either would repeat the `£0.59` defect in the other direction — a confident,
   * well-formatted number whose role the model never claimed. Its only job is to
   * make the row honest about not knowing.
   */
  recordedBaseline?: number
  /** Current intervention value */
  currentValue: number
  /** CEE-authored display_value for the intervention — rendered verbatim when
   * present, replacing the "Currently: X → editable" numeric formatter. */
  displayValue?: string
  unit?: string
  /**
   * ⭐ THE PRODUCER'S OWN `source` STAMP FOR **THIS INTERVENTION** — the RAW
   * literal (`'cee_hypothesis'`, `'brief_extraction'`, `'user_specified'`),
   * classified HERE by the one authority. Never a pre-classified kind: several
   * literals map to one kind, and an inverse map at the caller would be a second
   * mirror of the classifier.
   *
   * ⚠ UNDEFINED MEANS THE RECORD DOES NOT SAY, and this component then renders
   * NOTHING. Not "Estimated by Olumi", not "From your brief", and not a "Not
   * set" fallback — "Not set" is a claim about the VALUE, and the value is set.
   * A default in any direction is an invented provenance, which is the defect
   * one level up from the one this prop closes.
   */
  provenanceSource?: string
  onChange: (newValue: number) => void
  onNavigate?: () => void
  disabled?: boolean
  techMode?: boolean
  /** Normalised model value (0-1) for tech display */
  normalisedValue?: number
}

export function InterventionRow({
  factorId,
  factorLabel,
  baseline,
  rawBaseline,
  recordedBaseline,
  currentValue,
  displayValue,
  unit = '',
  provenanceSource,
  onChange,
  onNavigate,
  disabled = false,
  techMode = false,
  normalisedValue,
}: InterventionRowProps) {
  const [draft, setDraft] = useState(String(currentValue))
  const inputRef = useRef<HTMLInputElement>(null)

  /**
   * ⭐⭐ THE INPUT MUST SHOW THE RECORD, NOT THE LAST THING THIS INSTANCE SAW.
   *
   * `draft` is seeded ONCE at mount and afterwards only ever reset by blur or
   * Escape. So any change to `currentValue` that does not come from this input
   * left the box showing a number the model no longer holds — an editable field
   * displaying a stale value, which is worse than a stale label because the next
   * blur can write it back.
   *
   * TWO CAUSES, AND THIS CLOSES THE SECOND OF THEM:
   *  1. SWITCHING OPTIONS that share a factor. Fixed at the CALLER, because it
   *     is an identity defect rather than a sync one: `OptionPanel` keyed these
   *     rows by `factorId` alone, so React reconciled Option A's row onto Option
   *     B's and kept the instance — and with it the draft. The contract is
   *     explicit that an intervention lives at `/nodes/<option>/data/
   *     interventions/<factor>`, so the key now carries both halves.
   *  2. THE SAME option's value changing underneath us — a chat edit, an undo, a
   *     `_dispatchAction` write. No key change can catch that; this effect does.
   *
   * GUARDED ON FOCUS: re-seeding while the user is mid-type would eat what they
   * are typing. `document.activeElement` is the check because it is the same
   * question the browser is answering, and a `useState` mirror of "am I focused"
   * would be a second authority on it.
   */
  useEffect(() => {
    if (inputRef.current && document.activeElement === inputRef.current) return
    setDraft(String(currentValue))
  }, [currentValue])

  const handleBlur = useCallback(() => {
    const parsed = parseFloat(draft)
    if (!isNaN(parsed) && parsed !== currentValue) {
      onChange(parsed)
    } else {
      setDraft(String(currentValue))
    }
  }, [draft, currentValue, onChange])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      inputRef.current?.blur()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setDraft(String(currentValue))
      inputRef.current?.blur()
    }
  }, [currentValue])

  /**
   * ⭐ THE REFERENCE IS UNESTABLISHED WHENEVER THE RECORD HOLDS A SECOND
   * QUANTITY THIS SURFACE CANNOT RELATE TO THE FIRST.
   *
   * The percentage below is measured from `observedState.value`. When the factor
   * ALSO carries `observedState.baseline`, "↓ 17%" is a confident figure about a
   * reference the model never established.
   *
   * ⚠⚠ AND THE FIRST VERSION OF THIS GUARD MADE THE EXACT ERROR THIS PR IS
   * ABOUT, WHICH IS WHY IT IS QUOTED RATHER THAN QUIETLY REPLACED. It read
   * `recordedBaseline !== baseline` — comparing a field of UNDECLARED SCALE with
   * a normalised one. On the live capture that is `49 !== 0.59`, which is true
   * TRIVIALLY, because the two are not on the same scale; it establishes nothing
   * about whether the record disagrees with itself. A guard that fires on every
   * factor carrying a baseline is not a disagreement detector, it is a
   * both-fields-present detector wearing a comparison's clothes. Caught in
   * review by the option-node owner.
   *
   * PRESENCE IS THE HONEST CONDITION. Whether the two agree is UNKNOWABLE here —
   * `ObservedStateSchema` declares `baseline` with no doc comment and no scale,
   * so this surface can neither confirm nor refute agreement. What it can say is
   * that a second recorded quantity exists which it cannot relate to the first,
   * and that is sufficient reason to withhold a percentage measured from one of
   * them. A missing number is honest; a confident one about an unestablished
   * reference is not — the contract's own rule for the goal-probability
   * conversion one layer down.
   */
  const referenceContested = recordedBaseline != null

  // Change delta
  const delta = !referenceContested && baseline != null && baseline !== 0
    ? ((currentValue - baseline) / Math.abs(baseline)) * 100
    : null
  const deltaSign = delta != null ? (delta > 0 ? '\u2191' : delta < 0 ? '\u2193' : '') : ''
  /**
   * ⛔ NEUTRAL, DELIBERATELY. This used to be
   * `delta > 0 ? 'text-success' : delta < 0 ? 'text-danger'` — green for up, red
   * for down, on EVERY factor. On a cost, a churn rate or a risk that is exactly
   * backwards: the row painted a rise in churn green and told the reader it was
   * good news. Nothing on this row knows which direction is desirable — the sign
   * of a factor's effect lives on its EDGES, not on the factor — so the arrow
   * states the direction and the colour states nothing.
   */
  const deltaColor = 'text-text-light'

  const formatValue = (v: number) => {
    if (unit === '\u00A3' || unit === '$' || unit === '\u20AC') {
      return `${unit}${v.toLocaleString()}`
    }
    return unit ? `${v.toLocaleString()} ${unit}` : v.toLocaleString()
  }

  /**
   * ⭐ A UNIT DECORATES ONLY THE VALUE IT BELONGS TO.
   *
   * `rawBaseline` is in the factor's real units, so it takes the unit.
   * `baseline` is normalised, so it is shown bare — dropping the unit rather
   * than inventing a magnitude. `formatValue` is deliberately NOT reached in
   * the fallback: it is the function that prefixes the currency symbol.
   */
  const baselineText =
    rawBaseline != null
      ? formatValue(rawBaseline)
      : baseline != null
        ? baseline.toLocaleString()
        : 'N/A'

  /**
   * ⭐⭐ THE TWO ENDS OF THE ARROW WERE ON DIFFERENT SCALES, AND #1339 IS WHAT
   * PUT THEM THERE — stated plainly because it was my own change.
   *
   * #1339 correctly stopped the row printing `£0.59` for a £59 price by
   * rendering `rawBaseline` (real units) instead of `baseline` (normalised).
   * The editable target beside it is `currentValue`, which this file's own prop
   * doc declares is on the SAME SCALE AS `baseline` — i.e. normalised. So the
   * repaired row read `Currently: £59 → [0.49]`: two correctly-formatted
   * numbers, and an ARROW BETWEEN THEM THAT NOTHING LICENSES. Each value was
   * right; the comparison was not.
   *
   * This is derivable rather than inferred: the scale relationship is DECLARED
   * in the props above (`baseline` shares `currentValue`'s scale, `rawBaseline`
   * is the other one), so `rawBaseline != null` is exactly the cross-scale case.
   *
   * When the scales differ the arrow is replaced by a NAMED label on the input,
   * so the row shows two quantities the reader can tell apart instead of one
   * comparison it cannot trust. When they agree the arrow stays and means what
   * it says.
   */
  const referenceIsRawUnits = rawBaseline != null
  const comparable = !referenceIsRawUnits

  // F.6 passthrough: when CEE provides display_value, it IS the canonical
  // default-mode user-facing text. Raw numeric baseline/delta/editable input
  // only surface in tech mode to preserve editability for operators. This
  // also satisfies the Brief 4 constraint "InterventionRow reading
  // intervention.value directly when intervention.display_value is present".
  const hasDisplayValue = !!displayValue
  const showNumericSurface = !hasDisplayValue || techMode

  /**
   * ⚠ CLASSIFIED ONCE, OUTSIDE BOTH VALUE BRANCHES. The mark must not hang off
   * `showNumericSurface` or off `hasDisplayValue`: CEE writes a `display_value`
   * for some interventions and not others, and a mark on either branch alone
   * would vanish on exactly the rows the producer had written prose for. `null`
   * is the honest answer for an unknown or absent stamp and renders nothing.
   */
  const provenance = classifyInterventionProvenance(provenanceSource)

  return (
    <div
      data-testid={`inspector-intervention-${factorId}`}
      className="bg-panel border border-panel-border rounded-lg p-2.5 mb-1.5"
    >
      {/* Factor label + change indicator (delta hidden when displayValue is primary) */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-1.5">
          <NodeShapeIndicator nodeKind="factor" size={14} />
          <button
            type="button"
            onClick={onNavigate}
            className={`${typography.panelBody} text-text-body hover:text-info transition-colors truncate ${onNavigate ? 'cursor-pointer hover:underline' : ''}`}
            disabled={!onNavigate}
          >
            {factorLabel}
          </button>
        </div>
        {delta != null && showNumericSurface && (
          <span
            className={`${typography.panelMeta} ${deltaColor}`}
            data-testid={`intervention-delta-${factorId}`}
            title={INTERVENTION_ROW_STRINGS.deltaTitle}
            aria-label={`${Math.abs(delta).toFixed(0)}% ${INTERVENTION_ROW_STRINGS.deltaTitle}`}
          >
            {deltaSign} {Math.abs(delta).toFixed(0)}%
          </span>
        )}
      </div>

      {/* CEE-authored display_value — canonical default-mode text when present */}
      {hasDisplayValue && (
        <div className={`${typography.panelBody} text-text-body mt-1 ${techMode ? 'italic text-text-light' : ''}`}>
          {displayValue}
        </div>
      )}

      {/* Baseline → editable input (default mode when no displayValue, or always in techMode) */}
      {showNumericSurface && (
        <div className="flex items-center gap-2 mt-2">
          <div className="flex-1">
            {/* ⛔ NOT "Currently". That word asserted a PRESENT STATE, and the
                field it was printing — `observedState.value` — is not declared
                to be one. On the live capture it held a value one option had
                PROPOSED, so the row announced a proposal as the status quo and
                then measured every other option's change against it. "Recorded"
                claims only what can be shown: this is what the factor's record
                holds. */}
            <div
              className={`${typography.panelMeta} text-text-light`}
              data-testid={`intervention-reference-${factorId}`}
            >
              {INTERVENTION_ROW_STRINGS.referenceLabel}: {baselineText}
            </div>
            {referenceContested && (
              <div
                className={`${typography.panelMeta} text-text-light`}
                data-testid={`intervention-reference-contested-${factorId}`}
              >
                {INTERVENTION_ROW_STRINGS.contestedNote}
              </div>
            )}
          </div>
          {comparable ? (
            <ArrowRight size={10} className="text-text-light flex-shrink-0" aria-hidden="true" />
          ) : (
            <span
              className={`${typography.panelMeta} text-text-light flex-shrink-0`}
              data-testid={`intervention-model-value-label-${factorId}`}
            >
              {INTERVENTION_ROW_STRINGS.modelValueLabel}
            </span>
          )}
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            className={`${typography.panelBody} w-[110px] px-2 py-1 border rounded-lg text-center bg-panel ${
              disabled ? 'border-panel-border text-text-light' : 'border-info'
            }`}
          />
        </div>
      )}

      {/*
        ⭐ WHO CHOSE THIS NUMBER — IN THE SAME GLANCE AS THE NUMBER.

        ⚠⚠ THE DEFECT THIS CLOSES, ON THE SURFACE IT WAS WITNESSED ON (B1-b).
        UI #827 closed it on the Model tab; the Inspector — reached by
        double-clicking a node on the canvas, arguably before anyone opens the
        Model tab — still dropped `source` at `OptionPanel`'s destructure, so
        this row received no provenance and rendered the number bare. On the
        witnessed draw that meant a target CEE had invented (raw 22,500, no
        unit, `value_confidence: low`, CEE's own reasoning saying *"this amount
        is not stated in the brief"*) sitting in the same control, the same
        typography and with no badge, tooltip or unit beside the user's own
        £45,000. **The only difference between them was the digits.**

        ⚠ INLINE, NOT BEHIND A HOVER AND NOT IN A DISCLOSURE. A mark a user has
        to go and look for arrives after they have already believed the number.
        This costs no extra interaction — it is beneath the figure it qualifies,
        on both value branches.

        ⚠ TEXT, NOT COLOUR ALONE. The border tint reinforces a sentence that is
        already readable; it never carries the meaning by itself.

        ⚠ NO STAMP ⇒ NOTHING RENDERS. Unknown stays unknown.
      */}
      {provenance !== null && (
        <div className="mt-1.5">
          <span
            data-testid={`inspector-intervention-${factorId}-provenance`}
            className={`inline-flex items-center px-2 py-0.5 rounded-full bg-transparent border ${INSPECTOR_INTERVENTION_PROVENANCE_BORDER[provenance.kind]} text-text-body ${typography.panelMeta}`}
          >
            {INSPECTOR_INTERVENTION_PROVENANCE_LABEL[provenance.kind]}
          </span>
        </div>
      )}

      {/* Tech mode: normalised value */}
      {techMode && normalisedValue != null && (
        <div className={`${typography.panelMeta} text-text-light mt-1`}>
          System: model value: {normalisedValue.toFixed(2)}
        </div>
      )}
    </div>
  )
}
