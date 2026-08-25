// ============================================================================
// UNIFIED RUN GATING LOGIC
// ============================================================================
//
// PURPOSE: Single source of truth for "Can the user click Run?"
// This is the PRIMARY gating helper - use this for:
//   - Run button enabled/disabled state
//   - Run button tooltip text
//   - Keyboard shortcut gating (Ctrl+Enter)
//
// INPUTS REQUIRED:
//   - graphHealth: Validation issues (from store)
//   - readiness: CEE readiness assessment (from useGraphReadiness)
//   - hasBlockers: Critical unified actions (from useUnifiedActions)
//   - nodeCount: Basic graph structure check
//   - isRunning: Prevent double-run
//
// RELATED FILES:
//   - runEligibility.ts: Lower-level eligibility check (node/edge counts, limits)
//     Use runEligibility when you don't have CEE readiness available.
//   - useRunEligibilityCheck.ts: React hook that combines both
//
// USAGE:
//   import { canRunAnalysis, getRunButtonTooltip } from '@/canvas/utils/canRunAnalysis'
//
//   const result = canRunAnalysis({ graphHealth, readiness, hasBlockers, nodeCount })
//   <Button disabled={!result.allowed} title={getRunButtonTooltip(result)}>
//     Run Analysis
//   </Button>
// ============================================================================

/**
 * canRunAnalysis - Unified logic for determining if analysis can run
 *
 * Single source of truth for Run button gating and explanatory tooltips.
 * Combines validation state, readiness checks, and blocker detection.
 */

import { draftValuesAreUnsettled, type DraftStreamPhase } from '../stores/draftStore'
import type { AnalysisBlocker } from '@talchain/schemas/boundary'

import type { GraphReadiness } from '../hooks/useGraphReadiness'
import {
  composeAnalysisBlockedReason,
  composeReadinessBlockedReason,
  type OptionNeedingValues,
} from './composeBlockedReason'
import {
  ANALYSIS_HELD_NOTICE as HELD_NOTICE,
  type ClientInjectedProvenance,
} from './analysisHeldOnInjectedModel'

/**
 * The refusal for a model the engine did not draft.
 *
 * ⭐ NOT AUTHORED HERE, AND THAT IS THE FIX. It is
 * `analysisHeldOnInjectedModel.ts`'s `ANALYSIS_HELD_NOTICE` — the sentence the
 * provenance banner already shipped and that was already true. The gate used to
 * write its own (`CEE_DRAFT_FIRST_REFUSAL`, "Draft or save a model first, then
 * run analysis."), which was false in both limbs; see that module's header for
 * the derivation and for why quoting CEE's `NO_GRAPH` sentence here was the
 * root error (trap 21).
 *
 * Re-exported rather than inlined so a reader who arrives at the gate looking
 * for its refusal finds the one place the sentence is written, instead of a
 * second copy of it.
 */
export {
  ANALYSIS_HELD_NOTICE,
  analysisHeldNotice,
  analysisHeldOn,
  type ClientInjectedProvenance,
} from './analysisHeldOnInjectedModel'

/**
 * ROADMAP 2.122 — the refusal shown while a STREAMED draft's structure is on
 * the canvas but its numbers have not settled.
 *
 * Held to the same honesty bar as the wait narration (`DraftLoadingAnimation`,
 * `AnalysisRunningBanner`): it claims only what the client genuinely holds. The
 * client holds a GRAPH_READY frame stamped `status: in_progress`, so "still
 * being drafted" and "values are still settling" are facts read off the frame,
 * not a guess off a clock. It forecasts no duration and asserts nothing about
 * the user's decision.
 */
export const DRAFT_VALUES_SETTLING_REFUSAL =
  'Your model is still being drafted — its values are still settling. Run analysis once drafting finishes.'

/**
 * ROADMAP 2.122 round 2 (adversarial review F5) — the refusal for the TERMINAL
 * `unsettled` state, which is a different fact and needs a different sentence.
 *
 * Both phases used to share `DRAFT_VALUES_SETTLING_REFUSAL`, and in `unsettled`
 * its closing clause — *"Run analysis once drafting finishes"* — **forecasts a
 * finish that will never come**: the phase's own docstring says the values will
 * not settle in this session. It also contradicted the transcript notice sitting
 * directly beside it. One string, two phases, one of them false — the same
 * honesty bar this lane applied to its own narration lines, failed in a different
 * file.
 *
 * This one states the terminal fact and points at the affordance that actually
 * works (see F3: a fresh draft, not a retry of a turn CEE will decline).
 */
export const DRAFT_VALUES_UNSETTLED_REFUSAL =
  'Drafting ended before this model\u2019s values arrived, so they are not final. Start a new draft to analyse it.'

export interface CanRunAnalysisResult {
  /** Whether analysis can be run */
  allowed: boolean
  /** Human-readable reason why analysis cannot run (when allowed=false) */
  reason?: string
  /** Detailed reasons for blocking (for tooltips/debug) */
  blockingReasons?: string[]
  /** Warning message (when allowed but suboptimal) */
  warning?: string
}

export interface GraphHealthState {
  issues?: Array<{
    severity: string
    code?: string
    type?: string
    message?: string
  }>
}

/**
 * ⭐ THE CANONICAL READINESS AUTHORITY — `analysis_state.readiness`, as the
 * PRODUCER stated it on this turn (contract `@talchain/schemas/boundary`).
 *
 * ── WHY IT IS HERE, AND WHY THE OTHER ONE IS NOW SUBORDINATE ──────────────
 * Until 19 Aug 2026 this gate had exactly one readiness input: the SIDE-CAR
 * verdict fetched from `/bff/cee/graph-readiness` and held in `readinessStore`.
 * Two notions of "ready" therefore existed under one name, and on the frozen
 * quartet they DISAGREED on a fresh user's very first model:
 *
 *   analysis_state.readiness = { status: 'ready', blockers: [] }   ← producer
 *   readinessStore.readiness.can_run_analysis = false              ← side-car
 *
 * The gate asked the side-car, closed, and — because that verdict carried no
 * structured cause — explained itself with `BLOCKED_REASON_COPY.unspecified`:
 * *"Olumi needs something more from this model before the next analysis."* The
 * producer had just said nothing was missing. The product asserted an untruth
 * about the user's own model and offered a chat route that was itself a no-op.
 *
 * ── THE RULE (Paul, binding): name the owner, SUPERSEDE the competitor ─────
 * `analysis_state.readiness` is the owner. When it is STATED, the side-car
 * verdict is NOT CONSULTED — not weighted, not OR-ed, not used as a tiebreak.
 * When it is ABSENT (`null`), the side-car answers exactly as before. That is
 * the same feature-detected precedence `analysisStateSelector` already applies
 * to every other analysis truth, and it is why this change is a no-op for every
 * pre-0.46 fixture in the suite: they carry no `analysis_state`.
 *
 * ⚠ `blockers` IS THE PREDICATE, NOT `status`. The contract: an empty list "is
 * a POSITIVE claim: the producer assessed readiness and found nothing
 * blocking", while `status` is a producer-owned free-string code a consumer
 * maps to its own copy. Gating on a status whose cause we cannot name would
 * re-create the very refusal-without-a-reason this exists to delete — and a run
 * the producer then declines still refuses WITH a stated reason, which is
 * strictly better than a control that lies about why it is dead.
 */
export interface AnalysisReadinessAuthority {
  /** The producer's readiness status code. Carried for callers; never gates. */
  readonly status: string
  /**
   * Everything standing between the model and an analysable state, itemised
   * with per-option and per-factor scope. `[]` is a POSITIVE finding.
   */
  readonly blockers: readonly AnalysisBlocker[]
}

export interface CanRunAnalysisParams {
  /** Graph health from validation */
  graphHealth: GraphHealthState | null
  /** Graph readiness from CEE */
  readiness: GraphReadiness | null
  /**
   * ⭐ The canonical authority (above). `null`/omitted = NOT STATED, which is a
   * different fact from "stated, and nothing is blocking" — collapsing the two
   * is how an absence becomes a fabricated finding.
   */
  analysisReadiness?: AnalysisReadinessAuthority | null
  /**
   * ⭐ CEE's own admission verdict for this turn (`analysis_ready.may_run`) —
   * *"will the run proceed if asked, right now?"*, which is ALSO true when it
   * proceeds by excluding options the user left open.
   *
   * A SEPARATE PARAMETER, NOT A FIELD ON `AnalysisReadinessAuthority`: that type
   * is projected from a `.strict()` schema that cannot carry it, and the value
   * arrives on a different slice (`ceeAnalysisReady`) from a different key
   * (`analysis_ready`, not `analysis_state`). Read it with `useAnalysisMayRun()`.
   *
   * `undefined` = a pre-`may_run` CEE. It is load-bearing and must never be
   * collapsed to `false`; see `readinessObjectsToRun` for why the polarity is
   * strict `=== true`.
   */
  mayRun?: boolean
  /** Whether there are critical/blocking actions */
  hasBlockers: boolean
  /** Number of nodes in graph */
  nodeCount: number
  /** Whether analysis is currently running */
  isRunning?: boolean
  /**
   * ⭐ ONE INPUT for the injected-model rung — `analysisHeldOn(nodes)`, passed
   * THROUGH raw, never pre-worded by the caller (the same rule as
   * `draftStreamPhase`: a sentence chosen at a call site is a hand-maintained
   * mirror, and the mutant that picks the wrong variant survives).
   *
   * Non-null ⇒ the model exists only client-side while the run routes through
   * CEE, so the engine would answer about a graph it never received (#343) —
   * AND the value names which ready-made model it is, so the refusal can
   * describe it. This used to be two parameters (a gating boolean plus a
   * provenance), which is how `OutputsDock` and `ConversationPanel` came within
   * one review of describing the SAME state with two different nouns. One
   * value cannot half-arrive.
   */
  analysisHeldOn?: ClientInjectedProvenance | null
  /**
   * ROADMAP 2.122 — the streamed draft's phase, passed THROUGH rather than
   * pre-derived by the caller.
   *
   * ⚠ This started life as a `draftValuesSettling: boolean` that `OutputsDock`
   * computed. A mutation that dropped `'unsettled'` from that expression
   * **SURVIVED the battery**, because the derivation sat in a component nothing
   * tests while every test computed its own copy — a hand-maintained mirror of a
   * two-clause predicate (trap 12, in miniature, in the honesty guard itself).
   * Taking the raw phase removes the derivation from the call site entirely:
   * there is now exactly one place that decides what "unsettled" means, and it
   * is this function, which is tested.
   *
   * `settling` — GRAPH_READY has landed and the structure is on the canvas, but
   * the turn has not completed, so the numbers are the frame's `in_progress`
   * ones and the scenario commit has not landed.
   * `unsettled` — terminal: the stream died after GRAPH_READY and CEE declined
   * to re-draft, so those numbers will not settle in this session.
   *
   * This is a HONESTY rung, and it is the one the streamed path made necessary:
   * the run gate is otherwise driven by `nodeCount` + readiness, neither of which
   * knows the difference between a settled graph and a 25-second-old preview.
   * Without it a tester is handed a live Run button at 36 s, and the run either
   * computes on values CEE is about to change or returns `analysis_not_ready`
   * because the commit has not happened yet.
   */
  draftStreamPhase?: DraftStreamPhase
  /**
   * Options the readiness verdict graded as not-yet-ready, with their labels
   * (build with `selectOptionsNeedingValues`). Used ONLY to compose the
   * user-facing reason — it never affects `allowed`. Omitted ⇒ the reason
   * degrades to count-based copy, which is still true.
   */
  optionsNeedingValues?: readonly OptionNeedingValues[]
  /**
   * ROADMAP 2.635 (I-3) — `readinessStore.stale`: true when the model has
   * changed in a way the CURRENT `readiness` verdict was not asked about.
   *
   * ⚠ It affects the REASON, never `allowed`. Staleness is not evidence about
   * runnability — it is evidence about the EVIDENCE — and per Ruling 3
   * uncertainty must not lock the user out of their own model. So a stale
   * verdict that blocks still blocks (its refusal is the last real answer we
   * have) and a stale verdict that permits still permits; what changes is that
   * the refusal stops making specific claims sourced from a verdict nobody
   * asked about the current graph.
   *
   * The store has carried this flag since 2.332, and its docstring said it "is
   * what stops a surface presenting that verdict as current". The V3 footer
   * honoured it; this gate did not, so the blocked copy quoted a stale
   * verdict's `options_ready`/`options_total` and option labels as if fresh —
   * the user completes the named remedy and reads the same refusal until the
   * refetch lands.
   */
  readinessStale?: boolean
}

/**
 * readinessWillScaffold — the single strict-boolean reader of the scaffold
 * intent (UI-SEM-091). CEE (#612) rides `scaffold_plan.will_scaffold_options`
 * on the readiness response, and two surfaces consume it with OPPOSITE polarity:
 * the run GATE here (fail-closed — block unless strictly true) and the
 * pre-analysis DISPLAY in usePreAnalysisModel (fail-safe — disclose only when
 * strictly true). They previously read the raw field independently with `!==
 * true` vs `=== true`, agreeing only because readinessStore normalises the
 * field. Extracting the one `=== true` strict test guarantees the two reads
 * can never drift: an absent/undefined scaffold_plan is uniformly false
 * (fail-closed for the gate via `!readinessWillScaffold`, no-disclosure for the
 * display).
 */
export function readinessWillScaffold(readiness: GraphReadiness | null | undefined): boolean {
  return readiness?.scaffold_plan?.will_scaffold_options === true
}

/**
 * Does the readiness verdict OBJECT to a run? (ROADMAP 2.635, I-5.)
 *
 * The single definition of the gate's readiness rung. It exists because I-4
 * needs the same question answered at DISPATCH time, and the alternative —
 * re-typing `readiness && !readiness.can_run_analysis && !readinessWillScaffold(...)`
 * at the dispatch barrier — is the hand-maintained mirror this codebase has been
 * bitten by repeatedly (trap 12): the day the scaffold clause changes, one copy
 * moves and the other silently keeps the old answer, in the permissive
 * direction.
 *
 * ⚠ Note what `null` means here, because it is a DECISION and not a
 * fall-through (I-2). A `null` verdict is UNKNOWN, and unknown does not object.
 * The run gate stays open and the outage is DISCLOSED (the V3 footer's
 * "Could not check readiness" rung). Failing closed on an unobtainable readiness
 * check would brick the Run button for a healthy user whose only problem is that
 * a side-car service is down — the SHUT dead end witnessed in ROADMAP 2.332, and
 * exactly what POC-DONE's PC1 forbids. A truthful "we could not check, you can
 * still run" is not a dead end; a false "you cannot run" is.
 */
/**
 * The one member of the producer's readiness vocabulary that cannot describe a
 * runnable model (CEE `cee/transforms/analysis-ready.ts`,
 * `orchestrator/tools/analysis-ready-helper.ts`). Named once; the derivation
 * lives at the single use site below.
 */
const ANALYSIS_READINESS_BLOCKED = 'blocked'

/**
 * The producer's ADVISORY blocker codes — itemised entries that ride along on
 * an otherwise READY payload and do NOT stand between the model and a run.
 *
 * ── WHY THIS EXISTS (derived at CEE `a61fe7ff`, the deployed build) ─────────
 * `blockers` is the gate's predicate, and until this constant existed it was a
 * RAW COUNT. But the producer's blocker list is not homogeneous, and CEE says
 * so in its own words at
 * `orchestrator-v5/context/canonical-analysis-state.ts:47-56`:
 *
 *   "`status === 'ready'` carrying advisory `constraint_dropped` blockers is a
 *    BY-DESIGN combination on the shared contract (the egress boundary injects
 *    informational constraint-drop blockers onto an already-ready payload
 *    without recomputing status). It must NOT downgrade usability."
 *
 * The chain that produces it, end to end:
 *   · `cee/transforms/analysis-ready.ts:1474` `extractConstraintDropBlockers`
 *     turns an STRP `CONSTRAINT_DROPPED` mutation into a blocker whose
 *     `blocker_type` is `constraint_dropped`;
 *   · `cee/unified-pipeline/stages/boundary.ts:198` PUSHES it onto
 *     `analysis_ready.blockers` and DOES NOT recompute `status` — its own
 *     comment: "dropped constraints mean the graph is still runnable";
 *   · `orchestrator/tools/draft-graph.ts:907` carries `blockers` through
 *     VERBATIM onto `DraftGraphResult.analysisReady`;
 *   · `orchestrator-v5/compose/analysis-state-v1.ts:322` `mapWireBlockers`
 *     maps it onto the wire with NO actionability filter.
 *
 * So a raw count refuses a model the producer has just called ready — the
 * original 2.635 defect in a new spelling, and the reason this is a COUNT
 * change rather than a second clause (Paul's convergence rule: one run-gate
 * predicate, superseded in place, never a parallel rule).
 *
 * ── WHY KEYED ON `code`, AND WHY A DENYLIST ────────────────────────────────
 * ⚠ `blocker_type` IS NOT ON THIS WIRE. `AnalysisBlockerSchema`
 * (`@talchain/schemas/boundary`, 0.48.0) is `.strict()` and carries only
 * `code` / `category` / `message` / `repairability` / the four scope fields.
 * `category` cannot discriminate either: `constraint_dropped` maps to
 * `option_values`, the SAME category as `missing_value` and `ambiguous_value`
 * (`analysis-ready-helper.ts:665-707`). `repairability` is `human_input_required`
 * for all four. **`code` is the only discriminator the producer actually ships**,
 * and `CONSTRAINT_REVIEW_REQUIRED` is emitted from exactly one branch —
 * `analysis-ready-helper.ts:705`, the `constraint_dropped` case.
 *
 * ⚠ THAT HOLDS IN ONE DIRECTION ONLY, AND THIS COMMENT SAID "1:1" (corrected
 * 19 Aug 2026, derived at CEE `a7ee21e9`). CODE → CASE is exact: nothing but
 * `constraint_dropped` can produce this code, which is all the denylist needs.
 * CASE → CODE is NOT: `blockerIssue` has an EARLY RETURN above the switch
 * (`analysis-ready-helper.ts:672-679`) that codes a blocker
 * `UNREACHABLE_CONTROLLABLE_FACTOR` whenever
 * `status === 'needs_user_mapping' && !optionId && factorId` — and
 * `extractConstraintDropBlockers` (`cee/transforms/analysis-ready.ts:1488-1495`)
 * ALWAYS sets `factor_id` and NEVER `option_id`. So on a `needs_user_mapping`
 * turn a constraint drop reaches this wire under the OTHER code and is counted
 * as actionable.
 *
 * That direction FAILS CLOSED — an unwaived code still refuses the run — so it
 * is no regression and no reason to widen the set. It is recorded because the
 * "1:1" shorthand would license exactly the widening that WOULD be one.
 *
 * A DENYLIST, not an allowlist of actionable codes, and the direction is
 * load-bearing. The contract states `code` is a deliberately OPEN vocabulary
 * ("a closed enum here would reject codes a newer producer legitimately
 * emits"). An allowlist would therefore FAIL OPEN: a new actionable code would
 * go uncounted and the gate would let through a run the producer meant to
 * stop. This denylist fails CLOSED — an unrecognised code still refuses. It is
 * the same fail-safe direction CEE argues for its own sibling set at
 * `orchestrator-v5/tools/handlers/analysis-ready-core.ts:371-375`.
 *
 * ⚠ HAND-RESTATED, ONCE, AT THE SINGLE SEAM THAT READS IT — the same
 * concession `ANALYSIS_READINESS_BLOCKED` above makes, for the same reason:
 * the constant lives in CEE and the UI cannot import it.
 *
 * ⚠ AND BE PRECISE ABOUT WHAT PINS IT (corrected 19 Aug 2026). This said the
 * pin "REDs if the producer renames or reclassifies the code". It does not, and
 * cannot: NOTHING IN THIS REPO OBSERVES CEE. A producer-side rename lands green
 * here and silently reopens the defect — the unrecognised code simply refuses
 * the run again, which is the fail-closed direction but is still the wrong
 * answer on a payload CEE calls ready.
 *
 * What the pin actually catches is UI-SIDE DRIFT: this set and the spec's
 * fixtures moving apart, a second code being waived here without a derivation,
 * or the waived code colliding with an actionable one. That is worth having.
 * The producer-side half is only detectable at a live capture or a CEE-side
 * guard, and neither exists — so do not read a green suite as evidence about
 * CEE's vocabulary.
 */
const ADVISORY_BLOCKER_CODES: ReadonlySet<string> = new Set(['CONSTRAINT_REVIEW_REQUIRED'])

/**
 * The blockers that genuinely stand between this model and a run.
 *
 * Bound by the blocker's own `code` IDENTITY, never by position or by raw
 * length — a value predicate another blocker could satisfy is how a gate ends
 * up counting the wrong object.
 *
 * ⭐ THE ARRAY IS THE OWNER, AND THE COUNT IS DERIVED FROM IT (19 Aug 2026).
 *
 * This returned a COUNT until now, and the gate was the only caller — so the
 * SENTENCE beneath the gate was still composed from the RAW list. With one
 * actionable blocker and one advisory one the product refused the run over the
 * first and then named BOTH: `"Launch in Q1" and "Burn rate" are not ready for
 * analysis yet.` `Burn rate` is the blocker this predicate has just decided is
 * NOT blocking, and the sentence sent the user to fix something that cannot
 * unblock the run — a dead end of exactly the kind POC-DONE's PC1 bans.
 *
 * It also contradicted the rule stated at the composition site itself: the
 * reason comes from WHICHEVER AUTHORITY DECIDED. It did — and then described a
 * different list than the one the decision was made on.
 *
 * So the filter is expressed ONCE, as the list, and every consumer derives
 * from it: the gate takes `.length`, the composers take the array. A second
 * filter written beside this one — or a caller that keeps reaching past it to
 * `readiness.blockers` — is the parallel rule this seam exists to abolish.
 */
export function actionableBlockers(
  blockers: readonly AnalysisBlocker[],
): readonly AnalysisBlocker[] {
  return blockers.filter((blocker) => !ADVISORY_BLOCKER_CODES.has(blocker.code))
}

export function readinessObjectsToRun(
  readiness: GraphReadiness | null | undefined,
  analysisReadiness?: AnalysisReadinessAuthority | null,
  mayRun?: boolean,
): boolean {
  // ⭐ SUPERSESSION, APPLIED ONCE, HERE (19 Aug 2026).
  //
  // The precedence lives inside the ONE predicate rather than at the two call
  // sites, for the same reason the predicate itself exists (I-5): the render
  // gate and the dispatch barrier both ask this question, and a precedence rule
  // written twice is the hand-maintained mirror that drifts in the permissive
  // direction. Putting it here also makes the supersession un-bypassable — a
  // future caller cannot accidentally get the old answer by forgetting a
  // clause, because there is no clause to forget.
  //
  // Note what this deliberately does NOT do: it does not consult `readiness`
  // at all once the producer has spoken. A conjunction or a disjunction here
  // would be a PARALLEL RULE — two authorities kept in a relationship — which
  // is exactly the shape that produced the defect.
  if (analysisReadiness) {
    // ⭐ TWO CLAUSES, BOTH DRAWN FROM THE SAME AUTHORITY — still one owner.
    //
    // (a) `status === 'blocked'` — DERIVED, not assumed. It is the one member of
    //     the vocabulary that cannot describe a runnable model, and it is
    //     provably different from the other three non-ready values:
    //       · it is ABSENT from the payload-status priority chain that grades an
    //         ordinary model (`cee/transforms/analysis-ready.ts:958-969` emits
    //         only needs_user_input | needs_user_mapping | needs_encoding |
    //         ready — 0 occurrences of 'blocked'; contrast control in the same
    //         range: 'needs_encoding' appears twice);
    //       · its only writers are genuine refusal / hard-block paths —
    //         `analysis-ready-helper.ts:1117` (hardBlocked), `:1123` (no
    //         semantic payload at all) and `buildAnalysisRefusalReadiness:1440`.
    //     `buildAnalysisRefusalReadiness` emits `status: 'blocked'` with NO
    //     `blockers` key, so on a refusal turn the list is `[]` — and without
    //     this clause the Analyse control would turn ENABLED one turn after CEE
    //     refused the run. The user clicks, and is refused again.
    //
    // (b) `actionableBlockers(...).length > 0` — the itemised impediments that
    //     genuinely stand in the way, for every other stated status.
    //
    // ⚠ (b) WAS A RAW `blockers.length > 0` UNTIL THIS CHANGE, AND THAT WAS THE
    // SAME DEFECT IN A NEW SPELLING. The comment below already cited CEE's
    // integrity guard as corroboration — but read only its first half. The
    // guard flags `status_ready_with_actionable_blockers` and deliberately
    // EXCLUDES advisory blockers precisely BECAUSE those "ride along on
    // otherwise ready payloads by design"; the exclusion is evidence the
    // combination OCCURS, not that it cannot. Derived at CEE `a61fe7ff`: a
    // `constraint_dropped` blocker is injected onto an already-`ready` payload
    // without recomputing status, and reaches this wire unfiltered (the full
    // chain is on `ADVISORY_BLOCKER_CODES` above). A raw count therefore
    // refuses a model the producer has just called ready — while the SAME
    // payload's `usable_for_prose` / `usable_for_chips` stay true, so the
    // product would contradict itself on one turn.
    //
    // The count is CHANGED, not supplemented: there is exactly one run-gate
    // predicate, and an actionability check bolted beside the old count would
    // be the parallel rule this seam exists to abolish.
    //
    // ⚠ WHY NOT THE SIMPLER `status !== 'ready'`. It was proposed, and it is
    // REFUTED at the producer: two non-ready statuses describe models that ARE
    // analysable.
    //   · `needs_user_mapping` fires on `unreachableControllableBlockers`
    //     (`analysis-ready.ts:961`) — a controllable factor with no inbound
    //     option edge, which that file's own payload step calls "informational,
    //     alongside existing blockers". A model with fully-encoded options and
    //     one unconnected factor is analysable and would be refused.
    //   · `needs_encoding` (`:966`) is EXACTLY the UI-SEM-091 scaffold state,
    //     whose whole shipped point (CEE #612, and the comment at the scaffold
    //     rung below) is that "the graph is runnable even though
    //     can_run_analysis is false" — the run triggers the draft. Refusing it
    //     would delete a shipped capability.
    // Corroborated by CEE's own integrity guard, which flags only
    // `status_ready_with_actionable_blockers`
    // (`canonical-analysis-state.ts:494`) and deliberately excludes advisory
    // blockers that "ride along on otherwise ready payloads by design". There is
    // no reverse guard, because non-ready-yet-runnable is not an anomaly there —
    // it is normal.
    //
    // So the honest predicate refuses what is provably unrunnable and lets the
    // producer's itemised list decide the rest. Refusing on a status whose cause
    // we cannot name would re-create the original defect in a new spelling.
    // ⭐ (c) `mayRun` — CEE'S OWN ADMISSION VERDICT, WAIVING (b) AND ONLY (b).
    //
    // THE DEFECT. `resolveRunAdmission` waives three blocker codes by EXCLUDING
    // the incomplete option and running on the rest
    // (`analysis-ready-core.ts:378-382` — MISSING_OPTION_VALUE,
    // OPTION_NEEDS_ENCODING, OPTION_NEEDS_MAPPING). Those are `option_values` /
    // `option_mapping`, so nothing is hard-blocked and the status stays
    // `needs_user_input` — yet the blockers still ride the wire, and every one
    // of them is ACTIONABLE here. So (b) counted them and this control refused a
    // model CEE would have analysed that instant, while `SuggestedChips.tsx:267`
    // rendered a live "Run analysis" chip on the very same payload. Two Olumi
    // affordances contradicting each other on one screen.
    //
    // ⚠ THE UI CANNOT RECOVER THIS FROM THE AUTHORITY. CEE stamps
    // `waived_by_exclusion: true` on the waived issue, but `@talchain/schemas`
    // 0.48.0 types `AnalysisBlockerSchema` `.strict()` with exactly eight fields
    // and `AnalysisReadinessSchema` `.strict()` with exactly `{status,
    // blockers}` — neither can carry it, and no reading of `status` recovers it
    // either (CEE measured ONE status carrying BOTH admission verdicts on the
    // `live-4day-week` capture, `analysis-ready-helper.ts:1190-1194`). Hence a
    // separate argument, sourced from the `analysis_ready` slice where CEE does
    // publish it — the same value `admitsRunAffordance` already gates the chip
    // on, so the two affordances now answer from one fact.
    //
    // ⭐⭐ WHY IT WAIVES (b) ALONE AND NOT `(a) || (b)`. The whole-predicate
    // form is the obvious shape and it RE-OPENS THE DEFECT (a) EXISTS TO CLOSE,
    // because `may_run` CAN GO STALE ACROSS A REFUSAL TURN.
    //
    // ⚠⚠ THE MECHANISM BELOW WAS RE-DERIVED 2026-08-26 AND THIS COMMENT NAMED
    // THE WRONG BRANCH. The conclusion — that `may_run` can be a PREVIOUS
    // turn's answer, so the waiver must not span (a) — is UNCHANGED and still
    // correct. Only the route was wrong, and a comment naming the wrong
    // mechanism is how the next lane inherits a wrong belief.
    //
    // ~~It said: the degenerate refusal payload is rejected by our normaliser,
    // and `:1219` writes the slice only `if (normalised)`, so `ceeAnalysisReady`
    // KEEPS THE PREVIOUS TURN'S value.~~ **That branch CLEARS, it does not
    // preserve.** Derived at `applyV5State.ts:1228-1300`, there are FOUR
    // branches and exactly one preserves:
    //
    //   1. `analysis_ready` present, normalises      → WRITE (unless the inline
    //                                                  path owns it, `:1231`)
    //   2. present, normaliser REJECTS               → `setCeeAnalysisReady(null)`
    //                                                  — CLEARS ("clear stale
    //                                                  store state from prior
    //                                                  turns rather than leaving
    //                                                  it to mislead")
    //   3. ABSENT + response IS analyse-shaped       → `setCeeAnalysisReady(null)`
    //                                                  — CLEARS
    //   4. ABSENT + NOT analyse-shaped               → ⭐ NO WRITE. THE SLICE IS
    //                                                  PRESERVED, stale
    //                                                  `may_run: true` included.
    //
    // ⭐ BRANCH 4 IS THE SURVIVING STALENESS PATH, and it is deliberate, with
    // its own recorded rationale: "Conversational turns preserve the existing
    // slice — clearing would race a legit just-set value from a parallel turn."
    // `responseIsAnalyseShaped` (`applyV5State.ts:1453`) is true ONLY for
    // `stage === 'analyse'` or an `analysis_result` block — so an ordinary
    // conversational or EDIT turn that carries no `analysis_ready` lands here
    // and leaves the previous turn's admission verdict standing.
    //
    // A waiver spanning (a) would then hand the user an ENABLED control one turn
    // after CEE refused the run — verbatim the harm recorded at (a) above. The
    // producer's refusal is not a blocker count and is not negotiable.
    //
    // ⚠ AND THE DEEPER POINT, WHICH THE BRANCH DETAIL CAN OBSCURE: this control
    // is gated on `may_run` — CEE's ADMISSION verdict — and NOT on
    // `can_run_analysis`, which lives on the readiness side-car. Two fields,
    // two lifetimes, similar names (trap 21). `may_run` is turn-scoped and, via
    // branch 4, can outlive the turn that produced it; `can_run_analysis` is
    // the field that actually answers "may this model be analysed now". A
    // control reading the one that does not answer its question is the design
    // issue here — branch 4 is only the route by which it becomes visible.
    // Behaviour is UNCHANGED by this comment; the repair is rowed, and it
    // belongs in the slice's freshness (`applyV5State.ts`), NOT in this
    // predicate — every surface consumes this answer, so fixing the input is
    // safe where fixing the shared predicate is not.
    //
    // ⚠ `=== true`, NOT `!== false`. ABSENCE means a pre-`may_run` CEE, never
    // "no", so an omitted or malformed value must leave the refusal exactly as
    // it is today — the two services stay deploy-order independent, and this
    // change can only ever NARROW the refusal. Same polarity, same reasoning as
    // `admitsRunAffordance` (`useAnalysisReady.ts:64-68`).
    //
    // ⚠ AND IT DOES NOT MOVE INTO `actionableBlockers`. The blocker is REAL and
    // must stay itemised for every surface that lists impediments; waiving it
    // there would delete it from those lists as well as from the gate. The
    // waiver is about admission, not about actionability.
    return (
      analysisReadiness.status === ANALYSIS_READINESS_BLOCKED ||
      (actionableBlockers(analysisReadiness.blockers).length > 0 && mayRun !== true)
    )
  }

  // ⏳ REMOVAL TRIGGER for the side-car fallback below.
  //
  // This is NOT a pre-0.46-only shim and must not be read as one. The producer
  // verdict is TURN-SCOPED: `analysisStateV1` is cleared on turn silence and on
  // a schema-parse failure (`applyV5State.ts`), on import / reset /
  // scenario-switch (`store.ts`), and is `null` at initial load — and CEE omits
  // `analysis_state` on most `sendFinalised200` exits. So this branch fires
  // routinely mid-journey, and ONE SILENT TURN re-opens the defect this lane
  // closed. Keeping it is still correct: it is byte-identical to the behaviour
  // shipping today, and deleting it now would hand a fresh user a dead Analyse
  // control on any turn CEE stays quiet.
  //
  // DELETE THIS BRANCH, AND THE `readiness` PARAMETER WITH IT, WHEN — and only
  // when — the producer verdict is durable across a silent turn: i.e. when
  // `analysisStateV1` is either RETAINED (with its own staleness mark) rather
  // than cleared on absence, or re-supplied on every turn. Until one of those
  // holds, a consumer with no verdict has no honest alternative to asking the
  // side-car. The condition is about the STORE'S RETENTION POLICY, not about a
  // schema version, and no date makes it true.
  return Boolean(readiness) && !readiness!.can_run_analysis && !readinessWillScaffold(readiness)
}

/**
 * The identity of the verdict that licensed a run (ROADMAP 2.635, I-4).
 *
 * `verdictAtMs` is stamped only when `readiness` is set from a real ANSWER, so
 * the pair (`verdictAtMs`, `stale`) identifies WHICH assessment the gate was
 * computed against — including the case where no assessment exists at all.
 */
export interface ReadinessVerdictLicence {
  verdictAtMs: number | null
  stale: boolean
}

/**
 * Has the verdict that licensed a run been SUPERSEDED since the gate opened?
 * (ROADMAP 2.635, I-4.)
 *
 * The run gate is evaluated during render; the click that acts on it dispatches
 * later, and `runCanonicalAnalysis` awaits a persistence flush in between. That
 * await is a real window: a fresh verdict, or a staleness mark, can land inside
 * it. Today nothing binds the click to the verdict that opened the gate, so a
 * run dispatched against a superseded assessment is indistinguishable from one
 * dispatched against a current one — which makes a doomed run un-attributable.
 *
 * This answers only the IDENTITY question. Whether a superseded licence should
 * stop the run is the caller's decision, and it is taken by asking
 * `readinessObjectsToRun` about the CURRENT verdict — one gate authority, asked
 * twice, never re-implemented.
 */
export function verdictLicenceSuperseded(
  licensed: ReadinessVerdictLicence,
  current: ReadinessVerdictLicence,
): boolean {
  return licensed.verdictAtMs !== current.verdictAtMs || licensed.stale !== current.stale
}

/**
 * The refusal shown when a run was licensed by a verdict that has since been
 * replaced by a refusal. Transient and actionable by construction: the fresh
 * verdict is already in the store, so pressing Analyse again re-evaluates
 * against it and either runs or names the real reason.
 */
export const RUN_LICENCE_SUPERSEDED_REFUSAL =
  'Your model changed while the analysis was starting. Press Analyse again to run the current model.'

/**
 * Determine if analysis can run based on current state
 *
 * @param params - State from store and hooks
 * @returns CanRunAnalysisResult with allowed status and reason
 */
export function canRunAnalysis(params: CanRunAnalysisParams): CanRunAnalysisResult {
  // ⚠ `mayRun` is deliberately NOT defaulted here. `undefined` is the signal
  // "the producer did not say", and a default would erase the very distinction
  // `readinessObjectsToRun` reads it for.
  const { graphHealth, readiness, analysisReadiness = null, mayRun, hasBlockers, nodeCount, isRunning = false, analysisHeldOn = null, draftStreamPhase = 'idle', optionsNeedingValues, readinessStale = false } = params

  const blockingReasons: string[] = []

  // 1. Check if already running
  if (isRunning) {
    return {
      allowed: false,
      reason: 'Analysis is currently running',
      blockingReasons: ['Analysis in progress'],
    }
  }

  // 2. Check minimum requirements
  if (nodeCount === 0) {
    return {
      allowed: false,
      reason: 'Add some nodes to get started',
      blockingReasons: ['No nodes in graph'],
    }
  }

  // 2.4 A streamed draft's structure is on screen but its VALUES are not
  // settled (ROADMAP 2.122). Ordered BEFORE ceeCannotSeeModel deliberately: a
  // GRAPH_READY preview is also not yet in CEE's scenario state, so both rungs
  // apply, and this one names the actual situation instead of telling the user
  // to "draft a model first" while a model is visibly being drafted.
  // The two in-progress phases block for the same reason and say DIFFERENT things
  // about it, because one is still in flight and one has terminally ended (F5).
  // `draftValuesAreUnsettled` is the single classifier — a new phase must be
  // classified there rather than defaulting to "settled".
  if (draftValuesAreUnsettled(draftStreamPhase)) {
    return {
      allowed: false,
      reason:
        draftStreamPhase === 'unsettled'
          ? DRAFT_VALUES_UNSETTLED_REFUSAL
          : DRAFT_VALUES_SETTLING_REFUSAL,
      blockingReasons: [
        draftStreamPhase === 'unsettled'
          ? 'Streamed draft ended without its final values'
          : 'Streamed draft has not finished — values are still settling',
      ],
    }
  }

  // 2.5 Model invisible to the analysis engine (see `analysisHeldOn`). The
  // gating answer and the sentence come from the SAME value, so this rung
  // cannot refuse for one reason and explain itself with another.
  if (analysisHeldOn !== null) {
    return {
      allowed: false,
      reason: HELD_NOTICE[analysisHeldOn],
      blockingReasons: ['Model not in Olumi scenario state (client-injected graph)'],
    }
  }

  // 3. Check for validation blockers
  const validationBlockers = graphHealth?.issues?.filter(
    (issue) => issue.severity === 'error' || issue.severity === 'blocker'
  ) || []

  if (validationBlockers.length > 0) {
    for (const blocker of validationBlockers) {
      const message = blocker.message || blocker.code || blocker.type || 'Validation error'
      blockingReasons.push(message)
    }
  }

  // 4. Check unified action blockers
  if (hasBlockers) {
    // hasBlockers is already computed from useUnifiedActions
    // Only add if we haven't already captured from validation
    if (blockingReasons.length === 0) {
      blockingReasons.push('Critical issues need to be resolved')
    }
  }

  // 5. Check CEE readiness
  //
  // UI-SEM-091: runnable-via-scaffold. CEE (#612) rides a scaffold intent on
  // the readiness response — when it will draft the remaining options
  // (scaffold_plan.will_scaffold_options), the run triggers that draft, so the
  // graph is runnable even though can_run_analysis is false. Effective gate:
  //   allowed = can_run_analysis || scaffold_plan.will_scaffold_options === true
  // Fail-safe: scaffold_plan absent/undefined ⇒ this term is false, so the gate
  // collapses to `allowed = can_run_analysis`, byte-identical to pre-scaffold.
  //
  // ⚠ The reason is COMPOSED, not quoted (Paul, 28 Jul). This used to push
  // `readiness.confidence_explanation` — CEE's own refusal sentence — and that
  // one string is what every blocked surface shows: the footer subline, the
  // footer/rerun tooltips, the panel toast, and the ⌘Enter toast. Its wording
  // (`V3 analysis not ready: 1 option(s) blocked: opt_extend`) carries a
  // glossary-banned term, an internal node id, and no remedy. On the guarded
  // surfaces the banned term had no substitution, so the guard DEGRADED to
  // `'Add a decision, a goal and at least two options'` — a false claim about a
  // model that already had all three; on the unguarded ⌘Enter surface the raw
  // id leaked. Three surfaces, three different stories, none of them useful.
  //
  // `composeReadinessBlockedReason` renders the SAME verdict from its STRUCTURED
  // fields, in the product's own language, with the actual remedy named. It
  // never parses the engine's prose (that would just move the mirror) and never
  // asserts a fact the panel's own counts could contradict.
  // ROADMAP 2.635 (I-5) — the rung's predicate is `readinessObjectsToRun`, so
  // the dispatch barrier can ask the SAME question without re-implementing it.
  if (readinessObjectsToRun(readiness, analysisReadiness, mayRun)) {
    // ⭐ The reason comes from WHICHEVER AUTHORITY DECIDED, never from the other
    // one. A refusal explained by a verdict that did not make it is the
    // two-questions-one-name defect wearing the fix's clothes: the gate would
    // be right and the sentence beneath it would be about a different
    // assessment. `readinessObjectsToRun` chose above; this chooses the same
    // way, from the same value, one line later.
    //
    // ⚠ `readinessStale` is deliberately NOT forwarded on the canonical branch.
    // It is `readinessStore.stale` — a fact about the SIDE-CAR's evidence, not
    // about the producer's. Letting it rewrite a producer-stated refusal into
    // "Olumi is checking again" would re-mix the two authorities in the very
    // act of separating them, and would claim a refetch is in flight for a
    // verdict no refetch will touch.
    //
    // ROADMAP 2.635 (I-3) — on the legacy branch the staleness mark still
    // travels WITH the verdict into the composer, passed through rather than
    // pre-derived here, for the same reason `draftStreamPhase` is (2.122): a
    // predicate re-derived at each call site is a hand-maintained mirror, and
    // the mutant that drops one clause from it survives.
    //
    // ⚠ AND THE SAME LIST, NOT JUST THE SAME AUTHORITY (19 Aug 2026). Choosing
    // the right authority is only half of it: this composed from
    // `analysisReadiness.blockers` RAW while the gate one line up decided on
    // the ACTIONABLE subset, so the sentence named blockers the gate had just
    // ruled out. `actionableBlockers` is the one filter both now read — see its
    // header for the sentence that shipped.
    const composed = analysisReadiness
      ? composeAnalysisBlockedReason(actionableBlockers(analysisReadiness.blockers))
      : composeReadinessBlockedReason(readiness, optionsNeedingValues, readinessStale)
    if (!blockingReasons.includes(composed)) {
      blockingReasons.push(composed)
    }
  }

  // Determine result
  if (blockingReasons.length > 0) {
    // Format the primary reason
    const primaryReason = blockingReasons[0]
    const additionalCount = blockingReasons.length - 1

    let reason = primaryReason
    if (additionalCount > 0) {
      reason += ` (+${additionalCount} more ${additionalCount === 1 ? 'issue' : 'issues'})`
    }

    return {
      allowed: false,
      reason,
      blockingReasons,
    }
  }

  // Analysis allowed - check for warnings
  let warning: string | undefined

  // Warn if readiness is low but not blocking.
  //
  // ⚠ `fair` MUST stay an exact match. Until 2026-07-27 the readiness
  // normaliser coerced CEE's top band (`ready`, score >= 70) to `fair`, so this
  // branch fired for every well-formed model and the Run button's tooltip told
  // a model CEE had just called READY to go and improve itself. `ready` and
  // `strong` deliberately have no branch here: the correct guidance for the top
  // band is silence, and adding a case for them would re-create the defect in a
  // new spelling.
  if (readiness?.readiness_level === 'fair') {
    warning = 'Analysis available - consider improvements for better results'
  }

  // Warn if there are non-blocking validation warnings
  const validationWarnings = graphHealth?.issues?.filter(
    (issue) => issue.severity === 'warning'
  ) || []

  if (validationWarnings.length > 0 && !warning) {
    warning = `${validationWarnings.length} optional improvement${validationWarnings.length === 1 ? '' : 's'} available`
  }

  return {
    allowed: true,
    warning,
  }
}

/**
 * Get tooltip text for the Run button based on canRunAnalysis result
 */
export function getRunButtonTooltip(result: CanRunAnalysisResult): string | undefined {
  if (!result.allowed && result.reason) {
    return result.reason
  }
  if (result.warning) {
    return result.warning
  }
  return undefined
}

/**
 * Get aria-label for the Run button
 */
export function getRunButtonAriaLabel(result: CanRunAnalysisResult, isRunning: boolean): string {
  if (isRunning) {
    return 'Analysis running…'
  }
  if (!result.allowed) {
    return `Run analysis (blocked: ${result.reason || 'issues need to be resolved'})`
  }
  return 'Run analysis'
}

/**
 * Get the button label based on graph state.
 * Standardised to "Run analysis" sentence-case across all CTAs (matches
 * useAnalysisDisplayState helper output and CanvasToolbar tooltip).
 */
export function getRunButtonLabel(result: CanRunAnalysisResult, isRunning: boolean): string {
  if (isRunning) {
    return 'Running analysis…'
  }
  if (!result.allowed && result.blockingReasons && result.blockingReasons.length > 0) {
    return 'Fix issues'
  }
  return 'Run analysis'
}

// =============================================================================
// NUDGE PRIORITIZATION
// =============================================================================

export interface PrioritizedNudge {
  type: 'validation' | 'coaching'
  severity: 'critical' | 'warning' | 'info'
  message: string
  action?: string
  affectedIds?: string[]
}

/**
 * Prioritize nudges by severity
 * Brief: Validation issues first, then coaching suggestions
 * Sorted: critical > warning > info
 */
export function prioritizeNudges(
  validationIssues: Array<{ severity: string; message: string; suggestedFix?: { targetId: string } }>,
  coachingNudges: Array<{ severity: 'high' | 'medium' | 'low'; message: string; action?: string }>
): PrioritizedNudge[] {
  const severityOrder: Record<string, number> = {
    critical: 0,
    error: 0,
    high: 0,
    warning: 1,
    medium: 1,
    info: 2,
    low: 2,
  }

  // Convert validation issues to nudges
  const issueNudges: PrioritizedNudge[] = validationIssues.map(issue => ({
    type: 'validation' as const,
    severity: (issue.severity === 'error' ? 'critical' : issue.severity) as 'critical' | 'warning' | 'info',
    message: issue.message,
    action: issue.suggestedFix ? 'Fix' : undefined,
    affectedIds: issue.suggestedFix ? [issue.suggestedFix.targetId] : undefined,
  }))

  // Convert coaching nudges
  const coachNudges: PrioritizedNudge[] = coachingNudges.map(nudge => ({
    type: 'coaching' as const,
    severity: (nudge.severity === 'high' ? 'critical' : nudge.severity === 'medium' ? 'warning' : 'info') as 'critical' | 'warning' | 'info',
    message: nudge.message,
    action: nudge.action,
  }))

  // Combine and sort by severity
  return [...issueNudges, ...coachNudges].sort((a, b) => {
    return (severityOrder[a.severity] ?? 2) - (severityOrder[b.severity] ?? 2)
  })
}
