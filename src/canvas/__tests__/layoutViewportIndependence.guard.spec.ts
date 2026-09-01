/**
 * R1 — THE CANONICAL LAYOUT DOES NOT MOVE WHEN THE SCREEN DOES.
 *
 * Founder ruling R1, 18 Aug 2026 (`ARCHITECTURE-BOARD.md` §0-RULINGS):
 *
 * > "Stable model, adaptive attention. The canonical graph layout must not
 * > change because viewport width changes. Therefore: remove viewport width as
 * > an authority over canonical row packing; establish ONE stable canonical
 * > layout; responsive behaviour happens through camera/focus/disclosure, not
 * > persisted re-layout."
 *
 * ⚠ THIS FILE REPLACES `layoutSizingAuthority.guard.spec.ts`, whose G3 was
 * landed as a KNOWN-SET PIN — it RECORDED the instability (three of five
 * starters producing three different canonical layouts across
 * 1280/1440/1512/1920) because at that tip the property already failed. It is
 * now an INVARIANT. The RED-first evidence for the change is that flipping that
 * file's `KNOWN_STABILITY` to a single class at `06f745ba` fails on exactly
 * three starters, with distinct position digests per width.
 *
 * ⚠ SCOPE, STATED BEFORE THE ASSERTIONS (CLAUDE.md trap 3): everything here is
 * ARITHMETIC-LEVEL, SOURCE-LEVEL or jsdom-level. `layoutGraph` is run for real
 * (real ELK, real browser-captured node heights), so the POSITIONS are real;
 * nothing in this file proves a rendered size, a visible overlap or a settled
 * camera zoom. Those claims need a real browser and are carried in the PR.
 *
 * ⭐ WHY THE BEHAVIOURAL HALF IS NOT VACUOUS. `layoutGraph` no longer takes a
 * size, so "identical across four widths" is true by construction TODAY — which
 * is exactly the property, and exactly the shape of a test that could go quiet.
 * Three things stop it: the precondition is PINNED IN-TEST (the swept width is
 * asserted to be observable to the module under test, via `window` and the live
 * `.react-flow` rect, so a leak would have something to read); a CONTRAST
 * CONTROL proves the signature function discriminates at all; and the
 * STRUCTURAL half below asserts, at the bytes, that no runtime dimension can
 * reach the pipeline in the first place. The mutant that proves it bites —
 * restoring `availableWidth = <pane width> * 0.85` — is recorded in the PR.
 */

import { describe, it, expect, afterEach } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'
import type { Node, Edge } from '@xyflow/react'
import { layoutGraph } from '../utils/layout'
import {
  CANONICAL_LAYOUT_WIDTH,
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

const REPO_ROOT = resolve(__dirname, '../../..')
const CANVAS_SRC_ROOT = resolve(__dirname, '..')

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
 * A position signature — id, x and y for every node, order-stable. "Byte-
 * identical positions" is the claim, so the comparison is over the exact
 * emitted numbers rather than a tolerance. The hash is only for readable
 * failure output; equality is asserted on the full string.
 */
async function positionSignature(
  nodes: Node[],
  edges: Edge[],
): Promise<{ signature: string; digest: string; count: number }> {
  const out = await layoutGraph(nodes, edges, {})
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

/**
 * Walk `src/canvas` rather than glob it, so the traversal is visible and cannot
 * silently stop matching. Spec and fixture directories are excluded: they
 * DISCUSS the forbidden shapes on purpose.
 */
function sourceFilesUnderCanvas(): string[] {
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

/** Strip block and line comments — the headers warn about these shapes deliberately. */
function codeOf(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
}

/** Anything that varies at runtime and could re-enter the solver. */
const RUNTIME_DIMENSION = /innerWidth|innerHeight|getBoundingClientRect|visualViewport|clientWidth|clientHeight|matchMedia|['"`]\.react-flow['"`]|canvasSize/

/**
 * The modules that make up the canonical-layout pipeline. Recorded, not derived
 * — and therefore a hand-maintained mirror that WENT SHORT (CLAUDE.md trap 12):
 * `measureNodeHeightsAtLabelBound.ts` joined the pipeline on 1 Sep 2026 and this
 * list did not know about it, so a genuine pipeline module sat outside the ban
 * with nothing going red. Adding a module here is part of adding it to the
 * pipeline.
 */
const LAYOUT_PIPELINE = [
  'src/canvas/utils/layout.ts',
  'src/canvas/utils/nodeLayoutConstants.ts',
  'src/canvas/layoutStore.ts',
  'src/canvas/utils/measureNodeHeightsAtLabelBound.ts',
] as const

/**
 * ⭐⭐ ONE MODULE IN THE PIPELINE TOUCHES THE REACT FLOW ROOT ON PURPOSE, AND THE
 * BAN ABOVE CONFLATES TWO QUESTIONS (CLAUDE.md trap 21 — two harms under one
 * predicate is two questions under one name).
 *
 * `RUNTIME_DIMENSION` includes `'.react-flow'` as a PROXY for "reads a size that
 * varies with the viewport". `measureNodeHeightsAtLabelBound` reads the React
 * Flow root, and reads NO such size: it pins `--canvas-label-scale` to the
 * CONSTANT `MAX_LABEL_COUNTER_SCALE` and reads `offsetHeight`, which is
 * unzoomed model px. It exists precisely BECAUSE the pipeline had a hidden
 * viewport input — the live zoom, arriving through `node.measured.height`,
 * measured at ×2.05 between zoom 1.0 and 0.5 — and it removes it. Silence would
 * be worse than an exception, so the exemption is NARROW and PINNED: the module
 * must reference the constant, and must not reference any varying dimension.
 */
const LABEL_BOUND_MEASURER = 'src/canvas/utils/measureNodeHeightsAtLabelBound.ts'
/** `.react-flow` alone, with the varying dimensions removed — see above. */
const VARYING_DIMENSION = /innerWidth|innerHeight|getBoundingClientRect|visualViewport|clientWidth|clientHeight|matchMedia|canvasSize/

/**
 * ⭐⭐⭐ THE FIRST VERSION OF THIS EXEMPTION WAS THE DEFECT IT WAS ADDED BESIDE.
 *
 * It dropped `.react-flow` from the detector and pinned two things in its place:
 * that the module measures at the CONSTANT bound, and that it reads no varying
 * dimension. Both true, both beside the point — because in THIS module
 * `.react-flow` was never a proxy for "a varying size". It is the selector that
 * decides **WHICH INSTANCE**, and the exemption pinned nothing about that. So
 * the module shipped `document.querySelector('.react-flow')`, the exact form its
 * own partner bans by name, and the guard that encoded the rule had just been
 * widened by the change that needed catching. (CLAUDE.md trap 21: two harms
 * under one predicate is two questions under one name — and the answer is to
 * name them apart, not to drop one.)
 *
 * So the two questions are now asked separately. `VARYING_DIMENSION` asks "does
 * it read a size that moves with the viewport?"; `DOCUMENT_ROOTED_INSTANCE` asks
 * "does it pick a React Flow instance from the DOCUMENT rather than from its own
 * marker?" — and the second is asked of the exempted module SPECIFICALLY,
 * because it is the only module the first question was relaxed for.
 */
const DOCUMENT_ROOTED_INSTANCE = /document\s*\.\s*(querySelector|querySelectorAll|getElementsBy\w+)\s*\(\s*[`'"][^`'"]*\.react-flow/

afterEach(() => {
  document.querySelectorAll('.react-flow').forEach((el) => el.remove())
})

describe('R1 (structural) — no runtime dimension can reach the canonical layout', () => {
  it('layoutGraph takes NO size parameter', () => {
    const src = readFileSync(resolve(REPO_ROOT, 'src/canvas/utils/layout.ts'), 'utf8')
    const m = /export async function layoutGraph\(([\s\S]*?)\):/.exec(src)
    expect(m, 'layoutGraph signature not found — this guard is measuring nothing').not.toBeNull()
    const params = m![1]
    // Bind by IDENTITY of the parameter list, not by a count another shape could
    // satisfy: name every parameter that is allowed to exist.
    const names = params
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => l.split(/[:=]/)[0].trim().replace(/,$/, ''))
    expect(names).toEqual(['nodes', 'edges', 'options'])
    expect(params).not.toMatch(/canvas|width|height|viewport|size/i)
  })

  it('no module in the canonical-layout pipeline reads a runtime dimension', () => {
    const offenders: string[] = []
    for (const rel of LAYOUT_PIPELINE) {
      const full = resolve(REPO_ROOT, rel)
      expect(existsSync(full), `${rel} is missing — this guard is measuring nothing`).toBe(true)
      const code = codeOf(readFileSync(full, 'utf8'))
      // The narrow exemption, and only for the one named module.
      const detector = rel === LABEL_BOUND_MEASURER ? VARYING_DIMENSION : RUNTIME_DIMENSION
      if (detector.test(code)) offenders.push(rel)
    }
    expect(offenders).toEqual([])

    // ⭐ THE EXEMPTION PINS ITS OWN PRECONDITION (CLAUDE.md trap 13b): an
    // exemption that only SUBTRACTS a rule is a hole. These two assertions are
    // what make it a narrower rule instead — the module must measure at the
    // CONSTANT bound, and must still be blind to every varying dimension.
    const measurer = codeOf(readFileSync(resolve(REPO_ROOT, LABEL_BOUND_MEASURER), 'utf8'))
    expect(
      measurer,
      'the exempted measurer no longer pins the scale to its constant bound — the exemption is now a hole',
    ).toMatch(/MAX_LABEL_COUNTER_SCALE/)
    expect(
      VARYING_DIMENSION.test(measurer),
      'the exempted measurer started reading a varying dimension',
    ).toBe(false)

    // ⭐ ROOT SELECTION — the half the first exemption did not ask about.
    expect(
      DOCUMENT_ROOTED_INSTANCE.test(measurer),
      'the exempted measurer picks a React Flow instance from the DOCUMENT. In comparison mode the main canvas is unmounted and the only roots are two MiniCanvases rendering the same node ids, so this binds to a mini-map and returns its heights under the real nodes\' ids — which getNodeDimensions PREFERS over measured.height. Select up from the CanvasLabelScaleSync marker instead.',
    ).toBe(false)
    expect(
      measurer,
      'the exempted measurer no longer selects from the label-scale marker — there is nothing tying it to the MAIN canvas',
    ).toMatch(/CANVAS_LABEL_SCALE_MARKER_SELECTOR[\s\S]*\.closest\(/)

    // The two detectors must genuinely differ, or this is not an exemption at
    // all, it is the same rule twice...
    expect(RUNTIME_DIMENSION.test("document.querySelector('.react-flow')")).toBe(true)
    expect(VARYING_DIMENSION.test("document.querySelector('.react-flow')")).toBe(false)
    // ...and the replacement must genuinely BITE on what the drop let through.
    // Without these three the exemption could be narrowed by a regex that
    // matches nothing, which reads identically green.
    expect(DOCUMENT_ROOTED_INSTANCE.test("document.querySelector('.react-flow')")).toBe(true)
    expect(DOCUMENT_ROOTED_INSTANCE.test('document.querySelectorAll(".react-flow__node")')).toBe(true)
    expect(
      DOCUMENT_ROOTED_INSTANCE.test("marker.closest('.react-flow')"),
      'the root-selection detector fires on the SANCTIONED form too — it is not discriminating, it is just banning the string',
    ).toBe(false)

    // POSITIVE CONTROL on the detector — a synthetic offender must fire.
    expect(RUNTIME_DIMENSION.test('const w = window.innerWidth * 0.85')).toBe(true)
    expect(RUNTIME_DIMENSION.test("document.querySelector('.react-flow')")).toBe(true)

    // ⭐ CONTRAST CONTROL, in the SAME run and against the REAL tree (trap 13e):
    // a synthetic control only proves the regex compiles. Modules that
    // legitimately measure the pane still exist in this repo — they answer the
    // PRESENTATION question ("how much canvas can the user see right now?"),
    // which R1 explicitly keeps. The detector must find them, or the zero above
    // is instrument blindness rather than a fact about the pipeline.
    const seers = sourceFilesUnderCanvas().filter((f) =>
      RUNTIME_DIMENSION.test(codeOf(readFileSync(f, 'utf8'))),
    )
    expect(
      seers.length,
      'the detector found NO pane-measuring module anywhere in src/canvas — it is blind',
    ).toBeGreaterThan(3)
    expect(
      seers.map((f) => f.slice(f.indexOf('src/canvas'))),
    ).toContain('src/canvas/utils/computeFitPadding.ts')
  })

  it('the old sizing authority is DELETED, not merely unused', () => {
    // `layoutCanvasSize.ts` existed to answer "how wide may the canonical model
    // be?" from the live pane. A plumbed-but-ignored authority is how this
    // defect returns, so the file and its store field are gone.
    expect(existsSync(resolve(REPO_ROOT, 'src/canvas/utils/layoutCanvasSize.ts'))).toBe(false)

    const withSetter: string[] = []
    for (const file of sourceFilesUnderCanvas()) {
      if (/setCanvasSize|resolveLayoutCanvasSize/.test(codeOf(readFileSync(file, 'utf8')))) {
        withSetter.push(file.slice(file.indexOf('src/canvas')))
      }
    }
    expect(withSetter).toEqual([])

    // CONTRAST CONTROL: the same walk, same predicate shape, on a setter that
    // DOES still exist. A walk that reached nothing would satisfy the assertion
    // above (trap 13e: absence needs a contrast that reads non-zero).
    const withLivingSetter = sourceFilesUnderCanvas().filter((f) =>
      /setLayoutNodeWidth/.test(codeOf(readFileSync(f, 'utf8'))),
    )
    expect(
      withLivingSetter.length,
      'the walk found no setLayoutNodeWidth either — the walk, not the code, is empty',
    ).toBeGreaterThan(0)
  })

  it('FORBIDDEN: no module derives the layout budget from the fit box', () => {
    // `availableWidth = boxW / LABEL_LEGIBLE_ZOOM` makes the solver's assumption
    // and the camera's frame agree by construction — and the fit box is a
    // function of PANEL STATE, so the canonical model would re-pack whenever a
    // panel opened. Recorded in `layout.ts`'s header; enforced here.
    const offenders: string[] = []
    for (const file of sourceFilesUnderCanvas()) {
      const code = codeOf(readFileSync(file, 'utf8'))
      if (/\/\s*(LABEL_LEGIBLE_ZOOM|0\.50?\b)/.test(code) && /availableWidth|CANONICAL_LAYOUT_WIDTH/.test(code)) {
        offenders.push(file.slice(file.indexOf('src/canvas')))
      }
    }
    expect(offenders).toEqual([])

    // POSITIVE CONTROL on the detector, or the absence above is vacuous.
    const synthetic = 'const availableWidth = boxW / LABEL_LEGIBLE_ZOOM'
    expect(/\/\s*(LABEL_LEGIBLE_ZOOM|0\.50?\b)/.test(synthetic)).toBe(true)
    expect(/availableWidth|CANONICAL_LAYOUT_WIDTH/.test(synthetic)).toBe(true)
  })
})

describe('R1 (acceptance) — one canonical layout at 1280 / 1440 / 1512 / 1920', () => {
  const WIDTH_SWEEP = [1280, 1440, 1512, 1920] as const

  /**
   * Make the swept width genuinely OBSERVABLE to the module under test, and
   * assert that it is. If a leak were re-introduced — through `window`, through
   * the live pane rect, or through the store — it would have a real, differing
   * value to read at each step. Without this, "identical at four widths" is a
   * sentence about a loop that changed nothing.
   */
  function presentViewport(width: number): void {
    Object.defineProperty(window, 'innerWidth', { value: width, configurable: true, writable: true })
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true, writable: true })
    document.querySelectorAll('.react-flow').forEach((el) => el.remove())
    const pane = document.createElement('div')
    pane.className = 'react-flow'
    pane.getBoundingClientRect = () =>
      ({ width, height: 800, top: 0, left: 0, right: width, bottom: 800, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect
    document.body.appendChild(pane)

    // PIN THE PRECONDITION — both channels really report the swept width.
    expect(window.innerWidth, 'window did not take the swept width').toBe(width)
    expect(
      (document.querySelector('.react-flow') as HTMLElement).getBoundingClientRect().width,
      'the pane rect did not take the swept width',
    ).toBe(width)
  }

  for (const id of Object.keys(STARTERS) as StarterId[]) {
    it(`${id}: ONE canonical layout across ${WIDTH_SWEEP.join('/')}`, async () => {
      const { nodes, edges } = buildGraph(id)
      const measured: Array<{ width: number; signature: string; digest: string; count: number }> = []
      for (const width of WIDTH_SWEEP) {
        presentViewport(width)
        measured.push({ width, ...(await positionSignature(nodes, edges)) })
      }

      // A layout that emitted nothing would agree with every other layout that
      // emitted nothing, and would read as perfect stability (trap 13's shape
      // reached through an empty extraction).
      const expectedCount = (STARTERS[id] as unknown as { nodes: unknown[] }).nodes.length
      for (const m of measured) {
        expect(m.count, `${id} @${m.width}px laid out the wrong node count`).toBe(expectedCount)
        expect(m.signature.length, `${id} @${m.width}px produced an empty signature`).toBeGreaterThan(0)
      }

      const distinct = new Set(measured.map((m) => m.signature))
      expect(
        distinct.size,
        `${id}: the canonical layout CHANGED with the viewport. Digests: ${measured
          .map((m) => `${m.width}=${m.digest}`)
          .join(' ')}`,
      ).toBe(1)
    })
  }

  it('CONTRAST CONTROL: the signature discriminates — a different model gives a different layout', async () => {
    // Without this, "one signature across four widths" is equally consistent
    // with a signature function that returns the same string for everything.
    presentViewport(1280)
    const six = await positionSignature(...(({ nodes, edges }) => [nodes, edges] as const)(tierOfWidth(6)))
    const seven = await positionSignature(...(({ nodes, edges }) => [nodes, edges] as const)(tierOfWidth(7)))
    expect(six.count).toBe(9)
    expect(seven.count).toBe(10)
    expect(seven.signature).not.toBe(six.signature)
  })

  /**
   * THE RECORDED CANONICAL SHAPE — one digest per starter, not four.
   *
   * Recorded rather than derived: a shape table derived from the layout it
   * describes is a guard agreeing with itself. This REDs whenever a canonical
   * shape moves, in either direction, so the change has to be deliberate. It is
   * NOT a visual-regression reference and must not be re-blessed by pasting new
   * digests — a moved digest is a product decision.
   *
   * ⭐ These are not new shapes. Measured against the pristine `06f745ba` layout
   * module run side by side, the pin reproduces BYTE-FOR-BYTE the shape the
   * product already shipped at 1440 and 1512 — the founder's own machine. What
   * changes is that a 1280 and a 1920 user now get that same shape instead of
   * two different ones.
   */
  /*
   * ⭐ RE-RECORDED 1 Sep 2026 — the node title went 13px → 12px, so the card
   * floor went 244 → 230 and three of the five starters legitimately repack.
   * Stated here because the block above is explicit that "a moved digest is a
   * product decision" and must not be re-blessed silently:
   *
   *   vendor-selection  965ce13a0c023c31 → 5ef77f9459d9b7d5
   *   market-entry      ea8e81e6fe7d4278 → 463368facba15056
   *   build-vs-buy      27c5080706eb0760 → 7af988986c1d41f1
   *
   * ⛔ WHAT DID **NOT** MOVE IS THE POINT, and it is why this is a re-record
   * rather than a broken ruling: every R1 acceptance test stayed GREEN — one
   * canonical layout across 1280 / 1440 / 1512 / 1920 for all five starters,
   * and the contrast control still discriminates. The shape changed; its
   * INDEPENDENCE FROM THE VIEWPORT did not, which is the property R1 names.
   * `headcount-allocation` and `pricing-model` did not move at all — the same
   * two that held through the #1067 glyph change, so the repack is a real
   * consequence of card width and not global churn.
   */
  const CANONICAL_SHAPE: Record<StarterId, { digest: string; nodes: number }> = {
    'vendor-selection': { digest: '5ef77f9459d9b7d5', nodes: 19 },
    'market-entry': { digest: '463368facba15056', nodes: 18 },
    'build-vs-buy': { digest: '7af988986c1d41f1', nodes: 19 },
    'headcount-allocation': { digest: '4055b1313f4caf01', nodes: 16 },
    'pricing-model': { digest: 'ac60debf91cc922e', nodes: 15 },
  }

  it.each(Object.keys(STARTERS) as StarterId[])(
    '%s: the canonical shape is the recorded one',
    async (id) => {
      presentViewport(1280)
      const { nodes, edges } = buildGraph(id)
      const got = await positionSignature(nodes, edges)
      expect(got.count).toBe(CANONICAL_SHAPE[id].nodes)
      expect(got.digest, `${id}: the canonical shape moved`).toBe(CANONICAL_SHAPE[id].digest)
    },
  )
})

describe('the pinned budget sits inside its band, and both cliffs are named', () => {
  /** `layout.ts`'s packing decision, re-derived from the shipped constants. */
  function packingOf(widestTier: number, availableWidth: number): string {
    const unclamped = Math.floor((availableWidth - (widestTier - 1) * MIN_GAP) / widestTier)
    if (unclamped >= NODE_SINGLE_ROW_FAIR_SHARE_W + LAYOUT_PADDING_X) return 'single-row'
    const elkBoxW = NODE_LAYOUT_MIN_W + LAYOUT_PADDING_X
    // `effectiveNodeSpacing` is `max(20, spacing)` and the default spacing is 15.
    return `multi-row/${Math.max(1, Math.floor((availableWidth + 20) / (elkBoxW + 20)))}`
  }

  /**
   * The band the constant was chosen inside, and its two cliffs. Recorded, then
   * PROVEN against the derivation — a constant sitting on a cliff edge is a
   * defect waiting for a rounding change, and a constant nudged across one
   * re-shapes every model silently.
   */
  // ⚠ LOWER CLIFF 1132 → 1076, because it IS the width of a four-card row and
  // the card narrowed: 4 × (230 + 24) + 3 × 20 = 1076. The upper cliff is a
  // tier-splitting bound and does not depend on card width, so it holds. The
  // pinned budget 1185 stays inside the band — and the packing table below is
  // UNCHANGED at that budget, which is the useful fact: cards got narrower
  // WITHOUT changing how many sit in a row, so the graph gets narrower and
  // shorter rather than repacking into a different shape.
  const BAND = { lower: 1076, upper: 1238 } as const

  it('CANONICAL_LAYOUT_WIDTH is strictly inside the band', () => {
    expect(CANONICAL_LAYOUT_WIDTH).toBeGreaterThan(BAND.lower)
    expect(CANONICAL_LAYOUT_WIDTH).toBeLessThan(BAND.upper)
  })

  it('the band edges are exactly where the shipped constants put them', () => {
    // Lower cliff = the width of a four-card row. One unit below it, a split
    // tier drops to THREE per row (taller models, measured worse).
    expect(BAND.lower).toBe(4 * (NODE_LAYOUT_MIN_W + LAYOUT_PADDING_X) + 3 * 20)
    expect(packingOf(7, BAND.lower)).toBe('multi-row/4')
    expect(packingOf(7, BAND.lower - 1)).toBe('multi-row/3')
    // Upper cliff = 179*7 - 15, where a SEVEN-wide tier stops splitting and
    // becomes a 2504-unit single row.
    expect(BAND.upper).toBe(179 * 7 - 15)
    expect(packingOf(7, BAND.upper - 1)).toBe('multi-row/4')
    expect(packingOf(7, BAND.upper)).toBe('single-row')
  })

  it('the whole packing table at the pinned budget, recorded', () => {
    // The shape of every model the product can produce, in one place. A change
    // to any layout constant that moves a row REDs here by name.
    const table: Record<number, string> = {}
    for (let t = 2; t <= 10; t++) table[t] = packingOf(t, CANONICAL_LAYOUT_WIDTH)
    expect(table).toEqual({
      2: 'single-row',
      3: 'single-row',
      4: 'single-row',
      5: 'single-row',
      6: 'single-row',
      7: 'multi-row/4',
      8: 'multi-row/4',
      9: 'multi-row/4',
      10: 'multi-row/4',
    })
  })

  it('the derivation DISCRIMINATES, and the 6/7 boundary is real in the layout itself', async () => {
    // Arithmetic first — the derivation must not answer the same thing for
    // every input (trap 20: a probe returning identical answers for every item
    // is reporting on itself).
    expect(packingOf(6, CANONICAL_LAYOUT_WIDTH)).not.toBe(packingOf(7, CANONICAL_LAYOUT_WIDTH))

    // …then the same boundary in the REAL layout, bound by identity: at 6 the
    // factor tier occupies one row, at 7 it does not.
    const rowsOfFactors = async (n: number): Promise<number> => {
      const { nodes, edges } = tierOfWidth(n)
      const out = await layoutGraph(nodes, edges, {})
      return new Set(out.nodes.filter((x) => x.id.startsWith('fac_')).map((x) => x.position.y)).size
    }
    expect(await rowsOfFactors(6)).toBe(1)
    expect(await rowsOfFactors(7)).toBeGreaterThan(1)
  })
})
