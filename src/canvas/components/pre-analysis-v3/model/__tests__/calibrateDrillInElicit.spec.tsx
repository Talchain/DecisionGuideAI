/**
 * ROADMAP 2.364 — "say it in words" commits through the EXISTING
 * `factor_value_edit` lane, at the RIGHT SCALE.
 *
 * WHAT THIS FILE DRIVES. The REAL `CalibrateDrillIn` inside a REAL
 * `ConversationProvider`, with the row derived through the REAL
 * `buildEstimateRows` selector, mocking only the two TRANSPORTS — `callV5Turn`
 * (the turn wire) and `CEEClient.elicitBelief` (the elicitation wire) — both by
 * `importOriginal`-spread, never a hand-listed factory (CLAUDE.md trap 12).
 * Everything between them, including the scale module, is the shipped code.
 *
 * THE CLAIM TYPES, precisely:
 *   1. accepting an elicited suggestion dispatches EXACTLY ONE
 *      `factor_value_edit` event for THAT factor id, carrying the probability
 *      as `value` and NO `raw_value`/`unit` — the shape CEE's
 *      `resolveUserUnitInput` inverts with the factor's OWN stored cap;
 *   2. the scale is right on BOTH witnessed row shapes — a cap-bearing factor
 *      and the capless/unitless walk row;
 *   3. the displayed chance is read from `suggested_value` and nowhere else;
 *   4. an ambiguous phrase renders the ENGINE's clarifying question and its own
 *      option labels, and a chip commits THAT chip's value;
 *   5. accepting emits the wire event — deleting `sendSystemEvent` from the
 *      accept path must go RED (the 2.365 silent-local-commit class).
 * It claims NOTHING about the receipt/stamp timing — that is
 * `calibrateDrillInReceipt.spec.tsx`'s subject and this path shares its
 * `commit`, unmodified.
 *
 * ⭐ THE CORRECTED-PREMISE CONTROL (the last test). The original design said
 * to commit `Math.round(suggested_value * 100)` "as if the user had typed
 * 70%". The control drives THAT path on the walk row and shows it is REFUSED
 * — nothing committed, nothing dispatched, honest hint shown. It is pinned
 * here, beside the working path, so nobody re-proposes it from the design doc
 * without meeting the measurement that retired it.
 *
 * RED-first at pristine `0c4e2cc3`: no elicitation affordance exists, so the
 * "Describe your estimate … in words" control is not in the tree and every
 * test except the corrected-premise control fails at `getByLabelText`.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import type { Node } from '@xyflow/react'

/** Every turn payload that reached the transport, in order. */
const dispatched: Array<Record<string, unknown>> = []
/** Elicitation replies the mocked CEE client answers with, in order. */
const elicitReplies: Array<Record<string, unknown>> = []
/** Every elicitation request body, in order — the request contract at the seam. */
const elicitRequests: Array<Record<string, unknown>> = []
/** Turn replies, in order. Empty ⇒ the default REFUSAL (prose, no receipt). */
const replies: Array<Record<string, unknown>> = []
/**
 * When true the turn never resolves, so the OPTIMISTIC local write stands and
 * can be asserted. Without it, the default reply is a refusal (200, prose,
 * `blocks: []`) and `revertOptimisticFactorEdit` correctly restores the
 * pre-edit state — which would mask a commit that never wrote anything.
 */
let holdTurn = false

vi.mock('../../../../../v5/v5Adapter', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    callV5Turn: vi.fn(async (payload: Record<string, unknown>) => {
      dispatched.push(payload)
      if (holdTurn) await new Promise(() => {})
      const response = replies.shift() ?? { assistant_text: 'ok', blocks: [] }
      return { kind: 'response', response }
    }),
  }
})

vi.mock('../../../../../adapters/cee/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../../adapters/cee/client')>()
  class MockCEEClient extends actual.CEEClient {
    async elicitBelief(input: Parameters<InstanceType<typeof actual.CEEClient>['elicitBelief']>[0]) {
      elicitRequests.push(input as unknown as Record<string, unknown>)
      const reply = elicitReplies.shift()
      if (!reply) throw new Error('no elicitation reply queued')
      return reply as unknown as Awaited<
        ReturnType<InstanceType<typeof actual.CEEClient>['elicitBelief']>
      >
    }
  }
  return { ...actual, CEEClient: MockCEEClient }
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
import { buildEstimateRows } from '../../selectors/buildEstimateRows'
import { ConversationProvider } from '../../../../conversation/ConversationContext'
import { useCanvasStore } from '../../../../store'
import { getObservedState } from '../../../../utils/observedStateHelpers'
import type { RankingResult } from '../../types'

const SCENARIO = 'a0a0a0a0-b1b1-4c2c-8d3d-e4e4e4e4e4e4'

/** The witnessed live reply for "pretty likely" (staging BFF, 2026-08-03). */
const PRETTY_LIKELY = {
  suggested_value: 0.7,
  confidence: 'high',
  reasoning:
    'Interpreted "pretty likely" as approximately 70% probability based on common usage.',
  needs_clarification: false,
  provenance: 'cee',
}

/** The witnessed clarification branch for "good". */
const AMBIGUOUS_GOOD = {
  suggested_value: 0.75,
  confidence: 'low',
  reasoning: '"good" could mean several things.',
  needs_clarification: true,
  clarifying_question: 'When you say "good", how likely do you mean?',
  options: [
    { label: 'Very likely', value: 0.9 },
    { label: 'Quite likely', value: 0.75 },
    { label: 'More likely than not', value: 0.6 },
  ],
  provenance: 'cee',
}

/** A cap-bearing factor — CEE's own draft fixtures carry exactly this shape. */
const CAPPED_ID = 'fac_team_size'
const CAPPED_LABEL = 'Team Size'
const CAPPED_OBSERVED = {
  value: 0.4,
  raw_value: 8,
  unit: 'engineers',
  cap: 20,
  source: 'brief_extraction',
}

/** The 2026-08-03 journey-walk row: capless, unitless, model value in [0,1]. */
const WALK_ID = 'fac_content_marketing'
const WALK_LABEL = 'Content Marketing Investment'
const WALK_OBSERVED = {
  value: 0,
  display_value: 'Low (0)',
  source: 'cee_inference',
  extractionType: 'inferred',
}

function seedFactor(id: string, label: string, observed: Record<string, unknown>): void {
  useCanvasStore.setState(
    {
      currentScenarioId: SCENARIO,
      nodes: [
        {
          id,
          type: 'factor',
          position: { x: 0, y: 0 },
          data: { kind: 'factor', label, observedState: observed },
        } as unknown as Node,
      ],
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

function rankingFor(id: string): RankingResult {
  return { source: 'degree', weights: { [id]: 1 }, ordered: [id] }
}

/** The REAL derivation chain: store → buildEstimateRows → the REAL drill-in. */
function Harness({ id }: { id: string }): JSX.Element {
  const nodes = useCanvasStore((s) => s.nodes)
  const row = buildEstimateRows(nodes, rankingFor(id), null)[0]
  if (!row) return <div />
  return <CalibrateDrillIn row={row} onDone={() => {}} />
}

function renderFor(id: string) {
  return render(
    <ConversationProvider>
      <Harness id={id} />
    </ConversationProvider>,
  )
}

/**
 * Drain microtasks AND macrotasks under fake timers: the dispatch, the
 * response-processing path and the deferral buffer each contain real awaits,
 * so a fixed microtask count is not enough (mirrors
 * `calibrateDrillInReceipt.spec.tsx`'s `flush`, adapted for fake timers).
 */
async function flush(): Promise<void> {
  for (let round = 0; round < 25; round++) {
    for (let i = 0; i < 20; i++) await Promise.resolve()
    vi.advanceTimersByTime(2)
  }
}

/** Open "say it in words", type a phrase, run the debounce to completion. */
async function sayInWords(label: string, phrase: string): Promise<void> {
  fireEvent.click(screen.getByLabelText(`Describe your estimate for ${label} in words`))
  fireEvent.change(screen.getByLabelText(`Describe ${label} in words`), {
    target: { value: phrase },
  })
  await act(async () => {
    vi.advanceTimersByTime(600)
    await flush()
  })
}

/** Every `factor_value_edit` event that reached the transport, in order. */
function factorValueEdits(): Array<Record<string, unknown>> {
  return dispatched
    .map((p) => (p.event ?? null) as Record<string, unknown> | null)
    .filter((e): e is Record<string, unknown> => e?.kind === 'factor_value_edit')
}

function observedOf(id: string): Record<string, unknown> {
  return getObservedState(
    useCanvasStore.getState().nodes.find((n) => n.id === id)?.data,
  ) as unknown as Record<string, unknown>
}

beforeEach(() => {
  cleanup()
  vi.stubEnv('VITE_ENABLE_V5_ORCHESTRATOR', 'true')
  dispatched.length = 0
  elicitReplies.length = 0
  elicitRequests.length = 0
  replies.length = 0
  holdTurn = false
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

describe('CalibrateDrillIn — "say it in words" (ROADMAP 2.364)', () => {
  it('sends the factor\'s OWN id and label to the elicitation seam, with target_type prior', async () => {
    seedFactor(CAPPED_ID, CAPPED_LABEL, { ...CAPPED_OBSERVED })
    elicitReplies.push({ ...PRETTY_LIKELY })
    renderFor(CAPPED_ID)

    await sayInWords(CAPPED_LABEL, 'pretty likely')

    expect(elicitRequests).toHaveLength(1)
    // Bound by IDENTITY: the id, not "a string that happens to be there".
    expect(elicitRequests[0]).toEqual({
      node_id: CAPPED_ID,
      node_label: CAPPED_LABEL,
      user_expression: 'pretty likely',
      target_type: 'prior',
    })
  })

  it('renders the chance from suggested_value — "about 70%"', async () => {
    seedFactor(CAPPED_ID, CAPPED_LABEL, { ...CAPPED_OBSERVED })
    elicitReplies.push({ ...PRETTY_LIKELY })
    renderFor(CAPPED_ID)

    await sayInWords(CAPPED_LABEL, 'pretty likely')

    // 0.7 → "about 70%". No other field in the reply produces 70: `confidence`
    // is a string, there are no options, and 0.4/8/20 are the node's. A
    // renderer reading the wrong field cannot produce this string.
    expect(screen.getByText(/That reads as about 70%/)).toBeInTheDocument()
    expect(
      screen.getByLabelText(`Use about 70% for ${CAPPED_LABEL}`),
    ).toBeInTheDocument()
  })

  it('accepting dispatches ONE factor_value_edit carrying the PROBABILITY as value, with no raw_value/unit (cap-bearing factor)', async () => {
    seedFactor(CAPPED_ID, CAPPED_LABEL, { ...CAPPED_OBSERVED })
    elicitReplies.push({ ...PRETTY_LIKELY })
    holdTurn = true
    renderFor(CAPPED_ID)

    await sayInWords(CAPPED_LABEL, 'pretty likely')
    await act(async () => {
      fireEvent.click(screen.getByLabelText(`Use about 70% for ${CAPPED_LABEL}`))
      await flush()
    })

    const edits = factorValueEdits()
    expect(edits).toHaveLength(1)
    const edit = edits[0] as Record<string, unknown>
    expect(edit.target_id).toBe(CAPPED_ID)
    expect(edit.field).toBe('value')
    // THE SCALE CLAIM. 0.7 verbatim — NOT 70 (the design's original
    // `Math.round(v*100)`, which on this factor asserts seventy ENGINEERS
    // against a cap of 20), and NOT 0.7/20 = 0.035 (what the default
    // user-units basis would have produced against the stored raw_value of 8).
    expect(edit.value).toBe(0.7)
    // ABSENCE IS THE CONTRACT: with no raw_value, CEE inverts with its OWN
    // stored cap (`resolveUserUnitInput`). Sending one would assert a
    // magnitude the user never gave.
    expect(edit).not.toHaveProperty('raw_value')
    expect(edit).not.toHaveProperty('unit')
    // And the canvas moved at once, at the same scale.
    expect(observedOf(CAPPED_ID).value).toBe(0.7)
  })

  it('the same accept is scale-correct on the WITNESSED walk row (capless, unitless)', async () => {
    seedFactor(WALK_ID, WALK_LABEL, { ...WALK_OBSERVED })
    elicitReplies.push({ ...PRETTY_LIKELY })
    holdTurn = true
    renderFor(WALK_ID)

    await sayInWords(WALK_LABEL, 'pretty likely')
    await act(async () => {
      fireEvent.click(screen.getByLabelText(`Use about 70% for ${WALK_LABEL}`))
      await flush()
    })

    const edits = factorValueEdits()
    expect(edits).toHaveLength(1)
    expect(edits[0].target_id).toBe(WALK_ID)
    expect(edits[0].value).toBe(0.7)
    expect(observedOf(WALK_ID).value).toBe(0.7)
    // No refusal hint: a probability is in range by construction.
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('an ambiguous phrase renders the ENGINE\'s question and its own labels; a chip commits THAT chip\'s value', async () => {
    seedFactor(WALK_ID, WALK_LABEL, { ...WALK_OBSERVED })
    elicitReplies.push({ ...AMBIGUOUS_GOOD })
    holdTurn = true
    renderFor(WALK_ID)

    await sayInWords(WALK_LABEL, 'good')

    // Verbatim — the engine's words, not a paraphrase of them.
    expect(
      screen.getByText('When you say "good", how likely do you mean?'),
    ).toBeInTheDocument()
    // No number is offered while the engine is unsure.
    expect(screen.queryByText(/That reads as/)).not.toBeInTheDocument()

    await act(async () => {
      // Bound by the chip's own LABEL, so a mutant that commits options[0]
      // regardless of which chip was clicked dies here.
      fireEvent.click(screen.getByText('More likely than not'))
      await flush()
    })

    const edits = factorValueEdits()
    expect(edits).toHaveLength(1)
    expect(edits[0].value).toBe(0.6)
    expect(observedOf(WALK_ID).value).toBe(0.6)
  })

  it('on CEE\'s applied receipt the row becomes the user\'s own ("checked by you"), not an AI estimate', async () => {
    seedFactor(WALK_ID, WALK_LABEL, { ...WALK_OBSERVED })
    elicitReplies.push({ ...PRETTY_LIKELY })
    // CEE's ACCEPTANCE for THIS target — the applied graph_patch receipt.
    replies.push({
      assistant_text: `Updated ${WALK_LABEL}.`,
      blocks: [
        {
          type: 'graph_patch',
          status: 'applied',
          operation: 'set_factor_value',
          target_id: WALK_ID,
          before: { value: 0 },
          after: { value: 0.7 },
        },
      ],
      graph_hash: 'f0719cb3b8905ef4',
    })
    renderFor(WALK_ID)

    await sayInWords(WALK_LABEL, 'pretty likely')
    await act(async () => {
      fireEvent.click(screen.getByLabelText(`Use about 70% for ${WALK_LABEL}`))
      await flush()
    })

    // The claim is receipt-gated exactly as the typed path's is (2.304): the
    // stamp is an assertion about what the ENGINE holds.
    expect(observedOf(WALK_ID).source).toBe('user_override')
    expect(observedOf(WALK_ID).value).toBe(0.7)
  })

  it('a failed elicitation says so and commits NOTHING', async () => {
    seedFactor(WALK_ID, WALK_LABEL, { ...WALK_OBSERVED })
    // No reply queued → the mocked client throws, as a 4xx/5xx would.
    renderFor(WALK_ID)

    await sayInWords(WALK_LABEL, 'pretty likely')

    expect(screen.getByRole('status').textContent).toMatch(/Nothing has changed/i)
    expect(factorValueEdits()).toHaveLength(0)
    expect(observedOf(WALK_ID).value).toBe(0)
  })

  it('CORRECTED-PREMISE CONTROL: the design\'s "type 70%" path is REFUSED on the walk row — nothing committed, nothing dispatched', async () => {
    seedFactor(WALK_ID, WALK_LABEL, { ...WALK_OBSERVED })
    renderFor(WALK_ID)

    // Exactly what `Math.round(0.7 * 100)` would have fed the typed field.
    fireEvent.change(screen.getByLabelText(`Your estimate for ${WALK_LABEL}`), {
      target: { value: '70' },
    })
    await act(async () => {
      fireEvent.click(screen.getByLabelText(`Save estimate for ${WALK_LABEL}`))
      await flush()
    })

    expect(screen.getByRole('status').textContent).toMatch(/without a unit/i)
    expect(factorValueEdits()).toHaveLength(0)
    expect(observedOf(WALK_ID).value).toBe(0)
    expect(observedOf(WALK_ID).raw_value).toBeUndefined()
  })
})
