/**
 * Reasoning V2 — the grounded signals under "Challenge the thinking".
 *
 * Every rule below is bound by IDENTITY (factor key, finding id, node id, the
 * exact copy constant), each has a contrast control in the same run, and the
 * view models are the builder's own output over the shared fixtures — never a
 * hand-shaped view model.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'

import { ReasoningSignals } from '../sections/ReasoningSignals'
import { buildReasoningSignals, SIGNAL_DRIVER_COUNT } from '../reasoningSignals'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'
import { CHALLENGE_ZONE_COPY as ZONE } from '../challengeZoneCopy'
import { ASSUMPTIONS_DOOR_COPY as DOOR } from '../assumptionsDoorCopy'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import type { VoiRanking } from '../../voi/voiRanking'
import { evidenceGapWithNullConfidence, genuineDecision, highUncertainty, makeData, makeDriver } from './analysisNewFixtures'

afterEach(cleanup)

const vmOf = (data: ResultsSectionDataReturn, isPreRun = false) =>
  buildAnalysisNewViewModel({ data, recommendations: [], isPreRun, isRunning: false, isStale: false })

/** Paul's run `1dd2133d`, verbatim (also the corpus of `theTippingPointRenders`). */
const REAL_FLIP_ROWS = [
  {
    label: 'Tech Lead Presence',
    node_id: '3457913d',
    current_value: 0.6,
    flip_value: 0.9619,
    alternative_winner_label: 'Two Developers',
    flip_reason: 'found',
  },
  { label: 'Additional Developer Headcount', node_id: '634c5855', current_value: 1.2, flip_value: null, flip_reason: 'no_effect_within_bounds' },
  { label: 'Hiring and Onboarding Cost', node_id: '7809def4', current_value: 93000, flip_value: null, flip_reason: 'structurally_invariant' },
]

const withFlips = (data: ResultsSectionDataReturn, rows: unknown): ResultsSectionDataReturn =>
  ({ ...data, recommendation: { ...data.recommendation, flipThresholds: rows } }) as ResultsSectionDataReturn

/** Four drivers, deliberately NOT in influence order on the wire. */
const fourDrivers = () =>
  makeData({
    drivers: {
      drivers: [
        makeDriver({ factorKey: 'f_d', factorLabel: 'Delta', displayInfluence: 0.1, influenceRank: 4 }),
        makeDriver({ factorKey: 'f_a', factorLabel: 'Alpha', displayInfluence: 1, influenceRank: 1 }),
        makeDriver({ factorKey: 'f_c', factorLabel: 'Charlie', displayInfluence: 0.3, influenceRank: 3, canFocus: false }),
        makeDriver({ factorKey: 'f_b', factorLabel: 'Bravo', displayInfluence: 0.6, influenceRank: 2 }),
      ],
    },
  })

/** The witnessed suppression shape: three of five withheld, survivors ranked 3 and 5. */
const threeWithheldOfFive = () =>
  makeData({
    drivers: {
      driversStatus: 'computed',
      drivers: [
        makeDriver({ factorKey: 'f_pin_1', factorLabel: 'Pinned A', rank: 1, displayInfluence: 1, zeroReason: 'intervention_override' }),
        makeDriver({ factorKey: 'f_pin_2', factorLabel: 'Pinned B', rank: 2, displayInfluence: 0.8, zeroReason: 'intervention_override' }),
        makeDriver({ factorKey: 'f_pin_4', factorLabel: 'Pinned C', rank: 4, displayInfluence: 0.3, zeroReason: 'intervention_override' }),
        makeDriver({ factorKey: 'f_top', factorLabel: 'Top Account Revenue Concentration', rank: 3, displayInfluence: 0.6 }),
        makeDriver({ factorKey: 'f_comp', factorLabel: 'Competitive Pressure', rank: 5, displayInfluence: 0.01 }),
      ],
    },
  })

const driverRows = () => screen.getAllByTestId('analysis-new-signals-driver')

describe('drivers: the top three, the producer’s rank, a bar and no percentage', () => {
  it('shows exactly the top three by influence, in the view model’s order', () => {
    const vm = vmOf(fourDrivers())
    render(<ReasoningSignals vm={vm} flipThresholds={null} />)
    expect(SIGNAL_DRIVER_COUNT).toBe(3)
    expect(driverRows().map((r) => r.getAttribute('data-factor-id'))).toEqual(['f_a', 'f_b', 'f_c'])
    // CONTRAST: the run has a fourth driver, so the cap is doing the work.
    expect(vm.drivers.influenceRows.map((r) => r.id)).toContain('f_d')
  })

  it('⛔ prints no percentage, although the same run’s prose list does', () => {
    const vm = vmOf(fourDrivers())
    // CONTRAST (same run): the Drivers section's own implication carries one,
    // so a "%"-free render is a property of this component, not of the data.
    expect(vm.drivers.findings.map((f) => f.implication).join(' ')).toMatch(/%/)
    render(<ReasoningSignals vm={vm} flipThresholds={null} />)
    expect(screen.getByTestId('analysis-new-signals-drivers').textContent).not.toMatch(/%/)
  })

  it('draws each bar at the view model’s own fraction (magnitude / strongest)', () => {
    const vm = vmOf(fourDrivers())
    render(<ReasoningSignals vm={vm} flipThresholds={null} />)
    const widths = screen
      .getAllByTestId('analysis-new-signals-driver-bar-fill')
      .map((f) => parseFloat(f.style.width))
    const expected = vm.drivers.influenceRows.slice(0, 3).map((r) => r.fraction * 100)
    expect(widths).toHaveLength(3)
    widths.forEach((w, i) => expect(w).toBeCloseTo(expected[i], 6))
    expect(widths[0]).toBe(100)
    // Discriminating: the three bars differ, so a constant width would fail.
    expect(new Set(widths.map((w) => w.toFixed(3))).size).toBe(3)
  })

  it('⭐ the rank is the producer’s, never the row’s position (#3, not #1)', () => {
    const vm = vmOf(threeWithheldOfFive())
    // PRECONDITION: three rows really were withheld, so position and rank differ.
    expect(vm.drivers.suppressedZeroCount).toBe(3)
    render(<ReasoningSignals vm={vm} flipThresholds={null} />)
    const ranks = screen.getAllByTestId('analysis-new-signals-driver-rank').map((r) => r.textContent)
    expect(ranks).toEqual(['#3', '#5'])
  })

  it('CONTRAST: with nothing withheld the top driver reads #1', () => {
    render(<ReasoningSignals vm={vmOf(fourDrivers())} flipThresholds={null} />)
    expect(screen.getAllByTestId('analysis-new-signals-driver-rank')[0]).toHaveTextContent('#1')
  })

  it('carries the existing scale note verbatim, behind one info control', () => {
    render(<ReasoningSignals vm={vmOf(fourDrivers())} flipThresholds={null} />)
    const info = screen.getByRole('button', { name: COPY.coverage.setRelativeInfluence })
    expect(screen.queryByTestId('analysis-new-signals-scale-note')).toBeNull()
    fireEvent.click(info)
    expect(screen.getByTestId('analysis-new-signals-scale-note')).toHaveTextContent(COPY.coverage.setRelativeInfluence)
  })
})

describe('row actions: only on a row that names a model element', () => {
  it('⭐ V2: a focusable driver\'s NAME opens its review, and its ✦ asks about ITS node — one act per purpose', () => {
    const onFocus = vi.fn()
    const onInspect = vi.fn()
    const onAsk = vi.fn()
    render(<ReasoningSignals vm={vmOf(fourDrivers())} flipThresholds={null} onFocus={onFocus} onInspect={onInspect} onAsk={onAsk} />)
    const alpha = driverRows()[0]
    fireEvent.click(within(alpha).getByRole('button', { name: 'Alpha' }))
    expect(onInspect).toHaveBeenCalledWith('f_a')
    fireEvent.click(within(alpha).getByRole('button', { name: DOOR.askDriver }))
    expect(onAsk).toHaveBeenCalledTimes(1)
    const payload = onAsk.mock.calls[0][0]
    // The draft asks what the ✦ promises (#2068 review note 2).
    expect(payload).toMatchObject({ targetId: 'f_a', draft: DOOR.askDriverDraft('Alpha'), label: COPY.disclosure.askOlumi })
    expect(payload.draft).toBe('Why does Alpha matter so much in this model?')
    // The full name is the tooltip's first words (the name is truncated).
    expect(within(alpha).getByRole('button', { name: 'Alpha' }).getAttribute('title')).toBe(`Alpha · ${DOOR.reviewDriver}`)
    // The ask must not carry back the percentage the row refuses to print.
    expect(payload.context).toBe(COPY.coverage.setRelativeInfluence)
    // The ask is the AI act and wears the AI icon.
    expect(within(alpha).getByRole('button', { name: DOOR.askDriver })).toHaveAttribute('data-ai', 'true')
    // No crosshair or search on the row any more.
    expect(within(alpha).queryByRole('button', { name: COPY.disclosure.focusTarget })).toBeNull()
    expect(within(alpha).queryByRole('button', { name: ZONE.inspectInModel })).toBeNull()
    expect(onFocus).not.toHaveBeenCalled()
  })

  it('⭐ V2 row grid: rank · name · a 55px bar · ✦, in that order', () => {
    render(<ReasoningSignals vm={vmOf(fourDrivers())} flipThresholds={null} onInspect={vi.fn()} onAsk={vi.fn()} />)
    const alpha = driverRows()[0]
    expect(alpha.className.split(/\s+/)).toContain('grid-cols-[20px_minmax(0,1fr)_55px_28px]')
    const cells = [...alpha.children] as HTMLElement[]
    expect(cells.map((c) => c.dataset.testid)).toEqual([
      'analysis-new-signals-driver-rank',
      'analysis-new-signals-driver-name',
      'analysis-new-signals-driver-bar-slot',
      'analysis-new-signals-driver-ask',
    ])
    expect(cells[2].className.split(/\s+/)).toContain('w-[55px]')
  })

  it('with no review handler the name falls back to focus', () => {
    const onFocus = vi.fn()
    render(<ReasoningSignals vm={vmOf(fourDrivers())} flipThresholds={null} onFocus={onFocus} />)
    fireEvent.click(within(driverRows()[0]).getByRole('button', { name: 'Alpha' }))
    expect(onFocus).toHaveBeenCalledWith('f_a')
  })

  it('⛔ a driver the canvas cannot focus shows NO actions (contrast: its neighbours do)', () => {
    render(<ReasoningSignals vm={vmOf(fourDrivers())} flipThresholds={null} onFocus={vi.fn()} onInspect={vi.fn()} onAsk={vi.fn()} />)
    const [alpha, bravo, charlie] = driverRows()
    expect(charlie).toHaveAttribute('data-factor-id', 'f_c')
    expect(within(charlie).queryAllByRole('button')).toHaveLength(0)
    expect(within(alpha).getAllByRole('button')).toHaveLength(2)
    expect(within(bravo).getAllByRole('button')).toHaveLength(2)
  })

  it('⭐ V2 kicker: "Driver order in this model" (a stale run says it is the last run\'s order)', () => {
    render(<ReasoningSignals vm={vmOf(fourDrivers())} flipThresholds={null} />)
    expect(screen.getByTestId('analysis-new-signals-drivers-kicker')).toHaveTextContent(DOOR.kicker)
    cleanup()
    const stale = buildAnalysisNewViewModel({ data: fourDrivers(), recommendations: [], isPreRun: false, isRunning: false, isStale: true })
    render(<ReasoningSignals vm={stale} flipThresholds={null} />)
    expect(screen.getByTestId('analysis-new-signals-drivers-kicker')).toHaveTextContent(DOOR.kickerStale)
  })
})

describe('the tipping point: the STRICT gate, one row, the existing sentence', () => {
  it('states the found threshold in the existing sentence and points at its node', () => {
    const data = withFlips(fourDrivers(), REAL_FLIP_ROWS)
    const vm = vmOf(data)
    const onFocus = vi.fn()
    render(<ReasoningSignals vm={vm} flipThresholds={data.recommendation.flipThresholds} onFocus={onFocus} />)
    const t = vm.sensitivity.tippingPoints[0]
    // The SAME sentence the Sensitivity section renders for the same row.
    expect(screen.getByTestId('analysis-new-signals-tipping-sentence').textContent).toBe(
      COPY.disclosure.tippingPoint(t.factorLabel, t.currentValue, t.flipValue, t.alternativeLabel, t.unit),
    )
    expect(screen.getByTestId('analysis-new-signals-tipping')).toHaveAttribute('data-target-id', '3457913d')
    fireEvent.click(
      within(screen.getByTestId('analysis-new-signals-tipping')).getByRole('button', { name: COPY.disclosure.focusTarget }),
    )
    expect(onFocus).toHaveBeenCalledWith('3457913d')
  })

  it('⛔ a row only the LOOSER glance gate admits does not reach this zone', () => {
    // No `flip_reason` at all: `glanceCondition` admits it (undefined is allowed
    // there), the strict gate requires 'found'.
    //
    // ⚠ ON A PERMITTED RUN, AND THAT IS WHAT KEEPS THE CONTRAST ABOUT `flip_reason`.
    // The glance condition is LEADER-GATED in the view model (24 Sep 2026), and
    // this zone's tipping row is leader-gated at its mount (`AnalysisNewTabBody`
    // passes `flipThresholds` only when permitted). On a withheld run the glance
    // would be silent for the licence's sake, and the strict-vs-loose
    // difference this case exists to pin would never be exercised.
    const loose = [{ label: 'Tech Lead Presence', node_id: '3457913d', current_value: 0.6, flip_value: 0.9619, alternative_winner_label: 'Two Developers' }]
    const permitted = fourDrivers()
    const data = withFlips(
      {
        ...permitted,
        recommendation: {
          ...permitted.recommendation,
          leaderDesignationPermitted: true,
          verdict: genuineDecision().recommendation.verdict,
        },
      },
      loose,
    )
    const vm = vmOf(data)
    expect(vm.leaderClaimPermitted, 'precondition: the licence is granted, so only the gate SHAPE differs').toBe(true)
    // CONTRAST (same run): the looser gate really does fire on this row.
    expect(vm.atAGlance.condition).not.toBeNull()
    expect(vm.sensitivity.tippingPoints).toHaveLength(0)
    render(<ReasoningSignals vm={vm} flipThresholds={data.recommendation.flipThresholds} />)
    expect(screen.queryByTestId('analysis-new-signals-tipping')).toBeNull()
  })

  it('shows ONE row even when the run found two', () => {
    const second = { ...REAL_FLIP_ROWS[0], label: 'Onboarding Time', node_id: 'n_onb', current_value: 3, flip_value: 5 }
    const data = withFlips(fourDrivers(), [REAL_FLIP_ROWS[0], second])
    expect(vmOf(data).sensitivity.tippingPoints).toHaveLength(2)
    render(<ReasoningSignals vm={vmOf(data)} flipThresholds={data.recommendation.flipThresholds} />)
    expect(screen.getAllByTestId('analysis-new-signals-tipping')).toHaveLength(1)
    expect(screen.getByTestId('analysis-new-signals-tipping')).toHaveAttribute('data-target-id', '3457913d')
  })

  it('a found row with no node id renders the sentence and no actions', () => {
    const noId = [{ ...REAL_FLIP_ROWS[0], node_id: '' }]
    const data = withFlips(makeData(), noId)
    render(<ReasoningSignals vm={vmOf(data)} flipThresholds={data.recommendation.flipThresholds} onFocus={vi.fn()} onAsk={vi.fn()} />)
    expect(screen.getByTestId('analysis-new-signals-tipping-sentence')).toBeInTheDocument()
    expect(within(screen.getByTestId('analysis-new-signals-tipping')).queryAllByRole('button')).toHaveLength(0)
  })
})

const voiRanking = (resolved: Array<{ factorId: string; label: string }>): VoiRanking => ({
  resolved: resolved.map((r) => ({ ...r, canFocus: true, valueAffordance: 'review' as const })),
  belowResolution: [],
  someFactorsUnassessed: false,
})

describe('one assumption or evidence gap, by the builder’s own order', () => {
  it('an evidence gap: the finding’s own headline, detail and target', () => {
    const vm = vmOf(evidenceGapWithNullConfidence())
    const onInspect = vi.fn()
    render(<ReasoningSignals vm={vm} flipThresholds={null} onInspect={onInspect} />)
    const gap = screen.getByTestId('analysis-new-signals-gap')
    expect(gap).toHaveAttribute('data-finding-id', 'gap:f_churn')
    const finding = vm.uncertainty.findings.find((f) => f.id === 'gap:f_churn')!
    expect(screen.getByTestId('analysis-new-signals-gap-headline').textContent).toBe(finding.headline)
    expect(screen.getByTestId('analysis-new-signals-gap-detail').textContent).toBe(finding.implication)
    // ⭐ V2: ONE text act, "Examine that assumption", opens its review.
    fireEvent.click(within(gap).getByRole('button', { name: DOOR.examine }))
    expect(onInspect).toHaveBeenCalledWith('f_churn')
    expect(within(gap).queryByRole('button', { name: ZONE.inspectInModel })).toBeNull()
    expect(within(gap).queryByRole('button', { name: COPY.disclosure.focusTarget })).toBeNull()
  })

  it('⭐ V2: the gap\'s ✦ sits on the headline\'s own line and asks how to investigate it', () => {
    const onAsk = vi.fn()
    render(<ReasoningSignals vm={vmOf(evidenceGapWithNullConfidence())} flipThresholds={null} onInspect={vi.fn()} onAsk={onAsk} />)
    const headline = screen.getByTestId('analysis-new-signals-gap-headline')
    const ask = screen.getByTestId('analysis-new-signals-gap-ask')
    expect(ask.parentElement).toBe(headline.parentElement)
    expect(ask).toHaveAttribute('aria-label', DOOR.askGap)
    fireEvent.click(ask)
    expect(onAsk).toHaveBeenCalledTimes(1)
  })

  it('⭐ the value-of-information lead comes first when the run ranked one — the builder’s order, not ours', () => {
    const base = evidenceGapWithNullConfidence()
    const data = { ...base, voiRanking: voiRanking([{ factorId: 'f_lead', label: 'Lead time' }]) } as ResultsSectionDataReturn
    const vm = vmOf(data)
    // PRECONDITION: both kinds are present, VoI first in the view model.
    expect(vm.uncertainty.findings.map((f) => f.id)).toEqual(['voi:f_lead', 'gap:f_churn'])
    render(<ReasoningSignals vm={vm} flipThresholds={null} />)
    expect(screen.getByTestId('analysis-new-signals-gap')).toHaveAttribute('data-finding-id', 'voi:f_lead')
    expect(screen.getAllByTestId('analysis-new-signals-gap')).toHaveLength(1)
  })

  it('⛔ "nothing above resolution" is not a gap; the next real one is chosen', () => {
    const base = evidenceGapWithNullConfidence()
    const data = { ...base, voiRanking: voiRanking([]) } as ResultsSectionDataReturn
    const vm = vmOf(data)
    expect(vm.uncertainty.findings[0].id).toBe('voi:none-above-resolution')
    render(<ReasoningSignals vm={vm} flipThresholds={null} />)
    expect(screen.getByTestId('analysis-new-signals-gap')).toHaveAttribute('data-finding-id', 'gap:f_churn')
  })

  it('no assumption or gap in the run ⇒ no gap row (contrast: drivers still render)', () => {
    const vm = vmOf(highUncertainty())
    expect(vm.uncertainty.findings.filter((f) => /^(voi:|gap:|assumption:|uncertainty:assumed-strength:)/.test(f.id))).toHaveLength(0)
    render(<ReasoningSignals vm={vm} flipThresholds={null} />)
    expect(screen.queryByTestId('analysis-new-signals-gap')).toBeNull()
    expect(screen.getAllByTestId('analysis-new-signals-driver')).toHaveLength(1)
  })
})

describe('renders nothing when there is nothing grounded', () => {
  it('⛔ pre-run renders nothing, even when flip rows are handed in', () => {
    const data = withFlips(fourDrivers(), REAL_FLIP_ROWS)
    const { container } = render(<ReasoningSignals vm={vmOf(data, true)} flipThresholds={data.recommendation.flipThresholds} />)
    expect(container).toBeEmptyDOMElement()
    // CONTRAST: the same data after a run renders the tipping row.
    expect(buildReasoningSignals(vmOf(data, false), data.recommendation.flipThresholds)?.tipping).not.toBeNull()
  })

  it('an empty run renders nothing at all — no kicker, no furniture', () => {
    const { container } = render(<ReasoningSignals vm={vmOf(makeData())} flipThresholds={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})
