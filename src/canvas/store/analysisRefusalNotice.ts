/**
 * Analysis-refusal notice slice — sourced ONLY from a TYPED refusal on
 * `response.analysis_ready` (CEE PR #942, ROADMAP 2.1085 root 2.1041 / EXT-2).
 *
 * WHY THIS SLICE EXISTS, AND WHY IT IS NOT THE READINESS SLICE
 * ------------------------------------------------------------
 * CEE now emits, on a refused analyse turn:
 *
 *   analysis_ready: { status: 'blocked', blocked_reason: <specific code>,
 *                     options: [], goal_node_id: '', freshness, computed_at }
 *
 * `applyV5State`'s readiness normaliser REJECTS that carrier (empty
 * `goal_node_id` / empty `options`) and clears `ceeAnalysisReady`. That
 * rejection is CORRECT and deliberate — a deployed-UI trace (2026-08-14)
 * established the clearing kills two harms, and the R1-R3 dynamics are
 * premised on it. So the refusal is NOT routed back into readiness. It gets
 * this separate, lightweight, SESSION-LOCAL field instead, extracted from the
 * raw payload before validation.
 *
 * ⚠ TWO DISTINCT `status: 'blocked'` CARRIERS EXIST — derived at the CEE bytes
 * (PR #942 head 2ca6c079), not inferred. Only one is a refusal:
 *
 *   1. REFUSAL  `buildAnalysisRefusalReadiness()`
 *               src/orchestrator/tools/analysis-ready-helper.ts:400-409
 *               ALWAYS carries a non-empty `blocked_reason`.
 *   2. LEGACY   `synthesiseFreshnessOnlyAnalysisReady()`
 *               src/orchestrator-v5/compose/analysis-ready-emit.ts:59-61
 *               `{ status:'blocked', goal_node_id:'', options:[], bias_findings:[] }`
 *               and NO `blocked_reason` — a freshness carrier emitted on
 *               legacy/unparseable RELOADS. It says nothing about a refusal.
 *
 * The discriminator is therefore the PRESENCE of a non-empty `blocked_reason`,
 * never `status` alone. Keying on `status === 'blocked'` would fabricate "this
 * analysis did not run" on every legacy reload — a surface claiming a refusal
 * that never happened. Carrier (2) is pinned by
 * `src/v5/__tests__/applyV5State.blockedAnalysisReady.spec.tsx`.
 *
 * NEVER PERSISTED. The canvas store has no `persist()` middleware — persistence
 * is opt-in per setter (sessionStorage in `setCeeAnalysisReady`, the autosave
 * projection allow-list). This field is deliberately in none of them: a refusal
 * is a fact about ONE turn, and restoring it into a later session would assert
 * a refusal that did not occur in that session.
 */

/** What CEE told us about the refusal. Technical fields — never user copy. */
export interface AnalysisRefusalNotice {
  /** CEE's `blocked_reason`, verbatim. Machine-readable; shown only in the details disclosure. */
  readonly blockedReason: string
  /** CEE's `computed_at` when present. Debug/ordering only — never fabricated. */
  readonly computedAt: string | null
}

/**
 * Three-valued because "no determination" is a real, distinct outcome and
 * collapsing it into `clear` would drop the notice on the very next
 * conversational turn — i.e. before the user had a chance to read it.
 */
export type AnalysisRefusalNoticeUpdate =
  | { kind: 'set'; notice: AnalysisRefusalNotice }
  | { kind: 'clear' }
  | { kind: 'retain' }

/** Past tense, factual. States what happened; claims nothing about why on its own. */
export const ANALYSIS_REFUSAL_HEADLINE = 'This analysis did not run.'

/**
 * Honest generic for an unmapped code. Deliberately says LESS than the mapped
 * lines: an unrecognised code is not licence to guess a specific cause.
 */
export const ANALYSIS_REFUSAL_GENERIC_REASON =
  'The analysis was stopped before it ran.'

/**
 * The one pointer line. TRUE BY CONSTRUCTION, not by convention: CEE's
 * `composeHandlerFailureBody` sets `assistant_text` on EVERY recoverable
 * branch (handler-failure-responses.ts:72-330), and the recovery chip lives
 * in that reply. So this names a LOCATION that always exists rather than
 * instructing a control this notice does not render (#684 review, D2).
 */
export const ANALYSIS_REFUSAL_POINTER =
  "The assistant's reply explains the next step."

/**
 * `blocked_reason` -> ONE precise, actionable sentence.
 *
 * ⚠ EVERY KEY IS DERIVED FROM THE CEE PRODUCER, NEVER FROM OUR OWN READING OF
 * WHAT A FIELD "OUGHT" TO MEAN (CLAUDE.md trap 13c). `blockedReasonForHandler-
 * Failure` (handler-errors.ts:196-202) returns `details.reason_code` when
 * present, else the typed `cause_kind`; the scope gate is `run_analysis` only
 * (ANALYSE_HANDLER_ID, handler-errors.ts:173). Sentences are aligned with the
 * copy CEE puts in the chat for the same code, so the two surfaces cannot
 * contradict each other.
 *
 * ⚠ LOOKUP IS EXACT, NEVER CASE-FOLDED. The producer emits both
 * SCREAMING_SNAKE (ReadinessReasonCode / StructuralViolationCode) and
 * lower_snake (cause_kind / scale reason_code). Folding case would let an
 * unrecognised variant inherit a specific sentence it was never entitled to —
 * the fabrication this whole slice exists to prevent.
 *
 * ⚠ DELIBERATELY ABSENT: `parameter_invalid_at_execute`,
 * `entity_not_found_in_graph`, `entity_kind_mismatch_at_execute`,
 * `precondition_unmet_at_execute`. They are on RECOVERABLE_HANDLER_CAUSES but
 * `run_analysis` never throws them — the D1 mutation handlers do. CEE
 * turn-executor.ts:8684-8697 records that emitting a blocked analysis readiness
 * for them was "a false claim that the ANALYSIS is blocked", and added the
 * ANALYSE_HANDLER_ID gate to stop it. Giving them analysis-specific copy here
 * would re-assert that exact claim one layer up. They fall to the generic.
 */
export const ANALYSIS_REFUSAL_REASON_COPY: Readonly<Record<string, string>> = {
  // ── cause_kind fallbacks reachable from run_analysis ──────────────────
  // (run_analysis throws) INTERSECT RECOVERABLE_HANDLER_CAUSES
  args_validation_failed:
    'The analysis request was not valid, so nothing was computed.',
  analysis_not_ready:
    'Your model needs a change before it can be analysed.',
  options_not_configured:
    "Your options don't have intervention values yet, so there was nothing to compare.",
  analysis_engine_busy:
    'The analysis engine was busy with other runs. Nothing is wrong with your model.',
  analysis_blocked:
    'The analysis engine could not proceed with this scenario as it stands.',

  // ── reason_code, scale family (plot-intervention-scale.ts:808-833) ────
  mixed_scale_unresolved:
    'Your option values mix different scales, and the analysis could not tell which was meant.',
  baseline_scale_unresolved:
    'The baseline for one or more option values could not be established, so their scale was ambiguous.',
  scale_postcondition_violated:
    'The option values did not resolve to a consistent scale.',

  // ── reason_code, ReadinessReasonCode (analysis-ready-core.ts:53-66) ───
  OPTIONS_NOT_CONFIGURED:
    "Your options don't have intervention values yet, so there was nothing to compare.",
  NO_GRAPH: 'There is no saved model to analyse yet.',
  SCHEMA_INVALID: 'The saved model could not be read.',
  UNIT_MISMATCH: 'Your option values use units that do not match.',
  NO_CAP_UNRECOVERABLE:
    'An option value has no upper bound to scale against.',
  OPTION_INTERVENTION_UNRESOLVABLE:
    "An option's effect could not be resolved to a value.",
  INTERNAL_ERROR:
    'The analysis stopped on an internal error. This is on our side, not your model.',

  // ── reason_code, StructuralViolationCode (graph-structure-validator.ts:22-32)
  NO_GOAL: 'The model has no goal, so there was nothing to analyse towards.',
  NO_DECISION: 'The model has no decision to analyse.',
  FEWER_THAN_TWO_OPTIONS:
    'The decision needs at least two options before they can be compared.',
  NO_PATH_TO_GOAL:
    'No option connects to the goal through the model, so there was nothing to compute.',
  CYCLE_DETECTED:
    'The model contains a circular chain of influence, which the analysis cannot resolve.',
  ORPHAN_NODE: 'The model has a node that is not connected to anything.',
  OPTION_NO_FACTOR_EDGES:
    'An option is not linked to any factor, so it has no measurable effect.',
  OPTION_NOT_LINKED_TO_DECISION: 'An option is not linked to the decision.',
  NODE_LIMIT_EXCEEDED: 'The model has more nodes than the analysis can handle.',
  EDGE_LIMIT_EXCEEDED:
    'The model has more connections than the analysis can handle.',
}

/**
 * The mapped sentence for a `blocked_reason`, or `null` when the code is not in
 * the derived vocabulary. `null` means "say the honest generic and disclose the
 * raw code" — never "invent a plausible specific".
 */
export function describeAnalysisRefusalReason(
  blockedReason: string,
): string | null {
  return Object.prototype.hasOwnProperty.call(
    ANALYSIS_REFUSAL_REASON_COPY,
    blockedReason,
  )
    ? ANALYSIS_REFUSAL_REASON_COPY[blockedReason]
    : null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

/**
 * Decide what this turn says about a refusal.
 *
 *   set    — a typed refusal carrier (blocked + non-empty blocked_reason).
 *   clear  — CEE stated readiness (a non-blocked analysis_ready), or a run
 *            produced an analysis_result. Either supersedes a prior refusal.
 *   retain — everything else, including the LEGACY blocked carrier and any
 *            malformed input. Silence is not evidence that the refusal is over.
 *
 * Total over unknown input by construction: anything unrecognised retains.
 */
export function deriveAnalysisRefusalNoticeUpdate(
  response: unknown,
): AnalysisRefusalNoticeUpdate {
  const envelope = asRecord(response)
  if (!envelope) return { kind: 'retain' }

  const raw = asRecord(envelope.analysis_ready)
  if (raw) {
    if (raw.status !== 'blocked') {
      // CEE spoke about readiness and did not refuse — any prior refusal is
      // superseded. (Includes 'ready', 'needs_user_mapping', 'needs_encoding'.)
      return { kind: 'clear' }
    }
    const reason = raw.blocked_reason
    if (typeof reason === 'string' && reason.trim().length > 0) {
      const computedAt = raw.computed_at
      return {
        kind: 'set',
        notice: {
          blockedReason: reason,
          computedAt: typeof computedAt === 'string' ? computedAt : null,
        },
      }
    }
    // Blocked with NO reason = the legacy freshness-only carrier. It is not a
    // refusal statement, so it neither sets nor clears one.
    return { kind: 'retain' }
  }

  const blocks = envelope.blocks
  if (Array.isArray(blocks)) {
    for (const block of blocks) {
      const b = asRecord(block)
      if (b?.type === 'analysis_result') return { kind: 'clear' }
    }
  }

  return { kind: 'retain' }
}
