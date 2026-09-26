/**
 * ⭐⭐ WAVE 2 (commitment structure, 25 Sep 2026): THE AXIS CARRIES ITS OWN
 * SCALE, so a withheld run's ranges can be READ, not just seen.
 *
 * ── THE GAP, MEASURED ─────────────────────────────────────────────────────
 * Paul's manual test of the provisional PA-hire run: every row drew a range
 * band with no numbers anywhere near it — no per-option figure (a deliberate
 * truth rule, see below) AND no axis. A reader could see that the bands
 * differed in width and position but had nothing to read them AGAINST.
 * `OptionsComparison.tsx`'s axis row carried only the (i) info button; this
 * file pins the fix — four tick labels, spread across the shared domain the
 * bands are already positioned on.
 *
 * ── ⛔ WHAT THIS DELIBERATELY DOES NOT ADD ──────────────────────────────
 * No per-option point figure ("+12%" beside the name). `outcomeRange` carries
 * no unit (`PanelFigure.tsx:51-56` rule 3, `OptionsComparison.tsx`'s own
 * range-band note, `analysisNewTypes.ts:640-644`'s captured real run whose
 * values are -0.163/0.027/0.211 — not percentages). Printing a fabricated "%"
 * beside a name would be exactly the invented unit those three sites refuse.
 * The case below pins the negative half of the same change: the axis reads,
 * the row still does not print a point figure.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { OptionsComparison } from '../sections/OptionsComparison'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { useStrengthenStore } from '../../../../canvas/stores/strengthenStore'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import { decisionWithLeaderWithheld } from './analysisNewFixtures'

const T = 'analysis-new-options'

/** Same shape `theWithheldRunShowsItsFigures.spec.tsx` and
 * `designChartCommitment.spec.tsx` use: real p10/p50/p90s, domain [10, 90]. */
const RANGES: Record<string, { mean: number; p10: number; p50: number; p90: number }> = {
  opt_a: { mean: 40, p10: 10, p50: 40, p90: 70 },
  opt_b: { mean: 55, p10: 30, p50: 55, p90: 90 },
}
const withRanges = (data: ResultsSectionDataReturn): ResultsSectionDataReturn => ({
  ...data,
  recommendation: {
    ...data.recommendation,
    allOptions: data.recommendation.allOptions.map((o) =>
      RANGES[o.id] ? { ...o, outcome: RANGES[o.id] } : o,
    ),
  },
})

function vmFor(data: ResultsSectionDataReturn) {
  return buildAnalysisNewViewModel({
    data,
    recommendations: [],
    isPreRun: false,
    isRunning: false,
    isStale: false,
  })
}

/** `OptionsComparison` mounted standalone (not `bare`) rests CLOSED behind
 * `SectionShell`; open it before reading the body, as `designChartCommitment.
 * spec.tsx` and `theComparisonSaysWhyItCannotCompare.spec.tsx` already do. */
function renderOpen(data: ResultsSectionDataReturn) {
  render(<OptionsComparison options={vmFor(data).optionsComparison} />)
  fireEvent.click(screen.getByTestId(`${T}-toggle`))
}

function row(optionId: string): HTMLElement {
  const el = document.querySelector<HTMLElement>(`[data-option-id="${optionId}"]`)
  if (!el) throw new Error(`no row for option id ${optionId}`)
  return el
}

beforeEach(() => {
  useStrengthenStore.setState({ records: {}, priorityOrder: [] } as never)
})
afterEach(() => cleanup())

// Re-pinned 26 Sep 2026: the axis domain is rounded (niceDomain; theAxisTicksAreRound.spec.ts). The
// ragged thirds of the raw range ('36.7', '423K') were the defect the prototype comparison found.
describe('the axis row reads the ranges it sits under', () => {
  it('PRECONDITION — the withheld fixture with ranges really does draw the outcome lens', () => {
    const vm = vmFor(withRanges(decisionWithLeaderWithheld()))
    expect(vm.atAGlance.headline, 'withheld run must show no reading').toBeNull()
    expect(vm.optionsComparison.rows.filter((r) => r.kind === 'analysed' && r.outcomeRange !== null).length).toBe(2)
  })

  it('draws four tick labels, spread across the shared domain, with no unit symbol', () => {
    renderOpen(withRanges(decisionWithLeaderWithheld()))

    const ticks = screen.getByTestId(`${T}-axis-ticks`)
    const labels = screen.getAllByTestId(/^analysis-new-options-axis-tick-\d$/).map((e) => e.textContent)

    // Domain is [10, 90] (opt_a p10=10 .. opt_b p90=90): four evenly-spaced
    // ticks land on 10, 36.67, 63.33, 90 — the SCALE's own values, not the
    // prototype's fixed 0/10/20/30 (this run's data is not a percentage).
    expect(labels).toEqual(['0', '30', '60', '90'])
    // ⛔ NO FABRICATED UNIT — the whole point of using the scale's own values.
    for (const l of labels) {
      expect(l, 'no % or other unit symbol may be invented').not.toMatch(/[%$£€]/)
    }
    expect(ticks).toBeInTheDocument()
  })

  it('large magnitudes read as three significant figures, never "423,333.33" (served 25 Sep)', () => {
    const LARGE: Record<string, { mean: number; p10: number; p50: number; p90: number }> = {
      opt_a: { mean: 400000, p10: 190000, p50: 400000, p90: 600000 },
      opt_b: { mean: 700000, p10: 500000, p50: 700000, p90: 890000 },
    }
    const data = decisionWithLeaderWithheld()
    renderOpen({
      ...data,
      recommendation: {
        ...data.recommendation,
        allOptions: data.recommendation.allOptions.map((o) => (LARGE[o.id] ? { ...o, outcome: LARGE[o.id] } : o)),
      },
    })
    const labels = screen.getAllByTestId(/^analysis-new-options-axis-tick-\d$/).map((e) => e.textContent)
    expect(labels).toEqual(['0', '300K', '600K', '900K'])
  })

  it('the ticks and the info button share the SAME axis element (FIRST-1 stays merged)', () => {
    renderOpen(withRanges(decisionWithLeaderWithheld()))
    const axis = screen.getByTestId(`${T}-axis`)
    const ticks = screen.getByTestId(`${T}-axis-ticks`)
    const infoButton = screen.getByTestId(`${T}-range-info`)
    expect(axis).toContainElement(ticks)
    expect(axis).toContainElement(infoButton)
  })

  // ── Paul, 25 Sep: "the last tick sits short of the band end" ──────────────
  it('⭐ each tick sits at ITS OWN fraction of the domain — not wherever label widths put it', () => {
    renderOpen(withRanges(decisionWithLeaderWithheld()))
    const lefts = [0, 1, 2, 3].map((i) => screen.getByTestId(`${T}-axis-tick-${i}`).style.left)
    expect(lefts.map((l) => parseFloat(l))).toEqual([0, 100 / 3, 200 / 3, 100].map((v) => expect.closeTo(v, 6)))
    expect(lefts.every((l) => l.endsWith('%'))).toBe(true)
    // End ticks anchor inward (never overhang the track); middle ticks centre on their value.
    const tx = [0, 1, 2, 3].map((i) => screen.getByTestId(`${T}-axis-tick-${i}`).style.transform)
    expect(tx).toEqual(['translate(0, -50%)', 'translate(-50%, -50%)', 'translate(-50%, -50%)', 'translate(-100%, -50%)'])
  })

  it('⭐ the tick row and every band track take the SAME inset, so the scale spans exactly what it reads', () => {
    renderOpen(withRanges(decisionWithLeaderWithheld()))
    const inset = (el: HTMLElement) => el.className.split(/\s+/).filter((c) => /^m[lrx]-/.test(c)).sort()
    const ticks = inset(screen.getByTestId(`${T}-axis-ticks`))
    expect(ticks).toEqual(['ml-4', 'mr-5'])
    for (const id of ['opt_a', 'opt_b']) {
      const track = within(row(id)).getByTestId(`${T}-outcome-range-${id}`)
      // ⛔ The track is `block w-full`: a margin ON it shifts a full-width box
      // (served 411158ad: 16px past the row, `mr-5` never applied). So the
      // track carries none, and its wrapper carries the inset.
      expect(inset(track), `band ${id} track carries no margin`).toEqual([])
      expect(track.parentElement, `band ${id} wrapper`).toBe(within(row(id)).getByTestId(`${T}-range-inset-${id}`))
      expect(inset(track.parentElement as HTMLElement), `band ${id} wrapper inset`).toEqual(ticks)
    }
  })

  it('⛔ no PanelFigure in the Reasoning tab takes a horizontal margin (its track is block w-full)', async () => {
    const { readFileSync, readdirSync } = await import('node:fs')
    const { join } = await import('node:path')
    const root = join(__dirname, '..')
    const files = [
      ...readdirSync(root).filter((f) => f.endsWith('.tsx')).map((f) => join(root, f)),
      ...readdirSync(join(root, 'sections')).filter((f) => f.endsWith('.tsx')).map((f) => join(root, 'sections', f)),
    ]
    const offenders: string[] = []
    let figures = 0
    for (const f of files) {
      const src = readFileSync(f, 'utf8')
      for (const m of src.matchAll(/<PanelFigure\b([\s\S]*?)\/>/g)) {
        figures += 1
        const cls = /className=(?:"([^"]*)"|\{`([^`]*)`\})/.exec(m[1])
        const text = cls ? (cls[1] ?? cls[2] ?? '') : ''
        if (/(^|\s)-?m[lrx]-|\$\{RANGE_INSET\}/.test(text)) offenders.push(`${f.split('/').pop()}: ${text}`)
      }
    }
    expect(figures, 'positive control: the scan sees the figures').toBeGreaterThanOrEqual(3)
    expect(offenders).toEqual([])
  })

  it('⭐ the info button takes no width from the scale — it is out of the tick row and absolutely placed', () => {
    renderOpen(withRanges(decisionWithLeaderWithheld()))
    const button = screen.getByTestId(`${T}-range-info`)
    expect(screen.getByTestId(`${T}-axis-ticks`)).not.toContainElement(button)
    const anchor = screen.getByTestId(`${T}-range-info-anchor`)
    expect(anchor).toContainElement(button)
    expect(anchor.className.split(/\s+/)).toContain('absolute')
    expect(screen.getByTestId(`${T}-axis`).className.split(/\s+/)).toContain('relative')
  })

  it('⛔ still prints no per-option point figure — the range stays UNIT-LESS', () => {
    renderOpen(withRanges(decisionWithLeaderWithheld()))

    // The band and marker are drawn (the range itself)...
    expect(within(row('opt_a')).getByTestId(`${T}-outcome-range-opt_a-band`)).toBeInTheDocument()
    // ...but nowhere in either row does a number-with-sign-or-percent appear,
    // which is what a fabricated modelled-outcome readout would look like.
    for (const id of ['opt_a', 'opt_b']) {
      const text = row(id).textContent ?? ''
      expect(text, `row ${id} must not print a point figure with no known unit`).not.toMatch(/[+-]?\d+(\.\d+)?%/)
    }
  })

  it('no ticks when the axis itself does not show (no range to read)', () => {
    renderOpen(decisionWithLeaderWithheld())
    // Non-vacuous: the section really did open (rows are visible), so an
    // absent axis here is a real gate, not an unopened region.
    expect(screen.getAllByTestId(`${T}-row`).length).toBeGreaterThan(0)
    expect(screen.queryByTestId(`${T}-axis`)).toBeNull()
    expect(screen.queryByTestId(`${T}-axis-ticks`)).toBeNull()
  })
})
