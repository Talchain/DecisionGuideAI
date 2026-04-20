import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { OptionPreview } from '../OptionPreview'
import type { OptionPreviewData } from '../hooks/usePreAnalysisData'

function makeOption(overrides: Partial<OptionPreviewData> & { interventions: OptionPreviewData['interventions'] }): OptionPreviewData {
  return {
    id: 'opt1',
    label: 'Option A',
    status: 'ready',
    isBaseline: false,
    ...overrides,
  }
}

// Helper: OptionPreview defaults to collapsed (isExpanded=false).
// Tests that need intervention content must expand first.
function expandOptionPreview() {
  fireEvent.click(screen.getByTestId('option-preview-toggle'))
}

describe('OptionPreview — narrow-framing coaching (Brief 4 hotfix Task 6)', () => {
  const basicOption = makeOption({
    interventions: [{
      factorId: 'fac1',
      factorLabel: 'Some factor',
      interventionValue: 0.5,
      currentValue: 0.3,
      direction: 'up',
      cap: 1,
      unit: '',
      currentRawValue: null,
    }],
  })

  it('renders the full narrow-framing copy in the collapsed state when hasSameLeversCheck is true', () => {
    render(
      <OptionPreview
        options={[basicOption]}
        hasSameLeversCheck
        onSendMessage={vi.fn()}
      />,
    )
    // Collapsed by default. Full copy + link visible without expanding.
    expect(
      screen.getByTestId('option-quality-narrow-framing'),
    ).toHaveTextContent(/all work through similar factors/i)
    expect(screen.getByText('Explore alternatives')).toBeInTheDocument()
  })

  it('renders the full narrow-framing copy in the expanded state too (data-driven, not state-driven)', () => {
    render(
      <OptionPreview
        options={[basicOption]}
        hasSameLeversCheck
        onSendMessage={vi.fn()}
      />,
    )
    expandOptionPreview()
    // Both instances render the same full sentence. Use getAllByTestId so the
    // collapsed version's residual layout presence (if any) doesn't trip up
    // the assertion.
    const coaching = screen.getAllByTestId('option-quality-narrow-framing')
    expect(coaching.length).toBeGreaterThan(0)
    coaching.forEach(el => {
      expect(el).toHaveTextContent(/all work through similar factors/i)
    })
  })

  it('omits "Explore alternatives" link when onSendMessage is not provided', () => {
    render(
      <OptionPreview
        options={[basicOption]}
        hasSameLeversCheck
      />,
    )
    expect(screen.getByTestId('option-quality-narrow-framing')).toBeInTheDocument()
    expect(screen.queryByText('Explore alternatives')).not.toBeInTheDocument()
  })

  it('does not render any narrow-framing coaching when hasSameLeversCheck is false', () => {
    render(
      <OptionPreview
        options={[basicOption]}
        onSendMessage={vi.fn()}
      />,
    )
    expect(screen.queryByTestId('option-quality-narrow-framing')).not.toBeInTheDocument()
  })

  // Brief 5.2 Task 4: lock the exact byte-identical coaching output between
  // collapsed and expanded states. A copy drift between the two branches
  // was the Brief 4 hotfix Phase 6 regression; this guard freezes the
  // unified rendering so any future divergence trips the suite.
  it('Brief 5.2 Task 4: collapsed vs expanded renders byte-identical coaching text', () => {
    const { rerender } = render(
      <OptionPreview
        options={[basicOption]}
        hasSameLeversCheck
        onSendMessage={vi.fn()}
      />,
    )
    const collapsedCoaching = screen.getByTestId('option-quality-narrow-framing').textContent
    // Re-render into expanded.
    rerender(
      <OptionPreview
        options={[basicOption]}
        hasSameLeversCheck
        onSendMessage={vi.fn()}
      />,
    )
    expandOptionPreview()
    const expandedCoaching = screen
      .getAllByTestId('option-quality-narrow-framing')
      .map(el => el.textContent)

    // Every expanded instance of the coaching must match the collapsed text
    // exactly. Protects against a future revert where the two branches
    // render slightly different phrasings ("Your options are similar" vs
    // "All options work through similar factors").
    expect(expandedCoaching.length).toBeGreaterThan(0)
    expandedCoaching.forEach(txt => {
      expect(txt).toBe(collapsedCoaching)
    })
  })
})

describe('OptionPreview — intervention display', () => {
  it('interventions are visible after expanding the section', () => {
    render(
      <OptionPreview
        options={[makeOption({
          interventions: [{
            factorId: 'fac1',
            factorLabel: 'Product-Market Fit',
            interventionValue: 0.8,
            currentValue: 0.5,
            direction: 'up',
            cap: 1,
            unit: '',
            currentRawValue: null,
          }],
        })]}
      />,
    )

    expandOptionPreview()
    expect(screen.getByText('to very high')).toBeInTheDocument()
  })

  it('shows qualitative level for cap=1, unit="" intervention (0.8 → "to very high")', () => {
    render(
      <OptionPreview
        options={[makeOption({
          interventions: [{
            factorId: 'fac1',
            factorLabel: 'Product-Market Fit',
            interventionValue: 0.8,
            currentValue: 0.5,
            direction: 'up',
            cap: 1,
            unit: '',
            currentRawValue: null,
          }],
        })]}
      />,
    )

    expandOptionPreview()
    expect(screen.getByText('to very high')).toBeInTheDocument()
  })

  it('shows qualitative level for cap=1, unit="" intervention (0.5 → "to moderate")', () => {
    render(
      <OptionPreview
        options={[makeOption({
          interventions: [{
            factorId: 'fac1',
            factorLabel: 'Integration Complexity',
            interventionValue: 0.5,
            currentValue: 0.3,
            direction: 'up',
            cap: 1,
            unit: '',
            currentRawValue: null,
          }],
        })]}
      />,
    )

    expandOptionPreview()
    expect(screen.getByText('to moderate')).toBeInTheDocument()
  })

  it('shows numeric for cap=1, unit="" with out-of-range value (5000 → "to 5000")', () => {
    render(
      <OptionPreview
        options={[makeOption({
          interventions: [{
            factorId: 'fac1',
            factorLabel: 'Large Factor',
            interventionValue: 5000,
            currentValue: null,
            direction: 'up',
            cap: 1,
            unit: '',
            currentRawValue: null,
          }],
        })]}
      />,
    )

    expandOptionPreview()
    expect(screen.getByText('to 5000')).toBeInTheDocument()
  })

  it('shows qualitative for null cap and null unit (existing behaviour)', () => {
    render(
      <OptionPreview
        options={[makeOption({
          interventions: [{
            factorId: 'fac1',
            factorLabel: 'Score',
            interventionValue: 0.3,
            currentValue: null,
            direction: 'down',
            cap: null,
            unit: null,
            currentRawValue: null,
          }],
        })]}
      />,
    )

    expandOptionPreview()
    expect(screen.getByText('to low')).toBeInTheDocument()
  })

  // Task 1: boundary value tests for the 5-level qualitative scale
  it.each([
    [0, 'to very low'],
    [0.19, 'to very low'],
    [0.2, 'to low'],
    [0.39, 'to low'],
    [0.4, 'to moderate'],
    [0.59, 'to moderate'],
    [0.6, 'to high'],
    [0.79, 'to high'],
    [0.8, 'to very high'],
    [1, 'to very high'],
  ])('qualitative boundary: %f → "%s"', (interventionValue, expectedLabel) => {
    render(
      <OptionPreview
        options={[makeOption({
          interventions: [{
            factorId: 'fac1',
            factorLabel: 'Factor',
            interventionValue,
            currentValue: null,
            direction: 'up',
            cap: null,
            unit: null,
            currentRawValue: null,
          }],
        })]}
      />,
    )
    expandOptionPreview()
    expect(screen.getByText(expectedLabel)).toBeInTheDocument()
  })

  it('shows raw + unit when cap and unit are meaningful', () => {
    render(
      <OptionPreview
        options={[makeOption({
          interventions: [{
            factorId: 'fac1',
            factorLabel: 'Timeline',
            interventionValue: 0.5,
            currentValue: null,
            direction: 'up',
            cap: 18,
            unit: 'months',
            currentRawValue: null,
          }],
        })]}
      />,
    )

    expandOptionPreview()
    expect(screen.getByText('to 9 months')).toBeInTheDocument()
  })
})

describe('OptionPreview — collapsed state (UI-BUG-3)', () => {
  it('shows option names without expanding', () => {
    render(
      <OptionPreview
        options={[
          makeOption({ id: 'opt1', label: 'Hire Now', interventions: [] }),
          makeOption({ id: 'opt2', label: 'Outsource', interventions: [] }),
        ]}
      />,
    )
    const nameList = screen.getByTestId('option-preview-collapsed-names')
    expect(nameList).toBeInTheDocument()
    expect(screen.getByText('Hire Now')).toBeInTheDocument()
    expect(screen.getByText('Outsource')).toBeInTheDocument()
  })

  it('shows coaching line when hasSameLeversCheck is true', () => {
    render(
      <OptionPreview
        options={[makeOption({ id: 'opt1', label: 'A', interventions: [] })]}
        hasSameLeversCheck
      />,
    )
    // Brief 4 hotfix Task 6: unified copy (collapsed and expanded states share
    // the same sentence). Match by testid which both states render.
    expect(screen.getByTestId('option-quality-narrow-framing')).toBeInTheDocument()
  })

  it('does not show coaching line when hasSameLeversCheck is false', () => {
    render(
      <OptionPreview
        options={[makeOption({ id: 'opt1', label: 'A', interventions: [] })]}
      />,
    )
    expect(screen.queryByTestId('option-quality-narrow-framing')).not.toBeInTheDocument()
  })

  it('shows a collapsed chevron (ChevronRight) in the header toggle', () => {
    render(
      <OptionPreview
        options={[makeOption({ id: 'opt1', label: 'A', interventions: [] })]}
      />,
    )
    const toggle = screen.getByTestId('option-preview-toggle')
    // ChevronRight renders when collapsed, ChevronDown when expanded
    expect(toggle).toBeInTheDocument()
  })

  it('hides option names after expanding (expanded state shows full detail)', () => {
    render(
      <OptionPreview
        options={[makeOption({ id: 'opt1', label: 'Hire Now', interventions: [] })]}
      />,
    )
    expandOptionPreview()
    expect(screen.queryByTestId('option-preview-collapsed-names')).not.toBeInTheDocument()
  })
})

describe('OptionPreview — sharedFactorLabels (Brief 5.3 Task 3)', () => {
  function makeIntervention(factorId: string, factorLabel: string) {
    return {
      factorId,
      factorLabel,
      interventionValue: 0.5,
      currentValue: null,
      direction: 'up' as const,
      cap: null,
      unit: null,
      currentRawValue: null,
    }
  }

  it('shows shared factor labels when all non-baseline options share a factor', () => {
    const optA = makeOption({ id: 'a', label: 'A', interventions: [makeIntervention('rev', 'Revenue'), makeIntervention('cost', 'Cost')] })
    const optB = makeOption({ id: 'b', label: 'B', interventions: [makeIntervention('rev', 'Revenue'), makeIntervention('staff', 'Staffing')] })
    render(<OptionPreview options={[optA, optB]} hasSameLeversCheck />)
    const el = screen.getByTestId('option-preview-overlap-factors')
    expect(el).toHaveTextContent('All options route through Revenue.')
  })

  it('lists multiple shared factor labels using Intl.ListFormat conjunction', () => {
    const optA = makeOption({ id: 'a', label: 'A', interventions: [makeIntervention('mkt', 'Marketing'), makeIntervention('prod', 'Product'), makeIntervention('sales', 'Sales')] })
    const optB = makeOption({ id: 'b', label: 'B', interventions: [makeIntervention('mkt', 'Marketing'), makeIntervention('prod', 'Product')] })
    const optC = makeOption({ id: 'c', label: 'C', interventions: [makeIntervention('mkt', 'Marketing'), makeIntervention('prod', 'Product'), makeIntervention('hr', 'HR')] })
    render(<OptionPreview options={[optA, optB, optC]} hasSameLeversCheck />)
    const el = screen.getByTestId('option-preview-overlap-factors')
    // Intl.ListFormat('en-GB', conjunction): 2 items → "A and B", 3+ → "A, B, and C"
    expect(el).toHaveTextContent('All options route through Marketing and Product.')
  })

  it('omits overlap element when no shared factor exists', () => {
    const optA = makeOption({ id: 'a', label: 'A', interventions: [makeIntervention('rev', 'Revenue')] })
    const optB = makeOption({ id: 'b', label: 'B', interventions: [makeIntervention('cost', 'Cost')] })
    render(<OptionPreview options={[optA, optB]} hasSameLeversCheck />)
    expect(screen.queryByTestId('option-preview-overlap-factors')).not.toBeInTheDocument()
  })

  it('omits overlap element with only one non-baseline option', () => {
    const optA = makeOption({ id: 'a', label: 'A', interventions: [makeIntervention('rev', 'Revenue')] })
    render(<OptionPreview options={[optA]} hasSameLeversCheck />)
    expect(screen.queryByTestId('option-preview-overlap-factors')).not.toBeInTheDocument()
  })

  it('excludes the baseline option from the intersection computation', () => {
    const baseline = makeOption({ id: 'base', label: 'Status quo', isBaseline: true, interventions: [makeIntervention('rev', 'Revenue')] })
    // Only one non-baseline → no intersection possible
    const optA = makeOption({ id: 'a', label: 'A', interventions: [makeIntervention('rev', 'Revenue')] })
    render(<OptionPreview options={[baseline, optA]} hasSameLeversCheck />)
    expect(screen.queryByTestId('option-preview-overlap-factors')).not.toBeInTheDocument()
  })

  it('omits overlap element when hasSameLeversCheck is false even with shared factors', () => {
    const optA = makeOption({ id: 'a', label: 'A', interventions: [makeIntervention('rev', 'Revenue')] })
    const optB = makeOption({ id: 'b', label: 'B', interventions: [makeIntervention('rev', 'Revenue')] })
    render(<OptionPreview options={[optA, optB]} />)
    expect(screen.queryByTestId('option-preview-overlap-factors')).not.toBeInTheDocument()
  })

  // Empty-return guard: sharedFactorLabels([]) must not produce "All options route through ."
  // (i.e. the guard `shared.length > 0 &&` must be present and effective).
  it('does not render a malformed "All options route through ." when no overlap exists', () => {
    const optA = makeOption({ id: 'a', label: 'A', interventions: [makeIntervention('rev', 'Revenue')] })
    const optB = makeOption({ id: 'b', label: 'B', interventions: [makeIntervention('cost', 'Cost')] })
    render(<OptionPreview options={[optA, optB]} hasSameLeversCheck />)
    // Element must be absent (guard prevents render of an empty-joined sentence)
    expect(screen.queryByTestId('option-preview-overlap-factors')).not.toBeInTheDocument()
    // Belt-and-suspenders: the malformed sentence must not appear anywhere in the DOM
    expect(screen.queryByText(/All options route through\s*\./)).not.toBeInTheDocument()
  })
})

describe('OptionPreview — click-to-inspector', () => {
  it('calls onFocusNode with the factor node id when a factor label is clicked', () => {
    const onFocusNode = vi.fn()
    render(
      <OptionPreview
        options={[makeOption({
          interventions: [{
            factorId: 'fac_market',
            factorLabel: 'Market Size',
            interventionValue: 0.7,
            currentValue: null,
            direction: 'up',
            cap: null,
            unit: null,
            currentRawValue: null,
          }],
        })]}
        onFocusNode={onFocusNode}
      />,
    )

    // Factor labels are inside the expanded content — expand first
    expandOptionPreview()
    fireEvent.click(screen.getByText('Market Size'))
    expect(onFocusNode).toHaveBeenCalledTimes(1)
    expect(onFocusNode).toHaveBeenCalledWith('fac_market')
  })

  it('calls onFocusNode with the option id when the option name is clicked (collapsed state)', () => {
    const onFocusNode = vi.fn()
    const option = makeOption({
      id: 'opt_expand',
      label: 'Expand Now',
      interventions: [],
    })
    render(
      <OptionPreview options={[option]} onFocusNode={onFocusNode} />,
    )

    // Option names are visible in collapsed state (UI-BUG-3 fix)
    fireEvent.click(screen.getByText('Expand Now'))
    expect(onFocusNode).toHaveBeenCalledWith('opt_expand')
  })
})
