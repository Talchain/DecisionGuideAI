/**
 * ORDER-UI-5 (4), DL-408: the board's frame at first open is computed from heights measured with the face it will draw, so it never lands in
 * another face's band and swings back. Bound to the boxes the served build drew (fixtures/live-v4-face-boxes.json: dist 1bc4c78e on a copy of
 * the :4098 store, s_037fa202ee78, traced at 1128x707 and 2000x1200, 13 Nov): at 1128 the old camera went 1 → 0.87 → 0.50 → 0.30 → 0.51 and
 * stopped with the goal under the foot. The free canvas (DERIVED from the same shots): the dock from x 811 at 1128 and x 1640 at 2000, the
 * top bar and lens row to y 104, the left toolbar to x 45.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { Node, Viewport } from '@xyflow/react'
import { bandOf, cameraFrame, FACE_RANGE, faceRegimeOf, frameFor, frameStep, settledBoardKey, settleTick, type FaceRegime, type FaceSnap } from '../ViewCanvas'

type Box = { id: string; x: number; y: number; w: number; h: number }
const F = JSON.parse(readFileSync(path.resolve('src/olumiView/__tests__/fixtures/live-v4-face-boxes.json'), 'utf8'))
const nodesOf = (bx: Box[]): Node[] => bx.map((b) => ({ id: b.id, position: { x: b.x, y: b.y }, data: {}, measured: { width: b.w, height: b.h } }))
const snap = (s: { zoom: number; nodes: Box[] }): FaceSnap => ({ zoom: s.zoom, nodes: nodesOf(s.nodes) })
const FREE_1128 = { top: 104, right: 1128 - 811, bottom: 26, left: 45 }, FREE_2000 = { top: 104, right: 2000 - 1640, bottom: 26, left: 45 }
const inside = (bx: Box[], v: Viewport, pane: { width: number; height: number }, free: typeof FREE_1128) =>
  bx.filter((b) => { const l = b.x * v.zoom + v.x, t = b.y * v.zoom + v.y; return !(l >= free.left - 0.5 && t >= free.top - 0.5 && l + b.w * v.zoom <= pane.width - free.right + 0.5 && t + b.h * v.zoom <= pane.height - free.bottom + 0.5) }).map((b) => b.id)
const GOAL = 'secure_funding_within_2_months'

describe('the first frame lands on heights measured with the face it draws (ORDER-UI-5 (4))', () => {
  const pane = F.w1128.pane as { width: number; height: number }
  const body = snap(F.w1128.body), line = snap(F.w1128.line)

  it('precondition (served, 1128): the body face is taller than the line face; the old rule framed the line heights into the body band', () => {
    const h = (s: FaceSnap) => s.nodes.reduce((a, n) => a + (n.measured?.height ?? 0), 0)
    expect([faceRegimeOf(body.zoom), faceRegimeOf(line.zoom)]).toEqual(['body', 'line'])
    expect(h(body)).toBeGreaterThan(h(line))
    const old = frameFor(line.nodes, pane, FREE_1128)!
    expect(faceRegimeOf(old.zoom), 'the swing: a frame from line heights draws the body face').toBe('body')
    expect(inside(F.w1128.body.nodes, old, pane, FREE_1128), 'and at that zoom the body face does not fit').toContain(GOAL)
  })

  // DL-538 (14 Nov): the board OPENS on its readable full face, never on a zoomed-out face; what does not fit is panned to. The two rows
  // below replaced "1128: … the line face is drawn once at the top of its band" and "1128: … the frame is the line face".
  it('1128 (DL-538): a board measured only on a reduced face is drawn once on the full face (the top of its band), to measure it', () => {
    for (const s of [{ body }, { line }, { body, line }]) expect(cameraFrame(s, pane, FREE_1128)!.zoom).toBe(FACE_RANGE.full[1])
  })

  // THE WHOLE MODEL AT FIRST OPEN (Paul's standing ruling, 10 Nov; DL-support 15 Nov 02:5xZ). These two rows REPLACE DL-538's "with the full
  // face measured and too large to fit whole, the frame stays in the full band … the rest is panned to" and "no frame ever opens a reduced
  // face": that rule opened 1232x704 with an option under the side panel and five cards below the fold. A deliberate change of rule, not a
  // loosened check: the new rows pin that EVERY card is inside the free canvas, on the face the frame draws.
  it('1128 (whole model): the full face does not fit; the frame is worked out from a reduced face\'s measured heights, every card of that face inside the free canvas', () => {
    const full = snap(F.w2000.full)
    expect(frameFor(full.nodes, pane, FREE_1128, FACE_RANGE.full[1])!.zoom, 'precondition: the full face does not fit whole in its own band').toBeLessThan(FACE_RANGE.full[0])
    const v = cameraFrame({ full, body, line }, pane, FREE_1128)!
    const r = faceRegimeOf(v.zoom)
    expect(r, 'a reduced face, because the full one does not fit').not.toBe('full')
    expect(bandOf(v.zoom), 'the frame rests inside the band of the face it draws').toBe(r)
    expect(inside(F.w1128[r].nodes, v, pane, FREE_1128), 'no card of the drawn face outside the free canvas (under the panel, the strip or below the fold)').toEqual([])
    expect(inside(F.w1128[r].nodes, v, pane, FREE_1128)).not.toContain(GOAL)
  })

  it('1128 (whole model): down the faces only; a face not drawn yet is framed at its band\'s top so it is drawn and measured, never back up into the full band', () => {
    const full = snap(F.w2000.full)
    const hop = cameraFrame({ full }, pane, FREE_1128)!
    expect(faceRegimeOf(hop.zoom), 'body not measured yet: the frame goes down to draw it').not.toBe('full')
    expect(hop.zoom).toBeLessThanOrEqual(FACE_RANGE.body[1] + 1e-9)
    for (const s of [{ full, body }, { full, line }, { full, body, line }] as Partial<Record<FaceRegime, FaceSnap>>[])
      expect(faceRegimeOf(cameraFrame(s, pane, FREE_1128)!.zoom), JSON.stringify(Object.keys(s))).not.toBe('full')
  })

  it('1128 (whole model): the settle loop, run step by step as the hook runs it, goes DOWN the faces only, never back up (no line→body), measures each face it hops to, and ends with every card of the drawn face inside the free canvas', () => {
    const boxes: Record<FaceRegime, Box[]> = { full: F.w2000.full.nodes, body: F.w1128.body.nodes, line: F.w1128.line.nodes }
    const order: Record<FaceRegime, number> = { full: 0, body: 1, line: 2 }
    let snaps: Partial<Record<FaceRegime, FaceSnap>> = {}, zoom = 1, v: Viewport | null = null
    const faces: FaceRegime[] = [], loop = { fitted: '', fits: 0 }
    for (let i = 0; i < 12; i += 1) {
      const drawn = nodesOf(boxes[faceRegimeOf(zoom)])
      const going = settleTick(loop, settledBoardKey(drawn), drawn.length, () => {
        const st = frameStep(snaps, drawn, zoom, pane, FREE_1128)
        snaps = st.snaps; v = st.v; zoom = v!.zoom; faces.push(faceRegimeOf(zoom))
        return st.measuring
      })
      if (!going) break
    }
    expect(faces.length, 'it framed').toBeGreaterThan(0)
    for (let i = 1; i < faces.length; i += 1) expect(order[faces[i]!] >= order[faces[i - 1]!], `down only: ${faces.join(' → ')}`).toBe(true)
    const last = faceRegimeOf(v!.zoom)
    expect(snaps[last], 'the face it rests on was drawn and measured').toBeDefined()
    expect(inside(boxes[last], v!, pane, FREE_1128), `every card inside, on ${last}`).toEqual([])
    expect(loop.fits).toBeLessThanOrEqual(5)
  })

  it('2000: the full face, measured, fits whole at the readable zoom or more: framed there, every card and the goal inside', () => {
    const p2 = F.w2000.pane as { width: number; height: number }, full = snap(F.w2000.full)
    expect(faceRegimeOf(full.zoom)).toBe('full')
    const v = cameraFrame({ full }, p2, FREE_2000)!
    expect(faceRegimeOf(v.zoom)).toBe('full')
    expect(inside(F.w2000.full.nodes, v, p2, FREE_2000)).toEqual([])
  })
})
