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
  useReviewTicks.setState({ pid: null, ticked: new Set(), rejected: new Set(), review: 0 })
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
  it('CONTRAST: with no waiting proposal (an approved board) no card says "Olumi\'s suggestion"', () => {
    show({ ...golden, proposal: null } as View)
    expect(document.querySelector('[data-suggestion]')).toBeNull()
  })
})
