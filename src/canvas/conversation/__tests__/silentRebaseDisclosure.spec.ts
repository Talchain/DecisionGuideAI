/**
 * ROADMAP 2.312 — the measured sequence, end to end, through the real dispatcher.
 *
 * THE WALK THIS REPRODUCES (`PHASE0-EVIDENCE-2026-07-28/probe-560-confirm-as-is-receipt.md`
 * §6, deployed guest build):
 *
 *   1. An edit is committed and CEE persists it.
 *   2. The tab is RELOADED. The boot path restores
 *      `localStorage['olumi-canvas-autosave']` and fetches no graph — the whole
 *      boot request manifest is 7 requests and none of them is the scenario
 *      graph. The Model tab therefore renders the ORIGINAL drafted figure,
 *      `Monthly Observability Spend · From brief · £4,000`, while a message turn
 *      in the same session had CEE saying, in its own prose, that the model held
 *      a different number.
 *   3. The operator edits against that stale figure. CEE applies the change on
 *      top of ITS base and reports "Updated … from £3,500 to £4,200" — a
 *      before-value that appeared nowhere on the operator's screen.
 *
 * Step 3 is the data-integrity defect: the canonical graph is edited against a
 * base the user never saw, silently. This file pins that it can no longer be
 * silent.
 *
 * WHY IT DRIVES THE DISPATCHER AND NOT A PANEL. The engine's own base for the
 * edit is visible in exactly one place — the applied `graph_patch` receipt on
 * the reply — and a panel spec that mocks `ConversationContext` sits above the
 * only layer that sees a reply. Same reasoning, and the same harness, as
 * `optimisticFactorEditRevert.spec.ts`, which pins the refusal direction.
 *
 * HOW THE STALE BOOT IS STAGED, stated plainly so the scope is not overread.
 * Step 2 is reproduced through the production restore CALL — `saveAutosave` →
 * `loadAutosave` → `hydrateGraphSlice`, which is exactly what
 * `ReactFlowGraph.tsx:1377-1416` does on boot — rather than by mounting the
 * canvas component. So this file proves the STORE state the boot produces and
 * everything downstream of it. It does NOT re-prove the network manifest; that
 * is the probe's measurement, cited above, and jsdom could not prove it anyway.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { Node } from '@xyflow/react'
import { useCanvasStore } from '../../store'
import { saveAutosave, loadAutosave, clearAutosave } from '../../store/scenarios'
import type { WireSystemEvent } from '../types'
import { captureOptimisticFactorEdit } from '../optimisticFactorEdit'

const replies: Array<Record<string, unknown>> = []
const dispatched: Array<Record<string, unknown>> = []

// Mock the TRANSPORT, not the context (CLAUDE.md trap 12: `importOriginal`
// spread, never a hand-listed factory).
vi.mock('../../../v5/v5Adapter', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    callV5Turn: vi.fn(async (payload: Record<string, unknown>) => {
      dispatched.push(payload)
      const response = replies.shift() ?? { assistant_text: 'ok', blocks: [] }
      return { ok: true, response }
    }),
  }
})

vi.mock('../../../flags', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    isOrchestratorV2Enabled: () => true,
    isOrchestratorStreamingEnabled: () => false,
  }
})

import { useConversation } from '../useConversation'

const SCENARIO = 'cbce69ac-1111-4222-8333-444444444444'
const FACTOR_ID = 'fac_monthly_cost'
const CAP = 5000

/**
 * The node as the STALE autosave record holds it — copied in shape from the
 * probe's own capture of `localStorage['olumi-canvas-autosave']`:
 *   "id":"fac_monthly_cost" … "display_value":"£4k","provenance":"from_brief"
 *   "observedState":{"value":0.8,"unit":"£","source":"brief_extraction",
 *                    "raw_value":4000,"cap":5000}
 */
function staleFactorNode(): Node {
  return {
    id: FACTOR_ID,
    type: 'factor',
    position: { x: 0, y: 0 },
    data: {
      label: 'Monthly Observability Spend',
      category: 'controllable',
      display_value: '£4k',
      provenance: 'from_brief',
      observedState: {
        value: 0.8,
        raw_value: 4000,
        unit: '£',
        cap: CAP,
        source: 'brief_extraction',
      },
    },
  } as Node
}

/** The operator's entry: £4,200 → model scale 4200/5000. */
const TYPED_RAW = 4200
const TYPED_MODEL = TYPED_RAW / CAP

const edit = (): WireSystemEvent => ({
  type: 'factor_value_edit',
  payload: {
    target_id: FACTOR_ID,
    value: TYPED_MODEL,
    raw_value: TYPED_RAW,
    unit: '£',
    field: 'value',
  },
})

/**
 * CEE's reply, verbatim in shape from the probe: an APPLIED receipt whose
 * `before` is £3,500 — the base the operator never saw.
 */
const REBASED_ACCEPTANCE = {
  assistant_text: 'Updated Monthly Observability Spend from £3,500 to £4,200.',
  blocks: [
    {
      type: 'graph_patch',
      status: 'applied',
      operation: 'set_factor_value',
      target_id: FACTOR_ID,
      before: { value: 0.7, raw_value: 3500, unit: '£', cap: CAP },
      after: { value: TYPED_MODEL, raw_value: TYPED_RAW, unit: '£', cap: CAP },
    },
  ],
  graph_hash: 'c41b7a02e9d3f815',
}

/** The same reply with the base the operator DID see — the control. */
const IN_STEP_ACCEPTANCE = {
  ...REBASED_ACCEPTANCE,
  assistant_text: 'Updated Monthly Observability Spend from £4,000 to £4,200.',
  blocks: [
    {
      ...REBASED_ACCEPTANCE.blocks[0],
      before: { value: 0.8, raw_value: 4000, unit: '£', cap: CAP },
    },
  ],
}

/** The panel's optimistic write, through the same sanctioned setter it uses. */
function writeOptimistically() {
  const store = useCanvasStore.getState()
  const node = store.nodes.find((n) => n.id === FACTOR_ID)!
  const existing = (node.data as Record<string, unknown>).observedState as Record<string, unknown>
  store.updateNode(FACTOR_ID, {
    data: {
      ...(node.data as Record<string, unknown>),
      display_value: undefined,
      observedState: {
        ...existing,
        value: TYPED_MODEL,
        raw_value: TYPED_RAW,
        source: 'user',
        display_value: undefined,
      },
    },
  } as never)
}

const flush = async () => {
  for (let round = 0; round < 25; round++) {
    for (let i = 0; i < 20; i++) await Promise.resolve()
    await new Promise((r) => setTimeout(r, 1))
  }
}

/**
 * Step 2 of the walk: the production boot restore, by its own calls.
 * `ReactFlowGraph.tsx:1377` reads `loadAutosave()` and passes `nodes`/`edges`
 * straight to `hydrateGraphSlice` — reproduced here exactly, so what the
 * operator is looking at in step 3 is genuinely what the restore produced.
 */
function bootRestoreFromAutosave() {
  const autosave = loadAutosave()
  expect(autosave, 'the autosave slot is what boot restores from').not.toBeNull()
  useCanvasStore.getState().hydrateGraphSlice({
    nodes: autosave!.nodes,
    edges: autosave!.edges,
  } as never)
  useCanvasStore.setState({ currentScenarioId: SCENARIO } as never)
}

beforeEach(() => {
  vi.stubEnv('VITE_ENABLE_V5_ORCHESTRATOR', 'true')
  dispatched.length = 0
  replies.length = 0
  clearAutosave()
  useCanvasStore.setState({
    currentScenarioId: SCENARIO,
    nodes: [],
    edges: [],
    results: { status: 'idle' } as never,
    analysisFreshness: null,
    analysisFreshnessDirty: false,
    pendingEmittedEdits: 0,
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
  } as never)
  // Step 1→2: the stale record is in the autosave slot, as the probe found it.
  saveAutosave({
    nodes: [staleFactorNode()],
    edges: [],
    timestamp: Date.now(),
    scenarioId: SCENARIO,
  } as never)
})

afterEach(() => {
  vi.unstubAllEnvs()
  clearAutosave()
})

/**
 * The phrase only the divergence disclosure emits. Deliberately a fragment of
 * the SENTENCE and not a word like "stale" — the copy makes no claim about
 * which side moved, so there is no directional word to key off.
 */
const DISCLOSURE_MARK = 'on top of'

/** Every synthetic assistant line the turn produced. */
function syntheticLines(messages: ReadonlyArray<Record<string, unknown>>): string[] {
  return messages
    .filter((m) => m.synthetic === true && typeof m.content === 'string')
    .map((m) => String(m.content))
}

describe('an edit made against a STALE canvas is no longer silently rebased', () => {
  it('tells the operator the engine held £3,500, not the £4,000 they were shown', async () => {
    bootRestoreFromAutosave()

    // What the operator is looking at: the ORIGINAL drafted figure, restored
    // from localStorage, exactly as the Model tab rendered it in the probe.
    const shownNode = useCanvasStore.getState().nodes.find((n) => n.id === FACTOR_ID)!
    const shownObserved = (shownNode.data as Record<string, unknown>)
      .observedState as Record<string, unknown>
    expect(shownObserved.raw_value, 'the tab shows the stale £4,000').toBe(4000)

    const { result } = renderHook(() => useConversation())
    const undo = captureOptimisticFactorEdit(FACTOR_ID, TYPED_MODEL, shownNode.data)!
    writeOptimistically()

    replies.push(REBASED_ACCEPTANCE)
    await act(async () => {
      await result.current.sendSystemEvent(edit(), { optimisticFactorEdit: undo })
    })
    await flush()

    // RED before the fix: nothing anywhere named £3,500. The operator's model
    // had been rebased onto a number that appeared on no screen they saw.
    const lines = syntheticLines(result.current.messages as never)
    const disclosure = lines.find((l) => l.includes('£3,500'))
    expect(disclosure, 'the engine’s real base must be disclosed').toBeDefined()
    expect(disclosure).toContain('Monthly Observability Spend')
    expect(disclosure).toContain('£4,000')
  })

  it('keeps the value the engine accepted — disclosure is not a revert', async () => {
    // The number the operator chose IS what the engine now holds, so reverting
    // it would swap a silent wrong base for silently discarded work.
    bootRestoreFromAutosave()
    const { result } = renderHook(() => useConversation())
    const node = useCanvasStore.getState().nodes.find((n) => n.id === FACTOR_ID)!
    const undo = captureOptimisticFactorEdit(FACTOR_ID, TYPED_MODEL, node.data)!
    writeOptimistically()

    replies.push(REBASED_ACCEPTANCE)
    await act(async () => {
      await result.current.sendSystemEvent(edit(), { optimisticFactorEdit: undo })
    })
    await flush()

    const observed = (
      useCanvasStore.getState().nodes.find((n) => n.id === FACTOR_ID)!.data as Record<string, unknown>
    ).observedState as Record<string, unknown>
    expect(observed.raw_value).toBe(TYPED_RAW)
    expect(observed.value).toBe(TYPED_MODEL)
  })

  it('CONTROL — an edit made against an IN-STEP canvas says nothing', async () => {
    // Blocks the cheap wrong fix: a disclosure emitted on every applied receipt
    // would satisfy the RED above and shout at every ordinary edit.
    bootRestoreFromAutosave()
    const { result } = renderHook(() => useConversation())
    const node = useCanvasStore.getState().nodes.find((n) => n.id === FACTOR_ID)!
    const undo = captureOptimisticFactorEdit(FACTOR_ID, TYPED_MODEL, node.data)!
    writeOptimistically()

    replies.push(IN_STEP_ACCEPTANCE)
    await act(async () => {
      await result.current.sendSystemEvent(edit(), { optimisticFactorEdit: undo })
    })
    await flush()

    const lines = syntheticLines(result.current.messages as never)
    expect(lines.filter((l) => l.includes(DISCLOSURE_MARK))).toEqual([])
  })

  it('CONTROL — a REFUSED edit discloses no base and still reverts', async () => {
    // The refusal reply carries no receipt, so there is no engine base to
    // disclose; the 2.129 revert must be untouched by this change.
    bootRestoreFromAutosave()
    const { result } = renderHook(() => useConversation())
    const node = useCanvasStore.getState().nodes.find((n) => n.id === FACTOR_ID)!
    const undo = captureOptimisticFactorEdit(FACTOR_ID, TYPED_MODEL, node.data)!
    writeOptimistically()

    replies.push({ assistant_text: "That exceeds the cap. I haven't changed anything.", blocks: [] })
    await act(async () => {
      await result.current.sendSystemEvent(edit(), { optimisticFactorEdit: undo })
    })
    await flush()

    const observed = (
      useCanvasStore.getState().nodes.find((n) => n.id === FACTOR_ID)!.data as Record<string, unknown>
    ).observedState as Record<string, unknown>
    expect(observed.raw_value, 'the refused value is rolled back').toBe(4000)
    const lines = syntheticLines(result.current.messages as never)
    expect(lines.filter((l) => l.includes(DISCLOSURE_MARK))).toEqual([])
  })

  /**
   * CANVAS AHEAD — the same evidence, the opposite cause, and no techMode gate.
   *
   * A factor with no `raw_value` on EITHER side, written locally over a
   * server-held value, produces a receipt indistinguishable from the stale-boot
   * walk: two bases that differ. Here the canvas is AHEAD of the engine, not
   * behind it. An earlier draft opened the disclosure with "Your canvas was out
   * of date" and reported this case as the canvas being stale — a diagnosis the
   * receipt cannot support, in a message whose entire purpose is to stop the
   * product asserting things it has not established.
   */
  it('CONTROL — a CANVAS-AHEAD divergence is disclosed without blaming either side', async () => {
    const MORALE = 'fac_team_morale'
    useCanvasStore.setState({
      nodes: [
        {
          id: MORALE,
          type: 'factor',
          position: { x: 0, y: 0 },
          data: {
            label: 'Team morale',
            category: 'controllable',
            // No raw_value, no unit, no cap — the uncapped/unitless shape.
            // The canvas already sits AHEAD at 0.6 from an earlier local write
            // the engine never took; the engine still holds 0.4.
            observedState: { value: 0.6, source: 'user' },
          },
        },
      ],
    } as never)

    const { result } = renderHook(() => useConversation())
    const node = useCanvasStore.getState().nodes.find((n) => n.id === MORALE)!
    const undo = captureOptimisticFactorEdit(MORALE, 0.7, node.data)!
    useCanvasStore.getState().updateNode(MORALE, {
      data: {
        ...(node.data as Record<string, unknown>),
        observedState: { value: 0.7, source: 'user' },
      },
    } as never)

    replies.push({
      assistant_text: 'Updated Team morale.',
      blocks: [
        {
          type: 'graph_patch',
          status: 'applied',
          operation: 'set_factor_value',
          target_id: MORALE,
          before: { value: 0.4 },
          after: { value: 0.7 },
        },
      ],
    })
    await act(async () => {
      await result.current.sendSystemEvent(
        { type: 'factor_value_edit', payload: { target_id: MORALE, value: 0.7, field: 'value' } },
        { optimisticFactorEdit: undo },
      )
    })
    await flush()

    const disclosure = syntheticLines(result.current.messages as never).find((l) =>
      l.includes(DISCLOSURE_MARK),
    )
    expect(disclosure, 'the divergence is still disclosed').toBeDefined()
    expect(disclosure).toContain('Team morale')
    expect(disclosure).toContain('0.4')
    expect(disclosure).toContain('0.6')
    // RED before the amendment: the sentence opened "Your canvas was out of
    // date" over a canvas that was ahead.
    for (const causal of ['out of date', 'stale', 'behind']) {
      expect(disclosure!.toLowerCase(), `must not diagnose "${causal}"`).not.toContain(causal)
    }
    // And the magnitudes must be numbers, not "low"/"moderate".
    expect(disclosure).not.toMatch(/\b(very low|low|moderate|high|very high)\b/)
  })
})
