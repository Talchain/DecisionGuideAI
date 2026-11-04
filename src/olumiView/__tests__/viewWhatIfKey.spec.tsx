/**
 * The What if lens on the core lane (DL 4 Nov, R2): the legacy lens's key card fed by core's what-if on a copy. The fixtures are the wire
 * pair whatif.spec.tsx uses (one scripted core: the View, and core's answer for existing capacity tried at 5). Bound by identity: each
 * drawn row is found by its View path and compared with that exact string.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import type { View } from '../client'
import { useViewStore } from '../store'
import { useTriedOn, useViewLens } from '../lens'
import { ViewWhatIfKey } from '../ViewWhatIfKey'
import { ViewCard } from '../../canvas/nodes/ViewCardNode'
import { clearWhatIf, useWhatIf } from '../whatif'
import { setTeamFetch } from '../../olumiCore/team/api'
import { resetWrites } from '../../olumiCore/team/writes'
import { useMe } from '../../olumiCore/me'
import { WHAT_IF_COPY } from '../../canvas/artefacts/whatIfCopy'
import { optionCards, triableCards } from '../layout'

const read = (n: string) => JSON.parse(readFileSync(path.resolve('src/olumiView/golden', n), 'utf8'))
const view: View = read('whatif.view.json'), answer = read('whatif.answer.json')
const SID = view.id, variant = answer.variants[0], model = view.model!
const tried = variant.edits[0].quantity as string

let calls: Array<{ method: string; path: string; body: unknown }> = []
let reply: { status: number; body: unknown } = { status: 200, body: answer }
beforeEach(() => {
  calls = []
  reply = { status: 200, body: answer }
  setTeamFetch((async (u: unknown, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    calls.push({ method, path: String(u), body: init?.body ? JSON.parse(String(init.body)) : undefined })
    if (method === 'GET') return new Response(JSON.stringify(view), { status: 200 })
    return new Response(JSON.stringify(reply.body), { status: reply.status })
  }) as unknown as typeof fetch)
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-441113f79584', sid: SID, view, status: 'ready', error: null, stale: false })
  useMe.setState({ me: { id: view.you_id, name: view.you }, status: 'ready' })
})
afterEach(() => { cleanup(); clearWhatIf(); useViewLens.setState({ lens: 'full' }); setTeamFetch(null); resetWrites(); useViewStore.setState({ uuid: null, sid: null, view: null, error: null, status: 'none' }); useMe.setState({ me: null, status: 'none' }) })

const posts = () => calls.filter((c) => c.method === 'POST')
const runTry = (typed: string) => {
  fireEvent.click(screen.getByTestId('view-whatif-key-fold'))
  fireEvent.change(screen.getByTestId('view-whatif-key-factor'), { target: { value: tried } })
  fireEvent.change(screen.getByTestId('view-whatif-key-typed'), { target: { value: typed } })
  fireEvent.click(screen.getByTestId('view-whatif-key-run'))
}

describe('the What if lens: a figure tried on a copy from the key card, nothing saved', () => {
  it('CONTRAST: off the lens there is no key and no card is marked, even with a what-if held', () => {
    useWhatIf.setState({ shown: { sid: SID, base: model.edit_base!, quantity: tried, typed: '5', variant } })
    render(<ViewWhatIfKey />)
    expect(screen.queryByTestId('view-whatif-key')).toBeNull()
    expect(renderHook(() => useTriedOn(tried)).result.current).toBeNull()
  })

  it('folded, the legend; open, the figures the person may set, each by its card\'s heading, the saved figure beside', () => {
    useViewLens.setState({ lens: 'what_if' })
    render(<ViewWhatIfKey />)
    expect(screen.getByTestId('view-whatif-key')).toHaveTextContent(WHAT_IF_COPY.legendEmpty)
    expect(screen.queryByTestId('view-whatif-key-form')).toBeNull()
    fireEvent.click(screen.getByTestId('view-whatif-key-fold'))
    const factor = screen.getByTestId<HTMLSelectElement>('view-whatif-key-factor')
    expect([...factor.options].map((o) => [o.value, o.textContent])).toEqual(triableCards(model).map((c) => [c.id, c.heading]))
    expect(triableCards(model).length).toBeGreaterThan(0)
  })

  it('Run: one POST to core\'s what-if with the figure as typed on the version shown, never the edit route; each option\'s saved lines beside the copy\'s, core\'s words for the figure tried, and the card marked as typed', async () => {
    useViewLens.setState({ lens: 'what_if' })
    render(<ViewWhatIfKey />)
    runTry(' 5 ')
    const compare = await screen.findByTestId('view-whatif-key-compare')
    expect(posts()).toEqual([{ method: 'POST', path: `/api/scenarios/${SID}/whatif`, body: { base: model.edit_base, variants: [{ edits: [{ quantity: tried, typed: ' 5 ' }] }] } }])
    const key = screen.getByTestId('view-whatif-key')
    expect(key.querySelector('[data-view="whatif.edits.0.words"]')?.textContent).toBe(variant.edits[0].words)
    expect(key).toHaveTextContent(WHAT_IF_COPY.nothingSaved)
    const options = new Map(optionCards(model).map((c) => [c.id, c]))
    for (const o of variant.rows) {
      const card = options.get(o.option_id)!
      const box = compare.querySelector(`[data-whatif-key-option="${o.option_id}"]`)!
      card.rows.forEach((r, i) => expect(box.querySelector(`[data-view="${card.id}.rows.${i}.${r.kind === 'none' ? (r.text == null ? 'title' : 'text') : 'value'}"]`)?.textContent, `${o.option_id} saved ${i}`).toBe(r.kind === 'none' ? (r.text ?? r.title) : r.value))
      o.rows.forEach((r: { value: string }, i: number) => expect(box.querySelector(`[data-view="whatif.${o.option_id}.rows.${i}.value"]`)?.textContent, `${o.option_id} what-if ${i}`).toBe(r.value))
    }
    expect(renderHook(() => useTriedOn(tried)).result.current).toBe(' 5 ')
    // CONTRAST: another card is not marked, and a what-if on another version marks nothing
    expect(renderHook(() => useTriedOn(triableCards(model).find((c) => c.id !== tried)!.id)).result.current).toBeNull()
    act(() => useViewStore.setState({ view: { ...view, model: { ...model, edit_base: model.edit_base! + 1 } } }))
    expect(renderHook(() => useTriedOn(tried)).result.current).toBeNull()
  })

  it('the card\'s mark says the figure as typed, out of flow; no mark without one', () => {
    const card = model.cards.find((c) => c.id === tried)!
    const on = render(<ViewCard card={card} tried="5" />).container
    expect(on.querySelector(`[data-whatif-mark="${tried}"]`)?.textContent).toBe(`${WHAT_IF_COPY.whatIf}: 5`)
    expect(on.querySelector(`[data-whatif-mark="${tried}"]`)!.className).toContain('absolute')
    cleanup()
    expect(render(<ViewCard card={card} />).container.querySelector('[data-whatif-mark]')).toBeNull()
  })

  it('core\'s refusal is said in its words and nothing is drawn; Clear drops a shown what-if', async () => {
    reply = { status: 400, body: { error: 'existing capacity must stay between 0 and 100' } }
    useViewLens.setState({ lens: 'what_if' })
    render(<ViewWhatIfKey />)
    runTry('500')
    await waitFor(() => expect(screen.getByTestId('view-whatif-key-error')).toHaveTextContent('existing capacity must stay between 0 and 100'))
    expect(screen.queryByTestId('view-whatif-key-compare')).toBeNull()
    reply = { status: 200, body: answer }
    fireEvent.click(screen.getByTestId('view-whatif-key-run'))
    await screen.findByTestId('view-whatif-key-compare')
    fireEvent.click(screen.getByTestId('view-whatif-key-clear'))
    expect(screen.queryByTestId('view-whatif-key-compare')).toBeNull()
    expect(posts().map((c) => c.path)).toEqual([`/api/scenarios/${SID}/whatif`, `/api/scenarios/${SID}/whatif`])
  })
})
