/**
 * OLUMI'S EARLY ANSWER (shared contract, 14 Nov): `view.draft.early` on the drafting board (while it builds and after it failed) and
 * `view.chat[i].early` above the model-grounded reply, each `{ text }`, under the label below. Real mounted components, no fetch.
 * Rows bind by identity: the exact label, the exact paragraph and list-item words, DOM order against the reply, and the absence of the
 * early block on every other turn and wherever the field is absent.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, render } from '@testing-library/react'
vi.mock('../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: {} }))
import type { View } from '../client'
import { useViewStore } from '../store'
import { ViewChat } from '../ViewChat'
import { DraftingBoard } from '../DraftingBoard'
import { EARLY_FAILED, EARLY_LABEL } from '../early'

const golden = (n: string): View => JSON.parse(readFileSync(path.resolve('src/olumiView/golden', `${n}.view.json`), 'utf8'))
const TEXT = 'A month is tight for a raise.\n\nLenders usually want:\n- two years of accounts\n- a clear use of funds\n\nStart with the shortest route.'
const AT = '2026-11-14T08:00:00.000Z'
const drafting = (status: 'drafting' | 'failed', early?: { text: string }): View => ({ ...golden('pricing'), version: null, proposal: null, model: null, chat: [],
  draft: { status, reason: null, at: AT, job: 7, stage: 'building', started: AT, words: status === 'drafting' ? 'Building the model' : 'Olumi could not finish this turn.', ...(early ? { early } : {}) } } as unknown as View)
const show = (view: View, ui: JSX.Element) => { useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: view.id, view, status: 'ready', error: null, stale: false, at: null }); return render(ui).container }
afterEach(() => { cleanup(); useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none', error: null, stale: false, at: null }) })

describe('the early answer on the drafting board', () => {
  it('while the model builds: the label, the paragraphs and the list items as such, beside core\'s words; no failure line, no Try again', () => {
    const c = show(drafting('drafting', { text: TEXT }), <DraftingBoard />)
    expect(c.querySelector('[data-testid="view-drafting-early-label"]')?.textContent).toBe(EARLY_LABEL)
    expect(c.querySelector('[data-view="draft.words"]')?.textContent).toBe('Building the model')
    const body = c.querySelector('[data-testid="view-drafting-early-text"]')!
    expect([...body.querySelectorAll('[data-reply-para]')].map((p) => p.textContent)).toEqual(['A month is tight for a raise.', 'Lenders usually want:', 'Start with the shortest route.'])
    expect([...body.querySelectorAll('[data-reply-list] li')].map((l) => l.textContent)).toEqual(['two years of accounts', 'a clear use of funds'])
    expect(c.querySelector('[data-testid="view-drafting-early-failed"]')).toBeNull()
    expect(c.querySelector('[data-testid="view-drafting-again"]')).toBeNull()
  })
  it('after a failed build: the answer stays, a plain line says the model could not be built, and Try again is offered', () => {
    const c = show(drafting('failed', { text: TEXT }), <DraftingBoard />)
    expect(c.querySelector('[data-testid="view-drafting-early-label"]')?.textContent).toBe(EARLY_LABEL)
    expect(c.querySelector('[data-testid="view-drafting-early-failed"]')?.textContent).toBe(EARLY_FAILED)
    expect(c.querySelector('[data-testid="view-drafting-again"]')).not.toBeNull()
  })
  it('contrast: without the field, today\'s board: core\'s words and Try again only', () => {
    const c = show(drafting('failed'), <DraftingBoard />)
    expect(c.querySelector('[data-testid="view-drafting-early"]')).toBeNull()
    expect(c.querySelector('[data-testid="view-drafting-early-failed"]')).toBeNull()
    expect(c.querySelector('[data-view="draft.words"]')?.textContent).toBe('Olumi could not finish this turn.')
    expect(c.querySelector('[data-testid="view-drafting-again"]')).not.toBeNull()
  })
})

describe('the early answer on a chat turn', () => {
  it('sits above the model-grounded reply of ITS turn only, under the label; the other turns and a View without the field draw none', () => {
    const base = golden('whatif'), i = base.chat.findIndex((t) => t.answer !== null)
    expect(i).toBeGreaterThanOrEqual(0)
    const withEarly = { ...base, chat: base.chat.map((t, j) => (j === i ? { ...t, early: { text: TEXT } } : t)) } as unknown as View
    const c = show(withEarly, <ViewChat />)
    const turns = [...c.querySelectorAll('[data-view-turn]')]
    const mine = turns.find((t) => t.getAttribute('data-view-turn') === `chat.${i}`)!
    expect(turns.filter((t) => t.querySelector('[data-testid="view-chat-early"]') !== null)).toEqual([mine])
    expect(mine.querySelector('[data-testid="view-chat-early-label"]')?.textContent).toBe(EARLY_LABEL)
    expect([...mine.querySelectorAll('[data-testid="view-chat-early-text"] [data-reply-list] li')].map((l) => l.textContent)).toEqual(['two years of accounts', 'a clear use of funds'])
    const early = mine.querySelector('[data-testid="view-chat-early"]')!, answer = mine.querySelector('[data-testid="view-chat-answer"]')!
    expect(early.compareDocumentPosition(answer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    cleanup()
    const plain = show(base, <ViewChat />)
    expect(plain.querySelector('[data-testid="view-chat-early"]')).toBeNull()
  })
})
