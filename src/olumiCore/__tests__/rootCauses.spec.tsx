/**
 * One test per root cause of the Codex review 00006 (head 8cf015d), each proving the CLASS through at least two of its findings.
 * A: uncertain writes (1, 4, 5, 6, 7)  B: consent disclosure (2, 3, 12)  C: code-composed claims (9, 10)  E: identity by member id (8).
 * (D, a range edit that deleted the stated point, is proved in olumi-core's service.test.ts and in figureEdit.spec.mjs.)
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { TeamApiError, setTeamFetch, teamApi } from '../team/api'
import { MAY_HAVE_SAVED, NOT_CONFIRMED, resetWrites, runWrite, useWrites } from '../team/writes'
import { memberStates } from '../team/model'
import { ghostAddsOf } from '../../../scripts/olumi-core/lib/model.mjs'
import { changeRows, changeSetOf } from '../../../scripts/olumi-core/lib/words.mjs'
import { readProposalFields } from '../../canvas/conversation/proposalFields'
import { figureText } from '../../canvas/nodes/ProposalGhostLayer'
import { makeShim } from '../../../scripts/olumi-core/lib/turn.mjs'
import { scenario } from './teamFixtures'

const here = path.dirname(fileURLToPath(import.meta.url))
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fx = (n: string): any => JSON.parse(fs.readFileSync(path.join(here, 'fixtures', n), 'utf8'))
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

describe('B. what a person approves is disclosed from the proposal\'s complete change set', () => {
  const withRangeAndDeadline = () => {
    const v = fx('view-approved-with-change.json')
    const f = v.pending.form.records.find((r: { id: string }) => r.id === 'staff_absence')
    f.assertion = { kind: 'interval', low: 1, high: 9, range_kind: 'plausible', likely: null }
    v.pending.form.decide_by = { date: '2026-12-15', origin: { by: 'olumi', basis: 'the audit lands first' } }
    v.pending.changes.top = ['decide_by']
    return v
  }
  it('the ghost shows a range as a range (with no most likely at all), and says the deadline changes: the ghost can no longer approve it unseen', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adds: any[] = ghostAddsOf(withRangeAndDeadline())
    const factor = adds.find((a) => a.kind === 'factor_add')!
    expect(factor.value).toEqual({ low: 1, high: 9, unit: 'ticket/week' })
    expect(figureText(factor.value)).toBe('1 to 9 ticket/week')
    expect(adds.some((a: { field_id: string; text: string }) => a.field_id === 'change_note:top:decide_by' && /Decide by/.test(a.text))).toBe(true)
    // DGAI's own reader keeps both: the range as a range, and the note that makes the ghost send the person to the card
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const card = (makeShim({ core: async () => ({}) }) as any).cardFor(withRangeAndDeadline(), 'turn-1')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adds2 = (readProposalFields({ version: 1, graph_hash: 'a'.repeat(16), proposals: [card] }) as any).proposals[0].adds as any[]
    expect(adds2.find((a) => a.kind === 'factor_add')).toMatchObject({ value: { low: 1, high: 9, unit: 'ticket/week' } })
    expect(adds2.some((a) => a.kind === 'change_note' && /Decide by/.test(a.text))).toBe(true)
  })
  it('a stated most likely is shown with the range; a range of 1 to 9 most likely 5 is never reduced to 5', () => {
    const v = withRangeAndDeadline()
    v.pending.form.records.find((r: { id: string }) => r.id === 'staff_absence').assertion = { kind: 'interval', low: 1, high: 9, range_kind: 'plausible', likely: 5 }
    expect(figureText((ghostAddsOf(v) as any[]).find((a) => a.kind === 'factor_add').value)).toBe('1 to 9 ticket/week, most likely 5 ticket/week')
  })
  it('a first draft, which core gives an EMPTY top, lists the deadline it proposes: the card\'s rows and the change set agree', () => {
    const draft = fx('view-first-pending.json')
    draft.pending.form.decide_by = { date: '2026-12-01', origin: { by: 'person', quote: 'by December', party: null } }
    expect(draft.pending.changes.top).toEqual([])
    expect(changeSetOf(draft).top).toEqual(['decide_by'])
    expect(changeRows(draft).find((r: { id: string }) => r.id === 'top:decide_by')).toMatchObject({ action: 'add', label: 'Decide by', author: 'person' })
  })
  it('every member of the complete set is disclosed by BOTH surfaces: rows for the card, notes for the ghost', () => {
    const v = withRangeAndDeadline()
    v.pending.changes.changed = ['add_one']
    const set = changeSetOf(v)
    const rows = changeRows(v).map((r: { id: string }) => r.id)
    const notes = (ghostAddsOf(v) as any[]).map((a) => a.field_id).join(' ')
    for (const id of [...set.added, ...set.changed, ...set.removed]) { expect(rows, id).toContain(id); expect(notes, id).toContain(id) }
    for (const f of set.top) { expect(rows).toContain(`top:${f}`); expect(notes).toContain(`top:${f}`) }
  })
})

describe('C. code puts labels, values and bands on the screen, never a finding of its own', () => {
  it('the band: no composed sentence, and two ends that differ by a hair are never read as one figure', async () => {
    const { modelBandOf, bandNumber } = await import('../team/model')
    const base = scenario()
    const s = { ...base, version: { ...base.version!, facts: [{ id: 'F', value: '99.96 to 100.04', text: 'Stored finding. It leaves out: X.', about: { kind: 'range', low: 99.96, high: 100.04, unit: null } }] } }
    const [b] = modelBandOf(s)
    expect(b).toMatchObject({ low: 99.96, high: 100.04, words: 'Stored finding.' })
    expect(bandNumber(b!.low!)).toBe(bandNumber(b!.high!))   // they look alike on screen; nothing compares them after rounding
    const panel = fs.readFileSync(path.join(here, '..', 'team', 'CommitmentPanel.tsx'), 'utf8')
    expect(panel).not.toMatch(/runs in 10|land on|land between/)
  })
  it('the shim: the other aims\' chances and the limits\' results are core\'s own sentences, as stored, with their figure', async () => {
    const { analysisViewOf } = await import('../../../scripts/olumi-core/lib/model.mjs')
    const v = fx('view-rich-approved.json')
    const texts = v.version.facts.map((f: { text: string }) => f.text.split(' It leaves out')[0] as string)
    const own = (analysisViewOf(v) as any).goal_chance.notes.filter((n: string) => !/^This leaves out:/.test(n))
    expect(own.length).toBeGreaterThan(0)
    for (const n of own) expect(texts.some((t: string) => n.includes(t)), n).toBe(true)
    const source = fs.readFileSync(path.join(here, '..', '..', '..', 'scripts', 'olumi-core', 'lib', 'model.mjs'), 'utf8')
    expect(source).not.toMatch(/For the aim ‘|Your limit ‘|within it,/)
  })
})

describe('E. a member is told apart by id, never by name', () => {
  it('two Chrises: the first gave a view before the second joined; core waits for both by name, so the first is still to give one', () => {
    const s = scenario({
      you: 'Chris', members: [{ id: '1', name: 'Chris' }, { id: '5', name: 'Chris' }], waiting: ['Chris', 'Chris'],
      views: [{ id: 7, by: 'Chris', mine: true, revealed: false, text: 'before the second joined', skip: false }],
    })
    ;(globalThis as { __OLUMI_CORE__?: unknown }).__OLUMI_CORE__ = { person: { id: '1' } }
    try {
      const mine = memberStates(s).find((m) => m.you)!
      expect(mine.member.id).toBe('1')
      expect(mine.state).toBe('waiting')
      expect(memberStates(s).find((m) => !m.you)!.state).toBe('waiting')
      // and when only one of the two is waiting, my own open view decides me
      expect(memberStates({ ...s, waiting: ['Chris'] }).find((m) => m.you)!.state).toBe('held')
      expect(memberStates({ ...s, waiting: [] }).find((m) => m.you)!.state).toBe('held')
    } finally { (globalThis as { __OLUMI_CORE__?: unknown }).__OLUMI_CORE__ = undefined }
  })
})
