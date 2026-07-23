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
  /**
   * First-class chip identity (@talchain/schemas 0.22.0 `chip.id`). When
   * omitted, buildChipMeta LIFTS it from the identity already carried inside
   * `parameters` (`chip_id` / `spark_id`) — the promotion the S2 design asks
   * for ("populate chip.id from the existing chip_id/spark_id the UI already
   * sends inside parameters"). An explicit `id` always wins over the lift.
   */
  id?: string
  /** Deterministic action type for CEE routing (11-member `ActionType`). */
  action_type?: string
  /**
   * Typed authored intent (@talchain/schemas 0.22.0 `chip.intent`, an 11-member
   * `Intent` set incl. `add_option`). Decoupled from `action_type`: an intent
   * names WHAT the user wants; the send gate in buildV5Payload
   * (sanitiseIntent → CEE_ACCEPTED_INTENTS) decides whether it reaches the wire.
   */
  intent?: string
  /** Structured parameters for action execution / chip identity. */
  parameters?: Record<string, unknown>
}

export interface ChipMeta {
  id?: string
  action_type?: string
  intent?: string
  parameters?: Record<string, unknown>
}

/**
 * Derive the first-class chip id: an explicit `id` wins, else the identity the
 * UI already ships inside `parameters` (`chip_id`, then `spark_id`). This is a
 * pure identity LIFT (same value, promoted to a typed field) — not a meaning
 * transform. `parameters` keeps carrying the id too, for back-compat with the
 * presence-based routing until CEE reads `chip.id`.
 */
function deriveChipId(opts: ChipMetaInput): string | undefined {
  if (typeof opts.id === 'string' && opts.id.length > 0) return opts.id
  const p = opts.parameters
  if (!p) return undefined
  const chipId = p['chip_id']
  if (typeof chipId === 'string' && chipId.length > 0) return chipId
  const sparkId = p['spark_id']
  if (typeof sparkId === 'string' && sparkId.length > 0) return sparkId
  return undefined
}

export function buildChipMeta(opts: ChipMetaInput): ChipMeta | undefined {
  const id = deriveChipId(opts)
  const hasAny = id || opts.action_type || opts.intent || opts.parameters
  if (!hasAny) return undefined
  return {
    ...(id ? { id } : {}),
    ...(opts.action_type ? { action_type: opts.action_type } : {}),
    ...(opts.intent ? { intent: opts.intent } : {}),
    ...(opts.parameters ? { parameters: opts.parameters } : {}),
  }
}

/**
 * The V4/legacy turn-request wire requires `action_type` on chip_metadata
 * (turn-request-builder.ts ChipMetadata). Identity-only meta (parameters
 * without an action_type — the null-intent sparks/chips) is a V5-only
 * concept and must NOT be coerced onto the V4 wire; it is dropped here,
 * matching V4's pre-existing behaviour exactly. The 0.22 `id` and `intent`
 * fields are likewise V5-only and intentionally absent from the V4 shape —
 * they are simply not read here.
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
