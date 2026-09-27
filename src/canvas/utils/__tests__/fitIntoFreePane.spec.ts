/**
 * D-2 row (e) — a user fit centres the board in the FREE pane (build train
 * slice D, root R7 "Fit to view sits off-centre"). Measured by the board-states
 * gate (#2184) on Paul's MRR boards at 1280x800: 15.1% of the free pane off
 * centre, 0.0% off the whole canvas (which runs under the dock).
 *
 * The contrast rows run xyflow's OWN `getViewportForBounds` on the same inputs,
 * so the mechanism is pinned, not described: xyflow treats asymmetric padding
 * as a minimum and leaves a height-limited board centred on the whole pane.
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { getViewportForBounds, type Rect } from '@xyflow/react'
import {
  FLOW_MAX_ZOOM,
  FLOW_MIN_ZOOM,
  fitIntoFreePane,
  viewportCentredInFreePane,
} from '../fitIntoFreePane'
import type { FitPadding } from '../computeFitPadding'

/** The served 1280x800 shape: the tools rail on the left, the 319px dock + gap on the right. */
const PANE = { width: 1280, height: 749 }
const PAD: FitPadding = { top: '16px', right: '331px', bottom: '60px', left: '82px' }
const FREE = { l: 82, r: 1280 - 331, t: 16, b: 749 - 60 }
const freeCentreX = (FREE.l + FREE.r) / 2
const freeCentreY = (FREE.t + FREE.b) / 2

const screenCentre = (b: Rect, vp: { x: number; y: number; zoom: number }) => ({
  x: vp.x + (b.x + b.width / 2) * vp.zoom,
  y: vp.y + (b.y + b.height / 2) * vp.zoom,
})

/** A tall board, as Paul's MRR models are: the zoom is set by the HEIGHT. */
const TALL: Rect = { x: -120, y: 40, width: 900, height: 1700 }
/** A wide, short board: the zoom is set by the WIDTH. */
const WIDE: Rect = { x: 0, y: 0, width: 2400, height: 300 }

describe('D-2 (e) — the fit centres in the free pane', () => {
  it('⭐ a tall (height-limited) board is centred in the free pane, both ways', () => {
    const vp = viewportCentredInFreePane({ bounds: TALL, pane: PANE, padding: PAD })
    const c = screenCentre(TALL, vp)
    expect(Math.abs(c.x - freeCentreX)).toBeLessThan(0.5)
    expect(Math.abs(c.y - freeCentreY)).toBeLessThan(0.5)
  })

  it('CONTRAST — xyflow\'s own fit leaves that board centred on the WHOLE pane, off by (right − left) / 2', () => {
    const vp = getViewportForBounds(TALL, PANE.width, PANE.height, FLOW_MIN_ZOOM, FLOW_MAX_ZOOM, PAD)
    const c = screenCentre(TALL, vp)
    expect(Math.abs(c.x - PANE.width / 2)).toBeLessThan(1)
    expect(Math.abs(c.x - freeCentreX)).toBeGreaterThan((331 - 82) / 2 - 1)
  })

  it('the ZOOM is xyflow\'s — only the centring changes', () => {
    for (const b of [TALL, WIDE]) {
      const mine = viewportCentredInFreePane({ bounds: b, pane: PANE, padding: PAD })
      const theirs = getViewportForBounds(b, PANE.width, PANE.height, FLOW_MIN_ZOOM, FLOW_MAX_ZOOM, PAD)
      expect(mine.zoom).toBeCloseTo(theirs.zoom, 6)
    }
  })

  it('CONTRAST — a wide (width-limited) board, where xyflow was already right, lands in the same place', () => {
    const mine = viewportCentredInFreePane({ bounds: WIDE, pane: PANE, padding: PAD })
    const theirs = getViewportForBounds(WIDE, PANE.width, PANE.height, FLOW_MIN_ZOOM, FLOW_MAX_ZOOM, PAD)
    expect(Math.abs(mine.x - theirs.x)).toBeLessThan(1.5) // xyflow floors its applied paddings
    expect(Math.abs(screenCentre(WIDE, mine).x - freeCentreX)).toBeLessThan(0.5)
  })

  it('a board too small to fill the pane clamps at the max zoom and is still centred', () => {
    const tiny: Rect = { x: 10, y: 10, width: 40, height: 20 }
    const vp = viewportCentredInFreePane({ bounds: tiny, pane: PANE, padding: PAD })
    expect(vp.zoom).toBe(FLOW_MAX_ZOOM)
    expect(Math.abs(screenCentre(tiny, vp).x - freeCentreX)).toBeLessThan(0.5)
  })
})

describe('fitIntoFreePane — the flow wiring', () => {
  type N = { id: string; hidden?: boolean }
  const none = (): N[] => []
  const flowEl = { getBoundingClientRect: () => ({ left: 0, top: 51, right: 1280, bottom: 800, width: 1280, height: 749 }) } as unknown as Element

  it('frames the given nodes and places the camera with setViewport', () => {
    const setViewport = vi.fn()
    const getNodesBounds = vi.fn(() => TALL)
    const nodes: N[] = [{ id: 'a' }, { id: 'b' }]
    const moved = fitIntoFreePane({ getNodes: none, getNodesBounds, setViewport }, { nodes, durationMs: 300, reducedMotion: false, flowEl })
    expect(moved).toBe(true)
    expect(getNodesBounds).toHaveBeenCalledWith(nodes)
    expect(setViewport).toHaveBeenCalledTimes(1)
    expect(setViewport.mock.calls[0]![1]).toEqual({ duration: 300 })
    // The reduced-motion guard is the helper's: a user who asked for less motion gets an instant move.
    fitIntoFreePane({ getNodes: none, getNodesBounds, setViewport }, { nodes, durationMs: 300, reducedMotion: true, flowEl })
    expect(setViewport.mock.calls[1]![1]).toEqual({ duration: 0 })
  })

  it('with no nodes given, frames every VISIBLE node, as fitView does', () => {
    const getNodesBounds = vi.fn(() => TALL)
    const all: N[] = [{ id: 'a' }, { id: 'h', hidden: true }, { id: 'b' }]
    fitIntoFreePane({ getNodes: () => all, getNodesBounds, setViewport: vi.fn() }, { nodes: [], flowEl })
    expect(getNodesBounds).toHaveBeenCalledWith([{ id: 'a' }, { id: 'b' }])
  })

  it('leaves the camera alone when there is nothing measurable to frame', () => {
    const setViewport = vi.fn()
    expect(fitIntoFreePane({ getNodes: none, getNodesBounds: () => TALL, setViewport }, { flowEl })).toBe(false)
    expect(fitIntoFreePane({ getNodes: (): N[] => [{ id: 'a' }], getNodesBounds: () => ({ x: 0, y: 0, width: 0, height: 0 }), setViewport }, { flowEl })).toBe(false)
    expect(setViewport).not.toHaveBeenCalled()
  })
})

describe('the three user fits route through it (read from the bytes)', () => {
  const read = (p: string) => readFileSync(resolve(__dirname, '..', '..', p), 'utf8')
  const CALLERS = ['ReactFlowGraph.tsx', 'components/CommandPalette.tsx', 'components/ModelExtentNotice.tsx']

  it('⭐ each calls fitIntoFreePane with the USER bounds, and none passes the dock padding to xyflow\'s fitView', () => {
    for (const f of CALLERS) {
      const src = read(f)
      expect(src, f).toMatch(/fitIntoFreePane\([^)]*\{[\s\S]{0,200}?\.\.\.fitBoundsFor\('user'\)/)
      expect(src, f).not.toMatch(/padding:\s*computeFitPadding\(\)/)
    }
  })

  it('the zoom range the helper clamps to IS every <ReactFlow> prop\'s range — one source, no literal copy', () => {
    const src = read('ReactFlowGraph.tsx')
    const minProps = [...src.matchAll(/minZoom=\{([^}]+)\}/g)].map((m) => m[1]!.trim())
    const maxProps = [...src.matchAll(/maxZoom=\{([^}]+)\}/g)].map((m) => m[1]!.trim())
    expect(minProps.length, 'POSITIVE CONTROL: the props were found').toBeGreaterThan(0)
    expect(new Set(minProps)).toEqual(new Set(['FLOW_MIN_ZOOM']))
    expect(new Set(maxProps)).toEqual(new Set(['FLOW_MAX_ZOOM']))
  })
})
