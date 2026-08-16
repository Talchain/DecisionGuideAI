/**
 * analysisStateSelector — precedence, feature-detection, and the no-visual-change pin.
 *
 * THE LOAD-BEARING TEST IS `PRECEDENCE`, and it is written as a PAIR. A single
 * case showing "wire present → wire's answer" proves nothing on its own: the
 * legacy derivation might have produced the same answer by coincidence, and a
 * selector that ignored the wire entirely would still pass. Each precedence
 * case therefore pins BOTH halves — the wire says X while the legacy signals
 * say NOT-X, and the composed answer must be X — and the two cases point in
 * OPPOSITE directions, so a selector that hardcoded either answer fails one of
 * them (trap 19's discriminating pair, at the level of the authority rule).
 *
 * Every assertion binds by IDENTITY (the exact field, the exact kind), never by
 * a value predicate another state could satisfy.
 */
import { describe, expect, it } from 'vitest'
import type { AnalysisStateV1, AnalysisRunStateKind } from '@talchain/schemas/boundary'
import { AnalysisStateV1Schema } from '@talchain/schemas/boundary'

import { ANALYSIS_RUN_STATE_KINDS } from '@talchain/schemas/boundary'

import {
  composeAnalysisState,
  mapRunStateKindToSemantic,
  mapRunStateKindToDisplayedFreshness,
  type ComposeAnalysisStateInput,
} from '../analysisStateSelector'
import {
  classifyFreshnessForDisplay,
  resolveDisplayedFreshness,
  VERDICT_ABSENT_FROM_PAYLOAD,
  type AnalysisFreshnessState,
} from '../../store/analysisFreshness'
import { computeAnalysisTrust } from '../../hooks/useAnalysisTrust'
import { deriveAnalysisDisplayState } from '../../utils/deriveAnalysisDisplayState'

/**
 * A legacy input whose derivation is UNAMBIGUOUSLY 'current': CEE said fresh,
 * no local edit, no import hold, a report on screen, a minted run fact.
 *
 * This is the fixture that makes the precedence pair discriminating — the
 * legacy answer here is not merely different from the wire's, it is the
 * strongest possible contradiction of it.
 */
const LEGACY_SAYS_CURRENT: ComposeAnalysisStateInput = {
  analysisState: null,
  freshness: {
    freshness: 'fresh',
    freshnessReason: 'graph_hash_match',
    graphHashAtRun: 'hash_a',
    currentGraphHash: 'hash_a',
    computedAt: '2026-08-16T09:00:00.000Z',
  } satisfies AnalysisFreshnessState,
  dirty: false,
  source: 'cee_v5_run_analysis',
  resultsStatus: 'complete',
  resultsStartedAt: 1_760_000_000_000,
  importHold: false,
  hasReport: true,
  ceeAnalysisReadyStatus: 'ready',
  aiPanelV2On: true,
}

/** A legacy input whose derivation is unambiguously 'changed' (CEE stated stale). */
const LEGACY_SAYS_CHANGED: ComposeAnalysisStateInput = {
  ...LEGACY_SAYS_CURRENT,
  freshness: {
    freshness: 'stale',
    freshnessReason: 'graph_hash_diverged',
    graphHashAtRun: 'hash_a',
    currentGraphHash: 'hash_b',
    computedAt: '2026-08-16T09:00:00.000Z',
  } satisfies AnalysisFreshnessState,
}

function wireVerdict(over: Partial<AnalysisStateV1> = {}): AnalysisStateV1 {
  // Built through the REAL schema parser, never hand-cast. A fixture that never
  // meets the contract cannot certify a consumer of the contract, and a `as`
  // cast would let this suite drift from the wire silently.
  const parsed = AnalysisStateV1Schema.safeParse({
    run_state: { kind: 'complete_current', computed_at: '2026-08-16T10:00:00.000Z' },
    readiness: { status: 'ready', blockers: [] },
    leader_claim: { permitted: true },
    robustness: {},
    usable_for_prose: true,
    usable_for_chips: true,
    usable_for_followup: true,
    requires_rerun: false,
    blocked_unusable: false,
    contradictions: [],
    ...over,
  })
  if (!parsed.success) {
    throw new Error(`fixture does not satisfy AnalysisStateV1: ${JSON.stringify(parsed.error.issues)}`)
  }
  return parsed.data
}

describe('PRECEDENCE — a wire verdict outranks the local derivation', () => {
  it('wire complete_stale BEATS a legacy derivation that says current', () => {
    // Guard the fixture's own precondition IN-TEST: if the legacy signals ever
    // stopped deriving 'current', this case would pass while discriminating
    // nothing (trap 13b — a guard whose power depends on an unpinned fixture).
    expect(
      classifyFreshnessForDisplay(LEGACY_SAYS_CURRENT.freshness, LEGACY_SAYS_CURRENT.dirty, false),
    ).toBe('current')

    const composed = composeAnalysisState({
      ...LEGACY_SAYS_CURRENT,
      analysisState: wireVerdict({
        run_state: {
          kind: 'complete_stale',
          computed_at: '2026-08-16T10:00:00.000Z',
          cause: 'graph_changed',
        },
      }),
    })

    expect(composed.authority).toBe('wire')
    expect(composed.runStateKind).toBe('complete_stale')
    expect(composed.semantic).toBe('changed')
    expect(composed.trust.semantic).toBe('changed')
  })

  it('wire complete_current BEATS a legacy derivation that says changed (the opposite direction)', () => {
    expect(
      classifyFreshnessForDisplay(LEGACY_SAYS_CHANGED.freshness, LEGACY_SAYS_CHANGED.dirty, false),
    ).toBe('changed')

    const composed = composeAnalysisState({
      ...LEGACY_SAYS_CHANGED,
      analysisState: wireVerdict(),
    })

    expect(composed.authority).toBe('wire')
    expect(composed.runStateKind).toBe('complete_current')
    expect(composed.semantic).toBe('current')
    expect(composed.trust.semantic).toBe('current')
  })

  it('wire refused BEATS a legacy current — the state no legacy signal can express', () => {
    const composed = composeAnalysisState({
      ...LEGACY_SAYS_CURRENT,
      analysisState: wireVerdict({
        run_state: { kind: 'refused', reason_code: 'analysis_declined_this_turn' },
      }),
    })
    expect(composed.runStateKind).toBe('refused')
    expect(composed.semantic).toBe('cannot_confirm')
    // The derived branch must never be able to reach this kind — that is what
    // makes `refused` the proof the wire is being read rather than inferred.
    expect(composeAnalysisState(LEGACY_SAYS_CURRENT).runStateKind).not.toBe('refused')
  })
})

describe('FEATURE DETECTION — absence routes to the legacy derivations, unchanged', () => {
  it('reports authority "derived" and NO wire object when the turn carried none', () => {
    const composed = composeAnalysisState(LEGACY_SAYS_CURRENT)
    expect(composed.authority).toBe('derived')
    expect(composed.wire).toBeNull()
  })

  it('treats undefined exactly as null — an absent key is not a verdict', () => {
    const withUndefined = composeAnalysisState({ ...LEGACY_SAYS_CURRENT, analysisState: undefined })
    expect(withUndefined.authority).toBe('derived')
    expect(withUndefined.semantic).toBe(composeAnalysisState(LEGACY_SAYS_CURRENT).semantic)
  })
})

describe('NO-VISUAL-CHANGE PIN — the derived branch is byte-identical to the legacy derivations', () => {
  // The matrix spans every freshness value × the dirty overlay × report
  // presence. Every member carries NO `analysis_state`, which is exactly the
  // state of every fixture in this repo, so this is the pin that says the
  // train changes nothing a user can see.
  const freshnessValues = ['fresh', 'stale', 'unknown', 'none'] as const
  const cases = freshnessValues.flatMap((f) =>
    [true, false].flatMap((dirty) =>
      [true, false].map((hasReport) => ({ f, dirty, hasReport })),
    ),
  )

  it.each(cases)(
    'freshness=$f dirty=$dirty hasReport=$hasReport → trust and displayState match the legacy derivation exactly',
    ({ f, dirty, hasReport }) => {
      const input: ComposeAnalysisStateInput = {
        ...LEGACY_SAYS_CURRENT,
        analysisState: null,
        freshness: { freshness: f, freshnessReason: 'graph_hash_match' },
        dirty,
        hasReport,
      }

      const composed = composeAnalysisState(input)

      const legacyTrust = computeAnalysisTrust({
        freshness: input.freshness,
        dirty: input.dirty,
        source: input.source,
        resultsStatus: input.resultsStatus,
        resultsStartedAt: input.resultsStartedAt,
        importHold: input.importHold,
      })
      expect(composed.trust).toStrictEqual(legacyTrust)

      const legacyDisplay = deriveAnalysisDisplayState({
        ceeAnalysisReadyStatus: input.ceeAnalysisReadyStatus,
        hasReport: input.hasReport,
        analysisChanged: legacyTrust.semantic === 'changed' || legacyTrust.orphaned,
      })
      expect(composed.displayState).toStrictEqual(legacyDisplay)
    },
  )

  it('preserves the orphan affordance on the derived branch', () => {
    const composed = composeAnalysisState({
      ...LEGACY_SAYS_CURRENT,
      source: 'orphaned_plot_result',
      freshness: null,
    })
    expect(composed.trust.orphaned).toBe(true)
    expect(composed.semantic).toBe('cannot_confirm')
    expect(composed.requiresRerun).toBe(true)
  })
})

describe('HERO COPY — a refusal must never render as green "Analysis complete"', () => {
  // The defect these pin: `refused` and `unknown_degraded` both map to the
  // cannot-confirm semantic, and the legacy hero mapper deliberately treats
  // cannot-confirm as the neutral COMPLETION fact. Passing the semantic straight
  // through therefore renders "Analysis complete" over a turn that explicitly
  // declined to vouch for the result — the exact contradiction class this whole
  // migration exists to close. Each case asserts the STATE by identity, not the
  // copy string, so a copy change cannot silently satisfy it.
  it.each([
    ['refused', { kind: 'refused', reason_code: 'analysis_declined_this_turn' }],
    ['unknown_degraded', { kind: 'unknown_degraded', cause: 'store_unreadable' }],
    [
      'complete_stale',
      { kind: 'complete_stale', computed_at: '2026-08-16T10:00:00.000Z', cause: 'graph_changed' },
    ],
  ] as const)('%s over a visible result → results_stale with a rerun CTA', (_label, run_state) => {
    const composed = composeAnalysisState({
      ...LEGACY_SAYS_CURRENT,
      analysisState: wireVerdict({ run_state }),
    })
    expect(composed.displayState.state).toBe('results_stale')
    expect(composed.displayState.cta).toStrictEqual({ kind: 'secondary', label: 'Rerun analysis' })
  })

  it('complete_current still renders the completion state — the opposite direction', () => {
    const composed = composeAnalysisState({
      ...LEGACY_SAYS_CURRENT,
      analysisState: wireVerdict(),
    })
    expect(composed.displayState.state).toBe('complete')
  })

  it('blocked forces not_ready even with a prior report on screen', () => {
    const composed = composeAnalysisState({
      ...LEGACY_SAYS_CURRENT,
      analysisState: wireVerdict({
        run_state: { kind: 'blocked', reason_code: 'no_goal_node', blockers: [] },
      }),
    })
    expect(composed.displayState.state).toBe('not_ready')
  })

  it('does NOT force stale on the DERIVED branch — a CEE unknown is only cannot-confirm', () => {
    // The scoping half of the fix. Without it, every legacy cannot-confirm would
    // start claiming "Results may be outdated", which is a behaviour change this
    // train is explicitly not making.
    const composed = composeAnalysisState({
      ...LEGACY_SAYS_CURRENT,
      analysisState: null,
      freshness: { freshness: 'unknown', freshnessReason: 'cee_stated_unknown' },
    })
    expect(composed.semantic).toBe('cannot_confirm')
    expect(composed.displayState.state).toBe('complete')
  })
})

describe('LEADER CLAIM — the contract conjunction is applied once, here', () => {
  it('permits a leader only when permitted AND complete_current', () => {
    expect(
      composeAnalysisState({ ...LEGACY_SAYS_CURRENT, analysisState: wireVerdict() })
        .leaderClaimPermitted,
    ).toBe(true)
  })

  it('WITHHOLDS a permitted leader on a stale run — permitted alone is not sufficient', () => {
    const composed = composeAnalysisState({
      ...LEGACY_SAYS_CURRENT,
      analysisState: wireVerdict({
        run_state: {
          kind: 'complete_stale',
          computed_at: '2026-08-16T10:00:00.000Z',
          cause: 'options_changed',
        },
        leader_claim: { permitted: true },
      }),
    })
    expect(composed.wire?.leader_claim.permitted).toBe(true)
    expect(composed.leaderClaimPermitted).toBe(false)
  })

  it('carries the producer withheld_reason verbatim and never fabricates one', () => {
    const withReason = composeAnalysisState({
      ...LEGACY_SAYS_CURRENT,
      analysisState: wireVerdict({
        leader_claim: { permitted: false, withheld_reason: 'near_tie' },
      }),
    })
    expect(withReason.leaderClaimPermitted).toBe(false)
    expect(withReason.leaderWithheldReason).toBe('near_tie')

    const withoutReason = composeAnalysisState({
      ...LEGACY_SAYS_CURRENT,
      analysisState: wireVerdict({ leader_claim: { permitted: false } }),
    })
    expect(withoutReason.leaderWithheldReason).toBeNull()
  })
})

describe('ABSENCE IS DISTINCT — not-stated is null, never a default', () => {
  it('reports every producer-only member as null when the wire is silent', () => {
    const composed = composeAnalysisState(LEGACY_SAYS_CURRENT)
    expect(composed.leaderClaimPermitted).toBeNull()
    expect(composed.usableForProse).toBeNull()
    expect(composed.usableForChips).toBeNull()
    expect(composed.usableForFollowup).toBeNull()
    expect(composed.blockedUnusable).toBeNull()
    expect(composed.contradictions).toBeNull()
    expect(composed.readinessStatus).toBeNull()
    expect(composed.readinessBlockers).toBeNull()
    expect(composed.robustnessAggregateLevel).toBeNull()
    expect(composed.factorsThatFlipLeader).toBeNull()
  })

  it('keeps "flip analysis not computed" (null) distinct from "computed, none flip" ([])', () => {
    const notComputed = composeAnalysisState({
      ...LEGACY_SAYS_CURRENT,
      analysisState: wireVerdict({ robustness: {} }),
    })
    expect(notComputed.factorsThatFlipLeader).toBeNull()

    const computedNone = composeAnalysisState({
      ...LEGACY_SAYS_CURRENT,
      analysisState: wireVerdict({ robustness: { factors_that_flip_leader: [] } }),
    })
    expect(computedNone.factorsThatFlipLeader).toStrictEqual([])
  })

  it('reports an empty contradictions list as [] (producer found none), not null', () => {
    const composed = composeAnalysisState({
      ...LEGACY_SAYS_CURRENT,
      analysisState: wireVerdict({ contradictions: [] }),
    })
    expect(composed.contradictions).toStrictEqual([])
  })
})

describe('THE RUN PAIR — isRunning and runStartedAt come from ONE authority', () => {
  const WIRE_RUNNING = wireVerdict({
    run_state: { kind: 'running', started_at: '2026-08-16T09:30:00.000Z' },
  })
  const WIRE_STARTED_MS = Date.parse('2026-08-16T09:30:00.000Z')

  it('wire running with NO local run supplies the wire clock — never an orphan isRunning', () => {
    // The F9 defect: `isRunning` true with `runStartedAt` undefined makes every
    // reused run-state banner narrate from its own mount time, reporting the
    // age of the COMPONENT instead of the age of the RUN.
    const composed = composeAnalysisState({
      ...LEGACY_SAYS_CURRENT,
      analysisState: WIRE_RUNNING,
      resultsStatus: 'complete',
      resultsStartedAt: undefined,
    })
    expect(composed.trust.isRunning).toBe(true)
    expect(composed.trust.runStartedAt).toBe(WIRE_STARTED_MS)
  })

  it('local streaming is NOT vetoed by a wire verdict of complete_current', () => {
    // Tearing the run cover down mid-run is the harm in the other direction: a
    // run dispatched after CEE composed its verdict is newer information the
    // verdict cannot know about.
    const composed = composeAnalysisState({
      ...LEGACY_SAYS_CURRENT,
      analysisState: wireVerdict(),
      resultsStatus: 'streaming',
      resultsStartedAt: 1_760_000_000_000,
    })
    expect(composed.trust.isRunning).toBe(true)
    expect(composed.trust.runStartedAt).toBe(1_760_000_000_000)
  })

  it('when BOTH assert a run, the clock comes from the SAME source that won', () => {
    const composed = composeAnalysisState({
      ...LEGACY_SAYS_CURRENT,
      analysisState: WIRE_RUNNING,
      resultsStatus: 'streaming',
      resultsStartedAt: 1_760_000_000_000,
    })
    expect(composed.trust.isRunning).toBe(true)
    // Local wins when both assert, so the clock must be the LOCAL one — a mixed
    // pair would describe two different runs.
    expect(composed.trust.runStartedAt).toBe(1_760_000_000_000)
    expect(composed.trust.runStartedAt).not.toBe(WIRE_STARTED_MS)
  })

  it('neither asserting a run leaves isRunning false with the legacy clock intact', () => {
    const composed = composeAnalysisState({
      ...LEGACY_SAYS_CURRENT,
      analysisState: wireVerdict(),
      resultsStatus: 'complete',
      resultsStartedAt: 1_760_000_000_000,
    })
    expect(composed.trust.isRunning).toBe(false)
    expect(composed.trust.runStartedAt).toBe(1_760_000_000_000)
  })
})

describe('DISPLAYED FRESHNESS — never fabricates stale, on either branch', () => {
  it('is byte-identical to resolveDisplayedFreshness on the derived branch', () => {
    const values = ['fresh', 'stale', 'unknown', 'none'] as const
    for (const f of values) {
      for (const dirty of [true, false]) {
        const state = { freshness: f, freshnessReason: 'graph_hash_match' }
        const composed = composeAnalysisState({
          ...LEGACY_SAYS_CURRENT,
          analysisState: null,
          freshness: state,
          dirty,
        })
        expect(composed.displayedFreshness).toBe(resolveDisplayedFreshness(state, dirty))
      }
    }
  })

  it('does NOT map a dirty-overlay "changed" semantic back to a fabricated stale', () => {
    // The lossy round-trip this member exists to avoid: `semantic` is 'changed'
    // here (VERDICT_ABSENT_FROM_PAYLOAD + dirty), but CEE never stated 'stale',
    // so the displayed VALUE must stay 'unknown'. Deriving the value from the
    // semantic would render the stale glyph for a verdict that does not exist.
    const composed = composeAnalysisState({
      ...LEGACY_SAYS_CURRENT,
      analysisState: null,
      freshness: {
        freshness: 'unknown',
        freshnessReason: VERDICT_ABSENT_FROM_PAYLOAD,
      },
      dirty: true,
    })
    expect(composed.semantic).toBe('changed')
    expect(composed.displayedFreshness).toBe('unknown')
    expect(composed.resultsTab.reallyStale).toBe(false)
    expect(composed.resultsTab.cannotConfirm).toBe(true)
  })

  it('produces stale ONLY from a wire complete_stale', () => {
    for (const kind of ANALYSIS_RUN_STATE_KINDS) {
      const value = mapRunStateKindToDisplayedFreshness(kind, true)
      if (kind === 'complete_stale') expect(value).toBe('stale')
      else expect(value).not.toBe('stale')
    }
  })
})

describe('RUNTIME FLOOR — an unknown kind from a newer CEE degrades, never completes', () => {
  /**
   * ROADMAP 2.1258. The switches are typecheck-guarded, but the compiler is not
   * on the wire: a newer CEE emitting a kind this pin does not know would fall
   * through to `undefined`, which every consumer reads as "no verdict".
   *
   * These cases feed the fabricated kind DIRECTLY to the selector, bypassing the
   * envelope — which is the whole point. The envelope's discriminated union does
   * reject unknown kinds today, but that guarantee lives in the schema pin, not
   * in this module, and the floor is what makes this module safe on its own.
   */
  const FUTURE_KIND = 'complete_provisional' as AnalysisRunStateKind

  it('maps to cannot-confirm, not to a completion claim', () => {
    expect(mapRunStateKindToSemantic(FUTURE_KIND, true)).toBe('cannot_confirm')
    expect(mapRunStateKindToSemantic(FUTURE_KIND, true)).not.toBe('current')
  })

  it('maps to the cannot-confirm VALUE — never fresh, never a fabricated stale', () => {
    expect(mapRunStateKindToDisplayedFreshness(FUTURE_KIND, true)).toBe('unknown')
    expect(mapRunStateKindToDisplayedFreshness(FUTURE_KIND, true)).not.toBe('fresh')
    expect(mapRunStateKindToDisplayedFreshness(FUTURE_KIND, true)).not.toBe('stale')
  })

  it('composes end-to-end without any surface claiming currency', () => {
    // The floor is only worth having if it survives composition: the hero read
    // its own allow-list of kinds to distrust, so an unknown kind reached
    // `analysisChanged: false` and rendered "Analysis complete" even while the
    // semantic said cannot-confirm.
    const composed = composeAnalysisState({
      ...LEGACY_SAYS_CURRENT,
      analysisState: {
        ...wireVerdict(),
        // Bypasses the parser deliberately — a validated payload cannot carry
        // this today, and that is exactly the assumption under test.
        run_state: { kind: FUTURE_KIND, computed_at: '2026-08-16T10:00:00.000Z' },
      } as AnalysisStateV1,
    })
    expect(composed.authority).toBe('wire')
    expect(composed.runStateKind).toBe(FUTURE_KIND)
    expect(composed.semantic).toBe('cannot_confirm')
    expect(composed.displayedFreshness).toBe('unknown')
    expect(composed.displayState.state).not.toBe('complete')
    expect(composed.displayState.state).toBe('results_stale')
    // And no leader may be named under a state we do not understand.
    expect(composed.leaderClaimPermitted).toBe(false)
  })

  it('every DECLARED kind still round-trips — the floor did not swallow the real ones', () => {
    // Without this, a default that returned cannot-confirm for EVERYTHING would
    // pass every assertion above (trap 13: an instrument that cannot fail).
    for (const kind of ANALYSIS_RUN_STATE_KINDS) {
      const semantic = mapRunStateKindToSemantic(kind, true)
      if (kind === 'complete_current') expect(semantic).toBe('current')
      if (kind === 'complete_stale') expect(semantic).toBe('changed')
      if (kind === 'never_run' || kind === 'blocked') expect(semantic).toBe('none')
    }
  })
})

describe('COMPOSITION TABLE — the run-state → semantic map is total and matches the brief', () => {
  it.each([
    ['never_run', false, 'none'],
    ['running', true, 'cannot_confirm'],
    ['running', false, 'none'],
    ['blocked', true, 'none'],
    ['refused', true, 'cannot_confirm'],
    ['complete_current', true, 'current'],
    ['complete_stale', true, 'changed'],
    ['unknown_degraded', true, 'cannot_confirm'],
  ] as const)('%s (hasVisibleResult=%s) → %s', (kind, hasResult, expected) => {
    expect(mapRunStateKindToSemantic(kind, hasResult)).toBe(expected)
  })
})
