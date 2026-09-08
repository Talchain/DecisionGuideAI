/**
 * The draft turn records the user's brief for the decision it drafted — driven
 * through the REAL `sendTurn`, not by seeding the store.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE DEFECT (witnessed on deployed UI `127bdee7`, 6 Sep 2026, fresh guest)
 * ═══════════════════════════════════════════════════════════════════════════
 * A 279-character brief was typed, a model drafted and a provisional analysis
 * delivered — and the brief was nowhere, because `contextIntegrityStore` had
 * only one writer, the cold read, which answers `absent` for a scenario that
 * fresh. A page reload hydrated the store and the brief then appeared. So it
 * was reachable ONLY after a reload.
 *
 * ⚠ THE CONSUMER THIS FILE ORIGINALLY RENDERED IS GONE (7 Sep 2026). It had a
 * seventh test, "…and the anchor node then carries that brief" — a store → node
 * check against `DecisionNode`, which echoed the brief on the canvas card.
 * Paul retired that echo: *"It also doesn't need to say what you gave me. The
 * user should be able to see that."* The test was REMOVED rather than re-pointed
 * because its subject no longer exists, and the first test below already proves
 * draft turn → store in full. The store keeps a live product consumer in
 * `WhatIWasGivenSection` (the results panel's "What you gave me"), so the write
 * this file pins is not orphaned — that was checked at the bytes, not assumed.
 *
 * What remains is the half that was actually missing on `127bdee7`:
 * draft turn → store, driven through the live hook.
 *
 * ── WHAT IS MOCKED, AND WHAT IS NOT ────────────────────────────────────────
 * Mocked (five `vi.mock` calls, listed so the header cannot under-count them):
 * the streamed transport and the buffered adapter (the two network calls);
 * `isV5Eligible`, forced eligible, exactly as the sibling harness
 * `scenarioResponseFence.dispatchIdIsMinted.spec.tsx` does; the supabase
 * identity (a guest — no user id, no token); and `scenarioService.loadScenario`
 * (null). The three render-only mocks went with the node test above.
 * NOT mocked: `sendTurn` and its lazy mint, `responseBelongsToDispatchingScenario`,
 * `applyDraftResult`, `useCanvasStore` and `useContextIntegrityStore`. The
 * assertions bind to the MINTED id, never to a value another decision's record
 * could satisfy (CLAUDE.md trap 19).
 *
 * ── THE NEGATIVE CASES ARE THE LOAD-BEARING ONES ───────────────────────────
 * A record that displaced the cold read's copy would drop the manifest; a
 * record written for a hidden turn would put machine text under "What you gave
 * me"; a record keyed on the previous scenario would be the P0 this store's
 * header describes. Each is pinned below, each with its precondition asserted
 * in-test so a fixture that stopped reaching the seam cannot pass it vacuously
 * (CLAUDE.md trap 13b).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

import { useConversation } from '../useConversation'
import { useCanvasStore } from '../../store'
import { useDraftStore } from '../../stores/draftStore'
import { useContextIntegrityStore } from '../../stores/contextIntegrityStore'
import wireFixture from './fixtures/cee-draft-goal-constraints-wire.json'

const mockOpenStream = vi.fn()
const mockCallV5Turn = vi.fn()

vi.mock('../../../v5/streamedTurnTransport', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../v5/streamedTurnTransport')>()
  return { ...actual, openV5TurnStream: (...args: unknown[]) => mockOpenStream(...args) }
})

vi.mock('../../../v5/v5Adapter', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../v5/v5Adapter')>()
  return {
    ...actual,
    callV5Turn: (...args: unknown[]) => mockCallV5Turn(...args),
    getV5Endpoint: () => 'https://cee.test/proxy/v5/turn',
  }
})

vi.mock('../../../v5/eligibility', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../v5/eligibility')>()
  return { ...actual, isV5Eligible: () => ({ eligible: true }) }
})

vi.mock('../../../lib/supabase', () => ({
  getUserId: async () => null,
  getSessionIdentity: async () => ({ userId: null, accessToken: null }),
}))

vi.mock('../../../services/scenarioService', () => ({ loadScenario: async () => null }))


const TERMINAL_BODY = wireFixture as unknown as Record<string, unknown>
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const BRIEF =
  'Should we open a second engineering hub in Lisbon next year, or keep hiring remotely ' +
  'across Europe? We need to grow the platform team by twenty engineers within twelve ' +
  'months without raising cost per engineer above £95k.'
const PREVIOUS_SCENARIO = 'f2b0c1a4-0000-4000-8000-000000000001'
const PREVIOUS_BRIEF = 'Should we hire a tech lead or two developers, on a budget of £180k?'

function frame(obj: Record<string, unknown>): string {
  return `event: stage\ndata: ${JSON.stringify(obj)}\n\n`
}

/** A complete stream, pre-enqueued: DRAFTING then COMPLETE carrying the terminal body. */
function completedStream(): Response {
  const text =
    frame({ stage: 'DRAFTING', seq: 0, status: 'in_progress' }) +
    frame({ stage: 'COMPLETE', seq: 4, status: 'complete', status_code: 200, payload: TERMINAL_BODY })
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(new TextEncoder().encode(text))
      c.close()
    },
  })
  return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } })
}

function resetCanvasToNoDecision() {
  useCanvasStore.setState({
    currentScenarioId: null,
    nodes: [],
    edges: [],
    history: { past: [], future: [] },
    _internal: {
      ...(useCanvasStore.getState() as unknown as { _internal: object })._internal,
      lastHistoryHash: null,
    },
    ceeAnalysisReady: null,
    lastAuthoritativeGraph: null,
    results: { status: 'idle' } as never,
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
  } as never)
}

async function sendBrief(text: string, opts: { hidden?: boolean } = {}) {
  mockOpenStream.mockResolvedValue(completedStream())
  const { result } = renderHook(() => useConversation())
  await act(async () => {
    await (result.current.sendMessage(text, {
      turnType: 'explicit_generate',
      ...(opts.hidden ? { hidden: true } : {}),
    }) as Promise<void>)
  })
}

/** The seam actually ran: a graph landed and a real id was minted. Asserted, not assumed. */
function assertDraftLanded() {
  const canvas = useCanvasStore.getState()
  expect(canvas.nodes.length).toBeGreaterThan(0)
  expect(String(canvas.currentScenarioId)).toMatch(UUID_RE)
  return canvas.currentScenarioId as string
}

beforeEach(() => {
  mockOpenStream.mockReset()
  mockCallV5Turn.mockReset()
  useDraftStore.getState().resetDraft()
  useContextIntegrityStore.getState().reset()
  resetCanvasToNoDecision()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('the draft turn records the brief for the decision it drafted', () => {
  it('a fresh brief is recorded under the MINTED scenario id, with no manifest', async () => {
    // Precondition: nothing recorded, no decision open.
    expect(useContextIntegrityStore.getState().scenarioId).toBeNull()
    expect(useCanvasStore.getState().currentScenarioId).toBeNull()

    await sendBrief(BRIEF)
    const minted = assertDraftLanded()

    const recorded = useContextIntegrityStore.getState()
    expect(recorded.scenarioId).toBe(minted)
    expect(recorded.briefText).toBe(BRIEF)
    // The manifest only ever arrives on the cold read. Told nothing = null.
    expect(recorded.manifest).toBeNull()
  })

  it('⛔ the P0 twin: the PREVIOUS decision’s record is replaced by the new decision’s own, under its own id', async () => {
    // Exactly as the cold read leaves it for the previous decision.
    useContextIntegrityStore
      .getState()
      .setContextIntegrity({ scenarioId: PREVIOUS_SCENARIO, briefText: PREVIOUS_BRIEF, manifest: null })
    // reset-canvas → no decision open.
    resetCanvasToNoDecision()
    expect(useContextIntegrityStore.getState().briefText).toBe(PREVIOUS_BRIEF)

    await sendBrief(BRIEF)
    const minted = assertDraftLanded()
    expect(minted).not.toBe(PREVIOUS_SCENARIO)

    const recorded = useContextIntegrityStore.getState()
    expect(recorded.scenarioId).toBe(minted)
    expect(recorded.briefText).toBe(BRIEF)
    expect(recorded.briefText).not.toContain('tech lead')
  })

  it('a HIDDEN turn that lands a graph records nothing — machine text is not "what you gave me"', async () => {
    const canned = 'Generate a model for the decision described in the composer.'
    await sendBrief(canned, { hidden: true })
    // Precondition: the graph DID land — the refusal is about attribution, not
    // about the draft failing. Without this line the case would pass on a turn
    // that never reached the seam at all.
    assertDraftLanded()

    const recorded = useContextIntegrityStore.getState()
    expect(recorded.scenarioId).toBeNull()
    expect(recorded.briefText).toBeNull()
  })
})

describe('the record never displaces a record that already stands for the same scenario', () => {
  const S = 'f2b0c1a4-0000-4000-8000-000000000009'
  const MANIFEST = {
    status: 'derived',
    quantities: { total: 0, absent: 0, proseOnly: 0, inModel: 0, truncated: false, items: [] },
    inferredFactors: { items: [] },
    declaredExclusions: { status: 'reported', items: [] },
  } as never

  it('a second draft-turn record for the same scenario is refused', () => {
    const store = useContextIntegrityStore.getState()
    expect(store.recordBriefForFreshDraft({ scenarioId: S, briefText: 'first' })).toBe(true)
    expect(store.recordBriefForFreshDraft({ scenarioId: S, briefText: 'second' })).toBe(false)
    expect(useContextIntegrityStore.getState().briefText).toBe('first')
  })

  it('the cold read’s copy (with its manifest) wins and is never displaced afterwards', () => {
    const store = useContextIntegrityStore.getState()
    store.recordBriefForFreshDraft({ scenarioId: S, briefText: 'typed' })
    // The cold read overwrites unconditionally — existing behaviour, unchanged.
    store.setContextIntegrity({ scenarioId: S, briefText: 'persisted', manifest: MANIFEST })
    expect(useContextIntegrityStore.getState().manifest).toBe(MANIFEST)
    // A later draft-turn record for the same scenario must not drop the manifest.
    expect(store.recordBriefForFreshDraft({ scenarioId: S, briefText: 'typed again' })).toBe(false)
    const after = useContextIntegrityStore.getState()
    expect(after.briefText).toBe('persisted')
    expect(after.manifest).toBe(MANIFEST)
  })

  it('a blank brief or a non-string id is refused and writes nothing', () => {
    const store = useContextIntegrityStore.getState()
    expect(store.recordBriefForFreshDraft({ scenarioId: S, briefText: '   ' })).toBe(false)
    expect(store.recordBriefForFreshDraft({ scenarioId: '', briefText: 'x' })).toBe(false)
    expect(store.recordBriefForFreshDraft({ scenarioId: null as never, briefText: 'x' })).toBe(false)
    expect(useContextIntegrityStore.getState().scenarioId).toBeNull()
  })
})
