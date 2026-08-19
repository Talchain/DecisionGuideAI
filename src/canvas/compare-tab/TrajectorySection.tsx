import { useState } from 'react'
import { TrendingUp, ChevronDown, ChevronRight } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { typography } from '../../styles/typography'
import { DotProgression } from './DotProgression'
import { HealthIndicators } from './HealthIndicators'
import { deriveLeaderClaim, optionProbabilityIn } from './leaderClaim'
import type { AnalysisSnapshot } from './types'

interface TrajectorySectionProps {
  snapshots: AnalysisSnapshot[]
  showExpert: boolean
}

/**
 * T2b: absence renders as "Not assessed", never as 0.
 *
 * The snapshot fields are absence-preserving (null = the producer sent no
 * robustness data / the engine echoed no seed). Rendering a null as 0 would
 * put "0 fragile" in this table while AdvancedSection honestly hid the same
 * fact for the same run — the cross-surface incoherence #322 was merged to
 * prevent. An honest producer-sent 0 still shows as 0.
 */
const NOT_ASSESSED = 'Not assessed'

/**
 * ⛔ NO `Stability %` COLUMN (ROADMAP 2.1273).
 *
 * The table used to open with `Run | Stability % | …`, rendering
 * `Math.round(s.recommendationStability * 100)` per run. That snapshot field is
 * `robustness.recommendation_stability`, which PLoT WITHHOLDS deliberately: ISL
 * derives it as `option_wins[winner] / n_samples` — the leading option's
 * `win_probability` relabelled, carrying zero independent information.
 *
 * The column already had an honest absence token (`NOT_ASSESSED`), and on a
 * fresh run that is what fired. The column is nevertheless DELETED rather than
 * left to that guard, because this tab's history comes from
 * `v5_handler_facts` rows via `stores/persistedRunSnapshotFactory.ts` — a row
 * written before the withdrawal still CARRIES the value, and `!= null` is true
 * for a value that is present. A signed-in owner of such a scenario would have
 * seen the withdrawn statistic in a per-run trajectory table, which is the most
 * observation-like framing available (a column of percentages across runs reads
 * as a measured trend).
 *
 * Note the tab's own reachability bound, since it decides severity: the
 * persisted-history read is signed-in only by construction
 * (`v5_handler_facts` RLS is `auth.uid() = user_id`; guest rows carry a NULL
 * user_id, and `useCompareHistoryHydration` checks for a session and skips).
 *
 * `recommendationStability` STAYS on `AnalysisSnapshot` — `stabilityLabel` is
 * derived from it and drives `Hero`/`HealthIndicators`/`deriveTransitions`
 * categorical copy. That chain is a separate, rowed concern and is deliberately
 * out of scope here; it is recorded in the pinned known-gap set of
 * `src/components/results/__tests__/withheldFieldReadBan.spec.ts`.
 *
 * REINSTATEMENT TRIGGER: PLoT supplies a genuine numeric robustness/stability
 * field distinct from the leader's win probability.
 */
function ExpertTable({ snapshots }: { snapshots: AnalysisSnapshot[] }) {
  return (
    <div className="mt-2">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {['Run', 'Evidence', 'Conc. %', 'Flip rate', 'Fragile', 'Seed'].map(h => (
              <th
                key={h}
                className={`${typography.panelMeta} font-medium text-left px-0.5 py-0.5 border-b border-panel-border`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {snapshots.map(s => (
            <tr key={s.runId}>
              {[
                s.runNumber,
                s.evidenceCoverage ?? NOT_ASSESSED,
                `${s.influenceConcentration}%`,
                s.rankFlipRate.toFixed(2),
                s.fragileEdgeCount ?? NOT_ASSESSED,
                s.seedUsed ?? NOT_ASSESSED,
              ].map((val, i) => (
                <td key={i} className={`${typography.panelMeta} tabular-nums px-0.5 py-0.5`}>
                  {val}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export interface TrajectoryDatum {
  run: number
  /**
   * The LEADING option's probability in this run — the option the latest run's
   * verdict names, followed by id across the whole series.
   *
   * null ⇒ this run did not score that option (ROADMAP 2.835). It was
   * non-nullable and fed by the per-run argmax, which made two silent claims at
   * once: a run with no probabilities plotted at 0, and a run whose argmax was
   * a DIFFERENT option contributed that option's value to this line.
   */
  winner: number | null
  /** null ⇒ this run had no runner-up, or the engine did not score it. */
  runnerUp: number | null
  /** null ⇒ goal attainment was not assessed for this run. */
  goal: number | null
}

/**
 * The chart series, absence-preserving (ROADMAP 2.834).
 *
 * `runnerUp` was `?? 0`, which drew a flat line along the axis for a run whose
 * runner-up was never scored — a measurement the engine did not make, in the
 * most credible form the UI has. A reader doubts a printed number; a plotted
 * series reads as observation. `goal` was already honest (`?? undefined`) two
 * lines away, so this only brings `runnerUp` to the standard its neighbour
 * already met.
 *
 * Recharts leaves a GAP for a null y-value (`connectNulls` defaults false), so
 * an unscored run breaks the line instead of pinning it to zero.
 *
 * ROADMAP 2.835 brings the WINNER series to the same standard, and adds the
 * identity binding both series need: `leaderOptionId` is the option the latest
 * run's verdict names, and every point on the line is THAT option's probability
 * in that run. Passing `null` draws no leader line at all — correct when the
 * producer named no leader, because the line's entire meaning is a claim about
 * a named option.
 *
 * Exported so the series can be asserted directly: jsdom cannot prove anything
 * about a rendered chart (CLAUDE.md trap 3), and a test that renders recharts
 * under jsdom would be pinning nothing.
 */
export function buildTrajectoryData(
  snapshots: AnalysisSnapshot[],
  leaderOptionId: string | null,
): TrajectoryDatum[] {
  return snapshots.map(s => ({
    run: s.runNumber,
    winner: optionProbabilityIn(s, leaderOptionId),
    runnerUp: s.runnerUpProbability,
    goal: s.goalProbability,
  }))
}

function TrajectoryChart({ snapshots }: { snapshots: AnalysisSnapshot[] }) {
  const claim = deriveLeaderClaim(snapshots[snapshots.length - 1])
  const data = buildTrajectoryData(snapshots, claim.optionId)

  // Derived from the SERIES rather than re-deriving a predicate over the
  // snapshots: one source of truth for "is there anything to draw", so a
  // change to the series cannot leave the line-visibility guard behind.
  const hasGoal = data.some(d => d.goal != null)
  const hasRunnerUp = data.some(d => d.runnerUp != null)
  // Same rule, now needed for the leader line too: it is drawn only where there
  // is something measured to draw.
  const hasWinner = claim.kind === 'named' && data.some(d => d.winner != null)

  // Flip markers — ROADMAP 2.835.
  //
  // This was `s.winnerId !== snapshots[i].winnerId`, over a field that is
  // `winner?.option_id ?? ''` at source. A run the producer did not score
  // compared as `''`, so it was UNEQUAL to any scored neighbour and the chart
  // drew a "the result flipped here" reference line across a run in which
  // nothing was measured. A flip is claimable only when both runs NAMED a
  // leader — the same rule `deriveRunPairComparison.leaderChange` and the
  // state machine's `'flipped'` arm apply, so all three agree by construction.
  const flipRuns = snapshots
    .slice(1)
    .filter((s, i) => {
      const to = deriveLeaderClaim(s)
      const from = deriveLeaderClaim(snapshots[i])
      return to.kind === 'named' && from.kind === 'named' && to.optionId !== from.optionId
    })
    .map(s => s.runNumber)

  return (
    <ResponsiveContainer width="100%" height={120}>
      <LineChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: -20 }}>
        <XAxis
          dataKey="run"
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        {flipRuns.map(run => (
          <ReferenceLine
            key={run}
            x={run}
            stroke="var(--danger)"
            strokeDasharray="3 3"
            strokeOpacity={0.5}
          />
        ))}
        {hasWinner && (
          <Line
            type="monotone"
            dataKey="winner"
            stroke="var(--chart-1)"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        )}
        {hasRunnerUp && (
          <Line
            type="monotone"
            dataKey="runnerUp"
            stroke="var(--chart-4)"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        )}
        {hasGoal && (
          <Line
            type="monotone"
            dataKey="goal"
            stroke="var(--chart-3)"
            strokeWidth={2}
            dot={{ r: 3 }}
            strokeDasharray="4 2"
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  )
}

export function TrajectorySection({ snapshots, showExpert }: TrajectorySectionProps) {
  const [open, setOpen] = useState(true)
  const first = snapshots[0]
  const latest = snapshots[snapshots.length - 1]
  const useChart = snapshots.length >= 4

  return (
    <div className="border-b border-panel-border">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-1.5 px-4 py-2 bg-transparent border-none cursor-pointer"
      >
        {open ? <ChevronDown size={11} className="text-text-light" /> : <ChevronRight size={11} className="text-text-light" />}
        <TrendingUp size={13} className="text-text-light" />
        <span className={typography.panelHeader}>How the recommendation evolved</span>
      </button>
      {open && (
        <div className="px-4 pb-2.5">
          {useChart ? (
            <TrajectoryChart snapshots={snapshots} />
          ) : (
            <DotProgression snapshots={snapshots} />
          )}
          <HealthIndicators first={first} latest={latest} />
          {showExpert && <ExpertTable snapshots={snapshots} />}
        </div>
      )}
    </div>
  )
}
