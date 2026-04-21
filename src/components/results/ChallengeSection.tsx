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
import type { EvidenceGapItem, DriverItem } from './types'
import { DiscussWithAiButton } from '@/canvas/components/pre-analysis/DiscussWithAiButton'
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
              onSend={() => onSendMessage(ctaPrompt)}
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
              onSend={() => onSendMessage(ctaPrompt)}
            />
          </div>
        )}
      </div>
    </details>
  )
}


/* ── Fragile edge group card (grouped by source, with CTAs) ────────────── */

function FragileEdgeGroupCard({
  sourceLabel,
  edges,
  onFocusNode,
  onSendMessage,
  expertMode,
}: {
  sourceLabel: string
  edges: Array<ChallengeFragileEdge & { e_value?: number }>
  onFocusNode?: (nodeId: string) => void
  onSendMessage?: (text: string) => void
  expertMode?: boolean
}) {
  const cleanSource = stripEncodingNotation(sourceLabel)
  const hasEValue = edges.some(e => e.e_value != null)
  // Consolidated mode: empty sourceLabel means edges from mixed sources
  const consolidated = !sourceLabel
  const multiple = edges.length > 1

  return (
    <div className={`relative border border-panel-border rounded-lg px-3 py-2 pr-16 space-y-1.5 ${onSendMessage ? 'pb-7' : ''}`}>
      {/* Brief 5.2 Task 6: Stability pill anchored top-right so it reads as a
          card-level signal rather than inline with the body text. The pr-16
          above reserves space so wrapping body text doesn't overlap. */}
      <span
        className={`absolute top-2 right-3 rounded-full border ${hasEValue ? 'border-danger/30' : 'border-warning/30'} bg-transparent px-2 py-0.5 ${typography.panelMeta} text-text-body leading-none`}
        data-testid="fragile-card-stability-pill"
      >
        Stability
      </span>
      <div className="flex items-center gap-2">
        <AlertTriangle className={`w-3.5 h-3.5 ${hasEValue ? 'text-danger' : 'text-warning'} flex-shrink-0`} aria-hidden="true" />
        <p className={`${typography.panelBody} text-text-body flex-1`}>
          {consolidated
            ? <>{edges.length} fragile relationships</>
            : multiple
              ? <>{edges.length} fragile relationships from {cleanSource}</>
              : hasEValue ? 'Fragile result, verify key assumptions' : 'Fragile relationship'}
        </p>
      </div>

      {/* Brief 5.2 Task 6 row copy structure:
            "If {source} shifts → {alt-winner, bold, stripped} could overtake"
          Single visible arrow per row (was two: visible inline + aria-hidden
          between clauses). "(Status Quo)" suffix stripped from the alt-winner
          via stripStatusQuoSuffixForDisplay so a runner-up labelled
          "Continue Without Support (Status Quo)" reads cleanly in fragility
          context. "could win" → "could overtake" unifies verb choice. */}
      {edges.map((edge, i) => {
        const edgeSource = stripEncodingNotation(edge.from_label)
        const altWinner = edge.alternative_winner_label
          ? stripStatusQuoSuffixForDisplay(stripEncodingNotation(edge.alternative_winner_label))
          : null
        // Brief 5.2 follow-up (ChatGPT P1 #2): onFocusNode expects a canvas
        // node id, not a label. When PLoT omits edge.from_id the chip would
        // previously fire with from_label and silently no-op (or worse,
        // match a node whose id happens to equal the label). Use from_id
        // directly — when absent, the chip is suppressed below.
        const edgeFocusId = edge.from_id
        return (
          <div key={`${edge.from_label}-${edge.to_label}-${i}`} className="space-y-1">
            <div className={`flex items-baseline gap-2 flex-wrap ${typography.panelMeta} text-text-light`}>
              <span>
                If <span className="text-text-body">{edgeSource}</span> shifts
              </span>
              {altWinner ? (
                <>
                  <span aria-hidden="true" className="text-text-light">→</span>
                  <span className={`${typography.panelHeader} text-text-body`} data-testid="fragile-alt-winner">
                    {altWinner} could overtake
                  </span>
                </>
              ) : (
                <span>the recommendation could change</span>
              )}
            </div>
            {edge.e_value != null && expertMode && (
              <ExpertBlock>
                <p className={`${typography.panelMeta} text-text-light`}>
                  E-value {edge.e_value.toFixed(1)}: assumptions would only need to be {edge.e_value.toFixed(1)}x wrong to flip the recommendation.
                </p>
              </ExpertBlock>
            )}
            {/* Brief 5.2 Task 6c: per-row chip also renders for consolidated
                groups — removes the inconsistency where consolidated cards
                only exposed an icon-only inspector button.

                Brief 5.2 follow-up (ChatGPT P0 #2): always use the row's
                own edgeFocusId. The earlier implementation fell back to
                group-level focusId for consolidated groups, which opened
                the first edge's source for EVERY row — row 2+ chips
                focused the wrong node.

                Brief 5.2 follow-up (ChatGPT P1 #2): chip is suppressed
                when edge.from_id is absent. Passing from_label to
                onFocusNode would silently no-op in the inspector and
                mislead the user into thinking the affordance works. */}
            {onFocusNode && edgeFocusId && (
              <button
                type="button"
                onClick={() => onFocusNode(edgeFocusId)}
                data-testid={`fragile-review-chip-${i}`}
                className={`${typography.panelMeta} text-info border border-info/30 rounded-full px-2 py-0.5 bg-transparent hover:bg-panel-hover cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-offset-1`}
                aria-label={`Review ${edgeSource} in the inspector`}
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
            onSend={() => onSendMessage(
              consolidated
                ? `Are these ${edges.length} fragile relationships in my model reliable?`
                : multiple
                  ? `Are the relationships from ${cleanSource} reliable? It has ${edges.length} fragile connections.`
                  : `Is the relationship between ${cleanSource} and ${stripEncodingNotation(edges[0].to_label)} reliable?`
            )}
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
            onSend={() => onSendMessage('What baseline should I use for the success target? The current one is a default.')}
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

  // Group fragile cards by source node (from_label) for visual grouping
  const fragileBySource = mergedFragileCards.reduce<Record<string, typeof mergedFragileCards>>((acc, card) => {
    const key = card.from_label
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
          {(() => {
            const entries = Object.entries(fragileBySource)
            const allSingletons = entries.length > 1 && entries.every(([, cards]) => cards.length === 1)
            if (allSingletons) {
              return (
                <FragileEdgeGroupCard
                  key="fragile-group-consolidated"
                  sourceLabel=""
                  edges={mergedFragileCards}
                  onFocusNode={onFocusNode}
                  onSendMessage={onSendMessage}
                  expertMode={expertMode}
                />
              )
            }
            return entries.map(([sourceLabel, cards]) => (
              <FragileEdgeGroupCard
                key={`fragile-group-${sourceLabel}`}
                sourceLabel={sourceLabel}
                edges={cards}
                onFocusNode={onFocusNode}
                onSendMessage={onSendMessage}
                expertMode={expertMode}
              />
            ))
          })()}
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
