/**
 * Paul's A11 board (12 Nov, his own brief, a PENDING first model; UI-15/15b): the UI faults he saw, each bound by identity. No fixture is
 * taken from his store: the pending first model here is core's own European first model held as a proposal ("new scenario",
 * reasoning/__tests__/fixtures/european-loop9.view3.json); a row that needs a shape it lacks says so and derives it from that View.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { cleanup, render } from '@testing-library/react'
import { Position, ReactFlowProvider, useStoreApi } from '@xyflow/react'
import type { View } from '../client'
import { useViewStore } from '../store'
import { useMe } from '../../olumiCore/me'
import { RootLinkEdge, ROOT_LINK_STROKE } from '../previous/RootLinkEdge'
import { ViewLinkEdge } from '../../canvas/edges/ViewLinkEdge'
import { EdgeLabelLayer } from './edgeLabelLayer'
import { HeldProposalLine } from '../ViewChances'
import { PortAnalysisTab } from '../port/PortAnalysisTab'
import { COMPARE_HELD, COMPARE_NONE, CoreCompareTab } from '../../olumiCore/compare'
import type { NodeProps } from '@xyflow/react'
import { CoreCard } from '../previous/CoreCard'
import { QUESTION } from '../layout'

const EU = JSON.parse(readFileSync(path.resolve('src/olumiView/reasoning/__tests__/fixtures/european-loop9.view3.json'), 'utf8')) as View
const ready = (view: View | null, sid: string | null = view?.id ?? null) => {
  useViewStore.setState({ uuid: sid === null ? null : '00000000-0000-4000-8000-000000000001', sid, view, status: view === null ? 'none' : 'ready', error: null, stale: false, at: null } as never)
  if (view !== null) useMe.setState({ me: { id: view.you_id, name: view.you }, status: 'ready' })
}
afterEach(() => { cleanup(); useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none' } as never); useMe.setState({ me: null, status: 'none' }) })
const css = () => readdirSync(path.resolve('src/styles')).filter((f) => f.endsWith('.css')).map((f) => readFileSync(path.resolve('src/styles', f), 'utf8')).join('\n') + readFileSync(path.resolve('src/index.css'), 'utf8')

describe('the graph', () => {
  it('PB1 (G1): the question-to-option line is stroked with a colour the stylesheets define; the old token is defined nowhere', () => {
    const Edge = RootLinkEdge as unknown as (p: Record<string, unknown>) => JSX.Element
    const c = render(<ReactFlowProvider><svg><Edge id="root:o" source="q" target="o" sourceX={0} sourceY={0} targetX={0} targetY={80} sourcePosition={Position.Bottom} targetPosition={Position.Top} /></svg></ReactFlowProvider>).container
    const stroke = c.querySelector<SVGPathElement>('path.react-flow__edge-path')!.style.stroke
    expect(stroke).toBe(ROOT_LINK_STROKE)
    const token = /^var\((--[\w-]+)\)$/.exec(stroke)![1]!
    expect(new RegExp(`${token}:\\s*#[0-9a-fA-F]{6}\\b`).test(css()), `${token} is a hex colour in the stylesheets`).toBe(true)
    expect(/--border-strong\s*:/.test(css()), 'CONTRAST: the old token is defined nowhere').toBe(false)
  })

  it('PB2 (G4): a link into a card wholly above its source leaves the source\'s top and enters the target\'s foot; CONTRAST: a link downward keeps its handles', () => {
    const link = { ...EU.model!.links[0]!, from: 'low', to: 'high', kind: 'reason', label: '', effect: null, remove: null }
    const Edge = ViewLinkEdge as unknown as (p: Record<string, unknown>) => JSX.Element
    // The question heads the board, so "high" is a middle row (a link into the head row takes a rail: linkRail.ts).
    const boxes = { q: { x: 0, y: -160, w: 548, h: 66 }, high: { x: 300, y: 0, w: 248, h: 100 }, low: { x: 0, y: 160, w: 248, h: 100 } }
    const draw = (from: 'low' | 'high', to: 'low' | 'high', sx: number, sy: number, tx: number, ty: number) => {
      const Seed = () => {
        const api = useStoreApi()
        api.setState({ nodeLookup: new Map(Object.entries(boxes).map(([id, b]) => [id, { id, selected: false, internals: { positionAbsolute: { x: b.x, y: b.y } }, measured: { width: b.w, height: b.h } }])) as never })
        return null
      }
      const c = render(<ReactFlowProvider><Seed /><EdgeLabelLayer><svg><Edge id="l0" source={from} target={to} sourceX={sx} sourceY={sy} targetX={tx} targetY={ty}
        sourcePosition={Position.Bottom} targetPosition={Position.Top} data={{ link: { ...link, from, to }, i: 0 }} selected /></svg></EdgeLabelLayer></ReactFlowProvider>).container
      return c.querySelector<SVGPathElement>('path.react-flow__edge-path')!.getAttribute('d')!
    }
    // Upward: from "low" (its bottom handle at 124,260) into "high" (its top handle at 424,0), as React Flow hands them over.
    const up = draw('low', 'high', 124, 260, 424, 0)
    expect(up.startsWith('M124,160')).toBe(true) // the source card's top-centre
    expect(up.endsWith('424,100')).toBe(true) // the target card's foot, centre
    cleanup()
    const down = draw('high', 'low', 424, 100, 124, 160)
    expect([down.startsWith('M424,100'), down.endsWith('124,160')]).toEqual([true, true])
  })
})

describe('the panel on a pending first model', () => {
  it('PB3 (P3): the held proposal says core\'s heading and the version it is on apart, never run together', () => {
    ready(EU)
    const p = render(<HeldProposalLine />).container.querySelector('[data-testid="view-tabs-held-proposal"]')!
    expect(p.textContent).toBe(`${EU.proposal!.heading} · ${EU.proposal!.on}`)
  })

  it('PB4 (P3, derived: the European first model without its lead, waits or option rows, as Paul\'s first model had): the Analysis hero draws no empty box; CONTRAST: with its lead it does', () => {
    ready(EU)
    const withLead = render(<PortAnalysisTab />).container
    expect(withLead.querySelector('[data-testid="port-analysis-hero"] [data-view="run.lead"]')?.textContent).toBe(EU.model!.run!.lead)
    cleanup()
    const bare = structuredClone(EU)
    Object.assign(bare.model!.run!, { lead: null, waits_on: null, shared_blockers: null, most_likely: null })
    for (const c of bare.model!.cards) if (c.family === 'option') Object.assign(c, { rows: [], headline: null })
    ready(bare)
    expect(render(<PortAnalysisTab />).container.querySelector('[data-testid="port-analysis-hero"]')).toBeNull()
  })

  it('PB5 (P2): Compare on a first model held as Olumi\'s proposal says so, not "start a model"; CONTRAST: with no scenario it says start one', () => {
    ready(EU)
    expect(EU.version ?? null).toBeNull()
    expect(render(<CoreCompareTab />).container.querySelector('[data-testid="core-compare-none"]')?.textContent).toBe(COMPARE_HELD)
    cleanup()
    ready(null, null)
    expect(render(<CoreCompareTab />).container.querySelector('[data-testid="core-compare-none"]')?.textContent).toBe(COMPARE_NONE)
  })
})

describe('core\'s badges on the board (UI-18: the lane\'s card never drew them)', () => {
  const Node = CoreCard as unknown as (p: NodeProps) => JSX.Element
  const props = (id: string, card: unknown): NodeProps => ({ id, type: 'viewCard', data: { card }, selected: false, dragging: false, zIndex: 0, isConnectable: false,
    positionAbsoluteX: 0, positionAbsoluteY: 0, selectable: true, deletable: false, draggable: false } as unknown as NodeProps)
  type B = { label: string; face?: string; words?: string; text: string }
  const said = (b: B) => b.face ?? b.words ?? b.text

  it('PB6: the question\'s badge is drawn on the question, in core\'s words, under its own label (pending European first model)', () => {
    ready(EU)
    const b = EU.model!.question.badge as unknown as B
    expect(b, 'precondition: core folded records behind the question').not.toBeNull()
    render(<ReactFlowProvider><Node {...props(QUESTION, undefined)} /></ReactFlowProvider>)
    const btn = document.querySelector<HTMLElement>(`[data-core-badge="${QUESTION}"] button`)!
    expect([btn.getAttribute('aria-label'), btn.textContent!.includes(said(b))]).toEqual([b.label, true])
  })

  it('PB7: every card core folds records behind draws its badge, by its id, in core\'s words; a card with none draws none', () => {
    ready(EU)
    const m = EU.model!, withBadge = m.cards.filter((c) => c.badge != null)
    expect(withBadge.length).toBeGreaterThan(0)
    for (const c of m.cards) {
      const r = render(<ReactFlowProvider><Node {...props(c.id, c)} /></ReactFlowProvider>)
      const btn = r.container.querySelector<HTMLElement>(`[data-core-badge="${c.id}"] button`)
      if (c.badge == null) expect(btn, c.id).toBeNull()
      else expect([btn?.getAttribute('aria-label'), btn?.textContent?.includes(said(c.badge as unknown as B))], c.id).toEqual([(c.badge as unknown as B).label, true])
      r.unmount()
    }
  })
})
