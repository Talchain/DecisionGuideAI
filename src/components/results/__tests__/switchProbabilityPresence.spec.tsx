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

/**
 * PRECONDITION FOR THE TWO RENDER PINS BELOW: a run that MAY name a leader.
 *
 * ⚠ WHY THIS EXISTS, stated so the next editor does not delete it as noise.
 * The callout's comparative sentence ("Plan B could overtake (42% probability)")
 * is now gated on the shared claim policy (`analysisClaimPolicy`), because a
 * witnessed staging run rendered it a few lines above the same panel's
 * "Leading option not assessed".
 *
 * `seedReportWithFragileEdges` seeds `nodes: []`, so the hook derives
 * `separation: 'unknown'` / `hasLeadingOption: false` — a genuinely WITHHELD
 * run, on which the callout correctly says "If Price shifts, the result could
 * change." and prints no percentage. Correct product behaviour, and it would
 * make chain A's two render assertions unable to observe the thing they exist
 * for: whether a MEASURED `switch_probability` reaches the DOM and a
 * MARGINAL-only one does not.
 *
 * So the leader gate is pinned OPEN here, and only here. This is a state a
 * real run produces (two separated options plus a fragile edge); it is simply
 * not the state this seed helper builds. The percentage question and the
 * leader question are different questions, and this keeps chain A pointed at
 * its own one. Each render pin asserts the precondition held before asserting
 * its result, so a future change to the gate REDs as a precondition failure
 * rather than silently hollowing the pin out.
 */
function permitLeaderClaim(data: ResultsSectionDataReturn): ResultsSectionDataReturn {
  // Assigned through the DECLARED types, with no cast: both fields are real
  // members of `DecisionResultData`, so the compiler checks this fixture is a
  // shape the product can actually hold. A `Record<string, unknown>` cast here
  // would have typed the check away.
  data.recommendation.leaderDesignationPermitted = true
  data.recommendation.verdict = {
    leaderId: 'opt_a', separation: 'clear', hasLeadingOption: true, gapPp: 40,
    source: 'producer_band',
  }
  return data
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
    render(<TriageActionCardsBody data={permitLeaderClaim(result.current)} />)
    const callout = screen.getByTestId('t1-flip-risk-callout')
    // PRECONDITION: the leader gate is open, so an absent percentage is the
    // switch_probability branch and not the claim-policy branch.
    expect(callout.textContent, 'leader gate closed — this pin would be vacuous')
      .toContain('could overtake')
    // Honest absent state: "If Price shifts, Plan B could overtake." — no number.
    expect(callout.textContent).not.toMatch(/%\s*probability/)
  })

  it('CONTROL (render): a measured switch_probability still renders its percentage', () => {
    seedReportWithFragileEdges([
      { ...EDGE_BASE, switch_probability: 0.42, marginal_switch_probability: 0.99 },
    ])
    const { result } = renderHook(() => useResultsSectionData())
    render(<TriageActionCardsBody data={permitLeaderClaim(result.current)} />)
    const callout = screen.getByTestId('t1-flip-risk-callout')
    expect(callout.textContent, 'leader gate closed — this control would be vacuous')
      .toContain('could overtake')
    expect(callout.textContent).toMatch(/42% probability/)
  })

  /**
   * ⭐ THE OTHER DIRECTION, added with the claim-policy gate so chain A cannot
   * be read as evidence that the percentage is unconditional. A WITHHELD run
   * suppresses the comparative sentence AND its number even when
   * `switch_probability` is measured — `switch_probability` means P(the
   * alternative OVERTAKES), so it is a ranking claim expressed as a number.
   * Full coverage of that gate lives in
   * `analysisClaimPolicy.leaderContradiction.spec.tsx`; this arm exists so a
   * change here cannot pass chain A while breaking it.
   */
  it('WITHHELD RUN: the measured percentage goes with the comparative verb', () => {
    seedReportWithFragileEdges([{ ...EDGE_BASE, switch_probability: 0.42 }])
    const { result } = renderHook(() => useResultsSectionData())
    // No `permitLeaderClaim` — the seed's own `nodes: []` yields a withheld run.
    expect(result.current.recommendation.verdict?.hasLeadingOption).toBe(false)
    render(<TriageActionCardsBody data={result.current} />)
    const callout = screen.getByTestId('t1-flip-risk-callout')
    expect(callout.textContent).not.toContain('could overtake')
    expect(callout.textContent).not.toMatch(/42% probability/)
    // …and the finding itself survives.
    expect(callout.textContent).toContain('Price')
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

// ─── fragileEdgesMap → driver fragileEdgeInfo (hero switchMeta producer) ────
//
// Adv-review #543 F1: the map's marginal fallback fed buildHeroModel's
// switchProbByNodeId, so a marginal-only fragile edge rendered a
// marginal-derived "NN% switch" + MagnitudeBar on the staging-ON analysis
// hero. buildHeroModel is already presence-guarded — the defect is the map.
// The hook→buildHeroModel integration pins live in
// analysis-hero/__tests__/switchMetaPresence.spec.tsx (module-internal —
// the hero inertness guard forbids hero imports from THIS file).

function seedReportForHero(fragileEdges: Array<Record<string, unknown>>): void {
  useCanvasStore.setState({
    results: {
      status: 'complete',
      progress: 100,
      report: {
        run: { critique: [] },
        robustness: {
          fragile_edges: fragileEdges,
          flip_thresholds: [
            { node_id: 'fac_a', label: 'Factor A', current_value: 40, flip_value: 30, unit: '%' },
          ],
        },
        option_comparison: [],
        option_probabilities: {
          opt_a: {
            goal_probability: 0.6,
            expected: 0.5,
            outcome: { mean: 0.5, p10: 0.2, p90: 0.8 },
          },
        },
        factor_sensitivity: [{ factor_id: 'fac_a', label: 'Factor A', sensitivity_score: 0.5 }],
      },
    } as never,
    runMeta: {} as never,
    nodes: [
      { id: 'opt_a', data: { kind: 'option', label: 'Plan A' }, position: { x: 0, y: 0 } },
    ] as never,
    edges: [],
    hasCompletedFirstRun: true,
    rawV2Response: null,
  } as never)
}

describe('fragileEdgesMap presence-branches on switch_probability (hero switchMeta feed)', () => {
  beforeEach(() => {
    useCanvasStore.setState({
      results: null,
      rawV2Response: null,
      nodes: [],
      edges: [],
      hasCompletedFirstRun: false,
      draftCoaching: null,
    } as never)
  })

  it('PIN: a marginal-only fragile edge yields NO fragileEdgeInfo.switchProbability on the driver', () => {
    seedReportForHero([
      { edge_id: 'a::b', from_id: 'fac_a', to_id: 'out_b', marginal_switch_probability: 0.6, alternative_winner_label: 'Plan B' },
    ])
    const { result } = renderHook(() => useResultsSectionData())
    const driver = result.current.drivers.drivers.find((d) => d.factorKey === 'fac_a')
    expect(driver).toBeDefined()
    // The join itself survives (the label is real data) — only the number is absent.
    expect(driver!.fragileEdgeInfo?.alternativeWinnerLabel).toBe('Plan B')
    expect(driver!.fragileEdgeInfo?.switchProbability).toBeUndefined()
  })

  it('CONTROL: a measured switch_probability passes through the map verbatim, never displaced by marginal', () => {
    seedReportForHero([
      {
        edge_id: 'a::b',
        from_id: 'fac_a',
        to_id: 'out_b',
        switch_probability: 0.48,
        marginal_switch_probability: 0.99,
        alternative_winner_label: 'Plan B',
      },
    ])
    const { result } = renderHook(() => useResultsSectionData())
    const driver = result.current.drivers.drivers.find((d) => d.factorKey === 'fac_a')
    expect(driver!.fragileEdgeInfo?.switchProbability).toBe(0.48)
  })

  it('CONTROL: a measured 0 survives the map (0 is a measurement, not absence)', () => {
    seedReportForHero([
      {
        edge_id: 'a::b',
        from_id: 'fac_a',
        to_id: 'out_b',
        switch_probability: 0,
        marginal_switch_probability: 0.8,
        alternative_winner_label: 'Plan B',
      },
    ])
    const { result } = renderHook(() => useResultsSectionData())
    const driver = result.current.drivers.drivers.find((d) => d.factorKey === 'fac_a')
    expect(driver!.fragileEdgeInfo?.switchProbability).toBe(0)
  })
})

// ─── SENSITIVE_ASSUMPTION severity — producer verdict only ──────────────────
//
// Contract (schemas 0.30.0, EnrichmentRobustnessEdgeSchema.severity): severity
// is "ABSENT when switch_probability is absent — a severity derived from a
// substituted probability is a fabricated verdict, so the producer omits both
// together". The expired pre-B1 deprecation fallback (classifySeverityLegacy
// over `switch ?? marginal`, window ended 2026-05-12) fabricated that verdict
// locally and rendered it as ConfidenceSection's "Critical assumption" label.

const findSensitiveAssumption = (data: ResultsSectionDataReturn) =>
  data.confidence.uncertainties.find((u) => u.code === 'SENSITIVE_ASSUMPTION')

describe('SENSITIVE_ASSUMPTION severity — absence propagates (schemas 0.30.0)', () => {
  beforeEach(() => {
    useCanvasStore.setState({
      results: null,
      rawV2Response: null,
      nodes: [],
      edges: [],
      hasCompletedFirstRun: false,
      draftCoaching: null,
    } as never)
  })

  it('PIN: a marginal-only edge without producer severity carries NO severity (never classified from the marginal)', () => {
    seedReportWithFragileEdges([{ ...EDGE_BASE, marginal_switch_probability: 0.8 }])
    const { result } = renderHook(() => useResultsSectionData())
    const item = findSensitiveAssumption(result.current)
    expect(item).toBeDefined()
    expect(item!.severity).toBeUndefined()
  })

  it('PIN: a measured edge without producer severity carries NO severity (no local reclassification either)', () => {
    seedReportWithFragileEdges([{ ...EDGE_BASE, switch_probability: 0.8 }])
    const { result } = renderHook(() => useResultsSectionData())
    expect(findSensitiveAssumption(result.current)!.severity).toBeUndefined()
  })

  it('CONTROL: a producer-classified severity is carried verbatim', () => {
    seedReportWithFragileEdges([
      { ...EDGE_BASE, switch_probability: 0.8, severity: 'critical' },
    ])
    const { result } = renderHook(() => useResultsSectionData())
    expect(findSensitiveAssumption(result.current)!.severity).toBe('critical')
  })

  // ⚠ The two RENDER arms of this group ("Critical assumption" label present /
  // absent in ConfidenceSection) were deleted on 18 Aug 2026 with the component
  // itself, which had zero importers outside the test tree. The three data-level
  // PIN/CONTROL cases above are the substantive claim and are untouched: they
  // assert the severity never gets fabricated from a marginal in the first place,
  // one seam UPSTREAM of any render. No live surface renders this label today; if
  // one is built, add its render arm here.
})

// ─── topFragileEdge SELECTION — presence-first ranking ──────────────────────
//
// Adv-review #543 F2, adjudicated: the contract requires consumers to "omit
// any value derived from it (severity, visible, ranking position) rather than
// derive one from a substitute" — so the top-edge SELECTION sorts measured
// switch_probability desc with unmeasured edges LAST (producer order
// preserved), the same comparator plot-lite-service#294 shipped. Previously
// an edge could be PICKED as most-fragile by the marginal quantity that #543
// made every surface refuse to display.

const EDGE_TWO = {
  edge_id: 'demand::margin',
  from_id: 'demand',
  to_id: 'margin',
  from_label: 'Demand',
  to_label: 'Margin',
  alternative_winner_id: 'opt_c',
  alternative_winner_label: 'Plan C',
}

describe('topFragileEdge selection — measured presence-first (schemas 0.30.0 ranking doctrine)', () => {
  beforeEach(() => {
    useCanvasStore.setState({
      results: null,
      rawV2Response: null,
      nodes: [],
      edges: [],
      hasCompletedFirstRun: false,
      draftCoaching: null,
    } as never)
  })

  it('PIN: a measured edge outranks a marginal-only edge with a larger marginal', () => {
    seedReportWithFragileEdges([
      { ...EDGE_BASE, marginal_switch_probability: 0.9 },
      { ...EDGE_TWO, switch_probability: 0.4 },
    ])
    const { result } = renderHook(() => useResultsSectionData())
    const tfe = result.current.confidence.topFragileEdge
    expect(tfe!.fromLabel).toBe('Demand')
    expect(tfe!.switchProbability).toBe(0.4)
  })

  it('PIN: with no measured edge, producer order is preserved (no rank derived from the marginal)', () => {
    seedReportWithFragileEdges([
      { ...EDGE_BASE, marginal_switch_probability: 0.2 },
      { ...EDGE_TWO, marginal_switch_probability: 0.9 },
    ])
    const { result } = renderHook(() => useResultsSectionData())
    const tfe = result.current.confidence.topFragileEdge
    expect(tfe!.fromLabel).toBe('Price')
    expect(tfe!.switchProbability).toBeUndefined()
  })

  it('PIN: a measured 0 outranks an unmeasured edge (a measurement beats no measurement, never vice versa)', () => {
    seedReportWithFragileEdges([
      { ...EDGE_TWO, marginal_switch_probability: 0.9 },
      { ...EDGE_BASE, switch_probability: 0 },
    ])
    const { result } = renderHook(() => useResultsSectionData())
    const tfe = result.current.confidence.topFragileEdge
    expect(tfe!.fromLabel).toBe('Price')
    expect(tfe!.switchProbability).toBe(0)
  })

  it('CONTROL: among measured edges the highest measured value still wins', () => {
    seedReportWithFragileEdges([
      { ...EDGE_BASE, switch_probability: 0.4 },
      { ...EDGE_TWO, switch_probability: 0.7 },
    ])
    const { result } = renderHook(() => useResultsSectionData())
    const tfe = result.current.confidence.topFragileEdge
    expect(tfe!.fromLabel).toBe('Demand')
    expect(tfe!.switchProbability).toBe(0.7)
  })
})
