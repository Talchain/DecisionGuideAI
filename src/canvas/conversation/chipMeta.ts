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
 * Wire intents whose NAME is signed off for a FUTURE @talchain/schemas
 * version but which are not yet present in the vendored enum. Registries
 * (spark registry, NodeChip call sites) may map these immediately; the
 * schema-derived wire gate in buildV5Payload (sanitiseActionType →
 * KNOWN_ACTION_TYPES → ActionType.options) withholds them from the wire —
 * no `action_type` key, no chip_click promotion — until a re-vendor
 * publishes the value, at which point the send lights up with zero further
 * code change. CEE ingress validates action_type FAIL-CLOSED, so sending
 * early would 422 the whole turn.
 *
 * Currently empty: the 0.20.0 chip-intent value name is pending sign-off.
 * Add the literal to the ARRAY when the name lands (the type derives from
 * it); remove it once the schema re-vendor makes it part of
 * ActionTypeLiteral. The spark intent contract spec consults this list, so
 * an entry here is a tested declaration, not a comment.
 */
export const PENDING_WIRE_ACTION_TYPES = [] as const

export type PendingWireActionType = (typeof PENDING_WIRE_ACTION_TYPES)[number]
