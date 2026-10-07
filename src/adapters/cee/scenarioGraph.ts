/**
 * scenarioGraph — the UI's client for CEE's scenario-addressed graph read.
 *
 * ROADMAP 2.312 piece 3. Server contract frozen in olumi-assistants-service
 * PR #804 (merged `ecdc4cf`): `POST /assist/v1/scenarios/{id}/graph` →
 * `scenario_graph.v1`, reached from the browser as `/bff/cee/scenarios/{id}/graph`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠ WHY THIS FILE DOES NOT USE `VITE_CEE_BFF_BASE` — READ BEFORE "TIDYING"
 * ─────────────────────────────────────────────────────────────────────────────
 * Every other CEE caller in this repo resolves its base as
 * `import.meta.env.VITE_CEE_BFF_BASE || '/bff/cee'`. That looks like the
 * house style, and copying it here would send this call to the WRONG SERVICE.
 *
 * `VITE_CEE_BFF_BASE` is not set anywhere in this tree, so it reads as the
 * same-origin `/bff/cee` locally — but it IS set in the Netlify dashboard, to
 * the absolute PLoT URL `https://plot-lite-service-staging.onrender.com/v1/cee`,
 * and Vite INLINES it at build time. The deployed bundle therefore contains
 * ZERO `/bff/cee` literals and four absolute PLoT bases (established by a
 * recursive crawl of the deployed JS chunks, 4 Aug 2026; the same posture is
 * recorded at `src/canvas/stores/readinessStore.ts` for the readiness path,
 * which genuinely is a PLoT-served endpoint).
 *
 * PLoT does not serve `scenario_graph.v1`. A hydrate call resolved from that
 * var would leave the same-origin edge seam entirely, hit PLoT, and 404 — and
 * a 404 on this route means "not readable", so the failure would be
 * indistinguishable from a legitimate refusal and the canvas would silently
 * never hydrate. This is CLAUDE.md trap 18 in its live form: the env posture
 * is NOT derivable from this repo.
 *
 * So the base is a DEDICATED same-origin constant. `/bff/cee/*` is owned by
 * `netlify/edge-functions/cee-proxy.ts`, which rewrites the prefix to
 * `/assist/v1` and injects `X-Olumi-Assist-Key` server-side; `vite.config.ts`
 * proxies the same prefix the same way in dev. Both hops are already in the
 * tree, so the resolved URL shape is pinned by spec rather than assumed.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE FOUR BINDING CONSUMER NOTES (from the merged PR body)
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. `graph_identity_hash` is an ENVELOPE OBJECT — read `.value`. A consumer
 *    that treats the field itself as the hash compares objects and gets a
 *    permanent false "changed".
 * 2. The token is OPAQUE and CEE-ISSUED. Store it, compare CEE-to-CEE, gate on
 *    `.projection_version`, and NEVER recompute it locally — the normalisation
 *    and strip list are CEE's, are versioned so they can move, and have no
 *    client-side counterpart.
 * 3. `404` means NOT READABLE (absent ∪ not-yours ∪ oracle-unresolvable). It is
 *    NOT authoritative deletion and must never discard the local canvas.
 *    `503` means retry.
 * 4. No `updated_at`/`version` by ruling — the hash token is the staleness
 *    anchor and a "last synced" display is out of scope.
 *
 * ⚠ THE RESPONSE CARRIES NO LAYOUT. `scenarios.graph` holds no canvas
 * geometry, and `layout_present` is MEASURED on the returned bytes rather than
 * promised — it is `false` for every real graph today. Positions are merged
 * locally; see `canvas/utils/mergeServerGraph.ts`.
 */

import { recordRequestPayload, recordResponsePayload, getPayloadInspectionStatus } from '../../lib/payload-trace-store'
import { mapV5AnalysisToReport } from '../../v5/mapV5AnalysisToReport'
import type { AnalysisResultBlock } from '@talchain/schemas/boundary'

import { AnalysisStateV1Schema } from '@talchain/schemas/boundary'
import { sanitiseUserId } from '../../lib/guestIdentity'
import type { AnalysisStateV1 } from '@talchain/schemas/boundary'

import { logger } from '../../lib/logger'
import { buildTurnAuthHeaders } from '../../v5/turnAuthHeaders'
import { hashEqualStaleReasonWords } from '../../v5/hashEqualStaleReasonWords'
import { isSignInRequired } from './signInRefusal'
import { parseNotModelled, type NotModelledManifest } from './notModelled'
import { PERMITTED_ANALYSIS_MODES, type PermittedAnalysisMode } from './types'

/**
 * The same-origin Netlify edge path. NOT `VITE_CEE_BFF_BASE` — see the header.
 * Deliberately a literal: an env-resolved base is exactly the defect above.
 */
export const SCENARIO_GRAPH_BASE = '/bff/cee'

/** `POST` — the scenario is addressed in the path, identity travels in the body. */
export function scenarioGraphUrl(scenarioId: string): string {
  return `${SCENARIO_GRAPH_BASE}/scenarios/${encodeURIComponent(scenarioId)}/graph`
}

/** Total attempts on a retryable (503) answer: the first plus two retries. */
const MAX_ATTEMPTS = 3
const DEFAULT_RETRY_DELAY_MS = 400

/**
 * Per-attempt deadline (review A3).
 *
 * ⚠ THIS IS A CORRECTNESS BOUND, NOT A UX NICETY. CEE staging cold-starts, and
 * an answer that arrives tens of seconds after boot describes a graph the user
 * has since edited on screen. Applying it then is not "late hydration", it is a
 * SILENT ROLLBACK of work done in the window — and the autosave would persist
 * the rolled-back state moments later, destroying the last copy. Bounding the
 * wait bounds that window.
 */
const DEFAULT_TIMEOUT_MS = 8000


/**
 * CEE's `identity.v1` envelope, reduced to the two fields a consumer may act on.
 * `value` is opaque; `projectionVersion` is the gate that makes a comparison
 * meaningful. Nothing here is ever computed on this side.
 */
export interface ScenarioGraphIdentity {
  /** CEE's token, VERBATIM. Compare CEE-to-CEE only. */
  readonly value: string
  /** `graph_identity_hash.projection_version` — never compare across values. */
  readonly projectionVersion: string
}

export type ScenarioGraphResult =
  /** 200 with a graph. `graph` is `scenarios.graph` verbatim; it carries no layout. */
  | {
      status: 'graph'
      graph: unknown
      /** The response's own `scenario_id`: the read's identity binding (`canonicalOpenOutcome.ts`). */
      scenarioId?: string | null
      switchAnalysisReady?: unknown
      briefText: string | null
      /**
       * ROADMAP 2.973 — what of the brief did NOT reach the model.
       *
       * `null` means CEE SENT NO MANIFEST (it predates the field, or the shape
       * failed to validate) — i.e. we know nothing. It does NOT mean nothing was
       * dropped, and no consumer may render it as such.
       */
      notModelled: NotModelledManifest | null
      identity: ScenarioGraphIdentity | null
      /**
       * ⭐⭐ THE WRITE PRECONDITION FOR THESE EXACT BYTES — the base a manual
       * edit must send back, or `null` when CEE did not answer with one.
       *
       * A manual edit is a compare-and-set: the server refuses unless
       * `computeAnalysisAffectingGraphHash(persistedGraph)` equals the base the
       * client sent. That base used to arrive ONLY on a turn response, so a
       * RELOAD left the client without one and every FIRST edit was refused —
       * witnessed natively on a restored scenario whose editor opened and whose
       * Save honestly sent nothing.
       *
       * ⚠⚠ IT IS NOT `identity`. identity.v1 answers "is this the same graph
       * object?" over a different projection and is 64 hex; this answers "may a
       * write be applied to the graph as the analysis sees it?". On an UNCHANGED
       * graph the wrong one still matches, so substituting them would fail only
       * once someone actually edited.
       *
       * ⚠ `null` MEANS CEE DID NOT ANSWER — an older build, or an absent graph.
       * It is not "no base exists", and the only correct response to it is the
       * one that was already there: refuse the edit and say so. Never a guess,
       * never a locally recomputed value.
       */
      graphHash: string | null
      /** MEASURED by CEE on the returned bytes. `false` for every real graph today. */
      layoutPresent: boolean
      /**
       * ROADMAP 2.1271 — CEE's composed `AnalysisStateV1` verdict for this
       * scenario, PARSED, or `null`.
       *
       * ⚠ `null` IS NOT A STATE, and reading it as one is the whole hazard of
       * this field. It means CEE DID NOT ANSWER — the build predates the key, the
       * scenario has no graph, or the shape failed validation. A consumer must
       * leave whatever it already believed standing. In particular it must NOT be
       * read as evidence against an in-flight run the DRAFT TURN reported: the
       * two authorities answer different questions (a turn answers "did I start a
       * run?", a read answers "has a fact landed?"), and CEE keeps no in-flight
       * marker, so mid-run this leg can only ever say `never_run`. See
       * `canvas/hydrate/applyScenarioAnalysisRead.ts`, which is the ONLY
       * sanctioned consumer.
       */
      analysisState: AnalysisStateV1 | null
      /**
       * ROADMAP 2.1271 — the `analysis_result` block for the fact the verdict
       * selected, present ONLY on a `complete_current` verdict (CEE withholds it
       * on a stale one, because those numbers describe a graph the user has since
       * changed). `null` means no CURRENT result is being delivered — never "the
       * analysis is empty".
       *
       * Deliberately typed `unknown`: the block is handed to `mapV5AnalysisToReport`
       * — the SAME mapper the turn path uses — and a second local shape
       * declaration here would be a mirror of the block contract.
       */
      analysisResult: unknown
      /**
       * CEE's per-limit and joint verdicts for the analysis in `analysisResult` (`analysis_limit_verdicts`), raw —
       * parsed downstream by the SAME reader the turn leg uses (`readLimitVerdicts`). CEE ships it exactly when it
       * ships that block; `null` = none attested, never "scored".
       */
      limitVerdicts?: unknown
      /** CEE's stored goal-certainty fact for the analysis in `analysisResult` (`analysis_goal_certainty`, CEE #2280), raw. */
      goalCertainty?: unknown
      /** The Run's stored option-participation fact (`analysis_option_participation`, Runtime 5888341208), raw. */
      optionParticipation?: unknown
      /**
       * SC-24: the displayed Run's comparison with the Run before it (`run_delta`), raw — the SAME producer block the
       * turn that ran it carried, served on the cold read so a reload shows the same pair. Parsed downstream by the
       * contract (`RunDeltaSchema`); absent = no delta for this Run.
       * CARRIER: `current_read.run_delta` ONLY (P0 PARTNER ruling #75 5917382664, CURRENT-READ-v1 row 1 @ `2395d434`) —
       * CEE sets it only when the read is `complete_current` AND the displayed Run is the pair's newer end. A top-level
       * `run_delta` is not the contract and is ignored.
       */
      runDelta?: unknown
      /**
       * SD-1 Slice R (CEE #2654, schemas 0.79 `run_delivery`): what the displayed Run's turn DELIVERED — its Phase 3
       * blocks and `analysis_ready` options — raw, with the Run identity CEE served beside it. CARRIER:
       * `current_read.delivered_record` + `current_read.run_id` ONLY, and only when `current_read.run_state.kind` is
       * `complete_current` (CEE gates the same; this is defence in depth). Parsed downstream by the contract
       * (`RunDeliveredRecordSchema`, `applyScenarioAnalysisRead`); null = no record for this Run.
       */
      delivered?: { readonly runId: string; readonly record: unknown } | null
      /**
       * RT-10 B′: CEE's own words for WHY the saved Run is out of date when the MODEL DID NOT CHANGE — a
       * `complete_stale` read whose `computed_against_hash` equals `current_analysis_hash` (the Run's own goal snapshot
       * disagrees: its goal unit, or the direction it sent, CEE #2596). CEE carries the sentence on
       * `current_read.analysis_ready.freshness_reason`. Null otherwise. Surfaces say it INSTEAD of "Model changed", which
       * is false when the user changed nothing (`selectAnalysisStaleReasonWords`).
       */
      staleReasonWords?: string | null
      /**
       * CEE's run admission for this revision (`analysis_admission.admitted`), or
       * `null` / absent when the read did not answer. The boot restore of a
       * gate-closing verdict needs it: CEE may admit a run whose readiness still
       * lists MISSING_OPTION_VALUE (waived by exclusion), and the gate reads that
       * readiness as closing Run unless it is told the run is admitted.
       * BOUND: carried only when the admission's own `graph_hash` (64-hex, the
       * stored bytes it judged) starts with this read's `graph_hash`.
       */
      admitted?: boolean | null
      /**
       * The read's `analysis_admission.permitted_analysis_mode`, under the SAME binding as `admitted` (the admission
       * names this read's revision), and only a literal of the UI's one list (`PERMITTED_ANALYSIS_MODES`); else null.
       * CEE's read carries a PROJECTION of the admission (`projectAnalysisAdmission`), not an `AnalysisAdmissionV1`,
       * so only this field is lifted from it (`bootReadAdmission.ts`).
       */
      permittedAnalysisMode?: PermittedAnalysisMode | null
      /** Subject-bound machine census for disclosure; never original Run admission. */
      currentReadInputBasis?: unknown
      /** The read's `conversation_turns`, raw (sent only on `includeConversationTurns`); undefined when absent. */
      conversationTurns?: unknown
      /** Opt-in, currently executable original approve/amend offers; absent means no authority. */
      heldProposalOffers?: unknown
      /** §15 projection, present only on the conversation opt-in. */
      proposalFields?: unknown
      requestId: string | null
    }
  /** 200, `graph_present:false` — the scenario exists and has no graph yet. Normal. */
  | { status: 'absent'; requestId: string | null; /** The response's own `scenario_id`. */ scenarioId?: string | null }
  /** 404 — absent ∪ not-yours ∪ oracle-unresolvable. NEVER deletion. */
  | { status: 'notReadable' }
  /** 503 after every attempt — unknown, try again. NEVER an empty canvas. */
  | { status: 'unavailable' }
  /**
   * 401 and CEE says the token is the problem. Distinct from `refused`
   * BECAUSE THE RECOVERY IS DIFFERENT: signing in fixes this and retrying
   * cannot (CEE sets `retryable: false`). Collapsing the two is how a signed-in
   * user got a silent hydration failure and no prompt.
   */
  | { status: 'signInRequired' }
  /** 401 / 403 / 429 — a stable refusal; not retried. */
  | { status: 'refused'; httpStatus: number }
  /** Transport failure, unparseable body, or a shape that contradicts itself. */
  | { status: 'unusable' }

export interface FetchScenarioGraphOptions {
  /** Supabase user id. Omitted for guest/unowned scenarios. */
  userId?: string | null
  /**
   * Supabase access token. Sent as `Authorization: Bearer …` so CEE can DERIVE
   * identity from the verified `sub` instead of trusting the body. Null for
   * guests, who have no session — see the identity note in `fetchScenarioGraph`.
   */
  accessToken?: string | null
  signal?: AbortSignal
  /** Backoff between 503 retries. Tests pass 0. */
  retryDelayMs?: number
  /** A settlement read gets one attempt; hydration retains its default 503 retries. */
  retry503?: boolean
  /** Per-attempt deadline. See `DEFAULT_TIMEOUT_MS`. */
  timeoutMs?: number
  /**
   * Ask for the stored chat (`conversation_turns`) — MG 5907618888: OPT-IN, so every other caller's body stays
   * byte-identical. Only the cold open sends it. A CEE without the read ignores the key (measured 30 Sep 09:0xZ on
   * served staging: same 200, same 18 keys), so this is inert until the read serves.
   */
  includeConversationTurns?: boolean
}

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve()
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * CONSUMER NOTE 1. Accepts ONLY the envelope object and reads `.value` from it.
 *
 * A bare string is REFUSED rather than adopted: if CEE ever regressed to
 * emitting a naked hash, silently accepting it would make this consumer agree
 * with a shape the contract does not define, and the `projection_version` gate
 * — the thing that makes a comparison meaningful at all — would be gone with
 * no signal. Null is the honest answer, and a null token never suppresses a
 * merge downstream.
 */
function readIdentityEnvelope(raw: unknown): ScenarioGraphIdentity | null {
  if (raw === null || raw === undefined) return null
  if (typeof raw !== 'object') {
    logger.warn('scenario_graph.identity_not_an_envelope', {
      receivedType: typeof raw,
    })
    return null
  }
  const env = raw as Record<string, unknown>
  const value = env.value
  const projectionVersion = env.projection_version
  if (typeof value !== 'string' || value.length === 0) return null
  if (typeof projectionVersion !== 'string' || projectionVersion.length === 0) {
    return null
  }
  return { value, projectionVersion }
}

/**
 * SC-24 — the cold read's `run_delta` lives ONLY inside `current_read` (P0 PARTNER ruling #75 5917382664). CEE puts it
 * there under the same gate as the read's figures (`complete_current` + newer end), so a stale read never gains a delta.
 * Carried raw; `RunDeltaSchema` parses it downstream (`applyScenarioAnalysisRead`).
 */
function readCurrentReadRunDelta(raw: unknown): unknown {
  if (raw === null || typeof raw !== 'object') return null
  return (raw as { run_delta?: unknown }).run_delta ?? null
}

/**
 * SD-1 Slice R — the displayed Run's delivered record lives ONLY inside `current_read` (CEE #2654). Null unless the read
 * is `complete_current` AND it names the Run (`run_id`, a non-empty string) AND carries a record. Carried raw;
 * `RunDeliveredRecordSchema` parses it downstream (`applyScenarioAnalysisRead`), which also binds it to `runId`.
 */
export function readCurrentReadDelivered(raw: unknown): { readonly runId: string; readonly record: unknown } | null {
  if (raw === null || typeof raw !== 'object') return null
  const read = raw as { run_state?: { kind?: unknown } | null; run_id?: unknown; delivered_record?: unknown }
  if (read.run_state?.kind !== 'complete_current') return null
  if (typeof read.run_id !== 'string' || read.run_id.length === 0) return null
  if (read.delivered_record === undefined || read.delivered_record === null) return null
  return { runId: read.run_id, record: read.delivered_record }
}

/**
 * RT-10 B′ — CEE's reason sentence for a Run that is out of date although the model did not change. All four must
 * hold, or the answer is null (and the surfaces keep their ordinary copy):
 *   · `current_read.run_state.kind` is `complete_stale`;
 *   · `computed_against_hash` is a non-empty string EQUAL to `current_analysis_hash` (the graph did not move);
 *   · `analysis_ready.freshness_reason` is CEE PROSE, not a reason code: it has a space and no underscore. CEE sends
 *     its human sentence only for the hash-equal goal-snapshot reasons (`goalSnapshotStaleMessage`);
 *   · at most 200 characters.
 */
export function readHashEqualStaleReasonWords(raw: unknown): string | null {
  if (raw === null || typeof raw !== 'object') return null
  const read = raw as {
    run_state?: { kind?: unknown } | null
    computed_against_hash?: unknown
    current_analysis_hash?: unknown
    analysis_ready?: { freshness_reason?: unknown } | null
  }
  if (read.run_state?.kind !== 'complete_stale') return null
  return hashEqualStaleReasonWords(read.analysis_ready?.freshness_reason, read.computed_against_hash, read.current_analysis_hash)
}


/**
 * ROADMAP 2.1271 — parse CEE's verdict with the CONTRACT, never a local mirror.
 *
 * `AnalysisStateV1Schema` is `.strict()` at every level and its `run_state` is a
 * discriminated union, so an unknown kind or an extra key FAILS rather than
 * handing a consumer a shape it will read as authority — the same discipline
 * `applyV5State` applies on the turn path, using the same schema object.
 *
 * A parse failure returns `null`, i.e. "CEE did not answer". That is deliberately
 * the same value as absence here, and it is safe ONLY because the single consumer
 * treats `null` as "leave what you believed standing" rather than as a state.
 */
function readAnalysisState(raw: unknown): AnalysisStateV1 | null {
  if (raw === null || raw === undefined) return null
  const parsed = AnalysisStateV1Schema.safeParse(raw)
  if (parsed.success) return parsed.data
  logger.warn('scenario_graph.analysis_state_invalid_shape', {
    issueCount: parsed.error.issues.length,
  })
  return null
}

/**
 * The `analysis_result` block, gated on its own discriminator.
 *
 * Not validated further on purpose: `mapV5AnalysisToReport` is the block
 * contract's one consumer and restating its shape here would be a mirror of it
 * (trap 12). But the TYPE TAG is checked, so a future CEE key landing on this
 * name cannot be forwarded to a mapper written for a different block.
 */
function readAnalysisResultBlock(raw: unknown): unknown {
  if (raw === null || raw === undefined || typeof raw !== 'object') return null
  const type = (raw as { type?: unknown }).type
  if (type !== 'analysis_result') {
    logger.warn('scenario_graph.analysis_result_unexpected_type', {
      receivedType: typeof type === 'string' ? type : typeof type,
    })
    return null
  }
  return raw
}

function parseOk(body: unknown): ScenarioGraphResult {
  if (body === null || typeof body !== 'object') return { status: 'unusable' }
  const b = body as Record<string, unknown>

  // The discriminator is a literal in the contract. A different one means the
  // route moved under us; adopting it would be guessing at a shape.
  if (b.schema !== 'scenario_graph.v1') {
    logger.warn('scenario_graph.unexpected_schema', { schema: String(b.schema) })
    return { status: 'unusable' }
  }

  const requestId = typeof b.request_id === 'string' ? b.request_id : null
  const scenarioId = typeof b.scenario_id === 'string' && b.scenario_id.length > 0 ? b.scenario_id : null

  // `graph_present` is explicit precisely so presence is never inferred from a
  // falsy check. It is the authority — but it must AGREE with the bytes.
  const graphPresent = b.graph_present === true
  const graph = b.graph
  const graphIsObject = graph !== null && typeof graph === 'object'

  if (!graphPresent) {
    // Fail closed on disagreement in either direction: a body claiming no graph
    // while carrying one is not a shape we can act on.
    if (graphIsObject) {
      logger.warn('scenario_graph.presence_disagreement', { graphPresent: false })
      return { status: 'unusable' }
    }
    return { status: 'absent', requestId, scenarioId }
  }

  if (!graphIsObject) {
    logger.warn('scenario_graph.presence_disagreement', { graphPresent: true })
    return { status: 'unusable' }
  }

  return {
    status: 'graph',
    graph,
    scenarioId,
    briefText: typeof b.brief_text === 'string' ? b.brief_text : null,
    notModelled: parseNotModelled(b.not_modelled),
    identity: readIdentityEnvelope(b.graph_identity_hash),
    // ⚠ NON-EMPTY STRING OR NULL, and nothing in between. A blank would be a
    // base that matches nothing, which the server would refuse as stale and the
    // user would read as "your edit conflicted" — so it is treated exactly as an
    // absent answer. The value is OPAQUE here: it is carried, never parsed,
    // compared or recomputed, because the server that issued it is the only
    // authority on what it means.
    graphHash:
      typeof b.graph_hash === 'string' && b.graph_hash.length > 0 ? b.graph_hash : null,
    layoutPresent: b.layout_present === true,
    // ROADMAP 2.1271 — PARSED, NOT TRUSTED, and by the SAME `.strict()`
    // discriminated-union schema `v5/applyV5State.ts` uses on the turn path. A
    // malformed verdict yields `null` ("CEE did not answer") rather than a shape
    // a consumer would read as authority. There is deliberately no local mirror
    // of the vocabulary here.
    analysisState: readAnalysisState(b.analysis_state),
    // Handed through opaque: the ONLY reader is `mapV5AnalysisToReport`, which
    // already owns the block contract. Presence is gated on the discriminator
    // being the one block type this leg may carry, so a future CEE key cannot
    // arrive here as an unlabelled object.
    analysisResult: readAnalysisResultBlock(b.analysis_result),
    limitVerdicts: b.analysis_limit_verdicts ?? null,
    goalCertainty: b.analysis_goal_certainty ?? null,
    optionParticipation: b.analysis_option_participation ?? null,
    switchAnalysisReady: b.current_read && typeof b.current_read === 'object' ? (b.current_read as Record<string, unknown>).analysis_ready : null,
    runDelta: readCurrentReadRunDelta(b.current_read),
    delivered: readCurrentReadDelivered(b.current_read),
    staleReasonWords: readHashEqualStaleReasonWords(b.current_read),
    admitted: readAdmitted(b.analysis_admission, b.graph_hash),
    permittedAnalysisMode: readPermittedAnalysisMode(b.analysis_admission, b.graph_hash),
    currentReadInputBasis: readCurrentReadInputBasis(b.analysis_admission, b.graph_hash),
    // Carried raw; the ONE reader is `readServerConversationTurns` (canvas/conversation/serverConversationTurns.ts).
    conversationTurns: b.conversation_turns,
    heldProposalOffers: b.held_proposal_offers,
    proposalFields: b.proposal_fields,
    requestId,
  }
}

/**
 * `analysis_admission.admitted` when it is a boolean AND the admission names the
 * revision this read carries; anything else is "did not answer". CEE computes both
 * from the same stored graph in one request (measured 26 Sep: `06bdf585412154de…`
 * on both), so a mismatch means the two do not describe one model.
 */
function readAdmitted(raw: unknown, readGraphHash: unknown): boolean | null {
  if (raw === null || typeof raw !== 'object') return null
  const { admitted, graph_hash: admissionHash } = raw as { admitted?: unknown; graph_hash?: unknown }
  if (typeof admitted !== 'boolean') return null
  if (typeof readGraphHash !== 'string' || readGraphHash.length === 0) return null
  if (typeof admissionHash !== 'string' || !admissionHash.startsWith(readGraphHash)) return null
  return admitted
}

function readPermittedAnalysisMode(raw: unknown, readGraphHash: unknown): PermittedAnalysisMode | null {
  if (readAdmitted(raw, readGraphHash) === null) return null
  const mode = (raw as { permitted_analysis_mode?: unknown }).permitted_analysis_mode
  return (PERMITTED_ANALYSIS_MODES as readonly unknown[]).includes(mode) ? (mode as PermittedAnalysisMode) : null
}

function readCurrentReadInputBasis(raw: unknown, readGraphHash: unknown): unknown {
  // Reuse this read's existing subject binding; never compare it to a Run hash.
  if (readAdmitted(raw, readGraphHash) === null) return null
  const admission = raw as { semantic_signals?: unknown; graph_hash?: unknown }
  return { semantic_signals: admission.semantic_signals, graph_hash: admission.graph_hash }
}

/**
 * Read the scenario's server-side graph.
 *
 * Never throws: every failure mode is a discriminated status, because the one
 * outcome this must not produce is a caller that cannot tell "no graph" from
 * "could not read". A 503 is retried; a 404 and the auth/rate refusals are
 * stable answers and are not.
 */
export async function fetchScenarioGraph(
  scenarioId: string,
  opts: FetchScenarioGraphOptions = {},
): Promise<ScenarioGraphResult> {
  const retryDelayMs = opts.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS
  const maxAttempts = opts.retry503 === false ? 1 : MAX_ATTEMPTS

  // ── IDENTITY: the TOKEN is the authority; the body is the legacy fallback ──
  //
  // ⚠ AN EARLIER VERSION OF THIS COMMENT SAID `CEE_REQUIRE_USER_JWT` IS OFF ON
  //   STAGING. IT IS ON — measured at the deployed boot log (`require_user_jwt:
  //   true`) and on the wire (a JWT-shaped invalid Bearer answers 401
  //   `validator: "user_jwt"`, a branch only reachable with the flag on).
  //
  // What that changes: when we send a token, CEE verifies it and DERIVES
  // identity from the `sub`, ignoring any body `user_id`. When we send none,
  // CEE resolves `service_legacy` and the body `user_id` is the ONLY identity —
  // which is why this call kept working while the comment was wrong, and why
  // the body field is still sent here. It is not redundant yet: CEE's strip of
  // caller-asserted identity on these routes lands only after this half is
  // deployed and a signed-in user is witnessed resolving `verified`.
  //
  // Guests have no session, so both values are null, no auth header is emitted
  // and the request is byte-identical to before this change.
  const identityUserId = sanitiseUserId(opts.userId)

  const body: Record<string, unknown> = {}
  if (identityUserId !== null) {
    body.user_id = identityUserId
  }
  if (opts.includeConversationTurns === true) {
    body.include_conversation_turns = true
  }

  // ONE builder, shared with the turn path (`src/v5/turnAuthHeaders.ts`) — a
  // second way of turning a session into headers is how two answers to one
  // identity question get into a codebase.
  const authHeaders = buildTurnAuthHeaders({
    userId: identityUserId,
    accessToken: opts.accessToken ?? null,
  })

  const url = scenarioGraphUrl(scenarioId)

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // One deadline per attempt, chained to any caller signal so an unmount
    // still cancels immediately.
    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
    const attemptController = new AbortController()
    const onCallerAbort = () => attemptController.abort()
    if (opts.signal) {
      if (opts.signal.aborted) return { status: 'unusable' }
      opts.signal.addEventListener('abort', onCallerAbort, { once: true })
    }
    const timer =
      timeoutMs > 0 ? setTimeout(() => attemptController.abort(), timeoutMs) : null

    const startedAt = Date.now()
    let response: Response
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(body),
        signal: attemptController.signal,
      })
    } catch (err) {
      // Transport failure — offline, CORS, TLS, deadline, or caller abort.
      // Unknown, never absent.
      if ((err as Error)?.name === 'AbortError') {
        logger.warn('scenario_graph.aborted', {
          attempt,
          timedOut: !opts.signal?.aborted,
        })
        return { status: 'unusable' }
      }
      logger.warn('scenario_graph.transport_failure', {
        attempt,
        error: (err as Error)?.message ?? 'unknown',
      })
      return { status: 'unusable' }
    } finally {
      if (timer !== null) clearTimeout(timer)
      opts.signal?.removeEventListener('abort', onCallerAbort)
    }

    if (response.status === 503) {
      if (attempt < maxAttempts) {
        await sleep(retryDelayMs)
        continue
      }
      return { status: 'unavailable' }
    }

    // CONSUMER NOTE 3: this is "not readable", not "deleted". The caller must
    // leave the canvas alone.
    if (response.status === 404) return { status: 'notReadable' }

    if (
      response.status === 401 ||
      response.status === 403 ||
      response.status === 429
    ) {
      // Checked BEFORE the generic arm: the body distinguishes "your token is
      // bad" from "you are not allowed", and only the first is recoverable by
      // the user. Reading the body is safe here — a refusal body is small and
      // the failure mode of an unparseable one is the generic refusal below.
      let body: unknown = null
      try {
        body = await response.json()
      } catch {
        body = null
      }
      if (isSignInRequired(response.status, body)) {
        logger.warn('scenario_graph.sign_in_required', { attempt })
        return { status: 'signInRequired' }
      }
      return { status: 'refused', httpStatus: response.status }
    }

    if (!response.ok) {
      logger.warn('scenario_graph.unexpected_status', { status: response.status })
      return { status: 'unusable' }
    }

    try {
      const raw: unknown = await response.json()
      const result = parseOk(raw)
      if (result.status === 'graph' && result.analysisResult != null && getPayloadInspectionStatus().enabled) {
        // Capture only result-bearing reads: empty polling must not evict the
        // original draft/prompt from the bounded trace store.
        try {
          const completedAt = Date.now()
          const id = crypto.randomUUID()
          const responseHeaders = Object.fromEntries(response.headers?.entries() ?? [])
          const hash = mapV5AnalysisToReport(result.analysisResult as AnalysisResultBlock).model_card.response_hash
          recordRequestPayload({
            id, endpoint: url, method: 'POST', timestamp: startedAt,
            headers: { 'Content-Type': 'application/json', ...authHeaders }, body,
            capture: { kind: 'scenario_graph_read', scenarioId,
              requestId: result.requestId ?? undefined, analysisResultHash: hash },
          })
          recordResponsePayload({ id, status: response.status,
            headers: responseHeaders, body: raw,
            duration: completedAt - startedAt, completedAt })
        } catch {
          // Diagnostic capture must never turn a usable read into a failure.
        }
      }
      return result
    } catch {
      return { status: 'unusable' }
    }
  }

  /* c8 ignore next -- unreachable: the loop returns on every terminal status */
  return { status: 'unavailable' }
}
