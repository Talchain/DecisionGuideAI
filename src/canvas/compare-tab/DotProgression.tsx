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
  /** null ⇒ not scored in this run. Never coerced to 0 (ROADMAP 2.834). */
  values: (number | null)[]
  colour: string // Tailwind colour class
}

/**
 * What a run that was never scored shows instead of a number.
 *
 * The surface already owns this idiom — `NOT_ASSESSED` in TrajectorySection
 * and RunPairCompare, and `—` on ComparisonCanvasLayout. In this row the cell
 * is a few characters wide, so it takes the em-dash form, with the full
 * sentence on the title so the meaning is reachable without widening the row.
 */
const NOT_SCORED = '—'
const NOT_SCORED_TITLE = 'Not scored in this run'

/**
 * One run's cell in a progression row — the ONE place absence is rendered.
 *
 * Both rows (options and target) previously carried their own `?? 0`, so the
 * fix had to land twice or land inconsistently. Rendering both through this
 * component means a later row cannot reintroduce the fabrication by omission
 * (CLAUDE.md trap 12 — derive, don't mirror).
 *
 * An unscored run draws a HOLLOW dot: a filled dot on a progression reads as
 * "measured here", which is the same claim the fabricated number made.
 */
function ProgressionCell({
  value,
  colour,
  isLast,
  showConnector,
}: {
  value: number | null
  colour: string
  isLast: boolean
  showConnector: boolean
}) {
  const scored = value != null
  const size = isLast ? 9 : 7

  return (
    <div className="inline-flex items-center">
      {showConnector && <div className={`w-6 h-0.5 ${colour} opacity-30`} />}
      <div
        className={`rounded-full ${scored ? colour : ''}`}
        style={{
          width: size,
          height: size,
          opacity: isLast ? 1 : 0.6,
          ...(scored ? {} : { border: '1px dashed var(--text-muted)' }),
        }}
        {...(scored ? {} : { 'data-testid': 'compare-dot-unscored', title: NOT_SCORED_TITLE })}
      />
      <span
        className={`${typography.panelMeta} tabular-nums ml-0.5 mr-0.5`}
        {...(scored ? {} : { title: NOT_SCORED_TITLE })}
      >
        {scored ? `${value}%` : NOT_SCORED}
      </span>
    </div>
  )
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
      // `latest.runnerUpId` gates whether the ROW exists, using the LATEST run
      // only — it says nothing about the earlier runs plotted along it, which
      // is how `?? 0` printed "0%" for runs that had no runner-up at all.
      values: snapshots.map(s => s.runnerUpProbability),
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
          {row.values.map((val, ri) => (
            <ProgressionCell
              key={ri}
              value={val}
              colour={row.colour}
              isLast={ri === snapshots.length - 1}
              showConnector={ri > 0}
            />
          ))}
        </div>
      ))}

      {/* Goal probability row */}
      {hasGoal && (
        <div className="flex items-center mb-1">
          <span className={`${typography.panelBody} font-medium w-[68px] flex-shrink-0 flex items-center gap-0.5`}>
            <Target size={10} className="text-goal" /> Target
          </span>
          {snapshots.map((s, ri) => (
            // `hasGoal` decides whether this ROW is drawn at all; it never said
            // anything about the individual runs along it, so a run with no
            // goal assessment used to print a fabricated "0%" inside an
            // honestly-gated row.
            <ProgressionCell
              key={ri}
              value={s.goalProbability}
              colour="bg-goal"
              isLast={ri === snapshots.length - 1}
              showConnector={ri > 0}
            />
          ))}
        </div>
      )}
    </div>
  )
}
