/**
 * THE MOUNT FIT MUST CARRY THE LEGIBILITY FLOOR — the fit that wins on the
 * RESTORE arm, and the only product-chosen fit that had no floor.
 *
 * THE MEASURED DEFECT (fresh-guest journey witness, 21 Aug 2026, 1280x800, real
 * Chromium): on the RESTORE arm the graph settled at zoom **0.4279**. The label
 * counter-scale is capped at `MAX_LABEL_COUNTER_SCALE` (= 2, reached at exactly
 * `LABEL_LEGIBLE_ZOOM`), so below the floor it has nothing left to give and the
 * rendered size falls with the zoom:
 *
 *     edgeLabel   10px x 2 x 0.4279 = 8.56px   (58 elements)   <- this defect
 *     BaseNode `text-lg` 18px x 0.4279 = 7.70px (Goal node)    <- NOT this one
 *     EvidenceGapBadge 7px x 0.4279 = 3.00px  (2 glyphs)       <- NOT this one
 *
 * ⚠ SCOPE, STATED BEFORE THE CLAIM. Only the FIRST line is a zoom defect. The
 * other two are canvas text declared OUTSIDE the three counter-scaled tokens in
 * `src/styles/typography.ts` (`BaseNode.tsx:500` uses Tailwind `text-lg`;
 * `EvidenceGapBadge.tsx:66` an inline `fontSize: '7px'`), so no fit zoom can
 * lift them to the floor — at `LABEL_LEGIBLE_ZOOM` they render at 9.0px and
 * 3.5px. That is a DIFFERENT defect with a different owner (the canvas type
 * tokens) and a different fix. This spec does not claim it.
 *
 * WHY THE MOUNT FIT IS THE ONE THAT WINS ON RESTORE, derived at the installed
 * bytes (`@xyflow/react` 12.10.2 / `@xyflow/system` 0.0.76):
 *   - `<ReactFlow fitView>` QUEUES a fit (`fitViewQueued: fitView ?? false`)
 *     with `fitViewOptions` taken from the PROP of that name;
 *   - the queued fit is resolved from `setNodes` / `updateNodeInternals`, i.e.
 *     only once nodes are MEASURED (`getFitViewNodes` keeps only nodes with a
 *     `measured.width`) — after the restore trigger's RAF has already run;
 *   - `fitViewport` reads the floor as `options?.minZoom ?? minZoom`, so with
 *     the prop absent it falls through to the canvas's own `minZoom={0.1}`.
 *
 * WHAT THIS SPEC PROVES, AND WHAT IT DOES NOT (CLAUDE.md trap 3). jsdom has no
 * layout, so nothing here measures a rendered glyph. Two claims are made and
 * both are computed:
 *   (a) THE CONTRACT — the canvas that counter-scales its labels hands xyflow
 *       `fitViewOptions` naming `MOUNT_FIT_VIEW_OPTIONS`. Bound BY IDENTITY to
 *       that canvas (the one mounting `CanvasLabelScaleSync`), not to "a
 *       ReactFlow", because the thumbnail and debug canvases must stay free to
 *       zoom out.
 *   (b) THE ARITHMETIC — run through xyflow's OWN `getViewportForBounds`, the
 *       exact function `fitViewport` calls, on geometry derived from the
 *       witnessed zoom. The pixel claim on a real screen belongs to
 *       `e2e/geometry/viewportRestoreFit.measure.ts`, which `Staging Gate` does
 *       not run.
 *
 * Every case has its OPPOSITE-DIRECTION TWIN (trap 22b): the counter-scale must
 * not INFLATE text above the floor, the USER's own zoom-out must stay
 * unclamped, and the guard must NOT be universal over `<ReactFlow>`.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getViewportForBounds } from '@xyflow/react'
import { blankNonCode } from '../../../tests/helpers/stripSourceComments'
import {
  LABEL_LEGIBLE_ZOOM,
  MAX_LABEL_COUNTER_SCALE,
  MOUNT_FIT_VIEW_OPTIONS,
  renderedLabelPx,
} from '../utils/zoomLegibility'

const HERE = dirname(fileURLToPath(import.meta.url))
const CANVAS_ROOT = join(HERE, '..')
const TYPOGRAPHY_FILE = join(HERE, '..', '..', 'styles', 'typography.ts')

const EXCLUDED_DIR_NAMES = new Set(['__tests__', '__fixtures__', '__helpers__', '__mocks__'])

function sourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      if (!EXCLUDED_DIR_NAMES.has(entry)) out.push(...sourceFiles(full))
      continue
    }
    if (!/\.(ts|tsx)$/.test(entry)) continue
    if (/\.(spec|test)\.(ts|tsx)$/.test(entry)) continue
    out.push(full)
  }
  return out
}

interface RfElement {
  file: string
  attrs: string
  children: string
}

/**
 * Every `<ReactFlow …>` JSX element under `src/canvas`, with its attribute text
 * and its children separated.
 *
 * Brace depth is tracked because an attribute value legitimately contains `>`
 * (`onNodeMouseEnter={… ? () => {…} : undefined}`), so "the first `>`" is not
 * the end of the open tag. Comments and string bodies are blanked first
 * (offset-preserving), so prose about `<ReactFlow` cannot read as an element.
 */
function reactFlowElements(file: string, src: string): RfElement[] {
  const out: RfElement[] = []
  const open = '<ReactFlow'
  const re = /<ReactFlow(?![A-Za-z0-9_])/g
  let m: RegExpExecArray | null
  while ((m = re.exec(src)) !== null) {
    let i = m.index + open.length
    let depth = 0
    while (i < src.length) {
      const c = src[i]
      if (c === '{') depth += 1
      else if (c === '}') depth -= 1
      else if (c === '>' && depth === 0) break
      i += 1
    }
    if (i >= src.length) continue
    const selfClosing = src[i - 1] === '/'
    const attrs = src.slice(m.index + open.length, selfClosing ? i - 1 : i)
    let children = ''
    if (!selfClosing) {
      const close = src.indexOf('</ReactFlow>', i)
      children = close === -1 ? '' : src.slice(i + 1, close)
    }
    out.push({ file: relative(CANVAS_ROOT, file), attrs, children })
  }
  return out
}

const ALL_ELEMENTS: RfElement[] = sourceFiles(CANVAS_ROOT).flatMap((f) =>
  reactFlowElements(f, blankNonCode(readFileSync(f, 'utf8'))),
)

/** Elements that queue a fit at mount (a bare or truthy `fitView` prop). */
const WITH_MOUNT_FIT = ALL_ELEMENTS.filter((e) => /(^|\s)fitView(\s|=|$)/.test(e.attrs))

/**
 * THE CANVAS WHOSE LEGIBILITY DEPENDS ON THE FIT ZOOM — bound by identity, not
 * by position or by "the biggest one". `CanvasLabelScaleSync` is the component
 * that writes `--canvas-label-scale` onto a React Flow root, and it is mounted
 * on the main canvas only. A canvas that counter-scales its labels is exactly a
 * canvas whose text size is a function of the zoom the product parks at; a
 * thumbnail that does not counter-scale has no such dependency and must stay
 * free to zoom out.
 */
const COUNTER_SCALED = ALL_ELEMENTS.filter((e) => /\bCanvasLabelScaleSync\b/.test(e.children))

/** The declared canvas type scale, READ from the tokens rather than restated. */
function declaredCanvasSizesPx(): number[] {
  const src = readFileSync(TYPOGRAPHY_FILE, 'utf8')
  const re = /calc\((\d+(?:\.\d+)?)px\*var\(--canvas-label-scale/g
  const out: number[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(src)) !== null) out.push(Number(m[1]))
  return out
}

/** The zoom the 21 Aug fresh-guest witness measured on the RESTORE arm. */
const WITNESSED_RESTORE_FIT_ZOOM = 0.4279
/** The smallest desktop viewport this product commits to. */
const PANE = { width: 1280, height: 800 }
/** The canvas's own floor — what the mount fit fell through to. Not a rule; the fall-through. */
const CANVAS_INSTANCE_MIN_ZOOM = 0.1
const MAX_ZOOM = 4

/**
 * Model bounds whose natural fit at `PANE` is exactly the witnessed zoom.
 * Padding is 0 here so the arithmetic is the clamp and nothing else.
 */
const WITNESSED_BOUNDS = {
  x: 0,
  y: 0,
  width: PANE.width / WITNESSED_RESTORE_FIT_ZOOM,
  height: PANE.height / WITNESSED_RESTORE_FIT_ZOOM,
}

function fitZoomWith(minZoom: number): number {
  return getViewportForBounds(WITNESSED_BOUNDS, PANE.width, PANE.height, minZoom, MAX_ZOOM, 0).zoom
}

describe('the instrument can see, and discriminates (positive + contrast controls)', () => {
  it('finds ReactFlow elements at all, and finds MORE of them than it governs', () => {
    // Non-zero, or every assertion below is vacuous over an empty set.
    expect(ALL_ELEMENTS.length).toBeGreaterThanOrEqual(5)
    expect(WITH_MOUNT_FIT.length).toBeGreaterThanOrEqual(5)
    // CONTRAST: the rule is NOT universal over <ReactFlow>. If every mount-fit
    // canvas were counter-scaled, the identity binding below would be proving
    // nothing that "any ReactFlow" would not also satisfy.
    expect(COUNTER_SCALED.length).toBeLessThan(WITH_MOUNT_FIT.length)
  })

  it('the canvas-type tokens parse, and the canvas floor is DERIVED from them', () => {
    const sizes = declaredCanvasSizesPx()
    // nodeTitle / nodeLabel / edgeLabel — exactly three, by count, so a token
    // added or lost REDs here rather than silently moving the floor.
    expect(sizes).toHaveLength(3)
    expect(Math.min(...sizes)).toBe(10)
  })

  it('judges the witnessed zoom ILLEGIBLE — so a "legible" verdict means something', () => {
    const floorPx = Math.min(...declaredCanvasSizesPx())
    const rendered = renderedLabelPx(floorPx, WITNESSED_RESTORE_FIT_ZOOM)
    // Reproduces the witness to the byte: 10 x 2 x 0.4279.
    expect(rendered).toBeCloseTo(floorPx * MAX_LABEL_COUNTER_SCALE * WITNESSED_RESTORE_FIT_ZOOM, 6)
    expect(rendered).toBeCloseTo(8.558, 3)
    expect(rendered).toBeLessThan(floorPx)
  })
})

describe('the counter-scaled canvas hands xyflow the legibility floor AT MOUNT', () => {
  it('there is exactly one such canvas, and it queues a fit at mount', () => {
    expect(COUNTER_SCALED).toHaveLength(1)
    expect(/(^|\s)fitView(\s|=|$)/.test(COUNTER_SCALED[0]!.attrs)).toBe(true)
  })

  it('supplies fitViewOptions naming MOUNT_FIT_VIEW_OPTIONS', () => {
    const el = COUNTER_SCALED[0]!
    expect(el.attrs).toMatch(/fitViewOptions=\{\s*MOUNT_FIT_VIEW_OPTIONS\s*\}/)
  })

  it('and that constant IS the module floor, not a second literal', () => {
    expect(MOUNT_FIT_VIEW_OPTIONS.minZoom).toBe(LABEL_LEGIBLE_ZOOM)
  })

  it('OPPOSITE DIRECTION — the USER is still free to go below it', () => {
    // The asymmetry the doctrine names: the product may not choose an
    // unreadable view; the user may. "Fixing" the fit by raising the canvas's
    // own minZoom would clamp the user too, and REDs here.
    const el = COUNTER_SCALED[0]!
    expect(el.attrs).toMatch(/minZoom=\{0\.1\}/)
    expect(CANVAS_INSTANCE_MIN_ZOOM).toBeLessThan(LABEL_LEGIBLE_ZOOM)
  })
})

describe("the floor changes the number — xyflow's own fit arithmetic", () => {
  it('CONTRAST: with the fall-through floor the fit parks at the witnessed zoom', () => {
    expect(fitZoomWith(CANVAS_INSTANCE_MIN_ZOOM)).toBeCloseTo(WITNESSED_RESTORE_FIT_ZOOM, 6)
  })

  it('with MOUNT_FIT_VIEW_OPTIONS the same geometry clamps to the floor', () => {
    expect(fitZoomWith(MOUNT_FIT_VIEW_OPTIONS.minZoom)).toBeCloseTo(LABEL_LEGIBLE_ZOOM, 6)
  })

  it('and every counter-scaled token then renders at or above the canvas floor', () => {
    const zoom = fitZoomWith(MOUNT_FIT_VIEW_OPTIONS.minZoom)
    const sizes = declaredCanvasSizesPx()
    const floorPx = Math.min(...sizes)
    for (const declared of sizes) {
      expect(renderedLabelPx(declared, zoom)).toBeGreaterThanOrEqual(floorPx)
    }
    expect(renderedLabelPx(floorPx, zoom)).toBeCloseTo(floorPx, 6)
  })

  it('OPPOSITE DIRECTION — above the floor the counter-scale must not INFLATE text', () => {
    // A "fix" that simply scaled text up would make a 10px token 12.5px at
    // zoom 0.8 and 20px at 1:1. The counter-scale holds rendered === declared.
    expect(renderedLabelPx(10, 0.8)).toBeCloseTo(10, 6)
    expect(renderedLabelPx(10, 1)).toBeCloseTo(10, 6)
    expect(renderedLabelPx(10, 2)).toBeCloseTo(20, 6)
  })

  it('OPPOSITE DIRECTION — a graph that already fits legibly is NOT re-framed', () => {
    // The post-draft arm settles at or above the floor; the clamp must be
    // inert there, or this change would move a frame it has no business moving.
    const roomy = { x: 0, y: 0, width: PANE.width / 0.9, height: PANE.height / 0.9 }
    const withFloor = getViewportForBounds(roomy, PANE.width, PANE.height, MOUNT_FIT_VIEW_OPTIONS.minZoom, MAX_ZOOM, 0)
    const without = getViewportForBounds(roomy, PANE.width, PANE.height, CANVAS_INSTANCE_MIN_ZOOM, MAX_ZOOM, 0)
    expect(withFloor.zoom).toBeCloseTo(without.zoom, 9)
    expect(withFloor.x).toBeCloseTo(without.x, 9)
    expect(withFloor.y).toBeCloseTo(without.y, 9)
  })
})
