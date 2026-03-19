/**
 * StrengthenSection — actionable evidence gap list.
 *
 * Shows three sub-lists:
 *   1. Constraint warnings (from PLoT critique)
 *   2. Fragile edges (post-analysis, sorted by switchProbability desc)
 *   3. Missing evidence (factors without source + non-fragile edges without provenance)
 *
 * Also shows a defaulted-edge warning when many edges use AI defaults.
 * When everything is covered, shows "All edges have supporting evidence."
 */

import { useMemo } from 'react'
import type { Node, Edge } from '@xyflow/react'
import { AlertTriangle, Lightbulb, Link } from 'lucide-react'
import { typography } from '../../../styles/typography'
import { SectionErrorBoundary } from '../GraphTextView'
import { focusNodeById, focusEdgeById } from '../../utils/focusHelpers'
import { getDisplayEdgeId } from '../../utils/edgeIdentity'
import { NON_EVIDENCE_PROVENANCE } from '../../utils/evidenceCoverage'
import type { CritiqueItemV1 } from '../../../adapters/plot/types'

interface StrengthenSectionProps {
  nodes: Node[]
  causalEdges: Edge[]
  fragileEdgeIds: Set<string>
  fragileEdgeSwitchProbMap: Map<string, number>
  hasRobustnessData: boolean
  critique?: CritiqueItemV1[] | null
}

const CONSTRAINT_CRITIQUE_CODES = [
  'MISSING_BASELINE',
  'CONSTRAINT_NO_BASELINE',
  'CONSTRAINT_INTERCEPT_DEFAULT',
  'constraint_missing_baseline',
  'CONSTRAINT_TARGET_NO_OBSERVED_VALUE',
]

function StrengthenSectionInner({
  nodes,
  causalEdges,
  fragileEdgeIds,
  fragileEdgeSwitchProbMap,
  hasRobustnessData,
  critique,
}: StrengthenSectionProps) {
  const defaultedEdgeCount = useMemo(() => {
    return causalEdges.filter(e => {
      const d = e.data as Record<string, unknown>
      const w = d?.weight as number | undefined
      const std = (d?.strengthStd ?? d?.strength_std) as number | undefined
      return w !== undefined && Math.abs(w - 0.5) < 0.01 && std !== undefined && Math.abs(std - 0.125) < 0.01
    }).length
  }, [causalEdges])

  const constraintWarnings = useMemo(() => {
    if (!critique?.length) return []
    return critique.filter(c =>
      CONSTRAINT_CRITIQUE_CODES.some(code => c.code?.toUpperCase().includes(code.toUpperCase())) ||
      (c.message?.toLowerCase().includes('constraint') && c.message?.toLowerCase().includes('baseline'))
    )
  }, [critique])

  const factorsTrulyMissingSourceList = useMemo(() => {
    return nodes.filter(n => {
      const kind = (n.type ?? (n.data as Record<string, unknown>)?.kind) as string | undefined
      if (kind !== 'factor') return false
      const obs = (n.data as Record<string, unknown>)?.observedState ?? (n.data as Record<string, unknown>)?.observed_state
      return !(obs as Record<string, unknown>)?.source
    })
  }, [nodes])

  const fragileSortedEdges = useMemo(() => {
    return [...fragileEdgeIds].map(rfId => {
      const edge = causalEdges.find(e => getDisplayEdgeId(e) === rfId)
      const switchProb = fragileEdgeSwitchProbMap.get(rfId) ?? 0
      return { edge, rfId, switchProb }
    }).filter((x): x is { edge: Edge; rfId: string; switchProb: number } => x.edge !== undefined)
      .sort((a, b) => b.switchProb - a.switchProb)
  }, [fragileEdgeIds, causalEdges, fragileEdgeSwitchProbMap])

  const edgesWithoutEvidence = useMemo(() => {
    return causalEdges.filter(edge => {
      const provenance = (edge.data as Record<string, unknown>)?.provenance as string | undefined
      return !provenance || NON_EVIDENCE_PROVENANCE.includes(provenance)
    })
  }, [causalEdges])

  const nonFragileEdgesWithoutEvidence = useMemo(() => {
    return edgesWithoutEvidence.filter(e => !fragileEdgeIds.has(getDisplayEdgeId(e)))
  }, [edgesWithoutEvidence, fragileEdgeIds])

  const showDefaultedWarning = defaultedEdgeCount > 2

  return (
    <div id="model-strengthen" className="border-t border-panel-border pt-3" data-testid="model-strengthen-section">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2" data-testid="section-header-strengthen">
        <span className="w-4 h-4 shrink-0 text-info" aria-hidden="true">
          <Lightbulb className="w-4 h-4" />
        </span>
        <span className={`${typography.panelHeader} text-text-header`}>Strengthen</span>
      </div>
      <div className={`${typography.panelMeta} text-text-light mb-3`}>
        Improve your model with evidence and refinements
      </div>

      {showDefaultedWarning && (
        <div
          className={`${typography.panelBody} text-text-body mb-3 px-2 py-2 bg-panel rounded border border-warning/30`}
          data-testid="model-defaulted-warning"
        >
          {defaultedEdgeCount} edge{defaultedEdgeCount !== 1 ? 's' : ''} use default AI-generated parameters. Adding evidence to these edges will have the greatest impact on analysis reliability.
        </div>
      )}

      {/* Constraint warnings */}
      {constraintWarnings.length > 0 && (
        <div className="mb-3" data-testid="strengthen-constraint-warnings">
          <div className={`${typography.panelMeta} text-text-light mb-1`}>
            Needs attention ({constraintWarnings.length})
          </div>
          <div className="space-y-1">
            {constraintWarnings.map((c, i) => {
              const factorNode = c.node_id ? nodes.find(n => n.id === c.node_id) : undefined
              const factorLabel = factorNode
                ? String((factorNode.data as Record<string, unknown>)?.label ?? c.node_id)
                : (c.node_id ?? 'Unknown factor')
              return (
                <div
                  key={c.code ?? i}
                  className="flex items-center gap-2 p-1.5 bg-panel border border-panel-border rounded-sm"
                  data-testid={`strengthen-constraint-${c.code ?? i}`}
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-danger shrink-0" aria-hidden="true" />
                  <span className={`${typography.panelBody} text-text-header flex-1 min-w-0`}>
                    {factorLabel} has a constraint but no baseline value — add an estimate
                  </span>
                  {c.node_id && (
                    <button
                      type="button"
                      onClick={() => focusNodeById(c.node_id!)}
                      className={`inline-flex items-center px-3 py-1 rounded-full bg-transparent border border-warning/30 text-text-body ${typography.panelMeta} font-medium hover:bg-panel-hover transition-colors shrink-0`}
                    >
                      Add estimate
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Fragile edges */}
      {hasRobustnessData && fragileSortedEdges.length > 0 && (
        <div className="mb-3" data-testid="strengthen-fragile-edges">
          <div className={`${typography.panelMeta} text-text-light mb-1`}>
            Fragile edges ({fragileSortedEdges.length})
          </div>
          <div className="space-y-1">
            {fragileSortedEdges.map(({ edge, rfId, switchProb }) => {
              const srcNode = nodes.find(n => n.id === edge.source)
              const tgtNode = nodes.find(n => n.id === edge.target)
              const edgeLabel = srcNode && tgtNode
                ? `${String((srcNode.data as Record<string, unknown>)?.label ?? edge.source)} → ${String((tgtNode.data as Record<string, unknown>)?.label ?? edge.target)}`
                : rfId
              return (
                <div
                  key={rfId}
                  className="flex items-center gap-2 p-1.5 bg-panel border border-panel-border rounded-sm"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-warning shrink-0" aria-hidden="true" />
                  <span className={`${typography.panelBody} text-text-header flex-1 min-w-0 truncate`}>
                    {edgeLabel}
                  </span>
                  {switchProb > 0 && (
                    <span className={`${typography.panelMeta} text-warning shrink-0`}>
                      {Math.round(switchProb * 100)}%
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => focusEdgeById(rfId)}
                    className={`inline-flex items-center px-3 py-1 rounded-full bg-transparent border border-info/30 text-text-body ${typography.panelMeta} font-medium hover:bg-panel-hover transition-colors shrink-0`}
                  >
                    Add evidence
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Missing evidence */}
      {(factorsTrulyMissingSourceList.length > 0 || nonFragileEdgesWithoutEvidence.length > 0) ? (
        <div data-testid="strengthen-missing-evidence">
          <div className={`${typography.panelMeta} text-text-light mb-1`}>
            Missing evidence ({factorsTrulyMissingSourceList.length + nonFragileEdgesWithoutEvidence.length})
          </div>
          <div className="space-y-1">
            {factorsTrulyMissingSourceList.map(n => {
              const lbl = String((n.data as Record<string, unknown>)?.label ?? n.id)
              return (
                <div
                  key={n.id}
                  className="flex items-center gap-2 p-1.5 bg-panel border border-panel-border rounded-sm"
                >
                  <Link className="w-3.5 h-3.5 text-text-light shrink-0" aria-hidden="true" />
                  <span className={`${typography.panelBody} text-text-header flex-1 min-w-0 truncate`}>
                    {lbl}
                  </span>
                  <button
                    type="button"
                    onClick={() => focusNodeById(n.id)}
                    className={`inline-flex items-center px-3 py-1 rounded-full bg-transparent border border-info/30 text-text-body ${typography.panelMeta} font-medium hover:bg-panel-hover transition-colors shrink-0`}
                  >
                    Add source
                  </button>
                </div>
              )
            })}
            {nonFragileEdgesWithoutEvidence.slice(0, 5).map(edge => {
              const edgeId = getDisplayEdgeId(edge)
              const srcNode = nodes.find(n => n.id === edge.source)
              const tgtNode = nodes.find(n => n.id === edge.target)
              const edgeLabel = srcNode && tgtNode
                ? `${String((srcNode.data as Record<string, unknown>)?.label ?? edge.source)} → ${String((tgtNode.data as Record<string, unknown>)?.label ?? edge.target)}`
                : edgeId
              return (
                <div
                  key={edgeId}
                  className="flex items-center gap-2 p-1.5 bg-panel border border-panel-border rounded-sm"
                >
                  <Link className="w-3.5 h-3.5 text-text-light shrink-0" aria-hidden="true" />
                  <span className={`${typography.panelBody} text-text-header flex-1 min-w-0 truncate`}>
                    {edgeLabel}
                  </span>
                  <button
                    type="button"
                    onClick={() => focusEdgeById(edgeId)}
                    className={`inline-flex items-center px-3 py-1 rounded-full bg-transparent border border-info/30 text-text-body ${typography.panelMeta} font-medium hover:bg-panel-hover transition-colors shrink-0`}
                  >
                    Add evidence
                  </button>
                </div>
              )
            })}
            {nonFragileEdgesWithoutEvidence.length > 5 && (
              <p className={`${typography.panelMeta} text-text-light pl-1`}>
                +{nonFragileEdgesWithoutEvidence.length - 5} more edges without evidence
              </p>
            )}
          </div>
          {nonFragileEdgesWithoutEvidence.length === causalEdges.length && causalEdges.length > 0 && (
            <div className={`${typography.panelBody} text-text-body bg-panel-hover rounded-sm px-2.5 py-2 mt-2.5 leading-relaxed`}>
              All edges currently rely on AI-generated parameters. Adding evidence to fragile edges first will have the greatest impact on analysis reliability.
            </div>
          )}
        </div>
      ) : (
        constraintWarnings.length === 0 && fragileSortedEdges.length === 0 && (
          <p className={`${typography.panelBody} text-text-light`}>
            All edges have supporting evidence.
          </p>
        )
      )}
    </div>
  )
}

export function StrengthenSection(props: StrengthenSectionProps) {
  return (
    <SectionErrorBoundary section="strengthen">
      <StrengthenSectionInner {...props} />
    </SectionErrorBoundary>
  )
}
