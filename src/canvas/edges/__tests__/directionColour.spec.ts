/**
 * F.2 — Edge direction colour logic (unit tests)
 * Tests the colour rules without rendering StyledEdge (avoids ReactFlow dependency)
 */
import { describe, it, expect } from 'vitest'

/**
 * Pure function replicating the direction stroke logic from StyledEdge.tsx (F.2)
 * Extracted here so the rules can be tested without a full React render.
 * Yellow is strictly reserved for truly uninitialised edges (no direction AND no weight).
 */
function computeDirectionStroke(
  direction: 'positive' | 'negative' | undefined,
  weight: number,
  rawWeight: number | undefined,
  isDark: boolean,
): string {
  // Truly uninitialised: no direction AND weight is undefined → yellow
  if (direction === undefined && rawWeight === undefined) {
    return 'var(--goal)'
  }
  // Weight defined but direction not yet set → grey (not yellow)
  if (direction === undefined) {
    return isDark ? '#a1a1aa' : '#d4d4d8'
  }
  // Direction set with positive weight → green
  if (direction === 'positive' && weight > 0) {
    return isDark ? '#bbf7d0' : '#a7f3d0'
  }
  // Direction set with negative weight → red
  if (direction === 'negative' && weight > 0) {
    return isDark ? '#FF6B6B' : '#ef4444'
  }
  // Neutral: weight === 0 (valid user choice)
  return isDark ? '#a1a1aa' : '#d4d4d8'
}

describe('directionStroke colour logic (F.2)', () => {
  it('weight=0, direction="positive" → grey (neutral), NOT yellow', () => {
    const result = computeDirectionStroke('positive', 0, 0, false)
    expect(result).toBe('#d4d4d8') // Zinc-300 (grey)
  })

  it('weight=undefined, direction=undefined → yellow (truly uninitialised)', () => {
    const result = computeDirectionStroke(undefined, 1.0, undefined, false)
    expect(result).toBe('var(--goal)')
  })

  it('weight=0.5, direction="positive" → green', () => {
    const result = computeDirectionStroke('positive', 0.5, 0.5, false)
    expect(result).toBe('#a7f3d0') // emerald-200
  })

  it('weight=0.5, direction="negative" → red', () => {
    const result = computeDirectionStroke('negative', 0.5, 0.5, false)
    expect(result).toBe('#ef4444') // red-500
  })

  it('weight=0, direction="negative" → grey (neutral), NOT red', () => {
    const result = computeDirectionStroke('negative', 0, 0, false)
    expect(result).toBe('#d4d4d8')
  })

  it('weight=0.5, direction=undefined, rawWeight=0.5 → grey (no direction set)', () => {
    const result = computeDirectionStroke(undefined, 0.5, 0.5, false)
    expect(result).toBe('#d4d4d8')
  })

  it('weight=0, direction=undefined, rawWeight=0 → grey (weight defined, no direction), NOT yellow', () => {
    const result = computeDirectionStroke(undefined, 0, 0, false)
    expect(result).toBe('#d4d4d8')
  })

  // Dark mode variants
  it('dark mode: positive → dark green', () => {
    const result = computeDirectionStroke('positive', 0.5, 0.5, true)
    expect(result).toBe('#bbf7d0')
  })

  it('dark mode: negative → bright red', () => {
    const result = computeDirectionStroke('negative', 0.5, 0.5, true)
    expect(result).toBe('#FF6B6B')
  })

  it('dark mode: neutral → zinc-400', () => {
    const result = computeDirectionStroke('positive', 0, 0, true)
    expect(result).toBe('#a1a1aa')
  })
})
