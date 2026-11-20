import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
vi.mock('../../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: {} }))
import { cleanup, render } from '@testing-library/react'
import { Position, ReactFlowProvider } from '@xyflow/react'
import { ViewLinkEdge } from '../ViewLinkEdge'
import { EdgeLabelLayer } from '../../../olumiView/__tests__/edgeLabelLayer'
import type { ViewLink } from '../../../olumiView/client'
import { useViewStore } from '../../../olumiView/store'
import { DOUBT_DASH, effectStroke } from '../../../olumiView/v12/links/styles'
import type { KeyItem } from '../../../olumiView/v12/fields/fields'
import proposal from '../../../olumiView/golden/proposal.view.json'

type Causal = NonNullable<ViewLink['causal']>
// Synthetic rows of the producer contract, not invented causal measurements or a saved user's model.
const causal = (sign: Causal['sign'], state: Causal['strength']['state'] = 'sized', disputed = false): Causal => ({
  sign, of: 'more_of_from', target: 'b', disputed, author: { by: 'person', text: "Sam's figure", title: 'Sam supplied this provisional link.' },
  strength: { state, figure: state === 'sized' ? 'coefficient' : null, low: state === 'sized' ? (sign === 'increases' ? 1 : sign === 'decreases' ? -1 : sign === 'unknown' ? -1 : 0) : null, likely: null, high: state === 'sized' ? (sign === 'increases' ? 1 : sign === 'decreases' ? -1 : sign === 'unknown' ? 1 : 0) : null, unit: null, per: 'a', share: null, relative_to: null },
  text: 'In this model, its direction is as stated here. This is provisional.',
})
const draw = (c: Causal | null, changes: Partial<ViewLink> & { label_key?: unknown } = {}) => {
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
  // DS edge polarity: a modelled effect's colour is its direction (positive, negative, neutral for none/unknown); an arrowhead; no +/- glyph. The
  // sign is still the producer's (data-causal-sign), never the legacy label's; "unknown" is its own small icon (D4).
  it.each([['increases'], ['decreases'], ['none'], ['unknown']] as const)
    ('%s is drawn in its direction colour with an arrowhead, its sign read from the producer and never from a legacy label', (sign) => {
      const got = draw(causal(sign), { label: sign === 'increases' ? '−' : '+' })
      expect(got.p.style.stroke).toBe(effectStroke(sign))
      expect(got.r.querySelector('g[data-view-link]')?.getAttribute('data-causal-sign')).toBe(sign)
      expect(got.r.querySelector('g[data-view-link]')?.getAttribute('data-link-end')).toBe('arrow')
      expect(got.r.querySelector('[data-view="links.0.label"]')).toBeNull()
      expect(got.r.querySelector('[data-view-link-sign]')).toBeNull()
      const unsettled = document.body.querySelector('[data-view-link-unsettled="links.0"]')
      // CHANGED BY DESIGN (the lead's D4, 17 Nov: no verdict is grey with its own small icon): the "unknown" badge is a Lucide icon, not a "?" text glyph.
      if (sign === 'unknown') expect([unsettled?.textContent, unsettled?.querySelector('svg') !== null]).toEqual(['', true]); else expect(unsettled).toBeNull()
    })
  it('a link is dashed only where core doubts it: a sized zero, an unsized or a words-only link is solid', () => {
    expect(draw(causal('none')).p.style.strokeDasharray).toBe('')
    for (const state of ['unsized', 'in_words'] as const) {
      cleanup(); expect(draw(causal('unknown', state)).p.style.strokeDasharray).toBe('')
    }
    cleanup(); expect(draw(causal('increases'), { doubt: true }).p.style.strokeDasharray).toBe(DOUBT_DASH)
  })
  it('a pending link is solid, a disputed one keeps its marker and words, and a doubted one is the one that is dashed', () => {
    const pending = draw(causal('increases'), { proposed: true })
    expect([pending.p.style.stroke, pending.p.style.strokeDasharray]).toEqual([effectStroke('increases'), ''])
    expect(pending.r.querySelector('g[data-view-link]')?.getAttribute('data-proposed')).toBe('true')
    cleanup()
    const disputed = draw(causal('decreases', 'sized', true), { doubt: true })
    expect(disputed.p.style.strokeDasharray).toBe(DOUBT_DASH)
    expect(disputed.r.querySelector('g[data-view-link]')?.getAttribute('data-causal-disputed')).toBe('true')
    expect(disputed.r.querySelector('g[data-view-link] > title')?.textContent).toContain('Sam supplied this provisional link.')
    expect(disputed.r.querySelector('g[data-view-link] > title')?.textContent).toContain('The original source words.')
  })
  it('the same default line width holds for different supplied magnitudes: no relative width is manufactured (R1, 16 Nov: the default is production\'s thinnest rung, 2 px)', () => {
    for (const n of [1e-12, 1e12]) {
      const c = causal('increases'); Object.assign(c.strength, { low: n, high: n, likely: n })
      cleanup(); expect(draw(c).p.style.strokeWidth).toBe('2')
    }
  })
  it('a size does not erase core\'s doubt or Olumi\'s authorship: the line is dashed by doubt, and Olumi\'s mark is on it, with its direction colour', () => {
    const c = causal('increases'); c.author = { by: 'olumi', text: 'Olumi inferred', title: 'Olumi proposed this link.' }
    const got = draw(c, { doubt: true })
    expect([got.p.style.stroke, got.p.style.strokeDasharray]).toEqual([effectStroke('increases'), DOUBT_DASH])
    expect(got.r.querySelector('[data-view-link-olumi-mark="links.0"]')).not.toBeNull()
    expect(got.r.querySelector('[data-view-link-sign]')).toBeNull()
  })
  it('a noncausal line is plain (R5, 16 Nov): 2 px and neutral, its "+" label colours nothing and only doubt dashes it; an alert is a halo, never the line\'s colour (panel-visual L4)', () => {
    const plain = draw(null, { label: '+', doubt: true })
    expect([plain.p.style.stroke, plain.p.style.strokeWidth, plain.p.style.strokeDasharray]).toEqual(['var(--edge-neutral)', '2', DOUBT_DASH])
    cleanup()
    expect(draw(null, { label: '+' }).p.style.stroke, 'an effect\'s colour is never borrowed for a line with no typed causal').toBe('var(--edge-neutral)')
    cleanup()
    const alerted = draw(causal('decreases'), { alert: true })
    expect([alerted.p.style.stroke, alerted.r.querySelector('g[data-view-link]')?.getAttribute('data-link-halo')]).toEqual([effectStroke('decreases'), 'alert'])
  })
  it('the challenge glyph is hoverable and named with core\'s own legend word', () => {
    useViewStore.setState({ view: proposal as unknown as NonNullable<ReturnType<typeof useViewStore.getState>['view']> })
    const glyph = draw(null, { label: '!' }).r.querySelector('[data-view="links.0.label"]') as HTMLElement
    expect(glyph).toHaveAccessibleName('challenge')
    expect(glyph).toHaveAttribute('title', 'challenge')
    expect(glyph.style.pointerEvents).toBe('auto')
  })
  it.each(['❝', '✓', '⊢'])('the legacy %s glyph carries the word core supplies in its key', (label) => {
    const view = structuredClone(proposal)
    const entry = view.model!.key.find((k) => k.glyph === label)!
    expect(entry).toBeDefined()
    useViewStore.setState({ view: view as unknown as NonNullable<ReturnType<typeof useViewStore.getState>['view']> })
    const glyph = draw(null, { label }).r.querySelector('[data-view="links.0.label"]') as HTMLElement
    expect(glyph).toHaveAccessibleName(entry.text)
    expect(glyph).toHaveAttribute('title', entry.text)
    expect(glyph.style.pointerEvents).toBe('auto')
  })
  // Typed field 12 (19 Nov): core names the key item a mark draws (`label_key`); the rows above have no field, as an older core sends, and read by glyph.
  const withKey = (edit?: (key: KeyItem[]) => void) => {
    const view = structuredClone(proposal) as unknown as NonNullable<ReturnType<typeof useViewStore.getState>['view']>
    edit?.(view.model!.key)
    useViewStore.setState({ view })
  }
  const glyphOf = (r: HTMLElement) => r.querySelector('[data-view="links.0.label"]') as HTMLElement
  it('an influence\'s "+" that core says is no key item (label_key null) draws the "+" with no "added" word', () => {
    withKey()
    const plus = glyphOf(draw(null, { label: '+', label_key: null }).r)
    expect(plus).toHaveTextContent('+')
    expect(plus).not.toHaveAttribute('title')
    expect(plus).not.toHaveAttribute('aria-label')
    expect(plus).not.toHaveAttribute('role')
    cleanup()
    expect(glyphOf(draw(null, { label: '+' }).r), 'CONTRAST: the same "+" from an older core (no field) still reads its glyph').toHaveAccessibleName('added')
  })
  it('an evidence link with label_key "evidence" reads the evidence key\'s text, by id even where another item shares its glyph', () => {
    withKey()
    expect(glyphOf(draw(null, { label: '✓', label_key: 'evidence' }).r)).toHaveAccessibleName('evidence')
    cleanup()
    withKey((key) => { key.unshift({ id: 'test-shadow', glyph: key.find((k) => k.id === 'evidence')!.glyph, text: 'shadow' }) })
    const ev = glyphOf(draw(null, { label: '✓', label_key: 'evidence' }).r)
    expect(ev).toHaveAccessibleName('evidence')
    expect(ev).toHaveAttribute('title', 'evidence')
  })
  it('a label_key core\'s key does not hold, or one that is not a string, gives no key word and is never matched by glyph', () => {
    withKey()
    for (const label_key of ['test-missing', 7]) {
      cleanup()
      const g = glyphOf(draw(null, { label: '✓', label_key: label_key as unknown as string }).r) // a number on purpose: a View from outside the contract
      expect([g.getAttribute('title'), g.getAttribute('aria-label')]).toEqual([null, null])
    }
  })
  it('a new core legend glyph needs no UI word table', () => {
    const view = structuredClone(proposal)
    view.model!.key.push({ id: 'test-note', glyph: '§', text: 'provisional note' })
    useViewStore.setState({ view: view as unknown as NonNullable<ReturnType<typeof useViewStore.getState>['view']> })
    const glyph = draw(null, { label: '§' }).r.querySelector('[data-view="links.0.label"]') as HTMLElement
    expect(glyph).toHaveAccessibleName('provisional note')
    expect(glyph).toHaveAttribute('title', 'provisional note')
  })
})
