/**
 * ⭐ THE READING CARD, FOLDED (DL G13, 26 Oct: Paul rejected the itemised first-reply list as too long). When CEE groups
 * every row of a reading card (`group`: used / inferred / left_out / other), the card starts closed and its closed row is
 * three counted marks — from your brief, Olumi's for you to check, left out of the calculation — each opening the list
 * at its group; open, the rows sit under the same marks, with a quiet "Also in the model (N)" for the rest. Counts are
 * rows per group. Without a group on every row (an older CEE), the card is exactly as before.
 *
 * Real path: the served first-draft reading card (`served-card-european-reading-20261025.json`, `reading: true`, 38
 * rows; its `_source` names the run) through the production parser into the real `SuggestedChips`. CEE does not send
 * `group` yet, so the grouped rows are that served card with a SYNTHETIC group on each row, by one fixed rule (below);
 * the fallback rows use the served card as it is.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'

vi.mock('../../../lib/supabase', () => ({ getUserId: async () => null, getSessionIdentity: async () => ({ userId: null, accessToken: null }) }))

import { SuggestedChips } from '../zones/SuggestedChips'
import { readTurnProposalFields } from '../proposalFields'
import { buildSuggestedActionChips } from '../../../v5/blocks/suggestedActionChips'
import { parseV5Response } from '../../../v5/responseParser'
import { useCanvasStore } from '../../store'
import { THREAD_SCROLLER_ATTRIBUTE } from '../hooks/threadScroll'
import readingTurn from './fixtures/served-card-european-reading-20261025.json'

type Json = Record<string, any>
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T
const served = readingTurn.body as Json
const PID: string = served.cards[0].proposal_id

/** SYNTHETIC: the person's rows are `used`, Olumi's are `inferred`, left-out rows `left_out`, other records `other`. */
const groupOf = (c: Json): string => c.kind === 'left_out' ? 'left_out' : c.kind === 'record' ? 'other' : c.author === 'person' ? 'used' : 'inferred'
function grouped(body: Json = served): Json {
  const b = clone(body)
  b.cards[0].changes = b.cards[0].changes.map((c: Json) => ({ ...c, group: groupOf(c) }))
  return b
}

async function mount(body: Json) {
  const parsed = await parseV5Response(new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } }), { coreRoute: true })
  if (parsed.kind !== 'response') throw new Error(`the served body did not parse: ${parsed.kind}`)
  const chips = buildSuggestedActionChips(parsed.response.blocks, parsed.response.suggested_actions)
  // Inside a dock and a thread, as ChatThread mounts it: the dock is `overflow: hidden` and must never be scrolled.
  render(<aside data-testid="dock" style={{ overflow: 'hidden' }}><div {...{ [THREAD_SCROLLER_ATTRIBUTE]: '' }} data-testid="thread">
    <SuggestedChips chips={chips} onChipClick={vi.fn(async () => {})} proposalFields={readTurnProposalFields(parsed.response)} />
  </div></aside>)
  await act(async () => { await new Promise((r) => setTimeout(r, 30)) })
}
const panel = () => screen.getByTestId(`proposal-change-notes-${PID}`)
const rows = () => [...panel().querySelectorAll('li')]
const groupButton = (g: string) => screen.getByTestId(`reading-group-${PID}-${g}`)
const section = (g: string) => screen.getByTestId(`reading-group-section-${PID}-${g}`)

let scrollIntoView: ReturnType<typeof vi.fn>
beforeEach(() => {
  scrollIntoView = vi.fn()
  Element.prototype.scrollIntoView = scrollIntoView
  useCanvasStore.setState({ currentScenarioId: null, lastServerGraphHash: null } as never)
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('a reading card with a group on every row', () => {
  it('starts closed: three counted marks and "Also in the model (N)", rows per group, and no list and no "Details"', async () => {
    await mount(grouped())
    expect(rows()).toHaveLength(0)
    expect(screen.queryByTestId(`proposal-change-details-${PID}`)).toBeNull()
    expect(groupButton('used').getAttribute('aria-label')).toBe('From your brief: 9')
    expect(groupButton('inferred').getAttribute('aria-label')).toBe('Olumi’s, for you to check: 16')
    expect(groupButton('left_out').getAttribute('aria-label')).toBe('Left out of the calculation: 1')
    expect(groupButton('used').textContent).toBe('9')
    expect(groupButton('inferred').textContent).toBe('16')
    expect(groupButton('left_out').textContent).toBe('1')
    // The fourth tap target: the closed card's counts add up to every row the approve writes (9 + 16 + 1 + 12 = 38).
    expect(screen.getByTestId(`reading-other-${PID}`).textContent).toBe('Also in the model (12)')
  })

  it('a mark opens the list at its group, moving only the thread (never `scrollIntoView`, never the dock)', async () => {
    await mount(grouped())
    const thread = screen.getByTestId('thread')
    const threadScrollTo = vi.fn()
    thread.scrollTo = threadScrollTo as never
    // Laid out as in a browser: the thread's top at 100, the left-out section's at 400 (jsdom lays nothing out).
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      const top = this === thread ? 100 : this.getAttribute('data-testid') === `reading-group-section-${PID}-left_out` ? 400 : 0
      return { top, bottom: top + 50, left: 0, right: 0, width: 0, height: 50, x: 0, y: top, toJSON: () => ({}) } as DOMRect
    })
    fireEvent.click(groupButton('left_out'))
    expect(threadScrollTo).not.toHaveBeenCalled() // after the thread's own re-pin, on the next frame
    await act(async () => { await new Promise((r) => requestAnimationFrame(() => r(null))) })
    expect(threadScrollTo).toHaveBeenCalledTimes(1)
    expect(threadScrollTo).toHaveBeenCalledWith({ top: 300, behavior: 'auto' })
    expect(scrollIntoView).not.toHaveBeenCalled()
    expect(screen.getByTestId('dock').scrollTop).toBe(0)
    expect(within(section('left_out')).getAllByRole('listitem').map((li) => li.textContent))
      .toEqual([expect.stringContaining('Leaves out')])
  })

  it('open: each group\'s rows under its mark, in CEE\'s order and words, and the rest behind "Also in the model (12)"', async () => {
    await mount(grouped())
    fireEvent.click(groupButton('used'))
    const ids = (g: string) => within(section(g)).getAllByRole('listitem').map((li) => li.getAttribute('data-testid'))
    const servedIds = (g: string) => (served.cards[0].changes as Json[]).filter((c) => groupOf(c) === g).map((c) => `proposal-change-${c.kind}:${c.id}`)
    expect(ids('used')).toEqual(servedIds('used'))
    expect(ids('inferred')).toEqual(servedIds('inferred'))
    expect(ids('left_out')).toEqual(servedIds('left_out'))
    const other = screen.getByTestId(`reading-other-${PID}`)
    expect(other.textContent).toBe('Also in the model (12)')
    expect(screen.queryByTestId(`reading-group-section-${PID}-other`)).toBeNull()
    fireEvent.click(other)
    expect(ids('other')).toEqual(servedIds('other'))
    expect(rows()).toHaveLength(38)
  })

  it('a card of only `other` rows still opens: "Also in the model (38)" reaches every row (Codex r1 on #3003)', async () => {
    const body = clone(served)
    body.cards[0].changes = body.cards[0].changes.map((c: Json) => ({ ...c, group: 'other' }))
    await mount(body)
    expect(rows()).toHaveLength(0)
    for (const g of ['used', 'inferred', 'left_out']) expect((groupButton(g) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByTestId(`reading-other-${PID}`))
    expect(rows().map((li) => li.getAttribute('data-testid')))
      .toEqual((served.cards[0].changes as Json[]).map((c) => `proposal-change-${c.kind}:${c.id}`))
  })
})

describe('CONTRAST: without a group on every row, the card is exactly as before', () => {
  it('the served card (no group): open under its heading, the flat list of 38, "Hide details"', async () => {
    await mount(served)
    expect(rows()).toHaveLength(38)
    expect(screen.getByTestId(`proposal-change-details-${PID}`).textContent).toContain('Hide details')
    expect(screen.queryByTestId(`reading-group-${PID}-used`)).toBeNull()
  })

  it('one row without a group: the flat list', async () => {
    const body = grouped()
    delete body.cards[0].changes[5].group
    await mount(body)
    expect(rows()).toHaveLength(38)
    expect(screen.queryByTestId(`reading-group-${PID}-used`)).toBeNull()
  })

  it('a group this reader does not know is read as none: the row is kept, the list is flat', async () => {
    const body = grouped()
    body.cards[0].changes[5].group = 'something_new'
    await mount(body)
    expect(rows()).toHaveLength(38)
    expect(screen.queryByTestId(`reading-group-${PID}-used`)).toBeNull()
  })
})
