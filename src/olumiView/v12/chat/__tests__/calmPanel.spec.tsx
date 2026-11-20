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
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
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
import { draftKeyOf, resetRemovedQuestions } from '../OlumiAsks'
import { chatQuestionsOf } from '../../../layout'
import { typography } from '../../../../styles/typography'
import { setOpen } from '../../../__tests__/reviewRow'
import { controls } from '../../../../styles/controls'
import { TIP_DELAY } from '../../../look/Tip'
import { tipOnFocus } from '../../../__tests__/tipHelpers'

/** The words the shared Tip shows after the pointer rests on `el` (no native title any more). */
const tipWords = (el: HTMLElement): string | null => {
  vi.useFakeTimers()
  try {
    fireEvent.pointerEnter(el)
    act(() => { vi.advanceTimersByTime(TIP_DELAY) })
    const words = document.querySelector('[role="tooltip"]')?.textContent ?? null
    fireEvent.pointerLeave(el)
    return words
  } finally { vi.useRealTimers() }
}

const selection: { value: { id: string; label: string; kind: 'node' | 'edge' } | null } = { value: null }
vi.mock('../../../../canvas/hooks/useSelectionContext', () => ({ useSelectionContext: () => selection.value }))

const DIR = path.resolve('src/olumiView')
// The fixture predates `by_id` on turns; core now serves it, so it is added here as the viewer's own id.
const session = (n: string): View => { const v = JSON.parse(readFileSync(path.join(DIR, 'fixtures/session', `${n}.view3.json`), 'utf8')) as View; return { ...v, chat: v.chat.map((t) => ({ ...t, by_id: v.you_id })) } as View }
const golden = (n: string): View => JSON.parse(readFileSync(path.join(DIR, 'golden', `${n}.view.json`), 'utf8'))
/** The one Tip's words for an element: pointer rest (after its delay) shows it; leaving closes it. Native `title` is no longer the hover. */
const tipOf = async (el: HTMLElement): Promise<string | null> => {
  fireEvent.pointerEnter(el)
  await waitFor(() => expect(document.querySelector('[role="tooltip"]')).not.toBeNull())
  const words = document.querySelector('[role="tooltip"]')!.textContent
  fireEvent.pointerLeave(el)
  return words
}
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
  useViewChat.setState({ text: '', ops: new Map(), busy: false, said: null, held: null, gone: null, armed: null })
  useGuidanceStore.setState({ _sendChip: null } as never)
})

describe('1. one quiet footer row per reply', () => {
  it('each answered turn has exactly ONE tools row, beside (not inside) the answer, holding the cards icon with a count and the version stamp', async () => {
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
    expect(chip.hasAttribute('title'), 'no native title').toBe(false)
    expect((await tipOf(chip))!.length, 'the hover (the one Tip) lists the cards').toBeGreaterThan(0)
  })
  // CHANGED BY DESIGN (P4, system spec): the version is its icon alone; core's version and status words are its hover and name (through Tip), no longer drawn beside it
  // (D1 had drawn them visibly). Was: the words beside the icon.
  it('P4: the version stamp is a small icon whose hover and name are core\'s version and status words; no version or status text is drawn beside it', async () => {
    const view = session('after-find-first')
    const c = mount(view)
    const stamp = q(q(c, 'view-chat-latest')!, 'view-chat-version')!
    const icon = stamp.querySelector<HTMLElement>('[role="img"]')!
    const t = view.chat[view.chat.length - 1]!
    expect(icon.getAttribute('aria-label')).toContain(t.version)
    expect(icon.hasAttribute('title'), 'no native title').toBe(false)
    expect(await tipOf(icon)).toContain(t.version)
    // Keyboard (Codex panel round 2): the wrapper must NOT take the tab stop (the labelled icon suppresses its own stop inside a [tabindex] ancestor, so its
    // focus handler never ran). The icon is the one stop, and real focus on it opens the Tip.
    expect(stamp.hasAttribute('tabindex'), 'the wrapper is not a keyboard stop').toBe(false)
    expect([...stamp.querySelectorAll('[tabindex]')], 'exactly one stop inside the stamp: the icon').toEqual([icon])
    expect(await tipOnFocus(icon), 'keyboard focus shows the version').toContain(t.version)
    expect(stamp.textContent, 'no visible "version N" text').toBe('')
    expect(stamp.querySelector('[data-view$=".version"], [data-view$=".status"]')).toBeNull()
    expect(t.status, 'this fixture has no status: the version is the one word').toBeNull()
    // With a status, the hover says both; still nothing drawn beside the icon.
    cleanup()
    const STATUS = 'An invented status from core.'
    const withStatus = { ...view, chat: view.chat.map((x, k) => (k === view.chat.length - 1 ? { ...x, status: STATUS } : x)) } as View
    const s2 = q(q(mount(withStatus), 'view-chat-latest')!, 'view-chat-version')!
    expect(s2.textContent).toBe('')
    expect(await tipOf(s2.querySelector<HTMLElement>('[role="img"]')!)).toBe(`${t.version} · ${STATUS}`)
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
    expect(tipWords(aside)).toBe('Set aside') // the one hover (Tip), not a native title
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
  it('the selected card\'s own words start CLOSED behind the info icon (S4 esc3, 19 Nov: a card press never grows the composer); one press opens them, whose it is and what its headline rests on, in core\'s words; a second folds them', () => {
    // Was drawn OPEN (Codex 17 Nov). Paul's bar of 19 Nov: the drawer repeated the details box and took 54% of the panel, so it is the person's to open.
    const view = golden('bakery')
    const card = view.model!.cards.find((x) => x.author != null && (x.headline?.title ?? '') !== '')!
    expect(card).toBeDefined() // the fixture has a card with an author line and a headline basis
    selection.value = { id: card.id, label: card.heading, kind: 'node' }
    const c = mount(view)
    const detail = q(q(c, 'view-composer')!, 'selection-detail') as HTMLDetailsElement
    expect(detail.open).toBe(false)
    const toggle = q(detail, 'selection-detail-toggle')!
    expect(toggle.getAttribute('aria-label')).toBe(SELECTION_DETAIL_WORDS.show)
    detail.open = true; fireEvent(detail, new Event('toggle'))
    const author = q(detail, 'selected-author')!
    expect(author.textContent).toBe(card.author!.text)
    expect(author.getAttribute('data-view')).toBe(`${card.id}.author.text`)
    expect(q(detail, 'selected-headline-title')!.textContent).toBe(card.headline!.title) // what the headline rests on, core's sentence, whole
    expect(q(detail, 'selection-detail-toggle')!.getAttribute('aria-label')).toBe(SELECTION_DETAIL_WORDS.hide)
    detail.open = false; fireEvent(detail, new Event('toggle'))
    expect(q(detail, 'selection-detail-toggle')!.getAttribute('aria-label')).toBe(SELECTION_DETAIL_WORDS.show)
  })
  it('a selection core\'s model holds no card for (the question) draws the chip and NO detail box (it was an empty box once the detail opened by default)', async () => {
    const view = golden('bakery')
    selection.value = { id: 'page:question', label: view.model!.question.text, kind: 'node' }
    const c = mount(view)
    const composer = q(c, 'view-composer')!
    expect(q(composer, 'selection-chip-label')!.textContent).toBe(`About: ${view.model!.question.text}`)
    expect(q(composer, 'selection-chip-label')!.hasAttribute('title'), 'no native title').toBe(false)
    expect(await tipOnFocus(q(composer, 'selection-chip-label')!)).toBe(view.model!.question.text)
    expect(q(composer, 'selection-detail')).toBeNull()
  })
  it('D2 + UI-D (18 Nov): the ask control (data-testid="selection-ask-chip", hover "Ask about <label>") is drawn with NO legacy sender registered, as this lane is deployed; a press starts the person\'s own question about that card in the box and sends nothing (the legacy sender, even if present, is not called); the card\'s own kind shape leads', () => {
    selection.value = { id: 'per_specialist', label: 'per specialist', kind: 'node' }
    const sendChip = vi.fn(), posted: string[] = []
    setTeamFetch((async (_u: unknown, init?: RequestInit) => { if (init?.method === 'POST') posted.push(String(init.body ?? '')); return new Response('{}', { status: 201 }) }) as never)
    useGuidanceStore.setState({ _sendChip: null } as never)
    const c = mount(session('after-find-first'))
    const chip = q(q(c, 'view-composer')!, 'selection-chip')!
    const ask = q(chip, 'selection-ask-chip')!
    expect(tipWords(ask)).toBe('Ask about per specialist')
    expect(ask.getAttribute('aria-label')).toBe('Ask about per specialist')
    expect(ask.querySelector('svg')).not.toBeNull() // drawn, not hidden
    expect(ask.className.split(/\s+/)).toContain('text-text-light') // neutral (a class since 18 Nov, so disabled and hover can win)
    useGuidanceStore.setState({ _sendChip: sendChip } as never)
    fireEvent.click(ask)
    expect([useViewChat.getState().text, sendChip.mock.calls.length, posted]).toEqual(['About per specialist: ', 0, []])
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
  const open = (card: HTMLElement) => { fireEvent.click(q(card, 'view-question-toggle')!); return card }
  it('REMOVE (Paul, 19 Nov: "not just collapse, but remove"): the card has a remove press; pressed, the card is gone, not folded; CONTRAST: the chevron only folds it', () => {
    try {
    const c = mount(asked())
    const card = q(c, 'view-model-question')!
    open(card); open(card)
    expect(q(c, 'view-model-question'), 'the chevron folds, the card stays').not.toBeNull()
    fireEvent.click(q(card, 'view-question-remove')!)
    expect(q(c, 'view-model-question'), 'removed, not folded').toBeNull()
    // CONTRAST (Codex 11:15:52Z): the same question id in new words is a new question, so it shows again.
    cleanup()
    // Codex 11:52Z: reword EXACTLY the first question the chat shows (chatQuestionsOf, by its own data path), keeping its id and the viewer.
    const before = asked(), first = chatQuestionsOf(before.model)[0]!
    const v = JSON.parse(JSON.stringify(before)) as Record<string, unknown>
    const path = first.view.split('.'), last = path.pop()!
    const owner = path.reduce<Record<string, unknown>>((o, k) => o[k] as Record<string, unknown>, v)
    owner[last] = `${first.text} (reworded)`
    const after = chatQuestionsOf((v as unknown as View).model)[0]!
    expect([after.key, after.text, (v as unknown as View).you_id]).toEqual([first.key, `${first.text} (reworded)`, before.you_id])
    const c2 = mount(v as unknown as View)
    expect(q(c2, 'view-model-question'), 'same id, same viewer, new words: shown again').not.toBeNull()
    } finally { resetRemovedQuestions() }
  })
  it('REST (audit chat-2, chat-3): ONE quiet row (Olumi\'s mark, the question, a chevron): no answer box, no Use this, no icons; a panel with the info border, not the info fill', () => {
    const c = mount(asked())
    const card = q(c, 'view-model-question')!
    expect(card.getAttribute('data-open')).toBeNull()
    expect(q(card, 'view-question-toggle')!.getAttribute('aria-expanded')).toBe('false')
    for (const id of ['view-question-answer', 'view-question-use', 'view-question-more', 'view-question-dashes', 'view-question-skip']) expect(q(card, id), id).toBeNull()
    expect(card.className).toContain('bg-panel')
    expect(card.className).toContain('border-info/30')
    expect(card.className).not.toContain('bg-info/10')
  })
  it('E. a card\'s pop-over opening folds the question card\'s answer box (one surface at a time); what was typed is kept for when it is opened again', async () => {
    const { useLaneInspector } = await import('../../edit/inspectorStore')
    const c = mount(asked())
    const card = open(q(c, 'view-model-question')!)
    fireEvent.change(q(card, 'view-question-answer')!, { target: { value: 'By the end of June' } })
    act(() => { useLaneInspector.getState().show({ kind: 'details', target: { kind: 'card', id: 'c1' } }) })
    expect([card.getAttribute('data-open'), q(card, 'view-question-answer')]).toEqual([null, null])
    act(() => { useLaneInspector.getState().close() })
    open(card)
    expect((q(card, 'view-question-answer') as HTMLTextAreaElement).value).toBe('By the end of June')
  })
  it('OPEN (audit chat-2): the answer box has a visible placeholder and "Use this" is not drawn until words are typed (never seen disabled); the draft survives closing and opening', () => {
    const card = open(q(mount(asked()), 'view-model-question')!)
    const box = q(card, 'view-question-answer') as HTMLTextAreaElement
    expect(box.placeholder).toBe('Your answer')
    expect(q(card, 'view-question-use'), 'no button before words').toBeNull()
    fireEvent.change(box, { target: { value: '   ' } })
    expect(q(card, 'view-question-use'), 'blank is not words').toBeNull()
    fireEvent.change(box, { target: { value: 'By the end of June' } })
    const use = q(card, 'view-question-use') as HTMLButtonElement
    // Shown only with words, so never seen disabled at rest; its look is the one shared green action (controls.act), not a local copy.
    expect([use.disabled, use.className.includes(controls.act)]).toEqual([false, true])
    fireEvent.click(q(card, 'view-question-toggle')!)
    expect(q(card, 'view-question-answer')).toBeNull()
    open(card)
    expect((q(card, 'view-question-answer') as HTMLTextAreaElement).value).toBe('By the end of June')
  })
  it('shows one question, "1 of 3", three progress dashes; the other two stay in the page, hidden, in core\'s words', () => {
    const view = asked(), qs = view.model!.coaching_questions!
    const c = mount(view)
    const card = open(q(c, 'view-model-question')!)
    expect(visible(card)).toHaveLength(1)
    expect(visible(card)[0]!.textContent).toBe(qs[0])
    expect(q(card, 'view-question-count')!.textContent).toBe('1 of 3')
    expect(qa(card, 'view-question-dashes').length).toBe(1)
    expect(card.querySelectorAll('[data-testid^="view-question-dash-"]')).toHaveLength(3)
    expect(q(card, 'view-model-question-text-1')!.hidden).toBe(true)
    expect(q(card, 'view-model-question-text-1')!.textContent).toBe(qs[1])
    expect(card.querySelector(`[data-testid="view-model-question-text-3"]`)).toBeNull() // three at most
    expect(card.className).toContain('border-info/30') // Olumi\'s card: a token at opacity, no new colour (CHANGED 18 Nov: was border-info/40 on a bg-info/10 fill)
  })
  it('Skip (a neutral icon) moves to the next question and "2 of 3"; the last has no Skip (CONTRAST: a single question draws no count)', () => {
    const view = asked(), qs = view.model!.coaching_questions!
    const c = mount(view)
    const card = open(q(c, 'view-model-question')!)
    const skip = q(card, 'view-question-skip')!
    expect(skip.textContent).toBe('')
    expect(tipWords(skip)).toBe('Skip')
    expect(skip.className.split(/\s+/)).toContain('text-text-light')
    fireEvent.click(skip)
    expect(q(card, 'view-question-count')!.textContent).toBe('2 of 3')
    expect(visible(card)[0]!.textContent).toBe(qs[1])
    fireEvent.click(q(card, 'view-question-skip')!)
    expect(q(card, 'view-question-count')!.textContent).toBe('3 of 3')
    expect(q(card, 'view-question-skip')).toBeNull()
    cleanup()
    const one = asked(); one.model!.coaching_questions = [qs[0]!]
    const c1 = mount(one)
    open(q(c1, 'view-model-question')!)
    expect(q(c1, 'view-question-count')).toBeNull()
    expect(q(c1, 'view-question-skip')).toBeNull()
  })
  it('"Use this" is green and drawn only once words are typed; it sends the person\'s answer ALONE (never core\'s question as theirs) through the conversation\'s own message write, then moves on; the method icons are neutral and send nothing', async () => {
    const bodies: string[] = []
    setTeamFetch((async (_u: unknown, init?: RequestInit) => { bodies.push(String(init?.body ?? '')); return new Response('{}', { status: 201 }) }) as never)
    const view = asked(), qs = view.model!.coaching_questions!
    const c = mount(view)
    const card = open(q(c, 'view-model-question')!)
    expect(q(card, 'view-question-use')).toBeNull() // CHANGED 18 Nov (audit chat-2): was drawn disabled; now absent until words are typed
    fireEvent.change(q(card, 'view-question-answer')!, { target: { value: 'By the end of June' } })
    const use = q(card, 'view-question-use') as HTMLButtonElement
    expect(use.textContent).toBe('Use this')
    expect(use.disabled).toBe(false)
    expect(use.className).toContain('bg-success')
    expect(use.className).toContain('text-text-header')
    expect(use.className).not.toContain('bg-text-header')
    // CHANGED 19 Nov (Paul): the four method icons are the composer's alone; the question card draws none of its own.
    expect([q(card, 'view-question-more'), ...['assumption', 'opposite', 'disconfirming', 'outside'].map((k) => q(card, `view-question-method-${k}`))]).toEqual([null, null, null, null, null])
    await act(async () => { fireEvent.click(use) })
    await vi.waitFor(() => expect(bodies.some((b) => b.includes('By the end of June'))).toBe(true))
    const sent = bodies.filter((b) => b.includes('By the end of June'))
    expect(sent).toHaveLength(1)
    // Codex 21:12Z: the message is the person's words alone. Core's question (Olumi's wording) is in no part of what is sent as theirs.
    expect(qs[0]!.length).toBeGreaterThan(20)
    expect(sent[0]).not.toContain(qs[0]!.slice(0, 20))
    expect((JSON.parse(sent[0]!) as { text?: string }).text).toBe('By the end of June')
  })
  it('ONE ANSWER PATH (CONTRACT §3, Paul 00:10Z): a question core sent typed at that place carries its id, and "Use this" posts …/answer bound to it, once; CONTRAST: without the typed question it is today\'s message', async () => {
    const calls: { url: string; body: string }[] = []
    setTeamFetch((async (u: unknown, init?: RequestInit) => { calls.push({ url: String(u), body: String(init?.body ?? '') }); return new Response('{}', { status: 201 }) }) as never)
    const view = asked(), qs = view.model!.coaching_questions!
    ;(view.model as unknown as { questions: unknown[] }).questions = qs.map((text, i) => ({ id: `qid${i}`, text, target: null, role: null, unit: null }))
    let card = open(q(mount(view), 'view-model-question')!)
    fireEvent.change(q(card, 'view-question-answer')!, { target: { value: 'Twelve weeks' } })
    await act(async () => { fireEvent.click(q(card, 'view-question-use')!) })
    await vi.waitFor(() => expect(calls.some((c) => c.body.includes('Twelve weeks'))).toBe(true))
    const mine = calls.filter((c) => c.body.includes('Twelve weeks'))
    expect(mine.map((c) => [c.url.endsWith('/answer'), (JSON.parse(c.body) as { question_id?: string }).question_id])).toEqual([[true, 'qid0']])
    cleanup(); calls.length = 0; useViewChat.setState({ text: '', ops: new Map(), busy: false, said: null, held: null, gone: null, armed: null }); resetDrafts()
    card = open(q(mount(asked()), 'view-model-question')!)
    fireEvent.change(q(card, 'view-question-answer')!, { target: { value: 'Twelve weeks' } })
    await act(async () => { fireEvent.click(q(card, 'view-question-use')!) })
    await vi.waitFor(() => expect(calls.some((c) => c.body.includes('Twelve weeks'))).toBe(true))
    expect(calls.filter((c) => c.body.includes('Twelve weeks')).map((c) => [c.url.endsWith('/messages'), (JSON.parse(c.body) as { question_id?: string }).question_id ?? null])).toEqual([[true, null]])
  })
  it('ONE ANSWER PATH, bound at the draft (Codex ROOT 01:20Z): a draft typed for core\'s question X never goes out under a new question Y at the same place with the same words; Y\'s box starts empty and its answer carries Y\'s id', async () => {
    const calls: { url: string; body: string }[] = []
    setTeamFetch((async (u: unknown, init?: RequestInit) => { calls.push({ url: String(u), body: String(init?.body ?? '') }); return new Response('{}', { status: 201 }) }) as never)
    const view = asked(), qs = view.model!.coaching_questions!
    ;(view.model as unknown as { questions: unknown[] }).questions = qs.map((text, i) => ({ id: `qX${i}`, text, target: null, role: null, unit: null }))
    const c = mount(view)
    let card = open(q(c, 'view-model-question')!)
    fireEvent.change(q(card, 'view-question-answer')!, { target: { value: '12' } })
    // Core re-mints the question at the same place with the same words (e.g. its target's unit changed): a new typed id.
    const next = structuredClone(view)
    ;(next.model as unknown as { questions: unknown[] }).questions = qs.map((text, i) => ({ id: `qY${i}`, text, target: null, role: null, unit: null }))
    act(() => { useViewStore.setState({ view: next } as never) })
    card = q(c, 'view-model-question')!
    if (q(card, 'view-question-answer') === null) open(card)
    expect((q(card, 'view-question-answer') as HTMLTextAreaElement).value).toBe('')
    fireEvent.change(q(card, 'view-question-answer')!, { target: { value: '14' } })
    await act(async () => { fireEvent.click(q(card, 'view-question-use')!) })
    await vi.waitFor(() => expect(calls.some((x) => x.url.endsWith('/answer'))).toBe(true))
    expect(calls.filter((x) => x.url.endsWith('/answer')).map((x) => [(JSON.parse(x.body) as { question_id: string; text: string }).question_id, (JSON.parse(x.body) as { text: string }).text])).toEqual([['qY0', '14']])
  })
  it('a draft belongs to one question of one scenario: core rewriting the question, or another scenario at the same place, shows an empty box (CONTRAST: the same question keeps its draft)', () => {
    const view = asked(), qs = view.model!.coaching_questions!
    const c = mount(view)
    open(q(c, 'view-model-question')!)
    const box = () => q(q(c, 'view-model-question')!, 'view-question-answer') as HTMLTextAreaElement
    fireEvent.change(box(), { target: { value: 'By the end of June' } })
    act(() => useViewStore.setState({ view: { ...view, chat: [...view.chat] } }))
    expect(box().value).toBe('By the end of June') // CONTRAST: the same scenario and the same question: the draft is kept
    act(() => useViewStore.setState({ view: { ...view, model: { ...view.model!, coaching_questions: [`${qs[0]!} (asked again)`, ...qs.slice(1)] } } }))
    expect(box().value).toBe('') // the question's words changed: these are not the words typed for it
    act(() => useViewStore.setState({ view }))
    expect(box().value).toBe('By the end of June') // the first question again: its own draft
    act(() => useViewStore.setState({ view: { ...view, id: 's_another0000' } }))
    open(q(c, 'view-model-question')!) // a new scenario is a new card, closed at rest
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
    // The ink glyph (registry send) takes the button's colour: the button above carries text-text-header (and disabled:text-text-light), the icon has no colour class of its own.
    expect((send.querySelector('[aria-hidden="true"]') as HTMLElement).className.split(/\s+/).filter((t) => t.startsWith('text-'))).toEqual([])
  })
})

describe('9. the proposal line: heading basis (D3) and the change mix', () => {
  it('D3: core\'s heading has a real flex basis (never 0), in the class and in the pinned box\'s own rule, so it is squeezed (one line, cut) before the bar ever takes a second line (18 Nov)', () => {
    const c = mount(golden('proposal'))
    const row = q(c, 'view-proposal-row')!
    expect(row.className).toContain('flex-[1_1_12rem]')
    expect(row.className).not.toMatch(/(^|\s)flex-1(\s|$)/)
    const css = readFileSync(path.join(DIR, 'look/olumiLook.css'), 'utf8')
    const rule = /\.ok-pinned \[data-testid='view-proposal-row'\]\s*\{([^}]*)\}/.exec(css)![1]!
    expect(/flex:\s*1 1 12rem/.test(rule)).toBe(true)
    expect(/flex:\s*1 1 0\b/.test(rule)).toBe(false)
    expect(q(c, 'view-proposal-actions')!.className).toContain('flex-nowrap')
  })
  it('D3 open: with the review OPEN the proposal line wraps, so core\'s heading keeps its basis and the controls take the line below (19 Nov, 1.33: kept on one line the heading went eight lines tall and the sticky foot covered the last group). CONTRAST: closed, the strip stays one line', () => {
    const c = mount(golden('proposal'))
    const line = () => q(c, 'view-proposal-actions')!
    expect(line().className).toContain('flex-nowrap')
    setOpen(q(c, 'view-proposal-review')!, true)
    expect(line().className).toContain('flex-wrap')
    expect(line().className).not.toContain('flex-nowrap')
    expect([line().contains(q(c, 'view-proposal-row')!), line().contains(q(c, 'view-approve')!), line().contains(q(c, 'view-set-aside')!)]).toEqual([true, true, true])
    setOpen(q(c, 'view-proposal-review')!, false)
    expect(line().className).toContain('flex-nowrap')
  })
  it('no change-mix bar, open or closed (Paul, 20 Nov: a 4px strip he could barely see, with no value; it was deleted)', () => {
    const c = mount(structuredClone(golden('proposal')))
    expect(q(c, 'view-change-mix')).toBeNull()
    setOpen(q(c, 'view-proposal-review')!, true)
    expect(q(c, 'view-change-mix')).toBeNull()
  })
})

describe('10. Paul\'s 19 Nov test, batch 2: authorship, honest approve, one fold', () => {
  it('D. the record form opened from outside is docked under the thread, never inside its scroll, and never scrolls itself: the thread rests on its newest reply (DL 20 Nov: at 1232 and 1.33 the form in the thread scrolled that reply out of view; the browser numbers are the gate)', async () => {
    const { openCommitDraft } = await import('../../team/CommitForm')
    const view = golden('proposal'), c = mount(view)
    const calls: string[] = []
    const real = HTMLElement.prototype.scrollIntoView
    HTMLElement.prototype.scrollIntoView = function (this: HTMLElement) { calls.push(this.getAttribute('data-testid') ?? this.tagName) }
    try {
      vi.useFakeTimers()
      act(() => openCommitDraft(view.id, view))
      act(() => { vi.runAllTimers() })
    } finally { vi.useRealTimers(); HTMLElement.prototype.scrollIntoView = real }
    const form = q(c, 'commit-form')!, scroller = q(c, 'view-chat-scroll')!, foot = q(c, 'view-chat-form')!
    expect([form.getAttribute('data-open'), scroller.contains(form), foot.contains(form), q(c, 'view-chat-latest') !== null && scroller.contains(q(c, 'view-chat-latest')), calls.includes('commit-form')]).toEqual(['true', false, true, true, false])
    // The dock is the thread's sibling under it (after the thread's wrap), so the thread's own scroll is untouched by the form's height.
    expect(scroller.closest('[data-thread-wrap]')!.compareDocumentPosition(foot) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
  const youOf = (v: View) => v.you_id
  /** The proposal fixture with core's typed conversation entry for its second turn saying how that turn was asked. */
  const asking = (ask: string): View => {
    const v = golden('proposal'), t = v.chat[1]!
    return { ...v, draft: { status: 'done', reason: null, at: '2026-11-19T00:00:00Z', conversation: [{ seq: t.id, kind: 'turn', job: null, by_id: t.by_id, ask, proposal: t.id, discussion: null, state: null }] } } as unknown as View
  }
  const bubbleOf = (c: ParentNode, i: number) => c.querySelector<HTMLElement>(`[data-view-turn="chat.${i}"] [data-testid="view-chat-said-bubble"]`)!
  it('A. a question the page drafted that the person pressed (typed ask "challenge" or "method") is drawn as their act in chrome, never as the template words in their bubble; a plain message keeps its words', () => {
    for (const [ask, words] of [['challenge', 'Asked with a method'], ['method', 'Asked with a method']] as const) {
      const v = asking(ask), said = v.chat[1]!.said
      const b = bubbleOf(mount(v), 1)
      expect([q(b, 'view-chat-pressed')?.getAttribute('data-pressed'), q(b, 'view-chat-pressed')?.textContent, b.textContent!.includes(said)], ask).toEqual([ask, words, false])
      cleanup()
    }
    // CONTRAST: the same turn asked as a plain message is the person's words, with no chrome; and the other turn (no entry) keeps its words too.
    const v = asking('message'), c = mount(v)
    expect([q(bubbleOf(c, 1), 'view-chat-pressed'), bubbleOf(c, 1).textContent!.includes(v.chat[1]!.said), bubbleOf(c, 0).textContent!.includes(v.chat[0]!.said)]).toEqual([null, true, true])
  })
  it('A. the turn in flight reads core\'s typed `turn.ask` the same way', () => {
    const base = golden('proposal')
    const turn = (ask: string) => ({ ...base, turn: { job: 9, status: 'answering', said: 'TEMPLATE-WORDS-OF-THE-PAGE', ask, by: 'You', by_id: youOf(base), words: 'Olumi is answering', started: '2026-11-19T00:00:00Z', at: '2026-11-19T00:00:00Z' } }) as unknown as View
    const c = mount(turn('challenge')), job = q(c, 'view-chat-turn-job')!
    expect([q(job, 'view-chat-pressed')?.getAttribute('data-pressed'), job.textContent!.includes('TEMPLATE-WORDS-OF-THE-PAGE')]).toEqual(['challenge', false])
    cleanup()
    const m = q(mount(turn('message')), 'view-chat-turn-job')!
    expect([q(m, 'view-chat-pressed'), m.textContent!.includes('TEMPLATE-WORDS-OF-THE-PAGE')]).toEqual([null, true])
  })
  it('B. the review\'s approve controls are held while Olumi answers a turn on that same proposal (by id and status), and free when it answers nothing there', () => {
    const base = golden('proposal'), p = base.proposal!
    const approves = (v: View) => { const c = mount(v); const r = ['view-approve'].map((t) => (q(c, t) as HTMLButtonElement | null)?.getAttribute('aria-disabled') === 'true'); cleanup(); return r }
    // The ticked approval too: open the review, tick a line, and "Approve ticked" is held with the whole one while Olumi answers on this proposal.
    const ticked = (v: View) => { const c = mount(v); setOpen(q(c, 'view-proposal-review')!, true); const box = q(c, 'view-change-tick-0') as HTMLInputElement | null; if (box !== null) fireEvent.click(box); const r = [q(c, 'view-approve-ticked') as HTMLButtonElement | null, q(c, 'view-approve') as HTMLButtonElement | null].map((b) => b?.getAttribute('aria-disabled') === 'true'); cleanup(); return r }
    const turn = (status: string) => ({ job: 9, status, said: 'x', ask: 'message', by: 'You', by_id: youOf(base), words: 'w', started: '2026-11-19T00:00:00Z', at: '2026-11-19T00:00:00Z' })
    const reply = (status: string, proposal: number) => ({ job: 10, proposal, version: 1, status, words: 'w', by: 'You', by_id: youOf(base), started: '2026-11-19T00:00:00Z', at: '2026-11-19T00:00:00Z' })
    expect(approves({ ...base, turn: null } as unknown as View), 'nothing answering').toEqual([false])
    expect(approves({ ...base, turn: turn('answering') } as unknown as View), 'answering a turn on the pending proposal').toEqual([true])
    expect(approves({ ...base, turn: turn('failed') } as unknown as View), 'a failed turn holds nothing').toEqual([false])
    expect(approves({ ...base, reply: reply('running', p.id) } as unknown as View), 'its reply running').toEqual([true])
    expect(approves({ ...base, reply: reply('running', p.id + 1) } as unknown as View), 'a reply running on another proposal').toEqual([false])
    expect(ticked({ ...base, turn: null } as unknown as View), 'ticked, nothing answering').toEqual([false, false])
    expect(ticked({ ...base, turn: turn('answering') } as unknown as View), 'ticked, answering on this proposal').toEqual([true, true])
  })
})

void act
