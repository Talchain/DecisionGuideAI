import { ArrowRight } from 'lucide-react'
import { typography } from '../../styles/typography'
import { GraphLink } from '../../components/results/GraphLink'
import { highlightNode, clearHighlight } from '../utils/highlightHelpers'
import type { AnalysisSnapshot, CompareState } from './types'
import { isNarrowFlip } from './deriveCompareState'

interface HeroProps {
  state: CompareState
  snapshots: AnalysisSnapshot[]
  showExpert: boolean
}

function getHeroCopy(
  state: CompareState,
  latest: AnalysisSnapshot,
  first: AnalysisSnapshot,
  runCount: number,
) {
  switch (state) {
    case 'improving':
      return {
        line1: `Run ${latest.runNumber} · ${latest.winnerLabel} leads at ${latest.winnerProbability}% (was ${first.winnerProbability}% at run 1)`,
        line2: `Confidence improving · Model ${latest.stabilityLabel}`,
        actionPrefix: 'Calibrate ',
        actionLink: latest.topEvpiFactor,
        actionNodeId: latest.topEvpiFactorId,
        detail: `${latest.topElasticity}% influence, resolving could improve confidence by ${latest.topEvpiValue}pp`,
      }
    case 'noWinner':
      return {
        line1: `Run ${latest.runNumber} · No clear leading option (${latest.winnerLabel} ${latest.winnerProbability}%, ${latest.runnerUpLabel ?? '—'} ${latest.runnerUpProbability ?? 0}%)`,
        line2: 'Model improving · Result uncertain',
        actionPrefix: 'Calibrate ',
        actionLink: latest.topEvpiFactor,
        actionNodeId: latest.topEvpiFactorId,
        detail: 'to separate the options',
      }
    case 'converged':
      return {
        line1: `Run ${latest.runNumber} · ${latest.winnerLabel} leads at ${latest.winnerProbability}% (stable across ${runCount} runs)`,
        line2: 'Model stable · Further refinement unlikely to shift outcome',
        actionPrefix: '',
        actionLink: 'Review results',
        actionNodeId: null,
        detail: '',
      }
    case 'flipped': {
      const narrow = isNarrowFlip(latest)
      return {
        line1: `Run ${latest.runNumber} · Result changed: ${latest.winnerLabel} now leads at ${latest.winnerProbability}%`,
        line2: narrow
          ? 'New leader by a narrow margin · Review the change carefully'
          : 'Structure changed · Review the new result',
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

export function Hero({ state, snapshots, showExpert }: HeroProps) {
  const latest = snapshots[snapshots.length - 1]
  const first = snapshots[0]
  const copy = getHeroCopy(state, latest, first, snapshots.length)

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
          1,000 Monte Carlo simulations · Bootstrap stability · Seed: {latest.seedUsed} · Hash: {latest.responseHash}
        </div>
      )}
    </div>
  )
}
