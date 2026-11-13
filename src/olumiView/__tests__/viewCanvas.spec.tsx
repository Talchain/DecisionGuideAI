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
import { useLayoutStore } from '../../canvas/layoutStore'
import { useViewStore } from '../store'
import { drawViewCanvas, layViewCanvas, useViewCanvas, ROOT_LINK, VIEW_CARD, VIEW_LINK, VIEW_QUESTION } from '../canvas'
import { askKindOf, CARD_WIDTH, causalPlaces, linkDrawn, QUESTION, questionPlace } from '../layout'

const lane = vi.hoisted(() => ({ on: true }))
const boundHeights = vi.hoisted(() => ({ current: new Map<string, number>() }))
vi.mock('../../canvas/utils/measureNodeHeightsAtLabelBound', () => ({ measureNodeHeightsAtLabelBound: () => boundHeights.current }))
vi.mock('../../olumiCore/lane', async (real) => ({ ...(await real<object>()), isOlumiCoreLane: () => lane.on }))
const hydrate = vi.hoisted(() => vi.fn(async () => 'merged'))
vi.mock('../../canvas/hydrate/serverGraphHydration', async (real) => ({ ...(await real<object>()), hydrateCanvasFromServer: hydrate }))
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
vi.mock('../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: 'u1', accessToken: null }), supabase: {} }))
vi.mock('../../canvas/nodes/shared/savedGraph', () => ({ useSavedGraphRead: () => ({ status: 'none' }), useSavedGraph: () => null }))

const golden = (n: string, dir = 'golden', ext = 'view'): View => JSON.parse(readFileSync(path.resolve('src/olumiView', dir, `${n}.${ext}.json`), 'utf8'))
const ids = () => useCanvasStore.getState().nodes.slice(1).map((n) => n.id)

beforeEach(() => { lane.on = true; boundHeights.current = new Map(); hydrate.mockClear(); useCanvasStore.setState({ nodes: [], edges: [], pendingLayout: true, currentScenarioId: null }) })
afterEach(() => useViewStore.setState({ uuid: null, sid: null, view: null, error: null, status: 'none' }))

describe('the View draws the canvas', () => {
  it('R1 one viewCard per card, in the View\'s order, where DGAI\'s causal layout places it; one link per View link', async () => {
    const model = golden('pricing').model!
    expect(await layViewCanvas(model)).toBe(true)
    const { nodes, edges } = useCanvasStore.getState()
    // UI restore stage 1 (DL ruling 10 Nov): use the previous layout with the store's direction and spacing, without viewport input.
    const { direction, nodeSpacing } = useLayoutStore.getState()
    const places = await causalPlaces(model, new Map(), { direction, spacing: nodeSpacing }), cards = nodes.slice(1)
    expect(cards.map((n) => [n.id, n.type, n.position])).toEqual(model.cards.map((c) => [c.id, VIEW_CARD, places.get(c.id)]))
    expect(cards.every((n, i) => (n.data as { card: unknown }).card === model.cards[i])).toBe(true)
    // The previous graph's question-to-option lines (ROOT_LINK) are drawn besides core's own links (previousCard.spec.ts).
    expect(edges.filter((e) => e.type === VIEW_LINK).map((e) => [e.source, e.target])).toEqual(model.links.map((l) => [l.from, l.to]))
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
    it(`${n}: the question on top, the aims last below the options; no two cards overlap`, async () => {
      const model = golden(n).model!
      await layViewCanvas(model)
      const nodes = useCanvasStore.getState().nodes, y = (id: string) => nodes.find((x) => x.id === id)!.position.y
      // UI restore stage 1 (DL ruling 10 Nov): aims close the board; every card follows the question, with no head-row override.
      for (const c of model.cards) expect(y(c.id), `${c.id} below ${QUESTION}`).toBeGreaterThan(y(QUESTION))
      for (const aim of model.cards.filter((c) => askKindOf(c.family) === 'goal')) {
        for (const c of model.cards.filter((c) => askKindOf(c.family) !== 'goal')) expect(y(aim.id), `${aim.id} below ${c.id}`).toBeGreaterThan(y(c.id))
      }
      const boxes = [{ id: QUESTION, ...nodes.find((n) => n.id === QUESTION)!.position, w: questionPlace(model).width, h: 85 }, ...model.cards.map((c) => ({ id: c.id, ...nodes.find((n) => n.id === c.id)!.position, w: CARD_WIDTH, h: c.h }))]
      for (const a of boxes) for (const b of boxes) if (a.id < b.id) expect(a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h, `${a.id} overlaps ${b.id}`).toBe(false)
    })
  }

  it('must not change: a card core drew is placed by the same pure layout every time (one place per model and heights)', async () => {
    const model = golden('european').model!
    expect([...(await causalPlaces(model, new Map()))]).toEqual([...(await causalPlaces(model, new Map()))])
    expect(drawViewCanvas(model, await causalPlaces(model, new Map()))).toBe(true)
  })
})

describe('the View adapter reserves the existing counter-scale height bound', () => {
  it('short live measurements cannot place a later row inside the full-height cards', async () => {
    const model = golden('pricing').model!
    await layViewCanvas(model)
    const low = useCanvasStore.getState().nodes.map((n) => ({ ...n, measured: { width: CARD_WIDTH, height: 80 } }))
    useCanvasStore.setState({ nodes: low })
    boundHeights.current = new Map(low.map((n) => [n.id, 400]))
    await layViewCanvas(model)
    const boxes = useCanvasStore.getState().nodes.map((n) => ({ id: n.id, ...n.position, w: n.id === QUESTION ? questionPlace(model).width : CARD_WIDTH, h: 400 }))
    for (const a of boxes) for (const b of boxes) if (a.id < b.id) {
      expect(a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h, `${a.id} overlaps ${b.id} at the measured height bound`).toBe(false)
    }
  })

  it('the same full-height bound gives the same board when live zoom measurements change', async () => {
    const model = golden('pricing').model!
    await layViewCanvas(model)
    const live = (height: number) => useCanvasStore.getState().nodes.map((n) => ({ ...n, measured: { width: CARD_WIDTH, height } }))
    boundHeights.current = new Map(useCanvasStore.getState().nodes.map((n) => [n.id, 400]))
    useCanvasStore.setState({ nodes: live(80) })
    await layViewCanvas(model)
    const before = useCanvasStore.getState().nodes.map((n) => [n.id, n.position])
    useCanvasStore.setState({ nodes: live(160) })
    await layViewCanvas(model)
    expect(useCanvasStore.getState().nodes.map((n) => [n.id, n.position])).toEqual(before)
  })
})

describe('the canvas keeps what core\'s page shows (00057)', () => {
  it('#1 the question is drawn first, at the top of the causal graph, with the links about the question as a whole', async () => {
    const model = golden('s_ce285b3617bb').model!
    await layViewCanvas(model)
    const { nodes, edges } = useCanvasStore.getState()
    expect([nodes[0]!.id, nodes[0]!.type]).toEqual([QUESTION, VIEW_QUESTION])
    // UI restore stage 1 (DL ruling 10 Nov): every card follows the question; aims no longer share its row.
    for (const c of model.cards) expect(nodes.find((n) => n.id === c.id)!.position.y, c.id).toBeGreaterThan(nodes[0]!.position.y)
    expect((nodes[0]!.data as { question: unknown }).question).toBe(model.question)
    const toQuestion = model.links.filter((l) => l.to === QUESTION)
    expect(toQuestion.length).toBeGreaterThan(0)
    expect(edges.filter((e) => e.target === QUESTION).map((e) => e.source)).toEqual(toQuestion.map((l) => l.from))
  })

  it('#3 every link is a View link edge carrying that link and its place in the View', async () => {
    const model = golden('european').model!
    await layViewCanvas(model)
    const edges = useCanvasStore.getState().edges.filter((e) => e.type !== ROOT_LINK)
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
