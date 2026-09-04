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
 * THE DISABLED-AFFORDANCE RULE (the lane boundary, design §8). An edit control
 * is live ONLY where the host has a CANONICAL transaction to dispatch on
 * (`editConnected` + the callbacks). Everywhere else it renders DISABLED, with
 * a label saying why. A disabled affordance with an honest label beats a fake
 * one: a stub that reported success would be the silent-local-write defect
 * re-created inside the component written to kill it.
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

import { typography } from '../../styles/typography'
import { EDIT_RESERVED_HEIGHT_CLASS } from './valueCellMetrics'
import {
  GOAL_LABEL_FROM_BRIEF_COPY,
  GOAL_LABEL_FROM_BRIEF_TESTID,
} from '../domain/goalLabelProvenance'
import { SourceProvenancePill } from '../components/model-tab/SourceProvenancePill'
import { ATTENTION_LABEL, KIND_GLYPH, KIND_LABEL, deferralLabel } from './rowPresentation'
import type { EditCommitState, DetailTier, ModelRow } from './types'

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
  onDraftChange?: (id: string, draft: string) => void
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
}: ModelRowViewProps) {
  const phase = commit?.phase ?? 'idle'
  const editorAvailable = row.editable && editConnected && typeof onBeginEdit === 'function'

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
        className={`${typography.panelBody} text-text-body text-left truncate min-w-[6rem] flex-1`}
        onClick={e => {
          e.stopPropagation()
          onFocusOnCanvas?.(row.id)
        }}
      >
        {row.label}
      </button>

      {/* The label is the user's own sentence lifted from the brief, not an
          objective. Same claim, same copy and same predicate as the canvas
          node and the Analysis Goal field — the outline states it, and the one
          place to act stays the Analysis tab. */}
      {row.labelFromBrief === true && (
        <span
          data-testid={GOAL_LABEL_FROM_BRIEF_TESTID}
          title={GOAL_LABEL_FROM_BRIEF_COPY.notice}
          className={`${typography.panelMeta} text-text-light whitespace-nowrap shrink-0`}
        >
          {GOAL_LABEL_FROM_BRIEF_COPY.pill}
        </span>
      )}

      </span>
      {/* ── CELL 3 · VALUE — the column this whole change exists to create.

          ⚠⚠ THE TRACK IS `auto`, WHICH MEANS THIS CELL SIZES TO ITS CONTENT AND
          TAKES THAT WIDTH OUT OF THE IDENTITY TRACK. That is correct for every
          arm a producer can currently reach — `idle` and `proposed`, whose
          content is bounded — and it is a LOADED GUN for the arms that are dark
          today.

          Named by an independent seat and traced by PRODUCER rather than by
          field name: the sole live writer of `commit` is `ModelOutline.tsx:385`
          ← `ModelTabV2Panel`'s `ActiveEdit`, typed `'editing' | 'proposed'`. So
          `inflight`, `applied`, `refused` and the `editing` fallback are
          unreachable — by accident of the host, not by design. `types.ts:108`
          already specifies `applied` as receipt-driven, so the wiring is
          PLANNED, not hypothetical.

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
           was load-bearing in four places and would have been re-derived. */
        <span data-testid={`model-row-v2-${row.id}-provenance`} className="min-w-0 truncate">
          <SourceProvenancePill source={row.provenanceSource} showWhenAbsent={false} />
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

      {row.attention.map(reason => (
        <span
          key={reason}
          data-testid={`model-row-v2-${row.id}-attention-${reason}`}
          title={ATTENTION_LABEL[reason]}
          aria-label={ATTENTION_LABEL[reason]}
          className={`${typography.panelBody} text-warning shrink-0`}
        >
          ⚠
        </span>
      ))}

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
    </li>
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
  onDraftChange?: (id: string, draft: string) => void
  onProposeEdit?: (id: string) => void
  onDiscardEdit?: (id: string) => void
  onConfirmEdit?: (id: string) => void
}) {
  const testid = `model-row-v2-${row.id}-value`

  if (commit && commit.phase !== 'idle') {
    switch (commit.phase) {
      case 'editing':
        // Live host: a real input. The draft is the HOST's state — this cell
        // renders it and reports keystrokes; it decides nothing.
        if (onDraftChange && onProposeEdit && onDiscardEdit) {
          return (
            <span data-testid={testid} className={`${typography.panelTabular} ${EDIT_RESERVED_HEIGHT_CLASS} inline-flex items-center shrink-0 whitespace-nowrap`}>
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
            <span className="shrink-0 whitespace-nowrap">
              <span data-testid={`${testid}-from`}>{commit.from}</span>
              {' → '}
              <span data-testid={`${testid}-to`}>{commit.to}</span>
            </span>
            <span className={`${typography.panelBody} text-text-light ml-2 min-w-0 truncate`}>
              Nothing has changed yet
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
          estimate === null ? 'shrink-0' : 'min-w-0'
        }`}
      >
        {display ?? ''}
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
      className={`${typography.panelTabular} ${EDIT_RESERVED_HEIGHT_CLASS} text-left underline decoration-dotted flex items-center whitespace-nowrap ${
        estimate === null ? 'shrink-0' : 'min-w-0'
      }`}
      onClick={e => {
        e.stopPropagation()
        onBeginEdit?.(row.id)
      }}
    >
      {display ?? 'Not set'}
      {estimate}
    </button>
  )
}
