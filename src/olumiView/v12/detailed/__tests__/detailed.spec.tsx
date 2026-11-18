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
import { figureRange } from '../../contract'
import { saidOnceOf, sharedNoChance, sharedRowStates } from '../said'

const load = (f: string) => JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures', f), 'utf8')) as View
const ASKED = load('core-38eebca9/bakery-asked.view3.json'), HIRING = load('real/hiring-unchecked-first.view3.json'), HOSTING = load('real/hosting.view3.json')
const APP = load('core-38eebca9/app-launch.view3.json')
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
  it('DT1 every option\'s no-chance line alike: said once on the aim it is about; each option draws no empty track and no line. CONTRAST: one option\'s own step differs, so every option says its own line and the aim says none', () => {
    const opts = optionsOf(ASKED), line = noChanceLineOf(opts[0]!.headline!).line, aim = opts[0]!.headline!.aim_id!
    expect(opts.length, 'precondition: three options').toBe(3)
    expect(sharedNoChance(ASKED.model!)).toMatchObject({ text: line, at: aim })
    for (const o of opts) {
      const face = faceOf(draw(ASKED, o.id), o.id)
      expect([o.id, face.querySelector('[data-ok-face="none"]')?.hasAttribute('data-said-once'), face.querySelector(`[data-view="${o.id}.headline.add"]`), face.textContent?.includes(line)]).toEqual([o.id, true, null, false])
      expect(face.querySelector('[data-withheld-track], .ok-dt-mini-empty, .ok-dt-gauge-empty'), 'no empty track at rest (Paul, 16 Nov)').toBeNull()
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
    cleanup()
    expect(faceOf(draw(differs, opts[1]!.id), opts[1]!.id).querySelector('[data-withheld-track], .ok-dt-mini-empty'), 'the option with its own words draws them and no track').toBeNull()
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
  it('DT14 the rail keeps each row\'s own condition, whole, beside its number; nothing is said once unless every row carries the same one. CONTRASTS: one shared condition is drawn once under the rail and the rows keep the number alone; two rows that share one and a third with none keep their own', () => {
    const [A, B, C] = ['hire_a_tech_lead', 'hire_two_developers', 'reallocate_a_developer_day_each_week_to_technical_leadership'] as const
    const saying = (texts: Readonly<Record<string, string>>): View => Object.entries(texts).reduce((v, [id, text]) => withCard(v, { ...cardOf(v, id), headline: { ...cardOf(v, id).headline!, text } } as ViewCard), HIRING)
    const railOf = (v: View) => {
      const rail = draw(v, QUESTION).querySelector<HTMLElement>('[data-detailed-rail]')!
      return { rows: [...rail.querySelectorAll<HTMLElement>('[data-rail-row]')].map((r) => [r.getAttribute('data-rail-row'), r.querySelector('.ok-dt-rail-val')?.textContent, r.querySelector('[data-rail-qualifier]')?.textContent ?? null]),
        once: [...rail.querySelectorAll('[data-shared-qualifier]')].map((e) => e.textContent) }
    }
    const differ = saying({ [A]: '60% chance, if capacity is available', [B]: '30% chance, if a partner helps' })
    expect(railOf(differ)).toEqual({ rows: [[A, '60% chance, if capacity is available', ', if capacity is available'], [B, '30% chance, if a partner helps', ', if a partner helps'], [C, 'about 4% chance', null]], once: [] })
    cleanup()
    // Each option's own card keeps its condition too (the board says nothing once).
    expect(faceOf(draw(differ, B), B).querySelector(`[data-view="${B}.headline.qualifier"]`)?.textContent).toBe('if a partner helps')
    cleanup()
    const sole = saying({ [A]: '60% chance, if capacity is available' })
    expect(railOf(sole)).toEqual({ rows: [[A, '60% chance, if capacity is available', ', if capacity is available'], [B, 'about 9% chance', null], [C, 'about 4% chance', null]], once: [] })
    cleanup()
    const twoOfThree = saying({ [A]: '60% chance, if capacity is available', [B]: '30% chance, if capacity is available' })
    expect(railOf(twoOfThree)).toEqual({ rows: [[A, '60% chance, if capacity is available', ', if capacity is available'], [B, '30% chance, if capacity is available', ', if capacity is available'], [C, 'about 4% chance', null]], once: [] })
    cleanup()
    const shared = saying({ [A]: '60% chance, if capacity is available', [B]: '30% chance, if capacity is available', [C]: '10% chance, if capacity is available' })
    expect(railOf(shared)).toEqual({ rows: [[A, '60% chance', null], [B, '30% chance', null], [C, '10% chance', null]], once: ['if capacity is available'] })
    cleanup()
    expect(faceOf(draw(shared, B), B).querySelector(`[data-view="${B}.headline.qualifier"]`), 'said once on the rail, so not again on the card').toBeNull()
  })
  it('DT15 the same short status over DIFFERENT reasons is not said once: each option keeps its own line with its own hover, and the aim says none. CONTRAST: the same board with one reason on every option says it once, with that reason the hover, and the options say nothing', () => {
    const [A, B, C] = ['second_oven', 'longer_hours', 'carry_on'] as const, AIM = 'sell_360'
    const waiting = (why: Readonly<Record<string, string>>): View => Object.entries(why).reduce((v, [id, w]) => withCard(v, { ...cardOf(v, id), headline: { ...cardOf(v, id).headline!, text: 'No chance yet', title: '', add: null, why: w } } as ViewCard), ASKED)
    const ownLine = (v: View, id: string) => { const face = faceOf(draw(v, id), id).querySelector<HTMLElement>('[data-ok-face="none"]')!, p = face.querySelector<HTMLElement>(`[data-view="${id}.headline.text"]`); const out = [id, face.hasAttribute('data-said-once'), p?.textContent ?? null, p?.getAttribute('title') ?? null]; cleanup(); return out }
    const aimSays = (v: View) => { const said = [...faceOf(draw(v, AIM), AIM).querySelectorAll<HTMLElement>(`[data-said-once-on="${AIM}"] .ok-dt-said-line`)].map((l) => [l.textContent, l.getAttribute('title')]); cleanup(); return said }
    const differ = waiting({ [A]: 'The oven price is missing.', [B]: 'The staff cost is missing.', [C]: 'The oven price is missing.' })
    expect([A, B, C].map((id) => ownLine(differ, id))).toEqual([
      [A, false, 'No chance yet', 'The oven price is missing.'],
      [B, false, 'No chance yet', 'The staff cost is missing.'],
      [C, false, 'No chance yet', 'The oven price is missing.'],
    ])
    expect(aimSays(differ), 'no line stands for options whose reasons differ').toEqual([])
    const alike = waiting({ [A]: 'The oven price is missing.', [B]: 'The oven price is missing.', [C]: 'The oven price is missing.' })
    expect(aimSays(alike)).toEqual([['No chance yet', 'The oven price is missing.']])
    expect([A, B, C].map((id) => ownLine(alike, id))).toEqual([[A, true, null, null], [B, true, null, null], [C, true, null, null]])
  })
  it('DT16 where core marks the no-chance headline shared (every option waits), it is said once on the aim; an option that carries a reason of its own keeps its own line, and the shared line never carries that reason. CONTRAST: the served board, where no option has its own, says it once and every option says nothing', () => {
    const [S, D, I] = ['option_scheduled', 'option_delay', 'option_isolate'] as const, AIM = 'boss_discussion'
    const SHARED = 'Cannot be worked out yet: Explain the release decision without unfair team blame'
    expect([APP.model!.run!.all_withheld, ...[S, D, I].map((id) => { const h = cardOf(APP, id).headline!; return [h.state, h.shared, h.text, h.title, h.why, h.add, h.aim_id].join('|') })], 'precondition: core\'s shared form')
      .toEqual([true, ...[S, D, I].map(() => `none|true|No chance yet|${SHARED}|||${AIM}`)])
    const aimSays = (v: View) => { const said = [...faceOf(draw(v, AIM), AIM).querySelectorAll<HTMLElement>(`[data-said-once-on="${AIM}"] .ok-dt-said-line`)].map((l) => [l.textContent, l.getAttribute('title')]); cleanup(); return said }
    const ownLine = (v: View, id: string) => { const face = faceOf(draw(v, id), id).querySelector<HTMLElement>('[data-ok-face="none"]')!, p = face.querySelector<HTMLElement>(`[data-view="${id}.headline.text"]`); const out = [id, face.hasAttribute('data-said-once'), p?.textContent ?? null, p?.getAttribute('title') ?? null]; cleanup(); return out }
    expect(aimSays(APP)).toEqual([['No chance yet', SHARED]])
    expect([S, D, I].map((id) => ownLine(APP, id))).toEqual([[S, true, null, null], [D, true, null, null], [I, true, null, null]])
    // The FIRST option carries its own reason: the shared line must not take it as the hover for the other two.
    const own = withCard(APP, { ...cardOf(APP, S), headline: { ...cardOf(APP, S).headline!, why: 'Only this option: its release date is not set.' } } as ViewCard)
    expect(aimSays(own)).toEqual([['No chance yet', SHARED]])
    expect([S, D, I].map((id) => ownLine(own, id))).toEqual([[S, false, 'No chance yet', 'Only this option: its release date is not set.'], [D, true, null, null], [I, true, null, null]])
    // CONTRAST: the same edit where core does not say every option waits: nothing is said once, every option keeps its own line and hover.
    const notAll = { ...own, model: { ...own.model!, run: { ...own.model!.run!, all_withheld: false } } } as View
    expect(aimSays(notAll)).toEqual([])
    expect([S, D, I].map((id) => ownLine(notAll, id))).toEqual([[S, false, 'No chance yet', 'Only this option: its release date is not set.'], [D, false, 'No chance yet', SHARED], [I, false, 'No chance yet', SHARED]])
  })
  it('DT17 a limit\'s state is said once only where every option\'s words AND title AND question AND Olumi mark are equal: one option with its own question means each option is listed by its letter with its own hover. CONTRASTS: all equal is said once with the shared title and question the hover; one row with Olumi\'s mark is not shared; the same mark on every row is shared and drawn', () => {
    const [A, B, C] = ['second_oven', 'longer_hours', 'carry_on'] as const, AIM = 'within_budget'
    type Over = { question: string; olumi?: { glyph: string; title: string } | null }
    const asking = (over: Readonly<Record<string, Over>>): View => Object.entries(over).reduce((v, [id, o]) => withCard(v, { ...cardOf(v, id), rows: cardOf(v, id).rows.map((r, i) => (i === 1 ? { ...r, state_text: 'Needs an answer', title: 'The budget cannot be checked yet.', olumi: null, ...o } : r)) } as ViewCard), ASKED)
    expect([A, B, C].map((id) => [cardOf(ASKED, id).heading, cardOf(ASKED, id).rows[1]!.aim_id, cardOf(ASKED, id).rows[1]!.kind])).toEqual([['A second oven', AIM, 'none'], ['Open two hours longer', AIM, 'none'], ['Carry on as now', AIM, 'none']])
    const limit = (v: View) => {
      const face = faceOf(draw(v, AIM), AIM)
      const out = { once: [...face.querySelectorAll<HTMLElement>(`[data-said-once-on="${AIM}"] .ok-dt-said-line`)].map((l) => [l.textContent, l.getAttribute('title'), l.querySelector('[data-said-olumi] [data-olumi-mark]')?.getAttribute('aria-label') ?? null]),
        rows: [...face.querySelectorAll<HTMLElement>('[data-aim-result]')].map((r) => [r.getAttribute('data-aim-result'), r.querySelector('[data-letter-chip]')?.textContent, r.querySelector('[data-row-words]')?.textContent, r.getAttribute('title'), r.querySelector('[data-olumi-mark]')?.getAttribute('aria-label') ?? null]) }
      cleanup(); return out
    }
    const OVEN = 'What would the second oven cost?', STAFF = 'What would two more hours of staff cost?', T = 'The budget cannot be checked yet.'
    expect(limit(asking({ [A]: { question: OVEN }, [B]: { question: STAFF }, [C]: { question: OVEN } }))).toEqual({ once: [], rows: [
      [A, 'A', 'Needs an answer', `A second oven\nNeeds an answer\n${T}\n${OVEN}`, null],
      [B, 'B', 'Needs an answer', `Open two hours longer\nNeeds an answer\n${T}\n${STAFF}`, null],
      [C, 'C', 'Needs an answer', `Carry on as now\nNeeds an answer\n${T}\n${OVEN}`, null],
    ] })
    expect(limit(asking({ [A]: { question: OVEN }, [B]: { question: OVEN }, [C]: { question: OVEN } }))).toEqual({ once: [['Needs an answer', `${T}\n${OVEN}`, null]], rows: [] })
    const MARK = { glyph: '*', title: 'Rests on a figure Olumi estimated' }
    expect(limit(asking({ [A]: { question: OVEN }, [B]: { question: OVEN, olumi: MARK }, [C]: { question: OVEN } }))).toEqual({ once: [], rows: [
      [A, 'A', 'Needs an answer', `A second oven\nNeeds an answer\n${T}\n${OVEN}`, null],
      [B, 'B', 'Needs an answer', `Open two hours longer\nNeeds an answer\n${T}\n${OVEN}`, 'Rests on a figure Olumi estimated'],
      [C, 'C', 'Needs an answer', `Carry on as now\nNeeds an answer\n${T}\n${OVEN}`, null],
    ] })
    expect(limit(asking({ [A]: { question: OVEN, olumi: MARK }, [B]: { question: OVEN, olumi: MARK }, [C]: { question: OVEN, olumi: MARK } }))).toEqual({ once: [['Needs an answer', `${T}\n${OVEN}`, 'Rests on a figure Olumi estimated']], rows: [] })
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
  it('DT10 a title is never clamped or cut on Detailed (Paul, 16 Nov): core\'s heading whole as its hover, no press to show it, no clamp rule on the title. CONTRAST: Simple\'s compact card keeps its own two-line rule in the same stylesheet', () => {
    const o = optionsOf(HIRING)[0]!, long = `${o.heading} ${'and the long rest of its name '.repeat(8)}`.trim()
    for (const heading of [o.heading, long]) {
      const el = draw(withCard(HIRING, { ...o, heading } as ViewCard), o.id)
      const title = el.querySelector<HTMLElement>('[data-testid="node-title"]')!
      expect([title.getAttribute('title') === heading && (title.textContent ?? '') !== '', title.className.includes('line-clamp'), el.querySelector('[data-whole-title], [data-whole-title-words]')]).toEqual([true, false, null])
      cleanup()
    }
    const css = readFileSync(path.resolve('src/olumiView/look/olumiLook.css'), 'utf8')
    const clampOn = (sel: string) => css.split('}').filter((r) => r.includes(sel) && r.includes('node-title') && r.includes('-webkit-line-clamp: ') && !r.includes('line-clamp: unset')).length
    expect([clampOn('[data-ok-detailed]'), clampOn('[data-simple-compact]')]).toEqual([0, 1])
  })
  it('DT11 a figure with one stated value and no range draws no range bar on Detailed (no empty 0-to-x bar). CONTRAST: the same card with a range that has a spread draws one', () => {
    const c = cardOf(HIRING, 'weekly_churn')
    const none = withCard(HIRING, { ...c, figure: { ...c.figure!, range: null } } as ViewCard)
    expect([faceOf(draw(none, c.id), c.id).querySelector('[data-testid="range-bar"]'), figureRange(none.model!.cards.find((x) => x.id === c.id)!)]).toEqual([null, null])
    cleanup()
    const ranged = withCard(HIRING, { ...c, figure: { ...c.figure!, range: { low: 8, likely: 12, high: 16, unit: 'ticket/week' } } } as ViewCard)
    expect(faceOf(draw(ranged, c.id), c.id).querySelector('[data-testid="range-bar"]')).not.toBeNull()
  })
  it('DT12 the marks are drawn through the icon registry: "not used in the analysis" is the registry\'s own glyph, never the remove-link one. CONTRAST: a card with no unused words draws neither', () => {
    const view = [HIRING, ASKED, HOSTING].find((v) => v.model!.cards.some((c) => c.unused != null && c.unused !== ''))!
    const c = view.model!.cards.find((x) => x.unused != null && x.unused !== '')!
    const el = faceOf(draw(view, c.id), c.id)
    const mark = el.querySelector<HTMLElement>(`[data-view="${c.id}.unused"] [role="img"]`)!
    expect([mark.getAttribute('aria-label'), mark.querySelector('svg')?.getAttribute('class')?.includes('lucide-unplug'), el.querySelector('svg.lucide-unlink')]).toEqual([c.unused, true, null])
    cleanup()
    const none = withCard(view, { ...c, unused: null } as ViewCard)
    expect([faceOf(draw(none, c.id), c.id).querySelector(`[data-view="${c.id}.unused"]`), document.querySelector('svg.lucide-unlink')]).toEqual([null, null])
  })
  it('DT13 an option core has ruled out says core\'s status word once on Detailed, bound to its status, and is marked for the light-title rule. CONTRAST: the same option while live draws neither', () => {
    const live = optionsOf(HIRING)[0]!
    expect(live.status, 'precondition: live').toBeNull()
    const out = faceOf(draw(withCard(HIRING, { ...live, status: 'ruled out' } as ViewCard), live.id), live.id)
    expect([[...out.querySelectorAll(`[data-view="${live.id}.status"]`)].map((e) => e.textContent), out.hasAttribute('data-detailed-set-aside')]).toEqual([[ 'ruled out' ], true])
    cleanup()
    const on = faceOf(draw(HIRING, live.id), live.id)
    expect([on.querySelector(`[data-view="${live.id}.status"]`), on.hasAttribute('data-detailed-set-aside')]).toEqual([null, false])
    const css = readFileSync(path.resolve('src/olumiView/look/olumiLook.css'), 'utf8')
    expect(css.split('}').filter((r) => r.includes('[data-detailed-set-aside]') && r.includes('[data-simple-set-aside]') && r.includes('node-title')).length, 'one title rule serves both faces').toBe(1)
  })
})
