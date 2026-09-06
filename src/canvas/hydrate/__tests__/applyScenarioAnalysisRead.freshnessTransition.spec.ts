/**
 * S-R5 — A COMPLETED ANALYSIS DELIVERED ON THE READ LEG MUST TELL THE FRESHNESS
 * AUTHORITY, OR THE PRODUCT CALLS THE USER A LIAR ABOUT THEIR OWN MODEL.
 *
 * ── THE DEFECT, WITNESSED ON THE DEPLOYED BUILD ─────────────────────────────
 * On staging `11b995d9`: a fresh guest, one brief, a draft, and an analysis that
 * delivered itself ~30s later on the PROVISIONAL path while the Analyse control
 * was still disabled. With ZERO edits the canvas showed "Rerun — model changed"
 * and "Model changed. Ask or rerun…", and the panel showed "Cannot confirm
 * whether this analysis is current." — over a dock header reading "Analysis
 * complete." An affirmative falsehood about something the user did not do, on
 * the first screen they see.
 *
 * ── THE MECHANISM, AND WHY THE SOURCE IS NOT THE BUG ────────────────────────
 * `applyDraftResult` marks the overlay dirty when the DRAFT is applied — which
 * is CORRECT: the draft replaces the graph wholesale, outside the edit
 * chokepoints. It then routes the draft's `analysis_ready` through
 * `setAnalysisFreshness`, which degrades to 'unknown' — also CORRECT: a draft is
 * readiness, not a run. BOTH signals are right answers. Nothing ever updated
 * them, because TWO legs deliver a completed analysis and only ONE told the
 * freshness authority: measured at `11b995d9`, this applier and
 * `useProvisionalAnalysisDelivery` held ZERO calls to any freshness action while
 * `applyV5State` held two of each.
 *
 * ── WHY `noteRunCompletedWithoutVerdict` AND NOT A CLEAR ────────────────────
 * A blind `clearAnalysisFreshnessDirty` manufactures a false *fresh* for an
 * analysis that genuinely IS stale — the inverse defect, already built and
 * reverted once in this estate. The action pinned here writes 'unknown'
 * honestly, records the superseded verdict so the echo guard cannot resurrect
 * "model changed", and leaves the overlay dirty when edits are genuinely
 * pending. It is also the turn path's OWN `else` branch
 * (`applyV5State.ts` F10) — and the read leg's only possible branch, because
 * `ApplyScenarioAnalysisReadInput` carries no `analysis_ready`.
 *
 * ── THE DISCRIMINATING PAIRS (trap 19) ──────────────────────────────────────
 * Every firing case has a non-firing twin in this suite. A mutant that drops the
 * completed-kind test REDs the `blocked`/`refused` half while the completion
 * half stays green; a mutant that drops `resultsHydrated` REDs the dedupe half.
 * Neither direction passes alone, so the pins bind to the GATE, not merely to
 * the call.
 *
 * ⚠ NOT CLAIMED HERE: that this closes the user-visible defect end to end. That
 * is a JOURNEY claim and needs the fresh-guest witness re-run on the deployed
 * build. These are unit pins on the transition the leg was missing.
 */

import { describe, it, expect, vi } from 'vitest'
import type { Mock } from 'vitest'
import type { AnalysisStateV1 } from '@talchain/schemas/boundary'

import {
  applyScenarioAnalysisRead,
  type ScenarioAnalysisApplyStore,
} from '../applyScenarioAnalysisRead'

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

type NoteFn = NonNullable<ScenarioAnalysisApplyStore['noteRunCompletedWithoutVerdict']>
type ResultsCompleteFn = NonNullable<ScenarioAnalysisApplyStore['resultsComplete']>

function makeStore(overrides: Partial<ScenarioAnalysisApplyStore> = {}): {
  store: ScenarioAnalysisApplyStore
  note: Mock<Parameters<NoteFn>, ReturnType<NoteFn>>
  resultsComplete: Mock<Parameters<ResultsCompleteFn>, ReturnType<ResultsCompleteFn>>
  order: string[]
} {
  const order: string[] = []
  const note = vi.fn<Parameters<NoteFn>, ReturnType<NoteFn>>(() => {
    order.push('noteRunCompletedWithoutVerdict')
  })
  const resultsComplete = vi.fn<Parameters<ResultsCompleteFn>, ReturnType<ResultsCompleteFn>>(
    () => {
      order.push('resultsComplete')
    },
  )
  return {
    store: {
      setAnalysisStateV1: () => order.push('setAnalysisStateV1'),
      resultsComplete,
      noteRunCompletedWithoutVerdict: note,
      currentResultsHash: null,
      ...overrides,
    } as ScenarioAnalysisApplyStore,
    note,
    resultsComplete,
    order,
  }
}

describe('S-R5 — the read leg records that a run completed', () => {
  it('a `complete_current` read that HYDRATES RESULTS notes the completion exactly once', () => {
    const { store, note, resultsComplete } = makeStore()
    const outcome = applyScenarioAnalysisRead({
      analysisState: verdict({ kind: 'complete_current', computed_at: '2026-08-17T09:15:50.000Z' }),
      analysisResult: RESULT_BLOCK,
      store,
    })
    expect(outcome.outcome).toBe('applied')
    expect(resultsComplete).toHaveBeenCalledTimes(1)
    expect(note).toHaveBeenCalledTimes(1)
  })

  it('`complete_stale` notes it too — both kinds mean a run COMPLETED', () => {
    const { store, note } = makeStore()
    applyScenarioAnalysisRead({
      analysisState: verdict({
        kind: 'complete_stale',
        computed_at: '2026-08-17T09:15:50.000Z',
        cause: 'graph_changed',
      }),
      analysisResult: RESULT_BLOCK,
      store,
    })
    expect(note).toHaveBeenCalledTimes(1)
  })

  it('ORDER: results are written BEFORE the completion is noted, and the verdict last', () => {
    const { store, order } = makeStore()
    applyScenarioAnalysisRead({
      analysisState: verdict({ kind: 'complete_current', computed_at: '2026-08-17T09:15:50.000Z' }),
      analysisResult: RESULT_BLOCK,
      store,
    })
    expect(order).toEqual([
      'resultsComplete',
      'noteRunCompletedWithoutVerdict',
      'setAnalysisStateV1',
    ])
  })

  // ── DISCRIMINATING TWINS ────────────────────────────────────────────────

  it('TWIN — `blocked` is terminal but NO RUN FINISHED, so nothing is noted', () => {
    const { store, note } = makeStore()
    applyScenarioAnalysisRead({
      analysisState: verdict({
        kind: 'blocked',
        reason_code: 'analysis_blocked_unspecified',
        blockers: [
          {
            code: 'missing_value',
            message: 'A factor has no value.',
            category: 'model',
            repairability: 'user_repairable',
          },
        ],
      }),
      analysisResult: RESULT_BLOCK,
      store,
    })
    expect(note).not.toHaveBeenCalled()
  })

  it('TWIN — `refused` likewise notes nothing', () => {
    const { store, note } = makeStore()
    applyScenarioAnalysisRead({
      analysisState: verdict({ kind: 'refused', reason_code: 'analysis_refused_unspecified' }),
      analysisResult: RESULT_BLOCK,
      store,
    })
    expect(note).not.toHaveBeenCalled()
  })

  it('TWIN — a read with NO results block hydrates nothing, so notes nothing', () => {
    const { store, note } = makeStore()
    applyScenarioAnalysisRead({
      analysisState: verdict({ kind: 'complete_current', computed_at: '2026-08-17T09:15:50.000Z' }),
      analysisResult: null,
      store,
    })
    expect(note).not.toHaveBeenCalled()
  })

  it('TWIN — a DEDUPED re-read notes nothing: nothing new reached the screen', () => {
    // First read captures the hash the mapper derives, so the dedupe is driven
    // by the REAL value rather than one this spec invented.
    const first = makeStore()
    applyScenarioAnalysisRead({
      analysisState: verdict({ kind: 'complete_current', computed_at: '2026-08-17T09:15:50.000Z' }),
      analysisResult: RESULT_BLOCK,
      store: first.store,
    })
    const hash = first.resultsComplete.mock.calls[0]![0]!.hash
    expect(typeof hash).toBe('string')
    expect(hash.length).toBeGreaterThan(0)

    const second = makeStore({ currentResultsHash: hash })
    const outcome = applyScenarioAnalysisRead({
      analysisState: verdict({ kind: 'complete_current', computed_at: '2026-08-17T09:15:50.000Z' }),
      analysisResult: RESULT_BLOCK,
      store: second.store,
    })
    expect(outcome.outcome).toBe('alreadyHeld')
    expect(second.note).not.toHaveBeenCalled()
  })

  it('TWIN — `never_run` is non-terminal: no write of any kind', () => {
    const { store, note, resultsComplete } = makeStore()
    applyScenarioAnalysisRead({
      analysisState: verdict({ kind: 'never_run' }),
      analysisResult: RESULT_BLOCK,
      store,
    })
    expect(resultsComplete).not.toHaveBeenCalled()
    expect(note).not.toHaveBeenCalled()
  })

  it('a store view WITHOUT the action still applies — the member is optional', () => {
    const { store } = makeStore({ noteRunCompletedWithoutVerdict: undefined })
    const outcome = applyScenarioAnalysisRead({
      analysisState: verdict({ kind: 'complete_current', computed_at: '2026-08-17T09:15:50.000Z' }),
      analysisResult: RESULT_BLOCK,
      store,
    })
    expect(outcome.outcome).toBe('applied')
  })
})
