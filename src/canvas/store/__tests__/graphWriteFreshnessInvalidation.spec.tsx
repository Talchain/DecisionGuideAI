/**
 * THE HARM: a bare-`setState` graph write leaves a retained CEE `fresh` verdict
 * standing, so the Results panel tells the user the analysis reflects a graph it
 * does not reflect.
 *
 * `markAnalysisFreshnessDirty` has to be REMEMBERED at each raw-setState call
 * site. Three routes that structurally change the graph never called it, and
 * nothing failed when they didn't:
 *
 *   · `canvas/hooks/useBlueprintInsert.ts`   — blueprint insert (adds nodes+edges)
 *   · `canvas/components/RecoveryBanner.tsx` — autosave restore (swaps the graph)
 *   · `canvas/ReactFlowGraph.tsx`            — template replace (bulk removal)
 *
 * WHAT THESE TESTS ASSERT — the USER-VISIBLE CONSEQUENCE, not the mechanism.
 * Every case seeds a real CEE `fresh` verdict, drives the real route, and reads
 * `resolveDisplayedFreshness` — the value every trust surface renders. A test
 * that asserted "markAnalysisFreshnessDirty was called" would pass on a call
 * that changed nothing a user can see.
 *
 * ⚠ `ReactFlowGraph.tsx`'s replace path is NOT driven here. `handleConfirmReplace`
 * is an internal callback of a ~2,000-line component with a live ReactFlow
 * context; mounting it to reach one button is not a test, it is a fixture. That
 * route is covered structurally by
 * `canvas/mutations/__tests__/graphWriterFreshnessInvalidation.derived.spec.ts`,
 * and this gap is stated rather than papered over.
 *
 * ── THE CONTROLS ARE HALF THE POINT ──────────────────────────────────────
 * A fix here could over-reach in two directions, and each gets its
 * opposite-direction twin (both GREEN at pristine — they pin what must NOT move):
 *
 *   COSMETIC TWIN   a selection-only write must leave `fresh` alone. Marking
 *                   dirty on every nodes/edges write would fabricate
 *                   cannot-confirm on a user merely clicking an edge.
 *   STALE TWIN      the overlay may only downgrade `fresh` → `unknown`. It must
 *                   NEVER produce `stale` — that is a CEE-only verdict, and a
 *                   fabricated `stale` replaces a false-fresh with a false-stale,
 *                   which the user cannot tell apart. (The rule itself is pinned
 *                   in `analysisFreshness.spec.ts`; here it is pinned END-TO-END,
 *                   through the real routes, where a regression would actually land.)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, renderHook, act } from '@testing-library/react'
import { useCanvasStore } from '../../store'
import { resolveDisplayedFreshness } from '../analysisFreshness'

// Only the autosave I/O is mocked — the STORE IS REAL, because the store is the
// subject. The pre-existing `RecoveryBanner.spec.tsx` mocks the store wholesale
// and therefore cannot observe freshness at all; that is why this defect was
// invisible to it.
// `importOriginal`-spread, NOT a hand-listed replacement: a `vi.mock` factory
// REPLACES the module, so a bare list silently drops every export it forgot —
// here `getCurrentScenarioId`, which `store.ts` calls at module scope, killing
// the whole file at COLLECT.
vi.mock('../../store/scenarios', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  hasUnsavedWork: vi.fn(() => true),
  loadAutosave: vi.fn(() => ({
    timestamp: Date.now() - 5 * 60 * 1000,
    scenarioId: 'scenario-restored',
    nodes: [
      { id: 'r1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Restored goal' } },
      { id: 'r2', type: 'factor', position: { x: 10, y: 10 }, data: { label: 'Restored factor' } },
    ],
    edges: [{ id: 're1', source: 'r2', target: 'r1', data: {} }],
  })),
  clearAutosave: vi.fn(),
}))

vi.mock('@xyflow/react', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useReactFlow: () => ({ getViewport: () => ({ x: 0, y: 0, zoom: 1 }) }),
}))

// `checkLimits` allows when limits are null (graceful degradation), so a null
// here exercises the insert rather than the limit-refusal branch.
vi.mock('../../hooks/useEngineLimits', () => ({
  useEngineLimits: () => ({
    limits: null,
    source: 'test',
    loading: false,
    error: null,
    fetchedAt: null,
    retry: vi.fn(),
  }),
}))

import { RecoveryBanner } from '../../components/RecoveryBanner'
import { useBlueprintInsert } from '../../hooks/useBlueprintInsert'

/** A completed run whose hashes MATCH — CEE's verdict is genuinely `fresh`. */
const FRESH_RUN_VERDICT = {
  options: [],
  goal_node_id: 'goal_seed',
  status: 'ready',
  computed_at: '2026-08-28T21:00:00.000Z',
  freshness: 'fresh',
  freshness_reason: 'graph_hash_match',
  graph_hash_at_run: 'aa11bb22cc33dd44',
  current_graph_hash: 'aa11bb22cc33dd44',
}

/** The same run, but CEE itself said `stale`. Used by the stale twin. */
const CEE_STALE_VERDICT = {
  ...FRESH_RUN_VERDICT,
  freshness: 'stale',
  freshness_reason: 'graph_hash_mismatch',
  current_graph_hash: 'ffffffffffffffff',
}

const SEED_NODES = [
  { id: 'n1', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Seed goal' } },
  { id: 'n2', type: 'factor', position: { x: 100, y: 0 }, data: { label: 'Seed factor' } },
]
const SEED_EDGES = [{ id: 'e1', source: 'n2', target: 'n1', data: {} }]

const BLUEPRINT = {
  id: 'bp-test',
  name: 'Test blueprint',
  description: 'inserted by the blueprint route',
  nodes: [
    { id: 'b1', label: 'Blueprint goal', kind: 'goal' as const },
    { id: 'b2', label: 'Blueprint option', kind: 'option' as const },
  ],
  edges: [{ id: 'be1', from: 'b2', to: 'b1' }],
}

function seedGraphAndVerdict(verdict: Record<string, unknown> = FRESH_RUN_VERDICT) {
  useCanvasStore.setState({
    nodes: SEED_NODES,
    edges: SEED_EDGES,
    analysisFreshness: null,
    analysisFreshnessDirty: false,
    pendingEmittedEdits: 0,
  } as never)
  useCanvasStore.getState().setAnalysisFreshness(verdict)
}

/** The value every trust surface renders. */
function displayed(): string | null {
  const s = useCanvasStore.getState()
  return resolveDisplayedFreshness(s.analysisFreshness, s.analysisFreshnessDirty)
}

beforeEach(() => {
  sessionStorage.clear()
  seedGraphAndVerdict()
})

describe('a bare-setState graph write must not leave a retained `fresh` verdict standing', () => {
  it('SEED CONTROL: with no graph write, the run verdict displays as fresh', () => {
    // Without this the suite could pass by never having a `fresh` verdict to lose.
    expect(displayed()).toBe('fresh')
  })

  it('blueprint insert (useBlueprintInsert) downgrades fresh → cannot-confirm', () => {
    const { result } = renderHook(() => useBlueprintInsert())

    act(() => {
      const out = result.current.insertBlueprint(BLUEPRINT)
      // Bind to THIS route's effect by identity: the insert must actually have
      // added the blueprint's elements, or the freshness assertion below would
      // be about a no-op. (A limit refusal returns `error` and adds nothing.)
      expect(out.error).toBeUndefined()
      expect(out.newNodes).toHaveLength(2)
      expect(out.newEdges).toHaveLength(1)
    })

    expect(useCanvasStore.getState().nodes).toHaveLength(SEED_NODES.length + 2)
    expect(displayed()).toBe('unknown')
    expect(displayed()).not.toBe('stale')
  })

  it('autosave restore (RecoveryBanner) downgrades fresh → cannot-confirm', () => {
    render(<RecoveryBanner />)
    fireEvent.click(screen.getByTestId('btn-recover-autosave'))

    // Identity binding: the restored graph — not the seeded one — is on the canvas.
    const ids = useCanvasStore.getState().nodes.map((n) => n.id)
    expect(ids).toEqual(['r1', 'r2'])

    expect(displayed()).toBe('unknown')
    expect(displayed()).not.toBe('stale')
  })
})

describe('controls — what the fix must NOT do (both green at pristine)', () => {
  it('COSMETIC TWIN: a selection-only write leaves `fresh` untouched', () => {
    // The shape `useFocusCamera` and the context menu use: `selected` flags only.
    // Nothing analysis-affecting changed, so claiming cannot-confirm here would
    // be a fabrication in the opposite direction.
    useCanvasStore.setState((s) => ({
      edges: s.edges.map((e) => ({ ...e, selected: e.id === 'e1' })),
    }))
    expect(displayed()).toBe('fresh')
  })

  it('STALE TWIN: a CEE `stale` verdict survives a graph write unchanged — the overlay never invents, upgrades or clears it', () => {
    seedGraphAndVerdict(CEE_STALE_VERDICT)
    expect(displayed()).toBe('stale')

    const { result } = renderHook(() => useBlueprintInsert())
    act(() => { result.current.insertBlueprint(BLUEPRINT) })

    // Still exactly CEE's verdict. The overlay's only power is fresh → unknown.
    expect(displayed()).toBe('stale')
  })

  it('STALE TWIN (no-verdict case): a graph write with NO run verdict never manufactures one', () => {
    useCanvasStore.setState({
      nodes: SEED_NODES,
      edges: SEED_EDGES,
      analysisFreshness: null,
      analysisFreshnessDirty: false,
    } as never)

    const { result } = renderHook(() => useBlueprintInsert())
    act(() => { result.current.insertBlueprint(BLUEPRINT) })

    // No verdict in, no verdict out — dirtying an absent verdict must stay null.
    expect(displayed()).toBeNull()
  })
})
