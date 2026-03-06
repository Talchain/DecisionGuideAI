/**
 * GoalPanel — Inspector panel for goal nodes (spec §4)
 * Phase 2 priority.
 */

import { memo, useState, useMemo } from 'react'
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
import type { InspectorPanelProps } from '../types'

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
  const goalConstraints = useCanvasStore(s => s.results?.report?.goal_constraints)

  const node = nodeId ? nodes.find(n => n.id === nodeId) : undefined
  const mutations = useNodeMutations(nodeId ?? '')
  const { isStale } = useStaleGuard()
  const displayMetadata = useNodeDisplayMetadata(nodeId ?? '', 'goal')

  const thresholdUnit = (node?.data as Record<string, unknown>)?.goal_threshold_unit as string | undefined
  const [description, setDescription] = useState(String(node?.data?.description ?? ''))

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
          <GoalThresholdEditor unit={thresholdUnit} />
          <CoachingCard text="Adding a specific target unlocks probability calculations" action={{ label: 'Add target', onClick: () => {} }} />
        </div>
      )}

      {/* §4.3 Constraints summary (if available) */}
      {goalConstraints && Array.isArray(goalConstraints) && goalConstraints.length > 0 && (
        <div className="mt-2">
          {(goalConstraints as Array<{ label?: string; threshold?: number; probability?: number }>).map((c, i) => (
            <div key={i} className="flex items-center justify-between px-2.5 py-1.5 bg-panel border border-success/30 rounded-lg mb-1">
              <span className={`${typography.panelBody} text-text-body`}>{c.label ?? `Constraint ${i + 1}`}</span>
              {c.probability != null && (
                <span className={`${typography.panelMeta} text-text-light`}>{Math.round(c.probability * 100)}% met</span>
              )}
            </div>
          ))}
          {typeof probJoint === 'number' && (
            <p className={`${typography.panelBody} text-text-body mt-2`}>
              Chance of hitting every target: <strong>{Math.round(probJoint * 100)}%</strong>
            </p>
          )}
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
        text="Consider whether all relevant outcomes and risks are connected to your goal."
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
