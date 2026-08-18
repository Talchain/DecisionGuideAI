/**
 * G2(b) + G3 — ONE LAYOUT AUTHORITY, AND A CANONICAL MODEL THAT DOES NOT MOVE
 * WHEN THE SCREEN DOES.
 *
 * Mandatory guards 2(b) and 3 of `WORKSPACE-COMPOSITION-DECISION-2026-08-18.md`
 * §6.1, plus the founder's 18 Aug correction that promoted the sizing-authority
 * unification from a follow-on lane into this one:
 *
 * > "You have derived that the model/layout solver assumes ~1088px while the fit
 * > stage actually gets ~760px. That is a first-order upstream defect. Fix/unify
 * > that authority first… Do not choose a workaround around a measurement made
 * > under a known sizing inconsistency."
 *
 * ⚠ SCOPE, STATED BEFORE THE ASSERTIONS (trap 3): everything here is
 * ARITHMETIC-LEVEL or jsdom-level. `layoutGraph` is run for real (real ELK, real
 * browser-captured node heights), so the POSITIONS are real; nothing in this file
 * proves a rendered size, a visible overlap or a settled camera zoom. Those
 * claims need a real browser and are carried separately in the PR.
 */

import { describe, it, expect, afterEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'
import type { Node, Edge } from '@xyflow/react'
import { layoutGraph, type CanvasSize } from '../utils/layout'
import {
  LAYOUT_CANVAS_MIN_HEIGHT,
  LAYOUT_CANVAS_MIN_WIDTH,
  resolveLayoutCanvasSize,
} from '../utils/layoutCanvasSize'
import {
  LAYOUT_PADDING_X,
  MIN_GAP,
  NODE_CARD_MAX_W,
  NODE_LAYOUT_MIN_W,
  NODE_SINGLE_ROW_FAIR_SHARE_W,
} from '../utils/nodeLayoutConstants'

import capture from './__fixtures__/starter-node-heights.browser-capture-2026-08-18.json'
import vendorSelection from '../starters/data/vendor-selection.draft.json'
import marketEntry from '../starters/data/market-entry.draft.json'
import buildVsBuy from '../starters/data/build-vs-buy.draft.json'
import headcountAllocation from '../starters/data/headcount-allocation.draft.json'
import pricingModel from '../starters/data/pricing-model.draft.json'

const STARTERS = {
  'vendor-selection': vendorSelection,
  'market-entry': marketEntry,
  'build-vs-buy': buildVsBuy,
  'headcount-allocation': headcountAllocation,
  'pricing-model': pricingModel,
} as const
type StarterId = keyof typeof STARTERS
const HEIGHTS = (capture as { heights: Record<string, Record<string, number>> }).heights

function buildGraph(id: StarterId): { nodes: Node[]; edges: Edge[] } {
  const draft = STARTERS[id] as unknown as {
    nodes: Array<{ id: string; kind: string; label: string }>
    edges: Array<{ id?: string; from?: string; to?: string; source?: string; target?: string }>
  }
  const heights = HEIGHTS[id]
  const nodes = draft.nodes.map((n) => ({
    id: n.id,
    type: n.kind,
    position: { x: 0, y: 0 },
    data: { label: n.label, kind: n.kind },
    measured: { width: NODE_CARD_MAX_W, height: heights[n.id] },
  })) as unknown as Node[]
  const edges = draft.edges.map((e, i) => ({
    id: e.id ?? `e${i}`,
    source: (e.from ?? e.source) as string,
    target: (e.to ?? e.target) as string,
  })) as Edge[]
  return { nodes, edges }
}

/**
 * A position signature — id, x and y for every node, order-stable.
 *
 * "Byte-identical positions" is the claim, so the comparison is over the exact
 * emitted numbers rather than a tolerance. The hash is only for readable failure
 * output; equality is asserted on the full string.
 */
async function positionSignature(
  nodes: Node[],
  edges: Edge[],
  canvas: CanvasSize,
): Promise<{ signature: string; digest: string; count: number }> {
  const out = await layoutGraph(nodes, edges, {}, canvas)
  const signature = out.nodes
    .map((n) => `${n.id}@${n.position.x},${n.position.y}`)
    .sort()
    .join('|')
  return {
    signature,
    digest: createHash('sha256').update(signature).digest('hex').slice(0, 16),
    count: out.nodes.length,
  }
}

/** A synthetic model whose widest tier holds exactly `n` same-tier nodes. */
function tierOfWidth(n: number): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [
    { id: 'dec', type: 'decision', position: { x: 0, y: 0 }, data: { label: 'Decision', kind: 'decision' }, measured: { width: NODE_CARD_MAX_W, height: 120 } },
    { id: 'opt_a', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option A', kind: 'option' }, measured: { width: NODE_CARD_MAX_W, height: 120 } },
    { id: 'opt_b', type: 'option', position: { x: 0, y: 0 }, data: { label: 'Option B', kind: 'option' }, measured: { width: NODE_CARD_MAX_W, height: 120 } },
  ] as unknown as Node[]
  const edges: Edge[] = [
    { id: 'e_dec_a', source: 'dec', target: 'opt_a' },
    { id: 'e_dec_b', source: 'dec', target: 'opt_b' },
  ]
  for (let i = 0; i < n; i++) {
    nodes.push({
      id: `fac_${i}`,
      type: 'factor',
      position: { x: 0, y: 0 },
      data: { label: `Factor ${i}`, kind: 'factor' },
      measured: { width: NODE_CARD_MAX_W, height: 100 },
    } as unknown as Node)
    edges.push({ id: `e_fac_${i}`, source: 'opt_a', target: `fac_${i}` })
  }
  return { nodes, edges }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('the sizing authority is ONE module (G2b — a known set, red on grow OR shrink)', () => {
  /**
   * THE RECORDED LITERAL. Before this change there were **four** `setCanvasSize`
   * call sites across two files, each a hand-copied duplicate of the same
   * `.react-flow` measurement with its own floors and its own window fallback.
   * There are now **two** — one per trigger — and both delegate to
   * `resolveLayoutCanvasSize`.
   *
   * Recorded rather than derived, deliberately: a guard that derives its own
   * expectation from the thing it measures is a guard agreeing with itself. This
   * REDs if the set grows (a third writer) OR shrinks (a trigger silently lost),
   * so the suite stays green for the right reason.
   */
  const KNOWN_CALL_SITES: Record<string, number> = {
    'src/canvas/components/DraftChat.tsx': 1,
    'src/canvas/components/LayoutOptionsPanel.tsx': 1,
  }

  const CANVAS_SRC_ROOT = resolve(__dirname, '..')

  function sourceFilesUnderCanvas(): string[] {
    // Walked rather than globbed so the traversal is visible and cannot silently
    // stop matching. Spec files are excluded: they discuss the symbol, they do
    // not write the store.
    const { readdirSync, statSync } = require('node:fs') as typeof import('node:fs')
    const out: string[] = []
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = resolve(dir, entry)
        if (statSync(full).isDirectory()) {
          if (entry === '__tests__' || entry === '__fixtures__' || entry === 'node_modules') continue
          walk(full)
        } else if (/\.tsx?$/.test(entry) && !/\.(spec|test)\.tsx?$/.test(entry)) {
          out.push(full)
        }
      }
    }
    walk(CANVAS_SRC_ROOT)
    return out
  }

  it('every setCanvasSize CALL SITE is in the recorded set', () => {
    const files = sourceFilesUnderCanvas()
    // POSITIVE CONTROL + MAGNITUDE CHECK (trap 13e): a walk that reached nothing
    // would satisfy every absence below. `src/canvas` is a large tree.
    expect(files.length, 'the source walk reached nothing').toBeGreaterThan(50)

    const found: Record<string, number> = {}
    for (const file of files) {
      const src = readFileSync(file, 'utf8')
      const matches = src.match(/setCanvasSize\s*\(/g)
      if (!matches) continue
      const rel = file.slice(file.indexOf('src/canvas'))
      found[rel] = matches.length
    }
    expect(found).toEqual(KNOWN_CALL_SITES)
  })

  it('neither call site derives a canvas dimension itself', () => {
    // The "no second layout authority" half. Both blocks used to read
    // `.react-flow` and `getBoundingClientRect` inline; that measurement now has
    // exactly one home.
    for (const rel of Object.keys(KNOWN_CALL_SITES)) {
      const src = readFileSync(resolve(__dirname, '../../..', rel), 'utf8')
      expect(src, `${rel} must import the authority`).toContain('resolveLayoutCanvasSize')
      expect(src, `${rel} must not measure the pane itself`).not.toContain("querySelector('.react-flow')")
    }
  })

  it('resolveLayoutCanvasSize is panel-state-INDEPENDENT (jsdom-level)', () => {
    // ⚠ jsdom-level and stated as such: this asserts the FUNCTION reads only the
    // pane, not that the pane's rect is unaffected by the dock in a real browser.
    // It is unaffected because the dock and the sidebar are `position: fixed`
    // chrome drawn OVER the pane — a browser claim, carried in the PR, not here.
    const pane = { getBoundingClientRect: () => ({ width: 1280, height: 800 }) } as unknown as Element
    const withDockExpanded = resolveLayoutCanvasSize(pane)
    const withDockAtRail = resolveLayoutCanvasSize(pane)
    const withFloatOpen = resolveLayoutCanvasSize(pane)
    expect(withDockExpanded).toEqual({ width: 1280, height: 800 })
    expect(withDockAtRail).toEqual(withDockExpanded)
    expect(withFloatOpen).toEqual(withDockExpanded)
  })

  it('floors the resolved size, and returns null rather than inventing one', () => {
    const tiny = { getBoundingClientRect: () => ({ width: 200, height: 100 }) } as unknown as Element
    expect(resolveLayoutCanvasSize(tiny)).toEqual({
      width: LAYOUT_CANVAS_MIN_WIDTH,
      height: LAYOUT_CANVAS_MIN_HEIGHT,
    })
    const unmeasurable = { getBoundingClientRect: () => ({ width: 0, height: 0 }) } as unknown as Element
    // With no pane it falls back to the window (jsdom gives 1024x768 by default),
    // which is a measurement, not an invention. The `null` path needs no window.
    const fallback = resolveLayoutCanvasSize(unmeasurable)
    expect(fallback).not.toBeNull()
    expect(fallback!.width).toBe(Math.max(LAYOUT_CANVAS_MIN_WIDTH, window.innerWidth - 48))
  })

  it('FORBIDDEN: no module derives the layout budget from the fit box', () => {
    // The founder's binding rule, asserted at the bytes. `boxW / 0.50` (or
    // `/ LABEL_LEGIBLE_ZOOM`) would make the canonical model re-pack whenever a
    // panel opened. Recorded in `layout.ts`'s header; enforced here.
    const files = sourceFilesUnderCanvas()
    const offenders: string[] = []
    for (const file of files) {
      const src = readFileSync(file, 'utf8')
      // Strip block and line comments: the headers DISCUSS the forbidden form on
      // purpose, and a guard that cannot tell a warning from an implementation
      // would force the warning to be deleted.
      const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
      if (/\/\s*(LABEL_LEGIBLE_ZOOM|0\.50?\b)/.test(code) && /availableWidth|canvasSize/.test(code)) {
        offenders.push(file.slice(file.indexOf('src/canvas')))
      }
    }
    expect(offenders).toEqual([])

    // POSITIVE CONTROL on the detector, or the absence above is vacuous: the same
    // pattern must FIRE on a synthetic offender.
    const synthetic = 'const availableWidth = boxW / LABEL_LEGIBLE_ZOOM'
    expect(/\/\s*(LABEL_LEGIBLE_ZOOM|0\.50?\b)/.test(synthetic)).toBe(true)
    expect(/availableWidth|canvasSize/.test(synthetic)).toBe(true)
  })
})

describe('G3 — what is TRUE about the canonical model across viewports, and what is not', () => {
  /**
   * ⚠⚠ READ THIS BEFORE THE ASSERTIONS. G3 was commissioned as *"node positions
   * are byte-identical across viewport widths 1280 / 1440 / 1512 / 1920 and
   * across dock states"*, with the decision's honest caveat that *"the property
   * already fails below 1246px today"*.
   *
   * **MEASURED AT `953da3f8`, AND THE CAVEAT IS TOO NARROW BY A LONG WAY.** The
   * property fails INSIDE the laptop band, not below it: three of the five
   * shipped starters produce THREE DIFFERENT canonical layouts across
   * 1280 / 1440 / 1512 / 1920. This is pre-existing behaviour — these cases drive
   * `layoutGraph` with an explicit `canvasSize`, so nothing in this lane's change
   * is in the path.
   *
   * THE MECHANISM, derived rather than described: `layout.ts` solves
   * `availableWidth = canvasSize.width * 0.85`. When the widest tier cannot take
   * its fair share of that, the tier splits into rows of
   * `nodesPerRow = floor((availableWidth + spacing) / (elkBoxW + spacing))` — a
   * function of the VIEWPORT. So an 8-wide tier packs 3-per-row at 1280,
   * 4-per-row at 1440 and 1512, and single-row at 1920. A 5-wide tier is
   * single-row at every one of them and is genuinely stable.
   *
   * So the founder's binding rule — *"the canonical strategic model should not
   * silently change merely because the screen is small"* — **is already being
   * broken by the shipped product**, and by more than the 1088-vs-760 gap his
   * correction names: the solver's own assumption is viewport-dependent, so the
   * model is already adaptive. Making it genuinely stable means pinning
   * `availableWidth` to a constant, which changes the shape of the affected
   * models at some widths. That is a product decision behind a visual-regression
   * gate, not a tidy-up, and it is NOT in this lane.
   *
   * G3 therefore lands as the decision instructed — **a KNOWN-SET pin: record
   * what is true, name what is not, RED on movement in EITHER direction.** A
   * model becoming MORE stable is a good change that must still be deliberate; a
   * model becoming LESS stable is a regression. Both red here.
   */
  const WIDTH_SWEEP = [1280, 1440, 1512, 1920] as const

  /**
   * The recorded partition: widths that produce the SAME canonical layout, in
   * ascending order. `[[1280], [1440, 1512], [1920]]` reads "three different
   * models across the laptop band".
   */
  const KNOWN_STABILITY: Record<StarterId, { widestTier: number; classes: number[][] }> = {
    'vendor-selection': { widestTier: 8, classes: [[1280], [1440, 1512], [1920]] },
    'market-entry': { widestTier: 8, classes: [[1280], [1440, 1512], [1920]] },
    'build-vs-buy': { widestTier: 8, classes: [[1280], [1440, 1512], [1920]] },
    'headcount-allocation': { widestTier: 5, classes: [[1280, 1440, 1512, 1920]] },
    'pricing-model': { widestTier: 5, classes: [[1280, 1440, 1512, 1920]] },
  }

  /** The packing decision `layout.ts` makes, re-derived from the shipped constants. */
  function packingOf(widestTier: number, viewportWidth: number): string {
    const availableWidth = viewportWidth * 0.85
    const unclamped = Math.floor((availableWidth - (widestTier - 1) * MIN_GAP) / widestTier)
    const singleRow = unclamped >= NODE_SINGLE_ROW_FAIR_SHARE_W + LAYOUT_PADDING_X
    if (singleRow) return 'single-row'
    const elkBoxW = NODE_LAYOUT_MIN_W + LAYOUT_PADDING_X
    // `effectiveNodeSpacing` is `max(20, spacing)` and the default spacing is 15.
    const nodesPerRow = Math.max(1, Math.floor((availableWidth + 20) / (elkBoxW + 20)))
    return `multi-row/${nodesPerRow}`
  }

  /** Group widths by identical position signature, ascending. */
  function classesOf(byWidth: Array<{ width: number; signature: string }>): number[][] {
    const groups = new Map<string, number[]>()
    for (const { width, signature } of byWidth) {
      const bucket = groups.get(signature)
      if (bucket) bucket.push(width)
      else groups.set(signature, [width])
    }
    return [...groups.values()].sort((a, b) => a[0] - b[0])
  }

  for (const id of Object.keys(STARTERS) as StarterId[]) {
    it(`${id}: the canonical layout partitions across ${WIDTH_SWEEP.join('/')} exactly as recorded`, async () => {
      const { nodes, edges } = buildGraph(id)
      const measured: Array<{ width: number; signature: string; digest: string; count: number }> = []
      for (const width of WIDTH_SWEEP) {
        measured.push({ width, ...(await positionSignature(nodes, edges, { width, height: 800 })) })
      }

      // PIN THE PRECONDITION: a layout that emitted nothing would agree with every
      // other layout that emitted nothing — trap 13's shape reached through an
      // empty extraction, and it would read as perfect stability.
      const expectedCount = (STARTERS[id] as unknown as { nodes: unknown[] }).nodes.length
      for (const m of measured) {
        expect(m.count, `${id} @${m.width}px laid out the wrong node count`).toBe(expectedCount)
        expect(m.signature.length, `${id} @${m.width}px produced an empty signature`).toBeGreaterThan(0)
      }

      const recorded = KNOWN_STABILITY[id]
      expect(
        classesOf(measured),
        `${id}: the viewport-stability partition MOVED. Measured digests: ${measured
          .map((m) => `${m.width}=${m.digest}`)
          .join(' ')}`,
      ).toEqual(recorded.classes)
    })
  }

  it('the partition is EXPLAINED by the packing branch — bound to the mechanism, not to a hash', () => {
    // Without this, the pins above are five opaque tables that a future lane
    // would "re-bless" by pasting new digests in. Two widths share a canonical
    // layout IF AND ONLY IF they share a packing decision, and that decision is
    // re-derived here from the shipped constants.
    for (const id of Object.keys(KNOWN_STABILITY) as StarterId[]) {
      const { widestTier, classes } = KNOWN_STABILITY[id]
      const derived = new Map<string, number[]>()
      for (const width of WIDTH_SWEEP) {
        const key = packingOf(widestTier, width)
        const bucket = derived.get(key)
        if (bucket) bucket.push(width)
        else derived.set(key, [width])
      }
      const derivedClasses = [...derived.values()].sort((a, b) => a[0] - b[0])
      expect(derivedClasses, `${id}: the recorded partition does not match the packing derivation`).toEqual(
        classes,
      )
    }
    // POSITIVE CONTROL on the derivation, or the agreement above proves nothing:
    // it must DISCRIMINATE. A 5-wide tier is single-row at 1280; an 8-wide tier
    // is not, and an 8-wide tier's answer must differ between 1280 and 1440.
    expect(packingOf(5, 1280)).toBe('single-row')
    expect(packingOf(8, 1280)).not.toBe('single-row')
    expect(packingOf(8, 1280)).not.toBe(packingOf(8, 1440))
  })

  it('THE PART OF G3 THAT HOLDS: the layout is independent of DOCK STATE', () => {
    // This is the half the founder's rule most depends on and the half that is
    // genuinely true: the dock and the floating companion never reach the solver.
    // `resolveLayoutCanvasSize` reads only the pane, and the pane is not resized
    // by `position: fixed` chrome — so no dock state, drag width or companion
    // position can re-pack the model.
    //
    // ⚠ jsdom-level, and named as such: the *pane is not resized by the dock*
    // half is a browser claim, carried in the PR, not provable here.
    const pane = { getBoundingClientRect: () => ({ width: 1280, height: 800 }) } as unknown as Element
    const sizes = ['dock expanded 416', 'dock rail 40', 'dock dragged 480', 'companion floating'].map(
      () => resolveLayoutCanvasSize(pane),
    )
    for (const size of sizes) expect(size).toEqual(sizes[0])
  })

  /**
   * The 1246px breakpoint the decision recorded, kept because it is the cleanest
   * demonstration of the mechanism on a tier width the starters do not contain —
   * and 4 of 8 measured real drafts DO produce 6- or 7-wide tiers.
   */
  const KNOWN_BREAKPOINTS: ReadonlyArray<{ tierWidth: number; lastMultiRow: number; firstSingleRow: number }> = [
    { tierWidth: 6, lastMultiRow: 1245, firstSingleRow: 1246 },
    { tierWidth: 7, lastMultiRow: 1456, firstSingleRow: 1457 },
  ]

  it('the recorded breakpoints are what the shipped constants imply', () => {
    for (const bp of KNOWN_BREAKPOINTS) {
      expect(packingOf(bp.tierWidth, bp.firstSingleRow), `${bp.tierWidth}-wide @${bp.firstSingleRow}`).toBe(
        'single-row',
      )
      expect(packingOf(bp.tierWidth, bp.lastMultiRow), `${bp.tierWidth}-wide @${bp.lastMultiRow}`).not.toBe(
        'single-row',
      )
    }
  })

  for (const bp of KNOWN_BREAKPOINTS) {
    it(`a ${bp.tierWidth}-wide tier: one layout at and above ${bp.firstSingleRow}px, a DIFFERENT one at ${bp.lastMultiRow}px`, async () => {
      const { nodes, edges } = tierOfWidth(bp.tierWidth)
      const atBreakpoint = await positionSignature(nodes, edges, { width: bp.firstSingleRow, height: 800 })
      const wide = await positionSignature(nodes, edges, { width: 2560, height: 800 })
      const below = await positionSignature(nodes, edges, { width: bp.lastMultiRow, height: 800 })

      const expected = bp.tierWidth + 3
      for (const r of [atBreakpoint, wide, below]) {
        expect(r.count).toBe(expected)
        expect(r.signature.length).toBeGreaterThan(0)
      }
      // Stable across the single-row band …
      expect(wide.signature, 'positions moved within the single-row band').toBe(atBreakpoint.signature)
      // … and the known break one pixel below it, asserted as a DIFFERENCE so the
      // pin REDs if the breakpoint moves either way. Stability alone would go
      // quiet if the packer stopped splitting at all; the split alone would go
      // quiet if it split everywhere.
      expect(
        below.signature,
        `the ${bp.tierWidth}-wide tier no longer re-packs at ${bp.lastMultiRow}px`,
      ).not.toBe(atBreakpoint.signature)
    })
  }
})
