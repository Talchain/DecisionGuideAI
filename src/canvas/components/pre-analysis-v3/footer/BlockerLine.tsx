/**
 * BlockerLine — ONE blocking line, and the deep-link to the thing it is about.
 *
 * ── WHY IT EXISTS ──────────────────────────────────────────────────────────
 * Every blocker line was inert text. A tester reading *"Choose the missing
 * effect value for X on Y."* five times over then had to hunt each option and
 * factor on the canvas by hand — and THAT hunting, not the sentences, is the
 * friction. The retired `pre-analysis/BlockersSection` deep-linked every one
 * (`onFocusNode(id)`, `aria-label="Open … in inspector"`,
 * `data-testid="blocker-option-link-<id>"`); the v3 footer dropped the
 * affordance when it replaced that component. This restores it, to the pattern
 * the post-run "Resolve next" surface already ships.
 *
 * ── THE ONE RULE THAT MATTERS: NEVER OFFER A CONTROL THAT GOES NOWHERE ─────
 * `GateBlockedItem.scope.id` is the PRODUCER's id. Nothing upstream knows
 * whether a node with that id is on this user's canvas, and a button that
 * silently focuses nothing is worse than plain text: it advertises an action
 * that terminates in refusal, which is the defect class this product exists to
 * delete.
 *
 * So the target is RESOLVED against the live graph, with `findNodeMatches` —
 * the same matcher the post-run rows use, id first and label as the fallback —
 * and the link is offered ONLY on an EXACT match. A fuzzy match is a guess, and
 * a guess that takes the user to the wrong node while looking exactly as
 * authoritative as a correct link is the harm, not the convenience. Everything
 * that does not resolve exactly renders as the plain sentence it always was.
 *
 * The node id that is FOCUSED is the MATCH's `targetId`, never the producer's
 * raw id — those are two id spaces and only the matcher knows the mapping.
 *
 * ⚠ THIS COMPONENT ADDS NO ORDER, NO GROUPING AND NO EMPHASIS. It renders the
 * line it is given, in the position it is given. See `GateBlockedListing` for
 * why no honest ranking of these lines exists.
 */

import { useMemo } from 'react'
import { useCanvasStore } from '../../../store'
import { focusNodeById } from '../../../utils/focusHelpers'
import type { GateBlockedItem } from '../../../utils/canRunAnalysis'
import { findNodeMatches } from '../../../utils/driverMatching'
import type { Node } from '@xyflow/react'

/**
 * The canvas node this line is about, or `null` when nothing resolves exactly.
 *
 * Exported and pure so a spec can pin the resolution without a canvas, and so
 * the two surfaces cannot each grow their own version of it.
 */
export function resolveBlockerTarget(
  item: GateBlockedItem,
  nodes: readonly Node[],
): string | null {
  const scope = item.scope
  if (scope === undefined) return null
  if (scope.id === undefined && scope.label === undefined) return null
  const matches = findNodeMatches(
    { kind: 'node', id: scope.id, label: scope.label },
    nodes as Node[],
  )
  // EXACT ONLY. `findNodeMatches` also returns fuzzy `contains` matches, which
  // are a reasonable basis for a highlight and a poor one for navigation.
  const exact = matches.find((m) => m.confidence === 'exact')
  return exact ? exact.targetId : null
}

export function BlockerLine({ item }: { item: GateBlockedItem }) {
  // Subscribe rather than `getState()`: a node can be added or relabelled after
  // this list renders, and a snapshot read would leave the link stale.
  const nodes = useCanvasStore((s) => s.nodes)
  const targetId = useMemo(() => resolveBlockerTarget(item, nodes), [item, nodes])

  if (targetId === null) return <>{item.text}</>

  return (
    <button
      type="button"
      onClick={() => focusNodeById(targetId)}
      className="text-left text-info hover:underline focus-visible:underline focus-visible:outline-none"
      // Names the DESTINATION, not the sentence: the sentence is already the
      // visible label, and a screen reader reading it twice says nothing new.
      aria-label={`Open "${item.text}" in the inspector`}
      data-testid={`blocker-option-link-${targetId}`}
    >
      {item.text}
    </button>
  )
}
