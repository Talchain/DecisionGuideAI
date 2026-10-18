/**
 * ⭐⭐ THE CLAIM THIS PINS: while a fixture session holds the suspension, NO
 * WRITE REACHES STORAGE — proved against the REAL writers on the real data-loss
 * path, not against a stub.
 *
 * The defect this exists to close (#1767, found by review, reproduced here): the
 * seeded canvas route claimed *"it never writes"* on the strength of
 * `applyDraftResult({skipAutosave: true})`. That argument suppresses ONE
 * immediate write. `ReactFlowGraph:1293` mounts `useAutosave()` with no
 * arguments; its 30-second timer stamps `currentScenarioId` and writes the
 * ordinary crash-recovery slot. A user who opened a real board and then visited
 * the fixture could have the demo graph saved under their own scenario id.
 *
 * ⚠ EVERY ASSERTION HERE IS PAIRED WITH ITS OWN POSITIVE CONTROL. An
 * absence-of-write test whose writer never fired passes by testing nothing —
 * this estate's most expensive shape (CLAUDE.md trap 13). So each case first
 * proves the SAME call DOES write when not suspended.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  suspendPersistence,
  isPersistenceSuspended,
  persistenceRefusals,
  persistenceSuspensionReason,
} from '../persistenceSuspension'
import { saveAutosave, clearAutosave } from '../../store/scenarios'
import { saveScenario } from '../../../lib/scenarios'

// `AUTOSAVE_KEY` is module-private in `store/scenarios.ts`, so the literal is
// duplicated here — and therefore PINNED below, because a hand-copied constant
// that drifts is how an absence assertion starts watching an empty key
// (CLAUDE.md trap 12).
const AUTOSAVE_KEY = 'olumi-canvas-autosave'
// ⚠ EVERY PAYLOAD MUST BE DISTINCT. `store/scenarios.ts` keeps a module-level
// `lastAutosavePayload` and SKIPS an identical write — so a second test reusing
// one payload reads an empty slot and looks like a refusal it never made. Found
// by the precondition case passing while the positive control failed on the
// identical call.
let seq = 0
const autosave = () =>
  ({ nodes: [], edges: [], scenarioId: `scenario-real-${++seq}`, timestamp: seq } as never)

let release: (() => void) | null = null

beforeEach(() => {
  localStorage.clear()
  release = null
})
afterEach(() => {
  // ⛔ UNCONDITIONAL. `Storage.prototype` is global: a test that fails BEFORE its
  // own release leaves every later test writing into a stubbed prototype, which
  // reads exactly like a passing absence assertion. Measured — it turned one
  // real failure into four cascading ones.
  release?.()
  release = null
  expect(isPersistenceSuspended(), 'a suspension leaked out of a test').toBe(false)
})

describe('a suspended session refuses every storage write', () => {
  it('⭐ PRECONDITION: the key this spec watches is the key the writer uses', () => {
    saveAutosave(autosave())
    expect(
      Object.keys(localStorage),
      'the autosave key moved — every assertion below would watch an empty slot',
    ).toContain(AUTOSAVE_KEY)
  })

  it('⭐ POSITIVE CONTROL: the very same call DOES write when not suspended', () => {
    expect(isPersistenceSuspended()).toBe(false)
    saveAutosave(autosave())
    expect(
      localStorage.getItem(AUTOSAVE_KEY),
      'the control did not write — every absence assertion below would be vacuous',
    ).not.toBeNull()
  })

  it('⛔ the crash-recovery slot is not written while suspended', () => {
    release = suspendPersistence('canvas fixture')
    saveAutosave(autosave())
    expect(localStorage.getItem(AUTOSAVE_KEY)).toBeNull()
    expect(
      persistenceRefusals().map(r => r.method),
      'nothing was refused — the guard is not installed, it is merely quiet',
    ).toContain('setItem')
  })

  it('⛔ and it is not DESTROYED either — a fixture must not clear a real slot', () => {
    // Seed a real user's slot first, unsuspended.
    saveAutosave(autosave())
    const before = localStorage.getItem(AUTOSAVE_KEY)
    expect(before).not.toBeNull()

    release = suspendPersistence('canvas fixture')
    clearAutosave()
    expect(
      localStorage.getItem(AUTOSAVE_KEY),
      'the fixture erased the user’s recovery slot — a delete is a write',
    ).toBe(before)
  })

  it('⛔ the named-scenario store is not written either', () => {
    const rec = { id: 'scenario-real', name: 'Real', nodes: [], edges: [] } as never
    release = suspendPersistence('canvas fixture')
    saveScenario(rec)
    const keys = Object.keys(localStorage)
    expect(keys.filter(k => localStorage.getItem(k)?.includes('scenario-real'))).toEqual([])
  })

  it('⭐ THE WRITE LANDS AGAIN once released — suspension is scoped, not permanent', () => {
    release = suspendPersistence('canvas fixture')
    saveAutosave(autosave())
    expect(localStorage.getItem(AUTOSAVE_KEY)).toBeNull()
    release()
    expect(isPersistenceSuspended()).toBe(false)
    saveAutosave(autosave())
    expect(
      localStorage.getItem(AUTOSAVE_KEY),
      'release did not restore the writer — the patch leaked past its session',
    ).not.toBeNull()
  })

  it('⛔ restores the ORIGINAL prototype method, not a re-read of its own stub', () => {
    const before = Object.getOwnPropertyDescriptor(Storage.prototype, 'setItem')!.value
    release = suspendPersistence('canvas fixture')
    expect(
      Object.getOwnPropertyDescriptor(Storage.prototype, 'setItem')!.value,
      'the patch did not take — this is the instance-assignment failure all over again',
    ).not.toBe(before)
    release()
    expect(
      Object.getOwnPropertyDescriptor(Storage.prototype, 'setItem')!.value,
      'the stub survived release — a later suspension would capture IT as the original (trap 9h)',
    ).toBe(before)
  })

  it('⛔ refuses a nested suspension with a different reason rather than averaging it out', () => {
    release = suspendPersistence('canvas fixture')
    expect(() => suspendPersistence('something else')).toThrow(/already suspended/)
    expect(persistenceSuspensionReason()).toBe('canvas fixture')
  })

  it('a repeated suspension for the SAME reason is a no-op that cannot disarm the first', () => {
    release = suspendPersistence('canvas fixture')
    const second = suspendPersistence('canvas fixture')
    second()
    expect(
      isPersistenceSuspended(),
      'the second release disarmed the suspension the first holder still relies on',
    ).toBe(true)
  })

  it('reads still pass through — the fixture needs flags and preferences', () => {
    localStorage.setItem('some-pref', 'on')
    release = suspendPersistence('canvas fixture')
    expect(localStorage.getItem('some-pref')).toBe('on')
  })
})
