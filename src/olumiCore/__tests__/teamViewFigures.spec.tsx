/**
 * D7 from the screen (DL via github-3c, 5 Nov): "Add my view" carries the member's own figures, so a revealed view's what-ifs (D7) are
 * reachable without the API. One field per card core offers a figure edit for (`figure.edit`, labelled by the card's heading); each
 * figure goes to core as typed (`{ quantity, typed }`, read by core with the same parse as Set), with the approved version's number.
 * STAND-IN: core's views route takes `typed` from science's branch off 068f2f0 (SHA to come); re-pin then. Fixture: core's european golden.
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
  collab: { ...base.collab, alone: false, shared: [], mine: [] } }
const givable = view.model!.cards.filter((c) => c.figure?.edit)
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

describe('a view carries the member\'s own figures, as typed', () => {
  it('one field per card core offers a figure edit for, labelled by that card\'s heading', () => {
    expect(givable.length).toBeGreaterThan(1)
    show()
    for (const c of givable) expect(within(field(c.id).closest('label')!).getByText(c.heading)).toBeTruthy()
    const offered = [...document.querySelectorAll('[data-testid^="team-view-figure-"]')].map((e) => e.getAttribute('data-testid'))
    expect(offered).toEqual(givable.map((c) => `team-view-figure-${c.id}`))
  })

  it('CATCH: a view given with a figure posts its words, the figure as typed and the approved version\'s number', async () => {
    show()
    fireEvent.change(screen.getByTestId('team-view-text'), { target: { value: 'Churn will bite harder abroad.' } })
    fireEvent.change(field('churn_danger_threshold'), { target: { value: '10 to 50%' } })
    fireEvent.click(screen.getByTestId('team-view-give'))
    await waitFor(() => expect(posts.length).toBe(1))
    expect(posts[0]).toEqual({ text: 'Churn will bite harder abroad.', figures: [{ quantity: 'churn_danger_threshold', typed: '10 to 50%' }], version: view.version!.n })
  })

  it('INVARIANCE: a view in words only posts exactly its words, as before', async () => {
    show()
    fireEvent.change(screen.getByTestId('team-view-text'), { target: { value: '  wait a quarter ' } })
    fireEvent.change(field('churn_danger_threshold'), { target: { value: '   ' } })
    fireEvent.click(screen.getByTestId('team-view-give'))
    await waitFor(() => expect(posts.length).toBe(1))
    expect(posts[0]).toEqual({ text: '  wait a quarter ' })
  })

  it('core\'s refusal (400, 409) is drawn in core\'s words, and the typed figure stays to correct', async () => {
    answer = { status: 400, json: { error: 'For “Churn danger threshold”, type one number, or a range like 150 to 400.' } }
    show()
    fireEvent.change(screen.getByTestId('team-view-text'), { target: { value: 'x' } })
    fireEvent.change(field('churn_danger_threshold'), { target: { value: 'lots' } })
    fireEvent.click(screen.getByTestId('team-view-give'))
    await waitFor(() => expect(screen.getByTestId('team-views-error').textContent).toBe('For “Churn danger threshold”, type one number, or a range like 150 to 400.'))
    expect((field('churn_danger_threshold') as HTMLInputElement).value).toBe('lots')
  })

  it('CONTRAST: no field before an approved version, nor while a pending proposal is shown (core takes figures of the approved version only)', () => {
    show({ ...view, version: null })
    expect(document.querySelectorAll('[data-testid^="team-view-figure-"]').length).toBe(0)
    cleanup()
    show({ ...view, proposal: { ...(base.proposal ?? {}), id: 9 } as View['proposal'], model: { ...view.model!, edit_base: null } })
    expect(document.querySelectorAll('[data-testid^="team-view-figure-"]').length).toBe(0)
  })
})
