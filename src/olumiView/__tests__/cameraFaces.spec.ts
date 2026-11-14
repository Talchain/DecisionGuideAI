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
import { cameraFrame, faceRegimeOf, type FaceSnap } from '../ViewCanvas'

type Box = { id: string; x: number; y: number; w: number; h: number }
const F = JSON.parse(readFileSync(path.resolve('src/olumiView/__tests__/fixtures/live-v4-face-boxes.json'), 'utf8'))
const nodesOf = (bx: Box[]): Node[] => bx.map((b) => ({ id: b.id, position: { x: b.x, y: b.y }, data: {}, measured: { width: b.w, height: b.h } }))
const snap = (s: { zoom: number; nodes: Box[] }): FaceSnap => ({ zoom: s.zoom, nodes: nodesOf(s.nodes) })
const FREE_1128 = { top: 104, right: 1128 - 811, bottom: 26, left: 45 }, FREE_2000 = { top: 104, right: 2000 - 1640, bottom: 26, left: 45 }
const inside = (bx: Box[], v: Viewport, pane: { width: number; height: number }, free: typeof FREE_1128) =>
  bx.filter((b) => { const l = b.x * v.zoom + v.x, t = b.y * v.zoom + v.y; return !(l >= free.left - 0.5 && t >= free.top - 0.5 && l + b.w * v.zoom <= pane.width - free.right + 0.5 && t + b.h * v.zoom <= pane.height - free.bottom + 0.5) }).map((b) => b.id)

describe('the opening uses readable faces and pans overflow', () => {
  it('a model that cannot fit at reading size stays at 100%, with the framing question below the head band', () => {
    const full = snap(F.w2000.full)
    const v = cameraFrame({ full }, { width: 1128, height: 707 }, FREE_1128)!
    expect(v.zoom).toBe(1)
    const q = full.nodes.find((n) => n.id === 'page:question')!
    expect(q.position.y * v.zoom + v.y).toBeGreaterThanOrEqual(FREE_1128.top)
    expect(q.position.x * v.zoom + v.x).toBeGreaterThanOrEqual(FREE_1128.left)
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

describe('DL 05:04Z: a board wider than the stage opens at the stage\'s left edge (old look port of 36d84040)', () => {
  // The served old look at 1232 (copy :4161, 14 Nov) centred the opening cards and ran the third option under the panel.
  for (const [w, h, dockX] of [[1128, 707, 811], [1232, 704, 885]] as const) {
    it(`OL1 ${w}: the board's leftmost card starts at the free canvas's left edge, not centred on the opening cards`, () => {
      const full = snap(F.w2000.full), free = { top: 104, right: w - dockX, bottom: 26, left: 45 }
      const v = cameraFrame({ full }, { width: w, height: h }, free)!
      expect(v.zoom).toBe(1)
      const left = Math.min(...full.nodes.map((n) => n.position.x)) * v.zoom + v.x
      expect(left).toBeCloseTo(free.left, 3)
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
    expect(v.zoom).toBe(1)
    const out = nodes.filter((n) => n.position.x * v.zoom + v.x < free.left - 0.5 || (n.position.x + 250) * v.zoom + v.x > pane.width - free.right + 0.5).map((n) => n.id)
    expect(out).toEqual([])
  })
})
