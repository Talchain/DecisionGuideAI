/**
 * DecisionPanel — Inspector for decision nodes (spec §5, v6.2 three-group layout)
 * Organisational node — no mathematical parameters.
 * Groups: Context → Options (input) → Connections
 */

import { memo, useState, useMemo } from 'react'
import { useCanvasStore } from '../../../store'
import type { NodeType } from '../../../domain/nodes'
import { NodeShapeIndicator } from '../../../nodes/NodeShapeIndicator'
import { InspectorCoaching } from '../shared/InspectorCoaching'
import { typography } from '../../../../styles/typography'
import { useNodeMutations } from '../useInspectorMutations'
import { detectBaseline } from '../../../utils/baselineDetection'
import { formatWinProbability } from '../../../utils/labelUtils'
import {
  GROUP_LABELS,
  DESCRIPTION_PLACEHOLDERS,
} from '../inspectorStrings'
import { PanelGroup } from '../shared/PanelGroup'
import { PrimaryControlCard } from '../shared/PrimaryControlCard'
import { EmptyDescriptionPrompt } from '../shared/EmptyDescriptionPrompt'
import { ConnectionRow } from '../shared/ConnectionRow'
import { TechnicalDisclosure } from '../shared/TechnicalDisclosure'
import type { InspectorPanelProps } from '../types'
import { COACHING } from '../coachingConfig'
import { DecisionAdvancedEditor } from '../editors/DecisionAdvancedEditor'

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
  const [isEditingDescription, setIsEditingDescription] = useState(false)

  // Connected options — stored with raw winProb for formatWinProbability()
  const connectedOptions = useMemo(() => {
    return edges
      .filter(e => e.source === nodeId)
      .map(e => {
        const optNode = nodes.find(n => n.id === e.target)
        if (!optNode) return null
        const kind = (optNode.type || optNode.data?.kind) as string
        if (kind !== 'option') return null
        // Cast to `unknown` (not `number`) — interventions may be V3 objects
        // ({ value, source, ... }) or plain numbers. Only the key count is read
        // here, but the type should not lie about the value shape.
        const ivs = (optNode.data as Record<string, unknown>)?.interventions as Record<string, unknown> | undefined
        const ivCount = ivs ? Object.keys(ivs).length : 0
        const label = String(optNode.data?.label ?? e.target)
        // Explicit `is_baseline` wins; regex fallback only fires when the flag is
        // absent — mirrors OptionNode.tsx / OptionPanel.tsx.
        const explicitIsBaseline = (optNode.data as { is_baseline?: boolean | null })?.is_baseline
        const isBaseline = explicitIsBaseline ?? detectBaseline(label).isBaseline
        // Raw win probability — formatted via formatWinProbability() at render.
        const rawWinProb = optionComparison && Array.isArray(optionComparison)
          ? (optionComparison as Array<{ option_id: string; win_probability?: number }>).find(o => o.option_id === e.target)?.win_probability
          : undefined
        return {
          nodeId: e.target,
          label,
          ivCount,
          isBaseline,
          winProb: typeof rawWinProb === 'number' ? rawWinProb : undefined,
        }
      })
      .filter(Boolean) as Array<{ nodeId: string; label: string; ivCount: number; isBaseline: boolean; winProb?: number }>
  }, [edges, nodes, nodeId, optionComparison])

  // Non-option connections (edges where decision is source/target and other end is not an option).
  // Options belong in the Input group; other connections (if any) go here.
  const otherConnections = useMemo(() => {
    return edges
      .filter(e => e.source === nodeId || e.target === nodeId)
      .map(e => {
        const otherId = e.source === nodeId ? e.target : e.source
        const otherNode = nodes.find(n => n.id === otherId)
        if (!otherNode) return null
        const kind = (otherNode.type || otherNode.data?.kind) as NodeType
        if (kind === 'option') return null
        return {
          edgeId: e.id,
          nodeId: otherId,
          nodeKind: kind,
          label: String(otherNode.data?.label ?? otherId),
          strength: { weight: e.data?.weight ?? 0, direction: (e.data?.direction ?? 'positive') as 'positive' | 'negative' },
        }
      })
      .filter(Boolean) as Array<{
        edgeId: string
        nodeId: string
        nodeKind: NodeType
        label: string
        strength: { weight: number; direction: 'positive' | 'negative' }
      }>
  }, [edges, nodes, nodeId])

  // Decision framing from brief data
  const briefData = (node?.data as Record<string, unknown>)?.brief as Record<string, string> | undefined

  if (!nodeId || !node) return null

  return (
    <div>
      {/* ── Context group ─────────────────────────────────────── */}
      <PanelGroup kind="context" label={GROUP_LABELS.context}>
        {description || isEditingDescription ? (
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            onBlur={() => {
              mutations.setDescription(description)
              if (!description.trim()) setIsEditingDescription(false)
            }}
            autoFocus={isEditingDescription && !description}
            placeholder={DESCRIPTION_PLACEHOLDERS.decision}
            rows={2}
            maxLength={500}
            className={`${typography.panelBody} w-full border border-panel-border rounded-lg px-2.5 py-1.5 bg-panel resize-none`}
          />
        ) : (
          <EmptyDescriptionPrompt
            placeholder={DESCRIPTION_PLACEHOLDERS.decision}
            onStartEditing={() => setIsEditingDescription(true)}
          />
        )}

        {briefData && (
          <div className="mt-2 bg-panel border border-panel-border rounded-lg p-2.5 flex gap-4 flex-wrap">
            {briefData.who && <div><div className={`${typography.panelMeta} text-text-light`}>Who decides</div><div className={typography.panelBody}>{briefData.who}</div></div>}
            {briefData.timeframe && <div><div className={`${typography.panelMeta} text-text-light`}>Timeframe</div><div className={typography.panelBody}>{briefData.timeframe}</div></div>}
            {briefData.constraint && <div><div className={`${typography.panelMeta} text-text-light`}>Key constraint</div><div className={typography.panelBody}>{briefData.constraint}</div></div>}
          </div>
        )}
      </PanelGroup>

      {/* ── Input group (options list) ────────────────────────── */}
      <PanelGroup kind="input" label={GROUP_LABELS.input}>
        <PrimaryControlCard>
          {/* Flattened option rows inside the card — dividers between rows, no inner borders */}
          {connectedOptions.map((opt, i) => (
            <div
              key={opt.nodeId}
              role="button"
              tabIndex={0}
              onClick={() => onNavigate(opt.nodeId)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigate(opt.nodeId) } }}
              className={`py-2 -mx-3 px-3 cursor-pointer hover:bg-panel-hover transition-colors ${i > 0 ? 'border-t border-panel-border' : ''}`}
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
                {isResultsMode && opt.winProb != null && (
                  <span className={`${typography.panelMeta} font-medium text-text-body tabular-nums`}>
                    {formatWinProbability(opt.winProb)}
                  </span>
                )}
              </div>
              {isResultsMode && opt.winProb != null && (
                <div className="mt-1.5">
                  <div className="flex-1 h-1 bg-panel-border rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${Math.round(opt.winProb * 100)}%`, background: 'var(--option)' }}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
          {/* "+ Add option" stub — no mutations.addOption() exists; preserves existing non-functional behaviour */}
          <button
            type="button"
            className={`${typography.panelMeta} w-full py-2 -mx-3 px-3 text-info border-t border-dashed border-panel-border hover:bg-panel-hover transition-colors`}
          >
            + Add option
          </button>
        </PrimaryControlCard>

        <InspectorCoaching
          elementId={nodeId}
          panelType="decision"
          fallbackText={COACHING.decisionOptions}
          labelContext={{ label: String(node.data?.label ?? '') }}
        />
      </PanelGroup>

      {/* ── Connections group (non-option edges) ──────────────── */}
      <PanelGroup kind="connections" label={GROUP_LABELS.connections}>
        {otherConnections.map(conn => (
          <ConnectionRow
            key={conn.edgeId}
            nodeKind={conn.nodeKind}
            label={conn.label}
            strength={conn.strength}
            fullLabel
            techMode={techMode}
            onClick={() => onNavigate(conn.nodeId)}
          />
        ))}
        {otherConnections.length === 0 && (
          <p className={`${typography.panelMeta} text-text-light`}>No connections yet.</p>
        )}
      </PanelGroup>

      {/* ── Expert-only model detail ──────────────────────────── */}
      <TechnicalDisclosure visible={techMode}>
        <DecisionAdvancedEditor nodeId={nodeId} />
      </TechnicalDisclosure>
    </div>
  )
})
