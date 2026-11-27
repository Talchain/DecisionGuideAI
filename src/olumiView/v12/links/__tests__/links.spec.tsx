/** V12 links (rule 2): drawn exactly as the View holds them. Fixture: the bakery View from the wire (no private data). */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Position, ReactFlowProvider, useStoreApi } from '@xyflow/react'
import type { View, ViewLink } from '../../../client'
import { useViewStore } from '../../../store'
import { useViewFocusLink, useViewHover } from '../../../canvas'
import { ViewLinkEdge } from '../../../../canvas/edges/ViewLinkEdge'
import { GroupLinkEdge } from '../../bands/GroupLinkEdge'
import { EdgeLabelLayer } from '../../../__tests__/edgeLabelLayer'
import { DIRECTION_NOT_SETTLED, DOUBT_DASH, EDGE_NEUTRAL, EFFECT_STROKES, GOLD, INK, INPUT_GREY, LINK_STYLES, PLAIN_WIDTH, TONE_TOKEN, linkStyle, toneOf } from '../styles'
import { effectMidpoint } from '../geometry'
import { setDefaultLevel, useSimpleLevel } from '../../simpleStore'
import { useFocusPath } from '../../bands/focusPath'
import { TIP_DELAY } from '../../../look/Tip'
import { ICONS } from '../../../look/icons'
import { installPlaceHost } from '../../../look/placeHost'
import { lanePlaceHost } from '../../../look/placeReaders'
import { GOAL_CHANCE_DRIVER_TAG_Z } from '../../../../canvas/utils/goalChanceDriverLinks'
import { applied, declared, isHidden, standsAt } from './applied'

const view: View = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/real/bakery-r5.view3.json'), 'utf8'))
const first = view.model!.links[0]!
const base = { ...first, causal: { sign: 'increases', of: 'more_of_from', target: first.to, disputed: false, author: null, text: '', strength: { state: 'sized', figure: null, low: null, likely: null } } } as unknown as ViewLink
afterEach(() => { cleanup(); useViewStore.setState({ view: null }); useFocusPath.setState({ path: null }); useSimpleLevel.setState({ levels: {} }); setDefaultLevel('simple'); useViewHover.setState({ id: null }); useViewFocusLink.setState({ id: null }); vi.useRealTimers() })

const Edge = ViewLinkEdge as unknown as (p: Record<string, unknown>) => JSX.Element
let flow: ReturnType<typeof useStoreApi> | null = null
const Grab = () => { flow = useStoreApi(); return null }
const draw = (link: ViewLink, nodes: { id: string; x: number; y: number }[] = []) => render(
  <ReactFlowProvider initialNodes={nodes.map((n) => ({ id: n.id, position: n, width: 100, height: 40, data: {} }))}><Grab /><EdgeLabelLayer><svg>
    <Edge id="e" source={link.from} target={link.to} sourceX={0} sourceY={0} targetX={100} targetY={100}
      sourcePosition={Position.Bottom} targetPosition={Position.Top} data={{ link, i: 0 }} />
  </svg></EdgeLabelLayer></ReactFlowProvider>,
).container
const withCausal = (sign: 'increases' | 'decreases' | 'none' | 'unknown', extra: Partial<ViewLink> = {}): ViewLink =>
  ({ ...base, doubt: false, alert: false, proposed: false, ...extra, causal: { ...base.causal!, sign, author: { by: 'person', text: '', title: '' }, disputed: false } }) as ViewLink
const line = (c: HTMLElement) => c.querySelector('path.react-flow__edge-path') as SVGPathElement
const g = (c: HTMLElement) => c.querySelector('g[data-view-link]') as SVGGElement
const px = (n: number) => `${n}px`
const DOTS = '0.1 6' // olumiLook.css `.ok-link-dotted`: round dots, the reason link's recipe

describe('style table', () => {
  it('every role has its stroke, dash, end and label', () => {
    expect(LINK_STYLES.effect).toMatchObject({ stroke: EFFECT_STROKES.neutral, dash: null, end: 'arrow' })
    // R5 (16 Nov): dash means doubt and nothing else, so the role lines are solid; every one of them is the thinnest rung, 2 px.
    expect(LINK_STYLES.input).toMatchObject({ stroke: INPUT_GREY, dash: null, end: 'dot', width: 2 })
    expect(LINK_STYLES.measures).toMatchObject({ stroke: GOLD, end: 'none' })
    expect(LINK_STYLES.target.stroke).toBe(GOLD)
    expect(LINK_STYLES.size).toMatchObject({ dash: null, end: 'none', label: 'size', width: 2 })
    expect(Object.values(LINK_STYLES).map((x) => x.width)).toEqual([2, 2, 2, 2, 2])
  })
  it('reason, an unknown role and no role have no style (drawn as today)', () => {
    expect(linkStyle({ role: 'reason' })).toBeNull()
    expect(linkStyle({ role: 'banana' })).toBeNull()
    expect(linkStyle({})).toBeNull()
    expect(linkStyle({ role: 'input' })?.role).toBe('input')
  })
})

describe('a modelled effect', () => {
  it('takes its colour from its direction (DS edge polarity), never ink; an arrowhead whatever its sign, with no sign glyph', () => {
    const want = { increases: 'var(--edge-positive)', decreases: 'var(--edge-negative)', none: 'var(--edge-neutral)' } as const
    for (const sign of ['increases', 'decreases', 'none'] as const) {
      const c = draw(withCausal(sign))
      expect(applied(line(c)).stroke).toBe(want[sign])
      expect(applied(line(c)).stroke).not.toBe(INK)
      expect(g(c).getAttribute('data-link-end')).toBe('arrow')
      expect(line(c).getAttribute('marker-end')).toMatch(/^url\(#/)
      expect(c.querySelector('[data-view-link-sign]')).toBeNull()
      cleanup()
    }
  })
  it('an unsettled direction is the neutral colour, and a decreasing link is never drawn in ink (fails if the polarity colour is lost)', () => {
    expect(applied(line(draw(withCausal('unknown')))).stroke).toBe('var(--edge-neutral)')
    cleanup()
    const neg = applied(line(draw(withCausal('decreases')))).stroke
    expect(neg).toBe('var(--edge-negative)'); expect(neg).not.toBe(INK)
  })
  it('L3 strength is never a width: every effect is the one 2 px rung whatever share or raw figures it carries, the line stays screen px, and a `reason` link carrying a share is 2 px too', () => {
    const shared = (share: number | null, extra: Partial<ViewLink> = {}) => { const l = withCausal('increases', extra); l.causal = { ...l.causal!, strength: { ...l.causal!.strength, share } as never }; return l }
    // The old ladder (0.25 is 3, 0.8 is 5) is gone: a share, large or small, or none, draws the same line.
    expect([0.25, 0.8, 0.1, 5, -0.5, null].map((x) => { const c = draw(shared(x)); const w = applied(line(c)).strokeWidth; cleanup(); return w })).toEqual(Array(6).fill(px(PLAIN_WIDTH)))
    expect(PLAIN_WIDTH).toBe(2)
    // Screen px: the line does not thin as the camera zooms out.
    const c = draw(shared(0.5))
    expect(applied(line(c)).vectorEffect).toBe('non-scaling-stroke')
    expect(g(c).getAttribute('data-link-width')).toBe('2')
    cleanup()
    const plain = { ...shared(0.8), causal: null, role: null, kind: 'reason' } as unknown as ViewLink
    expect(applied(line(draw(plain))).strokeWidth).toBe(px(2))
  })
  it('is dashed only when doubted (not when unsized or proposed)', () => {
    expect(applied(line(draw(withCausal('increases', { doubt: true })))).strokeDasharray).toBe(DOUBT_DASH)
    cleanup()
    const c = draw(withCausal('increases', { proposed: true }))
    expect(applied(line(c)).strokeDasharray, 'proposed is no dash').toBeUndefined()
  })
  it('a link Olumi proposed carries Olumi\'s mark on the line, not a dash', () => {
    const l = withCausal('increases'); l.causal!.author = { by: 'olumi', text: '', title: 'Olumi proposed this' }
    const c = draw(l)
    expect(c.querySelector('[data-view-link-olumi-mark="links.0"]')).not.toBeNull()
    expect(applied(line(c)).strokeDasharray).toBeUndefined()
    cleanup()
    expect(draw(withCausal('increases')).querySelector('[data-view-link-olumi-mark]')).toBeNull()
  })
  // CHANGED BY DESIGN (the lead's D4, 17 Nov: depends, disputed and unknown are no-verdict grey, each with its own small icon): the bare "?" text glyph
  // is a Lucide icon now (no text glyph as an icon); the words are unchanged.
  it('an unsettled direction gets its own small icon (no "?" text); the link is named with the fixed words, or core\'s when it sends them; core\'s `depends` gets a different icon', () => {
    const l = withCausal('unknown'); l.causal!.text = ''; l.title = ''
    const c = draw(l)
    const mark = document.body.querySelector('[data-view-link-unsettled="links.0"]')!
    expect([mark.textContent, mark.querySelector('svg') !== null, mark.getAttribute('data-link-direction')]).toEqual(['', true, 'unknown'])
    expect(g(c).getAttribute('aria-label'), 'the registry\'s words when core sent none').toBe(DIRECTION_NOT_SETTLED)
    const icon = mark.querySelector('svg')!.getAttribute('class')
    cleanup()
    // core's own direction (fields.ts linkLook): `depends` draws its own icon, not the unknown one, on the neutral line.
    const d = { ...withCausal('unknown'), title: '', direction: 'depends' } as unknown as ViewLink
    const dc = draw(d)
    const dm = document.body.querySelector('[data-view-link-unsettled="links.0"]')!
    expect([dm.getAttribute('data-link-direction'), dm.querySelector('svg')!.getAttribute('class') !== icon, applied(line(dc)).stroke]).toEqual(['depends', true, EDGE_NEUTRAL])
    cleanup(); void c
    const m = withCausal('unknown'); m.causal!.text = 'Which way this moves is not settled'; m.title = ''
    const mc = draw(m)
    expect(g(mc).getAttribute('aria-label')).toBe('Which way this moves is not settled')
    cleanup()
    draw(withCausal('increases'))
    expect(document.body.querySelector('[data-view-link-unsettled]')).toBeNull()
  })
})

describe('a first draft marks no link as Olumi\'s proposal (R3, 16 Nov)', () => {
  // A plain (not modelled) link Olumi proposed: blue inside an approved model, the neutral grey on a first draft; a doubted link is dashed on both.
  const plain = (extra: object = {}) => ({ ...first, doubt: false, alert: false, proposed: true, causal: null, role: null, kind: 'relation', ...extra }) as unknown as ViewLink
  const withView = (v: object) => useViewStore.setState({ view: { ...view, ...v } as View })
  it('proposed, and a version: Olumi\'s blue; proposed and a proposal with no version: neutral', () => {
    withView({ proposal: null, version: { id: 'v1', n: 1 } })
    // L4: the proposal is a halo, never the line's colour; the plain line keeps its neutral stroke.
    const proposed = (c: HTMLElement) => [applied(line(c)).stroke, c.querySelector('[data-link-halo-path="proposed"]') !== null]
    expect(proposed(draw(plain())), 'an approved model keeps the mark, as a halo under the neutral line').toEqual([EDGE_NEUTRAL, true]); cleanup()
    // The defect's own case (Line reviewer, edbd5fda F1): a REASON line Olumi proposed keeps Olumi's ink; one nobody proposed stays neutral.
    expect(proposed(draw(plain({ kind: 'reason', role: 'reason' }))), 'a proposed reason line is Olumi\'s too').toEqual([EDGE_NEUTRAL, true]); cleanup()
    useViewHover.setState({ id: first.from })
    expect(proposed(draw(plain({ kind: 'reason', role: 'reason', proposed: false }))), 'CONTRAST: an unproposed reason line has no halo').toEqual([EDGE_NEUTRAL, false]); cleanup()
    withView({ proposal: { id: 'p1' }, version: null })
    expect(proposed(draw(plain())), 'a first draft marks nothing: no halo, the neutral line').toEqual([EDGE_NEUTRAL, false]); cleanup()
    expect(applied(line(draw(plain({ doubt: true })))).strokeDasharray, 'CONTRAST: a doubted link is dashed on a first draft').toBe(DOUBT_DASH)
  })
})

describe('link roles', () => {
  // R5: only a link with a typed `causal` is an effect; a role line carries no `causal` here.
  const role = (r: string, extra: object = {}) => ({ ...first, doubt: false, alert: false, proposed: false, causal: null, role: r, ...extra }) as unknown as ViewLink
  it('input: neutral, 2 px and solid, a filled dot at the end, no arrowhead', () => {
    const c = draw(role('input'))
    expect(applied(line(c)).stroke).toBe(INPUT_GREY)
    expect(applied(line(c)).strokeDasharray).toBeUndefined()
    expect(applied(line(c)).strokeWidth).toBe(px(2))
    expect(g(c).getAttribute('data-link-end')).toBe('dot')
    expect(c.querySelector('marker circle')).not.toBeNull()
    expect(c.querySelector('marker path')).toBeNull()
  })
  it('measures: the DS goal colour, no polarity, no arrowhead (R5 exception, ruled by the lead: the goal\'s gold is the aim\'s own colour, not an effect\'s direction colour; width 2 px, never the ladder)', () => {
    const c = draw(role('measures'))
    expect(applied(line(c)).stroke).toBe(GOLD)
    expect(GOLD).toBe('var(--goal)')
    expect(line(c).getAttribute('marker-end')).toBeNull()
    expect(g(c).getAttribute('data-link-role')).toBe('measures')
  })
  it('target: a gold line, 2 px (the same R5 exception as measures)', () => { const c = draw(role('target')); expect([applied(line(c)).stroke, applied(line(c)).strokeWidth]).toEqual([GOLD, px(2)]) })
  it('a link with a typed `causal` is an effect whatever its role says: direction colour and arrowhead, never the role\'s dots (R5)', () => {
    const c = draw({ ...withCausal('decreases'), role: 'input' } as ViewLink)
    expect(applied(line(c)).stroke).toBe(EFFECT_STROKES.decreases)
    expect(applied(line(c)).strokeDasharray).toBeUndefined()
    expect(g(c).getAttribute('data-link-end')).toBe('arrow')
    expect(g(c).getAttribute('data-link-role')).toBe('input')
  })
  it('reason: a plain 2 px neutral line, never coloured or weighted as an effect, never ink (R5)', () => {
    // A reason link is drawn at rest (L1), in Simple and Detailed alike, as a plain neutral line (dotted by class, never an inline dash).
    setDefaultLevel('simple')
    for (const l of [role('reason'), { ...role('reason'), role: undefined, kind: 'reason' } as unknown as ViewLink, { ...first, doubt: false, alert: false, proposed: false, causal: null, label: '' } as unknown as ViewLink]) {
      const c = draw(l)
      expect(applied(line(c)).stroke).toBe(EDGE_NEUTRAL)
      expect(applied(line(c)).stroke).not.toBe(INK)
      expect(applied(line(c)).strokeWidth).toBe(px(2))
      expect(applied(line(c)).strokeDasharray, 'dots at most, never the doubt dash').not.toBe(DOUBT_DASH)
      cleanup()
    }
  })
  it('only a doubted link is dashed, whatever kind of line it is (R5)', () => {
    expect(applied(line(draw(role('input', { doubt: true })))).strokeDasharray).toBe(DOUBT_DASH)
    cleanup()
    expect(applied(line(draw(role('reason', { doubt: true })))).strokeDasharray).toBe(DOUBT_DASH)
  })
  it('size: a plain wire to the midpoint of the sized effect, labelled "size"; never an arrowhead', () => {
    const l = role('size', { sizes: { from: 'a', to: 'b' } })
    const c = draw({ ...l, from: 'f', to: 't' } as ViewLink, [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 0, y: 200 }, { id: 'f', x: 300, y: 0 }, { id: 't', x: 300, y: 100 }])
    expect(applied(line(c)).strokeDasharray).toBeUndefined()
    expect(line(c).getAttribute('marker-end')).toBeNull()
    expect(c.querySelector('[data-view-link-size-label="links.0"]')?.textContent).toBe('size')
    expect(c.querySelector('[data-view-link-size-label="links.0"]')?.getAttribute('font-size')).toBe('12')
    // React Flow has not measured the cards in jsdom, so their boxes are points at their positions.
    const m = effectMidpoint({ x: 0, y: 0, w: 0, h: 0 }, { x: 0, y: 200, w: 0, h: 0 })
    expect(line(c).getAttribute('d')).toMatch(new RegExp(`L ${m.x},${m.y}$`))
  })
  it('size with no sized link in the View: drawn as a plain line, no invented target', () => {
    const c = draw(role('size'))
    expect(c.querySelector('[data-view-link-size-label]')).toBeNull()
  })
})

describe('effectMidpoint', () => {
  it('a card below: bottom-centre to top-centre', () => { expect(effectMidpoint({ x: 0, y: 0, w: 100, h: 40 }, { x: 0, y: 200, w: 100, h: 40 })).toEqual({ x: 50, y: 120 }) })
  it('a card beside: right edge to left edge', () => { expect(effectMidpoint({ x: 0, y: 0, w: 100, h: 40 }, { x: 200, y: 0, w: 100, h: 40 })).toEqual({ x: 150, y: 20 }) })
})

describe('the lit path (21 Nov): highlight without fading', () => {
  const l = (from: string, to: string) => ({ ...withCausal('increases'), from, to }) as ViewLink
  const expectNoFade = (c: HTMLElement) => {
    for (const el of c.querySelectorAll('*')) {
      expect(el.classList.contains('v12-off-path')).toBe(false)
      expect(el.classList.contains('ok-link-off-path')).toBe(false)
      expect(Number(applied(el).opacity ?? 1)).toBeGreaterThanOrEqual(1)
      expect(Number((el as HTMLElement).style?.opacity || el.getAttribute('opacity') || 1)).toBeGreaterThanOrEqual(1)
    }
  }
  it('keeps off-path links unchanged, emphasises on-path links by 1 px in their normal colour, and clears the emphasis at rest', () => {
    const rest = draw(l('a', 'b'))
    const normal = applied(line(rest))
    expectNoFade(rest)
    cleanup()
    useFocusPath.setState({ path: new Set(['a', 'b']) })
    const on = draw(l('a', 'b'))
    const highlighted = applied(line(on))
    expect(g(on).getAttribute('data-on-path')).toBe('true')
    expect(highlighted.stroke).toBe(normal.stroke)
    expect(Number.parseFloat(highlighted.strokeWidth!)).toBe(Number.parseFloat(normal.strokeWidth!) + 1)
    expectNoFade(on)
    cleanup()
    for (const [from, to] of [['a', 'z'], ['z', 'b'], ['z', 'w']]) {
      const off = draw(l(from!, to!))
      expect(applied(line(off))).toEqual(normal)
      expect(g(off).hasAttribute('data-on-path')).toBe(false)
      expect(Number.parseFloat(highlighted.strokeWidth!)).toBeGreaterThan(Number.parseFloat(applied(line(off)).strokeWidth!))
      expectNoFade(off)
      cleanup()
    }
    useFocusPath.setState({ path: null })
    const cleared = draw(l('a', 'b'))
    expect(applied(line(cleared))).toEqual(normal)
    expect(g(cleared).hasAttribute('data-on-path')).toBe(false)
    expectNoFade(cleared)
  })
})

describe('every link is drawn at rest (panel-visual system L1)', () => {
  const reason = (extra: Partial<ViewLink> = {}) => ({ ...first, from: 'a', to: 'b', kind: 'reason', role: 'reason', causal: null, doubt: false, alert: false, proposed: false, ...extra }) as unknown as ViewLink
  const causal = () => ({ ...withCausal('increases'), from: 'a', to: 'b' }) as ViewLink
  it('L1a a reason link is drawn at rest on Simple and on Detailed, with nothing hovered or selected; so is its causal neighbour', () => {
    for (const level of ['simple', 'working'] as const) {
      setDefaultLevel(level)
      expect(line(draw(reason())), level).not.toBeNull(); cleanup()
      expect(line(draw(causal())), level).not.toBeNull(); cleanup()
    }
  })
  it('L1b a reason link is DOTTED by its own class, never dashed: a dash still means doubt (a doubted reason link keeps the doubt dash); an effect and a role line are not dotted', () => {
    const plain = draw(reason())
    expect([g(plain).getAttribute('data-link-dotted'), line(plain).getAttribute('class')?.includes('ok-link-dotted'), applied(line(plain)).strokeDasharray]).toEqual(['true', true, DOTS])
    expect(DOTS, 'dots are not the doubt dash').not.toBe(DOUBT_DASH)
    cleanup()
    expect(applied(line(draw(reason({ doubt: true })))).strokeDasharray, 'doubt is the dash').toBe(DOUBT_DASH)
    cleanup()
    for (const l of [causal(), { ...first, causal: null, role: 'input', kind: 'relation', doubt: false, alert: false, proposed: false } as unknown as ViewLink]) {
      expect(g(draw(l)).hasAttribute('data-link-dotted'), 'CONTRAST: only a reason line is dotted').toBe(false); cleanup()
    }
  })
  it('L1c a reason link core marks challenged or proposed is drawn at rest as before; a link no one hovers is no longer folded away', () => {
    const alerted = draw(reason({ alert: true }))
    expect(line(alerted)).toHaveClass('ok-link-dotted', 'ok-link-reason-alert')
    expect(g(alerted)).toHaveAttribute('data-link-reason-alert', '')
    expect(g(alerted)).not.toHaveAttribute('data-link-halo')
    expect(alerted.querySelector('[data-link-halo-path="alert"]')).toBeNull()
    expect(applied(line(alerted)).stroke).toBe('var(--olumi-mark-orange)')
    cleanup()
    expect(line(draw(reason({ proposed: true })))).not.toBeNull(); cleanup()
    useViewHover.setState({ id: 'z' })
    expect(line(draw(reason()))).not.toBeNull()
  })
})

describe('the midpoint mark (panel-visual system L2)', () => {
  // `title: ''`: these rows are about the words core's typed belief and effect carry; a link's own title is the title-only rows' (below).
  const dir = (direction: string, extra: Partial<ViewLink> = {}) => ({ ...withCausal('increases'), title: '', direction, effect: null, ...extra }) as unknown as ViewLink
  // A typed `none` with core's direction field null: not a belief with a direction, but a typed "no effect" (its own mark).
  const none = () => ({ ...withCausal('none'), title: '', direction: null, effect: null }) as unknown as ViewLink
  const markOf = () => document.body.querySelector('[data-view-link-mark="links.0"]')
  it('L2a each typed direction draws its own small icon at rest: raises, lowers, depends, disputed, unknown and a typed `none` are six different icons', () => {
    setDefaultLevel('simple')
    const classes: Record<string, string | null> = {}
    for (const [name, l] of [['raises', dir('raises')], ['lowers', dir('lowers')], ['depends', dir('depends')], ['disputed', dir('disputed')], ['unknown', dir('unknown')], ['none', none()]] as const) {
      draw(l)
      const m = markOf()!
      expect(m, name).not.toBeNull()
      expect([m.getAttribute('data-link-direction'), m.querySelector('svg') !== null], name).toEqual([name, true])
      classes[name] = m.querySelector('svg')!.getAttribute('class')
      cleanup()
    }
    expect(new Set(Object.values(classes)).size, 'six directions, six icons').toBe(6)
  })
  it('L2b the link is named by core\'s words (title, causal.text, author title), and its Tip says them with the effect\'s text and title once each; a mark core gave no words for says its registry entry\'s words, written nowhere in the edge', () => {
    vi.useFakeTimers()
    const l = dir('raises', { effect: { text: 'a lot', title: 'About a lot more per week' }, title: 'Core\'s link title' } as Partial<ViewLink>); l.causal!.text = 'More A raises B'
    const c = draw(l)
    expect(g(c).getAttribute('aria-label')).toBe('More A raises B\nCore\'s link title')
    fireEvent.pointerEnter(g(c)); act(() => { vi.advanceTimersByTime(TIP_DELAY) })
    expect(screen.getByRole('tooltip').textContent, 'core\'s words, deduplicated, in order').toBe('More A raises B\nCore\'s link title\na lot\nAbout a lot more per week')
    cleanup()
    const lower = draw(dir('lowers'))
    fireEvent.pointerEnter(g(lower)); act(() => { vi.advanceTimersByTime(TIP_DELAY) })
    expect([g(lower).getAttribute('aria-label'), screen.getByRole('tooltip').textContent]).toEqual([ICONS['link-lowers'].hover, ICONS['link-lowers'].hover])
    cleanup()
    const n = draw(none())
    expect(g(n).getAttribute('aria-label')).toBe(ICONS['link-none'].hover)
  })
  it('L2d direction ids live in the registry under `/* links ids */` and the edge draws them through OkIcon: no icon map of its own, six ids, six Lucide glyphs', () => {
    const ids = ['link-raises', 'link-lowers', 'link-depends', 'link-disputed', 'link-unknown', 'link-none'] as const
    expect(new Set(ids.map((id) => ICONS[id].Icon)).size).toBe(6)
    const edge = readFileSync(path.resolve('src/canvas/edges/ViewLinkEdge.tsx'), 'utf8'), registry = readFileSync(path.resolve('src/olumiView/look/icons.tsx'), 'utf8')
    expect(edge).not.toMatch(/from 'lucide-react'/)
    expect(registry.indexOf('/* links ids */')).toBeGreaterThan(registry.indexOf("'chrome-kebab-sections'"))
    for (const id of ids) expect(registry.indexOf(`'${id}'`), id).toBeGreaterThan(registry.indexOf('/* links ids */'))
  })
  it('L2e the mark stays at rest on Detailed overview (zoomed out) at both levels (the crowded placement is linkWordsPlace.spec); only the longer words disclose progressively', () => {
    const cards = [{ id: first.from, x: -10, y: -10 }, { id: first.to, x: 60, y: 60 }]
    for (const level of ['simple', 'working'] as const) {
      setDefaultLevel(level)
      draw(dir('raises', { effect: { text: 'a lot', title: 'About a lot' } } as Partial<ViewLink>), cards)
      act(() => { flow!.setState({ transform: [0, 0, 0.2] }) }) // the first open's whole board: below the readable zoom
      expect(markOf(), level).not.toBeNull()
      expect(isHidden(document.body.querySelector('[data-view-link-words="links.0"]')!), `${level}: not hidden at rest`).toBe(false)
      expect(document.body.querySelector('[data-view="links.0.effect.text"]'), `${level}: the effect words wait for nearness`).toBeNull()
      cleanup()
    }
  })
})

describe('the hover is the shared Tip (panel-visual rule 4): one lifecycle for the pointer and for focus', () => {
  const dir = (extra: Partial<ViewLink> = {}) => ({ ...withCausal('increases'), title: '', direction: 'raises', effect: { text: 'a lot', title: 'About a lot more per week' }, ...extra }) as unknown as ViewLink
  const WORDS = 'More A raises B\na lot\nAbout a lot more per week'
  const withText = () => { const l = dir(); l.causal!.text = 'More A raises B'; return l }
  const tips = () => screen.queryAllByRole('tooltip')
  const focusEdge = (c: HTMLElement) => act(() => {
    c.querySelector<HTMLElement>('.react-flow__edge')!.focus()
    useViewFocusLink.setState({ id: 'e' })
  })
  it('the pointer on the line opens the Tip after exactly 150 ms with core\'s words, and leaving closes it at once; no native title is written anywhere on the link', () => {
    vi.useFakeTimers()
    const c = draw(withText())
    expect(TIP_DELAY).toBe(150)
    fireEvent.pointerEnter(g(c))
    act(() => { vi.advanceTimersByTime(TIP_DELAY - 1) })
    expect(tips(), 'not yet at 149 ms').toHaveLength(0)
    act(() => { vi.advanceTimersByTime(1) })
    expect(screen.getByRole('tooltip').textContent).toBe(WORDS)
    expect(g(c).getAttribute('aria-describedby'), 'the link is described by the open Tip').toBe(screen.getByRole('tooltip').id)
    fireEvent.pointerLeave(g(c))
    expect(tips()).toHaveLength(0)
    expect(g(c).hasAttribute('aria-describedby')).toBe(false)
    expect(document.body.querySelectorAll('[title]'), 'no native title on the edge or its words').toHaveLength(0)
    expect(document.body.querySelector('g[data-view-link] title'), 'no SVG <title> either').toBeNull()
  })
  it('a link Tip stays inside the canvas and clear of the dock and card', () => {
    vi.useFakeTimers()
    const restorePlaceHost = installPlaceHost(lanePlaceHost)
    const spy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.matches('aside[aria-label="Outputs dock"]')) return new DOMRect(650, 0, 350, 800)
      if (this.matches('[data-view-link-mark]')) return new DOMRect(630, 200, 12, 12)
      if (this.matches('.react-flow__node')) return new DOMRect(500, 150, 125, 70)
      if (this.matches('[data-testid="lane-tip"]')) return new DOMRect(0, 0, 100, 40)
      return new DOMRect()
    })
    try {
      const link = withText()
      const { container } = render(<>
        <aside aria-label="Outputs dock" />
        <div className="react-flow">
          <div className="react-flow__node" />
          <ReactFlowProvider><EdgeLabelLayer><svg>
            <Edge id="e" source={link.from} target={link.to} sourceX={0} sourceY={0} targetX={100} targetY={100}
              sourcePosition={Position.Bottom} targetPosition={Position.Top} data={{ link, i: 0 }} />
          </svg></EdgeLabelLayer></ReactFlowProvider>
        </div>
      </>)
      fireEvent.pointerEnter(g(container))
      act(() => { vi.advanceTimersByTime(TIP_DELAY) })
      const { style } = screen.getByRole('tooltip')
      expect([style.getPropertyValue('--tip-x'), style.getPropertyValue('--tip-y')]).toEqual(['542px', '220px'])
    } finally {
      restorePlaceHost()
      spy.mockRestore()
    }
  })

  it('a link with only a core title (no mark, no effect) says that title in the Tip; so do an input, a measures and a size line, whose titles had no hover once the native title went', () => {
    vi.useFakeTimers()
    const only = (extra: object) => ({ ...first, doubt: false, alert: false, proposed: false, causal: null, kind: 'plain', label: '', effect: null, title: 'What core says of this link', ...extra }) as unknown as ViewLink
    for (const l of [only({ role: null }), only({ role: 'input' }), only({ role: 'measures' }), only({ role: 'size' })]) {
      const c = draw(l)
      fireEvent.pointerEnter(g(c)); act(() => { vi.advanceTimersByTime(TIP_DELAY) })
      expect([screen.getByRole('tooltip').textContent, g(c).getAttribute('aria-label')], String((l as { role: unknown }).role)).toEqual(['What core says of this link', 'What core says of this link'])
      cleanup()
    }
    // CONTRAST: a link core sent no words for, and no mark for, opens nothing.
    const c = draw(only({ role: null, title: '' }))
    fireEvent.pointerEnter(g(c)); act(() => { vi.advanceTimersByTime(TIP_DELAY) })
    expect(tips()).toHaveLength(0)
  })
  it('Escape closes the Tip whichever way it opened', () => {
    vi.useFakeTimers()
    const c = draw(withText())
    fireEvent.pointerEnter(g(c)); act(() => { vi.advanceTimersByTime(TIP_DELAY) })
    expect(tips()).toHaveLength(1)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(tips()).toHaveLength(0)
    cleanup()
    focusEdge(draw(withText()))
    act(() => { vi.advanceTimersByTime(TIP_DELAY) })
    expect(tips()).toHaveLength(1)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(tips(), 'a focused link\'s Tip too').toHaveLength(0)
  })
  it('the pointer and focus on one link are ONE Tip, not two; it stays while either holds and closes when both are gone', () => {
    vi.useFakeTimers()
    const c = draw(withText())
    focusEdge(c)
    fireEvent.pointerEnter(g(c)); act(() => { vi.advanceTimersByTime(TIP_DELAY) })
    expect(tips()).toHaveLength(1)
    fireEvent.pointerLeave(g(c))
    expect(tips(), 'focus still holds it').toHaveLength(1)
    act(() => { useViewFocusLink.setState({ id: null }) })
    expect(tips(), 'closes with the focus').toHaveLength(0)
  })
  it('a link with keyboard focus opens the same Tip after the same 150 ms, anchored to the mark, and the Tip follows the mark when the board is panned or zoomed', () => {
    vi.useFakeTimers()
    let at = { left: 100, top: 50, width: 12, height: 12 }
    const spy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const r = this.hasAttribute('data-view-link-mark') ? at : { left: 0, top: 0, width: 0, height: 0 }
      return { ...r, right: r.left + r.width, bottom: r.top + r.height, x: r.left, y: r.top, toJSON: () => ({}) } as DOMRect
    })
    focusEdge(draw(dir()))
    expect(tips(), 'focus alone is not instant').toHaveLength(0)
    act(() => { vi.advanceTimersByTime(TIP_DELAY) })
    expect(screen.getByRole('tooltip').style.getPropertyValue('--tip-x')).toBe(`${100 + 12 + 8}px`)
    // The board is panned: the Tip keeps its first measure, so it closes as a scroll closes it, and the focused link opens it again where the mark now is.
    at = { left: 300, top: 220, width: 12, height: 12 }
    act(() => { flow!.setState({ transform: [40, 30, 1.5] }) })
    expect(tips(), 'closed by the pan').toHaveLength(0)
    act(() => { vi.advanceTimersByTime(TIP_DELAY) })
    expect([screen.getByRole('tooltip').style.getPropertyValue('--tip-x'), screen.getByRole('tooltip').style.getPropertyValue('--tip-y')]).toEqual([`${300 + 12 + 8}px`, '220px'])
    act(() => { useViewFocusLink.setState({ id: null }) })
    expect(tips(), 'closes with the focus').toHaveLength(0)
    spy.mockRestore()
  })
  it('under focus the Tip\'s id joins the focus target\'s (React Flow\'s edge wrapper) description, and the words id alone returns on Escape', () => {
    vi.useFakeTimers()
    const link = dir()
    const c = render(
      <ReactFlowProvider><Grab /><EdgeLabelLayer><svg>
        <g className="react-flow__edge" aria-describedby="words-0" tabIndex={0}>
          <Edge id="e" source={link.from} target={link.to} sourceX={0} sourceY={0} targetX={100} targetY={100}
            sourcePosition={Position.Bottom} targetPosition={Position.Top} data={{ link, i: 0 }} />
        </g>
      </svg></EdgeLabelLayer></ReactFlowProvider>,
    ).container
    const wrapper = c.querySelector('g.react-flow__edge') as SVGGElement
    // Real keyboard focus on the wrapper: the Tip opens only on a focus ring (`:focus-visible`), which a store write alone does not give it.
    act(() => { wrapper.focus() })
    act(() => { useViewFocusLink.setState({ id: 'e' }) })
    act(() => { vi.advanceTimersByTime(TIP_DELAY) })
    const id = screen.getByRole('tooltip').id
    expect(wrapper.getAttribute('aria-describedby')).toBe(`words-0 ${id}`)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(tips()).toHaveLength(0)
    expect(wrapper.getAttribute('aria-describedby'), 'back to the words id').toBe('words-0')
  })
  it('a pan while the pointer rests on the link closes its Tip too (the pointer\'s Tip is no longer left detached)', () => {
    vi.useFakeTimers()
    const c = draw(withText())
    fireEvent.pointerEnter(g(c)); act(() => { vi.advanceTimersByTime(TIP_DELAY) })
    expect(tips()).toHaveLength(1)
    act(() => { flow!.setState({ transform: [10, 10, 1] }) })
    expect(tips()).toHaveLength(0)
  })
})

describe('the mark\'s remaining rows', () => {
  const markOf = () => document.body.querySelector('[data-view-link-mark="links.0"]')
  it('L2c a link that is not an effect (a role line, a reason link, a size wire) has no midpoint mark', () => {
    for (const l of [{ ...first, causal: null, role: 'input', kind: 'relation' }, { ...first, causal: null, role: 'reason', kind: 'reason' }] as unknown as ViewLink[]) { draw(l); expect(markOf()).toBeNull(); cleanup() }
  })
})

describe('width stays uniform (panel-visual system L3)', () => {
  it('L3 core reserves `causal.strength.share` as null, so every effect is the thinnest rung whatever its low / likely / high say; no strength is implied', () => {
    for (const [low, likely, high] of [[1, 2, 3], [100, 900, 1500], [null, null, null]] as const) {
      const l = withCausal('increases'); l.causal = { ...l.causal!, strength: { state: 'sized', figure: null, low, likely, high, share: null } as never }
      expect(applied(line(draw(l))).strokeWidth).toBe(px(PLAIN_WIDTH)); cleanup()
    }
  })
})

describe('modifier channels (panel-visual system L4)', () => {
  const both = (extra: Partial<ViewLink>) => withCausal('decreases', extra)
  it('L4a alert is an orange halo under a directional line: the line keeps its direction colour (it was orange, and lost its direction)', () => {
    const c = draw(both({ alert: true }))
    expect(applied(line(c)).stroke).toBe(EFFECT_STROKES.decreases)
    expect(c.querySelector('[data-link-halo-path="alert"]')?.getAttribute('class')).toContain('ok-link-halo-alert')
    expect(g(c).getAttribute('data-link-halo')).toBe('alert')
  })
  it('L4b proposal is a blue halo under a directional line in an approved model, the direction colour kept; on a first draft it marks nothing (R3)', () => {
    useViewStore.setState({ view: { ...view, proposal: null, version: { id: 'v1', n: 1 } } as unknown as View })
    useFocusPath.setState({ path: new Set([first.from, first.to]) })
    const c = draw(both({ proposed: true }))
    const lit = applied(line(c))
    const proposalHalo = c.querySelector('[data-link-halo-path="proposed"]')!
    expect([lit.stroke, lit.strokeWidth, g(c).getAttribute('data-link-halo')]).toEqual([EFFECT_STROKES.decreases, px(PLAIN_WIDTH + 1), 'proposed'])
    expect(applied(proposalHalo)).toMatchObject({ stroke: 'var(--semantic-info)', strokeWidth: '5px', opacity: '0.35' })
    expect(applied(proposalHalo).strokeDasharray).toBe(lit.strokeDasharray)
    expect(proposalHalo.getAttribute('d')).toBe(line(c).getAttribute('d'))
    expect(proposalHalo.nextElementSibling).toBe(line(c))
    expect(line(c)).toHaveAttribute('marker-end', 'url(#view-link-arrow-0)')
    cleanup()
    useViewStore.setState({ view: { ...view, proposal: { id: 'p1' }, version: null } as unknown as View })
    expect(g(draw(both({ proposed: true }))).hasAttribute('data-link-halo')).toBe(false)
  })
  it('L4c the four channels coexist on one line: direction colour, doubt dash, alert halo and proposal halo', () => {
    useViewStore.setState({ view: { ...view, proposal: null, version: { id: 'v1', n: 1 } } as unknown as View })
    useFocusPath.setState({ path: new Set([first.from, first.to]) })
    const c = draw(both({ doubt: true, alert: true, proposed: true }))
    const lit = applied(line(c))
    expect(lit).toMatchObject({ stroke: EFFECT_STROKES.decreases, strokeWidth: '3px', strokeDasharray: DOUBT_DASH, strokeLinecap: 'butt' })
    expect(g(c)).toHaveAttribute('data-link-halo', 'alert proposed')
    const proposalHalo = c.querySelector('[data-link-halo-path="proposed"]')!
    const alertHalo = c.querySelector('[data-link-halo-path="alert"]')!
    expect(proposalHalo).toHaveClass('ok-link-halo-inner')
    expect(applied(proposalHalo)).toMatchObject({ stroke: 'var(--semantic-info)', strokeWidth: '5px', opacity: '0.35', strokeDasharray: DOUBT_DASH, strokeLinecap: 'butt' })
    expect(applied(alertHalo)).toMatchObject({ stroke: 'var(--olumi-mark-orange)', strokeWidth: '10px' })
    expect(applied(alertHalo).strokeDasharray).toBeUndefined()
    expect(alertHalo.nextElementSibling).toBe(proposalHalo)
    expect(proposalHalo.nextElementSibling).toBe(line(c))
  })
  it('L4d a neutral relation keeps both halos, and an alert reason line keeps its proposal halo', () => {
    useViewStore.setState({ view: { ...view, proposal: null, version: { id: 'v1', n: 1 } } as unknown as View })
    const plain = (extra: object) => ({ ...first, causal: null, role: null, kind: 'relation', doubt: false, alert: false, proposed: false, ...extra }) as unknown as ViewLink
    const relation = draw(plain({ alert: true, proposed: true }))
    expect([applied(line(relation)).stroke, g(relation).getAttribute('data-link-halo')]).toEqual([EDGE_NEUTRAL, 'alert proposed'])
    expect(relation.querySelector('[data-link-halo-path="alert"]')).toHaveClass('ok-link-halo-alert')
    const innerHalo = relation.querySelector('[data-link-halo-path="proposed"]')!
    expect(innerHalo).toHaveClass('ok-link-halo-inner')
    expect(applied(innerHalo).strokeWidth).toBe('3px')
    cleanup()
    const reason = draw(plain({ alert: true, proposed: true, kind: 'reason', role: 'reason' }))
    expect(g(reason)).toHaveAttribute('data-link-halo', 'proposed')
    expect(reason.querySelector('[data-link-halo-path="alert"]')).toBeNull()
    const proposalHalo = reason.querySelector('[data-link-halo-path="proposed"]')!
    expect(proposalHalo).toHaveClass('ok-link-halo-proposed')
    expect(proposalHalo).not.toHaveClass('ok-link-halo-inner')
    expect(applied(proposalHalo)).toMatchObject({ strokeWidth: '3px', strokeDasharray: DOTS, strokeLinecap: 'round' })
    expect(applied(proposalHalo).strokeDasharray).toBe(applied(line(reason)).strokeDasharray)
    cleanup()
    const doubtedReason = draw(plain({ proposed: true, doubt: true, kind: 'reason', role: 'reason' }))
    expect(applied(doubtedReason.querySelector('[data-link-halo-path="proposed"]')!)).toMatchObject({ strokeDasharray: DOUBT_DASH, strokeLinecap: 'butt' })
    cleanup()
    // One channel alone is still one halo; a first draft still marks no proposal (R3).
    const a = draw(plain({ alert: true })); expect(g(a).getAttribute('data-link-halo')).toBe('alert'); cleanup()
    useViewStore.setState({ view: { ...view, proposal: { id: 'p1' }, version: null } as unknown as View })
    expect(g(draw(plain({ alert: true, proposed: true }))).getAttribute('data-link-halo')).toBe('alert')
  })
})

describe('presentation is token CSS (panel-visual system, no styles in components)', () => {
  const css = readFileSync(path.resolve('src/olumiView/look/olumiLook.css'), 'utf8')
  it.each(['increases', 'decreases'] as const)('keyboard focus keeps the %s tone when React Flow CSS loads last', (sign) => {
    const flowCss = readFileSync(createRequire(import.meta.url).resolve('@xyflow/react/dist/style.css'), 'utf8')
    useViewStore.setState({ view: { ...view, proposal: null, version: { id: 'v1', n: 1 } } as unknown as View })
    const c = draw(withCausal(sign, { proposed: true }))
    const edge = line(c)
    const wrapper = c.querySelector<HTMLElement>('.react-flow__edge')!
    wrapper.classList.add('selectable')
    expect(applied(edge, flowCss)).toMatchObject({ stroke: EFFECT_STROKES[sign], strokeWidth: '2px' })
    act(() => wrapper.focus())
    expect(wrapper.matches(':focus-visible')).toBe(true)
    expect(applied(edge, flowCss)).toMatchObject({ stroke: EFFECT_STROKES[sign], strokeWidth: '3px' })
    expect(applied(c.querySelector('.ok-link-end')!, flowCss).fill).toBe(EFFECT_STROKES[sign])
    expect(applied(c.querySelector('.ok-link-halo-proposed')!, flowCss).strokeWidth).toBe('5px')
    edge.classList.remove('ok-link-line')
    expect(applied(edge, flowCss).stroke).toContain('--xy-edge-stroke-selected')
  })
  it.each([
    { from: 'group:inputs', to: 'aim', mixedDirection: false },
    { from: 'factor', to: 'aim', mixedDirection: false },
    { from: 'group:inputs', to: 'aim', mixedDirection: true },
  ])('draws a folded connector from $from to $to (mixed direction: $mixedDirection)', ({ from, to, mixedDirection }) => {
    const c = render(<ReactFlowProvider><EdgeLabelLayer><svg><GroupLinkEdge id="group-edge" source={from} target={to}
      sourceX={0} sourceY={0} targetX={100} targetY={100} sourcePosition={Position.Bottom} targetPosition={Position.Top}
      data={{ from, to, count: 2, ...(mixedDirection ? { mixedDirection: true } : {}) }}
      selected={false} animated={false} type="groupLink" />
    </svg></EdgeLabelLayer></ReactFlowProvider>).container
    const edge = line(c)
    expect(edge).toHaveClass('ok-link-line')
    expect(edge.closest('.ok-link-tone-neutral')).toBeInTheDocument()
    expect(applied(edge)).toMatchObject({ stroke: EDGE_NEUTRAL, strokeWidth: px(PLAIN_WIDTH), vectorEffect: 'non-scaling-stroke' })
    for (const attr of ['style', 'stroke', 'stroke-width', 'marker-start']) expect(edge).not.toHaveAttribute(attr)
    if (mixedDirection) {
      expect(edge).not.toHaveAttribute('marker-end')
      expect(c.querySelector('marker')).toBeNull()
    } else {
      const marker = c.querySelector('marker')!
      expect(edge).toHaveAttribute('marker-end', `url(#${marker.id})`)
      expect(applied(marker.querySelector('path.ok-link-end')!).fill).toBe(EDGE_NEUTRAL)
    }
  })
  it('limits edge stroke widths to the shared line width and the registered states', () => {
    const sheet = css.replace(/\/\*[\s\S]*?\*\//g, '')
    const widths = [...sheet.matchAll(/([^{}]+)\{[^{}]*?\bstroke-width:\s*([^;}]+)[^{}]*\}/g)]
      .map(([, selector, width]) => [selector!.trim(), width!.trim()])
      .filter(([selector]) => selector !== '.olumi-look .ok-link-size-label') // SVG text outline
    const path = '.olumi-look .react-flow__edge .react-flow__edge-path.ok-link-line'
    expect(widths).toEqual([
      [`.ok-key-sample .ok-link-line,\n.olumi-look .react-flow__edge:focus .react-flow__edge-path.ok-link-line,\n${path}`, px(PLAIN_WIDTH)],
      ['.olumi-look .ok-link-leader', px(PLAIN_WIDTH)],
      [`.olumi-look .react-flow__edge:focus-visible .react-flow__edge-path.ok-link-line,\n${path}.ok-link-on-path`, '3px'],
      ['.ok-link-halo-alert', '10px'],
      ['.ok-link-halo-proposed', '3px'],
      ['.olumi-look .react-flow__edge:focus-visible .ok-link-halo-proposed,\n.ok-link-halo-proposed.ok-link-on-path', '5px'],
    ])
  })
  it('the tone classes declare the tokens the lane\'s ink table names, and every drawn line takes its stroke from its tone class (no inline stroke)', () => {
    for (const [tone, token] of Object.entries(TONE_TOKEN)) expect(declared(`ok-link-tone-${tone}`)['--link-tone'], tone).toBe(token)
    expect(toneOf(EFFECT_STROKES.increases)).toBe('positive')
    const c = draw(withCausal('decreases'))
    expect([g(c).getAttribute('data-link-tone'), g(c).classList.contains('ok-link-tone-negative'), line(c).getAttribute('style')]).toEqual(['negative', true, null])
  })
  it('the width, the dash, the dots and the screen-px rule are declared by the stylesheet\'s classes the line carries; the doubt dash outranks the dots', () => {
    expect(declared('ok-link-doubt', 'react-flow__edge-path')['stroke-dasharray']).toBe(DOUBT_DASH)
    expect(declared('ok-link-dotted', 'react-flow__edge-path')['stroke-dasharray']).toBe(DOTS)
    expect(css, 'four classes deep, so React Flow\'s selected stroke never wins').toMatch(/\.react-flow__edge \.react-flow__edge-path\.ok-link-line \{/)
    const c = draw(withCausal('increases', { doubt: true }))
    expect(applied(line(c))).toMatchObject({ strokeWidth: px(PLAIN_WIDTH), vectorEffect: 'non-scaling-stroke' })
    expect(line(c).getAttribute('class')).toContain('ok-link-doubt')
    expect(line(c).hasAttribute('style'), 'the line carries no inline style').toBe(false)
    cleanup()
    const reasonDoubt = draw({ ...first, kind: 'reason', role: 'reason', causal: null, doubt: true, alert: false, proposed: false } as unknown as ViewLink)
    expect(applied(line(reasonDoubt)).strokeDasharray, 'a doubted reason link is dashed, not dotted').toBe(DOUBT_DASH)
  })
  it('the halos, path emphasis and words\' box use stylesheet classes; card outline transitions respect reduced motion', () => {
    for (const sel of ['.ok-link-halo-alert', '.ok-link-halo-proposed', '.ok-link-dotted', '.ok-link-on-path', '.ok-link-words', '.ok-link-mark', '.ok-link-hit', '.ok-link-hidden', '.ok-link-leader', '.ok-link-end', '.ok-link-chip', '.ok-link-ctl']) expect(css, sel).toContain(sel)
    expect(css).toMatch(/@media \(prefers-reduced-motion: no-preference\) \{[^}]*transition: background-color 120ms ease, outline-color 120ms ease/)
    expect(declared('ok-link-halo-alert')['stroke-width']).toBe(px(PLAIN_WIDTH + 8))
    expect(declared('ok-link-halo-proposed').stroke).toBe('var(--semantic-info)')
    const c = draw(withCausal('increases', { alert: true }))
    const words = document.body.querySelector('[data-view-link-words]') as HTMLElement
    expect(words.className).toContain('ok-link-words')
    expect(Object.keys(applied(words)), 'the words\' box, ground and pointer rule are the class\'s').toEqual(expect.arrayContaining(['position', 'background', 'pointerEvents', 'zIndex', 'transform']))
    expect(c.querySelector('path.ok-link-halo')?.hasAttribute('style'), 'the halo is the class, not inline').toBe(false)
    expect(c.querySelector('path.ok-link-halo')?.hasAttribute('stroke-width'), 'nor an attribute').toBe(false)
  })
  it('where the words stand is two custom properties (as the Tip\'s --tip-x), never an inline transform, z-index or visibility; hidden is a class', () => {
    draw(withCausal('increases'))
    const words = document.body.querySelector('[data-view-link-words]') as HTMLElement
    const at = standsAt(words)
    expect([Number.isFinite(at.x), Number.isFinite(at.y)]).toEqual([true, true])
    expect(words.getAttribute('style') ?? '').not.toMatch(/transform|z-index|visibility|position/)
    expect(declared('ok-link-words')['z-index']).toBe(String(GOAL_CHANCE_DRIVER_TAG_Z))
  })
  it('no component or its edge writes an inline style or a native title: the files hold none', () => {
    for (const f of ['src/canvas/edges/ViewLinkEdge.tsx', 'src/olumiView/v12/links/LinkEnds.tsx', 'src/olumiView/LinkMarkChip.tsx', 'src/olumiView/v12/links/place.ts', 'src/olumiView/v12/links/styles.ts']) {
      const src = readFileSync(path.resolve(f), 'utf8').split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n')
      expect(src, f).not.toMatch(/\s(style|title)=/)
    }
  })
})
