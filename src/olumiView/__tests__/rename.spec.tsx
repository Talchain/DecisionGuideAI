/**
 * R25 rename, the first direct structural edit (core contract, DL 02:14Z): offered on an approved board in the panel beside a selected
 * card (never adding height to a card at rest), posted on the base it opened on, saved at once with core's version receipt; a refusal
 * is core's own words; a held proposal offers none (core: "approve or set aside the pending change first").
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { View } from '../client'
import { useViewStore } from '../store'
import { ViewCard } from '../../canvas/nodes/ViewCardNode'
import { setTeamFetch } from '../../olumiCore/team/api'
import { resetWrites } from '../../olumiCore/team/writes'
import { useMe } from '../../olumiCore/me'
import { useModelNotice } from '../notice'

const SID = 's_0123456789ab'
const approved: View = { ...JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/real', 'european-22cards.view3.json'), 'utf8')), id: SID }
const base = approved.model!.edit_base!
const card = approved.model!.cards.find((c) => c.family === 'option')!
const held = { ...approved, model: { ...approved.model!, edit_base: null } } as View

let calls: Array<{ method: string; path: string; body: unknown }> = []
let answer: { status: number; body: unknown } = { status: 201, body: { version: 9, n: 3, receipt: 'rename:9' } }
beforeEach(() => {
  calls = []; answer = { status: 201, body: { version: 9, n: 3, receipt: 'rename:9' } }
  setTeamFetch((async (u: unknown, init?: RequestInit) => {
    const method = init?.method ?? 'GET', p = String(u)
    calls.push({ method, path: p, body: init?.body ? JSON.parse(String(init.body)) : undefined })
    if (method === 'GET' && p === '/api/me') return new Response(JSON.stringify({ me: { id: approved.you_id, name: approved.you } }), { status: 200 })
    if (method === 'GET') return new Response(JSON.stringify(approved), { status: 200 })
    return new Response(JSON.stringify(answer.body), { status: answer.status })
  }) as unknown as typeof fetch)
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-0123456789ab', sid: SID, view: approved, status: 'ready', error: null, stale: false, at: null })
  useMe.setState({ me: { id: approved.you_id, name: approved.you }, status: 'ready' })
})
afterEach(() => { cleanup(); setTeamFetch(null); resetWrites(); useModelNotice.setState({ notice: null }); useViewStore.setState({ uuid: null, sid: null, view: null, error: null, status: 'none' }); useMe.setState({ me: null, status: 'none' }) })
const posts = () => calls.filter((c) => c.method === 'POST')

describe('rename a card', () => {
  it('catch: in the selected card\'s panel, prefilled with its name; posts core\'s contract on the opening base; says core\'s version', async () => {
    render(<ViewCard card={card} selected />)
    const open = screen.getByTestId(`view-rename-${card.id}`)
    expect(open.closest(`[data-view-more="${card.id}"]`)).not.toBeNull() // beside the card, never in its flow
    fireEvent.click(open)
    const input = screen.getByTestId(`view-rename-input-${card.id}`) as HTMLInputElement
    expect(input.value).toBe(card.heading)
    useViewStore.setState({ view: { ...approved, model: { ...approved.model!, edit_base: base + 5 } } as View }) // a newer version lands
    fireEvent.change(input, { target: { value: '  Hire a specialist  ' } })
    fireEvent.click(screen.getByTestId(`view-rename-save-${card.id}`))
    await waitFor(() => expect(posts()).toHaveLength(1))
    expect(posts()[0]!.path).toBe(`/api/scenarios/${SID}/rename`)
    expect(posts()[0]!.body).toMatchObject({ base, record: card.id, label: 'Hire a specialist' })
    await waitFor(() => expect(useModelNotice.getState().notice).toMatchObject({ kind: 'saved', n: 3, by: null })) // a direct edit: no "Approved by"
  })
  it('a refusal is core\'s own words, and nothing reads as saved', async () => {
    answer = { status: 409, body: { error: 'this was changed on a different version; reload and rename it again' } }
    render(<ViewCard card={card} selected />)
    fireEvent.click(screen.getByTestId(`view-rename-${card.id}`))
    fireEvent.change(screen.getByTestId(`view-rename-input-${card.id}`), { target: { value: 'New name' } })
    fireEvent.click(screen.getByTestId(`view-rename-save-${card.id}`))
    await waitFor(() => expect(screen.getByTestId(`view-rename-error-${card.id}`)).toHaveTextContent('this was changed on a different version; reload and rename it again'))
    expect(useModelNotice.getState().notice).toBeNull()
  })
  it('must not change: a held proposal (no edit base) offers no rename', () => {
    useViewStore.setState({ view: held })
    render(<ViewCard card={card} selected />)
    expect(screen.queryByTestId(`view-rename-${card.id}`)).toBeNull()
  })
})
