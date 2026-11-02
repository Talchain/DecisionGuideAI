/**
 * olumi-core's labelled Run facts (`about.form === 'labels'`, science step 5), as DGAI's own words. The rules (Paul's brief): code writes
 * labels, values and status only. So here:
 *   - a labelled fact's `text` is NEVER read; every word is built from its `value` and its structured `about`, and from the model's own
 *     records for names (`nameOf`);
 *   - a reason code is mapped to a plain message of DGAI's own; an unknown code gets a generic honest message (never a crash, never dropped);
 *   - a fixed chance or limit is said here from `about.chance` ("always meets", "never meets"), never from the status marker;
 *   - a number is made only by a named formatter (`chancePct`, `apart`) or comes from core's `value` as stored.
 * Flag off, none of this runs: a fact with no `about.form` is read exactly as before (model.mjs).
 */
import { nameOf } from './words.mjs'

export const isLabels = (f) => f?.about?.form === 'labels'

/** The kinds core writes into prose as their value (`cited[id]` is today's clause). A fixed chance or limit is NOT one: it is a marker. */
export const WRITTEN_IN = new Set(['chance', 'range', 'limit', 'outside', 'driver', 'input'])
/** May a reply's `[F#]` for this fact be spliced from `cited[id]`? Only a written-in kind that is not fixed. */
export const splices = (kind, about) => WRITTEN_IN.has(kind) && about?.fixed !== true

/** A sampled chance, as core's `pct` writes it (never certain: 0 is "under 1%", 1 is "over 99%"). Held equal to core's by labels spec. */
export function chancePct(c) {
  if (c >= 1) return 'over 99%'
  if (c <= 0) return 'under 1%'
  if (c < 0.005) return 'under 1%'
  if (c > 0.995) return 'over 99%'
  return `about ${Math.round(c * 100)}%`
}
/** Two chances a comparison names, with enough decimals to differ (up to three), as core's `apart`. */
export function apart(a, b) {
  const at = (c, d) => { const p = c * 100, step = 10 ** -d; return p < step ? `under ${step}%` : p > 100 - step ? `over ${+(100 - step).toFixed(d)}%` : `about ${p.toFixed(d)}%` }
  let x = chancePct(a), y = chancePct(b)
  for (let d = 1; x === y && d <= 3; d++) { x = at(a, d); y = at(b, d) }
  return [x, y]
}

const q = (name) => `‘${name}’`
const list = (items) => (items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`)
const nameQ = (m, id) => q(nameOf(m, id))
const namesQ = (m, ids) => list((ids ?? []).map((id) => nameQ(m, id)))
const arr = (x) => (Array.isArray(x) ? x : [])

// ── reasons ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Every code the compiler (step 5a) and the engine give (32 values in all, `unlisted` included), in DGAI's words. `n` is the records the reason is about, named ('' when none).
 * Nothing here is a number or a verdict: each says what is missing or why a result is not given.
 */
const REASONS = {
  no_measure: (n) => (n ? `${n} has no way of being measured yet.` : 'Nothing here has a way of being measured yet.'),
  no_aim_measure: () => 'The aim has no way of being measured yet, so this cannot be worked out.',
  asked: (n) => (n ? `Waiting for your answer on ${n}.` : 'Waiting for an answer from you.'),
  unmeasured: (n) => (n ? `${n} has no unit, so it cannot be measured.` : 'A figure has no unit, so it cannot be measured.'),
  figure_unknown: (n) => (n ? `${n} has no value yet.` : 'A figure has no value yet.'),
  figure_unsupported: (n) => (n ? `Nothing yet supports a value for ${n}.` : 'Nothing yet supports a value for a figure.'),
  figure_not_applicable: (n) => (n ? `${n} is marked not applicable here, so it has no value to use.` : 'A figure is marked not applicable here, so it has no value to use.'),
  needs_reading: (n) => (n ? `Olumi needs to know how to read ${n}: as firm ends or as a rough estimate.` : 'Olumi needs to know how to read a range: as firm ends or as a rough estimate.'),
  bounds_leave_nothing: (n) => (n ? `The bounds given for ${n} leave no possible value.` : 'The bounds given for a figure leave no possible value.'),
  outside_bounds: (n) => (n ? `${n} lies outside the bounds given for it.` : 'A figure lies outside the bounds given for it.'),
  timing_unsupported: (n) => (n ? `The timing of ${n} is not something the model can use yet.` : 'A timing in the model is not something it can use yet.'),
  range_unreadable: (n) => (n ? `The range given for ${n} cannot be read as it stands.` : 'A range given cannot be read as it stands.'),
  link_in_words: (n) => (n ? `${n} is a link stated only in words, so it is never calculated.` : 'A link is stated only in words, so it is never calculated.'),
  risk_read_once: (n) => (n ? `${n} is a risk the calculation counts once as written, not from draw to draw.` : 'A risk is counted once as written, not from draw to draw.'),
  risk_unsized: (n) => (n ? `${n} is a risk the calculation cannot size.` : 'A risk is one the calculation cannot size.'),
  needs_deadline: () => 'This depends on when things start, and the model has no deadline to measure from.',
  window_unmeasured: () => 'The period this is measured over has no way of being measured yet.',
  window_not_known: () => 'The period this is measured over is not known yet.',
  window_is_range: () => 'The period this is measured over is a range, which the model cannot use yet.',
  change_in_rate: () => 'The aim is a change in a rate, which the model cannot measure yet.',
  change_from_changing_option: () => 'The aim is a change from a figure that the option itself changes, so there is nothing fixed to compare against.',
  change_under_risk: () => 'The aim is a change that depends on a risk the calculation cannot size.',
  ruled_out: (n) => (n ? `${n} has been ruled out.` : 'An option has been ruled out.'),
  removed: (n) => (n ? `${n} has been removed.` : 'A record has been removed.'),
  waits_on_aim: () => 'This waits until the aim can be worked out.',
  waits_on_limit: () => 'This waits until the limit can be worked out.',
  model_errors: () => 'The model has errors that need fixing before it can be run.',
  schema: () => 'The model is not in a shape Olumi can check.',
  out_of_domain: (n) => (n ? `In some draws ${n} took a value that is not possible for it, so this cannot be worked out.` : 'In some draws a figure took a value that is not possible for it, so this cannot be worked out.'),
  no_goals: () => 'There is no aim to measure against yet.',
  no_option_change: () => 'No option changes anything this aim measures, so there is nothing to compare.',
  unlisted: () => 'Olumi could not work this out, and has no plain reason to give for it.',
}
export const REASON_CODES = Object.keys(REASONS)
const GENERIC_REASON = 'Olumi could not work this out, and cannot yet say why in plain words.'
/** One reason as DGAI's message. An unknown code (or a figure-status code `figure_*` it does not list) gets the generic honest message. */
export function reasonMessage(code, ids, m) {
  const n = namesQ(m, ids)
  if (typeof code === 'string' && Object.hasOwn(REASONS, code)) return REASONS[code](n)
  return GENERIC_REASON
}
/** The reasons of a blocker or wait as { code, message }; none given is still one honest message, never nothing. */
export function reasonsOf(about, m) {
  const rs = arr(about?.reasons).filter((r) => r && typeof r === 'object')
  if (rs.length === 0) return [{ code: 'unlisted', message: GENERIC_REASON }]
  return rs.map((r) => ({ code: typeof r.code === 'string' ? r.code : 'unlisted', message: reasonMessage(r.code, arr(r.ids), m) }))
}

// ── provenance (the §3.3 block) ──────────────────────────────────────────────────────────────────────────────────────────

/** A figure id of the block: a quantity of the model, or `<option>__<quantity>` (an Olumi option's own setting of that quantity). */
function figureName(m, id) {
  if (m.has(id)) return nameQ(m, id)
  const at = typeof id === 'string' ? id.indexOf('__') : -1
  if (at > 0) {
    const option = id.slice(0, at), quantity = id.slice(at + 2)
    if (m.has(option) && m.has(quantity)) return `${nameQ(m, quantity)} as ${nameQ(m, option)} sets it`
  }
  return q(id)
}
/** What a finding rests on that is Olumi's or approximate, and the premises it rests on: one plain sentence, or ''. */
export function restsWords(a, m) {
  const parts = []
  const figs = arr(a?.olumi_figures).filter((x) => x && typeof x.id === 'string')
  if (figs.length) {
    const unapproved = figs.some((x) => x.approval !== 'approved')
    parts.push(`Olumi's what-if figures for ${list(figs.map((x) => figureName(m, x.id)))}${unapproved ? ' (not yet approved)' : ''}`)
  }
  // What Olumi proposed is said with where it stands: one still proposed is "not yet approved", one the model now holds as approved is "approved".
  for (const [key, noun] of [['olumi_links', 'links'], ['olumi_mechanisms', 'calculations']]) {
    const got = arr(a?.[key]).filter((x) => x && typeof x === 'object')
    if (got.some((x) => x.approval !== 'approved')) parts.push(`${noun} Olumi proposed (not yet approved)`)
    if (got.some((x) => x.approval === 'approved')) parts.push(`${noun} Olumi proposed (approved)`)
  }
  if (a?.olumi_reading === true) parts.push("Olumi's reading of the aim")
  if (a?.target_by === 'olumi') parts.push(`a target Olumi proposed${a.target_approval === 'approved' ? '' : ' (not yet approved)'}`)
  const approx = arr(a?.approx_figures).filter((x) => typeof x === 'string')
  if (approx.length) parts.push(`${list(approx.map((x) => figureName(m, x)))}, which they gave as approximate and Olumi reads as within 10% either way`)
  const premises = arr(a?.rests).filter((x) => typeof x === 'string')
  if (premises.length) parts.push(`the premises ${list(premises.map((x) => nameQ(m, x)))}`)
  return parts.length ? `It rests on ${list(parts)}.` : ''
}
const sentence = (...bits) => bits.filter(Boolean).join(' ')
/** What a finding's aim leaves out, from the left-out records its provenance block names (`about.leaves`): the records' own stored text, or ''. */
export function leftOutWords(a, m) {
  const left = arr(a?.leaves).map((id) => m.get(id)).filter((r) => r?.family === 'left_out' && typeof r.text === 'string').map((r) => r.text.replace(/\.$/, ''))
  return left.length ? `It leaves out: ${left.join('; ')}.` : ''
}

// ── the Run's own facts ──────────────────────────────────────────────────────────────────────────────────────────────────

const optionQ = (m, a) => nameQ(m, a.option)
const goalQ = (m, a) => nameQ(m, a.goal)

/** A fixed chance or limit says itself: from about.chance, 1 is "always", 0 is "never". Null when the chance is neither (then the value is shown as stored). */
const fixedSide = (a) => (a?.chance === 1 ? 'always' : a?.chance === 0 ? 'never' : null)

/** A chance: { display, face }. */
export function chanceWords(f, m) {
  const a = f.about
  if (a.fixed === true) {
    const side = fixedSide(a)
    if (side) {
      const display = `${side} meets`
      return { display, face: `${display}: ${sentence(`${optionQ(m, a)} ${display} ${goalQ(m, a)} in this model: nothing uncertain reaches it, so the figures fix this rather than a chance.`, restsWords(a, m))}` }
    }
    return { display: f.value, face: `${f.value}: ${sentence(`${optionQ(m, a)} and ${goalQ(m, a)}: fixed by the figures, not a chance.`, restsWords(a, m))}` }
  }
  return { display: f.value, face: `${f.value}: ${sentence(`The chance that ${optionQ(m, a)} meets ${goalQ(m, a)}, in this model on current information.`, restsWords(a, m))}` }
}
/** A range of the aim's measure under an option. */
/** How the aim measures its quantity, when it is not the plain level at the end: a change, a share per something, a total or an average over a window. */
export function measureWords(goal, m) {
  const me = goal?.measure
  if (!me?.quantity) return null
  const bits = []
  if (me.frame && me.frame !== 'level') bits.push(`as a ${String(me.frame).replace(/_/g, ' ')}`)
  if (me.aggregation && me.aggregation !== 'end') bits.push(`${String(me.aggregation).replace(/_/g, ' ')} over its period`)
  if (me.per) bits.push(`per ${nameQ(m, me.per)}`)
  return `${nameQ(m, me.quantity)}${bits.length ? ` (${bits.join(', ')})` : ''}`
}
export function rangeWords(f, m, goal) {
  const a = f.about
  const measure = measureWords(goal, m) ?? goalQ(m, a)
  const lead = a.low === a.high ? `Under ${optionQ(m, a)}, ${measure} is this in at least 8 draws in 10.` : `Under ${optionQ(m, a)}, ${measure} is likely to be in this range (8 draws in 10).`
  return `${f.value}: ${sentence(lead, restsWords(a, m))}`
}
/** A driver: the figure the chance moves most with, and its chances over the lowest and highest third of that figure's draws. */
export function driverWords(f, m) {
  const a = f.about
  const fig = typeof a.quantity === 'string' ? ` with ${nameQ(m, a.quantity)}` : ''
  return `${f.value}: ${sentence(`Under ${optionQ(m, a)}, the chance of meeting ${goalQ(m, a)} moves most${fig}: these are its chances over the lowest and highest third of that figure's draws.`, restsWords(a, m))}`
}
/** A limit ("stays within") or the outside of it: a note. */
export function limitWords(f, m) {
  const a = f.about
  if (f.about.kind === 'limit' && a.fixed === true) {
    const side = fixedSide(a)
    if (side) { const display = `${side} within`; return `${display}: ${sentence(`${optionQ(m, a)} ${side} stays within ${nameQ(m, a.limit)} in this model: nothing uncertain reaches it, so the figures fix this rather than a chance.`, restsWords(a, m))}` }
    return `${f.value}: ${sentence(`${optionQ(m, a)} and ${nameQ(m, a.limit)}: fixed by the figures, not a chance.`, restsWords(a, m))}`
  }
  const verb = a.kind === 'outside' ? 'goes outside' : 'stays within'
  return `${f.value}: ${sentence(`The chance that ${optionQ(m, a)} ${verb} ${nameQ(m, a.limit)}, in this model.`, restsWords(a, m))}`
}

/** Olumi's what-if range (an input fact that is a range and Olumi's): not their figure, with the basis the record gives. */
export function whatIfWords(f, m) {
  const a = f.about
  const basis = m.get(a.quantity)?.origin?.basis
  return sentence(`Olumi's what-if for ${nameQ(m, a.quantity)}, not their figure: ${f.value}.`, typeof basis === 'string' && basis.trim() ? `Basis: ${basis.trim().replace(/[.!?]$/, '')}.` : '')
}

/**
 * The leader: most_likely or none_clearly, as a LABEL and core's own labels beside it, never a sentence of ours (spec §3.0: the words of a comparison are the
 * AI's; review 00008 #2). `Most likely: ‘A’, about 50%` (or `Most likely: none separated`), then, only for what the fact states, `Next`, `Top two`, how the
 * two were told apart, the swing figure and the option that leads at each end of it, and the options not compared. Chances are made by `chancePct` and `apart`.
 */
export function leaderWords(f, m, notCompared = []) {
  const a = f.about
  const both = typeof a.chance === 'number' && typeof a.next_chance === 'number'
  const [first, second] = both ? apart(a.chance, a.next_chance)
    : [typeof a.chance === 'number' ? chancePct(a.chance) : null, typeof a.next_chance === 'number' ? chancePct(a.next_chance) : null]
  const withChance = (name, chance) => (chance ? `${name}, ${chance}` : name)
  const pairs = []
  if (a.kind === 'most_likely') {
    pairs.push(['Most likely', withChance(optionQ(m, a), first)])
    if (a.next) pairs.push(['Next', withChance(nameQ(m, a.next), second)])
  } else {
    pairs.push(['Most likely', 'none separated'])
    if (a.top) pairs.push(['Top two', [withChance(nameQ(m, a.top), first), a.next ? withChance(nameQ(m, a.next), second) : null].filter(Boolean).join(', ')])
  }
  if (a.separated_by === 'paired') pairs.push(['Compared', 'on the same draws'])
  else if (a.separated_by === 'intervals') pairs.push(['Compared', 'by the uncertainty around each chance'])
  if (a.leads_when && typeof a.leads_when === 'object') {
    const w = a.leads_when
    pairs.push(['Swing figure', nameQ(m, w.quantity)], ['Leads when low', nameQ(m, w.low_leader)], ['Leads when high', nameQ(m, w.high_leader)])
  }
  if (notCompared.length) pairs.push(['Not compared', namesQ(m, notCompared)])
  return sentence(`${pairs.map(([label, item]) => `${label}: ${item}`).join('; ')}.`, restsWords(a, m))
}

/** A blocker or wait: its short phrase, then each reason in DGAI's words, the draws it happened in and the figures it was about. */
export function blockerWords(f, m) {
  const a = f.about
  const reasons = reasonsOf(a, m)
  const draws = typeof a.draws === 'number' && a.draws > 0 ? `This happened in ${a.draws} of the Run's draws.` : ''
  const named = new Set(arr(a.reasons).flatMap((r) => arr(r?.ids)))
  const extra = arr(a.figures_out).filter((id) => !named.has(id))
  const figures = extra.length ? `Figures involved: ${namesQ(m, extra)}.` : ''
  return { reasons, why: sentence(...reasons.map((r) => r.message), draws, figures, restsWords(a, m)) }
}
/** What a labelled wait or blocker waits ON: the questions it asks, and the figures its reasons name that are still to be given. */
export function waitsOnIds(f, m) {
  const a = f.about
  const asked = (id) => { const r = m.get(id); return r?.family === 'quantity' && r.assertion?.kind === 'asked' }
  const fromReasons = arr(a.reasons).filter((r) => r?.code === 'asked').flatMap((r) => arr(r.ids))
  return [...new Set([...arr(a.asks), ...fromReasons])].filter((id) => typeof id === 'string' && (a.kind === 'waits' || asked(id)))
}
/** A whole-aim or whole-limit blocker or wait, as a note: the short phrase, what it is about, and why. */
export function holdNote(f, m) {
  const a = f.about
  const target = a.limit ?? a.goal
  const about = a.option ? (target ? `${nameQ(m, a.option)} against ${nameQ(m, target)}` : nameQ(m, a.option)) : target ? nameQ(m, target) : ''
  const { why } = blockerWords(f, m)
  return `${f.value}: ${sentence(about && a.kind === 'waits' ? `${about} is waiting.` : about ? `${about} cannot be ${a.limit ? 'checked' : 'worked out'} yet.` : '', why)}`
}

// ── the science modules (markers) ───────────────────────────────────────────────────────────────────────────────────────

/** The module facts that are markers: `value` is the marker and everything else is in `about`. */
export const MODULE_KINDS = new Set(['direction', 'worth', 'failure', 'tipping', 'reliance'])
/**
 * A marker beside the names it is about (option, aim or limit, figure): the value as stored first, then the conditions it holds under, each a `label: item`
 * pair from core's structure and never a sentence of ours (review 00008 #3). A tipping threshold holds for the figure's range (`about.shown['tips:range']`), with
 * the other figures held at their middles (`held`, each printed in `shown['tips:held:<id>']`) and, when a risk was read, only for the states of it that
 * `when` names (`risk: ‘Oven repair’, happened`): drop those and a threshold that holds under one state reads as holding always. A string core did not print is
 * never made here: a held figure without one is named with no number. Worth and failure say what they did not cover.
 */
export function moduleNote(f, m) {
  const a = f.about
  const names = [a.option, a.goal ?? a.limit, a.figure ?? a.quantity].filter((id) => typeof id === 'string' && id).map((id) => nameQ(m, id))
  const printed = (key) => (typeof a.shown?.[key] === 'string' && a.shown[key] !== '' ? a.shown[key] : null)
  const pairs = []
  if (a.kind === 'tipping') {
    const range = printed('tips:range')
    if (range) pairs.push(['range', range])
    for (const h of arr(a.held).filter((x) => x && typeof x.quantity === 'string')) {
      const p = printed(`tips:held:${h.quantity}`)
      pairs.push(['held at middle', p ? `${nameQ(m, h.quantity)}, ${p}` : nameQ(m, h.quantity)])
    }
    for (const w of arr(a.when).filter((x) => x && typeof x.risk === 'string')) {
      pairs.push(['risk', `${nameQ(m, w.risk)}, ${w.fired === true ? 'happened' : w.fired === false ? 'not happened' : 'state not given'}`])
    }
  }
  const notCovered = [...arr(a.excluded_limits), ...arr(a.omitted_limits)].filter((id) => typeof id === 'string')
  if (notCovered.length) pairs.push(['not covered', namesQ(m, notCovered)])
  const notCompared = arr(a.excluded_options).filter((id) => typeof id === 'string')
  if (notCompared.length) pairs.push(['options not compared', namesQ(m, notCompared)])
  return sentence(`${names.join(', ')} — ${f.value}${pairs.map(([label, item]) => `; ${label}: ${item}`).join('')}.`, restsWords(a, m))
}
const MODULE_WORDS = { routes: 'direction', worth: 'worth finding out', failure: 'what failure looks like', reliance: 'reliance on Olumi\'s ranges', tipping: 'where it tips', views: 'differing views' }
/** The stored `science` record: the modules that said nothing, with their reason. Silence is by rule and never evidence that there is nothing to find. */
export function silenceNote(science) {
  const quiet = arr(science?.modules).filter((x) => x && ['floor', 'none', 'refused', 'capped'].includes(x.status))
  if (quiet.length === 0) return null
  const one = (x) => `${MODULE_WORDS[x.module] ?? String(x.module).replace(/_/g, ' ')}${x.reason ? ` (${String(x.reason).replace(/_/g, ' ')})` : ''}`
  return `Checks that said nothing here: ${list(quiet.map(one))}. That is not a finding that there is nothing to find.`
}

/** A figure no result used: its name and the figure as stored. */
export const unusedWords = (f, m) => `${nameQ(m, f.about.quantity)} (${f.value})`
