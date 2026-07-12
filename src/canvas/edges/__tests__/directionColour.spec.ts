/**
 * F.2 + E1 — Edge direction colour logic (unit tests)
 * Tests the shared computeDirectionStroke() (no local duplicate — imported from
 * the same module StyledEdge uses, so the E1 recolour has one source of truth).
 */
import { describe, it, expect } from 'vitest'
import { computeDirectionStroke } from '../directionStroke'

describe('directionStroke colour logic (F.2 + E1)', () => {
  it('weight=0, direction="positive" → grey (neutral), NOT yellow', () => {
    expect(computeDirectionStroke('positive', 0, 0, false)).toBe('#d4d4d8')
  })

  it('weight=undefined, direction=undefined → yellow (truly uninitialised)', () => {
    expect(computeDirectionStroke(undefined, 1.0, undefined, false)).toBe('var(--goal)')
  })

  it('E1: weight=0.5, direction="positive" → the #62B290 green', () => {
    expect(computeDirectionStroke('positive', 0.5, 0.5, false)).toBe('#62B290')
  })

  it('E1: weight=0.5, direction="negative" → rose #D6336C (distinct from amber warning + risk node)', () => {
    expect(computeDirectionStroke('negative', 0.5, 0.5, false)).toBe('#D6336C')
    // Guard the C2 ruling: negative must NOT be the amber warning hue, and must
    // not be the old #ef4444 that collided with the risk-node border.
    expect(computeDirectionStroke('negative', 0.5, 0.5, false)).not.toBe('#FFA656')
    expect(computeDirectionStroke('negative', 0.5, 0.5, false)).not.toBe('#ef4444')
  })

  it('weight=0, direction="negative" → grey (neutral), NOT the polarity colour', () => {
    expect(computeDirectionStroke('negative', 0, 0, false)).toBe('#d4d4d8')
  })

  it('weight=0.5, direction=undefined, rawWeight=0.5 → grey (no direction set)', () => {
    expect(computeDirectionStroke(undefined, 0.5, 0.5, false)).toBe('#d4d4d8')
  })

  it('weight=0, direction=undefined, rawWeight=0 → grey (weight defined, no direction), NOT yellow', () => {
    expect(computeDirectionStroke(undefined, 0, 0, false)).toBe('#d4d4d8')
  })

  // Dark mode variants
  it('E1: dark mode positive → dark green', () => {
    expect(computeDirectionStroke('positive', 0.5, 0.5, true)).toBe('#bbf7d0')
  })

  it('E1: dark mode negative → rose #F06595 (distinct from the dark risk border #FF6B6B)', () => {
    expect(computeDirectionStroke('negative', 0.5, 0.5, true)).toBe('#F06595')
    expect(computeDirectionStroke('negative', 0.5, 0.5, true)).not.toBe('#FF6B6B')
  })

  it('dark mode: neutral → zinc-400', () => {
    expect(computeDirectionStroke('positive', 0, 0, true)).toBe('#a1a1aa')
  })
})
