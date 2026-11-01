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
