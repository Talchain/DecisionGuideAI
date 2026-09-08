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
 * ═══════════════════════════════════════════════════════════════════════
 * 2026-09-03 — WHY THIS LEDGER COULD NOT REPRESENT A FAILURE
 * ═══════════════════════════════════════════════════════════════════════
 *
 * A real user session (`olumi-debug-f2e2df1b-20260903.json`, UI build
 * `86786efb`) carried 19 turns, three of which had no `assistant_text`. Read
 * off the ledger as it then stood they looked like three failures. Measured
 * against the same bundle's `user_actions` — 19 initiating actions, 19 turn
 * records, 1:1, request-record deltas 10–88 ms — the truth was different in
 * every direction:
 *
 *  · TWO were genuine failures (`status: 0`). Which KIND of failure is not
 *    recoverable from the bundle, because the ledger projected `status` and
 *    dropped `error` / `errorName` / `source` / `duration` — and `status: 0`
 *    is a THREE-WAY ambiguity in the transports that write it
 *    (`v5Adapter.callV5Turn`): an `AbortError` (`browser_timeout`), a fetch
 *    throw (`preflight_or_network`), or `unknown`. The first means the turn
 *    probably COMMITTED and a re-send duplicates; the second means nothing
 *    reached the server and a re-send is free. Opposite copy, opposite advice,
 *    same number on the record.
 *
 *  · The THIRD was not a failure at all. It was the session's cold draft, and
 *    a cold draft goes to the streamed sibling (`streamedDraftEligible`
 *    requires `nodeCountAtDispatch === 0`). `openV5TurnStream` recorded a
 *    request entry under a fresh `crypto.randomUUID()` and — until the sibling
 *    change to `streamedTurnTransport.ts` — never recorded a response for it,
 *    so the entry was `completed: false, status: null` FOREVER, whatever the
 *    turn did. The draft plainly succeeded: its 24-edge graph is in the same
 *    bundle and an analysis ran on it nine minutes later. The ledger
 *    MANUFACTURED that failure; it did not hide one.
 *
 * ⚠ AND THE PREMISE THIS REVISION REFUTED. The suspicion that prompted it was
 * that a turn marked `completed: true` with no text feeds a silent hole to the
 * model. It does not, and the reason matters more than the reassurance:
 * `completed` NEVER LEAVES THIS BUNDLE. `selectRecentConversationTurns` has
 * exactly two callers (`useDebugData.ts`, `exportBundle.ts`), the V5 turn
 * request body carries no history at all (`kind, turn_id, scenario_id, stage,
 * turn_class, message, source, chip, selected_elements`), and CEE assembles
 * history from its OWN `v5_conversation_turns` rows. Swept on fresh clones of
 * both staging tips with contrast controls in the same run: target 0, contrast
 * `deliveryState` 99 / `TracedPayload` 94 in the UI, target 0 / contrast
 * `payload.message|scenario_id` 429 in CEE.
 *
 * The genuine silent-hole risk is real but lives elsewhere and is NOT this
 * field: CEE's `commit.ts` persists `assistant_message: NULL` for blank
 * answers and for the draft path, and `context-pack-assembler.projectConversation`
 * projects `assistant_message` into `recent_turns` with no marker — so the model
 * can see a user message answered by nothing and cannot tell "I said nothing"
 * from "the turn failed" from "the reply was a graph". That is a CEE contract
 * change, deliberately not attempted here.
 * Pure module — no React, no Zustand. Callers pass a `TracedPayload`
 * -shaped array (trace-store convention: most-recent first).
 */

import { extractPathname, isCeeService, isV5TurnEndpoint } from './v5TraceMatching'
import {
  ANALYSIS_PRODUCING_ACTION_TYPES,
  readScenarioId,
  readTurnOrActionType,
  type SelectorTracedPayload,
} from './analysisProducingCeeTurn'

/**
 * Loose shape the selector accepts — subset of `TracedPayload`.
 *
 * The four failure fields are widened in HERE rather than in
 * `SelectorTracedPayload` because they are this module's business and no other
 * selector reads them. They exist on the runtime record
 * (`payload-trace-store.ts` writes them on every error path) and were simply
 * never projected — see `readFailureDetail`.
 */
export type ConversationTurnSourcePayload = SelectorTracedPayload & {
  timestamp?: number
  /** Wall-clock ms from request record to response record. */
  duration?: number
  /** `Error.message` of a fetch throw, or a parser-supplied reason. */
  error?: string
  /** `Error.name` of a fetch throw (`AbortError`, `TypeError`, …). */
  errorName?: string
  /** Failure-source classification written by the transport adapters. */
  source?: string
}

/**
 * Generous cap on captured turns. The payload trace store already caps
 * at 20 total entries across all services, so this is defensive
 * headroom, not the expected practical count.
 */
export const RECENT_CONVERSATION_TURNS_CAP = 50

/**
 * WHICH TRANSPORT LEG a record is — derived from the endpoint pathname, never
 * mirrored.
 *
 * ⚠ THIS DISTINCTION IS WHY THE LEDGER MANUFACTURED A FAILURE. `isV5TurnEndpoint`
 * accepts `…/turn` AND its sub-paths (`(?:\/|$)` boundary), so a stream OPEN and
 * an explicit STOP land in a list called `turns` looking exactly like buffered
 * conversational turns. A `stream_open` record cannot carry a turn outcome —
 * the streamed terminal frame is ingested through the BUFFERED parser and never
 * touches this record — so scoring it as a turn scores every cold draft as a
 * turn that produced nothing.
 */
export type ConversationTurnTransportKind =
  | 'buffered_turn'
  | 'stream_open'
  | 'stop'
  | 'unknown'

/**
 * WHAT THIS TURN GAVE THE USER.
 *
 * ⭐ TWO QUESTIONS, NAMED APART (the estate's signature defect). `completed`
 * below is the payload-trace store's field and answers *"did the HTTP exchange
 * settle?"* — it is set `false` when the request is recorded and `true` when a
 * response is recorded, INCLUDING an error response. It has never meant "the
 * turn succeeded", and reading it that way is what made a debug bundle from
 * 2026-09-03 look like it held three failed turns when it held two failures and
 * one phantom. The two fields are kept side by side, both named for the
 * question they answer, rather than reconciled — aligning them would make one
 * of the two questions unanswerable.
 *
 *   `answered`      — settled 2xx carrying assistant text.
 *   `no_text`       — settled 2xx carrying NO assistant text. **Not a failure.**
 *                     CEE's own commit path documents the legitimate case: "the
 *                     draft_graph path whose provisional response carries empty
 *                     assistant_text" (`orchestrator-v5/commit.ts`). Read it
 *                     against `turn_kind` before drawing any conclusion.
 *   `failed`        — settled, and the status says so (non-2xx, or the
 *                     transport's `0`). `outcome_reason` carries the cause when
 *                     the record kept one.
 *   `unsettled`     — NO response was ever recorded for this request. The
 *                     outcome is not merely unknown to the reader, it was never
 *                     observed by the client at all.
 *   `transport_leg` — not a conversational turn (see
 *                     `ConversationTurnTransportKind`).
 */
export type ConversationTurnOutcome =
  | 'answered'
  | 'no_text'
  | 'failed'
  | 'unsettled'
  | 'transport_leg'

export interface RecentConversationTurn {
  /** Trace-store id, when present. */
  trace_id: string | null
  /** Request timestamp (ms epoch) from the trace entry, when present. */
  timestamp: number | null
  /** Turn/action-type discriminator (see `readTurnOrActionType`). */
  turn_kind: string | null
  /** True when `turn_kind` is one of `ANALYSIS_PRODUCING_ACTION_TYPES`. */
  is_analysis_producing: boolean
  /**
   * TRANSPORT LIFECYCLE ONLY — *"did the HTTP exchange settle?"*. Passthrough of
   * `TracedPayload.completed`. **Never a statement about the turn's outcome**;
   * `outcome` answers that. Retained under its original name because the field
   * has shipped in bundles since ROADMAP 1.31 and renaming it would silently
   * break every existing reader.
   */
  completed: boolean
  status: number | null
  /** Which transport leg this record is. */
  transport_kind: ConversationTurnTransportKind
  /** What this turn gave the user. */
  outcome: ConversationTurnOutcome
  /**
   * Machine-readable cause, present only when there is one to state. For a
   * `status: 0` failure this is the discriminator the ledger used to drop: the
   * transport adapters classify a fetch throw as `browser_timeout` (an abort —
   * client wait expiry, an explicit Stop, or a preempting send),
   * `preflight_or_network` (nothing reached the server) or `unknown`, and those
   * three demand OPPOSITE user-facing copy and opposite retry advice. When the
   * record kept no cause this reads `status_0_cause_not_recorded`, which is a
   * statement about the LEDGER, not about the turn.
   */
  outcome_reason: string | null
  /** `Error.message`, verbatim from the trace record. Null when absent. */
  error: string | null
  /** `Error.name`, verbatim from the trace record. Null when absent. */
  error_name: string | null
  /** The adapter's failure-source classification. Null when absent. */
  failure_source: string | null
  /** Request→response wall clock (ms). Null when no response was recorded. */
  duration_ms: number | null
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
   *
   * ⚠ `captured_count - llm_authored_count` IS NOT A FAILURE COUNT and reading
   * it as one is what this module's 2026-09-03 revision exists to stop. Use
   * `failed_count` / `unsettled_count` below, which are derived from `outcome`.
   */
  llm_authored_count: number
  /** Turn records (`transport_kind: 'buffered_turn'`) — the denominator for the four counts below. */
  turn_record_count: number
  /** `outcome: 'answered'`. */
  answered_count: number
  /** `outcome: 'no_text'` — settled 2xx with no assistant text. Not failures. */
  no_text_count: number
  /** `outcome: 'failed'`. */
  failed_count: number
  /** `outcome: 'unsettled'` — no response was ever recorded for the request. */
  unsettled_count: number
  /** `outcome: 'transport_leg'` — stream opens and stops, which are not turns. */
  transport_leg_count: number
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
 * The sub-path that follows the V5 turn segment, if any. `isV5TurnEndpoint`
 * has already accepted the record, so the pathname certainly contains
 * `/proxy/v5/turn` or `/orchestrate/v2/turn`; what remains is whether anything
 * follows it. Query and fragment are stripped by `extractPathname` first, so a
 * `?next=/stream` cannot impersonate the streamed sibling.
 */
const TURN_SUBPATH_RE = /\/turn\/([^/]+)\/?$/

function readTransportKind(
  p: ConversationTurnSourcePayload,
): ConversationTurnTransportKind {
  const path = typeof p.endpoint === 'string' ? extractPathname(p.endpoint) : null
  if (path === null) return 'unknown'
  const sub = TURN_SUBPATH_RE.exec(path)
  if (sub === null) return 'buffered_turn'
  switch (sub[1].toLowerCase()) {
    case 'stream':
      return 'stream_open'
    case 'stop':
      return 'stop'
    default:
      return 'unknown'
  }
}

/** A status the HTTP contract calls success. */
function isSuccessStatus(status: number | null): boolean {
  return status !== null && status >= 200 && status < 300
}

/**
 * Derive the turn-level verdict.
 *
 * Deliberately NOT a function of `has_assistant_text` alone: a settled 2xx with
 * no text is `no_text`, never `failed`, because the cold-draft path legitimately
 * answers with a graph and an empty `assistant_text` (CEE
 * `orchestrator-v5/commit.ts` documents that case by name). Calling it a failure
 * would trade the old over-optimistic reading for an over-pessimistic one, which
 * is the same defect pointed the other way.
 */
function deriveOutcome(args: {
  transportKind: ConversationTurnTransportKind
  completed: boolean
  status: number | null
  hasAssistantText: boolean
  failureSource: string | null
  errorName: string | null
}): { outcome: ConversationTurnOutcome; reason: string | null } {
  const { transportKind, completed, status, hasAssistantText, failureSource, errorName } = args
  if (transportKind !== 'buffered_turn') {
    return { outcome: 'transport_leg', reason: transportKind }
  }
  if (!completed) {
    return { outcome: 'unsettled', reason: 'no_response_recorded' }
  }
  if (status === null) {
    return { outcome: 'unsettled', reason: 'response_recorded_without_status' }
  }
  if (!isSuccessStatus(status)) {
    // The three-way `status: 0` split lives here. Prefer the adapter's own
    // classification, fall back to the error name, and when neither survived
    // say SO rather than inventing a cause.
    const cause =
      failureSource ??
      errorName ??
      (status === 0 ? 'status_0_cause_not_recorded' : null)
    return { outcome: 'failed', reason: cause !== null ? `${cause}` : `http_${status}` }
  }
  if (!hasAssistantText) {
    return { outcome: 'no_text', reason: 'no_assistant_text_on_2xx' }
  }
  return { outcome: 'answered', reason: null }
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
    const transportKind = readTransportKind(p)
    const completed = p.completed === true
    const status = typeof p.status === 'number' ? p.status : null
    const failureSource = typeof p.source === 'string' ? p.source : null
    const errorName = typeof p.errorName === 'string' ? p.errorName : null
    const { outcome, reason } = deriveOutcome({
      transportKind,
      completed,
      status,
      hasAssistantText: assistantText !== null,
      failureSource,
      errorName,
    })
    return {
      trace_id: typeof p.id === 'string' ? p.id : null,
      timestamp: typeof p.timestamp === 'number' ? p.timestamp : null,
      turn_kind: turnKind,
      is_analysis_producing:
        turnKind !== null && ANALYSIS_PRODUCING_ACTION_TYPES.has(turnKind),
      completed,
      status,
      transport_kind: transportKind,
      outcome,
      outcome_reason: reason,
      error: typeof p.error === 'string' ? p.error : null,
      error_name: errorName,
      failure_source: failureSource,
      duration_ms: typeof p.duration === 'number' ? p.duration : null,
      scenario_id: readScenarioId(p),
      assistant_text: assistantText,
      has_assistant_text: assistantText !== null,
      prompt_identity: promptIdentity,
      has_prompt_identity: promptIdentity !== null,
    }
  })

  const countOf = (outcome: ConversationTurnOutcome): number =>
    turns.filter((t) => t.outcome === outcome).length

  return {
    turns,
    total_available: v5Turns.length,
    truncated: v5Turns.length > turns.length,
    captured_count: turns.length,
    llm_authored_count: turns.filter((t) => t.has_assistant_text).length,
    turn_record_count: turns.filter((t) => t.transport_kind === 'buffered_turn').length,
    answered_count: countOf('answered'),
    no_text_count: countOf('no_text'),
    failed_count: countOf('failed'),
    unsettled_count: countOf('unsettled'),
    transport_leg_count: countOf('transport_leg'),
  }
}
