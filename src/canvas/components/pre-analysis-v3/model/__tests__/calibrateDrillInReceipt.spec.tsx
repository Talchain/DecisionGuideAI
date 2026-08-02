/**
 * ROADMAP 2.304 slice 1 — the pre-analysis drill-in commit is a REAL TURN, and
 * "checked by you" is gated on the RECEIPT.
 *
 * THE DEFECT THIS PINS (design-s3-edit-persistence-2026-08-03.md §2, §3, §7).
 * `CalibrateDrillIn.commitValue` / `commitConfirm` were pure `useCanvasStore`
 * writes: the number never left the browser, CEE's `graph_hash` never moved,
 * and the row stamped **"checked by you"** on the strength of nothing. The
 * user is shown a completion claim about a value the engine has never seen —
 * the same split-brain 2.129 (b) closed for the Model tab and #513 closed for
 * the inspector, still live on the third surface. The #559 lane looked for a
 * receipt on this path and found none, because none was ever requested.
 *
 * WHAT THIS FILE DRIVES, and why it is not a panel-context mock.
 * A receipt is only visible at the DISPATCHER. A refusal is not a failure —
 * CEE answers 200 with prose and `blocks: []`, so no `catch` at the call site
 * can see it, and a spec that mocks `ConversationContext` sits ABOVE the only
 * layer where the reply exists. So this file renders the REAL `CalibrateDrillIn`
 * inside a REAL `ConversationProvider`, derives the row through the REAL
 * `buildEstimateRows` selector, renders the REAL `EstimateRow` pill, and mocks
 * only the TRANSPORT (`callV5Turn`) — `importOriginal`-spread, never a hand
 * listed factory (CLAUDE.md trap 12).
 *
 * THE CLAIM TYPES, precisely (evidence-completeness rule):
 *   1. a drill-in value commit reaches the transport as exactly ONE
 *      `factor_value_edit` event carrying the model-scale value (and the
 *      user-unit magnitude when the factor declares a scale);
 *   2. the reviewed state ("checked by you") appears ONLY after an applied
 *      `graph_patch` receipt for that target — not at commit, not at dispatch;
 *   3. a refusal (200, no receipt) REVERTS the optimistic number and leaves the
 *      pre-edit provenance intact;
 *   4. the #559 normalised-scale entry guard still runs BEFORE any dispatch;
 *   5. "Confirm as is" is the same turn, receipt-gated the same way.
 * It does NOT claim anything about baseline / prior / edge edits — the contract
 * carries no value event for those (`factor_value_edit.field` is the literal
 * `'value'`).
 *
 * FENCE-409 POSTURE (verified, not assumed — see the last describe). A typed
 * 409 on a system-mode turn renders NO transcript bubble by design
 * (`useConversation`'s typed_error branch gates the bubble on `mode === 'user'`)
 * and does NOT revert (the resolution branch excludes `typed_error` so the
 * deferral buffer owns retries). That is the machinery's EXISTING posture,
 * shared byte-for-byte with the Model tab and the inspector; this surface
 * inherits it rather than growing a private one. The test pins that inheritance
 * so a future divergence on one surface goes RED.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import type { Node } from '@xyflow/react'

/** Every payload that reached the transport, in order. */
const dispatched: Array<Record<string, unknown>> = []
/** Reply bodies the transport answers with, in order. */
const replies: Array<Record<string, unknown>> = []
/** Boundary errors the transport answers with, in order (409 fence class). */
const boundaryErrors: Array<Record<string, unknown>> = []
/** When true, the first turn is held open until `releaseInFlight` is called. */
let holdFirstTurn = false
let resolveInFlight: ((v: unknown) => void) | null = null

vi.mock('../../../../../v5/v5Adapter', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    callV5Turn: vi.fn(async (payload: Record<string, unknown>) => {
      dispatched.push(payload)
      if (holdFirstTurn && dispatched.length === 1) {
        await new Promise((res) => {
          resolveInFlight = res
        })
      }
      const boundary = boundaryErrors.shift()
      if (boundary) return { kind: 'boundary_error', error: boundary }
      const response = replies.shift() ?? { assistant_text: 'ok', blocks: [] }
      return { kind: 'response', response }
    }),
  }
})

vi.mock('../../../../../flags', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    isOrchestratorV2Enabled: () => true,
    isOrchestratorStreamingEnabled: () => false,
  }
})

import { CalibrateDrillIn } from '../CalibrateDrillIn'
import { EstimateRow } from '../EstimateRow'
import { buildEstimateRows } from '../../selectors/buildEstimateRows'
import { ConversationProvider } from '../../../../conversation/ConversationContext'
import { useCanvasStore } from '../../../../store'
import { getObservedState } from '../../../../utils/observedStateHelpers'
import type { RankingResult } from '../../types'

const SCENARIO = 'a0a0a0a0-b1b1-4c2c-8d3d-e4e4e4e4e4e4'
const FACTOR_ID = 'fac_delivery_time'
const CAP = 6
const LABEL = 'Estimated Delivery Time'

/** CEE's own estimate of 3 months on a factor capped at 6 (model scale 0.5). */
const PRIOR_OBSERVED = {
  value: 0.5,
  raw_value: 3,
  unit: 'months',
  cap: CAP,
  source: 'cee_inference',
}

const NEW_RAW = 5
const NEW_MODEL = NEW_RAW / CAP

function factorNode(observed: Record<string, unknown> = { ...PRIOR_OBSERVED }): Node {
  return {
    id: FACTOR_ID,
    type: 'factor',
    position: { x: 0, y: 0 },
    data: {
      kind: 'factor',
      label: LABEL,
      display_value: '3 months',
      observedState: observed,
    },
  } as unknown as Node
}

function seed(node: Node = factorNode()): void {
  useCanvasStore.setState(
    {
      currentScenarioId: SCENARIO,
      nodes: [node],
      edges: [],
      results: { status: 'idle' } as never,
      analysisFreshness: null,
      analysisFreshnessDirty: false,
      pendingEmittedEdits: 0,
      selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
    } as never,
    false,
  )
}

const ranking: RankingResult = {
  source: 'degree',
  weights: { [FACTOR_ID]: 1 },
  ordered: [FACTOR_ID],
}

/**
 * The REAL derivation chain: store → `buildEstimateRows` → `EstimateRow` pill,
 * with the REAL drill-in beneath it. A mutant that stamps the reviewed source
 * at commit or at dispatch flips this pill early, which is the whole point.
 */
function Harness(): JSX.Element {
  const nodes = useCanvasStore((s) => s.nodes)
  const rows = buildEstimateRows(nodes, ranking, null)
  const row = rows[0]
  if (!row) return <div />
  return (
    <>
      <EstimateRow row={row} expanded onToggle={() => {}} />
      <CalibrateDrillIn row={row} onDone={() => {}} />
    </>
  )
}

function renderHarness() {
  return render(
    <ConversationProvider>
      <Harness />
    </ConversationProvider>,
  )
}

/** CEE's ACCEPTANCE — the applied `graph_patch` receipt for this target. */
const acceptance = (model: number, raw: number) => ({
  assistant_text: `Updated ${LABEL} from 3 months to ${raw} months.`,
  blocks: [
    {
      type: 'graph_patch',
      status: 'applied',
      operation: 'set_factor_value',
      target_id: FACTOR_ID,
      before: { value: 0.5, raw_value: 3, unit: 'months', cap: CAP },
      after: { value: model, raw_value: raw, unit: 'months', cap: CAP },
    },
  ],
  graph_hash: 'f0719cb3b8905ef4',
})

/**
 * CEE's REFUSAL, verbatim in shape: prose, EMPTY blocks, no graph_hash. There
 * is no `status: 'rejected'` on the wire — the ABSENCE of an applied receipt is
 * the only machine-readable signal.
 */
const REFUSAL = {
  assistant_text:
    "Value 25 months exceeds the factor's cap of 6 months. I haven't changed anything.",
  blocks: [],
}

/** A fence-class GRAPH_DIVERGED 409 — the typed refusal shape (#559). */
const FENCE_409 = {
  error: 'GRAPH_DIVERGED',
  message: 'graph fence conflict',
  retryable: true,
  request_id: 'req_fence_1',
  details: { phase: 'commit', conflict_category: 'turn_fence_superseded' },
}

function factorValueEdits(): Array<Record<string, unknown>> {
  return dispatched
    .filter((p) => (p as { event?: { kind?: string } }).event?.kind === 'factor_value_edit')
    .map((p) => (p as { event: Record<string, unknown> }).event)
}

function observedNow(): Record<string, unknown> {
  const node = useCanvasStore.getState().nodes.find((n) => n.id === FACTOR_ID)
  return getObservedState(node?.data) as Record<string, unknown>
}

const flush = async () => {
  // Drain microtasks AND macrotasks: the dispatch, the response-processing path
  // and the buffer flush each contain real awaits, so a fixed microtask count
  // is not enough.
  for (let round = 0; round < 25; round++) {
    for (let i = 0; i < 20; i++) await Promise.resolve()
    await new Promise((r) => setTimeout(r, 1))
  }
}

function typeAndSave(text: string): void {
  fireEvent.change(screen.getByLabelText(`Your estimate for ${LABEL}`), {
    target: { value: text },
  })
  fireEvent.click(screen.getByLabelText(`Save estimate for ${LABEL}`))
}

beforeEach(() => {
  vi.stubEnv('VITE_ENABLE_V5_ORCHESTRATOR', 'true')
  dispatched.length = 0
  replies.length = 0
  boundaryErrors.length = 0
  holdFirstTurn = false
  resolveInFlight = null
  seed()
})

afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
})

describe('the drill-in commit is a real factor_value_edit turn (2.304 slice 1)', () => {
  it('a value commit dispatches EXACTLY ONE factor_value_edit carrying the model-scale value and the user-unit magnitude', async () => {
    replies.push(acceptance(NEW_MODEL, NEW_RAW))
    renderHarness()
    await act(async () => {
      typeAndSave(String(NEW_RAW))
      await flush()
    })

    const edits = factorValueEdits()
    expect(edits).toHaveLength(1)
    expect(edits[0]).toEqual({
      kind: 'factor_value_edit',
      target_id: FACTOR_ID,
      value: NEW_MODEL,
      raw_value: NEW_RAW,
      unit: 'months',
      field: 'value',
    })
  })

  it('"Confirm as is" dispatches the same turn, carrying the value the user is confirming', async () => {
    replies.push({ assistant_text: 'ok', blocks: [] })
    renderHarness()
    await act(async () => {
      fireEvent.click(screen.getByTestId('pre-analysis-v3-confirm-as-is'))
      await flush()
    })

    const edits = factorValueEdits()
    expect(edits).toHaveLength(1)
    expect(edits[0]).toMatchObject({
      kind: 'factor_value_edit',
      target_id: FACTOR_ID,
      value: PRIOR_OBSERVED.value,
      raw_value: PRIOR_OBSERVED.raw_value,
    })
  })
})

describe('"checked by you" is gated on the RECEIPT, not on the commit or the dispatch', () => {
  it('does NOT claim the row is checked while the turn is still in flight', async () => {
    holdFirstTurn = true
    replies.push(acceptance(NEW_MODEL, NEW_RAW))
    renderHarness()
    await act(async () => {
      typeAndSave(String(NEW_RAW))
      await flush()
    })

    // The turn is dispatched and unanswered: the number may show optimistically,
    // but the completion claim must not.
    expect(factorValueEdits()).toHaveLength(1)
    expect(screen.queryByText('checked by you')).not.toBeInTheDocument()
    expect(observedNow().source).toBe('cee_inference')

    await act(async () => {
      resolveInFlight?.(undefined)
      await flush()
    })

    expect(screen.getByText('checked by you')).toBeInTheDocument()
    expect(observedNow().source).toBe('user_override')
  })

  it('stamps the row checked once the applied graph_patch receipt lands', async () => {
    replies.push(acceptance(NEW_MODEL, NEW_RAW))
    renderHarness()
    await act(async () => {
      typeAndSave(String(NEW_RAW))
      await flush()
    })

    // The dispatch assertion is load-bearing HERE too: without it this test
    // passes vacuously against the pristine store-only write, which stamped
    // `user_override` with no turn at all (trap 13).
    expect(factorValueEdits()).toHaveLength(1)
    expect(observedNow().source).toBe('user_override')
    expect(observedNow().value).toBe(NEW_MODEL)
    expect(screen.getByText('checked by you')).toBeInTheDocument()
  })

  it('"Confirm as is" only stamps user_confirmed after its own receipt', async () => {
    holdFirstTurn = true
    replies.push(acceptance(PRIOR_OBSERVED.value, PRIOR_OBSERVED.raw_value))
    renderHarness()
    await act(async () => {
      fireEvent.click(screen.getByTestId('pre-analysis-v3-confirm-as-is'))
      await flush()
    })
    expect(observedNow().source).toBe('cee_inference')
    expect(screen.queryByText('checked by you')).not.toBeInTheDocument()

    await act(async () => {
      resolveInFlight?.(undefined)
      await flush()
    })
    expect(observedNow().source).toBe('user_confirmed')
    expect(observedNow().extractionType).toBe('explicit')
    expect(screen.getByText('checked by you')).toBeInTheDocument()
  })

  it('a REFUSED commit (200, no receipt) reverts the optimistic number and never claims the row is checked', async () => {
    replies.push(REFUSAL)
    renderHarness()
    await act(async () => {
      typeAndSave(String(NEW_RAW))
      await flush()
    })

    expect(factorValueEdits()).toHaveLength(1)
    // The pre-edit state is back, whole: value, magnitude AND provenance.
    expect(observedNow().value).toBe(PRIOR_OBSERVED.value)
    expect(observedNow().raw_value).toBe(PRIOR_OBSERVED.raw_value)
    expect(observedNow().source).toBe('cee_inference')
    expect(screen.queryByText('checked by you')).not.toBeInTheDocument()
    expect(screen.getByText('Olumi estimate')).toBeInTheDocument()
  })
})

describe('controls — the fix must not be satisfiable by something cheaper and wrong', () => {
  it('the #559 normalised-scale entry guard still runs BEFORE any dispatch', async () => {
    // The walk shape: no cap, no unit, no raw anchor, a declared model-scale
    // value in [0,1]. A magnitude entry must be refused at entry — nothing
    // written, nothing sent.
    seed(
      factorNode({ value: 0, display_value: 'Low (0)', source: 'cee_inference' }) as never,
    )
    renderHarness()
    await act(async () => {
      typeAndSave('£60,000')
      await flush()
    })

    expect(factorValueEdits()).toHaveLength(0)
    expect(observedNow().raw_value).toBeUndefined()
    expect(observedNow().value).toBe(0)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('an unparseable entry commits nothing and sends nothing', async () => {
    renderHarness()
    await act(async () => {
      typeAndSave('quite a lot')
      await flush()
    })
    expect(factorValueEdits()).toHaveLength(0)
    expect(observedNow().value).toBe(PRIOR_OBSERVED.value)
  })

  it('a LATE receipt does not stamp a value that has moved on since the send', async () => {
    holdFirstTurn = true
    replies.push(acceptance(NEW_MODEL, NEW_RAW))
    renderHarness()
    await act(async () => {
      typeAndSave(String(NEW_RAW))
      await flush()
    })

    // Something newer happens while the turn is in flight — an undo, a scenario
    // load, a server patch. The receipt below is about a number the node no
    // longer holds, so the review claim it would earn is about a value the user
    // never reviewed.
    await act(async () => {
      const store = useCanvasStore.getState()
      const node = store.nodes.find((n) => n.id === FACTOR_ID)!
      store.updateNode(FACTOR_ID, {
        data: {
          ...(node.data as Record<string, unknown>),
          observedState: { ...PRIOR_OBSERVED },
        },
      } as never)
      resolveInFlight?.(undefined)
      await flush()
    })

    expect(observedNow().source).toBe('cee_inference')
    expect(screen.queryByText('checked by you')).not.toBeInTheDocument()
  })

  it('an ACCEPTED commit is never reverted (a fix that reverted unconditionally would pass every RED assertion)', async () => {
    replies.push(acceptance(NEW_MODEL, NEW_RAW))
    renderHarness()
    await act(async () => {
      typeAndSave(String(NEW_RAW))
      await flush()
    })
    expect(observedNow().value).toBe(NEW_MODEL)
    expect(observedNow().raw_value).toBe(NEW_RAW)
  })
})

describe('fence-409 posture — INHERITED from the shared machinery, verified not assumed', () => {
  it('a typed fence 409 renders no transcript bubble and does not revert (the deferral buffer owns retries)', async () => {
    boundaryErrors.push(FENCE_409)
    renderHarness()
    await act(async () => {
      typeAndSave(String(NEW_RAW))
      await flush()
    })

    expect(factorValueEdits()).toHaveLength(1)
    // System-mode turns render no synthetic bubble — `resolveFenceRefusalCopy`
    // is reached only from the `mode === 'user'` branch and TypedErrorRenderer.
    // The fence copy therefore does NOT appear on this path, exactly as it does
    // not on the Model tab or the inspector.
    expect(
      screen.queryByText(/wasn't saved because a newer change/i),
    ).not.toBeInTheDocument()
    // And the optimistic write stands: a typed error is a FAILURE, excluded
    // from the receipt-resolution branch by design.
    expect(observedNow().value).toBe(NEW_MODEL)
    // The completion claim still requires a receipt, which never arrived.
    expect(observedNow().source).toBe('cee_inference')
    expect(screen.queryByText('checked by you')).not.toBeInTheDocument()
  })
})
