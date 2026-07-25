/**
 * useCanvasLabels — resolve wire identifiers to human labels for V5 blocks.
 *
 * WHY THIS IS NEEDED AT ALL: the V5 explanation and flip_analysis block
 * schemas carry NO labels. `ExplanationBlockSchema` is
 * `{narrative, referenced_option_ids: string[]}` and each flip scenario is
 * `{factor_id, current_value, flip_threshold, ...}` — the producer sends
 * pointers only. (Contrast `ComparisonBlockSchema`, which does carry a
 * sibling `label` per option, which is why V5ComparisonBlock needs no
 * resolver.) Adding label fields to those two would be a wire-format change
 * requiring a schemas release plus a producer change, so the friendly label
 * is computed UI-side from the canvas store — the same doctrine
 * `v5GraphPatchDescription.ts` already states and `V5GraphPatchBlock`
 * already follows.
 *
 * Options are canvas nodes (there is no separate option entity), so one node
 * map resolves both `option_id` and `factor_id`.
 */

import { useMemo } from 'react'
import { useCanvasStore } from '../../canvas/store'
import { RAW_ID_PATTERN } from '../../canvas/conversation/friendlyOperation'

/**
 * Node id → display label for every canvas node that has one.
 *
 * Subscribes to `nodes` only. Deliberately does not read `edges`: neither
 * consumer resolves edges, and subscribing would re-render these blocks on
 * every edge change.
 */
export function useCanvasNodeLabels(): ReadonlyMap<string, string> {
  const nodes = useCanvasStore(
    (s: { nodes?: Array<{ id: string; data?: { label?: unknown } }> }) =>
      s.nodes,
  )
  return useMemo(() => {
    const map = new Map<string, string>()
    for (const n of nodes ?? []) {
      const label = typeof n.data?.label === 'string' ? n.data.label : ''
      if (label) map.set(n.id, label)
    }
    return map
  }, [nodes])
}

/**
 * Resolve one wire id to a human label, or `null` when no honest label
 * exists.
 *
 * Returns `null` rather than the id — that is the whole point. Callers must
 * decide what to show instead, and the type makes them decide: there is no
 * way to accidentally fall through to the identifier.
 *
 * A stored label that is ITSELF a raw id is rejected via `RAW_ID_PATTERN`.
 * Upstream sometimes seeds a node's label from its id; without this guard the
 * leak would simply move one hop upstream and still reach the user.
 */
export function resolveCanvasLabel(
  id: string,
  labels: ReadonlyMap<string, string>,
): string | null {
  const label = labels.get(id)
  if (label === undefined) return null
  const trimmed = label.trim()
  if (trimmed === '') return null
  if (RAW_ID_PATTERN.test(trimmed)) return null
  return trimmed
}
