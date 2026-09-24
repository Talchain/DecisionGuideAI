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
import { admitNumericField } from '../../ui/inspector-v2/shared/numericFieldAdmission'
import {
  didValueCommitRevert,
  VALUE_COMMIT_SETTLEMENT_COPY,
  type ValueCommitSettlementWord,
} from '../../conversation/valueCommitSettlement'
import type { SystemEventSendSettlement } from '../../conversation/settleSystemEventSend'

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
  ) => 'dispatched' | 'local_only' | 'not_encodable'
  /**
   * The model's CURRENT value, read at settlement time from the store rather
   * than from this render's prop, which may not have re-rendered yet when the
   * send resolves. Defaults to the latest `value` prop.
   */
  readCommittedValue?: () => number | null
  min?: number
  max?: number
  ariaLabel: string
  testId: string
}

export function NodeValueEditor({
  value, readout, onCommit, readCommittedValue, min, max, ariaLabel, testId,
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
    setDraft(value != null ? String(value) : '')
    setRefusal(null)
    setIsEditing(true)
  }, [value])

  const commit = useCallback(() => {
    if (draft.trim().length === 0) { setIsEditing(false); return }
    const admission = admitNumericField(draft, { min, max })
    if (!admission.ok) { setRefusal(admission.reason); return }
    // A commit that changes nothing is a no-op, not a dispatch.
    if (value != null && admission.value === value) { setIsEditing(false); return }
    const seq = ++commitSeqRef.current
    const beforeCommit = value
    const committedTo = admission.value
    const onSendSettled = (s: SystemEventSendSettlement) => {
      if (!mountedRef.current || seq !== commitSeqRef.current) return
      if (s === 'refused') return setSettlement('not_applied')
      if (s === 'unverified') return setSettlement('unconfirmed')
      if (s === 'blocked') return setSettlement('local_only')
      if (s === 'queued') return setSettlement(null)
      const now = readCommittedValue ? readCommittedValue() : valueRef.current
      setSettlement(didValueCommitRevert(beforeCommit, committedTo, now) ? 'not_applied' : null)
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
      outcome === 'not_encodable'
        ? 'This value cannot be sent to the model yet.'
        : 'Saved on this device only — not sent to the model yet.',
    )
  }, [draft, min, max, value, onCommit, readCommittedValue])

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
    return (
      <span className="inline-flex flex-col items-start gap-0.5">
        <button
          type="button"
          data-testid={testId}
          className={`nodrag nopan ${typography.nodeValue} group inline-flex items-baseline ${controls.editableRestingCanvas}`}
          aria-label={`${ariaLabel} — click to edit`}
          title="Click to edit"
          {...guard}
          onClick={(e) => { e.stopPropagation(); open() }}
        >
          <span className="min-w-0">{readout}</span>
        </button>
        {/* DESIGN-GAP-AUDIT row 37 — the truth strip's words, on the card. A
            `dispatched` commit is not a settled one (see this file's header);
            this is the ONLY new visible state, since `refusal` below already
            covers the two synchronous outcomes. */}
        {settlementCopy && (
          <span
            role={settlementCopy.role}
            data-testid={`${testId}-settlement`}
            className={`${typography.edgeLabel} ${
              settlementCopy.role === 'alert' ? 'text-text-body' : 'text-text-light'
            }`}
          >
            {settlementCopy.message}
          </span>
        )}
      </span>
    )
  }

  return (
    <span className="nodrag nopan inline-flex flex-col items-start gap-0.5" {...guard}>
      <input
        ref={inputRef}
        type="number"
        inputMode="decimal"
        step="any"
        min={min}
        max={max}
        value={draft}
        data-testid={`${testId}-input`}
        aria-label={ariaLabel}
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
}
