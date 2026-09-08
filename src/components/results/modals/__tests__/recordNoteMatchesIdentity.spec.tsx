/**
 * ⭐⭐ THE MODAL'S IDENTITY DISCLOSURE — FOUR BRANCHES, PINNED BY ZERO SPECS.
 *
 * #1316 shipped a four-state note telling the user whether their decision record
 * reaches their account. It is live, it is correct, and NOTHING GUARDED IT.
 * Measured on staging before this file, sweeping every spec in `src/` with plain
 * substrings:
 *
 *     guestNote 0 · identityPendingNote 0 · localOnlyNote 0 · persistenceNote 0
 *     CONTRAST (toastSavedLocal) 2   ← same sweep, so the probe was not blind
 *     CONTROL  (zzNotAKey)        0
 *
 * So a refactor of `DecisionRecordModal.tsx:143-148` turned nothing red — and the
 * defect class it guards against is telling a SIGNED-OUT user their decision is
 * saved to their account, which is the harm #1294 and #1316 both existed to close.
 *
 * ⚠ THE PREDICATE IS THE COMPONENT'S OWN, NOT A SECOND ANSWER. These tests drive
 * `useAuth()` and the canvas scenario id — the two inputs the component actually
 * branches on — so a change to its rule breaks this file rather than silently
 * splitting the two. They do not re-implement the ternary.
 *
 * ⚠ `useAuth` is MOCKED because it THROWS without an `AuthProvider`
 * (`AuthContext.tsx`), and nothing in this directory wraps one.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'

const authState = vi.hoisted(() => ({
  user: { id: 'u_1' } as { id: string } | null,
  loading: false,
  authenticated: true,
}))
vi.mock('../../../../contexts/AuthContext', () => ({ useAuth: () => authState }))
vi.mock('../../../../services/decisionRecordCommitService', () => ({
  commitDecisionRecord: vi.fn(async () => ({ status: 'guest' as const })),
}))

import { DecisionRecordModal, DECISION_RECORD_COPY } from '../DecisionRecordModal'
import { openDecisionRecord, useDecisionRecordStore } from '../decisionRecordStore'
import { useCanvasStore } from '../../../../canvas/store'

const optionNode = (id: string, label: string) => ({
  id, type: 'option', position: { x: 0, y: 0 }, data: { label },
})

function seed(scenarioId: string | null = 'scn_test') {
  useCanvasStore.setState({
    nodes: [optionNode('opt_a', 'Bring on technical co-founder')] as never,
    results: { status: 'complete', progress: 100, hash: 'h1' } as never,
    optionNumbering: { opt_a: 1 },
    currentScenarioId: scenarioId,
  } as never)
}

const note = () => screen.getByTestId('decision-record-note').textContent ?? ''

function open(state: { user: { id: string } | null; loading: boolean }, scenarioId: string | null = 'scn_test') {
  authState.user = state.user
  authState.loading = state.loading
  seed(scenarioId)
  act(() => openDecisionRecord())
  render(<DecisionRecordModal />)
}

beforeEach(() => {
  useDecisionRecordStore.getState()._reset?.()
  authState.user = { id: 'u_1' }
  authState.loading = false
})

describe('the decision-record note matches who the user actually is', () => {
  it('PRECONDITION: the four notes are DIFFERENT strings, or nothing below discriminates', () => {
    const all = [
      DECISION_RECORD_COPY.persistenceNote,
      DECISION_RECORD_COPY.guestNote,
      DECISION_RECORD_COPY.identityPendingNote,
      DECISION_RECORD_COPY.localOnlyNote,
    ]
    expect(new Set(all).size).toBe(4)
  })

  it('⭐ SIGNED OUT — says so, and never claims an account', () => {
    open({ user: null, loading: false })
    expect(note()).toBe(DECISION_RECORD_COPY.guestNote)
    // Bound to the CLAIM, not the string, so a reword cannot reintroduce it.
    expect(note()).not.toMatch(/to your account/i)
  })

  it('⛔ IDENTITY UNRESOLVED — it does not claim an account while still checking', () => {
    // `loading` is the state a signed-out user passes THROUGH on every open.
    // Claiming the account here is the same lie, one tick earlier.
    open({ user: { id: 'u_1' }, loading: true })
    expect(note()).toBe(DECISION_RECORD_COPY.identityPendingNote)
    expect(note()).not.toMatch(/will be saved to your account/i)
  })

  it('⛔ SIGNED IN BUT NO SCENARIO — account saving is unavailable, and says so', () => {
    // `canAttemptAccountSave` needs a non-empty scenario id. Without one the
    // record genuinely cannot reach the account, so the account note would be
    // false even though the user IS signed in.
    open({ user: { id: 'u_1' }, loading: false }, '')
    expect(note()).toBe(DECISION_RECORD_COPY.localOnlyNote)
    expect(note()).not.toMatch(/to your account\b(?!.*unavailable)/i)
  })

  it('⭐ SIGNED IN WITH A SCENARIO — the account note returns, so this is not a blanket downgrade', () => {
    open({ user: { id: 'u_1' }, loading: false })
    expect(note()).toBe(DECISION_RECORD_COPY.persistenceNote)
    expect(note()).toMatch(/your account/i)
  })

  /**
   * ⚠ THE NOTE PROMISES AN ATTEMPT, NOT A SUCCESS — pinned because the
   * difference is the whole point of the four states. Before saving, identity
   * licenses a TRY; only `savedRemoteNote` may claim the save happened.
   */
  it('the pre-save note never asserts the record IS on the account', () => {
    open({ user: { id: 'u_1' }, loading: false })
    expect(note()).not.toBe(DECISION_RECORD_COPY.savedRemoteNote)
    expect(DECISION_RECORD_COPY.persistenceNote).toMatch(/try to save/i)
  })
})
