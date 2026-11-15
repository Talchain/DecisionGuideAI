/**
 * Old look, Paul 15 Nov ~13:10Z ("empowers the user to help resolve" the AI's weaknesses), DL GO: every card the waiting proposal adds or
 * changes says "Olumi's suggestion" with one-tap Accept / Edit / Reject. A tap saves nothing: it sets that change's tick in the review's list
 * (one set of choices, reviewTicks.ts), the chip then says the choice applies on "Approve ticked", and Review is one tap to that commit.
 * Bound by the change's id and its tick's test id; core's golden proposal (two record changes: per_specialist, start_delay).
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { View } from '../client'
import { useViewStore } from '../store'
import { useUIStore } from '../../stores/uiStore'
import { ViewChat, useViewChat } from '../ViewChat'
import { setTeamFetch } from '../../olumiCore/team/api'
import { SuggestionChip, SUGGESTION_WORDS } from '../previous/SuggestionChip'
import { useReviewTicks } from '../reviewTicks'

const golden: View = JSON.parse(readFileSync(path.resolve('src/olumiView/golden', 'proposal.view.json'), 'utf8'))
const ids = golden.proposal!.changes.filter((c) => !c.top).map((c) => c.id)
let posts: unknown[] = []
const show = (view: View) => {
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: view.id, view, status: 'ready', error: null, stale: false })
  return render(<><ViewChat />{ids.map((id) => <SuggestionChip key={id} id={id} name={id} />)}</>).container
}
const tickOf = (i: number) => document.querySelector<HTMLInputElement>(`[data-target-for="view-change-tick-${i}"] input`)!
beforeEach(() => {
  posts = []
  useReviewTicks.setState({ key: null, ticked: new Set(), rejected: new Set(), review: false })
  useUIStore.setState({ activeOutputTab: 'olumi' } as never)
  setTeamFetch((async (u: unknown, init?: RequestInit) => {
    if ((init?.method ?? 'GET') === 'POST') { posts.push(String(u)); return new Response('{"version":9,"n":2,"receipt":"r"}', { status: 201 }) }
    return new Response(JSON.stringify(golden), { status: 200 })
  }) as unknown as typeof fetch)
})
afterEach(() => { cleanup(); setTeamFetch(null); useViewChat.setState({ busy: false, said: null }); useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none', error: null }) })

describe('Olumi\'s suggestion on each proposed card (old look)', () => {
  it('precondition: the golden proposal changes two records, so its review has ticks', () => {
    expect(ids).toEqual(['per_specialist', 'start_delay'])
  })
  it('CATCH: Accept ticks that change in the review, saves nothing, and the chip says it applies on Approve ticked', () => {
    show(golden)
    expect(screen.getByTestId('per_specialist-suggestion-label')).toHaveTextContent(SUGGESTION_WORDS.label)
    expect(tickOf(0).checked).toBe(false)
    fireEvent.click(screen.getByTestId('per_specialist-suggestion-accept'))
    expect(tickOf(0).checked, 'the same choice as the list').toBe(true)
    expect(tickOf(1).checked).toBe(false)
    expect(screen.getByTestId('per_specialist-suggestion-said')).toHaveTextContent('Accepted · applies on Approve ticked')
    expect(screen.getByTestId('view-approve-ticked')).toHaveTextContent('Approve ticked · 1')
    expect(posts, 'a tap saves nothing').toEqual([])
    // And the list's own tick is the chip's state, both ways.
    fireEvent.click(tickOf(0))
    expect(screen.getByTestId('per_specialist-suggestion-label')).toBeInTheDocument()
  })
  it('CATCH: Reject unticks it and holds the plain Approve (which keeps every line); Undo releases it', () => {
    show(golden)
    fireEvent.click(screen.getByTestId('start_delay-suggestion-reject'))
    expect(screen.getByTestId('start_delay-suggestion-said')).toHaveTextContent('Rejected · applies on Approve ticked')
    expect(tickOf(1).checked).toBe(false)
    expect(screen.getByTestId('view-approve')).toBeDisabled()
    fireEvent.click(screen.getByTestId('start_delay-suggestion-undo'))
    expect(screen.getByTestId('view-approve')).not.toBeDisabled()
    expect(posts).toEqual([])
  })
  it('Review is one tap to the commit: the review opens', () => {
    show(golden)
    fireEvent.click(screen.getByTestId('per_specialist-suggestion-accept'))
    const review = document.querySelector<HTMLDetailsElement>('details[data-testid="view-next-step"]')!
    review.open = false
    act(() => { fireEvent.click(screen.getByTestId('per_specialist-suggestion-review')) })
    expect(review.open).toBe(true)
  })
  it('Edit puts the product\'s own "About <card>:" in the composer, saves nothing', () => {
    show(golden)
    fireEvent.click(screen.getByTestId('per_specialist-suggestion-edit'))
    expect(useViewChat.getState().text).toContain('About per_specialist:')
    expect(posts).toEqual([])
  })
  // Codex 15 Nov round 1 (db61aa1b): six blockers, each a row below.
  it('CATCH (1): no tap while a write is in flight', () => {
    show(golden)
    act(() => { useViewChat.setState({ busy: true }) })
    for (const w of ['accept', 'edit', 'reject']) expect(screen.getByTestId(`start_delay-suggestion-${w}`)).toBeDisabled()
  })
  it('CATCH (2): a group or partner tick never re-ticks a rejected line; only its own tick or Undo reverses it', () => {
    const v = structuredClone(golden); const ch = v.proposal!.changes
    ch[0]!.together = { ids: [ch[1]!.id] } as never // per_specialist goes with start_delay
    show(v)
    fireEvent.click(screen.getByTestId('start_delay-suggestion-reject'))
    expect(screen.getByTestId('per_specialist-suggestion-accept'), 'its partner was rejected').toBeDisabled()
    fireEvent.click(tickOf(0)) // ticking per_specialist in the list would tick its partner: held while the partner is rejected
    expect([tickOf(0).checked, tickOf(1).checked]).toEqual([false, false])
    expect(screen.getByTestId('start_delay-suggestion-said')).toHaveTextContent('Rejected')
    fireEvent.click(tickOf(1)) // the rejected line's own tick reverses it (it names no partner of its own)
    expect([tickOf(0).checked, tickOf(1).checked]).toEqual([false, true])
    expect(screen.getByTestId('start_delay-suggestion-said')).toHaveTextContent('Accepted')
    fireEvent.click(tickOf(0)) // now per_specialist ticks, with its partner
    expect([tickOf(0).checked, tickOf(1).checked]).toEqual([true, true])
  })
  it('CATCH (3): choices belong to one scenario\'s proposal: a new scenario drops them, and so does Set aside', async () => {
    show(golden)
    fireEvent.click(screen.getByTestId('per_specialist-suggestion-accept'))
    act(() => { useViewStore.setState({ sid: 's_other' } as never) })
    act(() => { useViewStore.setState({ sid: golden.id } as never) })
    expect(screen.getByTestId('per_specialist-suggestion-label'), 'nothing carried back').toBeInTheDocument()
    fireEvent.click(screen.getByTestId('per_specialist-suggestion-accept'))
    await act(async () => { fireEvent.click(screen.getByTestId('view-set-aside')) })
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
    expect(useReviewTicks.getState().ticked.size).toBe(0)
  })
  it('CATCH (4): Review shows the Olumi tab before opening the review', () => {
    show(golden)
    useUIStore.setState({ activeOutputTab: 'team' } as never)
    fireEvent.click(screen.getByTestId('per_specialist-suggestion-accept'))
    fireEvent.click(screen.getByTestId('per_specialist-suggestion-review'))
    expect(useUIStore.getState().activeOutputTab).toBe('olumi')
  })
  it('CATCH (4b, Codex round 2): Review tapped while no review is mounted (a collapsed dock) opens it once it mounts', () => {
    show(golden)
    fireEvent.click(screen.getByTestId('per_specialist-suggestion-accept'))
    cleanup() // the dock collapses: the review is gone
    render(<SuggestionChip id="per_specialist" name="per_specialist" />)
    fireEvent.click(screen.getByTestId('per_specialist-suggestion-review'))
    expect(useReviewTicks.getState().review, 'pending until a review answers').toBe(true)
    cleanup()
    render(<ViewChat />) // the dock opens: the review mounts
    expect(document.querySelector<HTMLDetailsElement>('details[data-testid="view-next-step"]')!.open).toBe(true)
    expect(useReviewTicks.getState().review).toBe(false)
  })
  it('CATCH (5): no chip on a proposal core does not support (it has no approval)', () => {
    show({ ...golden, proposal: { ...golden.proposal!, verdict: { supported: false, text: 'Core cannot support this change.' } } } as View)
    expect(document.querySelector('[data-suggestion]')).toBeNull()
  })
  it('CATCH (6): a one-change proposal has the chip too; its choice applies on Approve, a rejection on Set aside, and Approve is held', () => {
    const one = { ...golden, proposal: { ...golden.proposal!, changes: golden.proposal!.changes.slice(0, 1) } } as View
    show(one)
    fireEvent.click(screen.getByTestId('per_specialist-suggestion-accept'))
    expect(screen.getByTestId('per_specialist-suggestion-said')).toHaveTextContent('Accepted · applies on Approve')
    fireEvent.click(screen.getByTestId('per_specialist-suggestion-undo'))
    fireEvent.click(screen.getByTestId('per_specialist-suggestion-reject'))
    expect(screen.getByTestId('per_specialist-suggestion-said')).toHaveTextContent('Rejected · applies on Set aside')
    expect(screen.getByTestId('view-approve')).toBeDisabled()
  })
  it('CONTRAST: with no waiting proposal (an approved board) no card says "Olumi\'s suggestion"', () => {
    show({ ...golden, proposal: null } as View)
    expect(document.querySelector('[data-suggestion]')).toBeNull()
  })
})
