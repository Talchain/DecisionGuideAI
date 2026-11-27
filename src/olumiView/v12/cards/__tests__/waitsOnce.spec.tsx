/**
 * Said once (Paul's 19 Nov hiring re-test: the same Olumi figure "not yet sized" stood on all four option cards). Fixture: core 78c3afc4's own café shape
 * (src/view/__tests__/waits-said-once.test.ts, every option waits on one Olumi figure), written out by viewOf with zero provider calls
 * (fixtures/core-78c3afc4/cafe-waits.view3.json). Core no longer sends a per-option "Still unresolved"; the page says nothing on each option and lists
 * the figure once in what results need; where core's step differs per option, each keeps its own; an identical old step is said once, on the aim.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('../../../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: {} }))
vi.mock('@xyflow/react', async () => ({ ...(await vi.importActual<object>('@xyflow/react')), Handle: () => null }))
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, render } from '@testing-library/react'
import { ReactFlowProvider, type NodeProps } from '@xyflow/react'
import type { View, ViewCard } from '../../../client'
import { useViewStore } from '../../../store'
import { useMe } from '../../../../olumiCore/me'
import { CoreCard } from '../../../previous/CoreCard'
import { setDefaultLevel, useSimpleLevel, type Level } from '../../simpleStore'
import { checkNeedsOf } from '../../../check/items'
const load = (f: string) => JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures', f), 'utf8')) as View
const CAFE = load('core-78c3afc4/cafe-waits.view3.json')
const cardOf = (v: View, id: string): ViewCard => v.model!.cards.find((c) => c.id === id)!
const Node = CoreCard as unknown as (p: NodeProps) => JSX.Element
const draw = (view: View, id: string, level: Level): HTMLElement => {
  setDefaultLevel(level)
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: view.id, view, status: 'ready', error: null, stale: false, at: null } as never)
  useMe.setState({ me: { id: view.you_id, name: view.you }, status: 'ready' })
  return render(<ReactFlowProvider><Node {...({ id, type: 'viewCard', data: { card: cardOf(view, id) }, selected: false, dragging: false, zIndex: 0, isConnectable: false,
    positionAbsoluteX: 0, positionAbsoluteY: 0, selectable: true, deletable: false, draggable: false } as unknown as NodeProps)} /></ReactFlowProvider>).container
}
beforeEach(() => { window.localStorage.clear(); useSimpleLevel.setState({ levels: {} }) })
afterEach(() => { cleanup(); setDefaultLevel('simple'); useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none' } as never); useMe.setState({ me: null, status: 'none' }) })
const opts = CAFE.model!.cards.filter((c) => c.kind === 'option').map((c) => c.id)
const unresolvedOn = (v: View, level: Level) => opts.map((id) => { const n = (draw(v, id, level).textContent ?? '').split('Still unresolved').length - 1; cleanup(); return n })
describe('core 78c3afc4 café (every option waits on one Olumi figure): the UI says it once', () => {
  it('W1 no option card says "Still unresolved" at either level; the run lists the figure once', () => {
    expect(opts).toHaveLength(4)
    for (const level of ['simple', 'working'] as const) expect([level, unresolvedOn(CAFE, level)]).toEqual([level, [0, 0, 0, 0]])
    const waits = checkNeedsOf(CAFE.model!).filter((p) => p.kind === 'waits').map((p) => p.key)
    expect(waits).toEqual(['waits:tip_gain'])
  })
  const withAdd = (add: (id: string) => string): View => ({ ...CAFE, model: { ...CAFE.model!, cards: CAFE.model!.cards.map((c) => (c.kind === 'option' ? { ...c, headline: { ...(c as { headline: object }).headline, add: add(c.id) } } : c)) } } as View)
  it('W2 CONTRAST: an option whose own step differs keeps its own line (the probe reads the field)', () => {
    expect(unresolvedOn(withAdd((id) => `Still unresolved: ${id}.`), 'working')).toEqual([1, 1, 1, 1])
  })
  it('W3 CONTRAST: core\'s old identical per-option line is said once, on the aim, never on each option', () => {
    const old = withAdd(() => 'Still unresolved: tips change.')
    expect(unresolvedOn(old, 'working')).toEqual([0, 0, 0, 0])
    const aim = (draw(old, 'aim_tips', 'working').textContent ?? '').split('Still unresolved').length - 1
    expect(aim).toBe(1)
  })
})
