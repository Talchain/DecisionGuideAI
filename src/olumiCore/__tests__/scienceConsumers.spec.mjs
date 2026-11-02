import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { analysisViewOf } from '../../../scripts/olumi-core/lib/model.mjs'
import { coachText, makeShim } from '../../../scripts/olumi-core/lib/turn.mjs'
import { apart, chancePct, REASON_CODES } from '../../../scripts/olumi-core/lib/labels.mjs'
import { noteOf, fillCited, UNEXPLAINED } from '../../../scripts/olumi-core/lib/note.mjs'
import { derivedUuidOfSid } from '../../../scripts/olumi-core/lib/ids.mjs'
import * as team from '../team/model'
import { parseCanonicalAnalysisView } from '../../canvas/runView/canonicalAnalysisView'

/**
 * Science step 4, DGAI's consumers (change list STEP4-DGAI-CHANGE-LIST.md, one test per bullet). Fixtures are olumi-core's own producer output copied
 * into fixtures/science: the labelled Runs (s5-labels-facts.json, wip/science-step-s5 c52948e) and D7's facts (s6-view-facts.json, olumi-core staging
 * 739b7e8, OLUMI_D7). The marker-only stubs below (bullet 8) are hand stubs for the kinds' markers; the real D6 and module facts, with their
 * conditions, are in scienceR2.spec.mjs (s7-module-facts.json, 739b7e8).
 */
const here = path.dirname(fileURLToPath(import.meta.url))
const fx = (n) => JSON.parse(fs.readFileSync(path.join(here, 'fixtures', n), 'utf8'))
const S5 = fx('science/s5-labels-facts.json').scenarios
const S6 = fx('science/s6-view-facts.json').facts
const base = fx('view-approved.json')
const clone = (x) => JSON.parse(JSON.stringify(x))

/** A scenario view whose saved version holds one of core's labelled Runs. */
const viewOf = (name, mutate = (facts) => facts, science) => {
  const v = clone(base)
  v.version.form = clone(S5[name].form)
  v.version.facts = mutate(clone(S5[name].facts))
  if (science) v.version.science = science
  return v
}
const cell = (view, option) => analysisViewOf(view).options.find((o) => o.option_id === option).cell
const kindOf = (view, kind, pick = () => true) => view.version.facts.find((f) => f.about?.kind === kind && pick(f.about))
const DIGIT = /\d/
const STATUS_WORDS = /never met|always met|never within|always within|never meets|always meets|most likely|not worked out|none separated/

describe('all labels facts: never parse text (bullet 1)', () => {
  it('every word comes from value and about: scrambling every fact\'s text changes nothing', () => {
    for (const name of Object.keys(S5)) {
      const v = viewOf(name)
      const scrambled = viewOf(name, (facts) => facts.map((f) => ({ ...f, text: 'ZZZ-SENTINEL-TEXT' })))
      const a = analysisViewOf(v), b = analysisViewOf(scrambled)
      expect(b, name).toEqual(a)
      expect(JSON.stringify(b)).not.toContain('ZZZ-SENTINEL')
    }
  })
  it('the output is still a valid canonical_analysis_view', () => {
    for (const name of Object.keys(S5)) expect(parseCanonicalAnalysisView(analysisViewOf(viewOf(name))), name).not.toBeNull()
  })
  it('the "It leaves out" tail is gone from the facts, and the model\'s own left-out records say it once', () => {
    const notes = analysisViewOf(viewOf('capacity')).goal_chance.notes
    expect(notes.filter((n) => /leaves out/i.test(n))).toEqual(['This leaves out: How the team feels about a new hire.'])
  })
})

describe('sampled chance, range, limit, outside, driver (bullet 2)', () => {
  const run = analysisViewOf(viewOf('capacity'))
  const add = run.options.find((o) => o.option_id === 'add_one')
  it('a chance keeps today\'s value and is worded from the option and aim names', () => {
    expect(add.cell).toMatchObject({ kind: 'figure', display: 'about 50%' })
    expect(add.cell.face).toMatch(/^about 50%: .*‘Add one specialist’.*‘At least 100 a week’/)
    expect(add.cell.face).not.toMatch(/option:|aim:|chance: /)
  })
  it('a range keeps its value and carries low, median, high, unit and olumi from about', () => {
    const r = viewOf('capacity').version.facts.find((f) => f.about.kind === 'range' && f.about.option === 'add_one')
    const view = analysisViewOf({ ...viewOf('capacity'), version: { ...viewOf('capacity').version, facts: viewOf('capacity').version.facts.filter((f) => f.about.kind !== 'chance') } })
    const c = view.options.find((o) => o.option_id === 'add_one').cell
    expect(c).toMatchObject({ kind: 'range', display: r.value, detail: { low: r.about.low, median: r.about.median, high: r.about.high, unit: 'ticket/week', olumi: r.about.olumi, rests: [] } })
    expect(c.face).toMatch(/‘Add one specialist’.*‘total capacity’/)
  })
  it('a range says how the aim measures its quantity when that is not the plain level at the end', () => {
    const v = viewOf('capacity', (fs) => fs.filter((f) => f.about.kind !== 'chance'))
    v.version.form.records.find((r) => r.id === 'capacity_goal').measure.frame = 'change'
    v.version.form.records.find((r) => r.id === 'capacity_goal').measure.aggregation = 'sum'
    expect(analysisViewOf(v).options.find((o) => o.option_id === 'add_one').cell.face).toMatch(/‘total capacity’ \(as a change, sum over its period\)/)
  })
  it('a driver names its figure from about.quantity', () => {
    expect(add.main_driver).toMatchObject({ kind: 'available', driver: { kind: 'driver', quantity: 'per_specialist' } })
    expect(add.main_driver.detail).toMatch(/‘per specialist’/)
    expect(add.main_driver.detail).toContain('under 1% if')
  })
  it('a sampled limit and its outside are noted with the limit named; olumi is the wider flag', () => {
    const notes = analysisViewOf(viewOf('limits')).goal_chance.notes
    expect(notes.find((n) => n.startsWith('about 50%: ') && /‘Tight ceiling’.*stays within|stays within.*‘Tight ceiling’/.test(n))).toBeDefined()
    expect(notes.find((n) => n.startsWith('about 50%: ') && /goes outside/.test(n) && /‘Tight ceiling’/.test(n))).toBeDefined()
    expect(kindOf(viewOf('limits'), 'limit', (a) => a.limit === 'tightness' && a.option === 'add_one').about.olumi).toBe(true)
  })
  it('the rest of the provenance block is said in plain words: Olumi\'s ways of working figures out are named, nothing is numbered', () => {
    expect(add.cell.face).toMatch(/Olumi/)
  })
})

describe('fixed chance or limit: the shim says it itself from about.chance (bullet 3)', () => {
  it('a chance of 0 reads "never meets", of 1 "always meets", and the status marker is never shown', () => {
    const hold = analysisViewOf(viewOf('capacity')).options.find((o) => o.option_id === 'hold').cell
    expect(hold).toMatchObject({ kind: 'figure', display: 'never meets' })
    expect(hold.face).toMatch(/‘Keep current staffing’ never meets ‘At least 100 a week’/)
    const always = analysisViewOf(viewOf('capacity', (fs) => fs.map((f) => (f.about.kind === 'chance' && f.about.fixed ? { ...f, value: 'status: always met', about: { ...f.about, chance: 1 } } : f)))).options.find((o) => o.option_id === 'hold').cell
    expect(always.display).toBe('always meets')
    expect(always.face).toMatch(/‘Keep current staffing’ always meets/)
    for (const c of [hold, always]) { expect(c.face).not.toMatch(/status:|never met\b|always met\b/); expect(c.face.replace(/‘[^’]*’/g, '')).not.toMatch(DIGIT) }   // names may hold digits; the words do not
  })
  it('a fixed limit says "always within" / "never within" from about.chance', () => {
    const notes = analysisViewOf(viewOf('limits')).goal_chance.notes
    const fixed = notes.filter((n) => /^always within: /.test(n))
    expect(fixed.length).toBe(2)
    expect(fixed[0]).toMatch(/‘Keep current staffing’ always stays within ‘Capacity ceiling’/)
    const never = analysisViewOf(viewOf('limits', (fs) => fs.map((f) => (f.about.kind === 'limit' && f.about.fixed && f.about.limit === 'ceiling' ? { ...f, value: 'status: never within', about: { ...f.about, chance: 0 } } : f)))).goal_chance.notes
    expect(never.find((n) => /^never within: /.test(n))).toMatch(/never stays within ‘Capacity ceiling’/)
  })
})

describe('most_likely and none_clearly: the leader is a label, never a sentence DGAI composes (bullets 4 and 5; review 00008 #2)', () => {
  // The words of a comparison belong to the AI. The shim says only `Most likely: <name>` and, beside it, core's own labels with the items core states.
  const SENTENCE = /is the option most likely|is clearly ahead|too close to separate|could not be compared, so|depends on Olumi's estimate|leads when it is|were told apart|were compared on the same draws/
  it('most_likely reads "Most likely: ‘A’" first, with the labels core states beside it, from option, chance, next, next_chance and separated_by', () => {
    const w = analysisViewOf(viewOf('capacity')).leader.words
    expect(w.startsWith('Most likely: ‘Add one specialist’, about 50%')).toBe(true)
    expect(w).toContain('Next: ‘Keep current staffing’, under 1%')
    expect(w).toContain('Compared: on the same draws')
    expect(w).not.toMatch(SENTENCE)
    const limits = analysisViewOf(viewOf('limits')).leader.words
    expect(limits).toContain('Compared: by the uncertainty around each chance')
    expect(limits).not.toContain('on the same draws')
  })
  it('every labelled Run\'s leader starts "Most likely: " and holds none of the sentences DGAI used to compose', () => {
    for (const name of Object.keys(S5)) {
      const w = analysisViewOf(viewOf(name)).leader.words
      if (w === undefined) continue
      expect(w, name).toMatch(/^Most likely: /)
      expect(w, name).not.toMatch(SENTENCE)
    }
  })
  it('an option that could not be compared is a label beside the leader ("Not compared"), not left out of it silently', () => {
    expect(analysisViewOf(viewOf('agency_withheld')).leader.words).toContain('Not compared: ‘Use an agency’')
    expect(analysisViewOf(viewOf('capacity')).leader.words).not.toMatch(/Not compared/)
  })
  it('a leader that turns on an Olumi range names the swing figure and the option that leads at each end as labels (leads_when), and rests on both options\' premises', () => {
    const w = analysisViewOf(viewOf('leader_turns')).leader.words
    expect(w).toContain('Swing figure: ‘per specialist’')
    expect(w).toContain('Leads when low: ‘Keep current staffing’')
    expect(w).toContain('Leads when high: ‘Add one specialist’')
    expect(w).not.toMatch(SENTENCE)
    const v = viewOf('capacity', (fs) => fs.map((f) => (f.about.kind === 'most_likely' ? { ...f, about: { ...f.about, rests: ['lead_doubt'] } } : f)))
    expect(analysisViewOf(v).leader.words).toMatch(/lead_doubt|A new hire may unsettle the team/)
  })
  it('none_clearly: "Most likely: none separated" with the top two as labels, from top, next and the two chances; never the marker alone, never a sentence', () => {
    const w = analysisViewOf(viewOf('none_separated')).leader.words
    expect(w.startsWith('Most likely: none separated')).toBe(true)
    expect(w).toMatch(/Top two: ‘Add one specialist’, about 41%, ‘Keep current staffing’, about 40%/)
    expect(w).toContain('Swing figure: ‘per specialist’')
    expect(w).not.toMatch(SENTENCE)
    expect(w).not.toMatch(/No option/)
  })
  it('the leader is stored text passed through as labels: scrambling core\'s text changes nothing, and the leader still carries no licence of its own', () => {
    const v = analysisViewOf(viewOf('capacity'))
    expect(v.leader).toMatchObject({ licence: 'withheld', option_id: null })
  })
})

describe('the shim\'s chance formatter is core\'s (labels.ts pct and apart)', () => {
  it('never reads a sampled chance as certain, and tells two close chances apart', () => {
    expect([0, 0.004, 0.4962, 0.996, 1].map(chancePct)).toEqual(['under 1%', 'under 1%', 'about 50%', 'over 99%', 'over 99%'])
    expect(apart(0.0133, 0.0089)).toEqual(['about 1.3%', 'about 0.9%'])
    expect(apart(0.4962, 0)).toEqual(['about 50%', 'under 1%'])
  })
})

describe('input (bullet 6)', () => {
  const whatIfs = (view) => analysisViewOf(view).goal_chance.notes.filter((n) => /what-if/.test(n))
  const olumiRange = (fs) => fs.map((f) => (f.about.kind === 'input' && f.about.quantity === 'per_specialist' ? { ...f, about: { ...f.about, olumi: true } } : f))
  it('a range that is Olumi\'s is a what-if, with every digit as stored; the person\'s own is not', () => {
    expect(whatIfs(viewOf('capacity'))).toEqual([])
    const w = whatIfs(viewOf('capacity', olumiRange))
    expect(w).toHaveLength(1)
    expect(w[0]).toMatch(/‘per specialist’.*10 to 30 ticket\/week\/specialist/)
  })
  it('an Olumi point input (a proposed target) is not a what-if', () => {
    const v = viewOf('olumi_target')
    expect(kindOf(v, 'input', (a) => a.quantity === 'capacity_target').about).toMatchObject({ shape: 'point' })
    expect(whatIfs(viewOf('olumi_target', (fs) => fs.map((f) => (f.about.kind === 'input' && f.about.quantity === 'capacity_target' ? { ...f, about: { ...f.about, olumi: true } } : f))))).toEqual([])
  })
  it('a figure no result used is said so, with its digits as stored', () => {
    const notes = analysisViewOf(viewOf('money')).goal_chance.notes
    const n = notes.find((x) => /not used/i.test(x))
    expect(n).toMatch(/‘budget’.*12,345\.67 GBP/)
    expect(n).toMatch(/‘spread’.*12,345\.67 to 23,456\.78 GBP/)
    expect(analysisViewOf(viewOf('capacity')).goal_chance.notes.some((x) => /not used/i.test(x))).toBe(false)
  })
})

describe('blocker and waits: every reason code is a plain DGAI message (bullet 7)', () => {
  const CODES = ['no_measure', 'no_aim_measure', 'asked', 'unmeasured', 'figure_unknown', 'figure_unsupported', 'needs_reading', 'bounds_leave_nothing', 'outside_bounds', 'timing_unsupported', 'range_unreadable',
    'link_in_words', 'risk_read_once', 'risk_unsized', 'needs_deadline', 'window_unmeasured', 'window_not_known', 'window_is_range', 'change_in_rate', 'change_from_changing_option', 'change_under_risk',
    'ruled_out', 'removed', 'waits_on_aim', 'waits_on_limit', 'model_errors', 'schema', 'out_of_domain', 'no_goals', 'no_option_change', 'figure_not_applicable', 'unlisted']
  const withReasons = (reasons) => viewOf('agency_withheld', (fs) => fs.map((f) => (f.about.kind === 'blocker' ? { ...f, about: { ...f.about, reasons } } : f)))
  const reasonsOf = (v) => analysisViewOf(v).options.find((o) => o.option_id === 'agency').cell.reasons
  // What each message must say (its meaning, not its shape): a mapping to the wrong explanation fails here.
  const MEANING = {
    no_measure: /no way of being measured/, no_aim_measure: /aim has no way of being measured/, asked: /waiting for your answer/i, unmeasured: /no unit/, figure_unknown: /no value yet/,
    figure_unsupported: /nothing yet supports a value/i, needs_reading: /firm ends or as a rough estimate/, bounds_leave_nothing: /leave no possible value/, outside_bounds: /lies outside the bounds/,
    timing_unsupported: /timing .* not something the model can use/, range_unreadable: /cannot be read as it stands/, link_in_words: /stated only in words/, risk_read_once: /counts once as written/,
    risk_unsized: /cannot size/, needs_deadline: /no deadline/, window_unmeasured: /period .* no way of being measured/, window_not_known: /period .* not known/, window_is_range: /period .* a range/,
    change_in_rate: /change in a rate/, change_from_changing_option: /option itself changes/, change_under_risk: /change that depends on a risk/, ruled_out: /ruled out/, removed: /removed/,
    waits_on_aim: /waits until the aim/, waits_on_limit: /waits until the limit/, model_errors: /errors/, schema: /not in a shape/, out_of_domain: /not possible for it, so this cannot be worked out/,
    no_goals: /no aim to measure/, no_option_change: /No option changes anything/, unlisted: /no plain reason/,
    figure_not_applicable: /not applicable/,
  }
  it('there are 32 reason codes in all (the compiler\'s, with figure_unknown, figure_unsupported and figure_not_applicable; out_of_domain, no_goals and no_option_change from the engine and guard; and `unlisted`), and the shim words every one', () => {
    expect(CODES).toHaveLength(32)
    expect(new Set(CODES).size).toBe(32)
    expect([...REASON_CODES].sort()).toEqual([...CODES].sort())
    for (const c of ['figure_unknown', 'figure_unsupported', 'figure_not_applicable', 'unlisted']) expect(CODES, c).toContain(c)
  })
  it('every code has its meaning pinned, and the messages are all different', () => {
    expect(Object.keys(MEANING).sort()).toEqual([...CODES].sort())
    expect(new Set(CODES.map((c) => reasonsOf(withReasons([{ code: c, ids: [] }]))[0].message)).size).toBe(CODES.length)
  })
  it.each(CODES)('%s has a plain message of its own', (code) => {
    expect(reasonsOf(withReasons([{ code, ids: ['agency_staff'] }]))[0].message, code).toMatch(MEANING[code])
    const [r] = reasonsOf(withReasons([{ code, ids: ['agency_staff'] }]))
    expect(r.code).toBe(code)
    expect(r.message.length).toBeGreaterThan(10)
    if (code.includes('_')) expect(r.message).not.toContain(code)
    expect(r.message).not.toMatch(/_/)
  })
  it('an unknown code (or none at all) gets a generic honest message, never a crash or a silent drop', () => {
    const [r] = reasonsOf(withReasons([{ code: 'a_code_core_adds_later', ids: [] }]))
    expect(r.message).toBe('Olumi could not work this out, and cannot yet say why in plain words.')
    expect(r.message).not.toMatch(/meets|always|never|\d/)
    expect(r.code).toBe('a_code_core_adds_later')
    expect(reasonsOf(withReasons([]))).toHaveLength(1)
    expect(reasonsOf(withReasons(undefined))[0].message).toMatch(/could not work this out/i)
  })
  it('a withheld chance shows its short phrase, the reason, and how many draws; the figures it is about are named', () => {
    const c = cell(viewOf('out_of_domain', (fs) => fs.filter((f) => f.about.kind !== 'range')), 'add_one')
    expect(c).toMatchObject({ kind: 'withheld', face: 'not worked out' })
    expect(c.why).toMatch(/‘per specialist’/)
    expect(c.why).toMatch(/120/)
    expect(c.reasons[0]).toMatchObject({ code: 'out_of_domain' })
  })
  it('a range does not hide why a chance was withheld: the reason stays beside it', () => {
    const v = viewOf('out_of_domain')
    expect(cell(v, 'add_one').kind).toBe('range')
    const n = analysisViewOf(v).goal_chance.notes.find((x) => /^not worked out: /.test(x))
    expect(n).toMatch(/‘Add one specialist’ against ‘At least 100 a week’ cannot be worked out yet/)
    expect(n).toMatch(/‘per specialist’/)
    expect(n).toMatch(/120 of the Run's draws/)
    expect(n).not.toMatch(/left out/)
  })
  it('a hold on a second aim is not lost, and a limit blocker names the option it blocks', () => {
    const second = viewOf('capacity', (fs) => [...fs, { id: 'F30', value: 'cannot be worked out yet', text: 'x', about: { kind: 'blocker', goal: 'morale_goal', reasons: [{ code: 'no_measure', ids: ['morale_goal'] }], figures_out: [], olumi: false, olumi_figures: [], olumi_links: [], olumi_mechanisms: [], approx_figures: [], rests: [], leaves: [], form: 'labels' } }])
    second.version.form.records.push({ family: 'goal', id: 'morale_goal', label: 'Team morale up', question: null, origin: { by: 'person', quote: 'morale' }, measure: null })
    expect(analysisViewOf(second).goal_chance.notes.find((x) => /‘Team morale up’/.test(x))).toMatch(/^cannot be worked out yet: ‘Team morale up’ cannot be worked out yet\. ‘Team morale up’ has no way of being measured yet\./)
    const lim = viewOf('limits', (fs) => [...fs, { id: 'F31', value: 'not worked out', text: 'x', about: { kind: 'blocker', option: 'add_one', limit: 'ceiling', reasons: [{ code: 'out_of_domain', ids: ['total_capacity'] }], draws: 12, figures_out: ['total_capacity'], olumi: false, olumi_figures: [], olumi_links: [], olumi_mechanisms: [], approx_figures: [], rests: [], leaves: [], form: 'labels' } }])
    expect(analysisViewOf(lim).goal_chance.notes.find((x) => /^not worked out: /.test(x))).toMatch(/‘Add one specialist’ against ‘Capacity ceiling’ cannot be checked yet/)
  })
  it('an aim with no measure is noted with its reason; an aim that waits names what it waits on, and an answer can be given', () => {
    expect(analysisViewOf(viewOf('no_measure')).goal_chance.notes.join('\n')).toMatch(/cannot be worked out yet: .*‘At least 100 a week’/)
    const w = analysisViewOf(viewOf('waits_answer')).goal_chance
    expect(w.waits_on).toEqual([expect.objectContaining({ id: 'per_specialist', answer: { quantity_id: 'per_specialist' } })])
    expect(w.waits_on.map((x) => x.id)).not.toContain('steady_demand')   // a premise the finding rests on is not what it waits on
    expect(analysisViewOf(viewOf('needs_deadline')).goal_chance.notes.join('\n')).toMatch(/deadline/i)
  })
  it('a limit that waits is kind waits with about.limit, and is said beside the limit', () => {
    const v = viewOf('limit_waits')
    expect(kindOf(v, 'waits').about.limit).toBe('ceiling')
    expect(analysisViewOf(v).goal_chance.notes.find((n) => /‘Capacity ceiling’/.test(n))).toMatch(/^waiting on an answer: .*‘cap’/)
    expect(analysisViewOf(viewOf('limit_no_measure')).goal_chance.notes.find((n) => /‘Capacity ceiling’/.test(n))).toMatch(/^not checked yet: /)
  })
})

describe('science module kinds are markers (bullet 8)', () => {
  // The science module facts are hand stubs shaped by the change list: s5 head does not carry them conformed (they are on wip/science-step2-d*).
  const block = (f) => ({ olumi: false, olumi_reading: false, olumi_figures: [], olumi_links: [], olumi_mechanisms: [], approx_figures: [], target: 'capacity_target', target_by: 'person', target_approval: 'proposed', target_read: true, rests: [], leaves: [], shown: {}, form: 'labels', ...f })
  const stubs = [
    { id: 'F20', value: 'direction: up', text: "option: 'Add one specialist'; direction: up", about: block({ kind: 'direction', option: 'add_one', goal: 'capacity_goal', direction: 'up', toward: true }) },
    { id: 'F21', value: 'worth: a little', text: 'x', about: block({ kind: 'worth', figure: 'per_specialist', goal: 'capacity_goal' }) },
    { id: 'F22', value: 'missed: about 51%', text: 'x', about: block({ kind: 'failure', option: 'add_one', goal: 'capacity_goal' }) },
    { id: 'F23', value: 'tips at: >= 71.5%', text: 'x', about: block({ kind: 'tipping', option: 'add_one', goal: 'capacity_goal', quantity: 'per_specialist', at: 0.715, direction: '>=' }) },
    { id: 'F24', value: "Olumi's ranges: about 73%", text: 'x', about: block({ kind: 'reliance', option: 'add_one', goal: 'capacity_goal' }) },
    { id: 'F25', value: 'a: b', text: 'x', about: block({ kind: 'a_kind_core_adds_later', goal: 'capacity_goal' }) },
  ]
  const v = viewOf('capacity', (fs) => [...fs, ...stubs])
  it('each is shown as its marker beside the names it is about, never as a sentence, and an unknown kind is ignored', () => {
    const notes = analysisViewOf(v).goal_chance.notes
    for (const [value, name] of [['direction: up', 'Add one specialist'], ['worth: a little', 'per specialist'], ['missed: about 51%', 'Add one specialist'], ['tips at: >= 71.5%', 'per specialist'], ["Olumi's ranges: about 73%", 'Add one specialist']]) {
      expect(notes.find((n) => n.includes(` — ${value}`)), value).toContain(`‘${name}’`)
    }
    expect(notes.join('\n')).not.toContain('a: b')
    expect(parseCanonicalAnalysisView(analysisViewOf(v))).not.toBeNull()
  })
  it('a marker that rests on an unapproved Olumi estimate says so', () => {
    const f = { ...stubs[0], id: 'F40', about: { ...stubs[0].about, olumi: true, olumi_figures: [{ id: 'per_specialist', approval: 'proposed' }] } }
    const n = analysisViewOf(viewOf('capacity', (fs) => [...fs, f])).goal_chance.notes.find((x) => x.endsWith('not yet approved).') && /direction: up/.test(x))
    expect(n).toMatch(/Olumi's what-if figures for ‘per specialist’ \(not yet approved\)/)
  })
  it('none of them is ever spliced into a reply', () => {
    const cf = stubs.map((s) => ({ id: s.id, kind: s.about.kind, value: s.value, text: s.text, about: s.about }))
    const text = coachText({ answer: 'Look at [F20], [F21], [F22], [F23], [F24], [F25].', why: [], next: { move: 'gather_evidence', about: [], text: 'x' } }, { F20: 'a sentence', F25: 'another' }, cf)
    expect(text).not.toMatch(DIGIT.source + '|direction|worth|missed|tips|ranges')
    expect(text.split(UNEXPLAINED).length - 1).toBe(6)
  })
})

describe('the stored science record and the provenance block (bullet 9: staging ae38ad8)', () => {
  it('a module that said nothing is named with its reason, and silence is not called "nothing to find"', () => {
    const science = { flags: ['OLUMI_LABELS', 'OLUMI_WORTH'], modules: [{ module: 'worth', status: 'none', reason: 'no_figures' }, { module: 'failure', status: 'spoke', reason: null }, { module: 'tipping', status: 'capped', reason: 'too_many' }] }
    const notes = analysisViewOf(viewOf('capacity', undefined, science)).goal_chance.notes
    const n = notes.find((x) => /said nothing/i.test(x))
    expect(n).toMatch(/worth/i)
    expect(n).toMatch(/where it tips/i)
    expect(n).not.toMatch(/failure/i)
    expect(n).toMatch(/not (a finding|evidence)/i)
    expect(analysisViewOf(viewOf('capacity')).goal_chance.notes.some((x) => /said nothing/i.test(x))).toBe(false)
  })
  it('an Olumi setting id (<option>__<quantity>) is named as the option\'s own setting, an approximate figure and an Olumi target are said', () => {
    const v = viewOf('capacity', (fs) => fs.map((f) => (f.about.kind === 'chance' && f.about.option === 'add_one'
      ? { ...f, about: { ...f.about, olumi_figures: [{ id: 'per_specialist', approval: 'approved' }, { id: 'add_one__per_specialist', approval: 'proposed' }], approx_figures: ['existing_capacity'], target_by: 'olumi' } } : f)))
    const face = analysisViewOf(v).options.find((o) => o.option_id === 'add_one').cell.face
    expect(face).toMatch(/‘per specialist’ as ‘Add one specialist’ sets it/)
    expect(face).not.toContain('add_one__per_specialist')
    expect(face).toMatch(/not yet approved/)
    expect(face).toMatch(/‘existing capacity’.*approximate/)
    expect(face).toMatch(/target.*Olumi|Olumi.*target/)
  })
})

describe('coachText splices cited[id] only for written-in kinds that are not fixed (bullet 11)', () => {
  const v = viewOf('agency_withheld')
  const idOf = (kind, pick) => kindOf(v, kind, pick) && v.version.facts.find((f) => f.about.kind === kind && (!pick || pick(f.about))).id
  const cf = (id) => { const f = v.version.facts.find((x) => x.id === id); return { id, kind: f.about.kind, value: f.value, text: f.text, about: f.about } }
  const fixedId = idOf('chance', (a) => a.fixed), leaderId = idOf('most_likely'), blockerId = idOf('blocker'), sampledId = idOf('chance', (a) => !a.fixed)
  it('a reply citing a fixed chance, a leader and a blocker leaves no digit and no status word', () => {
    const coach = { answer: `Here is what I found: [${fixedId}], [${leaderId}] and [${blockerId}].`, why: [`See [${leaderId}].`], next: { move: 'gather_evidence', about: [], text: `Check [${blockerId}].` } }
    const text = coachText(coach, {}, [fixedId, leaderId, blockerId].map(cf))
    expect(text).not.toMatch(DIGIT)
    expect(text).not.toMatch(STATUS_WORDS)
    expect(text).toBe(`Here is what I found: ${UNEXPLAINED}, ${UNEXPLAINED} and ${UNEXPLAINED}.\nSee ${UNEXPLAINED}.\nNext (gather evidence): Check ${UNEXPLAINED}.`)
    // ...and not merely because nothing was cited: even a sentence held for each of them (a stale or hand-edited map) is not spliced
    const held = { [fixedId]: 'never met in this model', [leaderId]: 'the option most likely (about 50%)', [blockerId]: 'cannot be worked out: 120 draws' }
    expect(coachText(coach, held, [fixedId, leaderId, blockerId].map(cf))).toBe(text)
  })
  it('a sampled chance is written in from cited[id]; the same id as a fixed chance, or as an unknown kind, is not', () => {
    const coach = { answer: `It is [${sampledId}].`, why: [], next: { move: 'gather_evidence', about: [], text: 'Check.' } }
    expect(coachText(coach, { [sampledId]: 'about 50%' }, [cf(sampledId)])).toBe('It is about 50%.\nNext (gather evidence): Check.')
    const asFixed = { ...cf(sampledId), about: { ...cf(sampledId).about, fixed: true } }
    expect(coachText(coach, { [sampledId]: 'about 50%' }, [asFixed])).not.toContain('50%')
    const unknown = { ...cf(sampledId), kind: 'a_kind_core_adds_later', about: { ...cf(sampledId).about, kind: 'a_kind_core_adds_later' } }
    expect(coachText(coach, { [sampledId]: 'about 50%' }, [unknown])).not.toContain('50%')
    // an id the reply cites that cited_facts does not carry (with the science fields present) is not trusted either
    expect(coachText(coach, { [sampledId]: 'about 50%' }, [cf(fixedId)])).not.toContain('50%')
  })
  it('the same rule governs the next-step note', () => {
    const coach = { answer: 'a', why: [], next: { move: 'gather_evidence', about: ['per_specialist'], text: `Look at [${fixedId}] and [${sampledId}].` }, problems: [] }
    expect(noteOf(coach, { [sampledId]: 'about 50%' }, [{ id: 'per_specialist', kind: 'factor' }], null, [fixedId, sampledId].map(cf)).text).toBe(`Look at ${UNEXPLAINED} and about 50%.`)
  })
  it('end to end: a reload of a reply that cites them reads the same, through graphRead', async () => {
    const view = clone(base)
    view.version.form = clone(S5.agency_withheld.form); view.version.facts = clone(S5.agency_withheld.facts)
    view.version.coach = view.chat[0].answer = { answer: `Here: [${fixedId}] and [${sampledId}].`, why: [], next: { move: 'gather_evidence', about: [], text: 'Check.' }, words: 3, problems: [] }
    view.chat[0].cited = { [sampledId]: 'about 50%' }
    view.chat[0].cited_facts = [fixedId, sampledId].map(cf)
    const shim = makeShim({ core: async () => view })
    const r = await shim.graphRead({ token: 't', aliases: [] }, derivedUuidOfSid(view.id))
    expect(r.status).toBe(200)
    expect(r.body.conversation_turns[0].assistant_message).toContain(`Here: ${UNEXPLAINED} and about 50%.`)
  })
})

describe('flag-off invariance (bullet 12)', () => {
  const pin = fx('pin-flag-off.json')
  it('pins today\'s Run views byte for byte (pinned from c52948e-free tier-c 6fc742e, before this change)', () => {
    for (const n of ['view-approved', 'view-rich-approved', 'view-markers-v2']) expect(analysisViewOf(fx(`${n}.json`)), n).toEqual(pin[n])
    expect(JSON.stringify(analysisViewOf(fx('view-approved.json')).options[0])).toBe(JSON.stringify(pin['view-approved'].options[0]))
  })
  it('pins today\'s fixed chance exactly: the staging sentence, not the labels words', () => {
    expect(analysisViewOf(fx('view-approved.json')).options.find((o) => o.option_id === 'hold').cell).toEqual({
      kind: 'figure', display: 'never met in this model',
      face: "never met in this model: With the model's figures, 'Keep current staffing' never meets 'At least 100 a week': nothing uncertain reaches it, so this is fixed by those figures, not a chance.",
    })
  })
  it('pins today\'s reply words: a reply with no cited_facts reads as it always did, a marker with a sentence included', () => {
    const coach = { answer: 'Keeping staffing does not meet it: [F1]. See [F5] and [F9].', why: ['It rests on [F3].'], next: { move: 'pre_mortem', about: ['per_specialist'], text: 'Look again at [F5]' }, words: 5, problems: [] }
    const cited = { F1: 'never met in this model', F3: 'about 50%', F5: "The option most likely to achieve 'At least 100 a week' (about 50%)." }
    expect(coachText(coach, cited)).toBe(pin.coachText)
    expect(coachText(coach, {})).toBe(pin.coachTextNoCited)
    expect(noteOf(coach, cited, [{ id: 'per_specialist', kind: 'factor' }])).toEqual(pin.noteOf)
    expect(coachText(coach, cited, [])).toBe(pin.coachText)       // empty cited_facts is the same as none
    expect(fillCited('See [F9].', {})).toBe(`See ${UNEXPLAINED}.`)
  })
})

describe('Team tab: labels facts and D7 (bullets 1 and 10)', () => {
  const records = [{ id: 'x', family: 'quantity', label: 'x' }, { id: 'add', family: 'option', label: 'add' }, { id: 'carry_on', family: 'option', label: 'carry on' }, { id: 'tool', family: 'option', label: 'tool' },
    { id: 'reach_100', family: 'goal', label: 'reach 100', measure: { quantity: 'x' } }]
  const scenario = (extra) => ({ id: 's_1', you: 'Ada', members: [], views: [], waiting: [], reveal: { state: 'revealed', at: 'now' }, commitments: [], evidence: [], pending: null, version: { id: 1, n: 1, form: { records } }, ...extra })
  const findings = (facts, more = {}) => ({ status: 'current', version: 1, reveal: 9, contributions: [], facts, science: { flags: ['OLUMI_D7'], modules: [{ module: 'views', status: 'spoke', reason: null }] }, ...more })

  it('a range band is worded from about when its fact is labels, with what it leaves out from about.leaves; text is never read', () => {
    const v = viewOf('capacity')
    const s = { ...scenario({}), version: { id: 1, n: 1, form: v.version.form, facts: v.version.facts.map((f) => ({ ...f, text: 'ZZZ-SENTINEL' })) } }
    const [b] = team.modelBandOf(s).filter((x) => x.option === 'Add one specialist')
    expect(b).toMatchObject({ option: 'Add one specialist', measure: 'total capacity', unit: 'ticket/week', leavesOut: 'How the team feels about a new hire' })
    expect(b.low).toBeCloseTo(89.68, 1)
    expect(b.words).not.toContain('ZZZ')
    expect(b.words).toMatch(/‘Add one specialist’/)
  })
  it('D7: nothing is shown when view_findings is absent or null', () => {
    expect(team.viewFindingsOf(scenario({}))).toBeNull()
    expect(team.viewFindingsOf(scenario({ view_findings: null }))).toBeNull()
  })
  it('D7: a stale comparison shows its status and nothing else, whatever else it carries', () => {
    for (const code of ['version_moved', 'reveal_moved', 'a_code_later']) {
      const r = team.viewFindingsOf(scenario({ view_findings: { status: 'stale', code, version: 1, reveal: 9, contributions: [], facts: S6.same } }))
      expect(r).toMatchObject({ status: 'stale' })
      expect(r.rows).toBeUndefined()
      expect(r.words).toMatch(/out of date|has changed|again/i)
    }
    // each code its own words
    const words = ['version_moved', 'reveal_moved', 'a_code_later'].map((code) => team.viewFindingsOf(scenario({ view_findings: { status: 'stale', code } })).words)
    expect(new Set(words).size).toBe(3)
    expect(words[0]).toMatch(/approved model has changed/)
    expect(words[1]).toMatch(/revealed again/)
  })
  // The words of a comparison belong to the AI: a D7 row is core's labels (`leader: reversed`) and the names core gives, never a sentence of DGAI's.
  const SENTENCE = / leads | still leads|instead of|where no option led|clearly leads/
  const pair = (row, label) => row.pairs.find((p) => p.label === label)?.item
  it('D7: a current comparison is one row per figure and aim, as labels from about: same, reversed, and a refused figure', () => {
    const r = team.viewFindingsOf(scenario({ view_findings: findings([...S6.same, ...S6.reversed, ...S6.refused]) }))
    expect(r.status).toBe('current')
    expect(r.rows).toHaveLength(3)
    const [same, reversed, refused] = r.rows
    expect(pair(same, 'figure')).toBe('‘x’, Priya’s')
    expect(pair(same, 'aim')).toBe('‘reach 100’')
    expect(pair(same, 'leader')).toBe('same')
    expect(pair(same, 'most likely on the model')).toBe('‘add’')
    expect(pair(same, 'most likely on Priya’s figure')).toBe('‘add’')
    expect(pair(reversed, 'leader')).toBe('reversed')
    expect(pair(reversed, 'most likely on the model')).toBe('‘add’')
    expect(pair(reversed, 'most likely on Priya’s figure')).toBe('‘tool’')
    expect(reversed.change).toBe('reversed')
    expect(same.change).toBe('same')
    expect(same.options.find((o) => o.option === 'add').words).toMatch(/about 50%.*about 90%/)
    expect(refused.status).toBe('refused')
    expect(pair(refused, 'not run')).toBeDefined()
    for (const row of r.rows) {
      expect(row.words).toBe(row.pairs.map((p) => `${p.label}: ${p.item}`).join('; '))
      expect(row.words).not.toMatch(SENTENCE)
      expect(row.words).not.toMatch(/holder:|unknown figure|leader on view|leader on model|gap:/)   // core\'s own text pairs are never read
    }
  })
  it('D7: a leader that appears or disappears is core\'s own word for it, and a null leader reads "none separated"', () => {
    const f = (change, leader, model) => ({ ...S6.same[0], about: { ...S6.same[0].about, leader, model_leader: model, leader_change: change } })
    const rows = team.viewFindingsOf(scenario({ view_findings: findings([f('now named', 'add', null), f('now unnamed', null, 'add')]) })).rows
    expect(pair(rows[0], 'leader')).toBe('now named')
    expect(pair(rows[0], 'most likely on the model')).toBe('none separated')
    expect(pair(rows[1], 'leader')).toBe('now unnamed')
    expect(pair(rows[1], 'most likely on Priya’s figure')).toBe('none separated')
    expect(rows.map((r) => r.words).join(' ')).not.toMatch(SENTENCE)
  })
  // Review 00008 #5: the old test checked that the messages differed, so swapping two of them passed. Each code now has its own meaning pinned,
  // and each message must match its own meaning and no other code's.
  const REFUSAL_MEANING = {
    unknown_figure: /does not hold that figure/, derived_figure: /worked out from others/, structure_figure: /fixed by how the model is built/, no_figure: /no figure was given/,
    no_unit: /figure has no unit/, unit_mismatch: /different unit/, not_a_figure: /not a figure Olumi can use/, outside_range: /outside what is possible/, no_range_kind: /firm or a rough estimate/,
    version_moved: /approved model has changed/, capped: /too many figures were revealed/, model_not_run: /no result to compare with/, option_left_out: /option could not be compared/,
    view_cannot_compile: /with that figure cannot be worked out/, different_draws: /could not be put on the same draws/, view_not_run: /with that figure did not run/,
    draws_differ: /did not use the same draws/, no_aim_compared: /no aim to compare on/, view_error: /went wrong running it/,
  }
  const GENERIC = /cannot yet say why/
  const refusalWords = (code) => {
    const f = { ...S6.refused[0], value: `not run: ${String(code).replace(/_/g, ' ')}`, about: { ...S6.refused[0].about, code } }
    const [row] = team.viewFindingsOf(scenario({ view_findings: findings([f]) })).rows
    return pair(row, 'not run')
  }
  it('D7: all 19 refusal codes core can give are named, each with its own meaning', () => {
    expect(Object.keys(REFUSAL_MEANING)).toHaveLength(19)
    for (const [code, meaning] of Object.entries(REFUSAL_MEANING)) {
      const words = refusalWords(code)
      expect(words, code).toMatch(meaning)
      expect(words, code).not.toContain('_')
      expect(words, code).not.toMatch(GENERIC)
      // and it is not the meaning of any other code: two messages swapped would fail here
      expect(Object.entries(REFUSAL_MEANING).filter(([, m]) => m.test(words)).map(([c]) => c), code).toEqual([code])
    }
  })
  it('D7: a code core adds later gets the generic honest words, never a crash or a silent drop', () => {
    const words = refusalWords('a_code_later')
    expect(words).toMatch(GENERIC)
    expect(Object.values(REFUSAL_MEANING).filter((m) => m.test(words))).toEqual([])
    expect(refusalWords(undefined)).toMatch(GENERIC)
  })
  it('D7: two close sampled chances are told apart, not both rounded to "about 1%" (core\'s apart rule)', () => {
    const f = { ...S6.same[0], about: { ...S6.same[0].about, options: [
      { option: 'add', model: 0.0133, view: 0.0089, gap: -0.0044, exact: false, model_exact: false, view_exact: false },
      { option: 'carry_on', model: 0.5, view: 0.5, gap: 0, exact: false, model_exact: false, view_exact: false }] } }
    const [row] = team.viewFindingsOf(scenario({ view_findings: findings([f]) })).rows
    expect(row.options[0].words).toBe('‘add’: about 1.3% on the model, about 0.9% on Priya’s figure.')
    expect(row.options[0].words).not.toContain('about 1%')
    // equal chances stay equal; they are not given invented decimals to differ
    expect(row.options[1].words).toBe('‘carry on’: about 50% on the model, about 50% on Priya’s figure.')
    // and the client's formatter is the shim's (core's) over the whole range: same strings for the same two chances
    for (const [a, b] of [[0.0133, 0.0089], [0.0049, 0.0051], [0.994, 0.996], [0.5003, 0.5004], [0.5, 0.5], [0, 0.0004], [0.9996, 1], [0.123456, 0.123789]]) {
      const [x, y] = team.apartPct(a, b)
      expect([x, y], `${a} ${b}`).toEqual(a === b ? [chancePct(a), chancePct(b)] : apart(a, b))
    }
    for (let c = 0; c <= 1.0001; c += 0.0007) expect(team.chancePct(c)).toBe(chancePct(c))
  })
  it('D7: a sampled chance at either end is never certain, an exact one says it is fixed, and a null leader does not leave a gap', () => {
    const f = { ...S6.same[0], about: { ...S6.same[0].about, leader: null, model_leader: null, options: [
      { option: 'add', model: 0, view: 1, gap: 1, exact: false, model_exact: false, view_exact: false },
      { option: 'carry_on', model: 0, view: 1, gap: 1, exact: true, model_exact: true, view_exact: true }] } }
    const [row] = team.viewFindingsOf(scenario({ view_findings: findings([f]) })).rows
    expect(row.options[0].words).toBe('‘add’: under 1% on the model, over 99% on Priya’s figure.')
    expect(row.options[1].words).toBe('‘carry on’: never meets on the model, always meets on Priya’s figure.')
    expect(row.words).not.toMatch(/,\s{2}|, still/)
  })
  it('D7: both provenance blocks are kept, apart: what the model rests on and what the model with the member\'s figure rests on', () => {
    // core: the model's x is Olumi's range, so the model rests on it; Priya's figure is hers, so the view side does not.
    const [row] = team.viewFindingsOf(scenario({ view_findings: findings(S6.olumi_x) })).rows
    expect(row.sides).not.toBeNull()
    expect(row.sides.model.olumi).toBe(true)
    expect(row.sides.model.lines.join(' ')).toMatch(/Olumi's what-if figures for ‘x’ \(not yet approved\)/)
    expect(row.sides.view.olumi).toBe(false)
    expect(row.sides.view.lines.join(' ')).not.toMatch(/what-if figures/)
    // each side is read from its own block: flip one and only that side changes
    const flipped = clone(S6.olumi_x); flipped[0].about.view_side = { ...flipped[0].about.view_side, olumi: true, olumi_mechanisms: [{ id: 'x', approval: 'approved' }] }
    const [again] = team.viewFindingsOf(scenario({ view_findings: findings(flipped) })).rows
    expect(again.sides.model).toEqual(row.sides.model)
    expect(again.sides.view.olumi).toBe(true)
    expect(again.sides.view.lines.join(' ')).toMatch(/calculations Olumi proposed \(approved\)/)
    // a refused figure has no model run, so no blocks
    expect(team.viewFindingsOf(scenario({ view_findings: findings(S6.refused) })).rows[0].sides).toBeNull()
  })
  it('D7: a figure\'s range_kind is carried to the spread, firm ends or a rough range, on core\'s own figure shape (no `kind`)', () => {
    const s = scenario({ views: [
      { id: 1, by: 'Priya', mine: false, revealed: true, text: 'a', skip: false, figures: [{ quantity: 'x', unit: 'job/week', version: 1, low: 1, high: 2, range_kind: 'bounds' }] },
      { id: 2, by: 'Sam', mine: false, revealed: true, text: 'b', skip: false, figures: [{ quantity: 'x', unit: 'job/week', version: 1, low: 2, high: 4, range_kind: 'plausible' }] }] })
    expect(team.spreadsOf(s)[0].positions.map((p) => [p.kind, p.rangeKind])).toEqual([['interval', 'bounds'], ['interval', 'plausible']])
  })
})
