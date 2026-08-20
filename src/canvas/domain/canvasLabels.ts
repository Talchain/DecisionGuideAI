/**
 * canvasLabels — THE ONE id → human-label resolution policy for the workspace.
 *
 * ⚠ MOVED HERE, NOT COPIED (18 Aug 2026, the Model-tab rehome lane). This
 * function used to live in `src/v5/blocks/useCanvasLabels.ts` beside the
 * store-bound hook that feeds it. The Model tab's outline needs the identical
 * policy, and `canvas/model-tab-v2/adapters.ts` is a PURE projection that
 * receives its nodes as arguments — so it needs the resolver without the hook.
 *
 * The three ways that could have gone wrong, and why this is none of them:
 *   · a second copy in `canvas/` would be trap 12 — two policies drifting, and
 *     the drift always reads as green;
 *   · a re-export left behind in `v5/blocks/` would be a shim: the same thing
 *     reachable from two places with no single authority;
 *   · `canvas/` importing from `v5/` would invert the dependency (v5 already
 *     imports canvas) and closes a real cycle.
 * So the function moved to the layer it actually belongs to — it depends only on
 * `RAW_ID_PATTERN`, which is canvas-rooted — and every consumer imports it from
 * here. `useCanvasNodeLabels` stays in `v5/blocks/`: it is a store subscription,
 * which is a different concern from the pure policy (trap 21 — two questions
 * must not share one name).
 */

import { RAW_ID_PATTERN } from '../conversation/friendlyOperation'

/**
 * What an element is called when the model gives it no honest name.
 *
 * ⚠ IT LIVES BESIDE THE POLICY THAT PRODUCES THE `null` IT FILLS, and there is
 * exactly one of it. It was briefly declared twice — in `model-tab-v2/adapters.ts`
 * and in `model-tab/ContestedEdgeCard.tsx` — which is the same defect class as the
 * two editors this work removes, at constant scale: one wording for one situation,
 * or the two copies drift and the tab calls the same nameless element two things.
 *
 * The vocabulary follows the estate's existing choice for this situation
 * (`V5FlipAnalysisBlock.tsx:30` — "Unnamed factor"), generalised because an
 * endpoint may be an option or an outcome, not only a factor.
 */
export const UNNAMED_ELEMENT_LABEL = 'Unnamed element'

/**
 * Resolve one wire id to a human label, or `null` when no honest label exists.
 *
 * ⚠ RETURNS `null` RATHER THAN THE ID, AND THAT IS THE WHOLE POINT. Callers must
 * decide what to show instead, and the type makes them decide: there is no way
 * to accidentally fall through to the identifier. Every `label ?? node.id`
 * fallback in the estate is this decision made silently and wrongly.
 *
 * A stored label that is ITSELF a raw id is rejected via `RAW_ID_PATTERN`.
 * Upstream sometimes seeds a node's label from its id; without this guard the
 * leak would simply move one hop upstream and still reach the user.
 */
export function resolveCanvasLabel(
  id: string,
  labels: ReadonlyMap<string, string>,
): string | null {
  return honestLabel(labels.get(id))
}

/**
 * THE POLICY ITSELF, for callers that already hold the candidate string.
 *
 * ⚠ EXTRACTED SO IT CANNOT BE RE-EXPRESSED. An edge carries its OWN `label` (not
 * one looked up by id), so `model-tab-v2/adapters.ts`'s relationship path had no
 * map to hand and read it raw — the id-shaped-label rejection was applied on the
 * node path and not on its neighbour, inside one function. The alternative was a
 * caller building a one-entry `Map` to borrow the lookup, which is the policy
 * smuggled through a data structure rather than named.
 *
 * `resolveCanvasLabel` is now this function plus a lookup, so there is exactly
 * one definition of what an honest label is.
 */
export function honestLabel(label: unknown): string | null {
  if (typeof label !== 'string') return null
  const trimmed = label.trim()
  if (trimmed === '') return null
  // Producers sometimes seed a label from an id; without this the leak just
  // moves one hop upstream and still reaches the user.
  if (RAW_ID_PATTERN.test(trimmed)) return null
  return trimmed
}

/**
 * Build the id → label map from a node collection.
 *
 * The pure counterpart of `useCanvasNodeLabels` for callers that already hold
 * the nodes (a projection adapter, a test). Deliberately NOT a second policy:
 * it only assembles the map; `resolveCanvasLabel` still decides what is honest.
 */
export function buildCanvasLabelMap(
  nodes: readonly { id: string; data?: unknown }[],
): ReadonlyMap<string, string> {
  const map = new Map<string, string>()
  for (const n of nodes) {
    const label = (n.data as { label?: unknown } | undefined)?.label
    if (typeof label === 'string' && label.trim() !== '') map.set(n.id, label)
  }
  return map
}
