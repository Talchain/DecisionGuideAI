/**
 * The calm, coloured AI panel (Paul, 17 Nov 2026), bound by test id and by core's words read back from the View.
 * 1. One quiet footer row per reply: the cards (one icon with a count), show in the workspace, keep, and the version stamp as an icon with a hover.
 * 2. The pending proposal is ONE line pinned at the thread's foot, above the composer, outside the scrolling thread.
 * 3. The person's own name is hidden while they are alone in the thread, and shown once a colleague has written.
 * 4. The selected card is a chip inside the composer ("About: <heading>" with an X), not a box above it.
 * 5-9 (calm panel mock v2, Paul 17 Nov, and the three defects D1-D3 of the independent review of 833c1609): icons carry no hue, one type scale, Olumi's question
 *   card (one at a time), the composer's green Send, core's version words visible, the ask control kept, the heading's basis, the change-mix bar.
 * Each row names what fails if the change is reverted.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { setTeamFetch } from '../../../../olumiCore/team/api'
import { resetDrafts } from '../../../../olumiCore/team/drafts'
import { useUIStore } from '../../../../stores/uiStore'
import { useCanvasStore } from '../../../../canvas/store'
import { useGuidanceStore } from '../../../../canvas/stores/guidanceStore'
import type { View } from '../../../client'
import { useViewStore } from '../../../store'
import { ViewChat, ViewComposer, useViewChat } from '../../../ViewChat'
import { SELECTION_DETAIL_WORDS } from '../../../../canvas/components/SelectionPill'
import { aboutCountWords } from '../AboutChip'
import { draftKeyOf } from '../OlumiAsks'
import { typography } from '../../../../styles/typography'

const selection: { value: { id: string; label: string; kind: 'node' | 'edge' } | null } = { value: null }
vi.mock('../../../../canvas/hooks/useSelectionContext', () => ({ useSelectionContext: () => selection.value }))

const DIR = path.resolve('src/olumiView')
// The fixture predates `by_id` on turns; core now serves it, so it is added here as the viewer's own id.
const session = (n: string): View => { const v = JSON.parse(readFileSync(path.join(DIR, 'fixtures/session', `${n}.view3.json`), 'utf8')) as View; return { ...v, chat: v.chat.map((t) => ({ ...t, by_id: v.you_id })) } as View }
const golden = (n: string): View => JSON.parse(readFileSync(path.join(DIR, 'golden', `${n}.view.json`), 'utf8'))
const q = (c: ParentNode, id: string) => c.querySelector<HTMLElement>(`[data-testid="${id}"]`)
const qa = (c: ParentNode, id: string) => [...c.querySelectorAll<HTMLElement>(`[data-testid="${id}"]`)]
const mount = (view: View) => {
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: view.id, view, status: 'ready', error: null, stale: false, at: null })
  return render(<><ViewChat /><ViewComposer /></>).container
}
beforeEach(() => { useUIStore.setState({ activeOutputTab: 'olumi' } as never); setTeamFetch((async () => new Response('{}', { status: 201 })) as never); selection.value = null })
afterEach(() => {
  cleanup(); setTeamFetch(null); resetDrafts(); vi.restoreAllMocks()
  useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none', error: null, at: null })
  useViewChat.setState({ text: '', ops: new Map(), busy: false, said: null, held: null, gone: null })
})

describe('1. one quiet footer row per reply', () => {
  it('each answered turn has exactly ONE tools row, beside (not inside) the answer, holding the cards icon with a count and the version stamp', () => {
    const c = mount(session('after-find-first'))
    for (const li of qa(c, 'view-chat-turns')[0]!.querySelectorAll<HTMLElement>(':scope > li')) {
      const rows = qa(li, 'view-reply-tools')
      expect(rows).toHaveLength(1)
      expect(li.contains(q(li, 'view-chat-answer')!) && q(li, 'view-chat-answer')!.contains(rows[0]!)).toBe(false) // the row is not nested in the answer
      expect(rows[0]!.contains(q(li, 'view-chat-version')!)).toBe(true) // the stamp is IN the row, not stacked under it
      expect(qa(li, 'view-chat-version')).toHaveLength(1)
    }
    const row = q(q(c, 'view-chat-latest')!, 'view-reply-tools')!
    const chip = q(row, 'view-about-chip')!
    const n = (chip.dataset['cards'] ?? '').split(' ').length
    expect(chip.querySelector('svg')).not.toBeNull() // an icon
    const count = Array.from(chip.children).find((c) => c.tagName === 'SPAN' && c.getAttribute('aria-hidden') === 'true' && c.querySelector('svg') === null)!
    expect(count.textContent).toBe(String(n)) // with its count (the icon's own span is decorative too, so the count is the one without an svg)
    expect(chip).toHaveTextContent(aboutCountWords(n)) // and its words for readers ("2 cards")
    expect(chip.title.length).toBeGreaterThan(0) // the hover lists the cards
  })
  // CHANGED BY DESIGN (D1, independent review of 833c1609): core's version and status words are content, drawn visibly beside the icon (they were an sr-only span inside it).
  it('D1: the version stamp is a small icon whose hover is core\'s version and status words, AND those words are drawn visibly beside it', () => {
    const view = session('after-find-first')
    const c = mount(view)
    const stamp = q(q(c, 'view-chat-latest')!, 'view-chat-version')!
    const icon = stamp.querySelector<HTMLElement>('[role="img"]')!
    const t = view.chat[view.chat.length - 1]!
    expect(icon.title).toContain(t.version)
    expect(icon.getAttribute('aria-label')).toBe(icon.title)
    const words = stamp.querySelector<HTMLElement>('[data-view$=".version"]')!
    expect(words.textContent).toBe(t.version)
    expect(words.closest('.sr-only')).toBeNull() // visible, not for readers only
    expect(stamp.className).toContain('text-text-light') // small and light: viewPanelMeta
    expect(stamp.className).toContain(typography.viewPanelMeta)
    expect(icon.contains(words)).toBe(false) // beside the icon, not inside it
    if (t.status !== null) {
      const status = stamp.querySelector<HTMLElement>('[data-view$=".status"]')!
      expect(status.textContent).toBe(t.status)
      expect(status.closest('.sr-only')).toBeNull() // visible: a hidden status would fail here
    }
  })
})

describe('2. the pending proposal is ONE line at the thread\'s foot, above the composer', () => {
  it('it is outside the scrolling thread, after it, before the composer; one line: Olumi\'s mark, core\'s heading, Review, Approve, an icon Set aside', () => {
    const view = golden('proposal'), p = view.proposal!
    const c = mount(view)
    const box = q(c, 'view-chat-pinned')!, scroll = q(c, 'view-chat-scroll')!, composer = q(c, 'view-composer')!
    expect(scroll.contains(box)).toBe(false) // never inside the thread it must not cover
    expect(scroll.compareDocumentPosition(box) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy() // below the thread
    expect(box.compareDocumentPosition(composer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy() // just above the composer
    expect(q(c, 'view-chat')!.contains(box)).toBe(true)
    const line = q(box, 'view-proposal-actions')!
    expect(line.contains(q(box, 'view-proposal-row')!)).toBe(true) // heading and actions are one line
    expect(q(box, 'view-proposal-row')!.textContent).toBe(p.on === '' ? p.heading : `${p.heading} · ${p.on}`)
    expect(q(line, 'view-proposal-review-toggle')).toHaveTextContent('Review')
    expect(q(line, 'view-approve')).not.toBeNull()
    const aside = q(line, 'view-set-aside')!
    expect(aside.textContent).toBe('') // an icon, not words
    expect(aside.getAttribute('aria-label')).toBe('Set aside')
    expect(aside.title).toBe('Set aside')
    expect(qa(box, 'view-approve')).toHaveLength(1) // ONE filled button
  })
  it('opening Review shows the change list ABOVE the line, inside the same box; Approve and Set aside stay in the line', () => {
    const c = mount(golden('proposal'))
    const box = q(c, 'view-chat-pinned')!
    expect(q(box, 'view-changes')).toBeNull()
    fireEvent.click(q(box, 'view-proposal-review-toggle')!)
    const list = q(box, 'view-changes')!, line = q(box, 'view-proposal-actions')!
    expect(list.compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(line.contains(q(box, 'view-approve')!)).toBe(true)
    expect(box.className).not.toContain('border-panel-border') // no outline box
  })
})

describe('3. whose words a message holds is always drawn', () => {
  // CHANGED BY DESIGN (Codex NO-GO on 07657eb3; review 008: authorship stays legible): the person's own name is drawn on their own message
  // whether or not anyone else has written. It was kept for screen readers only while they were alone in the thread.
  const nameOf = (c: ParentNode, i: number) => c.querySelector<HTMLElement>(`[data-view="chat.${i}.by"]`)!
  it('alone in the thread: every message draws its writer\'s name, in core\'s words', () => {
    const view = session('after-find-first')
    expect(new Set(view.chat.map((t) => t.by_id)).size).toBe(1) // one writer: the case that used to hide the name
    const c = mount(view)
    view.chat.forEach((t, i) => {
      expect(nameOf(c, i).textContent).toBe(t.by)
      expect(nameOf(c, i).className).not.toContain('sr-only')
      expect(nameOf(c, i).closest('.sr-only')).toBeNull()
    })
  })
  it('with a colleague in the thread: both names are drawn, each on its own message (bound by the turn, not the position)', () => {
    const base = session('after-find-first')
    const view = { ...base, chat: base.chat.map((t, i) => (i === 0 ? { ...t, by: 'Ben', by_id: '2' } : t)) } as View
    const c = mount(view)
    expect(nameOf(c, 0).textContent).toBe('Ben')
    expect(nameOf(c, 1).textContent).toBe(base.chat[1]!.by)
    for (const i of [0, 1]) expect(nameOf(c, i).className).not.toContain('sr-only')
  })
})

describe('4. the selected card is a chip inside the composer', () => {
  // CHANGED BY DESIGN (D2, independent review of 833c1609): "About: <heading>" is a label and sends nothing; asking is its own visible control
  // (selection-ask-chip, the registry's ask-about-this), and the card's own kind shape leads the label.
  it('"About: <heading>" with an X, inside the composer box; no "Selected:" box; the X clears the selection', () => {
    selection.value = { id: 'per_specialist', label: 'per specialist', kind: 'node' }
    const sendChip = vi.fn()
    useGuidanceStore.setState({ _sendChip: sendChip } as never)
    const clear = vi.spyOn(useCanvasStore.getState(), 'clearSelection').mockImplementation(() => {})
    const c = mount(session('after-find-first'))
    const composer = q(c, 'view-composer')!
    const chip = q(composer, 'selection-chip')!
    expect(chip).toHaveTextContent('About: per specialist')
    expect(composer.textContent).not.toContain('Selected:')
    fireEvent.click(q(chip, 'selection-chip-label')!) // the words are a label: nothing is sent
    expect(sendChip).not.toHaveBeenCalled()
    fireEvent.click(q(chip, 'selection-pill-clear')!)
    expect(clear).toHaveBeenCalledTimes(1)
  })
  it('the selected card\'s own words are drawn OPEN (whose it is, what its headline rests on): read without a press; the person may fold them', () => {
    // Codex NO-GO on 07657eb3: these were behind a closed fold. Bound by the card: the author line drawn is this card's, in core's words.
    const view = golden('bakery')
    const card = view.model!.cards.find((x) => x.author != null && (x.headline?.title ?? '') !== '')!
    expect(card).toBeDefined() // the fixture has a card with an author line and a headline basis
    selection.value = { id: card.id, label: card.heading, kind: 'node' }
    const c = mount(view)
    const detail = q(q(c, 'view-composer')!, 'selection-detail') as HTMLDetailsElement
    expect(detail.open).toBe(true)
    const author = q(detail, 'selected-author')!
    expect(author.textContent).toBe(card.author!.text)
    expect(author.getAttribute('data-view')).toBe(`${card.id}.author.text`)
    expect(q(detail, 'selected-headline-title')!.textContent).toBe(card.headline!.title) // what the headline rests on, core's sentence, whole
    const toggle = q(detail, 'selection-detail-toggle')!
    expect(toggle.getAttribute('aria-label')).toBe(SELECTION_DETAIL_WORDS.hide)
    detail.open = false; fireEvent(detail, new Event('toggle'))
    expect(q(detail, 'selection-detail-toggle')!.getAttribute('aria-label')).toBe(SELECTION_DETAIL_WORDS.show)
  })
  it('a selection core\'s model holds no card for (the question) draws the chip and NO detail box (it was an empty box once the detail opened by default)', () => {
    const view = golden('bakery')
    selection.value = { id: 'page:question', label: view.model!.question.text, kind: 'node' }
    const c = mount(view)
    const composer = q(c, 'view-composer')!
    expect(q(composer, 'selection-chip-label')!.textContent).toBe(`About: ${view.model!.question.text}`)
    expect(q(composer, 'selection-chip-label')!.getAttribute('title')).toBe(view.model!.question.text)
    expect(q(composer, 'selection-detail')).toBeNull()
  })
  it('D2: a visible ask control keeps data-testid="selection-ask-chip" (hover: "Ask about <label>") and is the only thing that sends; the card\'s own kind shape leads', () => {
    selection.value = { id: 'per_specialist', label: 'per specialist', kind: 'node' }
    const sendChip = vi.fn()
    useGuidanceStore.setState({ _sendChip: sendChip } as never)
    const c = mount(session('after-find-first'))
    const chip = q(q(c, 'view-composer')!, 'selection-chip')!
    const ask = q(chip, 'selection-ask-chip')!
    expect(ask.title).toBe('Ask about per specialist')
    expect(ask.getAttribute('aria-label')).toBe('Ask about per specialist')
    expect(ask.querySelector('svg')).not.toBeNull() // drawn, not hidden
    expect(ask.style.color).toBe('var(--text-light)') // neutral
    fireEvent.click(ask)
    expect(sendChip).toHaveBeenCalledTimes(1)
    expect(sendChip.mock.calls[0]![0]).toBe('Ask about per specialist')
    const shape = q(chip, 'selection-kind-shape')!
    expect(['factor', 'outcome']).toContain(shape.dataset['kind']) // per_specialist is a figure: its own canvas shape
    expect(chip.firstElementChild!.contains(shape)).toBe(true) // leads the label
  })
  it('nothing selected: no chip', () => {
    const c = mount(session('after-find-first'))
    expect(q(c, 'selection-chip')).toBeNull()
  })
})

// ---------------------------------------------------------------------------------------------------------------------------------------------
// Mock v2 (Paul, 17 Nov): icons carry no hue; one type scale; Olumi's question card; green Send; D3; the change mix.
const HUE_CLASS = /^(?:[a-z-]+:)*text-(?:info|success|warning|danger|option|goal|factor)$/
const GREYS = new Set(['var(--text-light)', 'var(--text-header)', 'var(--text-body)', 'var(--border-default)'])
const everything = (root: Element): HTMLElement[] => [...root.querySelectorAll<HTMLElement>('*')]
const hued = (root: Element): string[] => {
  const out: string[] = []
  for (const el of everything(root)) {
    const col = el.style.color
    if (col !== '' && !GREYS.has(col) && el.querySelector('[data-icon="olumi-ai"]') === null && el.getAttribute('data-icon') !== 'olumi-ai') out.push(`${el.getAttribute('aria-label') ?? el.tagName}:${col}`)
  }
  for (const svg of root.querySelectorAll('svg')) {
    if (svg.getAttribute('data-icon') === 'olumi-ai' || svg.closest('[data-icon="olumi-ai"]') !== null) continue
    for (let e: Element | null = svg; e !== null && e !== root; e = e.parentElement) if ((e.getAttribute('class') ?? '').split(/\s+/).some((t) => HUE_CLASS.test(t)) && e.querySelector('[data-icon="olumi-ai"]') === null) { out.push(`svg under .${e.getAttribute('class')}`); break }
  }
  return out
}

describe('5. icons carry no hue (Paul, 17 Nov: "that\'s one less thing that\'s busy")', () => {
  it('every icon the panel draws (a reply with its footer row, the composer with its method icons, a selection chip) is a grey token', () => {
    selection.value = { id: 'per_specialist', label: 'per specialist', kind: 'node' }
    useGuidanceStore.setState({ _sendChip: vi.fn() } as never)
    const c = mount(session('after-find-first'))
    expect(c.querySelectorAll('svg').length).toBeGreaterThan(5) // precondition: icons are drawn
    expect(hued(c)).toEqual([])
  })
  it('the proposal strip too: Olumi\'s mark is the one blue; Set aside and the chevron are grey (CONTRAST: an icon in --danger or under text-info is caught)', () => {
    const c = mount(golden('proposal'))
    expect(hued(c)).toEqual([])
    expect(q(c, 'view-chat-pinned')!.querySelector('[data-icon="olumi-ai"]')).not.toBeNull()
    const probe = document.createElement('div')
    probe.innerHTML = '<span role="img" style="color: var(--danger)"><svg/></span><span class="text-info"><svg/></span>'
    expect(hued(probe)).toHaveLength(2)
  })
})

describe('6. one type scale: 12/18 reading, 12/16 meta, 12 medium heading, 18 medium headline only', () => {
  const OFF = /^(?:[a-z-]+:)*text-(?:sm|base|xl|2xl|3xl|\[(?:11|13|14|15|16)px\]|\[length:calc\((?:13|14|15|16)px.*)$/
  const sizes = (root: Element): string[] => everything(root).flatMap((el) => {
    const toks = (el.getAttribute('class') ?? '').split(/\s+/)
    const bad = toks.filter((t) => OFF.test(t) || (/^text-lg$/.test(t) && !toks.includes('font-medium')))
    return bad.map((t) => `${el.tagName}.${t}`)
  })
  it('no panel text class is 11, 13, 14, 15 or 16 px (a thread, its footer row, the composer, the pinned proposal, Olumi\'s question card)', () => {
    const q3 = golden('s_ce285b3617bb')
    for (const v of [session('after-find-first'), golden('proposal'), q3]) { cleanup(); expect(sizes(mount(v))).toEqual([]) }
    const probe = document.createElement('div'); probe.innerHTML = '<p class="text-[14px]">x</p><p class="text-base">y</p><p class="text-lg">z</p>'
    expect(sizes(probe)).toHaveLength(3) // CONTRAST: the check does see off-scale classes
  })
  it('the question text is viewPanelBody, the same as every reading text', () => {
    const c = mount(golden('s_ce285b3617bb'))
    const card = q(c, 'view-model-question')!
    expect(card.className).toContain(typography.viewPanelBody)
  })
})

describe('7. Olumi\'s question: ONE at a time, the rest behind it', () => {
  const asked = () => golden('s_ce285b3617bb')
  const visible = (c: ParentNode) => [...c.querySelectorAll<HTMLElement>('[data-view^="model.coaching_questions"]')].filter((e) => !e.hidden && e.closest('[hidden]') === null)
  it('shows one question, "1 of 3", three progress dashes; the other two stay in the page, hidden, in core\'s words', () => {
    const view = asked(), qs = view.model!.coaching_questions!
    const c = mount(view)
    const card = q(c, 'view-model-question')!
    expect(visible(card)).toHaveLength(1)
    expect(visible(card)[0]!.textContent).toBe(qs[0])
    expect(q(card, 'view-question-count')!.textContent).toBe('1 of 3')
    expect(qa(card, 'view-question-dashes').length).toBe(1)
    expect(card.querySelectorAll('[data-testid^="view-question-dash-"]')).toHaveLength(3)
    expect(q(card, 'view-model-question-text-1')!.hidden).toBe(true)
    expect(q(card, 'view-model-question-text-1')!.textContent).toBe(qs[1])
    expect(card.querySelector(`[data-testid="view-model-question-text-3"]`)).toBeNull() // three at most
    expect(card.className).toContain('border-info/40') // Olumi\'s card: a token at opacity, no new colour
  })
  it('Skip (a neutral icon) moves to the next question and "2 of 3"; the last has no Skip (CONTRAST: a single question draws no count)', () => {
    const view = asked(), qs = view.model!.coaching_questions!
    const c = mount(view)
    const card = q(c, 'view-model-question')!
    const skip = q(card, 'view-question-skip')!
    expect(skip.textContent).toBe('')
    expect(skip.title).toBe('Skip')
    expect(skip.style.color).toBe('var(--text-light)')
    fireEvent.click(skip)
    expect(q(card, 'view-question-count')!.textContent).toBe('2 of 3')
    expect(visible(card)[0]!.textContent).toBe(qs[1])
    fireEvent.click(q(card, 'view-question-skip')!)
    expect(q(card, 'view-question-count')!.textContent).toBe('3 of 3')
    expect(q(card, 'view-question-skip')).toBeNull()
    cleanup()
    const one = asked(); one.model!.coaching_questions = [qs[0]!]
    const c1 = mount(one)
    expect(q(c1, 'view-question-count')).toBeNull()
    expect(q(c1, 'view-question-skip')).toBeNull()
  })
  it('"Use this" is green and idle until words are typed; it sends the person\'s answer ALONE (never core\'s question as theirs) through the conversation\'s own message write, then moves on; the method icons are neutral and send nothing', async () => {
    const bodies: string[] = []
    setTeamFetch((async (_u: unknown, init?: RequestInit) => { bodies.push(String(init?.body ?? '')); return new Response('{}', { status: 201 }) }) as never)
    const view = asked(), qs = view.model!.coaching_questions!
    const c = mount(view)
    const card = q(c, 'view-model-question')!
    const use = q(card, 'view-question-use') as HTMLButtonElement
    expect(use.textContent).toBe('Use this')
    expect(use.disabled).toBe(true)
    expect(use.className).toContain('bg-success')
    expect(use.className).toContain('text-text-header')
    expect(use.className).not.toContain('bg-text-header')
    fireEvent.change(q(card, 'view-question-answer')!, { target: { value: 'By the end of June' } })
    expect(use.disabled).toBe(false)
    for (const k of ['assumption', 'opposite', 'disconfirming', 'outside']) expect(q(card, `view-question-method-${k}`)!.style.color).toBe('var(--text-light)')
    fireEvent.click(q(card, 'view-question-method-opposite')!)
    expect(bodies).toEqual([]) // with no card selected an ask-for-more icon waits for a card (menu brief UI-A, 18 Nov): nothing typed, nothing sent
    expect([useViewChat.getState().text, useViewChat.getState().armed]).toEqual(['', 'opposite'])
    useViewChat.setState({ text: '', armed: null })
    await act(async () => { fireEvent.click(use) })
    await vi.waitFor(() => expect(bodies.some((b) => b.includes('By the end of June'))).toBe(true))
    const sent = bodies.filter((b) => b.includes('By the end of June'))
    expect(sent).toHaveLength(1)
    // Codex 21:12Z: the message is the person's words alone. Core's question (Olumi's wording) is in no part of what is sent as theirs.
    expect(qs[0]!.length).toBeGreaterThan(20)
    expect(sent[0]).not.toContain(qs[0]!.slice(0, 20))
    expect((JSON.parse(sent[0]!) as { text?: string }).text).toBe('By the end of June')
  })
  it('a draft belongs to one question of one scenario: core rewriting the question, or another scenario at the same place, shows an empty box (CONTRAST: the same question keeps its draft)', () => {
    const view = asked(), qs = view.model!.coaching_questions!
    const c = mount(view)
    const box = () => q(q(c, 'view-model-question')!, 'view-question-answer') as HTMLTextAreaElement
    fireEvent.change(box(), { target: { value: 'By the end of June' } })
    act(() => useViewStore.setState({ view: { ...view, chat: [...view.chat] } }))
    expect(box().value).toBe('By the end of June') // CONTRAST: the same scenario and the same question: the draft is kept
    act(() => useViewStore.setState({ view: { ...view, model: { ...view.model!, coaching_questions: [`${qs[0]!} (asked again)`, ...qs.slice(1)] } } }))
    expect(box().value).toBe('') // the question's words changed: these are not the words typed for it
    act(() => useViewStore.setState({ view }))
    expect(box().value).toBe('By the end of June') // the first question again: its own draft
    act(() => useViewStore.setState({ view: { ...view, id: 's_another0000' } }))
    expect(box().value).toBe('') // another scenario: nothing carried over
    expect(draftKeyOf('s_a', { key: 'c:0', text: 'x' })).not.toBe(draftKeyOf('s_b', { key: 'c:0', text: 'x' }))
  })
})

describe('8. Send is the person\'s green act, never black', () => {
  it('the composer Send is --success with an ink arrow; hover and active are the success family; disabled is one solid neutral', () => {
    const c = mount(session('after-find-first'))
    const send = q(c, 'view-composer-send')!
    for (const t of ['bg-success', 'text-text-header', 'hover:bg-success-hover', 'active:bg-success-active', 'disabled:bg-panel-border']) expect(send.className, t).toContain(t)
    expect(send.className).not.toMatch(/(^|\s)bg-text-header(\s|$)/)
    expect(send.className).not.toContain('text-text-on-color')
    expect(send.querySelector('svg')).not.toBeNull()
    expect((send.querySelector('[aria-hidden="true"]') as HTMLElement).style.color).toBe('var(--text-header)') // the ink glyph (registry send)
  })
})

describe('9. the proposal line: heading basis (D3) and the change mix', () => {
  it('D3: core\'s heading has a real flex basis (never 0), in the class and in the pinned box\'s own rule, so Review, Approve and Set aside wrap before it is squeezed', () => {
    const c = mount(golden('proposal'))
    const row = q(c, 'view-proposal-row')!
    expect(row.className).toContain('flex-[1_1_12rem]')
    expect(row.className).not.toMatch(/(^|\s)flex-1(\s|$)/)
    const css = readFileSync(path.join(DIR, 'look/olumiLook.css'), 'utf8')
    const rule = /\.ok-pinned \[data-testid='view-proposal-row'\]\s*\{([^}]*)\}/.exec(css)![1]!
    expect(/flex:\s*1 1 12rem/.test(rule)).toBe(true)
    expect(/flex:\s*1 1 0\b/.test(rule)).toBe(false)
    expect(q(c, 'view-proposal-actions')!.className).toContain('flex-wrap')
  })
  it('the strip carries a stacked change-mix bar: one segment per change family, in that kind\'s token, as wide as its count; none where the changes carry no family', () => {
    const view = structuredClone(golden('proposal'))
    const ch = view.proposal!.changes!
    view.proposal!.changes = [{ ...ch[0]!, family: 'quantity' }, { ...ch[1]!, family: 'quantity' }, { ...ch[0]!, id: 'o1', family: 'option' }, { ...ch[0]!, id: 'g1', family: 'goal' }, { ...ch[0]!, id: 'x1', family: 'claim' }]
    const c = mount(view)
    const bar = q(q(c, 'view-proposal-actions')!, 'view-change-mix')!
    const seg = [...bar.children] as HTMLElement[]
    expect(seg.map((x) => [x.dataset['family'], x.dataset['n'], x.style.background])).toEqual([['quantity', '2', 'var(--factor)'], ['option', '1', 'var(--option)'], ['goal', '1', 'var(--goal)'], ['claim', '1', 'var(--border-emphasis)']])
    expect(seg.map((x) => x.style.flexGrow)).toEqual(['2', '1', '1', '1']) // as wide as its count: removing the width fails here
    expect(bar.getAttribute('role')).toBe('img')
    expect(bar.getAttribute('aria-label')).toBe('Kinds of change: quantity 2, option 1, goal 1, claim 1') // the bar in words
    expect(bar.getAttribute('aria-hidden')).toBeNull()
    expect(q(c, 'view-proposal-row')!.contains(bar)).toBe(false) // beside the row, so core\'s words stay exactly the row's text
    cleanup()
    const older = structuredClone(golden('proposal'))
    older.proposal!.changes = older.proposal!.changes!.map((x) => ({ ...x, family: '' }))
    expect(q(mount(older), 'view-change-mix')).toBeNull()
  })
})

void act
