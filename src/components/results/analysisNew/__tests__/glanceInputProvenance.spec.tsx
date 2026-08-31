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
import { normalizeFactorSensitivity } from '../../useResultsSectionData'
import { isDefaultedConfidenceFromRaw } from '../../driverConfidenceDisplayPolicy'
import { genuineDecision, makeData, makeDriver } from './analysisNewFixtures'
import stagingCapture from '../../../../v5/__tests__/fixtures/v5-analysis-result.staging-real-shape.json'

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
  it('⭐ says undetermined when the producer asserted nothing either way', () => {
    // THE FIX. PLoT omits `value_defaulted` on rows whose value came from
    // cee_inference, i.e. values the product invented — so this is the
    // commonest real payload, and it used to be silence. Silence let the share
    // above stand as though something had established it. The producer having
    // settled nothing IS the answer to "what does this rest on".
    expect(provenanceOf(withDrivers([{}, {}]))).toBe('undetermined')
  })

  it('is null ONLY when there are no factor rows at all', () => {
    // Not a provenance state. `useResultsSectionData` downgrades driversStatus
    // 'computed' → 'unavailable' whenever the row set is empty, so zero rows
    // always means the sensitivity feed failed — a transport condition, and
    // describing it as a provenance finding would be a different lie.
    expect(provenanceOf(withDrivers([]))).toBeNull()
  })

  it('⭐ does not read a HALF denial as user authorship', () => {
    // THE DISCRIMINATING TWIN, and the whole point of the three-state read.
    // Confidence is explicitly not defaulted, but nothing ever denied that the
    // VALUE was defaulted. A boolean `isEstimate` would score this as the
    // user's figure. It is not; it is unknown — and `undetermined` is the word
    // for unknown, never a user-authorship claim.
    expect(provenanceOf(withDrivers([{ isDefaultedConfidence: false }]))).toBe('undetermined')
    expect(provenanceOf(withDrivers([{ valueDefaulted: false }]))).toBe('undetermined')
  })

  it('⭐ never says undetermined once the producer has settled a single row', () => {
    // The other half of the discriminating pair. `undetermined` must be
    // unreachable the moment any positive evidence exists, or it becomes a
    // catch-all that quietly outranks a real finding.
    expect(provenanceOf(withDrivers([{ valueDefaulted: true }, {}]))).not.toBe('undetermined')
    expect(provenanceOf(withDrivers([{ isDefaultedConfidence: true }]))).not.toBe('undetermined')
    expect(
      provenanceOf(withDrivers([{ isDefaultedConfidence: false, valueDefaulted: false }, {}])),
    ).not.toBe('undetermined')
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

  it('reads the standing decision fixture as undetermined, its producer having settled nothing', () => {
    expect(provenanceOf(genuineDecision())).toBe('undetermined')
  })
})

// ── THE WIRE ────────────────────────────────────────────────────────────────

/**
 * ⭐⭐ BOUND TO REAL PRODUCER BYTES, NOT TO A FIXTURE THIS LANE WROTE.
 *
 * CLAUDE.md trap 16-inverse: a fixture you wrote yourself encodes your model of
 * the producer rather than the producer. Every case above is hand-made, so on
 * its own the suite could certify a branch the wire can never reach — or miss
 * that the commonest wire shape lands in it. This case takes an actual captured
 * staging payload and pushes its factor rows through the SAME two producer
 * derivations the live hook uses, so the claim "this is what real runs do" is
 * measured rather than assumed.
 */
describe('the branch a real captured payload lands in', () => {
  // A captured staging analysis result. Its three factor rows carry
  // `factor_id`, `factor_label`, `sensitivity_score`, `elasticity`,
  // `direction` and `importance_rank` — and no provenance signal whatsoever:
  // no `confidence_source`, no `confidence_components`, no `value_defaulted`.
  const captureRows = (
    stagingCapture as {
      blocks: Array<{ enrichment?: { factor_sensitivity?: unknown[] } }>
    }
  ).blocks[0].enrichment!.factor_sensitivity!

  /** The live hook's own two derivations, imported rather than re-implemented. */
  const asDriverItems = (raws: unknown[]) =>
    raws.map((raw, i) => {
      const n = normalizeFactorSensitivity(raw, new Map<string, string>())
      return makeDriver({
        factorKey: n.factorId || `f_${i}`,
        factorLabel: n.label,
        isDefaultedConfidence: isDefaultedConfidenceFromRaw({
          confidenceSource: n.confidenceSource,
          samplingStability: n.samplingStability,
        }),
        valueDefaulted: n.valueDefaulted,
      })
    })

  it('POSITIVE CONTROL — the capture really does carry factor rows', () => {
    // Without this the case below could pass on an empty array, which is the
    // vacuity that makes an absence assertion worthless (trap 13).
    expect(Array.isArray(captureRows)).toBe(true)
    expect(captureRows.length).toBe(3)
  })

  it('CONTRAST CONTROL — the derivation can see a provenance flag when one is sent', () => {
    // Proves the pipeline below is not simply blind. Same code path, one row
    // carrying the producer's own field values, and it resolves the other way.
    expect(
      provenanceOf(
        makeData({
          drivers: {
            drivers: asDriverItems([
              {
                factor_id: 'fac_probe',
                factor_label: 'Probe',
                confidence_source: 'plot_unified_from_isl_bootstrap',
                confidence_components: { sampling_stability: 0 },
              },
            ]),
          },
        }),
      ),
    ).toBe('estimated')
  })

  it('⭐ resolves to undetermined — so the fix is what real runs hit', () => {
    expect(
      provenanceOf(makeData({ drivers: { drivers: asDriverItems(captureRows) } })),
    ).toBe('undetermined')
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
    expect(GLANCE_PROVENANCE_COPY.undetermined).toBe(
      'On inputs whose source Olumi could not establish',
    )
  })

  it('contains no digit in any kind — the producer supplies a flag, not a proportion', () => {
    for (const sentence of Object.values(GLANCE_PROVENANCE_COPY)) {
      expect(sentence).not.toMatch(/\d/)
    }
  })

  it('⭐ the undetermined sentence attributes the figures to NOBODY', () => {
    // The load-bearing property, and the reason this kind may render where the
    // other five are gated: it reports our own knowledge. The moment it names
    // the reader as author it becomes the exact claim the module exists to
    // prevent — and it would then be a claim made on NO evidence at all.
    const s = GLANCE_PROVENANCE_COPY.undetermined
    expect(s).not.toMatch(/\byou\b|\byour\b|\byours\b/i)
    expect(s).not.toMatch(/\bsupplied\b|\bestimated\b/i)
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

  it('⭐ renders the undetermined sentence beside the share it conditions', () => {
    // THE SHIPPED BEHAVIOUR. A reader who sees "Ahead in 68% of simulated
    // futures" now also sees, without interaction, that its basis was never
    // established. This is the case that used to render nothing.
    render(<AtAGlance glance={glanceModel('undetermined')} />)
    const line = screen.getByTestId(PROVENANCE_TESTID)
    expect(line).toHaveAttribute('data-input-provenance', 'undetermined')
    expect(line).toHaveTextContent('On inputs whose source Olumi could not establish')
    expect(screen.getByTestId('analysis-new-glance-win-share')).toBeVisible()
    expect(line).toBeVisible()
  })

  it('⭐ renders NOTHING when there is no provenance model at all', () => {
    // The other direction, and the one that matters. No fallback, no hedge, no
    // element at all — with no factor rows there is nothing to describe, and a
    // sentence about a set the producer never returned would be invented.
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
