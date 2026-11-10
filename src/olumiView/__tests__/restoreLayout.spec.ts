/**
 * UI restore stage 1, rows 5 and 6 (DL ruling 10 Nov on Paul's test of the served build: "so much worse than it used to be"): the board is
 * the previous product's layout and nothing laid over it. Each card stands where `layoutGraph` (canvas/utils/layout.ts) puts its own kind,
 * top to bottom by default: the question, the options, the factors, the outcomes and risks, the aims last. The overrides of 4 to 8 Nov
 * (aims beside the question, a left column of routes, rows by depth in the room at 1232) are gone. Core's goldens; positions bound by id.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { Edge, Node } from '@xyflow/react'
import type { View } from '../client'
import { layoutGraph } from '../../canvas/utils/layout'
import { REPEATED_CARD_W } from '../../canvas/utils/nodeLayoutConstants'
import { aimsOf, cardLinks, CARD_WIDTH, causalPlaces, drawKindOf, QUESTION, questionPlace, ROW_GAP_X } from '../layout'

const load = (n: string): View => JSON.parse(readFileSync(path.resolve('src/olumiView/golden', `${n}.view.json`), 'utf8'))
const BOARDS = ['european', 'pricing', 's_ce285b3617bb'] as const

describe("the board is the previous product's layout", () => {
  for (const name of BOARDS) {
    const model = load(name).model!
    const size = new Map<string, { width: number; height: number }>([[QUESTION, { width: questionPlace(model).width, height: 85 }], ...model.cards.map((c) => [c.id, { width: CARD_WIDTH, height: c.h }] as const)])
    const engine = async (direction: 'DOWN' | 'RIGHT') => {
      const nodes: Node[] = [{ id: QUESTION, type: 'decision', data: { kind: 'decision' }, position: { x: 0, y: 0 }, measured: size.get(QUESTION) },
        ...model.cards.map((c): Node => { const kind = drawKindOf(c, model); return { id: c.id, type: kind, data: { kind }, position: { x: 0, y: 0 }, measured: size.get(c.id) } })]
      const edges: Edge[] = cardLinks(model).map(({ link, i }) => ({ id: `l${i}`, source: link.from, target: link.to }))
      return new Map((await layoutGraph(nodes, edges, { direction, preserveLocked: false })).nodes.map((n) => [n.id, n.position]))
    }

    it(`${name}: every card is in the row the previous layout gives it, in its order across, the row closed up about its own centre (by id)`, async () => {
      const places = await causalPlaces(model, size), own = await engine('DOWN')
      expect(places.size).toBe(model.cards.length + 1)
      expect(places.get(QUESTION)).toEqual({ x: own.get(QUESTION)!.x, y: own.get(QUESTION)!.y })
      const rows = new Map<number, string[]>()
      for (const [id, at] of own) if (id !== QUESTION) rows.set(at.y, [...(rows.get(at.y) ?? []), id])
      for (const [y, ids] of rows) {
        ids.sort((a, b) => own.get(a)!.x - own.get(b)!.x)
        for (const id of ids) expect(places.get(id)!.y, id).toBe(y)
        expect([...ids].sort((a, b) => places.get(a)!.x - places.get(b)!.x), `row ${y}`).toEqual(ids)
        ids.slice(1).forEach((id, i) => expect(places.get(id)!.x - places.get(ids[i]!)!.x, id).toBeCloseTo(CARD_WIDTH + ROW_GAP_X))
        const mid = (m: Map<string, { x: number; y: number }>) => (m.get(ids[0]!)!.x + m.get(ids[ids.length - 1]!)!.x + CARD_WIDTH) / 2
        expect(mid(places), `row ${y} centre`).toBeCloseTo(mid(own))
      }
    })

    it(`${name}: the aims close the board under every option (never beside the question), and the question heads it`, async () => {
      const places = await causalPlaces(model, size), y = (id: string) => places.get(id)!.y
      const aims = aimsOf(model).filter((id) => drawKindOf(model.cards.find((c) => c.id === id)!, model) === 'goal'), options = model.cards.filter((c) => c.family === 'option').map((c) => c.id)
      expect(aims.length, 'contrast: the golden has an aim').toBeGreaterThan(0)
      for (const a of aims) for (const o of options) expect(y(a), `${a} under ${o}`).toBeGreaterThan(y(o))
      for (const c of model.cards) expect(y(c.id), c.id).toBeGreaterThan(y(QUESTION))
    })

    it(`${name}: no two cards overlap at the width they are drawn, the previous product's card`, async () => {
      expect(CARD_WIDTH).toBe(REPEATED_CARD_W)
      const places = await causalPlaces(model, size)
      const boxes = [...places].map(([id, p]) => ({ id, ...p, w: size.get(id)!.width, h: size.get(id)!.height }))
      for (const a of boxes) for (const b of boxes) if (a.id < b.id) expect(a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h, `${a.id} over ${b.id}`).toBe(false)
    })

    it(`${name}: the direction is the layout's setting: left to right is the previous layout's own left to right, a different board`, async () => {
      const right = await causalPlaces(model, size, { direction: 'RIGHT' }), own = await engine('RIGHT'), down = await causalPlaces(model, size)
      for (const [id, at] of own) expect(right.get(id), id).toEqual({ x: at.x, y: at.y })
      expect([...right].some(([id, at]) => at.x !== down.get(id)!.x || at.y !== down.get(id)!.y)).toBe(true)
    })
  }
})
