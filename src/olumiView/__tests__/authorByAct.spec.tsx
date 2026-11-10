/**
 * Author by act (DL 10 Nov; core wip/science-author-by-act e9cb54fb): a change the AI read from a message to a record of theirs is Olumi's
 * reading, kept off their record until they confirm it themselves. Core marks it on the proposal (`proposal.marks[].reading.id`, absent on every
 * other mark); V11 gives that mark its own tick, and "Approve ticked" sends the ticked readings in `only_readings`, by that id alone, beside any
 * ticked lines. Approve (the whole card) never confirms a reading. The View is core's own: fixtures/author-act/reading.mts.txt (correctionStage
 * with a scripted update reply, zero AI calls, then viewOf olumi.view/3 on golden proposal), at core e9cb54fb.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { View } from '../client'
import { useViewStore } from '../store'
import { useUIStore } from '../../stores/uiStore'
import { ViewChat, useViewChat } from '../ViewChat'
import { setTeamFetch } from '../../olumiCore/team/api'

const read: View = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/author-act', 'proposal-reading.core-e9cb54fb.view3.json'), 'utf8'))
const p = read.proposal!
const at = p.marks.findIndex((m) => (m as { reading?: { id: string } }).reading !== undefined)
const mark = p.marks[at]!

let posts: Array<{ path: string; body: unknown }> = []
const show = (view: View) => {
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: view.id, view, status: 'ready', error: null, stale: false })
  return render(<ViewChat />).container
}
beforeEach(() => {
  posts = []
  useUIStore.setState({ activeOutputTab: 'olumi' } as never)
  setTeamFetch((async (u: unknown, init?: RequestInit) => {
    if ((init?.method ?? 'GET') === 'POST') { posts.push({ path: String(u), body: JSON.parse(String(init!.body)) }); return new Response('{"version":9,"n":2,"receipt":"r"}', { status: 201 }) }
    return new Response(JSON.stringify(read), { status: 200 })
  }) as unknown as typeof fetch)
})
afterEach(() => { cleanup(); setTeamFetch(null); useViewChat.setState({ busy: false, said: null }); useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none', error: null }) })
const tick = () => screen.getByTestId(`view-reading-tick-${at}`) as HTMLInputElement

describe("author by act: Olumi's reading is confirmed by their own tick, sent by core's id", () => {
  it("core's fixture: one mark carries a reading, on their existing capacity, beside two change lines", () => {
    expect([at, (mark as { reading?: { id: string } }).reading, p.changes.length]).toEqual([0, { id: 'existing_capacity' }, 2])
  })

  it("the reading's mark has its own tick, unticked, labelled by core's words alone, with core's title as its hover", () => {
    const c = show(read)
    expect(tick().checked).toBe(false)
    const label = c.querySelector(`[data-target-for="view-reading-tick-${at}"]`) as HTMLElement
    expect(label.title).toBe(mark.title)
    expect(label.textContent).toBe(`${mark.what}: ${mark.status}`)
    expect(c.querySelector(`[data-view="proposal.marks.${at}.status"]`)?.textContent).toBe(mark.status)
  })

  it('the reading alone enables Approve ticked, which sends its id in only_readings and no line', async () => {
    show(read)
    expect(screen.getByTestId('view-approve-ticked')).toBeDisabled()
    fireEvent.click(tick())
    expect(screen.getByTestId('view-approve-ticked')).toHaveTextContent('Approve ticked · 1')
    fireEvent.click(screen.getByTestId('view-approve-ticked'))
    await waitFor(() => expect(posts).toHaveLength(1))
    expect(posts[0]).toEqual({ path: `/api/proposals/${p.id}/approve`, body: { base: p.base, only: [], only_top: [], only_readings: ['existing_capacity'] } })
  })

  it('a reading and a line ticked together: both counted, each in its own list', async () => {
    show(read)
    fireEvent.click(tick())
    fireEvent.click(screen.getByTestId('view-change-tick-1'))
    expect(screen.getByTestId('view-approve-ticked')).toHaveTextContent('Approve ticked · 2')
    fireEvent.click(screen.getByTestId('view-approve-ticked'))
    await waitFor(() => expect(posts).toHaveLength(1))
    expect(posts[0]!.body).toEqual({ base: p.base, only: [p.changes[1]!.id], only_top: [], only_readings: ['existing_capacity'] })
  })

  it('must not change: Approve is the whole card and confirms no reading, even with the reading ticked', async () => {
    show(read)
    fireEvent.click(tick())
    fireEvent.click(screen.getByText('Approve'))
    await waitFor(() => expect(posts).toHaveLength(1))
    expect(posts[0]).toEqual({ path: `/api/proposals/${p.id}/approve`, body: { base: p.base } })
  })

  it('must not change: lines ticked with no reading send no only_readings', async () => {
    show(read)
    fireEvent.click(screen.getByTestId('view-change-tick-0'))
    fireEvent.click(screen.getByTestId('view-approve-ticked'))
    await waitFor(() => expect(posts).toHaveLength(1))
    expect(posts[0]!.body).toEqual({ base: p.base, only: [p.changes[0]!.id], only_top: [] })
  })

  it('one change line (no line ticks): the reading still has its tick and Approve ticked confirms it alone', async () => {
    show({ ...read, proposal: { ...p, changes: [p.changes[0]!] } })
    expect(document.querySelector('[data-testid^="view-change-tick-"]')).toBeNull()
    fireEvent.click(tick())
    fireEvent.click(screen.getByTestId('view-approve-ticked'))
    await waitFor(() => expect(posts).toHaveLength(1))
    expect(posts[0]!.body).toEqual({ base: p.base, only: [], only_top: [], only_readings: ['existing_capacity'] })
  })

  it('contrast: a mark with no reading (every other mark core sends) has no tick; one line and no reading has no Approve ticked', () => {
    const { reading: _r, ...plain } = mark as typeof mark & { reading?: unknown }
    show({ ...read, proposal: { ...p, changes: [p.changes[0]!], marks: [plain] } })
    expect(document.querySelector('[data-testid^="view-reading-tick-"]')).toBeNull()
    expect(screen.queryByTestId('view-approve-ticked')).toBeNull()
    expect(document.querySelector('[data-view="proposal.marks.0.status"]')?.textContent).toBe(mark.status)
  })
})
