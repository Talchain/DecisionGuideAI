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
 * ⚠ AND THE GHOSTS ARE NOT THE MODEL. They are excluded from every count, from
 * inference and from persistence (they exist only in the render layer), so they
 * cannot inflate what the graph appears to contain.
 *
 * ⭐ S4 (Experience Design, #63 5806207128 / 5806266691, 24 Sep 2026): they are
 * back at the END of each family's row — "reasoning-frontier affordances, not
 * graph nodes/truth" — and they ARE in the camera fit and the row budget, so the
 * landing view shows them. `fitFrameNodes` (fitTargets) is the fit's list;
 * `excludeNonModelNodes` stays the count's.
 */

import type { Node } from '@xyflow/react'
// The prefix, the id and the predicate all live in `fitTargets`, which owns
// exclusion. Imported rather than restated: this file used to declare its own
// copies of the first two, so the filter and the ids it filtered were two
// independent lists that happened to agree.
import { CONSEQUENCE_PROMPT_ID, GHOST_ID_PREFIX, GHOST_OPTION_NODE_ID, isGhostNode } from './fitTargets'
// The producer's own word for "this node has no name". Imported, never
// re-spelled: the estate already carries eight hand-copied `'Untitled'`
// literals, and a ninth that drifted would silently re-open B2(a).
import { UNNAMED_ELEMENT_LABEL } from '../domain/elementLabel'
// The product's own words for the two node kinds a subject can come from.
// Imported, never re-typed: `DECISION_NODE_LABEL` changed on 31 Aug, and a
// sentence carrying a hand-copied 'Decision' would still be saying the retired
// word in the user's transcript today.
import { DECISION_NODE_LABEL, GOAL_NODE_LABEL } from '../domain/vocabulary'
import {
  LAYOUT_NODE_GAP,
  LAYOUT_PADDING_X,
  ROW_PROMPT_H,
  ROW_PROMPT_STACK_GAP,
  TIER_BY_KIND,
  restingCardWidthForKind,
  rowPromptKindsFor,
} from './nodeLayoutConstants'

export { GHOST_ID_PREFIX, GHOST_OPTION_NODE_ID, isGhostNode } from './fitTargets'

/** One frontier slot per tier the product models. */
export interface GhostTier {
  /** Node id — the `__ghost-` prefix is what every exclusion filter keys on. */
  id: string
  /** The node type whose row this sits at the end of. */
  siblingType: string
  /**
   * What the door SAYS on the canvas. A QUESTION, and the same question the
   * `prompt` below goes on to ask Olumi in longer form.
   *
   * ⭐⭐ THESE WERE CATEGORY NOUNS — "Another option", "Another factor",
   * "Another risk", "Another outcome" — AND THAT IS THE DEFECT THIS FIELD'S
   * DOC EXISTS TO STOP COMING BACK.
   *
   * The standing criticism of this canvas is that every element is a
   * CONCLUSION and nothing is a QUESTION. These four doors are the product's
   * answer to it: the only affordance on the board whose job is to generate
   * rather than to report. Labelled with the name of the tier they stand
   * beside, they generated nothing — they read as an empty slot in a form, so
   * the entire critical-and-creative-thinking half of the product rendered as
   * the word "Another".
   *
   * ⚠ THE RULE, and it is checkable: if the string can be read as the NAME OF
   * A CATEGORY, it is wrong. It must be answerable, in the user's own words,
   * without knowing what a node or an edge is.
   *
   * ⚠ AND IT STILL ASSERTS NOTHING (the line the whole file is built on). "What
   * else could go wrong?" claims no risk is missing; it is an open question
   * beside a row of risks that demonstrably exist, which is the only thing the
   * door's own placement already asserts. "Your risks are thin" would be a
   * claim about the user's reasoning and belongs to the producer.
   *
   * ⚠ IT IS ALSO THE ACCESSIBLE NAME. Both renderers put this string in
   * `aria-label`, so a screen-reader user hears the same question a sighted
   * user reads (WCAG 2.5.3 label-in-name). Reword it and both move together.
   */
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
    // Options answer the decision, so the facilitator's question for widening
    // the choice set is the plain one: what else could you do? Second person,
    // no model vocabulary, and "else" is warranted because this door is only
    // ever placed beside options that already exist.
    label: 'What else could you do?',
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
    // A factor is the product's own "causal variable that can be measured or
    // influenced" (`contextMenu/useMenuItems.ts`). "Drives" is that in
    // ordinary English. Deliberately NOT "what else moves this outcome?" —
    // `outcome` is a tier of its own here, and borrowing its name into the
    // factor door's question makes the sentence read as a cross-reference.
    label: 'What else drives this?',
    prompt: ({ namedSiblings, siblingCount, subject }) =>
      inventorySentence(namedSiblings, siblingCount, 'factor', 'factors') +
      `${about(subject)} What else could materially affect how this turns out?`,
  },
  {
    id: `${GHOST_ID_PREFIX}risk__`,
    siblingType: 'risk',
    // A risk is a "potential negative outcome". "What could go wrong" is the
    // ordinary-language form and the opening move of a pre-mortem, which is
    // the method this door is standing in for.
    label: 'What else could go wrong?',
    prompt: ({ namedSiblings, siblingCount, subject }) =>
      inventorySentence(namedSiblings, siblingCount, 'risk', 'risks') +
      `${about(subject)} What could go wrong that these do not already cover?` +
      ' Consider failure modes a forecast would miss.',
  },
  {
    id: `${GHOST_ID_PREFIX}outcome__`,
    siblingType: 'outcome',
    // An outcome is an "observable result". Asking where this LEADS asks for
    // the consequence rather than restating the noun — and the different
    // opener keeps the four doors from reading as one sentence repeated,
    // which is the failure mode the nouns had.
    label: 'Where else could this lead?',
    prompt: ({ namedSiblings, siblingCount, subject }) =>
      inventorySentence(namedSiblings, siblingCount, 'outcome', 'outcomes') +
      `${about(subject)} What further consequences could follow that these do not represent?`,
  },
] as const

/**
 * ⭐ THE CONSEQUENCE ROW'S ONE DOOR (ED 5810951997: row-end prompts appear ONCE
 * per row). Outcomes and risks share a row (`TIER_BY_KIND`), and each used to
 * bring its own door, stacked in one band. When both are present the row gets
 * this single door instead: a question about what follows, good or bad, that
 * keeps the pre-mortem half ("what could go wrong") in the prompt it sends. A
 * row holding only one of the two keeps that kind's own door unchanged.
 */
export const CONSEQUENCE_DOOR_ID = CONSEQUENCE_PROMPT_ID
export const CONSEQUENCE_DOOR_LABEL = 'What else could follow?'
const CONSEQUENCE_KINDS: ReadonlySet<string> = new Set(['outcome', 'risk'])
const CONSEQUENCE_NOUNS: Readonly<Record<string, readonly [string, string]>> = {
  outcome: ['outcome', 'outcomes'],
  risk: ['risk', 'risks'],
}

function consequenceDoorPrompt(
  byKind: ReadonlyArray<{ kind: string; siblings: readonly Node[] }>,
  subject: ModelSubject | null,
): string {
  const inventory = byKind
    .map(({ kind, siblings }) => {
      const ctx = contextFor(siblings, subject)
      const [one, many] = CONSEQUENCE_NOUNS[kind] ?? [kind, `${kind}s`]
      return inventorySentence(ctx.namedSiblings, ctx.siblingCount, one, many)
    })
    .join(' ')
  return (
    inventory +
    `${about(subject)} What else could follow from this, good or bad, that these do not already cover?` +
    ' Consider what could go wrong that a forecast would miss.'
  )
}

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

/**
 * The tiers whose question may be drawn ON a card: every tier except options.
 *
 * ⭐ ONE ENTRY POINT PER QUESTION (contract v3.1 pt 6; gap U9, 24 Sep). The
 * option question already has its door — `__ghost-option__`, which stands
 * beside the Options row — so a card copy of it put the same question on screen
 * twice (Paul's screenshot B, served `24e06704`). Resolved by id, like
 * `OPTION_TIER` below, so a reorder of `GHOST_TIERS` cannot drop the wrong tier.
 */
/*
 * ⛔ S4: NO LONGER MOUNTED. `BaseNode` stopped rendering the in-card row when the
 * row-end prompts returned (ED #63 5806207128: "Do not also restore in-card
 * prompt links"). This list, `tierInvitations` and `nodes/shared/TierInvitation.tsx`
 * are kept only until the lane that owns that component deletes the three
 * together; nothing on the canvas reads them.
 */
export const CARD_INVITATION_TIERS: readonly GhostTier[] = GHOST_TIERS.filter(
  (t) => t.id !== GHOST_OPTION_NODE_ID,
)

/**
 * ⭐⭐ THE INVITATION MOVES ONTO THE CARD, BECAUSE THERE IS NOWHERE ELSE TO PUT IT.
 *
 * ## Measured, 15 Sep 2026, on all five starters
 *
 * A tier door is **187 × 121** graph units. At the ruled camera floor (0.50) the
 * framed window is 2160 × ~2000 graph units, and the clear space beside the
 * model is:
 *
 *   - to the RIGHT — best case **128 units**, for a 187-unit card;
 *   - BELOW — a below-placement would need a canvas pane of **1065–1266px**,
 *     and the whole browser window is **1012px**.
 *
 * Three of the five starters are 3080 units wide against a 2160 window, so their
 * REAL nodes are off-screen too — that is the camera floor, already ruled on,
 * and no placement changes it. **14 of 20 doors were outside the frame.**
 *
 * ⇒ There is no position in graph space for this affordance. Repositioning was
 * the obvious refinement and it is arithmetically impossible, so the anchor
 * changes instead of the offset: the invitation is rendered ON the card it used
 * to stand beside.
 *
 * ⚠ THE OPTION DOOR IS DELIBERATELY UNTOUCHED. `__ghost-option__` measured
 * INSIDE the frame on 5 of 5 starters, so it is not part of this defect, and
 * `GhostOptionNode` carries a WCAG 1.4.11 outline verified at the pixel. Moving
 * a door that is not broken, to fix doors that are, would re-open a contrast
 * question a lane already answered.
 *
 * ⚠ SAME ANCHOR RULE, SPELLED ONCE. This shares {@link rowAnchorFor} with the
 * graph-space placement it replaces — the card that receives the invitation is
 * exactly the card the door used to stand beside. Two derivations of "which card
 * ends this row" is how the door's sentence and the door's position came to
 * describe different sets of nodes once already.
 */
export interface TierInvitation {
  /** The card that ends this tier's row — where the invitation renders. */
  readonly anchorNodeId: string
  /** The question, verbatim from `GHOST_TIERS`. Also the accessible name. */
  readonly label: string
  /** What clicking asks Olumi. Composed from the model, never sent for the user. */
  readonly prompt: string
  /** Which tier this invites into. */
  readonly tier: string
}

/**
 * Every tier's invitation, keyed by the card that carries it.
 *
 * ⚠ A CARD CAN END ONLY ONE ROW, but two tiers can share a row (risks joined the
 * outcome tier, 14 Sep). The map is keyed by node id, so the second tier to
 * resolve the same anchor would overwrite the first — it is therefore keyed to a
 * LIST, and the card renders both. Dropping one silently is the filtering defect
 * this file's own `contextFor` doc was written about.
 */
export function tierInvitations(
  nodes: Node[],
  // contract v3.1 pt 6: the option tier's one entry point is the ghost card.
  enabledTiers: readonly GhostTier[] = CARD_INVITATION_TIERS,
): ReadonlyMap<string, readonly TierInvitation[]> {
  const out = new Map<string, TierInvitation[]>()
  const subject = readSubject(nodes)
  for (const tier of enabledTiers) {
    const siblings = siblingsOf(nodes, tier.siblingType)
    // Same refusal as the graph-space door: no members, no invitation. A door on
    // an empty tier asserts the tier OUGHT to have members, which is a judgement.
    if (siblings.length === 0) continue
    const anchor = rowAnchorFor(nodes, [], siblings)
    if (!anchor) continue
    const entry: TierInvitation = {
      anchorNodeId: anchor.id,
      label: tier.label,
      prompt: tier.prompt(contextFor(siblings, subject)),
      tier: tier.siblingType,
    }
    const existing = out.get(anchor.id)
    if (existing) existing.push(entry)
    else out.set(anchor.id, [entry])
  }
  return out
}

/** A node's kind, by the producer's spellings — `type`, then `data.type`. */
function kindOf(n: Node): string | undefined {
  if (typeof n.type === 'string' && n.type.length > 0) return n.type
  const d = n.data as { type?: unknown; kind?: unknown } | undefined
  if (typeof d?.type === 'string') return d.type
  return typeof d?.kind === 'string' ? d.kind : undefined
}

/** The layout row a node sits in — `layout.ts`'s rule: unknown kinds join tier 2. */
function layoutTierOf(n: Node): number {
  const kind = kindOf(n)
  return kind !== undefined && TIER_BY_KIND[kind] !== undefined ? TIER_BY_KIND[kind] : 2
}

/** Same-row tolerance, in flow units — `layout.ts`'s `groupByYRow` default. */
const ROW_Y_TOLERANCE = 10

/**
 * The rendered width a prompt must clear: the measurement when there is one,
 * else the width the layout gives this kind at rest. Never a guessed constant —
 * a 200 fallback here once put a door inside the card it stood beside.
 */
function defaultWidthOf(n: Node): number {
  const m = n as { measured?: { width?: number }; width?: number }
  return m.measured?.width ?? m.width ?? restingCardWidthForKind(kindOf(n))
}

/**
 * ⭐ THE CARD THAT ENDS A FAMILY'S FINAL SUB-ROW — the one anchor both
 * affordances read, so they cannot pick different cards.
 *
 * The family is the LAYOUT tier (a row is a tier: outcomes and risks share
 * one), its final sub-row is the lowest, and the anchor is the occupant whose
 * RIGHT EDGE is furthest right, whatever its kind. That is why a risk prompt can
 * never be painted over an outcome card again (measured on `pricing-model`
 * before 15 Sep: `__ghost-risk__` 2px from `out_nrr`, wholly inside it).
 */
function finalRowAnchor(
  model: readonly Node[],
  tier: number,
  widthOf: (n: Node) => number,
): { anchor: Node; rowY: number } | undefined {
  const members = model.filter((n) => layoutTierOf(n) === tier)
  if (members.length === 0) return undefined
  const rowY = members.reduce<number>((acc, n) => Math.max(acc, n.position?.y ?? 0), Number.NEGATIVE_INFINITY)
  const occupants = members.filter((n) => Math.abs((n.position?.y ?? 0) - rowY) <= ROW_Y_TOLERANCE)
  let anchor = occupants[0]
  for (const n of occupants) {
    if ((n.position?.x ?? 0) + widthOf(n) > (anchor.position?.x ?? 0) + widthOf(anchor)) anchor = n
  }
  return { anchor, rowY }
}

/**
 * The legacy in-card invitation's anchor, kept on the one rule above.
 * (`tierInvitations` is no longer mounted — S4 restored the row-end prompts and
 * ED ruled one entry point per question — but while it exists it must not
 * resolve "which card ends this row" a second way.)
 */
function rowAnchorFor(nodes: Node[], _ghosts: Node[], siblings: Node[]): Node | undefined {
  if (siblings.length === 0) return undefined
  const model = nodes.filter((n) => !isGhostNode(n.id))
  return finalRowAnchor(model, layoutTierOf(siblings[0]), defaultWidthOf)?.anchor
}

export interface RowEndPromptOptions {
  /**
   * The rendered width of a card. The mount passes the measurement, then the
   * layout's published per-kind width; the default does the same without the
   * layout store, so this module stays free of store imports.
   */
  readonly widthOf?: (node: Node) => number
}

/**
 * ⭐⭐ THE ROW-END REASONING PROMPTS (Experience Design S4, #63 5806207128 /
 * 5806266691; Paul, 24 Sep: "bring back the per-row prompts").
 *
 * One prompt at the END of each family's FINAL sub-row — never one per wrapped
 * sub-row:
 *   · Options  → "What else could you do?"   (`ghost-option`, the existing card)
 *   · Factors  → "What else drives this?"
 *   · Outcomes → "Where else could this lead?"
 *   · Risks    → "What else could go wrong?"
 * Outcomes and risks share one row, so they share ONE 160-unit frontier column,
 * outcome above risk — "rather than spending another 160px horizontally".
 *
 * ⭐ WHERE, EXACTLY: one card-gap after the anchor's right edge
 * (`LAYOUT_PADDING_X + LAYOUT_NODE_GAP`, the gap between two cards), top-aligned
 * with the row. That is the slot `layoutGraph` reserved inside the row budget,
 * so on a laid-out board the prompt lands in space the board already paid for.
 *
 * ⛔ NOT GRAPH NODES. Rendered only (never written to the store, so never saved
 * or sent), excluded from every count by the shared `__ghost-` prefix, carry no
 * edges, and are neither selectable, draggable nor connectable. A tier with no
 * members gets no prompt — a door on an empty tier would assert the tier OUGHT
 * to have members, which is a judgement this affordance exists not to make.
 *
 * ⚠ HISTORY, KEPT BECAUSE IT IS THE REASON THIS IS SAFE NOW: on 15 Sep these
 * doors moved onto the cards because at the 0.5 camera floor 14 of 20 fell
 * outside the frame. S4 fixes the frame (narrower cards, five-card rows, the
 * prompt slot inside the row budget, the fit including the prompts), which is
 * what licenses bringing them back — one problem, not two (NODE-ANATOMY-v32 L3).
 */
export function withGhostTiers(
  nodes: Node[],
  enabledTiers: readonly GhostTier[] = GHOST_TIERS,
  options: RowEndPromptOptions = {},
): Node[] {
  const model = nodes.filter((n) => !isGhostNode(n.id))
  const widthOf = options.widthOf ?? defaultWidthOf
  const subject = readSubject(model)

  // Which enabled prompts have members, grouped by the layout row they end.
  const presentByTier = new Map<number, Set<string>>()
  const tierByKind = new Map<string, GhostTier>()
  for (const tier of enabledTiers) {
    if (siblingsOf(model, tier.siblingType).length === 0) continue
    tierByKind.set(tier.siblingType, tier)
    const row = TIER_BY_KIND[tier.siblingType] ?? 2
    const set = presentByTier.get(row)
    if (set) set.add(tier.siblingType)
    else presentByTier.set(row, new Set([tier.siblingType]))
  }

  const ghosts: Node[] = []
  for (const [row, present] of [...presentByTier.entries()].sort((a, b) => a[0] - b[0])) {
    const placed = finalRowAnchor(model, row, widthOf)
    if (!placed) continue
    const { anchor, rowY } = placed
    const x = (anchor.position?.x ?? 0) + widthOf(anchor) + LAYOUT_PADDING_X + LAYOUT_NODE_GAP
    // Stack order is the layout's (`ROW_PROMPT_KINDS_BY_TIER`) — the layout
    // reserved exactly this column's height, so the two cannot disagree.
    const stack = rowPromptKindsFor(row, present)
    // A kind outside the table still gets a door, after the table's own.
    for (const kind of present) if (!stack.includes(kind)) stack.push(kind)
    // ⭐ ONE PROMPT PER ROW (ED 5810951997; contract v3.1 WS1 #27). A row whose
    // family is one kind keeps that kind's own door; the consequence row, when
    // it holds outcomes AND risks, gets ONE door that asks about both — never
    // two doors stacked in one band.
    if (stack.length > 1 && stack.every((k) => CONSEQUENCE_KINDS.has(k))) {
      const byKind = stack.map((k) => ({ kind: k, siblings: siblingsOf(model, k) }))
      ghosts.push({
        id: CONSEQUENCE_DOOR_ID,
        type: 'ghost-tier',
        position: { x, y: rowY },
        data: {
          label: CONSEQUENCE_DOOR_LABEL,
          prompt: consequenceDoorPrompt(byKind, subject),
          tier: 'consequence',
        },
        selectable: false,
        draggable: false,
        connectable: false,
      } as Node)
      continue
    }
    stack.forEach((kind, i) => {
      const tier = tierByKind.get(kind)!
      const siblings = siblingsOf(model, kind)
      ghosts.push({
        id: tier.id,
        type: tier.id === GHOST_OPTION_NODE_ID ? 'ghost-option' : 'ghost-tier',
        position: { x, y: rowY + i * (ROW_PROMPT_H + ROW_PROMPT_STACK_GAP) },
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
    })
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
 * ⭐ THE PRE-ANALYSIS OPTION DOOR'S VISIBLE QUESTION — same owner as its sentence.
 *
 * `GhostOptionNode` is a different renderer (see the block below for why it was
 * deliberately not folded into `GhostTierNode`), and it used to spell its own
 * copy: "+ Explore another option", with an `aria-label` of "Add another
 * option" that did not match it. Two hand-kept strings for one idea, in a
 * component whose sentence had ALREADY been moved here for exactly that reason
 * — so the door's question and the door's prompt could be reworded apart, and
 * the estate's dominant defect (CLAUDE.md trap 12) had a home.
 *
 * It reads this instead. One tier table, one composer, one label, two
 * renderers — and the visible text and the accessible name are now the same
 * string by construction rather than by agreement.
 */
export const GHOST_OPTION_DOOR_LABEL: string = OPTION_TIER.label

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
