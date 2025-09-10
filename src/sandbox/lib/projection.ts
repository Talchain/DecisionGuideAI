import { normalize } from '@/sandbox/probabilities/math'
import { computeProjection } from '../../../packages/scenario-engine/computeProjection'

export type ProjectionOption = {
  id: string
  probability: number
  score: number
}

export type ProjectionResult = {
  normalized: number[]
  expectedValue: number
}

// Basic projection builder for the Scenario Sandbox mock.
// Normalizes probabilities and computes a simple expected value.
export function buildProjection(options: ProjectionOption[]): ProjectionResult {
  const probs = normalize(options.map(o => o.probability))
  const expectedValue = options.reduce((acc, o, i) => acc + probs[i] * (o.score ?? 0), 0)
  // Also compute deterministic bands via scenario-engine (not returned here yet)
  try {
    // Default confidence=1, no decay input
    const inputs = options.map(o => ({ id: o.id, p: o.probability, c: 1 }))
    void computeProjection(inputs, { asOfMs: Date.now() })
  } catch {}
  return { normalized: probs, expectedValue }
}
