import { useState } from 'react'
import { TrendingUp, ChevronDown, ChevronRight } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { typography } from '../../styles/typography'
import { DotProgression } from './DotProgression'
import { HealthIndicators } from './HealthIndicators'
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

function ExpertTable({ snapshots }: { snapshots: AnalysisSnapshot[] }) {
  return (
    <div className="mt-2">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {['Run', 'Stability %', 'Evidence', 'Conc. %', 'Flip rate', 'Fragile', 'Seed'].map(h => (
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
                s.recommendationStability != null
                  ? `${Math.round(s.recommendationStability * 100)}%`
                  : NOT_ASSESSED,
                s.evidenceCoverage,
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

function TrajectoryChart({ snapshots }: { snapshots: AnalysisSnapshot[] }) {
  const hasGoal = snapshots.some(s => s.goalProbability != null)

  const data = snapshots.map(s => ({
    run: s.runNumber,
    winner: s.winnerProbability,
    runnerUp: s.runnerUpProbability ?? 0,
    goal: s.goalProbability ?? undefined,
  }))

  // Find flip points
  const flipRuns = snapshots
    .slice(1)
    .filter((s, i) => s.winnerId !== snapshots[i].winnerId)
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
        <Line
          type="monotone"
          dataKey="winner"
          stroke="var(--chart-1)"
          strokeWidth={2}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
        />
        <Line
          type="monotone"
          dataKey="runnerUp"
          stroke="var(--chart-4)"
          strokeWidth={2}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
        />
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
