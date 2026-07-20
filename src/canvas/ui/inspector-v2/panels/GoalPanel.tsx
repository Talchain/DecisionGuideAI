/**
 * GoalPanel — Inspector panel for goal nodes (spec §4)
 * v6.2 three-group layout: Context → Your input → Impact → What drives this
 */

import { memo, useState, useMemo, useCallback } from 'react'
import { useCanvasStore } from '../../../store'
import { useGoalConstraints, useConditionalProbabilities } from '../useAnalysisResults'
import { InspectorCoaching } from '../shared/InspectorCoaching'
import { GoalThresholdEditor } from '../../inspector/GoalThresholdEditor'
import { GoalProgressChecklist } from '../../inspector/GoalProgressChecklist'
import { useNodeDisplayMetadata } from '../../../hooks/useNodeDisplayMetadata'
import { typography } from '../../../../styles/typography'
import { useNodeMutations } from '../useInspectorMutations'
import type { NodeType } from '../../../domain/nodes'
import {
  GROUP_LABELS,
  INLINE_LABELS,
  EMPTY_STATES,
  DESCRIPTION_PLACEHOLDERS,
  GOAL_CONSTRAINT_COPY,
  GOAL_STRINGS,
} from '../inspectorStrings'
import { PanelGroup } from '../shared/PanelGroup'
import { PrimaryControlCard } from '../shared/PrimaryControlCard'
import { InlineSectionLabel } from '../shared/InlineSectionLabel'
import { ImportanceBar } from '../shared/ImportanceBar'
import { EmptyDescriptionPrompt } from '../shared/EmptyDescriptionPrompt'
import { StaleGuardBanner } from '../shared/StaleGuardBanner'
import { TechnicalDisclosure } from '../shared/TechnicalDisclosure'
import { ConnectionRow } from '../shared/ConnectionRow'
import { ProbabilityArc } from '../shared/ProbabilityArc'
import { DataBar } from '../../shared/DataBar'
import { ResultsLink } from '../shared/ResultsLink'
import type { InspectorPanelProps } from '../types'
import type { CEEGoalConstraint } from '../../../../adapters/cee/types'
import type { ConditionalProbability } from '../../../../types/constraints'
import { resolveCoaching } from '../coachingConfig'
import { GoalAdvancedEditor } from '../editors/GoalAdvancedEditor'
import { useAuth } from '../../../../contexts/AuthContext'
import { isPersistenceActive } from '../../../../lib/persistenceActive'

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
  const postAnalysisConstraints = useGoalConstraints()
  const conditionalProbabilities = useConditionalProbabilities()
  const preAnalysisConstraints = useCanvasStore(s => s.goalConstraints)
  const setGoalConstraints = useCanvasStore(s => s.setGoalConstraints)
  // Prefer post-analysis (has probability scores) over pre-analysis preview
  const goalConstraints: Array<CEEGoalConstraint & { probability?: number }> | null =
    isResultsMode ? (postAnalysisConstraints ?? preAnalysisConstraints) : preAnalysisConstraints

  // UI-SEM-087: display-honesty gate (same class as UI-SEM-071/082 — gate on
  // truth, never fabricate). Live wire-probe (parallel-briefs/S-AUDIT-2026-07-20)
  // REFUTED the original "constraints reach nothing" premise in BOTH directions:
  // an authenticated user's panel constraints persist (gated write-through →
  // scenarios.graph → CEE run_analysis reads its own server graph), and a
  // GUEST's CHAT-entered constraints also reach analysis (CEE's add_constraint
  // handler persists server-side regardless of auth). The ONLY dead leg is the
  // GUEST GoalPanel → client-RPC persistence hop: guest writes are scenario-id
  // /RLS-gated and silently swallowed, so a guest's PANEL-entered constraint
  // never reaches the server graph. So the honest condition is exactly "this
  // session's writes don't persist" — the canonical isPersistenceActive
  // predicate (shared with useScenario / loginDraftImport), NOT the run path.
  // Pre-analysis only (entry is disabled in results mode, and post-analysis
  // probabilities would contradict the note). Remove when the guest panel→graph
  // persistence hop lands (or a producer echo confirms the constraints were used).
  const { user, authenticated } = useAuth()
  const constraintsInert = !isResultsMode && !isPersistenceActive(authenticated, user)
  const hasConstraints = Array.isArray(goalConstraints) && goalConstraints.length > 0

  const node = nodeId ? nodes.find(n => n.id === nodeId) : undefined
  const mutations = useNodeMutations(nodeId ?? '')
  const displayMetadata = useNodeDisplayMetadata(nodeId ?? '', 'goal')

  const thresholdUnit = (node?.data as Record<string, unknown>)?.goal_threshold_unit as string | undefined
  const thresholdRaw = (node?.data as Record<string, unknown>)?.goal_threshold_raw as string | number | null | undefined

  // Description — conditional edit state for EmptyDescriptionPrompt pattern
  const [description, setDescription] = useState(String(node?.data?.description ?? ''))
  const [isEditingDescription, setIsEditingDescription] = useState(false)

  // B.5: Add constraint form state.
  // The dropdown carries the factor's NODE ID, not its label: PLoT's constraint
  // preflight resolves `node_id` against graph.nodes, so a label here produces
  // CONSTRAINT_TARGET_NOT_FOUND and 422s the whole run.
  const [showAddConstraint, setShowAddConstraint] = useState(false)
  const [newConstraintNodeId, setNewConstraintNodeId] = useState('')
  // Operator is restricted to the two ASCII forms PLoT accepts. '=' is NOT a
  // valid constraint operator (preflight-v2 CONSTRAINT_INVALID_OPERATOR), and
  // @talchain/schemas DraftGoalConstraintSchema declares z.enum(['>=', '<=']).
  const [newConstraintOperator, setNewConstraintOperator] = useState<'>=' | '<='>('>=')
  const [newConstraintValue, setNewConstraintValue] = useState('')
  const [constraintError, setConstraintError] = useState('')

  // Factor nodes for the constraint target dropdown
  const factorNodes = useMemo(() =>
    nodes.filter(n => n.type === 'factor').map(n => ({
      id: n.id,
      label: String(n.data?.label ?? n.id),
    })),
  [nodes])

  // Already-constrained factors, keyed by node ID where the constraint carries
  // one and by lower-cased label otherwise. Constraints minted before this panel
  // captured node IDs (and any legacy persisted graph) carry only a label, so
  // the label leg has to stay for the "(already constrained)" hint to keep
  // working on those — but node ID is the identity that actually matters.
  //
  // `label` is optional on the wire (CEE's producer schema and the
  // @talchain/schemas draft contract both declare it optional), so an
  // unguarded `.toLowerCase()` throws on a perfectly valid constraint.
  const constrainedTargets = useMemo(() => {
    const byNodeId = new Set<string>()
    const byLabel = new Set<string>()
    for (const c of goalConstraints ?? []) {
      if (c.node_id) byNodeId.add(c.node_id)
      const l = c.label?.toLowerCase().trim()
      if (l) byLabel.add(l)
    }
    return { byNodeId, byLabel }
  }, [goalConstraints])

  const handleAddConstraint = useCallback(() => {
    const value = parseFloat(newConstraintValue)
    if (!newConstraintNodeId) {
      setConstraintError(GOAL_CONSTRAINT_COPY.errorSelectFactor)
      return
    }
    // The dropdown only ever offers factor node IDs, but resolve rather than
    // trust: a stale selection whose node has since been deleted must not mint
    // a constraint pointing at a node that is no longer in the graph.
    const targetNode = factorNodes.find(f => f.id === newConstraintNodeId)
    if (!targetNode) {
      setConstraintError(GOAL_CONSTRAINT_COPY.errorSelectFactor)
      return
    }
    if (Number.isNaN(value)) {
      setConstraintError(GOAL_CONSTRAINT_COPY.errorInvalidNumber)
      return
    }
    const base = preAnalysisConstraints ?? []
    // Conforms to @talchain/schemas DraftGoalConstraintSchema (0.19.0):
    // constraint_id and node_id are both REQUIRED and min(1); operator is
    // z.enum(['>=', '<=']). PLoT's own preflight (validateGoalConstraints)
    // reads exactly these fields, so anything less 422s the run.
    //
    // constraint_id is a UUID rather than a positional `c${n}`: the positional
    // scheme regenerates an existing id after a delete-then-add, which PLoT
    // rejects with CONSTRAINT_DUPLICATE_ID.
    const newConstraint: CEEGoalConstraint = {
      constraint_id: crypto.randomUUID(),
      node_id: targetNode.id,
      operator: newConstraintOperator,
      value,
      label: targetNode.label,
      // The user typed this constraint into the panel themselves — it is not
      // inferred from the brief and not a proxy for something else.
      provenance: 'explicit',
    }
    setGoalConstraints([...base, newConstraint])
    setShowAddConstraint(false)
    setNewConstraintNodeId('')
    setNewConstraintOperator('>=')
    setNewConstraintValue('')
    setConstraintError('')
  }, [factorNodes, newConstraintNodeId, newConstraintOperator, newConstraintValue, preAnalysisConstraints, setGoalConstraints])

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
      {/* ── Context group ─────────────────────────────────────── */}
      <PanelGroup kind="context" label={GROUP_LABELS.context}>
        {/* Description — textarea when editing or content exists, EmptyDescriptionPrompt when empty */}
        {description || isEditingDescription ? (
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            onBlur={() => {
              mutations.setDescription(description)
              if (!description.trim()) setIsEditingDescription(false)
            }}
            autoFocus={isEditingDescription && !description}
            placeholder="Describe what achieving this goal looks like..."
            rows={2}
            maxLength={500}
            className={`${typography.panelBody} w-full border border-panel-border rounded-lg px-2.5 py-1.5 bg-panel resize-none`}
          />
        ) : (
          <EmptyDescriptionPrompt
            placeholder={DESCRIPTION_PLACEHOLDERS.goal}
            onStartEditing={() => setIsEditingDescription(true)}
          />
        )}

        {/* Post-analysis: ImportanceBar. Pre-analysis: GoalProgressChecklist. */}
        {isResultsMode ? (
          (displayMetadata.influence != null || displayMetadata.sensitivityRank != null) && (
            <div className="mt-2">
              <ImportanceBar
                importanceScore={displayMetadata.influence}
                sensitivityRank={displayMetadata.sensitivityRank}
              />
            </div>
          )
        ) : (
          <div className="mt-2">
            <GoalProgressChecklist nodeId={nodeId} />
          </div>
        )}
      </PanelGroup>

      {/* ── Your input group ──────────────────────────────────── */}
      <PanelGroup kind="input" label={GROUP_LABELS.input}>
        <PrimaryControlCard>
          {/* §4.2 Success target */}
          {goalThreshold != null ? (
            <div>
              <p className={`${typography.panelBody} text-text-body`}>
                Success means reaching {'\u2265'} {goalThreshold}{thresholdUnit ? ` ${thresholdUnit}` : ''}
              </p>
              {/* Contextual probability when analysis exists */}
              {typeof probGoal === 'number' ? (
                <p className={`${typography.panelBody} text-text-body mt-1`}>
                  {Math.round(probGoal * 100)}% chance of reaching this target based on the current model.
                </p>
              ) : (
                <p className={`${typography.panelMeta} text-text-light mt-1`}>
                  {GOAL_CONSTRAINT_COPY.runForProbability}
                </p>
              )}
            </div>
          ) : (
            <div>
              <GoalThresholdEditor unit={thresholdUnit} nodeId={nodeId} thresholdRaw={thresholdRaw} />
              <p className={`${typography.panelMeta} text-info mt-1.5`}>
                {GOAL_CONSTRAINT_COPY.targetUnlocks}
              </p>
            </div>
          )}

          {/* §4.3 Constraints */}
          {goalConstraints && Array.isArray(goalConstraints) && goalConstraints.length > 0 && (
            <div className="mt-3">
              <InlineSectionLabel>Constraints</InlineSectionLabel>
              <div className="space-y-1.5">
                {!isResultsMode && (
                  <p className={`${typography.panelMeta} text-text-light mb-1`}>
                    {GOAL_CONSTRAINT_COPY.extractedFromBrief(goalConstraints.length)}
                  </p>
                )}
                {goalConstraints.map((c, i) => {
                  const prob = typeof c.probability === 'number' ? c.probability : null
                  const colourClass = prob === null
                    ? 'border-info/30'
                    : prob >= 0.7 ? 'border-success/30' : prob >= 0.4 ? 'border-warning/30' : 'border-danger/30'
                  return (
                    <div key={c.constraint_id ?? c.id ?? i} className={`px-2.5 py-1.5 bg-panel border ${colourClass} rounded-lg`}>
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
                              // Identity is `constraint_id ?? id` — panel-minted
                              // constraints carry only constraint_id, so keying
                              // on `id` alone silently fell through to index
                              // matching (wrong row after any reorder/delete).
                              const identity = c.constraint_id ?? c.id
                              const updated = base.map((pc, idx) =>
                                (identity !== undefined
                                  ? (pc.constraint_id ?? pc.id) === identity
                                  : idx === i)
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
                    {GOAL_CONSTRAINT_COPY.jointProbability}: <strong>{Math.round(probJoint * 100)}%</strong>
                  </p>
                )}
                {/* UI-SEM-087: honest status when the constraints displayed here
                    do not reach the engine — guest panel writes are RLS-swallowed. */}
                {constraintsInert && (
                  <p
                    className={`${typography.panelMeta} text-text-light mt-1`}
                    data-testid="constraints-inert-note"
                  >
                    {GOAL_CONSTRAINT_COPY.guestConstraintsNotInAnalysis}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* UI-SEM-087: honest status at the point of ENTRY, shown only when
              no constraint list is present to carry the note (mutually
              exclusive with the display-surface note above — never stacked). */}
          {constraintsInert && !hasConstraints && (
            <p
              className={`${typography.panelMeta} text-text-light mt-2`}
              data-testid="constraints-inert-note-entry"
            >
              {GOAL_CONSTRAINT_COPY.guestConstraintsNotInAnalysis}
            </p>
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
              {GOAL_CONSTRAINT_COPY.addConstraintButton}
            </button>
          ) : (
            <div className="mt-2 p-2.5 bg-panel border border-panel-border rounded-lg space-y-2" data-testid="add-constraint-form">
              {/* Factor dropdown */}
              <select
                value={newConstraintNodeId}
                onChange={e => { setNewConstraintNodeId(e.target.value); setConstraintError('') }}
                className={`${typography.panelBody} w-full border border-panel-border rounded-lg px-2.5 py-1.5 bg-panel text-text-body`}
                aria-label={GOAL_CONSTRAINT_COPY.factorLabel}
              >
                <option value="">{GOAL_CONSTRAINT_COPY.selectFactor}</option>
                {factorNodes.map(f => {
                  const alreadyConstrained =
                    constrainedTargets.byNodeId.has(f.id)
                    || constrainedTargets.byLabel.has(f.label.toLowerCase().trim())
                  return (
                    <option key={f.id} value={f.id} disabled={alreadyConstrained}>
                      {f.label}{alreadyConstrained ? ` ${GOAL_CONSTRAINT_COPY.alreadyConstrained}` : ''}
                    </option>
                  )
                })}
              </select>
              {/* Operator + value row */}
              <div className="flex items-center gap-1.5">
                <select
                  value={newConstraintOperator}
                  onChange={e => setNewConstraintOperator(e.target.value as '>=' | '<=')}
                  className={`${typography.panelMeta} w-16 border border-panel-border rounded-lg px-1.5 py-1.5 bg-panel text-text-body`}
                  aria-label={GOAL_CONSTRAINT_COPY.operatorLabel}
                >
                  {/* No '=' option: PLoT accepts >= and <= only. */}
                  <option value=">=">{'\u2265'}</option>
                  <option value="<=">{'\u2264'}</option>
                </select>
                <input
                  type="number"
                  value={newConstraintValue}
                  onChange={e => { setNewConstraintValue(e.target.value); setConstraintError('') }}
                  placeholder={GOAL_CONSTRAINT_COPY.targetValue}
                  className={`${typography.panelMeta} flex-1 border border-panel-border rounded px-1.5 py-1.5 bg-panel text-text-body`}
                  aria-label={GOAL_CONSTRAINT_COPY.valueInputLabel}
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
                  {GOAL_CONSTRAINT_COPY.addButton}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowAddConstraint(false); setConstraintError('') }}
                  className={`${typography.panelMeta} text-text-light hover:text-text-body`}
                >
                  {GOAL_CONSTRAINT_COPY.cancelButton}
                </button>
              </div>
            </div>
          )}
        </PrimaryControlCard>

        {/* Coaching — within Your input group, below the card */}
        <InspectorCoaching
          elementId={nodeId}
          panelType="goal"
          fallbackText={resolveCoaching('goalEvidence', { goalName: String(node.data?.label ?? '') })}
          labelContext={{ label: String(node.data?.label ?? '') }}
        />
      </PanelGroup>

      {/* ── Impact group (post-analysis only) ── */}
      {isResultsMode && (
        <PanelGroup kind="impact" label={GROUP_LABELS.impact}>
          {typeof probGoal === 'number' ? (
            <StaleGuardBanner hasResults={isResultsMode}>
              <div className="flex items-center gap-4 py-2">
                <ProbabilityArc value={probGoal} color="var(--success)" />
                <div>
                  <div className={`${typography.panelHeader}`}>{Math.round(probGoal * 100)}% chance of success</div>
                  <div className={`${typography.panelMeta} text-text-light mt-0.5`}>Based on 1,000 simulations</div>
                  <div className="mt-1"><ResultsLink label="View full results" tab="results" /></div>
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
            </StaleGuardBanner>
          ) : (
            <p className={`${typography.panelMeta} text-text-light`}>{GOAL_STRINGS.impactUnavailable}</p>
          )}
        </PanelGroup>
      )}

      {/* ── What drives this group ────────────────────────────── */}
      <PanelGroup kind="connections" label={GROUP_LABELS.whatDrivesThis}>
        {inboundConnections.map(conn => (
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
        {inboundConnections.length === 0 && (
          <p className={`${typography.panelMeta} text-text-light`}>{EMPTY_STATES.noInboundConnections}</p>
        )}
      </PanelGroup>

      {/* ── Expert-only model detail ──────────────────────────── */}
      <TechnicalDisclosure visible={techMode}>
        <GoalAdvancedEditor nodeId={nodeId} />
      </TechnicalDisclosure>
    </div>
  )
})
