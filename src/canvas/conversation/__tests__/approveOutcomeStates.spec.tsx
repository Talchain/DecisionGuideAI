/**
 * ⭐ WHAT THE PERSON IS TOLD AFTER PRESSING APPROVE ON A PROGRAM CARD (lease U-W2, DL 25 Oct): only what the client knows.
 *   (1) A read-back that still serves another model says "Your change was saved, but…" only after a turn that carries a
 *       receipt of its write; after any other turn it says the view couldn't refresh (`READ_FAILED_NOTICE`).
 *   (2) An approval answered by a 5xx says "press Try again" only when a Try again is drawn; with none drawn, the core
 *       unknown notice (`CORE_OUTCOME_UNKNOWN_NOTICE`).
 *   (3) An approval whose re-send could not be settled never says "Olumi finished this": a merged graph does not show the
 *       approval applied. A typed turn keeps it.
 *
 * Real path: the REAL `useConversation`, the REAL `callV5Turn` → `parseV5Response` (core contract) on served bodies
 * (`fixtures/served-approve-outcomes-20261025.json`, `served-card-capacity-leftout-20261025.json`; each `_source` names the
 * run). The served capacity card is the card on screen in every row; the press is answered by the served turn the row
 * names. Only `fetch` is stubbed (turn and scenario read), plus `recoverDraftFromServer`'s answer. What is drawn is read by
 * rendering the reply's chips through the real `SuggestedChips`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'

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
import { SuggestedChips } from '../zones/SuggestedChips'
import { useCanvasStore } from '../../store'
import { useServerConversationTurnsStore } from '../../stores/serverConversationTurnsStore'
import { buildSuggestedActionChips } from '../../../v5/blocks/suggestedActionChips'
import { READ_FAILED_NOTICE, STALE_MODEL_NOTICE } from '../readAfterWrite'
import { APPROVAL_PRESS_OUTCOME_UNKNOWN_COPY } from '../deliveryUnknown'
import { CORE_OUTCOME_UNKNOWN_NOTICE, CORE_SAVED_REPLY_FAILED_NOTICE, CORE_STILL_FINISHING_NOTICE } from '../coreStillFinishing'
/** The completion claim a merged recovery graph used to make (retired 27 Oct, C7): never shown. */
const FINISHED = 'Olumi finished this. Your saved model is on the canvas.'
import served from './fixtures/served-approve-outcomes-20261025.json'
import capacityCard from './fixtures/served-card-capacity-leftout-20261025.json'

type Json = Record<string, any>
const SCENARIO = 'a0a0a0a0-b1b1-4c2c-8d3d-e4e4e4e4e4e4'
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const CARD = capacityCard.body

let turnAnswers: Array<() => Response> = []
let read: Json | null = null
const turnPosts = () => (fetch as unknown as { mock: { calls: [string, RequestInit?][] } }).mock.calls.filter(([u, i]) => /\/proxy\/v5\/turn$/.test(String(u)) && i?.method === 'POST')
/** The served read fields, as a read: it must carry a graph object to count as one; no row reads the graph itself. */
const readOf = (fields: Json): Json => ({ ...clone(fields), graph: {} })
/** A read serving `turn`'s saved model (synthetic: hash and Run set to the turn's), so that turn's read-back says nothing. */
const readServing = (turn: Json): Json => {
  const r = readOf(served.no_receipt_approval.read)
  return { ...r, content_hash: turn.model.scenario_revision,
    canonical_analysis_view: { run: { ...r.canonical_analysis_view.run, run_id: turn.run?.run_id ?? null }, staleness: { ...r.canonical_analysis_view.staleness, stale: false } } }
}

let live: ReturnType<typeof useConversation> | null = null
function App() { live = useConversation(); return null }
const settle = (ms = 60) => act(async () => { await new Promise((r) => setTimeout(r, ms)) })
const notices = () => live!.messages.filter((m) => m.role === 'assistant' && m.synthetic).map((m) => m.content)
/** The served capacity card on screen: a typed message answered by the served card turn, its own read-back confirmed. */
async function cardOnScreen() {
  read = readServing(CARD)
  turnAnswers.push(() => json(CARD))
  render(<App />)
  await act(async () => { await live!.sendMessage('Here is my situation.') })
  await settle(300)
  expect(notices()).toEqual([])
}
async function pressApprove() {
  await act(async () => { await live!.sendChip(buildSuggestedActionChips([], [CARD.cards[0].approve_action])[0] as never) })
  await settle()
}
/** The chips the failure notice DRAWS, through the real chip row. */
function drawnUnderNotice(): string[] {
  const notice = live!.messages.filter((m) => m.role === 'assistant' && m.synthetic).at(-1)
  const { unmount } = render(<SuggestedChips chips={notice?.actionChips ?? []} onChipClick={async () => {}} />)
  const ids = screen.queryAllByTestId(/^suggested-chip-/).map((el) => el.getAttribute('data-testid')!.replace('suggested-chip-', ''))
  unmount()
  return ids
}
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
  it('🔴 an approval answered with receipts [] (served qualitative), the read still serving another model: "couldn’t refresh", never "saved"', async () => {
    await cardOnScreen()
    read = { ...readOf(served.no_receipt_approval.read), content_hash: 'f'.repeat(64) }
    turnAnswers.push(() => json(served.no_receipt_approval.turn))
    await pressApprove()
    await waitFor(() => expect(notices()).toContain(READ_FAILED_NOTICE), { timeout: 5000 })
    expect(notices()).not.toContain(STALE_MODEL_NOTICE)
  })

  it('CONTRAST: an approval answered with one receipt (served capacity), the same stale read: "Your change was saved, but…"', async () => {
    await cardOnScreen()
    read = { ...readOf(served.no_receipt_approval.read), content_hash: 'f'.repeat(64) }
    turnAnswers.push(() => json(served.receipt_approval.turn))
    await pressApprove()
    await waitFor(() => expect(notices()).toContain(STALE_MODEL_NOTICE), { timeout: 5000 })
  })

  it('CONTROL: the served read after that approval serves its model: no notice', async () => {
    await cardOnScreen()
    read = readOf(served.no_receipt_approval.read)
    turnAnswers.push(() => json(served.no_receipt_approval.turn))
    await pressApprove()
    await settle(2000)
    expect(notices()).toEqual([])
  })
})

describe('(2) an approval answered by a 5xx says "press Try again" only when a Try again is drawn', () => {
  it('🔴 CEE’s own 503 licensing a resend (`retry_safe: true`): no Try again is drawn, so the core unknown notice (Codex r1 on #2997)', async () => {
    await cardOnScreen()
    turnAnswers.push(() => json(coreError({ code: 'INTERNAL_ERROR', message: 'Something failed.', retry_safe: true, nothing_saved: false }), 503))
    await pressApprove()
    expect(drawnUnderNotice()).not.toContain('retry')
    expect(notices()).toContain(CORE_OUTCOME_UNKNOWN_NOTICE)
    expect(notices()).not.toContain(APPROVAL_PRESS_OUTCOME_UNKNOWN_COPY)
  })

  it('🔴 C7: an approval CEE settled before any write (502, nothing_saved and retry_safe, no receipt) is a failure, never "unknown"', async () => {
    await cardOnScreen()
    turnAnswers.push(() => json(coreError({ code: 'UPSTREAM_ERROR', message: 'x', retry_safe: true, nothing_saved: true }), 502))
    await pressApprove()
    expect(notices()).not.toContain(CORE_OUTCOME_UNKNOWN_NOTICE)
    expect(notices()).not.toContain(APPROVAL_PRESS_OUTCOME_UNKNOWN_COPY)
    expect(notices()).not.toContain(CORE_SAVED_REPLY_FAILED_NOTICE)
    expect(live!.lastSendFailure?.kind).toBe('server')
  })

  it('CONTRAST: nothing_saved with no resend licence (a turn still running has written nothing yet) stays unknown', async () => {
    await cardOnScreen()
    turnAnswers.push(() => json(coreError({ code: 'UPSTREAM_ERROR', message: 'x', retry_safe: false, nothing_saved: true }), 502))
    await pressApprove()
    expect(notices().some((n) => n === CORE_OUTCOME_UNKNOWN_NOTICE || n === APPROVAL_PRESS_OUTCOME_UNKNOWN_COPY)).toBe(true)
    expect(live!.lastSendFailure?.kind).toBe('delivery_unknown')
  })

  it('🔴 C7: an approval saved before its reply failed (CEE 502 with the saved version’s receipt): "saved", never the unknown notice', async () => {
    await cardOnScreen()
    turnAnswers.push(() => json({ ...coreError({ code: 'UPSTREAM_ERROR', message: 'x', retry_safe: false, nothing_saved: false }),
      receipts: clone(served.receipt_approval.turn.receipts) }, 502))
    await pressApprove()
    expect(notices()).toContain(CORE_SAVED_REPLY_FAILED_NOTICE)
    expect(notices()).not.toContain(CORE_OUTCOME_UNKNOWN_NOTICE)
    expect(notices()).not.toContain(APPROVAL_PRESS_OUTCOME_UNKNOWN_COPY)
  })

  it('🔴 a proxy 504 with no CEE body: no Try again is drawn, so the core unknown notice', async () => {
    await cardOnScreen()
    turnAnswers.push(() => new Response('<html><body>504 Gateway Time-out</body></html>', { status: 504, headers: { 'content-type': 'text/html' } }))
    await pressApprove()
    expect(drawnUnderNotice()).not.toContain('retry')
    expect(notices()).toContain(CORE_OUTCOME_UNKNOWN_NOTICE)
    expect(notices()).not.toContain(APPROVAL_PRESS_OUTCOME_UNKNOWN_COPY)
  })
})

describe('(3) an approval whose re-send could not be settled never says "Olumi finished this"', () => {
  /** The served 504 TURN_STILL_RUNNING, then the re-send refused as unknown (synthetic: CEE's 409 on the same envelope). */
  function stillRunningThenUnknown() {
    turnAnswers.push(() => json(clone(served.still_running.body), served.still_running.status))
    turnAnswers.push(() => json(coreError({ code: 'TURN_OUTCOME_UNKNOWN', message: 'Unknown.', retry_safe: false, nothing_saved: false }), 409))
    // The card turn's own first message may already have read back once; only this press's recovery is counted.
    recover.mockReset()
    recover.mockResolvedValue('recovered')
  }

  it('🔴 an approval, the recovery read merged: the core unknown notice', async () => {
    await cardOnScreen()
    stillRunningThenUnknown()
    await pressApprove()
    await waitFor(() => expect(recover).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(notices()).not.toContain(CORE_STILL_FINISHING_NOTICE), { timeout: 3000 })
    expect(turnPosts()).toHaveLength(3)
    expect(notices()).toContain(CORE_OUTCOME_UNKNOWN_NOTICE)
    expect(notices()).not.toContain(FINISHED)
  })

  it('🔴 the recovery read lists the card twice (no one card can be read): still the core unknown notice (Codex r1 on #2997)', async () => {
    await cardOnScreen()
    stillRunningThenUnknown()
    recover.mockImplementation(async (args: { scenarioId: string }) => {
      // Published as `serverGraphHydration.ts` publishes a read's held set, and taken at once (the panel's reconcile is not measured here).
      const store = useServerConversationTurnsStore.getState()
      store.offerServerConversationTurns({ scenarioId: args.scenarioId, turns: [], heldProposalOffers: [],
        proposalFields: { version: 1, graph_hash: CARD.model.revision, proposals: [CARD.cards[0], CARD.cards[0]] }, run: { runNotCurrent: false, currentRunComputedAt: null } })
      store.takeServerConversationTurns(args.scenarioId)
      return 'recovered'
    })
    await pressApprove()
    await waitFor(() => expect(recover).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(notices()).not.toContain(CORE_STILL_FINISHING_NOTICE), { timeout: 3000 })
    expect(notices()).toContain(CORE_OUTCOME_UNKNOWN_NOTICE)
    expect(notices()).not.toContain(FINISHED)
  })

  it('🔴 C7: a typed turn recovered the same way says unknown too: a merged graph is not this turn finishing', async () => {
    await cardOnScreen()
    stillRunningThenUnknown()
    await act(async () => { await live!.sendMessage('Add staff absence as a factor.') })
    await waitFor(() => expect(recover).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(notices()).not.toContain(CORE_STILL_FINISHING_NOTICE), { timeout: 3000 })
    expect(notices()).toContain(CORE_OUTCOME_UNKNOWN_NOTICE)
    expect(notices()).not.toContain(FINISHED)
  })

  it('CONTRAST: a replay answered with its own saved receipt (CEE 502 after its save) says saved, whatever the read', async () => {
    await cardOnScreen()
    turnAnswers.push(() => json(clone(served.still_running.body), served.still_running.status))
    turnAnswers.push(() => json({ ...coreError({ code: 'UPSTREAM_ERROR', message: 'x', retry_safe: false, nothing_saved: false }),
      receipts: clone(served.receipt_approval.turn.receipts) }, 502))
    recover.mockReset()
    recover.mockResolvedValue('recovered')
    await act(async () => { await live!.sendMessage('Add staff absence as a factor.') })
    await waitFor(() => expect(recover).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(notices()).not.toContain(CORE_STILL_FINISHING_NOTICE), { timeout: 3000 })
    expect(notices()).toContain(CORE_SAVED_REPLY_FAILED_NOTICE)
    expect(notices()).not.toContain(CORE_OUTCOME_UNKNOWN_NOTICE)
  })
})
