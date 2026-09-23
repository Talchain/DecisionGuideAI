/**
 * The Outcome card's option-reach line, kept ONLY where it differentiates.
 *
 * Paul 23 Sep contract feedback point 8: *"Remove `3 alternatives connect here`
 * unless it genuinely differentiates anything. Use that space for actual
 * outcome state, evidence, uncertainty or nothing."*
 *
 * Measured across the five committed starters (`starters/data/*.draft.json`,
 * 23 Sep 2026): 10 outcomes, and 7 of them are reached by EVERY option on the
 * board (build-vs-buy 4/4 + 4/4, pricing-model 4/4 + 4/4, vendor-selection
 * 4/4 + 4/4, market-entry 3/3). On those cards "4 options connect to this"
 * told the reader nothing they could act on, so the card now says nothing.
 * The line survives only when SOME but not all options reach the outcome
 * (market-entry 1/3, headcount-allocation 3/4 + 3/4) — that is a real fact about
 * this outcome's place in the model.
 *
 * ⚠ The kept form names its denominator ("2 of 3 options"), on point 5's rule:
 * a count must say what it is out of. The total is every option node on the
 * board, the same population `countOptionsReaching` walks and `DecisionNode`'s
 * option count reads, so the two numbers cannot describe different sets.
 *
 * ⛔ Zero stays silent, for the reasons `optionsReachingLine` records (a counted
 * zero is a claim; the structural gap has its own owner). The verb stays
 * "connect" (MT-20): the count is structural, never a measured effect.
 */
import { countOptionsReaching } from '../../domain/optionsReaching'
import { resolveNodeTypeLiteral } from '../../domain/nodes'

interface NodeLike {
  id: string
  type?: string
  data?: unknown
}

interface EdgeLike {
  source: string
  target: string
}

export function outcomeOptionReachLine(
  nodes: ReadonlyArray<NodeLike>,
  edges: ReadonlyArray<EdgeLike>,
  outcomeId: string,
): string | null {
  let total = 0
  for (const node of nodes) if (resolveNodeTypeLiteral(node) === 'option') total += 1
  const reached = countOptionsReaching(nodes, edges, outcomeId)
  if (reached <= 0 || reached >= total) return null
  return reached === 1
    ? `1 of ${total} options connects to this`
    : `${reached} of ${total} options connect to this`
}
