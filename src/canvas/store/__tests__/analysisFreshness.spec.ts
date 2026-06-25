/**
 * deriveAnalysisFreshnessUpdate — the freshness slice contract:
 * retain on absence · never absence→fresh · order by computed_at · 4 states.
 */
import { describe, it, expect } from 'vitest'
import {
  deriveAnalysisFreshnessUpdate,
  resolveDisplayedFreshness,
  classifyFreshnessForDisplay,
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
    const equal = deriveAnalysisFreshnessUpdate(p, {
      freshness: 'stale',
      computed_at: '2026-06-23T12:00:00.000Z',
    })
    expect(equal).toBe(p) // equal ignored (no change)
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
    expect(classifyFreshnessForDisplay(null, false)).toBe('none')
    expect(classifyFreshnessForDisplay(prev({ freshness: 'none' }), false)).toBe('none')
  })

  it('clean fresh → current', () => {
    expect(classifyFreshnessForDisplay(prev({ freshness: 'fresh' }), false)).toBe('current')
  })

  it('CEE stale → changed', () => {
    expect(classifyFreshnessForDisplay(prev({ freshness: 'stale' }), true)).toBe('changed')
    expect(classifyFreshnessForDisplay(prev({ freshness: 'stale' }), false)).toBe('changed')
  })

  it('dirty-overlay downgrade of a retained fresh → changed (user definitely edited)', () => {
    expect(classifyFreshnessForDisplay(prev({ freshness: 'fresh' }), true)).toBe('changed')
  })

  it('CEE-sourced unknown → cannot_confirm, NEVER changed (no false "you edited" claim)', () => {
    // A present analysis_ready with missing/invalid freshness degrades to 'unknown'
    // (deriveAnalysisFreshnessUpdate). That is cannot-confirm, not a user edit.
    expect(classifyFreshnessForDisplay(prev({ freshness: 'unknown' }), false)).toBe('cannot_confirm')
    expect(classifyFreshnessForDisplay(prev({ freshness: 'unknown' }), true)).toBe('cannot_confirm')
  })
})
