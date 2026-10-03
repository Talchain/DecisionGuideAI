/**
 * ⭐ ONE "NO VALUE YET" RULE FOR EVERY RESULTS SURFACE — the ids of the nodes
 * this run ranked while holding no value for them, and which still carry no
 * stated value now. The canvas card (`useFactorRunCues`), the Reasoning tab's
 * driver rows (#2239), the Analysis-tab hero, the Drivers crown and the
 * decision brief all read this predicate, so no surface can name a driver as
 * "main" while another says it has no value yet (DL 5869404773).
 *
 * Takes the FEED, not the report, so `useResultsSectionData` (which owns
 * `selectDriverPolicyFeed`) can call it without an import cycle.
 *
 * `runHoldsNoValueFor` answers the run half; `hasAnyStatedValue` retires the
 * cue once the user states a value (the stale row then asks for a re-run).
 */
import type { Node } from '@xyflow/react'
import { runHoldsNoValueFor } from '../../canvas/nodes/shared/unvaluedDriver'
import { holdsValueOrRange } from '../../canvas/utils/observedStateHelpers'

export function noValueDriverIds(
  /** `selectDriverPolicyFeed(report)`; `null` when there is no run report. */
  feed: Parameters<typeof runHoldsNoValueFor>[0] | null,
  nodes: ReadonlyArray<Pick<Node, 'id' | 'data'>> | null | undefined,
): ReadonlySet<string> {
  if (feed == null) return new Set()
  const ids = new Set<string>()
  for (const n of nodes ?? []) {
    if (runHoldsNoValueFor(feed, n.id) && !holdsValueOrRange(n.data)) ids.add(n.id)
  }
  return ids
}
