/**
 * DGAI's two reads of its backend, answered from olumi-core's REST API (v1.4):
 *   turn(ctx, body)        CEE's CoreTurn (`src/v5/coreTurnContract.ts`) for a chat turn, a card press or a canvas edit
 *   graphRead(ctx, uuid)   the saved-graph read (`scenario_graph.v1`) a reload, a link or a second browser starts from
 * `ctx` is { token, aliases }: the browser's own olumi cookie and its scenario aliases. Nothing is remembered here.
 */
import crypto from 'node:crypto'
import { CoreError, WriteKept, errorTurn } from './core.mjs'
import { changeRows, byId, figure, num } from './words.mjs'
import { analysisViewOf, ghostAddsOf, modelOf, shownOf } from './model.mjs'
import { fillCited, noteOf } from './note.mjs'
import { propIdOf, rev16, rev64, revSaved16, runIdOf, sidOfUuid, turnIdOf, uuidOfSid, isSid } from './ids.mjs'

const DRAFT_LEAD = 'Here is your situation as I understood it. Check it, then confirm or tell me what to change.'
const CHANGE_LEAD = 'Here is what I would change. Check it, then confirm.'
export const UNSUPPORTED_EDIT = 'Olumi cannot make that kind of change on the canvas yet. Tell me in the chat what to change, or change a figure. Nothing was saved.'

/**
 * Olumi's reply, as words for the thread: the answer, why, and the next move. A finding the reply cites by marker (`[F5]`) is
 * written in from that reply's OWN `cited` map (`fillCited`): the same reply must read the same live and on every reload.
 */
export function coachText(coach, cited = {}) {
  if (!coach) return ''
  return [fillCited(coach.answer, cited), ...coach.why.map((t) => fillCited(t, cited)), `Next (${coach.next.move.replace(/_/g, ' ')}): ${fillCited(coach.next.text, cited)}`].filter(Boolean).join('\n')
}

/**
 * A reply on one chat row: the thread's words, and Olumi's next step as a note beside the card it is about (`noteOf`: core's own
 * `coach.next`, the first card in `next.about` that the model drawn has). The thread keeps its `Next (...)` line too, so it reads the same
 * live and on every reload; the note is derived from the same stored row on a reload (`graphRead`'s `olumi_note`), so it survives one too.
 * `nodes` are the cards of the model the turn shows.
 */
const replyOf = (row, nodes = []) => {
  const note = noteOf(row?.answer, row?.cited, nodes)
  return { text: coachText(row?.answer, row?.cited), notes: note ? [note] : [] }
}
const nodesOf = (view) => modelOf(view)?.graph.nodes ?? []
/**
 * The receipt of a saved version, said in the thread: which version, and whose hand. Core records who saved the CURRENT version only
 * (`version.by`), so an older version's receipt says it was saved and no more, on a reload; nothing is guessed for it.
 */
const savedWords = (n, by, kind) => `Version ${n} saved.${by ? ` ${kind === 'edit' ? 'Changed' : 'Approved'} by ${by}.` : ''}`
/** Is `x` the same figure as `y`, to float noise (a relative 1e-9)? */
const closeTo = (x, y) => x === y || Math.abs(x - y) <= 1e-9 * Math.max(Math.abs(x), Math.abs(y))
/** A chat row that IS an approval reply: it saved a version. A discussion row never is, even when it is about a version. */
const isApprovalReply = (c) => c.status !== 'discussion' && c.version != null

const heldWithProblem = (problem) => `Olumi could not finish checking that change, so it cannot be confirmed: ${problem.replace(/[.!?]$/, '')}. Set it aside with “Not now”, or tell me what to change. Nothing has been saved.`
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
    fields: [], missing: [], adds: ghostAddsOf(view),
    reading: p.source === 'draft',
    changes: rows,
  }
}

/** The turn's body. `receipt`: this turn saved a version, so it names the Run its results belong to (DGAI adopts a Run's view only then). */
function turnBody(view, { turnId, text, withCard, receipt, notes = [] }) {
  const shown = modelOf(view)
  // The Run view rides with the model it belongs to (the page adopts it as a read does): without it the Analysis tab keeps the view
  // of the last read, which is the saved model's chances shown as current beside a held change, or beside its absence after "Not now".
  const model = shown ? { ...shown, canonical_analysis_view: analysisViewOf(view) } : null
  return {
    turn_id: turnId, assistant_text: text, model,
    cards: withCard && view.pending ? [cardFor(view, turnId)] : [],
    notes,
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

export function makeShim({ core, log = () => {}, onlySupported }) {
  const view = (ctx, sid) => core('GET', `/api/scenarios/${sid}`, { token: ctx.token })

  /**
   * "Looks right" confirms the whole card; "Confirm selected" (the ticks on the reading card's rows, `approve_ids`) confirms exactly
   * those rows, as core's `only` (API v1.4: record ids of the proposal's changes). When every change is ticked, top-level ones included, it is the whole card.
   * Core decides what a selection needs: a choice that needs a record that was not chosen is refused with a 409 that names it, and
   * that refusal is shown in core's own words with the card still held, so the ticks can be changed. Core re-runs a part-approved
   * model with no reply from Olumi (`version.coach` is cleared, though the proposal's chat row still holds its answer), so what is
   * shown is only `version.coach`: none means no coach reply and no note on that turn.
   */
  async function approve(ctx, body, turnId, pid, sid) {
    const v = await view(ctx, sid)
    if (!v.pending || propIdOf(sid, v.pending.id) !== pid) return { out: errorTurn(turnId, new CoreError(409, 'that card is no longer waiting for an answer')) }
    // The ticks are compared with the COMPLETE change set the proposal makes: its records (added, changed, removed) and its top-level
    // fields (`top`: the question, the title, the period...), which have no row to tick. `only` is dropped, and the whole card approved,
    // only when every one of them is ticked; any other selection is sent as it stands, so a change that was not ticked is not approved.
    // A selection that is not a list is garbage, not "no selection": it is refused, never read as the whole card.
    if (body.approve_ids != null && !Array.isArray(body.approve_ids)) return { out: errorTurn(turnId, new CoreError(400, 'That selection is not a list of changes. Nothing was saved.')) }
    if (Array.isArray(body.approve_ids) && body.approve_ids.length === 0) return { out: errorTurn(turnId, new CoreError(400, 'Tick at least one change to confirm, or use “Looks right” to confirm them all. Nothing was saved.')) }
    const ticked = Array.isArray(body.approve_ids) ? [...new Set(body.approve_ids)].sort() : []
    const every = [...v.pending.changes.added, ...v.pending.changes.changed, ...v.pending.changes.removed, ...(v.pending.changes.top ?? [])]
    // An id that is not in the change (an unknown one) is never dropped: the whole card is approved only when the ticks are exactly the
    // change set, so core is sent exactly what was ticked and refuses an id it does not know (400) rather than approving everything.
    const only = ticked.length > 0 && !(every.every((id) => ticked.includes(id)) && ticked.every((id) => every.includes(id))) ? ticked : null
    // A core without selective approval (served `candidate` before API v1.4's `only`) ignores `only` and would approve every change,
    // so a part-selection is refused here unless the core is declared to support it (OLUMI_CORE_ONLY=1).
    if (only && !(onlySupported ?? process.env.OLUMI_CORE_ONLY === '1')) return { out: errorTurn(turnId, new CoreError(409, 'Confirming only some changes is not available yet: use “Looks right” to confirm them all, or set the card aside. Nothing was saved.')) }
    let r
    try {
      r = await core('POST', `/api/proposals/${v.pending.id}/approve`, { token: ctx.token, body: { base: v.pending.base, ...(only ? { only } : {}) } })
    } catch (e) {
      if (only && e instanceof CoreError && e.status === 409) {
        const now = await view(ctx, sid)
        if (now.pending && propIdOf(sid, now.pending.id) === pid) return { out: turnBody(now, { turnId, text: `${e.message.charAt(0).toUpperCase()}${e.message.slice(1)}`, withCard: true }) }
      }
      throw e
    }
    return afterWrite(async () => {
      const after = await view(ctx, sid)
      const row = after.chat.find((c) => c.status !== 'discussion' && c.proposal === v.pending.id) ?? after.chat.find((c) => isApprovalReply(c) && c.version === r.n)
      // The reply is the one core holds on the version it just saved (`version.coach`), never the proposal's own chat answer: after a
      // part-approval that answer still describes the whole proposal. No coach on the new version: nothing from Olumi, and no note.
      const coach = after.version?.n === r.n ? after.version.coach ?? null : null
      const reply = replyOf({ answer: coach, cited: row?.cited }, nodesOf(after))
      // Whatever core left waiting after a part-approval stays on screen as a card, so it can still be answered or set aside.
      return { out: turnBody(after, { turnId, text: [savedWords(r.n, after.version?.n === r.n ? after.version.by : null, 'approve'), reply.text].filter(Boolean).join('\n'), withCard: !!after.pending, receipt: true, notes: reply.notes }) }
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
   * `figureIn` is the number they typed, or `{ low, high }` when they set a range: core takes a point OR an interval, so each is
   * sent as what it is (a range is never flattened to one number). Core has no likeliest value on an edit, so a figure typed over
   * a RANGE would silently replace the person's range with one number (and the Run with it): that edit is refused, in words,
   * before anything is sent. A range set over a range is a range edit and is sent, unless the range being changed has a most likely
   * figure: core would save the new ends with none, so that edit is refused too. So is a range over a single value that is not centred
   * on it, since the card would then show the middle of the range as the person's figure.
   */
  async function editFigure(ctx, turnId, sid, quantityId, figureIn) {
    let quantity = quantityId
    const range = figureIn !== null && typeof figureIn === 'object'
    const v = await view(ctx, sid)
    if (!v.version) throw new CoreError(409, 'there is no saved model to edit yet')
    // Core's /edit takes the version it was made on (`base`), and the shim reads that fresh, so it cannot tell that the PAGE is behind. The page
    // says which saved model it last read (`x-olumi-revision`): an edit from a page that is behind the saved model would overwrite a newer figure.
    if (ctx.revision && ctx.revision !== revSaved16(v)) throw new CoreError(409, 'This page is out of date; reload to edit')
    if (range) {
      if (![figureIn.low, figureIn.high].every((x) => typeof x === 'number' && Number.isFinite(x)) || figureIn.low > figureIn.high) throw new CoreError(400, 'that is not a range Olumi can use')
    } else if (typeof figureIn !== 'number' || !Number.isFinite(figureIn)) throw new CoreError(400, 'that is not a figure Olumi can use')
    // A limit card shows its bound as its figure: typing on it edits that figure.
    const limit = v.version.form.records.find((r) => r.id === quantity && r.family === 'limit')
    if (limit) {
      if (!limit.measure) throw new CoreError(400, 'that limit has no figure to change yet. Nothing was saved.')
      quantity = limit.measure.bound
    }
    const rec = v.version.form.records.find((r) => r.id === quantity)
    // A figure the model works out from others, or one fixed by how the model is built (a unit conversion, a switch), is nobody's figure to
    // overwrite: core would save the typed number over the calculation or the constant and make it the person's. Refused, in words.
    if (rec?.family === 'quantity' && (rec.role === 'derived' || rec.assertion.kind === 'derived')) throw new CoreError(400, `‘${rec.label}’ is worked out from other figures, so it cannot be typed over. Change the figures it is worked out from, or tell me in the chat. Nothing was saved.`)
    if (rec?.family === 'quantity' && rec.origin?.by === 'structure') throw new CoreError(400, `‘${rec.label}’ is fixed by how the model is built, not a figure anyone gave, so it cannot be changed here. Tell me in the chat if it is wrong. Nothing was saved.`)
    if (!range && rec?.family === 'quantity' && rec.assertion.kind === 'interval') {
      throw new CoreError(400, `‘${rec.label}’ is a range (${figure(rec.assertion, rec.unit)}), and a typed figure would replace it with one number. Tell me the new range in the chat. Nothing was saved.`)
    }
    // Core's /edit takes a low and a high only and saves the range with no most-likely figure, so changing the ends of a range that has
    // one would delete the person's figure: refused in words, before anything is sent.
    if (range && rec?.family === 'quantity' && rec.assertion.kind === 'interval' && rec.assertion.likely != null) {
      throw new CoreError(400, `‘${rec.label}’ is ${figure(rec.assertion, rec.unit)}, and changing its ends would lose the most likely figure you gave. Tell me the new range and the most likely figure in the chat. Nothing was saved.`)
    }
    // The same loss for a figure the person gave as ONE value: core saves the range with no value of its own, and the card then shows the
    // middle of the range as the figure. That is only the person's figure when the range is centred on it (70 to 90 around 80); a range
    // that is not (70 to 100 around 80) would turn their 80 into an 85, so it is refused in words before anything is sent.
    if (range && rec?.family === 'quantity' && rec.assertion.kind === 'point') {
      const middle = (figureIn.low + figureIn.high) / 2
      if (!closeTo(middle, rec.assertion.value)) {
        throw new CoreError(400, `‘${rec.label}’ is ${figure(rec.assertion, rec.unit)}, and a range of ${num(figureIn.low)} to ${num(figureIn.high)} would replace it with its middle, ${figure({ kind: 'point', value: middle }, rec.unit)}, which you did not give. Tell me the range and the most likely figure in the chat. Nothing was saved.`)
      }
    }
    const value = range ? { kind: 'interval', low: figureIn.low, high: figureIn.high } : { kind: 'point', value: figureIn }
    const body = { base: v.version.id, quantity, value, op: String(turnId).replace(/[^A-Za-z0-9-]/g, '').slice(0, 64) || undefined }
    let saved
    try { saved = await core('POST', `/api/scenarios/${sid}/edit`, { token: ctx.token, body }) } catch (e) {
      if (!(e instanceof CoreError && e.status === 0 && e.maybeSaved)) throw e
      // The edit went out and its answer was lost. Core's own record says whether it landed: if the figure is now what was typed, on a
      // later version, it was kept, and this is answered as a saved figure. If not, nobody knows (it may land after this read), so the
      // original "may or may not have saved" stands, and the screen is not told that nothing was saved.
      const after = await view(ctx, sid).catch(() => null)
      const now = after?.version?.form.records.find((r) => r.id === quantity)?.assertion
      const same = range ? now?.kind === 'interval' && now.low === value.low && now.high === value.high : now?.kind === 'point' && now.value === value.value
      if (!after?.version || after.version.id === v.version.id || !same) throw e
      return afterWrite(async () => {
        const reply = replyOf(after.chat.find((c) => c.kind === 'edit' && isApprovalReply(c) && c.version === after.version.n), nodesOf(after))
        return { out: turnBody(after, { turnId, text: [savedWords(after.version.n, after.version.by, 'edit'), reply.text].filter(Boolean).join('\n'), withCard: false, receipt: true, notes: reply.notes }) }
      })
    }
    return afterWrite(async () => {
      const after = await view(ctx, sid)
      const reply = replyOf(after.chat.find((c) => c.kind === 'edit' && isApprovalReply(c) && c.version === saved.n), nodesOf(after))
      return { out: turnBody(after, { turnId, text: [savedWords(saved.n, after.version?.n === saved.n ? after.version.by : null, 'edit'), reply.text].filter(Boolean).join('\n'), withCard: false, receipt: true, notes: reply.notes }) }
    })
  }

  /** The canvas events core can honour are the ones that are a figure: a factor's value or range, and an aim's target (which is a figure in core's model). */
  async function edit(ctx, body, turnId, sid) {
    const ev = body.event ?? {}
    if (ev.kind === 'factor_value_edit') {
      if (ev.intent === 'confirm_current') { const v = await view(ctx, sid); return { out: turnBody(v, { turnId, text: '', withCard: !!v.pending }) } }
      return editFigure(ctx, turnId, sid, ev.target_id, typeof ev.raw_value === 'number' ? ev.raw_value : ev.value)
    }
    // A range the person set on a figure (the range editor's `prior_range_edit`): sent to core as an interval. Core's interval has no
    // distribution shape, so the editor's `distribution` is not sent and is not claimed to have been kept.
    if (ev.kind === 'prior_range_edit') return editFigure(ctx, turnId, sid, ev.target_id, { low: ev.range_min, high: ev.range_max })
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
      if (r.discussion) {
        const reply = replyOf(row, nodesOf(v))
        return { out: turnBody(v, { turnId, text: reply.text || 'Noted. Nothing in the model changes.', withCard: !!v.pending, notes: reply.notes }) }
      }
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

  /**
   * Which reply a chat row may show on a reload. A DISCUSSION row (a person's message and Olumi's answer to it) always keeps its own
   * stored answer, whatever version it is about: it saved nothing, so no version's coach has any bearing on it. Only a row that IS an
   * approval reply for a version follows the live rule: it shows that version's own reply (`version.coach`, for the current one; for
   * an older one its proposal's answer, only if core saved it whole), never the proposal's answer for a version core made from part of
   * it and re-ran with no reply from Olumi (the answer still describes the whole proposal). A version that cannot be told is shown
   * with no reply: nothing is restored as Olumi's that may not be.
   */
  async function answerRule(ctx, sid, v) {
    let whole = new Set()
    if (v.chat.some((c) => isApprovalReply(c) && !c.current && c.answer)) {
      try { whole = new Set(((await core('GET', `/api/scenarios/${sid}/versions`, { token: ctx.token })).versions ?? []).filter((x) => x.selected == null).map((x) => x.n)) } catch { /* unread: no older reply is restored */ }
    }
    return (c) => (!isApprovalReply(c) ? c.answer : c.current ? (v.version?.n === c.version ? v.version.coach ?? null : null) : whole.has(c.version) ? c.answer : null)
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
    const answerOf = await answerRule(ctx, sid, v)
    const lastReply = [...v.chat].reverse().find((c) => c.status !== 'pending' && !c.problem && answerOf(c))
    const note = lastReply ? noteOf(answerOf(lastReply), lastReply.cited, model.graph.nodes) : null
    const lastNote = note ? { ...note, turn_id: turnIdOf(sid, lastReply.id) } : null
    return {
      status: 200,
      body: {
        schema: 'scenario_graph.v1', scenario_id: uuid, request_id: crypto.randomUUID(), graph_present: true, graph: model.graph,
        graph_hash: model.revision, content_hash: model.scenario_revision, brief_text: v.brief, layout_present: false,
        ...(analysis ? { canonical_analysis_view: analysis } : {}),
        // A reload: the thread (olumi-core's chat) and the card still held, so the person can still confirm it.
        conversation_turns: v.chat.map((c) => ({
          turn_id: turnIdOf(sid, c.id), created_at: c.at, user_message: c.said,
          assistant_message: c.status === 'pending' ? (c.first ? DRAFT_LEAD : CHANGE_LEAD) : c.problem ? c.problem
            : isApprovalReply(c) ? [savedWords(c.version, c.current && v.version?.n === c.version ? v.version.by : null, c.kind), answerOf(c) ? coachText(answerOf(c), c.cited) : ''].filter(Boolean).join('\n')
              : answerOf(c) ? coachText(answerOf(c), c.cited) : 'Noted.',
        })),
        // Olumi's last next step, as the note it was beside its card live: the same row's reply, through the same `noteOf`.
        ...(lastNote ? { olumi_note: lastNote } : {}),
        ...(v.pending ? { proposal_fields: { version: 1, graph_hash: model.revision, proposals: [cardFor(v, turnIdOf(sid, v.pending.id))] } } : {}),
      },
    }
  }

  return { turn, graphRead, cardFor, uuidOfSid, shownOf }
}
