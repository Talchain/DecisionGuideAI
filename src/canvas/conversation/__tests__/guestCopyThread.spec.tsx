/**
 * S-G slice 2 — the thread of a decision COPIED from a guest at sign-in (DL ruling (a), 7 Oct 2026).
 *
 * The copy carries the guest's turns, re-keyed to the copy, but never the guest's Run. DL's rows:
 *   · the copied turns sit under a divider "From before you signed in";
 *   · any Run figures quoted there sit under it, and the surfaces say "Run again to see results here";
 *   · NOTHING in the copied thread may be read as a current result: with no Run (run=null in the design's words) the
 *     restored thread renders no live chance line — no live block, no next-step chip, and the chance sentence is marked
 *     as from an earlier analysis.
 * The chance sentence is the served cut-9 S4c form, word for word. Rows bind by message id (`restored-assistant-<turn>`).
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'

import {
  RESTORED_EARLIER_TAG,
  RESTORED_GUEST_COPY_DIVIDER,
  RESTORED_GUEST_COPY_NOTE,
  RESTORED_HISTORY_DIVIDER,
  buildRestoredThread,
  copiedTurnsQuoteFigures,
  readServerConversationTurns,
  type RestoreRunContext,
} from '../serverConversationTurns'
import {
  GUEST_COPY_RUN_AGAIN,
  readGuestCopiedAt,
  selectGuestCopyRunAgain,
  useGuestCopyOriginStore,
} from '../../stores/guestCopyOriginStore'
import { ReanalyseBar } from '../../components/model-tab/ReanalyseBar'
import { useCanvasStore } from '../../store'

const COPY_ID = 'fa02a890-0000-4000-8000-000000000001'
const SOURCE_ID = '657e63ef-f220-4fd5-9b4b-25e04334b3e4'
const COPIED_AT = '2026-10-07T08:40:58.000Z'
const CHANCE = '‘Launch Starter Tier’: about 51% chance of meeting your goal, in this model.'

/** The read's `conversation_turns`, as CEE serves them: two guest turns (28 Sep), one after the copy. */
const READ = [
  { turn_id: 'g-1', created_at: '2026-09-28T13:06:20.000Z', user_message: 'Should I hire a personal assistant or use an AI assistant?', assistant_message: 'I have drafted a model with two options.' },
  { turn_id: 'g-2', created_at: '2026-09-28T13:07:30.000Z', user_message: 'Run it', assistant_message: CHANCE,
    suggested_actions: [{ id: 'explain', label: 'Explain this result', message: 'Explain this result' }] },
  { turn_id: 'o-1', created_at: '2026-10-07T08:41:30.000Z', user_message: 'Add a budget of £200,000', assistant_message: 'I can add that as a limit.' },
]
const turns = readServerConversationTurns(READ)!
const NO_RUN: RestoreRunContext = { runNotCurrent: false, currentRunComputedAt: null }
const reply = (msgs: ReturnType<typeof buildRestoredThread>, turnId: string) => msgs.find(m => m.id === `restored-assistant-${turnId}`)

describe('the thread of a guest copy (DL rows)', () => {
  it('⭐ the copied turns sit under "From before you signed in"; the copy\'s own turns under "Earlier in this conversation"', () => {
    const msgs = buildRestoredThread(turns, { ...NO_RUN, copiedBefore: COPIED_AT })

    const dividers = msgs.filter(m => m.sessionDivider).map(m => m.sessionDivider)
    expect(dividers).toEqual([RESTORED_GUEST_COPY_DIVIDER, RESTORED_HISTORY_DIVIDER])
    const ids = msgs.map(m => m.id)
    expect(ids.indexOf('restored-guest-copy-divider')).toBe(0)
    expect(ids.indexOf('restored-assistant-g-2')).toBeLessThan(ids.indexOf('restored-divider'))
    expect(ids.indexOf('restored-assistant-o-1')).toBeGreaterThan(ids.indexOf('restored-divider'))
  })

  it('⭐ NO LIVE CHANCE LINE with no Run: the chance sentence is marked as an earlier analysis, says Run again, and nothing live is attached', () => {
    const msgs = buildRestoredThread(turns, { ...NO_RUN, copiedBefore: COPIED_AT })
    const chance = reply(msgs, 'g-2')!

    expect(chance.restoredTag).toBe(RESTORED_EARLIER_TAG)
    expect(chance.content).toBe(`${CHANCE}\n\n${RESTORED_GUEST_COPY_NOTE}`)
    expect(RESTORED_GUEST_COPY_NOTE).toContain(GUEST_COPY_RUN_AGAIN)
    // Nothing a renderer could show as live: no blocks, no next-step chips (the guest session's "Explain this result").
    for (const m of msgs.filter(m => m.id.startsWith('restored-'))) {
      expect(m.blocks ?? []).toEqual([])
    }
    expect(chance.actionChips ?? []).toEqual([])
  })

  it('CONTRAST (the defect without slice 2): the same turns with no copy time read as current history — the chance sentence untagged', () => {
    const msgs = buildRestoredThread(turns, NO_RUN)

    expect(msgs.filter(m => m.sessionDivider).map(m => m.sessionDivider)).toEqual([RESTORED_HISTORY_DIVIDER])
    expect(reply(msgs, 'g-2')!.restoredTag).toBeUndefined()
    expect(reply(msgs, 'g-2')!.content).toBe(CHANCE)
  })

  it('a copy whose own last turn has next steps still arms them; a copied last turn never does', () => {
    const own = readServerConversationTurns([...READ.slice(0, 2), { ...READ[2], suggested_actions: [{ id: 'run', label: 'Run the analysis', message: 'Run the analysis' }] }])!
    const withOwn = buildRestoredThread(own, { ...NO_RUN, copiedBefore: COPIED_AT })
    expect(reply(withOwn, 'o-1')!.actionChips?.map(c => c.label)).toEqual(['Run the analysis'])

    const copiedOnly = buildRestoredThread(turns.slice(0, 2), { ...NO_RUN, copiedBefore: COPIED_AT })
    expect(reply(copiedOnly, 'g-2')!.actionChips ?? []).toEqual([])
    expect(copiedOnly.filter(m => m.sessionDivider).map(m => m.sessionDivider)).toEqual([RESTORED_GUEST_COPY_DIVIDER])
  })

  it('a copied thread with no figures gets the divider but no Run-again note', () => {
    const plain = buildRestoredThread(turns.slice(0, 1), { ...NO_RUN, copiedBefore: COPIED_AT })
    expect(reply(plain, 'g-1')!.content).toBe('I have drafted a model with two options.')
    expect(reply(plain, 'g-1')!.restoredTag).toBeUndefined()
    expect(copiedTurnsQuoteFigures(turns.slice(0, 1), COPIED_AT)).toBe(false)
    expect(copiedTurnsQuoteFigures(turns, COPIED_AT)).toBe(true)
  })

  it('CONTROL: a duplicate (a source, but every turn after its creation) has no "before you signed in" part', () => {
    const msgs = buildRestoredThread(turns, { ...NO_RUN, copiedBefore: '2026-09-01T00:00:00.000Z' })
    expect(msgs.filter(m => m.sessionDivider).map(m => m.sessionDivider)).toEqual([RESTORED_HISTORY_DIVIDER])
    expect(copiedTurnsQuoteFigures(turns, '2026-09-01T00:00:00.000Z')).toBe(false)
  })
})

describe('the copy origin: the owner load\'s row says which decision is a guest copy', () => {
  beforeEach(() => useGuestCopyOriginStore.getState().reset())

  it('a row with a source and a time is a copy; Run-again is due only once a copied reply quotes a figure, for THAT decision', () => {
    useGuestCopyOriginStore.getState().recordScenarioRow({ id: COPY_ID, source_scenario_id: SOURCE_ID, created_at: COPIED_AT })
    expect(readGuestCopiedAt(COPY_ID)).toBe(COPIED_AT)
    expect(selectGuestCopyRunAgain(useGuestCopyOriginStore.getState(), COPY_ID)).toBe(false)

    useGuestCopyOriginStore.getState().noteEarlierAnalysisCopied(COPY_ID)
    expect(selectGuestCopyRunAgain(useGuestCopyOriginStore.getState(), COPY_ID)).toBe(true)
    expect(selectGuestCopyRunAgain(useGuestCopyOriginStore.getState(), SOURCE_ID)).toBe(false)
    expect(readGuestCopiedAt(SOURCE_ID)).toBeNull()
  })

  it('a row with no source clears it (opening another decision)', () => {
    useGuestCopyOriginStore.getState().recordScenarioRow({ id: COPY_ID, source_scenario_id: SOURCE_ID, created_at: COPIED_AT })
    useGuestCopyOriginStore.getState().recordScenarioRow({ id: SOURCE_ID, source_scenario_id: null, created_at: COPIED_AT })
    expect(readGuestCopiedAt(COPY_ID)).toBeNull()
    expect(useGuestCopyOriginStore.getState().origin).toBeNull()
  })
})

describe('the Model tab\'s never-run bar on a guest copy', () => {
  afterEach(() => { cleanup(); useGuestCopyOriginStore.getState().reset() })

  it('⭐ says "Run again to see results here" when the copied replies quote an analysis; otherwise the never-run sentence', () => {
    useCanvasStore.setState({ currentScenarioId: COPY_ID, hasCompletedFirstRun: false } as never)
    useGuestCopyOriginStore.getState().recordScenarioRow({ id: COPY_ID, source_scenario_id: SOURCE_ID, created_at: COPIED_AT })
    const { rerender } = render(<ReanalyseBar onReanalyse={() => {}} canRun blockedReason={undefined} />)
    const bar = () => screen.getByTestId('reanalyse-bar')
    expect(bar()).toHaveTextContent('This model has not been analysed yet.')

    useGuestCopyOriginStore.getState().noteEarlierAnalysisCopied(COPY_ID)
    rerender(<ReanalyseBar onReanalyse={() => {}} canRun blockedReason={undefined} />)
    expect(within(bar()).getByText(GUEST_COPY_RUN_AGAIN)).toBeInTheDocument()
    expect(bar()).not.toHaveTextContent('This model has not been analysed yet.')
  })
})
