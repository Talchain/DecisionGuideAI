/**
 * ⭐⭐ THE BADGE CLAIMS SENSITIVITY AND RANKED BY STRUCTURAL INFLUENCE.
 *
 * ## Measured on a real board, not inferred
 *
 * `olumi-debug-1dd2133d-20260916.json` — staging, UI `6497a251`. PLoT sent BOTH ranks inside
 * `enrichment.factor_sensitivity`, and they disagree:
 *
 * | factor                         | importance_rank | influence_rank | elasticity | sensitivity | board |
 * |--------------------------------|-----------------|----------------|------------|-------------|-------|
 * | Team Leadership Coverage       | 1               | 2              | 0.8        | 0.5         | #2    |
 * | Delivery Capacity              | 2               | 4              | 0.4        | 0.25        | —     |
 * | Hiring Speed in Current Market | 3               | 5              | 0.4        | 0.25        | —     |
 * | Tech Lead Presence             | 4               | 1              | 0          | 0           | **#1** |
 * | Hiring and Onboarding Cost     | 5               | 3              | 0          | 0           | #3    |
 * | Additional Developer Headcount | 6               | 6              | 0          | 0           | —     |
 *
 * The board's #1/#2/#3 reproduce **`influence_rank`** exactly. The badge's accessible name is
 * `sensitivityRankBadgeAccessibleName` — *"Key driver #N: one of the factors the result is most
 * sensitive to"*. **So the product badged that sentence onto a factor whose elasticity and
 * sensitivity_score are both 0.** `importance_rank`'s top three ARE the elasticity ordering, so the
 * badge's words were right and the field it read was wrong.
 *
 * ## ⛔ WHY THIS SPEC DRIVES THE HOOK AND NOT THE COMPARATOR
 *
 * The first version of this file asserted on `compareByDisplayModel` directly. **It passed, and the
 * mutant reverting the hook's ordering ALSO passed — 695/695 across 67 hook spec files.** No test in
 * the repo bound which quantity the badge ranks by, so a comparator-level spec proves the comparator
 * sorts and nothing whatever about the badge. That is a guard agreeing with itself, and it would have
 * shipped. These assertions go through `useNodeDisplayMetadata`, so reverting the hook REDs them.
 *
 * ⚠ EVERY ASSERTION BINDS BY FACTOR ID, never by a value another factor could satisfy: Delivery
 * Capacity and Hiring Speed are byte-identical on both metrics.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useNodeDisplayMetadata } from '../useNodeDisplayMetadata'

const makeReport = (overrides: Record<string, unknown> = {}) => ({
  schema: 'report.v1' as const,
  meta: { seed: 1, elapsed_ms: 100 },
  result: { mean: 0.7, p10: 0.5, p50: 0.7, p90: 0.9, critique: '' },
  bands: { p10: 0.5, p50: 0.7, p90: 0.9 },
  ...overrides,
})

let mockState = { results: { status: 'idle' as string, report: null as unknown } }

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector: (s: typeof mockState) => unknown) => selector(mockState)),
}))

import { useCanvasStore } from '../../store'

beforeEach(() => {
  vi.clearAllMocks()
  mockState = { results: { status: 'idle', report: null } }
  vi.mocked(useCanvasStore).mockImplementation((selector) => selector(mockState as never))
})

/** Paul's six factors, verbatim from the export — ids are the real ones. */
const PAULS_RUN = [
  { factor_id: '17456e58', factor_label: 'Team Leadership Coverage', influence_score: 0.8, sensitivity_score: 0.5, elasticity: 0.8, importance_rank: 1, influence_rank: 2 },
  { factor_id: '26f82e8c', factor_label: 'Delivery Capacity', influence_score: 0.4, sensitivity_score: 0.25, elasticity: 0.4, importance_rank: 2, influence_rank: 4 },
  { factor_id: 'f91ee77c', factor_label: 'Hiring Speed in Current Market', influence_score: 0.4, sensitivity_score: 0.25, elasticity: 0.4, importance_rank: 3, influence_rank: 5 },
  { factor_id: '3457913d', factor_label: 'Tech Lead Presence', influence_score: 1, sensitivity_score: 0, elasticity: 0, importance_rank: 4, influence_rank: 1 },
  { factor_id: '7809def4', factor_label: 'Hiring and Onboarding Cost', influence_score: 0.6, sensitivity_score: 0, elasticity: 0, importance_rank: 5, influence_rank: 3 },
  { factor_id: '634c5855', factor_label: 'Additional Developer Headcount', influence_score: 0.2, sensitivity_score: 0, elasticity: 0, importance_rank: 6, influence_rank: 6 },
]

const TEAM_LEADERSHIP = '17456e58'
const TECH_LEAD_PRESENCE = '3457913d'
const HIRING_COST = '7809def4'

const setPaulsRun = () => {
  mockState = { results: { status: 'complete', report: makeReport({ factor_sensitivity: PAULS_RUN }) } }
}

const rankOf = (nodeId: string) =>
  renderHook(() => useNodeDisplayMetadata(nodeId, 'factor')).result.current.sensitivityRank

describe('the rank badge ranks what it claims to rank', () => {
  beforeEach(setPaulsRun)

  it('PRECONDITION: the payload is one where the two orderings genuinely differ', () => {
    // Without this every assertion below could pass on a payload where influence
    // and elasticity happen to agree — the spec would be about nothing.
    const byInfluence = [...PAULS_RUN].sort((a, b) => b.influence_score - a.influence_score)[0]
    const byElasticity = [...PAULS_RUN].sort((a, b) => b.elasticity - a.elasticity)[0]
    expect(byInfluence.factor_id).toBe(TECH_LEAD_PRESENCE)
    expect(byElasticity.factor_id).toBe(TEAM_LEADERSHIP)
    expect(byInfluence.factor_id).not.toBe(byElasticity.factor_id)
  })

  it('⭐ #1 goes to the factor the result is SENSITIVE to, not the structurally largest', () => {
    expect(rankOf(TEAM_LEADERSHIP)).toBe(1)
  })

  it('⛔ the shipped defect: the zero-elasticity factor is no longer badged #1', () => {
    // Tech Lead Presence has elasticity 0 AND sensitivity_score 0 — the run says
    // the result is not sensitive to it at all — and the board badged it #1
    // under the words "one of the factors the result is most sensitive to".
    expect(rankOf(TECH_LEAD_PRESENCE)).not.toBe(1)
  })

  it('⭐ the tie gate cuts the board to ONE badge, and that is the correct outcome', () => {
    // Delivery Capacity and Hiring Speed tie at elasticity 0.4, so ranks 2 and 3
    // are not determined and may not be printed. The board previously carried
    // three badges led by a factor that moves nothing; one honest badge is better
    // than three that rank the wrong quantity.
    expect(rankOf(TEAM_LEADERSHIP)).toBe(1)
    expect(rankOf(HIRING_COST)).toBeNull()
    expect(rankOf(TECH_LEAD_PRESENCE)).toBeNull()
  })

  it('agrees with the producer’s own importance_rank on who is first', () => {
    const producerFirst = [...PAULS_RUN].sort((a, b) => a.importance_rank - b.importance_rank)[0]
    expect(producerFirst.factor_id).toBe(TEAM_LEADERSHIP)
    expect(rankOf(producerFirst.factor_id)).toBe(1)
  })

  it('NON-VACUITY: the hook returns a rank at all on this payload', () => {
    // If the feed rejected this fixture every assertion above would pass by
    // everything being null. One positive reading proves the harness is live.
    expect(rankOf(TEAM_LEADERSHIP)).not.toBeNull()
  })
})
