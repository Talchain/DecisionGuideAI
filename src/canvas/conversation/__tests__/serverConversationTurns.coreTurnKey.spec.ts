/**
 * DL follow-up to #2860 (20 Oct 2026): after a core turn's cold read, the person sees Olumi's REPLY, not just the model.
 * Core keys its answer row by the body `turn_id` (CEE `agent-v1-turn.ts`, `rowTurnId = turnId ?? …`), never by the
 * X-Request-Id, so the reconcile matches a core bubble by `deliveryTurnId`. Other lanes keep `deliveryRequestId`.
 */
import { describe, it, expect } from 'vitest'
import { readServerConversationTurns, reconcileUnconfirmedServerTurns } from '../serverConversationTurns'
import type { ConversationMessage } from '../types'

const SCENARIO = 'a0a0a0a0-b1b1-4c2c-8d3d-e4e4e4e4e4e4'
const TURN_ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7'
const REQUEST_ID = '0b6c1d52-1f0e-4a43-9c4e-2d8d7a1b9f10'
const RUN = { runNotCurrent: false, currentRunComputedAt: null }
// The cold read's own shape: POST /assist/v1/scenarios/:id/graph, `conversation_turns[]` (answer rows only).
const COLD_READ = readServerConversationTurns([
  { turn_id: TURN_ID, created_at: '2026-10-20T22:05:11.000Z', user_message: 'We are comparing two staffing options.', assistant_message: 'I have built the model with your two options.' },
])!

const userBubble = (extra: Partial<ConversationMessage>): ConversationMessage =>
  ({ id: 'u1', role: 'user', content: 'We are comparing two staffing options.', timestamp: new Date(), deliveryState: 'sent', deliveryScenarioId: SCENARIO, ...extra }) as ConversationMessage
const notice: ConversationMessage = { id: 'n1', role: 'assistant', synthetic: true, content: 'Olumi is still finishing this.', timestamp: new Date(),
  deliveryTurnId: TURN_ID, deliveryScenarioId: SCENARIO } as ConversationMessage

describe('a core bubble reconciles by the body turn_id', () => {
  it('shows the stored reply, settles the bubble and drops the still-finishing notice', () => {
    const out = reconcileUnconfirmedServerTurns([userBubble({ deliveryTurnId: TURN_ID }), notice], SCENARIO, COLD_READ, RUN)
    expect(out.some((m) => m.role === 'assistant' && String(m.content).includes('I have built the model'))).toBe(true)
    expect(out.find((m) => m.id === 'u1')?.deliveryTurnId).toBeUndefined()
    expect(out.find((m) => m.id === 'n1')).toBeUndefined()
  })

  it('CONTRAST (the gap this closes): keyed by the X-Request-Id, the core answer row never matches', () => {
    const out = reconcileUnconfirmedServerTurns([userBubble({ deliveryRequestId: REQUEST_ID })], SCENARIO, COLD_READ, RUN)
    expect(out.some((m) => m.role === 'assistant')).toBe(false)
  })

  it('CONTRAST: other lanes still reconcile by deliveryRequestId when the row carries it', () => {
    const legacy = readServerConversationTurns([{ turn_id: REQUEST_ID, created_at: '2026-10-20T22:05:11.000Z', user_message: 'hi', assistant_message: 'Hello.' }])!
    const out = reconcileUnconfirmedServerTurns([userBubble({ deliveryRequestId: REQUEST_ID })], SCENARIO, legacy, RUN)
    expect(out.some((m) => m.role === 'assistant' && String(m.content).includes('Hello.'))).toBe(true)
  })
})
