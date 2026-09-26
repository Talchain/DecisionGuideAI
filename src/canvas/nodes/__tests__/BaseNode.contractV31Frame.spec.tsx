/**
 * ⭐ THE CARD FRAME, AS CONTRACT v3.1 DRAWS IT — one grammar spec for BaseNode.
 *
 * Authority: `olumi-canvas-visual-contract-v31.html` <style>, line 27:
 *   `.node{border:1px solid color-mix(in srgb,var(--kind) 76%,#E2DDD5);
 *          border-radius:8px;box-shadow:0 2px 4px #25252005;
 *          transition:opacity .16s,box-shadow .16s}`
 *   `.node.selected{box-shadow:0 0 0 2px var(--info),0 3px 12px #1B647417}`
 *   `.node .shape{position:absolute;top:-12px;…}` (a bare kind shape, no tile)
 *   `.node .bottom-port{width:3px;height:3px;background:#51554F}`
 *   `.node.wide{padding:11px 13px 9px}` + `.node.wide .rail{right:6px;bottom:6px}`
 * and Paul's 23 Sep points 4 (dash = existence doubt only) and 9 (no new
 * colours; risk keeps Danger).
 *
 * Every assertion names the audited delta it pins. Class assertions are
 * TOKEN-EXACT (the class list is split), never substrings — `hover:border-x`
 * must not satisfy a `border-x` assertion (CLAUDE.md trap 19).
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { Circle } from 'lucide-react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BaseNode } from '../BaseNode'
import { nodeColors } from '../colors'
import { useCanvasStore } from '../../store'
import {
  ANCHOR_RAIL_RESERVE_CLASSES,
  CANVAS_GLYPH_SIZE_CLASSES,
  anchorRailReservePx,
} from '../shared/canvasGlyphScale'

type Kind = 'goal' | 'decision' | 'option' | 'outcome' | 'factor' | 'risk'
const KINDS: readonly Kind[] = ['goal', 'decision', 'option', 'outcome', 'factor', 'risk']

const baseProps = (kind: Kind, id: string, data: Record<string, unknown>, selected = false) => ({
  id,
  type: kind,
  position: { x: 0, y: 0 },
  selected,
  isConnectable: true,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  dragging: false,
  zIndex: 0,
  data: { type: kind, ...data },
})

function renderCard(
  kind: Kind,
  data: Record<string, unknown> = { label: `A ${kind}` },
  opts: { selected?: boolean; children?: React.ReactNode; titleOverride?: string; railIcons?: React.ReactNode } = {},
) {
  const id = `${kind}-frame`
  const props = baseProps(kind, id, data, opts.selected === true)
  useCanvasStore.setState({
    nodes: [props] as never,
    edges: [],
    highlightedNodes: new Set<string>(),
    dimmedNodeIds: new Set<string>(),
  })
  const view = render(
    <ReactFlowProvider>
      <BaseNode
        {...(props as any)}
        nodeType={kind}
        icon={Circle}
        titleOverride={opts.titleOverride}
        railIcons={opts.railIcons}
      >
        {opts.children}
      </BaseNode>
    </ReactFlowProvider>,
  )
  const root = view.container.querySelector('[role="group"]') as HTMLElement
  expect(root, 'the card root (role=group) must render').not.toBeNull()
  return { root, container: view.container }
}

const tokens = (el: Element) => (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean)

beforeEach(() => {
  useCanvasStore.setState({
    nodes: [],
    edges: [],
    highlightedNodes: new Set<string>(),
    dimmedNodeIds: new Set<string>(),
  })
})
afterEach(() => cleanup())

describe('contract v3.1 — one 1px frame, one radius, one resting elevation (FRAME-01/02/05, OR-01, OR-04, ANC-08, T11)', () => {
  it.each(KINDS)('%s: `rounded-sm` (8px) and a 1px `border`, never 2px / 0.5px / 14px', (kind) => {
    const { root } = renderCard(kind)
    const t = tokens(root)
    expect(t).toContain('rounded-sm')
    expect(t).toContain('border')
    expect(t).not.toContain('rounded-lg')
    expect(t).not.toContain('border-2')
    expect(t).not.toContain('border-[0.5px]')
  })

  it.each(KINDS)('%s: resting elevation is the contract\'s own `.node` shadow — the goal no longer floats at `shadow-3`', (kind) => {
    // DESIGN-GAP-v31 #43: `.node{box-shadow:0 2px 4px #25252005}`, its own
    // token (`--shadow-card-rest`, brand.css) — DS v5 `shadow-1` stays on the
    // ~49 other surfaces that wear it.
    const { root } = renderCard(kind)
    const t = tokens(root)
    expect(t).toContain('shadow-card-rest')
    expect(t).not.toContain('shadow-1')
    expect(t).not.toContain('shadow-3')
  })

  it('an INCOMPLETE factor (no value) keeps the 1px frame — the state is the pill, not a heavier stroke', () => {
    const { root } = renderCard('factor', { label: 'Hiring spend' })
    expect(tokens(root)).toContain('border')
    expect(tokens(root)).not.toContain('border-2')
  })

  it('the box stays byte-identical: padding absorbs the old stroke (factor 0.5px → 11.5px pad, risk 2px → 13px pad)', () => {
    // Border + padding on each side is what the old stroke + 12px made, so the
    // content box — and every height ELK reserved — is unchanged.
    const factor = renderCard('factor', { label: 'F', observed_state: { value: 4 } }).root
    expect(factor.style.paddingLeft).toBe('11.5px')
    expect(factor.style.paddingRight).toBe('11.5px')
    cleanup()
    const risk = renderCard('risk', { label: 'R' }).root
    expect(risk.style.paddingLeft).toBe('13px')
    expect(risk.style.paddingTop).toBe('13px')
    cleanup()
    const option = renderCard('option', { label: 'O' }).root
    expect(option.style.paddingLeft).toBe('12px')
  })
})

describe('contract v3.1 — the frame colour is the kind hue mixed toward the warm neutral (FRAME-08, OR-03, T10)', () => {
  it.each(KINDS)('%s: wears `colors.frame`, not the full-strength `colors.border`', (kind) => {
    const { root } = renderCard(kind)
    const t = tokens(root)
    expect(t).toContain(nodeColors[kind].frame)
    expect(t).not.toContain(nodeColors[kind].border)
  })

  it.each(KINDS)('%s: the frame is a 76% color-mix of two EXISTING tokens — no new colour', (kind) => {
    const frame = nodeColors[kind].frame
    expect(frame).toMatch(/^border-\[color:color-mix\(in_srgb,var\(--[a-z]+\)_76%,var\(--border-default\)\)\]$/)
  })
})

describe('contract v3.1 — no dashed card for "uncertain" (FRAME-06; Paul pt 4: dash = existence doubt, on a connection)', () => {
  // Option, outcome and risk only: an unconfigured goal / decision fixture is
  // INCOMPLETE, and that path never took the dash — so it could not go RED.
  it.each(['option', 'outcome', 'risk'] as const)(
    '%s with data.uncertainty 0.7 keeps a SOLID frame',
    (kind) => {
      const { root } = renderCard(kind, { label: 'Uncertain', uncertainty: 0.7 })
      expect(tokens(root)).not.toContain('border-dashed')
    },
  )

  // GAP-17 (DESIGN-GAP-AUDIT-20260924.md row 17), updated 24 Sep 2026: this
  // test used to PIN the exact behaviour the gap flags — "an EXTERNAL factor
  // keeps its dash" — reusing the connection-only existence-doubt channel on
  // a card frame. Row 17's own reasoning applies here too: dash is a
  // connection channel (contract §03; v3.1 pt4), never a card-frame one, and
  // no other card channel is being pressed into service to replace it — see
  // `BaseNode.gap17NoDashedFactorFrame.spec.tsx` for the full RED/green pin.
  // Flipped from `toContain` to `not.toContain`.
  it('twin: an EXTERNAL factor is SOLID, not dashed — controllability is not a frame channel (GAP-17)', () => {
    const { root } = renderCard('factor', { label: 'Weather', category: 'external' })
    expect(tokens(root)).not.toContain('border-dashed')
  })
})

describe('contract v3.1 — selection is one Info ring, flush, with a lift (FRAME-09, OR-10, T03)', () => {
  it.each(KINDS)('%s selected: `ring-2 ring-info` + `shadow-2`, no kind hue and no white offset', (kind) => {
    const { root } = renderCard(kind, { label: 'Picked' }, { selected: true })
    const t = tokens(root)
    expect(t).toContain('ring-2')
    expect(t).toContain('ring-info')
    expect(t).toContain('shadow-2')
    expect(t).not.toContain('ring-offset-2')
    expect(t).not.toContain('ring-4')
    expect(t.some((c) => /^ring-(goal|option|success|factor|danger)\//.test(c))).toBe(false)
  })

  it('colors.ts: every family spells the SAME selected token', () => {
    const selected = new Set(Object.values(nodeColors).map((c) => c.selected))
    expect([...selected]).toEqual(['ring-2 ring-info'])
  })
})

describe('contract v3.1 — the root transitions visual channels only (FRAME-14)', () => {
  it('no `transition-all` (it eased width/padding on relayout); the listed channels keep the driver outline fade', () => {
    const { root } = renderCard('factor')
    const t = tokens(root)
    expect(t).not.toContain('transition-all')
    expect(t).toContain('transition-[opacity,box-shadow,border-color,background-color,outline-color,filter]')
  })
})

describe('contract v3.1 — the connectors (FRAME-03, FRAME-04, OR-05)', () => {
  it('the type glyph is a bare outlined shape on the border — no white tile, no grey ring', () => {
    renderCard('outcome')
    const glyph = screen.getByTestId('node-type-glyph')
    const t = tokens(glyph)
    for (const tile of ['bg-panel', 'border-panel-border', 'rounded-md', 'border-[1.5px]']) {
      expect(t, `tile token ${tile} is back`).not.toContain(tile)
    }
    // v3.1 WS1 #15: the contract's 24px at −12px (`.node .shape`), counter-scaled
    // like the canvas type — it was 22 flow units, 11px on screen at landing.
    expect(glyph.style.top).toBe('calc(-12px * var(--canvas-label-scale, 1))')
    expect(glyph.style.width).toBe('calc(24px * var(--canvas-label-scale, 1))')
    const shape = glyph.querySelector('polygon, circle, rect') as SVGElement
    expect(shape.getAttribute('stroke')).toBe('var(--bg-panel)')
    // The svg fills the counter-scaled box (its `width` attribute is the
    // unscaled fallback; the class sizes it).
    expect(glyph.querySelector('svg')?.getAttribute('width')).toBe('24')
    expect(tokens(glyph.querySelector('svg') as Element)).toEqual(expect.arrayContaining(['h-full', 'w-full']))
  })

  it('the bottom (source) handle is the 3px port class, not a kind-coloured disc', () => {
    const { container } = renderCard('risk')
    const out = container.querySelector('[aria-label="Output connection"]') as HTMLElement
    expect(out).not.toBeNull()
    const t = tokens(out)
    expect(t).toContain('olumi-node-port')
    expect(t).not.toContain('bg-danger')
    expect(out.style.width).toBe('12px')
  })

  it('the top (target) handle keeps its 12px hit box and paints nothing', () => {
    const { container } = renderCard('factor')
    const inHandle = container.querySelector('[aria-label="Input connection"]') as HTMLElement
    expect(inHandle).not.toBeNull()
    expect(inHandle.style.width).toBe('12px')
    expect(inHandle.style.background).toBe('transparent')
    expect(tokens(inHandle)).not.toContain('bg-factor')
  })

  it('index.css draws the port as a 3px dark dot and re-lights it on hover / selection', () => {
    const css = readFileSync(path.resolve(__dirname, '../../../index.css'), 'utf8')
    expect(css).toMatch(/\.react-flow__handle\.olumi-node-port\s*\{[^}]*radial-gradient\(circle, var\(--text-body\) 0 1\.5px, transparent 2px\)/)
    expect(css).toMatch(/\.react-flow__node:hover \.react-flow__handle\.olumi-node-port,\s*\n\.react-flow__node\.selected \.react-flow__handle\.olumi-node-port\s*\{[^}]*var\(--info\)/)
  })
})

describe('contract v3.1 — the anchors are wide and shallow, rail beside the last row (ANC-02, RHY-02)', () => {
  it.each(['decision', 'goal'] as const)('%s: 11px top / 9px bottom, no 50px band below the row', (kind) => {
    const { root } = renderCard(kind, { label: 'Anchor' }, { children: <div data-testid="anchor-row">row</div> })
    expect(root.style.paddingTop).toBe('11px')
    expect(root.style.paddingBottom).toBe('9px')
  })

  it('the anchor BODY reserves the rail\'s run and height, sized to the rail it mounts; the title keeps the full measure (WS1 #16)', () => {
    // S5 / Codex CHANGES_REQUIRED 5809540479: a last-row-only reserve let the rail
    // (taller than a shallow anchor's last row) reach up and cover the title and
    // "Top gap" line on vendor-selection. S5 answered with a WHOLE-CARD reserve,
    // which squeezed the title and sent the rail below the card at landing
    // (#16). The body now carries the contract's row padding
    // (`.node.wide .target-row{padding-right}`) AND a min-height of the rail's
    // own box, so the rail's top can never rise above the body into the title.
    const { root } = renderCard('decision', { label: 'Q' }, {
      children: <div data-testid="anchor-row">row</div>,
      railIcons: <span data-testid="run-icon" />,
    })
    const body = screen.getByTestId('anchor-body-rail-beside')
    // Challenge + More + Ask/coaching = 3, plus the caller's run icon = 4.
    expect(body.getAttribute('data-anchor-rail-buttons')).toBe('4')
    expect(body.style.paddingRight).toBe(`calc(${anchorRailReservePx(4)}px * var(--canvas-label-scale, 1) + -6px)`)
    expect(body.style.minHeight).toBe('calc(25px * var(--canvas-label-scale, 1) + -3px)')
    // CONTRAST — the card root carries no rail reserve: the title is not squeezed.
    expect(root.style.paddingRight).not.toMatch(/canvas-label-scale/)
    expect(tokens(body)).not.toContain(ANCHOR_RAIL_RESERVE_CLASSES[4])
  })

  it('twin: a factor keeps the band below its rows and gets no beside-rail reserve', () => {
    const { root } = renderCard('factor', { label: 'F', observed_state: { value: 4 } }, { children: <div>row</div> })
    expect(root.style.paddingBottom).toContain('var(--canvas-label-scale, 1)')
    expect(screen.queryByTestId('anchor-body-rail-beside')).toBeNull()
  })
})

describe('S5: the anchors keep 11 / 9 at every rung; WS1 #16: the rail is inside them wherever it is mounted', () => {
  // Canvas Browser Gate on #1932 (24 Sep): `heightVsZoom` — below the floor the
  // anchors fell back to 12 / 12 and drew taller than anywhere above it;
  // `nodeControlOcclusion` — at the landing rung the counter-scaled beside-rail
  // covered the Question's own title.
  afterEach(() => { useCanvasStore.setState({ lodRung: 'full' } as never) })

  it.each(['decision', 'goal'] as const)('%s at the quiet rung: 11/9, the rail INSIDE beside the body (never hanging below the card)', (kind) => {
    useCanvasStore.setState({ lodRung: 'quiet' } as never)
    const { root, container } = renderCard(kind, { label: 'Anchor' }, { children: <div data-testid="anchor-row">row</div> })
    expect(root.style.paddingTop).toBe('11px')
    expect(root.style.paddingBottom).toBe('9px')
    expect(screen.getByTestId('anchor-body-rail-beside')).toBeTruthy()
    expect(container.querySelector('[data-rail-placement]')?.getAttribute('data-rail-placement')).toBe('inset')
  })

  it.each(['decision', 'goal'] as const)('%s below the floor (line): still 11/9 — never taller than at landing', (kind) => {
    useCanvasStore.setState({ lodRung: 'line' } as never)
    const { root } = renderCard(kind, { label: 'Anchor' }, { children: <div data-testid="anchor-row">row</div> })
    expect(root.style.paddingTop).toBe('11px')
    expect(root.style.paddingBottom).toBe('9px')
  })

  it('CONTRAST — at Normal (full) the rail is beside the last row, as ANC-02 draws it', () => {
    useCanvasStore.setState({ lodRung: 'full' } as never)
    const { container } = renderCard('decision', { label: 'Q' }, { children: <div data-testid="anchor-row">row</div> })
    expect(screen.getByTestId('anchor-body-rail-beside')).toBeTruthy()
    expect(container.querySelector('[data-rail-placement]')?.getAttribute('data-rail-placement')).toBe('inset')
  })
})

describe('bounded anatomy: below Normal, factor and option cards reserve NO dead band (ED 5809278282)', () => {
  // The legacy 24px bottom band was reserved under factor/option cards below the
  // legibility floor for a hover row that, since S5, is drawn BELOW the card at
  // those rungs (`placement="below"`) — so the 24px held nothing. Measured on
  // vendor-selection at the landing scale: 23.5 units under every factor and
  // option against 11.5 on outcome/risk. ED's height ruling ("title + one
  // primary line inside the fixed fit-safe box") resolves the rowed question
  // ("drop the reservation below the floor, or keep one uniform card box").
  afterEach(() => { useCanvasStore.setState({ lodRung: 'full' } as never) })

  it.each([
    ['factor', 'quiet'], ['factor', 'line'], ['option', 'quiet'], ['option', 'line'],
  ] as const)('%s at %s: the bottom padding is the side padding, not a 24px band', (kind, rung) => {
    useCanvasStore.setState({ lodRung: rung } as never)
    const { root } = renderCard(kind, { label: 'X', observed_state: { value: 4 } }, { children: <div>row</div> })
    expect(root.style.paddingBottom).toBe(root.style.paddingLeft)
    expect(root.style.paddingBottom).not.toBe('24px')
  })

  it('CONTRAST — at Normal (full) the factor still reserves the scaled rail band', () => {
    useCanvasStore.setState({ lodRung: 'full' } as never)
    const { root } = renderCard('factor', { label: 'X', observed_state: { value: 4 } }, { children: <div>row</div> })
    expect(root.style.paddingBottom).toContain('var(--canvas-label-scale, 1)')
  })
})

describe('contract v3.1 — the rendered rail band tracks the live scale (RHY-01)', () => {
  // ⛔ UPDATED 25 Sep 2026 (gap 34): 22 → 27 because the DESIGN moved the rail
  // box to the contract's 25px (`.icon-btn{width:25px;height:25px}`); the band is
  // derived from it, 6 + (25 + 2) × scale. The claim — a calc over the live
  // scale, not a fixed band — is unchanged.
  it('an ordinary card renders the band as a calc over --canvas-label-scale, not a fixed band', () => {
    const { root } = renderCard('option', { label: 'O' }, { children: <div>row</div> })
    expect(root.style.paddingBottom).toBe('calc(6px + 27px * var(--canvas-label-scale, 1))')
  })
})

describe('contract v3.1 — the anchor title is semibold header ink at reading zoom (ANC-04)', () => {
  it.each(['decision', 'goal'] as const)('%s title: font-semibold text-text-header', (kind) => {
    renderCard(kind)
    const t = tokens(screen.getByTestId('node-title'))
    expect(t).toContain('font-semibold')
    expect(t).toContain('text-text-header')
  })

  it('twin: a factor title stays body ink at reading zoom', () => {
    renderCard('factor')
    const t = tokens(screen.getByTestId('node-title'))
    expect(t).toContain('text-text-body')
    expect(t).not.toContain('font-semibold')
  })
})

describe('contract v3.1 — the description toggle speaks the header icon grammar (OR-11, ICON-12)', () => {
  it('counter-scaled glyph, info-soft hover, focus ring, no native title', () => {
    renderCard('outcome', { label: 'Revenue', description: 'Why it matters' })
    const btn = screen.getByTestId('node-description-toggle')
    const t = tokens(btn)
    expect(t).toContain('hover:bg-info/10')
    expect(t).toContain('focus-visible:ring-info')
    expect(t).not.toContain('hover:bg-black/5')
    // The label is the shared Tooltip + aria-label; no native `title` text.
    expect(btn.getAttribute('title') ?? '').toBe('')
    expect(btn.getAttribute('aria-label')).toBe('Expand description')
    const svg = btn.querySelector('svg') as SVGElement
    for (const c of CANVAS_GLYPH_SIZE_CLASSES[14].split(' ')) {
      expect(svg.getAttribute('class') ?? '').toContain(c)
    }
  })
})

describe('contract v3.1 — the assumption flag is a neutral ring, not amber (ICON-10)', () => {
  it('border-panel-border, never border-warning', () => {
    renderCard('factor', { label: 'F', flagged_as_assumption: true })
    const t = tokens(screen.getByTestId('assumption-badge'))
    expect(t).toContain('border-panel-border')
    expect(t).not.toContain('border-warning')
  })
})

describe('BaseNode titleOverride — display-only (ANC-11 enabler)', () => {
  // v3.1 row 36: the name's hover route is the styled tooltip, no longer a
  // native `title` — it still carries the REAL label, not the override.
  it('replaces the VISIBLE words only; the name tooltip and the card name keep the real label', () => {
    const { root } = renderCard('decision', { label: 'Question' }, { titleOverride: 'What are we exploring?' })
    const title = screen.getByTestId('node-title')
    expect(title.textContent).toBe('What are we exploring?')
    vi.useFakeTimers()
    try {
      act(() => {
        fireEvent.mouseEnter(title)
        vi.advanceTimersByTime(400)
      })
    } finally {
      vi.useRealTimers()
    }
    expect(screen.getByTestId('node-title-tooltip-name').textContent).toBe('Question')
    expect(root.getAttribute('aria-label') ?? '').toContain('Question')
  })

  it('twin: absent, the label renders as before', () => {
    renderCard('decision', { label: 'Which supplier?' })
    expect(screen.getByTestId('node-title').textContent).toBe('Which supplier?')
  })
})
