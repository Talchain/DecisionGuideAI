/**
 * Canvas A1: on the olumi-core lane the canvas is the View's model (decision A). Rows from the inventory (canvas-A-inventory.md): a
 * View draws the canvas (R1) and every later View redraws it, the approved model included (R2, 00052 #1); the same View twice changes
 * nothing (R3); no /bff read opens the canvas (R4); the board is a program board (R5); the cards are placed, never re-laid out (R7).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { renderHook } from '@testing-library/react'
import type { View } from '../client'
import { useCanvasStore } from '../../canvas/store'
import { useViewStore } from '../store'
import { drawViewCanvas, useViewCanvas, VIEW_CARD } from '../canvas'
import { cardPlaces } from '../layout'

const lane = vi.hoisted(() => ({ on: true }))
vi.mock('../../olumiCore/lane', async (real) => ({ ...(await real<object>()), isOlumiCoreLane: () => lane.on }))
const hydrate = vi.hoisted(() => vi.fn(async () => 'merged'))
vi.mock('../../canvas/hydrate/serverGraphHydration', async (real) => ({ ...(await real<object>()), hydrateCanvasFromServer: hydrate }))
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
vi.mock('../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: 'u1', accessToken: null }), supabase: {} }))
vi.mock('../../canvas/nodes/shared/savedGraph', () => ({ useSavedGraphRead: () => ({ status: 'none' }), useSavedGraph: () => null }))

const golden = (n: string): View => JSON.parse(readFileSync(path.resolve('src/olumiView/golden', `${n}.view.json`), 'utf8'))
const ids = () => useCanvasStore.getState().nodes.map((n) => n.id)

beforeEach(() => { lane.on = true; hydrate.mockClear(); useCanvasStore.setState({ nodes: [], edges: [], pendingLayout: true, currentScenarioId: null }) })
afterEach(() => useViewStore.setState({ uuid: null, sid: null, view: null, error: null, status: 'none' }))

describe('the View draws the canvas', () => {
  it('R1 one viewCard per card, in the View\'s order, where core\'s page places it; one link per View link', () => {
    const model = golden('pricing').model!
    expect(drawViewCanvas(model)).toBe(true)
    const { nodes, edges } = useCanvasStore.getState()
    const places = cardPlaces(model)
    expect(nodes.map((n) => [n.id, n.type, n.position])).toEqual(model.cards.map((c) => [c.id, VIEW_CARD, places.get(c.id)]))
    expect(nodes.every((n, i) => (n.data as { card: unknown }).card === model.cards[i])).toBe(true)
    expect(edges.map((e) => [e.source, e.target])).toEqual(model.links.map((l) => [l.from, l.to]))
  })

  it('R2 each View that lands redraws it: the approved model replaces the one before (00052 #1)', () => {
    const before = golden('pricing'), approved = golden('proposal')
    useViewStore.setState({ view: before })
    const { rerender } = renderHook(() => useViewCanvas(true))
    expect(ids()).toEqual(before.model!.cards.map((c) => c.id))
    useViewStore.setState({ view: { ...approved, proposal: null } })
    rerender()
    expect(ids()).toEqual(approved.model!.cards.map((c) => c.id))
  })

  it('R3 the same View twice changes nothing, and a card the person moved stays where they put it', () => {
    const model = golden('pricing').model!
    drawViewCanvas(model)
    const moved = { ...useCanvasStore.getState().nodes[0]!, position: { x: 999, y: 999 } }
    useCanvasStore.setState({ nodes: [moved, ...useCanvasStore.getState().nodes.slice(1)] })
    const at = useCanvasStore.getState().layoutRequestId
    expect(drawViewCanvas(model)).toBe(false)
    expect(useCanvasStore.getState().layoutRequestId).toBe(at)
    drawViewCanvas({ ...model, cards: model.cards.map((c, i) => (i === 0 ? { ...c, heading: `${c.heading}!` } : c)) })
    expect(useCanvasStore.getState().nodes[0]!.position).toEqual({ x: 999, y: 999 })
  })

  it('R7 the cards are placed: no layout is asked for, and one begun before is stale', () => {
    const at = useCanvasStore.getState().layoutRequestId
    drawViewCanvas(golden('pricing').model!)
    expect(useCanvasStore.getState().pendingLayout).toBe(false)
    expect(useCanvasStore.getState().layoutRequestId).toBe(at + 1)
  })

  it('off the core lane the hook draws nothing', () => {
    useViewStore.setState({ view: golden('pricing') })
    renderHook(() => useViewCanvas(false))
    expect(ids()).toEqual([])
  })
})

describe('nothing else opens the core lane\'s canvas', () => {
  it('R4 the open/boot read from /bff does not run on the core lane, and does off it', async () => {
    const { useServerGraphHydration } = await import('../../canvas/hooks/useServerGraphHydration')
    const scenario = '1b4e28ba-2fa1-41d2-883f-0016d3cca427'
    useCanvasStore.setState({ currentScenarioId: scenario })
    renderHook(() => useServerGraphHydration(scenario))
    await new Promise((r) => setTimeout(r, 10))
    expect(hydrate).not.toHaveBeenCalled()
    lane.on = false
    renderHook(() => useServerGraphHydration(scenario, { readEpoch: 'off' }))
    await vi.waitFor(() => expect(hydrate).toHaveBeenCalled())
  })

  it('R5 the core lane\'s board is a program board, whatever /bff answers', async () => {
    const { useSavedModelProgramState } = await import('../../canvas/nodes/shared/savedModelProgram')
    expect(renderHook(() => useSavedModelProgramState()).result.current).toBe('program')
    lane.on = false
    expect(renderHook(() => useSavedModelProgramState()).result.current).toBe('not_program')
  })
})
