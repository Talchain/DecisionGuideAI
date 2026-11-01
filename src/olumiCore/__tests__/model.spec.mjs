import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { graphOf, canonicalOf, analysisViewOf, leftOutOf, sayFact, modelOf, goalConstraintsOf } from '../../../scripts/olumi-core/lib/model.mjs'
import { rev16, revSaved16 } from '../../../scripts/olumi-core/lib/ids.mjs'
import { parseCanonicalAnalysisView } from '../../canvas/runView/canonicalAnalysisView'
import { runViewOf } from '../../canvas/runView/runView'
import { resolveFactorStoredRangeLine } from '../../canvas/nodes/shared/factorStatedRange'
import { programQuantityOf, programLimitsWithoutFigure } from '../../canvas/nodes/shared/savedModelProgram'
import { resolveOptionIsBaseline } from '../../canvas/utils/baselineDetection'
import { goalConstraintText } from '../../canvas/utils/goalConstraintText'
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
  it('an aim the person set with a target OLUMI proposed is Olumi\'s card: inferred, with none of the person\'s words against the figure', () => {
    const form = JSON.parse(JSON.stringify(approved.version.form))
    const goal = form.records.find((r) => r.id === 'capacity_goal')
    goal.origin = { by: 'person', quote: 'I want more capacity', party: null }
    form.records.find((r) => r.id === 'capacity_target').origin = { by: 'olumi', basis: 'a round figure to test' }
    const node = nodeOf(graphOf(form), 'capacity_goal')
    expect(node.provenance).toBe('ai_inferred')
    expect(node).not.toHaveProperty('source_quote')
    form.records.find((r) => r.id === 'capacity_target').origin = { by: 'person', quote: 'a hundred a week', party: null }
    expect(nodeOf(graphOf(form), 'capacity_goal')).toMatchObject({ provenance: 'from_brief', source_quote: 'I want more capacity' })
  })
  it('a target with a likeliest value keeps it as the figure, and still says the range', () => {
    const form = JSON.parse(JSON.stringify(approved.version.form))
    form.records.find((r) => r.id === 'capacity_target').assertion = { kind: 'interval', low: 95, high: 105, range_kind: 'plausible', likely: 100 }
    const goal = nodeOf(graphOf(form), 'capacity_goal')
    expect(goal.goal_threshold_raw).toBe(100)
    expect(goal.display_value).toMatch(/95 to 105/)
  })
})

// ── tier R step 0: the shim states nothing core never said ───────────────────────────────────────────────────────────────────
const cloneForm = () => JSON.parse(JSON.stringify(richForm))
const relation = (form, id) => form.records.find((r) => r.id === id)

describe('a calculation\'s links bear on what they define the way the relation states (tier R step 0)', () => {
  it('a plain sum and product raise what they define: the capture draws them positive', () => {
    expect(edgeOf(richGraph, 'existing_capacity__total_capacity').effect_direction).toBe('positive')
    expect(edgeOf(richGraph, 'specialists__added_capacity').effect_direction).toBe('positive')
  })
  it('a SUBTRACTED part lowers it: DGAI draws a drag, and the added part still raises', () => {
    const form = cloneForm()
    relation(form, 'total_def').parts[1].sign = -1
    const g = graphOf(form)
    const minus = edgeOf(g, 'added_capacity__total_capacity')
    expect(minus.effect_direction).toBe('negative')
    expect(drawn(minus).direction).toMatchObject({ show: true, direction: 'negative' })
    expect(drawn(minus).label).toMatch(/Drag/)
    expect(edgeOf(g, 'existing_capacity__total_capacity').effect_direction).toBe('positive')
  })
  describe('a DIVISOR lowers the result only when every other factor is known to be positive', () => {
    const divide = (numeratorDomain) => {
      const form = cloneForm()
      relation(form, 'added_def').parts[1].power = -1   // specialists / per_specialist
      relation(form, 'specialists').domain = numeratorDomain
      relation(form, 'specialists').assertion = { kind: 'asked', question: 'How many?' }   // nothing stated: its side comes from its floor or ceiling alone
      return graphOf(form)
    }
    it('a numerator with a floor at or above zero: the divisor lowers it, drawn as a drag', () => {
      const g = divide({ lower: 0, upper: null })
      expect(edgeOf(g, 'per_specialist__added_capacity').effect_direction).toBe('negative')
      expect(drawn(edgeOf(g, 'per_specialist__added_capacity')).label).toMatch(/Drag/)
      expect(edgeOf(g, 'specialists__added_capacity').effect_direction).toBe('positive')
    })
    it('a negative numerator (-100 / x rises as x rises): the divisor raises it, never a drag (the numerator still raises it)', () => {
      const g = divide({ lower: null, upper: 0 })
      expect(edgeOf(g, 'per_specialist__added_capacity').effect_direction).toBe('positive')
      expect(drawn(edgeOf(g, 'per_specialist__added_capacity')).label).not.toMatch(/Drag/)
      expect(edgeOf(g, 'specialists__added_capacity').effect_direction).toBe('positive')
    })
    it('a numerator whose sign nothing fixes, or one that straddles zero: not stated either', () => {
      expect(edgeOf(divide(null), 'per_specialist__added_capacity').effect_direction).toBe('unknown')
      expect(edgeOf(divide({ lower: -5, upper: 5 }), 'per_specialist__added_capacity').effect_direction).toBe('unknown')
    })
  })
  describe('a PRODUCT part bears on the result with the sign of every other factor (review: a negative multiplier turns it round)', () => {
    // specialists × per_specialist = added_capacity; the multiplier is per_specialist.
    const times = (multiplier, specialists = { kind: 'point', value: 5, approximate: false }) => {
      const form = cloneForm()
      relation(form, 'per_specialist').assertion = multiplier
      relation(form, 'specialists').assertion = specialists
      return graphOf(form)
    }
    const dir = (g, from) => edgeOf(g, `${from}__added_capacity`).effect_direction
    it('a positive multiplier: more specialists raise it', () => {
      expect(dir(times({ kind: 'interval', low: 10, high: 30, range_kind: 'plausible', likely: 20 }), 'specialists')).toBe('positive')
      expect(dir(times({ kind: 'point', value: 10, approximate: false }), 'specialists')).toBe('positive')
    })
    it('a NEGATIVE multiplier (specialists x -10): more specialists lower it, drawn as a drag, and the multiplier still raises it', () => {
      const g = times({ kind: 'point', value: -10, approximate: false })
      expect(dir(g, 'specialists')).toBe('negative')
      expect(drawn(edgeOf(g, 'specialists__added_capacity')).label).toMatch(/Drag/)
      expect(dir(g, 'per_specialist')).toBe('positive')
    })
    it('a multiplier whose range SPANS zero: which way it goes is not stated, never a rise', () => {
      const g = times({ kind: 'interval', low: -5, high: 20, range_kind: 'plausible', likely: null })
      expect(dir(g, 'specialists')).toBe('unknown')
      expect(drawn(edgeOf(g, 'specialists__added_capacity')).direction.show).toBe(false)
    })
    it('a multiplier still to be given, or worked out from others, is not stated either', () => {
      expect(dir(times({ kind: 'asked', question: 'How much does each add?' }), 'specialists')).toBe('unknown')
      expect(dir(times({ kind: 'derived' }), 'specialists')).toBe('unknown')
    })
    it('a multiplier wholly below zero as a range lowers it', () => {
      expect(dir(times({ kind: 'interval', low: -30, high: -10, range_kind: 'plausible', likely: null }), 'specialists')).toBe('negative')
    })
    it('a floor or ceiling fixes the side without a stated figure; the part itself counts when it is squared', () => {
      const form = cloneForm()
      relation(form, 'per_specialist').assertion = { kind: 'asked', question: 'x' }
      relation(form, 'per_specialist').domain = { lower: null, upper: 0 }
      relation(form, 'specialists').assertion = { kind: 'point', value: 5, approximate: false }
      expect(dir(graphOf(form), 'specialists')).toBe('negative')
      const sq = cloneForm()
      relation(sq, 'added_def').parts[0].power = 2   // specialists squared x per_specialist
      relation(sq, 'per_specialist').assertion = { kind: 'point', value: 3, approximate: false }
      relation(sq, 'specialists').assertion = { kind: 'asked', question: 'x' }
      expect(dir(graphOf(sq), 'specialists')).toBe('unknown')   // its own side decides, and nothing states it
    })
  })
  describe('a source that contributes more than once to one target keeps a side only if every contribution agrees', () => {
    it('x + x - x: the contributions disagree, so the link is not given a side (not the last term\'s drag)', () => {
      const form = cloneForm()
      relation(form, 'total_def').parts = [{ id: 'existing_capacity', sign: 1 }, { id: 'existing_capacity', sign: 1 }, { id: 'existing_capacity', sign: -1 }, { id: 'added_capacity', sign: 1 }]
      const g = graphOf(form)
      expect(g.edges.filter((e) => e.id === 'existing_capacity__total_capacity')).toHaveLength(1)
      expect(edgeOf(g, 'existing_capacity__total_capacity').effect_direction).toBe('unknown')
      expect(edgeOf(g, 'added_capacity__total_capacity').effect_direction).toBe('positive')
    })
    it('x + x: the same known side twice keeps it', () => {
      const form = cloneForm()
      relation(form, 'total_def').parts = [{ id: 'existing_capacity', sign: 1 }, { id: 'existing_capacity', sign: 1 }]
      expect(edgeOf(graphOf(form), 'existing_capacity__total_capacity').effect_direction).toBe('positive')
    })
    it('future = current + rate × current with a negative rate: the base raises and the term lowers, so the link has no side', () => {
      for (const domain of [{ lower: null, upper: 0 }, null]) {   // a ceiling at zero fixes the term as lowering; no domain states nothing
        const form = cloneForm()
        form.records = form.records.filter((r) => r.id !== 'added_def')
        form.records.push({ family: 'relation', id: 'eff', form: 'effect', defines: 'added_capacity', base: 'existing_capacity', terms: [{ driver: 'existing_capacity', coefficient: 'per_specialist' }], origin: { by: 'olumi', basis: 'x' } })
        relation(form, 'per_specialist').domain = domain
        const e = edgeOf(graphOf(form), 'existing_capacity__added_capacity')
        expect(e.effect_direction).toBe('unknown')
      }
    })
    it('current + rate × current with a rate known to be at or above zero: every contribution raises, so the link raises', () => {
      const form = cloneForm()
      form.records = form.records.filter((r) => r.id !== 'added_def')
      form.records.push({ family: 'relation', id: 'eff', form: 'effect', defines: 'added_capacity', base: 'existing_capacity', terms: [{ driver: 'existing_capacity', coefficient: 'per_specialist' }], origin: { by: 'olumi', basis: 'x' } })
      relation(form, 'per_specialist').domain = { lower: 0, upper: null }
      relation(form, 'existing_capacity').domain = { lower: 0, upper: null }
      expect(edgeOf(graphOf(form), 'existing_capacity__added_capacity').effect_direction).toBe('positive')
    })
  })
  it('a stock\'s outflow lowers it and its inflow raises it', () => {
    const form = cloneForm()
    form.records = form.records.filter((r) => r.id !== 'total_def')
    form.records.push({ family: 'relation', id: 'stock', form: 'stock', defines: 'total_capacity', start: 'existing_capacity', inflows: ['added_capacity'], outflows: ['specialists'], origin: { by: 'olumi', basis: 'x' } })
    const g = graphOf(form)
    expect(edgeOf(g, 'added_capacity__total_capacity').effect_direction).toBe('positive')
    expect(edgeOf(g, 'specialists__total_capacity').effect_direction).toBe('negative')
  })
  describe('an effect\'s coefficient: its side is unknown unless a floor or a ceiling fixes it', () => {
    const effect = (coefficientDomain) => {
      const form = cloneForm()
      form.records = form.records.filter((r) => r.id !== 'added_def')
      form.records.push({ family: 'relation', id: 'eff', form: 'effect', defines: 'added_capacity', base: 'existing_capacity', terms: [{ driver: 'specialists', coefficient: 'per_specialist' }], origin: { by: 'olumi', basis: 'x' } })
      relation(form, 'per_specialist').domain = coefficientDomain
      return graphOf(form)
    }
    it('with no floor or ceiling, neither the driver nor the coefficient is given a side', () => {
      const g = effect(null)
      expect(edgeOf(g, 'specialists__added_capacity').effect_direction).toBe('unknown')
      expect(edgeOf(g, 'per_specialist__added_capacity').effect_direction).toBe('unknown')
      expect(edgeOf(g, 'existing_capacity__added_capacity').effect_direction).toBe('positive')
      expect(drawn(edgeOf(g, 'specialists__added_capacity')).direction.show).toBe(false)
    })
    it('a floor at or above zero fixes the driver\'s side as raising; a ceiling at or below zero as lowering', () => {
      expect(edgeOf(effect({ lower: 0, upper: null }), 'specialists__added_capacity').effect_direction).toBe('positive')
      expect(edgeOf(effect({ lower: null, upper: 0 }), 'specialists__added_capacity').effect_direction).toBe('negative')
    })
    it('a range that straddles zero fixes nothing', () => {
      expect(edgeOf(effect({ lower: -5, upper: 5 }), 'specialists__added_capacity').effect_direction).toBe('unknown')
    })
  })
})

describe('carrying on as you are is the baseline, because core says so (tier R step 0)', () => {
  it('the carry_on option is the baseline and the others are not, as typed booleans', () => {
    expect(nodeOf(richGraph, 'hold').is_baseline).toBe(true)
    expect(nodeOf(richGraph, 'add_one').is_baseline).toBe(false)
  })
  it('DGAI\'s one baseline resolver then takes core\'s word over the option\'s label', () => {
    const resolve = (n) => resolveOptionIsBaseline({ is_baseline: n.is_baseline, label: n.label }, null)
    expect(resolve(nodeOf(richGraph, 'hold'))).toBe(true)
    const form = cloneForm()
    relation(form, 'hold').carry_on = false
    const hold = nodeOf(graphOf(form), 'hold')
    // The label still says "Keep current staffing"; core says it is not carrying on, so no baseline is guessed from the words.
    expect(hold.label).toMatch(/Keep/)
    expect(resolve(hold)).toBe(false)
  })
})

describe('the person\'s limits are in the canonical model DGAI reads (tier R step 0)', () => {
  const canonical = canonicalOf(richForm, true)
  it('each limit is listed with its name, what it measures, whose it is and the words used', () => {
    expect(canonical.limits).toEqual([expect.objectContaining({ id: 'ceiling', label: 'Capacity ceiling', measure: expect.objectContaining({ quantity: 'total_capacity', cmp: '<=', bound: 'cap' }), author: 'person', quote: 'no more than 120', approval: 'approved' })])
  })
  it('DGAI\'s program reader finds the limit by its id and the quantity it limits', () => {
    const rows = programLimitsWithoutFigure({ living_model: { model_program: 'v1', canonical }, nodes: [], edges: [] }, [])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ constraint_id: 'ceiling', label: 'Capacity ceiling', node_id: 'total_capacity', operator: '<=', provenance: 'explicit' })
  })
  it('a held proposal\'s limit is "proposed" until it is approved', () => {
    expect(canonicalOf(richForm, false).limits[0].approval).toBe('proposed')
  })
  it('a limit that states no single figure is listed without one, and no number is made up for it', () => {
    const form = JSON.parse(JSON.stringify(richForm))
    form.records.find((r) => r.id === 'cap').assertion = { kind: 'interval', low: 100, high: 130, range_kind: 'plausible', likely: null }
    expect(goalConstraintsOf(form)).toEqual([])
    const [row] = programLimitsWithoutFigure({ living_model: { model_program: 'v1', canonical: canonicalOf(form, true) }, nodes: [], edges: [] }, [])
    const words = goalConstraintText(row, [])
    expect(words).toMatch(/Capacity ceiling/)
    expect(words).not.toMatch(/NaN|120/)
  })
})

describe('a limit that states one figure reaches the Model list WITH the figure (goal_constraints)', () => {
  const graph = modelOf({ version: rich.version, pending: null, id: rich.id, chat: [] }).graph
  it('the graph carries it as DGAI\'s own limit row: its name, what it limits, the way, the figure, the unit and the person\'s words', () => {
    expect(graph.goal_constraints).toEqual([{ constraint_id: 'ceiling', label: 'Capacity ceiling', node_id: 'total_capacity', operator: '<=', value: 120, unit: 'ticket/week', source_quote: 'no more than 120', provenance: 'explicit' }])
  })
  it('the row is said with its figure, and the list does not repeat it as a limit with none', () => {
    const [row] = graph.goal_constraints
    expect(goalConstraintText(row, graph.nodes)).toMatch(/120/)
    expect(goalConstraintText(row, graph.nodes)).not.toMatch(/not captured/)
    expect(programLimitsWithoutFigure(graph, graph.goal_constraints)).toEqual([])
  })
  it('a limit with another way to be stated (strict, a total over a span, per something, approximate) is not turned into a plain "at most"', () => {
    const variants = [
      (r) => { r.measure.cmp = '<' },
      (r) => { r.measure.aggregation = 'sum' },
      (r) => { r.measure.window = { origin_event: null, origin_offset: null, start: 0, periods: 'p' } },
      (r) => { r.measure.per = 'specialists' },
    ]
    for (const change of variants) {
      const form = JSON.parse(JSON.stringify(richForm))
      change(form.records.find((r) => r.id === 'ceiling'))
      expect(goalConstraintsOf(form)).toEqual([])
    }
    const form = JSON.parse(JSON.stringify(richForm))
    form.records.find((r) => r.id === 'cap').assertion.approximate = true
    expect(goalConstraintsOf(form)).toEqual([])
  })
  describe('whose figure it is: the bound\'s own origin counts, not only the limit\'s (review: Olumi\'s bound looked like the person\'s)', () => {
    const withOrigins = (limitBy, boundBy) => {
      const form = JSON.parse(JSON.stringify(richForm))
      const limit = form.records.find((r) => r.id === 'ceiling'), cap = form.records.find((r) => r.id === 'cap')
      limit.origin = limitBy === 'person' ? { by: 'person', quote: 'no more than 120', party: null } : { by: 'olumi', basis: 'a ceiling worth checking' }
      cap.origin = boundBy === 'person' ? { by: 'person', quote: 'no more than 120', party: null } : { by: 'olumi', basis: 'a plausible ceiling' }
      return form
    }
    it('a person\'s limit with the person\'s own bound: explicit, with their words', () => {
      expect(goalConstraintsOf(withOrigins('person', 'person'))[0]).toMatchObject({ provenance: 'explicit', source_quote: 'no more than 120' })
    })
    it('a person\'s limit with a bound OLUMI proposed: inferred, and the person\'s words are not put against Olumi\'s figure', () => {
      const [row] = goalConstraintsOf(withOrigins('person', 'olumi'))
      expect(row).toMatchObject({ provenance: 'inferred', value: 120 })
      expect(row).not.toHaveProperty('source_quote')
    })
    it('an Olumi limit stays inferred whoever wrote the bound', () => {
      expect(goalConstraintsOf(withOrigins('olumi', 'person'))[0].provenance).toBe('inferred')
      expect(goalConstraintsOf(withOrigins('olumi', 'olumi'))[0].provenance).toBe('inferred')
    })
    it('the limit\'s own card follows: Olumi\'s bound makes it Olumi\'s card, with no quote of the person\'s', () => {
      const card = nodeOf(graphOf(withOrigins('person', 'olumi')), 'ceiling')
      expect(card.provenance).toBe('ai_inferred')
      expect(card).not.toHaveProperty('source_quote')
      expect(nodeOf(graphOf(withOrigins('person', 'person')), 'ceiling')).toMatchObject({ provenance: 'from_brief', source_quote: 'no more than 120' })
    })
  })
  it('a model with no such limit leaves `goal_constraints` off (its absence is what clears the limits shown)', () => {
    const noLimit = modelOf({ version: { ...rich.version, form: { ...richForm, records: richForm.records.filter((r) => r.family !== 'limit') } }, pending: null, id: rich.id, chat: [] })
    expect(noLimit.graph).not.toHaveProperty('goal_constraints')
  })
  it('a limit not yet measurable is still listed (without a figure), as before', () => {
    const form = JSON.parse(JSON.stringify(richForm))
    form.records.find((r) => r.id === 'ceiling').measure = null
    expect(goalConstraintsOf(form)).toEqual([])
    expect(canonicalOf(form, true).limits).toHaveLength(1)
  })
})

describe('a change that waits is never read as a current Run (tier R step 0)', () => {
  const waiting = fx('view-approved-with-change.json')
  it('the Run is marked not current, says why in plain words, and DGAI shows no chance as the new model\'s', () => {
    const view = analysisViewOf(waiting)
    expect(view.staleness.stale).toBe(true)
    expect(typeof view.face_when_stale).toBe('string')
    expect(runViewOf(null, parseCanonicalAnalysisView(view)).boundToCurrentCanonical()).toBe(false)
  })
})

describe('no driver in the Run is "not recorded", never "none moves it" (tier R step 0)', () => {
  const view = JSON.parse(JSON.stringify(approved))
  view.version.facts = view.version.facts.filter((f) => f.about?.kind !== 'driver')
  const run = analysisViewOf(view)
  it('every option\'s main driver is not_recorded, which DGAI reads and shows nothing for', () => {
    expect(run.options.length).toBeGreaterThan(0)
    for (const o of run.options) expect(o.main_driver).toEqual({ kind: 'not_recorded' })
    expect(parseCanonicalAnalysisView(run)).not.toBeNull()
    expect(JSON.stringify(run)).not.toMatch(/No figure moves/)
  })
})
