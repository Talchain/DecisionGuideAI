/**
 * Compare's version diff on the cards the served canvas draws (BaseNode; the live check on URL 2 found ViewCardNode is not drawn there).
 * BaseNode is shared with the older look, so the mark must draw NOTHING unless a version compare is open and core's change line names this
 * card: bound on BaseNode itself, by the card's own id (harness as BaseNode.gap17NoDashedFactorFrame.spec.tsx).
 */
import { cleanup, render } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { Circle } from 'lucide-react'
import { afterEach, describe, expect, it } from 'vitest'
import { BaseNode } from '../BaseNode'
import { useCanvasStore } from '../../store'
import { useViewStore } from '../../../olumiView/store'
import { changedSince, useCompareMarks } from '../../../olumiCore/compareMarks'

function renderFactorCard(id: string, label: string) {
  const props = { id, type: 'factor', position: { x: 0, y: 0 }, selected: false, isConnectable: true, positionAbsoluteX: 0, positionAbsoluteY: 0,
    dragging: false, zIndex: 0, data: { type: 'factor', label } }
  useCanvasStore.setState({ nodes: [props] as never, edges: [], highlightedNodes: new Set<string>(), dimmedNodeIds: new Set<string>() })
  return render(<ReactFlowProvider><BaseNode {...(props as any)} nodeType="factor" icon={Circle} /></ReactFlowProvider>)
}
const marks = (c: HTMLElement) => [...c.querySelectorAll('[data-compare-mark]')].map((e) => [e.getAttribute('data-compare-mark'), e.textContent])

afterEach(() => { cleanup(); useCompareMarks.getState().clear(); useViewStore.setState({ sid: null, view: null } as never) })

describe('Compare\'s "Changed since version N" on BaseNode', () => {
  it('no version compare open (the older look, or Compare closed): the card draws no mark at all', () => {
    useViewStore.setState({ sid: 's_000000000001', view: { id: 's_000000000001', version: { n: 3 } } } as never)
    const { container } = renderFactorCard('fig_hire', 'Hall hire')
    expect(container.querySelector('[role="group"]'), 'control: the card itself is drawn').not.toBeNull()
    expect(marks(container)).toEqual([])
  })
  it('CONTRAST: a compare of version 1 with 3 whose change line names this card draws the mark on it; another card in the same compare does not', () => {
    useViewStore.setState({ sid: 's_000000000001', view: { id: 's_000000000001', version: { n: 3 } } } as never)
    useCompareMarks.getState().show({ sid: 's_000000000001', from: 1, to: 3, byId: { fig_hire: [{ text: '↻ figure: Hall hire', detail: 'figure £600 → £550' }] } })
    const named = renderFactorCard('fig_hire', 'Hall hire')
    expect(marks(named.container)).toEqual([['fig_hire', changedSince(1)]])
    named.unmount()
    expect(marks(renderFactorCard('donations', 'Donations a month').container)).toEqual([])
  })
  it('the mark sits inside the card\'s bottom band (which BaseNode insets clear of the action rail) as ONE line that truncates; it never wraps, so the band cannot grow over the card', () => {
    useViewStore.setState({ sid: 's_000000000001', view: { id: 's_000000000001', version: { n: 3 } } } as never)
    useCompareMarks.getState().show({ sid: 's_000000000001', from: 1, to: 3, byId: { fig_hire: [{ text: '↻ figure: Hall hire', detail: 'figure £600 → £550' }] } })
    const { container } = renderFactorCard('fig_hire', 'Hall hire')
    const chip = container.querySelector<HTMLElement>('[data-compare-mark]')!
    const band = chip.closest<HTMLElement>('[data-card-bottom-band]')
    expect(band, 'drawn in the band, not loose on the card').not.toBeNull()
    expect(band!.style.right, 'the band stops short of the rail').toMatch(/calc\(/)
    expect(chip.className).toMatch(/\bmax-w-full\b/)
    expect(chip.className).not.toMatch(/whitespace-normal|flex-wrap/)
    const words = [...chip.children].find((e) => e.textContent === changedSince(1))!
    expect(words.className, 'the words truncate on one line').toMatch(/\btruncate\b/)
    expect(chip.className, 'a pill, as on every other mark').toMatch(/\brounded-full\b/)
  })
})
