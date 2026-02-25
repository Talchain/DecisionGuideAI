/**
 * Node property inspector — 4-section accordion layout
 * B.I.4: Summary (always open), Assumptions, Appearance, Advanced
 * Brief v2.2: FactorValueEditor for observed_state editing
 */

import { memo, useState, useCallback, useRef, useEffect, useMemo } from 'react'
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
import { typography } from '../../styles/typography'
import { isGoalDefined } from '../../utils/isGoalDefined'

interface ObservedState {
  value: number
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
  const outcomeNodeId = useCanvasStore(s => s.outcomeNodeId)
  const goalThreshold = useCanvasStore(s => s.goalThreshold)
  const goalConstraints = useCanvasStore(s => s.goalConstraints)

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

  const handleTypeChange = useCallback((newType: NodeType) => {
    updateNode(nodeId, { type: newType })
  }, [nodeId, updateNode])

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
  const isAnalysisTarget = outcomeNodeId === nodeId
  const goalDefined = isGoalDefined(goalThreshold, goalConstraints)

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

      {/* Node label — read-only, 2-line max */}
      <p
        className={`${typography.panelBody} text-text-body line-clamp-2`}
        title={String(node.data?.label ?? '')}
      >
        {node.data?.label || 'Untitled'}
      </p>

      {/* B.I.5: Factor category pill — neutral styling for all categories */}
      {isFactorNode && node.data?.category && (
        <span className={`inline-flex items-center mt-1.5 px-2 py-0.5 rounded-full ${typography.panelMeta} bg-panel text-text-light border border-panel-border`}>
          {String(node.data.category)}
        </span>
      )}

      {/* KPI row: Factor current value */}
      {isFactorNode && existingObservedState?.value !== undefined && (
        <div className="flex items-center justify-between mt-2 px-2 py-1 bg-panel rounded border border-panel-border">
          <span className={`${typography.panelMeta} text-text-light`}>Current value</span>
          <span className={`${typography.panelBody} font-medium text-text-body tabular-nums`}>
            {existingObservedState.unit ? `${existingObservedState.value} ${existingObservedState.unit}` : existingObservedState.value}
          </span>
        </div>
      )}

      {/* B.I.8: Goal coaching card */}
      {isGoalNode && !goalDefined && (
        <div className="mt-2 p-2 bg-info-light border border-info/30 rounded">
          <p className={`${typography.panelMeta} text-info`}>
            Set a success threshold so analysis can compute the probability of reaching it.
          </p>
        </div>
      )}

      {/* KPI row: Goal threshold */}
      {isGoalNode && goalDefined && goalThreshold != null && (
        <div className="flex items-center justify-between mt-2 px-2 py-1 bg-panel rounded border border-panel-border">
          <span className={`${typography.panelMeta} text-text-light`}>Threshold</span>
          <span className={`${typography.panelBody} font-medium text-text-body tabular-nums`}>
            {goalThreshold}
          </span>
        </div>
      )}

      {/* B.I.9: Option Summary — intervention count or "Baseline" pill */}
      {isOptionNode && (
        <div className="mt-2">
          {optionAsUIOption && Object.keys(optionAsUIOption.interventions).length > 0 ? (
            <span className={`${typography.panelMeta} text-text-light`}>
              {Object.keys(optionAsUIOption.interventions).length} intervention{Object.keys(optionAsUIOption.interventions).length !== 1 ? 's' : ''}
            </span>
          ) : (
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full ${typography.panelMeta} bg-panel text-text-light border border-panel-border italic`}>
              Baseline
            </span>
          )}
        </div>
      )}

      {/* KPI row: Prior */}
      {node.data?.prior !== undefined && (
        <div className="flex items-center justify-between mt-2 px-2 py-1 bg-panel rounded border border-panel-border">
          <span className={`${typography.panelMeta} text-text-light`}>Prior</span>
          <span className={`${typography.panelBody} font-medium text-text-body tabular-nums`}>
            {(node.data.prior * 100).toFixed(0)}%
          </span>
        </div>
      )}
    </div>
  )

  // ─── ASSUMPTIONS ───────────────────────────────────────────────────
  const assumptionsContent = (
    <div className="space-y-4">
      {/* Title input */}
      <div>
        <label htmlFor="node-title" className={`block ${typography.panelMeta} font-medium text-text-body mb-1`}>Title</label>
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
        <label htmlFor="node-description" className={`block ${typography.panelMeta} font-medium text-text-body mb-1`}>
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

      {/* Type dropdown */}
      <div>
        <label htmlFor="node-type" className={`block ${typography.panelMeta} font-medium text-text-body mb-1`}>Type</label>
        <select
          id="node-type"
          value={currentType}
          onChange={(e) => handleTypeChange(e.target.value as NodeType)}
          className={`w-full ${typography.panelBody} border border-panel-border rounded px-2 py-1.5 bg-panel`}
          data-testid="select-node-type"
        >
          {(Object.keys(NODE_REGISTRY) as NodeType[]).map((type) => (
            <option key={type} value={type}>
              {NODE_REGISTRY[type].label}
            </option>
          ))}
        </select>
      </div>

      {/* Prior bar */}
      {node.data?.prior !== undefined && (
        <div>
          <label className={`block ${typography.panelMeta} font-medium text-text-body mb-1`}>
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
            <span className={`${typography.panelMeta} font-medium text-text-body tabular-nums w-10 text-right`}>
              {(node.data.prior * 100).toFixed(0)}%
            </span>
          </div>
        </div>
      )}

      {/* Utility bar */}
      {node.data?.utility !== undefined && (
        <div>
          <label className={`block ${typography.panelMeta} font-medium text-text-body mb-1`}>
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
            <span className={`${typography.panelMeta} font-medium text-text-body tabular-nums w-10 text-right`}>
              {node.data.utility >= 0 ? '+' : ''}{node.data.utility.toFixed(2)}
            </span>
          </div>
        </div>
      )}

      {/* B.I.8: Goal threshold editor */}
      {isGoalNode && (
        <GoalThresholdEditor />
      )}

      {/* Factor value editor */}
      {isFactorNode && (
        <div className="pt-2 border-t border-panel-border">
          <Tooltip content="Set the current and baseline values for this factor" position="right">
            <h4 className={`${typography.panelMeta} font-medium text-text-body mb-2`}>
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
            <h4 className={`${typography.panelMeta} font-medium text-text-body mb-2`}>
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
              <p className={`${typography.panelMeta} text-text-light italic`}>
                Interventions are locked while results are displayed
              </p>
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

      {/* Analysis target — only shown for goal/outcome nodes */}
      {(isGoalNode || currentType === 'outcome') && (
        <div className="flex items-center justify-between">
          <span className={`${typography.panelMeta} text-text-light`}>Analysis target</span>
          <span className={`${typography.panelMeta} text-text-body`}>{isAnalysisTarget ? 'Yes' : 'No'}</span>
        </div>
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
        testId="node-inspector"
      />
    </div>
  )
})

NodeInspector.displayName = 'NodeInspector'
