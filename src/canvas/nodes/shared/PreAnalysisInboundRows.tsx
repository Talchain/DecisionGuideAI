/**
 * PreAnalysisInboundRows — the pre-analysis "Driven by:" list shared by
 * `OutcomeNode` and `RiskNode`.
 *
 * Four byte-identical copies of the row markup existed across the two nodes
 * (popover ×2, Detailed-view inline list ×2). Converged here so the unset
 * affordance is decided ONCE — see `usePreAnalysisInbound` for why an unset
 * strength must never render as a number.
 *
 * Vocabulary is deliberately the same as `EdgePills`' P1-10 disclosure
 * ("Not set", italic, `role="img"` + aria-label) so the two surfaces do not
 * teach the user two different words for the same state.
 */
import { typography } from '../../../styles/typography'
import type { PreAnalysisInbound, PreAnalysisInboundItem } from '../../hooks/usePreAnalysisInbound'

/**
 * The pre-analysis popover summary sentence, shared by both nodes.
 *
 * TWO CLAIMS OF DIFFERENT STRENGTH, DELIBERATELY SPLIT:
 *   · "Driven by N factors." counts edges the user drew. Always true.
 *   · "Strongest: X at P%."  is a COMPARATIVE MEASUREMENT. It used to be
 *     spoken unconditionally off `computeSignedMean`, which falls through to
 *     `USER_EDGE_DEFAULTS.weight` (0.3) — so pre-analysis, the phase where by
 *     definition nothing has been estimated, the product named a winner and
 *     quoted a figure for it. `topSetItem` is `null` unless at least one
 *     inbound strength was actually set, and then the clause is simply absent.
 *
 * Lives in a component (rather than inline JSX in each node) so the rule is
 * assertable without driving the hover popover's rAF/portal machinery.
 */
export function PreAnalysisDrivenByLine({ items, topSetItem }: PreAnalysisInbound) {
  return (
    <p className={`${typography.edgeLabel} text-text-body m-0 mb-1`}>
      Driven by {items.length} factor{items.length !== 1 ? 's' : ''}.
      {topSetItem && (
        <> Strongest: {topSetItem.nodeLabel} at {topSetItem.strengthPct}%.</>
      )}
    </p>
  )
}

export function PreAnalysisInboundRows({ items }: { items: PreAnalysisInboundItem[] }) {
  return (
    <>
      {items.map(item => (
        <div
          key={item.edgeId}
          className={`${typography.edgeLabel} text-text-light m-0 flex justify-between gap-2`}
        >
          <span className="truncate">{item.nodeLabel}</span>
          {item.strengthPct !== null ? (
            <span
              className={`${typography.nodeLabel} font-semibold shrink-0`}
              title="Link strength"
              aria-label={`${item.strengthPct}% link strength`}
            >
              {item.strengthPct}%
            </span>
          ) : (
            <span
              className={`${typography.nodeLabel} italic shrink-0`}
              role="img"
              title="Link strength not set — open this connection to estimate it"
              aria-label="Link strength not set"
              data-testid={`pre-analysis-strength-unset-${item.edgeId}`}
            >
              Not set
            </span>
          )}
        </div>
      ))}
    </>
  )
}
