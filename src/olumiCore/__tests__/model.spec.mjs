import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { graphOf, canonicalOf, analysisViewOf, leftOutOf, sayFact } from '../../../scripts/olumi-core/lib/model.mjs'
import { rev16, revSaved16 } from '../../../scripts/olumi-core/lib/ids.mjs'
import { parseCanonicalAnalysisView } from '../../canvas/runView/canonicalAnalysisView'
import { runViewOf } from '../../canvas/runView/runView'
import { resolveFactorStoredRangeLine } from '../../canvas/nodes/shared/factorStatedRange'
import { programQuantityOf, programLinkOperator, programFormulaWords } from '../../canvas/nodes/shared/savedModelProgram'
import { mapDraftEdgeToCanvas } from '../../canvas/utils/applyDraftResult'
import { resolveEdgeDirectionDisplay, resolveEdgeValueDisplay } from '../../canvas/domain/edgeValueProvenance'
import { getEdgeLabel } from '../../canvas/domain/edgeLabels'
import { unwrapInterventionValue } from '../../canvas/utils/labelUtils'

const here = path.dirname(fileURLToPath(import.meta.url))
const fx = (n) => JSON.parse(fs.readFileSync(path.join(here, 'fixtures', n), 'utf8'))
const approved = fx('view-approved.json')

describe('the person\'s stated range reaches the card and the inspector', () => {
  const { nodes } = graphOf(approved.version.form)
  const per = nodes.find((n) => n.id === 'per_specialist')
  it('the node carries the range as DGAI\'s own range line reads it, and the likeliest value stays the figure', () => {
    expect(per.observed_state).toMatchObject({ value: 20, raw_value: 20, range: { low: 10, high: 30 } })
    expect(resolveFactorStoredRangeLine({ observedState: per.observed_state })).toBe('Range: 10–30 ticket/week/specialist')
  })
  it('a point figure carries no range, and a derived figure no value', () => {
    expect(nodes.find((n) => n.id === 'existing_capacity').observed_state.range).toBeUndefined()
    expect(nodes.find((n) => n.id === 'total_capacity').observed_state).toBeUndefined()
  })
  it('the canonical model keeps low and high for the same quantity (what the card\'s program reader uses)', () => {
    const canonical = canonicalOf(approved.version.form, true)
    const q = programQuantityOf({ living_model: { model_program: 'v1', canonical } }, 'per_specialist')
    expect(q).toMatchObject({ value: 20, low: 10, high: 30, author: 'person', approval: 'approved' })
  })
  it('a held proposal is "proposed", an approved version "approved"', () => {
    expect(canonicalOf(approved.version.form, false).quantities[0].approval).toBe('proposed')
  })
})

describe('the Run, from structured facts (API v1.4), read by DGAI\'s own parser', () => {
  const view = analysisViewOf(approved)
  it('is a valid canonical_analysis_view that binds to the Run the turn names', () => {
    const parsed = parseCanonicalAnalysisView(view)
    expect(parsed).not.toBeNull()
    expect(runViewOf(null, parsed).boundToCurrentCanonical()).toBe(true)
  })
  it('puts each chance on its own option by the fact\'s structured option and goal, not by its words', () => {
    const add = view.options.find((o) => o.option_id === 'add_one')
    expect(add.cell).toMatchObject({ kind: 'figure', display: 'about 50%' })
    expect(view.options.find((o) => o.option_id === 'hold').cell.display).toBe('never met in this model')
  })
  it('names the driver from the structured driver fact', () => {
    const add = view.options.find((o) => o.option_id === 'add_one')
    expect(add.main_driver).toMatchObject({ kind: 'available', driver: { kind: 'driver', option: 'add_one', low: 0, high: 1 } })
  })
  it('says what the aim leaves out once, from the model\'s own left-out records, never by reading fact text', () => {
    expect(leftOutOf(approved.version.form)).toEqual(['How the team feels about a new hire'])
    expect(view.goal_chance.notes).toEqual(['This leaves out: How the team feels about a new hire.'])
    const f = approved.version.facts.find((x) => x.about?.kind === 'chance' && x.about.option === 'add_one')
    const face = view.options.find((o) => o.option_id === 'add_one').cell.face
    expect(f.text).toMatch(/It leaves out:/)
    expect(face).not.toMatch(/It leaves out:/)
  })
  it('strips the repeat only when it equals what the records say, otherwise leaves the words alone', () => {
    expect(sayFact('A. It leaves out: X.', ['X'])).toBe('A.')
    expect(sayFact('A. It leaves out: Y.', ['X'])).toBe('A. It leaves out: Y.')
    expect(sayFact('A.', [])).toBe('A.')
  })
  it('a range fact (low, median, high) becomes a range cell when an option has no chance', () => {
    const v = JSON.parse(JSON.stringify(approved))
    v.version.facts = v.version.facts.filter((f) => !(f.about?.kind === 'chance' && f.about.option === 'add_one'))
    const cell = analysisViewOf(v).options.find((o) => o.option_id === 'add_one').cell
    expect(cell).toMatchObject({ kind: 'range', detail: { low: expect.any(Number), median: expect.any(Number), high: expect.any(Number), unit: 'ticket/week', olumi: false } })
    expect(parseCanonicalAnalysisView(analysisViewOf(v))).not.toBeNull()
  })
  it('names Olumi\'s what-if figures once, from the structured input facts (about.olumi), and only when there are some', () => {
    expect(view.goal_chance.notes).toHaveLength(1)
    const v = JSON.parse(JSON.stringify(approved))
    v.version.facts.push({ id: 'F99', value: '2 to 10 ticket/week', text: 'Olumi\'s what-if for staff absence, not their figure: 2 to 10 ticket/week.', about: { kind: 'input', quantity: 'per_specialist', olumi: true, low: 2, high: 10, unit: 'ticket/week' } })
    const notes = analysisViewOf(v).goal_chance.notes
    expect(notes).toEqual(['This leaves out: How the team feels about a new hire.', 'Olumi’s what-if figures, until you give your own: per specialist.'])
    expect(parseCanonicalAnalysisView(analysisViewOf(v))).not.toBeNull()
  })
  it('has no Run view before there is an approved version', () => {
    expect(analysisViewOf(fx('view-first-pending.json'), 'x')).toBeNull()
  })
})

describe('with more than one aim, the Run is about the aim core ran, and the other aims\' chances are not dropped (finding: the first aim has no measure, so every option showed no chance)', () => {
  const clone = (v) => JSON.parse(JSON.stringify(v))
  /** The capture's one aim renamed g2, behind a first aim that has no measure yet. */
  const unmeasurableFirst = () => {
    const v = clone(approved)
    const g = v.version.form.records.find((r) => r.id === 'capacity_goal')
    g.id = 'g2'
    v.version.form.records.splice(v.version.form.records.indexOf(g), 0, { family: 'goal', id: 'capacity_goal', label: 'Enough capacity', measure: null, question: 'What counts as enough?', origin: { by: 'person', quote: 'enough capacity', party: null } })
    for (const f of v.version.facts) if (f.about?.goal === 'capacity_goal') f.about.goal = 'g2'
    return v
  }
  it('the options\' chances come from the aim that has them, not from the first aim in the list', () => {
    const view = analysisViewOf(unmeasurableFirst())
    expect(view.options.map((o) => [o.option_id, o.cell.kind])).toEqual([['hold', 'figure'], ['add_one', 'figure']])
    expect(view.options.find((o) => o.option_id === 'add_one').cell.display).toBe('about 50%')
    expect(view.goal_chance.chance_words).toBe('chance of ‘At least 100 a week’')
    expect(parseCanonicalAnalysisView(view)).not.toBeNull()
  })
  it('what the aim leaves out is that aim\'s, and the leader sentence is about it', () => {
    const view = analysisViewOf(unmeasurableFirst())
    expect(view.goal_chance.notes).toEqual(['This leaves out: How the team feels about a new hire.'])
    expect(view.leader.words).toMatch(/most likely to achieve 'At least 100 a week'/)
  })
  it('two aims with chances: the first with results is the view; the other\'s chances are said in the notes, option by option', () => {
    const v = clone(approved)
    v.version.form.records.push({ family: 'goal', id: 'g2', label: 'At least 120 a week', measure: { ...v.version.form.records.find((r) => r.id === 'capacity_goal').measure, exclusions: [] }, question: null, origin: { by: 'person', quote: 'ideally 120', party: null } })
    const second = (kind, option, value) => ({ id: `X-${kind}-${option}`, value, text: `${kind} ${option}`, about: { kind, option, goal: 'g2' } })
    v.version.facts.push(second('chance', 'add_one', 'about 20%'), second('chance', 'hold', 'never met in this model'))
    const view = analysisViewOf(v)
    expect(view.goal_chance.chance_words).toBe('chance of ‘At least 100 a week’')
    expect(view.options.find((o) => o.option_id === 'add_one').cell.display).toBe('about 50%')
    expect(view.goal_chance.notes).toContain('For the aim ‘At least 120 a week’: ‘Keep current staffing’ never met in this model; ‘Add one specialist’ about 20%.')
    expect(parseCanonicalAnalysisView(view)).not.toBeNull()
  })
  it('a single aim reads exactly as before (no extra note)', () => {
    expect(analysisViewOf(approved).goal_chance.notes).toEqual(['This leaves out: How the team feels about a new hire.'])
  })
})

describe('the Run is current only for the model it was run on (finding 12)', () => {
  const withChange = fx('view-approved-with-change.json')
  it('with nothing waiting, the Run is stamped with the graph shown and is current (so the turn\'s Run is adopted)', () => {
    const view = analysisViewOf(approved)
    expect(revSaved16(approved)).toBe(rev16(approved))
    expect(view.run.graph_hash_at_run).toBe(rev16(approved))
    expect(view.staleness.stale).toBe(false)
    expect(runViewOf(null, parseCanonicalAnalysisView(view)).boundToCurrentCanonical()).toBe(true)
  })
  it('with a change waiting, the results are those of the saved model: stamped with ITS hash, not the held graph\'s, and not current', () => {
    const view = analysisViewOf(withChange)
    expect(rev16(withChange)).not.toBe(revSaved16(withChange))
    expect(view.run.graph_hash_at_run).toBe(revSaved16(withChange))
    expect(view.run.graph_hash_at_run).not.toBe(rev16(withChange))
    expect(view.staleness.stale).toBe(true)
    expect(view.staleness.reason).toMatch(/waiting for your confirmation/)
    expect(view.face_when_stale).toMatch(/model before/)
  })
  it('DGAI then shows no chance as current: each option\'s cell says the results are for the model before the change', () => {
    const run = runViewOf(null, parseCanonicalAnalysisView(analysisViewOf(withChange)))
    expect(run.chancesNotCurrent()).toBe(true)
    expect(run.boundToCurrentCanonical()).toBe(false)
    expect(run.chanceCellOf('add_one', {}).text).toMatch(/model before/)
  })
  it('the Run keeps the saved version\'s identity while a change waits (it is that version\'s Run), so it is still the one the Analysis tab names', () => {
    expect(analysisViewOf(withChange).run.run_id).toBe(analysisViewOf(approved).run.run_id)
  })
})

// ── the model-audit shapes (captured from the real olumi-core v1.4 with the scripted AI) ─────────────────────────────────────
const rich = fx('view-rich-approved.json')
const richForm = rich.version.form
const richGraph = graphOf(richForm)
const nodeOf = (g, id) => g.nodes.find((n) => n.id === id)
const edgeOf = (g, id) => g.edges.find((e) => e.id === id)
/** The edge as DGAI's program reader draws it, and the words its label says. */
const drawn = (e) => {
  const data = mapDraftEdgeToCanvas(e, 0, undefined, { program: true }).data
  const direction = resolveEdgeDirectionDisplay(data)
  return { data, direction, label: getEdgeLabel(resolveEdgeValueDisplay(data, 'weight'), resolveEdgeValueDisplay(data, 'beliefExists'), direction, 'human').label }
}

describe('an influence is drawn the way the person stated it (finding 2)', () => {
  it('the capture holds a DISPUTED and an UNKNOWN influence, as core wrote them', () => {
    const inf = richForm.records.filter((r) => r.family === 'relation' && r.form === 'influence')
    expect(inf.map((r) => [r.id, r.direction, r.confidence])).toEqual([['morale_link', 'disputed', 'unsure'], ['infl_unknown', 'unknown', 'unknown']])
  })
  it('a disputed influence is not "up": its direction is undeclared, its existence is not made certain, and its words say it is disputed', () => {
    const e = edgeOf(richGraph, 'morale_link')
    expect(e.effect_direction).toBe('unknown')
    expect(e).not.toHaveProperty('exists_probability')
    expect(e.provenance.reasoning).toMatch(/disagree/i)
    expect(e.provenance.reasoning).toMatch(/unsettle the team/)
  })
  it('DGAI then draws it with no direction and no "Boost", whatever else it says', () => {
    const { direction, label } = drawn(edgeOf(richGraph, 'morale_link'))
    expect(direction.show).toBe(false)
    expect(label).not.toMatch(/Boost|Drag/)
    expect(drawn(edgeOf(richGraph, 'infl_unknown')).label).not.toMatch(/Boost|Drag/)
  })
  it('an influence with a stated direction keeps it (up is a boost, down is a drag)', () => {
    const form = JSON.parse(JSON.stringify(richForm))
    const set = (id, direction, confidence) => { const r = form.records.find((x) => x.id === id); r.direction = direction; r.confidence = confidence }
    set('morale_link', 'up', 'likely'); set('infl_unknown', 'down', 'likely')
    const g = graphOf(form)
    expect(drawn(edgeOf(g, 'morale_link')).label).toMatch(/Boost/)
    expect(drawn(edgeOf(g, 'infl_unknown')).label).toMatch(/Drag/)
  })
  it('a conditional influence is not drawn as a direction either', () => {
    const form = JSON.parse(JSON.stringify(richForm))
    form.records.find((x) => x.id === 'morale_link').direction = 'conditional'
    const e = edgeOf(graphOf(form), 'morale_link')
    expect(e.effect_direction).toBe('unknown')
    expect(e.provenance.reasoning).toMatch(/depends/i)
  })
})

describe('a definition link says how its part enters the figure: a subtracted part is not a boost (finding: absence drawn as "+ Boost")', () => {
  const clone = () => JSON.parse(JSON.stringify(richForm))
  const withRelation = (mutate) => { const f = clone(); mutate(f); return f }
  const programGraph = (form) => ({ ...graphOf(form), living_model: { model_program: 'v1', canonical: canonicalOf(form, true) } })
  const subtract = withRelation((f) => { f.records.find((r) => r.id === 'total_def').parts[1].sign = -1 })
  const divide = withRelation((f) => {
    const d = f.records.find((r) => r.id === 'added_def'); d.parts[1].power = -1
  })
  const stock = withRelation((f) => {
    f.records = f.records.filter((r) => r.id !== 'total_def')
    f.records.push({ family: 'relation', id: 'total_stock', form: 'stock', defines: 'total_capacity', start: 'existing_capacity', inflows: ['added_capacity'], outflows: ['per_specialist'], origin: { by: 'olumi', basis: 'b' } })
  })
  it('a part with sign -1 is drawn as a drag, not a boost, and DGAI\'s own operator reader says minus', () => {
    const g = programGraph(subtract)
    const e = edgeOf(g, 'added_capacity__total_capacity')
    expect(e.effect_direction).toBe('negative')
    expect(drawn(e).label).toMatch(/Drag/)
    expect(drawn(e).label).not.toMatch(/Boost/)
    expect(programLinkOperator(g, 'added_capacity', 'total_capacity')).toBe('−')
    expect(programLinkOperator(g, 'existing_capacity', 'total_capacity')).toBe('+')
    expect(drawn(edgeOf(g, 'existing_capacity__total_capacity')).label).toMatch(/Boost/)
  })
  it('a part with power -1 (divided by) is a drag and a divide', () => {
    const g = programGraph(divide)
    expect(edgeOf(g, 'per_specialist__added_capacity').effect_direction).toBe('negative')
    expect(edgeOf(g, 'specialists__added_capacity').effect_direction).toBe('positive')
    expect(programLinkOperator(g, 'per_specialist', 'added_capacity')).toBe('÷')
    expect(programLinkOperator(g, 'specialists', 'added_capacity')).toBe('×')
  })
  it('a stock\'s outflow is a drag and a minus; its start and inflows are a boost and a plus', () => {
    const g = programGraph(stock)
    expect(edgeOf(g, 'per_specialist__total_capacity').effect_direction).toBe('negative')
    expect(edgeOf(g, 'added_capacity__total_capacity').effect_direction).toBe('positive')
    expect(programLinkOperator(g, 'per_specialist', 'total_capacity')).toBe('−')
    expect(programLinkOperator(g, 'added_capacity', 'total_capacity')).toBe('+')
    expect(programLinkOperator(g, 'existing_capacity', 'total_capacity')).toBe('+')
  })
  it('the worked-out figure\'s formula is readable by DGAI, with the same signs', () => {
    expect(programFormulaWords(programGraph(subtract), 'total_capacity')).toBe('existing capacity − added capacity')
    expect(programFormulaWords(programGraph(divide), 'added_capacity')).toBe('specialists ÷ per specialist')
  })
  it('the canonical model carries the relations in the shape DGAI reads, with ids that exist', () => {
    const rels = canonicalOf(subtract, true).relations
    expect(rels.find((r) => r.defines === 'total_capacity')).toMatchObject({ id: 'total_def', form: 'definition', op: 'sum', parts: [{ id: 'existing_capacity', sign: 1 }, { id: 'added_capacity', sign: -1 }] })
    expect(rels.find((r) => r.defines === 'added_capacity')).toMatchObject({ form: 'definition', op: 'product' })
    expect(canonicalOf(stock, true).relations.find((r) => r.defines === 'total_capacity')).toMatchObject({ form: 'stock', start: 'existing_capacity', inflows: ['added_capacity'], outflows: ['per_specialist'] })
    expect(canonicalOf(richForm, true).relations.some((r) => r.form === 'influence')).toBe(false)
  })
  it('an unchanged model still draws every definition link as a plus / times boost', () => {
    const g = programGraph(richForm)
    expect(programLinkOperator(g, 'added_capacity', 'total_capacity')).toBe('+')
    expect(programLinkOperator(g, 'specialists', 'added_capacity')).toBe('×')
  })
})

describe('a risk keeps its effect, its chance and its size (finding 2)', () => {
  const risk = richForm.records.find((r) => r.family === 'risk')
  it('the capture holds the risk: it pushes "per specialist" down, with an occurrence and a severity', () => {
    expect(risk).toMatchObject({ id: 'new_hire_slump', effect_on: 'per_specialist', direction: 'down', occurrence: 'slump_chance', severity: 'slump_keep', mode: 'multiply' })
  })
  it('there is an edge from the risk to what it affects, drawn as a drag, with no certainty made up', () => {
    const e = edgeOf(richGraph, 'new_hire_slump__per_specialist')
    expect(e).toMatchObject({ from: 'new_hire_slump', to: 'per_specialist', effect_direction: 'negative' })
    expect(e).not.toHaveProperty('exists_probability')
    expect(drawn(e).label).toMatch(/Drag/)
  })
  it('the risk card carries how likely it is and what it does, as its own figures, with their ranges', () => {
    const n = nodeOf(richGraph, 'new_hire_slump')
    expect(n.probability).toBe(0.3)
    expect(n.description).toMatch(/between 10% and 50%/)
    expect(n.description).toMatch(/about 30%/)
    expect(n.description).toMatch(/per specialist/)
    expect(n.description).toMatch(/0\.7/)
  })
  it('a stated chance is worded exactly, never rounded to a different figure: 0.4% is not "0%", 12.5% is not "13%" (finding)', () => {
    const form = JSON.parse(JSON.stringify(richForm))
    const set = (id, a) => { form.records.find((r) => r.id === id).assertion = a }
    set('slump_chance', { kind: 'point', value: 0.004, approximate: false })
    let n = nodeOf(graphOf(form), 'new_hire_slump')
    expect(n.description).toMatch(/May happen: 0\.4%\./)
    expect(n.description).not.toMatch(/May happen: 0%/)
    expect(n.probability).toBe(0.004)
    set('slump_chance', { kind: 'point', value: 0.125, approximate: false })
    n = nodeOf(graphOf(form), 'new_hire_slump')
    expect(n.description).toMatch(/May happen: 12\.5%\./)
    set('slump_chance', { kind: 'interval', low: 0.001, high: 0.075, likely: 0.0125, range_kind: 'plausible' })
    expect(nodeOf(graphOf(form), 'new_hire_slump').description).toMatch(/about 1\.25% \(between 0\.1% and 7\.5%\)/)
    set('slump_chance', { kind: 'point', value: 0.00001, approximate: false })
    expect(nodeOf(graphOf(form), 'new_hire_slump').description).toMatch(/May happen: under 0\.01%\./)
  })
  it('its occurrence and severity are not left on the canvas as loose factors', () => {
    expect(nodeOf(richGraph, 'slump_chance')).toBeUndefined()
    expect(nodeOf(richGraph, 'slump_keep')).toBeUndefined()
    // ...and the Model tab still holds them
    expect(canonicalOf(richForm, true).quantities.map((q) => q.id)).toEqual(expect.arrayContaining(['slump_chance', 'slump_keep']))
  })
})

describe('the person\'s limit stays on the canvas and its results reach Analysis (finding 3)', () => {
  it('the capture holds the limit and the figure it is bounded by', () => {
    expect(richForm.records.find((r) => r.family === 'limit')).toMatchObject({ id: 'ceiling', label: 'Capacity ceiling', measure: { quantity: 'total_capacity', cmp: '<=', bound: 'cap' } })
    expect(richForm.records.find((r) => r.id === 'cap').assertion).toMatchObject({ kind: 'point', value: 120 })
  })
  it('the limit is a card: its name, its bound with the way it is measured, whose it is, and the words the person used', () => {
    const n = nodeOf(richGraph, 'ceiling')
    expect(n).toMatchObject({ kind: 'factor', label: 'Capacity ceiling', provenance: 'from_brief', source_quote: 'no more than 120', display_value: 'at most 120 ticket/week' })
    expect(n.observed_state).toMatchObject({ value: 120, raw_value: 120, unit: 'ticket/week', source: 'brief_extraction' })
  })
  it('the card says which way it limits (the figure alone would read as a plain number)', () => {
    expect(nodeOf(richGraph, 'ceiling').description).toBe('A limit on ‘total capacity’: it stays at most 120 ticket/week.')
  })
  it('it hangs off what it limits, as the aim does, and the bound is not drawn a second time', () => {
    expect(edgeOf(richGraph, 'total_capacity__ceiling')).toMatchObject({ from: 'total_capacity', to: 'ceiling', provenance: { definitional: true } })
    expect(nodeOf(richGraph, 'cap')).toBeUndefined()
  })
  it('a limit with no measure yet is still a card, saying so', () => {
    const form = JSON.parse(JSON.stringify(richForm))
    form.records.find((r) => r.id === 'ceiling').measure = null
    const n = nodeOf(graphOf(form), 'ceiling')
    expect(n).toMatchObject({ kind: 'factor', label: 'Capacity ceiling' })
    expect(n.display_value).toMatch(/not yet measurable/i)
  })
  const view = analysisViewOf(rich)
  it('Core\'s limit results (within, and outside) are said beside the chance, per option, from the structured facts', () => {
    const notes = view.goal_chance.notes
    const line = notes.find((x) => /Capacity ceiling/.test(x) && /Add two specialists/.test(x))
    expect(line).toBeDefined()
    expect(line).toMatch(/about 63%/)
    expect(line).toMatch(/about 37%/)
    expect(notes.find((x) => /Capacity ceiling/.test(x) && /Keep current staffing/.test(x))).toMatch(/over 99%/)
    expect(parseCanonicalAnalysisView(view)).not.toBeNull()
  })
  it('a limit core could not check yet is said as not checked, never left out', () => {
    const v = JSON.parse(JSON.stringify(rich))
    v.version.facts = v.version.facts.filter((f) => !['limit', 'outside'].includes(f.about?.kind))
    v.version.facts.push({ id: 'F90', value: 'not checked yet', text: 'Capacity ceiling is not checked yet: the limit has no measure.', about: { kind: 'blocker', limit: 'ceiling' } })
    const notes = analysisViewOf(v).goal_chance.notes
    expect(notes.find((x) => /Capacity ceiling/.test(x))).toMatch(/not checked yet/)
  })
})

describe('an option\'s set figure keeps whose it is and what it is (finding 4)', () => {
  const add1 = nodeOf(richGraph, 'add_one'), add2 = nodeOf(richGraph, 'add_two')
  it('a figure the person gave stays theirs: from the brief, and a plain number', () => {
    expect(add1.interventions.specialists).toMatchObject({ value: 1, source: 'brief_extraction' })
    expect(add1.interventions.specialists).not.toHaveProperty('display_value')
    expect(add1.interventions.specialists.source_words).toMatch(/your brief/i)
  })
  it('Olumi\'s what-if range is Olumi\'s, and its range is what is said: no midpoint is ever worded as a figure', () => {
    const spend = add1.interventions.spend
    expect(spend.source).toBe('cee_hypothesis')
    expect(spend.source_words).toMatch(/Olumi/)
    expect(spend.source_words).not.toMatch(/your brief/i)
    expect(spend.display_value).toBe('between 30,000 and 60,000 EUR')
    expect(JSON.stringify(Object.values(add1.interventions).map((i) => [i.display_value, i.display, i.source_words]))).not.toMatch(/45,?000/)
  })
  it('an Olumi range with a likeliest value says both, and the number is the likeliest', () => {
    const two = add2.interventions.specialists
    expect(two).toMatchObject({ value: 2, source: 'cee_hypothesis' })
    expect(two.display_value).toBe('between 1 and 3 specialist, most likely 2')
  })
  it('DGAI reads the intervention as written (a number it can use, and the words it shows)', () => {
    const { value, displayValue, source } = unwrapInterventionValue(add1.interventions.spend)
    expect(value).toEqual(expect.any(Number))
    expect(displayValue).toBe('between 30,000 and 60,000 EUR')
    expect(source).toBe('cee_hypothesis')
  })
  it('an aim\'s target that is a range is shown as a range, not collapsed to one figure', () => {
    const form = JSON.parse(JSON.stringify(approved.version.form))
    form.records.find((r) => r.id === 'capacity_target').assertion = { kind: 'interval', low: 95, high: 105, range_kind: 'plausible', likely: null }
    const goal = nodeOf(graphOf(form), 'capacity_goal')
    expect(goal.goal_threshold_raw).toBe('95 to 105')
    expect(goal.display_value).toMatch(/95 to 105/)
    expect(goal.goal_threshold_unit).toBe('ticket/week')
  })
  it('a target with a likeliest value keeps it as the figure, and still says the range', () => {
    const form = JSON.parse(JSON.stringify(approved.version.form))
    form.records.find((r) => r.id === 'capacity_target').assertion = { kind: 'interval', low: 95, high: 105, range_kind: 'plausible', likely: 100 }
    const goal = nodeOf(graphOf(form), 'capacity_goal')
    expect(goal.goal_threshold_raw).toBe(100)
    expect(goal.display_value).toMatch(/95 to 105/)
  })
})
