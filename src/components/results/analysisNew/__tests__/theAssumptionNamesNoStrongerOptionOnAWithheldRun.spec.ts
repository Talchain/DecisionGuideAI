/**
 * ⛔ "ONE ASSUMPTION WORTH PINNING DOWN" NAMES NO STRONGER OPTION ON A RUN WHOSE
 * RANKING WAS WITHHELD.
 *
 * ── THE DEFECT ─────────────────────────────────────────────────────────────
 * The assumed-strength finding in "Uncertainty and gaps" carried
 * `assumedStrengthWhy` as its detail: *"In the runs where that link came out
 * weak, {alt} was the stronger option NN% of the time. Of the unconfirmed
 * relationship strengths you can resolve here, this had the highest such
 * rate."* ISL declares the number as "Proportion of MC samples where
 * ALTERNATIVE wins when edge is weak" — an alternative TO the option that leads
 * now. On a run whose leader claim is withheld (`leader_claim.permitted=false`,
 * e.g. `constraint_verdict_withheld`) that sentence presupposes the very ranking
 * the run refused to state, and names an option as "the stronger" one on top.
 *
 * Merged #1933 (hinge insight) and #1940 (driver row), and #1941 ("What would
 * change your mind", open at the time of writing), withhold the equivalent
 * leader-presupposing lines on this run class. This finding reads the same
 * producer quantity and was not gated.
 *
 * ── WHAT MAY REMAIN ────────────────────────────────────────────────────────
 * The lead ("Olumi estimated how strongly X affects Y, but your team has not
 * confirmed it") is a fact about the MODEL — the edge's provenance — and names
 * no option; so does the ask, and so does the "N other sensitive relationships"
 * clause (#1940 ruled "sensitive to this relationship" names no leader). On a
 * machine-authored withheld run the ask is the very act that can lift the
 * withholding, so dropping the whole finding would hide the remedy to hide one
 * sentence. Only the measured rate goes, and its "highest such rate" rider with
 * it, because that rider's antecedent IS the rate.
 *
 * ── HOW THE PAIR DISCRIMINATES ─────────────────────────────────────────────
 * The twins differ ONLY in the licence: `decisionWithLeaderWithheld` spreads
 * `genuineDecision` and moves both licence fields together. Both carry the same
 * selection. The permitted twin is the positive control — it must still print
 * the copy module's own sentence byte for byte — so the withheld absence cannot
 * pass because the row never built or because the copy changed wording.
 * Every assertion binds to the finding by its EDGE identity, never by position.
 */
import { describe, expect, it } from 'vitest'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { rankingWasWithheld } from '../../leaderDesignation'
import {
  assumedStrengthAsk,
  assumedStrengthLead,
  assumedStrengthWhy,
} from '../../strengthElicitation/assumedStrengthCopy'
import type { AssumedStrengthSelection } from '../../strengthElicitation/selectAssumedStrengthToResolve'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import {
  decisionWithLeaderWithheld,
  decisionWithLeaderWithheldAndReason,
  genuineDecision,
  openStrategicChallenge,
} from './analysisNewFixtures'

const build = (data: ResultsSectionDataReturn) =>
  buildAnalysisNewViewModel({
    data,
    recommendations: [],
    isPreRun: false,
    isRunning: false,
    isStale: false,
  })

// The alternative is the fixture's OTHER arm, so a named-option leak on the
// withheld twin would name an option that really is on this run's canvas.
const NAMED: AssumedStrengthSelection = {
  edgeId: 'edge_elasticity_to_margin',
  fromLabel: 'Price elasticity',
  toLabel: 'Sustained margin',
  switchProbability: 0.41,
  alternativeWinnerLabel: 'Hold price',
  strengthProvenance: 'ai_inferred',
  strengthEditReachable: true,
}
// The copy module's OTHER branch — "a different option was the stronger one".
// It names no option but still presupposes one that is stronger now.
const UNNAMED: AssumedStrengthSelection = { ...NAMED, alternativeWinnerLabel: null }

const withSelection = (
  data: ResultsSectionDataReturn,
  selected: AssumedStrengthSelection,
  assumedFragileCount = 3,
): ResultsSectionDataReturn => ({
  ...data,
  assumedStrength: { selected, refusalReason: null, assumedFragileCount },
})

const findingFor = (vm: ReturnType<typeof build>, s: AssumedStrengthSelection) =>
  vm.uncertainty.findings.find((f) => f.id === `uncertainty:assumed-strength:${s.edgeId}`)

/** Every sentence the finding puts on screen, joined. */
const spoken = (f: { headline: string; implication?: string; detail?: string }) =>
  [f.headline, f.implication ?? '', f.detail ?? ''].join(' ')

// The presupposition, in both of the copy module's spellings.
const STRONGER = /\bthe stronger (option|one)\b/i

describe('⛔ the assumed-strength finding on a run whose ranking was withheld', () => {
  it('PRECONDITION: the twins answer the licence question the way the gate reads it', () => {
    // The SAME predicate #1933/#1940 gate on. If either fixture drifts, every
    // arm below is testing something other than the licence.
    expect(rankingWasWithheld(decisionWithLeaderWithheld().recommendation)).toBe(true)
    expect(rankingWasWithheld(decisionWithLeaderWithheldAndReason().recommendation)).toBe(true)
    expect(rankingWasWithheld(genuineDecision().recommendation)).toBe(false)
  })

  for (const [name, selection] of [
    ['named alternative', NAMED],
    ['unnamed alternative', UNNAMED],
  ] as const) {
    describe(`${name}`, () => {
      it('✅ PERMITTED twin (positive control): still states the measured rate, byte for byte', () => {
        const vm = build(withSelection(genuineDecision(), selection))
        expect(vm.leaderClaimPermitted, 'PRECONDITION: the permitted twin is licensed').toBe(true)
        const f = findingFor(vm, selection)
        expect(f, 'the finding did not build — nothing below is tested').toBeDefined()
        // Bound to the copy module's own sentence, not a paraphrase of it.
        expect(f!.detail).toContain(assumedStrengthWhy(selection))
        expect(spoken(f!)).toMatch(STRONGER)
        expect(f!.detail).toContain('41%')
      })

      for (const [variant, fixture] of [
        ['withheld, no reason', decisionWithLeaderWithheld],
        ['withheld, with the captured refusal', decisionWithLeaderWithheldAndReason],
      ] as const) {
        it(`⛔ WITHHELD twin (${variant}): no stronger option, no rate, no "highest such rate"`, () => {
          const vm = build(withSelection(fixture(), selection))
          expect(vm.leaderClaimPermitted, 'PRECONDITION: the ranking was withheld').toBe(false)
          const f = findingFor(vm, selection)
          // The finding SURVIVES — its value on this run is the naming and the
          // ask, and a withheld run is exactly where setting a strength matters.
          expect(f, 'the finding vanished — the gate removes one claim, not the row').toBeDefined()

          const text = spoken(f!)
          expect(text).not.toMatch(STRONGER)
          expect(text).not.toContain(assumedStrengthWhy(selection))
          expect(text).not.toContain('41%')
          expect(text).not.toMatch(/highest such rate/i)
          expect(text).not.toMatch(/came out weak/i)
          if (selection.alternativeWinnerLabel !== null) {
            expect(text).not.toContain(selection.alternativeWinnerLabel)
          }

          // What remains is the copy module's own, unamended — the lead, the
          // "others" clause and the ask — so nothing here is authored.
          expect(f!.implication).toBe(assumedStrengthLead(selection))
          expect(f!.detail).toContain('2 other sensitive relationships')
          expect(f!.detail).toContain(assumedStrengthAsk(selection)!)
          // Focus and review targets are about the EDGE, not the ranking.
          expect(f!.targetId).toBe(selection.edgeId)
          expect(f!.reviewTargetId).toBe(selection.edgeId)
        })
      }
    })
  }

  it('⛔ WITHHELD: no sentence anywhere in the view model names a stronger option', () => {
    // Wider than the finding: a later channel re-emitting the rate must not
    // slip past a test that only reads one row.
    const vm = build(withSelection(decisionWithLeaderWithheldAndReason(), NAMED))
    expect(JSON.stringify(vm)).not.toMatch(STRONGER)
  })

  it('⛔ WITHHELD with nothing else to say: detail is absent, not an empty string', () => {
    // One fragile edge (no "others") and no reachable editor (no ask) leave
    // only the lead. An empty `detail` would render an empty paragraph.
    const vm = build(
      withSelection(decisionWithLeaderWithheld(), { ...NAMED, strengthEditReachable: false }, 1),
    )
    const f = findingFor(vm, NAMED)
    expect(f).toBeDefined()
    expect(f!.implication).toBe(assumedStrengthLead(NAMED))
    expect(f!.detail).toBeUndefined()
  })

  it('✅ OPEN CHALLENGE (no ranking ever existed): the rate is NOT withheld', () => {
    // `rankingWasWithheld`, not the wider `leaderDesignationPermitted`, for
    // #1933's reason: a run with no arms never had a ranking to withhold, so
    // a permission-only gate would delete a licensed sentence here.
    const data = openStrategicChallenge()
    expect(rankingWasWithheld(data.recommendation), 'PRECONDITION').toBe(false)
    const f = findingFor(build(withSelection(data, NAMED)), NAMED)
    expect(f).toBeDefined()
    expect(f!.detail).toContain(assumedStrengthWhy(NAMED))
  })
})
