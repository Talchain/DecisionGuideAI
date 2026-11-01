#!/usr/bin/env node
/**
 * SPIKE (not product code): a thin BFF that lets DecisionGuideAI's existing "core route" UI talk to olumi-core.
 *
 * DGAI's client reads exactly one contract from its backend: CEE's CoreTurn (src/v5/coreTurnContract.ts) plus the
 * scenario_graph.v1 read (src/adapters/cee/scenarioGraph.ts). This shim answers those two shapes, built from
 * olumi-core's REST API v1.2 (API.md). No DGAI source file is edited.
 *
 *   POST /orchestrate/v2/turn         (vite proxies /bff/orchestrate/* here)  -> olumi-core create / messages / approve / discard
 *   POST /orchestrate/v2/turn/stream  -> 404 on purpose: DGAI falls back to the buffered turn (olumi-core has no stream)
 *   POST|GET /assist/v1/scenarios/:uuid/graph (vite proxies /bff/cee/*)       -> scenario_graph.v1 from the scenario view
 *
 * olumi-core's identity is a private-link cookie; the shim holds it server-side (OLUMI_TOKEN), so the browser needs no auth.
 * DGAI scenario ids are UUIDs (its UUID gate, bootGraphRead.ts:117); olumi-core's are s_<hex>: the shim keeps the map.
 */
import http from 'node:http'
import crypto from 'node:crypto'
import fs from 'node:fs'

const CORE = process.env.OLUMI_CORE_URL ?? 'http://127.0.0.1:3948'
const PORT = Number(process.env.SHIM_PORT ?? 3949)
const TOKEN = (process.env.OLUMI_TOKEN ?? fs.readFileSync(process.env.OLUMI_TOKEN_FILE ?? '/private/tmp/spike-core-data/token.txt', 'utf8')).trim()
const STATE_FILE = process.env.SHIM_STATE ?? '/private/tmp/spike-core-data/shim-state.json'
const LOG_FILE = process.env.SHIM_LOG ?? '/private/tmp/spike-core-data/shim.log'

// ── state: client scenario uuid <-> core scenario id; card id <-> core proposal ──────────────────────────────────────────
let state = { scenarios: {}, proposals: {} } // scenarios: uuid -> s_id ; proposals: prop_<32hex> -> { sid, core, base }
try { state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) } catch { /* fresh */ }
const save = () => { try { fs.writeFileSync(STATE_FILE, JSON.stringify(state)) } catch { /* best effort */ } }
const log = (...a) => { try { fs.appendFileSync(LOG_FILE, `${new Date().toISOString()} ${a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ')}\n`) } catch { /* */ } }

const hex = (s, n) => crypto.createHash('sha256').update(String(s)).digest('hex').slice(0, n)
const uuidOfSid = (sid) => Object.entries(state.scenarios).find(([, v]) => v === sid)?.[0] ?? null

// ── olumi-core client ────────────────────────────────────────────────────────────────────────────────────────────────────
async function core(method, path, body) {
  const r = await fetch(CORE + path, { method, headers: { cookie: `olumi=${TOKEN}`, 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw Object.assign(new Error(j.error ?? `olumi-core ${r.status}`), { status: r.status, retryAfter: r.headers.get('retry-after') })
  return j
}

// ── records -> plain words (the adapter's only authored copy) ─────────────────────────────────────────────────────────────
const byId = (form) => new Map((form?.records ?? []).map((r) => [r.id, r]))
const nameOf = (m, id) => { const r = m.get(id); return r ? (r.label ?? r.text ?? r.position ?? r.id) : id }
const CMP = { '>=': 'at least', '<=': 'at most', '>': 'more than', '<': 'less than' }
function figure(a, unit) {
  const u = unit ? ` ${unit}` : ''
  switch (a.kind) {
    case 'point': return `${a.approximate ? 'about ' : ''}${a.value}${u}`
    case 'interval': return `between ${a.low} and ${a.high}${u}${a.likely != null ? `, most likely ${a.likely}` : ''}`
    case 'derived': return 'worked out from the other figures'
    case 'asked': return `still to be given: ${a.question}`
    default: return a.reason
  }
}
function describe(rec, m) {
  const N = (id) => nameOf(m, id)
  switch (rec.family) {
    case 'quantity': return { label: rec.label, after: figure(rec.assertion, rec.unit), kind: 'quantity', family: 'quantity' }
    case 'relation': {
      if (rec.form === 'influence') return { label: `${N(rec.from)} and ${N(rec.to)}`, after: `${N(rec.from)} ${rec.direction === 'up' ? 'pushes up' : rec.direction === 'down' ? 'pushes down' : rec.direction === 'conditional' ? 'sometimes moves' : rec.direction === 'disputed' ? 'is disputed as moving' : 'may move'} ${N(rec.to)} (${rec.confidence})`, kind: 'relation', family: 'relation' }
      let how = ''
      if (rec.form === 'sum') how = rec.parts.map((p, i) => `${p.sign < 0 ? 'minus ' : i ? 'plus ' : ''}${N(p.id)}`).join(' ')
      else if (rec.form === 'product') how = rec.parts.map((p, i) => `${i ? (p.power < 0 ? 'divided by ' : 'times ') : p.power < 0 ? 'one over ' : ''}${N(p.id)}`).join(' ')
      else if (rec.form === 'effect') how = `${N(rec.base)} moved by ${rec.terms.map((t) => N(t.driver)).join(', ')}`
      else how = `${N(rec.start)} plus ${rec.inflows.map(N).join(', ') || 'nothing'} less ${rec.outflows.map(N).join(', ') || 'nothing'}`
      return { label: `How ${N(rec.defines)} is worked out`, after: `${N(rec.defines)} is ${how}`, kind: 'relation', family: 'relation' }
    }
    case 'goal': return { label: rec.label, after: rec.measure ? `${N(rec.measure.quantity)} ${CMP[rec.measure.cmp]} ${N(rec.measure.target)}` : 'Not yet measurable', kind: 'goal', family: 'goal' }
    case 'limit': return { label: rec.label, after: rec.measure ? `${N(rec.measure.quantity)} stays ${CMP[rec.measure.cmp]} ${N(rec.measure.bound)}` : 'Not yet measurable', kind: 'record', family: 'limit' }
    case 'preference': return { label: `Prefers ${rec.direction} ${N(rec.quantity)}`, after: `${rec.direction === 'lower' ? 'Lower' : 'Higher'} ${N(rec.quantity)} is better`, kind: 'record', family: 'preference' }
    case 'option': return { label: rec.label, after: rec.carry_on ? 'Carrying on as you are' : `An option${rec.sets.length ? `: sets ${rec.sets.map((s) => `${N(s.quantity)} to ${N(s.to)}`).join(', ')}` : ''}`, kind: 'option', family: 'option' }
    case 'risk': return { label: rec.label, after: `Could push ${N(rec.effect_on)} ${rec.direction}`, kind: 'risk', family: 'risk' }
    case 'claim': return { label: rec.text, after: 'A claim in the model', kind: 'record', family: 'claims' }
    case 'evidence': return { label: rec.text, after: `Evidence${rec.source ? ` (${rec.source})` : ''} that ${rec.bears === 'informs' ? 'informs' : rec.bears} the model`, kind: 'record', family: 'evidence' }
    case 'assumption': return { label: rec.text, after: rec.applied ? 'An assumption the model applies' : 'An assumption noted, not applied', kind: 'record', family: 'assumptions' }
    case 'dissent': return { label: `${rec.holder}: ${rec.position}`, after: `${rec.holder} disagrees: ${rec.position}`, kind: 'record', family: 'dissent' }
    case 'condition': return { label: rec.text, after: rec.kind === 'prerequisite' ? 'A condition this depends on' : 'A challenge to the model', kind: 'record', family: 'conditions' }
    case 'left_out': return { label: rec.text, after: rec.why, kind: 'left_out', family: 'left_out' }
    default: return { label: rec.id, after: null, kind: 'record', family: undefined }
  }
}
/** CEE's reading-card group, which olumi-core does not send: a product rule the adapter has to make (see report). */
function groupOf(rec) {
  if (rec.family === 'left_out') return 'left_out'
  const by = rec.origin?.by
  if (by === 'structure') return 'other'
  if (rec.family === 'quantity' && (rec.assertion.kind === 'derived' || rec.assertion.kind === 'asked')) return 'other'
  if (rec.family === 'relation' && rec.form !== 'influence') return 'other'
  return by === 'person' ? 'used' : 'inferred'
}
function rowFor(rec, action, m, before) {
  const d = describe(rec, m)
  const by = rec.origin?.by
  const quote = by === 'person' && rec.origin.quote ? ` You said: “${rec.origin.quote}”` : ''
  const basis = by === 'olumi' && rec.origin.basis ? ` Olumi’s reason: ${rec.origin.basis}` : ''
  return {
    id: rec.id, kind: d.kind, action, label: d.label.slice(0, 200) || rec.id,
    before: before ?? null, after: d.after === null ? null : `${d.after}.${quote}${basis}`.replace(/\.\./g, '.'),
    author: by === 'person' ? 'person' : 'olumi', group: groupOf(rec), family: d.family,
    ...(by === 'structure' ? { structure: true } : {}),
    ...(rec.family === 'quantity' && rec.assertion.kind === 'asked' ? { asked: true } : {}),
  }
}
function changeRows(view) {
  const p = view.pending
  const now = byId(p.form), was = byId(view.version?.form)
  const rows = []
  for (const id of p.changes.added) if (now.has(id)) rows.push(rowFor(now.get(id), 'add', now))
  for (const id of p.changes.changed) if (now.has(id)) rows.push(rowFor(now.get(id), 'change', now, was.has(id) ? describe(was.get(id), was).after : null))
  for (const id of p.changes.removed) if (was.has(id)) rows.push(rowFor(was.get(id), 'remove', was, describe(was.get(id), was).after))
  return rows
}

// ── the saved/pending model as the graph the canvas draws (the {id, kind, label} floor; no projector) ──────────────────────
function graphOf(form) {
  const m = byId(form)
  const recs = form.records
  const targets = new Set(recs.flatMap((r) => (r.family === 'goal' || r.family === 'limit') && r.measure ? [r.measure.target ?? r.measure.bound, r.measure.quantity] : []))
  const setTo = new Set(recs.flatMap((r) => (r.family === 'option' ? r.sets.map((s) => s.to) : [])))
  const nodes = [], seen = new Set()
  const add = (id, kind, label) => { if (!seen.has(id)) { seen.add(id); nodes.push({ id, kind, label }) } }
  for (const r of recs) {
    if (r.family === 'option') add(r.id, 'option', r.label)
    else if (r.family === 'goal') add(r.id, 'goal', r.label)
    else if (r.family === 'risk') add(r.id, 'risk', r.label)
    else if (r.family === 'quantity' && r.role !== 'derived' && r.assertion.kind !== 'derived' && r.origin.by !== 'structure' && !targets.has(r.id) && !setTo.has(r.id)) add(r.id, 'factor', r.label)
  }
  const edges = recs.flatMap((r) => (r.family === 'relation' && r.form === 'influence' && seen.has(r.from) && seen.has(r.to) ? [{ id: r.id, from: r.from, to: r.to }] : []))
  return { nodes, edges, m }
}
function canonicalOf(form) {
  // Only the qualitative families, read by the notes layer (noteRecordsModel.ts); the rest stays with the engine.
  const pick = (f, shape) => form.records.filter((r) => r.family === f).map((r) => ({ id: r.id, ...shape(r), author: r.origin.by === 'person' ? 'person' : 'olumi', ...(r.origin.by === 'person' ? { quote: r.origin.quote } : {}) }))
  return {
    version: 'canonical.v1',
    quantities: [],
    claims: pick('claim', (r) => ({ text: r.text, concerns: r.concerns })),
    assumptions: pick('assumption', (r) => ({ text: r.text, applied: r.applied, concerns: r.concerns })),
    conditions: pick('condition', (r) => ({ text: r.text, kind: r.kind, concerns: r.concerns })),
    left_out: pick('left_out', (r) => ({ text: r.text, why: r.why, question: r.question, concerns: r.concerns })),
    preferences: pick('preference', (r) => ({ quantity: r.quantity, direction: r.direction })),
    dissent: pick('dissent', (r) => ({ holder: r.holder, position: r.position, concerns: r.concerns })),
    evidence: pick('evidence', (r) => ({ text: r.text, source: r.source, bears: r.bears, concerns: r.concerns })),
  }
}

// ── identity of "what is saved/proposed now": the 16-hex freshness token and the 64-hex content identity ─────────────────
const stamp = (view) => `${view.id}|${view.version?.id ?? 'none'}|${view.pending?.id ?? 'none'}`
const rev16 = (view) => hex(stamp(view), 16)
const rev64 = (view) => hex(stamp(view) + '|content', 64)
const shownForm = (view) => (view.pending ?? view.version)?.form ?? null

function modelOf(view) {
  const form = shownForm(view)
  if (!form) return null
  const { nodes, edges } = graphOf(form)
  return { graph: { nodes, edges, living_model: { model_program: 'v1', canonical: canonicalOf(form) } }, revision: rev16(view), scenario_revision: rev64(view) }
}

const propIdOf = (sid, coreId) => `prop_${hex(`${sid}:${coreId}`, 32)}`
function cardFor(view, turnId) {
  const p = view.pending
  const pid = propIdOf(view.id, p.id)
  state.proposals[pid] = { sid: view.id, core: p.id, base: p.base }
  save()
  return {
    proposal_id: pid, issued_turn_id: turnId, revision: rev16(view), digest: hex(`${pid}|${JSON.stringify(p.changes)}`, 32),
    approve_action: { id: `agent-approve-proposal:${pid}`, label: 'Looks right', message: 'Looks right. Confirm it.' },
    decline_action: { id: `agent-decline-proposal:${pid}`, label: 'Not now', message: 'Not now.' },
    fields: [], missing: [], adds: [],
    reading: p.source === 'draft',
    changes: changeRows(view),
  }
}

// ── words: the coach reply and the Run's facts, exactly as olumi-core wrote them ──────────────────────────────────────────
function coachText(shown, cited) {
  const c = shown?.coach
  if (!c) return ''
  const facts = (shown.facts ?? []).map((f) => `• ${f.text}`).join('\n')
  return [c.answer, ...c.why, `Next (${c.next.move.replace(/_/g, ' ')}): ${c.next.text}`, facts ? `\nWhat the Run found:\n${facts}` : ''].filter(Boolean).join('\n')
}

function turnBody(view, { turnId, text, withCard, receipt }) {
  return {
    turn_id: turnId, assistant_text: text, model: modelOf(view),
    cards: withCard && view.pending ? [cardFor(view, turnId)] : [],
    notes: [], run: null, analysis_result: null, analysis_state: null,
    model_program: { version: 'v1' },
    receipts: receipt ? [{ kind: 'unversioned', scenario_revision: rev64(view), run_id: null, source_turn_id: turnId, authorised_by: 'person' }] : [],
    paused: null, action_bar: null, error: null,
  }
}
const errorTurn = (turnId, code, message, retry) => ({ turn_id: turnId ?? null, assistant_text: '', model: null, cards: [], notes: [], run: null, receipts: [], error: { code, message, retry_safe: retry, nothing_saved: true } })

// ── the turn ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
async function turn(body) {
  const turnId = body.turn_id ?? crypto.randomUUID()
  const uuid = body.scenario_id
  const chip = body.chip?.id ?? null
  let sid = state.scenarios[uuid]
  const pidOf = (prefix) => (typeof chip === 'string' && chip.startsWith(prefix) ? chip.slice(prefix.length) : null)

  const approve = pidOf('agent-approve-proposal:')
  if (approve) {
    const hold = state.proposals[approve]
    if (!hold) return errorTurn(turnId, 'unknown_proposal', 'That card is no longer held.', false)
    const r = await core('POST', `/api/proposals/${hold.core}/approve`, { base: hold.base })
    const view = await core('GET', `/api/scenarios/${hold.sid}`)
    return turnBody(view, { turnId, text: coachText(view.version, view.chat) || `Saved as version ${r.n}.`, withCard: false, receipt: true })
  }
  const decline = pidOf('agent-decline-proposal:')
  if (decline) {
    const hold = state.proposals[decline]
    if (!hold) return errorTurn(turnId, 'unknown_proposal', 'That card is no longer held.', false)
    await core('POST', `/api/proposals/${hold.core}/discard`)
    const view = await core('GET', `/api/scenarios/${hold.sid}`)
    return turnBody(view, { turnId, text: 'Okay, I have left it as it was.', withCard: false })
  }
  if (body.kind === 'system_event') {
    if (!sid) return errorTurn(turnId, 'no_model', 'There is no model yet.', false)
    const view = await core('GET', `/api/scenarios/${sid}`)
    return turnBody(view, { turnId, text: '', withCard: true })
  }

  const text = String(body.message ?? '').trim()
  if (text.length === 0) return errorTurn(turnId, 'empty', 'Say what you are deciding.', false)
  if (!sid) {
    const made = await core('POST', '/api/scenarios', { brief: text })
    sid = made.scenario
    state.scenarios[uuid] = sid
    save()
    const view = await core('GET', `/api/scenarios/${sid}`)
    return turnBody(view, { turnId, text: 'Here is your situation as I understood it. Check it, then confirm or tell me what to change.', withCard: true })
  }
  const r = await core('POST', `/api/scenarios/${sid}/messages`, { text })
  const view = await core('GET', `/api/scenarios/${sid}`)
  if (r.discussion) {
    const last = [...view.chat].reverse().find((c) => c.answer)
    return turnBody(view, { turnId, text: last ? coachText({ coach: last.answer, facts: [] }) : 'Noted.', withCard: false })
  }
  return turnBody(view, { turnId, text: 'Here is what I would change. Check it, then confirm.', withCard: true })
}

// ── the saved-graph read (scenario_graph.v1) ─────────────────────────────────────────────────────────────────────────────
async function graphRead(uuid) {
  const sid = state.scenarios[uuid]
  if (!sid) return { schema: 'scenario_graph.v1', scenario_id: uuid, graph_present: false, graph: null }
  const view = await core('GET', `/api/scenarios/${sid}`)
  const model = modelOf(view)
  if (!model) return { schema: 'scenario_graph.v1', scenario_id: uuid, graph_present: false, graph: null }
  return {
    schema: 'scenario_graph.v1', scenario_id: uuid, request_id: crypto.randomUUID(), graph_present: true, graph: model.graph,
    graph_hash: model.revision, content_hash: model.scenario_revision, brief_text: view.brief, layout_present: false,
  }
}

// ── http ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const readBody = async (req) => { const c = []; for await (const x of req) c.push(x); const s = Buffer.concat(c).toString('utf8'); try { return s ? JSON.parse(s) : {} } catch { return {} } }
const send = (res, status, obj) => { res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(obj)) }

http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://x')
  const path = url.pathname
  try {
    if (req.method === 'POST' && path === '/orchestrate/v2/turn') {
      const body = await readBody(req)
      log('TURN <-', { kind: body.kind, scenario_id: body.scenario_id, source: body.source, chip: body.chip?.id, msg: String(body.message ?? '').slice(0, 80), approve_ids: body.approve_ids })
      let out
      try { out = await turn(body) } catch (e) { log('TURN error', e.message); out = errorTurn(body.turn_id, e.status === 429 ? 'rate_limited' : 'olumi_core_error', e.message, e.status !== 400) }
      log('TURN ->', { cards: out.cards?.length, text: String(out.assistant_text).slice(0, 80), error: out.error?.code })
      return send(res, 200, out)
    }
    const g = path.match(/^\/assist\/v1\/scenarios\/([^/]+)\/graph$/)
    if (g) { log('GRAPH', g[1]); return send(res, 200, await graphRead(decodeURIComponent(g[1]))) }
    log('404', req.method, path)
    return send(res, 404, { error: 'Not found' })
  } catch (e) {
    log('500', req.method, path, e.stack ?? e.message)
    return send(res, 500, { error: String(e.message) })
  }
}).listen(PORT, '127.0.0.1', () => console.log(`olumi-core shim on ${PORT} -> ${CORE}`))
