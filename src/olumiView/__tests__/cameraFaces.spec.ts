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
import { cameraFrame, FACE_RANGE, faceRegimeOf, frameFor, type FaceRegime, type FaceSnap } from '../ViewCanvas'

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

  it('1128 (DL-538): with the full face measured and too large to fit whole, the frame stays in the full band, its top under the free canvas\'s top', () => {
    const full = snap(F.w2000.full)
    const v = cameraFrame({ full, body, line }, pane, FREE_1128)!
    expect(faceRegimeOf(v.zoom)).toBe('full')
    expect(v.zoom).toBeGreaterThanOrEqual(FACE_RANGE.full[0])
    const top = Math.min(...F.w2000.full.nodes.map((b: Box) => b.y))
    expect(top * v.zoom + v.y, 'the board\'s top sits at the free canvas\'s top (the rest is panned to)').toBeGreaterThanOrEqual(FREE_1128.top - 1)
    // DL-538: and wider than the free canvas, it starts at the free canvas's left edge (never centred, its first card under the toolbar)
    const left = Math.min(...F.w2000.full.nodes.map((b: Box) => b.x)), right = Math.max(...F.w2000.full.nodes.map((b: Box) => b.x + b.w))
    expect((right - left) * v.zoom, 'precondition: wider than the free canvas').toBeGreaterThan(pane.width - FREE_1128.left - FREE_1128.right)
    expect(left * v.zoom + v.x).toBeCloseTo(FREE_1128.left, 3)
  })

  it('no frame ever opens a reduced face: each measured face alone or together', () => {
    const full = snap(F.w2000.full)
    for (const s of [{ body }, { line }, { full }, { full, body }, { full, line }, { full, body, line }] as Partial<Record<FaceRegime, FaceSnap>>[])
      expect(faceRegimeOf(cameraFrame(s, pane, FREE_1128)!.zoom), JSON.stringify(Object.keys(s))).toBe('full')
  })

  it('2000: the full face, measured, fits whole at the readable zoom or more: framed there, every card and the goal inside', () => {
    const p2 = F.w2000.pane as { width: number; height: number }, full = snap(F.w2000.full)
    expect(faceRegimeOf(full.zoom)).toBe('full')
    const v = cameraFrame({ full }, p2, FREE_2000)!
    expect(faceRegimeOf(v.zoom)).toBe('full')
    expect(inside(F.w2000.full.nodes, v, p2, FREE_2000)).toEqual([])
  })
})
