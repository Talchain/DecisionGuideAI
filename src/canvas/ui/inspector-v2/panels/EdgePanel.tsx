/**
 * EdgePanel — Inspector panel for edges (spec §10)
 * Phase 1 priority. Three distinct sliders: strength, existence, uncertainty.
 */

import { memo, useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { ArrowRight, AlertTriangle, Beaker, ChevronDown, ChevronRight } from 'lucide-react'
import { useCanvasStore } from '../../../store'
import { useRobustness, useEdgeEValues } from '../useAnalysisResults'
import { useEditConfirmation } from '../useEditConfirmation'
import { EditConfirmation } from '../shared/EditConfirmation'
import { InlineRerunPrompt } from '../shared/InlineRerunPrompt'
import { getEdgeConfidence, EDGE_CONSTRAINTS, DEFAULT_EDGE_DATA } from '../../../domain/edges'
import type { NodeType } from '../../../domain/nodes'
import { NodeShapeIndicator } from '../../../nodes/NodeShapeIndicator'
import { SignedStrengthSlider } from '../../inspector/SignedStrengthSlider'
import { InspectorCoaching } from '../shared/InspectorCoaching'
import { typography } from '../../../../styles/typography'
import { useEdgeMutations } from '../useInspectorMutations'
import { useStaleGuard } from '../useStaleGuard'
import {
  SECTION_TITLES,
  getProvenanceLabel,
  getStrengthDescription,
  EMPTY_STATES,
} from '../inspectorStrings'
import { SectionTitle } from '../shared/SectionTitle'
import { StaleGuardBanner } from '../shared/StaleGuardBanner'
import { TechnicalDisclosure } from '../shared/TechnicalDisclosure'
import { UncertaintyBand } from '../shared/UncertaintyBand'
import type { InspectorPanelProps } from '../types'
import { extractCausalClaims, claimTypeLabel } from '../../../adapters/causalClaimsAdapter'
import { trackGuidance } from '../../../../telemetry/guidanceEvents'
import { isEdgeFragile, getFragileEdgeSwitchProbability } from '../../../utils/fragileEdgeMatch'
import { COACHING, resolveCoaching } from '../coachingConfig'
import { useEditImpactPreview } from '../../../hooks/useEditImpactPreview'
import { StrengthBandButtons } from '../shared/StrengthBandButtons'
import { EdgeAdvancedEditor } from '../editors/EdgeAdvancedEditor'

// ─── Slider component for confidence and uncertainty ───────────────
function InspectorSlider({
  value,
  min,
  max,
  step,
  onChange,
  color,
  trackFillColor,
  'aria-label': ariaLabel,
}: {
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  color?: string
  /** C2: Coloured track fill behind the slider */
  trackFillColor?: string
  'aria-label': string
}) {
  const debounceRef = useRef<NodeJS.Timeout>()

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => onChange(v), 120)
  }, [onChange])

  useEffect(() => () => clearTimeout(debounceRef.current), [])

  const pct = ((value - min) / (max - min)) * 100

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 relative">
        {trackFillColor && (
          <div className="absolute inset-y-0 flex items-center pointer-events-none" style={{ left: 0, right: 0 }}>
            <div className="w-full h-1 bg-panel-border rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-100"
                style={{ width: `${pct}%`, backgroundColor: trackFillColor }}
                data-testid="inspector-slider-track-fill"
              />
            </div>
          </div>
        )}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={handleChange}
          aria-label={ariaLabel}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          className={`w-full ${trackFillColor ? 'relative z-10' : ''}`}
          style={color ? { accentColor: color } : undefined}
        />
      </div>
    </div>
  )
}

// ─── Confidence threshold colour ───────────────────────────────────
function thresholdColor(v: number): string {
  if (v >= 0.7) return 'text-success'
  if (v >= 0.4) return 'text-warning'
  return 'text-danger'
}

/** C2: CSS variable for threshold-based track fill */
function thresholdTrackVar(v: number): string {
  if (v >= 0.7) return 'var(--success)'
  if (v >= 0.4) return 'var(--warning)'
  return 'var(--danger)'
}

export const EdgePanel = memo(function EdgePanel({
  edgeId,
  techMode,
  onClose,
  onNavigate,
}: InspectorPanelProps) {
  const edges = useCanvasStore(s => s.edges)
  const nodes = useCanvasStore(s => s.nodes)
  const robustness = useRobustness()
  const edgeEValues = useEdgeEValues()
  const resultsStatus = useCanvasStore(s => s.results?.status)
  const isResultsMode = resultsStatus === 'complete'

  const edge = edgeId ? edges.find(e => e.id === edgeId) : undefined
  const mutations = useEdgeMutations(edgeId ?? '')
  const { confirm: confirmEdit, lastConfirmed, isStaleAfterEdit } = useEditConfirmation()
  const { isStale } = useStaleGuard()

  // Source/target nodes
  const sourceNode = useMemo(() => nodes.find(n => n.id === edge?.source), [nodes, edge?.source])
  const targetNode = useMemo(() => nodes.find(n => n.id === edge?.target), [nodes, edge?.target])
  const sourceLabel = String(sourceNode?.data?.label ?? edge?.source ?? '')
  const targetLabel = String(targetNode?.data?.label ?? edge?.target ?? '')
  const sourceKind = (sourceNode?.type || sourceNode?.data?.kind || 'factor') as NodeType
  const targetKind = (targetNode?.type || targetNode?.data?.kind || 'factor') as NodeType

  // Organisational edge gate
  const isOrganisational = sourceKind === 'decision' && targetKind === 'option'
  const isIntervention = sourceKind === 'option' && targetKind === 'factor'

  // UI-SEM-029: Edge weight/direction defaults for display (0.5 / 'positive').
  // Keep — display fallback; does not affect analysis data.
  const weight = edge?.data?.weight ?? 0.5
  const direction = edge?.data?.direction ?? 'positive'
  const signedValue = direction === 'negative' ? -weight : weight
  const beliefExists = edge?.data?.beliefExists ?? EDGE_CONSTRAINTS.beliefExists.default
  const strengthStd = edge?.data?.strengthStd ?? 0.15

  // Local slider state
  const [localStrength, setLocalStrength] = useState(signedValue)
  const [localBelief, setLocalBelief] = useState(beliefExists)
  const [localStd, setLocalStd] = useState(strengthStd)

  // Fragility check — uses canonical isEdgeFragile (UI-SEM-013 threshold applied)
  const isFragile = useMemo(() => {
    if (!robustness?.fragile_edges) return false
    return isEdgeFragile(
      edgeId ?? '',
      edge?.source ?? '',
      edge?.target ?? '',
      robustness.fragile_edges as import('../../../utils/fragileEdgeMatch').FragileEdgeCandidate[],
    )
  }, [robustness, edgeId, edge?.source, edge?.target])

  // E-value for this edge from ISL edge_e_values (gated on field presence)
  const edgeEValue = useMemo(() => {
    if (!edgeEValues || !edgeId) return null
    const entry = edgeEValues.find(ev => ev.edge_id === edgeId)
    return entry?.e_value ?? null
  }, [edgeEValues, edgeId])

  // T7: Switch probability for fragile edge detail
  const fragileEdgeSwitchProb = useMemo(() => {
    if (!isFragile || !robustness?.fragile_edges) return null
    return getFragileEdgeSwitchProbability(
      edgeId ?? '',
      edge?.source ?? '',
      edge?.target ?? '',
      robustness.fragile_edges as unknown[],
    )
  }, [isFragile, robustness, edgeId, edge?.source, edge?.target])

  // Provenance
  const provenance = edge?.data?.provenance as string | undefined

  // Graph Editing Experience Task 5: Edit impact preview
  const { previewEdit, clearPreview } = useEditImpactPreview()
  const origStrengthRef = useRef(signedValue)

  // Handlers
  const handleStrengthChange = useCallback((v: number) => {
    setLocalStrength(v)
    mutations.setStrength(v)
    // Trigger impact preview (debounced 150ms)
    if (edgeId) previewEdit(edgeId, v - origStrengthRef.current)
  }, [mutations, edgeId, previewEdit])

  const handleStrengthBlur = useCallback(() => {
    clearPreview()
    origStrengthRef.current = localStrength
    confirmEdit('strength')
  }, [clearPreview, localStrength, confirmEdit])

  const handleBeliefChange = useCallback((v: number) => {
    setLocalBelief(v)
    mutations.setExistsProbability(v)
    confirmEdit('existence')
  }, [mutations, confirmEdit])

  const handleStdChange = useCallback((v: number) => {
    setLocalStd(v)
    mutations.setStd(v)
  }, [mutations])

  if (!edgeId || !edge) return null

  return (
    <div>
      {/* §10.1 Relationship header */}
      <div className="flex items-center gap-2 mt-3 px-3 py-2 bg-panel border border-panel-border rounded-lg">
        <NodeShapeIndicator nodeKind={sourceKind} size={16} />
        <span className={`${typography.panelBody} text-text-body truncate`}>{sourceLabel}</span>
        <ArrowRight size={12} className="text-text-light flex-shrink-0" />
        <NodeShapeIndicator nodeKind={targetKind} size={16} />
        <span className={`${typography.panelBody} text-text-body truncate`}>{targetLabel}</span>
      </div>

      {isOrganisational ? (
        <div className="mt-3">
          <p className={`${typography.panelMeta} text-text-light`}>Organisational link</p>
          <p className={`${typography.panelMeta} text-text-light mt-1`}>
            This connection shows how options relate to the decision. It does not affect analysis.
          </p>
        </div>
      ) : isIntervention ? (
        <div className="mt-3" data-testid="intervention-edge-notice">
          <p className={`${typography.panelMeta} text-text-light`}>Intervention link</p>
          <p className={`${typography.panelMeta} text-text-light mt-1`}>
            This connection shows how {sourceLabel} sets {targetLabel} in the analysed scenario. It affects analysis.
          </p>
        </div>
      ) : (
        <>
          {/* §10.2 How strong is this effect */}
          <SectionTitle icon={SECTION_TITLES.howStrong.icon} label={SECTION_TITLES.howStrong.label} />
          <div className="px-1">
            {/* Contextual sentence */}
            <p className={`${typography.panelBody} mb-2 ${isFragile ? 'text-warning' : 'text-text-body'}`}>
              {isFragile
                ? 'This is a sensitive assumption. Small changes here could change the recommendation.'
                : localBelief < 0.7
                ? 'This connection is uncertain. Calibrating it would strengthen the analysis.'
                : `How much does ${sourceLabel} affect ${targetLabel}?`}
            </p>
            {/* B.4: Quick-select strength band buttons — primary input */}
            <StrengthBandButtons value={localStrength} onChange={handleStrengthChange} />
            {/* Strength pill */}
            <div className="flex justify-between items-center mt-2">
              <span
                className={`${typography.panelMeta} font-medium inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-transparent text-text-body`}
                style={{
                  border: `1px solid ${localStrength >= 0 ? 'var(--color-success)' : 'var(--color-danger)'}4D`,
                }}
              >
                {localStrength >= 0 ? '\u2191' : '\u2193'} {getStrengthDescription(localStrength)}
              </span>
              {techMode && (
                <span className={`${typography.panelHeader} text-xs`}>
                  {localStrength >= 0 ? '+' : ''}{localStrength.toFixed(2)}
                </span>
              )}
            </div>
            {/* Edit feedback */}
            {lastConfirmed?.field === 'strength' && (
              <div className="flex items-center gap-2 mt-1">
                <EditConfirmation trigger={lastConfirmed.ts} />
                <InlineRerunPrompt visible={isStaleAfterEdit} />
              </div>
            )}
            {/* Slider — behind disclosure in default mode, always visible in tech mode */}
            {techMode ? (
              <div className="mt-2">
                <div className="relative mb-2">
                  <UncertaintyBand strength={localStrength} std={localStd} />
                  <SignedStrengthSlider value={localStrength} onChange={handleStrengthChange} onBlur={handleStrengthBlur} std={localStd} techMode={techMode} />
                </div>
                <div className="flex justify-between mt-1">
                  <span className={`${typography.panelMeta} text-text-light`}>{'\u22121.0'}</span><span className={`${typography.panelMeta} text-text-light`}>0</span><span className={`${typography.panelMeta} text-text-light`}>+1.0</span>
                </div>
              </div>
            ) : (
              <details className="mt-2">
                <summary className={`${typography.panelMeta} text-info cursor-pointer`}>Fine-tune</summary>
                <div className="mt-1.5">
                  <div className="relative mb-2">
                    <UncertaintyBand strength={localStrength} std={localStd} />
                    <SignedStrengthSlider value={localStrength} onChange={handleStrengthChange} onBlur={handleStrengthBlur} std={localStd} techMode={techMode} />
                  </div>
                </div>
              </details>
            )}
          </div>

          {/* Coaching — after strength, before existence (most coaching is about calibrating the effect) */}
          <InspectorCoaching
            elementId={edgeId}
            panelType="edge"
            fallbackText={resolveCoaching('edgeWeight', { factorName: sourceLabel })}
            labelContext={{ label: `${sourceLabel} \u2192 ${targetLabel}`, sourceLabel, targetLabel }}
          />

          {/* §10.3 Does this connection exist */}
          <SectionTitle icon={SECTION_TITLES.doesExist.icon} label={SECTION_TITLES.doesExist.label} />
          <div className="px-1">
            <p className={`${typography.panelBody} text-text-body mb-2`}>
              {localBelief < 0.5
                ? 'You seem uncertain this connection exists. If it doesn\u2019t, removing it simplifies the model.'
                : 'How confident are you that this causal link is real?'}
            </p>
            <div className="flex justify-between mb-1.5">
              {techMode ? (
                <><span className={`${typography.panelMeta} text-text-light`}>0%</span><span className={`${typography.panelMeta} text-text-light`}>100%</span></>
              ) : (
                <><span className={`${typography.panelMeta} text-text-light`}>Unlikely</span><span className={`${typography.panelMeta} text-text-light`}>Very likely</span></>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <InspectorSlider
                  value={localBelief}
                  min={0}
                  max={1}
                  step={0.05}
                  onChange={handleBeliefChange}
                  trackFillColor={thresholdTrackVar(localBelief)}
                  aria-label="Connection existence probability"
                />
              </div>
              <span className={`${typography.panelHeader} text-xs min-w-[32px] text-right ${thresholdColor(localBelief)}`}>
                {Math.round(localBelief * 100)}%
              </span>
            </div>
            {techMode && (
              <div className={`${typography.panelMeta} text-text-light mt-1`}>
                System: exists_probability: {localBelief.toFixed(2)}
              </div>
            )}
          </div>

          {/* §10.4 How uncertain is the strength — collapsed by default, visible in tech mode */}
          {techMode ? (
            <>
              <SectionTitle icon={SECTION_TITLES.howUncertain.icon} label={SECTION_TITLES.howUncertain.label} />
              <div className="px-1">
                <div className="flex justify-between mb-1.5">
                  <span className={`${typography.panelMeta} text-text-light`}>Precise</span>
                  <span className={`${typography.panelMeta} text-text-light`}>Uncertain</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <InspectorSlider
                      value={localStd}
                      min={0.01}
                      max={0.5}
                      step={0.01}
                      onChange={handleStdChange}
                      aria-label="Strength uncertainty"
                    />
                  </div>
                  <span className={`${typography.panelMeta} text-text-light min-w-[40px] text-right`}>
                    System: strength.std: {localStd.toFixed(2)}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <details className="mt-3">
              <summary className={`${typography.panelMeta} text-info cursor-pointer`}>Fine-tune uncertainty</summary>
              <div className="px-1 mt-1.5">
                <div className="flex justify-between mb-1.5">
                  <span className={`${typography.panelMeta} text-text-light`}>Precise</span>
                  <span className={`${typography.panelMeta} text-text-light`}>Uncertain</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <InspectorSlider
                      value={localStd}
                      min={0.01}
                      max={0.5}
                      step={0.01}
                      onChange={handleStdChange}
                      aria-label="Strength uncertainty"
                    />
                  </div>
                </div>
              </div>
            </details>
          )}

          {/* §10.5 Evidence */}
          <SectionTitle icon={SECTION_TITLES.evidence.icon} label={SECTION_TITLES.evidence.label} />
          <div className="bg-panel border border-panel-border rounded-lg p-2.5">
            <span
              className={`${typography.panelMeta} font-medium inline-flex items-center px-2.5 py-0.5 rounded-full bg-transparent text-text-body`}
              style={{ border: '1px solid var(--color-warning, #FFA656)4D' }}
            >
              {getProvenanceLabel(provenance)}
            </span>
            {!provenance && (
              <p className={`${typography.panelMeta} text-text-light mt-1.5`}>
                {EMPTY_STATES.noEvidence}
              </p>
            )}
          </div>

          {/* §10.5a Calibration — needs your judgement (L2 parity) */}
          {(() => {
            const validation = (edge?.data as Record<string, unknown>)?.validation as
              import('../../../../canvas/domain/validation').ValidationMetadata | undefined
            if (!validation || validation.status !== 'contested') return null
            return (
              <div className="mt-3">
                <SectionTitle icon={SECTION_TITLES.evidence.icon} label="Calibration" />
                <div className="bg-panel border border-warning/30 rounded-lg p-2.5">
                  <div className={`${typography.panelBody} font-medium text-warning flex items-center gap-1`}>
                    <AlertTriangle size={13} className="text-warning" />
                    Needs your judgement
                  </div>
                  {validation.contested_reasons?.length > 0 && (
                    <p className={`${typography.panelMeta} text-text-light mt-1`}>
                      {validation.contested_reasons.join(', ')}
                    </p>
                  )}
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <div className="bg-panel border border-panel-border rounded p-2">
                      <div className={`${typography.panelMeta} text-text-light mb-1`}>Pass 1 (current)</div>
                      <div className={typography.panelMeta}>Strength: {validation.pass1.strength_mean.toFixed(2)}</div>
                      <div className={typography.panelMeta}>Std: {validation.pass1.strength_std.toFixed(2)}</div>
                      <div className={typography.panelMeta}>Exists: {Math.round(validation.pass1.exists_probability * 100)}%</div>
                    </div>
                    <div className="bg-panel border border-panel-border rounded p-2">
                      <div className={`${typography.panelMeta} text-text-light mb-1`}>Pass 2 (review)</div>
                      <div className={typography.panelMeta}>Strength: {validation.pass2.strength_mean.toFixed(2)}</div>
                      <div className={typography.panelMeta}>Std: {validation.pass2.strength_std.toFixed(2)}</div>
                      <div className={typography.panelMeta}>Exists: {Math.round(validation.pass2.exists_probability * 100)}%</div>
                    </div>
                  </div>
                  {validation.pass2.reasoning && (
                    <p className={`${typography.panelMeta} text-text-light mt-2 italic`}>
                      &ldquo;{validation.pass2.reasoning}&rdquo;
                    </p>
                  )}
                  {validation.pass2.basis && (
                    <span className={`${typography.panelMeta} inline-block mt-1 px-1.5 py-0.5 rounded-full bg-transparent border border-info/30 text-text-body`}>
                      {validation.pass2.basis}
                    </span>
                  )}
                </div>
              </div>
            )
          })()}

          {/* §10.6 Sensitive assumptions — only when edge in robustness.fragile_edges */}
          {isFragile && isResultsMode && (
            <>
              <SectionTitle icon={SECTION_TITLES.fragility.icon} label={SECTION_TITLES.fragility.label} />
              <StaleGuardBanner isStale={isStale} hasResults={isResultsMode}>
                <div className="bg-panel border border-danger/30 p-2.5 rounded-lg">
                  <div className={`${typography.panelBody} font-medium text-danger flex items-center gap-1`}>
                    <AlertTriangle size={13} className="text-danger" />
                    Sensitive assumption
                    {/* T7: Switch probability */}
                    {fragileEdgeSwitchProb !== null && (
                      <span className={`${typography.panelMeta} ml-1 text-warning font-mono`}>
                        {Math.round(fragileEdgeSwitchProb * 100)}% flip risk
                      </span>
                    )}
                  </div>
                  <p className={`${typography.panelMeta} text-text-light mt-1`}>
                    {techMode
                      ? `If strength changes significantly, the recommendation may flip.${fragileEdgeSwitchProb !== null ? ` switch_probability: ${fragileEdgeSwitchProb.toFixed(2)}` : ''}`
                      : 'Small changes here could change the recommendation. If this effect weakens significantly, the alternative option may overtake the current leader.'}
                  </p>
                  {/* E-value: assumption robustness indicator (ISL, gated on presence) */}
                  {edgeEValue != null && (
                    <p className={`${typography.panelMeta} mt-1.5 ${edgeEValue > 3 ? 'text-success' : edgeEValue >= 1.5 ? 'text-warning' : 'text-danger'}`}>
                      Assumption robustness: {edgeEValue.toFixed(1)}x
                      {techMode ? '' : '. This assumption would need to be ' + edgeEValue.toFixed(1) + 'x wrong to change the recommendation'}
                    </p>
                  )}
                </div>
              </StaleGuardBanner>
            </>
          )}

          {/* Coaching moved to after strength section (line ~300) */}
        </>
      )}

      {/* Technical disclosure — structured advanced editor */}
      <TechnicalDisclosure visible={techMode}>
        <EdgeAdvancedEditor edgeId={edgeId} />
      </TechnicalDisclosure>

      {/* Live region for announcements */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only" />
    </div>
  )
})

// ---------------------------------------------------------------------------
// CausalClaimsSection — Scientific basis for an edge (Phase 2A)
// ---------------------------------------------------------------------------

const MAX_CLAIMS_VISIBLE = 3

/** @internal Exported for testing only */
export function CausalClaimsSection({ edgeId, edgeData }: { edgeId: string; edgeData: Record<string, unknown> }) {
  const claims = useMemo(() => extractCausalClaims(edgeData), [edgeData])
  const [expanded, setExpanded] = useState(false)

  const visible = expanded ? claims : claims.slice(0, MAX_CLAIMS_VISIBLE)
  const remaining = claims.length - MAX_CLAIMS_VISIBLE

  const handleExpand = () => {
    setExpanded(true)
    const state = useCanvasStore.getState()
    trackGuidance('CAUSAL_CLAIM_EXPANDED', {
      item_id: edgeId,
      item_type: 'claim',
      surface: 'inspector',
      scenario_id: state.currentScenarioId ?? undefined,
      profile_stage: (state.currentStage ?? undefined) as 'frame' | 'ideate' | 'evaluate' | 'decide' | undefined,
    })
  }

  return (
    <>
      <SectionTitle icon={SECTION_TITLES.scientificBasis.icon} label={SECTION_TITLES.scientificBasis.label} />

      {claims.length === 0 ? (
        <p className={`${typography.panelMeta} text-text-light`}>
          No scientific claims attached to this relationship.
        </p>
      ) : (
        <div className="space-y-2">
          {visible.map((claim) => (
            <div key={`${claim.claim_type}-${claim.statement.slice(0, 40)}`} className="bg-panel border border-panel-border rounded-lg p-2.5 space-y-1">
              <span
                className={`${typography.panelMeta} font-medium inline-flex items-center px-1.5 py-0.5 rounded-full bg-transparent border border-info/30 text-text-body`}
              >
                {claimTypeLabel(claim.claim_type)}
              </span>
              <p className={`${typography.panelBody} text-text-body`}>{claim.statement}</p>
              {claim.source && (
                <p className={`${typography.panelMeta} text-text-light`}>{claim.source}</p>
              )}
            </div>
          ))}

          {remaining > 0 && !expanded && (
            <button
              type="button"
              onClick={handleExpand}
              className={`${typography.panelMeta} text-info hover:underline inline-flex items-center gap-1`}
            >
              and {remaining} more
              <ChevronDown className="w-3 h-3" aria-hidden="true" />
            </button>
          )}

          {expanded && remaining > 0 && (
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className={`${typography.panelMeta} text-info hover:underline inline-flex items-center gap-1`}
            >
              Show fewer
              <ChevronRight className="w-3 h-3" aria-hidden="true" />
            </button>
          )}
        </div>
      )}
    </>
  )
}
