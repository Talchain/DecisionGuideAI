/**
 * switch_probability presence-branching pins — the UI half of the
 * platform-wide fabrication-class close-out (PLoT half: plot-lite-service#294,
 * merged 867c92d1).
 *
 * Contract (vendored @talchain/schemas 0.30.0, EnrichmentRobustnessEdgeSchema):
 * `switch_probability` is OPTIONAL — ABSENT means NOT COMPUTED, and the
 * producer "would rather omit the field than derive one from a substitute".
 * `marginal_switch_probability` is a DIFFERENT Monte Carlo — P(flip | only
 * this edge varies) — not a fallback. A percentage rendered from the marginal
 * quantity under switch-probability wording is a fabricated claim, so
 * consumers must branch on presence, never coalesce.
 *
 * Two chains are pinned:
 *   A. useResultsSectionData `topFragileEdgeData` → confidence.topFragileEdge
 *      → TriageActionCardsBody's T1FlipRiskCallout "(NN% probability)".
 *      Defect at tip: `fe.switch_probability ?? fe.marginal_switch_probability`
 *      renders a percentage for a marginal-only edge.
 *   B. StrengthenContainer fragileEdges mapping → buildRecommendations flip
 *      trigger "NN% chance the result flips…" + the action wire param
 *      literally named `switch_probability`. Defect at tip: the mapping
 *      PREFERRED marginal over a PRESENT measured switch_probability.
 *
 * Controls prove a measured switch_probability — including 0 — still renders,
 * so the absence assertions are not vacuous (trap 13).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { fireEvent, render, renderHook, screen } from '@testing-library/react'
import { useResultsSectionData } from '../useResultsSectionData'
import { TriageActionCardsBody } from '../TriageActionCardsBody'
import { StrengthenContainer } from '../strengthen/StrengthenContainer'
import type { ResultsSectionDataReturn } from '../useResultsSectionData'
import { useCanvasStore } from '../../../canvas/store'
import { useGuidanceStore } from '../../../canvas/stores/guidanceStore'
import { selectActive, useStrengthenStore } from '../../../canvas/stores/strengthenStore'

// ─── Chain A: hook → topFragileEdge → T1FlipRiskCallout ─────────────────────

function seedReportWithFragileEdges(edges: Array<Record<string, unknown>>): void {
  useCanvasStore.setState({
    results: {
      status: 'complete',
      progress: 100,
      report: { robustness: { fragile_edges: edges } },
    } as any,
    runMeta: {} as any,
    nodes: [],
    edges: [],
    hasCompletedFirstRun: true,
    rawV2Response: null,
  } as any)
}

const EDGE_BASE = {
  edge_id: 'price::revenue',
  from_id: 'price',
  to_id: 'revenue',
  from_label: 'Price',
  to_label: 'Revenue',
  alternative_winner_id: 'opt_b',
  alternative_winner_label: 'Plan B',
}

describe('chain A — topFragileEdge presence-branches on switch_probability (schemas 0.30.0)', () => {
  beforeEach(() => {
    useCanvasStore.setState({
      results: null,
      rawV2Response: null,
      nodes: [],
      edges: [],
      hasCompletedFirstRun: false,
      draftCoaching: null,
    } as any)
  })

  it('PIN: a marginal-only fragile edge yields NO switchProbability (absent = not computed, never the marginal value)', () => {
    seedReportWithFragileEdges([{ ...EDGE_BASE, marginal_switch_probability: 0.35 }])
    const { result } = renderHook(() => useResultsSectionData())
    const tfe = result.current.confidence.topFragileEdge
    // The edge itself still surfaces (labels are real) — only the number is absent.
    expect(tfe).toBeDefined()
    expect(tfe!.fromLabel).toBe('Price')
    expect(tfe!.switchProbability).toBeUndefined()
  })

  it('CONTROL: a measured switch_probability passes through verbatim, never displaced by marginal', () => {
    seedReportWithFragileEdges([
      { ...EDGE_BASE, switch_probability: 0.42, marginal_switch_probability: 0.99 },
    ])
    const { result } = renderHook(() => useResultsSectionData())
    expect(result.current.confidence.topFragileEdge!.switchProbability).toBe(0.42)
  })

  it('CONTROL: a measured switch_probability of 0 survives (0 is a measurement, not absence)', () => {
    seedReportWithFragileEdges([
      { ...EDGE_BASE, switch_probability: 0, marginal_switch_probability: 0.8 },
    ])
    const { result } = renderHook(() => useResultsSectionData())
    expect(result.current.confidence.topFragileEdge!.switchProbability).toBe(0)
  })

  it('PIN (render): a marginal-only edge renders the flip-risk callout WITHOUT a percentage', () => {
    seedReportWithFragileEdges([{ ...EDGE_BASE, marginal_switch_probability: 0.35 }])
    const { result } = renderHook(() => useResultsSectionData())
    render(<TriageActionCardsBody data={result.current} />)
    const callout = screen.getByTestId('t1-flip-risk-callout')
    // Honest absent state: "If Price shifts, Plan B could overtake." — no number.
    expect(callout.textContent).toContain('could overtake')
    expect(callout.textContent).not.toMatch(/%\s*probability/)
  })

  it('CONTROL (render): a measured switch_probability still renders its percentage', () => {
    seedReportWithFragileEdges([
      { ...EDGE_BASE, switch_probability: 0.42, marginal_switch_probability: 0.99 },
    ])
    const { result } = renderHook(() => useResultsSectionData())
    render(<TriageActionCardsBody data={result.current} />)
    expect(screen.getByTestId('t1-flip-risk-callout').textContent).toMatch(/42% probability/)
  })
})

// ─── Chain B: StrengthenContainer → buildRecommendations flip trigger ───────

const makeStrengthenData = (challengeFragileEdges: unknown[]): ResultsSectionDataReturn =>
  ({
    recommendation: { goalThreshold: null, analysisStatus: 'computed' },
    confidence: { challengeFragileEdges, robustnessStatus: null, robustnessLevel: null },
    drivers: { drivers: [] },
  }) as unknown as ResultsSectionDataReturn

const findFlipRec = () =>
  selectActive(useStrengthenStore.getState()).find((r) => r.id.startsWith('strengthen:flip:'))

describe('chain B — Strengthen flip trigger presence-branches on switch_probability (schemas 0.30.0)', () => {
  beforeEach(() => {
    useStrengthenStore.getState()._reset()
    try { sessionStorage.clear() } catch { /* jsdom */ }
    useGuidanceStore.setState({ guidanceItems: [], _dispatchAction: null, _sendMessage: null } as never)
    useCanvasStore.setState({
      currentStage: null,
      draftCoaching: null,
      results: { ...useCanvasStore.getState().results, hash: 'h-switch-prob' },
    } as never)
  })

  it('PIN: the rendered flip percentage is the MEASURED switch_probability, never the marginal quantity', () => {
    render(
      <StrengthenContainer
        data={makeStrengthenData([
          {
            edge_id: 'e1',
            from_label: 'Price',
            to_label: 'Revenue',
            switch_probability: 0.2,
            marginal_switch_probability: 0.6,
            alternative_winner_label: 'Plan B',
          },
        ])}
      />,
    )
    const flip = findFlipRec()
    expect(flip).toBeDefined()
    expect(flip!.snapshot.signal).toContain('20% chance the result flips to Plan B')
    expect(flip!.snapshot.signal).not.toContain('60%')
    // The wire param named switch_probability must carry the measured value.
    expect((flip!.snapshot.action as any).parameters.switch_probability).toBe(0.2)
    // And the DOM shows the honest number (the flip rec can sit behind the
    // panel's "Show N more" fold — expand before asserting).
    const showMore = screen.queryByText(/Show \d+ more/)
    if (showMore) fireEvent.click(showMore)
    expect(screen.getByText(/20% chance the result flips to Plan B/)).toBeTruthy()
  })

  it('PIN: an edge WITHOUT a measured switch_probability produces NO flip recommendation (absence renders nothing)', () => {
    render(
      <StrengthenContainer
        data={makeStrengthenData([
          {
            edge_id: 'e1',
            from_label: 'Price',
            to_label: 'Revenue',
            marginal_switch_probability: 0.6,
            alternative_winner_label: 'Plan B',
          },
        ])}
      />,
    )
    expect(findFlipRec()).toBeUndefined()
  })

  it('CONTROL: a measured switch_probability alone still produces the flip rec with its percentage', () => {
    render(
      <StrengthenContainer
        data={makeStrengthenData([
          {
            edge_id: 'e1',
            from_label: 'Price',
            to_label: 'Revenue',
            switch_probability: 0.45,
            alternative_winner_label: 'Plan B',
          },
        ])}
      />,
    )
    const flip = findFlipRec()
    expect(flip).toBeDefined()
    expect(flip!.snapshot.signal).toContain('45% chance the result flips to Plan B')
  })

  it('CONTROL: a measured switch_probability of 0 still renders (0% is a measurement, not absence)', () => {
    render(
      <StrengthenContainer
        data={makeStrengthenData([
          {
            edge_id: 'e1',
            from_label: 'Price',
            to_label: 'Revenue',
            switch_probability: 0,
            alternative_winner_label: 'Plan B',
          },
        ])}
      />,
    )
    const flip = findFlipRec()
    expect(flip).toBeDefined()
    expect(flip!.snapshot.signal).toContain('0% chance the result flips to Plan B')
  })
})
