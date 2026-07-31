/**
 * ⚠ THIS FILE MUST NOT IMPORT `analysis-hero/heroCopy`. The hero module is
 * under a mount guard (`analysis-hero/__tests__/inertness.spec.ts`) that
 * allows exactly two importers repo-wide. An earlier draft of this spec
 * imported `HERO_COPY` to assert the delegation and RED the guard — a real
 * architecture violation, caught by the guard doing its job. The delegation
 * assertions now live in `analysis-hero/__tests__/heroCopyDelegation.spec.ts`,
 * inside the module, which is where a claim ABOUT `heroCopy` belongs.
 *
 * goalAnchorCopy — the two-register A copy and the house comparative
 * register (Paul's re-anchoring ruling, 2026-07-31).
 *
 * The point of these tests is NOT to restate the strings. It is to pin the
 * two properties that make the module worth having:
 *
 *   1. THE POSSESSIVE GATE HOLDS IN EVERY FORM. When the number is the
 *      substituted joint quantity, no form of the A register may say "your
 *      goal" — label, compact readout, sentence or headline. A surface that
 *      forgets the flag is the defect this module removes; a form that
 *      leaks the possessive despite the flag is worse.
 *   2. THE FORMS CANNOT DRIFT APART. `sentence()` delegates to the shipped
 *      hero registers and `phrase()` is the same wording without the full
 *      stop. Both relationships are asserted, so changing one and not the
 *      other goes RED rather than shipping two voices for one claim.
 */

import { describe, expect, it } from 'vitest'
import { GOAL_ANCHOR_COPY, COMPARATIVE_COPY } from '../goalAnchorCopy'

const N = '72%'

describe('GOAL_ANCHOR_COPY — the possessive gate', () => {
  it.each([
    ['label', () => GOAL_ANCHOR_COPY.label(true)],
    ['phrase', () => GOAL_ANCHOR_COPY.phrase(N, true)],
    ['sentence', () => GOAL_ANCHOR_COPY.sentence(N, true)],
    ['headline', () => GOAL_ANCHOR_COPY.headline('Option A', N, true)],
    ['byOptionAria', () => GOAL_ANCHOR_COPY.byOptionAria(true)],
  ])('%s withholds the possessive on the substituted-joint basis', (_name, build) => {
    const text = build()
    expect(text.toLowerCase()).not.toContain('your goal')
    expect(text).toContain('every target this run scored')
  })

  it.each([
    ['label', () => GOAL_ANCHOR_COPY.label(false)],
    ['phrase', () => GOAL_ANCHOR_COPY.phrase(N, false)],
    ['sentence', () => GOAL_ANCHOR_COPY.sentence(N, false)],
    ['headline', () => GOAL_ANCHOR_COPY.headline('Option A', N, false)],
    ['byOptionAria', () => GOAL_ANCHOR_COPY.byOptionAria(false)],
  ])('%s uses the possessive when the basis permits it', (_name, build) => {
    expect(build().toLowerCase()).toContain('your goal')
  })
})

describe('GOAL_ANCHOR_COPY — forms cannot drift apart', () => {
  it.each([true, false])(
    'sentence() is phrase() plus a full stop, and nothing else (substituted=%s)',
    (substituted) => {
      expect(GOAL_ANCHOR_COPY.sentence(N, substituted)).toBe(
        `${GOAL_ANCHOR_COPY.phrase(N, substituted)}.`,
      )
    },
  )

  it.each([true, false])(
    'label() is phrase() with the number removed and the first letter capitalised (substituted=%s)',
    (substituted) => {
      const withoutNumber = GOAL_ANCHOR_COPY.phrase(N, substituted).replace(`${N} `, '')
      const capitalised = withoutNumber.charAt(0).toUpperCase() + withoutNumber.slice(1)
      expect(GOAL_ANCHOR_COPY.label(substituted)).toBe(capitalised)
    },
  )

  it('headline names the option, the basis AND the magnitude', () => {
    const h = GOAL_ANCHOR_COPY.headline('Option A', N, false)
    expect(h).toContain('Option A')
    expect(h).toContain(N)
    expect(h.toLowerCase()).toContain('your goal')
  })
})

describe('GOAL_ANCHOR_COPY — the no-target state is an invitation, not a wall', () => {
  it('names the action and what it unlocks, without an error register', () => {
    expect(GOAL_ANCHOR_COPY.noTarget).toBe(
      'Set a success target to see which option is most likely to reach it.',
    )
    for (const banned of ['unavailable', 'cannot', 'error', 'failed', 'blocked']) {
      expect(GOAL_ANCHOR_COPY.noTarget.toLowerCase()).not.toContain(banned)
    }
  })

})

describe('COMPARATIVE_COPY — says what it measures, never what to choose', () => {
  it('describes the quantity as a share of simulated scenarios', () => {
    expect(COMPARATIVE_COPY.phrase('60%')).toBe('Came out ahead in 60% of simulated scenarios')
    expect(COMPARATIVE_COPY.sentence('60%')).toBe(`${COMPARATIVE_COPY.phrase('60%')}.`)
  })

  it('carries no endorsement noun and no bare superlative', () => {
    const all = [
      COMPARATIVE_COPY.label,
      COMPARATIVE_COPY.phrase('60%'),
      COMPARATIVE_COPY.sentence('60%'),
      COMPARATIVE_COPY.byOptionAria,
      COMPARATIVE_COPY.unavailable,
    ].join(' ')
    for (const banned of [
      'win probability',
      'winner',
      'recommendation',
      'performs best',
      'strongest overall',
      'best choice',
    ]) {
      expect(all.toLowerCase()).not.toContain(banned)
    }
  })

  it('never claims the comparative number says anything about the goal', () => {
    expect(COMPARATIVE_COPY.phrase('60%').toLowerCase()).not.toContain('goal')
    expect(COMPARATIVE_COPY.label.toLowerCase()).not.toContain('goal')
  })
})
