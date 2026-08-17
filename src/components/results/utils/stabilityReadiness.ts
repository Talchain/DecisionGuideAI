/**
 * STABILITY READINESS — ABSENCE IS NOT CONFIDENCE.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * One question, asked once, with absence as a FIRST-CLASS answer rather than a
 * default: **may a readiness verdict consult the ranking-stability measurement,
 * and what does that measurement say?**
 *
 * ⚠ WHY THIS EXISTS AS A NAMED PREDICATE, AND WHY THE NEXT PERSON MUST NOT
 * "SIMPLIFY" IT BACK TO A COALESCE.
 *
 * The call site used to read:
 *
 *     const hasHighStability = (rankingStability ?? 1) >= MIN_STABLE_RECOMMENDATION_STABILITY
 *
 * PLoT DELIBERATELY WITHHOLDS `robustness.recommendation_stability`, and the
 * older spelling was never emitted at all — see the standing ban and its
 * rationale in `__tests__/withheldFieldReadBan.spec.ts`. So on a fresh run the
 * value arrives ABSENT, and `?? 1` coerced that absence to the **maximum**
 * (`1 >= 0.6`). The conjunct was therefore unconditionally TRUE for every user:
 * a readiness condition that could never fail, still worded as though a
 * stability measurement had been taken and passed.
 *
 * A missing measurement is not a passing measurement. It is also **not a
 * failing one** — coercing absence to zero would trade a fail-open for a
 * fabricated "low confidence", which is the same defect pointing the other way.
 * The only honest reading of absence is NOT ASSESSABLE, so this predicate
 * reports three states through two deliberately-independent booleans:
 *
 *   | measurement        | assessable | isHigh | blocksReadiness |
 *   |--------------------|------------|--------|-----------------|
 *   | >= threshold       | true       | true   | false           |
 *   | <  threshold       | true       | false  | true            |
 *   | absent/non-finite  | false      | false  | false           |
 *
 * `isHigh` and `blocksReadiness` are BOTH false when the value is unavailable.
 * That is the point, not an oversight: absence may neither satisfy a readiness
 * conjunct nor manufacture a warning. A caller that wants "does stability stop
 * us calling this ready?" asks `blocksReadiness`; a caller that wants "did we
 * measure stability and find it high?" asks `isHigh`. Collapsing the two back
 * into one boolean is what produced the fail-open, because a single name has to
 * pick a side for the unmeasured case and either side is a claim.
 *
 * Non-finite input (`NaN`, `Infinity`, `null`) is treated as absent, not as a
 * number. `??` does not catch `NaN`, so the old expression let `NaN` through to
 * `NaN >= 0.6` — false — and a garbage value silently read as "not stable".
 */
import { MIN_STABLE_RECOMMENDATION_STABILITY } from '../constants'

export interface StabilityReadiness {
  /** A finite numeric measurement arrived. False for absent/null/NaN/Infinity. */
  assessable: boolean
  /** Measured AND at or above the threshold. Never true for an absent value. */
  isHigh: boolean
  /** Measured AND below the threshold. Never true for an absent value. */
  blocksReadiness: boolean
}

/** The unmeasured verdict: neither a pass nor a failure. */
const NOT_ASSESSABLE: StabilityReadiness = {
  assessable: false,
  isHigh: false,
  blocksReadiness: false,
}

/**
 * Classify a ranking-stability measurement for readiness purposes.
 *
 * @param stability Raw measurement as it arrives from the wire — routinely
 *   `undefined`, because the producer withholds it (see the block comment).
 */
export function assessStabilityReadiness(
  stability: number | null | undefined,
): StabilityReadiness {
  if (typeof stability !== 'number' || !Number.isFinite(stability)) {
    return NOT_ASSESSABLE
  }
  const isHigh = stability >= MIN_STABLE_RECOMMENDATION_STABILITY
  return { assessable: true, isHigh, blocksReadiness: !isHigh }
}
