/**
 * Unit tests for getEdgeConfidence utility
 * P.2: Prevents regression as edge confidence is used in StyledEdge overlay,
 * Edge Summary, and overlay testid logic.
 *
 * Note: return type is `number | null` (not `undefined`).
 * The utility normalises missing confidence to `null` for consistent downstream checks.
 */

import { describe, it, expect } from 'vitest'
import { getEdgeConfidence } from '../../../src/canvas/domain/edges'

describe('getEdgeConfidence', () => {
  it('returns beliefExists when present', () => {
    expect(getEdgeConfidence({ beliefExists: 0.8 })).toBe(0.8)
  })

  it('falls back to belief when beliefExists is absent', () => {
    expect(getEdgeConfidence({ belief: 0.6 })).toBe(0.6)
  })

  it('returns null when both are undefined', () => {
    expect(getEdgeConfidence({ weight: 0.5 })).toBeNull()
  })

  it('returns null for undefined edgeData', () => {
    expect(getEdgeConfidence(undefined)).toBeNull()
  })

  it('prefers beliefExists over belief when both present', () => {
    expect(getEdgeConfidence({ beliefExists: 0.9, belief: 0.3 })).toBe(0.9)
  })
})
