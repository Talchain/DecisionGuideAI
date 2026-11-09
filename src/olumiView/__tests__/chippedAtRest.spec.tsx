/**
 * DL rulings, 9 Nov: (2) a link that carries core's disagreement chip is drawn at rest, though it is a reason link or a route's rail that
 * otherwise waits for focus: a disagreement the team cannot see defeats the point; (1) the chip alone marks the disagreement, so the line
 * keeps its sign's colour (V11): never two encodings. Bound by link index on the studio golden (links.4, a reason link; links.2, a '+' link),
 * with core's capacity chip (fixtures/disagree x2-stances) set on the record each line holds.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, render } from '@testing-library/react'
import { Position, ReactFlowProvider } from '@xyflow/react'
import type { View } from '../client'
import { ViewLinkEdge } from '../../canvas/edges/ViewLinkEdge'
import { EdgeLabelLayer } from './edgeLabelLayer'
import { useViewStore } from '../store'
import type { LinkMark } from '../linkMarkRules'

const read = <T,>(d: string, n: string): T => JSON.parse(readFileSync(path.resolve(d, n), 'utf8'))
const studio = read<View>('src/olumiView/golden', 'studio.view.json')
const chip = read<View>('src/olumiView/fixtures/disagree', 'x2-stances.view3.json').collab.link_marks![0]! as LinkMark
const Edge = ViewLinkEdge as unknown as (p: Record<string, unknown>) => JSX.Element
const HOLDS = { record: 'disputed_link', part: null }

/** Studio with line `i` holding HOLDS and, when `marked`, core's chip on it. */
function viewWith(i: number, marked: boolean): View {
  const v = structuredClone(studio)
  v.model!.links[i] = { ...v.model!.links[i]!, holds: HOLDS }
  v.collab.link_marks = marked ? [{ ...structuredClone(chip), link: HOLDS, line: true, card: null }] : []
  return v
}
function edge(v: View, i: number, at: number | null = null) {
  useViewStore.setState({ view: v, at })
  const l = v.model!.links[i]!
  return render(
    <ReactFlowProvider><EdgeLabelLayer><svg>
      <Edge id={`l${i}`} source={l.from} target={l.to} sourceX={0} sourceY={0} targetX={100} targetY={100}
        sourcePosition={Position.Bottom} targetPosition={Position.Top} data={{ link: l, i }} selected={false} />
    </svg></EdgeLabelLayer></ReactFlowProvider>,
  ).container
}
const line = (c: HTMLElement, i: number) => c.querySelector<SVGGElement>(`[data-view-link="links.${i}"]`)
afterEach(() => { cleanup(); useViewStore.setState(useViewStore.getInitialState(), true) })

describe('a link that carries a disagreement chip is drawn at rest', () => {
  it('CR1 precondition: studio links.4 is a reason link, links.2 a "+" link', () => {
    expect(studio.model!.links[4]!.kind).toBe('reason')
    expect(studio.model!.links[2]!.label).toBe('+')
  })
  it('CR2 contrast: the reason link with no chip waits for focus (nothing drawn at rest)', () => {
    expect(line(edge(viewWith(4, false), 4), 4)).toBeNull()
  })
  it('CR3 catch: the same reason link carrying core\'s chip is drawn at rest, with its chip', () => {
    const c = edge(viewWith(4, true), 4)
    expect(line(c, 4)).not.toBeNull()
    expect(c.querySelector('[data-link-mark="links.4"]')?.getAttribute('aria-label')).toBe(chip.label)
  })
  it('CR4 must not change: on an earlier version the chipped reason link waits for focus again', () => {
    expect(line(edge(viewWith(4, true), 4, 1), 4)).toBeNull()
  })
  it('CR5 ruling 1: a chipped "+" link keeps its sign\'s colour; the chip alone marks the disagreement', () => {
    const plain = edge(viewWith(2, false), 2).querySelector<SVGPathElement>('.react-flow__edge-path')!.style.stroke
    cleanup()
    const marked = edge(viewWith(2, true), 2).querySelector<SVGPathElement>('.react-flow__edge-path')!.style.stroke
    expect(marked).toBe(plain)
    expect(marked.toLowerCase()).toMatch(/#62b290|rgb\(98, 178, 144\)/)
  })
})
