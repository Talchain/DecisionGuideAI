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
 * - edgeEValues, inferenceWarnings, identifiabilityTag from ISL/PLoT
 */

import { type ReactNode } from 'react'
import { typography } from '../../styles/typography'
import type { ActionItem } from './utils/groupActionItems'
import { CappedList } from './CappedList'
import { GraphLink } from './GraphLink'
import { HelpCircle, AlertTriangle, Info, PanelRight } from 'lucide-react'
import { stripEncodingNotation } from './utils/cleanFactorLabel'
import type { EvidenceGapItem, DriverItem } from './types'
import { DiscussWithAiButton } from '@/canvas/components/pre-analysis/DiscussWithAiButton'
import Tooltip from '../Tooltip'
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
}

/** Inference warning from ISL */
export interface ChallengeInferenceWarning {
  code: string
  affected_nodes: string[]
  affected_labels?: string[]
  message?: string
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
  /** Task 6: Inference warnings (root node defaults, etc.) */
  inferenceWarnings?: ChallengeInferenceWarning[]
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
      <div className="border border-panel-border rounded-lg px-3 py-2 space-y-1.5">
        <p className={`${typography.panelBody} text-text-body`}>{cleanTitle}</p>
        <p className={`${typography.panelBody} text-text-light`}>
          Run this exercise to challenge the recommendation.
        </p>
        {onSendMessage && (
          <DiscussWithAiButton
            element={{ kind: 'missing' }}
            onSend={() => onSendMessage(ctaPrompt)}
          />
        )}
      </div>
    )
  }

  return (
    <details className="border border-panel-border rounded-lg overflow-hidden">
      <summary className={`px-3 py-2 cursor-pointer hover:bg-panel-hover ${typography.panelBody} text-text-body list-none [&::-webkit-details-marker]:hidden flex items-center gap-2`}>
        <HelpCircle className="w-3.5 h-3.5 text-text-light flex-shrink-0" aria-hidden="true" />
        {cleanTitle}
      </summary>
      <div className="px-3 pb-2 space-y-1">
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
          <DiscussWithAiButton
            element={{ kind: 'missing' }}
            onSend={() => onSendMessage(ctaPrompt)}
          />
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
  const hasEValue = expertMode && edges.some(e => e.e_value != null)
  // Consolidated mode: empty sourceLabel means edges from mixed sources
  const consolidated = !sourceLabel
  const multiple = edges.length > 1
  const focusId = edges[0].from_id ?? edges[0].from_label

  return (
    <div className="border border-panel-border rounded-lg px-3 py-2 space-y-1.5">
      <div className="flex items-center gap-2">
        <AlertTriangle className={`w-3.5 h-3.5 ${hasEValue ? 'text-danger' : 'text-warning'} flex-shrink-0`} aria-hidden="true" />
        <p className={`${typography.panelBody} text-text-body flex-1`}>
          {consolidated
            ? <>{edges.length} fragile relationships</>
            : multiple
              ? <>{edges.length} fragile relationships from {cleanSource}</>
              : hasEValue ? 'Fragile result, verify key assumptions' : 'Fragile relationship'}
        </p>
        <span className={`rounded-full border ${hasEValue ? 'border-danger/30' : 'border-warning/30'} bg-transparent px-2 py-0.5 ${typography.panelMeta} text-text-body leading-none`}>
          Stability
        </span>
      </div>

      {/* Edge target list */}
      {edges.map((edge, i) => {
        const edgeSource = stripEncodingNotation(edge.from_label)
        const edgeTarget = stripEncodingNotation(edge.to_label)
        return (
          <div key={`${edge.from_label}-${edge.to_label}-${i}`}>
            <p className={`${typography.panelMeta} text-text-light`}>
              {consolidated
                ? <>{edgeSource} &rarr; {edgeTarget}: </>
                : multiple
                  ? <>&rarr; {edgeTarget}: </>
                  : <>{cleanSource} &rarr; {edgeTarget}: </>
              }
              {consolidated || multiple
                ? <>a shift could change the recommendation.</>
                : <>is fragile. A shift could change the recommendation.</>
              }
            </p>
            {edge.e_value != null && expertMode && (
              <ExpertBlock>
                <p className={`${typography.panelMeta} text-text-light`}>
                  E-value: {edge.e_value.toFixed(1)} — assumptions would only need to be {edge.e_value.toFixed(1)}x wrong to flip the recommendation.
                </p>
              </ExpertBlock>
            )}
          </div>
        )
      })}

      {/* CTA icons */}
      <div className="flex items-center gap-1 pt-0.5">
        {onFocusNode && !consolidated && (
          <Tooltip content="Open in inspector" delay={200}>
            <button
              type="button"
              onClick={() => onFocusNode(focusId)}
              aria-label="Open in inspector"
              className="inline-flex items-center justify-center w-6 h-6 rounded-full text-text-light hover:text-info focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info/40 transition-colors"
            >
              <PanelRight size={14} aria-hidden="true" />
            </button>
          </Tooltip>
        )}
        {onSendMessage && (
          <DiscussWithAiButton
            element={{ kind: 'missing' }}
            onSend={() => onSendMessage(
              consolidated
                ? `Are these ${edges.length} fragile relationships in my model reliable?`
                : multiple
                  ? `Are the relationships from ${cleanSource} reliable? It has ${edges.length} fragile connections.`
                  : `Is the relationship between ${cleanSource} and ${stripEncodingNotation(edges[0].to_label)} reliable?`
            )}
          />
        )}
      </div>
    </div>
  )
}

/* ── Root node warning card ───────────────────────────────────────────────── */

function RootNodeWarningCard({ warning }: { warning: ChallengeInferenceWarning }) {
  const label = warning.affected_labels?.[0] ?? warning.affected_nodes[0] ?? 'Unknown node'
  return (
    <div className="border border-panel-border rounded-lg px-3 py-2 space-y-1.5">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-3.5 h-3.5 text-danger flex-shrink-0" aria-hidden="true" />
        <p className={`${typography.panelBody} text-text-body flex-1`}>
          Root node using default value
        </p>
        <span className={`rounded-full border border-danger/30 bg-transparent px-2 py-0.5 ${typography.panelMeta} text-text-body leading-none`}>
          Validity
        </span>
      </div>
      <p className={`${typography.panelMeta} text-text-light`}>
        {label} has no value set. The analysis used 0.0 as a default, reducing overall confidence.
      </p>
    </div>
  )
}

/* ── Generic inference warning card (Scientific notes) ────────────────────── */

function InferenceWarningCard({
  warning,
  onSendMessage,
}: {
  warning: ChallengeInferenceWarning
  onSendMessage?: (text: string) => void
}) {
  const message = warning.message ?? `Inference warning: ${warning.code}`
  return (
    <div className="border border-panel-border rounded-lg px-3 py-2 space-y-1.5">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-3.5 h-3.5 text-warning flex-shrink-0" aria-hidden="true" />
        <p className={`${typography.panelBody} text-text-body flex-1`}>
          {message}
        </p>
        <span className={`rounded-full border border-info/30 bg-transparent px-2 py-0.5 ${typography.panelMeta} text-text-body leading-none`}>
          Scientific
        </span>
      </div>
      {onSendMessage && (
        <DiscussWithAiButton
          element={{ kind: 'missing' }}
          onSend={() => onSendMessage(`Can you explain this inference warning: ${message}`)}
        />
      )}
    </div>
  )
}

/* ── Identifiability card ─────────────────────────────────────────────────── */

function IdentifiabilityCard({ onSendMessage }: { onSendMessage?: (text: string) => void }) {
  return (
    <div className="border border-panel-border rounded-lg px-3 py-2 space-y-1.5">
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
        <DiscussWithAiButton
          element={{ kind: 'goal', label: 'success target' }}
          onSend={() => onSendMessage('What baseline should I use for the success target? The current one is a default.')}
        />
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
  inferenceWarnings,
  identifiabilityTag,
  expertMode,
}: ChallengeSectionProps) {
  // ── Model structure items ──────────────────────────────────────────────
  // Merge fragile edges with E-value data per edge, group by source node, sort by switch_probability, cap at 3
  const eValueMap = new Map((edgeEValues ?? []).filter(e => e.e_value < 3.0).map(e => [e.edge_id, e.e_value]))
  const mergedFragileCards = [...(fragileEdgesProp ?? [])]
    .sort((a, b) => b.switch_probability - a.switch_probability)
    .slice(0, 3)
    .map(fe => ({ ...fe, e_value: fe.edge_id ? eValueMap.get(fe.edge_id) : undefined }))

  // Group fragile cards by source node (from_label) for visual grouping
  const fragileBySource = mergedFragileCards.reduce<Record<string, typeof mergedFragileCards>>((acc, card) => {
    const key = card.from_label
    if (!acc[key]) acc[key] = []
    acc[key].push(card)
    return acc
  }, {})
  const allWarnings = inferenceWarnings ?? []
  const rootWarnings = allWarnings.filter(w => w.code === 'MISSING_ROOT_VALUE')
  const modelStructureCount = mergedFragileCards.length + rootWarnings.length

  // ── Thinking patterns items ────────────────────────────────────────────
  const thinkingPatternsCount = biasFindings.length + preMortemItems.length

  // ── Scientific notes items ─────────────────────────────────────────────
  // Warnings not handled by Model structure go to Scientific notes
  const otherWarnings = allWarnings.filter(w => w.code !== 'MISSING_ROOT_VALUE')
  const hasIdentifiability = identifiabilityTag != null && identifiabilityTag !== ''
  const scientificNotesCount = otherWarnings.length + (hasIdentifiability ? 1 : 0)

  // If all 3 subgroups empty, parent accordion handles hiding
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
          {rootWarnings.map((warning, i) => (
            <RootNodeWarningCard key={`root-warn-${warning.affected_nodes[0] ?? i}`} warning={warning} onSendMessage={onSendMessage} />
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
          {otherWarnings.map((warning, i) => (
            <InferenceWarningCard key={`warn-${warning.code}-${i}`} warning={warning} onSendMessage={onSendMessage} />
          ))}
          {hasIdentifiability && <IdentifiabilityCard onSendMessage={onSendMessage} />}
        </div>
      )}
    </div>
  )
}

export default ChallengeSection
