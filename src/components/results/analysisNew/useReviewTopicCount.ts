/**
 * How many review topics are open — the SAME queue `ModelReviewTool` walks,
 * counted for About's "Review topics N open" row (V2 prototype `aboutHTML()`:
 * `${reviewItems.length - state.reviewed.size} open`).
 *
 * ⛔ IT COUNTS, IT NEVER DECIDES. The queue is `buildReviewQueue`'s, built from
 * the inputs the tab body hands the review tool (`vm.strengthen.interventions`
 * and the promoted recommendation's id to exclude) over the same canvas nodes
 * and edges. A confirmed, answered or dismissed item leaves that queue, so the
 * length IS the open count — there is no second "reviewed" state to subtract.
 *
 * ⚠ SUBSCRIBED THROUGH SIGNATURES, exactly as `ModelReviewTool` is: React Flow
 * replaces `nodes` on every drag, so selecting the array would re-render the
 * row continuously. `aboutReviewTopicsCountsTheReviewQueue.spec.tsx` mounts the
 * tab and binds this count to the review tool's own "N to review" label, so the
 * two cannot drift apart silently.
 */
import { useMemo } from 'react'
import { useCanvasStore } from '../../../canvas/store'
import { stripNodeValueSignature } from './buildModelStrip'
import { buildReviewQueue } from './buildReviewQueue'
import type { Recommendation } from '../strengthen/strengthenTypes'

export interface ReviewTopicSource {
  /** `vm.strengthen.interventions` — what the body hands `ModelReviewTool`. */
  interventions: readonly Recommendation[]
  /** The recommendation another surface promotes — the review tool's `excludeId`. */
  excludeId: string | null
}

/** `null` when no source is given: the row is then absent, never "0 open". */
export function useReviewTopicCount(source: ReviewTopicSource | undefined): number | null {
  const nodeSignature = useCanvasStore((s) =>
    (s.nodes ?? [])
      .map((n) => `${n.id}:${n.type ?? ''}:${stripNodeValueSignature(n)}`)
      .join('|'),
  )
  const edgeSignature = useCanvasStore((s) => (s.edges ?? []).map((e) => e.id).join('|'))
  const interventions = source?.interventions
  const excludeId = source?.excludeId ?? null
  return useMemo(() => {
    if (!interventions) return null
    const state = useCanvasStore.getState()
    return buildReviewQueue({
      interventions,
      excludeId,
      nodes: state.nodes ?? [],
      edgeIds: (state.edges ?? []).map((e) => e.id),
    }).length
    // The signatures ARE the node and edge dependencies; see above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interventions, excludeId, nodeSignature, edgeSignature])
}
