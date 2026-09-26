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
  MAX_CARDS_PER_ROW,
  NODE_CARD_MAX_W,
} from '../utils/nodeLayoutConstants'
import { balancedRowSizes } from '../utils/layout'

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

describe('R1 (acceptance) — one canonical layout at 1280 / 1440 / 1512 / 1600 / 1668 / 1920', () => {
  /**
   * ⚠ 1600 AND 1668 ADDED 12 Sep 2026, and the reason is a finding against this
   * very guard. It swept 1280/1440/1512/1920 and contained 1600 NOWHERE — while
   * 1600 is exactly the width at which `needsSingleExpandedPanel` flips when
   * `CANONICAL_LAYOUT_WIDTH` moves. This guard was offered as proof that "only
   * the value moved" and was pointed at a width set that skips the width where
   * the behaviour turns. A capture proves what it was pointed at.
   *
   * The two new members are not arbitrary: 1600 is the low edge of the band the
   * budget change newly constrains and 1668 is its high edge (see
   * `components/__tests__/panelComposition.spec.ts`). R1's claim is that the
   * LAYOUT is identical at every width — so these must produce the same digest
   * as the rest, and if they ever do not, the panel-composition flip has leaked
   * into the canonical geometry, which is precisely what R1 forbids.
   */
  const WIDTH_SWEEP = [1280, 1440, 1512, 1600, 1668, 1920] as const

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
   *   · card width  230 → 260 (minimum) and 320 → 336 (maximum), carrying the
   *     14px type ramp.
   *
   *     ⛔ 400 WAS TRIED AND `e2e/visual/firstViewFraming.visual.spec.ts` REFUTED
   *     IT — 4 of the 5 starters failed, with an option sitting under the
   *     Outputs dock at 1280x800. That spec pins a ratified requirement from
   *     30 Aug 2026: the first view must contain the decision and EVERY option,
   *     because "the decision and the options are what a decision model IS".
   *     The options row is laid on the global stride, so widening the card
   *     widens it, and at 1280 the visible box cannot take four cards at 400.
   *     Bounded empirically rather than argued: 336 passes, 360 fails.
   *
   *     ⭐ The budget change is INDEPENDENT of this and is where the reported
   *     defect is actually fixed — 320 with the 1482 budget already passes
   *     first-view framing. Card width is the smaller half of this change and
   *     was the half that had to give.
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
  /**
   * ⭐⭐ RE-RECORDED 14 Sep 2026 — risks joined the outcome tier by founder
   * ruling, and the new shape was VERIFIED BEFORE these digests were written
   * down rather than copied out of the failure output. That is this block's own
   * standing rule from 12 Sep and it is the only thing that separates a
   * re-record from a rubber stamp.
   *
   * What was measured on the new tree, per starter, before any digest moved:
   *
   *     starter                rows      riskY === outcomeY   nodes
   *     vendor-selection       6 -> 5    1185 = 1185  ✅       19 (unchanged)
   *     market-entry           6 -> 5    1195 = 1195  ✅       18 (unchanged)
   *     build-vs-buy           6 -> 5    1753 = 1753  ✅       19 (unchanged)
   *     headcount-allocation   6 -> 5    1053 = 1053  ✅       16 (unchanged)
   *     pricing-model          6 -> 5    1084 = 1084  ✅       15 (unchanged)
   *
   * Every risk and every outcome resolves to ONE shared Y per starter — not
   * merely close, identical — and the node count is untouched everywhere, so
   * the shape moved for exactly the reason intended and nothing was dropped.
   * Only then were these five values taken.
   *
   * ⛔ A DIGEST CANNOT SAY WHICH SHAPE IT IS. It says only "the same as last
   * time", so a re-record is the one moment its evidence is at its weakest —
   * which is why the property itself is now asserted separately below, and will
   * go red on a future change that happens to produce a different hash for the
   * WRONG reason.
   */
  /**
   * ⭐⭐ RE-RECORDED 15 Sep 2026 — the tiers no longer all draw at one width, and
   * the new shape was MEASURED BEFORE these digests were written down. That is
   * this block's own standing rule and it is the only thing separating a
   * re-record from a rubber stamp.
   *
   * ## What changed, and what deliberately did not
   *
   * Paul, after a manual test: *"They don't all have to be the same width …
   * making them wider would make sense."* Cards now take a cap per TIER
   * (`CARD_W_CAP_BY_TIER`), bounded by that tier's share of the widest row — so
   * a tier may only spend width the board ALREADY has.
   *
   *     starter                decision  option  factor/outcome/risk  goal  board
   *     vendor-selection         560      440           336           480   3080 (unchanged)
   *     market-entry             560      440           336           480   3080 (unchanged)
   *     build-vs-buy             560      440           336           480   3080 (unchanged)
   *     headcount-allocation     560      434           336           480   1904 (unchanged)
   *     pricing-model            560      434           336           480   1904 (unchanged)
   *
   * ⭐ THE BOARD WIDTH DID NOT MOVE ON ANY STARTER. Not luck — the widest tier
   * is at the bound by construction, so it keeps exactly today's width and the
   * board's extent is exactly what it was.
   *
   * ## The properties measured on the new tree, before any digest moved
   *
   *     starter                nodes  rows  riskY = outcomeY   same-row overlaps
   *     vendor-selection        19     5      1185 = 1185  ✅         0
   *     market-entry            18     5      1195 = 1195  ✅         0
   *     build-vs-buy            19     5      1753 = 1753  ✅         0
   *     headcount-allocation    16     5      1053 = 1053  ✅         0
   *     pricing-model           15     5      1084 = 1084  ✅         0
   *
   * ⭐ EVERY Y IS BYTE-IDENTICAL TO THE 14 Sep RECORD ABOVE, and every node
   * count and row count with it. **Only X moved** — rows re-centre on the spine
   * at their new widths — which is precisely the change and nothing else. A
   * digest that moved for any other reason would have shown up as a moved Y.
   *
   * ⛔ THE OVERLAP COLUMN IS THE ONE THAT HAD TO BE NEW. Wider cards are exactly
   * the change that can make same-row neighbours collide, and the digest cannot
   * see a collision — it only says "different from last time". So the overlap
   * count was measured AT THE PER-KIND WIDTHS THE CARDS ACTUALLY DRAW AT, not
   * at the box widths ELK was handed; those two differing is the defect the
   * previous attempt shipped. `theTiersDoNotAllNeedTheSameWidth.spec.ts` pins
   * the agreement between them so it cannot silently re-open.
   *
   * ⚠ Each digest below was rebound by its OLD value, not by its position in
   * this literal — five same-shaped strings in one object is exactly where a
   * transcription puts the right hash on the wrong starter.
   */
  /*
   * ⛔⛔ S4 (24 Sep 2026) MOVES ALL FIVE DIGESTS. RE-RECORDED IN ITS OWN COMMIT
   * (not the one that moves them), each bound by its OLD value, after the
   * property a digest cannot see was measured: `s4NoSameRowOverlap.spec.ts`
   * (no same-row overlap at rendered widths, prompts included, all 5 starters;
   * mutant-checked). Acceptance of the shape is the reviewer's (NOT LOW).
   * The note below records why they were first left RED. The lane building S4 is barred
   * from re-recording a baseline, and this block's own rule is that "a moved
   * digest is a product decision" — so the re-record belongs to the reviewer who
   * accepts the shape, and until then these five REDs are the honest signal.
   *
   * What moved, and why each is intended (Experience Design #63 5806207128 /
   * 5806266691): repeated cards 336/440 → 260 and the Question/Goal 560/480 →
   * 460; rows above five cards wrap (the three eight-factor starters now carry
   * two factor sub-rows of four); every family's final sub-row reserves the
   * 160-unit row-end prompt slot, and each tier is centred as one block.
   *
   * Measured on the S4 tree BEFORE anything is re-recorded, with this file's own
   * `positionSignature` over the 18 Aug capture heights:
   *
   *     vendor-selection      3c2e3ad2c525b607 → 93eaf450b37e9023
   *     market-entry          899d3f0d5a81fa0e → 1b644425bfba13ab
   *     build-vs-buy          c8ecbb11c30ac473 → f49583b6b3f9f787
   *     headcount-allocation  5c99476037d50074 → 9ba90d91d0959a30
   *     pricing-model         87272681d95fac2e → 9147cbd570b5a117
   *
   * ⭐ And what did NOT move, which is what R1 names: every "ONE canonical layout
   * across 1280…1920" test and the contrast control stay GREEN, and every risk
   * and every outcome still resolves to ONE shared consequence row per starter.
   *
   * ── S5 (24 Sep 2026), a SECOND re-record, again for the reviewer ──
   * One cause only: `LAYOUT_LAYER_GAP` 72 → 48 (the row gap; S5's fit
   * arithmetic on heights measured at the S5 geometry takes 1440×900 from 1 of
   * 6 boards fitting to 4 of 6). Rows move up; nothing moves sideways. Measured
   * with this file's own `positionSignature` before recording:
   *
   *     vendor-selection      93eaf450b37e9023 → 17e010f6a9b20b34
   *     market-entry          1b644425bfba13ab → 807cb16f08f1311a
   *     build-vs-buy          f49583b6b3f9f787 → fdc5a378a826407d
   *     headcount-allocation  9ba90d91d0959a30 → 28785b8d552bebaa
   *     pricing-model         9147cbd570b5a117 → b81897d92b72a9e1
   *
   * Every R1 test, `s4NoSameRowOverlap` and the rest of the layout reader set
   * (72 files) stayed GREEN at the new gap before this was recorded.
   *
   * ── GAP 7 (25 Sep 2026), a THIRD re-record, again for the reviewer ──
   * One cause only: `MAX_CARDS_PER_ROW` 5 → 4 (ED #63 5808428246 — 1280×800
   * with the dock open is the acceptance size; Canvas lead, decide-and-flag).
   * Every starter carries a five-card band, which now wraps 3 + 2 inside its
   * own band. Recorded in its OWN commit, after the commit that moves them,
   * each bound by its OLD value. Measured with this file's own
   * `positionSignature` before recording:
   *
   *     vendor-selection      17e010f6a9b20b34 → 4e269bb622203282
   *     market-entry          807cb16f08f1311a → c5ebdfcd10bd0c6a
   *     build-vs-buy          fdc5a378a826407d → 8f6201d39f2b7f91
   *     headcount-allocation  28785b8d552bebaa → 90ce19d7bf969579
   *     pricing-model         b81897d92b72a9e1 → 678045251956b85e
   *
   * What moved, and nothing else: the board is 316 units narrower (1740 →
   * 1424, so every block re-centres 158 left); each five-card band gains a
   * second sub-row; every tier below it moves down by one sub-row. Node counts
   * are unchanged. Before recording, the layout reader set (112 collected
   * files, 1175 tests) was GREEN except these five: every R1 "one canonical
   * layout" test, `s4NoSameRowOverlap`, the restated consequence-BAND guard
   * above and `laptopFit1280.bandRows.spec.ts` (every band row ≤ 1520 at
   * 1280, reading order unchanged, bound by card id).
   *
   * ── v3.1 WS1 LANDING COMPOSITION (26 Sep 2026), a FOURTH re-record, for the
   * reviewer (NOT LOW) ──
   * Three causes, all in the WS1 brief (DESIGN-GAP-v31 #10, #11, #27):
   *   · `LAYOUT_LAYER_GAP` 48 → 32 and the row gap made ONE constant (the
   *     visible row gap 64 → 48; #11 / ED S5 "reduce row gap to 48");
   *   · a wrapped family is laid in BRICK courses, half a stride apart (#10:
   *     edges under non-endpoint cards 11–21 per starter → 0 at landing);
   *   · the consequence row carries ONE shared prompt (#27), so its prompt
   *     floor is one `ROW_PROMPT_H`, not two stacked.
   * Node counts are unchanged, and nothing moves for any other reason. Measured
   * with this file's own `positionSignature` before recording:
   *
   *     vendor-selection      4e269bb622203282 → 710ee6762b566a64
   *     market-entry          c5ebdfcd10bd0c6a → 11475b7631457834
   *     build-vs-buy          8f6201d39f2b7f91 → 365e8ab91247283e
   *     headcount-allocation  90ce19d7bf969579 → 3d73e3f6680ca522
   *     pricing-model         678045251956b85e → 070e4585642d75c3
   *
   * Before recording, every R1 "one canonical layout" test in this file stayed
   * GREEN, and so did the properties a digest cannot see: `s4NoSameRowOverlap`,
   * `laptopFit1280.bandRows` (every band row ≤ 1520 at 1280, reading order
   * unchanged, by card id), `laptopFit.arithmetic`, and
   * `v31Ws1LandingComposition.spec.ts` — no overlap and no edge under a
   * non-endpoint card on mixed-height boards (4.2× spread, four orders, three
   * shapes), sampled over every card's and every edge's whole extent, with a
   * contrast arm showing the probe bites on the plain diagonal.
   */
  const CANONICAL_SHAPE: Record<StarterId, { digest: string; nodes: number }> = {
    'vendor-selection': { digest: '710ee6762b566a64', nodes: 19 },
    'market-entry': { digest: '11475b7631457834', nodes: 18 },
    'build-vs-buy': { digest: '365e8ab91247283e', nodes: 19 },
    'headcount-allocation': { digest: '3d73e3f6680ca522', nodes: 16 },
    'pricing-model': { digest: '070e4585642d75c3', nodes: 15 },
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

  /**
   * ⭐⭐ THE PROPERTY, ASSERTED SEPARATELY FROM THE HASH.
   *
   * A digest is a perfect tripwire and a useless witness: it detects that the
   * shape moved and can never say what the shape IS. So on the one occasion a
   * digest is deliberately re-recorded, the thing the change was made FOR has
   * no guard at all — the new hash agrees with itself by construction.
   *
   * This states the ruling as a readable claim about the layout: every risk and
   * every outcome resolves to ONE shared Y, in every shipped starter. If a
   * future change separates them again, or splits either kind across sub-rows,
   * this REDs by name and says which starter — where the digest would only say
   * that sixteen hex characters differ.
   *
   * ⚠ GAP 7 (25 Sep 2026): "ONE shared consequence ROW" BECAME "ONE shared
   * consequence BAND". The row cap moved five → four so every band fits the
   * 1280 dock-open frame (ED #63 5808428246), and four of the five starters
   * carry a FIVE-card consequence layer, which now wraps 3 + 2 inside its own
   * band — so risks and outcomes can no longer all share one Y there. The
   * founder ruling this guards (14 Sep: risks and outcomes are ONE causal
   * layer) is about the LAYER, and the claim is restated at that level, BY
   * CARD ID:
   *   · each sub-row, top to bottom and left to right, is the recorded list of
   *     card ids below — the layer's ONE-ROW reading order at the base
   *     (103e1ca6, cap five, this file's own `buildGraph`), wrapped 3 + 2;
   *   · no card of another family sits between the layer's first and last
   *     sub-row;
   *   · a layer that fits one row (pricing-model, four) is ONE exact Y — the
   *     original assertion, carried by its recorded single row.
   *
   * ⛔ WHY IDS AND NOT SUB-ROW SIZES. The first restatement recorded only the
   * sizes (`[3, 2]`) and claimed a split by KIND would change them. It would
   * not: vendor-selection, market-entry, build-vs-buy and headcount-allocation
   * each carry THREE risks and TWO outcomes, so risks-row-then-outcomes-row is
   * also `[3, 2]`. Measured (fixer, 25 Sep): a mutant sorting `risk_` ids ahead
   * of `out_` ids in `applyTierRowSplitting` left all five sizes-only arms
   * GREEN. Bound by id, the same mutant REDs the four five-card starters by name.
   */
  const CONSEQUENCE_SUB_ROWS: Record<StarterId, string[][]> = {
    'vendor-selection': [
      ['out_budget_headroom', 'risk_gdpr_breach', 'risk_team_overload'],
      ['risk_migration_delay', 'out_platform_capability'],
    ],
    'market-entry': [
      ['out_uk_arr_retention', 'out_new_market_arr', 'risk_localisation_drag'],
      ['risk_uk_distraction', 'risk_team_overstretch'],
    ],
    'build-vs-buy': [
      ['risk_eng_overload', 'out_delivery_speed', 'risk_billing_errors'],
      ['out_billing_accuracy', 'risk_vendor_lock'],
    ],
    'headcount-allocation': [
      ['out_reliability', 'risk_eng_attrition', 'risk_churn'],
      ['out_new_arr', 'risk_sales_miss'],
    ],
    'pricing-model': [['risk_pricing_complexity', 'out_bottom_up_growth', 'risk_enterprise_churn', 'out_nrr']],
  }
  it.each(Object.keys(STARTERS) as StarterId[])(
    '%s: every risk and every outcome sits in ONE shared consequence band, in its recorded reading order',
    async (id) => {
      presentViewport(1280)
      const { nodes, edges } = buildGraph(id)
      const out = await layoutGraph(nodes, edges, {})
      const kindOf = new Map(nodes.map((n) => [n.id, (n.data as { kind?: string })?.kind]))
      const isConsequence = (nid: string) => kindOf.get(nid) === 'risk' || kindOf.get(nid) === 'outcome'
      const consequence = out.nodes.filter((n) => isConsequence(n.id))

      // Non-vacuity: a starter with no risks or no outcomes would satisfy every
      // assertion below by having nothing to compare (CLAUDE.md trap 13).
      expect(consequence.some((n) => kindOf.get(n.id) === 'risk'), `${id}: no risks laid out — this guard asserts nothing here`).toBe(true)
      expect(consequence.some((n) => kindOf.get(n.id) === 'outcome'), `${id}: no outcomes laid out — this guard asserts nothing here`).toBe(true)

      // The layer's sub-rows, top to bottom by EXACT y (never a tolerance: a
      // near-miss is a sub-row split, which is a different layout), each left to
      // right — compared as card ids against the record. Every laid-out risk and
      // outcome is in `rows`, so a card missing from the record, or an extra
      // one, REDs here too.
      const bandYs = [...new Set(consequence.map((n) => n.position.y))].sort((a, b) => a - b)
      const rows = bandYs.map((y) =>
        consequence
          .filter((n) => n.position.y === y)
          .sort((a, b) => a.position.x - b.position.x)
          .map((n) => n.id),
      )
      expect(rows, `${id}: the consequence layer is not its recorded one-row order, wrapped`).toEqual(CONSEQUENCE_SUB_ROWS[id])

      // …and nothing of another family inside it.
      const inside = out.nodes.filter(
        (n) => !isConsequence(n.id) && n.position.y >= bandYs[0] && n.position.y <= bandYs[bandYs.length - 1],
      )
      expect(inside.map((n) => n.id), `${id}: another family sits inside the consequence band`).toEqual([])
    },
  )
})

/**
 * ⭐⭐ S4 (24 Sep 2026): THE PACKING IS A COUNT, SO THE BAND IS GONE — AND THIS
 * BLOCK SAYS SO RATHER THAN QUIETLY DELETING WHAT IT USED TO GUARD.
 *
 * Until S4 the budget chose the packing: a tier stayed on one row while its fair
 * share of `CANONICAL_LAYOUT_WIDTH` cleared `NODE_SINGLE_ROW_FAIR_SHARE_W`, so this
 * block pinned the budget inside the band [1417, 1548) where that behaviour was
 * constant, and recorded the resulting table (single-row up to 8, four per row
 * beyond). Experience Design replaced the policy (#63 5806207128 / 5806266691:
 * "Rows above 5 cards wrap into balanced sub-rows … 6→3+3, 7→4+3, 8→4+4, 9→5+4",
 * 10→5+5 in the brief), and the two constants the band was made of are retired.
 *
 * What R1 needs from this block is unchanged: the SHAPE of every model the
 * product can produce, recorded in one place, so a constant that moves a row
 * REDs here by name. The table is now ED's, pinned twice — the arithmetic and
 * the real layout — because either alone is a guard agreeing with itself.
 */
describe('S4: the packing is a COUNT — the whole table, recorded against the ruling', () => {
  /** How many factor cards land on each sub-row in the REAL layout, top to bottom. */
  async function rowsInLayout(n: number): Promise<number[]> {
    const { nodes, edges } = tierOfWidth(n)
    const out = await layoutGraph(nodes, edges, {})
    const byY = new Map<number, number>()
    for (const node of out.nodes.filter((x) => x.id.startsWith('fac_'))) {
      byY.set(node.position.y, (byY.get(node.position.y) ?? 0) + 1)
    }
    return [...byY.entries()].sort((a, b) => a[0] - b[0]).map(([, c]) => c)
  }

  /*
   * ⚠ GAP 7 (25 Sep 2026): THE CAP MOVED FIVE → FOUR, so 5, 9 and 10 re-pack
   * (5→3+2, 9→3+3+3, 10→4+3+3; were 5, 5+4, 5+5). ED #63 5808428246 made
   * 1280×800 with the dock open the acceptance size, whose frame is 1520 flow
   * units at the 0.5 floor: five cards and the prompt need 1740, four need
   * 1424. Canvas lead, decide-and-flag. The wrap stays ED S4's balanced one.
   */
  const RULED: Record<number, number[]> = {
    2: [2], 3: [3], 4: [4], 5: [3, 2],
    6: [3, 3], 7: [4, 3], 8: [4, 4], 9: [3, 3, 3], 10: [4, 3, 3],
  }

  it('the cap is four real cards per row (gap 7; five under ED S4)', () => {
    expect(MAX_CARDS_PER_ROW).toBe(4)
  })

  it('the whole packing table, recorded — arithmetic', () => {
    for (let t = 2; t <= 10; t++) {
      expect(balancedRowSizes(t), `a ${t}-card tier`).toEqual(RULED[t])
    }
  })

  it('the whole packing table, recorded — in the layout itself', async () => {
    for (let t = 2; t <= 10; t++) {
      expect(await rowsInLayout(t), `a ${t}-card tier in the real layout`).toEqual(RULED[t])
    }
  })

  it('the derivation DISCRIMINATES, and the 4/5 boundary is real in the layout', async () => {
    // Trap 20: a probe returning the same answer for every input is reporting on
    // itself. Four stays on one row; five does not (gap 7 — it was 5/6).
    expect(await rowsInLayout(4)).toEqual([4])
    expect(await rowsInLayout(5)).toEqual([3, 2])
    // ⭐ AND THE OLD BOUNDARY IS GONE, pinned as its own assertion: under the
    // retired gate seven and eight stayed on one row (a 2544-unit factor row).
    expect((await rowsInLayout(8)).length).toBeGreaterThan(1)
  })

  it('the budget is still ONE constant, and it no longer decides the packing', () => {
    // R1's half of this is enforced at the bytes by the source guards above.
    // What changed is its JOB: it is the row budget a card width is a fair share
    // of (see `CANONICAL_LAYOUT_WIDTH`), not the input to a single-row gate —
    // so no budget value can re-pack a tier. The table above is a function of
    // the count alone.
    expect(CANONICAL_LAYOUT_WIDTH).toBe(1482)
  })
})
