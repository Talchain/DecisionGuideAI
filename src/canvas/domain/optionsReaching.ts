/**
 * ⭐⭐ HOW MANY OF THE OPTIONS ON THE BOARD ACT ON THIS CARD.
 *
 * *"Three of your options move this"* is the one useful thing an outcome card
 * can say with today's data, and it needs no producer change at all: the answer
 * is already in the graph the user is looking at.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⛔ REACHABILITY, NOT INBOUND EDGES — AND THAT IS A MEASUREMENT, NOT A
 * PREFERENCE
 * ─────────────────────────────────────────────────────────────────────────────
 * The obvious implementation counts inbound edges whose source is an option.
 * It would ship DARK. The edge grammar of every model this product has produced
 * has SIX kind-pairs and `option → outcome` is not one of them — measured
 * across all five committed starters (87 nodes, 163 edges) and recorded
 * independently at `utils/nodeLayoutConstants.ts`:
 *
 *     decision→option 19 · option→factor 58 · factor→risk 33
 *     factor→outcome 29 · risk→goal 14 · outcome→goal 10
 *
 * An option acts on an outcome THROUGH FACTORS, always. So the question is
 * "does a directed path run from this option to this card?", and the walk is
 * upstream from the card rather than downstream from each option — one
 * traversal instead of N, and the answer lands in a Set, which is what makes
 * the de-duplication structural rather than a rule someone has to remember.
 *
 * ⚠ THE SAME WALK EXISTS ONCE MORE IN THE TREE, DELIBERATELY NOT COLLAPSED
 * HERE. `computeStructuralAbsence.forwardReachable` is this algorithm in the
 * other direction, inside the pre-analysis panel's selector. Folding the two
 * together is right and is NOT this change: that file is the subject of live
 * work (the `STRUCTURAL_UNSET` vocabulary is not in this tree yet), and a lane
 * that rewrites another lane's file to save twelve lines buys a merge conflict
 * with a guard attached. When it next changes, this module is the place.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⭐ ONE PREDICATE FOR "IS THIS AN OPTION", AND IT IS THE DOMAIN'S OWN
 * ─────────────────────────────────────────────────────────────────────────────
 * `resolveNodeTypeLiteral` (`domain/nodes.ts`) is declared there as THE fallback
 * chain — `node.type ?? data.kind ?? data.type` — precisely so every surface
 * gets the same answer. There are two live spellings in the tree and this is the
 * wider one: `graphFacts.kindOf` reads `data.kind ?? node.type` and is blind to
 * `data.type`, which is the spelling every canvas fixture and `DecisionNode`'s
 * own option predicate (`DecisionNode.tsx:338`) actually carries. Using the
 * declared chain rather than typing a fourth `=== 'option'` is the whole of
 * requirement "derive the kind, do not pattern-match an id".
 *
 * ⚠ THE BASELINE OPTION IS COUNTED, AND THAT IS A DECISION WITH A REASON.
 * Every starter carries exactly one `is_baseline: true` option and every one of
 * them is wired into factors (3–6 outgoing edges each, measured), so excluding
 * it would change the number. It is not excluded, because the decision card
 * says *"My model has N options so far"* over ALL option nodes
 * (`DecisionNode.tsx:333-342`): a reader comparing `4 options` there with
 * `3 options move this` here would correctly infer that one option misses this
 * outcome. Dropping the status quo silently would make that inference false —
 * two counts of "options" under one word, disagreeing for a reason nothing on
 * screen discloses (CLAUDE.md trap 21). `computeOptionDifferentiation` DOES
 * exclude it, and is right to: it compares stated VALUES, where a do-nothing
 * arm is meant to differ. This counts causal REACH, where it does not.
 *
 * ⚠ WHAT THE SENTENCE CLAIMS, STATED NARROWLY. It reports the paths the MODEL
 * DRAWS — the user's and the drafter's own structure — never a measured effect.
 * No strength is read, so an option whose every edge strength is unset still
 * counts: the claim is "your model says this option acts on this", which is
 * true of an unvalued edge. Nothing here needs analysis to have run, which is
 * why the card can say it before the first run.
 */
import { resolveOptionInterventionCount } from '../nodes/shared/optionInterventionCount'
import { resolveNodeTypeLiteral } from './nodes'

interface NodeLike {
  id: string
  type?: string
  data?: unknown
}

interface EdgeLike {
  source: string
  target: string
}

/**
 * Distinct option nodes with a directed path to `targetId`.
 *
 * De-duplicated by the option itself: an option reaching the target down two
 * paths — or down two parallel edges, which `applyPatch` can create without
 * passing the store's duplicate check — is ONE option, the same rule
 * `DecisionNode`'s `optionCount` applies to its own tally.
 */
export function countOptionsReaching(
  nodes: ReadonlyArray<NodeLike>,
  edges: ReadonlyArray<EdgeLike>,
  targetId: string,
): number {
  const optionIds = new Set<string>()
  const nodeById = new Map<string, NodeLike>()
  for (const node of nodes) {
    nodeById.set(node.id, node)
    if (resolveNodeTypeLiteral(node) === 'option') optionIds.add(node.id)
  }
  if (optionIds.size === 0) return 0

  /** Who feeds whom — the graph read backwards, built once. */
  const feeders = new Map<string, string[]>()
  for (const edge of edges) {
    const list = feeders.get(edge.target)
    if (list) list.push(edge.source)
    else feeders.set(edge.target, [edge.source])
  }

  // Ancestors of the card. `seen` also terminates the walk on a cycle: the
  // product forbids them end to end, but a traversal that relies on that
  // promise rather than on its own bookkeeping is a hang waiting for the day
  // the promise breaks.
  const ancestors = new Set<string>()
  const stack = [targetId]
  while (stack.length > 0) {
    const current = stack.pop()!
    for (const feeder of feeders.get(current) ?? []) {
      if (ancestors.has(feeder)) continue
      ancestors.add(feeder)
      stack.push(feeder)
    }
  }

  /**
   * ⛔⛔ AN OPTION THAT CARRIES NO EFFECT VALUE MOVES NOTHING, AND COUNTING IT
   * PUT TWO CONTRADICTORY SENTENCES ON ONE BOARD.
   *
   * Measured on the founder's own staging run, 19 Sep: the outcome card read
   * "4 options move this" while an option card three inches away read
   * "Not in this analysis" — because reachability alone counted an option whose
   * `interventions` map is EMPTY. At the bytes that option had `interventions:
   * {}`, `interventionKeys: []`, and four option→factor edges byte-identical to
   * the options that WERE analysed, so nothing in the graph SHAPE distinguished
   * it. Reachability is structural and the claim is causal; they are not the
   * same question.
   *
   * ⚠ THIS IS NOT RE-DERIVING CEE'S ADMISSION DECISION, and the distinction is
   * the one this estate keeps paying for. "Not connected", "no values set" and
   * "excluded from this calculation" are THREE different facts and CEE owns the
   * third — the canvas must never compute it. What is read here is the FIRST
   * fact about the node itself: does this option carry any effect value at all.
   * An option can be excluded while carrying values, and can carry none while
   * still being admitted; this counts the ones that can move the card's own
   * outcome, and says nothing about admission.
   *
   * ⚠ DERIVED THROUGH THE SHARED OWNER, not a fourth spelling. The cee-then-node
   * precedence lives in `resolveOptionInterventionCount`, which the option card
   * and its reduced line already consume — a private copy here is how two
   * surfaces come to disagree about how many changes one option makes.
   */
  let reaching = 0
  for (const id of ancestors) {
    if (!optionIds.has(id)) continue
    const node = nodeById.get(id)
    const count = resolveOptionInterventionCount(id, {
      ceeOptions: null,
      nodeInterventions: (node?.data as { interventions?: unknown } | undefined)?.interventions,
    })
    if (count > 0) reaching += 1
  }
  return reaching
}

/**
 * The card's sentence, or `null` for "say nothing".
 *
 * ⛔⛔ ZERO RENDERS NOTHING, AND IT IS NOT A NEAR-MISS OF AN INVITATION.
 *
 * `0 options move this` is out of the question — a counted zero is a claim, and
 * this card must not make one. The live question was whether zero should carry
 * an invitation instead (*"No option moves this yet"*). It does not, on three
 * grounds:
 *
 *  1. AN INVITATION CARRIES NO CARD-SCOPED NUMBER, so it is byte-identical on
 *     every card that shows it — which is exactly the copy class Paul ruled
 *     against (*"saying the same copy on every node is a waste of space"*) and
 *     which `cardCopyCensus.canvas.spec.tsx` exists to force into the open. The
 *     counted sentence earns its place because the quantity is scoped to the
 *     card it sits on; the zero sentence would not.
 *  2. ZERO HAS TWO CAUSES AND THE CARD CANNOT USEFULLY TELL THEM APART at a
 *     glance: a model with no options at all (a sketch mid-draft, the common
 *     one) and a model whose options all miss this outcome. Advice about an
 *     unwired model belongs to the surface that already owns it —
 *     `computeStructuralAbsence` refuses to critique exactly this state
 *     (`everyOptionActs`), and `sig_option_breadth` speaks for it.
 *  3. IT WOULD BE BUILT FOR A STATE NO MEASURED MODEL REACHES. Across the five
 *     committed starters, 10 of 10 outcomes are reached by at least one option.
 *
 * `FactorNode` already answers the mirror question the same way: its
 * *"Linked to N outcomes."* line is gated `outcomesAffected > 0` and is silent
 * otherwise (`FactorNode.tsx:612`). One rule, both directions.
 *
 * ⚠ AND THE SINGULAR IS NOT COSMETIC. *"1 options move this"* on the one card a
 * reader has stopped to study is the difference between a product that was
 * finished and one that was not.
 */
export function optionsReachingLine(count: number): string | null {
  if (count <= 0) return null
  if (count === 1) return '1 option moves this'
  return `${count} options move this`
}
