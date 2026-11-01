/**
 * DGAI's two reads of its backend, answered from olumi-core's REST API (v1.4):
 *   turn(ctx, body)        CEE's CoreTurn (`src/v5/coreTurnContract.ts`) for a chat turn, a card press or a canvas edit
 *   graphRead(ctx, uuid)   the saved-graph read (`scenario_graph.v1`) a reload, a link or a second browser starts from
 * `ctx` is { token, aliases }: the browser's own olumi cookie and its scenario aliases. Nothing is remembered here.
 */
import crypto from 'node:crypto'
import { CoreError, WriteKept, errorTurn } from './core.mjs'
import { changeRows, byId, figure } from './words.mjs'
import { analysisViewOf, modelOf, shownOf } from './model.mjs'
import { propIdOf, rev16, rev64, runIdOf, sidOfUuid, turnIdOf, uuidOfSid, isSid } from './ids.mjs'

const DRAFT_LEAD = 'Here is your situation as I understood it. Check it, then confirm or tell me what to change.'
const CHANGE_LEAD = 'Here is what I would change. Check it, then confirm.'
export const PARTIAL_REFUSAL = (n, total) => `Confirming only some rows (${n} of ${total}) is not available yet; it needs an update to Olumi that is due on 5 November. Nothing has been saved. Use “Confirm whole card”, or tell me what to change.`
export const UNSUPPORTED_EDIT = 'Olumi cannot make that kind of change on the canvas yet. Tell me in the chat what to change, or change a figure. Nothing was saved.'

/** What a marker reads as when core did not explain it (its own page's fallback for a finding it has no sentence for). */
const UNEXPLAINED = 'a finding from the Run'

/**
 * Olumi's reply, as words for the thread: the answer, why, and the next move. A finding the reply cites by marker (`[F5]`) is
 * written in from that reply's OWN `cited` map (API.md: `chat[].cited`). Fact ids belong to one Run and a later change renumbers
 * them, so a marker is never looked up in the current Run's facts: the same reply must read the same live and on every reload.
 */
export function coachText(coach, cited = {}) {
  if (!coach) return ''
  const fill = (t) => t.replace(/\[(F\d+)\](\.?)/g, (_, id, dot) => {
    const said = typeof cited?.[id] === 'string' && cited[id].trim() !== '' ? cited[id].trim() : UNEXPLAINED
    return /[.!?]$/.test(said) ? said : `${said}${dot}`
  })
  return [fill(coach.answer), ...coach.why.map(fill), `Next (${coach.next.move.replace(/_/g, ' ')}): ${fill(coach.next.text)}`].filter(Boolean).join('\n')
}
/** The words of the reply written on one chat row. */
const replyOf = (row) => coachText(row?.answer, row?.cited)

const heldWithProblem = (problem) => `Olumi could not finish checking that change, so it cannot be confirmed: ${problem.charAt(0).toLowerCase()}${problem.slice(1).replace(/[.!?]$/, '')}. Set it aside with “Not now”, or tell me what to change. Nothing has been saved.`
/** What olumi-core's turn could not finish, in words (a row with a `problem`): a visible failure, never an empty reply. */
const problemTurn = (turnId, text) => ({ turn_id: turnId, assistant_text: '', model: null, cards: [], notes: [], run: null, receipts: [], error: { code: 'olumi_could_not_finish', message: `Olumi could not finish that. ${text.charAt(0).toUpperCase()}${text.slice(1)}${/[.!?]$/.test(text) ? '' : '.'} Nothing was saved.`, retry_safe: true, nothing_saved: true } })

function cardFor(view, issuedTurnId) {
  const p = view.pending
  const sid = view.id
  const pid = propIdOf(sid, p.id)
  const rows = changeRows(view)
  return {
    proposal_id: pid, issued_turn_id: issuedTurnId, revision: rev16(view),
    digest: crypto.createHash('sha256').update(`${pid}|${JSON.stringify(p.changes)}`).digest('hex').slice(0, 32),
    approve_action: { id: `agent-approve-proposal:${pid}`, label: 'Looks right', message: 'Looks right. Confirm it.' },
    decline_action: { id: `agent-decline-proposal:${pid}`, label: 'Not now', message: 'Not now.' },
    fields: [], missing: [], adds: [],
    reading: p.source === 'draft',
    changes: rows,
  }
}

/** The turn's body. `receipt`: this turn saved a version, so it names the Run its results belong to (DGAI adopts a Run's view only then). */
function turnBody(view, { turnId, text, withCard, receipt }) {
  const shown = modelOf(view)
  // The Run view rides with the model it belongs to (the page adopts it as a read does): without it the Analysis tab keeps the view
  // of the last read, which is the saved model's chances shown as current beside a held change, or beside its absence after "Not now".
  const model = shown ? { ...shown, canonical_analysis_view: analysisViewOf(view) } : null
  return {
    turn_id: turnId, assistant_text: text, model,
    cards: withCard && view.pending ? [cardFor(view, turnId)] : [],
    notes: [],
    run: receipt && view.version ? { run_key: runIdOf(view.version), run_id: runIdOf(view.version), computed_against: rev16(view), state: { kind: 'current', computed_at: view.version.at } } : null,
    analysis_result: null, analysis_state: null,
    model_program: { version: 'v1' },
    receipts: receipt ? [{ kind: 'unversioned', scenario_revision: rev64(view), run_id: view.version ? runIdOf(view.version) : null, source_turn_id: turnId, authorised_by: 'person' }] : [],
    paused: null, action_bar: null, error: null,
  }
}

/** DGAI's composer moves (src/canvas/conversation/actionBar/ComposerMoves.tsx) are core's four challenges, by the chip id they send. */
const CHALLENGE_KINDS = { 'ask:challenge': 'assumption', 'ask:method-opposite': 'opposite', 'ask:falsify': 'disconfirming', 'ask:method-outside-view': 'outside' }
/**
 * A press that is one of core's four challenges and names one card of the model goes to core's own challenge route (a fixed
 * question worded from the card, always a question). Without a card in the model it goes as the words it carries: core
 * answers them as a question, with no change to approve.
 */
export function challengeOf(body, view) {
  const kind = CHALLENGE_KINDS[body.chip?.id]
  if (!kind) return null
  const ids = byId((view.pending ?? view.version)?.form)
  const picked = Array.isArray(body.selected_elements) && body.selected_elements.length === 1 ? body.selected_elements[0]?.id : null
  return typeof picked === 'string' && ids.has(picked) ? { kind, record: picked } : null
}

/**
 * What follows a write core has KEPT (re-reading the scenario, building the answer from it): if it fails, the write still stands,
 * so the failure is `WriteKept`, never "nothing was saved". `extra` is handed on with it (a new scenario's pairing).
 */
const afterWrite = async (build, extra) => {
  try { return await build() } catch (e) { throw new WriteKept(e, extra) }
}

export function makeShim({ core, log = () => {} }) {
  const view = (ctx, sid) => core('GET', `/api/scenarios/${sid}`, { token: ctx.token })

  async function approve(ctx, body, turnId, pid, sid) {
    const v = await view(ctx, sid)
    if (!v.pending || propIdOf(sid, v.pending.id) !== pid) return { out: errorTurn(turnId, new CoreError(409, 'that card is no longer waiting for an answer')) }
    const rows = changeRows(v)
    if (Array.isArray(body.approve_ids) && body.approve_ids.length > 0 && !rows.every((r) => body.approve_ids.includes(r.id))) {
      return { out: turnBody(v, { turnId, text: PARTIAL_REFUSAL(body.approve_ids.length, rows.length), withCard: true }) }
    }
    const r = await core('POST', `/api/proposals/${v.pending.id}/approve`, { token: ctx.token, body: { base: v.pending.base } })
    return afterWrite(async () => {
      const after = await view(ctx, sid)
      const row = after.chat.find((c) => c.proposal === v.pending.id) ?? after.chat.find((c) => c.version === r.n)
      return { out: turnBody(after, { turnId, text: replyOf(row) || `Saved as version ${r.n}.`, withCard: false, receipt: true }) }
    })
  }

  async function decline(ctx, turnId, pid, sid) {
    const v = await view(ctx, sid)
    if (!v.pending || propIdOf(sid, v.pending.id) !== pid) return { out: errorTurn(turnId, new CoreError(409, 'that card is no longer waiting for an answer')) }
    await core('POST', `/api/proposals/${v.pending.id}/discard`, { token: ctx.token })
    return afterWrite(async () => ({ out: turnBody(await view(ctx, sid), { turnId, text: 'Okay, I have left it as it was.', withCard: false }) }))
  }

  /**
   * A figure the person changed on the canvas: core's own /edit, applied at once as their figure, Olumi replies.
   * Core's edit takes a point or a low/high, never a likeliest value, so a figure typed over a RANGE would silently replace the
   * person's range with one number (and the Run with it). That edit is refused, in words, before anything is sent.
   */
  async function editFigure(ctx, turnId, sid, quantityId, value) {
    let quantity = quantityId
    const v = await view(ctx, sid)
    if (!v.version) throw new CoreError(409, 'there is no saved model to edit yet')
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new CoreError(400, 'that is not a figure Olumi can use')
    // A limit card shows its bound as its figure: typing on it edits that figure.
    const limit = v.version.form.records.find((r) => r.id === quantity && r.family === 'limit')
    if (limit) {
      if (!limit.measure) throw new CoreError(400, 'that limit has no figure to change yet. Nothing was saved.')
      quantity = limit.measure.bound
    }
    const rec = v.version.form.records.find((r) => r.id === quantity)
    if (rec?.family === 'quantity' && rec.assertion.kind === 'interval') {
      throw new CoreError(400, `‘${rec.label}’ is a range (${figure(rec.assertion, rec.unit)}), and a typed figure would replace it with one number. Tell me the new range in the chat. Nothing was saved.`)
    }
    const saved = await core('POST', `/api/scenarios/${sid}/edit`, { token: ctx.token, body: { base: v.version.id, quantity, value: { kind: 'point', value }, op: String(turnId).replace(/[^A-Za-z0-9-]/g, '').slice(0, 64) || undefined } })
    return afterWrite(async () => {
      const after = await view(ctx, sid)
      return { out: turnBody(after, { turnId, text: replyOf(after.chat.find((c) => c.kind === 'edit' && c.version === saved.n)) || 'Saved.', withCard: false, receipt: true }) }
    })
  }

  /** The canvas events core can honour are the two that are a figure: a factor's value, and an aim's target (which is a figure in core's model). */
  async function edit(ctx, body, turnId, sid) {
    const ev = body.event ?? {}
    if (ev.kind === 'factor_value_edit') {
      if (ev.intent === 'confirm_current') { const v = await view(ctx, sid); return { out: turnBody(v, { turnId, text: '', withCard: !!v.pending }) } }
      return editFigure(ctx, turnId, sid, ev.target_id, typeof ev.raw_value === 'number' ? ev.raw_value : ev.value)
    }
    if (ev.kind === 'goal_target_edit') {
      const v = await view(ctx, sid)
      const goal = v.version?.form.records.find((r) => r.family === 'goal' && r.id === ev.goal_node_id)
      const target = goal?.measure?.target
      const sameWay = { at_least: ['>=', '>'], at_most: ['<=', '<'] }[ev.constraint_type]
      if (!target) throw new CoreError(400, 'that aim has no figure to change yet')
      if (sameWay && !sameWay.includes(goal.measure.cmp)) throw new CoreError(400, 'that changes which way the aim is measured, which Olumi cannot do from the canvas. Tell me in the chat')
      return editFigure(ctx, turnId, sid, target, typeof ev.raw_value === 'number' ? ev.raw_value : ev.value)
    }
    return { out: errorTurn(turnId, new CoreError(400, UNSUPPORTED_EDIT)), unsupported: true }
  }

  async function message(ctx, body, turnId, sid, uuid) {
    const text = String(body.message ?? '').trim()
    if (text.length === 0) return { out: errorTurn(turnId, new CoreError(400, 'Say what you are deciding.')) }
    const op = String(turnId).replace(/[^A-Za-z0-9-]/g, '').slice(0, 64) || undefined
    // A scenario with no model at all (its first draft was set aside) starts again from the brief, under the same UUID.
    let before = sid ? await view(ctx, sid) : null
    if (before && !before.version && !before.pending) { before = null; sid = null }
    if (!sid) {
      const made = await core('POST', '/api/scenarios', { token: ctx.token, body: { brief: text, op } })
      const alias = [uuid, made.scenario]
      // The scenario exists now: whatever happens next, the page must be told which scenario its UUID is (`alias` rides on the error too).
      return afterWrite(async () => {
        const v = await view(ctx, made.scenario)
        const problem = v.chat.find((c) => c.id === made.proposal)?.problem
        // The draft was kept but could not be checked: its card stays on screen so it can be set aside ("Not now"); core refuses to confirm it.
        if (problem && v.pending) return { out: turnBody(v, { turnId, text: heldWithProblem(problem), withCard: true }), alias }
        if (problem) return { out: problemTurn(turnId, problem), alias }
        return { out: turnBody(v, { turnId, text: DRAFT_LEAD, withCard: true }), alias }
      }, { alias })
    }
    const ch = challengeOf(body, before)
    const r = ch
      ? await core('POST', `/api/scenarios/${sid}/challenge`, { token: ctx.token, body: { ...ch, op } })
      : await core('POST', `/api/scenarios/${sid}/messages`, { token: ctx.token, body: { text, op } })
    return afterWrite(async () => {
      const v = await view(ctx, sid)
      const row = v.chat.find((c) => c.id === r.proposal) ?? [...v.chat].reverse().find((c) => c.answer || c.problem)
      if (row?.problem) {
        // A change core kept but could not check is a held proposal with a reason it cannot be confirmed: its card stays on screen so
        // it can be set aside (otherwise it is invisible and blocks every figure edit). A reply to a question is a plain failure.
        if (!r.discussion && v.pending) return { out: turnBody(v, { turnId, text: heldWithProblem(row.problem), withCard: true }) }
        return { out: problemTurn(turnId, row.problem) }
      }
      if (r.discussion) return { out: turnBody(v, { turnId, text: replyOf(row) || 'Noted. Nothing in the model changes.', withCard: !!v.pending }) }
      return { out: turnBody(v, { turnId, text: CHANGE_LEAD, withCard: true }) }
    })
  }

  async function turn(ctx, body) {
    const turnId = body.turn_id ?? crypto.randomUUID()
    const uuid = body.scenario_id
    const sid = sidOfUuid(uuid, ctx.aliases)
    const chip = typeof body.chip?.id === 'string' ? body.chip.id : null
    try {
      if (!ctx.token) throw new CoreError(401, 'open your private link first')
      if (chip?.startsWith('agent-approve-proposal:')) { if (!isSid(sid)) throw new CoreError(404, 'no such scenario'); return await approve(ctx, body, turnId, chip.slice('agent-approve-proposal:'.length), sid) }
      if (chip?.startsWith('agent-decline-proposal:')) { if (!isSid(sid)) throw new CoreError(404, 'no such scenario'); return await decline(ctx, turnId, chip.slice('agent-decline-proposal:'.length), sid) }
      if (body.kind === 'system_event') { if (!isSid(sid)) throw new CoreError(404, 'no such scenario'); return await edit(ctx, body, turnId, sid) }
      // olumi-core runs the model on every change it saves, so there is nothing for a "Run analysis" press to start: say so, with the Run it already has.
      if (body.chip?.action_type === 'run_analysis') {
        if (!isSid(sid)) throw new CoreError(404, 'no such scenario')
        const v = await view(ctx, sid)
        const text = v.pending ? 'A change is waiting for your confirmation. Confirm it, and Olumi runs the analysis on the new model.'
          : v.version ? 'Olumi runs the analysis every time the model changes, so what you see is already the latest.' : 'There is no confirmed model to analyse yet. Confirm the card first.'
        return { out: turnBody(v, { turnId, text, withCard: !!v.pending, receipt: !!v.version }) }
      }
      return await message(ctx, body, turnId, sid, uuid)
    } catch (e) {
      if (!(e instanceof CoreError)) throw e
      log('turn error', { status: e.status, message: e.message, kept: e instanceof WriteKept })
      return { out: errorTurn(turnId, e), ...(e.alias ? { alias: e.alias } : {}) }
    }
  }

  async function graphRead(ctx, uuid) {
    const empty = { schema: 'scenario_graph.v1', scenario_id: uuid, graph_present: false, graph: null }
    const sid = sidOfUuid(uuid, ctx.aliases)
    if (!ctx.token) return { status: 401, body: { error: 'open your private link first' } }
    if (!isSid(sid)) return { status: 200, body: empty }
    let v
    try { v = await view(ctx, sid) } catch (e) {
      if (e instanceof CoreError && (e.status === 401 || e.status === 404)) return { status: e.status, body: { error: e.message } }
      throw e
    }
    const model = modelOf(v)
    if (!model) return { status: 200, body: empty }
    const analysis = analysisViewOf(v)
    return {
      status: 200,
      body: {
        schema: 'scenario_graph.v1', scenario_id: uuid, request_id: crypto.randomUUID(), graph_present: true, graph: model.graph,
        graph_hash: model.revision, content_hash: model.scenario_revision, brief_text: v.brief, layout_present: false,
        ...(analysis ? { canonical_analysis_view: analysis } : {}),
        // A reload: the thread (olumi-core's chat) and the card still held, so the person can still confirm it.
        conversation_turns: v.chat.map((c) => ({
          turn_id: turnIdOf(sid, c.id), created_at: c.at, user_message: c.said,
          assistant_message: c.status === 'pending' ? (c.first ? DRAFT_LEAD : CHANGE_LEAD) : c.problem ? c.problem : c.answer ? coachText(c.answer, c.cited) : 'Noted.',
        })),
        ...(v.pending ? { proposal_fields: { version: 1, graph_hash: model.revision, proposals: [cardFor(v, turnIdOf(sid, v.pending.id))] } } : {}),
      },
    }
  }

  return { turn, graphRead, cardFor, uuidOfSid, shownOf }
}
