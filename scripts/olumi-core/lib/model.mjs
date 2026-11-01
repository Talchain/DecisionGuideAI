/**
 * olumi-core's records as the three things DGAI's canvas reads: the nodes and edges its cards draw (`graphOf`), the
 * canonical model beside them (`canonicalOf`), and the Run as `canonical_analysis_view.v1` (`analysisViewOf`).
 * Rules come from the served fixtures (src/canvas/nodes/__tests__/fixtures/served-*), so this is only as faithful as they are.
 * Facts are read by their structured `about` (API v1.4), never from their text.
 */
import { byId, figure, nameOf, partsOf } from './words.mjs'
import { rev16, rev64, runIdOf } from './ids.mjs'

const valueOf = (q) => (q?.assertion?.kind === 'point' ? q.assertion.value : q?.assertion?.kind === 'interval' ? (q.assertion.likely ?? (q.assertion.low + q.assertion.high) / 2) : null)
const fmt = (q) => (q ? figure(q.assertion, q.unit) : '')

export function graphOf(form) {
  const m = byId(form)
  const recs = form.records
  const goals = recs.filter((r) => r.family === 'goal')
  const measured = new Set(recs.flatMap((r) => (r.family === 'goal' || r.family === 'limit') && r.measure ? [r.measure.target ?? r.measure.bound] : []))
  const setTo = new Set(recs.flatMap((r) => (r.family === 'option' ? r.sets.map((s) => s.to) : [])))
  const prov = (r) => (r.origin?.by === 'person' ? 'from_brief' : 'ai_inferred')
  const quote = (r) => (r.origin?.by === 'person' && r.origin.quote ? { source_quote: r.origin.quote } : {})
  const nodes = [], edges = [], seen = new Set()
  const add = (n) => { if (!seen.has(n.id)) { seen.add(n.id); nodes.push(n) } }
  const link = (from, to, extra = {}) => edges.push({ id: `${from}__${to}`, from, to, origin: 'model_program:calculation', provenance: { source: 'brief_extraction' }, effect_direction: 'positive', exists_probability: 1, ...extra })
  add({ id: 'mp:decision', ref: 'D1', kind: 'decision', label: form.question })
  let o = 0, f = 0, c = 0, g = 0
  for (const r of recs) {
    if (r.family === 'option' && r.status !== 'removed') {
      const interventions = Object.fromEntries(r.sets.map((s) => {
        const qs = m.get(s.quantity), to = m.get(s.to), v = valueOf(to)
        return [s.quantity, { unit: qs?.unit ?? null, value: v, source: r.origin.by === 'person' ? 'brief_extraction' : 'cee_hypothesis', display: `${v} ${qs?.unit ?? ''}`.trim(), from_period: typeof s.starts_after === 'number' ? s.starts_after : 0, source_words: `Set by ‘${r.label}’, ${r.origin.by === 'person' ? 'from your brief' : 'Olumi’s figure'}` }]
      }))
      add({ id: r.id, ref: `O${++o}`, kind: 'option', label: r.label, provenance: prov(r), ...quote(r), ...(r.origin.by === 'olumi' ? { proposed_by: 'olumi' } : {}), interventions, analysis_participation: r.status === 'live' ? 'included' : 'excluded' })
      link('mp:decision', r.id)
      for (const s of r.sets) link(r.id, s.quantity)
    } else if (r.family === 'risk') add({ id: r.id, ref: `R${++c}`, kind: 'risk', label: r.label, provenance: prov(r), ...quote(r) })
  }
  for (const r of recs) {
    if (r.family !== 'quantity' || setTo.has(r.id) || measured.has(r.id)) continue
    const derived = r.role === 'derived' || r.assertion.kind === 'derived'
    const v = valueOf(r)
    const interval = r.assertion.kind === 'interval' ? r.assertion : null
    const parts = derived ? partsOf(recs, r.id) : []
    add({
      id: r.id, ref: `${derived ? 'OC' : 'F'}${++f}`, kind: derived ? 'outcome' : 'factor', label: r.label, provenance: prov(r), ...quote(r),
      ...(r.origin.by === 'structure' ? { value_basis: { kind: 'structure', words: 'Fixed by how the model is built' } }
        : derived ? { value_basis: { kind: 'worked_out', from: parts, words: `Worked out from ${parts.map((i) => nameOf(m, i)).join(' and ')}` } } : {}),
      display_value: derived ? `Worked out from ${parts.map((i) => nameOf(m, i)).join(' and ')}` : fmt(r),
      // The person's stated range, as DGAI's own range line reads it (`factorStatedRange.ts`): the likeliest value stays the figure.
      ...(v !== null ? { observed_state: { unit: r.unit, value: v, raw_value: v, source: r.origin.by === 'person' ? 'brief_extraction' : 'cee_hypothesis',
        ...(interval ? { range: { low: interval.low, high: interval.high, source: r.origin.by === 'person' ? 'user_override' : 'cee_hypothesis', meaning: interval.range_kind } } : {}) } } : {}),
      analysis_participation: 'included',
    })
  }
  for (const r of goals) {
    const target = m.get(r.measure?.target)
    add({ id: r.id, ref: `G${++g}`, kind: 'goal', label: r.label, provenance: prov(r), ...quote(r), display_value: r.measure ? `${r.measure.cmp} ${valueOf(target)} ${target?.unit ?? ''}`.trim() : r.label,
      goal_direction: r.measure?.cmp, goal_threshold_raw: valueOf(target), goal_threshold_unit: target?.unit ?? null, goal_threshold_frame: r.measure?.frame ?? 'level', goal_measure_by: r.measure?.measure_by ?? 'person', analysis_participation: 'included' })
    if (r.measure && seen.has(r.measure.quantity)) link(r.measure.quantity, r.id, { provenance: { source: 'brief_extraction', definitional: true } })
  }
  for (const r of recs) {
    if (r.family !== 'relation' || r.form === 'influence') continue
    for (const part of partsOf(recs, r.defines)) if (seen.has(part) && seen.has(r.defines)) link(part, r.defines, { provenance: { source: 'brief_extraction', definitional: true } })
  }
  for (const r of recs) if (r.family === 'relation' && r.form === 'influence' && seen.has(r.from) && seen.has(r.to)) link(r.from, r.to, { id: r.id, effect_direction: r.direction === 'down' ? 'negative' : 'positive' })
  const uniq = new Map(edges.map((e) => [e.id, e]))
  return { nodes, edges: [...uniq.values()] }
}

/** The canonical model beside the graph (`living_model.canonical`): `approved` is the approval stamp every record carries. */
export function canonicalOf(form, approved) {
  const approval = approved ? 'approved' : 'proposed'
  const pick = (f, shape) => form.records.filter((r) => r.family === f).map((r) => ({ id: r.id, ...shape(r), author: r.origin.by === 'person' ? 'person' : r.origin.by, party: r.origin.party ?? null, quote: r.origin.by === 'person' ? r.origin.quote : null, approval }))
  return {
    version: 'canonical.v1',
    quantities: pick('quantity', (r) => {
      const a = r.assertion
      return { kind: r.role === 'coefficient' ? 'coefficient' : 'fact', label: r.label, unit: r.unit, status: a.kind === 'point' || a.kind === 'interval' ? 'known' : a.kind, value: valueOf(r), low: a.kind === 'interval' ? a.low : null, high: a.kind === 'interval' ? a.high : null, range_kind: a.kind === 'interval' ? a.range_kind : null, question: a.kind === 'asked' ? a.question : null, basis: r.origin.basis ?? null, direction: r.direction, floor: r.domain?.lower ?? null, ceiling: r.domain?.upper ?? null, author_id: null }
    }),
    claims: pick('claim', (r) => ({ text: r.text, concerns: r.concerns })),
    assumptions: pick('assumption', (r) => ({ text: r.text, applied: r.applied, concerns: r.concerns })),
    conditions: pick('condition', (r) => ({ text: r.text, kind: r.kind, concerns: r.concerns })),
    left_out: pick('left_out', (r) => ({ text: r.text, why: r.why, question: r.question, concerns: r.concerns })),
    preferences: pick('preference', (r) => ({ quantity: r.quantity, direction: r.direction })),
    dissent: pick('dissent', (r) => ({ holder: r.holder, position: r.position, concerns: r.concerns })),
    evidence: pick('evidence', (r) => ({ text: r.text, source: r.source, bears: r.bears, concerns: r.concerns })),
  }
}

/** What is shown now: the held proposal if there is one, else the saved version. */
export const shownOf = (view) => view.pending ?? view.version ?? null

export function modelOf(view) {
  const shown = shownOf(view)
  if (!shown) return null
  const { nodes, edges } = graphOf(shown.form)
  return {
    graph: { nodes, edges, living_model: { model_program: 'v1', canonical: canonicalOf(shown.form, shown === view.version) } },
    revision: rev16(view), scenario_revision: rev64(view),
  }
}

// ── the Run, as DGAI's results surface reads it ─────────────────────────────────────────────────────────────────────────
const sentence = (t) => (/[.!?]$/.test(t) ? t : `${t}.`)

/** What the goal's measure leaves out, said once, from the goal's own exclusions (records, not fact text). */
export function leftOutOf(form, goalId) {
  const m = byId(form)
  const goal = form.records.find((r) => r.family === 'goal' && (goalId ? r.id === goalId : true))
  return (goal?.measure?.exclusions ?? []).map((id) => m.get(id)).filter((r) => r?.family === 'left_out').map((r) => r.text.replace(/\.$/, ''))
}

/** A fact's sentence without the repeat of what the goal leaves out, which is said once as a note: stripped only when it matches the records exactly. */
export function sayFact(text, leaves) {
  if (leaves.length === 0) return text
  const tail = ` It leaves out: ${leaves.join('; ')}.`
  return text.endsWith(tail) ? text.slice(0, -tail.length) : text
}

export function analysisViewOf(view, hash) {
  const v = view.version
  if (!v || !v.facts?.length) return null
  const m = byId(v.form)
  const live = v.form.records.filter((r) => r.family === 'option' && r.status === 'live')
  const goal = v.form.records.find((r) => r.family === 'goal')
  const leaves = leftOutOf(v.form, goal?.id)
  const about = (f, kind, o) => f.about?.kind === kind && f.about.option === o.id && (!goal || !f.about.goal || f.about.goal === goal.id)
  const chance = (o) => v.facts.find((f) => about(f, 'chance', o))
  const range = (o) => v.facts.find((f) => about(f, 'range', o))
  const driver = (o) => v.facts.find((f) => about(f, 'driver', o))
  const blocked = (o) => v.facts.find((f) => about(f, 'blocker', o))
  const most = v.facts.find((f) => f.about?.kind === 'most_likely' || f.about?.kind === 'none_clearly')
  const waits = v.facts.filter((f) => f.about?.kind === 'waits' || f.about?.kind === 'blocker').flatMap((f) => (f.about.rests ?? []))
  const waitsOn = [...new Set(waits)].map((id) => m.get(id)).filter(Boolean).map((r) => ({ id: r.id, label: nameOf(m, r.id), answer: r.family === 'quantity' && r.assertion.kind === 'asked' ? { quantity_id: r.id } : null, code: r.family === 'quantity' ? r.assertion.kind : 'waiting' }))
  return {
    schema: 'canonical_analysis_view.v1', source: 'stored_run_facts',
    run: { run_id: runIdOf(v), graph_hash_at_run: hash, computed_at: v.at },
    staleness: { stale: false, revision: null, run_revision: null, basis: 'analysis_graph_hash_interim', reason: null, limitation: 'Hash equality cannot detect brief, framing or stage changes.' },
    leader_licence: 'withheld',
    options: live.map((o) => {
      const c = chance(o), r = range(o), d = driver(o), b = blocked(o)
      const cell = c ? { kind: 'figure', display: c.value, face: `${c.value}: ${sayFact(c.text, leaves)}` }
        : r ? { kind: 'range', display: r.value, face: `${r.value}: ${sayFact(r.text, leaves)}`, detail: { low: r.about.low, median: r.about.median, high: r.about.high, unit: r.about.unit ?? null, olumi: r.about.olumi === true, rests: r.about.rests ?? [] } }
          : b ? { kind: 'withheld', face: b.value, why: sayFact(b.text, leaves), reasons: [{ code: 'withheld', message: sayFact(b.text, leaves) }] }
            : { kind: 'none' }
      return {
        option_id: o.id, cell,
        main_driver: d ? { kind: 'available', driver: { id: d.id, ...(d.about ?? {}) }, detail: `${d.value}: ${sayFact(d.text, leaves)}` } : { kind: 'none_licensed', reason: 'No figure moves this option’s chance enough to name one.' },
      }
    }),
    goal_chance: { ...(goal ? { chance_words: `chance of ‘${goal.label}’` } : {}), ...(leaves.length ? { notes: [`This leaves out: ${leaves.join('; ')}.`] } : {}), waits_on: waitsOn },
    leader: { licence: 'withheld', option_id: null, ...(most ? { words: sayFact(sentence(most.text), leaves) } : {}) },
  }
}
