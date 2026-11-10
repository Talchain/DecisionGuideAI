/**
 * What-if on a copy (olumi-core API v1.9 `POST …/whatif`, L2 S3): the figure as typed, tried on a copy of the version shown, nothing saved.
 * Core's answer is drawn by the View's own row code, marked not saved; saving stays the edit route. Both fixtures are from the wire:
 * the View and the what-if answer of one scripted core at wip/v3.1-one ae2f15a (existing capacity tried at 5).
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { View } from '../client'
import { useViewStore } from '../store'
import { ViewCard } from '../../canvas/nodes/ViewCardNode'
import { ViewChances } from '../ViewChances'
import { clearWhatIf } from '../whatif'
import { setTeamFetch } from '../../olumiCore/team/api'
import { resetWrites } from '../../olumiCore/team/writes'
import { useMe } from '../../olumiCore/me'
import { useUIStore } from '../../stores/uiStore'

const read = (n: string) => JSON.parse(readFileSync(path.resolve('src/olumiView/golden', n), 'utf8'))
const view: View = read('whatif.view.json'), answer = read('whatif.answer.json')
const SID = view.id, variant = answer.variants[0]
const card = view.model!.cards.find((c) => c.id === variant.edits[0].quantity)!

let calls: Array<{ method: string; path: string; body: unknown }> = []
let reply: { status: number; body: unknown } = { status: 200, body: answer }
beforeEach(() => {
  calls = []
  reply = { status: 200, body: answer }
  setTeamFetch((async (u: unknown, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    calls.push({ method, path: String(u), body: init?.body ? JSON.parse(String(init.body)) : undefined })
    if (method === 'GET' && String(u) === '/api/me') return new Response(JSON.stringify({ me: { id: view.you_id, name: view.you } }), { status: 200 })
    if (method === 'GET') return new Response(JSON.stringify(view), { status: 200 })
    if (String(u).endsWith('/whatif')) return new Response(JSON.stringify(reply.body), { status: reply.status })
    return new Response(JSON.stringify({ version: 99, n: 4, receipt: 'r' }), { status: 201 })
  }) as unknown as typeof fetch)
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-441113f79584', sid: SID, view, status: 'ready', error: null, stale: false })
  useMe.setState({ me: { id: view.you_id, name: view.you }, status: 'ready' })
  useUIStore.setState({ activeOutputTab: 'olumi' } as never)
})
afterEach(() => { cleanup(); clearWhatIf(); setTeamFetch(null); resetWrites(); useViewStore.setState({ uuid: null, sid: null, view: null, error: null, status: 'none' }); useMe.setState({ me: null, status: 'none' }) })

const posts = () => calls.filter((c) => c.method === 'POST')
const typeAndTry = (typed: string) => {
  fireEvent.click(screen.getByTestId(`view-figure-edit-${card.id}`))
  fireEvent.change(screen.getByTestId(`view-figure-typed-${card.id}`), { target: { value: typed } })
  fireEvent.click(screen.getByTestId(`view-figure-try-${card.id}`))
}

describe('what-if: the figure tried on a copy, nothing saved', () => {
  it('one POST to core\'s what-if with the figure as typed on the version shown, never the edit route; the answer drawn over the chances in core\'s words and rows, marked not saved; the editor closes, keeping what was typed', async () => {
    render(<><ViewCard card={card} /><ViewChances model={view.model!} /></>)
    typeAndTry(' 5 ')
    const block = await screen.findByTestId('view-whatif')
    expect(posts()).toEqual([{ method: 'POST', path: `/api/scenarios/${SID}/whatif`, body: { base: view.model!.edit_base, variants: [{ edits: [{ quantity: card.id, typed: ' 5 ' }] }] } }])
    expect(block).toHaveTextContent('What-if, not saved')
    // The chances live on the Results tab: the try opens it, so the person sees the answer (two-people witness, 4 Nov).
    expect(useUIStore.getState().activeOutputTab).toBe('results')
    expect(block.querySelector('[data-view="whatif.edits.0.words"]')?.textContent).toBe(variant.edits[0].words)
    expect(block.querySelector('[data-view="whatif.most_likely.text"]')?.textContent).toBe(variant.most_likely.text)
    for (const o of variant.rows) o.rows.forEach((r: { value: string; aim: string }, i: number) => {
      expect(block.querySelector(`[data-view="whatif.${o.option_id}.rows.${i}.value"]`)?.textContent, o.option_id).toBe(r.value)
      expect(block.querySelector(`[data-view="whatif.${o.option_id}.rows.${i}.aim"]`)?.textContent, o.option_id).toBe(r.aim)
    })
    // Re-pinned (TM-27, DL 10 Nov approved design; the J5 TryRange comp): once tried, the editor closes so the card shows the try in place
    // and the board brings every option's chance into view (it stayed open, covering the card and scrolling the options away). What was
    // typed is kept: ✎ opens it again as typed. Was: the form stayed open.
    await waitFor(() => expect(screen.queryByTestId(`view-figure-form-${card.id}`)).toBeNull())
    fireEvent.click(screen.getByTestId(`view-figure-edit-${card.id}`))
    expect((screen.getByTestId(`view-figure-typed-${card.id}`) as HTMLInputElement).value).toBe(' 5 ')
    fireEvent.click(screen.getByTestId('view-whatif-clear'))
    expect(screen.queryByTestId('view-whatif')).toBeNull()
  })

  it('a result that did not move says core\'s reason; core\'s refusal stays on the card, with no what-if drawn', async () => {
    reply = { status: 200, body: { ...answer, variants: [{ ...variant, moved: false, why_not: 'The new figure is inside the range the result already covered.' }] } }
    render(<><ViewCard card={card} /><ViewChances model={view.model!} /></>)
    typeAndTry('20')
    expect((await screen.findByTestId('view-whatif')).querySelector('[data-view="whatif.why_not"]')?.textContent).toBe('The new figure is inside the range the result already covered.')
    cleanup(); clearWhatIf(); useUIStore.setState({ activeOutputTab: 'olumi' } as never)
    reply = { status: 400, body: { error: card.figure!.edit!.ask } }
    render(<><ViewCard card={card} /><ViewChances model={view.model!} /></>)
    typeAndTry('lots')
    await waitFor(() => expect(screen.getByTestId(`view-figure-error-${card.id}`)).toHaveTextContent(card.figure!.edit!.ask))
    expect(screen.queryByTestId('view-whatif')).toBeNull()
    expect(useUIStore.getState().activeOutputTab).toBe('olumi')
  })

  it('must not change: Set figure still saves through the edit route alone; a what-if is not drawn on another version', async () => {
    render(<><ViewCard card={card} /><ViewChances model={view.model!} /></>)
    typeAndTry('5')
    await screen.findByTestId('view-whatif')
    // TM-27: the editor closed on the try; ✎ opens it again, as typed, and Set figure saves that.
    await waitFor(() => expect(screen.queryByTestId(`view-figure-form-${card.id}`)).toBeNull())
    fireEvent.click(screen.getByTestId(`view-figure-edit-${card.id}`))
    fireEvent.click(screen.getByTestId(`view-figure-set-${card.id}`))
    await waitFor(() => expect(posts().map((c) => c.path)).toEqual([`/api/scenarios/${SID}/whatif`, `/api/scenarios/${SID}/edit`]))
    cleanup()
    render(<ViewChances model={{ ...view.model!, edit_base: view.model!.edit_base! + 1 }} />)
    expect(screen.queryByTestId('view-whatif')).toBeNull()
  })
})
