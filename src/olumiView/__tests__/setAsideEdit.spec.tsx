/**
 * R25 set aside and edit (Paul's 6 Nov test: "I can't find manual editing"; on his finish line, DL 7 Nov). While a proposal is held core
 * offers no edit, so ✎ offers to set it aside: it shows core's heading and base, sets it aside on the press, reads the View again and
 * opens the editor on the base that read returns. Two receipts: set aside, then core's saved version; an edit refused after the set-aside
 * shows both the set-aside and core's refusal, never a saved figure (the PL/DL acceptance row).
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
import { ASIDE_WORDS, useAsideEdit } from '../FigureEdit'

const SID = 's_0123456789ab'
const approved: View = { ...JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/real', 'european-22cards.view3.json'), 'utf8')), id: SID }
const base = approved.model!.edit_base!
const card = approved.model!.cards.find((c) => c.figure?.edit)!
// The same board with Olumi's proposal held, as core serves it: no edit anywhere (`edit_base` null), the proposal on the approved base.
const proposal = { id: 41, base, heading: 'Olumi proposes 3 changes', on: 'on version 1', removed: null, problem: null, marks: [], changes: [], groups: null, from: null }
const held = { ...approved, proposal, model: { ...approved.model!, edit_base: null, cards: approved.model!.cards.map((c) => (c.figure ? { ...c, figure: { ...c.figure, edit: null } } : c)) } } as unknown as View
const added = { ...held, model: { ...held.model!, cards: held.model!.cards.map((c) => (c.id === card.id ? { ...c, change: { glyph: '+', title: 'Proposed addition', kind: 'added' } } : c)) } } as unknown as View

let calls: Array<{ method: string; path: string; body: unknown }> = []
let served: View = held
let editAnswer: { status: number; body: unknown } = { status: 201, body: { version: 9, n: 2, receipt: 'approve:42' } }
beforeEach(() => {
  calls = []; served = held; editAnswer = { status: 201, body: { version: 9, n: 2, receipt: 'approve:42' } }
  setTeamFetch((async (u: unknown, init?: RequestInit) => {
    const method = init?.method ?? 'GET', p = String(u)
    calls.push({ method, path: p, body: init?.body ? JSON.parse(String(init.body)) : undefined })
    if (method === 'GET' && p === '/api/me') return new Response(JSON.stringify({ me: { id: approved.you_id, name: approved.you } }), { status: 200 })
    if (method === 'GET') return new Response(JSON.stringify(served), { status: 200 })
    if (p.endsWith('/discard')) { served = approved; return new Response(JSON.stringify({ receipt: 'discard:41' }), { status: 200 }) }
    return new Response(JSON.stringify(editAnswer.body), { status: editAnswer.status })
  }) as unknown as typeof fetch)
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-0123456789ab', sid: SID, view: held, status: 'ready', error: null, stale: false, at: null })
  useMe.setState({ me: { id: approved.you_id, name: approved.you }, status: 'ready' })
})
afterEach(() => { cleanup(); setTeamFetch(null); resetWrites(); useAsideEdit.setState({ id: null }); useModelNotice.setState({ notice: null }); useViewStore.setState({ uuid: null, sid: null, view: null, error: null, status: 'none' }); useMe.setState({ me: null, status: 'none' }) })

/** The card as the canvas draws it: from the View held now, so a re-read redraws it. */
function Live({ id }: { id: string }) { const v = useViewStore((s) => s.view)!; return <ViewCard card={v.model!.cards.find((c) => c.id === id)!} /> }
const posts = () => calls.filter((c) => c.method === 'POST')

async function setAside() {
  render(<Live id={card.id} />)
  fireEvent.click(screen.getByTestId(`view-figure-aside-edit-${card.id}`))
  // What is set aside, in core's words, before anything is sent.
  const offer = screen.getByTestId(`view-figure-aside-${card.id}`)
  expect(offer.querySelector('[data-view="proposal.heading"]')).toHaveTextContent(proposal.heading)
  expect(offer.querySelector('[data-view="proposal.on"]')).toHaveTextContent(proposal.on)
  expect(posts()).toEqual([])
  fireEvent.click(screen.getByTestId(`view-figure-aside-confirm-${card.id}`))
  await waitFor(() => expect(screen.getByTestId(`view-figure-form-${card.id}`)).toBeInTheDocument())
  expect(screen.getByTestId(`view-figure-aside-done-${card.id}`)).toHaveTextContent(ASIDE_WORDS.done)
}

describe('✎ while a proposal is held: set aside, then edit on the base core returns', () => {
  it('catch: the offer shows core\'s heading and base; the press sets aside, then the editor opens; the edit posts on the fresh base and says core\'s version', async () => {
    await setAside()
    expect(posts().map((c) => c.path)).toEqual([`/api/proposals/${proposal.id}/discard`])
    fireEvent.change(screen.getByTestId(`view-figure-typed-${card.id}`), { target: { value: '12' } })
    fireEvent.click(screen.getByTestId(`view-figure-set-${card.id}`))
    await waitFor(() => expect(posts()).toHaveLength(2))
    expect(posts()[1]!.body).toMatchObject({ base, quantity: card.id, typed: '12' })
    await waitFor(() => expect(useModelNotice.getState().notice).toMatchObject({ kind: 'saved', n: 2 }))
  })
  it('acceptance row: set aside succeeds and core refuses the edit: the set-aside is still said, the refusal in core\'s words, nothing saved', async () => {
    editAnswer = { status: 409, body: { error: 'the model changed; edit the figure again' } }
    await setAside()
    fireEvent.change(screen.getByTestId(`view-figure-typed-${card.id}`), { target: { value: '12' } })
    fireEvent.click(screen.getByTestId(`view-figure-set-${card.id}`))
    await waitFor(() => expect(screen.getByTestId(`view-figure-error-${card.id}`)).toHaveTextContent('the model changed; edit the figure again'))
    expect(screen.getByTestId(`view-figure-aside-done-${card.id}`)).toBeInTheDocument()
    expect(useModelNotice.getState().notice).toBeNull()
  })
  it('must not change: a card the proposal adds gets no offer; with no proposal held, ✎ is the plain edit', () => {
    useViewStore.setState({ view: added })
    render(<Live id={card.id} />)
    expect(screen.queryByTestId(`view-figure-aside-edit-${card.id}`)).toBeNull()
    cleanup()
    useViewStore.setState({ view: approved })
    render(<Live id={card.id} />)
    expect(screen.queryByTestId(`view-figure-aside-edit-${card.id}`)).toBeNull()
    expect(screen.getByTestId(`view-figure-edit-${card.id}`)).toBeInTheDocument()
  })
})
