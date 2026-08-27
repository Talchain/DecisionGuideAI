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
 * ⭐ THIS IS FOR A LIVE PANEL, AND THAT IS WHY IT NEEDS NO GATE.
 *
 * An earlier round rendered this inside the conversational analysis-result
 * block and then tried to make that safe. It could not be: coverage is derived
 * from LIVE store state and a transcript entry is a HISTORIC record, so every
 * past block showed today's coverage, and the strip vanished silently on the
 * many paths that invalidate readiness. Two successive gates were built for
 * that and both were wrong — the second was measured failing on a real capture
 * where the graph hash was identical across two turns while coverage went from
 * every cell set to none.
 *
 * The answer was not a third gate. **A guard is the wrong instrument when the
 * real problem is that the derivation is in the wrong kind of surface.** On a
 * live results panel, reading live state is not a hazard to be fenced — it is
 * the correct authority, because the panel is ABOUT the current model.
 *
 * So: mount this only on surfaces that are about the model as it stands now.
 * If it is ever wanted beside a historic record, the honest shape is for that
 * record to carry its own answer, not for this hook to guess whether today's
 * state still describes it.
 */
export function useOptionCoverage(): CoverageReading | null {
  const nodes = useCanvasStore(
    (s: { nodes?: Array<{ id: string; type?: string; data?: unknown }> }) => s.nodes,
  )
  const analysisReady = useCanvasStore(
    (s: {
      ceeAnalysisReady?: {
        options?: Array<{ id?: unknown; label?: unknown; interventions?: unknown }>
      } | null
    }) => s.ceeAnalysisReady,
  )

  return useMemo(() => {
    const factorIds: string[] = []
    for (const node of nodes ?? []) {
      if (resolveNodeTypeLiteral(node) === 'factor') factorIds.push(node.id)
    }

    const options: CoverageOption[] = []
    for (const raw of analysisReady?.options ?? []) {
      // Identity is required. An option with no usable id cannot be reported
      // against — and reporting it under a positional placeholder would be the
      // value-predicate binding that lets a claim land on the wrong object.
      // ⚠ NOT `continue`. Dropping a participant shrinks the denominator, and a
      // shrunken participant set can read COMPLETE when the analysis actually
      // had an option we could not account for — Gate 1's fabrication through a
      // different door. The denominator must be the options the analysis HAD,
      // never the options we could name. If one is unusable, say nothing.
      if (typeof raw.id !== 'string' || raw.id.length === 0) return null
      // ⚠ AN OPTION WITH NO HONEST LABEL STOPS THE WHOLE DISCLOSURE.
      // This previously fell back to `raw.id` and printed an internal token at a
      // user surface ("5f6f5e36 has 1 of 3 set."), which is the exact pattern
      // R-4 removed from this very component and which the module's own factor
      // rule already refuses. Dropping just that option is not an option either:
      // a comparison that silently omits a participant can turn uneven into
      // even. So the honest answer is to say NOTHING rather than to say
      // something partial about an option we cannot name.
      // Mirrors `deriveOptionCoverage`'s own guard, which is the authority; this
      // is the earliest honest exit, not a second rule.
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
  }, [nodes, analysisReady])
}
