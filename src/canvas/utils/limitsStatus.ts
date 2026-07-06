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
