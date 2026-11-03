/**
 * G6: Olumi's next step beside the one card core names (`chat[].answer.next.at`), in core's words, only for the newest reply, never a
 * card this page picks. Core's golden (wip/v3.1-one 8d25761) with the newest reply's `at` set by hand to one of its cards.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, renderHook } from '@testing-library/react'
import type { View } from '../client'
import { useCanvasStore } from '../../canvas/store'
import { requestOlumiAttention } from '../../canvas/utils/olumiAttention'
import { useMe } from '../../olumiCore/me'
import { useViewStore } from '../store'
import { useViewCanvas } from '../canvas'
import { nextNoteOf, useViewNote } from '../note'

vi.mock('../../canvas/nodes/shared/savedGraph', () => ({ useSavedGraphRead: () => ({ status: 'none' }), useSavedGraph: () => null }))

const golden = (): View => JSON.parse(readFileSync(path.resolve('src/olumiView/golden', 'proposal.view.json'), 'utf8'))
/** The golden with its newest reply's next step put beside `at` (null: beside no card). */
const at = (card: string | null, v = golden()): View => ({ ...v, chat: v.chat.map((t) => (t.answer?.next.newest ? { ...t, answer: { ...t.answer, next: { ...t.answer.next, at: card } } } : t)) })
const held = () => useCanvasStore.getState().olumiAttention
const hooks = () => renderHook(() => { useViewCanvas(true); useViewNote(true) })

beforeEach(() => { useCanvasStore.setState({ nodes: [], edges: [], olumiAttention: null } as never); useMe.setState({ me: null, status: 'none' }) })
afterEach(() => useViewStore.setState({ uuid: null, sid: null, view: null, error: null, status: 'none' }))

describe('Olumi\'s next step on the canvas', () => {
  it('is drawn beside the card core names, its label and text as core says them', () => {
    const v = golden(), card = v.model!.cards[1]!.id
    act(() => useViewStore.setState({ view: at(card, v), status: 'ready' }))
    hooks()
    const newest = v.chat.find((t) => t.answer?.next.newest)!.answer!.next
    expect(held()?.nodeIds).toEqual([card])
    expect(held()?.note).toEqual({ title: newest.label, body: 'What would confirm the start date?' })
  })

  it('core names no card: no note at all, never one beside a card this page picks', () => {
    const v = golden()
    expect(v.chat.find((t) => t.answer?.next.newest)!.answer!.next.about).toEqual([])
    act(() => useViewStore.setState({ view: at(null, v), status: 'ready' }))
    hooks()
    expect(held()).toBeNull()
    expect(nextNoteOf(at(null, v))).toBeNull()
  })

  it('only the newest reply\'s step: an older reply that named a card draws nothing', () => {
    const v = golden(), card = v.model!.cards[0]!.id
    const older = { ...v, chat: v.chat.map((t) => (t.answer && !t.answer.next.newest ? { ...t, answer: { ...t.answer, next: { ...t.answer.next, at: card } } } : t)) }
    expect(nextNoteOf(older)).toBeNull()
  })

  it('dismissed, it stays dismissed when the same View is read again; a newer reply with no card takes the last note away', () => {
    const v = golden(), card = v.model!.cards[1]!.id
    act(() => useViewStore.setState({ view: at(card, v), status: 'ready' }))
    const { rerender } = hooks()
    act(() => useCanvasStore.getState().clearOlumiAttention?.())
    act(() => useViewStore.setState({ view: at(card, golden()) }))
    rerender()
    expect(held()).toBeNull()
    // Read away and back (the canvas withdrawn and drawn again): the same reply's step is not drawn a second time.
    act(() => useViewStore.setState({ view: null }))
    rerender()
    act(() => useViewStore.setState({ view: at(card, golden()) }))
    rerender()
    expect(useCanvasStore.getState().nodes.some((n) => n.id === card)).toBe(true)
    expect(held()).toBeNull()

    act(() => useViewStore.setState({ view: { ...at(card, v), id: 's_aaaaaaaaaaaa' } }))
    rerender()
    expect(held()?.nodeIds).toEqual([card])
    const newer = at(null, v)
    act(() => useViewStore.setState({ view: { ...newer, id: 's_aaaaaaaaaaaa', chat: newer.chat.map((t) => ({ ...t, id: t.id + 100 })) } }))
    rerender()
    expect(held()).toBeNull()
  })

  it('a note another surface asked for is left alone, even when a newer reply names no card', () => {
    const v = golden(), card = v.model!.cards[0]!.id
    act(() => useViewStore.setState({ view: at(card, v), status: 'ready' }))
    const { rerender } = hooks()
    expect(held()?.nodeIds).toEqual([card])
    act(() => { requestOlumiAttention({ nodeIds: [card], note: { body: 'A coaching icon\'s note.' }, turnId: 'icon' }) })
    const newer = at(null, v)
    act(() => useViewStore.setState({ view: { ...newer, chat: newer.chat.map((t) => ({ ...t, id: t.id + 100 })) } }))
    rerender()
    expect(held()?.note?.body).toBe('A coaching icon\'s note.')
  })

  it('a View for someone else draws no note', () => {
    const v = golden(), card = v.model!.cards[1]!.id
    useMe.setState({ me: { id: 'p_other', name: 'X' }, status: 'ready' })
    act(() => useViewStore.setState({ view: at(card, v), status: 'ready' }))
    hooks()
    expect(held()).toBeNull()
  })
})
