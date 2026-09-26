/**
 * RiskNode render tests
 * T9: Bridge edge data — contribution % + qualitative direction
 * Severity badge rendering
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LINK_STRENGTH_COPY } from '../shared/metricVocabulary'

import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReactFlowProvider } from '@xyflow/react'
import { RiskNode } from '../RiskNode'
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
  })),
}))

import { useCanvasStore } from '../../store'
import { useGuidanceStore } from '../../stores/guidanceStore'

const baseProps = {
  id: 'risk-1',
  type: 'risk',
  position: { x: 0, y: 0 },
  selected: false,
  isConnectable: true,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  dragging: false,
  zIndex: 0,
}

const renderRisk = (data: Record<string, unknown> = {}) =>
  render(
    <ReactFlowProvider>
      <RiskNode {...(baseProps as any)} data={{ label: 'Key person dependency', type: 'risk', ...data }} />
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
describe('RiskNode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useCanvasStore).mockImplementation((selector) => selector(makeStoreState() as any))
  })

  it('renders label', () => {
    renderRisk()
    expect(screen.getByText('Key person dependency')).toBeDefined()
  })

  it('renders shape indicator (type line removed in v1.1)', () => {
    renderRisk()
    expect(screen.getByLabelText(/^Risk:/i)).toBeDefined()
  })

  // ED #63 5809278282 (bounded anatomy): in Standard the preview moved off the
  // card body to the node popover; the chevron still recovers the full text.
  it('keeps authored context in the popover and recovers the full description with the keyboard', async () => {
    const description = 'A departure could interrupt account handovers and delay renewal conversations. '.repeat(5).trim()
    vi.mocked(useCanvasStore).mockImplementation((selector) => selector(makeStoreState({ viewMode: 'standard' }) as any))
    const body = 'Keep the wider strategic context and unresolved disagreements visible.'
    const { container } = renderRisk({ description, body })
    expect(screen.queryByTestId('risk-context-preview')).toBeNull()
    fireEvent.mouseEnter(container.firstElementChild as Element)
    const preview = await screen.findByTestId('risk-popover-context')
    expect(preview).toHaveTextContent(description)
    expect(preview.closest('[data-node-popover]')).not.toBeNull()
    fireEvent.mouseLeave(container.firstElementChild as Element)
    expect(container.querySelector('.node-description')).toBeNull()
    screen.getByRole('button', { name: 'Expand description' }).focus()
    await userEvent.keyboard('{Enter}')
    expect(container.querySelector('.node-description')).toHaveTextContent(description)
    expect(container.querySelector('.node-description')).toHaveTextContent(body)
    expect(screen.getByLabelText(/^Risk:/i)).toHaveAttribute('aria-expanded', 'true')
  })

  it.each([undefined, '   '])('uses the authored body when description is %s', async (description) => {
    const body = '  Preserve the source wording.\nAlso retain the second paragraph.  '
    const { container } = renderRisk({ description, body })
    expect(screen.getByTestId('risk-context-preview').textContent).toBe(body)
    await userEvent.click(screen.getByRole('button', { name: 'Expand description' }))
    // The shared renderer preserves the authored newline as <br>, not a text space.
    const expanded = container.querySelector('.node-description')
    expect(expanded).toHaveTextContent('Preserve the source wording.')
    expect(expanded).toHaveTextContent('Also retain the second paragraph.')
    expect(container.querySelector('.node-description br')).not.toBeNull()
  })

  it('does not repeat matching body text in the expanded context', async () => {
    const { container } = renderRisk({ description: 'Review the evidence.', body: ' Review the evidence. ' })
    await userEvent.click(screen.getByRole('button', { name: 'Expand description' }))
    expect(container.querySelector('.node-description')?.textContent?.trim()).toBe('Review the evidence.')
  })

  it('handles blank authored content without an empty description control', () => {
    renderRisk({ label: '   ', description: '   ' })
    expect(screen.getByText('Untitled risk')).toBeDefined()
    expect(screen.queryByTestId('risk-context-preview')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Expand description' })).toBeNull()
  })

  it.each([NaN, Infinity, -0.1, 1.1, '0.8'])('does not turn malformed probability %s into a risk estimate', (probability) => {
    renderRisk({ probability, impact: 'high' })
    expect(screen.queryByText(/% likely/)).toBeNull()
    expect(screen.queryByText(/^(High|Medium|Low) risk$/i)).toBeNull()
    expect(screen.getByText('Entered estimate · High impact')).toBeDefined()
  })

  it('preserves a stated zero likelihood and ignores an unknown impact', () => {
    renderRisk({ probability: 0, impact: 'extreme' })
    expect(screen.getByText('Entered estimate · 0% likely')).toBeDefined()
    expect(screen.queryByText(/extreme impact/i)).toBeNull()
  })

  it('sends the complete authored risk context when exploring mitigation', async () => {
    const dispatch = vi.fn()
    vi.spyOn(useGuidanceStore, 'getState').mockReturnValue({ ...useGuidanceStore.getState(), _dispatchAction: dispatch })
    renderRisk({ description: 'Only two people hold the renewal account knowledge.', body: 'No handover plan is documented.' })
    await userEvent.click(screen.getByRole('button', { name: 'Explore mitigation' }))
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
      parameters: { chip_id: 'risk_add_mitigation' },
      message: 'Suggest a mitigation strategy for Key person dependency, and explain what it would change.\nRisk context: Only two people hold the renewal account knowledge.\n\nNo handover plan is documented.',
      source: 'chip',
    }))
  })

  it('has displayName set', () => {
    expect(RiskNode.displayName).toBe('RiskNode')
  })

  // Severity badge
  // contract v3.1 T13: the badge is sentence case — "High risk", not "High Risk".
  it('shows High risk badge when probability is high and impact is high', () => {
    renderRisk({ probability: 0.9, impact: 'high' })
    expect(screen.getByText('High risk')).toBeDefined()
  })

  it('shows Low risk badge when probability is low and impact is low', () => {
    renderRisk({ probability: 0.1, impact: 'low' })
    expect(screen.getByText('Low risk')).toBeDefined()
  })

  it('does not show severity badge when probability and impact are absent', () => {
    renderRisk()
    // Severity badge shows "High risk", "Medium risk", etc. — not the plain "Risk" type label
    expect(screen.queryByText(/^(High|Medium|Low) risk$/i)).toBeNull()
  })

  // P1.7 — severity badge visible in STANDARD view (was Expert/popover-only).
  // Locked Canvas design (23 Sep 2026): REVERSED by the locked spec (#1900,
  // credited by the purpose audit) — the DERIVED severity band ("High Risk") has
  // UI-chosen cut-offs, so it is not a resting claim and is Detailed-only. The
  // user's OWN entered likelihood/impact stays on the Standard face. Asserted as
  // absence on the Standard face + presence in Detailed + the entered line kept.
  it('keeps the derived severity badge OFF the Standard face, and shows it in Detailed', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({ viewMode: 'standard' }) as any)
    )
    const standard = renderRisk({ probability: 0.9, impact: 'high' })
    expect(screen.queryByText(/^(High|Medium|Low) risk$/i)).toBeNull()
    // Positive control in the SAME render: the entered exposure line is there
    // (ED 5809278282: figures shown, the qualified sentence announced).
    expect(screen.getByTestId('risk-exposure-line').querySelector('[aria-hidden="true"]')?.textContent).toBe('90% likely · High impact')
    standard.unmount()

    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({ viewMode: 'expert' }) as any)
    )
    renderRisk({ probability: 0.9, impact: 'high' })
    expect(screen.getByText('High risk')).toBeDefined()
  })

  // P1.7 — the defining probability × impact pair is shown in the body.
  // ⚠ RE-POINTED FOR ED #63 5809278282 (bounded anatomy, one primary line): the
  // pair is the line, figures first; `Entered estimate` left the VISIBLE line
  // (43 characters cannot be one ~19-character landing line) and rides sr-only,
  // `title` and the popover. The 9 Sep "no native tooltip" rule was about a
  // qualifier that was visible; the title is now the sighted-mouse recovery
  // for one that is not, so it is asserted PRESENT.
  it('shows the probability/impact pair in STANDARD view', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({ viewMode: 'standard' }) as any)
    )
    renderRisk({ probability: 0.9, impact: 'high' })
    const line = screen.getByTestId('risk-exposure-line')
    expect(line.querySelector('[aria-hidden="true"]')?.textContent).toBe('90% likely · High impact')
    expect(screen.getByTestId('risk-primary-line-full').textContent).toBe('Entered estimate · 90% likely · High impact')
    // Design audit #13 (26 Sep): no native title. The provenance is on the
    // line itself (" · entered"), in full for a screen reader, and in the popover.
    expect(line).not.toHaveAttribute('title')
    expect(screen.getByTestId('risk-exposure-provenance').textContent).toBe(' · entered')
  })

  // P1.7 — honest absence: no fabricated pair when data is missing.
  it('does not show a probability/impact pair when both are absent', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({ viewMode: 'standard' }) as any)
    )
    renderRisk()
    expect(screen.queryByText(/% likely/)).toBeNull()
    expect(screen.queryByText(/impact$/)).toBeNull()
  })

  // P1.7 — partial data: show only the part that exists (probability only).
  it('shows only likelihood when impact is absent', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({ viewMode: 'standard' }) as any)
    )
    renderRisk({ probability: 0.5 })
    // ED 5809278282: figures shown, the qualified sentence announced (sr-only).
    expect(screen.getByTestId('risk-exposure-line').querySelector('[aria-hidden="true"]')?.textContent).toBe('50% likely')
    expect(screen.getByTestId('risk-primary-line-full').textContent).toBe('Entered estimate · 50% likely')
    expect(screen.queryByText(/impact/)).toBeNull()
  })

  // T9: Bridge edge data
  it('does not show bridge edge data when results status is not complete', () => {
    renderRisk()
    expect(screen.queryByText(/influence on goal/)).toBeNull()
  })

  it('shows NO bridge strength on the card in results mode, even one a person set (contract v3.1)', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: { status: 'complete', report: null },
        nodes: [
          { id: 'risk-1', type: 'risk', data: { type: 'risk' } },
          { id: 'goal-1', data: { type: 'goal' } },
        ],
        edges: [
          {
            id: 'e1',
            source: 'risk-1',
            target: 'goal-1',
            // Fixture stamped `weightSource: 'user'` (F4 follow-up). Before the
            // provenance gate an UNSTAMPED 0.6 rendered as "60% assumed strength",
            // so this golden-UI test was pinning a value the product could not
            // distinguish from `USER_EDGE_DEFAULTS.weight`. The test's subject is
            // the LABEL WORDING for a strength somebody set, so the fixture now
            // says somebody set it. The unstamped case is asserted separately
            // below — that pair is the positive/negative control.
            data: { weight: 0.6, direction: 'negative', beliefExists: null, weightSource: 'user' },
          },
        ],
      }) as any)
    )
    const { container } = renderRisk()
    // ⚠ SUPERSEDED BY CONTRACT v3.1 (gap U1): this pinned the "Link strength"
    // noun + figure on the card (UI-SEM-089 display honesty; ED 11:52Z). v3.1:
    // "Outcome/risk records are distinct from the strength of their
    // connections" — the figure lives on the connection. With no readout on
    // the card there is nothing to relabel as a computed output.
    expect(screen.getByText('Key person dependency')).toBeInTheDocument() // CONTRAST: the card rendered
    expect(screen.queryByTestId('risk-strength-row')).toBeNull()
    expect(container.textContent).not.toContain(LINK_STRENGTH_COPY.noun)
    expect(container.textContent).not.toContain('60%')
    expect(screen.queryByText(/goal drag/)).toBeNull()
  })

  it('does not show certainty even when beliefExists is present', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: { status: 'complete', report: null },
        nodes: [
          { id: 'risk-1', type: 'risk', data: { type: 'risk' } },
          { id: 'goal-1', data: { type: 'goal' } },
        ],
        edges: [
          {
            id: 'e1',
            source: 'risk-1',
            target: 'goal-1',
            data: { weight: 0.4, direction: 'negative', beliefExists: 0.9 },
          },
        ],
      }) as any)
    )
    renderRisk()
    expect(screen.queryByText(/certain/)).toBeNull()
  })

  it('does not show bridge edge when no goal node exists', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: { status: 'complete', report: null },
        nodes: [{ id: 'risk-1', type: 'risk', data: { type: 'risk' } }],
        edges: [],
      }) as any)
    )
    renderRisk()
    expect(screen.queryByText(/influence on goal/)).toBeNull()
  })

  // Wireframe v4: Detailed view caps "Depends on:" ConnRows at 3 even when
  // more inbound factors exist.
  it('caps Depends on ConnRows at 3 in Detailed post-analysis view', () => {
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: { status: 'complete', report: null },
        nodes: [
          { id: 'risk-1', type: 'risk', data: { type: 'risk', label: 'Key person dependency' } },
          { id: 'goal-1', data: { type: 'goal' } },
          { id: 'f1', type: 'factor', data: { type: 'factor', label: 'Risk Factor One' } },
          { id: 'f2', type: 'factor', data: { type: 'factor', label: 'Risk Factor Two' } },
          { id: 'f3', type: 'factor', data: { type: 'factor', label: 'Risk Factor Three' } },
          { id: 'f4', type: 'factor', data: { type: 'factor', label: 'Risk Factor Four' } },
          { id: 'f5', type: 'factor', data: { type: 'factor', label: 'Risk Factor Five' } },
        ],
        edges: [
          { id: 'b1', source: 'risk-1', target: 'goal-1', data: { weight: 0.4, direction: 'negative' } },
          { id: 'e1', source: 'f1', target: 'risk-1', data: { exists_probability: 0.9 } },
          { id: 'e2', source: 'f2', target: 'risk-1', data: { exists_probability: 0.85 } },
          { id: 'e3', source: 'f3', target: 'risk-1', data: { exists_probability: 0.8 } },
          { id: 'e4', source: 'f4', target: 'risk-1', data: { exists_probability: 0.75 } },
          { id: 'e5', source: 'f5', target: 'risk-1', data: { exists_probability: 0.7 } },
        ],
        viewMode: 'expert',
      }) as any)
    )
    renderRisk()
    expect(screen.getByText('Risk Factor One')).toBeDefined()
    expect(screen.getByText('Risk Factor Two')).toBeDefined()
    expect(screen.getByText('Risk Factor Three')).toBeDefined()
    expect(screen.queryByText('Risk Factor Four')).toBeNull()
    expect(screen.queryByText('Risk Factor Five')).toBeNull()
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
            { id: 'risk-1', type: 'risk', data: { type: 'risk', label: 'Key person dependency' } },
            { id: 'f1', type: 'factor', data: { type: 'factor', label: 'Unit price' } },
          ],
          edges: [{ id: 'e1', source: 'f1', target: 'risk-1', data: edgeData }],
          viewMode: 'expert',
        }) as any)
      )

    it('POSITIVE CONTROL: DOES render the figure for a strength somebody set', () => {
      preAnalysisStore({ weight: 0.42, direction: 'positive', weightSource: 'cee' })
      renderRisk()
      expect(screen.getByText(/Driven by:/)).toBeDefined()
      expect(screen.getByText('42%')).toBeDefined()
      expect(screen.queryByText(/Not set/)).toBeNull()
    })

    it('renders "Not set", never the USER_EDGE_DEFAULTS weight, for an edge merely drawn', () => {
      preAnalysisStore({ ...USER_EDGE_DEFAULTS })
      renderRisk()
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
            { id: 'risk-1', type: 'risk', data: { type: 'risk' } },
            { id: 'goal-1', data: { type: 'goal' } },
          ],
          edges: [{ id: 'b1', source: 'risk-1', target: 'goal-1', data: edgeData }],
        }) as any)
      )

    it('fixture precondition: the UI defaults are the values NEW-1 printed', () => {
      expect(USER_EDGE_DEFAULTS.weight).toBe(0.3)
      expect(DEFAULT_EDGE_DATA.weight).toBe(0.5)
    })

    it.each([
      ['a person set it', { weight: 0.6, direction: 'negative', weightSource: 'user' }, '60%'],
      ['Olumi estimated it', { weight: 0.6, direction: 'negative', weightSource: 'cee' }, '60%'],
      ['an edge merely drawn (USER_EDGE_DEFAULTS)', { ...USER_EDGE_DEFAULTS }, '30%'],
      ['a bare DEFAULT_EDGE_DATA weight', { ...DEFAULT_EDGE_DATA }, '50%'],
      ['CEE back-compat strength_mean', { strength_mean: 0.45, weight: 0.3 }, '45%'],
    ])('%s: no row, no figure, no noun, no `est.` on the card', (_state, edgeData, figure) => {
      bridgeStore(edgeData as Record<string, unknown>)
      const { container } = renderRisk()
      expect(screen.getByText('Key person dependency')).toBeInTheDocument() // CONTRAST: the card rendered
      expect(screen.queryByTestId('risk-strength-row')).toBeNull()
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
describe('RiskNode — UI-SEM-089 superseded: no bridge figure on the card, so none to relabel', () => {
  const FORBIDDEN = [/contribution/i, /of your goal/i, /goal drag/i, /impact on/i]

  const seedBridge = (weightSource: string) =>
    vi.mocked(useCanvasStore).mockImplementation((selector) =>
      selector(makeStoreState({
        results: { status: 'complete', report: null },
        nodes: [
          { id: 'risk-1', type: 'risk', data: { type: 'risk' } },
          { id: 'goal-1', data: { type: 'goal' } },
        ],
        edges: [{ id: 'b1', source: 'risk-1', target: 'goal-1', data: { weight: 0.85, direction: 'negative', weightSource } }],
      }) as any)
    )

  it.each([['user-stated', 'user'], ['estimated', 'cee']])(
    'the %s branch renders neither the figure nor a computed-output noun',
    (_label, source) => {
      seedBridge(source)
      const { container } = renderRisk()
      const text = container.textContent ?? ''
      expect(screen.getByText('Key person dependency')).toBeInTheDocument() // presence control
      expect(text).not.toContain('85%')
      expect(text).not.toContain(LINK_STRENGTH_COPY.noun)
      for (const banned of FORBIDDEN) {
        expect(text).not.toMatch(banned)
      }
    },
  )
})
