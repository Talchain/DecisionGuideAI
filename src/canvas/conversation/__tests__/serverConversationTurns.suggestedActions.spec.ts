/** X4: CONTRACT-DERIVED CEE actions, not a served response capture. */
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { buildSuggestedActionChips } from '../../../v5/blocks/suggestedActionChips'
import { SuggestedChips } from '../zones/SuggestedChips'
import { buildRestoredThread, readServerConversationTurns, reconcileRestoredSuggestedActions } from '../serverConversationTurns'

const ACTIONS = [
  { id: 'agent-next-pre-mortem', label: 'Run a pre-mortem', message: 'Run a pre-mortem with me: imagine this decision went badly. What most plausibly went wrong?' },
  { id: 'agent-next-what-would-change', label: 'What would change this?', message: 'What would most likely change this result?' },
  { id: 'agent-next-strengthen', label: 'Strengthen the model', message: 'What would most strengthen this model?' },
]
const RUN = { runNotCurrent: false, currentRunComputedAt: null }
const OLDER = { turn_id: 't1', created_at: '2026-10-06T09:00:00Z', user_message: 'Earlier question', assistant_message: 'Earlier answer' }
const LAST = { turn_id: 't2', created_at: '2026-10-06T09:01:00Z', user_message: 'Run', assistant_message: 'The analysis is ready.' }
const last = <T>(items: readonly T[]) => items[items.length - 1]
const read = (raw: unknown) => readServerConversationTurns(raw)!
const restore = (raw: unknown) => buildRestoredThread(read(raw), RUN)

afterEach(cleanup)

describe('X4 — original next steps on the last restored answer', () => {
  it('row 1: restores the exact order, labels and live press payloads', async () => {
    const messages = restore([{ ...LAST, suggested_actions: ACTIONS }, OLDER])
    const answer = messages[messages.length - 1]
    const live = buildSuggestedActionChips([], ACTIONS)
    expect(answer.id).toBe('restored-assistant-t2')
    expect(answer.actionChips).toEqual(live)
    expect(answer.actionChips?.map(chip => chip.label)).toEqual(ACTIONS.map(action => action.label))
    expect(messages.slice(0, -1).every(message => message.actionChips === undefined)).toBe(true)
    const press = vi.fn(async () => {})
    render(createElement(SuggestedChips, { chips: answer.actionChips!, onChipClick: press }))
    for (let i = 0; i < ACTIONS.length; i++) {
      fireEvent.click(screen.getByRole('button', { name: ACTIONS[i].label }))
      expect(press.mock.calls[i]).toEqual([live[i]])
    }
  })

  it('row 2: ignores actions on a non-last turn; the same actions on the last turn are admitted', () => {
    expect(restore([{ ...OLDER, suggested_actions: ACTIONS }, LAST]).every(message => message.actionChips === undefined)).toBe(true)
    expect(last(restore([OLDER, { ...LAST, suggested_actions: ACTIONS }]))?.actionChips).toEqual(buildSuggestedActionChips([], ACTIONS))
    // Even a user-only final turn prevents the preceding answer from owning actions.
    expect(restore([{ ...OLDER, suggested_actions: ACTIONS }, { ...LAST, assistant_message: null }])
      .every(message => message.actionChips === undefined)).toBe(true)
  })

  it.each([
    ['action_type present', [{ ...ACTIONS[0], action_type: 'conversation' }]],
    ['detail present', [{ ...ACTIONS[0], detail: 'Extra key' }]],
    ['empty label', [{ ...ACTIONS[0], label: '' }]],
    ['blank id', [{ ...ACTIONS[0], id: ' ' }]],
    ['non-string message', [{ ...ACTIONS[0], message: 42 }]],
    ['missing message', [{ id: ACTIONS[0].id, label: ACTIONS[0].label }]],
    ['nine elements', Array.from({ length: 9 }, () => ACTIONS[0])],
    ['empty array', []],
    ['not an array', { ...ACTIONS[0] }],
    ['null member', [null]],
    ['one bad member', [ACTIONS[0], { ...ACTIONS[1], label: '' }]],
  ])('row 3: %s keeps the turn text, withholds the whole action array and has a valid positive twin', (_name, malformed) => {
    const turns = read([{ ...LAST, suggested_actions: malformed }])
    expect(turns).toEqual([{ turnId: LAST.turn_id, createdAt: LAST.created_at, userMessage: LAST.user_message, assistantMessage: LAST.assistant_message }])
    const messages = buildRestoredThread(turns, RUN)
    expect(last(messages)?.content).toBe(LAST.assistant_message)
    expect(messages.every(message => message.actionChips === undefined)).toBe(true)
    expect(last(restore([{ ...LAST, suggested_actions: ACTIONS }]))?.actionChips).toEqual(buildSuggestedActionChips([], ACTIONS))
  })

  it('row 4: absent actions deep-equal the four-field reader and original thread, with a contract-actions positive twin', () => {
    const turns = read([LAST])
    expect(turns).toEqual([{ turnId: 't2', createdAt: LAST.created_at, userMessage: 'Run', assistantMessage: LAST.assistant_message }])
    expect(buildRestoredThread(turns, RUN)).toEqual([
      { id: 'restored-divider', role: 'assistant', content: '', timestamp: new Date(LAST.created_at), synthetic: true, sessionDivider: 'Earlier in this conversation' },
      { id: 'restored-user-t2', role: 'user', content: 'Run', timestamp: new Date(LAST.created_at) },
      { id: 'restored-assistant-t2', role: 'assistant', content: LAST.assistant_message, timestamp: new Date(LAST.created_at) },
    ])
    expect(last(restore([{ ...LAST, suggested_actions: ACTIONS }]))?.actionChips).toEqual(buildSuggestedActionChips([], ACTIONS))
  })

  it('row 5: freshly armed held controls take priority; without held authority the exact next steps restore', () => {
    const proposalId = `prop_${'a'.repeat(32)}`
    const heldActions = [
      { id: `agent-approve-proposal:${proposalId}`, label: 'Record this link', message: 'Yes, record that.' },
      { id: 'agent-amend-proposal', label: 'Change something first', message: 'Before you apply it, I want to change some of it.' },
    ]
    const turns = read([{ ...LAST, suggested_actions: ACTIONS }])
    const messages = buildRestoredThread(turns, RUN, [{ turn_id: LAST.turn_id, proposal_id: proposalId, suggested_actions: heldActions }])
    expect(last(messages)?.heldProposalId).toBe(proposalId)
    expect(last(messages)?.actionChips).toEqual(buildSuggestedActionChips([], heldActions))
    expect(last(buildRestoredThread(turns, RUN))?.actionChips).toEqual(buildSuggestedActionChips([], ACTIONS))
  })

  it('local reconciliation requires an exact turn identity, never matching text', () => {
    const turns = read([{ ...LAST, suggested_actions: ACTIONS }])
    const answer = { id: 'local-answer', role: 'assistant' as const, content: LAST.assistant_message, timestamp: new Date(LAST.created_at) }
    expect(reconcileRestoredSuggestedActions([answer], turns)).toEqual([answer])
    expect(reconcileRestoredSuggestedActions([{ ...answer, clientTurnId: LAST.turn_id }], turns)[0].actionChips)
      .toEqual(buildSuggestedActionChips([], ACTIONS))
  })

  it.each([1, 8])('accepts the %i-action contract boundary without trimming or reordering', count => {
    const actions = Array.from({ length: count }, (_, i) => ({ id: `id-${i}`, label: ` Label ${i} `, message: ` Message ${i} ` }))
    expect(last(restore([{ ...LAST, suggested_actions: actions }]))?.actionChips).toEqual(buildSuggestedActionChips([], actions))
  })

  it('does not re-derive CEE offer validity from the local Run context', () => {
    const turns = read([{ ...LAST, suggested_actions: ACTIONS }])
    expect(last(buildRestoredThread(turns, { runNotCurrent: true, currentRunComputedAt: '2026-10-06T10:00:00Z' }))?.actionChips)
      .toEqual(buildSuggestedActionChips([], ACTIONS))
  })
})
