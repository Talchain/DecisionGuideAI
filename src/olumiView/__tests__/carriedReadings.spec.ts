/**
 * PL-661 (core PL-629, wip/pending-readings eee94aac): a reading carried from an earlier message must be settled by the person, one by one.
 * The layer offers the explicit act, declining a reading, by the View's opaque `reading.id` exactly as served (never built or parsed); Unsure is
 * not a refusal; and setting a proposal aside refuses only the readings the person declined (core's `refuse_readings` on discard), never
 * silently. Paul keeps 1.3m, accepts Sam's unit, declines the carried 1.5m: one approval carrying exactly that. The write boundary is mocked.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
const sent: { what: string; args: unknown[] }[] = []
vi.mock('../client', () => ({ writes: {
  approve: async (...args: unknown[]) => { sent.push({ what: 'approve', args }); return { ok: true } },
  discard: async (...args: unknown[]) => { sent.push({ what: 'discard', args }); return { receipt: 'x' } },
} }))
vi.mock('../../olumiCore/team/writes', () => ({ runWrite: async (_k: string, _o: unknown, _b: unknown, fn: (op?: string) => Promise<unknown>) => fn() }))
vi.mock('../store', () => ({ useViewStore: { getState: () => (globalThis as { __S__?: unknown }).__S__ } }))
import * as J from '../journey'

// Opaque keys as a core with carried readings serves them: never a record id the client could build.
const CARRIED = 'rd:9f2c1e7a:current_funding_ask', UNIT = 'rd:51b0d4c2:runway'
const changes = [{ id: 'current_funding_ask', top: false }, { id: 'runway', top: false }] as never
;(globalThis as { __S__?: unknown }).__S__ = { sid: 's_mock', at: null, view: { proposal: { id: 31, base: 26, changes, marks: [
  { what: 'Current funding ask', status: 'kept as you gave it; Olumi read 1.5m', title: '…', reading: { id: CARRIED } },
  { what: 'Runway', status: 'Olumi read months', title: '…', reading: { id: UNIT } }] } }, modelChanged: async () => true }
afterEach(() => { sent.length = 0 })

describe('PL-661: carried readings are settled only by the person, by the served id', () => {
  it('Paul keeps 1.3m (declines the carried 1.5m) and accepts Sam\'s unit: one approval carrying exactly that', async () => {
    const picks = J.picksOf(changes, J.tickEvery(changes))
    await J.answerReadings(picks, { confirm: [UNIT], decline: [CARRIED] })
    expect(sent.map((s) => [s.what, s.args[2]])).toEqual([['approve', { only: ['current_funding_ask', 'runway'], only_top: [], only_readings: [UNIT], refuse_readings: [CARRIED] }]])
  })
  it('set aside with the carried reading declined: the discard names exactly that refusal', async () => {
    await J.setAside({ decline: [CARRIED] })
    expect(sent.map((s) => [s.what, s.args[1]])).toEqual([['discard', [CARRIED]]])
  })
  it('control: set aside with nothing declined refuses nothing (never a silent refusal); core says what is unsettled', async () => {
    await J.setAside()
    expect(sent.map((s) => [s.what, s.args[1]])).toEqual([['discard', []]])
  })
  it('control: Unsure is not a refusal: an approval with a reading left unsure sends no refuse_readings', async () => {
    await J.answerReadings(J.picksOf(changes, J.tickEvery(changes)), { confirm: [UNIT], decline: [] })
    expect(JSON.stringify(sent[0]!.args[2])).not.toContain('refuse_readings')
  })
  it('an id that is not served on this proposal is refused before anything is sent (never built or guessed)', async () => {
    await expect(J.answerReadings(J.picksOf(changes, J.tickEvery(changes)), { confirm: [], decline: ['current_funding_ask'] })).rejects.toEqual(new J.JourneyRefusal('not_served'))
    await expect(J.setAside({ decline: ['current_funding_ask'] })).rejects.toEqual(new J.JourneyRefusal('not_served'))
    expect(sent).toEqual([])
  })
})
