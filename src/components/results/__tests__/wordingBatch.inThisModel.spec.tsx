/**
 * WORDING BATCH (DL principle audit, #87 5992243567; RT-13 / RT-14): a sentence on the Analysis tab that names an
 * option is a finding about THIS model, in Science's phrase ("In this model, X came out best in N% of simulated
 * futures"), never a verdict ("X is slightly ahead") or a bare figure ("X could overtake (56% probability)").
 *
 * One row per changed sentence binds the exact words. The SCAN row then renders every naming arm with a distinct option
 * label and fails if any sentence carrying that label drops "in this model". Compare's sentences are bound in
 * `canvas/compare-tab/__tests__/CompareRunPairBody.anatomy.spec.tsx`; the Analysis headline's in
 * `analysis-hero/__tests__/wordingBatch.heroInThisModel.spec.ts` (only that folder may import the hero).
 */
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TriageActionCardsBody } from '../TriageActionCardsBody'
import { ALT_LABEL, FACTOR_LABEL, PERMITTED, WITHHELD } from '../__fixtures__/leaderClaim.fixtures'
import type { ResultsSectionDataReturn } from '../useResultsSectionData'

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
    const retired = `If ${FACTOR_LABEL} shifts, ${ALT_LABEL} could overtake (56% probability).`
    expect(sentences(retired).filter((s) => s.includes(ALT_LABEL)).some((s) => !/in this model/i.test(s))).toBe(true)
  })
})
