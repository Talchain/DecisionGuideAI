/**
 * ⭐ DECIDE & REVIEW S2 (DL 380e54 ruling (B), 2 Oct): a decision a GUEST recorded travels with the ACCOUNTS B3 copy
 * of that same scenario into the account that signs in, as a record on this device. Bound by identity: exact
 * scenario ids, the exact option and rationale, the exact sentence.
 * DL condition 4 rows: success re-key · copy-fail → dropped · account switch before the copy → dropped ·
 * a copy of another source → nothing. Codex S2 r1 rows: a stale-generation copy never consumes the next sign-in's
 * carry · a transient failure drops it · a later page load never uses it · only a CREATED copy receives it · never
 * over another tab's persisted record.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

type AuthCallback = (event: string, session: { access_token: string } | null) => void
const auth = vi.hoisted(() => ({ callbacks: [] as Array<(event: string, session: unknown) => void> }))
vi.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: (cb: (event: string, session: unknown) => void) => {
        auth.callbacks.push(cb)
        return { data: { subscription: { unsubscribe: () => { auth.callbacks = auth.callbacks.filter((c) => c !== cb) } } } }
      },
    },
  },
}))
vi.mock('../../../lib/storedSupabaseSession', () => ({ hasStoredSupabaseSession: () => false }))
const canvas = vi.hoisted(() => ({ current: null as string | null, onAdopting: null as null | (() => void) }))
vi.mock('../../../canvas/store', () => ({
  // `onAdopting` runs inside B3's canvas adoption: AFTER the copy request returned, BEFORE B3 announces the copy.
  useCanvasStore: { getState: () => { const f = canvas.onAdopting; canvas.onAdopting = null; f?.(); return { currentScenarioId: canvas.current, adoptScenario: vi.fn() } } },
}))
const mockRequest = vi.fn()
vi.mock('../../../services/guestCopyService', () => ({ requestGuestCopy: (...args: unknown[]) => mockRequest(...args) }))

import GuestCopyOnSignIn from '../GuestCopyOnSignIn'
import { capturePendingGuestCopy, peekPendingGuestCopy, SPENT_GUEST_POINTER_KEY } from '../../../lib/pendingGuestCopy'
import * as S from '../../results/modals/decisionRecordStore'
import { storageSentenceFor } from '../../results/analysisNew/sections/DecisionRecorded'
import { ANALYSIS_NEW_COPY as TEXT } from '../../results/analysisNew/analysisNewCopy'

const GUEST_SCENARIO = '7c9e6679-7425-40de-944b-e07fc1f90ae7'
const COPY_SCENARIO = '3b241101-e2bb-4255-8caf-4136c566a962'
const OTHER_SCENARIO = '9f8b7a6c-1234-4def-8abc-0123456789ab'
const USER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const OTHER_USER = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const POINTER = 'olumi-canvas-current-scenario-id'
const GUEST_RECORD: S.OptionDecisionRecord = {
  optionId: 'opt_b', optionLabel: 'Option B', optionNumber: 2, confidence: 72, expectation: 'Runway holds above 9 months.',
  rationale: 'Cheaper to reverse.', assumptionToWatch: 'Churn stays flat.', revisitTrigger: 'Q4 numbers.',
  analysisHash: 'results-hash-guest', savedAt: Date.parse('2026-10-02T08:00:00.000Z'), remote: null,
}
const shown = (id: string) => S.selectDecisionRecord(S.useDecisionRecordStore.getState(), id)
const carryKeys = () => Object.keys(localStorage).filter((k) => k.endsWith(':guestCarry'))

/** A guest on the canvas, with a decision recorded on GUEST_SCENARIO. */
function guestHasRecorded(): void {
  S.observeDecisionRecordOwner(null)
  localStorage.setItem(POINTER, GUEST_SCENARIO)
  expect(S.useDecisionRecordStore.getState().saveRecord(GUEST_SCENARIO, GUEST_RECORD)).not.toBeNull()
}
function mount() {
  return render(<MemoryRouter initialEntries={['/canvas']}><GuestCopyOnSignIn /></MemoryRouter>)
}
/** AuthContext adopts the user (owner epoch first), then the B3 listener sees the sign-in. */
function signIn(userId: string, token = 'tok') {
  act(() => {
    S.observeDecisionRecordOwner(userId)
    auth.callbacks.forEach((cb) => (cb as AuthCallback)('INITIAL_SESSION', null))
    auth.callbacks.forEach((cb) => (cb as AuthCallback)('SIGNED_IN', { access_token: token }))
  })
}
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 0)) })
/** The newest owner epoch, as published to storage. */
const epoch = () => (JSON.parse(localStorage.getItem('decisionRecord.v2:owner') ?? 'null') as { epoch: string }).epoch

beforeEach(() => {
  localStorage.clear()
  auth.callbacks = []
  mockRequest.mockReset()
  canvas.current = GUEST_SCENARIO
  canvas.onAdopting = null
  S.useDecisionRecordStore.getState()._reset()
})

describe('the guest record travels with the B3 copy of its own scenario', () => {
  it('RED on base: the guest\'s decision shows on the COPY after sign-in — same option and texts, on this device only', async () => {
    guestHasRecorded()
    mockRequest.mockResolvedValue({ kind: 'copied', scenarioId: COPY_SCENARIO, created: true })
    mount()
    signIn(USER)
    await waitFor(() => expect(shown(COPY_SCENARIO)).not.toBeNull())
    const r = shown(COPY_SCENARIO) as S.OptionDecisionRecord
    expect([r.optionId, r.confidence, r.rationale, r.expectation]).toEqual(['opt_b', 72, 'Cheaper to reverse.', 'Runway holds above 9 months.'])
    expect(r.remote).toBeNull()
    expect(r.carriedFromGuest).toBe(true)
    expect(storageSentenceFor(r)).toBe(TEXT.decisionRecord.storedGuestCarried)
    expect(shown(GUEST_SCENARIO)).toBeNull() // the guest's own copy is erased at the boundary, as before
    expect(carryKeys()).toEqual([]) // used once
    // It persists like any record made on this device under this account: a reload still shows it.
    S.useDecisionRecordStore.getState()._rehydrateForTests()
    expect((shown(COPY_SCENARIO) as S.OptionDecisionRecord).carriedFromGuest).toBe(true)
  })

  it('COPY FAILS (never copyable) → the carry is DROPPED; nothing can move it afterwards', async () => {
    guestHasRecorded()
    mockRequest.mockResolvedValue({ kind: 'not_copyable' })
    mount()
    signIn(USER)
    await waitFor(() => expect(mockRequest).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(carryKeys()).toEqual([]))
    expect(S.adoptGuestCarry(GUEST_SCENARIO, COPY_SCENARIO, true)).toBe(false)
    expect(shown(COPY_SCENARIO)).toBeNull()
  })

  it('CODEX P1: a TRANSIENT copy failure (retry_later) also drops it — B3 keeps retrying the scenario, not the record', async () => {
    guestHasRecorded()
    mockRequest.mockResolvedValue({ kind: 'retry_later', reason: 'http_503' })
    mount()
    signIn(USER)
    await waitFor(() => expect(mockRequest).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(carryKeys()).toEqual([]))
    expect(localStorage.getItem('olumi.pendingGuestCopy.v1')).toBe(GUEST_SCENARIO) // B3's own retry is untouched
  })

  it('CODEX P1: a LATER PAGE LOAD never uses a carry it did not stash — deleted unused', () => {
    guestHasRecorded()
    S.observeDecisionRecordOwner(USER)
    expect(carryKeys()).toHaveLength(1)
    S.useDecisionRecordStore.getState()._rehydrateForTests() // a reload
    expect(S.adoptGuestCarry(GUEST_SCENARIO, COPY_SCENARIO, true)).toBe(false)
    expect(carryKeys()).toEqual([])
    expect(shown(COPY_SCENARIO)).toBeNull()
  })

  it('CODEX P2: a copy B3 did NOT create (it already existed) receives nothing — it may hold the account\'s own record', async () => {
    guestHasRecorded()
    mockRequest.mockResolvedValue({ kind: 'copied', scenarioId: COPY_SCENARIO, created: false })
    mount()
    signIn(USER)
    await waitFor(() => expect(mockRequest).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(carryKeys()).toEqual([]))
    expect(shown(COPY_SCENARIO)).toBeNull()
  })

  it('CODEX P1: a copy that lands in an ENDED sign-in (sign-out during adoption) never consumes the next sign-in\'s carry', async () => {
    guestHasRecorded()
    mockRequest.mockResolvedValueOnce({ kind: 'copied', scenarioId: COPY_SCENARIO, created: true })
    mockRequest.mockReturnValue(new Promise(() => {})) // the next sign-in's own copy is still in flight
    canvas.onAdopting = () => {
      // Signed out and signed in again as OTHER_USER while the first copy was being adopted. However the next
      // sign-in's carry for the same source arose, it is OTHER_USER's and only OTHER_USER's copy may move it.
      auth.callbacks.forEach((cb) => (cb as AuthCallback)('SIGNED_OUT', null))
      S.observeDecisionRecordOwner(null)
      localStorage.removeItem(SPENT_GUEST_POINTER_KEY)
      S.useDecisionRecordStore.getState().saveRecord(GUEST_SCENARIO, { ...GUEST_RECORD, optionId: 'opt_second_guest' })
      S.observeDecisionRecordOwner(OTHER_USER)
    }
    mount()
    signIn(USER)
    await waitFor(() => expect(mockRequest).toHaveBeenCalledTimes(1))
    await settle()
    await settle()
    expect(shown(COPY_SCENARIO)).toBeNull()
    expect(carryKeys()).toHaveLength(1) // OTHER_USER's carry is untouched
  })

  it('ACCOUNT SWITCH before the copy lands → dropped; it never shows in the other account', async () => {
    guestHasRecorded()
    let land!: (v: unknown) => void
    mockRequest.mockReturnValue(new Promise((r) => { land = r }))
    mount()
    signIn(USER)
    await waitFor(() => expect(mockRequest).toHaveBeenCalledTimes(1))
    expect(carryKeys()).toHaveLength(1)
    act(() => S.observeDecisionRecordOwner(OTHER_USER))
    expect(carryKeys()).toEqual([])
    await act(async () => { land({ kind: 'copied', scenarioId: COPY_SCENARIO, created: true }); await new Promise((r) => setTimeout(r, 0)) })
    expect(shown(COPY_SCENARIO)).toBeNull()
  })

  it('CODEX P1: another tab\'s SIGN-OUT landing between the boundary write and the carry write leaves no carry', () => {
    guestHasRecorded()
    const realSet = Storage.prototype.setItem
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, k: string, v: string) {
      if (k.endsWith(':guestCarry')) realSet.call(this, 'decisionRecord.v2:owner', JSON.stringify({ ownerId: null, epoch: 'signed-out-elsewhere' }))
      realSet.call(this, k, v)
    })
    try { S.observeDecisionRecordOwner(USER) } finally { spy.mockRestore() }
    expect(carryKeys()).toEqual([])
  })

  it('SIGN-OUT before the copy lands → dropped', () => {
    guestHasRecorded()
    S.observeDecisionRecordOwner(USER)
    expect(carryKeys()).toHaveLength(1)
    S.clearDecisionRecords()
    S.observeDecisionRecordOwner(null)
    expect(carryKeys()).toEqual([])
  })

  it('a copy of ANOTHER source moves nothing and keeps the carry for its own copy (identity, never title)', () => {
    guestHasRecorded()
    S.observeDecisionRecordOwner(USER)
    expect(S.adoptGuestCarry(OTHER_SCENARIO, COPY_SCENARIO, true)).toBe(false)
    expect(shown(COPY_SCENARIO)).toBeNull()
    expect(carryKeys()).toHaveLength(1)
    expect(S.adoptGuestCarry(GUEST_SCENARIO, COPY_SCENARIO, true)).toBe(true)
    expect((shown(COPY_SCENARIO) as S.OptionDecisionRecord).optionId).toBe('opt_b')
  })

  it('never over a record the copy already shows', () => {
    guestHasRecorded()
    S.observeDecisionRecordOwner(USER)
    S.useDecisionRecordStore.getState().saveRecord(COPY_SCENARIO, { ...GUEST_RECORD, optionId: 'opt_account' })
    expect(S.adoptGuestCarry(GUEST_SCENARIO, COPY_SCENARIO, true)).toBe(false)
    expect((shown(COPY_SCENARIO) as S.OptionDecisionRecord).optionId).toBe('opt_account')
  })

  it('CODEX P1: never over a record ANOTHER TAB persisted for the copy (this tab has not seen it yet)', () => {
    guestHasRecorded()
    S.observeDecisionRecordOwner(USER)
    const otherTabKey = `decisionRecord.v2:${epoch()}:record:${encodeURIComponent(COPY_SCENARIO)}`
    const otherTab = { version: 2, scenarioKey: COPY_SCENARIO, clientCommitId: 'other-tab', record: { ...GUEST_RECORD, optionId: 'opt_other_tab' } }
    localStorage.setItem(otherTabKey, JSON.stringify(otherTab))
    expect(shown(COPY_SCENARIO)).toBeNull() // not in this tab's memory
    expect(S.adoptGuestCarry(GUEST_SCENARIO, COPY_SCENARIO, true)).toBe(false)
    expect(JSON.parse(localStorage.getItem(otherTabKey)!).clientCommitId).toBe('other-tab')
  })
})

describe('CONTROLS: nothing else crosses the owner boundary', () => {
  it('a user → user switch carries nothing, even with a pending source', () => {
    S.observeDecisionRecordOwner(USER)
    localStorage.setItem(POINTER, GUEST_SCENARIO)
    S.useDecisionRecordStore.getState().saveRecord(GUEST_SCENARIO, GUEST_RECORD)
    S.observeDecisionRecordOwner(OTHER_USER)
    expect(carryKeys()).toEqual([])
    expect(S.adoptGuestCarry(GUEST_SCENARIO, COPY_SCENARIO, true)).toBe(false)
  })
  it('a guest record for a scenario B3 will NOT copy (the spent sign-out pointer) is not carried', () => {
    guestHasRecorded()
    localStorage.setItem(SPENT_GUEST_POINTER_KEY, GUEST_SCENARIO)
    S.observeDecisionRecordOwner(USER)
    expect(carryKeys()).toEqual([])
  })
  it('the peek names exactly what the B3 capture records (pending, live pointer, spent pointer)', () => {
    localStorage.setItem(POINTER, GUEST_SCENARIO)
    expect(peekPendingGuestCopy()).toBe(GUEST_SCENARIO)
    expect(localStorage.getItem('olumi.pendingGuestCopy.v1')).toBeNull() // peeking records nothing
    expect(capturePendingGuestCopy()).toBe(GUEST_SCENARIO)
    localStorage.setItem(POINTER, OTHER_SCENARIO)
    expect([peekPendingGuestCopy(), capturePendingGuestCopy()]).toEqual([GUEST_SCENARIO, GUEST_SCENARIO]) // write-once
    localStorage.clear()
    localStorage.setItem(POINTER, OTHER_SCENARIO)
    localStorage.setItem(SPENT_GUEST_POINTER_KEY, OTHER_SCENARIO)
    expect([peekPendingGuestCopy(), capturePendingGuestCopy()]).toEqual([null, null])
  })
  it('a record made on this device by the signed-in user keeps the existing sentence', () => {
    expect(storageSentenceFor({ ...GUEST_RECORD, remote: null })).toBe(TEXT.decisionRecord.storedLocal)
  })
  it('the carried sentence says WHEN it was made, WHERE it is, and that it is NOT on the account (DL condition 3)', () => {
    const line = TEXT.decisionRecord.storedGuestCarried
    expect(line).toMatch(/before you signed in/i)
    expect(line).toMatch(/on this device/i)
    expect(line).toMatch(/not on your account/i)
  })
})
