/**
 * Content and boundary rendering — the panel shows adapted response values
 * verbatim, omits everything unsourced, and never renders trust wording,
 * raw floats, a goal-alone marker, or the retired lenses.
 */
import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, within, createEvent } from '@testing-library/react'
import { AnalysisHeroPanel } from '../AnalysisHeroPanel'
import { buildHeroModel } from '../buildHeroModel'
import type { HeroChartModel, HeroStatusModel } from '../heroTypes'
import { makeHeroData, makeOption, OPTION_A, OPTION_B } from '../__fixtures__/hero.fixtures'

function chartModel(data = makeHeroData()): HeroChartModel {
  const model = buildHeroModel(data)
  expect(model.kind).toBe('chart')
  return model as HeroChartModel
}

function renderPanel(model: HeroChartModel | HeroStatusModel, props: Partial<Parameters<typeof AnalysisHeroPanel>[0]> = {}) {
  return render(
    <AnalysisHeroPanel
      model={model}
      isStale={false}
      onRerun={() => {}}
      rerunDisabled={false}
      focusPanelMounted={false}
      {...props}
    />,
  )
}

describe('AnalysisHeroPanel — content', () => {
  it('renders the headline, tension subline, and goal readouts from response values', () => {
    renderPanel(chartModel())
    expect(screen.getByTestId('hero-headline')).toHaveTextContent(
      'Upskill the team best fits your goal.',
    )
    expect(screen.getByTestId('hero-subline')).toHaveTextContent(
      'Two developers has the highest expected outcome.',
    )
    // Goal-fit is the default lens: rendered joint probabilities equal the
    // response values (0.34 → 34%, 0.49 → 49%).
    expect(within(screen.getByTestId('hero-option-row-1')).getByText('34%')).toBeInTheDocument()
    expect(within(screen.getByTestId('hero-option-row-2')).getByText('49%')).toBeInTheDocument()
  })

  it('switching to Likely outcome shows outcome centres in the readouts', () => {
    renderPanel(chartModel())
    fireEvent.click(screen.getByTestId('hero-lens-tab-outcome'))
    expect(within(screen.getByTestId('hero-option-row-1')).getByText('68')).toBeInTheDocument()
    expect(within(screen.getByTestId('hero-option-row-2')).getByText('62')).toBeInTheDocument()
  })

  it('shows win probability ONLY inside an opened option detail', () => {
    renderPanel(chartModel())
    expect(screen.queryByText(/chance it is the strongest option overall/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Two developers/ }))
    expect(screen.getByTestId('hero-detail-win')).toHaveTextContent(
      '30% chance it is the strongest option overall.',
    )
  })

  it('Likely outcome lens renders no target marker and never mentions the target', () => {
    // Product decision: the outcome lens owns option comparison — the target
    // line is not drawn (it would compress the chart) and the caption does
    // not name a target. Target attainment lives on Goal fit.
    renderPanel(chartModel())
    fireEvent.click(screen.getByTestId('hero-lens-tab-outcome'))
    expect(screen.queryByTestId('hero-target-marker')).toBeNull()
    expect(screen.getByTestId('hero-caption')).not.toHaveTextContent(/target/i)
    // The outcome caption still describes the range bars.
    expect(screen.getByTestId('hero-caption')).toHaveTextContent(
      'Lines show the realistic range',
    )
  })

  it('range bars are visible on the outcome lens when p10/p90 exist (P0 regression)', () => {
    renderPanel(chartModel())
    fireEvent.click(screen.getByTestId('hero-lens-tab-outcome'))
    const bars = screen.getAllByTestId('hero-range-bar')
    expect(bars.length).toBeGreaterThan(0)
    for (const bar of bars) {
      expect(bar).toHaveAttribute('data-visible', 'true')
      // Solid light-token fills — never opacity-modifier classes, which do
      // not compile with this theme (see chartClassesCompile.spec).
      expect(bar.className).toMatch(/bg-(option|info)-light/)
    }
  })

  it('caption switches to the dots-only variant when no row draws a range', () => {
    // 0 ranged rows is unreachable through buildHeroModel today (the
    // outcome lens is only offered when some row has a range) — the
    // defensive branch is pinned directly so the gate stays honest if the
    // lens gating ever changes.
    const model = chartModel()
    renderPanel({ ...model, outcomeRangedRowCount: 0 })
    fireEvent.click(screen.getByTestId('hero-lens-tab-outcome'))
    expect(screen.getByTestId('hero-caption')).toHaveTextContent(
      'Dots show expected outcome for each option.',
    )
    expect(screen.getByTestId('hero-caption')).not.toHaveTextContent(/lines|overlap/i)
  })

  it('caption uses singular wording and no overlap sentence when only ONE row draws a range', () => {
    // A single range line cannot overlap anything, and "Lines" (plural)
    // would over-describe a chart drawing exactly one.
    const model = chartModel()
    renderPanel({ ...model, outcomeRangedRowCount: 1 })
    fireEvent.click(screen.getByTestId('hero-lens-tab-outcome'))
    expect(screen.getByTestId('hero-caption')).toHaveTextContent(
      'Dots show expected outcome. The line shows the realistic range.',
    )
    expect(screen.getByTestId('hero-caption')).not.toHaveTextContent(/overlap/i)
    expect(screen.getByTestId('hero-caption')).not.toHaveTextContent(/Lines show/)
  })

  it('opened detail recovers the full label and shows the grounded range and goal-fit lines', () => {
    renderPanel(chartModel())
    fireEvent.click(screen.getByRole('button', { name: /Two developers/ }))
    expect(screen.getByTestId('hero-detail-label')).toHaveTextContent('Two developers')
    expect(screen.getByTestId('hero-detail-range')).toHaveTextContent('Realistic range: 54 to 82.')
    expect(screen.getByTestId('hero-detail-goal-fit')).toHaveTextContent(
      '34% chance of hitting your goal.',
    )
  })

  it('win-only rows are not expandable and keep the win line as persistent meta', () => {
    // Strip everything except winProbability from B; A keeps its range so
    // the outcome lens stays available.
    const winOnly = makeOption({
      ...OPTION_B,
      goalProbability: undefined,
      outcome: { mean: 62, p10: null, p50: 61, p90: null },
      p10: null,
      p90: null,
    })
    const a = makeOption({ ...OPTION_A, goalProbability: undefined })
    renderPanel(
      chartModel(
        makeHeroData({
          options: [a, winOnly],
          recommendation: { storyHeadlines: undefined, flipThresholds: undefined },
        }),
      ),
    )
    // B has no disclosure button; its win probability is persistent meta.
    expect(screen.queryByRole('button', { name: /Upskill the team/ })).toBeNull()
    expect(screen.getByTestId('hero-win-meta')).toHaveTextContent(
      '29% chance it is the strongest option overall.',
    )
    // A (range detail exists) is still expandable.
    expect(screen.getByRole('button', { name: /Two developers/ })).toBeInTheDocument()
  })

  it('stale mode hides the win-only persistent meta (uniform with locked disclosures)', () => {
    // While stale, expandable rows lock their detail away — a win-only row
    // must not keep disclosing its detail line while its siblings cannot.
    const winOnly = makeOption({
      ...OPTION_B,
      goalProbability: undefined,
      outcome: { mean: 62, p10: null, p50: 61, p90: null },
      p10: null,
      p90: null,
    })
    const a = makeOption({ ...OPTION_A, goalProbability: undefined })
    renderPanel(
      chartModel(
        makeHeroData({
          options: [a, winOnly],
          recommendation: { storyHeadlines: undefined, flipThresholds: undefined },
        }),
      ),
      { isStale: true },
    )
    expect(screen.queryByTestId('hero-win-meta')).toBeNull()
  })

  it('promotes the success-target line into Focus next ONLY when no target exists', () => {
    const noGoal = [
      makeOption({ ...OPTION_A, goalProbability: undefined }),
      makeOption({ ...OPTION_B, goalProbability: undefined }),
    ]
    const { unmount } = renderPanel(
      chartModel(makeHeroData({ options: noGoal, recommendation: { goalThreshold: null } })),
    )
    // No apply route wired → plain text, never a dead control.
    const promoted = screen.getByTestId('hero-focus-target')
    expect(promoted).toHaveTextContent('Focus next: set a success target to unlock Goal fit.')
    expect(promoted.tagName).toBe('P')
    // The generic focus line is replaced, not duplicated.
    expect(screen.queryByTestId('hero-focus-next')).toBeNull()
    unmount()
    // Target exists (producer gap) → generic focus line, no promotion.
    renderPanel(chartModel(makeHeroData({ options: noGoal })))
    expect(screen.queryByTestId('hero-focus-target')).toBeNull()
    expect(screen.getByTestId('hero-focus-next')).toBeInTheDocument()
  })

  it('the promoted target action commits a raw value through the existing apply route', () => {
    const noGoal = [
      makeOption({ ...OPTION_A, goalProbability: undefined }),
      makeOption({ ...OPTION_B, goalProbability: undefined }),
    ]
    const onApplyTarget = vi.fn()
    renderPanel(
      chartModel(makeHeroData({ options: noGoal, recommendation: { goalThreshold: null } })),
      { onApplyTarget },
    )
    const button = screen.getByTestId('hero-focus-target')
    expect(button.tagName).toBe('BUTTON')
    fireEvent.click(button)
    const input = screen.getByLabelText('Success target value')
    fireEvent.change(input, { target: { value: '62' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onApplyTarget).toHaveBeenCalledWith(62)
    // Editor closes after commit; the action line returns.
    expect(screen.queryByTestId('hero-focus-target-editor')).toBeNull()
    expect(screen.getByTestId('hero-focus-target')).toBeInTheDocument()
  })

  it('the apply tick prevents mousedown default so the commit survives the blur race', () => {
    // Cross-browser robustness: browsers that do not focus a button on
    // mousedown (Safari) would blur the input with relatedTarget=null,
    // letting the group onBlur unmount the editor before the click lands.
    // preventDefault on the button mousedown keeps focus on the input, so
    // the click reliably commits. Pin both halves: default IS prevented,
    // and a click still commits exactly once.
    const noGoal = [
      makeOption({ ...OPTION_A, goalProbability: undefined }),
      makeOption({ ...OPTION_B, goalProbability: undefined }),
    ]
    const onApplyTarget = vi.fn()
    renderPanel(
      chartModel(makeHeroData({ options: noGoal, recommendation: { goalThreshold: null } })),
      { onApplyTarget },
    )
    fireEvent.click(screen.getByTestId('hero-focus-target'))
    fireEvent.change(screen.getByLabelText('Success target value'), { target: { value: '40' } })
    const applyBtn = screen.getByLabelText('Apply target and run the analysis again')
    const mousedown = createEvent.mouseDown(applyBtn)
    fireEvent(applyBtn, mousedown)
    expect(mousedown.defaultPrevented).toBe(true)
    fireEvent.click(applyBtn)
    expect(onApplyTarget).toHaveBeenCalledTimes(1)
    expect(onApplyTarget).toHaveBeenCalledWith(40)
  })

  it('Escape abandons the target editor without applying anything', () => {
    const noGoal = [
      makeOption({ ...OPTION_A, goalProbability: undefined }),
      makeOption({ ...OPTION_B, goalProbability: undefined }),
    ]
    const onApplyTarget = vi.fn()
    renderPanel(
      chartModel(makeHeroData({ options: noGoal, recommendation: { goalThreshold: null } })),
      { onApplyTarget },
    )
    fireEvent.click(screen.getByTestId('hero-focus-target'))
    const input = screen.getByLabelText('Success target value')
    fireEvent.change(input, { target: { value: '55' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(onApplyTarget).not.toHaveBeenCalled()
    expect(screen.queryByTestId('hero-focus-target-editor')).toBeNull()
  })

  it('blur away from the editor group abandons without applying (never a commit)', () => {
    const noGoal = [
      makeOption({ ...OPTION_A, goalProbability: undefined }),
      makeOption({ ...OPTION_B, goalProbability: undefined }),
    ]
    const onApplyTarget = vi.fn()
    renderPanel(
      chartModel(makeHeroData({ options: noGoal, recommendation: { goalThreshold: null } })),
      { onApplyTarget },
    )
    fireEvent.click(screen.getByTestId('hero-focus-target'))
    const input = screen.getByLabelText('Success target value')
    fireEvent.change(input, { target: { value: '55' } })
    // Focus leaves the editor group entirely (relatedTarget outside).
    fireEvent.blur(screen.getByTestId('hero-focus-target-editor'), {
      relatedTarget: document.body,
    })
    expect(onApplyTarget).not.toHaveBeenCalled()
    expect(screen.queryByTestId('hero-focus-target-editor')).toBeNull()
  })

  it('invalid or empty input NEVER fires the apply route (strict numeric commit)', () => {
    const noGoal = [
      makeOption({ ...OPTION_A, goalProbability: undefined }),
      makeOption({ ...OPTION_B, goalProbability: undefined }),
    ]
    const onApplyTarget = vi.fn()
    renderPanel(
      chartModel(makeHeroData({ options: noGoal, recommendation: { goalThreshold: null } })),
      { onApplyTarget },
    )
    fireEvent.click(screen.getByTestId('hero-focus-target'))
    const input = screen.getByLabelText('Success target value')
    // Empty draft: Enter and the apply button both refuse to commit.
    fireEvent.keyDown(input, { key: 'Enter' })
    fireEvent.click(screen.getByLabelText('Apply target and run the analysis again'))
    expect(onApplyTarget).not.toHaveBeenCalled()
    // The editor stays open for correction rather than silently closing.
    expect(screen.getByTestId('hero-focus-target-editor')).toBeInTheDocument()
  })

  it('the editor shows a visible label and the outcome unit so the user knows what to type', () => {
    const noGoal = [
      makeOption({ ...OPTION_A, goalProbability: undefined }),
      makeOption({ ...OPTION_B, goalProbability: undefined }),
    ]
    renderPanel(
      chartModel(
        makeHeroData({
          options: noGoal,
          recommendation: { goalThreshold: null, outcomeUnit: 'percent' },
        }),
      ),
      { onApplyTarget: vi.fn() },
    )
    fireEvent.click(screen.getByTestId('hero-focus-target'))
    const editor = screen.getByTestId('hero-focus-target-editor')
    expect(editor).toHaveTextContent('Success target')
    expect(screen.getByTestId('hero-target-unit')).toHaveTextContent('%')
    // The unit also reaches the accessible name of the input.
    expect(screen.getByLabelText('Success target value (%)')).toBeInTheDocument()
  })

  it('omits the unit suffix when no outcome unit label exists (count outcomes)', () => {
    const noGoal = [
      makeOption({ ...OPTION_A, goalProbability: undefined }),
      makeOption({ ...OPTION_B, goalProbability: undefined }),
    ]
    // Fixture default outcomeUnit is 'count' — no honest unit glyph exists.
    renderPanel(
      chartModel(makeHeroData({ options: noGoal, recommendation: { goalThreshold: null } })),
      { onApplyTarget: vi.fn() },
    )
    fireEvent.click(screen.getByTestId('hero-focus-target'))
    expect(screen.queryByTestId('hero-target-unit')).toBeNull()
    expect(screen.getByLabelText('Success target value')).toBeInTheDocument()
  })

  it('producer-slot text is glyph-guarded: em dashes render as plain hyphens (house style)', () => {
    // The trust line renders producer text VERBATIM in content; the guard
    // swaps only the dash glyphs, never words.
    const model = {
      ...chartModel(),
      trustLine: 'Trust: moderate — 4,000 samples — 2 assumptions to verify.',
      statusChip: 'First pass — provisional',
    }
    renderPanel(model)
    expect(screen.getByTestId('hero-trust-line')).toHaveTextContent(
      'Trust: moderate - 4,000 samples - 2 assumptions to verify.',
    )
    expect(screen.getByTestId('hero-status-chip')).toHaveTextContent('First pass - provisional')
    expect(screen.getByTestId('hero-trust-line').textContent).not.toContain('—')
  })

  it('the Stability lens shows its per-option explainer caption ONLY when data-bearing', () => {
    // Live models never carry stability data, so pin the caption through a
    // model override (the same way the producer-backed state will render).
    const base = chartModel()
    renderPanel({
      ...base,
      lenses: [...base.lenses, 'stability' as const],
      rows: base.rows.map((r, i) => ({
        ...r,
        stability: { value: 0.5 + i * 0.2, readout: 'Producer label' },
      })),
    })
    fireEvent.click(screen.getByTestId('hero-lens-tab-stability'))
    expect(screen.getByTestId('hero-caption')).toHaveTextContent(
      'Stability shows how firmly each option holds its position under uncertainty. It describes each option separately, not the analysis as a whole.',
    )
    // Unavailable stability (live today) shows the explainer body, never this caption.
  })

  it('the editor discloses the rerun side effect BEFORE any commit', () => {
    const noGoal = [
      makeOption({ ...OPTION_A, goalProbability: undefined }),
      makeOption({ ...OPTION_B, goalProbability: undefined }),
    ]
    renderPanel(
      chartModel(makeHeroData({ options: noGoal, recommendation: { goalThreshold: null } })),
      { onApplyTarget: vi.fn() },
    )
    fireEvent.click(screen.getByTestId('hero-focus-target'))
    expect(screen.getByTestId('hero-focus-target-editor')).toHaveTextContent(
      'Applying runs the analysis again.',
    )
  })

  it('detail omits the duplicate full-label line when the visible label is measurably unclipped', () => {
    renderPanel(chartModel())
    const label = within(screen.getByTestId('hero-option-row-1')).getByTestId('hero-row-label')
    Object.defineProperty(label, 'scrollHeight', { configurable: true, value: 40 })
    Object.defineProperty(label, 'clientHeight', { configurable: true, value: 40 })
    fireEvent.click(screen.getByRole('button', { name: /Two developers/ }))
    expect(screen.queryByTestId('hero-detail-label')).toBeNull()
    // Grounded lines still render — only the duplicated name is dropped.
    expect(screen.getByTestId('hero-detail-range')).toBeInTheDocument()
  })

  it('detail recovers the full label when the visible label IS clipped (measured overflow)', () => {
    renderPanel(chartModel())
    const label = within(screen.getByTestId('hero-option-row-1')).getByTestId('hero-row-label')
    Object.defineProperty(label, 'scrollHeight', { configurable: true, value: 60 })
    Object.defineProperty(label, 'clientHeight', { configurable: true, value: 40 })
    fireEvent.click(screen.getByRole('button', { name: /Two developers/ }))
    expect(screen.getByTestId('hero-detail-label')).toHaveTextContent('Two developers')
  })

  it('Goal fit surfaces the target-attainment truth (per-option goal readouts)', () => {
    // Goal fit owns target attainment: each bar is the chance of hitting the
    // goal, so the readouts ARE the target-shortfall communication.
    renderPanel(chartModel())
    expect(within(screen.getByTestId('hero-option-row-1')).getByText('34%')).toBeInTheDocument()
    expect(within(screen.getByTestId('hero-option-row-2')).getByText('49%')).toBeInTheDocument()
    // No target marker on Goal fit either — the bars themselves carry it.
    expect(screen.queryByTestId('hero-target-marker')).toBeNull()
  })

  it('never renders a goal-alone marker (collapsed selector — one bar only)', () => {
    const { container } = renderPanel(chartModel())
    expect(screen.queryByTestId('hero-goal-alone')).toBeNull()
    expect(container.textContent).not.toMatch(/goal alone/i)
  })

  it('never renders trust wording or raw 0-1 floats from a live model', () => {
    // "Stability" is deliberately NOT in this ban: it appears exactly once
    // as a lens NAME in the strip (navigation label, not a claim about this
    // run). Every trust/banding CLAIM word stays banned.
    const { container } = renderPanel(chartModel())
    const text = container.textContent ?? ''
    expect(text).not.toMatch(/\btrust\b/i)
    expect(text).not.toMatch(/\b(firm|fragile|provisional|robust|confidence)\b/i)
    expect(text).not.toMatch(/\b0\.\d+\b/)
  })

  it('renders the full prototype lens strip; data-less lenses are marked unavailable', () => {
    renderPanel(chartModel())
    expect(screen.getAllByRole('tab')).toHaveLength(4)
    expect(screen.getByTestId('hero-lens-tab-goal')).toHaveAttribute('data-available', 'true')
    expect(screen.getByTestId('hero-lens-tab-outcome')).toHaveAttribute('data-available', 'true')
    expect(screen.getByTestId('hero-lens-tab-stability')).toHaveAttribute('data-available', 'false')
    expect(screen.getByTestId('hero-lens-tab-whatChanged')).toHaveAttribute('data-available', 'false')
  })

  it('selecting an unavailable lens shows the honest explainer body, never a fabricated chart', () => {
    renderPanel(chartModel())
    fireEvent.click(screen.getByTestId('hero-lens-tab-stability'))
    expect(screen.getByTestId('hero-lens-unavailable')).toHaveTextContent(
      'This view needs per-option stability data, which the analysis does not provide yet.',
    )
    expect(screen.queryByTestId('hero-option-row-1')).toBeNull()
    expect(screen.queryByTestId('hero-caption')).toBeNull()
    fireEvent.click(screen.getByTestId('hero-lens-tab-whatChanged'))
    expect(screen.getByTestId('hero-lens-unavailable')).toHaveTextContent(
      'This view compares runs. It unlocks when the analysis can report what changed between runs.',
    )
  })

  it('unavailable Goal fit distinguishes the no-target unlock from a producer gap', () => {
    const noGoal = [
      makeOption({ ...OPTION_A, goalProbability: undefined }),
      makeOption({ ...OPTION_B, goalProbability: undefined }),
    ]
    // No target → the unlock instruction.
    const { unmount } = renderPanel(
      chartModel(makeHeroData({ options: noGoal, recommendation: { goalThreshold: null } })),
    )
    fireEvent.click(screen.getByTestId('hero-lens-tab-goal'))
    expect(screen.getByTestId('hero-lens-unavailable')).toHaveTextContent(
      'Set a success target to unlock Goal fit.',
    )
    unmount()
    // Target exists but no goal figures came back → producer-gap wording.
    renderPanel(chartModel(makeHeroData({ options: noGoal })))
    fireEvent.click(screen.getByTestId('hero-lens-tab-goal'))
    expect(screen.getByTestId('hero-lens-unavailable')).toHaveTextContent(
      'Goal fit is not available for this run.',
    )
  })

  it('the tab strip persists even when only one lens carries data', () => {
    const noGoal = [
      makeOption({ ...OPTION_A, goalProbability: undefined }),
      makeOption({ ...OPTION_B, goalProbability: undefined }),
    ]
    renderPanel(chartModel(makeHeroData({ options: noGoal })))
    expect(screen.getAllByRole('tab')).toHaveLength(4)
    // The single available lens still renders its rows by default.
    expect(screen.getByTestId('hero-option-row-1')).toBeInTheDocument()
  })

  it('omits unsourced detail lines instead of fabricating copy', () => {
    const data = makeHeroData({
      recommendation: { storyHeadlines: undefined, flipThresholds: undefined },
    })
    renderPanel(chartModel(data))
    // Row 1 still has a win line, so it stays expandable — open it.
    fireEvent.click(screen.getByRole('button', { name: /Two developers/ }))
    expect(screen.queryByTestId('hero-detail-why')).toBeNull()
    expect(screen.queryByTestId('hero-detail-could-change')).toBeNull()
    expect(screen.getByTestId('hero-detail-win')).toBeInTheDocument()
  })

  it('renders the footer main reason from the top driver and neutral focus-next text', () => {
    renderPanel(chartModel())
    expect(screen.getByTestId('hero-main-reason')).toHaveTextContent(
      'Main driver: Developer capacity.',
    )
    const focusNext = screen.getByTestId('hero-focus-next')
    expect(focusNext).toHaveTextContent('Focus next: review the top actions below.')
    // Coaching panel not mounted → plain text, not a dead link.
    expect(focusNext.tagName).toBe('P')
  })

  it.each(['partial', 'failed', 'blocked'] as const)(
    'renders the curated %s non-chart state (no rows, no fabricated numbers)',
    (variant) => {
      // Non-chart states are driven by the real analysis lifecycle
      // (analysisStatus / hook error), never by completeness enrichment.
      const data =
        variant === 'blocked'
          ? makeHeroData({ recommendation: { analysisStatus: 'blocked' } })
          : variant === 'failed'
            ? makeHeroData({ isError: true })
            : makeHeroData({ recommendation: { analysisStatus: 'partial' } })
      const model = buildHeroModel(data)
      expect(model.kind).toBe('status')
      renderPanel(model as HeroStatusModel)
      expect(screen.getByTestId(`hero-status-${variant}`)).toBeInTheDocument()
      expect(screen.queryByTestId('hero-option-row-1')).toBeNull()
      expect(screen.queryByRole('tablist')).toBeNull()
    },
  )
})
describe('Wave 2: stable number badges', () => {
  it('row badges show the identity-anchored ordinal, surviving a rank flip', () => {
    const a = makeOption({ ...OPTION_A, winProbability: 0.3 })
    const b = makeOption({ ...OPTION_B, winProbability: 0.7 })
    const model = buildHeroModel(makeHeroData({ options: [a, b] }), { opt_a: 1, opt_b: 2 })
    expect(model.kind).toBe('chart')
    renderPanel(model as HeroChartModel)
    // First row is opt_b (display rank 1) but keeps its stable ordinal 2.
    expect(within(screen.getByTestId('hero-option-row-1')).getByTestId('hero-row-number')).toHaveTextContent('2')
    expect(within(screen.getByTestId('hero-option-row-2')).getByTestId('hero-row-number')).toHaveTextContent('1')
  })

  it('without a numbering map the badge falls back to the display rank', () => {
    renderPanel(chartModel())
    expect(within(screen.getByTestId('hero-option-row-1')).getByTestId('hero-row-number')).toHaveTextContent('1')
    expect(within(screen.getByTestId('hero-option-row-2')).getByTestId('hero-row-number')).toHaveTextContent('2')
  })
})
describe('Wave 2 (§6.5): quick evidence links in the footer', () => {
  function modelWithLinks(): HeroChartModel {
    const m = chartModel()
    return {
      ...m,
      quickLinks: {
        mainDriver: { label: 'Developer capacity', targetId: 'node_dev' },
        topFlipRisk: { label: 'Salary cost', targetId: 'node_salary' },
      },
    }
  }

  it('renders both links with semantically distinct labels and fires the focus callback', () => {
    const onFocusTarget = vi.fn()
    renderPanel(modelWithLinks(), { onFocusTarget })
    const driver = screen.getByTestId('hero-quicklink-driver')
    const flip = screen.getByTestId('hero-quicklink-flip')
    expect(driver).toHaveTextContent('Main driver: Developer capacity.')
    expect(flip).toHaveTextContent('Top flip risk: Salary cost.')
    fireEvent.click(driver)
    expect(onFocusTarget).toHaveBeenCalledWith('node_dev')
    fireEvent.click(flip)
    expect(onFocusTarget).toHaveBeenCalledWith('node_salary')
    // The clickable driver link REPLACES the static main-reason line.
    expect(screen.queryByTestId('hero-main-reason')).toBeNull()
  })

  it('falls back to the static main-reason line when no focus target exists', () => {
    renderPanel(chartModel())
    expect(screen.getByTestId('hero-main-reason')).toBeInTheDocument()
    expect(screen.queryByTestId('hero-quicklink-driver')).toBeNull()
    expect(screen.queryByTestId('hero-quicklink-flip')).toBeNull()
  })
})
describe('Wave 2 (§6.6): Why and what could change it disclosure', () => {
  function modelWithEvidence(overrides: Partial<HeroChartModel['evidence']> = {}): HeroChartModel {
    const m = chartModel()
    return {
      ...m,
      evidence: {
        drivers: [
          { rank: 1, label: 'Developer capacity', targetId: 'node_dev' },
          { rank: 2, label: 'Team morale', targetId: null },
          { rank: 3, label: 'Hiring speed', targetId: 'node_hiring' },
          { rank: 4, label: 'Salary cost', targetId: 'node_salary' },
        ],
        flipRisks: [
          { text: 'If Team capacity falls below 30%, Two developers becomes the likely leader.', targetId: 'fac_capacity' },
        ],
        tradeOffs: null,
        ...overrides,
      },
    }
  }

  it('renders collapsed by default; expanding shows the Drivers view with focusable rows', () => {
    const onFocusTarget = vi.fn()
    renderPanel(modelWithEvidence(), { onFocusTarget })
    expect(screen.queryByTestId('hero-evidence-drivers')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /why and what could change it/i }))
    expect(screen.getByTestId('hero-evidence-drivers')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /developer capacity/i }))
    expect(onFocusTarget).toHaveBeenCalledWith('node_dev')
  })

  it('caps drivers at three with See all factors / Show fewer', () => {
    renderPanel(modelWithEvidence(), { onFocusTarget: vi.fn() })
    fireEvent.click(screen.getByRole('button', { name: /why and what could change it/i }))
    expect(screen.queryByText('Salary cost')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'See all factors' }))
    expect(screen.getByText('Salary cost')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Show fewer' }))
    expect(screen.queryByText('Salary cost')).toBeNull()
  })

  it('Flip risks view shows the plain-language consequence and focuses on click', () => {
    const onFocusTarget = vi.fn()
    renderPanel(modelWithEvidence(), { onFocusTarget })
    fireEvent.click(screen.getByRole('button', { name: /why and what could change it/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Flip risks' }))
    const row = screen.getByRole('button', { name: /If Team capacity falls below 30%/ })
    fireEvent.click(row)
    expect(onFocusTarget).toHaveBeenCalledWith('fac_capacity')
  })

  it('never shows a Trade-offs tab when the producer narrative is absent', () => {
    renderPanel(modelWithEvidence(), { onFocusTarget: vi.fn() })
    fireEvent.click(screen.getByRole('button', { name: /why and what could change it/i }))
    expect(screen.queryByRole('button', { name: 'Trade-offs' })).toBeNull()
  })

  it('hides the disclosure entirely when there is nothing to disclose', () => {
    renderPanel(modelWithEvidence({ drivers: [], flipRisks: [], tradeOffs: null }))
    expect(screen.queryByRole('button', { name: /why and what could change it/i })).toBeNull()
  })
})
describe('Wave 2 (§6.2): pause-read state (fixture-only)', () => {
  it('suppresses lenses and evidence, shows the contradiction and the resolution line', () => {
    renderPanel({
      kind: 'status',
      provenance: 'fixture',
      variant: 'paused',
      headline: 'Analysis paused: resolve your framing first.',
      body: 'Your goal says minimise cost, but the leading option is judged on revenue growth.',
      resolution: 'Review the goal with Olumi before reading these results.',
    })
    expect(screen.getByTestId('hero-status-paused')).toBeInTheDocument()
    expect(screen.getByTestId('hero-paused-resolution')).toHaveTextContent(
      'Review the goal with Olumi before reading these results.',
    )
    expect(screen.getByTestId('hero-fixture-banner')).toBeInTheDocument()
    expect(screen.queryByTestId('hero-lens-tab-outcome')).toBeNull()
    expect(screen.queryByTestId('hero-evidence-disclosure')).toBeNull()
    expect(screen.queryByTestId('hero-headline')).toBeNull()
  })
})
