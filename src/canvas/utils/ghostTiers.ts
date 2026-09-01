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
// The producer's own word for "this node has no name". Imported, never
// re-spelled: the estate already carries eight hand-copied `'Untitled'`
// literals, and a ninth that drifted would silently re-open B2(a).
import { UNNAMED_ELEMENT_LABEL } from '../domain/elementLabel'

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

/**
 * What a door can see from where it stands. Facts only, no derived judgement.
 *
 * ⚠ THE COUNT IS SEPARATE FROM THE LABELS ON PURPOSE, and this is the whole
 * repair. The context used to be a single `siblingLabels` array built by
 * filtering out the unnamed — so a tier of three options with one name reached
 * the prompt as a list of one, and the sentence "these are the options
 * currently in my model" then told Olumi, in the user's own transcript and
 * under the user's own name, that their model held one option. Filtering is
 * silent by nature; the only defence is to carry what was filtered.
 */
export interface GhostPromptContext {
  /** Labels of the tier members that carry a real name, in canvas order. */
  namedSiblings: readonly string[]
  /** How many members the tier holds IN TOTAL — named or not. */
  siblingCount: number
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

/**
 * State what a tier holds, in a sentence that stays true whatever it holds.
 *
 * Three states, because a tier really has three and collapsing them is what
 * produced a false sentence:
 *
 *   3 named of 3  → "My model has 3 options: A, B, C."
 *   1 named of 3  → "My model has 3 options. The ones I have named: A — the
 *                    other 2 are not named yet."
 *   0 named of 3  → "My model has 3 options, none of which I have named yet."
 *
 * ⭐ THE COUNT LEADS IN EVERY BRANCH, which is also what fixes the furniture
 * problem. The previous copy was byte-identical for one risk and for three
 * whenever the labels were missing, so the door degraded into generic text on
 * exactly the sparse, early-stage model the frontier exists to serve. A stated
 * count differs between those two models even when no name does.
 *
 * ⚠ IT REPORTS, IT DOES NOT ASSESS. "None of which I have named yet" is an
 * observable fact about the graph. "Your model is underspecified" would be a
 * claim about the user's reasoning and belongs to the producer — the line this
 * file does not cross.
 */
export function inventorySentence(
  named: readonly string[],
  total: number,
  one: string,
  many: string,
): string {
  const noun = total === 1 ? one : many
  const unnamed = total - named.length
  if (named.length === 0) {
    return `My model has ${total} ${noun}, none of which I have named yet.`
  }
  if (unnamed <= 0) {
    return `My model has ${total} ${noun}: ${listForPrompt(named)}.`
  }
  return (
    `My model has ${total} ${noun}. The ones I have named: ${listForPrompt(named)}` +
    ` — the other ${unnamed} ${unnamed === 1 ? 'is' : 'are'} not named yet.`
  )
}

/**
 * The subject clause, omitted entirely when the graph does not carry one.
 *
 * ⚠ A LABEL THAT ALREADY ENDS IN PUNCTUATION SUPPLIES ITS OWN TERMINATOR.
 * Appending ours produced "The decision is: Acquire Acme?." — and this string
 * is not internal, it lands in the user's transcript attributed to the user.
 */
function about(subject: string | null): string {
  if (!subject) return ''
  const terminator = /[.!?]$/.test(subject) ? '' : '.'
  return ` The decision is: ${subject}${terminator}`
}

export const GHOST_TIERS: readonly GhostTier[] = [
  {
    id: GHOST_OPTION_NODE_ID,
    siblingType: 'option',
    label: 'Another option',
    // Names the options that exist and asks what sits outside them. It does NOT
    // say they are too similar or badly framed — the user reads the list and
    // draws their own conclusion, which is the whole point.
    prompt: ({ namedSiblings, siblingCount, subject }) =>
      inventorySentence(namedSiblings, siblingCount, 'option', 'options') +
      `${about(subject)} What other options could answer this that I have not put on the board?`,
  },
  {
    id: `${GHOST_ID_PREFIX}factor__`,
    siblingType: 'factor',
    label: 'Another factor',
    prompt: ({ namedSiblings, siblingCount, subject }) =>
      inventorySentence(namedSiblings, siblingCount, 'factor', 'factors') +
      `${about(subject)} What else could materially affect how this turns out?`,
  },
  {
    id: `${GHOST_ID_PREFIX}risk__`,
    siblingType: 'risk',
    label: 'Another risk',
    prompt: ({ namedSiblings, siblingCount, subject }) =>
      inventorySentence(namedSiblings, siblingCount, 'risk', 'risks') +
      `${about(subject)} What could go wrong that these do not already cover?` +
      ' Consider failure modes a forecast would miss.',
  },
  {
    id: `${GHOST_ID_PREFIX}outcome__`,
    siblingType: 'outcome',
    label: 'Another outcome',
    prompt: ({ namedSiblings, siblingCount, subject }) =>
      inventorySentence(namedSiblings, siblingCount, 'outcome', 'outcomes') +
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
  if (trimmed.length === 0) return null
  // ⭐ THE COMMENT ABOVE SAID THIS; THE CODE DID NOT DO IT.
  //
  // `'Untitled'` is not a name a user typed — it is what four separate
  // producers WRITE when there is no name: the CEE patch-apply path
  // (`applyPatch.ts:82`, the primary draft journey), `persist.ts:35/43`,
  // `migrations.ts:121` and `store.ts:6112/6212`. A `typeof === 'string'`
  // test cannot tell that apart from a real label, so every unnamed node
  // reached the prompt as a node genuinely called "Untitled" and was read
  // back to the user as part of their own model.
  //
  // The guard was correct and pointed at the wrong bytes: it rejected the
  // representation I imagined (whitespace) and admitted the one the producers
  // actually emit. Compared case-insensitively because the literal is a
  // display string, and matched against the canonical constant so a rename
  // at the source cannot leave this reader behind.
  if (trimmed.toLowerCase() === UNNAMED_ELEMENT_LABEL.toLowerCase()) return null
  return trimmed
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

/**
 * ⭐ WHETHER THE FRONTIER IS ON SCREEN AT ALL — the gate, named and exported.
 *
 * This was an inline condition inside a `useMemo` in a 2,700-line component
 * (`ReactFlowGraph.tsx`), which is the reason nothing could bind to it and the
 * reason a mount-path spec resorted to reading source text instead. An
 * assertion about a condition no test can call is not an assertion.
 *
 * ⚠ IT IS ALSO THE ONLY THING THAT DECIDES. There was believed to be a second
 * control — an `enableGhostSuggestions` prop — and there was not: it was
 * declared, defaulted `false`, destructured, and never read, so the doors
 * rendered on EVERY mount of the graph regardless. The prop is now deleted
 * rather than wired, because a switch whose only effect would be to turn off a
 * capability we want on is a dark-launch gate this estate has ruled against.
 *
 * ⚠ AND NOTE WHAT IT SAYS, because it is very likely the mechanism behind a
 * deployed measurement of zero doors against thirteen real nodes: after an
 * analysis completes, the frontier disappears in every view except Expert.
 * That is the existing behaviour, preserved here deliberately and unchanged —
 * whether it is the RIGHT behaviour is a product question, not a refactor, and
 * it is raised separately rather than flipped in passing.
 */
export function frontierIsVisible(
  resultsStatus: string | null | undefined,
  viewMode: string,
): boolean {
  const isPostAnalysis = resultsStatus === 'complete'
  return !(isPostAnalysis && viewMode !== 'expert')
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
          namedSiblings: siblings.map(labelOf).filter((l): l is string => l !== null),
          // The UNFILTERED count. `siblings` is the tier as it really is; the
          // line above is what survived naming. Passing both is what lets the
          // sentence describe a partly-unnamed tier without either inventing
          // names or under-reporting the model.
          siblingCount: siblings.length,
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
