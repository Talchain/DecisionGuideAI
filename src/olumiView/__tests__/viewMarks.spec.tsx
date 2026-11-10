/**
 * Canvas A1, review 00057: what core's page shows on the canvas stays visible on the olumi-core lane. The question (#1) as core wrote
 * it; each link's meaning (#3): its sign, its doubt, its challenge, its proposal and its hover; and core's marks on a card (#4): Olumi
 * points at it, it is challenged, core doubts it. Each row toggles one View flag and the drawing must change with it.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { render } from '@testing-library/react'
import { Position, ReactFlowProvider } from '@xyflow/react'
import type { View, ViewLink } from '../client'
import { ViewCard } from '../../canvas/nodes/ViewCardNode'
import { ViewQuestion } from '../../canvas/nodes/ViewQuestionNode'
import { ViewLinkEdge } from '../../canvas/edges/ViewLinkEdge'
import { useViewHover } from '../canvas'
import { EdgeLabelLayer } from './edgeLabelLayer'

const golden = (n: string): View => JSON.parse(readFileSync(path.resolve('src/olumiView/golden', `${n}.view.json`), 'utf8'))

describe('#1 the question', () => {
  it('its text, its date with core\'s hover, and its badge, each exactly as core wrote it', () => {
    const q = structuredClone(golden('european').model!.question)
    q.decide_by = { text: 'by 2027-03-31', title: 'You set this date', olumi: false }
    const c = render(<ViewQuestion question={q} width={600} />).container
    expect(c.querySelector('[data-view="question.text"]')?.textContent).toBe(q.text)
    expect(c.querySelector('[data-view="question.decide_by.text"]')?.textContent).toBe('by 2027-03-31')
    expect(c.querySelector('[data-view="question.decide_by.text"]')?.getAttribute('title')).toBe('You set this date')
    expect(q.badge).not.toBeNull()
    // Core names what the badge folds (`icon` and `words`, cd99ab32): the badge draws those; with neither, its `text` (Badge.tsx badgeNamed).
    const b = q.badge as typeof q.badge & { icon?: string; words?: string; face?: string }
    // Since core 91fdf8a9 (DL 10 Nov): the badge's face on the card, its words whole on hover.
    if (b.face) {
      expect(c.querySelector('[data-view="question.badge.face"]')?.textContent).toBe(b.face)
      expect(c.querySelector('[data-view="question.badge.face"]')!.closest('button')!.getAttribute('title')!.split('\n')[0]).toBe(b.words)
    } else if (b.icon && b.words) {
      expect(c.querySelector('[data-view="question.badge.icon"]')?.textContent).toBe(b.icon)
      expect(c.querySelector('[data-view="question.badge.words"]')?.textContent).toBe(b.words)
    } else expect(c.querySelector('[data-view="question.badge.text"]')?.textContent).toBe(b.text)
  })

  it('a date Olumi set, a question Olumi points at, and one with a proposed change each show', () => {
    const q = structuredClone(golden('pricing').model!.question)
    const plain = render(<ViewQuestion question={q} width={600} />).container.innerHTML
    for (const set of [
      () => { q.decide_by = { text: 'by 2027-03-31', title: 'Olumi set this date', olumi: true } },
      () => { q.focus = true },
      () => { q.proposed = true },
    ]) {
      const before = render(<ViewQuestion question={structuredClone(q)} width={600} />).container.innerHTML
      set()
      expect(render(<ViewQuestion question={q} width={600} />).container.innerHTML).not.toBe(before)
    }
    expect(plain).not.toContain('data-focus')
    const c = render(<ViewQuestion question={q} width={600} />).container
    expect(c.querySelector('[data-olumi]')).not.toBeNull()
    expect(c.querySelector('[data-focus]')).not.toBeNull()
    expect(c.querySelector('[data-proposed]')).not.toBeNull()
  })
})

// Drawn with its first card hovered: a premise or assumption link is drawn only then (linkDrawn; viewCanvas.spec folds them).
const edge = (link: ViewLink, i = 0) => (useViewHover.setState({ id: link.from }), render(
  <ReactFlowProvider><EdgeLabelLayer><svg><ViewLinkEdge id="e" source="a" target="b" sourceX={0} sourceY={0} targetX={100} targetY={40}
    sourcePosition={Position.Right} targetPosition={Position.Left} data={{ link, i }} /></svg></EdgeLabelLayer></ReactFlowProvider>,
).container)

describe('#3 a link keeps its meaning', () => {
  const links = golden('european').model!.links
  it('its hover is core\'s title, its kind is on the path, and a doubted link is dashed while a firm one is not', () => {
    const doubted = links.find((l) => l.doubt)!, firm = links.find((l) => !l.doubt)!
    for (const l of [doubted, firm]) {
      const c = edge(l)
      expect(c.querySelector('g[data-view-link] > title')?.textContent).toBe(l.title)
      expect(c.querySelector('g[data-view-link]')?.getAttribute('data-kind')).toBe(l.kind)
      // Dashed means doubt (the J1 gate's links draw the dash as 5 5): bound to dashed or not, not to one pattern's bytes.
      // The line itself (React Flow's edge path), not the arrowhead's path in <defs>, which now comes first.
      const dash = (c.querySelector('path.react-flow__edge-path') as SVGPathElement).style.strokeDasharray
      if (l.doubt) expect(dash, 'doubted is dashed').not.toBe('')
      else expect(dash, 'firm is solid').toBe('')
    }
  })

  it('its sign sits on the line, exactly as core wrote it, bound to its place in the View', () => {
    const i = links.findIndex((l) => l.label !== '')
    edge(links[i]!, i)
    expect(document.body.querySelector(`[data-view="links.${i}.label"]`)?.textContent).toBe(links[i]!.label)
  })

  it('a challenged link and a proposed link each show it', () => {
    const l = links[0]!
    expect(edge({ ...l, alert: true }).querySelector('[data-alert]')).not.toBeNull()
    expect(edge({ ...l, proposed: true }).querySelector('[data-proposed]')).not.toBeNull()
    expect(edge({ ...l, alert: false, proposed: false }).querySelector('[data-alert], [data-proposed]')).toBeNull()
  })
})

describe('#4 core\'s marks on a card', () => {
  const card = golden('pricing').model!.cards[0]!
  for (const flag of ['focus', 'challenged', 'doubt'] as const) {
    it(`${flag} shows on the card, and its absence does not`, () => {
      const off = render(<ViewCard card={{ ...card, focus: false, challenged: false, doubt: false }} />).container
      const on = render(<ViewCard card={{ ...card, focus: false, challenged: false, doubt: false, [flag]: true }} />).container
      expect(off.querySelector(`[data-${flag}]`)).toBeNull()
      expect(on.querySelector(`[data-${flag}]`)).not.toBeNull()
      expect(on.innerHTML).not.toBe(off.innerHTML)
    })
  }
})
