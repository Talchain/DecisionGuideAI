import { memo, useMemo } from 'react'
import type { NodeProps } from '@xyflow/react'
import { BaseNode } from './BaseNode'
import { NODE_REGISTRY } from '../domain/nodes'
import { useNodeDisplayMetadata } from '../hooks/useNodeDisplayMetadata'
import { useCanvasStore } from '../store'
import { typography } from '../../styles/typography'
import { formatTargetValue } from '../../components/results/utils/formatTargetValue'
import { DataBar, type DataBarColour } from '../ui/shared/DataBar'
import { FileText, Cpu } from 'lucide-react'
import { getProvenanceLabel } from '../ui/inspector-v2/inspectorStrings'
import { getStabilityClassification } from '../../lib/stability'
import { isCurrencyUnit } from '../utils/labelUtils'
import type { CEEGoalConstraint } from '../../adapters/cee/types'

export const GoalNode = memo((props: NodeProps) => {
  const metadata = NODE_REGISTRY.goal
  const displayMetadata = useNodeDisplayMetadata(props.id, 'goal')

  // T10: Robustness level + stability from report
  const report = useCanvasStore(state => state.results.report)
  const resultsStatus = useCanvasStore(state => state.results.status)

  const robustnessData = useMemo(() => {
    if (resultsStatus !== 'complete' || !report) return null
    const robustness = (report as any)?.robustness
    if (!robustness) return null
    const stability: number | null = typeof (robustness.recommendation_stability ?? robustness.recommendationStability) === 'number'
      ? (robustness.recommendation_stability ?? robustness.recommendationStability)
      : null
    const level: string | null = robustness.level ?? robustness.robustness_level ?? null
    return { stability, level }
  }, [report, resultsStatus])

  // T10: Threshold context from node data
  const thresholdRaw = props.data?.goal_threshold_raw as string | number | null | undefined
  const thresholdUnit = props.data?.goal_threshold_unit as string | undefined

  // T10: Stability bar colour from robustness level (or canonical derivation)
  const stabilityClassification = useMemo(() =>
    getStabilityClassification(robustnessData?.stability),
    [robustnessData?.stability]
  )
  const stabilityBarColour = useMemo((): DataBarColour => {
    const level = robustnessData?.level ?? stabilityClassification?.level
    switch (level) {
      case 'high':     return 'success'
      case 'moderate': return 'goal'
      case 'low':
      case 'very_low': return 'warning'
      default:         return 'goal'
    }
  }, [robustnessData, stabilityClassification])

  // Prefer report-level stability over displayMetadata fallback
  const stabilityValue = robustnessData?.stability ?? displayMetadata.stabilityPercentage

  // T5: Constraint badges — pre-analysis from goalConstraints store, post-analysis from report
  const preAnalysisConstraints = useCanvasStore(state => state.goalConstraints)
  const postAnalysisConstraints = useCanvasStore(state =>
    (state.results?.report as any)?.goal_constraints as Array<CEEGoalConstraint & { probability?: number }> | null | undefined
  )
  // Prefer post-analysis (has probability) over pre-analysis (preview only)
  const activeConstraints: Array<CEEGoalConstraint & { probability?: number }> | null =
    resultsStatus === 'complete' ? (postAnalysisConstraints ?? preAnalysisConstraints) : preAnalysisConstraints

  // P0.3: Provenance pill — show when goal node has a meaningful source attribution
  const provenanceLabel = useMemo(() => {
    const source = (props.data?.observedState as any)?.source as string | undefined
    if (!source || source === 'user' || source === 'user_calibration' || source === 'default') return null
    const label = getProvenanceLabel(source)
    return label === 'No evidence yet' || label === `Source: ${source}` ? null : label
  }, [props.data?.observedState])

  // T6 fix: Check for CONSTRAINT_NODE_DEFAULT_BASE inference warning — goal probability unreliable
  const hasConstraintDefaultWarning = useMemo(() => {
    if (resultsStatus !== 'complete' || !report) return false
    const warnings = (report as any)?.inference_warnings ?? (report as any)?.robustness?.inference_warnings
    if (!Array.isArray(warnings)) return false
    return warnings.some((w: any) => w.code === 'CONSTRAINT_NODE_DEFAULT_BASE')
  }, [report, resultsStatus])

  // §11.3: Goal node border reflects confidence/stability level (post-analysis only)
  // high → solid goal (default, no override), moderate → info dashed, low → danger dashed
  const goalBorderOverride = useMemo(() => {
    if (!robustnessData) return undefined
    switch (robustnessData.level) {
      case 'moderate': return 'border-info border-dashed'
      case 'low':      return 'border-danger border-dashed'
      default:         return undefined // high or unknown → entity colour, solid
    }
  }, [robustnessData])

  return (
    <BaseNode {...props} nodeType="goal" icon={metadata.icon} borderClassOverride={goalBorderOverride}>
      {/* Achievement probability — evaluative colour per §11.6: >=0.70 success, >=0.40 warning, <0.40 danger */}
      {displayMetadata.achievementProbability !== null && (
        <div className={`${typography.nodeTitle} mb-1 flex items-center gap-1 ${
          displayMetadata.achievementProbability >= 0.70 ? 'text-success'
          : displayMetadata.achievementProbability >= 0.40 ? 'text-warning'
          : 'text-danger'
        }`}>
          {Math.round(displayMetadata.achievementProbability * 100)}% chance of target
          {hasConstraintDefaultWarning && (
            <span
              className={`${typography.nodeLabel} bg-panel border border-factor/30 text-text-body rounded-full w-4 h-4 flex items-center justify-center flex-shrink-0`}
              title="Some model inputs are missing. Goal probability may be less reliable."
            >
              ?
            </span>
          )}
        </div>
      )}
      {/* T6 P1-4: Show "?" badge independently when probability is null but warning exists */}
      {displayMetadata.achievementProbability === null && hasConstraintDefaultWarning && (
        <div className={`${typography.nodeTitle} mb-1 flex items-center gap-1 text-warning`}>
          <span
            className={`${typography.nodeLabel} bg-panel border border-factor/30 text-text-body rounded-full w-4 h-4 flex items-center justify-center flex-shrink-0`}
            title="Some model inputs are missing. Goal probability may be less reliable."
          >
            ?
          </span>
          <span className={`${typography.nodeLabel} text-text-light`}>Target probability unavailable</span>
        </div>
      )}

      {/* T10: Stability bar + UI-SEM-048 Marginal badge (canonical level low/very_low) */}
      {stabilityValue !== null && (
        <div className="mt-2 mb-1">
          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
            <span className={`${typography.nodeLabel} text-text-light`}>Decision stability</span>
            <span className={`${typography.nodeLabel} text-text-body`}>
              {Math.round(stabilityValue * 100)}%
            </span>
            {/* UI-SEM-048: Marginal badge shown when canonical level is low/very_low (stability < 0.55) */}
            {(stabilityClassification?.level === 'low' || stabilityClassification?.level === 'very_low') && (
              <span className={`${typography.nodeLabel} bg-panel border border-warning/30 text-text-body rounded-full px-1.5 py-0.5 ml-auto`}>
                Marginal
              </span>
            )}
          </div>
          <DataBar
            value={stabilityValue}
            label="Stability"
            colour={stabilityBarColour}
            size="standard"
          />
        </div>
      )}

      {/* Fallback: "Recommended in X% of scenarios" only when no stability bar shown */}
      {displayMetadata.achievementProbability === null && stabilityValue === null && displayMetadata.stabilityPercentage !== null && (
        <div className={`${typography.nodeTitle} mb-1 text-info`}>
          Recommended in {Math.round(displayMetadata.stabilityPercentage * 100)}% of scenarios
        </div>
      )}

      {/* T10: Threshold context — show "Target: >= X" or "No target set" coaching prompt */}
      {thresholdRaw != null && String(thresholdRaw).trim() !== '' ? (
        <div className={`${typography.nodeLabel} text-text-light mt-1`}>
          Target:{'\u00a0'}{(() => {
            const raw = typeof thresholdRaw === 'number' ? thresholdRaw : Number(thresholdRaw)
            if (Number.isNaN(raw)) return String(thresholdRaw)
            const u = typeof thresholdUnit === 'string' ? thresholdUnit.toLowerCase() : ''
            if (u === '%' || u === 'percent' || u === 'percentage') return formatTargetValue(Math.round(raw), 'percent')
            if (u === 'count' || u === '') return formatTargetValue(raw)
            if (thresholdUnit && isCurrencyUnit(thresholdUnit)) {
              // Currency symbol — prefix (e.g. "≥ £20,000")
              return formatTargetValue(raw, 'currency', thresholdUnit)
            }
            // Non-currency unit — suffix (e.g. "≥ 200 customers")
            return `${raw.toLocaleString()} ${thresholdUnit}`
          })()}
        </div>
      ) : resultsStatus !== 'complete' && (
        <div className={`${typography.nodeLabel} italic text-text-light mt-1`}>
          Set a success target to enable probability calculations
        </div>
      )}

      {/* T5: Constraint badges — pre-analysis preview + post-analysis probability */}
      {activeConstraints && activeConstraints.length > 0 && (
        <div className="mt-1.5 flex flex-col gap-0.5">
          {activeConstraints.map((c, i) => {
            const prob = typeof c.probability === 'number' ? c.probability : null
            // Post-analysis colour: ≥0.7 success, ≥0.4 warning, else danger
            const colourClass = prob === null
              ? 'border-info/30 text-text-body'
              : prob >= 0.7 ? 'border-success/40 text-success'
              : prob >= 0.4 ? 'border-warning/40 text-warning'
              : 'border-danger/40 text-danger'
            const badgeAriaLabel = `Constraint: ${c.operator} ${c.label}${prob !== null ? `, ${Math.round(prob * 100)}% probability` : ''}`
            return (
              <div key={c.id ?? i} className={`flex items-center justify-between gap-1 px-1.5 py-0.5 bg-panel border rounded-full ${colourClass}`} aria-label={badgeAriaLabel}>
                <span className={`${typography.nodeLabel} truncate`} title={c.label}>
                  {c.operator} {c.label}
                </span>
                {prob !== null && (
                  <span className={`${typography.nodeLabel} font-mono shrink-0`}>{Math.round(prob * 100)}%</span>
                )}
              </div>
            )
          })}
        </div>
      )}

      {provenanceLabel && (
        <div className="flex justify-end mt-1.5">
          {provenanceLabel.includes('Olumi') ? (
            <Cpu size={14} className="text-text-light" aria-hidden="true" title={provenanceLabel} />
          ) : (
            <FileText size={14} className="text-text-light" aria-hidden="true" title={provenanceLabel} />
          )}
        </div>
      )}

      {props.data?.description && (
        <div className={`${typography.nodeLabel} opacity-70 mt-1`}>
          {props.data.description}
        </div>
      )}
    </BaseNode>
  )
})

GoalNode.displayName = 'GoalNode'
