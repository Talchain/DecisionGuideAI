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
 * Fix under test (copy/caption only — numbers and ranking policy untouched):
 * - provenance 'normalised_elasticity' → header tooltip + explainer carry the
 *   relative-scale wording, and a visible caption disclosing "top driver
 *   always shows 100%" renders near the panel;
 * - provenance 'influence_score' → honest absolute-basis wording (types.ts:
 *   influence_score is "structural causal influence"), NO relative caption;
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

const RELATIVE_TOOLTIP =
  'Influence: how much this factor affects the outcome, relative to the strongest — the top driver always shows 100%.'
const ABSOLUTE_TOOLTIP =
  'Influence: how much this factor affects the outcome — an absolute causal influence score from the analysis.'
const GENERIC_TOOLTIP = 'Influence: how much this factor affects the outcome'
const RELATIVE_EXPLAINER =
  'Ranked by how much each factor affects the outcome, relative to the strongest factor'
const GENERIC_EXPLAINER = 'Ranked by how much each factor affects the outcome'
const CAPTION_COPY =
  'Influence is relative to the strongest factor — the top driver always shows 100%.'

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

/** Full producer coverage: every factor carries a raw influence_score. */
function producerBasisData(): DriversSectionData {
  return makeDriversData([
    makeDriver({
      factorKey: 'fac_a',
      factorLabel: 'Technical Leadership Capability',
      rawElasticity: 0.9,
      normalisedInfluence: 1,
      influenceScore: 0.62,
      displayInfluence: 0.62,
      displayProvenance: 'influence_score',
    }),
    makeDriver({
      factorKey: 'fac_b',
      factorLabel: 'Market Timing',
      rawElasticity: 0.45,
      normalisedInfluence: 0.5,
      influenceScore: 0.31,
      displayInfluence: 0.31,
      displayProvenance: 'influence_score',
      rank: 2,
      semanticLabel: 'moderate',
    }),
  ])
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
  // hover that wrapper (same pattern as BaselineTargetRow.spec).
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

  describe('producer basis (influence_score) — absolute scale', () => {
    it('does NOT render the relative-scale caption', () => {
      render(<DriversSection data={producerBasisData()} goalLabel="test" />)
      expect(screen.queryByTestId('influence-scale-caption')).toBeNull()
    })

    it('explainer keeps the generic wording (no relative clause)', () => {
      render(<DriversSection data={producerBasisData()} goalLabel="test" />)
      expect(screen.getByText(GENERIC_EXPLAINER)).toBeDefined()
      expect(screen.queryByText(RELATIVE_EXPLAINER)).toBeNull()
    })

    it('Influence header tooltip uses the absolute-basis wording, not the relative claim', () => {
      render(<DriversSection data={producerBasisData()} goalLabel="test" />)
      hoverInfluenceHeader()
      const tooltip = screen.getByRole('tooltip')
      expect(tooltip.textContent).toContain(ABSOLUTE_TOOLTIP)
      expect(tooltip.textContent).not.toContain('always shows 100%')
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
