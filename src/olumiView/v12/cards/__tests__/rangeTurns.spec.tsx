/**
 * Core d4729b77 (science): the worth-checking code olumi_range_turns, on the card core measured it on (golden pricing.view3.json, card
 * cups_change), at both levels. Detailed used to draw no worth-checking mark at all, so a switch to Detailed dropped Olumi's observation.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('../../../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: {} }))
vi.mock('@xyflow/react', async () => ({ ...(await vi.importActual<object>('@xyflow/react')), Handle: () => null }))
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { ReactFlowProvider, type NodeProps } from '@xyflow/react'
import type { View, ViewCard } from '../../../client'
import { useViewStore } from '../../../store'
import { useMe } from '../../../../olumiCore/me'
import { CoreCard } from '../../../previous/CoreCard'
import { setDefaultLevel, useSimpleLevel, type Level } from '../../simpleStore'
import { cardMarksOf, worthCheckingOf } from '../marks'

const load = (f: string) => JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures', f), 'utf8')) as View
const PRICING = load('core-d4729b77/pricing.view3.json')
const cardOf = (v: View, id: string): ViewCard => v.model!.cards.find((c) => c.id === id)!
const Node = CoreCard as unknown as (p: NodeProps) => JSX.Element
const draw = (view: View, id: string, level: Level = 'working'): HTMLElement => {
  setDefaultLevel(level)
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: view.id, view, status: 'ready', error: null, stale: false, at: null } as never)
  useMe.setState({ me: { id: view.you_id, name: view.you }, status: 'ready' })
  return render(<ReactFlowProvider><Node {...({ id, type: 'viewCard', data: { card: cardOf(view, id) }, selected: false, dragging: false, zIndex: 0, isConnectable: false,
    positionAbsoluteX: 0, positionAbsoluteY: 0, selectable: true, deletable: false, draggable: false } as unknown as NodeProps)} /></ReactFlowProvider>).container
}
beforeEach(() => { window.localStorage.clear(); useSimpleLevel.setState({ levels: {} }) })
afterEach(() => { cleanup(); setDefaultLevel('simple'); useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none' } as never); useMe.setState({ me: null, status: 'none' }) })

describe('core d4729b77: "Where the result turns in Olumi\'s range" is drawn on its card in core\'s words', () => {
  const card = cardOf(PRICING, 'cups_change')
  const item = (card.worth_checking ?? []).find((w) => (w.code as string) === 'olumi_range_turns')!
  it('RT1 the golden card carries the entry, and the page keeps it with core\'s title and sentence', () => {
    expect([item?.olumi, item?.title]).toEqual([true, 'Where the result turns in Olumi’s range'])
    expect(worthCheckingOf(card).find((w) => (w.code as string) === 'olumi_range_turns')).toEqual({ code: 'olumi_range_turns', title: item.title, text: item.text })
  })
  it('RT2 at both levels the card draws ONE worth-checking mark per distinct code (C3), and the olumi_range_turns mark is named by the entry\'s title and sentence exactly', () => {
    const codes = [...new Set((card.worth_checking ?? []).map((w) => w.code as string))]
    for (const level of ['simple', 'working'] as const) {
      const el = draw(PRICING, 'cups_change', level)
      // The Simple foot folds marks past three behind "+N": a press draws them all.
      const more = el.querySelector<HTMLElement>('[data-card-more]'); if (more !== null) fireEvent.click(more)
      const marks = [...el.querySelectorAll<HTMLElement>('[data-card-mark="worth-checking"]')]
      const turns = marks.find((m) => m.getAttribute('data-worth-code') === 'olumi_range_turns')
      const name = (turns?.getAttribute('aria-label') ? turns : turns?.querySelector<HTMLElement>('[aria-label]'))?.getAttribute('aria-label') ?? ''
      expect([level, marks.length, name.includes(`${item.title}\n${item.text}`)]).toEqual([level, codes.length, true])
      expect(cardMarksOf(card).find((m) => m.code === 'olumi_range_turns')!.words).toContain(item.text)
      cleanup()
    }
  })
  it('RT3 CONTRAST: the same card with no worth_checking draws no worth-checking mark at either level', () => {
    const bare = { ...PRICING, model: { ...PRICING.model!, cards: PRICING.model!.cards.map((c) => (c.id === 'cups_change' ? { ...c, worth_checking: undefined } : c)) } } as View
    for (const level of ['simple', 'working'] as const) {
      expect([level, draw(bare, 'cups_change', level).querySelectorAll('[data-card-mark="worth-checking"]').length]).toEqual([level, 0])
      cleanup()
    }
  })
})
