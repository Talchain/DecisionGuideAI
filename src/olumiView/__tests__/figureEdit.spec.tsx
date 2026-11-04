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

describe('lane C: a card reads heading and figure first', () => {
  it('core\'s detail line is at most two lines, its whole words on hover; the figure\'s control keeps its place but shows only on hover, focus or selection', async () => {
    const { QUIET } = await import('../FigureEdit')
    const detailed = view.model!.cards.find((c) => c.detail !== '')!
    const quiet = render(<ViewCard card={card} />).container
    expect(quiet.querySelector(`[data-testid="view-figure-edit-${card.id}"]`)?.className).toContain(QUIET)
    quiet.remove()
    const chosen = render(<ViewCard card={card} selected />).container
    expect(chosen.querySelector(`[data-testid="view-figure-edit-${card.id}"]`)?.className).not.toContain(QUIET)
    chosen.remove()
    const d = render(<ViewCard card={detailed} />).container.querySelector<HTMLElement>(`[data-view="${detailed.id}.detail"]`)!
    expect(d.textContent).toBe(detailed.detail)
    expect(d.getAttribute('title')).toBe(detailed.detail)
    expect(d.className).toContain('line-clamp-2')
  })
})

describe('an Olumi estimate reads as Olumi\'s at a glance (core L1/L2)', () => {
  it('a figure card core marks ◆: the figure in Olumi\'s colour with core\'s mark on hover, and "✎ Give yours" always shown; a person\'s figure is neither', async () => {
    const { QUIET } = await import('../FigureEdit')
    const est = view.model!.cards.find((c) => c.family === 'quantity' && c.olumi?.glyph === '◆' && c.figure?.edit)!
    const theirs = view.model!.cards.find((c) => c.family === 'quantity' && c.olumi === null && c.figure?.edit)!
    const a = render(<ViewCard card={est} />).container
    const fig = a.querySelector<HTMLElement>(`[data-view="${est.id}.figure.text"]`)!
    expect(fig.textContent).toBe(est.figure!.text)
    expect(fig.getAttribute('data-olumi')).toBe('true')
    expect(fig.className).toContain('text-info')
    expect(fig.getAttribute('title')).toBe(`${est.figure!.title} · ${est.olumi!.title}`)
    const give = a.querySelector(`[data-testid="view-figure-edit-${est.id}"]`)!
    expect(give.textContent).toBe('✎ Give yours')
    expect(give.className).not.toContain(QUIET)
    a.remove()
    const b = render(<ViewCard card={theirs} />).container
    expect(b.querySelector(`[data-view="${theirs.id}.figure.text"]`)?.hasAttribute('data-olumi')).toBe(false)
    expect(b.querySelector(`[data-testid="view-figure-edit-${theirs.id}"]`)?.textContent).toBe('Change figure')
  })
})

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
    await waitFor(() => expect(calls.some((c) => c.method === 'GET' && c.path === `/api/scenarios/${SID}/view?schema=3`)).toBe(true))
    expect(posts()).toEqual([{ method: 'POST', path: `/api/scenarios/${SID}/edit`,
      body: { base: view.model!.edit_base, quantity: card.id, typed: ' 150 to 400 ', op: expect.stringMatching(/^[A-Za-z0-9-]{8,64}$/) } }])
    await waitFor(() => expect(screen.queryByTestId(`view-figure-form-${card.id}`)).toBeNull())
  })

  it('saved, but the View could not be read after it: the card says so and keeps the editor, never the old figure as current (review 00004 ledger)', async () => {
    setTeamFetch((async (u: unknown, init?: RequestInit) => {
      const method = init?.method ?? 'GET'
      calls.push({ method, path: String(u), body: undefined })
      if (method === 'GET' && String(u) === '/api/me') return new Response(JSON.stringify({ me: { id: view.you_id, name: view.you } }), { status: 200 })
      if (method === 'GET') return new Response('{', { status: 200 })
      return new Response(JSON.stringify({ version: 2, n: 2, receipt: 'r' }), { status: 201 })
    }) as unknown as typeof fetch)
    render(<ViewCard card={card} />)
    fireEvent.click(screen.getByTestId(`view-figure-edit-${card.id}`))
    fireEvent.change(screen.getByTestId(`view-figure-typed-${card.id}`), { target: { value: '150' } })
    fireEvent.click(screen.getByTestId(`view-figure-set-${card.id}`))
    await waitFor(() => expect(screen.getByTestId(`view-figure-error-${card.id}`)).toHaveTextContent('Saved, but Olumi could not show it just now. Reload the page to see it.'))
    expect(screen.getByTestId(`view-figure-form-${card.id}`)).toBeInTheDocument()
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
