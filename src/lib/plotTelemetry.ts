/**
 * PLoT Telemetry - Closed-set, no PII
 * Dev mode only by default
 */

const IS_DEV = import.meta.env.DEV

export function logPlotRun(data: {
  template_id?: string
  seed: number
  belief_mode?: string
  response_hash: string
  elapsed_ms: number
}) {
  if (!IS_DEV) return
  
  console.debug('[PLoT]', {
    template: data.template_id,
    seed: data.seed,
    mode: data.belief_mode,
    hash: data.response_hash.slice(0, 16),
    elapsed: data.elapsed_ms
  })
}
