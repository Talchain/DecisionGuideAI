/**
 * R1 P1 (Codex on d169a9dc1): a link core sizes (`links[].effect`, core 685e725: its strength in core's words) says it on the line, with
 * core's hover. The bakery View from the wire: two links with an empty label and an effect.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, render } from '@testing-library/react'
import { Position, ReactFlowProvider } from '@xyflow/react'
import type { View } from '../client'
import { ViewLinkEdge } from '../../canvas/edges/ViewLinkEdge'
import { EdgeLabelLayer } from './edgeLabelLayer'
import { focusedLinkOf, useViewFocusLink } from '../canvas'

const model = (JSON.parse(readFileSync(path.resolve('src/olumiView/golden/bakery.view.json'), 'utf8')) as View).model!
afterEach(() => { cleanup(); useViewFocusLink.setState({ id: null }) })
/** The edge with only the props it reads (React Flow passes the rest). */
const Edge = ViewLinkEdge as unknown as (p: Record<string, unknown>) => JSX.Element
// R25 (2A): strength words show while the link is selected (or focused, or an end card active); these rows read a selected link.
const edge = (i: number, selected = true) => render(
  <ReactFlowProvider><EdgeLabelLayer><svg>
    <Edge id={`l${i}`} source={model.links[i]!.from} target={model.links[i]!.to} sourceX={0} sourceY={0} targetX={100} targetY={100}
      sourcePosition={Position.Bottom} targetPosition={Position.Top} data={{ link: model.links[i]!, i }} selected={selected} />
  </svg></EdgeLabelLayer></ReactFlowProvider>,
).container

describe('a link core sizes says its strength on the line', () => {
  const sized = model.links.flatMap((l, i) => (l.effect != null ? [i] : []))
  it('bakery: each link with an effect draws its words, with core\'s hover', () => {
    expect(sized.length).toBe(2)
    for (const i of sized) {
      const t = edge(i).querySelector(`[data-view="links.${i}.effect.text"]`)
      expect(t?.textContent, `links.${i}`).toBe(model.links[i]!.effect!.text)
      expect(t?.getAttribute('title'), `links.${i}`).toBe(model.links[i]!.effect!.title)
      cleanup()
    }
  })
  it('the rendering contract: on every golden, every link core sizes draws its effect words', () => {
    let n = 0
    for (const g of ['app-launch', 'bakery', 'european', 'pricing', 'proposal', 's_ce285b3617bb', 'studio']) {
      const m = (JSON.parse(readFileSync(path.resolve('src/olumiView/golden', `${g}.view.json`), 'utf8')) as View).model!
      m.links.forEach((l, i) => {
        if (l.effect == null) return
        n += 1
        const c = render(<ReactFlowProvider><EdgeLabelLayer><svg><Edge id={`l${i}`} source={l.from} target={l.to} sourceX={0} sourceY={0} targetX={100} targetY={100}
          sourcePosition={Position.Bottom} targetPosition={Position.Top} data={{ link: l, i }} selected /></svg></EdgeLabelLayer></ReactFlowProvider>).container
        expect(c.querySelector(`[data-view="links.${i}.effect.text"]`)?.textContent, `${g} links.${i}`).toBe(l.effect.text)
        cleanup()
      })
    }
    expect(n).toBeGreaterThan(0)
  })
  it('R3 (DL 4 Nov: "…week" clipped under a card): the words on a line are in React Flow\'s label layer, above a resting card, never in the edge\'s own SVG under the cards', () => {
    const i = sized[0]!, c = edge(i)
    const t = c.querySelector(`[data-view="links.${i}.effect.text"]`)!
    expect(t.closest('.react-flow__edgelabel-renderer')).not.toBeNull()
    expect(t.closest('svg')).toBeNull()
    expect(Number((t.closest('[data-view-link-words]') as HTMLElement).style.zIndex)).toBeGreaterThan(0)
  })
  it('R25 (plan v3 item 7, Paul\'s 2A): at rest a sized link keeps its sign but not its strength words; selecting it shows them', () => {
    const i = sized[0]!
    expect(edge(i, false).querySelector(`[data-view="links.${i}.effect.text"]`)).toBeNull()
    cleanup()
    expect(edge(i, true).querySelector(`[data-view="links.${i}.effect.text"]`)?.textContent).toBe(model.links[i]!.effect!.text)
  })
  it('catch (DL 7 Nov: words on keyboard focus alone): a link with focus, not selected, says its strength; another link\'s focus does not', () => {
    const i = sized[0]!
    useViewFocusLink.setState({ id: `l${i}` })
    expect(edge(i, false).querySelector(`[data-view="links.${i}.effect.text"]`)?.textContent).toBe(model.links[i]!.effect!.text)
    cleanup()
    useViewFocusLink.setState({ id: 'some-other-link' })
    expect(edge(i, false).querySelector(`[data-view="links.${i}.effect.text"]`)).toBeNull()
  })
  it('the canvas reads which link has focus from React Flow\'s focusable edge wrapper; focus anywhere else is no link', () => {
    const host = document.createElement('div')
    host.innerHTML = '<svg><g class="react-flow__edge" data-id="a->b:plain" tabindex="0"><path></path></g></svg><button>x</button>'
    expect(focusedLinkOf(host.querySelector('g.react-flow__edge'))).toBe('a->b:plain')
    expect(focusedLinkOf(host.querySelector('path'))).toBe('a->b:plain')
    expect(focusedLinkOf(host.querySelector('button'))).toBeNull()
    expect(focusedLinkOf(null)).toBeNull()
  })
  it('CONTRAST: a link with no effect draws no strength words', () => {
    const plain = model.links.findIndex((l) => l.effect == null && l.kind !== 'reason')
    expect(edge(plain).querySelector('[data-view$=".effect.text"]')).toBeNull()
  })
})
