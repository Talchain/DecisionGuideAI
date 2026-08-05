/**
 * realtime-signals.test.ts — Golden fixture tests for extractRealtimeSignals.
 *
 * Asserts booleans + readiness level, not marker strings. Skewed toward
 * non-trigger cases to guard against false positives (highest trust risk).
 */

import { describe, it, expect } from 'vitest'
import { extractRealtimeSignals } from '../realtime-signals'

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function signals(text: string) {
  return extractRealtimeSignals(text)
}

// ---------------------------------------------------------------------------
// Structural detection — alternatives
// ---------------------------------------------------------------------------

describe('alternative detection', () => {
  it('Stage A + Stage B: "should we raise prices or stay"', () => {
    const s = signals('Should we raise prices from £49 to £59 or stay at £49?')
    expect(s.has_alternative).toBe(true)
  })

  it('Stage A alone does NOT count: "Should we expand internationally?"', () => {
    const s = signals('Should we expand internationally?')
    expect(s.has_alternative).toBe(false)
  })

  it('noun-list "or" does NOT count: "revenue or profit growth"', () => {
    const s = signals('We want to focus on revenue or profit growth')
    expect(s.has_alternative).toBe(false)
  })

  it('explicit multi-option markers without Stage A: "Option A ... Option B"', () => {
    const s = signals('Option A: expand. Option B: consolidate.')
    expect(s.has_alternative).toBe(true)
  })

  it('"versus" counts as alternative marker', () => {
    const s = signals('Build in-house versus outsource')
    expect(s.has_alternative).toBe(true)
  })

  it('"or" appearing 5 times in non-option contexts', () => {
    const s = signals('We need more or less the same thing or so. Coffee or tea is fine or not. Sooner or later.')
    expect(s.has_alternative).toBe(false)
  })

  it('"instead of" counts as alternative marker', () => {
    const s = signals('We could use React instead of Vue')
    expect(s.has_alternative).toBe(true)
  })

  it('normal planning language without alternatives', () => {
    const s = signals('We need to improve our onboarding experience for new users')
    expect(s.has_alternative).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Structural detection — measurable outcome
// ---------------------------------------------------------------------------

describe('measurable outcome detection', () => {
  it('"Reach £200k MRR" has measurable outcome', () => {
    const s = signals('Reach £200k MRR')
    expect(s.has_measurable_outcome).toBe(true)
  })

  it('"Reduce churn below 4%" has measurable outcome', () => {
    const s = signals('Reduce churn below 4%')
    expect(s.has_measurable_outcome).toBe(true)
  })

  it('"Improve retention" without number does NOT qualify', () => {
    const s = signals('Improve retention')
    expect(s.has_measurable_outcome).toBe(false)
  })

  it('"Team of 12 engineers" — context number, no target verb', () => {
    const s = signals('We have a team of 12 engineers')
    expect(s.has_measurable_outcome).toBe(false)
  })

  it('"£200k" with k suffix counts as number', () => {
    const s = signals('Target £200k revenue this quarter')
    expect(s.has_measurable_outcome).toBe(true)
  })

  it('price mentioned as context, no target verb: "Our product costs £99/month"', () => {
    const s = signals('Our product costs £99/month and we have 500 customers')
    expect(s.has_measurable_outcome).toBe(false)
  })

  it('"grow revenue" without number does NOT qualify', () => {
    const s = signals('We want to grow revenue significantly')
    expect(s.has_measurable_outcome).toBe(false)
  })

  it('"increase conversion rate to 5%" qualifies', () => {
    const s = signals('Increase conversion rate to 5%')
    expect(s.has_measurable_outcome).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Structural detection — baseline
// ---------------------------------------------------------------------------

describe('baseline detection', () => {
  it('"from £49 to £59" has baseline', () => {
    const s = signals('Should we raise prices from £49 to £59?')
    expect(s.has_baseline).toBe(true)
  })

  it('"Raise to £59" without from-value has NO baseline', () => {
    const s = signals('Raise to £59')
    expect(s.has_baseline).toBe(false)
  })

  it('"currently high churn" has baseline', () => {
    const s = signals('We have currently high churn and need to fix it')
    expect(s.has_baseline).toBe(true)
  })

  it('"currently thinking about options" — process verb guard', () => {
    const s = signals('We are currently thinking about options')
    expect(s.has_baseline).toBe(false)
  })

  it('"currently considering" — process verb guard', () => {
    const s = signals('Currently considering our next move')
    expect(s.has_baseline).toBe(false)
  })

  it('"currently at 15% churn" has baseline', () => {
    const s = signals('Currently at 15% churn rate')
    expect(s.has_baseline).toBe(true)
  })

  it('"right now our pipeline is strong" has baseline', () => {
    const s = signals('Right now our pipeline is strong')
    // "strong" + noun = adjective/noun phrase after baseline pattern
    expect(s.has_baseline).toBe(true)
  })

  it('explicit unknown baseline overrides present patterns', () => {
    const s = signals("We don't know the baseline but currently have some data")
    expect(s.has_baseline).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Structural detection — constraint/risk
// ---------------------------------------------------------------------------

describe('constraint and risk detection', () => {
  it('"Budget of £50k" has constraint', () => {
    const s = signals('Budget of £50k')
    expect(s.has_constraint).toBe(true)
    expect(s.has_constraint_or_risk).toBe(true)
  })

  it('"Worried about churn" has risk', () => {
    const s = signals('Worried about churn')
    expect(s.has_risk).toBe(true)
    expect(s.has_constraint_or_risk).toBe(true)
  })

  it('"deadline of Q4" has constraint', () => {
    const s = signals('We have a deadline of Q4 to ship this')
    expect(s.has_constraint).toBe(true)
  })

  it('no constraint or risk language', () => {
    const s = signals('We want to build a new feature')
    expect(s.has_constraint_or_risk).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Bias detection — sunk cost (highest trust risk: false positives)
// ---------------------------------------------------------------------------

describe('bias: sunk cost', () => {
  it('"We\'ve already spent £200k" triggers sunk cost', () => {
    const s = signals("We've already spent £200k on this project")
    expect(s.bias_detected).toBe('sunk_cost')
  })

  it('"After all the work we\'ve put in" triggers sunk cost', () => {
    const s = signals("After all the work we've put in, we should keep going")
    expect(s.bias_detected).toBe('sunk_cost')
  })

  it('no sunk cost language → null', () => {
    const s = signals('We need to decide whether to expand into Europe or focus on the US market')
    expect(s.bias_detected).toBeNull()
  })

  it('budget context with single number triggers anchoring (spec-correct)', () => {
    const s = signals('Our marketing budget is £50k per quarter')
    // £50k is a single qualifying number in first sentence — anchoring per spec.
    // Constraint-word context does not suppress anchoring (only spec-listed
    // exclusions apply: years, <=99 without currency/%, ordinals, versions).
    expect(s.bias_detected).toBe('anchoring')
  })

  it('"invested in our team" without sunk framing', () => {
    const s = signals('We have invested in our team and now want to grow')
    // "we've invested" is a sunk cost phrase — this should trigger
    // but "have invested" (without contraction) should NOT
    // Actually "We have invested" doesn't match "we've invested"
    expect(s.bias_detected).toBeNull()
  })

  it('sunk cost priority over anchoring', () => {
    const s = signals("We've already spent £200k and can't walk away now")
    expect(s.bias_detected).toBe('sunk_cost')
  })
})

// ---------------------------------------------------------------------------
// Bias detection — anchoring (false positive heavy)
// ---------------------------------------------------------------------------

describe('bias: anchoring', () => {
  it('one number "£200k" in first sentence → anchoring', () => {
    const s = signals('The deal is worth £200k. We need to decide quickly.')
    expect(s.bias_detected).toBe('anchoring')
  })

  it('multiple distinct numbers → NOT anchoring', () => {
    const s = signals('Revenue is £200k and costs are £150k')
    expect(s.bias_detected).toBeNull()
  })

  it('"3-person team" as sole number → NOT anchoring (<=99, no currency/%)', () => {
    const s = signals('We have a 3-person team working on this')
    expect(s.bias_detected).toBeNull()
  })

  it('"15 beta customers" — no currency/% → NOT anchoring (<=99)', () => {
    const s = signals('We have 15 beta customers')
    expect(s.bias_detected).toBeNull()
  })

  it('year "2025" as only number → NOT anchoring', () => {
    const s = signals('We need to launch by 2025')
    expect(s.bias_detected).toBeNull()
  })

  it('year "2024" excluded, but 30% in first sentence → anchoring', () => {
    const s = signals('In 2024 we grew by 30%. Now we need a new strategy.')
    // 2024 excluded as year. 30% (has %) is single qualifying number in first sentence.
    expect(s.bias_detected).toBe('anchoring')
  })

  it('year as sole number with no other numbers → NOT anchoring', () => {
    const s = signals('In 2024 we launched our product. Now we need a strategy.')
    expect(s.bias_detected).toBeNull()
  })

  it('"Phase 2" excluded from anchoring count', () => {
    const s = signals('We are in Phase 2 and need to decide on Phase 3 strategy')
    expect(s.bias_detected).toBeNull()
  })

  it('"v3" excluded from anchoring count', () => {
    const s = signals('We are building v3 of our platform')
    expect(s.bias_detected).toBeNull()
  })

  it('"Option 1" and "Step 3" excluded from anchoring', () => {
    const s = signals('Option 1 is to proceed. Step 3 involves deployment.')
    expect(s.bias_detected).toBeNull()
  })

  it('"v2" version number excluded', () => {
    const s = signals('Should we migrate from v2 to the new architecture?')
    expect(s.bias_detected).toBeNull()
  })

  it('ordinal "1st" excluded from anchoring', () => {
    const s = signals('This is our 1st attempt at international expansion')
    expect(s.bias_detected).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Readiness levels
// ---------------------------------------------------------------------------

describe('readiness computation', () => {
  it('all 4 true → strong', () => {
    const s = signals(
      'Should we raise prices from £49 to £59 or stay at £49? ' +
      'Target £200k MRR. Budget of £100k. Currently at 10% churn.',
    )
    expect(s.has_alternative).toBe(true)
    expect(s.has_measurable_outcome).toBe(true)
    expect(s.has_baseline).toBe(true)
    expect(s.has_constraint_or_risk).toBe(true)
    expect(s.readiness).toBe('strong')
  })

  it('2 true → ok', () => {
    const s = signals('Should we raise prices or stay? Budget of £50k.')
    expect(s.readiness).toBe('ok')
  })

  it('1 true → low', () => {
    const s = signals('Budget of £50k')
    expect(s.readiness).toBe('low')
  })

  it('0 true → low', () => {
    const s = signals('We need to think about our strategy')
    expect(s.readiness).toBe('low')
  })
})

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('edge cases', () => {
  it('empty string → all false, readiness low', () => {
    const s = signals('')
    expect(s.has_alternative).toBe(false)
    expect(s.has_measurable_outcome).toBe(false)
    expect(s.has_baseline).toBe(false)
    expect(s.has_constraint_or_risk).toBe(false)
    expect(s.bias_detected).toBeNull()
    expect(s.readiness).toBe('low')
  })

  it('only whitespace → all false, low', () => {
    const s = signals('   \n\t  ')
    expect(s.has_alternative).toBe(false)
    expect(s.readiness).toBe('low')
  })

  it('"£" without number following → no measurable outcome', () => {
    const s = signals('Increase our £ denominated revenue')
    expect(s.has_measurable_outcome).toBe(false)
  })

  it('dates should not trigger: "by March 2025"', () => {
    const s = signals('We need to launch by March 2025')
    expect(s.bias_detected).toBeNull()
  })

  it('version numbers should not trigger: "upgrading to v2"', () => {
    const s = signals('We are upgrading to v2 of our API')
    expect(s.bias_detected).toBeNull()
  })

  it('"Phase 3 rollout" should not trigger anchoring', () => {
    const s = signals('Phase 3 rollout will happen after we review results')
    expect(s.bias_detected).toBeNull()
  })

  it('normal planning language with no triggers', () => {
    const s = signals('We need to decide on our hiring strategy for next quarter')
    expect(s.has_alternative).toBe(false)
    expect(s.has_measurable_outcome).toBe(false)
    expect(s.has_baseline).toBe(false)
    expect(s.has_constraint_or_risk).toBe(false)
    expect(s.bias_detected).toBeNull()
    expect(s.readiness).toBe('low')
  })

  it('multiple "or" in non-option contexts should not trigger alternative', () => {
    const s = signals(
      'The team liked it more or less. We can take it or leave it. ' +
      'Sooner or later we will decide. For better or worse.',
    )
    expect(s.has_alternative).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Non-trigger cases (false positive guards)
// ---------------------------------------------------------------------------

describe('false positive guards', () => {
  it('prices as context, not target: "Our SaaS is priced at $49/month"', () => {
    const s = signals('Our SaaS is priced at $49/month with annual billing')
    expect(s.has_measurable_outcome).toBe(false)
  })

  it('dates should not be baselines: "Founded in 2019"', () => {
    const s = signals('Founded in 2019, we have grown steadily')
    // 2019 is a year — should not trigger anchoring
    expect(s.bias_detected).toBeNull()
  })

  it('planning language: "We should evaluate our options carefully"', () => {
    const s = signals('We should evaluate our options carefully before proceeding')
    expect(s.has_alternative).toBe(false)
    expect(s.bias_detected).toBeNull()
  })

  it('generic question: "How do we grow faster?"', () => {
    const s = signals('How do we grow faster?')
    expect(s.has_alternative).toBe(false)
    expect(s.has_measurable_outcome).toBe(false)
  })

  it('"currently exploring new markets" — process verb guard', () => {
    const s = signals('We are currently exploring new markets in Asia')
    expect(s.has_baseline).toBe(false)
  })

  it('"currently evaluating vendors" — process verb guard', () => {
    const s = signals('Currently evaluating vendors for our CRM')
    expect(s.has_baseline).toBe(false)
  })

  it('"or" between nouns: "sales or marketing team"', () => {
    const s = signals('Should we hire for the sales or marketing team?')
    // Stage A fires ("should we"), but "or" is between nouns not verbs
    expect(s.has_alternative).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Performance
// ---------------------------------------------------------------------------

/**
 * WHAT THIS PROVES, AND WHY IT IS SHAPED THIS WAY
 *
 * The stated risk for `extractRealtimeSignals` is regex backtracking on
 * pathological input — i.e. SUPERLINEAR growth in the length of the brief.
 * That is a property of the ALGORITHM, so this test measures the algorithm's
 * growth rate, not the machine's speed.
 *
 * The predecessor asserted a raw wall-clock average (`avgMs < 5`). That is a
 * measurement of the HOST, not of the code: it went red whenever anything else
 * on the machine wanted CPU, while a genuine regression that merely doubled the
 * constant factor would still have passed on a fast box. Two instruments are
 * changed here, both for measured reasons:
 *
 *   1. CPU TIME, NOT WALL-CLOCK. `process.cpuUsage()` does not accrue while the
 *      process is descheduled, so contention cancels out. Measured on a 10-core
 *      host at load average 66-83 (8x oversubscribed, 20 spinners + 3 sibling
 *      test lanes), 15 trials of the design below:
 *        CPU-time ratio  min 3.417 | p50 3.831 | max 4.031   (expected 4.0)
 *        wall-clock ratio min 2.085 | p50 6.095 | max 16.815  (same runs)
 *      Wall-clock is not a usable instrument here at any threshold; individual
 *      wall samples of identical work swung 6.2ms -> 104.7ms on this host.
 *
 *   2. A RATIO AT 4x INPUT, NOT AN ABSOLUTE TIME. Host speed multiplies both
 *      arms equally and cancels. 4x (rather than 2x) is chosen to widen the gap
 *      between the two hypotheses being distinguished: linear work lands at 4x,
 *      an accidental O(n^2) pass well above it.
 *
 * THE CEILING (6.0) IS DERIVED FROM MEASUREMENT, NOT PICKED. Note that a real
 * quadratic regression does NOT land at the textbook 16x, because the surviving
 * linear work dilutes it — so a ceiling reasoned from theory alone (the 4-vs-16
 * geometric midpoint, 8.0) was measured to be too loose, and was tightened:
 *      healthy code, worst of 15 trials under deliberate load ....... 4.031
 *      mutant A (nested O(n^2) pass over words) ..... median 9.82, worst 9.42
 *      mutant B (number-exclusion window widened to
 *                the whole brief — accidentally O(n^2)) . median 8.74, worst 7.89
 * At 8.0, mutant B cleared by only 9% and two of its nine samples fell BELOW the
 * bound. 6.0 is the geometric midpoint of the healthy worst case and mutant B's
 * worst sample: 49% headroom above observed noise, and every sample of both
 * mutants exceeds it by >=31%. See the lane evidence file
 * `PHASE0-EVIDENCE-2026-07-28/lane-perftest-2026-08-05.md`.
 *
 * Scope note: this catches SUPERLINEAR growth. A regex whose backtracking is
 * exponential rather than polynomial does not produce a finite ratio at all — it
 * is caught by the explicit test timeout below, not by this assertion.
 *
 * The doubling is an honest doubling of the pathological dimension: the input is
 * a repeated unit, so 4x repeats quadruples every dimension the hot path scans —
 * text length, sentence count, extracted numbers, and `or`-splits alike. There is
 * no "easy part" being padded.
 *
 * (Note: the predecessor's name said "500-word brief". `Array(100)` of a 28-word
 * unit is ~2,800 words. The large arm below keeps that exact input; only the
 * label is corrected.)
 */
describe('performance', () => {
  const UNIT =
    'We are considering whether to expand into the European market or focus on US growth. ' +
    'Currently at £150k MRR with 5% monthly churn. Budget is capped at £500k.'
  const brief = (repeats: number) => Array(repeats).fill(UNIT).join(' ')

  /** Small arm: ~700 words. Large arm: ~2,800 words (the predecessor's input). */
  const SMALL_REPEATS = 25
  const SIZE_FACTOR = 4
  /** Median over paired, adjacent samples: a pair is measured within a few ms, so
   *  a P-core/E-core migration tends to hit both arms of a pair equally. */
  const PAIRS = 9
  /** Degeneracy floor: a sample below timer granularity makes the ratio noise.
   *  Iterations are scaled UP until the small arm clears this; if it cannot, the
   *  test FAILS loudly rather than passing on an unmeasurable sample. */
  const MIN_SAMPLE_CPU_MS = 20
  const MAX_ITERS = 4096
  /** See the derivation in the block comment above — measured, not picked. */
  const RATIO_CEILING = 6
  /** Host-sensitive but deliberately NON-BINDING backstop. Worst large-arm cost
   *  observed under load-83 was ~3.7ms CPU/call; 50ms is ~13x that, so it cannot
   *  fire on contention. It exists only to catch a regression that is linear but
   *  enormously slower (which the ratio, by construction, cannot see). */
  const ABS_LARGE_CPU_MS_PER_CALL = 50

  function cpuMs(text: string, iters: number): number {
    const before = process.cpuUsage()
    for (let i = 0; i < iters; i++) extractRealtimeSignals(text)
    const d = process.cpuUsage(before)
    return (d.user + d.system) / 1000
  }

  const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]

  it('scales linearly with brief length: 4x input costs <6x CPU (guards superlinear growth)', () => {
    expect(
      typeof process?.cpuUsage,
      'process.cpuUsage() is unavailable, so this test cannot measure anything. It must ' +
        'not be allowed to pass silently — run this suite on Node, or port the measurement.',
    ).toBe('function')

    const small = brief(SMALL_REPEATS)
    const large = brief(SMALL_REPEATS * SIZE_FACTOR)

    // Warm up both shapes so JIT tiering is not attributed to the large arm.
    cpuMs(small, 40)
    cpuMs(large, 10)

    // Calibrate: grow iterations until one sample is comfortably above timer
    // granularity. Both arms use the SAME iteration count, so the ratio is
    // unaffected by whatever value this lands on.
    let iters = 8
    let calibration = 0
    while (iters <= MAX_ITERS) {
      calibration = cpuMs(small, iters)
      if (calibration >= MIN_SAMPLE_CPU_MS) break
      iters *= 2
    }
    expect(
      calibration,
      `Small-arm sample stayed below ${MIN_SAMPLE_CPU_MS}ms of CPU at ${MAX_ITERS} iterations ` +
        `(got ${calibration.toFixed(3)}ms). The ratio below would be timer noise, so this is a ` +
        'hard failure, not a pass: raise MAX_ITERS or SMALL_REPEATS.',
    ).toBeGreaterThanOrEqual(MIN_SAMPLE_CPU_MS)

    const ratios: number[] = []
    const largeCpuPerCall: number[] = []
    for (let p = 0; p < PAIRS; p++) {
      const smallCpu = cpuMs(small, iters)
      const largeCpu = cpuMs(large, iters)
      ratios.push(largeCpu / smallCpu)
      largeCpuPerCall.push(largeCpu / iters)
    }

    const growth = median(ratios)
    expect(
      growth,
      `${SIZE_FACTOR}x input consumed ${growth.toFixed(2)}x CPU. Linear work lands near ` +
        `${SIZE_FACTOR}x; the two quadratic regressions this bound was calibrated against ` +
        'landed at 8.7x and 9.8x. This is superlinear growth in the length of the brief — ' +
        'suspect regex backtracking, a nested pass over the words, or a per-item scan that ' +
        'now re-reads the whole text. This assertion is contention-immune (it measures CPU ' +
        'time, not wall-clock), so a busy machine is NOT the explanation. ' +
        `Samples: ${ratios.map(r => r.toFixed(2)).join(', ')}`,
    ).toBeLessThan(RATIO_CEILING)

    // Non-binding sanity backstop — see ABS_LARGE_CPU_MS_PER_CALL above.
    expect(median(largeCpuPerCall)).toBeLessThan(ABS_LARGE_CPU_MS_PER_CALL)
  }, 120_000)
})
