/**
 * ⭐⭐ ONE READINESS AUTHORITY FOR THE CARDS THAT OFFER "Run analysis".
 *
 * Extracted from `DecisionNode.tsx`, where it was a private function, because a
 * SECOND card was offering the same primary action on a DIFFERENT predicate and
 * neither knew the other existed.
 *
 * MEASURED on a real render of the `pricing-model` starter at 1600x1000
 * (`e2e/geometry/cardAnatomy.measure.ts`): the decision card and the goal card
 * both carry a "Run analysis" chip, with the same label and the same message.
 * Their gates were not the same:
 *
 *     decision   allFactorsPresent && goalDefined     <- readiness
 *     goal       hasThreshold && !isPostAnalysis      <- a target exists
 *
 * So on a model with a goal target and a factor still missing its value, the
 * decision card correctly WITHHOLDS the action and says what the gap is, while
 * the goal card offers it anyway. Two surfaces, one question, opposite answers
 * — and the one that says yes is the one that is wrong.
 *
 * ⭐ THIS IS CLAUDE.md TRAP 21 AND ITS PRESCRIBED FIX. Where two authorities
 * answer the SAME question, the repair is one authority with two consumers —
 * never two predicates kept in step by hand. (Where they answer DIFFERENT
 * questions the repair is the opposite: name them apart. Checked, and they do
 * not: both gate the identical `actionType="run_analysis"` chip.)
 *
 * ⚠ THE `decisionId` PARAMETER WAS DEAD and is dropped here rather than
 * carried. It appeared exactly twice in the original — the signature and the
 * dependency array — and never in the body. Readiness is a property of the
 * WHOLE GRAPH, which is precisely why a card with no decision id can and should
 * read it. A parameter nothing reads is a claim about scope that the code does
 * not make.
 *
 * ⛔ IT IS A STRUCTURAL COUNT AND CARRIES NO ANALYSIS PERMISSION. Every input is
 * a property of the graph — how many factors exist and how each one's value got
 * there. It is not a verdict from any service, and callers must not present it
 * as one.
 */
import { useMemo } from 'react'
import { useCanvasStore } from '../store'
import { biasSignal } from '../shared/biasSignalTitles'

export interface ModelReadiness {
  // breakdown consumed by the pre-analysis popover, the triage line and the
  // card's own readiness summary
  explicitCount: number
  inferredCount: number
  missingCount: number
  externalCount: number
  biasTriggers: string[]
}

export function useModelReadiness(): ModelReadiness {
  const nodes = useCanvasStore(s => s.nodes)
  const edges = useCanvasStore(s => s.edges)

  return useMemo(() => {
    const factorNodes = nodes.filter(n => n.type === 'factor' || n.data?.type === 'factor')
    const optionNodes = nodes.filter(n => n.type === 'option' || n.data?.type === 'option')
    const riskNodes = nodes.filter(n => n.type === 'risk' || n.data?.type === 'risk')

    let explicitCount = 0
    let inferredCount = 0
    let missingCount = 0
    let externalCount = 0

    for (const node of factorNodes) {
      const data = node.data as Record<string, unknown> | undefined
      if (!data) continue
      const category = data.category as string | undefined
      const observedState = data.observedState as Record<string, unknown> | undefined
      const prior = data.prior as { range_min?: number; range_max?: number } | undefined
      const value = observedState?.value as number | undefined
      const extractionType = observedState?.extractionType as string | undefined

      if (category === 'external') {
        externalCount++
        continue
      }

      if (value == null && !(prior?.range_min != null && prior?.range_max != null)) {
        missingCount++
      } else if (extractionType === 'inferred') {
        inferredCount++
      } else {
        explicitCount++
      }
    }

    // Bias triggers - bias NAMES composed from the one registry
    // (review-folds C15; rendered output byte-identical to the old
    // literals). 'Missing risks' is a graph-signal label, not a registry
    // bias code, so it stays local.
    const biasTriggers: string[] = []
    if (optionNodes.length < 3) biasTriggers.push(`${biasSignal('narrow_framing').title}: < 3 options`)
    if (riskNodes.length <= 1) biasTriggers.push('Missing risks: \u2264 1 risk identified')
    const hasBaseline = optionNodes.some(n => (n.data as Record<string, unknown> | undefined)?.is_baseline === true)
    if (hasBaseline) biasTriggers.push(`${biasSignal('status_quo_bias').title}: baseline present`)
    // Overconfidence: any factor is inferred (unvalidated estimate)
    //
    // ⛔ THE SENTENCE USED TO SAY "top factor unvalidated" ON THE STRENGTH OF THIS
    // `.some()`. The comment above has always said "any factor", and the predicate
    // has always agreed with the comment — only the user-facing string disagreed,
    // so where the most influential factor was explicit and a minor one inferred,
    // the anchor card said something false. It is shipped copy, not a latent
    // string: DecisionNode.tsx maps `biasTriggers` to visible rows.
    //
    // ⚠ THE PREDICATE IS DELIBERATELY UNCHANGED. `inferredCount` is the obvious
    // substitute and is a DIFFERENT POPULATION — the loop above buckets a
    // value-less factor as `missing` before it ever reads `extractionType`, and
    // skips `category === 'external'` outright. Swapping it in would change WHICH
    // graphs raise the signal while appearing to fix a wording problem. The spec
    // pins that difference so a later tidy-up cannot make the substitution quietly.
    const hasInferredFactor = factorNodes.some(n => {
      const os = (n.data as Record<string, unknown> | undefined)?.observedState as Record<string, unknown> | undefined
      return os?.extractionType === 'inferred'
    })
    if (hasInferredFactor) biasTriggers.push(`${biasSignal('overconfidence').title}: a factor is an unvalidated estimate`)

    return {
      explicitCount,
      inferredCount,
      missingCount,
      externalCount,
      biasTriggers,
    }
  }, [nodes, edges])
}
