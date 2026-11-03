/**
 * G4: the person's own figure, changed on its card through core's edit route as typed (API v1.9 `typed`). Offered exactly where core
 * offers it (`figure.edit`), labelled with core's prompt; core's refusal (the card's `figure.edit.ask`) shown on the card; nothing parsed
 * here. Core's golden (wip/v3.1-one 8d25761).
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

const SID = 's_0123456789ab'
const golden = (n: string): View => ({ ...JSON.parse(readFileSync(path.resolve('src/olumiView/golden', `${n}.view.json`), 'utf8')), id: SID })
const view = golden('european')
const card = view.model!.cards.find((c) => c.figure?.edit)!
const plain = view.model!.cards.find((c) => c.figure !== null && c.figure.edit === null)

let calls: Array<{ method: string; path: string; body: unknown }> = []
let answer: { status: number; body: unknown } = { status: 201, body: { version: 2, n: 2, receipt: 'r' } }
beforeEach(() => {
  calls = []
  answer = { status: 201, body: { version: 2, n: 2, receipt: 'r' } }
  setTeamFetch((async (u: unknown, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    calls.push({ method, path: String(u), body: init?.body ? JSON.parse(String(init.body)) : undefined })
    if (method === 'GET' && String(u) === '/api/me') return new Response(JSON.stringify({ me: { id: view.you_id, name: view.you } }), { status: 200 })
    if (method === 'GET') return new Response(JSON.stringify(view), { status: 200 })
    return new Response(JSON.stringify(answer.body), { status: answer.status })
  }) as unknown as typeof fetch)
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-0123456789ab', sid: SID, view, status: 'ready', error: null, stale: false })
  useMe.setState({ me: { id: view.you_id, name: view.you }, status: 'ready' })
})
afterEach(() => { cleanup(); setTeamFetch(null); resetWrites(); useViewStore.setState({ uuid: null, sid: null, view: null, error: null, status: 'none' }); useMe.setState({ me: null, status: 'none' }) })

const posts = () => calls.filter((c) => c.method === 'POST')

describe('a figure the person may set', () => {
  it('is offered exactly where core offers it, labelled with core\'s prompt', () => {
    render(<ViewCard card={card} />)
    fireEvent.click(screen.getByTestId(`view-figure-edit-${card.id}`))
    expect(screen.getByLabelText(card.figure!.edit!.prompt)).toBeInTheDocument()
    cleanup()
    if (plain) { render(<ViewCard card={plain} />); expect(screen.queryByTestId(`view-figure-edit-${plain.id}`)).toBeNull() }
  })

  it('is not offered while core holds no version to edit (a proposal waits), nor on a View for someone else', () => {
    useViewStore.setState({ view: { ...view, model: { ...view.model!, edit_base: null } } })
    const { rerender } = render(<ViewCard card={card} />)
    expect(screen.queryByTestId(`view-figure-edit-${card.id}`)).toBeNull()
    useViewStore.setState({ view })
    useMe.setState({ me: { id: 'p_someone_else', name: 'X' }, status: 'ready' })
    rerender(<ViewCard card={card} />)
    expect(screen.queryByTestId(`view-figure-edit-${card.id}`)).toBeNull()
  })

  it('goes to core\'s edit route exactly as typed, against the version shown, with its op; then the View is read again', async () => {
    render(<ViewCard card={card} />)
    fireEvent.click(screen.getByTestId(`view-figure-edit-${card.id}`))
    fireEvent.change(screen.getByTestId(`view-figure-typed-${card.id}`), { target: { value: ' 150 to 400 ' } })
    fireEvent.click(screen.getByTestId(`view-figure-set-${card.id}`))
    await waitFor(() => expect(calls.some((c) => c.method === 'GET' && c.path === `/api/scenarios/${SID}/view`)).toBe(true))
    expect(posts()).toEqual([{ method: 'POST', path: `/api/scenarios/${SID}/edit`,
      body: { base: view.model!.edit_base, quantity: card.id, typed: ' 150 to 400 ', op: expect.stringMatching(/^[A-Za-z0-9-]{8,64}$/) } }])
    await waitFor(() => expect(screen.queryByTestId(`view-figure-form-${card.id}`)).toBeNull())
  })

  it('a figure core cannot read: core\'s own ask, on the card; nothing is read again', async () => {
    answer = { status: 400, body: { error: card.figure!.edit!.ask } }
    render(<ViewCard card={card} />)
    fireEvent.click(screen.getByTestId(`view-figure-edit-${card.id}`))
    fireEvent.change(screen.getByTestId(`view-figure-typed-${card.id}`), { target: { value: 'lots' } })
    fireEvent.click(screen.getByTestId(`view-figure-set-${card.id}`))
    await waitFor(() => expect(screen.getByTestId(`view-figure-error-${card.id}`)).toHaveTextContent(card.figure!.edit!.ask))
    expect(calls.some((c) => c.method === 'GET' && c.path.includes('/view'))).toBe(false)
  })
})
