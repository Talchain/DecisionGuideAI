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

/**
 * A NORMALISED RANGE BESIDE A REAL-SCALE VALUE (journey-witnessed, 2026-09-10).
 *
 * Measured on the deployed product, on one factor card, together and unflagged:
 *
 *     Sales Payback Period        18 month
 *     Range: 0.08 to 0.28
 *
 * A value SIXTY TIMES outside its own displayed range. The editor compounds it:
 * it rejects `0.2` as "a proportion rather than a value in month", so the node's
 * own displayed range is a set of values its own editor refuses.
 *
 * ⭐ THE UI WAS BEHAVING HONESTLY AND THAT IS THE POINT. `month` is a real unit,
 * the deterministic draft carries no cap, so `canCalibrate` is false and the
 * owner correctly declines to cap-denormalise — its own words, "would fake a
 * measurement". The defect is not the refusal to calibrate. It is that having
 * declined to put the range on the shown scale, it printed the range anyway,
 * beside a value on a different scale.
 *
 * ⛔ THE FIX IS TO DECLINE, NEVER TO COMPUTE. No multiplying, no invented cap,
 * no denormalising. The suppression extends the owner's EXISTING dedupe arm
 * from "the value line already MATCHES this range" to "the value line
 * CONTRADICTS the scale this range would print on" — one decision, two arms,
 * at the one call site.
 *
 * ⭐ THE LARGER BLAST RADIUS IS OVER-SUPPRESSION, so the three pins below are
 * load-bearing: percent, unitless-normalised and capped factors must ALL still
 * render their ranges. Removing real information from every correctly-behaving
 * card on the board would be a worse defect than the one being fixed.
 */
describe('FactorNode prior range: a normalised range beside a real-scale value', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('WITNESSED CASE — 18 month, no cap, prior 0.08 to 0.28: the contradicting Range line cannot render', () => {
    const { container } = renderFactor({
      label: 'Sales Payback Period',
      type: 'factor',
      category: 'external',
      prior: { range_min: 0.08, range_max: 0.28 },
      observedState: { raw_value: 18, value: 0.3, unit: 'month', factor_type: 'external' },
    })
    const text = container.textContent ?? ''
    // Bind by identity: this is the exact pair the witness captured.
    expect(countOccurrences(container, '18 month')).toBe(1)
    expect(text).not.toContain('Range: 0.08 to 0.28')
    expect(text).not.toContain('Range:')
  })

  it('WITNESSED CASE — the value line SURVIVES the suppression: the card never goes blank', () => {
    // ⭐ THE PRECONDITION THIS WHOLE DECISION RESTS ON, pinned in-test rather
    // than assumed. Suppression is only reachable when a value line is already
    // rendering, so silence removes a false line and never empties the card.
    // This is what makes silence the right answer instead of a replacement
    // sentence: the card still carries its figure.
    const { container } = renderFactor({
      label: 'Sales Payback Period',
      type: 'factor',
      category: 'external',
      prior: { range_min: 0.08, range_max: 0.28 },
      observedState: { raw_value: 18, value: 0.3, unit: 'month', factor_type: 'external' },
    })
    expect(screen.getByText('18 month')).toBeDefined()
    // The exact before/after of this card, pinned. BEFORE (measured at
    // pristine, and the string the journey witnessed):
    //   "Sales Payback Period18 monthRange: 0.08 to 0.28"
    // AFTER: the contradicting line is gone and the figure remains.
    expect(container.textContent ?? '').toContain('Sales Payback Period18 month')
  })

  it('OVER-SUPPRESSION PIN 1 of 3 — a PERCENT factor still renders its range', () => {
    // Percent is the calibrated path and it is correct: a 0–1 ratio converts to
    // percentage points with no cap at all. It must never reach the suppression.
    const { container } = renderFactor({
      label: 'Conversion rate',
      type: 'factor',
      category: 'external',
      prior: { range_min: 0.08, range_max: 0.28 },
      observedState: { raw_value: 0.4, value: 0.4, unit: '%', factor_type: 'external' },
    })
    expect(countOccurrences(container, 'Range: 8% to 28%')).toBe(1)
  })

  it('OVER-SUPPRESSION PIN 2 of 3 — a UNITLESS/NORMALISED factor still renders its range', () => {
    // The value and the range are on the SAME normalised scale, so nothing is
    // contradicted and the range is real information. This is the pin that
    // fails first if the suppression is keyed on "a value is displayed"
    // rather than on "the displayed value is off this scale".
    const { container } = renderFactor({
      label: 'Market volatility',
      type: 'factor',
      category: 'external',
      prior: { range_min: 0.08, range_max: 0.28 },
      observedState: { raw_value: 0.5, value: 0.5, factor_type: 'external' },
    })
    const text = container.textContent ?? ''
    expect(text).toContain('0.5')
    expect(countOccurrences(container, 'Range: 0.08 to 0.28')).toBe(1)
  })

  it('OVER-SUPPRESSION PIN 3 of 3 — a factor with a REAL CAP still calibrates', () => {
    const { container } = renderFactor({
      label: 'Competitor Ad Spend',
      type: 'factor',
      category: 'external',
      prior: { range_min: 0.2, range_max: 0.8 },
      observedState: { raw_value: 26000, value: 0.26, unit: '£', cap: 100000, factor_type: 'external' },
    })
    expect(countOccurrences(container, '£26,000')).toBe(1)
    expect(countOccurrences(container, 'Range: £20,000 to £80,000')).toBe(1)
  })

  it('a QUALITATIVE value line establishes no contradiction: the range still renders', () => {
    // No number in the value line, so no scale disagreement can be POSITIVELY
    // established. Anything the guard cannot judge keeps today's behaviour.
    const { container } = renderFactor({
      label: 'Supplier posture',
      type: 'factor',
      category: 'external',
      prior: { range_min: 0.08, range_max: 0.28 },
      display_value: 'No dedicated supplier',
      observedState: { value: 0.2, factor_type: 'external' },
    })
    const text = container.textContent ?? ''
    expect(text).toContain('No dedicated supplier')
    expect(countOccurrences(container, 'Range: 0.08 to 0.28')).toBe(1)
  })

  it('a range-shaped value line is not a single value: two numbers establish no contradiction', () => {
    // "3 to 5" describes a prior, not an observed point. Judging it would need
    // a vocabulary over natural language, which is the class of predicate this
    // estate keeps getting wrong. It stays out of scope, explicitly.
    const { container } = renderFactor({
      label: 'Lead time',
      type: 'factor',
      category: 'external',
      prior: { range_min: 0.08, range_max: 0.28 },
      display_value: '3 to 5',
      observedState: { value: 0.2, factor_type: 'external' },
    })
    expect(countOccurrences(container, 'Range: 0.08 to 0.28')).toBe(1)
  })
})

/**
 * ⭐⭐ SYMMETRY: THE PREDICATE MUST TEST SCALE, NOT MAGNITUDE.
 *
 * The suppression above shipped with its bound derived from the endpoints —
 * `Math.max(1, |rangeMin|, |rangeMax|)`. Against an out-of-scale prior that
 * silently changed the question from "is this value on a different SCALE?" to
 * "is this value ABOVE the range?", and the tell was an asymmetry:
 *
 *     £31 against a prior of 10 to 30  ->  LOST its range line
 *     £9  against the same prior       ->  KEPT its range line
 *
 * ⛔ NOTHING ABOUT SCALE IS ASYMMETRIC. A predicate that answers differently
 * for a value below its range and a value above it is not measuring scale,
 * whatever its name says — and it removed information exactly when the
 * observation had exceeded expectation, which is the case a reader most needs
 * to see. It also put this surface in contradiction with `NodeInspector`, whose
 * ruling on out-of-scale endpoints is "caveat, never hide" and which cites this
 * very function as its precedent.
 *
 * ⚠ THE PRIOR SHAPE IS WITNESSED, NOT INVENTED. `PriorDistributionSchema`
 * bounds only the numeric branch; the object branch is a `.passthrough()`.
 * `fac_price {distribution: 'uniform', range_min: 10, range_max: 30}` is in the
 * evidence corpus, and out-of-scale endpoints are reachable with no CEE at all
 * because `FactorExternalPanel`'s blur handlers write through `setPriorRange`
 * unclamped.
 *
 * ⭐ BOTH DIRECTIONS ARE PINNED, DELIBERATELY. A fix that only handles "above"
 * reproduces the defect, and the pair is what binds the property: one of these
 * two tests alone would pass under the defective predicate.
 */
describe('FactorNode prior range: scale, not magnitude — the symmetry pair', () => {
  beforeEach(() => { vi.clearAllMocks() })

  const outOfScalePriorFactor = (rawValue: number) => ({
    label: 'Unit price',
    type: 'factor',
    category: 'external',
    // The witnessed out-of-scale prior. Real-scale endpoints, no cap, so the
    // range prints unitless and is NOT a claim about the 0–1 scale.
    prior: { range_min: 10, range_max: 30 },
    observedState: { raw_value: rawValue, value: 0.6, unit: '£', factor_type: 'external' },
  })

  it('SYMMETRY 1 of 2 — a value ABOVE an out-of-scale range keeps its range line', () => {
    const { container } = renderFactor(outOfScalePriorFactor(31))
    expect(countOccurrences(container, 'Range: 10 to 30')).toBe(1)
  })

  it('SYMMETRY 2 of 2 — a value BELOW the same out-of-scale range keeps its range line', () => {
    const { container } = renderFactor(outOfScalePriorFactor(9))
    expect(countOccurrences(container, 'Range: 10 to 30')).toBe(1)
  })

  const normalisedPriorFactor = (value: number) => ({
    label: 'Market volatility',
    type: 'factor',
    category: 'external',
    prior: { range_min: 0.08, range_max: 0.28 },
    observedState: { raw_value: value, value, factor_type: 'external' },
  })

  it('SYMMETRY 3 of 4 — on a normalised prior, a value above the range but ON the 0–1 scale keeps its range line', () => {
    const { container } = renderFactor(normalisedPriorFactor(0.5))
    expect(countOccurrences(container, 'Range: 0.08 to 0.28')).toBe(1)
  })

  it('SYMMETRY 4 of 4 — on a normalised prior, a value below the range and ON the 0–1 scale keeps its range line', () => {
    const { container } = renderFactor(normalisedPriorFactor(0.05))
    expect(countOccurrences(container, 'Range: 0.08 to 0.28')).toBe(1)
  })

  it('the ONE asymmetry left is the SCALE CEILING, and it is not a range endpoint', () => {
    // ⭐ 2 is off the 0–1 scale entirely, so the contradiction IS positively
    // established — while 0.05, which sits further from the range than 2 does
    // in ratio terms, is a perfectly ordinary member of that scale and keeps
    // its line (pinned directly above). The discriminator is membership of
    // 0–1, never distance from the data.
    const { container } = renderFactor(normalisedPriorFactor(2))
    expect(container.textContent ?? '').not.toContain('Range: 0.08 to 0.28')
  })

  it('an out-of-scale prior is not judged against the 0–1 ceiling either: a sub-1 value keeps the line', () => {
    // The gate is checked BEFORE the ceiling, so a prior that never claimed the
    // 0–1 scale is never measured against it in either direction.
    const { container } = renderFactor(outOfScalePriorFactor(0.5))
    expect(countOccurrences(container, 'Range: 10 to 30')).toBe(1)
  })

  it('a MIN ABOVE 1 fails the four-limb gate, so the range renders', () => {
    // {30, 1} is the shape that made NodeInspector render "30 to 1 on 0–1
    // scale", and it is reachable with no CEE at all: a user whose max is 1
    // typing 30 into min produces it verbatim through FactorExternalPanel.
    // A one-sided gate (`range_min >= 0 && range_max <= 1`) admits it as
    // normalised and would suppress this line. Four limbs, one owner.
    const { container } = renderFactor({
      label: 'Mistyped bound',
      type: 'factor',
      category: 'external',
      prior: { range_min: 30, range_max: 1 },
      observedState: { raw_value: 18, value: 0.3, unit: 'month', factor_type: 'external' },
    })
    expect(countOccurrences(container, 'Range: 30 to 1')).toBe(1)
  })

  it('a NEGATIVE endpoint fails the four-limb gate, so the range renders', () => {
    // {0.5, -2} is exactly the malformed shape that made NodeInspector render
    // "0.5 to -2 on 0–1 scale". Each endpoint needs BOTH bounds; a one-sided
    // bound would let this through as normalised.
    const { container } = renderFactor({
      label: 'Drift',
      type: 'factor',
      category: 'external',
      prior: { range_min: -2, range_max: 0.5 },
      observedState: { raw_value: 18, value: 0.3, unit: 'month', factor_type: 'external' },
    })
    expect(countOccurrences(container, 'Range: -2 to 0.5')).toBe(1)
  })
})
