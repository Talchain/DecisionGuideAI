/**
 * ⭐ DECIDE & REVIEW S1 (MG lease #85 5948537951; DL owner-epoch rule): a signed-in user's recorded decision comes
 * back on a device that holds none — read from CEE's `/decision-records/list`, applied only for the current owner,
 * memory only, never over a local record. Bound by identity: exact record ids, exact mapped fields.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, waitFor } from '@testing-library/react'
import type { OptionDecisionRecord } from '../decisionRecordStore'

type SessionIdentity = { userId: string | null; accessToken: string | null }
const OWNER_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const OTHER_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const mockGetSessionIdentity = vi.fn<[], Promise<SessionIdentity>>(async () => ({ userId: OWNER_ID, accessToken: 'tok' }))
let authState: { user: { id: string } | null } = { user: { id: OWNER_ID } }
vi.mock('../../../../contexts/AuthContext', () => ({ useAuth: () => authState }))
vi.mock('../../../../lib/supabase', () => ({
  supabase: {},
  getSessionIdentity: (...args: unknown[]) => (mockGetSessionIdentity as unknown as (...a: unknown[]) => unknown)(...args),
}))

const { useCanvasStore } = await import('../../../../canvas/store')
const S = await import('../decisionRecordStore')
const { readListedRecord, listDecisionRecords } = await import('../../../../services/decisionRecordListService')
const { DecisionRecordServerSync } = await import('../DecisionRecordServerSync')
const { storageSentenceFor, DECISION_POSITION_COPY } = await import('../../analysisNew/sections/DecisionRecorded')

const SCENARIO_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OTHER_SCENARIO = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const CHOSEN = {
  record_id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', created_at: '2026-10-02T08:00:00.000Z', review_date: '2026-12-31T00:00:00.000Z',
  graph_hash: 'aag_v1:abc', has_outcome: false, position: 'chosen', chosen_option_id: 'opt_b', chosen_option_label: 'Option B',
  confidence_0_100: 72, expectation_statement: 'Runway holds above 9 months.', rationale: 'Cheaper to reverse.',
}
const NOT_READY = {
  record_id: 'ffffffff-ffff-4fff-8fff-ffffffffffff', created_at: '2026-10-01T08:00:00.000Z', review_date: '2026-12-30T00:00:00.000Z',
  graph_hash: null, has_outcome: false, position: 'not_ready', revisit_trigger: 'When Q4 numbers land.',
}
/** The listed CHOSEN row, typed as the option record it is (the reader returns the union). */
const chosenRecord = () => readListedRecord(CHOSEN) as OptionDecisionRecord
const fetchReturning = (status: number, body: unknown) => vi.spyOn(globalThis, 'fetch').mockResolvedValue(
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }))
const key = (id: string) => id // scenario ids resolve to themselves (resolveScenarioKey)
/** The owner generation records are currently shown for. */
const epochNow = () => S.useDecisionRecordStore.getState().ownerEpoch ?? 'no-epoch'

beforeEach(() => {
  localStorage.clear()
  S.useDecisionRecordStore.getState()._reset()
  mockGetSessionIdentity.mockResolvedValue({ userId: OWNER_ID, accessToken: 'tok' })
  authState = { user: { id: OWNER_ID } }
})
afterEach(() => { vi.restoreAllMocks() })

describe('the listed record maps onto the store\'s own shape — never half-true', () => {
  it('a chosen record: option, confidence, expectation; every returned text is ON THE ACCOUNT; the rung is not invented', () => {
    const r = readListedRecord(CHOSEN)
    expect(r).toEqual({
      rationale: 'Cheaper to reverse.', assumptionToWatch: '', revisitTrigger: '', analysisHash: null, savedAt: Date.parse(CHOSEN.created_at),
      remote: { recordId: CHOSEN.record_id, reviewDate: CHOSEN.review_date, reviewDateSource: 'read_back', storedTextFields: ['rationale'] },
      optionId: 'opt_b', optionLabel: 'Option B', optionNumber: null, confidence: 72, expectation: 'Runway holds above 9 months.',
    })
  })
  it('a not-ready record carries no option, confidence or expectation', () => {
    const r = readListedRecord(NOT_READY)!
    expect(S.isNotReadyRecord(r)).toBe(true)
    expect(r).not.toHaveProperty('optionId')
    expect(r.remote?.storedTextFields).toEqual(['revisit_trigger'])
  })
  it('a fractional stated confidence comes back as stated (CEE returns 72.4 for a stored 0.724; never rounded)', () => {
    expect((readListedRecord({ ...CHOSEN, confidence_0_100: 72.4 }) as { confidence: number }).confidence).toBe(72.4)
  })
  it('CONTROL: an unknown position, a missing label, or a confidence outside 0–100 / not a finite number is DROPPED', () => {
    expect(readListedRecord({ ...CHOSEN, position: 'maybe' })).toBeNull()
    expect(readListedRecord({ ...CHOSEN, chosen_option_label: '' })).toBeNull()
    expect(readListedRecord({ ...CHOSEN, confidence_0_100: 101 })).toBeNull()
    expect(readListedRecord({ ...CHOSEN, confidence_0_100: -0.1 })).toBeNull()
    expect(readListedRecord({ ...CHOSEN, confidence_0_100: Number.NaN })).toBeNull()
    expect(readListedRecord({ ...CHOSEN, confidence_0_100: '72' })).toBeNull()
  })
  it('CODEX S1 P2: a read-back record with NO texts says only what the account holds — never "on this device" for texts it does not have', () => {
    const bare = readListedRecord({ ...CHOSEN, rationale: undefined, expectation_statement: 'Runway holds above 9 months.' })!
    expect(bare.remote?.storedTextFields).toEqual([])
    const line = storageSentenceFor(bare)
    expect(line).not.toMatch(/on this device/i)
    expect(line).toBe(DECISION_POSITION_COPY.accountOptionWithExpectation)
  })
  it('HASH FAMILIES: the server\'s graph hash is never put where the device\'s results hash goes', () => {
    expect(readListedRecord(CHOSEN)?.analysisHash).toBeNull()
    expect(JSON.stringify(readListedRecord(CHOSEN))).not.toContain(CHOSEN.graph_hash)
  })
})

describe('the service', () => {
  it('a guest makes NO call (CEE\'s DR001 by design)', async () => {
    mockGetSessionIdentity.mockResolvedValue({ userId: null, accessToken: null })
    const f = fetchReturning(200, { records: [CHOSEN] })
    expect(await listDecisionRecords(SCENARIO_ID)).toEqual({ status: 'guest' })
    expect(f).not.toHaveBeenCalled()
  })
  it('posts the scenario id through the /bff/cee seam with the user\'s token, and returns the verified owner', async () => {
    const f = fetchReturning(200, { records: [CHOSEN, { ...CHOSEN, record_id: 'x', chosen_option_id: '' }], total_count: 2, truncated: false })
    const res = await listDecisionRecords(SCENARIO_ID)
    expect(f).toHaveBeenCalledWith('/bff/cee/decision-records/list', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ scenario_id: SCENARIO_ID }), headers: expect.objectContaining({ Authorization: 'Bearer tok' }) }))
    expect(res.status === 'ok' && res.ownerId).toBe(OWNER_ID)
    expect(res.status === 'ok' && res.records.map((r) => r.remote?.recordId)).toEqual([CHOSEN.record_id])
  })
  it('a refusal is an error with CEE\'s own code', async () => {
    fetchReturning(404, { code: 'scenario_not_found' })
    expect(await listDecisionRecords(SCENARIO_ID)).toEqual({ status: 'error', code: 'scenario_not_found' })
  })
})

describe('hydration: the current owner only, memory only, never over a local record (DL owner-epoch rule)', () => {
  const record = () => readListedRecord(CHOSEN)!
  it('RED: a signed-in owner with NO record on this device sees the account\'s record', () => {
    S.observeDecisionRecordOwner(OWNER_ID)
    expect(S.hydrateDecisionRecordFromServer(key(SCENARIO_ID), OWNER_ID, record(), epochNow())).toBe(true)
    expect(S.selectDecisionRecord(S.useDecisionRecordStore.getState(), SCENARIO_ID)?.remote?.recordId).toBe(CHOSEN.record_id)
  })
  it('a read that lands after an ACCOUNT SWITCH writes nothing; nor for a guest boundary', () => {
    S.observeDecisionRecordOwner(OTHER_ID)
    expect(S.hydrateDecisionRecordFromServer(key(SCENARIO_ID), OWNER_ID, record(), epochNow())).toBe(false)
    S.observeDecisionRecordOwner(null)
    expect(S.hydrateDecisionRecordFromServer(key(SCENARIO_ID), OWNER_ID, record(), epochNow())).toBe(false)
    expect(S.selectDecisionRecord(S.useDecisionRecordStore.getState(), SCENARIO_ID)).toBeNull()
  })
  it('a LOCAL record wins (it holds this device\'s texts and its own acknowledgement)', () => {
    S.observeDecisionRecordOwner(OWNER_ID)
    const local = { ...chosenRecord(), optionId: 'opt_local', remote: null }
    S.useDecisionRecordStore.getState().saveRecord(SCENARIO_ID, local)
    expect(S.hydrateDecisionRecordFromServer(key(SCENARIO_ID), OWNER_ID, record(), epochNow())).toBe(false)
    expect((S.selectDecisionRecord(S.useDecisionRecordStore.getState(), SCENARIO_ID) as { optionId: string }).optionId).toBe('opt_local')
  })
  it('CODEX S1 P1: a read from an EARLIER generation of the SAME user (sign-out, then the same user again) is never applied', () => {
    S.observeDecisionRecordOwner(OWNER_ID)
    const started = epochNow()
    S.clearDecisionRecords()
    S.observeDecisionRecordOwner(OWNER_ID)
    expect(epochNow()).not.toBe(started)
    expect(S.hydrateDecisionRecordFromServer(key(SCENARIO_ID), OWNER_ID, record(), started)).toBe(false)
    expect(S.selectDecisionRecord(S.useDecisionRecordStore.getState(), SCENARIO_ID)).toBeNull()
  })
  it('CODEX S1 P2: another tab\'s write for an UNRELATED scenario keeps the read-back record; a record on disk for the SAME scenario still wins', () => {
    S.observeDecisionRecordOwner(OWNER_ID)
    S.hydrateDecisionRecordFromServer(key(SCENARIO_ID), OWNER_ID, record(), epochNow())
    const diskKey = (id: string) => `decisionRecord.v2:${epochNow()}:record:${encodeURIComponent(id)}`
    const stored = (id: string, optionId: string) => JSON.stringify({ version: 2, scenarioKey: id, clientCommitId: `tab-${optionId}`, record: { ...record(), optionId, remote: null } })
    localStorage.setItem(diskKey(OTHER_SCENARIO), stored(OTHER_SCENARIO, 'opt_other_tab'))
    window.dispatchEvent(new StorageEvent('storage', { key: diskKey(OTHER_SCENARIO) }))
    expect(S.selectDecisionRecord(S.useDecisionRecordStore.getState(), SCENARIO_ID)?.remote?.recordId).toBe(CHOSEN.record_id)
    expect((S.selectDecisionRecord(S.useDecisionRecordStore.getState(), OTHER_SCENARIO) as { optionId: string }).optionId).toBe('opt_other_tab')
    localStorage.setItem(diskKey(SCENARIO_ID), stored(SCENARIO_ID, 'opt_local_tab'))
    window.dispatchEvent(new StorageEvent('storage', { key: diskKey(SCENARIO_ID) }))
    expect((S.selectDecisionRecord(S.useDecisionRecordStore.getState(), SCENARIO_ID) as { optionId: string }).optionId).toBe('opt_local_tab')
  })
  it('MEMORY ONLY: account data is never written to this device — a reload re-reads storage and finds nothing', () => {
    S.observeDecisionRecordOwner(OWNER_ID)
    S.hydrateDecisionRecordFromServer(key(SCENARIO_ID), OWNER_ID, record(), epochNow())
    expect(Object.keys(localStorage).filter((k) => k.includes(':record:'))).toEqual([])
    S.useDecisionRecordStore.getState()._rehydrateForTests()
    expect(S.selectDecisionRecord(S.useDecisionRecordStore.getState(), SCENARIO_ID)).toBeNull()
  })
})

describe('the sync component (mounted beside the modal)', () => {
  it('RED on base: opening a scenario with no local record shows the account\'s newest record', async () => {
    S.observeDecisionRecordOwner(OWNER_ID)
    fetchReturning(200, { records: [CHOSEN, NOT_READY], total_count: 2, truncated: false })
    useCanvasStore.setState({ currentScenarioId: SCENARIO_ID } as never)
    render(<DecisionRecordServerSync />)
    await waitFor(() => expect(S.selectDecisionRecord(S.useDecisionRecordStore.getState(), SCENARIO_ID)?.remote?.recordId).toBe(CHOSEN.record_id))
  })
  it('CONTROL: a scenario that already has a local record makes NO call', async () => {
    S.observeDecisionRecordOwner(OWNER_ID)
    S.useDecisionRecordStore.getState().saveRecord(SCENARIO_ID, { ...readListedRecord(CHOSEN)!, remote: null })
    const f = fetchReturning(200, { records: [CHOSEN] })
    useCanvasStore.setState({ currentScenarioId: SCENARIO_ID } as never)
    render(<DecisionRecordServerSync />)
    await new Promise((r) => setTimeout(r, 0))
    expect(f).not.toHaveBeenCalled()
  })
  it('CODEX S1 P1: sign-out then the SAME user again while a read is in flight → the stale reply is dropped and the new generation reads again', async () => {
    S.observeDecisionRecordOwner(OWNER_ID)
    const lands: Array<(r: Response) => void> = []
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise<Response>((r) => { lands.push(r) }))
    useCanvasStore.setState({ currentScenarioId: SCENARIO_ID } as never)
    const view = render(<DecisionRecordServerSync />)
    await waitFor(() => expect(lands).toHaveLength(1))
    act(() => { S.clearDecisionRecords(); S.observeDecisionRecordOwner(OWNER_ID) })
    view.rerender(<DecisionRecordServerSync />)
    await waitFor(() => expect(lands).toHaveLength(2))
    const STALE = { ...CHOSEN, record_id: '11111111-1111-4111-8111-111111111111' }
    await act(async () => { lands[0]!(new Response(JSON.stringify({ records: [STALE] }), { status: 200 })); await new Promise((r) => setTimeout(r, 0)) })
    expect(S.selectDecisionRecord(S.useDecisionRecordStore.getState(), SCENARIO_ID)).toBeNull()
    await act(async () => { lands[1]!(new Response(JSON.stringify({ records: [CHOSEN] }), { status: 200 })); await new Promise((r) => setTimeout(r, 0)) })
    expect(S.selectDecisionRecord(S.useDecisionRecordStore.getState(), SCENARIO_ID)?.remote?.recordId).toBe(CHOSEN.record_id)
  })
  it('a reply for a scenario the user has already LEFT is dropped', async () => {
    S.observeDecisionRecordOwner(OWNER_ID)
    let resolve!: (r: Response) => void
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise<Response>((r) => { resolve = r }))
    useCanvasStore.setState({ currentScenarioId: SCENARIO_ID } as never)
    const view = render(<DecisionRecordServerSync />)
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled())
    useCanvasStore.setState({ currentScenarioId: OTHER_SCENARIO } as never)
    view.rerender(<DecisionRecordServerSync />)
    resolve(new Response(JSON.stringify({ records: [CHOSEN] }), { status: 200 }))
    await new Promise((r) => setTimeout(r, 0))
    expect(S.selectDecisionRecord(S.useDecisionRecordStore.getState(), SCENARIO_ID)).toBeNull()
  })
  const holdFetch = () => {
    let resolve!: (r: Response) => void
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise<Response>((r) => { resolve = r }))
    return (body: unknown) => resolve(new Response(JSON.stringify(body), { status: 200 }))
  }
  it('CODEX BUDDY: a reply that lands after an ACCOUNT SWITCH writes nothing for the new account', async () => {
    S.observeDecisionRecordOwner(OWNER_ID)
    const land = holdFetch()
    useCanvasStore.setState({ currentScenarioId: SCENARIO_ID } as never)
    render(<DecisionRecordServerSync />)
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled())
    S.observeDecisionRecordOwner(OTHER_ID)
    land({ records: [CHOSEN] })
    await new Promise((r) => setTimeout(r, 0))
    expect(S.selectDecisionRecord(S.useDecisionRecordStore.getState(), SCENARIO_ID)).toBeNull()
  })
  it('CODEX BUDDY: a decision recorded on THIS device while the read is in flight is never replaced by the older server row', async () => {
    S.observeDecisionRecordOwner(OWNER_ID)
    const land = holdFetch()
    useCanvasStore.setState({ currentScenarioId: SCENARIO_ID } as never)
    render(<DecisionRecordServerSync />)
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled())
    S.useDecisionRecordStore.getState().saveRecord(SCENARIO_ID, { ...chosenRecord(), optionId: 'opt_local', remote: null })
    land({ records: [CHOSEN] })
    await new Promise((r) => setTimeout(r, 0))
    const shown = S.selectDecisionRecord(S.useDecisionRecordStore.getState(), SCENARIO_ID) as { optionId: string; remote: unknown }
    expect(shown.optionId).toBe('opt_local')
    expect(shown.remote).toBeNull() // still "on this device", not lent the account's proof
  })
  it('RED on the first cut: a cold open whose session resolves AFTER the scenario still reads the account back', async () => {
    authState = { user: null }
    fetchReturning(200, { records: [CHOSEN] })
    useCanvasStore.setState({ currentScenarioId: SCENARIO_ID } as never)
    const view = render(<DecisionRecordServerSync />)
    await new Promise((r) => setTimeout(r, 0))
    expect(globalThis.fetch).not.toHaveBeenCalled() // no user yet: no call
    S.observeDecisionRecordOwner(OWNER_ID) // auth adoption sets the owner epoch BEFORE exposing the user
    authState = { user: { id: OWNER_ID } }
    view.rerender(<DecisionRecordServerSync />)
    await waitFor(() => expect(S.selectDecisionRecord(S.useDecisionRecordStore.getState(), SCENARIO_ID)?.remote?.recordId).toBe(CHOSEN.record_id))
  })
})
