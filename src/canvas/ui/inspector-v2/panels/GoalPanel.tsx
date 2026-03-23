/**
 * GoalPanel — Inspector panel for goal nodes (spec §4)
 * Phase 2 priority.
 */

import { memo, useState, useMemo, useCallback } from 'react'
import { useCanvasStore } from '../../../store'
import { InspectorGuidanceSection } from '../../inspector/InspectorGuidanceSection'
import { GoalThresholdEditor } from '../../inspector/GoalThresholdEditor'
import { GoalProgressChecklist } from '../../inspector/GoalProgressChecklist'
import { useNodeDisplayMetadata } from '../../../hooks/useNodeDisplayMetadata'
import { typography } from '../../../../styles/typography'
import { useNodeMutations } from '../useInspectorMutations'
import { useStaleGuard } from '../useStaleGuard'
import { getEdgeConfidence } from '../../../domain/edges'
import type { NodeType } from '../../../domain/nodes'
import { SECTION_TITLES } from '../inspectorStrings'
import { SectionTitle } from '../shared/SectionTitle'
import { CoachingCard } from '../shared/CoachingCard'
import { StaleGuardBanner } from '../shared/StaleGuardBanner'
import { TechnicalDisclosure } from '../shared/TechnicalDisclosure'
import { ConnectionRow } from '../shared/ConnectionRow'
import { ProbabilityArc } from '../shared/ProbabilityArc'
import { DataBar } from '../../shared/DataBar'
import type { InspectorPanelProps } from '../types'
import type { CEEGoalConstraint } from '../../../../adapters/cee/types'
import type { ConditionalProbability } from '../../../../types/constraints'
import { COACHING } from '../coachingConfig'

export const GoalPanel = memo(function GoalPanel({
  nodeId,
  techMode,
  onClose,
  onNavigate,
}: InspectorPanelProps) {
  const nodes = useCanvasStore(s => s.nodes)
  const edges = useCanvasStore(s => s.edges)
  const resultsStatus = useCanvasStore(s => s.results?.status)
  const isResultsMode = resultsStatus === 'complete'
  const goalThreshold = useCanvasStore(s => s.goalThreshold)
  const probGoal = useCanvasStore(s => s.results?.report?.probability_of_goal)
  const probJoint = useCanvasStore(s => s.results?.report?.probability_of_joint_goal)
  const postAnalysisConstraints = useCanvasStore(s => (s.results?.report as any)?.goal_constraints as Array<CEEGoalConstraint & { probability?: number }> | null | undefined)
  const conditionalProbabilities = useCanvasStore(s => (s.results?.report as any)?.conditional_probabilities as ConditionalProbability[] | null | undefined)
  const preAnalysisConstraints = useCanvasStore(s => s.goalConstraints)
  const setGoalConstraints = useCanvasStore(s => s.setGoalConstraints)
  // Prefer post-analysis (has probability scores) over pre-analysis preview
  const goalConstraints: Array<CEEGoalConstraint & { probability?: number }> | null =
    isResultsMode ? (postAnalysisConstraints ?? preAnalysisConstraints) : preAnalysisConstraints

  const node = nodeId ? nodes.find(n => n.id === nodeId) : undefined
  const mutations = useNodeMutations(nodeId ?? '')
  const { isStale } = useStaleGuard()
  const displayMetadata = useNodeDisplayMetadata(nodeId ?? '', 'goal')

  const thresholdUnit = (node?.data as Record<string, unknown>)?.goal_threshold_unit as string | undefined
  const thresholdRaw = (node?.data as Record<string, unknown>)?.goal_threshold_raw as string | number | null | undefined
  const [description, setDescription] = useState(String(node?.data?.description ?? ''))

  // B.5: Add constraint form state
  const [showAddConstraint, setShowAddConstraint] = useState(false)
  const [newConstraintLabel, setNewConstraintLabel] = useState('')
  const [newConstraintOperator, setNewConstraintOperator] = useState<'>=' | '<=' | '='>('>=')
  const [newConstraintValue, setNewConstraintValue] = useState('')
  const [constraintError, setConstraintError] = useState('')

  // Factor nodes for the constraint target dropdown
  const factorNodes = useMemo(() =>
    nodes.filter(n => n.type === 'factor').map(n => ({
      id: n.id,
      label: String(n.data?.label ?? n.id),
    })),
  [nodes])

  // Already-constrained factor labels (case-insensitive)
  const constrainedLabels = useMemo(() => {
    if (!goalConstraints?.length) return new Set<string>()
    return new Set(goalConstraints.map(c => c.label.toLowerCase().trim()))
  }, [goalConstraints])

  const handleAddConstraint = useCallback(() => {
    const value = parseFloat(newConstraintValue)
    if (!newConstraintLabel) {
      setConstraintError('Select a factor')
      return
    }
    if (Number.isNaN(value)) {
      setConstraintError('Enter a valid number')
      return
    }
    const base = preAnalysisConstraints ?? []
    const newConstraint: CEEGoalConstraint = {
      id: `c${base.length + 1}`,
      label: newConstraintLabel,
      operator: newConstraintOperator,
      value,
    }
    setGoalConstraints([...base, newConstraint])
    setShowAddConstraint(false)
    setNewConstraintLabel('')
    setNewConstraintOperator('>=')
    setNewConstraintValue('')
    setConstraintError('')
  }, [newConstraintLabel, newConstraintOperator, newConstraintValue, preAnalysisConstraints, setGoalConstraints])

  // Inbound connections (outcomes/risks → goal)
  const inboundConnections = useMemo(() => {
    return edges
      .filter(e => e.target === nodeId)
      .map(e => {
        const sourceNode = nodes.find(n => n.id === e.source)
        const kind = (sourceNode?.type || sourceNode?.data?.kind || 'factor') as NodeType
        const weight = e.data?.weight ?? 0
        const direction = (e.data?.direction ?? 'positive') as 'positive' | 'negative'
        return {
          edgeId: e.id,
          nodeId: e.source,
          nodeKind: kind,
          label: String(sourceNode?.data?.label ?? e.source),
          strength: { weight, direction },
        }
      })
  }, [edges, nodes, nodeId])

  if (!nodeId || !node) return null

  return (
    <div>
      {/* Description */}
      <div className="mt-3">
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          onBlur={() => mutations.setDescription(description)}
          placeholder="Describe what achieving this goal looks like..."
          rows={2}
          maxLength={500}
          className={`${typography.panelBody} w-full border border-panel-border rounded-lg px-2.5 py-1.5 bg-panel resize-none`}
        />
      </div>

      {/* §4.2 Success target */}
      <SectionTitle icon={SECTION_TITLES.successTarget.icon} label={SECTION_TITLES.successTarget.label} />
      {goalThreshold != null ? (
        <div className="bg-panel border border-panel-border rounded-lg p-2.5">
          <p className={`${typography.panelBody} text-text-body`}>
            Success means reaching {'\u2265'} {goalThreshold}{thresholdUnit ? ` ${thresholdUnit}` : ''}
          </p>
          <p className={`${typography.panelMeta} text-text-light mt-1`}>
            Analysis calculates the probability of reaching or exceeding this target
          </p>
        </div>
      ) : (
        <div className="mt-1">
          <GoalThresholdEditor unit={thresholdUnit} nodeId={nodeId} thresholdRaw={thresholdRaw} />
          <CoachingCard text={COACHING.goalNoTarget} action={{ label: 'Add target', onClick: () => {} }} />
        </div>
      )}

      {/* §4.3 Constraints — pre-analysis preview or post-analysis with probability DataBars */}
      {goalConstraints && Array.isArray(goalConstraints) && goalConstraints.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {!isResultsMode && (
            <p className={`${typography.panelMeta} text-text-light mb-1`}>
              {goalConstraints.length} constraint{goalConstraints.length !== 1 ? 's' : ''} extracted from your brief
            </p>
          )}
          {goalConstraints.map((c, i) => {
            const prob = typeof c.probability === 'number' ? c.probability : null
            const colourClass = prob === null
              ? 'border-info/30'
              : prob >= 0.7 ? 'border-success/30' : prob >= 0.4 ? 'border-warning/30' : 'border-danger/30'
            return (
              <div key={c.id ?? i} className={`px-2.5 py-1.5 bg-panel border ${colourClass} rounded-lg`}>
                <div className="flex items-center justify-between gap-2">
                  <span className={`${typography.panelBody} text-text-body truncate`}>{c.label ?? `Constraint ${i + 1}`}</span>
                  {prob !== null && (
                    <span className={`${typography.panelMeta} shrink-0 ${
                      prob >= 0.7 ? 'text-success' : prob >= 0.4 ? 'text-warning' : 'text-danger'
                    }`}>{Math.round(prob * 100)}%</span>
                  )}
                </div>
                {prob !== null && (
                  <div className="mt-1">
                    <DataBar
                      value={prob}
                      label={c.label ?? `Constraint ${i + 1}`}
                      size="standard"
                    />
                  </div>
                )}
                {/* Conditional probabilities — show when P(B|A) differs >5pp from marginal */}
                {prob !== null && conditionalProbabilities && conditionalProbabilities.length > 0 && (() => {
                  const related = conditionalProbabilities.filter(
                    cp => (cp.constraint_a_label === (c.label ?? ''))
                      && Math.abs(cp.conditional_probability - cp.marginal_probability) > 0.05
                  )
                  if (related.length === 0) return null
                  return (
                    <div className="mt-1 space-y-0.5">
                      {related.map(cp => (
                        <p key={`${cp.constraint_a_id}-${cp.constraint_b_id}`} className={`${typography.panelMeta} text-text-light`}>
                          If {cp.constraint_a_label} is met, probability of {cp.constraint_b_label} changes to {Math.round(cp.conditional_probability * 100)}%
                        </p>
                      ))}
                    </div>
                  )
                })()}
                {prob === null && (
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`${typography.panelMeta} text-text-light shrink-0`}>{c.operator}</span>
                    <input
                      type="number"
                      defaultValue={c.value}
                      onBlur={e => {
                        const parsed = parseFloat(e.target.value)
                        if (Number.isNaN(parsed) || parsed === c.value) return
                        const base = preAnalysisConstraints ?? []
                        const updated = base.map((pc, idx) =>
                          // Match by id when available, fall back to index position
                          (c.id !== undefined ? pc.id === c.id : idx === i)
                            ? { ...pc, value: parsed }
                            : pc
                        )
                        setGoalConstraints(updated)
                      }}
                      className={`${typography.panelMeta} w-20 border border-panel-border rounded px-1.5 py-0.5 bg-panel text-text-body`}
                    />
                  </div>
                )}
              </div>
            )
          })}
          {typeof probJoint === 'number' && (
            <p className={`${typography.panelBody} text-text-body mt-1`}>
              Chance of hitting every target: <strong>{Math.round(probJoint * 100)}%</strong>
            </p>
          )}
        </div>
      )}

      {/* B.5: Add constraint button + inline form.
          Disabled in results mode — mutations write to preAnalysisConstraints but
          results mode renders postAnalysisConstraints, causing state mismatch. */}
      {isResultsMode ? null : !showAddConstraint ? (
        <button
          type="button"
          onClick={() => setShowAddConstraint(true)}
          className={`${typography.panelMeta} w-full mt-2 py-2 rounded-lg border border-dashed border-panel-border bg-transparent text-info hover:bg-panel-hover transition-colors`}
          data-testid="add-constraint-button"
        >
          + Add constraint
        </button>
      ) : (
        <div className="mt-2 p-2.5 bg-panel border border-panel-border rounded-lg space-y-2" data-testid="add-constraint-form">
          {/* Factor dropdown */}
          <select
            value={newConstraintLabel}
            onChange={e => { setNewConstraintLabel(e.target.value); setConstraintError('') }}
            className={`${typography.panelBody} w-full border border-panel-border rounded-lg px-2.5 py-1.5 bg-panel text-text-body`}
            aria-label="Constraint target factor"
          >
            <option value="">Select a factor...</option>
            {factorNodes.map(f => {
              const alreadyConstrained = constrainedLabels.has(f.label.toLowerCase().trim())
              return (
                <option key={f.id} value={f.label} disabled={alreadyConstrained}>
                  {f.label}{alreadyConstrained ? ' (already constrained)' : ''}
                </option>
              )
            })}
          </select>
          {/* Operator + value row */}
          <div className="flex items-center gap-1.5">
            <select
              value={newConstraintOperator}
              onChange={e => setNewConstraintOperator(e.target.value as '>=' | '<=' | '=')}
              className={`${typography.panelMeta} w-16 border border-panel-border rounded-lg px-1.5 py-1.5 bg-panel text-text-body`}
              aria-label="Constraint operator"
            >
              <option value=">=">{'\u2265'}</option>
              <option value="<=">{'\u2264'}</option>
              <option value="=">=</option>
            </select>
            <input
              type="number"
              value={newConstraintValue}
              onChange={e => { setNewConstraintValue(e.target.value); setConstraintError('') }}
              placeholder="Target value"
              className={`${typography.panelMeta} flex-1 border border-panel-border rounded px-1.5 py-1.5 bg-panel text-text-body`}
              aria-label="Constraint target value"
            />
          </div>
          {/* Error message */}
          {constraintError && (
            <p className={`${typography.panelMeta} text-danger`}>{constraintError}</p>
          )}
          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAddConstraint}
              className={`${typography.panelMeta} bg-primary text-text-on-color rounded-lg px-3 py-1 font-medium`}
              data-testid="confirm-add-constraint"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => { setShowAddConstraint(false); setConstraintError('') }}
              className={`${typography.panelMeta} text-text-light hover:text-text-body`}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Pre-analysis checklist */}
      {!isResultsMode && (
        <div className="mt-2">
          <GoalProgressChecklist nodeId={nodeId} />
        </div>
      )}

      {/* §4.4 Impact (post-analysis, StaleGuard) */}
      <SectionTitle icon={SECTION_TITLES.impact.icon} label={SECTION_TITLES.impact.label} />
      <StaleGuardBanner isStale={isStale} hasResults={isResultsMode}>
        {isResultsMode && typeof probGoal === 'number' && (
          <div className="flex items-center gap-4 py-2">
            <ProbabilityArc value={probGoal} color="var(--color-success)" />
            <div>
              <div className={`${typography.panelHeader}`}>{Math.round(probGoal * 100)}% chance of success</div>
              <div className={`${typography.panelMeta} text-text-light mt-0.5`}>Based on 1,000 simulations</div>
              {typeof probJoint === 'number' && (
                <div className={`${typography.panelBody} text-text-body mt-1.5`}>
                  Chance of hitting every target: <strong>{Math.round(probJoint * 100)}%</strong>
                </div>
              )}
              {techMode && (
                <div className={`${typography.panelMeta} text-text-light mt-1`}>
                  System: probability_of_goal: {probGoal.toFixed(2)}
                  {typeof probJoint === 'number' && ` \u00B7 probability_of_joint_goal: ${probJoint.toFixed(2)}`}
                </div>
              )}
            </div>
          </div>
        )}
      </StaleGuardBanner>

      {/* §4.5 Contributing factors */}
      <SectionTitle icon={SECTION_TITLES.whatDrivesThis.icon} label={SECTION_TITLES.whatDrivesThis.label} />
      {inboundConnections.map(conn => (
        <ConnectionRow
          key={conn.edgeId}
          nodeKind={conn.nodeKind}
          label={conn.label}
          strength={conn.strength}
          techMode={techMode}
          onClick={() => onNavigate(conn.nodeId)}
        />
      ))}
      {inboundConnections.length === 0 && (
        <p className={`${typography.panelMeta} text-text-light py-2`}>No contributing factors connected yet</p>
      )}

      {/* Coaching */}
      <CoachingCard
        text={COACHING.goalConnections}
        action={{ label: 'Ask about this', onClick: () => {} }}
      />

      {/* Guidance */}
      <InspectorGuidanceSection elementId={nodeId} />

      {/* Technical disclosure */}
      <TechnicalDisclosure visible={techMode}>
        <div>System: node_id: {nodeId}</div>
        <div>System: kind: goal</div>
        {goalThreshold != null && <div>System: goal_threshold: {goalThreshold}</div>}
        <div>System: inbound_edges: {inboundConnections.length}</div>
      </TechnicalDisclosure>
    </div>
  )
})
