/**
 * ⭐ THE FIRST REVIEW CARD LISTS ONE LINE PER ITEM (W12; acceptance run 2, check 3; Paul's D3: "one line per item, with the
 * detail on a tap"). Served on all three journeys, the first-draft card "Your situation as I understood it" showed only
 * its counted marks ("10 · 4 · 0 · Also in the model (3)") and no item at all. It now opens with every item's one line (its
 * name, and Olumi's mark where it is Olumi's) under its group, the marks kept over them; a tap still opens CEE's words.
 *
 * Real path: the three served first-draft turns of that run (capacity 17 rows, european 42, qualitative 35; each fixture's
 * `_source` names it) through the production parser into the real `SuggestedChips`. Contrast: a correction card from the
 * same run (capacity's "Staff absence", not a reading card) keeps its one summary line with its rows behind "Details".
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'

vi.mock('../../../lib/supabase', () => ({ getUserId: async () => null, getSessionIdentity: async () => ({ userId: null, accessToken: null }) }))

import { SuggestedChips } from '../zones/SuggestedChips'
import { readTurnProposalFields, proposalChangeWords, changeIsOlumis, OLUMI_CHANGE_MARK, type ProposalChange } from '../proposalFields'
import { buildSuggestedActionChips } from '../../../v5/blocks/suggestedActionChips'
import { parseV5Response } from '../../../v5/responseParser'
import { useCanvasStore } from '../../store'
import { THREAD_SCROLLER_ATTRIBUTE } from '../hooks/threadScroll'
import capacity from './fixtures/served-acceptance-capacity-draft-turn-20261026.json'
import european from './fixtures/served-acceptance-european-draft-turn-20261026.json'
import qualitative from './fixtures/served-acceptance-qualitative-draft-turn-20261026.json'
import correction from './fixtures/served-acceptance-capacity-edit-turn-20261026.json'

type Json = Record<string, any>

async function mount(body: Json) {
  const parsed = await parseV5Response(new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } }), { coreRoute: true })
  if (parsed.kind !== 'response') throw new Error(`the served body did not parse: ${parsed.kind}`)
  const chips = buildSuggestedActionChips(parsed.response.blocks, parsed.response.suggested_actions)
  render(<div {...{ [THREAD_SCROLLER_ATTRIBUTE]: '' }}>
    <SuggestedChips chips={chips} onChipClick={vi.fn(async () => {})} proposalFields={readTurnProposalFields(parsed.response)} />
  </div>)
  await act(async () => { await new Promise((r) => setTimeout(r, 30)) })
}
const keyOf = (c: ProposalChange) => `${c.kind}:${c.id}`

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
  useCanvasStore.setState({ currentScenarioId: null, lastServerGraphHash: null } as never)
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe.each([['capacity', capacity, 17], ['european', european, 42], ['qualitative', qualitative, 35]] as const)(
  'the served %s first-draft card', (_name, turn, count) => {
    const card = (turn.body as Json).cards[0] as Json
    const changes = card.changes as ProposalChange[]

    it(`lists all ${count} items with no tap, one line each: the name, and Olumi\'s mark where it is Olumi\'s`, async () => {
      expect(card.reading).toBe(true)
      expect(changes).toHaveLength(count)
      await mount(turn.body as Json)
      const panel = screen.getByTestId(`proposal-change-notes-${card.proposal_id}`)
      expect(panel.querySelectorAll('li')).toHaveLength(count)
      for (const c of changes) {
        const line = screen.getByTestId(`proposal-change-open-${keyOf(c)}`)
        expect(line.textContent).toBe(changeIsOlumis(c) ? `${c.label} · ${OLUMI_CHANGE_MARK}` : c.label)
        expect(screen.queryByTestId(`proposal-change-detail-${keyOf(c)}`)).toBeNull()
      }
      // The counted marks stay over the rows.
      expect(screen.getByTestId(`reading-group-${card.proposal_id}-used`)).toBeTruthy()
    })

    it('a tap on a line opens CEE\'s words for that item', async () => {
      await mount(turn.body as Json)
      const c = changes[changes.length - 1]!
      fireEvent.click(screen.getByTestId(`proposal-change-open-${keyOf(c)}`))
      expect(screen.getByTestId(`proposal-change-detail-${keyOf(c)}`).textContent).toBe(proposalChangeWords(c))
    })
  })

describe('CONTRAST: a correction card (not a reading card) is as before', () => {
  it('capacity\'s "Staff absence" card: its summary line, its rows behind "Details", unchanged', async () => {
    const body = correction.body as Json
    const card = (body.cards as Json[]).find((c) => (c.changes as Json[] | undefined)?.some((x) => x.label === 'Staff absence'))!
    expect(card.reading).toBeUndefined()
    await mount(body)
    const panel = screen.getByTestId(`proposal-change-notes-${card.proposal_id}`)
    expect(panel.querySelectorAll('li')).toHaveLength(0)
    fireEvent.click(within(panel).getByTestId(`proposal-change-details-${card.proposal_id}`))
    expect(panel.querySelectorAll('li')).toHaveLength((card.changes as Json[]).length)
  })
})
