/**
 * Paul's "do now" screen items (11 Nov, ranked by the DL): S1, X1 and G3 (B1 is in wholeView.spec, beside the overview rule it changes).
 * Bound by identity on core's own Views: each row by its id, each word at its View path, each mark by the card it is about.
 * - S1: core's give words end on the ✎ ("Give your figure with ✎"); the UI adds no full stop after it.
 * - X1 (retired with the Analysis redesign, 18 Nov: Focus now and Strengthen are gone; core's rows are drawn whole in port/ResultNeeds).
 * - G3: zoomed out, the Rests on number is drawn beside the far line (the one line the zoomed-out card keeps), not only in the blanked body.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { ReactFlowProvider, type NodeProps } from '@xyflow/react'

vi.mock('@xyflow/react', async () => ({ ...(await vi.importActual<object>('@xyflow/react')), Handle: () => null }))

import type { View } from '../client'
import { useViewStore } from '../store'
import { useMe } from '../../olumiCore/me'
import { useViewLens } from '../lens'
import { restsOnOf } from '../layout'
import { useCanvasStore } from '../../canvas/store'
import { CoreCard } from '../previous/CoreCard'
import { ViewReasoningBlock } from '../ViewReasoning'
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
  it('each ranked figure in Check says Core’s give words and then the pencil (bakery golden)', () => {
    const view = viewOf('golden/bakery'), aims = view.model!.run!.find_out!
    ready(view); render(<ViewReasoningBlock />)
    const find = document.querySelector<HTMLElement>('[data-check-group="find"]')!
    const toggle = find.querySelector('[data-check-more="find"]')
    if (toggle !== null) fireEvent.click(toggle)
    const figs = aims.flatMap((aim, a) => aim.figures.map((figure) => ({ figure, a }))).filter(({ figure }) => figure.give !== null)
    expect(figs.length, 'precondition: Core offers a give').toBeGreaterThan(0)
    for (const { figure: f, a } of figs) {
      fireEvent.click(find.querySelector(`[data-check-item="f:${a}:${f.id}"]`)!)
      const give = within(find).getByTestId(`check-give-${f.id}`)
      expect(give.textContent, f.id).toBe(`${f.give!.text} `)
      expect(give.querySelector('[data-icon="edit"]'), f.id).not.toBeNull()
      expect(give.lastElementChild, f.id).toBe(within(give).getByTestId(`check-edit-${f.id}`))
    }
  })
})

describe('G3: the Rests on number at every zoom', () => {
  const Node = CoreCard as unknown as (p: NodeProps) => JSX.Element
  const props = (id: string, card: unknown): NodeProps => ({ id, type: 'viewCard', data: { card }, selected: false, dragging: false, zIndex: 0, isConnectable: false,
    positionAbsoluteX: 0, positionAbsoluteY: 0, selectable: true, deletable: false, draggable: false } as unknown as NodeProps)
  const restsCard = (m: NonNullable<View['model']>) => {
    return [...restsOnOf(m).items.entries()][0]!
  }
  it('keeps the Rests on number visible at far zoom without restoring the old sentence', () => {
    const view = viewOf('core/ui9-a6-since-v3'), m = view.model!, [id, item] = restsCard(m)
    ready(view); useViewLens.setState({ lens: 'rests_on' }); useCanvasStore.setState({ lodRung: 'line' } as never)
    render(<ReactFlowProvider><Node {...props(id, m.cards.find((c) => c.id === id))} /></ReactFlowProvider>)
    const line = screen.getByTestId('node-lod-line'), far = line.querySelector<HTMLElement>('[data-rests-on-far]')!
    expect([far.getAttribute('data-rests-on'), far.textContent]).toEqual([String(item.n), String(item.n)])
    expect(line.style.visibility).toBe('visible')
    expect(line.querySelector('[data-testid="node-lod-line-text"]')).toBeNull()
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
