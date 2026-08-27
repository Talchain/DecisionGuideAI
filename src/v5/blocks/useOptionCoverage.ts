import { useMemo } from 'react'
import { useCanvasStore } from '../../canvas/store'
import { resolveNodeTypeLiteral } from '../../canvas/domain/nodes'
import {
  deriveOptionCoverage,
  type CoverageOption,
  type CoverageReading,
} from '../../components/results/utils/optionCoverage'

/**
 * How much of the model each option actually specifies — ROADMAP 2.1326.
 *
 * Subscribes to `nodes` and `ceeAnalysisReady` only, and derives inside a
 * `useMemo` off those two references — the pattern `useCanvasNodeLabels` uses
 * next door, for the same reason: selecting a freshly-built array or object out
 * of the store hands zustand a new reference every render.
 *
 * THE DENOMINATOR COMES FROM THE GRAPH, AND THAT IS THE POINT.
 * `deriveOptionCoverage` refuses to invent one. The factors are the canvas's own
 * factor nodes, resolved through `resolveNodeTypeLiteral` — the existing owner of
 * "what type is this node", not a second predicate beside it. Deriving the
 * denominator from the union of factors the options happen to address would
 * silently HIDE a factor that NO option addresses, and in the run this was built
 * from ("CRM Adoption and Usability") that is exactly the case that matters.
 *
 * ⚠ `option.id` IS THE RIGHT FIELD, AND IT WAS CHECKED RATHER THAN ASSUMED.
 * The wire sends `option_id`; the store holds `id`. `normaliseV5AnalysisReady`
 * (`applyV5State.ts:238-245`) maps one to the other, preferring a non-empty
 * `opt.id` and falling back to `opt.option_id`. So the slice's own `id` is
 * populated for wire payloads. This matters because the estate has a live
 * defect of exactly the opposite shape — a type declaring `reason` while the
 * wire sends `message`, unnoticed because its only consumers are dark
 * (ROADMAP 2.1317) — and `usePreRunValidation`, which also reads `o.id` here,
 * IS one of those dark consumers. Its usage is therefore evidence about the
 * TYPE, never about the runtime value; the normaliser is.
 */
/**
 * ⚠ GATED ON THE RUN THIS BLOCK REPORTS, and that gate is what makes it
 * legitimate to render live state inside a historic record at all.
 *
 * Coverage is derived from LIVE store state, and an analysis-result block is a
 * TRANSCRIPT ENTRY. Ungated, every past block showed TODAY's coverage — a block
 * reporting one run would describe a different graph — and the strip vanished
 * silently whenever `invalidateAnalysisReady` fired, reachable from ~22 edit
 * paths. A strip whose entire job is "what was this analysis based on?" must not
 * answer with today's state.
 *
 * So it speaks only when the block's own `computed_against_hash` matches the
 * graph the live slice describes, and otherwise says nothing.
 *
 * ⚠ THE LIMIT, STATED: saying nothing on a historic block is NOT the
 * honest-at-zero disclosure this module makes elsewhere — it is this surface
 * having nothing it can honestly say. Staleness already has an owner, and a
 * second authority on "the model has changed since this ran" is exactly what
 * this module refuses to become. Rowed, not answered here.
 */
export function useOptionCoverage(computedAgainstHash?: string): CoverageReading | null {
  const nodes = useCanvasStore(
    (s: { nodes?: Array<{ id: string; type?: string; data?: unknown }> }) => s.nodes,
  )
  const analysisReady = useCanvasStore(
    (s: {
      ceeAnalysisReady?: {
        options?: Array<{ id?: unknown; label?: unknown; interventions?: unknown }>
        current_graph_hash?: unknown
      } | null
    }) => s.ceeAnalysisReady,
  )

  return useMemo(() => {
    // The block must be about the graph the live slice describes, or this
    // derivation speaks for a run it does not describe.
    const liveHash = analysisReady?.current_graph_hash
    if (typeof computedAgainstHash !== 'string' || computedAgainstHash.length === 0) return null
    if (typeof liveHash !== 'string' || liveHash !== computedAgainstHash) return null

    const factorIds: string[] = []
    for (const node of nodes ?? []) {
      if (resolveNodeTypeLiteral(node) === 'factor') factorIds.push(node.id)
    }

    const options: CoverageOption[] = []
    for (const raw of analysisReady?.options ?? []) {
      // Identity is required. An option with no usable id cannot be reported
      // against — and reporting it under a positional placeholder would be the
      // value-predicate binding that lets a claim land on the wrong object.
      if (typeof raw.id !== 'string' || raw.id.length === 0) continue
      // ⚠ AN OPTION WITH NO HONEST LABEL STOPS THE WHOLE DISCLOSURE.
      // This previously fell back to `raw.id` and printed an internal token at a
      // user surface ("5f6f5e36 has 1 of 3 set."), which is the exact pattern
      // R-4 removed from this very component and which the module's own factor
      // rule already refuses. Dropping just that option is not an option either:
      // a comparison that silently omits a participant can turn uneven into
      // even. So the honest answer is to say NOTHING rather than to say
      // something partial about an option we cannot name.
      if (typeof raw.label !== 'string' || raw.label.length === 0) return null
      options.push({
        id: raw.id,
        label: raw.label,
        interventions:
          raw.interventions !== null && typeof raw.interventions === 'object'
            ? (raw.interventions as Record<string, unknown>)
            : null,
      })
    }

    return deriveOptionCoverage(options, factorIds)
  }, [nodes, analysisReady, computedAgainstHash])
}
