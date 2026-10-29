/**
 * ⭐ THE READING CARD SHOWS ONE LINE PER ITEM, ITS FULL WORDS ONE TAP AWAY (W7, D3: Paul, 26 Oct). Served on Paul's board
 * (debug 377f5f6b): the first-draft card printed each row's full `after` prose, 19 rows and about 5,000 characters, most of
 * it labels, references and quotes. Each row is now the item's name and, when it is Olumi's, its mark; a tap opens CEE's
 * own words for it (`proposalChangeWords`), so nothing is approved unseen, and the approve press is unchanged.
 *
 * Real path: the served first-draft reading turn (`served-card-european-reading-20261025.json`) carrying the 19 rows of
 * Paul's card as CEE sent them (`served-reading-card-377f5f6b-20261026.json`, grouped by CEE), through the production
 * parser into the real `SuggestedChips`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('../../../lib/supabase', () => ({ getUserId: async () => null, getSessionIdentity: async () => ({ userId: null, accessToken: null }) }))

import { SuggestedChips } from '../zones/SuggestedChips'
import { readTurnProposalFields, proposalChangeWords, OLUMI_CHANGE_MARK, type ProposalChange } from '../proposalFields'
import { buildSuggestedActionChips } from '../../../v5/blocks/suggestedActionChips'
import { parseV5Response } from '../../../v5/responseParser'
import { useCanvasStore } from '../../store'
import { THREAD_SCROLLER_ATTRIBUTE } from '../hooks/threadScroll'
import readingTurn from './fixtures/served-card-european-reading-20261025.json'
import paulsCard from './fixtures/served-reading-card-377f5f6b-20261026.json'

type Json = Record<string, any>
const body = JSON.parse(JSON.stringify(readingTurn.body)) as Json
body.cards[0].changes = paulsCard.changes
const PID: string = body.cards[0].proposal_id
const CHANGES = paulsCard.changes as ProposalChange[]
const keyOf = (c: ProposalChange) => `${c.kind}:${c.id}`

let onChipClick: ReturnType<typeof vi.fn<[chip: { id: string }], Promise<void>>>
async function mount() {
  const parsed = await parseV5Response(new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } }), { coreRoute: true })
  if (parsed.kind !== 'response') throw new Error(`the served body did not parse: ${parsed.kind}`)
  const chips = buildSuggestedActionChips(parsed.response.blocks, parsed.response.suggested_actions)
  render(<div {...{ [THREAD_SCROLLER_ATTRIBUTE]: '' }}>
    <SuggestedChips chips={chips} onChipClick={onChipClick} proposalFields={readTurnProposalFields(parsed.response)} />
  </div>)
  await act(async () => { await new Promise((r) => setTimeout(r, 30)) })
}
/** Every group, "Also in the model" included, starts open (W12): its sections are there with no tap. */
function openAll() {
  for (const g of ['used', 'other']) expect(screen.getByTestId(`reading-group-section-${PID}-${g}`)).toBeTruthy()
}
const row = (c: ProposalChange) => screen.getByTestId(`proposal-change-${keyOf(c)}`)
const line = (c: ProposalChange) => screen.getByTestId(`proposal-change-open-${keyOf(c)}`)

beforeEach(() => {
  onChipClick = vi.fn(async (_chip: { id: string }) => {})
  Element.prototype.scrollIntoView = vi.fn()
  useCanvasStore.setState({ currentScenarioId: null, lastServerGraphHash: null } as never)
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('Paul’s 19-item reading card', () => {
  it('19 rows, each one line: the item’s name and, when it is Olumi’s, its mark; none of CEE’s longer words', async () => {
    await mount()
    openAll()
    expect(screen.getByTestId(`proposal-change-notes-${PID}`).querySelectorAll('li')).toHaveLength(19)
    for (const c of CHANGES) {
      expect(line(c).textContent).toBe(c.author === 'olumi' ? `${c.label} · ${OLUMI_CHANGE_MARK}` : c.label)
      expect(screen.queryByTestId(`proposal-change-detail-${keyOf(c)}`)).toBeNull()
    }
    // The card's text is the names, not the prose: under half of what every row's full words would print.
    const printed = CHANGES.reduce((n, c) => n + (row(c).textContent ?? '').length, 0)
    const full = CHANGES.reduce((n, c) => n + proposalChangeWords(c).length, 0)
    expect(printed).toBeLessThan(full / 2)
  })

  it('a tap opens the row’s full words, in CEE’s own phrasing, and a second tap closes them', async () => {
    await mount()
    openAll()
    for (const c of CHANGES) {
      fireEvent.click(line(c))
      expect(line(c).getAttribute('aria-expanded')).toBe('true')
      // Acceptance 29 Oct (c7.1): the open row shows its whole name, and its words below do not say the name again.
      expect(line(c).querySelector('.truncate')).toBeNull()
      const detail = screen.getByTestId(`proposal-change-detail-${keyOf(c)}`).textContent
      expect(detail).toBe(c.action === 'add' && c.after !== null ? (c.kind === 'left_out' ? `Leaves out: ${c.after}` : c.after) : proposalChangeWords(c))
      expect(detail).not.toMatch(/^(Adds|Leaves out) ‘/)
    }
    const first = CHANGES[0]!
    fireEvent.click(line(first))
    expect(screen.queryByTestId(`proposal-change-detail-${keyOf(first)}`)).toBeNull()
  })

  it('the approve press is unchanged: it sends CEE’s own approve action, whatever is open', async () => {
    await mount()
    openAll()
    fireEvent.click(line(CHANGES[2]!))
    fireEvent.click(screen.getByRole('button', { name: body.cards[0].approve_action.label }))
    expect(onChipClick).toHaveBeenCalledTimes(1)
    expect(onChipClick.mock.calls[0]![0]).toMatchObject({ id: body.cards[0].approve_action.id })
  })
})
