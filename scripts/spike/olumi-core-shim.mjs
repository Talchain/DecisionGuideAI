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
let state = { scenarios: {}, proposals: {}, chatTurns: {} } // scenarios: uuid -> s_id ; proposals: prop_<32hex> -> { sid, core, base }
try { state = { chatTurns: {}, ...JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) } } catch { /* fresh */ }
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

// ── the saved/pending model as the graph the canvas draws ────────────────────────────────────────────────────────────────
// olumi-core sends records; DGAI's cards read CEE's graph projection (nodes with provenance, display_value, observed_state,
// interventions). This is a small projector written from the served fixtures (src/canvas/nodes/__tests__/fixtures/served-*):
// it is the part of the adapter that has no shortcut, and it is only as faithful as these rules.
const valueOf = (q) => (q?.assertion?.kind === 'point' ? q.assertion.value : q?.assertion?.kind === 'interval' ? (q.assertion.likely ?? (q.assertion.low + q.assertion.high) / 2) : null)
const fmt = (q) => (q ? figure(q.assertion, q.unit) : '')
function graphOf(form) {
  const m = byId(form)
  const recs = form.records
  const goals = recs.filter((r) => r.family === 'goal')
  const measured = new Set(recs.flatMap((r) => (r.family === 'goal' || r.family === 'limit') && r.measure ? [r.measure.target ?? r.measure.bound] : []))
  const setTo = new Set(recs.flatMap((r) => (r.family === 'option' ? r.sets.map((s) => s.to) : [])))
  const prov = (r) => (r.origin?.by === 'person' ? 'from_brief' : 'ai_inferred')
  const quote = (r) => (r.origin?.by === 'person' && r.origin.quote ? { source_quote: r.origin.quote } : {})
  const partsOf = (id) => recs.flatMap((r) => (r.family === 'relation' && r.form !== 'influence' && r.defines === id
    ? r.form === 'sum' || r.form === 'product' ? r.parts.map((p) => p.id) : r.form === 'effect' ? [r.base, ...r.terms.flatMap((t) => [t.driver, t.coefficient])] : [r.start, ...r.inflows, ...r.outflows] : []))
  const nodes = [], edges = [], seen = new Set()
  const add = (n) => { if (!seen.has(n.id)) { seen.add(n.id); nodes.push(n) } }
  const link = (from, to, extra = {}) => edges.push({ id: `${from}__${to}`, from, to, origin: 'model_program:calculation', provenance: { source: 'brief_extraction' }, effect_direction: 'positive', exists_probability: 1, ...extra })
  add({ id: 'mp:decision', ref: 'D1', kind: 'decision', label: form.question })
  let o = 0, f = 0, c = 0, g = 0
  for (const r of recs) {
    if (r.family === 'option' && r.status !== 'removed') {
      const interventions = Object.fromEntries(r.sets.map((s) => { const qs = m.get(s.quantity), to = m.get(s.to); const v = valueOf(to); return [s.quantity, { unit: qs?.unit ?? null, value: v, source: r.origin.by === 'person' ? 'brief_extraction' : 'cee_hypothesis', display: `${v} ${qs?.unit ?? ''}`.trim(), from_period: typeof s.starts_after === 'number' ? s.starts_after : 0, source_words: `Set by ‘${r.label}’, ${r.origin.by === 'person' ? 'from your brief' : 'Olumi’s figure'}` }] }))
      add({ id: r.id, ref: `O${++o}`, kind: 'option', label: r.label, provenance: prov(r), ...quote(r), ...(r.origin.by === 'olumi' ? { proposed_by: 'olumi' } : {}), interventions, analysis_participation: r.status === 'live' ? 'included' : 'excluded' })
      link('mp:decision', r.id)
      for (const s of r.sets) link(r.id, s.quantity)
    } else if (r.family === 'risk') add({ id: r.id, ref: `R${++c}`, kind: 'risk', label: r.label, provenance: prov(r), ...quote(r) })
  }
  for (const r of recs) {
    if (r.family !== 'quantity' || setTo.has(r.id) || measured.has(r.id)) continue
    const derived = r.role === 'derived' || r.assertion.kind === 'derived'
    const v = valueOf(r)
    add({ id: r.id, ref: `${derived ? 'OC' : 'F'}${++f}`, kind: derived ? 'outcome' : 'factor', label: r.label, provenance: prov(r), ...quote(r),
      ...(r.origin.by === 'structure' ? { value_basis: { kind: 'structure', words: 'Fixed by how the model is built' } } : derived ? { value_basis: { kind: 'worked_out', from: partsOf(r.id), words: `Worked out from ${partsOf(r.id).map((i) => nameOf(m, i)).join(' and ')}` } } : {}),
      display_value: derived ? `Worked out from ${partsOf(r.id).map((i) => nameOf(m, i)).join(' and ')}` : fmt(r),
      ...(v !== null ? { observed_state: { unit: r.unit, value: v, raw_value: v, source: r.origin.by === 'person' ? 'brief_extraction' : 'cee_hypothesis' } } : {}),
      analysis_participation: 'included' })
  }
  for (const r of goals) {
    const target = m.get(r.measure?.target)
    add({ id: r.id, ref: `G${++g}`, kind: 'goal', label: r.label, provenance: prov(r), ...quote(r), display_value: r.measure ? `${r.measure.cmp} ${valueOf(target)} ${target?.unit ?? ''}`.trim() : r.label,
      goal_direction: r.measure?.cmp, goal_threshold_raw: valueOf(target), goal_threshold_unit: target?.unit ?? null, goal_threshold_frame: r.measure?.frame ?? 'level', goal_measure_by: r.measure?.measure_by ?? 'person', analysis_participation: 'included' })
    if (r.measure && seen.has(r.measure.quantity)) link(r.measure.quantity, r.id, { provenance: { source: 'brief_extraction', definitional: true } })
  }
  for (const r of recs) {
    if (r.family !== 'relation' || r.form === 'influence') continue
    for (const part of partsOf(r.defines)) if (seen.has(part) && seen.has(r.defines)) link(part, r.defines, { provenance: { source: 'brief_extraction', definitional: true } })
  }
  for (const r of recs) if (r.family === 'relation' && r.form === 'influence' && seen.has(r.from) && seen.has(r.to)) link(r.from, r.to, { id: r.id, effect_direction: r.direction === 'down' ? 'negative' : 'positive' })
  const uniq = new Map(edges.map((e) => [e.id, e]))
  return { nodes, edges: [...uniq.values()], m }
}
function canonicalOf(form) {
  const pick = (f, shape) => form.records.filter((r) => r.family === f).map((r) => ({ id: r.id, ...shape(r), author: r.origin.by === 'person' ? 'person' : r.origin.by, party: r.origin.party ?? null, quote: r.origin.by === 'person' ? r.origin.quote : null, approval: 'proposed' }))
  return {
    version: 'canonical.v1',
    quantities: pick('quantity', (r) => { const a = r.assertion; return { kind: r.role === 'coefficient' ? 'coefficient' : 'fact', label: r.label, unit: r.unit, status: a.kind === 'point' || a.kind === 'interval' ? 'known' : a.kind, value: a.kind === 'point' ? a.value : null, low: a.kind === 'interval' ? a.low : null, high: a.kind === 'interval' ? a.high : null, range_kind: a.kind === 'interval' ? a.range_kind : null, question: a.kind === 'asked' ? a.question : null, basis: r.origin.basis ?? null, direction: r.direction, floor: r.domain?.lower ?? null, ceiling: r.domain?.upper ?? null, author_id: null } }),
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
function cardFor(view, liveTurnId) {
  const p = view.pending
  const turnId = (state.chatTurns[p.id] ??= liveTurnId)
  const pid = propIdOf(view.id, p.id)
  const rows = changeRows(view)
  state.proposals[pid] = { sid: view.id, core: p.id, base: p.base, ids: rows.map((r) => r.id) }
  save()
  return {
    proposal_id: pid, issued_turn_id: turnId, revision: rev16(view), digest: hex(`${pid}|${JSON.stringify(p.changes)}`, 32),
    approve_action: { id: `agent-approve-proposal:${pid}`, label: 'Looks right', message: 'Looks right. Confirm it.' },
    decline_action: { id: `agent-decline-proposal:${pid}`, label: 'Not now', message: 'Not now.' },
    fields: [], missing: [], adds: [],
    reading: p.source === 'draft',
    changes: rows,
  }
}

// ── words: the coach reply and the Run's facts, exactly as olumi-core wrote them ──────────────────────────────────────────
function coachText(shown, cited) {
  const c = shown?.coach
  if (!c) return ''
  const facts = (shown.facts ?? []).map((f) => `• ${f.value}: ${f.text.replace(/ It leaves out:.*$/, '')}`).join('\n')
  return [c.answer, ...c.why, `Next (${c.next.move.replace(/_/g, ' ')}): ${c.next.text}`, facts ? `\nWhat the Run found:\n${facts}` : ''].filter(Boolean).join('\n')
}

function turnBody(view, { turnId, text, withCard, receipt }) {
  return {
    turn_id: turnId, assistant_text: text, model: modelOf(view),
    cards: withCard && view.pending ? [cardFor(view, turnId)] : [],
    notes: [],
    // A turn that saved a version with a Run says so: DGAI adopts the Run's served view only when the turn names the Run id
    // its read-after-write must find (readAfterWrite.ts). A turn with nothing saved carries no Run.
    run: receipt && view.version ? { run_key: runIdOf(view.version), run_id: runIdOf(view.version), computed_against: rev16(view), state: { kind: 'current', computed_at: view.version.at } } : null,
    analysis_result: null, analysis_state: null,
    model_program: { version: 'v1' },
    receipts: receipt ? [{ kind: 'unversioned', scenario_revision: rev64(view), run_id: null, source_turn_id: turnId, authorised_by: 'person' }] : [],
    paused: null, action_bar: null, error: null,
  }
}
const errorTurn = (turnId, code, message, retry) => ({ turn_id: turnId ?? null, assistant_text: '', model: null, cards: [], notes: [], run: null, receipts: [], error: { code, message, retry_safe: retry, nothing_saved: true } })

const DRAFT_LEAD = 'Here is your situation as I understood it. Check it, then confirm or tell me what to change.'
const CHANGE_LEAD = 'Here is what I would change. Check it, then confirm.'
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
    // olumi-core approves a whole proposal (POST /api/proposals/:id/approve {base}); there is no record subset. A partial tick is
    // refused here, nothing saved, and the card stays held: the honest edge of this route (needs a core change).
    if (Array.isArray(body.approve_ids) && body.approve_ids.length > 0 && !hold.ids.every((id) => body.approve_ids.includes(id))) {
      const view = await core('GET', `/api/scenarios/${hold.sid}`)
      return turnBody(view, { turnId, text: `I can only confirm the whole card at the moment, not ${body.approve_ids.length} of ${hold.ids.length} rows. Nothing has been saved. Use “Confirm whole card”, or tell me what to change.`, withCard: true })
    }
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
    return turnBody(view, { turnId, text: DRAFT_LEAD, withCard: true })
  }
  const r = await core('POST', `/api/scenarios/${sid}/messages`, { text })
  const view = await core('GET', `/api/scenarios/${sid}`)
  if (r.discussion) {
    const last = [...view.chat].reverse().find((c) => c.answer)
    return turnBody(view, { turnId, text: last ? coachText({ coach: last.answer, facts: [] }) : 'Noted.', withCard: false })
  }
  return turnBody(view, { turnId, text: CHANGE_LEAD, withCard: true })
}

// ── the Run, as DGAI's results surface reads it: canonical_analysis_view.v1 from olumi-core's Run facts ───────────────────
// Path A of the results map: text-only chances, drivers, the "most likely" sentence and notes, in olumi-core's own words. Not
// bands (olumi-core serves no structured range until API v1.3) and not win shares. Only for an APPROVED version: a proposal has
// no Run result worth showing as the model's.
const runIdOf = (v) => `mp_run_${v.n}_${hex(v.id, 12)}`
const clip = (t) => t.replace(/ It leaves out:.*$/, '')
function analysisViewOf(view) {
  const v = view.version
  if (!v || !v.facts?.length) return null
  const m = byId(v.form)
  const live = v.form.records.filter((r) => r.family === 'option' && r.status === 'live')
  const goal = v.form.records.find((r) => r.family === 'goal')
  const chance = (o) => v.facts.find((f) => f.about?.kind === 'chance' && f.about.option === o.id && (!goal || f.about.goal === goal.id))
  const driver = (o) => v.facts.find((f) => f.about?.kind === 'driver' && f.about.option === o.id)
  const leaves = v.facts.map((f) => /It leaves out: (.*)$/.exec(f.text)?.[1]).find(Boolean)
  const most = v.facts.find((f) => f.about?.kind === 'most_likely' || f.about?.kind === 'none_clearly')
  return {
    schema: 'canonical_analysis_view.v1', source: 'stored_run_facts',
    run: { run_id: runIdOf(v), graph_hash_at_run: rev16(view), computed_at: v.at },
    staleness: { stale: false, revision: null, run_revision: null, basis: 'analysis_graph_hash_interim', reason: null, limitation: 'Hash equality cannot detect brief, framing or stage changes.' },
    leader_licence: 'withheld',
    options: live.map((o) => {
      const c = chance(o), d = driver(o)
      return {
        option_id: o.id,
        cell: c ? { kind: 'figure', display: c.value, face: `${c.value}: ${clip(c.text)}` } : { kind: 'none' },
        main_driver: d ? { kind: 'available', driver: { id: d.id, ...(d.about ?? {}) }, detail: `${d.value}: ${clip(d.text)}` } : { kind: 'none_licensed', reason: 'No figure moves this option’s chance enough to name one.' },
      }
    }),
    goal_chance: { chance_words: goal ? `chance of ‘${goal.label}’` : undefined, ...(leaves ? { notes: [`This leaves out: ${leaves}`] } : {}), waits_on: [] },
    leader: { licence: 'withheld', option_id: null, ...(most ? { words: clip(most.text) } : {}) },
  }
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
    ...(analysisViewOf(view) ? { canonical_analysis_view: analysisViewOf(view) } : {}),
    // A reload: the thread (olumi-core's chat) and the card still held (a pending proposal), so the person can still confirm it.
    conversation_turns: view.chat.map((c) => ({
      turn_id: state.chatTurns[c.id] ?? `core_${c.id}`, created_at: c.at, user_message: c.said,
      assistant_message: c.status === 'pending' ? (c.first ? DRAFT_LEAD : CHANGE_LEAD) : c.answer ? [c.answer.answer, ...c.answer.why, `Next (${c.answer.next.move.replace(/_/g, ' ')}): ${c.answer.next.text}`].join('\n') : 'Noted.',
    })),
    ...(view.pending ? { proposal_fields: { version: 1, graph_hash: rev16(view), proposals: [cardFor(view, `core_${view.pending.id}`)] } } : {}),
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
