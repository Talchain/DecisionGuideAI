/**
 * ⭐⭐⭐ THE RANK THE READER SEES IS THE PRODUCER'S, NEVER THE ROW'S POSITION.
 *
 * ── WITNESSED ON THE DEPLOYED BUILD (staging `1f77130d`, 22 Sep 2026) ────────
 * Saved example "Pricing Model Transition Strategy". The drivers section
 * discloses, in its own words:
 *
 *     "3 factors are not ranked here: controlled by your options."
 *
 * and the two factors it DOES show print, in their Inspect rows:
 *
 *     Top Account Revenue Concentration   Influence 60%   Rank 3
 *     Competitive Pressure for Usage…     Influence  1%   Rank 5
 *
 * **Rank 3 and Rank 5 — not 1 and 2.** Three of the five factors were withheld
 * from display, and the surface kept each survivor's rank within the producer's
 * whole set rather than renumbering the visible two. That is the behaviour this
 * file exists to keep.
 *
 * ── WHY IT IS WORTH A GUARD, AND WHY THE GUARD BELONGS HERE ─────────────────
 * Renumbering would MINT A RANK-1 FACTOR out of a set the producer never
 * ranked first — a semantic claim the analysis contract does not support, and
 * the exact class `analysisNewCopy`'s `noneRankedUnexplained` and the drivers
 * caveat are written to avoid. It is also the cheapest possible regression: a
 * `.map((d, i) => …)` that reaches for `i` looks tidier than threading a field.
 *
 * ⚠ THE POPULATION IS ALREADY RIGHT ONE LAYER DOWN, and this guard does not
 * duplicate that. `computeFactorRanks` is handed `factorsWithKeys`, which is
 * the WHOLE normalised producer set (`useResultsSectionData`), so `rank` is
 * global by construction — but that function is pure over whatever array it is
 * given, so the invariant lives at the call site and nothing pinned it on THIS
 * surface. `useResultsSectionData.spec.ts` covers the function's ordering; this
 * covers the panel's promise to the reader.
 *
 * ⚠ THE FALLBACK ARM IS THE ONE AT RISK, so it is the one exercised. The view
 * model prints `d.influenceRank != null ? d.influenceRank : d.rank`. On the
 * witnessed run `influenceRank` was present, so the arm that would fabricate a
 * "Rank 1" is the one nothing drove. Both arms are covered below.
 */
import { describe, expect, it } from 'vitest'

import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { makeData, makeDriver } from './analysisNewFixtures'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'

const vmOf = (data: ResultsSectionDataReturn) =>
  buildAnalysisNewViewModel({
    data,
    recommendations: [],
    isPreRun: false,
    isRunning: false,
    isStale: false,
  })

/** The witnessed shape: five factors, three withheld, survivors at 3 and 5. */
const threeWithheldOfFive = (opts: { withInfluenceRank: boolean }) =>
  makeData({
    drivers: {
      driversStatus: 'computed',
      drivers: [
        // The three the run set aside — "controlled by your options".
        makeDriver({ factorKey: 'f_pin_1', factorLabel: 'Pinned A', rank: 1,
                     displayInfluence: 1, zeroReason: 'intervention_override' }),
        makeDriver({ factorKey: 'f_pin_2', factorLabel: 'Pinned B', rank: 2,
                     displayInfluence: 0.8, zeroReason: 'intervention_override' }),
        makeDriver({ factorKey: 'f_pin_4', factorLabel: 'Pinned C', rank: 4,
                     displayInfluence: 0.3, zeroReason: 'intervention_override' }),
        // The two that survive to be shown.
        // ⚠ THE TWO RANKS DIVERGE ON PURPOSE, and an earlier cut of this file
        // set them equal — which made the preference arm VACUOUS and let a
        // mutant that deleted `influenceRank` entirely survive the battery.
        // They are different quantities (the producer's own field vs this
        // client's elasticity-derived ordering) and the product can reach a
        // state where they disagree, which is the whole reason the view model
        // prefers one.
        makeDriver({ factorKey: 'f_top', factorLabel: 'Top Account Revenue Concentration',
                     rank: 3, displayInfluence: 0.6,
                     ...(opts.withInfluenceRank ? { influenceRank: 2 } : {}) }),
        makeDriver({ factorKey: 'f_comp', factorLabel: 'Competitive Pressure for Usage Pricing',
                     rank: 5, displayInfluence: 0.01,
                     ...(opts.withInfluenceRank ? { influenceRank: 4 } : {}) }),
      ],
    },
  })

const ranksShown = (data: ResultsSectionDataReturn): string[] =>
  vmOf(data).drivers.findings.flatMap((f) =>
    (f.inspect ?? [])
      .filter((r) => r.label === 'Rank')
      .map((r) => r.value),
  )

describe('the Rank a driver shows is the producer\'s, not its position in the visible list', () => {
  /**
   * ⚠ PRECONDITION, PINNED IN-TEST (trap 13b). Every assertion below is
   * vacuous unless the fixture really does withhold three of five and leave
   * exactly two survivors — a fixture that stopped suppressing would make
   * "not 1 and 2" pass because 1 and 2 are the correct global ranks.
   */
  it('PRECONDITION — three of five are withheld and exactly two survive', () => {
    const vm = vmOf(threeWithheldOfFive({ withInfluenceRank: false }))
    expect(vm.drivers.findings).toHaveLength(2)
    expect(vm.drivers.suppressedZeroCount).toBe(3)
    expect(vm.drivers.suppressedZeroReasons).toEqual(['intervention_override'])
  })

  /**
   * ⚠ CONTRAST CONTROL, in the same run: the probe can read a Rank row at all.
   * Without this, an `inspect` shape change would turn every assertion below
   * into a comparison of two empty arrays — a zero from a broken probe and a
   * zero from a clean file are byte-identical.
   */
  it('CONTROL — a Rank row is present on every shown driver', () => {
    expect(ranksShown(threeWithheldOfFive({ withInfluenceRank: false }))).toHaveLength(2)
    expect(ranksShown(threeWithheldOfFive({ withInfluenceRank: true }))).toHaveLength(2)
  })

  /**
   * ⛔ THE ARM THAT ROTS — the fallback, which the witnessed run never drove.
   */
  it('⛔ with no producer influence_rank, the survivors keep ranks 3 and 5', () => {
    expect(ranksShown(threeWithheldOfFive({ withInfluenceRank: false }))).toEqual(['3', '5'])
  })

  it('⛔ and never renumbers the visible rows to 1 and 2', () => {
    const shown = ranksShown(threeWithheldOfFive({ withInfluenceRank: false }))
    expect(
      shown,
      'renumbering would mint a rank-1 factor the producer never ranked first',
    ).not.toContain('1')
    expect(shown).not.toContain('2')
  })

  /**
   * ⭐ AND THE PRODUCER'S OWN FIELD WINS WHERE IT EXISTS — with the two
   * ranks DIVERGENT, so the assertion can tell them apart. The fixture sends
   * `rank` 3/5 and `influenceRank` 2/4; only reading the producer's field
   * yields 2 and 4.
   */
  it('influence_rank is preferred over the derived rank', () => {
    expect(ranksShown(threeWithheldOfFive({ withInfluenceRank: true }))).toEqual(['2', '4'])
  })

  /**
   * ⚠ AND STILL NOT A RENUMBERING ON THAT ARM EITHER. `2, 4` is the
   * producer's own non-contiguous pair; `1, 2` would be positions.
   */
  it('⛔ nor does the producer arm renumber to 1 and 2', () => {
    const shown = ranksShown(threeWithheldOfFive({ withInfluenceRank: true }))
    expect(shown).not.toEqual(['1', '2'])
  })
})
