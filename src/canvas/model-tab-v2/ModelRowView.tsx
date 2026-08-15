/**
 * Model tab v2 — THE ROW. One anatomy for every element (design §4.2).
 *
 * ⚠ UNMOUNTED. Nothing imports this outside `src/canvas/model-tab-v2/` and its
 * specs; `__tests__/modelTabV2IsUnmounted.sourceScan.spec.ts` proves it.
 *
 * ⚠ THIS COMPONENT NEVER WRITES, AND NEVER DECIDES THAT AN EDIT SUCCEEDED.
 * It renders `commit` — the state the WRITE AUTHORITY reports — and it renders
 * `row.primaryValue` VERBATIM. It does not re-derive a value, re-format a
 * number, or infer a provenance. The reason is design §2 F6: today an edge
 * strength, an option's intervention value and the goal target are local store
 * writes that never reach CEE, while a factor value edit is a real turn — and
 * the two are INDISTINGUISHABLE on screen. A row that can only render `applied`
 * from a receipt cannot reproduce that, whatever it is handed.
 *
 * THE DISABLED-AFFORDANCE RULE (the lane boundary, design §8). The write
 * authority is Codex's transactional-edit vertical and it is not frozen yet. So
 * every control here that would CAUSE a transition is rendered DISABLED, with a
 * label saying why, whenever its callback is absent. A disabled affordance with
 * an honest label beats a fake one: a stub that reported success would be the
 * silent-local-write defect re-created inside the component written to kill it.
 */

import { typography } from '../../styles/typography'
import { SourceProvenancePill } from '../components/model-tab/SourceProvenancePill'
import { ATTENTION_LABEL, KIND_GLYPH, KIND_LABEL } from './rowPresentation'
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
   * Begin an edit. ABSENT UNTIL THE WRITE AUTHORITY IS FROZEN, which is why the
   * editor affordance renders disabled rather than optimistic.
   */
  onBeginEdit?: (id: string) => void
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
}: ModelRowViewProps) {
  const phase = commit?.phase ?? 'idle'
  const editorAvailable = row.editable && typeof onBeginEdit === 'function'

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
}: {
  row: ModelRow
  commit?: EditCommitState
  editorAvailable: boolean
  onBeginEdit?: (id: string) => void
}) {
  const testid = `model-row-v2-${row.id}-value`

  if (commit && commit.phase !== 'idle') {
    switch (commit.phase) {
      case 'editing':
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

  if (!row.editable) {
    return (
      <span data-testid={testid} className={typography.tabular}>
        {display ?? 'Not set'}
      </span>
    )
  }

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
