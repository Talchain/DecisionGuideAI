/**
 * "HOW THE OPTIONS COMPARE" — THE ROW IS OPERATED, NOT JUST READ.
 *
 * ## The gap this closes
 *
 * The old Analysis tab's option cards have carried the contract on screen since
 * they shipped — *"Hover highlights on canvas. Click opens inspector."* This
 * section rendered the same options as inert text. Paul, 1 Sep 2026: the panel
 * is something you READ when it should be something you OPERATE.
 *
 * ## What this corpus establishes, and what it CANNOT (trap 22)
 *
 * It establishes that the row DISPATCHES the right act against the right
 * option, that the act fails visibly, and that the keyboard reaches it. It does
 * NOT establish that the canvas then does anything — `focusModelTarget` and
 * `highlightNode` are mocked here, and their own behaviour is pinned by
 * `canvas/utils/__tests__/focusModelTarget.spec.ts`. A jsdom test cannot prove
 * a viewport moved (trap 3), and this file does not claim it.
 *
 * ## Every assertion binds by IDENTITY
 *
 * Rows are found by `data-option-id` and the act is asserted by the ARGUMENT
 * the helper received — never by "the helper was called" alone, which any row
 * could satisfy. The fixture gives `opt_rudderstack` and `opt_snowflake` the
 * SAME win probability on purpose, so a value predicate could not disambiguate
 * them and only identity binding can (trap 19).
 *
 * ## Why the not-analysed and failed rows are operable TOO
 *
 * Derived, not assumed. `useResultsSectionData.ts:1726` builds the option list
 * from `nodes.filter(n => n.data?.kind === 'option')` and `:1783` maps over
 * those same canvas nodes, so EVERY row id — `analysed`, `not_analysed` and
 * `not_computed` alike — is a canvas option node id by construction. A row's
 * `kind` says whether the PRODUCER scored it, never whether the node is on the
 * canvas. Gating the affordance on `kind` would have disabled it on precisely
 * the rows a reader most needs to locate ("which option got left out?"), and
 * would have been a guard against a condition that cannot arise.
 */

import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'

const { showToast } = vi.hoisted(() => ({ showToast: vi.fn() }))

/**
 * `importOriginal`-spread rather than a hand-listed factory: a bare factory
 * REPLACES the module, so any export this component later reaches for would be
 * silently `undefined` and the suite would fail at collection (CLAUDE.md trap
 * 12 — the vitest flags-mock allowlist that killed 51 tests).
 */
vi.mock('../../../../canvas/ToastContext', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../../canvas/ToastContext')>()),
  useShowToastSafe: () => showToast,
}))
vi.mock('../../../../canvas/utils/focusHelpers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../../canvas/utils/focusHelpers')>()),
  focusModelTarget: vi.fn(() => true),
}))
vi.mock('../../../../canvas/utils/highlightHelpers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../../canvas/utils/highlightHelpers')>()),
  highlightNode: vi.fn(),
  clearHighlight: vi.fn(),
}))

import { focusModelTarget } from '../../../../canvas/utils/focusHelpers'
import { clearHighlight, highlightNode } from '../../../../canvas/utils/highlightHelpers'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { OptionsComparison } from '../sections/OptionsComparison'
import { ANALYSIS_NEW_COPY } from '../analysisNewCopy'
import type { OptionResult } from '../../types'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import { makeData, makeOption } from './analysisNewFixtures'

const TESTID = 'analysis-new-options'

beforeEach(() => {
  vi.mocked(focusModelTarget).mockClear().mockReturnValue(true)
  vi.mocked(highlightNode).mockClear()
  vi.mocked(clearHighlight).mockClear()
  showToast.mockClear()
})
afterEach(() => cleanup())

/**
 * THE MEASURED RUN, plus the two numberless shapes.
 *
 * ⚠ `opt_rudderstack` and `opt_snowflake` deliberately SHARE a win probability
 * (0.06). A spec that located a row by its readout could not tell them apart,
 * so the discrimination below is doing real work rather than passing on a
 * coincidence that happens to be unique today.
 */
function mixedRun(): OptionResult[] {
  return [
    makeOption({ id: 'opt_segment', label: 'Segment', winProbability: 0.89, nValidSamples: 10000, isRecommended: true }),
    makeOption({ id: 'opt_rudderstack', label: 'RudderStack', winProbability: 0.06, nValidSamples: 10000 }),
    makeOption({ id: 'opt_snowflake', label: 'Snowflake', winProbability: 0.06, nValidSamples: 10000 }),
    makeOption({ id: 'opt_legacy', label: 'Legacy stack', computeStatus: 'failed', nValidSamples: 0 }),
    makeOption({ id: 'opt_donothing', label: 'Do nothing', notAnalysed: true, notAnalysedReason: 'no_interventions' }),
  ]
}

function renderSection(allOptions: OptionResult[]) {
  const data: ResultsSectionDataReturn = makeData({
    recommendation: {
      allOptions,
      recommendedOption: allOptions.find((o) => o.isRecommended) ?? null,
    },
  })
  const vm = buildAnalysisNewViewModel({
    data,
    recommendations: [],
    isPreRun: false,
    isRunning: false,
    isStale: false,
  })
  const utils = render(<OptionsComparison options={vm.optionsComparison} />)
  fireEvent.click(screen.getByTestId(`${TESTID}-toggle`))
  return { vm, ...utils }
}

/** Bind by IDENTITY. Never `getAllByTestId(...)[n]`, never a value predicate. */
function row(optionId: string): HTMLElement {
  const el = document.querySelector<HTMLElement>(`[data-option-id="${optionId}"]`)
  if (!el) throw new Error(`no row for option id ${optionId}`)
  return el
}

/** The row's activation control, reached through the row so it cannot drift. */
function control(optionId: string): HTMLElement {
  return within(row(optionId)).getByTestId(`${TESTID}-focus`)
}

// ═══════════════════════════════════════════════════════════════════════════
describe('the row dispatches against the option it names', () => {
  it('POSITIVE CONTROL: the fixture mounts all five rows and two share a readout', () => {
    renderSection(mixedRun())
    // Without this, every "the right row acted" assertion below could pass
    // vacuously on a section that rendered a single row.
    expect(screen.getAllByTestId(`${TESTID}-row`)).toHaveLength(5)
    expect(within(row('opt_rudderstack')).getByTestId(`${TESTID}-win`).textContent).toBe(
      within(row('opt_snowflake')).getByTestId(`${TESTID}-win`).textContent,
    )
  })

  it('clicking a row focuses THAT option id on the canvas', () => {
    renderSection(mixedRun())
    fireEvent.click(control('opt_snowflake'))

    // The ARGUMENT is the assertion. "was called" would be satisfied by any
    // row, and the two 0.06 options make that failure mode reachable.
    expect(focusModelTarget).toHaveBeenCalledTimes(1)
    expect(focusModelTarget).toHaveBeenCalledWith('opt_snowflake')
  })

  it('hovering a row highlights THAT option, and leaving clears it', () => {
    renderSection(mixedRun())

    fireEvent.mouseEnter(row('opt_rudderstack'))
    expect(highlightNode).toHaveBeenCalledTimes(1)
    expect(highlightNode).toHaveBeenCalledWith('opt_rudderstack')
    // Hover is a POINTER, not a camera move: it must not move the viewport.
    expect(focusModelTarget).not.toHaveBeenCalled()

    fireEvent.mouseLeave(row('opt_rudderstack'))
    expect(clearHighlight).toHaveBeenCalledTimes(1)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('keyboard and touch reach it — hover is never the only route', () => {
  it('the control is a real focusable button, not a hover-only div', () => {
    renderSection(mixedRun())
    const el = control('opt_segment')
    // `role="button"` on a div with no tabIndex is the shape the old tab ships
    // when its lens flag is off (`OptionCards.tsx:720-721`); this asserts the
    // element is genuinely reachable rather than merely looking like a control.
    expect(el.tagName).toBe('BUTTON')
    expect(el).not.toHaveAttribute('disabled')
  })

  it('focusing a row highlights it, and blurring clears — the onMouseEnter twin', () => {
    renderSection(mixedRun())

    fireEvent.focus(control('opt_segment'))
    expect(highlightNode).toHaveBeenCalledTimes(1)
    expect(highlightNode).toHaveBeenCalledWith('opt_segment')

    fireEvent.blur(control('opt_segment'))
    expect(clearHighlight).toHaveBeenCalledTimes(1)
  })

  it('the act is named in the accessible name, not only in a tooltip', () => {
    renderSection(mixedRun())
    // Asserted by CALLING the copy constant, never by re-typing the sentence —
    // a wording change in the owning module must RED this file, not pass it.
    expect(control('opt_segment')).toHaveAccessibleName(
      ANALYSIS_NEW_COPY.canvas.focusOption('Segment'),
    )
  })

  it('the row content stays readable OUTSIDE the control', () => {
    renderSection(mixedRun())
    // The `aria-label` names the ACT, so anything inside the button loses its
    // own voice. The readout and the producer's reason must therefore sit
    // outside it — this is the assertion that stops a future refactor from
    // swallowing the row into the button.
    const readout = within(row('opt_snowflake')).getByTestId(`${TESTID}-win`)
    expect(control('opt_snowflake').contains(readout)).toBe(false)

    const reason = within(row('opt_donothing')).getByTestId(`${TESTID}-not-analysed-reason`)
    expect(control('opt_donothing').contains(reason)).toBe(false)

    // …and the label IS inside it, so the two `contains` checks above are
    // discriminating rather than a probe that returns `false` for everything.
    const label = within(row('opt_snowflake')).getByTestId(`${TESTID}-label`)
    expect(control('opt_snowflake').contains(label)).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('it fails closed and VISIBLY', () => {
  it('a stale target says so instead of silently doing nothing', () => {
    renderSection(mixedRun())
    vi.mocked(focusModelTarget).mockReturnValue(false)

    fireEvent.click(control('opt_segment'))

    expect(focusModelTarget).toHaveBeenCalledWith('opt_segment')
    expect(showToast).toHaveBeenCalledTimes(1)
    expect(showToast).toHaveBeenCalledWith(ANALYSIS_NEW_COPY.canvas.focusFailed)
  })

  it('a target that RESOLVES says nothing — the notice is not unconditional', () => {
    renderSection(mixedRun())
    // The opposite-direction twin (trap 22b). Without it, a handler that
    // toasted on every click would pass the test above.
    fireEvent.click(control('opt_segment'))
    expect(showToast).not.toHaveBeenCalled()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('every named row is operable, whatever the producer did with it', () => {
  it.each([
    ['opt_legacy', 'not_computed', 'Legacy stack'],
    ['opt_donothing', 'not_analysed', 'Do nothing'],
  ] as const)(
    'the %s row (%s) focuses its own canvas node',
    (id, kind, label) => {
      renderSection(mixedRun())

      // Pin the precondition IN-TEST: if the builder stopped producing this
      // kind, the assertion below would still pass while testing a row that is
      // no longer the one this case is about (trap 13b).
      expect(row(id)).toHaveAttribute('data-option-kind', kind)

      fireEvent.click(control(id))
      expect(focusModelTarget).toHaveBeenCalledWith(id)
      expect(control(id)).toHaveAccessibleName(ANALYSIS_NEW_COPY.canvas.focusOption(label))
    },
  )
})
