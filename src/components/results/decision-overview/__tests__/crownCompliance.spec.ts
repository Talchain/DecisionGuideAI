/**
 * Crown compliance render seam — the six producer states, plus absence.
 *
 * PROVENANCE. Every enum value and every reason string below is quoted from the
 * PRODUCER (`plot-lite-service` @ staging `e19ac506`,
 * `src/routes/v2/crown-eligibility.ts`: `CrownCompliance` and
 * `CROWN_COMPLIANCE_REASONS`). None is authored here — that is the point of the
 * verbatim rule, and a reason invented in this spec would be testing the wrong
 * oracle (doctrine trap 13c).
 *
 * ⚠ HONEST NOTE ON ORDER: this spec was written AFTER `crownCompliance.ts`, not
 * RED-first — the module is new, so there was no defect to reproduce. Its
 * discrimination is therefore established by the mutant pair recorded in the
 * lane report, not by a pristine RED.
 */
import { describe, expect, it } from 'vitest'

import {
  CROWN_COMPLIANCE_DOT_TONE,
  CROWN_COMPLIANCE_VALUES,
  normaliseCrownCompliance,
  selectCrownComplianceDisclosure,
} from '../crownCompliance'

/** The producer's own table, quoted. */
const PRODUCER_REASONS = {
  not_applicable: 'no limits were set for this decision',
  compliant: 'this option met every limit you set, in all the scenarios we tested',
  uncertain: 'this option met your limits in some scenarios but not others',
  unverified: 'we could not check this option against your limits on a reliable scale',
  not_assessed: 'we could not check every limit you set on this run',
  no_eligible_option: 'no option met the limits you set, so none is being recommended',
} as const

describe('normaliseCrownCompliance — fail-closed narrowing', () => {
  it('accepts every producer enum value, bound by EXACT token', () => {
    // Iterates the exported constant rather than a hand-copied list, so a
    // producer value added to the module without a test cannot pass unnoticed
    // (doctrine trap 12 — derive, do not mirror).
    expect(CROWN_COMPLIANCE_VALUES).toHaveLength(6)
    for (const value of CROWN_COMPLIANCE_VALUES) {
      expect(normaliseCrownCompliance(value), `enum ${value}`).toBe(value)
    }
  })

  it('rejects an unrecognised token, absence, and non-strings', () => {
    // A future producer value must not crash or be guessed at.
    expect(normaliseCrownCompliance('partially_compliant')).toBeUndefined()
    expect(normaliseCrownCompliance('COMPLIANT')).toBeUndefined()
    expect(normaliseCrownCompliance(undefined)).toBeUndefined()
    expect(normaliseCrownCompliance(null)).toBeUndefined()
    expect(normaliseCrownCompliance(true)).toBeUndefined()
    expect(normaliseCrownCompliance(1)).toBeUndefined()
    expect(normaliseCrownCompliance({ verdict: 'compliant' })).toBeUndefined()
  })
})

describe('selectCrownComplianceDisclosure — the six-state rendering table', () => {
  it('not_applicable renders NOTHING — the only value meaning "no limits were set"', () => {
    // Its reason would directly contradict the user's stated-limits list above
    // it. Silence here is not a dead end: the limits themselves still render.
    expect(
      selectCrownComplianceDisclosure('not_applicable', PRODUCER_REASONS.not_applicable),
    ).toBeNull()
  })

  it('compliant renders POSITIVE, with the producer reason verbatim', () => {
    const d = selectCrownComplianceDisclosure('compliant', PRODUCER_REASONS.compliant)
    expect(d?.verdict).toBe('compliant')
    expect(d?.tone).toBe('positive')
    expect(d?.reason).toBe(PRODUCER_REASONS.compliant)
  })

  it('no_eligible_option renders NEGATIVE — a definite producer claim, never an absence', () => {
    const d = selectCrownComplianceDisclosure(
      'no_eligible_option',
      PRODUCER_REASONS.no_eligible_option,
    )
    expect(d?.verdict).toBe('no_eligible_option')
    expect(d?.tone).toBe('negative')
    // The obligation from the wire contract: on this state there is NO
    // recommended_option_id, so the reason is the ONLY thing standing between
    // the user and an unexplained empty leader slot.
    expect(d?.reason).toBe(PRODUCER_REASONS.no_eligible_option)
  })

  it('⭐ uncertain is UNKNOWN and is NEVER binarised into a breach', () => {
    const d = selectCrownComplianceDisclosure('uncertain', PRODUCER_REASONS.uncertain)
    expect(d?.verdict).toBe('uncertain')
    expect(d?.tone).toBe('unknown')
    // Bound by exact tone identity in BOTH directions — asserting "not negative"
    // alone would also pass for 'positive'.
    expect(d?.tone).not.toBe('negative')
    expect(d?.tone).not.toBe('positive')
  })

  it('⭐ unverified is UNKNOWN — the scale was untrusted, so no claim EITHER way', () => {
    const d = selectCrownComplianceDisclosure('unverified', PRODUCER_REASONS.unverified)
    expect(d?.verdict).toBe('unverified')
    expect(d?.tone).toBe('unknown')
    expect(d?.tone).not.toBe('negative')
    expect(d?.tone).not.toBe('positive')
  })

  it('⭐ not_assessed is UNKNOWN and is DISTINCT from not_applicable', () => {
    const d = selectCrownComplianceDisclosure('not_assessed', PRODUCER_REASONS.not_assessed)
    // Renders — where not_applicable does not. The two states are byte-similar
    // in English and opposite in meaning: "we did not check your limits" vs
    // "you set none". Collapsing them is the falsehood PLoT #338 fixed upstream.
    expect(d).not.toBeNull()
    expect(d?.verdict).toBe('not_assessed')
    expect(d?.tone).toBe('unknown')
    expect(d?.reason).toBe(PRODUCER_REASONS.not_assessed)
    // And it must never borrow the "no limits" sentence.
    expect(d?.reason).not.toBe(PRODUCER_REASONS.not_applicable)
  })

  it('every rendered state carries a NON-EMPTY producer reason', () => {
    // The counter-invariant: safety must not reduce this surface to a silent
    // dead end. Wherever we speak at all, the user gets a sentence.
    for (const value of CROWN_COMPLIANCE_VALUES) {
      const d = selectCrownComplianceDisclosure(value, PRODUCER_REASONS[value])
      if (value === 'not_applicable') {
        expect(d, 'not_applicable stays silent').toBeNull()
        continue
      }
      expect(d, `${value} renders`).not.toBeNull()
      expect(d?.reason.length, `${value} reason non-empty`).toBeGreaterThan(0)
    }
  })
})

describe('selectCrownComplianceDisclosure — the verdict is never shown without its reason', () => {
  it('drops the disclosure when the producer reason is missing or blank', () => {
    // The UI authors no copy for the verdict, so a token with no sentence is
    // unrenderable rather than rendered raw.
    expect(selectCrownComplianceDisclosure('no_eligible_option', undefined)).toBeNull()
    expect(selectCrownComplianceDisclosure('no_eligible_option', '')).toBeNull()
    expect(selectCrownComplianceDisclosure('no_eligible_option', '   ')).toBeNull()
    expect(selectCrownComplianceDisclosure('compliant', 42)).toBeNull()
  })

  it('OPPOSITE-DIRECTION TWIN — a present reason on the same verdict DOES render', () => {
    // Proves the null above is caused by the missing reason and not by the
    // verdict being unrenderable for some other cause.
    const d = selectCrownComplianceDisclosure(
      'no_eligible_option',
      PRODUCER_REASONS.no_eligible_option,
    )
    expect(d).not.toBeNull()
  })
})

describe('CROWN_COMPLIANCE_DOT_TONE — reuses the card’s own tone classes', () => {
  it('maps the three tones to the card’s existing STATE_DOT_TONE classes', () => {
    // Not a new palette: these are the classes DecisionOverviewCard already
    // uses, so a compliance dot cannot drift from the card around it.
    expect(CROWN_COMPLIANCE_DOT_TONE.positive).toBe('bg-success')
    expect(CROWN_COMPLIANCE_DOT_TONE.negative).toBe('bg-danger')
    expect(CROWN_COMPLIANCE_DOT_TONE.unknown).toBe('bg-text-light')
  })
})
