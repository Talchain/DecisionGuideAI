/**
 * Node property inspector — 3-section accordion layout
 * B.I.4: Summary (always open), Assumptions, Advanced
 * Brief v2.2: FactorValueEditor for observed_state editing
 */

import { memo, useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { AlertTriangle, Check, Pencil } from 'lucide-react'
import { useCanvasStore } from '../store'
import { NODE_REGISTRY } from '../domain/nodes'
import type { NodeType } from '../domain/nodes'
import { renderIcon } from '../helpers/renderIcon'
import { Tooltip } from '../components/Tooltip'
import { InterventionDisplay } from '../components/InterventionDisplay'
import { UserMappingForm, NeedsMappingPrompt } from '../components/UserMappingForm'
import { normaliseOptionFromLegacyNode, type LegacyOptionNode, type UIOption } from '../../types/options'
import { InspectorAccordion } from './inspector'
import { GoalThresholdEditor } from './inspector/GoalThresholdEditor'
import { GoalProgressChecklist } from './inspector/GoalProgressChecklist'
import { InspectorGuidanceSection } from './inspector/InspectorGuidanceSection'
import { typography } from '../../styles/typography'
import { detectBaseline } from '../utils/baselineDetection'
import { useNodeDisplayMetadata } from '../hooks/useNodeDisplayMetadata'

interface ObservedState {
  value: number
  /** Raw value before normalisation (e.g. £100,000 when value is 0.2) */
  raw_value?: number
  baseline?: number
  unit?: string
  source?: string
}

interface NodeInspectorProps {
  nodeId: string
  onClose: () => void
}

export const NodeInspector = memo(({ nodeId, onClose }: NodeInspectorProps) => {
  const nodes = useCanvasStore(s => s.nodes)
  const updateNode = useCanvasStore(s => s.updateNode)
  const resultsStatus = useCanvasStore(s => s.results?.status)
  const isResultsMode = resultsStatus === 'complete'
  const goalThreshold = useCanvasStore(s => s.goalThreshold)

  // S.4: Session-only "user-reviewed" tracking
  const confirmedNodeIds = useCanvasStore(s => s.confirmedNodeIds)
  const toggleConfirmedNode = useCanvasStore(s => s.toggleConfirmedNode)
  const isConfirmed = confirmedNodeIds.has(nodeId)

  const node = nodes.find(n => n.id === nodeId)
  const [label, setLabel] = useState<string>(String(node?.data?.label ?? ''))
  const [description, setDescription] = useState<string>(String(node?.data?.description ?? ''))

  // Factor value editing
  const isFactorNode = node?.type === 'factor'
  const existingObservedState = node?.data?.observedState as ObservedState | undefined
  const [factorValue, setFactorValue] = useState<string>(
    existingObservedState?.value !== undefined ? String(existingObservedState.value) : ''
  )
  const [factorBaseline, setFactorBaseline] = useState<string>(
    existingObservedState?.baseline !== undefined ? String(existingObservedState.baseline) : ''
  )
  const [factorUnit, setFactorUnit] = useState<string>(existingObservedState?.unit ?? '')

  // Option node intervention editing
  const isOptionNode = node?.type === 'option' || node?.data?.kind === 'option'
  const [showMappingForm, setShowMappingForm] = useState(false)

  const optionAsUIOption = useMemo<UIOption | null>(() => {
    if (!isOptionNode || !node) return null
    const validNodeIds = new Set(nodes.map(n => n.id))
    return normaliseOptionFromLegacyNode(node as unknown as LegacyOptionNode, validNodeIds)
  }, [isOptionNode, node, nodes])

  const handleSaveOptionMapping = useCallback((updatedOption: UIOption) => {
    if (!node) return
    const newInterventions: Record<string, number> = {}
    for (const [nId, iv] of Object.entries(updatedOption.interventions)) {
      newInterventions[nId] = iv.value
    }
    updateNode(nodeId, {
      data: {
        ...node.data,
        interventions: newInterventions,
      }
    })
    setShowMappingForm(false)
  }, [node, nodeId, updateNode])

  const labelRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    labelRef.current?.focus()
    labelRef.current?.select()
  }, [])

  const handleLabelBlur = useCallback(() => {
    const trimmed = label.trim().slice(0, 100)
    if (trimmed && trimmed !== node?.data?.label) {
      updateNode(nodeId, { data: { ...node?.data, label: trimmed } })
    }
  }, [nodeId, label, node?.data, updateNode])

  const handleDescriptionBlur = useCallback(() => {
    const trimmed = description.trim().slice(0, 500)
    if (trimmed !== node?.data?.description) {
      updateNode(nodeId, { data: { ...node?.data, description: trimmed || undefined } })
    }
  }, [nodeId, description, node?.data, updateNode])

  const handleFactorValueUpdate = useCallback(() => {
    const value = factorValue.trim() ? parseFloat(factorValue) : undefined
    const baseline = factorBaseline.trim() ? parseFloat(factorBaseline) : undefined
    const unit = factorUnit.trim() || undefined

    if (value !== undefined && !isNaN(value)) {
      const newObservedState: ObservedState = {
        value,
        ...(baseline !== undefined && !isNaN(baseline) ? { baseline } : {}),
        ...(unit ? { unit } : {}),
      }
      updateNode(nodeId, {
        data: {
          ...node?.data,
          observedState: newObservedState,
        }
      })
    } else if (!factorValue.trim() && existingObservedState) {
      const { observedState: _, ...restData } = node?.data ?? {}
      updateNode(nodeId, { data: restData })
    }
  }, [nodeId, factorValue, factorBaseline, factorUnit, node?.data, updateNode, existingObservedState])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }, [onClose])

  if (!node) return <div className={`p-4 ${typography.panelBody} text-text-light`}>Select a node to edit its details</div>

  const currentType = (node.type || 'decision') as NodeType
  const metadata = NODE_REGISTRY[currentType] || NODE_REGISTRY.decision
  const isGoalNode = currentType === 'goal'


  // S.4: State for programmatic section opening from Edit button
  const [requestOpenSection, setRequestOpenSection] = useState<'assumptions' | null>(null)

  // S.3: Post-analysis intelligence from existing data paths (P5)
  const displayMetadata = useNodeDisplayMetadata(nodeId, currentType)
  const edges = useCanvasStore(s => s.edges)
  const robustness = useCanvasStore(s => s.results?.report?.robustness)

  // S.3 + F.5: Coaching card takes priority over insight bars (no toggle)
  // If coaching card conditions are met, show card only. Otherwise show bars automatically.
  const hasCoachingCard = isFactorNode &&
    displayMetadata.isResultsMode &&
    displayMetadata.inSensitivityAnalysis &&
    displayMetadata.influence !== null &&
    displayMetadata.confidence !== null &&
    displayMetadata.influence >= 0.7 &&
    displayMetadata.confidence < 0.5

  // F.4: Context label — find nearest meaningful parent for context line
  // Any connected node of a different kind can provide context (not just decision/goal)
  const contextNode = useMemo(() => {
    const selfType = currentType as string
    // Find an incoming edge whose source provides meaningful context
    for (const e of edges) {
      if (e.target === nodeId) {
        const src = nodes.find(n => n.id === e.source)
        if (src) {
          const srcType = (src.type || '') as string
          if (srcType && srcType !== selfType) {
            return { kind: srcType, label: String(src.data?.label ?? '') }
          }
        }
      }
    }
    // Also check outgoing edges (e.g. for options connected to a decision)
    for (const e of edges) {
      if (e.source === nodeId) {
        const tgt = nodes.find(n => n.id === e.target)
        if (tgt) {
          const tgtType = (tgt.type || '') as string
          if (tgtType && tgtType !== selfType) {
            return { kind: tgtType, label: String(tgt.data?.label ?? '') }
          }
        }
      }
    }
    return null
  }, [edges, nodes, nodeId, currentType])

  // Check if this factor is target of a fragile edge
  const isFragileTarget = useMemo(() => {
    if (!robustness?.fragile_edges || !isFactorNode) return false
    return edges.some(e =>
      e.target === nodeId && robustness.fragile_edges?.includes(e.id)
    )
  }, [robustness, edges, nodeId, isFactorNode])

  // ─── SUMMARY ───────────────────────────────────────────────────────
  const summaryContent = (
    <div className="pb-2">
      {/* Header with close button */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {renderIcon(metadata.icon, 18) ?? <span aria-hidden="true">•</span>}
          <span className={`${typography.panelHeader} text-text-header`}>{metadata.label}</span>
        </div>
        <button onClick={onClose} className="text-text-light hover:text-text-body" aria-label="Close">×</button>
      </div>

      {/* F.4: Context line — shows nearest connected node of a different kind */}
      {contextNode && (
        <p className={`${typography.panelMeta} mb-1`}>
          <span className="text-text-light">{contextNode.kind === 'decision' ? 'Decision' : contextNode.kind.charAt(0).toUpperCase() + contextNode.kind.slice(1)}: </span>
          <span className={typography.panelBody}>{contextNode.label}</span>
        </p>
      )}

      {/* Node label — read-only, 2-line max */}
      <p
        className={`${typography.panelBody} text-text-body line-clamp-2`}
        title={String(node.data?.label ?? '')}
      >
        {node.data?.label || 'Untitled'}
      </p>

      {/* S.4: Inline action row — Confirm (Factor only, P.1) + Edit */}
      <div className="flex items-center gap-1 mt-1.5" data-testid="inspector-action-row">
        {isFactorNode && (
          <button
            type="button"
            onClick={() => toggleConfirmedNode(nodeId)}
            className={`w-7 h-7 flex items-center justify-center rounded transition-colors ${
              isConfirmed
                ? 'bg-success-light text-success'
                : 'bg-transparent text-text-light hover:bg-panel-hover'
            }`}
            aria-label={isConfirmed ? 'Unmark as reviewed' : 'Mark as reviewed'}
            title={isConfirmed ? 'Reviewed' : 'Mark as reviewed'}
          >
            <Check size={14} />
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            setRequestOpenSection('assumptions')
            // Focus first editable field after accordion transition
            setTimeout(() => {
              const el = document.getElementById('node-title') || document.getElementById('factor-unit')
              el?.focus()
            }, 150)
          }}
          className="w-7 h-7 flex items-center justify-center rounded bg-transparent text-text-light hover:bg-panel-hover transition-colors"
          aria-label="Edit assumptions"
          title="Edit assumptions"
        >
          <Pencil size={14} />
        </button>
      </div>

      {/* B.I.5: Factor category pill — neutral styling for all categories */}
      {isFactorNode && node.data?.category && (
        <span className={`inline-flex items-center mt-1.5 px-2 py-0.5 rounded-full ${typography.panelMeta} bg-panel text-text-light border border-panel-border`}>
          {String(node.data.category)}
        </span>
      )}

      {/* KPI row: Factor current value — S.2: raw_value check first to prevent "0.6 %" on normalised factors */}
      {isFactorNode && existingObservedState?.value !== undefined && (
        <div className="flex items-center justify-between mt-2 px-2 py-1 bg-panel rounded border border-panel-border">
          <span className={`${typography.panelMeta} text-text-light flex items-center gap-1`}>
            Current value
            {isConfirmed && <Check size={10} className="text-success" aria-label="Reviewed" />}
          </span>
          <span className={`${typography.panelBody} text-text-body tabular-nums`}>
            {existingObservedState.raw_value != null
              ? `${existingObservedState.value} on 0\u20131 scale`
              : existingObservedState.unit && !(existingObservedState.unit === '%' && existingObservedState.value <= 1)
                ? `${existingObservedState.value} ${existingObservedState.unit}`
                : existingObservedState.value}
          </span>
        </div>
      )}

      {/* S.6: Goal progress checklist (pre-analysis) */}
      {isGoalNode && !isResultsMode && (
        <GoalProgressChecklist
          nodeId={nodeId}
          onExpandAssumptions={goalThreshold != null ? () => {
            setRequestOpenSection('assumptions')
            setTimeout(() => {
              document.getElementById('goal-threshold')?.focus()
            }, 150)
          } : () => {
            // E.4: Threshold editor is inline in Summary — just focus it
            setTimeout(() => {
              document.getElementById('goal-threshold')?.focus()
            }, 50)
          }}
        />
      )}

      {/* E.4: Goal threshold — inline editor when unset, read-only when set */}
      {isGoalNode && goalThreshold == null && (
        <div className="mt-2">
          <GoalThresholdEditor />
        </div>
      )}
      {isGoalNode && goalThreshold != null && (
        <p className={`${typography.panelBody} text-text-body mt-2`}>
          Target: \u2265 {goalThreshold}
        </p>
      )}

      {/* B.I.9: Option Summary — intervention count or baseline pill */}
      {isOptionNode && (
        <div className="mt-2">
          {optionAsUIOption && Object.keys(optionAsUIOption.interventions).length > 0 ? (
            <span className={`${typography.panelMeta} text-text-light`}>
              {Object.keys(optionAsUIOption.interventions).length} intervention{Object.keys(optionAsUIOption.interventions).length !== 1 ? 's' : ''}
            </span>
          ) : detectBaseline(String(node.data?.label ?? '')).isBaseline ? (
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full ${typography.panelMeta} bg-panel text-text-light border border-panel-border italic`}>
              Baseline
            </span>
          ) : (
            <span className={`${typography.panelMeta} text-text-light italic`}>
              No interventions
            </span>
          )}
        </div>
      )}

      {/* KPI row: Prior */}
      {node.data?.prior !== undefined && (
        <div className="flex items-center justify-between mt-2 px-2 py-1 bg-panel rounded border border-panel-border">
          <span className={`${typography.panelMeta} text-text-light`}>Prior</span>
          <span className={`${typography.panelBody} text-text-body tabular-nums`}>
            {(node.data.prior * 100).toFixed(0)}%
          </span>
        </div>
      )}

      {/* S.3: Factor post-analysis intelligence */}
      {isFactorNode && displayMetadata.isResultsMode && displayMetadata.inSensitivityAnalysis && (
        <div className="mt-3 pt-2 border-t border-panel-border">
          {/* Fragile badge */}
          {isFragileTarget && (
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full ${typography.panelMeta} bg-danger-light text-danger mb-2`}>
              Fragile link
            </span>
          )}

          {/* S.3 + F.5: Priority rule — coaching card OR insight bars, never both.
              If coaching card applies, show it alone. Otherwise show bars automatically. */}
          {hasCoachingCard ? (
            <div className={`flex items-start gap-1.5 p-2 bg-warning-light border border-warning/30 rounded ${typography.panelMeta} text-warning mb-2`}>
              <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
              <span>High influence but low confidence. Consider gathering more data to reduce uncertainty.</span>
            </div>
          ) : (
            <>
              {/* Influence bar */}
              {displayMetadata.influence !== null && (
                <div className="mb-2">
                  <div className="flex justify-between items-center mb-1">
                    <span className={`${typography.panelMeta} text-text-light flex items-center gap-1.5`}>
                      Influence
                      {displayMetadata.sensitivityRank !== null && (
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded ${typography.panelMeta} bg-warning-light text-warning`}>
                          #{displayMetadata.sensitivityRank}
                        </span>
                      )}
                    </span>
                    <span className={`${typography.panelMeta} text-text-body`}>
                      {Math.round(displayMetadata.influence * 100)}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-panel-border rounded-full overflow-hidden">
                    <div
                      className="h-full bg-info rounded-full transition-all duration-300"
                      style={{ width: `${Math.max(displayMetadata.influence * 100, 2)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Confidence bar */}
              {displayMetadata.confidence !== null && (
                <div className="mb-2">
                  <div className="flex justify-between items-center mb-1">
                    <span className={`${typography.panelMeta} text-text-light`}>Confidence</span>
                    <span className={`${typography.panelMeta} text-text-body`}>
                      {Math.round(displayMetadata.confidence * 100)}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-panel-border rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        displayMetadata.confidence < 0.5 ? 'bg-warning' : 'bg-success'
                      }`}
                      style={{ width: `${Math.max(displayMetadata.confidence * 100, 2)}%` }}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* S.3: Factor not in sensitivity analysis */}
      {isFactorNode && displayMetadata.isResultsMode && !displayMetadata.inSensitivityAnalysis && (
        <div className="mt-3 pt-2 border-t border-panel-border">
          <p className={`${typography.panelMeta} text-text-light italic`}>
            Insights not available for this factor
          </p>
        </div>
      )}

      {/* S.3: Goal post-analysis — achievement probability or stability */}
      {isGoalNode && displayMetadata.isResultsMode && (
        <div className="mt-3 pt-2 border-t border-panel-border">
          {displayMetadata.achievementProbability !== null ? (
            <div className="flex items-center justify-between px-2 py-1 bg-panel rounded border border-panel-border">
              <span className={`${typography.panelMeta} text-text-light`}>Goal probability</span>
              <span className={`${typography.panelBody} text-text-body tabular-nums`}>
                {Math.round(displayMetadata.achievementProbability * 100)}%
              </span>
            </div>
          ) : displayMetadata.stabilityPercentage !== null ? (
            <div className="flex items-center justify-between px-2 py-1 bg-panel rounded border border-panel-border">
              <span className={`${typography.panelMeta} text-text-light`}>Recommendation stability</span>
              <span className={`${typography.panelBody} text-text-body tabular-nums`}>
                {Math.round(displayMetadata.stabilityPercentage * 100)}%
              </span>
            </div>
          ) : null}
        </div>
      )}

      {/* S.3: Option post-analysis — win probability */}
      {isOptionNode && displayMetadata.isResultsMode && displayMetadata.winRate !== null && (
        <div className="mt-3 pt-2 border-t border-panel-border">
          <div className="flex items-center justify-between px-2 py-1 bg-panel rounded border border-panel-border">
            <span className={`${typography.panelMeta} text-text-light`}>Win probability</span>
            <span className={`${typography.panelBody} text-text-body tabular-nums`}>
              {Math.round(displayMetadata.winRate * 100)}%
            </span>
          </div>
        </div>
      )}

      {/* A.2: Guidance suggestions for this element */}
      <InspectorGuidanceSection elementId={nodeId} />
    </div>
  )

  // ─── ASSUMPTIONS ───────────────────────────────────────────────────
  const assumptionsContent = (
    <div className="space-y-4">
      {/* Title input */}
      <div>
        <label htmlFor="node-title" className={`block ${typography.panelMeta} text-text-body mb-1`}>Title</label>
        <input
          ref={labelRef}
          id="node-title"
          type="text"
          maxLength={100}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={handleLabelBlur}
          className={`w-full ${typography.panelBody} border border-panel-border rounded px-2 py-1`}
        />
      </div>

      {/* Description */}
      <div>
        <label htmlFor="node-description" className={`block ${typography.panelMeta} text-text-body mb-1`}>
          Note <span className="text-text-light">(optional)</span>
        </label>
        <textarea
          id="node-description"
          maxLength={500}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={handleDescriptionBlur}
          rows={3}
          className={`w-full ${typography.panelBody} border border-panel-border rounded px-2 py-1`}
          placeholder="Add a note..."
        />
      </div>

      {/* Prior bar */}
      {node.data?.prior !== undefined && (
        <div>
          <label className={`block ${typography.panelMeta} text-text-body mb-1`}>
            Prior <span className="text-text-light">(belief before evidence)</span>
          </label>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-panel-border rounded-full overflow-hidden">
              <div
                className="h-full bg-info rounded-full transition-all"
                style={{ width: `${node.data.prior * 100}%` }}
                role="progressbar"
                aria-valuenow={node.data.prior}
                aria-valuemin={0}
                aria-valuemax={1}
                aria-valuetext={`${(node.data.prior * 100).toFixed(0)}%`}
              />
            </div>
            <span className={`${typography.panelMeta} text-text-body tabular-nums w-10 text-right`}>
              {(node.data.prior * 100).toFixed(0)}%
            </span>
          </div>
        </div>
      )}

      {/* Utility bar */}
      {node.data?.utility !== undefined && (
        <div>
          <label className={`block ${typography.panelMeta} text-text-body mb-1`}>
            Utility <span className="text-text-light">(value from -1 to +1)</span>
          </label>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-panel-border rounded-full overflow-hidden relative">
              <div className="absolute inset-y-0 left-1/2 w-px bg-text-light" />
              <div
                className={`absolute inset-y-0 transition-all ${
                  node.data.utility >= 0 ? 'bg-success' : 'bg-danger'
                }`}
                style={{
                  left: node.data.utility >= 0 ? '50%' : `${50 + (node.data.utility * 50)}%`,
                  width: `${Math.abs(node.data.utility) * 50}%`
                }}
                role="meter"
                aria-valuenow={node.data.utility}
                aria-valuemin={-1}
                aria-valuemax={1}
                aria-valuetext={node.data.utility.toFixed(2)}
              />
            </div>
            <span className={`${typography.panelMeta} text-text-body tabular-nums w-10 text-right`}>
              {node.data.utility >= 0 ? '+' : ''}{node.data.utility.toFixed(2)}
            </span>
          </div>
        </div>
      )}

      {/* B.I.8 + E.4: Goal threshold editor — only in Assumptions when threshold is already set */}
      {isGoalNode && goalThreshold != null && (
        <GoalThresholdEditor />
      )}

      {/* Factor value editor */}
      {isFactorNode && (
        <div className="pt-2 border-t border-panel-border">
          <Tooltip content="Set the current and baseline values for this factor" position="right">
            <h4 className={`${typography.panelMeta} text-text-body mb-2`}>
              Current value <span className="text-text-light">(optional)</span>
            </h4>
          </Tooltip>

          <div className="flex gap-2 mb-2">
            <div className="w-16">
              <label htmlFor="factor-unit" className={`block ${typography.panelMeta} text-text-light mb-1`}>Unit</label>
              <input
                id="factor-unit"
                type="text"
                value={factorUnit}
                onChange={(e) => setFactorUnit(e.target.value)}
                onBlur={handleFactorValueUpdate}
                placeholder="e.g. £, %, users"
                className={`w-full ${typography.panelBody} border border-panel-border rounded px-2 py-1`}
                maxLength={10}
              />
            </div>
            <div className="flex-1">
              <label htmlFor="factor-value" className={`block ${typography.panelMeta} text-text-light mb-1`}>Current</label>
              <input
                id="factor-value"
                type="number"
                value={factorValue}
                onChange={(e) => setFactorValue(e.target.value)}
                onBlur={handleFactorValueUpdate}
                placeholder="59"
                className={`w-full ${typography.panelBody} border border-panel-border rounded px-2 py-1`}
                step="any"
              />
            </div>
          </div>

          <div>
            <label htmlFor="factor-baseline" className={`block ${typography.panelMeta} text-text-light mb-1`}>
              Baseline
            </label>
            <input
              id="factor-baseline"
              type="number"
              value={factorBaseline}
              onChange={(e) => setFactorBaseline(e.target.value)}
              onBlur={handleFactorValueUpdate}
              placeholder="49"
              className={`w-full ${typography.panelBody} border border-panel-border rounded px-2 py-1`}
              step="any"
            />
            {!factorBaseline.trim() && (
              <p className={`${typography.panelMeta} text-text-light mt-1`}>
                Set a baseline for change-from-baseline calculations
              </p>
            )}
          </div>
        </div>
      )}

      {/* Intervention editor for option nodes */}
      {isOptionNode && optionAsUIOption && (
        <div className="pt-2 border-t border-panel-border">
          <Tooltip content="Define what causal changes this option makes" position="right">
            <h4 className={`${typography.panelMeta} text-text-body mb-2`}>
              Interventions
            </h4>
          </Tooltip>

          {isResultsMode ? (
            <div className="space-y-2">
              <InterventionDisplay
                interventions={optionAsUIOption.interventions}
                nodes={nodes}
                compact
              />
              {/* F.6: Clear results — helper text + secondary button */}
              <p className={`${typography.panelMeta} text-text-light`}>
                Edits are paused while results are shown.
              </p>
              <button
                type="button"
                onClick={() => useCanvasStore.getState().resultsReset()}
                className={`mt-1 px-3 py-1.5 ${typography.panelBody} text-text-body rounded bg-panel hover:bg-panel-hover border border-panel-border transition-colors`}
                data-testid="btn-clear-results"
              >
                Clear results
              </button>
            </div>
          ) : showMappingForm ? (
            <UserMappingForm
              option={optionAsUIOption}
              nodes={nodes}
              onSave={handleSaveOptionMapping}
              onCancel={() => setShowMappingForm(false)}
            />
          ) : optionAsUIOption.status === 'needs_user_mapping' ? (
            <NeedsMappingPrompt
              option={optionAsUIOption}
              onConfigure={() => setShowMappingForm(true)}
            />
          ) : Object.keys(optionAsUIOption.interventions).length === 0 ? (
            <div className="space-y-2">
              {detectBaseline(String(node?.data?.label ?? '')).isBaseline ? (
                <p className={`${typography.panelMeta} text-text-light italic`}>
                  No changes — current trajectory.
                </p>
              ) : (
                <p className={`${typography.panelMeta} text-text-light`}>
                  Add interventions to define this option's strategy.
                </p>
              )}
              <button
                type="button"
                onClick={() => setShowMappingForm(true)}
                className={`${typography.panelMeta} text-info hover:underline`}
              >
                Add interventions
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <InterventionDisplay
                interventions={optionAsUIOption.interventions}
                nodes={nodes}
                compact
              />
              <button
                type="button"
                onClick={() => setShowMappingForm(true)}
                className={`${typography.panelMeta} text-info hover:underline`}
              >
                Edit interventions
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )

  // ─── ADVANCED ──────────────────────────────────────────────────────
  const advancedContent = (
    <div className="space-y-3">
      {/* Node ID */}
      <div className="flex items-center justify-between">
        <span className={`${typography.panelMeta} text-text-light`}>Node ID</span>
        <code className={`${typography.code} text-text-light select-all`}>{nodeId}</code>
      </div>

      {/* Kind (from CEE) */}
      {node.data?.kind && (
        <div className="flex items-center justify-between">
          <span className={`${typography.panelMeta} text-text-light`}>Kind</span>
          <span className={`${typography.panelMeta} text-text-body`}>{String(node.data.kind)}</span>
        </div>
      )}

      {/* Type (read-only) */}
      <div className="flex items-center justify-between">
        <span className={`${typography.panelMeta} text-text-light`}>Type</span>
        <span className={`${typography.panelMeta} text-text-body`} data-testid="read-only-node-type">{metadata.label}</span>
      </div>

      {/* E.6: Analysis goal pill — only for goal/outcome nodes */}
      {(isGoalNode || currentType === 'outcome') && (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full ${typography.panelMeta} bg-info-light text-info`}>
          Analysis goal
        </span>
      )}
    </div>
  )

  return (
    <div className="p-4 border-t border-panel-border" onKeyDown={handleKeyDown} role="region" aria-label="Node properties">
      <InspectorAccordion
        summary={summaryContent}
        assumptions={assumptionsContent}
        advanced={advancedContent}
        defaultOpen="assumptions"
        requestOpenSection={requestOpenSection}
        testId="node-inspector"
      />
    </div>
  )
})

NodeInspector.displayName = 'NodeInspector'
