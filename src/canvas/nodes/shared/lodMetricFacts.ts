/**
 * `resolveLodMetricFacts` — the facts an option's reduced line needs that do
 * NOT live on the node it is about.
 *
 * ⭐ WHY THIS IS ITS OWN MODULE AND NOT AN INLINE `useMemo` IN `BaseNode`.
 *
 * The gap this closes is the whole defect: an option's change count lives in
 * `ceeAnalysisReady`, and `resolveLodMetricLine` is handed a node's `data` and
 * its display metadata and can see none of it — which is why an option card
 * could only say anything once an analysis had run, and went blank on every
 * freshly drafted model.
 *
 * Written as a pure function so the corpus spec can drive the SAME derivation
 * the component drives. If this lived inside `BaseNode`'s memo, a test would
 * have to restate it, and a restated derivation that drifts from the real one
 * is a suite that agrees with itself while the product is broken
 * (CLAUDE.md trap 12).
 *
 * ⚠⚠ IT IS OPTION-ONLY, AND THAT IS THE SCOPE RATHER THAN AN OMISSION. This
 * module briefly also carried a risk/outcome bridge strength and a decision
 * option count. Both were deleted on 1 Sep 2026 when #1074 and #1085 shipped
 * those lines through the other mechanism — the owning component formats the
 * string and passes it as `BaseNode`'s `lodMetric` prop, where it WINS over
 * the resolver. The facts here would have fed arms the mount can never reach.
 *
 * ⛔ THE DELETED DECISION COUNT IS WORTH ONE SENTENCE, BECAUSE IT WAS WRONG AS
 * WELL AS DARK: it counted outgoing option EDGES with `.length` while
 * `DecisionNode.optionCount` de-duplicates targets with a `Set`, so two edges
 * to one option made the card say "2 options" and the low-zoom line say
 * "3 options" — one datum, two answers, one zoom step apart, with the
 * contradicting body hidden. The single owner is `DecisionNode`'s own
 * `optionCount`, and there is now no second implementation to disagree with it.
 *
 * ⚠ THE LIMIT, STATED (trap 20): this pins the DERIVATION, not the WIRING. That
 * `BaseNode` passes the right store values in — and that the resulting line
 * reaches a pixel — is only settled in a real browser. jsdom cannot prove
 * visibility (trap 3), and it is visibility that the user complained about.
 */
import { resolveOptionInterventionCount } from './optionInterventionCount'
import { detectBaseline } from '../../utils/baselineDetection'
import type { LodMetricFacts } from './lodMetricLine'

export interface LodMetricFactsInputs {
  nodeType: string
  nodeId: string
  /** The node's own `data` — the option-intervention fallback reads it. */
  data: Record<string, unknown> | undefined
  ceeOptions: { id: string; interventions?: Record<string, unknown> }[] | null | undefined
}

/**
 * ⚠ EVERY FIELD IS `null` FOR THE TYPES THAT DO NOT USE IT, AND THAT IS NOT
 * TIDINESS. `null` is the resolver's WITHHOLD signal, and it has to stay
 * distinguishable from a real zero: an option that changes no factors and an
 * option whose change count could not be established are different states, and
 * only one of them may say "No changes specified".
 */
export function resolveLodMetricFacts({
  nodeType,
  nodeId,
  data,
  ceeOptions,
}: LodMetricFactsInputs): LodMetricFacts {
  if (nodeType !== 'option') return { optionInterventionCount: null, optionIsBaseline: null }
  return {
    optionInterventionCount: resolveOptionInterventionCount(nodeId, {
      ceeOptions,
      nodeInterventions: data?.interventions,
    }),
    // ⛔ THE BASELINE FLAG IS NOT OPTIONAL POLISH — WITHOUT IT THE LINE
    // CONTRADICTS THE CARD. A status-quo option is BACKFILLED with
    // interventions (measured on the Headcount starter:
    // `interventionBackfilledCount: 4`, the baseline among them), so a raw
    // count says "Changes 2 factors" about the very card whose body reads
    // "No changes to factors". `OptionNode` checks this flag FIRST and never
    // reaches its count for a baseline; so does the reduced line.
    // `detectBaseline` is that component's own detector, not a second rule.
    optionIsBaseline:
      typeof data?.is_baseline === 'boolean'
        ? (data.is_baseline as boolean)
        : detectBaseline(String(data?.label ?? '')).isBaseline,
  }
}
