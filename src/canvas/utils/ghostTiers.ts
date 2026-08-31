/**
 * The reasoning frontier — an invitation at the edge of every tier.
 *
 * ⭐ WHY THIS IS NOT A JUDGEMENT, AND WHY THAT MATTERS.
 *
 * The canvas must not decide what a deficient model looks like. "Your options
 * are too similar" is a claim about the user's thinking, it needs the science
 * behind it, and it belongs to the producer — a UI that mints such claims
 * becomes a second authority on reasoning semantics, which is the defect class
 * this estate pays for most often.
 *
 * An INVITATION is a different thing. "Add a risk", placed where a risk would
 * go, asserts nothing about the model at all. It cannot be wrong, because it
 * makes no claim. That distinction is the whole reason this file can exist
 * without a producer.
 *
 * ⚠ SO THE COPY HERE IS DELIBERATELY EMPTY OF ASSESSMENT. Not "you are missing
 * a risk" — the product does not know that. Just an open door in the place
 * where the thing would be, and a question sent to Olumi when the user opens
 * it. The user decides whether anything comes back worth keeping.
 *
 * ⚠ AND THE GHOSTS ARE NOT THE MODEL. They are excluded from the camera fit and
 * from every count, exactly as `__ghost-option__` already is, so they cannot
 * inflate what the graph appears to contain.
 */

import type { Node } from '@xyflow/react'
// The prefix, the id and the predicate all live in `fitTargets`, which owns
// exclusion. Imported rather than restated: this file used to declare its own
// copies of the first two, so the filter and the ids it filtered were two
// independent lists that happened to agree.
import { GHOST_ID_PREFIX, GHOST_OPTION_NODE_ID } from './fitTargets'

export { GHOST_ID_PREFIX, GHOST_OPTION_NODE_ID, isGhostNode } from './fitTargets'

/** One frontier slot per tier the product models. */
export interface GhostTier {
  /** Node id — the `__ghost-` prefix is what every exclusion filter keys on. */
  id: string
  /** The node type whose row this sits at the end of. */
  siblingType: string
  label: string
  /**
   * What clicking asks Olumi. A QUESTION, never an instruction to insert:
   * the user is the author, and a ghost that silently added to the model
   * would make the AI the author instead.
   */
  prompt: string
}

export const GHOST_TIERS: readonly GhostTier[] = [
  {
    id: GHOST_OPTION_NODE_ID,
    siblingType: 'option',
    label: 'Another option',
    prompt: "Suggest an additional option I haven't considered for this decision",
  },
  {
    id: `${GHOST_ID_PREFIX}factor__`,
    siblingType: 'factor',
    label: 'Another factor',
    prompt:
      "What factors could materially affect this decision that aren't represented in the model yet?",
  },
  {
    id: `${GHOST_ID_PREFIX}risk__`,
    siblingType: 'risk',
    label: 'Another risk',
    prompt:
      'What could go wrong here that the model does not currently capture? Consider failure modes a forecast would miss.',
  },
  {
    id: `${GHOST_ID_PREFIX}outcome__`,
    siblingType: 'outcome',
    label: 'Another outcome',
    prompt:
      'What further consequences could follow from this decision that the model does not represent?',
  },
] as const

/**
 * Place one ghost at the end of each tier that already has members.
 *
 * ⚠ ONLY BESIDE AN EXISTING ROW. A ghost on an empty tier would be the product
 * asserting that the tier ought to have members — a judgement, which is the
 * line this file does not cross. It also has nowhere to sit: the position is
 * derived from the row it joins.
 */
export function withGhostTiers(nodes: Node[], enabledTiers: readonly GhostTier[] = GHOST_TIERS): Node[] {
  const ghosts: Node[] = []

  for (const tier of enabledTiers) {
    const siblings = nodes.filter(
      (n) =>
        n.type === tier.siblingType ||
        (n.data as { type?: string } | undefined)?.type === tier.siblingType,
    )
    if (siblings.length === 0) continue

    const maxX = Math.max(...siblings.map((n) => n.position?.x ?? 0))
    const anchor = siblings.find((n) => (n.position?.x ?? 0) === maxX)
    const measuredW =
      (anchor as { measured?: { width?: number }; width?: number } | undefined)?.measured?.width ??
      (anchor as { width?: number } | undefined)?.width ??
      200

    ghosts.push({
      id: tier.id,
      type: 'ghost-tier',
      position: { x: maxX + measuredW + 60, y: anchor?.position?.y ?? 0 },
      data: { label: tier.label, prompt: tier.prompt, tier: tier.siblingType },
      selectable: false,
      draggable: false,
      connectable: false,
    } as Node)
  }

  return ghosts.length > 0 ? [...nodes, ...ghosts] : nodes
}
