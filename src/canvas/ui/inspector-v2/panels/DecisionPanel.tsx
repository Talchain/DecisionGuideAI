/**
 * DecisionPanel — Inspector for decision nodes (spec §5)
 * Organisational node — no mathematical parameters.
 */

import { memo, useState, useMemo } from 'react'
import { ChevronRight } from 'lucide-react'
import { useCanvasStore } from '../../../store'
import type { NodeType } from '../../../domain/nodes'
import { NodeShapeIndicator } from '../../../nodes/NodeShapeIndicator'
import { InspectorGuidanceSection } from '../../inspector/InspectorGuidanceSection'
import { useNodeDisplayMetadata } from '../../../hooks/useNodeDisplayMetadata'
import { typography } from '../../../../styles/typography'
import { useNodeMutations } from '../useInspectorMutations'
import { detectBaseline } from '../../../utils/baselineDetection'
import { SECTION_TITLES } from '../inspectorStrings'
import { SectionTitle } from '../shared/SectionTitle'
import { CoachingCard } from '../shared/CoachingCard'
import { TechnicalDisclosure } from '../shared/TechnicalDisclosure'
import type { InspectorPanelProps } from '../types'

export const DecisionPanel = memo(function DecisionPanel({
  nodeId,
  techMode,
  onClose,
  onNavigate,
}: InspectorPanelProps) {
  const nodes = useCanvasStore(s => s.nodes)
  const edges = useCanvasStore(s => s.edges)
  const resultsStatus = useCanvasStore(s => s.results?.status)
  const isResultsMode = resultsStatus === 'complete'
  const optionComparison = useCanvasStore(s => s.results?.report?.option_comparison)

  const node = nodeId ? nodes.find(n => n.id === nodeId) : undefined
  const mutations = useNodeMutations(nodeId ?? '')

  const [description, setDescription] = useState(String(node?.data?.description ?? ''))

  // Connected options
  const connectedOptions = useMemo(() => {
    return edges
      .filter(e => e.source === nodeId)
      .map(e => {
        const optNode = nodes.find(n => n.id === e.target)
        if (!optNode) return null
        const kind = (optNode.type || optNode.data?.kind) as string
        if (kind !== 'option') return null
        const ivs = (optNode.data as Record<string, unknown>)?.interventions as Record<string, number> | undefined
        const ivCount = ivs ? Object.keys(ivs).length : 0
        const label = String(optNode.data?.label ?? e.target)
        const isBaseline = detectBaseline(label).isBaseline
        // Win probability from results
        const winPct = optionComparison && Array.isArray(optionComparison)
          ? (optionComparison as Array<{ option_id: string; win_probability?: number }>).find(o => o.option_id === e.target)?.win_probability
          : undefined
        return {
          nodeId: e.target,
          label,
          ivCount,
          isBaseline,
          winPct: typeof winPct === 'number' ? Math.round(winPct * 100) : undefined,
        }
      })
      .filter(Boolean) as Array<{ nodeId: string; label: string; ivCount: number; isBaseline: boolean; winPct?: number }>
  }, [edges, nodes, nodeId, optionComparison])

  // Decision framing from brief data
  const briefData = (node?.data as Record<string, unknown>)?.brief as Record<string, string> | undefined

  if (!nodeId || !node) return null

  return (
    <div>
      {/* Description */}
      <div className="mt-3">
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          onBlur={() => mutations.setDescription(description)}
          placeholder="What's the decision you're facing and why does it matter now?"
          rows={2}
          maxLength={500}
          className={`${typography.panelBody} w-full border border-panel-border rounded-lg px-2.5 py-1.5 bg-panel resize-none`}
        />
      </div>

      {/* §5.2 Decision framing */}
      {briefData && (
        <>
          <SectionTitle icon={SECTION_TITLES.decisionFraming.icon} label={SECTION_TITLES.decisionFraming.label} />
          <div className="bg-panel border border-panel-border rounded-lg p-2.5 flex gap-4 flex-wrap">
            {briefData.who && <div><div className={`${typography.panelMeta} text-text-light`}>Who decides</div><div className={typography.panelBody}>{briefData.who}</div></div>}
            {briefData.timeframe && <div><div className={`${typography.panelMeta} text-text-light`}>Timeframe</div><div className={typography.panelBody}>{briefData.timeframe}</div></div>}
            {briefData.constraint && <div><div className={`${typography.panelMeta} text-text-light`}>Key constraint</div><div className={typography.panelBody}>{briefData.constraint}</div></div>}
          </div>
        </>
      )}

      {/* §5.3 Options */}
      <SectionTitle icon={SECTION_TITLES.options.icon} label={SECTION_TITLES.options.label} />
      {connectedOptions.map(opt => (
        <div
          key={opt.nodeId}
          className="bg-panel border border-panel-border rounded-lg p-2.5 mb-1.5 cursor-pointer hover:bg-panel-hover transition-colors"
          onClick={() => onNavigate(opt.nodeId)}
          role="button"
          tabIndex={0}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigate(opt.nodeId) } }}
        >
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-1.5">
              <NodeShapeIndicator nodeKind="option" size={14} />
              <span className={`${typography.panelBody} font-medium`}>{opt.label}</span>
              {opt.isBaseline && (
                <span className={`${typography.panelMeta} font-medium px-2 py-0.5 rounded-full bg-transparent text-text-body border border-factor/30`}>
                  Baseline
                </span>
              )}
            </div>
            <div className="flex gap-1.5 items-center">
              <span className={`${typography.panelMeta} font-medium px-2 py-0.5 rounded-full bg-transparent text-text-body border border-factor/30`}>
                {opt.ivCount} change{opt.ivCount !== 1 ? 's' : ''}
              </span>
              <ChevronRight size={12} className="text-text-light" />
            </div>
          </div>
          {isResultsMode && opt.winPct != null && (
            <div className="flex items-center gap-2 mt-1.5">
              <div className="flex-1 h-1 bg-panel-border rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${opt.winPct}%`, background: 'var(--color-option)' }} />
              </div>
              <span className={`${typography.panelMeta} text-text-light`}>{opt.winPct}%</span>
            </div>
          )}
        </div>
      ))}
      <button
        type="button"
        className={`${typography.panelMeta} w-full py-2 rounded-lg border border-dashed border-panel-border bg-transparent text-info hover:bg-panel-hover transition-colors`}
      >
        + Add option
      </button>

      {/* Coaching */}
      <CoachingCard
        text="Consider options that pull different levers to increase differentiation."
        action={{ label: 'Ask about this', onClick: () => {} }}
      />

      {/* Guidance */}
      <InspectorGuidanceSection elementId={nodeId} />

      {/* Technical disclosure */}
      <TechnicalDisclosure visible={techMode}>
        <div>System: node_id: {nodeId}</div>
        <div>System: kind: decision</div>
        <div>System: connected_options: {connectedOptions.length}</div>
      </TechnicalDisclosure>
    </div>
  )
})
