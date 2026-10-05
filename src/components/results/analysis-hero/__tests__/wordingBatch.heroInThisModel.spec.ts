/**
 * WORDING BATCH (DL principle audit, #87 5992243567; RT-14): the Analysis headline names an option only as a finding
 * about THIS model, in Science's phrase ("In this model, X came out best in N% of simulated futures"), never as a
 * verdict ("X is slightly ahead"). One row per changed headline binds the exact words; the SCAN row fails if any
 * headline sentence carrying the option label drops "in this model". Lives inside `analysis-hero/` because
 * `inertness.spec.ts` allows only this folder (and the authorised mount) to import the hero. The RT-13 callout's rows
 * are in `components/results/__tests__/wordingBatch.inThisModel.spec.tsx`.
 */
import { describe, expect, it } from 'vitest'
import { HERO_COPY } from '../heroCopy'

const OPT = 'AI Reporting Module Sprint'

/** Sentences, so a label in one sentence cannot borrow "in this model" from another. */
const sentences = (text: string): string[] => text.split(/(?<=\.)\s+/).filter(Boolean)

describe('RT-14 · the Analysis headline names an option only in this model', () => {
  it('slight separation', () => {
    expect(HERO_COPY.headline.slightlyAhead(OPT)).toBe(`In this model, slightly more runs supported ${OPT}.`)
  })
  it('clear separation, with and without the share', () => {
    expect(HERO_COPY.headline.mostLikelyStrongest(OPT, '57%'))
      .toBe(`In this model, ${OPT} was supported by 57% of runs.`)
    expect(HERO_COPY.headline.mostLikelyStrongest(OPT, null))
      .toBe(`In this model, ${OPT} was supported by more runs than any other option.`)
  })
  it('no clear separation names no option', () => {
    expect(HERO_COPY.headline.noClearLeader).toBe('In this model, no option is clearly most likely.')
  })
  it('the expected-outcome and goal headlines', () => {
    expect(HERO_COPY.headline.outcomeLeader(OPT, '£1.2m'))
      .toBe(`In this model, ${OPT} has the highest expected outcome: £1.2m.`)
    expect(HERO_COPY.headline.goalOnly(OPT, '49%'))
      .toBe(`In this model, ${OPT} meets every target this run scored in the most model runs (49%).`)
    expect(HERO_COPY.headline.goalWithLimits(OPT, '49%'))
      .toBe(`In this model, ${OPT} meets your goal and limits in the most model runs (49%).`)
  })
})

describe('SCAN · no headline that names an option drops "in this model"', () => {
  const naming: Array<[string, string]> = [
    ['slight', HERO_COPY.headline.slightlyAhead(OPT)],
    ['clear', HERO_COPY.headline.mostLikelyStrongest(OPT, '57%')],
    ['clear, no share', HERO_COPY.headline.mostLikelyStrongest(OPT, null)],
    ['outcome', HERO_COPY.headline.outcomeLeader(OPT, '£1.2m')],
    ['goal', HERO_COPY.headline.goalOnly(OPT, '49%')],
    ['goal and limits', HERO_COPY.headline.goalWithLimits(OPT, '49%')],
  ]

  it.each(naming)('%s', (_where, text) => {
    const carrying = sentences(text).filter((s) => s.includes(OPT))
    // Anti-vacuity: the arm really names the option, or the scan proves nothing about it.
    expect(carrying.length).toBeGreaterThan(0)
    for (const s of carrying) expect(s, s).toMatch(/in this model/i)
  })

  it('CONTROL: the scan catches the retired wording', () => {
    const retired = `${OPT} is slightly ahead.`
    expect(sentences(retired).filter((s) => s.includes(OPT)).some((s) => !/in this model/i.test(s))).toBe(true)
  })

  it('EXCLUDED, named: "{label} is your only option." states the user\'s own option set, not a finding', () => {
    expect(HERO_COPY.headline.singleOption(OPT)).toBe(`${OPT} is your only option.`)
  })
})
