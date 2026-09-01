/**
 * ⭐⭐ THE SUCCESS TARGET, AS A HEADER LINE — not a fifth tally row.
 *
 * "What does success look like" is the question a strategist answers first and
 * this panel never asked. The strip already carries the goal's LABEL; this puts
 * the NUMBER beside it, with the same value + provenance + edit vocabulary the
 * factor rows use, so one thing is learned once.
 *
 * ⚠ A HEADER LINE, DELIBERATELY. The strip's rows are a CENSUS — options,
 * factors, risks, outcomes — each a count of nodes. A target is not a count and
 * not a node kind, and a fifth row saying "Target · 1" would be the least
 * informative row on the panel. It belongs to the subject line above the rows,
 * which is what the goal is.
 *
 * ── THE AI DOES NOT INVENT ONE, AND DOES NOT NEED TO ───────────────────────
 * Producer-checked at the bytes: `suggested_threshold`, `proposed_threshold`
 * and `suggested_target` appear in ZERO files (contrast controls fired at
 * 31/46/134), so nothing upstream proposes a target and no UI can surface one.
 * But it does not have to invent what the user already wrote: CEE sends
 * `goal_threshold_raw` from the BRIEF, and `store.ts:5094` syncs it. The move
 * is to LIFT the target already stated, show whose it is, and let it be
 * changed — not to generate one.
 *
 * ── TWO HONESTY CONSTRAINTS, BOTH DERIVED ──────────────────────────────────
 * 1 · ⚠⚠ A NORMALISED VALUE IS NOT THE USER'S NUMBER. The store tags every
 *     threshold `raw` or `normalised`, because a bare 0-1 painted as a target
 *     "showed 0.8 when the real target was 20%" (staging trust review, 2026-07,
 *     recorded at `store.ts:5059`). This surface renders ONLY a `raw` value.
 *     A normalised one is a number we cannot express in the user's units, so it
 *     says so rather than printing a figure that means something else.
 * 2 · ⚠⚠ THE WRITE IS LOCAL. `CANONICAL_EDIT_AUTHORITY.goalSuccessTarget` is
 *     `'disabled'` and no server carrier for a goal threshold exists — the four
 *     that do are `factor_value_edit`, `prior_range_edit`, `edge_adjudication`
 *     and `structural_delete`. So this reports `local_only` and NEVER
 *     `dispatched`. The strip's editor answers to a real authority; this one
 *     must not borrow its confident sentence.
 */
import { useState } from 'react'
import { Target } from 'lucide-react'
import { typography } from '../../../../styles/typography'
import { useCanvasStore } from '../../../../canvas/store'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'
import { VALUE_PROVENANCE_LABEL } from '../../../../canvas/domain/valueProvenance'
import { resolveGoalTarget, type GoalTargetSource } from '../../../../canvas/domain/goalTarget'
import { formatGoalTarget } from '../../utils/formatGoalTarget'

export interface SuccessTargetLineProps {
  /** The goal node to write to. Null = no goal, so nothing to target. */
  goalNodeId: string | null
  /** Report the outcome. The caller owns the vocabulary. */
  onCommitOutcome: (outcome: 'local_only' | 'not_encodable') => void
  testId: string
}

export function SuccessTargetLine({
  goalNodeId,
  onCommitOutcome,
  testId,
}: SuccessTargetLineProps) {
  /**
   * ⭐⭐ THE GOAL NODE IS THE SOURCE, NOT THE STORE — AND THAT IS A WITNESS-DRIVEN
   * CORRECTION. This first read `goalThreshold`/`goalThresholdRepresentation`
   * from the canvas store, which on deployed `6e58c921` carried the
   * `normalised` tag, so this line rendered "No target we can show" while the
   * canvas goal card six inches away rendered **"Target: 110%"**. One goal, one
   * screen, two answers — because the node holds the figure in the user's own
   * units and the store held a normalised twin of it.
   *
   * `resolveGoalTarget` is the shared owner both surfaces now go through.
   */
  const goalData = useCanvasStore((s) =>
    goalNodeId === null ? null : (s.nodes.find((n) => n.id === goalNodeId)?.data ?? null),
  )
  const setGoalThresholdAndUpdateNode = useCanvasStore((s) => s.setGoalThresholdAndUpdateNode)
  /**
   * ⚠ THE STORE SURVIVES AS A FALLBACK ONLY, and keeps its guard. A `raw` store
   * value is still a real target when the node carries none; a `normalised` one
   * is a number we cannot express in the user's units, and printing it is the
   * defect that showed 0.8 for a 20% target (`store.ts:5059`).
   */
  const threshold = useCanvasStore((s) => s.goalThreshold)
  const representation = useCanvasStore((s) => s.goalThresholdRepresentation)

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  // No goal node, nothing to attach a target to. A target line over a model
  // with no goal would be an affordance writing into nowhere.
  if (goalNodeId === null) return null

  /**
   * ⚠ `raw` OR NOTHING. `normalised` is a real value we cannot express in the
   * user's units — printing it would be the 0.8-for-20% defect. `null` and
   * `normalised` are DIFFERENT states and get different sentences below.
   */
  const fromNode = resolveGoalTarget(goalData as GoalTargetSource | null)
  const fromStore = threshold != null && representation === 'raw' ? threshold : null
  /** The node first — it is the only source guaranteed to be in user units. */
  const shownText =
    fromNode !== null
      ? (formatGoalTarget(
          typeof fromNode.raw === 'number' ? fromNode.raw : Number(fromNode.raw),
          fromNode.unit,
        ) ?? String(fromNode.raw))
      : fromStore != null
        ? String(fromStore)
        : null
  /**
   * ⚠ ONLY WHEN NOTHING EXPRESSIBLE EXISTS ANYWHERE. A normalised store value
   * beside a readable node value is not "unexpressible" — it is simply the
   * weaker of two sources, and the node already answered.
   */
  const unexpressible = shownText === null && threshold != null && representation !== 'raw'

  const commit = () => {
    const typed = draft.trim()
    const parsed = Number(typed)
    // `Number('')` is 0 — the empty test is not redundant.
    if (typed === '' || !Number.isFinite(parsed)) {
      onCommitOutcome('not_encodable')
      return
    }
    setGoalThresholdAndUpdateNode(goalNodeId, parsed)
    // ⚠ `local_only`, ALWAYS. There is no server carrier for this value.
    onCommitOutcome('local_only')
    setEditing(false)
    setDraft('')
  }

  return (
    <div className="flex items-baseline gap-1.5 mt-0.5" data-testid={testId}>
      <Target className="w-3 h-3 self-center shrink-0 text-text-light" aria-hidden="true" />
      <span className={`${typography.panelMeta} text-text-light shrink-0`}>
        {COPY.successTarget.label}
      </span>

      {editing ? (
        <span className="flex items-center gap-1.5 min-w-0 flex-1">
          <input
            type="text"
            inputMode="decimal"
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                commit()
              }
              if (e.key === 'Escape') {
                e.preventDefault()
                setEditing(false)
              }
            }}
            aria-label={COPY.successTarget.inputLabel}
            className={`${typography.panelMeta} min-w-0 flex-1 rounded border border-panel-border bg-surface px-1.5 py-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-info`}
            data-testid={`${testId}-input`}
          />
          <button
            type="button"
            onClick={commit}
            className={`${typography.panelMeta} rounded px-2 py-0.5 bg-primary text-text-on-color focus:outline-none focus-visible:ring-2 focus-visible:ring-info`}
            data-testid={`${testId}-save`}
          >
            {COPY.modelStrip.saveValue}
          </button>
        </span>
      ) : (
        <>
          {shownText !== null ? (
            <span
              className={`${typography.panelMeta} text-text-body`}
              data-testid={`${testId}-value`}
            >
              {shownText}
            </span>
          ) : (
            <span
              className={`${typography.panelMeta} text-text-light`}
              data-testid={`${testId}-none`}
            >
              {/* ⚠ TWO DIFFERENT ABSENCES, TWO SENTENCES. "No target set" is a
                  fact about the MODEL; "we hold one we cannot show in your
                  units" is a fact about the VALUE. Collapsing them would tell a
                  user who set a target that they never did. */}
              {unexpressible ? COPY.successTarget.unexpressible : COPY.successTarget.none}
            </span>
          )}
          {/* Provenance in the SAME vocabulary the factor rows use — one thing
              learned once. A target we hold is the user's own: it came from
              their brief or from this control. */}
          {/* ⚠ PROVENANCE FROM THE RESOLVER, NOT ASSUMED. A target the reader
              typed and one CEE lifted from their brief are different claims
              about authorship — this panel's whole provenance vocabulary exists
              to keep them apart, and hardcoding "From brief" over a value the
              user set themselves is exactly the mislabel it guards against. */}
          {shownText !== null ? (
            <span
              className={`${typography.panelMeta} text-text-light`}
              data-testid={`${testId}-source`}
              data-source={fromNode?.source ?? 'store'}
            >
              {fromNode?.source === 'user'
                ? VALUE_PROVENANCE_LABEL.human
                : VALUE_PROVENANCE_LABEL.brief}
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => {
              setEditing(true)
              setDraft(fromNode != null ? String(fromNode.raw) : fromStore != null ? String(fromStore) : '')
            }}
            className={`${typography.panelMeta} text-info underline underline-offset-2 hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-info rounded`}
            data-testid={`${testId}-edit`}
          >
            {shownText !== null ? COPY.successTarget.change : COPY.successTarget.set}
          </button>
        </>
      )}
    </div>
  )
}
