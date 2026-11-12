/**
 * PL-640 (Codex's counter PL-1a6-reading-scope-counter.mjs, as a spec): an answer to Olumi's reading never approves what the person did not choose.
 * With NOTHING ticked, Confirm and Unsure send no approval at all (at 1a6b0dfd `allIfNone` turned an empty selection into every change: the goal,
 * an unrelated risk and the coaching questions). With the goal alone ticked, exactly the goal goes, with the reading only when confirmed and never
 * a refusal. The write boundary is mocked; the journey layer is the real one.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
const sent: unknown[][] = []
vi.mock('../client', () => ({ writes: { approve: async (...args: unknown[]) => { sent.push(args); return { ok: true } } } }))
vi.mock('../../olumiCore/team/writes', () => ({ runWrite: async (_k: string, _o: unknown, _b: unknown, fn: (op?: string) => Promise<unknown>) => fn() }))
vi.mock('../store', () => ({ useViewStore: { getState: () => (globalThis as { __S__?: unknown }).__S__ } }))
import { JourneyRefusal, confirmReading, picksOf, unsureOfReading } from '../journey'

const changes = [{ id: 'goal', top: false }, { id: 'unrelated_risk', top: false }, { id: 'coaching_questions', top: true }] as never
;(globalThis as { __S__?: unknown }).__S__ = { sid: 's_mock', at: null, view: { proposal: { id: 29, base: 26, changes } }, modelChanged: async () => true }
afterEach(() => { sent.length = 0 })

describe('PL-640: a reading answer is scoped to what the person chose', () => {
  it('Confirm with nothing ticked sends no approval (never every change)', async () => {
    await expect(confirmReading(picksOf(changes, new Set()), 'goal')).rejects.toEqual(new JourneyRefusal('nothing_ticked'))
    expect(sent).toEqual([])
  })
  it('Unsure with nothing ticked sends no approval (never every change)', async () => {
    await expect(unsureOfReading(picksOf(changes, new Set()))).rejects.toEqual(new JourneyRefusal('nothing_ticked'))
    expect(sent).toEqual([])
  })
  it('control: Confirm with the goal ticked sends the goal and its reading, nothing else', async () => {
    await confirmReading(picksOf(changes, new Set(['rec:goal'])), 'goal')
    expect(sent.map((a) => a[2])).toEqual([{ only: ['goal'], only_top: [], only_readings: ['goal'] }])
  })
  it('control: Unsure with the goal ticked sends the goal without the reading and without a refusal', async () => {
    await unsureOfReading(picksOf(changes, new Set(['rec:goal'])))
    expect(sent.map((a) => a[2])).toEqual([{ only: ['goal'], only_top: [] }])
  })
})
