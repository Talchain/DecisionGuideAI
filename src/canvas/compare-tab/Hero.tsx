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
    case 'noWinner':
      return {
        line1: `Run ${latest.runNumber} · No clear leading option (${latest.winnerLabel} ${latest.winnerProbability}%, ${latest.runnerUpLabel ?? '—'} ${latest.runnerUpProbability ?? 0}%)`,
        line2: 'Model improving · Result uncertain',
        actionPrefix: 'Calibrate ',
        actionLink: latest.topCalibrationFactor,
        actionNodeId: latest.topCalibrationFactorId,
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
  const copy = getHeroCopy(state, latest, first, snapshots.length)

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
