/**
 * R2 diagnostic RED: the real transcript store loses the Agent's held controls.
 * This is a reproduction, NOT server-revalidation acceptance coverage. The
 * current reload /graph carrier has conversation text only; executable offers
 * never reach this restore path. Do not make this green by persisting chips.
 * The scope handoff records the missing server carrier. Once it exists, these
 * reload rows must consume that current response, with the same old transcript
 * used for both executable and non-executable server verdicts.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ConversationMessage } from '../../types'
import { SuggestedChips } from '../../zones/SuggestedChips'
import { buildSuggestedActionChips } from '../../../../v5/blocks/suggestedActionChips'
import {
  __resetTranscriptTombstonesForTests,
  loadTranscript,
  saveTranscript,
  TRANSCRIPT_STORAGE_KEY,
} from '../transcriptStore'

const SID = '561548c3-acd6-4488-b088-399c7cc15631'
const APPROVE = 'agent-approve-proposal:prop_0123456789abcdef0123456789abcdef'
const AMEND = 'agent-amend-proposal'
// CEE approval-chips.ts: propose_link_strength + AMEND_CHIP (not gmh_ card buttons).
const offers = [
  { id: APPROVE, label: 'Record this link', message: 'Yes, record that.' },
  { id: AMEND, label: 'Change something first', message: 'Before you apply it, I want to change some of it.' },
]
const held: ConversationMessage = {
  id: 'held-answer', role: 'assistant', content: 'Approve this change?',
  timestamp: new Date('2026-10-05T09:00:00.000Z'),
  actionChips: buildSuggestedActionChips([], offers),
}

function earlierPageLoad() {
  const file = JSON.parse(localStorage.getItem(TRANSCRIPT_STORAGE_KEY)!)
  file[SID].pageLoadId = 'previous-page-load'
  localStorage.setItem(TRANSCRIPT_STORAGE_KEY, JSON.stringify(file))
}

function show(message: ConversationMessage) {
  render(<>
    <p>{message.content}</p>
    <SuggestedChips chips={message.actionChips ?? []} onChipClick={vi.fn().mockResolvedValue(undefined)} />
  </>)
}

function expectControls() {
  for (const id of [APPROVE, AMEND]) {
    expect.soft(screen.queryByTestId(`suggested-chip-${id}`), `missing control ${id}`).not.toBeNull()
  }
}

beforeEach(() => {
  localStorage.clear()
  __resetTranscriptTombstonesForTests()
})

describe('R2 held controls through the real transcript store (diagnostic, carrier blocked)', () => {
  it('live positive control: both producer controls render by identity', () => {
    show(held)
    expectControls()
  })

  it('RED: save → previous-page restore retains the question but loses both controls', () => {
    expect(saveTranscript(SID, [held])).toBe(0)
    const saved = JSON.parse(localStorage.getItem(TRANSCRIPT_STORAGE_KEY)!)[SID].messages[0]
    expect(saved.actionChips).toBeUndefined()
    expect(saved.consentOffered).toBe(true)
    earlierPageLoad()
    const restored = loadTranscript(SID)!
    expect(restored.fromPreviousSession).toBe(true)
    show(restored.messages[0])
    expect(screen.getByText('Approve this change?')).toBeTruthy()
    expectControls()
  })

  it('RED: restored message → save → next-page restore still has neither control', () => {
    saveTranscript(SID, [held])
    earlierPageLoad()
    saveTranscript(SID, loadTranscript(SID)!.messages)
    earlierPageLoad()
    const restored = loadTranscript(SID)!
    expect(restored.fromPreviousSession).toBe(true)
    show(restored.messages[0])
    expect(screen.getByText('Approve this change?')).toBeTruthy()
    expectControls()
  })

  it('safety baseline: an old client offer alone does not restore an approve control', () => {
    // No current executable verdict reaches this browser. The old chip must
    // stay inert. This is NOT yet the required server no-longer-executable row.
    saveTranscript(SID, [held])
    earlierPageLoad()
    show(loadTranscript(SID)!.messages[0])
    expect(screen.queryByTestId(`suggested-chip-${APPROVE}`)).toBeNull()
    expect(screen.queryByTestId(`suggested-chip-${AMEND}`)).toBeNull()
  })
})
