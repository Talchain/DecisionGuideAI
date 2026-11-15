/**
 * Old look: the whole model at first open (Paul's standing ruling, 10 Nov; DL-support 15 Nov: "first view and Fit must use the canvas
 * area LEFT of the side panel and show the whole model, at all three sizes"). Measured before this change on core 652ef452's Views at
 * 1232x704 and 1500x904: a board too tall for reading size opened at full size with the rest below the fold ("N more cards below").
 * - cameraFrame frames such a board whole inside the free canvas (left of the panel, under the head band, above the foot gutter).
 * - stagePlaces picks, of the layouts k cards across, the one the free canvas shows whole at the largest zoom.
 * Geometry only; bound by node id.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { Node } from '@xyflow/react'
import type { View } from '../client'
import { FACE_RANGE, cameraFrame, faceRegimeOf } from '../ViewCanvas'
import { CARD_WIDTH, QUESTION, boardExtent, causalPlaces, drawnModelOf, rowWidthOf, stagePlaces } from '../layout'
import { FOOT_GUTTER } from '../footClear'

const PANE = { width: 1232, height: 704 }, FREE = { top: 120, right: 347, bottom: 64, left: 64 }
/** A board two cards across and eight rows down, every card 248 x 150: too tall for the free canvas at reading size. */
const tall = (h = 150): Node[] => Array.from({ length: 16 }, (_, i) => ({
  id: `c${i}`, type: 'view-card', data: {}, position: { x: (i % 2) * 296, y: Math.floor(i / 2) * 200 },
  measured: { width: CARD_WIDTH, height: h }, width: CARD_WIDTH, height: h,
}) as unknown as Node)
const inFree = (nodes: readonly Node[], v: { x: number; y: number; zoom: number }) => nodes.filter((n) => {
  const x = n.position.x * v.zoom + v.x, y = n.position.y * v.zoom + v.y, w = n.measured!.width! * v.zoom, h = n.measured!.height! * v.zoom
  return !(x >= FREE.left - 0.5 && x + w <= PANE.width - FREE.right + 0.5 && y >= FREE.top - 0.5 && y + h <= PANE.height - Math.max(FREE.bottom, FOOT_GUTTER) + 0.5)
}).map((n) => n.id)

describe('the camera frames the whole model in the free canvas', () => {
  it('catch: a board too tall for reading size is framed whole, every card inside the free canvas (none below the fold or under the panel)', () => {
    const nodes = tall(), v = cameraFrame({ full: { zoom: 1, nodes } }, PANE, FREE)!
    expect(v.zoom).toBeLessThan(FACE_RANGE.full[0]) // the precondition: it does not fit at reading size
    expect(inFree(nodes, v)).toEqual([])
  })
  it('with the reduced faces drawn (shorter cards), the frame rests on their heights and stays inside that face\'s zoom band', () => {
    const full = tall(), first = cameraFrame({ full: { zoom: 1, nodes: full } }, PANE, FREE)!
    const regime = faceRegimeOf(first.zoom), reduced = tall(90)
    const v = cameraFrame({ full: { zoom: 1, nodes: full }, [regime]: { zoom: first.zoom, nodes: reduced } }, PANE, FREE)!
    expect(v.zoom).toBeGreaterThanOrEqual(first.zoom)
    expect(v.zoom).toBeLessThanOrEqual(FACE_RANGE[regime][1])
    expect(inFree(reduced, v)).toEqual([])
  })
  it('must not change: a board that fits at reading size is framed at full size or the largest zoom up to 1, as before', () => {
    const small = tall().slice(0, 4), v = cameraFrame({ full: { zoom: 1, nodes: small } }, PANE, FREE)!
    expect(v.zoom).toBeGreaterThanOrEqual(FACE_RANGE.full[0])
    expect(inFree(small, v)).toEqual([])
  })
})

describe('the layout the free canvas shows largest', () => {
  const core = (n: string): View => JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/core-652ef452', `${n}.view3.json`), 'utf8'))
  const zoomOf = (places: Map<string, { x: number; y: number }>, model: ReturnType<typeof drawnModelOf>, room: { w: number; h: number }) => {
    const b = boardExtent(places, (id) => (id === QUESTION ? CARD_WIDTH : CARD_WIDTH), (id) => model.cards.find((c) => c.id === id)?.h ?? 85)
    return Math.min(1, room.w / b.w, room.h / b.h)
  }
  for (const room of [{ w: 821, h: 520 }, { w: 1070, h: 720 }]) {
    it(`stagePlaces at ${room.w}x${room.h}: no layout k across (1 to 5) is shown larger than the one chosen`, async () => {
      for (const n of ['app-launch', 'european', 'studio']) {
        const model = drawnModelOf(core(n).model!), heightOf = (id: string) => model.cards.find((c) => c.id === id)?.h ?? 85
        const chosen = zoomOf(await stagePlaces(model, new Map(), {}, room, () => CARD_WIDTH, heightOf), model, room)
        for (let k = 1; k <= 5; k += 1) expect(zoomOf(await causalPlaces(model, new Map(), { roomW: rowWidthOf(k) }), model, room), `${n} k=${k}`).toBeLessThanOrEqual(chosen + 1e-9)
      }
    })
  }
  it('a room unknown (0) keeps the previous layout exactly', async () => {
    const model = drawnModelOf(core('bakery').model!)
    expect([...(await stagePlaces(model, new Map(), {}, { w: 0, h: 0 }, () => CARD_WIDTH, () => 85))]).toEqual([...(await causalPlaces(model, new Map()))])
  })
})
