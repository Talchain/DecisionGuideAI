import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { Node } from '@xyflow/react'

// Real Zustand subscriptions; no manually forced rerender after the update.
vi.mock('../../../../canvas/store', async () => {
  const { create } = await import('zustand')
  return { useCanvasStore: create<{
    nodes: Node[]; highlightedNodes: string[]; setHighlightedNodes: (ids: string[]) => void
  }>((set) => ({ nodes: [], highlightedNodes: [], setHighlightedNodes: (ids) => set({ highlightedNodes: ids }) })) }
})
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: () => true }))
vi.mock('../../../../canvas/utils/highlightHelpers', () => ({ highlightNode: vi.fn(), clearHighlight: vi.fn() }))
vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/ToastContext', () => ({ useShowToastSafe: () => vi.fn() }))
vi.mock('../../../../canvas/hooks/useModelEditAuthority', () => ({
  useModelEditAuthority: () => ({ proposeFactorValue: vi.fn(), proposeOptionIntervention: vi.fn(), proposeFactorConfirmation: vi.fn() }),
}))

import { useCanvasStore } from '../../../../canvas/store'
import { ModelStrip } from '../sections/ModelStrip'
import { buildModelStrip } from '../buildModelStrip'
import { toModelRows } from '../../../../canvas/model-tab-v2/adapters'
import { ModelOutline } from '../../../../canvas/model-tab-v2/ModelOutline'

const TID = 'analysis-new-model-strip'
const node = (id: string, data: Record<string, unknown> = {}): Node => ({ id, type: 'factor', position: { x: 0, y: 0 }, data: { label: id, ...data } })
const marks = () => screen.queryAllByTestId(`${TID}-mark`).map((e) => e.getAttribute('data-node-id')).sort()
beforeEach(() => { useCanvasStore.setState({ nodes: [node('f_a'), node('f_b')], highlightedNodes: [] }) })
afterEach(cleanup)
function openWorklist() {
  render(<ModelStrip isPreRun={true} />)
  expect(screen.getByTestId(`${TID}-no-value-toggle`)).toHaveTextContent('2 with no value yet')
  fireEvent.click(screen.getByTestId(`${TID}-no-value-toggle`))
  expect(marks()).toEqual(['f_a', 'f_b'])
  expect(useCanvasStore.getState().highlightedNodes).toEqual(['f_a', 'f_b'])
}
describe('independent #1291 live population', () => {
  it('top-level display estimate arriving retires exactly that factor from the mounted worklist', () => {
    openWorklist()
    act(() => useCanvasStore.setState({ nodes: [node('f_a', { display_value: '0.25 to 0.75' }), node('f_b')] }))
    // The repaired pure builder sees the value: the mounted result must too.
    expect(buildModelStrip(useCanvasStore.getState().nodes).noValueTotal).toBe(1)
    expect(screen.getByTestId(`${TID}-no-value-toggle`)).toHaveTextContent('1 with no value yet')
    expect(marks()).toEqual(['f_b'])
  })
  it('opposite control: nested observedState estimate updates the mounted count and list', () => {
    openWorklist()
    act(() => useCanvasStore.setState({ nodes: [node('f_a', { observedState: { display_value: '0.25 to 0.75' } }), node('f_b')] }))
    expect(screen.getByTestId(`${TID}-no-value-toggle`)).toHaveTextContent('1 with no value yet')
    expect(marks()).toEqual(['f_b'])
  })
  it('a real value arriving must also retire the now-valued factor from the worklist rings', () => {
    openWorklist()
    act(() => useCanvasStore.setState({ nodes: [node('f_a', { observedState: { value: 0.7, source: 'user_override' } }), node('f_b')] }))
    expect(screen.getByTestId(`${TID}-no-value-toggle`)).toHaveTextContent('1 with no value yet')
    expect(marks()).toEqual(['f_b'])
    expect(useCanvasStore.getState().highlightedNodes).toEqual(['f_b'])
  })
  it('opposite control: an unchanged valueless population retains both marks and rings', () => {
    openWorklist()
    act(() => useCanvasStore.setState({ nodes: [node('f_a'), { ...node('f_b'), position: { x: 20, y: 30 } }] }))
    expect(screen.getByTestId(`${TID}-no-value-toggle`)).toHaveTextContent('2 with no value yet')
    expect(marks()).toEqual(['f_a', 'f_b'])
    expect(useCanvasStore.getState().highlightedNodes).toEqual(['f_a', 'f_b'])
  })
})

describe('independent #1291 existing Model outline populations', () => {
  it.each([
    ['bare', {}, 1, '1 with no value yet'],
    ['top-level display', { display_value: '0.25 to 0.75' }, 0, '1 estimated by Olumi'],
    ['model-scale AI estimate', { observedState: { value: 0.7, source: 'cee_inference' } }, 0, '1 estimated by Olumi'],
    ['model-scale user edit', { observedState: { value: 0.7, source: 'user_override' } }, 0, 'you set 1'],
  ] as const)('%s is not conflated with raw display absence', (_label, data, count, summary) => {
    const nodes = [node('f_a', data)]
    expect(buildModelStrip(nodes).noValueTotal).toBe(count)
    const rows = toModelRows({ nodes, edges: [] })
    render(<ModelOutline rows={rows} tier="plain" />)
    expect(screen.getByText(summary)).toBeInTheDocument()
  })
})

