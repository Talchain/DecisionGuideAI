/**
 * ORDER-UI-5 (4), DL-408: the board's frame at first open is computed from heights measured with the face it will draw, so it never lands in
 * another face's band and swings back. Bound to the boxes the served build drew (fixtures/live-v4-face-boxes.json: dist 1bc4c78e on a copy of
 * the :4098 store, s_037fa202ee78, traced at 1128x707 and 2000x1200, 13 Nov): at 1128 the old camera went 1 → 0.87 → 0.50 → 0.30 → 0.51 and
 * stopped with the goal under the foot. The free canvas (DERIVED from the same shots): the dock from x 811 at 1128 and x 1640 at 2000, the
 * top bar and lens row to y 104, the left toolbar to x 45.
 */
import { describe, expect, it, vi } from 'vitest'
vi.mock('../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: {} }))
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { Node, Viewport } from '@xyflow/react'
import { FACE_RANGE, bandOf, cameraFrame, faceRegimeOf, frameStep, settleDone, settleTick, settledBoardKey, type FaceRegime, type FaceSnap, type SettleLoop } from '../ViewCanvas'

type Box = { id: string; x: number; y: number; w: number; h: number }
const F = JSON.parse(readFileSync(path.resolve('src/olumiView/__tests__/fixtures/live-v4-face-boxes.json'), 'utf8'))
const nodesOf = (bx: Box[]): Node[] => bx.map((b) => ({ id: b.id, position: { x: b.x, y: b.y }, data: {}, measured: { width: b.w, height: b.h } }))
const snap = (s: { zoom: number; nodes: Box[] }): FaceSnap => ({ zoom: s.zoom, nodes: nodesOf(s.nodes) })
const FREE_1128 = { top: 104, right: 1128 - 811, bottom: 26, left: 45 }, FREE_2000 = { top: 104, right: 2000 - 1640, bottom: 26, left: 45 }
const inside = (bx: Box[], v: Viewport, pane: { width: number; height: number }, free: typeof FREE_1128) =>
  bx.filter((b) => { const l = b.x * v.zoom + v.x, t = b.y * v.zoom + v.y; return !(l >= free.left - 0.5 && t >= free.top - 0.5 && l + b.w * v.zoom <= pane.width - free.right + 0.5 && t + b.h * v.zoom <= pane.height - free.bottom + 0.5) }).map((b) => b.id)
type Step = { v: Viewport; measuring: boolean }
/** useViewCamera's settle loop, run by its own step (settleTick, with settledBoardKey; `frame` is its fit: frameStep, the camera moved to
 *  the frame): Codex 15 Nov, rounds 3 and 4. `drawnAt(zoom, settles)` is what the canvas draws, measured, at a zoom, `settles` settles after
 *  the last frame; FRAME_WAIT_MS since a frame is `waitSettles` settles here. */
const settleLoop = (drawnAt: (zoom: number, settles: number) => Node[], pane: { width: number; height: number }, free: typeof FREE_1128, zoom0 = 1, waitSettles = 3): Step[] => {
  let snaps: Partial<Record<FaceRegime, FaceSnap>> = {}, zoom = zoom0, settles = 0
  const loop: SettleLoop = { fitted: '', fits: 0, hopFrom: null }, trace: Step[] = []
  for (let guard = 0; guard < 100; guard += 1) {
    const drawn = drawnAt(zoom, settles)
    const r = settleTick(loop, settledBoardKey(drawn), drawn.length, settles >= waitSettles, () => {
      const step = frameStep(snaps, drawn, zoom, pane, free)
      snaps = step.snaps
      if (step.v !== null) { trace.push({ v: step.v, measuring: step.measuring }); zoom = step.v.zoom }
      return step.measuring
    })
    if (r === 'stop') return trace
    settles = r === 'wait' ? settles + 1 : 0
  }
  throw new Error('the settle loop did not end')
}

// Old look, 15 Nov (Paul's standing ruling, the whole model at first open; DL-support: "first view and Fit must use the canvas area LEFT of
// the side panel and show the whole model, at all three sizes"). This replaces the 13 Nov rule bound here before ("a model that cannot fit
// at reading size stays at 100%" and "opens at the stage's left edge"): the board is framed whole, with the face that zoom draws.
describe('the opening frames the whole model, down the faces, never back up into a larger face', () => {
  it('a model that cannot fit at reading size is framed whole (full faces until a reduced face is drawn), every card inside the free canvas', () => {
    const full = snap(F.w2000.full)
    const v = cameraFrame({ full }, { width: 1128, height: 707 }, FREE_1128)!
    expect(v.zoom).toBeLessThan(FACE_RANGE.full[0])
    expect(inside(F.w2000.full.nodes, v, { width: 1128, height: 707 }, FREE_1128)).toEqual([])
  })
  it('DL-408 catch, on the measured faces at 1128 (served build 1bc4c78e), through the settle loop as useViewCamera runs it: the frame never goes back up into a larger face\'s band, and rests inside the band of the face drawn there with every card inside', () => {
    const pane = F.w1128.pane
    // What the canvas draws at a zoom: the face that zoom draws (faceRegimeOf), as measured on the served build (body 0.503, line 0.314).
    const drawnAt = (z: number): FaceSnap => { const r = faceRegimeOf(z); return r === 'full' ? snap(F.w2000.full) : snap(F.w1128[r]) }
    const order: FaceRegime[] = ['full', 'body', 'line'], trace = settleLoop((z) => drawnAt(z).nodes as Node[], pane, FREE_1128)
    const seen = trace.map((s) => s.v.zoom), bands = seen.map((z) => order.indexOf(bandOf(z)))
    for (let i = 1; i < bands.length; i += 1) expect(bands[i]!, `fit ${i}: ${seen.join(' → ')}`).toBeGreaterThanOrEqual(bands[i - 1]!)
    const last = trace[trace.length - 1]!.v, face = faceRegimeOf(last.zoom)
    expect(trace[trace.length - 1]!.measuring, 'the frame it rests on is worked out from the drawn face\'s own heights').toBe(false)
    expect(bandOf(last.zoom), 'the face drawn there is the face framed for').toBe(face)
    expect(last.zoom).toBeGreaterThanOrEqual(FACE_RANGE[face][0] - 0.001)
    expect(last.zoom).toBeLessThanOrEqual(FACE_RANGE[face][1] + 0.001)
    expect(inside(face === 'full' ? F.w2000.full.nodes : F.w1128[face].nodes, last, pane, FREE_1128)).toEqual([])
  })
  it('catch (Codex 15 Nov, round 3): the body face is TALLER than the full one here, so the hop to it is a measuring hop (unanimated), and every frame that animates and rests holds the face drawn there whole', () => {
    const pane = F.w1128.pane
    const body = F.w1128.body.nodes as Box[], full = F.w2000.full.nodes as Box[]
    const extent = (bx: Box[]) => Math.max(...bx.map((b) => b.y + b.h)) - Math.min(...bx.map((b) => b.y))
    expect(extent(body)).toBeGreaterThan(extent(full)) // the precondition (1211 against 1061)
    const boxesAt = (z: number): Box[] => { const r = faceRegimeOf(z); return r === 'full' ? full : F.w1128[r].nodes }
    const trace = settleLoop((z) => nodesOf(boxesAt(z)), pane, FREE_1128)
    expect(trace[0]!.measuring, `the first hop, to ${trace[0]!.v.zoom}, draws a face not measured yet`).toBe(true)
    for (const s of trace.filter((t) => !t.measuring)) expect(inside(boxesAt(s.v.zoom), s.v, pane, FREE_1128), `rest at ${s.v.zoom}`).toEqual([])
  })
  it('catch (Codex 15 Nov, round 3): the loop stops BEFORE framing when the settled board is the one it last framed, though the camera moved', () => {
    const box = (id: string, y: number): Node => ({ id, position: { x: 0, y }, data: {}, measured: { width: 248, height: 150 } })
    const nodes = [box('a', 0), box('b', 200), box('c', 400)], pane = { width: 1128, height: 707 }
    const trace = settleLoop(() => nodes, pane, FREE_1128)
    expect(trace).toHaveLength(1) // a zoom-equality stop (after framing again) would have framed twice
    expect(settleDone(settledBoardKey(nodes), settledBoardKey(nodes), 1, nodes.length)).toBe(true)
  })
  it('catch (Codex 15 Nov, round 4): after a measuring hop, a board that is still the one the hop was worked out from is not taken as the new face\'s; when the face redraws late, the frame rests on ITS heights, every card of the face drawn there inside', () => {
    const pane = F.w1128.pane, full = F.w2000.full.nodes as Box[]
    const boxesAt = (z: number): Box[] => { const r = faceRegimeOf(z); return r === 'full' ? full : F.w1128[r].nodes }
    // The new face redraws two settles late: until then the canvas still shows the full faces' heights.
    const trace = settleLoop((z, settles) => nodesOf(settles < 2 && faceRegimeOf(z) !== 'full' ? full : boxesAt(z)), pane, FREE_1128)
    expect(trace[0]!.measuring).toBe(true)
    for (const s of trace.filter((t) => !t.measuring)) expect(inside(boxesAt(s.v.zoom), s.v, pane, FREE_1128), `rest at ${s.v.zoom}`).toEqual([])
    expect(trace[trace.length - 1]!.measuring).toBe(false)
  })
  it('after a measuring hop, a board that never changes is taken as the new face\'s once the wait is up (faces that draw the same), and the loop ends on a measured frame', () => {
    const full = nodesOf(F.w2000.full.nodes), pane = F.w1128.pane
    const trace = settleLoop(() => full, pane, FREE_1128) // every zoom shows the full faces' heights
    expect(trace[0]!.measuring).toBe(true)
    expect(trace.length).toBeGreaterThan(1)
    expect(trace[trace.length - 1]!.measuring).toBe(false)
  })
  it('the band gap (Codex 15 Nov): a frame never rests between the body face\'s drawing threshold and its framing band', () => {
    for (const z of [0.42, 0.43, 0.44, 0.449]) expect(bandOf(z), String(z)).toBe('line')
    expect(bandOf(FACE_RANGE.body[0])).toBe('body')
  })
  it('a reduced snapshot first draws full faces to measure, rather than fitting smaller faces', () => {
    expect(cameraFrame({ line: snap(F.w1128.line) }, { width: 1128, height: 707 }, FREE_1128)!.zoom).toBe(1)
  })
  it('a whole model that fits at reading size still opens whole', () => {
    const full = snap(F.w2000.full), pane = F.w2000.pane
    const v = cameraFrame({ full }, pane, FREE_2000)!
    expect(faceRegimeOf(v.zoom)).toBe('full')
    expect(inside(F.w2000.full.nodes, v, pane, FREE_2000)).toEqual([])
  })
})

describe('a board wider than the stage: no card under the panel (the served old look at 1232, copy :4161, 14 Nov, ran the third option under it)', () => {
  for (const [w, h, dockX] of [[1128, 707, 811], [1232, 704, 885]] as const) {
    it(`OL1 ${w}: every card stands inside the free canvas, left of the panel`, () => {
      const full = snap(F.w2000.full), free = { top: 104, right: w - dockX, bottom: 26, left: 45 }
      const v = cameraFrame({ full }, { width: w, height: h }, free)!
      expect(inside(F.w2000.full.nodes, v, { width: w, height: h }, free)).toEqual([])
    })
  }
})

describe('DL 04:44Z fault 2 at 2000 (served :4161, 05:50Z): a board that fits across but not down opens with every card clear of the panel', () => {
  it('OL2 the whole board is centred across, not its opening cards: no card runs under the dock', () => {
    const box = (id: string, x: number, y: number, family?: string): Node => ({ id, position: { x, y }, data: family ? { card: { family } } : {}, measured: { width: 250, height: 180 } })
    const nodes = [box('page:question', 0, 0), box('aim', 300, 0, 'goal'), ...[0, 1, 2, 3, 4].map((i) => box(`opt${i}`, i * 300, 260)),
      ...Array.from({ length: 12 }, (_, i) => box(`f${i}`, (i % 4) * 300, 520 + Math.floor(i / 4) * 260))]
    const pane = { width: 2000, height: 1200 }, free = { top: 104, right: 2000 - 1640, bottom: 26, left: 45 }
    const v = cameraFrame({ full: { zoom: 1, nodes } }, pane, free)!
    expect(v.zoom).toBeLessThan(1) // 1,300 px tall: framed whole, not opened at full size
    const out = nodes.filter((n) => n.position.x * v.zoom + v.x < free.left - 0.5 || (n.position.x + 250) * v.zoom + v.x > pane.width - free.right + 0.5).map((n) => n.id)
    expect(out).toEqual([])
  })
})
