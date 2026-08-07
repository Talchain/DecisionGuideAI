/**
 * useThreadPersistence — delivery-aware commit honesty (dress-rehearsal
 * trust item #3, persistence half).
 *
 * A user turn that never reached the server must NOT be committed to
 * storage as if it happened. Before this fix, the hook persisted every
 * visible user message at add-time (entry_status 'complete' + the always-on
 * insertConversationTurn), ~2s after the bubble appeared — two minutes
 * before a 504 could even come back. Storage then contradicted the served
 * history: the assistant would "deny" turns the transcript showed.
 *
 * Contract pinned here:
 *  - deliveryState 'pending'  → deferred: nothing persisted yet;
 *  - 'pending' → 'sent'       → persisted exactly once, at resolution;
 *  - 'pending' → 'failed'     → NEVER persisted (matches server truth);
 *  - deliveryState undefined  → legacy behaviour: persisted at add-time
 *    (V4 path and hydrated history are unaffected).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

vi.mock('../../../../flags', () => ({
  isThreadPersistEnabled: vi.fn(() => true),
}))

const mockAppendThreadEntries = vi.fn()
const mockUpdateThreadBlockState = vi.fn()
const mockInsertConversationTurn = vi.fn().mockResolvedValue(null)
vi.mock('../../../../services/threadService', () => ({
  appendThreadEntries: (...args: unknown[]) => mockAppendThreadEntries(...args),
  updateThreadBlockState: (...args: unknown[]) => mockUpdateThreadBlockState(...args),
  insertConversationTurn: (...args: unknown[]) => mockInsertConversationTurn(...args),
}))

vi.mock('../../../store', () => ({
  useCanvasStore: {
    getState: () => ({ scenarioPersistedToDb: true }),
  },
}))

vi.mock('../../../stores/resultsStore', () => ({
  useResultsStore: {
    getState: () => ({ results: { lastSnapshotId: null } }),
  },
}))

vi.mock('../../../../lib/supabase', () => ({
  getUserId: vi.fn(async () => 'user-abc-123'),
}))

import { useThreadPersistence } from '../useThreadPersistence'
import type { ConversationMessage } from '../../types'

let seq = 0
function makeUserMessage(
  text: string,
  overrides: Partial<ConversationMessage> = {},
): ConversationMessage {
  seq += 1
  return {
    id: `msg-${seq}`,
    role: 'user',
    content: text,
    timestamp: new Date(),
    ...overrides,
  } as ConversationMessage
}

async function settle() {
  await act(async () => { await vi.advanceTimersByTimeAsync(0) })
  await act(async () => { await vi.advanceTimersByTimeAsync(2100) })
}

/** User texts persisted via the legacy thread-entries path. */
function legacyUserTexts(): string[] {
  return mockAppendThreadEntries.mock.calls.flatMap((call) =>
    (call[1] as Array<{ role: string; user_message?: string }>)
      .filter((e) => e.role === 'user' && e.user_message !== undefined)
      .map((e) => e.user_message as string),
  )
}

/** User texts persisted via the always-on normalised-turn path. */
function normalisedUserTexts(): string[] {
  return mockInsertConversationTurn.mock.calls
    .map((call) => call[0] as { role: string; content?: string })
    .filter((a) => a.role === 'user')
    .map((a) => a.content as string)
}

/** All persisted user texts across both persistence paths. */
function persistedUserTexts(): string[] {
  return [...legacyUserTexts(), ...normalisedUserTexts()]
}

describe('useThreadPersistence — delivery-aware commit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    mockAppendThreadEntries.mockResolvedValue([])
    mockUpdateThreadBlockState.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('a pending user message is NOT persisted at add-time', async () => {
    const pending = makeUserMessage('in flight', { deliveryState: 'pending' })
    const { rerender } = renderHook(
      ({ msgs }) => useThreadPersistence('scenario-1', msgs),
      { initialProps: { msgs: [] as ConversationMessage[] } },
    )
    rerender({ msgs: [pending] })
    await settle()

    expect(persistedUserTexts()).toEqual([])
  })

  it('a pending message that resolves to sent is persisted exactly once', async () => {
    const pending = makeUserMessage('deliver me', { deliveryState: 'pending' })
    const { rerender } = renderHook(
      ({ msgs }) => useThreadPersistence('scenario-1', msgs),
      { initialProps: { msgs: [] as ConversationMessage[] } },
    )
    rerender({ msgs: [pending] })
    await settle()
    expect(persistedUserTexts()).toEqual([])

    // Same message id, resolved (updateMessage shallow-merge produces a new
    // object with the same id and length-unchanged array). Both persistence
    // paths fire exactly once each.
    rerender({ msgs: [{ ...pending, deliveryState: 'sent' as const }] })
    await settle()
    expect(legacyUserTexts()).toEqual(['deliver me'])
    expect(normalisedUserTexts()).toEqual(['deliver me'])

    // Re-render with no change must not double-persist.
    rerender({ msgs: [{ ...pending, deliveryState: 'sent' as const }] })
    await settle()
    expect(legacyUserTexts()).toEqual(['deliver me'])
    expect(normalisedUserTexts()).toEqual(['deliver me'])
  })

  it('a pending message that resolves to failed is NEVER persisted', async () => {
    const pending = makeUserMessage('lost to a 504', { deliveryState: 'pending' })
    const { rerender } = renderHook(
      ({ msgs }) => useThreadPersistence('scenario-1', msgs),
      { initialProps: { msgs: [] as ConversationMessage[] } },
    )
    rerender({ msgs: [pending] })
    await settle()
    rerender({ msgs: [{ ...pending, deliveryState: 'failed' as const }] })
    await settle()

    expect(persistedUserTexts()).toEqual([])
  })

  it('a message observed ALREADY failed (e.g. surface mounted after the failure) is never persisted', async () => {
    const failed = makeUserMessage('failed before mount', { deliveryState: 'failed' })
    const { rerender } = renderHook(
      ({ msgs }) => useThreadPersistence('scenario-1', msgs),
      { initialProps: { msgs: [] as ConversationMessage[] } },
    )
    rerender({ msgs: [failed] })
    await settle()

    expect(persistedUserTexts()).toEqual([])
  })

  it('failed-then-retried: the same bubble re-pended and resolved sent persists once', async () => {
    const msg = makeUserMessage('retry journey', { deliveryState: 'pending' })
    const { rerender } = renderHook(
      ({ msgs }) => useThreadPersistence('scenario-1', msgs),
      { initialProps: { msgs: [] as ConversationMessage[] } },
    )
    rerender({ msgs: [msg] })
    await settle()
    rerender({ msgs: [{ ...msg, deliveryState: 'failed' as const }] })
    await settle()
    expect(persistedUserTexts()).toEqual([])

    // Retry re-pends the SAME bubble, then it lands.
    rerender({ msgs: [{ ...msg, deliveryState: 'pending' as const }] })
    await settle()
    rerender({ msgs: [{ ...msg, deliveryState: 'sent' as const }] })
    await settle()
    expect(legacyUserTexts()).toEqual(['retry journey'])
    expect(normalisedUserTexts()).toEqual(['retry journey'])
  })

  it('legacy user messages without deliveryState keep add-time persistence (V4 / hydrated back-compat)', async () => {
    const legacy = makeUserMessage('legacy path')
    const { rerender } = renderHook(
      ({ msgs }) => useThreadPersistence('scenario-1', msgs),
      { initialProps: { msgs: [] as ConversationMessage[] } },
    )
    rerender({ msgs: [legacy] })
    await settle()

    expect(legacyUserTexts()).toEqual(['legacy path'])
    expect(normalisedUserTexts()).toEqual(['legacy path'])
  })
})
