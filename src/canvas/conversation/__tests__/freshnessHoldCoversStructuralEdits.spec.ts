/**
 * HALF 1 of "the freshness indicator tells the truth about which graph this
 * result belongs to" — THE FALSE AFFIRMATIVE.
 *
 * THE HARM. A node added, deleted or renamed while an analysis is running is
 * DEFERRED (`sendTurn`'s in-flight branch returns SEND_DEFERRED, so CEE
 * provably never sees it during that run) and marks the model dirty. But
 * `publishPendingEditCount` counted ONLY `factor_value_edit`, so the hold was
 * zero, and the completing run's own verdict — computed against a graph
 * without that node — cleared the overlay and affirmed "reflects the current
 * model" over a graph CEE never held.
 *
 * THE PREDICATE'S DOMAIN, WHICH IS THE WHOLE POINT (CLAUDE.md trap 22). The
 * hold must cover every MODEL-CHANGING deferred event and NOTHING ELSE. Four
 * of the eleven `WIRE_SYSTEM_EVENT_TYPES` write graph state at CEE
 * (`SYSTEM_EVENT_HANDLING: 'mutating'`): factor_value_edit, structural_add,
 * structural_delete, structural_rename. The other seven are notifications or
 * carry-only turn facts that write NO graph, so an undispatched one does not
 * make a verdict false — counting them would manufacture a "model changed"
 * banner over a run that is genuinely current, which is the OPPOSITE harm and
 * just as much a lie.
 *
 * Every case below therefore has its OPPOSITE-DIRECTION TWIN: a mutating type
 * must hold, a non-mutating type must not.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCanvasStore } from '../../store'
import type { WireSystemEvent } from '../types'
import { MODEL_CHANGING_SYSTEM_EVENT_TYPES, WIRE_SYSTEM_EVENT_TYPES } from '../types'

const dispatched: Array<Record<string, unknown>> = []
let resolveInFlight: ((v: unknown) => void) | null = null

vi.mock('../../../v5/v5Adapter', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    callV5Turn: vi.fn(async (payload: Record<string, unknown>) => {
      dispatched.push(payload)
      if (dispatched.length === 1) {
        await new Promise((res) => { resolveInFlight = res })
      }
      return { ok: true, response: { assistant_text: 'ok', blocks: [] } }
    }),
  }
})

// Same reason as useConversation.deferredSystemSends.spec.ts: without this the
// V5 send attempts a real stream open, which fails in jsdom and adds unbounded
// timing-dependent hops before `dispatched` is populated.
vi.mock('../../../v5/streamedTurnTransport', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    openV5TurnStream: async () => { throw new TypeError('Failed to fetch') },
  }
})

vi.mock('../../../flags', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, isOrchestratorV2Enabled: () => true, isOrchestratorStreamingEnabled: () => false }
})

import { useConversation } from '../useConversation'

const SCENARIO = 'a0a0a0a0-b1b1-4c2c-8d3d-e4e4e4e4e4e4'

/** The four MUTATING members, each with a realistic payload. */
const factorValueEdit: WireSystemEvent = {
  type: 'factor_value_edit',
  payload: { target_id: 'fac_a', value: 0.4, raw_value: 20000, unit: '£', field: 'value' },
}
const structuralAdd: WireSystemEvent = {
  type: 'structural_add',
  payload: { node_id: 'fac_new', node_kind: 'factor', label: 'Supplier risk', base_graph_hash: 'aag_v1:abc' },
}
const structuralDelete: WireSystemEvent = {
  type: 'structural_delete',
  payload: { target_id: 'fac_old', base_graph_hash: 'aag_v1:abc' },
}
const structuralRename: WireSystemEvent = {
  type: 'structural_rename',
  payload: { target_id: 'fac_a', label: 'Renamed', expected_label: 'Old', base_graph_hash: 'aag_v1:abc' },
}

/** A NON-mutating member — CEE records a turn fact and writes no graph. */
const feedbackSubmitted: WireSystemEvent = {
  type: 'feedback_submitted',
  payload: { rating: 'up', turn_id: 't1' },
}
const patchDismissed: WireSystemEvent = {
  type: 'patch_dismissed',
  payload: { patch_id: 'p1' },
}

const flush = async () => {
  for (let round = 0; round < 25; round++) {
    for (let i = 0; i < 20; i++) await Promise.resolve()
    await new Promise((r) => setTimeout(r, 1))
  }
}

beforeEach(() => {
  vi.stubEnv('VITE_ENABLE_V5_ORCHESTRATOR', 'true')
  dispatched.length = 0
  resolveInFlight = null
  useCanvasStore.setState({
    currentScenarioId: SCENARIO,
    nodes: [],
    edges: [],
    results: { status: 'idle' } as never,
    analysisFreshness: null,
    analysisFreshnessDirty: false,
    pendingEmittedEdits: 0,
    importPendingServerRegistration: false,
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
  } as never)
})
afterEach(() => { vi.unstubAllEnvs() })

/** Occupy the in-flight lock with an analysis turn that does not resolve. */
async function holdTheLock(result: { current: ReturnType<typeof useConversation> }) {
  act(() => { void result.current.sendMessage('run the analysis') })
  await flush()
  expect(dispatched.length, 'the analysis turn is holding the lock').toBe(1)
}

describe('the undispatched-edit hold covers EVERY model-changing system event', () => {
  it.each([
    ['factor_value_edit', factorValueEdit],
    ['structural_add', structuralAdd],
    ['structural_delete', structuralDelete],
    ['structural_rename', structuralRename],
  ])('a deferred %s holds the count above zero', async (_name, event) => {
    const { result } = renderHook(() => useConversation())
    await holdTheLock(result)

    await act(async () => { await result.current.sendSystemEvent(event) })

    expect(
      useCanvasStore.getState().pendingEmittedEdits,
      'the server has not seen this change — the hold must be non-zero',
    ).toBe(1)
  })

  it.each([
    ['structural_add', structuralAdd],
    ['structural_delete', structuralDelete],
    ['structural_rename', structuralRename],
  ])(
    'the run that never saw a deferred %s may NOT affirm "reflects the current model"',
    async (_name, event) => {
      const { result } = renderHook(() => useConversation())
      await holdTheLock(result)

      act(() => { useCanvasStore.setState({ analysisFreshnessDirty: true } as never) })
      await act(async () => { await result.current.sendSystemEvent(event) })

      // The in-flight run's verdict lands. It was computed WITHOUT this
      // structural change, so it must not un-dirty the overlay.
      act(() => {
        useCanvasStore.getState().setAnalysisFreshness?.({
          freshness: 'fresh',
          freshness_reason: 'graph_hash_match',
          computed_at: new Date().toISOString(),
        })
      })

      expect(
        useCanvasStore.getState().analysisFreshnessDirty,
        'the affirmative would be about a graph CEE never held',
      ).toBe(true)
    },
  )

  it.each([
    ['feedback_submitted', feedbackSubmitted],
    ['patch_dismissed', patchDismissed],
  ])(
    'OPPOSITE TWIN: a deferred %s writes no graph, so it must NOT hold the count',
    async (_name, event) => {
      const { result } = renderHook(() => useConversation())
      await holdTheLock(result)

      await act(async () => { await result.current.sendSystemEvent(event) })

      expect(
        useCanvasStore.getState().pendingEmittedEdits,
        'holding here would fabricate "model changed" over a genuinely current run',
      ).toBe(0)
    },
  )

  it('OPPOSITE TWIN: a run completing behind a deferred notification DOES clear the overlay', async () => {
    const { result } = renderHook(() => useConversation())
    await holdTheLock(result)

    act(() => { useCanvasStore.setState({ analysisFreshnessDirty: true } as never) })
    await act(async () => { await result.current.sendSystemEvent(feedbackSubmitted) })

    act(() => {
      useCanvasStore.getState().setAnalysisFreshness?.({
        freshness: 'fresh',
        freshness_reason: 'graph_hash_match',
        computed_at: new Date().toISOString(),
      })
    })

    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(false)
  })

  /**
   * ⚠ THIS PINS THE PRUNE EFFECT, NOT THE FILTER'S OWN SCENARIO CLAUSE, AND THE
   * NAME SAYS SO BECAUSE A MUTANT PROVED IT.
   *
   * Removing `&& d.scenarioId === scenarioNow` from `publishPendingEditCount`
   * leaves this test GREEN: the `useEffect` keyed on `scenarioId`
   * (`useConversation.ts`, → `pruneForeignScenarioSends`) has already dropped
   * the foreign entry from the buffer, so the filter has nothing to exclude.
   * The clause is a second guard covering the window between an enqueue and
   * that effect firing, and this spec does not reach it — said plainly rather
   * than claimed, because a test named for a property it cannot fail on is the
   * defect this file exists to prevent.
   */
  it('switching decisions drops the foreign hold — and says so', async () => {
    const { result } = renderHook(() => useConversation())
    await holdTheLock(result)

    await act(async () => { await result.current.sendSystemEvent(structuralAdd) })
    expect(useCanvasStore.getState().pendingEmittedEdits).toBe(1)

    // Open a different decision. The queued add belongs to the other scenario
    // and must not hold THIS one's overlay dirty.
    act(() => {
      useCanvasStore.setState({ currentScenarioId: 'b1b1b1b1-c2c2-4d3d-8e4e-f5f5f5f5f5f5' } as never)
    })
    await act(async () => { await result.current.sendSystemEvent(patchDismissed) })

    expect(
      useCanvasStore.getState().pendingEmittedEdits,
      'a hold leaked across scenarios is a fabricated "model changed"',
    ).toBe(0)
  })

  it('the deferred structural edit still reaches the wire once the lock clears', async () => {
    const { result } = renderHook(() => useConversation())
    await holdTheLock(result)

    await act(async () => { await result.current.sendSystemEvent(structuralAdd) })
    await act(async () => { resolveInFlight?.(undefined); await flush() })

    // ⚠ THE WIRE FIELD IS `event.kind`, NOT `event.event_type`. A first cut read
    // the latter — the `serializeSystemEvent` name — and the extractor returned
    // an empty array for EVERY payload, which is indistinguishable from "the
    // add was never flushed". The length assertion below is the positive
    // control: it fails loudly if the extractor is blind again.
    const kinds = dispatched
      .map((p) => (p as { event?: { kind?: string } }).event?.kind)
      .filter((k): k is string => typeof k === 'string')
    expect(dispatched.length, 'a second turn reached the transport at all').toBeGreaterThan(1)
    expect(kinds, 'the add was flushed, not merely held').toContain('structural_add')
    expect(useCanvasStore.getState().pendingEmittedEdits).toBe(0)
  })
})

/**
 * The set is a HAND-KEPT list asserting something about ANOTHER SERVICE.
 * This block's heading read "the model-changing set is DERIVED, not a second
 * hand-kept list" until 2026-09-05, and that was false — the list is hand-kept
 * and nothing derives it. What each test below pins, and what it does not, is
 * stated on the test itself.
 */
describe('what actually pins the model-changing set', () => {
  it('names exactly the four mutating wire members', () => {
    expect([...MODEL_CHANGING_SYSTEM_EVENT_TYPES].sort()).toEqual([
      'factor_value_edit',
      'structural_add',
      'structural_delete',
      'structural_rename',
    ])
  })

  it('PARTITION — every wire member is adjudicated held or held-out', () => {
    const held = new Set<string>(MODEL_CHANGING_SYSTEM_EVENT_TYPES)

    // Contrast control first: the probe must see the held members at all,
    // or an empty held-out list would "pass" by seeing nothing.
    expect(
      WIRE_SYSTEM_EVENT_TYPES.filter((t) => held.has(t)).length,
      'contrast control — the partition can see the held members',
    ).toBe(4)

    expect(
      WIRE_SYSTEM_EVENT_TYPES.filter((t) => !held.has(t))
        .slice()
        .sort(),
      'a NEW wire member REDs here until it is adjudicated into one side',
    ).toEqual([
      'direct_analysis_run',
      'direct_graph_edit',
      'edge_adjudication',
      'feedback_submitted',
      'patch_accepted',
      'patch_dismissed',
      'prior_range_edit',
    ])

    // ⚠ WHAT THIS DOES NOT CATCH: CEE re-classifying an existing kind as
    // 'mutating'. Both lists here would be unchanged and this stays GREEN.
  })

  /**
   * ⭐ THE COMPLETENESS QUESTION, ANSWERED AS AN ASSERTION RATHER THAN A
   * SENTENCE. CEE's `SYSTEM_EVENT_HANDLING` classifies FIVE kinds `'mutating'`;
   * the list above names FOUR. The fifth is `edge_strength_edit`, and the
   * reason it is not here is not an oversight to be argued in prose — it is a
   * RELATIONSHIP between two lists in this repo, so it is pinned:
   * `edge_strength_edit` is not a member of `WIRE_SYSTEM_EVENT_TYPES` at all,
   * so it cannot be serialised, cannot be enqueued behind the in-flight lock,
   * and is outside anything `publishPendingEditCount` is able to see.
   *
   * ⚠ THIS IS THE FAILURE WE WANT. `model-tab-v2/contracts.ts` records
   * `proposeEdgeStrength → edge_strength_edit` as in-flight work. The day that
   * emitter lands, the member joins `WIRE_SYSTEM_EVENT_TYPES` — and this test
   * AND the PARTITION above both go RED until someone adjudicates it into one
   * side. A count in a comment would have gone quietly stale instead.
   */
  it("the fifth kind CEE calls 'mutating' is not a wire member, so this filter cannot reach it", () => {
    const wire = WIRE_SYSTEM_EVENT_TYPES as readonly string[]

    // Contrast control first — an absence claim from a probe that sees nothing
    // is blindness, not evidence.
    expect(wire, 'contrast control — the probe can see a member that IS present').toContain(
      'structural_rename',
    )

    expect(
      wire,
      'when this REDs, edge_strength_edit is sendable and the held list needs adjudicating',
    ).not.toContain('edge_strength_edit')
  })
})
