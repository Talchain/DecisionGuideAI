import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, renderHook, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { OptionNode } from '../OptionNode'
import { OptionChanceCellProvider } from '../shared/OptionChanceCellProvider'
import { useOptionChanceCell } from '../shared/useOptionChanceCell'
import { useCanvasStore } from '../../store'
import * as resultsData from '../../../components/results/useResultsSectionData'
import { seedPaulRun, resetPaulRun } from '../../../components/results/__tests__/helpers/paulRun4276f3f9'
import { stripComments } from '../../../../tests/helpers/stripSourceComments'

vi.mock('@xyflow/react', async () => ({ ...await vi.importActual('@xyflow/react'), Handle: () => null }))

afterEach(() => { cleanup(); vi.restoreAllMocks(); resetPaulRun() })

function cards(count: number) {
  const nodes = useCanvasStore.getState().nodes.filter(node => node.type === 'option').slice(0, count)
  expect(nodes).toHaveLength(count)
  return nodes.map(node => <OptionNode key={node.id} id={node.id} type="option" data={node.data as never}
    selected={false} isConnectable positionAbsoluteX={0} positionAbsoluteY={0}
    dragging={false} zIndex={0} deletable selectable draggable />)
}

describe('one Results projection per canvas provider render', () => {
  it.each([2, 4])('%i real option cards call useResultsSectionData once per provider render', count => {
    seedPaulRun(null)
    const projection = renderHook(() => resultsData.useResultsSectionData({ registerCanvasRows: false }))
    const data = projection.result.current
    projection.unmount()
    const spy = vi.spyOn(resultsData, 'useResultsSectionData').mockReturnValue(data)
    const tree = () => <ReactFlowProvider><OptionChanceCellProvider>{cards(count)}</OptionChanceCellProvider></ReactFlowProvider>
    const view = render(tree())
    expect(screen.getAllByTestId(/^option-bottom-marks-/)).toHaveLength(count)
    expect(spy, `${count} cards: one Results call on initial provider render`).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenLastCalledWith({ registerCanvasRows: false })
    spy.mockClear()
    view.rerender(tree())
    expect(spy, `${count} cards: one Results call on provider rerender`).toHaveBeenCalledTimes(1)
  })

  it('outside the provider an isolated card and hook get none without a Results projection', () => {
    seedPaulRun(null)
    const spy = vi.spyOn(resultsData, 'useResultsSectionData')
    render(<ReactFlowProvider>{cards(1)}</ReactFlowProvider>)
    const cell = renderHook(() => useOptionChanceCell('angel_bridge')).result.current
    expect(cell).toEqual({ kind: 'none', text: null })
    expect(screen.queryByTestId('option-analysis-currency-angel_bridge')).toBeNull()
    expect(spy).not.toHaveBeenCalled()
  })

  it('the React Flow canvas mounts exactly one chance provider around its node-rendering component', () => {
    const source = stripComments(readFileSync(resolve(process.cwd(), 'src/canvas/ReactFlowGraph.tsx'), 'utf8'), 'ReactFlowGraph.tsx')
    expect(source.match(/<OptionChanceCellProvider\b/g)).toHaveLength(1)
    expect(source).toMatch(/<OptionChanceCellProvider>\s*<ReactFlowGraphInner\s+\{\.\.\.props\}\s*\/>\s*<\/OptionChanceCellProvider>/)
  })
})
