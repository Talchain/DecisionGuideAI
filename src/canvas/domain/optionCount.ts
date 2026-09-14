/**
 * `countOptionNodes` — the option count, derived with the SAME predicate the
 * live `sig_option_breadth` gate uses.
 *
 * It lives in its own module for two reasons. It is deliberately `kindOf` from
 * `graphFacts` rather than a second local rule: the harvested count and
 * `input.optionCount` are COMPARED AGAINST EACH OTHER, so two spellings of "is
 * this an option" would make that comparison a coin toss that looks like a gate.
 * And it is NOT in `domain/effectiveDraftCoaching.ts`, because the store needs
 * this helper and only the live-gated consumer may import that module — a guard
 * in `store/__tests__/retainedDraftCoachingLifecycle.spec.ts` asserts exactly
 * that importer set, and it is telling the truth.
 */
import type { Node } from '@xyflow/react'
import { kindOf } from '../components/pre-analysis-v3/selectors/graphFacts'

export function countOptionNodes(nodes: ReadonlyArray<Node>): number {
  let count = 0
  for (const node of nodes) if (kindOf(node) === 'option') count += 1
  return count
}
