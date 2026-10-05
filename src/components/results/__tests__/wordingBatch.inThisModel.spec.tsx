/**
 * WORDING BATCH (DL principle audit, #87 5992243567; RT-13 / RT-14): a sentence on the Analysis tab that names an
 * option is a finding about THIS model, in Science's phrase ("In this model, X came out best in N% of simulated
 * futures"), never a verdict ("X is slightly ahead") or a bare figure ("X could overtake (56% probability)").
 *
 * One row per changed sentence binds the exact words. The SCAN row then renders every naming arm with a distinct option
 * label and fails if any sentence carrying that label drops "in this model". Compare's sentences are bound in
 * `canvas/compare-tab/__tests__/CompareRunPairBody.anatomy.spec.tsx`.
 */
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HERO_COPY } from '../analysis-hero/heroCopy'
import { TriageActionCardsBody } from '../TriageActionCardsBody'
import { ALT_LABEL, FACTOR_LABEL, PERMITTED, WITHHELD } from '../__fixtures__/leaderClaim.fixtures'
import type { ResultsSectionDataReturn } from '../useResultsSectionData'

const OPT = 'AI Reporting Module Sprint'
const TARGET = 'Quarterly revenue'

type Edge = NonNullable<ResultsSectionDataReturn['confidence']['topFragileEdge']>

/** The fixture's edge, with a resolved target and any override (the fixture carries no `toLabel`). */
const withEdge = (base: ResultsSectionDataReturn, edge: Partial<Edge> = {}): ResultsSectionDataReturn => ({
  ...base,
  confidence: {
    ...base.confidence,
    topFragileEdge: { ...(base.confidence.topFragileEdge as Edge), toId: 'goal', toLabel: TARGET, ...edge },
  },
})

const calloutText = (data: ResultsSectionDataReturn): string => {
  const { unmount } = render(<TriageActionCardsBody data={data} useV17Copy onFocusNode={() => {}} />)
  const text = screen.getByTestId('t1-flip-risk-callout').textContent ?? ''
  unmount()
  return text
}

/** Sentences, so a label in one sentence cannot borrow "in this model" from another. */
const sentences = (text: string): string[] => text.split(/(?<=\.)\s+/).filter(Boolean)

describe('RT-14 · the Analysis headline names an option only in this model', () => {
  it('slight separation', () => {
    expect(HERO_COPY.headline.slightlyAhead(OPT)).toBe(`In this model, ${OPT} came out best slightly more often.`)
  })
  it('clear separation, with and without the share', () => {
    expect(HERO_COPY.headline.mostLikelyStrongest(OPT, '57%'))
      .toBe(`In this model, ${OPT} came out best in 57% of simulated futures.`)
    expect(HERO_COPY.headline.mostLikelyStrongest(OPT, null))
      .toBe(`In this model, ${OPT} came out best in more simulated futures than any other option.`)
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

describe('RT-13 · the flip-risk callout says the conditional with its condition', () => {
  it('measured: the share is printed only with the quarter it is conditional on', () => {
    expect(calloutText(withEdge(PERMITTED()))).toContain(
      `In this model, in the quarter of simulated futures where ${FACTOR_LABEL}'s effect on ${TARGET} is weakest, ` +
        `${ALT_LABEL} comes out best in 57% of them.`,
    )
  })
  it('never the bare figure', () => {
    const text = calloutText(withEdge(PERMITTED()))
    expect(text).not.toMatch(/\(\d+% probability\)/)
    expect(text.match(/\d+%/g)).toEqual(['57%'])
  })
  it('not measured: no figure, still in this model', () => {
    expect(calloutText(withEdge(PERMITTED(), { switchProbability: undefined })))
      .toContain(`In this model, if ${FACTOR_LABEL} shifts, ${ALT_LABEL} could come out best instead.`)
  })
  it('withheld: unchanged, and it names no option', () => {
    const text = calloutText(withEdge(WITHHELD()))
    expect(text).toContain(`If ${FACTOR_LABEL} shifts, the result could change.`)
    expect(text).not.toContain(ALT_LABEL)
  })
})

describe('SCAN · no sentence that names an option drops "in this model"', () => {
  // Thunks: the callout renders inside each row, never at collection time.
  const naming: Array<[string, string, () => string]> = [
    ['hero slight', OPT, () => HERO_COPY.headline.slightlyAhead(OPT)],
    ['hero clear', OPT, () => HERO_COPY.headline.mostLikelyStrongest(OPT, '57%')],
    ['hero clear, no share', OPT, () => HERO_COPY.headline.mostLikelyStrongest(OPT, null)],
    ['hero outcome', OPT, () => HERO_COPY.headline.outcomeLeader(OPT, '£1.2m')],
    ['hero goal', OPT, () => HERO_COPY.headline.goalOnly(OPT, '49%')],
    ['hero goal and limits', OPT, () => HERO_COPY.headline.goalWithLimits(OPT, '49%')],
    ['callout measured', ALT_LABEL, () => calloutText(withEdge(PERMITTED()))],
    ['callout not measured', ALT_LABEL, () => calloutText(withEdge(PERMITTED(), { switchProbability: undefined }))],
  ]

  it.each(naming)('%s', (_where, label, build) => {
    const carrying = sentences(build()).filter((s) => s.includes(label))
    // Anti-vacuity: the arm really names the option, or the scan below proves nothing about it.
    expect(carrying.length).toBeGreaterThan(0)
    for (const s of carrying) expect(s, s).toMatch(/in this model/i)
  })

  it('CONTROL: the scan catches the retired wording', () => {
    const retired = [`${OPT} is slightly ahead.`, `If ${FACTOR_LABEL} shifts, ${ALT_LABEL} could overtake (56% probability).`]
    for (const text of retired) {
      const label = text.includes(OPT) ? OPT : ALT_LABEL
      expect(sentences(text).filter((s) => s.includes(label)).some((s) => !/in this model/i.test(s))).toBe(true)
    }
  })

  it('EXCLUDED, named: "{label} is your only option." states the user\'s own option set, not a finding', () => {
    expect(HERO_COPY.headline.singleOption(OPT)).toBe(`${OPT} is your only option.`)
  })
})
