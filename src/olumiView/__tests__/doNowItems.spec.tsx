/**
 * Paul's "do now" screen items (11 Nov, ranked by the DL): S1, X1 and G3 (B1 is in wholeView.spec, beside the overview rule it changes).
 * Bound by identity on core's own Views: each row by its id, each word at its View path, each mark by the card it is about.
 * - S1: core's give words end on the ✎ ("Give your figure with ✎"); the UI adds no full stop after it.
 * - X1: on the lane a closed focus row says its whole title (core's words), never cut to one line (the off-lane contrast row is
 *   focus-now/__tests__/wholeOnTheLane.spec.tsx, where the focus-now module may be imported).
 * - G3: zoomed out, the Rests on number is drawn beside the far line (the one line the zoomed-out card keeps), not only in the blanked body.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { ReactFlowProvider, type NodeProps } from '@xyflow/react'

vi.mock('@xyflow/react', async () => ({ ...(await vi.importActual<object>('@xyflow/react')), Handle: () => null }))

import type { View } from '../client'
import { useViewStore } from '../store'
import { useMe } from '../../olumiCore/me'
import { useViewLens } from '../lens'
import { restsOnOf } from '../layout'
import { useCanvasStore } from '../../canvas/store'
import { CoreCard, farLineOf } from '../previous/CoreCard'
import { PortAnalysisTab } from '../port/PortAnalysisTab'
import { viewOf } from '../port/__tests__/viewAt'

const ready = (view: View) => {
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: view.id, view, status: 'ready', error: null, stale: false, at: null } as never)
  useMe.setState({ me: { id: view.you_id, name: view.you }, status: 'ready' })
}
afterEach(() => {
  cleanup(); useViewLens.setState({ lens: 'full' }); useCanvasStore.setState({ lodRung: 'full' } as never)
  useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none' } as never); useMe.setState({ me: null, status: 'none' })
})

describe('S1: no stop of the UI\'s after the ✎', () => {
  it('each figure a share rests on says core\'s give words and then the ✎, and nothing after it (bakery golden)', () => {
    const view = viewOf('golden/bakery'), aims = view.model!.run!.find_out!
    ready(view); render(<PortAnalysisTab />)
    const figs = aims.flatMap((a) => a.figures).filter((f) => f.give !== null)
    expect(figs.length, 'precondition: core offers a give').toBeGreaterThan(0)
    for (const f of figs) {
      const give = document.querySelector<HTMLElement>(`[data-find-out-give="${f.id}"] [data-testid="worth-give-${f.id}"]`)!
      expect(give.textContent, f.id).toBe(`${f.give!.text} ✎`)
    }
  })
})

describe('X1: a closed row on the lane says its whole title', () => {
  const longest = (view: View) => view.model!.run!.waits_on!.items.filter((it) => it.text !== '').map((it) => it.id)
  it('Focus now\'s waits-on rows and Strengthen\'s rows draw their title with no one-line clamp, at rest (A10 workshop, served)', () => {
    const view = viewOf('core/ui9-a10-workshop')
    ready(view); render(<PortAnalysisTab />)
    const ids = longest(view)
    expect(ids.length, 'precondition: core names figures the chances wait on').toBeGreaterThan(0)
    const titles = [...document.querySelectorAll<HTMLElement>('[data-testid="port-focus-now"] [data-testid="focus-card"], [data-testid="port-strengthen"] [data-testid="focus-card"]')]
      .map((card) => within(card).getAllByRole('button')[0]!.querySelector<HTMLElement>('span[id]')!)
    expect(titles.length).toBeGreaterThanOrEqual(ids.length)
    for (const t of titles) expect([t.textContent, t.style.webkitLineClamp, t.style.overflow]).toEqual([t.textContent, '', ''])
  })
})

describe('G3: the Rests on number at every zoom', () => {
  const Node = CoreCard as unknown as (p: NodeProps) => JSX.Element
  const props = (id: string, card: unknown): NodeProps => ({ id, type: 'viewCard', data: { card }, selected: false, dragging: false, zIndex: 0, isConnectable: false,
    positionAbsoluteX: 0, positionAbsoluteY: 0, selectable: true, deletable: false, draggable: false } as unknown as NodeProps)
  const restsCard = (m: NonNullable<View['model']>) => {
    // A card the lens marks that has a far line (the zoomed-out face blanks the body only where one stands in for it).
    const { items } = restsOnOf(m)
    return [...items.entries()].find(([id]) => { const c = m.cards.find((x) => x.id === id); return c !== undefined && farLineOf(c) !== null })!
  }
  it('with the Rests on lens on, at the far rung, the number is drawn in the far line (which stays visible), beside core\'s line (A6 journey, served)', () => {
    const view = viewOf('core/ui9-a6-since-v3'), m = view.model!, [id, item] = restsCard(m)
    ready(view); useViewLens.setState({ lens: 'rests_on' }); useCanvasStore.setState({ lodRung: 'line' } as never)
    render(<ReactFlowProvider><Node {...props(id, m.cards.find((c) => c.id === id))} /></ReactFlowProvider>)
    const line = screen.getByTestId('node-lod-line'), far = line.querySelector<HTMLElement>('[data-rests-on-far]')!
    expect([far.getAttribute('data-rests-on'), far.textContent]).toEqual([String(item.n), String(item.n)])
    expect(line.style.visibility).toBe('visible')
    expect(within(line).getByTestId('node-lod-line-text').textContent).toBe(farLineOf(m.cards.find((c) => c.id === id)!))
    // The body's own number is inside the blanked body (hidden with it); the far one is the one that shows.
    expect(document.querySelector('[data-lod-hidden]')!.contains(far)).toBe(true)
  })
  it('CONTRAST: at full zoom no far line and no far number; the number is in the body as before', () => {
    const view = viewOf('core/ui9-a6-since-v3'), m = view.model!, [id, item] = restsCard(m)
    ready(view); useViewLens.setState({ lens: 'rests_on' })
    render(<ReactFlowProvider><Node {...props(id, m.cards.find((c) => c.id === id))} /></ReactFlowProvider>)
    expect([screen.queryByTestId('node-lod-line'), document.querySelector('[data-rests-on-far]')]).toEqual([null, null])
    expect(document.querySelector(`[data-core-card="${id}"] [data-rests-on="${item.n}"]`)).not.toBeNull()
  })
  it('CONTRAST: off the lens there is no number', () => {
    const view = viewOf('core/ui9-a6-since-v3'), m = view.model!, [id] = [...restsOnOf(m).items.keys()]
    ready(view); useCanvasStore.setState({ lodRung: 'line' } as never)
    render(<ReactFlowProvider><Node {...props(id!, m.cards.find((c) => c.id === id))} /></ReactFlowProvider>)
    expect(document.querySelector('[data-rests-on]')).toBeNull()
  })
})
