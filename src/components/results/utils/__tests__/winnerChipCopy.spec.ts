/**
 * winnerChipCopy — unit tests.
 *
 * Run-4 judge, DL ruling (12 Oct, the class): the leading option's chip ("Why did the most runs in this model support
 * this?", and the tier-softened "What does this rest on in this model?" whose message asked the same) was a leader
 * claim from a win share. It is removed with no replacement: `winnerChipLabel` returns `null` for the leading option on
 * a turn that designates one, and the card draws no chip. The tier × stability arms went with it.
 *
 * Every other card keeps its forward-looking chip; its label and message stay one question.
 *
 * Complements OptionCards.brief-5_1.spec.tsx (integration).
 */

import { describe, it, expect } from 'vitest'
import { winnerChipLabel, winnerChipPrompt } from '../winnerChipCopy'

describe('winnerChipLabel — the leading option has no chip', () => {
  it('⭐ returns null for the leading option on a turn that designates one (was "Why did the most runs …?")', () => {
    expect(winnerChipLabel(true)).toBeNull()
    expect(winnerChipLabel(true, true)).toBeNull()
    expect(winnerChipLabel(true, undefined)).toBeNull()
  })

  it('a withheld turn designates no leader, so its front-runner keeps the forward-looking chip (ROADMAP 1.223)', () => {
    expect(winnerChipLabel(true, false)).toBe('What would make this better supported?')
  })
})

describe('winnerChipLabel — non-winner (always forward-looking)', () => {
  it.each([true, false, undefined] as const)('returns the forward-looking copy (hasLeadingOption %s)', hasLeadingOption => {
    expect(winnerChipLabel(false, hasLeadingOption)).toBe('What would make this better supported?')
  })
})

describe('winnerChipPrompt', () => {
  it('builds the forward-looking prompt that quotes the option label', () => {
    expect(winnerChipPrompt('Option B')).toBe(
      'What would make "Option B" better supported instead? What changes would be needed?',
    )
  })

  it('embeds label text verbatim (no escaping) — UI responsibility to sanitise upstream', () => {
    expect(winnerChipPrompt('Plan - v2')).toContain('"Plan - v2"')
  })
})

describe('winnerChipCopy — structural guards', () => {
  /**
   * ⭐ THE LABEL AND THE MESSAGE ARE ONE VOICE — pinned because they came apart once (#1281: the label said "better
   * supported" while the message still said "lead instead"). A future edit to either function alone REDs here.
   */
  it('the label and the prompt share their wording', () => {
    expect(winnerChipLabel(false)).toContain('better supported')
    expect(winnerChipPrompt('Option B')).toContain('better supported')
  })

  /**
   * ⭐ THE RULINGS, asserted over every reachable combination: Paul's "There's never a winner", and the run-4 judge's
   * no leader claim from a win share. The enumeration is the full cross-product, so a string added later is covered the
   * day it arrives.
   */
  it('no reachable chip string frames a contest or claims a leader from a win share', () => {
    const RACE = /\bwinners?\b|\bleaders?\b|\bleads?\b|\bahead\b|\bbeats?\b|\boutperform/i
    const LEADER_WORDS = /more runs than any other|most runs|ahead of|out on top|than any other option/i
    const strings: string[] = []
    for (const isWinner of [true, false]) {
      for (const hasLeadingOption of [true, false, undefined]) {
        const label = winnerChipLabel(isWinner, hasLeadingOption)
        if (label !== null) strings.push(label, winnerChipPrompt('Option A'))
      }
    }
    // Positive control on the corpus: four of the six combinations draw a chip (the leading option's two do not).
    expect(strings.length).toBe(8)
    expect(strings.filter(s => RACE.test(s) || LEADER_WORDS.test(s))).toEqual([])
  })
})
