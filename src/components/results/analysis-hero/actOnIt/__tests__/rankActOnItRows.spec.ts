/**
 * rankActOnItRows — deterministic ordering, category assignment, row copy, and
 * the ready-to-brief predicate.
 *
 * ## Why this file exists
 *
 * `rankActOnItRows.ts` is LIVE product code (`AnalysisHeroContainer.tsx:105`)
 * and shipped with ZERO tests. Its own header claims the ready-to-brief
 * equivalence "is proved by execution in `rankActOnItRows.spec.ts`" — a file
 * that did not exist. Its predecessor `analysisHeroV17/rowRanking.ts` DID have
 * a 464-line spec; both were deleted together in `ae153fa1`. This file restores
 * the coverage against the CURRENT module.
 *
 * ## Binding discipline (CLAUDE.md traps 19, 13c)
 *
 * - Every row is located by its `key` (`risk-<fromId>`, `coverage-options`,
 *   `reflect-<i>`, `ready-brief`) or by an exact literal — NEVER by a value
 *   predicate such as `r => r.priority === 'Medium'`, which coverage AND
 *   reflect rows both satisfy.
 * - Ordering assertions assert the FULL key list, not the presence of one row.
 * - Every expectation below was derived by reading `rankActOnItRows.ts`, not
 *   ported blind from the predecessor spec. Where the current module no longer
 *   does what the predecessor did (the evidence-gap rows), the predecessor's
 *   assertions are replaced by a pin on the SUBTRACTION (§4) rather than
 *   dropped silently.
 *
 * ## Scope
 *
 * Pure data layer. This file says nothing about rendering, layout or
 * visibility (trap 3) — `analysisCockpit.mountPath.spec.tsx` carries that.
 */

import { describe, it, expect } from 'vitest'
import {
  isReadyToBrief,
  rankActOnItRows,
  splitActOnItRows,
} from '../rankActOnItRows'
import type { ActOnItRow } from '../types'
// §9b drives the REAL adapter, not a re-implementation of it: the field this
// section exists to protect was lost AT the adapter, so a chain test that stubs
// the adapter would not have caught the loss.
import { mapM2BiasFindings } from '../../../mapM2BiasFindings'
import type { ResultsSectionDataReturn } from '../../../useResultsSectionData'
import type {
  ConfidenceSectionData,
  DecisionResultData,
  EvidenceGapItem,
  OptionResult,
  RobustnessDisplayVerdict,
} from '../../../types'

// ── Fixture builder ─────────────────────────────────────────────────────────

interface FragileEdgeFixture {
  fromId: string
  fromLabel: string
}

interface DataOverrides {
  /** `confidence.topFragileEdge` — the primary fragile-edge source. */
  fragile?: FragileEdgeFixture
  /** `confidence.m1CoachingTopFragileEdge` — the `??` fallback source. */
  m1Fragile?: FragileEdgeFixture
  /** Number of options in `recommendation.allOptions` (default 2). */
  optionCount?: number
  /** `recommendation.recommendedOption` present (default true). */
  hasWinner?: boolean
  /** `recommendation.recommendationStability`. */
  stability?: number
  /** `recommendation.robustnessVerdict`. */
  robustnessVerdict?: RobustnessDisplayVerdict
  /** Number of entries in `confidence.topEvidenceGaps` (default 0). */
  gapCount?: number
  /** Explicit evidence-gap items (overrides `gapCount`). */
  gaps?: EvidenceGapItem[]
  /**
   * Omit `topEvidenceGaps` entirely so the `?? evidenceGaps` fallback branch
   * in `isReadyToBrief` is the one under test.
   */
  omitTopEvidenceGaps?: boolean
  /**
   * `confidence.m2BiasFindings`.
   *
   * `steps` / `estimatedMinutes` populate the re-homed `microIntervention`
   * payload (see §9). They are OPTIONAL and the builder attaches
   * `microIntervention` ONLY when at least one is supplied — mirroring
   * `mapM2BiasFindings`'s honest-absence contract, so a fixture that omits them
   * exercises the genuine "producer sent nothing" path rather than a
   * hand-built empty shell that path would never see.
   */
  bias?: Array<{
    type: string
    description: string
    steps?: string[]
    estimatedMinutes?: number
  }>
}

function makeGap(i: number): EvidenceGapItem {
  return {
    factorId: `fac_${i}`,
    factorLabel: `Factor ${i}`,
    confidence: 50,
    voi: 0.5,
    suggestion: 'Compare this estimate against recent data.',
    targetNodeId: `node_${i}`,
  } as EvidenceGapItem
}

function makeData(overrides: DataOverrides = {}): ResultsSectionDataReturn {
  const optionCount = overrides.optionCount ?? 2
  const options: OptionResult[] = Array.from({ length: optionCount }, (_, i) => ({
    id: `opt_${i}`,
    label: `Option ${i}`,
    winProbability: 0.5,
  } as unknown as OptionResult))

  const hasWinner = overrides.hasWinner ?? true

  const recommendation = {
    recommendedOption: hasWinner ? (options[0] ?? ({ id: 'opt_x', label: 'Option X' } as unknown as OptionResult)) : null,
    allOptions: options,
    goalLabel: 'Goal',
    isSingleOption: optionCount === 1,
    analysisStatus: 'computed',
    recommendationStability: overrides.stability,
    robustnessVerdict: overrides.robustnessVerdict,
  } as unknown as DecisionResultData

  const gaps =
    overrides.gaps ?? Array.from({ length: overrides.gapCount ?? 0 }, (_, i) => makeGap(i))

  const confidence = {
    tier: { tier: 'fair', icon: 'AlertTriangle', label: 'Fair', description: 'd' },
    qualityScore: 60,
    uncertainties: [],
    topUncertainties: [],
    improvements: [],
    topImprovements: [],
    evidenceGaps: gaps,
    ...(overrides.omitTopEvidenceGaps ? {} : { topEvidenceGaps: gaps }),
    nextActions: [],
    topNextActions: [],
    ...(overrides.fragile
      ? {
          topFragileEdge: {
            fromId: overrides.fragile.fromId,
            fromLabel: overrides.fragile.fromLabel,
            toId: 'node_outcome',
            toLabel: 'Outcome',
            alternativeWinnerLabel: 'Option 1',
            switchProbability: 0.42,
          },
        }
      : {}),
    ...(overrides.m1Fragile
      ? {
          m1CoachingTopFragileEdge: {
            fromId: overrides.m1Fragile.fromId,
            fromLabel: overrides.m1Fragile.fromLabel,
            toId: 'node_outcome',
            toLabel: 'Outcome',
            switchProbability: 0.42,
            alternativeWinnerLabel: 'Option 1',
          },
        }
      : {}),
    ...(overrides.bias
      ? {
          m2BiasFindings: overrides.bias.map(b => ({
            type: b.type,
            source: 'test',
            description: b.description,
            affectedElements: [],
            linkedCritiqueCode: '',
            // Attached only when the fixture asked for one — absent stays absent.
            ...(b.steps != null || b.estimatedMinutes != null
              ? {
                  microIntervention: {
                    steps: b.steps ?? [],
                    estimatedMinutes: b.estimatedMinutes ?? null,
                  },
                }
              : {}),
          })),
        }
      : {}),
  } as unknown as ConfidenceSectionData

  return {
    recommendation,
    drivers: {
      drivers: [],
      topDrivers: [],
      driversStatus: 'computed',
      totalCount: 0,
      hasMagnitudeData: false,
    },
    confidence,
    improvements: { improvements: [], count: 0, hasHighPriority: false },
    isLoading: false,
    isError: false,
    goalLabel: 'Goal',
    completeness: { status: 'full', missing: [], reasons: [] },
    autoNoiseProvenance: null,
  } as unknown as ResultsSectionDataReturn
}

/** Locate a row by its stable key — identity binding, never a value predicate. */
function rowByKey(rows: ActOnItRow[], key: string): ActOnItRow {
  const row = rows.find(r => r.key === key)
  expect(row, `expected a row with key "${key}"; got [${rows.map(r => r.key).join(', ')}]`).toBeTruthy()
  return row as ActOnItRow
}

const NOT_READY = { readyToBrief: false }
const READY = { readyToBrief: true }

// ── §1 Ordering / precedence contract ───────────────────────────────────────

describe('rankActOnItRows — §1 ordering + precedence', () => {
  it('emits risk → coverage → reflect in that exact order, by key', () => {
    const rows = rankActOnItRows(
      makeData({
        fragile: { fromId: 'n_fragile', fromLabel: 'Hiring rate' },
        optionCount: 1,
        bias: [
          { type: 'Anchoring', description: 'First figure is doing the work.' },
          { type: 'Sunk cost', description: 'Past spend is being defended.' },
        ],
      }),
      NOT_READY,
    )
    expect(rows.map(r => r.key)).toEqual([
      'risk-n_fragile',
      'coverage-options',
      'reflect-0',
      'reflect-1',
    ])
    expect(rows.map(r => r.category)).toEqual(['risk', 'coverage', 'reflect', 'reflect'])
  })

  it('fragile edge is always rank 1 when present', () => {
    const rows = rankActOnItRows(
      makeData({
        fragile: { fromId: 'n_f', fromLabel: 'Hiring rate' },
        bias: [{ type: 'Anchoring', description: 'd' }],
      }),
      NOT_READY,
    )
    expect(rows[0].key).toBe('risk-n_f')
    expect(rows[0].category).toBe('risk')
    // Verb-led title (locked 2026-05-21): risk → `Verify {raw label}`.
    expect(rows[0].title).toBe('Verify Hiring rate')
  })

  it('coverage precedes reflect when there is no fragile edge', () => {
    const rows = rankActOnItRows(
      makeData({
        optionCount: 1,
        bias: [{ type: 'Anchoring', description: 'd' }],
      }),
      NOT_READY,
    )
    expect(rows.map(r => r.key)).toEqual(['coverage-options', 'reflect-0'])
  })

  it('reflect rows keep the producer order of m2BiasFindings (index-keyed)', () => {
    const rows = rankActOnItRows(
      makeData({
        bias: [
          { type: 'Anchoring', description: 'a' },
          { type: 'Sunk cost', description: 'b' },
          { type: 'Outside view', description: 'c' },
        ],
      }),
      NOT_READY,
    )
    expect(rows.map(r => r.key)).toEqual(['reflect-0', 'reflect-1', 'reflect-2'])
    expect(rows.map(r => r.title)).toEqual([
      'Challenge Anchoring',
      'Challenge Sunk cost',
      'Challenge Outside view',
    ])
  })

  it('empty data set produces an empty row list', () => {
    expect(rankActOnItRows(makeData({}), NOT_READY)).toEqual([])
  })

  it('coverage row appears only for a single-option model, never at 2+ options', () => {
    const single = rankActOnItRows(makeData({ optionCount: 1 }), NOT_READY)
    expect(single.map(r => r.key)).toEqual(['coverage-options'])

    const zero = rankActOnItRows(makeData({ optionCount: 0, hasWinner: false }), NOT_READY)
    expect(zero.map(r => r.key)).toEqual(['coverage-options'])

    const two = rankActOnItRows(makeData({ optionCount: 2 }), NOT_READY)
    expect(two.find(r => r.key === 'coverage-options')).toBeUndefined()

    const three = rankActOnItRows(makeData({ optionCount: 3 }), NOT_READY)
    expect(three.find(r => r.key === 'coverage-options')).toBeUndefined()
  })

  it('topFragileEdge wins over m1CoachingTopFragileEdge; m1 is the fallback when topFragileEdge is absent', () => {
    // Both present → the row must be built from topFragileEdge (bound by id).
    const both = rankActOnItRows(
      makeData({
        fragile: { fromId: 'n_primary', fromLabel: 'Primary label' },
        m1Fragile: { fromId: 'n_m1', fromLabel: 'M1 label' },
      }),
      NOT_READY,
    )
    expect(both.map(r => r.key)).toEqual(['risk-n_primary'])
    expect(rowByKey(both, 'risk-n_primary').title).toBe('Verify Primary label')

    // Only m1 present → the fallback source builds the row.
    const fallback = rankActOnItRows(
      makeData({ m1Fragile: { fromId: 'n_m1', fromLabel: 'M1 label' } }),
      NOT_READY,
    )
    expect(fallback.map(r => r.key)).toEqual(['risk-n_m1'])
    expect(rowByKey(fallback, 'risk-n_m1').title).toBe('Verify M1 label')

    // Neither → no risk row at all.
    expect(rankActOnItRows(makeData({}), NOT_READY).some(r => r.category === 'risk')).toBe(false)
  })

  it('category is assigned from the SOURCE FIELD, never inferred from copy', () => {
    const rows = rankActOnItRows(
      makeData({
        fragile: { fromId: 'n_f', fromLabel: 'Hiring rate' },
        optionCount: 1,
        bias: [{ type: 'Sunk cost', description: 'd' }],
      }),
      NOT_READY,
    )
    expect(rowByKey(rows, 'risk-n_f').category).toBe('risk')
    expect(rowByKey(rows, 'coverage-options').category).toBe('coverage')
    expect(rowByKey(rows, 'reflect-0').category).toBe('reflect')
    // Titles are the verb-led forms for those same identities.
    expect(rowByKey(rows, 'risk-n_f').title).toBe('Verify Hiring rate')
    expect(rowByKey(rows, 'coverage-options').title).toBe('Add an alternative option')
    expect(rowByKey(rows, 'reflect-0').title).toBe('Challenge Sunk cost')
  })
})

// ── §2 Row shape per category ───────────────────────────────────────────────

describe('rankActOnItRows — §2 per-category row shape', () => {
  it('risk row: High band / width 100, target = fragile fromId, actions drop the Plus (add) icon', () => {
    const rows = rankActOnItRows(
      makeData({ fragile: { fromId: 'n_f', fromLabel: 'Hiring rate' } }),
      NOT_READY,
    )
    const risk = rowByKey(rows, 'risk-n_f')
    // bandFromVoi(0.6) — fragile edges are inherently high-priority.
    expect(risk.priority).toBe('High')
    expect(risk.priorityWidth).toBe(100)
    expect(risk.targetNodeId).toBe('n_f')
    expect(risk.actions).toEqual(['ai', 'discuss'])
    expect(risk.actions).not.toContain('add')
  })

  it('coverage row: Medium / 60, no target, keeps the add action, exact reason + chatPrompt literals', () => {
    const rows = rankActOnItRows(makeData({ optionCount: 1 }), NOT_READY)
    const coverage = rowByKey(rows, 'coverage-options')
    expect(coverage.priority).toBe('Medium')
    expect(coverage.priorityWidth).toBe(60)
    expect(coverage.targetNodeId).toBeUndefined()
    expect(coverage.actions).toEqual(['ai', 'discuss', 'add'])
    expect(coverage.actions).toContain('add')
    expect(coverage.reason).toBe('Add a comparable alternative to test a real trade-off.')
    expect(coverage.chatPrompt).toBe(
      'Help me identify a comparable alternative option to compare against.',
    )
    // No user data is interpolated into the coverage title.
    expect(coverage.title).toBe('Add an alternative option')
  })

  it('reflect row: Medium / 60, no target, challenge action, reason is the finding description', () => {
    const rows = rankActOnItRows(
      makeData({ bias: [{ type: 'Anchoring', description: 'Past spend mentioned in brief' }] }),
      NOT_READY,
    )
    const reflect = rowByKey(rows, 'reflect-0')
    expect(reflect.priority).toBe('Medium')
    expect(reflect.priorityWidth).toBe(60)
    expect(reflect.targetNodeId).toBeUndefined()
    expect(reflect.actions).toEqual(['ai', 'discuss', 'challenge'])
    expect(reflect.reason).toBe('Past spend mentioned in brief')
    expect(reflect.chatPrompt).toBe(
      'Help me with Anchoring. Ask one focused question first, then suggest the smallest useful update.',
    )
  })

  it('reflect row: description is trimmed, and a banned-term description is swapped for the generic reason', () => {
    const trimmed = rankActOnItRows(
      makeData({ bias: [{ type: 'Anchoring', description: '   Padded description.   ' }] }),
      NOT_READY,
    )
    expect(rowByKey(trimmed, 'reflect-0').reason).toBe('Padded description.')

    // 'recommendation' is on the canonical banned list (glossaryCheck.ts).
    const banned = rankActOnItRows(
      makeData({
        bias: [{ type: 'Anchoring', description: 'This could change the recommendation.' }],
      }),
      NOT_READY,
    )
    const row = rowByKey(banned, 'reflect-0')
    expect(row.reason).toBe(
      'Worth considering whether this pattern is influencing the framing.',
    )
    expect(row.reason).not.toContain('recommendation')
  })

  it('reflect row: an empty finding type falls back to "Reflective check" in title and prompt', () => {
    const rows = rankActOnItRows(
      makeData({ bias: [{ type: '', description: 'd' }] }),
      NOT_READY,
    )
    const row = rowByKey(rows, 'reflect-0')
    expect(row.title).toBe('Challenge Reflective check')
    expect(row.chatPrompt).toBe(
      'Help me with Reflective check. Ask one focused question first, then suggest the smallest useful update.',
    )
  })

  it('reflect row: a banned-term finding type is preserved in the TITLE but swapped in the generated prompt', () => {
    // The title preserves the producer/user string verbatim; only GENERATED
    // copy routes through the glossary fallback ('this reflective check').
    const rows = rankActOnItRows(
      makeData({ bias: [{ type: 'winning streak', description: 'd' }] }),
      NOT_READY,
    )
    const row = rowByKey(rows, 'reflect-0')
    expect(row.title).toBe('Challenge winning streak')
    expect(row.chatPrompt).toBe(
      'Help me with this reflective check. Ask one focused question first, then suggest the smallest useful update.',
    )
    expect(row.chatPrompt).not.toContain('winning')
  })

  it('every emitted row carries a non-empty chatPrompt', () => {
    const rows = rankActOnItRows(
      makeData({
        fragile: { fromId: 'n_f', fromLabel: 'Hiring rate' },
        optionCount: 1,
        bias: [{ type: 'Anchoring', description: 'd' }],
      }),
      NOT_READY,
    )
    expect(rows.map(r => r.key)).toEqual(['risk-n_f', 'coverage-options', 'reflect-0'])
    for (const row of rows) {
      expect(row.chatPrompt.trim().length, `row ${row.key} has an empty chatPrompt`).toBeGreaterThan(0)
    }
  })
})

// ── §3 Fragile/risk row copy (ported from rowRanking.spec.ts) ───────────────

describe('rankActOnItRows — §3 fragile/risk row copy', () => {
  it('names the factor explicitly, and never implies dominance', () => {
    const rows = rankActOnItRows(
      makeData({ fragile: { fromId: 'n_f', fromLabel: 'Hiring rate' } }),
      NOT_READY,
    )
    const risk = rowByKey(rows, 'risk-n_f')
    expect(risk.reason).toBe(
      'If the estimate changes for Hiring rate, the leading option could change.',
    )
    // Anti-drift on every prior copy + glossary regression.
    expect(risk.reason).not.toContain('Check this first')
    expect(risk.reason).not.toContain('evidence priority')
    expect(risk.reason).not.toContain('Highest-priority assumption')
    expect(risk.reason).not.toContain('Most likely to change')
    expect(risk.reason).not.toContain('If Hiring rate changes')
    expect(risk.reason).not.toContain('If the estimate for Hiring rate changes')
    expect(risk.reason).not.toMatch(/winner|winning|recommendation/i)
    // The fragility signal must not read as the dominance signal.
    expect(risk.reason.toLowerCase()).not.toContain('dominant')
    expect(risk.reason.toLowerCase()).not.toContain('most important')
    expect(risk.reason.toLowerCase()).not.toContain('main driver')
    expect(risk.reason.toLowerCase()).not.toContain('strongest')
  })

  it('falls back to "this factor" when the upstream label is empty or whitespace-only', () => {
    for (const label of ['', '   ']) {
      const rows = rankActOnItRows(
        makeData({ fragile: { fromId: 'n_f', fromLabel: label } }),
        NOT_READY,
      )
      const risk = rowByKey(rows, 'risk-n_f')
      expect(risk.reason).toBe(
        'If the estimate changes for this factor, the leading option could change.',
      )
      // Verb prefix never composes with an empty label ("Verify " + nothing).
      expect(risk.title).toBe('Verify this factor')
      expect(risk.title).not.toMatch(/Verify\s*$/)
    }
  })

  it('swaps a banned-term label for the generic fallback in generated copy, but keeps it verbatim in the title', () => {
    const rows = rankActOnItRows(
      makeData({ fragile: { fromId: 'n_f', fromLabel: 'the winning team' } }),
      NOT_READY,
    )
    const risk = rowByKey(rows, 'risk-n_f')
    expect(risk.reason).toBe(
      'If the estimate changes for this factor, the leading option could change.',
    )
    expect(risk.chatPrompt).toBe(
      'Help me with this factor. Ask one focused question first, then suggest the smallest useful update.',
    )
    // We never rewrite user data: the TITLE still carries the exact label.
    expect(risk.title).toBe('Verify the winning team')
  })

  it('is structurally free of "changes changes" / "shifts shifts" adjacency for labels ending in those verbs', () => {
    for (const label of ['hiring changes', 'salary shifts', 'weekly changes', 'changes']) {
      const rows = rankActOnItRows(
        makeData({ fragile: { fromId: 'n_x', fromLabel: label } }),
        NOT_READY,
      )
      const risk = rowByKey(rows, 'risk-n_x')
      expect(risk.reason).toBe(
        `If the estimate changes for ${label}, the leading option could change.`,
      )
      // The label appears verbatim — no silent truncation.
      expect(risk.reason).toContain(label)
      expect(risk.reason).not.toMatch(/changes\s+changes/)
      expect(risk.reason).not.toMatch(/shifts\s+shifts/)
    }
  })

  it('chatPrompt interpolates the RAW label, not the verb-led title', () => {
    const rows = rankActOnItRows(
      makeData({ fragile: { fromId: 'n_f', fromLabel: 'Hiring rate' } }),
      NOT_READY,
    )
    const risk = rowByKey(rows, 'risk-n_f')
    expect(risk.chatPrompt).toBe(
      'Help me with Hiring rate. Ask one focused question first, then suggest the smallest useful update.',
    )
    expect(risk.chatPrompt).not.toContain('Verify')
  })
})

// ── §4 The deliberate subtraction: evidence gaps own NO rows here ───────────

describe('rankActOnItRows — §4 evidence gaps produce NO rows (owned by the triage queue)', () => {
  // The predecessor `rowRanking.ts` emitted one `evidence` row per gap, sorted
  // by VOI descending, subject to a strict generic-suggestion filter. The
  // current module deletes that builder outright: the triage queue owns
  // evidence gaps because its card is the only host of the inline value
  // editor. Those predecessor assertions cannot be ported — this pins the
  // subtraction instead, so a re-introduction is a RED, not a silent
  // duplicate row.
  it('emits zero rows for evidence gaps regardless of suggestion quality', () => {
    const gaps: EvidenceGapItem[] = [
      { ...makeGap(1), voi: 0.9, suggestion: 'Pull last quarter capacity numbers from the tracker.' },
      { ...makeGap(2), voi: 0.5, suggestion: 'Gather data on "Factor 2" to reduce uncertainty' },
      { ...makeGap(3), voi: 0.1, suggestion: '' },
    ]
    const rows = rankActOnItRows(makeData({ gaps }), NOT_READY)
    expect(rows).toEqual([])
    expect(rows.some(r => r.category === 'evidence')).toBe(false)
  })

  it('gaps do not displace the rows this module DOES own', () => {
    const rows = rankActOnItRows(
      makeData({
        gapCount: 3,
        fragile: { fromId: 'n_f', fromLabel: 'Hiring rate' },
        bias: [{ type: 'Anchoring', description: 'd' }],
      }),
      NOT_READY,
    )
    expect(rows.map(r => r.key)).toEqual(['risk-n_f', 'reflect-0'])
  })
})

// ── §5 Ready-to-brief posture ───────────────────────────────────────────────

describe('rankActOnItRows — §5 readyToBrief posture', () => {
  it('returns the ready row first, with the Ready band and brief action', () => {
    const rows = rankActOnItRows(makeData({}), READY)
    expect(rows.map(r => r.key)).toEqual(['ready-brief'])
    const ready = rowByKey(rows, 'ready-brief')
    expect(ready.category).toBe('ready')
    expect(ready.priority).toBe('Ready')
    expect(ready.priorityWidth).toBe(100)
    expect(ready.title).toBe('Create decision brief')
    expect(ready.reason).toBe(
      'Capture the result, rationale, key assumptions and caveats before sharing.',
    )
    expect(ready.actions).toEqual(['ai', 'discuss', 'brief'])
    expect(ready.targetNodeId).toBeUndefined()
    expect(ready.chatPrompt).toBe(
      'Help me capture the result, rationale, key assumptions and caveats as a decision brief.',
    )
  })

  it('suppresses the risk and coverage rows even when their sources are present', () => {
    const data = makeData({
      fragile: { fromId: 'n_f', fromLabel: 'Hiring rate' },
      optionCount: 1,
      bias: [{ type: 'Anchoring', description: 'd' }],
    })
    // Control: the same data on the NOT-ready posture does emit both.
    expect(rankActOnItRows(data, NOT_READY).map(r => r.key)).toEqual([
      'risk-n_f',
      'coverage-options',
      'reflect-0',
    ])
    expect(rankActOnItRows(data, READY).map(r => r.key)).toEqual(['ready-brief', 'reflect-0'])
  })

  it('caps the reflective rows at two, keeping the first two by producer order', () => {
    const rows = rankActOnItRows(
      makeData({
        bias: [
          { type: 'Anchoring', description: 'a' },
          { type: 'Sunk cost', description: 'b' },
          { type: 'Outside view', description: 'c' },
          { type: 'Overconfidence', description: 'd' },
        ],
      }),
      READY,
    )
    expect(rows.map(r => r.key)).toEqual(['ready-brief', 'reflect-0', 'reflect-1'])
    expect(rows.map(r => r.title)).toEqual([
      'Create decision brief',
      'Challenge Anchoring',
      'Challenge Sunk cost',
    ])
  })
})

// ── §6 isReadyToBrief — equivalence with the retired selectHeroState ────────

/**
 * VERBATIM copy of the DELETED `analysisHeroV17/stateSelection.ts`
 * (`git show ae153fa1^:src/components/results/analysisHeroV17/stateSelection.ts`).
 *
 * This WAS a pure equivalence oracle: the module's header claimed
 * `isReadyToBrief` is EXACTLY `selectHeroState(...) === 'strong'`.
 *
 * ⚠ ROADMAP 2.1228 — IT IS NOW AN EQUIVALENCE *EXCEPT AN EXACTLY-PINNED
 * DIVERGENCE SET*, AND THE DIVERGENCE IS THE FIX. The legacy selector required
 * `stability >= 0.85` — a UI-INVENTED cliff on a bare 0-1 float. That conjunct
 * is retired; the producer's display-safe `robustnessVerdict` is now the only
 * trust authority. So the two predicates deliberately disagree on exactly the
 * rows the cliff used to block, and nowhere else.
 *
 * The oracle is KEPT rather than deleted precisely because that is the claim
 * worth pinning: `LEGACY_DIVERGENCE_ROWS` below REDs if the divergence GROWS
 * (some other conjunct was relaxed) or SHRINKS (the cliff came back). Deleting
 * the oracle would have made the blast radius of this change unobservable.
 */
type LegacyHeroState = 'weak' | 'moderate' | 'reflect' | 'strong'

interface LegacyInputs {
  hasWinner: boolean
  decisionState: 'robust' | 'sensitive' | 'indeterminate'
  stability: number | null
  evidenceGapCount: number
  fragileEdgeCount: number
  optionCount: number
  biasFindings: number
  framingFlag: boolean
  robustnessVerdict?: RobustnessDisplayVerdict | null
}

function selectHeroState(input: LegacyInputs): LegacyHeroState {
  const {
    hasWinner,
    decisionState,
    stability,
    evidenceGapCount,
    fragileEdgeCount,
    optionCount,
    biasFindings,
    framingFlag,
    robustnessVerdict,
  } = input

  if (!hasWinner) return 'weak'
  if (stability !== null && stability < 0.5 && evidenceGapCount >= 3) return 'weak'
  if (evidenceGapCount >= 4) return 'weak'
  if (optionCount < 2) return 'weak'

  if (
    robustnessVerdict === 'robust' &&
    stability !== null && stability >= 0.85 &&
    evidenceGapCount <= 1 && fragileEdgeCount === 0
  ) {
    return 'strong'
  }

  if (decisionState === 'robust' && (biasFindings >= 1 || framingFlag)) {
    return 'reflect'
  }

  return 'moderate'
}

function legacyBase(overrides: Partial<LegacyInputs> = {}): LegacyInputs {
  return {
    hasWinner: true,
    decisionState: 'robust',
    stability: 0.9,
    evidenceGapCount: 0,
    fragileEdgeCount: 0,
    optionCount: 3,
    biasFindings: 0,
    framingFlag: false,
    ...overrides,
  }
}

/** Project a legacy input row onto the data shape `isReadyToBrief` reads. */
function dataFromLegacy(input: LegacyInputs): ResultsSectionDataReturn {
  return makeData({
    hasWinner: input.hasWinner,
    optionCount: input.optionCount,
    // The data type carries `recommendationStability?: number`; the legacy
    // selector's `null` is that field's absence.
    stability: input.stability === null ? undefined : input.stability,
    robustnessVerdict: input.robustnessVerdict ?? undefined,
    gapCount: input.evidenceGapCount,
  })
}

describe('isReadyToBrief — §6 equivalence with selectHeroState(...) === "strong"', () => {
  /**
   * The original selector's own spec table
   * (`analysisHeroV17/__tests__/stateSelection.spec.ts`), plus the boundary
   * rows that discriminate the dropped weak guards. Each row is checked BOTH
   * ways: the oracle's verdict, and `isReadyToBrief`'s.
   *
   * ⚠ Scope: finite stability values and absence only. The pre-2.1228
   * `isReadyToBrief` required `Number.isFinite(stability)` where the legacy
   * selector accepted `Infinity` as "strong"; that divergence is out of this
   * table's scope by construction and is now moot in any case — the predicate
   * no longer reads stability at all, so no stability value can move it.
   */
  const table: Array<{ name: string; input: LegacyInputs }> = [
    // WEAK branch
    { name: 'no winner', input: legacyBase({ hasWinner: false }) },
    { name: 'low stability AND 3 gaps', input: legacyBase({ stability: 0.4, evidenceGapCount: 3 }) },
    { name: 'stability 0.49 AND exactly 3 gaps', input: legacyBase({ stability: 0.49, evidenceGapCount: 3 }) },
    { name: '4 gaps regardless of stability', input: legacyBase({ stability: 0.9, evidenceGapCount: 4 }) },
    { name: 'single option', input: legacyBase({ optionCount: 1 }) },
    { name: 'zero options', input: legacyBase({ optionCount: 0 }) },
    // STRONG branch
    { name: 'high stability + no gaps + no fragile + verdict robust', input: legacyBase({ stability: 0.9, evidenceGapCount: 0, fragileEdgeCount: 0, robustnessVerdict: 'robust' }) },
    { name: 'boundary: stability exactly 0.85 + 1 gap + verdict robust', input: legacyBase({ stability: 0.85, evidenceGapCount: 1, fragileEdgeCount: 0, robustnessVerdict: 'robust' }) },
    { name: 'boundary: stability 0.849 + verdict robust', input: legacyBase({ stability: 0.849, evidenceGapCount: 0, robustnessVerdict: 'robust' }) },
    { name: 'one fragile edge breaks strong', input: legacyBase({ stability: 0.9, evidenceGapCount: 0, fragileEdgeCount: 1, robustnessVerdict: 'robust' }) },
    { name: '2 gaps breaks strong', input: legacyBase({ stability: 0.9, evidenceGapCount: 2, robustnessVerdict: 'robust' }) },
    // STRONG requires the display-safe verdict
    { name: 'no verdict at all', input: legacyBase({ stability: 0.95, evidenceGapCount: 0, fragileEdgeCount: 0, robustnessVerdict: undefined, decisionState: 'sensitive' }) },
    { name: 'verdict moderate', input: legacyBase({ stability: 0.95, robustnessVerdict: 'moderate', decisionState: 'sensitive' }) },
    { name: 'verdict fragile', input: legacyBase({ stability: 0.95, robustnessVerdict: 'fragile', decisionState: 'sensitive' }) },
    { name: 'verdict not_assessed', input: legacyBase({ stability: 0.95, robustnessVerdict: 'not_assessed', decisionState: 'sensitive' }) },
    { name: 'verdict explicitly null', input: legacyBase({ stability: 0.95, robustnessVerdict: null, decisionState: 'sensitive' }) },
    // REFLECT / MODERATE branches
    { name: 'robust + bias findings, mid stability', input: legacyBase({ decisionState: 'robust', biasFindings: 1, stability: 0.7 }) },
    { name: 'robust + framing flag, mid stability', input: legacyBase({ decisionState: 'robust', framingFlag: true, stability: 0.7 }) },
    { name: 'sensitive + bias findings', input: legacyBase({ decisionState: 'sensitive', biasFindings: 2, stability: 0.7 }) },
    { name: 'indeterminate + bias findings', input: legacyBase({ decisionState: 'indeterminate', biasFindings: 1, stability: 0.7 }) },
    { name: 'reflect signals that would also satisfy strong', input: legacyBase({ decisionState: 'robust', biasFindings: 1, stability: 0.9, evidenceGapCount: 0, fragileEdgeCount: 0, robustnessVerdict: 'robust' }) },
    { name: 'default mid-range', input: legacyBase({ stability: 0.6, evidenceGapCount: 2 }) },
    { name: 'sensitive without weak triggers', input: legacyBase({ decisionState: 'sensitive', stability: 0.7, evidenceGapCount: 1 }) },
    // Absent stability
    { name: 'absent stability + 4 gaps', input: legacyBase({ stability: null, evidenceGapCount: 4 }) },
    { name: 'absent stability + 3 gaps', input: legacyBase({ stability: null, evidenceGapCount: 3 }) },
    { name: 'absent stability + verdict robust + clean signals', input: legacyBase({ stability: null, evidenceGapCount: 0, fragileEdgeCount: 0, robustnessVerdict: 'robust' }) },
    // The two dropped weak guards, isolated: each would have fired in the
    // legacy selector but is entailed by (stability >= 0.85 AND gaps <= 1).
    { name: 'weak guard 2 boundary: stability 0.5 + 3 gaps + verdict robust', input: legacyBase({ stability: 0.5, evidenceGapCount: 3, robustnessVerdict: 'robust' }) },
    { name: 'weak guard 3 boundary: 4 gaps + high stability + verdict robust', input: legacyBase({ stability: 0.9, evidenceGapCount: 4, robustnessVerdict: 'robust' }) },
    { name: 'weak guard 4 boundary: 2 options + verdict robust', input: legacyBase({ optionCount: 2, stability: 0.9, robustnessVerdict: 'robust' }) },
  ]

  /**
   * THE EXACT SET OF ROWS ON WHICH THE RETIRED CLIFF USED TO CHANGE THE ANSWER.
   *
   * Both rows satisfy every conjunct that survives 2.1228 — a recommended
   * option, ≥2 options, producer verdict `robust`, ≤1 evidence gap, zero
   * fragile edges — and the legacy selector still returned non-strong, for one
   * reason only: `stability >= 0.85` failed.
   *
   *   · `stability 0.849` — the arbitrary cliff, one thousandth below.
   *   · `absent stability` — ⭐ THE LIVE SHAPE. PLoT DELIBERATELY WITHHOLDS
   *     `robustness.recommendation_stability` from the /v2/run wire
   *     (`src/routes/v2/run.ts:3266-3277`, lane PLoT-H item B, 2026-07-07: it
   *     is the leader's `win_probability` relabelled, "zero independent
   *     information", and the UI printing it was "a fabricated second
   *     statistic"). So on every fresh run the field is undefined and the
   *     legacy cliff could never be met — the ready-to-brief row was DARK.
   *     This row is the un-darkening.
   */
  const LEGACY_DIVERGENCE_ROWS: readonly string[] = [
    'absent stability + verdict robust + clean signals',
    'boundary: stability 0.849 + verdict robust',
  ]

  it.each(table)('agrees with the legacy selector except where pinned: $name', ({ name, input }) => {
    const legacyStrong = selectHeroState(input) === 'strong'
    const actual = isReadyToBrief(dataFromLegacy(input), input.fragileEdgeCount)
    if (LEGACY_DIVERGENCE_ROWS.includes(name)) {
      // Pinned divergence, and it is PERMISSIVE-ONLY BY ASSERTION: the legacy
      // cliff blocked, the producer verdict licenses. Asserting both halves
      // (not just `!==`) is what stops a future regression that diverges in the
      // other direction — blocking a run the legacy selector allowed — from
      // passing here as "still diverging".
      expect(legacyStrong, `${name}: legacy must have BLOCKED this row`).toBe(false)
      expect(actual, `${name}: the producer verdict must now license it`).toBe(true)
      return
    }
    expect(actual).toBe(legacyStrong)
  })

  /**
   * THE BIDIRECTIONAL PIN — the load-bearing guard of ROADMAP 2.1228.
   *
   * Same discipline as the hygiene known-gap set: a GROWN divergence means a
   * conjunct was relaxed that nobody licensed (most dangerously
   * `robustnessVerdict === 'robust'`, which is LOAD-BEARING per
   * ROBUSTNESS-VERDICT-CONTRACT); a SHRUNK divergence means the UI-invented
   * cliff was reintroduced. Either way this REDs, and neither is fixable by
   * editing the list.
   */
  it('the divergence from the legacy selector is EXACTLY the pinned stability-cliff set', () => {
    const diverged = table
      .filter(
        ({ input }) =>
          (selectHeroState(input) === 'strong') !==
          isReadyToBrief(dataFromLegacy(input), input.fragileEdgeCount),
      )
      .map(({ name }) => name)
      .sort()
    expect(
      diverged,
      'divergence from the legacy selector drifted: a GROWN set means a conjunct ' +
        'was relaxed beyond the retired stability cliff, a SHRUNK set means the ' +
        'cliff is back. Do not edit the pin to match reality.',
    ).toEqual([...LEGACY_DIVERGENCE_ROWS].sort())
  })

  /**
   * PIN THE CAUSE, NOT JUST THE COUNT (trap 13b — a discriminator must pin its
   * own precondition in-test). Without this, the divergence set could stay the
   * right SIZE while its members diverged for an unrelated reason.
   */
  it.each(LEGACY_DIVERGENCE_ROWS)('%s diverges because of the cliff and nothing else', (name) => {
    const row = table.find((r) => r.name === name)
    expect(row, `divergence row "${name}" is not in the table`).toBeDefined()
    const input = row!.input
    // The retired conjunct is the ONLY one that fails on this row...
    expect(input.stability === null || input.stability < 0.85).toBe(true)
    // ...and every surviving conjunct is satisfied, so the row genuinely
    // isolates the cliff.
    expect(input.hasWinner).toBe(true)
    expect(input.optionCount).toBeGreaterThanOrEqual(2)
    expect(input.robustnessVerdict).toBe('robust')
    expect(input.evidenceGapCount).toBeLessThanOrEqual(1)
    expect(input.fragileEdgeCount).toBe(0)
  })

  it('the table discriminates — it contains BOTH strong and non-strong rows', () => {
    // Without this, a predicate stuck at `false` would pass every row above
    // (trap 13: an absence assertion needs a positive control).
    const verdicts = table.map(({ input }) => selectHeroState(input) === 'strong')
    expect(verdicts.filter(Boolean).length).toBeGreaterThanOrEqual(3)
    expect(verdicts.filter(v => !v).length).toBeGreaterThanOrEqual(10)
  })
})

// ── §7 isReadyToBrief — boundaries derived from the implementation ──────────

describe('isReadyToBrief — §7 conjunct-by-conjunct', () => {
  /**
   * Every conjunct satisfied — the one TRUE baseline the negatives vary from.
   *
   * ⭐ ROADMAP 2.1228: `stability` is deliberately ABSENT here, because that is
   * the shape the producer actually ships. PLoT withholds
   * `robustness.recommendation_stability` from /v2/run, so a fresh run reaches
   * this predicate with the field undefined. The baseline is now the live shape
   * rather than a fixture-only one (trap 16-inverse: a fixture you wrote
   * yourself is not evidence about the wire — so the baseline is pinned to what
   * the wire carries).
   */
  const readyOverrides: DataOverrides = {
    hasWinner: true,
    optionCount: 2,
    robustnessVerdict: 'robust',
    gapCount: 1,
  }

  it('positive control: the fully-satisfied fixture is ready to brief', () => {
    expect(isReadyToBrief(makeData(readyOverrides), 0)).toBe(true)
  })

  it('requires a recommended option', () => {
    expect(isReadyToBrief(makeData({ ...readyOverrides, hasWinner: false }), 0)).toBe(false)
  })

  it('requires at least two options', () => {
    expect(isReadyToBrief(makeData({ ...readyOverrides, optionCount: 1 }), 0)).toBe(false)
    expect(isReadyToBrief(makeData({ ...readyOverrides, optionCount: 2 }), 0)).toBe(true)
  })

  it('requires robustnessVerdict === "robust" — no other token, and never absence', () => {
    for (const verdict of ['moderate', 'fragile', 'not_assessed'] as const) {
      expect(
        isReadyToBrief(makeData({ ...readyOverrides, robustnessVerdict: verdict }), 0),
        `verdict "${verdict}" must not unlock ready-to-brief`,
      ).toBe(false)
    }
    expect(
      isReadyToBrief(makeData({ ...readyOverrides, robustnessVerdict: undefined }), 0),
    ).toBe(false)
  })

  /**
   * ROADMAP 2.1228 — REPLACES two retired tests:
   *   · `requires stability >= 0.85 — 0.85 passes, 0.849 does not`
   *   · `rejects an absent or non-finite stability rather than treating it as high`
   *
   * Both encoded the UI-INVENTED cliff as the specification. They are not
   * "fixed" by moving the number: the predicate must not consult the field at
   * all, so the assertion is written against the SPEC (the producer's
   * display-safe verdict is the single trust authority) rather than against the
   * failure mode (trap 13d).
   *
   * NOTE the value list spans the whole domain the type admits AND the domain it
   * does not — including the values whose special-casing the old guard existed
   * for (absent / NaN / ±Infinity). A corpus that omitted them could not certify
   * that no residual stability branch survives (trap 13d(c): check what the
   * corpus EXCLUDES).
   */
  it('ignores recommendationStability entirely — no value of it can move the verdict', () => {
    const everyStability = [
      undefined,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      -1,
      0,
      0.1,
      0.5,
      0.699,
      0.7,
      0.8,
      0.849,
      0.85,
      1,
      42,
    ]
    for (const stability of everyStability) {
      expect(
        isReadyToBrief(makeData({ ...readyOverrides, stability }), 0),
        `stability ${String(stability)} must not change the answer — the producer ` +
          'verdict is the only trust authority',
      ).toBe(true)
    }
  })

  /**
   * THE OPPOSITE-DIRECTION TWIN (trap 22b): retiring the cliff must not have
   * relaxed anything else. Every case here runs at the LIVE shape — stability
   * absent, exactly as the producer ships it — because that is the shape in
   * which a residual "no stability means unknown, so allow it" bug would hide.
   *
   * Each case CAN fail: at the pinned fix each is a genuine false, and flipping
   * the corresponding conjunct in the source turns it red (proved by the mutant
   * kit, not asserted here).
   */
  it('retiring the cliff relaxed nothing else — every other guard still bites at the live shape', () => {
    const live = { ...readyOverrides, stability: undefined }
    // The producer verdict remains load-bearing (ROBUSTNESS-VERDICT-CONTRACT):
    for (const verdict of ['moderate', 'fragile', 'not_assessed'] as const) {
      expect(
        isReadyToBrief(makeData({ ...live, robustnessVerdict: verdict }), 0),
        `verdict "${verdict}" must not brief`,
      ).toBe(false)
    }
    expect(isReadyToBrief(makeData({ ...live, robustnessVerdict: undefined }), 0)).toBe(false)
    // Edge fragility is an INDEPENDENT measurement from recommendation
    // stability (ISL: "fragile_edges is a separate indicator of edge-level
    // sensitivity", and is_robust=true can co-occur with fragile edges), so
    // this guard is doing work the verdict does not do:
    expect(isReadyToBrief(makeData(live), 1)).toBe(false)
    expect(isReadyToBrief(makeData(live), Number.NaN)).toBe(false)
    // Evidence-gap and option-count guards:
    expect(isReadyToBrief(makeData({ ...live, gapCount: 2 }), 0)).toBe(false)
    expect(isReadyToBrief(makeData({ ...live, optionCount: 1 }), 0)).toBe(false)
    expect(isReadyToBrief(makeData({ ...live, hasWinner: false }), 0)).toBe(false)
  })

  it('allows at most one evidence gap', () => {
    expect(isReadyToBrief(makeData({ ...readyOverrides, gapCount: 0 }), 0)).toBe(true)
    expect(isReadyToBrief(makeData({ ...readyOverrides, gapCount: 1 }), 0)).toBe(true)
    expect(isReadyToBrief(makeData({ ...readyOverrides, gapCount: 2 }), 0)).toBe(false)
  })

  it('falls back to confidence.evidenceGaps when topEvidenceGaps is absent', () => {
    // topEvidenceGaps omitted entirely → the `??` chain reads evidenceGaps.
    expect(
      isReadyToBrief(
        makeData({ ...readyOverrides, gapCount: 2, omitTopEvidenceGaps: true }),
        0,
      ),
    ).toBe(false)
    expect(
      isReadyToBrief(
        makeData({ ...readyOverrides, gapCount: 1, omitTopEvidenceGaps: true }),
        0,
      ),
    ).toBe(true)
  })

  it('requires exactly zero fragile edges, and an ABSENT count (NaN) is never zero', () => {
    expect(isReadyToBrief(makeData(readyOverrides), 0)).toBe(true)
    expect(isReadyToBrief(makeData(readyOverrides), 1)).toBe(false)
    // AnalysisHeroContainer passes `fragileEdgeCount ?? Number.NaN` precisely
    // so a caller that forgets to thread the count gets the conservative answer.
    expect(isReadyToBrief(makeData(readyOverrides), Number.NaN)).toBe(false)
  })

  /**
   * ⭐ THE UN-DARKENING, AT THE ROW RATHER THAN THE PREDICATE.
   *
   * A true predicate is not a user-visible row. This walks the same composition
   * `AnalysisHeroContainer.tsx:102` walks — `rankActOnItRows(data, { readyToBrief:
   * isReadyToBrief(data, fragile) })` — on the shape the producer actually
   * emits, and binds to the row BY KEY (identity, never a value predicate
   * another row could satisfy — trap 19).
   *
   * Before 2.1228 this could not have passed on this fixture at any stability
   * value, because the producer does not send one.
   */
  it('the producer-shaped fresh run reaches the ready-to-brief ROW, not just the predicate', () => {
    const data = makeData({ ...readyOverrides, stability: undefined })
    const rows = rankActOnItRows(data, { readyToBrief: isReadyToBrief(data, 0) })
    expect(rows.map((r) => r.key)).toContain('ready-brief')
    const ready = rows.find((r) => r.key === 'ready-brief')!
    expect(ready.category).toBe('ready')
    expect(ready.priority).toBe('Ready')
  })
})

// ── §8 splitActOnItRows ─────────────────────────────────────────────────────

describe('splitActOnItRows — §8 visible/hidden split', () => {
  it('shows the first three, hides rows 4-6, and suppresses everything beyond six', () => {
    const rows = rankActOnItRows(
      makeData({
        bias: Array.from({ length: 8 }, (_, i) => ({
          type: `Bias ${i}`,
          description: `d${i}`,
        })),
      }),
      NOT_READY,
    )
    expect(rows.map(r => r.key)).toEqual([
      'reflect-0', 'reflect-1', 'reflect-2', 'reflect-3',
      'reflect-4', 'reflect-5', 'reflect-6', 'reflect-7',
    ])

    const { visible, hidden } = splitActOnItRows(rows)
    expect(visible.map(r => r.key)).toEqual(['reflect-0', 'reflect-1', 'reflect-2'])
    expect(hidden.map(r => r.key)).toEqual(['reflect-3', 'reflect-4', 'reflect-5'])
    // Rows 7 and 8 are suppressed entirely — in neither bucket.
    for (const key of ['reflect-6', 'reflect-7']) {
      expect(visible.some(r => r.key === key), `${key} must not be visible`).toBe(false)
      expect(hidden.some(r => r.key === key), `${key} must not be hidden-but-present`).toBe(false)
    }
  })

  it('handles short lists: fewer than three rows are all visible, none hidden', () => {
    const rows = rankActOnItRows(
      makeData({
        fragile: { fromId: 'n_f', fromLabel: 'Hiring rate' },
        bias: [{ type: 'Anchoring', description: 'd' }],
      }),
      NOT_READY,
    )
    const { visible, hidden } = splitActOnItRows(rows)
    expect(visible.map(r => r.key)).toEqual(['risk-n_f', 'reflect-0'])
    expect(hidden).toEqual([])
  })

  it('an empty row list splits into two empty buckets', () => {
    const { visible, hidden } = splitActOnItRows([])
    expect(visible).toEqual([])
    expect(hidden).toEqual([])
  })
})

// ── §9 Micro-intervention: the steps + estimate RE-HOMED from V7BiasSection ──
//
// `components/results/v7/V7BiasSection.tsx` (deleted; preserved at `ca8cb0c1`)
// was the ONLY surface in the product that rendered a bias finding's
// `micro_intervention.steps` and its "About N min" estimate. Its retirement
// dropped both — and the drop was at the ADAPTER, not the renderer: the
// `m2BiasFindings` mapping projected five fields and discarded the rest.
//
// So this section deliberately tests the CHAIN, not just the row builder. The
// §9b cases feed a RAW PRODUCER-SHAPED finding through the real
// `mapM2BiasFindings` before ranking, because a row-level fixture alone would
// keep passing if the adapter went back to discarding the field — which is
// exactly how the capability was lost the first time.
describe('rankActOnItRows — §9 micro-intervention steps + effort estimate', () => {
  // ── §9a row level: what reflectRows does with a mapped finding ────────────

  it('§9a a reflect row carries the producer steps, in producer order, verbatim', () => {
    const rows = rankActOnItRows(
      makeData({
        bias: [
          {
            type: 'Sunk cost',
            description: 'Past spend is shaping the preference.',
            steps: [
              'List the choice ignoring money already spent.',
              'Ask what you would advise a colleague starting today.',
            ],
          },
        ],
      }),
      NOT_READY,
    )
    // Identity binding: located by key, never by "the row that has steps".
    expect(rowByKey(rows, 'reflect-0').steps).toEqual([
      'List the choice ignoring money already spent.',
      'Ask what you would advise a colleague starting today.',
    ])
  })

  it('§9a the producer effort estimate reaches the row unchanged', () => {
    const rows = rankActOnItRows(
      makeData({ bias: [{ type: 'Anchoring', description: 'd', steps: ['Re-anchor.'], estimatedMinutes: 7 }] }),
      NOT_READY,
    )
    expect(rowByKey(rows, 'reflect-0').estimatedMinutes).toBe(7)
  })

  it('§9a HONEST ABSENCE: a finding with no micro-intervention yields [] and null, never a default', () => {
    const rows = rankActOnItRows(
      makeData({ bias: [{ type: 'Anchoring', description: 'First figure is doing the work.' }] }),
      NOT_READY,
    )
    const reflect = rowByKey(rows, 'reflect-0')
    expect(reflect.steps).toEqual([])
    expect(reflect.estimatedMinutes).toBeNull()
    // The rest of the row is unaffected — absence of an intervention is not
    // absence of the finding.
    expect(reflect.reason).toBe('First figure is doing the work.')
  })

  it('§9a steps without an estimate carry no invented duration', () => {
    const rows = rankActOnItRows(
      makeData({ bias: [{ type: 'Outside view', description: 'd', steps: ['Find three comparators.'] }] }),
      NOT_READY,
    )
    const reflect = rowByKey(rows, 'reflect-0')
    expect(reflect.steps).toEqual(['Find three comparators.'])
    expect(reflect.estimatedMinutes).toBeNull()
  })

  it('§9a an estimate without steps is carried alone, and invents no steps', () => {
    const rows = rankActOnItRows(
      makeData({ bias: [{ type: 'Anchoring', description: 'd', estimatedMinutes: 3 }] }),
      NOT_READY,
    )
    const reflect = rowByKey(rows, 'reflect-0')
    expect(reflect.steps).toEqual([])
    expect(reflect.estimatedMinutes).toBe(3)
  })

  it('§9a each reflect row carries ITS OWN intervention, bound by key', () => {
    // The discriminator: two findings, only the SECOND has an intervention. A
    // renderer or builder that leaked one row's steps onto another (or hoisted
    // "the findings that have steps") passes every single-row case above and
    // fails here.
    const rows = rankActOnItRows(
      makeData({
        bias: [
          { type: 'Anchoring', description: 'no intervention here' },
          { type: 'Sunk cost', description: 'has one', steps: ['Ignore spent money.'], estimatedMinutes: 5 },
        ],
      }),
      NOT_READY,
    )
    expect(rowByKey(rows, 'reflect-0').steps).toEqual([])
    expect(rowByKey(rows, 'reflect-0').estimatedMinutes).toBeNull()
    expect(rowByKey(rows, 'reflect-1').steps).toEqual(['Ignore spent money.'])
    expect(rowByKey(rows, 'reflect-1').estimatedMinutes).toBe(5)
  })

  it('§9a no NON-reflect row claims an intervention (risk, coverage and ready state their absence)', () => {
    const notReady = rankActOnItRows(
      makeData({ fragile: { fromId: 'n_f', fromLabel: 'Hiring rate' }, optionCount: 1 }),
      NOT_READY,
    )
    for (const key of ['risk-n_f', 'coverage-options']) {
      expect(rowByKey(notReady, key).steps, key).toEqual([])
      expect(rowByKey(notReady, key).estimatedMinutes, key).toBeNull()
    }
    const ready = rankActOnItRows(makeData({}), READY)
    expect(rowByKey(ready, 'ready-brief').steps).toEqual([])
    expect(rowByKey(ready, 'ready-brief').estimatedMinutes).toBeNull()
  })

  // ── §9b chain level: RAW PRODUCER SHAPE → mapM2BiasFindings → rows ────────
  //
  // Producer field path, traced at the bytes (see `mapM2BiasFindings.ts`):
  //   V2RunResponse.m1_review.bias_findings[] → mapM2BiasFindings →
  //   confidence.m2BiasFindings[].microIntervention → reflectRows.

  /** Rank rows from RAW producer findings, through the real adapter. */
  function rankFromRaw(rawFindings: unknown[]): ActOnItRow[] {
    const data = makeData({})
    ;(data.confidence as { m2BiasFindings?: unknown }).m2BiasFindings =
      mapM2BiasFindings(rawFindings)
    return rankActOnItRows(data, NOT_READY)
  }

  it('§9b the whole chain carries string steps + estimated_minutes from the wire shape', () => {
    const rows = rankFromRaw([
      {
        type: 'SUNK_COST',
        description: 'Past spend is shaping the preference more than the outcome does.',
        micro_intervention: {
          steps: ['List the choice ignoring money already spent.', 'Ask a colleague to restate it.'],
          estimated_minutes: 5,
        },
      },
    ])
    const reflect = rowByKey(rows, 'reflect-0')
    expect(reflect.steps).toEqual([
      'List the choice ignoring money already spent.',
      'Ask a colleague to restate it.',
    ])
    expect(reflect.estimatedMinutes).toBe(5)
  })

  it('§9b the chain also reads the `{ text }` step-object wire shape', () => {
    // Both shapes appear on the wire — `buildV7Bias.ts` handled both, and the
    // pre-analysis reader (`PreAnalysisPanel.tsx:365`) reads `steps[0].text`.
    const rows = rankFromRaw([
      {
        type: 'ANCHORING_RISK',
        description: 'd',
        micro_intervention: { steps: [{ text: 'Re-estimate from a blank sheet.' }] },
      },
    ])
    expect(rowByKey(rows, 'reflect-0').steps).toEqual(['Re-estimate from a blank sheet.'])
  })

  it('§9b the chain falls back to a finding-root estimated_minutes', () => {
    // `buildV7Bias.ts` read `micro.estimated_minutes ?? f.estimated_minutes`;
    // the same two locations, in the same order.
    const rows = rankFromRaw([
      { type: 'ANCHORING_RISK', description: 'd', estimated_minutes: 9, micro_intervention: { steps: ['s'] } },
    ])
    expect(rowByKey(rows, 'reflect-0').estimatedMinutes).toBe(9)
    // …and the intervention's own value WINS when both are present.
    const both = rankFromRaw([
      {
        type: 'ANCHORING_RISK',
        description: 'd',
        estimated_minutes: 9,
        micro_intervention: { steps: ['s'], estimated_minutes: 2 },
      },
    ])
    expect(rowByKey(both, 'reflect-0').estimatedMinutes).toBe(2)
  })

  it('§9b the chain drops unusable steps rather than rendering blanks, and invents nothing', () => {
    const rows = rankFromRaw([
      {
        type: 'ANCHORING_RISK',
        description: 'd',
        micro_intervention: { steps: ['  ', '', { text: '   ' }, 42, null, 'Keep this one.'] },
      },
    ])
    expect(rowByKey(rows, 'reflect-0').steps).toEqual(['Keep this one.'])
  })

  it('§9b a producer finding with NO micro_intervention reaches the row as absent', () => {
    const rows = rankFromRaw([{ type: 'ANCHORING_RISK', description: 'First figure is doing the work.' }])
    const reflect = rowByKey(rows, 'reflect-0')
    expect(reflect.steps).toEqual([])
    expect(reflect.estimatedMinutes).toBeNull()
  })

  it('§9b a non-finite estimate is not a number the product will show', () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, '5', null]) {
      const rows = rankFromRaw([
        { type: 'ANCHORING_RISK', description: 'd', micro_intervention: { steps: ['s'], estimated_minutes: bad } },
      ])
      expect(rowByKey(rows, 'reflect-0').estimatedMinutes, String(bad)).toBeNull()
    }
  })

  it('§9b the adapter keeps the mapping 1:1 so reflect keys stay index-aligned', () => {
    // A finding carrying nothing renderable is NOT compacted away (v7 dropped
    // such findings because it owned its own section; here a drop would
    // renumber every `reflect-<i>` after it).
    const rows = rankFromRaw([
      { type: 'A', description: '' },
      { type: 'B', description: 'second', micro_intervention: { steps: ['s'] } },
    ])
    expect(rows.map(r => r.key)).toEqual(['reflect-0', 'reflect-1'])
    expect(rowByKey(rows, 'reflect-1').steps).toEqual(['s'])
  })
})
