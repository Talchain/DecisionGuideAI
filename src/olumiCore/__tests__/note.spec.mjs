import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { startFakeCore } from './fakeCore.mjs'
import { makeCore } from '../../../scripts/olumi-core/lib/core.mjs'
import { makeShim } from '../../../scripts/olumi-core/lib/turn.mjs'
import { noteOf, fillCited, UNEXPLAINED } from '../../../scripts/olumi-core/lib/note.mjs'
import { derivedUuidOfSid } from '../../../scripts/olumi-core/lib/ids.mjs'
import { parseCoreTurn } from '../../v5/coreTurnContract'

// Olumi's next step points at a card: the turn's `notes` are core's `coach.next` (its words, the card its `about` names) and nothing else.
const here = path.dirname(fileURLToPath(import.meta.url))
const fx = (n) => JSON.parse(fs.readFileSync(path.join(here, 'fixtures', n), 'utf8'))
const ADA = { token: 'tok-ada', aliases: [] }
const turnId = () => crypto.randomUUID()
const NEXT = 'Imagine it is three months on and the hire did not lift capacity enough. What went wrong?'

let fake, shim
beforeAll(async () => { fake = await startFakeCore(); fake.addPerson('tok-ada', '1', 'Ada'); shim = makeShim({ core: makeCore({ base: fake.url }) }) })
afterAll(async () => { await fake.close() })

const cards = [
  { id: 'per_specialist', kind: 'factor' }, { id: 'add_one', kind: 'option' }, { id: 'capacity_goal', kind: 'goal' },
  { id: 'new_hire_slump', kind: 'risk' }, { id: 'total_capacity', kind: 'outcome' }, { id: 'mp:decision', kind: 'decision' },
]
const coach = (over = {}) => ({ answer: 'An answer.', why: ['A reason.'], next: { move: 'pre_mortem', about: ['per_specialist'], text: NEXT }, words: 5, problems: [], ...over })
const next = (over) => coach({ next: { move: 'pre_mortem', about: ['per_specialist'], text: NEXT, ...over } })

describe('noteOf: core\'s next step, as a note beside the card it is about', () => {
  it('is core\'s text and the card its `about` names, and nothing else', () => {
    expect(noteOf(coach(), {}, cards)).toEqual({ element_id: 'per_specialist', text: NEXT })
  })
  it.each([['factor', 'per_specialist'], ['option', 'add_one'], ['goal', 'capacity_goal'], ['risk', 'new_hire_slump'], ['outcome', 'total_capacity']])(
    'can point at a %s card', (_, id) => { expect(noteOf(next({ about: [id] }), {}, cards)?.element_id).toBe(id) })
  it('takes the first record in `about` that has a card, passing over one that has none (an assumption, a claim, dissent, evidence)', () => {
    expect(noteOf(next({ about: ['an_assumption', 'a_claim', 'add_one', 'per_specialist'] }), {}, cards)?.element_id).toBe('add_one')
  })
  it('points nowhere when no record it names has a card, and the question card is not one', () => {
    expect(noteOf(next({ about: ['an_assumption', 'lead_doubt'] }), {}, cards)).toBeNull()
    expect(noteOf(next({ about: ['mp:decision'] }), {}, cards)).toBeNull()
    expect(noteOf(next({ about: [] }), {}, cards)).toBeNull()
  })
  it('does not point when core flagged problems with the reply, or says nothing about them, or has no text to say', () => {
    expect(noteOf(coach({ problems: ['it cited a figure it does not hold'] }), {}, cards)).toBeNull()
    expect(noteOf(coach({ problems: undefined }), {}, cards)).toBeNull()
    expect(noteOf(next({ text: '   ' }), {}, cards)).toBeNull()
    expect(noteOf(null, {}, cards)).toBeNull()
  })
  it('writes a cited finding in from the reply\'s own map, exactly as the thread does, and names an unexplained one as such', () => {
    const cited = { F5: 'The option most likely to meet the aim (about 50%).' }
    expect(noteOf(next({ text: 'Look again at [F5]' }), cited, cards).text).toBe('Look again at The option most likely to meet the aim (about 50%).')
    expect(fillCited('See [F9].', {})).toBe(`See ${UNEXPLAINED}.`)
  })
  it('never aims at a card the page does not hold yet', () => {
    expect(noteOf(next({ about: ['add_one', 'per_specialist'] }), {}, cards, new Set(['per_specialist']))?.element_id).toBe('per_specialist')
    expect(noteOf(next({ about: ['add_one'] }), {}, cards, new Set(['per_specialist']))).toBeNull()
  })
})

// Olumi's next step is the chat's `Next (...)` line AND a note beside the card it is about. The thread keeps its line, so it reads the same live
// and after a reload; the note is derived from the same stored reply on a reload (`olumi_note`), so it is there live and after one.
describe('the turns that carry a coach reply carry its next step as a note beside its card, and the thread keeps the line', () => {
  const seeded = (view, after) => derivedUuidOfSid(fake.seed('tok-ada', view, after))
  const card = async (uuid) => (await shim.graphRead(ADA, uuid)).body.proposal_fields.proposals[0]
  const approveTurn = (uuid, c) => shim.turn(ADA, { kind: 'message', turn_id: turnId(), scenario_id: uuid, stage: 'frame', message: 'Looks right.', source: 'chip_click', chip: { id: c.approve_action.id } })
  const approvedWith = (replaceCoach) => { const v = fx('view-approved.json'); replaceCoach(v.chat[0].answer); replaceCoach(v.version.coach); return v }

  it('R5: a real shim reply naming a card in `coach.next.about` produces the note (an approved model)', async () => {
    const uuid = seeded(fx('view-first-pending.json'), { approve: fx('view-approved.json') })
    const { out } = await approveTurn(uuid, await card(uuid))
    const body = parseCoreTurn(out)
    expect(body.error).toBeNull()
    expect(body.notes).toEqual([{ element_id: 'per_specialist', text: NEXT }])
    expect(out.assistant_text.split(NEXT)).toHaveLength(2)   // the chat line
    expect(out.model.graph.nodes.find((n) => n.id === 'per_specialist')).toMatchObject({ kind: 'factor' })
    // The thread is the same live and after a reload, so it keeps its own `Next (...)` line.
    const said = fx('view-approved.json').chat[0].answer
    expect(out.assistant_text).toBe(`Version 1 saved. Approved by Ada.\n${said.answer}\n${said.why[0]}\nNext (pre mortem): ${NEXT}`)
  })
  it('a next step about a record with no card has no note (it is in the chat in full)', async () => {
    const v = approvedWith((a) => { a.next.about = ['lead_doubt'] })
    const uuid = seeded(fx('view-first-pending.json'), { approve: v })
    const { out } = await approveTurn(uuid, await card(uuid))
    expect(out.notes).toEqual([])
    expect(out.assistant_text).toMatch(/Next \(pre mortem\): Imagine it is three months on/)
  })
  it('a reply core flagged with problems points nowhere', async () => {
    const v = approvedWith((a) => { a.problems = ['it cited a figure it does not hold'] })
    const uuid = seeded(fx('view-first-pending.json'), { approve: v })
    const { out } = await approveTurn(uuid, await card(uuid))
    expect(out.notes).toEqual([])
    expect(out.assistant_text).toContain(NEXT)
  })
  it('a card that exists only in the model just approved is still named (the page holds the turn\'s model before it points; if it cannot, the chat has the step in full)', async () => {
    const v = approvedWith((a) => { a.next.about = ['slump_chance', 'new_hire_slump'] })
    v.version.form.records.push({ ...fx('view-rich-approved.json').version.form.records.find((r) => r.id === 'new_hire_slump') })
    const uuid = seeded(fx('view-first-pending.json'), { approve: v })
    const { out } = await approveTurn(uuid, await card(uuid))
    expect(out.model.graph.nodes.some((n) => n.id === 'new_hire_slump')).toBe(true)
    expect(out.notes).toEqual([{ element_id: 'new_hire_slump', text: NEXT }])
    expect(out.assistant_text).toContain(NEXT)
  })
  it('a figure the person changed: the reply core wrote for that edit is in the chat, and its next step is a note on the card it names', async () => {
    const edited = fx('view-approved.json')
    edited.version = { ...edited.version, id: edited.version.id + 100, n: edited.version.n + 1 }
    edited.chat.push({ id: 90, at: edited.version.at, by: 'Ada', said: '', first: false, kind: 'edit', proposal: null, version: edited.version.n, current: true, status: 'approved', problem: null, cited: {},
      answer: coach({ answer: 'Capacity moves.', why: [], next: { move: 'what_would_change_your_mind', about: ['existing_capacity'], text: 'What would make you change this figure back?' } }) })
    const uuid = seeded(fx('view-approved.json'), { edit: edited })
    const { out } = await shim.turn(ADA, { kind: 'system_event', turn_id: turnId(), scenario_id: uuid, stage: 'frame', event: { kind: 'factor_value_edit', target_id: 'existing_capacity', value: 90, raw_value: 90 } })
    expect(out.error).toBeNull()
    expect(out.notes).toEqual([{ element_id: 'existing_capacity', text: 'What would make you change this figure back?' }])
    expect(out.assistant_text).toMatch(/^Version 2 saved\. Changed by Ada\.\nCapacity moves\.\nNext \(what would change your mind\): What would make you change this figure back\?$/)
  })
  it('a discussion reply says its next step in the chat and as a note; a change proposed to the person (a card to confirm) has none', async () => {
    const uuid = seeded(fx('view-approved.json'))
    const asked = (await shim.turn(ADA, { kind: 'message', turn_id: turnId(), scenario_id: uuid, stage: 'frame', message: 'Why does it turn on that?', source: 'composer' })).out
    expect(asked.notes).toEqual([{ element_id: 'per_specialist', text: NEXT }])
    expect(asked.assistant_text).toBe(`A reply that changes nothing.\nIt turns on what a new specialist really adds.\nNext (pre mortem): ${NEXT}`)
    const changed = (await shim.turn(ADA, { kind: 'message', turn_id: turnId(), scenario_id: seeded(fx('view-approved.json')), stage: 'frame', message: 'Add an absence risk.', source: 'composer' })).out
    expect(changed.cards).toHaveLength(1)
    expect(changed.notes).toEqual([])
  })
  it('R5: a reload carries the same note, derived from the same stored reply: live and reload match, and the thread keeps its line', async () => {
    const uuid = seeded(fx('view-first-pending.json'), { approve: fx('view-approved.json') })
    const live = (await approveTurn(uuid, await card(uuid))).out
    const g = (await shim.graphRead(ADA, uuid)).body
    expect(g.conversation_turns.at(-1).assistant_message).toContain(`Next (pre mortem): ${NEXT}`)
    expect(g.olumi_note).toEqual({ ...live.notes[0], turn_id: expect.stringMatching(/^[0-9a-f-]{36}$/) })
    expect(g.conversation_turns.at(-1).turn_id).toBe(g.olumi_note.turn_id)
  })
  it('a reload has a note only for a reply whose next step names a card the model draws, and none when core flagged problems with it', async () => {
    const none = approvedWith((a) => { a.next.about = ['lead_doubt'] })
    expect((await shim.graphRead(ADA, seeded(none))).body).not.toHaveProperty('olumi_note')
    const flagged = approvedWith((a) => { a.problems = ['it cited a figure it does not hold'] })
    expect((await shim.graphRead(ADA, seeded(flagged))).body).not.toHaveProperty('olumi_note')
  })
  it('a reload\'s note is from the LAST reply, and a change still waiting for an answer (its row has no coach reply of its own) is not it', async () => {
    const v = fx('view-approved-with-change.json')
    const g = (await shim.graphRead(ADA, seeded(v))).body
    expect(g.olumi_note?.element_id).toBe('per_specialist')
    expect(g.olumi_note.turn_id).toBe(g.conversation_turns[0].turn_id)   // the approved row's, not the pending row after it
  })
})
