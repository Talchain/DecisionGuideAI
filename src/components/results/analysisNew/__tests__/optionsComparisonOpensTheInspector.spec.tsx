/**
 * ⭐⭐ THE OPTION ROW OPENS THE OPTION'S PANEL — the half this section refused to
 * wire, on a premise that had already stopped being true.
 *
 * ## The gap this closes
 *
 * `OptionsComparison`'s header recorded: "`openNodeInspector` was considered and
 * rejected on evidence: `InspectorRouter` wraps every panel in an unconditional
 * `<fieldset disabled>`". Re-derived at `99b46212`, that is false:
 * `InspectorRouter.tsx:441` declares
 * `AUTHORITY_OWNING_PANELS = new Set(['option','factor-controllable','factor-external'])`
 * and `:541-551` renders `panelOwnsAuthority ? <PanelComponent readOnly />`
 * against the fence. `'option'` is in the set, and every row here resolves to
 * that panel type. So a stale comment was withholding a working affordance.
 *
 * ## What this corpus establishes, and what it CANNOT (trap 22)
 *
 * It establishes that the row RAISES THE PANEL for the option it names, that it
 * does so only when the target resolved, and that the control's accessible name
 * covers both effects. It does NOT establish that the Inspector then renders
 * anything: `openNodeInspector` is mocked here, its own contract is pinned by
 * `canvas/nodes/shared/__tests__/`, and the panel's read-only boundary is pinned
 * by `OptionPanel.readOnlyFence.spec.tsx`. A jsdom test cannot prove a panel
 * became visible (trap 3) and this file does not claim it.
 *
 * ## Every assertion binds by IDENTITY (trap 19)
 *
 * The fixture gives `opt_rudderstack` and `opt_snowflake` the SAME win
 * probability on purpose, so no value predicate can disambiguate them. Rows are
 * found by `data-option-id` and the act is asserted by the ARGUMENT the helper
 * received, never by "the helper was called".
 */

import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'

const { showToast } = vi.hoisted(() => ({ showToast: vi.fn() }))

/**
 * `importOriginal`-spread rather than a hand-listed factory: a bare factory
 * REPLACES the module, so any export the component later reaches for would be
 * silently `undefined` (CLAUDE.md trap 12).
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
vi.mock('../../../../canvas/nodes/shared/openNodeInspector', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../../canvas/nodes/shared/openNodeInspector')>()),
  openNodeInspector: vi.fn(() => true),
}))

import { focusModelTarget } from '../../../../canvas/utils/focusHelpers'
import { openNodeInspector } from '../../../../canvas/nodes/shared/openNodeInspector'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { OptionsComparison } from '../sections/OptionsComparison'
import { ANALYSIS_NEW_COPY } from '../analysisNewCopy'
import type { OptionResult } from '../../types'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import { makeData, makeOption } from './analysisNewFixtures'

const TESTID = 'analysis-new-options'

beforeEach(() => {
  vi.mocked(focusModelTarget).mockClear().mockReturnValue(true)
  vi.mocked(openNodeInspector).mockClear().mockReturnValue(true)
  showToast.mockClear()
})
afterEach(() => cleanup())

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

function control(optionId: string): HTMLElement {
  return within(row(optionId)).getByTestId(`${TESTID}-focus`)
}

// ═══════════════════════════════════════════════════════════════════════════
describe('the row raises the panel for the option it names', () => {
  it('POSITIVE CONTROL: five rows mount and two share a readout', () => {
    const { vm } = renderSection(mixedRun())
    // Without this every assertion below could pass vacuously on a section that
    // rendered one row, and the shared readout is what makes identity binding
    // do real work rather than succeed on a coincidence.
    expect(screen.getAllByTestId(`${TESTID}-row`)).toHaveLength(5)
    // ⚠ V2 (24 Sep 2026): the win share is no longer printed at rest, so the
    // shared readout is read where it now lives, on the view model.
    const readout = (id: string) => {
      const r = vm.optionsComparison.rows.find((x) => x.id === id)
      return r?.kind === 'analysed' ? r.winReadout : undefined
    }
    expect(readout('opt_rudderstack')).not.toBeNull()
    expect(readout('opt_rudderstack')).toBe(readout('opt_snowflake'))
  })

  it('clicking a row opens the inspector on THAT option id', () => {
    renderSection(mixedRun())
    fireEvent.click(control('opt_snowflake'))

    expect(openNodeInspector).toHaveBeenCalledTimes(1)
    expect(openNodeInspector).toHaveBeenCalledWith('opt_snowflake')
  })

  it('DISCRIMINATING TWIN: the row it did NOT name is never the argument', () => {
    // A handler that raised the panel on a fixed id, or on the first row, would
    // satisfy the case above on `opt_segment` alone. The two 0.06 siblings make
    // that failure mode reachable, so it is asserted rather than assumed.
    renderSection(mixedRun())
    fireEvent.click(control('opt_rudderstack'))

    expect(openNodeInspector).toHaveBeenCalledWith('opt_rudderstack')
    expect(openNodeInspector).not.toHaveBeenCalledWith('opt_snowflake')
    expect(openNodeInspector).not.toHaveBeenCalledWith('opt_segment')
  })

  it('both halves of the act run, and the camera settles BEFORE the panel', () => {
    // `openNodeInspector`'s own rule — it raises the panel last, onto a settled
    // selection — and it has to hold across this seam too, or the panel opens
    // onto a selection the camera is still moving away from.
    renderSection(mixedRun())
    fireEvent.click(control('opt_segment'))

    expect(focusModelTarget).toHaveBeenCalledWith('opt_segment')
    expect(openNodeInspector).toHaveBeenCalledWith('opt_segment')
    expect(
      vi.mocked(focusModelTarget).mock.invocationCallOrder[0],
    ).toBeLessThan(vi.mocked(openNodeInspector).mock.invocationCallOrder[0])
  })

  it('every named row opens its own panel, whatever the producer did with it', () => {
    // The not-analysed and failed rows are canvas option nodes too
    // (`useResultsSectionData.ts:1726`, `:1783`), so gating the panel on `kind`
    // would disable it on exactly the rows a reader most needs to open.
    renderSection(mixedRun())
    for (const [id, kind] of [
      ['opt_legacy', 'not_computed'],
      ['opt_donothing', 'not_analysed'],
    ] as const) {
      // Pin the precondition IN-TEST (trap 13b): if the builder stopped
      // producing this kind, the assertion below would still pass while testing
      // a row that is no longer the one this case is about.
      expect(row(id)).toHaveAttribute('data-option-kind', kind)
      vi.mocked(openNodeInspector).mockClear()
      fireEvent.click(control(id))
      expect(openNodeInspector).toHaveBeenCalledWith(id)
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('it fails closed — a stale target opens nothing', () => {
  it('no panel is raised when the target did not resolve', () => {
    renderSection(mixedRun())
    vi.mocked(focusModelTarget).mockReturnValue(false)

    fireEvent.click(control('opt_segment'))

    expect(showToast).toHaveBeenCalledWith(ANALYSIS_NEW_COPY.canvas.focusFailed)
    // The whole point of the early return: a notice AND a panel would be the
    // product saying the element is gone while showing you its details.
    expect(openNodeInspector).not.toHaveBeenCalled()
  })

  it('OPPOSITE-DIRECTION TWIN: a target that resolves raises the panel and says nothing', () => {
    // Without this, a handler that never called `openNodeInspector` at all
    // would pass the case above (trap 22b).
    renderSection(mixedRun())
    fireEvent.click(control('opt_segment'))

    expect(openNodeInspector).toHaveBeenCalledWith('opt_segment')
    expect(showToast).not.toHaveBeenCalled()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('the accessible name covers BOTH effects', () => {
  it('the control is named by the copy module, not by a local literal', () => {
    renderSection(mixedRun())
    // Asserted by CALLING the constant, so a reword in the owning module moves
    // this with it instead of passing past it.
    expect(control('opt_segment')).toHaveAccessibleName(
      ANALYSIS_NEW_COPY.canvas.focusOption('Segment'),
    )
  })

  it('and that name states the panel half, not only the camera half', () => {
    // ⚠ NOT CIRCULAR, and that is why it is a separate case. The assertion above
    // derives the name from the copy module and therefore still passes if the
    // string reverts to "Show X on the canvas" while the handler keeps opening
    // the panel — the exact drift this whole change exists to correct, one level
    // down. This one is a claim about the SUBSTANCE of the string.
    const name = ANALYSIS_NEW_COPY.canvas.focusOption('Segment')
    expect(name).toContain('Segment')
    expect(name).toContain('canvas')
    expect(name).toContain('details')
  })
})
