/**
 * Structured step-boundary logging for applyV5State.
 *
 * Emits one filterable `[v5-state]` line per step so a browser console filter
 * reveals why store state diverged from wire data. Payload is keys/counts/
 * enum values only — never raw user text, node labels, or option titles.
 *
 * Gated behind a dedicated env flag (`VITE_V5_STATE_DEBUG`) so ops can
 * enable verbose tracing in preview without flipping the global DEV flag.
 * Default off everywhere (tests included) so pre-existing suites don't
 * assert on new console output.
 */

export interface V5StateLogCtx {
  step_number: 1 | 2 | 3 | 4
  step_name: string
  /** Field names read from the V5 response at this step (never values). */
  input_keys: readonly string[]
  /** Store-slice identifiers written at this step (empty when applied === false). */
  output_keys: readonly string[]
  /** True if the step mutated state; false for no-op / skip. */
  applied: boolean
  /** Machine-readable skip reason when applied === false. Omit when applied. */
  skip_reason?: string
}

// Vite inlines import.meta.env at build time. Reading it once per call is
// cheap and keeps the helper self-contained.
function isV5StateDebugEnabled(): boolean {
  try {
    return (import.meta as { env?: Record<string, unknown> })?.env?.VITE_V5_STATE_DEBUG === 'true'
  } catch {
    return false
  }
}

export function logV5StateStep(ctx: V5StateLogCtx): void {
  if (!isV5StateDebugEnabled()) return
  // console.info so it shows up as an explicit diagnostic, not a warning.
  console.info('[v5-state]', {
    step_number: ctx.step_number,
    step_name: ctx.step_name,
    input_keys: ctx.input_keys,
    output_keys: ctx.output_keys,
    applied: ctx.applied,
    ...(ctx.applied ? {} : { skip_reason: ctx.skip_reason ?? 'unspecified' }),
  })
}

/** Emit a filter-style [v5-state] line from surfaces outside applyV5State
 * (e.g. chip readiness filter in SuggestedChips). Same gating, same prefix. */
export function logV5StateEvent(
  event: string,
  detail: Record<string, string | number | boolean | null | readonly string[]>,
): void {
  if (!isV5StateDebugEnabled()) return
  console.info('[v5-state]', { event, ...detail })
}
