/**
 * ⭐ A GATED FACTOR IS COVERED-WITHHELD, NOT MISSING (AIQ ruling #72
 * 5881953818, "(2) UI"; ISL #213).
 *
 * ISL withholds a factor's `influence_score` (null, and `influence_rank` null)
 * when EVERY path from it to the goal runs through a product with another input
 * at 0 today, and says so with `gated_by: string[]`. ISL's own words: "The
 * influence depends on the option chosen (STRUCTURAL_INFLUENCE_GATED); a
 * consumer shows that, never 0 and never a rank."
 *
 * THE DEFECT: `selectDriverDisplayModel` adopts the producer score only when
 * EVERY row carries one, so a single gated row dropped the WHOLE set onto the
 * elasticity fallback, and the gated factor itself was shown as a 0 (hidden
 * as "minimal impact" on the panel, badged "Driver 3 of 3" on the card).
 *
 * WHAT IS PINNED, through the real hooks, the real panel and the real mapper:
 *   (a) the scored rows use normalised elasticity and rank 1..n among themselves;
 *   (b) the gated row reads "Depends on the option chosen": no figure, no bar,
 *       no rank, no tier pill, and it is not counted as "minimal impact";
 *   (c) the canvas driver badge gives it no rank, no figure, and M excludes it;
 *   (d) CONTRAST: a null score with NO `gated_by` (a truncated walk) keeps
 *       today's fallback exactly;
 *   (e) CONTRAST: `gated_by: []`, a non-array, a non-string member, or a
 *       finite score beside `gated_by` is not gated;
 *   (f) the live V5 carrier: `enrichment.factor_sensitivity[].gated_by`
 *       survives `mapV5AnalysisToReport` into the shared feed (served block,
 *       one row SHAPED to ISL #213's gated form, since #213 is not served yet).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { useResultsSectionData } from '../useResultsSectionData'
import { useNodeDisplayMetadata } from '../../../canvas/hooks/useNodeDisplayMetadata'
import { useCanvasStore } from '../../../canvas/store'
import { DriversSection } from '../DriversSection'
import { extractPolicyRow, selectDriverDisplayModel } from '../driverDisplayModel'
import { mapV5AnalysisToReport } from '../../../v5/mapV5AnalysisToReport'
import servedC from '../../../canvas/nodes/__tests__/fixtures/served-pj-c-213830Z.unvalued-drivers.json'
import plot408Zero from './fixtures/plot408-gated-egress-ZERO.json'
import { INFLUENCE_STRUCTURAL_BASIS_NOTE } from '../influenceScaleCopy'

const GATED_WORDS = 'Depends on the option chosen'

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

const baseReport = (factor_sensitivity: unknown[]): Record<string, unknown> => ({
  schema: 'report.v1',
  meta: { seed: 1, elapsed_ms: 100 },
  drivers_status: 'computed',
  factor_sensitivity,
})

const scored = [
  { factor_id: 'fac_a', label: 'Alpha', influence_score: 1, influence_rank: 1, elasticity: 0.5, importance_basis: 'graph_structural' },
  { factor_id: 'fac_b', label: 'Beta', influence_score: 0.4, influence_rank: 2, elasticity: 0.3, importance_basis: 'graph_structural' },
]
/** ISL #213's gated shape: score and rank withheld, the gate named. Elasticity 0: the product's other input is 0 today. */
const gatedRow = (gated_by: unknown) => ({
  factor_id: 'fac_g', label: 'Gamma', influence_score: null, influence_rank: null, gated_by, elasticity: 0, importance_basis: 'graph_structural',
})
/** A truncated walk: score withheld, NO gate named. */
const truncatedRow = { factor_id: 'fac_g', label: 'Gamma', influence_score: null, influence_rank: null, elasticity: 0, importance_basis: 'graph_structural' }

const panelRows = () => {
  const panel = renderHook(() => useResultsSectionData())
  return panel.result.current.drivers
}
const canvasFor = (id: string) => renderHook(() => useNodeDisplayMetadata(id, 'factor')).result.current

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

describe('(a) one gated row does not enter the normalisation base', () => {
  it('the scored rows use normalised elasticity and rank 1..n among themselves', () => {
    setCompleteReport(baseReport([...scored, gatedRow(['fac_launch'])]))
    const data = panelRows()
    expect(
      data.drivers.map((d) => [d.factorKey, d.rank, d.displayProvenance, d.displayInfluence]),
    ).toEqual([
      ['fac_a', 1, 'normalised_elasticity', 1],
      ['fac_b', 2, 'normalised_elasticity', 0.6],
    ])
    // Same basis on the canvas, off the same feed.
    const a = canvasFor('fac_a')
    expect(a.influenceProvenance).toBe('normalised_elasticity')
    expect(a.influence).toBe(1)
  })

  it('the same verdict for the extractPolicyRow feeders (Option card, Model tab)', () => {
    const rows = [...scored, gatedRow(['fac_launch'])].map((r) => extractPolicyRow(r)!)
    const model = selectDriverDisplayModel(rows)
    expect(model.get('fac_a')).toMatchObject({ value: 1, provenance: 'normalised_elasticity' })
    expect(model.get('fac_b')).toMatchObject({ value: 0.6, provenance: 'normalised_elasticity' })
    expect(model.has('fac_g')).toBe(false)
  })
})

describe('(b) the gated row reads "Depends on the option chosen" and nothing numeric', () => {
  it('in place of its bar: no digit, no %, no bar, no tier pill, and never "minimal impact"', () => {
    setCompleteReport(baseReport([...scored, gatedRow(['fac_launch'])]))
    const data = panelRows()
    render(<DriversSection data={data} />)

    const row = screen.getByTestId('driver-gated-row-fac_g')
    expect(row.textContent).toContain('Gamma')
    expect(row.textContent).toContain(GATED_WORDS)
    expect(row.textContent).not.toMatch(/\d|%/)
    expect(row.querySelector('[role="progressbar"], [role="meter"]')).toBeNull()
    expect(screen.queryByTestId('driver-influence-pill-fac_g')).toBeNull()
    expect(screen.getAllByText(GATED_WORDS)).toHaveLength(1)
    expect(screen.queryByText('Some factors with minimal impact are not shown')).toBeNull()
    expect(data.hiddenZeroImpactCount).toBeUndefined()
    // CONTROL: the scored rows still render their band, and their figures on
    // request (plain words first, 4 Oct 2026: no percentage by default).
    expect(screen.getByTestId('driver-influence-pill-fac_a')).toBeTruthy()
    expect(screen.queryByText('100%')).toBeNull()
    fireEvent.click(screen.getByTestId('influence-details-toggle'))
    expect(screen.getByText('100%')).toBeTruthy()
    // The gated row stays words-only with the figures shown.
    expect(screen.getByTestId('driver-gated-row-fac_g').textContent).not.toMatch(/\d|%/)
  })
})

describe('(c) the canvas driver badge gives the gated factor no rank', () => {
  it('no rank, no figure; the scored rows rank 1..2 and M counts only them', () => {
    setCompleteReport(baseReport([...scored, gatedRow(['fac_launch'])]))
    const g = canvasFor('fac_g')
    expect(g.inSensitivityAnalysis).toBe(true) // precondition: the row IS in the run
    expect(g.sensitivityRank).toBeNull()
    expect(g.influence).toBeNull()
    expect(g.influenceProvenance).toBeNull()
    expect(g.driverRelativeSensitivity).toBeNull()

    const a = canvasFor('fac_a')
    const b = canvasFor('fac_b')
    expect([a.sensitivityRank, b.sensitivityRank]).toEqual([1, 2])
    expect(a.influenceRankedCount).toBe(2)
  })
})

describe('(d) CONTRAST: a null score with no gated_by keeps today’s fallback', () => {
  it('every row falls back to normalised elasticity and the truncated row is ranked as before', () => {
    setCompleteReport(baseReport([...scored, truncatedRow]))
    const data = panelRows()
    expect(
      data.drivers.map((d) => [d.factorKey, d.rank, d.displayProvenance]),
    ).toEqual([
      ['fac_a', 1, 'normalised_elasticity'],
      ['fac_b', 2, 'normalised_elasticity'],
      ['fac_g', 3, 'normalised_elasticity'],
    ])
    expect(data.drivers[0].displayInfluence).toBe(1)
    expect(data.drivers[1].displayInfluence).toBeCloseTo(0.6)
    expect(canvasFor('fac_g').sensitivityRank).toBe(3)
    render(<DriversSection data={data} />)
    expect(screen.queryByText(GATED_WORDS)).toBeNull()
  })
})

describe('(e) CONTRAST: only a non-empty string array beside a withheld score is a gate', () => {
  it.each([
    ['empty array', []],
    ['a string, not an array', 'fac_launch'],
    ['a non-string member', [7]],
    ['null', null],
  ])('gated_by as %s → not gated (today’s fallback)', (_, gatedBy) => {
    setCompleteReport(baseReport([...scored, gatedRow(gatedBy)]))
    const data = panelRows()
    expect(data.drivers.map((d) => d.displayProvenance)).toEqual([
      'normalised_elasticity', 'normalised_elasticity', 'normalised_elasticity',
    ])
    expect(data.drivers.map((d) => d.factorKey)).toContain('fac_g')
    render(<DriversSection data={data} />)
    expect(screen.queryByText(GATED_WORDS)).toBeNull()
  })

  it('a finite score beside gated_by is not gated: its elasticity figure and rank remain', () => {
    setCompleteReport(baseReport([...scored, { ...gatedRow(['fac_launch']), influence_score: 0.2 }]))
    const data = panelRows()
    expect(
      data.drivers.map((d) => [d.factorKey, d.rank, d.displayProvenance, d.displayInfluence]),
    ).toEqual([
      ['fac_a', 1, 'normalised_elasticity', 1],
      ['fac_b', 2, 'normalised_elasticity', 0.6],
      ['fac_g', 3, 'normalised_elasticity', 0],
    ])
  })
})

describe('(f) the live carrier: enrichment.factor_sensitivity[].gated_by survives the V5 mapper', () => {
  type Row = Record<string, unknown> & { factor_id: string }
  type Block = { enrichment: { factor_sensitivity: Row[] } }
  const served = (): Block => JSON.parse(JSON.stringify(servedC.analysis_block)) as Block
  /** The ONE shaped change: one served row in ISL #213's gated form. */
  function shaped(gatedBy: unknown): Block {
    const block = served()
    const row = block.enrichment.factor_sensitivity.find((r) => r.factor_id === 'advertising_investment_share')!
    row.influence_score = null
    row.influence_rank = null
    row.gated_by = gatedBy
    return block
  }

  it('wire premise (served): every row carries a finite influence_score', () => {
    for (const r of served().enrichment.factor_sensitivity) {
      expect(Number.isFinite(r.influence_score), r.factor_id).toBe(true)
    }
  })

  it('the gated row withholds only itself; the served rows use normalised elasticity', () => {
    const report = mapV5AnalysisToReport(shaped(['incremental_growth_spend']) as never)
    setCompleteReport(report as unknown as Record<string, unknown>)
    const data = panelRows()
    // Five RANKED rows (the gated one is listed apart), so the >5-rows zero-elasticity filter does not
    // apply; the point is their BASIS. Order: |elasticity|, then label for mapped zero ties.
    expect(data.drivers.map((d) => [d.factorKey, d.displayProvenance])).toEqual([
      ['pro_paying_subscribers', 'normalised_elasticity'],
      ['monthly_churn', 'normalised_elasticity'],
      ['incremental_growth_spend', 'normalised_elasticity'],
      ['new_feature_release_intensity', 'normalised_elasticity'],
      ['pro_plan_price', 'normalised_elasticity'],
    ])
    expect(canvasFor('pro_paying_subscribers').influenceProvenance).toBe('normalised_elasticity')
    expect(canvasFor('advertising_investment_share').sensitivityRank).toBeNull()
    expect(canvasFor('advertising_investment_share').influence).toBeNull()
    render(<DriversSection data={data} />)
    // Only two rows clear the visible influence filter; the gated row is already in the collapsed list.
    expect(screen.getByTestId('driver-gated-row-advertising_investment_share').textContent).toContain(GATED_WORDS)
  })

  it('CONTRAST: the same shaped row with gated_by: [] falls back as a truncated walk does', () => {
    const report = mapV5AnalysisToReport(shaped([]) as never)
    setCompleteReport(report as unknown as Record<string, unknown>)
    const data = panelRows()
    expect(new Set(data.drivers.map((d) => d.displayProvenance))).toEqual(new Set(['normalised_elasticity']))
  })
})

/**
 * ⛔ PR Review CHANGES_REQUIRED on #2290 @ 89b92502: (1) PLoT #408 emits the gate as
 * `factor_sensitivity[].influence_gated_by` (contracts/openapi.yaml, FactorSensitivityResultV3) and CEE stores the
 * PLoT envelope verbatim — the hand-written `gated_by` above is not the wire key; (2) the mapper dropped a row with
 * no magnitude BEFORE reading the gate. Rows below are UNMODIFIED PLoT #408 egress shapes: a gated row carries NO
 * `influence_score`, `influence_rank` or `importance_rank` key at all, and `sensitivity_score` / `elasticity` are
 * optional.
 */
describe('(g) PLoT #408 egress rows through mapV5AnalysisToReport → panel and badge', () => {
  type Block = { enrichment: { factor_sensitivity: unknown[] } }
  const block = (rows: unknown[]): Block => {
    const b = JSON.parse(JSON.stringify(servedC.analysis_block)) as Block
    b.enrichment.factor_sensitivity = rows
    return b
  }
  const scoredP = (id: string, s: number, rank: number) => ({
    factor_id: id, sensitivity_score: s, elasticity: s, importance_rank: rank, importance_basis: 'isl_structural',
    influence_basis: 'isl_structural', influence_score: s, influence_rank: rank, direction: 'positive',
  })
  const gatedP = (id: string, withMagnitude: boolean) => ({
    factor_id: id, importance_basis: 'isl_structural', influence_gated_by: ['hires_today'],
    ...(withMagnitude ? { sensitivity_score: 0.2, elasticity: 0.2 } : {}),
  })

  it.each([true, false])('mixed: scored rows use normalised elasticity 1..n; the gated row (magnitude %s) reads the words', (withMagnitude) => {
    const report = mapV5AnalysisToReport(block([scoredP('pro_paying_subscribers', 0.9, 1), scoredP('monthly_churn', 0.4, 2), gatedP('advertising_investment_share', withMagnitude)]) as never)
    setCompleteReport(report as unknown as Record<string, unknown>)
    const data = panelRows()
    expect(data.drivers.map((d) => [d.factorKey, d.displayProvenance])).toEqual([
      ['pro_paying_subscribers', 'normalised_elasticity'],
      ['monthly_churn', 'normalised_elasticity'],
    ])
    expect(canvasFor('advertising_investment_share').sensitivityRank).toBeNull()
    expect(canvasFor('advertising_investment_share').influence).toBeNull()
    render(<DriversSection data={data} />)
    const row = screen.getByTestId('driver-gated-row-advertising_investment_share')
    expect(row.textContent).toContain(GATED_WORDS)
    expect(row.textContent).not.toMatch(/\d/)
  })

  it('all-gated, no magnitudes: every row reads the words; nothing falls back, nothing is dropped', () => {
    const report = mapV5AnalysisToReport(block([gatedP('pro_paying_subscribers', false), gatedP('monthly_churn', false)]) as never)
    setCompleteReport(report as unknown as Record<string, unknown>)
    const data = panelRows()
    expect(data.drivers).toEqual([])
    render(<DriversSection data={data} />)
    expect(screen.getByTestId('driver-gated-row-pro_paying_subscribers').textContent).toContain(GATED_WORDS)
    expect(screen.getByTestId('driver-gated-row-monthly_churn').textContent).toContain(GATED_WORDS)
  })

  it('the mapped report row keeps the gate and fabricates no magnitude', () => {
    const report = mapV5AnalysisToReport(block([scoredP('pro_paying_subscribers', 0.9, 1), gatedP('advertising_investment_share', false)]) as never) as unknown as { factor_sensitivity: Array<Record<string, unknown>> }
    const g = report.factor_sensitivity.find((r) => r.factor_id === 'advertising_investment_share')!
    expect(g).toBeDefined()
    expect(g.sensitivity).toBeUndefined()
    expect(g.influence_score).toBeUndefined()
  })

  it('⛔ CONTRAST: an INVALID gate (non-string member) with no magnitude is dropped — admission is the shared reader', () => {
    const report = mapV5AnalysisToReport(block([scoredP('pro_paying_subscribers', 0.9, 1), { factor_id: 'monthly_churn', importance_basis: 'isl_structural', influence_gated_by: [7] }]) as never) as unknown as { factor_sensitivity: Array<Record<string, unknown>> }
    expect(report.factor_sensitivity.map((r) => r.factor_id)).toEqual(['pro_paying_subscribers'])
  })

  it('⛔ CONTRAST: a NON-gated row with no usable magnitude is still dropped, as before', () => {
    const report = mapV5AnalysisToReport(block([scoredP('pro_paying_subscribers', 0.9, 1), { factor_id: 'monthly_churn', importance_basis: 'isl_structural' }]) as never) as unknown as { factor_sensitivity: Array<Record<string, unknown>> }
    expect(report.factor_sensitivity.map((r) => r.factor_id)).toEqual(['pro_paying_subscribers'])
  })
})

describe('(h) the REAL PLoT #408 egress (R3-B, unmodified rows) replayed through the mapper → panel and badge', () => {
  // A real gated row carries a magnitude from PLoT's own walk (pro_paying_subscribers sensitivity_score 0.15,
  // elasticity 0.30) — the hand-built gatedP rows above never did. The words must still win over that figure.
  const rows = plot408Zero.factor_sensitivity as Array<Record<string, unknown>>
  const gatedIds = rows.filter((r) => Array.isArray(r.influence_gated_by)).map((r) => r.factor_id as string)
  const run = () => {
    const b = JSON.parse(JSON.stringify(servedC.analysis_block)) as { enrichment: Record<string, unknown> }
    b.enrichment.factor_sensitivity = rows
    b.enrichment.driver_order = plot408Zero.driver_order
    setCompleteReport(mapV5AnalysisToReport(b as never) as unknown as Record<string, unknown>)
  }

  it('premise: 3 gated rows, one of them with a non-zero magnitude', () => {
    expect(gatedIds).toEqual(['pro_paying_subscribers', 'monthly_churn', 'monthly_new_pro_subscribers'])
    expect(rows.find((r) => r.factor_id === 'pro_paying_subscribers')!.sensitivity_score).toBe(0.15)
  })

  it('every gated row reads the words with no digit and no rank — even the one carrying a 0.15 magnitude', () => {
    run()
    const data = panelRows()
    render(<DriversSection data={data} />)
    fireEvent.click(screen.getByRole('button', { name: 'See all factors (+2 more)' })) // 2 visible scored rows + 3 gated rows
    for (const id of gatedIds) {
      expect(canvasFor(id).inSensitivityAnalysis, id).toBe(true) // precondition: the row IS in the run
      expect(canvasFor(id).sensitivityRank, id).toBeNull()
      expect(canvasFor(id).influence, id).toBeNull()
      const row = screen.getByTestId(`driver-gated-row-${id}`)
      expect(row.textContent).toContain(GATED_WORDS)
      expect(row.textContent).not.toMatch(/\d/)
    }
    expect(data.drivers.map((d) => d.factorKey).filter((k) => gatedIds.includes(k))).toEqual([])
  })

  it('the 3 scored rows use normalised elasticity in the panel; the badge ranks their distinct magnitudes', () => {
    run()
    const data = panelRows()
    // 3 ranked rows (the 3 gated are listed apart), so the >5-rows zero-elasticity filter no longer hides
    // pro_plan_price (influence_score 1, elasticity 0 at price 0 today).
    expect(data.drivers.map((d) => [d.factorKey, d.displayProvenance])).toEqual([
      ['fac_existing_customers_grandfathered', 'normalised_elasticity'],
      ['other_mrr_growth', 'normalised_elasticity'],
      ['pro_plan_price', 'normalised_elasticity'],
    ])
    // The badge and display now use |elasticity|: the producer score's 0.1667 tie does not
    // withhold these distinct magnitudes, though the producer's structural tie stamp remains intact.
    expect(['fac_existing_customers_grandfathered', 'other_mrr_growth', 'pro_plan_price'].map((id) => canvasFor(id).sensitivityRank)).toEqual([1, 2, 3])
    expect(canvasFor('fac_existing_customers_grandfathered').influenceRankedCount).toBe(3)
    expect(plot408Zero.driver_order.separability.method).toBe('basis_value_exact_tie')
  })

  // Historical structural-basis defect: the V5 mapper does not carry `importance_basis`, so every
  // served driver arrives UNSTAMPED and `influenceQuantityRunDisclosureForRun`'s fail-closed gate never engages. Served
  // PLoT stamps `isl_structural` on every row (29 Sep), so the panel prints "These show structural influence…" on a
  // basis the code does not handle. D7 selects normalised elasticity, which makes no structural claim;
  // this assertion is now met without a mapper or noun-ruling change.
  it('an isl_structural payload makes no structural disclosure on the elasticity display basis', () => {
    run()
    const data = panelRows()
    expect(rows.every((r) => r.importance_basis === 'isl_structural')).toBe(true) // premise, by identity
    const { container } = render(<DriversSection data={data} />)
    expect(container.textContent ?? '').not.toContain(INFLUENCE_STRUCTURAL_BASIS_NOTE)
    expect(container.textContent ?? '').not.toMatch(/structural influence/i)
  })
})
