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
 * THE INLINE-CHIP CONFIRM (ruling R9, 16 Aug 2026). The three-beat renders in
 * the row itself: an input while `editing`, then Confirm / Discard CHIPS while
 * `proposed` — never a modal. Until Confirm, the model is unchanged and the
 * row says so in words.
 */

import { typography } from '../../styles/typography'
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
}

/** Why the editor is unavailable. Shown on the disabled control, in words. */
const NO_AUTHORITY_REASON =
  'Editing is not connected yet — this value cannot be changed from here.'

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
}: ModelRowViewProps) {
  const phase = commit?.phase ?? 'idle'
  const editorAvailable = row.editable && editConnected && typeof onBeginEdit === 'function'

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
  if (!row.editable) {
    return (
      <span data-testid={testid} className={typography.tabular}>
        {display ?? ''}
      </span>
    )
  }

  /*
   * ⚠ THE EDITABLE-BUT-UNCONNECTED ROW DELIBERATELY STILL SAYS "Not set", AND
   * THIS COMMENT EXISTS SO NOBODY "FINISHES THE JOB" BY SILENCING IT.
   *
   * A first cut of the wall fix silenced it too, and broke
   * `ModelTabV2Panel.spec.tsx`'s pinned invariant that the relationship, option
   * and goal rows render a DISABLED control carrying `NO_AUTHORITY_REASON`. That
   * invariant is right: a control that says "editing is not connected yet" is
   * strictly more truthful than an empty cell, and silence here would replace a
   * truthful fallback with nothing (P3).
   *
   * Which means the remaining "Not set" repetition on this surface is NOT a
   * display defect — it is the visible shape of the edit paths that have no
   * canonical carrier yet (design §2 F6/F9). Suppressing it would have killed
   * the symptom and left the defect (trap 23). It is reported, not hidden.
   */

  return (
    <button
      type="button"
      data-testid={testid}
      disabled={!editorAvailable}
      title={editorAvailable ? 'Change this value' : NO_AUTHORITY_REASON}
      aria-label={
        editorAvailable
          ? `Change ${row.label}`
          : `${row.label} — ${NO_AUTHORITY_REASON}`
      }
      className={`${typography.tabular} text-left ${
        editorAvailable ? 'underline decoration-dotted' : 'text-text-light cursor-not-allowed'
      }`}
      onClick={e => {
        e.stopPropagation()
        onBeginEdit?.(row.id)
      }}
    >
      {display ?? 'Not set'}
    </button>
  )
}
