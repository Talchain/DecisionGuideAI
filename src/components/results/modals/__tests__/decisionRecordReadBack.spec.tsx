/**
 * ⭐ S9 (DL 5a, 15 Oct 2026): a signed-in scenario reads its decision record BACK from CEE's account
 * (`POST /assist/v1/decision-records/list`, via `/bff/cee`), so a cold reopen — empty localStorage, another browser —
 * shows the decision the user recorded, verbatim, and says it is on the account. A guest makes no call.
 *
 * The list body is CEE's `DecisionRecordListItem` shape field for field (`assist.v1.decision-records.ts`), newest first.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const identity = vi.hoisted(() => ({ userId: 'user-a' as string | null, accessToken: 'tok-a' as string | null }))
vi.mock('../../../../lib/supabase', () => ({ getSessionIdentity: async () => ({ ...identity }) }))

import {
  observeDecisionRecordOwner, useDecisionRecordForScenario, useDecisionRecordStore,
} from '../decisionRecordStore'
import { storageSentenceFor } from '../../analysisNew/sections/DecisionRecorded'
import { isStateChangingCeeRequest } from '../../../../lib/viewerMode'

const SCN = '0b9f1e52-7d3a-4c8e-9a51-2f6c1d0e4b77'
const NEWEST = {
  record_id: 'rec-2', created_at: '2026-10-14T21:05:00.000Z', review_date: '2027-01-12T00:00:00.000Z',
  position: 'chosen', chosen_option_id: 'opt_hire_two', chosen_option_label: 'Hire two developers',
  confidence_0_100: 60, expectation_statement: 'Delivery up 15% by March.',
  rationale: 'Two people cover each other on leave.', key_assumption: 'Onboarding takes under six weeks.',
  graph_hash: 'aag_v1:sha256:abc', has_outcome: false,
}
const OLDER = { ...NEWEST, record_id: 'rec-1', created_at: '2026-10-10T09:00:00.000Z', chosen_option_label: 'Hire one lead' }

const fetchSpy = vi.fn(async (_url: string, _init?: RequestInit) =>
  new Response(JSON.stringify({ records: [NEWEST, OLDER], total_count: 2, truncated: false }), { status: 200 }))

beforeEach(() => {
  identity.userId = 'user-a'; identity.accessToken = 'tok-a'
  vi.stubGlobal('fetch', fetchSpy)
  fetchSpy.mockClear()
  useDecisionRecordStore.getState()._reset()
  observeDecisionRecordOwner('user-a')
})
afterEach(() => { vi.unstubAllGlobals() })

describe('5a: the decision record is read back from the account', () => {
  it('COLD REOPEN: with nothing on this device, the newest account record shows verbatim, said to be on the account', async () => {
    const { result } = renderHook(() => useDecisionRecordForScenario(SCN))
    await waitFor(() => expect(result.current).not.toBeNull())
    const record = result.current!
    expect(record).toMatchObject({
      optionId: 'opt_hire_two', optionLabel: 'Hire two developers', confidence: 60,
      expectation: 'Delivery up 15% by March.', rationale: 'Two people cover each other on leave.',
      assumptionToWatch: 'Onboarding takes under six weeks.', revisitTrigger: '',
      remote: { recordId: 'rec-2', reviewDate: '2027-01-12T00:00:00.000Z' },
    })
    expect(record.remote?.reviewDateSource).toBeUndefined()
    // The request: the read-back route, the user's own bearer, this scenario.
    const [url, init] = fetchSpy.mock.calls[0]!
    expect(url).toBe('/bff/cee/decision-records/list')
    expect(init?.method).toBe('POST')
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer tok-a')
    expect(JSON.parse(String(init?.body))).toEqual({ scenario_id: SCN })
    // What the user reads: everything it carries is on the account; nothing is said to be on this device.
    const sentence = storageSentenceFor(record)
    expect(sentence).toMatch(/on your account/)
    expect(sentence).not.toMatch(/on this device/)
  })

  it('GUEST: no request is made, and nothing is shown', async () => {
    useDecisionRecordStore.getState()._reset()
    observeDecisionRecordOwner(null)
    identity.userId = null; identity.accessToken = null
    const { result } = renderHook(() => useDecisionRecordForScenario(SCN))
    await new Promise((r) => setTimeout(r, 20))
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(result.current).toBeNull()
  })

  it('a decision saved on this device and NOT confirmed stays, labelled as on this device', async () => {
    useDecisionRecordStore.getState().saveRecord(SCN, {
      optionId: 'opt_wait', optionLabel: 'Wait a quarter', optionNumber: 3, confidence: 40,
      rationale: 'Budget freeze.', assumptionToWatch: '', revisitTrigger: '', analysisHash: null, savedAt: Date.now(),
    })
    const { result } = renderHook(() => useDecisionRecordForScenario(SCN))
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled())
    await new Promise((r) => setTimeout(r, 20))
    expect(result.current).toMatchObject({ optionLabel: 'Wait a quarter', remote: null })
    expect(storageSentenceFor(result.current!)).toMatch(/On this device/)
  })

  it('the SAME record held locally takes the account’s fields; its local option number stays', async () => {
    const store = useDecisionRecordStore.getState()
    const capture = store.saveRecord(SCN, {
      optionId: 'opt_hire_two', optionLabel: 'Hire two developers', optionNumber: 2, confidence: 60,
      rationale: 'an older local wording', assumptionToWatch: '', revisitTrigger: '', analysisHash: 'h1', savedAt: Date.now(),
    })!
    store.attachRemote(SCN, capture, { recordId: 'rec-2', reviewDate: '2027-01-12T00:00:00.000Z', reviewDateSource: 'user_set' })
    const { result } = renderHook(() => useDecisionRecordForScenario(SCN))
    await waitFor(() => expect(result.current?.rationale).toBe('Two people cover each other on leave.'))
    expect(result.current).toMatchObject({ optionNumber: 2, analysisHash: 'h1' })
  })

  it('FENCE: a read that lands after the account changed is discarded', async () => {
    let release!: () => void
    fetchSpy.mockImplementationOnce(() => new Promise((resolve) => {
      release = () => resolve(new Response(JSON.stringify({ records: [NEWEST] }), { status: 200 }))
    }))
    const { result } = renderHook(() => useDecisionRecordForScenario(SCN))
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled())
    observeDecisionRecordOwner('user-b')
    release()
    await new Promise((r) => setTimeout(r, 20))
    expect(result.current).toBeNull()
  })

  it('viewer mode lets the read-back through and still blocks the writes', () => {
    expect(isStateChangingCeeRequest('/bff/cee/decision-records/list')).toBe(false)
    expect(isStateChangingCeeRequest('/bff/cee/decision-records/commit')).toBe(true)
    expect(isStateChangingCeeRequest('/bff/cee/decision-records/r1/outcome')).toBe(true)
  })
})
