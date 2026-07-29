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
import type { GraphReadiness } from '../hooks/useGraphReadiness'
import { isV5CanonicalRunPath } from '../../v5/eligibility'
import {
  composeReadinessBlockedReason,
  type OptionNeedingValues,
} from './composeBlockedReason'

/**
 * CEE's refusal sentence, verbatim — the gate must show the engine's own
 * words so panel and chat never contradict each other. If CEE rewords its
 * refusal, this constant (and the spec pinning the raw literal) must follow.
 */
export const CEE_DRAFT_FIRST_REFUSAL = 'Draft or save a model first, then run analysis.'

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

/**
 * Provenance stamps that mark a graph as INJECTED CLIENT-SIDE rather than
 * produced by a CEE turn.
 *
 * `templateId` — stamped only by insertBlueprint (PLoT template insert).
 * `starterId`  — stamped only by applyStarter (pre-drafted starter scenario,
 *                src/canvas/starters/loadStarter.ts).
 *
 * No CEE draft path stamps either one, which is exactly what makes them a
 * sound discriminator. Kept as one named list so a third injection source
 * cannot be added without meeting this decision.
 */
const CLIENT_INJECTED_PROVENANCE_KEYS = ['templateId', 'starterId'] as const

/**
 * True when the canvas model is invisible to the analysis engine: the graph was
 * injected client-side (see CLIENT_INJECTED_PROVENANCE_KEYS) AND the run would
 * route through CEE, which analyses its own scenario state — not the canvas
 * (#343). A V2-direct run can analyse canvas graphs, so the gate stays open off
 * the canonical path.
 *
 * The V5 turn body carries no graph at all — `src/v5/buildPayload.ts` emits
 * turn ids/stage/message/source/chip and the vendored MessageTurnPayloadSchema
 * is `.strict()` — so CEE's only route to the nodes is its persisted scenario
 * row, which `flushPendingGraphSave` writes ONLY when persistence is active.
 * A guest session therefore has no server-side graph for an injected model, and
 * refusing the run is the honest outcome: the alternative is dispatching a run
 * that returns an answer about a graph nobody analysed.
 *
 * ONE home for the predicate: both gate callers (OutputsDock,
 * ConversationPanel) consume this instead of re-deriving it.
 */
export function computeCeeCannotSeeModel(
  nodes: ReadonlyArray<{ data?: Record<string, unknown> | undefined }>,
): boolean {
  return (
    isV5CanonicalRunPath() &&
    nodes.some((n) => CLIENT_INJECTED_PROVENANCE_KEYS.some((k) => n.data?.[k] != null))
  )
}

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

export interface CanRunAnalysisParams {
  /** Graph health from validation */
  graphHealth: GraphHealthState | null
  /** Graph readiness from CEE */
  readiness: GraphReadiness | null
  /** Whether there are critical/blocking actions */
  hasBlockers: boolean
  /** Number of nodes in graph */
  nodeCount: number
  /** Whether analysis is currently running */
  isRunning?: boolean
  /** See computeCeeCannotSeeModel — the model exists only client-side and
   *  the run routes through CEE, so the engine would refuse it (#343). */
  ceeCannotSeeModel?: boolean
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
 * Determine if analysis can run based on current state
 *
 * @param params - State from store and hooks
 * @returns CanRunAnalysisResult with allowed status and reason
 */
export function canRunAnalysis(params: CanRunAnalysisParams): CanRunAnalysisResult {
  const { graphHealth, readiness, hasBlockers, nodeCount, isRunning = false, ceeCannotSeeModel = false, draftStreamPhase = 'idle', optionsNeedingValues } = params

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

  // 2.5 Model invisible to the analysis engine (see computeCeeCannotSeeModel).
  if (ceeCannotSeeModel) {
    return {
      allowed: false,
      reason: CEE_DRAFT_FIRST_REFUSAL,
      blockingReasons: ['Model not in Olumi scenario state (template insert)'],
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
  if (
    readiness &&
    !readiness.can_run_analysis &&
    !readinessWillScaffold(readiness)
  ) {
    const composed = composeReadinessBlockedReason(readiness, optionsNeedingValues)
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
