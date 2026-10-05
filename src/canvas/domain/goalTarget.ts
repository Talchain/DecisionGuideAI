/**
 * ⭐⭐ ONE OWNER FOR "WHAT IS THIS GOAL'S TARGET, AND WHOSE IS IT".
 *
 * ⚠ THIS EXISTS BECAUSE TWO SURFACES HAD ALREADY DIVERGED, AND THE DIVERGENCE
 * WAS VISIBLE TO THE USER. Witnessed on deployed `6e58c921`: the canvas goal
 * card rendered **"Target: 110%"** while the Reasoning panel's strip, six
 * inches to the right, rendered **"No target we can show"** — about the same
 * goal, on the same screen, at the same moment.
 *
 * The cause was two different sources under one idea:
 *   · `GoalNode` resolved the NODE's own fields — a user-set `success_threshold`
 *     first, then CEE's `goal_threshold_raw` — both in USER UNITS, with
 *     `goal_threshold_unit` beside them.
 *   · `SuccessTargetLine` read the canvas store's `goalThreshold`, which on that
 *     run carried the `normalised` tag and therefore could not be shown at all.
 *
 * Neither was wrong about its own field. The panel was simply asking a weaker
 * source. This module makes the NODE the answer to the question both surfaces
 * are actually asking, so a future divergence has to go through one function.
 *
 * ⚠ THE PRECEDENCE IS NOT A PREFERENCE — it is `computeSuccessState`'s, mirrored
 * deliberately, and `GoalNode`'s own comment records why: the badge once checked
 * `goal_threshold_raw` ONLY, a CEE-backfilled field a Hero-only commit never
 * populates, so the canvas kept saying "no target" after the user had set one.
 * A user-set value wins; the CEE-derived raw is the fallback.
 */
import { classifyObservedValueProvenance } from './valueProvenance'

/** The shape both call sites read from. Deliberately structural, not a class. */
export interface GoalTargetSource {
  threshold_source?: unknown
  success_threshold?: unknown
  goal_threshold_raw?: unknown
  goal_threshold_unit?: unknown
  /** `@talchain/schemas` 0.61.0: the frame the target is stated in — read only through `goalTargetChangeFrameOf`. */
  goal_threshold_frame?: unknown
  /** `@talchain/schemas` 0.61.0: the goal node's HELD COMPARATOR — read only through `goalHeldComparatorOf`. */
  goal_direction?: unknown
}

/**
 * ⭐ THE GOAL'S HELD COMPARATOR (`goal_direction`; CEE writes `>=` / `<=` / `>` / `<` — `graph-hash-contract`, 0.61.0).
 * It is what a change target's success BOUND is said from (UI #2287 review; DL ruling: the same authored input CEE
 * scores against, never the label and never a UI-only strict bit). Anything else — absent, the objective's sense
 * (`minimise`), a glyph — is `null`: no bound is said.
 */
export type GoalHeldComparator = '>=' | '<=' | '>' | '<'

export function goalHeldComparatorOf(value: unknown): GoalHeldComparator | null {
  return value === '>=' || value === '<=' || value === '>' || value === '<' ? value : null
}

/**
 * ⭐⭐ R1 S4-core — A TARGET STATED AS A CHANGE FROM TODAY (MG's goal half, #72 5879952291; `@talchain/schemas` 0.61.0
 * `goal_threshold_frame`).
 *
 * "Cut the cloud bill by 15%" arrives as `goal_threshold_frame: 'change_rel'`, `goal_threshold_raw: -0.15`: a FRACTION
 * of today's level, beside the METRIC's unit. `change_abs` is a change in the metric's own unit. Anything else —
 * `level`, legacy `delta`, absent, unknown — is `null`: a level, exactly as before. The frame is the node's statement
 * about ITS target, so it travels with whichever figure `resolveGoalTarget` picks.
 */
export type GoalTargetChangeFrame = 'change_abs' | 'change_rel'

export function goalTargetChangeFrameOf(frame: unknown): GoalTargetChangeFrame | null {
  return frame === 'change_abs' || frame === 'change_rel' ? frame : null
}

/**
 * ⛔ A frame that is PRESENT but not one this UI reads (AIQ 5880974047). The figure's meaning is then unknown, so it
 * fails CLOSED: no target resolves (no number is shown anywhere) and no level is written over it. Absent or `null` is
 * a level, exactly as before; `level`, legacy `delta` and the two change frames are read.
 */
export function goalTargetFrameIsUnread(frame: unknown): boolean {
  return frame !== undefined && frame !== null && frame !== 'level' && frame !== 'delta' &&
    goalTargetChangeFrameOf(frame) === null
}

export interface ResolvedGoalTarget {
  /** The figure, in the USER's units. Never a normalised 0-1. */
  raw: string | number
  /** The producer's unit string, when it sent one. */
  unit: string | undefined
  /**
   * Who put it there, AS A CARRIED FIELD SAYS — and nothing else.
   *
   *   · `user` — `threshold_source === 'user'` attests `success_threshold`
   *     (the only value CEE writes: `add-constraint.ts:1350`, schema
   *     `cee-v3.ts:258`, staging `85ce874c`). Licenses "Set by you".
   *   · `brief` — CEE's `goal_threshold_raw` WITH `threshold_source:
   *     'brief_extraction'`, which CEE writes only when the brief writes that
   *     figure in the goal's unit (`holdStatedGoalAttributes`,
   *     `figureTheUserWrote`; served on `823bc028`, 29 Sep). Licenses "From your
   *     brief". This is the carried field the note below waited for.
   *   · `unrecorded` — CEE's `goal_threshold_raw` with no carried source.
   *     Rendered "Source not recorded" on every surface.
   *
   * ⛔⛔ THIS WAS `'user' | 'brief'`, AND `brief` WAS A UI-ASSERTED ORIGIN
   * (DESIGN-GAP-v31 #22, A2). ANY `goal_threshold_raw` was stamped `brief`, so
   * the Reasoning strip and the goal inspector read "From brief" over
   * market-entry's 11 £M ARR — a figure its brief never states (it says £8M) —
   * while the goal card, reading the same node, said "no source". Nothing on
   * the node records whether CEE lifted the raw from the brief or inferred it,
   * and the node's `provenance` is about the NODE, not the number (trap 21). A
   * brief origin returns here the day a carried field states it.
   */
  source: 'user' | 'brief' | 'unrecorded'
  /**
   * A change from today (`goalTargetChangeFrameOf`); ABSENT for a level, so a level target resolves to exactly the
   * object it did before. Say `raw` through `formatGoalTarget(raw, unit, frame)`; test it with `frame != null`.
   */
  frame?: GoalTargetChangeFrame
}

/**
 * The goal's target as the user's own units, or `null` when the node carries
 * none.
 *
 * ⚠ RETURNS `null` FOR AN EMPTY STRING, not just for absence — `goal_threshold_raw`
 * arrives as `string | number` and a blank string is not a target. `GoalNode`
 * already guarded this with `String(x).trim() !== ''`; the guard moves here so
 * both callers get it.
 */
/**
 * ⭐ IS THE PRINTED TARGET THE FIGURE CEE STAMPED AS THE BRIEF'S? `threshold_source: 'brief_extraction'` (CEE
 * `holdStatedGoalAttributes`: the brief writes this figure in the goal's unit) — AND the frame prints that figure
 * itself: a level, or an absolute change ("up £85,000/month"). A RELATIVE change is not: its £ figure ("£36,000 / month
 * or less") comes from Olumi's reading of today's level, so "From your brief" must never sit on it (AIQ 5900578934,
 * cut-costs). Conservative there: "Source not recorded", never a false authorship.
 */
export function goalTargetStampedFromBrief(data: GoalTargetSource | null | undefined): boolean {
  return data?.threshold_source === 'brief_extraction' && data.goal_threshold_frame !== 'change_rel'
}

export function resolveGoalTarget(
  data: GoalTargetSource | null | undefined,
): ResolvedGoalTarget | null {
  if (!data) return null
  if (goalTargetFrameIsUnread(data.goal_threshold_frame)) return null
  const unit = typeof data.goal_threshold_unit === 'string' ? data.goal_threshold_unit : undefined
  const changeFrame = goalTargetChangeFrameOf(data.goal_threshold_frame)
  const frame = changeFrame === null ? {} : { frame: changeFrame }

  const userSet =
    data.threshold_source === 'user' &&
    (typeof data.success_threshold === 'number' || typeof data.success_threshold === 'string')
      ? (data.success_threshold as string | number)
      : null
  if (userSet != null && String(userSet).trim() !== '') {
    return { raw: userSet, unit, source: 'user', ...frame }
  }

  const ceeRaw =
    typeof data.goal_threshold_raw === 'number' || typeof data.goal_threshold_raw === 'string'
      ? (data.goal_threshold_raw as string | number)
      : null
  if (ceeRaw != null && String(ceeRaw).trim() !== '') {
    // `brief` ONLY on CEE's own stamp: it writes `threshold_source: 'brief_extraction'` when the brief writes this
    // figure in the goal's unit (`holdStatedGoalAttributes`). Without it nothing says where the figure came from.
    const source = goalTargetStampedFromBrief(data) ? 'brief' : 'unrecorded'
    return { raw: ceeRaw, unit, source, ...frame }
  }

  return null
}

/**
 * ⭐⭐⭐ THE GOAL'S DECLARED UNIT — *what scale is this goal measured on?*
 *
 * ⛔⛔ A THIRD QUESTION, AND IT HAD NO OWNER, SO TWO SURFACES BORROWED
 * `resolveGoalTarget` FOR IT AND BOTH WERE WRONG. That resolver answers *"what
 * TARGET is set?"*: it reads `goal_threshold_unit` on the way past and then
 * returns `null` when no raw value survives, discarding the unit with
 * everything else. A goal can perfectly well declare a unit and carry no
 * target — that is the state a reader is in when they set their first one —
 * and in that state both callers read `''`:
 *
 *   · `SuccessTargetLine` refused with *"This goal has no unit yet"* about a
 *     goal that had one, on the ONE journey the control exists for;
 *   · `ModelTabV2Panel.beginEdit` seeded the Unit box EMPTY, so the Model
 *     tab's own refusal (*"Add a unit — £, % or points"*) fired on the same
 *     goal.
 *
 * One expression each, CLAUDE.md trap 21, and the second was found only by
 * sweeping the first's siblings.
 *
 * ⚠ IT IS NOT A FALLBACK FOR `resolveGoalTarget().unit`, and must not be read
 * as one. Wherever a target exists the two are the SAME field, so this is
 * equivalent there and strictly better where one does not. A surface DISPLAYING
 * a target still asks the resolver — the unit it prints belongs to the figure
 * beside it, and printing a scale for a target that does not exist is a
 * different defect.
 */
export function declaredGoalUnit(data: GoalTargetSource | null | undefined): string {
  return typeof data?.goal_threshold_unit === 'string' ? data.goal_threshold_unit : ''
}

/**
 * ⭐⭐ TWO QUESTIONS THAT WORE ONE NAME: *does a target EXIST* and *what NUMBER
 * is it*. They are not the same question and they cannot share a predicate.
 *
 * ⚠ THIS IS NOT A NEW SPLIT. It is the one CEE-panel lane #1151 settled the
 * same night, after five rounds of tightening and widening a single coercion
 * each moved the harm rather than closing it: too permissive silences true
 * coaching (`Number('')` is `0`, a fabricated target that reads as a real one),
 * too strict denies `'200k'`, `'£11M'`, `'11%'` and `'≥ £1,000'` — real targets
 * a person stated, which no `number | null` can hold. A false positive that
 * DROPS a constraint and one that INVENTS one are opposite harms and cannot
 * share one window.
 *
 * ⚠⚠ #1151 CARRIES ITS OWN INLINE `stated` / `finite` COPIES INSIDE
 * `useResultsSectionData.ts`, WHICH THAT PR OWNS AND THIS ONE MUST NOT TOUCH.
 * These two exports are the SAME PREDICATES, derived deliberately to the same
 * semantics rather than invented in parallel. **Whichever of the two merges
 * second must collapse the inline memos onto these functions** — two
 * implementations of one rule is exactly the hand-maintained mirror that
 * produced the divergence they both exist to close.
 */

/**
 * EXISTENCE — *has anyone STATED a target?* Deliberately NOT numeric.
 *
 * A blank, whitespace, `null`, `undefined` and a non-finite number are not
 * targets. Everything else a human could have meant is. `NaN` and `±Infinity`
 * are excluded on purpose: nobody states them, and admitting them is how a
 * literal "NaN" reaches a screen.
 */
export function isStatedTargetValue(value: unknown): boolean {
  if (value == null) return false
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value === 'string') return value.trim() !== ''
  return false
}

/**
 * THE NUMBER — *what value may a numeric consumer use?* Strict on purpose.
 *
 * `null` means "NO NUMBER", never "no target" — the conflation that caused all
 * of this. A consumer doing arithmetic (the PLoT request boundary normalises
 * this scalar) must never receive a coerced `0` for a blank, `16` for `'0x10'`,
 * `1` for `true`, or a bare `NaN` for `'11%'`.
 *
 * The accepted grammar is what a stated decimal looks like: optionally signed,
 * optionally scientific. `Number()` alone is not that grammar — it accepts hex,
 * blanks, whitespace, `[]`, `false` and the words `Infinity`/`NaN`.
 */
export function statedTargetNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(trimmed)) return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * THE STATED TARGET, AS THE CARD RESOLVES IT — the value or `null`.
 *
 * ⚠ THIS IS `GoalNode`'s OWN CHAIN, MOVED HERE RATHER THAN RE-DERIVED. The card
 * resolved it inline: a user-set `success_threshold` wins (and only when
 * `threshold_source === 'user'` attests it), otherwise CEE's backfilled
 * `goal_threshold_raw`, with `isStatedTargetValue` deciding EXISTENCE at both
 * steps. Two copies of that chain is the hand-maintained mirror this module
 * exists to abolish, so `GoalNode` now calls this and holds none of its own.
 *
 * Differs from `resolveGoalTarget` in one respect that matters: this answers
 * EXISTENCE with `isStatedTargetValue`, so a `NaN` or an `Infinity` sitting in
 * `success_threshold` is NOT a stated target. `resolveGoalTarget` admits any
 * `typeof number` because its job is to carry provenance for a value that has
 * already been judged to exist.
 */
export function statedGoalTargetRaw(
  data: GoalTargetSource | null | undefined,
): string | number | null {
  if (!data) return null
  if (goalTargetFrameIsUnread(data.goal_threshold_frame)) return null
  const userThreshold = data.threshold_source === 'user' ? data.success_threshold : undefined
  const chosen = isStatedTargetValue(userThreshold) ? userThreshold : data.goal_threshold_raw
  return isStatedTargetValue(chosen) ? (chosen as string | number) : null
}

/**
 * ⭐⭐⭐ THE ADMISSION: *CAN THIS PERSON ADD A SUCCESS TARGET RIGHT NOW?*
 *
 * ⚠⚠ THIS EXISTS BECAUSE A CHIP PROMISED A ROUTE INTO A DEAD END. The goal
 * card's chip fires on the NODE (`statedGoalTargetRaw` above). It SAID
 * "Target not captured — add one" until #1172 round 3, which withdrew that
 * promise; it now states the fact alone. The dead end below is what the
 * promise pointed at. The inspector's `GoalPanel` decided whether
 * to render `GoalThresholdEditor` from the STORE SCALAR `goalThreshold`, which
 * `setCeeAnalysisReady` writes WITHOUT EVER TOUCHING THE NODE (store.ts) —
 * the node's target fields are written by OTHER paths entirely —
 * `backfillGoalThresholdOntoGoalNode` (CEE's raw, only when the payload carries
 * that key), `useInspectorMutations.setThreshold`, and
 * `setGoalThresholdAndUpdateNode` (the editor's own commit, which writes
 * `success_threshold` + `threshold_source: 'user'`). None of them is
 * `setCeeAnalysisReady`, which is the whole point: no write orders these two
 * scalars, so they diverge.
 *
 * So on a payload carrying `goal_threshold` and no raw, the two disagreed and
 * the user was told to add a target, then told one already existed
 * ("Success means reaching ≥ 0.8"), with nothing to press. `store.ts` records
 * that exact state having shipped.
 *
 * ── WHY THIS IS NOT "ALIGN THE TWO DEFAULTS" (CLAUDE.md trap 21) ───────────
 * The two authorities answer DIFFERENT questions and both answers are correct:
 *   the node scalar   "has a target been CAPTURED onto this goal?"
 *   the store scalar  "does the run pipeline hold a NUMBER for this goal?"
 * Making them agree would couple two things that were never the same question.
 * What the USER is asking is a third thing — *may I add one?* — and that is the
 * question this function is named for. Both consumers read THIS, so the chip's
 * promise and the editor's presence cannot drift:
 *
 *   `GoalNode`  renders the chip  iff `canCaptureGoalTarget(node.data)`
 *   `GoalPanel` renders the editor if `canCaptureGoalTarget(node.data)`
 *
 * The second is an `if`, not an `iff`, and deliberately: the panel ALSO keeps
 * rendering the editor when it has no number to display at all, which is the
 * pre-existing "From your brief" pre-population branch. The admission is a
 * SUFFICIENT condition, never overridden — so *admission yes ⟹ editor present*
 * holds by construction.
 *
 * ⚠⚠ AND THAT SENTENCE ENDED "…, which is exactly what makes the chip's promise
 * honest" UNTIL #1172 ROUND 3, WHERE MEASUREMENT REFUTED THE CONCLUSION. The
 * implication is true and was re-derived end-to-end through the real
 * `InspectorRouter`. It does not carry the conclusion, because **PRESENCE IS
 * NOT ANSWERABILITY**: the router wraps the panel body in an unconditional
 * `<fieldset disabled>`, so the editor this implication guarantees is rendered
 * INERT. The chip's promise was "add one", not "see one", and it has been
 * withdrawn (`GoalNode.tsx`); this module now guarantees exactly what it says
 * and nothing about honesty downstream of it.
 *
 * The lesson worth keeping: an implication proved BY CONSTRUCTION is still only
 * an implication about the thing it names. Whether that thing is any use to a
 * reader is a different question, one mount further out, and it needed a
 * different instrument to see — every guard in that PR mounted `GoalPanel`
 * directly, where the boundary does not exist.
 *
 * ⚠ IT TAKES THE NODE AND NOTHING ELSE, ON PURPOSE. Handing it the store
 * scalar would put the card back on the weaker source this module's header
 * exists to move it off, and would make the card's own chip depend on state the
 * card cannot see.
 */
export function canCaptureGoalTarget(data: GoalTargetSource | null | undefined): boolean {
  return statedGoalTargetRaw(data) == null
}

/**
 * ⭐ E1a — WHAT THE GOAL CARD NEEDS TO EDIT ITS TARGET IN PLACE, or `null` when the card must not.
 *
 * `proposeGoalTarget` takes a number, a unit and a direction, and its direction "has no default and must be stated by
 * whichever surface collects it" (`GoalNode.tsx`, `goalTargetRouteChannels`). The card collects only the number. So it
 * edits in place ONLY when the other two are already STATED on the goal:
 *  - a LEVEL target (a change target is not edited as a level; CEE refuses that write by name) with a finite number;
 *  - a declared unit;
 *  - a held comparator of exactly `>=` or `<=`. Those are `at_least` / `at_most` with no loss. A strict `>` / `<` has no
 *    `ConstraintType`, and sending `at_least` for `>` would silently change the bound, so it stays on the Model tab
 *    route, as does a goal with no held comparator at all.
 * Anything else returns `null` and the card keeps its existing route to the full editor.
 */
export interface GoalTargetInPlaceEdit {
  readonly value: number
  readonly unit: string
  readonly direction: 'at_least' | 'at_most'
}
export function goalTargetInPlaceEdit(data: GoalTargetSource | null | undefined): GoalTargetInPlaceEdit | null {
  const target = resolveGoalTarget(data)
  if (target === null || target.frame !== undefined) return null
  const value = typeof target.raw === 'number' ? target.raw : Number(String(target.raw).trim())
  if (!Number.isFinite(value)) return null
  const unit = declaredGoalUnit(data).trim()
  if (unit === '') return null
  const held = goalHeldComparatorOf(data?.goal_direction)
  // PoC (Paul 29 Sep 17:48Z, speed): "above"/"below" edit in place too. The wire's direction has no strict form, so
  // an edit restates "above 110%" as "at least 110%" — the same side of the target, stated inclusively.
  const direction = held === '>=' || held === '>' ? 'at_least' : held === '<=' || held === '<' ? 'at_most' : null
  if (direction === null) return null
  return { value, unit, direction }
}

/**
 * ⭐ TODAY'S LEVEL ON A CHANGE GOAL (cut-costs, served `09af9019`; AIQ 5902409861).
 *
 * "Target: down 20% from today" never said what today IS, so the journey's own correction ("£50k, not £45k") had
 * nothing on the graph to correct. A change goal now says its level, from ONE of two typed carriers, and nothing else:
 *   · `goal_level_reading` (CEE #2307): the number is the USER's, reading it as this goal's level today is Olumi's
 *     (subject rule 5895823531) → "Olumi's reading of ‘<the user's words>’". Wins whenever present: MG keeps a
 *     REFRESHED reading after a correction when the goal's subject differs from the user's words.
 *   · a user-stated level (`observedState.raw_value` with a user `source`, no reading) → "you said".
 * ⛔ The figure is `level` / `raw_value` in its OWN unit, never `value`/`baseline` (normalised: 0.8 on cut-costs), and
 * the unit must be the goal's, or nothing is said. A goal with neither carrier says nothing.
 *
 * ⭐ BEAT 1 (Canvas lane, 4 Oct 2026; DL 0df0e1 ruling, Paul's standing "user-entered business quantities remain
 * visible"): the user's OWN level now speaks on a LEVEL goal too, and a level read from the user's BRIEF speaks on
 * either frame — "Today: £120,000 / month — from your brief" (journey 4's MRR goal, `observed_state.raw_value`,
 * `source: brief_extraction`). This is AIQ 5902409861's own named follow-up ("an r1-shape goal (`source:
 * brief_extraction`, no reading) could show '— from your brief'"); its rule — "a level goal with NEITHER field → no
 * line" — is unchanged, as is the false-figure guard above. An Olumi-estimated level, an unread frame, or another
 * unit still says nothing. The typed reading stays a change-goal carrier, as it was.
 */
export interface GoalTodayLevel {
  readonly level: number
  readonly unit: string
  readonly basis: 'olumi_reading' | 'user_stated' | 'user_confirmed' | 'from_brief'
  readonly quote: string | null
}
export function goalTodayLevel(data: (GoalTargetSource & { goal_level_reading?: unknown; observedState?: unknown }) | null | undefined): GoalTodayLevel | null {
  if (!data || goalTargetFrameIsUnread(data.goal_threshold_frame)) return null
  const isChangeGoal = goalTargetChangeFrameOf(data.goal_threshold_frame) !== null
  const goalUnit = typeof data.goal_threshold_unit === 'string' ? data.goal_threshold_unit.trim() : ''
  if (goalUnit === '') return null
  const reading = data.goal_level_reading as { level?: unknown; level_unit?: unknown; quote?: unknown } | null | undefined
  if (isChangeGoal && reading && typeof reading === 'object') {
    const quote = typeof reading.quote === 'string' ? reading.quote.trim() : ''
    const unit = typeof reading.level_unit === 'string' ? reading.level_unit.trim() : ''
    if (typeof reading.level === 'number' && Number.isFinite(reading.level) && quote !== '' && unit === goalUnit) {
      return { level: reading.level, unit, basis: 'olumi_reading', quote }
    }
    return null // a reading is present but unreadable: fail closed, never fall through to another figure
  }
  const observed = data.observedState as { raw_value?: unknown; unit?: unknown; source?: unknown } | null | undefined
  const kind = classifyObservedValueProvenance(observed)?.kind
  const raw = typeof observed?.raw_value === 'number' ? observed.raw_value : NaN
  const unit = typeof observed?.unit === 'string' ? observed.unit.trim() : ''
  if ((kind === 'edited' || kind === 'confirmed' || kind === 'brief') && Number.isFinite(raw) && unit === goalUnit) {
    // AIQ 5902964135 nit: a `confirmed` source is one the user CONFIRMED, not one they typed.
    const basis = kind === 'confirmed' ? 'user_confirmed' : kind === 'brief' ? 'from_brief' : 'user_stated'
    return { level: raw, unit, basis, quote: null }
  }
  return null
}

/**
 * ⛔ ISL's `GOAL_DIRECTION_UNATTESTED` ("the model does not say which way your goal should go") IS FALSE when the goal
 * node HOLDS `>=` / `>` and its target is not a negative change: the largest-value ordering ISL used then IS the held
 * aim (AIQ 5901136155, 5902450527). Such a goal omits the entry; `<=`, `<`, an absent comparator, a negative or
 * unreadable change keep it (fail closed: the disclosure stays).
 */
export function goalDirectionWarningIsMoot(goal: GoalTargetSource | null | undefined): boolean {
  const held = goalHeldComparatorOf(goal?.goal_direction)
  if (held !== '>=' && held !== '>') return false
  if (goalTargetChangeFrameOf(goal?.goal_threshold_frame) !== null) {
    const raw = typeof goal?.goal_threshold_raw === 'number' ? goal.goal_threshold_raw : Number.NaN
    if (!Number.isFinite(raw) || raw < 0) return false
  }
  return true
}
export const GOAL_DIRECTION_UNATTESTED_CODE = 'GOAL_DIRECTION_UNATTESTED'

/**
 * ⭐ B′ (RT-10; Science 5999608477): the goal's own target now records its objective sense. Set to 'at most', CEE runs
 * the comparison lowest-first, so `GOAL_DIRECTION_UNATTESTED` finally has a correction a user can make. The correction is
 * TRUE only where the target line can make it: a goal with no target, or a LEVEL target in a frame this UI reads. A
 * change from today ("down 15%") is not edited by the target line (`SuccessTargetLine`; CEE refuses `goal_is_a_change`)
 * and CEE offers no correction for it (`goalDirectionCorrectableByTarget`, run-analysis.ts). So a change, an unread frame
 * and a missing goal all fail closed: no correction is offered.
 */
export function goalDirectionCorrectableByTarget(goal: GoalTargetSource | null | undefined): boolean {
  if (goal == null) return false
  if (goalTargetFrameIsUnread(goal.goal_threshold_frame)) return false
  return goalTargetChangeFrameOf(goal.goal_threshold_frame) === null
}
