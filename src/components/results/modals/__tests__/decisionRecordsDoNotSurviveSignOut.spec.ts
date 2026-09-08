/**
 * ⭐⭐⭐ ONE USER'S DECISION RECORDS MUST NOT REACH THE NEXT USER OF THE MACHINE.
 *
 * THE DEFECT THIS PINS, and it is a consent defect, not a tidiness one.
 * `decisionRecordStore` moved from `sessionStorage` to `localStorage` on
 * 7 Sep 2026 — correctly, because a record whose whole purpose is to be read
 * back on a LATER visit cannot live in a store the tab empties. But that move
 * turned a record that died with the tab into one that is PERMANENT, and
 * nothing cleared it on sign-out.
 *
 * Two facts make it reachable rather than theoretical:
 *
 *   1. NOTHING AUTO-CREATES A SCENARIO ON A RUN. A record captured on an
 *      unsaved canvas is keyed by `resolveScenarioKey(null)` — the single
 *      shared literal `__unscoped__` — which EVERY later session on this
 *      browser profile also resolves to.
 *   2. THE PANEL NOW READS RECORDS BACK. Before, a stranded record was
 *      invisible; the read-back renders it as the current user's own.
 *
 * So on a shared machine — a workshop laptop, a hot desk, a demo box — the
 * next person to sign in saw the previous person's chosen option, their stated
 * confidence, their private rationale and the assumption they were watching.
 *
 * ⚠⚠ THE HOOK IS THE DELIBERATE `signOut`, NOT `clearAuthStates`, AND THE
 * DIFFERENCE IS THE WHOLE DESIGN. `clearAuthStates` also runs from
 * `handleAuthStateChange` on EVERY null session — including the first page
 * load of someone who has never signed in. Clearing there would destroy a
 * guest's records on every visit, which `decisionRecordStore`'s own header
 * calls a worse failure than refusing to record one. The last describe below
 * is the guard on that distinction.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  clearDecisionRecordsOnSignOut,
  useDecisionRecordStore,
  type DecisionRecord,
} from '../decisionRecordStore'
import { resolveScenarioKey, UNSCOPED_SCENARIO_KEY } from '../scenarioKey'

const STORAGE_KEY = 'decisionRecord.v1'

const record = (label: string): DecisionRecord => ({
  optionId: `opt-${label}`,
  optionLabel: label,
  optionNumber: 1,
  confidence: 80,
  expectation: 'this is the private forward claim',
  rationale: 'this is the private rationale',
  assumptionToWatch: 'this is the private assumption',
  revisitTrigger: 'this is the private trigger',
  analysisHash: null,
  savedAt: Date.UTC(2026, 8, 7, 9, 0, 0),
  remote: null,
})

beforeEach(() => {
  localStorage.removeItem(STORAGE_KEY)
  useDecisionRecordStore.setState({ isOpen: false, byScenario: {} })
})
afterEach(() => {
  localStorage.removeItem(STORAGE_KEY)
})

/**
 * ⭐ THE POSITIVE CONTROL. Every assertion below is that something is GONE.
 * If the harness could not put a record there in the first place — a changed
 * storage key, a store that silently no-ops, a jsdom without localStorage —
 * all of them would pass while testing nothing (CLAUDE.md trap 13).
 */
describe('THE HARNESS CAN PUT A RECORD ON THIS DEVICE (positive control)', () => {
  it('a saved record is readable from localStorage, and survives a reload', () => {
    useDecisionRecordStore.getState().saveRecord('scenario-alice', record('Alice’s choice'))

    const raw = localStorage.getItem(STORAGE_KEY)
    expect(raw, 'nothing was written to localStorage — the harness proves nothing').not.toBeNull()
    expect(raw).toContain('Alice’s choice')

    // Simulate a new tab: drop memory, re-read storage.
    useDecisionRecordStore.setState({ byScenario: {} })
    useDecisionRecordStore.getState()._rehydrateForTests()
    expect(useDecisionRecordStore.getState().byScenario['scenario-alice']).toBeTruthy()
  })

  it('an unsaved canvas keys to the ONE shared literal, which is what makes this reachable', () => {
    expect(resolveScenarioKey(null)).toBe(UNSCOPED_SCENARIO_KEY)
    expect(resolveScenarioKey(undefined)).toBe(UNSCOPED_SCENARIO_KEY)
    expect(resolveScenarioKey('')).toBe(UNSCOPED_SCENARIO_KEY)
  })
})

describe('sign-out forgets every decision record on this device', () => {
  it('clears a scenario-keyed record from memory AND from storage', () => {
    useDecisionRecordStore.getState().saveRecord('scenario-alice', record('Alice’s choice'))

    clearDecisionRecordsOnSignOut()

    expect(useDecisionRecordStore.getState().byScenario).toEqual({})
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  /**
   * ⭐⭐ THE CASE THE DEFECT WAS ACTUALLY ABOUT. A record captured before any
   * scenario existed lands under `__unscoped__`, which the next user's session
   * resolves to as well — so this is the one that crosses between people.
   */
  it('clears an UNSCOPED record — the key the next user will also resolve to', () => {
    useDecisionRecordStore
      .getState()
      .saveRecord(resolveScenarioKey(null), record('Alice’s unsaved-canvas choice'))
    expect(
      useDecisionRecordStore.getState().byScenario[UNSCOPED_SCENARIO_KEY],
    ).toBeTruthy()

    clearDecisionRecordsOnSignOut()

    expect(useDecisionRecordStore.getState().byScenario[UNSCOPED_SCENARIO_KEY]).toBeUndefined()
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('clears ALL of them, not just the current one', () => {
    const s = useDecisionRecordStore.getState()
    s.saveRecord('scenario-alice', record('Alice’s choice'))
    s.saveRecord('scenario-beta', record('Alice’s other choice'))
    s.saveRecord(UNSCOPED_SCENARIO_KEY, record('Alice’s unsaved-canvas choice'))
    expect(Object.keys(useDecisionRecordStore.getState().byScenario)).toHaveLength(3)

    clearDecisionRecordsOnSignOut()

    expect(Object.keys(useDecisionRecordStore.getState().byScenario)).toHaveLength(0)
  })

  /**
   * ⭐⭐ THE END-TO-END STATEMENT, and the one that would have caught the
   * defect on its own: after a sign-out, a fresh session on this browser can
   * read NOTHING of the previous user's — not the choice, and not any of the
   * private free-text fields the read-back renders.
   */
  it('a fresh session after sign-out sees none of the previous user’s record', () => {
    useDecisionRecordStore
      .getState()
      .saveRecord(UNSCOPED_SCENARIO_KEY, record('Alice’s unsaved-canvas choice'))

    clearDecisionRecordsOnSignOut()

    // A new tab: memory dropped, storage re-read — exactly what the next
    // person at this machine gets.
    useDecisionRecordStore.setState({ byScenario: {} })
    useDecisionRecordStore.getState()._rehydrateForTests()

    const serialised = JSON.stringify(useDecisionRecordStore.getState().byScenario)
    expect(useDecisionRecordStore.getState().byScenario).toEqual({})
    for (const secret of [
      'Alice’s unsaved-canvas choice',
      'this is the private rationale',
      'this is the private assumption',
      'this is the private forward claim',
      'this is the private trigger',
    ]) {
      expect(serialised, `"${secret}" survived sign-out`).not.toContain(secret)
    }
  })

  it('is safe to call when there is nothing to clear', () => {
    expect(() => clearDecisionRecordsOnSignOut()).not.toThrow()
    expect(useDecisionRecordStore.getState().byScenario).toEqual({})
  })
})

/**
 * ⭐⭐ THE CALL SITES ARE PINNED, BECAUSE A CLEAR NOTHING CALLS IS NOT A CLEAR.
 *
 * ⚠ This reads the AuthContext SOURCE rather than driving the provider, and
 * the reason is stated so it is not mistaken for laziness: `AuthProvider`
 * needs a router, a live Supabase client and a session, and a render harness
 * for it would prove less than this does while being far easier to write
 * around. What must be true is structural — the clear is invoked from BOTH
 * `signOut` branches and from NEITHER of the passive null-session paths — and
 * that is a property of the file.
 */
describe('the clear is wired to the deliberate sign-out, and only there', () => {
  /** `process.cwd()`-relative, the pattern every other source-scan spec here
   *  uses (`collabParticipantRouteIsPublic.spec.tsx` and siblings) — vitest
   *  does not hand these files a `file:` `import.meta.url`. */
  const readSource = (rel: string): string => readFileSync(resolve(process.cwd(), rel), 'utf8')

  it('both signOut implementations call it', () => {
    const src = readSource('src/contexts/AuthContext.tsx')
    // Contrast control: the file really does have two sign-out branches, so a
    // count of 2 below is not an accident of a file that has one.
    expect(
      (src.match(/signOut: async \(\) => \{/g) ?? []).length,
      'AuthContext no longer has two signOut branches — re-derive this guard',
    ).toBe(2)
    expect((src.match(/clearDecisionRecordsOnSignOut\(\)/g) ?? []).length).toBe(2)
  })

  /**
   * ⭐ THE NEGATIVE HALF, AND IT IS NOT A STYLE PREFERENCE. `clearAuthStates`
   * runs on every null session, including a first visit by someone who has
   * never signed in. Wiring the clear there would delete a guest's records on
   * every page load — the store's header calls that a worse failure than
   * refusing to record one.
   */
  it('it is NOT wired into clearAuthStates, which fires on every null session', () => {
    const authUtils = readSource('src/lib/auth/authUtils.ts')
    expect(authUtils).not.toContain('clearDecisionRecordsOnSignOut')
    expect(authUtils).not.toContain('decisionRecord.v1')
  })
})
