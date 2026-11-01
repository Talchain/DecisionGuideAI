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
export const num = (n) => (typeof n === 'number' && Number.isFinite(n) ? new Intl.NumberFormat('en-GB', { maximumFractionDigits: 6 }).format(n) : String(n))
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

/**
 * The parts of ONE definition, each with whether it is taken away: a sum part with sign -1 is subtracted, a product part with a
 * negative power is divided by, a stock's outflows are taken out; everything else (a start, an inflow, an effect's base, driver and
 * coefficient) is added or multiplied in. This is what a definition link is drawn from.
 */
export function signedPartsOf(r) {
  if (r.family !== 'relation' || r.form === 'influence') return []
  if (r.form === 'sum') return r.parts.map((p) => ({ id: p.id, takenAway: p.sign < 0 }))
  if (r.form === 'product') return r.parts.map((p) => ({ id: p.id, takenAway: p.power < 0 }))
  if (r.form === 'effect') return [r.base, ...r.terms.flatMap((t) => [t.driver, t.coefficient])].map((id) => ({ id, takenAway: false }))
  return [{ id: r.start, takenAway: false }, ...r.inflows.map((id) => ({ id, takenAway: false })), ...r.outflows.map((id) => ({ id, takenAway: true }))]
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
    after: d.after === null ? null : `${d.after}.${quote}${basis}${plumbing}`.replace(/\.\./g, '.'),
    author: by === 'person' ? 'person' : 'olumi', group: groupOf(rec), family: d.family,
    ...(by === 'structure' ? { structure: true } : {}),
    ...(rec.family === 'quantity' && rec.assertion.kind === 'asked' ? { asked: true } : {}),
  }
}

/** Every change the held proposal makes, as rows: person's records first within a section, stable otherwise. */
export function changeRows(view) {
  const p = view.pending
  const now = byId(p.form), was = byId(view.version?.form)
  const rows = []
  for (const id of p.changes.added) if (now.has(id)) rows.push(rowFor(now.get(id), 'add', p.form))
  for (const id of p.changes.changed) if (now.has(id)) rows.push(rowFor(now.get(id), 'change', p.form, was.has(id) ? describe(was.get(id), view.version.form).after : null))
  for (const id of p.changes.removed) if (was.has(id)) rows.push(rowFor(was.get(id), 'remove', view.version.form, describe(was.get(id), view.version.form).after))
  const order = { used: 0, inferred: 1, left_out: 2, other: 3 }
  return rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => (order[a.r.group] - order[b.r.group]) || ((FAMILY_RANK[a.r.family === 'claims' ? 'claim' : a.r.family === 'assumptions' ? 'assumption' : a.r.family === 'conditions' ? 'condition' : a.r.family] ?? 99) - (FAMILY_RANK[b.r.family === 'claims' ? 'claim' : b.r.family === 'assumptions' ? 'assumption' : b.r.family === 'conditions' ? 'condition' : b.r.family] ?? 99)) || a.i - b.i)
    .map((x) => x.r)
}
