/**
 * ⭐ WHAT THE PERSON IS TOLD AFTER PRESSING APPROVE ON A PROGRAM CARD (lease U-W2, DL 25 Oct): only what the client knows.
 *   (1) A read-back that still serves another model says "Your change was saved, but…" only after a turn that carries a
 *       receipt of its write; after any other turn it says the view couldn't refresh (`READ_FAILED_NOTICE`).
 *   (2) An approval answered by a 5xx says "press Try again" only beside the Try again it names; with none offered, the
 *       core unknown notice (`CORE_OUTCOME_UNKNOWN_NOTICE`).
 *   (3) An approval whose re-send could not be settled says "Olumi finished this" only when the read shows its card is
 *       no longer held; a merged graph alone never does.
 *
 * Real path: the REAL `useConversation`, the REAL `callV5Turn` → `parseV5Response` (core contract) on served bodies
 * (`fixtures/served-approve-outcomes-20261025.json`, `served-card-capacity-leftout-20261025.json`; each `_source` names the
 * run). Only `fetch` is stubbed (turn and scenario read), plus `recoverDraftFromServer`, whose stub publishes the read's held
 * set exactly as `serverGraphHydration.ts` does (`offerServerConversationTurns`) and reports the merge. Synthetic mutations
 * of served bodies are named in each row.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, waitFor } from '@testing-library/react'

vi.mock('../turnService', () => ({
  callOrchestratorTurn: vi.fn(),
  streamOrchestratorTurn: vi.fn(),
  OrchestratorError: class OrchestratorError extends Error {},
}))
vi.mock('../../../v5/streamedTurnTransport', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../v5/streamedTurnTransport')>()),
  openV5TurnStream: async () => { throw new TypeError('Failed to fetch') },
}))
vi.mock('../../../v5/eligibility', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../v5/eligibility')>()),
  isV5Eligible: () => ({ eligible: true as const }),
  isV5CanonicalRunPath: () => false,
}))
vi.mock('../../../lib/supabase', () => ({ getUserId: async () => null, getSessionIdentity: async () => ({ userId: null, accessToken: null }) }))
vi.mock('../../../services/scenarioService', () => ({ loadScenario: async () => null, storeAnalysis: async () => undefined }))
vi.mock('../../../lib/posthog', () => ({ trackEvent: () => undefined }))
vi.mock('../coreStillFinishing', async (importOriginal) => ({ ...(await importOriginal<typeof import('../coreStillFinishing')>()), STILL_FINISHING_REPLAY_DELAY_MS: 0 }))
const recover = vi.fn()
vi.mock('../../hydrate/draftRecovery', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../hydrate/draftRecovery')>()),
  recoverDraftFromServer: (...a: unknown[]) => recover(...a),
}))

import { useConversation } from '../useConversation'
import { useCanvasStore } from '../../store'
import { useServerConversationTurnsStore } from '../../stores/serverConversationTurnsStore'
import { buildSuggestedActionChips } from '../../../v5/blocks/suggestedActionChips'
import { READ_FAILED_NOTICE, STALE_MODEL_NOTICE } from '../readAfterWrite'
import { APPROVAL_PRESS_OUTCOME_UNKNOWN_COPY } from '../deliveryUnknown'
import { CORE_FINISHED_RELOADED_NOTICE, CORE_OUTCOME_UNKNOWN_NOTICE, CORE_STILL_FINISHING_NOTICE } from '../coreStillFinishing'
import served from './fixtures/served-approve-outcomes-20261025.json'
import capacityCard from './fixtures/served-card-capacity-leftout-20261025.json'

type Json = Record<string, any>
const SCENARIO = 'a0a0a0a0-b1b1-4c2c-8d3d-e4e4e4e4e4e4'
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

let turnAnswers: Array<() => Response> = []
let read: Json | null = null
const turnPosts = () => (fetch as unknown as { mock: { calls: [string, RequestInit?][] } }).mock.calls.filter(([u, i]) => /\/proxy\/v5\/turn$/.test(String(u)) && i?.method === 'POST')

let live: ReturnType<typeof useConversation> | null = null
function App() { live = useConversation(); return null }
const settle = (ms = 60) => act(async () => { await new Promise((r) => setTimeout(r, ms)) })
/**
 * A served read made to serve `turn`'s saved model (synthetic: its `content_hash` and Run set to the turn's), so a turn's
 * own read-back confirms and says nothing.
 */
const readServing = (base: Json, turn: Json): Json => ({ ...clone(base), content_hash: turn.model.scenario_revision,
  canonical_analysis_view: { ...clone(base.canonical_analysis_view ?? {}), run: { ...(base.canonical_analysis_view?.run ?? {}), run_id: turn.run?.run_id ?? null },
    staleness: { ...(base.canonical_analysis_view?.staleness ?? {}), stale: false } } })
/** The card on screen: a typed message answered by the served card turn, its own read-back confirmed. */
async function cardOnScreen(cardTurn: Json) {
  read = readServing(served.capacity.read_after as Json, cardTurn)
  turnAnswers.push(() => json(cardTurn))
  render(<App />)
  await act(async () => { await live!.sendMessage('Here is my situation.') })
  await settle(300)
  expect(notices()).toEqual([])
}
const approveOf = (cardTurn: Json) => buildSuggestedActionChips([], [cardTurn.cards[0].approve_action])[0]
async function press(cardTurn: Json) {
  await act(async () => { await live!.sendChip(approveOf(cardTurn) as never) })
  await settle()
}
const notices = () => live!.messages.filter((m) => m.role === 'assistant' && m.synthetic).map((m) => m.content)
const retryOffered = () => live!.messages.some((m) => (m.actionChips ?? []).some((c) => c.id === 'retry'))
/** CEE's own core error body (the served TURN_STILL_RUNNING envelope) with another error. */
const coreError = (error: Json) => ({ ...clone(served.still_running.body), error })

beforeEach(() => {
  window.history.replaceState(null, '', '/?ai=core-route')
  vi.stubEnv('VITE_V5_ENDPOINT', 'https://cee.test/proxy/v5/turn')
  turnAnswers = []
  read = null
  recover.mockReset()
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const u = String(url)
    if (/\/proxy\/v5\/turn$/.test(u) && init?.method === 'POST') return (turnAnswers.shift() ?? (() => json({}, 500)))()
    if (/\/scenarios\/[^/?]+\/graph/.test(u) && read !== null) return json(read)
    return new Response('{}', { status: 404 })
  }))
  useCanvasStore.getState().resetCanvas()
  useCanvasStore.setState({ currentScenarioId: SCENARIO } as never)
})
// The read-back waits 1.5 s before its one retry.
vi.setConfig({ testTimeout: 15_000 })
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); window.history.replaceState(null, '', '/'); live = null })

describe('(1) a read-back that serves another model claims "saved" only after a turn with a receipt', () => {
  it('🔴 served qualitative approval (receipts []), the read still serving another model: "couldn’t refresh", never "saved"', async () => {
    const q = served.qualitative as Json
    await cardOnScreen(q.card_turn)
    read = { ...clone(q.read_after), content_hash: 'f'.repeat(64) }
    turnAnswers.push(() => json(q.approve_turn))
    await press(q.card_turn)
    await waitFor(() => expect(notices()).toContain(READ_FAILED_NOTICE), { timeout: 5000 })
    expect(notices()).not.toContain(STALE_MODEL_NOTICE)
  })

  it('CONTRAST: served capacity approval (one receipt, the person’s), the same stale read: "Your change was saved, but…"', async () => {
    const c = served.capacity as Json
    await cardOnScreen(capacityCard.body)
    read = { ...clone(c.read_after), content_hash: 'f'.repeat(64) }
    turnAnswers.push(() => json(c.approve_turn))
    await press(capacityCard.body)
    await waitFor(() => expect(notices()).toContain(STALE_MODEL_NOTICE), { timeout: 5000 })
  })

  it('CONTROL: the served read after the qualitative approval serves that model: no notice', async () => {
    const q = served.qualitative as Json
    await cardOnScreen(q.card_turn)
    read = clone(q.read_after)
    turnAnswers.push(() => json(q.approve_turn))
    await press(q.card_turn)
    await settle(2000)
    expect(notices()).toEqual([])
  })
})

describe('(2) "press Try again" only beside the Try again it names', () => {
  it('🔴 an approval answered by a proxy 504 with no CEE body: no Try again offered, so the core unknown notice', async () => {
    await cardOnScreen(capacityCard.body)
    turnAnswers.push(() => new Response('<html><body>504 Gateway Time-out</body></html>', { status: 504, headers: { 'content-type': 'text/html' } }))
    await press(capacityCard.body)
    expect(retryOffered()).toBe(false)
    expect(notices()).toContain(CORE_OUTCOME_UNKNOWN_NOTICE)
    expect(notices()).not.toContain(APPROVAL_PRESS_OUTCOME_UNKNOWN_COPY)
  })

  it('CONTRAST: CEE’s own 503 licensing a resend (`retry_safe: true`): Try again offered, and the words name it', async () => {
    await cardOnScreen(capacityCard.body)
    turnAnswers.push(() => json(coreError({ code: 'INTERNAL_ERROR', message: 'Something failed.', retry_safe: true, nothing_saved: false }), 503))
    await press(capacityCard.body)
    expect(retryOffered()).toBe(true)
    expect(notices()).toContain(APPROVAL_PRESS_OUTCOME_UNKNOWN_COPY)
  })
})

describe('(3) an approval whose re-send could not be settled is "finished" only when its card is no longer held', () => {
  const card = capacityCard.body.cards[0]
  /** The served 504 TURN_STILL_RUNNING, then the re-send refused as unknown (synthetic: CEE's 409 on the same envelope). */
  function stillRunningThenUnknown() {
    turnAnswers.push(() => json(clone(served.still_running.body), served.still_running.status))
    turnAnswers.push(() => json(coreError({ code: 'TURN_OUTCOME_UNKNOWN', message: 'Unknown.', retry_safe: false, nothing_saved: false }), 409))
  }
  /** The recovery read merged, with this held set (published as `serverGraphHydration.ts` publishes it). */
  function recoveredHolding(proposals: unknown[]) {
    // The card turn's own first message may already have read back once; only this press's recovery is counted.
    recover.mockClear()
    recover.mockImplementation(async (args: { scenarioId: string }) => {
      useServerConversationTurnsStore.getState().offerServerConversationTurns({ scenarioId: args.scenarioId, turns: [], heldProposalOffers: [],
        proposalFields: { version: 1, graph_hash: capacityCard.body.model.revision, proposals }, run: { runNotCurrent: false, currentRunComputedAt: null } })
      // The read publishes its held set before it returns, as the real hydrate does. Taken at once here: the panel's
      // reconcile of the offer is not what these rows measure, and inside act() its timing is the test's, not the app's.
      useServerConversationTurnsStore.getState().takeServerConversationTurns(args.scenarioId)
      return 'recovered'
    })
  }

  it('🔴 the read still holds the card: the core unknown notice, never "Olumi finished this"', async () => {
    await cardOnScreen(capacityCard.body)
    stillRunningThenUnknown()
    recoveredHolding([card])
    await press(capacityCard.body)
    await waitFor(() => expect(recover).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(notices()).not.toContain(CORE_STILL_FINISHING_NOTICE), { timeout: 3000 })
    expect(turnPosts()).toHaveLength(3)
    expect(notices()).toContain(CORE_OUTCOME_UNKNOWN_NOTICE)
    expect(notices()).not.toContain(CORE_FINISHED_RELOADED_NOTICE)
    expect(notices()).not.toContain(CORE_STILL_FINISHING_NOTICE)
  })

  it('CONTRAST: the read no longer holds the card: "Olumi finished this"', async () => {
    await cardOnScreen(capacityCard.body)
    stillRunningThenUnknown()
    recoveredHolding([])
    await press(capacityCard.body)
    await waitFor(() => expect(recover).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(notices()).not.toContain(CORE_STILL_FINISHING_NOTICE), { timeout: 3000 })
    expect(notices()).toContain(CORE_FINISHED_RELOADED_NOTICE)
  })

  it('CONTRAST: a typed turn (no approval) recovered the same way keeps "Olumi finished this"', async () => {
    await cardOnScreen(capacityCard.body)
    stillRunningThenUnknown()
    recoveredHolding([card])
    await act(async () => { await live!.sendMessage('Add staff absence as a factor.') })
    await waitFor(() => expect(recover).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(notices()).not.toContain(CORE_STILL_FINISHING_NOTICE), { timeout: 3000 })
    expect(notices()).toContain(CORE_FINISHED_RELOADED_NOTICE)
  })
})
