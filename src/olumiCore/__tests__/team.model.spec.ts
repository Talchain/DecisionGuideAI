import { afterEach, describe, expect, it } from 'vitest'
import { bandNumber, dissentsOf, heldOf, heldWords, isForThisPage, isTeamScenario, memberStates, modelBandOf, myOpenView, recordChoices, revealedViews, viewPhaseOf, waitingNames, wordsOfRecord, youIdOf } from '../team/model'
import { coreScenarioIdOf } from '../team/sid'
import { scenario } from './teamFixtures'

describe('which core scenario is this page on', () => {
  it('reads the page-kept pairing first, then the derived form', () => {
    expect(coreScenarioIdOf('11111111-2222-4333-8444-555555555555', () => 's_abc123')).toBe('s_abc123')
    expect(coreScenarioIdOf('00000000-0000-4000-8000-75ba67edc0e5', () => null)).toBe('s_75ba67edc0e5')
  })
  it('knows nothing of a scenario core has not paired (a fresh UUID with no pairing), and refuses a pairing that is not a core id', () => {
    expect(coreScenarioIdOf('11111111-2222-4333-8444-555555555555', () => null)).toBeNull()
    expect(coreScenarioIdOf('11111111-2222-4333-8444-555555555555', () => '../evil')).toBeNull()
    expect(coreScenarioIdOf(null)).toBeNull()
  })
})

describe('the held count is the current round, from members, waiting and reveal', () => {
  it('counts a skip as given (core takes a skipper out of `waiting`) and never reads views.length', () => {
    const s = scenario({
      members: [{ id: '1', name: 'Ada' }, { id: '5', name: 'Bea' }, { id: '6', name: 'Cy' }],
      waiting: ['Cy'], reveal: { state: 'open', at: null },
      // Ada's own view is all this person can see: views.length is 1 although two views are held.
      views: [{ id: 7, by: 'Ada', mine: true, revealed: false, text: 'x', skip: false }],
    })
    expect(heldOf(s)).toEqual({ given: 2, of: 3, notAnswering: 0 })
    expect(heldWords(heldOf(s)!)).toBe('2 of 3 in')
  })
  it('is not drawn once a round is revealed: core then lists everyone as waiting for the NEXT round, which is not lateness', () => {
    const s = scenario({ reveal: { state: 'revealed', at: '2026-11-01T18:37:58.523Z' }, waiting: ['Ada', 'Bea'] })
    expect(heldOf(s)).toBeNull()
    expect(memberStates(s).map((m) => m.state)).toEqual(['in', 'in'])
  })
  it('puts each member in one of: waiting, view held, in', () => {
    const s = scenario({ waiting: ['Bea'], reveal: { state: 'open', at: null } })
    expect(memberStates(s).map((m) => [m.member.name, m.state])).toEqual([['Ada', 'held'], ['Bea', 'waiting']])
  })
})

describe('views', () => {
  it('my open view is mine and unrevealed; revealed views are every revealed one, in core order', () => {
    const s = scenario({ views: [
      { id: 7, by: 'Ada', mine: true, revealed: true, text: 'first', skip: false },
      { id: 8, by: 'Bea', mine: false, revealed: true, text: '', skip: true },
      { id: 10, by: 'Ada', mine: true, revealed: false, text: 'second', skip: false },
    ] })
    expect(myOpenView(s)?.id).toBe(10)
    expect(revealedViews(s).map((v) => v.id)).toEqual([7, 8])
  })
})

describe('records of the approved model', () => {
  it('evidence can bear on records with words of their own, and on nothing before a version is approved', () => {
    expect(recordChoices(scenario()).map((c) => c.id)).toEqual(['per_specialist', 'add_one', 'lead_doubt'])
    expect(recordChoices(scenario({ version: null }))).toEqual([])
  })
  it('names a kept disagreement by its holder and position, and reports a record a later version no longer holds as unknown', () => {
    expect(wordsOfRecord(scenario(), 'lead_doubt')).toBe('our team lead: A new hire may unsettle the team.')
    expect(wordsOfRecord(scenario(), 'gone')).toBeNull()
    expect(dissentsOf(scenario()).map((r) => r.id)).toEqual(['lead_doubt'])
  })
})

describe('Codex 2: a view given before someone joined is not this round\'s, so the composer stays (core lists you as waiting)', () => {
  // Ada gave a view; Bea then joined; core lists Ada AND Bea as waiting and keeps Ada's old private view.
  const stale = (over = {}) => scenario({ waiting: ['Ada', 'Bea'], views: [{ id: 7, by: 'Ada', mine: true, revealed: false, text: 'my earlier view', skip: false }], ...over })
  it('Ada is waiting although she holds an old view, and her panel is the composer', () => {
    expect(memberStates(stale()).map((m) => m.state)).toEqual(['waiting', 'waiting'])
    expect(myOpenView(stale())?.text).toBe('my earlier view')
    expect(viewPhaseOf(stale())).toBe('compose')
  })
  it('once she gives one for this round she is held, and the panel shows it', () => {
    const s = stale({ waiting: ['Bea'] })
    expect(viewPhaseOf(s)).toBe('held')
    expect(memberStates(s).map((m) => m.state)).toEqual(['held', 'waiting'])
  })
  it('after a reveal it is a summary of what she gave, or the composer for someone who gave nothing', () => {
    const revealed = scenario({ reveal: { state: 'revealed', at: 't' }, views: [{ id: 7, by: 'Ada', mine: true, revealed: true, text: 'x', skip: false }] })
    expect(viewPhaseOf(revealed)).toBe('revealed')
    expect(viewPhaseOf(scenario({ reveal: { state: 'revealed', at: 't' } }))).toBe('compose')
  })
})

describe('Codex 8: a person is a member id, never a display name', () => {
  const chris = (over = {}) => scenario({ you: 'Chris', members: [{ id: '1', name: 'Chris' }, { id: '5', name: 'Chris' }], waiting: ['Chris'], ...over })
  afterEach(() => { delete (globalThis as { __OLUMI_CORE__?: unknown }).__OLUMI_CORE__ })
  const asPage = (id: string | null) => { (globalThis as { __OLUMI_CORE__?: unknown }).__OLUMI_CORE__ = id === null ? undefined : { person: { id, name: 'Chris' } } }
  it('"you" is the member whose id the page was opened for: one row, not both', () => {
    asPage('5')
    expect(youIdOf(chris())).toBe('5')
    expect(memberStates(chris()).map((m) => [m.member.id, m.you])).toEqual([['1', false], ['5', true]])
  })
  it('with two Chrises and one waiting, only the right one is waiting: you hold a view, so the other is the one waiting', () => {
    asPage('5')
    const s = chris({ views: [{ id: 9, by: 'Chris', mine: true, revealed: false, text: 'mine', skip: false }] })
    expect(memberStates(s).map((m) => [m.member.id, m.state])).toEqual([['1', 'waiting'], ['5', 'held']])
    expect(waitingNames(s)).toEqual(['Chris'])
  })
  it('when it cannot be told which Chris is waiting, neither is given a state it may not have, and "you" is not guessed', () => {
    asPage(null)
    expect(youIdOf(chris())).toBeNull()
    expect(memberStates(chris()).map((m) => m.state)).toEqual(['unclear', 'unclear'])
    expect(memberStates(chris()).some((m) => m.you)).toBe(false)
  })
  it('a name that is only one member\'s still works by name when the page does not say who it is', () => {
    expect(youIdOf(scenario())).toBe('1')
  })
})

describe('design QA 1: a skip is a skip, and the count says so', () => {
  const skip = scenario({ waiting: ['Bea'], views: [{ id: 7, by: 'Ada', mine: true, revealed: false, text: '', skip: true }] })
  it('your own skip reads "not answering", counts as in, and the count line names it', () => {
    expect(memberStates(skip).map((m) => m.state)).toEqual(['notAnswering', 'waiting'])
    expect(heldWords(heldOf(skip)!)).toBe('1 of 2 in (1 not answering)')
  })
})

describe('Codex 11: only a whole scenario view is a scenario, and only for this page\'s person', () => {
  it('a body cut short, or any other body, is not a scenario', () => {
    for (const bad of [{}, null, 'x', { ...scenario(), reveal: undefined }, { ...scenario(), members: undefined }, { ...scenario(), reveal: { state: 'nope' } }, { ...scenario(), version: { form: {} } }]) expect(isTeamScenario(bad)).toBe(false)
    expect(isTeamScenario(scenario())).toBe(true)
    expect(isTeamScenario(scenario({ version: null }))).toBe(true)
  })
  it('a view for a person other than the one the page was opened for is not shown', () => {
    expect(isForThisPage(scenario(), '1')).toBe(true)
    expect(isForThisPage(scenario(), '5')).toBe(false)   // member 5 is Bea; this view is Ada's
    expect(isForThisPage(scenario(), '99')).toBe(false)
    expect(isForThisPage(scenario(), null)).toBe(true)
  })
})

describe('design QA 6 and Codex 5: the model\'s range keeps its figures', () => {
  const withBand = (about: Record<string, unknown> | undefined, text = 'Under \'Add one specialist\', \'total capacity\' is likely to be in this range (8 draws in 10). It leaves out: How the team feels about a new hire.') => scenario({ version: { ...scenario().version!, facts: [{ id: 'F4', value: 'between 89.7 and 110 ticket/week (middle 99.9)', text, about: about as never }] } })
  const range = { kind: 'range', option: 'add_one', goal: 'capacity_goal', low: 89.6795181966731, high: 109.91851476864522, median: 99.9, unit: 'ticket/week' }
  it('the two ends as numbers, the option it is under and what it leaves out', () => {
    const base = withBand(range)
    const s = { ...base, version: { ...base.version!, form: { records: [...base.version!.form.records, { id: 'capacity_goal', family: 'goal', label: 'At least 100 a week', measure: { quantity: 'per_specialist' } }] } } }
    expect(modelBandOf(s)).toEqual([{ id: 'F4', option: 'Add one specialist', measure: 'Tickets added per specialist', low: 89.6795181966731, high: 109.91851476864522, unit: 'ticket/week', valueWords: 'between 89.7 and 110 ticket/week (middle 99.9)', leavesOut: 'How the team feels about a new hire' }])
    expect(bandNumber(89.6795181966731)).toBe('89.7')
    expect(bandNumber(109.91851476864522)).toBe('110')
  })
  it('a range with no numbers keeps core\'s own words; a chance is not a range; no leaves-out is none', () => {
    expect(modelBandOf(withBand({ kind: 'range' }, 'Under X it is likely.'))[0]).toMatchObject({ low: null, high: null, valueWords: 'between 89.7 and 110 ticket/week (middle 99.9)', leavesOut: null })
    expect(modelBandOf(withBand({ kind: 'chance', low: 1, high: 2 }))).toEqual([])
    expect(modelBandOf(scenario({ version: null }))).toEqual([])
  })
})
