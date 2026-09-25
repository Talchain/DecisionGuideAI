/**
 * Render matrix — FactorNode + OptionNode × Standard / Detailed × pre / post analysis.
 *
 * Polish 4 follow-up Item A. The audit table in the polish-4 brief defines
 * the canonical chip / coaching / value-display state per node per phase per
 * view. Without a matrix test, those rules drift one node-edit at a time —
 * a chip migrates between body and popover, a coaching line gets dropped from
 * a gate, the differentiator fires in the wrong view. This file pins the
 * audit table by sweeping all 8 combinations and asserting the visible state.
 *
 * Each case asserts (where applicable):
 *   - chips present / absent per the audit table
 *   - coaching line gated to top-3 (high-priority) factors
 *   - value suppression for scale-no-raw factors
 *   - differentiator line renders in Standard view on non-baseline options,
 *     BEFORE AND AFTER the run (it used to be pre-analysis only; the run
 *     ranks options, it does not change which factor differentiates them)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, cleanup } from '@testing-library/react'
import { optionCardRows } from './__helpers__/optionPreview'
import { ReactFlowProvider } from '@xyflow/react'
import { FactorNode } from '../FactorNode'
import { OptionNode } from '../OptionNode'
import { DecisionNode } from '../DecisionNode'
import { GoalNode } from '../GoalNode'
import { OutcomeNode } from '../OutcomeNode'
import { RiskNode } from '../RiskNode'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

vi.mock('../../layoutStore', () => ({
  useLayoutStore: vi.fn((selector: (s: { layoutNodeWidth: number | null }) => unknown) =>
    selector({ layoutNodeWidth: null })
  ),
}))
// Spread the real flags module so newly-added flags (e.g. any flag GoalNode
// transitively reads through useAnalysisTrust → useAnalysisStateSource) never go
// silently absent and throw at render — see CLAUDE.md #12 (derive, don't mirror).
// Only the three flags this suite deliberately pins are overridden to false.
vi.mock('../../../flags', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../flags')>()),
  isGraphBadgesEnabled: vi.fn(() => false),
  isCrossHighlightEnabled: vi.fn(() => false),
  isGraphLensEnabled: vi.fn(() => false),
}))
vi.mock('../../hooks/useScienceIcons', () => ({
  useScienceIcons: vi.fn(() => []),
}))

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn(),
}))

vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(),
}))

import { useCanvasStore } from '../../store'
import { useNodeDisplayMetadata } from '../../hooks/useNodeDisplayMetadata'
import { useGuidanceStore } from '../../stores/guidanceStore'

/**
 * Locked Canvas design (23 Sep 2026): a card's ONE question is now its rail
 * coaching icon (`node-coaching-icon-<id>`, accessible name = the chip label),
 * and the face carries no chip row (spec §2; ED 02:31Z D4; ED 11:52Z). The
 * icon renders only where an ask surface is registered (`canReceiveAsk`), so
 * the cases that assert its presence register one — the real guidance store,
 * not a mock — and every case restores the store's own nulls afterwards.
 */
const ASK_SURFACE_NULLS = {
  _prefillChat: useGuidanceStore.getState()._prefillChat,
  _sendMessage: useGuidanceStore.getState()._sendMessage,
  _dispatchAction: useGuidanceStore.getState()._dispatchAction,
  guidanceItems: useGuidanceStore.getState().guidanceItems,
}
function registerAskSurface() {
  useGuidanceStore.setState({ _prefillChat: vi.fn(), _sendMessage: vi.fn(), _dispatchAction: vi.fn(), guidanceItems: [] } as never)
}
afterEach(() => {
  useGuidanceStore.setState(ASK_SURFACE_NULLS as never)
})

/**
 * The card's own face — BaseNode's root group, which excludes the sibling
 * popover.
 *
 * ⛔ UPDATED 24 Sep 2026 (GAP-36, DESIGN-GAP-AUDIT-20260924.md row 36;
 * contract §01): the accessible name changed shape from "<code id> node:
 * <label>." to "<Kind>: <label>. Open details." — the literal word "node" is
 * gone (a screen reader now hears "Factor: Demand", not "factor node:
 * Demand"). The colon immediately before the label is the one thing common
 * to every kind's name under BOTH the old and new template, so matching on
 * that alone (rather than re-adding a specific kind word here) keeps this
 * helper correct regardless of which of the six kinds a given call names.
 */
const faceOf = (label: string) =>
  screen.getByRole('group', { name: new RegExp(`: ${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) })

// Make NodePopover transparent so we can read its rendered content directly
// (otherwise the popover is hidden behind a 300ms hover delay).
vi.mock('../shared/NodePopover', () => ({
  NodePopover: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="node-popover">{children}</div>
  ),
}))

type ViewMode = 'standard' | 'expert'
type Phase = 'pre' | 'post'

interface MatrixState {
  viewMode: ViewMode
  phase: Phase
  nodes: Array<Record<string, unknown>>
  edges: Array<Record<string, unknown>>
  ceeAnalysisReady?: { options?: Array<{ id: string; interventions: Record<string, unknown> }> } | null
  goalThreshold?: number | null
  goalConstraints?: Array<Record<string, unknown>>
  report?: Record<string, unknown> | null
}

function buildStoreState(state: MatrixState) {
  return {
    hoveredOptionId: null,
    nodes: state.nodes,
    edges: state.edges,
    ceeAnalysisReady: state.ceeAnalysisReady ?? null,
    results: {
      status: state.phase === 'post' ? 'complete' : 'idle',
      report: state.phase === 'post' ? (state.report ?? {}) : null,
    },
    highlightedNodes: new Set(),
    dimmedNodeIds: new Set(),
    lens: { _dimmedNodeIds: new Set(), _hiddenNodeIds: new Set(), active: 'full' },
    goalThreshold: state.goalThreshold ?? null,
    goalConstraints: state.goalConstraints ?? [],
    setHoveredOption: vi.fn(),
    runMeta: { ceeReview: null },
    viewMode: state.viewMode,
  }
}

function applyStore(state: MatrixState) {
  vi.mocked(useCanvasStore).mockImplementation((selector: any) =>
    selector(buildStoreState(state)),
  )
}

const baseFactorProps = {
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

const baseOptionProps = { ...baseFactorProps, id: 'option-1', type: 'option' }

function renderFactor(data: Record<string, unknown>) {
  return render(
    <ReactFlowProvider>
      <FactorNode {...baseFactorProps} data={data} />
    </ReactFlowProvider>
  )
}

function renderOption(data: Record<string, unknown>) {
  return render(
    <ReactFlowProvider>
      <OptionNode {...baseOptionProps} data={{ label: 'Aggressive plan', type: 'option', ...data }} />
    </ReactFlowProvider>
  )
}

describe('Render matrix — FactorNode × view × phase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null,
      influence: null,
      confidence: null,
      inSensitivityAnalysis: false,
      achievementProbability: null,
      stabilityPercentage: null,
      winRate: null,
      isResultsMode: false,
    } as any)
  })

  // Topology: factor-1 is the rendered top-3 inferred factor on Outcome path.
  // Three other factors exist so the rank computation has something to sort.
  const topInferredTopology = (viewMode: ViewMode, phase: Phase): MatrixState => ({
    viewMode,
    phase,
    nodes: [
      { id: 'factor-1', type: 'factor', data: { type: 'factor', label: 'Marketing Expertise Available' } },
      { id: 'factor-2', type: 'factor', data: { type: 'factor', label: 'F2' } },
      { id: 'factor-3', type: 'factor', data: { type: 'factor', label: 'F3' } },
      { id: 'factor-4', type: 'factor', data: { type: 'factor', label: 'F4' } },
      { id: 'outcome-1', type: 'outcome', data: { type: 'outcome', label: 'Revenue' } },
    ],
    // `weightSource` is REQUIRED on every edge here: the pre-analysis priority
    // ranking is provenance-gated, and with no sourced strength anywhere there
    // is no ranking, so no factor is quieted and the low-priority case below
    // could not be reached at all. These are the weights the ranking is
    // supposed to read.
    edges: [
      { id: 'e1', source: 'factor-1', target: 'outcome-1', data: { weight: 1, direction: 'positive', weightSource: 'cee' } },
      { id: 'e2', source: 'factor-2', target: 'outcome-1', data: { weight: 0.1, direction: 'positive', weightSource: 'cee' } },
      { id: 'e3', source: 'factor-3', target: 'outcome-1', data: { weight: 0.1, direction: 'positive', weightSource: 'cee' } },
      { id: 'e4', source: 'factor-4', target: 'outcome-1', data: { weight: 0.1, direction: 'positive', weightSource: 'cee' } },
    ],
  })

  it('Standard pre: top inferred factor shows the evidence chip ONCE on the card, no popover duplicate', () => {
    applyStore(topInferredTopology('standard', 'pre'))
    registerAskSurface()
    renderFactor({
      label: 'Marketing Expertise Available',
      type: 'factor',
      category: 'controllable',
      observedState: { value: 0.5, extractionType: 'inferred', unit: 'scale' },
    })
    // ⭐ THE CLAIM IS UNCHANGED — EXACTLY ONE, ON THE CARD. Only the LITERAL
    // moved, and with a measured reason: 'What evidence supports this?' was
    // 156px inside a 168px card (the longest chip on the canvas, against a
    // house range of 21-24 characters), so the label shortened to
    // 'What’s the evidence?' while the MESSAGE Olumi receives is unchanged.
    // See FactorNode.tsx's `cardQuestion`. ⚠ The single render site is now
    // structural: `factorChips` was deleted, so "exactly once" is a property
    // of the component rather than two surfaces that must agree.
    //
    // Locked Canvas design (23 Sep 2026): the question is still asked EXACTLY
    // ONCE, ON THE CARD — but by the rail's coaching icon, not a face chip row
    // (spec §2 "Coaching is one consistent icon"; ED 02:31Z D4; ED 11:52Z
    // point 3). So "once" is counted over every control that asks it, across
    // the card AND the (inline-mocked) popover, and the face chip row is gone.
    const face = faceOf('Marketing Expertise Available')
    const askers = screen.getAllByRole('button', { name: 'What’s the evidence?' })
    expect(askers).toHaveLength(1)
    expect(askers[0].getAttribute('data-testid')).toBe('node-coaching-icon-factor-1')
    expect(face.contains(askers[0])).toBe(true)
    // No chip-row copy of it anywhere — face or popover.
    expect(screen.queryByText('What’s the evidence?')).toBeNull()
    expect(within(face).queryByTestId('factor-card-question')).toBeNull()
    // ⛔ The discriminating half: the retired literal must be GONE, not merely
    // outnumbered — a card rendering both would satisfy the count above.
    expect(screen.queryByText('What evidence supports this?')).toBeNull()
    expect(screen.queryByRole('button', { name: 'What evidence supports this?' })).toBeNull()
    // Value suppression: scale-no-raw fractional value is hidden.
    expect(screen.queryByText(/0\.5/)).toBeNull()
    expect(screen.queryByText(/scale/i)).toBeNull()
  })

  it('Standard post: top inferred factor coaching line is gated by isHighPriority and shows', () => {
    applyStore(topInferredTopology('standard', 'post'))
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: 1,
      influence: 0.8,
      confidence: 0.3,
      inSensitivityAnalysis: true,
      achievementProbability: null,
      stabilityPercentage: null,
      winRate: null,
      isResultsMode: true,
    } as any)
    renderFactor({
      label: 'Marketing Expertise Available',
      type: 'factor',
      category: 'controllable',
      observedState: { value: 0.5, extractionType: 'inferred', unit: 'scale' },
    })
    /**
     * ⛔ THE SYNTHESISED COACHING LINE IS GONE, DELIBERATELY (15 Sep 2026).
     * "High influence, low confidence." was chosen by two thresholds FactorNode
     * invented (70 / 40) and restated two numbers the card already displays.
     * Founder's rule: the UI renders the data, it does not decide what it means.
     * The assertion is inverted rather than deleted, so a silent reintroduction
     * REDs here instead of slipping back onto the card.
     */
    expect(screen.queryByText(/High influence, low confidence/i)).toBeNull()
  })

  it('Detailed pre: top inferred factor shows pre-analysis layer 2 coaching ONLY when high-priority', () => {
    applyStore(topInferredTopology('expert', 'pre'))
    renderFactor({
      label: 'Marketing Expertise Available',
      type: 'factor',
      category: 'controllable',
      // ⚠ `source` ADDED 30 Aug 2026, and it is the whole correction. This
      // fixture previously carried no provenance stamp, so it could not tell
      // CEE's invented placeholder from a value a user genuinely set to 0.5
      // (CLAUDE.md trap 19 — a magnitude is not a discriminator). It therefore
      // pinned the line's presence while saying nothing about whether the line
      // was TRUE, and what it pinned was a false claim: the sentence read
      // "Olumi estimated this from your brief" over a hardcoded constant.
      // `cee_inference` is the stamp the substitution actually writes,
      // witnessed on deployed staging — so the fixture is now the shape this
      // case was always meant to model.
      observedState: { value: 0.5, extractionType: 'inferred', source: 'cee_inference', unit: 'scale' },
    })
    // Item 3: coaching line gated to top-3. factor-1 has the strongest edge,
    // so it ranks #1 → high priority → coaching line renders inline.
    // The GATE is what this case pins, and it still holds. What changed is the
    // sentence behind it: an invented value may never be attributed to the
    // brief. Full provenance coverage lives in
    // `FactorNode.briefAttribution.spec.tsx`.
    expect(screen.getByText(/Olumi\u2019s placeholder/i)).toBeDefined()
    expect(screen.queryByText(/from your brief/i)).toBeNull()
  })

  it('Detailed pre: low-priority inferred factor does NOT show the coaching line', () => {
    // Render factor-4 instead — bottom of the 4-factor ranking with weak edges.
    applyStore({
      ...topInferredTopology('expert', 'pre'),
      // Make factor-2 .. factor-4 the rendered node so it ranks low.
    })
    render(
      <ReactFlowProvider>
        <FactorNode
          {...baseFactorProps}
          // `NodeProps` requires these three and `baseFactorProps` omits them —
          // the reason this file carries TS2739 in the typecheck baseline.
          // Supplied at THIS call site only, because adding `source` below
          // changes the inline object's type and would otherwise mint a NEW
          // baseline identity for a diagnostic this PR introduced. Scoped here
          // rather than fixed in `baseFactorProps`, which would clear several
          // unrelated baseline entries and turn a copy fix into a ratchet
          // change.
          deletable={false}
          selectable
          draggable
          id="factor-4"
          data={{
            type: 'factor',
            label: 'Low priority factor',
            category: 'controllable',
            // Same `source` correction as the high-priority case above: this is
            // the shape CEE's substitution writes.
            observedState: { value: 0.5, extractionType: 'inferred', source: 'cee_inference', unit: 'scale' },
          }}
        />
      </ReactFlowProvider>
    )
    // Low-priority → coaching line suppressed in Detailed view too. Asserted
    // against BOTH the old sentence and the new one, so this case cannot pass
    // merely because the copy moved.
    expect(screen.queryByText(/Olumi estimated this from your brief/i)).toBeNull()
    expect(screen.queryByText(/Olumi\u2019s placeholder/i)).toBeNull()
  })

  it('Detailed post: factor body shows full layer 2 (no synthesised coaching line — Detailed-specific)', () => {
    applyStore(topInferredTopology('expert', 'post'))
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: 1,
      influence: 0.8,
      confidence: 0.3,
      inSensitivityAnalysis: true,
      achievementProbability: null,
      stabilityPercentage: null,
      winRate: null,
      isResultsMode: true,
    } as any)
    renderFactor({
      label: 'Marketing Expertise Available',
      type: 'factor',
      category: 'controllable',
      observedState: { value: 0.5, extractionType: 'inferred', unit: 'scale' },
    })
    // Synthesised coaching line is Standard-only (gate at !isDetailed).
    expect(screen.queryByText(/High influence, low confidence/i)).toBeNull()
  })
})

describe('Render matrix — OptionNode × view × phase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null,
      influence: null,
      confidence: null,
      inSensitivityAnalysis: false,
      achievementProbability: null,
      stabilityPercentage: null,
      winRate: null,
      isResultsMode: false,
    } as any)
  })

  // Two non-baseline options with different intervention magnitudes so the
  // differentiator can fire in pre-analysis Standard.
  const twoOptionTopology = (viewMode: ViewMode, phase: Phase): MatrixState => ({
    viewMode,
    phase,
    nodes: [
      { id: 'option-1', type: 'option', data: { label: 'Aggressive plan', type: 'option' } },
      { id: 'option-2', type: 'option', data: { label: 'Conservative plan', type: 'option' } },
      {
        id: 'factor-1',
        type: 'factor',
        data: {
          label: 'Hiring rate',
          observedState: { unit: 'engineers', value: 0.3, raw_value: 3, cap: 10 },
        },
      },
    ],
    edges: [],
    ceeAnalysisReady: {
      options: [
        { id: 'option-1', interventions: { 'factor-1': 0.9 } },
        { id: 'option-2', interventions: { 'factor-1': 0.3 } },
      ],
    },
  })

  it('Standard pre non-baseline: coaching icon + from→to change row; no footer repeating that row (NODE-ANATOMY v3.2)', () => {
    const topology = twoOptionTopology('standard', 'pre')
    // The pair needs its own declared reference. The factor's observed value
    // alone must not license it; the missing-reference case keeps its footer.
    applyStore({ ...topology, nodes: [...topology.nodes, {
      id: 'reference', type: 'option', data: {
        label: 'Keep current hiring', type: 'option', is_baseline: true,
        interventions: { 'factor-1': 0.3 },
      },
    }] })
    registerAskSurface()
    const { container } = renderOption({})
    const face = faceOf('Aggressive plan')
    // Locked Canvas design (23 Sep 2026): the card's question is the rail's
    // coaching icon, not a face chip (spec §2; ED 02:31Z D4; design summary
    // "Option … Coaching icon: pre-analysis card chip ('What could go wrong?')").
    expect(within(face).getByTestId('node-coaching-icon-option-1')).toHaveAccessibleName('What could go wrong?')
    expect(within(face).queryByText('What could go wrong?')).toBeNull()
    expect(within(face).queryByTestId('option-card-question')).toBeNull()
    // Locked Canvas design (23 Sep 2026): the "Reference: …" line is gone with
    // the old delta list (spec §4 change rows). The reference IDENTITY is kept —
    // on the change row it qualifies, as that row's recovery title.
    expect(screen.queryByText('Reference: Keep current hiring')).toBeNull()
    // ⭐ THE FACE IS THE CHANGE ROWS (Paul 25 Sep: the prototype supersedes ED #63
    // 5809278282's one-line face and its popover rows). The row is on the face,
    // rendered once, and its title names the baseline it is measured from.
    const row = within(face).getByTestId('option-change-row-option-1-factor-1')
    expect(within(optionCardRows('option-1')).getByTestId('option-change-row-option-1-factor-1')).toBe(row)
    expect(within(face).queryByTestId('option-primary-change-option-1')).toBeNull()
    expect(row.getAttribute('title')).toContain('From Keep current hiring (the baseline option)')
    // Both options share the top factor (option-1 at 0.9 on engineers cap=10 →
    // "9 engineers"), so the change reads "3 engineers → 9 engineers".
    // ⚠ WAS `expect(differentiatorP).toBeUndefined()` — brief scope 7 dropped
    // the footer as a duplicate. Paul's ruling 10 Sep 2026 — "both stay": the chip states the CHANGE, the footer states WHICH FACTOR differentiates. The dedup that dropped the footer is retired.
    // Locked Canvas design (23 Sep 2026): the CHANGE is now the change row
    // (`option-change-row-*`, a `<dd>`), bound by identity.
    // ⚠ NODE-ANATOMY v3.2 (24 Sep; ED #63 5806266691 "differentiator only when
    // additive") narrows "both stay": the shared-factor footer "… → 9 engineers"
    // would only repeat THIS row, so it does not render. (Where it adds — its
    // factor behind "+N more", or "… is the key difference" among several
    // changes — it still does: `OptionNode.differentiatorOnlyWhenAdditive.spec`.)
    expect(row.textContent).toContain('9 engineers')
    expect(row.textContent).toContain('→')
    // Every paragraph: the rows are `<dd>`s, so no `<p>` on the card or in the
    // popover may carry an arrow (the retired one-line face was the only
    // exception, and it is gone).
    const allPs = Array.from(container.querySelectorAll('p'))
    const differentiatorP = allPs.find(p => p.textContent?.includes('→'))
    expect(differentiatorP).toBeUndefined()
    expect(screen.queryByTestId('option-differentiator-option-1')).toBeNull()
  })

  it('Standard pre: identical shared-factor values suppress differentiator on both options', () => {
    // Both options intervene on factor-1 at the same value → dedup suppresses both
    applyStore({
      ...twoOptionTopology('standard', 'pre'),
      ceeAnalysisReady: {
        options: [
          { id: 'option-1', interventions: { 'factor-1': 0.9 } },
          { id: 'option-2', interventions: { 'factor-1': 0.9 } },
        ],
      },
    })
    const { container } = renderOption({})
    // No differentiator <p> should exist — both would produce identical text.
    // Positive control: the option's own change row IS on the face (a `<dd>`,
    // so the `<p>` scan below cannot be satisfied by it — Paul 25 Sep).
    expect(within(optionCardRows('option-1')).getByTestId('option-change-row-option-1-factor-1')).toBeTruthy()
    const allPs = Array.from(container.querySelectorAll('p'))
    const differentiatorP = allPs.find(
      p => p.textContent?.includes('→') || /key difference/i.test(p.textContent ?? '')
    )
    expect(differentiatorP).toBeUndefined()
    expect(screen.queryByTestId('option-differentiator-option-1')).toBeNull()
  })

  it('Standard post non-leading: shows "What would make this better supported?" chip and NO differentiator', () => {
    applyStore(twoOptionTopology('standard', 'post'))
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null,
      influence: null,
      confidence: null,
      inSensitivityAnalysis: false,
      achievementProbability: null,
      stabilityPercentage: null,
      winRate: 0.4, // not the winner
      isResultsMode: true,
    } as any)
    renderOption({})
    expect(screen.getByText('What would make this better supported?')).toBeDefined()
    // Differentiator is pre-analysis only.
    expect(screen.queryByText(/key difference/i)).toBeNull()
  })

  it('Detailed pre non-baseline: differentiator line is hidden (Standard-only)', () => {
    applyStore(twoOptionTopology('expert', 'pre'))
    registerAskSurface()
    renderOption({})
    expect(screen.queryByText(/key difference/i)).toBeNull()
    expect(screen.queryByTestId('option-differentiator-option-1')).toBeNull()
    // Pre-analysis question still present — Locked Canvas design (23 Sep 2026):
    // as the rail's coaching icon in BOTH views (the card question was never a
    // Detailed layer-2 chip; spec §2, ED 02:31Z D4), and no face chip copy.
    const face = faceOf('Aggressive plan')
    expect(within(face).getByTestId('node-coaching-icon-option-1')).toHaveAccessibleName('What could go wrong?')
    expect(within(face).queryByText('What could go wrong?')).toBeNull()
  })

  it('Detailed post: chips render but differentiator never appears', () => {
    applyStore(twoOptionTopology('expert', 'post'))
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null,
      influence: null,
      confidence: null,
      inSensitivityAnalysis: false,
      achievementProbability: null,
      stabilityPercentage: null,
      winRate: 0.4,
      isResultsMode: true,
    } as any)
    renderOption({})
    expect(screen.queryByText(/key difference/i)).toBeNull()
    expect(screen.getByText('What would make this better supported?')).toBeDefined()
  })

  // ---- Graph v2 Task 4: close-call variant ----

  // Topology where option-1 (the rendered node) is non-leader within 5pp
  // of option-2 (the leader). Includes the report so the close-call useMemo
  // can read win probabilities.
  //
  // Locked Canvas design (23 Sep 2026): "Within a small margin of the
  // most-supported option" and "Held back by:" are DETAILED-ONLY now (design
  // summary, Option: "'Factor to examine:', 'Within a small margin of the
  // most-supported option', 'Held back by:' are Detailed-only now"; ED 11:52Z
  // point 4 — the Standard option face is change rows + one model-relative
  // result). Each close-call case below therefore asserts the marker's
  // ABSENCE on the Standard face and its behaviour where it now lives, in
  // Detailed, on the SAME fixture — so the window (1pp in, sub-percent in,
  // 10pp out, leader never, pre-analysis never) stays pinned.
  const renderCloseCallIn = (view: ViewMode, state: MatrixState) => {
    cleanup()
    applyStore({ ...state, viewMode: view })
    return renderOption({})
  }
  const closeCallTopology = (gapPp: number): MatrixState => ({
    viewMode: 'standard',
    phase: 'post',
    nodes: [
      { id: 'option-1', type: 'option', data: { label: 'Aggressive plan', type: 'option' } },
      { id: 'option-2', type: 'option', data: { label: 'Conservative plan', type: 'option' } },
      {
        id: 'factor-1',
        type: 'factor',
        data: { label: 'Hiring rate', observedState: { unit: 'engineers', value: 0.3, raw_value: 3, cap: 10 } },
      },
    ],
    edges: [],
    ceeAnalysisReady: {
      options: [
        { id: 'option-1', interventions: { 'factor-1': 0.5 } },
        { id: 'option-2', interventions: { 'factor-1': 0.9 } },
      ],
    },
    report: {
      robustness: {
        recommended_option_id: 'option-2',
        // ROADMAP 1.239: the close-call line and the "Held back by:" reason now both
        // require an ENTITLED leader, not merely an identified one. This
        // fixture has always MEANT "this run has a leader" — it just never
        // said so, and the deleted win-probability derivation was supplying
        // the entitlement for it. Adding the producer's own near-tie verdict
        // makes the fixture state what it means, and keeps the gap-10pp
        // negative test below honest: without it that test would pass because
        // the claim is withheld, not because 10pp is outside the 5pp window.
        near_tie: { is_tie: false, top_option_id: 'option-2' },
      },
      option_probabilities: {
        'option-1': { win_probability: 0.50 - gapPp / 100 },
        'option-2': { win_probability: 0.50 },
      },
    },
  })

  it('Standard post non-leader, gap 3pp: shows the qualitative close-call marker and keeps "Held back by:" line', () => {
    applyStore(closeCallTopology(3))
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null,
      influence: null,
      confidence: null,
      inSensitivityAnalysis: false,
      achievementProbability: null,
      stabilityPercentage: null,
      winRate: 0.47, // not the leader
      isResultsMode: true,
    } as any)
    renderOption({})
    // Locked Canvas design (23 Sep 2026): Standard face carries neither line.
    expect(screen.queryByText(/Close to the option most runs favour/i)).toBeNull()
    expect(screen.queryByText(/Held back by:/)).toBeNull()
    // …Detailed does, on the same fixture.
    renderCloseCallIn('expert', closeCallTopology(3))
    // ⭐ SUPERSEDED 2026-08-10: was 'Close call: within 3 percentage points'.
    // The tie-ness SIGNAL is valuable and stays; the percentage-point gap is
    // the banned statistic and is gone. The node already states this option's
    // own win probability directly above.
    expect(screen.getByText('Close to the option most runs favour in this model')).toBeDefined()
    expect(screen.queryByText(/percentage point/i)).toBeNull()
    expect(screen.getByText(/Held back by:/)).toBeDefined()
  })

  it('Standard post non-leader, gap 1pp: the marker still fires at the narrow end of the window', () => {
    applyStore(closeCallTopology(1))
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null,
      influence: null,
      confidence: null,
      inSensitivityAnalysis: false,
      achievementProbability: null,
      stabilityPercentage: null,
      winRate: 0.49,
      isResultsMode: true,
    } as any)
    renderOption({})
    // Locked Canvas design (23 Sep 2026): Detailed-only — absent on Standard…
    expect(screen.queryByText(/Close to the option most runs favour/i)).toBeNull()
    renderCloseCallIn('expert', closeCallTopology(1))
    // ⭐ SUPERSEDED 2026-08-10: this asserted the singular 'point' form. With
    // no number rendered there is no pluralisation left to pin — what remains
    // worth pinning is that a 1pp gap is still INSIDE the close-call window.
    expect(screen.getByText('Close to the option most runs favour in this model')).toBeDefined()
    expect(screen.queryByText(/percentage point/i)).toBeNull()
  })

  it('Standard post non-leader, sub-percent gap (0.4pp): still inside the window, and states no quantity', () => {
    // Gap of 0.004 → Math.round → 0; the 1pp floor keeps the predicate
    // non-null so the marker still fires. The floor no longer has a phrasing
    // job — the rendered marker carries no number at all.
    const subPercent: MatrixState = {
      viewMode: 'standard',
      phase: 'post',
      nodes: [
        { id: 'option-1', type: 'option', data: { label: 'Aggressive plan', type: 'option' } },
        { id: 'option-2', type: 'option', data: { label: 'Conservative plan', type: 'option' } },
      ],
      edges: [],
      report: {
        // ROADMAP 1.239: producer signal supplied for the same reason as
        // `closeCallTopology` above — this fixture means "there is a leader".
        robustness: {
          recommended_option_id: 'option-2',
          near_tie: { is_tie: false, top_option_id: 'option-2' },
        },
        option_probabilities: {
          'option-1': { win_probability: 0.496 },
          'option-2': { win_probability: 0.500 },
        },
      },
    }
    applyStore(subPercent)
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null,
      influence: null,
      confidence: null,
      inSensitivityAnalysis: false,
      achievementProbability: null,
      stabilityPercentage: null,
      winRate: 0.496,
      isResultsMode: true,
    } as any)
    renderOption({})
    // Locked Canvas design (23 Sep 2026): Detailed-only — absent on Standard…
    expect(screen.queryByText(/Close to the option most runs favour/i)).toBeNull()
    renderCloseCallIn('expert', subPercent)
    expect(screen.getByText('Close to the option most runs favour in this model')).toBeDefined()
    expect(screen.queryByText(/percentage point/i)).toBeNull()
  })

  it('Standard post close-call: "What would change this?" chip is added alongside "What would make this better supported?"', () => {
    applyStore(closeCallTopology(3))
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null,
      influence: null,
      confidence: null,
      inSensitivityAnalysis: false,
      achievementProbability: null,
      stabilityPercentage: null,
      winRate: 0.47,
      isResultsMode: true,
    } as any)
    renderOption({})
    expect(screen.getByText('What would change this?')).toBeDefined()
    expect(screen.getByText('What would make this better supported?')).toBeDefined()
  })

  it('Standard post non-leader, gap 10pp: NO close-call line, NO "What would change this?" chip', () => {
    applyStore(closeCallTopology(10))
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null,
      influence: null,
      confidence: null,
      inSensitivityAnalysis: false,
      achievementProbability: null,
      stabilityPercentage: null,
      winRate: 0.40,
      isResultsMode: true,
    } as any)
    renderOption({})
    // Bound to the marker that actually renders — the old /Close to the option most runs favour/ pattern
    // stops matching once the colon-and-number form is gone, which would make
    // this absence assertion pass by testing nothing.
    //
    // ⚠ RE-BOUND 7 Sep 2026, FOR THE SECOND TIME AND FOR THE SAME REASON. The
    // marker stopped saying "Close call" at all (Paul's no-contest ruling), so
    // /Close to the option most runs favour/i would now pass against a card that renders the marker in
    // full. The comment above was already the warning; this is it firing.
    expect(screen.queryByText(/Close to the option most runs favour/i)).toBeNull()
    expect(screen.queryByText('What would change this?')).toBeNull()
    // The standard "What would make this better supported?" chip is still present.
    expect(screen.getByText('What would make this better supported?')).toBeDefined()
    // Locked Canvas design (23 Sep 2026): the marker is Detailed-only, so the
    // Standard absence above is no longer discriminating on its own — the
    // window's OUTER edge is pinned where the marker can render.
    renderCloseCallIn('expert', closeCallTopology(10))
    expect(screen.queryByText(/Close to the option most runs favour/i)).toBeNull()
  })

  it('Standard post leader: NO close-call line on the leader itself', () => {
    applyStore(closeCallTopology(3))
    // Mark this rendered option (option-1) as the leader by giving it the
    // higher win probability and making the report point at it.
    applyStore({
      ...closeCallTopology(3),
      report: {
        robustness: { recommended_option_id: 'option-1' },
        option_probabilities: {
          'option-1': { win_probability: 0.55 },
          'option-2': { win_probability: 0.45 },
        },
      },
    })
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null,
      influence: null,
      confidence: null,
      inSensitivityAnalysis: false,
      achievementProbability: null,
      stabilityPercentage: null,
      winRate: 0.55,
      isResultsMode: true,
    } as any)
    renderOption({})
    expect(screen.queryByText(/Close to the option most runs favour/i)).toBeNull()
    // Locked Canvas design (23 Sep 2026): Detailed-only marker — the leader
    // exclusion is pinned where the marker can render.
    renderCloseCallIn('expert', {
      ...closeCallTopology(3),
      report: {
        robustness: { recommended_option_id: 'option-1' },
        option_probabilities: {
          'option-1': { win_probability: 0.55 },
          'option-2': { win_probability: 0.45 },
        },
      },
    })
    expect(screen.queryByText(/Close to the option most runs favour/i)).toBeNull()
  })

  it('Pre Standard non-baseline: close-call line never renders pre-analysis', () => {
    applyStore({ ...closeCallTopology(3), phase: 'pre' })
    renderOption({})
    expect(screen.queryByText(/Close to the option most runs favour/i)).toBeNull()
    // Locked Canvas design (23 Sep 2026): Detailed-only marker — the
    // pre-analysis exclusion is pinned where the marker can render.
    renderCloseCallIn('expert', { ...closeCallTopology(3), phase: 'pre' })
    expect(screen.queryByText(/Close to the option most runs favour/i)).toBeNull()
  })
})

// ============================================================================
// Polish 4 review (Improvement B): extend the matrix to Decision/Goal/Outcome/Risk
// so the audit-table chip counts are pinned across every node type, not just
// FactorNode + OptionNode. Each node has its own constraint set per the brief
// audit table — these tests assert chip presence/absence in the body for each
// (phase × view) cell.
// ============================================================================

const baseDecisionProps = {
  ...baseFactorProps,
  id: 'decision-1',
  type: 'decision',
}
const baseGoalProps = { ...baseFactorProps, id: 'goal-1', type: 'goal' }
const baseOutcomeProps = { ...baseFactorProps, id: 'outcome-1', type: 'outcome' }
const baseRiskProps = { ...baseFactorProps, id: 'risk-1', type: 'risk' }

function renderDecision(data: Record<string, unknown> = {}) {
  return render(
    <ReactFlowProvider>
      <DecisionNode {...baseDecisionProps} data={{ label: 'Hiring decision', type: 'decision', ...data }} />
    </ReactFlowProvider>
  )
}
function renderGoal(data: Record<string, unknown> = {}) {
  return render(
    <ReactFlowProvider>
      <GoalNode {...baseGoalProps} data={{ label: 'Reach revenue', type: 'goal', ...data }} />
    </ReactFlowProvider>
  )
}
function renderOutcome(data: Record<string, unknown> = {}) {
  return render(
    <ReactFlowProvider>
      <OutcomeNode {...baseOutcomeProps} data={{ label: 'Revenue growth', type: 'outcome', ...data }} />
    </ReactFlowProvider>
  )
}
function renderRisk(data: Record<string, unknown> = {}) {
  return render(
    <ReactFlowProvider>
      <RiskNode {...baseRiskProps} data={{ label: 'Key person dependency', type: 'risk', ...data }} />
    </ReactFlowProvider>
  )
}

describe('Render matrix — DecisionNode chip audit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null, influence: null, confidence: null,
      inSensitivityAnalysis: false, achievementProbability: null,
      stabilityPercentage: null, winRate: null, isResultsMode: false,
    } as any)
  })

  // A decision with options so the pre-analysis branch renders.
  //
  // Post-analysis branch: ROADMAP 1.223 routes the "{winner} leads in N% of
  // scenarios" headline through `deriveDecisionVerdict`, and the ENTIRE
  // post-analysis body hangs off that headline — the Detailed stability line
  // and the Detailed post chips included. `recommended_option_id` is no longer
  // sufficient: it answers "who leads?", never "is there a leader at all?".
  // The verdict needs both halves —
  //   · TWO comparable options (below two, "leading" has no meaning), and
  //   · a producer leader claim (PLoT `computeNearTie`) naming the
  //     win-probability RANK-1 option, which is what its identity gate checks.
  // The pre-analysis cells are unaffected: `report` is null there, and the
  // second option keeps optionCount below the 3 that triage rule 4 keys on.
  //
  // Includes a missing-value factor + an inferred factor so the legacy pill
  // code (now removed) would have rendered "1 gap" / "1 estimate" pills — used
  // to assert the pills are gone.
  const decisionTopology = (viewMode: ViewMode, phase: Phase, stability?: number): MatrixState => ({
    viewMode,
    phase,
    nodes: [
      { id: 'decision-1', type: 'decision', data: { label: 'Hiring decision', type: 'decision' } },
      { id: 'option-1', type: 'option', data: { label: 'Hire 3', type: 'option' } },
      { id: 'option-2', type: 'option', data: { label: 'Hire none', type: 'option' } },
      { id: 'factor-missing', type: 'factor', data: { type: 'factor', label: 'Cost', category: 'controllable' } },
      { id: 'factor-inferred', type: 'factor', data: { type: 'factor', label: 'Demand', category: 'controllable', observedState: { value: 0.5, extractionType: 'inferred' } } },
    ],
    edges: [
      { id: 'e1', source: 'decision-1', target: 'option-1', data: {} },
      { id: 'e2', source: 'decision-1', target: 'option-2', data: {} },
    ],
    report: phase === 'post' ? {
      robustness: {
        recommended_option_id: 'option-1',
        recommendation_stability: stability ?? 0.93,
        display_verdict: 'robust',
        // option-1 is the win argmax, so the producer's claim applies to it.
        near_tie: { is_tie: false, top_option_id: 'option-1' },
      },
      option_probabilities: {
        'option-1': { win_probability: 0.7 },
        'option-2': { win_probability: 0.3 },
      },
    } : null,
  })

  it('Standard pre: shows "Explore more options" + ("Run analysis" XOR "What could go wrong?") — never 3 chips', () => {
    applyStore(decisionTopology('standard', 'pre'))
    registerAskSurface()
    renderDecision()
    // Locked Canvas design (23 Sep 2026): the Question card is wide and shallow
    // — "coaching behind the one icon" (ED 11:52Z point 1). The chip row left
    // the Standard FACE: the rail's coaching icon asks "Explore more options",
    // and the remaining invitation moves to the Standard popover
    // (`decision-popover-invitations`) — minus the icon's own question, so
    // nothing is asked twice. Detailed keeps the full row (pinned below).
    //
    // DESIGN-GAP-AUDIT row 5(b), 24 Sep 2026: "Run analysis" was, until this
    // date, a rail ACTION (`decision-run-analysis-<id>`) that could win the
    // XOR below in place of "What could go wrong?"; it is now removed
    // entirely (running lives in the panel's Analyse button), so `runRoute`
    // is asserted here purely as a REGRESSION PIN — this fixture has no goal
    // either, so it was already 0 before the removal too.
    const face = faceOf('Hiring decision')
    expect(within(face).getByTestId('node-coaching-icon-decision-1')).toHaveAccessibleName('Explore more options')
    expect(within(face).queryByText('What could go wrong?')).toBeNull()
    expect(screen.queryByText('Explore more options')).toBeNull()
    expect(screen.queryByText('Run analysis')).toBeNull()
    // Exactly one of the two secondary routes exists, never both — the XOR is
    // unchanged, only where each lives moved. This fixture has no goal, so the
    // run route is withheld and "What could go wrong?" is the one offered.
    const popover = screen.getByTestId('node-popover')
    const runRoute = within(face).queryAllByTestId('decision-run-analysis-decision-1').length
    const couldGoWrong = within(popover).queryAllByText('What could go wrong?').length
    expect(runRoute + couldGoWrong).toBe(1)
    expect(within(within(popover).getByTestId('decision-popover-invitations')).getByText('What could go wrong?')).toBeDefined()
    // No legacy "Review model readiness" chip leaks into the popover.
    expect(screen.queryByText('Review model readiness')).toBeNull()
  })

  it('Standard pre WITH a goal: NO run route renders anywhere on the card — DESIGN-GAP-AUDIT row 5(b), 24 Sep 2026', () => {
    // Locked Canvas design (23 Sep 2026): this fixture used to be the positive
    // arm of the XOR above, when "Run analysis" was a rail action.
    //
    // DESIGN-GAP-AUDIT row 5(b), 24 Sep 2026: the rail action is removed —
    // running lives in the panel's Analyse button, so the card no longer
    // offers it in ANY ready state. `showRunAnalysis` (every factor valued
    // AND a goal set) still governs `resolveNodeCoaching`'s "What could go
    // wrong?" gate, unrelated to the removed icon — so that half of the XOR
    // is unchanged and still withheld here.
    const runnable = (view: ViewMode): MatrixState => {
      const t = decisionTopology(view, 'pre')
      return { ...t, goalThreshold: 100000, nodes: t.nodes.filter(n => n.id !== 'factor-missing') }
    }
    applyStore(runnable('standard'))
    registerAskSurface()
    renderDecision()
    const face = faceOf('Hiring decision')
    expect(within(face).queryByTestId('decision-run-analysis-decision-1')).toBeNull()
    expect(within(face).getByTestId('node-coaching-icon-decision-1')).toHaveAccessibleName('Explore more options')
    expect(screen.queryByText('Run analysis')).toBeNull()
    expect(screen.queryByText('Run the analysis now')).toBeNull()
    // …and the Standard popover withholds the other arm too.
    expect(screen.queryByText('What could go wrong?')).toBeNull()
    cleanup()
    applyStore(runnable('expert'))
    renderDecision()
    // Positive control: Detailed's chip row IS rendering here…
    expect(screen.getByText('Explore more options')).toBeDefined()
    // …and it withholds the other arm.
    expect(screen.queryByText('What could go wrong?')).toBeNull()
    expect(screen.queryByTestId('decision-run-analysis-decision-1')).toBeNull()
  })

  it('Standard post: shows "Challenge this result" + "Compare options"', () => {
    applyStore(decisionTopology('standard', 'post'))
    registerAskSurface()
    renderDecision()
    // Locked Canvas design (23 Sep 2026): the rail's coaching icon asks
    // "Challenge this result" and keeps its TYPED route (`what_would_flip`,
    // ED 02:31Z: never demoted to a generic discuss). The post chip row left
    // the Standard FACE (ED 11:52Z point 1); "Compare options" is in the
    // Standard popover (`decision-popover-post-run`), minus the icon's own
    // question, and Detailed keeps both as chips.
    const face = faceOf('Hiring decision')
    const icon = within(face).getByTestId('node-coaching-icon-decision-1')
    expect(icon).toHaveAccessibleName('Challenge this result')
    expect(icon.getAttribute('data-coaching-typed')).toBe('true')
    expect(screen.queryByText('Challenge this result')).toBeNull()
    expect(within(face).queryByText('Compare options')).toBeNull()
    const popover = screen.getByTestId('node-popover')
    expect(within(within(popover).getByTestId('decision-popover-post-run')).getByText('Compare options')).toBeDefined()
    cleanup()
    applyStore(decisionTopology('expert', 'post'))
    renderDecision()
    expect(screen.getByText('Challenge this result')).toBeDefined()
    expect(screen.getByText('Compare options')).toBeDefined()
  })

  it('Detailed pre: same chip set as Standard pre — pre-analysis chip rules are view-agnostic for Decision', () => {
    applyStore(decisionTopology('expert', 'pre'))
    renderDecision()
    expect(screen.getByText('Explore more options')).toBeDefined()
    const runAnalysis = screen.queryAllByText('Run analysis').length
    const couldGoWrong = screen.queryAllByText('What could go wrong?').length
    expect(runAnalysis + couldGoWrong).toBe(1)
  })

  it('Detailed post: same post chips as Standard post', () => {
    applyStore(decisionTopology('expert', 'post'))
    renderDecision()
    expect(screen.getByText('Challenge this result')).toBeDefined()
    expect(screen.getByText('Compare options')).toBeDefined()
  })

  // ---- Graph v2 simplification ----

  it('Standard pre: no health pills (gaps / estimates / biases) render in body', () => {
    applyStore(decisionTopology('standard', 'pre'))
    renderDecision()
    expect(screen.queryByText(/\d+ gap/i)).toBeNull()
    expect(screen.queryByText(/\d+ estimate/i)).toBeNull()
    expect(screen.queryByText(/\d+ bias/i)).toBeNull()
  })

  it('Detailed pre: no health pills render in body', () => {
    applyStore(decisionTopology('expert', 'pre'))
    renderDecision()
    expect(screen.queryByText(/\d+ gap/i)).toBeNull()
    expect(screen.queryByText(/\d+ estimate/i)).toBeNull()
    expect(screen.queryByText(/\d+ bias/i)).toBeNull()
  })

  // ⛔ THE THREE TESTS BELOW WERE RE-POINTED, NOT NARROWED. They used to police
  // a `Stability: 93% (robust)` line, whose figure was `recommendation_stability`
  // — the leading option's win probability relabelled — banded on an authored
  // four-tier scale that exists nowhere in the producer. The card now reads
  // `robustness.display_verdict`, the only field licensed to make a robustness
  // claim on screen, and renders no percentage and no bar.
  //
  // The PROPERTY each test was written for is untouched: the body/popover split
  // in Standard, the body line in Detailed, and the popover carrying the claim.
  // Only the content the split carries has changed. Each assertion now binds BY
  // IDENTITY (the element's own testid) rather than by a text predicate another
  // element could satisfy, and each carries the negative twin — the fixture
  // still supplies `recommendation_stability: 0.93`, so a percentage assertion
  // can genuinely fail if the withdrawn read ever returns.

  it('Standard post: the robustness verdict is in the popover, not the body', () => {
    applyStore(decisionTopology('standard', 'post', 0.93))
    renderDecision()
    // The Detailed body line must not render in Standard.
    expect(screen.queryByTestId('decision-robustness-verdict')).toBeNull()
    const popover = screen.getByTestId('node-popover')
    expect(
      within(popover).getByTestId('decision-robustness-popover-verdict'),
    ).toBeDefined()
    // No percentage anywhere on this surface — the fixture still supplies one.
    expect(screen.queryByText(/93%/)).toBeNull()
  })

  it('Detailed post: the robustness verdict line renders in body', () => {
    applyStore(decisionTopology('expert', 'post', 0.93))
    renderDecision()
    const line = screen.getByTestId('decision-robustness-verdict')
    expect(line.textContent).toBe('Robustness: robust')
    expect(screen.queryByText(/93%/)).toBeNull()
  })

  it('Standard post: popover carries the licensed verdict and no percentage', () => {
    applyStore(decisionTopology('standard', 'post', 0.93))
    renderDecision()
    const popover = screen.getByTestId('node-popover')
    const verdictEl = within(popover).getByTestId('decision-robustness-popover-verdict')
    expect(verdictEl.textContent).toBe('robust')
    expect(popover.textContent).not.toContain('93%')
    expect(popover.textContent).not.toContain('Stability')
  })

  it('Standard pre: no science icon header wrapper renders', () => {
    applyStore(decisionTopology('standard', 'pre'))
    const { container } = renderDecision()
    // The science-icon header was an inline-flex span next to the title.
    // useScienceIcons is mocked to [] globally, so even before this change
    // the wrapper was empty — but this assertion pins the expectation that
    // the wrapper itself is gone (no headerSlot prop passed).
    //
    // ⚠ THIS BOUND BY CSS CLASS AND CAUGHT THE WRONG ELEMENT.
    // It queried `.inline-flex.items-center.gap-1`. The header has TWO
    // right-hand glyph groups, and when the provenance group adopted the same
    // shared class string that selector started matching IT — so the guard
    // RED'd while the thing it asks about (the headerSlot wrapper) was still
    // correctly absent. A class string is a value predicate another object can
    // satisfy; a testid is identity (trap 19).
    expect(screen.queryByTestId('node-header-slot-group')).toBeNull()
    // ⭐ AND PIN IT SO IT CANNOT GO VACUOUS. `queryByTestId(...).toBeNull()`
    // passes just as happily when the testid is DELETED and the wrapper still
    // renders — the assertion would then be agreeing with itself. So count the
    // header glyph groups by the class string they share and require EXACTLY
    // ONE, then bind that one to the provenance group by identity. This RED's
    // if the headerSlot wrapper comes back (2 groups) AND if the provenance
    // group disappears (0, or the wrong survivor), neither of which depends on
    // the headerSlot testid continuing to exist.
    const glyphGroups = container.querySelectorAll('.inline-flex.items-center.gap-1')
    expect(glyphGroups).toHaveLength(1)
    expect(glyphGroups[0].getAttribute('data-testid')).toBe('node-provenance-mark-group')
  })
})

describe('Render matrix — GoalNode chip audit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null, influence: null, confidence: null,
      inSensitivityAnalysis: false, achievementProbability: null,
      stabilityPercentage: null, winRate: null, isResultsMode: false,
    } as any)
  })

  const goalTopology = (viewMode: ViewMode, phase: Phase, hasThreshold: boolean): MatrixState => ({
    viewMode,
    phase,
    nodes: [
      { id: 'goal-1', type: 'goal', data: { label: 'Reach revenue', type: 'goal' } },
    ],
    edges: [],
    goalThreshold: hasThreshold ? 100000 : null,
  })

  it('Goal no-target Standard pre: shows the compact no-target chip only', () => {
    applyStore(goalTopology('standard', 'pre', false))
    renderGoal()
    expect(screen.getByTestId('goal-node-no-target-chip')).toBeDefined()
    expect(screen.queryByText('Identify risks')).toBeNull() // removed in audit
    expect(screen.queryByText('Run analysis')).toBeNull()
  })

  it('Goal with-target Standard pre: NEITHER card shows a "Run analysis" affordance', () => {
    applyStore(goalTopology('standard', 'pre', true))
    renderGoal({ goal_threshold_raw: 100000 })
    // Locked Canvas design (23 Sep 2026): the goal card's "Run analysis" chip
    // was a DUPLICATE of the Question card's run route and is gone from the
    // goal face (design summary, Goal: "REMOVED from face: … 'Run analysis'
    // chip (goal_run_analysis)"; ED 11:52Z point 2 "wide + shallow").
    //
    // DESIGN-GAP-AUDIT row 5(b), 24 Sep 2026: the "one home" this comment used
    // to name — the Question card's rail action — is ALSO removed; running
    // lives in the panel's Analyse button, so the assertion below now checks
    // the Question card's rail for absence too, rather than presence.
    expect(within(faceOf('Reach revenue')).queryByText('Run analysis')).toBeNull()
    expect(screen.queryByText('Run analysis')).toBeNull()
    expect(screen.queryByTestId('goal-node-no-target-chip')).toBeNull()
    cleanup()
    applyStore({
      viewMode: 'standard',
      phase: 'pre',
      goalThreshold: 100000,
      nodes: [
        { id: 'decision-1', type: 'decision', data: { label: 'Hiring decision', type: 'decision' } },
        { id: 'option-1', type: 'option', data: { label: 'Hire 3', type: 'option' } },
        { id: 'option-2', type: 'option', data: { label: 'Hire none', type: 'option' } },
        { id: 'goal-1', type: 'goal', data: { label: 'Reach revenue', type: 'goal', goal_threshold_raw: 100000 } },
      ],
      edges: [
        { id: 'e1', source: 'decision-1', target: 'option-1', data: {} },
        { id: 'e2', source: 'decision-1', target: 'option-2', data: {} },
      ],
    })
    renderDecision()
    expect(within(faceOf('Hiring decision')).queryByTestId('decision-run-analysis-decision-1')).toBeNull()
  })

  it('Goal with-target Standard post: shows "Is my target realistic?" chip', () => {
    applyStore(goalTopology('standard', 'post', true))
    renderGoal({ goal_threshold_raw: 100000 })
    // Body chip post-analysis.
    expect(screen.getAllByText('Is my target realistic?').length).toBeGreaterThanOrEqual(1)
  })

  /**
   * ⭐ Every other goal chip interrogates the NUMBER — is it realistic, why is
   * it low. None asked whether the goal is the right one. A measurable proxy
   * standing in for the thing actually wanted is the most expensive error
   * available at this stage, because every option and factor downstream is
   * then optimised against the proxy rather than the objective.
   */
  it('Goal with-target Standard post: asks whether the target is the REAL goal, not just a reachable one', () => {
    applyStore(goalTopology('standard', 'post', true))
    registerAskSurface()
    renderGoal({ goal_threshold_raw: 100000 })
    // Locked Canvas design (23 Sep 2026): the question is still ON THE CARD —
    // as the rail's coaching icon, not a face chip (design summary, Goal:
    // "'Is this the real goal?' chip (now the coaching icon)"; ED 11:52Z
    // point 2 "coaching behind icon").
    const face = faceOf('Reach revenue')
    expect(within(face).getByTestId('node-coaching-icon-goal-1')).toHaveAccessibleName('Is this the real goal?')
    expect(within(face).queryByText('Is this the real goal?')).toBeNull()
    // Sits beside the realism question rather than replacing it: "can we hit
    // this number" and "is this the right number" are different questions.
    expect(screen.getAllByText('Is my target realistic?').length).toBeGreaterThanOrEqual(1)
  })

  it('Goal no-target Standard post: shows the compact no-target chip', () => {
    applyStore(goalTopology('standard', 'post', false))
    renderGoal()
    expect(screen.getByTestId('goal-node-no-target-chip')).toBeDefined()
  })
})

describe('Render matrix — OutcomeNode chip audit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null, influence: null, confidence: null,
      inSensitivityAnalysis: false, achievementProbability: null,
      stabilityPercentage: null, winRate: null, isResultsMode: false,
    } as any)
  })

  const outcomeTopology = (viewMode: ViewMode, phase: Phase): MatrixState => ({
    viewMode,
    phase,
    nodes: [
      { id: 'outcome-1', type: 'outcome', data: { label: 'Revenue growth', type: 'outcome' } },
      { id: 'goal-1', type: 'goal', data: { label: 'Goal', type: 'goal' } },
      { id: 'factor-1', type: 'factor', data: { label: 'Hiring rate', type: 'factor' } },
    ],
    edges: [
      { id: 'b1', source: 'outcome-1', target: 'goal-1', data: { weight: 0.5, direction: 'positive' } },
      { id: 'e1', source: 'factor-1', target: 'outcome-1', data: { weight: 0.7, exists_probability: 0.9 } },
    ],
  })

  it('Standard pre: shows "What affects this?" body chip (added Polish 4)', () => {
    applyStore(outcomeTopology('standard', 'pre'))
    renderOutcome()
    expect(screen.getByText('What affects this?')).toBeDefined()
    // Removed popover chip stays gone.
    expect(screen.queryByText('Are there other outcomes that matter?')).toBeNull()
  })

  // Retain the upstream and falsification pair in its existing pre-analysis
  // treatment. Consequence exploration separately stays available in both phases.
  it.each(['standard', 'expert'] as const)('%s pre: preserves falsification beside upstream exploration', (view) => {
    applyStore(outcomeTopology(view, 'pre'))
    registerAskSurface()
    renderOutcome()
    if (view === 'standard') {
      // Locked Canvas design (23 Sep 2026): the outcome face's chip row is
      // gone; the rail's coaching icon asks the falsification question (design
      // summary, Outcome/Risk: "icon asks: outcome 'What would falsify
      // this?'"; spec §2, ED 02:31Z D4). Preserved — asked, not as face text.
      const face = faceOf('Revenue growth')
      expect(within(face).getByTestId('node-coaching-icon-outcome-1')).toHaveAccessibleName('What would falsify this?')
      expect(within(face).queryByText('What would falsify this?')).toBeNull()
    } else {
      expect(screen.getByText('What would falsify this?')).toBeDefined()
    }
    expect(screen.getByText('What affects this?')).toBeDefined()
  })

  it('Standard post: no body chip (popover handles post-analysis coaching)', () => {
    applyStore(outcomeTopology('standard', 'post'))
    renderOutcome()
    // No "What strengthens" body chip post-analysis.
    expect(screen.queryByText('What affects this?')).toBeNull()
    expect(screen.getByText('Explore consequences')).toBeDefined()
  })

  it('Detailed pre: same chip set — view-agnostic for Outcome', () => {
    applyStore(outcomeTopology('expert', 'pre'))
    renderOutcome()
    expect(screen.getByText('What affects this?')).toBeDefined()
  })

  it('Detailed post: keeps consequence exploration available', () => {
    applyStore(outcomeTopology('expert', 'post'))
    renderOutcome()
    expect(screen.queryByText('What affects this?')).toBeNull()
    expect(screen.getByText('Explore consequences')).toBeDefined()
  })
})

describe('Render matrix — RiskNode chip audit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null, influence: null, confidence: null,
      inSensitivityAnalysis: false, achievementProbability: null,
      stabilityPercentage: null, winRate: null, isResultsMode: false,
    } as any)
  })

  const riskTopology = (viewMode: ViewMode, phase: Phase): MatrixState => ({
    viewMode,
    phase,
    nodes: [
      { id: 'risk-1', type: 'risk', data: { label: 'Key person dependency', type: 'risk' } },
      { id: 'goal-1', type: 'goal', data: { label: 'Goal', type: 'goal' } },
    ],
    edges: [
      { id: 'b1', source: 'risk-1', target: 'goal-1', data: { weight: 0.4, direction: 'negative' } },
    ],
  })

  it('Standard pre: shows BOTH "What reduces this?" + "Explore mitigation" (Polish 4 made them both phases)', () => {
    applyStore(riskTopology('standard', 'pre'))
    renderRisk()
    expect(screen.getByText('What reduces this?')).toBeDefined()
    expect(screen.getByText('Explore mitigation')).toBeDefined()
    // Removed popover chips stay gone.
    expect(screen.queryByText('Are there other risks?')).toBeNull()
    expect(screen.queryByText("What's the worst case?")).toBeNull()
  })

  it('Standard post: same two chips', () => {
    applyStore(riskTopology('standard', 'post'))
    renderRisk()
    expect(screen.getByText('What reduces this?')).toBeDefined()
    expect(screen.getByText('Explore mitigation')).toBeDefined()
  })

  /**
   * ⭐ The two existing chips both ask how to REDUCE the risk. Neither asks how
   * you would KNOW it was happening, so a risk could reach a decision with no
   * agreed trigger for acting on it. Asserted in BOTH phases because a leading
   * indicator is as useful while framing as it is after a run.
   */
  it.each(['pre', 'post'] as const)('%s: asks what we would see first — the risk is monitorable, not just loggable', (phase) => {
    applyStore(riskTopology('standard', phase))
    registerAskSurface()
    renderRisk()
    // Locked Canvas design (23 Sep 2026): the leading-indicator question is
    // the rail's coaching icon on the Standard face, not a face chip (design
    // summary, Outcome/Risk: "risk 'What would we see first?'"; ED 02:31Z D4).
    const face = faceOf('Key person dependency')
    expect(within(face).getByTestId('node-coaching-icon-risk-1')).toHaveAccessibleName('What would we see first?')
    expect(within(face).queryByText('What would we see first?')).toBeNull()
    // The reduce/mitigate pair is not displaced by the addition.
    expect(screen.getByText('What reduces this?')).toBeDefined()
    expect(screen.getByText('Explore mitigation')).toBeDefined()
  })

  it('Detailed pre: same two chips — view-agnostic for Risk', () => {
    applyStore(riskTopology('expert', 'pre'))
    renderRisk()
    expect(screen.getByText('What reduces this?')).toBeDefined()
    expect(screen.getByText('Explore mitigation')).toBeDefined()
  })

  it('Detailed post: same two chips', () => {
    applyStore(riskTopology('expert', 'post'))
    renderRisk()
    expect(screen.getByText('What reduces this?')).toBeDefined()
    expect(screen.getByText('Explore mitigation')).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// display_value + is_baseline render coverage (audit 2026-04-14, §4A/§4B)
//
// Prior to this block, 125 FactorNode assertions covered zero display_value
// paths. These pin the CEE-verbatim path end-to-end.
// ---------------------------------------------------------------------------
describe('FactorNode — display_value rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null,
      influence: null,
      confidence: null,
      inSensitivityAnalysis: false,
      achievementProbability: null,
      stabilityPercentage: null,
      winRate: null,
      isResultsMode: false,
    } as any)
  })

  const singleFactorTopology = (viewMode: ViewMode, phase: Phase, factorData: Record<string, unknown>): MatrixState => ({
    viewMode,
    phase,
    nodes: [
      { id: 'factor-1', type: 'factor', data: { type: 'factor', ...factorData } },
      { id: 'outcome-1', type: 'outcome', data: { type: 'outcome', label: 'Revenue' } },
    ],
    edges: [
      { id: 'e1', source: 'factor-1', target: 'outcome-1', data: { weight: 1, direction: 'positive' } },
    ],
  })

  it('Standard pre: binary factor with value 0 renders display_value verbatim, NOT "0"', () => {
    const data = {
      label: 'Dedicated Tech Lead',
      category: 'controllable',
      observedState: {
        value: 0,
        display_value: 'No tech lead in place',
        factor_type: 'binary',
      },
    }
    applyStore(singleFactorTopology('standard', 'pre', data))
    renderFactor(data)
    expect(screen.getByText('No tech lead in place')).toBeDefined()
    // "0" alone must not appear as the rendered value — display_value took priority.
    expect(screen.queryByText('0', { exact: true })).toBeNull()
  })

  it('Standard pre: currency raw_value + unit takes priority over stale display_value', () => {
    // V5 stale-value-protection: with a stale display_value="£20,000" still on
    // the node, the formatter must still render the fresh raw_value (£49,000)
    // because Pattern 1 (raw_value + meaningful unit) outranks display_value.
    // Before May 2026 the formatter granted display_value absolute priority,
    // which would have rendered "£20,000" here — the discriminatory raw vs
    // stale display values pin the rule properly. The pre-discriminatory
    // version of this test set both fields to "£49,000" and passed regardless
    // of priority (which proved nothing).
    const data = {
      label: 'Salary offer',
      category: 'controllable',
      observedState: {
        value: 0.49,
        raw_value: 49000,
        unit: '£',
        display_value: '£20,000',
      },
    }
    applyStore(singleFactorTopology('standard', 'pre', data))
    renderFactor(data)
    expect(screen.getByText('£49,000')).toBeDefined()
    expect(screen.queryByText('£20,000')).toBeNull()
  })

  // V5 stale-value-protection — live React component path. Mirrors the
  // formatter (formatFactorDisplayValue.spec), shared-entry-point
  // (factorDisplayText), and debug bundle (exportBundle.displayState.spec)
  // tests on the live FactorNode. Pinning the regression at the actual
  // rendered DOM ensures no FactorNode prop wiring change can silently
  // reintroduce stale-display drift even if the formatter test stays green.
  it('Standard pre: V5 stale-currency — raw_value=26000 + unit=£ + stale display_value="£20,000" renders "£26,000" exactly', () => {
    const data = {
      label: 'Advertising Budget Allocated',
      category: 'controllable',
      display_value: '£20,000',
      observedState: {
        value: 0.26,
        raw_value: 26000,
        unit: '£',
        cap: 100000,
        display_value: '£20,000',
      },
    }
    applyStore(singleFactorTopology('standard', 'pre', data))
    renderFactor(data)
    expect(screen.getByText('£26,000')).toBeDefined()
    expect(screen.queryByText('£20,000')).toBeNull()
    // Negative assertions mirror the bundle test — none of the round-1
    // broken shapes can silently re-emerge from a future FactorNode change.
    expect(screen.queryByText('0.26 £')).toBeNull()
    expect(screen.queryByText('£26000')).toBeNull()
  })

  it('Standard pre: display_value=null falls back to heuristic (value suppressed for scale with no raw)', () => {
    const data = {
      label: 'Capability score',
      category: 'controllable',
      observedState: {
        value: 0.3,
        unit: 'scale',
        display_value: null,
      },
    }
    applyStore(singleFactorTopology('standard', 'pre', data))
    renderFactor(data)
    // No display_value → heuristic suppresses scale-only normalised value.
    expect(screen.queryByText(/0\.3/)).toBeNull()
  })

  // Golden-fixture-derived test — pins the real production-wire shape against
  // rendering. CEE emits `display_value` at the top level of the factor node,
  // parallel to `observed_state` (not inside it).
  // Brief Task 4C: "Use a factor from that fixture with its actual display_value
  // to verify the production data shape renders correctly."
  it('Standard pre: renders top-level display_value from golden fixture (real CEE wire shape)', async () => {
    // Import the fixture at test time (dynamic import keeps the matrix top-level
    // synchronous). Pick a factor with display_value at the top of the node.
    const fixture = await import('../../../test/fixtures/golden-path-staging-2026-04-05.json')
    type FixtureNode = {
      id: string
      kind?: string
      label?: string
      display_value?: string
      observed_state?: Record<string, unknown>
      [key: string]: unknown
    }
    const graphNodes = (fixture as any).default?.cee_request?.graph_state?.nodes as FixtureNode[]
    expect(graphNodes).toBeDefined()
    const fac = graphNodes.find(
      (n) => n.kind === 'factor' && typeof n.display_value === 'string' && n.display_value.length > 0,
    )
    expect(fac).toBeDefined()
    // Map snake_case observed_state → camelCase observedState, matching
    // applyDraftResult's node normalisation (src/canvas/utils/applyDraftResult.ts:54).
    const { observed_state, kind, id: _id, ...rest } = fac!
    const data: Record<string, unknown> = {
      ...rest,
      type: kind,
      ...(observed_state ? { observedState: observed_state } : {}),
    }
    applyStore(singleFactorTopology('standard', 'pre', data))
    renderFactor(data)
    expect(screen.getByText(fac!.display_value!)).toBeDefined()
  })
})

describe('OptionNode — is_baseline rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null,
      influence: null,
      confidence: null,
      inSensitivityAnalysis: false,
      achievementProbability: null,
      stabilityPercentage: null,
      winRate: null,
      isResultsMode: false,
    } as any)
  })

  const optionOnlyTopology = (viewMode: ViewMode, phase: Phase, optionData: Record<string, unknown>): MatrixState => ({
    viewMode,
    phase,
    nodes: [
      { id: 'option-1', type: 'option', data: { type: 'option', ...optionData } },
      { id: 'option-2', type: 'option', data: { type: 'option', label: 'Alternative' } },
      { id: 'decision-1', type: 'decision', data: { type: 'decision', label: 'D' } },
    ],
    edges: [],
  })

  it('Standard pre: is_baseline=true identifies the reference without claiming no interventions', () => {
    const data = { label: 'Any Label', is_baseline: true }
    applyStore(optionOnlyTopology('standard', 'pre', data))
    renderOption(data)
    // Rendered in both the body text and the popover; both are the baseline
    // treatment path so we assert presence (length > 0), not uniqueness.
    expect(screen.getAllByText(/Baseline option/i).length).toBeGreaterThan(0)
    expect(screen.queryByText(/No changes to factors/i)).toBeNull()
  })

  it('Standard pre: is_baseline=null + "Status Quo" label fires regex fallback (baseline treatment)', () => {
    const data = { label: 'Status Quo', is_baseline: null }
    applyStore(optionOnlyTopology('standard', 'pre', data))
    renderOption(data)
    expect(screen.getAllByText(/Baseline option/i).length).toBeGreaterThan(0)
  })

  // Correction #7 — critical: explicit `false` must suppress the regex, even
  // if the label happens to match. This is why the detection changed from OR
  // to nullish-coalesce (OptionNode:52-59, 375-379).
  it('Standard pre: is_baseline=false + "Status Quo" label does NOT render baseline treatment', () => {
    const data = { label: 'Status Quo', is_baseline: false }
    applyStore(optionOnlyTopology('standard', 'pre', data))
    renderOption(data)
    expect(screen.queryByText(/Baseline option/i)).toBeNull()
  })
})

describe('N1 — per-type selection ring', () => {
  const nodeState = (highlightedIds: string[] = []) => ({
    hoveredOptionId: null,
    nodes: [],
    edges: [],
    ceeAnalysisReady: null,
    results: { status: 'idle', report: null },
    highlightedNodes: new Set(highlightedIds),
    dimmedNodeIds: new Set(),
    lens: { _dimmedNodeIds: new Set(), _hiddenNodeIds: new Set(), active: 'full' },
    goalThreshold: null,
    goalConstraints: [],
    setHoveredOption: vi.fn(),
    runMeta: { ceeReview: null },
    viewMode: 'expert',
  })
  const applyState = (highlightedIds: string[] = []) =>
    vi.mocked(useCanvasStore).mockImplementation((sel: any) => sel(nodeState(highlightedIds)))

  // @xyflow/react NodeProps require these; baseFactorProps predates that.
  const selProps = { ...baseFactorProps, selected: true, draggable: false, selectable: true, deletable: true }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null, influence: null, confidence: null, inSensitivityAnalysis: false,
      achievementProbability: null, stabilityPercentage: null, winRate: null, isResultsMode: false,
    } as any)
  })

  /*
   * ⭐ SUPERSEDED BY CONTRACT v3.1 (FRAME-09 / OR-10 / T03): selection is ONE
   * 2px Info ring on every family, flush on the frame, with a soft lift —
   * `.node.selected{box-shadow:0 0 0 2px var(--info),0 3px 12px #1B647417}`.
   * N1's per-type ring was a 4px kind-hue halo plus a white offset; on a risk
   * card that was a 4px Danger halo triggered by the neutral act of clicking.
   * The discriminators kept: the ring is the SELECTION ring (2px, not the
   * AI-highlight's 4px), and no kind hue survives on it.
   */
  const tokensOf = (el: Element) => el.className.split(/\s+/).filter(Boolean)

  it('a selected factor node wears the one Info selection ring, not a factor-hued halo', () => {
    applyState()
    render(<ReactFlowProvider><FactorNode {...selProps} data={{ label: 'Capacity' }} /></ReactFlowProvider>)
    const t = tokensOf(screen.getAllByRole('group')[0])
    expect(t).toContain('ring-2')
    expect(t).toContain('ring-info')
    expect(t).not.toContain('ring-factor/50')
    expect(t).not.toContain('ring-offset-2')
  })

  it('a selected risk node wears the same Info ring — no Danger halo for a neutral act', () => {
    applyState()
    render(<ReactFlowProvider><RiskNode {...selProps} id="risk-1" type="risk" data={{ label: 'Attrition' }} /></ReactFlowProvider>)
    const t = tokensOf(screen.getAllByRole('group')[0])
    expect(t).toContain('ring-2')
    expect(t).toContain('ring-info')
    expect(t).not.toContain('ring-danger/50')
  })

  it('selected + AI-highlighted: the highlight ring wins, the per-type selection ring is suppressed', () => {
    applyState(['factor-1'])
    render(<ReactFlowProvider><FactorNode {...selProps} data={{ label: 'Capacity' }} /></ReactFlowProvider>)
    const group = screen.getAllByRole('group')[0]
    // N2: the AI-highlight ring is the info/AI hue (not goal) and wins over selection.
    expect(group.className).toContain('ring-info/60')
    // contract v3.1: the suppressed selection ring is now `ring-2 ring-info`.
    expect(group.className.split(/\s+/)).not.toContain('ring-2')
  })

  it('N2: an AI-highlighted node gets the real pulse class (reduced-motion-safe in CSS)', () => {
    applyState(['factor-1'])
    render(<ReactFlowProvider><FactorNode {...selProps} selected={false} data={{ label: 'Capacity' }} /></ReactFlowProvider>)
    const group = screen.getAllByRole('group')[0]
    expect(group.className).toContain('ai-highlight-pulse')
    expect(group.className).toContain('ring-info/60')
  })

  /**
   * ⛔⛔ UPDATED 24 Sep 2026 (GAP-11, DESIGN-GAP-AUDIT-20260924.md row 11; Paul
   * v3.1 pt14). The per-card amber "edited since run" dot is REMOVED — it
   * duplicated the single graph-level stale cue the canvas already carries
   * (`AnalysisStateCue`), and pt14 asks for ONE overall analysis-state cue,
   * not one repeated per touched card. These two tests used to assert the
   * dot's presence and accessible name; both are replaced by one twin test
   * proving the removal is UNCONDITIONAL — the dot never renders even when
   * `editedSinceRunNodeIds` names this exact node — plus the third (below,
   * unchanged) which already asserted the negative case and needed no edit.
   */
  it('N3: a node in editedSinceRunNodeIds no longer wears any per-card dot (GAP-11)', () => {
    vi.mocked(useCanvasStore).mockImplementation((sel: any) =>
      sel({ ...nodeState([]), editedSinceRunNodeIds: new Set(['factor-1']) }),
    )
    render(<ReactFlowProvider><FactorNode {...selProps} selected={false} data={{ label: 'Capacity' }} /></ReactFlowProvider>)
    expect(screen.queryByTestId('edited-since-run-factor-1')).toBeNull()
    expect(screen.queryByRole('img', { name: 'Edited since the last analysis' })).toBeNull()
  })

  it('N3: no edited dot when the node is not in the set (and no crash without the slice)', () => {
    applyState([])
    render(<ReactFlowProvider><FactorNode {...selProps} selected={false} data={{ label: 'Capacity' }} /></ReactFlowProvider>)
    expect(screen.queryByTestId('edited-since-run-factor-1')).toBeNull()
  })

  it('D2: at LOD zoom a factor node KEEPS its title, and hides only the body', () => {
    // ⚠ THIS PIN WAS INVERTED ON PURPOSE (30 Aug 2026). It previously required
    // the title to be `visibility: hidden` at LOD zoom, which is what made the
    // graph read as anonymous coloured boxes the moment a user zoomed out to
    // look at structure. A node never loses its name; the BODY still simplifies,
    // which is the part of the original rationale that holds.
    vi.mocked(useCanvasStore).mockImplementation((sel: any) =>
      sel({ ...nodeState([]), lodRung: 'line' }),
    )
    // ⚠ THE FIXTURE GAINED A STATED VALUE ON 14 Sep 2026, AND THAT IS THE POINT.
    // It was `{ label: 'Capacity' }` — a factor with no value, no `external`
    // category and no prior, so `lodBodyLine` resolves to NULL for it. The body
    // no longer blanks in that case (a card's content is never removed without
    // something put in its place), so the old fixture stopped exercising the
    // branch this test names. A value keeps the discriminating half real.
    render(<ReactFlowProvider><FactorNode {...selProps} selected={false} data={{ label: 'Capacity', observedState: { raw_value: 0.62, unit: null } }} /></ReactFlowProvider>)
    const title = screen.getAllByTestId('node-title')[0]
    expect(title).not.toHaveStyle({ visibility: 'hidden' })
    // The discriminating half: the body IS still hidden, so this test cannot
    // pass on a build that simply removed level-of-detail altogether.
    expect(document.querySelector('[data-lod-hidden="true"]')).not.toBeNull()
  })

  it('D2 TWIN: a card with NO reduced line to show does NOT blank its body', () => {
    // ⭐ THE PAIR IS WHAT BINDS THE PROPERTY. The case above proves the body
    // still hides when there IS a replacement; this proves it does NOT hide
    // when there is none. Keeping only the first leaves a test that cannot see
    // the change — it would pass equally on a build that blanks every card.
    vi.mocked(useCanvasStore).mockImplementation((sel: any) =>
      sel({ ...nodeState([]), lodRung: 'line' }),
    )
    render(<ReactFlowProvider><FactorNode {...selProps} selected={false} data={{ label: 'Capacity' }} /></ReactFlowProvider>)
    expect(screen.getAllByTestId('node-title')[0]).not.toHaveStyle({ visibility: 'hidden' })
    expect(screen.queryByTestId('node-lod-line')).toBeNull()   // precondition: there is genuinely no replacement
    expect(document.querySelector('[data-lod-hidden="true"]')).toBeNull()
  })

  it('D2: at LOD zoom a goal node keeps a boosted, visible title', () => {
    vi.mocked(useCanvasStore).mockImplementation((sel: any) =>
      sel({ ...nodeState([]), lodRung: 'line' }),
    )
    render(<ReactFlowProvider><GoalNode {...selProps} id="goal-1" type="goal" selected={false} data={{ label: 'Ship the roadmap' }} /></ReactFlowProvider>)
    const title = screen.getAllByTestId('node-title')[0]
    expect(title).not.toHaveStyle({ visibility: 'hidden' })
    expect(title.className).toContain('font-semibold')
  })

  it('D2: at normal zoom titles render exactly as before (no LOD classes)', () => {
    applyState([])
    render(<ReactFlowProvider><FactorNode {...selProps} selected={false} data={{ label: 'Capacity' }} /></ReactFlowProvider>)
    const title = screen.getAllByTestId('node-title')[0]
    expect(title).not.toHaveStyle({ visibility: 'hidden' })
    expect(title.className).not.toContain('text-lg')
  })

  it('N2: a non-highlighted node has no pulse', () => {
    applyState([])
    render(<ReactFlowProvider><FactorNode {...selProps} selected={false} data={{ label: 'Capacity' }} /></ReactFlowProvider>)
    const group = screen.getAllByRole('group')[0]
    expect(group.className).not.toContain('ai-highlight-pulse')
  })
})
