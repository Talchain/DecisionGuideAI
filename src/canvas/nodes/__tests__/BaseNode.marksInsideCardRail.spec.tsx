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
  CANVAS_GLYPH_SIZE_CLASSES,
  CANVAS_HIT_SLOP_CLASSES,
  CANVAS_QUICK_ACTION_BOX_PX,
  CANVAS_QUICK_ACTION_SLOP_PX,
  MIN_TARGET_RENDERED_PX,
  NODE_QUICK_ACTION_BAND_CSS,
  cornerMarksHeaderReserveCss,
} from '../shared/canvasGlyphScale'
import {
  NODE_RAIL_BEHAVIOUR_TONE_CLASS,
  NODE_RAIL_BUTTON_CLASSES,
  NODE_RAIL_GLYPH_CLASSES,
  NODE_RAIL_GLYPH_PX,
  NODE_RAIL_REST_TONE_CLASS,
} from '../shared/nodeCardRailStyles'
import {
  NODE_TITLE_WIDEST_WORD_PX,
  NODE_TITLE_MIN_MEASURE_PX,
  REPEATED_CARD_W,
  REPEATED_CARD_MAX_W,
  restingCardWidthForKind,
} from '../../utils/nodeLayoutConstants'
import { MAX_GLYPH_COUNTER_SCALE, MAX_LABEL_COUNTER_SCALE } from '../../utils/zoomLegibility'
import { NodeRailIcon, NodeSignalRailIcons } from '../shared/NodeRailIcons'
import { NodeCoachingIcon } from '../shared/NodeCoachingIcon'
import { NodeQuickActions } from '../shared/NodeQuickActions'

// ── contract §02 values (restated here on purpose — see the header) ──────────
const CONTRACT_FRAME_PX = 1


const CONTRACT_MARK_BOX_PX = 25
 // 12 + 21 = 7 + 25 + 1
const CONTRACT_ICON_GLYPH_PX = 15
const CONTRACT_ICON_REST_HEX = '#777B77'
const CONTRACT_BEHAVIOUR_HEX = '#736DA0'
/** `.node h3{line-height:1.25}` (the served title's `leading-tight`). */

/** The corner stack's scaled gap between two marks (served, unchanged here). */


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
type Scales = number | { text: number; glyph: number }
/**
 * The pair of scales a zoom actually produces (27 Sep 2026): glyphs and marks at
 * `g` (the uncapped glyph scale, 1 → 2 across the band), text at the text scale,
 * which follows `g` up to `MAX_LABEL_COUNTER_SCALE` and stops there.
 */
const scalesAt = (g: number) => ({ text: Math.min(MAX_LABEL_COUNTER_SCALE, g), glyph: g })
function px(css: string, scales: Scales, box: { pct?: number; lh?: number } = {}): number {
  const { text, glyph } = typeof scales === 'number' ? { text: scales, glyph: scales } : scales
  const unit = (u: '%' | 'lh', base: number | undefined, divisor: number) => (_: string, n: string) => {
    if (base === undefined) throw new Error(`${u} in ${css} with no base to resolve it against`)
    return `(${n}*${base / divisor})`
  }
  const expr = css
    .replace(/var\(--canvas-label-scale,\s*1\)/g, String(text))
    .replace(/var\(--canvas-glyph-scale,\s*1\)/g, String(glyph))
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


/**
 * The title box's width at glyph scale `g` (27 Sep 2026). The repeated card is now
 * the ED 248, WIDER than the layout floor (190.88), so its title shares its line
 * and the header row carries the corner reserve (`cornerMarksHeaderReserveCss`):
 * the flex-1 title fills what the reserve leaves, never less than its minimum
 * measure. With no reserve (or a card at the floor) this is the minimum measure,
 * which is what the old 260 card always was.
 */


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
  it('the marks sit in the bottom-left band inside the frame, never above the border', () => {
    attentionMarked = true
    const root = renderCard('outcome', 'o1', 'Customer retention after a price rise')

    const band = screen.getByTestId('outcome-bottom-marks-o1')
    expect(band).toHaveClass('absolute', 'bottom-1.5', 'left-3', 'gap-1')
    expect(band).toContainElement(screen.getByTestId('attention-marker-o1'))
    expect(root).toContainElement(band)
    expect(within(root).queryByTestId('node-title-corner-spacer')).toBeNull()
    expect(screen.getByTestId('node-header-row').style.paddingRight).toBe('')
    const measure = parseFloat(root.style.width) - 2 * CONTRACT_FRAME_PX - parseFloat(root.style.paddingLeft) - parseFloat(root.style.paddingRight)
    for (const g of Array.from({ length: 101 }, (_, i) => 1 + i * (MAX_GLYPH_COUNTER_SCALE - 1) / 100)) expect(measure).toBeGreaterThanOrEqual(NODE_TITLE_WIDEST_WORD_PX * scalesAt(g).text)

    expect(screen.getByTestId('node-corner-stack-o1').children).toHaveLength(0)
    expect(tokens(screen.getByTestId('attention-marker-o1'))).not.toContain('absolute')
  })

  it('a repeated card: the full title measure is available at 100% and the bound, with its mark in the band', () => {
    attentionMarked = true
    expect(restingCardWidthForKind('outcome')).toBe(REPEATED_CARD_MAX_W)
    const root = renderCard('outcome', 'o1', 'Customer retention after a price rise', { maxWidth: REPEATED_CARD_W })
    expect(parseFloat(root.style.width)).toBe(248)

    const band = screen.getByTestId('outcome-bottom-marks-o1')
    expect(band).toHaveClass('absolute', 'bottom-1.5', 'left-3', 'gap-1')
    expect(band).toContainElement(screen.getByTestId('attention-marker-o1'))
    expect(root).toContainElement(band)
    expect(within(root).queryByTestId('node-title-corner-spacer')).toBeNull()
    expect(screen.getByTestId('node-header-row').style.paddingRight).toBe('')
    const measure = parseFloat(root.style.width) - 2 * CONTRACT_FRAME_PX - parseFloat(root.style.paddingLeft) - parseFloat(root.style.paddingRight)
    for (const g of [1, MAX_GLYPH_COUNTER_SCALE]) expect(measure).toBeGreaterThanOrEqual(NODE_TITLE_WIDEST_WORD_PX * scalesAt(g).text)

  })

  it('TWO marks (attention + coaching): both in the band, in order, with no title spacer', () => {
    attentionMarked = true
    useGuidanceStore.getState().setGuidanceItems([guidance('o1')])
    const root = renderCard('outcome', 'o1', 'Customer retention after a price rise')

    const band = screen.getByTestId('outcome-bottom-marks-o1')
    expect(band).toHaveClass('absolute', 'bottom-1.5', 'left-3', 'gap-1')
    expect(band).toContainElement(screen.getByTestId('attention-marker-o1'))
    expect(root).toContainElement(band)
    expect(within(root).queryByTestId('node-title-corner-spacer')).toBeNull()
    expect(screen.getByTestId('node-header-row').style.paddingRight).toBe('')
    const measure = parseFloat(root.style.width) - 2 * CONTRACT_FRAME_PX - parseFloat(root.style.paddingLeft) - parseFloat(root.style.paddingRight)
    for (const g of [1, MAX_GLYPH_COUNTER_SCALE]) expect(measure).toBeGreaterThanOrEqual(NODE_TITLE_WIDEST_WORD_PX * scalesAt(g).text)

    expect(band).toContainElement(screen.getByTestId('node-coaching-marker-o1'))
    expect(Array.from(band.querySelectorAll('[data-testid="attention-marker-o1"], [data-testid="node-coaching-marker-o1"]')).map(el => el.getAttribute('data-testid'))).toEqual(['attention-marker-o1', 'node-coaching-marker-o1'])
  })

  it('CONTRAST — no mark: no spacer, no header reserve, an empty stack, and the title keeps its measure', () => {
    renderCard('outcome', 'o1', 'Customer retention after a price rise')
    const title = screen.getByTestId('node-title')
    expect(within(title).queryByTestId('node-title-corner-spacer')).toBeNull()
    expect(screen.getByTestId('node-header-row').style.paddingRight).toBe('')
    expect(screen.getByTestId('node-corner-stack-o1').children).toHaveLength(0)
    expect((title.parentElement as HTMLElement).style.minWidth).toBe(`${NODE_TITLE_MIN_MEASURE_PX}px`)
  })

  it('contract v3.1 #18: a structural finding puts NO mark in the corner and reserves NO title spacer', () => {
    // ⚠ INVERTED BY DESIGN-GAP-v31 #18. This case used to pin the structural
    // fallback AS a corner mark (with its title spacer). v3.1's resting corner
    // is the attention mark only, so the SAME graph — a structural finding that
    // names this risk, no guidance item — now leaves the stack empty and the
    // title its full width: the blank line above such titles at landing (#17)
    // went with the glyph.
    const node = (id: string, kind: string, data: Record<string, unknown> = {}) =>
      ({ id, type: kind, position: { x: 0, y: 0 }, data: { kind, label: id, ...data } })
    useCanvasStore.setState({
      nodes: [node('o1', 'option'), node('o2', 'option'), node('f1', 'factor', { category: 'external' }), node('f2', 'factor', { category: 'controllable' }), node('r1', 'risk')],
      edges: [{ id: 'e1', source: 'o1', target: 'f1', data: {} }, { id: 'e2', source: 'o2', target: 'f2', data: {} }],
    } as never)
    const props = {
      id: 'r1', type: 'risk', position: { x: 0, y: 0 }, selected: false, isConnectable: true,
      positionAbsoluteX: 0, positionAbsoluteY: 0, dragging: false, zIndex: 0, data: { type: 'risk', label: 'r1' },
    }
    render(
      <ReactFlowProvider>
        <BaseNode {...(props as unknown as ComponentProps<typeof BaseNode>)} nodeType="risk" icon={Circle} />
      </ReactFlowProvider>,
    )
    expect(screen.queryByTestId('node-structural-marker-r1')).toBeNull()
    expect(screen.getByTestId('node-corner-stack-r1').children).toHaveLength(0)
    expect(within(screen.getByTestId('node-title')).queryByTestId('node-title-corner-spacer')).toBeNull()
  })

  it('the reserve follows the MARK, not the data: at the quiet rung the coaching marker leaves, and so does its reserve', () => {
    useGuidanceStore.getState().setGuidanceItems([guidance('o1')])
    useCanvasStore.setState({ lodRung: 'quiet' } as never)
    renderCard('outcome', 'o1', 'Customer retention after a price rise')
    expect(screen.queryByTestId('node-coaching-marker-o1')).toBeNull()
    expect(within(screen.getByTestId('node-title')).queryByTestId('node-title-corner-spacer')).toBeNull()
  })

  it('a wide anchor: the header keeps its full measure and the mark stays inside its last-row frame', () => {
    attentionMarked = true
    useCanvasStore.setState({ lodRung: 'quiet' } as never)
    const root = renderCard('goal', 'g1', 'Grow recurring revenue')
    expect(screen.getByTestId('node-header-row').style.paddingRight).toBe('')
    expect(within(root).queryByTestId('node-title-corner-spacer')).toBeNull()
    expect(root).toContainElement(screen.getByTestId('goal-bottom-marks-g1'))
    expect(screen.getByTestId('goal-bottom-marks-g1')).toContainElement(screen.getByTestId('attention-marker-g1'))
    // #2649 r3 band overlap: the anchor body clears its bottom marks band.
    expect(root.style.paddingBottom).toBe(NODE_QUICK_ACTION_BAND_CSS)
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
describe('GAP 11: the full-width title holds the widest word while marks occupy the bottom band', () => {
  // The GLYPH scale across the band (1.00 … 2.00, the bound); the TEXT scale is
  // `scalesAt(g).text` — it follows g up to the text ceiling (1.64 since the 27 Sep
  // 2026 landing text cap; it was 1.36).











  it('a 248 repeated card, ONE mark: the full title holds the widest word at every scale', () => {
    attentionMarked = true

    const root = renderCard('outcome', 'o1', 'Concentration risk in the top accounts', { maxWidth: REPEATED_CARD_W })
    expect(parseFloat(root.style.width)).toBe(REPEATED_CARD_W)

    const band = screen.getByTestId('outcome-bottom-marks-o1')
    expect(band).toHaveClass('absolute', 'bottom-1.5', 'left-3', 'gap-1')
    expect(band).toContainElement(screen.getByTestId('attention-marker-o1'))
    expect(root).toContainElement(band)
    expect(within(root).queryByTestId('node-title-corner-spacer')).toBeNull()
    expect(screen.getByTestId('node-header-row').style.paddingRight).toBe('')
    const measure = parseFloat(root.style.width) - 2 * CONTRACT_FRAME_PX - parseFloat(root.style.paddingLeft) - parseFloat(root.style.paddingRight)
    for (const g of [1, MAX_GLYPH_COUNTER_SCALE]) expect(measure).toBeGreaterThanOrEqual(NODE_TITLE_WIDEST_WORD_PX * scalesAt(g).text)


  })

  it('a 260 repeated card, TWO marks (attention + coaching): the full title stays clear of the band', () => {
    attentionMarked = true
    useGuidanceStore.getState().setGuidanceItems([guidance('o1')])
    const root = renderCard('outcome', 'o1', 'Cannibalization of the entry tier', { maxWidth: 260 })
    expect(parseFloat(root.style.width)).toBe(260)

    const band = screen.getByTestId('outcome-bottom-marks-o1')
    expect(band).toHaveClass('absolute', 'bottom-1.5', 'left-3', 'gap-1')
    expect(band).toContainElement(screen.getByTestId('attention-marker-o1'))
    expect(root).toContainElement(band)
    expect(within(root).queryByTestId('node-title-corner-spacer')).toBeNull()
    expect(screen.getByTestId('node-header-row').style.paddingRight).toBe('')
    const measure = parseFloat(root.style.width) - 2 * CONTRACT_FRAME_PX - parseFloat(root.style.paddingLeft) - parseFloat(root.style.paddingRight)
    for (const g of [1, MAX_GLYPH_COUNTER_SCALE]) expect(measure).toBeGreaterThanOrEqual(NODE_TITLE_WIDEST_WORD_PX * scalesAt(g).text)

    expect(band).toContainElement(screen.getByTestId('node-coaching-marker-o1'))
  })

  it('an intermediate width (270): no header reserve or spacer narrows the title', () => {
    attentionMarked = true

    const root = renderCard('outcome', 'o1', 'Concentration risk in the top accounts', { maxWidth: 270 })
    expect(parseFloat(root.style.width)).toBe(270)

    const band = screen.getByTestId('outcome-bottom-marks-o1')
    expect(band).toHaveClass('absolute', 'bottom-1.5', 'left-3', 'gap-1')
    expect(band).toContainElement(screen.getByTestId('attention-marker-o1'))
    expect(root).toContainElement(band)
    expect(within(root).queryByTestId('node-title-corner-spacer')).toBeNull()
    expect(screen.getByTestId('node-header-row').style.paddingRight).toBe('')
    const measure = parseFloat(root.style.width) - 2 * CONTRACT_FRAME_PX - parseFloat(root.style.paddingLeft) - parseFloat(root.style.paddingRight)
    for (const g of [1, MAX_GLYPH_COUNTER_SCALE]) expect(measure).toBeGreaterThanOrEqual(NODE_TITLE_WIDEST_WORD_PX * scalesAt(g).text)


  })

  it('the CAUSAL LENS title (a full-width block; netlify.toml ships the lens ON) keeps clear of the mark by the same rule', () => {
    attentionMarked = true
    graphLensOn = true
    useCanvasStore.setState({ lens: { ...INITIAL_LENS, active: 'causal' } } as never)
    const root = renderCard('outcome', 'o1', 'Concentration risk in the top accounts', { maxWidth: REPEATED_CARD_W })

    const band = screen.getByTestId('outcome-bottom-marks-o1')
    expect(band).toHaveClass('absolute', 'bottom-1.5', 'left-3', 'gap-1')
    expect(band).toContainElement(screen.getByTestId('attention-marker-o1'))
    expect(root).toContainElement(band)
    expect(within(root).queryByTestId('node-title-corner-spacer')).toBeNull()
    expect(screen.queryByTestId('node-header-row')).toBeNull()
    const measure = parseFloat(root.style.width) - 2 * CONTRACT_FRAME_PX - parseFloat(root.style.paddingLeft) - parseFloat(root.style.paddingRight)
    for (const g of [1, MAX_GLYPH_COUNTER_SCALE]) expect(measure).toBeGreaterThanOrEqual(NODE_TITLE_WIDEST_WORD_PX * scalesAt(g).text)

    expect(root.textContent).toContain('Concentration risk in the top accounts')
  })

  it('CONTRAST: two marks and no marks both leave the title full width, with no spacer', () => {
    attentionMarked = true
    useGuidanceStore.getState().setGuidanceItems([guidance('o1')])
    const root = renderCard('outcome', 'o1', 'Concentration risk in the top accounts')

    const band = screen.getByTestId('outcome-bottom-marks-o1')
    expect(band).toHaveClass('absolute', 'bottom-1.5', 'left-3', 'gap-1')
    expect(band).toContainElement(screen.getByTestId('attention-marker-o1'))
    expect(root).toContainElement(band)
    expect(within(root).queryByTestId('node-title-corner-spacer')).toBeNull()
    expect(screen.getByTestId('node-header-row').style.paddingRight).toBe('')
    const measure = parseFloat(root.style.width) - 2 * CONTRACT_FRAME_PX - parseFloat(root.style.paddingLeft) - parseFloat(root.style.paddingRight)
    for (const g of [1, MAX_GLYPH_COUNTER_SCALE]) expect(measure).toBeGreaterThanOrEqual(NODE_TITLE_WIDEST_WORD_PX * scalesAt(g).text)

    expect(band).toContainElement(screen.getByTestId('node-coaching-marker-o1'))
    cleanup()
    attentionMarked = false
    useGuidanceStore.getState().clearGuidanceItems()
    renderCard('outcome', 'o2', 'Concentration risk in the top accounts')
    expect(within(screen.getByTestId('node-title')).queryByTestId('node-title-corner-spacer')).toBeNull()
    expect(screen.queryByTestId('attention-marker-o2')).toBeNull()
    expect(screen.queryByTestId('node-coaching-marker-o2')).toBeNull()
  })
})

// ═════════════════════════════════════════════════════════════════════════════
describe('GAP 11 — worded state pills leave the corner for an in-flow row on the card', () => {
  it('"Needs input" renders in the card\'s bottom band, not in the corner stack', () => {
    const root = renderCard('goal', 'g1', 'Grow recurring revenue')
    const pill = screen.getByTestId('needs-input-pill')
    expect(screen.getByTestId('goal-bottom-marks-g1')).toContainElement(pill)
    expect(screen.getByTestId('node-corner-stack-g1')).not.toContainElement(pill)
    expect(root).toContainElement(pill)
    expect(tokens(pill)).not.toContain('absolute')
  })

  it('CONTRAST: the attention mark and pill share the band and leave the corner empty', () => {
    attentionMarked = true
    renderCard('goal', 'g1', 'Grow recurring revenue')
    const band = screen.getByTestId('goal-bottom-marks-g1')
    expect(band).toContainElement(screen.getByTestId('attention-marker-g1'))
    expect(band).toContainElement(screen.getByTestId('needs-input-pill'))
    expect(screen.getByTestId('node-corner-stack-g1').children).toHaveLength(0)
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
    expect(NODE_RAIL_BUTTON_CLASSES.split(/\s+/)).toContain('w-[calc(25px*var(--canvas-glyph-scale,1))]')
    expect(NODE_RAIL_BUTTON_CLASSES.split(/\s+/)).toContain('h-[calc(25px*var(--canvas-glyph-scale,1))]')
  })

  it('a rendered rail icon is a 25px box holding a 15px glyph (class AND the size attribute fallback)', () => {
    render(<NodeRailIcon testId="rail-ev" label="Evidence" icon={SearchCheck} tone="muted" onActivate={() => {}} />)
    const b = screen.getByTestId('rail-ev')
    expect(tokens(b)).toContain('w-[calc(25px*var(--canvas-glyph-scale,1))]')
    const svg = b.querySelector('svg')
    expect(tokens(svg)).toContain('w-[calc(15px*var(--canvas-glyph-scale,1))]')
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
    // 29 Sep 2026: the contract's `.icon-btn.coaching{color:var(--muted)}`.
    expect(tokens(icon)).toContain('text-text-light')
    expect(tokens(icon)).not.toContain('text-info')
    expect(tokens(icon)).not.toContain(NODE_RAIL_REST_TONE_CLASS)
  })

  it('the hover quick actions rest in the same icon grey (one rail, one grey)', () => {
    useGuidanceStore.setState({ _dispatchAction: () => {} } as never)
    useCanvasStore.setState({ nodes: [{ id: 'n1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Hiring spend' } }] } as never)
    render(<NodeQuickActions nodeId="n1" nodeType="factor" label="Hiring spend" coaching={null} />)
    const challenge = screen.getByTestId('node-action-challenge-n1')
    expect(tokens(challenge)).toContain(NODE_RAIL_REST_TONE_CLASS)
    expect(tokens(challenge)).not.toContain('text-text-light')
  })
})
