/**
 * draft goal_constraints[] — CROSS-REPO wire survival, CEE bytes -> UI store.
 *
 * WHAT MAKES THIS DIFFERENT FROM A HAND-WRITTEN FIXTURE TEST:
 *
 * `fixtures/cee-draft-goal-constraints-wire.json` was not authored here. It is
 * the verbatim output of CEE's real production chain, captured by
 * `scripts/capture-goal-constraints-wire.ts` in olumi-assistants-service on
 * branch `fix/goal-constraints-wire-emit`:
 *
 *   compound-goals.runCompoundGoals   (the DETERMINISTIC regex extractor —
 *                                      live parity: from_regex:1, from_llm:0)
 *   schema-v3.transformResponseToV3
 *   draft-graph-dispatch.draftResultToOlumiResponse   (the V5 projection)
 *   response-finaliser.finaliseV5Response
 *   validators/b1.validateEgress                      (passed: ok=true)
 *
 * So this spec joins the two halves of the lane with a real payload rather
 * than a fixture that could agree with neither side.
 *
 * IT DRIVES THE LIVE V5 PATH, NOT THE LEGACY ONE. The chain asserted below is
 * the one `useConversation.sendTurn` actually executes:
 *
 *   parseV5Response                          (strict boundary validation)
 *   attachAnalysisReadyToInlineDraftGraph    (useConversation.ts:3291)
 *   applyDraftResult                         (useConversation.ts:3305)
 *   useCanvasStore.goalConstraints           (what the UI renders from)
 *
 * `adaptDraftResponse` / `DraftChat.tsx` are deliberately NOT exercised here:
 * they are the legacy `/assist/v1/draft-graph` surface, and DraftChat is
 * unmounted whenever the `aiPanelV2` flag is on — which is its default.
 * A test driving that path would prove nothing about what ships.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// `useConversation` transitively imports `lib/supabase`, which THROWS at
// module scope when VITE_SUPABASE_* are unset. Stub the env in a hoisted
// block so the stubs are in place before that module is evaluated.
//
// Deliberately NOT a `vi.mock` factory: a factory REPLACES the module, so
// every export added to `lib/supabase` after this file was written would
// silently become undefined here — the hand-maintained-mirror failure this
// codebase has already been bitten by. Stubbing the env instead loads the
// REAL module, so there is no mirror to drift.
vi.hoisted(() => {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co')
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key')
})

import { parseV5Response } from '../../../v5/responseParser'
import { attachAnalysisReadyToInlineDraftGraph } from '../useConversation'
import { applyDraftResult } from '../../utils/applyDraftResult'
import { useCanvasStore } from '../../store'

const FIXTURE_PATH = resolve(__dirname, 'fixtures/cee-draft-goal-constraints-wire.json')

function loadCeeWireBytes(): Record<string, unknown> {
  return JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as Record<string, unknown>
}

function makeResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('draft goal_constraints — CEE wire bytes survive to the UI store', () => {
  beforeEach(() => {
    useCanvasStore.getState().setGoalConstraints(null)
  })

  it('POSITIVE CONTROL: the captured CEE bytes really do carry the constraint', () => {
    // Without this, every assertion below could pass against a payload that
    // never had the field — an absence proving itself.
    const raw = loadCeeWireBytes() as any
    expect(Array.isArray(raw.draft_graph.goal_constraints)).toBe(true)
    expect(raw.draft_graph.goal_constraints.length).toBeGreaterThan(0)
    expect(raw.draft_graph.goal_constraints[0].value).toBe(50000)
  })

  it('HOP 1 — the strict boundary parser accepts the payload and keeps the field', async () => {
    // This is the hop that fails at the pre-0.18.0 pin. DraftGraphBlockSchema
    // is `.strict()`, and `draft_graph` is a KNOWN top-level key, so it goes
    // to strict validation rather than the __additive__ sidecar: at 0.15.0
    // the parse returns kind:'parse_error' (unrecognized_keys) and the whole
    // turn is lost — not merely this field.
    const result = await parseV5Response(makeResponse(loadCeeWireBytes()))

    expect(result.kind).toBe('response')
    if (result.kind !== 'response') throw new Error('expected a parsed response')

    const constraints = (result.response.draft_graph as any)?.goal_constraints
    expect(Array.isArray(constraints)).toBe(true)
    expect(constraints).toHaveLength(1)
    expect(constraints[0].operator).toBe('<=')
    expect(constraints[0].value).toBe(50000)
  })

  it('HOP 2 — the inline-draft helper passes the nested field through untouched', async () => {
    // The helper predates this field's arrival INSIDE draft_graph: it was
    // written to lift a ROOT-level goal_constraints onto the inline object.
    // Its `hasOwnGoalConstraints` guard means a nested value is preferred and
    // left alone. This asserts that behaviour rather than assuming it.
    const result = await parseV5Response(makeResponse(loadCeeWireBytes()))
    if (result.kind !== 'response') throw new Error('expected a parsed response')

    const inline = attachAnalysisReadyToInlineDraftGraph(
      result.response.draft_graph,
      result.response,
    ) as any

    expect(Array.isArray(inline.goal_constraints)).toBe(true)
    expect(inline.goal_constraints[0].value).toBe(50000)

    // REGRESSION PIN for the coupling this lane removed.
    //
    // These real CEE bytes carry analysis_ready with status
    // 'needs_user_input' (a fresh draft whose option still needs intervention
    // mapping — an ordinary outcome, not an error). validateAnalysisReadyContract
    // rejects anything that is not exactly 'ready', so nothing is attached here:
    expect(inline.analysis_ready).toBeUndefined()
    //
    // ...which used to make applyDraftResult's isCEEv3Response() gate false and
    // silently discard the constraint. HOP 3 proves it now survives regardless.
    // If a future change makes this attach, HOP 3 must still pass on its own
    // merit — do not let a passing HOP 3 start depending on analysis_ready.
  })

  it('HOP 3 — applyDraftResult commits the constraint to the canvas store', async () => {
    const result = await parseV5Response(makeResponse(loadCeeWireBytes()))
    if (result.kind !== 'response') throw new Error('expected a parsed response')

    const inline = attachAnalysisReadyToInlineDraftGraph(
      result.response.draft_graph,
      result.response,
    )

    expect(useCanvasStore.getState().goalConstraints).toBeNull()

    applyDraftResult(inline as any)

    const stored = useCanvasStore.getState().goalConstraints
    expect(stored).not.toBeNull()
    expect(stored).toHaveLength(1)
    expect(stored![0].value).toBe(50000)
    expect(stored![0].operator).toBe('<=')

    // The constraint binds to a node that actually exists on the canvas —
    // a constraint pointing at nothing would be unrenderable.
    const nodeIds = useCanvasStore.getState().nodes.map((n) => n.id)
    expect(nodeIds).toContain(stored![0].node_id)
  })

  it('the graph itself also landed (this is a whole-turn success, not a lucky field)', async () => {
    const result = await parseV5Response(makeResponse(loadCeeWireBytes()))
    if (result.kind !== 'response') throw new Error('expected a parsed response')

    const inline = attachAnalysisReadyToInlineDraftGraph(
      result.response.draft_graph,
      result.response,
    )
    const { nodeCount } = applyDraftResult(inline as any)

    expect(nodeCount).toBeGreaterThan(0)
    expect(useCanvasStore.getState().nodes.length).toBeGreaterThan(0)
  })
})
