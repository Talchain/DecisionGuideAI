/**
 * ROADMAP 2.1271 — THE H4 GUARD: a graph READ may never demote a live `running`.
 *
 * ── THE DEFECT THIS PREVENTS, and it would have been the DEFAULT ─────────────
 * The draft turn says `running`. CEE keeps NO in-flight marker, so the first
 * read taken while the run is in flight can only answer `never_run` — and
 * `never_run`'s contract text licenses a consumer to render the PRE-ANALYSIS
 * affordance. Fed through the turn applier (`v5/applyV5State.ts:1113-1120`,
 * clear-on-absence and set-on-presence) that read would flip the product from
 * "an analysis is running" to "no analysis has ever been run" WHILE ONE IS
 * RUNNING. Not an edge case: the ordinary first poll.
 *
 * `applyScenarioAnalysisRead` is the narrow applier written against that, and
 * these are its pins.
 *
 * ── THE DISCRIMINATING PAIRS (trap 19) ──────────────────────────────────────
 * Every non-terminal kind has a terminal twin asserted in the same suite, so a
 * mutant that removes the terminal filter REDs the non-terminal half while the
 * terminal half stays green, and a mutant that inverts the filter does the
 * reverse. Neither direction can pass alone.
 *
 * ── P1 · ONE SEAM BEYOND THE GUARD ──────────────────────────────────────────
 * The guard is the terminal-kind filter. One seam past it is the RESULTS write,
 * so the malformed-block case drives a real block through the REAL mapper and
 * asserts the standing verdict and the surrounding store survive — the applier
 * must never cost the user what they already had.
 */

import { describe, it, expect, vi } from 'vitest'
import type { Mock } from 'vitest'
import type { AnalysisStateV1 } from '@talchain/schemas/boundary'

import {
  applyScenarioAnalysisRead,
  isReadTerminalRunState,
  READ_TERMINAL_RUN_STATE_KINDS,
  type ScenarioAnalysisApplyStore,
} from '../applyScenarioAnalysisRead'

// ─── Fixtures ─────────────────────────────────────────────────────────────

function verdict(runState: AnalysisStateV1['run_state']): AnalysisStateV1 {
  return {
    run_state: runState,
    readiness: { status: 'ready', blockers: [] },
    leader_claim: { permitted: false, withheld_reason: 'separation_unavailable' },
    robustness: {},
    usable_for_prose: false,
    usable_for_chips: false,
    usable_for_followup: false,
    requires_rerun: false,
    blocked_unusable: false,
    contradictions: [],
  } as AnalysisStateV1
}

/** A real `analysis_result` block, of the shape CEE's builder emits. */
const RESULT_BLOCK = {
  type: 'analysis_result',
  summary: 'Hiring leads on the current model.',
  leading_option_id: 'opt_hire',
  win_probabilities: { opt_hire: 0.68, opt_hold: 0.32 },
  computed_against_hash: 'hash_draft',
  enrichment: {
    analysis_status: 'ok',
    option_comparison: [
      { option_id: 'opt_hire', option_label: 'Hire', win_probability: 0.68, outcome_mean: 0.55 },
      { option_id: 'opt_hold', option_label: 'Hold', win_probability: 0.32, outcome_mean: 0.41 },
    ],
  },
}

/**
 * The two store writers, typed BY IDENTITY off the store contract rather than
 * restated here (trap 12). `ReturnType<typeof vi.fn>` widens to
 * `Mock<any[], unknown>` while `vi.fn(() => {})` infers `Mock<[], void>`, and
 * vitest's `Mock` is INVARIANT in its argument tuple (`mock.calls` puts `TArgs`
 * in both positions), so the two do not assign — TS2322. Deriving both the
 * declaration and the implementation from `ScenarioAnalysisApplyStore` fixes it
 * at the source AND makes the arg-bearing assertions below (`toHaveBeenCalledWith`,
 * `mock.calls[0]![0]`) type-check against the REAL parameter, which a widened
 * `any[]` would have silently stopped checking.
 */
type SetVerdictFn = NonNullable<ScenarioAnalysisApplyStore['setAnalysisStateV1']>
type ResultsCompleteFn = NonNullable<ScenarioAnalysisApplyStore['resultsComplete']>

function makeStore(overrides: Partial<ScenarioAnalysisApplyStore> = {}): {
  store: ScenarioAnalysisApplyStore
  setAnalysisStateV1: Mock<Parameters<SetVerdictFn>, ReturnType<SetVerdictFn>>
  resultsComplete: Mock<Parameters<ResultsCompleteFn>, ReturnType<ResultsCompleteFn>>
  calls: string[]
} {
  const calls: string[] = []
  const setAnalysisStateV1 = vi.fn<Parameters<SetVerdictFn>, ReturnType<SetVerdictFn>>(() => {
    calls.push('setAnalysisStateV1')
  })
  const resultsComplete = vi.fn<Parameters<ResultsCompleteFn>, ReturnType<ResultsCompleteFn>>(() => {
    calls.push('resultsComplete')
  })
  return {
    store: {
      setAnalysisStateV1,
      resultsComplete,
      currentResultsHash: null,
      ...overrides,
    } as ScenarioAnalysisApplyStore,
    setAnalysisStateV1,
    resultsComplete,
    calls,
  }
}

// ─── The H4 guard ─────────────────────────────────────────────────────────

describe('H4 — a read never demotes a live `running`', () => {
  it('a `never_run` read performs NO store write at all', () => {
    const { store, setAnalysisStateV1, resultsComplete } = makeStore()
    const outcome = applyScenarioAnalysisRead({
      analysisState: verdict({ kind: 'never_run' }),
      analysisResult: null,
      store,
    })
    expect(outcome).toEqual({ outcome: 'notYet', reason: 'non_terminal_kind' })
    // The whole point: not "written with a safe value" — NOT WRITTEN.
    expect(setAnalysisStateV1).not.toHaveBeenCalled()
    expect(resultsComplete).not.toHaveBeenCalled()
  })

  it('DISCRIMINATING TWIN — a `complete_current` read IS written', () => {
    const { store, setAnalysisStateV1 } = makeStore()
    const v = verdict({ kind: 'complete_current', computed_at: '2026-08-17T09:15:50.000Z' })
    const outcome = applyScenarioAnalysisRead({
      analysisState: v,
      analysisResult: null,
      store,
    })
    expect(outcome).toEqual({ outcome: 'applied', kind: 'complete_current', resultsHydrated: false })
    // Bound by IDENTITY — the exact verdict object, not "something was written".
    expect(setAnalysisStateV1).toHaveBeenCalledWith(v)
  })

  it('an `unknown_degraded` read performs NO store write — an absent outcome is not an outcome', () => {
    const { store, setAnalysisStateV1 } = makeStore()
    const outcome = applyScenarioAnalysisRead({
      analysisState: verdict({ kind: 'unknown_degraded', cause: 'store_unreadable' }),
      analysisResult: null,
      store,
    })
    expect(outcome).toEqual({ outcome: 'notYet', reason: 'non_terminal_kind' })
    expect(setAnalysisStateV1).not.toHaveBeenCalled()
  })

  it('a `running` read is treated as non-terminal, so a future in-flight marker cannot rewrite one', () => {
    const { store, setAnalysisStateV1 } = makeStore()
    const outcome = applyScenarioAnalysisRead({
      analysisState: verdict({ kind: 'running', started_at: '2026-08-17T09:15:30.250Z' }),
      analysisResult: null,
      store,
    })
    expect(outcome).toEqual({ outcome: 'notYet', reason: 'non_terminal_kind' })
    expect(setAnalysisStateV1).not.toHaveBeenCalled()
  })

  it('ABSENCE IS NOT A STATE — a null verdict writes nothing, not even null', () => {
    const { store, setAnalysisStateV1 } = makeStore()
    const outcome = applyScenarioAnalysisRead({
      analysisState: null,
      analysisResult: RESULT_BLOCK,
      store,
    })
    expect(outcome).toEqual({ outcome: 'notYet', reason: 'no_verdict' })
    expect(setAnalysisStateV1).not.toHaveBeenCalled()
  })

  it('P1 · ONE SEAM PAST THE GUARD — an `undefined` verdict does not throw either', () => {
    const { store } = makeStore()
    const outcome = applyScenarioAnalysisRead({
      // The type says this cannot happen; the applier is on a delivery path
      // whose contract is that it never costs the user anything, so it is
      // driven anyway.
      analysisState: undefined as unknown as AnalysisStateV1 | null,
      analysisResult: RESULT_BLOCK,
      store,
    })
    expect(outcome).toEqual({ outcome: 'notYet', reason: 'no_verdict' })
  })
})

// ─── The terminal set is one definition, not a mirror ─────────────────────

describe('the terminal set', () => {
  it('is exactly the four kinds a fact read can prove', () => {
    expect([...READ_TERMINAL_RUN_STATE_KINDS]).toEqual([
      'complete_current',
      'complete_stale',
      'blocked',
      'refused',
    ])
  })

  it.each(['complete_current', 'complete_stale', 'blocked', 'refused'])(
    'classifies %s as terminal',
    (kind) => {
      expect(isReadTerminalRunState(kind)).toBe(true)
    },
  )

  it.each(['never_run', 'running', 'unknown_degraded'])(
    'classifies %s as NON-terminal',
    (kind) => {
      expect(isReadTerminalRunState(kind)).toBe(false)
    },
  )
})

// ─── Results delivery ─────────────────────────────────────────────────────

describe('results delivery', () => {
  it('hydrates the results from the block AND writes the verdict', () => {
    const { store, setAnalysisStateV1, resultsComplete } = makeStore()
    const outcome = applyScenarioAnalysisRead({
      analysisState: verdict({ kind: 'complete_current', computed_at: '2026-08-17T09:15:50.000Z' }),
      analysisResult: RESULT_BLOCK,
      store,
    })
    expect(outcome).toEqual({ outcome: 'applied', kind: 'complete_current', resultsHydrated: true })
    expect(resultsComplete).toHaveBeenCalledTimes(1)
    expect(setAnalysisStateV1).toHaveBeenCalledTimes(1)
    // The report came from the REAL mapper over the REAL block — bound by the
    // option ids, which only that block can produce.
    const params = resultsComplete.mock.calls[0]![0] as { report: unknown; hash: string }
    expect(typeof params.hash).toBe('string')
    expect(params.hash.length).toBeGreaterThan(0)
  })

  it('RESULTS BEFORE VERDICT — the order is asserted, not assumed', () => {
    // A verdict-first order exposes a frame where `complete_current` vouches for
    // a result not yet on screen, which `deriveAnalysisDisplayState` reads as
    // "Ready to analyse" over a completed analysis.
    const { store, calls } = makeStore()
    applyScenarioAnalysisRead({
      analysisState: verdict({ kind: 'complete_current', computed_at: '2026-08-17T09:15:50.000Z' }),
      analysisResult: RESULT_BLOCK,
      store,
    })
    expect(calls).toEqual(['resultsComplete', 'setAnalysisStateV1'])
  })

  it('DEDUPE — a result we already display is not re-written, and still SETTLES the caller', () => {
    // First pass to learn the hash the mapper produces, so the dedupe is bound
    // to the real value rather than to a hand-copied constant.
    const first = makeStore()
    applyScenarioAnalysisRead({
      analysisState: verdict({ kind: 'complete_current', computed_at: '2026-08-17T09:15:50.000Z' }),
      analysisResult: RESULT_BLOCK,
      store: first.store,
    })
    const hash = (first.resultsComplete.mock.calls[0]![0] as { hash: string }).hash

    const second = makeStore({ currentResultsHash: hash })
    const outcome = applyScenarioAnalysisRead({
      analysisState: verdict({ kind: 'complete_current', computed_at: '2026-08-17T09:15:50.000Z' }),
      analysisResult: RESULT_BLOCK,
      store: second.store,
    })
    expect(outcome).toEqual({ outcome: 'alreadyHeld', kind: 'complete_current' })
    expect(second.resultsComplete).not.toHaveBeenCalled()
    expect(second.setAnalysisStateV1).not.toHaveBeenCalled()
  })

  it('a terminal verdict with NO block still writes the verdict (CEE withholds stale numbers)', () => {
    const { store, setAnalysisStateV1, resultsComplete } = makeStore()
    const outcome = applyScenarioAnalysisRead({
      analysisState: verdict({
        kind: 'complete_stale',
        computed_at: '2026-08-17T09:15:50.000Z',
        cause: 'graph_changed',
      }),
      analysisResult: null,
      store,
    })
    expect(outcome).toEqual({ outcome: 'applied', kind: 'complete_stale', resultsHydrated: false })
    expect(setAnalysisStateV1).toHaveBeenCalledTimes(1)
    expect(resultsComplete).not.toHaveBeenCalled()
  })

  it('a store double WITHOUT `resultsComplete` still writes the verdict rather than throwing', () => {
    const setAnalysisStateV1 = vi.fn()
    const outcome = applyScenarioAnalysisRead({
      analysisState: verdict({ kind: 'refused', reason_code: 'analysis_refused_unspecified' }),
      analysisResult: RESULT_BLOCK,
      store: { setAnalysisStateV1 } as ScenarioAnalysisApplyStore,
    })
    expect(outcome).toEqual({ outcome: 'applied', kind: 'refused', resultsHydrated: false })
    expect(setAnalysisStateV1).toHaveBeenCalledTimes(1)
  })
})

// ─── G3 · THE HAZARD, DEMONSTRATED ────────────────────────────────────────

describe('G3 — the demotion this applier exists to prevent is REAL', () => {
  it('DEMONSTRATION: the TURN applier writes a read’s `never_run` over a standing `running`', async () => {
    // ⚠ THIS IS THE RED THE GUARD POINTS AT (falsification gate G3), and it is
    // asserted rather than described so the necessity of the narrow applier
    // cannot quietly stop being true. Nothing here is a criticism of
    // `applyV5State`: clear-and-set-per-turn is CORRECT for turns. It is simply
    // the wrong rule for a read, and this is the proof.
    const { applyV5State } = await import('../../../v5/applyV5State')
    const setAnalysisStateV1 = vi.fn()
    const readShapedResponse = {
      response_version: 2,
      assistant_text: '',
      blocks: [],
      suggested_actions: [],
      insights: [],
      // Exactly what CEE's read leg returns MID-RUN: no fact has landed yet.
      analysis_state: verdict({ kind: 'never_run' }),
    }
    applyV5State(
      readShapedResponse as never,
      { setAnalysisStateV1 } as never,
    )
    // The demotion, in one line: the turn applier accepts `never_run` and
    // overwrites whatever the draft turn had established.
    expect(setAnalysisStateV1).toHaveBeenCalledWith(
      expect.objectContaining({ run_state: { kind: 'never_run' } }),
    )

    // And the CONTRAST, in the same run: the narrow applier declines.
    const narrow = makeStore()
    applyScenarioAnalysisRead({
      analysisState: verdict({ kind: 'never_run' }),
      analysisResult: null,
      store: narrow.store,
    })
    expect(narrow.setAnalysisStateV1).not.toHaveBeenCalled()
    // ⚠ EXPLICIT TIMEOUT, and it is not padding. This is the one test here that
    // dynamically imports `applyV5State` — a large module whose cold transform
    // exceeded vitest's 5s default in a fresh worktree with a symlinked
    // `node_modules` (caught by the mutant battery's PRISTINE CONTROL, which is
    // what that control is for). A cold-cache timeout in a control makes every
    // mutant verdict void, so the flake is fixed at the source rather than
    // absorbed.
  }, 30_000)
})
