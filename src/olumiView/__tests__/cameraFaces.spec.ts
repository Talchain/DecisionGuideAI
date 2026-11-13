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

  it('1128: with the body face measured and not fitting in its band, the line face is drawn once at the top of its band', () => {
    const v = cameraFrame({ body }, pane, FREE_1128)!
    expect(v.zoom).toBe(FACE_RANGE.line[1])
  })

  it('1128: with both measured, the frame is the line face, inside its band, every card and the goal inside the free canvas', () => {
    const v = cameraFrame({ body, line }, pane, FREE_1128)!
    expect(faceRegimeOf(v.zoom)).toBe('line')
    expect(v.zoom).toBeGreaterThanOrEqual(FACE_RANGE.line[0])
    expect(v.zoom).toBeLessThanOrEqual(FACE_RANGE.line[1])
    expect(inside(F.w1128.line.nodes, v, pane, FREE_1128), 'cards outside the free canvas').toEqual([])
  })

  it('every frame stays in the band of the heights it was computed from (no swing): each measured face alone', () => {
    for (const [r, s] of [['body', body], ['line', line]] as [FaceRegime, FaceSnap][]) {
      const v = cameraFrame({ [r]: s }, pane, FREE_1128)!
      const landed = faceRegimeOf(v.zoom)
      // a face it has not measured is only ever DRAWN to measure it (the next band down), never framed on another face's heights
      expect(landed === r || (r === 'body' && landed === 'line' && v.zoom === FACE_RANGE.line[1]), `${r} → ${v.zoom}`).toBe(true)
    }
  })

  it('2000: the full face, measured, fits whole at the readable zoom or more: framed there, every card and the goal inside', () => {
    const p2 = F.w2000.pane as { width: number; height: number }, full = snap(F.w2000.full)
    expect(faceRegimeOf(full.zoom)).toBe('full')
    const v = cameraFrame({ full }, p2, FREE_2000)!
    expect(faceRegimeOf(v.zoom)).toBe('full')
    expect(inside(F.w2000.full.nodes, v, p2, FREE_2000)).toEqual([])
  })
})
