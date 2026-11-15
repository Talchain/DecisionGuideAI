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
        // the whole answer is kept, inside "Why", never cut: every line of core's answer is in the fold, and none is outside it
        const inFold = wordsOf(more), outside = wordsOf(turn.querySelector('[data-testid="view-chat-answer"]')!).replace(inFold, '')
        for (const line of textOf(t.answer!.answer).split('\n').map((l) => norm(l).replace(/^- /, '')).filter((l) => l.length > 12)) {
          expect(inFold.includes(line.slice(0, 60)), `answer line in Why: ${line.slice(0, 40)}`).toBe(true)
          expect(outside.includes(line.slice(0, 60)), `answer line outside Why: ${line.slice(0, 40)}`).toBe(false)
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
    expect(turn.querySelector('[data-testid="view-chat-answer"]')!.textContent).toContain(textOf(bare.chat[i]!.answer!.answer).split('\n')[0]!.slice(0, 40))
  })
})
