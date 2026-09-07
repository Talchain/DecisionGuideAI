/**
 * THE ANALYSIS TAB SAYS WHICH QUANTITY ITS FIGURES ARE, PER RUN.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE GAP THIS CLOSES, STATED AS THE CASE RATHER THAN AS THE RULE
 * ═══════════════════════════════════════════════════════════════════════════
 * `DriversSection.influenceScaleDisclosure.spec.tsx` beside this file pins the
 * SCALE disclosure, and its header names the second question explicitly: the
 * QUANTITY is "genuinely different" between the two bases. It then pins that
 * question only in the header TOOLTIP, which a pointer user never opens.
 *
 * The visible surface says nothing. And the basis is chosen PER RUN, all or
 * nothing — `selectDriverDisplayModel` adopts the producer score only when
 * EVERY ranked factor carries a finite one, so one missing score moves the
 * whole run onto the fallback. The top row prints 100% by construction on both
 * bases. So a reader watching the same panel across two runs sees the same
 * "100%" beside the same factor name meaning "most strongly connected to the
 * goal in this model" once and "moves the outcome most" the next time, with
 * nothing on screen marking the switch.
 *
 * That the two quantities really do differ is measured, not asserted, in
 * `influenceQuantityVocabulary.spec.ts`: `influence_score` diverges from the
 * magnitude chain on 41 of 123 real factor rows, and the producer's own two
 * rankings disagree on 55 of 95.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT IS UNDER TEST
 * ═══════════════════════════════════════════════════════════════════════════
 * A second `role="note"` caption, additive to the scale caption and never a
 * replacement for it (they answer different questions — CLAUDE.md trap 21):
 *   · producer basis   -> names structural influence;
 *   · fallback basis   -> names outcome sensitivity AND states the producer
 *                         condition that caused the run to land there;
 *   · either basis degenerate, or no stamp -> renders NOTHING. Naming a
 *     quantity over zero rows is the same over-reach as claiming a 100% top
 *     row over zero rows.
 *
 * ⚠ THE EXPECTED STRINGS ARE IMPORTED, NOT HARD-CODED, AND THAT IS THE OPPOSITE
 * OF THE SIBLING SPEC'S CHOICE. The sibling hard-codes deliberately so a copy
 * change is a visible decision, and its own header records that the duplication
 * went stale by one commit and was caught by CI. This spec's subject is the
 * BINDING — that each basis gets ITS OWN entry and never the other's — so it
 * imports the vocabulary and asserts identity against the basis key. Pinning
 * the sentences here as well would make the binding assertions pass on a swap
 * as long as both literals were updated together.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DriversSection } from '../DriversSection'
import { INFLUENCE_QUANTITY_BY_BASIS } from '../influenceScaleCopy'
import type { DriversSectionData, DriverItem } from '../types'

vi.mock('../../../canvas/utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
}))

const CAPTION = 'influence-quantity-caption'
const SCALE_CAPTION = 'influence-scale-caption'

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

function makeDriversData(
  drivers: DriverItem[],
  hasMagnitudeData = true,
): DriversSectionData {
  return {
    drivers,
    topDrivers: drivers.slice(0, 3),
    driversStatus: 'computed',
    totalCount: drivers.length,
    hasMagnitudeData,
  }
}

/** Full producer coverage — the ordinary run. Top row 1.0 by construction. */
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
 * The SAME factors, one run later, with one producer score missing upstream.
 * `selectDriverDisplayModel`'s `factors.every(...)` then drops EVERY row onto
 * the fallback, which is why this fixture stamps the fallback on both rows
 * rather than mixing bases: an all-or-nothing verdict cannot produce a mix.
 */
function fallbackBasisData(): DriversSectionData {
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

/** Producer basis, all-zero — a real capture shape. Nothing clears the filter. */
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
  ])
}

/** Fallback basis below the magnitude floor. */
function degenerateFallbackData(): DriversSectionData {
  return makeDriversData(
    [
      makeDriver({
        factorKey: 'fac_a',
        factorLabel: 'Wholesale Gas Price',
        rawElasticity: 0.0005,
        normalisedInfluence: 0,
        displayInfluence: 0,
        displayProvenance: 'normalised_elasticity',
      }),
    ],
    false,
  )
}

/** Legacy / cached payload: no provenance stamp at all. */
function unstampedData(): DriversSectionData {
  return makeDriversData([
    makeDriver({
      factorKey: 'fac_a',
      factorLabel: 'Technical Leadership Capability',
      rawElasticity: 0.9,
      normalisedInfluence: 1,
    }),
  ])
}

describe('DriversSection — per-run influence QUANTITY disclosure', () => {
  it('POSITIVE CONTROL: the panel renders and the scale caption is present', () => {
    // Without this, every "the quantity caption is absent" assertion below
    // could be passing because the panel rendered nothing at all (trap 13).
    render(<DriversSection data={producerBasisData()} />)
    expect(screen.getByTestId(SCALE_CAPTION)).toBeInTheDocument()
    expect(screen.getByTestId(CAPTION)).toBeInTheDocument()
  })

  /**
   * ⭐⭐ THE DISCRIMINATING PAIR, BOUND BY IDENTITY.
   *
   * Each case asserts the caption holds the entry belonging to THAT basis, and
   * that it does NOT hold the other basis's entry. Either assertion alone would
   * survive the bases being swapped; the pair does not. Bound to the vocabulary
   * by key rather than to a phrase another string could satisfy (trap 19).
   */
  it('the producer basis names structural influence, and not the other quantity', () => {
    render(<DriversSection data={producerBasisData()} />)
    const caption = screen.getByTestId(CAPTION)
    expect(caption).toHaveTextContent(
      INFLUENCE_QUANTITY_BY_BASIS.influence_score.runDisclosure,
    )
    expect(caption).not.toHaveTextContent(
      INFLUENCE_QUANTITY_BY_BASIS.normalised_elasticity.runDisclosure,
    )
  })

  it('the fallback basis names outcome sensitivity, and not the other quantity', () => {
    render(<DriversSection data={fallbackBasisData()} />)
    const caption = screen.getByTestId(CAPTION)
    expect(caption).toHaveTextContent(
      INFLUENCE_QUANTITY_BY_BASIS.normalised_elasticity.runDisclosure,
    )
    expect(caption).not.toHaveTextContent(
      INFLUENCE_QUANTITY_BY_BASIS.influence_score.runDisclosure,
    )
  })

  /**
   * ⭐ THE POINT OF THE WHOLE LANE, AS ONE ASSERTION.
   *
   * The two runs are the SAME two factors with the SAME displayed top value of
   * 1.0. Only the basis moved. If the panel's visible copy did not change, the
   * reader has no way to tell the two runs apart, which is the defect.
   */
  it('the SAME factors at the SAME top value disclose DIFFERENTLY across two runs', () => {
    const first = render(<DriversSection data={producerBasisData()} />)
    const producerText = screen.getByTestId(CAPTION).textContent
    first.unmount()

    render(<DriversSection data={fallbackBasisData()} />)
    const fallbackText = screen.getByTestId(CAPTION).textContent

    expect(producerText).toBeTruthy()
    expect(fallbackText).toBeTruthy()
    expect(producerText).not.toBe(fallbackText)
  })

  /**
   * The fallback disclosure must say WHY, not just WHAT. Without the reason it
   * reads as a choice the product made about these factors; it is not, it is
   * the producer failing to score every factor, which is a fact about the run.
   */
  it('the fallback disclosure states the producer condition that caused it', () => {
    render(<DriversSection data={fallbackBasisData()} />)
    const text = (screen.getByTestId(CAPTION).textContent ?? '').toLowerCase()
    expect(text).toContain('every factor')
  })

  describe('fail-closed: no quantity is named when the basis is unusable', () => {
    it.each([
      ['degenerate producer basis', degenerateProducerData],
      ['degenerate fallback basis', degenerateFallbackData],
      ['no provenance stamp', unstampedData],
    ])('renders no quantity caption on a %s', (_label, build) => {
      render(<DriversSection data={build()} />)
      expect(screen.queryByTestId(CAPTION)).not.toBeInTheDocument()
    })
  })

  /**
   * ⚠ ADDITIVE, NEVER A REPLACEMENT. The scale caption answers "does the top
   * row read 100% by construction?" and this one answers "which quantity was
   * scaled?". A run owes the reader both, and a later tidy-up that folded one
   * into the other would silently drop an answer.
   */
  it('does not displace the scale caption on either stamped basis', () => {
    for (const build of [producerBasisData, fallbackBasisData]) {
      const view = render(<DriversSection data={build()} />)
      expect(screen.getByTestId(SCALE_CAPTION)).toBeInTheDocument()
      expect(screen.getByTestId(CAPTION)).toBeInTheDocument()
      view.unmount()
    }
  })
})
