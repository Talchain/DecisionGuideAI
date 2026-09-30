/**
 * AIQ rows (5907300125) for the restored chat, on the pure reader/builder. The turn shape is Canvas's ask 5907308286
 * (the CEE read is not yet built): these rows bind the UI's side of that contract.
 */
import { describe, it, expect } from 'vitest'
import {
  readServerConversationTurns,
  buildRestoredThread,
  RESTORED_HISTORY_DIVIDER,
  RESTORED_STALE_FIGURES_NOTE,
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
    expect(m.filter((x) => x.sessionDivider).length).toBe(1)
    expect(m.slice(1).map((x) => x.role)).toEqual(['user', 'assistant', 'user', 'assistant'])
    expect(m.every((x) => x.actionChips === undefined && x.blocks === undefined)).toBe(true) // row 3: inert
  })

  it('row 2 (no edit, current Run computed BEFORE t2): only the older figure reply would be marked — t1 has no figure, t2 is after the Run', () => {
    const m = buildRestoredThread(TURNS, { runNotCurrent: false, currentRunComputedAt: '2026-09-30T05:41:00Z' })
    expect(m.some((x) => x.content.includes(RESTORED_STALE_FIGURES_NOTE))).toBe(false)
  })

  it('row 2 (edit → reload: the read says not current): every figure-bearing reply carries the line; a reply without figures does not', () => {
    const m = buildRestoredThread(TURNS, { runNotCurrent: true, currentRunComputedAt: '2026-09-30T05:41:00Z' })
    const t2 = m.find((x) => x.id === 'restored-assistant-t2')!
    const t1 = m.find((x) => x.id === 'restored-assistant-t1')!
    expect(t2.content.endsWith(RESTORED_STALE_FIGURES_NOTE)).toBe(true)
    expect(t1.content).not.toContain(RESTORED_STALE_FIGURES_NOTE)
  })

  it('row 2 (rerun → reload): a figure reply written before the NEW Run carries the line; one written after does not', () => {
    const m = buildRestoredThread(TURNS, { runNotCurrent: false, currentRunComputedAt: '2026-09-30T05:50:00Z' })
    expect(m.find((x) => x.id === 'restored-assistant-t2')!.content).toContain(RESTORED_STALE_FIGURES_NOTE)
  })

  it('nothing served → nothing restored', () => {
    expect(buildRestoredThread([], { runNotCurrent: false, currentRunComputedAt: null })).toEqual([])
  })
})
