/**
 * olumi-core's records as the three things DGAI's canvas reads: the nodes and edges its cards draw (`graphOf`), the
 * canonical model beside them (`canonicalOf`), and the Run as `canonical_analysis_view.v1` (`analysisViewOf`).
 * Rules come from the served fixtures (src/canvas/nodes/__tests__/fixtures/served-*), so this is only as faithful as they are.
 * Facts are read by their structured `about` (API v1.4), never from their text.
 */
import { byId, changeSetOf, decideByWords, figure, nameOf, num, partsOf, percent, shownNumber, signedPartsOf, theirs, CMP } from './words.mjs'
import { rev16, rev64, revSaved16, runIdOf } from './ids.mjs'
import { MODULE_KINDS, blockerWords, chanceWords, driverWords, holdNote, isLabels, leaderWords, leftOutWords, limitWords, moduleNote, rangeWords, silenceNote, unusedWords, waitsOnIds, whatIfWords } from './labels.mjs'

const valueOf = (q) => (q?.assertion?.kind === 'point' ? q.assertion.value : q?.assertion?.kind === 'interval' ? (q.assertion.likely ?? (q.assertion.low + q.assertion.high) / 2) : null)
/** A figure in words: the person's own exactly as they gave it, anyone else's to 3 significant figures. */
const fmt = (q) => (q ? figure(q.assertion, q.unit, theirs(q)) : '')
/** The likeliest value the person or Olumi stated, and never a midpoint: null for a range with no likeliest value. */
const statedValueOf = (q) => (q?.assertion?.kind === 'point' ? q.assertion.value : q?.assertion?.kind === 'interval' ? (q.assertion.likely ?? null) : null)
/**
 * A figure's `observed_state` for the card and the inspector: its unit, the stated value and the range as stated. The value (and raw value)
 * is the person's or Olumi's single figure only: a range with no likeliest value sends none, so the card says the range ("between 10 and 30")
 * and never its middle as if somebody had given it. Null when there is neither a value nor a range to say.
 */
const observedOf = (q, source, rangeSource) => {
  const stated = statedValueOf(q), a = q?.assertion
  const interval = a?.kind === 'interval' ? a : null
  if (stated === null && !interval) return null
  // The card prints these numbers as they come, so a figure that is not the person's is tidied to 3 significant figures here (theirs is sent as given).
  const tidy = theirs(q) ? (x) => x : shownNumber
  return { unit: q.unit, ...(stated !== null ? { value: tidy(stated), raw_value: tidy(stated) } : {}), source,
    ...(interval ? { range: { low: tidy(interval.low), high: tidy(interval.high), source: rangeSource, meaning: interval.range_kind } } : {}) }
}
/** A chance as the percentage a person reads: exactly as stated, never rounded to a different figure (see `percent`). */
const pct = percent

/**
 * Has the person's own figure been changed since they said it? Core's edit gives the changed figure an origin quote of its own
 * ("Set ... to ...") and leaves the limit's or aim's record with the words it was made with, so the two say the same thing only
 * while nothing was edited. When they differ, nothing of the person's old words is put beside the figure: not their quote and not a
 * label that may carry the old number ("Churn <= 4%"). The card then shows the saved figure with the saved unit, and nothing else
 * that could contradict it. No text of a quote is read for numbers.
 */
const figureEdited = (r, fig) => fig?.origin?.by === 'person' && fig.origin.quote !== r.origin?.quote
/** A limit's or an aim's name: its own label while its figure is the one the person said, else a plain name from what it measures. */
const nameFor = (r, fig, m, lead) => (r.measure && figureEdited(r, fig) ? `${lead} ‘${nameOf(m, r.measure.quantity)}’` : r.label)

/** An influence's direction as DGAI draws one: up and down are stated; disputed, conditional and unknown are NOT a direction (DGAI's own `unknown`). */
const influenceDirection = (d) => (d === 'up' ? 'positive' : d === 'down' ? 'negative' : 'unknown')
/** A calculation part's side, as DGAI draws a link: raises, lowers, or not stated (`unknown`). */
const SIGN_DIRECTION = { 1: 'positive', [-1]: 'negative', 0: 'unknown' }
const INFLUENCE_WORDS = { disputed: 'People disagree about which way this goes.', conditional: 'Which way this goes depends on conditions.', unknown: 'Which way this goes is not known.' }

/** A risk's chance and size, in the words a card shows: each with its range, and whose figure it is. */
function riskWords(r, m) {
  const occ = m.get(r.occurrence), sev = m.get(r.severity), target = nameOf(m, r.effect_on)
  const chance = (a, ex) => (a.kind === 'point' ? `${a.approximate ? 'about ' : ''}${pct(a.value, ex)}`
    : a.likely != null ? `about ${pct(a.likely, ex)} (between ${pct(a.low, ex)} and ${pct(a.high, ex)})` : `between ${pct(a.low, ex)} and ${pct(a.high, ex)}`)
  const size = (a, ex) => (a.kind === 'point' ? `${num(a.value, ex)}` : a.likely != null ? `${num(a.likely, ex)} (between ${num(a.low, ex)} and ${num(a.high, ex)})` : `an amount between ${num(a.low, ex)} and ${num(a.high, ex)}`)
  const usable = (q) => q && (q.assertion.kind === 'point' || q.assertion.kind === 'interval')
  const verb = r.mode === 'multiply' ? 'multiplies' : r.mode === 'add' ? 'adds to' : 'moves'
  const parts = [
    usable(occ) ? `May happen: ${chance(occ.assertion, theirs(occ))}.` : null,
    usable(sev) ? `If it does, it ${verb} ‘${target}’ by ${size(sev.assertion, theirs(sev))}.` : `If it happens, it pushes ‘${target}’ ${r.direction === 'unknown' ? 'either way' : r.direction}.`,
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
  // A constant fixed by how the model is built ("Whole share 1") is plumbing, nobody's figure: olumi-core's page folds it (4930f83: only structure
  // constants and option levers fold), and this canvas has no fold, so it is not drawn. It stays in the model and in "Also in the model" on the
  // reading card; the person's figures and Olumi's own stay drawn. Edges into or out of it are dropped from the drawing only.
  const plumbing = new Set(recs.filter((r) => r.family === 'quantity' && r.origin?.by === 'structure').map((r) => r.id))
  const setTo = new Set(recs.flatMap((r) => (r.family === 'option' ? r.sets.map((s) => s.to) : [])))
  // A risk's chance and size are said on the risk's own card, not drawn a second time as loose factors.
  const riskParts = new Set(recs.flatMap((r) => (r.family === 'risk' ? [r.occurrence, r.severity].filter(Boolean) : [])))
  // A card that shows a figure Olumi proposed (a goal's target, a limit's bound) is not the person's words, whoever wrote the card itself:
  // `figure` is that quantity, and Olumi's own origin on it makes the card Olumi's, with no quote of the person's put against it.
  const prov = (r, figure) => (r.origin?.by === 'person' && figure?.origin?.by !== 'olumi' ? 'from_brief' : 'ai_inferred')
  // The person's words are put against a card only while its figure is the one they said (`figureEdited`).
  const quote = (r, figure) => (r.origin?.by === 'person' && figure?.origin?.by !== 'olumi' && r.origin.quote && (!figure || !figureEdited(r, figure)) ? { source_quote: r.origin.quote } : {})
  const nodes = [], edges = [], seen = new Set()
  const add = (n) => { if (!seen.has(n.id)) { seen.add(n.id); nodes.push(n) } }
  /** `exists_probability: null` leaves the existence of the link unstated (no certainty is made up for a link nobody called certain). */
  const link = (from, to, extra = {}) => {
    const e = { id: `${from}__${to}`, from, to, origin: 'model_program:calculation', provenance: { source: 'brief_extraction' }, effect_direction: 'positive', exists_probability: 1, ...extra }
    if (e.exists_probability === null) delete e.exists_probability
    edges.push(e)
  }
  // The decision date reaches the canvas on the question's own card (the inspector reads its description): "Decide by 1 December 2026.
  // Olumi’s reason: ..." or "You said: ...", so a deadline Olumi proposed is never mistaken for the person's.
  add({ id: 'mp:decision', ref: 'D1', kind: 'decision', label: form.question, ...(form.decide_by ? { description: `Decide by ${decideByWords(form.decide_by)}` } : {}) })
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
      add({ id: r.id, ref: `O${++o}`, kind: 'option', label: r.label, provenance: prov(r), ...quote(r), ...(r.origin.by === 'olumi' ? { proposed_by: 'olumi' } : {}),
        // Core says which option is carrying on as you are; DGAI then never guesses a baseline from the option's words.
        is_baseline: r.carry_on === true, interventions, analysis_participation: r.status === 'live' ? 'included' : 'excluded' })
      link('mp:decision', r.id)
      for (const s of r.sets) link(r.id, s.quantity)
    } else if (r.family === 'risk') {
      const occurrence = statedValueOf(m.get(r.occurrence))
      add({ id: r.id, ref: `R${++c}`, kind: 'risk', label: r.label, provenance: prov(r), ...quote(r), description: riskWords(r, m), ...(typeof occurrence === 'number' && occurrence >= 0 && occurrence <= 1 ? { probability: occurrence } : {}) })
    }
  }
  for (const r of recs) {
    if (r.family !== 'quantity' || plumbing.has(r.id) || setTo.has(r.id) || measured.has(r.id) || riskParts.has(r.id)) continue
    const derived = r.role === 'derived' || r.assertion.kind === 'derived'
    const observed = observedOf(r, r.origin.by === 'person' ? 'brief_extraction' : 'cee_hypothesis', r.origin.by === 'person' ? 'user_override' : 'cee_hypothesis')
    const parts = derived ? partsOf(recs, r.id) : []
    add({
      id: r.id, ref: `${derived ? 'OC' : 'F'}${++f}`, kind: derived ? 'outcome' : 'factor', label: r.label, provenance: prov(r), ...quote(r),
      ...(r.origin.by === 'structure' ? { value_basis: { kind: 'structure', words: 'Fixed by how the model is built' } }
        : derived ? { value_basis: { kind: 'worked_out', from: parts, words: `Worked out from ${parts.map((i) => nameOf(m, i)).join(' and ')}` } } : {}),
      display_value: derived ? `Worked out from ${parts.map((i) => nameOf(m, i)).join(' and ')}` : fmt(r),
      // The person's stated range, as DGAI's own range line reads it (`factorStatedRange.ts`): the likeliest value stays the figure.
      ...(observed ? { observed_state: observed } : {}),
      analysis_participation: 'included',
    })
  }
  for (const r of goals) {
    const target = m.get(r.measure?.target)
    const a = target?.assertion
    // A target that is a range is shown as one ("95 to 105"), never collapsed to a single figure nobody gave.
    const ex = theirs(target)   // the person's own target is shown as they gave it; Olumi's to 3 significant figures
    const rangeWords = a?.kind === 'interval' ? `${num(a.low, ex)} to ${num(a.high, ex)}${a.likely != null ? `, most likely ${num(a.likely, ex)}` : ''}` : null
    const raw = a?.kind === 'interval' ? (a.likely ?? `${num(a.low, ex)} to ${num(a.high, ex)}`) : valueOf(target)
    add({ id: r.id, ref: `G${++g}`, kind: 'goal', label: nameFor(r, target, m, 'Aim for'), provenance: prov(r, target), ...quote(r, target), display_value: r.measure ? `${r.measure.cmp} ${rangeWords ?? (ex ? valueOf(target) : shownNumber(valueOf(target)))} ${target?.unit ?? ''}`.trim() : r.label,
      goal_direction: r.measure?.cmp, goal_threshold_raw: raw, goal_threshold_unit: target?.unit ?? null, goal_threshold_frame: r.measure?.frame ?? 'level', goal_measure_by: r.measure?.measure_by ?? 'person', analysis_participation: 'included' })
    if (r.measure && seen.has(r.measure.quantity)) link(r.measure.quantity, r.id, { provenance: { source: 'brief_extraction', definitional: true } })
  }
  // A limit is a card of its own (the person's "no more than 120"), hung off what it limits as the aim is. DGAI has no limit node
  // and says not to add one, so it is a factor: its name, the way it is measured and the bound as its figure.
  for (const r of limits) {
    const bound = m.get(r.measure?.bound)
    const bySource = bound?.origin?.by === 'olumi' ? 'cee_hypothesis' : 'brief_extraction'
    const observed = bound ? observedOf(bound, bySource, bySource === 'brief_extraction' ? 'user_override' : 'cee_hypothesis') : null
    add({
      id: r.id, ref: `F${++f}`, kind: 'factor', label: nameFor(r, bound, m, 'Limit on'), provenance: prov(r, bound), ...quote(r, bound),
      display_value: r.measure ? `${CMP[r.measure.cmp]} ${fmt(bound)}` : 'Not yet measurable',
      // The card shows the bound as its figure; the way it limits (at most, at least) is said here, where the card and the inspector read a description.
      description: r.measure ? `A limit on ‘${nameOf(m, r.measure.quantity)}’: it stays ${CMP[r.measure.cmp]} ${fmt(bound)}.` : 'A limit that cannot be measured yet.',
      ...(observed ? { observed_state: observed } : {}),
      analysis_participation: 'included',
    })
    if (r.measure && seen.has(r.measure.quantity)) link(r.measure.quantity, r.id, { provenance: { source: 'brief_extraction', definitional: true } })
  }
  // One link per source and target. A source that contributes more than once to the same target (`x + x - x`, or `current + rate × current`)
  // keeps a side only when every contribution has the same known one; otherwise its side is not stated (never the last term's).
  for (const target of new Set(recs.flatMap((r) => (r.family === 'relation' && r.form !== 'influence' ? [r.defines] : [])))) {
    const sides = new Map()
    for (const { id, sign } of signedPartsOf(recs, target)) sides.set(id, [...(sides.get(id) ?? []), sign])
    for (const [part, list] of sides) {
      const sign = list.every((x) => x === list[0]) ? list[0] : 0
      if (seen.has(part) && seen.has(target)) link(part, target, { effect_direction: SIGN_DIRECTION[sign], provenance: { source: 'brief_extraction', definitional: true } })
    }
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
  const uniq = new Map(edges.filter((e) => !plumbing.has(e.from) && !plumbing.has(e.to)).map((e) => [e.id, e]))
  return { nodes, edges: [...uniq.values()] }
}

/** The canonical model beside the graph (`living_model.canonical`): `approved` is the approval stamp every record carries. */
export function canonicalOf(form, approved) {
  const approval = approved ? 'approved' : 'proposed'
  const m = byId(form)
  // A limit's words are its own only while its figure is the one the person said (`figureEdited`).
  const pick = (f, shape) => form.records.filter((r) => r.family === f).map((r) => ({ id: r.id, ...shape(r), author: r.origin.by === 'person' ? 'person' : r.origin.by, party: r.origin.party ?? null, quote: r.origin.by === 'person' && !(f === 'limit' && r.measure && figureEdited(r, m.get(r.measure.bound))) ? r.origin.quote : null, approval }))
  return {
    version: 'canonical.v1',
    quantities: pick('quantity', (r) => {
      const a = r.assertion
      return { kind: r.role === 'coefficient' ? 'coefficient' : 'fact', label: r.label, unit: r.unit, status: a.kind === 'point' || a.kind === 'interval' ? 'known' : a.kind, value: statedValueOf(r), low: a.kind === 'interval' ? a.low : null, high: a.kind === 'interval' ? a.high : null, range_kind: a.kind === 'interval' ? a.range_kind : null, question: a.kind === 'asked' ? a.question : null, basis: r.origin.basis ?? null, direction: r.direction, floor: r.domain?.lower ?? null, ceiling: r.domain?.upper ?? null, author_id: null }
    }),
    // How a worked-out figure is worked out, in the shape DGAI's program reader draws + − × ÷ from (savedModelProgram.ts): a sum or
    // product is a `definition` with its `op`; a stock and an effect keep their form. An influence is a link, not a definition.
    relations: pick('relation', (r) => {
      if (r.form === 'sum' || r.form === 'product') return { form: 'definition', op: r.form, defines: r.defines, parts: r.parts.map((p) => (r.form === 'sum' ? { id: p.id, sign: p.sign } : { id: p.id, power: p.power })) }
      if (r.form === 'effect') return { form: 'effect', defines: r.defines, base: r.base, terms: r.terms.map((t) => ({ driver: t.driver, coefficient: t.coefficient })) }
      return { form: 'stock', defines: r.defines, start: r.start, inflows: r.inflows, outflows: r.outflows }
    }, (r) => r.form !== 'influence'),
    claims: pick('claim', (r) => ({ text: r.text, concerns: r.concerns })),
    assumptions: pick('assumption', (r) => ({ text: r.text, applied: r.applied, concerns: r.concerns })),
    conditions: pick('condition', (r) => ({ text: r.text, kind: r.kind, concerns: r.concerns })),
    left_out: pick('left_out', (r) => ({ text: r.text, why: r.why, question: r.question, concerns: r.concerns })),
    limits: pick('limit', (r) => ({ label: nameFor(r, m.get(r.measure?.bound), m, 'Limit on'), measure: r.measure ?? null })),
    preferences: pick('preference', (r) => ({ quantity: r.quantity, direction: r.direction })),
    dissent: pick('dissent', (r) => ({ holder: r.holder, position: r.position, concerns: r.concerns })),
    evidence: pick('evidence', (r) => ({ text: r.text, source: r.source, bears: r.bears, concerns: r.concerns })),
  }
}

/**
 * The limits DGAI's Model list can state with their figure (`goal_constraints`): those whose bound is one exact figure, "at most" or
 * "at least", at the end of the period over no span or share. DGAI's row has an operator of `<=` or `>=` and a number and nothing else
 * (no strictness, window, sum or per-unit), so any other limit is not stated there as if it were that: it stays in `canonical.limits`,
 * where the list says its figure is not captured.
 */
export function goalConstraintsOf(form) {
  const m = byId(form)
  return form.records.flatMap((r) => {
    const me = r.family === 'limit' ? r.measure : null
    const bound = me ? m.get(me.bound) : null
    if (!me || !['<=', '>='].includes(me.cmp) || me.aggregation !== 'end' || me.window !== null || me.per !== null) return []
    if (bound?.family !== 'quantity' || bound.assertion.kind !== 'point' || bound.assertion.approximate || typeof bound.assertion.value !== 'number') return []
    // Whose figure this is: the person's only when BOTH the limit and the bound are theirs. A bound Olumi proposed on a limit the person set
    // is Olumi's figure, whatever the limit's own author: inferred, and the person's quote is not put against it.
    const olumis = r.origin?.by === 'olumi' || bound.origin?.by === 'olumi'
    // ...and only while that figure has not been edited: an edited limit keeps its old quote and label on the limit record, and DGAI's
    // formatter prefers a quote (or a label with a number in it), so it would print "at most 4%" beside a saved 5%. Withheld (and the
    // label made a plain name), the formatter prints the saved bound with the saved unit. A quote is never cut short beside a figure.
    const quote = !olumis && r.origin?.by === 'person' && typeof r.origin.quote === 'string' && r.origin.quote && !figureEdited(r, bound) ? { source_quote: r.origin.quote } : {}
    return [{ constraint_id: r.id, label: nameFor(r, bound, m, 'Limit on'), node_id: me.quantity, operator: me.cmp, value: bound.assertion.value, ...(bound.unit && bound.unit !== '1' ? { unit: bound.unit } : {}), ...quote, provenance: olumis ? 'inferred' : 'explicit' }]
  })
}

/** What a held change is about: the held proposal if there is one, else the saved version. */
export const shownOf = (view) => view.pending ?? view.version ?? null
/**
 * What the canvas DRAWS: the saved model whenever there is one. A change that waits for approval is not part of the model yet, so it is
 * not drawn as if it were (a solid card nobody has approved, counted by "Rests on", with every option's result gone blank because the
 * Run is of the model before it): it waits on the chat card, and what it ADDS is a ghost (`ghostAddsOf`). Only a first draft, which has
 * no saved model, is drawn as it stands, held for the person to confirm.
 */
export const drawnOf = (view) => view.version ?? view.pending ?? null

/**
 * What a waiting change adds, as the held card hands it to the canvas (`adds`): a new figure the canvas would draw as a factor is a ghost
 * (`factor_add`: its name, its one figure when it has one, and whose it is); every other change (a new option, risk or aim, a changed or
 * removed card) is said in words (`change_note`), which also keeps the ghost from offering an approval that would write changes it does
 * not show. Empty for a first draft, which is drawn as it stands, and when nothing waits.
 */
export function ghostAddsOf(view) {
  const p = view.pending
  if (!p || !view.version) return []
  const set = changeSetOf(view)
  const m = byId(p.form)
  const factors = new Set(graphOf(p.form).nodes.filter((n) => n.kind === 'factor').map((n) => n.id))
  const was = byId(view.version.form)
  const source = (r) => (r?.origin?.by === 'olumi' ? 'estimate' : 'yours')
  const out = []
  const note = (verb, r, id) => out.push({ field_id: `change_note:record:${id}`, kind: 'change_note', text: `${verb} ‘${nameOf(m.has(id) ? m : was, id)}’`, source: source(r), editable: false })
  for (const id of set.added) {
    const r = m.get(id)
    if (r?.family === 'quantity' && factors.has(id)) {
      out.push({ field_id: `factor_add:${id}`, kind: 'factor_add', node_id: id, label: r.label, value: ghostFigureOf(r), source: source(r) })
    } else note('Adds', r, id)
  }
  for (const id of set.changed) note('Changes', m.get(id), id)
  for (const id of set.removed) note('Removes', was.get(id), id)
  // The top-level changes (the deadline, the question, its name, the time step, the questions to ask) are changes too: said before the approval.
  for (const field of set.top) {
    const label = TOP_LABELS[field] ?? field
    out.push({ field_id: `change_note:top:${field}`, kind: 'change_note', text: `Changes ‘${label}’`, source: field === 'decide_by' ? (p.form.decide_by?.origin?.by === 'person' ? 'yours' : 'estimate') : 'estimate', editable: false })
  }
  return out
}

const TOP_LABELS = { decide_by: 'Decide by', question: 'The question', title: 'The name', period: 'Time step', coaching_questions: 'Questions to ask yourself' }

/**
 * A new factor's proposed figure exactly as it is stated: a point as a point, a range as its two ends (with the most likely when one is
 * stated). Null when the figure is asked for or not a number. A unitless figure carries an empty unit.
 */
export function ghostFigureOf(r) {
  const a = r.assertion
  const unit = r.unit && r.unit !== '1' ? r.unit : ''
  const ok = (n) => typeof n === 'number' && Number.isFinite(n)
  if (a.kind === 'point') return ok(a.value) ? { value: a.value, unit } : null
  if (a.kind === 'interval' && ok(a.low) && ok(a.high)) return { low: a.low, high: a.high, ...(ok(a.likely) ? { likely: a.likely } : {}), unit }
  return null
}

export function modelOf(view) {
  const shown = drawnOf(view)
  if (!shown) return null
  // The identity of what is drawn: with a saved model on screen, that model alone (a waiting change does not move it).
  const drawnView = shown === view.version ? { ...view, pending: null } : view
  const { nodes, edges } = graphOf(shown.form)
  const limits = goalConstraintsOf(shown.form)
  return {
    // `goal_constraints` is left off when there are none: a core turn's absence of it clears the limits shown (`constraintsComplete`).
    graph: { nodes, edges, ...(limits.length ? { goal_constraints: limits } : {}), living_model: { model_program: 'v1', canonical: canonicalOf(shown.form, shown === view.version) } },
    revision: rev16(drawnView), scenario_revision: rev64(drawnView),
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

/**
 * The saved version's Run. Its facts are about the SAVED model, which is what the canvas draws while a change waits (`drawnOf`), so
 * the Run is stamped with that model's hash and is current for it: the options keep their results until a new Run lands.
 */
export function analysisViewOf(view) {
  const v = view.version
  if (!v || !v.facts?.length) return null
  const m = byId(v.form)
  const live = v.form.records.filter((r) => r.family === 'option' && r.status === 'live')
  // The Run view carries ONE aim's results. Core's facts name the aim they are about (`about.goal`), so the aim is the first one core
  // has results for (else the first that can be measured, else the first): never just the first in the list, whose results may be
  // none (no measure yet) while a later aim's are all there.
  const goals = v.form.records.filter((r) => r.family === 'goal')
  const AIM_FACTS = new Set(['chance', 'range', 'driver', 'blocker', 'most_likely', 'none_clearly'])
  const goal = goals.find((g) => v.facts.some((f) => AIM_FACTS.has(f.about?.kind) && f.about.goal === g.id)) ?? goals.find((g) => g.measure) ?? goals[0]
  const leaves = leftOutOf(v.form, goal?.id)
  const about = (f, kind, o) => f.about?.kind === kind && f.about.option === o.id && (!goal || !f.about.goal || f.about.goal === goal.id)
  const chance = (o) => v.facts.find((f) => about(f, 'chance', o))
  const range = (o) => v.facts.find((f) => about(f, 'range', o))
  const driver = (o) => v.facts.find((f) => about(f, 'driver', o))
  const blocked = (o) => v.facts.find((f) => about(f, 'blocker', o))
  const most = v.facts.find((f) => (f.about?.kind === 'most_likely' || f.about?.kind === 'none_clearly') && (!goal || !f.about.goal || f.about.goal === goal.id))
  // The other aims' chances: the view has room for one aim's cells, and the rest are not dropped. Each is core's own sentence for that
  // option and aim, passed through as stored: code puts no analytical claim of its own beside them.
  const otherAims = goals.filter((g) => g !== goal).flatMap((g) => live.flatMap((o) => {
    const c = v.facts.find((f) => f.about?.kind === 'chance' && f.about.option === o.id && f.about.goal === g.id)
    // A labelled fact has no "It leaves out" tail: this aim's own exclusions are its block's `leaves`, said beside its chance.
    return c ? [isLabels(c) ? [chanceWords(c, m).face, leftOutWords(c.about, m)].filter(Boolean).join(' ') : `${c.value}: ${sayFact(c.text, leaves)}`] : []
  }))
  // A labelled wait or blocker waits on the questions it asks (`asks`, and the `asked` reasons' figures), not on the premises it rests on; the
  // legacy fact's `rests` is read as it always was.
  const waits = v.facts.filter((f) => f.about?.kind === 'waits' || f.about?.kind === 'blocker').flatMap((f) => (isLabels(f) ? waitsOnIds(f, m) : (f.about.rests ?? [])))
  const waitsOn = [...new Set(waits)].map((id) => m.get(id)).filter(Boolean).map((r) => ({ id: r.id, label: nameOf(m, r.id), answer: r.family === 'quantity' && r.assertion.kind === 'asked' ? { quantity_id: r.id } : null, code: r.family === 'quantity' ? r.assertion.kind : 'waiting' }))
  // Olumi's what-if figures, from the structured input facts (API v1.4 `about.olumi`): core's own sentence for each, once per figure, as stored.
  const whatIfs = [...new Map(v.facts.filter((f) => f.about?.kind === 'input' && f.about.olumi === true && (!isLabels(f) || f.about.shape === 'range'))
    .map((f) => [f.about.quantity, isLabels(f) ? whatIfWords(f, m) : sayFact(f.text, leaves)])).values()]
  // The person's limits: core's own sentences for each option (within the limit, outside it, blocked), passed through as stored.
  const limitNotes = v.form.records.filter((r) => r.family === 'limit').flatMap((l) => {
    const of = (kind, o) => v.facts.find((x) => x.about?.kind === kind && x.about.limit === l.id && x.about.option === o.id)
    const whole = v.facts.find((x) => (x.about?.kind === 'blocker' || (isLabels(x) && x.about?.kind === 'waits')) && x.about.limit === l.id && !x.about.option)
    const say = (f) => (isLabels(f) ? (f.about.kind === 'limit' || f.about.kind === 'outside' ? limitWords(f, m) : f.about.kind === 'chance' ? chanceWords(f, m).face : holdNote(f, m)) : `${f.value}: ${sayFact(f.text, leaves)}`)
    return [...(whole ? [whole] : []), ...live.flatMap((o) => [of('limit', o), of('outside', o), of('blocker', o)].filter(Boolean))].map(say)
  })
  // The aim's own holds (labels only): an aim with no measure, or one that waits, is not an option's cell; its reasons are said once, as notes.
  const aimHolds = v.facts.filter((f) => isLabels(f) && (f.about.kind === 'blocker' || f.about.kind === 'waits') && !f.about.option && !f.about.limit).map((f) => holdNote(f, m))
  // The science modules' markers (labels only): their value as stored beside the names they are about; a kind this code does not know is left alone.
  const markers = v.facts.filter((f) => isLabels(f) && MODULE_KINDS.has(f.about.kind)).map((f) => moduleNote(f, m))
  const silence = silenceNote(v.science)
  // Figures given that no result used (labels only: `used`).
  const unused = v.facts.filter((f) => isLabels(f) && f.about.kind === 'input' && f.about.used === false)
  const unusedNote = unused.length ? [`Not used by this result: ${unused.map((f) => unusedWords(f, m)).join('; ')}.`] : []
  // An option whose chance could not be worked out but whose range is shown keeps the reason beside it (labels only), never hidden by the range.
  const heldBack = live.flatMap((o) => { const b = blocked(o); return b && isLabels(b) && !chance(o) && range(o) ? [holdNote(b, m)] : [] })
  const notes = [...(leaves.length ? [`This leaves out: ${leaves.join('; ')}.`] : []), ...otherAims, ...limitNotes, ...aimHolds, ...heldBack, ...whatIfs, ...unusedNote, ...markers, ...(silence ? [silence] : [])]
  return {
    schema: 'canonical_analysis_view.v1', source: 'stored_run_facts',
    run: { run_id: runIdOf(v), graph_hash_at_run: revSaved16(view), computed_at: v.at },
    staleness: { stale: false, revision: null, run_revision: null, basis: 'analysis_graph_hash_interim', reason: null, limitation: 'Hash equality cannot detect brief, framing or stage changes.' },
    leader_licence: 'withheld',
    options: live.map((o) => {
      const c = chance(o), r = range(o), d = driver(o), b = blocked(o)
      const cell = c ? (isLabels(c) ? { kind: 'figure', ...(({ display, face }) => ({ display, face }))(chanceWords(c, m)) } : { kind: 'figure', display: c.value, face: `${c.value}: ${sayFact(c.text, leaves)}` })
        : r ? { kind: 'range', display: r.value, face: isLabels(r) ? rangeWords(r, m, goal) : `${r.value}: ${sayFact(r.text, leaves)}`, detail: { low: r.about.low, median: r.about.median, high: r.about.high, unit: r.about.unit ?? null, olumi: r.about.olumi === true, rests: r.about.rests ?? [] } }
          : b ? (isLabels(b) ? (({ reasons, why }) => ({ kind: 'withheld', face: b.value, why, reasons }))(blockerWords(b, m)) : { kind: 'withheld', face: b.value, why: sayFact(b.text, leaves), reasons: [{ code: 'withheld', message: sayFact(b.text, leaves) }] })
            : { kind: 'none' }
      return {
        option_id: o.id, cell,
        // No driver fact is not a statement that nothing drives the chance (core may have withheld drivers or measured none): it is not recorded.
        main_driver: d ? { kind: 'available', driver: { id: d.id, ...(d.about ?? {}) }, detail: isLabels(d) ? driverWords(d, m) : `${d.value}: ${sayFact(d.text, leaves)}` } : { kind: 'not_recorded' },
      }
    }),
    goal_chance: { ...(goal ? { chance_words: `chance of ‘${goal.label}’` } : {}), ...(notes.length ? { notes } : {}), waits_on: waitsOn },
    leader: { licence: 'withheld', option_id: null, ...(most ? { words: isLabels(most) ? leaderWords(most, m, live.map((o) => o.id).filter((id) => v.facts.some((f) => isLabels(f) && f.about.kind === 'blocker' && f.about.option === id && !f.about.limit && (!f.about.goal || !goal || f.about.goal === goal.id)))) : sayFact(sentence(most.text), leaves) } : {}) },
  }
}
