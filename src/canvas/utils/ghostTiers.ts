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
// The product's own words for the two node kinds a subject can come from.
// Imported, never re-typed: `DECISION_NODE_LABEL` changed on 31 Aug, and a
// sentence carrying a hand-copied 'Decision' would still be saying the retired
// word in the user's transcript today.
import { DECISION_NODE_LABEL, GOAL_NODE_LABEL } from '../domain/vocabulary'

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
  /** What this model is about, when the graph carries it. */
  subject: ModelSubject | null
}

/**
 * What the model is about, AND what the product calls the node it came from.
 *
 * ⚠ THE NOUN TRAVELS WITH THE LABEL, and that is the whole repair. `readSubject`
 * resolves decision-then-goal, and the clause that rendered it was hardcoded
 * "The decision is: X" — so a model with a goal and no decision told the user,
 * in their own transcript and under their own name, that their goal was a
 * decision. A resolver that returns only the string forces every reader to guess
 * the kind, and the guess was wrong for one of the two kinds it could be.
 */
export interface ModelSubject {
  /** The subject's label, exactly as the user wrote it. */
  readonly label: string
  /**
   * The product's on-screen word for that node's KIND, mid-sentence. Derived
   * from `domain/vocabulary`, never spelled here — the canvas and this sentence
   * must call one thing one name.
   */
  readonly noun: string
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
function about(subject: ModelSubject | null): string {
  if (!subject) return ''
  const terminator = /[.!?]$/.test(subject.label) ? '' : '.'
  return ` The ${subject.noun} is: ${subject.label}${terminator}`
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
 *
 * ⚠ IT NOW RETURNS THE KIND ALONGSIDE THE LABEL, AND THE RESOLUTION IS
 * OTHERWISE UNCHANGED. The `??` chain, and with it the existing behaviour that
 * an UNNAMED decision node suppresses the clause rather than falling through to
 * the goal, is preserved exactly: the defect was the noun, and widening the
 * resolution while fixing the noun would be a second, unasked change hiding
 * inside the first.
 */
function readSubject(nodes: Node[]): ModelSubject | null {
  const isKind = (n: Node, kind: string) =>
    n.type === kind || (n.data as { type?: string } | undefined)?.type === kind
  const byKind = (kind: string) => nodes.find((n) => isKind(n, kind))

  const node = byKind('decision') ?? byKind('goal')
  if (!node) return null
  const label = labelOf(node)
  if (label === null) return null

  // Read off the node that was ACTUALLY chosen, rather than inferred from which
  // lookup ran: the two must not be able to disagree.
  const noun = isKind(node, 'decision') ? DECISION_NODE_LABEL : GOAL_NODE_LABEL
  return { label, noun: noun.toLowerCase() }
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

/**
 * The members of one tier, by the producer's two spellings of a node's kind.
 *
 * ⚠ SPELLED ONCE ON PURPOSE. `withGhostTiers` and the legacy option door both
 * need this predicate, and two copies of it are how the door's sentence and the
 * door's position come to describe different sets of nodes.
 */
function siblingsOf(nodes: Node[], siblingType: string): Node[] {
  return nodes.filter(
    (n) =>
      n.type === siblingType || (n.data as { type?: string } | undefined)?.type === siblingType,
  )
}

/**
 * What a door standing at the end of a tier's row can see. Facts only.
 *
 * The UNFILTERED count travels alongside the surviving names: `siblings` is the
 * tier as it really is, `namedSiblings` is what survived naming. Passing both is
 * what lets the sentence describe a partly-unnamed tier without either inventing
 * names or under-reporting the model.
 *
 * ⚠⚠ AND "AS IT REALLY IS" MEANS AS THE CANVAS RENDERS IT, NOT AS THE PAYLOAD
 * ARRIVED. `ReactFlowGraph.tsx` drops nodes whose id it has already seen — under
 * its own comment, "CEE may return duplicate node IDs" — so a payload carrying
 * one option twice put THREE in this sentence beside TWO on screen, and named
 * the repeated one twice. The user reads a count and a list that do not match
 * what they can see, in a sentence attributed to them.
 *
 * ⚠ WHY THE DEDUP IS SPELLED HERE RATHER THAN THE MOUNT'S RESULT BEING REUSED,
 * since a second copy of a filter is normally exactly the wrong move. The
 * mount's dedup runs DOWNSTREAM of this call: it consumes the ghost node this
 * composition produces, so its output does not exist yet at composition time.
 * The choice was a sentence composed from a set the canvas will not render, or
 * this. It is confined to prompt composition — `siblingsOf`, the mount's own
 * option filter and the empty-tier early return are untouched, and dedup cannot
 * turn a non-empty tier empty, so their agreement is preserved.
 *
 * ⚠ BY ID, NEVER BY LABEL. Two genuinely different options may share a name;
 * collapsing those would under-report the model, which is the same false
 * sentence pointing the other way. First occurrence wins, matching the mount.
 */
function contextFor(siblings: readonly Node[], subject: ModelSubject | null): GhostPromptContext {
  const seen = new Set<string>()
  const rendered = siblings.filter((n) => (seen.has(n.id) ? false : (seen.add(n.id), true)))
  return {
    namedSiblings: rendered.map(labelOf).filter((l): l is string => l !== null),
    siblingCount: rendered.length,
    subject,
  }
}

export function withGhostTiers(nodes: Node[], enabledTiers: readonly GhostTier[] = GHOST_TIERS): Node[] {
  const ghosts: Node[] = []
  const subject = readSubject(nodes)

  for (const tier of enabledTiers) {
    const siblings = siblingsOf(nodes, tier.siblingType)
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
        prompt: tier.prompt(contextFor(siblings, subject)),
        tier: tier.siblingType,
      },
      selectable: false,
      draggable: false,
      connectable: false,
    } as Node)
  }

  return ghosts.length > 0 ? [...nodes, ...ghosts] : nodes
}

/**
 * The option tier, resolved ONCE at module load and BY ID.
 *
 * Not `GHOST_TIERS[0]`: a positional bind would silently point the legacy door
 * at a different tier's sentence the first time the table is reordered, and the
 * failure would be a plausible-sounding prompt about the wrong kind of node
 * rather than a crash. Resolved eagerly so a table that lost its option tier
 * fails at import — loudly, in every suite — instead of on a user's click.
 */
const OPTION_TIER: GhostTier = (() => {
  const tier = GHOST_TIERS.find((t) => t.id === GHOST_OPTION_NODE_ID)
  if (!tier) {
    throw new Error(
      'ghostTiers: GHOST_TIERS carries no tier with the option door id, so the ' +
        'legacy ghost-option node has no sentence to send.',
    )
  }
  return tier
})()

/**
 * ⭐⭐ THE PRE-ANALYSIS OPTION DOOR'S SENTENCE — the one door `#1060` did not reach.
 *
 * ── WHY THIS FUNCTION EXISTS RATHER THAN THE DOOR SIMPLY USING `withGhostTiers` ──
 *
 * The option door on the pre-analysis canvas is NOT a `ghost-tier` node. It is
 * the older `ghost-option` node (`nodes/GhostOptionNode.tsx`), and
 * `ReactFlowGraph.tsx` builds it by hand because its position is derived from
 * the rightmost option, then filters the option tier OUT of the set it hands
 * `withGhostTiers`. So `GHOST_TIERS`' option prompt — the model-aware one, the
 * whole point of `#1060` — was composed for a node the canvas never built,
 * while the component sent a hardcoded "Suggest an additional option I haven't
 * considered for this decision": VERBATIM the sentence the `GhostTier.prompt`
 * doc above holds up as the bad example. The defect was named in this file and
 * still shipped, and its own spec was green about the unreached path.
 *
 * ⚠ THE OTHER REPAIR — routing this door through `withGhostTiers` and deleting
 * the legacy node — WAS DELIBERATELY NOT TAKEN. `GhostOptionNode` carries a
 * measured WCAG 1.4.11 outline (`--text-body` at 10.45:1 / 9.29:1 against both
 * adjacent grounds, verified in a live browser) and its own geometry, pinned by
 * `GhostOptionNode.contrast.spec.ts`. `GhostTierNode` is a different size, a
 * different label and a different icon scale. Swapping the component to fix a
 * STRING would have changed the affordance's appearance and re-opened a
 * contrast question that a lane already answered at the pixel — a larger,
 * less honest change wearing the smaller change's clothes.
 *
 * What the door needed was the sentence, so the sentence is what it gets. One
 * tier table, one composer, two renderers.
 *
 * ⚠ EMPTY WHEN THE TIER IS EMPTY, matching `withGhostTiers`' refusal to place a
 * door on a tier with no members: a sentence beginning "My model has 0 options"
 * would assert the tier OUGHT to have some, which is the judgement line this
 * file does not cross. The mount does not build the door in that case either —
 * it has nowhere to sit — so this is the two authorities agreeing rather than a
 * second one being invented.
 */
export function ghostOptionPrompt(nodes: Node[]): string {
  const siblings = siblingsOf(nodes, OPTION_TIER.siblingType)
  if (siblings.length === 0) return ''
  return OPTION_TIER.prompt(contextFor(siblings, readSubject(nodes)))
}
