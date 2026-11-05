/**
 * R5 (github-3c, with the Set-button BLOCK; R4 witness run 3): a re-layout of the View's canvas rebuilt every node with no `selected`
 * (canvas.ts drawViewCanvas), so a card selected on the canvas, or put in front from the Model tab (focusNodeById →
 * selectNodeWithoutHistory), lost its selection whenever a card's drawn height changed, e.g. an editor opening on it. The re-layout now
 * keeps each card's selection. Fixture: core's european golden.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { View } from '../client'
import { useCanvasStore } from '../../canvas/store'
import { layViewCanvas } from '../canvas'

const model = (JSON.parse(readFileSync(path.resolve('src/olumiView/golden', 'european.view.json'), 'utf8')) as View).model!
beforeEach(() => { useCanvasStore.setState({ nodes: [], edges: [], pendingLayout: true }) })
afterEach(() => { useCanvasStore.setState({ nodes: [], edges: [] }) })

describe('a selected card stays selected across a re-layout', () => {
  it('the card put in front (the Model tab\'s focus) keeps its selection when another card is drawn taller and the graph is laid out again', async () => {
    await layViewCanvas(model)
    const [chosen, other] = model.cards.filter((c) => c.family === 'quantity').map((c) => c.id)
    useCanvasStore.getState().selectNodeWithoutHistory(chosen!)
    const sel = () => useCanvasStore.getState().nodes.filter((n) => n.selected === true).map((n) => n.id)
    expect(sel()).toEqual([chosen])
    const before = new Map(useCanvasStore.getState().nodes.map((n) => [n.id, n.position]))
    // Every card drawn at a height (as React Flow measures them), the other one much taller: the graph is laid out again.
    useCanvasStore.setState({ nodes: useCanvasStore.getState().nodes.map((n) => ({ ...n, measured: { width: 240, height: n.id === other ? 600 : 120 } })) })
    expect(await layViewCanvas(model)).toBe(true)
    const after = useCanvasStore.getState().nodes
    expect(after.some((n) => before.get(n.id)?.y !== n.position.y), 'the re-layout moved cards').toBe(true)
    expect(sel()).toEqual([chosen])
  })

  it('CONTRAST: a card nobody selected is not selected by a re-layout', async () => {
    await layViewCanvas(model)
    useCanvasStore.setState({ nodes: useCanvasStore.getState().nodes.map((n) => ({ ...n, measured: { width: 240, height: 300 } })) })
    await layViewCanvas(model)
    expect(useCanvasStore.getState().nodes.filter((n) => n.selected === true)).toEqual([])
  })
})
