import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { graphOf, canonicalOf, analysisViewOf, leftOutOf, sayFact } from '../../../scripts/olumi-core/lib/model.mjs'
import { rev16 } from '../../../scripts/olumi-core/lib/ids.mjs'
import { parseCanonicalAnalysisView } from '../../canvas/runView/canonicalAnalysisView'
import { runViewOf } from '../../canvas/runView/runView'
import { resolveFactorStoredRangeLine } from '../../canvas/nodes/shared/factorStatedRange'
import { programQuantityOf } from '../../canvas/nodes/shared/savedModelProgram'

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
  const view = analysisViewOf(approved, rev16(approved))
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
    const cell = analysisViewOf(v, rev16(v)).options.find((o) => o.option_id === 'add_one').cell
    expect(cell).toMatchObject({ kind: 'range', detail: { low: expect.any(Number), median: expect.any(Number), high: expect.any(Number), unit: 'ticket/week', olumi: false } })
    expect(parseCanonicalAnalysisView(analysisViewOf(v, rev16(v)))).not.toBeNull()
  })
  it('names Olumi\'s what-if figures once, from the structured input facts (about.olumi), and only when there are some', () => {
    expect(view.goal_chance.notes).toHaveLength(1)
    const v = JSON.parse(JSON.stringify(approved))
    v.version.facts.push({ id: 'F99', value: '2 to 10 ticket/week', text: 'Olumi\'s what-if for staff absence, not their figure: 2 to 10 ticket/week.', about: { kind: 'input', quantity: 'per_specialist', olumi: true, low: 2, high: 10, unit: 'ticket/week' } })
    const notes = analysisViewOf(v, rev16(v)).goal_chance.notes
    expect(notes).toEqual(['This leaves out: How the team feels about a new hire.', 'Olumi’s what-if figures, until you give your own: per specialist.'])
    expect(parseCanonicalAnalysisView(analysisViewOf(v, rev16(v)))).not.toBeNull()
  })
  it('has no Run view before there is an approved version', () => {
    expect(analysisViewOf(fx('view-first-pending.json'), 'x')).toBeNull()
  })
})
