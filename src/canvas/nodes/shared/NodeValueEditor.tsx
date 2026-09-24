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
 * ⚠⚠ WHY THIS IS VALUE-WATCHING, NOT THE PROMISE `FactorControllablePanel`
 * USES. That panel calls `sendSystemEvent` directly and settles against ITS
 * OWN promise (`settleSystemEventSend` — `refused`/`unverified`/`sent`, five
 * states). This component is handed only `proposeFactorValue`'s SYNCHRONOUS
 * return value by whatever calls it (`FactorNode.tsx`: `onCommit={(v) =>
 * editAuthority.proposeFactorValue(v)}`) — the promise that settles inside
 * that authority's closure never reaches here, and `FactorNode.tsx` is a file
 * this change does not own. So settlement is inferred from the one channel
 * that DOES reach every render regardless: the live `value` PROP, which moves
 * to the optimistic write almost immediately and — on a proven refusal — is
 * reverted by the dispatcher a turn-length later. `didValueCommitRevert`
 * (`conversation/valueCommitSettlement.ts`) is the exact predicate
 * `FactorControllablePanel` already uses for the identical question,
 * extracted so the two cannot drift apart on what "reverted" means.
 *
 * ⚠ WHAT THIS CANNOT TELL APART, STATED RATHER THAN HIDDEN: a slow-but-
 * eventually-successful commit and a genuinely lost one look IDENTICAL by
 * value alone — both leave `value` sitting at the optimistic write with
 * nothing further to observe. There is no positive "CEE confirmed this" signal
 * reachable from here (see `optionInterventionEdit.ts`'s neighbouring note on
 * why `useModelEditAuthority` deliberately does not manufacture one). After
 * `UNCONFIRMED_AFTER_MS` with no observed revert, the honest sentence is
 * "could not confirm" — never "saved" — matching `settleSystemEventSend`'s own
 * `unverified`: "may or may not have landed... retained, never resolved".
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
   * refusal on screen rather than reporting a save that did not happen.
   */
  onCommit: (value: number) => 'dispatched' | 'local_only' | 'not_encodable'
  min?: number
  max?: number
  ariaLabel: string
  testId: string
}

/**
 * How long to wait, after a `dispatched` commit with no revert observed,
 * before saying the settlement could not be confirmed. Generous relative to
 * the measured ordinary turn latency — `FactorControllablePanel`'s own header
 * records 1756/1801/2019ms driving staging as a guest — so an everyday commit
 * is never shown a false alarm while it is merely slow.
 */
const UNCONFIRMED_AFTER_MS = 8000

/**
 * What a commit is waiting to learn, kept in a ref rather than state: the
 * watch itself must not re-render, only the settlement word it eventually
 * sets. `sawOptimisticWrite` is the two-step gate `didValueCommitRevert`'s own
 * doc requires — see this file's header for why "back to the old value" means
 * nothing until the optimistic write has been OBSERVED to land first.
 */
interface PendingSettlementWatch {
  readonly beforeCommit: number | null
  readonly committedTo: number
  sawOptimisticWrite: boolean
  readonly timeoutId: ReturnType<typeof setTimeout>
}

export function NodeValueEditor({
  value, readout, onCommit, min, max, ariaLabel, testId,
}: NodeValueEditorProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [refusal, setRefusal] = useState<string | null>(null)
  /** The word this card shows for a `dispatched` commit's eventual fate. */
  const [settlement, setSettlement] = useState<ValueCommitSettlementWord | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const watchRef = useRef<PendingSettlementWatch | null>(null)

  useEffect(() => { if (isEditing) inputRef.current?.focus() }, [isEditing])

  /** Stop watching a prior commit — superseded by a new one, or settled. */
  const stopWatching = useCallback(() => {
    if (watchRef.current) clearTimeout(watchRef.current.timeoutId)
    watchRef.current = null
  }, [])

  // A card that leaves the canvas mid-watch must not fire a state update into
  // an unmounted component.
  useEffect(() => stopWatching, [stopWatching])

  // Watches `value` while a commit is settling. Fires on every render where
  // `value` moved, so it sees BOTH the optimistic write landing (near-
  // immediate) and, on a proven refusal, the dispatcher's later revert (a
  // turn-length after) — two renders apart in the ordinary case.
  useEffect(() => {
    const watch = watchRef.current
    if (!watch) return
    if (!watch.sawOptimisticWrite) {
      if (value === watch.committedTo) watch.sawOptimisticWrite = true
      return
    }
    if (didValueCommitRevert(watch.beforeCommit, watch.committedTo, value)) {
      setSettlement('not_applied')
      stopWatching()
    }
  }, [value, stopWatching])

  const open = useCallback(() => {
    // A NEW edit retires any settlement word from a PRIOR commit — the same
    // rule `GoalPanel`'s `targetSettlement` follows for the goal target: a
    // stale "Not saved" must not survive past the edit that supersedes it.
    stopWatching()
    setSettlement(null)
    setDraft(value != null ? String(value) : '')
    setRefusal(null)
    setIsEditing(true)
  }, [value, stopWatching])

  const commit = useCallback(() => {
    if (draft.trim().length === 0) { setIsEditing(false); return }
    const admission = admitNumericField(draft, { min, max })
    if (!admission.ok) { setRefusal(admission.reason); return }
    // A commit that changes nothing is a no-op, not a dispatch.
    if (value != null && admission.value === value) { setIsEditing(false); return }
    const outcome = onCommit(admission.value)
    if (outcome === 'dispatched') {
      setIsEditing(false)
      setRefusal(null)
      stopWatching()
      setSettlement('saving')
      const timeoutId = setTimeout(() => {
        // ⚠ UNCONDITIONAL, AND THAT IS SAFE RATHER THAN CARELESS. Every path
        // that moves `settlement` away from `'saving'` (the revert branch
        // below, and `open()` starting a new edit) calls `stopWatching()`
        // FIRST, which clears this exact timer — so by the time this callback
        // can run at all, nothing has settled it any other way yet.
        setSettlement('unconfirmed')
        watchRef.current = null
      }, UNCONFIRMED_AFTER_MS)
      watchRef.current = { beforeCommit: value, committedTo: admission.value, sawOptimisticWrite: false, timeoutId }
      return
    }
    // ⛔ STAY OPEN. See the header: a refusal must not read as a save.
    setRefusal(
      outcome === 'not_encodable'
        ? 'This value cannot be sent to the model yet.'
        : 'Saved on this device only — not sent to the model yet.',
    )
  }, [draft, min, max, value, onCommit, stopWatching])

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
