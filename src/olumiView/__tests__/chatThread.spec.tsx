import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import type { View } from '../client'
import { useViewStore } from '../store'
import { ViewChat, useViewChat } from '../ViewChat'

// Bind saved core turns, not invented replies (UI recovery witness row 11, DL 10 Nov).
const fixture: View = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/session/after-find-first.view3.json'), 'utf8'))
const failed: View = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/j1/bookshop-v1-turn-failed.core-172e23ae.view3.json'), 'utf8'))
const running: NonNullable<View['turn']> = { ...failed.turn!, status: 'answering', words: 'Olumi is answering.' }
const show = (view: View) => useViewStore.setState({ uuid: '00000000-0000-4000-8000-cb215d057b96', sid: view.id, view, error: null, status: 'ready', stale: false, at: null })
const follows = (first: Element, second: Element) => expect(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

beforeEach(() => {
  useViewChat.setState({ text: '', ops: new Map(), busy: false, said: null, held: null, gone: null })
  show(fixture)
})
afterEach(() => {
  cleanup()
  useViewStore.setState({ uuid: null, sid: null, view: null, error: null, status: 'none', stale: false, at: null })
})

describe('chat as a thread (UI recovery witness row 11, DL 10 Nov)', () => {
  it('CT1 turns run oldest to newest, with each person bubble before its answer and receipt', () => {
    expect(fixture.chat.length).toBeGreaterThanOrEqual(2)
    const { getByTestId, queryByTestId, container } = render(<ViewChat />)
    const thread = getByTestId('view-chat-turns')
    expect(thread.tagName).toBe('OL')
    expect(container.querySelectorAll('[data-testid="view-chat-turns"]')).toHaveLength(1)
    const turns = [...thread.children]
    expect(turns.map((turn) => turn.getAttribute('data-view-turn'))).toEqual(fixture.chat.map((_, i) => `chat.${i}`))
    turns.forEach((turn, i) => {
      const said = turn.querySelector('[data-testid="view-chat-said-bubble"]')!
      const answer = turn.querySelector('[data-testid="view-chat-answer"]')!
      expect(said.querySelector(`[data-view="chat.${i}.said"]`)?.textContent).toBe(fixture.chat[i]!.said)
      const first = fixture.chat[i]!.answer!.answer[0]!
      expect(answer.querySelector(`[data-view="chat.${i}.answer.answer.0.text"]`)?.textContent).toBe('text' in first ? first.text : null)
      follows(said, answer)
      const receipt = turn.querySelector('[data-testid="view-chat-version"]')!
      expect(receipt.querySelector(`[data-view="chat.${i}.version"]`)?.textContent).toBe(fixture.chat[i]!.version)
      follows(answer, receipt)
    })
    expect(getByTestId('view-chat-latest')).toBe(turns.at(-1))
    expect(queryByTestId('view-chat-in-reply')).toBeNull()
    expect(thread.textContent).not.toContain('In reply to:')
  })

  it('CT2 earlier turns stay in the thread with no earlier-turn disclosure', () => {
    const { getByTestId, queryByTestId } = render(<ViewChat />)
    expect(queryByTestId('view-chat-earlier')).toBeNull()
    for (const turn of getByTestId('view-chat-turns').children) expect(turn.closest('details')).toBeNull()
  })

  it('CT3 More ways is outside the scrolling thread and closed at rest, with bounded depth', () => {
    const { getByTestId } = render(<ViewChat />)
    const more = getByTestId('view-more-ways') as HTMLDetailsElement
    const scroll = getByTestId('view-chat-scroll')
    expect(scroll.contains(more)).toBe(false)
    expect(getByTestId('view-chat').contains(more)).toBe(true)
    follows(scroll, more)
    expect(more.open).toBe(false)
    const summary = more.querySelector('summary')!
    expect(summary).toHaveClass('text-text-body', 'underline', 'underline-offset-2')
    expect(summary).not.toHaveClass('text-info')
    const content = summary.nextElementSibling!
    expect(content).toHaveClass('max-h-[45vh]', 'overflow-y-auto')
    expect(content.contains(getByTestId('view-session-menu'))).toBe(true)
    expect(content.contains(getByTestId('v10-method-chips'))).toBe(true)
  })

  it('CT4 a turn in flight follows the last saved turn, with thinking dots only while running', () => {
    show({ ...fixture, turn: running })
    const { getByTestId, queryByTestId } = render(<ViewChat />)
    follows(getByTestId('view-chat-latest'), getByTestId('view-chat-turn-job'))
    expect(getByTestId('view-chat-turn-words').textContent).toBe(running.words)
    expect(getByTestId('view-chat-turn-seconds').textContent).toMatch(/\d+ s/)
    const dots = getByTestId('view-chat-dots')
    expect(dots.getAttribute('aria-hidden')).toBe('true')
    expect(dots).toHaveClass('motion-safe:animate-pulse')
    expect(dots.children).toHaveLength(3)
    expect(dots.textContent).toBe('')
    act(() => show({ ...fixture, turn: failed.turn }))
    expect(queryByTestId('view-chat-dots')).toBeNull()
    expect(queryByTestId('view-chat-turn-seconds')).toBeNull()
    expect(getByTestId('view-chat-turn-words').textContent).toBe(failed.turn!.words)
    follows(getByTestId('view-chat-latest'), getByTestId('view-chat-turn-job'))
  })

  it('CT5 scrolling back shows Latest, preserves the reading position, and resumes following on press', () => {
    show({ ...fixture, chat: fixture.chat.slice(0, 1) })
    const { getByTestId, queryByTestId } = render(<ViewChat />)
    const scroll = getByTestId('view-chat-scroll')
    Object.defineProperties(scroll, {
      scrollHeight: { value: 1000, configurable: true },
      clientHeight: { value: 200, configurable: true },
      scrollTop: { value: 200, writable: true, configurable: true },
    })
    fireEvent.scroll(scroll)
    const latest = getByTestId('view-chat-to-latest')
    expect(latest).toHaveAccessibleName('Go to the latest message')
    expect(latest.textContent).toBe('Latest')
    expect(latest).toHaveClass('min-h-[44px]', 'min-w-[44px]', 'text-text-body', 'border-panel-border', 'bg-panel')
    expect(latest).not.toHaveClass('text-info')
    expect(latest.querySelector('svg.lucide-arrow-down')).not.toBeNull()
    act(() => show(fixture))
    expect(scroll.scrollTop).toBe(200)
    act(() => show({ ...fixture, turn: running }))
    expect(scroll.scrollTop).toBe(200)
    fireEvent.click(latest)
    expect(scroll.scrollTop).toBe(800)
    expect(queryByTestId('view-chat-to-latest')).toBeNull()
    Object.defineProperty(scroll, 'scrollHeight', { value: 1200, configurable: true })
    act(() => show(fixture))
    expect(scroll.scrollTop).toBe(1000)
    scroll.scrollTop = 920
    fireEvent.scroll(scroll)
    Object.defineProperty(scroll, 'scrollHeight', { value: 1400, configurable: true })
    act(() => show({ ...fixture, turn: running }))
    expect(scroll.scrollTop).toBe(1200)
    expect(queryByTestId('view-chat-to-latest')).toBeNull()
    act(() => show({ ...fixture, chat: fixture.chat.slice(0, 1), turn: running }))
    expect(scroll.scrollTop).toBe(1200)
    scroll.scrollTop = 1119
    fireEvent.scroll(scroll)
    act(() => show({ ...fixture, turn: running }))
    expect(scroll.scrollTop).toBe(1119)
    expect(getByTestId('view-chat-to-latest')).not.toBeNull()
  })
})
