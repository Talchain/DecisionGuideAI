/**
 * The reading card's rows, from olumi-core's records. This file is the only place the adapter authors words for a record,
 * and the only place the model-composition rule is applied to the card (INPUT-MODEL-COMPOSITION, binding):
 *   - the person's records come first, Olumi's what-ifs are grouped behind them;
 *   - relations (family `relation`) and derived quantities (`role: 'derived'`) fold into "Also in the model";
 *   - constants (`origin.by === 'structure'`) are marked as plumbing, nobody's figure.
 * Everything is read from structured fields (family, origin, role, assertion), never from the text of a fact.
 */
export const byId = (form) => new Map((form?.records ?? []).map((r) => [r.id, r]))
export const nameOf = (m, id) => { const r = m.get(id); return r ? (r.label ?? r.text ?? r.position ?? r.id) : id }
export const CMP = { '>=': 'at least', '<=': 'at most', '>': 'more than', '<': 'less than' }

/** A number as a person reads it: thousands separated, no float noise. */
const SIX_PLACES = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 6 }), TWELVE_DIGITS = new Intl.NumberFormat('en-GB', { maximumSignificantDigits: 12 })
export const num = (n) => {
  if (typeof n !== 'number' || !Number.isFinite(n)) return String(n)
  const shown = SIX_PLACES.format(n)
  // Six places only while they keep the figure: 0.0000001 would read as "0" and a figure the person gave would be lost.
  return Math.abs(Number(shown.replace(/,/g, '')) - n) <= 1e-9 * Math.abs(n) ? shown : TWELVE_DIGITS.format(n)
}
const unitOf = (unit) => (unit && unit !== '1' ? ` ${unit}` : '')

/**
 * A chance as the percentage a person reads: exactly as stated (a stated 0.4% is "0.4%", 12.5% is "12.5%"), never rounded to a
 * different figure. Under 0.01% it says so; "0%" is only ever an exact zero. Mirrored by `chancePercentText`
 * (src/canvas/nodes/shared/chancePercent.ts), which words the same chance on the risk card.
 */
export function percent(x) {
  const v = x * 100
  if (v === 0) return '0%'
  if (v === 100) return '100%'
  if (v < 0.01) return 'under 0.01%'
  if (v > 99.99) return 'over 99.99%'
  return `${new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2, useGrouping: false }).format(v)}%`
}

/** A figure in plain words, as the person stated it: a point, or a range with the likeliest value. */
export function figure(a, unit) {
  const u = unitOf(unit)
  switch (a.kind) {
    case 'point': return `${a.approximate ? 'about ' : ''}${num(a.value)}${u}`
    case 'interval': return `between ${num(a.low)} and ${num(a.high)}${u}${a.likely != null ? `, most likely ${num(a.likely)}` : ''}`
    case 'derived': return 'worked out from the other figures'
    case 'asked': return `still to be given: ${a.question}`
    default: return a.reason
  }
}

/** What defines a derived quantity (the parts a calculation uses), by record id. */
export function partsOf(recs, id) {
  return recs.flatMap((r) => (r.family === 'relation' && r.form !== 'influence' && r.defines === id
    ? r.form === 'sum' || r.form === 'product' ? r.parts.map((p) => p.id)
      : r.form === 'effect' ? [r.base, ...r.terms.flatMap((t) => [t.driver, t.coefficient])]
        : [r.start, ...r.inflows, ...r.outflows] : []))
}

/** A quantity's known side from its own floor or ceiling: 1 (never below zero), -1 (never above zero) or 0 (not stated). Never a guess from its value. */
const side = (q) => (typeof q?.domain?.lower === 'number' && q.domain.lower >= 0 ? 1 : typeof q?.domain?.upper === 'number' && q.domain.upper <= 0 ? -1 : 0)
/**
 * A product factor's known side: its floor or ceiling (a declared domain) if one fixes it, else the figure as stated: an exact point
 * (the person's one value; an "about" point is a band of a tenth of its size either way, which puts zero a dozen spreads from the
 * value in the sampler's law, so its sign does not change), or a range whose ends are HARD BOUNDS (`range_kind: 'bounds'`: the ruled
 * law is conditioned on them and never leaves them) lying wholly on one side of zero. A PLAUSIBLE range is a rough span, not a
 * bound: the law reads it so that it falls below its low end one time in ten and above its high end one time in ten, so [0, 2] still
 * takes negative values and fixes no side. A range that spans zero, a figure still to be given and one worked out from others are
 * not stated (0).
 */
const factorSide = (q) => {
  const d = side(q), a = q?.assertion
  if (d !== 0) return d
  if (a?.kind === 'point' && typeof a.value === 'number') return a.value >= 0 ? 1 : -1
  if (a?.kind === 'interval' && a.range_kind === 'bounds' && typeof a.low === 'number' && typeof a.high === 'number') return a.low >= 0 ? 1 : a.high <= 0 ? -1 : 0
  return 0
}
/** The sign of x to the power e, from x's known side: 1, -1, or 0 when it cannot be said (a negative base to a fractional power, or an odd power of a base that may be either). */
const signOfPower = (s, e) => (e === 0 ? 1 : s === 1 ? 1 : !Number.isInteger(e) ? 0 : e % 2 === 0 ? 1 : s === -1 ? -1 : 0)

/** The settings to read a direction under: the baseline (nothing set), then each option that sets figures, as {figure id -> the figure it sets it to}. */
const settingsOf = (recs, m) => [new Map(), ...recs.flatMap((o) => {
  if (o.family !== 'option' || o.status === 'removed') return []
  const set = new Map((o.sets ?? []).flatMap((s) => (m.get(s.to)?.assertion ? [[s.quantity, m.get(s.to).assertion]] : [])))
  return set.size > 0 ? [set] : []
})]

/**
 * The same parts, each with the way it bears on what it defines, as the relation states it: 1 (raises it), -1 (lowers it) or 0
 * (the relation does not say). A subtracted sum part lowers it; a product part's side is in the comment below; an outflow
 * lowers a stock. An effect's term moves the result the way its coefficient does, and a coefficient moves it the way its driver
 * does; that side is stated only when the figure's own floor or ceiling fixes it, else 0 (never a guess from the number's value).
 */
export function signedPartsOf(recs, id) {
  const m = new Map(recs.map((r) => [r.id, r]))
  return recs.flatMap((r) => {
    if (r.family !== 'relation' || r.form === 'influence' || r.defines !== id) return []
    if (r.form === 'sum') return r.parts.map((p) => ({ id: p.id, sign: p.sign < 0 ? -1 : 1 }))
    // A product part moves the result with the sign of its power, times the sign of everything else in the product: it raises the result
    // only when the rest is known to be non-negative, lowers it only when the rest is known to be non-positive (a negative multiplier
    // turns it round); a factor is known by its floor or ceiling, else by its stated figure, and is not stated when the rest can be either (a multiplier that spans zero). The part's own sign counts too
    // (x squared moves with x). A divisor is the same rule with a negative power (-100 / x rises as x rises).
    if (r.form === 'product') {
      const power = (p) => (typeof p.power === 'number' ? p.power : 1)
      // The direction is stated only when it is the same at the baseline AND under every option's settings: each context reads each factor's
      // side (its floor or ceiling, else its stated figure) with that option's own settings put over the baseline's. Where they disagree
      // (an option that turns a multiplier's sign round) the direction is not stated (0): it depends on the option.
      const signIn = (setting, p) => {
        const sideOf = (id) => factorSide(setting.has(id) ? { ...m.get(id), assertion: setting.get(id) } : m.get(id))
        const own = signOfPower(sideOf(p.id), power(p) - 1)
        const rest = r.parts.filter((o) => o !== p).map((o) => signOfPower(sideOf(o.id), power(o)))
        return (Math.sign(power(p)) * own * rest.reduce((x, y) => x * y, 1)) || 0
      }
      return r.parts.map((p) => {
        const signs = settingsOf(recs, m).map((setting) => signIn(setting, p))
        return { id: p.id, sign: signs.every((x) => x === signs[0]) ? signs[0] : 0 }
      })
    }
    if (r.form === 'effect') return [{ id: r.base, sign: 1 }, ...r.terms.flatMap((t) => [{ id: t.driver, sign: side(m.get(t.coefficient)) }, { id: t.coefficient, sign: side(m.get(t.driver)) }])]
    return [{ id: r.start, sign: 1 }, ...r.inflows.map((i) => ({ id: i, sign: 1 })), ...r.outflows.map((i) => ({ id: i, sign: -1 }))]
  })
}

const isDerived = (rec) => rec.family === 'quantity' && (rec.role === 'derived' || rec.assertion.kind === 'derived')

export function describe(rec, form) {
  const m = byId(form)
  const N = (id) => nameOf(m, id)
  switch (rec.family) {
    case 'quantity': return {
      label: rec.label, kind: 'quantity', family: 'quantity',
      after: isDerived(rec) ? `Worked out from ${partsOf(form.records, rec.id).map(N).join(' and ') || 'the other figures'}` : figure(rec.assertion, rec.unit),
    }
    case 'relation': {
      if (rec.form === 'influence') return { label: `${N(rec.from)} and ${N(rec.to)}`, after: `${N(rec.from)} ${rec.direction === 'up' ? 'pushes up' : rec.direction === 'down' ? 'pushes down' : rec.direction === 'conditional' ? 'sometimes moves' : rec.direction === 'disputed' ? 'is disputed as moving' : 'may move'} ${N(rec.to)} (${rec.confidence})`, kind: 'relation', family: 'relation' }
      let how
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

/** Which of the reading card's sections a record sits under. The composition rule lives here. */
export function groupOf(rec) {
  if (rec.family === 'left_out') return 'left_out'
  if (rec.origin?.by === 'structure') return 'other'      // plumbing: a constant or a conversion, nobody's figure
  if (rec.family === 'relation') return 'other'            // how things are worked out: folded by default
  if (isDerived(rec)) return 'other'                       // worked out by the model, not given by anyone
  return rec.origin?.by === 'person' ? 'used' : 'inferred' // the person's first; Olumi's what-ifs behind
}

/** Within a section the card keeps what the person is deciding (aims, options) ahead of the figures and the reasoning. */
const FAMILY_RANK = { goal: 0, option: 1, limit: 2, quantity: 3, preference: 4, risk: 5, dissent: 6, claim: 7, assumption: 8, condition: 9, evidence: 10, relation: 11, left_out: 12 }

export function rowFor(rec, action, form, before) {
  const d = describe(rec, form)
  const by = rec.origin?.by
  const quote = by === 'person' && rec.origin.quote ? ` You said: “${rec.origin.quote}”` : ''
  const basis = by === 'olumi' && rec.origin.basis ? ` Olumi’s reason: ${rec.origin.basis}` : ''
  const plumbing = by === 'structure' ? ' Fixed by how the model is built, not a figure anyone gave.' : ''
  return {
    id: rec.id, kind: d.kind, action, label: (d.label || rec.id).slice(0, 200),
    before: before ?? null,
    // The seam between the sentence and what follows it is made one full stop; the words themselves (a quote, a name, an ellipsis) are never edited.
    after: d.after === null ? null : `${d.after.replace(/\.$/, '')}.${quote}${basis}${plumbing}`,
    author: by === 'person' ? 'person' : 'olumi', group: groupOf(rec), family: d.family,
    ...(by === 'structure' ? { structure: true } : {}),
    ...(rec.family === 'quantity' && rec.assertion.kind === 'asked' ? { asked: true } : {}),
  }
}

/** A decision date as a person reads it ("1 December 2026"); a date core has not resolved yet is said so. */
export function dateWords(date) {
  if (typeof date !== 'string' || date === '') return 'A date not worked out yet'
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  const d = m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))) : null
  return d && !Number.isNaN(d.getTime()) && d.getUTCMonth() === Number(m[2]) - 1 ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d) : date
}
/** The deadline in words, and whose it is: the person's own words, or Olumi's reason. */
export function decideByWords(d) {
  if (!d) return null
  return `${dateWords(d.date)}.${d.origin?.by === 'person' ? (d.origin.quote ? ` You said: “${d.origin.quote}”` : '') : d.origin?.basis ? ` Olumi’s reason: ${d.origin.basis}` : ''}`
}

/**
 * The changes to the model's top-level fields (core's `changes.top`): the question, its name, its time step, the questions to ask
 * oneself, and the decision date. A proposal that changes only these has no changed record, and without these rows it would be a
 * card with nothing listed and an approve button. Each says what it was and what it becomes; the deadline says whose it is.
 * A first draft has nothing to compare with, so it lists only the deadline it proposes.
 */
export function topRows(view) {
  const p = view.pending
  const was = view.version?.form ?? null
  const now = p.form
  const rows = []
  for (const field of p.changes.top ?? []) {
    if (field === 'decide_by') {
      const before = was?.decide_by ?? null, after = now.decide_by ?? null
      if (!before && !after) continue
      const mine = after?.origin?.by === 'person'
      rows.push({ id: 'top:decide_by', kind: 'record', action: !after ? 'remove' : !before ? 'add' : 'change', label: 'Decide by', before: before ? dateWords(before.date) : null, after: decideByWords(after), author: after ? (mine ? 'person' : 'olumi') : 'olumi', group: mine ? 'used' : 'inferred' })
      continue
    }
    if (!was) continue
    const plain = (label, b, a) => { if (b !== a) rows.push({ id: `top:${field}`, kind: 'record', action: 'change', label, before: b ?? null, after: a ?? null, author: 'olumi', group: 'inferred' }) }
    if (field === 'question') plain('The question', was.question, now.question)
    else if (field === 'title') plain('The name', was.title, now.title)
    else if (field === 'period') plain('Time step', was.period, now.period)
    else if (field === 'coaching_questions') plain('Questions to ask yourself', (was.coaching_questions ?? []).join(' '), (now.coaching_questions ?? []).join(' '))
  }
  return rows
}

/** Every change the held proposal makes, as rows: person's records first within a section, stable otherwise. */
export function changeRows(view) {
  const p = view.pending
  const now = byId(p.form), was = byId(view.version?.form)
  const rows = []
  for (const id of p.changes.added) if (now.has(id)) rows.push(rowFor(now.get(id), 'add', p.form))
  for (const id of p.changes.changed) if (now.has(id)) rows.push(rowFor(now.get(id), 'change', p.form, was.has(id) ? describe(was.get(id), view.version.form).after : null))
  for (const id of p.changes.removed) if (was.has(id)) rows.push(rowFor(was.get(id), 'remove', view.version.form, describe(was.get(id), view.version.form).after))
  rows.push(...topRows(view))
  const order = { used: 0, inferred: 1, left_out: 2, other: 3 }
  // What the decision is about (its date, its question) leads its section; then what is being decided, then the figures and reasoning.
  const rank = (r) => (r.id === 'top:decide_by' ? -2 : r.id.startsWith('top:') ? -1 : FAMILY_RANK[r.family === 'claims' ? 'claim' : r.family === 'assumptions' ? 'assumption' : r.family === 'conditions' ? 'condition' : r.family] ?? 99)
  return rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => (order[a.r.group] - order[b.r.group]) || (rank(a.r) - rank(b.r)) || a.i - b.i)
    .map((x) => x.r)
}
