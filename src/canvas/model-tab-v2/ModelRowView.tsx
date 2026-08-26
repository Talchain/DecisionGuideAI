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
      className={`flex items-center gap-2 px-2 py-1.5 border-b border-panel-border ${
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

      <button
        type="button"
        data-testid={`model-row-v2-${row.id}-label`}
        className={`${typography.bodySmall} text-text-body text-left truncate`}
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
          className={`${typography.edgeLabel} text-text-light whitespace-nowrap`}
        >
          {GOAL_LABEL_FROM_BRIEF_COPY.pill}
        </span>
      )}

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
      {row.provenanceSource !== undefined && (
        <span data-testid={`model-row-v2-${row.id}-provenance`}>
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
          className={`${typography.buttonSmall} text-info underline decoration-dotted`}
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
          className={`${typography.caption} text-warning`}
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
          className={`${typography.caption} text-text-light`}
        >
          Left unresolved
        </span>
      )}

      {tier === 'advanced' && (
        <span
          data-testid={`model-row-v2-${row.id}-id`}
          className={`${typography.code} text-text-light`}
        >
          {row.id}
        </span>
      )}
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
            <span data-testid={testid} className={typography.tabular}>
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
          <span data-testid={testid} className={typography.tabular}>
            {commit.draft}
          </span>
        )
      case 'proposed':
        return (
          <span data-testid={testid} className={typography.tabular}>
            <span data-testid={`${testid}-from`}>{commit.from}</span>
            {' → '}
            <span data-testid={`${testid}-to`}>{commit.to}</span>
            <span className={`${typography.caption} text-text-light ml-2`}>
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
                className="ml-2 inline-flex gap-1"
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
          <span data-testid={testid} className={typography.tabular}>
            {commit.to}
            <span className={`${typography.caption} text-text-light ml-2`}>Saving…</span>
          </span>
        )
      case 'applied':
        return (
          <span data-testid={testid} className={typography.tabular}>
            {commit.value}
          </span>
        )
      case 'refused':
        return (
          <span data-testid={testid} className={typography.tabular}>
            <span data-testid={`${testid}-reverted`}>{commit.from}</span>
            <span
              data-testid={`${testid}-refusal`}
              className={`${typography.caption} text-danger ml-2`}
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
        className={`${typography.caption} text-text-light ml-2`}
      >
        Olumi: {row.estimateText}
      </span>
    ) : null

  if (!row.editable || !editorAvailable) {
    return (
      <span data-testid={testid} className={typography.tabular}>
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
      className={`${typography.tabular} text-left underline decoration-dotted`}
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
