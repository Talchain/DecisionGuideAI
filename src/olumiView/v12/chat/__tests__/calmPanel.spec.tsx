/**
 * The calm, coloured AI panel (Paul, 17 Nov 2026), bound by test id and by core's words read back from the View.
 * 1. One quiet footer row per reply: the cards (one icon with a count), show in the workspace, keep, and the version stamp as an icon with a hover.
 * 2. The pending proposal is ONE line pinned at the thread's foot, above the composer, outside the scrolling thread.
 * 3. The person's own name is hidden while they are alone in the thread, and shown once a colleague has written.
 * 4. The selected card is a chip inside the composer ("About: <heading>" with an X), not a box above it.
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
import { aloneIn, ViewChat, ViewComposer, useViewChat } from '../../../ViewChat'
import { aboutCountWords } from '../AboutChip'

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
    expect(chip.querySelector('[aria-hidden="true"]:not(svg)')!.textContent).toBe(String(n)) // with its count
    expect(chip).toHaveTextContent(aboutCountWords(n)) // and its words for readers ("2 cards")
    expect(chip.title.length).toBeGreaterThan(0) // the hover lists the cards
  })
  it('the version stamp is a small icon whose hover is core\'s version and status words; they stay in the page for readers', () => {
    const view = session('after-find-first')
    const c = mount(view)
    const stamp = q(q(c, 'view-chat-latest')!, 'view-chat-version')!
    const icon = stamp.querySelector<HTMLElement>('[role="img"]')!
    const t = view.chat[view.chat.length - 1]!
    expect(icon.title).toContain(t.version)
    expect(icon.getAttribute('aria-label')).toBe(icon.title)
    expect(stamp.querySelector(`[data-view$=".version"]`)!.textContent).toBe(t.version)
    expect(stamp.querySelector('[data-view$=".version"]')!.closest('.sr-only')).not.toBeNull()
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

describe('3. the person\'s own name is hidden when alone, shown with a colleague', () => {
  const nameOf = (c: ParentNode, i: number) => c.querySelector<HTMLElement>(`[data-view="chat.${i}.by"]`)!
  it('alone: every bubble\'s name is kept for readers but not drawn', () => {
    const view = session('after-find-first')
    expect(aloneIn(view.you_id, view.chat)).toBe(true)
    const c = mount(view)
    view.chat.forEach((_, i) => expect(nameOf(c, i).className).toContain('sr-only'))
  })
  it('with a colleague in the thread: both names are drawn (CONTRAST: the same turns, one by another person)', () => {
    const base = session('after-find-first')
    const view = { ...base, chat: base.chat.map((t, i) => (i === 0 ? { ...t, by: 'Ben', by_id: '2' } : t)) } as View
    expect(aloneIn(view.you_id, view.chat)).toBe(false)
    const c = mount(view)
    expect(nameOf(c, 0).className).not.toContain('sr-only')
    expect(nameOf(c, 1).className).not.toContain('sr-only') // my own name returns once someone else has written
  })
  it('an unknown viewer is never treated as alone', () => {
    expect(aloneIn(null, session('after-find-first').chat)).toBe(false)
  })
})

describe('4. the selected card is a chip inside the composer', () => {
  it('"About: <heading>" with an X, inside the composer box; no "Selected:" box; the X clears the selection', () => {
    selection.value = { id: 'per_specialist', label: 'per specialist', kind: 'node' }
    useGuidanceStore.setState({ _sendChip: vi.fn() } as never)
    const clear = vi.spyOn(useCanvasStore.getState(), 'clearSelection').mockImplementation(() => {})
    const c = mount(session('after-find-first'))
    const composer = q(c, 'view-composer')!
    const chip = q(composer, 'selection-chip')!
    expect(chip).toHaveTextContent('About: per specialist')
    expect(q(chip, 'selection-pill-ask')!.title).toBe('Ask about per specialist') // the hover detail is kept
    expect(composer.textContent).not.toContain('Selected:')
    fireEvent.click(q(chip, 'selection-pill-clear')!)
    expect(clear).toHaveBeenCalledTimes(1)
  })
  it('nothing selected: no chip', () => {
    const c = mount(session('after-find-first'))
    expect(q(c, 'selection-chip')).toBeNull()
  })
})

void act
