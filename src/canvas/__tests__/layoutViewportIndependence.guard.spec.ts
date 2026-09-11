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
  LAYOUT_NODE_GAP,
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
/**
 * ⚠ TWO LIMBS, BECAUSE THE TWO APIs SPELL A CLASS DIFFERENTLY — and the first
 * draft of this had a THIRD limb that could never fire. It read
 * `(querySelector|querySelectorAll|getElementsBy\w+)` in front of a mandatory
 * `\.react-flow`, but `getElementsByClassName` takes the class **without a
 * dot**, so that alternative was unreachable while looking exactly like
 * protection. A branch that cannot fire is worse than no branch. Each limb below
 * therefore has its OWN positive control in the test — a shared control proves
 * only that *something* matches, which is how the dead limb survived review.
 */
const DOCUMENT_ROOTED_INSTANCE =
  /document\s*\.\s*(?:querySelector(?:All)?\s*\(\s*[`'"][^`'"]*\.react-flow|getElementsByClassName\s*\(\s*[`'"]\s*react-flow)/

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
    //
    // ⚠⚠ THIS ASSERTION IS THE LOAD-BEARING ONE. Do not delete it believing the
    // labelled negative control at the bottom of this test covers it: that one
    // only shows the detector ignores `marker.closest('.react-flow')`, which is
    // true of ANY detector that requires a leading `document.` — it is nearly
    // free to pass and proves almost nothing. What has teeth is running the
    // detector over the SHIPPED MODULE, which legitimately contains
    // `document.querySelector(CANVAS_LABEL_SCALE_MARKER_SELECTOR)`: a detector
    // written one notch too broad REDs here, on real code, immediately.
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
    // ⭐ ONE POSITIVE CONTROL PER LIMB. A single control proves only that
    // SOMETHING in the alternation matches, which is precisely how a limb that
    // could never fire sat here reading as coverage.
    expect(DOCUMENT_ROOTED_INSTANCE.test("document.querySelector('.react-flow')")).toBe(true)
    expect(DOCUMENT_ROOTED_INSTANCE.test('document.querySelectorAll(".react-flow__node")')).toBe(true)
    expect(
      DOCUMENT_ROOTED_INSTANCE.test("document.getElementsByClassName('react-flow')"),
      'the getElementsByClassName limb does not fire — it takes a class WITHOUT a dot, so a pattern demanding ".react-flow" makes it unreachable',
    ).toBe(true)
    // The labelled negative control. ⚠ Weak by construction — it passes for any
    // detector requiring a leading `document.`, so it is a smoke check, not the
    // evidence. The module-level assertion above is what actually bites.
    expect(
      DOCUMENT_ROOTED_INSTANCE.test("marker.closest('.react-flow')"),
      'the root-selection detector fires on the SANCTIONED form too — it is not discriminating, it is just banning the string',
    ).toBe(false)
    // And it must not fire on the shipped marker lookup, which is a
    // `document.querySelector` that names NO React Flow instance.
    expect(
      DOCUMENT_ROOTED_INSTANCE.test('document.querySelector(CANVAS_LABEL_SCALE_MARKER_SELECTOR)'),
      'the detector fires on the sanctioned marker lookup — it is banning `document.querySelector`, not instance selection',
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
  /**
   * ⭐⭐ RE-RECORDED 12 Sep 2026 — the canonical shape moved ON PURPOSE, and the
   * new shape was VERIFIED before these digests were written down rather than
   * copied out of the failure output.
   *
   * What changed, and why each is intended:
   *   · card width  230 → 260 (minimum) and 320 → 400 (maximum), carrying the
   *     14px type ramp. A card at the old 320 would hold ~19 characters a line
   *     at 14px — below the ~18 that produced this file's recorded clipping
   *     defect.
   *   · tier stride ~146 → ~188, from `LAYOUT_LAYER_GAP` 30 → 72.
   *   · the single-row/multi-row boundary moves 6/7 → 8/9, from
   *     `CANONICAL_LAYOUT_WIDTH` 1185 → 1482. THIS IS THE CHANGE, not a side
   *     effect of it: at 1185 a seven- or eight-wide tier splits, and the three
   *     starters that have one came out PORTRAIT in a LANDSCAPE pane, using
   *     about 30% of the available width. The extent table on
   *     `CANONICAL_LAYOUT_WIDTH` has the before/after for all five.
   *   · `NODE_SINGLE_ROW_FAIR_SHARE_W` is deliberately NOT in this list and
   *     stays at 140. A 12 Sep change deriving it from `NODE_LAYOUT_MIN_W` was
   *     reverted the same day: it reversed a decoupling `layout.ts` states in
   *     the branch itself, and paired with a budget rise it was exactly inert.
   *
   * ⚠ A RE-RECORD IS A CLAIM, so it is ASSERTED rather than asserted-in-prose:
   * the extent test below measures every starter's box and pins that each still
   * fits a 1280 pane above `LABEL_LEGIBLE_ZOOM`. An earlier version of this
   * block stated that property as a sentence with a hand-written figure in it,
   * and the figure was stale within the same session (CLAUDE.md trap 12 — a
   * hand-maintained mirror inside the comment that records a measurement).
   */
  const CANONICAL_SHAPE: Record<StarterId, { digest: string; nodes: number }> = {
    'vendor-selection': { digest: '9653dc88c7f52913', nodes: 19 },
    'market-entry': { digest: 'b60381677e84f5cd', nodes: 18 },
    'build-vs-buy': { digest: '5c9388f3a2daaf84', nodes: 19 },
    'headcount-allocation': { digest: 'fe1e7250cd2ae780', nodes: 16 },
    'pricing-model': { digest: '7873d38f7251d14d', nodes: 15 },
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
    // ⭐ THE GAP IS IMPORTED, NOT RESTATED (12 Sep 2026). This read `20` by hand —
    // `layout.ts`'s old `Math.max(20, …)` floor copied into the guard. When that
    // floor moved to 32 the guard would have gone on deriving a band from a gap
    // the product no longer uses, and certified a packing table it no longer
    // produces. `LAYOUT_NODE_GAP` is now the one source for both.
    return `multi-row/${Math.max(1, Math.floor((availableWidth + LAYOUT_NODE_GAP) / (elkBoxW + LAYOUT_NODE_GAP)))}`
  }

  /**
   * The band the constant was chosen inside, and its two cliffs. Recorded, then
   * PROVEN against the derivation — a constant sitting on a cliff edge is a
   * defect waiting for a rounding change, and a constant nudged across one
   * re-shapes every model silently.
   */
  // ⚠⚠ BOTH CLIFFS MOVED, 12 Sep 2026, and BOTH are still RECORDED BY HAND here
  // and PROVEN against the derivation below. Deriving both sides would make the
  // next assertion a tautology — a guard agreeing with itself (CLAUDE.md trap
  // 13b) — and the whole point of the pair is that derivation proves the
  // consumers agree while a written number notices the constants are wrong.
  //
  // The band is the interval over which packing BEHAVIOUR is constant, and it
  // is bounded by cliffs from TWO different families. Enumerating only one
  // family is how an earlier version of this block put a cliff INSIDE its own
  // band without noticing:
  //
  //     1232   split tiers reach 4 per row        (row-count family)
  //     1238   7-wide tier starts single-rowing   (single-row family)
  //     1417   8-wide tier starts single-rowing   <- BAND.lower
  //     1548   split tiers reach 5 per row        <- BAND.upper
  //     1596   9-wide tier starts single-rowing
  //
  // ⭐ `CANONICAL_LAYOUT_WIDTH` is the MIDPOINT of [1417, 1548) — 65 above, 66
  // below. See its own derivation note for why the interval starts at 1417: an
  // eight-wide tier that splits produces a PORTRAIT model in a LANDSCAPE pane,
  // which is the measured cause of the graph using ~30% of the available width.
  const BAND = { lower: 1417, upper: 1548 } as const

  it('CANONICAL_LAYOUT_WIDTH is strictly inside the band', () => {
    expect(CANONICAL_LAYOUT_WIDTH).toBeGreaterThan(BAND.lower)
    expect(CANONICAL_LAYOUT_WIDTH).toBeLessThan(BAND.upper)
  })

  it('the band edges are exactly where the shipped constants put them', () => {
    // LOWER — an eight-wide tier stops splitting. Below it the model is
    // portrait and the pane is landscape, which is the whole defect.
    expect(BAND.lower).toBe((NODE_SINGLE_ROW_FAIR_SHARE_W + LAYOUT_PADDING_X + MIN_GAP) * 8 - MIN_GAP)
    expect(packingOf(8, BAND.lower)).toBe('single-row')
    expect(packingOf(8, BAND.lower - 1)).not.toBe('single-row')

    // UPPER — a split tier reaches five per row. Crossing it is not harmful,
    // it is simply a different shape, and the band exists so that shape change
    // is a decision rather than a side effect.
    expect(BAND.upper).toBe(5 * (NODE_LAYOUT_MIN_W + LAYOUT_PADDING_X) + 4 * LAYOUT_NODE_GAP)
    expect(packingOf(9, BAND.upper)).toBe('multi-row/5')
    expect(packingOf(9, BAND.upper - 1)).toBe('multi-row/4')
  })

  it('⭐ THE BUDGET IS THE MIDPOINT OF ITS BAND, NOT MERELY INSIDE IT', () => {
    /**
     * "Inside the band" is satisfied by a value one unit from a cliff. This
     * file's standing rule is stronger — a constant near a cliff is a defect
     * waiting for a rounding change — so the rule is asserted, not just stated.
     */
    const below = CANONICAL_LAYOUT_WIDTH - BAND.lower
    const above = BAND.upper - CANONICAL_LAYOUT_WIDTH
    expect(Math.abs(below - above)).toBeLessThanOrEqual(1)
  })

  it('⛔ NO OTHER CLIFF HIDES INSIDE THE BAND', () => {
    /**
     * ⭐⭐ THE ASSERTION THE PREVIOUS VERSION OF THIS BLOCK NEEDED AND DID NOT
     * HAVE. Its band ran [916, 1232] while a single-row cliff sat at 1238 — one
     * family enumerated, the other not, so "inside the band" guaranteed nothing
     * about behaviour. Sweep the whole band and require packing to be genuinely
     * constant across it.
     */
    const shapeAt = (w: number) => [...Array(9)].map((_, i) => packingOf(i + 2, w)).join(',')
    const atBudget = shapeAt(CANONICAL_LAYOUT_WIDTH)
    for (let w = BAND.lower; w < BAND.upper; w++) {
      expect(shapeAt(w), `packing changes at ${w}, which is inside the band`).toBe(atBudget)
    }
    // …and the band is TIGHT: one unit outside it in either direction the shape
    // differs. Without this the test would pass on a band of width 1.
    expect(shapeAt(BAND.lower - 1)).not.toBe(atBudget)
    expect(shapeAt(BAND.upper)).not.toBe(atBudget)
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
      // ⭐⭐ THE BOUNDARY MOVED 6/7 -> 8/9, AND THAT MOVE IS THE CHANGE. Seven-
      // and eight-wide tiers stop splitting, which is what takes three of the
      // five shipped starters from PORTRAIT to LANDSCAPE — see the extent table
      // on `CANONICAL_LAYOUT_WIDTH`. A model whose aspect matches the pane is
      // the difference between using ~30% of the available width and ~95%.
      7: 'single-row',
      8: 'single-row',
      // ⚠ 9–10 are 'multi-row/4', the SAME row count as before this change. The
      // 14px ramp pushes the card floor 230 -> 260, which on its own would have
      // dropped a split tier to three per row; the wider budget pays that back
      // exactly. Attributed by holding one input at a time:
      //     230 floor, budget 1185   4 per row
      //     260 floor, budget 1185   3 per row   <- the ramp costs one
      //     260 floor, budget 1482   4 per row   <- the budget returns it
      9: 'multi-row/4',
      10: 'multi-row/4',
    })
  })

  it('the derivation DISCRIMINATES, and the 8/9 boundary is real in the layout itself', async () => {
    // Arithmetic first — the derivation must not answer the same thing for
    // every input (trap 20: a probe returning identical answers for every item
    // is reporting on itself).
    expect(packingOf(8, CANONICAL_LAYOUT_WIDTH)).not.toBe(packingOf(9, CANONICAL_LAYOUT_WIDTH))

    // …then the same boundary in the REAL layout, bound by identity: at 8 the
    // factor tier occupies one row, at 9 it does not. The arithmetic above and
    // the layout below are independent paths to the same claim — if they ever
    // disagree, `packingOf` has stopped modelling `planLayoutBox`.
    const rowsOfFactors = async (n: number): Promise<number> => {
      const { nodes, edges } = tierOfWidth(n)
      const out = await layoutGraph(nodes, edges, {})
      return new Set(out.nodes.filter((x) => x.id.startsWith('fac_')).map((x) => x.position.y)).size
    }
    expect(await rowsOfFactors(8)).toBe(1)
    expect(await rowsOfFactors(9)).toBeGreaterThan(1)

    // ⭐ AND THE OLD BOUNDARY IS GONE, stated as its own assertion so the move
    // is pinned rather than merely implied: seven used to split and no longer
    // does. A test that only checked the NEW boundary would pass unchanged if
    // the budget silently drifted back.
    expect(await rowsOfFactors(7)).toBe(1)
  })
})
