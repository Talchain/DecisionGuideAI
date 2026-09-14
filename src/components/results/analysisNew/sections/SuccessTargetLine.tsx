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
 *
 * 2 · ⚠⚠⚠ THE SECOND CONSTRAINT WAS WRITTEN AGAINST THE WRONG KEY, AND THAT
 *     MADE THIS THE ONE EDITOR ON THE PANEL THAT LIED. It read:
 *
 *       ~~THE WRITE IS LOCAL. `CANONICAL_EDIT_AUTHORITY.goalSuccessTarget` is
 *       `'disabled'` and no server carrier for a goal threshold exists.~~
 *
 *     The premise is false. A typed carrier exists and is live TODAY on the
 *     Model tab: `useModelEditAuthority.proposeGoalTarget` dispatches
 *     `{action_type: 'add_constraint'}` with the parameters
 *     `buildManualGoalTarget` builds, under
 *     `CANONICAL_EDIT_AUTHORITY.modelGoalMinimumTarget`, which is
 *     `'server_graph'` (`ModelTabV2Panel.tsx:558`, `:755`). `goalSuccessTarget`
 *     is a DIFFERENT key answering a DIFFERENT question - its own frozen
 *     contract is about a LOCAL threshold editor and a local Define-success
 *     modal, and it is correct about those. This surface performs neither.
 *
 *     ⭐ THE SAME MISREAD, AT THE SAME KEY, HAS ALREADY BEEN CORRECTED ONCE:
 *     `HeroSection.tsx` gated its GOAL field on `goalSuccessTarget` and shipped
 *     an imperative over a read-only span. Trap 21's remedy applied there and
 *     applies here: name the concepts apart and point each surface at the key
 *     that names ITS operation. `goalSuccessTarget` is NOT flipped.
 *
 *     ⚠⚠ WHAT THE OLD PREMISE COST, MEASURED ON THE SERVED BUILD (10 Sep
 *     2026). The edit committed, the provenance label flipped truthfully to
 *     "Set by you", and the strip said **"Target set on your model. It will be
 *     used the next time you analyse."** Both halves of that sentence were
 *     false. `setGoalThresholdAndUpdateNode` is store-only;
 *     `success_threshold` and `goalThreshold` appear ZERO times in
 *     `src/v5/buildPayload.ts` (contrast controls in the same sweep:
 *     `factor_value_edit` 6, `nodes` 4 - a real absence, not a blind probe).
 *     So on reload the target reverted to its brief value and the label
 *     reverted to "From brief": the product re-attributed the reader's own
 *     contribution to the brief.
 *
 * ⭐⭐ NO LOCAL ECHO ON THE DISPATCH PATH, AND THAT IS `proposeGoalTarget`'s OWN
 * DISCIPLINE, NOT AN INVENTION HERE. Its comment: *"Do not echo the draft into
 * the store or claim saved on promise resolution."* CEE's validated
 * proposal/commit path owns acceptance and refusal, and central response
 * application owns the write. An optimistic `threshold_source: 'user'` stamp
 * alongside the dispatch is exactly the fabricated provenance that produced the
 * reversion above - the label would claim authorship the shared model had not
 * accepted. The local write SURVIVES on the `local_only` path only, where there
 * is no dispatcher to own it and the copy says so plainly.
 */
import { useState, type KeyboardEvent } from 'react'
import { Target } from 'lucide-react'
import { typography } from '../../../../styles/typography'
import { useCanvasStore } from '../../../../canvas/store'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'
import { VALUE_PROVENANCE_LABEL } from '../../../../canvas/domain/valueProvenance'
import {
  resolveGoalTarget,
  statedTargetNumber,
  type GoalTargetSource,
} from '../../../../canvas/domain/goalTarget'
import { formatGoalTarget } from '../../utils/formatGoalTarget'
import { useModelEditAuthority } from '../../../../canvas/hooks/useModelEditAuthority'
import type { ConstraintType } from '../../../../v5/chipParameters'
import {
  CANONICAL_EDIT_AUTHORITY,
  hasServerGraphAuthority,
} from '../../../../canvas/mutations/mutationAuthority'

/**
 * ⭐ THE KEY THAT NAMES THIS SURFACE'S OPERATION, read exactly as
 * `ModelTabV2Panel.tsx:558` reads it for the same write. A module constant
 * because it is a frozen policy value, not state.
 */
/**
 * ⭐⭐⭐ THE DIRECTION A FRESH EDIT STARTS FROM — ONE CONSTANT, BECAUSE IT WAS
 * BRIEFLY TWO AND A MUTANT PROVED ONLY ONE OF THEM WAS LIVE.
 *
 * ⚠⚠ HOW THIS WAS CAUGHT, AND WHY IT MATTERS. The default was written twice:
 * as `useState`'s initial value AND as the value seeded when the editor opens.
 * A mutant flipping the `useState` initial to `at_most` left every case GREEN —
 * correctly, because the selector only exists WHILE editing and opening always
 * re-seeds, so that initial value is unobservable. Two spellings of one policy,
 * one of them dead: the hand-maintained mirror CLAUDE.md trap 12 is about, and
 * the dead one is exactly what a later author would "helpfully" keep in sync
 * while the live one drifted.
 *
 * ⚠ `at_least` IS NOT A STYLE CHOICE. It is what this control has recorded
 * since it shipped, and readers hold targets set under it. Changing this
 * constant silently re-reads their models, so a mutant flipping it REDs.
 */
const DEFAULT_TARGET_DIRECTION: ConstraintType = 'at_least'

const GOAL_TARGET_DISPATCH_CONNECTED = hasServerGraphAuthority(
  CANONICAL_EDIT_AUTHORITY.modelGoalMinimumTarget,
)

export interface SuccessTargetLineProps {
  /** The goal node to write to. Null = no goal, so nothing to target. */
  goalNodeId: string | null
  /**
   * Report the outcome. The caller owns the vocabulary.
   *
   * ⚠⚠ THREE TOKENS, NOT TWO, AND THE THIRD IS THE FIX. `proposeGoalTarget`
   * answers `dispatched | not_encodable`; a blank or unparseable draft is
   * `not_encodable` before it is asked; and with no dispatcher mounted the
   * local write is all there is, which is `local_only`. Collapsing any two of
   * these is how a control reports an acceptance it never observed - the exact
   * defect this file's header records.
   */
  onCommitOutcome: (outcome: 'dispatched' | 'local_only' | 'not_encodable') => void
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

  /**
   * ⚠ CALLED UNCONDITIONALLY, ABOVE THE EARLY RETURN, and parameterised by the
   * goal id exactly as `useFactorValueCommit` is parameterised by the factor
   * id. With `null` every proposal answers `not_encodable`, which is the honest
   * answer, so the hook never needs gating.
   */
  const authority = useModelEditAuthority(goalNodeId)

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  /**
   * ⭐⭐⭐ WHICH WAY THE NUMBER IS READ — STATE, BESIDE THE NUMBER IT QUALIFIES,
   * BECAUSE IT IS HALF OF WHAT THE READER IS SAYING.
   *
   * ⚠⚠ THE DEFAULT IS `at_least` AND IT MUST STAY `at_least`. This control has
   * been recording floors since it shipped; readers hold targets set under that
   * behaviour, and re-reading those as ceilings would be a worse harm than the
   * gap being closed. Nothing about an UNTOUCHED interaction changes.
   *
   * ⚠⚠⚠ AND NOTHING HERE INFERS THE DIRECTION FROM THE GOAL. Reading "Within 12
   * Months" as a deadline is the natural-language predicate CLAUDE.md trap 22f
   * records as unwinnable after four rounds that each fixed one direction and
   * reopened the other. Trap 22f's exit is this one: make the ambiguity the
   * product and ASK. A default the reader can SEE and OVERRIDE is an ask; a
   * hardcode nobody is shown is what shipped.
   */
  const [direction, setDirection] = useState<ConstraintType>(DEFAULT_TARGET_DIRECTION)
  /**
   * ⭐ THE SCENARIO THE READER OPENED THE EDITOR IN, captured at OPEN and
   * checked at COMMIT - `ModelTabV2Panel.beginEdit` (`:699`) does exactly this
   * and `proposeGoalTarget` enforces it (`state.currentScenarioId !== scenarioId`
   * is `not_encodable`). A scenario switch mid-edit must fail closed rather than
   * write the reader's number onto a model they are no longer looking at.
   */
  const [editScenarioId, setEditScenarioId] = useState<string | null>(null)

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

  /**
   * ⭐ THE UNIT THE DISPATCH REQUIRES, FROM THE ONE RESOLVER THIS FILE ALREADY
   * READS. `buildManualGoalTarget` refuses an empty unit outright, so a goal
   * CEE sent no `goal_threshold_unit` for cannot be dispatched and the control
   * says so rather than reporting a send. That refusal is the Model tab's too:
   * `unproposableDraftReason` blocks the same draft with "Add a unit".
   */
  const unit = fromNode?.unit ?? ''

  /**
   * ⚠ A CONJUNCTION, AND IT IS `ModelTabV2Panel.tsx:558`'s OWN. The policy key
   * says the control MAY look like a shared-model edit; `goalTargetDispatchAvailable`
   * says a dispatcher is actually mounted. Either half missing and there is no
   * send to report, so the local path takes over and the copy changes with it.
   */
  const canDispatch = GOAL_TARGET_DISPATCH_CONNECTED && authority.goalTargetDispatchAvailable

  /**
   * ⭐⭐ ONE KEYBOARD CONTRACT FOR THE WHOLE EDITOR, NOT ONE PER FIELD.
   *
   * ⚠ THIS IS A REGRESSION THE DIRECTION SELECTOR WOULD OTHERWISE HAVE
   * INTRODUCED, and a test caught it rather than a review. Escape was handled
   * on the INPUT, which was fine while the input was the only focusable thing
   * in the row: wherever focus was, Escape reached it. Adding a second control
   * silently created a place to stand where Escape does nothing and the reader
   * is trapped in an editor with no visible way out.
   *
   * Handing both fields the SAME handler is the fix rather than copying the
   * arms onto the select, because a copy is a hand-maintained mirror and would
   * drift the first time either behaviour changed (CLAUDE.md trap 12).
   */
  const onEditorKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      commit()
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      setEditing(false)
    }
  }

  const commit = () => {
    const typed = draft.trim()
    /**
     * ⚠ ONE PARSE RULE, IMPORTED. `statedTargetNumber` is the estate's anchored
     * numeric-literal predicate and the one `buildManualGoalTarget` itself
     * uses, so the guard here and the builder behind the dispatch cannot drift.
     * It is strictly narrower than `Number()`, which reads `''` as 0, `'0x10'`
     * as 16 and the word `Infinity` as a target.
     */
    const parsed = statedTargetNumber(typed)
    if (parsed === null) {
      onCommitOutcome('not_encodable')
      return
    }

    if (canDispatch) {
      /**
       * ⭐⭐ THE SHARED MODEL IS ASKED, AND WHATEVER IT ANSWERS IS WHAT THE
       * READER IS TOLD. No local echo: see this file's header. `not_encodable`
       * covers both a refusal (no unit, a target at or below zero, a scenario
       * that moved under the editor) and an unbuildable parameter set - from
       * the reader's side one state, nothing written anywhere, so the editor
       * STAYS OPEN exactly as the factor editor does.
       */
      const outcome = authority.proposeGoalTarget(typed, unit, editScenarioId, direction)
      onCommitOutcome(outcome)
      if (outcome === 'not_encodable') return
      setEditing(false)
      setDraft('')
      return
    }

    /**
     * ⚠ NO DISPATCHER MOUNTED. The local write is genuinely all there is, and
     * it is still worth making - the canvas goal card and `computeSuccessState`
     * read it within the session. What must not happen is the old sentence: the
     * copy on this path states plainly that Olumi has not been told.
     */
    setGoalThresholdAndUpdateNode(goalNodeId, parsed)
    onCommitOutcome('local_only')
    setEditing(false)
    setDraft('')
  }

  return (
    /* ⭐ A PEER ROW OF THE STRIP, NOT A FRAGMENT TRAILING ITS HEADER.
       It rendered at `mt-0.5` — two pixels under a row of tallies, in the same
       size, weight and colour as those tallies. So the one CONTROL on the top
       panel looked exactly like the counts beside it, and "what does success
       look like" — the question a strategist answers first — was the quietest
       thing on the surface.

       The rule is the SAME hairline `SectionShell` uses between sections, which
       is the point: the row joins the surface's existing grammar rather than
       inventing a device of its own. Rendered only when there is a goal node to
       attach a target to (the component returns null above), so the rule can
       never appear over nothing. */
    <div
      className="flex items-baseline gap-1.5 border-t border-panel-border pt-2 mt-2"
      data-testid={testId}
    >
      <Target className="w-3 h-3 self-center shrink-0 text-text-light" aria-hidden="true" />
      <span className={`${typography.panelMeta} text-text-light shrink-0`}>
        {COPY.successTarget.label}
      </span>

      {editing ? (
        <span className="flex items-center gap-1.5 min-w-0 flex-1">
          {/*
            ⭐⭐ THE DIRECTION, IN WORDS, BEFORE THE NUMBER — so the row reads as
            the sentence it sends: "Target · at least · 12". It sits FIRST
            because that is the order of the message CEE receives and of the
            claim the reader is making, and it renders in its default state
            without any interaction, which is the whole point: a reader who
            never opens this menu has still been TOLD which way their number is
            about to be recorded. That is what the shipped control never did.

            ⚠ ONLY IN THE EDITOR, DELIBERATELY. The read-only row shows a target
            that came from the brief, through a path that recorded no direction
            at all. Painting a bound onto it would be fabricating provenance for
            a claim nobody made. The direction is stated where it is RECORDED.
          */}
          <select
            value={direction}
            onChange={(e) => setDirection(e.target.value as ConstraintType)}
            onKeyDown={onEditorKeyDown}
            aria-label={COPY.successTarget.directionLabel}
            className={`${typography.panelMeta} shrink-0 rounded border border-panel-border bg-surface px-1 py-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-info`}
            data-testid={`${testId}-direction`}
          >
            <option value="at_least">{COPY.successTarget.directionAtLeast}</option>
            <option value="at_most">{COPY.successTarget.directionAtMost}</option>
          </select>
          <input
            type="text"
            inputMode="decimal"
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onEditorKeyDown}
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
              /**
               * ⚠ SEEDED ON OPEN, BESIDE THE DRAFT, AND FOR THE SAME REASON.
               * Resetting it after a successful commit would have left it
               * sticky on the two paths that do not reach that line: Escape,
               * and the local write with no dispatcher. A ceiling stated once
               * would then be pre-selected on the next edit of a different
               * goal. Seeding both here is ONE place a fresh edit starts from,
               * so the paths cannot disagree (CLAUDE.md trap 12: one
               * derivation, not two that agree today).
               */
              setDirection(DEFAULT_TARGET_DIRECTION)
              // Captured at OPEN, checked at COMMIT — see `editScenarioId`.
              setEditScenarioId(authority.captureScenarioId())
            }}
            /* ⚠ `ml-auto` IS THE INTEGRATION, not decoration. Left-packed, the
               control sat immediately after the value and read as a third
               fragment of the same sentence — "Target · None set · Set a
               target". Pushed to the row's right edge it reads as the row's
               control, which is the shape every other row on this surface
               already has. */
            className={`${typography.panelMeta} ml-auto shrink-0 text-info underline underline-offset-2 hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-info rounded`}
            data-testid={`${testId}-edit`}
          >
            {shownText !== null ? COPY.successTarget.change : COPY.successTarget.set}
          </button>
        </>
      )}
    </div>
  )
}
