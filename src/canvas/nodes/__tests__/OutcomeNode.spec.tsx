/**
 * OutcomeNode render tests
 * T9: Bridge edge data — contribution % + qualitative direction
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LINK_STRENGTH_COPY } from '../shared/metricVocabulary'

import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReactFlowProvider } from '@xyflow/react'
import { OutcomeNode } from '../OutcomeNode'
import { USER_EDGE_DEFAULTS, DEFAULT_EDGE_DATA } from '../../domain/edges'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

const makeStoreState = (overrides: Record<string, unknown> = {}) => ({
  results: { status: 'idle', report: null },
  highlightedNodes: new Set(),
  dimmedNodeIds: new Set(),
  lens: { _dimmedNodeIds: new Set() },
  goalThreshold: null,
  goalConstraints: [],
  edges: [],
  nodes: [],
  viewMode: 'expert',
  ...overrides,
})

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector) => selector(makeStoreState())),
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

import { useCanvasStore } from '../../store'
import { useGuidanceStore } from '../../stores/guidanceStore'
import { useNodeDisplayMetadata } from '../../hooks/useNodeDisplayMetadata'

const baseProps = {
  id: 'outcome-1',
  type: 'outcome',
  position: { x: 0, y: 0 },
  selected: false,
  isConnectable: true,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  dragging: false,
  zIndex: 0,
}

const renderOutcome = (data: Record<string, unknown> = {}) =>
  render(
    <ReactFlowProvider>
      <OutcomeNode {...(baseProps as any)} data={{ label: 'Revenue growth', type: 'outcome', ...data }} />
    </ReactFlowProvider>
  )


// R6 (Paul, 16 Aug 2026) — and the correction a review forced on it.
//
// The word "assumed" is gone: it printed beside EVERY bridge strength, including
// ones the user had stated, so it was false about half the values it labelled.
// What is NOT gone is the NOUN. The first attempt dropped it and left a bare
// "85%", which re-opens the very defect UI-SEM-089 exists to close — and the
// review measured that: the relabel-to-"% contribution" mutant REDs at base and
// SURVIVED at that head, because the guard had been flipped from a PRESENCE
// assertion to an ABSENCE one and could no longer see the masquerade.
//
// So the two claims are asserted SEPARATELY below, because they are separate:
//   • the honesty claim — a noun is present, on BOTH branches (PRESENCE)
//   • the placeholder claim — `est.` appears only when nobody stated the value
// Never collapse the first into the second again: an absence assertion cannot
// observe a relabel.
describe('OutcomeNode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useCanvasStore).mockImplementation((selector) => selector(makeStoreState() as any))
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
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
    })
  })

  it('renders label', () => {
    renderOutcome()
    expect(screen.getByText('Revenue growth')).toBeDefined()
  })

  it('renders shape indicator (type line removed in v1.1)', () => {
    renderOutcome()
    expect(screen.getByLabelText(/^Outcome:/i)).toBeDefined()
  })

  // ED #63 5809278282 (bounded anatomy): in Standard the preview moved off the
  // card body to the node popover; the chevron still recovers the full text.
  it('previews the authored consequence in the popover and keeps the full description expandable', async () => {
    const description = 'Customer support demand may grow before the extra revenue covers new staffing. '.repeat(5).trim()
    vi.mocked(useCanvasStore).mockImplementation((selector) => selector(makeStoreState({ viewMode: 'standard' }) as any))
    const body = 'Keep the wider strategic context and unresolved disagreements visible.'
    const { container } = renderOutcome({ description, body })
    expect(screen.queryByTestId('outcome-context-preview')).toBeNull()
    fireEvent.mouseEnter(container.firstElementChild as Element)
    const preview = await screen.findByTestId('outcome-popover-context')
    expect(preview).toHaveTextContent(description)
    expect(preview.closest('[data-node-popover]')).not.toBeNull()
    fireEvent.mouseLeave(container.firstElementChild as Element)
    expect(container.querySelector('.node-description')).toBeNull()
    screen.getByRole('button', { name: 'Expand description' }).focus()
    await userEvent.keyboard('{Enter}')
    expect(container.querySelector('.node-description')).toHaveTextContent(description)
    expect(container.querySelector('.node-description')).toHaveTextContent(body)
    expect(screen.getByLabelText(/^Outcome:/i)).toHaveAttribute('aria-expanded', 'true')
  })

  it.each([undefined, '   '])('uses the authored body when description is %s', async (description) => {
    const body = '  Preserve the source wording.\nAlso retain the second paragraph.  '
    const { container } = renderOutcome({ description, body })
    expect(screen.getByTestId('outcome-context-preview').textContent).toBe(body)
    await userEvent.click(screen.getByRole('button', { name: 'Expand description' }))
    // The shared renderer preserves the authored newline as <br>, not a text space.
    const expanded = container.querySelector('.node-description')
    expect(expanded).toHaveTextContent('Preserve the source wording.')
    expect(expanded).toHaveTextContent('Also retain the second paragraph.')
    expect(container.querySelector('.node-description br')).not.toBeNull()
  })

  it('does not repeat matching body text in the expanded context', async () => {
    const { container } = renderOutcome({ description: 'Review the evidence.', body: ' Review the evidence. ' })
    await userEvent.click(screen.getByRole('button', { name: 'Expand description' }))
    expect(container.querySelector('.node-description')?.textContent?.trim()).toBe('Review the evidence.')
  })

  it('handles blank names and descriptions without inventing a consequence', () => {
    renderOutcome({ label: '   ', description: '   ' })
    expect(screen.getByText('Untitled outcome')).toBeDefined()
    expect(screen.queryByTestId('outcome-context-preview')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Expand description' })).toBeNull()
  })

  it.each(['idle', 'complete'])('can explore an adverse consequence in the %s phase with its authored context', async (status) => {
    vi.mocked(useCanvasStore).mockImplementation((selector) => selector(makeStoreState({ results: { status, report: null } }) as any))
    const dispatch = vi.fn()
    vi.spyOn(useGuidanceStore, 'getState').mockReturnValue({ ...useGuidanceStore.getState(), _dispatchAction: dispatch })
    renderOutcome({ label: 'Increased customer churn', description: 'Existing customers may leave after a price increase.', body: 'The wider effect on referrals is unresolved.' })
    await userEvent.click(screen.getByRole('button', { name: 'Explore consequences' }))
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
      parameters: { chip_id: 'outcome_explore_consequences' },
      message: 'What would Increased customer churn mean for this model, including possible benefits and downsides?\nOutcome context: Existing customers may leave after a price increase.\n\nThe wider effect on referrals is unresolved.',
      source: 'chip',
    }))
  })

  it('keeps long upstream names intact when validating an outcome assumption', async () => {
    const factorLabel = 'Availability of experienced account managers during the autumn renewal period'
    vi.mocked(useCanvasStore).mockImplementation((selector) => selector(makeStoreState({
      results: { status: 'complete', report: null },
      nodes: [
        { id: 'factor-1', type: 'factor', data: { label: factorLabel, type: 'factor' } },
        { id: 'outcome-1', type: 'outcome', data: { label: 'Revenue growth', type: 'outcome' } },
      ],
      edges: [{ id: 'factor-outcome', source: 'factor-1', target: 'outcome-1', data: { weight: 0.6, weightSource: 'user' } }],
    }) as any))
    const dispatch = vi.fn()
    vi.spyOn(useGuidanceStore, 'getState').mockReturnValue({ ...useGuidanceStore.getState(), _dispatchAction: dispatch })
    renderOutcome({ description: 'Retaining existing accounts supports this outcome.' })
    expect(screen.getByText(`Test the connection from ${factorLabel}`)).toBeDefined()
    await userEvent.click(screen.getByRole('button', { name: 'Validate this assumption' }))
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
      message: `How can I validate my assumption about ${factorLabel} and its effect on Revenue growth?\nOutcome context: Retaining existing accounts supports this outcome.`,
    }))
  })

  it('keeps goal probability out of the compact Standard card', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) => selector(makeStoreState({ viewMode: 'standard' }) as any))
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null, influence: null, confidence: null, inSensitivityAnalysis: false,
      achievementProbability: 0.68, stabilityPercentage: null, winRate: null, isResultsMode: true,
      predictedOutcome: null, valueOfInformation: null, voiRank: null,
    } as any)
    renderOutcome()
    expect(screen.queryByText('Goal chance: 68%')).toBeNull()
  })

  it('has displayName set', () => {
    expect(OutcomeNode.displayName).toBe('OutcomeNode')
  })

  // T9: Bridge edge data
  it('does not show bridge edge data when results status is not complete', () => {
    renderOutcome()
    expect(screen.queryByText(/influence on goal/)).toBeNull()
  })

  it('shows NO bridge strength on the card in results mode, even one a person set (contract v3.1)', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: { status: 'complete', report: null },
        nodes: [
          { id: 'outcome-1', type: 'outcome', data: { type: 'outcome' } },
          { id: 'goal-1', data: { type: 'goal' } },
        ],
        edges: [
          {
            id: 'e1',
            source: 'outcome-1',
            target: 'goal-1',
            // Fixture stamped `weightSource: 'user'` (F4 follow-up) — see the
            // matching note in RiskNode.spec.tsx. An unstamped 0.75 is
            // indistinguishable from a UI default and no longer renders.
            data: { weight: 0.75, direction: 'positive', beliefExists: null, weightSource: 'user' },
          },
        ],
      }) as any)
    )
    const { container } = renderOutcome()
    // ⚠ SUPERSEDED BY CONTRACT v3.1 (gap U1): this pinned the "Link strength"
    // noun + figure on the card (UI-SEM-089 display honesty; ED 11:52Z). v3.1:
    // "Outcome/risk records are distinct from the strength of their
    // connections" — the figure lives on the connection. With no readout on
    // the card there is nothing to relabel as a computed output.
    expect(screen.getByText('Revenue growth')).toBeInTheDocument() // CONTRAST: the card rendered
    expect(screen.queryByTestId('outcome-strength-row')).toBeNull()
    expect(container.textContent).not.toContain(LINK_STRENGTH_COPY.noun)
    expect(container.textContent).not.toContain('75%')
    expect(screen.queryByText(/of your goal/)).toBeNull()
  })

  it('does not show certainty even when beliefExists is present', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: { status: 'complete', report: null },
        nodes: [
          { id: 'outcome-1', type: 'outcome', data: { type: 'outcome' } },
          { id: 'goal-1', data: { type: 'goal' } },
        ],
        edges: [
          {
            id: 'e1',
            source: 'outcome-1',
            target: 'goal-1',
            data: { weight: 0.5, direction: 'positive', beliefExists: 0.8 },
          },
        ],
      }) as any)
    )
    renderOutcome()
    expect(screen.queryByText(/certain/)).toBeNull()
  })

  it('does not show bridge edge when no matching edge found', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: { status: 'complete', report: null },
        nodes: [
          { id: 'outcome-1', type: 'outcome', data: { type: 'outcome' } },
          { id: 'goal-1', data: { type: 'goal' } },
        ],
        edges: [
          // edge goes the wrong way
          { id: 'e1', source: 'goal-1', target: 'outcome-1', data: {} },
        ],
      }) as any)
    )
    renderOutcome()
    expect(screen.queryByText(/influence on goal/)).toBeNull()
  })

  it('does not show bridge edge when no goal node exists', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: { status: 'complete', report: null },
        nodes: [{ id: 'outcome-1', type: 'outcome', data: { type: 'outcome' } }],
        edges: [],
      }) as any)
    )
    renderOutcome()
    expect(screen.queryByText(/influence on goal/)).toBeNull()
  })

  it('shows achievement probability when available', () => {
    vi.mocked(useNodeDisplayMetadata).mockReturnValue({
      sensitivityRank: null,
      influence: null,
      confidence: null,
      inSensitivityAnalysis: false,
      achievementProbability: 0.68,
      stabilityPercentage: null,
      winRate: null,
      isResultsMode: true,
      predictedOutcome: null,
      valueOfInformation: null,
      voiRank: null,
    })
    renderOutcome()
    /**
     * ⛔⛔ THIS ASSERTION IS INVERTED, 17 Sep 2026, BY A DERIVATION AT THE
     * PRODUCER — AND THE OLD ONE IS QUOTED RATHER THAN REPLACED.
     *
     * It read `expect(screen.getByText('Goal chance: 68%')).toBeDefined()`, and
     * two sibling tests pinned the modelled-basis caveat beside it. All three
     * are gone with the block they guarded.
     *
     * `achievementProbability` is resolved at
     * `hooks/useNodeDisplayMetadata.ts:484-516` as
     * `selectGoalProbability(option_probabilities[robustness.recommended_option_id])`
     * — **the recommended OPTION's probability of achieving THE GOAL.** No
     * outcome id appears anywhere in that read, so the figure was IDENTICAL on
     * every outcome card in a model. `OutcomeNode`'s own comment said as much
     * (*"the analysis goal probability, not an outcome-specific forecast"*)
     * while the comment at its mount site said the opposite (*"probability of
     * the outcome occurring at all"*). One number, two comments, and the user
     * read a third thing on screen.
     *
     * Rule 6 — *a card may not display a metric the product does not produce* —
     * and measured coverage for this kind is provenance only, 15 of 15.
     * `GoalNode` still renders the figure, with its caveat, on the node it
     * belongs to; the caveat machinery is untouched there.
     */
    expect(screen.queryByText('Goal chance: 68%')).toBeNull()
    expect(screen.queryByTestId('goal-fit-basis-caveat-outcome-node')).toBeNull()

    // ⚠ PRECONDITION, so this is not a pass by failing to render anything: the
    // card is on screen and in the Detailed view the figure used to live in.
    expect(screen.getByText('Revenue growth')).toBeDefined()
  })



  // Wireframe v4 OutcomePostDet: Detailed view caps "Depends on:" ConnRows at 3
  // even when more inbound factors exist.
  it('caps Depends on ConnRows at 3 in Detailed post-analysis view', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: { status: 'complete', report: null },
        nodes: [
          { id: 'outcome-1', type: 'outcome', data: { type: 'outcome', label: 'Revenue' } },
          { id: 'goal-1', data: { type: 'goal' } },
          { id: 'f1', type: 'factor', data: { type: 'factor', label: 'Factor One' } },
          { id: 'f2', type: 'factor', data: { type: 'factor', label: 'Factor Two' } },
          { id: 'f3', type: 'factor', data: { type: 'factor', label: 'Factor Three' } },
          { id: 'f4', type: 'factor', data: { type: 'factor', label: 'Factor Four' } },
          { id: 'f5', type: 'factor', data: { type: 'factor', label: 'Factor Five' } },
        ],
        edges: [
          { id: 'b1', source: 'outcome-1', target: 'goal-1', data: { weight: 0.5, direction: 'positive' } },
          { id: 'e1', source: 'f1', target: 'outcome-1', data: { exists_probability: 0.9 } },
          { id: 'e2', source: 'f2', target: 'outcome-1', data: { exists_probability: 0.85 } },
          { id: 'e3', source: 'f3', target: 'outcome-1', data: { exists_probability: 0.8 } },
          { id: 'e4', source: 'f4', target: 'outcome-1', data: { exists_probability: 0.75 } },
          { id: 'e5', source: 'f5', target: 'outcome-1', data: { exists_probability: 0.7 } },
        ],
        viewMode: 'expert',
      }) as any)
    )
    renderOutcome()
    // First three sorted-by-confidence factors render; the 4th and 5th do not.
    expect(screen.getByText('Factor One')).toBeDefined()
    expect(screen.getByText('Factor Two')).toBeDefined()
    expect(screen.getByText('Factor Three')).toBeDefined()
    expect(screen.queryByText('Factor Four')).toBeNull()
    expect(screen.queryByText('Factor Five')).toBeNull()
  })
})

// Audit §8 P0-5: the capped "Depends on:" list discloses the remainder with
// a plain "+N more in inspector" line (whole rows only, no clipping).
describe('OutcomeNode — Depends on overflow disclosure (audit §8 P0-5)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useCanvasStore).mockImplementation((selector) => selector(makeStoreState() as any))
  })

  it('renders "+2 more in inspector" when 5 inbound factors exist', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: { status: 'complete', report: null },
        nodes: [
          { id: 'outcome-1', type: 'outcome', data: { type: 'outcome', label: 'Revenue' } },
          { id: 'f1', type: 'factor', data: { type: 'factor', label: 'Factor One' } },
          { id: 'f2', type: 'factor', data: { type: 'factor', label: 'Factor Two' } },
          { id: 'f3', type: 'factor', data: { type: 'factor', label: 'Factor Three' } },
          { id: 'f4', type: 'factor', data: { type: 'factor', label: 'Factor Four' } },
          { id: 'f5', type: 'factor', data: { type: 'factor', label: 'Factor Five' } },
        ],
        edges: [
          { id: 'e1', source: 'f1', target: 'outcome-1', data: { exists_probability: 0.9 } },
          { id: 'e2', source: 'f2', target: 'outcome-1', data: { exists_probability: 0.85 } },
          { id: 'e3', source: 'f3', target: 'outcome-1', data: { exists_probability: 0.8 } },
          { id: 'e4', source: 'f4', target: 'outcome-1', data: { exists_probability: 0.75 } },
          { id: 'e5', source: 'f5', target: 'outcome-1', data: { exists_probability: 0.7 } },
        ],
        viewMode: 'expert',
      }) as any)
    )
    renderOutcome()
    expect(screen.getAllByText('+2 more in inspector').length).toBeGreaterThan(0)
  })

  it('renders no overflow line with 3 or fewer inbound factors', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: { status: 'complete', report: null },
        nodes: [
          { id: 'outcome-1', type: 'outcome', data: { type: 'outcome', label: 'Revenue' } },
          { id: 'f1', type: 'factor', data: { type: 'factor', label: 'Factor One' } },
        ],
        edges: [
          { id: 'e1', source: 'f1', target: 'outcome-1', data: { exists_probability: 0.9 } },
        ],
        viewMode: 'expert',
      }) as any)
    )
    renderOutcome()
    expect(screen.queryByText(/more in inspector/)).toBeNull()
  })

  // ── F4: pre-analysis "Strongest: X at N%." was a UI default spoken as prose ──
  //
  // POSITIVE CONTROL FIRST. Without a demonstrated PRESENCE the absence cases
  // below prove nothing (trap 13): they would also pass if the popover simply
  // never rendered.
  describe('pre-analysis inbound strengths (F4)', () => {
    const preAnalysisStore = (edgeData: Record<string, unknown>) =>
      vi.mocked(useCanvasStore).mockImplementation((selector) =>
        selector(makeStoreState({
          results: { status: 'idle', report: null },
          nodes: [
            { id: 'outcome-1', type: 'outcome', data: { type: 'outcome', label: 'Revenue growth' } },
            { id: 'f1', type: 'factor', data: { type: 'factor', label: 'Unit price' } },
          ],
          edges: [{ id: 'e1', source: 'f1', target: 'outcome-1', data: edgeData }],
          viewMode: 'expert',
        }) as any)
      )

    it('POSITIVE CONTROL: DOES render the figure for a strength somebody set', () => {
      preAnalysisStore({ weight: 0.42, direction: 'positive', weightSource: 'cee' })
      renderOutcome()
      expect(screen.getByText(/Driven by:/)).toBeDefined()
      expect(screen.getByText('42%')).toBeDefined()
      expect(screen.queryByText(/Not set/)).toBeNull()
    })

    it('renders "Not set", never the USER_EDGE_DEFAULTS weight, for an edge merely drawn', () => {
      preAnalysisStore({ ...USER_EDGE_DEFAULTS })
      renderOutcome()
      // The row IS rendered — the relationship is real, only the number is not.
      expect(screen.getByText(/Driven by:/)).toBeDefined()
      expect(screen.getByText('Unit price')).toBeDefined()
      expect(screen.getByTestId('pre-analysis-strength-unset-e1')).toBeDefined()
      // 0.3 → "30%" must not appear anywhere in the card.
      expect(USER_EDGE_DEFAULTS.weight).toBe(0.3)
      expect(screen.queryByText('30%')).toBeNull()
    })

  })

  // ── NEW-1: the bridge-to-goal % had a gate that could not fire ───────────
  // `hasStrength = strength_mean present || weight != null` is a TAUTOLOGY —
  // DEFAULT_EDGE_DATA / USER_EDGE_DEFAULTS always define `weight` — so every
  // edge rendered the default as a bold coloured contribution figure. Same
  // shape as F1's dead read gate, in a different file.
  describe('bridge-to-goal strength (NEW-1) — off the card in every provenance state (contract v3.1)', () => {
    /*
     * ⚠ SUPERSEDED BY CONTRACT v3.1 (gap U1). These cases pinned what the card's
     * link-strength row said in each provenance state (a person's figure; an
     * Olumi estimate disclosed as an assumption; "not set" for an edge nobody
     * characterised). v3.1 takes the row off the card, so NEW-1's defect — a UI
     * default printed as a contribution — cannot reach this card at all. The
     * provenance reading now lives on the connection (`EdgePills`, the edge
     * hover, `EdgePanel`) and `domain/edgeStrengthSettlement.ts`.
     */
    const bridgeStore = (edgeData: Record<string, unknown>) =>
      vi.mocked(useCanvasStore).mockImplementation((selector) =>
        selector(makeStoreState({
          results: { status: 'complete', report: null },
          nodes: [
            { id: 'outcome-1', type: 'outcome', data: { type: 'outcome' } },
            { id: 'goal-1', data: { type: 'goal' } },
          ],
          edges: [{ id: 'b1', source: 'outcome-1', target: 'goal-1', data: edgeData }],
        }) as any)
      )

    it('fixture precondition: the UI defaults are the values NEW-1 printed', () => {
      expect(USER_EDGE_DEFAULTS.weight).toBe(0.3)
      expect(DEFAULT_EDGE_DATA.weight).toBe(0.5)
    })

    it.each([
      ['a person set it', { weight: 0.6, direction: 'positive', weightSource: 'user' }, '60%'],
      ['Olumi estimated it', { weight: 0.6, direction: 'positive', weightSource: 'cee' }, '60%'],
      ['an edge merely drawn (USER_EDGE_DEFAULTS)', { ...USER_EDGE_DEFAULTS }, '30%'],
      ['a bare DEFAULT_EDGE_DATA weight', { ...DEFAULT_EDGE_DATA }, '50%'],
      ['CEE back-compat strength_mean', { strength_mean: 0.45, weight: 0.3 }, '45%'],
    ])('%s: no row, no figure, no noun, no `est.` on the card', (_state, edgeData, figure) => {
      bridgeStore(edgeData as Record<string, unknown>)
      const { container } = renderOutcome()
      expect(screen.getByText('Revenue growth')).toBeInTheDocument() // CONTRAST: the card rendered
      expect(screen.queryByTestId('outcome-strength-row')).toBeNull()
      expect(container.textContent).not.toContain(figure)
      expect(container.textContent).not.toContain(LINK_STRENGTH_COPY.noun)
      expect(container.textContent).not.toContain(LINK_STRENGTH_COPY.olumiEstimate)
      expect(container.innerHTML).not.toMatch(/assum\w* {0,1}\d+%/i)
      expect(screen.queryByTestId('estimate-marker')).toBeNull()
    })
  })
})

/**
 * UI-SEM-089 anti-relabel guard — SUPERSEDED BY CONTRACT v3.1 (gap U1).
 *
 * This block pinned a PRESENCE assertion: the bridge figure always carried an
 * honest noun ("Link strength"), never one naming it a computed output, on both
 * provenance branches (R6: an absence-only guard could not see a relabel).
 * v3.1 removes the readout from the card ("Outcome/risk records are distinct
 * from the strength of their connections"), which satisfies UI-SEM-089 by
 * construction: no on-card number exists to masquerade. The guard is kept as
 * the stronger claim that is now true — neither the figure NOR any member of the
 * forbidden family appears, on either branch — with the card's own label as the
 * presence control that stops it passing on an empty render.
 */
describe('OutcomeNode — UI-SEM-089 superseded: no bridge figure on the card, so none to relabel', () => {
  const FORBIDDEN = [/contribution/i, /of your goal/i, /goal drag/i, /impact on/i]

  const seedBridge = (weightSource: string) =>
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: { status: 'complete', report: null },
        nodes: [
          { id: 'outcome-1', type: 'outcome', data: { type: 'outcome' } },
          { id: 'goal-1', data: { type: 'goal' } },
        ],
        edges: [{ id: 'b1', source: 'outcome-1', target: 'goal-1', data: { weight: 0.85, direction: 'positive', weightSource } }],
      }) as any)
    )

  it.each([['user-stated', 'user'], ['estimated', 'cee']])(
    'the %s branch renders neither the figure nor a computed-output noun',
    (_label, source) => {
      seedBridge(source)
      const { container } = renderOutcome()
      const text = container.textContent ?? ''
      expect(screen.getByText('Revenue growth')).toBeInTheDocument() // presence control
      expect(text).not.toContain('85%')
      expect(text).not.toContain(LINK_STRENGTH_COPY.noun)
      for (const banned of FORBIDDEN) {
        expect(text).not.toMatch(banned)
      }
    },
  )
})
