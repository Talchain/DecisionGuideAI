/**
 * A PURE RENAME MUST NOT CLAIM "MODEL CHANGED SINCE THIS RUN".
 *
 * WITNESSED on served UI `11ed8874` / CEE `8428207` (24 Sep 2026): after a
 * completed, current analysis, the user renamed factor `fac_annual_cost`.
 * CEE's `graph_hash` did NOT move (label sits outside CEE's analysis-affecting
 * hash projection — `structuralRename.ts`'s own header says so: "a rename
 * moves no analysis hash at all"). CEE's chat said the rename doesn't affect
 * the analysis. Yet the canvas showed `AnalysisStateCue`'s "Model changed ·
 * previous findings shown as Last run" — the canvas asserting a model change
 * that did not happen.
 *
 * ⭐⭐ ROOT CAUSE, traced to two real functions and CONFIRMED BY EXECUTION
 * (not just reading) — see the note below on what turned out to be RELEVANT
 * and what did not:
 *
 *   1. `reconcileAppliedGraph` (mergeAppliedGraph.ts) ingests the rename
 *      turn's committed `draft_graph` via `overlayNode`, which compares the
 *      WHOLE `data` bag (`sameValue(existing.data, nextData)`) with NO
 *      distinction between analytically-meaningful fields and cosmetic ones.
 *      Any key CEE's echoed node carries that the canvas's existing copy does
 *      not counts as an "update" (`updatedNodeCount += 1`), so `changed =
 *      true` — REGARDLESS of whether that key is analysis-affecting.
 *   2. Because this receipt is not `receiptIsTheAttestedAnalysedGraph` (a
 *      rename confirmation carries no `analysis_ready.freshness: 'fresh'`
 *      hash pair — it is not an analysis turn), the `!analysedGraphAttested`
 *      guard at mergeAppliedGraph.ts fires unconditionally and calls
 *      `markGraphStructurallyEdited()`, setting `analysisFreshnessDirty: true`
 *      — even though NOTHING analysis-affecting changed.
 *
 * `analysisStateSelector.ts`'s wire branch then reads exactly that: CEE's
 * `run_state.kind === 'complete_current'` (the analysis IS current) AND the
 * store's own `analysisFreshnessDirty === true` (a first-hand claim of an
 * edit CEE was never shown) → `wireCurrencySuperseded` → `semantic: 'changed'`
 * — the composed verdict `useModelChangedSinceRun()` (read by
 * `AnalysisStateCue`) and `useRunCurrency()` (read by every card caption)
 * both consume.
 *
 * ⚠⚠ WHAT EXECUTION DISPROVED, so the next reader does not re-walk it: a
 * fixture where the ONLY difference between CEE's echoed node and the canvas
 * node is the LABEL does **NOT** reproduce the defect, because
 * `store.updateNodeLabel`'s own optimistic local write already applies the
 * new label to the canvas BEFORE the turn is sent (`useConversation.ts`'s "G₀
 * is the canvas before this edit's own optimistic write" note). By the time
 * `reconcileAppliedGraph` runs, `existing.data.label` already equals the
 * server's echoed label, so `overlayNode` sees no diff there and
 * `updatedNodeCount` stays 0 — the bug does NOT fire on label alone once the
 * optimistic write has landed. Proven with an executed probe before writing
 * the RED case below.
 *
 * ⚠ THE FIXTURE THAT DOES REPRODUCE IT — used below — echoes the FACTOR node
 * in the SHAPE `useConversation.structuralRenameOutcome.spec.ts`'s own
 * `stub200()` already asserts CEE sends for a committed rename receipt:
 * `{ id, kind: 'factor', label, category: 'external' }` — omitting
 * `provenance`/`observed_state` (retained from the canvas, no diff there) but
 * carrying `category`, a field the canvas's existing node never had. That one
 * extra COSMETIC key — not the label — is what flips `overlayNode`'s
 * comparison and fires `markGraphStructurallyEdited()`. This is not an
 * invented shape: it is the same committed-node shape another real spec in
 * this repo already exercises for the same `resolveStructuralRename` /
 * `reconcileAppliedGraph` functions.
 *
 * ⚠⚠ SO THE PRECISE FIELD THAT DIFFERED ON THE SERVED 24-SEP INCIDENT IS
 * UNVERIFIED — this harness cannot see CEE's real bytes. What IS proven by
 * execution is the general mechanism: `reconcileAppliedGraph` marks the
 * model structurally edited on ANY byte-level difference in the echoed node,
 * cosmetic or not, whenever the receipt is not the attested analysed graph.
 * A rename is a realistic trigger for that class of diff because CEE's
 * committed-graph echo is the full canonical node and is not guaranteed to
 * be byte-identical to the canvas's local copy in every cosmetic field.
 * Which wire field decided it on staging — `category`, `extractionType`,
 * `factor_type`, key ordering surviving into a non-canonicalised shape, or
 * something else — would need CEE's actual response bytes to confirm.
 *
 * The chain driven here is the REAL one: `store.updateNodeLabel` (captures
 * the real `structural_rename` intent) → `useConversation.sendSystemEvent` →
 * `resolveStructuralRename` → `reconcileAppliedGraph` → the real store →
 * `useAnalysisTrust` / `useModelChangedSinceRun` / `useRunCurrency`. Only the
 * transport (`v5Adapter.callV5Turn`) is mocked, exactly as
 * `runAfterEditStaysCurrent.spec.ts` (D1, the sibling defect on the RUN
 * receipt) does for the same reconcile function.
 *
 * ⚠ WHY THE HASH IS LEFT UNCHANGED IN BOTH FIXTURES BELOW, DELIBERATELY: the
 * RED fixture (rename) and the CONTRAST fixture (value edit) share the exact
 * same wire envelope (`graph_hash` unchanged, `analysis_state:
 * complete_current`, a non-fresh `analysis_ready`) and differ in ONLY the
 * `draft_graph` payload — an added cosmetic `category` key vs. a changed
 * `observed_state.value`. That isolates the one variable this defect is
 * about: it is NOT about whether the hash moved, it is about
 * `reconcileAppliedGraph` failing to distinguish a cosmetic node-data diff
 * from an analytical one before calling `markGraphStructurallyEdited()`.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { AnalysisStateV1Schema, type AnalysisStateV1 } from '@talchain/schemas/boundary'
import { useCanvasStore } from '../../store'
import { mapDraftNodeToCanvas } from '../../utils/applyDraftResult'
import { useRunCurrency } from '../../nodes/shared/runCurrency'
import { useModelChangedSinceRun } from '../../hooks/useModelChangedSinceRun'
import { __resetPendingFactorEditsForTest } from '../pendingFactorEdit'
import type { StructuralRenameIntent } from '../../mutations/structuralRename'

const replies: unknown[] = []
const dispatched: Array<Record<string, unknown>> = []

vi.mock('../../../v5/v5Adapter', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    callV5Turn: vi.fn(async (payload: Record<string, unknown>) => {
      dispatched.push(payload)
      const next = replies.shift()
      if (next === undefined) throw new Error('harness: a turn was dispatched with no reply queued')
      return next
    }),
  }
})
vi.mock('../../../v5/streamedTurnTransport', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    openV5TurnStream: async () => {
      throw new TypeError('Failed to fetch')
    },
  }
})
vi.mock('../../../flags', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, isOrchestratorV2Enabled: () => true, isOrchestratorStreamingEnabled: () => false }
})

import { useConversation } from '../useConversation'

// ── Fixtures ────────────────────────────────────────────────────────────────
const SCENARIO = '7c9e2f5a-1b3d-4e6f-9a0c-2d5b8e1f4a7c'
const FACTOR = 'fac_annual_cost'
/** CEE's `aag_v1` hash — held before the run and UNCHANGED by the rename. */
const H_HELD = '2a6c9f13d4e7b850'

const GOAL = { id: 'goal_profit', kind: 'goal', label: 'Maximise annual profit' }
const OPT_A = { id: 'opt_invest', kind: 'option', label: 'Invest in automation' }
const OPT_B = { id: 'opt_hold', kind: 'option', label: 'Hold current spend' }

const PREVIOUS_LABEL = 'Annual Cost'
const NEW_LABEL = 'Annual Operating Cost'

const FACTOR_AT_OPEN = {
  id: FACTOR,
  kind: 'factor',
  label: PREVIOUS_LABEL,
  provenance: 'ai_inferred',
  observed_state: { value: 120000, source: 'cee_inference', extractionType: 'inferred' },
}

const nodesAtOpen = [GOAL, OPT_A, OPT_B, FACTOR_AT_OPEN]

function draftGraph(nodes: unknown[]) {
  return {
    nodes,
    edges: [],
    node_count: nodes.length,
    edge_count: 0,
    options: [],
    goal_node_id: GOAL.id,
    goal_constraints: [],
  }
}

function readiness(extra: Record<string, unknown>) {
  return {
    status: 'ready',
    goal_node_id: GOAL.id,
    options: [
      { id: OPT_A.id, status: 'ready', interventions: {} },
      { id: OPT_B.id, status: 'ready', interventions: {} },
    ],
    ...extra,
  }
}

/** Built through the REAL contract parser — a fixture that cannot meet the contract certifies nothing. */
function completeCurrent(computedAt: string): AnalysisStateV1 {
  const parsed = AnalysisStateV1Schema.safeParse({
    run_state: { kind: 'complete_current', computed_at: computedAt },
    readiness: { status: 'ready', blockers: [] },
    leader_claim: { permitted: true },
    robustness: {},
    usable_for_prose: true,
    usable_for_chips: true,
    usable_for_followup: true,
    requires_rerun: false,
    blocked_unusable: false,
    contradictions: [],
  })
  if (!parsed.success) throw new Error(`fixture: ${JSON.stringify(parsed.error.issues)}`)
  return parsed.data
}

function analysisBlock(pA: number) {
  return {
    type: 'analysis_result' as const,
    summary: 'Invest in automation leads.',
    leading_option_id: OPT_A.id,
    win_probabilities: { [OPT_A.id]: pA, [OPT_B.id]: Number((1 - pA).toFixed(3)) },
  }
}

function runTurn(opts: { nodes: unknown[]; pA: number; hash: string; computedAt: string }) {
  return {
    ok: true,
    response: {
      assistant_text: 'Invest in automation leads.',
      blocks: [analysisBlock(opts.pA)],
      suggested_actions: [],
      graph_hash: opts.hash,
      analysis_ready: readiness({
        freshness: 'fresh',
        freshness_reason: 'agent_readback_run_state_current',
        graph_hash_at_run: opts.hash,
        current_graph_hash: opts.hash,
        computed_at: opts.computedAt,
      }),
      analysis_state: completeCurrent(opts.computedAt),
      draft_graph: draftGraph(opts.nodes),
    },
  }
}

/**
 * A `structural_rename` turn's committed 200: CEE confirms the new label,
 * the hash it held is UNCHANGED (label is outside the hash projection), and
 * CEE's own wire verdict reaffirms `complete_current` — "that doesn't change
 * the analysis". `analysis_ready` carries no `freshness: 'fresh'` hash pair
 * (this is not an analysis turn), so `receiptIsTheAttestedAnalysedGraph` is
 * false — the same non-attested shape the CONTRAST(#344) fixture in
 * `runAfterEditStaysCurrent.spec.ts` uses for a genuine edit.
 *
 * The committed FACTOR node is echoed in the shape
 * `useConversation.structuralRenameOutcome.spec.ts`'s own `stub200()` already
 * asserts CEE sends for a rename receipt — `{ id, kind, label, category }`,
 * omitting `provenance`/`observed_state` (retained unchanged from the canvas
 * — the wire's absence of a key means "keep what's there", never "clear it").
 * `category` is a real, COSMETIC, persisted-by-default field
 * (`analyticalNodeFields.ts` lists it among the fields excluded from the
 * `stale` taxonomy) the canvas's existing node never had — see the module
 * header for why this, not the label, is what flips `overlayNode`'s
 * comparison once the optimistic write has already applied the label.
 */
function renameTurnReply(intent: StructuralRenameIntent, computedAt: string, committedHash: string | null = H_HELD) {
  return {
    ok: true,
    response: {
      assistant_text: `Renamed to "${intent.label}". That doesn't change the analysis — nothing about the numbers moved.`,
      blocks: [],
      suggested_actions: [],
      // `null` models a reply that carries NO `graph_hash` at all.
      ...(committedHash === null ? {} : { graph_hash: committedHash }),
      analysis_ready: readiness({ computed_at: computedAt }),
      analysis_state: completeCurrent(computedAt),
      draft_graph: draftGraph([
        GOAL,
        OPT_A,
        OPT_B,
        { id: FACTOR, kind: 'factor', label: intent.label, category: 'external' },
      ]),
    },
  }
}

/**
 * CONTRAST: the SAME wire envelope as `renameTurnReply` (unchanged hash,
 * `complete_current`, non-fresh `analysis_ready`) but the payload changes an
 * ANALYTICAL field (`observed_state.value`) instead of the label. Proves the
 * selector is not simply incapable of saying 'changed' — and, after the fix,
 * proves `reconcileAppliedGraph` still dirties the overlay for a real edit.
 */
function valueEditTurnReply(computedAt: string) {
  return {
    ok: true,
    response: {
      assistant_text: 'Updated annual cost 120000 → 150000.',
      blocks: [],
      suggested_actions: [],
      graph_hash: H_HELD,
      analysis_ready: readiness({ computed_at: computedAt }),
      analysis_state: completeCurrent(computedAt),
      draft_graph: draftGraph([
        GOAL,
        OPT_A,
        OPT_B,
        {
          ...FACTOR_AT_OPEN,
          observed_state: { value: 150000, source: 'cee_inference', extractionType: 'inferred' },
        },
      ]),
    },
  }
}

const flush = async () => {
  for (let round = 0; round < 25; round++) {
    for (let i = 0; i < 20; i++) await Promise.resolve()
    await new Promise((r) => setTimeout(r, 1))
  }
}

function currency() {
  return renderHook(() => useRunCurrency()).result.current
}

function modelChangedSinceRun() {
  return renderHook(() => useModelChangedSinceRun()).result.current
}

function labelOf(id: string) {
  const nodes = useCanvasStore.getState().nodes
  return (nodes.find((n) => n.id === id)?.data as { label?: string } | undefined)?.label
}

beforeEach(() => {
  vi.stubEnv('VITE_ENABLE_V5_ORCHESTRATOR', 'true')
  replies.length = 0
  dispatched.length = 0
  __resetPendingFactorEditsForTest()
  useCanvasStore.setState({
    currentScenarioId: SCENARIO,
    nodes: nodesAtOpen.map((n, i) => ({ ...mapDraftNodeToCanvas(n), position: { x: i * 220, y: 0 } })),
    edges: [],
    results: { status: 'idle' } as never,
    analysisFreshness: null,
    analysisFreshnessDirty: false,
    analysisStateV1: null,
    pendingEmittedEdits: 0,
    importPendingServerRegistration: false,
    lastAuthoritativeGraph: { nodeIds: nodesAtOpen.map((n) => n.id), edgePairs: [] },
    pendingStructuralRenames: [],
    structuralRenameLifecycle: [],
    lastServerGraphHash: null,
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
  } as never)
})
afterEach(() => {
  vi.unstubAllEnvs()
})

type Conv = { current: ReturnType<typeof useConversation> }

async function run(result: Conv, reply: unknown) {
  replies.push(reply)
  await act(async () => {
    void result.current.sendMessage('Run the analysis')
    await flush()
  })
  expect(replies.length, 'harness: the run reply was consumed').toBe(0)
  expect(useCanvasStore.getState().results?.status, 'harness: the run hydrated a report').toBe('complete')
}

describe('a pure rename does not claim the model changed since the run', () => {
  it('CONTROL: after the run, before any edit, the model is current', async () => {
    const { result } = renderHook(() => useConversation())
    await run(result, runTurn({ nodes: nodesAtOpen, pA: 0.61, hash: H_HELD, computedAt: '2026-09-24T09:00:00.000Z' }))

    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(false)
    expect(currency()).toBe('current')
    expect(modelChangedSinceRun()).toBe(false)
  })

  it('RED: a confirmed rename, with CEE reaffirming complete_current and an unmoved hash, stays current', async () => {
    const { result } = renderHook(() => useConversation())
    await run(result, runTurn({ nodes: nodesAtOpen, pA: 0.61, hash: H_HELD, computedAt: '2026-09-24T09:00:00.000Z' }))
    expect(currency(), 'precondition: the run is current').toBe('current')

    // The REAL rename gesture — store.updateNodeLabel — captures the real
    // structural_rename intent (not a hand-built one).
    act(() => {
      useCanvasStore.getState().updateNodeLabel(FACTOR, NEW_LABEL)
    })
    expect(labelOf(FACTOR), 'harness: the local optimistic write landed').toBe(NEW_LABEL)
    const intent = useCanvasStore.getState().pendingStructuralRenames.at(-1)
    expect(intent, 'harness: the rename captured a real intent').toBeDefined()
    expect(intent!.baseGraphHash, 'harness: the intent captured a real base hash (not deferred)').toBe(H_HELD)
    expect(intent!.nodeId).toBe(FACTOR)
    expect(intent!.label).toBe(NEW_LABEL)

    replies.push(renameTurnReply(intent!, '2026-09-24T09:05:00.000Z'))
    await act(async () => {
      await result.current
        .sendSystemEvent(
          {
            type: 'structural_rename',
            payload: {
              node_id: intent!.nodeId,
              label: intent!.label,
              expected_label: intent!.expectedLabel,
              base_graph_hash: intent!.baseGraphHash,
            },
          } as never,
          { structuralRename: intent!, debugSource: 'canvas_rename' },
        )
        .catch(() => undefined)
      await flush()
    })
    expect(replies.length, 'harness: the rename reply was consumed').toBe(0)

    // Precondition: the server confirmed the rename and it is on the canvas.
    expect(labelOf(FACTOR), 'precondition: CEE confirmed the new label').toBe(NEW_LABEL)

    const s = useCanvasStore.getState()
    expect(
      s.analysisFreshnessDirty,
      'a pure rename (no analytical field changed) must not dirty the freshness overlay',
    ).toBe(false)
    expect(
      currency(),
      'every card caption would wrongly say "Last run ·" over a run CEE, the response and the store all call current',
    ).toBe('current')
    expect(
      modelChangedSinceRun(),
      'AnalysisStateCue would wrongly render "Model changed · previous findings shown as Last run"',
    ).toBe(false)
  })

  it("CONTRAST: the SAME wire envelope, but an analytical field (observed_state.value) changed — DOES read 'changed'", async () => {
    const { result } = renderHook(() => useConversation())
    await run(result, runTurn({ nodes: nodesAtOpen, pA: 0.61, hash: H_HELD, computedAt: '2026-09-24T09:00:00.000Z' }))
    expect(currency(), 'precondition: the run is current').toBe('current')

    // Receipt-only (no optimistic local write) — isolates the reconcile's own
    // dirtying, exactly like CONTRAST (#344) in runAfterEditStaysCurrent.spec.ts.
    replies.push(valueEditTurnReply('2026-09-24T09:05:00.000Z'))
    await act(async () => {
      void result.current.sendMessage('Set annual cost to 150000')
      await flush()
    })
    expect(replies.length, 'harness: the edit reply was consumed').toBe(0)

    const factor = useCanvasStore.getState().nodes.find((n) => n.id === FACTOR)!.data as {
      observedState?: { value?: number }
    }
    expect(factor.observedState?.value, 'precondition: the receipt changed the canvas').toBe(150000)

    expect(
      useCanvasStore.getState().analysisFreshnessDirty,
      'an analytical change must still dirty the freshness overlay',
    ).toBe(true)
    expect(currency()).toBe('changed')
    expect(modelChangedSinceRun()).toBe(true)
  })

  /**
   * ⭐ THE GATE IS CEE'S HASH, NOT A UI LIST OF "ANALYTICAL FIELDS" (v2, review
   * 5821463627). The SAME rename gesture and the SAME cosmetic-looking echo
   * (`category` is outside the UI's stale taxonomy) — but CEE's committed
   * `graph_hash` MOVED. CEE's projection is the authority on what the analysis
   * reads, so the run is no longer current. A UI-taxonomy gate reads this as
   * "nothing analytical moved" and presents the old run as current.
   */
  async function renameThenReply(opts: { committedHash: string | null }) {
    const { result } = renderHook(() => useConversation())
    await run(result, runTurn({ nodes: nodesAtOpen, pA: 0.61, hash: H_HELD, computedAt: '2026-09-24T09:00:00.000Z' }))
    expect(currency(), 'precondition: the run is current').toBe('current')
    act(() => {
      useCanvasStore.getState().updateNodeLabel(FACTOR, NEW_LABEL)
    })
    const intent = useCanvasStore.getState().pendingStructuralRenames.at(-1)
    expect(intent?.baseGraphHash, 'harness: the intent captured a real base hash').toBe(H_HELD)
    replies.push(renameTurnReply(intent!, '2026-09-24T09:05:00.000Z', opts.committedHash))
    await act(async () => {
      await result.current
        .sendSystemEvent(
          {
            type: 'structural_rename',
            payload: {
              node_id: intent!.nodeId,
              label: intent!.label,
              expected_label: intent!.expectedLabel,
              base_graph_hash: intent!.baseGraphHash,
            },
          } as never,
          { structuralRename: intent!, debugSource: 'canvas_rename' },
        )
        .catch(() => undefined)
      await flush()
    })
    expect(replies.length, 'harness: the rename reply was consumed').toBe(0)
    expect(labelOf(FACTOR), 'precondition: CEE confirmed the new label').toBe(NEW_LABEL)
  }

  it("CONTRAST: the same rename, but CEE's committed graph_hash MOVED — reads 'changed'", async () => {
    await renameThenReply({ committedHash: 'ffffffffffffffff' })
    expect(
      useCanvasStore.getState().analysisFreshnessDirty,
      "CEE's analysis-affecting hash moved: the run no longer describes the model",
    ).toBe(true)
    expect(currency()).toBe('changed')
    expect(modelChangedSinceRun()).toBe(true)
  })

  /**
   * ⛔ NOTHING TO COMPARE IS NOT "UNMOVED" (review 5826775062, non-blocking).
   * The skip needs BOTH sides of the comparison: the base CEE checked and the
   * hash it committed. A reply with no `graph_hash` cannot show the analysis
   * hash held, so the run must read as no longer current.
   *
   * The event-side absence is not driven here: a `structural_rename` sent
   * without `base_graph_hash` never reaches the wire on this path (its reply
   * stays queued, measured while writing this case), so it never reaches the
   * reconcile. The reachable absence is the reply's.
   */
  it("CONTRAST: a base hash was sent but the reply carries no graph_hash — reads 'changed'", async () => {
    await renameThenReply({ committedHash: null })
    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(true)
    expect(currency()).toBe('changed')
    expect(modelChangedSinceRun()).toBe(true)
  })

})
