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
 *     the shared classifyUnit path: "£20,000", "USD 20,000", "20%" — but only
 *     when a cap > 1 makes calibration possible. A real unit WITHOUT a usable
 *     cap falls back to the unitless normalised form (a "£" prefix on a
 *     normalised 0–1 value would fake a measurement). Percent is the
 *     exception: a 0–1 ratio converts to percentage points (×100) with no
 *     cap; with a cap the denormalised value is already percentage points
 *     and is never re-scaled.
 *   - a display_value that is EXACTLY the calibrated Range text dedupes the
 *     Range line (exact-string only, never fuzzy).
 *   - both prior endpoints must be finite numbers; range_min === 0 is a
 *     valid lower bound and keeps the line.
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

  it('percent unit WITHOUT cap: 0–1 ratio scales to percentage points, including an endpoint at exactly 1', () => {
    // Review fold (PR #320): the ×100 rescale was keyed on VALUE MAGNITUDE
    // (denormed > 0 && denormed < 1), so a capless prior {0.2, 1} rendered
    // "Range: 20% to 1%" — two endpoints of one range in different unit
    // systems (staging rendered "20% to 100%"). The rescale is keyed on CAP
    // PRESENCE: no usable cap → the 0–1 prior is a ratio, ×100 both ends.
    const { container } = renderFactor({
      label: 'Market Adoption Rate',
      type: 'factor',
      category: 'external',
      prior: { range_min: 0.2, range_max: 1 },
      observedState: { value: 0.5, unit: '%', factor_type: 'external' },
    })
    const text = container.textContent ?? ''
    expect(countOccurrences(container, 'Range: 20% to 100%')).toBe(1)
    expect(text).not.toContain('to 1%')
  })

  it('percent unit WITH cap: a sub-1 cap-denormalised value is already percentage points — never re-scaled', () => {
    // cap 100, range_min 0.005 → denormalised 0.5 means 0.5 percentage
    // points. The old magnitude-keyed guard re-multiplied it to "50%".
    const { container } = renderFactor({
      label: 'Market Adoption Rate',
      type: 'factor',
      category: 'external',
      prior: { range_min: 0.005, range_max: 0.8 },
      observedState: { value: 0.5, unit: '%', cap: 100, factor_type: 'external' },
    })
    const text = container.textContent ?? ''
    expect(countOccurrences(container, 'Range: 0.5% to 80%')).toBe(1)
    expect(text).not.toContain('50%')
  })

  it('percent unit WITH cap: a denormalised value of exactly 1 stays "1%"', () => {
    // Preserve pin: cap 100, range_min 0.01 → 1 percentage point.
    const { container } = renderFactor({
      label: 'Market Adoption Rate',
      type: 'factor',
      category: 'external',
      prior: { range_min: 0.01, range_max: 0.8 },
      observedState: { value: 0.5, unit: '%', cap: 100, factor_type: 'external' },
    })
    expect(countOccurrences(container, 'Range: 1% to 80%')).toBe(1)
  })

  it('range_min of exactly 0 still renders the Range line (0 is a real lower bound)', () => {
    // Review fold (PR #320): `!prior?.range_min` truthiness dropped the whole
    // line for range_min === 0.
    const { container } = renderFactor({
      label: 'Market Timing Pressure',
      type: 'factor',
      category: 'external',
      prior: { range_min: 0, range_max: 0.8 },
      observedState: { value: 0.5, unit: 'scale', cap: 100, factor_type: 'external' },
    })
    const text = container.textContent ?? ''
    expect(countOccurrences(container, 'Range: 0 to 0.8')).toBe(1)
    expect(text).not.toContain('scale')
  })

  it('non-finite range endpoints render no Range line (no "Range: Infinity to …")', () => {
    const { container } = renderFactor({
      label: 'Market Timing Pressure',
      type: 'factor',
      category: 'external',
      prior: { range_min: Infinity, range_max: 0.8 },
      observedState: { value: 0.5, unit: 'scale', cap: 100, factor_type: 'external' },
    })
    const text = container.textContent ?? ''
    expect(text).not.toContain('Range:')
    expect(text).not.toContain('Infinity')
  })

  it('numeric MISMATCH is never deduped: a parseable display_value with different numbers keeps BOTH lines', () => {
    // Mutation pin (PR #320 review): replacing the numeric comparison with
    // "suppress on any parseable range" passed the whole suite. display_value
    // 0.1–0.5 does NOT duplicate prior 0.2–0.8 — both must render.
    const { container } = renderFactor({
      label: 'Market Timing Pressure',
      type: 'factor',
      category: 'external',
      prior: { range_min: 0.2, range_max: 0.8 },
      display_value: '0.1 to 0.5',
      observedState: { value: 0.5, unit: 'scale', cap: 100, factor_type: 'external' },
    })
    const text = container.textContent ?? ''
    expect(countOccurrences(container, '0.1 to 0.5')).toBe(1)
    expect(countOccurrences(container, 'Range: 0.2 to 0.8')).toBe(1)
    expect(text).not.toContain('scale')
  })

  it('dedupe parses the en-dash form: display_value "20 – 80" suppresses the cap-denormalised Range line', () => {
    // Mutation pin: restricting parseBareNumericRange to plain "X to Y"
    // passed the suite.
    const { container } = renderFactor({
      label: 'Market Timing Pressure',
      type: 'factor',
      category: 'external',
      prior: { range_min: 0.2, range_max: 0.8 },
      display_value: '20 – 80',
      observedState: { value: 0.5, unit: 'scale', cap: 100, factor_type: 'external' },
    })
    const text = container.textContent ?? ''
    expect(countOccurrences(container, '20 – 80')).toBe(1)
    expect(text).not.toContain('Range:')
  })

  it('dedupe parses comma-thousands: display_value "20,000-80,000" suppresses the cap-denormalised Range line', () => {
    const { container } = renderFactor({
      label: 'Market Timing Pressure',
      type: 'factor',
      category: 'external',
      prior: { range_min: 0.2, range_max: 0.8 },
      display_value: '20,000-80,000',
      observedState: { value: 0.5, unit: 'scale', cap: 100000, factor_type: 'external' },
    })
    const text = container.textContent ?? ''
    expect(countOccurrences(container, '20,000-80,000')).toBe(1)
    expect(text).not.toContain('Range:')
  })

  it('real unit WITHOUT cap: falls back to the unitless normalised range (no "£0 to £1" garbage)', () => {
    // Review fold (PR #320): with no cap the normalised 0–1 endpoints were
    // Math.round-ed to "Range: £0 to £1". A currency prefix on a normalised
    // value fakes calibration exactly like a placeholder unit would, so the
    // capless real-unit path renders unitless-normalised instead.
    const { container } = renderFactor({
      label: 'Competitor Ad Spend',
      type: 'factor',
      category: 'external',
      prior: { range_min: 0.2, range_max: 0.8 },
      observedState: { value: 0.5, unit: '£', factor_type: 'external' },
    })
    const text = container.textContent ?? ''
    expect(countOccurrences(container, 'Range: 0.2 to 0.8')).toBe(1)
    expect(text).not.toContain('£0')
    expect(text).not.toContain('£1')
  })

  it('real unit + display_value identical to the calibrated range: Range line suppressed', () => {
    // Review fold (PR #320): the real-unit branch had no dedupe, so a
    // CEE-authored display_value "£20,000 to £80,000" duplicated the Range
    // line verbatim. Exact-rendered-string dedupe only — a display_value in
    // any other format keeps the calibrated Range line (see next pin).
    const { container } = renderFactor({
      label: 'Competitor Ad Spend',
      type: 'factor',
      category: 'external',
      prior: { range_min: 0.2, range_max: 0.8 },
      display_value: '£20,000 to £80,000',
      observedState: { value: 0.5, unit: '£', cap: 100000, factor_type: 'external' },
    })
    const text = container.textContent ?? ''
    expect(countOccurrences(container, '£20,000 to £80,000')).toBe(1)
    expect(text).not.toContain('Range:')
  })

  it('real unit + display_value with DIFFERENT numbers: both lines render (dedupe is exact, never fuzzy)', () => {
    const { container } = renderFactor({
      label: 'Competitor Ad Spend',
      type: 'factor',
      category: 'external',
      prior: { range_min: 0.2, range_max: 0.8 },
      display_value: '£10,000 to £90,000',
      observedState: { value: 0.5, unit: '£', cap: 100000, factor_type: 'external' },
    })
    expect(countOccurrences(container, '£10,000 to £90,000')).toBe(1)
    expect(countOccurrences(container, 'Range: £20,000 to £80,000')).toBe(1)
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
