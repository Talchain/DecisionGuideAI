/**
 * ROADMAP 2.146, amendment A1 (adversarial review of PR #532, §8) —
 * `edge.validation` survives the FIVE REBUILD hops, not just the three ingestion
 * hops.
 *
 * ── WHY THIS FILE EXISTS, AND WHY ITS ABSENCE WAS THE GAP ───────────────────
 * The three ingestion hops (draft mapper, patch builder, merge overlay) are pinned
 * in `edgeValidationMapperMirror.spec.ts` and `mergeAppliedGraph.validation.spec.ts`.
 * But five FURTHER sites rebuild an already-existing canvas edge's `data` from
 * scratch, and every one of them survives only because it happens to be written as
 * a WHOLESALE SPREAD over the defaults:
 *
 *   { ...DEFAULT_EDGE_DATA, ...(edge.data ?? {}) }
 *
 * | # | site | journey |
 * |---|---|---|
 * | 4 | `src/hooks/useScenario.ts:596`  | Supabase scenario load / RESUME |
 * | 5 | `src/canvas/store.ts:3538`      | store `loadScenario` rehydrate |
 * | 6 | `src/canvas/store.ts:4272`      | `applyRepair` |
 * | 7 | `src/canvas/store.ts:4300`      | `applyAllRepairs` |
 * | 8 | `src/canvas/store.ts:4327`      | `applyAutoFixChanges` |
 *
 * There is **no live defect** — the spread carries the field today. The gap is that
 * NOTHING PINNED IT. Convert any one of those five to a named-field copy — the
 * exact discipline the two ingestion mappers deliberately use, and the exact defect
 * class the hop-2 mirror test exists to catch — and contested markers **vanish on
 * scenario resume** with a fully green suite. On the one journey every tester takes
 * daily.
 *
 * So this file pins the CLASS at ALL FIVE sites — the amendment strictly required
 * only the persistence hop, but the five share one failure mode and pinning three
 * would have left the class open behind a spec that looks complete. Each presence
 * arm sits next to its absence arm (trap 13: an assertion that a field SURVIVED
 * proves nothing unless the harness can also see it missing).
 *
 * Mutation-proven at three distinct sites, not one: converting the wholesale spread
 * to a named-field copy at `useScenario.ts:596`, at `store.ts:3538`, or at
 * `store.ts:4327` each turns this file RED — and in the first case 139 pre-existing
 * tests across 8 files (including both `useScenario` specs, which exercise that very
 * function) stay GREEN. That green figure is the finding: the defect is invisible to
 * every other test in the repo.
 *
 * ── NOT PINNED HERE, CLEARED WITH REASONING BY THE REVIEW ───────────────────
 * `ReactFlowGraph.tsx:1160-1191` (`insertBlueprint` → `commitTemplateGraphReplace`)
 * and `:1094` (user-drawn `onConnect`) ARE allow-lists over `DEFAULT_EDGE_DATA` —
 * but their sources are a blueprint edge and a fresh user edge, both structurally
 * incapable of carrying `validation`, and the blueprint path REPLACES the graph
 * rather than merging. There is nothing there to drop, so a pin would assert a
 * vacuous truth.
 *
 * ── SCOPE OF THE FIVE ───────────────────────────────────────────────────────
 * The review's list is "every rebuild hop found" over the complete
 * `DEFAULT_EDGE_DATA` consumer set (32 non-test files) plus every named journey —
 * NOT "provably every hop that exists"; a broader edge-construction census was
 * still running when it was written. Anything it lands later is a follow-up row,
 * not a hole in this file.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// ── Mocks for hop 4 (the Supabase scenario-load path) ───────────────────────
// Same harness shape as src/hooks/__tests__/useScenario.goalConstraints.lifecycle
// .spec.ts, which pins the sibling property (goal_constraints) on this same hop.
const mockRpc = vi.fn()
const mockSingle = vi.fn()
let mockRowsById: Record<string, Record<string, unknown>> = {}

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: (_col: string, id: string) => ({
          single: () => mockSingle(id),
        }),
      }),
      update: () => ({ eq: vi.fn().mockResolvedValue({ error: null }) }),
    }),
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}))

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }))

const REAL_USER_ID = '550e8400-e29b-41d4-a716-446655440000'
vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: REAL_USER_ID }, authenticated: true }),
}))

// ── Mock for hop 5 (the store's own localStorage-backed scenario load) ──────
// importOriginal-spread, overriding ONLY `getScenario`. A hand-written stand-in
// for this module would replace the ~20 other functions `store.ts` calls on it
// (`setCurrentScenarioId`, `updateScenario`, `clearAutosave`, …) — the vi.mock
// factory REPLACES the module, which is exactly the trap-12 failure that once
// killed 51 tests in the sibling repo.
const mockScenariosById = new Map<string, unknown>()
vi.mock('../../store/scenarios', async (importOriginal) => {
  const mod = (await importOriginal()) as Record<string, unknown>
  return {
    ...mod,
    getScenario: (id: string) => mockScenariosById.get(id),
  }
})

import { useScenario } from '../../../hooks/useScenario'
import { useCanvasStore } from '../../store'
import type { ValidationMetadata } from '../../domain/validation'
import type { GraphHealth } from '../../validation/types'

// ── Fixtures ────────────────────────────────────────────────────────────────

const WIRE_VALIDATION = {
  status: 'contested',
  contested_reasons: ['sign_flip'],
  pass1: { strength_mean: 0.6, strength_std: 0.1, exists_probability: 0.8 },
  pass2: {
    strength_mean: -0.2,
    strength_std: 0.2,
    exists_probability: 0.6,
    reasoning: 'Direction is not supported by the brief.',
    basis: 'domain_prior',
    needs_user_input: true,
  },
  max_divergence: 0.8,
  distance_to_goal: 1,
  evoi_rank: null,
  evoi_impact: null,
  was_shown: false,
  user_action: 'pending',
  resolved_value: null,
  resolved_by: 'default',
} as unknown as ValidationMetadata

const NODES = [
  { id: 'goal-1', type: 'goal', position: { x: 0, y: 0 }, data: { kind: 'goal', label: 'Revenue' } },
  { id: 'factor-1', type: 'factor', position: { x: 0, y: 100 }, data: { kind: 'factor', label: 'Spend' } },
]

const EDGE_ID = 'factor-1::goal-1::0'

/** A persisted edge as it sits in the graph JSONB / localStorage record. */
function persistedEdge(withValidation: boolean) {
  return {
    id: EDGE_ID,
    source: 'factor-1',
    target: 'goal-1',
    type: 'styled',
    data: {
      weight: 0.7,
      direction: 'positive',
      ...(withValidation ? { validation: WIRE_VALIDATION } : {}),
    },
  }
}

function scenarioRow(id: string, edges: unknown[]): Record<string, unknown> {
  return {
    id,
    graph: { nodes: NODES, edges },
    framing: null,
    stage: 'analyse',
    updated_at: new Date().toISOString(),
    analysis_status: 'none',
    analysis: null,
    analysis_provenance: null,
    analysis_error: null,
    thread: null,
    events: null,
  }
}

/** The rebuilt edge as it ended up in the canvas store. */
function storeEdgeData(): Record<string, unknown> {
  const edge = useCanvasStore.getState().edges.find((e) => e.id === EDGE_ID)
  expect(edge, `edge ${EDGE_ID} is not in the store`).toBeDefined()
  return (edge!.data ?? {}) as Record<string, unknown>
}

/** Seed the store as though the edge were already on the canvas. */
function seedCanvas(withValidation: boolean) {
  useCanvasStore.setState({
    currentScenarioId: 'scenario-1',
    nodes: structuredClone(NODES) as never,
    edges: [structuredClone(persistedEdge(withValidation))] as never,
    graphHealth: null,
    history: { past: [], future: [] },
  } as never)
}

beforeEach(() => {
  vi.clearAllMocks()
  mockRowsById = {}
  mockScenariosById.clear()
  mockSingle.mockImplementation(async (id: string) =>
    mockRowsById[id]
      ? { data: mockRowsById[id], error: null }
      : { data: null, error: { code: 'PGRST116' } },
  )
  mockRpc.mockResolvedValue({ data: {}, error: null })
})

// ═══════════════════════════════════════════════════════════════════════════
// HOP 4 — Supabase scenario load / RESUME (useScenario.ts:596)
// The journey every tester takes daily, and the one the review named as most
// likely to expose the gap.
// ═══════════════════════════════════════════════════════════════════════════

describe('hop 4 — validation survives a Supabase scenario resume', () => {
  it('an edge persisted WITH validation still carries it after loadScenario', async () => {
    mockRowsById['scenario-A'] = scenarioRow('scenario-A', [persistedEdge(true)])
    const { result } = renderHook(() => useScenario())

    await act(async () => {
      await result.current.loadScenario('scenario-A')
    })

    expect(storeEdgeData().validation).toEqual(WIRE_VALIDATION)
    // The rebuild must not have reset the rest of the edge either.
    expect(storeEdgeData().weight).toBeCloseTo(0.7)
  })

  it('an edge persisted WITHOUT validation gains no key (the absence arm)', async () => {
    // POSITIVE CONTROL for the assertion below is the test above: the same code
    // path DOES produce the key when the record carries it, so this measures a
    // real absence rather than measuring nothing.
    mockRowsById['scenario-B'] = scenarioRow('scenario-B', [persistedEdge(false)])
    const { result } = renderHook(() => useScenario())

    await act(async () => {
      await result.current.loadScenario('scenario-B')
    })

    expect(storeEdgeData()).not.toHaveProperty('validation')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// HOP 5 — the store's own loadScenario rehydrate (store.ts:3538)
// ═══════════════════════════════════════════════════════════════════════════

describe('hop 5 — validation survives the store loadScenario rehydrate', () => {
  it('an edge in a saved scenario still carries validation after rehydrate', () => {
    mockScenariosById.set('local-1', {
      id: 'local-1',
      name: 'Saved',
      graph: { nodes: structuredClone(NODES), edges: [persistedEdge(true)] },
      framing: null,
    })

    expect(useCanvasStore.getState().loadScenario('local-1')).toBe(true)
    expect(storeEdgeData().validation).toEqual(WIRE_VALIDATION)
  })

  it('an edge saved WITHOUT validation gains no key', () => {
    mockScenariosById.set('local-2', {
      id: 'local-2',
      name: 'Saved',
      graph: { nodes: structuredClone(NODES), edges: [persistedEdge(false)] },
      framing: null,
    })

    expect(useCanvasStore.getState().loadScenario('local-2')).toBe(true)
    expect(storeEdgeData()).not.toHaveProperty('validation')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// HOPS 6–8 — the repair / auto-fix rebuilds (store.ts:4272 / :4300 / :4327)
//
// The repair action deliberately targets a NODE, so the validation-bearing edge
// passes through `graphRepair` untouched and reaches the `{...DEFAULT_EDGE_DATA,
// ...edge.data}` rebuild unchanged. That rebuild is the thing under test — not
// the repair logic.
// ═══════════════════════════════════════════════════════════════════════════

const NODE_ONLY_FIX: GraphHealth = {
  status: 'warnings',
  score: 80,
  issues: [
    {
      id: 'issue-1',
      type: 'missing_label',
      severity: 'warning',
      message: 'Node needs a label',
      nodeIds: ['goal-1'],
      suggestedFix: { type: 'update_node', targetId: 'goal-1', data: { label: 'Revenue (Q4)' } },
    },
  ],
}

describe('hop 6 — validation survives applyRepair', () => {
  it('keeps validation on an edge the repair did not touch', async () => {
    seedCanvas(true)
    useCanvasStore.setState({ graphHealth: NODE_ONLY_FIX } as never)

    await useCanvasStore.getState().applyRepair('issue-1')

    expect(storeEdgeData().validation).toEqual(WIRE_VALIDATION)
  })

  it('does not invent validation on an edge that had none', async () => {
    seedCanvas(false)
    useCanvasStore.setState({ graphHealth: NODE_ONLY_FIX } as never)

    await useCanvasStore.getState().applyRepair('issue-1')

    expect(storeEdgeData()).not.toHaveProperty('validation')
  })
})

describe('hop 7 — validation survives applyAllRepairs', () => {
  it('keeps validation on an edge the repairs did not touch', async () => {
    seedCanvas(true)
    useCanvasStore.setState({ graphHealth: NODE_ONLY_FIX } as never)

    await useCanvasStore.getState().applyAllRepairs()

    expect(storeEdgeData().validation).toEqual(WIRE_VALIDATION)
  })

  it('does not invent validation on an edge that had none', async () => {
    seedCanvas(false)
    useCanvasStore.setState({ graphHealth: NODE_ONLY_FIX } as never)

    await useCanvasStore.getState().applyAllRepairs()

    expect(storeEdgeData()).not.toHaveProperty('validation')
  })
})

describe('hop 8 — validation survives applyAutoFixChanges', () => {
  it('keeps validation on an edge handed to the auto-fix', () => {
    seedCanvas(true)

    useCanvasStore.getState().applyAutoFixChanges({
      edges: [structuredClone(persistedEdge(true))] as never,
    })

    expect(storeEdgeData().validation).toEqual(WIRE_VALIDATION)
  })

  it('does not invent validation on an edge that had none', () => {
    seedCanvas(false)

    useCanvasStore.getState().applyAutoFixChanges({
      edges: [structuredClone(persistedEdge(false))] as never,
    })

    expect(storeEdgeData()).not.toHaveProperty('validation')
  })
})
