/**
 * DriversSection influence-scale disclosure (lane C4).
 *
 * Verified gap: on the fallback basis ('normalised_elasticity') the displayed
 * influence is per-set normalised |elasticity| — the top driver shows 100% BY
 * CONSTRUCTION (driverDisplayModel.ts computeNormalisedInfluences), yet no
 * surface disclosed it. The "Relative influence" wording was dropped in
 * v7.10 T9 ("Renamed \"Relative influence\" → \"Influence\" for brevity"),
 * leaving "Influence: how much this factor affects the outcome" — read as an
 * absolute causal share.
 *
 * ⚠⚠ THE SECOND BULLET BELOW USED TO READ "provenance 'influence_score' →
 * honest absolute-basis wording, NO relative caption". THAT WAS THE DEFECT,
 * not the fix. `influence_score` is normalised against `max|influence|`, so its
 * top row is 1.0 by construction exactly as the fallback basis's is — and the
 * producer sends it on an ordinary run. The panel therefore withheld the
 * disclosure on the COMMON CASE and rendered the generic explainer beside a
 * figure that is 100% by construction. Corrected 6 Sep 2026 (PR #1228 review).
 *
 * TWO QUESTIONS, TWO GATES — the component now separates them:
 * - SCALE ("does the top row read 100% by construction?") — yes on BOTH
 *   stamped bases, so both get the visible caption and the relative explainer;
 * - QUANTITY ("which normalisation is this?") — genuinely different, so the
 *   header tooltip keeps its three arms and each names its own quantity.
 *
 * Fix under test (copy/caption only — numbers and ranking policy untouched):
 * - provenance 'normalised_elasticity' → header tooltip + explainer carry the
 *   relative-scale wording, and a visible caption disclosing "top driver
 *   always shows 100%" renders near the panel;
 * - provenance 'influence_score' → the SAME caption and explainer, with the
 *   tooltip naming the producer's quantity;
 * - either basis, degenerate set (nothing renders) → fail-closed to the
 *   generic wording: never claim a 100% top row over zero rows;
 * - no provenance stamp (legacy fixtures / cached payloads) → fail-closed:
 *   today's generic wording, no caption — never claim a basis the pipeline
 *   did not stamp.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DriversSection } from '../DriversSection'
import type { DriversSectionData, DriverItem } from '../types'

vi.mock('../../../canvas/utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
}))

// Deliberately hard-coded (not imported from influenceScaleCopy) so a copy
// change is a conscious, visible decision in this spec. No em dashes (DS ban,
// review fix 3 — policed by influenceScaleCopy.copyHygiene.spec.ts).
const RELATIVE_TOOLTIP =
  'Influence: how much this factor affects the outcome, relative to the strongest. The top driver always shows 100%.'
// ⚠ This is the PRODUCER-basis sentence as shipped by #1228 (`INFLUENCE_EXPLANATION_ABSOLUTE`).
// It stayed hard-coded on purpose (see above) — and that is exactly why it went RED on the
// PR's own head: the copy was re-worded to name its own quantity ("Olumi's structural
// influence score") after this constant had been updated to the relative wording, so the
// mirror lagged the copy by one commit and the Staging Gate caught it. Update BOTH when the
// sentence changes; the point of the duplication is that this file cannot drift silently.
const ABSOLUTE_TOOLTIP =
  "Influence: Olumi's structural influence score, relative to the strongest factor in this run. The top driver always shows 100%."
const GENERIC_TOOLTIP = 'Influence: how much this factor affects the outcome'
const RELATIVE_EXPLAINER =
  'Ranked by how much each factor affects the outcome, relative to the strongest factor'
const GENERIC_EXPLAINER = 'Ranked by how much each factor affects the outcome'
const CAPTION_COPY =
  'Influence is relative to the strongest factor. The top driver always shows 100%.'

function makeDriver(overrides: Partial<DriverItem> & { factorKey: string }): DriverItem {
  return {
    factorLabel: overrides.factorKey,
    rawElasticity: 0.5,
    normalisedInfluence: 0.5,
    rank: 1,
    semanticLabel: 'biggest',
    canFocus: false,
    direction: 'positive',
    ...overrides,
  }
}

function makeDriversData(drivers: DriverItem[]): DriversSectionData {
  return {
    drivers,
    topDrivers: drivers.slice(0, 3),
    driversStatus: 'computed',
    totalCount: drivers.length,
    hasMagnitudeData: true,
  }
}

/** Two-driver set on the fallback basis: top ≡ 1.0 by construction. */
function relativeBasisData(): DriversSectionData {
  return makeDriversData([
    makeDriver({
      factorKey: 'fac_a',
      factorLabel: 'Technical Leadership Capability',
      rawElasticity: 0.9,
      normalisedInfluence: 1,
      displayInfluence: 1,
      displayProvenance: 'normalised_elasticity',
    }),
    makeDriver({
      factorKey: 'fac_b',
      factorLabel: 'Market Timing',
      rawElasticity: 0.45,
      normalisedInfluence: 0.5,
      displayInfluence: 0.5,
      displayProvenance: 'normalised_elasticity',
      rank: 2,
      semanticLabel: 'moderate',
    }),
  ])
}

/**
 * Full producer coverage: every factor carries a raw influence_score — the
 * ORDINARY run, which is what the producer sends.
 *
 * ⚠ THE VALUES USED TO BE 0.62 / 0.31, AND NO PRODUCER RUN LOOKS LIKE THAT.
 * `influence_score` is normalised against `max|influence|`, so the top row is
 * 1.0. Derived over this tree rather than argued: of the 21 JSON files under
 * `src/` carrying the field, every one whose maximum is non-zero maxes at
 * exactly 1.0 (the sweep lives in `influenceIsNeverCalledAbsolute.spec.ts`).
 * A fixture outside the producer's output domain proves nothing about the
 * producer, so this one is 1.0 / 0.88 — the pair measured on the deployed
 * build that opened this PR.
 */
function producerBasisData(): DriversSectionData {
  return makeDriversData([
    makeDriver({
      factorKey: 'fac_a',
      factorLabel: 'Technical Leadership Capability',
      rawElasticity: 0.9,
      normalisedInfluence: 1,
      influenceScore: 1,
      displayInfluence: 1,
      displayProvenance: 'influence_score',
    }),
    makeDriver({
      factorKey: 'fac_b',
      factorLabel: 'Market Timing',
      rawElasticity: 0.45,
      normalisedInfluence: 0.5,
      influenceScore: 0.88,
      displayInfluence: 0.88,
      displayProvenance: 'influence_score',
      rank: 2,
      semanticLabel: 'moderate',
    }),
  ])
}

/**
 * The producer basis in its DEGENERATE state, and it is not hypothetical:
 * `src/lib/coherence/__tests__/fixtures/captures/seeded-2026-08-17-w2d-analysis-turn.json`
 * is a real `response_version: 2` analysis turn whose three factors all carry
 * `influence_score: 0` (one stamped `input_quality: "degenerate_fallback"`).
 * Nothing clears the panel's >= 0.01 visibility filter, so a "top driver always
 * shows 100%" claim would point at zero rows — fail closed, exactly as the
 * fallback basis already does.
 *
 * ⚠ `hasMagnitudeData` is TRUE here on purpose. It is `maxRawElasticity > 0.001`
 * — a fact about the app's own basis — so it cannot be the degeneracy test for
 * the producer's. This fixture would pass a hasMagnitudeData-only guard.
 */
function degenerateProducerData(): DriversSectionData {
  return makeDriversData([
    makeDriver({
      factorKey: 'fac_a',
      factorLabel: 'Wholesale Gas Price',
      rawElasticity: 0.5,
      normalisedInfluence: 0,
      influenceScore: 0,
      displayInfluence: 0,
      displayProvenance: 'influence_score',
    }),
    makeDriver({
      factorKey: 'fac_b',
      factorLabel: 'Price Lock Level',
      rawElasticity: 0.5,
      normalisedInfluence: 0,
      influenceScore: 0,
      displayInfluence: 0,
      displayProvenance: 'influence_score',
      rank: 2,
      semanticLabel: 'minor',
    }),
  ])
}

/**
 * Degenerate magnitude set (review fix 1): elasticities 0.0005/0.0002/0.0001
 * all sit below computeNormalisedInfluences' 0.001 floor, so the data layer
 * stamps every row provenance 'normalised_elasticity' with displayInfluence 0
 * and hasMagnitudeData false; influence_score on ONE row keeps producer
 * coverage incomplete (so the fallback basis is genuinely active). The >=0.01
 * visibility filter then empties the rendered list — a "top driver always
 * shows 100%" claim over ZERO rows would be false.
 */
function degenerateRelativeData(): DriversSectionData {
  return {
    drivers: [
      makeDriver({
        factorKey: 'fac_a',
        factorLabel: 'Factor A',
        rawElasticity: 0.0005,
        normalisedInfluence: 0,
        displayInfluence: 0,
        displayProvenance: 'normalised_elasticity',
        influenceScore: 0.4,
      }),
      makeDriver({
        factorKey: 'fac_b',
        factorLabel: 'Factor B',
        rawElasticity: 0.0002,
        normalisedInfluence: 0,
        displayInfluence: 0,
        displayProvenance: 'normalised_elasticity',
        rank: 2,
        semanticLabel: 'minor',
      }),
      makeDriver({
        factorKey: 'fac_c',
        factorLabel: 'Factor C',
        rawElasticity: 0.0001,
        normalisedInfluence: 0,
        displayInfluence: 0,
        displayProvenance: 'normalised_elasticity',
        rank: 3,
        semanticLabel: 'minor',
      }),
    ],
    topDrivers: [],
    driversStatus: 'computed',
    totalCount: 0,
    hasMagnitudeData: false,
  }
}

/** Legacy fixture shape: displayInfluence/displayProvenance never stamped. */
function legacyData(): DriversSectionData {
  return makeDriversData([
    makeDriver({ factorKey: 'fac_a', factorLabel: 'Factor A', normalisedInfluence: 1 }),
    makeDriver({
      factorKey: 'fac_b',
      factorLabel: 'Factor B',
      normalisedInfluence: 0.5,
      rank: 2,
      semanticLabel: 'moderate',
    }),
  ])
}

function hoverInfluenceHeader(): void {
  // The Tooltip component wraps its child in the floating-ui reference div —
  // hover that wrapper.
  const header = screen.getByText('Influence')
  fireEvent.mouseEnter(header.parentElement!)
}

describe('DriversSection influence-scale disclosure (lane C4)', () => {
  describe('fallback basis (normalised_elasticity) — top driver ≡ 100% by construction', () => {
    it('renders the relative-scale caption near the panel', () => {
      render(<DriversSection data={relativeBasisData()} goalLabel="test" />)
      const caption = screen.getByTestId('influence-scale-caption')
      expect(caption.textContent).toBe(CAPTION_COPY)
    })

    it('explainer carries the relative framing', () => {
      render(<DriversSection data={relativeBasisData()} goalLabel="test" />)
      expect(screen.getByText(RELATIVE_EXPLAINER)).toBeDefined()
    })

    it('Influence header tooltip discloses the relative scale', () => {
      render(<DriversSection data={relativeBasisData()} goalLabel="test" />)
      hoverInfluenceHeader()
      const tooltip = screen.getByRole('tooltip')
      expect(tooltip.textContent).toContain(RELATIVE_TOOLTIP)
    })

    it('does not change the displayed numbers (top driver still shows its 100% bar)', () => {
      const { container } = render(
        <DriversSection data={relativeBasisData()} goalLabel="test" />,
      )
      // The disclosure is copy-only: the top row's bar value stays the shared
      // display model's 1.0 (rendered as a 100%-valued progressbar).
      const bars = container.querySelectorAll('[role="progressbar"]')
      expect(bars.length).toBeGreaterThan(0)
      const values = Array.from(bars).map((b) => Number(b.getAttribute('aria-valuenow')))
      expect(Math.max(...values)).toBe(100)
    })
  })

  describe('producer basis (influence_score) — set-relative too, and it is the ORDINARY run', () => {
    /**
     * ⚠⚠ BOTH ASSERTIONS BELOW WERE THE EXACT OPPOSITE UNTIL 6 Sep 2026, and
     * they pinned a user-visible defect rather than a behaviour.
     *
     * The premise was that `influence_score` is "an absolute structural-causal
     * -influence score from the producer" (`DriversSection.tsx`, the comment
     * above the branch). It is not: the producer normalises against
     * `max|influence|`, so the top row is 1.0 BY CONSTRUCTION. On an ordinary
     * run every row carries this provenance, so the panel rendered the generic
     * explainer and withheld the caption on precisely the case that needs it.
     *
     * Inverted rather than deleted, following #1221's idiom in this same file:
     * they now RED if the disclosure is ever withheld on this basis again.
     */
    it('renders the relative-scale caption (the top row is 1.0 by construction)', () => {
      render(<DriversSection data={producerBasisData()} goalLabel="test" />)
      const caption = screen.getByTestId('influence-scale-caption')
      expect(caption.textContent).toBe(CAPTION_COPY)
    })

    it('explainer carries the relative framing, not the generic wording', () => {
      render(<DriversSection data={producerBasisData()} goalLabel="test" />)
      expect(screen.getByText(RELATIVE_EXPLAINER)).toBeDefined()
      expect(screen.queryByText(GENERIC_EXPLAINER)).toBeNull()
    })

    it('DISCRIMINATOR: the QUANTITY is still the producer one, not the fallback basis one', () => {
      // Two questions, two gates. Widening the SCALE gate to both bases must
      // not collapse the QUANTITY distinction — if the tooltip ever served the
      // fallback basis's sentence here, the two normalisations would have one
      // name and this REDs.
      render(<DriversSection data={producerBasisData()} goalLabel="test" />)
      hoverInfluenceHeader()
      const tooltip = screen.getByRole('tooltip')
      expect(tooltip.textContent).toContain(ABSOLUTE_TOOLTIP)
      expect(tooltip.textContent).not.toContain(RELATIVE_TOOLTIP)
    })

    it('Influence header tooltip DISCLOSES the 100%-by-construction scale', () => {
      /**
       * ⚠⚠ THIS ASSERTED THE OPPOSITE UNTIL 5 Sep 2026 — that the producer-basis
       * tooltip must NOT contain "always shows 100%". That was the sharpest
       * expression of the two-scales design, and the design's premise is false:
       * `influence_score` is normalised against `max|influence|`, so the top row
       * is 1.0 by construction, exactly as the relative basis is. Narrowed to
       * what is measured (6 Sep 2026): of the 21 JSON files under `src/`
       * carrying the field, every one whose maximum is non-zero maxes at exactly
       * 1.0, live staging responses among them; none exceeds 1.0, and one real
       * degenerate turn is uniformly 0 (covered by the degenerate PRODUCER block
       * below). The sweep is derived in `influenceIsNeverCalledAbsolute.spec.ts`.
       *
       * Withholding the disclosure on THIS basis is what let a
       * 100%-by-construction figure read as a causal share. The negative
       * assertion is therefore inverted rather than deleted: it now REDs if the
       * disclosure is ever taken away again.
       */
      render(<DriversSection data={producerBasisData()} goalLabel="test" />)
      hoverInfluenceHeader()
      const tooltip = screen.getByRole('tooltip')
      expect(tooltip.textContent).toContain(ABSOLUTE_TOOLTIP)
      expect(tooltip.textContent).toContain('always shows 100%')
    })
  })

  describe('degenerate PRODUCER set — the same fail-closed rule, on the other basis', () => {
    it('renders no relative-scale caption when every influence_score is 0', () => {
      render(<DriversSection data={degenerateProducerData()} goalLabel="test" />)
      expect(screen.queryByTestId('influence-scale-caption')).toBeNull()
    })

    it('keeps the generic explainer (no relative clause) in the degenerate state', () => {
      render(<DriversSection data={degenerateProducerData()} goalLabel="test" />)
      expect(screen.getByText(GENERIC_EXPLAINER)).toBeDefined()
      expect(screen.queryByText(RELATIVE_EXPLAINER)).toBeNull()
    })

    it('header tooltip falls back to the generic wording, not the 100% claim', () => {
      render(<DriversSection data={degenerateProducerData()} goalLabel="test" />)
      hoverInfluenceHeader()
      const tooltip = screen.getByRole('tooltip')
      expect(tooltip.textContent).toBe(GENERIC_TOOLTIP)
      expect(tooltip.textContent).not.toContain('always shows 100%')
    })

    it('sanity: the fixture really does render zero driver rows', () => {
      // Without this the three assertions above could pass on a panel that is
      // simply not degenerate.
      render(<DriversSection data={degenerateProducerData()} goalLabel="test" />)
      expect(screen.queryByText('Wholesale Gas Price')).toBeNull()
      expect(screen.queryByText('Price Lock Level')).toBeNull()
    })
  })

  describe('degenerate magnitude set (review fix 1) — never claim "top shows 100%" over zero rows', () => {
    it('renders no relative-scale caption when every normalised value collapsed to 0', () => {
      render(<DriversSection data={degenerateRelativeData()} goalLabel="test" />)
      expect(screen.queryByTestId('influence-scale-caption')).toBeNull()
    })

    it('keeps the generic explainer (no relative clause) in the degenerate state', () => {
      render(<DriversSection data={degenerateRelativeData()} goalLabel="test" />)
      expect(screen.getByText(GENERIC_EXPLAINER)).toBeDefined()
      expect(screen.queryByText(RELATIVE_EXPLAINER)).toBeNull()
    })

    it('header tooltip falls back to the generic wording, not the 100% claim', () => {
      render(<DriversSection data={degenerateRelativeData()} goalLabel="test" />)
      hoverInfluenceHeader()
      const tooltip = screen.getByRole('tooltip')
      expect(tooltip.textContent).toBe(GENERIC_TOOLTIP)
      expect(tooltip.textContent).not.toContain('always shows 100%')
    })

    it('sanity: the fixture really does render zero driver rows', () => {
      render(<DriversSection data={degenerateRelativeData()} goalLabel="test" />)
      expect(screen.queryByText('Factor A')).toBeNull()
      expect(screen.queryByText('Factor B')).toBeNull()
      expect(screen.queryByText('Factor C')).toBeNull()
    })
  })

  describe('no provenance stamp (legacy fixtures / cached payloads) — fail-closed', () => {
    it('keeps the pre-existing generic tooltip copy and renders no caption', () => {
      render(<DriversSection data={legacyData()} goalLabel="test" />)
      expect(screen.queryByTestId('influence-scale-caption')).toBeNull()
      hoverInfluenceHeader()
      const tooltip = screen.getByRole('tooltip')
      expect(tooltip.textContent).toBe(GENERIC_TOOLTIP)
    })

    it('keeps the generic explainer', () => {
      render(<DriversSection data={legacyData()} goalLabel="test" />)
      expect(screen.getByText(GENERIC_EXPLAINER)).toBeDefined()
      expect(screen.queryByText(RELATIVE_EXPLAINER)).toBeNull()
    })
  })
})
