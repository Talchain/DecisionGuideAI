/**
 * The reply lead's actions (core `lead.actions`, harness slice 3): at most three short lines under the opening, in core's order and words. A line about
 * a record or finding is a press that reaches that card by the chat's one existing mechanism (`pressCard`); a line about the world has Olumi's general
 * suggestion mark and no link; the basis is the one Tip. Absent or empty: nothing is drawn. Draw order: opening, points, actions, "Full answer" (Paul's reply shape; DL ruling after Codex, 20 Nov).
 * Real mounted ViewChat on a golden reply with `lead.actions` added in memory; every word is invented.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, fireEvent, render } from '@testing-library/react'
vi.mock('../../../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: {} }))
vi.mock('../../../reasoning/tabRing', async (orig) => ({ ...(await orig<typeof import('../../../reasoning/tabRing')>()), pressCard: vi.fn() }))
import { setPagePerson } from '../../../../olumiCore/team/api'
import { useMe } from '../../../../olumiCore/me'
import type { View, ViewTurn } from '../../../client'
import { useViewStore } from '../../../store'
import { useUIStore } from '../../../../stores/uiStore'
import { ViewChat, useViewChat } from '../../../ViewChat'
import { leadOf } from '../../../early'
import { pressCard } from '../../../reasoning/tabRing'
import { tipOf } from '../../../__tests__/tipHelpers'

const golden = (n: string): View => JSON.parse(readFileSync(path.resolve('src/olumiView/golden', `${n}.view.json`), 'utf8'))
type Answer = NonNullable<ViewTurn['answer']>
const withTurn = (v: View, i: number, a: Partial<Answer>): View =>
  ({ ...v, chat: v.chat.map((t, j) => (j === i && t.answer !== null ? { ...t, answer: { ...t.answer, ...a } } : t)) })
const show = (view: View) => {
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: view.id, view, status: 'ready', error: null, stale: false, at: null })
  return render(<ViewChat />).container
}
const q = (c: ParentNode, id: string) => c.querySelector<HTMLElement>(`[data-testid="${id}"]`)
const before = (a: Element, b: Element) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0

const FULL = 'A later reply in two paragraphs.\n\nIts second paragraph.'
const LEAD = { opening: 'Sunday opening pays only if about thirty more covers come in. Nobody has counted them yet.', points: ['Count turned-away walkers for four Sundays.', 'Ask the two staff which day suits them.'] }
const AT = 'chat.0.answer.lead.actions'

let base: View, card: string
beforeEach(() => {
  base = golden('proposal')
  card = base.model!.cards[0]!.id
  useUIStore.setState({ activeOutputTab: 'olumi' } as never)
  setPagePerson(null); useMe.setState({ me: { id: '7', name: 'Ada' } } as never)
  vi.mocked(pressCard).mockClear()
})
afterEach(() => {
  cleanup(); setPagePerson(null); useMe.setState({ me: null } as never)
  useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none', error: null, stale: false, at: null })
  useViewChat.setState({ text: '', ops: new Map(), busy: false, said: null, held: null, gone: null })
})
const turn = (actions: unknown, lead: Record<string, unknown> = LEAD) => show(withTurn(base, 0, { answer: [{ text: FULL }], lead: { ...lead, ...(actions === undefined ? {} : { actions }) } } as Partial<Answer>)).querySelector<HTMLElement>('[data-view-turn="chat.0"]')!
const act = (text: string, on: unknown, basis = 'Because it was said.') => ({ text, on, basis })

describe('K1 lead.not_held (core c918fe31)', () => {
  const NH = 'Not in your model: 210 pupils, 120 seats.'
  it('one quiet line in core\'s words, after the actions and before the closed "Full answer", never among the points', () => {
    const t = turn([act('Count the walkers.', { record: card })], { ...LEAD, not_held: NH })
    const line = q(t, 'view-lead-not-held')!
    expect([line.textContent, line.classList.contains('text-text-light'), t.querySelectorAll('[data-testid="view-lead-not-held"]').length]).toEqual([NH, true, 1])
    expect([before(q(t, 'view-reply-lead-actions')!, line), before(line, q(t, 'view-reply-full')!), q(t, 'view-reply-lead-points')?.textContent?.includes(NH) ?? false]).toEqual([true, true, false])
  })
  it('a lead that is not drawn (it says the whole answer) still says it, once, under the answer; CONTRAST: absent or empty, nothing', () => {
    const same = show(withTurn(base, 0, { answer: [{ text: LEAD.opening as string }, ...((LEAD.points as string[]).map((p) => ({ text: p })))], lead: { ...LEAD, not_held: NH } } as Partial<Answer>))
    expect([...same.querySelectorAll('[data-testid="view-lead-not-held"]')].map((e) => e.textContent)).toEqual([NH])
    cleanup()
    for (const nh of [undefined, '', '  ']) { const t = turn(undefined, { ...LEAD, ...(nh === undefined ? {} : { not_held: nh }) }); expect(q(t, 'view-lead-not-held')).toBeNull(); cleanup() }
  })
})

describe('a reply lead\'s actions', () => {
  it('draws the opening, then the points, then the actions, then the closed "Full answer"; each action is one line bound by its data-view path, in core\'s words', () => {
    const t = turn([act('Count the walkers.', { record: card }), act('Ask the staff.', { world: true })])
    const order = [t.querySelector('[data-reply-opening]')!, t.querySelector('[data-testid="view-reply-lead-points"]')!, q(t, 'view-reply-lead-actions')!, q(t, 'view-reply-full')!]
    for (let k = 0; k + 1 < order.length; k++) expect(before(order[k]!, order[k + 1]!), `order ${k}`).toBe(true)
    expect([0, 1].map((i) => t.querySelector(`[data-view="${AT}.${i}.text"]`)?.textContent)).toEqual(['Count the walkers.', 'Ask the staff.'])
    expect(q(t, 'view-reply-lead-actions')!.closest('details'), 'at rest, outside the fold').toBeNull()
    expect(t.querySelector('[data-view="chat.0.answer.lead.opening"]')?.textContent).toBe(LEAD.opening)
    expect(t.querySelector('[data-view="chat.0.answer.lead.points.1"]')?.textContent).toBe(LEAD.points[1])
  })

  it('draws at most three, in core\'s order', () => {
    const t = turn([1, 2, 3, 4, 5].map((n) => act(`Step ${n}.`, { record: card })))
    expect([0, 1, 2, 3].map((i) => t.querySelector(`[data-view="${AT}.${i}.text"]`)?.textContent ?? null)).toEqual(['Step 1.', 'Step 2.', 'Step 3.', null])
  })

  it('drops a malformed item: an `on` that is none of the three shapes, two shapes at once, a world that is not true, missing words or basis; the well-formed rest stay in order', () => {
    const t = turn([
      act('No shape.', {}), act('Two shapes.', { record: card, world: true }), act('World is false.', { world: false }), act('Empty record.', { record: '' }),
      { text: 'No basis.', on: { world: true } }, { on: { world: true }, basis: 'x' }, act('', { world: true }), 'text', null,
      act('Good one.', { finding: card }), act('Good two.', { world: true }),
    ])
    expect([0, 1, 2].map((i) => t.querySelector(`[data-view="${AT}.${i}.text"]`)?.textContent ?? null)).toEqual(['Good one.', 'Good two.', null])
    expect(leadOf({ lead: { ...LEAD, actions: [act('Only.', { world: true })] } }, FULL)?.actions).toEqual([act('Only.', { world: true })])
  })

  it('a record action selects its card by the chat\'s one existing mechanism (pressCard); a finding action reaches the card it rests on the same way. CONTRAST: a world action has no link', () => {
    const t = turn([act('Count the walkers.', { record: card }), act('Read the finding.', { finding: card }), act('Ask the staff.', { world: true })])
    const lines = [...t.querySelectorAll<HTMLElement>('[data-lead-action]')]
    expect(lines.map((l) => l.getAttribute('data-lead-action'))).toEqual(['card', 'card', 'world'])
    const buttons = [...t.querySelectorAll<HTMLButtonElement>('[data-lead-action-card]')]
    expect(buttons.map((b) => b.tagName)).toEqual(['BUTTON', 'BUTTON'])
    fireEvent.click(buttons[0]!)
    expect(vi.mocked(pressCard).mock.calls).toEqual([[card]])
    fireEvent.click(buttons[1]!)
    expect(vi.mocked(pressCard).mock.calls).toEqual([[card], [card]])
    expect([lines[2]!.querySelector('button, a'), lines[2]!.querySelector('[data-lead-action-card]')]).toEqual([null, null])
    fireEvent.click(lines[2]!.querySelector('[data-view]')!)
    expect(vi.mocked(pressCard)).toHaveBeenCalledTimes(2)
  })

  it('a finding action whose id matches no card is plain words with the basis Tip, never a link to another finding\'s figure. CONTRAST: one that matches a card is a button', async () => {
    const t = turn([act('Read the finding.', { finding: 'no-such-card' }, 'It rests on nothing drawn.'), act('Read the other.', { finding: card })])
    const [lost, found] = [...t.querySelectorAll<HTMLElement>('[data-lead-action]')]
    expect([lost!.getAttribute('data-lead-action'), lost!.querySelector('[data-lead-action-card]'), lost!.querySelector('button')]).toEqual(['plain', null, null])
    expect(await tipOf(lost!.querySelector<HTMLElement>('[data-view]')!)).toBe('It rests on nothing drawn.')
    expect(found!.getAttribute('data-lead-action')).toBe('card')
    fireEvent.click(lost!.querySelector('[data-view]')!)
    expect(vi.mocked(pressCard)).not.toHaveBeenCalled()
  })

  // CHANGED BY DESIGN (DL 20 Nov, slice-3 proof at 1232): the world action's basis is read at rest, a quiet line under its words, so the mark beside it is decorative.
  it('a world action carries Olumi\'s mark and core\'s basis as a quiet line at rest; a linked one keeps its basis in the Tip', () => {
    // Core's own basis (slice 3 on trial28: "Olumi's general suggestion, not from this model."), never the UI's.
    const BASIS = 'Olumi’s general suggestion, not from this model.'
    const t = turn([act('Count the walkers.', { record: card }), act('Ask the staff.', { world: true }, BASIS)])
    const [linked, world] = [...t.querySelectorAll<HTMLElement>('[data-lead-action]')]
    const line = world!.querySelector<HTMLElement>('[data-view$=".basis"]')
    expect([line?.textContent, line?.classList.contains('text-text-light'), world!.querySelector('svg') !== null]).toEqual([BASIS, true, true])
    expect(linked!.querySelector('[data-view$=".basis"]')).toBeNull()
  })

  it('a card action starts with a decorative workspace icon and underlines its button only on hover or keyboard focus', () => {
    const t = turn([act('Count the walkers.', { record: card })])
    const line = t.querySelector('[data-lead-action="card"]')!
    const mark = line.firstElementChild!
    expect(mark).toHaveAttribute('aria-hidden', 'true')
    expect(mark.querySelector('svg.lucide-locate-fixed')).toBeInTheDocument()
    expect(mark.nextElementSibling).toHaveClass('ok-lead-action-link')
    const css = readFileSync(path.resolve('src/olumiView/look/olumiLook.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
    const resting = css.match(/\.ok-lead-action-link\s*\{([^}]+)\}/)![1]
    expect(resting).not.toMatch(/text-decoration(?:-line)?\s*:[^;]*\bunderline\b/)
    expect(css).toMatch(/\.ok-lead-action-link:hover,\s*\.ok-lead-action-link:focus-visible\s*\{[^}]*text-decoration:\s*underline\b/)
  })

  it('a linked line\'s basis is the one Tip on its words; a world line\'s is said once, at rest; never a native title', async () => {
    const t = turn([act('Count the walkers.', { record: card }, 'It rests on the walker count.'), act('Ask the staff.', { world: true }, 'General practice, not from the model.')])
    const [linked, world] = [...t.querySelectorAll<HTMLElement>('[data-lead-action]')]
    expect(await tipOf(linked!.querySelector<HTMLElement>('[data-lead-action-card]')!)).toBe('It rests on the walker count.')
    expect(world!.textContent!.split('General practice, not from the model.').length - 1, 'said once').toBe(1)
    expect(t.querySelectorAll('[data-lead-action] [title], [data-lead-action][title]')).toHaveLength(0)
  })

  it('nothing is drawn for actions when absent or empty, and the reply is as before (points, opening, closed fold)', () => {
    for (const actions of [undefined, [], 'nope', [act('Bad.', {})]]) {
      const t = turn(actions)
      expect([q(t, 'view-reply-lead-actions'), t.querySelector('[data-lead-action]'), t.querySelector('[data-view*="lead.actions"]')], String(JSON.stringify(actions))).toEqual([null, null, null])
      expect([q(t, 'view-reply-lead-points') !== null, t.querySelector('[data-reply-opening]')?.textContent, q(t, 'view-reply-full') !== null]).toEqual([true, LEAD.opening, true])
      expect(leadOf({ lead: { ...LEAD, ...(actions === undefined ? {} : { actions }) } }, FULL)).toEqual(LEAD)
      cleanup()
    }
  })
})
