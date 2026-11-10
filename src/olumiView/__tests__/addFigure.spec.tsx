/**
 * R25 slice 2 (plan v3 phase 3, Paul's 6 Nov "the ability to manually edit seems to have disappeared"): add a figure card in the person's
 * own words. Core's contract (API.md R25): `POST …/figures { base, label, typed, unit?, op }` → 201 `{ version, n, receipt, record }`,
 * saved at once as their version. Offered on an approved board the person owns, on the live version; posted on the base it opened on;
 * core's receipt said; a refusal is core's own words and nothing reads as saved; the new card is put in front once drawn.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { View } from '../client'
import { useViewStore } from '../store'
import { AddFigure, focusWhenDrawn } from '../AddFigure'
import { setTeamFetch } from '../../olumiCore/team/api'
import { resetWrites } from '../../olumiCore/team/writes'
import { useMe } from '../../olumiCore/me'
import { useModelNotice } from '../notice'
import { useCanvasStore } from '../../canvas/store'
import { registerFocusHelpers } from '../../canvas/utils/focusHelpers'

const SID = 's_0123456789ab'
const approved: View = { ...JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/real', 'european-22cards.view3.json'), 'utf8')), id: SID }
const base = approved.model!.edit_base!

let calls: Array<{ method: string; path: string; body: unknown }> = []
let answer: { status: number; body: unknown } = { status: 201, body: { version: 9, n: 3, receipt: 'figures:9', record: 'weekly_churn' } }
const focused: string[] = []
let unregister: () => void = () => {}
beforeEach(() => {
  calls = []; focused.length = 0; answer = { status: 201, body: { version: 9, n: 3, receipt: 'figures:9', record: 'weekly_churn' } }
  setTeamFetch((async (u: unknown, init?: RequestInit) => {
    const method = init?.method ?? 'GET', p = String(u)
    calls.push({ method, path: p, body: init?.body ? JSON.parse(String(init.body)) : undefined })
    if (method === 'GET' && p === '/api/me') return new Response(JSON.stringify({ me: { id: approved.you_id, name: approved.you } }), { status: 200 })
    if (method === 'GET') return new Response(JSON.stringify(approved), { status: 200 })
    return new Response(JSON.stringify(answer.body), { status: answer.status })
  }) as unknown as typeof fetch)
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-0123456789ab', sid: SID, view: approved, status: 'ready', error: null, stale: false, at: null })
  useMe.setState({ me: { id: approved.you_id, name: approved.you }, status: 'ready' })
  unregister = registerFocusHelpers((id) => { focused.push(id) }, () => {})
})
afterEach(() => {
  cleanup(); setTeamFetch(null); resetWrites(); unregister(); useModelNotice.setState({ notice: null })
  useViewStore.setState({ uuid: null, sid: null, view: null, error: null, status: 'none' }); useMe.setState({ me: null } as never)
  useCanvasStore.setState({ nodes: [] } as never)
})
const posts = () => calls.filter((c) => c.method === 'POST')
const openFigure = () => {
  fireEvent.click(screen.getByTestId('canvas-add-to-model'))
  fireEvent.click(screen.getByRole('menuitem', { name: 'Add a figure' }))
}
const fill = (name: string, typed: string, unit = '') => {
  fireEvent.change(screen.getByTestId('view-add-figure-name'), { target: { value: name } })
  fireEvent.change(screen.getByTestId('view-add-figure-typed'), { target: { value: typed } })
  if (unit !== '') fireEvent.change(screen.getByTestId('view-add-figure-unit'), { target: { value: unit } })
}

describe('add a figure', () => {
  it('catch: posts core\'s contract on the base it opened on, the person\'s words trimmed and no unit when none; says core\'s version', async () => {
    render(<AddFigure />)
    openFigure()
    act(() => { useViewStore.setState({ view: { ...approved, model: { ...approved.model!, edit_base: base + 5 } } as View }) }) // a newer version lands
    fill('  Weekly churn ', ' 10 to 30 ')
    fireEvent.click(screen.getByTestId('view-add-figure-add'))
    await waitFor(() => expect(posts()).toHaveLength(1))
    expect(posts()[0]!.path).toBe(`/api/scenarios/${SID}/figures`)
    expect(posts()[0]!.body).toMatchObject({ base, label: 'Weekly churn', typed: '10 to 30' })
    expect(posts()[0]!.body).not.toHaveProperty('unit')
    await waitFor(() => expect(useModelNotice.getState().notice).toMatchObject({ kind: 'saved', n: 3, by: null })) // a direct edit: no "Approved by"
    await waitFor(() => expect(screen.queryByTestId('view-add-figure-form')).toBeNull())
    // Core's own record is the card brought in front, once drawn; another card drawn first is not.
    act(() => { useCanvasStore.setState({ nodes: [{ id: 'some_other_card', position: { x: 0, y: 0 }, data: {} }] } as never) })
    expect(focused).toEqual([])
    act(() => { useCanvasStore.setState({ nodes: [{ id: 'some_other_card', position: { x: 0, y: 0 }, data: {} }, { id: 'weekly_churn', position: { x: 0, y: 0 }, data: {} }] } as never) })
    expect(focused).toEqual(['weekly_churn'])
  })
  it('catch (PL 7 Nov): Cancel or Escape hands focus back to the toolbar "+", so a keyboard user keeps their place', () => {
    render(<AddFigure />)
    openFigure()
    fireEvent.click(screen.getByText('Cancel'))
    expect(document.activeElement).toBe(screen.getByTestId('canvas-add-to-model'))
    openFigure()
    fireEvent.keyDown(screen.getByTestId('view-add-figure-name'), { key: 'Escape' })
    expect(document.activeElement).toBe(screen.getByTestId('canvas-add-to-model'))
  })
  it('a unit, when given, goes as the person typed it (core reads it)', async () => {
    render(<AddFigure />)
    openFigure()
    fill('Weekly churn', '10 to 30', ' ticket/week ')
    fireEvent.click(screen.getByTestId('view-add-figure-add'))
    await waitFor(() => expect(posts()).toHaveLength(1))
    expect(posts()[0]!.body).toMatchObject({ unit: 'ticket/week' })
  })
  it('a refusal is core\'s own words; nothing reads as saved and the person\'s words stay in the form', async () => {
    answer = { status: 400, body: { error: 'For “Weekly churn”, type one number, or a range like 150 to 400.' } }
    render(<AddFigure />)
    openFigure()
    fill('Weekly churn', 'lots')
    fireEvent.click(screen.getByTestId('view-add-figure-add'))
    await waitFor(() => expect(screen.getByTestId('view-add-figure-error')).toHaveTextContent('For “Weekly churn”, type one number, or a range like 150 to 400.'))
    expect(useModelNotice.getState().notice).toBeNull()
    expect((screen.getByTestId('view-add-figure-typed') as HTMLInputElement).value).toBe('lots')
  })
  it('catch: the new card is put in front once the canvas draws it, not before', () => {
    focusWhenDrawn('weekly_churn')
    expect(focused).toEqual([])
    act(() => { useCanvasStore.setState({ nodes: [{ id: 'weekly_churn', position: { x: 0, y: 0 }, data: {} }] } as never) })
    expect(focused).toEqual(['weekly_churn'])
  })
  it('must not change: not offered while a proposal is held, on an earlier version, or on someone else\'s page', () => {
    for (const set of [
      () => useViewStore.setState({ view: { ...approved, model: { ...approved.model!, edit_base: null } } as View }),
      () => useViewStore.setState({ at: 2 }),
      () => useMe.setState({ me: { id: 'someone-else', name: 'Someone else' }, status: 'ready' } as never),
    ]) {
      set()
      expect(render(<AddFigure />).container.querySelector('[data-testid="canvas-add-to-model"]')).toBeNull()
      cleanup()
      useViewStore.setState({ view: approved, at: null }); useMe.setState({ me: { id: approved.you_id, name: approved.you }, status: 'ready' })
    }
    expect(render(<AddFigure />).container.querySelector('[data-testid="canvas-add-to-model"]')).not.toBeNull() // CONTRAST: offered here
  })
})
