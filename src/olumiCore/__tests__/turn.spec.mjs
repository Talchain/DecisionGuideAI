import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { startFakeCore } from './fakeCore.mjs'
import { makeCore } from '../../../scripts/olumi-core/lib/core.mjs'
import { makeShim, UNSUPPORTED_EDIT } from '../../../scripts/olumi-core/lib/turn.mjs'
import { sidOfUuid } from '../../../scripts/olumi-core/lib/ids.mjs'
import { parseCoreTurn, coreTurnToClientBody } from '../../v5/coreTurnContract'
import { parseCanonicalAnalysisView } from '../../canvas/runView/canonicalAnalysisView'
import { isUnversionedSaveReceipt } from '../../v5/saveReceipts'

let fake, shim
const U = '11111111-2222-4333-8444-555555555555'
const ADA = { token: 'tok-ada', aliases: [] }
const turnId = () => crypto.randomUUID()
const msg = (message, extra = {}) => ({ kind: 'message', turn_id: turnId(), scenario_id: U, stage: 'frame', message, source: 'composer', ...extra })

beforeAll(async () => { fake = await startFakeCore(); fake.addPerson('tok-ada', '1', 'Ada'); fake.addPerson('tok-bea', '2', 'Bea'); shim = makeShim({ core: makeCore({ base: fake.url }) }) })
afterAll(async () => { await fake.close() })

/** A first model, created and (optionally) approved: returns the ctx the browser would now hold. */
async function started({ approve = false } = {}) {
  const r = await shim.turn({ ...ADA }, msg('a brief'))
  const ctx = { ...ADA, aliases: [r.alias] }
  if (!approve) return { ctx, r }
  const card = r.out.cards[0]
  const a = await shim.turn(ctx, msg('Looks right.', { source: 'chip_click', chip: { id: card.approve_action.id } }))
  return { ctx, r, a }
}

describe('the turn, as DGAI\'s CoreTurn reader takes it', () => {
  it('a first brief creates a scenario in core and returns Olumi\'s model as a held card (the contract parses, the alias rides back)', async () => {
    const { r } = await started()
    const body = parseCoreTurn(r.out)
    expect(body).not.toBeNull()
    expect(body.error).toBeNull()
    expect(body.cards).toHaveLength(1)
    expect(body.cards[0].reading).toBe(true)
    expect(r.alias).toEqual([U, expect.stringMatching(/^s_[0-9a-f]{12}$/)])
    expect(body.model.revision).toMatch(/^[0-9a-f]{16}$/)
    expect(coreTurnToClientBody(body)._proposal_fields.proposals).toHaveLength(1)
  })

  it('confirming the whole card saves it and names the Run, so the Analysis tab adopts it (gap 5)', async () => {
    const { a } = await started({ approve: true })
    const body = parseCoreTurn(a.out)
    expect(body.cards).toHaveLength(0)
    expect(body.run.run_id).toMatch(/^mp_run_\d+_[0-9a-f]{12}$/)
    expect(body.run.computed_against).toBe(body.model.revision)
    expect(isUnversionedSaveReceipt(body.receipts[0])).toBe(true)
    expect(body.receipts[0].run_id).toBe(body.run.run_id)
    expect(coreTurnToClientBody(body)._read_after_write).toEqual({ scenario_revision: body.model.scenario_revision, run_id: body.run.run_id })
    expect(a.out.assistant_text).toMatch(/adding a specialist/)
  })

  it('declining sets the proposal aside and leaves the model as it was', async () => {
    const { ctx, r } = await started()
    const out = (await shim.turn(ctx, msg('Not now.', { source: 'chip_click', chip: { id: r.out.cards[0].decline_action.id } }))).out
    expect(out.error).toBeNull(); expect(out.cards).toHaveLength(0)
    expect(out.assistant_text).toMatch(/left it as it was/)
  })

  it('a stale card press is a visible refusal, never a silent no-op', async () => {
    const { ctx, r } = await started({ approve: true })
    const out = (await shim.turn(ctx, msg('Looks right.', { source: 'chip_click', chip: { id: r.out.cards[0].approve_action.id } }))).out
    expect(out.error).toMatchObject({ code: 'revision_conflict', nothing_saved: true })
    expect(out.error.message).toMatch(/no longer waiting/)
  })
})

describe('canvas writes (gap 1)', () => {
  const edit = (target, value, extra = {}) => ({ kind: 'system_event', turn_id: turnId(), scenario_id: U, stage: 'frame', event: { kind: 'factor_value_edit', target_id: target, value, raw_value: value, ...extra } })

  it('a figure typed on the canvas goes to core\'s own /edit against the saved version, and the turn names the new Run', async () => {
    const { ctx } = await started({ approve: true })
    const before = fake.calls.length
    const out = (await shim.turn(ctx, edit('existing_capacity', 90))).out
    const call = fake.calls.slice(before).find((c) => c.path.endsWith('/edit'))
    expect(call.body).toMatchObject({ quantity: 'existing_capacity', value: { kind: 'point', value: 90 } })
    expect(call.body.base).toEqual(expect.any(Number))
    expect(out.error).toBeNull()
    expect(out.run.run_id).toMatch(/^mp_run_2_/)
    expect(out.receipts).toHaveLength(1)
    expect(out.model.graph.nodes.find((n) => n.id === 'existing_capacity').observed_state.value).toBe(90)
    expect(out.assistant_text.length).toBeGreaterThan(0)
  })
  it('confirming the current figure changes nothing and sends nothing to core', async () => {
    const { ctx } = await started({ approve: true })
    const before = fake.calls.length
    const out = (await shim.turn(ctx, edit('per_specialist', 20, { intent: 'confirm_current' }))).out
    expect(out.error).toBeNull()
    expect(fake.calls.slice(before).some((c) => c.method === 'POST')).toBe(false)
  })
  it('an aim\'s target is a figure in core\'s model, so it is edited as one', async () => {
    const { ctx } = await started({ approve: true })
    const before = fake.calls.length
    const ev = { kind: 'system_event', turn_id: turnId(), scenario_id: U, stage: 'frame', event: { kind: 'goal_target_edit', goal_node_id: 'capacity_goal', constraint_type: 'at_least', raw_value: 120, unit: 'ticket/week' } }
    const out = (await shim.turn(ctx, ev)).out
    expect(out.error).toBeNull()
    expect(fake.calls.slice(before).find((c) => c.path.endsWith('/edit')).body).toMatchObject({ quantity: 'capacity_target', value: { value: 120 } })
    const wrongWay = { ...ev, turn_id: turnId(), event: { ...ev.event, constraint_type: 'at_most' } }
    expect((await shim.turn(ctx, wrongWay)).out.error.code).toBe('bad_request')
  })
  it('an edit while a change is waiting is refused by core and said in words (nothing saved)', async () => {
    const { ctx } = await started()
    const out = (await shim.turn(ctx, edit('existing_capacity', 90))).out
    expect(out.error).toMatchObject({ nothing_saved: true })
  })
  it('any write core cannot honour is refused at once in words and never sent to core (no hang)', async () => {
    const { ctx } = await started({ approve: true })
    const before = fake.calls.length
    for (const kind of ['structural_delete', 'structural_rename', 'structural_add', 'structural_add_edge', 'edge_strength_edit', 'option_status_edit', 'option_intervention_edit', 'direct_graph_edit']) {
      const out = (await shim.turn(ctx, { kind: 'system_event', turn_id: turnId(), scenario_id: U, stage: 'frame', event: { kind, target_id: 'x' } })).out
      expect(out.error, kind).toMatchObject({ nothing_saved: true })
      expect(out.error.message, kind).toBe(UNSUPPORTED_EDIT)
    }
    expect(fake.calls.slice(before).filter((c) => c.method === 'POST')).toHaveLength(0)
  })
})

describe('the turn carries the Run view for the model it shows (so the Analysis tab agrees with the canvas at once)', () => {
  it('a first draft still held has no Run: the view is null, which clears whatever the page held', async () => {
    const { r } = await started()
    expect(r.out.model.canonical_analysis_view).toBeNull()
  })
  it('an approval carries the current Run, the very one the turn names', async () => {
    const { a } = await started({ approve: true })
    const view = parseCanonicalAnalysisView(a.out.model.canonical_analysis_view)
    expect(view).not.toBeNull()
    expect(view.staleness.stale).toBe(false)
    expect(view.run.run_id).toBe(a.out.run.run_id)
  })
  it('a change held beside the saved model: the canvas keeps the saved model and its Run is current for it (the new figure is a ghost on the card, not a drawn card); setting it aside changes nothing drawn', async () => {
    const { ctx } = await started({ approve: true })
    const held = (await shim.turn(ctx, msg('Add staff absence as a factor.'))).out
    expect(held.model.canonical_analysis_view.staleness.stale).toBe(false)
    expect(held.model.canonical_analysis_view.run.graph_hash_at_run).toBe(held.model.revision)
    expect(held.model.graph.nodes.some((n) => n.id === 'staff_absence')).toBe(false)
    expect(held.cards[0].adds).toEqual([expect.objectContaining({ kind: 'factor_add', node_id: 'staff_absence' })])
    const declined = (await shim.turn(ctx, msg('Not now.', { source: 'chip_click', chip: { id: held.cards[0].decline_action.id } }))).out
    expect(declined.model.canonical_analysis_view.staleness.stale).toBe(false)
    expect(declined.model.canonical_analysis_view.run.graph_hash_at_run).toBe(declined.model.revision)
  })
})

describe('discussion and challenges (gap 6)', () => {
  it('a question gets Olumi\'s reply and no card: it renders as a reply, not a change', async () => {
    const { ctx } = await started({ approve: true })
    const out = (await shim.turn(ctx, msg('What matters most?'))).out
    expect(out.error).toBeNull(); expect(out.cards).toHaveLength(0)
    expect(out.assistant_text).toMatch(/A reply that changes nothing/)
  })
  it('a request to change the model comes back as a card to confirm', async () => {
    const { ctx } = await started({ approve: true })
    const out = (await shim.turn(ctx, msg('Add staff absence as a factor.'))).out
    expect(out.cards).toHaveLength(1); expect(out.cards[0].reading).toBe(false)
    expect(out.cards[0].changes.map((c) => c.id)).toEqual(['staff_absence'])
  })
  it('a composer challenge on one card goes to core\'s challenge route; without a card it goes as words', async () => {
    const { ctx } = await started({ approve: true })
    let before = fake.calls.length
    await shim.turn(ctx, msg('What is the figure for ‘per specialist’ based on?', { source: 'chip', chip: { id: 'ask:challenge' }, selected_elements: [{ id: 'per_specialist', kind: 'factor', label: 'per specialist' }] }))
    expect(fake.calls.slice(before).find((c) => c.path.endsWith('/challenge')).body).toMatchObject({ kind: 'assumption', record: 'per_specialist' })
    before = fake.calls.length
    await shim.turn(ctx, msg('What is the strongest honest case against how this model reads now?', { source: 'chip', chip: { id: 'ask:method-opposite' } }))
    expect(fake.calls.slice(before).some((c) => c.path.endsWith('/challenge'))).toBe(false)
    expect(fake.calls.slice(before).some((c) => c.path.endsWith('/messages'))).toBe(true)
  })
  it('a reply core could not finish is a visible failure, never an empty bubble', async () => {
    const { ctx } = await started({ approve: true })
    fake.problemNext('Olumi could not check that against the model.')
    const out = (await shim.turn(ctx, msg('What matters most?'))).out
    expect(out.error).toMatchObject({ code: 'olumi_could_not_finish', message: 'Olumi could not finish that. Olumi could not check that against the model. Nothing was saved.', retry_safe: true })
  })
  it('a change core kept but could not check stays on screen as a card to set aside (else it is invisible and blocks every figure edit)', async () => {
    const { ctx } = await started({ approve: true })
    fake.problemNext('the coach could not check it')
    const out = (await shim.turn(ctx, msg('Add staff absence as a factor.'))).out
    expect(out.error).toBeNull()
    expect(out.cards).toHaveLength(1)
    expect(out.assistant_text).toMatch(/cannot be confirmed: the coach could not check it\. Set it aside with “Not now”/)
    const declined = (await shim.turn(ctx, msg('Not now.', { source: 'chip_click', chip: { id: out.cards[0].decline_action.id } }))).out
    expect(declined.error).toBeNull(); expect(declined.cards).toHaveLength(0)
  })
  it('a first draft core kept but could not check keeps its card (to set aside) and says why it cannot be confirmed', async () => {
    fake.problemNext('2 findings remain after the one repair')
    const first = await shim.turn({ token: 'tok-ada', aliases: [] }, msg('Keep staffing or add one specialist? We need at least 100 a week.'))
    expect(first.out.error).toBeNull(); expect(first.out.cards).toHaveLength(1)
    expect(first.out.assistant_text).toMatch(/cannot be confirmed: 2 findings remain after the one repair\./)
    expect(first.alias).toEqual([U, expect.stringMatching(/^s_[0-9a-f]{12}$/)])
  })
  it('a scenario whose only draft was set aside starts again from the next brief, under the same UUID', async () => {
    const { ctx, r } = await started()
    await shim.turn(ctx, msg('Not now.', { source: 'chip_click', chip: { id: r.out.cards[0].decline_action.id } }))
    const again = await shim.turn(ctx, msg('a better brief'))
    expect(again.out.error).toBeNull(); expect(again.out.cards).toHaveLength(1)
    expect(again.alias[0]).toBe(U)
    expect(again.alias[1]).not.toBe(ctx.aliases.find(([u]) => u === U)[1])
  })
  it('a Run press has nothing to start: core runs on every change, and the turn says so with the Run it has', async () => {
    const { ctx } = await started({ approve: true })
    const out = (await shim.turn(ctx, msg('Run analysis', { source: 'chip_click', chip: { action_type: 'run_analysis' } }))).out
    expect(out.error).toBeNull(); expect(out.assistant_text).toMatch(/already the latest/)
    expect(out.run.run_id).toMatch(/^mp_run_/)
  })
  it('a Run press while a change waits does not say the results are the latest (they are for the model before the change)', async () => {
    const { ctx } = await started({ approve: true })
    await shim.turn(ctx, msg('Add staff absence as a factor.'))
    const out = (await shim.turn(ctx, msg('Run analysis', { source: 'chip_click', chip: { action_type: 'run_analysis' } }))).out
    expect(out.assistant_text).toMatch(/waiting for your confirmation/)
    expect(out.assistant_text).not.toMatch(/already the latest/)
    expect(out.cards).toHaveLength(1)
  })
})

describe('errors are visible, with the right words (gap 6)', () => {
  const run = async (status, message, headers) => { const { ctx } = await started({ approve: true }); fake.failNext(status, message, headers); return (await shim.turn(ctx, msg('Anything.'))).out }
  it('no private link: 401 sends them to open it', async () => {
    const out = (await shim.turn({ token: null, aliases: [] }, msg('hi'))).out
    expect(out.error).toMatchObject({ code: 'unauthorised', retry_safe: false, nothing_saved: true })
    expect(out.error.message).toMatch(/Open your private link/)
  })
  it('a revoked link, seen at core, is the same words', async () => {
    const out = (await shim.turn({ token: 'tok-gone', aliases: [] }, msg('hi'))).out
    expect(out.error.code).toBe('unauthorised')
  })
  it('409 says what moved, with core\'s own sentence, and that nothing was saved', async () => {
    const out = await run(409, 'the model changed while Olumi was working; send your message again')
    expect(out.error).toMatchObject({ code: 'revision_conflict', retry_safe: true })
    expect(out.error.message).toBe('The model changed while Olumi was working; send your message again. Nothing was saved.')
  })
  it('429 says when to come back (core\'s own wait), and that sending again is safe', async () => {
    const out = await run(429, 'Olumi has had 10 requests from you in the last 5 minutes, the most it takes. Try again in about 2 minutes.', { 'retry-after': '95' })
    expect(out.error).toMatchObject({ code: 'rate_limited', retry_safe: true })
    expect(out.error.message).toMatch(/Try again in about 2 minutes/)
  })
  it('502 is a visible failure in words, with nothing of the AI\'s internals', async () => {
    const out = await run(502, 'Olumi could not finish: update call failed (OpenAI 500: secret detail)')
    expect(out.error).toMatchObject({ code: 'olumi_core_error', retry_safe: true, nothing_saved: true })
    expect(out.error.message).not.toMatch(/OpenAI|secret/)
  })
  it('a timeout does not claim nothing was saved (core may have saved before the reply was lost)', async () => {
    const slow = makeShim({ core: makeCore({ base: fake.url, timeoutMs: 1, paidTimeoutMs: 1, fetchImpl: (url, init) => new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(Object.assign(new Error('timed out'), { name: 'TimeoutError' })))) }) })
    const out = (await slow.turn({ token: 'tok-ada', aliases: [] }, msg('hi'))).out
    expect(out.error).toMatchObject({ code: 'olumi_timeout', nothing_saved: false, retry_safe: false })
  })
  it('core unreachable is a visible failure too', async () => {
    const down = makeShim({ core: makeCore({ base: 'http://127.0.0.1:1' }) })
    const out = (await down.turn({ token: 'tok-ada', aliases: [] }, msg('hi'))).out
    expect(out.error).toMatchObject({ code: 'olumi_unreachable', retry_safe: true })
  })
})

describe('the saved-model read (reload, a second browser, a link)', () => {
  it('cold-loads a saved model with its Run and no held card', async () => {
    const { ctx } = await started({ approve: true })
    const g = await shim.graphRead(ctx, U)
    expect(g.status).toBe(200); expect(g.body.graph_present).toBe(true)
    expect(g.body.proposal_fields).toBeUndefined()
    expect(parseCanonicalAnalysisView(g.body.canonical_analysis_view)).not.toBeNull()
    expect(g.body.content_hash).toMatch(/^[0-9a-f]{64}$/)
  })
  it('a reload while the first model is still pending keeps the card (gap 5), with the same held-card identity', async () => {
    const { ctx, r } = await started()
    const g = await shim.graphRead(ctx, U)
    expect(g.body.proposal_fields.proposals).toHaveLength(1)
    expect(g.body.proposal_fields.proposals[0].proposal_id).toBe(r.out.cards[0].proposal_id)
    expect(g.body.proposal_fields.proposals[0].reading).toBe(true)
    expect(g.body.conversation_turns).toHaveLength(1)
  })
  it('a browser that does not know the UUID the scenario was minted under reads it by the derived UUID, with no alias', async () => {
    const { ctx } = await started({ approve: true })
    const sid = sidOfUuid(U, ctx.aliases)
    const derived = `00000000-0000-4000-8000-${sid.slice(2)}`
    const g = await shim.graphRead({ token: 'tok-ada', aliases: [] }, derived)
    expect(g.body.graph_present).toBe(true)
  })
  it('somebody else\'s scenario is not readable, and no identity at all is a 401', async () => {
    const { ctx } = await started({ approve: true })
    const sid = sidOfUuid(U, ctx.aliases)
    const derived = `00000000-0000-4000-8000-${sid.slice(2)}`
    expect((await shim.graphRead({ token: 'tok-bea', aliases: [] }, derived)).status).toBe(404)
    expect((await shim.graphRead({ token: null, aliases: [] }, derived)).status).toBe(401)
  })
  it('a model with a change waiting reads back as the saved model, its Run current, and the held card with its ghost', async () => {
    const { ctx } = await started({ approve: true })
    await shim.turn(ctx, msg('Add staff absence as a factor.'))
    const g = await shim.graphRead(ctx, U)
    expect(g.body.proposal_fields.proposals).toHaveLength(1)
    const view = g.body.canonical_analysis_view
    expect(view.staleness.stale).toBe(false)
    expect(view.run.graph_hash_at_run).toBe(g.body.graph_hash)
    expect(g.body.graph.nodes.some((n) => n.id === 'staff_absence')).toBe(false)
    expect(g.body.proposal_fields.proposals[0].adds).toEqual([expect.objectContaining({ kind: 'factor_add', node_id: 'staff_absence' })])
  })
  it('a UUID no one has made a scenario under is "no model yet", not an error', async () => {
    const g = await shim.graphRead({ token: 'tok-ada', aliases: [] }, '99999999-2222-4333-8444-555555555555')
    expect(g.body).toMatchObject({ graph_present: false })
  })
})
