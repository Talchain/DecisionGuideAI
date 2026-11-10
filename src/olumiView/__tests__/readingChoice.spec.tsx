/**
 * Choose per reading (Build 2 UI). Olumi sometimes reads a figure from someone's words; core marks each such reading on the proposal
 * (`proposal.marks[].reading.id`, olumi.view/3) and saves one thing: on approval the readings named in `only_readings` are confirmed, and
 * any other offered reading is not applied. These rows drive the real Proposal through the real client (`writes.approve`) against a mocked
 * core: what is on screen, and exactly what Approve sends. They are not the proof against the engine.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { View } from '../client'
import { useViewStore } from '../store'
import { useUIStore } from '../../stores/uiStore'
import { READINGS_CHANGED, READINGS_NOTE, ViewChat, useViewChat } from '../ViewChat'
import { setTeamFetch } from '../../olumiCore/team/api'

const golden: View = JSON.parse(readFileSync(path.resolve('src/olumiView/golden', 'proposal.view.json'), 'utf8'))
const p0 = golden.proposal!
type Mark = NonNullable<View['proposal']>['marks'][number]
// Two readings of Olumi's, each from another person's words (core's title quotes them), and one mark that is not a reading.
const ADA: Mark = { what: 'Per specialist', status: 'Olumi’s reading: 15 a week', title: 'Ada wrote: “each of us closes about 15 a week”', reading: { id: 'rd_ada' } }
const CAL: Mark = { what: 'Start delay', status: 'Olumi’s reading: 3 weeks', title: 'Cal wrote: “it took three weeks last time”', reading: { id: 'rd_cal' } }
const PLAIN: Mark = { what: 'Budget', status: 'not yet confirmed', title: 'A figure of Olumi’s' }
const withMarks = (marks: Mark[], you = golden.you): View => ({ ...golden, you, proposal: { ...p0, marks } })
// What core serves once the approval is saved: the next version, no proposal held.
const AFTER: View = { ...golden, proposal: null, version: { ...golden.version!, id: 9, n: 2, label: 'Version 2' } }

let posts: Array<{ path: string; body: unknown }> = []
let failNext = 0
let refuseNext = 0
let afterApproval: View | null = null
let served: View = golden
const show = (view: View) => {
  served = view
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: view.id, view, status: 'ready', error: null, stale: false })
  return render(<ViewChat />)
}
const radio = (j: number, which: 'use' | 'keep') => screen.getByTestId(`view-reading-${j}-${which}`) as HTMLInputElement
beforeEach(() => {
  posts = []; failNext = 0; refuseNext = 0; afterApproval = null
  useUIStore.setState({ activeOutputTab: 'olumi' } as never)
  setTeamFetch((async (u: unknown, init?: RequestInit) => {
    if ((init?.method ?? 'GET') === 'POST') {
      posts.push({ path: String(u), body: JSON.parse(String(init!.body)) })
      if (failNext > 0) { failNext--; throw new TypeError('network down') }
      if (refuseNext > 0) { refuseNext--; return new Response('{"error":"That reading is no longer on offer."}', { status: 400 }) }
      served = afterApproval ?? AFTER
      return new Response('{"version":9,"n":2,"receipt":"r"}', { status: 201 })
    }
    return new Response(JSON.stringify(served), { status: 200 })
  }) as unknown as typeof fetch)
})
afterEach(() => { cleanup(); setTeamFetch(null); useViewChat.setState({ busy: false, said: null }); useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none', error: null }) })

describe('choose per reading', () => {
  it('each offered reading has a two-way choice, on "Keep the original"; its source words are core\'s, in view; said once that nothing is saved until Approve', () => {
    const { container } = show(withMarks([ADA, PLAIN, CAL]))
    expect(screen.getAllByTestId('view-readings-note')).toHaveLength(1)
    expect(screen.getByTestId('view-readings-note')).toHaveTextContent(READINGS_NOTE)
    expect(READINGS_NOTE).toContain('Nothing is saved until you press Approve')
    for (const j of [0, 2]) {
      expect(radio(j, 'keep').checked, `reading ${j} keep`).toBe(true)
      expect(radio(j, 'use').checked, `reading ${j} use`).toBe(false)
      expect(radio(j, 'keep').closest('label')).toHaveTextContent('Keep the original')
      expect(radio(j, 'use').closest('label')).toHaveTextContent('Use Olumi’s reading')
    }
    expect(container.querySelector('[data-view="proposal.marks.0.title"]')?.textContent).toBe(ADA.title)
    expect(container.querySelector('[data-view="proposal.marks.0.status"]')?.textContent).toBe(ADA.status) // Olumi's reading stays Olumi's, in core's words
    // CONTRAST: a mark that is not a reading has no choice, and nothing on the card says "Refuse".
    expect(screen.queryByTestId('view-reading-1')).toBeNull()
    expect(screen.getByTestId('view-chat-proposal').textContent).not.toMatch(/refuse/i)
  })

  it('an ordinary proposed change plus one chosen reading: Approve sends the reading WITH every line of the proposal, so both are applied; then the screen is core\'s View', async () => {
    show(withMarks([ADA]))
    fireEvent.click(radio(0, 'use'))
    expect(screen.getByTestId('view-readings-approve-says')).toHaveTextContent('Approve uses Olumi’s reading for 1 of 1')
    fireEvent.click(screen.getByTestId('view-approve'))
    await waitFor(() => expect(posts).toHaveLength(1))
    expect(posts[0]).toEqual({ path: `/api/proposals/${p0.id}/approve`, body: { base: p0.base, only: p0.changes.map((c) => c.id), only_top: [], only_readings: ['rd_ada'] } })
    // After approval: what core returns (no proposal held), never what the controls were set to.
    await waitFor(() => expect(screen.queryByTestId('view-chat-proposal')).toBeNull())
  })

  it('two readings with different choices: only the chosen one is sent; Approve ticked sends the ticked lines beside it', async () => {
    show(withMarks([ADA, CAL]))
    fireEvent.click(radio(1, 'use'))
    expect([radio(0, 'keep').checked, radio(0, 'use').checked, radio(1, 'keep').checked, radio(1, 'use').checked]).toEqual([true, false, false, true])
    expect(screen.getByTestId('view-readings-approve-says')).toHaveTextContent('Approve uses Olumi’s reading for 1 of 2 and keeps the original for the rest.')
    fireEvent.click(screen.getByTestId('view-change-tick-1'))
    fireEvent.click(screen.getByTestId('view-approve-ticked'))
    await waitFor(() => expect(posts).toHaveLength(1))
    expect(posts[0]!.body).toEqual({ base: p0.base, only: [p0.changes[1]!.id], only_top: [], only_readings: ['rd_cal'] })
  })

  it('a top-level field of the proposal goes in `only_top` beside a chosen reading', async () => {
    const changes = [p0.changes[0]!, { ...p0.changes[0]!, top: true, family: 'question', text: '↻ title', detail: '' }]
    show({ ...golden, proposal: { ...p0, changes, marks: [ADA] } })
    fireEvent.click(radio(0, 'use'))
    fireEvent.click(screen.getByTestId('view-approve'))
    await waitFor(() => expect(posts).toHaveLength(1))
    expect(posts[0]!.body).toEqual({ base: p0.base, only: [changes[0]!.id], only_top: [changes[0]!.id], only_readings: ['rd_ada'] })
  })

  it('must not change: approving the whole proposal confirms no reading unless one is chosen (the body is `base` alone, no `only_readings`)', async () => {
    show(withMarks([ADA, CAL]))
    expect(screen.getByTestId('view-readings-approve-says')).toHaveTextContent('Approve keeps the original for every reading.')
    fireEvent.click(screen.getByTestId('view-approve'))
    await waitFor(() => expect(posts).toHaveLength(1))
    expect(posts[0]).toEqual({ path: `/api/proposals/${p0.id}/approve`, body: { base: p0.base } })
  })

  it('a choice made and then taken back sends no reading', async () => {
    show(withMarks([ADA]))
    fireEvent.click(radio(0, 'use')); fireEvent.click(radio(0, 'keep'))
    fireEvent.click(screen.getByTestId('view-approve'))
    await waitFor(() => expect(posts).toHaveLength(1))
    expect(posts[0]!.body).toEqual({ base: p0.base })
  })

  it('reload before approval: the choices are back on "Keep the original", as the note says; nothing was sent', () => {
    const first = show(withMarks([ADA, CAL]))
    fireEvent.click(radio(0, 'use'))
    expect(radio(0, 'use').checked).toBe(true)
    first.unmount()
    show(withMarks([ADA, CAL])) // the page read again: the same View from core
    expect([radio(0, 'keep').checked, radio(1, 'keep').checked]).toEqual([true, true])
    expect(screen.getByTestId('view-readings-note')).toHaveTextContent('a choice you have not approved is not kept if the page is reloaded')
    expect(posts).toHaveLength(0)
  })

  it('after approval the screen is core\'s View, never what the controls were set to: a reading core still offers is back on "Keep the original", in core\'s words', async () => {
    // Core's answer here: the SAME proposal still held, Ada's reading no longer offered, Cal's still offered and not confirmed (core's words).
    // Both were set to "Use Olumi's reading" before Approve; the screen must show core's state, not those controls.
    afterApproval = { ...golden, proposal: { ...p0, marks: [{ ...CAL, status: 'Olumi’s reading: 3 weeks · not confirmed' }] } }
    const { container } = show(withMarks([ADA, CAL]))
    fireEvent.click(radio(0, 'use')); fireEvent.click(radio(1, 'use'))
    fireEvent.click(screen.getByTestId('view-approve'))
    await waitFor(() => expect(posts).toHaveLength(1))
    expect((posts[0]!.body as { only_readings: string[] }).only_readings).toEqual(['rd_ada', 'rd_cal'])
    await waitFor(() => expect(container.querySelector('[data-view="proposal.marks.0.status"]')?.textContent).toBe('Olumi’s reading: 3 weeks · not confirmed'))
    expect(radio(0, 'keep').checked).toBe(true) // Cal's, now the first mark: not the "use" that was pressed
    expect(radio(0, 'use').checked).toBe(false)
    expect(screen.queryByTestId('view-reading-1')).toBeNull() // Ada's reading is no longer offered: core no longer marks it
    expect(screen.getByTestId('view-readings-approve-says')).toHaveTextContent('Approve keeps the original for every reading.')
    // A page read again later shows the same: the choices live nowhere but core.
    cleanup()
    show(afterApproval)
    expect(radio(0, 'keep').checked).toBe(true)
  })

  it('a failed write, then retry: the same selection is sent again, unchanged', async () => {
    show(withMarks([ADA, CAL]))
    fireEvent.click(radio(0, 'use'))
    failNext = 1
    fireEvent.click(screen.getByTestId('view-approve'))
    await waitFor(() => expect(posts).toHaveLength(1))
    await waitFor(() => expect(useViewChat.getState().busy).toBe(false))
    expect(useViewChat.getState().said).not.toBeNull() // core's or the client's words for the write that did not go through
    expect(radio(0, 'use').checked).toBe(true) // the choice is still on screen for the retry
    fireEvent.click(screen.getByTestId('view-approve'))
    await waitFor(() => expect(posts).toHaveLength(2))
    expect(posts[1]).toEqual(posts[0])
    expect((posts[1]!.body as { only_readings: string[] }).only_readings).toEqual(['rd_ada'])
  })

  it('a retry after the selection changed is refused: nothing is sent, not the old list and not the new one', async () => {
    show(withMarks([ADA, CAL]))
    fireEvent.click(radio(0, 'use'))
    failNext = 1
    fireEvent.click(screen.getByTestId('view-approve'))
    await waitFor(() => expect(posts).toHaveLength(1))
    await waitFor(() => expect(useViewChat.getState().busy).toBe(false))
    fireEvent.click(radio(1, 'use')) // the selection is now both readings
    fireEvent.click(screen.getByTestId('view-approve'))
    expect(screen.getByTestId('view-readings-refused')).toHaveTextContent(READINGS_CHANGED)
    expect(screen.getByTestId('view-readings-refused')).toHaveAttribute('role', 'alert')
    await new Promise((r) => setTimeout(r, 20))
    expect(posts).toHaveLength(1)
    // Put back as it was: the same approval goes again.
    fireEvent.click(radio(1, 'keep'))
    expect(screen.queryByTestId('view-readings-refused')).toBeNull()
    fireEvent.click(screen.getByTestId('view-approve'))
    await waitFor(() => expect(posts).toHaveLength(2))
    expect(posts[1]).toEqual(posts[0])
  })

  it('CONTRAST: a write core refused was not saved, so a changed selection is sent, and nothing claims it may have been saved', async () => {
    show(withMarks([ADA, CAL]))
    fireEvent.click(radio(0, 'use'))
    refuseNext = 1
    fireEvent.click(screen.getByTestId('view-approve'))
    await waitFor(() => expect(posts).toHaveLength(1))
    await waitFor(() => expect(useViewChat.getState().busy).toBe(false))
    expect(useViewChat.getState().said).toBe('That reading is no longer on offer.') // core's own words
    fireEvent.click(radio(0, 'keep')); fireEvent.click(radio(1, 'use'))
    fireEvent.click(screen.getByTestId('view-approve'))
    await waitFor(() => expect(posts).toHaveLength(2))
    expect(screen.queryByTestId('view-readings-refused')).toBeNull()
    expect((posts[1]!.body as { only_readings: string[] }).only_readings).toEqual(['rd_cal'])
  })

  it('a proposal core does not support has no Approve, so no choice is offered and nothing says to press Approve', () => {
    show({ ...golden, proposal: { ...p0, marks: [ADA], verdict: { supported: false, text: 'The evidence does not support this change.', asks: null } as never } })
    expect(screen.queryByTestId('view-approve')).toBeNull()
    expect(screen.queryByTestId('view-reading-0')).toBeNull()
    expect(screen.queryByTestId('view-readings-note')).toBeNull()
  })

  it('a different person approving is named as the approver, never as the source: the quoted words stay their writer\'s', () => {
    const { container } = show(withMarks([ADA], 'Bea'))
    expect(screen.getByTestId('view-readings-approve-says')).toHaveTextContent('Approving records Bea as the person who approved; the words Olumi read stay their writer’s.')
    const reading = screen.getByTestId('view-reading-0')
    expect(reading.textContent).toContain('Ada wrote')
    expect(reading.textContent).not.toContain('Bea')
    expect(container.querySelector('[data-view="proposal.marks.0.title"]')?.textContent).toBe(ADA.title)
  })

  it('must not change: a proposal with no reading has no choice, no note, and Approve as before', async () => {
    show(withMarks([PLAIN]))
    expect(screen.queryByTestId('view-readings-note')).toBeNull()
    expect(screen.queryByTestId('view-readings-approve-says')).toBeNull()
    fireEvent.click(screen.getByTestId('view-approve'))
    await waitFor(() => expect(posts).toHaveLength(1))
    expect(posts[0]!.body).toEqual({ base: p0.base })
  })
})
