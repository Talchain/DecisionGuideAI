/**
 * FactorNode prior-range display (lane C3).
 *
 * Verified staging bug (origin/staging dbd6be9d): an external factor with a
 * placeholder unit ("scale"), cap 100, prior { range_min: 0.2, range_max: 0.8 }
 * and CEE display_value "0.2 to 0.8" rendered the SAME range twice in two unit
 * systems:
 *   line 1 — "0.2 to 0.8"                    (display_value, verbatim)
 *   line 2 — "Range: 20 scale to 80 scale"   (priorRangeDisplay's local fmt())
 * The local formatter bypassed classifyUnit — 'scale' is a generic placeholder
 * unit ("'0.5 scale' looks measured but isn't", labelUtils doctrine) that every
 * other formatter suppresses — and cap-denormalised a normalised prior as if it
 * were a real-world measurement.
 *
 * Contract pinned here:
 *   - placeholder/no unit → the range renders ONCE. If the CEE display_value
 *     already shows it (bare numeric range matching the prior numerically, in
 *     normalised or cap-denormalised form), the Range line is suppressed;
 *     otherwise the Range line renders unitless-normalised ("Range: 0.2 to 0.8").
 *   - no cap-denormalisation for placeholder/no unit (cap-scaling is only
 *     meaningful for real-world units).
 *   - real units keep the Range line (calibrated information) formatted via
 *     the shared classifyUnit path: "£20,000", "USD 20,000", "20%".
 *   - internal factor_type descriptors ('binary', …) never display as units.
 *   - the qualitative/prose display path is untouched.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { FactorNode } from '../FactorNode'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector) =>
    selector({
      hoveredOptionId: null,
      nodes: [],
      edges: [],
      ceeAnalysisReady: null,
      results: { status: 'idle', report: null },
      highlightedNodes: new Set(),
      dimmedNodeIds: new Set(),
      goalThreshold: null,
      goalConstraints: [],
      viewMode: 'expert',
    })
  ),
}))

vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => ({
    sensitivityRank: null,
    influence: null,
    confidence: null,
    inSensitivityAnalysis: false,
    achievementProbability: null,
    stabilityPercentage: null,
    winRate: null,
    isResultsMode: false,
    predictedOutcome: null,
    valueOfInformation: null,
    voiRank: null,
  })),
}))

vi.mock('../../../hooks/useCEEInsights', () => ({
  useCEEInsights: vi.fn(() => ({ data: null })),
}))

vi.mock('../../../hooks/useISLValidation', () => ({
  useISLValidation: vi.fn(() => ({ data: null })),
}))

vi.mock('../../hooks/useScienceIcons', () => ({
  useScienceIcons: vi.fn(() => []),
}))

vi.mock('../shared/NodePopover', () => ({
  NodePopover: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="factor-node-popover">{children}</div>
  ),
}))

vi.mock('../../../flags', () => ({
  isGraphBadgesEnabled: vi.fn(() => false),
  isCrossHighlightEnabled: vi.fn(() => false),
  isGraphLensEnabled: vi.fn(() => false),
}))

const baseProps = {
  id: 'factor-1',
  type: 'factor',
  position: { x: 0, y: 0 },
  selected: false,
  isConnectable: true,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  dragging: false,
  zIndex: 0,
}

const renderFactor = (data: Record<string, unknown>) =>
  render(
    <ReactFlowProvider>
      <FactorNode {...baseProps} data={data} />
    </ReactFlowProvider>
  )

/** Count non-overlapping occurrences of `needle` in the rendered text. */
const countOccurrences = (container: HTMLElement, needle: string): number =>
  (container.textContent ?? '').split(needle).length - 1

describe('FactorNode prior range (lane C3)', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('placeholder unit + duplicating display_value: range renders exactly once, no fake units', () => {
    // The verified staging shape (Market Timing Pressure).
    const { container } = renderFactor({
      label: 'Market Timing Pressure',
      type: 'factor',
      category: 'external',
      prior: { range_min: 0.2, range_max: 0.8 },
      display_value: '0.2 to 0.8',
      observedState: { value: 0.5, unit: 'scale', cap: 100, factor_type: 'external' },
    })
    const text = container.textContent ?? ''
    // The one underlying range appears exactly once (the CEE-authored line).
    expect(countOccurrences(container, '0.2 to 0.8')).toBe(1)
    // The redundant Range line is suppressed entirely.
    expect(text).not.toContain('Range:')
    // The placeholder unit never leaks as if measured, in any form.
    expect(text).not.toContain('20 scale')
    expect(text).not.toContain('80 scale')
    expect(text).not.toContain('scale')
  })

  it('placeholder unit + display_value duplicating the CAP-DENORMALISED range: Range line suppressed', () => {
    const { container } = renderFactor({
      label: 'Market Timing Pressure',
      type: 'factor',
      category: 'external',
      prior: { range_min: 0.2, range_max: 0.8 },
      display_value: '20 to 80',
      observedState: { value: 0.5, unit: 'scale', cap: 100, factor_type: 'external' },
    })
    const text = container.textContent ?? ''
    expect(countOccurrences(container, '20 to 80')).toBe(1)
    expect(text).not.toContain('Range:')
    expect(text).not.toContain('scale')
  })

  it('placeholder unit + display_value ABSENT: unitless normalised Range line, rendered once', () => {
    const { container } = renderFactor({
      label: 'Market Timing Pressure',
      type: 'factor',
      category: 'external',
      prior: { range_min: 0.2, range_max: 0.8 },
      observedState: { value: 0.5, unit: 'scale', cap: 100, factor_type: 'external' },
    })
    const text = container.textContent ?? ''
    // Pinned decision: render the prior once, unitless and NOT cap-denormalised.
    expect(countOccurrences(container, 'Range: 0.2 to 0.8')).toBe(1)
    expect(text).not.toContain('20 scale')
    expect(text).not.toContain('80 scale')
    expect(text).not.toContain('scale')
  })

  it('placeholder unit + prose display_value: prose kept, Range line unitless (no dedupe)', () => {
    const { container } = renderFactor({
      label: 'Market Timing Pressure',
      type: 'factor',
      category: 'external',
      prior: { range_min: 0.2, range_max: 0.8 },
      display_value: 'Volatile launch window',
      observedState: { value: 0.5, unit: 'scale', cap: 100, factor_type: 'external' },
    })
    const text = container.textContent ?? ''
    expect(screen.getByText('Volatile launch window')).toBeDefined()
    expect(countOccurrences(container, 'Range: 0.2 to 0.8')).toBe(1)
    expect(text).not.toContain('scale')
  })

  it('real currency symbol unit (£, cap present) + non-duplicating display_value: calibrated Range line preserved', () => {
    const { container } = renderFactor({
      label: 'Competitor Ad Spend',
      type: 'factor',
      category: 'external',
      prior: { range_min: 0.2, range_max: 0.8 },
      display_value: 'Roughly mid-market spend',
      observedState: { value: 0.5, unit: '£', cap: 100000, factor_type: 'external' },
    })
    const text = container.textContent ?? ''
    expect(screen.getByText('Roughly mid-market spend')).toBeDefined()
    expect(countOccurrences(container, 'Range: £20,000 to £80,000')).toBe(1)
    expect(text).not.toContain('Range: 0.2 to 0.8')
  })

  it('ISO currency code unit (USD): Range line uses the shared ISO prefix formatting', () => {
    // The old local fmt() only knew ['£','$','€','¥'] and rendered
    // "20000 USD" suffix-style — the shared classifyUnit path renders
    // "USD 20,000" like every other formatter.
    const { container } = renderFactor({
      label: 'Competitor Ad Spend',
      type: 'factor',
      category: 'external',
      prior: { range_min: 0.2, range_max: 0.8 },
      observedState: { value: 0.5, unit: 'USD', cap: 100000, factor_type: 'external' },
    })
    const text = container.textContent ?? ''
    expect(countOccurrences(container, 'Range: USD 20,000 to USD 80,000')).toBe(1)
    expect(text).not.toContain('20000 USD')
  })

  it('percent unit with cap: Range line renders percentage points once, not double-scaled', () => {
    // The old local fmt() multiplied by cap AND by 100 → "2000% to 8000%".
    const { container } = renderFactor({
      label: 'Market Adoption Rate',
      type: 'factor',
      category: 'external',
      prior: { range_min: 0.2, range_max: 0.8 },
      observedState: { value: 0.5, unit: '%', cap: 100, factor_type: 'external' },
    })
    const text = container.textContent ?? ''
    expect(countOccurrences(container, 'Range: 20% to 80%')).toBe(1)
    expect(text).not.toContain('2000%')
    expect(text).not.toContain('8000%')
  })

  it('suppressed internal descriptor unit (binary): never displayed, range renders unitless', () => {
    const { container } = renderFactor({
      label: 'Regulatory Approval',
      type: 'factor',
      category: 'external',
      prior: { range_min: 0.1, range_max: 0.9 },
      observedState: { value: 0.5, unit: 'binary', factor_type: 'external' },
    })
    const text = container.textContent ?? ''
    expect(countOccurrences(container, 'Range: 0.1 to 0.9')).toBe(1)
    expect(text).not.toContain('binary')
  })

  it('no observedState at all (fixture wire shape): prior renders once, unitless', () => {
    // Mirrors fac_market_receptivity in
    // src/components/debug/__tests__/fixtures/staging-bundles/
    // olumi-debug-50b336a6-20260510.pre-fix.json — top-level display_value,
    // no observed_state. The body value line requires observedState, so the
    // Range line is the only honest place to surface the prior.
    const { container } = renderFactor({
      label: 'Market Receptivity to Feature',
      type: 'factor',
      category: 'external',
      prior: { range_min: 0.3, range_max: 0.8 },
      display_value: '0.3 to 0.8',
    })
    expect(countOccurrences(container, '0.3 to 0.8')).toBe(1)
  })

  it('regression pin: qualitative prose factor (non-external) is untouched — no Range line', () => {
    const { container } = renderFactor({
      label: 'Marketing Expertise Applied',
      type: 'factor',
      category: 'controllable',
      display_value: 'Low expertise (owner-led)',
      observedState: { value: 0.15, unit: 'scale', factor_type: 'quality' },
    })
    const text = container.textContent ?? ''
    expect(screen.getByText('Low expertise (owner-led)')).toBeDefined()
    expect(text).not.toContain('Range:')
    expect(text).not.toContain('scale')
  })

  it('regression pin: external without prior renders no Range line', () => {
    const { container } = renderFactor({
      label: 'Market rate',
      type: 'factor',
      category: 'external',
      observedState: { value: 0.5, unit: 'scale', cap: 100, factor_type: 'external' },
    })
    expect(container.textContent ?? '').not.toContain('Range:')
  })
})
