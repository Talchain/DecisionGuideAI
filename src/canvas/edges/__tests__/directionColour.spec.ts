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
import type {
  EdgeDirectionDisplay,
  EdgeValueDisplay,
} from '../../domain/edgeValueProvenance'

const set = (value: number): EdgeValueDisplay => ({ show: true, value, source: 'user' })
const NOT_SET: EdgeValueDisplay = { show: false, reason: 'not_set' }
const ABSENT: EdgeValueDisplay = { show: false, reason: 'absent' }

// ⭐ SECOND SIGNATURE CHANGE (ROADMAP 2.928 member b): the FIRST parameter is
// now an `EdgeDirectionDisplay` too. The old `'positive' | 'negative' |
// undefined` could not express "this says 'positive' but nobody stated it" —
// the exact shape `USER_EDGE_DEFAULTS` fabricates — so the raw field reached
// the green even after ROADMAP 2.580 gated the glyph. `stated()` is the only
// way to express a licensed claim; the unlicensed ones are the three below,
// and they are DIFFERENT REASONS for the same neutral answer.
const stated = (direction: 'positive' | 'negative'): EdgeDirectionDisplay => ({
  show: true,
  direction,
  source: 'user',
})
/** `direction` present but nobody stamped it — the UI default. */
const DIR_NOT_SET: EdgeDirectionDisplay = { show: false, reason: 'not_set' }
/** No direction on the edge at all. */
const DIR_ABSENT: EdgeDirectionDisplay = { show: false, reason: 'absent' }
/** The producer explicitly declined (`effect_direction: 'unknown'`). */
const DIR_UNKNOWN: EdgeDirectionDisplay = { show: false, reason: 'unknown' }

describe('directionStroke colour logic (F.2 + E1)', () => {
  it('weight=0, direction="positive" → grey (neutral), NOT yellow', () => {
    expect(computeDirectionStroke(stated('positive'), set(0), false)).toBe('var(--edge-neutral)')
  })

  it('E1: weight=0.5, direction="positive" → the positive-green token', () => {
    expect(computeDirectionStroke(stated('positive'), set(0.5), false)).toBe('var(--edge-positive)')
  })

  it('E1: weight=0.5, direction="negative" → the negative-rose token (distinct from amber warning + risk node)', () => {
    expect(computeDirectionStroke(stated('negative'), set(0.5), false)).toBe('var(--edge-negative)')
    // Guard the C2 ruling: negative must NOT be the amber warning hue, and must
    // not be the old #ef4444 that collided with the risk-node border.
    expect(computeDirectionStroke(stated('negative'), set(0.5), false)).not.toBe('#FFA656')
    expect(computeDirectionStroke(stated('negative'), set(0.5), false)).not.toBe('#ef4444')
  })

  it('takes the MAGNITUDE, so a negative signed strength still colours by direction', () => {
    expect(computeDirectionStroke(stated('negative'), set(-0.5), false)).toBe('var(--edge-negative)')
  })

  it('weight=0, direction="negative" → grey (neutral), NOT the polarity colour', () => {
    expect(computeDirectionStroke(stated('negative'), set(0), false)).toBe('var(--edge-neutral)')
  })

  it('weight=0.5, direction=undefined → grey (no direction set)', () => {
    expect(computeDirectionStroke(DIR_ABSENT, set(0.5), false)).toBe('var(--edge-neutral)')
  })

  it('weight=0, direction=undefined → grey (weight defined, no direction), NOT yellow', () => {
    expect(computeDirectionStroke(DIR_ABSENT, set(0), false)).toBe('var(--edge-neutral)')
  })

  // ── Provenance gate ──────────────────────────────────────────────────────
  // This is the case the old `rawWeight === undefined` branch claimed to cover
  // and never could. `direction` is deliberately 'positive' below: that is the
  // value `USER_EDGE_DEFAULTS` fabricates, and it must not reach the green.
  it('unset strength → grey, even with a defaulted positive direction', () => {
    expect(computeDirectionStroke(stated('positive'), NOT_SET, false)).toBe('var(--edge-neutral)')
    expect(computeDirectionStroke(stated('positive'), NOT_SET, false)).not.toBe('var(--edge-positive)')
  })

  it('absent strength → grey too', () => {
    expect(computeDirectionStroke(stated('negative'), ABSENT, false)).toBe('var(--edge-neutral)')
    expect(computeDirectionStroke(stated('negative'), ABSENT, true)).toBe('var(--edge-neutral-dark)')
  })

  // ── The DIRECTION provenance gate (ROADMAP 2.928 member b) ───────────────
  // A SET strength is deliberate in all three: it isolates the direction gate.
  // With the strength unset every case would be grey for the other reason, and
  // the test would pass while proving nothing about direction at all.

  it('unstated direction (the UI default) → grey, even with a set strength', () => {
    expect(computeDirectionStroke(DIR_NOT_SET, set(0.6), false)).toBe('var(--edge-neutral)')
    expect(computeDirectionStroke(DIR_NOT_SET, set(0.6), false)).not.toBe('var(--edge-positive)')
  })

  it('producer EXPLICITLY declined (effect_direction: "unknown") → grey, not green', () => {
    expect(computeDirectionStroke(DIR_UNKNOWN, set(0.6), false)).toBe('var(--edge-neutral)')
    expect(computeDirectionStroke(DIR_UNKNOWN, set(0.6), false)).not.toBe('var(--edge-positive)')
  })

  it('no direction at all → grey, with a set strength and in dark mode', () => {
    expect(computeDirectionStroke(DIR_ABSENT, set(0.6), false)).toBe('var(--edge-neutral)')
    expect(computeDirectionStroke(DIR_ABSENT, set(0.6), true)).toBe('var(--edge-neutral-dark)')
  })

  it('the direction gate DISCRIMINATES: the same strength stated is green', () => {
    // The positive control for the three cases above. Without it they would all
    // pass against a function that returned neutral unconditionally.
    expect(computeDirectionStroke(stated('positive'), set(0.6), false)).toBe('var(--edge-positive)')
  })

  // Dark mode variants
  it('E1: dark mode positive → dark green', () => {
    expect(computeDirectionStroke(stated('positive'), set(0.5), true)).toBe('var(--edge-positive-dark)')
  })

  it('E1: dark mode negative → rose #F06595 (distinct from the dark risk border #FF6B6B)', () => {
    expect(computeDirectionStroke(stated('negative'), set(0.5), true)).toBe('var(--edge-negative-dark)')
    expect(computeDirectionStroke(stated('negative'), set(0.5), true)).not.toBe('#FF6B6B')
  })

  it('dark mode: neutral → zinc-400', () => {
    expect(computeDirectionStroke(stated('positive'), set(0), true)).toBe('var(--edge-neutral-dark)')
  })
})
