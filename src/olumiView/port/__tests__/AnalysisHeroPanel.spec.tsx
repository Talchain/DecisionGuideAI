/**
 * The ported analysis hero draws the View exactly: core's lead as the one headline, the most likely line, every option's every row under
 * the aim it is about, in core's card order (never re-ranked by its chance), core's lens words, the next step; nothing when the View has
 * no Run. Fixtures: real-AI boards (fixtures/real): bakery (one aim) and hiring (two aims per option, a newest next step).
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import type { View } from '../../client'
import { optionCards } from '../../layout'
import { AnalysisHeroPanel } from '../AnalysisHeroPanel'
import { TYPE } from '../type'
import { expectAllBound, viewOf } from './viewAt'

afterEach(cleanup)

const bakery = viewOf('real/bakery-r5')
const hiring = viewOf('real/hiring')
const draw = (v: View) => render(<AnalysisHeroPanel model={v.model!} chat={v.chat} />).container
const pricing = viewOf('core/pricing')
const lensesIn = (v: View) => (v.model!.run as unknown as { lenses: { id: string; label: string; title: string }[] }).lenses

describe('the ported hero draws the View exactly (design §3)', () => {
  for (const [name, v] of [['bakery', bakery], ['hiring', hiring]] as const) {
    it(`${name}: every drawn string is the View's own at its path; every option's every row is drawn with core's hover`, () => {
      const c = draw(v)
      expect(expectAllBound(v, c, expect)).toBeGreaterThan(5)
      for (const card of optionCards(v.model!)) card.rows.forEach((row, i) => {
        const el = c.querySelector(`[data-view-row="${card.id}.rows.${i}"]`)
        expect(el, `${card.id} row ${i}`).not.toBeNull()
        expect(el!.getAttribute('title'), `${card.id} row ${i}`).toBe(row.title)
      })
    })
  }

  it('the headline is core\'s lead, the panel\'s one 18px line; the most likely line follows in core\'s words', () => {
    const c = draw(bakery)
    const h = c.querySelector('[data-view="run.lead"]')!
    expect(h.textContent).toBe(bakery.model!.run!.lead)
    expect(h.className).toContain(TYPE.headline)
    expect([...c.querySelectorAll<HTMLElement>('*')].filter((e) => typeof e.className === 'string' && e.className.includes(TYPE.headline)).length).toBe(1)
    expect(c.querySelector('[data-view="run.most_likely.text"]')!.textContent).toBe(bakery.model!.run!.most_likely!.text)
  })

  it('no win share, rank or verdict of the UI\'s own: no "best", "winner", "recommend", "on top", "Option N"', () => {
    for (const v of [bakery, hiring]) expect(draw(v).textContent).not.toMatch(/\bbest\b|winner|recommend|on top|Option \d/i)
  })
})

describe('each aim\'s rows under that aim\'s own words', () => {
  it('hiring: two groups, in the order the aims first appear, each holding exactly that aim\'s rows in card order', () => {
    const c = draw(hiring)
    const groups = [...c.querySelectorAll<HTMLElement>('[data-testid="port-aim-group"]')]
    expect(groups.map((g) => g.dataset['aim'])).toEqual(['boost_productivity', 'meet_launch_deadline'])
    for (const g of groups) {
      const want = optionCards(hiring.model!).flatMap((card) => card.rows.flatMap((r, i) => (r.aim_id === g.dataset['aim'] ? [`${card.id}.rows.${i}`] : [])))
      expect([...g.querySelectorAll<HTMLElement>('[data-view-row]')].map((e) => e.dataset['viewRow'])).toEqual(want)
      const head = g.querySelector<HTMLElement>('[data-testid="port-aim-heading"]')!
      const first = optionCards(hiring.model!)[0]!.rows.find((r) => r.aim_id === g.dataset['aim'])! as { aim: string }
      expect(head.textContent).toBe(first.aim)
    }
  })

  it('never re-ranked: reversing core\'s card order reverses the drawn order (identity, not the chance)', () => {
    const v = structuredClone(bakery), m = v.model!
    const ids = optionCards(m).map((x) => x.id)
    m.cards = [...m.cards].reverse()
    const drawn = [...draw(v).querySelectorAll<HTMLElement>('[data-aim="sell_360"] [data-view-row]')].map((e) => e.dataset['optionId'])
    expect(drawn).toEqual([...ids].reverse())
  })

  it('core\'s ◉ is the only leader, on exactly the rows core marks; a View with no mark has no leader', () => {
    const marked = (v: View) => [...draw(v).querySelectorAll<HTMLElement>('[data-leader="true"]')].map((e) => e.dataset['viewRow'])
    const want = (v: View) => optionCards(v.model!).flatMap((card) => card.rows.flatMap((r, i) => (r.kind === 'chance' && r.likely != null ? [`${card.id}.rows.${i}`] : [])))
    expect(marked(hiring)).toEqual(want(hiring))
    expect(marked(hiring).length).toBe(2)
    cleanup()
    const none = structuredClone(bakery)
    for (const card of none.model!.cards) for (const r of card.rows) if (r.kind === 'chance') r.likely = null
    expect(marked(none)).toEqual([])
  })
})

describe('core\'s lenses (run.lenses, wip/core-port-fields)', () => {
  it('core\'s pricing golden: core\'s tab words and hovers; the outcome lens draws the bands and no leader', () => {
    const v = pricing, lenses = lensesIn(v)
    expect(lenses.map((l) => l.id)).toEqual(['goal', 'outcome'])
    const c = draw(v)
    const tabs = [...c.querySelectorAll<HTMLElement>('[role="tab"]')]
    expect(tabs.map((t) => [t.textContent, t.getAttribute('title')])).toEqual(lenses.map((l) => [l.label, l.title]))
    expect(c.querySelector('[data-lens]')!.getAttribute('data-lens')).toBe('goal')
    expect(c.querySelector('[data-view="raise_price.rows.0.value"]')!.textContent).toBe('about 49% chance')
    expect([...c.querySelectorAll<HTMLElement>('[data-leader="true"]')].map((e) => e.dataset['optionId'])).toEqual([(v.model!.run!.most_likely as unknown as { option: string }).option])
    fireEvent.click(c.querySelector('[data-testid="port-lens-tab-outcome"]')!)
    expect(c.querySelector('[data-lens]')!.getAttribute('data-lens')).toBe('outcome')
    const r = v.model!.cards.find((x) => x.id === 'raise_price')!.rows[0] as { outcome: { text: string } }
    expect(c.querySelector('[data-view="raise_price.rows.0.outcome.text"]')!.textContent).toBe(r.outcome.text)
    expect(c.querySelectorAll('[data-leader="true"]').length).toBe(0)
    expect(expectAllBound(v, c, expect)).toBeGreaterThan(5)
  })

  it('negative: a View without lens words draws no tab strip and the goal lens', () => {
    const c = draw(bakery)
    expect(c.querySelector('[role="tablist"]')).toBeNull()
    expect(c.querySelector('[data-lens]')!.getAttribute('data-lens')).toBe('goal')
  })
})

describe('the next step and an absent Run', () => {
  it('hiring: the coach\'s newest next step in core\'s words, at its chat path', () => {
    const c = draw(hiring)
    const k = hiring.chat.findIndex((t) => t.answer?.next.newest === true)
    expect(c.querySelector(`[data-view="chat.${k}.answer.next.label"]`)!.textContent).toBe(hiring.chat[k]!.answer!.next.label)
  })

  it('a model with no Run draws nothing (never a placeholder)', () => {
    const v = structuredClone(bakery)
    v.model!.run = null
    expect(draw(v).innerHTML).toBe('')
  })
})
