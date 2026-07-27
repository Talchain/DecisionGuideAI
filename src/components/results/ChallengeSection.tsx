/**
 * ChallengeSection — "Before you commit"
 *
 * V11 Phase E: Separate section after "Your next steps" containing M2
 * decision quality prompts as expandable cards. Gated on M2 data presence.
 * V12: Max 2 items per group with CappedList, affected_elements as graph links.
 *
 * Task 6: Restructured into 3 subgroups:
 * - Model structure (fragile edge cards enriched with E-values, root node warnings)
 * - Thinking patterns (bias findings, pre-mortem items)
 * - Scientific notes (inference warnings with CTA, identifiability advisory)
 *
 * Data sources:
 * - Groups 3 (bias findings) and 4 (pre-mortem) from groupActionItems
 * - edgeEValues, identifiabilityTag from ISL/PLoT (inference warnings
 *   moved to AdvancedSection's trust narrative)
 */

import { type ReactNode } from 'react'
import { typography } from '../../styles/typography'
import type { ActionItem } from './utils/groupActionItems'
import { CappedList } from './CappedList'
import { GraphLink } from './GraphLink'
import { HelpCircle, AlertTriangle, Info } from 'lucide-react'
import { stripEncodingNotation, stripStatusQuoSuffixForDisplay } from './utils/cleanFactorLabel'
import {
  fragileDiscussDraft,
  fragileEValueNote,
  fragileEdgeConsequence,
  fragileEdgeGroupHeader,
} from './utils/fragileEdgeCopy'
import type { EvidenceGapItem, DriverItem } from './types'
import { DiscussWithAiButton } from '@/canvas/components/pre-analysis/DiscussWithAiButton'
import { openAskOlumi } from './coaching/askOlumiStore'
import { ExpertBlock } from './ExpertBlock'

/** E-value entry for an edge */
export interface EdgeEValue {
  edge_id: string
  e_value: number
}

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

export interface ChallengeSectionProps {
  /** M2 bias findings (Group 3: "Worth reflecting on") */
  biasFindings: ActionItem[]
  /** M2 pre-mortem items (Group 4: "What could go wrong") */
  preMortemItems: ActionItem[]
  /** V12 B4: Focus handler for graph links on affected elements */
  onFocusNode?: (nodeId: string) => void
  /** Handler for sending a message to the conversation panel */
  onSendMessage?: (text: string) => void
  /** V12.2: Factor lookup data for resolving IDs to labels */
  evidenceGaps?: EvidenceGapItem[]
  drivers?: DriverItem[]
  /** Task 6: E-value data per edge — cards shown when e_value < 3.0 */
  edgeEValues?: EdgeEValue[]
  /** Fragile edges from robustness — shown in Model structure, enriched with E-values when available */
  fragileEdges?: ChallengeFragileEdge[]
  /** Task 6: Identifiability tag from ISL — shown in Scientific notes */
  identifiabilityTag?: string | null
  /** Expert mode: gates E-value raw numbers in fragile edge cards */
  expertMode?: boolean
  /**
   * ROADMAP 1.267 — `!DecisionVerdict.hasLeadingOption`, quoted from the
   * caller, never re-derived here. Threaded straight through to
   * `FragileEdgeGroupCard`, whose prose presupposed a recommendation.
   *
   * REQUIRED, not optional-defaulting-false, for the same reason
   * `StressTestSectionProps.designationsWithheld` is: an opt-in gate is a gate
   * every future call site can forget. The compiler names every call site.
   */
  designationsWithheld: boolean
}

/**
 * V12.2: Resolve factor ID to display label.
 * Resolution chain:
 * 1. Evidence gaps by factorId -> factorLabel
 * 2. Drivers by factorKey -> factorLabel
 * 3. Strip fac_ prefix, replace underscores with spaces, title case
 */
function resolveFactorLabel(
  factorId: string,
  evidenceGaps?: EvidenceGapItem[],
  drivers?: DriverItem[]
): string {
  // Look up in evidence gaps
  const gap = evidenceGaps?.find(g => g.factorId === factorId || g.targetNodeId === factorId)
  if (gap?.factorLabel) return stripEncodingNotation(gap.factorLabel)

  // Look up in drivers
  const driver = drivers?.find(d => d.factorKey === factorId || d.matchedNodeId === factorId)
  if (driver?.factorLabel) return stripEncodingNotation(driver.factorLabel)

  // Fallback: strip fac_ prefix, replace underscores with spaces, title case
  let fallback = factorId.replace(/^fac_/, '').replace(/_/g, ' ')
  fallback = fallback.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  return fallback
}

/** Task 8: Strip academic citations "(Author)" from card titles. */
function stripAcademicCitation(title: string): string {
  return title.replace(/\s*\([A-Z][a-z]+(?:\s+&\s+[A-Z][a-z]+)?\)\s*$/, '').trim()
}

function ChallengeCard({
  item,
  onFocusNode,
  onSendMessage,
  evidenceGaps,
  drivers,
}: {
  item: ActionItem
  onFocusNode?: (nodeId: string) => void
  onSendMessage?: (text: string) => void
  evidenceGaps?: EvidenceGapItem[]
  drivers?: DriverItem[]
}): ReactNode {
  const hasExpandContent = item.whatCouldHappen || item.whatToDo || item.subtitle || item.affectedNodeIds
  const cleanTitle = stripAcademicCitation(item.title)

  // Prompt for the "Explore this" CTA — prefer whatToDo, fall back to exercise prompt
  const ctaPrompt = item.whatToDo
    ? item.whatToDo
    : `Run a ${item.title} exercise on this decision`

  if (!hasExpandContent) {
    return (
      <div className={`relative border border-panel-border rounded-lg px-3 py-2 space-y-1.5 ${onSendMessage ? 'pb-7' : ''}`}>
        <p className={`${typography.panelBody} text-text-body`}>{cleanTitle}</p>
        <p className={`${typography.panelBody} text-text-light`}>
          Run this exercise to challenge the recommendation.
        </p>
        {onSendMessage && (
          <div className="absolute bottom-1 right-1" onClick={(e) => e.stopPropagation()}>
            <DiscussWithAiButton
              variant="secondary"
              element={{ kind: 'missing' }}
              onSend={() => openAskOlumi({ context: cleanTitle, draft: ctaPrompt, label: 'Explore this' })}
            />
          </div>
        )}
      </div>
    )
  }

  return (
    <details className="relative border border-panel-border rounded-lg">
      <summary className={`px-3 py-2 cursor-pointer hover:bg-panel-hover ${typography.panelBody} text-text-body list-none [&::-webkit-details-marker]:hidden flex items-center gap-2`}>
        <HelpCircle className="w-3.5 h-3.5 text-text-light flex-shrink-0" aria-hidden="true" />
        {cleanTitle}
      </summary>
      <div className={`px-3 space-y-1 ${onSendMessage ? 'pb-7' : 'pb-2'}`}>
        {/* V12 B4: Affected elements as graph links */}
        {item.affectedNodeIds && item.affectedNodeIds.length > 0 && (
          <p className={`${typography.panelMeta} text-text-body`}>
            Affects:{' '}
            {item.affectedNodeIds.map((nodeId, i) => (
              <span key={nodeId}>
                {i > 0 && ', '}
                <GraphLink
                  nodeId={nodeId}
                  label={resolveFactorLabel(nodeId, evidenceGaps, drivers)}
                  onFocus={onFocusNode}
                  className={`inline ${typography.panelBody}`}
                />
              </span>
            ))}
          </p>
        )}
        {/* Plain subtitle fallback when no affectedNodeIds */}
        {(!item.affectedNodeIds || item.affectedNodeIds.length === 0) && item.subtitle && (
          <p className={`${typography.panelMeta} text-text-body`}>{item.subtitle}</p>
        )}
        {item.whatCouldHappen && (
          <p className={`${typography.panelMeta} text-text-light italic`}>{item.whatCouldHappen}</p>
        )}
        {item.whatToDo && (
          <p className={`${typography.panelMeta} text-text-body`}>{item.whatToDo}</p>
        )}
        {onSendMessage && (
          <div className="absolute bottom-1 right-1" onClick={(e) => e.stopPropagation()}>
            <DiscussWithAiButton
              variant="secondary"
              element={{ kind: 'missing' }}
              onSend={() => openAskOlumi({ context: cleanTitle, draft: ctaPrompt, label: 'Explore this' })}
            />
          </div>
        )}
      </div>
    </details>
  )
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

/* ── Identifiability card ─────────────────────────────────────────────────── */

function IdentifiabilityCard({ onSendMessage }: { onSendMessage?: (text: string) => void }) {
  return (
    <div className={`relative border border-panel-border rounded-lg px-3 py-2 space-y-1.5 ${onSendMessage ? 'pb-7' : ''}`}>
      <div className="flex items-center gap-2">
        <Info className="w-3.5 h-3.5 text-info flex-shrink-0" aria-hidden="true" />
        <p className={`${typography.panelBody} text-text-body flex-1`}>
          The success target relies on a default baseline
        </p>
        <span className={`rounded-full border border-info/30 bg-transparent px-2 py-0.5 ${typography.panelMeta} text-text-body leading-none`}>
          Validity
        </span>
      </div>
      <p className={`${typography.panelMeta} text-text-light`}>
        Does this inadvertently anchor expectations? Consider setting an observed baseline.
      </p>
      {onSendMessage && (
        <div className="absolute bottom-1 right-1" onClick={(e) => e.stopPropagation()}>
          <DiscussWithAiButton
            variant="secondary"
            element={{ kind: 'goal', label: 'success target' }}
            onSend={() => openAskOlumi({ context: 'The success target relies on a default baseline', draft: 'What baseline should I use for the success target? The current one is a default.', label: 'Discuss the baseline' })}
          />
        </div>
      )}
    </div>
  )
}

/* ── Main component ───────────────────────────────────────────────────────── */

export function ChallengeSection({
  biasFindings,
  preMortemItems,
  onFocusNode,
  onSendMessage,
  evidenceGaps,
  drivers,
  edgeEValues,
  fragileEdges: fragileEdgesProp,
  identifiabilityTag,
  expertMode,
  designationsWithheld,
}: ChallengeSectionProps) {
  // ── Model structure items ──────────────────────────────────────────────
  // Merge fragile edges with E-value data per edge, group by source node.
  // Brief 4 Task 5: sort by marginal_switch_probability when present (matches
  // ISL sampling semantics more closely), falling back to switch_probability.
  const eValueMap = new Map((edgeEValues ?? []).filter(e => e.e_value < 3.0).map(e => [e.edge_id, e.e_value]))
  const mergedFragileCards = [...(fragileEdgesProp ?? [])]
    .sort((a, b) => {
      const aKey = a.marginal_switch_probability ?? a.switch_probability
      const bKey = b.marginal_switch_probability ?? b.switch_probability
      return bKey - aKey
    })
    .slice(0, 3)
    .map(fe => ({ ...fe, e_value: fe.edge_id ? eValueMap.get(fe.edge_id) : undefined }))

  // D11: Group fragile cards by alternative_winner_label so edges that share
  // the same alt-winner collapse into one card. Edges with no alt-winner go
  // into a fallback 'null' group. Within each group, order is preserved from
  // the sort above (highest switch probability first).
  const fragileByAltWinner = mergedFragileCards.reduce<Record<string, typeof mergedFragileCards>>((acc, card) => {
    const key = card.alternative_winner_label
      ? stripStatusQuoSuffixForDisplay(stripEncodingNotation(card.alternative_winner_label))
      : '__no_alt_winner__'
    if (!acc[key]) acc[key] = []
    acc[key].push(card)
    return acc
  }, {})
  // Brief 4 Task 12: ChallengeSection no longer renders inference warnings —
  // they now live once in ConfidenceSection's InferenceWarningCard (compact,
  // with Show-all overflow). ChallengeSection retains fragile edges,
  // bias/pre-mortem, and identifiability.
  const modelStructureCount = mergedFragileCards.length
  const thinkingPatternsCount = biasFindings.length + preMortemItems.length
  const hasIdentifiability = identifiabilityTag != null && identifiabilityTag !== ''
  const scientificNotesCount = hasIdentifiability ? 1 : 0

  if (modelStructureCount === 0 && thinkingPatternsCount === 0 && scientificNotesCount === 0) {
    return null
  }

  return (
    <div className="space-y-3" data-testid="challenge-section">
      {/* ── Model structure items (Task 8: no sub-header) ───────────────── */}
      {modelStructureCount > 0 && (
        <div className="space-y-2">
          {/* Fragile edges grouped by source node.
              When grouping by source produces only singletons (no source has 2+
              edges), consolidate into one card to avoid N identical-looking cards. */}
          {Object.entries(fragileByAltWinner).map(([altWinnerKey, cards]) => (
            <FragileEdgeGroupCard
              key={`fragile-group-${altWinnerKey}`}
              altWinnerLabel={altWinnerKey === '__no_alt_winner__' ? null : altWinnerKey}
              edges={cards}
              onFocusNode={onFocusNode}
              onSendMessage={onSendMessage}
              expertMode={expertMode}
              designationsWithheld={designationsWithheld}
            />
          ))}
        </div>
      )}

      {/* ── Thinking patterns — flat list, no sub-headers (Task 8) ──────── */}
      {thinkingPatternsCount > 0 && (
        <div className="space-y-2">
          <CappedList<ActionItem>
            items={[...biasFindings, ...preMortemItems]}
            maxVisible={4}
            getKey={(item) => item.id}
            renderItem={(item) => (
              <ChallengeCard
                item={item}
                onFocusNode={onFocusNode}
                onSendMessage={onSendMessage}
                evidenceGaps={evidenceGaps}
                drivers={drivers}
              />
            )}
            overflowLabel={(n) => `See ${n} more`}
            expandButtonAriaLabel="Show more thinking patterns"
          />
        </div>
      )}

      {/* ── Scientific notes (Task 8: no sub-header) ──────────────────── */}
      {scientificNotesCount > 0 && (
        <div className="space-y-2">
          {hasIdentifiability && <IdentifiabilityCard onSendMessage={onSendMessage} />}
        </div>
      )}
    </div>
  )
}

export default ChallengeSection
