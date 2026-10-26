/**
 * ⭐ A REVIEW ROW'S NEW FIELDS ARE READ, AND A FIXED PART OF THE STRUCTURE IS NEVER CALLED OLUMI'S (W3b UI reader 4; CEE
 * #3799). CEE now sends each row's `family`, `structure: true` for a fixed part of the model (a unit conversion, an on/off
 * switch: nobody's figure) and `asked: true` for a figure still to be given. It keeps `author: 'olumi'` beside `structure`
 * until the canvas reads it, so the card marked those rows "· Olumi's". Now `structure` rows carry no mark and no estimate
 * style; Olumi's own rows keep both.
 *
 * Real path: as `readingCardOneLine.spec.tsx`, Paul's served reading card (`served-reading-card-377f5f6b-20261026.json`) in
 * the served first-draft turn, through the production parser into the real `SuggestedChips`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('../../../lib/supabase', () => ({ getUserId: async () => null, getSessionIdentity: async () => ({ userId: null, accessToken: null }) }))

import { SuggestedChips } from '../zones/SuggestedChips'
import { readTurnProposalFields, readProposalFields, OLUMI_CHANGE_MARK, type ProposalChange } from '../proposalFields'
import { buildSuggestedActionChips } from '../../../v5/blocks/suggestedActionChips'
import { parseV5Response } from '../../../v5/responseParser'
import { useCanvasStore } from '../../store'
import { THREAD_SCROLLER_ATTRIBUTE } from '../hooks/threadScroll'
import readingTurn from './fixtures/served-card-european-reading-20261025.json'
import paulsCard from './fixtures/served-reading-card-377f5f6b-20261026.json'

type Json = Record<string, any>
const body = JSON.parse(JSON.stringify(readingTurn.body)) as Json
/**
 * SYNTHETIC, labelled: Paul's rows with CEE #3799's additive fields (`postimage.ts` at 3ea44fea): every row its `family`;
 * `launch_delay` (an on/off part of the model) as a fixed part of the structure, `author` still `olumi` beside it as CEE
 * sends it; `proposed_delay` as a figure still to be given; and one row with a family this reader does not know.
 */
const FAMILY: Readonly<Record<string, string>> = { option: 'option', left_out: 'left_out', relation: 'relation', record: 'claims', quantity: 'quantity' }
const CHANGES = (paulsCard.changes as ProposalChange[]).map((c) => ({ ...c, family: FAMILY[c.kind],
  ...(c.id === 'launch_delay' ? { structure: true } : {}), ...(c.id === 'proposed_delay' ? { asked: true } : {}),
  ...(c.id === 'boss_reaction' ? { family: 'a_family_from_later' } : {}) })) as ProposalChange[]
body.cards[0].changes = CHANGES
const PID: string = body.cards[0].proposal_id
const byId = (id: string) => CHANGES.find((c) => c.id === id)!
/** The estimate style an Olumi row carries (SuggestedChips.tsx `CHANGE_NOTE_SOURCE_CLASS.estimate`). */
const ESTIMATE_STYLE = 'text-info'
const STRUCTURE = byId('launch_delay')
const OLUMIS = byId('release_offset')
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
/** Every group open: the three marks, then "Also in the model". */
function openAll() {
  fireEvent.click(screen.getByTestId(`reading-group-${PID}-used`))
  fireEvent.click(screen.getByTestId(`reading-other-${PID}`))
}
const row = (c: ProposalChange) => screen.getByTestId(`proposal-change-${keyOf(c)}`)
const line = (c: ProposalChange) => screen.getByTestId(`proposal-change-open-${keyOf(c)}`)

beforeEach(() => {
  onChipClick = vi.fn(async (_chip: { id: string }) => {})
  Element.prototype.scrollIntoView = vi.fn()
  useCanvasStore.setState({ currentScenarioId: null, lastServerGraphHash: null } as never)
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('a reading card row from CEE #3799', () => {
  it('is read whole with its family, structure and asked flags; a family this reader does not know is read as none, row kept', async () => {
    const parsed = await parseV5Response(new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } }), { coreRoute: true })
    if (parsed.kind !== 'response') throw new Error(parsed.kind)
    const read = readProposalFields(readTurnProposalFields(parsed.response))!.proposals[0]!.changes!
    expect(read).toHaveLength(19)
    const got = (id: string) => read.find((c) => c.id === id)!
    expect([got('launch_delay').family, got('launch_delay').structure, got('launch_delay').author]).toEqual(['quantity', true, 'olumi'])
    expect([got('proposed_delay').family, got('proposed_delay').asked]).toEqual(['quantity', true])
    expect(got('boss_reaction').family).toBeUndefined()
    expect(got('release_offset')).not.toHaveProperty('structure')
  })

  it('a fixed part of the structure is nobody’s: no “· Olumi’s” mark and no estimate style, though CEE still sends `author: olumi`', async () => {
    await mount()
    openAll()
    expect(line(STRUCTURE).textContent).toBe(STRUCTURE.label)
    expect(screen.queryByTestId(`proposal-change-olumi-${keyOf(STRUCTURE)}`)).toBeNull()
    expect(row(STRUCTURE).className).not.toContain(ESTIMATE_STYLE)
  })

  it('CONTRAST: Olumi’s own figure keeps its mark and style, as today', async () => {
    await mount()
    openAll()
    expect(line(OLUMIS).textContent).toBe(`${OLUMIS.label} · ${OLUMI_CHANGE_MARK}`)
    expect(screen.getByTestId(`proposal-change-olumi-${keyOf(OLUMIS)}`)).toBeTruthy()
    expect(row(OLUMIS).className).toContain(ESTIMATE_STYLE)
  })
})
