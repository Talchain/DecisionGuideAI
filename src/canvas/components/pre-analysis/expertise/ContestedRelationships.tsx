/**
 * ContestedRelationships — Subgroup 1: Edges where independent reviews disagree.
 *
 * Full interaction model: question line, pass-context tooltips on Keep/Review,
 * expandable "Why this was flagged" section, cap at 5 visible.
 */

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Pill } from '../primitives'
import { SubgroupDivider } from '../primitives/SubgroupDivider'
import Tooltip from '../../../../components/Tooltip'
import { typography } from '@/styles/typography'
import type { Edge, Node } from '@xyflow/react'
import type { ValidationMetadata } from '../../../domain/validation'

interface ContestedRelationshipsProps {
  contestedEdges: Array<{ edge: Edge; validation: unknown }>
  nodes: Node[]
  onFocusEdge?: (edgeId: string) => void
  onResolveEdge?: (edgeId: string, action: string, customMean?: number) => void
  factorInfluenceMap?: Map<string, number>
  onHoverEnter?: (type: 'node' | 'edge', id: string) => void
  onHoverLeave?: () => void
}

const MAX_VISIBLE = 5

function formatMean(mean: number): string {
  const sign = mean >= 0 ? '+' : ''
  return `${sign}${mean.toFixed(2)}`
}

function getStrengthBand(mean: number): string {
  const abs = Math.abs(mean)
  if (abs >= 0.6) return 'Very strong'
  if (abs >= 0.25) return 'Strong'
  if (abs >= 0.05) return 'Moderate'
  return 'Slight'
}

export function ContestedRelationships({
  contestedEdges,
  nodes,
  onFocusEdge,
  onResolveEdge,
  factorInfluenceMap,
  onHoverEnter,
  onHoverLeave,
}: ContestedRelationshipsProps) {
  const [showAll, setShowAll] = useState(false)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  if (contestedEdges.length === 0) return null

  const nodeMap = new Map(nodes.map(n => [n.id, n]))
  const getLabel = (id: string) =>
    (nodeMap.get(id)?.data as Record<string, unknown>)?.label as string ?? id

  const visible = showAll ? contestedEdges : contestedEdges.slice(0, MAX_VISIBLE)
  const hiddenCount = contestedEdges.length - MAX_VISIBLE

  const toggleExpanded = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="space-y-2">
      <SubgroupDivider label={`Needs your judgement (${contestedEdges.length})`} />
      {visible.map(({ edge, validation: rawVal }) => {
        const val = rawVal as ValidationMetadata | undefined
        const sourceLabel = getLabel(edge.source)
        const targetLabel = getLabel(edge.target)
        const influence = factorInfluenceMap?.get(edge.source) ?? factorInfluenceMap?.get(edge.target)
        const isDetailExpanded = expandedIds.has(edge.id)

        const pass1Mean = val?.pass1?.strength_mean
        const pass2Mean = val?.pass2?.strength_mean
        const pass1Band = pass1Mean != null ? getStrengthBand(pass1Mean) : null
        const pass2Band = pass2Mean != null ? getStrengthBand(pass2Mean) : null

        return (
          <div key={edge.id} className="px-1 py-1.5 space-y-1">
            {/* Edge label + impact pill — source shown in full, target truncates when narrow. */}
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => onFocusEdge?.(edge.id)}
                onMouseEnter={() => onHoverEnter?.('edge', edge.id)}
                onMouseLeave={() => onHoverLeave?.()}
                className={`${typography.panelBody} text-info hover:underline cursor-pointer text-left flex items-baseline gap-1 min-w-0`}
                title={`${sourceLabel} → ${targetLabel}`}
              >
                <span className="whitespace-nowrap flex-shrink-0">{sourceLabel}</span>
                <span className="text-text-light flex-shrink-0" aria-hidden="true">→</span>
                <span className="truncate min-w-0">{targetLabel}</span>
              </button>
              {influence != null && influence > 0.3 && (
                <Pill size="small" variant="warning">High impact</Pill>
              )}
              {influence != null && influence > 0.1 && influence <= 0.3 && (
                <Pill size="small" variant="default">Moderate impact</Pill>
              )}
            </div>

            {/* Reason */}
            <p className={`${typography.panelMeta} text-text-light`}>
              Our independent reviews disagree on how strong this effect is
            </p>

            {/* Question line */}
            <p className={`${typography.panelBody} text-text-body`}>
              How strongly does {sourceLabel} affect {targetLabel}?
            </p>

            {/* Context: influence */}
            {influence != null && (
              <p className={`${typography.panelMeta} text-text-light`}>
                Drives ~{Math.round(influence * 100)}% of the outcome
              </p>
            )}

            {/* Quick-select with tooltips */}
            <div className="flex items-center gap-2 flex-wrap">
              <Tooltip
                delay={300}
                content={pass1Mean != null
                  ? `Keep the first AI's estimate (${pass1Band}, ${formatMean(pass1Mean)})`
                  : "Keep the original estimate"}
              >
                <button
                  type="button"
                  onClick={() => onResolveEdge?.(edge.id, 'accepted_pass1')}
                  className={`${typography.panelMeta} text-info border border-info/30 rounded-full px-2 py-0.5 bg-transparent hover:bg-panel-hover cursor-pointer`}
                >
                  Keep original
                </button>
              </Tooltip>
              <Tooltip
                delay={300}
                content={pass2Mean != null
                  ? `Use the independent review's estimate (${pass2Band}, ${formatMean(pass2Mean)})`
                  : "Use the reviewer's estimate"}
              >
                <button
                  type="button"
                  onClick={() => onResolveEdge?.(edge.id, 'accepted_pass2')}
                  className={`${typography.panelMeta} text-info border border-info/30 rounded-full px-2 py-0.5 bg-transparent hover:bg-panel-hover cursor-pointer`}
                >
                  Use review
                </button>
              </Tooltip>
              <button
                type="button"
                onClick={() => onFocusEdge?.(edge.id)}
                className={`${typography.panelMeta} text-info border border-info/30 rounded-full px-2 py-0.5 bg-transparent hover:bg-panel-hover cursor-pointer`}
              >
                Custom
              </button>
              <button
                type="button"
                onClick={() => onResolveEdge?.(edge.id, 'dismissed')}
                className={`${typography.panelMeta} text-text-light border border-panel-border rounded-full px-2 py-0.5 bg-transparent hover:bg-panel-hover cursor-pointer`}
              >
                Skip
              </button>
            </div>

            {/* "Why this was flagged" expandable */}
            {val && (
              <button
                type="button"
                onClick={() => toggleExpanded(edge.id)}
                className={`flex items-center gap-1 ${typography.panelMeta} text-text-light hover:text-text-body cursor-pointer`}
              >
                {isDetailExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                Why this was flagged
              </button>
            )}
            {isDetailExpanded && val && (
              <div className="bg-panel-hover rounded-md px-2.5 py-[10px] leading-relaxed space-y-1">
                {pass1Mean != null && (
                  <p className={`${typography.panelMeta} text-text-light`}>
                    Original estimate: {formatMean(pass1Mean)} ({pass1Band})
                  </p>
                )}
                {pass2Mean != null && (
                  <p className={`${typography.panelMeta} text-text-light`}>
                    Review estimate: {formatMean(pass2Mean)} ({pass2Band})
                  </p>
                )}
                {pass1Mean != null && pass2Mean != null && (
                  <p className={`${typography.panelMeta} text-text-light`}>
                    Delta: {Math.abs(pass1Mean - pass2Mean).toFixed(2)}
                  </p>
                )}
                {val.pass2?.reasoning && (
                  <p className={`${typography.panelMeta} text-text-light`}>
                    Basis: {val.pass2.reasoning}
                  </p>
                )}
              </div>
            )}
          </div>
        )
      })}
      {!showAll && hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className={`${typography.panelMeta} text-info hover:underline cursor-pointer`}
        >
          +{hiddenCount} more to review
        </button>
      )}
    </div>
  )
}
