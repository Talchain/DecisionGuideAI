/**
 * R5 (the design lead's R3 look check, item 7; DL approved 4 Nov): a reply's cite marker was a superscript "◦" that read as a stray dot
 * (after "requirement" on the real capacity board). Each cite is now numbered by its place in the reply (1, 2, … across the answer, its
 * Why lines and its next step, in that order), with core's cite as its hover, verbatim; no word is composed. Fixtures: the real capacity
 * and hiring Views (fixtures/real).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, render } from '@testing-library/react'
vi.mock('../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: {} }))
import type { View } from '../client'
import { ViewConversation } from '../ViewChat'
import { useViewStore } from '../store'

const read = (n: string): View => JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/real', n), 'utf8'))
afterEach(() => { cleanup(); useViewStore.setState({ view: null }) })

/** Core's cites of one reply, in the order the reply draws them: its answer, each Why line, its next step. */
const citesOf = (t: View['chat'][number]) => t.answer === null ? [] : [t.answer.answer, ...t.answer.why, t.answer.next.text].flatMap((ps) => ps.flatMap((p) => ('cite' in p ? [p.cite] : [])))

describe('a reply\'s cites are numbered by their place in it, core\'s cite on hover', () => {
  for (const n of ['capacity.view3.json', 'hiring.view3.json']) {
    it(n, () => {
      const v = read(n)
      useViewStore.setState({ view: v })
      const { container } = render(<ViewConversation chat={v.chat} />)
      expect(v.chat.some((t) => citesOf(t).length > 0)).toBe(true)
      v.chat.forEach((t, i) => {
        // Each reply by its own turn (`data-view-turn`), never by its place on screen.
        const reply = container.querySelector<HTMLElement>(`[data-view-turn="chat.${i}"] [data-testid="view-chat-answer"]`)
        if (t.answer === null) { expect(reply).toBeNull(); return }
        const marks = [...reply!.querySelectorAll<HTMLElement>('[data-view-cite]')]
        expect(marks.map((m) => [m.textContent, m.getAttribute('title'), m.getAttribute('aria-label')]), String(t.id)).toEqual(citesOf(t).map((c, k) => [String(k + 1), c, c]))
      })
    })
  }
})
