/**
 * Side-by-side view of two picked runs — ROADMAP 2.113a slice 2.
 *
 * Presentation only. Every cell renders a value `deriveRunPairComparison`
 * produced from two persisted facts, or the estate's existing absence copy —
 * "Not assessed" for a quantity nobody measured, "Only in run N" for an option
 * or factor that exists on one side, "Not comparable" for a pair of models the
 * hash regimes forbid comparing. No cell computes anything.
 *
 * The transition CARD for the same pair is not rendered here: `CompareTabBody`
 * feeds the pair's `Transition` to the existing `TransitionsSection`, so the
 * narrative half of the design's slice-2 line ("render the existing
 * TransitionCard machinery for the chosen pair") is the untouched component,
 * not a copy of it.
 */
import type { ReactNode } from 'react'
import { typography } from '../../styles/typography'
import { GraphLink } from '../../components/results/GraphLink'
import { highlightNode, clearHighlight } from '../utils/highlightHelpers'
import { runLabel } from './runLabels'
import { UNCHARACTERISED_CHANGE_SUMMARY, type GraphChangeKind } from './graphChangeDiff'
import type { AnalysisSnapshot, LeaderClaim, RunPairComparison } from './types'

interface RunPairCompareProps {
  comparison: RunPairComparison
}

const NOT_ASSESSED = 'Not assessed'

function runHeading(snapshot: AnalysisSnapshot): string {
  return runLabel(snapshot.runNumber, snapshot.timestamp)
}

function signed(value: number, unit: string): string {
  return `${value >= 0 ? '+' : ''}${value}${unit}`
}

function ordinal(rank: number): string {
  const suffix = rank === 1 ? 'st' : rank === 2 ? 'nd' : rank === 3 ? 'rd' : 'th'
  return `${rank}${suffix}`
}

/** Places gained or lost in the influence order — positive is more influential. */
function rankMovement(delta: number): string {
  if (delta === 0) return 'Same position'
  const places = Math.abs(delta) === 1 ? 'place' : 'places'
  return `${delta > 0 ? 'Up' : 'Down'} ${Math.abs(delta)} ${places}`
}

/**
 * The producer's claim for one run, as a sentence that surface is entitled to
 * make. `'unclaimed'` prints the estate's absence copy — never "no clear
 * leading option", which is a SECOND claim and needs the producer's tie
 * verdict to license it.
 */
function leaderText(claim: LeaderClaim): string {
  if (claim.kind === 'named') return claim.label ?? NOT_ASSESSED
  if (claim.kind === 'tied') return 'No clear leading option'
  return NOT_ASSESSED
}

const STRUCTURE_TEXT: Record<RunPairComparison['structure'], string> = {
  changed: 'Changed',
  unchanged: 'Unchanged',
  // ⚠ Not "unchanged". A session snapshot's hash is the UI's own
  // `generateGraphHash`; a persisted run's is CEE's `aag_v1`. They are always
  // unequal, and comparing them would report a structure change manufactured
  // out of where the two runs were read from.
  not_comparable: 'Not comparable',
}

/**
 * WHY THIS IS KEYED OFF THE VERDICT KIND AND NOT OFF `structure` (2.578 F1).
 *
 * `STRUCTURE_TEXT` above answers ONE question — did the shape move? — and three
 * answers cover it. This sentence answers a different question, "why does it say
 * that?", and there are five reasons. When 2.578 made `compareStructure` a
 * projection of the one verdict it WIDENED two of the three preimages, and each
 * of these sentences went on being printed for cases it was never true of:
 *
 *  · `'unchanged'` acquired `value_only`, so "Both runs were computed over the
 *    same model" appeared beside the list of values that had just changed — the
 *    +0.50 → +0.80 journey this whole row exists to fix, reappearing one surface
 *    over.
 *  · `'not_comparable'` acquired same-regime `uncharacterised_change`, so two
 *    `aag_v1` hashes that were read and compared successfully were reported as
 *    "different, incomparable identifiers" — the screen blaming a provenance
 *    boundary for a change it had in fact measured, while the transition card
 *    for the same pair said the model changed.
 *
 * `uncharacterised_change` quotes the card's own constant rather than restating
 * it, so the two surfaces cannot drift apart (CLAUDE.md trap 12).
 */
const STRUCTURE_DETAIL: Record<GraphChangeKind, string> = {
  structural: 'The model these runs were computed over is not the same',
  unchanged: 'Both runs were computed over the same model',
  value_only: 'The model has the same shape in both runs — some of its values changed',
  uncharacterised_change: UNCHARACTERISED_CHANGE_SUMMARY,
  // Cross-regime, or a hash absent at one end: nothing was compared, so nothing
  // is claimed about whether the model moved.
  not_comparable: 'These two runs record their model with different, incomparable identifiers',
}

function Row({
  label,
  from,
  to,
  delta,
  testId,
}: {
  label: ReactNode
  from: ReactNode
  to: ReactNode
  delta: ReactNode
  testId?: string
}) {
  return (
    <div
      className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.1fr)] gap-2 px-4 py-1.5 border-b border-panel-border/60"
      data-testid={testId}
    >
      <span className={`${typography.panelBody} text-text-light min-w-0 break-words`}>{label}</span>
      <span className={`${typography.panelBody} min-w-0 break-words`}>{from}</span>
      <span className={`${typography.panelBody} min-w-0 break-words`}>{to}</span>
      <span className={`${typography.panelMeta} min-w-0 break-words`}>{delta}</span>
    </div>
  )
}

export function RunPairCompare({ comparison }: RunPairCompareProps) {
  const { from, to } = comparison

  return (
    <div className="border-b border-panel-border" data-testid="run-pair-compare">
      {/* Column headings */}
      <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.1fr)] gap-2 px-4 py-2 border-b border-panel-border">
        <span className={`${typography.panelHeader}`}>Side by side</span>
        <span className={`${typography.panelHeader}`} data-testid="run-pair-from-heading">
          {runHeading(from)}
        </span>
        <span className={`${typography.panelHeader}`} data-testid="run-pair-to-heading">
          {runHeading(to)}
        </span>
        <span className={`${typography.panelMeta} text-text-light`}>Change</span>
      </div>

      {/* ── Outcome: win probability per option ─────────────────────────── */}
      <div className={`${typography.panelMeta} px-4 pt-2 pb-1 text-text-light`}>
        Win probability by option
      </div>
      {comparison.options.length === 0 ? (
        <Row label="Options" from={NOT_ASSESSED} to={NOT_ASSESSED} delta="" testId="option-row-empty" />
      ) : (
        comparison.options.map(row => (
          <Row
            key={row.optionId}
            testId={`option-row-${row.optionId}`}
            label={
              <>
                {row.label}
                {row.previousLabel != null && (
                  <span className={`${typography.panelMeta} text-text-light`}>
                    {' '}(was “{row.previousLabel}”)
                  </span>
                )}
              </>
            }
            from={row.fromProbability != null ? `${row.fromProbability}%` : '—'}
            to={row.toProbability != null ? `${row.toProbability}%` : '—'}
            delta={
              row.deltaPp != null
                ? signed(row.deltaPp, 'pp')
                : row.presence === 'only_from'
                  ? `Only in run ${from.runNumber}`
                  : `Only in run ${to.runNumber}`
            }
          />
        ))
      )}

      {/* ── Verdict states ───────────────────────────────────────────────── */}
      <div className={`${typography.panelMeta} px-4 pt-2 pb-1 text-text-light`}>
        Verdict
      </div>
      <Row
        testId="leader-row"
        label="Leading option"
        from={leaderText(comparison.fromLeader)}
        to={leaderText(comparison.toLeader)}
        delta={
          comparison.leaderChange === 'changed'
            ? 'Leader changed'
            : comparison.leaderChange === 'unchanged'
              ? 'Leader unchanged'
              : 'Not comparable'
        }
      />
      <Row
        testId="goal-row"
        label="Goal probability"
        from={from.goalProbability != null ? `${from.goalProbability}%` : NOT_ASSESSED}
        to={to.goalProbability != null ? `${to.goalProbability}%` : NOT_ASSESSED}
        delta={
          comparison.goalProbabilityDeltaPp != null
            ? signed(comparison.goalProbabilityDeltaPp, 'pp')
            : ''
        }
      />
      <Row
        testId="warnings-row"
        label="Inference warnings"
        from={String(from.inferenceWarnings.length)}
        to={String(to.inferenceWarnings.length)}
        delta={
          comparison.warningsResolved.length === 0 && comparison.warningsIntroduced.length === 0
            ? ''
            : [
                comparison.warningsResolved.length > 0
                  ? `${comparison.warningsResolved.length} resolved`
                  : null,
                comparison.warningsIntroduced.length > 0
                  ? `${comparison.warningsIntroduced.length} introduced`
                  : null,
              ]
                .filter(Boolean)
                .join(' · ')
        }
      />

      {/* ── Model ────────────────────────────────────────────────────────── */}
      <div className={`${typography.panelMeta} px-4 pt-2 pb-1 text-text-light`}>
        Model
      </div>
      {/* The two run columns hold PER-RUN values everywhere else in this
          table, and the structure answer is a property of the PAIR — so the
          explanation goes underneath, full width, rather than into the column
          a reader scans for run 1's own number. */}
      <Row
        testId="structure-row"
        label="Model structure"
        from="—"
        to="—"
        delta={STRUCTURE_TEXT[comparison.structure]}
      />
      <div
        className={`${typography.panelMeta} px-4 pb-1.5 text-text-light`}
        data-testid="structure-detail"
      >
        {STRUCTURE_DETAIL[comparison.changeKind]}
      </div>
      <Row
        testId="coverage-row"
        label="Evidence coverage"
        from={comparison.fromEvidenceCoverage ?? NOT_ASSESSED}
        to={comparison.toEvidenceCoverage ?? NOT_ASSESSED}
        delta=""
      />

      {/* ── Factors ──────────────────────────────────────────────────────── */}
      {/* RANK, not elasticity — see FactorDelta's header: the elasticity claim
          family has no owner selector, so new code may not add a raw read, and
          each run's own top-factor ORDER is the already-derived value. */}
      <div className={`${typography.panelMeta} px-4 pt-2 pb-1 text-text-light`}>
        Influence ranking
      </div>
      {comparison.factors.length === 0 ? (
        <Row label="Factors" from={NOT_ASSESSED} to={NOT_ASSESSED} delta="" testId="factor-row-empty" />
      ) : (
        comparison.factors.map(row => (
          <Row
            key={row.factorId}
            testId={`factor-row-${row.factorId}`}
            label={
              (
                <span
                  onMouseEnter={() => highlightNode(row.factorId)}
                  onMouseLeave={clearHighlight}
                >
                  <GraphLink nodeId={row.factorId} label={row.label} />
                </span>
              )
            }
            from={row.fromRank != null ? ordinal(row.fromRank) : '—'}
            to={row.toRank != null ? ordinal(row.toRank) : '—'}
            delta={
              row.rankDelta != null
                ? rankMovement(row.rankDelta)
                : row.presence === 'only_from'
                  ? `Only in run ${from.runNumber}`
                  : `Only in run ${to.runNumber}`
            }
          />
        ))
      )}
    </div>
  )
}
