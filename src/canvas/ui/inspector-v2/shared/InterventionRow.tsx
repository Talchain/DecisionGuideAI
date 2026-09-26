/**
 * InterventionRow — Factor link + baseline → editable input + Δ%
 * Used in OptionPanel §6.2: "What this option changes"
 */

import { useState, useCallback, useEffect, useId, useMemo, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { NodeShapeIndicator } from '../../../nodes/NodeShapeIndicator'
import { typography } from '../../../../styles/typography'
import { formatNumber } from '../../../utils/formatValueWithUnit'
import { INTERVENTION_NO_CHANGE_EPSILON } from '../../../utils/interventionDisplay'
import {
  admitOptionTargetEntry,
  describeOptionTargetValue,
  optionTargetEntryAdornment,
  optionTargetEntrySeed,
  resolveOptionTargetEntryFrame,
} from './optionTargetEntry'
import {
  classifyInterventionProvenance,
  type ValueProvenanceKind,
} from '../../../domain/valueProvenance'
import { INSPECTOR_RULE } from '../inspectorStyle'

/**
 * ⭐ v3.1 (DESIGN-GAP-v31 row 32): one factor target = one FLAT detail row with
 * the contract's 1px `#EEE9E1` rule — not a 280×134 bordered card (radius 14px
 * measured) inside the option's own 306×473 card. The label wraps instead of
 * truncating: a name is never clipped in the inspector.
 */
const INTERVENTION_ROW_CLASS = `py-2 border-b ${INSPECTOR_RULE.row} last:border-b-0`

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
   * ⚠⚠ QUALIFIES EVERY NUMERIC FALLBACK — AND THE UNIT DOES NOT EXEMPT IT.
   *
   * This condition read `!displayValue && !unit`, which is the exact scale
   * conflation the rest of this work removes, reintroduced in the guard against
   * it. On the live capture the target is `0.49` and the factor's `unit` is
   * `£` — but **that unit belongs to the recorded raw 59, not to the target**.
   * So the one row that most needed the qualifier was the only row that did not
   * get it, because a unit describing a different quantity suppressed it.
   *
   * A CEE-authored `display_value` is the only thing that exempts a number
   * here, because it is the only thing that states its own frame.
   */
  modelValueQualifier: 'model value',
  /**
   * ⭐ NAMES THE SCALE OF THE TECHNICAL-DETAIL INPUT (DEFECT 5 (c)). The
   * option-target input edits the MODEL's value — the carrier's contract — and
   * on a row whose reading is "£60k" or "59 GBP/month" that number is the
   * model's internal 0–1 figure, not the reading. Said in words beside the box,
   * so an operator typing into it knows which scale they are on.
   */
  internalScaleQualifier: "model's internal scale (0–1)",
  /**
   * The two actions under a refused field (ED #63 5806266691, S2: "offer
   * retry/change/discard as appropriate"). The field itself is the change.
   * Retry appears only where sending the same value again can succeed.
   */
  retryLabel: 'Try again',
  discardLabel: 'Discard',
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
  /**
   * The factor's `observed_state.cap`. With a real `unit` it is the scale a
   * typed AMOUNT is converted through — see `optionTargetEntry.ts` for when a
   * row takes amounts in the factor's unit and when it stays on the model
   * scale. Absent → the model scale, exactly as before.
   */
  cap?: number
  /**
   * ⭐ A VALUE THE READER ASKED FOR THAT DID NOT LAND — or may not have. The
   * FIELD keeps it (the reader's typed value stays visible) and `message` —
   * `<state> · <specific reason>`, e.g. `Not saved · …` — is printed directly
   * under the field, until the reader discards it, changes it, or tries again
   * (Experience Design, #63 5806266691, S2). `value` is on the model scale.
   *
   * ⛔ NEVER WRITTEN ANYWHERE, AND NEVER THE READOUT. The record is
   * `currentValue`, and the readout above the field keeps printing the last
   * authoritative saved value (`reading`) — a rejected draft is not canonical
   * state, so it lives in the field and nowhere else.
   */
  unapplied?: { value: number; message: string; retryable?: boolean } | null
  /** Drop `unapplied`; the row shows the saved value again. */
  onDismissUnapplied?: () => void
  /** Called with a MODEL-SCALE value, whatever frame the reader typed in. */
  onChange: (newValue: number) => void
  onNavigate?: () => void
  disabled?: boolean
  techMode?: boolean
  /** Normalised model value (0-1) for tech display */
  normalisedValue?: number
  /**
   * ⭐⭐ THE READING THE OPTION CARD PRINTS FOR THIS TARGET (DEFECT 5 (a)).
   *
   * Built by the caller through the card's own row builder
   * (`optionTargetDisplay.buildOptionTargetRow` → `formatInterventionTargetText`):
   * "£60k", "59 GBP/month", "Low (0.1)". The row's default view prints THIS,
   * never the model's internal number — served `a4434670` printed "0.295 model
   * value" beside a card saying "59 GBP/month" because the only human text it
   * had was `display_value`, which a user-set target never carries.
   *
   * ⚠ OMITTED ⇒ THE PRE-FIX SURFACE, UNCHANGED. The only production caller,
   * `OptionPanel`, always passes it (pinned through the mounted chain by
   * `OptionPanel.targetReadsLikeTheCard.spec.tsx`); direct-render specs that
   * pin the numeric surface's own properties keep rendering it.
   */
  reading?: string
  /**
   * `true` when `reading` is the TARGET ("This option sets £60k"); `false` when
   * the card's formatter declined to print a number and `reading` is its
   * direction words ("Increases"), which take no "This option sets" prefix.
   */
  readingIsTarget?: boolean
  /**
   * ⭐ DOES `reading` VISIBLY SHOW THE NUMBER THE INPUT HOLDS?
   * (`optionTargetDisplay.readingShowsModelValue`). Only then does the
   * model-scale input stand in the DEFAULT view; otherwise it stays under
   * technical detail, labelled, and the default view names that route.
   */
  inputMatchesReading?: boolean
  /** The option's name, for the input's accessible name "Target for <factor> under <option>". */
  optionLabel?: string
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
  cap,
  unapplied = null,
  onDismissUnapplied,
  onChange,
  onNavigate,
  disabled = false,
  techMode = false,
  normalisedValue,
  reading,
  readingIsTarget = true,
  inputMatchesReading = false,
  optionLabel,
}: InterventionRowProps) {
  /**
   * ⭐⭐ WHICH NUMBER THE FIELD IS — decided once, from the factor's own unit,
   * cap and anchor, by `optionTargetEntry`. The card prints `£60k`; a field that
   * printed `0.5` beside it and then ignored `80000` was the witnessed defect
   * (served `a4434670`, CDP starter).
   */
  const anchor = useMemo(
    () => ({ observedValue: baseline, observedRawValue: rawBaseline }),
    [baseline, rawBaseline],
  )
  const frame = useMemo(
    () => resolveOptionTargetEntryFrame({ unit, cap, ...anchor }),
    [unit, cap, anchor],
  )
  const adornment = optionTargetEntryAdornment(frame)
  /** What the field shows: the reader's unapplied value while one stands, else the record. */
  const shownValue = unapplied ? unapplied.value : currentValue
  const seedText = optionTargetEntrySeed(shownValue, frame, anchor)
  const [draft, setDraft] = useState(seedText)
  /** Why the typed text was not sent — rendered, never swallowed. */
  const [entryRefusal, setEntryRefusal] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  /** Set by the key that caused the blur, read once by the blur. */
  const blurIntentRef = useRef<'enter' | 'escape' | null>(null)
  /** The line under the field, so the field can point at it (`aria-describedby`). */
  const messageId = useId()

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
    setDraft(seedText)
    setEntryRefusal(null)
  }, [seedText])

  /**
   * ⛔⛔ NO SILENT OUTCOME. The old body was `parseFloat` and, on anything it
   * could not read, `setDraft(String(currentValue))` — the typed text vanished
   * and nothing said why. Every path below either sends, or leaves the typed
   * text in place with a sentence saying why it was not sent.
   */
  const handleBlur = useCallback(() => {
    const intent = blurIntentRef.current
    blurIntentRef.current = null
    if (intent === 'escape') {
      setDraft(seedText)
      setEntryRefusal(null)
      return
    }
    if (draft === seedText) {
      // Nothing was changed. A blur never re-sends; Enter on a value that did
      // not land is the explicit retry.
      setEntryRefusal(null)
      if (intent === 'enter' && unapplied) onChange(unapplied.value)
      return
    }
    const admission = admitOptionTargetEntry(draft, frame, anchor, shownValue)
    if (!admission.ok) {
      setEntryRefusal(admission.reason)
      return
    }
    setEntryRefusal(null)
    if (Math.abs(admission.value - currentValue) <= INTERVENTION_NO_CHANGE_EPSILON) {
      // The saved value, typed again: nothing to send, and nothing unapplied.
      if (unapplied) onDismissUnapplied?.()
      else setDraft(seedText)
      return
    }
    onChange(admission.value)
  }, [draft, seedText, frame, anchor, shownValue, currentValue, unapplied, onChange, onDismissUnapplied])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      blurIntentRef.current = 'enter'
      inputRef.current?.blur()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      blurIntentRef.current = 'escape'
      inputRef.current?.blur()
    }
  }, [])

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
  /**
   * ⛔⛔ THE DISABLED TARGET'S DISPLAY STRING. The house bound alone erases a
   * non-zero magnitude below 5e-5 (and renders a negative one as `-0`, keeping
   * the sign while losing the quantity). The full reasoning, the reason
   * significant digits are reached for at all, and the reason large values must
   * NOT take them, are stated once at `EdgePanel.tsx`
   * `currentEstimatedWeightDisplay` — a back-reference rather than a fourth copy
   * of the argument. All three readouts are pinned together by
   * `inspectorRawFloatDisplay.spec.tsx`, so if one drifts from the others the
   * spec REDs on that surface by name.
   */
  const targetDisplay = (() => {
    const housed = formatNumber(currentValue)
    return Number(housed) === 0 && currentValue !== 0
      ? formatNumber(currentValue, 2)
      : housed
  })()

  const provenance = classifyInterventionProvenance(provenanceSource)

  /**
   * ⭐ THE BOX'S ACCESSIBLE NAME (DEFECT 5 (b)). Served `a4434670` rendered the
   * option-target input with NO label at all, so a screen reader announced an
   * anonymous "edit text" on a surface whose card had just sent the user there.
   * It names the ENTITY the box writes — this option's target for this factor
   * (`/nodes/<option>/data/interventions/<factor>`) — not the factor's value.
   */
  const inputAccessibleName = optionLabel
    ? `Target for ${factorLabel} under ${optionLabel}`
    : `Target for ${factorLabel}`

  /**
   * ⭐ DISCARD — the reader's way back to the saved value (ED #63 5806266691,
   * S2: "offer retry/change/discard as appropriate"). Drops the typed text, the
   * field's own refusal and the unapplied value together. Set directly rather
   * than left to the re-seed effect, which is focus-guarded and keyed on
   * `seedText` — neither guarantees a reset from here.
   */
  const discard = useCallback(() => {
    blurIntentRef.current = null
    setDraft(optionTargetEntrySeed(currentValue, frame, anchor))
    setEntryRefusal(null)
    if (unapplied) onDismissUnapplied?.()
  }, [currentValue, frame, anchor, unapplied, onDismissUnapplied])

  /** RETRY — the same value again. Offered only where repeating it can succeed. */
  const retry = useCallback(() => {
    if (unapplied) onChange(unapplied.value)
  }, [unapplied, onChange])

  const fieldIsInvalid = entryRefusal !== null || unapplied !== null
  /** The field's own refusal speaks for what is in it now; else the value that did not land. */
  const underFieldMessage = entryRefusal ?? unapplied?.message ?? null

  /**
   * The editable field, with the unit on the side the card prints it.
   *
   * ⚠ `border-danger` IS THE ESTATE'S EXISTING REFUSED-FIELD TREATMENT, not a
   * new one: `NodeValueEditor` swaps `border-field` for it on the same event,
   * for the reason it records — a non-text indicator answers the 3:1 floor,
   * while the WORDS under the field stay `text-text-body`, because no danger
   * token clears 4.5:1 for text. The border reinforces the sentence; the
   * sentence and `aria-invalid` carry the meaning.
   */
  const renderField = (trailing: ReactNode) => (
    <span className="inline-flex items-center gap-1">
      {adornment.prefix && (
        <span className={`${typography.panelMeta} text-text-light`}>{adornment.prefix}</span>
      )}
      <input
        ref={inputRef}
        type="text"
        value={draft}
        aria-label={inputAccessibleName}
        aria-invalid={fieldIsInvalid ? true : undefined}
        aria-describedby={underFieldMessage !== null ? messageId : undefined}
        onChange={e => {
          setDraft(e.target.value)
          if (entryRefusal !== null) setEntryRefusal(null)
        }}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={`${typography.panelBody} w-[110px] px-2 py-1 border rounded-lg text-center bg-panel ${
          fieldIsInvalid ? 'border-danger' : 'border-info'
        }`}
      />
      {adornment.suffix && (
        <span className={`${typography.panelMeta} text-text-light`}>{adornment.suffix}</span>
      )}
      {trailing}
    </span>
  )

  /**
   * ⭐⭐ `<state> · <specific reason>`, DIRECTLY UNDER THE FIELD — Experience
   * Design's field-level pattern for a refused option-target edit (#63
   * 5806266691, S2). The field keeps the reader's typed value; this line says
   * why it did not land; the two buttons are the retry and the discard, and
   * the field itself is the change. The readout above keeps the last saved
   * value — a rejected draft is not canonical state.
   *
   * ⚠ WHEN THE FIELD IS NOT ON SCREEN (its box lives under technical detail and
   * the reader has left it), the line names the value itself, so "keep the
   * typed value visible" still holds without putting the box back.
   *
   * ⚠ THE BUTTONS DO NOT TAKE FOCUS ON PRESS. This field commits on blur, so a
   * press that blurred it first would send whatever was typed before the
   * button's own action ran.
   */
  const renderUnderField = (fieldOnScreen: boolean) => {
    const refusal = fieldOnScreen ? entryRefusal : null
    if (refusal === null && unapplied === null) return null
    const keepFocus = (e: { preventDefault: () => void }) => e.preventDefault()
    return (
      <div className="mt-1">
        {refusal !== null ? (
          <p
            id={messageId}
            role="alert"
            data-testid={`intervention-entry-refusal-${factorId}`}
            className={`${typography.panelMeta} text-text-body m-0`}
          >
            {refusal}
          </p>
        ) : (
          <p
            id={messageId}
            role="alert"
            data-testid={`intervention-unapplied-${factorId}`}
            className={`${typography.panelMeta} text-text-body m-0`}
          >
            {unapplied!.message}
            {!fieldOnScreen && (
              <span data-testid={`intervention-unapplied-value-${factorId}`}>
                {' '}Your entry: {describeOptionTargetValue(unapplied!.value, frame, anchor)}.
              </span>
            )}
          </p>
        )}
        <div className="flex items-center gap-3 mt-0.5">
          {refusal === null && unapplied?.retryable && (
            <button
              type="button"
              onMouseDown={keepFocus}
              onClick={retry}
              data-testid={`intervention-unapplied-retry-${factorId}`}
              className={`${typography.panelMeta} text-info hover:underline`}
            >
              {INTERVENTION_ROW_STRINGS.retryLabel}
            </button>
          )}
          <button
            type="button"
            onMouseDown={keepFocus}
            onClick={discard}
            data-testid={`intervention-unapplied-dismiss-${factorId}`}
            className={`${typography.panelMeta} text-info hover:underline`}
          >
            {INTERVENTION_ROW_STRINGS.discardLabel}
          </button>
        </div>
      </div>
    )
  }

  if (reading !== undefined) {
    /**
     * ⭐⭐ THE ROW READS LIKE THE CARD (DEFECT 5 + ED #63 §9).
     *
     * ── WHAT THE USER SEES, AND IN WHICH VIEW ──────────────────────────────
     *  · Always: the card's reading ("This option sets £60k") and who set it.
     *  · Default view, when the reading visibly IS the number the input holds
     *    ("Low (0.1)" / "0.2"): the input, labelled. That is the row the card's
     *    "Open the inspector to change them" promises, and it was hidden behind
     *    "Show technical detail" on every row CEE had written a reading for.
     *  · Default view, on a row whose field takes amounts in the factor's own
     *    unit (`optionTargetEntry` — "£60k" beside a `£ [60,000]` field): the
     *    input, labelled. The caller says so through `inputMatchesReading`.
     *  · Default view, when neither holds (a model-scale field beside "£60k"
     *    from a factor with no usable cap, "15%", "Increases"): no box — its
     *    only box is on the model's 0–1 scale, and "0.295 model value" beside
     *    "59 GBP/month" is the defect. The panel names the control that opens
     *    it ONCE, above the list (`OPTION_TARGET_EDIT_ROUTE_NOTE`), never per
     *    row — the density ruling `OPTION_EDIT_ROUTE_NOTE` already carries.
     *  · Technical detail: the same reading, the operator diagnostics, and the
     *    input — a model-scale input labelled as the model's internal scale; a
     *    user-unit input keeps its unit, and the model's own number is printed
     *    beside it, labelled as the internal scale.
     *
     * ⭐ THE FIELD'S SEED, PARSE AND COMMIT ARE `optionTargetEntry`'s (above),
     * in whichever frame the factor supports — the commit still sends the
     * model-scale value the carrier's contract takes.
     */
    const showInput = !disabled && (techMode || inputMatchesReading)
    return (
      <div
        data-testid={`inspector-intervention-${factorId}`}
        className={INTERVENTION_ROW_CLASS}
      >
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-1.5">
            <NodeShapeIndicator nodeKind="factor" size={14} />
            <button
              type="button"
              onClick={onNavigate}
              className={`${typography.panelBody} text-text-body text-left hover:text-info transition-colors break-words min-w-0 ${onNavigate ? 'cursor-pointer hover:underline' : ''}`}
              disabled={!onNavigate}
            >
              {factorLabel}
            </button>
          </div>
        </div>

        <div
          className={`${typography.panelBody} text-text-body mt-1`}
          data-testid={`intervention-readout-${factorId}`}
        >
          {readingIsTarget ? (
            <>
              <span
                className={`${typography.panelMeta} text-text-light`}
                data-testid={`intervention-sets-${factorId}`}
              >
                {INTERVENTION_ROW_STRINGS.setsLabel}
              </span>{' '}
              <span>{reading}</span>
            </>
          ) : (
            reading
          )}
        </div>

        {showInput && (
          <div className="flex items-center gap-2 mt-2">
            {renderField(
              techMode && frame.kind === 'model_scale' ? (
                <span
                  className={`${typography.panelMeta} text-text-light`}
                  data-testid={`intervention-internal-scale-${factorId}`}
                >
                  {INTERVENTION_ROW_STRINGS.internalScaleQualifier}
                </span>
              ) : null,
            )}
          </div>
        )}

        {/* Directly under the field: why a value did not land, and the way out. */}
        {!disabled && renderUnderField(showInput)}

        {/* ⭐ A USER-UNIT FIELD UNDER TECHNICAL DETAIL: the box is in £, so the
            model's own number is stated beside it, on its own line, labelled —
            the only place this row prints the internal value. */}
        {!disabled && techMode && frame.kind === 'user_units' && (
          <span
            data-testid={`intervention-internal-scale-${factorId}`}
            className={`${typography.panelBody} block mt-1 text-text-body`}
          >
            {targetDisplay}
            <span className={`${typography.panelMeta} text-text-light ml-1`}>
              {INTERVENTION_ROW_STRINGS.internalScaleQualifier}
            </span>
          </span>
        )}

        {/* A fenced row states the internal number only where internal numbers
            live — technical detail — and says which scale it is on. */}
        {disabled && techMode && (
          <span
            data-testid={`intervention-target-readonly-${factorId}`}
            className={`${typography.panelBody} block mt-2 text-text-body`}
          >
            {targetDisplay}
            <span className={`${typography.panelMeta} text-text-light ml-1`}>
              {INTERVENTION_ROW_STRINGS.internalScaleQualifier}
            </span>
          </span>
        )}

        {/* ⚠ BELOW THE TARGET, NOT UNDER "This option sets". D5 on the served
            build: the caption read "This option sets · Recorded: 0.35 · raw
            0.35 / model 0.35" — the FACTOR's record directly beneath the
            option's label, read as the option's target. The label now owns
            the reading on its own line; the factor's diagnostics follow the
            box, still technical-detail only. */}
        {technicalDiagnostics && (
          <div
            className={`${typography.panelMeta} text-text-light italic mt-1`}
            data-testid={`intervention-diagnostics-${factorId}`}
          >
            {technicalDiagnosticsText}
          </div>
        )}

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
      </div>
    )
  }

  return (
    <div
      data-testid={`inspector-intervention-${factorId}`}
      className={INTERVENTION_ROW_CLASS}
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
            className={`${typography.panelBody} text-text-body text-left hover:text-info transition-colors break-words min-w-0 ${onNavigate ? 'cursor-pointer hover:underline' : ''}`}
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

            This was `<input disabled>` in every state — a greyed box with a
            border and a cursor that does nothing. That shape makes a promise it
            cannot keep: it invites a click, absorbs one, and teaches the reader
            the product is broken rather than that this surface does not edit.

            ⚠⚠ IT READS `currentValue`, THE RECORD — AND THE RATIONALE THAT
            STOOD HERE ARGUED THE OPPOSITE, so it is quoted rather than dropped.
            It said: *"THE DRAFT STATE IS DELIBERATELY STILL READ FROM.
            Rendering `draft` rather than `currentValue` keeps ONE source for
            what this row displays."* That reasoning is right about a row with
            ONE surface and wrong here: `draft` is the EDIT BUFFER, and showing
            a buffer to a reader who cannot edit offers a value whose provenance
            is "whatever was last typed into a control that is no longer there".
            The editable branch keeps the buffer and its focus guard; the
            read-only branch reads the record. Same separation as the
            description one component up.
          */}
          {disabled ? (
            <span
              data-testid={`intervention-target-readonly-${factorId}`}
              className={`${typography.panelBody} px-2 py-1 text-center text-text-body`}
            >
              {/* ⚠⚠ `formatNumber`, AND THE NOTE THAT STOOD HERE IS KEPT RATHER
                  THAN DELETED, BECAUSE ITS OBJECTION WAS RIGHT AND IS WHY THIS
                  IS NOT `toLocaleString`. It read:

                    *"`String`, NOT `toLocaleString`. I reached for the latter
                    when this became text, and it defaults to THREE fractional
                    digits: a model value of 0.00049 renders as `0` — a real
                    non-zero quantity displayed as zero, which is the exact
                    class of lie this whole change exists to remove, introduced
                    by the change itself."*

                  Correct, and `formatNumber` answers it: its bound is FOUR
                  fractional digits, so 0.00049 renders `0.0005`. That exact
                  case is pinned in `inspectorRawFloatDisplay.spec.tsx` so the
                  objection cannot quietly stop being answered.

                  ⚠⚠ AND THE BOUND ALONE IS NOT ENOUGH — THIS PARAGRAPH REPLACES A
                  WRONG CLASSIFICATION. It previously called the sub-5e-5
                  collapse a "RESIDUAL, NAMED NOT FIXED", reasoning that
                  `String` was no fix for it either. That was wrong twice over:
                  `String` printed `0.00001` FAITHFULLY, so the collapse is a
                  regression introduced HERE, not something inherited; and a
                  comment calling a new defect a residual does not make it one.
                  The readout therefore goes through `targetDisplay` below, which
                  keeps the house bound except where it would erase a magnitude.

                  ⛔ THE SECOND HALF OF THE OLD NOTE NO LONGER HOLDS, and this
                  is the substantive change. It argued `String` here keeps this
                  surface identical to the editor's buffer, *"so the two surfaces
                  cannot disagree"*. They are MUTUALLY EXCLUSIVE branches — this
                  one renders only when `disabled` — so there is no moment at
                  which both are on screen to disagree. And they answer different
                  questions: this is a READOUT, the input is an EDIT BUFFER whose
                  content is parsed and COMMITTED on blur. Rounding a buffer
                  would write a rounded value into the model; rounding a readout
                  changes only what precision is claimed. `InlineNumberEditor`
                  draws exactly this line in its own header (*"Display formatting
                  stays separate… Seed from the EXACT value, never a rounded
                  display string"*), so the editable branch below is deliberately
                  left on `String`. */}
              {targetDisplay}
              {!displayValue && (
                <span className={`${typography.panelMeta} text-text-light ml-1`}>
                  {INTERVENTION_ROW_STRINGS.modelValueQualifier}
                </span>
              )}
            </span>
          ) : (
            /* ⚠ THE BOX NEEDS THE SAME TRUTH THE VALUE DOES. Being editable
               never made an unlabelled number scientifically valid — an
               operator typing into it is entitled to know which scale they
               are typing on. A user-unit row names its unit instead (the
               field's own adornment), because that is the scale it reads. */
            renderField(
              frame.kind === 'model_scale' && !displayValue ? (
                <span className={`${typography.panelMeta} text-text-light`}>
                  {INTERVENTION_ROW_STRINGS.modelValueQualifier}
                </span>
              ) : null,
            )
          )}
        </div>
      )}

      {/* ⭐ DIRECTLY UNDER THE FIELD — outside the numeric surface, so a value
          that did not land stays said (and named) when the row shows CEE's
          `display_value` for the saved target instead of the field. */}
      {!disabled && renderUnderField(showNumericSurface)}

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
