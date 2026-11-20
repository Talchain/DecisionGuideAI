/**
 * Core d903f2af's `chat[].receipt` (K1/K6): why code filled nothing in from a person's answer. Core serves it on the answerer's own turn only, in its own words;
 * the UI draws those words verbatim as one quiet line under that person's message, after their words and before Olumi's reply. Nothing is drawn without it.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, render } from '@testing-library/react'
import type { View } from '../../../client'
import { useViewStore } from '../../../store'
import { ViewChat } from '../../../ViewChat'

type Receipt = NonNullable<View['chat'][number]['receipt']>
const base = (): View => JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/session/after-find-first.view3.json'), 'utf8'))
const q = (c: ParentNode, id: string) => c.querySelector<HTMLElement>(`[data-testid="${id}"]`)
const mount = (r: Receipt | undefined) => {
  const view = base()
  const last = view.chat[view.chat.length - 1]!
  if (r === undefined) delete last.receipt; else last.receipt = r
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: view.id, view, status: 'ready', error: null, stale: false, at: null })
  const c = render(<ViewChat />).container
  return { latest: q(c, 'view-chat-latest')!, at: `chat.${view.chat.length - 1}` }
}
afterEach(() => { cleanup(); useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none', error: null, at: null }) })

// Core's words for one reason (words/answers.ts RECEIPT_WORDS.stale at d903f2af), passed through as data: the UI holds no copy.
const STALE: Receipt = { why: 'stale', words: 'Olumi asked this on an earlier version of the model, so your answer was kept as a message and nothing was filled in from it.' }

describe('chat[].receipt', () => {
  it('one quiet line with core\'s words verbatim, under the person\'s own words and before the reply', () => {
    const { latest } = mount(STALE)
    const lines = latest.querySelectorAll('[data-testid="view-receipt"]')
    expect(lines).toHaveLength(1)
    const line = lines[0] as HTMLElement
    expect([line.textContent, line.getAttribute('data-receipt'), line.className.includes('ok-quiet'), line.hasAttribute('title')]).toEqual([STALE.words, 'stale', true, false])
    const said = latest.querySelector('[data-view$=".said"]')!, answer = q(latest, 'view-chat-answer')
    expect(said.compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    if (answer !== null) expect(line.compareDocumentPosition(answer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
  it('nothing is drawn where core sends no receipt (another reader\'s View of the same turn, or a bound answer)', () => {
    expect(q(mount(undefined).latest, 'view-receipt')).toBeNull()
  })
})
