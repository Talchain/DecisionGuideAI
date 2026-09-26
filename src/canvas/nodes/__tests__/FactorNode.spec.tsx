/**
 * FactorNode render tests
 * T2: cleanFactorLabel applied to displayed label
 * T3: category label in header row
 * T4: human-readable value display
 * T5: "estimated" pill for inferred values
 * T6: Sensitivity/Evidence tier labels (results mode)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { CANVAS_CORNER_STACK_CLASSES } from '../shared/canvasGlyphScale'
import { sensitivityRankBadgeLabel } from '../shared/metricVocabulary'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { FactorNode } from '../FactorNode'
import { nodeColors } from '../colors'
import { useGuidanceStore } from '../../stores/guidanceStore'

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
      // ⭐ THE CURRENCY PRECONDITION FOR THE RANKED INFLUENCE READOUT, SEEDED
      // EXPLICITLY IN EVERY STORE STATE IN THIS FILE.
      //
      // `FactorNode` withholds the ranked readout unless
      // `useAnalysisResultsAreCurrent()` is true, and that hook is imported for
      // real here — it reads these three fields through the mocked store and
      // calls the real `classifyFreshnessForDisplay`. An omitted slice
      // classifies as 'none' and the card falls back, which would make every
      // ranked assertion in this file fail rather than sit silently on the
      // fallback branch. Stated, not defaulted: a precondition a fixture leaves
      // implicit is the fixture-blindness defect this file already carries a
      // note about (CLAUDE.md trap 3b, arriving through the fixture).
      analysisFreshness: { freshness: 'fresh' },
      analysisFreshnessDirty: false,
      importPendingServerRegistration: false,
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

// Make NodePopover transparent in tests so we can directly assert what its
// content would render (otherwise the popover is hidden until 300ms hover).
vi.mock('../shared/NodePopover', () => ({
  NodePopover: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="factor-node-popover">{children}</div>
  ),
}))

/**
 * ⭐ PROTOTYPE (Paul, 25 Sep 2026 — superseding ED #63 5809278282's bounded
 * anatomy for card bodies): the Standard driver line is back ON the card FACE.
 * Every "the face states the rank" claim below is bound here: the line is bound
 * INSIDE BaseNode's face and asserted ABSENT from the popover (never both). The
 * helper keeps its name.
 */
const popoverDriverLine = () => {
  const face = screen.getByTestId('node-title').closest('[role="group"]') as HTMLElement
  const pop = screen.queryByTestId('factor-node-popover')
  if (pop) expect(within(pop).queryByTestId('factor-driver-line'), 'the driver line is repeated in the popover').toBeNull()
  return within(face).getByTestId('factor-driver-line')
}

// Default: graph badges OFF, lens OFF. Individual tests override as needed.
// Spread the real flags module: `FactorNode` now reads the composed analysis
// verdict (`useModelChangedSinceRun`), whose source classifier calls a flag
// this factory never listed. A `vi.mock` factory REPLACES the module, so an
// unlisted flag is `undefined` and throws at render (CLAUDE.md trap 12).
vi.mock('../../../flags', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../flags')>()),
  isGraphBadgesEnabled: vi.fn(() => false),
  isCrossHighlightEnabled: vi.fn(() => false),
  isGraphLensEnabled: vi.fn(() => false),
}))

import { useCanvasStore } from '../../store'
import { useNodeDisplayMetadata } from '../../hooks/useNodeDisplayMetadata'
import { useScienceIcons } from '../../hooks/useScienceIcons'
import { isGraphBadgesEnabled } from '../../../flags'
import { FileQuestion } from 'lucide-react'

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

/**
 * Locked Canvas design (23 Sep 2026), spec §2 / ED 02:31Z D4: the card's ONE
 * coaching question is the rail's coaching icon (`node-coaching-icon-<id>`),
 * and the icon asks only where an ask surface is registered (`canReceiveAsk`).
 * Registered per test that needs it, and reset after EVERY test so no other
 * case in this file renders differently because of it.
 */
const registerAskSurface = () =>
  useGuidanceStore.setState({ _prefillChat: vi.fn(), _sendMessage: vi.fn(), _dispatchAction: vi.fn(), guidanceItems: [] } as never)
afterEach(() => {
  useGuidanceStore.setState({ _prefillChat: null, _sendMessage: null, _dispatchAction: null } as never)
})
const COACHING_ICON = 'node-coaching-icon-factor-1'

/** The driver line's caption / fill, bound by the line's own test id. */
const captionOf = (line: HTMLElement) => within(line).getByTestId(/-caption$/).textContent
const fillOf = (line: HTMLElement) =>
  (within(line).getByTestId(/-bar$/).firstElementChild as HTMLElement).style.width

describe('FactorNode', () => {
  beforeEach(() => { vi.clearAllMocks() })

  // T1: No all-caps text
  it('renders label', () => {
    renderFactor({ label: 'Hiring rate', type: 'factor' })
    const label = screen.getByText('Hiring rate')
    expect(label).toBeDefined()
    // Type label removed — shape icon + tooltip only (spec Section 3.2)
  })

  // T2: Strip normalisation metadata
  it('strips "(0–1 scale)" from label', () => {
    renderFactor({ label: 'Hiring rate (0–1 scale)', type: 'factor' })
    expect(screen.getByText('Hiring rate')).toBeDefined()
    expect(screen.queryByText(/0–1 scale/)).toBeNull()
  })

  it('strips "(0/1)" from label', () => {
    renderFactor({ label: 'Hired (0/1)', type: 'factor' })
    expect(screen.getByText('Hired')).toBeDefined()
  })

  // F2: Category icons removed — science icons replace them (spec Section 3.2)
  it('does not render old category icon tooltips (controllable)', () => {
    const { container } = renderFactor({ label: 'Budget', type: 'factor', category: 'controllable' })
    expect(container.querySelector('[title="You control this factor"]')).toBeNull()
  })

  it('does not render old category icon tooltips (observable)', () => {
    const { container } = renderFactor({ label: 'Revenue', type: 'factor', category: 'observable' })
    expect(container.querySelector('[title="You can measure this"]')).toBeNull()
  })

  it('shows dashed-border tooltip for external factors', () => {
    const { container } = renderFactor({ label: 'Market rate', type: 'factor', category: 'external' })
    // "Outside your control" is now a border tooltip (not body text) per spec
    expect(container.querySelector('[title="Outside your control"]')).not.toBeNull()
  })

  it('omits old category icon tooltips when category is absent', () => {
    const { container } = renderFactor({ label: 'Unknown', type: 'factor' })
    expect(container.querySelector('[title="You control this factor"]')).toBeNull()
    expect(container.querySelector('[title="You can measure this"]')).toBeNull()
    expect(container.querySelector('[title="Outside your control"]')).toBeNull()
  })

  // T4: Human-readable value
  it('shows raw_value with unit', () => {
    renderFactor({
      label: 'Revenue',
      type: 'factor',
      observedState: { raw_value: '120', unit: 'k', value: 0.6 },
    })
    expect(screen.getByText('120 k')).toBeDefined()
  })

  // J2: Currency raw_value prefix — £49 not 49 £
  it('renders currency raw_value as prefix (£49), not suffix', () => {
    renderFactor({
      label: 'Revenue',
      type: 'factor',
      observedState: { raw_value: '49', unit: '£', value: 0.49 },
    })
    expect(screen.getByText('£49')).toBeDefined()
    expect(screen.queryByText('49 £')).toBeNull()
  })

  it('renders dollar currency raw_value as prefix ($500)', () => {
    renderFactor({
      label: 'Cost',
      type: 'factor',
      observedState: { raw_value: '500', unit: '$' },
    })
    expect(screen.getByText('$500')).toBeDefined()
  })

  // J2 + Item 5: Numeric currency raw_value gets thousands separators
  it('applies thousands separator to numeric currency raw_value (£1,200)', () => {
    renderFactor({
      label: 'Revenue',
      type: 'factor',
      observedState: { raw_value: '1200', unit: '£' },
    })
    expect(screen.getByText('£1,200')).toBeDefined()
    expect(screen.queryByText('£1200')).toBeNull()
  })

  it('renders non-numeric currency raw_value as suffix (approx 50 £)', () => {
    renderFactor({
      label: 'Cost',
      type: 'factor',
      observedState: { raw_value: 'approx 50', unit: '£' },
    })
    // Non-numeric raw_value uses suffix format in formatFactorDisplayValue
    expect(screen.getByText('approx 50 £')).toBeDefined()
  })

  it('shows raw_value alone when no unit', () => {
    renderFactor({
      label: 'Score',
      type: 'factor',
      observedState: { raw_value: '85', value: 0.85 },
    })
    expect(screen.getByText('85')).toBeDefined()
  })

  it('renders contextual text for explicitly-binary 0 without raw_value', () => {
    renderFactor({
      label: 'Hired',
      type: 'factor',
      // Polish 4 review: contextual text now requires factor_type='binary'.
      observedState: { value: 0, factor_type: 'binary' },
    })
    expect(screen.getByText('No hired in place')).toBeDefined()
  })

  // Task 4: factor_type descriptor must never appear as a display unit
  it('does not show "binary" as unit when unit field contains "binary"', () => {
    renderFactor({
      label: 'Hire decision',
      type: 'factor',
      // Polish 4 review: when unit is 'binary' (a factor_type leak),
      // isSuppressedUnit drops it. We also need factor_type='binary' for the
      // contextual heuristic to fire.
      observedState: { value: 0, unit: 'binary', factor_type: 'binary' },
    })
    expect(screen.queryByText(/binary/)).toBeNull()
    expect(screen.getByText('No hire decision in place')).toBeDefined()
  })

  it('does not show "normalized" as unit when unit field contains "normalized"', () => {
    renderFactor({
      label: 'Fit score',
      type: 'factor',
      observedState: { value: 0.3, unit: 'normalized' },
    })
    // "normalized" suppressed by isSuppressedUnit; non-binary value without raw_value → no display
    expect(screen.queryByText(/normalized/)).toBeNull()
    expect(screen.queryByText('Low')).toBeNull()
    expect(screen.queryByText('0.3')).toBeNull()
  })

  // P1.5: value===0 with unit but no raw_value → contextual text (formatFactorDisplayValue)
  it('shows contextual text for value===0 when unit is "%" but no raw_value', () => {
    renderFactor({
      label: 'Churn rate',
      type: 'factor',
      observedState: { value: 0, unit: '%' },
    })
    // No raw_value → value-only path → "No churn in place" (suffix "Rate" stripped)
    expect(screen.getByText('No churn in place')).toBeDefined()
  })

  // Polish 4 review: continuous quality factors at value=0 should NOT render
  // "No X in place" — that misrepresents a continuum as a binary. The
  // contextual heuristic now only fires when factor_type === 'binary'.
  it('suppresses contextual text for value===0 with qualitative factor_type and no unit', () => {
    renderFactor({
      label: 'Product fit',
      type: 'factor',
      observedState: { value: 0, factor_type: 'quality' },
    })
    expect(screen.queryByText('No product fit in place')).toBeNull()
  })

  it('renders contextual text for explicitly-binary 1 without raw_value', () => {
    renderFactor({
      label: 'Hired',
      type: 'factor',
      observedState: { value: 1, factor_type: 'binary' },
    })
    expect(screen.getByText('Hired active')).toBeDefined()
  })

  // T4: External factor with no observedState — dashed border only, no body text
  it('renders external factor with no observedState without body text', () => {
    renderFactor({ label: 'Market', type: 'factor', category: 'external' })
    // "Outside your control." text removed — dashed border is the visual signal
    expect(screen.queryByText('Outside your control.')).toBeNull()
  })

  it('asks "Help me estimate this" for factor with observedState but no value', () => {
    registerAskSurface()
    renderFactor({
      label: 'Metric',
      type: 'factor',
      observedState: { unit: 'k' },
    })
    // "Missing value. Weakens analysis." text removed — chip only
    expect(screen.queryByText('Missing value. Weakens analysis.')).toBeNull()
    // Locked Canvas design (23 Sep 2026), spec §2 / ED 11:52Z point 3: the chip
    // row is off the face; the rail's coaching icon asks the same question.
    expect(screen.queryByTestId('factor-card-question')).toBeNull()
    expect(screen.getByTestId(COACHING_ICON)).toHaveAccessibleName('Help me estimate this')
  })

  // T6: Influence/Confidence bars in results mode — only in Layer 2 (Detailed view)
  it('shows Influence and Confidence bars in Detailed results mode', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector: any) =>
      selector({
        hoveredOptionId: null,
        nodes: [],
        edges: [],
        ceeAnalysisReady: null,
        results: { status: 'complete', report: null },
        // The ranked readout's currency precondition — see the note on the
        // module-level store mock at the top of this file.
        analysisFreshness: { freshness: 'fresh' },
        analysisFreshnessDirty: false,
        importPendingServerRegistration: false,
        highlightedNodes: new Set(),
        dimmedNodeIds: new Set(),
        goalThreshold: null,
        goalConstraints: [],
        viewMode: 'expert', // Detailed mode → Layer 2 inline
      })
    )
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      // Contract v3.1 pt 5: only a RANKED factor carries a driver line, so this
      // fixture is ranked (licence set 5, ranked count 3).
      sensitivityRank: 1,
      influence: 0.8,
      influenceProvenance: 'influence_score',
      influenceImportanceBasis: null,
      influenceSetSize: 5,
      influenceRankedCount: 3,
      confidence: 0.45,
      confidenceIsDefaulted: false,
      confidenceIsProvisional: false,
      inSensitivityAnalysis: true,
      achievementProbability: null,
      achievementProbabilityIsModelledBasis: false,
      stabilityPercentage: null,
      winRate: null,
      isResultsMode: true,
      predictedOutcome: null,
      valueOfInformation: null,
      voiRank: null,
    })
    renderFactor({ label: 'Salary', type: 'factor', observedState: { value: 0.5 } })
    // In Detailed mode, Layer 2 is inline so bars appear
    /* ⭐ Locked Canvas design (23 Sep 2026), spec §3 + ED 11:52Z point 3: the
       Detailed influence row is the SAME `FactorDriverLine` the face uses
       (`factor-driver-line-detail`). Its VISIBLE caption is the quantity's own
       noun — "Structural influence" on the producer basis, never a bare bar —
       and the 80% moves into its accessible name beside "of the strongest
       factor", so the per-set-normalised figure is never read as absolute.
       (History: this row read "Relative influence 80%"; measured on staging
       `6497a251` the unqualified "Influence 100%" read as absolute.) */
    const line = screen.getByTestId('factor-driver-line-detail')
    // Contract v3.1 pt 5: the caption is the rank; the quantity's noun moved to
    // the disclosure ("Bar: structural influence, 80% …").
    expect(captionOf(line)).toBe('Driver 1 of 5 analysed')
    expect(line).toHaveAccessibleName(/structural influence, 80% of the strongest factor/)
    expect(line.textContent).not.toContain('80%')
    expect(screen.getByText('Confidence')).toBeDefined()
    expect(screen.getByText('45%')).toBeDefined()
  })

  it('hides Influence/Confidence bars outside results mode', () => {
    renderFactor({ label: 'Salary', type: 'factor' })
    // Locked Canvas design (23 Sep 2026): the influence reading is the driver
    // line now, which carries neither word — bound by its test ids so this
    // absence cannot go vacuous.
    expect(screen.queryByTestId('factor-driver-line')).toBeNull()
    expect(screen.queryByTestId('factor-driver-line-detail')).toBeNull()
    expect(screen.queryByText('Influence')).toBeNull()
    // ⚠ AND the relative spelling, or this absence assertion goes vacuous:
    // the card no longer renders the bare noun under a stamped basis, so a
    // query for it would pass whether the row is absent or merely renamed.
    expect(screen.queryByText('Relative influence')).toBeNull()
    expect(screen.queryByText('Confidence')).toBeNull()
  })

  it('has displayName set', () => {
    expect(FactorNode.displayName).toBe('FactorNode')
  })

  // Null-safe paths — most likely regression sources in production
  it('renders "Untitled" when data.label is absent', () => {
    renderFactor({})
    expect(screen.getByText('Untitled')).toBeDefined()
  })

  it('renders "Untitled" when data.label is empty string', () => {
    renderFactor({ label: '' })
    expect(screen.getByText('Untitled')).toBeDefined()
  })

  it('does not crash when observedState is null', () => {
    expect(() => renderFactor({ label: 'X', type: 'factor', observedState: null })).not.toThrow()
  })

  it('does not crash when observedState is undefined', () => {
    expect(() => renderFactor({ label: 'X', type: 'factor' })).not.toThrow()
  })

  it('asks "Help me estimate this" when observedState has only unit (no value)', () => {
    registerAskSurface()
    renderFactor({ label: 'X', type: 'factor', observedState: { unit: 'k' } })
    expect(screen.queryByText('Missing value. Weakens analysis.')).toBeNull()
    // Locked Canvas design (23 Sep 2026): the question's home is the rail icon.
    expect(screen.queryByTestId('factor-card-question')).toBeNull()
    expect(screen.getByTestId(COACHING_ICON)).toHaveAccessibleName('Help me estimate this')
  })

  it('does not show Influence/Confidence bars in results mode when both influence and confidence are null', () => {
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null,
      influence: null,
      confidence: null,
      inSensitivityAnalysis: false,
      achievementProbability: null,
      stabilityPercentage: null,
      winRate: null,
      isResultsMode: true,
      predictedOutcome: null,
      valueOfInformation: null,
      voiRank: null,
    })
    renderFactor({ label: 'X', type: 'factor' })
    // Locked Canvas design (23 Sep 2026): bound by the driver line's test ids.
    expect(screen.queryByTestId('factor-driver-line')).toBeNull()
    expect(screen.queryByTestId('factor-driver-line-detail')).toBeNull()
    expect(screen.queryByText('Influence')).toBeNull()
    // ⚠ AND the relative spelling, or this absence assertion goes vacuous:
    // the card no longer renders the bare noun under a stamped basis, so a
    // query for it would pass whether the row is absent or merely renamed.
    expect(screen.queryByText('Relative influence')).toBeNull()
    expect(screen.queryByText('Confidence')).toBeNull()
  })

  it('does not show Influence bar when influence is exactly 0', () => {
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null,
      influence: 0,
      confidence: null,
      inSensitivityAnalysis: false,
      achievementProbability: null,
      stabilityPercentage: null,
      winRate: null,
      isResultsMode: true,
      predictedOutcome: null,
      valueOfInformation: null,
      voiRank: null,
    })
    renderFactor({ label: 'X', type: 'factor' })
    // Locked Canvas design (23 Sep 2026): bound by the driver line's test ids.
    expect(screen.queryByTestId('factor-driver-line')).toBeNull()
    expect(screen.queryByTestId('factor-driver-line-detail')).toBeNull()
    expect(screen.queryByText('Influence')).toBeNull()
    // ⚠ AND the relative spelling, or this absence assertion goes vacuous:
    // the card no longer renders the bare noun under a stamped basis, so a
    // query for it would pass whether the row is absent or merely renamed.
    expect(screen.queryByText('Relative influence')).toBeNull()
  })

  it('omits category label when category is an unrecognised string', () => {
    renderFactor({ label: 'X', type: 'factor', category: 'unknown_category' })
    expect(screen.queryByText('Controllable')).toBeNull()
    expect(screen.queryByText('Measurable')).toBeNull()
  })

  // P3: Rank badge in the top-right corner stack.
  // ⭐ Locked Canvas design (23 Sep 2026), ED 02:31Z D1a: "RETIRE the Key-driver
  // badge once the body driver line is present." The rank is stated ONCE, by the
  // driver line on the card face ("Driver N of M analysed"), and the corner
  // stack no longer holds a badge. What this test still pins: the stack owns the
  // corner (its own constant), and the rank reaches the reader — now on the line.
  it('the retired rank badge does NOT render; the rank is stated by the driver line (P3, ED 02:31Z D1a)', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector: any) =>
      selector({
        hoveredOptionId: null,
        nodes: [],
        edges: [],
        ceeAnalysisReady: null,
        results: { status: 'complete', report: null },
        // The driver line's currency precondition — see the module-level note.
        analysisFreshness: { freshness: 'fresh' },
        analysisFreshnessDirty: false,
        importPendingServerRegistration: false,
        highlightedNodes: new Set(),
        dimmedNodeIds: new Set(),
        goalThreshold: null,
        goalConstraints: [],
        viewMode: 'standard',
      })
    )
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: 1,
      influence: 1,
      influenceProvenance: 'normalised_elasticity',
      influenceImportanceBasis: null,
      influenceSetSize: 5,
      influenceRankedCount: 3,
      confidence: null,
      confidenceIsDefaulted: false,
      confidenceIsProvisional: false,
      inSensitivityAnalysis: true,
      achievementProbability: null,
      achievementProbabilityIsModelledBasis: false,
      stabilityPercentage: null,
      winRate: null,
      isResultsMode: true,
      predictedOutcome: null,
      valueOfInformation: null,
      voiRank: null,
    })
    const { container } = renderFactor({
      label: 'Revenue',
      type: 'factor',
      category: 'controllable',
    })
    // The badge is gone — no test id, no word, no bare numeral.
    expect(screen.queryByTestId('sensitivity-rank-factor-1')).toBeNull()
    expect(screen.queryByText(sensitivityRankBadgeLabel(1))).toBeNull()
    expect(container.textContent).not.toContain('#1')
    // The rank is stated by the driver line instead — on the face again
    // (prototype, Paul 25 Sep; the inline cue is retired).
    // ED #63 5806207128: "Driver N of M analysed", M = the eligible analysed factors.
    expect(captionOf(popoverDriverLine())).toBe('Driver 1 of 5 analysed')
    expect(screen.queryByTestId('factor-driver-cue-factor-1')).toBeNull()
    // Positioning is still owned by the shared corner STACK (Codex P1-5) — the
    // members that remain in it are static flex children.
    // ⚠ DERIVED FROM THE COMPONENT'S OWN CONSTANT, NOT A COPY OF IT. This read
    // `toContain('-top-2')` / `toContain('-right-2')` — the measuring stick,
    // not the property in this test's title. The `-top-2` half was an UNSCALED
    // 8px anchor holding counter-scaled content, which put the `Needs input`
    // pill in the card header at the settle zoom and nowhere at zoom >= 1.
    // Asserting the exported constant keeps the invariant that matters (the
    // stack owns the corner; its children carry no positioning) while letting
    // the anchor move in one place.
    const stack = screen.getByTestId('node-corner-stack-factor-1')
    expect(stack.className).toContain('absolute')
    expect(stack.className).toBe(CANVAS_CORNER_STACK_CLASSES)
    Array.from(stack.children).forEach(child => {
      expect(child.className).not.toContain('absolute')
    })
    // Category icons removed — science icons replace them
  })

  // P2: Non-binary value with no raw_value, no unit → no display (formatFactorDisplayValue returns null)
  it('shows no value text for factor with non-binary value, no raw_value and no unit (P2)', () => {
    renderFactor({
      label: 'Product-market fit',
      type: 'factor',
      observedState: { value: 0.5 },
    })
    // Non-binary values without raw_value return null — no body text displayed
    expect(screen.queryByText('Medium')).toBeNull()
    expect(screen.queryByText('0.5')).toBeNull()
  })

  it('shows raw value unchanged when unit is present (P2 — no regression)', () => {
    renderFactor({
      label: 'Engineering capacity',
      type: 'factor',
      observedState: { raw_value: '10', unit: 'engineers', value: 0.5 },
    })
    expect(screen.getByText('10 engineers')).toBeDefined()
    expect(screen.queryByText('Medium')).toBeNull()
  })

  // P4: Evidence bar uses bg-info (not bg-factor) — Detailed results mode.
  // Paul 23 Sep contract feedback point 9: driver bar neutral — the driver
  // bar's fill is now the muted neutral token so it does not compete with the
  // Info-blue attention marker; the confidence/evidence bar keeps bg-info.
  it('evidence bar uses bg-info; the driver bar is neutral (P4 + Paul 23 Sep point 9)', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector: any) =>
      selector({
        hoveredOptionId: null,
        nodes: [],
        edges: [],
        ceeAnalysisReady: null,
        results: { status: 'complete', report: null },
        // The ranked readout's currency precondition — see the note on the
        // module-level store mock at the top of this file.
        analysisFreshness: { freshness: 'fresh' },
        analysisFreshnessDirty: false,
        importPendingServerRegistration: false,
        highlightedNodes: new Set(),
        dimmedNodeIds: new Set(),
        goalThreshold: null,
        goalConstraints: [],
        viewMode: 'expert', // Detailed mode → Layer 2 inline
      })
    )
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      // Contract v3.1 pt 5: ranked, so the driver line (and its bar) renders.
      sensitivityRank: 1,
      influence: 0.8,
      influenceProvenance: 'influence_score',
      influenceImportanceBasis: null,
      influenceSetSize: 5,
      influenceRankedCount: 3,
      confidence: 0.6,
      confidenceIsDefaulted: false,
      confidenceIsProvisional: false,
      inSensitivityAnalysis: true,
      achievementProbability: null,
      achievementProbabilityIsModelledBasis: false,
      stabilityPercentage: null,
      winRate: null,
      isResultsMode: true,
      predictedOutcome: null,
      valueOfInformation: null,
      voiRank: null,
    })
    const { container } = renderFactor({ label: 'Revenue', type: 'factor', observedState: { value: 0.5 } })
    const bars = container.querySelectorAll('.bg-info')
    // The evidence bar stays bg-info …
    expect(bars.length).toBeGreaterThanOrEqual(1)
    // … the driver bar does not (contrast control within the same render).
    const driverFill = screen.getByTestId('factor-driver-line-detail-bar-fill')
    expect(driverFill.className).toContain('bg-text-light')
    expect(driverFill.className).not.toContain('bg-info')
    expect(container.querySelector('.bg-factor')).toBeNull()
  })

  // P5: Inferred factor keeps its science disclosure, but B3 withholds the
  // local-only confirmation action because it has no canonical carrier.
  it('inferred factor keeps science and menu affordances while confirm value is withheld (P5)', () => {
    vi.mocked(useScienceIcons).mockReturnValue([{
      id: 'evidence-gap', icon: FileQuestion,
      tooltip: 'No evidence for this factor. Analysis will use defaults.',
      action: 'Help me estimate Salary', colour: 'text-warning', priority: 1,
    }])
    renderFactor({
      label: 'Salary',
      type: 'factor',
      // value=0 + factor_type='binary' produces a concrete contextual value.
      observedState: { value: 0, extractionType: 'inferred', factor_type: 'binary' },
    })
    // Science icon uses aria-label
    expect(screen.getByLabelText(/No evidence for this factor/)).toBeDefined()
    expect(screen.queryByTitle('Confirm value')).toBeNull()
    // Positive control: the menu containing the details route remains mounted.
    expect(screen.getByLabelText('More actions for Salary')).toBeDefined()
  })

  // Graph v1.1 wireframe v4: external factors NEVER get the "needs your
  // judgement" treatment. Dashed border = "outside your control"; the badge =
  // "needs your judgement". The two states must not be confused, even when the
  // value is missing.
  //
  // ⚠ THESE TWO CASES CHANGED SHAPE ON 8 Sep 2026 (Paul's badge re-ruling) AND
  // MUST NOT HAVE BEEN WEAKENED BY IT. What each one was DISCRIMINATING:
  //   · the external case — that a missing value does NOT buy the
  //     "needs your judgement" treatment when the factor is outside the user's
  //     control. Its discriminating power came from `not.toContain(...)` on the
  //     treatment token, paired with the controllable case below, which is the
  //     same component and the same missing value with only `category` changed.
  //   · the controllable case — that a missing value DOES earn it.
  // The treatment token moved from the border to a badge, so both now assert on
  // the badge, and BOTH ALSO assert the kind hue that used to be replaced. That
  // is strictly more than either checked before, and the pairing — one node
  // gets it, its near-twin does not — is preserved exactly.
  //
  // ⚠ AND THE ASSERTIONS BIND TOKEN-EXACT. `toContain` on the className string
  // would let `hover:border-factor/80` satisfy a `'border-factor'` assertion —
  // a predicate a different token can meet (CLAUDE.md trap 19).
  const cardTokens = (container: HTMLElement) =>
    container.querySelector('[role="group"]')!.className.split(/\s+/).filter(Boolean)

  it('external factor with no observed value: keeps border-factor, and gets NO "needs input" badge', () => {
    const { container } = renderFactor({
      label: 'Market rate',
      type: 'factor',
      category: 'external',
      // No observedState.value — but external factors are exempt.
    })
    const tokens = cardTokens(container)
    expect(tokens).not.toContain('border-goal')
    expect(tokens).not.toContain('border-warning')
    // contract v3.1 FRAME-08: the kind hue survives as the factor's FRAME token
    // (76% toward the warm neutral), not the full-strength `border-factor`.
    expect(tokens).toContain(nodeColors.factor.frame)
    expect(screen.queryByTestId('needs-input-pill')).toBeNull()
  })

  it('controllable factor with no observed value: KEEPS border-factor (not amber) and gets the badge', () => {
    const { container } = renderFactor({
      label: 'Hiring rate',
      type: 'factor',
      category: 'controllable',
      // No observedState.value
    })
    const tokens = cardTokens(container)
    expect(tokens).not.toContain('border-goal')
    // ⭐ THE RE-RULING. This replaces `toContain('border-warning')`: the kind hue
    // must SURVIVE the incomplete state rather than be replaced by it — as the
    // factor's frame token since contract v3.1 FRAME-08.
    expect(tokens).toContain(nodeColors.factor.frame)
    expect(tokens).not.toContain('border-warning')
    // ⭐ …and the state must still be announced, or the ruling is half-done.
    expect(screen.getByTestId('needs-input-pill')).toBeTruthy()
  })

  // P0 (feedback): binary factor_type + value=0 → contextual text
  it('shows contextual text for value===0 with factor_type "binary" and no unit', () => {
    renderFactor({
      label: 'Hire decision',
      type: 'factor',
      observedState: { value: 0, factor_type: 'binary' },
    })
    // factor_type "binary" is suppressed by isSuppressedUnit, value-only path
    expect(screen.getByText('No hire decision in place')).toBeDefined()
    expect(screen.queryByText('Very low')).toBeNull()
  })

  it('shows contextual text for value===1 with factor_type "binary" and no unit', () => {
    renderFactor({
      label: 'Hire decision',
      type: 'factor',
      observedState: { value: 1, factor_type: 'binary' },
    })
    expect(screen.getByText('Hire decision active')).toBeDefined()
  })

  // P1.3 (feedback): compact DataBar progressbar elements in Detailed results mode
  it('renders progressbar elements for Influence and Confidence bars in Detailed results mode', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector: any) =>
      selector({
        hoveredOptionId: null,
        nodes: [],
        edges: [],
        ceeAnalysisReady: null,
        results: { status: 'complete', report: null },
        // The ranked readout's currency precondition — see the note on the
        // module-level store mock at the top of this file.
        analysisFreshness: { freshness: 'fresh' },
        analysisFreshnessDirty: false,
        importPendingServerRegistration: false,
        highlightedNodes: new Set(),
        dimmedNodeIds: new Set(),
        goalThreshold: null,
        goalConstraints: [],
        viewMode: 'expert', // Detailed → Layer 2 inline
      })
    )
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      // Contract v3.1 pt 5: ranked, so the driver line (and its bar) renders.
      sensitivityRank: 1,
      influence: 0.8,
      influenceProvenance: 'influence_score',
      influenceImportanceBasis: null,
      influenceSetSize: 5,
      influenceRankedCount: 3,
      confidence: 0.6,
      confidenceIsDefaulted: false,
      confidenceIsProvisional: false,
      inSensitivityAnalysis: true,
      achievementProbability: null,
      achievementProbabilityIsModelledBasis: false,
      stabilityPercentage: null,
      winRate: null,
      isResultsMode: true,
      predictedOutcome: null,
      valueOfInformation: null,
      voiRank: null,
    })
    const { container } = renderFactor({ label: 'Revenue', type: 'factor', observedState: { value: 0.5 } })
    const progressbars = container.querySelectorAll('[role="progressbar"]')
    // Locked Canvas design (23 Sep 2026), spec §3: influence is the driver line
    // (`factor-driver-line-detail`) — its bar is decorative (aria-hidden) and the
    // figure is announced in the line's accessible name, so the Confidence bar
    // is now the one progressbar here. Both readings are still present.
    expect(progressbars.length).toBeGreaterThanOrEqual(1)
    const driver = screen.getByTestId('factor-driver-line-detail')
    expect(driver).toHaveAccessibleName(/80% of the strongest factor/)
    expect(within(driver).getByTestId('factor-driver-line-detail-bar')).toHaveAttribute('aria-hidden', 'true')
    // A confidence without a default/provisional qualifier has no explanation
    // to open. Retain the value, without adding a redundant keyboard stop.
    const confidence = screen.getByRole('group', { name: 'Confidence' })
    expect(confidence).not.toHaveAttribute('tabindex')
    expect(confidence).not.toHaveAttribute('data-node-tooltip')
    expect(confidence).toHaveTextContent('60%')
    expect(within(confidence).getByRole('progressbar').getAttribute('aria-valuenow')).toBe('60')
    // Each bar has a valid aria-valuenow between 0 and 100
    progressbars.forEach(bar => {
      const valuenow = Number(bar.getAttribute('aria-valuenow'))
      expect(valuenow).toBeGreaterThanOrEqual(0)
      expect(valuenow).toBeLessThanOrEqual(100)
    })
  })

  it('renders no progressbar elements outside results mode', () => {
    const { container } = renderFactor({ label: 'Revenue', type: 'factor' })
    expect(container.querySelectorAll('[role="progressbar"]').length).toBe(0)
  })

  // Lane C4 (influence-scale disclosure): the "I: NN%" pill shares the panel's
  // display number; when the shared model resolved it on the fallback
  // (set-relative) basis, FactorNode must pass that provenance through so the
  // pill discloses "top driver always shows 100%" instead of reading as an
  // absolute causal share.
  it('discloses the relative influence scale on the Standard driver line (C4)', async () => {
    vi.mocked(useCanvasStore).mockImplementation((selector: any) =>
      selector({
        hoveredOptionId: null,
        nodes: [],
        edges: [],
        ceeAnalysisReady: null,
        results: { status: 'complete', report: null },
        // The ranked readout's currency precondition — see the note on the
        // module-level store mock at the top of this file.
        analysisFreshness: { freshness: 'fresh' },
        analysisFreshnessDirty: false,
        importPendingServerRegistration: false,
        highlightedNodes: new Set(),
        dimmedNodeIds: new Set(),
        goalThreshold: null,
        goalConstraints: [],
        viewMode: 'standard',
      })
    )
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: 1,
      influence: 1,
      influenceProvenance: 'normalised_elasticity',
      influenceImportanceBasis: null,
      /* ⛔⛔ THE FIXTURE'S STANCE ON THE DENOMINATOR IS NOW EXPLICIT, AND THAT
         IS THE FIX (2026-09-18).

         `influenceSetSize` arrived OPTIONAL, so this mock — written before it
         existed — silently omitted it, `influenceRankReadout(1, undefined)`
         returned null, and this test went on asserting the pre-ranking render
         on a path the deployed card could no longer take. The suite would have
         stayed green while the card said `Most influential … of 5`: CLAUDE.md
         trap 3b reaching the surface THROUGH THE FIXTURE rather than through a
         flag.

         ⚠ AND THE OMISSION WAS NOT MERELY UNDER-SPECIFIED, IT WAS FICTIONAL.
         The producer assigns the denominator unconditionally in its factor
         branch, BEFORE the rank gate, so `sensitivityRank != null` implies
         `influenceSetSize != null` — pinned in
         `useNodeDisplayMetadata.influenceSetSize.spec.ts`. A rank without a
         size is a state the hook cannot emit (trap 16-inverse: a fixture you
         wrote yourself is not evidence about the wire).

         ⚠ RE-POINTED, NEVER RELAXED — the phrase this file already uses. The
         claim underneath is unchanged: the per-set-normalised figure must not
         reach a prominent surface stripped of the sentence that stops it being
         read as an absolute. It is now asserted HARDER, because the ranked row
         does not print a bare percentage at all, and the percentage is asserted
         to survive in the disclosure. The pre-ranking strings are not lost
         either: they are pinned verbatim in the fail-closed twin below. */
      influenceSetSize: 5,
      // The ranked count — the publication guard only; the printed M is the
      // analysed set (ED #63 5806207128).
      influenceRankedCount: 3,
      confidence: null,
      confidenceIsDefaulted: false,
      confidenceIsProvisional: false,
      inSensitivityAnalysis: true,
      achievementProbability: null,
      achievementProbabilityIsModelledBasis: false,
      stabilityPercentage: null,
      winRate: null,
      isResultsMode: true,
      predictedOutcome: null,
      valueOfInformation: null,
      voiRank: null,
    })
    renderFactor({ label: 'Technical Leadership Capability', type: 'factor', observedState: { value: 0.5 } })
    // ⚠ THE SURFACE MOVED, THE CLAIM DID NOT (1 Sep 2026, and again 23 Sep 2026).
    // Locked Canvas design (spec §3; ED 02:31Z D1a; ED 11:52Z point 3): the
    // Standard-view influence reading is the face's `FactorDriverLine` now, not
    // the `NodeMetricRow`. It is re-pointed, never relaxed: the whole risk of any
    // such conversion is a per-set-normalised figure reaching a prominent surface
    // stripped of the sentence that stops it being read as an absolute. Both
    // channels stay pinned — the opened tooltip and the accessible name — and
    // both carry the value AND its scale.
    // ⭐ MOVED TO THE POPOVER (ED 5809278282) AND BACK TO THE FACE (prototype,
    // Paul 25 Sep); both channels are pinned on the face's line.
    const line = popoverDriverLine()
    fireEvent.mouseEnter(line)
    const RANKED_DISCLOSURE =
      'Driver 1 of 5 analysed. Ranked by how strongly the comparison responds to each factor in this model. ' +
      'Bar: outcome sensitivity, 100% of the strongest factor. ' +
      'Relative to the strongest factor in this model, not an absolute causal percentage. ' +
      'How much the outcome shifts when this factor changes. How sure are you of its value?'
    expect(await screen.findByRole('tooltip')).toHaveTextContent(RANKED_DISCLOSURE)
    // The visible line is a RANKING, which is the claim a reader can push back on.
    expect(captionOf(line)).toBe('Driver 1 of 5 analysed')
    // ⛔ AND THE BARE PERCENTAGE IS GONE FROM THE FACE OF THE CARD — this is the
    // assertion that would RED if the face reverted to printing the figure.
    expect(line.textContent).not.toContain('100%')
    expect(line.textContent).not.toContain('Relative influence')
    expect(screen.queryByTestId('factor-influence-row')).toBeNull()
    // ⭐⭐ AND THE PERCENTAGE IS HERE, WHICH IS WHY REMOVING IT FROM THE FACE IS
    // A DEMOTION AND NOT A DELETION — the NO-HIDING half of the claim, stated
    // WITH the scale that makes it meaningful. Pinned verbatim: the tooltip and
    // the accessible name are ONE sentence, built once.
    expect(line).toHaveAccessibleName(RANKED_DISCLOSURE)
  })

  /**
   * ⭐⭐ THE FAIL-CLOSED TWIN.
   *
   * The test above was re-pointed to the ranked render. Re-pointing a guard
   * without leaving something behind on the old arm is how a claim quietly
   * stops being policed, so the unranked strings are pinned HERE — character
   * for character.
   *
   * ⚠ THIS ARM IS REACHABLE ON THE DEPLOYED CARD, NOT A LEGACY SHIM. The
   * denominator is withheld whenever the rank is (a tie, or below the
   * determined depth). So every factor ranked 4th or lower and every factor on
   * a tied set renders exactly this.
   *
   * ⭐ Locked Canvas design (23 Sep 2026), spec §8: a model whose graph has
   * moved since the run no longer reaches this arm — a non-current run HIDES
   * the driver line (pinned in `FactorNode.influenceRanking.spec.tsx`).
   */
  it('FAIL-CLOSED: with no denominator there is no rank, no line and no bar (contract v3.1 pt 5)', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector: any) =>
      selector({
        hoveredOptionId: null,
        nodes: [],
        edges: [],
        ceeAnalysisReady: null,
        results: { status: 'complete', report: null },
        // The ranked readout's currency precondition — see the note on the
        // module-level store mock at the top of this file.
        analysisFreshness: { freshness: 'fresh' },
        analysisFreshnessDirty: false,
        importPendingServerRegistration: false,
        highlightedNodes: new Set(),
        dimmedNodeIds: new Set(),
        goalThreshold: null,
        goalConstraints: [],
        viewMode: 'standard',
      })
    )
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: 1,
      influence: 1,
      influenceProvenance: 'normalised_elasticity',
      influenceImportanceBasis: null,
      // EXPLICIT null — the point of this test is the absent denominator, so it
      // is stated rather than omitted. An omission here would be the same
      // silent-fallback defect one level down, in the test written to cover it.
      influenceSetSize: null,
      confidence: null,
      confidenceIsDefaulted: false,
      confidenceIsProvisional: false,
      inSensitivityAnalysis: true,
      achievementProbability: null,
      achievementProbabilityIsModelledBasis: false,
      stabilityPercentage: null,
      winRate: null,
      isResultsMode: true,
      predictedOutcome: null,
      valueOfInformation: null,
      voiRank: null,
    })
    renderFactor({ label: 'Technical Leadership Capability', type: 'factor', observedState: { value: 0.5 } })
    // ⛔ SUPERSEDED BY CONTRACT v3.1 pt 5 ("A factor the run did not rank shows
    // no rank, and its detail says 'Not ranked in this run'"). This arm used to
    // render the quantity's noun + bar ("Outcome sensitivity"); on the served
    // OpenAI run that published no ranks it put four mostly empty bars on the
    // board. Now: no line, no bar, one AT-only statement. The figure is not
    // deleted — it stays in the inspector's ImportanceBar.
    expect(screen.getByTestId('node-title')).toBeTruthy()
    expect(screen.queryByTestId('factor-driver-line')).toBeNull()
    expect(screen.queryByTestId('factor-driver-line-bar')).toBeNull()
    expect(screen.getByTestId('factor-driver-not-ranked').textContent).toBe('Not ranked in this run')
    // NON-VACUITY: no rank, no quantity noun, no figure on the card.
    expect(document.body.textContent).not.toContain('Driver')
    expect(document.body.textContent).not.toContain('Outcome sensitivity')
    expect(document.body.textContent).not.toContain('100%')
  })

  // -------------------------------------------------------------------------
  // P2.9 item 4 (factor-badge de-noise): the MetricPills influence/confidence
  // pills are a Standard-view compact summary. In Detailed view the labelled
  // Influence/Confidence bars (Layer 2) carry the SAME two numbers, so the pills
  // were a duplicate channel — one of the "three % semantics in identical pill
  // dress" the audit flagged, doubled in the densest view. They are now gated to
  // Standard only. "Influence NN%" is a single text node the bar never produces
  // (the bar renders "Influence" and "NN%" separately), so it uniquely
  // identifies the pill.
  //
  // ⭐ Locked Canvas design (23 Sep 2026), ED 11:52Z point 3 ("no pseudo-precise
  // `% influence` on the face"): the pills are gone from Standard TOO. The face
  // carries the driver line (the % in its disclosure); confidence is Detailed
  // information (Layer 2) and in the popover. Each case below asserts the pill's
  // absence AND the reading's presence at its new home.
  // -------------------------------------------------------------------------
  describe('no MetricPills at rest; the driver line on the face, confidence in Layer 2', () => {
    const setup = (viewMode: 'standard' | 'expert') => {
      vi.mocked(useCanvasStore).mockImplementation((selector: any) =>
        selector({
          hoveredOptionId: null, nodes: [], edges: [], ceeAnalysisReady: null,
          results: { status: 'complete', report: null },
          // The ranked readout's currency precondition — see the note on the
          // module-level store mock at the top of this file.
          analysisFreshness: { freshness: 'fresh' },
          analysisFreshnessDirty: false,
          importPendingServerRegistration: false,
          highlightedNodes: new Set(), dimmedNodeIds: new Set(),
          goalThreshold: null, goalConstraints: [], viewMode,
        })
      )
      vi.mocked(useNodeDisplayMetadata).mockReturnValue({
        sensitivityRank: 1, influence: 0.8, influenceProvenance: 'influence_score',
        influenceImportanceBasis: null,
        /* ⚠ EXPLICITLY ON THE FAIL-CLOSED ARM (2026-09-18), AND SAID OUT LOUD.
           This block is about the PILL/BAR hierarchy, not about the influence
           wording, so it deliberately stays on the unranked render — which
           keeps its `Relative influence` / `80%` assertions below true and,
           more importantly, true ON PURPOSE. Before this line they were true by
           ACCIDENT: `influenceSetSize` was optional, the mock omitted it, and
           the block was silently pinned to a branch it had never chosen. A
           fixture whose branch is implicit is a guard whose subject can move
           without it (CLAUDE.md trap 3b, arriving through the fixture). The
           ranked render is covered in
           `FactorNode.influenceRanking.spec.tsx`.
           ⛔ CONTRACT v3.1 pt 5 retires the unranked render (no rank → no
           line), so this block now sits on the RANKED arm, stated explicitly:
           licence set 5, ranked count 3. */
        influenceSetSize: 5,
        influenceRankedCount: 3,
        confidence: 0.45, confidenceIsDefaulted: false, confidenceIsProvisional: false,
        inSensitivityAnalysis: true,
        achievementProbability: null, achievementProbabilityIsModelledBasis: false,
        stabilityPercentage: null, winRate: null, isResultsMode: true,
        predictedOutcome: null, valueOfInformation: null, voiRank: null,
      })
      renderFactor({ label: 'Salary', type: 'factor', observedState: { value: 0.5 } })
    }

    it('Standard view: influence is the driver line (on the face, prototype 25 Sep); confidence is off the face, in the popover', () => {
      setup('standard')
      // ⚠ THE HIERARCHY IS STILL THE POINT. Influence — the headline — is the
      // driver line; the retired `% influence` row is gone, and the line prints
      // no figure (ED 11:52Z point 3). On the face again (prototype, Paul 25
      // Sep), so it precedes the popover's confidence row in document order.
      const line = popoverDriverLine()
      expect(captionOf(line)).toBe('Driver 1 of 5 analysed')
      expect(line.textContent).not.toContain('80%')
      expect(line).toHaveAccessibleName(/80% of the strongest factor/)
      expect(screen.queryByTestId('factor-influence-row')).toBeNull()
      // The pill form of INFLUENCE and of CONFIDENCE are gone — asserted by
      // their single-text-node spellings, which no row produces.
      expect(screen.queryByText('Influence score 80%')).toBeNull()
      expect(screen.queryByText('Confidence 45%')).toBeNull()
      // …and confidence is NOT lost: it is in Layer 2, which Standard shows in
      // the hover popover (mocked transparent here) for this top-ranked factor.
      const popover = screen.getByTestId('factor-node-popover')
      expect(within(popover).getByRole('group', { name: 'Confidence' })).toHaveTextContent('45%')
      // The face's driver line comes before the popover's confidence row.
      expect(line.compareDocumentPosition(within(popover).getByRole('group', { name: 'Confidence' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })

    it('Detailed view: the duplicate pills are gone; the labelled bars remain', () => {
      setup('expert')
      // The pills (single "Influence NN%" / "Confidence NN%" nodes) are suppressed…
      expect(screen.queryByText('Relative influence 80%')).toBeNull()
      expect(screen.queryByText('Confidence 45%')).toBeNull()
      // …while Layer 2 still carries both readings.
      /* ⭐ Locked Canvas design (23 Sep 2026): influence is the Detailed driver
         line — its VISIBLE caption is the quantity's own noun ("Structural
         influence" on the producer basis; never a bare bar), and the 80% is in
         its accessible name beside "of the strongest factor". Confidence keeps
         its labelled bar (label + value separate). */
      const line = screen.getByTestId('factor-driver-line-detail')
      expect(captionOf(line)).toBe('Driver 1 of 5 analysed')
      expect(line).toHaveAccessibleName(/80% of the strongest factor/)
      expect(screen.getByText('Confidence')).toBeDefined()
      expect(screen.getByText('45%')).toBeDefined()
    })
  })

  // -------------------------------------------------------------------------
  // Review fix 4: the DETAILED view renders the same display-model number one
  // level up from the pill ('Influence' + DataBar + 'NN%') and had NO basis
  // disclosure at all — the identical misread class the pill fix addressed.
  // The bar's accessible name carries the basis (its role="progressbar"
  // announces the value via aria-valuenow); the tooltip carries it for pointer
  // and keyboard users. Both bases pinned, plus the fail-closed no-provenance case.
  // -------------------------------------------------------------------------
  describe('detailed-view Influence row discloses the basis (review fix 4)', () => {
    function renderDetailedWithProvenance(
      influenceProvenance: 'normalised_elasticity' | 'influence_score' | null,
      influence: number,
    ) {
      vi.mocked(useCanvasStore).mockImplementation((selector: any) =>
        selector({
          hoveredOptionId: null,
          nodes: [],
          edges: [],
          ceeAnalysisReady: null,
          results: { status: 'complete', report: null },
          // The ranked readout's currency precondition — see the note on the
          // module-level store mock at the top of this file.
          analysisFreshness: { freshness: 'fresh' },
          analysisFreshnessDirty: false,
          importPendingServerRegistration: false,
          highlightedNodes: new Set(),
          dimmedNodeIds: new Set(),
          goalThreshold: null,
          goalConstraints: [],
          viewMode: 'expert', // Detailed → Layer 2 inline
        })
      )
      vi.mocked(useNodeDisplayMetadata).mockReturnValue({
        sensitivityRank: 1,
        influence,
        influenceProvenance,
        // Contract v3.1 pt 5: only a ranked factor has a driver line, so the
        // basis disclosure is pinned on the ranked arm (set 5, ranked 3).
        influenceSetSize: 5,
        influenceRankedCount: 3,
        confidence: null,
        inSensitivityAnalysis: true,
        achievementProbability: null,
        achievementProbabilityIsModelledBasis: false,
        stabilityPercentage: null,
        winRate: null,
        isResultsMode: true,
        predictedOutcome: null,
        valueOfInformation: null,
        voiRank: null,
      } as any)
      return renderFactor({ label: 'Revenue', type: 'factor', observedState: { value: 0.5 } })
    }

    // ⭐ Locked Canvas design (23 Sep 2026): the Detailed influence row is the
    // `FactorDriverLine` (`factor-driver-line-detail`). Its bar is decorative, so
    // the scale disclosure lives in the line's accessible name AND its tooltip —
    // ONE sentence, built once — and the bar's FILL still carries the fraction.
    it('fallback basis: the line discloses that the figure is relative to the strongest factor', async () => {
      renderDetailedWithProvenance('normalised_elasticity', 1)
      const line = screen.getByTestId('factor-driver-line-detail')
      const DISCLOSURE =
        'Driver 1 of 5 analysed. Ranked by how strongly the comparison responds to each factor in this model. ' +
        'Bar: outcome sensitivity, 100% of the strongest factor. ' +
        'Relative to the strongest factor in this model, not an absolute causal percentage. ' +
        'How much the outcome shifts when this factor changes. How sure are you of its value?'
      expect(line).toHaveAccessibleName(DISCLOSURE)
      expect(fillOf(line)).toBe('max(4px, 100%)')
      // Pointer users get the same disclosure on the line.
      fireEvent.mouseEnter(line)
      expect(await screen.findByRole('tooltip')).toHaveTextContent(DISCLOSURE)
    })

    it('producer basis: the line discloses the set-relative scale, and names its OWN quantity', async () => {
      renderDetailedWithProvenance('influence_score', 0.6)
      const line = screen.getByTestId('factor-driver-line-detail')
      // ⚠ THE PRODUCER ARM NAMES ITS OWN QUANTITY, and the two arms are
      // deliberately NOT one string — #1221's positive control forbids
      // collapsing them and is right: the scale is shared, the measurement is
      // not. Here: "structural influence" + its own gloss, vs the fallback's
      // "outcome sensitivity" above.
      const DISCLOSURE =
        'Driver 1 of 5 analysed. Ranked by how strongly the comparison responds to each factor in this model. ' +
        'Bar: structural influence, 60% of the strongest factor. ' +
        'Relative to the strongest factor in this model, not an absolute causal percentage. ' +
        'How strongly this factor connects to the goal in your model. How sure are you of its value?'
      // Contract v3.1 pt 5: the caption is the rank; the quantity is named in
      // the disclosure, where the two arms still differ.
      expect(captionOf(line)).toBe('Driver 1 of 5 analysed')
      expect(line).toHaveAccessibleName(DISCLOSURE)
      expect(line.getAttribute('aria-label')).not.toContain('outcome sensitivity')
      expect(fillOf(line)).toBe('max(4px, 60%)')
      fireEvent.mouseEnter(line)
      expect(await screen.findByRole('tooltip')).toHaveTextContent(DISCLOSURE)
    })

    it('no provenance stamp: withholds the influence value and its scale claim', () => {
      renderDetailedWithProvenance(null, 0.6)
      // Locked Canvas design (23 Sep 2026): bound by the driver line's test ids,
      // on both mounts, so the absence cannot go vacuous under the new wording.
      expect(screen.queryByTestId('factor-driver-line-detail')).toBeNull()
      expect(screen.queryByTestId('factor-driver-line')).toBeNull()
      expect(screen.queryByRole('progressbar', { name: /Influence/ })).toBeNull()
      expect(screen.queryByText('Influence')).toBeNull()
    // ⚠ AND the relative spelling, or this absence assertion goes vacuous:
    // the card no longer renders the bare noun under a stamped basis, so a
    // query for it would pass whether the row is absent or merely renamed.
    expect(screen.queryByText('Relative influence')).toBeNull()
      expect(screen.queryByText('60%')).toBeNull()
    })
  })
})

// ---------------------------------------------------------------------------
// QA Brief: A-series — factor node display scenarios
// ---------------------------------------------------------------------------
describe('FactorNode — QA Brief A-series', () => {
  beforeEach(() => { vi.clearAllMocks() })

  // A1: raw_value=49, unit="£"  → "£49"
  it('A1: raw_value=49 with unit="£" renders "£49"', () => {
    renderFactor({ label: 'Price', type: 'factor', observedState: { raw_value: 49, unit: '£', value: 0.49 } })
    expect(screen.getByText('£49')).toBeDefined()
  })

  // A2: raw_value=20, unit="engineers" → "20 engineers"
  it('A2: raw_value=20 with unit="engineers" renders "20 engineers"', () => {
    renderFactor({ label: 'Team size', type: 'factor', observedState: { raw_value: 20, unit: 'engineers' } })
    // Contract §02 splits the figure from its unit word (GAP 14), so the text
    // spans two elements; bound to the card's own figure, the host reads the
    // same string byte for byte.
    const figure = screen.getByTestId('factor-value-figure-factor-1')
    expect(figure.textContent).toBe('20')
    expect(screen.getByTestId('factor-value-unit-factor-1').textContent).toBe('engineers')
    expect(figure.parentElement!.textContent).toBe('20 engineers')
  })

  // A3: raw_value=4.5, unit="months" → "4.5 months"
  it('A3: raw_value=4.5 with unit="months" renders "4.5 months"', () => {
    renderFactor({ label: 'Duration', type: 'factor', observedState: { raw_value: '4.5', unit: 'months' } })
    expect(screen.getByText('4.5 months')).toBeDefined()
  })

  // A4: value=0.5, no raw_value, cap=100, unit="£" → no display (formatFactorDisplayValue returns null for value-only)
  it('A4: value=0.5 with cap=100 and unit="£" but no raw_value renders no value text', () => {
    renderFactor({ label: 'Price', type: 'factor', observedState: { value: 0.5, cap: 100, unit: '£' } })
    // No raw_value → value-only path, non-binary → null
    expect(screen.queryByText('£50')).toBeNull()
  })

  // A5: value=1.0 + factor_type='binary' renders contextual "{Label} active".
  // Polish 4 review: contextual text now requires explicit factor_type.
  it('A5: value=1.0 with factor_type=binary and no raw_value renders contextual text', () => {
    renderFactor({ label: 'Quality', type: 'factor', observedState: { value: 1.0, factor_type: 'binary' } })
    expect(screen.getByText('Quality active')).toBeDefined()
  })

  // A6: value=0, factor_type="binary", no unit → contextual text
  it('A6: binary factor value=0 without unit renders contextual text', () => {
    renderFactor({ label: 'Hired', type: 'factor', observedState: { value: 0, factor_type: 'binary' } })
    expect(screen.getByText('No hired in place')).toBeDefined()
  })

  // A7: value=0, unit="%", raw_value=0 → "0%" (not "Not active")
  it('A7: value=0 with unit="%" renders "0%" not "Not active"', () => {
    renderFactor({ label: 'Churn', type: 'factor', observedState: { value: 0, unit: '%', raw_value: 0 } })
    expect(screen.getByText('0%')).toBeDefined()
    expect(screen.queryByText('Not active')).toBeNull()
  })

  // A8: factor_type="normalized", no unit → no display (non-binary value without raw_value)
  it('A8: factor_type="normalized" with no unit shows no value text', () => {
    renderFactor({ label: 'Score', type: 'factor', observedState: { value: 0.3, factor_type: 'normalized' } })
    // "normalized" must not appear in rendered output
    expect(screen.queryByText(/normalized/i)).toBeNull()
    // Non-binary value without raw_value → null (no display)
    expect(screen.queryByText('Low')).toBeNull()
  })

  // A9: factor_type="binary", no unit → no "binary" suffix in value display
  it('A9: factor_type="binary" with no unit shows value without type suffix', () => {
    renderFactor({ label: 'Decision', type: 'factor', observedState: { value: 0.5, factor_type: 'binary' } })
    expect(screen.queryByText(/binary/i)).toBeNull()
  })

  // A10 (Polish 4 review follow-up): unit="CHF" now renders as ISO-style
  // prefix "CHF 500" — classifyUnit in labelUtils puts CHF in the iso kind,
  // which formats as space-separated prefix across every canvas surface.
  // Previously this file rendered "500 CHF" via its own hardcoded symbol
  // list; that inconsistency with labelUtils was flagged as tech debt and
  // is now fixed.
  it('A10: unit="CHF" with raw_value=500 renders "CHF 500" (ISO-style prefix)', () => {
    renderFactor({ label: 'Cost', type: 'factor', observedState: { raw_value: '500', unit: 'CHF' } })
    expect(screen.getByText('CHF 500')).toBeDefined()
  })

  // A15: source='brief_extraction' — the old provenance icon is gone.
  it('A15: source="brief_extraction" renders no "From your brief" provenance icon', () => {
    renderFactor({
      label: 'Revenue',
      type: 'factor',
      observedState: { value: 0.6, source: 'brief_extraction' },
    })
    // Bound to the ACCESSIBLE NAME, not `queryByTitle`: `BriefIcon` no longer
    // carries a native `title` — its hover moved to the shared Tooltip and its
    // name to `role="img"` + `aria-label`. Left on `queryByTitle` this would
    // pass VACUOUSLY, green because the attribute exists nowhere rather than
    // because the icon is absent, and it would not catch a reintroduction.
    expect(screen.queryByLabelText('From your brief')).toBeNull()
  })

  // A16: source='user' → no Olumi/brief provenance ICON — and, since Paul 23 Sep
  // contract feedback point 1 ("User-set/evidence-backed values get their own
  // provenance. Do not rely on 'unmarked = Olumi'"), ONE quiet `you` word mark
  // whose accessible name is "Set by you". The old third assertion (no "Set by
  // you" anywhere) pinned the unmarked-user rule point 1 retires.
  it('A16: source="user" renders no provenance icon, and its own `you` mark', () => {
    const { container } = renderFactor({
      label: 'Budget',
      type: 'factor',
      observedState: { value: 0.7, source: 'user' },
    })
    expect(screen.queryByTitle('Generated from your brief')).toBeNull()
    expect(screen.queryByLabelText('Estimated by Olumi')).toBeNull()
    expect(container.querySelector('[data-testid="estimate-marker"]')).toBeNull()
    const mark = container.querySelector('[data-testid="factor-recorded-value"] [data-value-source="you"]')
    expect(mark).not.toBeNull()
    expect(mark!.textContent).toBe('youSet by you')
  })

  // A17: Contextual value text + science icon are separate elements
  it('A17: contextual value text and science icon are separate elements', () => {
    vi.mocked(useScienceIcons).mockReturnValue([{
      id: 'evidence-gap', icon: FileQuestion,
      tooltip: 'No evidence for this factor. Analysis will use defaults.',
      action: 'Help me estimate Item', colour: 'text-warning', priority: 1,
    }])
    renderFactor({
      label: 'Item',
      type: 'factor',
      observedState: { value: 0, source: 'cee_inference', extractionType: 'inferred', factor_type: 'binary' },
    })
    // Value text exists (contextual) — requires factor_type='binary' post Polish 4 review
    expect(screen.getByText('No item in place')).toBeDefined()
    // Science icon via aria-label
    expect(screen.getByLabelText(/No evidence for this factor/)).toBeDefined()
  })

  // A17b: value=0 + extractionType=inferred → contextual text + science icon;
  // B3 withholds the local-only confirmation action.
  it('A17b: inferred zero keeps contextual science and menu affordances without confirm value', () => {
    vi.mocked(useScienceIcons).mockReturnValue([{
      id: 'evidence-gap', icon: FileQuestion,
      tooltip: 'No evidence for this factor. Analysis will use defaults.',
      action: 'Help me estimate Item', colour: 'text-warning', priority: 1,
    }])
    renderFactor({
      label: 'Item',
      type: 'factor',
      observedState: { value: 0, source: 'inferred', extractionType: 'inferred', factor_type: 'binary' },
    })
    // Contextual value display — requires factor_type='binary' post Polish 4 review
    expect(screen.getByText('No item in place')).toBeDefined()
    // Science icon via aria-label
    expect(screen.getByLabelText(/No evidence for this factor/)).toBeDefined()
    expect(screen.queryByTitle('Confirm value')).toBeNull()
    // Positive control: the menu containing the details route remains available.
    expect(screen.getByLabelText('More actions for Item')).toBeDefined()
  })

  // A18: Tier labels removed — non-binary values without raw_value show no display text
  it('A18: value=0.2 → no tier label (non-binary without raw_value returns null)', () => {
    renderFactor({ label: 'Q', type: 'factor', observedState: { value: 0.2 } })
    expect(screen.queryByText('Very low')).toBeNull()
  })
  it('A18: value=0.21 → no tier label', () => {
    renderFactor({ label: 'Q', type: 'factor', observedState: { value: 0.21 } })
    expect(screen.queryByText('Low')).toBeNull()
  })
  it('A18: value=0.4 → no tier label', () => {
    renderFactor({ label: 'Q', type: 'factor', observedState: { value: 0.4 } })
    expect(screen.queryByText('Low')).toBeNull()
  })
  it('A18: value=0.41 → no tier label', () => {
    renderFactor({ label: 'Q', type: 'factor', observedState: { value: 0.41 } })
    expect(screen.queryByText('Medium')).toBeNull()
  })
  it('A18: value=0.8 → no tier label', () => {
    renderFactor({ label: 'Q', type: 'factor', observedState: { value: 0.8 } })
    expect(screen.queryByText('High')).toBeNull()
  })
  it('A18: value=0.81 → no tier label', () => {
    renderFactor({ label: 'Q', type: 'factor', observedState: { value: 0.81 } })
    expect(screen.queryByText('Very high')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Evidence gap badge (Phase 3A)
// ---------------------------------------------------------------------------

describe('FactorNode — evidence gap badge', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('shows badge when observedState is undefined and flag is ON', () => {
    vi.mocked(isGraphBadgesEnabled).mockReturnValue(true)
    const { container } = renderFactor({ label: 'Revenue', type: 'factor' })
    expect(container.querySelector('[data-testid="evidence-gap-badge"]')).not.toBeNull()
  })

  it('shows badge when observedState has only unit (no value) and flag is ON', () => {
    vi.mocked(isGraphBadgesEnabled).mockReturnValue(true)
    const { container } = renderFactor({
      label: 'Revenue',
      type: 'factor',
      observedState: { unit: 'k' },
    })
    expect(container.querySelector('[data-testid="evidence-gap-badge"]')).not.toBeNull()
  })

  it('does NOT show badge when observedState.value === 0 (valid binary data)', () => {
    vi.mocked(isGraphBadgesEnabled).mockReturnValue(true)
    const { container } = renderFactor({
      label: 'Hired',
      type: 'factor',
      observedState: { value: 0 },
    })
    expect(container.querySelector('[data-testid="evidence-gap-badge"]')).toBeNull()
  })

  it('does NOT show badge when observedState.value is set', () => {
    vi.mocked(isGraphBadgesEnabled).mockReturnValue(true)
    const { container } = renderFactor({
      label: 'Revenue',
      type: 'factor',
      observedState: { value: 0.8 },
    })
    expect(container.querySelector('[data-testid="evidence-gap-badge"]')).toBeNull()
  })

  it('does NOT show badge when flag is OFF (even with no observed data)', () => {
    // Default: isGraphBadgesEnabled returns false
    const { container } = renderFactor({ label: 'Revenue', type: 'factor' })
    expect(container.querySelector('[data-testid="evidence-gap-badge"]')).toBeNull()
  })

  it('does NOT show badge for external factor with prior range set', () => {
    vi.mocked(isGraphBadgesEnabled).mockReturnValue(true)
    const { container } = renderFactor({
      label: 'Market rate',
      type: 'factor',
      category: 'external',
      prior: { range_min: 0.2, range_max: 0.8 },
      // No observedState
    })
    expect(container.querySelector('[data-testid="evidence-gap-badge"]')).toBeNull()
  })

  it('shows badge for external factor WITHOUT prior when flag ON', () => {
    vi.mocked(isGraphBadgesEnabled).mockReturnValue(true)
    const { container } = renderFactor({
      label: 'Market rate',
      type: 'factor',
      category: 'external',
      // No prior, no observedState
    })
    expect(container.querySelector('[data-testid="evidence-gap-badge"]')).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Intervention hover — regression guard for the CEEInterventionV3 unwrap bug.
// Before the fix (b053c82b), FactorNode cast hoveredOption.data.interventions
// as Record<string,number>, causing objects to render as "[object Object]" /
// "£NaN" / "Very high" via Math.round({...}), string concat, and falsy
// comparison coercion. These tests lock both intervention shapes (primitive
// number and {value} object) in so the narrowing branch cannot silently revert.
// ---------------------------------------------------------------------------

describe('FactorNode — intervention mark (option lens; v3.1 row 6)', () => {
  beforeEach(() => { vi.clearAllMocks() })

  const mountWithHoveredOption = (interventionEntry: unknown, factorData: Record<string, unknown>) => {
    vi.mocked(useCanvasStore).mockImplementation((selector: any) =>
      selector({
        hoveredOptionId: 'option-1',
        // ⭐ v3.1 (DESIGN-GAP-v31 row 6): a plain option HOVER no longer marks
        // its targets; the explicit option LENS does. The formatting pinned
        // here is unchanged — it now renders under the lens.
        lens: { active: 'option', selectedOptionId: 'option-1' },
        nodes: [
          { id: 'option-1', type: 'option', data: { interventions: { 'factor-1': interventionEntry } } },
        ],
        edges: [],
        ceeAnalysisReady: null,
        results: { status: 'idle', report: null },
        // The ranked readout's currency precondition — see the note on the
        // module-level store mock at the top of this file.
        analysisFreshness: { freshness: 'fresh' },
        analysisFreshnessDirty: false,
        importPendingServerRegistration: false,
        highlightedNodes: new Set(),
        dimmedNodeIds: new Set(),
        goalThreshold: null,
        goalConstraints: [],
        viewMode: 'expert',
      })
    )
    return renderFactor(factorData)
  }

  it('renders the hover chip with a primitive number intervention (qualitative tier → percentage)', () => {
    mountWithHoveredOption(0.7, {
      label: 'Marketing Expertise Available',
      type: 'factor',
      category: 'controllable',
      observedState: { value: 0.5, factor_type: 'quality' },
    })
    // ⚠ RE-PINNED 14 Aug. The coherence property this test was written for —
    // annotation and option card show ONE statement for one datum — is intact
    // and is exactly why the value moved: both now route through the single
    // formatter, which no longer invents a percentage for an unframed
    // 'quality' factor. 0.7 → 'High' per qualitativeTierLabel.
    expect(screen.getByText('→ High')).toBeDefined()
    expect(screen.queryByText(/70%/)).toBeNull()
  })

  it('unwraps a CEEInterventionV3 {value} object and renders the shared formatted value', () => {
    // Minimal V3 shape — extra fields (source, target_match) are irrelevant to the unwrap.
    mountWithHoveredOption({ value: 0.7 }, {
      label: 'Marketing Expertise Available',
      type: 'factor',
      category: 'controllable',
      observedState: { value: 0.5, factor_type: 'quality' },
    })
    // ⚠ RE-PINNED 14 Aug — see the primitive-number test above. The UNWRAP is
    // what this test guards; the formatted value moved for the same reason.
    expect(screen.getByText('→ High')).toBeDefined()
    // Regression assertion: none of the pre-fix corrupt strings should appear anywhere.
    expect(screen.queryByText(/\[object Object\]/)).toBeNull()
    expect(screen.queryByText(/NaN/)).toBeNull()
  })

  it('unwraps a {value} object on the currency path without producing £NaN', () => {
    // Pre-fix, this combination produced "Intervention: £NaN" via
    // Math.round({...}).toLocaleString(). The unwrap + guard together must
    // render a valid currency string.
    mountWithHoveredOption({ value: 0.5 }, {
      label: 'Marketing Budget',
      type: 'factor',
      category: 'controllable',
      observedState: { value: 0.1, raw_value: 5000, unit: '£', cap: 10000 },
    })
    expect(screen.queryByText(/£NaN/)).toBeNull()
    // Denormalised via raw_value/observedValue: 5000 × (0.5 / 0.1) = 25000.
    expect(screen.getByText('→ £25,000')).toBeDefined()
  })

  it('suppresses the hover chip entirely when the intervention entry is malformed', () => {
    mountWithHoveredOption({ source: 'brief_extraction' }, {
      label: 'Marketing Expertise Available',
      type: 'factor',
      category: 'controllable',
      observedState: { value: 0.5, factor_type: 'quality' },
    })
    expect(screen.queryByText(/^Intervention:/)).toBeNull()
  })

  it('suppresses the hover chip when a primitive NaN is stored', () => {
    mountWithHoveredOption(NaN, {
      label: 'Marketing Expertise Available',
      type: 'factor',
      category: 'controllable',
      observedState: { value: 0.5, factor_type: 'quality' },
    })
    expect(screen.queryByText(/^Intervention:/)).toBeNull()
  })

  it('renders CEE display_value verbatim on the hover chip, overriding placeholder-unit formatting', () => {
    // Authored display text takes precedence over the shared qualitative
    // setting formatter — F.6 passthrough.
    mountWithHoveredOption({ value: 0.7, display_value: 'Top decile' }, {
      label: 'Marketing Expertise Available',
      type: 'factor',
      category: 'controllable',
      observedState: { value: 0.3, unit: 'scale' },
    })
    expect(screen.getByText('→ Top decile')).toBeDefined()
    // UI-side fallbacks must not also render.
    expect(screen.queryByText(/Increases/)).toBeNull()
    expect(screen.queryByText(/scale/i)).toBeNull()
  })

  it('renders CEE display_value even when numeric value is null (displayValue-only intervention)', () => {
    // Regression guard: previously the hover useMemo returned null when
    // unwrapped.value was null, suppressing the chip entirely. A CEE record
    // like { value: null, display_value: "no change" } must still render.
    mountWithHoveredOption({ value: null, display_value: 'no change' }, {
      label: 'Marketing Expertise Available',
      type: 'factor',
      category: 'controllable',
      observedState: { value: 0.5, factor_type: 'quality' },
    })
    expect(screen.getByText('→ no change')).toBeDefined()
  })

  // Hover, preview and inspector state the option setting through the same
  // formatter. Placeholder units retain its qualitative tier, not an inferred
  // change relative to the current factor value.
  it('renders the qualitative setting for a scale-unit factor with no raw anchor', () => {
    mountWithHoveredOption(0.7, {
      label: 'Marketing Expertise Available',
      type: 'factor',
      category: 'controllable',
      observedState: { value: 0.3, unit: 'scale' },
    })
    // No internal unit or normalised number leaks into the setting.
    expect(screen.queryByText(/scale/i)).toBeNull()
    expect(screen.queryByText(/0\.7/)).toBeNull()
    expect(screen.getByText('→ High')).toBeDefined()
    expect(screen.queryByText(/Increases|Decreases|Does not change/)).toBeNull()
    // Never render a bare arrow with no trailing text.
    expect(screen.queryByText(/^→\s*$/)).toBeNull()
  })

  it('retains a "Very low" setting when it is below the current scale-unit value', () => {
    mountWithHoveredOption(0.1, {
      label: 'Marketing Expertise Available',
      type: 'factor',
      category: 'controllable',
      observedState: { value: 0.5, unit: 'scale' },
    })
    expect(screen.queryByText(/scale/i)).toBeNull()
    expect(screen.getByText('→ Very low')).toBeDefined()
    expect(screen.queryByText(/Increases|Decreases|Does not change/)).toBeNull()
  })

  // ---- Placeholder-unit settings ----

  // Shared negative assertions for every placeholder-unit case: the teal strip
  // must never leak unit tokens, invent a baseline comparison, or show a bare arrow.
  const assertNoPlaceholderLeaks = (unitRegex: RegExp) => {
    expect(screen.queryAllByText(unitRegex)).toHaveLength(0)
    expect(screen.queryAllByText(/Increases|Decreases|Does not change/)).toHaveLength(0)
    expect(screen.queryAllByText(/^→\s*$/)).toHaveLength(0)
  }

  it('renders the "Very high" setting for an index-unit factor', () => {
    mountWithHoveredOption(0.9, {
      label: 'Team morale',
      type: 'factor',
      category: 'controllable',
      observedState: { value: 0.2, unit: 'index' },
    })
    expect(screen.getByText('→ Very high')).toBeDefined()
    assertNoPlaceholderLeaks(/index/i)
  })

  it('renders the "Very low" setting for a score-unit factor', () => {
    mountWithHoveredOption(0.1, {
      label: 'Churn risk',
      type: 'factor',
      category: 'controllable',
      observedState: { value: 0.8, unit: 'score' },
    })
    expect(screen.getByText('→ Very low')).toBeDefined()
    assertNoPlaceholderLeaks(/score/i)
  })

  it('retains the setting for a small real shift without claiming no change', () => {
    // Both values fall in the existing Medium tier. That coarse setting must
    // not be restated as "Does not change" when the numeric values differ.
    mountWithHoveredOption(0.55, {
      label: 'Process maturity',
      type: 'factor',
      category: 'controllable',
      observedState: { value: 0.5, unit: 'scale' },
    })
    expect(screen.getByText('→ Medium')).toBeDefined()
    expect(screen.queryByText(/Does not change/)).toBeNull()
    assertNoPlaceholderLeaks(/scale/i)
  })

  it('retains the setting when intervention exactly equals the current value', () => {
    mountWithHoveredOption(0.5, {
      label: 'Process maturity',
      type: 'factor',
      category: 'controllable',
      observedState: { value: 0.5, unit: 'scale' },
    })
    expect(screen.getByText('→ Medium')).toBeDefined()
    assertNoPlaceholderLeaks(/scale/i)
  })

  it('renders the "High" setting for a norm-unit factor', () => {
    mountWithHoveredOption(0.8, {
      label: 'Product quality',
      type: 'factor',
      category: 'controllable',
      observedState: { value: 0.2, unit: 'norm' },
    })
    expect(screen.getByText('→ High')).toBeDefined()
    assertNoPlaceholderLeaks(/norm/i)
  })

  it('retains the setting and strips scale metadata like "(0–1 scale)" from the factor label', () => {
    mountWithHoveredOption(0.9, {
      // Raw label still carries the CEE normalisation artefact.
      label: 'Hiring rate (0–1 scale)',
      type: 'factor',
      category: 'controllable',
      observedState: { value: 0.2, unit: 'scale' },
    })
    expect(screen.getByText('→ Very high')).toBeDefined()
    // The cleaned label ("Hiring rate") must appear; the parenthetical must not.
    expect(screen.getByText('Hiring rate')).toBeDefined()
    expect(screen.queryByText(/0–1/)).toBeNull()
    expect(screen.queryByText(/\(.*scale.*\)/i)).toBeNull()
    assertNoPlaceholderLeaks(/\bscale\b/i)
  })

  it('preserves formatted value for currency-unit factor (non-placeholder path)', () => {
    mountWithHoveredOption({ value: 0.5 }, {
      label: 'Marketing Budget',
      type: 'factor',
      category: 'controllable',
      observedState: { value: 0.1, raw_value: 5000, unit: '£', cap: 10000 },
    })
    expect(screen.getByText('→ £25,000')).toBeDefined()
    expect(screen.queryByText(/Increases/)).toBeNull()
  })

  it('retains a known setting when baseline is null without inventing a comparison', () => {
    mountWithHoveredOption(0.7, {
      label: 'Unknown scale thing',
      type: 'factor',
      category: 'controllable',
      observedState: { value: null, unit: 'scale' },
    })
    // The option setting is known even though the current value is not.
    expect(screen.getByText('→ High')).toBeDefined()
    expect(screen.queryByText(/Increases|Decreases|Does not change/)).toBeNull()
    expect(screen.queryByText(/0\.7/)).toBeNull()
    expect(screen.queryByText(/^→\s*$/)).toBeNull()
  })

  it('renders nothing when the option does not intervene on this factor', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector: any) =>
      selector({
        hoveredOptionId: 'option-1',
        // ⭐ v3.1 (DESIGN-GAP-v31 row 6): a plain option HOVER no longer marks
        // its targets; the explicit option LENS does. The formatting pinned
        // here is unchanged — it now renders under the lens.
        lens: { active: 'option', selectedOptionId: 'option-1' },
        nodes: [
          // interventions map does not contain 'factor-1'
          { id: 'option-1', type: 'option', data: { interventions: { 'factor-other': 0.7 } } },
        ],
        edges: [],
        ceeAnalysisReady: null,
        results: { status: 'idle', report: null },
        // The ranked readout's currency precondition — see the note on the
        // module-level store mock at the top of this file.
        analysisFreshness: { freshness: 'fresh' },
        analysisFreshnessDirty: false,
        importPendingServerRegistration: false,
        highlightedNodes: new Set(),
        dimmedNodeIds: new Set(),
        goalThreshold: null,
        goalConstraints: [],
        viewMode: 'expert',
      })
    )
    renderFactor({
      label: 'Marketing Expertise Available',
      type: 'factor',
      category: 'controllable',
      observedState: { value: 0.3, unit: 'scale' },
    })
    expect(screen.queryByText(/Increases|Decreases|Does not change/)).toBeNull()
    expect(screen.queryByText(/^→/)).toBeNull()
  })

  // Graph v1.1 Task 2: low-priority factors are visually quieted in Standard
  // view — the hover popover (ConnRows, BiasNote, coaching) is suppressed.
  // High-priority factors keep the popover.
  describe('low-priority Standard view popover', () => {
    it('does not render the popover at all for a low-priority factor in Standard view', () => {
      // Build a 5-factor graph where factor-1 (the rendered node) has no outbound
      // edges to outcomes/risks but factors 2..5 each connect to an outcome.
      // Pre-analysis ranking by structural centrality places factor-1 at rank 5
      // (low priority).
      vi.mocked(useCanvasStore).mockImplementation((selector: any) =>
        selector({
          hoveredOptionId: null,
          nodes: [
            { id: 'factor-1', type: 'factor', data: { type: 'factor', label: 'Low priority' } },
            { id: 'factor-2', type: 'factor', data: { type: 'factor', label: 'F2' } },
            { id: 'factor-3', type: 'factor', data: { type: 'factor', label: 'F3' } },
            { id: 'factor-4', type: 'factor', data: { type: 'factor', label: 'F4' } },
            { id: 'factor-5', type: 'factor', data: { type: 'factor', label: 'F5' } },
            { id: 'outcome-1', type: 'outcome', data: { type: 'outcome', label: 'Outcome' } },
          ],
          edges: [
            // `weightSource` is REQUIRED: the pre-analysis priority ranking is
            // provenance-gated, and when NO factor has a sourced strength there is
            // no ranking to be had, so nobody is quieted. These stamps make the
            // rivals genuinely higher-leverage rather than fabricated-higher.
            { id: 'e2', source: 'factor-2', target: 'outcome-1', data: { weight: 1, direction: 'positive', weightSource: 'cee' } },
            { id: 'e3', source: 'factor-3', target: 'outcome-1', data: { weight: 1, direction: 'positive', weightSource: 'cee' } },
            { id: 'e4', source: 'factor-4', target: 'outcome-1', data: { weight: 1, direction: 'positive', weightSource: 'cee' } },
            { id: 'e5', source: 'factor-5', target: 'outcome-1', data: { weight: 1, direction: 'positive', weightSource: 'cee' } },
          ],
          ceeAnalysisReady: null,
          results: { status: 'idle', report: null },
          // The ranked readout's currency precondition — see the note on the
          // module-level store mock at the top of this file.
          analysisFreshness: { freshness: 'fresh' },
          analysisFreshnessDirty: false,
          importPendingServerRegistration: false,
          highlightedNodes: new Set(),
          dimmedNodeIds: new Set(),
          goalThreshold: null,
          goalConstraints: [],
          viewMode: 'standard',
        })
      )
      renderFactor({
        label: 'Low priority',
        type: 'factor',
        category: 'controllable',
        observedState: { value: 0.5 },
      })
      expect(screen.queryByTestId('factor-node-popover')).toBeNull()
    })

    // ⛔ The other half of the provenance gate. Identical topology to the test
    // above — factor-1 still has no outbound edge — but the RIVALS' strengths
    // are unstamped, so the ranking has no evidence to rank on. Quieting a
    // factor on a ranking derived from `USER_EDGE_DEFAULTS.weight` would be
    // the same fabrication in the visual channel that #472-#476 removed from
    // the numeric one, so nobody is quieted. Without this the `not_set` arm of
    // preAnalysisFactorRank could be deleted and the suite would stay green.
    it('does NOT quieten anyone when no rival strength was ever set', () => {
      vi.mocked(useCanvasStore).mockImplementation((selector: any) =>
        selector({
          hoveredOptionId: null,
          nodes: [
            { id: 'factor-1', type: 'factor', data: { type: 'factor', label: 'Low priority' } },
            { id: 'factor-2', type: 'factor', data: { type: 'factor', label: 'F2' } },
            { id: 'factor-3', type: 'factor', data: { type: 'factor', label: 'F3' } },
            { id: 'factor-4', type: 'factor', data: { type: 'factor', label: 'F4' } },
            { id: 'factor-5', type: 'factor', data: { type: 'factor', label: 'F5' } },
            { id: 'outcome-1', type: 'outcome', data: { type: 'outcome', label: 'Outcome' } },
          ],
          edges: [
            // Same weights as the quieting test, WITHOUT the source stamps.
            { id: 'e2', source: 'factor-2', target: 'outcome-1', data: { weight: 1, direction: 'positive' } },
            { id: 'e3', source: 'factor-3', target: 'outcome-1', data: { weight: 1, direction: 'positive' } },
            { id: 'e4', source: 'factor-4', target: 'outcome-1', data: { weight: 1, direction: 'positive' } },
            { id: 'e5', source: 'factor-5', target: 'outcome-1', data: { weight: 1, direction: 'positive' } },
          ],
          ceeAnalysisReady: null,
          results: { status: 'idle', report: null },
          // The ranked readout's currency precondition — see the note on the
          // module-level store mock at the top of this file.
          analysisFreshness: { freshness: 'fresh' },
          analysisFreshnessDirty: false,
          importPendingServerRegistration: false,
          highlightedNodes: new Set(),
          dimmedNodeIds: new Set(),
          goalThreshold: null,
          goalConstraints: [],
          viewMode: 'standard',
        })
      )
      renderFactor({
        label: 'Low priority',
        type: 'factor',
        category: 'controllable',
        observedState: { value: 0.5 },
      })
      expect(screen.queryByTestId('factor-node-popover')).not.toBeNull()
    })

    it('does render the popover for a high-priority (top-3) factor in Standard view', () => {
      // Inverse topology: factor-1 has the only edge to the outcome → rank 1.
      vi.mocked(useCanvasStore).mockImplementation((selector: any) =>
        selector({
          hoveredOptionId: null,
          nodes: [
            { id: 'factor-1', type: 'factor', data: { type: 'factor', label: 'High priority' } },
            { id: 'factor-2', type: 'factor', data: { type: 'factor', label: 'F2' } },
            { id: 'factor-3', type: 'factor', data: { type: 'factor', label: 'F3' } },
            { id: 'factor-4', type: 'factor', data: { type: 'factor', label: 'F4' } },
            { id: 'factor-5', type: 'factor', data: { type: 'factor', label: 'F5' } },
            { id: 'outcome-1', type: 'outcome', data: { type: 'outcome', label: 'Outcome' } },
          ],
          edges: [
            { id: 'e1', source: 'factor-1', target: 'outcome-1', data: { weight: 1, direction: 'positive' } },
          ],
          ceeAnalysisReady: null,
          results: { status: 'idle', report: null },
          // The ranked readout's currency precondition — see the note on the
          // module-level store mock at the top of this file.
          analysisFreshness: { freshness: 'fresh' },
          analysisFreshnessDirty: false,
          importPendingServerRegistration: false,
          highlightedNodes: new Set(),
          dimmedNodeIds: new Set(),
          goalThreshold: null,
          goalConstraints: [],
          viewMode: 'standard',
        })
      )
      renderFactor({
        label: 'High priority',
        type: 'factor',
        category: 'controllable',
        observedState: { value: 0.5 },
      })
      expect(screen.queryByTestId('factor-node-popover')).not.toBeNull()
    })
  })

  // Polish 4 review: regression test against popover-only chip drift. The
  // chip audit table allows max 2 chips per node in Standard view; the body
  // and the popover must not duplicate the same chip text.
  //
  // ⚠ THE LABEL MOVED, 15 Sep 2026 — THE CLAIM DID NOT, AND THIS GUARD IS WHY
  // THE CHANGE IS CORRECT RATHER THAN JUST GREEN.
  //
  // The factor's one question moved onto the FACE of the card, in both phases,
  // the treatment Risk, Outcome, Action and Goal already had. The first cut left
  // the popover copy in place and this file caught it at once, with
  // `getMultipleElementsFoundError` on "Help me estimate this" — the same chip
  // rendered twice on one card. The popover copy is now deleted, so the
  // EXACTLY-ONCE property this guard exists for still holds, and is now
  // structural rather than maintained: there is one render site, not two.
  //
  // The text changed for a separate, measured reason: "What evidence supports
  // this?" rendered 156px inside a 168px card — the longest chip label on the
  // canvas by four characters, against a house range of 21-24 — and cost 23%
  // card height instead of 12%. The MESSAGE Olumi receives is unchanged.
  describe('chip audit drift guard', () => {
    it('top inferred factor renders its evidence question exactly once across body + popover', () => {
      registerAskSurface()
      vi.mocked(useScienceIcons).mockReturnValue([])
      vi.mocked(useCanvasStore).mockImplementation((selector: any) =>
        selector({
          hoveredOptionId: null,
          nodes: [
            { id: 'factor-1', type: 'factor', data: { type: 'factor', label: 'Hiring rate' } },
            { id: 'outcome-1', type: 'outcome', data: { type: 'outcome', label: 'Revenue' } },
          ],
          edges: [
            { id: 'e1', source: 'factor-1', target: 'outcome-1', data: { weight: 1, direction: 'positive' } },
          ],
          ceeAnalysisReady: null,
          results: { status: 'idle', report: null },
          // The ranked readout's currency precondition — see the note on the
          // module-level store mock at the top of this file.
          analysisFreshness: { freshness: 'fresh' },
          analysisFreshnessDirty: false,
          importPendingServerRegistration: false,
          highlightedNodes: new Set(),
          dimmedNodeIds: new Set(),
          goalThreshold: null,
          goalConstraints: [],
          viewMode: 'standard',
        })
      )
      renderFactor({
        label: 'Hiring rate',
        type: 'factor',
        category: 'controllable',
        observedState: { value: 0.5, extractionType: 'inferred' },
      })
      // Locked Canvas design (23 Sep 2026), spec §2 / ED 02:31Z D4: the ONE
      // render site is the rail's coaching icon — the question is its
      // accessible name. EXACTLY ONCE across the whole card: one control asks
      // it, and no chip row (face or popover) prints it as text.
      const asking = screen.getAllByRole('button', { name: 'What’s the evidence?' })
      expect(asking).toHaveLength(1)
      expect(asking[0].getAttribute('data-testid')).toBe(COACHING_ICON)
      expect(screen.queryAllByText('What’s the evidence?')).toHaveLength(0)
      expect(screen.queryByTestId('factor-card-question')).toBeNull()
    })
  })
})

// ─── Audit §8 P0-5: Detailed-view card containment ──────────────────────────
describe('FactorNode — connection list containment (audit §8 P0-5)', () => {
  beforeEach(() => { vi.clearAllMocks() })

  const fiveConnectionsState = {
    hoveredOptionId: null,
    nodes: [
      { id: 'o1', type: 'outcome', data: { label: 'Outcome One' } },
      { id: 'o2', type: 'outcome', data: { label: 'Outcome Two' } },
      { id: 'o3', type: 'outcome', data: { label: 'Outcome Three' } },
      { id: 'o4', type: 'outcome', data: { label: 'Outcome Four' } },
      { id: 'o5', type: 'outcome', data: { label: 'Outcome Five' } },
    ],
    edges: [
      { id: 'e1', source: 'factor-1', target: 'o1', data: { beliefExists: 0.9 } },
      { id: 'e2', source: 'factor-1', target: 'o2', data: { beliefExists: 0.8 } },
      { id: 'e3', source: 'factor-1', target: 'o3', data: { beliefExists: 0.7 } },
      { id: 'e4', source: 'factor-1', target: 'o4', data: { beliefExists: 0.6 } },
      { id: 'e5', source: 'factor-1', target: 'o5', data: { beliefExists: 0.5 } },
    ],
    ceeAnalysisReady: null,
    results: { status: 'complete', report: {} },
    highlightedNodes: new Set(),
    dimmedNodeIds: new Set(),
    goalThreshold: null,
    goalConstraints: [],
    viewMode: 'expert',
  }

  it('caps the "Influences:" list at 3 whole rows with "+N more in inspector"', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector: any) => selector(fiveConnectionsState))
    renderFactor({ label: 'Hiring rate', type: 'factor', observedState: { value: 0.5 } })
    // Top 3 by confidence render as whole rows…
    expect(screen.getAllByText('Outcome One').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Outcome Two').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Outcome Three').length).toBeGreaterThan(0)
    // …the 4th and 5th do not…
    expect(screen.queryByText('Outcome Four')).toBeNull()
    expect(screen.queryByText('Outcome Five')).toBeNull()
    // …and the remainder is disclosed with the correct count.
    expect(screen.getAllByText('+2 more in inspector').length).toBeGreaterThan(0)
  })

  it('shows no overflow line when 3 or fewer connections exist', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector: any) => selector({
      ...fiveConnectionsState,
      edges: fiveConnectionsState.edges.slice(0, 3),
    }))
    renderFactor({ label: 'Hiring rate', type: 'factor', observedState: { value: 0.5 } })
    expect(screen.getAllByText('Outcome One').length).toBeGreaterThan(0)
    expect(screen.queryByText(/more in inspector/)).toBeNull()
  })
})
