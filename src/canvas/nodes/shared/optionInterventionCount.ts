/**
 * `resolveOptionInterventionCount` — how many factors an option changes.
 *
 * One owner, two readers: `OptionNode` (which shows the changes themselves, and
 * the "+N more in inspector" overflow) and the reduced line a node renders
 * below the legibility floor, which has room only for the COUNT.
 *
 * ⚠ THE PRIORITY IS THE PRODUCT'S EXISTING ONE AND IS NOT A NEW DECISION:
 * `ceeAnalysisReady.options[id].interventions` first — the reconciled server
 * view — then the option node's own `data.interventions`, which is the
 * pre-CEE / in-flight state. A model that has never round-tripped has only the
 * second, and that is exactly the state a freshly drafted model is in.
 *
 * Returns 0 for "this option changes nothing", which is a real answer a
 * status-quo option genuinely has. A caller that cannot supply the inputs at
 * all must pass its own `null` — absence of the fact is not absence of changes,
 * and the two must not collapse into one number.
 */
export interface OptionInterventionSources {
  /** `ceeAnalysisReady.options` — the reconciled server view, when present. */
  ceeOptions: { id: string; interventions?: Record<string, unknown> }[] | null | undefined
  /** The option node's own `data.interventions`, the pre-CEE fallback. */
  nodeInterventions: unknown
}

export function resolveOptionInterventionCount(
  optionId: string,
  { ceeOptions, nodeInterventions }: OptionInterventionSources,
): number {
  const ceeOption = ceeOptions?.find(opt => opt.id === optionId)
  if (ceeOption?.interventions && typeof ceeOption.interventions === 'object') {
    return Object.keys(ceeOption.interventions).length
  }
  if (nodeInterventions && typeof nodeInterventions === 'object') {
    return Object.keys(nodeInterventions as Record<string, unknown>).length
  }
  return 0
}
