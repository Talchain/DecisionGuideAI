/**
 * The `analysis_state` INGEST READER — the store member's three-valued contract.
 *
 * WHY THIS FILE EXISTS. At the point it was written, `analysis_state` had ZERO
 * reader specs while `analysis_ready` had 69 files touching it. The whole
 * authority claim of the migration rests on this reader writing the slice
 * correctly, and "the selector composes it right" says nothing about whether
 * the value ever arrives.
 *
 * THE THREE-VALUED CONTRACT, and the middle case is the one worth arguing:
 *   · a parseable verdict SETS the slice;
 *   · an UNPARSEABLE verdict CLEARS it;
 *   · an ABSENT key CLEARS it too.
 *
 * That last rule is deliberately NOT the retain-on-absence rule the freshness
 * slice three lines away uses, and the difference is the point. Freshness
 * retains because CEE's silence means "nothing has changed about the verdict I
 * already gave you". `analysis_state` is a claim about THIS turn, and it
 * OUTRANKS every local derivation — so retaining it across a silent turn would
 * let a stale verdict veto live local signals. Between "no verdict" and "last
 * turn's verdict wins", no verdict is the honest one.
 */
import { describe, it, expect, vi } from 'vitest'
import { AnalysisStateV1Schema } from '@talchain/schemas/boundary'

import { applyV5State } from '../applyV5State'

const VALID_VERDICT = {
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
} as const

/** A store double carrying only what this reader touches. */
function makeStore() {
  return {
    setCurrentStage: vi.fn(),
    updateNode: vi.fn(),
    updateEdgeData: vi.fn(),
    nodes: [],
    edges: [],
    setRunMeta: vi.fn(),
    setCeeAnalysisReady: vi.fn(),
    setAnalysisFreshness: vi.fn(),
    setAnalysisRefusalNotice: vi.fn(),
    setAnalysisStateV1: vi.fn(),
  }
}

function apply(responseExtra: Record<string, unknown>) {
  const store = makeStore()
  const result = applyV5State(
    {
      response_version: 2,
      assistant_text: 'ok',
      blocks: [],
      ...responseExtra,
    } as any,
    store as any,
  )
  return { store, result }
}

describe('analysis_state ingest — the three-valued contract', () => {
  it('SETS the slice from a parseable verdict, verbatim', () => {
    const { store, result } = apply({ analysis_state: VALID_VERDICT })
    expect(store.setAnalysisStateV1).toHaveBeenCalledTimes(1)
    // Verbatim: the reader must not reshape, default or enrich the producer's
    // verdict on the way in.
    expect(store.setAnalysisStateV1).toHaveBeenCalledWith(VALID_VERDICT)
    expect(result.applied).toContain('analysis_state:set')
  })

  it('CLEARS the slice when the turn carries no analysis_state at all', () => {
    const { store, result } = apply({})
    expect(store.setAnalysisStateV1).toHaveBeenCalledTimes(1)
    expect(store.setAnalysisStateV1).toHaveBeenCalledWith(null)
    // Not an "applied" write — nothing was stated, so nothing is claimed.
    expect(result.applied).not.toContain('analysis_state:set')
  })

  it('CLEARS the slice on an unparseable verdict, and says so as a deferral', () => {
    const { store, result } = apply({ analysis_state: { run_state: { kind: 'teapot' } } })
    expect(store.setAnalysisStateV1).toHaveBeenCalledWith(null)
    expect(result.applied).toContain('analysis_state:cleared_invalid_shape')
    expect(result.deferred.map((d) => d.reason)).toContain('analysis_state_invalid_shape')
  })

  it('a silent turn does NOT retain the previous verdict — the anti-retain rule', () => {
    // Driven as two turns against one store double: the second turn must clear
    // what the first set. Without this, a stale verdict would keep outranking
    // live local derivations for the rest of the session.
    const store = makeStore()
    const base = { response_version: 2, assistant_text: 'ok', blocks: [] } as any
    applyV5State({ ...base, analysis_state: VALID_VERDICT }, store as any)
    applyV5State(base, store as any)

    expect(store.setAnalysisStateV1.mock.calls.map((c) => c[0])).toStrictEqual([
      VALID_VERDICT,
      null,
    ])
  })

  it('is optional-chained: a store double without the setter does not throw', () => {
    // Every other setter on this applicator is optional for the same reason —
    // partial store doubles are the convention in this suite, and a hard
    // requirement here would break unrelated specs rather than fail loudly.
    const store = makeStore() as Partial<ReturnType<typeof makeStore>>
    delete store.setAnalysisStateV1
    expect(() =>
      applyV5State(
        { response_version: 2, assistant_text: 'ok', blocks: [], analysis_state: VALID_VERDICT } as any,
        store as any,
      ),
    ).not.toThrow()
  })
})

describe('the fixture claims this lane wrote in COMMENTS, now executed', () => {
  /**
   * These two were documented as verified in prose in
   * `responseParser.declaredKeysReachStrict.spec.ts` and in the vendor README.
   * A verification that lives only in a comment is a claim nothing re-checks —
   * trap 13b. They are assertions now.
   */
  it('the sample verdict is VALID, and a cause on complete_current is NOT', () => {
    expect(AnalysisStateV1Schema.safeParse(VALID_VERDICT).success).toBe(true)
    expect(
      AnalysisStateV1Schema.safeParse({
        ...VALID_VERDICT,
        run_state: { ...VALID_VERDICT.run_state, cause: 'graph_changed' },
      }).success,
    ).toBe(false)
  })

  it('a refused branch carrying computed_at is REJECTED — the strictness that matters', () => {
    // The contract's whole reason for making the branches strict: a refusal must
    // not be able to hand a consumer a timestamp it will read as currency.
    expect(
      AnalysisStateV1Schema.safeParse({
        ...VALID_VERDICT,
        run_state: {
          kind: 'refused',
          reason_code: 'declined',
          computed_at: '2026-08-16T10:00:00.000Z',
        },
      }).success,
    ).toBe(false)
  })
})
