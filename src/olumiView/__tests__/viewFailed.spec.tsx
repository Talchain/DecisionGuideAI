/**
 * K5 "IF IT FAILED" ON THE CARDS (R3; core wip/k5 8ceb3b872, read through src/olumiView/k5.ts until DGAI vendors it). When the pre_mortem
 * move is taken, every card a failure story rests on carries one badge per story, core's number with Olumi's mark, the story in Olumi's
 * words on hover; an option card carries the story most within the team's control, in core's words. Every word is core's: nothing is
 * written by the UI. A card core sends nothing for (or a core before K5) draws nothing.
 * Fixture: a golden's option and figure cards, with core's K5 fields in core's shape (view.ts: `failed`, `failed_reason`, markFor('record')).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
vi.mock('../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: {} }))
import golden from '../golden/european.view.json'
import capacity from '../golden/proposal.view.json'
import { ViewConversation } from '../ViewChat'
import { useViewStore } from '../store'
import type { View, ViewCard as Card } from '../client'
import { ViewCard } from '../../canvas/nodes/ViewCardNode'

const base = golden as unknown as View
const option = base.model!.cards.find((c) => c.family === 'option')!
const figure = base.model!.cards.find((c) => c.family === 'quantity')!
/** core's mark for a record Olumi proposed (markFor('record')), as its K5 entries carry it. */
const OLUMI = { glyph: '◆', title: 'Olumi proposed this; check it' }
const S1 = 'The second country could take longer to win over than the model allows for.'
const S2 = 'The first customers could be slower to renew than the pilot suggests.'
const withK5 = (c: Card, k5: Record<string, unknown>): Card => ({ ...c, ...k5 } as Card)
const marks = (el: HTMLElement) => el.querySelector('[data-slot="marks"]')!

afterEach(() => { cleanup(); useViewStore.setState({ view: null }) })

describe('"If it failed": Olumi\'s failure stories on the cards they rest on', () => {
  it('one badge per story resting on the card: core\'s number with Olumi\'s mark, the story in Olumi\'s words on hover', () => {
    const c = render(<ViewCard card={withK5(figure, { failed: [{ n: 1, title: S1, olumi: OLUMI }, { n: 3, title: S2, olumi: OLUMI }] })} />).container
    const badges = [...marks(c).querySelectorAll('[data-failed]')]
    expect(badges.map((b) => b.textContent)).toEqual(['◆1', '◆3'])
    expect(badges.map((b) => b.getAttribute('title'))).toEqual([`${OLUMI.title} · ${S1}`, `${OLUMI.title} · ${S2}`])
    expect(badges.map((b) => b.getAttribute('data-failed'))).toEqual([`${figure.id}.1`, `${figure.id}.3`])
  })

  it('an option carries the story most within the team\'s control, in core\'s words, marked Olumi\'s, the story on hover', () => {
    const c = render(<ViewCard card={withK5(option, { failed: [], failed_reason: { text: 'most within your control', title: S1, olumi: OLUMI } })} />).container
    const r = marks(c).querySelector(`[data-failed-reason="${option.id}"]`)!
    expect(r.textContent).toBe('◆ most within your control')
    expect(r.getAttribute('title')).toBe(`${OLUMI.title} · ${S1}`)
    expect(r.querySelector(`[data-view="${option.id}.failed_reason.text"]`)?.textContent).toBe('most within your control')
  })

  it('nothing is written by the UI: the marks row holds only core\'s glyphs, numbers and words', () => {
    const c = render(<ViewCard card={withK5(option, { failed: [{ n: 2, title: S2, olumi: OLUMI }], failed_reason: { text: 'most within your control', title: S2, olumi: OLUMI } })} />).container
    // The marks band also leads with a badge core names in words (f687bf91, DL 7 Nov), core's own icon and words: K5's marks follow it.
    const band = marks(c).cloneNode(true) as HTMLElement
    const named = band.querySelector('[data-badge-at-rest]')
    expect(named === null ? null : named.textContent, 'the badge is core\'s own, drawn as Badge draws it').toBe(named === null ? null : render(<ViewCard card={option} />).container.querySelector('[data-badge-at-rest]')!.textContent)
    named?.remove()
    // …and, on a card with no figure, who it is from: core's `author.text` (core 6192ad6b), at its path.
    const from = band.querySelector(`[data-view="${option.id}.author.text"]`)
    expect(from === null ? null : from.textContent).toBe(from === null ? null : (option as Card & { author: { text: string } }).author.text)
    from?.remove()
    expect(band.textContent).toBe('◆2◆ most within your control')
  })

  it('a card core sends no story for, an option with no story in its control, and a core before K5: nothing is drawn', () => {
    for (const card of [withK5(figure, { failed: [] }), withK5(option, { failed: [], failed_reason: null }), figure, option]) {
      const c = render(<ViewCard card={card} />).container
      expect(marks(c).querySelectorAll('[data-failed], [data-failed-reason]')).toHaveLength(0)
      cleanup()
    }
  })
})

describe('"If it failed": Olumi\'s failure stories on the reply they came with (core wip/k5 073f14c)', () => {
  const cap = capacity as unknown as View
  const STORIES = [
    { text: 'The new specialist could take longer to reach full speed than the model allows.', rests_on: ['per_specialist', 'start_delay', 'not_a_card'], option: 'add_one', in_control: true },
    { text: 'The backlog could grow faster than one more person can clear.', rests_on: [], option: null, in_control: false },
  ]
  const withStories = (stories: unknown[], heading: string | null): View => ({ ...cap, chat: cap.chat.map((t, i) => (i === cap.chat.length - 1 && t.answer ? { ...t, answer: { ...t.answer, stories, stories_heading: heading } } : t)) } as View)
  const shown = (v: View) => { useViewStore.setState({ view: v }); render(<ViewConversation chat={v.chat} />) }

  it('under core\'s heading, each story in Olumi\'s words, marked Olumi\'s with the key\'s own glyph and word', () => {
    shown(withStories(STORIES, 'If it failed'))
    const box = screen.getByTestId('view-chat-stories')
    expect(box.querySelector('[data-view$=".answer.stories_heading"]')?.textContent).toBe('If it failed')
    const items = [...box.querySelectorAll('[data-story]')]
    expect(items.map((li) => li.querySelector('[data-view$=".text"]')?.textContent)).toEqual(STORIES.map((x) => x.text))
    for (const li of items) {
      const mark = li.querySelector('[data-story-mark]')!
      expect(mark.textContent?.trim()).toBe('◆')
      expect(mark.getAttribute('title')).toBe('Olumi')
    }
  })

  it('⛔ Olumi\'s mark is core\'s key item by its id (`olumi`), never its words: with core\'s words for it changed, each story is still marked, in core\'s new words', () => {
    const v = withStories(STORIES, 'If it failed'), m = v.model!
    shown({ ...v, model: { ...m, key: m.key.map((k) => (k.id === 'olumi' ? { ...k, text: 'Olumi’s estimate' } : k)) } } as View)
    const items = [...screen.getByTestId('view-chat-stories').querySelectorAll('[data-story]')]
    expect(items.length).toBe(STORIES.length)
    for (const li of items) expect([li.querySelector('[data-story-mark]')?.textContent?.trim() ?? null, li.querySelector('[data-story-mark]')?.getAttribute('title') ?? null]).toEqual(['◆', 'Olumi’s estimate'])
  })

  it('the option a story is about and the cards it rests on, as label: value lines in each card\'s own heading; a record not on the canvas is not named', () => {
    shown(withStories(STORIES, 'If it failed'))
    const [first, second] = [...screen.getByTestId('view-chat-stories').querySelectorAll('[data-story]')]
    expect(first!.querySelector('[data-story-option]')?.textContent).toBe('Option: Add one specialist')
    expect(first!.querySelector('[data-story-rests]')?.textContent).toBe('Rests on: per specialist, start delay')
    expect(second!.querySelector('[data-story-option]')).toBeNull()
    expect(second!.querySelector('[data-story-rests]')).toBeNull()
    expect(screen.getByTestId('view-chat-stories').textContent).not.toContain('not_a_card')
  })

  it('a reply with no stories (core\'s [] and null heading), a core before K5 (no fields), and stories without core\'s heading (none is made up): nothing is drawn', () => {
    for (const v of [withStories([], null), cap, withStories(STORIES, null)]) {
      shown(v)
      expect(screen.queryByTestId('view-chat-stories')).toBeNull()
      cleanup()
    }
  })
})
