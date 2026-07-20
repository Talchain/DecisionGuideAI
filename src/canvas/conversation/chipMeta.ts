/**
 * buildChipMeta — the single construction point for the chip metadata that
 * dispatchAction forwards to sendTurn → buildV5Payload → the wire.
 *
 * Chip metadata travels whenever EITHER field is present: product-authored
 * chips without an honest `action_type` still declare their identity via
 * `parameters` (chip_id / spark_id) so CEE can route on explicit intent
 * instead of re-inferring it from message text (A1 meta-decision diagnosis,
 * 2026-07-20 — anonymous spark text was regex-misread as a decision brief).
 * Before that fix, parameters-only chips were silently stripped
 * (chipMeta = undefined).
 *
 * Pure leaf module so the spark/node-chip intent contract specs can
 * exercise the REAL production seam without importing the useConversation
 * hook graph.
 */

export interface ChipMetaInput {
  /** Deterministic action type for CEE routing. */
  action_type?: string
  /** Structured parameters for action execution / chip identity. */
  parameters?: Record<string, unknown>
}

export interface ChipMeta {
  action_type?: string
  parameters?: Record<string, unknown>
}

export function buildChipMeta(opts: ChipMetaInput): ChipMeta | undefined {
  return opts.action_type || opts.parameters
    ? {
        ...(opts.action_type ? { action_type: opts.action_type } : {}),
        ...(opts.parameters ? { parameters: opts.parameters } : {}),
      }
    : undefined
}

/**
 * The V4/legacy turn-request wire requires `action_type` on chip_metadata
 * (turn-request-builder.ts ChipMetadata). Identity-only meta (parameters
 * without an action_type — the null-intent sparks/chips) is a V5-only
 * concept and must NOT be coerced onto the V4 wire; it is dropped here,
 * matching V4's pre-existing behaviour exactly.
 */
export function toLegacyChipMetadata(
  meta: ChipMeta | undefined,
): { action_type: string; parameters?: Record<string, unknown> } | undefined {
  return meta?.action_type
    ? {
        action_type: meta.action_type,
        ...(meta.parameters ? { parameters: meta.parameters } : {}),
      }
    : undefined
}

/**
 * Wire intents whose NAME is signed off for a FUTURE state but which are not
 * yet FULLY LIVE — meaning BOTH published in the vendored @talchain/schemas
 * enum AND accepted by CEE's deployed service. Registries (spark registry,
 * NodeChip call sites) may map these immediately; the send gate in
 * buildV5Payload (sanitiseActionType → isSendableActionType, which requires
 * membership in KNOWN_ACTION_TYPES AND in CEE_ACCEPTED_ACTION_TYPES) withholds
 * them from the wire — no `action_type` key, no chip_click promotion — until
 * the value is fully live, at which point the send lights up with zero further
 * code change. CEE ingress validates action_type FAIL-CLOSED, so sending early
 * would 422 the whole turn.
 *
 * This list is DECLARATIVE staging, not the gate itself: an entry documents a
 * mapped-but-not-yet-live intent so the contract spec's per-spark tests read
 * the withhold arm against REAL registry data. The gate that actually withholds
 * is CEE_ACCEPTED_ACTION_TYPES in buildPayload — a value CEE has not accepted is
 * withheld whether or not it appears here.
 *
 * Members are added on name sign-off (the type derives from the array) and
 * removed once the value is fully live. Because "fully live" now includes
 * publication, the contract spec's list-hygiene test goes RED the moment the
 * re-vendor publishes a still-listed value, forcing its removal. An entry here
 * is a tested declaration, not a comment.
 *
 * Currently EMPTY. `analysis_readiness` graduated on 2026-07-20 — schemas
 * 0.20.0 re-vendor (published) plus CEE #578 merged and A1's deploy
 * confirmation (accepted) — so it now SENDS via CEE_ACCEPTED_ACTION_TYPES and
 * was removed from this list. The mechanism survives for the next
 * signed-off-but-not-yet-live value.
 */
export const PENDING_WIRE_ACTION_TYPES = [] as const

export type PendingWireActionType = (typeof PENDING_WIRE_ACTION_TYPES)[number]
