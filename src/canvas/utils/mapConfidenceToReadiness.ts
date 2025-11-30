import type { DecisionReadiness } from '../../types/plot'

interface Confidence {
  level: 'HIGH' | 'MEDIUM' | 'LOW'
  score?: number
  reason?: string
}

/**
 * Maps PLoT Engine confidence to DecisionReadiness shape.
 *
 * Backend does not return decision_readiness directly.
 * This mapper creates equivalent UI data from confidence.
 */
export function mapConfidenceToReadiness(
  confidence: Confidence | undefined,
  supportsObjective?: boolean
): DecisionReadiness | null {
  if (!confidence) return null

  const level = confidence.level.toLowerCase() as 'high' | 'medium' | 'low'

  // Helper to append an optional reason to a list
  const withReason = (items: string[]): string[] =>
    confidence.reason ? [...items, confidence.reason] : items

  switch (confidence.level) {
    case 'HIGH': {
      // If the outcome does NOT support the objective, treat as not ready
      if (supportsObjective === false) {
        return {
          ready: false,
          confidence: level,
          blockers: withReason(['High confidence the outcome works against your objective']),
          warnings: [],
          passed: [],
        }
      }

      return {
        ready: true,
        confidence: level,
        blockers: [],
        warnings: [],
        passed: withReason([
          'High confidence analysis',
          'Model structure validated',
        ]),
      }
    }

    case 'MEDIUM': {
      const ready = supportsObjective !== false
      const label = supportsObjective ? 'Proceed with caution' : 'Review required'

      return {
        ready,
        confidence: level,
        blockers: ready ? [] : withReason(['Medium confidence and outcome does not clearly support your objective']),
        warnings: ready
          ? withReason(['Medium confidence — proceed with caution and review key assumptions'])
          : withReason(['Medium confidence — review key assumptions before deciding']),
        passed: ['Model structure validated', label],
      }
    }

    case 'LOW':
      return {
        ready: false,
        confidence: level,
        blockers: withReason(['Low confidence analysis']),
        warnings: [],
        passed: [],
      }

    default:
      return null
  }
}
