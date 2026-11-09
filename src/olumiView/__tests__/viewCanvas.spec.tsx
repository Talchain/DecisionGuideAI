/**
 * Canvas A1: on the olumi-core lane the canvas is the View's model (decision A). Rows from the inventory (canvas-A-inventory.md): a
 * View draws the canvas as DGAI's causal graph (R1, Paul 4 Nov) and every later View redraws it, the approved model included (R2, 00052 #1); the same View twice changes
 * nothing (R3); no /bff read opens the canvas (R4); the board is a program board (R5); the cards are placed, never re-laid out (R7).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, renderHook } from '@testing-library/react'
import type { View } from '../client'
import { useCanvasStore } from '../../canvas/store'
import { useViewStore } from '../store'
import { drawViewCanvas, layViewCanvas, useViewCanvas, VIEW_CARD, VIEW_LINK, VIEW_QUESTION } from '../canvas'
import { askKindOf, CARD_WIDTH, causalPlaces, linkDrawn, QUESTION, questionPlace } from '../layout'

const lane = vi.hoisted(() => ({ on: true }))
vi.mock('../../olumiCore/lane', async (real) => ({ ...(await real<object>()), isOlumiCoreLane: () => lane.on }))
const hydrate = vi.hoisted(() => vi.fn(async () => 'merged'))
vi.mock('../../canvas/hydrate/serverGraphHydration', async (real) => ({ ...(await real<object>()), hydrateCanvasFromServer: hydrate }))
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
vi.mock('../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: 'u1', accessToken: null }), supabase: {} }))
vi.mock('../../canvas/nodes/shared/savedGraph', () => ({ useSavedGraphRead: () => ({ status: 'none' }), useSavedGraph: () => null }))

const golden = (n: string, dir = 'golden', ext = 'view'): View => JSON.parse(readFileSync(path.resolve('src/olumiView', dir, `${n}.${ext}.json`), 'utf8'))
const ids = () => useCanvasStore.getState().nodes.slice(1).map((n) => n.id)

beforeEach(() => { lane.on = true; hydrate.mockClear(); useCanvasStore.setState({ nodes: [], edges: [], pendingLayout: true, currentScenarioId: null }) })
afterEach(() => useViewStore.setState({ uuid: null, sid: null, view: null, error: null, status: 'none' }))

describe('the View draws the canvas', () => {
  it('R1 one viewCard per card, in the View\'s order, where DGAI\'s causal layout places it; one link per View link', async () => {
    const model = golden('pricing').model!
    expect(await layViewCanvas(model)).toBe(true)
    const { nodes, edges } = useCanvasStore.getState()
    const places = await causalPlaces(model, new Map(), questionPlace(model).width), cards = nodes.slice(1)
    expect(cards.map((n) => [n.id, n.type, n.position])).toEqual(model.cards.map((c) => [c.id, VIEW_CARD, places.get(c.id)]))
    expect(cards.every((n, i) => (n.data as { card: unknown }).card === model.cards[i])).toBe(true)
    expect(edges.map((e) => [e.source, e.target])).toEqual(model.links.map((l) => [l.from, l.to]))
  })

  it('R2 each View that lands redraws it: the approved model replaces the one before (00052 #1)', async () => {
    const before = golden('pricing'), approved = golden('proposal')
    useViewStore.setState({ view: before })
    const { rerender } = renderHook(() => useViewCanvas(true))
    await vi.waitFor(() => expect(ids()).toEqual(before.model!.cards.map((c) => c.id)))
    useViewStore.setState({ view: { ...approved, proposal: null } })
    rerender()
    await vi.waitFor(() => expect(ids()).toEqual(approved.model!.cards.map((c) => c.id)))
  })

  it('R2b no View for the scenario on screen (a new scenario started): the last one\'s cards leave the canvas (review 00003 #1)', async () => {
    renderHook(() => useViewCanvas(true))
    act(() => { useViewStore.setState({ uuid: 'a', sid: 's_0123456789ab', view: golden('pricing'), status: 'ready', error: null }) })
    await vi.waitFor(() => expect(useCanvasStore.getState().nodes.length).toBeGreaterThan(0))
    act(() => { useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none' }) })
    expect(useCanvasStore.getState().nodes).toEqual([])
  })

  it('R3 the same View twice changes nothing, and a card the person moved stays where they put it', async () => {
    const model = golden('pricing').model!
    await layViewCanvas(model)
    const moved = { ...useCanvasStore.getState().nodes[1]!, position: { x: 999, y: 999 } }
    useCanvasStore.setState({ nodes: [useCanvasStore.getState().nodes[0]!, moved, ...useCanvasStore.getState().nodes.slice(2)] })
    const at = useCanvasStore.getState().layoutRequestId
    expect(await layViewCanvas(model)).toBe(false)
    expect(useCanvasStore.getState().layoutRequestId).toBe(at)
    await layViewCanvas({ ...model, cards: model.cards.map((c, i) => (i === 0 ? { ...c, heading: `${c.heading}!` } : c)) })
    expect(useCanvasStore.getState().nodes[1]!.position).toEqual({ x: 999, y: 999 })
  })

  it('R7 the cards are placed: no layout is asked for, and one begun before is stale', async () => {
    const at = useCanvasStore.getState().layoutRequestId
    await layViewCanvas(golden('pricing').model!)
    expect(useCanvasStore.getState().pendingLayout).toBe(false)
    expect(useCanvasStore.getState().layoutRequestId).toBe(at + 1)
  })

  it('off the core lane the hook draws nothing', () => {
    useViewStore.setState({ view: golden('pricing') })
    renderHook(() => useViewCanvas(false))
    expect(ids()).toEqual([])
  })
})

describe('the causal graph, not core\'s columns (Paul 4 Nov: "the horizontal model is an absolute mess")', () => {
  for (const n of ['european', 'bakery']) {
    it(`${n}: the question on top with the goal beside it (R25), the options below both; no two cards overlap`, async () => {
      const model = golden(n).model!
      await layViewCanvas(model)
      const nodes = useCanvasStore.getState().nodes, y = (id: string) => nodes.find((x) => x.id === id)!.position.y
      const byFamily = (f: string) => model.cards.filter((c) => askKindOf(c.family) === f).map((c) => y(c.id))
      expect(Math.max(...byFamily('option'))).toBeGreaterThan(y(QUESTION))
      // R25 (Paul 7 Nov: the aims in view at 1232): the aims are the head of the board, beside the question, above the options.
      expect(byFamily('goal').every((g) => g === y(QUESTION))).toBe(true)
      expect(Math.min(...byFamily('option'))).toBeGreaterThan(Math.max(...model.cards.filter((c) => askKindOf(c.family) === 'goal').map((c) => y(c.id) + c.h)))
      const box = (id: string) => { const c = model.cards.find((x) => x.id === id)!, p = nodes.find((x) => x.id === id)!.position; return [p.x, p.y, p.x + CARD_WIDTH, p.y + c.h] }
      for (const a of model.cards) for (const b of model.cards) {
        if (a.id >= b.id) continue
        const [ax, ay, aX, aY] = box(a.id), [bx, by, bX, bY] = box(b.id)
        expect(ax < bX && bx < aX && ay < bY && by < aY, `${a.id} overlaps ${b.id}`).toBe(false)
      }
    })
  }

  it('must not change: a card core drew is placed by the same pure layout every time (one place per model and heights)', async () => {
    const model = golden('european').model!, q = questionPlace(model).width
    expect([...(await causalPlaces(model, new Map(), q))]).toEqual([...(await causalPlaces(model, new Map(), q))])
    expect(drawViewCanvas(model, await causalPlaces(model, new Map(), q))).toBe(true)
  })
})

describe('the canvas keeps what core\'s page shows (00057)', () => {
  it('#1 the question is drawn first, at the top of the causal graph, with the links about the question as a whole', async () => {
    const model = golden('s_ce285b3617bb').model!
    await layViewCanvas(model)
    const { nodes, edges } = useCanvasStore.getState()
    expect([nodes[0]!.id, nodes[0]!.type]).toEqual([QUESTION, VIEW_QUESTION])
    // Every card below it, but the aims, which sit beside it (R25).
    const aim = new Set(model.cards.filter((c) => askKindOf(c.family) === 'goal' || askKindOf(c.family) === 'constraint').map((c) => c.id))
    expect(nodes.slice(1).every((n) => (aim.has(n.id) ? n.position.y === nodes[0]!.position.y : n.position.y > nodes[0]!.position.y))).toBe(true)
    expect((nodes[0]!.data as { question: unknown }).question).toBe(model.question)
    const toQuestion = model.links.filter((l) => l.to === QUESTION)
    expect(toQuestion.length).toBeGreaterThan(0)
    expect(edges.filter((e) => e.target === QUESTION).map((e) => e.source)).toEqual(toQuestion.map((l) => l.from))
  })

  it('#3 every link is a View link edge carrying that link and its place in the View', async () => {
    const model = golden('european').model!
    await layViewCanvas(model)
    const { edges } = useCanvasStore.getState()
    expect(edges.every((e) => e.type === VIEW_LINK)).toBe(true)
    expect(edges.map((e) => (e.data as unknown as { link: unknown }).link)).toEqual(model.links)
    expect(edges.map((e) => (e.data as unknown as { i: number }).i)).toEqual(model.links.map((_, i) => i))
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

describe('a click on a View card opens no inspector (4 Nov drive: "This element has no detailed editor yet" over the canvas)', () => {
  it('a card or the question from core\'s View is a View node; any other node is not, so its click still opens the inspector', async () => {
    const { isViewNode, VIEW_CARD, VIEW_QUESTION } = await import('../canvas')
    expect(isViewNode({ type: VIEW_CARD })).toBe(true)
    expect(isViewNode({ type: VIEW_QUESTION })).toBe(true)
    for (const type of ['factor', 'option', 'goal', 'viewLink', undefined]) expect(isViewNode({ type }), String(type)).toBe(false)
    expect(isViewNode(null)).toBe(false)
  })
})

describe('the reason links fold away (DL 4 Nov: "the dashed premise and assumption links cross the whole board")', () => {
  const model = golden('european').model!
  const reasons = model.links.filter((l) => l.kind === 'reason'), causal = model.links.filter((l) => l.kind !== 'reason')
  it('at open, with nothing hovered or selected, no reason link is drawn; every causal link is', () => {
    expect(reasons.length).toBeGreaterThan(0)
    expect(reasons.filter((l) => !l.alert && !l.proposed).some((l) => linkDrawn(l, new Set()))).toBe(false)
    expect(causal.every((l) => linkDrawn(l, new Set()))).toBe(true)
  })
  it('an option selected or hovered draws the reason links on it, and only those', () => {
    const option = model.cards.find((c) => c.family === 'option' && reasons.some((l) => l.to === c.id))!
    const on = reasons.filter((l) => linkDrawn(l, new Set([option.id])))
    expect(on.length).toBeGreaterThan(0)
    expect(on.every((l) => l.from === option.id || l.to === option.id)).toBe(true)
  })
  it('must not change: a reason link core marks challenged or proposed is always drawn', () => {
    const r = reasons[0]!
    expect([linkDrawn({ ...r, alert: true }, new Set()), linkDrawn({ ...r, proposed: true }, new Set())]).toEqual([true, true])
  })
})

describe('the cards as the original canvas numbers and draws them', () => {
  it('european: options O1–O3, a figure a person sets is a factor (F), one core works out an outcome (OC), assumptions A, the aim unnumbered', async () => {
    const { cardNumbersOf, drawKindOf } = await import('../layout')
    const model = golden('european-22cards', 'fixtures/real', 'view3').model!, n = cardNumbersOf(model)
    expect(model.cards.filter((c) => c.family === 'option').map((c) => n.get(c.id))).toEqual(['O1', 'O2', 'O3'])
    expect([n.get('starting_customers'), n.get('customers'), n.get('entry_interpretation'), n.get('reach_customer_target')]).toEqual(['F1', 'OC1', 'A1', undefined])
    expect([drawKindOf(model.cards.find((c) => c.id === 'customers')!, model), drawKindOf(model.cards.find((c) => c.id === 'starting_customers')!, model)]).toEqual(['outcome', 'factor'])
  })
})
