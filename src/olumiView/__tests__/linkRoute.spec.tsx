/**
 * Craft 8 and 12 on the drawn link (canvas/edges/ViewLinkEdge.tsx, canvas/edges/linkRail.ts downSlots; UI craft pass, 9 Nov: connector
 * congestion is the canvas grade's top defect, and nothing fades at rest). The links are core's own: the zero-call core's View of a copy of
 * Paul's consulting board (../fixtures/linechip/cara.view3.json). The card boxes are built here, so each row puts the cards where it needs them.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, render } from '@testing-library/react'
import { Position, ReactFlowProvider, type Edge as FlowEdge, type Node } from '@xyflow/react'
import type { View } from '../client'
import { useViewStore } from '../store'
import { useViewHover } from '../canvas'
import { ViewLinkEdge } from '../../canvas/edges/ViewLinkEdge'
import { EdgeLabelLayer } from './edgeLabelLayer'

const view = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/linechip/cara.view3.json'), 'utf8')) as View
const L = view.model!.links
/** A resting link: no chip, no sign, not challenged or proposed. */
const plain = L.findIndex((l) => l.kind === 'plain' && !l.alert && !l.proposed && l.label === '' && l.holds == null)
/** Two reason links (drawn only while a card of theirs is active) leaving one card for two others. */
const r1 = L.findIndex((l) => l.kind === 'reason' && !l.alert && l.to === 'incremental_opportunity_share')
const r2 = L.findIndex((l) => l.kind === 'reason' && !l.alert && l.to === 'buyer_transfer_test')

beforeEach(() => { useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000000', sid: view.id, view, status: 'ready', error: null, stale: false, at: null }) })
afterEach(() => { cleanup(); act(() => { useViewHover.setState({ id: null }) }) })

const card = (id: string, x: number, y: number, selected = false): Node => ({ id, position: { x, y }, data: {}, width: 220, height: 100, measured: { width: 220, height: 100 }, selected })
const flowEdge = (i: number): FlowEdge => ({ id: `e${i}`, source: L[i]!.from, target: L[i]!.to, type: 'viewLink', data: { link: L[i]!, i } })
const Edge = ViewLinkEdge as unknown as (p: Record<string, unknown>) => JSX.Element
/** Link i drawn as React Flow hands it over: from its source's right handle to its target's left handle. */
const draw = (i: number, nodes: Node[], inStore: FlowEdge[] = []) => render(
  <ReactFlowProvider initialNodes={nodes} initialEdges={inStore}><EdgeLabelLayer><svg>
    <Edge id={`e${i}`} source={L[i]!.from} target={L[i]!.to} sourceX={220} sourceY={50} targetX={nodes[1]!.position.x} targetY={nodes[1]!.position.y + 50}
      sourcePosition={Position.Right} targetPosition={Position.Left} data={{ link: L[i]!, i }} />
  </svg></EdgeLabelLayer></ReactFlowProvider>).container
const lineOf = (c: HTMLElement, i: number) => c.querySelector(`[data-view-link="links.${i}"] path.react-flow__edge-path`) as SVGPathElement
const ends = (d: string) => { const v = [...d.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])]); return { from: v[0]!, to: v.at(-1)! } }

describe('craft 8: a link into a card below its source runs down the gap', () => {
  it('core\'s own links: a resting one, and two reason links leaving one card', () => {
    expect([plain, r1, r2].every((k) => k >= 0)).toBe(true)
    expect(L[r1]!.from).toBe(L[r2]!.from)
  })

  it('HIGH: a link into a card wholly below its source runs from the source\'s bottom edge to the target\'s top edge, not from its side handle', () => {
    const c = draw(plain, [card(L[plain]!.from, 0, 0), card(L[plain]!.to, 0, 300)])
    expect(c.querySelector(`[data-view-link="links.${plain}"]`)?.getAttribute('data-route')).toBe('down')
    // From the middle of the source's bottom edge (the only link there) to the middle of the target's top edge.
    expect(ends(lineOf(c, plain).getAttribute('d')!)).toEqual({ from: [110, 100], to: [110, 300] })
  })

  it('HIGH: a link into a card in its source\'s row keeps the handle path React Flow gives', () => {
    const c = draw(plain, [card(L[plain]!.from, 0, 0), card(L[plain]!.to, 400, 0)])
    expect(c.querySelector(`[data-view-link="links.${plain}"]`)?.getAttribute('data-route')).toBe('handle')
    expect(ends(lineOf(c, plain).getAttribute('d')!)).toEqual({ from: [220, 50], to: [400, 50] })
  })

  it('only the links drawn are counted: a reason link at rest takes no slot; when its card is hovered and it is drawn, the two share the edge', async () => {
    // r1's target is selected, so r1 is drawn; r2 (to the right) is a reason link no active card touches, so it is not drawn.
    const nodes = [card(L[r1]!.from, 0, 0), card(L[r1]!.to, 0, 300, true), card(L[r2]!.to, 300, 300)]
    const c = draw(r1, nodes, [flowEdge(r1), flowEdge(r2)])
    expect(ends(lineOf(c, r1).getAttribute('d')!).from).toEqual([110, 100]) // alone on the edge: its middle
    // Hovering the shared source draws r2 as well: r1 (its target to the left) takes the first of two slots.
    act(() => { useViewHover.setState({ id: L[r1]!.from }) })
    expect(ends(lineOf(c, r1).getAttribute('d')!).from[0]).toBeCloseTo(220 / 3, 6)
  })
})

describe('craft 12: nothing fades at rest', () => {
  it('HIGH: a resting link is drawn in solid --edge-neutral, with no transparency mixed in', () => {
    const c = draw(plain, [card(L[plain]!.from, 0, 0), card(L[plain]!.to, 400, 0)])
    expect(lineOf(c, plain).style.stroke).toBe('var(--edge-neutral)')
    expect(lineOf(c, plain).getAttribute('style')).not.toMatch(/transparent|color-mix|opacity/)
  })
})
