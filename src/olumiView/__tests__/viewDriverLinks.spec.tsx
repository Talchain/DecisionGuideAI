/**
 * What would change on the links (DL 4 Nov, R2): a link leaving a figure an option's chance moves most with, or sized by one (core's
 * `links[].effect.figure`), is drawn wider in ink; a link core sizes says its strength in core's words. Fixture: the bakery View from the
 * wire, whose options name their drivers (second oven: extra sold per oven, folded into "sales"; longer hours: extra hours sold).
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
vi.mock('../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: {} }))
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, render } from '@testing-library/react'
import { Position, ReactFlowProvider } from '@xyflow/react'
import type { View } from '../client'
import { driverLinksOf, driversOf } from '../layout'
import { useViewLens } from '../lens'
import { useViewStore } from '../store'
import { ViewLinkEdge } from '../../canvas/edges/ViewLinkEdge'
import { EdgeLabelLayer } from './edgeLabelLayer'

const view: View = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/real/bakery-r5.view3.json'), 'utf8'))
const model = view.model!
afterEach(() => { cleanup(); useViewLens.setState({ lens: 'full' }); useViewStore.setState({ view: null }) })

/** The edge with only the props it reads (React Flow passes the rest). */
const Edge = ViewLinkEdge as unknown as (p: Record<string, unknown>) => JSX.Element
const edge = (i: number) => {
  const link = model.links[i]!
  return render(
    <ReactFlowProvider><EdgeLabelLayer><svg>
      <Edge id={`l${i}`} source={link.from} target={link.to} sourceX={0} sourceY={0} targetX={100} targetY={100}
        sourcePosition={Position.Bottom} targetPosition={Position.Top} data={{ link, i }} />
    </svg></EdgeLabelLayer></ReactFlowProvider>,
  ).container
}

describe('What would change on the links', () => {
  it('bakery: the links leaving a driver\'s card (sales, extra hours sold) and the links core sizes by a driver figure', () => {
    expect([...driversOf(model).keys()]).toEqual(['sales', 'extra_hours_sold'])
    expect([...driverLinksOf(model, driversOf(model))].map((i) => `${model.links[i]!.from}>${model.links[i]!.to}`))
      .toEqual(['extra_hours_sold>sales', 'sales>sell_360', 'one_oven>sales', 'hours_switched_on>sales'])
  })

  it('CONTRAST: with no driver named, no link is marked', () => {
    const none = { ...model, cards: model.cards.map((c) => ({ ...c, driver: null })) }
    expect(driverLinksOf(none, driversOf(none)).size).toBe(0)
  })

  it('on the canvas: wider in ink, with core\'s strength words, while the lens is on; at rest under Model the words wait for selection or focus (R25, 2A)', () => {
    useViewStore.setState({ view })
    const sized = model.links.findIndex((l) => l.from === 'one_oven' && l.to === 'sales'), plain = model.links.findIndex((l) => l.from === 'budget')
    let c = edge(sized)
    expect(c.querySelector('[data-driver-link]')).toBeNull()
    // R25 (plan v3 item 7, Paul's 2A; was R1 P1's "under every lens"): at rest the line keeps its sign; the strength words show on selection or
    // focus, or on a driver link under this lens (below).
    expect(c.querySelector(`[data-view="links.${sized}.effect.text"]`)).toBeNull()
    cleanup()
    act(() => useViewLens.setState({ lens: 'what_changes' }))
    c = edge(sized)
    expect(c.querySelector('[data-driver-link]')).not.toBeNull()
    expect(c.querySelector<SVGPathElement>('path.react-flow__edge-path')!.style.strokeWidth).toBe('4')
    expect(c.querySelector(`[data-view="links.${sized}.effect.text"]`)?.textContent).toBe(model.links[sized]!.effect!.text)
    cleanup()
    c = edge(plain)
    expect(c.querySelector('[data-driver-link]')).toBeNull()
    // R1/R5 (Paul, 16 Nov): a plain link at rest is production's 2 px neutral, the foot of the width ladder; a driver link is the 4 px band above it.
    expect(c.querySelector<SVGPathElement>('path.react-flow__edge-path')!.style.strokeWidth).toBe('2')
  })

  it('R5: a driver link is the 4 px rung at least and never thinner than its own strength earns (share 0.8 is the 5 px rung; no share is 4)', () => {
    useViewStore.setState({ view })
    act(() => useViewLens.setState({ lens: 'what_changes' }))
    const sized = model.links.findIndex((l) => l.from === 'one_oven' && l.to === 'sales')
    const withShare = (share: number | null) => {
      const link = { ...model.links[sized]!, causal: { sign: 'increases', of: 'x', target: model.links[sized]!.to, disputed: false, author: null, text: '', strength: { state: 'sized', figure: null, low: null, likely: null, share } } } as unknown as typeof model.links[number]
      return render(<ReactFlowProvider><EdgeLabelLayer><svg>
        <Edge id="d" source={link.from} target={link.to} sourceX={0} sourceY={0} targetX={100} targetY={100} sourcePosition={Position.Bottom} targetPosition={Position.Top} data={{ link, i: sized }} />
      </svg></EdgeLabelLayer></ReactFlowProvider>).container
    }
    const width = (c: HTMLElement) => ({ driver: c.querySelector('[data-driver-link]') !== null, w: c.querySelector<SVGPathElement>('path.react-flow__edge-path')!.style.strokeWidth })
    expect(width(withShare(0.8))).toEqual({ driver: true, w: '5' }); cleanup()
    expect(width(withShare(null))).toEqual({ driver: true, w: '4' })
  })
})
