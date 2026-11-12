import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { Position, ReactFlowProvider } from '@xyflow/react'
import { ViewLinkEdge } from '../ViewLinkEdge'
import { EdgeLabelLayer } from '../../../olumiView/__tests__/edgeLabelLayer'
import type { ViewLink } from '../../../olumiView/client'
import { useViewStore } from '../../../olumiView/store'
import proposal from '../../../olumiView/golden/proposal.view.json'

type Causal = NonNullable<ViewLink['causal']>
// Synthetic rows of the producer contract, not invented causal measurements or a saved user's model.
const causal = (sign: Causal['sign'], state: Causal['strength']['state'] = 'sized', disputed = false): Causal => ({
  sign, of: 'more_of_from', target: 'b', disputed, author: { by: 'person', text: "Sam's figure", title: 'Sam supplied this provisional link.' },
  strength: { state, figure: state === 'sized' ? 'coefficient' : null, low: state === 'sized' ? (sign === 'increases' ? 1 : sign === 'decreases' ? -1 : sign === 'unknown' ? -1 : 0) : null, likely: null, high: state === 'sized' ? (sign === 'increases' ? 1 : sign === 'decreases' ? -1 : sign === 'unknown' ? 1 : 0) : null, unit: null, per: 'a', share: null, relative_to: null },
  text: 'In this model, its direction is as stated here. This is provisional.',
})
const draw = (c: Causal | null, changes: Partial<ViewLink> = {}) => {
  const link = { from: 'a', to: 'b', kind: 'plain', label: '', title: 'The original source words.', doubt: false, alert: false, proposed: false,
    effect: null, remove: null, holds: null, records: [], causal: c, ...changes } as unknown as ViewLink
  const Edge = ViewLinkEdge as unknown as (p: Record<string, unknown>) => JSX.Element
  const r = render(<ReactFlowProvider><EdgeLabelLayer><svg><Edge id="e" source="a" target="b" sourceX={0} sourceY={0} targetX={0} targetY={240}
    sourcePosition={Position.Bottom} targetPosition={Position.Top} data={{ link, i: 0 }} selected /></svg></EdgeLabelLayer></ReactFlowProvider>).container
  const p = r.querySelector<SVGPathElement>('path.react-flow__edge-path')!
  return { r, p }
}
afterEach(() => { cleanup(); useViewStore.setState({ view: null }) })

describe('a link renders the typed causal meaning, with no inferred strength scale', () => {
  it.each([['increases', '#62B290', '−'], ['decreases', '#D6336C', '+'], ['none', 'var(--edge-neutral)', '+'], ['unknown', 'var(--text-light)', '+']] as const)
    ('%s uses the producer sign, even when a legacy label suggests another direction', (sign, stroke, label) => {
      const got = draw(causal(sign), { label })
      expect(got.p.style.stroke).toBe(stroke)
      expect(got.r.querySelector('[data-view="links.0.label"]')).toBeNull()
      const glyph = got.r.querySelector('[data-view-link-sign] path')
      expect(glyph?.getAttribute('d') ?? null).toBe(sign === 'increases' ? 'M1 6H11M6 1V11' : sign === 'decreases' ? 'M1 6H11' : null)
    })
  it('an actual sized zero is neutral and solid, while an unsized or words-only link is dashed', () => {
    expect(draw(causal('none')).p.style.strokeDasharray).toBe('')
    for (const state of ['unsized', 'in_words'] as const) {
      cleanup(); expect(draw(causal('unknown', state)).p.style.strokeDasharray).toBe('5 5')
    }
  })
  it('pending and disputed links retain their provisional cue, alongside their typed direction and the source words', () => {
    const pending = draw(causal('increases'), { proposed: true })
    expect([pending.p.style.stroke, pending.p.style.strokeDasharray]).toEqual(['#62B290', '5 5'])
    cleanup()
    const disputed = draw(causal('decreases', 'sized', true))
    expect(disputed.p.style.strokeDasharray).toBe('5 5')
    expect(disputed.r.querySelector('g[data-view-link]')?.getAttribute('data-causal-disputed')).toBe('true')
    expect(disputed.r.querySelector('g[data-view-link] > title')?.textContent).toContain('Sam supplied this provisional link.')
    expect(disputed.r.querySelector('g[data-view-link] > title')?.textContent).toContain('The original source words.')
  })
  it('the same default line width holds for different supplied magnitudes: no relative width is manufactured', () => {
    for (const n of [1e-12, 1e12]) {
      const c = causal('increases'); Object.assign(c.strength, { low: n, high: n, likely: n })
      cleanup(); expect(draw(c).p.style.strokeWidth).toBe('1.5')
    }
  })
  it('a size does not erase core\'s doubt or Olumi\'s authorship; the sign keeps its direction colour', () => {
    const c = causal('increases'); c.author = { by: 'olumi', text: 'Olumi inferred', title: 'Olumi proposed this link.' }
    const got = draw(c, { doubt: true })
    expect([got.p.style.stroke, got.p.style.strokeDasharray]).toEqual(['var(--semantic-info)', '5 5'])
    expect((got.r.querySelector('[data-view-link-sign]') as SVGElement).style.color).toBe('rgb(98, 178, 144)')
  })
  it('a noncausal line retains its existing treatment; an alert retains its priority', () => {
    expect(draw(null, { label: '+', doubt: true }).p.style.stroke).toBe('#62B290')
    cleanup()
    expect(draw(causal('decreases'), { alert: true }).p.style.stroke).toBe('var(--olumi-mark-orange)')
  })
  it('the challenge glyph is hoverable and named with core\'s own legend word', () => {
    useViewStore.setState({ view: proposal as unknown as NonNullable<ReturnType<typeof useViewStore.getState>['view']> })
    const glyph = draw(null, { label: '!' }).r.querySelector('[data-view="links.0.label"]') as HTMLElement
    expect(glyph).toHaveAccessibleName('challenge')
    expect(glyph).toHaveAttribute('title', 'challenge')
    expect(glyph.style.pointerEvents).toBe('auto')
  })
})
