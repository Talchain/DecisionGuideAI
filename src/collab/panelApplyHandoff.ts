/**
 * COLLAB — the panel→canvas APPLY handoff.
 *
 * ── WHY A HANDOFF AND NOT A DIRECT SEND ───────────────────────────────────
 * The owner clicks "Use Grace's 0.85" on `/scenario/:id/panel`. Applying it is
 * a `factor_value_edit` TURN, and turns are sent by `sendSystemEvent` from the
 * conversation context — which mounts inside `ReactFlowGraph` (and only when
 * `aiPanelV2` is on). The panel page is a SIBLING route and is outside that
 * provider, so it cannot send a turn and must not grow its own way to.
 *
 * A second turn transport on the panel page would be the same defect the
 * server-side design refuses one level up: the CEE slice deliberately rides the
 * existing `factor_value_edit` path rather than minting a collab-seam
 * graph-write route, because a second writer is how two paths stop agreeing.
 * The client half of that principle is this module — the panel page RECORDS an
 * intent, the canvas DRAINS it through the one real turn sender.
 *
 * ── WHAT IS AND IS NOT STORED ─────────────────────────────────────────────
 * Ids and one number. NO participant token (tokens are shown once and never
 * stored — a property `openRoundRecord.ts` exists to protect and this module
 * must not erode) and NO display name: the label is resolved at render from
 * round data so the R-2 redaction routine reaches every surface. The value is
 * carried VERBATIM as the reveal served it, because CEE compares it to its own
 * record with `Object.is` and refuses on any difference — a rounded number here
 * would refuse every apply.
 *
 * The intent is a CONVENIENCE, never a correctness dependency: storage failures
 * are swallowed, and a drained intent that fails verification server-side is
 * refused loudly by CEE rather than retried. One intent at a time, latest wins.
 */

const KEY_PREFIX = 'olumi.collab.pending-apply.'

/** How long a recorded intent stays drainable. */
const MAX_AGE_MS = 5 * 60 * 1000

export interface PendingPanelApply {
  scenario_id: string
  round_id: string
  participant_id: string
  /** The graph node id the belief targets. */
  target_id: string
  /** The EXACT model-scale number the reveal served. Never re-rounded. */
  value: number
  /** ISO timestamp, stamped at record time. */
  recorded_at: string
}

function keyFor(scenarioId: string): string {
  return `${KEY_PREFIX}${scenarioId}`
}

/**
 * Record the owner's intent to apply one participant's answer.
 *
 * ⚠ FIELDS ARE PICKED, NEVER SPREAD. The natural caller argument is a reveal
 * row, which carries `display_label`; a spread would put a person's name into
 * localStorage, which is exactly the PII the participant-id-only rule keeps out
 * of persisted state.
 */
export function rememberPendingApply(args: {
  scenarioId: string
  roundId: string
  participantId: string
  targetId: string
  value: number
}): void {
  if (args.scenarioId === '' || args.roundId === '' || args.participantId === '') return
  if (args.targetId === '' || !Number.isFinite(args.value)) return
  const record: PendingPanelApply = {
    scenario_id: args.scenarioId,
    round_id: args.roundId,
    participant_id: args.participantId,
    target_id: args.targetId,
    value: args.value,
    recorded_at: new Date().toISOString(),
  }
  try {
    window.localStorage.setItem(keyFor(args.scenarioId), JSON.stringify(record))
  } catch {
    // Private mode / quota. The apply is lost, not corrupted — the owner sees
    // no confirmation on the canvas and can click again.
  }
}

/**
 * Read a recorded intent, validating every field.
 *
 * Returns null for anything malformed, stale, or belonging to another scenario.
 * A cross-scenario record is refused HERE as well as server-side: CEE's binding
 * (a) is the authority, but a client that would send such a turn at all is a
 * client with a defect, and a refused turn is a worse user experience than an
 * ignored intent.
 */
export function readPendingApply(scenarioId: string): PendingPanelApply | null {
  if (scenarioId === '') return null
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(keyFor(scenarioId))
  } catch {
    return null
  }
  if (raw === null) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null) return null
  const r = parsed as Partial<PendingPanelApply>

  if (typeof r.scenario_id !== 'string' || r.scenario_id !== scenarioId) return null
  if (typeof r.round_id !== 'string' || r.round_id === '') return null
  if (typeof r.participant_id !== 'string' || r.participant_id === '') return null
  if (typeof r.target_id !== 'string' || r.target_id === '') return null
  if (typeof r.value !== 'number' || !Number.isFinite(r.value)) return null
  if (typeof r.recorded_at !== 'string') return null

  // Staleness. An intent recorded days ago, drained on some later visit, would
  // silently move a number the owner has long since stopped thinking about.
  const age = Date.now() - Date.parse(r.recorded_at)
  if (!Number.isFinite(age) || age < 0 || age > MAX_AGE_MS) return null

  return {
    scenario_id: r.scenario_id,
    round_id: r.round_id,
    participant_id: r.participant_id,
    target_id: r.target_id,
    value: r.value,
    recorded_at: r.recorded_at,
  }
}

/**
 * Drop a recorded intent.
 *
 * ⚠ CALLED BEFORE THE TURN IS SENT, NOT AFTER. An intent that survives its own
 * dispatch is an intent that can be drained twice — and because the apply is
 * idempotent server-side only in its RESULT, not in its transcript, a double
 * drain would post two turns and write two entries into the user's history for
 * one click. Losing an intent to a failed send costs one more click; replaying
 * one costs the user's trust in what the transcript says happened.
 */
export function forgetPendingApply(scenarioId: string): void {
  if (scenarioId === '') return
  try {
    window.localStorage.removeItem(keyFor(scenarioId))
  } catch {
    // Nothing to do — a stale record expires on age anyway.
  }
}
