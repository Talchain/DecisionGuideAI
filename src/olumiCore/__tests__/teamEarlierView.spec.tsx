/**
 * PL-783 (13 Nov): a member joining starts a new round, and the author's private view written before it is kept out of that round (core's
 * privacy rule, round.ts: neither shared nor revealed). Core says so per view (`collab.mine[].earlier`, olumi-core wip/ui-earlier-view
 * 210e9f41) with its words (`team_words.views.earlier` / `.reuse`). The panel draws them, and the one act left to the author: put that
 * view's WORDS (never its figures) into their own empty form, to read and give in this round through the same route. Nothing is sent
 * by the press itself. Fixture: core's european golden.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import golden from '../../olumiView/golden/european.view.json'
import type { View } from '../../olumiView/client'
import { setTeamFetch } from '../team/api'
import { resetDrafts } from '../team/drafts'
import { resetWrites } from '../team/writes'
import { ViewsPanel } from '../team/ViewsPanel'

const SID = 's_0123456789ab'
const base = golden as unknown as View
const WORDS = 'Runway at the planned spend is nearer 10 months than 12.'
type Mine = View['collab']['mine'][number]
const earlierView: Mine = { id: 7, text: WORDS, shared: false, skip: false, figures: [{ quantity: 'customer_target', typed: '900', value: 900 } as unknown as Mine['figures'][number]], can_share: false, earlier: true }
const thisRound: Mine = { id: 8, text: 'Hiring will run ahead of plan.', shared: false, skip: false, figures: [], can_share: true, earlier: false }
const view: View = { ...base, id: SID, you: 'Ada', you_id: 'p_1', members: [{ id: 'p_1', name: 'Ada' }, { id: 'p_2', name: 'Bea' }],
  collab: { ...base.collab, alone: false, shared: [], mine: [earlierView, thisRound] } }
let posts: unknown[] = []
beforeEach(() => {
  posts = []
  setTeamFetch((async (_u: unknown, init?: RequestInit) => {
    if (init?.method === 'POST') posts.push(JSON.parse(String(init.body)))
    return new Response(JSON.stringify({ contribution: 9 }), { status: 201 })
  }) as unknown as typeof fetch)
})
afterEach(() => { cleanup(); setTeamFetch(null); resetDrafts(); resetWrites() })
const show = (v: View = view) => render(<ViewsPanel sid={SID} view={v} onWrote={async () => true} />)
const box = () => screen.getByTestId('team-view-text') as HTMLTextAreaElement

describe('PL-783: your view from before this round says so, and its words can be given in this round', () => {
  it('only the view core marks `earlier` says it, in core\'s words, with no share; this round\'s view keeps its share and no such line', () => {
    show()
    expect(screen.getByTestId('team-mine-earlier-7').textContent).toContain(base.team_words.views.earlier)
    expect(screen.getByTestId('team-reuse-7').textContent).toBe(base.team_words.views.reuse)
    expect(screen.queryByTestId('team-share-7')).toBeNull()
    expect(screen.queryByTestId('team-mine-earlier-8')).toBeNull()
    expect(screen.queryByTestId('team-reuse-8')).toBeNull()
    expect(screen.getByTestId('team-share-8')).toBeTruthy()
  })

  it('CATCH: the press puts exactly that view\'s words in the empty form and sends nothing; giving them posts the words alone, once', async () => {
    show()
    fireEvent.click(screen.getByTestId('team-reuse-7'))
    expect(box().value).toBe(WORDS)
    expect(posts).toEqual([])
    fireEvent.click(screen.getByTestId('team-view-give'))
    await waitFor(() => expect(posts.length).toBe(1))
    // Words only: the earlier view's figure is not carried (PL-783: figures only when checked against the current version).
    expect(posts[0]).toEqual({ text: WORDS, op: expect.any(String) })
  })

  it('a draft already in the form is never overwritten: the press waits until the form is empty', () => {
    show()
    fireEvent.change(box(), { target: { value: 'my own new thought' } })
    expect((screen.getByTestId('team-reuse-7') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByTestId('team-reuse-7'))
    expect(box().value).toBe('my own new thought')
  })

  it('INVARIANCE: a core that sends no `earlier` (or no words for it) draws neither the line nor the press', () => {
    const { earlier: _e, reuse: _r, ...oldWords } = base.team_words.views
    const old = { ...view, team_words: { ...base.team_words, views: oldWords }, collab: { ...view.collab, mine: [{ ...earlierView, earlier: undefined }] } } as unknown as View
    show(old)
    expect(document.querySelectorAll('[data-testid^="team-mine-earlier-"], [data-testid^="team-reuse-"]').length).toBe(0)
    cleanup(); resetDrafts()
    show({ ...view, team_words: { ...base.team_words, views: oldWords } } as unknown as View)
    expect(document.querySelectorAll('[data-testid^="team-reuse-"]').length).toBe(0)
  })
})
