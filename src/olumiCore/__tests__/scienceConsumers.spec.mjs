import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { analysisViewOf } from '../../../scripts/olumi-core/lib/model.mjs'
import { coachText, makeShim } from '../../../scripts/olumi-core/lib/turn.mjs'
import { apart, chancePct } from '../../../scripts/olumi-core/lib/labels.mjs'
import { noteOf, fillCited, UNEXPLAINED } from '../../../scripts/olumi-core/lib/note.mjs'
import { derivedUuidOfSid } from '../../../scripts/olumi-core/lib/ids.mjs'
import * as team from '../team/model'
import { parseCanonicalAnalysisView } from '../../canvas/runView/canonicalAnalysisView'

/**
 * Science step 4, DGAI's consumers (change list STEP4-DGAI-CHANGE-LIST.md, one test per bullet). Fixtures are olumi-core's own producer output
 * (wip/science-step-s5 c52948e, wip/science-step-s6 54cc570) copied into fixtures/science; the science module kinds are hand stubs (see below).
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

describe('most_likely and none_clearly (bullets 4 and 5)', () => {
  it('most_likely: leader.words from option, chance, next, next_chance and separated_by', () => {
    const w = analysisViewOf(viewOf('capacity')).leader.words
    expect(w).toMatch(/‘Add one specialist’ is the option most likely to achieve ‘At least 100 a week’/)
    expect(w).toContain('about 50%')
    expect(w).toContain('under 1%')
    expect(w).toMatch(/‘Keep current staffing’/)
    expect(w).toMatch(/same draws/)
    expect(analysisViewOf(viewOf('limits')).leader.words).toMatch(/not on the same draws|intervals/)
  })
  it('a leader that turns on an Olumi range says which option leads at each end (leads_when) and rests on both options\' premises', () => {
    const w = analysisViewOf(viewOf('leader_turns')).leader.words
    expect(w).toMatch(/depends on Olumi's estimate of ‘per specialist’: ‘Keep current staffing’ leads when it is low, ‘Add one specialist’ when it is high/)
    const v = viewOf('capacity', (fs) => fs.map((f) => (f.about.kind === 'most_likely' ? { ...f, about: { ...f.about, rests: ['lead_doubt'] } } : f)))
    expect(analysisViewOf(v).leader.words).toMatch(/lead_doubt|A new hire may unsettle the team/)
  })
  it('none_clearly: uses top, next, the two chances and leads_when; never the marker', () => {
    const w = analysisViewOf(viewOf('none_separated')).leader.words
    expect(w).toMatch(/No option is clearly ahead on ‘At least 100 a week’/)
    expect(w).toMatch(/‘Add one specialist’.*about 41%.*‘Keep current staffing’.*about 40%/)
    expect(w).toMatch(/depends on Olumi's estimate of ‘per specialist’/)
    expect(w).not.toMatch(/most likely: none separated/)
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
    'ruled_out', 'removed', 'waits_on_aim', 'waits_on_limit', 'model_errors', 'schema', 'out_of_domain', 'no_goals', 'no_option_change', 'unlisted']
  const withReasons = (reasons) => viewOf('agency_withheld', (fs) => fs.map((f) => (f.about.kind === 'blocker' ? { ...f, about: { ...f.about, reasons } } : f)))
  const reasonsOf = (v) => analysisViewOf(v).options.find((o) => o.option_id === 'agency').cell.reasons
  it.each(CODES)('%s has a plain message of its own', (code) => {
    const [r] = reasonsOf(withReasons([{ code, ids: ['agency_staff'] }]))
    expect(r.code).toBe(code)
    expect(r.message.length).toBeGreaterThan(10)
    if (code.includes('_')) expect(r.message).not.toContain(code)
    expect(r.message).not.toMatch(/_/)
  })
  it('an unknown code (or none at all) gets a generic honest message, never a crash or a silent drop', () => {
    const [r] = reasonsOf(withReasons([{ code: 'a_code_core_adds_later', ids: [] }]))
    expect(r.message).toMatch(/could not work this out/i)
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
      expect(notes.find((n) => n.endsWith(value)), value).toContain(`‘${name}’`)
    }
    expect(notes.join('\n')).not.toContain('a: b')
    expect(parseCanonicalAnalysisView(analysisViewOf(v))).not.toBeNull()
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
  })
  it('D7: a current comparison is one row per figure and aim, worded from about: same, reversed, and a refused figure', () => {
    const r = team.viewFindingsOf(scenario({ view_findings: findings([...S6.same, ...S6.reversed, ...S6.refused]) }))
    expect(r.status).toBe('current')
    expect(r.rows).toHaveLength(3)
    expect(r.rows[0].words).toMatch(/Priya.*‘x’.*‘add’ still leads ‘reach 100’/)
    expect(r.rows[1].words).toMatch(/‘tool’ leads ‘reach 100’ instead of ‘add’/)
    expect(r.rows[0].options.find((o) => o.option === 'add').words).toMatch(/about 50%.*about 90%/)
    expect(r.rows[2].words).toMatch(/Priya.*not run/i)
    expect(r.rows.map((x) => x.words).join(' ')).not.toMatch(/leader:|holder:|not run: /)
  })
  it('D7: each refusal code has its own words, and an unknown one is generic', () => {
    const codes = ['unknown_figure', 'derived_figure', 'structure_figure', 'no_figure', 'no_unit', 'unit_mismatch', 'not_a_figure', 'outside_range', 'no_range_kind', 'version_moved', 'capped', 'model_not_run', 'option_left_out',
      'view_cannot_compile', 'different_draws', 'view_not_run', 'draws_differ', 'no_aim_compared', 'a_code_later']
    const seen = new Set()
    for (const code of codes) {
      const f = { ...S6.refused[0], value: `not run: ${code.replace(/_/g, ' ')}`, about: { ...S6.refused[0].about, code } }
      const [row] = team.viewFindingsOf(scenario({ view_findings: findings([f]) })).rows
      expect(row.words, code).not.toContain('_')
      seen.add(row.words)
    }
    expect(seen.size).toBe(codes.length - 1 + 1)
  })
  it('D7: a figure\'s range_kind is carried to the spread, firm ends or a rough range', () => {
    const s = scenario({ views: [
      { id: 1, by: 'Priya', mine: false, revealed: true, text: 'a', skip: false, figures: [{ kind: 'interval', quantity: 'x', low: 1, high: 2, range_kind: 'bounds' }] },
      { id: 2, by: 'Sam', mine: false, revealed: true, text: 'b', skip: false, figures: [{ kind: 'interval', quantity: 'x', low: 2, high: 4, range_kind: 'plausible' }] }] })
    expect(team.spreadsOf(s)[0].positions.map((p) => p.rangeKind)).toEqual(['bounds', 'plausible'])
  })
})
