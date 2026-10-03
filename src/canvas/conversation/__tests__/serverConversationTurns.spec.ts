/**
 * AIQ rows (5907300125) for the restored chat, on the pure reader/builder. The turn shape is Canvas's ask 5907308286
 * (the CEE read is not yet built): these rows bind the UI's side of that contract.
 */
import { describe, it, expect } from 'vitest'
import served from './fixtures/served-restored-chat-4644486f.json'
import {
  readServerConversationTurns,
  buildRestoredThread,
  RESTORED_HISTORY_DIVIDER,
  RESTORED_STALE_FIGURES_NOTE,
  RESTORED_EARLIER_TAG,
  RESTORED_AT_CAP_DIVIDER,
  CONVERSATION_TURNS_CAP,
} from '../serverConversationTurns'

const TURNS = readServerConversationTurns([
  { turn_id: 't2', created_at: '2026-09-30T05:42:00Z', user_message: 'How often does £57 reach the target?', assistant_message: 'The £57 option reaches the target in about 24.7% of model runs.' },
  { turn_id: 't1', created_at: '2026-09-30T05:40:00Z', user_message: 'Should we raise the price?', assistant_message: 'I have drafted the model on the canvas.' },
  { turn_id: 'bad', created_at: 'not a date', user_message: 'x', assistant_message: 'y' },
])!

describe('the chat survives a reload — reader and builder', () => {
  it('reads oldest first; drops entries without an id or a valid time; absent field → null', () => {
    expect(TURNS.map((t) => t.turnId)).toEqual(['t1', 't2'])
    expect(readServerConversationTurns(undefined)).toBeNull()
    expect(readServerConversationTurns({})).toBeNull()
  })

  it('row 1: history reads as history — ONE divider first, then the turns in order, as plain text with no chips or blocks', () => {
    const m = buildRestoredThread(TURNS, { runNotCurrent: false, currentRunComputedAt: '2026-09-30T05:41:00Z' })
    expect(m[0].sessionDivider).toBe(RESTORED_HISTORY_DIVIDER)
    // Nothing earlier states a figure here, so the only divider is the history one.
    expect(m.filter((x) => x.sessionDivider).length).toBe(1)
    expect(m.slice(1).map((x) => x.role)).toEqual(['user', 'assistant', 'user', 'assistant'])
    expect(m.every((x) => x.actionChips === undefined && x.blocks === undefined)).toBe(true) // row 3: inert
  })

  it('row 2 (no edit, current Run computed BEFORE t2): only the older figure reply would be marked — t1 has no figure, t2 is after the Run', () => {
    const m = buildRestoredThread(TURNS, { runNotCurrent: false, currentRunComputedAt: '2026-09-30T05:41:00Z' })
    expect(m.some((x) => x.restoredTag !== undefined || x.content.includes(RESTORED_STALE_FIGURES_NOTE))).toBe(false)
  })

  it('row 2 (edit → reload: the read says not current): every figure-bearing reply carries the line; a reply without figures does not', () => {
    const m = buildRestoredThread(TURNS, { runNotCurrent: true, currentRunComputedAt: '2026-09-30T05:41:00Z' })
    const t2 = m.find((x) => x.id === 'restored-assistant-t2')!
    const t1 = m.find((x) => x.id === 'restored-assistant-t1')!
    expect(t2.restoredTag).toBe(RESTORED_EARLIER_TAG)
    expect(t1.restoredTag).toBeUndefined()
    // The full sentence is said ONCE: it closes the last earlier reply (here t2), never a divider.
    expect(m.filter((x) => x.content.includes(RESTORED_STALE_FIGURES_NOTE)).map((x) => x.id)).toEqual(['restored-assistant-t2'])
    expect(t2.content.endsWith(RESTORED_STALE_FIGURES_NOTE)).toBe(true)
    expect(m.filter((x) => x.sessionDivider).length).toBe(1)
  })

  it('row 2 (rerun → reload): a figure reply written before the NEW Run carries the line; one written after does not', () => {
    const m = buildRestoredThread(TURNS, { runNotCurrent: false, currentRunComputedAt: '2026-09-30T05:50:00Z' })
    expect(m.find((x) => x.id === 'restored-assistant-t2')!.restoredTag).toBe(RESTORED_EARLIER_TAG)
    expect(m.filter((x) => x.content.includes(RESTORED_STALE_FIGURES_NOTE))).toHaveLength(1)
  })

  it('⭐ SERVED (R3 4644486f, Paul\'s step-5 reload): the note is said ONCE, after the last reply written before the current Run; every earlier figure reply carries the tag; the reply that reports the current Run carries neither', () => {
    const turns = readServerConversationTurns(served.conversation_turns)!
    expect(turns.length, 'precondition: the served chat').toBe(11)
    const m = buildRestoredThread(turns, { runNotCurrent: false, currentRunComputedAt: served.run_state.computed_at })
    const notes = m.filter((x) => x.content.includes(RESTORED_STALE_FIGURES_NOTE))
    expect(notes).toHaveLength(1)
    const at = m.indexOf(notes[0])
    const runAt = Date.parse(served.run_state.computed_at)
    // The note closes the LAST reply written before the current Run: it is earlier, and every reply after it is not.
    expect(notes[0].timestamp.getTime()).toBeLessThan(runAt)
    expect(m.slice(at + 1).filter((x) => x.role === 'assistant').every((x) => x.timestamp.getTime() >= runAt)).toBe(true)
    const tagged = m.filter((x) => x.restoredTag === RESTORED_EARLIER_TAG)
    expect(tagged.length, 'every earlier figure reply is tagged (was a full sentence under each)').toBeGreaterThan(1)
    expect(tagged.every((x) => m.indexOf(x) <= at)).toBe(true)
    expect(m.filter((x) => x.sessionDivider).length, 'no extra divider (a trailing one is rewritten on the next load)').toBe(1)
  })

  it('nothing served → nothing restored', () => {
    expect(buildRestoredThread([], { runNotCurrent: false, currentRunComputedAt: null })).toEqual([])
  })

  it('AIQ 5907906662: a read AT the cap (50) says earlier messages are not shown; under the cap it does not', () => {
    const many = readServerConversationTurns(Array.from({ length: CONVERSATION_TURNS_CAP }, (_, i) => ({
      turn_id: `t${i}`, created_at: new Date(Date.UTC(2026, 8, 30, 5, i)).toISOString(), user_message: `q${i}`, assistant_message: 'ok',
    })))!
    const run = { runNotCurrent: false, currentRunComputedAt: null }
    expect(buildRestoredThread(many, run)[0].sessionDivider).toBe(RESTORED_AT_CAP_DIVIDER)
    expect(RESTORED_AT_CAP_DIVIDER).toContain('any earlier ones are not')
    expect(buildRestoredThread(many.slice(1), run)[0].sessionDivider).toBe(RESTORED_HISTORY_DIVIDER)
  })
})
