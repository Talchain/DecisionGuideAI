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
beforeAll(async () => { fake = await startFakeCore(); fake.addPerson('tok-ada', '1', 'Ada'); shim = turnModule.makeShim({ core: makeCore({ base: fake.url }), onlySupported: true }) })
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
  it('core re-runs a part-approved model with no reply from Olumi: the plain saved line, no note, and the proposal\'s own answer is not replayed', async () => {
    // The real core shape: the version has no coach, but the proposal's chat row STILL holds its answer (about the whole proposal).
    const v = fx('view-approved.json'); v.version.coach = null
    const stale = v.chat.find((c) => c.proposal != null)
    expect(stale.answer.answer).toMatch(/adding a specialist reaches your aim about half the time/)
    const { uuid } = held({ approve: v })
    const { out } = await press(uuid, await cardOf(uuid), { approve_ids: ['add_one'] })
    expect(out.notes).toEqual([])
    expect(out.assistant_text).toMatch(/^Version \d+ saved\. Approved by Ada\.$/)
    expect(out.assistant_text).not.toMatch(/half the time|Next \(/)
  })
  it('a whole-card approval still shows core\'s reply on the new version, its next step said once (in the chat, not again as a note)', async () => {
    const { uuid } = held()
    const { out } = await press(uuid, await cardOf(uuid))
    expect(out.assistant_text).toMatch(/adding a specialist reaches your aim about half the time/)
    expect(out.assistant_text).toMatch(/Next \(/)
    // ...and the same next step is also a note beside its card (the thread keeps it too, so it reads the same after a reload)
    expect(out.notes).toEqual([{ element_id: 'per_specialist', text: expect.stringMatching(/three months on/) }])
  })
  it('an id that is not in the change is NOT dropped: every real change ticked plus an unknown one still sends `only` exactly as ticked, and core refuses it', async () => {
    const { uuid, sid } = held()
    const card = await cardOf(uuid), before = fake.calls.length
    const ticks = [...card.changes.map((r) => r.id), 'no_such_record']
    const { out } = await press(uuid, card, { approve_ids: ticks })
    const sent = approves(fake.calls, before)
    expect(sent).toHaveLength(1)
    expect(sent[0].body.only).toEqual([...ticks].sort())
    expect(out.error).toMatchObject({ code: 'bad_request', nothing_saved: true })
    expect(fake.scenarios.get(sid).view.pending).not.toBeNull()   // nothing was approved
  })
  it('a selection that is not a list is refused in words and nothing is sent (never read as the whole card)', async () => {
    const { uuid } = held()
    const card = await cardOf(uuid), before = fake.calls.length
    const { out } = await press(uuid, card, { approve_ids: 'all' })
    expect(out.error).toMatchObject({ code: 'bad_request', nothing_saved: true })
    expect(approves(fake.calls, before)).toHaveLength(0)
  })
  it('every row ticked is the whole card: no `only` is sent', async () => {
    const { uuid } = held()
    const card = await cardOf(uuid), before = fake.calls.length
    await press(uuid, card, { approve_ids: card.changes.map((r) => r.id) })
    expect(approves(fake.calls, before)[0].body).not.toHaveProperty('only')
  })
  it('no `approve_ids` at all is the whole card ("Looks right")', async () => {
    const { uuid } = held()
    const card = await cardOf(uuid), before = fake.calls.length
    await press(uuid, card)
    expect(approves(fake.calls, before)[0].body).not.toHaveProperty('only')
  })
  it('an explicit EMPTY tick list is nothing chosen: refused in words, never read as the whole card, and nothing is sent', async () => {
    const { uuid } = held()
    const card = await cardOf(uuid), before = fake.calls.length
    const { out } = await press(uuid, card, { approve_ids: [] })
    expect(out.error).toMatchObject({ code: 'bad_request', nothing_saved: true })
    expect(out.error.message).toMatch(/Tick at least one change/)
    expect(approves(fake.calls, before)).toHaveLength(0)
  })
})

describe('a selection is compared with the COMPLETE change set, top-level changes included (review: ticking the rows approved an unticked question)', () => {
  const withTop = () => {
    const v = fx('view-first-pending.json')
    v.pending.changes = { added: [], changed: ['existing_capacity'], removed: [], top: ['question'] }
    return v
  }
  const heldTop = () => { const sid = fake.seed('tok-ada', withTop(), { approve: fx('view-approved.json') }); return { sid, uuid: derivedUuidOfSid(sid) } }
  it('only `existing_capacity` ticked: `only` is sent, so the question is not approved', async () => {
    const { uuid } = heldTop()
    const card = await cardOf(uuid), before = fake.calls.length
    expect(card.changes.map((r) => r.id)).toEqual(['existing_capacity'])   // the question has no row to tick
    const { out } = await press(uuid, card, { approve_ids: ['existing_capacity'] })
    const sent = approves(fake.calls, before)
    expect(sent).toHaveLength(1)
    expect(sent[0].body.only).toEqual(['existing_capacity'])
    expect(out.error).toBeNull()
  })
  it('every change ticked, the top-level one too: the whole card, no `only`', async () => {
    const { uuid } = heldTop()
    const card = await cardOf(uuid), before = fake.calls.length
    await press(uuid, card, { approve_ids: ['existing_capacity', 'question'] })
    expect(approves(fake.calls, before)[0].body).not.toHaveProperty('only')
  })
  it('a proposal with no top-level change is still the whole card when every row is ticked', async () => {
    const v = withTop(); v.pending.changes.top = []
    const sid = fake.seed('tok-ada', v, { approve: fx('view-approved.json') })
    const uuid = derivedUuidOfSid(sid), card = await cardOf(uuid), before = fake.calls.length
    await press(uuid, card, { approve_ids: ['existing_capacity'] })
    expect(approves(fake.calls, before)[0].body).not.toHaveProperty('only')
  })
})

describe('a reload shows the same reply the live approval did (review: it restored the whole proposal\'s answer after a part-approval)', () => {
  const HALF = /adding a specialist reaches your aim about half the time/
  const saved = (partial) => { const v = fx('view-approved.json'); if (partial) v.version.coach = null; return v }
  const thread = async (view, parts) => {
    const sid = fake.seed('tok-ada', view)
    if (parts) fake.partVersions(sid, parts)
    return (await shim.graphRead(ADA, derivedUuidOfSid(sid))).body.conversation_turns
  }
  it('the current version core re-ran with no reply: the thread says it was saved, and the proposal\'s answer is not restored', async () => {
    const v = saved(true)
    expect(v.chat[0].answer.answer).toMatch(HALF)   // the row still holds the whole proposal's answer
    const [first] = await thread(v)
    expect(first.assistant_message).toBe('Version 1 saved. Approved by Ada.')
    expect(first.assistant_message).not.toMatch(HALF)
  })
  it('and it is word for word what the live part-approval said', async () => {
    const { uuid } = held({ approve: saved(true) })
    const live = (await press(uuid, await cardOf(uuid), { approve_ids: ['add_one'] })).out
    const after = (await shim.graphRead(ADA, uuid)).body.conversation_turns[0].assistant_message
    expect(after).toBe(live.assistant_text)
  })
  it('a whole approval keeps its reply on reload, as live', async () => {
    const [first] = await thread(saved(false))
    expect(first.assistant_message).toMatch(HALF)
  })
  it('an OLDER version made from part of its proposal does not get the proposal\'s answer back either; one saved whole does', async () => {
    const v2 = fx('view-markers-v2.json')
    expect(v2.chat[0].current).toBe(false)
    expect((await thread(v2))[0].assistant_message).toMatch(/In this model about 50% for adding a specialist/)
    const part = (await thread(v2, { 1: ['add_one'] }))[0].assistant_message
    expect(part).toBe('Version 1 saved.')
  })
  it('a version core cannot tell about (its version list is unreadable) is shown with no reply, never with one that may not be Olumi\'s', async () => {
    const turns = await thread(fx('view-markers-v2.json'), 'down')
    expect(turns[0].assistant_message).toBe('Version 1 saved.')
    expect(turns[1].assistant_message).toMatch(/./)   // the current version still reads its own reply
    expect(turns[1].assistant_message).not.toBe('Version 2 saved.')
  })
})

describe('a DISCUSSION keeps its own answer on reload, whatever version it is about (review: it was replaced by the version\'s coach)', () => {
  const ASKED = 'Why does it turn on that?'
  const reply = (text) => ({ ...fx('view-approved.json').version.coach, answer: text })
  /** A part-approved current version (core re-ran it with no coach), then a person's question and Olumi's answer about it. */
  const afterPartThenQuestion = (answer) => {
    const v = fx('view-approved.json')
    v.version.coach = null
    v.chat.push({ id: 91, at: v.version.at, by: 'Ada', said: ASKED, first: false, kind: 'message', proposal: v.chat[0].proposal, version: 1, current: true, answer, status: 'discussion', problem: null, cited: {} })
    return v
  }
  const thread = async (view, parts) => {
    const sid = fake.seed('tok-ada', view)
    if (parts) fake.partVersions(sid, parts)
    return (await shim.graphRead(ADA, derivedUuidOfSid(sid))).body.conversation_turns
  }
  it('after a partial approval, the approval row says it was saved and the discussion about that version still reads Olumi\'s answer to it', async () => {
    const turns = await thread(afterPartThenQuestion(reply('It turns on what each specialist adds.')), { 1: ['add_one'] })
    expect(turns[0].assistant_message).toBe('Version 1 saved. Approved by Ada.')
    expect(turns[1].user_message).toBe(ASKED)
    expect(turns[1].assistant_message).toMatch(/^It turns on what each specialist adds\./)
    expect(turns[1].assistant_message).not.toMatch(/saved\./)
  })
  it('the same for a discussion about an OLDER version made from part of its proposal, and when the version list cannot be read', async () => {
    const v = afterPartThenQuestion(reply('Older and still mine.'))
    v.chat[1].current = false
    v.version = { ...v.version, id: v.version.id + 100, n: 2 }
    for (const parts of [{ 1: ['add_one'] }, 'down']) {
      const turns = await thread(structuredClone(v), parts)
      expect(turns[1].assistant_message).toMatch(/^Older and still mine\./)
    }
  })
  it('a discussion with no stored answer is "Noted.", never "Saved as version N." (it saved nothing)', async () => {
    const turns = await thread(afterPartThenQuestion(null), { 1: ['add_one'] })
    expect(turns[1].assistant_message).toBe('Noted.')
  })
  it('live, a question after a part-approval is answered by its own row, and the approval\'s `cited` is not borrowed from the discussion', async () => {
    const view = afterPartThenQuestion(reply('A live answer.'))
    view.chat[0].cited = { F1: 'the approved row\'s finding' }
    view.chat[1].cited = { F1: 'the discussion\'s finding' }
    view.version.coach = fx('view-approved.json').version.coach
    view.version.coach = { ...view.version.coach, answer: 'Approved: [F1].' }
    const sid = fake.seed('tok-ada', fx('view-first-pending.json'), { approve: view })
    const uuid = derivedUuidOfSid(sid)
    const live = (await press(uuid, await cardOf(uuid))).out
    expect(live.assistant_text).toContain('the approved row\'s finding')
    expect(live.assistant_text).not.toContain('the discussion\'s finding')
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
    expect(fs.readFileSync(path.join(here, '../../../scripts/olumi-core/lib/turn.mjs'), 'utf8')).not.toMatch(/5 November/)
  })
})

describe('a core without selective approval (served `candidate`): a part-selection is refused, never approved whole', () => {
  it('ticking some rows sends nothing to core and says to confirm all or set aside; the card stays held', async () => {
    const plain = turnModule.makeShim({ core: makeCore({ base: fake.url }), onlySupported: false })
    const { uuid, sid } = held()
    const card = (await plain.graphRead(ADA, uuid)).body.proposal_fields.proposals[0], before = fake.calls.length
    const { out } = await plain.turn(ADA, { kind: 'message', turn_id: turnId(), scenario_id: uuid, stage: 'frame', message: 'Looks right.', source: 'chip_click', chip: { id: card.approve_action.id }, approve_ids: ['add_one'] })
    expect(approves(fake.calls, before)).toHaveLength(0)
    expect(out.error?.message ?? out.assistant_text).toMatch(/only some changes is not available yet.*Nothing was saved/)
    expect(fake.scenarios.get(sid).view.pending).toBeTruthy()
  })
  it('ticking every row is the whole card and is approved', async () => {
    const plain = turnModule.makeShim({ core: makeCore({ base: fake.url }), onlySupported: false })
    const { uuid, sid } = held()
    const card = (await plain.graphRead(ADA, uuid)).body.proposal_fields.proposals[0], before = fake.calls.length
    const p = fake.scenarios.get(sid).view.pending.changes
    const all = [...p.added, ...p.changed, ...p.removed, ...(p.top ?? [])]
    const { out } = await plain.turn(ADA, { kind: 'message', turn_id: turnId(), scenario_id: uuid, stage: 'frame', message: 'Looks right.', source: 'chip_click', chip: { id: card.approve_action.id }, approve_ids: all })
    expect(approves(fake.calls, before)).toHaveLength(1)
    expect(out.error).toBeNull()
  })
})
