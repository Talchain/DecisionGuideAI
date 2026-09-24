/**
 * Analysis (New) — the tipping point must not instruct a move to where the
 * reader already is.
 *
 * ── MEASURED ON THE DEPLOYED BUILD `3e4c4231`, guest board `build-vs-buy` ────
 *
 * The Reasoning tab's primary surface rendered:
 *
 *     "Could change if Vendor Solution Adoption moves from 0.66 to 0.66"
 *
 * `glanceCondition` builds that sentence from three arms: `passes {flip}` when
 * a printable unit exists, `moves from {current} to {flip}` when one does not
 * but `current_value` does, and `changes materially` when neither does. This
 * factor sits on the 0–1 model scale, so it has no printable unit and takes the
 * middle arm — which has no guard for a `current` that RENDERS the same as the
 * flip.
 *
 * ⚠ THE COMPARISON IS ON THE FORMATTED STRINGS, NOT THE RAW NUMBERS, AND THAT
 * IS THE POINT. `formatThresholdValue` caps at two decimals, so 0.661 and 0.664
 * are different floats that print one identical sentence. A raw `!==` guard
 * would pass both through and ship the same no-op sentence it was added to
 * stop. The reader sees the rendering, so the rendering is what must differ.
 *
 * ⛔ `passes {flip}` IS NOT THE RIGHT FALL-THROUGH. It is gated on `unit`
 * deliberately — this function's own header records the shipped defect
 * "Price increase for new customers passes 1" and asks: one what? A bare number
 * with no unit is uninterpretable, so the row falls to the third arm, which is
 * this function's OWN stated rule for when no reference point is available.
 *
 * ⭐ AND THE STRUCTURE MUST FALL WITH THE SENTENCE. `quantity` is gated on
 * `unit || current` precisely so a consumer cannot quote a figure the sentence
 * dropped. Nulling `current` carries that gate for free — which is why the fix
 * is one local and not two conditions in two spellings.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import { manyFragileEdges } from './analysisNewFixtures'

afterEach(cleanup)

const withRows = (rows: unknown): ResultsSectionDataReturn => {
  const data = manyFragileEdges()
  return {
    ...data,
    recommendation: { ...data.recommendation, flipThresholdsStatus: 'computed', flipThresholds: rows },
  } as ResultsSectionDataReturn
}

const renderBody = (data: ResultsSectionDataReturn) => {
  const r = render(
    <AnalysisNewTabBody
      resultsSectionData={data}
      isPreRun={false}
      isRunning={false}
      isStale={false}
      responseHash="tipping_point_noop"
    />,
  )
  // ⚠ THE TESTID MATTERS: this spec first queried
  // `analysis-new-sensitivity-tipping-point`, which renders from `tippingPoints.ts`
  // — a DIFFERENT surface. All four cases went red, INCLUDING the contrast
  // control, which is the signature of a probe aimed at the wrong element
  // rather than a defect. The `Could change if …` sentence is `glanceCondition`'s,
  // rendered by `AtAGlance` as `analysis-new-glance-condition`.
  //
  // V2 RE-POINT (Reasoning V2, 24 Sep 2026): nothing is opened. `AtAGlance`
  // heads the answer zone and renders the condition AT REST — it is not behind
  // any `SectionShell` — so the old `openAllSections()` was a no-op for this
  // element, and on V2 it cannot converge (About's detail rows are a
  // one-at-a-time accordion). Reading at rest is the stronger claim: it is what
  // the reader sees without a click. `getByTestId` throws on absence, so no
  // case here can pass on a missing line.
  return r
}

/** The deployed shape: no printable unit, and a current that renders as the flip. */
const NOOP_ROW = [
  {
    label: 'Vendor Solution Adoption',
    node_id: 'vendor-adopt',
    current_value: 0.661,
    flip_value: 0.664,
    flip_reason: 'found',
  },
]

/** The discriminating twin: same shape, a current that renders DIFFERENTLY. */
const REAL_MOVE_ROW = [
  {
    label: 'Vendor Solution Adoption',
    node_id: 'vendor-adopt',
    current_value: 0.2,
    flip_value: 0.664,
    flip_reason: 'found',
  },
]

describe('the tipping point names a real move, or none', () => {
  it('⛔ PINS THE SHIPPED DEFECT: never instructs a move from a value to itself', () => {
    renderBody(withRows(NOOP_ROW))
    const line = screen.getByTestId('analysis-new-glance-condition')
    expect(line).not.toHaveTextContent('moves from 0.66 to 0.66')
  })

  it('falls to the unit-free arm this function already defines', () => {
    renderBody(withRows(NOOP_ROW))
    const line = screen.getByTestId('analysis-new-glance-condition')
    expect(line).toHaveTextContent('Vendor Solution Adoption changes materially')
  })

  it('⛔ does NOT reach for "passes" — a bare number with no unit is uninterpretable', () => {
    renderBody(withRows(NOOP_ROW))
    const line = screen.getByTestId('analysis-new-glance-condition')
    expect(line).not.toHaveTextContent('passes')
  })

  it('CONTRAST CONTROL: a current that renders differently still names the move', () => {
    renderBody(withRows(REAL_MOVE_ROW))
    const line = screen.getByTestId('analysis-new-glance-condition')
    expect(line).toHaveTextContent('moves from 0.2 to 0.66')
  })
})
