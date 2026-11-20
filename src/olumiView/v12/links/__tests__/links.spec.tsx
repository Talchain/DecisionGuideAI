/** V12 links (rule 2): drawn exactly as the View holds them. Fixture: the bakery View from the wire (no private data). */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Position, ReactFlowProvider, useStoreApi } from '@xyflow/react'
import type { View, ViewLink } from '../../../client'
import { useViewStore } from '../../../store'
import { useViewFocusLink, useViewHover } from '../../../canvas'
import { ViewLinkEdge } from '../../../../canvas/edges/ViewLinkEdge'
import { EdgeLabelLayer } from '../../../__tests__/edgeLabelLayer'
import { DIRECTION_NOT_SETTLED, DOUBT_DASH, EDGE_NEUTRAL, EFFECT_STROKES, GOLD, INK, INPUT_GREY, LINK_STYLES, PLAIN_WIDTH, linkStyle } from '../styles'
import { effectMidpoint } from '../geometry'
import { setDefaultLevel, useSimpleLevel } from '../../simpleStore'
import { LINK_OFF_PATH_OPACITY as EDGE_OFF_PATH_OPACITY, useFocusPath } from '../../bands/focusPath'
import { TIP_DELAY } from '../../../look/Tip'
import { ICONS } from '../../../look/icons'

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
      expect(line(c).style.stroke).toBe(want[sign])
      expect(line(c).style.stroke).not.toBe(INK)
      expect(g(c).getAttribute('data-link-end')).toBe('arrow')
      expect(line(c).getAttribute('marker-end')).toMatch(/^url\(#/)
      expect(c.querySelector('[data-view-link-sign]')).toBeNull()
      cleanup()
    }
  })
  it('an unsettled direction is the neutral colour, and a decreasing link is never drawn in ink (fails if the polarity colour is lost)', () => {
    expect(line(draw(withCausal('unknown'))).style.stroke).toBe('var(--edge-neutral)')
    cleanup()
    const neg = line(draw(withCausal('decreases'))).style.stroke
    expect(neg).toBe('var(--edge-negative)'); expect(neg).not.toBe(INK)
  })
  it('L3 strength is never a width: every effect is the one 2 px rung whatever share or raw figures it carries, the line stays screen px, and a `reason` link carrying a share is 2 px too', () => {
    const shared = (share: number | null, extra: Partial<ViewLink> = {}) => { const l = withCausal('increases', extra); l.causal = { ...l.causal!, strength: { ...l.causal!.strength, share } as never }; return l }
    // The old ladder (0.25 is 3, 0.8 is 5) is gone: a share, large or small, or none, draws the same line.
    expect([0.25, 0.8, 0.1, 5, -0.5, null].map((x) => { const c = draw(shared(x)); const w = line(c).style.strokeWidth; cleanup(); return w })).toEqual(Array(6).fill(String(PLAIN_WIDTH)))
    expect(PLAIN_WIDTH).toBe(2)
    // Screen px: the line does not thin as the camera zooms out.
    const c = draw(shared(0.5))
    expect(line(c).style.vectorEffect).toBe('non-scaling-stroke')
    expect(g(c).getAttribute('data-link-width')).toBe('2')
    cleanup()
    const plain = { ...shared(0.8), causal: null, role: null, kind: 'reason' } as unknown as ViewLink
    expect(line(draw(plain)).style.strokeWidth).toBe('2')
  })
  it('is dashed only when doubted (not when unsized or proposed)', () => {
    expect(line(draw(withCausal('increases', { doubt: true }))).style.strokeDasharray).not.toBe('')
    cleanup()
    const c = draw(withCausal('increases', { proposed: true }))
    expect(line(c).style.strokeDasharray).toBe('')
  })
  it('a link Olumi proposed carries Olumi\'s mark on the line, not a dash', () => {
    const l = withCausal('increases'); l.causal!.author = { by: 'olumi', text: '', title: 'Olumi proposed this' }
    const c = draw(l)
    expect(c.querySelector('[data-view-link-olumi-mark="links.0"]')).not.toBeNull()
    expect(line(c).style.strokeDasharray).toBe('')
    cleanup()
    expect(draw(withCausal('increases')).querySelector('[data-view-link-olumi-mark]')).toBeNull()
  })
  // CHANGED BY DESIGN (the lead's D4, 17 Nov: depends, disputed and unknown are no-verdict grey, each with its own small icon): the bare "?" text glyph
  // is a Lucide icon now (no text glyph as an icon); the words are unchanged.
  it('an unsettled direction gets its own small icon (no "?" text) with the fixed words, or core\'s when it sends them; core\'s `depends` gets a different one', () => {
    const l = withCausal('unknown'); l.causal!.text = ''
    const c = draw(l)
    const mark = document.body.querySelector('[data-view-link-unsettled="links.0"]')!
    expect([mark.textContent, mark.querySelector('svg') !== null, mark.getAttribute('data-link-direction')]).toEqual(['', true, 'unknown'])
    expect(document.body.querySelector('[data-view-link-unsettled] [role="img"]')?.getAttribute('aria-label')).toBe(DIRECTION_NOT_SETTLED)
    const icon = mark.querySelector('svg')!.getAttribute('class')
    cleanup()
    // core's own direction (fields.ts linkLook): `depends` draws its own icon, not the unknown one, on the neutral line.
    const d = { ...withCausal('unknown'), direction: 'depends' } as unknown as ViewLink
    const dc = draw(d)
    const dm = document.body.querySelector('[data-view-link-unsettled="links.0"]')!
    expect([dm.getAttribute('data-link-direction'), dm.querySelector('svg')!.getAttribute('class') !== icon, line(dc).style.stroke]).toEqual(['depends', true, EDGE_NEUTRAL])
    cleanup(); void c
    const m = withCausal('unknown'); m.causal!.text = 'Which way this moves is not settled'
    draw(m)
    expect(document.body.querySelector('[data-view-link-unsettled] [role="img"]')?.getAttribute('aria-label')).toBe('Which way this moves is not settled')
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
    expect(line(draw(plain())).style.stroke, 'an approved model keeps the mark').toBe('var(--semantic-info)'); cleanup()
    // The defect's own case (Line reviewer, edbd5fda F1): a REASON line Olumi proposed keeps Olumi's ink; one nobody proposed stays neutral.
    expect(line(draw(plain({ kind: 'reason', role: 'reason' }))).style.stroke, 'a proposed reason line is Olumi\'s too').toBe('var(--semantic-info)'); cleanup()
    useViewHover.setState({ id: first.from })
    expect(line(draw(plain({ kind: 'reason', role: 'reason', proposed: false }))).style.stroke, 'CONTRAST: an unproposed reason line').toBe(EDGE_NEUTRAL); cleanup()
    withView({ proposal: { id: 'p1' }, version: null })
    expect(line(draw(plain())).style.stroke, 'a first draft marks nothing').toBe(EDGE_NEUTRAL); cleanup()
    expect(line(draw(plain({ doubt: true }))).style.strokeDasharray, 'CONTRAST: a doubted link is dashed on a first draft').toBe(DOUBT_DASH)
  })
})

describe('link roles', () => {
  // R5: only a link with a typed `causal` is an effect; a role line carries no `causal` here.
  const role = (r: string, extra: object = {}) => ({ ...first, doubt: false, alert: false, proposed: false, causal: null, role: r, ...extra }) as unknown as ViewLink
  it('input: neutral, 2 px and solid, a filled dot at the end, no arrowhead', () => {
    const c = draw(role('input'))
    expect(line(c).style.stroke).toBe(INPUT_GREY)
    expect(line(c).style.strokeDasharray).toBe('')
    expect(line(c).style.strokeWidth).toBe('2')
    expect(g(c).getAttribute('data-link-end')).toBe('dot')
    expect(c.querySelector('marker circle')).not.toBeNull()
    expect(c.querySelector('marker path')).toBeNull()
  })
  it('measures: the DS goal colour, no polarity, no arrowhead (R5 exception, ruled by the lead: the goal\'s gold is the aim\'s own colour, not an effect\'s direction colour; width 2 px, never the ladder)', () => {
    const c = draw(role('measures'))
    expect(line(c).style.stroke).toBe(GOLD)
    expect(GOLD).toBe('var(--goal)')
    expect(line(c).getAttribute('marker-end')).toBeNull()
    expect(g(c).getAttribute('data-link-role')).toBe('measures')
  })
  it('target: a gold line, 2 px (the same R5 exception as measures)', () => { const c = draw(role('target')); expect([line(c).style.stroke, line(c).style.strokeWidth]).toEqual([GOLD, '2']) })
  it('a link with a typed `causal` is an effect whatever its role says: direction colour and arrowhead, never the role\'s dots (R5)', () => {
    const c = draw({ ...withCausal('decreases'), role: 'input' } as ViewLink)
    expect(line(c).style.stroke).toBe(EFFECT_STROKES.decreases)
    expect(line(c).style.strokeDasharray).toBe('')
    expect(g(c).getAttribute('data-link-end')).toBe('arrow')
    expect(g(c).getAttribute('data-link-role')).toBe('input')
  })
  it('reason: a plain 2 px neutral line, never coloured or weighted as an effect, never ink (R5)', () => {
    // A reason link is drawn at rest (L1), in Simple and Detailed alike, as a plain neutral line (dotted by class, never an inline dash).
    setDefaultLevel('simple')
    for (const l of [role('reason'), { ...role('reason'), role: undefined, kind: 'reason' } as unknown as ViewLink, { ...first, doubt: false, alert: false, proposed: false, causal: null, label: '' } as unknown as ViewLink]) {
      const c = draw(l)
      expect(line(c).style.stroke).toBe(EDGE_NEUTRAL)
      expect(line(c).style.stroke).not.toBe(INK)
      expect(line(c).style.strokeWidth).toBe('2')
      expect(line(c).style.strokeDasharray).toBe('')
      cleanup()
    }
  })
  it('only a doubted link is dashed, whatever kind of line it is (R5)', () => {
    expect(line(draw(role('input', { doubt: true }))).style.strokeDasharray).toBe(DOUBT_DASH)
    cleanup()
    expect(line(draw(role('reason', { doubt: true }))).style.strokeDasharray).toBe(DOUBT_DASH)
  })
  it('size: a plain wire to the midpoint of the sized effect, labelled "size"; never an arrowhead', () => {
    const l = role('size', { sizes: { from: 'a', to: 'b' } })
    const c = draw({ ...l, from: 'f', to: 't' } as ViewLink, [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 0, y: 200 }, { id: 'f', x: 300, y: 0 }, { id: 't', x: 300, y: 100 }])
    expect(line(c).style.strokeDasharray).toBe('')
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

describe('the lit path (R1, 16 Nov): links fade only while a path is lit', () => {
  const l = (from: string, to: string) => ({ ...withCausal('increases'), from, to }) as ViewLink
  it('at rest nothing fades; with a path lit, a link whose ends are not both on it fades to production\'s 0.18, one on the path does not', () => {
    const state = (c: HTMLElement) => [g(c).classList.contains('ok-link-off-path'), g(c).hasAttribute('data-off-path')]
    const rest = draw(l('a', 'b'))
    expect(state(rest)).toEqual([false, false])
    cleanup()
    useFocusPath.setState({ path: new Set(['a', 'b']) })
    expect(state(draw(l('a', 'b'))), 'on the path').toEqual([false, false])
    cleanup()
    expect(state(draw(l('a', 'z'))), 'one end off the path: the fade is the token CSS class (olumiLook.css .ok-link-off-path, 0.18), not an inline opacity').toEqual([true, true])
    expect(g(draw(l('a', 'z'))).style.opacity).toBe('')
    useFocusPath.setState({ path: null })
    cleanup()
    expect(state(draw(l('a', 'z'))), 'reset when focus clears').toEqual([false, false])
    expect(EDGE_OFF_PATH_OPACITY).toBe(0.18)
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
    expect([g(plain).getAttribute('data-link-dotted'), line(plain).getAttribute('class')?.includes('ok-link-dotted'), line(plain).style.strokeDasharray]).toEqual(['', true, ''])
    cleanup()
    expect(line(draw(reason({ doubt: true }))).style.strokeDasharray, 'doubt is the dash').toBe(DOUBT_DASH)
    cleanup()
    for (const l of [causal(), { ...first, causal: null, role: 'input', kind: 'relation', doubt: false, alert: false, proposed: false } as unknown as ViewLink]) {
      expect(g(draw(l)).hasAttribute('data-link-dotted'), 'CONTRAST: only a reason line is dotted').toBe(false); cleanup()
    }
  })
  it('L1c a reason link core marks challenged or proposed is drawn at rest as before; a link no one hovers is no longer folded away', () => {
    expect(line(draw(reason({ alert: true })))).not.toBeNull(); cleanup()
    expect(line(draw(reason({ proposed: true })))).not.toBeNull(); cleanup()
    useViewHover.setState({ id: 'z' })
    expect(line(draw(reason()))).not.toBeNull()
  })
})

describe('the midpoint mark (panel-visual system L2)', () => {
  const dir = (direction: string, extra: Partial<ViewLink> = {}) => ({ ...withCausal('increases'), direction, effect: null, ...extra }) as unknown as ViewLink
  // A typed `none` with core's direction field null: not a belief with a direction, but a typed "no effect" (its own mark).
  const none = () => ({ ...withCausal('none'), direction: null, effect: null }) as unknown as ViewLink
  const markOf = () => document.body.querySelector('[data-view-link-mark="links.0"]')
  it('L2a each typed direction draws its own small icon at rest: raises, lowers, depends, disputed, unknown and a typed `none` are six different icons', () => {
    setDefaultLevel('simple')
    const classes: Record<string, string | null> = {}
    for (const [name, l] of [['raises', dir('raises')], ['lowers', dir('lowers')], ['depends', dir('depends')], ['disputed', dir('disputed')], ['unknown', dir('unknown')], ['none', none()]] as const) {
      draw(l)
      const m = markOf()!
      expect(m, name).not.toBeNull()
      expect([m.getAttribute('data-link-direction'), m.querySelector('[role="img"]') !== null], name).toEqual([name, true])
      classes[name] = m.querySelector('svg')!.getAttribute('class')
      cleanup()
    }
    expect(new Set(Object.values(classes)).size, 'six directions, six icons').toBe(6)
  })
  const nameOf = () => markOf()!.querySelector('[role="img"]')!.getAttribute('aria-label')
  it('L2b the mark says core\'s words (causal.text, effect.text, effect.title) to assistive technology; a mark core gave no words for says its registry entry\'s words, written nowhere in the edge', () => {
    const l = dir('raises', { effect: { text: 'a lot', title: 'About a lot more per week' } } as Partial<ViewLink>); l.causal!.text = 'More A raises B'
    draw(l)
    expect(nameOf()).toBe('More A raises B\na lot\nAbout a lot more per week')
    cleanup()
    draw(dir('lowers')); expect(nameOf()).toBe(ICONS['link-lowers'].hover); cleanup()
    draw(none()); expect(nameOf()).toBe(ICONS['link-none'].hover)
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
      expect(document.body.querySelector('[data-view-link-words="links.0"]')?.getAttribute('style') ?? '', `${level}: not hidden at rest`).not.toContain('hidden')
      expect(document.body.querySelector('[data-view="links.0.effect.text"]'), `${level}: the effect words wait for nearness`).toBeNull()
      cleanup()
    }
  })
})

describe('the hover is the shared Tip (panel-visual rule 4)', () => {
  const dir = (extra: Partial<ViewLink> = {}) => ({ ...withCausal('increases'), direction: 'raises', effect: { text: 'a lot', title: 'About a lot more per week' }, ...extra }) as unknown as ViewLink
  const inner = () => document.body.querySelector('[data-view-link-mark="links.0"] [role="img"]') as HTMLElement
  it('the pointer opens the Tip after exactly 150 ms, with core\'s words, and leaving closes it at once; no native title is written on the mark or its words', () => {
    vi.useFakeTimers()
    const l = dir(); l.causal!.text = 'More A raises B'
    draw(l)
    expect(TIP_DELAY).toBe(150)
    fireEvent.pointerEnter(inner())
    act(() => { vi.advanceTimersByTime(TIP_DELAY - 1) })
    expect(screen.queryByRole('tooltip'), 'not yet at 149 ms').toBeNull()
    act(() => { vi.advanceTimersByTime(1) })
    expect(screen.getByRole('tooltip').textContent).toBe('More A raises B\na lot\nAbout a lot more per week')
    fireEvent.pointerLeave(inner())
    expect(screen.queryByRole('tooltip')).toBeNull()
    expect(document.body.querySelectorAll('[title]'), 'no native title on the edge or its words').toHaveLength(0)
    expect(document.body.querySelector('g[data-view-link] title'), 'no SVG <title> either').toBeNull()
  })
  it('a link with keyboard focus opens the same Tip after the same 150 ms, and it repositions when the board is panned or zoomed', () => {
    vi.useFakeTimers()
    let at = { left: 100, top: 50, width: 12, height: 12 }
    const spy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const r = this.hasAttribute('data-view-link-mark') ? at : { left: 0, top: 0, width: 0, height: 0 }
      return { ...r, right: r.left + r.width, bottom: r.top + r.height, x: r.left, y: r.top, toJSON: () => ({}) } as DOMRect
    })
    draw(dir())
    act(() => { useViewFocusLink.setState({ id: 'e' }) })
    expect(screen.queryByRole('tooltip'), 'focus alone is not instant').toBeNull()
    act(() => { vi.advanceTimersByTime(TIP_DELAY) })
    const tip = screen.getByRole('tooltip')
    expect(tip.style.getPropertyValue('--tip-x')).toBe(`${100 + 12 + 8}px`)
    // The board is panned: the mark is somewhere else on screen, and the Tip goes with it.
    at = { left: 300, top: 220, width: 12, height: 12 }
    act(() => { flow!.setState({ transform: [40, 30, 1.5] }) })
    expect([screen.getByRole('tooltip').style.getPropertyValue('--tip-x'), screen.getByRole('tooltip').style.getPropertyValue('--tip-y')]).toEqual([`${300 + 12 + 8}px`, '220px'])
    act(() => { useViewFocusLink.setState({ id: null }) })
    expect(screen.queryByRole('tooltip'), 'closes with the focus').toBeNull()
    spy.mockRestore()
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
      expect(line(draw(l)).style.strokeWidth).toBe(String(PLAIN_WIDTH)); cleanup()
    }
  })
})

describe('modifier channels (panel-visual system L4)', () => {
  const both = (extra: Partial<ViewLink>) => withCausal('decreases', extra)
  it('L4a alert is an orange halo under a directional line: the line keeps its direction colour (it was orange, and lost its direction)', () => {
    const c = draw(both({ alert: true }))
    expect(line(c).style.stroke).toBe(EFFECT_STROKES.decreases)
    expect(c.querySelector('[data-link-halo-path="alert"]')?.getAttribute('class')).toContain('ok-link-halo-alert')
    expect(g(c).getAttribute('data-link-halo')).toBe('alert')
  })
  it('L4b proposal is a blue halo under a directional line in an approved model, the direction colour kept; on a first draft it marks nothing (R3)', () => {
    useViewStore.setState({ view: { ...view, proposal: null, version: { id: 'v1', n: 1 } } as View })
    const c = draw(both({ proposed: true }))
    expect([line(c).style.stroke, g(c).getAttribute('data-link-halo')]).toEqual([EFFECT_STROKES.decreases, 'proposed'])
    expect(c.querySelector('[data-link-halo-path="proposed"]')).not.toBeNull()
    cleanup()
    useViewStore.setState({ view: { ...view, proposal: { id: 'p1' }, version: null } as View })
    expect(g(draw(both({ proposed: true }))).hasAttribute('data-link-halo')).toBe(false)
  })
  it('L4c the four channels coexist on one line: direction colour, doubt dash, alert halo and proposal halo', () => {
    useViewStore.setState({ view: { ...view, proposal: null, version: { id: 'v1', n: 1 } } as View })
    const c = draw(both({ doubt: true, alert: true, proposed: true }))
    expect([line(c).style.stroke, line(c).style.strokeDasharray, g(c).getAttribute('data-link-halo')]).toEqual([EFFECT_STROKES.decreases, DOUBT_DASH, 'alert proposed'])
  })
  it('L4d alert and proposal survive together on a neutral line and on a reason line, as two separate halos; the line keeps its neutral stroke (it was orange only, and the proposal vanished)', () => {
    useViewStore.setState({ view: { ...view, proposal: null, version: { id: 'v1', n: 1 } } as View })
    const plain = (extra: object) => ({ ...first, causal: null, role: null, kind: 'relation', doubt: false, alert: false, proposed: false, ...extra }) as unknown as ViewLink
    for (const l of [plain({ alert: true, proposed: true }), plain({ alert: true, proposed: true, kind: 'reason', role: 'reason' })]) {
      const c = draw(l)
      expect([line(c).style.stroke, g(c).getAttribute('data-link-halo')]).toEqual([EDGE_NEUTRAL, 'alert proposed'])
      expect(c.querySelector('[data-link-halo-path="alert"]')).not.toBeNull()
      expect(c.querySelector('[data-link-halo-path="proposed"]')).not.toBeNull()
      cleanup()
    }
    // One channel alone is still one halo; a first draft still marks no proposal (R3).
    const a = draw(plain({ alert: true })); expect(g(a).getAttribute('data-link-halo')).toBe('alert'); cleanup()
    useViewStore.setState({ view: { ...view, proposal: { id: 'p1' }, version: null } as View })
    expect(g(draw(plain({ alert: true, proposed: true }))).getAttribute('data-link-halo')).toBe('alert')
  })
})

describe('presentation is token CSS (panel-visual system, no styles in components)', () => {
  it('the halos, the dotted recipe, the off-path fade and the words\' box are classes in olumiLook.css; the fade\'s transition is gated on reduced motion', () => {
    const css = readFileSync(path.resolve('src/olumiView/look/olumiLook.css'), 'utf8')
    for (const sel of ['.ok-link-halo-alert', '.ok-link-halo-proposed', '.ok-link-dotted', '.ok-link-off-path', '.ok-link-words', '.ok-link-mark', '.ok-link-hit']) expect(css, sel).toContain(sel)
    expect(css).toMatch(/@media \(prefers-reduced-motion: no-preference\) \{[^}]*\.ok-link \{ transition: opacity/)
    const c = draw(withCausal('increases', { alert: true }))
    const words = document.body.querySelector('[data-view-link-words]') as HTMLElement
    expect(words.className).toContain('ok-link-words')
    expect([words.style.position, words.style.background, words.style.pointerEvents], 'no inline position, ground or pointer rule').toEqual(['', '', ''])
    expect(c.querySelector('path.ok-link-halo')?.getAttribute('style') ?? '', 'the halo is the class, not inline').toBe('')
  })
})
