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
import { EyeOff, HelpCircle, Shield, AlertTriangle, Info } from 'lucide-react'
import { stripEncodingNotation } from './utils/cleanFactorLabel'
import type { EvidenceGapItem, DriverItem } from './types'

/** E-value entry for an edge */
export interface EdgeEValue {
  edge_id: string
  e_value: number
}

/** Fragile edge from robustness.fragile_edges */
export interface ChallengeFragileEdge {
  edge_id?: string
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

function ChallengeCard({
  item,
  onFocusNode,
  evidenceGaps,
  drivers,
}: {
  item: ActionItem
  onFocusNode?: (nodeId: string) => void
  evidenceGaps?: EvidenceGapItem[]
  drivers?: DriverItem[]
}): ReactNode {
  const hasExpandContent = item.whatCouldHappen || item.whatToDo || item.subtitle || item.affectedNodeIds

  if (!hasExpandContent) {
    return (
      <div className="border border-panel-border rounded-lg px-3 py-2">
        <p className={`${typography.panelBody} text-text-body`}>{item.title}</p>
      </div>
    )
  }

  return (
    <details className="border border-panel-border rounded-lg overflow-hidden">
      <summary className={`px-3 py-2 cursor-pointer hover:bg-panel-hover ${typography.panelBody} text-text-body list-none [&::-webkit-details-marker]:hidden flex items-center gap-2`}>
        <HelpCircle className="w-3.5 h-3.5 text-text-light flex-shrink-0" aria-hidden="true" />
        {item.title}
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
                  className="inline text-xs"
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
      </div>
    </details>
  )
}

/* ── Subgroup divider ─────────────────────────────────────────────────────── */

function SubgroupDivider({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center gap-2 mt-1">
      <span className="text-[10px] font-semibold text-text-light whitespace-nowrap">
        {label} ({count})
      </span>
      <div className="flex-1 h-px bg-panel-border" />
    </div>
  )
}

/* ── Fragile edge card (with optional E-value) ───────────────────────────── */

function FragileEdgeCard({ edge, eValue }: { edge: ChallengeFragileEdge; eValue?: number }) {
  return (
    <div className="border border-panel-border rounded-lg px-3 py-2 space-y-1.5">
      <div className="flex items-center gap-2">
        <AlertTriangle className={`w-3.5 h-3.5 ${eValue != null ? 'text-danger' : 'text-warning'} flex-shrink-0`} aria-hidden="true" />
        <p className={`${typography.panelBody} text-text-body flex-1`}>
          {eValue != null ? 'Fragile result, verify key assumptions' : 'Fragile relationship'}
        </p>
        <span className={`rounded-full border ${eValue != null ? 'border-danger/30' : 'border-warning/30'} bg-transparent px-2 py-0.5 text-[10px] font-medium text-text-body leading-none`}>
          Stability
        </span>
      </div>
      <p className={`${typography.panelMeta} text-text-light`}>
        {eValue != null
          ? <>The relationship {edge.from_label} &rarr; {edge.to_label} would only need to be {eValue.toFixed(1)}x wrong to flip the recommendation.</>
          : <>The relationship {edge.from_label} &rarr; {edge.to_label} is fragile. A shift here could change the recommendation.</>
        }
      </p>
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
        <span className="rounded-full border border-danger/30 bg-transparent px-2 py-0.5 text-[10px] font-medium text-text-body leading-none">
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

function InferenceWarningCard({ warning }: { warning: ChallengeInferenceWarning }) {
  const message = warning.message ?? `Inference warning: ${warning.code}`
  return (
    <div className="border border-panel-border rounded-lg px-3 py-2 space-y-1.5">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-3.5 h-3.5 text-warning flex-shrink-0" aria-hidden="true" />
        <p className={`${typography.panelBody} text-text-body flex-1`}>
          {message}
        </p>
        <span className="rounded-full border border-info/30 bg-transparent px-2 py-0.5 text-[10px] font-medium text-text-body leading-none">
          Scientific
        </span>
      </div>
      <p className={`${typography.panelMeta} text-info`}>
        &#9678; Discuss with AI
      </p>
    </div>
  )
}

/* ── Identifiability card ─────────────────────────────────────────────────── */

function IdentifiabilityCard() {
  return (
    <div className="border border-panel-border rounded-lg px-3 py-2 space-y-1.5">
      <div className="flex items-center gap-2">
        <Info className="w-3.5 h-3.5 text-info flex-shrink-0" aria-hidden="true" />
        <p className={`${typography.panelBody} text-text-body flex-1`}>
          The success target relies on a default baseline
        </p>
        <span className="rounded-full border border-info/30 bg-transparent px-2 py-0.5 text-[10px] font-medium text-text-body leading-none">
          Validity
        </span>
      </div>
      <p className={`${typography.panelMeta} text-text-light`}>
        Does this inadvertently anchor expectations? Consider setting an observed baseline.
      </p>
    </div>
  )
}

/* ── Main component ───────────────────────────────────────────────────────── */

export function ChallengeSection({
  biasFindings,
  preMortemItems,
  onFocusNode,
  evidenceGaps,
  drivers,
  edgeEValues,
  fragileEdges: fragileEdgesProp,
  inferenceWarnings,
  identifiabilityTag,
}: ChallengeSectionProps) {
  // ── Model structure items ──────────────────────────────────────────────
  // Merge fragile edges with E-value data per edge, sort by switch_probability, cap at 3
  const eValueMap = new Map((edgeEValues ?? []).filter(e => e.e_value < 3.0).map(e => [e.edge_id, e.e_value]))
  const mergedFragileCards = [...(fragileEdgesProp ?? [])]
    .sort((a, b) => b.switch_probability - a.switch_probability)
    .slice(0, 3)
    .map(fe => ({ ...fe, e_value: fe.edge_id ? eValueMap.get(fe.edge_id) : undefined }))
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
      {/* ── Subgroup 1: Model structure ─────────────────────────────────── */}
      {modelStructureCount > 0 && (
        <div className="space-y-2">
          <SubgroupDivider label="Model structure" count={modelStructureCount} />
          {mergedFragileCards.map((card, i) => (
            <FragileEdgeCard key={`fragile-${card.from_label}-${card.to_label}-${i}`} edge={card} eValue={card.e_value} />
          ))}
          {rootWarnings.map((warning, i) => (
            <RootNodeWarningCard key={`root-warn-${warning.affected_nodes[0] ?? i}`} warning={warning} />
          ))}
        </div>
      )}

      {/* ── Subgroup 2: Thinking patterns ──────────────────────────────── */}
      {thinkingPatternsCount > 0 && (
        <div className="space-y-2">
          <SubgroupDivider label="Thinking patterns" count={thinkingPatternsCount} />

          {/* Bias findings -- expandable cards, max 2 visible */}
          {biasFindings.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <EyeOff className="w-4 h-4 text-text-light flex-shrink-0" />
                <h4 className={`${typography.panelHeader} text-text-header`}>
                  Worth reflecting on
                </h4>
                <span className={`${typography.panelMeta} text-text-light`}>
                  {biasFindings.length}
                </span>
              </div>
              <CappedList<ActionItem>
                items={biasFindings}
                maxVisible={2}
                getKey={(item) => item.id}
                renderItem={(item) => (
                  <ChallengeCard
                    item={item}
                    onFocusNode={onFocusNode}
                    evidenceGaps={evidenceGaps}
                    drivers={drivers}
                  />
                )}
                overflowLabel={(n) => `See ${n} more`}
                expandButtonAriaLabel="Show more bias findings"
              />
            </div>
          )}

          {/* Pre-mortem -- expandable cards, max 2 visible */}
          {preMortemItems.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-1">
                <Shield className="w-4 h-4 text-danger flex-shrink-0" />
                <h4 className={`${typography.panelHeader} text-text-header`}>
                  What could go wrong
                </h4>
                <span className={`${typography.panelMeta} text-text-light`}>
                  {preMortemItems.length}
                </span>
              </div>
              <CappedList<ActionItem>
                items={preMortemItems}
                maxVisible={2}
                getKey={(item) => item.id}
                renderItem={(item) => (
                  <ChallengeCard
                    item={item}
                    onFocusNode={onFocusNode}
                    evidenceGaps={evidenceGaps}
                    drivers={drivers}
                  />
                )}
                overflowLabel={(n) => `See ${n} more`}
                expandButtonAriaLabel="Show more pre-mortem items"
              />
            </div>
          )}
        </div>
      )}

      {/* ── Subgroup 3: Scientific notes ───────────────────────────────── */}
      {scientificNotesCount > 0 && (
        <div className="space-y-2">
          <SubgroupDivider label="Scientific notes" count={scientificNotesCount} />
          {otherWarnings.map((warning, i) => (
            <InferenceWarningCard key={`warn-${warning.code}-${i}`} warning={warning} />
          ))}
          {hasIdentifiability && <IdentifiabilityCard />}
        </div>
      )}
    </div>
  )
}

export default ChallengeSection
