/**
 * F.2 + E1 — Edge direction colour logic (unit tests)
 * Tests the shared computeDirectionStroke() (no local duplicate — imported from
 * the same module StyledEdge uses, so the E1 recolour has one source of truth).
 *
 * SIGNATURE CHANGE (provenance gate): the second parameter is now an
 * `EdgeValueDisplay`, not `(weight: number, rawWeight: number | undefined)`.
 * The old pair could not express "nobody set this", and the branch that claimed
 * to handle it (`rawWeight === undefined` → yellow) was DEAD — the edge
 * defaults always define `weight`. See directionStroke.ts for the full note.
 */
import { describe, it, expect } from 'vitest'
import { computeDirectionStroke } from '../directionStroke'
import type { EdgeValueDisplay } from '../../domain/edgeValueProvenance'

const set = (value: number): EdgeValueDisplay => ({ show: true, value, source: 'user' })
const NOT_SET: EdgeValueDisplay = { show: false, reason: 'not_set' }
const ABSENT: EdgeValueDisplay = { show: false, reason: 'absent' }

describe('directionStroke colour logic (F.2 + E1)', () => {
  it('weight=0, direction="positive" → grey (neutral), NOT yellow', () => {
    expect(computeDirectionStroke('positive', set(0), false)).toBe('var(--edge-neutral)')
  })

  it('E1: weight=0.5, direction="positive" → the positive-green token', () => {
    expect(computeDirectionStroke('positive', set(0.5), false)).toBe('var(--edge-positive)')
  })

  it('E1: weight=0.5, direction="negative" → the negative-rose token (distinct from amber warning + risk node)', () => {
    expect(computeDirectionStroke('negative', set(0.5), false)).toBe('var(--edge-negative)')
    // Guard the C2 ruling: negative must NOT be the amber warning hue, and must
    // not be the old #ef4444 that collided with the risk-node border.
    expect(computeDirectionStroke('negative', set(0.5), false)).not.toBe('#FFA656')
    expect(computeDirectionStroke('negative', set(0.5), false)).not.toBe('#ef4444')
  })

  it('takes the MAGNITUDE, so a negative signed strength still colours by direction', () => {
    expect(computeDirectionStroke('negative', set(-0.5), false)).toBe('var(--edge-negative)')
  })

  it('weight=0, direction="negative" → grey (neutral), NOT the polarity colour', () => {
    expect(computeDirectionStroke('negative', set(0), false)).toBe('var(--edge-neutral)')
  })

  it('weight=0.5, direction=undefined → grey (no direction set)', () => {
    expect(computeDirectionStroke(undefined, set(0.5), false)).toBe('var(--edge-neutral)')
  })

  it('weight=0, direction=undefined → grey (weight defined, no direction), NOT yellow', () => {
    expect(computeDirectionStroke(undefined, set(0), false)).toBe('var(--edge-neutral)')
  })

  // ── Provenance gate ──────────────────────────────────────────────────────
  // This is the case the old `rawWeight === undefined` branch claimed to cover
  // and never could. `direction` is deliberately 'positive' below: that is the
  // value `USER_EDGE_DEFAULTS` fabricates, and it must not reach the green.
  it('unset strength → grey, even with a defaulted positive direction', () => {
    expect(computeDirectionStroke('positive', NOT_SET, false)).toBe('var(--edge-neutral)')
    expect(computeDirectionStroke('positive', NOT_SET, false)).not.toBe('var(--edge-positive)')
  })

  it('absent strength → grey too', () => {
    expect(computeDirectionStroke('negative', ABSENT, false)).toBe('var(--edge-neutral)')
    expect(computeDirectionStroke('negative', ABSENT, true)).toBe('var(--edge-neutral-dark)')
  })

  // Dark mode variants
  it('E1: dark mode positive → dark green', () => {
    expect(computeDirectionStroke('positive', set(0.5), true)).toBe('var(--edge-positive-dark)')
  })

  it('E1: dark mode negative → rose #F06595 (distinct from the dark risk border #FF6B6B)', () => {
    expect(computeDirectionStroke('negative', set(0.5), true)).toBe('var(--edge-negative-dark)')
    expect(computeDirectionStroke('negative', set(0.5), true)).not.toBe('#FF6B6B')
  })

  it('dark mode: neutral → zinc-400', () => {
    expect(computeDirectionStroke('positive', set(0), true)).toBe('var(--edge-neutral-dark)')
  })
})
