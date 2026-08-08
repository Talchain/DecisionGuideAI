/**
 * ROADMAP 2.580 member 1 — unit coverage for the rounding-note derivation.
 *
 * The corpus is NOT drawn from what felt plausible: every readout shape below
 * is one `formatProbabilityWithResolution` can actually emit (CLAUDE.md trap
 * 22 — a corpus from the author's head cannot see the class the author did not
 * imagine). The bound and decimal arms are exercised against the real
 * formatter in `roundingNoteMatchesFormatter` at the bottom, so a change to
 * the ladder shows up here rather than silently widening the note's domain.
 */

import { describe, it, expect } from 'vitest'
import { deriveOddsRoundingNote } from '../oddsRoundingNote'
import { formatProbabilityWithResolution } from '../../../../utils/formatPercent'

describe('deriveOddsRoundingNote', () => {
  it('states the actual total when rounded wholes fall short of 100', () => {
    // 0.334 / 0.333 / 0.333 → 33% 33% 33%
    expect(deriveOddsRoundingNote(['33%', '33%', '33%'])).toBe(
      'These are rounded to whole percentages, so they total 99%, not 100%.',
    )
  })

  it('states the actual total when rounded wholes overshoot 100', () => {
    // 0.335 / 0.335 / 0.330 → 34% 34% 33%
    expect(deriveOddsRoundingNote(['34%', '34%', '33%'])).toBe(
      'These are rounded to whole percentages, so they total 101%, not 100%.',
    )
  })

  it('renders NO note when the displayed wholes already total 100', () => {
    expect(deriveOddsRoundingNote(['65%', '35%'])).toBeNull()
    expect(deriveOddsRoundingNote(['80%', '18%', '2%'])).toBeNull()
  })

  it('renders no note for a single option (not a partition)', () => {
    expect(deriveOddsRoundingNote(['99%'])).toBeNull()
    expect(deriveOddsRoundingNote([])).toBeNull()
  })

  it('FAILS CLOSED on a bounded readout — a bound carries no derivable total', () => {
    // `< 1%` is the sub-resolution floor: the true share is unknown, so
    // "they total 99%" would be a claim the data does not support.
    expect(deriveOddsRoundingNote(['< 1%', '50%', '49%'])).toBeNull()
    expect(deriveOddsRoundingNote(['>99%', '1%'])).toBeNull()
  })

  it('FAILS CLOSED on a decimal readout — "rounded to whole percentages" would be false', () => {
    expect(deriveOddsRoundingNote(['99.95%', '0.05%'])).toBeNull()
    expect(deriveOddsRoundingNote(['66.7%', '33.3%'])).toBeNull()
  })

  it('tolerates surrounding whitespace without widening the accepted shapes', () => {
    expect(deriveOddsRoundingNote([' 33%', '33% ', ' 33% '])).toBe(
      'These are rounded to whole percentages, so they total 99%, not 100%.',
    )
    expect(deriveOddsRoundingNote(['3 3%', '67%'])).toBeNull()
  })
})

describe('roundingNoteMatchesFormatter', () => {
  /**
   * Pins the note's DOMAIN to the real formatter rather than to this spec's
   * idea of it: the three-way split below is what the option cards print for
   * these inputs, and the note is derived from exactly those strings.
   */
  it('is derived from strings the live formatter actually produces', () => {
    const probabilities = [0.334, 0.333, 0.333]
    const readouts = probabilities.map(p => formatProbabilityWithResolution(p, 4000))

    // Precondition pinned IN-TEST: if the formatter stops emitting whole
    // percents for these inputs, this assertion fails rather than the note
    // silently becoming unreachable (CLAUDE.md trap 13b).
    expect(readouts).toEqual(['33%', '33%', '33%'])

    expect(deriveOddsRoundingNote(readouts)).toBe(
      'These are rounded to whole percentages, so they total 99%, not 100%.',
    )
  })

  it('stays silent on a sub-resolution share the formatter floors', () => {
    const readouts = [
      formatProbabilityWithResolution(0.0001, 4000),
      formatProbabilityWithResolution(0.5, 4000),
      formatProbabilityWithResolution(0.4999, 4000),
    ]
    expect(readouts[0]).not.toMatch(/^\d+%$/)
    expect(deriveOddsRoundingNote(readouts)).toBeNull()
  })
})
