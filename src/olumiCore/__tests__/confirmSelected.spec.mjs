import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { startFakeCore } from './fakeCore.mjs'
import * as turnModule from '../../../scripts/olumi-core/lib/turn.mjs'
import { makeCore } from '../../../scripts/olumi-core/lib/core.mjs'
import { derivedUuidOfSid } from '../../../scripts/olumi-core/lib/ids.mjs'
import { parseCoreTurn } from '../../v5/coreTurnContract'

// "Confirm selected": the ticked rows of the reading card go to core as `only` (API v1.4), and core decides what a selection needs.
const here = path.dirname(fileURLToPath(import.meta.url))
const fx = (n) => JSON.parse(fs.readFileSync(path.join(here, 'fixtures', n), 'utf8'))
const ADA = { token: 'tok-ada', aliases: [] }
const turnId = () => crypto.randomUUID()
const approves = (calls, since) => calls.slice(since).filter((c) => c.method === 'POST' && c.path.endsWith('/approve'))

let fake, shim
beforeAll(async () => { fake = await startFakeCore(); fake.addPerson('tok-ada', '1', 'Ada'); shim = turnModule.makeShim({ core: makeCore({ base: fake.url }) }) })
afterAll(async () => { await fake.close() })

const held = (after = { approve: fx('view-approved.json') }) => { const sid = fake.seed('tok-ada', fx('view-first-pending.json'), after); return { sid, uuid: derivedUuidOfSid(sid) } }
const cardOf = async (uuid) => (await shim.graphRead(ADA, uuid)).body.proposal_fields.proposals[0]
const press = (uuid, card, extra = {}) => shim.turn(ADA, { kind: 'message', turn_id: turnId(), scenario_id: uuid, stage: 'frame', message: 'Looks right.', source: 'chip_click', chip: { id: card.approve_action.id }, ...extra })

describe('Confirm selected sends the ticked rows to core as `only`', () => {
  it('the card has rows to tick, and they are the proposal\'s own record ids', async () => {
    const { uuid, sid } = held()
    const card = await cardOf(uuid)
    const pending = fake.scenarios.get(sid).view.pending.changes
    expect(card.changes.length).toBeGreaterThan(2)
    expect(card.changes.map((r) => r.id).sort()).toEqual([...pending.added, ...pending.changed, ...pending.removed].sort())
  })
  it('exactly the ticked rows are sent, once each and in a fixed order, with the proposal\'s base', async () => {
    const { uuid, sid } = held()
    const card = await cardOf(uuid), before = fake.calls.length
    const base = fake.scenarios.get(sid).view.pending.base
    const out = (await press(uuid, card, { approve_ids: ['capacity_goal', 'add_one', 'add_one'] })).out
    const sent = approves(fake.calls, before)
    expect(sent).toHaveLength(1)
    expect(sent[0].body).toEqual({ base, only: ['add_one', 'capacity_goal'] })
    expect(out.error).toBeNull()
    expect(out.assistant_text).not.toMatch(/not available yet|5 November/)
  })
  it('the turn then names the Run it saved, as a whole-card approval does', async () => {
    const { uuid } = held()
    const body = parseCoreTurn((await press(uuid, await cardOf(uuid), { approve_ids: ['add_one'] })).out)
    expect(body.error).toBeNull()
    expect(body.run.run_id).toMatch(/^mp_run_\d+_[0-9a-f]{12}$/)
    expect(body.receipts).toHaveLength(1)
  })
  it('core re-runs a part-approved model with no reply from Olumi: the plain saved line, and no note', async () => {
    const v = fx('view-approved.json'); v.chat[0].answer = null; v.version.coach = null
    const { uuid } = held({ approve: v })
    const { out } = await press(uuid, await cardOf(uuid), { approve_ids: ['add_one'] })
    expect(out.notes).toEqual([])
    expect(out.assistant_text).toMatch(/^Saved as version \d+\.$/)
  })
  it('every row ticked is the whole card: no `only` is sent', async () => {
    const { uuid } = held()
    const card = await cardOf(uuid), before = fake.calls.length
    await press(uuid, card, { approve_ids: card.changes.map((r) => r.id) })
    expect(approves(fake.calls, before)[0].body).not.toHaveProperty('only')
  })
  it('an empty tick list is the whole card too (Confirm whole card sends none at all)', async () => {
    const { uuid } = held()
    const card = await cardOf(uuid), before = fake.calls.length
    await press(uuid, card, { approve_ids: [] })
    expect(approves(fake.calls, before)[0].body).not.toHaveProperty('only')
  })
})

describe('core refuses a selection that needs what was not chosen', () => {
  const NEEDS = 'choosing ‘Add one specialist’ needs ‘one specialist’, which you have not chosen'
  it('core\'s 409 is shown in core\'s own words, the card is still held, and nothing was saved', async () => {
    const { uuid, sid } = held()
    const card = await cardOf(uuid)
    fake.refuseApprove(409, NEEDS)
    const { out } = await press(uuid, card, { approve_ids: ['add_one'] })
    expect(out.error).toBeNull()
    expect(out.assistant_text).toBe('Choosing ‘Add one specialist’ needs ‘one specialist’, which you have not chosen')
    expect(out.assistant_text).not.toMatch(/due on|not available yet/)
    expect(out.cards).toHaveLength(1)
    expect(out.cards[0].proposal_id).toBe(card.proposal_id)
    expect(fake.scenarios.get(sid).view.pending).not.toBeNull()
    expect(fake.scenarios.get(sid).view.version).toBeNull()
  })
  it('the person can then change the ticks and confirm: the same card is answered', async () => {
    const { uuid } = held()
    const card = await cardOf(uuid)
    fake.refuseApprove(409, NEEDS)
    await press(uuid, card, { approve_ids: ['add_one'] })
    const { out } = await press(uuid, card, { approve_ids: ['add_one', 'one_specialist'] })
    expect(out.error).toBeNull()
    expect(out.cards).toHaveLength(0)
    expect(out.run.run_id).toBeTruthy()
  })
  it('a 409 for a card that is no longer waiting is still the stale-card refusal, not a held card', async () => {
    const { uuid } = held()
    const card = await cardOf(uuid)
    await press(uuid, card, { approve_ids: ['add_one'] })
    const { out } = await press(uuid, card, { approve_ids: ['add_one'] })
    expect(out.error).toMatchObject({ code: 'revision_conflict', nothing_saved: true })
    expect(out.error.message).toMatch(/no longer waiting/)
  })
  it('an id that is not in the change is core\'s 400, said as it says it, and nothing is saved', async () => {
    const { uuid, sid } = held()
    const { out } = await press(uuid, await cardOf(uuid), { approve_ids: ['not_a_record'] })
    expect(out.error).toMatchObject({ code: 'bad_request', nothing_saved: true })
    expect(out.error.message).toMatch(/only names nothing in this change/)
    expect(fake.scenarios.get(sid).view.pending).not.toBeNull()
  })
})

describe('the stale "due on 5 November" refusal is gone', () => {
  it('the shim no longer carries it, and does not export it', () => {
    expect(turnModule.PARTIAL_REFUSAL).toBeUndefined()
    expect(fs.readFileSync(path.join(here, '../../../scripts/olumi-core/lib/turn.mjs'), 'utf8')).not.toMatch(/5 November|not available yet/)
  })
})
