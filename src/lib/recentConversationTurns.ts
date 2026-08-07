/**
 * Recent-conversation-turns capture — debug bundle (ROADMAP 1.31, Brief I).
 *
 * Defect (confirmed 3/3 bundles): `findLatestAnalysisProducingCeeTurn`
 * (`analysisProducingCeeTurn.ts`) is the ONLY selector feeding
 * `bundle.payloads.cee_request` / `cee_response`, and it deliberately
 * narrows to a single V5 turn whose action type is analysis-producing
 * (`run_analysis` / `what_would_flip` / `explain` — see
 * `ANALYSIS_PRODUCING_ACTION_TYPES`). A bundle built from a scenario
 * that only ran chip turns therefore carries ZERO LLM-authored
 * conversation turns: no `assistant_text`, no served prompt identity —
 * manual acceptance runs cannot evidence LLM behaviour from it
 * (chronicle Gate-0 precondition, re-adopted 8 Jul).
 *
 * This module ADDS a second, independent capture — it does NOT change
 * the analysis-producing selector or `bundle.payloads.cee_*`. It
 * surfaces the most-recent N V5 CEE turns of ANY kind (chat, clarify,
 * draft, chip — not just analysis-producing), each carrying:
 *   - `turn_kind`        — the turn/action-type discriminator
 *   - `assistant_text`   — the LLM-authored reply, verbatim (root
 *                          `assistant_text` on the OlumiResponse
 *                          envelope — passthrough only, never
 *                          re-derived or summarised)
 *   - `prompt_identity`  — `_diagnostic_trace.prompt_identity` when
 *                          present on the turn record (passthrough;
 *                          UI-doctrine: never fabricated)
 *
 * The payload trace store itself caps at 20 entries total across ALL
 * services (`MAX_PAYLOADS` in `payload-trace-store.ts`), so
 * `RECENT_CONVERSATION_TURNS_CAP` is defensive headroom rather than the
 * practical ceiling — but the cap and `truncated` flag are still
 * honoured/reported so a future increase to the trace-store size can't
 * silently balloon the bundle.
 *
 * Pure module — no React, no Zustand. Callers pass a `TracedPayload`
 * -shaped array (trace-store convention: most-recent first).
 */

import { isCeeService, isV5TurnEndpoint } from './v5TraceMatching'
import {
  ANALYSIS_PRODUCING_ACTION_TYPES,
  readScenarioId,
  readTurnOrActionType,
  type SelectorTracedPayload,
} from './analysisProducingCeeTurn'

/** Loose shape the selector accepts — subset of `TracedPayload`. */
export type ConversationTurnSourcePayload = SelectorTracedPayload & {
  timestamp?: number
}

/**
 * Generous cap on captured turns. The payload trace store already caps
 * at 20 total entries across all services, so this is defensive
 * headroom, not the expected practical count.
 */
export const RECENT_CONVERSATION_TURNS_CAP = 50

export interface RecentConversationTurn {
  /** Trace-store id, when present. */
  trace_id: string | null
  /** Request timestamp (ms epoch) from the trace entry, when present. */
  timestamp: number | null
  /** Turn/action-type discriminator (see `readTurnOrActionType`). */
  turn_kind: string | null
  /** True when `turn_kind` is one of `ANALYSIS_PRODUCING_ACTION_TYPES`. */
  is_analysis_producing: boolean
  completed: boolean
  status: number | null
  scenario_id: string | null
  /**
   * LLM-authored reply text, verbatim from the root `assistant_text`
   * field of the captured OlumiResponse envelope. Null when absent
   * (e.g. a draft-only or failed turn) — never fabricated.
   */
  assistant_text: string | null
  /** True when `assistant_text` is a non-empty string. */
  has_assistant_text: boolean
  /**
   * Passthrough of `_diagnostic_trace.prompt_identity` (served prompt
   * identity — e.g. staging_version / PMS id — when CEE's diagnostic
   * trace is enabled and the field is present on the turn record).
   * Verbatim; UI must not transform. Null when absent.
   */
  prompt_identity: unknown | null
  /** True when `prompt_identity` is present (non-null). */
  has_prompt_identity: boolean
}

export interface RecentConversationTurnsResult {
  /** Captured turns, most-recent first (mirrors trace-store order). */
  turns: RecentConversationTurn[]
  /** Total V5 CEE candidate turns available before the cap was applied. */
  total_available: number
  /** True when `total_available > turns.length` — the cap engaged. */
  truncated: boolean
  /** Count actually captured (`== turns.length`; kept explicit so bundle
   *  readers don't have to re-derive it). */
  captured_count: number
  /**
   * Of the captured turns, how many carried non-null `assistant_text`.
   * The honesty signal this module exists to fix (Brief I) — a bundle
   * from a scenario with real conversation should read > 0 here.
   */
  llm_authored_count: number
}

/**
 * Read the root `assistant_text` field from a V5 CEE turn's captured
 * response body. Passthrough only — never re-derived or summarised.
 */
function readAssistantText(p: ConversationTurnSourcePayload): string | null {
  const body = p.response?.body
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null
  const text = (body as Record<string, unknown>).assistant_text
  return typeof text === 'string' && text.length > 0 ? text : null
}

/**
 * Read `_diagnostic_trace.prompt_identity` from a V5 CEE turn's
 * captured response body. Mirrors the two documented locations from
 * `readCeeDiagnosticTrace` (`useDebugData.ts`) — the legacy top-level
 * `_diagnostic_trace` and the V5 parser's `__additive__._diagnostic_trace`
 * sidecar (unknown top-level keys, including `_diagnostic_trace`, are
 * demoted there by strict-schema validation before the trace-store
 * clone promotes the sidecar to an enumerable key). Duplicated here
 * (rather than imported) to keep this module free of any dependency on
 * the `components/debug` layer — same read order, kept in sync
 * deliberately.
 */
function readPromptIdentity(p: ConversationTurnSourcePayload): unknown | null {
  const body = p.response?.body
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null
  const root = body as Record<string, unknown>

  const readFrom = (trace: unknown): unknown | null => {
    if (!trace || typeof trace !== 'object' || Array.isArray(trace)) return null
    const identity = (trace as Record<string, unknown>).prompt_identity
    return identity ?? null
  }

  const topLevel = readFrom(root._diagnostic_trace)
  if (topLevel !== null) return topLevel

  const additive = root.__additive__
  if (additive && typeof additive === 'object' && !Array.isArray(additive)) {
    return readFrom((additive as Record<string, unknown>)._diagnostic_trace)
  }
  return null
}

/**
 * Select the most-recent N V5 CEE turns (any kind), each carrying
 * assistant text + prompt identity when present. Does NOT filter to
 * analysis-producing turns — that remains
 * `findLatestAnalysisProducingCeeTurn`'s job for `bundle.payloads.cee_*`.
 */
export function selectRecentConversationTurns(
  payloads: ReadonlyArray<ConversationTurnSourcePayload>,
  options: { cap?: number } = {},
): RecentConversationTurnsResult {
  const cap = options.cap ?? RECENT_CONVERSATION_TURNS_CAP
  const v5Turns = payloads.filter(
    (p) => isCeeService(p) && isV5TurnEndpoint(p),
  )

  const turns: RecentConversationTurn[] = v5Turns.slice(0, cap).map((p) => {
    const turnKind = readTurnOrActionType(p)
    const assistantText = readAssistantText(p)
    const promptIdentity = readPromptIdentity(p)
    return {
      trace_id: typeof p.id === 'string' ? p.id : null,
      timestamp: typeof p.timestamp === 'number' ? p.timestamp : null,
      turn_kind: turnKind,
      is_analysis_producing:
        turnKind !== null && ANALYSIS_PRODUCING_ACTION_TYPES.has(turnKind),
      completed: p.completed === true,
      status: typeof p.status === 'number' ? p.status : null,
      scenario_id: readScenarioId(p),
      assistant_text: assistantText,
      has_assistant_text: assistantText !== null,
      prompt_identity: promptIdentity,
      has_prompt_identity: promptIdentity !== null,
    }
  })

  return {
    turns,
    total_available: v5Turns.length,
    truncated: v5Turns.length > turns.length,
    captured_count: turns.length,
    llm_authored_count: turns.filter((t) => t.has_assistant_text).length,
  }
}
