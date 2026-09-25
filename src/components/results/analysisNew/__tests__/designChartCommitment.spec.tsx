/**
 * ⭐⭐⭐ V2 FIDELITY — CHART & COMMITMENT BUNDLE (b2-chart-commitment).
 *
 * Pins the five HIGH-severity gaps from the panel-lane design audit
 * (panel-lane/design-audit-20260925, bundle-b2-chart-commitment.json):
 *
 *   CHART-1  the range band is opaque-based with an option tint, not a
 *            translucent fill over the beige track (so CHART-2's hairline
 *            cannot show through its middle).
 *   CHART-2  the range track is a 1px hairline, not a 5px slab the same
 *            height as the band — so the row reads as a range, not a slider.
 *   SPACE-3  same track/band geometry, PLUS the plot is inset from the
 *            option name and the chevron column (ml-4 mr-5).
 *   CHART-3  a withheld run that DOES carry ranges shows no "-no-figures"
 *            denial (that sentence is reserved for a row that truly shows
 *            nothing), and the commitment synthesis still states the
 *            withhold cause in its "Still open" bullet.
 *   FIRST-1  the option-origin legend and the range info button share ONE
 *            row, and the qualifier beside the chart is body ink, not
 *            tertiary grey — saving the vertical space that used to push
 *            "Provisional…" below the 1440 fold.
 *
 * Every assertion binds by IDENTITY (a data-testid plus the token/class that
 * makes the fix real), never by a value predicate, per this bundle's method.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { OptionsComparison } from '../sections/OptionsComparison'
import { buildNodeOriginMap } from '../optionOriginDisclosure'
import { useStrengthenStore } from '../../../../canvas/stores/strengthenStore'
import { PanelFigure } from '../PanelFigure'
import { outcomeRangeScale } from '../comparisonLens'
import { buildCommitmentQualifier } from '../commitmentQualifier'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import {
  decisionWithLeaderWithheld,
  decisionWithLeaderWithheldAndReason,
  makeData,
  makeOption,
} from './analysisNewFixtures'

const T = 'analysis-new-options'

const renderBody = (data: ResultsSectionDataReturn) =>
  render(
    <AnalysisNewTabBody
      resultsSectionData={data}
      isPreRun={false}
      isRunning={false}
      isStale={false}
      responseHash="run_design_chart_commitment"
    />,
  )

function vmFor(data: ResultsSectionDataReturn) {
  return buildAnalysisNewViewModel({
    data,
    recommendations: [],
    isPreRun: false,
    isRunning: false,
    isStale: false,
  })
}

/** Same shape `theWithheldRunShowsItsFigures.spec.tsx` uses: real p10/p50/p90s. */
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

function row(optionId: string): HTMLElement {
  const el = document.querySelector<HTMLElement>(`[data-option-id="${optionId}"]`)
  if (!el) throw new Error(`no row for option id ${optionId}`)
  return el
}

beforeEach(() => {
  useStrengthenStore.setState({ records: {}, priorityOrder: [] } as never)
})
afterEach(() => cleanup())

// ═══════════════════════════════════════════════════════════════════════════
describe('CHART-1 / SPACE-3 — the band is opaque-based, tinted, never translucent over the track', () => {
  it('the band element is opaque (bg-panel) and its child carries the option tint + ring', () => {
    render(
      <PanelFigure
        variant="range"
        band={{ start: 0.2, end: 0.6, marker: 0.4 }}
        testId="fig"
      />,
    )
    const band = screen.getByTestId('fig-band')
    // ⚠ IDENTITY, NOT A VALUE PREDICATE: an opaque base is what stops CHART-2's
    // centred hairline showing through a translucent middle.
    expect(band.classList.contains('bg-panel'), 'the band OUTER span must be opaque').toBe(true)
    expect(band.classList.contains('bg-option/20'), 'the old translucent fill must be gone').toBe(false)

    const tint = band.firstElementChild as HTMLElement | null
    expect(tint, 'the band must carry an inner tint layer').not.toBeNull()
    expect(tint!.classList.contains('bg-option/40')).toBe(true)
    expect(tint!.classList.contains('ring-option/70')).toBe(true)

    // `left` stays on the OUTER span: optionsComparisonFigure.spec asserts it there.
    expect(band.style.left).toBe('20%')
  })
})

describe('CHART-2 / SPACE-3 — the track is a hairline, not a beige slab the band\'s own height', () => {
  it('the outer track keeps the shared grammar height/radius, with no track-tone fill of its own', () => {
    render(<PanelFigure variant="range" band={{ start: 0.2, end: 0.6 }} testId="fig" />)
    const track = screen.getByTestId('fig')
    // Rule 3 (oneFigureGrammar): the outer element still carries the shared
    // height/radius tokens — SPACE-3 does not touch that.
    expect(track.classList.contains('h-[5px]')).toBe(true)
    expect(track.classList.contains('rounded-full')).toBe(true)
    // ⛔ THE DEFECT: a beige slab painted directly on the track itself.
    expect(
      track.classList.contains('bg-panel-border'),
      'the track itself must carry no fill — only the hairline child does',
    ).toBe(false)
  })

  it('draws a centred 1px hairline as a child, before the band', () => {
    render(<PanelFigure variant="range" band={{ start: 0.2, end: 0.6 }} testId="fig" />)
    const track = screen.getByTestId('fig')
    const hairline = track.firstElementChild as HTMLElement | null
    expect(hairline, 'the hairline must be the first child, under the band').not.toBeNull()
    expect(hairline!.classList.contains('bg-panel-border')).toBe(true)
    expect(hairline!.classList.contains('h-px'), 'a 1px line, not a 5px slab').toBe(true)
    expect(hairline).toHaveAttribute('aria-hidden', 'true')
  })
})

describe('SPACE-3 — the plot is inset from the option name and the chevron column', () => {
  it('the outcome-range figure carries the shared 16px/20px inset', () => {
    renderBody(withRanges(decisionWithLeaderWithheld()))
    const track = within(row('opt_a')).getByTestId(`${T}-outcome-range-opt_a`)
    expect(track.classList.contains('ml-4'), 'clears the name column').toBe(true)
    expect(track.classList.contains('mr-5'), 'clears the chevron column').toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
/** Withheld, AND no win share on any row — the state the fix is actually for. */
const withheldWithRangesNoWinShare = (): ResultsSectionDataReturn => {
  const base = decisionWithLeaderWithheld()
  const noWinShares: ResultsSectionDataReturn = {
    ...base,
    recommendation: {
      ...base.recommendation,
      allOptions: base.recommendation.allOptions.map((o) => ({ ...o, winProbability: undefined })),
    },
  }
  return withRanges(noWinShares)
}

describe('CHART-3 — a withheld run that draws ranges is not told it has no figures', () => {
  it('no "-no-figures" denial where ranges are on screen, and the withhold cause still states', () => {
    const data = withheldWithRangesNoWinShare()
    const vm = vmFor(data)

    // PRECONDITIONS: really withheld, and really carrying nothing numbered
    // (winReadout), yet really drawing ranges.
    expect(vm.checks.leaderWithheld, 'precondition: this run withholds the leader').toBe(true)
    expect(
      vm.optionsComparison.rows.every((r) => r.kind !== 'analysed' || r.winReadout === null),
      'precondition: no row carries a win readout',
    ).toBe(true)
    expect(
      outcomeRangeScale(vm.optionsComparison.rows) !== null,
      'precondition: the outcome lens has ranges to draw',
    ).toBe(true)

    renderBody(data)

    // ⛔ THE FIX: the denial is reserved for a row that TRULY shows nothing.
    expect(
      screen.queryByTestId(`${T}-no-figures`),
      'a withheld run that draws ranges must not be told its rows show no figures',
    ).toBeNull()
    expect(within(row('opt_a')).getByTestId(`${T}-outcome-range-opt_a-band`)).toBeInTheDocument()

    // ⭐ AND THE CAUSE MUST STILL BE ON SCREEN — in the synthesis, uncertainty
    // beside the chart is stated, never silently dropped.
    const openBullet = screen.getByTestId('analysis-new-commitment-open')
    expect(openBullet.textContent, 'the withhold sentence must survive in "Still open"').not.toBe('')
  })

  it('CONTRAST: a withheld run with genuinely NO figures still gets the denial', () => {
    const base = decisionWithLeaderWithheld()
    const data: ResultsSectionDataReturn = {
      ...base,
      recommendation: {
        ...base.recommendation,
        allOptions: base.recommendation.allOptions.map((o) => ({ ...o, winProbability: undefined })),
      },
    }
    renderBody(data)
    expect(
      screen.getByTestId(`${T}-no-figures`),
      'a row that truly shows nothing must still say so',
    ).toBeInTheDocument()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('FIRST-1 (V2 revision) — the axis owns its full row; the legend reads beneath it; the qualifier is body ink', () => {
  it('the axis row carries the ticks and the range-info button; the origin legend is a separate line below it', () => {
    // V2 (25 Sep served check at 280px): sharing one row crushed the legend and
    // bunched the ticks. The axis now spans the chart width; the legend follows.
    // Two options sharing an origin (so the legend renders) that ALSO carry
    // ranges on a shared domain (so the axis/range-info button renders).
    const options = [
      makeOption({ id: 'opt_a', label: 'Option A', winProbability: 0.6, outcome: RANGES.opt_a }),
      makeOption({ id: 'opt_b', label: 'Option B', winProbability: 0.4, outcome: RANGES.opt_b }),
    ]
    const vm = buildAnalysisNewViewModel({
      data: makeData({ recommendation: { allOptions: options } }),
      recommendations: [],
      isPreRun: false,
      isRunning: false,
      isStale: false,
      nodeOrigins: buildNodeOriginMap([
        { id: 'opt_a', data: { kind: 'option', provenance: 'ai_inferred' } },
        { id: 'opt_b', data: { kind: 'option', provenance: 'ai_inferred' } },
      ]),
    })
    render(<OptionsComparison options={vm.optionsComparison} />)
    fireEvent.click(screen.getByTestId(`${T}-toggle`))

    const axis = screen.getByTestId(`${T}-axis`)
    const legend = screen.getByTestId(`${T}-option-origin-legend`)
    expect(axis.contains(legend), 'the legend is not squeezed into the axis row').toBe(false)
    expect(
      axis.compareDocumentPosition(legend) & Node.DOCUMENT_POSITION_FOLLOWING,
      'the legend reads after the axis',
    ).toBeTruthy()
    expect(axis.querySelector('button'), 'the range-info button sits on the axis row').not.toBeNull()
  })

  it('the chart qualifier is body ink, not tertiary grey', () => {
    const data = decisionWithLeaderWithheldAndReason()
    const vm = vmFor(data)
    expect(
      buildCommitmentQualifier(vm),
      'precondition: this fixture licenses a qualifier line',
    ).not.toBeNull()
    renderBody(data)
    const qualifier = screen.getByTestId('analysis-new-commitment-qualifier')
    expect(qualifier.classList.contains('text-text-body'), 'V2: the qualifier reads as part of the argument').toBe(true)
    expect(qualifier.classList.contains('text-text-light'), 'the old tertiary-grey ink must be gone').toBe(false)
  })
})
