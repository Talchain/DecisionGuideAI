/**
 * ⭐⭐⭐ EDIT A VALUE ON THE GRAPH ITSELF — the capability the founder asked for
 * four times and did not have.
 *
 * ## What was missing
 *
 * Measured on served `e6551858`, the factor card for `fac_annual_cost`:
 *
 *     cardText: "Annual Platform Cost  £60,000 est.  Lowers 70% Budget Headroom…"
 *     EDITABLE_FIELDS_ON_THE_CARD: 0
 *
 * Zero. Every buttons on the card was Ask, Challenge, a menu, a science icon or
 * "What's the evidence?". A double-click renames, and only via the side panel
 * (`ReactFlowGraph` → `requestNodeRename`). **There was no on-canvas editing
 * anywhere in `canvas/nodes` — no `InlineNumberEditor`, no `contentEditable`.**
 *
 * So the founder's report — *"I still can't edit the graph"* — was exact, and the
 * earlier repair (making the side panel's transparent field visible) fixed a
 * different surface. A panel is not the graph.
 *
 * ## Why this is a new component and not the inspector's editor
 *
 * `inspector-v2/shared/InlineNumberEditor` solves the same interaction, and
 * reusing it was the first instinct. Two reasons it is wrong here:
 *
 *  1. **Type scale.** It renders `typography.panelHeader text-xl`. Canvas text
 *     is counter-scaled through the four canvas tokens
 *     (`--canvas-label-scale`), and a panel token on a card is the defect
 *     `canvasGlyphScale.ts` exists to document: it would render at half or twice
 *     the intended size depending on zoom.
 *  2. **Layering.** Importing an `inspector-v2` component into `canvas/nodes`
 *     points a node at the panel's module graph. The shared thing worth sharing
 *     is the ADMISSION RULE, and that is what this imports — `admitNumericField`,
 *     the same predicate the panel commits through.
 *
 * ## ⛔ THE OUTCOME IS NEVER FLATTENED TO "SAVED"
 *
 * `useModelEditAuthority.proposeFactorValue` answers THREE things —
 * `dispatched`, `local_only`, `not_encodable` — and `useFactorValueCommit`'s
 * header already rules that they must not collapse. `ModelTabV2Panel` learned
 * this the expensive way: it threw all three away, so a refusal was
 * indistinguishable from a save and a confirmed edit evaporated with no message
 * and zero network calls.
 *
 * So this closes the field ONLY on `dispatched`. A refused or local-only edit
 * stays on screen, still editable, with the typed text intact — fail-visible,
 * the same behaviour the goal-target path has always had.
 *
 * ## ⛔⛔ A `dispatched` OUTCOME IS NOT A SETTLED ONE EITHER (DESIGN-GAP-AUDIT
 * row 37 — "Edit-state words on the card")
 *
 * The paragraph above closes the field on `dispatched`, which is right — but
 * `dispatched` only means the wire event left `useModelEditAuthority
 * .proposeFactorValue`'s closure; it says nothing about whether CEE applied
 * it. Before this section existed, the field closed and the card said
 * NOTHING further: a refusal arriving a second later — the exact case
 * `FactorControllablePanel.aRefusedEditIsNotShownAsSaved.spec.tsx` pins for
 * the INSPECTOR — reverted the value with no word on the CARD at all (`rg
 * "Not applied yet\|Saving…\|Not saved\|Could not confirm" src/canvas/nodes`
 * found zero hits; the truth strip's four words lived only in the inspector
 * and in `model-tab-v2`).
 *
 * ⭐ SETTLED ON THE SEND ITSELF, NOT GUESSED FROM THE VALUE. The caller passes
 * `opts.onSendSettled` through to `proposeFactorValue`, which reports the
 * estate's own `settleSystemEventSend` classification. `sendTurn` resolves only
 * after it has ingested the reply and applied or reverted the optimistic write,
 * so on `'sent'` the live value says which — the same read
 * `FactorControllablePanel` makes (`didValueCommitRevert`, shared so the two
 * cannot drift):
 *
 *   refused → "Not saved"          (the server certified it wrote nothing)
 *   sent + reverted → "Not saved"  (a 200 that wrote nothing)
 *   sent + kept → no word          (the card already shows the saved value)
 *   unverified → "Could not confirm"
 *   blocked → "Saved on this device only"
 *   queued → no word               (the flush queue owns it and holds "Model changed")
 *
 * ⛔ An earlier draft inferred settlement from the `value` prop with an 8s
 * timer. It could not see success, so EVERY accepted edit ended on "Could not
 * confirm" — a false alarm on the happy path, which teaches the user to ignore
 * the one word that matters.
 */
import { useState, useCallback, useRef, useEffect } from 'react'
import { typography } from '../../../styles/typography'
import { controls } from '../../../styles/controls'
import { EditPencilCue } from './EditPencilCue'
import { admitNumericField, NUMERIC_FIELD_REFUSAL } from '../../ui/inspector-v2/shared/numericFieldAdmission'
import {
  valueCommitSettlementWord,
  VALUE_COMMIT_SETTLEMENT_COPY,
  VALUE_NOT_ENCODABLE_COPY,
  type ValueCommitSettlementWord,
} from '../../conversation/valueCommitSettlement'
import type { SystemEventSendSettlement } from '../../conversation/settleSystemEventSend'

/** What a typed entry admits to: the value to commit, or the sentence saying why not. */
export type NodeValueEntryAdmission = { ok: true; value: number } | { ok: false; reason: string }

export interface NodeValueEditorProps {
  /**
   * The EXACT current value, never a rounded display string.
   *
   * ⚠ Seeding from the formatted readout is a known, pinned defect: opening a
   * `0.376` shown as "38%" and tabbing out once committed `0.38` and destroyed
   * the producer's precision. `InlineNumberEditor.precision.spec` exists for it.
   */
  value: number | null
  /** The formatted readout shown at rest (e.g. `£60,000`). Display only. */
  readout: React.ReactNode
  /**
   * Commit. Returns the authority's own outcome so this component can keep a
   * refusal on screen rather than reporting a save that did not happen, and
   * forwards `onSendSettled` so a dispatched commit is settled on the send.
   */
  onCommit: (
    value: number,
    opts: { onSendSettled: (settlement: SystemEventSendSettlement) => void },
  ) => 'dispatched' | 'local_only' | 'not_encodable' | { refused: string }
  /**
   * ⭐ E1b — AN ENTRY NOT ON `value`'S OWN SCALE. An option target is typed in the factor's unit ("£80,000", "80k")
   * and committed on the model scale; the one rule for that is `optionTargetEntry` (`admitOptionTargetEntry`), the
   * inspector's own. With `admit` the field is a TEXT field seeded with `seedText`, and a refusal shows `admit`'s
   * sentence. Without them nothing changes: a number field seeded with `String(value)`, admitted by
   * `admitNumericField` with `min`/`max`.
   */
  admit?: (draft: string) => NodeValueEntryAdmission
  seedText?: string
  /**
   * WHAT-IF "PUT IT BACK" (`graphChanges/valuePrefill.ts`, DL #85 5942153284): a request to OPEN this editor with
   * `text` in the field. Each new `seq` opens it once; the user still commits (Enter) through `onCommit`, the same
   * writer as any edit. `onPrefillConsumed(seq)` lets the requester retire the request so a remount never re-opens it.
   */
  prefill?: { text: string; seq: number } | null
  onPrefillConsumed?: (seq: number) => void
  /** The unit printed BEFORE the open field (`£`), where the card prints it. */
  prefix?: string
  /** Type for the INLINE resting readout; defaults to `typography.nodeValue`. A row that sits in smaller type (an option
   *  card's change row) passes its own, so becoming a control changes no size on the card. */
  restingTypography?: string
  /**
   * The model's CURRENT value, read at settlement time from the store rather
   * than from this render's prop, which may not have re-rendered yet when the
   * send resolves. Defaults to the latest `value` prop.
   */
  readCommittedValue?: () => number | null
  min?: number
  max?: number
  /**
   * ⭐ THE SENTENCE AN OUT-OF-BOUNDS ENTRY SHOWS (canvas audit edit-values F3).
   * `admitNumericField`'s own refusal is a bare `Max: 1`, which tells a person
   * nothing about WHY 5 is not a value; a caller that knows what the bound means
   * passes the estate's sentence for it. A non-number keeps the admission's own
   * reason.
   */
  outOfRangeCopy?: string
  /**
   * The scale the number in the field is on, shown beside the OPEN field only
   * (e.g. `0–1`). At rest the card keeps its tier word or unit — contract v3.1
   * rules out a bare model-scale figure on a factor card — but once the field is
   * open it shows the raw number, and a `0.8` with no scale beside it is the
   * reason a person typed `5` (F3).
   */
  scaleHint?: string
  /**
   * One sentence about what an edit here DOES (canvas audit edit-values F9 — a
   * baseline every option replaces). Carried in full by the resting control's
   * accessible name and hover title and by the open field's description.
   * Nothing is added to the card at rest (NODE-ANATOMY v3.2, Factor line 2).
   */
  editNote?: string
  /**
   * The SHORTEST form of `editNote`, the one shown under the open field —
   * NODE-ANATOMY v3.2 principle 2: the short form on the card, "with the full
   * sentence in the hover and aria". Measured on the served card at fit
   * (1440×900, 150 px wide) the full sentence took four lines under the field.
   */
  editNoteShort?: string
  ariaLabel: string
  testId: string
  /**
   * ⭐ HOW THE RESTING VALUE FLOWS (Paul's staging test, 28 Sep 2026, export
   * 64c5eccc). `'box'` (the default, every panel caller) is the `<button>` it
   * always was — and a `<button>` is ALWAYS an atomic inline-block (HTML's
   * button layout turns `display:inline` into `inline-block`), so a value that
   * wraps fills its whole line and whatever follows it drops below: on the
   * factor card, `est.` stood alone on the next line under "No ai assistant
   * use in place".
   *
   * `'inline'` rests as INLINE TEXT that is still a control: a `<span
   * role="button" tabIndex={0}>` with the same classes, name, title and click,
   * and Enter / Space opening the field as a native button would. Its words
   * wrap like any text, so `trailing` (the card's glue + source mark) follows
   * the value's LAST WORD. The open field is unchanged.
   */
  restingFlow?: 'box' | 'inline'
  /**
   * Rendered straight after the resting value, in its flow, and before any
   * settlement words — so a mark glued to the value can never be pushed past
   * "Not saved". Only read in the `'inline'` resting flow.
   */
  trailing?: React.ReactNode
}

export function NodeValueEditor({
  value, readout, onCommit, readCommittedValue, min, max, outOfRangeCopy, scaleHint, editNote, editNoteShort, ariaLabel, testId,
  restingFlow = 'box', trailing, admit, seedText, prefix, restingTypography, prefill, onPrefillConsumed,
}: NodeValueEditorProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [refusal, setRefusal] = useState<string | null>(null)
  /** The word this card shows for a `dispatched` commit's eventual fate. */
  const [settlement, setSettlement] = useState<ValueCommitSettlementWord | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  /** Only the LATEST commit may write a settlement word; an older send's reply is stale. */
  const commitSeqRef = useRef(0)
  const mountedRef = useRef(true)
  const valueRef = useRef(value)
  valueRef.current = value

  useEffect(() => () => { mountedRef.current = false }, [])

  // Open with the whole number selected, so typing replaces it rather than
  // appending to it (served witness 24 Sep: "60000" + "70000" → "6000070000").
  useEffect(() => {
    if (!isEditing) return
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [isEditing])

  const open = useCallback(() => {
    // A NEW edit retires any settlement word from a PRIOR commit — the same
    // rule `GoalPanel`'s `targetSettlement` follows for the goal target: a
    // stale "Not saved" must not survive past the edit that supersedes it.
    commitSeqRef.current += 1
    setSettlement(null)
    setDraft(seedText ?? (value != null ? String(value) : ''))
    setRefusal(null)
    setIsEditing(true)
  }, [value, seedText])

  // WHAT-IF "PUT IT BACK": open with the requested text, once per request. Same opening as a click (a new edit retires
  // any prior settlement word); only the draft differs. Nothing is committed here: Enter does that.
  const prefillSeq = prefill?.seq ?? null
  useEffect(() => {
    if (!prefill) return
    commitSeqRef.current += 1
    setSettlement(null)
    setDraft(prefill.text)
    setRefusal(null)
    setIsEditing(true)
    onPrefillConsumed?.(prefill.seq)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillSeq])

  const commit = useCallback(() => {
    if (draft.trim().length === 0) { setIsEditing(false); return }
    const admission = admit ? admit(draft) : admitNumericField(draft, { min, max })
    if (!admission.ok) {
      // A number outside the bounds gets the caller's sentence; a non-number
      // keeps the admission's own reason — it is not a range question. A
      // caller's own `admit` always speaks for itself.
      setRefusal(
        !admit && outOfRangeCopy && admission.reason !== NUMERIC_FIELD_REFUSAL.NOT_FINITE
          ? outOfRangeCopy
          : admission.reason,
      )
      return
    }
    // A commit that changes nothing is a no-op, not a dispatch.
    if (value != null && admission.value === value) { setIsEditing(false); return }
    const seq = ++commitSeqRef.current
    const beforeCommit = value
    const committedTo = admission.value
    const onSendSettled = (s: SystemEventSendSettlement) => {
      if (!mountedRef.current || seq !== commitSeqRef.current) return
      // The mapping is shared with the canvas context menu's Set value, which
      // proposes through the same writer — one reading of a settlement, not two.
      setSettlement(valueCommitSettlementWord(
        s, beforeCommit, committedTo,
        () => (readCommittedValue ? readCommittedValue() : valueRef.current),
      ))
    }
    const outcome = onCommit(committedTo, { onSendSettled })
    if (outcome === 'dispatched') {
      setIsEditing(false)
      setRefusal(null)
      // Unless the send already settled synchronously, say it is in flight.
      setSettlement(prev => (seq === commitSeqRef.current && prev === null ? 'saving' : prev))
      return
    }
    // ⛔ STAY OPEN. See the header: a refusal must not read as a save.
    setRefusal(
      typeof outcome === 'object'
        ? outcome.refused
        : outcome === 'not_encodable'
          ? VALUE_NOT_ENCODABLE_COPY
          : VALUE_COMMIT_SETTLEMENT_COPY.local_only.message,
    )
  }, [draft, min, max, outOfRangeCopy, value, onCommit, readCommittedValue, admit])

  // `nodrag nopan` and the pointer stop are not optional: without them React
  // Flow treats a drag inside the field as a node drag and the caret never
  // lands.
  const guard = {
    onPointerDown: (e: React.PointerEvent) => e.stopPropagation(),
    onClick: (e: React.MouseEvent) => e.stopPropagation(),
    onDoubleClick: (e: React.MouseEvent) => e.stopPropagation(),
  }

  // ⭐ NODE-ANATOMY v3.2: the value rests as TEXT on the card (no chip), with the
  // edit cue on hover and focus; the input then takes the SAME box, so opening
  // it moves nothing. `controls.editableResting` stays the inspector's.
  if (!isEditing) {
    const settlementCopy = settlement ? VALUE_COMMIT_SETTLEMENT_COPY[settlement] : null
    const settlementWords = settlementCopy && (
      <span
        role={settlementCopy.role}
        data-testid={`${testId}-settlement`}
        className={`${restingFlow === 'inline' ? 'block ' : ''}${typography.edgeLabel} ${
          settlementCopy.role === 'alert' ? 'text-text-body' : 'text-text-light'
        }`}
      >
        {settlementCopy.message}
      </span>
    )
    if (restingFlow === 'inline') {
      // Inline text, still a control (see `restingFlow`). `whitespace-normal`
      // is explicit: the card's value row is `nowrap` so the mark's glue holds,
      // and the value must re-open its own spaces to wrap inside the card.
      return (
        <>
          <span
            role="button"
            tabIndex={0}
            data-testid={testId}
            className={`nodrag nopan ${restingTypography ?? typography.nodeValue} group group/edit whitespace-normal ${controls.editableRestingCanvas}`}
            aria-label={`${ariaLabel} — click to edit${editNote ? `. ${editNote}` : ''}`}
            title={editNote}
            {...guard}
            onClick={(e) => { e.stopPropagation(); open() }}
            onKeyDown={(e) => {
              if (e.key !== 'Enter' && e.key !== ' ') return
              e.preventDefault()
              e.stopPropagation()
              open()
            }}
          >
            {readout}
            <EditPencilCue testId={`${testId}-pencil`} />
          </span>
          {trailing}
          {settlementWords}
        </>
      )
    }
    return (
      <span className="inline-flex flex-col items-start gap-0.5">
        <button
          type="button"
          data-testid={testId}
          className={`nodrag nopan ${typography.nodeValue} group group/edit inline-flex items-baseline ${controls.editableRestingCanvas}`}
          aria-label={`${ariaLabel} — click to edit${editNote ? `. ${editNote}` : ''}`}
          title={editNote}
          {...guard}
          onClick={(e) => { e.stopPropagation(); open() }}
        >
          <span className="min-w-0">{readout}</span>
          <EditPencilCue testId={`${testId}-pencil`} />
        </button>
        {/* DESIGN-GAP-AUDIT row 37 — the truth strip's words, on the card. A
            `dispatched` commit is not a settled one (see this file's header);
            this is the ONLY new visible state, since `refusal` below already
            covers the two synchronous outcomes. */}
        {settlementWords}
      </span>
    )
  }

  const editingBox = (
    <span className="nodrag nopan inline-flex flex-col items-start gap-0.5" {...guard}>
      <span className="inline-flex items-baseline gap-1">
        {prefix && (
          <span data-testid={`${testId}-prefix`} className={`${typography.nodeValue} text-text-light`}>{prefix}</span>
        )}
        <input
          ref={inputRef}
          type={admit ? 'text' : 'number'}
          inputMode="decimal"
          step={admit ? undefined : 'any'}
          min={admit ? undefined : min}
          max={admit ? undefined : max}
          value={draft}
          data-testid={`${testId}-input`}
          aria-label={ariaLabel}
          aria-describedby={[
            scaleHint ? `${testId}-scale` : null,
            editNote ? `${testId}-note` : null,
          ].filter(Boolean).join(' ') || undefined}
          aria-invalid={refusal != null}
          onChange={(e) => { setDraft(e.target.value); if (refusal) setRefusal(null) }}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); commit() }
            if (e.key === 'Escape') { setIsEditing(false); setRefusal(null) }
          }}
          className={`${typography.nodeValue} w-24 ${
            refusal ? controls.editableFieldCanvas.replace('border-field', 'border-danger') : controls.editableFieldCanvas
          }`}
        />
        {/* F3: the scale of the number in the field, beside it — same row, so
            opening the field still moves nothing below it. */}
        {scaleHint && (
          <span
            id={`${testId}-scale`}
            data-testid={`${testId}-scale`}
            className={`${typography.edgeLabel} text-text-light whitespace-nowrap`}
          >
            {scaleHint}
          </span>
        )}
      </span>
      {/* F9: what an edit here does, while the person is making it — short on
          the card, the full sentence in the hover and for assistive tech. */}
      {editNote && (
        <span
          id={`${testId}-note`}
          data-testid={`${testId}-note`}
          title={editNote}
          className={`${typography.edgeLabel} text-text-light`}
        >
          {editNoteShort ? (
            <>
              <span aria-hidden="true">{editNoteShort}</span>
              <span className="sr-only">{editNote}</span>
            </>
          ) : editNote}
        </span>
      )}
      {refusal && (
        /* ⚠ `text-text-body`, NOT `text-danger` — and the guard that caught this
           is right. `nodeSystem.semanticColourOnText.spec.ts` (rule 5) measured
           `text-danger` at 2.8:1 against the panel and 2.7:1 against
           `panel-hover`, under SC 1.4.3's 4.5:1 floor for text. There is NO
           danger token in the palette that clears it: `--danger` 2.8,
           `--danger-light` 1.72, and the 600/700 variants reach only 4.20.

           So the signal is split the way the two WCAG floors are split: the
           INPUT's border turns `border-danger`, which is a non-text indicator
           and answers the 3:1 floor, while the words stay at a contrast a person
           can actually read. Colour was doing work the border and `role="alert"`
           already do. */
        <span role="alert" data-testid={`${testId}-refusal`} className={`${typography.edgeLabel} text-text-body`}>
          {refusal}
        </span>
      )}
    </span>
  )
  // The inline resting flow keeps its `trailing` (the card's mark) beside the
  // open field too, exactly where it sat beside the box before this flow.
  return restingFlow === 'inline' ? <>{editingBox}{trailing}</> : editingBox
}
