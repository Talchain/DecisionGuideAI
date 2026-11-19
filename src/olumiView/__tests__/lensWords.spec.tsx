/**
 * Experience review job 3 ("two lenses draw marks with no words"): on the card the lane mounts (CoreCard, ViewCanvas `nodeTypes`), each lens mark says
 * what it marks in core's own lens words (`lens_words`, N3), never a UI sentence about the model. Rests on: the number reads core's label with it, core's
 * hint on hover (Olumi's keeps core's mark as its hover). What would change: the ringed figure carries core's label in its corner, the options' driver
 * words on hover. A View without lens words keeps the bare marks. Bound by identity: each mark by its card id, each word by its View path.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { ReactFlowProvider, type NodeProps } from '@xyflow/react'

vi.mock('@xyflow/react', async () => ({ ...(await vi.importActual<object>('@xyflow/react')), Handle: () => null }))

import type { View } from '../client'
import { useViewStore } from '../store'
import { useMe } from '../../olumiCore/me'
import { useViewLens, type ViewLens } from '../lens'
import { driversOf, restsOnOf } from '../layout'
import { useCanvasStore } from '../../canvas/store'
import { CoreCard } from '../previous/CoreCard'
import { viewOf } from '../port/__tests__/viewAt'

const Node = CoreCard as unknown as (p: NodeProps) => JSX.Element
const props = (id: string, card: unknown): NodeProps => ({ id, type: 'viewCard', data: { card }, selected: false, dragging: false, zIndex: 0, isConnectable: false,
  positionAbsoluteX: 0, positionAbsoluteY: 0, selectable: true, deletable: false, draggable: false } as unknown as NodeProps)
const show = (view: View, lens: ViewLens, id: string) => {
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: view.id, view, status: 'ready', error: null, stale: false, at: null } as never)
  useMe.setState({ me: { id: view.you_id, name: view.you }, status: 'ready' })
  useViewLens.setState({ lens })
  render(<ReactFlowProvider><Node {...props(id, view.model!.cards.find((c) => c.id === id))} /></ReactFlowProvider>)
}
const bare = (v: View): View => ({ ...v, lens_words: undefined } as unknown as View)
afterEach(() => {
  cleanup(); useViewLens.setState({ lens: 'full' }); useCanvasStore.setState({ lodRung: 'full' } as never)
  useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none' } as never); useMe.setState({ me: null, status: 'none' })
})

describe('the lens marks say what they mark, on the mounted card (CoreCard)', () => {
  const view = viewOf('golden/european'), m = view.model!, W = view.lens_words!
  it('Rests on: the number reads core\'s label with it, core\'s hint on hover; Olumi\'s keeps core\'s mark as its hover. CONTRAST: no lens words, the bare number', () => {
    const { items } = restsOnOf(m)
    const mine = [...items.values()].find((i) => !i.olumi)!, olumis = [...items.values()].find((i) => i.olumi)!
    show(view, 'rests_on', mine.id)
    const a = document.querySelector<HTMLElement>(`[data-core-card="${mine.id}"] [data-rests-on]`)!
    expect([a.textContent, a.title, a.dataset['viewWords']]).toEqual([`${W.label.rests_on} ${mine.n}`, W.hint.rests_on, 'lens_words.label.rests_on'])
    cleanup()
    show(view, 'rests_on', olumis.id)
    const b = document.querySelector<HTMLElement>(`[data-core-card="${olumis.id}"] [data-rests-on]`)!
    expect([b.textContent, b.title]).toEqual([`${W.label.rests_on} ${olumis.n}`, m.cards.find((c) => c.id === olumis.id)!.olumi!.title])
    cleanup()
    show(bare(view), 'rests_on', mine.id)
    const c = document.querySelector<HTMLElement>(`[data-core-card="${mine.id}"] [data-rests-on]`)!
    expect([c.textContent, c.dataset['viewWords']]).toEqual([String(mine.n), undefined])
  })

  it('What would change: the ringed figure carries core\'s label, the options\' driver words on hover. CONTRAST: off the lens, or no lens words, no label', () => {
    const [[id, options]] = [...driversOf(m)]
    expect(id, 'precondition: core names a driver figure drawn as a card').toBeTruthy()
    show(view, 'what_changes', id!)
    const mark = document.querySelector<HTMLElement>(`[data-driver-mark="${id}"]`)
    expect([mark?.textContent, mark?.dataset['viewWords'], mark?.title]).toEqual([W.label.what_changes, 'lens_words.label.what_changes', options!.map((o) => o.driver!.title).join('\n')])
    expect(document.querySelector(`[data-core-card="${id}"]`)?.hasAttribute('data-driver-of')).toBe(true)
    cleanup()
    show(view, 'full', id!)
    expect(document.querySelector('[data-driver-mark]')).toBeNull()
    cleanup()
    show(bare(view), 'what_changes', id!)
    expect(document.querySelector('[data-driver-mark]')).toBeNull()
  })
})
