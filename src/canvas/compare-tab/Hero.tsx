import { ArrowRight } from 'lucide-react'
import { typography } from '../../styles/typography'
import { GraphLink } from '../../components/results/GraphLink'
import { highlightNode, clearHighlight } from '../utils/highlightHelpers'
import type { AnalysisSnapshot, CompareState, LeaderClaim } from './types'
import { isNarrowFlip } from './deriveCompareState'
import { deriveLeaderClaim, optionProbabilityIn } from './leaderClaim'

/**
 * The estate's standing absence token, spelled the same here as in
 * RunPairCompare and TrajectorySection's expert table. One idiom for "the
 * producer sent nothing", so a reader who has met it once on this tab already
 * knows what it means.
 */
const NOT_ASSESSED = 'Not assessed'

interface HeroProps {
  state: CompareState
  snapshots: AnalysisSnapshot[]
  showExpert: boolean
  /**
   * The canonical run, threaded from CompareTabBody (which already holds it
   * for CompareFooter) and ultimately OutputsDock's `handleRunAnalysis`.
   *
   * REQUIRED, deliberately. The 'stale' hero's action reads "Rerun analysis"
   * and until 2026-07-28 it was an inert `<span>` styled `cursor-pointer` —
   * a control that looked live and dispatched nothing (ROADMAP 2.102). An
   * optional prop would let a future call site re-create exactly that, and
   * silently; a required one makes the compiler refuse.
   */
  onRunAnalysis: () => void
}

/**
 * The leader half of a hero sentence — ROADMAP 2.835.
 *
 * ⛔ NEVER `latest.winnerLabel` / `latest.winnerProbability`. Those were the
 * client-side ARGMAX ("Authority 3", deleted by `src/lib/decisionVerdict.ts`)
 * and the probability was minted: `(winner?.win_probability ?? 0) * 100` over a
 * field the wire declares OPTIONAL. The visible result was a guard watching one
 * door, reproduced inside a single template —
 *
 *     "No clear leading option (Expand to EU 0%, Enter via partner not scored
 *                                            ^^                              )
 *
 * — the runner-up half honest (ROADMAP 2.834), the winner half beside it
 * publishing a measurement the engine never made.
 *
 * `claim` is `deriveLeaderClaim`'s output: `'named'` only when the producer
 * entitled us to name a leader AND that option carries a real probability.
 * Every arm below that says "leads" is reached only through a state the state
 * machine gates on exactly that, so the non-null assertions are structural.
 */
function leaderPhrase(claim: LeaderClaim): string {
  return `${claim.label} leads at ${claim.winProbability}%`
}

function getHeroCopy(
  state: CompareState,
  latest: AnalysisSnapshot,
  first: AnalysisSnapshot,
  runCount: number,
  claim: LeaderClaim,
) {
  switch (state) {
    case 'improving': {
      // "was M% at run 1" is a measurement of THE SAME OPTION in run 1 — found
      // by id, never `first.winnerProbability`, which was run 1's OWN argmax
      // and could be a different option entirely. When run 1 did not score this
      // option the clause is DROPPED, not filled with a 0: there is no baseline
      // to have improved from.
      const firstProbability = optionProbabilityIn(first, claim.optionId)
      return {
        line1: firstProbability != null
          ? `Run ${latest.runNumber} · ${leaderPhrase(claim)} (was ${firstProbability}% at run 1)`
          : `Run ${latest.runNumber} · ${leaderPhrase(claim)}`,
        // T2b: drop the "Model X" clause entirely when robustness was never
        // assessed. A template literal would coerce null to the string "null"
        // ("Model null") and TypeScript cannot catch that.
        line2: latest.stabilityLabel != null
          ? `Confidence improving · Model ${latest.stabilityLabel}`
          : 'Confidence improving',
        actionPrefix: 'Calibrate ',
        actionLink: latest.topCalibrationFactor,
        actionNodeId: latest.topCalibrationFactorId,
        // ⛔ The clause ", resolving could improve confidence by {topEvpiValue}pp"
        // is REMOVED. `evpi_percentage_points` is refuted by our own compute
        // layer — ISL measures 0.0pp for the factors PLoT scores at 12.3 /
        // 10.2 / 6.6 — and `?? 0` upstream published absence as a confident
        // zero, so this line could read "improve confidence by 0pp" on a
        // producer that simply sent nothing. The influence figure that remains
        // is elasticity-derived and is the basis for choosing this factor.
        detail: `${latest.topElasticity}% influence`,
      }
    }
    case 'noWinner': {
      // The producer's OWN tie verdict selected this arm, so the two options
      // named here are the two the verdict compared: `snapshot.options` is
      // sorted by win probability and `separation: 'tied'` requires two
      // COMPARABLE options, so both of these carry a real measurement.
      //
      // ROADMAP 2.835: listing the top two is an ORDERING, not a claim — the
      // same distinction `deriveOptionDeltas` already draws. Neither is called
      // the leader, because `hasLeadingOption` is false here.
      //
      // The old `?? 0` pair is gone rather than guarded: an option the run did
      // not score is absent from `options` entirely, so there is nothing left
      // to coerce.
      const [top, second] = latest.options
      return {
        line1: `Run ${latest.runNumber} · No clear leading option (${top.label} ${top.winProbability}%, ${second.label} ${second.winProbability}%)`,
        line2: 'Model improving · Result uncertain',
        actionPrefix: 'Calibrate ',
        actionLink: latest.topCalibrationFactor,
        actionNodeId: latest.topCalibrationFactorId,
        detail: 'to separate the options',
      }
    }
    case 'unclaimed':
      // ROADMAP 2.835 — the arm that exists so the other four can be honest.
      //
      // The producer named no leader for this run: either it sent no
      // applicable signal (a withheld turn drops `headline_banded` and nulls
      // `leading_option_id` — CEE #711) or fewer than two options carried a
      // win probability at all. Both are the `unknown` verdict, and
      // `decisionVerdict`'s doctrine is that silence licenses NO CLAIM IN
      // EITHER DIRECTION.
      //
      // ⚠ SO THIS IS NOT `noWinner`. "No clear leading option" is a second
      // claim — a denial — and we have no more authority for it than for the
      // assertion. Before this arm existed, such a run fell into `noWinner` or
      // `improving` and the tab made one of those claims out of two zeros it
      // had minted itself. The copy states only what is true: nothing was
      // reported. `NOT_ASSESSED` is the estate's standing absence token, used
      // verbatim on this same tab by RunPairCompare and the expert table.
      return {
        line1: `Run ${latest.runNumber} · Leading option: ${NOT_ASSESSED}`,
        line2: 'This run reported no leading option · The comparison below still applies',
        actionPrefix: 'Calibrate ',
        actionLink: latest.topCalibrationFactor,
        actionNodeId: latest.topCalibrationFactorId,
        detail: `${latest.topElasticity}% influence`,
      }
    case 'converged':
      return {
        line1: `Run ${latest.runNumber} · ${leaderPhrase(claim)} (stable across ${runCount} runs)`,
        line2: 'Model stable · Further refinement unlikely to shift outcome',
        actionPrefix: '',
        actionLink: 'Review results',
        actionNodeId: null,
        detail: '',
      }
    case 'flipped': {
      const narrow = isNarrowFlip(latest)
      return {
        line1: `Run ${latest.runNumber} · Result changed: ${claim.label} now leads at ${claim.winProbability}%`,
        // ⚠ THIS USED TO READ 'Structure changed · Review the new result'
        // (ROADMAP 2.578). The `flipped` state is `previous.winnerId !==
        // latest.winnerId` and NOTHING ELSE — a change of leading option. It is
        // not evidence about the model's shape, and no structure signal is in
        // scope here at all. So the hero was asserting a cause it had never
        // measured, on the same surface where the transition card states the
        // structure verdict from the canonical graph diff — the two could, and
        // would, contradict each other on a wide flip over an unchanged model.
        // The replacement says only what this branch actually knows: the leader
        // changed, and not narrowly.
        line2: narrow
          ? 'New leader by a narrow margin · Review the change carefully'
          : 'Result changed decisively · Review the new result',
        actionPrefix: '',
        actionLink: 'Review what caused the change',
        actionNodeId: null,
        detail: '',
      }
    }
    case 'stale':
      return {
        line1: `Run ${latest.runNumber} · Results outdated`,
        line2: 'Model edited since last analysis · Rerun to see impact',
        actionPrefix: '',
        actionLink: 'Rerun analysis',
        actionNodeId: null,
        detail: '',
      }
  }
}

export function Hero({ state, snapshots, showExpert, onRunAnalysis }: HeroProps) {
  const latest = snapshots[snapshots.length - 1]
  const first = snapshots[0]
  // ROADMAP 2.835 — ONE resolution of "what may this run say about a leader",
  // from the one module entitled to answer it. Resolved here rather than inside
  // each copy branch so the four leader-bearing arms cannot answer it
  // differently, and so a new arm cannot quietly skip asking.
  const claim = deriveLeaderClaim(latest)
  const copy = getHeroCopy(state, latest, first, snapshots.length, claim)

  // 'stale' is the ONLY hero state whose action is a run rather than a
  // navigation, so it is the only one that gets a real control here. Derived
  // from `state` in one place rather than carried as a sixth field on every
  // `getHeroCopy` branch — a per-branch flag is a mirror five call sites must
  // keep in step (CLAUDE.md trap 12).
  const actionIsRerun = state === 'stale'

  return (
    <div className="px-4 py-3 border-b border-panel-border">
      {/* Line 1 */}
      <div className={`${typography.panelHeader} text-text-body mb-0.5`}>
        {copy.line1}
      </div>

      {/* Line 2 */}
      <div className={`${typography.panelBody} text-text-light mb-1.5`}>
        {copy.line2}
      </div>

      {/* Line 3: Action */}
      <div className={`${typography.panelBody} flex items-center gap-1 flex-wrap`}>
        <ArrowRight size={11} className="text-text-light" />
        {copy.actionPrefix && (
          <span className={typography.panelBody}>{copy.actionPrefix}</span>
        )}
        {copy.actionNodeId ? (
          <span
            onMouseEnter={() => highlightNode(copy.actionNodeId!)}
            onMouseLeave={clearHighlight}
          >
            <GraphLink nodeId={copy.actionNodeId} label={copy.actionLink}>
              <span className={`${typography.panelHeader} text-info hover:underline`}>
                {copy.actionLink}
              </span>
            </GraphLink>
          </span>
        ) : actionIsRerun ? (
          /* ROADMAP 2.102: this was an inert <span> carrying `cursor-pointer`
             — "Rerun analysis", styled as a live link, dispatching nothing.
             It is now the real control, on the SAME canonical run the footer's
             Rerun and the composer use (threaded from OutputsDock), never a
             second pipeline. */
          <button
            type="button"
            data-testid="compare-hero-rerun"
            onClick={onRunAnalysis}
            className={`${typography.panelHeader} text-info hover:underline cursor-pointer bg-transparent border-none p-0`}
          >
            {copy.actionLink}
          </button>
        ) : (
          <span className={`${typography.panelHeader} text-info hover:underline cursor-pointer`}>
            {copy.actionLink}
          </span>
        )}
        {copy.detail && (
          <span className={typography.panelMeta}>{copy.detail}</span>
        )}
      </div>

      {/* Expert methodology line */}
      {showExpert && (
        <div className={`${typography.panelMeta} mt-1.5`}>
          {/* T2b: the Seed segment fails closed. React renders a null child as
              nothing, which would leave a bare "Seed: ·" claiming a receipt
              that does not exist. This mirrors AdvancedSection, which hides
              its Seed row on the same fact. */}
          1,000 Monte Carlo simulations · Bootstrap stability
          {latest.seedUsed != null && <> · Seed: {latest.seedUsed}</>}
          {' · '}Hash: {latest.responseHash}
        </div>
      )}
    </div>
  )
}
