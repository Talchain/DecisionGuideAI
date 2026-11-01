import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { startFakeCore } from './fakeCore.mjs'
import { makeCore } from '../../../scripts/olumi-core/lib/core.mjs'
import { makeShim } from '../../../scripts/olumi-core/lib/turn.mjs'
import { derivedUuidOfSid } from '../../../scripts/olumi-core/lib/ids.mjs'

// A figure typed on the canvas goes to core's /edit. Two things must not be lost on the way: the person's RANGE (core's edit takes
// a point or a low/high, never a likeliest value, so a typed figure over a range would silently erase the range), and the
// truth about a write that core KEPT when only the read that followed it failed.
const here = path.dirname(fileURLToPath(import.meta.url))
const fx = (n) => JSON.parse(fs.readFileSync(path.join(here, 'fixtures', n), 'utf8'))
const ADA = { token: 'tok-ada', aliases: [] }
const turnId = () => crypto.randomUUID()
const edit = (uuid, target, value, extra = {}) => ({ kind: 'system_event', turn_id: turnId(), scenario_id: uuid, stage: 'frame', event: { kind: 'factor_value_edit', target_id: target, value, raw_value: value, ...extra } })
const post = (calls, since) => calls.slice(since).filter((c) => c.method === 'POST')

let fake, shim
beforeAll(async () => { fake = await startFakeCore(); fake.addPerson('tok-ada', '1', 'Ada'); shim = makeShim({ core: makeCore({ base: fake.url }) }) })
afterAll(async () => { await fake.close() })
const seeded = (view = fx('view-approved.json'), after) => { const sid = fake.seed('tok-ada', view, after); return derivedUuidOfSid(sid) }

describe('a typed figure never silently replaces a range (finding 8)', () => {
  it('the figure the capture holds is a range: 10 to 30, most likely 20', () => {
    const a = fx('view-approved.json').version.form.records.find((r) => r.id === 'per_specialist').assertion
    expect(a).toMatchObject({ kind: 'interval', low: 10, high: 30, likely: 20 })
  })
  it('a figure typed over a range is refused in words that name the range, before anything is sent to core', async () => {
    const uuid = seeded()
    const before = fake.calls.length
    const out = (await shim.turn(ADA, edit(uuid, 'per_specialist', 25))).out
    expect(out.error).toMatchObject({ code: 'bad_request', nothing_saved: true })
    expect(out.error.message).toMatch(/between 10 and 30/)
    expect(out.error.message).toMatch(/most likely 20/)
    expect(out.error.message).toMatch(/Tell me the new range in the chat/)
    expect(post(fake.calls, before)).toHaveLength(0)
  })
  it('the range is still on the saved model afterwards (nothing was written)', async () => {
    const uuid = seeded()
    await shim.turn(ADA, edit(uuid, 'per_specialist', 25))
    const g = (await shim.graphRead(ADA, uuid)).body
    expect(g.graph.nodes.find((n) => n.id === 'per_specialist').observed_state.range).toMatchObject({ low: 10, high: 30 })
  })
  it('an aim whose target is a range is refused the same way', async () => {
    const view = fx('view-approved.json')
    const target = view.version.form.records.find((r) => r.id === 'capacity_target')
    target.assertion = { kind: 'interval', low: 95, high: 105, range_kind: 'plausible', likely: null }
    const uuid = seeded(view)
    const ev = { kind: 'system_event', turn_id: turnId(), scenario_id: uuid, stage: 'frame', event: { kind: 'goal_target_edit', goal_node_id: 'capacity_goal', constraint_type: 'at_least', raw_value: 120, unit: 'ticket/week' } }
    const before = fake.calls.length
    const out = (await shim.turn(ADA, ev)).out
    expect(out.error).toMatchObject({ code: 'bad_request', nothing_saved: true })
    expect(out.error.message).toMatch(/between 95 and 105/)
    expect(post(fake.calls, before)).toHaveLength(0)
  })
  it('a plain figure (a point) is still edited as before', async () => {
    const uuid = seeded()
    const before = fake.calls.length
    const out = (await shim.turn(ADA, edit(uuid, 'existing_capacity', 90))).out
    expect(out.error).toBeNull()
    expect(post(fake.calls, before).find((c) => c.path.endsWith('/edit')).body).toMatchObject({ quantity: 'existing_capacity', value: { kind: 'point', value: 90 } })
  })
})

describe('a limit\'s figure is edited as the figure it is bounded by (finding 3)', () => {
  it('typing a new figure on the limit card edits the bound, and the limit keeps its name', async () => {
    const uuid = seeded(fx('view-rich-approved.json'))
    const before = fake.calls.length
    const out = (await shim.turn(ADA, edit(uuid, 'ceiling', 130))).out
    expect(out.error).toBeNull()
    expect(post(fake.calls, before).find((c) => c.path.endsWith('/edit')).body).toMatchObject({ quantity: 'cap', value: { kind: 'point', value: 130 } })
    expect(out.model.graph.nodes.find((n) => n.id === 'ceiling')).toMatchObject({ label: 'Capacity ceiling', observed_state: { value: 130 } })
  })
  it('a limit with no measure has no figure to change, and says so', async () => {
    const view = fx('view-rich-approved.json')
    view.version.form.records.find((r) => r.id === 'ceiling').measure = null
    const out = (await shim.turn(ADA, edit(seeded(view), 'ceiling', 130))).out
    expect(out.error).toMatchObject({ code: 'bad_request', nothing_saved: true })
  })
})

describe('a write core kept is never reported as lost because the read after it failed (finding 11)', () => {
  const lost = { status: 502, message: 'could not read' }
  it('a saved figure whose follow-up read fails says it was saved (nothing_saved is false), so the screen is not rolled back', async () => {
    const uuid = seeded()
    fake.failReadAfterWrite(lost.status, lost.message)
    const before = fake.calls.length
    const out = (await shim.turn(ADA, edit(uuid, 'existing_capacity', 90))).out
    expect(post(fake.calls, before).filter((c) => c.path.endsWith('/edit'))).toHaveLength(1)
    expect(out.error).toMatchObject({ code: 'saved_not_shown', nothing_saved: false, retry_safe: false })
    expect(out.error.message).toMatch(/was saved/)
    expect(out.error.message).toMatch(/Reload/)
  })
  it('the same for a card the person approved', async () => {
    const held = fx('view-first-pending.json')
    const sid = fake.seed('tok-ada', held, { approve: fx('view-approved.json') })
    const uuid = derivedUuidOfSid(sid)
    const card = (await shim.graphRead(ADA, uuid)).body.proposal_fields.proposals[0]
    fake.failReadAfterWrite(lost.status, lost.message)
    const out = (await shim.turn(ADA, { kind: 'message', turn_id: turnId(), scenario_id: uuid, stage: 'frame', message: 'Looks right.', source: 'chip_click', chip: { id: card.approve_action.id } })).out
    expect(out.error).toMatchObject({ code: 'saved_not_shown', nothing_saved: false })
    expect(fake.scenarios.get(sid).view.version).not.toBeNull()
  })
  it('and for a proposal set aside', async () => {
    const sid = fake.seed('tok-ada', fx('view-first-pending.json'))
    const uuid = derivedUuidOfSid(sid)
    const card = (await shim.graphRead(ADA, uuid)).body.proposal_fields.proposals[0]
    fake.failReadAfterWrite(lost.status, lost.message)
    const out = (await shim.turn(ADA, { kind: 'message', turn_id: turnId(), scenario_id: uuid, stage: 'frame', message: 'Not now.', source: 'chip_click', chip: { id: card.decline_action.id } })).out
    expect(out.error).toMatchObject({ code: 'saved_not_shown', nothing_saved: false })
  })
  it('a read that fails BEFORE the write is still "nothing saved" (the write never happened)', async () => {
    const uuid = seeded()
    fake.failNext(502, 'could not read')
    const out = (await shim.turn(ADA, edit(uuid, 'existing_capacity', 90))).out
    expect(out.error).toMatchObject({ code: 'olumi_core_error', nothing_saved: true })
  })
})

describe('a write whose answer was lost is not reported as unsaved (finding: a reset after /edit saved 80 to 90 rolled the canvas back to 80)', () => {
  const reset = () => Object.assign(new TypeError('fetch failed'), { cause: Object.assign(new Error('other side closed'), { code: 'UND_ERR_SOCKET' }) })
  const refused = () => Object.assign(new TypeError('fetch failed'), { cause: Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' }) })
  const valueOf = (view, id) => view.version.form.records.find((r) => r.id === id).assertion.value

  it('the connection resets after core kept the figure: the shim reads the scenario, sees the version moved, and answers as the saved figure', async () => {
    const uuid = seeded()
    fake.dropNextAnswer()
    const out = (await shim.turn(ADA, edit(uuid, 'existing_capacity', 90))).out
    expect(out.error).toBeNull()
    expect(out.receipts).toHaveLength(1)
    const g = (await shim.graphRead(ADA, uuid)).body
    expect(g.graph.nodes.find((n) => n.id === 'existing_capacity').observed_state.value).toBe(90)
  })
  it('the connection resets and the read afterwards shows nothing moved: still not "nothing was saved" (it may have landed after the read), so the canvas is not rolled back', async () => {
    const view = fx('view-approved.json')
    const sid = fake.seed('tok-ada', view)
    const uuid = derivedUuidOfSid(sid)
    const lossy = makeShim({ core: makeCore({ base: fake.url, fetchImpl: async (url, init) => { if (init?.method === 'POST' && String(url).endsWith('/edit')) throw reset(); return fetch(url, init) } }) })
    const out = (await lossy.turn(ADA, edit(uuid, 'existing_capacity', 90))).out
    expect(out.error).toMatchObject({ code: 'olumi_unsure', nothing_saved: false, retry_safe: false })
    expect(out.error.message).toMatch(/may or may not have saved/)
    expect(out.error.message).toMatch(/Reload/)
    expect(valueOf(fake.scenarios.get(sid).view, 'existing_capacity')).toBe(80)
  })
  it('a chat message whose answer is lost is the same: core may have kept it', async () => {
    const sid = fake.seed('tok-ada', fx('view-approved.json'))
    const uuid = derivedUuidOfSid(sid)
    fake.dropNextAnswer()
    const out = (await shim.turn(ADA, { kind: 'message', turn_id: turnId(), scenario_id: uuid, stage: 'frame', message: 'Add staff absence.', source: 'composer' })).out
    expect(out.error).toMatchObject({ code: 'olumi_unsure', nothing_saved: false })
  })
  it('a connection that never opened is still "nothing was saved" (nothing was sent), and a read that breaks saved nothing either', async () => {
    const sid = fake.seed('tok-ada', fx('view-approved.json'))
    const uuid = derivedUuidOfSid(sid)
    const noConnect = makeShim({ core: makeCore({ base: fake.url, fetchImpl: async () => { throw refused() } }) })
    expect((await noConnect.turn(ADA, edit(uuid, 'existing_capacity', 90))).out.error).toMatchObject({ code: 'olumi_unreachable', nothing_saved: true, retry_safe: true })
    const readBreaks = makeShim({ core: makeCore({ base: fake.url, fetchImpl: async (url, init) => { if (init?.method === 'GET') throw reset(); return fetch(url, init) } }) })
    expect((await readBreaks.turn(ADA, edit(uuid, 'existing_capacity', 90))).out.error).toMatchObject({ nothing_saved: true })
  })
})
