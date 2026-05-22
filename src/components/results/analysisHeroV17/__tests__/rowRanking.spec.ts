/**
 * rowRanking — deterministic ordering + category assignment tests.
 * Per investigation §11.1 + §11.3. Asserts precedence, category source-field
 * binding, and band derivation.
 */

import { describe, it, expect } from 'vitest'
import { rankHeroRows } from '../rowRanking'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import type { ConfidenceSectionData, DecisionResultData, EvidenceGapItem, OptionResult, FragileEdgeItem } from '../../types'

function makeData(overrides: Partial<{
  fragile?: { fromId: string; fromLabel: string; alternativeWinnerLabel: string }
  gaps?: EvidenceGapItem[]
  options?: OptionResult[]
  bias?: Array<{ type: string; description: string }>
}> = {}): ResultsSectionDataReturn {
  const winner: OptionResult = {
    id: 'opt_a',
    label: 'Option A',
    winProbability: 0.7,
  } as OptionResult

  const options = overrides.options ?? [winner, { id: 'opt_b', label: 'Option B', winProbability: 0.3 } as OptionResult]

  const recommendation: DecisionResultData = {
    recommendedOption: winner,
    allOptions: options,
    goalLabel: 'Goal',
    isSingleOption: options.length === 1,
    analysisStatus: 'computed',
    recommendationStability: 0.7,
  } as DecisionResultData

  const fragile: FragileEdgeItem | undefined = overrides.fragile ? {
    fromId: overrides.fragile.fromId,
    fromLabel: overrides.fragile.fromLabel,
    toId: 'node_y',
    toLabel: 'Outcome',
    switchProbability: 0.42,
    alternativeWinnerLabel: overrides.fragile.alternativeWinnerLabel,
  } as FragileEdgeItem : undefined

  const confidence: ConfidenceSectionData = {
    tier: { tier: 'fair', icon: 'AlertTriangle', label: 'Fair', description: 'd' },
    qualityScore: 60,
    uncertainties: [],
    topUncertainties: [],
    improvements: [],
    topImprovements: [],
    evidenceGaps: overrides.gaps ?? [],
    topEvidenceGaps: overrides.gaps ?? [],
    nextActions: [],
    topNextActions: [],
    topFragileEdge: fragile,
    m2BiasFindings: overrides.bias?.map(b => ({
      type: b.type,
      source: 'test',
      description: b.description,
      affectedElements: [],
      linkedCritiqueCode: '',
    })),
  } as ConfidenceSectionData

  return {
    recommendation,
    drivers: { drivers: [], topDrivers: [], driversStatus: 'computed', totalCount: 0, hasMagnitudeData: false },
    confidence,
    improvements: { improvements: [], count: 0, hasHighPriority: false },
    isLoading: false,
    isError: false,
    goalLabel: 'Goal',
  } as ResultsSectionDataReturn
}

function gap(label: string, factorId: string, voi: number): EvidenceGapItem {
  return {
    factorId,
    factorLabel: label,
    confidence: 50,
    voi,
    evpiPp: voi * 50,
    suggestion: undefined,
    targetNodeId: factorId,
  } as EvidenceGapItem
}

describe('rankHeroRows', () => {
  it('strong state returns ready + reflective rows only', () => {
    const rows = rankHeroRows(makeData({ gaps: [gap('X', 'n_x', 0.8)] }), 'strong')
    expect(rows[0].category).toBe('ready')
    expect(rows[0].priority).toBe('Ready')
  })

  it('non-strong: fragile edge always rank 1', () => {
    const rows = rankHeroRows(
      makeData({
        fragile: { fromId: 'n_f', fromLabel: 'Hiring rate', alternativeWinnerLabel: 'Option B' },
        gaps: [gap('Cost', 'n_c', 0.9), gap('Time', 'n_t', 0.5)],
      }),
      'moderate',
    )
    expect(rows[0].category).toBe('risk')
    // Verb-led title (2026-05-21 corrections): risk → 'Verify {raw label}'.
    expect(rows[0].title).toBe('Verify Hiring rate')
  })

  it('evidence gaps sorted by VOI descending — titles carry the Verify prefix', () => {
    const rows = rankHeroRows(
      makeData({
        gaps: [
          gap('Low priority', 'n_l', 0.1),
          gap('High priority', 'n_h', 0.9),
          gap('Mid priority', 'n_m', 0.5),
        ],
      }),
      'moderate',
    )
    expect(rows.map(r => r.title)).toEqual([
      'Verify High priority',
      'Verify Mid priority',
      'Verify Low priority',
    ])
  })

  it('VOI band: ≥0.5 → High, ≥0.2 → Medium, else Low', () => {
    const rows = rankHeroRows(
      makeData({ gaps: [gap('A', 'a', 0.6), gap('B', 'b', 0.3), gap('C', 'c', 0.1)] }),
      'moderate',
    )
    expect(rows[0].priority).toBe('High')
    expect(rows[1].priority).toBe('Medium')
    expect(rows[2].priority).toBe('Low')
  })

  it('coverage row added when single option', () => {
    const rows = rankHeroRows(
      makeData({
        options: [{ id: 'opt_a', label: 'Only option', winProbability: 1 } as OptionResult],
      }),
      'moderate',
    )
    expect(rows.some(r => r.category === 'coverage')).toBe(true)
  })

  it('reflect rows surface from m2BiasFindings', () => {
    const rows = rankHeroRows(
      makeData({
        bias: [{ type: 'Anchoring', description: 'Past spend mentioned in brief' }],
      }),
      'moderate',
    )
    expect(rows.some(r => r.category === 'reflect')).toBe(true)
  })

  it('row categories never inferred — source field binding holds', () => {
    const rows = rankHeroRows(
      makeData({
        fragile: { fromId: 'n_f', fromLabel: 'Hiring rate', alternativeWinnerLabel: 'B' },
        gaps: [gap('Evidence factor', 'n_e', 0.5)],
        bias: [{ type: 'Sunk cost', description: 'd' }],
      }),
      'moderate',
    )
    // Verb-led titles per 2026-05-21 corrections pass: risk/evidence get
    // "Verify " prefix; reflect gets "Challenge " prefix.
    const fragileRow = rows.find(r => r.title === 'Verify Hiring rate')
    const evidenceRow = rows.find(r => r.title === 'Verify Evidence factor')
    const reflectRow = rows.find(r => r.title === 'Challenge Sunk cost')
    expect(fragileRow?.category).toBe('risk')
    expect(evidenceRow?.category).toBe('evidence')
    expect(reflectRow?.category).toBe('reflect')
  })

  it('empty data set produces empty rows', () => {
    const rows = rankHeroRows(makeData({}), 'moderate')
    expect(rows).toEqual([])
  })

  it('row priorityWidth maps to band', () => {
    const rows = rankHeroRows(
      makeData({ gaps: [gap('A', 'a', 0.6), gap('B', 'b', 0.3), gap('C', 'c', 0.1)] }),
      'moderate',
    )
    expect(rows[0].priorityWidth).toBe(100)
    expect(rows[1].priorityWidth).toBe(60)
    expect(rows[2].priorityWidth).toBe(30)
  })

  it('every row has a chatPrompt that names the row title', () => {
    const rows = rankHeroRows(makeData({ gaps: [gap('Cost', 'n_c', 0.5)] }), 'moderate')
    expect(rows[0].chatPrompt).toContain('Cost')
  })
})

describe('rankHeroRows — polish pass: fragile/risk row shape', () => {
  it('fragile/risk row reason is the short final copy with no priority lede', () => {
    const rows = rankHeroRows(
      makeData({
        fragile: { fromId: 'n_f', fromLabel: 'Hiring rate', alternativeWinnerLabel: 'Option B' },
      }),
      'moderate',
    )
    const riskRow = rows.find(r => r.category === 'risk')
    expect(riskRow).toBeTruthy()
    // Exact rendered string — the priority bar already shows "High", so
    // the `High evidence priority. ` lede that `buildReason` would have
    // prepended is deliberately suppressed for this row to avoid mid-
    // sentence truncation at current panel width.
    expect(riskRow!.reason).toBe('Check this first. It could change the result.')
    expect(riskRow!.reason).not.toContain('evidence priority')
    // Anti-drift on the prior copy.
    expect(riskRow!.reason).not.toContain('Highest-priority assumption')
    expect(riskRow!.reason).not.toContain('Most likely to change')
  })

  it('fragile/risk row action set drops the Plus (add) icon', () => {
    const rows = rankHeroRows(
      makeData({
        fragile: { fromId: 'n_f', fromLabel: 'Hiring rate', alternativeWinnerLabel: 'Option B' },
      }),
      'moderate',
    )
    const riskRow = rows.find(r => r.category === 'risk')
    expect(riskRow).toBeTruthy()
    expect(riskRow!.actions).toEqual(['ai', 'discuss'])
    expect(riskRow!.actions).not.toContain('add')
  })

  it('coverage row still keeps the add action (semantic match — adding an alternative)', () => {
    const rows = rankHeroRows(
      makeData({
        options: [{ id: 'opt_a', label: 'Only option', winProbability: 1 } as OptionResult],
      }),
      'moderate',
    )
    const coverageRow = rows.find(r => r.category === 'coverage')
    expect(coverageRow).toBeTruthy()
    expect(coverageRow!.actions).toContain('add')
  })

  // ── verbLeadTitle defensive behaviour (2026-05-21 self-review) ─────────
  it('verb prefix never composes with an empty user label — falls back to generic phrase', () => {
    // Degenerate upstream data (empty fragile-edge fromLabel). The
    // verbLeadTitle helper trims and falls back rather than producing
    // "Verify " (trailing space, no factor name).
    const rows = rankHeroRows(
      makeData({
        fragile: { fromId: 'n_f', fromLabel: '', alternativeWinnerLabel: 'B' },
      }),
      'moderate',
    )
    const riskRow = rows.find(r => r.category === 'risk')
    expect(riskRow).toBeTruthy()
    expect(riskRow!.title).toBe('Verify this factor')
    expect(riskRow!.title).not.toMatch(/Verify\s*$/) // never trailing-space empty
  })

  it('verb prefix handles whitespace-only user labels by falling back', () => {
    const rows = rankHeroRows(
      makeData({
        fragile: { fromId: 'n_f', fromLabel: '   ', alternativeWinnerLabel: 'B' },
      }),
      'moderate',
    )
    const riskRow = rows.find(r => r.category === 'risk')
    expect(riskRow).toBeTruthy()
    expect(riskRow!.title).toBe('Verify this factor')
  })
})
