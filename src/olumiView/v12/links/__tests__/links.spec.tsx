/** V12 links (rule 2): drawn exactly as the View holds them. Fixture: the bakery View from the wire (no private data). */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, render } from '@testing-library/react'
import { Position, ReactFlowProvider } from '@xyflow/react'
import type { View, ViewLink } from '../../../client'
import { useViewStore } from '../../../store'
import { useViewHover } from '../../../canvas'
import { ViewLinkEdge } from '../../../../canvas/edges/ViewLinkEdge'
import { EdgeLabelLayer } from '../../../__tests__/edgeLabelLayer'
import { DIRECTION_NOT_SETTLED, DOUBT_DASH, EDGE_NEUTRAL, EFFECT_STROKES, GOLD, INK, INPUT_GREY, LINK_STYLES, PLAIN_WIDTH, effectWidth, linkStyle } from '../styles'
import { effectMidpoint } from '../geometry'
import { setDefaultLevel, useSimpleLevel } from '../../simpleStore'
import { LINK_OFF_PATH_OPACITY as EDGE_OFF_PATH_OPACITY, useFocusPath } from '../../bands/focusPath'

const view: View = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/real/bakery-r5.view3.json'), 'utf8'))
const first = view.model!.links[0]!
const base = { ...first, causal: { sign: 'increases', of: 'more_of_from', target: first.to, disputed: false, author: null, text: '', strength: { state: 'sized', figure: null, low: null, likely: null } } } as unknown as ViewLink
afterEach(() => { cleanup(); useViewStore.setState({ view: null }); useFocusPath.setState({ path: null }); useSimpleLevel.setState({ levels: {} }); setDefaultLevel('simple'); useViewHover.setState({ id: null }) })

const Edge = ViewLinkEdge as unknown as (p: Record<string, unknown>) => JSX.Element
const draw = (link: ViewLink, nodes: { id: string; x: number; y: number }[] = []) => render(
  <ReactFlowProvider initialNodes={nodes.map((n) => ({ id: n.id, position: n, width: 100, height: 40, data: {} }))}><EdgeLabelLayer><svg>
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
  it('strength is thickness only from a unit-free share, on production\'s 2 / 3 / 4 / 5 ladder (R1, R5); raw figures never size a line', () => {
    // The bands are production's (canvas/domain/vocabulary: 0, 0.20, 0.40, 0.70 cuts); no share is the thinnest rung.
    expect(effectWidth(null)).toBe(2); expect(effectWidth(0)).toBe(2); expect(effectWidth(0.19)).toBe(2); expect(effectWidth(0.2)).toBe(3); expect(effectWidth(0.4)).toBe(4); expect(effectWidth(0.7)).toBe(5); expect(effectWidth(5)).toBe(5)
    expect(effectWidth(-0.5)).toBe(4)
    const l = withCausal('increases'); l.causal = { ...l.causal!, strength: { ...l.causal!.strength, share: 0.5 } }
    const c = draw(l)
    expect(line(c).style.strokeWidth).toBe('4')
    // Screen px: the line does not thin as the camera zooms out.
    expect(line(c).style.vectorEffect).toBe('non-scaling-stroke')
    cleanup()
    expect(line(draw(withCausal('increases'))).style.strokeWidth).toBe(String(PLAIN_WIDTH))
  })
  it('R1/R5 the ladder is drawn by the edge itself, a literal width per rung (share 0.25 is 3, 0.8 is 5, none is 2); a `reason` link carrying a share is still 2 px. NOTE: the quantity behind `share` is unconfirmed by the engine (production\'s cuts were written for weight)', () => {
    const shared = (share: number | null, extra: Partial<ViewLink> = {}) => { const l = withCausal('increases', extra); l.causal = { ...l.causal!, strength: { ...l.causal!.strength, share } as never }; return l }
    expect([0.25, 0.8, 0.1, null].map((x) => { const c = draw(shared(x)); const w = line(c).style.strokeWidth; cleanup(); return w })).toEqual(['3', '5', '2', '2'])
    // CONTRAST: a plain structural line is 2 px whatever the share beside it says; a reason link too.
    const plain = { ...shared(0.8), causal: null, role: null, kind: 'reason' } as unknown as ViewLink
    useViewHover.setState({ id: plain.from })
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
    expect(document.body.querySelector('[data-view-link-unsettled]')?.getAttribute('title')).toBe(DIRECTION_NOT_SETTLED)
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
    expect(document.body.querySelector('[data-view-link-unsettled]')?.getAttribute('title')).toBe('Which way this moves is not settled')
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
    // A reason link is drawn only while one of its cards is active, in Simple and Detailed alike: its card hovered here.
    setDefaultLevel('simple')
    useViewHover.setState({ id: first.from })
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
    useViewHover.setState({ id: first.from })
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
    const rest = draw(l('a', 'b'))
    expect([g(rest).style.opacity, g(rest).hasAttribute('data-off-path')]).toEqual(['', false])
    cleanup()
    useFocusPath.setState({ path: new Set(['a', 'b']) })
    const on = draw(l('a', 'b'))
    expect([g(on).style.opacity, g(on).hasAttribute('data-off-path')], 'on the path').toEqual(['', false])
    cleanup()
    const off = draw(l('a', 'z'))
    expect([g(off).style.opacity, g(off).hasAttribute('data-off-path')], 'one end off the path').toEqual([String(EDGE_OFF_PATH_OPACITY), true])
    expect(EDGE_OFF_PATH_OPACITY).toBe(0.18)
  })
})

describe('connector density (S4 density lane, 19 Nov): a reason link is a line only while its card is active', () => {
  const reason = (extra: Partial<ViewLink> = {}) => ({ ...first, from: 'a', to: 'b', kind: 'reason', role: 'reason', causal: null, doubt: false, alert: false, proposed: false, ...extra }) as unknown as ViewLink
  const causal = () => ({ ...withCausal('increases'), from: 'a', to: 'b' }) as ViewLink
  it('DENS1 Simple at rest draws no reason line, and its causal line is still drawn', () => {
    setDefaultLevel('simple')
    expect(line(draw(reason()))).toBeNull(); cleanup()
    expect(line(draw(causal()))).not.toBeNull()
  })
  it('DENS2 Simple draws the reason line while either of its cards is hovered; another card hovered draws nothing', () => {
    setDefaultLevel('simple')
    useViewHover.setState({ id: 'b' })
    expect(line(draw(reason()))).not.toBeNull(); cleanup()
    useViewHover.setState({ id: 'z' })
    expect(line(draw(reason()))).toBeNull()
  })
  it('DENS3 a reason line core marks challenged or proposed is drawn at rest on Simple', () => {
    setDefaultLevel('simple')
    expect(line(draw(reason({ alert: true })))).not.toBeNull(); cleanup()
    expect(line(draw(reason({ proposed: true })))).not.toBeNull()
  })
  it('DENS4 Detailed is as before: no reason line at rest, drawn on focus; its causal line is drawn', () => {
    setDefaultLevel('working')
    expect(line(draw(reason()))).toBeNull(); cleanup()
    expect(line(draw(causal()))).not.toBeNull(); cleanup()
    useViewHover.setState({ id: 'a' })
    expect(line(draw(reason()))).not.toBeNull()
  })
})
