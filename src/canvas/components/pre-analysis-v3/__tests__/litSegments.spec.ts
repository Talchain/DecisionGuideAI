/**
 * litSegments (UI-SEM-053) — quantises a 0..1 bar fill into discrete lit
 * segments for the vertical gauge. Zero fill lights nothing (an empty gauge
 * reads as "nothing yet"); any positive fill lights at least one; fill never
 * over-lights past the segment count.
 */

import { describe, it, expect } from 'vitest'
import { litSegments, GAUGE_SEGMENTS } from '../constants'

describe('litSegments — fill → discrete gauge segments', () => {
  it('lights nothing for empty / non-positive / NaN fill', () => {
    expect(litSegments(0)).toBe(0)
    expect(litSegments(-0.3)).toBe(0)
    expect(litSegments(Number.NaN)).toBe(0)
  })

  it('lights at least one segment for any positive fill', () => {
    expect(litSegments(0.001)).toBe(1)
    expect(litSegments(0.1)).toBe(1) // 0.5 → rounds to 1 (min floor still 1)
  })

  it('lights every segment at full fill and clamps above 1', () => {
    expect(litSegments(1)).toBe(GAUGE_SEGMENTS)
    expect(litSegments(2)).toBe(GAUGE_SEGMENTS)
  })

  it('rounds to the nearest segment (default 5)', () => {
    expect(litSegments(0.85)).toBe(4) // 4.25 → 4
    expect(litSegments(0.55)).toBe(3) // 2.75 → 3
    expect(litSegments(0.3)).toBe(2) // 1.5 → 2
    expect(litSegments(0.45)).toBe(2) // 2.25 → 2
  })

  it('honours an explicit segment count', () => {
    expect(litSegments(0.85, 4)).toBe(3) // 3.4 → 3
    expect(litSegments(0.5, 4)).toBe(2)
    expect(litSegments(1, 4)).toBe(4)
    expect(litSegments(0, 4)).toBe(0)
  })
})
