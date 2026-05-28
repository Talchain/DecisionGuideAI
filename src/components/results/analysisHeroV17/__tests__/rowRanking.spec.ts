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

function gap(
  label: string,
  factorId: string,
  voi: number,
  // Default to a non-generic, non-banned, non-"Gather data on X" suggestion so
  // the strict generic-row rule (V17 power pass 2026-05-27) doesn't filter
  // these helper-built gaps out. Tests that exercise the filter pass explicit
  // suggestion strings — empty, banned, or the Gather-data template. The
  // label is NOT interpolated so labels containing banned terms (e.g. "the
  // winning team") still produce evidence rows via this default.
  suggestion: string | undefined = 'Compare this estimate against recent data.',
): EvidenceGapItem {
  return {
    factorId,
    factorLabel: label,
    confidence: 50,
    voi,
    evpiPp: voi * 50,
    suggestion,
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
  it('fragile/risk row reason names the factor explicitly to disambiguate from dominance signal (V17 power pass 2026-05-27)', () => {
    const rows = rankHeroRows(
      makeData({
        fragile: { fromId: 'n_f', fromLabel: 'Hiring rate', alternativeWinnerLabel: 'Option B' },
      }),
      'moderate',
    )
    const riskRow = rows.find(r => r.category === 'risk')
    expect(riskRow).toBeTruthy()
    // Codex round-4 P2 #1: the label is the final noun phrase, so it
    // can NEVER land adjacent to the verb. Earlier forms ("If {label}
    // changes" and "If the estimate for {label} changes") both produced
    // mid-sentence "changes changes" repetition for labels ending in
    // "changes".
    expect(riskRow!.reason).toBe('If the estimate changes for Hiring rate, the leading option could change.')
    // Anti-drift on every prior copy + glossary regressions.
    expect(riskRow!.reason).not.toContain('Check this first')
    expect(riskRow!.reason).not.toContain('evidence priority')
    expect(riskRow!.reason).not.toContain('Highest-priority assumption')
    expect(riskRow!.reason).not.toContain('Most likely to change')
    expect(riskRow!.reason).not.toContain('If Hiring rate changes')
    expect(riskRow!.reason).not.toContain('If the estimate for Hiring rate changes')
    expect(riskRow!.reason).not.toMatch(/winner|winning|recommendation/i)
  })

  it('fragile/risk row reason falls back to "this factor" when the upstream label is empty or whitespace-only', () => {
    const empty = rankHeroRows(
      makeData({ fragile: { fromId: 'n_f', fromLabel: '', alternativeWinnerLabel: 'B' } }),
      'moderate',
    )
    expect(empty.find(r => r.category === 'risk')!.reason)
      .toBe('If the estimate changes for this factor, the leading option could change.')
    const whitespace = rankHeroRows(
      makeData({ fragile: { fromId: 'n_f', fromLabel: '   ', alternativeWinnerLabel: 'B' } }),
      'moderate',
    )
    expect(whitespace.find(r => r.category === 'risk')!.reason)
      .toBe('If the estimate changes for this factor, the leading option could change.')
  })

  it('fragile/risk row reason swaps a banned-term label for the generic fallback', () => {
    // safeRowLabel filters banned glossary terms (e.g. "winning") and
    // substitutes the generic phrase before interpolation, so the rendered
    // copy never amplifies a forbidden term.
    const rows = rankHeroRows(
      makeData({
        fragile: { fromId: 'n_f', fromLabel: 'the winning team', alternativeWinnerLabel: 'B' },
      }),
      'moderate',
    )
    const riskRow = rows.find(r => r.category === 'risk')
    expect(riskRow).toBeTruthy()
    expect(riskRow!.reason).toBe('If the estimate changes for this factor, the leading option could change.')
  })

  it('fragile/risk row reason is structurally free of "changes changes" / "shifts shifts" adjacency, even for labels that end in those verbs (Codex round-4 P2 #1)', () => {
    // Awkward labels: "hiring changes", "salary shifts", "weekly changes"
    // — all previously produced mid-sentence verb repetition. The new
    // copy puts the label at the END of the clause as the object of `for`,
    // so no word ever sits next to the verb. The label is preserved
    // verbatim — we never silently truncate user data.
    const labels = ['hiring changes', 'salary shifts', 'weekly changes', 'changes']
    for (const label of labels) {
      const rows = rankHeroRows(
        makeData({
          fragile: { fromId: 'n_x', fromLabel: label, alternativeWinnerLabel: 'B' },
        }),
        'moderate',
      )
      const riskRow = rows.find(r => r.category === 'risk')!
      expect(riskRow.reason).toBe(`If the estimate changes for ${label}, the leading option could change.`)
      // The label must appear verbatim — no silent truncation.
      expect(riskRow.reason).toContain(label)
      // Critical regression: no adjacent-word repetition of the verb.
      expect(riskRow.reason).not.toMatch(/changes\s+changes/)
      expect(riskRow.reason).not.toMatch(/shifts\s+shifts/)
    }
  })

  it('fixture: when Row 1 is a fragile-edge factor and the dominant driver is different, Row 1 reason MUST name the fragile factor — not imply dominance', () => {
    // Canonical fixture matching the Codex review concern: fragile-edge
    // factor = Hiring rate (Row 1), dominant driver = Technical Leadership.
    // The hero surfaces the dominant driver separately via the dependency
    // line (covered in buildAnalysisHeroViewModel.spec.ts); Row 1's reason
    // must read as fragility, not dominance.
    const rows = rankHeroRows(
      makeData({
        fragile: { fromId: 'n_hiring', fromLabel: 'Hiring rate', alternativeWinnerLabel: 'Two Developers' },
        gaps: [gap('Salary Cost', 'n_sal', 0.6), gap('Technical Leadership', 'n_tl', 0.4)],
      }),
      'moderate',
    )
    expect(rows[0].category).toBe('risk')
    expect(rows[0].title).toBe('Verify Hiring rate')
    expect(rows[0].reason).toBe('If the estimate changes for Hiring rate, the leading option could change.')
    // Critically: the reason text must NOT imply "main driver".
    expect(rows[0].reason.toLowerCase()).not.toContain('dominant')
    expect(rows[0].reason.toLowerCase()).not.toContain('most important')
    expect(rows[0].reason.toLowerCase()).not.toContain('main driver')
    expect(rows[0].reason.toLowerCase()).not.toContain('strongest')
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

// V17 power pass (2026-05-27): strict generic-row rule on evidence rows.
// Rows only render when CEE provides a specific, non-banned, non-template
// suggestion. The previous "Check whether this estimate matches your
// experience." fallback is gone — rows without genuine coaching are dropped.
describe('rankHeroRows — V17 power pass: strict generic-row rule on evidence gaps', () => {
  it('renders evidence row when CEE provides a specific, hand-crafted suggestion', () => {
    const rows = rankHeroRows(
      makeData({
        gaps: [gap('Engineering Capacity', 'n_e', 0.6, 'Compare your past hiring cohorts against this estimate.')],
      }),
      'moderate',
    )
    const evidenceRow = rows.find(r => r.category === 'evidence')
    expect(evidenceRow).toBeTruthy()
    expect(evidenceRow!.title).toBe('Verify Engineering Capacity')
    expect(evidenceRow!.reason).toBe('Compare your past hiring cohorts against this estimate.')
  })

  it('hides evidence row whose only suggestion is the generic "Gather data on X to reduce uncertainty" template', () => {
    const rows = rankHeroRows(
      makeData({
        gaps: [gap('Engineering Capacity', 'n_e', 0.6, 'Gather data on "Engineering Capacity" to reduce uncertainty')],
      }),
      'moderate',
    )
    expect(rows.find(r => r.category === 'evidence')).toBeUndefined()
  })

  it('hides evidence row whose template suggestion ends with a period', () => {
    const rows = rankHeroRows(
      makeData({
        gaps: [gap('Engineering Capacity', 'n_e', 0.6, 'Gather data on "Engineering Capacity" to reduce uncertainty.')],
      }),
      'moderate',
    )
    expect(rows.find(r => r.category === 'evidence')).toBeUndefined()
  })

  it('hides evidence row when suggestion is missing (undefined)', () => {
    // Construct gap inline so the helper default does not substitute a
    // non-empty suggestion when `undefined` is passed positionally.
    const gapWithNoSuggestion: EvidenceGapItem = {
      factorId: 'n_e',
      factorLabel: 'Engineering Capacity',
      confidence: 50,
      voi: 0.6,
      evpiPp: 30,
      targetNodeId: 'n_e',
    } as EvidenceGapItem
    const rows = rankHeroRows(
      makeData({ gaps: [gapWithNoSuggestion] }),
      'moderate',
    )
    expect(rows.find(r => r.category === 'evidence')).toBeUndefined()
  })

  it('hides evidence row when suggestion is empty / whitespace-only', () => {
    const rows = rankHeroRows(
      makeData({
        gaps: [gap('Engineering Capacity', 'n_e', 0.6, '   ')],
      }),
      'moderate',
    )
    expect(rows.find(r => r.category === 'evidence')).toBeUndefined()
  })

  it('hides evidence row when suggestion contains a banned term', () => {
    // 'recommendation' is on the banned-term list — confirm the existing
    // banned-term guard still drops the row (was previously falling back to
    // a generic literal; now strict).
    const rows = rankHeroRows(
      makeData({
        gaps: [gap('Engineering Capacity', 'n_e', 0.6, 'This could change the recommendation if it shifts.')],
      }),
      'moderate',
    )
    expect(rows.find(r => r.category === 'evidence')).toBeUndefined()
  })

  it('mixed batch: keeps only the row with a specific suggestion', () => {
    const missing: EvidenceGapItem = {
      factorId: 'n_m',
      factorLabel: 'Missing',
      confidence: 50,
      voi: 0.5,
      evpiPp: 25,
      targetNodeId: 'n_m',
    } as EvidenceGapItem
    const rows = rankHeroRows(
      makeData({
        gaps: [
          gap('Specific', 'n_s', 0.9, 'Pull last quarter\'s capacity numbers from the staffing tracker.'),
          gap('Template', 'n_t', 0.7, 'Gather data on "Template" to reduce uncertainty'),
          missing,
        ],
      }),
      'moderate',
    )
    const evidenceRows = rows.filter(r => r.category === 'evidence')
    expect(evidenceRows).toHaveLength(1)
    expect(evidenceRows[0].title).toBe('Verify Specific')
  })
})
