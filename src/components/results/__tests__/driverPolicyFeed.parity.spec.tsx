/**
 * C4 fix 2 — cross-surface basis parity (adversarial review, both findings
 * verifier-reproduced against the real store).
 *
 * The Drivers panel (useResultsSectionData) and the canvas hook
 * (useNodeDisplayMetadata) disclosed CONTRADICTORY bases for the SAME report:
 * the panel fed selectDriverDisplayModel its five-source merge (which KEEPS
 * metric-less rows → coverage incomplete → set-relative fallback), while the
 * hook fed it a private factor_sensitivity-only feed filtered through
 * extractPolicyRow (drops no-finite-metric rows → coverage complete →
 * absolute producer scale). Result: the canvas pill said "absolute" while the
 * panel said "relative, top always 100%".
 *
 * Fix under test (build-brief §12.4 single-selector doctrine): ONE shared row
 * feed — selectDriverPolicyFeed, the panel's merge extracted into a pure
 * per-report-memoised function — consumed by BOTH surfaces. These specs drive
 * the REAL canvas store and both REAL hooks, then assert basis AND value
 * agree, for the exact review fixture and for a drivers_payload-only report.
 *
 * Also pinned here (fix 1 integration truth): the degenerate wire fixture
 * flows through the real data layer into DriversSection and renders NO
 * relative-scale caption.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { render, screen } from '@testing-library/react'
import { useResultsSectionData, selectDriverPolicyFeed } from '../useResultsSectionData'
import { useNodeDisplayMetadata } from '../../../canvas/hooks/useNodeDisplayMetadata'
import { useCanvasStore } from '../../../canvas/store'
import { DriversSection } from '../DriversSection'
import type { ResultsReport } from '../types'

function setCompleteReport(report: Record<string, unknown>): void {
  act(() => {
    useCanvasStore.setState({
      results: { status: 'complete', progress: 100, report } as never,
      runMeta: {} as never,
      nodes: [] as never,
      edges: [] as never,
      hasCompletedFirstRun: true,
      rawV2Response: null,
    } as never)
  })
}

const baseReport = (overrides: Record<string, unknown>): Record<string, unknown> => ({
  schema: 'report.v1',
  meta: { seed: 1, elapsed_ms: 100 },
  drivers_status: 'computed',
  ...overrides,
})

beforeEach(() => {
  act(() => {
    useCanvasStore.setState({
      results: { status: 'idle' } as never,
      runMeta: {} as never,
      nodes: [] as never,
      edges: [] as never,
      hasCompletedFirstRun: false,
      rawV2Response: null,
    } as never)
  })
})

describe('C4 fix 2 — panel and canvas resolve the SAME basis and value from one feed', () => {
  it('review fixture (A with influence_score + metric-less B): both surfaces say relative, A = 1.0', () => {
    setCompleteReport(baseReport({
      factor_sensitivity: [
        { factor_id: 'A', influence_score: 0.6, elasticity: 0.5 },
        { factor_id: 'B', confidence: 0.7 },
      ],
    }))

    const panel = renderHook(() => useResultsSectionData())
    const rowA = panel.result.current.drivers.drivers.find(d => d.factorKey === 'A')
    expect(rowA?.displayProvenance).toBe('normalised_elasticity')
    expect(rowA?.displayInfluence).toBe(1)

    const canvas = renderHook(() => useNodeDisplayMetadata('A', 'factor'))
    expect(canvas.result.current.influenceProvenance).toBe(rowA?.displayProvenance)
    expect(canvas.result.current.influence).toBe(rowA?.displayInfluence)
  })

  it('drivers_payload-only report: both surfaces agree on the verdict for the same row', () => {
    setCompleteReport(baseReport({
      drivers_payload: {
        drivers: [
          { node_id: 'X', elasticity: 0.7 },
          { node_id: 'Y', elasticity: 0.35 },
        ],
      },
    }))

    const panel = renderHook(() => useResultsSectionData())
    const rowX = panel.result.current.drivers.drivers.find(d => d.factorKey === 'X')
    expect(rowX?.displayProvenance).toBe('normalised_elasticity')
    expect(rowX?.displayInfluence).toBe(1)

    const canvas = renderHook(() => useNodeDisplayMetadata('X', 'factor'))
    expect(canvas.result.current.influenceProvenance).toBe(rowX?.displayProvenance)
    expect(canvas.result.current.influence).toBe(rowX?.displayInfluence)
    expect(canvas.result.current.sensitivityRank).toBe(1)
  })

  it('full producer coverage: both surfaces say absolute with the producer value', () => {
    setCompleteReport(baseReport({
      factor_sensitivity: [
        { factor_id: 'A', influence_score: 0.6, elasticity: 0.5 },
        { factor_id: 'B', influence_score: 0.3, elasticity: 0.2, confidence: 0.7 },
      ],
    }))

    const panel = renderHook(() => useResultsSectionData())
    const rowA = panel.result.current.drivers.drivers.find(d => d.factorKey === 'A')
    expect(rowA?.displayProvenance).toBe('influence_score')
    expect(rowA?.displayInfluence).toBeCloseTo(0.6)

    const canvas = renderHook(() => useNodeDisplayMetadata('A', 'factor'))
    expect(canvas.result.current.influenceProvenance).toBe('influence_score')
    expect(canvas.result.current.influence).toBeCloseTo(0.6)
  })
})

/**
 * C4 re-review fold — cross-surface ORDER parity.
 *
 * The specs above pin the disclosed BASIS and the VALUE, and that is exactly
 * why they missed a regression this fold introduced: two surfaces can agree
 * that a driver shows 44% on a set-relative scale and still ROW-ORDER it
 * differently. The shared feed handed the canvas a SIGNED magnitude, while
 * the panel abs'd its own before ranking; the canvas tie-break sorts on the
 * raw number, so a positive driver outranked an equal-magnitude negative one
 * on the canvas and lost to it in the panel. Same feed, same number, opposite
 * order — the fork this fold exists to close, reopened one layer down.
 *
 * These pins assert the two surfaces produce the SAME ORDER, not merely the
 * same value. Both fixtures are chosen so LABEL-alphabetical and
 * KEY-alphabetical agree, keeping them blind to the known (pre-existing,
 * out-of-scope) label-vs-key final tie-break divergence — they fail for the
 * sign reason alone.
 */
describe('C4 re-review — panel and canvas resolve the SAME ORDER, not just the same value', () => {
  it('set-relative basis: an equal-magnitude negative driver ranks the same on both surfaces', () => {
    setCompleteReport(baseReport({
      factor_sensitivity: [
        { node_id: 'n_down', label: 'Attrition risk', elasticity: -0.4 },
        { node_id: 'n_up', label: 'Zeta uplift', elasticity: 0.4 },
        { node_id: 'n_big', label: 'Market size', elasticity: 0.9 },
      ],
    }))

    const panel = renderHook(() => useResultsSectionData())
    const rowsByKey = new Map(panel.result.current.drivers.drivers.map(d => [d.factorKey, d]))

    // Precondition: the surfaces agree on basis and value — so ORDER is the
    // only thing these assertions can be catching.
    expect(rowsByKey.get('n_down')?.displayProvenance).toBe('normalised_elasticity')
    expect(rowsByKey.get('n_down')?.displayInfluence).toBeCloseTo(4 / 9)
    expect(rowsByKey.get('n_up')?.displayInfluence).toBeCloseTo(4 / 9)

    // VALUE parity is unconditional — both surfaces read one display model.
    for (const key of ['n_big', 'n_down', 'n_up']) {
      const canvas = renderHook(() => useNodeDisplayMetadata(key, 'factor'))
      expect(canvas.result.current.influence).toBeCloseTo(rowsByKey.get(key)!.displayInfluence!)
    }

    // The panel's own list ORDER is unchanged: a list must be in some order,
    // and the sign of the magnitude still does not enter it on either surface.
    expect(rowsByKey.get('n_big')?.rank).toBe(1)
    expect(rowsByKey.get('n_down')?.rank).toBe(2)
    expect(rowsByKey.get('n_up')?.rank).toBe(3)

    // ⚠⚠ RANK PARITY IS NOT VALUE PARITY, AND THIS CASE USED TO ASSERT IT
    // (corrected 2026-09-03). `n_down` and `n_up` are TIED at 4/9; the panel's
    // `rank` separates them only via `compareByDisplayModel`'s fall-through to
    // `key.localeCompare` — ALPHABETICAL. This spec previously required the
    // canvas badge to reproduce those ordinals, so it pinned the defect as
    // correct: the badge is titled "ranked by influence on the outcome", and
    // #2/#3 here are not. Note the test immediately below ALREADY forbids
    // exactly this for a tie at the TOP — the gap was that the leader gate was
    // tightened and the #2/#3 gate never was.
    //
    // ORDERING A LIST AND ASSERTING A RANK ARE TWO DIFFERENT QUESTIONS (trap
    // 21). The panel keeps a total order because it must render rows in some
    // sequence; the canvas makes an explicit comparative CLAIM, so it may only
    // make the ones the numbers determine.
    const bigCanvas = renderHook(() => useNodeDisplayMetadata('n_big', 'factor'))
    expect(bigCanvas.result.current.sensitivityRank).toBe(1)
    for (const tiedKey of ['n_down', 'n_up']) {
      const canvas = renderHook(() => useNodeDisplayMetadata(tiedKey, 'factor'))
      expect(canvas.result.current.sensitivityRank).toBeNull()
      // PRECONDITION: the tied row IS in the analysis and keeps its number, so
      // the null above is the gate firing and not an absent row.
      expect(canvas.result.current.inSensitivityAnalysis).toBe(true)
      expect(canvas.result.current.influence).toBeCloseTo(4 / 9)
    }
  })

  it('producer basis: an exact tie yields no rendered ordinal, and the values still agree across surfaces', () => {
    setCompleteReport(baseReport({
      factor_sensitivity: [
        { node_id: 'a_pos', label: 'Alpha uplift', influence_score: 0.5, elasticity: 0.3 },
        { node_id: 'b_neg', label: 'Beta drag', influence_score: 0.5, elasticity: -0.9 },
      ],
    }))

    const panel = renderHook(() => useResultsSectionData())
    const rowsByKey = new Map(panel.result.current.drivers.drivers.map(d => [d.factorKey, d]))

    // Both rows carry a producer score, and the SAME one — so the ORDER is
    // decided purely by the elasticity tie-break.
    expect(rowsByKey.get('a_pos')?.displayProvenance).toBe('influence_score')
    expect(rowsByKey.get('a_pos')?.displayInfluence).toBeCloseTo(0.5)
    expect(rowsByKey.get('b_neg')?.displayInfluence).toBeCloseTo(0.5)

    // ⚠⚠ THIS FIXTURE IS AN EXACT TIE, AND THE ASSERTION BELOW CHANGED ON
    // 2026-08-30. It used to read
    //     expect(canvas.result.current.sensitivityRank).toBe(rowsByKey.get(key)!.rank)
    // — i.e. it pinned the canvas badge printing "#1" and "#2" for two factors
    // the producer scored IDENTICALLY, with the order coming from the hidden
    // elasticity tie-break. That is the defect #964 exists to remove: an
    // ordinal is a COMPARATIVE claim and a tie cannot support one.
    //
    // ⚠ ORDERING ROWS AND ASSERTING A RANK ARE DIFFERENT QUESTIONS (trap 21),
    // which is why the two surfaces legitimately answer differently here and
    // this is NOT a re-opened fork. The panel's `rank` is an internal SORT KEY
    // — its only non-test reader is `useResultsSectionData.ts:2698`
    // (`.sort((a, b) => a.rank - b.rank)`) — and rows must come out in *some*
    // deterministic order, so the tie-break is a correct use there. The canvas
    // value is RENDERED to the user as "#N" (`NodeInspector`, `BaseNode`'s
    // "Key driver #N", `EdgeInspector`'s "ranked #N in influence"), and there
    // the tie-break would be a claim the data cannot support. The panel prints
    // no ordinal at all; its user-visible tie signal is the "These factors have
    // similar influence" note, which already fires on this fixture.
    for (const key of ['a_pos', 'b_neg']) {
      const canvas = renderHook(() => useNodeDisplayMetadata(key, 'factor'))
      expect(canvas.result.current.sensitivityRank).toBeNull()
      // …and the parity this spec exists to protect is UNCHANGED: the two
      // surfaces still resolve the same VALUE on the same BASIS.
      expect(canvas.result.current.influence).toBeCloseTo(rowsByKey.get(key)!.displayInfluence!)
    }

    // The larger MAGNITUDE still wins the tie in the panel's row ORDER,
    // negative or not — that behaviour is untouched.
    expect(rowsByKey.get('b_neg')?.rank).toBe(1)
    expect(rowsByKey.get('a_pos')?.rank).toBe(2)
  })

  it('feed contract: policyRows carry an unsigned magnitude, as the field documents', () => {
    const report = baseReport({
      factor_sensitivity: [
        { node_id: 'n_down', elasticity: -0.4 },
        { node_id: 'n_up', elasticity: 0.4 },
      ],
    }) as unknown as ResultsReport
    const feed = selectDriverPolicyFeed(report)
    // Pinned at the PRODUCER: the one consumer that ranks on this field sorts
    // it raw, so a signed value here is an ordering fork waiting to happen.
    expect(feed.policyRows.map(r => r.rawElasticity)).toEqual([0.4, 0.4])
  })
})

describe('selectDriverPolicyFeed — feed contract', () => {
  it('is memoised per report object (same identity for repeated reads)', () => {
    const report = baseReport({
      factor_sensitivity: [{ factor_id: 'A', elasticity: 0.5 }],
    }) as ResultsReport
    const first = selectDriverPolicyFeed(report)
    const second = selectDriverPolicyFeed(report)
    expect(second).toBe(first)
    expect(first.policyRows).toHaveLength(1)
  })

  it('keeps metric-less rows (the coverage-verdict input the old private feed dropped)', () => {
    const report = baseReport({
      factor_sensitivity: [
        { factor_id: 'A', influence_score: 0.6, elasticity: 0.5 },
        { factor_id: 'B', confidence: 0.7 },
      ],
    }) as ResultsReport
    const feed = selectDriverPolicyFeed(report)
    expect(feed.policyRows.map(r => r.key)).toEqual(['A', 'B'])
    expect(feed.displayModel.get('A')?.provenance).toBe('normalised_elasticity')
    expect(feed.displayModel.get('A')?.value).toBe(1)
    expect(feed.displayModel.get('B')?.value).toBe(0)
  })

  it('returns an empty feed for a missing report', () => {
    expect(selectDriverPolicyFeed(null).policyRows).toHaveLength(0)
    expect(selectDriverPolicyFeed(undefined).rawFactors).toHaveLength(0)
  })
})

describe('C4 fix 1 integration truth — degenerate wire fixture through the real data layer', () => {
  it('renders no relative-scale caption when the real data layer collapses every value to 0', () => {
    setCompleteReport(baseReport({
      factor_sensitivity: [
        { factor_id: 'A', elasticity: 0.0005, influence_score: 0.4 },
        { factor_id: 'B', elasticity: 0.0002 },
        { factor_id: 'C', elasticity: 0.0001 },
      ],
    }))

    const panel = renderHook(() => useResultsSectionData())
    const data = panel.result.current.drivers
    expect(data.hasMagnitudeData).toBe(false)
    expect(data.drivers.every(d => d.displayInfluence === 0)).toBe(true)

    render(<DriversSection data={data} goalLabel="test" />)
    expect(screen.queryByTestId('influence-scale-caption')).toBeNull()
    expect(screen.queryByText(/always shows 100%/)).toBeNull()
  })
})
