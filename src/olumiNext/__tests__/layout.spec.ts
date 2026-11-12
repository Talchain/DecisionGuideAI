/**
 * The board's geometry against the look-proof's own pictures. For each of three saved Views at two window sizes the look-proof's page
 * script was made to write its own layout (node ids, kinds, x/y/w/h, every wire's path, every marker, its row report strings); the
 * product's `layout.ts` must reproduce it from the View and the measured heights alone.
 *
 * The Views are a person's real data, so neither they nor the references live in the repo: LOOKPROOF_DIR (the three Views) and
 * LAYOUT_REF_DIR (the six references) are read at run time, and the suite skips when either is absent (CI has neither).
 */
import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import type { View } from '../../olumiView/client'
import { boardNodesOf, boardSizeOf, layoutBoard, type BoardViewport, type LastLine, type WireMarker } from '../layout'

const LOOKPROOF_DIR = process.env.LOOKPROOF_DIR || `${process.env.HOME}/Documents/GitHub/output/ui-ws2-20261112/views`
const LAYOUT_REF_DIR = process.env.LAYOUT_REF_DIR || `${process.env.HOME}/Documents/GitHub/output/ui-slice-20261112/layout-ref`

const BOARDS = [
  { name: 'pending', file: 'pending.json' },
  { name: 'approved', file: 'approved.json' },
  { name: 'workshop', file: 'workshop-workshop.json' },
] as const
const SIZES = ['w2000', 'w1500s133'] as const

interface RefNode { id: string; kind: string; family: string | null; row: number; x: number; y: number; w: number; h: number }
interface RefWire { from: string; to: string; d: string; class: string }
interface Ref {
  viewport: [number, number, number]
  board: [number, number]
  cardW: number
  contentH: number
  questionLastLine: LastLine | null
  rows: Array<{ kind: string; y: number; h: number; ids: string[] }>
  report: { rows: string[]; cardW: number; content_h: number; overlaps: string[]; outside: string[]; board_px: [number, number] }
  nodes: RefNode[]
  wires: RefWire[]
  markers: Array<Record<string, unknown>>
}

const have = existsSync(LOOKPROOF_DIR) && existsSync(LAYOUT_REF_DIR) && BOARDS.every((b) => existsSync(path.join(LOOKPROOF_DIR, b.file)))
  && BOARDS.every((b) => SIZES.every((s) => existsSync(path.join(LAYOUT_REF_DIR, `${b.name}-${s}.json`))))

const TOL = 0.5

/** Equal as strings, or the same text with every number within TOL. Returns which, so the exact count can be reported. */
function sameText(a: string, b: string): 'exact' | 'approx' | 'differs' {
  if (a === b) return 'exact'
  const num = /-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/g
  if (a.replace(num, '#') !== b.replace(num, '#')) return 'differs'
  const na = (a.match(num) || []).map(Number), nb = (b.match(num) || []).map(Number)
  return na.length === nb.length && na.every((x, i) => Math.abs(x - nb[i]) <= TOL) ? 'approx' : 'differs'
}

function markerText(m: WireMarker | Record<string, unknown>): string {
  // one comparable line per marker, kind first, so a mismatch names the kind
  const o = m as Record<string, unknown>
  switch (o.kind) {
    case 'dot': return `dot ${o.cx} ${o.cy} ${o.r}`
    case 'head': return `head ${o.cls} ${o.d}`
    case 'chip': return `chip ${o.cx} ${o.cy} ${o.r} ${o.d}`
    default: return `wmark ${o.d}`
  }
}

// SUSPENDED (DL, 12 Nov): Paul rejected the look the slice wears, so the look-proof is no longer the source of the board's geometry. Kept, not
// deleted, so the identity can be re-pinned to whichever look is chosen.
const SUSPENDED = 'the look-proof is no longer the source (Paul rejected the look, DL 12 Nov)'
describe.skip(`board layout equals the look-proof, node for node and wire for wire [SUSPENDED: ${SUSPENDED}]`, () => {
  const views: Record<string, View> = {}
  const refs: Record<string, Ref> = {}
  if (have) {
    for (const b of BOARDS) {
      views[b.name] = JSON.parse(readFileSync(path.join(LOOKPROOF_DIR, b.file), 'utf8')) as View
      for (const s of SIZES) refs[`${b.name}-${s}`] = JSON.parse(readFileSync(path.join(LAYOUT_REF_DIR, `${b.name}-${s}.json`), 'utf8')) as Ref
    }
  }

  for (const b of BOARDS) {
    for (const s of SIZES) {
      it(`${b.name} ${s}`, () => {
        const view = views[b.name]
        const ref = refs[`${b.name}-${s}`]
        const viewport: BoardViewport = { w: ref.viewport[0], h: ref.viewport[1], scale: ref.viewport[2], board: { w: ref.board[0], h: ref.board[1] } }

        // 1. the nodes: ids, kinds, families, rows, in order, and the width each will be drawn at
        const ns = boardNodesOf(view, viewport)
        expect(ns.map((n) => n.id)).toEqual(ref.nodes.map((n) => n.id))
        expect(ns.map((n) => n.kind)).toEqual(ref.nodes.map((n) => n.kind))
        expect(ns.map((n) => n.family)).toEqual(ref.nodes.map((n) => n.family))
        expect(ns.map((n) => n.row)).toEqual(ref.nodes.map((n) => n.row))
        ns.forEach((n, i) => {
          expect(Math.abs(n.w - ref.nodes[i].w), `${n.id} width`).toBeLessThanOrEqual(TOL)
          expect(Math.abs(n.x - ref.nodes[i].x), `${n.id} x`).toBeLessThanOrEqual(TOL)
        })

        // 2. the layout, fed the measured heights
        const heights = new Map(ref.nodes.map((n) => [n.id, n.h] as const))
        const lay = layoutBoard(view, heights, viewport, { questionLastLine: ref.questionLastLine })
        expect(lay.nodes.map((n) => n.id)).toEqual(ref.nodes.map((n) => n.id))
        let nodesMatched = 0
        lay.nodes.forEach((n, i) => {
          const r = ref.nodes[i]
          expect(Math.abs(n.x - r.x), `${n.id} x`).toBeLessThanOrEqual(TOL)
          expect(Math.abs(n.y - r.y), `${n.id} y`).toBeLessThanOrEqual(TOL)
          expect(Math.abs(n.w - r.w), `${n.id} w`).toBeLessThanOrEqual(TOL)
          expect(n.h, `${n.id} h`).toBe(r.h)
          nodesMatched++
        })
        expect(lay.cardW).toBe(ref.cardW)
        expect(Math.abs(lay.contentH - ref.contentH)).toBeLessThanOrEqual(TOL)
        expect(lay.rows.map((r) => ({ kind: r.kind, ids: r.ids }))).toEqual(ref.rows.map((r) => ({ kind: r.kind, ids: r.ids })))
        expect(lay.report.rows).toEqual(ref.report.rows)
        expect(lay.report.overlaps).toEqual(ref.report.overlaps)
        expect(lay.report.outside).toEqual(ref.report.outside)
        expect(lay.unrouted).toEqual([])

        // 3. the wires: same count, same ends, the path equal as text (numbers within TOL only if the text differs)
        expect(lay.wires.length).toBe(ref.wires.length)
        const how = { exact: 0, approx: 0 }
        lay.wires.forEach((w, i) => {
          const r = ref.wires[i]
          expect([w.from, w.to, w.cls]).toEqual([r.from, r.to, r.class])
          const m = sameText(w.d, r.d)
          expect(m, `wire ${i} ${w.from} -> ${w.to}\n  got ${w.d}\n  ref ${r.d}`).not.toBe('differs')
          how[m === 'exact' ? 'exact' : 'approx']++
        })
        // the markers (arrowheads, dots, sign chips, proposed marks), in drawing order
        const got = lay.wires.flatMap((w) => w.markers.map(markerText))
        const want = ref.markers.map(markerText)
        expect(got.length).toBe(want.length)
        let markerExact = 0
        got.forEach((g, i) => {
          const m = sameText(g, want[i])
          expect(m, `marker ${i}\n  got ${g}\n  ref ${want[i]}`).not.toBe('differs')
          if (m === 'exact') markerExact++
        })

        // eslint-disable-next-line no-console
        console.info(`layout ${b.name} ${s}: nodes ${nodesMatched}/${ref.nodes.length}, wires ${lay.wires.length}/${ref.wires.length} (${how.exact} exact text, ${how.approx} within ${TOL}), markers ${got.length}/${want.length} (${markerExact} exact)`)
      })
    }
  }

  it('the CSS arithmetic alone gives the measured board width at every size, and its height at scale 1', () => {
    for (const k of Object.keys(refs)) {
      const ref = refs[k]
      const got = boardSizeOf({ w: ref.viewport[0], h: ref.viewport[1], scale: ref.viewport[2] })
      expect(got.w, `${k} width`).toBe(ref.board[0])
      // at a fractional device scale the browser snaps the bar and the board by a pixel; that is why `board` can be passed
      expect(Math.abs(got.h - ref.board[1]), `${k} height`).toBeLessThanOrEqual(ref.viewport[2] === 1 ? 0 : 1)
    }
  })
})
