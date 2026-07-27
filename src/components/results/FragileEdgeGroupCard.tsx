/**
 * FragileEdgeGroupCard — the stress-test "Fragile factors" card.
 *
 * Extracted verbatim from `ChallengeSection.tsx`, whose remaining exports
 * (`ChallengeSection`, `ChallengeCard`, `IdentifiabilityCard`) had zero
 * production mounts once `ResultsBody.tsx` replaced the legacy Challenge
 * accordion with `StressTestSection` (Brief 5.8B D4). This card did NOT die
 * with them: `StressTestSection` mounts it on the live V5 path, and
 * `ChallengeFragileEdge` is a live wire type.
 *
 * The split exists so the live card no longer has to be imported out of a
 * module named after a dead component — a shape that reads as live to a grep
 * and invites remediation effort onto code that never renders.
 *
 * Behaviour is unchanged: this is a move, not a rewrite. The grouping, sort
 * and `(Status Quo)`-stripping that used to sit in `ChallengeSection` live in
 * `StressTestSection` (its own copy, already there — see StressTestSection.tsx
 * :285-301), so nothing was lost with the wrapper.
 */

import { typography } from '../../styles/typography'
import { AlertTriangle } from 'lucide-react'
import { stripEncodingNotation } from './utils/cleanFactorLabel'
import {
  fragileDiscussDraft,
  fragileEValueNote,
  fragileEdgeConsequence,
  fragileEdgeGroupHeader,
} from './utils/fragileEdgeCopy'
import { DiscussWithAiButton } from '@/canvas/components/pre-analysis/DiscussWithAiButton'
import { openAskOlumi } from './coaching/askOlumiStore'
import { ExpertBlock } from './ExpertBlock'

/** Fragile edge from robustness.fragile_edges */
export interface ChallengeFragileEdge {
  edge_id?: string
  /** Canvas node ID of the source factor — used by onFocusNode */
  from_id?: string
  from_label: string
  to_label: string
  switch_probability: number
  /** Marginal version from ISL — used as primary sort key when present. */
  marginal_switch_probability?: number
  /** Resolved option label that would take the lead if this edge flipped. */
  alternative_winner_label?: string
  /** ID of the alternative winner option (for deep-link focus). */
  alternative_winner_id?: string
}

/* ── Fragile edge group card ────────────────────────────────────────────── */

export function FragileEdgeGroupCard({
  altWinnerLabel,
  edges,
  onFocusNode,
  onSendMessage,
  expertMode,
  designationsWithheld,
}: {
  /**
   * Shared alt-winner label for this group (D11: grouped by alt-winner).
   * When null, edges have no alt-winner or are a heterogeneous fallback group.
   */
  altWinnerLabel: string | null
  edges: Array<ChallengeFragileEdge & { e_value?: number }>
  onFocusNode?: (nodeId: string) => void
  onSendMessage?: (text: string) => void
  expertMode?: boolean
  /**
   * ROADMAP 1.267 — `!DecisionVerdict.hasLeadingOption`, quoted from the
   * caller. This card's five sentences were UNCONDITIONAL claims about "the
   * result" and "the recommendation"; every one of them is now a function of
   * this boolean (see `utils/fragileEdgeCopy.ts`).
   *
   * The card's DATA is untouched in both states — the fragile-factor rows are
   * producer output, and `StressTestSection` keeps them visible on a withheld
   * run by design.
   *
   * REQUIRED, not optional-defaulting-false: an opt-in gate is a gate every
   * future call site can forget.
   */
  designationsWithheld: boolean
}) {
  const hasEValue = edges.some(e => e.e_value != null)

  const header = fragileEdgeGroupHeader({
    altWinnerLabel,
    edgeCount: edges.length,
    hasEValue,
    designationsWithheld,
  })
  const headerCopy = header.kind === 'altWinner'
    ? <>{header.lead}<span className={`${typography.panelHeader} text-text-body`} data-testid="fragile-alt-winner">{header.altWinnerLabel}</span></>
    : header.text

  return (
    <div className={`relative border border-panel-border rounded-lg px-3 py-2 pr-16 space-y-1.5 ${onSendMessage ? 'pb-7' : ''}`}>
      {/* Stability pill anchored top-right */}
      <span
        className={`absolute top-2 right-3 rounded-full border ${hasEValue ? 'border-danger/30' : 'border-warning/30'} bg-transparent px-2 py-0.5 ${typography.panelMeta} text-text-body leading-none`}
        data-testid="fragile-card-stability-pill"
      >
        Stability
      </span>
      <div className="flex items-center gap-2">
        <AlertTriangle className={`w-3.5 h-3.5 ${hasEValue ? 'text-danger' : 'text-warning'} flex-shrink-0`} aria-hidden="true" />
        <p className={`${typography.panelBody} text-text-body flex-1`}>{headerCopy}</p>
      </div>

      {/* Brief 5.2 Task 6 row copy structure:
            "If {source} shifts → {alt-winner, bold, stripped} could overtake"
          Single visible arrow per row (was two: visible inline + aria-hidden
          between clauses). "(Status Quo)" suffix stripped from the alt-winner
          via stripStatusQuoSuffixForDisplay so a runner-up labelled
          "Continue Without Support (Status Quo)" reads cleanly in fragility
          context. "could win" → "could overtake" unifies verb choice. */}
      {/* D11: When multiple edges share an alt-winner, show triggers as a list.
          Each edge still gets its own per-edge Review chip (per-edge focus
          preserved — the user can navigate to each relationship individually). */}
      {edges.map((edge, i) => {
        const edgeSource = stripEncodingNotation(edge.from_label)
        const edgeFocusId = edge.from_id
        return (
          <div key={`${edge.from_label}-${edge.to_label}-${i}`} className="space-y-1">
            {/* In multi-edge grouped cards, show trigger copy. In single-edge
                cards, the header already names the alt-winner so we just show
                "If {source} shifts" as the body. */}
            <div className={`flex items-baseline gap-2 flex-wrap ${typography.panelMeta} text-text-light`}>
              <span>If <span className="text-text-body">{edgeSource}</span> shifts</span>
              {!altWinnerLabel && (
                <span>{fragileEdgeConsequence({ designationsWithheld })}</span>
              )}
            </div>
            {edge.e_value != null && expertMode && (
              <ExpertBlock>
                <p className={`${typography.panelMeta} text-text-light`}>
                  {fragileEValueNote({ eValue: edge.e_value, designationsWithheld })}
                </p>
              </ExpertBlock>
            )}
            {onFocusNode && edgeFocusId && (
              <button
                type="button"
                onClick={() => onFocusNode(edgeFocusId)}
                data-testid={`fragile-review-chip-${i}`}
                className={`${typography.panelMeta} text-info border border-info/30 rounded-full px-2 py-0.5 bg-transparent hover:bg-panel-hover cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-offset-1`}
                aria-label={`Review relationship from ${edgeSource}`}
              >
                Review this relationship
              </button>
            )}
          </div>
        )
      })}

      {/* Sparkle CTA — bottom-right, matching shared pattern */}
      {onSendMessage && (
        <div className="absolute bottom-1 right-1" onClick={(e) => e.stopPropagation()}>
          <DiscussWithAiButton
            variant="secondary"
            element={{ kind: 'missing' }}
            onSend={() => openAskOlumi({
              context: 'Fragile relationships',
              draft: fragileDiscussDraft({
                edgeCount: edges.length,
                altWinnerLabel,
                fromLabel: stripEncodingNotation(edges[0].from_label),
                toLabel: stripEncodingNotation(edges[0].to_label),
                designationsWithheld,
              }),
              label: 'Discuss fragile relationships',
            })}
          />
        </div>
      )}
    </div>
  )
}
