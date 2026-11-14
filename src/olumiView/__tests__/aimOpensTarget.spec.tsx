/**
 * DL 06:57Z (1): the first click after Approve. The aim card asks core's question ("What target would you set for …?", its `bound`) but had
 * no input; the editor was the ✎ on another card (the target's). Now the question itself opens THAT figure's editor: the target found by
 * core's own `target` line (model/targets.ts), the same editor, the same write (POST /edit with the target's id), core's words only.
 * Bound to the served View of a twin of Paul's copy (engine 4352bfa3, seed cut13, approved, target not yet set; AI off, 0 calls, 14 Nov).
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: {} }))
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ReactFlowProvider, type NodeProps } from '@xyflow/react'
import type { View, ViewCard } from '../client'
import { useViewStore } from '../store'
import { useMe } from '../../olumiCore/me'
import { CoreCard } from '../previous/CoreCard'
import { setTeamFetch } from '../../olumiCore/team/api'
import { resetWrites } from '../../olumiCore/team/writes'
import { openClearOf, REGION_GAP, type Regions } from '../regions'

const V1 = JSON.parse(readFileSync(path.resolve('src/olumiView/__tests__/fixtures/live-4352bfa3-twin-cut13-v1.view.json'), 'utf8')) as View
const aimOf = (v: View) => v.model!.cards.find((c) => c.family === 'goal')!
const targetOf = (v: View, aim: ViewCard) => v.model!.cards.find((c) => c.id === v.model!.links.find((l) => l.to === aim.id && l.title === 'target')!.from)!
const Node = CoreCard as unknown as (p: NodeProps) => JSX.Element
let calls: Array<{ method: string; path: string; body: unknown }> = []
const use = (view: View) => {
  setTeamFetch((async (u: unknown, init?: RequestInit) => {
    const method = init?.method ?? 'GET'; calls.push({ method, path: String(u), body: init?.body ? JSON.parse(String(init.body)) : undefined })
    if (method === 'GET') return new Response(JSON.stringify(String(u) === '/api/me' ? { me: { id: view.you_id, name: view.you } } : view), { status: 200 })
    return new Response(JSON.stringify({ version: 3, n: 3, receipt: 'r' }), { status: 201 })
  }) as unknown as typeof fetch)
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: view.id, view, status: 'ready', error: null, stale: false, at: null } as never)
  useMe.setState({ me: { id: view.you_id, name: view.you }, status: 'ready' })
}
const draw = (view: View, card: ViewCard) => render(<ReactFlowProvider><Node {...({ id: card.id, type: 'viewCard', data: { card, label: card.heading }, selected: false, dragging: false, zIndex: 0,
  isConnectable: false, positionAbsoluteX: 0, positionAbsoluteY: 0, selectable: true, deletable: false, draggable: false } as unknown as NodeProps)} /></ReactFlowProvider>).container
beforeEach(() => { calls = [] })
afterEach(() => { cleanup(); setTeamFetch(null); resetWrites(); useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none' } as never); useMe.setState({ me: null, status: 'none' }) })

describe('the aim\'s question opens its target\'s own editor', () => {
  const aim = aimOf(V1), target = targetOf(V1, aim)
  it('A1 precondition from the served View: the aim asks core\'s question (its bound), has no figure of its own, and its target card offers the edit', () => {
    expect([aim.figure, aim.bound!.text.length > 0, target.figure!.edit != null, V1.model!.edit_base !== null]).toEqual([null, true, true, true])
  })
  it('A1 the question, in core\'s words, is the control; pressing it opens the target\'s editor (core\'s prompt) on the aim card, focused', () => {
    use(V1); const el = draw(V1, aim)
    const opener = screen.getByTestId(`view-aim-edit-${target.id}`)
    expect(opener.querySelector(`[data-core-lead-clamp="${aim.id}"]`)?.textContent).toBe(aim.bound!.text)
    fireEvent.click(opener)
    const form = screen.getByTestId(`view-aim-form-${target.id}`)
    expect([form.getAttribute('data-figure-edit-panel'), form.querySelector('label')?.textContent, document.activeElement?.getAttribute('data-testid'), el.contains(form)])
      .toEqual([target.id, target.figure!.edit!.prompt, `view-aim-typed-${target.id}`, true])
  })
  it('A1 the same write as the target\'s ✎: POST /edit with the target\'s id, the version it opened on and the words as typed', async () => {
    use(V1); draw(V1, aim)
    fireEvent.click(screen.getByTestId(`view-aim-edit-${target.id}`))
    fireEvent.change(screen.getByTestId(`view-aim-typed-${target.id}`), { target: { value: '8 weeks' } })
    fireEvent.click(screen.getByTestId(`view-aim-set-${target.id}`))
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true))
    const post = calls.find((c) => c.method === 'POST')!
    expect([post.path.endsWith('/edit'), (post.body as { base: number }).base, (post.body as { quantity: string }).quantity, (post.body as { typed: string }).typed]).toEqual([true, V1.model!.edit_base, target.id, '8 weeks'])
  })
  it('A1 CONTRAST: where core offers no edit (a proposal held: no edit_base; or the target has no edit) the question is plain words, no control', () => {
    const held = structuredClone(V1) as View; held.model!.edit_base = null as never
    use(held); draw(held, aimOf(held)); expect(screen.queryByTestId(`view-aim-edit-${target.id}`)).toBeNull(); cleanup()
    const noEdit = structuredClone(V1) as View; targetOf(noEdit, aimOf(noEdit)).figure!.edit = null as never
    use(noEdit); const el = draw(noEdit, aimOf(noEdit))
    expect([screen.queryByTestId(`view-aim-edit-${target.id}`), el.querySelector(`[data-core-lead-clamp="${aim.id}"]`)?.textContent]).toEqual([null, aim.bound!.text])
  })
})

describe('an open figure editor stays above the window\'s foot', () => {
  const R: Regions = { head: { left: 0, right: 885, top: 0, bottom: 104 }, foot: [], dock: { left: 885, right: 1232, top: 0, bottom: 704 } }
  it('A2 a card in view whose editor runs past the foot moves up by the overrun (and the gap), its top staying below the head', () => {
    const card = { left: 300, right: 500, top: 420, bottom: 560 }, panel = { left: 300, right: 580, top: 564, bottom: 760 }
    expect(openClearOf(card, panel, R)).toEqual({ dx: 0, dy: -(760 - (704 - REGION_GAP)) })
  })
  it('A2 CONTRAST: an editor wholly in view moves nothing; a card with no editor open is not moved by the foot', () => {
    expect(openClearOf({ left: 300, right: 500, top: 200, bottom: 340 }, { left: 300, right: 580, top: 344, bottom: 520 }, R)).toEqual({ dx: 0, dy: 0 })
    expect(openClearOf({ left: 300, right: 500, top: 600, bottom: 700 }, undefined, R)).toEqual({ dx: 0, dy: 0 })
  })
})
