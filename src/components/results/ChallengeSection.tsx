/**
 * ChallengeSection — "Challenge your assumptions"
 *
 * V11 Phase E: Separate section after "What to do next" containing M2
 * decision quality prompts as expandable cards. Gated on M2 data presence.
 * V12: Max 2 items per group with CappedList, affected_elements as graph links.
 *
 * Data sources:
 * - Groups 3 (bias findings) and 4 (pre-mortem) from groupActionItems
 */

import { type ReactNode } from 'react'
import { typography } from '../../styles/typography'
import type { ActionItem } from './utils/groupActionItems'
import { CappedList } from './CappedList'
import { GraphLink } from './GraphLink'
import { EyeOff, HelpCircle, Shield } from 'lucide-react'
import { stripEncodingNotation } from './utils/cleanFactorLabel'
import type { UncertaintyItem, DriverItem } from './types'

export interface ChallengeSectionProps {
  /** M2 bias findings (Group 3: "Worth reflecting on") */
  biasFindings: ActionItem[]
  /** M2 pre-mortem items (Group 4: "What could go wrong") */
  preMortemItems: ActionItem[]
  /** V12 B4: Focus handler for graph links on affected elements */
  onFocusNode?: (nodeId: string) => void
  /** V12.2: Factor lookup data for resolving IDs to labels */
  evidenceGaps?: UncertaintyItem[]
  drivers?: DriverItem[]
}

/**
 * V12.2: Resolve factor ID to display label.
 * Resolution chain:
 * 1. Evidence gaps by factorId → factorLabel
 * 2. Drivers by factorKey → factorLabel
 * 3. Strip fac_ prefix, replace underscores with spaces, title case
 */
function resolveFactorLabel(
  factorId: string,
  evidenceGaps?: UncertaintyItem[],
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
  evidenceGaps?: UncertaintyItem[]
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

export function ChallengeSection({
  biasFindings,
  preMortemItems,
  onFocusNode,
  evidenceGaps,
  drivers,
}: ChallengeSectionProps) {
  if (biasFindings.length === 0 && preMortemItems.length === 0) return null

  return (
    <div className="space-y-3" data-testid="challenge-section">
      {/* Bias findings — expandable cards, max 2 visible */}
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

      {/* Pre-mortem — expandable cards, max 2 visible */}
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
  )
}

export default ChallengeSection
