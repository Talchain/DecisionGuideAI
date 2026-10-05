/**
 * RT-10 B′ — CEE's own sentence for WHY a Run is out of date although the MODEL DID NOT CHANGE (CEE #2596: the Run's
 * goal snapshot disagrees with the model — its goal unit, or the direction it sent). Surfaces say it instead of
 * "Model changed", which is false when the user changed nothing.
 *
 * The ONE rule both legs apply (the cold read's `current_read`, `adapters/cee/scenarioGraph.ts`; the turn's top-level
 * `analysis_ready`, `applyV5State`): the Run's hash equals the current one, and CEE's reason is PROSE — a space, no
 * underscore, at most 200 characters (CEE sends a sentence only for these reasons; every other reason is a code).
 * Anything else is null. A leaf module on purpose: both the adapter and the v5 layer import it.
 */
export function hashEqualStaleReasonWords(reason: unknown, hashAtRun: unknown, currentHash: unknown): string | null {
  if (typeof hashAtRun !== 'string' || hashAtRun.length === 0 || hashAtRun !== currentHash) return null
  if (typeof reason !== 'string' || reason.length > 200 || !/\s/.test(reason) || reason.includes('_')) return null
  return reason.trim()
}
