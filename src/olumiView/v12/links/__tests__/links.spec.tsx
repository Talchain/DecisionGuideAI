/** V12 links (rule 2): drawn exactly as the View holds them. Fixture: the bakery View from the wire (no private data). */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, render } from '@testing-library/react'
import { Position, ReactFlowProvider } from '@xyflow/react'
import type { View, ViewLink } from '../../../client'
import { useViewStore } from '../../../store'
import { ViewLinkEdge } from '../../../../canvas/edges/ViewLinkEdge'
import { EdgeLabelLayer } from '../../../__tests__/edgeLabelLayer'
import { DIRECTION_NOT_SETTLED, GOLD, INK, INPUT_GREY, LINK_STYLES, effectDash, linkStyle } from '../styles'
import { effectMidpoint } from '../geometry'

const view: View = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/real/bakery-r5.view3.json'), 'utf8'))
const first = view.model!.links[0]!
const base = { ...first, causal: { sign: 'increases', of: 'more_of_from', target: first.to, disputed: false, author: null, text: '', strength: { state: 'sized', figure: null, low: null, likely: null } } } as unknown as ViewLink
afterEach(() => { cleanup(); useViewStore.setState({ view: null }) })

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
    expect(LINK_STYLES.effect).toMatchObject({ stroke: INK, dash: null, end: 'arrow' })
    expect(LINK_STYLES.input).toMatchObject({ stroke: INPUT_GREY, dash: '1 4', end: 'dot' })
    expect(LINK_STYLES.measures).toMatchObject({ stroke: GOLD, end: 'none' })
    expect(LINK_STYLES.target.stroke).toBe(GOLD)
    expect(LINK_STYLES.size).toMatchObject({ dash: '1 4', end: 'none', label: 'size' })
  })
  it('reason, an unknown role and no role have no style (drawn as today)', () => {
    expect(linkStyle({ role: 'reason' })).toBeNull()
    expect(linkStyle({ role: 'banana' })).toBeNull()
    expect(linkStyle({})).toBeNull()
    expect(linkStyle({ role: 'input' })?.role).toBe('input')
  })
  it('doubt alone dashes an effect', () => { expect(effectDash(true)).not.toBeNull(); expect(effectDash(false)).toBeNull() })
})

describe('a modelled effect', () => {
  it('is one ink with an arrowhead whatever its sign, with no sign glyph', () => {
    for (const sign of ['increases', 'decreases', 'none'] as const) {
      const c = draw(withCausal(sign))
      expect(line(c).style.stroke).toBe(INK)
      expect(g(c).getAttribute('data-link-end')).toBe('arrow')
      expect(line(c).getAttribute('marker-end')).toMatch(/^url\(#/)
      expect(c.querySelector('[data-view-link-sign]')).toBeNull()
      cleanup()
    }
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
  it('an unsettled direction gets a ? badge with the fixed words, or core\'s when it sends them', () => {
    const l = withCausal('unknown'); l.causal!.text = ''
    const c = draw(l)
    expect(document.body.querySelector('[data-view-link-unsettled="links.0"]')?.textContent).toBe('?')
    expect(document.body.querySelector('[data-view-link-unsettled]')?.getAttribute('title')).toBe(DIRECTION_NOT_SETTLED)
    cleanup(); void c
    const m = withCausal('unknown'); m.causal!.text = 'Which way this moves is not settled'
    draw(m)
    expect(document.body.querySelector('[data-view-link-unsettled]')?.getAttribute('title')).toBe('Which way this moves is not settled')
    cleanup()
    draw(withCausal('increases'))
    expect(document.body.querySelector('[data-view-link-unsettled]')).toBeNull()
  })
})

describe('link roles', () => {
  const role = (r: string, extra: object = {}) => ({ ...withCausal('increases'), role: r, ...extra }) as ViewLink
  it('input: thin grey dotted, a filled dot at the end, no arrowhead', () => {
    const c = draw(role('input'))
    expect(line(c).style.stroke).toBe(INPUT_GREY)
    expect(line(c).style.strokeDasharray).toBe('1 4')
    expect(g(c).getAttribute('data-link-end')).toBe('dot')
    expect(c.querySelector('marker circle')).not.toBeNull()
    expect(c.querySelector('marker path')).toBeNull()
  })
  it('measures: a gold line, no arrowhead', () => {
    const c = draw(role('measures'))
    expect(line(c).style.stroke).toBe(GOLD)
    expect(line(c).getAttribute('marker-end')).toBeNull()
    expect(g(c).getAttribute('data-link-role')).toBe('measures')
  })
  it('target: a gold line', () => { expect(line(draw(role('target'))).style.stroke).toBe(GOLD) })
  it('reason: no role style is applied (a typed link keeps the modelled look)', () => {
    const c = draw(role('reason'))
    expect(line(c).style.stroke).toBe(INK)
    expect(line(c).style.strokeDasharray).toBe('')
  })
  it('size: a dotted wire to the midpoint of the sized effect, labelled "size"; never an arrowhead', () => {
    const l = role('size', { sizes: { from: 'a', to: 'b' } })
    const c = draw({ ...l, from: 'f', to: 't' } as ViewLink, [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 0, y: 200 }, { id: 'f', x: 300, y: 0 }, { id: 't', x: 300, y: 100 }])
    expect(line(c).style.strokeDasharray).toBe('1 4')
    expect(line(c).getAttribute('marker-end')).toBeNull()
    expect(c.querySelector('[data-view-link-size-label="links.0"]')?.textContent).toBe('size')
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
