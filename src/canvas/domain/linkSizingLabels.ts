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
 */
import { strengthAcceptedPatch } from './strengthAccepted'
import { strengthStatedPatch } from './strengthStated'

export const LINK_SIZING_LABEL_KEYS = ['strengthAccepted', 'strengthStated'] as const

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
): Record<string, unknown> {
  if (!('provenance' in update)) return merged
  const out = { ...merged }
  for (const k of LINK_SIZING_LABEL_KEYS) delete out[k]
  const carrier = { provenance: update.provenance }
  return { ...out, ...strengthAcceptedPatch(carrier, weight, true), ...strengthStatedPatch(carrier, weight, true) }
}
