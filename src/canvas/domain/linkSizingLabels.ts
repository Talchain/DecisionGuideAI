/**
 * THE LINK-SIZING LABELS AT THE BOUNDARIES THAT DO NOT MAP A WHOLE WIRE EDGE (gate 5 item 2, Codex r1 P1-4).
 *
 * The three ingestion hops build an edge from the wire through the ONE reader per label (`strengthAcceptedPatch`,
 * `strengthStatedPatch`). Two other boundaries merge raw data onto an EXISTING edge: `applyAutoApplyPatch`'s
 * `update_edge` and the strength acknowledgement (`applyV5State`). There:
 *   · the labels are canvas-internal — a payload key with their name is never taken (only the readers write them);
 *   · an update that CARRIES `provenance` is authoritative for them: recompute from it at the edge's resulting weight;
 *   · an update WITHOUT `provenance` says nothing about them: they stand, and the staleness rule (the weight they were
 *     stored at) retires them if the strength moved. Partial omission is never read as removal.
 *   · a CLEAR is written as an explicit `undefined`, never a deleted key (Codex r2 P1-1): the acknowledgement lands
 *     through `updateEdgeData`, a shallow merge onto the stored data, where a missing key keeps the old value.
 *   · an update whose own strength (`weight`, `strength_mean`, `strength.mean`) is not the magnitude the labels would be
 *     stored at derives nothing and clears them (Codex r2 P1-2): provenance about one number never labels another.
 *   · a REWIRE (`relationshipChanged`) without `provenance` clears them (Codex r2 P1-3): an acceptance of A→B is not
 *     an acceptance of A→C.
 */
import { strengthAcceptedPatch } from './strengthAccepted'
import { strengthStatedPatch } from './strengthStated'

export const LINK_SIZING_LABEL_KEYS = ['strengthAccepted', 'strengthStated'] as const

const SAME_WEIGHT_EPSILON = 1e-9

/** Every label key set to an explicit `undefined` (a clear that survives a shallow merge). */
function clearedLabels(): Record<string, undefined> {
  const out: Record<string, undefined> = {}
  for (const k of LINK_SIZING_LABEL_KEYS) out[k] = undefined
  return out
}

/** The magnitudes `update` itself states for the strength, in any of its spellings. */
function updateStrengthMagnitudes(update: Record<string, unknown>): number[] {
  const out: number[] = []
  const push = (v: unknown) => { if (typeof v === 'number' && Number.isFinite(v)) out.push(Math.abs(v)) }
  push(update.weight)
  push(update.strength_mean)
  const strength = update.strength
  if (typeof strength === 'object' && strength !== null && !Array.isArray(strength)) push((strength as Record<string, unknown>).mean)
  return out
}

/** `update` with any incoming label key removed. */
export function withoutLinkSizingLabels(update: Record<string, unknown>): Record<string, unknown> {
  const rest = { ...update }
  for (const k of LINK_SIZING_LABEL_KEYS) delete rest[k]
  return rest
}

/**
 * The edge's data after `update` lands, with the labels decided as above. `weight` is the edge's resulting canvas
 * weight (the magnitude the labels are stored at).
 */
export function relabelLinkSizing(
  merged: Record<string, unknown>,
  update: Record<string, unknown>,
  weight: number,
  options: { relationshipChanged?: boolean } = {},
): Record<string, unknown> {
  const carriesProvenance = 'provenance' in update
  if (!carriesProvenance && options.relationshipChanged !== true) return merged
  const out = { ...merged, ...clearedLabels() }
  if (!carriesProvenance) return out
  if (updateStrengthMagnitudes(update).some((m) => Math.abs(m - weight) > SAME_WEIGHT_EPSILON)) return out
  const carrier = { provenance: update.provenance }
  return { ...out, ...strengthAcceptedPatch(carrier, weight, true), ...strengthStatedPatch(carrier, weight, true) }
}
