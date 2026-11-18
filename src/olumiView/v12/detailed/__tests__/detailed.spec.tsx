/**
 * V12 DETAILED (Paul, 17 Nov 2026: "a much better version of the detailed view to make it not overwhelming but truly valuable with rich data").
 * One row per rule, on the real card (previous/CoreCard.tsx) at the Detailed level, on the repo's served Views; every expected word is core's
 * own field, bound by card id and row place; each row has its contrast. A field changed for a contrast is spread onto a served card.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('../../../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: {} }))
vi.mock('@xyflow/react', async () => ({ ...(await vi.importActual<object>('@xyflow/react')), Handle: () => null }))
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, render } from '@testing-library/react'
import { ReactFlowProvider, type NodeProps } from '@xyflow/react'
import type { View, ViewCard } from '../../../client'
import { useViewStore } from '../../../store'
import { useMe } from '../../../../olumiCore/me'
import { CoreCard } from '../../../previous/CoreCard'
import { QUESTION } from '../../../layout'
import { setDefaultLevel, useSimpleLevel } from '../../simpleStore'
import { optionLetters } from '../../cards/letters'
import { chanceParts, noChanceLineOf } from '../../cards/words'
import { ROW_WORDS_MAX } from '../marks'
import { saidOnceOf, sharedNoChance, sharedRowStates } from '../said'

const load = (f: string) => JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures', f), 'utf8')) as View
const ASKED = load('core-38eebca9/bakery-asked.view3.json'), HIRING = load('real/hiring-unchecked-first.view3.json'), HOSTING = load('real/hosting.view3.json')
const cardOf = (v: View, id: string): ViewCard => v.model!.cards.find((c) => c.id === id)!
const withCard = (v: View, card: ViewCard): View => ({ ...v, model: { ...v.model!, cards: v.model!.cards.map((c) => (c.id === card.id ? card : c)) } })
const optionsOf = (v: View) => v.model!.cards.filter((c) => c.family === 'option')

const Node = CoreCard as unknown as (p: NodeProps) => JSX.Element
/** The real card at the Detailed level (`working`) on a View; the question by its id. */
const draw = (view: View, id: string): HTMLElement => {
  setDefaultLevel('working')
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: view.id, view, status: 'ready', error: null, stale: false, at: null } as never)
  useMe.setState({ me: { id: view.you_id, name: view.you }, status: 'ready' })
  const data = id === QUESTION ? {} : { card: cardOf(view, id) }
  return render(<ReactFlowProvider><Node {...({ id, type: 'viewCard', data, selected: false, dragging: false, zIndex: 0, isConnectable: false,
    positionAbsoluteX: 0, positionAbsoluteY: 0, selectable: true, deletable: false, draggable: false } as unknown as NodeProps)} /></ReactFlowProvider>).container
}
const faceOf = (el: HTMLElement, id: string) => el.querySelector<HTMLElement>(`[data-core-card="${id}"]`)!
/** The words drawn at rest: the face without a closed disclosure's body (look/WorkedSteps keeps its steps in the page, closed). */
const drawn = (face: HTMLElement): string => { const c = face.cloneNode(true) as HTMLElement; for (const d of c.querySelectorAll('details:not([open])')) d.remove(); return c.textContent ?? '' }

beforeEach(() => { window.localStorage.clear(); useSimpleLevel.setState({ levels: {} }) })
afterEach(() => { cleanup(); setDefaultLevel('simple'); useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none' } as never); useMe.setState({ me: null, status: 'none' }) })

describe('Detailed: each fact said once on the board (said.ts)', () => {
  it('DT1 every option\'s no-chance line alike: said once on the aim it is about; each option keeps only the empty track. CONTRAST: one option\'s own step differs, so every option says its own line and the aim says none', () => {
    const opts = optionsOf(ASKED), line = noChanceLineOf(opts[0]!.headline!).line, aim = opts[0]!.headline!.aim_id!
    expect(opts.length, 'precondition: three options').toBe(3)
    expect(sharedNoChance(ASKED.model!)).toMatchObject({ text: line, at: aim })
    for (const o of opts) {
      const face = faceOf(draw(ASKED, o.id), o.id)
      expect([o.id, face.querySelector('[data-ok-face="none"]')?.hasAttribute('data-said-once'), face.querySelector(`[data-view="${o.id}.headline.add"]`), face.textContent?.includes(line)]).toEqual([o.id, true, null, false])
      expect(face.querySelector(`[data-withheld-track="${o.id}"]`)?.getAttribute('aria-label')).toBe(line)
      cleanup()
    }
    expect(faceOf(draw(ASKED, aim), aim).querySelector(`[data-said-once-on="${aim}"]`)?.textContent).toBe(line)
    cleanup()
    const own = 'An invented step for this option alone.'
    const differs = withCard(ASKED, { ...opts[1]!, headline: { ...opts[1]!.headline!, add: own } })
    expect(sharedNoChance(differs.model!)).toBeNull()
    expect(faceOf(draw(differs, opts[1]!.id), opts[1]!.id).querySelector(`[data-view="${opts[1]!.id}.headline.add"]`)?.textContent).toBe(own)
    cleanup()
    expect(faceOf(draw(differs, opts[0]!.id), opts[0]!.id).querySelector(`[data-view="${opts[0]!.id}.headline.add"]`)?.textContent).toBe(line)
    cleanup()
    expect(faceOf(draw(differs, aim), aim).querySelector(`[data-said-once-on="${aim}"]`)).toBeNull()
  })
  it('DT2 a limit every option says alike ("Needs an answer"): said once on the limit\'s card, no row per option. CONTRAST: one option\'s row differs, so the limit card lists every option by its letter with its own words', () => {
    const aim = 'within_budget', opts = optionsOf(ASKED), letters = optionLetters(ASKED.model!)
    const words = (opts[0]!.rows[1] as { state_text: string }).state_text
    expect([opts.map((o) => o.rows[1]!.aim_id), words]).toEqual([[aim, aim, aim], 'Needs an answer'])
    expect(sharedRowStates(ASKED.model!).get(aim)?.text).toBe(words)
    const lim = faceOf(draw(ASKED, aim), aim)
    expect([lim.querySelector(`[data-said-once-on="${aim}"]`)?.textContent, lim.querySelectorAll('[data-aim-result]').length]).toEqual([words, 0])
    cleanup()
    const own = 'An invented state for this option.'
    const differs = withCard(ASKED, { ...opts[2]!, rows: opts[2]!.rows.map((r, i) => (i === 1 ? { ...r, state_text: own } : r)) } as ViewCard)
    const rows = [...faceOf(draw(differs, aim), aim).querySelectorAll<HTMLElement>('[data-aim-result]')]
    expect(rows.map((r) => [r.getAttribute('data-aim-result'), r.querySelector('[data-letter-chip]')?.textContent, r.querySelector('[data-row-words]')?.textContent]))
      .toEqual(opts.map((o, i) => [o.id, letters.get(o.id), i === 2 ? own : words]))
  })
  it('DT3 each aim\'s results by option letter on the aim\'s own card; the option card no longer names the limit. CONTRAST: the headline\'s own aim lists no option rows (the option cards and the rail carry it)', () => {
    const letters = optionLetters(HIRING.model!), opts = optionsOf(HIRING)
    const rows = [...faceOf(draw(HIRING, 'budget'), 'budget').querySelectorAll<HTMLElement>('[data-aim-results="budget"] [data-aim-result]')]
    expect(rows.map((r) => [r.getAttribute('data-aim-result'), r.querySelector('[data-letter-chip]')?.textContent, r.querySelector(`[data-view$=".rows.2.value"]`)?.textContent]))
      .toEqual(opts.map((o) => [o.id, letters.get(o.id), (o.rows[2] as { value: string }).value]))
    cleanup()
    const opt = faceOf(draw(HIRING, opts[0]!.id), opts[0]!.id)
    expect([opt.querySelectorAll('[data-ok-limit]').length, opt.textContent?.includes((opts[0]!.rows[2] as { value: string }).value)]).toEqual([0, false])
    cleanup()
    expect(faceOf(draw(HIRING, 'increase_productivity'), 'increase_productivity').querySelectorAll('[data-aim-result]').length).toBe(0)
  })
  it('DT4 the question compares the options by letter on one rail, core\'s number words at the right; no option name and no run-on. CONTRAST: a board with no chance draws no rail', () => {
    const q = draw(HIRING, QUESTION), letters = optionLetters(HIRING.model!)
    const rail = q.querySelector<HTMLElement>('[data-detailed-rail]')!
    const rows = [...rail.querySelectorAll<HTMLElement>('[data-rail-row]')]
    expect(rows.map((r) => [r.getAttribute('data-rail-row'), r.querySelector('[data-letter-chip]')?.textContent, r.querySelector('.ok-dt-rail-val')?.textContent]))
      .toEqual(optionsOf(HIRING).map((o) => [o.id, letters.get(o.id), chanceParts(o.headline!.text).head]))
    for (const o of optionsOf(HIRING)) expect(rail.textContent, o.heading).not.toContain(o.heading)
    expect(q.querySelector('[data-rail-rest]')).toBeNull()
    cleanup()
    expect(draw(ASKED, QUESTION).querySelector('[data-detailed-rail]')).toBeNull()
  })
  it('DT5 saidOnceOf puts a shared line on the aim\'s card when the aim is on the board. CONTRAST: an aim id no card carries says it on the question', () => {
    const s = saidOnceOf(ASKED.model!)
    expect([s.question.length, [...s.aims.keys()].sort()]).toEqual([0, ['sell_360', 'within_budget']])
    const gone = { ...ASKED.model!, cards: ASKED.model!.cards.filter((c) => c.id !== 'sell_360') }
    expect(saidOnceOf(gone).question.map((x) => x.text)).toEqual([noChanceLineOf(optionsOf(ASKED)[0]!.headline!).line])
  })
})

describe('Detailed: marks, not sentences', () => {
  it('DT6 whose a card is, is a mark with core\'s author words as its name; the words are not drawn. CONTRAST: Olumi\'s card carries Olumi\'s mark', () => {
    const mine = cardOf(HIRING, 'weekly_churn'), olumi = cardOf(HIRING, 'team_delivery_throughput_change')
    const face = faceOf(draw(HIRING, mine.id), mine.id)
    const mark = face.querySelector<HTMLElement>(`[data-core-author="${mine.id}"] [data-author-mark]`)!
    expect([mark.getAttribute('data-author-mark'), mark.getAttribute('aria-label')?.startsWith(mine.author!.text)]).toEqual(['person', true])
    expect(drawn(face)).not.toContain(mine.author!.text)
    cleanup()
    const o = faceOf(draw(HIRING, olumi.id), olumi.id)
    expect(o.querySelector(`[data-core-author="${olumi.id}"] [data-author-mark]`)?.getAttribute('data-author-mark')).toBe('olumi')
    expect(drawn(o), 'not on the face (the closed working lists each step\'s author inside it)').not.toContain(olumi.author!.text)
  })
  it('DT7 what core folded behind a card is a count of its records, core\'s words on hover. CONTRAST: a card with no badge draws no count', () => {
    const c = cardOf(HIRING, 'team_delivery_throughput_change')
    const b = faceOf(draw(HIRING, c.id), c.id).querySelector<HTMLElement>(`[data-core-badge="${c.id}"]`)!
    expect([b.getAttribute('data-badge-count'), b.textContent, b.title.includes(c.badge!.title.split('\n')[0]!)]).toEqual([String(c.badge!.records.length), String(c.badge!.records.length), true])
    cleanup()
    expect(faceOf(draw(HIRING, 'weekly_churn'), 'weekly_churn').querySelector('[data-core-badge]')).toBeNull()
  })
  it('DT8 a range bar only where the range has a spread. CONTRAST: the same card with a single value draws none', () => {
    const c = cardOf(HIRING, 'weekly_churn')
    const spread = withCard(HIRING, { ...c, figure: { ...c.figure!, range: { low: 8, likely: 12, high: 16, unit: 'ticket/week' } } } as ViewCard)
    expect(faceOf(draw(spread, c.id), c.id).querySelector('[data-testid="range-bar"]')).not.toBeNull()
    cleanup()
    const single = withCard(HIRING, { ...c, figure: { ...c.figure!, range: { low: 12, likely: 12, high: 12, unit: 'ticket/week' } } } as ViewCard)
    expect(faceOf(draw(single, c.id), c.id).querySelector('[data-testid="range-bar"]')).toBeNull()
  })
  it('DT9 a long sentence on a row is one press away, whole, never drawn on the face. CONTRAST: a short state is drawn as it is', () => {
    const opt = cardOf(HOSTING, 'own_hosting'), long = (opt.rows[1] as { text: string }).text
    expect([long.length > ROW_WORDS_MAX, opt.rows[1]!.aim_id]).toEqual([true, 'protect_delivery_quality'])
    const aim = faceOf(draw(HOSTING, 'protect_delivery_quality'), 'protect_delivery_quality')
    const at = aim.querySelector<HTMLElement>('[data-row-words="own_hosting.rows.1"]')!
    expect([at.hasAttribute('data-row-words-long'), at.querySelector('button')?.getAttribute('aria-label'), aim.textContent?.includes(long)]).toEqual([true, long, false])
    cleanup()
    const short = 'An invented short state.'
    const v = withCard(HOSTING, { ...opt, rows: opt.rows.map((r, i) => (i === 1 ? { ...r, text: short } : r)) } as ViewCard)
    const s = faceOf(draw(v, 'protect_delivery_quality'), 'protect_delivery_quality').querySelector<HTMLElement>('[data-row-words="own_hosting.rows.1"]')!
    expect([s.hasAttribute('data-row-words-long'), s.textContent]).toEqual([false, short])
  })
})
