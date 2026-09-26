/**
 * Goal node component — v3 wireframe
 *
 * Layer 1 (always visible):
 *  - No threshold (either phase): one compact "Target not captured" status chip
 *    that opens this node's inspector. R5/L-47: no instructional prose, no full
 *    buttons on the node. (It read "Target not captured — add one" until #1172
 *    round 3 withdrew the repair clause; see the chip's own block below for
 *    why the destination could not keep that promise.)
 *  - With threshold: `GOAL_TARGET_PREFIX` + value ("Target: 15%") + provenance
 *    icon. The SAME string is this card's reduced line below the legibility
 *    floor — see `targetLine`, which is the only place it is built. Beside it,
 *    in Standard, the user-stated limits as compact boundary pills
 *    (`goalLimitPills`; NODE-ANATOMY v3.2, ED #63 choice 2), full sentence on
 *    hover/focus. Never beside the no-target chip (one pill in that state).
 *  - Post-analysis with threshold: achievement probability (danger if <10%), actionable guidance
 *    — only when the run PRODUCED one; no Chance row otherwise (contract v3.1 goal anatomy, gap U3)
 *  - No risks chip (always)
 *  - No rail source icon (contract v3.1 pt 1, gap U8)
 *
 * Layer 2 (popover in Standard / inline in Detailed):
 *  - "From your brief" label notice, when the label is an unconfirmed brief extract
 *  - Stability bar + percentage
 *  - Constraint badges (if any)
 *  - Chips: "Why is this so low?", "Is my target realistic?"
 *
 * No ExpertOverlay. No MetricPills.
 */
import { memo, useMemo } from 'react'
import Tooltip from '../../components/Tooltip'
import {
  GOAL_LABEL_FROM_BRIEF_COPY,
  GOAL_LABEL_FROM_BRIEF_TESTID,
  goalLabelIsUnconfirmedBriefExtract,
} from '../domain/goalLabelProvenance'
import type { NodeProps } from '@xyflow/react'
import { BaseNode } from './BaseNode'
import { NODE_REGISTRY } from '../domain/nodes'
import { useNodeDisplayMetadata } from '../hooks/useNodeDisplayMetadata'
import { useCanvasStore } from '../store'
import { typography } from '../../styles/typography'
import { LAST_RUN_PREFIX, METRIC_NOUN } from './shared/metricVocabulary'
import { formatGoalTarget } from '../../components/results/utils/formatGoalTarget'
import {
  canCaptureGoalTarget,
  statedGoalTargetRaw,
  type GoalTargetSource,
} from '../domain/goalTarget'
import { GOAL_FIT_BASIS_CAVEAT_COPY } from '../../components/results/utils/goalFitBasisCaveatCopy'
import {
  CANONICAL_EDIT_AUTHORITY,
  hasServerGraphAuthority,
} from '../mutations/mutationAuthority'
import { GOAL_ANCHOR_COPY } from '../../components/results/utils/goalAnchorCopy'
import { basisWithholdsPossessive } from '../../components/results/utils/selectGoalProbability'
import { readInferenceWarnings } from '../../components/results/utils/readInferenceWarnings'
import { DataBar, type DataBarColour } from '../ui/shared/DataBar'
import { getStabilityClassification } from '../../lib/stability'
import { NodeMetricRow, NodePopover, ScienceIcon } from './shared'
import { CoachingChipRow } from './coaching/CoachingChipRow'
import { resolveNodeCoaching } from './coaching/resolveNodeCoaching'
import { useScienceIcons } from '../hooks/useScienceIcons'
import { useGuidanceStore } from '../stores/guidanceStore'
import { usePopoverHover } from '../hooks/usePopoverHover'
import { openNodeInspector } from './shared/openNodeInspector'
import { openModelValueEditor } from './shared/openModelValueEditor'
import { goalTargetSourceMark, ValueSourceMark } from './shared/valueSourceMark'
import { useHasAnyRealProbability } from '../ui/inspector-v2/useAnalysisResults'
import { useAnalysisTrust } from '../hooks/useAnalysisTrust'
import { goalConstraintShortText, goalConstraintText } from '../utils/goalConstraintText'
import type { CEEGoalConstraint } from '../../adapters/cee/types'
import { formatGoalProbability } from '../../components/results/utils/displayFloors'
import { NODE_TOOLTIP_DELAY_MS } from './shared/nodeTooltip'

/**
 * ⭐ THE TWO STRINGS THIS CARD USES TO STATE ITS TARGET, DECLARED ONCE.
 *
 * Both are rendered at FULL ZOOM (the body line and the no-target chip) and
 * both are re-used verbatim as the card's reduced line below the legibility
 * floor. They are module constants rather than inline literals for one reason:
 * a low-zoom line that is a second hand-written copy of a full-zoom string will
 * drift, and it already did — the colon was dropped in the copy, so one goal
 * read `Target: 15%` and `Target 15%` one zoom step apart, with the
 * contradicting body hidden.
 */
const GOAL_TARGET_PREFIX = 'Target:'

/**
 * ⭐⭐⭐ THE NO-TARGET CHIP ANSWERS A QUESTION ABOUT THE MODEL, AND MUST NOT
 * PHRASE ITS ANSWER AS A VERDICT ON THE READER.
 *
 * ⚠⚠ WITNESSED ON A REAL USER'S SCREEN, 3 Sep 2026. This card rendered its
 * title and this chip ~20px apart:
 *
 *     title   Reach £30k MRR Within 18 Months
 *     chip    No target set
 *
 * The target is IN THE TITLE. The anchor element of the whole model
 * contradicted itself in one glance — and the chip was not lying about the
 * data: the compiled model behind it carried `goal_threshold: null` and
 * `goal_constraints: null` (real 19-turn session bundle,
 * `Talchain/olumi-programme-docs` @ `b15bf3f`,
 * `artefacts/manual-test-2026-09-03/`). Extraction is a separate defect with a
 * separate owner; nothing here tries to fix it.
 *
 * ── TWO QUESTIONS UNDER ONE SENTENCE (CLAUDE.md trap 21) ───────────────────
 *   what this card computes   "does the MODEL hold a threshold?"   → no
 *   what the reader hears     "did I state a target?"              → you didn't
 *
 * The remedy trap 21 prescribes is to NAME THEM APART, not to align them and
 * not to hide the chip. So the chip keeps answering the first question and
 * moves its subject onto Olumi's CAPTURE rather than the user's statement.
 * `Target not captured` is equally honest for the user who genuinely never
 * stated one — nothing was captured either way — and it stops accusing the one
 * who did.
 *
 * ⚠ THE SIBLING SURFACE IS DELIBERATELY NOT TOUCHED. The Reasoning panel's
 * model strip says `Target · None set` (`analysisNewCopy.ts`), adjudicated
 * there as a fact about the model under a `Target` caption that frames it as a
 * readout. This chip has no such frame. The two are not a hand-copied pair and
 * neither contradicts the other — both say the model holds nothing.
 *
 * ── ⚠⚠ AND THE REPAIR CLAUSE IS WITHDRAWN — IT NAMED A ROUTE THAT IS INERT ──
 * THIS BLOCK SAID, UNTIL #1172 ROUND 3: *"the inspector's goal panel renders
 * `GoalThresholdEditor` on exactly this null-target branch, … because copy that
 * promises an affordance is honest only while the affordance answers."* The
 * BAR is right and is kept. The CLAIM THAT IT WAS MET WAS FALSE, and the reason
 * is one layer below where the panel was being read.
 *
 * `InspectorRouter` wraps the whole panel body in an unconditional
 * `<fieldset disabled data-authority="disabled">`, beneath a notice reading
 * "The other fields here are read-only for now because those changes can't yet
 * be saved." `GoalThresholdEditor` renders `<input id="goal-threshold">`, a
 * form-associated element, which that fieldset inerts. So the journey the copy
 * promised was: *Target not captured — add one* → click → *those changes can't
 * yet be saved* → a DISABLED input. The editor is present; it does not answer.
 *
 * ⚠ AND THE OBVIOUS REMEDY IS THE WORSE LIE, WHICH IS WHY THE COPY MOVED AND
 * THE BOUNDARY DID NOT. Carving this editor out of the fieldset — as
 * `inspector-rename-trigger` already is — fails the precondition that carve-out
 * rests on. The rename is outside because it SAVES TO THE SHARED MODEL:
 * `updateNodeLabel` records a durable `structural_rename` intent that
 * `useStructuralRenameEvents` puts on the wire. `setGoalThresholdAndUpdateNode`
 * has no such carrier — `WIRE_SYSTEM_EVENT_TYPES` (`conversation/types.ts`) is
 * the single source for the entire UI→CEE vocabulary and none of its eleven
 * members carries a goal threshold, so the write reaches CEE only as a
 * `direct_graph_edit` NOTIFICATION ('ack_and_commit': a turn row and NO graph
 * write). It survives a reload in THIS browser (autosave hashes
 * `success_threshold` by default — #457) and it does not reach the shared
 * model. Carving it out would also stamp `threshold_source: 'user'` on the node
 * that drives the PLoT request, attesting a target the reader never stated.
 *
 * So the chip now states the FACT and says only what the click actually does.
 *
 * ⭐⭐⭐ THE DEFERRAL ABOVE IS NOW DISCHARGED, AND ONLY BECAUSE THE MEASUREMENT
 * WAS TAKEN. It read: *"Naming a live route instead (the Model tab's own goal
 * section) is the better answer and is deliberately NOT guessed at here: which
 * of those surfaces is mounted under the deployed flag posture is UNMEASURED,
 * and a third unwitnessed promise is the defect, not the fix."* That was exactly
 * right, and it named the one thing standing in the way.
 *
 * MEASURED 20 Sep 2026 on DEPLOYED `7ec3fed2`, guest session, by driving the
 * product — not by reading this tree:
 *
 *   Model tab -> Goal group -> the goal row's value cell (`Not set`, a real
 *   `<button>`, `disabled: false`) -> opens THREE enabled controls:
 *     · "New value for <goal>"            text
 *     · "Target bound for <goal>"         select — at least | at most
 *     · "Target unit for <goal>"          text
 *
 * That is `ModelTabV2Panel`'s goal editor, whose `confirmEdit` calls
 * `proposeGoalTarget` -> a TYPED `add_constraint` through CEE's validated
 * proposal path. It is `modelGoalMinimumTarget`, which is `'server_graph'`.
 * So the route is mounted, operable, and receipt-bearing on the build a reader
 * is looking at while this chip is on screen.
 *
 * ⚠ A SECOND LIVE ROUTE WAS WITNESSED IN THE SAME SESSION and is deliberately
 * NOT named here: the Reasoning tab's "Set a target" (enabled; opens "Success
 * target for this goal" + "Unit for this success target"). One destination
 * vocabulary, not two — `pre-analysis-v3/constants.ts` `successAuthorityNote`
 * already names the Model tab for this same fact, and a chip that named a third
 * surface would be the trap-21 split this file exists to avoid.
 *
 * ⛔ AND THE CLAUSE IS DERIVED, NOT WRITTEN. It is gated on
 * `hasServerGraphAuthority(CANONICAL_EDIT_AUTHORITY.modelGoalMinimumTarget)`,
 * so if that authority ever regresses the sentence DISAPPEARS rather than
 * becoming the fourth unwitnessed promise. A mutant flipping that key to
 * `'disabled'` REDs.
 *
 * ⚠ WHAT IS STILL WITHDRAWN, AND STAYS WITHDRAWN: a repair promise pointing at
 * THIS GOAL'S DETAILS. `AUTHORITY_OWNING_PANELS` (`InspectorRouter`) is
 * `option | factor-controllable | factor-external` — `goal` IS NOT IN IT, so
 * `GoalPanel` keeps the blanket `<fieldset disabled>` byte-for-byte, and
 * `GoalThresholdEditor` writes only `setGoalThresholdAndUpdateNode` with no
 * wire carrier. The fence premise has expired for the EDGE panel and for the
 * two factor panels; it has NOT expired here, and I checked the set rather than
 * generalising the other two strikes onto it.
 *
 * `goalChipPromiseVsDestination.spec.tsx` holds the rule, and holds it as a
 * CONDITIONAL: it derives the editor's inertness through the REAL router and
 * bans a repair promise only while that holds. Make the editor answer and its
 * first assertion REDs, which is the invitation to restore the promise
 * deliberately rather than a ban that quietly outlives its reason.
 *
 * ── WHY A COMPOSITION AND NOT THREE HAND-WRITTEN STRINGS ───────────────────
 * The promise had been written out THREE times — visible text, `aria-label`
 * (two arms) and `title` (two arms) — so withdrawing it from the chip alone
 * would have left it in the accessible name and the tooltip, where nobody
 * greps. Every channel a reader can reach is now DERIVED from one function, and
 * the rendered chip is asserted equal to it, so the next edit cannot move one
 * and miss the others.
 */
/** The fact, and the reduced line below the legibility floor. */
export const GOAL_NO_TARGET_STATE = 'Target not captured'

/**
 * WHERE A TARGET CAN ACTUALLY BE CAPTURED — one name, the estate's existing one.
 *
 * `pre-analysis-v3/constants.ts` `successAuthorityNote` already sends a reader
 * to the Model tab for this same fact. Spelling it a second way here would be
 * two names for one destination, which is what this file's own history is
 * about.
 */
export const GOAL_TARGET_LIVE_ROUTE = 'the Model tab'

/**
 * Whether that route can take the write, asked of the authority rather than
 * asserted. The clause below is composed from THIS, so a regression deletes the
 * sentence instead of leaving it lying.
 */
export const GOAL_TARGET_ROUTE_IS_LIVE = hasServerGraphAuthority(
  CANONICAL_EDIT_AUTHORITY.modelGoalMinimumTarget,
)

/** The control's identity, so a probe binds to it rather than to its wording. */
export const GOAL_TARGET_ROUTE_TESTID = 'goal-target-route'

/**
 * ⭐ THE CONTRACT'S STATE WORD, SPELLED ONCE FOR THIS CARD (contract v3.1
 * `.node .state-word`; deltas ANC-06, PILL-04, PILL-12).
 *
 * `border:1px solid #DDC6AB; border-radius:99px; padding:1px 6px;
 * color:var(--ink); background:white` — a NEUTRAL state word, not a warning.
 * Translated to DS v5 tokens: `bg-panel`, `text-text-body`, and
 * `border-warning-ink/40` (#D2BEAC over the panel, the nearest token to the
 * contract's #DDC6AB — the same token the corner "Needs input" pill's PILL-01
 * anatomy uses, so the two members of one fact family cannot look like two
 * different kinds of thing). No warning FILL and no full-strength ink ring.
 *
 * Both goal pills read these — the no-target chip and Layer 2's "Marginal" —
 * so they cannot drift apart inside this file. ⚠ When `StatusPill` exports
 * the shared `STATE_WORD_CLASSES`/`STATE_WORD_STYLE` (PILL-01, another file's
 * owner), this pair should be replaced by an import of those.
 *
 * ⚠ THE BORDER IS A FIXED 1px, NOT COUNTER-SCALED, DELIBERATELY. The padding
 * is in `em`, so it scales with the counter-scaled type; a counter-scaled
 * border as well would make the chip 0.75px TALLER than before at the label
 * bound (scale 2), which is the height the layout reserves. With a fixed
 * border the chip is shorter at every scale (18.5 vs 21.1px at 1x, 35.0 vs
 * 36.25px at 2x), so the goal card never grows.
 */
export const GOAL_STATE_WORD_CLASSES = `${typography.edgeLabel} inline-flex items-center gap-1 whitespace-nowrap font-normal text-text-body bg-panel border border-solid border-warning-ink/40 rounded-full`
export const GOAL_STATE_WORD_STYLE = { padding: '0.1em 0.6em', lineHeight: 1.3 } as const

/**
 * ⭐ THE USER-STATED LIMITS, AS BOUNDARY PILLS ON THE TARGET ROW —
 * NODE-ANATOMY v3.2 row "Goal" (`Target: <amount> <mark>` + boundary pill(s)
 * `Churn < 7%`; "user-stated limits live HERE") and ED #63 5806207128 /
 * 5806266691 choice 2 ("limits on the Goal, not repeated on the Factor at
 * rest"; "Full constraint detail remains reachable on focus/inspector").
 *
 * ONE derivation for the resting face: the pill's visible text is the SAME
 * `goalConstraintText` sentence Layer 2's `goal-constraint-badge` prints, so
 * the resting pill and its details can never name a limit two ways. `name` is
 * the full statement — hover, keyboard focus and the accessible name — and says
 * whose limit it is only where the constraint's own provenance says so:
 * `explicit` (the brief or a panel edit) → "Limit you set"; anything else →
 * "Limit", with `goalConstraintText`'s own " · Inferred limit" / " · Proxy
 * limit" origin already in the text. No satisfaction figure: that is a run
 * finding about the limit, and it stays in Layer 2.
 *
 * `key` is the constraint's own identity (`constraint_id`, then `id`), so a
 * probe binds to THIS limit; the list index is the last resort for a legacy
 * constraint that carries neither.
 */
export function goalLimitPills(
  constraints: readonly CEEGoalConstraint[] | null | undefined,
  nodes: readonly { id: string; data?: unknown }[],
): Array<{ key: string; text: string; name: string }> {
  if (!constraints?.length) return []
  return constraints.map((c, i) => {
    // v3.1 `.pill.mini` (DESIGN-GAP-v31 #23): the pill SHOWS the short form
    // ("Churn <4%", origin suffix kept); its accessible name and tooltip keep
    // the full sentence, so the short form loses nothing.
    const full = goalConstraintText(c, nodes)
    return {
      key: c.constraint_id ?? c.id ?? String(i),
      text: goalConstraintShortText(c, nodes),
      name: `${c.provenance === 'explicit' ? 'Limit you set' : 'Limit'}: ${full}`,
    }
  })
}

/**
 * ⭐⭐⭐ A TARGET THAT IS SET GETS THE SAME ROUTE AS A TARGET THAT IS MISSING.
 *
 * Measured on served `1f77130d`, the canonical pricing board: the goal card
 * rendered `Target: 110%` as a plain `<div>` — no affordance, no reason — and
 * it was one of 9 of 15 nodes in that state. `goalNoTargetChannels` above had
 * already solved the harder half of this for the ABSENT case; the SET case was
 * simply never given the same clause, so the commonest thing a reader wants to
 * do with a target they can see — change it — had no visible route at all.
 *
 * ⚠ THE SAME DERIVATION, DELIBERATELY. This returns `null` rather than a
 * different sentence when the carrier is not live, so a regression removes the
 * CONTROL and not merely its wording: an affordance that opens a destination
 * which cannot save is the "unwitnessed promise" this file's history is about.
 *
 * ⚠ AND IT PROMISES NAVIGATION, WHICH IS ALL IT DOES. `openModelValueEditor`'s
 * header states the property: *"NAVIGATION IS NOT A MUTATION."* The write
 * itself belongs to `proposeGoalTarget`, whose `direction` has no default and
 * must be stated by whichever surface collects it — the Model tab's goal editor
 * does, with an explicit "at least | at most" select, and this card does not
 * and must not.
 */
export function goalTargetRouteChannels({
  targetLine,
  routeIsLive = GOAL_TARGET_ROUTE_IS_LIVE,
  sourceLabel,
}: {
  /** What the card already renders. Quoted back so the two cannot drift. */
  targetLine: string
  /**
   * Where the target came from, as the visible mark beside it says
   * (`goalTargetSourceMark`). Spoken and hovered too, so the mark is never
   * sight-only (Paul 23 Sep contract feedback points 1 and 12).
   */
  sourceLabel?: string
  /**
   * ⚠ INJECTABLE FOR THE SAME ONE REASON `goalNoTargetChannels` is: so both
   * branches are reached BY EXECUTION. Asserting them behind
   * `if (GOAL_TARGET_ROUTE_IS_LIVE)` is a tautology that passes whichever way
   * the flag falls, and a mutant regressing the key survived exactly that once.
   */
  routeIsLive?: boolean
}): { 'aria-label': string; title: string } | null {
  if (!routeIsLive) return null
  const source = sourceLabel ? ` (${sourceLabel})` : ''
  return {
    'aria-label': `${targetLine}${source} — change it in ${GOAL_TARGET_LIVE_ROUTE}`,
    title: `${sourceLabel ? `${sourceLabel}. ` : ''}Change this target in ${GOAL_TARGET_LIVE_ROUTE}.`,
  }
}

/**
 * Every channel a reader can reach the no-target chip through.
 *
 * ⚠ SAYS WHAT THE CLICK DOES, NOT WHAT THE READER CAN THEN FIX. "Open its
 * details" is a claim about behaviour that holds; "to add one" was a claim
 * about the destination that does not.
 *
 * ⭐ AND SINCE 20 Sep 2026 IT ALSO SAYS WHERE THE FIX LIVES — see the header.
 * That is a claim about a DIFFERENT destination, measured on the deployed
 * build, and it is composed from `GOAL_TARGET_ROUTE_IS_LIVE` so it cannot
 * outlive its authority. The details clause is untouched: it still says only
 * what the click does.
 */
export function goalNoTargetChannels({
  diagnostic,
  routeIsLive = GOAL_TARGET_ROUTE_IS_LIVE,
}: {
  diagnostic: boolean
  /**
   * ⚠ INJECTABLE FOR ONE REASON: so BOTH branches of the composition can be
   * driven BY EXECUTION. The spec previously asserted them behind
   * `if (GOAL_TARGET_ROUTE_IS_LIVE) … else …`, which is a tautology — it passes
   * whichever way the flag falls, so it can never fail ON the flag's value. A
   * mutant regressing `modelGoalMinimumTarget` to `'disabled'` SURVIVED it, and
   * the mutant kit is the only reason I know. Production never passes this: the
   * default IS the derivation, and a test pins that the two agree.
   */
  routeIsLive?: boolean
}): {
  visible: string
  'aria-label': string
  title: string
} {
  // One clause, composed once, so the three channels cannot drift — the
  // property the header records as the reason this is a function at all.
  const tail = routeIsLive
    ? `set one in ${GOAL_TARGET_LIVE_ROUTE}, or open this goal's details`
    : "open this goal's details"
  const routeSentence = routeIsLive ? ` Set one in ${GOAL_TARGET_LIVE_ROUTE}.` : ''
  return {
    visible: GOAL_NO_TARGET_STATE,
    'aria-label': diagnostic
      ? `${GOAL_NO_TARGET_STATE}, and this run produced no probability — ${tail}`
      : `${GOAL_NO_TARGET_STATE} — ${tail}`,
    title: diagnostic
      ? `Olumi hasn't captured a measurable success target for this goal, and the analysis finished without producing a probability.${routeSentence} Open its details to see what the model holds, and check the model for inputs that are still incomplete.`
      : `Olumi hasn't captured a measurable success target for this goal.${routeSentence} Open its details to see what the model holds.`,
  }
}

export const GoalNode = memo((props: NodeProps) => {
  const metadata = NODE_REGISTRY.goal
  const displayMetadata = useNodeDisplayMetadata(props.id, 'goal')

  const nodes = useCanvasStore(state => state.nodes)
  const report = useCanvasStore(state => state.results.report)
  const resultsStatus = useCanvasStore(state => state.results.status)
  const viewMode = useCanvasStore(state => state.viewMode)
  const isPostAnalysis = resultsStatus === 'complete'
  // C-1: restored — this is what tells a finished-but-empty run apart from a
  // run that simply has no target yet.
  const hasAnyProbability = useHasAnyRealProbability()
  const isDetailed = viewMode === 'expert'
  // Phase 2.3 — null-probability guard. Post-analysis without any finite
  // per-option win_probability means the engine finished but produced no
  // probability. We must not render "Analysis complete" copy in that case.
  // F5a (Codex review): the rerun prompt must be driven by the ACTUAL freshness
  // state — the same composed trust surface AnalysisFreshnessNotice reads — never
  // by value absence. A completed CURRENT run can legitimately carry no goal
  // probability (producer returned none), and demanding a rerun then contradicts
  // the panel's "Analysis reflects the current model". Only a genuinely
  // changed/stale model ('changed' semantic) warrants "Rerun the analysis".
  const analysisChanged = useAnalysisTrust().semantic === 'changed'
  // Audit §8 P1: canvas result decorations mirror the panels' freshness
  // verdict (opacity + title only — no layout shift).

  const robustnessData = useMemo(() => {
    if (!isPostAnalysis || !report) return null
    const robustness = (report as any)?.robustness
    if (!robustness) return null
    const stability: number | null = typeof (robustness.recommendation_stability ?? robustness.recommendationStability) === 'number'
      ? (robustness.recommendation_stability ?? robustness.recommendationStability) : null
    const level: string | null = robustness.level ?? robustness.robustness_level ?? null
    return { stability, level }
  }, [report, isPostAnalysis])

  // ROADMAP 1.1 fix (6b-goal-capture evidence, finding b): the pre-analysis-v3
  // Hero's Success-target field commits via setGoalThresholdAndUpdateNode,
  // which writes `success_threshold` + `threshold_source: 'user'` onto the
  // goal node's data (see computeSuccessState.ts, the Hero's own selector,
  // which already treats this as the highest-priority "is set" signal). This
  // node's badge previously checked `goal_threshold_raw` ONLY — a CEE-backfilled
  // field (applyDraftResult.ts) that a Hero-only commit never populates — so
  // the canvas badge kept reading "no target" even after the Hero (or a
  // reconciled CEE round-trip) set one. Mirror computeSuccessState's priority:
  // a user-set success_threshold counts as "set" first; fall back to the
  // CEE-derived goal_threshold_raw.
  //
  // ⭐⭐ THE EXISTENCE PREDICATE IS SHARED NOW, AND SO IS THE PRECEDENCE.
  //
  // ⚠ THIS CARD AND THE HERO'S `computeSuccessState` GAVE OPPOSITE ANSWERS
  // ABOUT WHETHER THE SAME GOAL HAD A TARGET AT ALL. This site read
  // `String(x).trim() !== ''`; the hero read `typeof x === 'number'`. One node
  // carrying `goal_threshold_raw: '11'` rendered "Target: 11" here while the
  // hero field sat empty under "success needs setting".
  //
  // Both now go through `isStatedTargetValue` — the EXISTENCE half of the split
  // in `domain/goalTarget.ts`, which this file's sibling resolver
  // (`resolveGoalTarget`) already lives beside. Read the two-questions memo
  // there before widening or tightening it.
  //
  // ⚠⚠ AND THE PRECEDENCE MOVED WITH IT, WHICH IS THE HALF A PREDICATE-ONLY
  // FIX WOULD HAVE MISSED. This selected the user leg on `!= null`, so a goal
  // carrying a BLANK user threshold beside a real CEE raw selected the blank
  // and rendered "no target", while the hero fell through to the raw and
  // rendered one. Same two answers, arrived at through the selection rather
  // than the test — so the selection is "first STATED value wins", identically
  // to `computeSuccessState`'s two legs.
  //
  // ⚠ NON-FINITE IS NOT A TARGET, and that narrowing is now safe to make here:
  // `AdvancedField`'s guard (this PR) was admitting `Infinity`, `-Infinity`,
  // `1e400` and `9e999` straight through `setThreshold` onto this very field.
  //
  // ⭐⭐⭐ AND THE WHOLE CHAIN NOW LIVES IN `domain/goalTarget.ts`, BECAUSE A
  // SECOND SURFACE HAD TO ASK THE SAME QUESTION. `GoalPanel` decides whether to
  // offer `GoalThresholdEditor`, and it was deciding from the STORE SCALAR —
  // a different authority, written by a different reducer, which
  // `setCeeAnalysisReady` moves without ever touching this node. On a payload
  // carrying `goal_threshold` and no raw the panel answered "Success means
  // reaching ≥ 0.8" and offered nothing to press, while the chip fired — the
  // two surfaces contradicting each other about the same goal.
  //
  // The remedy is NOT to align the two authorities — they answer different
  // questions and both answers are right (trap 21). It is to name the question
  // the READER is asking — *has anything been captured onto this goal?* — give
  // it one owner, and have both consumers read it. `canCaptureGoalTarget` is
  // that owner. ⚠ It settles PRESENCE of the editor and says nothing about
  // whether the editor can be USED; the inspector's authority fieldset decides
  // that, which is the distinction round 3 had to unpick. Keeping a second
  // copy of the resolution chain here is what let the two drift in the first
  // place, so this card holds none.
  const thresholdRaw = statedGoalTargetRaw(props.data as GoalTargetSource)
  const thresholdUnit = props.data?.goal_threshold_unit as string | undefined
  // ⚠ ONE CALL, TWO READINGS, AND THEY CANNOT DISAGREE. `hasThreshold` is the
  // negation of the admission by construction — never a parallel predicate.
  const canCaptureTarget = canCaptureGoalTarget(props.data as GoalTargetSource)
  const hasThreshold = !canCaptureTarget

  // ⛔⛔ A READINESS GATE ON THIS CHIP WAS WRITTEN AND WITHDRAWN, 14 Sep 2026.
  //
  // THE DEFECT IS REAL AND STILL OPEN. This card and the decision card both
  // offer an identical `actionType="run_analysis"` chip — same label, same
  // message, confirmed as exactly two by a whole-tree sweep and measured on a
  // real render of `pricing-model` at 1600x1000. Their gates differ:
  //
  //     decision   allFactorsPresent && goalDefined
  //     goal       hasThreshold && !isPostAnalysis
  //
  // So on a model with a target and a factor still missing its value, the
  // decision card withholds the action and names the gap while this card offers
  // it. Two surfaces, one question, opposite answers.
  //
  // ⛔ WHY THE OBVIOUS FIX WAS WRONG. I gated this chip on the decision card's
  // predicate. An independent review refuted it: a bare missing-count is a
  // THIRD predicate, not the authority. `utils/canRunAnalysis.ts` is the
  // authority — 13 consumers — and it weighs graph health, `analysisReadiness`,
  // the producer's own `mayRun`, blockers and held states, several of which
  // admit a run that a bare missing-count refuses. Gating here on the narrower
  // predicate would trade a false YES for a false NO, which is the harm the
  // spec for that change warned about in its own header.
  //
  // ⭐ SO THE HONEST STATE IS: NEITHER CARD CONSUMES THE AUTHORITY. The decision
  // card's predicate is as home-made as the one withdrawn here. Making both read
  // `canRunAnalysis` is the actual repair, and it is a consequence-class change
  // across two components and 13 existing consumers — not a line in this file.
  // Recorded here rather than left as a silent asymmetry.

  const stabilityClassification = useMemo(() =>
    getStabilityClassification(robustnessData?.stability),
    [robustnessData?.stability]
  )
  const stabilityBarColour = useMemo((): DataBarColour => {
    const level = robustnessData?.level ?? stabilityClassification?.level
    switch (level) {
      case 'high': return 'success'
      case 'moderate': return 'goal'
      case 'low': case 'very_low': return 'warning'
      default: return 'goal'
    }
  }, [robustnessData, stabilityClassification])

  const stabilityValue = robustnessData?.stability ?? displayMetadata.stabilityPercentage

  const preAnalysisConstraints = useCanvasStore(state => state.goalConstraints)
  const postAnalysisConstraints = useCanvasStore(state =>
    (state.results?.report as any)?.goal_constraints as Array<CEEGoalConstraint & { probability?: number }> | null | undefined
  )
  const activeConstraints: Array<CEEGoalConstraint & { probability?: number }> | null =
    isPostAnalysis ? (postAnalysisConstraints ?? preAnalysisConstraints) : preAnalysisConstraints

  const hasConstraintDefaultWarning = useMemo(() => {
    if (!isPostAnalysis || !report) return false
    // R-6: the ONE dual-slot reader (root first, then the legacy `robustness`
    // nesting). This was a fourth private copy of that fallback, in its own cast
    // style; the shared reader carries the 773-fact measurement showing the
    // legacy slot is 0/773, which is why reading only one slot renders
    // permanently empty with nothing red.
    const warnings = readInferenceWarnings(report as never)
    if (!Array.isArray(warnings)) return false
    return warnings.some((w: any) => w.code === 'CONSTRAINT_NODE_DEFAULT_BASE')
  }, [report, isPostAnalysis])

  // THE POSSESSIVE GATE (ROADMAP 2.283) — the last live un-gated possessive
  // surface in the estate.
  //
  // `basis === 'joint_goal_substituted'` means this number is P(all
  // constraints jointly satisfied) STANDING IN for an absent
  // `probability_of_goal`. "chance of reaching target" then names a question
  // the number does not answer — witnessed on staging as a ~100x
  // understatement rendered in the possessive voice (#556). Six sibling
  // surfaces already withhold the possessive in this state; this node could
  // not, because `useNodeDisplayMetadata` read the basis and discarded it.
  // 2.283 forwards it; this is the consumer.
  //
  // ⚠ SCOPED TO `joint_goal_substituted`, NEVER to "the figure is joint".
  // `joint_goal_constrained` is the user's own goal AND their own limits —
  // the possessive is EARNED there and is untouched (the ROADMAP 1.49 case).
  // The expression is byte-identical to `OptionNode`'s, deliberately.
  // ⭐ L62 (2026-08-04) — THIS IS NOW ALWAYS FALSE, AND THAT IS THE POINT.
  // `selectGoalProbability` no longer substitutes the joint figure into the
  // goal-fit slot at all: on that basis (`'joint_goal_withheld'`) it returns NO
  // number, so this surface renders nothing to re-voice. The bases that still
  // carry a number — `'goal_probability'` and `'joint_goal_constrained'` —
  // both EARN the possessive. The narrowing goes through the owner's exported
  // `basisWithholdsPossessive` so the four canvas/summary surfaces share ONE
  // rule instead of four copies of a literal.
  const goalFitSubstituted =
    displayMetadata.achievementProbability !== null &&
    basisWithholdsPossessive(displayMetadata.achievementProbabilityBasis)
  // The readout, built ONCE above both arms so the withheld and permitted
  // wordings can never show different numbers for the same run.
  //
  // ⭐ ROADMAP 2.333 — THE EXACT-ZERO DIVERGENCE, CLOSED.
  // This was the node's own literal, and its sub-1% predicate carried a
  // `> 0 &&` carve-out the dock surfaces do not have. The consequence was
  // narrow and live: for an EXACT zero the carve-out fell through to
  // `Math.round(0 * 100)`, so the canvas node said "0% chance of reaching
  // target" while the option card beside it said "< 1%" about the same
  // number. `displayFloors.ts` carried a standing correction recording this
  // as the open, opposite convention.
  //
  // It now calls the goal register's shared formatter, so the canvas and the
  // dock state one thing. Non-zero sub-1% values are unaffected — they read
  // "< 1%" here exactly as they always did.
  //
  // No sample count is passed: `useNodeDisplayMetadata` carries the
  // probability and its basis, not `n_valid_samples`, so this surface takes
  // the floored fallback arm. That is the honest option — threading a count
  // this hook does not hold would mean inventing one.
  const achievementReadout =
    displayMetadata.achievementProbability === null
      ? null
      : formatGoalProbability(displayMetadata.achievementProbability)

  /**
   * ⭐ ONE GATE FOR THE ACHIEVEMENT FIGURE, NAMED ONCE.
   *
   * The same three-term expression was written out THREE times below — once
   * for the readout, once for the modelled-basis caveat, once for the
   * low-probability guidance — and the metric row would have made it four.
   * Four hand-kept copies of the permission that decides whether this card
   * states a probability at all is precisely the mirror this estate keeps
   * paying for (CLAUDE.md trap 12), and the drift it produces is the worst
   * kind available here: a number rendered by one copy while the disclosure
   * that makes it honest is withheld by another.
   *
   * ⚠ UI-SEM-082 IS THE REASON FOR `hasThreshold`, and it is not incidental.
   * The producer synthesises an auto goal threshold and returns a probability
   * even when the USER set no target, so gating on value presence alone would
   * crown a target nobody chose.
   */
  const showAchievementReadout =
    hasThreshold &&
    displayMetadata.isResultsMode &&
    displayMetadata.achievementProbability !== null

  /**
   * The critical-probability predicate, also named once. It was written out
   * three times — the danger colour, the coaching chip's gate, and the
   * "Target may be ambitious" guidance — each carrying its own null check. The
   * `< 0.10` threshold is the card's own editorial line and there is no reason
   * for three copies of it to be able to disagree about where it sits.
   */
  const achievementIsCritical =
    displayMetadata.achievementProbability !== null &&
    displayMetadata.achievementProbability < 0.10

  /**
   * ⛔ NO BORDER OVERRIDE — THE GOAL IS ALWAYS A SOLID FRAME IN ITS KIND HUE
   * (contract v3.1, ANC-01 / FRAME-06).
   *
   * This used to be `goalBorderOverride`, and after a run it re-drew the most
   * important card on the canvas from the producer's ROBUSTNESS verdict:
   * `border-info border-dashed` for `moderate`, `border-danger border-dashed`
   * for `low | very_low` (the Risk card's own hue, read as amber/orange on
   * Paul's screenshot), and `border-panel-border border-dashed` for a
   * post-run goal with no target — ~1.2:1 on the panel, so the card lost its
   * visible edge altogether.
   *
   * The contract rules all three out at once: every card has a solid 1px
   * border in its kind hue, there is no dashed node variant, and a dash means
   * a recorded doubt about EXISTENCE — "never used for fragility" (key row;
   * Paul 23 Sep point 4: "Dash remains existence certainty only"). Fragility
   * as a border was also warning styling on the anchor, which the contract
   * forbids.
   *
   * History kept, not repeated: before 31 Aug 2026 the targetless arm was
   * `border-warning border-dashed` and was withdrawn under `goalAnchorCopy`'s
   * ruling that no-target "NEVER blocks … an invitation with a route, not a
   * wall"; `very_low` was later added beside `low` after it fell through to no
   * treatment. Both arms are now gone with the override itself. A targetless
   * goal is still `isIncomplete`, which BaseNode renders SOLID in the kind hue.
   *
   * ⭐ NOTHING THE READER COULD LEARN FROM IT IS LOST. The same verdict is
   * stated in WORDS in this card's Layer 2 — the "Decision stability" row and
   * its "Marginal" state word (popover in Standard, inline in Detailed) — and
   * in the results panel. The previous comment's point that `moderate`/`low`
   * are the producer's claims about the analysis still stands; the border was
   * the wrong channel for a claim, not the claim itself.
   *
   * ⚠ ONE ROUTE TO A DASHED GOAL REMAINS AND IT IS NOT IN THIS FILE: BaseNode's
   * `isUncertain` arm dashes any non-factor node with `uncertainty > 0.4`. Its
   * exemption for `goal` (and `decision`) belongs to BaseNode's owner.
   */

  // Format threshold display.
  //
  // ROADMAP 2.315(c): the unit-string → unit-kind mapping that used to live
  // inline here now lives in `formatGoalTarget`, unchanged in behaviour. It was
  // moved because Inspector v2's GoalPanel needed the SAME mapping and had none
  // (it interpolated the number bare with the unit as a suffix — "800000 £"),
  // and the staging walk saw the two surfaces print different strings for one
  // goal. Sharing the mapping makes agreement structural rather than a
  // convention someone has to remember (CLAUDE.md #12). Percent rounding,
  // 'count' suppression and currency prefixing are all as they were; the only
  // behavioural difference is that a unit is now TRIMMED before classification,
  // the same direction the U2 fix took when it retired this site's local
  // `'%' | 'percent' | 'percentage'` copy.
  const thresholdDisplay = useMemo(() => {
    if (!hasThreshold) return null
    const raw = typeof thresholdRaw === 'number' ? thresholdRaw : Number(thresholdRaw)
    if (Number.isNaN(raw)) return String(thresholdRaw)
    return formatGoalTarget(raw, thresholdUnit) ?? String(thresholdRaw)
  }, [hasThreshold, thresholdRaw, thresholdUnit])

  /**
   * ⭐⭐ ONE OWNER FOR WHAT THIS CARD SAYS ABOUT ITS TARGET — AT EVERY ZOOM.
   *
   * ⚠ THIS EXISTS BECAUSE THE TWO SITES HAD ALREADY DIVERGED, BY ONE CHARACTER.
   * The full-zoom body rendered `Target: 15%` and the reduced line, added
   * beside it a day later, rendered `Target 15%`. Same card, same datum, one
   * zoom step apart — and the file's own docblock documented the colon form, so
   * all three disagreed. Nothing could catch it, because the low-zoom line was
   * a SECOND HAND-WRITTEN COPY of the first: the strings were only ever equal
   * by someone remembering to keep them equal (CLAUDE.md trap 12).
   *
   * ⛔ SO THE RULE IS MADE STRUCTURAL RATHER THAN RESTATED: the reduced line is
   * DERIVED FROM WHAT THIS CARD RENDERS AT FULL ZOOM, never hand-copied beside
   * it. `targetLine` below is the ONLY place the phrase is built; the full-zoom
   * body renders it and `lodMetric` passes it down. A future edit to the
   * wording changes both or neither, and `GoalNode.lodTargetLine.spec.tsx`
   * pins the low-zoom line AGAINST THE FULL-ZOOM RENDER rather than against a
   * literal, so a re-divergence cannot pass by editing one string.
   *
   * ⚠ THE TARGET, NOT AN ACHIEVEMENT PROBABILITY. A goal's probability figures
   * carry mandatory adjacent disclosures (`GOAL_FIT_BASIS_CAVEAT_COPY`,
   * possessive withholding) that cannot ride one line, and a number stripped of
   * the caveat that makes it honest is not made safe by shrinking the type —
   * the same rule `shared/lodMetricLine.ts` applies to an outcome. The
   * THRESHOLD needs no caveat, because it is not a claim about the world, and it
   * is the thing a reader most wants from this card at a glance.
   *
   * ⚠ BUT IT IS NOT ALWAYS THE USER'S OWN TARGET (reviewer blocker on Paul 23
   * Sep contract feedback point 1). `statedGoalTargetRaw` falls back to CEE's
   * `goal_threshold_raw`, which on the market-entry starter is `£11M ARR` —
   * a figure its brief never states. So the line carries a source mark
   * (`goalTargetSourceMark`): `you` only when `threshold_source === 'user'`,
   * otherwise "no source". The mark sits BESIDE the line, not inside it, so the
   * reduced line derived from `targetLine` is unchanged.
   */
  const targetLine = thresholdDisplay != null ? `${GOAL_TARGET_PREFIX} ${thresholdDisplay}` : null

  /**
   * ⭐ AND THE NO-TARGET CASE IS THE POINT, NOT AN AFTERTHOUGHT. A goal with no
   * target is the state EVERY model is in before somebody sets one — the single
   * most common goal card there is, and below the floor it was an EMPTY BOX,
   * which is indistinguishable from a broken render. It now says the card's own
   * words: `GOAL_NO_TARGET_STATE` is the same constant the full-zoom chip is
   * COMPOSED from, so this states an ABSENCE and can never be mistaken for a
   * value.
   *
   * ⚠ THE STATE, NOT THE WHOLE CHIP. The line below is CSS-truncated with an
   * ellipsis (`BaseNode.tsx`), so appending the repair clause here would cut it
   * mid-word at the one size where the body it belongs to is hidden. The
   * agreement rule the sibling spec pins is a SUBSTRING rule — the reduced line
   * must be text the full-zoom card already shows — and a shared constant
   * satisfies it by construction rather than by anyone remembering to.
   */
  const lodMetric = targetLine ?? GOAL_NO_TARGET_STATE


  // Science icons (spec Section 4.1)
  const scienceIcons = useScienceIcons(props.id, 'goal')

  // Popover hover
  const { showPopover, nodeHandlers, popoverHandlers, nodeElRef } = usePopoverHover()

  // Whether to show Layer 2 inline (Detailed view)
  const showLayer2Inline = isDetailed

  // The label is an unconfirmed extract from the brief. Stated in Layer 2 below
  // (contract v3.1 pt 1 retired the rail icon that used to carry it).
  const briefExtract = goalLabelIsUnconfirmedBriefExtract(
    props.data as { provenance?: unknown } | undefined,
  )

  // Layer 2 content exists when there's anything to show (stability,
  // constraints, warning) OR when post-analysis chips need a home (every
  // post-analysis goal with a threshold gets at least the "Is my target
  // realistic?" coaching chip).
  const hasLayer2 = (
    briefExtract ||
    stabilityValue !== null ||
    (activeConstraints && activeConstraints.length > 0) ||
    hasConstraintDefaultWarning ||
    hasThreshold
  )

  // Recorded constraints are useful while framing, even without a numerical target.
  const showPopoverTrigger = hasLayer2

  // ----- Layer 2 content (shared between popover and Detailed inline) -----
  const layer2Content = hasLayer2 ? (
    <>
      {/* The label's provenance, stated once, in the card's details (contract
          v3.1 pt 1: the rail source icon is gone; the source detail keeps the
          fact). Same testid and same copy constant the rail icon carried. */}
      {briefExtract && (
        <p
          className={`${typography.edgeLabel} text-text-body m-0 mb-1`}
          data-testid={GOAL_LABEL_FROM_BRIEF_TESTID}
        >
          {GOAL_LABEL_FROM_BRIEF_COPY.notice}
        </p>
      )}

      {/* Stability bar — stale-dimmed when the model changed since the run */}
      {stabilityValue !== null && (
        <div
          className={`mb-1`}
        >
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className={`${typography.edgeLabel} text-text-light`}>Decision stability</span>
            <span className={`${typography.edgeLabel} text-text-body`}>{Math.round(stabilityValue * 100)}%</span>
            {(stabilityClassification?.level === 'low' || stabilityClassification?.level === 'very_low') && (
              /* Contract v3.1 PILL-12: the same state-word anatomy as the
                 no-target chip. Vertical padding stays 0 (as before) so this
                 row, which the pill sets the height of, does not grow in
                 Detailed view: 16.3px at 1x, from 17.1px. */
              <span
                data-testid="goal-stability-marginal"
                className={GOAL_STATE_WORD_CLASSES}
                style={{ ...GOAL_STATE_WORD_STYLE, paddingTop: 0, paddingBottom: 0 }}
              >
                Marginal
              </span>
            )}
          </div>
          <DataBar value={stabilityValue} label="Stability" colour={stabilityBarColour} size="standard" />
        </div>
      )}

      {/* Constraint badges */}
      {activeConstraints && activeConstraints.length > 0 && (
        <div className="flex flex-col gap-0.5">
          {activeConstraints.map((c, i) => {
            const prob = typeof c.probability === 'number' ? c.probability : null
            /**
             * ⛔⛔ THE TRAFFIC LIGHT IS GONE — the UI was issuing a verdict in
             * colour, which is the same defect as issuing one in words and
             * harder to see.
             *
             * It read `prob >= 0.7` green, `>= 0.4` amber, else RED. Nobody
             * gave us those numbers. The producer supplies a probability that
             * a constraint is satisfied; 0.7 and 0.4 are cutoffs this card
             * chose, and it then told the reader that 39% is danger while 41%
             * is merely a warning. For a ceiling like "keep churn under 4%", a
             * 70% chance of holding it may be alarming rather than green.
             *
             * ⚠ THE SCANNER CANNOT SEE THIS ONE and that is worth recording:
             * `uiRendersItDoesNotDecide` looks for a threshold selecting PROSE,
             * and these branches select TAILWIND CLASSES, which `isProse`
             * correctly rejects. Found by reading the card, not by running the
             * guard.
             *
             * The figure itself is unchanged and still sits beside the
             * sentence, so nothing is hidden — what is gone is the grading.
             */
            // Contract v3.1 PILL-12: the boundary is the NEUTRAL mini pill
            // (`.pill.mini`: 1px var(--line) #DBD7D0, radius 999, padding
            // 1px 7px), not an Info ring — Info means "attention" on this canvas.
            // `border-field/40` over the panel is #D0CDC8, the nearest DS token.
            const colourClass = 'border-field/40 text-text-body'
            const constraintText = goalConstraintText(c, nodes)
            const badgeAriaLabel = `${constraintText}${prob !== null ? `, ${Math.round(prob * 100)}% probability` : ''}`
            return (
              <div key={c.id ?? i} className={`flex items-center justify-between gap-1 px-[7px] py-px bg-panel border rounded-full ${colourClass}`} data-testid="goal-constraint-badge" aria-label={badgeAriaLabel}>
                <span className={`${typography.edgeLabel} break-words`}>{constraintText}</span>
                {prob !== null && <span className={`${typography.edgeLabel} font-mono shrink-0`}>{Math.round(prob * 100)}%</span>}
              </div>
            )
          })}
        </div>
      )}

      {/* Constraint default warning */}
      {hasConstraintDefaultWarning && (
        <p className={`${typography.edgeLabel} text-text-body m-0 mt-0.5`}>
          Some model inputs missing. Goal probability may be less reliable.
        </p>
      )}

      {/* Coaching chips — moved out of body. "Why is this so low?" only
          fires when the achievement probability is critically low; "Is my
          target realistic?" applies to every post-analysis goal with a
          threshold. */}
      {/* ⛔ "Is this the real goal?" IS NOT HERE and must not be added back.
          It is the only goal question that does not interrogate the NUMBER, so
          `hasThreshold` was the wrong home for it — see the body render. The
          resolver keeps the two apart as `threshold` and `card` surfaces. */}
      {hasThreshold && (
        <CoachingChipRow
          className="flex gap-1 flex-wrap mt-1.5"
          chips={resolveNodeCoaching({
            kind: 'goal',
            surface: 'threshold',
            state: { achievementIsCritical },
            context: {},
          })}
        />
      )}
    </>
  ) : null

  /*
   * The resting face's limit pills (see `goalLimitPills`). Three gates, each a
   * ruling:
   *   · a TARGET is on the row — the missing state shows ONE pill only,
   *     "Target not captured" (NODE-ANATOMY v3.2 Goal: "Never … a second pill");
   *     the limits stay in Layer 2 (popover / Detailed) there;
   *   · Standard only — Detailed renders Layer 2 inline, whose constraint list
   *     already states each limit (with its run figure), so one view never says
   *     a limit twice;
   *   · the SAME `activeConstraints` Layer 2 reads, so the pill and its details
   *     are one set.
   */
  const restingLimitPills =
    targetLine !== null && !isDetailed ? goalLimitPills(activeConstraints, nodes) : []

  // R5 + L-47 (Paul, 16 Aug 2026): "Full buttons/instructional text on nodes:
  // no." The goal node used to carry a two-sentence instruction plus a
  // "Help me set a target" chip — a billboard on the canvas. Both no-target
  // branches now render one compact status chip that OPENS THIS NODE'S
  // INSPECTOR, where setting a target actually happens. The explanation moves
  // to the chip's tooltip and to the inspector; the canvas keeps the signal.
  //
  // A <button>, not a chip-shaped div: click, tap, Tab and Enter/Space all
  // work with no key handling of our own (hover/click/keyboard parity, ruled).
  // C-1: the chip has to carry TWO distinguishable states, because the copy it
  // replaced did. The old post-analysis branch had a second sentence for the
  // null-probability case ("Analysis finished. Set a target and check the graph
  // for incomplete inputs") — a real diagnostic, and it lost its home when the
  // prose came out. A missing target before a run and a run that finished
  // WITHOUT producing any probability are different situations with different
  // next actions, so they get different tooltips and different accessible
  // names. The visible chip text stays one short phrase either way: the point
  // of R5 is that the node signals, and the DIAGNOSTIC lives one hover away.
  //
  // ⚠ AND THE REPAIR IS NOW IN NONE OF THEM. It was in all three — visible
  // text, accessible name and tooltip — and the destination it named is inert
  // (see the header). Withdrawing it from the visible chip alone would have
  // left the promise in the two channels nobody greps, so all three are DERIVED
  // from `goalNoTargetChannels` and asserted equal to it.
  const noTargetDiagnostic = isPostAnalysis && !hasAnyProbability
  const noTargetChannels = goalNoTargetChannels({ diagnostic: noTargetDiagnostic })
  const targetSourceMark =
    targetLine !== null ? goalTargetSourceMark(props.data as GoalTargetSource) : null
  const targetRouteChannels =
    targetLine !== null ? goalTargetRouteChannels({ targetLine, sourceLabel: targetSourceMark?.label }) : null
  const noTargetStatusChip = (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); openNodeInspector(props.id) }}
      onPointerDown={(e) => e.stopPropagation()}
      // ⭐ TWO MEASURED FAILURES IN ONE CONTROL, both fixed here — and the
      // first fix RE-DECIDED under contract v3.1 (ANC-06 / PILL-04).
      //
      // 1. `border-warning/40` rendered **1.92 : 1** against the panel on the
      //    served build, and the fix was full `--warning-ink` (5.36 : 1) over a
      //    `bg-warning/10` fill, read against WCAG 1.4.11's 3.00:1 floor. That
      //    put a warning fill and a brown ink ring on the goal of EVERY model
      //    that has no target yet — the commonest goal state there is — and the
      //    contract rules it out twice: "no warning styling", and its
      //    `.state-word` is a quiet hairline on white (`#DDC6AB`, ~1.63:1).
      //    ⚖ WHY THE HAIRLINE IS STILL ACCESSIBLE: this control is identified by
      //    its TEXT ("Target not captured", text-body at 10.45:1), and SC
      //    1.4.11's own Understanding note is that a text button needs no 3:1
      //    boundary — the boundary is not the information that identifies it.
      //    Focus keeps its 2px info ring. The border token is the state word's
      //    DS translation, `warning-ink/40` (#D2BEAC, 1.78:1 — the nearest DS
      //    token to the contract's #DDC6AB), identical to the corner pill's.
      // 2. The box rendered **110 x 18** and carried NO hit slop, so it was the
      //    only node control on the board under the 24px target floor that is
      //    not a priced, documented shortfall — the 57 quick actions reach 28px
      //    through `CANVAS_HIT_SLOP_CLASSES`, and `ScienceIcon`'s own comment
      //    rules out slop there because 6px per side would overlap its
      //    neighbour and open the WRONG popover. This chip has no neighbour:
      //    it sits alone in the target row, so 3px per side is free.
      //    `relative` is required or the `::before` positions against an
      //    ancestor instead of the button.
      className={`nodrag relative ${GOAL_STATE_WORD_CLASSES} before:absolute before:-inset-[3px] before:content-[''] hover:bg-panel-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-info`}
      style={GOAL_STATE_WORD_STYLE}
      aria-label={noTargetChannels['aria-label']}
      title={noTargetChannels.title}
      data-testid="goal-node-no-target-chip"
      data-diagnostic={noTargetDiagnostic ? 'no-probability' : undefined}
    >
      {noTargetChannels.visible}
    </button>
  )

  const goalCoaching = useMemo(
    () =>
      resolveNodeCoaching({
        kind: 'goal',
        surface: 'card',
        state: { achievementIsCritical },
        context: {},
      }),
    [achievementIsCritical],
  )
  const achievementTitle = [
    goalFitSubstituted
      ? GOAL_ANCHOR_COPY.phrase(achievementReadout ?? '', goalFitSubstituted)
      : `${achievementReadout ?? ''} chance of reaching target.`,
    displayMetadata.achievementProbabilityIsModelledBasis === true ? GOAL_FIT_BASIS_CAVEAT_COPY : null,
    hasConstraintDefaultWarning ? 'Some model inputs are missing. Goal probability may be less reliable.' : null,
    analysisChanged ? 'The model has changed since this run.' : null,
  ].filter(Boolean).join(' ')

  return (
    <div
      ref={nodeElRef as React.Ref<HTMLDivElement>}
      style={{ position: 'relative' }}
      onMouseEnter={nodeHandlers.onMouseEnter}
      onMouseLeave={nodeHandlers.onMouseLeave}
      /* The TAP path. A no-op on a pointer device (`usePopoverHover` gates it
         on `hover: none`); on touch it is the only way this node preview can
         be opened at all. It does not stopPropagation, so the tap still
         selects the node. */
      onClick={nodeHandlers.onClick}
    >
      <BaseNode
        {...props}
        nodeType="goal"
        lodMetric={lodMetric}
        icon={metadata.icon}
        coaching={goalCoaching}
        /* ⭐ NO RAIL SOURCE ICON (contract v3.1 pt 1: "The separate rail source
           icons are removed"; supersedes ED 11:52Z pt 2's rail provenance icon).
           The target's source mark sits beside the target line; the label's
           "From your brief" notice lives in Layer 2 (popover / Detailed). */
        /* One state, once (contract v3.1, gap U4): while this card's own
           "Target not captured" chip is stating the gap, BaseNode withholds its
           goal "Needs input" pill. The pill's goal arm has no other reason. */
        incompleteStatedOnCard={canCaptureTarget}
        headerSlot={isDetailed && scienceIcons.length > 0 ? (
          <span className="inline-flex items-center gap-1">
            {scienceIcons.map(si => (
              <ScienceIcon key={si.id} icon={si.icon} tooltip={si.tooltip} action={si.action} colour={si.colour} />
            ))}
          </span>
        ) : undefined}
      >
        {/* ⭐⭐ THE GOAL CARD IS WIDE AND SHALLOW (ED 11:52Z point 2: "goal +
            target/capture state + selective reasoning/attention + icon rail;
            coaching behind icon; provenance compact").

            Row 1 — the target, or its capture state: "Target: …" (a route to
            the editor where one is live) or "Target not captured".
            Row 2 — after a run that PRODUCED a goal chance, ONE Chance row
            (none otherwise: contract v3.1, gap U3); its basis caveats and the "may be
            ambitious" prompt are in its tooltip, the popover and Detailed.
            `Last run ·` prefixes it ONLY when the model is known to have
            changed (ED 02:31Z: "Goal stale rule: `changed` only").

            Gone from the face: the "Is this the real goal?" chip (the rail's
            coaching icon asks it) and the duplicate "Run analysis" chip (the
            Question card's rail carries the run). */}
        {/* Contract v3.1 `.node.wide` + `.node .target-row` (FRAME-10, ANC-13):
            · title → row is 7px, the wide card's gap: the header's 4px plus
              3px here (was 4 + 4). Shrinks the card by 1px; never grows it.
            · items share a BASELINE, so the 12px target and its 11px italic
              source mark sit on one line of type (the chip, when it renders,
              is the row's only item).
            · the 7px inter-item gap counter-scales like the text beside it,
              CAPPED at the 8px it replaces: at the label bound (scale 2), the
              height the layout reserves, the row is never wider than before,
              so it can never wrap onto a line it did not already take. */}
        <div className="mt-[3px] flex min-w-0 flex-wrap items-baseline gap-x-[min(8px,calc(7px*var(--canvas-label-scale,1)))] gap-y-0.5" data-testid="goal-node-resting-state">
          {canCaptureTarget && noTargetStatusChip}
          {targetLine !== null && targetRouteChannels !== null && (
            <button
              type="button"
              data-testid={GOAL_TARGET_ROUTE_TESTID}
              aria-label={targetRouteChannels['aria-label']}
              title={targetRouteChannels.title}
              /* Contract v3.1 T07/ANC-07: the goal's one recorded quantity reads
                 in INK (`.node .target-row` sets no colour, so it inherits
                 --ink); muted is reserved for row-meta and the source mark. The
                 dotted rule is the route affordance, in the secondary colour,
                 and it shows on HOVER AND KEYBOARD FOCUS ONLY: NODE-ANATOMY v3.2
                 principle 3 ("No link text inside a card … on hover or focus")
                 and the contract's `.target-row` (a plain span) — at rest the
                 target reads as text, like the factor value editor. */
              className={`nodrag nopan ${typography.nodeLabel} text-text-body text-left decoration-dotted decoration-text-light decoration-from-font underline-offset-2 hover:underline focus-visible:underline hover:text-info hover:decoration-solid`}
              onPointerDown={(e) => e.stopPropagation()}
              onDoubleClick={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation()
                openModelValueEditor(props.id, 'goal')
              }}
            >
              {targetLine}
            </button>
          )}
          {targetLine !== null && targetRouteChannels === null && (
            <div className={`${typography.nodeLabel} text-text-body`} data-testid="goal-target-line">
              {targetLine}
            </div>
          )}
          {targetSourceMark !== null && (
            <ValueSourceMark mark={targetSourceMark} testId={`goal-target-source-${props.id}`} subject="Target" onOpenSource={() => { openNodeInspector(props.id) }} />
          )}
          {/* ⭐ The user-stated limits beside the target (NODE-ANATOMY v3.2;
              ED choice 2: "Target: £20k/month   Churn < 7%"). Contract v3.1
              `.pill.mini` — the SAME neutral hairline Layer 2's constraint
              badge wears (PILL-12: 1px `border-field/40`, radius 999, 1px 7px),
              never the state word and never Info. Compact at rest: the pill
              shows the SHORT form (`goalConstraintShortText`, DESIGN-GAP-v31
              #23 — "Churn <4%") and is never cut; its full sentence is the
              pill's name, on hover AND keyboard focus (`Tooltip` opens on
              both) — the same focusable-readout pattern as the option share
              row (`role="img"` + `aria-label`, one accessible name). */}
          {restingLimitPills.map((l) => (
            <Tooltip key={l.key} asChild delay={NODE_TOOLTIP_DELAY_MS} content={l.name}>
              <span
                role="img"
                tabIndex={0}
                aria-label={l.name}
                data-node-tooltip="true"
                data-testid={`goal-limit-pill-${props.id}-${l.key}`}
                /* v3.1 `.pill.mini{font-size:10px;padding:1px 7px}` (#23),
                   counter-scaled. NEVER CLIPPED: the short form fits one line
                   on the wide card; a longer carried label wraps inside the
                   pill rather than being cut (was `truncate`). */
                className={`text-[length:calc(10px*var(--canvas-label-scale,1))] font-sans leading-snug nodrag nopan inline-block max-w-full break-words align-baseline px-[7px] py-px bg-panel border border-field/40 rounded-full text-text-body focus:outline-none focus-visible:ring-2 focus-visible:ring-info`}
              >
                {l.text}
              </span>
            </Tooltip>
          ))}
        </div>

        {showAchievementReadout && (
          <NodeMetricRow
            label={`${analysisChanged ? LAST_RUN_PREFIX : ''}${METRIC_NOUN.chance}`}
            value={displayMetadata.achievementProbability}
            formatted={achievementReadout ?? ''}
            fillClass="bg-goal"
            testId="goal-achievement-metric-row"
            title={achievementTitle}
            phrase={achievementTitle}
          />
        )}
        {/* No Chance row when the run produced no goal chance (contract v3.1
            goal anatomy, gap U3): the old unset row ("Not produced by this run" /
            "See each option" / "Rerun to update") is gone, not reworded. */}

        {/* Detailed adds information, not a different card: the basis caveat
            and the "may be ambitious" prompt, as before. */}
        {isDetailed && showAchievementReadout && displayMetadata.achievementProbabilityIsModelledBasis === true && (
          <p
            className={`${typography.edgeLabel} text-text-light mt-0.5 m-0`}
            data-testid="goal-fit-basis-caveat-node"
          >
            {GOAL_FIT_BASIS_CAVEAT_COPY}
          </p>
        )}
        {isDetailed && hasThreshold && isPostAnalysis && achievementIsCritical && (
          <p className={`${typography.edgeLabel} text-text-body mt-1 m-0`}>
            Target may be ambitious.{' '}
            <button
              type="button"
              className={`${typography.edgeLabel} text-info underline cursor-pointer nodrag nopan`}
              onClick={(e) => {
                e.stopPropagation()
                openNodeInspector(props.id)
              }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              Adjust target
            </button>
            {' '}or{' '}
            <button
              type="button"
              className={`${typography.edgeLabel} text-info underline cursor-pointer nodrag nopan`}
              onClick={(e) => {
                e.stopPropagation()
                useGuidanceStore.getState()._sendMessage?.('How can I strengthen the key factors to improve my chance of reaching the goal?')
              }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              strengthen key factors
            </button>
          </p>
        )}

        {showLayer2Inline && layer2Content}
      </BaseNode>

      {/* Layer 2: popover in Standard view (only for goals with threshold, post-analysis) */}
      {!isDetailed && showPopoverTrigger && (
        <NodePopover
          visible={showPopover}
          width={280}
          onMouseEnter={popoverHandlers.onMouseEnter}
          onMouseLeave={popoverHandlers.onMouseLeave}
          anchorRef={nodeElRef}
        >
          {layer2Content}
        </NodePopover>
      )}
    </div>
  )
})

GoalNode.displayName = 'GoalNode'
