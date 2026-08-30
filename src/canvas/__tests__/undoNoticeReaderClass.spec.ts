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
 *   · too MEAN — a reader with the shared list is left with a dead-end message
 *     and never pointed at the surface that holds their model's shared
 *     versions. Under the standing ruling (caveat, never hide) that is the same
 *     defect pointing the other way, so every "local" case below has its
 *     "shared" twin.
 *
 * ⚠ AND THE TWIN'S OBLIGATION HAS NOW MOVED TWICE, WHICH IS THE POINT OF
 * KEEPING BOTH DIRECTIONS RATHER THAN ONE PLUS A COMMENT. It first asserted the
 * shared reader is told "you can restore"; a wire drive refuted that (ARM A,
 * the deployed UI's exact bytes → HTTP 422 `RESTORE_PAYLOAD_INVALID`), so it
 * was weakened. **#965 (`ede23d98`) then closed the skew**, `mutation_id` is now
 * in the deployed bundle (measured at `0022e607` with controls firing), and the
 * weakened sentence had become an UNDERSTATEMENT — the "too MEAN" harm above.
 * So it names restore again. Note what moved: the FACT, not the standard. The
 * two harms never shared a window at any point.
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
  CANVAS_UNDO_SHARED_VERSIONS_NOTICE,
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

  it('TWIN: SIGNED IN with an addressable scenario IS pointed at the shared list', () => {
    // Mandatory counterpart. Leaving this reader with the local-only sentence
    // would tell them their model's shared versions do not exist — trading the
    // false promise for a hidden surface, the same defect pointing the other way.
    asReader({ signedIn: true, scenarioId: ADDRESSABLE_SCENARIO_ID })
    renderHook(() => useKeyboardShortcuts())
    pressUndo()
    expect(toasts.messages).toEqual([CANVAS_UNDO_SHARED_VERSIONS_NOTICE])
  })

  it('TWIN: the shared reader is pointed at the shared list, and the two notices differ', () => {
    // "shared version", not "shared versions": the sentence names ONE earlier
    // version to restore, and the panel's own section is titled "Shared
    // versions". Matching the stem covers both spellings without pinning a
    // plural the copy has no reason to keep.
    expect(CANVAS_UNDO_SHARED_VERSIONS_NOTICE.toLowerCase()).toContain('shared version')
    expect(CANVAS_UNDO_SHARED_VERSIONS_NOTICE).not.toEqual(CANVAS_UNDO_LOCAL_ONLY_NOTICE)
  })

  it('the shared notice NAMES restore — the capability the reader has', () => {
    /**
     * ⚠ THIS CASE REPLACES ITS OWN NEGATION, DELIBERATELY. It previously read
     * "the shared notice does not promise a restore that is currently refused",
     * because CEE made `mutation_id` required on 26 Aug
     * (`assist.v1.scenario-versions.ts` `4c29c5b5`) and the UI had never sent
     * it, so ARM A — the deployed UI's exact request bytes — answered HTTP 422
     * `RESTORE_PAYLOAD_INVALID` while ARM B (the same call plus `mutation_id`)
     * answered HTTP 200, `restored: true`, `receipt.graph` 12 nodes / 17 edges.
     *
     * #965 (`ede23d98`) closed that skew. Re-measured at the DEPLOYED staging
     * bundle `0022e607` (immutable permalink
     * `6a93908c4187570008865ea3--olumi.netlify.app`, `/version.json` commit
     * asserted), controls in the same read: `mutation_id` 1 chunk where the
     * 29 Aug crawl found 0 · contrasts `expected_graph_identity_hash` 2,
     * `undo_version_id` 3 · fabricated marker 0 · positive control (the old
     * false-promise string) 1 chunk.
     *
     * So the weakened sentence became an UNDERSTATEMENT, and under the standing
     * ruling withholding a capability the reader HAS is the same defect as
     * promising one they have not. The obligation flipped with the fact.
     */
    const lowered = CANVAS_UNDO_SHARED_VERSIONS_NOTICE.toLowerCase()
    expect(lowered).toContain('restore')
    // …and still does not assert a particular restore POINT exists. A reader
    // with the capability may legitimately have an empty shared list.
    expect(lowered).not.toContain('your version is')
    expect(lowered).not.toContain('your changes are')
  })

  it("the shared notice's promise is backed by the request the client actually sends", async () => {
    /**
     * ⭐⭐ THIS IS THE GUARD THAT REPLACES THE DEAD "UPGRADE TRIGGER".
     *
     * The trigger this supersedes was a COMMENT plus an assertion about our own
     * copy. It fired on nothing: restore's capability could change in either
     * direction and no test anywhere would move. A mechanism that reads as a
     * safeguard and cannot fire is worse than none, because it stops anyone
     * looking.
     *
     * This one DERIVES the promise's backing instead of restating it. The
     * sentence above says "restore"; that is only true while the client sends
     * the fields CEE requires. So drive the real `restoreModelVersion` through
     * a stub fetch, read the body it actually builds, and red if a required key
     * stops arriving. Delete `payload.mutation_id = opts.mutationId` from
     * `adapters/cee/modelVersions.ts` and this case goes RED with the copy named
     * in the failure.
     *
     * ⚠ ITS LIMIT, STATED RATHER THAN LEFT TO BE DISCOVERED: it sees the CLIENT
     * DROPPING a requirement. It cannot see CEE ADDING one — which is precisely
     * how the 26 Aug skew happened, and no in-repo guard can. That gap is
     * covered by a deploy-verify driving one restore end to end, which is named
     * as owed in the PR rather than pretended away here.
     */
    const { restoreModelVersion } = await import('../../adapters/cee/modelVersions')

    let sentBody: Record<string, unknown> | null = null
    const stubFetch = vi.fn(async (_url: unknown, init?: { body?: unknown }) => {
      sentBody = JSON.parse(String(init?.body ?? '{}'))
      return {
        ok: true,
        status: 200,
        json: async () => ({ schema: 'model_version_restore.v2', restored: true, graph: {} }),
        headers: { get: () => null },
      } as unknown as Response
    })
    const realFetch = globalThis.fetch
    globalThis.fetch = stubFetch as unknown as typeof fetch
    try {
      await restoreModelVersion('3f1a7c2e-8b44-4d19-9a05-6e2c1d8f4b70', {
        userId: '9d1e4f60-2c77-4a51-b0d3-5e8a1c2b7f44',
        accessToken: 'stub-token-not-a-credential',
        versionId: 'a1b2c3d4-1111-2222-3333-444455556666',
        mutationId: 'c0ffee00-1111-2222-3333-444455556666',
        expectedGraphIdentityHash: 'a'.repeat(64),
      })
    } finally {
      globalThis.fetch = realFetch
    }

    // The instrument must have run at all — an empty capture is a hard error,
    // never a pass (a body that was never built satisfies every `not.toBe`).
    expect(stubFetch).toHaveBeenCalledTimes(1)
    expect(sentBody).not.toBeNull()
    const body = sentBody as unknown as Record<string, unknown>

    // The two keys CEE's RestoreBodySchema requires. `mutation_id` is the one
    // whose absence produced the 422; `expected_graph_identity_hash` is a
    // REQUIRED key with a nullable value, so presence is the assertion, not
    // truthiness.
    expect(Object.keys(body)).toContain('mutation_id')
    expect(Object.keys(body)).toContain('expected_graph_identity_hash')
    expect(body.mutation_id).toBe('c0ffee00-1111-2222-3333-444455556666')

    // …and the binding itself: the notice may only name restore while the above
    // holds. Stated as the implication, so the failure message says WHY.
    const promisesRestore = CANVAS_UNDO_SHARED_VERSIONS_NOTICE.toLowerCase().includes('restore')
    const backed =
      Object.keys(body).includes('mutation_id') &&
      Object.keys(body).includes('expected_graph_identity_hash')
    expect(
      { promisesRestore, backed },
      'the shared undo notice names restore, so the restore request must carry the fields CEE requires',
    ).toEqual({ promisesRestore: true, backed: true })
  })

  it('TWIN: both notices still name Version history — the panel that exists', () => {
    // Neither reader class may be left with a bare dead end. This is what stops
    // a future "simplification" reducing either string to "not available".
    expect(CANVAS_UNDO_LOCAL_ONLY_NOTICE).toContain('Version history')
    expect(CANVAS_UNDO_SHARED_VERSIONS_NOTICE).toContain('Version history')
  })

  it('TWIN: both notices still answer the gesture — neither is silence', () => {
    for (const notice of [CANVAS_UNDO_LOCAL_ONLY_NOTICE, CANVAS_UNDO_SHARED_VERSIONS_NOTICE]) {
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
    expect(canvasUndoUnavailableNotice()).toBe(CANVAS_UNDO_SHARED_VERSIONS_NOTICE)

    // …and back, so this cannot pass on a one-way latch.
    asReader({ signedIn: false, scenarioId: ADDRESSABLE_SCENARIO_ID })
    expect(canvasUndoUnavailableNotice()).toBe(CANVAS_UNDO_LOCAL_ONLY_NOTICE)
  })
})
