/**
 * ⭐ GAPS 11 + 34 (DESIGN-GAP-AUDIT-20260924.md rows 11 and 34) — the corner
 * marks sit INSIDE the card at the contract offsets, the title never runs under
 * them, the worded state pills leave the corner for an in-flow row, and the rail
 * is the contract's `.icon-btn` geometry and colours.
 *
 * The contract (Visual Contract v3, §02 `<style>`), the only source of every
 * number below — the spec restates the CONTRACT's values, never the
 * implementation's, so an implementation that drifts from them goes RED:
 *   · `.node{border:1px solid …}`                         the 1px frame
 *   · `.node .attention{position:absolute;right:7px;top:5px;height:25px;width:25px}`
 *   · `.node h3{padding-right:21px}`   — the title stops 1px before the mark:
 *                                         12 (card padding) + 21 = 7 + 25 + 1
 *   · `.icon-btn{width:25px;height:25px;color:#777B77}` `.icon-btn svg{width:15px;height:15px}`
 *   · `.icon-btn.behaviour{color:#736DA0}`
 *   · Paul 23 Sep pt 6: the coaching icon stays grey at rest (not Info).
 *
 * Sizes are at 100% and scale with `--canvas-label-scale` (the canvas
 * counter-scale, 1 at 100%, 2 at the landing bound), so the geometric
 * invariants are evaluated at scale 1 AND at the bound.
 *
 * Every assertion binds by IDENTITY — the node's own corner stack, title, header
 * row and state row by testid, the marks by their testids — and each block
 * carries a CONTRAST case that must stay as it is.
 */
import { readFileSync } from 'node:fs'
import type { ComponentProps } from 'react'
import { join } from 'node:path'
import { cleanup, render, screen, within } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { Circle, SearchCheck } from 'lucide-react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BaseNode } from '../BaseNode'
import { useCanvasStore } from '../../store'
import { useGuidanceStore, type GuidanceItem } from '../../stores/guidanceStore'
import type { AttentionReason } from '../shared/nodeAttention'
import {
  CANVAS_CORNER_STACK_CLASSES,
  CANVAS_GLYPH_SIZE_CLASSES,
  CANVAS_HIT_SLOP_CLASSES,
  CANVAS_QUICK_ACTION_BOX_PX,
  CANVAS_QUICK_ACTION_SLOP_PX,
  MIN_TARGET_RENDERED_PX,
  cornerMarksHeaderReserveCss,
} from '../shared/canvasGlyphScale'
import {
  NODE_RAIL_BEHAVIOUR_TONE_CLASS,
  NODE_RAIL_BUTTON_CLASSES,
  NODE_RAIL_GLYPH_CLASSES,
  NODE_RAIL_GLYPH_PX,
  NODE_RAIL_REST_TONE_CLASS,
} from '../shared/nodeCardRailStyles'
import { NODE_TITLE_WIDEST_WORD_PX } from '../../utils/nodeLayoutConstants'
import { CANVAS_TYPE_PX } from '../../../styles/typography'
import { NodeRailIcon, NodeSignalRailIcons } from '../shared/NodeRailIcons'
import { NodeCoachingIcon } from '../shared/NodeCoachingIcon'
import { NodeQuickActions } from '../shared/NodeQuickActions'

// ── contract §02 values (restated here on purpose — see the header) ──────────
const CONTRACT_FRAME_PX = 1
const CONTRACT_MARK_RIGHT_PX = 7
const CONTRACT_MARK_TOP_PX = 5
const CONTRACT_MARK_BOX_PX = 25
const CONTRACT_MARK_CLEARANCE_PX = 1 // 12 + 21 = 7 + 25 + 1
const CONTRACT_ICON_GLYPH_PX = 15
const CONTRACT_ICON_REST_HEX = '#777B77'
const CONTRACT_BEHAVIOUR_HEX = '#736DA0'
/** `.node h3{line-height:1.25}` (the served title's `leading-tight`). */
const CONTRACT_TITLE_LEADING = 1.25
/** The corner stack's scaled gap between two marks (served, unchanged here). */
const STACK_GAP_PX = 4

// ── the attention cue is stubbed per test; the rest of the card is real ──────
const REASON: AttentionReason = {
  kind: 'fragile_link',
  order: 1,
  label: 'The comparison depends on a link from here. How sure are you of it?',
}
let attentionMarked = false
/**
 * The graph lens flag (netlify.toml ships it ON). `null` defers to the real flag,
 * so every case that does not ask for a lens runs exactly as it did before.
 */
let graphLensOn: boolean | null = null
vi.mock('../../../flags', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, isGraphLensEnabled: () => graphLensOn ?? (actual.isGraphLensEnabled as () => boolean)() }
})
vi.mock('../shared/useNodeAttention', () => ({
  useNodeAttention: vi.fn(() =>
    attentionMarked
      ? { reasons: [REASON], marked: true, markedCount: 1, candidateCount: 1 }
      : { reasons: [], marked: false, markedCount: 0, candidateCount: 0 },
  ),
}))

type Kind = 'goal' | 'decision' | 'option' | 'outcome' | 'factor' | 'risk'

function renderCard(kind: Kind, id: string, label: string, extra: { maxWidth?: number } = {}) {
  const props = {
    id,
    type: kind,
    position: { x: 0, y: 0 },
    selected: false,
    isConnectable: true,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    dragging: false,
    zIndex: 0,
    data: { type: kind, label },
  }
  useCanvasStore.setState({ nodes: [props] as never, edges: [] })
  const view = render(
    <ReactFlowProvider>
      <BaseNode {...(props as unknown as ComponentProps<typeof BaseNode>)} {...extra} nodeType={kind} icon={Circle} />
    </ReactFlowProvider>,
  )
  const root = view.container.querySelector('[role="group"]') as HTMLElement
  expect(root, `card root for ${id} must render`).not.toBeNull()
  return root
}

function guidance(targetId: string): GuidanceItem {
  return {
    item_id: `g-${targetId}`,
    category: 'should_fix',
    source: 'structural',
    title: 'Review this node',
    priority: 50,
    primary_action: { type: 'discuss', prompt: 'Let us discuss.' },
    target_object: { type: 'node', id: targetId },
  } as GuidanceItem
}

const tokens = (el: Element | null | undefined): string[] =>
  (el?.getAttribute('class') ?? '').split(/\s+/).filter(Boolean)

/**
 * Evaluate a declared CSS length (`12px`, `calc(…)`, `max(0px, …)`, `clamp(…)`,
 * nested) at a given `--canvas-label-scale`. `%` resolves against `box.pct`
 * (the containing block's width) and `lh` against `box.lh` (the line height);
 * a declaration using either without its base throws. Only the grammar this
 * card emits is accepted; anything else throws, so an unreadable declaration
 * cannot pass as zero.
 */
function px(css: string, scale: number, box: { pct?: number; lh?: number } = {}): number {
  const unit = (u: '%' | 'lh', base: number | undefined, divisor: number) => (_: string, n: string) => {
    if (base === undefined) throw new Error(`${u} in ${css} with no base to resolve it against`)
    return `(${n}*${base / divisor})`
  }
  const expr = css
    .replace(/var\(--canvas-label-scale,\s*1\)/g, String(scale))
    .replace(/(-?\d+(?:\.\d+)?)%/g, unit('%', box.pct, 100))
    .replace(/(-?\d+(?:\.\d+)?)lh\b/g, unit('lh', box.lh, 1))
    .replace(/(-?\d+(?:\.\d+)?)px/g, '$1')
    .replace(/\bcalc\(/g, '(')
    .replace(/\bmax\(/g, 'Math.max(')
    .replace(/\bmin\(/g, 'Math.min(')
    .replace(/\bclamp\(/g, 'CLAMP(')
  if (!/^[\d\s.+\-*/(),]*$/.test(expr.replace(/Math\.(max|min)|CLAMP/g, ''))) throw new Error(`unreadable length: ${css}`)
  return Function('CLAMP', `"use strict"; return (${expr})`)(
    (lo: number, v: number, hi: number) => Math.max(lo, Math.min(v, hi)),
  ) as number
}

/** Where the corner mark's LEFT edge sits, from the padding-box left, at `scale`. */
const markLeftAt = (cardW: number, marks: number, scale: number) => {
  const run = marks * CONTRACT_MARK_BOX_PX + (marks - 1) * STACK_GAP_PX
  return cardW - 2 * CONTRACT_FRAME_PX - CONTRACT_MARK_RIGHT_PX - run * scale
}

const INITIAL_LENS = useCanvasStore.getState().lens

beforeEach(() => {
  attentionMarked = false
  graphLensOn = null
  useGuidanceStore.getState().clearGuidanceItems()
  useCanvasStore.setState({
    nodes: [],
    edges: [],
    highlightedNodes: new Set<string>(),
    dimmedNodeIds: new Set<string>(),
    lodRung: 'full',
    lens: INITIAL_LENS,
  } as never)
})
afterEach(() => cleanup())

// ═════════════════════════════════════════════════════════════════════════════
describe('GAP 11 — the corner marks sit INSIDE the card at the contract offsets', () => {
  it('the stack is anchored inside the top-right corner (top 5, right 7), never above the border', () => {
    attentionMarked = true
    renderCard('outcome', 'o1', 'Customer retention after a price rise')
    const stack = screen.getByTestId('node-corner-stack-o1')
    const t = tokens(stack)
    expect(t).toContain('absolute')
    expect(t).toContain(`top-[${CONTRACT_MARK_TOP_PX}px]`)
    expect(t).toContain(`right-[${CONTRACT_MARK_RIGHT_PX}px]`)
    // The float-above anchor and its margin into the row gap are gone.
    expect(t).not.toContain('bottom-full')
    expect(t.some((c) => c.startsWith('mb-'))).toBe(false)
    expect(stack.className).toBe(CANVAS_CORNER_STACK_CLASSES)
    // The mark itself is the stack's child and carries no offset of its own.
    const mark = screen.getByTestId('attention-marker-o1')
    expect(stack).toContainElement(mark)
    expect(tokens(mark)).not.toContain('absolute')
  })

  it('a repeated card: the title stops 1px before the mark on line 1 at 100%, and yields line 1 at the bound', () => {
    attentionMarked = true
    const root = renderCard('outcome', 'o1', 'Customer retention after a price rise')
    const cardW = parseFloat(root.style.width)
    const padL = parseFloat(root.style.paddingLeft)
    expect(cardW).toBe(260)
    const title = screen.getByTestId('node-title')
    const spacer = within(title).getByTestId('node-title-corner-spacer')
    // The title box on a 260 card is its minimum measure (it has the line to
    // itself), read from the wrapper the card renders — not recomputed here.
    const wrapperMin = parseFloat((title.parentElement as HTMLElement).style.minWidth)
    const at = (s: number) => ({ pct: wrapperMin, lh: CANVAS_TYPE_PX.nodeTitle * CONTRACT_TITLE_LEADING * s })
    // First line only at 100%: a float one title line tall, so lines 2+ keep the
    // full measure the widest-word bound was derived for.
    expect(spacer.style.float).toBe('right')
    expect(px(spacer.style.height, 1, at(1))).toBeCloseTo(at(1).lh, 6)
    expect(spacer).toHaveAttribute('aria-hidden', 'true')
    expect(spacer.textContent).toBe('')
    const line1Right = padL + wrapperMin - px(spacer.style.width, 1, at(1))
    expect(line1Right, 'scale 1').toBeCloseTo(markLeftAt(cardW, 1, 1) - CONTRACT_MARK_CLEARANCE_PX, 6)
    // At the bound the mark and the widest word cannot share line 1, so the
    // title yields it (the rule is pinned in full by the block below).
    expect(px(spacer.style.width, 2, at(2)), 'scale 2').toBeCloseTo(wrapperMin, 6)
    // A repeated card keeps its header row unpadded: nothing shares the title's
    // line, so the provenance glyph on line 2 keeps its right alignment.
    expect(screen.getByTestId('node-header-row').style.paddingRight).toBe('')
  })

  it('TWO marks (attention + coaching): both in the stack, and the spacer covers the whole run', () => {
    attentionMarked = true
    useGuidanceStore.getState().setGuidanceItems([guidance('o1')])
    const root = renderCard('outcome', 'o1', 'Customer retention after a price rise')
    const stack = screen.getByTestId('node-corner-stack-o1')
    expect(Array.from(stack.children).map((c) => c.getAttribute('data-testid'))).toEqual([
      'attention-marker-o1',
      'node-coaching-marker-o1',
    ])
    const cardW = parseFloat(root.style.width)
    const padL = parseFloat(root.style.paddingLeft)
    const title = screen.getByTestId('node-title')
    const wrapperMin = parseFloat((title.parentElement as HTMLElement).style.minWidth)
    const spacer = within(title).getByTestId('node-title-corner-spacer')
    // At 100% (and at every scale where the widest word still fits beside the
    // run — the block below pins where that stops).
    for (const s of [1, 1.4]) {
      expect(padL + wrapperMin - px(spacer.style.width, s, { pct: wrapperMin }), `scale ${s}`).toBeCloseTo(
        markLeftAt(cardW, 2, s) - CONTRACT_MARK_CLEARANCE_PX,
        6,
      )
    }
  })

  it('CONTRAST — no mark: no spacer, no header reserve, an empty stack, and the title keeps its measure', () => {
    renderCard('outcome', 'o1', 'Customer retention after a price rise')
    const title = screen.getByTestId('node-title')
    expect(within(title).queryByTestId('node-title-corner-spacer')).toBeNull()
    expect(screen.getByTestId('node-header-row').style.paddingRight).toBe('')
    expect(screen.getByTestId('node-corner-stack-o1').children).toHaveLength(0)
    expect((title.parentElement as HTMLElement).style.minWidth).toBe('236px')
  })

  it('the coaching SLOT\'s structural fallback counts as a mark too (no guidance item, a structural finding names this risk)', () => {
    const node = (id: string, kind: string, data: Record<string, unknown> = {}) =>
      ({ id, type: kind, position: { x: 0, y: 0 }, data: { kind, label: id, ...data } })
    // The graph the structural-marker suite uses: two options, one reaching an
    // external factor and one a controllable one, and a risk nothing reaches.
    useCanvasStore.setState({
      nodes: [node('o1', 'option'), node('o2', 'option'), node('f1', 'factor', { category: 'external' }), node('f2', 'factor', { category: 'controllable' }), node('r1', 'risk')],
      edges: [{ id: 'e1', source: 'o1', target: 'f1', data: {} }, { id: 'e2', source: 'o2', target: 'f2', data: {} }],
    } as never)
    const props = {
      id: 'r1', type: 'risk', position: { x: 0, y: 0 }, selected: false, isConnectable: true,
      positionAbsoluteX: 0, positionAbsoluteY: 0, dragging: false, zIndex: 0, data: { type: 'risk', label: 'r1' },
    }
    const view = render(
      <ReactFlowProvider>
        <BaseNode {...(props as unknown as ComponentProps<typeof BaseNode>)} nodeType="risk" icon={Circle} />
      </ReactFlowProvider>,
    )
    const root = view.container.querySelector('[role="group"]') as HTMLElement
    const stack = screen.getByTestId('node-corner-stack-r1')
    expect(Array.from(stack.children).map((c) => c.getAttribute('data-testid'))).toEqual(['node-structural-marker-r1'])
    const title = screen.getByTestId('node-title')
    const spacer = within(title).getByTestId('node-title-corner-spacer')
    const wrapperMin = parseFloat((title.parentElement as HTMLElement).style.minWidth)
    for (const s of [1, 1.7]) {
      expect(parseFloat(root.style.paddingLeft) + wrapperMin - px(spacer.style.width, s, { pct: wrapperMin }), `scale ${s}`).toBeCloseTo(
        markLeftAt(parseFloat(root.style.width), 1, s) - CONTRACT_MARK_CLEARANCE_PX,
        6,
      )
    }
  })

  it('the reserve follows the MARK, not the data: at the quiet rung the coaching marker leaves, and so does its reserve', () => {
    useGuidanceStore.getState().setGuidanceItems([guidance('o1')])
    useCanvasStore.setState({ lodRung: 'quiet' } as never)
    renderCard('outcome', 'o1', 'Customer retention after a price rise')
    expect(screen.queryByTestId('node-coaching-marker-o1')).toBeNull()
    expect(within(screen.getByTestId('node-title')).queryByTestId('node-title-corner-spacer')).toBeNull()
  })

  it('a wide anchor: the header row (title AND its header glyphs) ends 1px before the mark; no line-1 spacer is needed', () => {
    attentionMarked = true
    // Quiet rung: the anchor's rail is not beside the row there, so the card's
    // right padding is its plain side padding and the reserve is exact.
    useCanvasStore.setState({ lodRung: 'quiet' } as never)
    const root = renderCard('goal', 'g1', 'Grow recurring revenue')
    const cardW = parseFloat(root.style.width)
    const padR = root.style.paddingRight
    const header = screen.getByTestId('node-header-row')
    for (const s of [1, 2]) {
      const headerRight = cardW - 2 * CONTRACT_FRAME_PX - px(padR, s) - px(header.style.paddingRight, s)
      expect(headerRight, `scale ${s}`).toBeCloseTo(markLeftAt(cardW, 1, s) - CONTRACT_MARK_CLEARANCE_PX, 6)
    }
    const title = screen.getByTestId('node-title')
    const spacer = within(title).queryByTestId('node-title-corner-spacer')
    const pct = parseFloat((title.parentElement as HTMLElement).style.minWidth)
    if (spacer) for (const s of [1, 2]) expect(px(spacer.style.width, s, { pct }), `scale ${s}`).toBe(0)
  })

  it('the contract figure itself: one mark at 100% beside 12px of card padding reserves exactly 21px (`.node h3{padding-right:21px}`)', () => {
    expect(px(cornerMarksHeaderReserveCss(1, '12px')!, 1)).toBe(21)
    // …and the same 1px clearance at the bound, where the mark is 50 wide.
    expect(px(cornerMarksHeaderReserveCss(1, '12px')!, 2)).toBe(46)
    // CONTRAST — no mark reserves nothing at all (not a zero-width declaration).
    expect(cornerMarksHeaderReserveCss(0, '12px')).toBeUndefined()
  })
})

// ═════════════════════════════════════════════════════════════════════════════
/**
 * ⭐⭐ LINE 1 HOLDS THE WIDEST WORD, OR IT YIELDS TO THE MARKS — NEVER A MID-WORD
 * BREAK (independent verifier FIX_NEEDED on 058c8331, 25 Sep 2026).
 *
 * The first cut shortened line 1 by the marks' whole run at every scale. At the
 * landing bound (scale 2) ONE mark left a 260 card's line 1 188 of its 236px —
 * 94px of 14px type — so a title OPENING with "Concentration" (97.1px) or
 * "Cannibalization" (105.3px, the widest word in the shipped corpus) broke
 * mid-word (witnessed by the verifier in headless Chromium 143). The attention
 * cue is not rung-gated, so that was the default landing view, on exactly the
 * "Worth reviewing" cards. Two marks broke the same word at the Normal rung's
 * deepest scale (1.51), and the causal lens and an intermediate card width
 * (270) had the same arithmetic.
 *
 * The invariant, at every scale from 100% to the bound, for each title box:
 *   · line 1's measure is either ≥ the widest word the title's minimum measure
 *     was derived for (`NODE_TITLE_WIDEST_WORD_PX` × scale), or ZERO — the title
 *     yields line 1 to the marks and starts below them;
 *   · it yields ONLY when the widest word and the marks cannot share line 1
 *     (so at 100% the title sits beside the mark, as the contract draws it);
 *   · not yielding, line 1 stops 1px before the marks and the spacer is exactly
 *     one line tall, so lines 2+ keep the full measure;
 *   · yielding, the spacer reaches 1px past the marks' bottom, so no line of
 *     text runs under a mark box.
 * Evaluated from the DECLARED spacer on the card's own title (jsdom has no
 * layout); the browser half of the claim is the verifier's Chromium harness.
 */
describe('GAP 11 — line 1 holds the widest word or yields to the marks (never a mid-word break)', () => {
  const SCALES = Array.from({ length: 101 }, (_, i) => 1 + i / 100) // 1.00 … 2.00, the bound
  const EPS = 1e-6
  const lineHeightAt = (s: number) => CANVAS_TYPE_PX.nodeTitle * CONTRACT_TITLE_LEADING * s

  type Box = { left: number; width: number }
  type Card = { width: number; paddingTop: number }

  function assertLineOne(spacer: HTMLElement, box: Box, card: Card, marks: number, label: string) {
    const run = marks * CONTRACT_MARK_BOX_PX + (marks - 1) * STACK_GAP_PX
    const rightGap = card.width - 2 * CONTRACT_FRAME_PX - box.left - box.width
    let yieldedSomewhere = false
    let besideSomewhere = false
    for (const s of SCALES) {
      const lh = lineHeightAt(s)
      const w = px(spacer.style.width, s, { pct: box.width, lh })
      const h = px(spacer.style.height, s, { pct: box.width, lh })
      const line1 = box.width - w
      const at = `${label}, ${marks} mark(s), scale ${s.toFixed(2)}`
      const clearance = CONTRACT_MARK_RIGHT_PX + CONTRACT_MARK_CLEARANCE_PX + run * s
      const bothFit = box.width - Math.max(0, clearance - rightGap) >= NODE_TITLE_WIDEST_WORD_PX * s
      if (line1 > EPS) {
        besideSomewhere = true
        expect(line1, `${at}: line 1 cannot hold the widest word — a mid-word break`).toBeGreaterThanOrEqual(
          NODE_TITLE_WIDEST_WORD_PX * s - EPS,
        )
        expect(box.left + line1, `${at}: line 1 runs under the mark`).toBeLessThanOrEqual(
          markLeftAt(card.width, marks, s) - CONTRACT_MARK_CLEARANCE_PX + EPS,
        )
        expect(h, `${at}: a spacer beside line 1 is exactly one line tall`).toBeCloseTo(lh, 6)
      } else {
        yieldedSomewhere = true
        expect(bothFit, `${at}: the title yielded line 1 although the widest word fits beside the marks`).toBe(false)
        expect(h, `${at}: the yielded title's first line runs under the mark box`).toBeGreaterThanOrEqual(
          CONTRACT_MARK_TOP_PX + CONTRACT_MARK_BOX_PX * s + CONTRACT_MARK_CLEARANCE_PX - card.paddingTop - EPS,
        )
      }
    }
    return { yieldedSomewhere, besideSomewhere }
  }

  const cardOf = (root: HTMLElement): Card => ({
    width: parseFloat(root.style.width),
    paddingTop: parseFloat(root.style.paddingTop),
  })

  it('a 260 repeated card, ONE mark: beside the title at 100%, yields at the landing bound (the verifier\'s "Concentratio|n")', () => {
    attentionMarked = true
    const root = renderCard('outcome', 'o1', 'Concentration risk in the top accounts')
    const title = screen.getByTestId('node-title')
    const box = { left: parseFloat(root.style.paddingLeft), width: parseFloat((title.parentElement as HTMLElement).style.minWidth) }
    expect(box.width).toBe(236)
    const r = assertLineOne(within(title).getByTestId('node-title-corner-spacer'), box, cardOf(root), 1, 'outcome 260')
    // Both regimes are reached on this card, so neither half of the rule is vacuous.
    expect(r).toEqual({ yieldedSomewhere: true, besideSomewhere: true })
  })

  it('a 260 repeated card, TWO marks (attention + coaching): the same rule over the wider run', () => {
    attentionMarked = true
    useGuidanceStore.getState().setGuidanceItems([guidance('o1')])
    const root = renderCard('outcome', 'o1', 'Cannibalization of the entry tier')
    const title = screen.getByTestId('node-title')
    const box = { left: parseFloat(root.style.paddingLeft), width: parseFloat((title.parentElement as HTMLElement).style.minWidth) }
    const r = assertLineOne(within(title).getByTestId('node-title-corner-spacer'), box, cardOf(root), 2, 'outcome 260')
    expect(r).toEqual({ yieldedSomewhere: true, besideSomewhere: true })
  })

  it('an intermediate width (270, the header-reserve path): the title box still sits at its minimum measure, so the same rule holds', () => {
    attentionMarked = true
    const root = renderCard('outcome', 'o1', 'Concentration risk in the top accounts', { maxWidth: 270 })
    expect(parseFloat(root.style.width)).toBe(270)
    const title = screen.getByTestId('node-title')
    const box = { left: parseFloat(root.style.paddingLeft), width: parseFloat((title.parentElement as HTMLElement).style.minWidth) }
    expect(box.width).toBe(236)
    const r = assertLineOne(within(title).getByTestId('node-title-corner-spacer'), box, cardOf(root), 1, 'outcome 270')
    expect(r).toEqual({ yieldedSomewhere: true, besideSomewhere: true })
  })

  it('the CAUSAL LENS title (a full-width block; netlify.toml ships the lens ON) keeps clear of the mark by the same rule', () => {
    attentionMarked = true
    graphLensOn = true
    useCanvasStore.setState({ lens: { ...INITIAL_LENS, active: 'causal' } } as never)
    const root = renderCard('outcome', 'o1', 'Concentration risk in the top accounts')
    // Positive control: this IS the causal-lens title — the header row is not drawn.
    expect(screen.queryByTestId('node-header-row')).toBeNull()
    const spacer = within(root).getByTestId('node-title-corner-spacer')
    const causalTitle = spacer.parentElement as HTMLElement
    expect(causalTitle.textContent).toBe('Concentration risk in the top accounts')
    const card = cardOf(root)
    const box = {
      left: parseFloat(root.style.paddingLeft),
      width: card.width - 2 * CONTRACT_FRAME_PX - parseFloat(root.style.paddingLeft) - parseFloat(root.style.paddingRight),
    }
    const r = assertLineOne(spacer, box, card, 1, 'causal lens 260')
    expect(r).toEqual({ yieldedSomewhere: true, besideSomewhere: true })
  })

  it('CONTRAST — at 100% the title sits beside ONE or TWO marks (the contract layout is untouched), and no mark means no spacer', () => {
    attentionMarked = true
    useGuidanceStore.getState().setGuidanceItems([guidance('o1')])
    renderCard('outcome', 'o1', 'Concentration risk in the top accounts')
    const spacer = within(screen.getByTestId('node-title')).getByTestId('node-title-corner-spacer')
    const box = parseFloat((screen.getByTestId('node-title').parentElement as HTMLElement).style.minWidth)
    expect(px(spacer.style.width, 1, { pct: box, lh: lineHeightAt(1) })).toBeLessThan(box / 2)
    expect(px(spacer.style.height, 1, { pct: box, lh: lineHeightAt(1) })).toBeCloseTo(lineHeightAt(1), 6)
    cleanup()
    attentionMarked = false
    useGuidanceStore.getState().clearGuidanceItems()
    renderCard('outcome', 'o2', 'Concentration risk in the top accounts')
    expect(within(screen.getByTestId('node-title')).queryByTestId('node-title-corner-spacer')).toBeNull()
  })
})

// ═════════════════════════════════════════════════════════════════════════════
describe('GAP 11 — worded state pills leave the corner for an in-flow row on the card', () => {
  it('"Needs input" renders in the card\'s own state row, not in the corner stack', () => {
    renderCard('goal', 'g1', 'Grow recurring revenue')
    const pill = screen.getByTestId('needs-input-pill')
    const stack = screen.getByTestId('node-corner-stack-g1')
    const row = screen.getByTestId('node-state-row-g1')
    expect(stack).not.toContainElement(pill)
    expect(row).toContainElement(pill)
    // In flow: no positioning of its own, a child of the card itself.
    expect(tokens(row).some((c) => c === 'absolute' || c === 'fixed')).toBe(false)
    expect(row.parentElement?.getAttribute('role')).toBe('group')
    // A long state word wraps inside the card rather than running past it.
    expect(tokens(row)).toContain('[&>*]:whitespace-normal')
    expect(tokens(row)).toContain('[&>*]:max-w-full')
  })

  it('CONTRAST — the attention mark on the same card stays in the corner, and the pill does not join it', () => {
    attentionMarked = true
    renderCard('goal', 'g1', 'Grow recurring revenue')
    const stack = screen.getByTestId('node-corner-stack-g1')
    expect(Array.from(stack.children).map((c) => c.getAttribute('data-testid'))).toEqual(['attention-marker-g1'])
    expect(screen.getByTestId('node-state-row-g1')).toContainElement(screen.getByTestId('needs-input-pill'))
  })

  it('CONTRAST — a card with no state word renders no state row (no empty band)', () => {
    renderCard('outcome', 'o1', 'Customer retention after a price rise')
    expect(screen.queryByTestId('node-state-row-o1')).toBeNull()
  })
})

// ═════════════════════════════════════════════════════════════════════════════
describe('GAP 34 — rail geometry and colours are the contract .icon-btn', () => {
  it('box 25, glyph 15 — counter-scaled, from the shared rail constants', () => {
    expect(CANVAS_QUICK_ACTION_BOX_PX).toBe(CONTRACT_MARK_BOX_PX)
    expect(NODE_RAIL_GLYPH_PX).toBe(CONTRACT_ICON_GLYPH_PX)
    expect(NODE_RAIL_GLYPH_CLASSES).toBe(CANVAS_GLYPH_SIZE_CLASSES[15])
    expect(NODE_RAIL_BUTTON_CLASSES.split(/\s+/)).toContain('w-[calc(25px*var(--canvas-label-scale,1))]')
    expect(NODE_RAIL_BUTTON_CLASSES.split(/\s+/)).toContain('h-[calc(25px*var(--canvas-label-scale,1))]')
  })

  it('a rendered rail icon is a 25px box holding a 15px glyph (class AND the size attribute fallback)', () => {
    render(<NodeRailIcon testId="rail-ev" label="Evidence" icon={SearchCheck} tone="muted" onActivate={() => {}} />)
    const b = screen.getByTestId('rail-ev')
    expect(tokens(b)).toContain('w-[calc(25px*var(--canvas-label-scale,1))]')
    const svg = b.querySelector('svg')
    expect(tokens(svg)).toContain('w-[calc(15px*var(--canvas-label-scale,1))]')
    expect(svg?.getAttribute('width')).toBe('15')
  })

  it('the hit area is at least what it was (box + slop ≥ the 24px it was, and ≥ WCAG 2.5.8)', () => {
    const hit = CANVAS_QUICK_ACTION_BOX_PX + 2 * CANVAS_QUICK_ACTION_SLOP_PX
    expect(hit).toBeGreaterThanOrEqual(20 + 2 * 2)
    expect(hit).toBeGreaterThanOrEqual(MIN_TARGET_RENDERED_PX)
    expect(NODE_RAIL_BUTTON_CLASSES).toContain(CANVAS_HIT_SLOP_CLASSES[2])
  })

  it('resting colours: data icons #777B77, the behaviour icon #736DA0 — each from a brand.css token', () => {
    const brand = readFileSync(join(__dirname, '../../../styles/brand.css'), 'utf8')
    const triple = (name: string) => {
      const m = brand.match(new RegExp(`--${name}:\\s*(\\d+)\\s+(\\d+)\\s+(\\d+);`))
      expect(m, `--${name} must be declared in brand.css`).not.toBeNull()
      return `#${m!.slice(1, 4).map((n) => Number(n).toString(16).padStart(2, '0')).join('').toUpperCase()}`
    }
    const varOf = (cls: string) => cls.match(/^text-\[color:rgb\(var\(--([\w-]+)\)\)\]$/)?.[1] ?? null
    const restVar = varOf(NODE_RAIL_REST_TONE_CLASS)
    const behaviourVar = varOf(NODE_RAIL_BEHAVIOUR_TONE_CLASS)
    expect(restVar, NODE_RAIL_REST_TONE_CLASS).not.toBeNull()
    expect(behaviourVar, NODE_RAIL_BEHAVIOUR_TONE_CLASS).not.toBeNull()
    expect(triple(restVar!)).toBe(CONTRACT_ICON_REST_HEX)
    expect(triple(behaviourVar!)).toBe(CONTRACT_BEHAVIOUR_HEX)
  })

  it('the evidence icon rests in the icon grey and the behaviour icon in its own colour — not body ink', () => {
    render(
      <NodeSignalRailIcons
        nodeId="f1"
        label="Trial conversion"
        reasons={[
          { kind: 'evidence_gap', order: 3, label: 'Evidence here would narrow the comparison.' },
          { kind: 'behavioural', order: 4, label: 'Worth checking: anchoring.' },
        ]}
      />,
    )
    const evidence = screen.getByTestId('node-rail-evidence-f1')
    const behaviour = screen.getByTestId('node-rail-behaviour-f1')
    expect(tokens(evidence)).toContain(NODE_RAIL_REST_TONE_CLASS)
    expect(tokens(behaviour)).toContain(NODE_RAIL_BEHAVIOUR_TONE_CLASS)
    expect(tokens(behaviour)).not.toContain('text-text-body')
    expect(tokens(evidence)).not.toContain('text-text-light')
    // Contrast: the two tones are different classes (behaviour is not grey).
    expect(NODE_RAIL_BEHAVIOUR_TONE_CLASS).not.toBe(NODE_RAIL_REST_TONE_CLASS)
  })

  it('the coaching icon stays grey at rest (Paul pt 6) — the icon grey, never Info', () => {
    useGuidanceStore.setState({ _sendMessage: () => {} } as never)
    useCanvasStore.setState({ nodes: [{ id: 'n1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Hiring spend' } }] } as never)
    render(<NodeCoachingIcon nodeId="n1" chips={null} />)
    const icon = screen.getByTestId('node-coaching-icon-n1')
    expect(tokens(icon)).toContain(NODE_RAIL_REST_TONE_CLASS)
    expect(tokens(icon)).not.toContain('text-info')
    expect(tokens(icon)).not.toContain('text-text-light')
  })

  it('the hover quick actions rest in the same icon grey (one rail, one grey)', () => {
    useCanvasStore.setState({ nodes: [{ id: 'n1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Hiring spend' } }] } as never)
    render(<NodeQuickActions nodeId="n1" nodeType="factor" label="Hiring spend" coaching={null} />)
    const challenge = screen.getByTestId('node-action-challenge-n1')
    expect(tokens(challenge)).toContain(NODE_RAIL_REST_TONE_CLASS)
    expect(tokens(challenge)).not.toContain('text-text-light')
  })
})
