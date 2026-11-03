/**
 * A team write whose answer is lost may or may not have been saved (Codex review 00006, root cause A): it is settled by core's answer
 * to the same request, never guessed from a read (`team/writes.ts`).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { TeamApiError, setTeamFetch, teamApi } from '../team/api'
import { MAY_HAVE_SAVED, NOT_CONFIRMED, resetWrites, runWrite, useWrites } from '../team/writes'

beforeEach(resetWrites)
afterEach(() => { setTeamFetch(null); resetWrites() })

describe('A. an uncertain write is settled by core\'s answer to the same request, never guessed from a read', () => {
  const lost = () => new TeamApiError(0, 'dropped', true)
  const kinds = [
    { name: 'a view', op: false }, { name: 'a skip', op: false }, { name: 'a reveal', op: false }, { name: 'a commitment', op: false },
    { name: 'evidence', op: true }, { name: 'an outcome', op: true },
  ]
  for (const k of kinds) {
    it(`${k.name}: ${k.op ? 'resent once with the SAME op and the same content, the answer is core\'s' : 'locked in the store after a lost answer and never sent again, whatever is read afterwards'}`, async () => {
      const seen: Array<string | null> = []
      let n = 0
      const send = async (op: string | null) => { seen.push(op); n += 1; if (k.op ? n === 1 : true) throw lost(); return { saved: n } }
      if (k.op) {
        await expect(runWrite(`s:${k.name}`, { op: true }, { text: 'a' }, send)).resolves.toEqual({ saved: 2 })
        expect(seen).toHaveLength(2)
        expect(seen[0]).toMatch(/^[A-Za-z0-9-]{8,64}$/)
        expect(seen[1]).toBe(seen[0])
        expect(useWrites.getState().attempts[`s:${k.name}`]).toBeUndefined()
      } else {
        await expect(runWrite(`s:${k.name}`, { op: false }, null, send)).rejects.toMatchObject({ uncertain: true })
        // a later read that shows nothing proves nothing: the lock holds, in the store, and nothing more is sent
        await expect(runWrite(`s:${k.name}`, { op: false }, null, send)).rejects.toMatchObject({ message: MAY_HAVE_SAVED })
        expect(seen).toEqual([null])
        expect(useWrites.getState().locked[`s:${k.name}`]).toBe(true)
      }
    })
  }
  it('a resend that is lost too is "not confirmed", keeps its op for the next press, and a different request gets a different op', async () => {
    const ops: string[] = []
    const send = async (op: string | null) => { ops.push(op!); throw lost() }
    await expect(runWrite('s:e', { op: true }, { text: 'a' }, send)).rejects.toMatchObject({ message: NOT_CONFIRMED })
    await expect(runWrite('s:e', { op: true }, { text: 'a' }, send)).rejects.toMatchObject({ message: NOT_CONFIRMED })
    await expect(runWrite('s:e', { op: true }, { text: 'b' }, send)).rejects.toMatchObject({ message: NOT_CONFIRMED })
    expect(new Set(ops.slice(0, 4)).size).toBe(1)   // the same content keeps its op through every press
    expect(ops[4]).not.toBe(ops[0])                  // other content is another request
    expect(ops[5]).toBe(ops[4])
  })
  it('a definite refusal is not an uncertain write: nothing is locked and the op is dropped', async () => {
    await expect(runWrite('s:v', { op: false }, null, async () => { throw new TeamApiError(400, 'write your view first') })).rejects.toMatchObject({ status: 400 })
    expect(useWrites.getState().locked['s:v']).toBeUndefined()
  })
  it('the API wiring: a write that carries an op sends it, and the ones core has no op for send none', async () => {
    const bodies: unknown[] = []
    setTeamFetch((async (_u: unknown, init?: RequestInit) => { bodies.push(init?.body ? JSON.parse(String(init.body)) : null); return { ok: true, status: 201, json: async () => ({}) } as Response }) as typeof fetch)
    await teamApi.giveView('s_1', 'x'); await teamApi.addCommitment('s_1', { action: 'a', owner: '1', expect: 'e', reconsider: 'r', keeps: [] })
    expect(bodies.every((b) => !('op' in (b as object)))).toBe(true)
  })
})
