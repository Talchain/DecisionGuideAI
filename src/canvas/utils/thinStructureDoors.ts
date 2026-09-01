/**
 * A door on the ONE option nobody has argued against.
 *
 * The reasoning frontier (`ghostTiers`) puts a door at the end of a whole ROW —
 * "another risk", somewhere. This puts one on the specific node whose structure
 * is thin, because that is where a team's blind spot actually sits: not in the
 * model as a whole, but on the single option nobody has attached a downside to.
 *
 * ## Why this is an invitation and not a judgement
 *
 * Same line the frontier draws, and it matters more here because the placement
 * is pointed. "Your analysis of Segment is shallow" is a claim about the user's
 * reasoning: it needs the science behind it and belongs to the producer. "Add a
 * risk here", placed where a risk would go, asserts nothing — it is derived
 * from edges that either exist or do not, and it makes no claim about whether
 * the missing risk is important, or whether one exists at all.
 *
 * The copy therefore stays empty of assessment and the PLACEMENT carries the
 * meaning. That is the whole reason this file needs no producer.
 *
 * ## ⭐ IT MARKS ASYMMETRY, NOT SPARSENESS — the rule that keeps it honest
 *
 * A door appears only when SOME options carry a risk and others do not. On a
 * model where NO option has one, every option would get a door — which is not
 * an insight, it is thirteen copies of the same furniture, and it is already
 * what the frontier's row-level risk door is for. On a model where every option
 * has one there is nothing to point at.
 *
 * So the trigger is the model disagreeing with ITSELF: you have thought about
 * what could go wrong with these two and not with that one. That is a fact
 * about the graph, it is the thing a team genuinely misses, and it cannot fire
 * on a model that is simply young.
 */

import type { Edge, Node } from '@xyflow/react'
import { GHOST_ID_PREFIX } from './fitTargets'

export const THIN_STRUCTURE_DOOR_PREFIX = `${GHOST_ID_PREFIX}thin-risk__`

/** The vertical drop from the option's own row. Matches the frontier's gap. */
const DOOR_DROP_PX = 150

function isType(n: Node, type: string): boolean {
  return n.type === type || (n.data as { type?: string } | undefined)?.type === type
}

function labelOf(n: Node): string | null {
  const raw = (n.data as { label?: unknown } | undefined)?.label
  if (typeof raw !== 'string') return null
  const t = raw.trim()
  return t.length > 0 ? t : null
}

/**
 * Options with no risk attached, WHEN some of their siblings have one.
 *
 * Adjacency is checked in both directions: an edge may run option → risk
 * ("this choice creates that danger") or risk → option, and which way a
 * producer drew it is not something this file should have an opinion about.
 */
export function optionsWithoutRisk(nodes: readonly Node[], edges: readonly Edge[]): Node[] {
  const options = nodes.filter((n) => isType(n, 'option'))
  if (options.length < 2) return []

  const riskIds = new Set(nodes.filter((n) => isType(n, 'risk')).map((n) => n.id))
  if (riskIds.size === 0) return []

  const touchesRisk = (id: string) =>
    edges.some(
      (e) =>
        (e.source === id && riskIds.has(e.target)) || (e.target === id && riskIds.has(e.source)),
    )

  const without = options.filter((o) => !touchesRisk(o.id))

  // ⭐ THE ASYMMETRY GATE. All or nothing means there is no asymmetry to point
  // at, and a door on every option is furniture rather than a finding.
  if (without.length === 0 || without.length === options.length) return []
  return without
}

/**
 * Ghost doors for the options above.
 *
 * Reuses the `ghost-tier` node type so these render as the same dashed door the
 * frontier uses — one visual language for one idea — and carry the shared
 * `__ghost-` prefix, which is what every fit and count filter keys on. A door
 * that could inflate the model's own element count would be a worse defect than
 * the gap it points at.
 */
export function withThinStructureDoors(nodes: Node[], edges: readonly Edge[]): Node[] {
  const targets = optionsWithoutRisk(nodes, edges)
  if (targets.length === 0) return nodes

  const doors: Node[] = targets.map((option) => {
    const label = labelOf(option)
    return {
      id: `${THIN_STRUCTURE_DOOR_PREFIX}${option.id}`,
      type: 'ghost-tier',
      position: {
        x: option.position?.x ?? 0,
        y: (option.position?.y ?? 0) + DOOR_DROP_PX,
      },
      data: {
        label: 'What could go wrong?',
        tier: 'risk',
        // States what the model contains and asks a question. It does NOT say
        // the option is under-examined, that a risk is missing, or that the
        // user has overlooked something — all three would be assessments.
        prompt: label
          ? `My model has risks attached to my other options but none attached to ${label}.` +
            ` What could go wrong with ${label} specifically?`
          : 'My model has risks attached to my other options but none attached to this one.' +
            ' What could go wrong with it specifically?',
      },
      selectable: false,
      draggable: false,
      connectable: false,
    } as Node
  })

  return [...nodes, ...doors]
}
