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
 * hold must cover every MODEL-CHANGING deferred event and NOTHING ELSE. Five
 * of the twelve `WIRE_SYSTEM_EVENT_TYPES` write graph state at CEE
 * (`SYSTEM_EVENT_HANDLING: 'mutating'`): factor_value_edit, structural_add,
 * structural_delete, structural_rename and — since its emitter landed on
 * 2026-09-07 — edge_strength_edit, whose classification is additionally gated
 * on `rpcEnforce` (see the adjudication test at the foot of this file). Of the
 * other seven, SIX are
 * `'ack_and_commit'` or `'fact_and_commit'` at CEE and the seventh —
 * `direct_analysis_run` — is not a CEE system-event kind at ALL, going over as
 * `kind='message'` (`v5/buildPayload.ts:369`). None of the seven writes a
 * graph, which is the only property this file rests on, so an undispatched one
 * does not make a verdict false — counting them would manufacture a "model changed"
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

/**
 * NON-mutating members — and CEE's classes for these two DIFFER, so this
 * comment names them rather than bucketing them. `feedback_submitted` goes over
 * as kind `feedback` (`v5/buildPayload.ts:451-463`) and is `'fact_and_commit'`
 * (a committed turn fact); `patch_dismissed` is `'ack_and_commit'` (a turn row,
 * no fact). Neither writes a graph — the only property this file rests on.
 */
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

  it('OPPOSITE TWIN: a run completing behind a deferred feedback_submitted DOES clear the overlay', async () => {
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
  it('names exactly the seven mutating wire members', () => {
    // 2026-09-08 (schemas 0.54.0): `option_intervention_edit` joins, and it is
    // HELD for the sharpest version of the reason the others are. An option's
    // effect value is INSIDE CEE's analysis-affecting hash projection — the
    // published `CANONICAL_GRAPH_HASH_NESTED_PROJECTION` names `interventions`
    // on both the node and the option carrier — so an undispatched one means a
    // freshness verdict computed about a graph the user has already changed.
    // CEE declares the kind `'mutating'`.
    // 2026-09-11 (schemas 0.50.0 member, writer landed now): `structural_add_edge`
    // joins, and it is HELD for the plainest version of the reason: a new causal
    // edge is INSIDE the analysis-affecting hash projection — the published
    // projection names `from`, `to`, `edge_type`, `exists_probability`,
    // `effect_direction` and strength `mean`/`std` — so an undispatched one means
    // a freshness verdict computed about a graph the user has already changed.
    // CEE declares the kind `'mutating'`, unconditionally.
    expect([...MODEL_CHANGING_SYSTEM_EVENT_TYPES].sort()).toEqual([
      'edge_strength_edit',
      'factor_value_edit',
      'option_intervention_edit',
      'structural_add',
      'structural_add_edge',
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
    ).toBe(7)

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
      // ⭐ THE GUARD FIRED AGAIN (2026-09-11, schemas 0.55.0) AND THIS IS THE
      // ADJUDICATION IT DEMANDED: HELD-OUT, and pinned positively here so a
      // later regression to held fails rather than passing quietly.
      //
      // A `finding_dissent` is a record of WHAT A HUMAN SAID. It writes no
      // graph — the contract member carries no `base_graph_hash` at all, and
      // its own comment gives the reason: five members carry that field as a
      // STALE GATE whose rule is "CEE MUST refuse on divergence", and applying
      // it to a dissent would refuse a true statement of what a person said
      // because the graph had moved underneath it.
      //
      // ⚠ SO HOLDING WOULD BE THE LIE HERE, not the safe direction. The hold
      // exists because a verdict computed without a pending GRAPH CHANGE is a
      // statement about a different graph. Nothing about a dissent changes the
      // graph, so holding on one would fabricate "Model changed since this
      // analysis" over a run that genuinely is current — the same lie the
      // hold exists to prevent, pointing the other way.
      'finding_dissent',
      'patch_accepted',
      'patch_dismissed',
      'prior_range_edit',
    ])

    // ⚠ WHAT THIS DOES NOT CATCH: CEE re-classifying an existing kind as
    // 'mutating'. Both lists here would be unchanged and this stays GREEN.
  })

  /**
   * ⭐ THE GUARD FIRED, AND THIS IS THE ADJUDICATION IT DEMANDED (2026-09-07).
   *
   * The previous version of this test asserted `edge_strength_edit` was NOT a
   * member of `WIRE_SYSTEM_EVENT_TYPES`, with the message "when this REDs,
   * edge_strength_edit is sendable and the held list needs adjudicating". The
   * emitter landed, it RED, and the answer is HELD — pinned positively below
   * rather than merely dropped, so a silent regression to unheld fails here.
   *
   * ⚠⚠ AND THE ADJUDICATION IS NOT THE OBVIOUS ONE, so it is written down. CEE
   * declares this kind `'mutating'` CONDITIONALLY: `dispatch.ts:570-577` at
   * staging `9de184f1` demotes it to `'reader_only_refusal'` unless
   * `config.features.graphCas.rpcEnforce === true`, and it is the ONLY one of
   * the five so gated. Under the refusing posture CEE writes no graph, so one
   * could argue an undispatched event changes nothing and need not hold.
   *
   * That argument is wrong in the direction that hurts. The hold is about edits
   * the UI has NOT YET DISPATCHED, and the UI cannot observe the posture — CEE's
   * own config header says it is "UNOBSERVABLE FROM ANY CLIENT by
   * construction". Holding on an edit the server would have refused OVERSTATES
   * staleness: the user is invited to re-run something that is already current.
   * NOT holding on an edit the server DID apply UNDERSTATES it: the user is
   * shown a verdict about a graph that no longer exists. Only one of those two
   * lies is about the numbers.
   */
  it("the mutating kind CEE gates on rpcEnforce is HELD, under both postures", () => {
    const wire = WIRE_SYSTEM_EVENT_TYPES as readonly string[]
    const held = new Set<string>(MODEL_CHANGING_SYSTEM_EVENT_TYPES)

    // Contrast control first — an absence claim from a probe that sees nothing
    // is blindness, not evidence.
    expect(wire, 'contrast control — the probe can see a member that IS present').toContain(
      'structural_rename',
    )
    // And the discriminating half: the same probe must be able to answer NO.
    // `chip_click` is a real CEE SystemEventKind the UI does not emit, so a
    // probe that says yes to everything fails here.
    expect(wire, 'contrast control — the probe can also answer NO').not.toContain('chip_click')

    expect(wire, 'the emitter landed, so the member is sendable').toContain('edge_strength_edit')
    expect(held, 'and a graph-changing edit holds the freshness overlay').toContain(
      'edge_strength_edit',
    )
  })
})
