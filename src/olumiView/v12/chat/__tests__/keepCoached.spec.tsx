/**
 * Codex 008e item 3: Keep on any coached Olumi reply, whatever the person typed (not only an exact core menu question). Fixture: the in-repo
 * after-find-first View; the newest reply's words are replaced by plain text, its coaching (next step) kept or removed. Bound by test id.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, render } from '@testing-library/react'
import type { View } from '../../../client'
import { useViewStore } from '../../../store'
import { ViewChat, useViewChat } from '../../../ViewChat'
import { isCoachedReply } from '../../ideas'

const base = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/session', 'after-find-first.view3.json'), 'utf8')) as View
const SID = 's_cb215d057b96', UUID = '00000000-0000-4000-8000-cb215d057b96'
const show = (view: View) => useViewStore.setState({ uuid: UUID, sid: SID, view, error: null, status: 'ready', stale: false, at: null })
afterEach(() => {
  cleanup()
  useViewStore.setState({ uuid: null, sid: null, view: null, error: null, status: 'none', stale: false, at: null })
  useViewChat.setState({ text: '', ops: new Map(), busy: false, said: null, held: null, gone: null })
})
/** The newest turn: the person's own words, a plain one-paragraph answer, and the given next-step words. */
const last = (said: string, next: Array<{ text: string }>, answered = true): View => ({
  ...base,
  chat: base.chat.map((t, i, a) => (i !== a.length - 1 ? t : { ...t, said, answer: answered ? { ...t.answer!, answer: [{ text: 'Phone booked visitors first.' }], next: { ...t.answer!.next, text: next } } : null })),
})
const keeps = () => render(<ViewChat />).container.querySelectorAll('[data-testid="view-chat-latest"] [data-testid="view-keep-idea"]').length

describe('Keep on any coached reply', () => {
  it('shows on a reply to the person\'s own words (not a core menu question)', () => {
    const v = last('Tell me more about the visitors.', [{ text: 'Which visitors book by phone?' }])
    expect(base.session.methods.some((m) => m.text === v.chat.at(-1)!.said)).toBe(false)
    expect(isCoachedReply(v.chat.at(-1)!)).toBe(true)
    show(v)
    expect(keeps()).toBe(1)
  })
  it('still shows on a reply to one of core\'s menu questions', () => {
    show(last(base.session.methods[0]!.text, [{ text: 'Which visitors book by phone?' }]))
    expect(keeps()).toBe(1)
  })
  it('a wordless next step does not hide it: the View carries no "coached" marker, so core decides and answers in its own words', () => {
    const v = last('Tell me more about the visitors.', [{ text: '   ' }])
    expect(isCoachedReply(v.chat.at(-1)!)).toBe(true)
    show(v)
    expect(keeps()).toBe(1)
  })
  it('contrast: a turn with no answer has no Keep', () => {
    const v = last('Tell me more about the visitors.', [], false)
    expect(isCoachedReply(v.chat.at(-1)!)).toBe(false)
    show(v)
    expect(keeps()).toBe(0)
  })
})
