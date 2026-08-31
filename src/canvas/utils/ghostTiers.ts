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
   *
   * ⭐ BUILT FROM THE MODEL AT CLICK TIME, not a static string.
   *
   * These were fixed sentences — "Suggest an additional option I haven't
   * considered for this decision" — which would read identically in any
   * product, about any decision, and told the model nothing it could not have
   * guessed. The door already knows which siblings it is standing beside, so
   * naming them costs a string join and turns a generic ask into one that could
   * only have been asked about THIS model.
   *
   * ⚠ IT STATES FACTS AND ASKS A QUESTION — never an assessment. "Your options
   * are too similar" is a claim about the user's reasoning and belongs to the
   * producer. "These are the options currently in the model: A, B, C. What else
   * could answer this?" asserts only what is demonstrably there. That line is
   * what keeps this file free of a producer dependency, and specificity does
   * not cross it.
   */
  prompt: (context: GhostPromptContext) => string
}

/** What a door can see from where it stands. Facts only, no derived judgement. */
export interface GhostPromptContext {
  /** Labels of the tier members this door sits beside, in canvas order. */
  siblingLabels: readonly string[]
  /** The decision or goal this model is about, when the graph carries one. */
  subject: string | null
}

/**
 * Join labels for a prompt without letting a large model produce a huge one.
 *
 * Caps at eight and says how many were left out rather than truncating
 * silently — a list that stops without saying so would misrepresent the model
 * to Olumi, which is the same honesty rule the canvas applies to the user.
 */
export function listForPrompt(labels: readonly string[]): string {
  const shown = labels.slice(0, 8)
  const rest = labels.length - shown.length
  const joined = shown.join(', ')
  return rest > 0 ? `${joined} (and ${rest} more)` : joined
}

/** The subject clause, omitted entirely when the graph does not carry one. */
function about(subject: string | null): string {
  return subject ? ` The decision is: ${subject}.` : ''
}

export const GHOST_TIERS: readonly GhostTier[] = [
  {
    id: GHOST_OPTION_NODE_ID,
    siblingType: 'option',
    label: 'Another option',
    // Names the options that exist and asks what sits outside them. It does NOT
    // say they are too similar or badly framed — the user reads the list and
    // draws their own conclusion, which is the whole point.
    prompt: ({ siblingLabels, subject }) =>
      `These are the options currently in my model: ${listForPrompt(siblingLabels)}.` +
      `${about(subject)} What other options could answer this that I have not put on the board?`,
  },
  {
    id: `${GHOST_ID_PREFIX}factor__`,
    siblingType: 'factor',
    label: 'Another factor',
    prompt: ({ siblingLabels, subject }) =>
      `My model already accounts for these factors: ${listForPrompt(siblingLabels)}.` +
      `${about(subject)} What else could materially affect how this turns out?`,
  },
  {
    id: `${GHOST_ID_PREFIX}risk__`,
    siblingType: 'risk',
    label: 'Another risk',
    prompt: ({ siblingLabels, subject }) =>
      `The risks currently in my model are: ${listForPrompt(siblingLabels)}.` +
      `${about(subject)} What could go wrong that these do not already cover?` +
      ' Consider failure modes a forecast would miss.',
  },
  {
    id: `${GHOST_ID_PREFIX}outcome__`,
    siblingType: 'outcome',
    label: 'Another outcome',
    prompt: ({ siblingLabels, subject }) =>
      `The outcomes currently in my model are: ${listForPrompt(siblingLabels)}.` +
      `${about(subject)} What further consequences could follow that these do not represent?`,
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
/** The label a node carries, or null. Never a placeholder — an unnamed node
 *  must not reach a prompt as "Untitled" and be described back to the user as
 *  though the model contained something called that. */
function labelOf(n: Node): string | null {
  const raw = (n.data as { label?: unknown } | undefined)?.label
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : null
}

/**
 * What the model is ABOUT, for the prompt's subject clause.
 *
 * Prefers the decision node, falls back to the goal, and returns null when
 * neither carries a usable label — the clause is then omitted rather than
 * filled with a guess.
 */
function readSubject(nodes: Node[]): string | null {
  const byKind = (kind: string) =>
    nodes.find(
      (n) => n.type === kind || (n.data as { type?: string } | undefined)?.type === kind,
    )
  const node = byKind('decision') ?? byKind('goal')
  return node ? labelOf(node) : null
}

export function withGhostTiers(nodes: Node[], enabledTiers: readonly GhostTier[] = GHOST_TIERS): Node[] {
  const ghosts: Node[] = []
  const subject = readSubject(nodes)

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
      data: {
        label: tier.label,
        // Composed HERE, where the siblings are already in hand, rather than in
        // the node component — the door should not have to re-derive the model
        // it is standing in, and two derivations of one list is how they come
        // to disagree.
        prompt: tier.prompt({
          siblingLabels: siblings.map(labelOf).filter((l): l is string => l !== null),
          subject,
        }),
        tier: tier.siblingType,
      },
      selectable: false,
      draggable: false,
      connectable: false,
    } as Node)
  }

  return ghosts.length > 0 ? [...nodes, ...ghosts] : nodes
}
