/**
 * The glance's CONDITION LINE — what the reading rests on.
 *
 * The claim under test is an honesty claim, so the load-bearing cases are the
 * ones where the line must NOT appear. A version of this feature that defaulted
 * silence to "you supplied these figures" would pass every positive test here
 * and would be the exact lie the producer's three-state flag exists to prevent;
 * the negatives below are what separate the two.
 *
 * ⚠ EVERY ASSERTION BINDS BY IDENTITY — the `analysis-new-glance-input-provenance`
 * testid and the `data-input-provenance` attribute — never by searching the
 * panel for a phrase. Several other elements on this surface are prose in the
 * same style, and a text match would pass on any of them.
 */

import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { AtAGlance } from '../sections/AtAGlance'
import { GLANCE_PROVENANCE_COPY } from '../glanceProvenanceCopy'
import type { AtAGlance as AtAGlanceModel, GlanceInputProvenance } from '../analysisNewTypes'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import { genuineDecision, makeData, makeDriver } from './analysisNewFixtures'

const PROVENANCE_TESTID = 'analysis-new-glance-input-provenance'

const provenanceOf = (data: ResultsSectionDataReturn) =>
  buildAnalysisNewViewModel({
    data,
    recommendations: [],
    isPreRun: false,
    isRunning: false,
    isStale: false,
  }).atAGlance.inputProvenance

/** A run whose factor rows carry exactly the provenance flags given. */
const withDrivers = (
  rows: Array<{ isDefaultedConfidence?: boolean; valueDefaulted?: boolean }>,
): ResultsSectionDataReturn =>
  makeData({
    drivers: {
      drivers: rows.map((flags, i) =>
        makeDriver({ factorKey: `f_${i}`, factorLabel: `Factor ${i}`, ...flags }),
      ),
    },
  })

afterEach(() => cleanup())

// ── THE DERIVATION ──────────────────────────────────────────────────────────

describe('input provenance — the producer settles it, or nothing is claimed', () => {
  it('is null when the producer asserted nothing either way — the majority live case', () => {
    // PLoT omits `value_defaulted` on rows whose value came from cee_inference,
    // i.e. values the product invented. Silence must stay silence.
    expect(provenanceOf(withDrivers([{}, {}]))).toBeNull()
  })

  it('is null when there are no factor rows at all', () => {
    expect(provenanceOf(withDrivers([]))).toBeNull()
  })

  it('⭐ does not read a HALF denial as user authorship', () => {
    // THE DISCRIMINATING TWIN, and the whole point of the three-state read.
    // Confidence is explicitly not defaulted, but nothing ever denied that the
    // VALUE was defaulted. A boolean `isEstimate` would score this as the
    // user's figure. It is not; it is unknown.
    expect(provenanceOf(withDrivers([{ isDefaultedConfidence: false }]))).toBeNull()
    expect(provenanceOf(withDrivers([{ valueDefaulted: false }]))).toBeNull()
  })

  it('reads a producer TRUE on EITHER field as estimated', () => {
    expect(provenanceOf(withDrivers([{ isDefaultedConfidence: true, valueDefaulted: false }])))
      .toBe('estimated')
    expect(provenanceOf(withDrivers([{ isDefaultedConfidence: false, valueDefaulted: true }])))
      .toBe('estimated')
  })

  it('says user_supplied ONLY when every row is denied BOTH ways', () => {
    expect(
      provenanceOf(
        withDrivers([
          { isDefaultedConfidence: false, valueDefaulted: false },
          { isDefaultedConfidence: false, valueDefaulted: false },
        ]),
      ),
    ).toBe('user_supplied')
  })

  it('says estimated only when every row is settled and all of them are Olumi’s', () => {
    expect(
      provenanceOf(
        withDrivers([
          { isDefaultedConfidence: true, valueDefaulted: true },
          { valueDefaulted: true },
        ]),
      ),
    ).toBe('estimated')
  })

  it('demotes a universal claim to "partly" when the producer stayed silent on any row', () => {
    // One row is positively Olumi's; the other was never settled. "On inputs
    // Olumi estimated" would overclaim across the silent row.
    expect(provenanceOf(withDrivers([{ valueDefaulted: true }, {}]))).toBe('partly_estimated')
    expect(
      provenanceOf(withDrivers([{ isDefaultedConfidence: false, valueDefaulted: false }, {}])),
    ).toBe('partly_user_supplied')
  })

  it('says mixed when one of each is positively witnessed, silence notwithstanding', () => {
    // Both existentials are witnessed, so an unsettled third row cannot
    // falsify the sentence — it stays `mixed`, not `partly_` anything.
    expect(
      provenanceOf(
        withDrivers([
          { valueDefaulted: true },
          { isDefaultedConfidence: false, valueDefaulted: false },
        ]),
      ),
    ).toBe('mixed')
    expect(
      provenanceOf(
        withDrivers([
          { valueDefaulted: true },
          { isDefaultedConfidence: false, valueDefaulted: false },
          {},
        ]),
      ),
    ).toBe('mixed')
  })

  it('counts a zero-influence factor as an input like any other', () => {
    // Provenance is a fact about where a number came from. Making it depend on
    // influence would let an unrelated quantity decide an honesty claim.
    expect(
      provenanceOf(withDrivers([{ valueDefaulted: true }])),
    ).toBe('estimated')
    expect(
      provenanceOf(
        makeData({
          drivers: {
            drivers: [
              makeDriver({
                factorKey: 'f_zero',
                factorLabel: 'Zero factor',
                zeroReason: 'zero_outcome_diff',
                valueDefaulted: true,
              }),
            ],
          },
        }),
      ),
    ).toBe('estimated')
  })

  it('is null on the standing decision fixture, whose producer settled nothing', () => {
    // Pins that this feature is silent by default on existing fixtures rather
    // than quietly appearing across the suite.
    expect(provenanceOf(genuineDecision())).toBeNull()
  })
})

// ── THE COPY ────────────────────────────────────────────────────────────────

describe('the sanctioned sentences', () => {
  // A HAND-WRITTEN corpus, not an iteration of the map: iterating the map would
  // only prove the map agrees with itself and could never notice a missing or
  // reworded kind (CLAUDE.md trap 12d).
  it('states each kind exactly, and states no number', () => {
    expect(GLANCE_PROVENANCE_COPY.estimated).toBe('On inputs Olumi estimated')
    expect(GLANCE_PROVENANCE_COPY.partly_estimated).toBe('Partly on inputs Olumi estimated')
    expect(GLANCE_PROVENANCE_COPY.mixed).toBe("On a mix of your figures and Olumi's estimates")
    expect(GLANCE_PROVENANCE_COPY.user_supplied).toBe('On figures you supplied')
    expect(GLANCE_PROVENANCE_COPY.partly_user_supplied).toBe('Partly on figures you supplied')
  })

  it('contains no digit in any kind — the producer supplies a flag, not a proportion', () => {
    for (const sentence of Object.values(GLANCE_PROVENANCE_COPY)) {
      expect(sentence).not.toMatch(/\d/)
    }
  })
})

// ── THE RENDER ──────────────────────────────────────────────────────────────

const glanceModel = (
  inputProvenance: GlanceInputProvenance | null,
  overrides: Partial<AtAGlanceModel> = {},
): AtAGlanceModel => ({
  headline: 'Raise price currently scores higher',
  leaderLabel: 'Raise price',
  winShare: 'Ahead in 68% of simulated futures',
  winPercentLabel: '68%',
  winFraction: 0.68,
  comparisonScope: { kind: 'whole_set' },
  comparativeClaim: 'value',
  verdict: { tone: 'stable', label: 'Stable' },
  drivers: [{ id: 'a', label: 'Price elasticity', fraction: 1, targetId: null }],
  influenceIsSetRelative: false,
  condition: null,
  inputProvenance,
  primaryInterventionId: null,
  ...overrides,
})

describe('the condition line on screen', () => {
  it('renders the sentence, tagged with the kind it came from', () => {
    render(<AtAGlance glance={glanceModel('estimated')} />)
    const line = screen.getByTestId(PROVENANCE_TESTID)
    expect(line).toHaveAttribute('data-input-provenance', 'estimated')
    expect(line).toHaveTextContent('On inputs Olumi estimated')
  })

  it('renders the mixed sentence under its own kind', () => {
    // The discriminating pair: a render bound to the model rather than to one
    // hardcoded string would fail here.
    render(<AtAGlance glance={glanceModel('mixed')} />)
    const line = screen.getByTestId(PROVENANCE_TESTID)
    expect(line).toHaveAttribute('data-input-provenance', 'mixed')
    expect(line).toHaveTextContent("On a mix of your figures and Olumi's estimates")
  })

  it('⭐ renders NOTHING when the provenance is unknown', () => {
    // The other direction, and the one that matters. No fallback, no hedge, no
    // element at all — an unknown antecedent is not a quieter claim.
    render(<AtAGlance glance={glanceModel(null)} />)
    expect(screen.queryByTestId(PROVENANCE_TESTID)).toBeNull()
  })

  it('does not render an orphan caveat when there is no reading to condition', () => {
    render(
      <AtAGlance
        glance={glanceModel('estimated', {
          headline: null,
          leaderLabel: null,
          winShare: null,
          winPercentLabel: null,
          winFraction: null,
          comparativeClaim: 'none',
          verdict: null,
          drivers: [],
        })}
        primaryIntervention={{ id: 'r1', label: 'Define success', why: 'because' }}
        onRunIntervention={() => {}}
      />,
    )
    expect(screen.queryByTestId(PROVENANCE_TESTID)).toBeNull()
  })

  it('states no number in the rendered line', () => {
    render(<AtAGlance glance={glanceModel('partly_estimated')} />)
    expect(screen.getByTestId(PROVENANCE_TESTID).textContent ?? '').not.toMatch(/\d/)
  })

  it('sits beside the share it conditions, not behind a disclosure', () => {
    // Both in the same panel, both visible without interaction. A reader who
    // sees the percentage must see what it rests on.
    render(<AtAGlance glance={glanceModel('estimated')} />)
    expect(screen.getByTestId('analysis-new-glance-win-share')).toBeVisible()
    expect(screen.getByTestId(PROVENANCE_TESTID)).toBeVisible()
  })
})
