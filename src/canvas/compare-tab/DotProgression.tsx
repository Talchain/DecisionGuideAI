import { Target } from 'lucide-react'
import { typography } from '../../styles/typography'
import { GraphLink } from '../../components/results/GraphLink'
import { highlightNode, clearHighlight } from '../utils/highlightHelpers'
import type { AnalysisSnapshot } from './types'

interface DotProgressionProps {
  snapshots: AnalysisSnapshot[]
}

interface OptionRow {
  label: string
  nodeId: string | null
  values: number[]
  colour: string // Tailwind colour class
}

export function DotProgression({ snapshots }: DotProgressionProps) {
  if (snapshots.length === 0) return null

  const latest = snapshots[snapshots.length - 1]

  const rows: OptionRow[] = [
    {
      label: latest.winnerLabel,
      nodeId: latest.winnerId,
      values: snapshots.map(s => s.winnerProbability),
      colour: 'bg-info',
    },
  ]

  if (latest.runnerUpId) {
    rows.push({
      label: latest.runnerUpLabel ?? '',
      nodeId: latest.runnerUpId,
      values: snapshots.map(s => s.runnerUpProbability ?? 0),
      colour: 'bg-option',
    })
  }

  const hasGoal = snapshots.some(s => s.goalProbability != null)

  return (
    <div>
      {/* Run labels */}
      <div className="flex items-center mb-0.5" style={{ paddingLeft: 72 }}>
        {snapshots.map((s, i) => (
          <span
            key={s.runId}
            className={`${typography.panelMeta} min-w-[36px]`}
            style={{ marginRight: i < snapshots.length - 1 ? 24 : 0 }}
          >
            Run {s.runNumber}
          </span>
        ))}
      </div>

      {/* Option rows */}
      {rows.map(row => (
        <div key={row.nodeId ?? row.label} className="flex items-center mb-1">
          <span
            className={`${typography.panelBody} font-medium w-[68px] flex-shrink-0 truncate`}
          >
            {row.nodeId ? (
              <span
                onMouseEnter={() => highlightNode(row.nodeId!)}
                onMouseLeave={clearHighlight}
              >
                <GraphLink nodeId={row.nodeId} label={row.label} />
              </span>
            ) : (
              row.label
            )}
          </span>
          {row.values.map((val, ri) => {
            const isLast = ri === snapshots.length - 1
            return (
              <div key={ri} className="inline-flex items-center">
                {ri > 0 && (
                  <div
                    className={`w-6 h-0.5 ${row.colour} opacity-30`}
                  />
                )}
                <div
                  className={`rounded-full ${row.colour}`}
                  style={{
                    width: isLast ? 9 : 7,
                    height: isLast ? 9 : 7,
                    opacity: isLast ? 1 : 0.6,
                  }}
                />
                <span className={`${typography.panelMeta} tabular-nums ml-0.5 mr-0.5`}>
                  {val}%
                </span>
              </div>
            )
          })}
        </div>
      ))}

      {/* Goal probability row */}
      {hasGoal && (
        <div className="flex items-center mb-1">
          <span className={`${typography.panelBody} font-medium w-[68px] flex-shrink-0 flex items-center gap-0.5`}>
            <Target size={10} className="text-goal" /> Target
          </span>
          {snapshots.map((s, ri) => {
            const isLast = ri === snapshots.length - 1
            const val = s.goalProbability ?? 0
            return (
              <div key={ri} className="inline-flex items-center">
                {ri > 0 && (
                  <div className="w-6 h-0.5 bg-goal opacity-30" />
                )}
                <div
                  className="rounded-full bg-goal"
                  style={{
                    width: isLast ? 9 : 7,
                    height: isLast ? 9 : 7,
                    opacity: isLast ? 1 : 0.6,
                  }}
                />
                <span className={`${typography.panelMeta} tabular-nums ml-0.5 mr-0.5`}>
                  {val}%
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
