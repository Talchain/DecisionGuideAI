/**
 * Model tab v2 — THE ROW. One anatomy for every element (design §4.2).
 *
 * MOUNTED since the 16 Aug 2026 mount train — `ModelTabV2Panel` hosts this on
 * the Model tab (via `ModelTabBody`). The boundary guard now pins the mount
 * path instead of the old unmounted claim.
 *
 * ⚠ THIS COMPONENT NEVER WRITES, AND NEVER DECIDES THAT AN EDIT SUCCEEDED.
 * It renders `commit` — the state the edit host reports — and it renders
 * `row.primaryValue` VERBATIM. It does not re-derive a value, re-format a
 * number, or infer a provenance. The reason is design §2 F6: today an edge
 * strength, an option's intervention value and the goal target are local store
 * writes that never reach CEE, while a factor value edit is a real turn — and
 * the two are INDISTINGUISHABLE on screen. A row that can only render `applied`
 * from a receipt cannot reproduce that, whatever it is handed.
 *
 * THE NO-WRITER RULE (the lane boundary, design §8). An edit control is live
 * ONLY where the host has a CANONICAL transaction to dispatch on
 * (`editConnected` + the callbacks). A stub that reported success would be the
 * silent-local-write defect re-created inside the component written to kill it.
 *
 * ⚠⚠ AND WHAT HAPPENS "EVERYWHERE ELSE" IS **SILENCE**, NOT A DISABLED CONTROL.
 * This paragraph used to end *"…it renders DISABLED, with a label saying why. A
 * disabled affordance with an honest label beats a fake one"*. **It renders no
 * such thing, and has not for some time.** `editorAvailable` false takes the
 * idle arm at the foot of `ValueCell` — a bare `<span>` carrying the value and,
 * where present, Olumi's estimate hint. No control. No label. Measured, both
 * arms, in `aRowWithNoWriterSaysNothing.spec.tsx`.
 *
 * The CODE is right and the sentence was stale: silence here is a RULING, twice
 * over. THE "NOT SET" WALL below — *"where nothing can be done from this cell,
 * the cell is SILENT"* — removed twenty-odd identical inert strings from one
 * outline; and `sectionWriterNotice.ts` rules the reason SECTION-LEVEL, NEVER
 * PER-ROW, because *"a per-row string would rebuild the wall of identical inert
 * text that rule removed"*. A lane reading the old sentence and "restoring" a
 * per-row disabled label would be undoing a ruling it never saw, which is the
 * only reason this correction is written at this length.
 *
 * ⚠ THE CONFIRM CHIP (`onConfirmValueAsIs`, 18 Aug 2026) IS NOT AN EXCEPTION TO
 * THAT RULE — it is the rule applied to a different gesture. It has an
 * authority, so it renders live; and because it changes a value's PROVENANCE
 * rather than the value, it is deliberately outside the three-beat rather than
 * a phase of it. See the prop's own note.
 *
 * THE INLINE-CHIP CONFIRM (ruling R9, 16 Aug 2026). The three-beat renders in
 * the row itself: an input while `editing`, then Confirm / Discard CHIPS while
 * `proposed` — never a modal. Until Confirm, the model is unchanged and the
 * row says so in words.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { typography } from '../../styles/typography'
import { EDIT_RESERVED_HEIGHT_CLASS } from './valueCellMetrics'
import {
  GOAL_LABEL_FROM_BRIEF_COPY,
  GOAL_LABEL_FROM_BRIEF_TESTID,
} from '../domain/goalLabelProvenance'
import { ValueProvenanceMark } from './ValueProvenanceMark'
import { RELATIONSHIP_LABEL_SEPARATOR } from './adapters'
import {
  ATTENTION_IS_SEVERE,
  UNWRITTEN_QUESTION_TITLE,
  labelIsTypeDefault,
  ATTENTION_LABEL,
  ATTENTION_MARK,
  KIND_GLYPH,
  KIND_LABEL,
  deferralLabel,
} from './rowPresentation'
import {
  STRENGTH_BAND_MIDPOINTS,
  getStrengthBand,
} from '../components/model-tab/strengthBands'
import { buildManualGoalTarget } from '../conversation/manualGoalTarget'
import { factorValueAdmissionRefusal } from '../conversation/factorValueEdit'
import { statedTargetNumber } from '../domain/goalTarget'
import type { EditCommitState, DetailTier, ModelRow } from './types'
import { splitEffectLabel } from './effectDirection'
import { directionToneClass } from '../components/model-tab/utils'

export interface ModelRowViewProps {
  row: ModelRow
  /**
   * Content tier. ⚠ IT MUST NOT CHANGE LAYOUT — no reordering, no open/closed
   * change, no selection change (design §4.3 rule 1, closing F1). In the row it
   * governs one thing only: whether the element's ID is shown.
   */
  tier: DetailTier
  selected?: boolean
  /**
   * The authority's answer for this row's value, if an edit is in flight or has
   * settled. Absent means `idle` — the row shows the model's value.
   */
  commit?: EditCommitState
  /** Select the row and open the detail region. Read-only navigation. */
  onSelect?: (id: string) => void
  /** Focus this element on the canvas — today's `focusNodeById` behaviour. */
  onFocusOnCanvas?: (id: string) => void
  /**
   * Begin an edit. Presence alone does not enable the editor — see
   * `editConnected`.
   */
  onBeginEdit?: (id: string) => void
  /**
   * Whether THIS row's edit has a canonical transaction behind it. Defaults to
   * true so presence-of-callback semantics are unchanged for existing callers;
   * the host passes `false` for rows whose edit class has no wire carrier yet
   * (edge strength/likelihood/direction, option interventions, goal target),
   * which keeps their affordances honestly disabled.
   */
  editConnected?: boolean
  /** Live-edit callbacks (the three-beat). Absent ⇒ the static renders below. */
  onDraftChange?: (id: string, draft: string, unit?: string) => void
  /** Commit intent: editing → proposed. */
  onProposeEdit?: (id: string) => void
  /** Abandon the edit from either the input (Escape) or the proposal chip. */
  onDiscardEdit?: (id: string) => void
  /** The inline confirm chip — dispatches the canonical transaction. */
  onConfirmEdit?: (id: string) => void

  /**
   * Ratify this row's AI-estimated value as correct — the v1 Confirm ✓,
   * rehomed (18 Aug 2026).
   *
   * ⚠ IT IS A SEPARATE PROP FROM THE VALUE THREE-BEAT, NOT A PHASE OF IT, and
   * that separation is load-bearing. Confirming changes the value's PROVENANCE
   * and not the value, so it has no draft, no `from`/`to` and nothing to
   * propose — folding it into `EditCommitState` would give the row a "proposed"
   * state whose `to` equalled its `from`, which reads as an edit that did
   * nothing. Two gestures, two names (trap 21).
   *
   * Absent ⇒ the affordance does not render at all. It never renders disabled:
   * unlike the value editor, this operation HAS an authority, so an absent
   * callback means the host chose not to offer it here, not that the estate
   * cannot honour it.
   */
  onConfirmValueAsIs?: (id: string) => void
  /**
   * ⭐ Rename this element. ABSENT MEANS NO AFFORDANCE — see `renameAvailable`.
   *
   * The write lands on `store.updateNodeLabel`, which its own header calls "THE
   * ONE CHOKEPOINT EVERY RENAME GESTURE CROSSES": it records the
   * `structural_rename` intent BEFORE the local write (so `expected_label` is a
   * real concurrency assertion, not a tautology), pushes history, and supersedes
   * a goal's `from_brief` provenance. This directory may not reach the store, so
   * the host threads it in — exactly as `nodes` and `edges` arrive.
   */
  onRenameRow?: (id: string, nextLabel: string) => void
}

/**
 * ⭐ MAY THIS VALUE GIVE UP WIDTH TO THE LABEL BESIDE IT?
 *
 * `shrink-0` exists to stop a number breaking away from its unit — "35 %"
 * splitting across the gap is the defect it was written for. That protection is
 * about ATOMICITY, and a multi-word qualitative PHRASE has none: "Moderate
 * positive effect" truncates to "Moderate positive…" and still says what it
 * means.
 *
 * ⚠ WHY THIS MATTERS, MEASURED. The identity track is the only flexible one, so
 * 100% of the width an `auto` value cell takes comes out of the label — this
 * file records that hazard for the arms that were dark. It arrived on a LIVE
 * arm instead: at a 291px dock, thirteen relationship rows each rendered a
 * ~24-character effect phrase as immovable, pushing the label to its 6rem floor.
 * FOUR CONSECUTIVE ROWS read "Development he… Moderate positive effect", with
 * the arrow and the target — the half that tells them apart — truncated away.
 * Witnessed on the deployed build.
 *
 * A row whose identity is unreadable is worse than a phrase missing its last
 * word, and between the two the phrase is the one repeated on every row.
 *
 * The predicate is deliberately narrow: prose only. Anything carrying a DIGIT
 * is a measurement and keeps its protection, as does anything short enough that
 * shrinking it would buy the label nothing.
 */
/**
 * ⚠⚠ THE LEAF THAT MAKES `min-w-0` MEAN ANYTHING. Granting the CONTAINER
 * `min-w-0` lets the flex item shrink — and a bare text node inside it, with
 * `whitespace-nowrap` and no `overflow:hidden` anywhere, simply SPILLS. Review
 * measured a long "<magnitude> effect, direction not stated" value escaping its
 * box by 111.1px, the 280px dock by 65px, and overdrawing the attention column
 * by 29px. Base control 0.0px.
 *
 * ⚠ THIS PARAGRAPH NAMED A STRING THE PRODUCER CANNOT EMIT, and the correction
 * belongs beside the measurement rather than in a changelog. It read "the
 * producer-real 'Very strong effect, direction not stated'". `StrengthBand` is
 * `strong | moderate | weak | negligible` (`model-tab/strengthBands.ts:13`) —
 * there is no "very strong" band on this path, so that exact string is
 * unreachable here. The measurement was real and the phrasing family is real;
 * the specimen was not. The producer's longest is "Moderate effect, direction
 * not stated" at 37 characters, which is the one the corpus test uses.
 *
 * ⚠ AND THE REMEDY WAS ALREADY WRITTEN IN THIS FILE'S OWN COMMENT — "the
 * ellipsis belongs on a text LEAF, not on the flex box" — three lines above
 * the code that did not do it. `truncate` on the CONTAINER is the separate
 * defect that caused text-over-text; on the leaf it is correct.
 *
 * The leaf truncates ONLY when the value may shrink. A bare value ("35 %")
 * must never be cut — that is the defect that broke a number from its unit.
 */
function ValueLeaf({
  display,
  mayShrink,
  editable = false,
}: {
  display: string | null
  mayShrink: boolean
  /**
   * ⭐ THE EDIT AFFORDANCE LIVES HERE, NOT ON THE WRAPPING `<button>`.
   * Witnessed on deployed `a9c2e050`: `underline decoration-dotted` sat on the
   * button, `text-decoration` propagates to every descendant, and so the
   * secondary "Olumi: Low (0)" hint beside the value was underlined too —
   * promising a click that does nothing to it, on a row where nothing else is a
   * link. The mark belongs on the one thing the click edits.
   */
  editable?: boolean
}) {
  const textClass =
    [mayShrink ? 'truncate min-w-0' : '', editable ? 'underline decoration-dotted' : '']
      .filter(Boolean)
      .join(' ') || undefined

  /*
   * ⭐⭐ THE STATED DIRECTION RIDES A MARK THAT CANNOT SHRINK.
   *
   * MEASURED on deployed `d0f4628b`, guest board, dock 414px: eleven of eleven
   * relationship rows rendered "Moderat…" — six negative and five positive,
   * BYTE-IDENTICAL on screen, with no `title` anywhere to recover it from. The
   * cell is 80px and the phrase needs 138–142px, so the cut lands five
   * characters before the only word that carries the meaning.
   *
   * ⚠ THE TRADE ABOVE IS NOT REVERSED. The phrase still shrinks, so the label
   * keeps every pixel the 6 Sep measurement bought it. What changes is that the
   * DIRECTION leaves the shrinking text and becomes a `shrink-0` mark, so it
   * survives at any width the dock can reach. The header above was right that a
   * phrase may be cut; it was wrong that this one "still says what it means"
   * once cut — that sentence was never measured against 80px.
   *
   * `null` for "Negligible effect" and for the producer's own
   * "…, direction not stated": neither states a direction, and marking them
   * would invent the claim the second one exists to withhold.
   */
  const split = splitEffectLabel(display)
  if (split !== null) {
    return (
      <span className="flex items-center gap-1 min-w-0" title={display ?? undefined}>
        {/* Tone comes from the ESTATE'S OWN authority, not a second green/red
            map: `directionToneClass` already answers "what colour is a stated
            direction?" and is what the old model tab uses. Colour is the
            SECOND channel here — the arrow's shape carries the claim on its
            own, so this reads correctly with no colour vision at all. */}
        <span
          aria-hidden="true"
          className={`shrink-0 ${directionToneClass({ show: true, direction: split.direction, source: 'cee' })}`}
        >
          {split.direction === 'negative' ? '\u2193' : '\u2191'}
        </span>
        {/* The FULL producer string, unshortened, for assistive tech — so the
            split is a visual arrangement and never a loss of content. The
            visible half is hidden from the reader to stop it being announced
            twice. */}
        <span className="sr-only">{display}</span>
        <span aria-hidden="true" className={textClass}>
          {split.remainder}
        </span>
      </span>
    )
  }

  return (
    <span className={textClass}>
      {display ?? ''}
    </span>
  )
}

/**
 * ⚠ EXPORTED FOR TEST, AND THAT IS NOT A STYLE CHOICE. Review found this
 * predicate and `ValueLeaf` — the whole of `1d6e528b` — had ZERO coverage:
 * reverting both left 52 files / 808 tests green. It is a pure function of a
 * string with a bare magic boundary, so "jsdom performs no layout" is no
 * excuse for leaving it unasserted. See
 * `__tests__/valueMayShrink.spec.tsx`, whose corpus is DERIVED by calling the
 * real producer rather than by pasting strings.
 */
export function valueMayShrink(display: string | null): boolean {
  if (display === null) return false
  const text = display.trim()
  if (/\d/.test(text)) return false
  if (!text.includes(' ')) return false
  return text.length > 12
}

export function ModelRowView({
  row,
  tier,
  selected = false,
  commit,
  onSelect,
  onFocusOnCanvas,
  onBeginEdit,
  editConnected = true,
  onDraftChange,
  onProposeEdit,
  onDiscardEdit,
  onConfirmEdit,
  onConfirmValueAsIs,
  onRenameRow,
}: ModelRowViewProps) {
  const phase = commit?.phase ?? 'idle'
  const editorAvailable = row.editable && editConnected && typeof onBeginEdit === 'function'

  /**
   * ⭐ RENAME — the most basic authoring act, and it was absent from this
   * surface entirely (not disabled: absent).
   *
   * ⚠ NODES ONLY. `store.updateNodeLabel` behind this is a NODE action, and a
   * relationship row's label is a DERIVED endpoint pair (`row.labelEndpoints`,
   * built by `relationshipIdentity`) rather than a stored string — writing it
   * back would invent a field nobody holds. Gating on the kind rather than on
   * `labelEndpoints` is deliberate: an edge carrying its own authored label has
   * no endpoints, and it must not become renameable by that accident.
   *
   * ⚠ AND ABSENT-PROP MEANS NO AFFORDANCE, never an inert one. The lane
   * boundary (`modelTabV2Boundary.sourceScan`) forbids this directory from
   * touching the store, so the write can only arrive as a prop; a control that
   * rendered without one would swallow the rename silently — the local-write
   * dishonesty (design §2 F6) that the rest of this surface refuses.
   */
  const renameAvailable = typeof onRenameRow === 'function' && row.kind !== 'relationship'
  const [renaming, setRenaming] = useState(false)
  const [draft, setDraft] = useState('')
  /** Set by Escape, cleared by `beginRename`. See `cancelRename` below for why
   *  a ref rather than state, and why resetting the draft alone is not enough. */
  const cancelledRef = useRef(false)

  const beginRename = useCallback(() => {
    // ⚠ CLEARED HERE, so the abandon flag can never outlive the edit it
    // abandoned and suppress a genuine commit on the next one.
    cancelledRef.current = false
    setDraft(row.label)
    setRenaming(true)
  }, [row.label])

  /**
   * ⛔⛔ ESCAPE MUST WRITE NOTHING **BY CONSTRUCTION**, NOT BY LUCK.
   *
   * This read `setRenaming(false)` and nothing else, while the input carries
   * `onBlur={commitRename}` (below). Escape therefore cleared `renaming` with
   * `draft` still holding the abandoned text, and any focusout that reached the
   * handler would pass both refusals — non-blank, changed — and write. The write
   * is not benign: `store.updateNodeLabel` records a `structural_rename` intent,
   * pushes history, and on a GOAL supersedes the `from_brief` stamp, retiring a
   * provenance pill that is still true. An edit the user cancelled would silently
   * do the one thing this file's own comments say must not happen.
   *
   * ⚠ WHETHER A BROWSER DISPATCHES FOCUSOUT WHEN A FOCUSED INPUT IS REMOVED IS
   * CONTESTED, AND THAT IS EXACTLY WHY THIS IS NOT LEFT TO IT. Two reviews on
   * this PR reached opposite answers. Neither reading changes what the code
   * should do: the property is cheap to guarantee and expensive to reason about,
   * so it is guaranteed here and the browser question is retired.
   *
   * ── TWO PARTS, AND THE SECOND IS THE ONE THAT ACTUALLY BINDS ──────────────
   *
   * 1. `setDraft(row.label)` mirrors the named precedent, `EditableLabel.revert`
   *    (`ui/inspector-v2/shared/EditableLabel.tsx:110-113`), which resets the
   *    draft first so its own `onBlur={save}` becomes a no-op against the
   *    unchanged-value refusal. It also means a reopened editor cannot inherit
   *    an abandoned draft.
   *
   * 2. ⭐ A SYNCHRONOUS REF, BECAUSE PART 1 ALONE DOES NOT CLOSE THE WINDOW.
   *    `commitRename` is a `useCallback` closed over `draft`. A focusout
   *    dispatched from the SAME render — before React has flushed the state
   *    updates Escape queued — runs the handler that captured the PRE-RESET
   *    draft, so the unchanged-value refusal never sees the reset and the write
   *    still lands. `useRef` returns a stable object and mutates synchronously,
   *    so a check against it is correct under every ordering and every closure.
   *    Transplanting the precedent literally would have looked like a fix and
   *    left the hole, because `EditableLabel` blurs its input explicitly while
   *    this editor is REMOVED instead.
   *
   * The flag is cleared by `beginRename` (above), so it can never suppress a
   * later, genuine commit. `beginRename` is the SOLE entry point to the editor —
   * both the double-click and the keyboard route call it — so there is no way in
   * that skips the reset.
   */
  const cancelRename = useCallback(() => {
    cancelledRef.current = true
    setDraft(row.label)
    setRenaming(false)
  }, [row.label])

  const commitRename = useCallback(() => {
    // ⛔ THE ABANDON GUARD. Escape sets this synchronously, so a blur arriving
    // from the same render — with a stale `draft` in this closure — cannot write.
    // Read BEFORE the refusals, because the refusals inspect exactly the value
    // that is stale.
    if (cancelledRef.current) {
      setRenaming(false)
      return
    }
    setRenaming(false)
    const next = draft.trim()
    // ⚠ TWO REFUSALS, AND NEITHER IS COSMETIC. A BLANK commit would push an
    // empty string through the chokepoint and leave the row identifying nothing.
    // An UNCHANGED commit is not harmless either: `updateNodeLabel` pushes
    // history, records a `structural_rename` intent, and — on a goal —
    // supersedes the `from_brief` provenance stamp, retiring a pill that is
    // still true. A no-op edit must stay a no-op.
    if (next === '' || next === row.label) return
    onRenameRow?.(row.id, next)
  }, [draft, row.label, row.id, onRenameRow])

  /*
   * ⚠ THE AFFORDANCE IS BOUND TO THE ATTENTION REASON, NOT TO A RE-DERIVED
   * PREDICATE. `unconfirmed-estimate` is already the one predicate this surface
   * uses for "an AI estimate nobody has ratified" — it drives the row marker and
   * the queue counts. Asking the same question a second way here is how the
   * chip and the ⚠ start disagreeing about the same row (trap 12).
   *
   * ⚠⚠ AND THE VALUE GUARD IS GONE FROM HERE, WHICH IS THE POINT. It used to
   * read `&& row.primaryValue !== null` — a second, LOCAL answer to "is there
   * something to ratify?", written against the DISPLAY value. `primaryValue` is
   * `getPrimaryValue`, i.e. `raw_value`; the write authority gates on
   * `observedState.value`, and a capped factor carrying only `value` has one and
   * not the other. So this chip hid on rows the authority would have accepted
   * — while `FactorsSection` showed the same rows a button.
   *
   * `unconfirmed-estimate` now carries the whole question (`factorIsConfirmable`
   * in `adapters.ts`), so there is exactly one predicate and this surface reads
   * it rather than re-deriving half of it.
   */
  const canConfirmAsIs =
    typeof onConfirmValueAsIs === 'function' &&
    row.attention.includes('unconfirmed-estimate')

  return (
    <li
      data-testid={`model-row-v2-${row.id}`}
      data-kind={row.kind}
      data-phase={phase}
      aria-selected={selected}
      role="option"
      /*
        ⭐⭐ SUBGRID, NOT `display:contents` — AND THE DIFFERENCE IS THE WHOLE
        REASON THIS ROW LOOKS DIFFERENT FROM THE CENSUS FIX.

        The defect: every row was its own `flex` context, so a value's
        x-position was a function of THAT row's label length and nothing else.
        Driven on staging `b7d91382`, `Not set` landed at five different
        x-positions in one list. The scan a user makes here is "which of these
        has no value?" — a COLUMN question, unanswerable while the answer moves
        horizontally on every row.

        `ModelStrip` (#1138) fixed the same defect with grid-on-the-`<ul>` +
        `display:contents` on each row. ⚠ THAT DOES NOT TRANSFER HERE, and
        copying it would have been a regression: those rows are passive
        `role="listitem"`. THESE are `role="option"` in a `listbox`, carrying
        `aria-selected`, an `onClick`, a selection background and a bottom
        border — all painted on the principal box. `display:contents` REMOVES
        the principal box, so the selection background and border vanish and the
        click target collapses to the union of the children, leaving the gaps
        dead.

        `grid-cols-subgrid` keeps the box — background, border, click target and
        `aria-selected` all untouched — while the row's four cells adopt the
        column tracks defined once on the `<ul>` in `ModelOutline.tsx`. Requires
        Tailwind ≥3.4 (this repo: 3.4.19) and a modern target (Vite default; no
        browserslist pin).

        `col-span-4` is load-bearing: a subgrid item adopts only the tracks it
        spans, so a row spanning fewer columns than the `<ul>` defines silently
        stops aligning. If a fifth column is ever added, this number moves with
        it — the guard in `rowAtomsAlignToOneGrid.spec.tsx` asserts the two
        agree, derived from the `<ul>`, so drift REDs rather than mis-renders.
      */
      className={`grid grid-cols-subgrid col-span-4 items-center gap-2 px-2 py-1.5 border-b border-panel-border ${
        selected ? 'bg-panel-hover' : ''
      }`}
      onClick={() => onSelect?.(row.id)}
    >
      <span
        aria-label={KIND_LABEL[row.kind]}
        title={KIND_LABEL[row.kind]}
        data-testid={`model-row-v2-${row.id}-glyph`}
        className="text-text-light select-none"
      >
        {KIND_GLYPH[row.kind]}
      </span>

      {/* ── CELL 2 · IDENTITY — the flexible track. `min-w-0` is required or
          the button's automatic minimum keeps the column from ever shrinking,
          which is the defect this file already fixed once at the atom level. */}
      <span className="flex items-center gap-1.5 min-w-0">
      {renaming ? (
        /*
          ⭐ THE RENAME EDITOR. It REPLACES the label rather than sitting beside
          it: two representations of one identity on screen at once is the defect
          the whole v2 consolidation exists to remove, and a row is the smallest
          place it could recur.

          ⚠ THE SIZING MIRRORS THE BUTTON IT REPLACES — `flex-1 min-w-[6rem]`,
          the same pair, for the same two reasons recorded at length below:
          `flex-1` makes identity absorb the row's deficit so short values stop
          wrapping, and the 6rem floor stops the cell being crushed past
          legibility. An input sized any other way would move every other cell in
          the subgrid the moment a user began typing.
        */
        <input
          type="text"
          data-testid={`model-row-v2-${row.id}-rename`}
          aria-label={`Rename ${row.label}`}
          value={draft}
          autoFocus
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); commitRename() }
            else if (e.key === 'Escape') { e.preventDefault(); cancelRename() }
          }}
          /* ⚠ BLUR COMMITS, matching the inspector's `EditableLabel` and the
             canvas rename. A blur that DISCARDED would lose a rename the user
             believes they made simply because they clicked away — and
             `commitRename` already refuses a blank or unchanged value, so the
             quiet path stays a no-op rather than a write. */
          onBlur={commitRename}
          /* The row is `role="option"` with its own `onClick`; without this a
             click inside the editor selects the row and a keystroke could
             bubble into the outline's keyboard handling. */
          onClick={e => e.stopPropagation()}
          onDoubleClick={e => e.stopPropagation()}
          /* ⚠ `bodySmall` (14px), NOT `panelBody` (12px) — and NOT a style choice.
             DS v5 §2.1 makes 14px the minimum for a TEXT-ENTRY control and §2.2
             does not list inputs among the panel-context overrides; a 12px field
             is a usability regression at the 280px dock floor.
             `inputsStayAtMinimumSize.spec.ts` caught this exact line at 12px on
             its first write and names the remedy: "tabular for numeric fields,
             bodySmall otherwise". A rename is text, so bodySmall. It is
             deliberately 2px larger than the label button it replaces — the
             button is not a text-entry control and the rule does not reach it. */
          className={`${typography.bodySmall} text-text-body bg-panel-hover border border-panel-border rounded px-1 py-0 flex-1 min-w-[6rem]`}
        />
      ) : (
      <button
        type="button"
        data-testid={`model-row-v2-${row.id}-label`}
        /* ⚠⚠ `flex-1` IS WHAT MAKES THE LABEL ABSORB THE ROW'S DEFICIT, and its
           absence is why every short value to the right of this row wrapped.

           ⚠ CORRECTED, BECAUSE THE MECHANISM I FIRST WROTE HERE WAS FALSE. It
           said `min-width:auto` "refuses to shrink below its content, so
           `truncate` could not act". A flex item's automatic minimum size
           resolves to ZERO whenever its main-axis `overflow` is not `visible`
           — and this button already carried `truncate`, which sets
           `overflow:hidden`. The label could always shrink; that was never the
           blocker, and measurement confirms it (a `truncate` item with and
           without `min-w-0` lands at the identical width).

           What actually changed the outcome is two things, neither of them
           `min-w-0`. `flex-1` is `flex: 1 1 0%`: the label gets the only zero
           flex-basis in the row, so all FREE SPACE lands on it while every
           sibling sits at content size. `whitespace-nowrap` on the value cells
           then removes the wrap escape hatch, so a cell that is squeezed
           ellipsises instead of breaking "35 %" off its own unit.

           ⚠ AND A CORRECTION TO THIS PARAGRAPH'S OWN FIRST DRAFT, which said
           free space "AND shortfall" land on the label. Not so, and the
           distinction matters: a `flex-basis: 0` item takes ZERO of a SHRINK
           distribution, because the scaled shrink factor is base size × shrink
           factor = 0. Growth lands here; a genuine shortfall lands on the
           SIBLINGS. That is exactly why the Advanced id span later had to be
           given `min-w-0 truncate` — with the label unable to absorb a
           deficit, the id was the last default-shrink item and took it. Two
           comments in this file described the deficit case incompatibly; this
           is the one that matches the code.

           The label is the one thing here that can lose characters without
           losing meaning, so it is the one thing that should shrink. */
        /* ⚠⚠ `min-w-[6rem]`, NOT `min-w-0`, AND THE FLOOR IS THE SECOND HALF OF
           THE FIX. `min-w-0` let `truncate` work — and then let it work all the
           way down: measured after the first pass, 24 labels were crushed and
           "GDPR EU Data Residency Compliance" rendered in 26px, which is one
           character and an ellipsis. A label truncated past legibility is not a
           label; the row has told you nothing and taken a line to do it.

           6rem holds roughly twelve characters, which is enough to recognise a
           node you already know. Below that the row should give up something
           else — see the estimate hint below, which is the secondary text that
           can afford to go. */
        /* ⚠ THE FULL LABEL ON `title`. The identity column truncates, and
           before this the truncated remainder was unreachable by any VISUAL
           means — no hover, no tooltip, nothing. Witnessed on the deployed
           build: three relationship rows all read "Tech Lead Hired..." with no
           way to tell them apart by eye. This does not FIX that (a tooltip is
           not an answer to an unreadable row, and it is unreachable by touch
           and keyboard) — it stops the remainder being lost outright while the
           column itself is dealt with.

           ⚠ A CORRECTION TO THIS COMMENT'S OWN FIRST DRAFT, which said
           "unreachable by ANY means". THAT SUPERLATIVE WAS FALSE, and the
           domain it overstated is exactly the one the sentence above already
           narrows. The full label is this button's own TEXT CONTENT, and this
           button carries no `aria-label` ATTRIBUTE — every `aria-label` inside
           the element is comment prose, this sentence included — so the
           UNTRUNCATED label has always been its accessible name. `truncate` is
           `overflow:hidden` + `text-overflow:ellipsis`: presentational only,
           with no effect on the accessibility tree. The contrast control for
           that absence is in this same file and needs no count to stay true —
           sibling controls DO carry the attribute, and quote the label in full
           (`Confirm … is correct`, `New value for …`, `Change …`), so a sweep
           that found nothing here is discriminating rather than blind. For a
           screen-reader user the remainder was never lost at all; the defect
           is, and always was, a VISUAL one.

           ⚠ AND THAT STILL HOLDS UNDER THE ENDPOINT SPLIT BELOW, which landed
           on this branch after this correction was written — checked rather
           than assumed, because a rebase is exactly where a sentence like this
           goes stale. `relationshipIdentity` builds the label as
           `${from}${RELATIONSHIP_LABEL_SEPARATOR}${to}` and hands the same two
           halves to `labelEndpoints` (`adapters.ts:303,355`), and the
           separator constant carries its own spaces, so the three spans
           concatenate to text content byte-identical to `row.label`. Either
           branch, the accessible name is the whole label. */
        /* ⚠ A PLACEHOLDER NAMES ITSELF ON MORE THAN COLOUR — but be precise
           about how much this buys. `title` is the accessible DESCRIPTION, not
           the NAME: once an element has content the name comes from the content,
           as `9d4979e` established in this same file. Most screen readers
           announce the description, some do not by default, and the NAME a
           reader hears is still "Question".
           
           An earlier version of this comment claimed three channels and that
           "the title says it in words too" for assistive tech — an overclaim,
           corrected on review. Colour and italics carry it for sighted readers;
           the description is a weaker second channel; a genuinely equal one
           would need the name itself to change, which is a vocabulary decision
           and is ratified elsewhere. */
        title={labelIsTypeDefault(row) ? UNWRITTEN_QUESTION_TITLE : row.label}
        className={`${typography.panelBody} ${
          labelIsTypeDefault(row) ? 'text-text-light italic' : 'text-text-body'
        } text-left min-w-[6rem] flex-1 ${
          row.labelEndpoints ? 'flex items-baseline overflow-hidden' : 'truncate'
        }`}
        onClick={e => {
          e.stopPropagation()
          onFocusOnCanvas?.(row.id)
        }}
        /* ⭐ THE RENAME GESTURE, and it is the one this product already has:
           `ReactFlowGraph.tsx:1390-1394` binds node double-click to
           `requestNodeRename`. Single click keeps its existing meaning ("show
           me this on the canvas"), so nothing is displaced — a rename bound to
           the single click would have taken that away. */
        onDoubleClick={renameAvailable ? beginRename : undefined}
      >
        {/* ⭐⭐ A DIRECTED RELATIONSHIP TRUNCATES FROM BOTH ENDS, NEVER FROM ONE.
            Witnessed on deployed `a9c2e050`: three consecutive rows all read
            "Tech Lead Hired…". They were three edges out of ONE source node, so
            the only thing telling them apart was the TARGET — and a single
            `truncate` eats the tail first, which is exactly the half that
            discriminates. At the 6rem floor the row said the same thing three
            times.

            Each endpoint now gets `flex-1 min-w-0 truncate`, so they share the
            column and ellipsise independently: "Tech L… → Deliv…" instead of
            "Tech Lead H…". Both ends survive at ANY width, which is the
            property — for a directed edge both endpoints are identity and
            neither is optional.

            ⚠ ONLY WHEN A PAIR EXISTS. An edge carrying its OWN authored label
            has no endpoints and keeps the plain single truncate; splitting a
            sentence on an arrow it happens to contain would invent a structure
            nobody wrote. `labelEndpoints` is set only where a pair is real, so
            the two states are distinguished by data rather than by a guess.

            ⚠ CORRECTED: an earlier version of this comment said the accessible
            name "comes from the row's own `aria-label`/`title`". FALSE at the
            bytes — this button has no `aria-label`, and `title` is a last-resort
            fallback that never applies once an element has content. The name is
            computed FROM THESE SPANS. That is fine, and it is fine for a
            specific reason rather than by luck: the separator is the shared
            constant, rendered `whitespace-pre` in its own non-hidden span, so
            the concatenation is byte-identical to `row.label`. The spec asserts
            that with `.textContent` equality, not `toHaveTextContent`, which
            whitespace-normalises and would pass an accname that inserted
            inter-element spaces. */}
        {row.labelEndpoints ? (
          <>
            <span className="truncate min-w-0 flex-1">{row.labelEndpoints[0]}</span>
            {/* ⚠ NOT `aria-hidden`, AND THE SPACES ARE IN THE STRING. The
                separator IS the shared constant, so the button's text content
                stays byte-identical to `row.label` — a screen reader, a
                copy-paste and the `title` all read exactly what they read
                before. Hiding the arrow and spacing the halves with `gap`
                would have left assistive tech with
                "Tech Lead HiredDelivery Throughput", which is a regression
                dressed as a layout tidy-up. */}
            <span className="shrink-0 text-text-light whitespace-pre">
              {RELATIONSHIP_LABEL_SEPARATOR}
            </span>
            <span className="truncate min-w-0 flex-1">{row.labelEndpoints[1]}</span>
          </>
        ) : (
          row.label
        )}
      </button>
      )}

      {/* The label is the user's own sentence lifted from the brief, not an
          objective. Same claim and same predicate as the canvas node and the
          Analysis Goal field — the outline states it, and the one place to act
          stays the Analysis tab.

          ⚠⚠ `noticeNoEditHere`, NOT `notice`, AND THAT IS THE WHOLE FIX.
          The shared sentence used to end "Edit it to say what you want to
          achieve." — an instruction THIS SURFACE CANNOT CARRY OUT. Measured at
          `bdf4fb89`: `EditableLabel|onRename|structuralRename|contentEditable|
          renameNode` is ZERO across all 17 non-test files of this directory
          (contrast control: 34 files app-wide), and `ModelDetailRegion.tsx:261`
          renders the label as a read-only `<h3>`. The comment above already
          conceded the point — "the one place to act stays the Analysis tab" —
          so the row was reading out an imperative its own notes said it could
          not honour.

          ⚠ THE IMPERATIVE IS NOT DELETED, IT IS SCOPED. It stays on
          `HeroSection`, where the notice sits directly beneath a field that
          really writes the label. Dropping it there would have removed a true
          instruction to fix a false one — which is why this is a second
          constant rather than an edit to the first.

          ⛔ AND NO WRITER IS ADDED HERE. A label editor on this surface is a
          separate capability, deliberately not smuggled into a copy fix.

          ⭐ REBASE NOTE (PR #1386 onto #1436): this row now DOES carry a
          rename (double-click, see `beginRename`/`commitRename` below), so the
          "no writer on this surface" premise above no longer holds in full.
          The rendered constant deliberately stays `noticeNoEditHere` anyway:
          `__tests__/theTabDoesNotPromiseWhatItCannotDo.spec.tsx:365` pins this
          surface to it, and re-scoping the copy is a copy decision with its own
          guard, not something a rebase may smuggle in. Rowed as follow-up. */}
      {row.labelFromBrief === true && (
        <span
          data-testid={GOAL_LABEL_FROM_BRIEF_TESTID}
          title={GOAL_LABEL_FROM_BRIEF_COPY.noticeNoEditHere}
          className={`${typography.panelMeta} text-text-light whitespace-nowrap shrink-0`}
        >
          {GOAL_LABEL_FROM_BRIEF_COPY.pill}
        </span>
      )}

      {/*
        ⛔⛔ THE KEYBOARD ROUTE, AND THE INCONSISTENCY IS WHAT NAMED IT.

        The gesture on the label button above is `onDoubleClick`. Enter and
        Space on a focused element dispatch `click`, NEVER `dblclick` — so
        double-click is a POINTER-ONLY gesture and, with it as the sole trigger,
        a keyboard user could not rename at all. Not slowly, not awkwardly: not
        at all.

        ⚠ AND THE TELL WAS IN THIS FILE. The VALUE cell (`ValueCell`, testid
        `model-row-v2-<id>-value`) begins its edit from a `<button>`'s own
        `onClick`, which Enter and Space DO reach. So on one surface, in one
        row, editing a value was keyboard-reachable and renaming was not. That
        asymmetry is the defect; the repair is to stop having two answers to one
        question (trap 21), not to invent a third interaction.

        So this control MATCHES the sibling rather than inventing anything: a
        real `<button type="button">` whose `onClick` begins the rename, styled
        and named exactly as `-confirm-as-is` is, with an `aria-label` quoting
        the row the way its two siblings already do (`Confirm … is correct`,
        `Change …`). Nothing here is a new gesture — it is the gesture the file
        already used for its other two in-row actions.

        ⚠ THE DOUBLE-CLICK STAYS. It is the rename gesture this product already
        has (`ReactFlowGraph.tsx:1390-1394` binds node double-click to
        `requestNodeRename`), and removing it would take a shortcut away from
        pointer users to buy nothing. Two routes to one act is not the
        two-answers defect above — they call the same `beginRename`.

        ⚠ `!renaming` BECAUSE THE EDITOR REPLACES THE IDENTITY, and a "Rename"
        control sitting beside an open rename editor would be the second
        representation of one state that this whole surface exists to remove.

        ⚠⚠ WHAT THE SPEC PROVES AND WHAT IT DOES NOT. `renameIsKeyboardReachable
        .spec.tsx` drives this by keyboard through `user-event`, so it proves the
        control is FOCUSABLE and that Enter and Space open the editor. jsdom
        performs no layout, so it proves NOTHING about whether this control is
        visible, hit-testable or reachable in tab order at any real width. That
        is a browser question and it is not answered here.
      */}
      {renameAvailable && !renaming && (
        <button
          type="button"
          data-testid={`model-row-v2-${row.id}-rename-start`}
          title="Rename this element"
          aria-label={`Rename ${row.label}`}
          className={`${typography.buttonSmall} text-info underline decoration-dotted shrink-0 whitespace-nowrap`}
          onClick={e => {
            /* The row is `role="option"` with its own `onClick`; without this,
               starting a rename would also select the row. Same reason, same
               line, as the editor and the two sibling action buttons. */
            e.stopPropagation()
            beginRename()
          }}
        >
          Rename
        </button>
      )}

      </span>
      {/* ── CELL 3 · VALUE — the column this whole change exists to create.

          ⚠⚠ THE TRACK IS `fit-content(5.5rem)` (declared once, in
          `ModelOutline.tsx`), AND FOR THESE ARMS THAT STILL MEANS THIS CELL
          SIZES TO ITS CONTENT AND TAKES THAT WIDTH OUT OF THE IDENTITY TRACK.
          ⚠ The sentence here read "THE TRACK IS `auto`" until the cap landed on
          6 Sep 2026; the cap changed the spelling and NOT this hazard, so the
          correction is a rename, not a reprieve. `fit-content(L)` keeps the
          automatic minimum, and every arm below leaves `min-width: auto`, so
          the 5.5rem limit does not bound them — an unbounded receipt sizes to
          its content exactly as it did under bare `auto`. ⚠ THEY REACH THAT
          BY TWO ROUTES, AND THIS SENTENCE CLAIMED ONLY ONE UNTIL 6 Sep 2026:
          it read "(they are `shrink-0`, which sets no minimum)". The two idle
          arms and `case 'editing'` ARE `shrink-0`. `case 'applied'`,
          `'inflight'` and `'refused'` are NOT and never have been — they carry
          `className={typography.panelTabular}` and nothing else, so they leave
          `min-width: auto` by carrying no width class at all. Same conclusion,
          different mechanism, and the difference matters: an arm holding its
          minimum by `shrink-0` says so, and an arm holding it by omission is
          one `min-w-0` away from losing it silently.

          That is correct for every arm a producer can currently reach —
          `idle` and `proposed`, whose content is bounded — and it is a
          LOADED GUN for the arms that are dark today.

          Named by an independent seat and traced by PRODUCER rather than by
          field name: the sole live writer of `commit` is the single
          `commit={commitByRowId?.get(row.id)}` in `ModelOutline.tsx` — grep
          `commit=` there and it is the only hit — fed by `ModelTabV2Panel`'s
          `ActiveEdit`, typed `'editing' | 'proposed'`. So `inflight`,
          `applied`, `refused` and the `editing` fallback are unreachable — by
          accident of the host, not by design. `types.ts:108` already specifies
          `applied` as receipt-driven, so the wiring is PLANNED, not
          hypothetical.

          ⚠ THIS SENTENCE CITED `ModelOutline.tsx:385` UNTIL 6 Sep 2026, AND
          THAT NUMBER WAS ALREADY WRONG BEFORE THIS PR TOUCHED ANYTHING. The
          prop sat at `:457` at this branch's merge base and at staging
          `acd3db4d`; this PR's own additions then moved it to `:581`. Which
          commit the number was true at has NOT been traced — only that it was
          not true at either base, so it had been rotting for some while under
          review. The symbol is the handle; the number was a mirror with no
          owner. `types.ts:108` above is the same shape and is left as a number
          only because it was verified correct at this tip — it will rot the
          same way on the next insert into `types.ts`.

          ⚠ AND THE HAZARD IS LARGER AFTER THIS CHANGE, NOT SMALLER. Before the
          grid, a row's deficit was distributed across every atom by flex. Now
          the identity track is the only flexible one, so **100% of any width an
          `auto` cell takes comes out of the label**. An unbounded `applied`
          receipt would eat the name it sits beside.

          NO CLASSES ARE ADDED TO THOSE BRANCHES HERE, deliberately: this file's
          own rule is that classes go only where a witness can reach, and a
          shrink contract on a branch with no producer is untestable decoration
          that reads as coverage. **The hazard is recorded instead, at the site
          the next author will open**, which is the thing a row in a register
          cannot do. Whoever wires those arms: bound the content, and add the
          contract in the same change. */}
      <ValueCell
        row={row}
        commit={commit}
        editorAvailable={editorAvailable}
        onBeginEdit={onBeginEdit}
        onDraftChange={onDraftChange}
        onProposeEdit={onProposeEdit}
        onDiscardEdit={onDiscardEdit}
        onConfirmEdit={onConfirmEdit}
      />

      {/*
        showWhenAbsent={false} is deliberate: when nothing states a provenance the
        row shows NOTHING, rather than a "Not set" chip asserting a fact about a
        value that may be perfectly well set. Absence is rendered as absence.
      */}
      {/* ── CELL 4 · META ─────────────────────────────────────────────────
          Everything that is neither identity nor value: provenance, the
          confirm affordance, attention markers, the deferred note and the
          Advanced id. One cell so the whole run right-aligns as a block and
          the value column above it stays a true column. `justify-end` is what
          makes the alignment visible: without it the run starts at the cell's
          left edge and the column is technically correct but reads ragged. */}
      <span className="flex items-center justify-end gap-1.5 min-w-0">
      {row.provenanceSource !== undefined && (
        /* ⚠ THE LAST THING TO GIVE, AND IT DOES HAVE TO GIVE. On a 390px panel
           the worst row wants 400px — glyph 11 + label 96 + value 153 +
           provenance 76 + two 12px chips + 40px of gaps — so something must
           yield or the row overflows the dock, which is what happened when this
           was `shrink-0`. Priority, from most protected to least: the node's
           NAME (floored at 6rem), the primary VALUE (never shrinks), the
           estimate HINT, then this pill. A provenance label truncating is
           recoverable; an atom squeezed below the width at which it renders
           any characters at all is not.

           ⚠⚠ AND THIS CHANGE DOES EXACTLY THAT TO THIS PILL, WHICH THE SENTENCE
           ABOVE CALLS UNACCEPTABLE. Measured by an independent seat in real
           Chromium at 280px: **the provenance pill is 3px at HEAD.** At
           merge-base it was 62px and, while it overflowed, it was REACHABLE by
           scrolling the 88px escape. At HEAD it is clipped and unreachable at
           any scroll position — because scrolling reveals atoms that OVERFLOW,
           never atoms that were SHRUNK to nothing. Those are different fates and
           the earlier "escape 0" measurement does not cover this one.

           The trade is kept, deliberately: a row that stays inside the dock with
           an unreadable pill beats a row that leaves the dock, and the datum is
           recoverable ON THIS ROW.

           ⚠⚠ THAT CITATION WAS WRONG ONCE AND THE CORRECTION IS THE POINT. It
           read "the pill's content is on the node itself". **False, measured:**
           this pill renders `row.provenanceSource` = the node's
           `observed_state.source` (`adapters.ts:461`), classified over twelve
           literals (`valueProvenance.ts:145-172`); the canvas node renders
           `NodeProvenanceMark` over `data.provenance`, which recognises exactly
           three (`valueProvenance.ts:311-318`). **Disjoint fields, disjoint
           vocabularies** — an absence sweep of `src/canvas/nodes/` returns ZERO
           for `observed_state.source` and `classifyValueProvenance` while the
           contrast controls (`observedState?.value` ×10, `classifyNodeProvenance`
           imported and called) fire. So the node does NOT carry this datum.

           The real carrier is `ModelDetailRegion.tsx:377`, which renders the
           provenance content for `row.provenanceSource` when the row is
           expanded — the SAME row, one interaction away, no canvas trip. The
           conclusion is unchanged and the reason for it is now true.

           ⭐ Note what the false version did: it discharged the "sole carrier"
           half of the bound by pointing at a surface that renders a DIFFERENT
           field under a similar name. Two provenance concepts, one word, and
           the citation was never checked because it sounded right — this
           estate's signature defect, committed inside the comment written to
           bound a principle. **But the principle above forbids what
           was just done, so it is now bounded rather than left standing as a
           rule this file breaks:** the unacceptable case is an atom squeezed to
           nothing AND carrying information available nowhere else. This pill
           fails only the first half. If a future change gives the pill sole
           carriage of anything, this trade must be reopened.

           ⭐ Two rounds closed every other false sentence here and left both of
           these, because a correcting sentence reads as already-audited. The
           correction is the least-checked prose in any diff.

           ⚠ CORRECTED, AND THE CORRECTION IS THE POINT. This comment used to
           end "a row falling out of the panel is not [recoverable]". MEASURED
           on the deployed panel at `5dc287e8`, that justification is FALSE:
           the dock body is `overflow-x: auto` (clientWidth 278 / scrollWidth
           314), so an over-wide row SCROLLS — escape count 0. Nothing falls
           out of anything. The ladder is still right, but it is ordered by
           LEGIBILITY under compression, not by a containment failure that does
           not occur. Rewritten rather than deleted because the wrong reason
           was load-bearing in four places and would have been re-derived.

           ⚠⚠ EVERYTHING ABOVE THIS LINE IS ABOUT A WORDED PILL, AND THIS SPAN
           NO LONGER HOLDS ONE. The wrapper is unchanged and only the CHILD was
           swapped — `SourceProvenancePill` became the 14px `ValueProvenanceMark`
           — so the sentences above quietly stopped being true of what renders
           here. They are kept, not rewritten: the 3px reading and the 62px
           merge-base reading are DATED CAPTURES of the pill, and a measurement
           is a record of what was observed, not a field to keep current.

           What changed, and it lands on the wrong side of this file's own rule:
           a truncated text span reports as a signalled ellipsis, which the
           doctrine above calls "a disclosed loss, not a silent one" — but a
           CLIPPED GLYPH EMITS NO ELLIPSIS AND SIMPLY VANISHES. By this file's
           own standard that is a SILENT loss, the thing it refuses everywhere
           else. The sentence "an atom squeezed below the width at which it
           renders any characters at all is not [recoverable]" therefore now
           describes the ordinary case rather than the forbidden one, because a
           glyph renders no characters at ANY width.

           ⚠ NOT CHANGED HERE, DELIBERATELY, and this is the judgement rather
           than an oversight. Swapping to `shrink-0` would be an unmeasured
           layout change to a row already under review, and would move the
           deficit onto an atom that has not been priced for it. Rowed instead:
           re-price the yield ladder now that its last item is INDIVISIBLE.

           ⚠⚠ THE TWO SENTENCES THAT USED TO CARRY THIS DEFERRAL ARE WITHDRAWN,
           AND THE WITHDRAWAL IS WHY THE ROW MATTERS MORE, NOT LESS. They read
           "marks relieve roughly 62px of row pressure, so it is unlikely to
           clip in practice" and "NOBODY HAS MEASURED IT CLIPPING, in either
           direction". **Both are refuted**, measured on deployed staging
           `18b79ae4` in a guest session at real panel width (7 Sep 2026, an
           independent lane — NOT reproduced by this author, and recorded here
           as that lane's reading):

             · Clipping HAS now been measured, and it is not marginal: the
               provenance sub-line renders a 31px box for content needing 125px
               — three readable characters of "Olumi: Moderate (0.5)" — and
               **24 of 44 value cells** in the tab are clipped.
             · ⛔ The 62px RELIEF FIGURE DOES NOT TRANSFER. A counterfactual
               forcing the badge element to 14px left the sub-line at 31px and
               the value block at 80px — **no change at all.** So the 80px value
               column is pinned by something OTHER than this pill, and swapping
               pill→glyph does not recover the width.

           The 62px and 3px readings are kept above as DATED CAPTURES of the
           pill; what is withdrawn is the INFERENCE drawn from them, which is a
           different thing from the measurement. **Consequence for this file:
           the swap below must not be read as a width or truncation fix — it is
           a legibility and density change (glyph + legend, the candidate the
           product owner chose), and the geometry question is OPEN with its
           cause unidentified.** That is the row, and it is now actionable:
           whoever takes it should start from what the counterfactual excludes.

           ⚠ This disclosure was written by the change that introduced the mark
           and was DROPPED when that change was re-applied onto a moved base —
           the one thing the re-application lost. Restored here, because the
           deferral is defensible and its silence was not. */
        <span data-testid={`model-row-v2-${row.id}-provenance`} className="min-w-0 truncate">
          <ValueProvenanceMark source={row.provenanceSource} rowId={row.id} />
        </span>
      )}

      {/*
        ⚠ `-confirm-as-is`, NOT `-confirm`. The three-beat's chip already owns
        `model-row-v2-<id>-confirm`, and the first cut of this affordance reused
        it — two DIFFERENT gestures answering to one identity, which broke five
        existing pins that assert the value-edit chip is absent while typing.
        The collision was the guard doing its job: an assertion that binds by
        identity is only as good as the identity being unique (trap 19), and a
        shared testid is the same "two things, one name" defect this whole lane
        is removing, at the scale of an attribute.
      */}
      {canConfirmAsIs && (
        <button
          type="button"
          data-testid={`model-row-v2-${row.id}-confirm-as-is`}
          title="Confirm this value is correct"
          aria-label={`Confirm ${row.label} is correct`}
          className={`${typography.buttonSmall} text-info underline decoration-dotted shrink-0 whitespace-nowrap`}
          onClick={e => {
            e.stopPropagation()
            onConfirmValueAsIs?.(row.id)
          }}
        >
          Confirm
        </button>
      )}

      {/*
        ⭐ ONE MARK PER REASON, AND EACH SAYS WHICH.
        Witnessed on deployed `a9c2e050`: this was `⚠` for all five reasons, in
        one colour, mapped over an unbounded array — so a contested-AND-fragile
        relationship drew two identical marks and the row said "something is
        wrong here, twice" without saying what either time. The five sentences
        existed the whole time, in `title` only.

        Three things changed, and each answers a separate rule:
          · SHAPE carries the meaning (`ATTENTION_MARK`), so the row is legible
            without a legend.
            ⚠ THE REASON GIVEN HERE WAS STALE AND IS WITHDRAWN (10 Sep 2026). It
            read "which matters because the estate's one legend component sits
            inside the unmounted legacy block". `ValueProvenanceKey` is MOUNTED,
            at `ModelTabV2Panel.tsx:1091`, beside the tier control. The property
            above still holds on its own merits — a row should not need a legend —
            but it is not propped up by the legend being dark, and the legend's
            own trailing line was describing a `⚠` these marks stopped drawing.
          · COLOUR carries SEVERITY, not category: `fragile` is the only reason
            that says the ANSWER could change, so it alone keeps `text-warning`
            and the rest are `text-text-light`. That is DS §1's three-channel
            rule and the design pack's "filled = act on it, outline = noted".
          · The icon is a component, never a unicode character — DS §9.9 names
            `'⚠'` explicitly, and the `emoji-icon` guard could not see a bare
            JSX text node, so the rule was real and unenforced here.
      */}
      {row.attention.map(reason => {
        const Mark = ATTENTION_MARK[reason]
        return (
          <span
            key={reason}
            data-testid={`model-row-v2-${row.id}-attention-${reason}`}
            title={ATTENTION_LABEL[reason]}
            aria-label={ATTENTION_LABEL[reason]}
            role="img"
            className={`shrink-0 ${
              ATTENTION_IS_SEVERE.has(reason) ? 'text-warning' : 'text-text-light'
            }`}
          >
            <Mark className="w-3.5 h-3.5" aria-hidden="true" />
          </span>
        )
      })}

      {/*
        The deferred marker (design §4.2, §5.3). ⚠ It is rendered AFTER the
        attention markers and does not suppress them: deferring records that a
        human ruled the gap can wait, it does not make the gap stop existing. A
        row that fell silent about its gap once deferred would be the dismiss
        button growing back. The label carries the provenance, because an
        anonymous deferral cannot be told apart from a dropped row.
      */}
      {row.deferred !== undefined && (
        <span
          data-testid={`model-row-v2-${row.id}-deferred`}
          title={deferralLabel(row.deferred)}
          aria-label={deferralLabel(row.deferred)}
          className={`${typography.panelBody} text-text-light`}
        >
          Left unresolved
        </span>
      )}

      {/* ⚠⚠ LAST IN THE YIELD LADDER, AND IT HAD TO BE GIVEN ONE.

          ⚠ THE 85px FIGURE THAT USED TO STAND HERE IS WITHDRAWN. It read
          "independent review measured this span escaping the row by 85px at
          the 280px dock floor — WORSE than before the fix". That number came
          from a REVIEWER'S FIXTURE, was inherited by me without reproduction,
          and my own run against the real deployed panel then contradicted it:
          the dock body scrolls, so escape is 0. Recording a scoped figure as
          an unscoped fact is CLAUDE.md trap 20, and stating it as "review
          measured" gave it an authority the measurement never had.

          The REAL reason this atom is last is unchanged and does not need the
          figure: `row.id` is `node.id`, a single unbreakable
          `font-mono` token like `fac_platform_migration`, so without
          `overflow:hidden` its automatic minimum is the whole token and it can
          neither shrink nor wrap.

          The ladder, most protected to least: the node's NAME (floored at
          6rem) → the primary VALUE (never shrinks) → the estimate HINT → the
          provenance pill → THIS. An Advanced-tier debug token is the right
          thing to lose: the DOM text stays whole, so selection and copy still
          yield the full id, and `title` names it — a recoverable loss, which is
          this file's own stated rule.

          ⚠ "SIGNALLED" WAS STRUCK FROM THAT SENTENCE, and the block below says
          why: at the 280px floor no ellipsis renders, so nothing signals it.
          The word is corrected HERE rather than only two paragraphs down,
          because a reader who stops at this sentence must not carry away the
          claim the next block withdraws.

          ⚠ AND `title` IS THE ONE ROUTE A KEYBOARD OR TOUCH USER CANNOT TAKE:
          it sits on a `<span>` with no `tabIndex` (0 in this file; contrast: 8
          `aria-label`), so it is mouse-hover only. The recovery that survives
          every input mode is the whole `{row.id}` in the DOM — assistive tech
          and copy reach it. Listing `title` first was misleading about which
          route is load-bearing.

          ⚠⚠ THE "DISCLOSED LOSS" CLAIM WAS FALSE AT THE ONE WIDTH IT MATTERS,
          AND THE WAY IT WAS FALSE IS WORSE THAN BEING WRONG EVERYWHERE. It read
          "at 280 in Advanced this span reports as a signalled ellipsis... a
          disclosed loss, not a silent one". An independent seat MEASURED it in
          real Chromium with the repo's own Tailwind build: **at the 280px floor
          the id span is 6px against a 7.2px ellipsis glyph, so NO ELLIPSIS
          RENDERS.** The loss is silent — the comment named the single property
          it does not have. Its positive control fires (the label is also
          `truncate`, also clipped, and floored at 96px, where the ellipsis DOES
          render), so the probe can return both answers.

          ⭐ AND THE BOUND IS THE LESSON, not the number. The old sentence is TRUE
          at 390 / 416 / 480 and false only at 280. **A claim that holds at every
          width a reader is likely to spot-check, and fails only at the floor,
          validates itself against every casual check** — which is exactly how it
          survived two review rounds that closed everything else. When you price
          a loss, state the WIDTH you priced it at.

          So, stated honestly: below roughly 390px the id is clipped with NO
          visible ellipsis and the loss is SILENT, recoverable only via `title`,
          selection/copy, or widening the dock. That is a worse trade than this
          comment used to claim, and it is still the right atom to sacrifice —
          an Advanced-tier debug token, last in the yield ladder. Rowed rather
          than fixed: a floor on this span buys the deficit back out of the
          provenance pill (see the D2 note above), which is a real regression
          for a cosmetic gain. */}
      {tier === 'advanced' && (
        <span
          data-testid={`model-row-v2-${row.id}-id`}
          title={row.id}
          className={`${typography.code} text-text-light min-w-0 truncate`}
        >
          {row.id}
        </span>
      )}
      </span>

      {/* ── QUICK-SET BAND LINE · THE SAME FIX, FOR THE CONTROL #1410 DID NOT REACH.
          ⭐⭐ MEASURED IN A REAL BROWSER AT `9574b5c4`, on relationship row `e-4`.
          The pills and the live band readback were BOTH inside grid track 3 —
          `fit-content(5.5rem)`, which resolves to **88px at every dock width**,
          so the value wrapper rendered 80px wide. Two defects came out of it,
          and they are different defects:

            VERTICAL   three 14px pills at 46.3 + 70.47 + 53.83px need 178.6px
                       in an 80px block, so `flex-wrap` STACKED them onto three
                       lines (`distinctTops: 3`). Row 36px -> 116px,
                       heightDelta **+80.0px at 280 AND at 416**, against the
                       factor arm's 50.5px bound.
            HORIZONTAL the input line measured 130.89px in its 88px track and
                       escaped the outline's RIGHT EDGE by **34.89px** at a
                       280px dock (line 1150->1280.89, outline right 1246). The
                       readback — 26.89px plus its 8px `ml-2`, i.e. 34.89px
                       exactly — was the WHOLE excess, and it rendered entirely
                       outside the panel (1254->1280.89). The word naming what
                       the user's number MEANS was off-screen.

          ⚠ THE HORIZONTAL HALF IS RELATIONSHIP-SPECIFIC, not a `w-24` problem
          this surface has everywhere — measured in the same run, the FACTOR
          row's editing line sits 16.89px INSIDE the same edge (1133.11->1229.11).
          Moving the readback out is what buys that slack back.

          ⚠ `col-span-4` IS LOAD-BEARING, exactly as on the action line below: a
          subgrid row only grants tracks to a DIRECT child, so this must stay a
          child of the `<li>`. `rowAtomsDoNotWrap.spec` pins the parentage.

          ⚠ THE CONTROLS ARE NOT HIDDEN, TRUNCATED OR REMOVED. Paul ruled this
          affordance "really simple, quick, and easy clickable"; all three pills
          and the readback still render, at full size, with their own testids.
          They move DOWN out of a 88px track into the row's full width — the
          input the user is typing into does not move (`textDelta` stays 0).

          ⚠ SAME THREE-CALLBACK CONDITION AS THE LIVE EDITOR ARM IN `ValueCell`
          and as the action line below. Quick-set pills for an editor that is not
          mounted would be an affordance that does nothing. One condition, three
          readers.

          ⭐⭐ AND THE HISTORY, BECAUSE THE FIRST FIX WAS RIGHT AND INSUFFICIENT —
          kept rather than deleted, since it is the reason a second pass was
          needed and a reader who does not know it will propose the first one
          again. The pills originally rendered INLINE beside the input; an
          independent reviewer measured the consequence (the cell is 80px on a
          414px dock, the only flexible track floors at 96px, and three pills
          plus the input come to roughly 330px — a spill this file had recorded
          once before at 111.1px) and they were moved to their OWN LINE, the way
          v1 solved it (`ContestedEdgeCard.tsx:433`): own line, `flex-wrap`.

          ⚠⚠ "THEIR OWN LINE" WAS NOT "OUT OF THE 88px TRACK", and that is the
          whole gap. The new line was still a child of the value cell's wrapper,
          i.e. still inside track 3, so `flex-wrap` had 80px to work with and
          stacked the three pills vertically instead of spilling horizontally.
          The spec written to pin that fix (`edgeStrengthQuickSet.spec.tsx`,
          "the pills sit OUTSIDE the value cell") was TRUE the whole time and
          structurally unable to see it — jsdom performs no layout, so "not a
          descendant of the no-wrap span" was the most it could ever assert.
          Only `col-span-4` on a DIRECT child of the row leaves the track. */}
      {row.kind === 'relationship' && commit?.phase === 'editing' && onDraftChange && onProposeEdit && onDiscardEdit && (
        <RelationshipBandLine row={row} commit={commit} onDraftChange={onDraftChange} />
      )}

      {/* ── EDITOR ACTION LINE · THE ROUTE FORWARD, ON A LINE THAT IS NOT 48px WIDE.
          ⭐⭐ MEASURED IN A REAL BROWSER, and this element's POSITION is the whole
          fix. These controls first shipped INSIDE the value cell — i.e. inside
          grid track 3. At a 280px dock that track measured **48.5px**, and the
          Canvas Browser Gate read the result:

            row 36px -> 213px, heightDelta +177px @280, +138px @416
            (`modelRowEditReflow.measure.ts`, run 34386746547)

          Attributed at the bytes with a DOM probe rather than reasoned about —
          the value cell was 48.5px wide and 200px tall, made of:
            input box        23px   <- the reserved box, correct, untouched
            Review/Discard   52px   <- "Review change" wrapped INSIDE its own button
            refusal sentence 117px  <- 36 characters of prose in a 48.5px column
          200 + 12 (py-1.5) + 1 (border) = 213. Exactly the measured row.

          ⚠⚠ SO THE DEFECT WAS NEVER THE CONTROLS — IT WAS THE COLUMN. Prose and
          bordered chips cannot live in track 3: it is `fit-content(5.5rem)` at
          its widest and it collapses further because the value wrapper carries
          `min-w-0` while the label track is `minmax(6rem,1fr)`. Anything with a
          max-content wider than ~48px becomes a paragraph there, and the row
          grows to fit it. THE GROWTH WAS WIDTH-DEPENDENT (+177 vs +138), which
          is the signature of wrapping rather than of disclosure.

          ⚠ `col-span-4` IS LOAD-BEARING AND IS THE THING A GUARD MUST HOLD. The
          row is `grid grid-cols-subgrid col-span-4`, so a child spanning all
          four tracks takes a full-width implicit SECOND grid row. Drop that
          class and this lands back in a single track — which is the defect, in
          one word. `theEditorSaysHowToGoForward.spec` pins it, and
          `rowAtomsDoNotWrap.spec` pins that these controls are NOT descendants
          of the value cell, because that containment is what the browser
          measurement was actually about.

          ⚠ THE CONTROLS ARE NOT HIDDEN AND MUST NOT BE. Making the row compact
          again by removing the visible route forward would reinstate the defect
          this PR exists to close: an editor whose only advance affordance was a
          key nothing named. They move DOWN, not away — below the first line, so
          the input the user is typing into does not move (`textDelta` stays 0).

          ⚠ SAME CONDITION AS THE LIVE EDITOR ARM IN `ValueCell`, deliberately.
          If the three callbacks are absent the cell renders a static draft with
          no editor, and an advance control for an editor that is not there
          would be an affordance that does nothing. One condition, two readers. */}
      {commit?.phase === 'editing' && onDraftChange && onProposeEdit && onDiscardEdit && (
        <EditorActionLine
          row={row}
          commit={commit}
          onProposeEdit={onProposeEdit}
          onDiscardEdit={onDiscardEdit}
        />
      )}
    </li>
  )
}

/**
 * The sentence a factor with no recorded range carries beside its editor.
 *
 * ⚠ A SINGLE STRING LITERAL, NOT MULTI-LINE JSX TEXT. JSX collapses an interior
 * newline plus indentation into one space, which is a rendering detail a test
 * would then have to encode. One literal means the DOM text is exactly these
 * bytes and an assertion can say so.
 *
 * ⚠ DELIBERATELY NOT EXPORTED. A spec that imported this would be comparing the
 * component's render against the component's own constant and would pass on any
 * wording, including wording that breaks the copy rules. The spec spells the
 * sentence out.
 *
 * ⚠ NO EM DASHES, and no promise that anything improves: two plain sentences of
 * fact about what the node records and what the wire can express.
 */
const NO_RANGE_NOTICE =
  'This factor records no range. An amount entered here has nothing to measure it against, and once applied it cannot be removed.'

/**
 * ⭐ THE `editing` BEAT'S VISIBLE ROUTE FORWARD AND ITS REFUSAL, as ONE
 * full-width grid item.
 *
 * ⚠ IT IS A SEPARATE COMPONENT ONLY SO THAT IT IS A SINGLE GRID ITEM. Grid
 * auto-placement reads the row's DIRECT children; a fragment emitting two
 * elements here would put the second one into track 4 and silently break the
 * meta cell's alignment. One element, one implicit row.
 *
 * ⚠ THE VERDICT IS STILL THE HOST'S. `unproposableDraftReason` is the SAME
 * function `ModelTabV2Panel.proposeEdit` calls, so the control's disabled state
 * and the host's refusal cannot drift; this component derives nothing of its
 * own about whether the draft may advance.
 *
 * ⚠ DERIVED PER RENDER FROM THE DRAFT, HELD IN NO STATE. `EditCommitState` has
 * no field for this and must not grow one: an error stored beside a draft can
 * outlive the characters that caused it, which is how a row ends up asserting a
 * refusal about a number the user has already fixed.
 */
function EditorActionLine({
  row,
  commit,
  onProposeEdit,
  onDiscardEdit,
}: {
  row: ModelRow
  commit: { phase: 'editing'; draft: string; unit?: string }
  onProposeEdit: (id: string) => void
  onDiscardEdit: (id: string) => void
}) {
  // ⚠ THE BOUND TRAVELS ON THE ROW, so the control and the host judge one
  // row against one prior. Passing anything else here would let the
  // affordance offer an advance the host will refuse.
  //
  // ⚠⚠ AND THIS ARGUMENT IS THE WHOLE WIRING. #1410 moved these controls out of
  // the value cell (a 48.5px grid track) into this full-width line, which meant
  // deleting the call site #1428 had originally amended. Rebasing #1428 onto it
  // WITHOUT re-attaching `row.valueAdmission` here would leave
  // `unproposableDraftReason` with a fourth parameter nothing ever passes: the
  // range guard would fail open on every render, the suite would stay green,
  // and the measured `+250` ranking reversal would be live again. The guard is
  // reachable from the UI only through this line.
  const blocked = unproposableDraftReason(row.id, commit.draft, commit.unit, row.valueAdmission)
  const blockedId = `model-row-v2-${row.id}-value-blocked`
  return (
    <span
      data-testid={`model-row-v2-${row.id}-edit-actions`}
      /* ⚠ `col-span-4` — see the call site. `min-w-0` so the sentence wraps
         against the ROW's width rather than establishing a max-content floor
         that would push the outline into horizontal scroll. */
      className="col-span-4 flex flex-col items-start gap-1 min-w-0"
      onClick={e => e.stopPropagation()}
    >
      {/* ⭐⭐⭐ THE FACT ABOUT THE FACTOR, STATED BEFORE THE USER COMMITS.
          WITNESSED END TO END ON THE SERVED BUILD, 10 Sep 2026, on a drafted
          factor that declares no prior range:

            1. this editor accepted a bare `70` with NO warning at any beat;
            2. propose then Confirm reported `Applied`, `observedState =
               {raw_value: 70, source: 'user', value: 70}`;
            3. Analyse then refused, every time and correctly: "recorded as a
               bare amount with no range for me to measure it against";
            4. no range editor is reachable anywhere in the product (all four
               `prior_range_edit` mount paths are dead, and
               `model-tab-v2/contracts.ts:143` declares `proposePriorRange` with
               zero implementations);
            5. the applied value CANNOT BE CLEARED. Emptying the input disables
               `Review change`, and there is no unset affordance because there is
               nothing for one to send: derived by EXECUTION against the vendored
               `@talchain/schemas@0.54.0`, `factor_value_edit.value` is
               `z.number().finite()` and REQUIRED inside a `.strict()` object, so
               `null`, omission, `NaN` and an extra `clear` key are all refused at
               parse. The member's own contract says it outright: "an edit with no
               value is a `direct_graph_edit` notification, not this event".

          So the model becomes permanently unanalysable through this tab's most
          prominent affordance, and the ONLY beat at which a user can still avoid
          it is this one, before they commit.

          ⛔⛔ THIS STATES A FACT. IT DOES NOT REFUSE, AND IT INVENTS NO BOUND.
          `Review change` is untouched, `disabled` still reads only the host's own
          `unproposableDraftReason`, and no range is synthesised anywhere. The
          principle is #1428's own and is binding here: "ABSENCE IS THE DEFAULT
          AND IT FAILS OPEN ... a guard that invents a bound is a worse defect."
          A refusal here would be strictly worse than the trap, because the repair
          route it would demand does not exist in the product.

          ⚠ NOT CEE'S SENTENCE, AND DELIBERATELY NOT A COPY OF IT. That refusal is
          CEE-owned, it is good, and it is untouched. This is the client saying
          what it can see about the node in front of it, at a beat CEE never
          reaches.

          ⚠ NOT A LIVE REGION, for the same reason as the refusal below: this
          element re-renders on every keystroke, and `role="status"` would
          announce a running commentary on typing. It is plain text in the
          reading order immediately above the controls it qualifies.

          ⚠ RENDERED FIRST, so it is read BEFORE the route forward rather than
          after it. It cannot move the input: this whole element already sits on
          its own full-width implicit grid row BELOW the input line, which is the
          measured property `theEditorSaysHowToGoForward.spec` pins. */}
      {row.declaresNoRange === true && (
        <span
          data-testid={`model-row-v2-${row.id}-no-range`}
          className={`${typography.panelBody} text-text-light`}
        >
          {NO_RANGE_NOTICE}
        </span>
      )}

      {/* ⭐⭐ THE ROUTE FORWARD, RENDERED. MEASURED ON DEPLOYED `9748b336`: with
          `0.4` typed into a factor row, the row's ONLY button was its own LABEL.
          No advance control, and nothing anywhere saying Enter was the way —
          visible text, `placeholder` and `title` were all checked and all absent.

          ⚠ THE EDITOR WAS NEVER BROKEN. The input's `onKeyDown` already maps
          Enter→propose and Escape→discard, and it still does: this is a VISIBLE
          route to the same two callbacks and NO second key handler. A duplicated
          Enter handler would fire the propose twice.

          ⚠ VOCABULARY: `Review change` → `Confirm`. This beat REVIEWS; the
          `proposed` beat CONFIRMS and is deliberately untouched. Nothing here
          may say "Saved": the model is unchanged until the authority
          acknowledges, and a label claiming otherwise is the silent-local-write
          defect one word at a time. */}
      <span className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          data-testid={`model-row-v2-${row.id}-review`}
          aria-label={`Review the new value for ${row.label}`}
          /* The reason is ASSOCIATED with the control, not duplicated into it: a
             screen reader reaching a disabled button is told why by the same
             sentence the sighted user is reading. */
          aria-describedby={blocked === null ? undefined : blockedId}
          disabled={blocked !== null}
          onClick={() => onProposeEdit(row.id)}
          className={`${typography.buttonSmall} border rounded px-2 py-0.5 whitespace-nowrap ${
            blocked === null
              ? 'text-info border-info/50'
              : 'text-text-light border-panel-border'
          }`}
        >
          Review change
        </button>
        <button
          type="button"
          data-testid={`model-row-v2-${row.id}-discard-edit`}
          aria-label={`Discard the new value for ${row.label}`}
          onClick={() => onDiscardEdit(row.id)}
          className={`${typography.buttonSmall} text-text-light border border-panel-border rounded px-2 py-0.5 whitespace-nowrap`}
        >
          Discard
        </button>
      </span>

      {/* ⭐⭐ AND WHY IT CANNOT GO YET — IN WORDS, ON SCREEN. `proposeEdit`
          returned `prev` unchanged on an unparseable draft: the user typed
          something invalid, pressed Enter, and the product did nothing at all. A
          refusal nobody can see is indistinguishable from a broken control.

          ⚠ VISIBLE TEXT, NOT A `title`. The estimate hint on this same row is
          the estate's own worked example of why: recoverable on POINTER HOVER is
          not recoverable for a keyboard or a touch user, and this sentence is
          needed in order to proceed at all.

          ⚠ NOT A LIVE REGION. It re-derives on every keystroke, so
          `role="status"` would announce a running commentary on typing.
          `aria-describedby` on the control puts it where it is asked for. */}
      {blocked !== null && (
        <span
          id={blockedId}
          data-testid={blockedId}
          className={`${typography.panelBody} text-text-light`}
        >
          {blocked}
        </span>
      )}
    </span>
  )
}

/**
 * The primary value, and the three-beat's visible states (design §5.1).
 *
 * ⚠ `proposed` KEEPS THE OLD VALUE ON SCREEN beside the new one, and says in
 * words that nothing has changed yet. ⚠ `refused` states the reason and shows
 * the value REVERTED. A refusal that looks like nothing happened is the same
 * defect as a silent local write, one step later.
 */
/**
 * Name the band of a DRAFT, or say nothing.
 *
 * ⚠⚠ `parseFloat`, NOT `Number` — AND THAT WAS A REAL DEFECT, not a style choice.
 * The commit path parses with `parseFloat` (`ModelTabV2Panel.tsx:495`). This
 * read-back used `Number`, so the two disagreed on real input: `0x10` read
 * "strong" here and committed `0`; `0.7abc` read "—" here and committed `0.7`.
 * A comment in this file claimed the display and the commit were "one
 * derivation"; they were two, and the claim is what made it invisible.
 *
 * ⚠ AND IT REFUSES WHAT THE EMITTER REFUSES. `buildEdgeStrengthEditEvent`
 * rejects `magnitude > 1` rather than clamping, deliberately: a clamped 1.5 → 1
 * sends a number the user never stated. `getStrengthBand` has no domain guard,
 * so banding 1.5 as "strong" promised a write that silently never happened.
 * Out of range says so instead of naming a band.
 */
function bandReadback(draft: string): string {
  const n = parseFloat(draft)
  if (!Number.isFinite(n)) return '—'
  if (Math.abs(n) > 1) return 'out of range'
  return getStrengthBand(n)
}

/**
 * ⭐⭐ WHY THIS DRAFT CANNOT BE REVIEWED YET — or `null` when it can.
 *
 * ⚠⚠ THIS IS THE HOST'S OWN GUARD, NOT A SECOND OPINION ABOUT IT.
 * `ModelTabV2Panel.proposeEdit` CALLS THIS FUNCTION. Before it existed the
 * panel's guard was inline and the row had nothing, so the whole failure was:
 * type something unparseable, press Enter, and NOTHING WHATEVER HAPPENS — no
 * error, no state change, no feedback of any kind. Measured on deployed
 * `9748b336`.
 *
 * A row that computed its OWN idea of "invalid" would be this estate's
 * signature defect wearing a helpful message: two derivations of one question
 * that agree today and diverge on the first input nobody thought of. So the
 * BLOCK/ALLOW verdict has exactly one source — the same two conditions, in the
 * same order, that the panel used inline:
 *
 *     if (unit !== undefined && !buildManualGoalTarget(...)) refuse
 *     if (!Number.isFinite(parseFloat(draft)))               refuse
 *
 * ⚠ AND THE MESSAGE IS CHOSEN **AFTER** THE VERDICT, NEVER INSTEAD OF IT.
 * `statedTargetNumber` and `unit.trim()` are consulted only once
 * `buildManualGoalTarget` has ALREADY refused, purely to say which refusal it
 * was. They cannot change whether the edit advances, so a drift between them
 * and the builder can at worst produce a vaguer sentence — never a control that
 * lets through what the host will reject, which is the failure mode that
 * matters.
 *
 * ⚠ THE GOAL ARM SUBSUMES THE `parseFloat` ARM RATHER THAN SKIPPING IT.
 * `statedTargetNumber` is an ANCHORED numeric-literal test, strictly narrower
 * than `parseFloat`, so any draft `buildManualGoalTarget` accepts is one
 * `parseFloat` also reads as finite. Returning `null` here therefore means both
 * of the host's conditions pass, not just the first.
 *
 * ⚠ NOT THE "SILENCE, NOT A DISABLED CONTROL" RULING (see this file's header).
 * That ruling is about rows with NO WRITER, where a per-row label would rebuild
 * the wall of identical inert strings the NOT SET rule removed. This is a
 * different question: there IS a writer, the user is typing into it right now,
 * and the sentence is specific to the characters they just entered. One string,
 * on one row, about one draft.
 */
export function unproposableDraftReason(
  rowId: string,
  draft: string,
  unit: string | undefined,
  admission?: ModelRow['valueAdmission'],
): string | null {
  if (unit !== undefined) {
    if (buildManualGoalTarget(rowId, draft, unit) !== null) return null
    const stated = statedTargetNumber(draft)
    if (stated === null) return 'Enter a number to review this change'
    if (stated <= 0) return 'Enter a target above zero to review this change'
    if (unit.trim() === '') return 'Add a unit — £, % or points — to review this change'
    // The builder refused for a reason this function cannot name. Say that,
    // rather than inventing a cause — an invented cause is worse than a vague
    // one, because the user acts on it.
    return 'This target cannot be reviewed yet'
  }
  if (!Number.isFinite(parseFloat(draft))) return 'Enter a number to review this change'
  /*
   * ⭐⭐ AND THE FACTOR'S OWN DECLARED RANGE, LAST — after the parse, never
   * instead of it. Measured on staging `67b04e5b` (10 Sep 2026): every factor
   * in a drafted model carries `prior: {range_min: 0, range_max: 1}`, and
   * typing `40` into a cap-10 factor was accepted at input, review AND confirm,
   * storing `value: 4`. The analysis then RAN on it — the in-range twin (`10` →
   * `value: 1`, exactly `range_max`) and the out-of-range run returned
   * DIFFERENT results, so nothing downstream was bounding it, and `+250`
   * reversed the ranking outright.
   *
   * ⚠ THE ORDER IS LOAD-BEARING. `abc` must keep saying "Enter a number";
   * a range guard that answered first would replace an accurate refusal with a
   * vaguer one and give the user a bound to satisfy when their problem is that
   * they typed no number at all.
   *
   * ⚠ IT REFUSES; IT DOES NOT CLAMP. A silently corrected value is the same
   * class of defect as a silently corrupted one — the user must know. This is
   * the same shape as `bandReadback`'s "out of range" and as
   * `buildEdgeStrengthEditEvent` refusing `magnitude > 1` rather than clamping.
   *
   * ⚠ ONE DERIVATION, SAME AS THE ARMS ABOVE. The verdict, the scale transform
   * and the sentence all live in `factorValueAdmissionRefusal`; this function
   * chooses WHEN to ask, never what the answer is. A row that computed its own
   * idea of "out of range" would be the twin-derivation defect this whole
   * function exists to prevent.
   */
  return factorValueAdmissionRefusal(admission, draft)
}

/**
 * ⭐⭐ THE RELATIONSHIP EDITOR'S QUICK-SET LINE — readback + pills, as ONE
 * full-width grid item.
 *
 * ⚠ IT IS A SEPARATE COMPONENT FOR THE SAME REASON `EditorActionLine` IS: grid
 * auto-placement reads the row's DIRECT children, so one element is one implicit
 * row. A fragment emitting the readback and the pills separately would drop the
 * second into track 4 and break the meta cell's alignment.
 *
 * ⚠ THE SELECT-AFTER-COMMIT MACHINERY MOVED WITH THE PILLS, because it only ever
 * served them. It used to sit in `ValueCell` with a `fieldRef` on the input; the
 * input now lives in a SIBLING component, so the field is reached the way this
 * code already reached it for the immediate focus — by its testid. That was
 * already the established pattern here and its justification (no conditional
 * hooks; exactly one row edits at a time, `commitByRowId` is a one-entry map) is
 * unchanged. Nothing else read `fieldRef`, so it is gone rather than orphaned.
 *
 * ⚠ DOM ORDER IS PRESERVED: readback before pills, as it was when the readback
 * sat beside the input and the pills below. That order is what a screen reader
 * follows, and there was no reason to reverse it while moving the line.
 */
function RelationshipBandLine({
  row,
  commit,
  onDraftChange,
}: {
  row: ModelRow
  commit: { phase: 'editing'; draft: string; unit?: string }
  onDraftChange: (id: string, draft: string, unit?: string) => void
}) {
  const testid = `model-row-v2-${row.id}-value`

  /*
   * ⚠⚠ THE SELECTION MUST BE APPLIED AFTER REACT COMMITS THE NEW VALUE, NOT
   * BEFORE — found by an independent review of this PR's first cut, and the
   * author's own test could not see it.
   *
   * The pill calls `onDraftChange`, which SCHEDULES a parent state update. A
   * `select()` in the same handler therefore selects the OLD displayed value,
   * and React then sets the controlled input to the new one, collapsing the
   * selection to its end: `0.5` -> Strong gives focus on the field and
   * `selectionStart === selectionEnd === 3` instead of `0..3`. A user typing
   * the exact replacement APPENDS to "0.7" rather than replacing it — the
   * precise opposite of what this control promises the advanced user.
   *
   * ⭐ AND WHY THE FIRST TEST WAS GREEN: it mocked `onDraftChange` with a spy,
   * so `commit.draft` never changed and the input never re-rendered. The
   * assertion was about the OLD value all along. A stateless host cannot
   * observe a defect that only exists after the state lands.
   *
   * The ref flag is what keeps this from selecting on every keystroke: typing
   * changes `draft` too, and a select-all after each character would be
   * unusable. Only a pill sets it.
   */
  const selectAfterCommit = useRef(false)
  useEffect(() => {
    if (!selectAfterCommit.current) return
    selectAfterCommit.current = false
    const field = document.querySelector<HTMLInputElement>(`[data-testid="${testid}-input"]`)
    if (!field) return
    field.focus()
    field.select()
  }, [commit.draft, testid])

  return (
    <span
      data-testid={`model-row-v2-${row.id}-band-line`}
      /* ⚠ `col-span-4` — see the call site. `flex-wrap` is kept as a FLOOR, not
         as the layout: at the 280px dock the three pills and the readback
         measure well inside the row's width, and the browser gate asserts they
         sit on ONE line. It is here so a future longer band vocabulary wraps
         rather than escaping the panel. */
      className="col-span-4 flex flex-wrap items-center gap-2 min-w-0"
      onClick={e => e.stopPropagation()}
    >
      {/* ⭐ THE NUMBER STOPS BEING ABSTRACT. Paul's concern, 8 Sep: the
          raw magnitude "would not make sense" to an expert. Measured on
          deployed `15edd2e2`: the editor was a bare field seeded `0.5`
          with no scale, no band and no units anywhere near it. This names
          the band the CURRENT DRAFT falls in, live, so the exact field and
          the phrase the row displays can never silently disagree — they
          are one derivation (`getStrengthBand`), not two that happen to
          agree today.

          ⚠ It reads the DRAFT, not the row's stored value: during an edit
          those differ, and labelling the stored value beside a changed
          number is the "claim attached to a different number" defect.

          ⚠ RELOCATED, NOT REWRITTEN. This sat beside the input with `ml-2`
          until the measurement below showed it was the whole 34.89px by which
          the editing line escaped the panel at a 280px dock. The `ml-2` is
          gone because the line's own `gap-2` is the same 8px; every word above
          is the original justification and still holds. */}
      <span
        data-testid={`${testid}-band-readback`}
        className={`${typography.panelMeta} text-text-light whitespace-nowrap`}
      >
        {bandReadback(commit.draft)}
      </span>
      {/* ⭐ QUICK-SET BANDS — RELATIONSHIPS ONLY, AND PROMOTED, NOT INVENTED.
          Paul, 8 Sep 2026: "a really simple, quick, and easy clickable
          solution AND a more detailed, exact number for advanced users."
          Both halves already existed on `ContestedEdgeCard` (:239 quick-set
          pills over STRENGTH_BAND_MIDPOINTS, plus a `customSignedMean`
          field); the v2 relationship rows had NEITHER, so a user could only
          reach the abstract number. This promotes the existing control
          rather than authoring a second one — a duplicate affordance for one
          question is this estate's signature defect.

          ⚠ SIGN IS PRESERVED, NOT SET. These pills choose a MAGNITUDE band
          and re-apply whatever sign the draft already carries. Direction is
          deliberately NOT a control here: `getDirectionalStrengthLabel` takes
          direction as a REQUIRED argument precisely because inferring it from
          a number's sign once rendered every direction-less edge as "Strong
          positive effect" (ROADMAP 2.263). Adding a direction toggle changes
          what the emitter is told the user STATED, so it is a separate,
          separately-reviewed change.

          ⚠ THE MAGNITUDES ARE IMPORTED, NEVER RETYPED. A second copy of the
          band midpoints would be a hand-maintained mirror of thresholds that
          `strengthBands.ts` owns and that the whole product bands against. */}
      <span className="flex flex-wrap items-center gap-1" data-testid={`${testid}-bands`}>
        {(['weak', 'moderate', 'strong'] as const).map(band => {
          const negative = commit.draft.trim().startsWith('-')
          const magnitude = STRENGTH_BAND_MIDPOINTS[band]
          const next = `${negative ? '-' : ''}${magnitude}`
          const parsed = parseFloat(commit.draft)
          const active =
            Number.isFinite(parsed) && Math.abs(parsed) <= 1 && getStrengthBand(parsed) === band
          return (
            <button
              key={band}
              type="button"
              data-testid={`${testid}-band-${band}`}
              aria-pressed={active}
              title={`Set to ${band} (${next})`}
              onClick={e => {
                e.stopPropagation()
                /*
                 * ⚠ THE NO-CHANGE ARM IS NOT AN EDGE CASE — the
                 * reviewer measured it PASSING and it is the reason
                 * the flag alone is not enough. Pressing the band the
                 * draft is ALREADY in produces no state change, so
                 * the effect never runs and an armed flag would sit
                 * there and fire on the NEXT keystroke, selecting the
                 * user's half-typed number out from under them.
                 * Handle it here, synchronously, and arm nothing.
                 */
                const field = document.querySelector<HTMLInputElement>(
                  `[data-testid="${testid}-input"]`,
                )
                if (next === commit.draft) {
                  field?.focus()
                  field?.select()
                } else {
                  selectAfterCommit.current = true
                }
                onDraftChange(row.id, next)
                /*
                 * ⭐ AND HAND FOCUS BACK TO THE FIELD — WITNESSED ON
                 * DEPLOYED `0a0a8113`, NOT REASONED ABOUT.
                 *
                 * A real mouse click on a <button> focuses it. So the
                 * pill set the draft correctly and then SWALLOWED THE
                 * KEYBOARD: `Enter` — the obvious next keystroke, and
                 * the only thing that proposes an edit — re-pressed
                 * the pill instead of committing. Measured twice on
                 * two rows: after the click `document.activeElement`
                 * was the pill, the draft was right, and `Enter` left
                 * the editor open with nothing proposed. The user has
                 * to click back into the field to get anywhere.
                 *
                 * That defeats the whole point of the control. Paul
                 * ruled this affordance "really simple, quick, and
                 * easy clickable"; a quick click that then requires a
                 * second click to mean anything is not that.
                 *
                 * ⚠ A PROGRAMMATIC `.click()` CANNOT SEE THIS —
                 * `HTMLElement.click()` does not move focus, so in
                 * jsdom (and in any probe that uses it) the input
                 * keeps focus and `Enter` commits happily. The defect
                 * is only reachable through a real pointer, which is
                 * why it shipped.
                 *
                 * ⚠ NOT `onProposeEdit` INSTEAD. Proposing straight
                 * from the pill would delete the review step and the
                 * exact number with it — the two halves Paul asked to
                 * be combined. The field keeps the number visible and
                 * editable; this only makes the keyboard reach it.
                 *
                 * Queried rather than held in a ref: this component
                 * returns early inside a switch, so a hook here would
                 * be a conditional hook. The testid is derived from
                 * `row.id`, and only one row edits at a time
                 * (`commitByRowId` is a one-entry map), so it names
                 * exactly one element.
                 */
                /*
                 * Focus goes back NOW so the keyboard is never
                 * stranded on the pill even for one frame; the effect
                 * above re-applies focus with the selection once the
                 * new value has landed.
                 */
                field?.focus()
              }}
              className={`${typography.buttonSmall} px-1.5 rounded border ${
                active
                  ? 'border-info text-info'
                  : 'border-panel-border text-text-light'
              }`}
            >
              {band.charAt(0).toUpperCase() + band.slice(1)}
            </button>
          )
        })}
      </span>
    </span>
  )
}

function ValueCell({
  row,
  commit,
  editorAvailable,
  onBeginEdit,
  onDraftChange,
  onProposeEdit,
  onDiscardEdit,
  onConfirmEdit,
}: {
  row: ModelRow
  commit?: EditCommitState
  editorAvailable: boolean
  onBeginEdit?: (id: string) => void
  onDraftChange?: (id: string, draft: string, unit?: string) => void
  onProposeEdit?: (id: string) => void
  onDiscardEdit?: (id: string) => void
  onConfirmEdit?: (id: string) => void
}) {
  const testid = `model-row-v2-${row.id}-value`

  /*
   * ⚠ THIS CELL NOW HOLDS NO HOOKS, AND THAT IS A CHANGE WORTH NAMING. It used
   * to carry a `fieldRef` and a select-after-commit effect, both of which existed
   * ONLY for the relationship quick-set pills. The pills moved to
   * `RelationshipBandLine` (a full-width grid item — the 88px track was stacking
   * them three deep), and the machinery moved with them rather than being left
   * here reaching across a component boundary. The effect's full reasoning lives
   * at its new site; nothing else ever read `fieldRef`, so it is gone rather than
   * orphaned.
   *
   * ⚠ IF A HOOK IS EVER ADDED BACK, IT SITS ABOVE THE EARLY RETURN. `ValueCell`
   * returns inside a `switch` below, so anything declared after that point would
   * be a conditional hook.
   */
  if (commit && commit.phase !== 'idle') {
    switch (commit.phase) {
      case 'editing':
        // Live host: a real input. The draft is the HOST's state — this cell
        // renders it and reports keystrokes; it decides nothing.
        if (onDraftChange && onProposeEdit && onDiscardEdit) {
          return (
            <span className="inline-flex flex-col items-start gap-1 min-w-0">
            <span
              data-testid={testid}
              className={`${typography.panelTabular} ${EDIT_RESERVED_HEIGHT_CLASS} inline-flex items-center shrink-0 whitespace-nowrap`}
            >
              <input
                data-testid={`${testid}-input`}
                // Focus follows the click that opened this input — it replaces
                // the value control the user just activated.
                autoFocus
                inputMode="decimal"
                value={commit.draft}
                aria-label={`New value for ${row.label}`}
                onClick={e => e.stopPropagation()}
                onChange={e => onDraftChange(row.id, e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    onProposeEdit(row.id)
                  }
                  if (e.key === 'Escape') {
                    e.preventDefault()
                    onDiscardEdit(row.id)
                  }
                }}
                className={`${typography.tabular} w-24 bg-panel-hover border border-panel-border rounded px-1`}
              />
            </span>
              {row.kind === 'goal' && (
                <span className={`${typography.panelMeta} text-text-light`}>
                  {/* Two fields need a second line, not paragraphs wrapped in
                      the narrow value column. The review phase states the
                      minimum/absolute-level meaning before Confirm can send. */}
                  <label className="flex flex-col gap-0.5">
                    Unit
                    <input
                      aria-label={`Target unit for ${row.label}`}
                      value={commit.unit ?? ''}
                      placeholder="£, %, points"
                      onClick={e => e.stopPropagation()}
                      onChange={e => onDraftChange(row.id, commit.draft, e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') { e.preventDefault(); onProposeEdit(row.id) }
                        if (e.key === 'Escape') { e.preventDefault(); onDiscardEdit(row.id) }
                      }}
                      className={`${typography.tabular} w-24 bg-panel-hover border border-panel-border rounded px-1`}
                    />
                  </label>
                </span>
              )}

            </span>
          )
        }
        return (
          <span data-testid={testid} className={typography.panelTabular}>
            {commit.draft}
          </span>
        )
      case 'proposed':
        /* ⚠⚠ THE WIDEST CELL IN THIS COMPONENT, AND THE ONE LIVE PATH THE
           FIRST PASS MISSED. It carries `from → to`, a caption, and two
           bordered chips in a 280px dock; measured, it began escaping the row
           by 5px once the label stopped absorbing. Wrapping is allowed HERE
           and nowhere else in the row, because there is no single atom that
           can afford to go: the arrow pair must stay whole (a value broken
           from its arrow is the defect this PR exists to fix), and a truncated
           Confirm is a fake affordance. So the cell is permitted a second line
           rather than compressing atoms that cannot afford it. (It does not
           "push the row out of the panel" — the dock body scrolls; see the
           withdrawal at the Advanced id above.)

           ⚠ The row is therefore TALLER in `proposed`. That is deliberate and
           transient — one row at a time can hold a commit state
           (`commitByRowId` is a one-entry map) — and it is why the uniform
           34px claim this PR makes is scoped to the IDLE row. Do not "fix"
           this back to nowrap. */
        return (
          <span
            data-testid={testid}
            className={`${typography.panelTabular} min-w-0 flex flex-wrap items-baseline`}
          >
            <span className={row.kind === 'goal' ? 'min-w-0 break-words' : 'shrink-0 whitespace-nowrap'}>
              <span data-testid={`${testid}-from`}>{commit.from}</span>
              {' → '}
              <span data-testid={`${testid}-to`}>{commit.to}</span>
            </span>
            {/* ⚠⚠ THE CAPTION IS ABOUT THE STORE, AND IT WAS WORDED AS IF IT
                WERE ABOUT THE USER'S EDIT — a contradiction inside one cell.
                "Nothing has changed yet" is TRUE of the canonical state (this
                beat proposes; `Confirm` is what writes, and
                `ModelTabV2Panel.spec.tsx` pins that the store is untouched and
                nothing is sent). But it renders two atoms to the right of
                `Not set → 45`, so the reader takes it as a denial of the value
                they just typed.

                Witnessed on the deployed build `b14cd478` (guest, 291px dock,
                live-drafted model, completed run): the cell read
                "Not set → 45 · Nothing has changed yet · Confirm · Discard".

                "Not applied yet" says the same thing about the same subject and
                cannot be read as contradicting the diff beside it. The
                vocabulary is the estate's own — `HowComputedModal` renders
                `applied ? 'Applied' : 'Not applied'` for this exact
                distinction. */}
            <span role={commit.notice ? 'alert' : undefined} className={`${typography.panelBody} text-text-light ml-2 min-w-0 ${commit.notice ? '' : 'truncate'}`}>
              {commit.notice ?? 'Not applied yet'}
            </span>
            {/*
              R9 — the inline confirm CHIPS. Rendered only when the host can
              actually dispatch the canonical transaction; a Confirm that could
              not would be a fake affordance, which is the one thing this
              surface must never render.
            */}
            {onConfirmEdit && onDiscardEdit && (
              <span
                className="ml-2 inline-flex gap-1 shrink-0"
                onClick={e => e.stopPropagation()}
              >
                <button
                  type="button"
                  data-testid={`model-row-v2-${row.id}-confirm`}
                  aria-label={`Confirm new value for ${row.label}`}
                  onClick={() => onConfirmEdit(row.id)}
                  className={`${typography.buttonSmall} text-info border border-info/50 rounded px-2 py-0.5`}
                >
                  Confirm
                </button>
                <button
                  type="button"
                  data-testid={`model-row-v2-${row.id}-discard`}
                  aria-label={`Discard new value for ${row.label}`}
                  onClick={() => onDiscardEdit(row.id)}
                  className={`${typography.buttonSmall} text-text-light border border-panel-border rounded px-2 py-0.5`}
                >
                  Discard
                </button>
              </span>
            )}
          </span>
        )
      case 'inflight':
        return (
          <span data-testid={testid} className={typography.panelTabular}>
            {commit.to}
            <span className={`${typography.panelBody} text-text-light ml-2`}>Saving…</span>
          </span>
        )
      case 'applied':
        return (
          <span data-testid={testid} className={typography.panelTabular}>
            {commit.value}
          </span>
        )
      case 'refused':
        return (
          <span data-testid={testid} className={typography.panelTabular}>
            <span data-testid={`${testid}-reverted`}>{commit.from}</span>
            <span
              data-testid={`${testid}-refusal`}
              className={`${typography.panelBody} text-danger ml-2`}
            >
              {commit.reason}
            </span>
          </span>
        )
    }
  }

  /*
   * F9 — the single most damning editing gap today: a factor with no value
   * cannot be GIVEN one, because the card renders inert "Not set" text where the
   * editor belongs. Here a null value still renders an editor affordance; it is
   * disabled only because the authority is not frozen, never because the value
   * is missing.
   */
  const display = row.primaryValue

  /*
   * ⚠ THE "NOT SET" WALL, AND WHY SILENCE HERE IS NOT A HIDDEN UNKNOWN.
   *
   * Every row used to render `display ?? 'Not set'`, so a nine-factor model
   * stacked twenty-odd identical inert strings down the outline — individually
   * honest, collectively meaningless, and loud enough to drown the rows that
   * had something to say.
   *
   * The rule now: "Not set" is printed only where it is ACTIONABLE, i.e. where
   * pressing it opens the editor that fixes it (the arm below). Where nothing
   * can be done from this cell, the cell is SILENT — and the fact is carried,
   * once, by the group heading's unknown summary in `ModelOutline`, by this
   * row's `attention` marker, and by the detail region, which still renders
   * "Not set" for the selected row.
   *
   * This is the rule the provenance pill three elements up already follows
   * (`showWhenAbsent={false}` — "absence is rendered as absence"); the value
   * cell simply did not follow its own neighbour. Nothing is invented and
   * nothing is concealed: the unknown moved from N repetitions to one sentence
   * plus one marker, which is the difference between stating a fact and
   * shouting it.
   */
  /*
   * ⭐ OLUMI'S OWN TEXT, BESIDE THE AFFORDANCE — NEVER INSTEAD OF IT.
   *
   * `estimateText` is present only on rows nobody has SET, and it carries what
   * CEE computed for them — including, on the row that matters most, a RANGE
   * ("0.25 to 0.75"). The product was holding that band and showing nothing.
   *
   * ⚠ THE INVERSE HARM IS THE ONE TO PRICE, AND IT DECIDES THIS SHAPE. If the
   * cell rendered the estimate ALONE, a user would read it as a value that IS
   * set — while the affordance correctly still asks them to set one, and the
   * row would contradict its own button. So both axes render together: the
   * control keeps saying "Not set" and does what it always did, and Olumi's
   * text sits beside it, attributed, in secondary type. Nothing here re-derives
   * a value; this component still renders what the projection handed it.
   *
   * It is NOT a "Not set" wall: that rule exists because N identical inert
   * strings drown the outline. These strings are distinct per row and each one
   * is a fact the product computed.
   */
  const estimate =
    display === null && row.estimateText !== undefined ? (
      <span
        data-testid={`${testid}-estimate`}
        /* ⚠ SECONDARY, AND THEREFORE THE THING THAT GIVES WAY. "Olumi:
           Moderate (0.5)" beside "Not set" pushed this cell to 180px — SEVEN
           TIMES the label it was starving. The estimate is a hint about a value
           the user has not set; the node's name is how they find the row at
           all. So the hint truncates and the name does not. */
        /* ⭐⭐ THE HINT TRUNCATES BY DESIGN — SO IT MUST BE RECOVERABLE, AND IT
           WAS NOT. MEASURED on deployed `80ccf768` (guest, seeded "Customer
           Data Platform Selection", dock 414px, Model tab): this span rendered
           a **31px box for content needing 125px** — "Olu" of
           "Olumi: Moderate (0.5)" — with **no `title`, no `aria-label` and no
           `sr-only` anywhere above it**. Seven cells in the tab, and they were
           the ONLY genuinely unrecoverable clipped text on the surface: every
           `-label` already carries an exact-text `title`, and the relationship
           phrase is recovered by `ValueLeaf`'s own `title` plus its `sr-only`.

           The arithmetic, so nobody re-opens the layout question by mistake:
           the cell is 80px and holds two spans SIDE BY SIDE — "Not set" at
           40.6px with `min-width: auto` (it cannot shrink, and must not: a
           truncated affordance is a fake one) plus this hint's `ml-2` 8px,
           leaving 31.4px. `80 = 40.6 + 8 + 31.4`. A `min-w-0` atom beside a
           `min-width:auto` atom absorbs 100% of the squeeze.

           ⛔ TWO FIXES ARE ALREADY EXCLUDED ON MEASUREMENT — do not re-propose
           them.

           (a) WIDENING THE GRID CAP. The value column is the THIRD of four
           tracks, `fit-content(5.5rem)`. The whole declaration, so the ordinal
           and the length can be checked in one step:
           `grid-cols-[auto_minmax(6rem,1fr)_fit-content(5.5rem)_fit-content(5rem)]`
           — track 1 `auto` (the kind glyph), track 2 `minmax(6rem,1fr)`
           (`CELL 2 · IDENTITY`), track 3 `fit-content(5.5rem)`
           (`CELL 3 · VALUE`, this one), track 4 `fit-content(5rem)`
           (`CELL 4 · META`). At the 16px browser default — no
           `html { font-size }` override exists in `src/` or `index.html` —
           **5.5rem = 88px and 5rem = 80px**, and the PR's own resolved template
           was `23.1px 194.9px 88px 66px`. So the 80px value cell sits inside
           the **88px** track: the third.

           ⚠⚠ DO THAT ARITHMETIC BEFORE YOU "CORRECT" THIS PARAGRAPH, BECAUSE IT
           HAS BEEN WRONG TWICE AND BOTH TIMES THE WRONG VERSION WAS ITSELF A
           CORRECTION — first "track 2", then "the FOURTH track", each surviving
           a review. `5rem = 80px` and the measured value cell is 80.0px, so the
           META cap coincides numerically with a cell in a different column and
           track 4 reads as obviously right. The 88px in the template is the
           tell, and it is the only tell: it is a track that resolved to its
           cap, and 5.5rem is the only cap that can produce it. A reader who
           matches the cell width to a cap instead of matching the TEMPLATE to a
           cap will get this wrong a third time.

           THE AUTHORITY IS AN EXECUTING GUARD, NOT A NUMBER AND NOT THIS
           COMMENT. `CAPS` in `rowAtomsAlignToOneGrid.spec.tsx` pins
           `{ index: 2, name: 'value', length: 5.5 }` and
           `{ index: 3, name: 'attention', length: 5 }` — zero-indexed, so value
           is the third track — and REDs if either the ordinal or the length
           moves. Start there.

           WHERE THE DECLARATION LIVES, CITED AS A SYMBOL: `ModelOutline.tsx`
           holds exactly one `grid-cols-[…]` class and that is the handle. No
           line number — the one that stood here was `:679`, true at this
           branch's head and ALREADY `:777` on `staging`, so it was rotten
           before merge, which is the failure the `commit=` note above names
           ("the symbol is the handle; the number was a mirror with no owner").
           Grep the BRACKETED form, `grep -n -F 'grid-cols-['` — one hit, at
           this branch's head and on `staging` alike. The loose `grid-cols`
           returns three there, the other two prose in that file's own comments;
           an earlier note cited that three to argue the grep was worthless,
           which talked the next reader out of the one check that would have
           caught the wrong track.

           The rejected widening was `minmax(0,5.5rem)`, a replacement for that
           same third track: a zero-minimum track reserves its cap even when
           empty and cost four fully-visible option labels.

           (b) STACKING THE HINT ONTO A SECOND LINE: the `<button>` arm below
           records that it once did exactly that and the rows measured 42px,
           which is why `whitespace-nowrap` is on both idle arms.

           So the trade stands — the hint is still the atom that gives. ⚠ AND
           THE SENTENCE THAT FOLLOWED THIS ONE CLAIMED MORE THAN WAS MEASURED,
           corrected here rather than left to be inherited: it read "giving it
           up no longer DESTROYS it", which reads as a claim for every user.
           What was actually measured is narrower — `title` restores the text on
           POINTER HOVER. Sighted touch users and keyboard-only users still get
           the three visible characters and no way to reach the rest; the
           author's own PR comment tabulated exactly that. So: recoverable on
           hover, unchanged otherwise, and the gap for touch and keyboard is
           open rather than closed.
           `title` on the leaf, not on the wrapping `<button>`, because the
           button's own "Change this value" is about the affordance and would
           otherwise be the only thing a hover could ever tell you. */
        title={`Olumi: ${row.estimateText}`}
        className={`${typography.panelBody} text-text-light ml-2 truncate min-w-0`}
      >
        Olumi: {row.estimateText}
      </span>
    ) : null

  if (!row.editable || !editorAvailable) {
    return (
      /* ⚠ `shrink-0` ONLY WHEN THERE IS NOTHING HERE THAT CAN AFFORD TO GO.
         A bare value ("35 %") must never shrink — that is what broke a number
         away from its own unit. A value carrying an ESTIMATE HINT is a
         different case: the hint can truncate, so the cell is allowed to give
         rather than starving the label. */
      <span
        data-testid={testid}
        className={`${typography.panelTabular} ${EDIT_RESERVED_HEIGHT_CLASS} flex items-center whitespace-nowrap ${
          /* ⚠ `min-w-0` ONLY — NEVER `truncate` HERE. This element is a FLEX
             CONTAINER (`flex items-center`) holding the value and its estimate
             hint. `truncate` sets `overflow:hidden` on the container, and the
             rendered result was the value drawing OVER the label: rows read
             "Bottom-Not sett… Olumi: Very high (0.8)". Caught in a screenshot
             of this very change, not by a test — jsdom performs no layout.
             The ellipsis belongs on a text LEAF, not on the flex box. */
          estimate === null && !valueMayShrink(display) ? 'shrink-0' : 'min-w-0'
        }`}
      >
        <ValueLeaf display={display} mayShrink={valueMayShrink(display)} />
        {estimate}
      </span>
    )
  }

  return (
    <button
      type="button"
      data-testid={testid}
      title="Change this value"
      aria-label={`Change ${row.label}`}
      /* ⚠⚠ THE SAME RULE AS THE READ-ONLY CELL ABOVE, STATED TWICE BECAUSE THE
         RESTING ROW HAS TWO DIFFERENT ELEMENTS — a `<span>` when the value is
         not editable here, this `<button>` when it is. I patched the `<span>`
         first, re-measured, and the tall rows were still 42px: every one of
         them was EDITABLE, so they came out of this `<button>`, which wrapped
         its estimate hint onto a second line. A fix applied to one of the two
         idle elements is a fix that half the rows never receive.

         ⚠ CORRECTED: an earlier version of this comment said the COMPONENT has
         "two return paths". It has EIGHT — editing-with-input, editing
         fallback, proposed, inflight, applied, refused, and these two idle
         arms. The rule is about the two IDLE elements, not about the function.
         Getting that number wrong is what let the `proposed` cell ship
         unfixed, and it was found by review rather than by me. */
      /* ⚠ THE SAME PREDICATE AS THE `<span>` ABOVE, AND THIS FILE'S OWN RULE IS
         WHY IT IS HERE TOO: "a fix applied to one of the two idle elements is a
         fix that half the rows never receive." The editable rows are exactly the
         ones carrying "Not set", which is where the relationship list lives. */
      className={`${typography.panelTabular} ${EDIT_RESERVED_HEIGHT_CLASS} text-left flex items-center whitespace-nowrap ${
        estimate === null && !valueMayShrink(display) ? 'shrink-0' : 'min-w-0'
      }`}
      onClick={e => {
        e.stopPropagation()
        onBeginEdit?.(row.id)
      }}
    >
      {/* ⚠ THE SAME LEAF, because this file's own rule applies: "a fix applied
          to one of the two idle elements is a fix that half the rows never
          receive." The editable rows are exactly the ones carrying the long
          strength bands, so this is the site the overflow was measured on. */}
      <ValueLeaf display={display ?? 'Not set'} mayShrink={valueMayShrink(display)} editable />
      {estimate}
    </button>
  )
}
