/**
 * deriveAnalysisFreshnessUpdate — the freshness slice contract:
 * retain on absence · never absence→fresh · order by computed_at · 4 states.
 */
import { describe, it, expect } from 'vitest'
import {
  deriveAnalysisFreshnessUpdate,
  resolveDisplayedFreshness,
  classifyFreshnessForDisplay,
  isSelfContradictoryStale,
  type AnalysisFreshnessState,
} from '../analysisFreshness'

const prev = (over: Partial<AnalysisFreshnessState> = {}): AnalysisFreshnessState => ({
  freshness: 'fresh',
  computedAt: '2026-06-23T10:00:00.000Z',
  ...over,
})

describe('deriveAnalysisFreshnessUpdate', () => {
  it('captures the four CEE states verbatim', () => {
    for (const f of ['fresh', 'stale', 'unknown', 'none'] as const) {
      const next = deriveAnalysisFreshnessUpdate(null, { freshness: f })
      expect(next?.freshness).toBe(f)
    }
  })

  it('retains the previous verdict when a turn carries no analysis_ready', () => {
    const p = prev({ freshness: 'stale' })
    expect(deriveAnalysisFreshnessUpdate(p, undefined)).toBe(p)
    expect(deriveAnalysisFreshnessUpdate(p, null)).toBe(p)
    expect(deriveAnalysisFreshnessUpdate(p, 'not-an-object')).toBe(p)
  })

  it('never derives fresh from absence (null prev stays null)', () => {
    expect(deriveAnalysisFreshnessUpdate(null, null)).toBeNull()
    expect(deriveAnalysisFreshnessUpdate(null, undefined)).toBeNull()
  })

  it('degrades a present-but-missing/invalid freshness to unknown, never fresh', () => {
    expect(deriveAnalysisFreshnessUpdate(null, {})?.freshness).toBe('unknown')
    expect(deriveAnalysisFreshnessUpdate(null, { freshness: 'bogus' })?.freshness).toBe('unknown')
    expect(deriveAnalysisFreshnessUpdate(null, { freshness: 42 })?.freshness).toBe('unknown')
  })

  it('orders by computed_at: ignores a strictly-older payload', () => {
    const p = prev({ freshness: 'fresh', computedAt: '2026-06-23T12:00:00.000Z' })
    const older = deriveAnalysisFreshnessUpdate(p, {
      freshness: 'stale',
      computed_at: '2026-06-23T09:00:00.000Z',
    })
    expect(older).toBe(p) // older ignored
  })

  /**
   * ⭐ CORRECTED 2026-08-10. This block used to assert that an EQUAL-timestamp
   * payload is ignored, which positively enshrined a live defect: `computed_at`
   * stamps the ANALYSIS, not the verdict, so CEE re-evaluates freshness against
   * the CURRENT graph and re-sends the SAME analysis with a NEW verdict and a
   * NEW `current_graph_hash`. Witnessed on staging: after a graph edit CEE
   * returned `freshness: 'stale'` with a new `current_graph_hash` at an
   * unchanged `computed_at`, and the store discarded it — keeping `fresh` and
   * the stale hashes, so the panel told the user the analysis reflected a model
   * it did not.
   *
   * The ordering rule is now STRICTLY older. Equal timestamps are decided by
   * the echo guard below (`sameVerdict`), which is the check that actually
   * answers "is this the same verdict?" — the timestamp only ever answered
   * "is this the same analysis?", a different question.
   */
  it('equal computed_at + IDENTICAL verdict: still a no-op (same reference — the echo guard, not the clock, decides)', () => {
    const p = prev({
      freshness: 'fresh',
      computedAt: '2026-06-23T12:00:00.000Z',
      graphHashAtRun: 'h-run',
      currentGraphHash: 'h-run',
    })
    const echoed = deriveAnalysisFreshnessUpdate(p, {
      freshness: 'fresh',
      computed_at: '2026-06-23T12:00:00.000Z',
      graph_hash_at_run: 'h-run',
      current_graph_hash: 'h-run',
    })
    expect(echoed).toBe(p)
  })

  it('equal computed_at + CHANGED verdict: CEE’s re-evaluation is APPLIED, hashes and all', () => {
    const p = prev({
      freshness: 'fresh',
      computedAt: '2026-06-23T12:00:00.000Z',
      graphHashAtRun: 'h-run',
      currentGraphHash: 'h-run',
    })
    const reEvaluated = deriveAnalysisFreshnessUpdate(p, {
      freshness: 'stale',
      computed_at: '2026-06-23T12:00:00.000Z',
      graph_hash_at_run: 'h-run',
      current_graph_hash: 'h-edited',
    })
    expect(reEvaluated).not.toBe(p)
    expect(reEvaluated?.freshness).toBe('stale')
    expect(reEvaluated?.graphHashAtRun).toBe('h-run')
    expect(reEvaluated?.currentGraphHash).toBe('h-edited')
    expect(reEvaluated?.computedAt).toBe('2026-06-23T12:00:00.000Z')
  })

  it('applies a newer payload', () => {
    const p = prev({ freshness: 'fresh', computedAt: '2026-06-23T09:00:00.000Z' })
    const next = deriveAnalysisFreshnessUpdate(p, {
      freshness: 'stale',
      computed_at: '2026-06-23T12:00:00.000Z',
    })
    expect(next?.freshness).toBe('stale')
    expect(next?.computedAt).toBe('2026-06-23T12:00:00.000Z')
  })

  it('applies a payload without computed_at (cannot order → latest verdict wins)', () => {
    const p = prev({ freshness: 'fresh', computedAt: '2026-06-23T12:00:00.000Z' })
    const next = deriveAnalysisFreshnessUpdate(p, { freshness: 'stale' })
    expect(next?.freshness).toBe('stale')
  })

  it('echo guard: a re-delivered identical payload is a no-op (same reference)', () => {
    // computed_at is not part of the CEE contract today, so an echoed analysis_ready
    // (no computed_at) must NOT look like a new verdict — otherwise it would clear
    // the local dirty overlay. Identical content → same reference returned.
    const p = prev({ freshness: 'fresh', freshnessReason: 'graph_hash_match', computedAt: undefined })
    const echoed = deriveAnalysisFreshnessUpdate(p, {
      freshness: 'fresh',
      freshness_reason: 'graph_hash_match',
    })
    expect(echoed).toBe(p) // no change → dirty overlay would be retained

    // A genuinely different verdict (or different run hash) IS applied.
    const changed = deriveAnalysisFreshnessUpdate(p, {
      freshness: 'fresh',
      freshness_reason: 'graph_hash_match',
      current_graph_hash: 'new-hash',
    })
    expect(changed).not.toBe(p)
    expect(changed?.currentGraphHash).toBe('new-hash')
  })

  it('captures supporting fields (reason/hashes) when present', () => {
    const next = deriveAnalysisFreshnessUpdate(null, {
      freshness: 'fresh',
      freshness_reason: 'graph_hash_match',
      graph_hash_at_run: 'abc',
      current_graph_hash: 'abc',
      computed_at: '2026-06-23T10:00:00.000Z',
    })
    expect(next).toEqual({
      freshness: 'fresh',
      freshnessReason: 'graph_hash_match',
      graphHashAtRun: 'abc',
      currentGraphHash: 'abc',
      computedAt: '2026-06-23T10:00:00.000Z',
    })
  })

  it('echo guard survives the run-completion overwrite: an echo of the SUPERSEDED verdict is a no-op', () => {
    // The run-completion write (noteRunCompletedWithoutVerdict) replaces the
    // stored verdict without a CEE payload and records what it replaced in
    // supersededVerdict. The guard compares against the last CEE payload —
    // both the stored verdict AND the superseded one — otherwise a
    // byte-identical pre-run 'stale' echoed on the next conversational turn
    // reads as NEW and resurrects "model changed" over the results the run
    // just produced.
    const preRunStale: AnalysisFreshnessState = {
      freshness: 'stale',
      freshnessReason: 'analysed_options_diverged',
      graphHashAtRun: '595d1a7b7ec9272b',
      currentGraphHash: '595d1a7b7ec9272b',
      computedAt: undefined,
    }
    const afterRun: AnalysisFreshnessState = {
      freshness: 'unknown',
      freshnessReason: 'run_completed_without_verdict',
      supersededVerdict: preRunStale,
    }
    const echoed = deriveAnalysisFreshnessUpdate(afterRun, {
      freshness: 'stale',
      freshness_reason: 'analysed_options_diverged',
      graph_hash_at_run: '595d1a7b7ec9272b',
      current_graph_hash: '595d1a7b7ec9272b',
    })
    expect(echoed).toBe(afterRun) // no-op: the run's honest 'unknown' stands

    // POSITIVE CONTROL: a genuinely NEW verdict after the run write applies.
    const genuinelyNew = deriveAnalysisFreshnessUpdate(afterRun, {
      freshness: 'fresh',
      freshness_reason: 'graph_hash_match',
      current_graph_hash: 'new-hash',
    })
    expect(genuinelyNew).not.toBe(afterRun)
    expect(genuinelyNew?.freshness).toBe('fresh')
  })
})

describe('resolveDisplayedFreshness (local dirty overlay display rule)', () => {
  const fresh = prev({ freshness: 'fresh' })

  it('returns null when there is no verdict (renders nothing)', () => {
    expect(resolveDisplayedFreshness(null, false)).toBeNull()
    expect(resolveDisplayedFreshness(null, true)).toBeNull()
  })

  it('passes a clean fresh verdict through unchanged', () => {
    expect(resolveDisplayedFreshness(fresh, false)).toBe('fresh')
  })

  it('downgrades fresh → unknown when the local dirty overlay is set', () => {
    expect(resolveDisplayedFreshness(fresh, true)).toBe('unknown')
  })

  it('never downgrades a CEE stale verdict (stays stale even when dirty)', () => {
    const stale = prev({ freshness: 'stale' })
    expect(resolveDisplayedFreshness(stale, true)).toBe('stale')
    expect(resolveDisplayedFreshness(stale, false)).toBe('stale')
  })

  // Verdict semantics (brief item 1, first acceptance bullet — a16a0e82):
  // a 'stale' verdict whose OWN payload carries identical at-run/current
  // hashes is self-contradictory; the display must be the cannot-confirm
  // variant, never the factual "model changed" claim. Keyed on hash
  // EQUALITY — semantic, not a pin of buggy-era engine frequency: it stays
  // correct after the engine-side guard fix (it simply stops firing).
  describe('self-contradictory stale (identical hashes) downgrades to cannot-confirm', () => {
    const contradictory = prev({
      freshness: 'stale',
      freshnessReason: 'analysed_options_diverged',
      graphHashAtRun: '595d1a7b7ec9272b',
      currentGraphHash: '595d1a7b7ec9272b',
    })

    it('identical hashes → displayed unknown (cannot-confirm), dirty or not', () => {
      expect(resolveDisplayedFreshness(contradictory, false)).toBe('unknown')
      expect(resolveDisplayedFreshness(contradictory, true)).toBe('unknown')
      expect(classifyFreshnessForDisplay(contradictory, false, false)).toBe('cannot_confirm')
      expect(classifyFreshnessForDisplay(contradictory, true, false)).toBe('cannot_confirm')
    })

    it('POSITIVE CONTROL: differing hashes keep the factual stale/changed claim', () => {
      const genuine = prev({
        freshness: 'stale',
        graphHashAtRun: '595d1a7b7ec9272b',
        currentGraphHash: 'a-different-hash',
      })
      expect(resolveDisplayedFreshness(genuine, false)).toBe('stale')
      expect(classifyFreshnessForDisplay(genuine, false, false)).toBe('changed')
    })

    it('missing or empty hashes are NOT a contradiction (verdict trusted)', () => {
      expect(resolveDisplayedFreshness(prev({ freshness: 'stale' }), false)).toBe('stale')
      expect(
        resolveDisplayedFreshness(
          prev({ freshness: 'stale', graphHashAtRun: 'only-one-side' }),
          false,
        ),
      ).toBe('stale')
      expect(isSelfContradictoryStale('stale', '', '')).toBe(false)
      expect(isSelfContradictoryStale('stale', undefined, undefined)).toBe(false)
    })

    it('the rule never touches non-stale verdicts', () => {
      expect(isSelfContradictoryStale('fresh', 'h', 'h')).toBe(false)
      expect(isSelfContradictoryStale('unknown', 'h', 'h')).toBe(false)
      expect(isSelfContradictoryStale('none', 'h', 'h')).toBe(false)
    })
  })

  it('leaves unknown / none verdicts untouched regardless of dirty', () => {
    for (const f of ['unknown', 'none'] as const) {
      const s = prev({ freshness: f })
      expect(resolveDisplayedFreshness(s, true)).toBe(f)
      expect(resolveDisplayedFreshness(s, false)).toBe(f)
    }
  })

  it('never fabricates stale and never upgrades (only fresh→unknown is possible)', () => {
    // Exhaustive: the only state→display change the overlay can produce is
    // fresh→unknown. Everything else is identity.
    for (const f of ['fresh', 'stale', 'unknown', 'none'] as const) {
      const out = resolveDisplayedFreshness(prev({ freshness: f }), true)
      if (f === 'fresh') expect(out).toBe('unknown')
      else expect(out).toBe(f)
      expect(out).not.toBe('stale-fabricated') // sanity: no invented values
    }
  })
})

describe('classifyFreshnessForDisplay (copy semantic across AI-panel surfaces)', () => {
  it('no verdict → none', () => {
    expect(classifyFreshnessForDisplay(null, false, false)).toBe('none')
    expect(classifyFreshnessForDisplay(prev({ freshness: 'none' }), false, false)).toBe('none')
  })

  it('clean fresh → current', () => {
    expect(classifyFreshnessForDisplay(prev({ freshness: 'fresh' }), false, false)).toBe('current')
  })

  it('CEE stale → changed', () => {
    expect(classifyFreshnessForDisplay(prev({ freshness: 'stale' }), true, false)).toBe('changed')
    expect(classifyFreshnessForDisplay(prev({ freshness: 'stale' }), false, false)).toBe('changed')
  })

  it('dirty-overlay downgrade of a retained fresh → changed (user definitely edited)', () => {
    expect(classifyFreshnessForDisplay(prev({ freshness: 'fresh' }), true, false)).toBe('changed')
  })

  it('CEE-sourced unknown → cannot_confirm, NEVER changed (no false "you edited" claim)', () => {
    // A present analysis_ready with missing/invalid freshness degrades to 'unknown'
    // (deriveAnalysisFreshnessUpdate). That is cannot-confirm, not a user edit.
    expect(classifyFreshnessForDisplay(prev({ freshness: 'unknown' }), false, false)).toBe('cannot_confirm')
    expect(classifyFreshnessForDisplay(prev({ freshness: 'unknown' }), true, false)).toBe('cannot_confirm')
  })
})
