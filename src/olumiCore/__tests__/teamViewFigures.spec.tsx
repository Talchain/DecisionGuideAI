/**
 * D7 from the screen (DL via github-3c, 5 Nov): "Add my view" carries the member's own figures, so a revealed view's what-ifs (D7) are
 * reachable without the API. One field per card core offers a figure edit for (`figure.edit`, labelled by the card's heading); each
 * figure goes to core as typed (`{ quantity, typed }`, read by core with the same parse as Set), with the approved version's number.
 * Core's views route takes `typed` (API v1.14; core wip/r6-integrate cfeb26b). Fixture: core's european golden.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import golden from '../../olumiView/golden/european.view.json'
import type { View } from '../../olumiView/client'
import { setTeamFetch } from '../team/api'
import { resetDrafts } from '../team/drafts'
import { resetWrites } from '../team/writes'
import { ViewsPanel } from '../team/ViewsPanel'

const SID = 's_0123456789ab'
const base = golden as unknown as View
const view: View = { ...base, id: SID, you: 'Ada', you_id: 'p_1', members: [{ id: 'p_1', name: 'Ada' }, { id: 'p_2', name: 'Bea' }], gated: true,
  // D3 (re-pinned, strategy canvas audit 10 Nov): the boxes are core's `collab.view_figure_cards`, in its order. This list is core's own for
  // this golden at olumi-core wip/d3-view-figures 43eeafea (src/view/__tests__/golden/european.view3.json). Was: every card with an edit.
  collab: { ...base.collab, alone: false, shared: [], mine: [], view_figure_cards: [{ id: 'starting_customers', label: 'Current customer base' }, { id: 'customer_target', label: 'Customer target' }, { id: 'entry_delay', label: 'Expansion start after now' }] } as View['collab'] }
const givable = ['starting_customers', 'customer_target', 'entry_delay'].map((id) => view.model!.cards.find((c) => c.id === id)!)
let posts: unknown[] = []
let answer: { status: number; json: unknown } = { status: 201, json: { contribution: 1 } }
beforeEach(() => {
  posts = []; answer = { status: 201, json: { contribution: 1 } }
  setTeamFetch((async (_u: unknown, init?: RequestInit) => {
    if (init?.method === 'POST') posts.push(JSON.parse(String(init.body)))
    return new Response(JSON.stringify(answer.json), { status: answer.status })
  }) as unknown as typeof fetch)
})
afterEach(() => { cleanup(); setTeamFetch(null); resetDrafts(); resetWrites() })
const show = (v: View = view) => render(<ViewsPanel sid={SID} view={v} onWrote={async () => true} />)
const field = (id: string) => screen.getByTestId(`team-view-figure-${id}`)
// DL ruling 9 Nov: the form opens on one box; its figure fields are behind "Add figures to your view", or appear once they write.
const showOpen = (v: View = view) => { show(v); fireEvent.click(screen.getByTestId('team-view-more')) }

describe('a view carries the member\'s own figures, as typed', () => {
  it('DL ruling 9 Nov: the form opens on one box; the figure fields appear behind "Add figures to your view", or once they write', () => {
    show()
    expect(screen.getByTestId('team-view-text')).toBeTruthy()
    expect(document.querySelectorAll('[data-testid^="team-view-figure-"]').length).toBe(0)
    fireEvent.click(screen.getByTestId('team-view-more'))
    expect(document.querySelectorAll('[data-testid^="team-view-figure-"]').length).toBe(givable.length)
    expect(screen.queryByTestId('team-view-more')).toBeNull()
    cleanup(); resetDrafts()
    show()
    fireEvent.change(screen.getByTestId('team-view-text'), { target: { value: 'Churn will bite harder abroad.' } })
    expect(document.querySelectorAll('[data-testid^="team-view-figure-"]').length).toBe(givable.length)
  })

  it('one field per card core offers a figure edit for, labelled by that card\'s heading', () => {
    expect(givable.length).toBeGreaterThan(1)
    showOpen()
    for (const c of givable) expect(within(field(c.id).closest('label')!).getByText(c.heading)).toBeTruthy()
    const offered = [...document.querySelectorAll('[data-testid^="team-view-figure-"]')].map((e) => e.getAttribute('data-testid'))
    expect(offered).toEqual(givable.map((c) => `team-view-figure-${c.id}`))
  })

  it('CATCH: a view given with a figure posts its words, the figure as typed and the approved version\'s number', async () => {
    show()
    fireEvent.change(screen.getByTestId('team-view-text'), { target: { value: 'Churn will bite harder abroad.' } })
    fireEvent.change(field('customer_target'), { target: { value: '900 to 1200' } })
    fireEvent.click(screen.getByTestId('team-view-give'))
    await waitFor(() => expect(posts.length).toBe(1))
    expect(posts[0]).toEqual({ text: 'Churn will bite harder abroad.', figures: [{ quantity: 'customer_target', typed: '900 to 1200' }], version: view.version!.n, op: expect.any(String) })
  })

  it('INVARIANCE: a view in words only posts exactly its words, as before', async () => {
    show()
    fireEvent.change(screen.getByTestId('team-view-text'), { target: { value: '  wait a quarter ' } })
    fireEvent.change(field('customer_target'), { target: { value: '   ' } })
    fireEvent.click(screen.getByTestId('team-view-give'))
    await waitFor(() => expect(posts.length).toBe(1))
    // Words only, as before, with core's operation id for a view (API v1.24, olumi-core API.md:1044-1050).
    expect(posts[0]).toEqual({ text: '  wait a quarter ', op: expect.any(String) })
  })

  it('core\'s refusal (400, 409) is drawn in core\'s words, and the typed figure stays to correct', async () => {
    answer = { status: 400, json: { error: 'For “Churn danger threshold”, type one number, or a range like 150 to 400.' } }
    show()
    fireEvent.change(screen.getByTestId('team-view-text'), { target: { value: 'x' } })
    fireEvent.change(field('customer_target'), { target: { value: 'lots' } })
    fireEvent.click(screen.getByTestId('team-view-give'))
    await waitFor(() => expect(screen.getByTestId('team-views-error').textContent).toBe('For “Churn danger threshold”, type one number, or a range like 150 to 400.'))
    expect((field('customer_target') as HTMLInputElement).value).toBe('lots')
  })

  it('CONTRAST: no field before an approved version, nor while a pending proposal is shown (core takes figures of the approved version only)', () => {
    show({ ...view, version: null })
    expect(document.querySelectorAll('[data-testid^="team-view-figure-"]').length).toBe(0)
    cleanup()
    show({ ...view, proposal: { ...(base.proposal ?? {}), id: 9 } as View['proposal'], model: { ...view.model!, edit_base: null } })
    expect(document.querySelectorAll('[data-testid^="team-view-figure-"]').length).toBe(0)
  })
  it('CATCH: no field shows the card\'s current figure (Olumi\'s) before the member enters their own; core\'s neutral words are its label\'s hover', () => {
    showOpen()
    const shown = givable.filter((c) => c.figure!.text !== c.figure!.edit!.prompt)
    expect(shown.length).toBeGreaterThan(0)
    for (const c of givable) {
      const input = field(c.id) as HTMLInputElement
      expect(input.placeholder).toBe('')
      expect(input.closest('label')!.title).toBe(c.figure!.edit!.prompt)
      expect(input.closest('label')!.textContent).not.toContain(c.figure!.text)
      expect(input.value).toBe('')
    }
  })

  // Re-pinned (D3): core now lists at most its own cap of cards, so the cap is exercised with core's limit below its list (2 of 3).
  it('CATCH: past core\'s limit no figure can be entered; those given stay editable, clearing one frees a field, and the post never carries more', async () => {
    const capped = { ...view, collab: { ...view.collab, max_view_figures: 2 } } as View
    showOpen(capped)
    const [a, b, d] = givable
    for (const [i, card] of [a!, b!].entries()) fireEvent.change(field(card.id), { target: { value: String(10 + i) } })
    expect((field(d!.id) as HTMLInputElement).disabled).toBe(true)
    expect(screen.getByTestId('team-view-figures-cap')).toBeTruthy()
    for (const card of [a!, b!]) expect((field(card.id) as HTMLInputElement).disabled).toBe(false)
    fireEvent.change(field(a!.id), { target: { value: '' } })
    expect((field(d!.id) as HTMLInputElement).disabled).toBe(false)
    expect(screen.queryByTestId('team-view-figures-cap')).toBeNull()
    fireEvent.change(field(d!.id), { target: { value: '40' } })
    fireEvent.change(screen.getByTestId('team-view-text'), { target: { value: 'x' } })
    fireEvent.click(screen.getByTestId('team-view-give'))
    await waitFor(() => expect(posts.length).toBe(1))
    expect((posts[0] as { figures: unknown[] }).figures.length).toBe(2)
  })

  it('D3 catch: no list from core, no figure box; each box says its own card\'s words for what to type', () => {
    const none = { ...view, collab: { ...view.collab, view_figure_cards: undefined } } as unknown as View
    show(none)
    // With nothing to add the form offers no "Add figures to your view"; writing opens the rest, and still no figure box is drawn.
    expect(screen.queryByTestId('team-view-more')).toBeNull()
    fireEvent.change(screen.getByTestId('team-view-text'), { target: { value: 'x' } })
    expect(document.querySelectorAll('[data-testid^="team-view-figure-"]').length).toBe(0)
    cleanup(); resetDrafts()
    showOpen()
    for (const c of givable) expect(screen.getByTestId(`team-view-figprompt-${c.id}`).textContent).toBe(c.figure!.edit!.prompt)
    // A card core does not list (churn has an edit in this golden) never gets a box.
    expect(view.model!.cards.find((c) => c.id === 'churn_rate')?.figure?.edit).toBeTruthy()
    expect(screen.queryByTestId('team-view-figure-churn_rate')).toBeNull()
  })
})
