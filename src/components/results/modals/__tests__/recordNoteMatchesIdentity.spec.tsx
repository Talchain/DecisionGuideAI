/**
 * ⭐⭐ THE MODAL TOLD EVERY SIGNED-OUT USER THEIR RECORD WAS SAVED TO AN ACCOUNT.
 *
 * `persistenceNote` — *"Your choice, confidence, expectation and review date are
 * saved to your account"* — rendered UNCONDITIONALLY. On deployed staging
 * (`VITE_AUTH_MODE="guest"`) signed-out is the DEFAULT fresh-visitor state, not
 * an edge case. The user was told that before and while capturing a record that
 * CEE refuses by design (DR001), and was then correctly told *"Decision recorded
 * on this device."* — two contradictory statements about one save, the false one
 * shown at the moment of deciding to record.
 *
 * `guestNote` was already written, already correct, and had ZERO render sites.
 *
 * ⚠ THE PREDICATE IS THE SAVE PATH'S OWN, NOT A SECOND ANSWER TO ONE QUESTION.
 * `commitDecisionRecord` decides guest-vs-account with
 * `const { accessToken } = await getSessionIdentity(); if (!accessToken) return
 * { status: 'guest' }`. This spec mocks that same function, so a change to the
 * save path's rule breaks this file rather than silently splitting the two.
 *
 * ⚠ `useAuth()` is deliberately not used: it THROWS without an `AuthProvider`
 * (`AuthContext.tsx:653-655`) and nothing in this directory wraps one.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'

vi.mock('../../../../services/decisionRecordCommitService', () => ({
  commitDecisionRecord: vi.fn(async () => ({ status: 'guest' as const })),
}))

const getSessionIdentity = vi.fn(async () => ({ userId: null, accessToken: null } as {
  userId: string | null
  accessToken: string | null
}))
vi.mock('../../../../lib/supabase', () => ({ getSessionIdentity: () => getSessionIdentity() }))

import { DecisionRecordModal, DECISION_RECORD_COPY } from '../DecisionRecordModal'
import { openDecisionRecord, useDecisionRecordStore } from '../decisionRecordStore'
import { useCanvasStore } from '../../../../canvas/store'

const optionNode = (id: string, label: string) => ({
  id, type: 'option', position: { x: 0, y: 0 }, data: { label },
})

function seed() {
  useCanvasStore.setState({
    nodes: [optionNode('opt_a', 'Bring on technical co-founder')] as never,
    results: { status: 'complete', progress: 100, hash: 'hash_run_1' } as never,
    optionNumbering: { opt_a: 1 },
    currentScenarioId: 'scn_test',
  } as never)
}

const note = () => screen.getByTestId('decision-record-note').textContent ?? ''

async function renderOpen() {
  seed()
  await act(async () => {
    openDecisionRecord()
  })
  await act(async () => {
    render(<DecisionRecordModal />)
  })
}

beforeEach(() => {
  useDecisionRecordStore.getState()._reset?.()
  getSessionIdentity.mockReset()
  getSessionIdentity.mockResolvedValue({ userId: null, accessToken: null })
})

describe('the persistence note matches who the user actually is', () => {
  it('PRECONDITION — the two notes are DIFFERENT strings, or nothing below discriminates', () => {
    // A guard whose two branches render the same text cannot fail. Pin it.
    expect(DECISION_RECORD_COPY.persistenceNote).not.toBe(DECISION_RECORD_COPY.guestNote)
    expect(DECISION_RECORD_COPY.persistenceNote).toContain('your account')
    expect(DECISION_RECORD_COPY.guestNote).toContain('Signed out')
  })

  it('⭐ SIGNED OUT — the note says signed out, and never claims an account', async () => {
    getSessionIdentity.mockResolvedValue({ userId: null, accessToken: null })
    await renderOpen()
    expect(note()).toBe(DECISION_RECORD_COPY.guestNote)
    // Bound to the CLAIM, not just to the string: the account sentence must be
    // absent from the note, however the copy is later reworded.
    expect(note()).not.toContain('saved to your account')
  })

  it('⭐ SIGNED IN — the account note returns, so this is not a blanket downgrade', async () => {
    getSessionIdentity.mockResolvedValue({ userId: 'u_1', accessToken: 'tok_abc' })
    await renderOpen()
    expect(note()).toBe(DECISION_RECORD_COPY.persistenceNote)
    expect(note()).toContain('your account')
  })

  it('⛔ IDENTITY UNRESOLVED — it understates, never overstates', async () => {
    // A promise that never settles: the account claim is the one that requires
    // proof, so the absence of proof must not license it.
    getSessionIdentity.mockImplementation(() => new Promise(() => {}) as never)
    await renderOpen()
    expect(note()).toBe(DECISION_RECORD_COPY.guestNote)
  })

  it('⛔ AN IDENTITY READ THAT FAILS IS NOT EVIDENCE OF AN ACCOUNT', async () => {
    getSessionIdentity.mockRejectedValue(new Error('network'))
    await renderOpen()
    expect(note()).toBe(DECISION_RECORD_COPY.guestNote)
  })

  /**
   * ⭐⭐ THE REVIEWER'S FINDING ON #1294, PINNED. `hasAccount` is component state
   * that OUTLIVES the open it was resolved for. A user who was signed in, signed
   * out in place, and re-opened the modal kept the stale `true` until the next
   * identity read resolved — and was shown "…are saved to your account" for that
   * window. The exact false claim this PR deletes, surviving the deletion.
   *
   * The second open deliberately uses a promise that NEVER SETTLES, so the only
   * thing that can make this pass is the synchronous reset. An awaited mock would
   * pass either way and prove nothing — the window is precisely the un-resolved
   * period, so the test has to live inside it.
   */
  it('⭐ SIGNING OUT BETWEEN OPENS — the stale account claim does not survive', async () => {
    getSessionIdentity.mockResolvedValue({ userId: 'u_1', accessToken: 'tok_abc' })
    await renderOpen()
    // PRECONDITION: we really are in the signed-in state, so the assertion below
    // is about the RESET and not about a modal that never claimed an account.
    expect(note()).toBe(DECISION_RECORD_COPY.persistenceNote)

    await act(async () => {
      useDecisionRecordStore.getState().close?.()
    })
    // Signed out in place; the next read will never settle.
    getSessionIdentity.mockImplementation(() => new Promise(() => {}) as never)
    await act(async () => {
      openDecisionRecord()
    })

    expect(note()).toBe(DECISION_RECORD_COPY.guestNote)
    expect(note()).not.toContain('saved to your account')
  })

  it('⛔ IT ASKS THE SAVE PATH’S OWN AUTHORITY — not a second one', async () => {
    // If a later change reads an auth context or a flag instead, this REDs.
    getSessionIdentity.mockResolvedValue({ userId: 'u_1', accessToken: 'tok_abc' })
    await renderOpen()
    expect(getSessionIdentity).toHaveBeenCalled()
  })
})
