/**
 * olumi-core's records as the three things DGAI's canvas reads: the nodes and edges its cards draw (`graphOf`), the
 * canonical model beside them (`canonicalOf`), and the Run as `canonical_analysis_view.v1` (`analysisViewOf`).
 * Rules come from the served fixtures (src/canvas/nodes/__tests__/fixtures/served-*), so this is only as faithful as they are.
 * Facts are read by their structured `about` (API v1.4), never from their text.
 */
import { byId, figure, nameOf, num, partsOf, CMP } from './words.mjs'
import { rev16, rev64, revSaved16, runIdOf } from './ids.mjs'

const valueOf = (q) => (q?.assertion?.kind === 'point' ? q.assertion.value : q?.assertion?.kind === 'interval' ? (q.assertion.likely ?? (q.assertion.low + q.assertion.high) / 2) : null)
const fmt = (q) => (q ? figure(q.assertion, q.unit) : '')
/** The likeliest value the person or Olumi stated, and never a midpoint: null for a range with no likeliest value. */
const statedValueOf = (q) => (q?.assertion?.kind === 'point' ? q.assertion.value : q?.assertion?.kind === 'interval' ? q.assertion.likely : null)
const pct = (x) => `${Math.round(x * 100)}%`

/** An influence's direction as DGAI draws one: up and down are stated; disputed, conditional and unknown are NOT a direction (DGAI's own `unknown`). */
const influenceDirection = (d) => (d === 'up' ? 'positive' : d === 'down' ? 'negative' : 'unknown')
const INFLUENCE_WORDS = { disputed: 'People disagree about which way this goes.', conditional: 'Which way this goes depends on conditions.', unknown: 'Which way this goes is not known.' }

/** A risk's chance and size, in the words a card shows: each with its range, and whose figure it is. */
function riskWords(r, m) {
  const occ = m.get(r.occurrence), sev = m.get(r.severity), target = nameOf(m, r.effect_on)
  const chance = (a) => (a.kind === 'point' ? `${a.approximate ? 'about ' : ''}${pct(a.value)}`
    : a.likely != null ? `about ${pct(a.likely)} (between ${pct(a.low)} and ${pct(a.high)})` : `between ${pct(a.low)} and ${pct(a.high)}`)
  const size = (a) => (a.kind === 'point' ? `${num(a.value)}` : a.likely != null ? `${num(a.likely)} (between ${num(a.low)} and ${num(a.high)})` : `an amount between ${num(a.low)} and ${num(a.high)}`)
  const usable = (q) => q && (q.assertion.kind === 'point' || q.assertion.kind === 'interval')
  const verb = r.mode === 'multiply' ? 'multiplies' : r.mode === 'add' ? 'adds to' : 'moves'
  const parts = [
    usable(occ) ? `May happen: ${chance(occ.assertion)}.` : null,
    usable(sev) ? `If it does, it ${verb} ‘${target}’ by ${size(sev.assertion)}.` : `If it happens, it pushes ‘${target}’ ${r.direction === 'unknown' ? 'either way' : r.direction}.`,
    [occ, sev].some((q) => q?.origin?.by === 'olumi') ? 'Olumi’s what-if figures, until you give your own.' : null,
  ].filter(Boolean)
  return parts.join(' ')
}

export function graphOf(form) {
  const m = byId(form)
  const recs = form.records
  const goals = recs.filter((r) => r.family === 'goal')
  const limits = recs.filter((r) => r.family === 'limit')
  const measured = new Set(recs.flatMap((r) => (r.family === 'goal' || r.family === 'limit') && r.measure ? [r.measure.target ?? r.measure.bound] : []))
  const setTo = new Set(recs.flatMap((r) => (r.family === 'option' ? r.sets.map((s) => s.to) : [])))
  // A risk's chance and size are said on the risk's own card, not drawn a second time as loose factors.
  const riskParts = new Set(recs.flatMap((r) => (r.family === 'risk' ? [r.occurrence, r.severity].filter(Boolean) : [])))
  const prov = (r) => (r.origin?.by === 'person' ? 'from_brief' : 'ai_inferred')
  const quote = (r) => (r.origin?.by === 'person' && r.origin.quote ? { source_quote: r.origin.quote } : {})
  const nodes = [], edges = [], seen = new Set()
  const add = (n) => { if (!seen.has(n.id)) { seen.add(n.id); nodes.push(n) } }
  /** `exists_probability: null` leaves the existence of the link unstated (no certainty is made up for a link nobody called certain). */
  const link = (from, to, extra = {}) => {
    const e = { id: `${from}__${to}`, from, to, origin: 'model_program:calculation', provenance: { source: 'brief_extraction' }, effect_direction: 'positive', exists_probability: 1, ...extra }
    if (e.exists_probability === null) delete e.exists_probability
    edges.push(e)
  }
  add({ id: 'mp:decision', ref: 'D1', kind: 'decision', label: form.question })
  let o = 0, f = 0, c = 0, g = 0
  for (const r of recs) {
    if (r.family === 'option' && r.status !== 'removed') {
      // Each set figure is the FIGURE's own record: whose it is, and its range as stated (a midpoint is never worded as a figure).
      // The number is the likeliest value; a range with none carries a midpoint only because the card needs a number to sit on, and the words say the range.
      const interventions = Object.fromEntries(r.sets.map((s) => {
        const qs = m.get(s.quantity), to = m.get(s.to), v = valueOf(to)
        const by = to?.origin?.by
        const mine = by === 'olumi' ? `Set by ‘${r.label}’ using Olumi’s what-if, until you give your own` : by === 'structure' ? `Set by ‘${r.label}’ to a figure fixed by how the model is built` : `Set by ‘${r.label}’, from your brief`
        return [s.quantity, {
          unit: qs?.unit ?? null, value: v, source: by === 'olumi' ? 'cee_hypothesis' : 'brief_extraction',
          ...(to?.assertion?.kind === 'interval' ? { display_value: fmt(to) } : {}),
          display: `${fmt(to)}`, from_period: typeof s.starts_after === 'number' ? s.starts_after : 0, source_words: mine,
        }]
      }))
      add({ id: r.id, ref: `O${++o}`, kind: 'option', label: r.label, provenance: prov(r), ...quote(r), ...(r.origin.by === 'olumi' ? { proposed_by: 'olumi' } : {}), interventions, analysis_participation: r.status === 'live' ? 'included' : 'excluded' })
      link('mp:decision', r.id)
      for (const s of r.sets) link(r.id, s.quantity)
    } else if (r.family === 'risk') {
      const occurrence = statedValueOf(m.get(r.occurrence))
      add({ id: r.id, ref: `R${++c}`, kind: 'risk', label: r.label, provenance: prov(r), ...quote(r), description: riskWords(r, m), ...(typeof occurrence === 'number' && occurrence >= 0 && occurrence <= 1 ? { probability: occurrence } : {}) })
    }
  }
  for (const r of recs) {
    if (r.family !== 'quantity' || setTo.has(r.id) || measured.has(r.id) || riskParts.has(r.id)) continue
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
    const a = target?.assertion
    // A target that is a range is shown as one ("95 to 105"), never collapsed to a single figure nobody gave.
    const rangeWords = a?.kind === 'interval' ? `${num(a.low)} to ${num(a.high)}${a.likely != null ? `, most likely ${num(a.likely)}` : ''}` : null
    const raw = a?.kind === 'interval' ? (a.likely ?? `${num(a.low)} to ${num(a.high)}`) : valueOf(target)
    add({ id: r.id, ref: `G${++g}`, kind: 'goal', label: r.label, provenance: prov(r), ...quote(r), display_value: r.measure ? `${r.measure.cmp} ${rangeWords ?? valueOf(target)} ${target?.unit ?? ''}`.trim() : r.label,
      goal_direction: r.measure?.cmp, goal_threshold_raw: raw, goal_threshold_unit: target?.unit ?? null, goal_threshold_frame: r.measure?.frame ?? 'level', goal_measure_by: r.measure?.measure_by ?? 'person', analysis_participation: 'included' })
    if (r.measure && seen.has(r.measure.quantity)) link(r.measure.quantity, r.id, { provenance: { source: 'brief_extraction', definitional: true } })
  }
  // A limit is a card of its own (the person's "no more than 120"), hung off what it limits as the aim is. DGAI has no limit node
  // and says not to add one, so it is a factor: its name, the way it is measured and the bound as its figure.
  for (const r of limits) {
    const bound = m.get(r.measure?.bound)
    const v = valueOf(bound)
    const interval = bound?.assertion?.kind === 'interval' ? bound.assertion : null
    const bySource = bound?.origin?.by === 'olumi' ? 'cee_hypothesis' : 'brief_extraction'
    add({
      id: r.id, ref: `F${++f}`, kind: 'factor', label: r.label, provenance: prov(r), ...quote(r),
      display_value: r.measure ? `${CMP[r.measure.cmp]} ${fmt(bound)}` : 'Not yet measurable',
      // The card shows the bound as its figure; the way it limits (at most, at least) is said here, where the card and the inspector read a description.
      description: r.measure ? `A limit on ‘${nameOf(m, r.measure.quantity)}’: it stays ${CMP[r.measure.cmp]} ${fmt(bound)}.` : 'A limit that cannot be measured yet.',
      ...(v !== null ? { observed_state: { unit: bound.unit, value: v, raw_value: v, source: bySource,
        ...(interval ? { range: { low: interval.low, high: interval.high, source: bySource === 'brief_extraction' ? 'user_override' : 'cee_hypothesis', meaning: interval.range_kind } } : {}) } } : {}),
      analysis_participation: 'included',
    })
    if (r.measure && seen.has(r.measure.quantity)) link(r.measure.quantity, r.id, { provenance: { source: 'brief_extraction', definitional: true } })
  }
  for (const r of recs) {
    if (r.family !== 'relation' || r.form === 'influence') continue
    for (const part of partsOf(recs, r.defines)) if (seen.has(part) && seen.has(r.defines)) link(part, r.defines, { provenance: { source: 'brief_extraction', definitional: true } })
  }
  // An influence is drawn the way it was stated. Up and down are directions; disputed, conditional and unknown are NOT, and none of
  // them is a certain link: no direction and no certainty are made up for them.
  for (const r of recs) {
    if (r.family !== 'relation' || r.form !== 'influence' || !seen.has(r.from) || !seen.has(r.to)) continue
    const reasoning = [INFLUENCE_WORDS[r.direction], r.basis ? `${r.basis.charAt(0).toUpperCase()}${r.basis.slice(1)}${/[.!?]$/.test(r.basis) ? '' : '.'}` : null].filter(Boolean).join(' ')
    link(r.from, r.to, {
      id: r.id, effect_direction: influenceDirection(r.direction), exists_probability: null,
      provenance: { source: r.origin.by === 'person' ? 'brief_extraction' : 'cee_hypothesis', ...(reasoning ? { reasoning } : {}) },
    })
  }
  // A risk acts on something: the edge says what, and which way.
  for (const r of recs) {
    if (r.family !== 'risk' || !seen.has(r.id) || !seen.has(r.effect_on)) continue
    link(r.id, r.effect_on, { effect_direction: influenceDirection(r.direction), exists_probability: null, provenance: { source: r.origin.by === 'person' ? 'brief_extraction' : 'cee_hypothesis', reasoning: `${r.label} could push ‘${nameOf(m, r.effect_on)}’ ${r.direction === 'unknown' ? 'either way' : r.direction}.` } })
  }
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

/** What each option's cell says while a change waits: the chances are those of the model before it, never the held model's. */
const WAITING_FACE = 'A change is waiting for your confirmation. These results are for the model before it; confirm it and Olumi runs the new model.'

/**
 * The saved version's Run. Its facts are about the SAVED model, so the Run is stamped with that model's hash; while a change is
 * waiting the canvas draws a different graph (the held one), so the Run is not current for it and says so. With nothing waiting
 * the two hashes are the same and the Run is current.
 */
export function analysisViewOf(view) {
  const v = view.version
  if (!v || !v.facts?.length) return null
  const waiting = !!view.pending
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
  // Olumi's what-if figures, from the structured input facts (API v1.4 `about.olumi`): said once, as the facts mark them, not read from their words.
  const whatIfs = [...new Set(v.facts.filter((f) => f.about?.kind === 'input' && f.about.olumi === true).map((f) => nameOf(m, f.about.quantity)))]
  // The person's limits: what core found for each option, within the limit and outside it, from the structured limit / outside / blocker facts.
  const limitNotes = v.form.records.filter((r) => r.family === 'limit').flatMap((l) => {
    const of = (kind, o) => v.facts.find((x) => x.about?.kind === kind && x.about.limit === l.id && x.about.option === o.id)
    const rows = live.flatMap((o) => {
      const within = of('limit', o), outside = of('outside', o), blocked = of('blocker', o)
      if (within) return [`‘${nameOf(m, o.id)}’ ${within.value}${outside ? ` within it, ${outside.value} outside` : ''}`]
      return blocked ? [`‘${nameOf(m, o.id)}’ ${blocked.value}`] : []
    })
    const whole = v.facts.find((x) => x.about?.kind === 'blocker' && x.about.limit === l.id && !x.about.option)
    if (whole) rows.unshift(whole.value)
    return rows.length ? [`Your limit ‘${l.label}’: ${rows.join('; ')}.`] : []
  })
  const notes = [...(leaves.length ? [`This leaves out: ${leaves.join('; ')}.`] : []), ...limitNotes, ...(whatIfs.length ? [`Olumi’s what-if figures, until you give your own: ${whatIfs.join('; ')}.`] : [])]
  return {
    schema: 'canonical_analysis_view.v1', source: 'stored_run_facts',
    run: { run_id: runIdOf(v), graph_hash_at_run: revSaved16(view), computed_at: v.at },
    staleness: { stale: waiting, revision: null, run_revision: null, basis: 'analysis_graph_hash_interim', reason: waiting ? 'A change is waiting for your confirmation; these results are for the model before it.' : null, limitation: 'Hash equality cannot detect brief, framing or stage changes.' },
    ...(waiting ? { face_when_stale: WAITING_FACE } : {}),
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
    goal_chance: { ...(goal ? { chance_words: `chance of ‘${goal.label}’` } : {}), ...(notes.length ? { notes } : {}), waits_on: waitsOn },
    leader: { licence: 'withheld', option_id: null, ...(most ? { words: sayFact(sentence(most.text), leaves) } : {}) },
  }
}
