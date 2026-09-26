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
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { ArrowUp, Pencil, Target } from 'lucide-react'
import { typography } from '../../../../styles/typography'
import { useCanvasStore } from '../../../../canvas/store'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'
import { VALUE_PROVENANCE_LABEL } from '../../../../canvas/domain/valueProvenance'
import {
  resolveGoalTarget,
  declaredGoalUnit,
  statedTargetNumber,
  type GoalTargetSource,
} from '../../../../canvas/domain/goalTarget'
import { formatGoalTarget } from '../../utils/formatGoalTarget'
import { useModelEditAuthority } from '../../../../canvas/hooks/useModelEditAuthority'
import type {
  SystemEventSendSettlement,
  SystemEventSendSettlementDetail,
} from '../../../../canvas/conversation/settleSystemEventSend'
import type { ConstraintType } from '../../../../v5/chipParameters'
import {
  CANONICAL_EDIT_AUTHORITY,
  hasServerGraphAuthority,
} from '../../../../canvas/mutations/mutationAuthority'
import { action, icon } from '../panelSurfaces'
import { openAskOlumi } from '../../coaching/askOlumiStore'
import { useShowToastSafe } from '../../../../canvas/ToastContext'
import { PanelIconButton } from '../PanelIconButton'
import { PanelActRow } from '../PanelActRow'

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

/**
 * ⭐ COPY FOR E2/E3/E4 OF THE EDITABILITY MAP, LOCAL TO THIS FILE ON PURPOSE.
 * `analysisNewCopy.ts` is shared across every Bundle in the reasoning-V2 split
 * and none of them may edit it in parallel — the map's own "Proposed build"
 * table says to put new copy in the owning component or its own file. Nothing
 * here duplicates a string that already lives in `COPY`; `COPY.modelStrip.cancelValue`
 * ("Cancel") is reused below rather than respelled.
 *
 * ⚠⚠ NONE OF THESE FOUR SENTENCES MAY CLAIM A SAVE. The AI ask and the words
 * route both leave the shared model untouched — see `sendWordsToOlumi` and
 * `openHelpDefineSuccess` — so their copy says "Olumi", never "saved" or "set".
 */
const ASK_DEFINE_SUCCESS_LABEL = 'Ask Olumi to help define success'
/** Prototype P:610, carried verbatim — words first, a number only if it is real. */
const ASK_DEFINE_SUCCESS_DRAFT =
  'Help me describe what success means for this situation, in words first. Only suggest a numerical target if it represents what I actually care about.'
const NOT_SURE_YET_LABEL = 'Not sure yet'
/** Prototype P:612's own notice for the identical act: nothing was invented. */
const NOT_SURE_YET_NOTICE = 'Success remains open. No target was invented.'
const WORDS_MODE_LABEL = 'In words'
const NUMBER_MODE_LABEL = 'A target'
const MODE_GROUP_LABEL = 'How would you recognise success?'
const WORDS_INPUT_LABEL = 'Your success criterion'
const WORDS_PLACEHOLDER = 'e.g. Faster delivery without more overtime'
const SEND_WORDS_LABEL = 'Discuss with Olumi'
/**
 * ⚠⚠ THE HONEST LABEL FOR E3. There is no words field on the goal node —
 * `goalTarget.ts` reads only `success_threshold`/`goal_threshold_raw` — so this
 * can only ever be a MESSAGE, never a save. Naming that here is what keeps the
 * toast from becoming the next "Target set on your model" lie this file's own
 * header records.
 */
const SUCCESS_WORDS_SENT_NOTICE =
  'Sent to Olumi as a message. There is no words field on the model yet, so this is not stored. See it in the conversation.'

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
  /**
   * ⭐ `no_unit` IS A FOURTH OUTCOME BECAUSE IT IS A DIFFERENT SENTENCE. The
   * other three say what happened to the target; this one says why nothing
   * could. Collapsing it into `not_encodable` is what left a reader looking at
   * "could not be applied" with no cause and no move — see `commit`.
   */
  /**
   * ⭐ `not_a_number` IS A FIFTH OUTCOME FOR THE SAME REASON `no_unit` IS A
   * FOURTH: it is a different sentence. An unparseable draft is the ONE refusal
   * where the reader has already acted and only needs to know the format — and
   * it was the whole of what a witnessed user got for typing the figure from
   * their own brief.
   */
  onCommitOutcome: (
    outcome: 'dispatched' | 'local_only' | 'not_encodable' | 'no_unit' | 'not_a_number',
  ) => void
  /**
   * ⭐ ADDITIVE, AND ONLY EVER FIRES BEHIND `GOAL_TARGET_EDIT_ENABLED`.
   * `authority.proposeGoalTarget`'s `add_constraint` path (the flag OFF) never
   * calls this — it has no send settlement to report, only the dispatch
   * outcome `onCommitOutcome` already carries. A caller that omits this prop
   * sees no behaviour change at all, which is the point: today's `dispatched`
   * sentence stays correct until the flag flips.
   */
  onSendSettled?: (
    settlement: SystemEventSendSettlement,
    detail: SystemEventSendSettlementDetail,
  ) => void
  testId: string
  /**
   * Whether this row draws its own top rule. Defaults to `true` — the
   * Inspector's `GoalPanel` keeps it, because it is the top-level element
   * there and needs the separation.
   *
   * ⚠ `false` FOR THE MODEL STRIP (design-audit-20260925, gaps SPACE-4 /
   * NARROW-8). Inside the strip this row already sits between
   * `ModelReviewTool`'s row above and the section rule below, so its own
   * `border-t` was a THIRD hairline in the same 101px band. The row still
   * needs SOME separation from whatever precedes it — hence `mt-1`, not 0.
   */
  divider?: boolean
  /**
   * ⭐ WHICH SURFACE'S ROW THIS IS. `inspector` (the default) is the Inspector's
   * goal control — `GoalPanel.tsx` — and is unchanged. `reasoning` is the V2
   * prototype's `successrow` + `goal-form` (`goalHTML()`, design audit B5):
   * "Success: …" or the question, icon-only ✎ then ✦, and the form UNDER the
   * row with a question label, a labelled number field and a help line.
   *
   * ⛔ ONLY THE PRESENTATION DIFFERS. Both variants call the same `commit`,
   * `sendWordsToOlumi` and `deferTarget`, so the write path cannot fork.
   */
  variant?: 'inspector' | 'reasoning'
}

/** V2 prototype's success row, verbatim, for a goal with no target. */
const SUCCESS_QUESTION = 'What would success look like?'

export function SuccessTargetLine({
  goalNodeId,
  onCommitOutcome,
  onSendSettled,
  testId,
  divider = true,
  variant = 'inspector',
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
  /** The reader's unit, offered only where the goal declares none. See `unit` below. */
  const [unitDraft, setUnitDraft] = useState('')
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
  /**
   * ⭐ E2/E3: WHICH WAY THE EDITOR IS CAPTURING SUCCESS — the prototype's own
   * `goalMode` (P:504, P:536), narrowed to what this control can actually
   * write. `number` is the default, not the prototype's `words`: this file's
   * whole identity is "the NUMBER beside the label" (see the header), and the
   * ONLY canonical carrier reachable from here is `proposeGoalTarget`. `words`
   * is offered because Paul's map calls for it, and it routes to Olumi rather
   * than pretending a save it cannot make (E3, MISSING-BACKEND today).
   */
  const [mode, setMode] = useState<'number' | 'words'>('number')
  const [wordsDraft, setWordsDraft] = useState('')
  /**
   * ⚠ `useShowToastSafe`, NOT `onCommitOutcome`. The three-outcome prop above
   * is a contract about a COMMIT to the shared model, and neither "not sure
   * yet" nor a words message is one — reusing it would either invent a fourth
   * outcome the prop's own doc does not name, or force a caller to map a
   * no-write act onto `dispatched | local_only | not_encodable`, none of which
   * is true of it. This control already shows its own toast where nothing was
   * committed, the same way `FactorValueControl`'s Cancel needs no outcome at
   * all.
   */
  const showToast = useShowToastSafe()
  const wordsInputId = useId()
  const formLabelId = useId()
  const numberInputId = useId()
  const unitInputId = useId()
  /**
   * Only the LATEST commit attempt may report a send settlement. The editor
   * closes on dispatch and can reopen while an earlier send is still pending, so
   * attempt A's late reply must not overwrite attempt B's status (pre-review
   * finding 5825017549). Same rule as `NodeValueEditor`'s `commitSeqRef`.
   */
  const attemptSeqRef = useRef(0)

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
   * ⭐⭐⭐ THE UNIT BELONGS TO THE GOAL, AND IS READ OFF THE GOAL.
   *
   * ⛔⛔ THIS LINE WAS `fromNode?.unit ?? ''`, AND THAT IS TRAP 21 IN ONE
   * EXPRESSION. `resolveGoalTarget` answers *"what TARGET is set?"* and
   * returns `null` when none is — it reads `goal_threshold_unit` on the way
   * past and then throws it away with everything else (`goalTarget.ts`). So on
   * the ONE journey this control exists for, a reader with no target clicking
   * "Set a target", the unit resolved to `''` and the panel refused with
   * *"this goal has no unit"* about a goal that HAD one. The docblock that
   * stood here called it "THE UNIT THE DISPATCH REQUIRES, FROM THE ONE
   * RESOLVER THIS FILE ALREADY READS" — one resolver, two questions, and the
   * borrowed one cannot answer this one.
   *
   * The node's own field answers it, whether or not a target exists.
   */
  const declaredUnit = declaredGoalUnit(goalData as GoalTargetSource | null)
  /**
   * ⭐ COLLECTED WHERE THE GOAL DECLARES NONE. `buildManualGoalTarget` refuses
   * an empty unit outright, so without one there is no send to report — and
   * the old remedy ("add a unit to the goal first") named a field that lives
   * inside the Model tab's goal-row editor and is unreachable from here.
   *
   * ⛔ THE DECLARED UNIT WINS AND IS NEVER OVERWRITTEN. Where CEE sent one the
   * box is not offered at all, so this surface cannot silently contradict the
   * producer — a worse defect than the refusal it replaces.
   */
  const unit = declaredUnit.trim() !== '' ? declaredUnit : unitDraft.trim()

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
    const attempt = ++attemptSeqRef.current
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
      /**
       * ⛔ NOT `not_encodable`. Folding this in gave a witnessed reader "That
       * target could not be applied, so nothing changed." for typing
       * `1.3 million` — the figure from their own brief, after the panel had
       * asked them for it. The draft is in hand and the only missing thing is
       * the format, which is the most actionable refusal on this surface.
       *
       * ⚠ A BLANK DRAFT IS NOT THIS. Nothing was typed, so there is no format
       * to correct and "I could not read that as a number" would be answering a
       * question the reader did not ask.
       */
      onCommitOutcome(typed === '' ? 'not_encodable' : 'not_a_number')
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
    /**
       * ⛔⛔ THE CAUSE IS KNOWN HERE AND WAS BEING THROWN AWAY.
       *
       * Witnessed on the deployed build (4ad71f6c, 15 Sep): the panel's own top
       * recommendation is "Set a target"; a reader sets one; the control answers
       * "That target could not be applied, so nothing changed." — no cause, no
       * move — and `Re-analyse` is disabled the whole time. The goal carried
       * `unit: null`.
       *
       * `buildManualGoalTarget` refuses an empty unit outright, so this is
       * decidable BEFORE the dispatch, from a value already in scope.
       *
       * ⛔ SCOPED TO THE DISPATCH BRANCH, AND THE SUITE TAUGHT ME THAT. My first
       * version sat above `if (canDispatch)` and blocked the LOCAL write too —
       * which needs no unit and would have succeeded. I had written the guard
       * against the failure mode I had just watched instead of against the
       * condition that actually requires a unit (CLAUDE.md trap 13d, in the fix
       * for a different instance of the same disease). It was
       * being folded into `not_encodable`, which also covers a target at or below
       * zero and a scenario that moved — three causes, one sentence, and the only
       * one a reader can act on is this one.
       *
       * ⚠ THE MODEL TAB ALREADY NAMES IT. `unproposableDraftReason` blocks the
       * same draft with "Add a unit" (`ModelRowView.tsx:1477`), and this file's
       * own header says so. One refusal, two surfaces, and only one of them told
       * the reader why — the estate's remedy-scoped-to-the-instance pattern, with
       * the sibling sitting in this file's comments the whole time.
       */
      if (unit.trim() === '') {
        onCommitOutcome('no_unit')
        return
      }
      const outcome = authority.proposeGoalTarget(typed, unit, editScenarioId, direction, {
        onSendSettled: onSendSettled
          ? (settlement, detail) => {
              if (attempt === attemptSeqRef.current) onSendSettled(settlement, detail)
            }
          : undefined,
      })
      onCommitOutcome(outcome)
      if (outcome === 'not_encodable') return
      setEditing(false)
      setDraft('')
      setUnitDraft('')
      return
    }

    /**
     * ⚠ NO DISPATCHER MOUNTED. The local write is genuinely all there is, and
     * it is still worth making - the canvas goal card and `computeSuccessState`
     * read it within the session. What must not happen is the old sentence: the
     * copy on this path states plainly that Olumi has not been told.
     */
    /**
     * ⚠ AND IT CARRIES THE UNIT. The store action has always accepted
     * `{ unit }` (`store.ts`: it stamps `goal_threshold_unit` when one is
     * given and leaves any existing one untouched when none is), and this call
     * was omitting it — so on the one path where nothing downstream could
     * recover the reader's unit, it was discarded.
     */
    if (unit !== '') setGoalThresholdAndUpdateNode(goalNodeId, parsed, { unit })
    else setGoalThresholdAndUpdateNode(goalNodeId, parsed)
    onCommitOutcome('local_only')
    setEditing(false)
    setDraft('')
    setUnitDraft('')
  }

  /**
   * ⭐ ONE CLOSE, FOR EVERY DOOR OUT OF THE EDITOR THAT WRITES NOTHING —
   * Escape, Cancel and "Not sure yet" all leave the same way. A second copy of
   * this reset is exactly the hand-maintained mirror CLAUDE.md trap 12 warns
   * about: the day one drops `setWordsDraft('')` the words field would carry
   * a stranger's half-typed sentence into the next factor's edit.
   */
  const closeEditor = () => {
    setEditing(false)
    setDraft('')
    setUnitDraft('')
    setWordsDraft('')
  }

  /**
   * E4: `data-action="goal-later"` (P:536, P:612). ⛔ WRITES NOTHING — the
   * product rule this control exists to honour. No `onCommitOutcome` call
   * either: that prop is a contract about a COMMIT, and deferring is the
   * absence of one.
   */
  const deferTarget = () => {
    closeEditor()
    showToast(NOT_SURE_YET_NOTICE)
  }

  /**
   * E2: the AI icon at rest (P:610). Offered whether or not the editor is
   * open, exactly as the prototype's `ask-goal` sits beside `goal` rather than
   * inside its form.
   */
  const openHelpDefineSuccess = () => {
    openAskOlumi({
      context: COPY.successTarget.label,
      draft: ASK_DEFINE_SUCCESS_DRAFT,
      label: ASK_DEFINE_SUCCESS_LABEL,
      targetId: goalNodeId,
      source: 'chip',
    })
  }

  /**
   * E3: success in words, interim chat route (map "Bundle B interim, LOW").
   *
   * ⛔⛔ THIS DOES NOT WRITE THE MODEL, AND MUST NEVER LOOK LIKE IT DOES. There
   * is no words field on a goal node — `goalTarget.ts` reads only
   * `success_threshold`/`goal_threshold_raw` — so the only honest move is the
   * one the prototype's OWN apply-path does not reach either (`applyProposal`'s
   * `p.mode==='words'` branch is prototype-only fixture code; nothing in this
   * estate answers it). Routing through `openAskOlumi` is the same shared
   * composer `E1`'s brief edit and `E7`'s belief edit already use for the
   * identical reason: a real send with no canonical store to land in.
   */
  const sendWordsToOlumi = () => {
    const typed = wordsDraft.trim()
    if (typed === '') return
    openAskOlumi({
      context: COPY.successTarget.label,
      draft: `This is what success would look like:\n${typed}`,
      label: ASK_DEFINE_SUCCESS_LABEL,
      targetId: goalNodeId,
      source: 'chip',
    })
    closeEditor()
    showToast(SUCCESS_WORDS_SENT_NOTICE)
  }

  /** Escape closes the words textarea exactly as it closes the number editor. */
  const onWordsKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      closeEditor()
    }
  }

  /**
   * ONE OPEN, FOR BOTH VARIANTS — the draft, the direction, the words field and
   * the scenario are seeded here and nowhere else.
   *
   * ⚠ `startMode` IS THE ONLY THING A VARIANT CHOOSES. The Inspector opens on
   * the number (this file's identity); the Reasoning tab opens as the V2
   * prototype does — "In words" first (`goalMode:'words'`, P:504) — unless a
   * target is already stated, in which case it opens on that number, seeded,
   * because the reader is editing a figure they can see.
   */
  const openEditor = (startMode: 'number' | 'words') => {
    setEditing(true)
    setMode(startMode)
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
    setWordsDraft('')
    // Captured at OPEN, checked at COMMIT — see `editScenarioId`.
    setEditScenarioId(authority.captureScenarioId())
  }

  if (variant === 'reasoning') {
    return (
      <ReasoningSuccessRow
        testId={testId}
        shownText={shownText}
        unexpressible={unexpressible}
        editing={editing}
        onToggleEditor={() => (editing ? closeEditor() : openEditor(shownText !== null ? 'number' : 'words'))}
        onAsk={openHelpDefineSuccess}
        form={
          editing ? (
            <ReasoningSuccessForm
              testId={testId}
              ids={{ formLabelId, wordsInputId, numberInputId, unitInputId }}
              mode={mode}
              onMode={setMode}
              wordsDraft={wordsDraft}
              onWordsDraft={setWordsDraft}
              onWordsKeyDown={onWordsKeyDown}
              onSendWords={sendWordsToOlumi}
              draft={draft}
              onDraft={setDraft}
              direction={direction}
              onDirection={setDirection}
              declaredUnit={declaredUnit}
              unitDraft={unitDraft}
              onUnitDraft={setUnitDraft}
              onEditorKeyDown={onEditorKeyDown}
              canDispatch={canDispatch}
              onCommit={commit}
              onDefer={deferTarget}
            />
          ) : null
        }
      />
    )
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
      className={
        divider
          ? 'flex items-baseline gap-1.5 border-t border-panel-border pt-2 mt-2'
          : 'flex items-baseline gap-1.5 mt-1'
      }
      data-testid={testId}
    >
      <Target className={`${icon('inline')} self-center shrink-0 text-text-light`} aria-hidden="true" />
      {/* V2 prototype: with no target the row IS the question ("What would
          success look like?"); the "Target" label only heads a stated value. */}
      {editing || shownText !== null || unexpressible ? (
        <span className={`${typography.panelMeta} text-text-light shrink-0`}>
          {COPY.successTarget.label}
        </span>
      ) : null}

      {editing ? (
        <span
          className="flex flex-col gap-1.5 min-w-0 flex-1"
          data-testid={`${testId}-editor`}
        >
          {/* ⭐ E2/E3: WHICH WAY THIS EDIT IS CAPTURED — the prototype's own
              radio-row (P:536), narrowed to what each arm can actually write.
              `number` reaches `proposeGoalTarget`, the one canonical carrier
              this file has; `words` reaches only the shared composer, because
              there is no words field on a goal node to write it to (E3 is
              MISSING-BACKEND — see `sendWordsToOlumi`). Defaults to `number`:
              this control's whole identity is "the NUMBER beside the label"
              (this file's own header), so an untouched open keeps doing
              exactly what it always did. */}
          <span
            role="radiogroup"
            aria-label={MODE_GROUP_LABEL}
            className="flex items-center gap-3"
          >
            <label className={`${typography.panelMeta} flex items-center gap-1 text-text-body`}>
              <input
                type="radio"
                name={`${testId}-goal-mode`}
                checked={mode === 'words'}
                onChange={() => setMode('words')}
                data-testid={`${testId}-mode-words`}
              />
              {WORDS_MODE_LABEL}
            </label>
            <label className={`${typography.panelMeta} flex items-center gap-1 text-text-body`}>
              <input
                type="radio"
                name={`${testId}-goal-mode`}
                checked={mode === 'number'}
                onChange={() => setMode('number')}
                data-testid={`${testId}-mode-number`}
              />
              {NUMBER_MODE_LABEL}
            </label>
          </span>

          {mode === 'number' ? (
            <span className="flex items-center gap-1.5 min-w-0 flex-1">
              {/*
                ⭐⭐ THE DIRECTION, IN WORDS, BEFORE THE NUMBER — so the row reads
                as the sentence it sends: "Target · at least · 12". It sits
                FIRST because that is the order of the message CEE receives and
                of the claim the reader is making, and it renders in its
                default state without any interaction, which is the whole
                point: a reader who never opens this menu has still been TOLD
                which way their number is about to be recorded. That is what
                the shipped control never did.

                ⚠ ONLY IN THE EDITOR, DELIBERATELY. The read-only row shows a
                target that came from the brief, through a path that recorded
                no direction at all. Painting a bound onto it would be
                fabricating provenance for a claim nobody made. The direction
                is stated where it is RECORDED.
              */}
              <select
                value={direction}
                onChange={(e) => setDirection(e.target.value as ConstraintType)}
                onKeyDown={onEditorKeyDown}
                aria-label={COPY.successTarget.directionLabel}
                className={`${typography.panelMeta} shrink-0 rounded-sm border border-field bg-surface px-1 py-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-info`}
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
                className={`${typography.panelMeta} min-w-0 flex-1 rounded-sm border border-field bg-surface px-1.5 py-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-info`}
                data-testid={`${testId}-input`}
              />
              {/* ⭐⭐ THE UNIT, WHERE THE GOAL DECLARES NONE. `proposeGoalTarget`
                  has always taken it and this control has always passed it; it
                  was passing `''` and reporting a refusal whose remedy lived on
                  another tab, inside a row editor the reader had no reason to
                  open.

                  ⛔ NOT RENDERED BESIDE A PRODUCER-SUPPLIED UNIT. `declaredUnit`,
                  never the resolved target's — a goal can declare a unit and
                  carry no target, and reading the unit off the target is the
                  defect this change exists to fix. A box here beside CEE's own
                  unit would be a second writer able to contradict it silently.

                  ⚠ ITS WIDTH IS A FLOOR, not a preference: the Model tab's own
                  unit field carries `w-24` because the row gate asserts every
                  input in that row is at least 90px, and a narrower twin here
                  would read as a different control for the same fact. */}
              {declaredUnit.trim() === '' ? (
                <input
                  type="text"
                  value={unitDraft}
                  onChange={(e) => setUnitDraft(e.target.value)}
                  onKeyDown={onEditorKeyDown}
                  aria-label={COPY.successTarget.unitInputLabel}
                  placeholder={COPY.successTarget.unitPlaceholder}
                  className={`${typography.panelMeta} w-24 shrink-0 rounded-sm border border-field bg-surface px-1.5 py-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-info`}
                  data-testid={`${testId}-unit`}
                />
              ) : null}
            </span>
          ) : (
            <span className="flex flex-col gap-1 min-w-0">
              {/* E3: interim chat route. ⚠ NO SAVE BUTTON HERE — the primary
                  act below is `sendWordsToOlumi`, and it opens the shared ask
                  composer rather than committing anything. */}
              <label htmlFor={wordsInputId} className="sr-only">
                {WORDS_INPUT_LABEL}
              </label>
              <textarea
                id={wordsInputId}
                value={wordsDraft}
                onChange={(e) => setWordsDraft(e.target.value)}
                onKeyDown={onWordsKeyDown}
                placeholder={WORDS_PLACEHOLDER}
                rows={2}
                className={`${typography.panelMeta} min-w-0 rounded-sm border border-field bg-surface px-1.5 py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-info`}
                data-testid={`${testId}-words-input`}
              />
            </span>
          )}

          {/* ⭐ `PanelActRow`, NOT A HAND-ROLLED ROW. `oneActRowLayout.spec.tsx`
              exists because this exact shape — a flex row of controls under a
              block of text — shipped at three different gaps in one file, one
              of them missing `flex-wrap` outright. This is a genuine row of
              acts (Save/Discuss, Cancel, Not sure yet), so it takes the shared
              layout rather than adding a fourth spelling. */}
          <PanelActRow testId={`${testId}-editor-actions`}>
            {mode === 'number' ? (
              <button
                type="button"
                onClick={commit}
                className={`${typography.panelBody} ${action('primary')}`}
                data-testid={`${testId}-save`}
              >
                {COPY.modelStrip.saveValue}
              </button>
            ) : (
              <button
                type="button"
                onClick={sendWordsToOlumi}
                disabled={wordsDraft.trim() === ''}
                className={`${typography.panelBody} ${action('primary')} disabled:opacity-50`}
                data-testid={`${testId}-words-send`}
              >
                {SEND_WORDS_LABEL}
              </button>
            )}
            {/* E2 fix note: "Add Cancel and 'Not sure yet' buttons to the
                editor." Two separate acts, deliberately: Cancel is the plain
                dismiss every other editor on this panel offers (`Escape`'s own
                behaviour, named); "Not sure yet" is E4's own act and carries
                its own notice (P:612) so a reader who explicitly declines a
                target is told that plainly, not left to infer it from a
                closed form. */}
            <button
              type="button"
              onClick={closeEditor}
              className={`${typography.panelBody} ${action('quiet')}`}
              data-testid={`${testId}-cancel`}
            >
              {COPY.modelStrip.cancelValue}
            </button>
            <button
              type="button"
              onClick={deferTarget}
              className={`${typography.panelBody} ${action('quiet')}`}
              data-testid={`${testId}-defer`}
            >
              {NOT_SURE_YET_LABEL}
            </button>
          </PanelActRow>
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
              className={
                unexpressible
                  ? `${typography.panelMeta} text-text-light`
                  : `${typography.panelBody} text-text-body flex-1 min-w-0`
              }
              data-testid={`${testId}-none`}
            >
              {/* ⚠ TWO DIFFERENT ABSENCES, TWO SENTENCES. "No target set" is a
                  fact about the MODEL; "we hold one we cannot show in your
                  units" is a fact about the VALUE. Collapsing them would tell a
                  user who set a target that they never did. */}
              {unexpressible ? COPY.successTarget.unexpressible : SUCCESS_QUESTION}
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
          {/* ⭐ E2: THE ICONS CLUSTER TOGETHER AND PUSH RIGHT AS ONE GROUP — the
              prototype's own `.icons` wrapper around `edit-goal`+`ask-goal`
              (P:536). `ml-auto` moved from the Set/Change button onto this
              wrapper so a second control could join it without either
              fighting the other for the row's right edge. */}
          <span className="ml-auto flex items-center gap-1 shrink-0">
            {/* E2: the AI act beside the primary one, at rest — matching where
                the prototype puts `ask-goal`, not folded inside the form.
                Visible text is `COPY.disclosure.askOlumi`, the estate's own
                existing spelling for this act (trap 12: reused, not
                reinvented); the sr-only span carries what makes THIS ask
                specific, the same two-tier pattern `detail-method` already
                uses below in `ModelStrip`. */}
            {/* ⚠ ICON-ONLY, as the prototype's `ai('ask-goal', …)`. The text
                button ("Work through with Olumi") made this group 223px wide
                and non-shrinking: measured on served `7f39c88b` at the 280px
                dock, it pushed the tab into a horizontal scroll (scrollWidth
                359 against 267). The accessible name keeps the specific ask. */}
            <PanelIconButton
              ai
              label={ASK_DEFINE_SUCCESS_LABEL}
              onClick={openHelpDefineSuccess}
              testId={`${testId}-ask`}
            />
            <button
              type="button"
              onClick={() => openEditor('number')}
              /**
               * ⭐⭐ THE ONE ACT CARRIES THE ONE PRIMARY — and until now nothing on
               * this panel did. Census of every control on the DEPLOYED build
               * (`6f90588f`, real run, guest, read off the DOM at rest):
               *
               *     25 controls · ZERO `ACTION_TIER.primary`
               *     the act ("Set a target") — an 11px underlined text link
               *     "Strengthen the reasoning" — aria-expanded="false"
               *
               * `ACTION_TIER.primary`'s own docblock reads *"THE ONE ACT. A filled
               * control, and the panel should carry at most one of them in view"*.
               * It had no consumer that renders. Paul's reading of the same
               * surface: *"nothing reads as primary"*.
               *
               * ⛔ SCOPED TO THE UNSET STATE, WHICH IS THE WHOLE DISCIPLINE. The
               * tier is worth nothing if every row claims it, so it applies ONLY
               * where the target is absent — the state in which this is the
               * panel's highest-value move and the producer's own top
               * recommendation. Once a target exists, "Change" drops to `quiet`.
               *
               * ⭐⭐ H4: NOT `inline` (BLUE, UNDERLINED) ANY MORE, ONCE A TARGET
               * EXISTS — the prototype's own quiet pencil row, not a link
               * (`Olumi_Reasoning_Prototype_V2.html`'s `.source-pill`-adjacent
               * edit glyph). `quiet` keeps the underline (an affordance costs no
               * contrast per `ACTION_TIER`'s own rule) but drops the info hue, so
               * a row that already states its value and source in plain text does
               * not also read as a hyperlink. The label stays — see
               * `successTargetLine.spec.tsx`'s `toHaveTextContent` pin — so the
               * pencil is additive, not a replacement for the accessible name.
               */
              className={`${typography.panelBody} shrink-0 inline-flex items-center gap-1 ${action('quiet')} ${
                shownText !== null ? '' : 'no-underline text-text-light hover:text-info'
              }`}
              aria-label={shownText !== null ? undefined : COPY.successTarget.set}
              title={shownText !== null ? undefined : COPY.successTarget.set}
              data-testid={`${testId}-edit`}
            >
              {/* V2 prototype: a quiet pencil. Unset, it is icon-only and its
                  accessible name is still "Set a target". */}
              <Pencil className={icon('inline')} aria-hidden={true} />
              {shownText !== null ? COPY.successTarget.change : null}
            </button>
          </span>
        </>
      )}
    </div>
  )
}

/**
 * ⭐ THE V2 PROTOTYPE'S `successrow` (`goalHTML()`, design audit B5): the target
 * glyph, ONE line of text, then ✎ and ✦ icon-only — ✎ FIRST, as the prototype
 * orders them (`btn('edit','goal',…)` before `ai('ask-goal',…)`).
 *
 * ⚠ NO "Target" LABEL, NO PROVENANCE WORD, NO "Change" TEXT. The prototype row
 * reads "Success: …" and nothing else; whose target it is stays on the
 * Inspector's row, which keeps `VALUE_PROVENANCE_LABEL`.
 *
 * ⚠⚠ THE FIGURE ITSELF IS UNTOUCHED. `shownText` is the same
 * `formatGoalTarget` output the Inspector prints; the prototype's
 * "+15% productivity" formatting (units and currency) is deferred behind the
 * pending producer scale ruling, so only the lead-in changes here.
 */
function ReasoningSuccessRow({
  testId,
  shownText,
  unexpressible,
  editing,
  onToggleEditor,
  onAsk,
  form,
}: {
  testId: string
  shownText: string | null
  unexpressible: boolean
  editing: boolean
  onToggleEditor: () => void
  onAsk: () => void
  form: ReactNode
}) {
  return (
    <div data-testid={testId} data-variant="reasoning" className="mt-[3px]">
      <div className="flex items-center gap-1.5 min-h-[26px]" data-testid={`${testId}-row`}>
        <Target className={`${icon('row')} shrink-0 text-text-light`} aria-hidden="true" />
        {shownText !== null ? (
          <span
            className={`${typography.panelBody} text-text-body flex-1 min-w-0 break-words`}
            data-testid={`${testId}-text`}
          >
            {COPY.successTarget.successLead}{' '}
            <span data-testid={`${testId}-value`}>{shownText}</span>
          </span>
        ) : (
          <span
            className={`${typography.panelBody} text-text-body flex-1 min-w-0 break-words`}
            data-testid={`${testId}-none`}
          >
            {/* The two absences stay two sentences — see the Inspector row. */}
            {unexpressible ? COPY.successTarget.unexpressible : SUCCESS_QUESTION}
          </span>
        )}
        <span className="flex items-center shrink-0">
          <PanelIconButton
            Icon={Pencil}
            label={COPY.successTarget.describeSuccess}
            expanded={editing}
            onClick={onToggleEditor}
            testId={`${testId}-edit`}
          />
          <PanelIconButton ai label={ASK_DEFINE_SUCCESS_LABEL} onClick={onAsk} testId={`${testId}-ask`} />
        </span>
      </div>
      {form}
    </div>
  )
}

/** The prototype's `.form` field chrome: 12px, the field border, 7px radius. */
const FIELD_CLASS = `${typography.panelBody} w-full min-w-0 rounded-[7px] border border-field bg-panel px-[9px] py-[7px] text-text-body focus:outline-none focus-visible:ring-2 focus-visible:ring-info`

/**
 * ⭐ THE V2 PROTOTYPE'S `goal-form`, UNDER THE ROW. Every control here is
 * wired to the SAME handler the Inspector's editor uses — the prop names are
 * the handlers, not new behaviour.
 *
 * ⚠⚠ THE SEND CONTROL SAYS WHAT HAPPENS, WHICH IS NOT ALWAYS THE PROTOTYPE'S
 * WORD:
 *   · a number with a dispatcher mounted IS sent (`proposeGoalTarget` →
 *     `add_constraint`, toast "Sent to Olumi…"), so it reads "Send to Olumi";
 *   · a number with no dispatcher is written on this screen only, so it reads
 *     "Save" — "Send to Olumi" over a write Olumi never sees would be the
 *     "Target set on your model" lie this file's header records;
 *   · words open the Olumi drawer with an EDITABLE draft and send nothing, so
 *     they keep today's "Discuss with Olumi" (PRODUCT DECISION, reported).
 *
 * ⚠ THE DIRECTION SELECT STAYS, THOUGH THE PROTOTYPE HAS NONE. Removing it
 * would record every target as a floor (`at_least`), a write-semantics change
 * this layout pass may not make (PRODUCT DECISION, reported).
 */
function ReasoningSuccessForm({
  testId,
  ids,
  mode,
  onMode,
  wordsDraft,
  onWordsDraft,
  onWordsKeyDown,
  onSendWords,
  draft,
  onDraft,
  direction,
  onDirection,
  declaredUnit,
  unitDraft,
  onUnitDraft,
  onEditorKeyDown,
  canDispatch,
  onCommit,
  onDefer,
}: {
  testId: string
  ids: { formLabelId: string; wordsInputId: string; numberInputId: string; unitInputId: string }
  mode: 'number' | 'words'
  onMode: (m: 'number' | 'words') => void
  wordsDraft: string
  onWordsDraft: (v: string) => void
  onWordsKeyDown: (e: KeyboardEvent) => void
  onSendWords: () => void
  draft: string
  onDraft: (v: string) => void
  direction: ConstraintType
  onDirection: (d: ConstraintType) => void
  declaredUnit: string
  unitDraft: string
  onUnitDraft: (v: string) => void
  onEditorKeyDown: (e: KeyboardEvent) => void
  canDispatch: boolean
  onCommit: () => void
  onDefer: () => void
}) {
  const hasDeclaredUnit = declaredUnit.trim() !== ''
  const sendLabel =
    mode === 'words' ? SEND_WORDS_LABEL : canDispatch ? COPY.successTarget.sendToOlumi : COPY.modelStrip.saveValue
  const sendDisabled = mode === 'words' && wordsDraft.trim() === ''
  return (
    <div className="grid gap-2 pt-[9px] pb-[5px]" data-testid={`${testId}-editor`}>
      {/* The prototype's `label.header-text` inside `.form` resolves to 12px
          at 600 (`.form label` sets the size). The panel scale has no 12px
          bold token and raw weights are banned, so the emphasis is carried
          semantically — `<strong>` — as this panel's other bold leads are. */}
      <span
        id={ids.formLabelId}
        className={`${typography.panelBody} text-text-header`}
        data-testid={`${testId}-form-label`}
      >
        <strong>{MODE_GROUP_LABEL}</strong>
      </span>
      <span role="radiogroup" aria-labelledby={ids.formLabelId} className="flex flex-wrap items-center gap-3">
        <label className={`${typography.panelBody} flex items-center gap-[5px] text-text-body`}>
          <input
            type="radio"
            name={`${testId}-goal-mode`}
            checked={mode === 'words'}
            onChange={() => onMode('words')}
            className="ml-[5px] mr-[3px]"
            data-testid={`${testId}-mode-words`}
          />
          {WORDS_MODE_LABEL}
        </label>
        <label className={`${typography.panelBody} flex items-center gap-[5px] text-text-body`}>
          <input
            type="radio"
            name={`${testId}-goal-mode`}
            checked={mode === 'number'}
            onChange={() => onMode('number')}
            className="ml-[5px] mr-[3px]"
            data-testid={`${testId}-mode-number`}
          />
          {NUMBER_MODE_LABEL}
        </label>
      </span>

      {mode === 'words' ? (
        <label htmlFor={ids.wordsInputId} className={`${typography.panelBody} grid gap-[5px] text-text-body`}>
          {WORDS_INPUT_LABEL}
          <textarea
            id={ids.wordsInputId}
            value={wordsDraft}
            onChange={(e) => onWordsDraft(e.target.value)}
            onKeyDown={onWordsKeyDown}
            placeholder={WORDS_PLACEHOLDER}
            rows={2}
            className={`${FIELD_CLASS} min-h-[64px] resize-y`}
            data-testid={`${testId}-words-input`}
          />
        </label>
      ) : (
        <>
          <div
            className={
              hasDeclaredUnit
                ? 'grid gap-[5px]'
                : 'grid grid-cols-[minmax(0,1fr)_minmax(68px,.65fr)] gap-2'
            }
          >
            <div className="grid gap-[5px] min-w-0">
              <label htmlFor={ids.numberInputId} className={`${typography.panelBody} text-text-body`}>
                {/* The goal's OWN unit, verbatim, beside the measure — the
                    prototype's "Productivity improvement (%)". */}
                {hasDeclaredUnit
                  ? `${COPY.successTarget.numberLabel} (${declaredUnit})`
                  : COPY.successTarget.numberLabel}
              </label>
              <span className="flex items-center gap-1.5 min-w-0">
                <select
                  value={direction}
                  onChange={(e) => onDirection(e.target.value as ConstraintType)}
                  onKeyDown={onEditorKeyDown}
                  aria-label={COPY.successTarget.directionLabel}
                  className={`${FIELD_CLASS} w-auto shrink-0`}
                  data-testid={`${testId}-direction`}
                >
                  <option value="at_least">{COPY.successTarget.directionAtLeast}</option>
                  <option value="at_most">{COPY.successTarget.directionAtMost}</option>
                </select>
                <input
                  id={ids.numberInputId}
                  type="text"
                  inputMode="decimal"
                  autoFocus
                  value={draft}
                  onChange={(e) => onDraft(e.target.value)}
                  onKeyDown={onEditorKeyDown}
                  className={FIELD_CLASS}
                  data-testid={`${testId}-input`}
                />
              </span>
            </div>
            {hasDeclaredUnit ? null : (
              <div className="grid gap-[5px] min-w-0 content-start">
                <label htmlFor={ids.unitInputId} className={`${typography.panelBody} text-text-body`}>
                  {COPY.successTarget.unitLabel}
                </label>
                <input
                  id={ids.unitInputId}
                  type="text"
                  value={unitDraft}
                  onChange={(e) => onUnitDraft(e.target.value)}
                  onKeyDown={onEditorKeyDown}
                  placeholder={COPY.successTarget.unitPlaceholder}
                  className={FIELD_CLASS}
                  data-testid={`${testId}-unit`}
                />
              </div>
            )}
          </div>
          <span className={`${typography.panelMeta} text-text-light`} data-testid={`${testId}-help`}>
            {canDispatch ? COPY.successTarget.helpDispatch : COPY.successTarget.helpLocalOnly}
          </span>
        </>
      )}

      <div className="flex items-center justify-between gap-2 mt-0.5">
        <button
          type="button"
          onClick={onDefer}
          className={`${typography.panelBody} inline-flex items-center py-1 min-h-[28px] text-info hover:text-info-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-info`}
          data-testid={`${testId}-defer`}
        >
          {NOT_SURE_YET_LABEL}
        </button>
        <span className={`${typography.panelMeta} ml-auto flex items-center gap-[7px] text-text-light`}>
          <span aria-hidden="true">{sendLabel}</span>
          <button
            type="button"
            onClick={mode === 'words' ? onSendWords : onCommit}
            disabled={sendDisabled}
            aria-label={sendLabel}
            title={sendLabel}
            className="inline-flex shrink-0 items-center justify-center w-[29px] h-[29px] rounded-full bg-info text-text-on-color hover:bg-info-hover disabled:opacity-40 disabled:cursor-default focus:outline-none focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-offset-2"
            data-testid={mode === 'words' ? `${testId}-words-send` : `${testId}-save`}
          >
            <ArrowUp className={icon('section')} aria-hidden="true" />
          </button>
        </span>
      </div>
    </div>
  )
}
