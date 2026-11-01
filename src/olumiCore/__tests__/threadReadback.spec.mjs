import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { startFakeCore } from './fakeCore.mjs'
import { makeCore } from '../../../scripts/olumi-core/lib/core.mjs'
import { makeShim, coachText } from '../../../scripts/olumi-core/lib/turn.mjs'
import { derivedUuidOfSid } from '../../../scripts/olumi-core/lib/ids.mjs'

// A past reply keeps the figures it was written with. Fact ids are per Run: a later change that adds or drops an option or a
// limit renumbers them, so a reply's [F#] markers can only be filled from that reply's own `cited` map (captured real views).
const here = path.dirname(fileURLToPath(import.meta.url))
const fx = (n) => JSON.parse(fs.readFileSync(path.join(here, 'fixtures', n), 'utf8'))
const ADA = { token: 'tok-ada', aliases: [] }
const turnId = () => crypto.randomUUID()
const approveChip = (card) => ({ kind: 'message', turn_id: turnId(), scenario_id: null, stage: 'frame', message: 'Looks right.', source: 'chip_click', chip: { id: card.approve_action.id } })

let fake, shim
beforeAll(async () => { fake = await startFakeCore(); fake.addPerson('tok-ada', '1', 'Ada'); shim = makeShim({ core: makeCore({ base: fake.url }) }) })
afterAll(async () => { await fake.close() })

/** The first draft as it stood before approval: v1's model held as a proposal, its reply already written on the row. */
function firstDraftHeld() {
  const v = fx('view-markers-v1.json')
  const { version } = v
  v.pending = { id: v.chat[0].proposal, base: null, source: 'draft', changes: { added: version.form.records.map((r) => r.id), changed: [], removed: [], top: [] }, form: version.form, timings: version.timings, facts: version.facts, coach: version.coach, findings: [], blocked: null, stopped: null }
  v.version = null
  v.chat = [{ ...v.chat[0], status: 'pending', version: null, current: false }]
  return v
}

describe('a past coach reply, read back after the model moved on (finding 1)', () => {
  const v1 = fx('view-markers-v1.json'), v2 = fx('view-markers-v2.json')
  const markerText = v1.chat[0].cited.F5

  it('the capture is what the finding says: the same reply, F5 a "most likely" sentence at v1 and a chance (about 89%) at v2', () => {
    expect(v1.chat[0].answer.answer).toBe('In this model about 50% for adding a specialist. Also: [F5].')
    expect(v2.chat[0].answer.answer).toBe(v1.chat[0].answer.answer)
    expect(v1.version.facts.find((f) => f.id === 'F5').about.kind).toBe('most_likely')
    expect(v2.version.facts.find((f) => f.id === 'F5').value).toBe('about 89%')
  })

  it('the thread read back after a later approval fills the marker from that reply\'s own cited map, never the current Run\'s F5', async () => {
    const sid = fake.seed('tok-ada', v2)
    const g = await shim.graphRead(ADA, derivedUuidOfSid(sid))
    const first = g.body.conversation_turns[0].assistant_message
    expect(first).toContain('In this model about 50% for adding a specialist.')
    expect(first).toContain(markerText)
    expect(first).not.toMatch(/89%/)
    expect(first).not.toMatch(/Also: \./)
  })

  it('the reply said live when the model was approved is word for word the reply the thread shows after a reload', async () => {
    const held = firstDraftHeld()
    const sid = fake.seed('tok-ada', held, { approve: v1 })
    const uuid = derivedUuidOfSid(sid)
    const live = (await shim.turn(ADA, { ...approveChip({ approve_action: { id: `agent-approve-proposal:${(await shim.graphRead(ADA, uuid)).body.proposal_fields.proposals[0].proposal_id}` } }), scenario_id: uuid })).out
    expect(live.error).toBeNull()
    expect(live.assistant_text).toContain(markerText)
    // later, a change adds an option and the Run is renumbered
    fake.seed('tok-ada', v2)
    const after = (await shim.graphRead(ADA, uuid)).body.conversation_turns[0].assistant_message
    // Core records who saved the CURRENT version only, so once a later version exists the old receipt says it was saved and not by whom; the reply itself is word for word.
    expect(after).toBe(live.assistant_text.replace(/ Approved by [^.\n]+\./, ''))
    expect(after).toMatch(/^Version 1 saved\.\n/)
  })

  it('a reply on a row whose model is not saved yet still reads whole (nothing falls back to an empty marker)', async () => {
    const v = firstDraftHeld()
    v.chat.push({ ...v1.chat[0], id: 99, proposal: null, version: null, current: false, kind: 'message', status: 'discussion', first: false, said: 'What matters most?' })
    const sid = fake.seed('tok-ada', v)
    const turns = (await shim.graphRead(ADA, derivedUuidOfSid(sid))).body.conversation_turns
    expect(turns[1].assistant_message).toContain(markerText)
    expect(turns[1].assistant_message).not.toMatch(/Also: \./)
  })
})

describe('coachText', () => {
  const coach = { answer: 'About {x}. See [F2].', why: ['Because [F9].'], next: { move: 'pre_mortem', about: [], text: 'Ask about [F2]' } }
  it('fills every marker, in the answer, the reasons and the next move, from the cited map it is given', () => {
    const text = coachText({ ...coach, answer: 'About 50%. See [F2].' }, { F2: 'the best option', F9: 'the driver' })
    expect(text).toBe('About 50%. See the best option.\nBecause the driver.\nNext (pre mortem): Ask about the best option')
  })
  it('does not double the full stop when the cited sentence already ends in one', () => {
    expect(coachText({ ...coach, why: [], answer: 'See [F2].' }, { F2: 'It leaves out: X.' }).split('\n')[0]).toBe('See It leaves out: X.')
  })
  it('a marker core did not explain is said in core\'s own fallback words, never as nothing', () => {
    const text = coachText({ ...coach, why: [], answer: 'See [F7].' }, {})
    expect(text).not.toMatch(/See \./)
    expect(text).toMatch(/See a finding from the Run\./)
  })
})
