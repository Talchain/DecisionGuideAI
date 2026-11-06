/**
 * The sixth lane lens, "If it failed" (backlog: CAPABILITY-INVENTORY-20261106 §5 item 4). Olumi's failure stories (core's `cards[].failed`, the
 * story in `title`, `failed_reason` for the one most within the team's control) pinned to the cards they rest on, behind "Write mine first":
 * the person's own reasons first, then Olumi's. Every story word is core's; bound by story number and exact words, not by a count.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, renderHook, screen, fireEvent } from '@testing-library/react'
vi.mock('../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: {} }))
import proposal from '../golden/proposal.view.json'
import { ViewPreMortemKey } from '../ViewPreMortemKey'
import { useViewChat } from '../ViewChat'
import { V10_WRITE_MINE_COPY } from '../../presentation/V10WriteMineFirst'
import { useViewStore } from '../store'
import { useViewLens, usePreMortemOf, VIEW_LENSES, WRITE_MINE_DRAFT } from '../lens'
import { PREMORTEM_COPY } from '../ViewPreMortemKey'
import type { View, ViewCard } from '../client'

const base = proposal as unknown as View
const OLUMI = { glyph: '◆', title: 'Olumi proposed this; check it' }
const S1 = 'The new specialist could take longer to reach full speed than the model allows.'
const S2 = 'The backlog could grow faster than one more person can clear.'
const CONTROL = 'most within your control'
const failedOn: Record<string, Partial<ViewCard>> = {
  per_specialist: { failed: [{ n: 1, title: S1, olumi: OLUMI }] },
  start_delay: { failed: [{ n: 1, title: S1, olumi: OLUMI }, { n: 2, title: S2, olumi: OLUMI }] },
  add_one: { failed: [{ n: 1, title: S1, olumi: OLUMI }], failed_reason: { text: CONTROL, title: S1, olumi: OLUMI } },
}
const MINE = 'My reasons it failed: the hire never ramps up.'
const withStories = (stories = true, mine = false): View => ({
  ...base,
  model: { ...base.model!, cards: base.model!.cards.map((c) => ({ ...c, ...(stories ? failedOn[c.id] : {}) }) as ViewCard) },
  chat: mine ? [...base.chat, { ...base.chat[0]!, id: 99, by: base.you, said: MINE, answer: null }] : base.chat,
})
const show = (v: View) => { useViewStore.setState({ view: v }); useViewLens.setState({ lens: 'premortem' }); useViewChat.setState({ text: '' }); return render(<ViewPreMortemKey />) }
afterEach(() => { cleanup(); useViewStore.setState({ view: null }); useViewLens.setState({ lens: 'full' }); useViewChat.setState({ text: '' }) })

describe('the "If it failed" lens on the lane', () => {
  it('is the sixth lens, in the legacy bar\'s order', () => {
    expect(VIEW_LENSES).toEqual(['full', 'tradeoffs', 'rests_on', 'premortem', 'what_changes', 'what_if'])
  })

  it('says v10\'s own words for Write mine first', () => {
    expect([WRITE_MINE_DRAFT, PREMORTEM_COPY.label]).toEqual([V10_WRITE_MINE_COPY.draft, V10_WRITE_MINE_COPY.label])
  })

  it('Write mine first: before the person\'s own reasons, none of Olumi\'s story words is on the screen', () => {
    const c = show(withStories()).container
    expect(screen.getByTestId('view-premortem-write-mine').textContent).toBe('Write mine first')
    expect(screen.queryByTestId('view-premortem-stories')).toBeNull()
    expect(c.textContent).not.toContain(S1)
    expect(c.textContent).not.toContain(S2)
  })

  it('the press puts the opening of their own sentence in the message box, sends nothing, and never erases what they typed', () => {
    show(withStories())
    fireEvent.click(screen.getByTestId('view-premortem-write-mine'))
    expect(useViewChat.getState().text).toBe('My reasons it failed: ')
    fireEvent.click(screen.getByTestId('view-premortem-write-mine'))
    expect(useViewChat.getState().text).toBe('My reasons it failed: ')
    cleanup(); useViewChat.setState({ text: 'a half-written thought' })
    render(<ViewPreMortemKey />)
    fireEvent.click(screen.getByTestId('view-premortem-write-mine'))
    expect(useViewChat.getState().text).toBe('My reasons it failed: a half-written thought')
  })

  it('once a turn of theirs opens with those words, Olumi\'s stories show in core\'s numbers and words, marked Olumi\'s, each with the cards it rests on', () => {
    show(withStories(true, true))
    const items = [...screen.getByTestId('view-premortem-stories').querySelectorAll('[data-story]')]
    expect(items.map((li) => li.getAttribute('data-story'))).toEqual(['1', '2'])
    expect(items.map((li) => li.querySelector('[data-testid="view-premortem-story-text"]')?.textContent)).toEqual([S1, S2])
    expect(items.map((li) => li.querySelector('[title]')?.textContent)).toEqual(['◆1 ', '◆2 '])
    expect(items.map((li) => li.querySelector('[data-testid="view-premortem-rests"]')?.textContent)).toEqual([
      'Rests on: per specialist, Add one specialist, start delay',
      'Rests on: start delay',
    ])
    expect(items[0]!.querySelector('[data-testid="view-premortem-control"]')?.textContent).toBe(CONTROL)
    expect(items[1]!.querySelector('[data-testid="view-premortem-control"]')).toBeNull()
  })

  it('someone else\'s turn that opens with those words is not theirs: Olumi\'s stories stay behind Write mine first', () => {
    const v = withStories(true, true)
    show({ ...v, you: 'Someone else' })
    expect(screen.queryByTestId('view-premortem-stories')).toBeNull()
    expect(screen.getByTestId('view-premortem-write-mine')).toBeTruthy()
  })

  it('their reasons written and Olumi has told no stories: core\'s own words say so, and the ask is offered only while core\'s menu offers pre_mortem', () => {
    show(withStories(false, true))
    expect(screen.getByTestId('view-premortem-empty').textContent).toBe('Olumi has not imagined this model failing yet.')
    expect(screen.queryByTestId('view-premortem-ask')).toBeNull()
    cleanup()
    const v = withStories(false, true)
    show({ ...v, session: { ...v.session, methods: [...v.session.methods, { id: 'pre_mortem', text: 'Imagine it failed', first: false }] } })
    expect(screen.getByTestId('view-premortem-ask').textContent).toBe('Ask Olumi to imagine it failed')
  })

  it('cards: the ones the stories rest on stand in front, the rest recede; before their own reasons, or with no story, no card changes', () => {
    const card = (id: string) => renderHook(() => usePreMortemOf(id)).result.current
    useViewLens.setState({ lens: 'premortem' })
    useViewStore.setState({ view: withStories(true, true) })
    expect(['per_specialist', 'add_one', 'start_delay', 'hold', 'capacity_goal'].map(card)).toEqual(['rests', 'rests', 'rests', 'other', 'other'])
    useViewStore.setState({ view: withStories(true, false) })
    expect(card('hold')).toBeNull()
    useViewStore.setState({ view: withStories(false, true) })
    expect(card('hold')).toBeNull()
    useViewStore.setState({ view: withStories(true, true) })
    useViewLens.setState({ lens: 'full' })
    expect(card('hold')).toBeNull()
  })

  it('the key is drawn only while the lens is on', () => {
    show(withStories(true, true)); useViewLens.setState({ lens: 'full' })
    cleanup(); render(<ViewPreMortemKey />)
    expect(screen.queryByTestId('view-premortem-key')).toBeNull()
  })
})
