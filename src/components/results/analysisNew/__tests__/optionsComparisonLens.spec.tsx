/**
 * "HOW THE OPTIONS COMPARE" V2 — TWO LENSES, NO WIN SHARES AT REST, AND ROW
 * ACTIONS THE HOST SUPPLIES.
 *
 * What this pins, each with a contrast in the same file:
 *
 *  1. THE LENSES. "Modelled outcome" draws each option's own range; "Goal fit"
 *     draws each option's goal figure. Only one is shown at a time; switching
 *     moves the figures and NEVER the row order.
 *  2. GOAL FIT LOCKED, not hidden, when the view model sent no goal figures:
 *     `aria-disabled`, a Lucide lock, the reason reachable by a screen reader,
 *     and a click that changes nothing. Its contrast is the same arm, unlocked,
 *     on a run that carries goal figures.
 *  3. THE WIN SHARES ARE GONE AT REST: no readout, no label, no bar, no
 *     partition, in either lens, on a run whose view model carries shares that
 *     partition exactly (so the absence is the section's, not the fixture's).
 *  4. THE EXPLANATION MOVED: the range legend and the range-arm control are off
 *     the resting view, behind an info button whose name IS the legend.
 *  5. THE GOAL-ONLY QUALIFIER (#1922) sits above whichever lens is shown.
 *  6. ROW ACTIONS: none without handlers (the name keeps its canvas act); with
 *     handlers, the name opens at most three actions, each bound to its row.
 *
 * ⚠ EVERY RUN GOES THROUGH THE REAL VIEW MODEL (`buildAnalysisNewViewModel`),
 * so the goal gates (UI-SEM-071, the complete-field rule) are the builder's and
 * not a hand-written section's.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn(() => true) }))
vi.mock('../../../../canvas/nodes/shared/openNodeInspector', () => ({ openNodeInspector: vi.fn() }))

import { focusModelTarget } from '../../../../canvas/utils/focusHelpers'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { OptionsComparison, type OptionsComparisonProps } from '../sections/OptionsComparison'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'
import {
  COMPARISON_LENS_COPY as LENS_COPY,
  comparisonDrawsAFigure,
  comparisonLensAvailability,
} from '../comparisonLens'
import { GOAL_FIT_BASIS_CAVEAT_COPY } from '../../utils/goalFitBasisCaveatCopy'
import type { OptionResult } from '../../types'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import { decisionWithLeaderWithheld, makeData, makeOption } from './analysisNewFixtures'

const T = 'analysis-new-options'

beforeEach(() => {
  vi.mocked(focusModelTarget).mockClear()
})
afterEach(() => cleanup())

/**
 * Three options in an order that NO figure sorts them into: by win share the
 * order would be B, C, A; by goal A, C, B; by p50 C, A, B. A lens that
 * re-sorted by its own figure would change the order, whichever lens it is.
 * Win shares sum to exactly 1, so a partition WOULD have drawn before V2.
 */
const RANGES = {
  opt_a: { mean: 40, p10: 20, p50: 40, p90: 60 },
  opt_b: { mean: 30, p10: 0, p50: 30, p90: 80 },
  opt_c: { mean: 70, p10: 50, p50: 70, p90: 100 },
} as const
const GOALS = { opt_a: 0.82, opt_b: 0.12, opt_c: 0.44 } as const
const WINS = { opt_a: 0.1, opt_b: 0.6, opt_c: 0.3 } as const
const LABELS = { opt_a: 'Hire a tech lead', opt_b: 'No new hire', opt_c: 'Contract help' } as const
type Id = keyof typeof LABELS
const IDS: Id[] = ['opt_a', 'opt_b', 'opt_c']

function options({ ranges = true, goals = true }: { ranges?: boolean; goals?: boolean }): OptionResult[] {
  return IDS.map((id) =>
    makeOption({
      id,
      label: LABELS[id],
      winProbability: WINS[id],
      nValidSamples: 10000,
      ...(ranges ? { outcome: RANGES[id] } : {}),
      ...(goals ? { goalProbability: GOALS[id], goalFitIsModelledBasis: true } : {}),
    }),
  )
}

function dataFor(opts: { ranges?: boolean; goals?: boolean }): ResultsSectionDataReturn {
  const allOptions = options(opts)
  return makeData({
    recommendation: {
      allOptions,
      recommendedOption: null,
      // UI-SEM-071: a goal figure exists only against a target the USER set.
      ...(opts.goals === false ? {} : { goalThreshold: 20000 }),
    },
  })
}

function vmFor(data: ResultsSectionDataReturn, producerLeaderWithholdReason: string | null = null) {
  return buildAnalysisNewViewModel({
    data,
    producerLeaderWithholdReason,
    recommendations: [],
    isPreRun: false,
    isRunning: false,
    isStale: false,
  } as never)
}

function renderRun(
  data: ResultsSectionDataReturn,
  props: Partial<OptionsComparisonProps> = {},
) {
  const vm = vmFor(data)
  render(<OptionsComparison options={vm.optionsComparison} defaultOpen {...props} />)
  return vm
}

const lensArm = (arm: 'outcome' | 'goal') => screen.getByTestId(`${T}-lens-${arm}`)
const rowIds = () =>
  screen.getAllByTestId(`${T}-row`).map((li) => li.getAttribute('data-option-id'))
const row = (id: string) => {
  const el = document.querySelector<HTMLElement>(`[data-option-id="${id}"]`)
  if (!el) throw new Error(`no row for ${id}`)
  return el
}
const bandsDrawn = () =>
  IDS.filter((id) => screen.queryByTestId(`${T}-outcome-range-${id}-band`) !== null)
const goalReadouts = () =>
  IDS.map((id) => within(row(id)).queryByTestId(`${T}-goal`)?.textContent ?? null)
/** `a` comes before `b` in document order. */
const precedes = (a: Element, b: Element) =>
  Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)

// ═══════════════════════════════════════════════════════════════════════════
describe('the two lenses', () => {
  it('PRECONDITION: the three fixtures reach three different lens availabilities', () => {
    expect(comparisonLensAvailability(vmFor(dataFor({})).optionsComparison)).toEqual({ outcome: true, goal: true })
    expect(comparisonLensAvailability(vmFor(dataFor({ goals: false })).optionsComparison)).toEqual({ outcome: true, goal: false })
    expect(comparisonLensAvailability(vmFor(dataFor({ ranges: false })).optionsComparison)).toEqual({ outcome: false, goal: true })
  })

  it('⭐ both available: Goal fit shows first, and Modelled outcome swaps the figures', () => {
    renderRun(dataFor({}))

    expect(lensArm('goal')).toHaveAttribute('aria-checked', 'true')
    expect(lensArm('outcome')).toHaveAttribute('aria-checked', 'false')
    // Goal fit: each option's OWN goal figure, bound by id, and no ranges.
    expect(goalReadouts()).toEqual(['82%', '12%', '44%'])
    expect(screen.getAllByTestId(`${T}-goal-basis-caveat`)[0]).toHaveTextContent(GOAL_FIT_BASIS_CAVEAT_COPY)
    expect(bandsDrawn()).toEqual([])

    fireEvent.click(lensArm('outcome'))

    expect(lensArm('outcome')).toHaveAttribute('aria-checked', 'true')
    expect(lensArm('goal')).toHaveAttribute('aria-checked', 'false')
    // Modelled outcome: every analysed row's own range, and the goal figure
    // leaves WITH its caveat (the caveat never outlives the number it qualifies).
    expect(bandsDrawn()).toEqual(IDS)
    expect(goalReadouts()).toEqual([null, null, null])
    expect(screen.queryAllByTestId(`${T}-goal-basis-caveat`)).toHaveLength(0)
    // Each band marks its OWN p50.
    for (const id of IDS) {
      expect(screen.getByTestId(`${T}-outcome-range-${id}-marker`).getAttribute('data-mark-at')).toBe(
        String(RANGES[id].p50),
      )
    }
  })

  it('⛔ a lens reorders nothing: the row order is the view model’s under both lenses', () => {
    const vm = renderRun(dataFor({}))
    const given = vm.optionsComparison.rows.map((r) => r.id)
    expect(given, 'PRECONDITION: the order no figure produces').toEqual(IDS)
    expect(rowIds()).toEqual(given)
    fireEvent.click(lensArm('outcome'))
    expect(rowIds()).toEqual(given)
    fireEvent.click(lensArm('goal'))
    expect(rowIds()).toEqual(given)
  })

  it('⭐ no goal figures: Goal fit is LOCKED — lock, reason, aria-disabled — and a click changes nothing', () => {
    renderRun(dataFor({ goals: false }))

    const goal = lensArm('goal')
    expect(goal).toHaveAttribute('aria-disabled', 'true')
    expect(within(goal).getByTestId(`${T}-lens-goal-lock`)).toBeInTheDocument()
    // The reason is reachable without a pointer: the arm is DESCRIBED by it.
    const reasonId = goal.getAttribute('aria-describedby')
    expect(reasonId).not.toBeNull()
    expect(document.getElementById(reasonId as string)).toHaveTextContent(LENS_COPY.goalLocked)

    // The outcome lens is what shows, and a click on the locked arm moves nothing.
    expect(lensArm('outcome')).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(goal)
    expect(goal).toHaveAttribute('aria-checked', 'false')
    expect(lensArm('outcome')).toHaveAttribute('aria-checked', 'true')
    expect(bandsDrawn()).toEqual(IDS)
    expect(screen.queryAllByTestId(`${T}-goal`)).toHaveLength(0)
  })

  it('CONTRAST: with goal figures, the same arm carries no lock, no reason and no aria-disabled', () => {
    renderRun(dataFor({}))
    const goal = lensArm('goal')
    expect(goal).not.toHaveAttribute('aria-disabled')
    expect(goal).not.toHaveAttribute('aria-describedby')
    expect(within(goal).queryByTestId(`${T}-lens-goal-lock`)).toBeNull()
    expect(screen.queryByTestId(`${T}-lens-goal-locked-reason`)).toBeNull()
  })

  it('the locked reason names both grounds and none of the contest vocabulary', () => {
    expect(LENS_COPY.goalLocked).toMatch(/target/)
    expect(LENS_COPY.goalLocked).toMatch(/every option/)
    expect(LENS_COPY.goalLocked).not.toMatch(/\b(win|winner|best|lead|ahead|recommend)/i)
    expect(LENS_COPY.goalLocked).not.toContain('—')
  })

  it('arrow keys: onto the locked arm moves FOCUS only; between open arms they select', () => {
    renderRun(dataFor({ goals: false }))
    const outcome = lensArm('outcome')
    expect(outcome).toHaveAttribute('tabindex', '0')
    expect(lensArm('goal')).toHaveAttribute('tabindex', '-1')
    fireEvent.keyDown(outcome, { key: 'ArrowRight' })
    expect(document.activeElement).toBe(lensArm('goal'))
    expect(lensArm('outcome')).toHaveAttribute('aria-checked', 'true')

    cleanup()
    renderRun(dataFor({}))
    fireEvent.keyDown(lensArm('goal'), { key: 'ArrowLeft' })
    expect(lensArm('outcome')).toHaveAttribute('aria-checked', 'true')
    expect(document.activeElement).toBe(lensArm('outcome'))
    fireEvent.keyDown(lensArm('outcome'), { key: 'ArrowRight' })
    expect(lensArm('goal')).toHaveAttribute('aria-checked', 'true')
  })

  it('goal figures but no ranges: no control (one lens, nothing to choose), goal figures shown', () => {
    renderRun(dataFor({ ranges: false }))
    expect(screen.queryByTestId(`${T}-lens`)).toBeNull()
    expect(goalReadouts()).toEqual(['82%', '12%', '44%'])
  })

  it('neither: no control, no figure, no axis, and the host is told there is nothing to draw', () => {
    const data = dataFor({ ranges: false, goals: false })
    const vm = renderRun(data)
    expect(screen.getAllByTestId(`${T}-row`), 'PRECONDITION: the rows still render').toHaveLength(3)
    expect(screen.queryByTestId(`${T}-lens`)).toBeNull()
    expect(screen.queryByTestId(`${T}-axis`)).toBeNull()
    expect(bandsDrawn()).toEqual([])
    expect(comparisonDrawsAFigure(vm.optionsComparison)).toBe(false)
    // Contrast, same helper: a run with ranges does draw.
    expect(comparisonDrawsAFigure(vmFor(dataFor({ goals: false })).optionsComparison)).toBe(true)
  })

  it('a re-run that drops the goal figures cannot leave the section on an empty lens', () => {
    const vm1 = vmFor(dataFor({}))
    const { rerender } = render(<OptionsComparison options={vm1.optionsComparison} defaultOpen />)
    // The reader CHOOSES Goal fit, so the fallback below overrides a choice
    // and not merely a default.
    fireEvent.click(lensArm('goal'))
    expect(lensArm('goal'), 'PRECONDITION: the reader is on Goal fit').toHaveAttribute('aria-checked', 'true')
    const vm2 = vmFor(dataFor({ goals: false }))
    rerender(<OptionsComparison options={vm2.optionsComparison} defaultOpen />)
    expect(lensArm('outcome')).toHaveAttribute('aria-checked', 'true')
    expect(bandsDrawn()).toEqual(IDS)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('⛔ the win shares are not on the resting view', () => {
  it('no readout, label, bar or partition in EITHER lens, though the view model carries shares that partition', () => {
    const vm = renderRun(dataFor({}))
    // PRECONDITION: the shares exist and sum to one, so every win-share
    // presentation the section used to draw WOULD have drawn here.
    const shares = vm.optionsComparison.rows.flatMap((r) => (r.kind === 'analysed' ? [r.winFraction] : []))
    expect(shares).toEqual([0.1, 0.6, 0.3])
    const readouts = vm.optionsComparison.rows.flatMap((r) => (r.kind === 'analysed' ? [r.winReadout] : []))
    expect(readouts).toEqual(['10%', '60%', '30%'])

    for (const arm of ['goal', 'outcome'] as const) {
      fireEvent.click(lensArm(arm))
      const section = screen.getByTestId(T)
      for (const gone of ['win', 'win-label', 'bar', 'partition', 'partition-bar', 'partition-caption']) {
        expect(screen.queryAllByTestId(`${T}-${gone}`), `${arm}: ${gone}`).toHaveLength(0)
      }
      expect(section.textContent ?? '', `${arm}: the share label`).not.toContain(COPY.optionFigures.winLabel)
      for (const r of readouts) {
        expect(section.textContent ?? '', `${arm}: the share ${r}`).not.toContain(r as string)
      }
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('the range explanation left the resting view', () => {
  it('at rest: no legend paragraph and no range-arm control; the info button IS the legend', () => {
    renderRun(dataFor({ goals: false }))
    expect(bandsDrawn(), 'PRECONDITION: the ranges are drawn').toEqual(IDS)
    expect(screen.queryByTestId(`${T}-outcome-range-legend`)).toBeNull()
    expect(screen.queryByTestId(`${T}-range-lens`)).toBeNull()

    const info = screen.getByTestId(`${T}-range-info`)
    expect(info).toHaveAccessibleName(COPY.optionFigures.rangeLegend('middle'))
    expect(info).toHaveAttribute('aria-expanded', 'false')
  })

  it('the info button discloses the legend and the arm control, and its name follows the arm', () => {
    renderRun(dataFor({ goals: false }))
    fireEvent.click(screen.getByTestId(`${T}-range-info`))
    expect(screen.getByTestId(`${T}-range-info`)).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByTestId(`${T}-outcome-range-legend`).textContent).toBe(COPY.optionFigures.rangeLegend('middle'))
    expect(screen.getByTestId(`${T}-range-lens`)).toBeInTheDocument()

    fireEvent.click(screen.getByTestId(`${T}-range-lens-optimistic`))
    fireEvent.click(screen.getByTestId(`${T}-range-info`))
    expect(screen.queryByTestId(`${T}-outcome-range-legend`), 'closed again').toBeNull()
    // The arm persists while closed, so the NAME must follow it: the dot is at p90.
    expect(screen.getByTestId(`${T}-range-info`)).toHaveAccessibleName(COPY.optionFigures.rangeLegend('optimistic'))
    expect(screen.getByTestId(`${T}-outcome-range-opt_a-marker`).getAttribute('data-mark-at')).toBe('60')
  })

  /*
   * ⭐ DESIGN TWEAK C (24 Sep 2026): THE (i) SITS BY THE LENS IT EXPLAINS. It
   * rendered alone at the bottom-right of the comparison, far from the range
   * dots and lines it explains and from the control that switches them on. It
   * now sits inline with the lens control; same button, same name.
   */
  it('RED-FIRST (tweak C): the range info button sits inline with the lens control, and discloses beside it', () => {
    renderRun(dataFor({ goals: false }))
    const lensControl = screen.getByTestId(`${T}-lens-control`)
    const info = screen.getByTestId(`${T}-range-info`)
    expect(lensControl.contains(info), 'the (i) sits with the lens control').toBe(true)
    // It is NOT inside the radio group: it is not a lens.
    expect(within(screen.getByTestId(`${T}-lens`)).queryByTestId(`${T}-range-info`)).toBeNull()
    // Same tooltip text as before the move.
    expect(info).toHaveAccessibleName(COPY.optionFigures.rangeLegend('middle'))
    // And what it discloses opens above the rows, next to the button, not at
    // the foot of the list.
    fireEvent.click(info)
    const detail = screen.getByTestId(`${T}-range-detail`)
    const rows = screen.getByTestId(`${T}-rows`)
    expect(
      detail.compareDocumentPosition(rows) & Node.DOCUMENT_POSITION_FOLLOWING,
      'the disclosed legend precedes the rows',
    ).toBeTruthy()
  })

  it('no info button under the Goal fit lens — a legend for a drawing not on screen is furniture', () => {
    renderRun(dataFor({}))
    expect(lensArm('goal'), 'PRECONDITION').toHaveAttribute('aria-checked', 'true')
    expect(screen.queryByTestId(`${T}-range-info`)).toBeNull()
    fireEvent.click(lensArm('outcome'))
    expect(screen.getByTestId(`${T}-range-info`)).toBeInTheDocument()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('#1922: the goal-only qualifier sits above whichever lens is shown', () => {
  const LIMITS_UNSCORED = 'constraint_verdict_withheld'
  const withheldWithFigures = (): ResultsSectionDataReturn => {
    const base = decisionWithLeaderWithheld()
    return {
      ...base,
      recommendation: {
        ...base.recommendation,
        goalThreshold: 20000,
        allOptions: base.recommendation.allOptions.map((o, i) => ({
          ...o,
          outcome: i === 0 ? RANGES.opt_a : RANGES.opt_b,
          goalProbability: i === 0 ? 0.4 : 0.7,
        })),
      },
    } as ResultsSectionDataReturn
  }

  it('⭐ above the goal figures and above the ranges, on the constraint-withheld run', () => {
    const vm = vmFor(withheldWithFigures(), LIMITS_UNSCORED)
    expect(vm.checks.sharesExcludeLimits, 'PRECONDITION: the run Paul met').toBe(true)
    render(
      <OptionsComparison
        options={vm.optionsComparison}
        leaderWithholdCause={vm.checks.leaderWithholdCause}
        sharesExcludeLimits={vm.checks.sharesExcludeLimits}
        defaultOpen
      />,
    )
    const qualifier = screen.getByTestId(`${T}-goal-only`)
    expect(qualifier).toHaveTextContent(COPY.optionFigures.goalOnlyQualifier)

    const firstGoal = screen.getAllByTestId(`${T}-goal`)[0]
    expect(precedes(qualifier, firstGoal), 'above the goal figures').toBe(true)
    expect(precedes(qualifier, screen.getByTestId(`${T}-lens`)), 'above the lens control').toBe(true)

    fireEvent.click(lensArm('outcome'))
    expect(screen.getByTestId(`${T}-goal-only`)).toBe(qualifier)
    const firstBand = document.querySelector(`[data-testid$="-band"]`) as Element
    expect(firstBand, 'PRECONDITION: ranges drawn').not.toBeNull()
    expect(precedes(qualifier, firstBand), 'above the ranges').toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('row actions', () => {
  it('none supplied: no actions, and the name keeps its canvas act', () => {
    renderRun(dataFor({}))
    const name = within(row('opt_b')).getByTestId(`${T}-focus`)
    expect(name).not.toHaveAttribute('aria-expanded')
    expect(name).toHaveAccessibleName(COPY.canvas.focusOption(LABELS.opt_b))
    fireEvent.click(name)
    expect(focusModelTarget).toHaveBeenCalledWith('opt_b')
    expect(screen.queryByTestId(`${T}-row-actions-opt_b`)).toBeNull()
  })

  it('⭐ all three supplied: the name opens AT MOST three actions, each bound to its own row', () => {
    const onInspectOption = vi.fn()
    const onFocusOption = vi.fn()
    const onAskAboutOption = vi.fn()
    renderRun(dataFor({}), { onInspectOption, onFocusOption, onAskAboutOption })

    const name = within(row('opt_c')).getByTestId(`${T}-focus`)
    expect(name).toHaveAttribute('aria-expanded', 'false')
    expect(name).toHaveAccessibleName(LENS_COPY.rowActions(LABELS.opt_c))
    expect(screen.queryByTestId(`${T}-row-actions-opt_c`), 'closed at rest').toBeNull()

    fireEvent.click(name)
    expect(name).toHaveAttribute('aria-expanded', 'true')
    expect(focusModelTarget, 'the name no longer moves the camera itself').not.toHaveBeenCalled()
    const actions = screen.getByTestId(`${T}-row-actions-opt_c`)
    expect(within(row('opt_c')).getByTestId(`${T}-row-actions-opt_c`)).toBe(actions)
    const buttons = within(actions).getAllByRole('button')
    expect(buttons.length).toBeLessThanOrEqual(3)
    expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual([
      LENS_COPY.inspectInModel(LABELS.opt_c),
      LENS_COPY.focusOnCanvas(LABELS.opt_c),
      LENS_COPY.askOlumi(LABELS.opt_c),
    ])
    // Only the Olumi act wears the AI glyph.
    expect(buttons.map((b) => b.getAttribute('data-ai'))).toEqual([null, null, 'true'])
    // Only ONE row's actions are open.
    expect(screen.queryByTestId(`${T}-row-actions-opt_a`)).toBeNull()

    fireEvent.click(screen.getByTestId(`${T}-inspect-opt_c`))
    fireEvent.click(screen.getByTestId(`${T}-canvas-opt_c`))
    fireEvent.click(screen.getByTestId(`${T}-ask-opt_c`))
    expect(onInspectOption).toHaveBeenCalledTimes(1)
    expect(onInspectOption).toHaveBeenCalledWith('opt_c')
    expect(onFocusOption).toHaveBeenCalledWith('opt_c')
    expect(onAskAboutOption).toHaveBeenCalledWith('opt_c', LABELS.opt_c)

    // Opening another row closes this one.
    fireEvent.click(within(row('opt_a')).getByTestId(`${T}-focus`))
    expect(screen.queryByTestId(`${T}-row-actions-opt_c`)).toBeNull()
    expect(screen.getByTestId(`${T}-row-actions-opt_a`)).toBeInTheDocument()
  })

  it('only the supplied handler renders: Ask Olumi alone is one AI button', () => {
    renderRun(dataFor({}), { onAskAboutOption: vi.fn() })
    fireEvent.click(within(row('opt_a')).getByTestId(`${T}-focus`))
    const buttons = within(screen.getByTestId(`${T}-row-actions-opt_a`)).getAllByRole('button')
    expect(buttons).toHaveLength(1)
    expect(buttons[0]).toHaveAttribute('data-ai', 'true')
    expect(screen.queryByTestId(`${T}-inspect-opt_a`)).toBeNull()
    expect(screen.queryByTestId(`${T}-canvas-opt_a`)).toBeNull()
  })
})
