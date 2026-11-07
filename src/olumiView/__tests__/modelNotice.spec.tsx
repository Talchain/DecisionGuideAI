/**
 * The model moved, in words (TIER-C-DESIGN-QA defects 7 and 9). The person's own approval: "Version N saved. Approved by <them>." A newer
 * version another member approved, found by the background re-read: "Model changed to version N. Approved by <them>." Never for a version
 * the person approved themselves. Only a number (core's `n`, the View's `version.n`) and a name are drawn.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import golden from '../golden/european.view.json'
import type { View } from '../client'
import { useViewStore } from '../store'
import { POLL_MS, useViewPoll } from '../poll'
import { noteEditSaved, noteSaved, noticeWords, useModelNotice } from '../notice'
import { setTeamFetch } from '../../olumiCore/team/api'

const SID = 's_0123456789ab'
const base = golden as unknown as View
const at = (n: number): View => ({ ...base, id: SID, you: 'Ada', you_id: 'p_1', version: { id: n, n, label: `version ${n}`, changed: [] } })
let served: View, versions: Array<{ n: number; by: string }>
beforeEach(() => {
  vi.useFakeTimers()
  served = at(1); versions = [{ n: 1, by: 'Ada' }]
  setTeamFetch((async (u: unknown) => new Response(JSON.stringify(String(u).includes('/versions') ? { versions } : served), { status: 200 })) as unknown as typeof fetch)
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-0123456789ab', sid: SID, view: at(1), status: 'ready', error: null, stale: false, at: null })
  useModelNotice.setState({ notice: null })
})
afterEach(() => { vi.useRealTimers(); setTeamFetch(null) })
const tick = async (ms: number) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms) }) }

describe('the model moved, in words', () => {
  it('CATCH: the person\'s own approval is a receipt with core\'s version number and their name', () => {
    noteSaved({ version: 7, n: 2, receipt: 'approve:1' })
    expect(noticeWords(useModelNotice.getState().notice!)).toBe('Version 2 saved. Approved by Ada.')
  })
  it('CATCH (slice 2): the person\'s own direct edit is a receipt with core\'s version number, never "Approved by" (nothing was approved)', () => {
    noteEditSaved({ version: 7, n: 2, receipt: 'figures:7', record: 'weekly_churn' })
    expect(noticeWords(useModelNotice.getState().notice!)).toBe('Version 2 saved.')
  })
  it('CONTRAST: an answer with no version number says nothing', () => {
    noteSaved({}); noteSaved(null); noteSaved({ n: '2' })
    expect(useModelNotice.getState().notice).toBeNull()
  })
  it('CATCH: another member\'s approval reaches the page on the re-read and is said with their name', async () => {
    renderHook(() => useViewPoll(true))
    served = at(2); versions = [{ n: 1, by: 'Ada' }, { n: 2, by: 'Bea' }]
    await tick(POLL_MS + 10)
    const n = useModelNotice.getState().notice!
    // Neutral (checker, slice 2a): core's versions name who made each, not whether it was an approval or their own direct edit.
    expect([n.kind, noticeWords(n)]).toEqual(['moved', 'Model changed to version 2 by Bea.'])
  })
  it('CONTRAST: a version the person approved themselves (another tab, a figure edit) is not "changed" to them', async () => {
    renderHook(() => useViewPoll(true))
    served = at(2); versions = [{ n: 1, by: 'Ada' }, { n: 2, by: 'Ada' }]
    await tick(POLL_MS + 10)
    expect(useModelNotice.getState().notice).toBeNull()
  })
  it('CONTRAST: no new version, no line; an unreadable version list says nothing', async () => {
    renderHook(() => useViewPoll(true))
    await tick(POLL_MS + 10)
    expect(useModelNotice.getState().notice).toBeNull()
    served = at(3); versions = undefined as unknown as typeof versions
    await tick(POLL_MS + 10)
    expect(useModelNotice.getState().notice).toBeNull()
  })
})
