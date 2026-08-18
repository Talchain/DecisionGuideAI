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
 *
 * ⚠ `resolveCanvasLabel` NO LONGER LIVES HERE. It moved to
 * `src/canvas/domain/canvasLabels.ts` (18 Aug 2026) so the Model tab's pure
 * projection adapter can share the ONE policy without taking this store
 * subscription with it. There is deliberately NO re-export from this module:
 * a shim would make the policy reachable from two places, which is the defect
 * the move exists to avoid. Import it from its new home.
 */

import { useMemo } from 'react'
import { useCanvasStore } from '../../canvas/store'

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
