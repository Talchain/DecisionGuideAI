import type { LimitsV1 } from '../../adapters/plot/types'

export type LimitsZone = 'comfortable' | 'getting_complex' | 'at_limit'

export interface LimitsUsageSnapshot {
  current: number
  max: number
  percent: number
}

export interface LimitsStatusResult {
  zone: LimitsZone
  nodes: LimitsUsageSnapshot
  edges: LimitsUsageSnapshot
  /**
   * Short label for the current zone, reused across Context Bar, Limits tab, and tooltips.
   * Example: "Comfortable", "Getting complex", "At limit".
   */
  zoneLabel: string
  /**
   * Calm, reassuring message describing the current limits situation.
   * Surfaces should prefer this copy for consistency.
   */
  message: string
}

/**
 * Derive a simple 3-zone limits status from engine limits and current usage.
 * Used by Context Bar, Limits tab, Status chips, and run gating to ensure
 * thresholds and wording stay in sync.
 */
export function deriveLimitsStatus(
  limits: LimitsV1 | null,
  currentNodes: number,
  currentEdges: number
): LimitsStatusResult | null {
  if (!limits) return null

  const nodesPercent = Math.round((currentNodes / limits.nodes.max) * 100)
  const edgesPercent = Math.round((currentEdges / limits.edges.max) * 100)
  const maxPercent = Math.max(nodesPercent, edgesPercent)

  let zone: LimitsZone
  let zoneLabel: string
  let message: string

  if (maxPercent >= 90) {
    zone = 'at_limit'
    zoneLabel = 'At limit'
    message = 'Your graph is at the engine\'s recommended limit. Consider simplifying before running.'
  } else if (maxPercent >= 70) {
    zone = 'getting_complex'
    zoneLabel = 'Getting complex'
    message = 'Your graph is getting complex but is still within the engine\'s limits.'
  } else {
    zone = 'comfortable'
    zoneLabel = 'Comfortable'
    message = 'You are comfortably within the engine\'s recommended range.'
  }

  return {
    zone,
    zoneLabel,
    message,
    nodes: {
      current: currentNodes,
      max: limits.nodes.max,
      percent: nodesPercent,
    },
    edges: {
      current: currentEdges,
      max: limits.edges.max,
      percent: edgesPercent,
    },
  }
}

/**
 * ⭐⭐ THE PRODUCER'S OWN MAXIMUM — the one limits fact the UI is entitled to act on.
 *
 * `/v1/limits` states `nodes.max` and `edges.max` and nothing else. A count that
 * EXCEEDS one of those is a fact about a set the producer defined; the UI picks
 * neither side of the comparison, so this is a range check, not a threshold.
 *
 * ⚠ NAMED APART FROM `zone` ON PURPOSE (trap 21). `zone === 'at_limit'` answers
 * *"are you near the ceiling?"* — a UI band at 90% — and its honest remedy is
 * *nothing, carry on*. This answers *"have you gone past what the engine stated
 * it will take?"*, whose remedy is *you must remove something*. They were one
 * predicate, and the run gate read the wrong one: it refused analysis at 90% of
 * capacity and told the user the ENGINE had refused it.
 *
 * `max` means the largest permitted, so equality passes.
 */
export function exceedsEngineLimit(status: LimitsStatusResult): boolean {
  return status.nodes.current > status.nodes.max || status.edges.current > status.edges.max
}

/** The axes that are over, with the producer's figure for each. Empty when the
 *  graph is within what the engine stated. Used to say what is true rather than
 *  to grade. */
export function engineLimitOverage(
  status: LimitsStatusResult,
): ReadonlyArray<{ axis: 'nodes' | 'edges'; current: number; max: number; over: number }> {
  const out: Array<{ axis: 'nodes' | 'edges'; current: number; max: number; over: number }> = []
  for (const axis of ['nodes', 'edges'] as const) {
    const { current, max } = status[axis]
    if (current > max) out.push({ axis, current, max, over: current - max })
  }
  return out
}
