import { describe, expect, it } from 'vitest'
import { dissentsOf, heldOf, heldWords, memberStates, myOpenView, recordChoices, revealedViews, wordsOfRecord } from '../team/model'
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
    expect(heldOf(s)).toEqual({ given: 2, of: 3 })
    expect(heldWords(heldOf(s)!)).toBe('2 of 3 views held')
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
