/**
 * CONTESTED-EDGE CLIENT-SIDE CAP — ROADMAP 2.146 residual, orchestrator ruling (c).
 *
 * WHY THIS SPEC EXISTS. `ValidationMetadata.surfaced` was specced as "whether CEE
 * selected this contested edge for user review", with CEE applying a one-per-target-node
 * cap. CEE never built it — `EdgeValidationMetadata` in olumi-assistants-service
 * (src/cee/validation-pipeline/types.ts) has no `surfaced` key. The UI declared the field
 * REQUIRED and gated on it, so every contested edge that actually arrives on the wire was
 * dropped and the pre-analysis panel stayed dark over live metadata (CEE's validation
 * pipeline is ON in code since #808).
 *
 * Ruling (c): honour `surfaced` when present, treat ABSENT as ELIGIBLE, and apply the
 * designed one-per-target-node cap CLIENT-SIDE with a deterministic tie-break —
 * highest `max_divergence` → lowest `distance_to_goal` → lowest edge id.
 *
 * EVERY ASSERTION BINDS BY EDGE ID (trap 19). "One edge survives" is not asserted
 * anywhere; the specific surviving id is. The tie-break fixtures are built so that
 * deleting ANY ONE of the three keys elects a DIFFERENT, named edge.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { usePreAnalysisData } from '../hooks/usePreAnalysisData'
import { useCanvasStore } from '../../../store'
import type { Node, Edge } from '@xyflow/react'
import type { ValidationMetadata } from '../../../domain/validation'

vi.mock('../../../store', () => ({ useCanvasStore: vi.fn() }))

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { usePreAnalysisData as _useExistingPreAnalysisData } from '../../../hooks/usePreAnalysisData'
vi.mock('../../../hooks/usePreAnalysisData', () => ({
  usePreAnalysisData: vi.fn(() => ({
    canRun: true,
    hasBlockers: false,
    allIssues: [],
    fixFirstIssues: [],
    remainingCount: 0,
    limitingFactor: null,
    quality: null,
    readyOptionsCount: 0,
    totalOptionsCount: 0,
    edgeProvenance: null,
    isLoading: false,
  })),
}))

vi.mock('../../../hooks/usePreRunValidation', () => ({
  usePreRunValidation: vi.fn(() => ({ blockers: [], informationalBlockers: [] })),
  SOFT_BYPASS_STATUSES: new Set(),
}))

const mockUseCanvasStore = useCanvasStore as unknown as ReturnType<typeof vi.fn>

/**
 * Builds contested validation metadata. `surfaced` is NOT set by default — that is the
 * shape CEE actually emits today, and the whole point of the change under test.
 */
function contested(overrides: Partial<ValidationMetadata> = {}): ValidationMetadata {
  return {
    status: 'contested',
    contested_reasons: ['strength_band_change'],
    pass1: { strength_mean: 0.3, strength_std: 0.1, exists_probability: 0.9 },
    pass2: {
      strength_mean: 0.7,
      strength_std: 0.1,
      exists_probability: 0.9,
      reasoning: 'Independent review disagrees',
      basis: 'domain_prior',
      needs_user_input: false,
    },
    max_divergence: 0.5,
    distance_to_goal: 2,
    evoi_rank: null,
    evoi_impact: null,
    was_shown: false,
    user_action: 'pending',
    resolved_value: null,
    resolved_by: 'default',
    ...overrides,
  } as ValidationMetadata
}

const NODES: Node[] = [
  { id: 'fac1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Factor 1' } },
  { id: 'fac2', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Factor 2' } },
  { id: 'fac3', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Factor 3' } },
  { id: 'goal1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Goal 1' } },
  { id: 'goal2', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Goal 2' } },
]

function edge(id: string, source: string, target: string, validation: ValidationMetadata): Edge {
  return { id, source, target, data: { weight: 0.5, direction: 'positive', validation } }
}

function mountWith(edges: Edge[], nodes: Node[] = NODES) {
  mockUseCanvasStore.mockImplementation((selector: (s: unknown) => unknown) =>
    selector({
      nodes,
      edges,
      ceeAnalysisReady: null,
      runMeta: null,
      ceeQuality: null,
      ceePipelineTrace: null,
      preAnalysisSensitivity: null,
    }),
  )
  return renderHook(() => usePreAnalysisData())
}

/** Surviving contested edge ids, in the order the panel would render them. */
function survivingIds(result: { current: { contestedEdges: Array<{ edge: Edge }> } }): string[] {
  return result.current.contestedEdges.map(c => c.edge.id)
}

/** Contested verify-item ids — the OTHER consumer, which must agree with the above. */
function verifyContestedIds(result: {
  current: { improvementsByCategory: { verify: Array<{ key: string; subgroup?: string }> } }
}): string[] {
  return result.current.improvementsByCategory.verify
    .filter(i => i.subgroup === 'contested')
    .map(i => i.key.replace(/^contested_/, ''))
}

describe('Contested-edge cap — eligibility (`surfaced` optional, absent = eligible)', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('an ABSENT `surfaced` is ELIGIBLE — the shape CEE actually emits reaches the panel', () => {
    const { result } = mountWith([edge('e_absent', 'fac1', 'goal1', contested())])

    expect(survivingIds(result)).toEqual(['e_absent'])
    expect(verifyContestedIds(result)).toEqual(['e_absent'])
  })

  it('CONTROL — `surfaced: false` is STILL excluded, so the change is not a blanket permit', () => {
    const { result } = mountWith([edge('e_suppressed', 'fac1', 'goal1', contested({ surfaced: false }))])

    expect(survivingIds(result)).toEqual([])
    expect(verifyContestedIds(result)).toEqual([])
  })

  it('CONTROL — an explicit `surfaced: true` is still honoured', () => {
    const { result } = mountWith([edge('e_explicit', 'fac1', 'goal1', contested({ surfaced: true }))])

    expect(survivingIds(result)).toEqual(['e_explicit'])
  })

  it('CONTROL — a resolved edge (user_action !== pending) is still excluded even with `surfaced` absent', () => {
    const { result } = mountWith([
      edge('e_resolved', 'fac1', 'goal1', contested({ user_action: 'accepted_pass1' })),
    ])

    expect(survivingIds(result)).toEqual([])
  })

  it('CONTROL — an agreed (non-contested) edge is never surfaced', () => {
    const { result } = mountWith([edge('e_agreed', 'fac1', 'goal1', contested({ status: 'agreed' }))])

    expect(survivingIds(result)).toEqual([])
  })
})

describe('Contested-edge cap — one per target node, deterministic tie-break', () => {
  beforeEach(() => { vi.clearAllMocks() })

  // KEY 1 — highest max_divergence. Ids are chosen so that DELETING this key elects
  // `e_aaa_low` (lowest id, equal distance), not the expected `e_zzz_high`.
  it('KEY 1 — of three contested edges onto ONE target, the highest `max_divergence` survives: e_zzz_high', () => {
    const { result } = mountWith([
      edge('e_aaa_low', 'fac1', 'goal1', contested({ max_divergence: 0.2, distance_to_goal: 2 })),
      edge('e_zzz_high', 'fac2', 'goal1', contested({ max_divergence: 0.9, distance_to_goal: 2 })),
      edge('e_mmm_mid', 'fac3', 'goal1', contested({ max_divergence: 0.5, distance_to_goal: 2 })),
    ])

    expect(survivingIds(result)).toEqual(['e_zzz_high'])
  })

  // KEY 2 — lowest distance_to_goal. Ids are chosen so that DELETING this key elects
  // `e_alpha_far` (lowest id), not the expected `e_zulu_near`.
  it('KEY 2 — on a `max_divergence` tie, the LOWEST `distance_to_goal` survives: e_zulu_near', () => {
    const { result } = mountWith([
      edge('e_alpha_far', 'fac1', 'goal1', contested({ max_divergence: 0.7, distance_to_goal: 5 })),
      edge('e_zulu_near', 'fac2', 'goal1', contested({ max_divergence: 0.7, distance_to_goal: 1 })),
    ])

    expect(survivingIds(result)).toEqual(['e_zulu_near'])
  })

  // KEY 3 — lowest edge id. This is the TOTALITY key: without it the winner is decided by
  // input order, and the panel reorders between renders. `e_zzz_first` is deliberately
  // FIRST in the array, so deleting the key elects it.
  it('KEY 3 — on a full tie, the LOWEST EDGE ID survives regardless of input position: e_aaa_second', () => {
    const { result } = mountWith([
      edge('e_zzz_first', 'fac1', 'goal1', contested({ max_divergence: 0.7, distance_to_goal: 3 })),
      edge('e_aaa_second', 'fac2', 'goal1', contested({ max_divergence: 0.7, distance_to_goal: 3 })),
    ])

    expect(survivingIds(result)).toEqual(['e_aaa_second'])
  })

  it('KEY 3 — the same full tie REVERSED elects the same id, proving the cap is input-order-independent', () => {
    const { result } = mountWith([
      edge('e_aaa_second', 'fac2', 'goal1', contested({ max_divergence: 0.7, distance_to_goal: 3 })),
      edge('e_zzz_first', 'fac1', 'goal1', contested({ max_divergence: 0.7, distance_to_goal: 3 })),
    ])

    expect(survivingIds(result)).toEqual(['e_aaa_second'])
  })

  it('the cap is PER TARGET NODE, not a global top-1 — each target keeps its own winner', () => {
    const { result } = mountWith([
      edge('e_g1_hi', 'fac1', 'goal1', contested({ max_divergence: 0.9 })),
      edge('e_g1_lo', 'fac2', 'goal1', contested({ max_divergence: 0.1 })),
      edge('e_g2_hi', 'fac2', 'goal2', contested({ max_divergence: 0.8 })),
      edge('e_g2_lo', 'fac3', 'goal2', contested({ max_divergence: 0.2 })),
    ])

    expect([...survivingIds(result)].sort()).toEqual(['e_g1_hi', 'e_g2_hi'])
  })

  it('a `surfaced: false` edge cannot win the cap and does not consume its target slot', () => {
    const { result } = mountWith([
      edge('e_suppressed_hi', 'fac1', 'goal1', contested({ max_divergence: 0.99, surfaced: false })),
      edge('e_eligible_lo', 'fac2', 'goal1', contested({ max_divergence: 0.1 })),
    ])

    expect(survivingIds(result)).toEqual(['e_eligible_lo'])
  })
})

describe('Contested-edge cap — the two consumers derive from ONE selection (trap 12)', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('`contestedEdges` and the contested verify items name EXACTLY the same edge ids', () => {
    const { result } = mountWith([
      edge('e_g1_hi', 'fac1', 'goal1', contested({ max_divergence: 0.9 })),
      edge('e_g1_lo', 'fac2', 'goal1', contested({ max_divergence: 0.1 })),
      edge('e_g2_hi', 'fac2', 'goal2', contested({ max_divergence: 0.8 })),
      edge('e_g2_lo', 'fac3', 'goal2', contested({ max_divergence: 0.2 })),
    ])

    const fromCards = [...survivingIds(result)].sort()
    const fromVerify = [...verifyContestedIds(result)].sort()

    // Non-vacuity guard: an empty-vs-empty agreement would pass while proving nothing.
    expect(fromCards).toEqual(['e_g1_hi', 'e_g2_hi'])
    expect(fromVerify).toEqual(fromCards)
  })
})
