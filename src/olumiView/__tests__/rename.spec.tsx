/**
 * R25 rename, the first direct structural edit (core contract, DL 02:14Z): offered for the selected card in the dock's "Selected:" row
 * (DL 7 Nov run 0717: in the panel beside the card it covered the neighbouring card's words), posted on the base it opened on, saved at
 * once with core's version receipt; a refusal is core's own words; a held proposal offers none (core: "approve or set aside the pending
 * change first"). The panel beside a card opens only for its other words.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { View } from '../client'
import { useViewStore } from '../store'
import { ViewCard } from '../../canvas/nodes/ViewCardNode'
import { SelectionPill } from '../../canvas/components/SelectionPill'
import { useCanvasStore } from '../../canvas/store'
import { selectedRename } from '../SelectedRename'
import { setTeamFetch } from '../../olumiCore/team/api'
import { resetWrites } from '../../olumiCore/team/writes'
import { useMe } from '../../olumiCore/me'
import { useModelNotice } from '../notice'

const SID = 's_0123456789ab'
const approved: View = { ...JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/real', 'european-22cards.view3.json'), 'utf8')), id: SID }
const base = approved.model!.edit_base!
const card = approved.model!.cards.find((c) => c.family === 'option')!
const held = { ...approved, model: { ...approved.model!, edit_base: null } } as View
// The dock's selection row as the lane draws it (OutputsDock: SelectionPill after={selectedRename}), with one canvas element selected.
const selectedRow = (id: string, kind: 'node' | 'edge' = 'node') => {
  useCanvasStore.setState({ nodes: [{ id, position: { x: 0, y: 0 }, data: { label: card.heading } }] as never, edges: [{ id, source: 'a', target: 'b' }] as never,
    selection: { nodeIds: new Set(kind === 'node' ? [id] : []), edgeIds: new Set(kind === 'edge' ? [id] : []), anchorPosition: null } })
  return render(<SelectionPill after={selectedRename} />).container
}

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
afterEach(() => { cleanup(); useCanvasStore.setState({ selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null }, nodes: [], edges: [] } as never); setTeamFetch(null); resetWrites(); useModelNotice.setState({ notice: null }); useViewStore.setState({ uuid: null, sid: null, view: null, error: null, status: 'none' }); useMe.setState({ me: null, status: 'none' }) })
const posts = () => calls.filter((c) => c.method === 'POST')

describe('whose card it is, in the Selected row (UI restore 11 Nov, R12)', () => {
  it('a person\'s card says so in core\'s words, neutral; an Olumi card in Olumi\'s blue; its source is the hover; a card with no author says nothing', () => {
    // The 22-card fixture carries no authors (an older View); core's european golden does.
    const euro = { ...JSON.parse(readFileSync(path.resolve('src/olumiView/golden', 'european.view.json'), 'utf8')), id: SID } as View
    useViewStore.setState({ view: euro })
    const person = euro.model!.cards.find((c) => c.author?.by === 'person')!, olumi = euro.model!.cards.find((c) => c.author?.by === 'olumi')!
    expect(person.author!.text, 'precondition: core sends the words').not.toBe('')
    let row = selectedRow(person.id)
    const p = row.querySelector('[data-testid="selected-author"]')!
    expect(p.textContent).toBe(person.author!.text); expect(p.getAttribute('title')).toBe(person.author!.title); expect(p.className).not.toMatch(/text-info/)
    cleanup(); row = selectedRow(olumi.id)
    const o = row.querySelector('[data-testid="selected-author"]')!
    expect(o.textContent).toBe(olumi.author!.text); expect(o.className).toMatch(/text-info/)
    cleanup(); useViewStore.setState({ view: { ...euro, model: { ...euro.model!, cards: euro.model!.cards.map((c) => (c.id === person.id ? { ...c, author: null } : c)) } } as View })
    expect(selectedRow(person.id).querySelector('[data-testid="selected-author"]')).toBeNull()
  })
})

describe('rename a card', () => {
  it('catch: in the dock\'s "Selected:" row, prefilled with its name; posts core\'s contract on the opening base; says core\'s version', async () => {
    const row = selectedRow(card.id)
    const open = screen.getByTestId(`view-rename-${card.id}`)
    expect(row.querySelector('[data-testid="ai-panel-selection-pill"]')!.contains(open)).toBe(true) // next to the selection's name
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
    selectedRow(card.id)
    fireEvent.click(screen.getByTestId(`view-rename-${card.id}`))
    fireEvent.change(screen.getByTestId(`view-rename-input-${card.id}`), { target: { value: 'New name' } })
    fireEvent.click(screen.getByTestId(`view-rename-save-${card.id}`))
    await waitFor(() => expect(screen.getByTestId(`view-rename-error-${card.id}`)).toHaveTextContent('this was changed on a different version; reload and rename it again'))
    expect(useModelNotice.getState().notice).toBeNull()
  })
  it('must not change: a held proposal (no edit base) offers no rename; nor a link\'s selection, nor an id that is not a card of core\'s model', () => {
    useViewStore.setState({ view: held })
    selectedRow(card.id)
    expect(screen.queryByTestId(`view-rename-${card.id}`)).toBeNull()
    cleanup(); useViewStore.setState({ view: approved })
    selectedRow(card.id, 'edge')
    expect(screen.queryByTestId(`view-rename-${card.id}`)).toBeNull()
    cleanup()
    selectedRow('the_question')
    expect(screen.queryByTestId('view-rename-the_question')).toBeNull()
    cleanup()
    selectedRow(card.id)
    expect(screen.queryByTestId(`view-rename-${card.id}`)).not.toBeNull() // CONTRAST: offered here
  })
  it('catch (DL 7 Nov run 0717): a selected card opens nothing beside it for Rename; a card with nothing more opens no panel at all', () => {
    const c = render(<ViewCard card={card} selected />).container
    expect(c.querySelector(`[data-view-more] [data-testid="view-rename-${card.id}"]`)).toBeNull()
    cleanup()
    const plain = approved.model!.cards.find((k) => k.status === null && k.reason === null && k.premises.length === 0 && k.change === null)!
    expect(render(<ViewCard card={plain} selected />).container.querySelector('[data-view-more]')).toBeNull()
  })
})
