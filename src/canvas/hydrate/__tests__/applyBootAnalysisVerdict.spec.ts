/**
 * `applyBootAnalysisVerdict` — the unit, driven per contract kind.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠ THE DEV-BRANCH TRAP, AND HOW THIS FILE AVOIDS IT
 * ═══════════════════════════════════════════════════════════════════════════
 * The canvas's localStorage restore path sits inside `if (import.meta.env.PROD)`
 * (`ReactFlowGraph.tsx:1504`), so under vitest — where `PROD` is false — that
 * whole branch is dead and a spec routed through the reload effect would be
 * exercising a path production never takes, against a key production never
 * writes. This file therefore drives the FUNCTION DIRECTLY, with an injected
 * store, and never mounts a component. `bootAnalysisVerdictRestore.spec.ts`
 * likewise drives `hydrateCanvasFromServer` directly rather than through
 * `useServerGraphHydration`.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⭐ WHY THE DECLINE *REASON* IS ASSERTED AND NOT JUST THE WRITE
 * ═══════════════════════════════════════════════════════════════════════════
 * WRITTEN IN RESPONSE TO A SURVIVING MUTANT, and the survivor is the reason
 * this file exists at all. Deleting the explicit `complete_current` decline
 * from `applyBootAnalysisVerdict` left the whole suite GREEN (21/21, with the
 * applied-check reading 1, so it was genuinely applied): the kind is ALSO
 * excluded by `BOOT_RESTORABLE_RUN_STATE_KINDS`, so behaviour was unchanged and
 * only the reason moved — `asserts_currency` → `not_restorable`.
 *
 * The gate is doubly defended, which is good, and NEITHER defence was pinned on
 * its own, which is not. A survivor is a claim either way and must be
 * demonstrated rather than asserted (trap 13c). Asserting the REASON separates
 * the two defences, so removing either one REDs by name instead of hiding
 * behind the other.
 *
 * That distinction is not bookkeeping: `asserts_currency` is the only decline
 * that turns away a verdict CEE genuinely stated and genuinely means. Collapsing
 * it into the "said nothing" bucket is how a later reader concludes the kind is
 * simply unhandled and "fixes" it.
 */

import { describe, it, expect, vi, type Mock } from 'vitest'
import { ANALYSIS_RUN_STATE_KINDS } from '@talchain/schemas/boundary'
import type { AnalysisStateV1 } from '@talchain/schemas/boundary'

import {
  applyBootAnalysisVerdict,
  BOOT_RESTORABLE_RUN_STATE_KINDS,
  type BootAnalysisVerdictStore,
} from '../applyScenarioAnalysisRead'

type SetVerdictFn = NonNullable<BootAnalysisVerdictStore['setAnalysisStateV1']>

/**
 * ⚠ TYPED BY IDENTITY OFF THE STORE CONTRACT, NOT AS `ReturnType<typeof vi.fn>`.
 * That widens to `Mock<any[], unknown>` while `vi.fn<Parameters<…>, …>` infers
 * the real tuple, and vitest's `Mock` is INVARIANT in its argument tuple
 * (`mock.calls` puts `TArgs` in both positions), so the two do not assign —
 * TS2322, caught by the typecheck ratchet. Deriving both the declaration and
 * the implementation from `BootAnalysisVerdictStore` fixes it at the source AND
 * keeps `mock.calls[0]![0]` checked against the REAL parameter, which a widened
 * `any[]` would have silently stopped checking. Same lesson as the sibling
 * `applyScenarioAnalysisRead.spec.ts:73-83`.
 */
function makeStore(): {
  store: BootAnalysisVerdictStore
  setAnalysisStateV1: Mock<Parameters<SetVerdictFn>, ReturnType<SetVerdictFn>>
} {
  const setAnalysisStateV1 = vi.fn<Parameters<SetVerdictFn>, ReturnType<SetVerdictFn>>(
    () => {},
  )
  return { store: { setAnalysisStateV1 }, setAnalysisStateV1 }
}

/**
 * A run_state for every kind the CONTRACT admits, built from the contract's own
 * vocabulary rather than a hand-listed table — so a new kind arrives here
 * automatically instead of being silently untested (trap 12).
 *
 * The per-kind required members come from the vendored 0.48.0 bytes, including
 * the 0.47.0 cross-check CC-A that forces `blocked_unusable: true` under
 * `blocked`.
 */
function runStateFor(kind: string): {
  runState: AnalysisStateV1['run_state']
  over: Partial<AnalysisStateV1>
} {
  const at = '2026-08-25T09:00:00.000Z'
  switch (kind) {
    case 'never_run':
      return { runState: { kind: 'never_run' } as never, over: {} }
    case 'running':
      return { runState: { kind: 'running', started_at: at } as never, over: {} }
    case 'blocked':
      return {
        runState: { kind: 'blocked', reason_code: 'no_options', blockers: [] } as never,
        over: { blocked_unusable: true },
      }
    case 'refused':
      return {
        runState: { kind: 'refused', reason_code: 'declined_by_policy' } as never,
        over: {},
      }
    case 'complete_current':
      return { runState: { kind: 'complete_current', computed_at: at } as never, over: {} }
    case 'complete_stale':
      return {
        runState: {
          kind: 'complete_stale',
          computed_at: at,
          cause: 'graph_changed',
        } as never,
        over: {},
      }
    case 'unknown_degraded':
      return {
        runState: { kind: 'unknown_degraded', cause: 'store_unreadable' } as never,
        over: {},
      }
    default:
      throw new Error(`unmapped contract kind: ${kind}`)
  }
}

function verdictFor(kind: string): AnalysisStateV1 {
  const { runState, over } = runStateFor(kind)
  return {
    run_state: runState,
    readiness: { status: 'ready', blockers: [] },
    leader_claim: { permitted: false, withheld_reason: 'separation_unavailable' },
    robustness: {},
    usable_for_prose: false,
    usable_for_chips: false,
    usable_for_followup: false,
    requires_rerun: true,
    blocked_unusable: false,
    contradictions: [],
    ...over,
  } as AnalysisStateV1
}

describe('applyBootAnalysisVerdict — every contract kind, outcome AND reason', () => {
  it('POSITIVE CONTROL — the contract vocabulary is reachable and every kind is mapped', () => {
    expect(ANALYSIS_RUN_STATE_KINDS.length).toBeGreaterThanOrEqual(7)
    // Proves the fixture builder covers the contract; an unmapped kind throws
    // rather than silently skipping, so the loop below cannot be short.
    for (const kind of ANALYSIS_RUN_STATE_KINDS) {
      expect(() => verdictFor(kind)).not.toThrow()
    }
  })

  it('a restorable kind WRITES the verdict verbatim, and reports `restored`', () => {
    for (const kind of BOOT_RESTORABLE_RUN_STATE_KINDS) {
      const { store, setAnalysisStateV1 } = makeStore()
      const v = verdictFor(kind)
      const outcome = applyBootAnalysisVerdict({ analysisState: v, store })
      expect({ kind, outcome }).toEqual({ kind, outcome: { outcome: 'restored', kind } })
      // VERBATIM — the same object, not a reconstruction. A leg that rebuilt the
      // verdict could quietly drop a producer field.
      expect(setAnalysisStateV1).toHaveBeenCalledTimes(1)
      expect(setAnalysisStateV1.mock.calls[0]![0]).toBe(v)
    }
  })

  it('⭐ `complete_current` declines with `asserts_currency` — NOT with the generic reason', () => {
    // THE ASSERTION THAT KILLS THE SURVIVING MUTANT. Deleting the explicit
    // `complete_current` branch leaves the kind declined (the set excludes it)
    // but changes the reason to `not_restorable`, and this REDs on exactly that.
    const { store, setAnalysisStateV1 } = makeStore()
    const outcome = applyBootAnalysisVerdict({
      analysisState: verdictFor('complete_current'),
      store,
    })
    expect(outcome).toEqual({ outcome: 'declined', reason: 'asserts_currency' })
    // A decline is a NO-OP — never a write of `null`, which is itself a claim.
    expect(setAnalysisStateV1).not.toHaveBeenCalled()
  })

  it('the kinds that say NOTHING decline with `not_restorable` — a different fact', () => {
    // The opposite-direction twin of the assertion above. Without it, a mutant
    // that reported `asserts_currency` for EVERY decline would pass the test
    // above while destroying the distinction it exists to make.
    for (const kind of ['never_run', 'running', 'unknown_degraded']) {
      const { store, setAnalysisStateV1 } = makeStore()
      const outcome = applyBootAnalysisVerdict({ analysisState: verdictFor(kind), store })
      expect({ kind, outcome }).toEqual({
        kind,
        outcome: { outcome: 'declined', reason: 'not_restorable' },
      })
      expect(setAnalysisStateV1).not.toHaveBeenCalled()
    }
  })

  it('a null verdict declines with `no_verdict` and writes nothing — absence is not a state', () => {
    const { store, setAnalysisStateV1 } = makeStore()
    expect(applyBootAnalysisVerdict({ analysisState: null, store })).toEqual({
      outcome: 'declined',
      reason: 'no_verdict',
    })
    expect(setAnalysisStateV1).not.toHaveBeenCalled()
  })

  it('EVERY contract kind gets an outcome — none falls through undefined', () => {
    for (const kind of ANALYSIS_RUN_STATE_KINDS) {
      const { store } = makeStore()
      const outcome = applyBootAnalysisVerdict({ analysisState: verdictFor(kind), store })
      expect(outcome.outcome === 'restored' || outcome.outcome === 'declined').toBe(true)
    }
  })

  it('never throws on a store with NO writer — the boot leg may not cost the user anything', () => {
    expect(() =>
      applyBootAnalysisVerdict({ analysisState: verdictFor('complete_stale'), store: {} }),
    ).not.toThrow()
  })
})
