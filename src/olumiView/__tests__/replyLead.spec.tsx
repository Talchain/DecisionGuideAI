/**
 * UI-BRIEF-20261115 step 2 (Paul, 15 Nov: "There's so much text and busy content … This is intimidating and complicated"): a reply with
 * Why lines leads with its FIRST Why line, whole, in core's words; its next step follows; the answer and the other Why lines sit behind the
 * product's own "Why", closed. A reply with no Why line draws its answer as before. Bound by the turn (`data-view-turn`) and by core's own
 * View paths; fixtures are the served Views already used by the reply specs (fixtures/real, __tests__/fixtures).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, render } from '@testing-library/react'
vi.mock('../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: {} }))
import type { View } from '../client'
import { ViewConversation } from '../ViewChat'
import { useViewStore } from '../store'

const read = (p: string): View => JSON.parse(readFileSync(path.resolve(p), 'utf8'))
const textOf = (ps: Array<{ text?: string; cite?: string }>) => ps.map((p) => p.text ?? '').join('')
/** An element's words without its numbered cite marks (core's cites are the marks' hover, not words of the line). */
const wordsOf = (el: Element) => { const c = el.cloneNode(true) as Element; c.querySelectorAll('[data-view-cite]').forEach((x) => x.remove()); return (c.textContent ?? '').replace(/\s+/g, ' ').trim() }
const norm = (s: string) => s.replace(/\s+/g, ' ').trim()
/** Every text piece core sent in `parts`, at the exact View path Words/Blocks give it (a part split across lines: `.text` then `.text.<k>`),
 *  with its exact words; a list line's "- " marker is the only thing Blocks may drop. */
const piecesOf = (parts: Array<{ text?: string; cite?: string }>, at: string) => parts.flatMap((p, i) => p.text === undefined ? []
  : p.text.split('\n').flatMap((line, k) => (line === '' ? [] : [{ path: k === 0 ? `${at}.${i}.text` : `${at}.${i}.text.${k}`, words: line }])))
const drawnAs = (el: Element | null, words: string) => el !== null && (el.textContent === words || el.textContent === words.replace(/^\s*- /, ''))
afterEach(() => { cleanup(); useViewStore.setState({ view: null }) })

describe('a reply leads with its first Why line; the rest is behind "Why"', () => {
  for (const f of ['src/olumiView/__tests__/fixtures/live-v51-run2-approved.view.json', 'src/olumiView/fixtures/real/hiring.view3.json', 'src/olumiView/fixtures/real/capacity.view3.json']) {
    it(`L1 ${path.basename(f)}: lead = why[0] whole; next step after it; answer and why[1..] inside a closed "Why"`, () => {
      const v = read(f)
      useViewStore.setState({ view: v })
      const { container } = render(<ViewConversation chat={v.chat} />)
      const withWhy = v.chat.map((t, i) => ({ t, i })).filter(({ t }) => t.answer !== null && t.answer.why.length > 0)
      expect(withWhy.length, 'precondition: a reply with Why lines').toBeGreaterThan(0)
      for (const { t, i } of withWhy) {
        const turn = container.querySelector<HTMLElement>(`[data-view-turn="chat.${i}"]`)!
        const lead = turn.querySelector<HTMLElement>(`[data-reply-lead="chat.${i}"]`)
        expect(lead === null ? null : wordsOf(lead), String(t.id)).toBe(norm(textOf(t.answer!.why[0]!)))
        const more = turn.querySelector<HTMLDetailsElement>(`[data-reply-more="chat.${i}"]`)!
        expect([more.open, more.querySelector('summary')?.textContent]).toEqual([false, 'Why'])
        // the whole answer is kept, inside "Why", never cut: EVERY text piece of core's answer, at its own View path, with its exact words,
        // is inside the fold; none is drawn outside it
        const pieces = piecesOf(t.answer!.answer, `chat.${i}.answer.answer`)
        expect(pieces.length, 'precondition: the answer has words').toBeGreaterThan(0)
        for (const { path: at, words } of pieces) {
          const all = turn.querySelectorAll(`[data-view="${at}"]`)
          expect([all.length, more.contains(all[0] ?? null), drawnAs(all[0] ?? null, words)], at).toEqual([1, true, true])
        }
        // and the lead is why[0], piece by piece, exact
        for (const { path: at, words } of piecesOf(t.answer!.why[0]!, `chat.${i}.answer.why.0`)) {
          const el = turn.querySelector(`[data-view="${at}"]`)
          expect([lead!.contains(el), drawnAs(el, words)], at).toEqual([true, true])
        }
        // nothing of the answer is outside "Why"; the lead comes before the next step
        const next = turn.querySelector('[data-testid="view-chat-next"]')!
        expect(lead!.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
        for (let j = 1; j < t.answer!.why.length; j++) expect(more.querySelector(`[data-view^="chat.${i}.answer.why.${j}"]`), `why ${j}`).not.toBeNull()
      }
    })
  }
  it('L2 must not change: a reply with no Why line draws its answer in full, with no "Why" fold and no lead', () => {
    const v = read('src/olumiView/__tests__/fixtures/live-v51-run2-approved.view.json')
    const i = v.chat.findIndex((t) => t.answer !== null)
    const bare = structuredClone(v); bare.chat[i]!.answer!.why = []
    useViewStore.setState({ view: bare })
    const { container } = render(<ViewConversation chat={bare.chat} />)
    const turn = container.querySelector<HTMLElement>(`[data-view-turn="chat.${i}"]`)!
    expect([turn.querySelector('[data-reply-lead]'), turn.querySelector('[data-reply-more]')]).toEqual([null, null])
    const pieces = piecesOf(bare.chat[i]!.answer!.answer, `chat.${i}.answer.answer`)
    expect(pieces.length).toBeGreaterThan(0)
    for (const { path: at, words } of pieces) {
      const el = turn.querySelector(`[data-view="${at}"]`)
      expect([drawnAs(el, words), el?.closest('details') ?? null], at).toEqual([true, null])
    }
  })
})
