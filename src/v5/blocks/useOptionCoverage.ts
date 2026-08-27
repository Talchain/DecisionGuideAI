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
      if (typeof raw.id !== 'string' || raw.id.length === 0) continue
      options.push({
        id: raw.id,
        label: typeof raw.label === 'string' ? raw.label : raw.id,
        interventions:
          raw.interventions !== null && typeof raw.interventions === 'object'
            ? (raw.interventions as Record<string, unknown>)
            : null,
      })
    }

    return deriveOptionCoverage(options, factorIds)
  }, [nodes, analysisReady])
}
