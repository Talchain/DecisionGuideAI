/**
 * InterventionRow — Factor link + baseline → editable input + Δ%
 * Used in OptionPanel §6.2: "What this option changes"
 */

import { useState, useCallback, useEffect, useRef, type KeyboardEvent } from 'react'
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
  /**
   * Names the EDITABLE TARGET, which is the one quantity on this row whose role
   * is certain: it is what this option sets the factor to. Nothing else in the
   * ordinary row makes a claim at all.
   */
  setsLabel: 'This option sets',
  /**
   * ⚠ TECHNICAL MODE ONLY. What the factor's record holds — a diagnostic for an
   * operator, never a comparison offered to a reader. NEVER "Currently": that
   * word asserted a present state, and `observedState.value` is not declared to
   * be one.
   */
  referenceLabel: 'Recorded',
  /** Names the raw-units figure in the technical diagnostic line. */
  rawLabel: 'raw',
  /**
   * ⚠ QUALIFIES A BARE NUMBER SHOWN AS A VALUE. With no `display_value` and no
   * unit, the target is the producer's NORMALISED 0-1 figure — and rendered as
   * plain text with nothing beside it, `0.49` reads as a real-world quantity.
   * The editable form never needed this because a box invites a scale question;
   * a settled-looking value does not.
   */
  modelValueQualifier: 'model value',
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
   * ⛔⛔ THERE IS NO PERCENTAGE, AND NO REFERENCE, IN THE ORDINARY ROW. THIS IS
   * THE THIRD VERSION OF THIS GUARD AND THE FIRST ONE THAT IS HONEST.
   *
   * ── HOW IT GOT HERE, BECAUSE THE ROUTE IS THE LESSON ───────────────────────
   * v1 printed `Currently: {observedState.value}` and a percentage measured from
   * it. `value`'s role is not declared, and on the live capture it held a level
   * ANOTHER OPTION PROPOSED — so the row announced a proposal as the status quo
   * and measured every option's change against it.
   *
   * v2 withheld the percentage when a differing `observedState.baseline` was
   * present, via `recordedBaseline !== baseline`. That comparison is between a
   * field of UNDECLARED SCALE and a normalised one — `49 !== 0.59` is true
   * TRIVIALLY — so it detected nothing. Caught in review.
   *
   * v3 made it presence-based, and that was still wrong, in the direction that
   * matters: it treated the ABSENCE of a second quantity as LICENCE for the
   * percentage. Fewer facts do not make a claim more supportable. The review's
   * counterexample settles it — `baseline 0.2 / rawBaseline 20 / currentValue
   * 0.3 / no recordedBaseline` rendered `Recorded: £20`, `model value 0.3` and
   * `+50%`: a raw figure and a normalised one side by side, and a ratio-scale
   * claim over a reference whose role was never established.
   *
   * ── SO THE ORDINARY ROW STATES THE ONE THING THAT IS CERTAIN ───────────────
   * What this option SETS the factor to. That is the option's own intervention,
   * and it needs no reference to be true. Everything else — the recorded value,
   * its raw form, the arithmetic between them — is a DIAGNOSTIC, and diagnostics
   * live behind `techMode` where an operator can read them knowing what they
   * are. A reader is shown no comparison, because this surface cannot establish
   * one, and an absent number is honest where a confident one is not.
   *
   * ⚠ THE PERCENTAGE IS GONE ENTIRELY, NOT MOVED. A ratio needs a reference with
   * a ROLE and a SCALE, and neither exists at any mode. Printing it to operators
   * would be the same unlicensed claim in a smaller font.
   */
  const technicalDiagnostics = techMode


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
   * ⚠ TECHNICAL DIAGNOSTICS ONLY — this string is never shown to a reader.
   *
   * ⚠⚠ THE COMMENT THAT STOOD HERE DESCRIBED AN ARROW THAT NO LONGER EXISTS,
   * and it is replaced rather than left, because a comment that outlives its
   * subject teaches the next reader to stop checking. It explained that #1339's
   * repair had put a RAW figure and a NORMALISED one at opposite ends of one
   * arrow — correct, and the reason the arrow went. The row no longer offers any
   * comparison at all, so there are no ends to reconcile; the same two numbers
   * appear here, side by side and LABELLED as what they are, for an operator who
   * has asked for them.
   */
  const technicalDiagnosticsText = [
    `${INTERVENTION_ROW_STRINGS.referenceLabel}: ${baselineText}`,
    rawBaseline != null && baseline != null
      ? `${INTERVENTION_ROW_STRINGS.rawLabel} ${rawBaseline.toLocaleString()} / model ${baseline.toLocaleString()}`
      : null,
    recordedBaseline != null
      ? `observed_state.baseline ${recordedBaseline.toLocaleString()}`
      : null,
  ]
    .filter(Boolean)
    .join(' · ')

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
      {/* Factor label. ⚠ The change indicator that lived here is GONE — see
          the block above `technicalDiagnostics` for why a percentage cannot be
          stated from this record. */}
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
      </div>

      {/* CEE-authored display_value — canonical default-mode text when present */}
      {hasDisplayValue && (
        <div className={`${typography.panelBody} text-text-body mt-1 ${techMode ? 'italic text-text-light' : ''}`}>
          {displayValue}
        </div>
      )}

      {/* The target this option sets, and nothing else. Default mode when there
          is no `display_value`, or always in techMode. */}
      {showNumericSurface && (
        <div className="flex items-center gap-2 mt-2">
          <div className="flex-1">
            <div
              className={`${typography.panelMeta} text-text-light`}
              data-testid={`intervention-sets-${factorId}`}
            >
              {INTERVENTION_ROW_STRINGS.setsLabel}
            </div>
            {/* ⚠ OPERATOR DIAGNOSTICS, NOT A COMPARISON. Behind `techMode` so a
                reader is never handed a recorded figure beside a normalised one
                and left to infer a relationship between them. */}
            {technicalDiagnostics && (
              <div
                className={`${typography.panelMeta} text-text-light italic`}
                data-testid={`intervention-diagnostics-${factorId}`}
              >
                {technicalDiagnosticsText}
              </div>
            )}
          </div>
          {/*
            ⭐⭐ A READ-ONLY TARGET READS AS A VALUE, NOT AS A BROKEN INPUT.
            (Option-node owner's ruling, 9 Sep 2026.)

            This was a `<input disabled>` in every state — a greyed box with a
            border and a cursor that does nothing. That shape makes a promise it
            cannot keep: it invites a click, absorbs one, and teaches the reader
            the product is broken rather than that this surface does not edit.
            The number is the same number either way; only the affordance
            changes, and an affordance that cannot act should not be drawn.

            ⚠ THE DRAFT STATE IS DELIBERATELY STILL READ FROM. Rendering
            `draft` rather than `currentValue` keeps ONE source for what this
            row displays, so the editable and read-only forms cannot drift into
            showing different numbers — which is exactly the class of defect
            this PR's parent spent three attempts closing.
          */}
          {disabled ? (
            <span
              data-testid={`intervention-target-readonly-${factorId}`}
              className={`${typography.panelBody} px-2 py-1 text-center text-text-body`}
            >
              {draft}
              {/* Only when nothing anchors the number to the real world. A
                  CEE-authored `display_value` or a unit already says what scale
                  this is; repeating it there would be noise. */}
              {!displayValue && !unit && (
                <span className={`${typography.panelMeta} text-text-light ml-1`}>
                  {INTERVENTION_ROW_STRINGS.modelValueQualifier}
                </span>
              )}
            </span>
          ) : (
            <input
              ref={inputRef}
              type="text"
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              className={`${typography.panelBody} w-[110px] px-2 py-1 border rounded-lg text-center bg-panel border-info`}
            />
          )}
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
