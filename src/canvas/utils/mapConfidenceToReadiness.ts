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
  confidence: Confidence | undefined
): DecisionReadiness | null {
  if (!confidence) return null

  const level = confidence.level.toLowerCase() as 'high' | 'medium' | 'low'

  switch (confidence.level) {
    case 'HIGH':
      return {
        ready: true,
        confidence: level,
        blockers: [],
        warnings: [],
        passed: [
          'High confidence analysis',
          'Model structure validated',
          confidence.reason || 'Analysis complete',
        ].filter(Boolean) as string[],
      }

    case 'MEDIUM':
      return {
        ready: true,
        confidence: level,
        blockers: [],
        warnings: [
          'Medium confidence — consider reviewing key assumptions',
          confidence.reason,
        ].filter(Boolean) as string[],
        passed: ['Model structure validated'],
      }

    case 'LOW':
      return {
        ready: false,
        confidence: level,
        blockers: [
          'Low confidence analysis',
          confidence.reason || 'Review model inputs',
        ].filter(Boolean) as string[],
        warnings: [],
        passed: [],
      }

    default:
      return null
  }
}
