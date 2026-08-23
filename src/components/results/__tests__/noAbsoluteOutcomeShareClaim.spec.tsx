/**
 * SENDABLE trust defect — the product printed an arithmetically impossible
 * causal SHARE.
 *
 * WITNESSED (fresh-guest journey, 2026-08-21): the T1 dominance nudge read
 *
 *     "Dominant factor: <label> drives 100% of the outcome."
 *
 * BESIDE two other factors on the SAME screen reading Influence 75% and 68%.
 * Three shares of one outcome summing to 243%.
 *
 * ROOT CAUSE — TWO DEFECTS, ONE SENTENCE.
 *
 * (1) THE CLAIM IS FALSE ON EVERY BASIS THIS PRODUCT HOLDS. "drives NN% of
 *     the outcome" is a SHARE claim: it asserts the factor accounts for NN%
 *     of the outcome, which implies the factors' shares partition 100%.
 *     Neither basis `driverDisplayModel` can resolve is a share:
 *       • 'normalised_elasticity' is |elasticity| / max|elasticity| — the top
 *         factor is 1.0 BY CONSTRUCTION, per-set, not a share of anything;
 *       • 'influence_score' is the producer's absolute causal influence SCORE
 *         (this repo's own canonical wording: INFLUENCE_EXPLANATION_ABSOLUTE,
 *         "an absolute causal influence score from the analysis"). Absolute
 *         SCALE is not PARTITION. Measured at this tip, the repo's golden
 *         staging capture `src/test/fixtures/golden-path-staging-2026-04-05.json`
 *         carries seven `influence_score` values —
 *         1.0 / 0.8494 / 0.7304 / 0.6694 / 0.6562 / 0.3730 / 0.2238 —
 *         SUMMING TO 4.5022, i.e. 450%. On the very basis the old gate called
 *         "honest", the shares are impossible.
 *     So no adjustment to the NUMBER or to the GATE can make this sentence
 *     true. THE CLAIM IS WHAT IS WRONG, and the claim is what this lane fixes.
 *
 * (2) TRAP 21 — THE GATE CERTIFIED ONE FIELD AND THE SENTENCE PRINTED ANOTHER.
 *     `absoluteBasis` asked "does an ABSOLUTE producer score exist?" (reading
 *     `displayProvenance` / `influenceScore`) while `topInfluence` — the value
 *     actually rendered — was read `displayInfluence ?? influenceScore ?? …`
 *     FIRST. On an unstamped payload carrying BOTH a set-relative
 *     `displayInfluence` (top ≡ 1.0) and a modest `influenceScore`, the gate
 *     passed on the producer score and the sentence printed the set-relative
 *     1.0 as "100%". Two authorities, one sentence, different questions.
 *
 * CONVERGENCE (Paul's binding rule).
 *   • Canonical owner of WHAT NUMBER MAY BACK A BASIS-STAMPED INFLUENCE CLAIM:
 *     `driverDisplayModel.resolveDriverClaimBasis` — returns the value AND the
 *     basis THAT PRODUCED IT, so a surface cannot certify one field and print
 *     another. The competing inline `displayInfluence ?? influenceScore ?? …`
 *     / `displayProvenance ? … : typeof influenceScore` pair in
 *     `TriageActionCardsBody` is REMOVED, not wrapped.
 *   • Canonical owner of HOW AN INFLUENCE NUMBER MAY BE DESCRIBED IN WORDS:
 *     `influenceScaleCopy` (already "the ONE home for influence-scale
 *     disclosure wording"). Both share-claiming surfaces — the T1 nudge and
 *     `TriageCard`'s influence-bar tooltip — now render from
 *     `influenceMagnitudePredicate` / `influenceMagnitudeTitle`. The literal
 *     "of the outcome" template in `TriageCard.tsx` is REMOVED, not wrapped.
 *
 * WHAT IS DELIBERATELY UNCHANGED: the nudge's firing condition (absolute
 * producer basis AND >= 0.8 AND clear of the runner-up). A genuinely dominant
 * factor still gets its warning — see the OPPOSITE-DIRECTION TWINS below.
 * Silencing the honest case would be the inverse defect (trap 22b).
 *
 * Trap-19 identity binding: every driver assertion names its object by
 * `factorKey`/`factorLabel`, never by a value predicate a sibling row shares.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

import { resolveDriverClaimBasis } from '../driverDisplayModel'
import {
  influenceMagnitudePredicate,
  influenceMagnitudeTitle,
} from '../influenceScaleCopy'
import { TriageActionCardsBody } from '../TriageActionCardsBody'
import { TriageCard } from '../../shared/TriageCard'
import type { ResultsSectionDataReturn } from '../useResultsSectionData'
import type { DriversSectionData, DriverItem } from '../types'

vi.mock('../../../canvas/utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
}))

/**
 * The forbidden sentence shape. Deliberately matches the CLAIM ("<n>% of the
 * outcome"), not the specific number, so it stays sensitive to a re-worded
 * regression that keeps the share framing.
 */
const OUTCOME_SHARE_CLAIM = /\d+\s*%\s*of the outcome/i

function makeDriver(overrides: Partial<DriverItem> & { factorKey: string }): DriverItem {
  return {
    factorLabel: overrides.factorKey,
    rawElasticity: 0.5,
    normalisedInfluence: 0.8,
    influenceScore: 0.8,
    rank: 1,
    semanticLabel: 'biggest',
    canFocus: false,
    direction: 'positive',
    ...overrides,
  }
}

function makeData(drivers: DriverItem[]): DriversSectionData {
  return {
    drivers,
    topDrivers: drivers.slice(0, 3),
    driversStatus: 'computed',
    totalCount: drivers.length,
    hasMagnitudeData: true,
  }
}

function triageData(drivers: DriverItem[]) {
  return {
    drivers: {
      ...makeData(drivers),
      dominantFactorId: drivers[0]?.factorKey,
      dominantFactorLabel: drivers[0]?.factorLabel,
    },
    recommendation: { recommendedOption: null },
    confidence: { recommendedOptionId: undefined },
    assumptions: { items: [] },
    gaps: { items: [] },
    risks: { items: [] },
  } as unknown as ResultsSectionDataReturn
}

/** The witnessed set: a real producer-basis run whose scores do not partition. */
const WITNESSED_NON_PARTITIONING_SET = [
  makeDriver({
    factorKey: 'cloud_migration_progress',
    factorLabel: 'Cloud migration progress',
    influenceScore: 1,
    normalisedInfluence: 1,
    displayInfluence: 1,
    displayProvenance: 'influence_score',
  }),
  makeDriver({
    factorKey: 'licence_cost',
    factorLabel: 'Licence cost',
    influenceScore: 0.75,
    normalisedInfluence: 0.75,
    displayInfluence: 0.75,
    displayProvenance: 'influence_score',
  }),
  makeDriver({
    factorKey: 'team_capacity',
    factorLabel: 'Team capacity',
    influenceScore: 0.68,
    normalisedInfluence: 0.68,
    displayInfluence: 0.68,
    displayProvenance: 'influence_score',
  }),
]

// =============================================================================
// 1. THE WITNESSED SENTENCE — no surface states an influence number as a share
// =============================================================================

describe('no surface states an influence number as a share of the outcome', () => {
  it('THE WITNESSED CLAIM: the dominance nudge does not say "100% of the outcome"', () => {
    render(
      <TriageActionCardsBody data={triageData(WITNESSED_NON_PARTITIONING_SET)} suppressTriageQueue />,
    )
    const nudge = screen.getByTestId('t1-dominant-nudge')
    expect(nudge.textContent ?? '').not.toMatch(OUTCOME_SHARE_CLAIM)
    // The title/aria copy carries the same sentence; the claim must be gone
    // from the generated text too, not merely hidden from the visible span.
    expect(nudge.getAttribute('title') ?? '').not.toMatch(OUTCOME_SHARE_CLAIM)
    expect(nudge.getAttribute('aria-label') ?? '').not.toMatch(OUTCOME_SHARE_CLAIM)
  })

  it("THE SECOND SURFACE: TriageCard's influence tooltip does not claim a share", () => {
    render(
      <TriageCard
        cardKey="licence_cost"
        ordinal={1}
        title="Licence cost"
        detail="Detail"
        category="verify"
        influence={0.68}
      />,
    )
    const titled = document.querySelectorAll('[title]')
    const titles = Array.from(titled).map((el) => el.getAttribute('title') ?? '')
    // Positive control: the influence bar DOES carry a tooltip, so a clean
    // "no share claim" result cannot come from there being no tooltip at all.
    expect(titles.some((t) => /influence/i.test(t))).toBe(true)
    for (const t of titles) expect(t).not.toMatch(OUTCOME_SHARE_CLAIM)
  })
})

// =============================================================================
// 2. THE CANONICAL OWNER — value and basis come from ONE read (trap 21)
// =============================================================================

describe('resolveDriverClaimBasis — the certified basis and the printed value are one read', () => {
  it('stamped payload: returns the stamped value on the stamped basis', () => {
    expect(
      resolveDriverClaimBasis({
        displayInfluence: 0.9,
        displayProvenance: 'influence_score',
        influenceScore: 0.9,
        normalisedInfluence: 1,
      }),
    ).toEqual({ value: 0.9, provenance: 'influence_score' })
  })

  it('stamped set-relative payload: never reports the absolute basis', () => {
    expect(
      resolveDriverClaimBasis({
        displayInfluence: 1,
        displayProvenance: 'normalised_elasticity',
        influenceScore: 0.42,
        normalisedInfluence: 1,
      }),
    ).toEqual({ value: 1, provenance: 'normalised_elasticity' })
  })

  it('THE TRAP-21 CASE: unstamped payload takes the value FROM the field that certifies the basis', () => {
    // displayInfluence is set-relative (top === 1 by construction); the only
    // absolute number on this row is influenceScore. Reading displayInfluence
    // while certifying influenceScore is exactly what printed "100%".
    expect(
      resolveDriverClaimBasis({
        displayInfluence: 1,
        influenceScore: 0.6,
        normalisedInfluence: 1,
      }),
    ).toEqual({ value: 0.6, provenance: 'influence_score' })
  })

  it('no absolute number at all: falls back to the set-relative basis, never claims absolute', () => {
    expect(resolveDriverClaimBasis({ normalisedInfluence: 0.7 })).toEqual({
      value: 0.7,
      provenance: 'normalised_elasticity',
    })
  })

  it('no usable number: returns null rather than defaulting to zero on a claimed basis', () => {
    expect(resolveDriverClaimBasis({})).toBeNull()
  })
})

describe('the nudge reads its number through the canonical owner', () => {
  it('THE TRAP-21 REGRESSION: an unstamped row with a modest producer score does not fire a 100% nudge', () => {
    const legacyMixedBasis = [
      makeDriver({
        factorKey: 'cloud_migration_progress',
        factorLabel: 'Cloud migration progress',
        influenceScore: 0.6, // absolute, below the 0.8 dominance floor
        normalisedInfluence: 1,
        displayInfluence: 1, // set-relative: top === 1 by construction
        displayProvenance: undefined, // legacy fixture / cached payload
      }),
      makeDriver({
        factorKey: 'licence_cost',
        factorLabel: 'Licence cost',
        influenceScore: 0.1,
        normalisedInfluence: 0.17,
        displayInfluence: 0.17,
        displayProvenance: undefined,
      }),
    ]
    render(<TriageActionCardsBody data={triageData(legacyMixedBasis)} suppressTriageQueue />)
    expect(screen.queryByTestId('t1-dominant-nudge')).not.toBeInTheDocument()
  })

  // ── OPPOSITE-DIRECTION TWIN ──────────────────────────────────────────────
  it('TWIN — an unstamped row whose PRODUCER score is genuinely dominant still fires, at the producer number', () => {
    const legacyGenuinelyDominant = [
      makeDriver({
        factorKey: 'cloud_migration_progress',
        factorLabel: 'Cloud migration progress',
        influenceScore: 0.93,
        normalisedInfluence: 1,
        displayInfluence: 1,
        displayProvenance: undefined,
      }),
      makeDriver({
        factorKey: 'licence_cost',
        factorLabel: 'Licence cost',
        influenceScore: 0.1,
        normalisedInfluence: 0.11,
        displayInfluence: 0.11,
        displayProvenance: undefined,
      }),
    ]
    render(<TriageActionCardsBody data={triageData(legacyGenuinelyDominant)} suppressTriageQueue />)
    const nudge = screen.getByTestId('t1-dominant-nudge')
    // Identity binding: the nudge names THIS factor, and quotes the PRODUCER
    // number (93%), not the set-relative 100% that sits on the same row.
    expect(nudge.textContent).toContain('Cloud migration progress')
    expect(nudge.textContent).toContain('93%')
    expect(nudge.textContent).not.toContain('100%')
  })
})

// =============================================================================
// 3. OPPOSITE-DIRECTION TWINS — the honest warning survives
// =============================================================================

describe('the honest dominance warning still fires', () => {
  it('TWIN — a genuinely dominant factor on the producer basis is still named', () => {
    const clearlyDominant = [
      makeDriver({
        factorKey: 'cloud_migration_progress',
        factorLabel: 'Cloud migration progress',
        influenceScore: 0.95,
        normalisedInfluence: 1,
        displayInfluence: 0.95,
        displayProvenance: 'influence_score',
      }),
      makeDriver({
        factorKey: 'licence_cost',
        factorLabel: 'Licence cost',
        influenceScore: 0.15,
        normalisedInfluence: 0.16,
        displayInfluence: 0.15,
        displayProvenance: 'influence_score',
      }),
    ]
    render(<TriageActionCardsBody data={triageData(clearlyDominant)} suppressTriageQueue />)
    const nudge = screen.getByTestId('t1-dominant-nudge')
    expect(nudge).toBeInTheDocument()
    expect(nudge.textContent).toContain('Cloud migration progress')
    expect(nudge.textContent).toContain('95%')
    // The number survives; only the SHARE framing is gone.
    expect(nudge.textContent ?? '').not.toMatch(OUTCOME_SHARE_CLAIM)
  })

  it('TWIN — the set-relative basis still gets no dominance claim at all', () => {
    const setRelative = [
      makeDriver({
        factorKey: 'cloud_migration_progress',
        factorLabel: 'Cloud migration progress',
        influenceScore: undefined,
        normalisedInfluence: 1,
        displayInfluence: 1,
        displayProvenance: 'normalised_elasticity',
      }),
      makeDriver({
        factorKey: 'licence_cost',
        factorLabel: 'Licence cost',
        influenceScore: undefined,
        normalisedInfluence: 0.2,
        displayInfluence: 0.2,
        displayProvenance: 'normalised_elasticity',
      }),
    ]
    render(<TriageActionCardsBody data={triageData(setRelative)} suppressTriageQueue />)
    expect(screen.queryByTestId('t1-dominant-nudge')).not.toBeInTheDocument()
  })
})

// =============================================================================
// 4. THE COPY OWNER — basis-aware, share-free, in both grammatical slots
// =============================================================================

describe('influenceScaleCopy owns the wording, on every basis', () => {
  const BASES = ['influence_score', 'normalised_elasticity', null, undefined] as const

  it('no basis produces a share claim, in either slot', () => {
    for (const basis of BASES) {
      expect(influenceMagnitudePredicate(100, basis)).not.toMatch(OUTCOME_SHARE_CLAIM)
      expect(influenceMagnitudeTitle(100, basis)).not.toMatch(OUTCOME_SHARE_CLAIM)
    }
  })

  it('every basis still carries the number', () => {
    for (const basis of BASES) {
      expect(influenceMagnitudePredicate(68, basis)).toContain('68%')
      expect(influenceMagnitudeTitle(68, basis)).toContain('68%')
    }
  })

  it('the set-relative basis discloses that it is set-relative; the absolute one does not', () => {
    expect(influenceMagnitudePredicate(100, 'normalised_elasticity')).toMatch(
      /relative to the strongest factor/i,
    )
    expect(influenceMagnitudePredicate(100, 'influence_score')).not.toMatch(
      /relative to the strongest factor/i,
    )
  })

  it('an unstamped basis fails closed: no basis is claimed either way', () => {
    const unstamped = influenceMagnitudePredicate(68, undefined)
    expect(unstamped).not.toMatch(/relative to the strongest factor/i)
    expect(unstamped).not.toMatch(/absolute/i)
  })

  it('the title slot is sentence case and the predicate slot is not', () => {
    expect(influenceMagnitudeTitle(68, null)[0]).toBe(
      influenceMagnitudeTitle(68, null)[0].toUpperCase(),
    )
    expect(influenceMagnitudePredicate(68, null).startsWith('has ')).toBe(true)
  })
})
