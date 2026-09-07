/**
 * May this surface say "<Factor> dominates the model"?
 *
 * ⭐ THE QUESTION THIS ANSWERS, STATED ONCE, BECAUSE THE ESTATE'S SIGNATURE
 * DEFECT IS TWO QUESTIONS WEARING ONE NAME (CLAUDE.md trap 21):
 * *"is the producer's dominance verdict supported by the influence
 * distribution this surface is simultaneously rendering?"* It is NOT
 * "should we show a nudge card" (see the NAMED RIVAL below), and it does not
 * re-derive dominance — the producer's verdict still decides WHICH factor is
 * named. This only refuses to repeat a claim the bars contradict.
 *
 * ── WHY A CONSUMER-SIDE GATE EXISTS AT ALL ─────────────────────────────────
 * The declared producer contract is the doc comment on `dominant_factor` in
 * `adapters/plot/v2/types.ts`: "PLoT-classified dominant factor (B1 field).
 * Absent when no factor dominates." Its implementation
 * (`plot-lite-service/src/trust/factor-dominance.ts:72-101`, staging
 * `d37c8cfd`) decides on `influence_score` ALONE:
 *
 *   1. the candidate is `factor_sensitivity[0]` — rank 1 of the canonical
 *      driver order, and nothing else;
 *   2. its `influence_score` must be a finite number `> 0.5`;
 *   3. it must be more than `2×` the strongest influence among the OTHER rows
 *      — where "other rows" is filtered to
 *      `typeof s === 'number' && Number.isFinite(s) && s > 0`, and an empty
 *      rival set means "dominant by definition".
 *
 * Two things that predicate structurally cannot see, both reachable:
 *
 *   · **Rival blindness.** A row carrying NO `influence_score` is dropped from
 *     the rival scan, so it can never suppress the verdict. PLoT appends
 *     exactly such rows: ISL-only factors are merged with no graph
 *     `influence_score` to preserve (`lib/factor-influence.ts:1068,1118`).
 *   · **The basis fork.** `selectDriverDisplayModel` drops the WHOLE displayed
 *     set onto normalised |elasticity| the moment ANY row lacks a finite
 *     `influence_score` — deliberately, so the surface never mixes bases. At
 *     that point the number the producer judged dominance on and the number
 *     the user reads off the bars are DIFFERENT QUANTITIES, and no amount of
 *     producer-side care can reconcile them.
 *
 * ⚠ NAMED RIVAL, NOT FOLDED, DELIBERATELY. `TriageActionCardsBody.tsx:480-491`
 * gates its dominance NUDGE on the same tie boundary plus an absolute
 * `>= 0.8` floor. That floor answers a PRODUCT-STRENGTH question ("is this
 * card worth a slot?"), not a TRUTH question, so it is not copied here —
 * copying it would delete the insight on a run where one factor genuinely and
 * clearly leads at 0.6 against 0.3, which the brief for this guard explicitly
 * forbids. The two gates are named apart rather than aligned (trap 21). That
 * file is another lane's (#1246) and is untouched by this change.
 *
 * ⚠ NOTHING HERE RE-SPELLS A TIE. `hasClearInfluenceLeader` is the estate's
 * single owner of "is the top unique?" and is asked, not reimplemented — its
 * own header records that counting VALUES instead of identities once both
 * suppressed a real 2.5× leader and asserted a tie of a factor with itself.
 */

import {
  hasClearInfluenceLeader,
  resolveDriverClaimBasis,
} from '../driverDisplayModel'
import type { DriverItem, DriversSectionData } from '../types'

/**
 * The rows the surface is actually rendering, preferring the COMPLETE list.
 *
 * ⚠ Deliberately the opposite preference to the sibling nudge, which reads
 * `topDrivers` first. A nudge needs the top two; a SUPPRESSION gate must not
 * be able to miss a rival, so it looks at every row it can see and falls back
 * to the preview only when the full list is empty.
 */
function renderedRows(
  drivers: Pick<DriversSectionData, 'drivers' | 'topDrivers'> | undefined,
): DriverItem[] {
  if (!drivers) return []
  if (drivers.drivers?.length) return drivers.drivers
  return drivers.topDrivers ?? []
}

/**
 * Is the producer's named dominant factor the clear leader of the influence
 * distribution this surface displays?
 *
 * Every arm fails CLOSED. In order:
 *  - no named factor, or no rendered rows → nothing to support the claim;
 *  - any row that does not resolve on the ABSOLUTE `influence_score` basis →
 *    the set is set-relative ("largest in this set"), which cannot license
 *    "carries most of the influence";
 *  - no clear leader by `INFLUENCE_TIE_EPSILON` → a tie, and a comparative
 *    claim cannot rest on one;
 *  - a clear leader that is NOT the named factor → the headline would be
 *    about the wrong row (bind by IDENTITY, never by a value predicate
 *    another object could satisfy — trap 19).
 *
 * A SOLE factor passes: it has no rival to be tied with, and the producer has
 * an explicit branch saying the same thing. Agreeing with the producer's
 * declared semantics is the point; inventing a third rule is not.
 */
export function dominanceClaimSupported(
  drivers: Pick<DriversSectionData, 'drivers' | 'topDrivers'> | undefined,
  dominantFactorId: string | undefined,
): boolean {
  if (!dominantFactorId) return false

  const rows = renderedRows(drivers)
  if (rows.length === 0) return false

  const entries: Array<{ id: string; value: number }> = []
  for (const row of rows) {
    const metric = resolveDriverClaimBasis(row)
    if (!metric || metric.basis !== 'influence_score') return false
    entries.push({ id: row.factorKey, value: metric.value })
  }

  if (!hasClearInfluenceLeader(entries)) return false

  // The producer names a FACTOR id; the panel keys rows by `factorKey` and
  // records the canvas node it resolved to separately, and the two are not
  // always the same string.
  const named = rows.find(
    (r) => r.factorKey === dominantFactorId || r.matchedNodeId === dominantFactorId,
  )
  if (!named) return false

  const namedEntry = entries.find((e) => e.id === named.factorKey)
  if (!namedEntry) return false

  // `hasClearInfluenceLeader` has already established that a unique leader
  // exists; this asserts the leader IS the named factor rather than re-asking
  // the tie question with a second copy of the epsilon.
  return entries.every((e) => e.id === namedEntry.id || namedEntry.value > e.value)
}
