/**
 * The undo notice must be TRUE FOR THE READER WHO RECEIVES IT.
 *
 * ── THE DEFECT THIS PINS ─────────────────────────────────────────────────────
 * One sentence was emitted to every reader: *"Undo isn't available on the
 * canvas. Check Version history to restore an earlier version of this model."*
 *
 * Measured on the deployed build `9308a30c`, driven as a guest, controls in the
 * same read: `restoreBtns: []`, positive control `delete-version buttons: 2`,
 * `document.hidden: false`. A guest's Version history offers Save version ·
 * Delete version · Compare two versions and **no restore anywhere**. Restore
 * lives in `ServerVersionsSection`, which renders nothing without a
 * server-addressable scenario and the sign-in invitation without an identity.
 *
 * So the product told a reader their model could be restored somewhere it could
 * not be. This suite binds the sentence to the reader class.
 *
 * ── BOTH DIRECTIONS, DELIBERATELY (the opposite-direction twin) ──────────────
 * The two harms here cannot share one window and neither may be traded for the
 * other:
 *   · too GENEROUS — a reader with only the local list is promised a restore
 *     that does not exist (the shipped defect);
 *   · too MEAN — a reader who genuinely CAN restore is not told, which hides a
 *     built, deployed capability behind a dead-end message. Under the standing
 *     ruling (caveat, never hide) that is the same defect pointing the other
 *     way, so every "local" case below has its "shared" twin.
 *
 * ── NO MOCKED IDENTITY ──────────────────────────────────────────────────────
 * Both facts are driven through their REAL modules — `setPersistenceSessionActive`
 * and the real canvas store — never a `vi.mock` of the predicate under test. A
 * spec that mocks the module whose behaviour it is asserting cannot see the
 * breakage (and a green suite says nothing about a module it mocks).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import {
  useKeyboardShortcuts,
  canvasUndoUnavailableNotice,
  CANVAS_UNDO_LOCAL_ONLY_NOTICE,
  CANVAS_UNDO_SHARED_RESTORE_NOTICE,
} from '../useKeyboardShortcuts'
import {
  setPersistenceSessionActive,
  __resetPersistenceSessionForTests,
} from '../../lib/persistenceSession'
import { useCanvasStore } from '../store'

/**
 * Spread the original rather than hand-listing exports: a `vi.mock` factory
 * REPLACES the module and a hand-maintained allowlist goes stale silently.
 * Only the AUTHORITY is mocked — the thing that makes the notice fire at all.
 * Identity and scenario id, the facts under test, are real.
 */
vi.mock('../mutations/mutationAuthority', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../mutations/mutationAuthority')>()
  return {
    ...actual,
    get CANONICAL_EDIT_AUTHORITY() {
      return { ...actual.CANONICAL_EDIT_AUTHORITY, canvasSemanticMutations: 'disabled' }
    },
  }
})

/** A real `scenarios.id` shape — CEE addresses scenarios by uuid. */
const ADDRESSABLE_SCENARIO_ID = '3f1a7c2e-8b44-4d19-9a05-6e2c1d8f4b70'

function captureToasts(): { messages: string[]; dispose: () => void } {
  const messages: string[] = []
  const handler = (e: Event) => {
    const detail = (e as CustomEvent).detail
    if (detail?.message) messages.push(detail.message as string)
  }
  window.addEventListener('topbar:show-toast', handler)
  return { messages, dispose: () => window.removeEventListener('topbar:show-toast', handler) }
}

/** jsdom reports a non-Mac platform, so cmdOrCtrl resolves to ctrlKey. */
function pressUndo() {
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }))
}

/** Put the session into one of the two reader classes, through the real modules. */
function asReader(opts: { signedIn: boolean; scenarioId: string | null }) {
  setPersistenceSessionActive(opts.signedIn)
  useCanvasStore.setState({ currentScenarioId: opts.scenarioId })
}

describe('the undo notice is true for the reader who receives it', () => {
  let toasts: ReturnType<typeof captureToasts>

  beforeEach(() => {
    __resetPersistenceSessionForTests()
    useCanvasStore.setState({ currentScenarioId: null })
    toasts = captureToasts()
    vi.useFakeTimers()
    // Past the 3s quiet window's zero-initialised ref, so the first press in
    // every case emits. Without this the suite would depend on test ORDER.
    vi.setSystemTime(new Date('2026-08-29T12:00:00Z'))
  })

  afterEach(() => {
    toasts.dispose()
    vi.useRealTimers()
    __resetPersistenceSessionForTests()
    useCanvasStore.setState({ currentScenarioId: null })
  })

  // ── direction 1: DO NOT PROMISE A RESTORE THAT DOES NOT EXIST ─────────────

  it('GUEST, no scenario: the emitted notice is the local-only one, by identity', () => {
    asReader({ signedIn: false, scenarioId: null })
    renderHook(() => useKeyboardShortcuts())
    pressUndo()
    // Identity, not a substring another message could satisfy.
    expect(toasts.messages).toEqual([CANVAS_UNDO_LOCAL_ONLY_NOTICE])
  })

  it('GUEST with an addressable scenario still gets the local-only notice', () => {
    // The scenario being addressable is NOT enough: `ServerVersionsSection`
    // renders the sign-in invitation, not a Restore button, without an identity.
    asReader({ signedIn: false, scenarioId: ADDRESSABLE_SCENARIO_ID })
    renderHook(() => useKeyboardShortcuts())
    pressUndo()
    expect(toasts.messages).toEqual([CANVAS_UNDO_LOCAL_ONLY_NOTICE])
  })

  it('SIGNED IN but the scenario is not server-addressable: local-only notice', () => {
    // The other half of the same gate. `ServerVersionsSection` returns null
    // outright when the id is not a uuid, so there is no restore on screen.
    asReader({ signedIn: true, scenarioId: 'local-scratch-graph' })
    renderHook(() => useKeyboardShortcuts())
    pressUndo()
    expect(toasts.messages).toEqual([CANVAS_UNDO_LOCAL_ONLY_NOTICE])
  })

  it('SIGNED IN with no scenario id at all: local-only notice', () => {
    asReader({ signedIn: true, scenarioId: null })
    renderHook(() => useKeyboardShortcuts())
    pressUndo()
    expect(toasts.messages).toEqual([CANVAS_UNDO_LOCAL_ONLY_NOTICE])
  })

  it('the local-only notice does NOT promise a restore', () => {
    // Written against the SPEC ("this list cannot restore"), not against the
    // wording of the fix: any future edit that reintroduces an affirmative
    // restore promise on this string REDs here.
    expect(CANVAS_UNDO_LOCAL_ONLY_NOTICE.toLowerCase()).not.toContain('you can restore')
    expect(CANVAS_UNDO_LOCAL_ONLY_NOTICE.toLowerCase()).not.toContain('to restore an earlier')
    expect(CANVAS_UNDO_LOCAL_ONLY_NOTICE.toLowerCase()).toContain("can't restore")
  })

  // ── direction 2: THE TWIN — DO NOT HIDE A CAPABILITY THAT DOES EXIST ──────

  it('TWIN: SIGNED IN with an addressable scenario IS told restore exists', () => {
    // Mandatory counterpart. Trading the false promise for a hidden capability
    // would be the same defect pointing the other way.
    asReader({ signedIn: true, scenarioId: ADDRESSABLE_SCENARIO_ID })
    renderHook(() => useKeyboardShortcuts())
    pressUndo()
    expect(toasts.messages).toEqual([CANVAS_UNDO_SHARED_RESTORE_NOTICE])
  })

  it('TWIN: the shared notice names restore, and the two notices are different strings', () => {
    expect(CANVAS_UNDO_SHARED_RESTORE_NOTICE.toLowerCase()).toContain('restore an earlier shared version')
    expect(CANVAS_UNDO_SHARED_RESTORE_NOTICE).not.toEqual(CANVAS_UNDO_LOCAL_ONLY_NOTICE)
  })

  it('TWIN: both notices still name Version history — the panel that exists', () => {
    // Neither reader class may be left with a bare dead end. This is what stops
    // a future "simplification" reducing either string to "not available".
    expect(CANVAS_UNDO_LOCAL_ONLY_NOTICE).toContain('Version history')
    expect(CANVAS_UNDO_SHARED_RESTORE_NOTICE).toContain('Version history')
  })

  it('TWIN: both notices still answer the gesture — neither is silence', () => {
    for (const notice of [CANVAS_UNDO_LOCAL_ONLY_NOTICE, CANVAS_UNDO_SHARED_RESTORE_NOTICE]) {
      expect(notice).toContain("Undo isn't available on the canvas")
    }
  })

  // ── the selector itself, both directions, without the DOM ─────────────────

  it('the selector re-reads identity and scenario at CALL time, not at import time', () => {
    // A constant bound once at module scope would go stale into exactly the
    // false promise this fixes: sign-in and the scenario id both change during
    // a session. Drive a transition and assert the ANSWER MOVES.
    asReader({ signedIn: false, scenarioId: null })
    expect(canvasUndoUnavailableNotice()).toBe(CANVAS_UNDO_LOCAL_ONLY_NOTICE)

    asReader({ signedIn: true, scenarioId: ADDRESSABLE_SCENARIO_ID })
    expect(canvasUndoUnavailableNotice()).toBe(CANVAS_UNDO_SHARED_RESTORE_NOTICE)

    // …and back, so this cannot pass on a one-way latch.
    asReader({ signedIn: false, scenarioId: ADDRESSABLE_SCENARIO_ID })
    expect(canvasUndoUnavailableNotice()).toBe(CANVAS_UNDO_LOCAL_ONLY_NOTICE)
  })
})
