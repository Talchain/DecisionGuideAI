/**
 * EdgePanel — Inspector panel for edges (v6.2 three-group layout)
 *
 * Groups: Context → Your input → Evidence
 * Master pattern for all other panel redesigns.
 */

import { memo, useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { ArrowRight, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react'
import { useCanvasStore } from '../../../store'
import { useRobustness, useEdgeEValues } from '../useAnalysisResults'
import { useEditConfirmation } from '../useEditConfirmation'
import { EditConfirmation } from '../shared/EditConfirmation'
import { InlineRerunPrompt } from '../shared/InlineRerunPrompt'
import { EDGE_CONSTRAINTS } from '../../../domain/edges'
import type { NodeType } from '../../../domain/nodes'
import { NodeShapeIndicator } from '../../../nodes/NodeShapeIndicator'
import { SignedStrengthSlider } from '../../inspector/SignedStrengthSlider'
import { InspectorCoaching } from '../shared/InspectorCoaching'
import { typography } from '../../../../styles/typography'
import { useEdgeMutations } from '../useInspectorMutations'
import { useStaleGuard } from '../useStaleGuard'
import {
  SECTION_TITLES,
  getStrengthDescription,
  GROUP_LABELS,
  INLINE_LABELS,
  EDGE_LINK_NOTICES,
  EDGE_COPY,
  resolveEdgeLinkTemplate,
} from '../inspectorStrings'
import { PanelGroup } from '../shared/PanelGroup'
import { PrimaryControlCard } from '../shared/PrimaryControlCard'
import { ExpertAnnotation } from '../shared/ExpertAnnotation'
import { StaleGuardBanner } from '../shared/StaleGuardBanner'
import { TechnicalDisclosure } from '../shared/TechnicalDisclosure'
import { UncertaintyBand } from '../shared/UncertaintyBand'
import { ResultsLink } from '../shared/ResultsLink'
import type { InspectorPanelProps } from '../types'
import { isEdgeFragile, getFragileEdgeSwitchProbability } from '../../../utils/fragileEdgeMatch'
import { extractCausalClaims, claimTypeLabel } from '../../../adapters/causalClaimsAdapter'
import { trackGuidance } from '../../../../telemetry/guidanceEvents'
import { resolveCoaching } from '../coachingConfig'
import { useEditImpactPreview } from '../../../hooks/useEditImpactPreview'
import { StrengthBandButtons } from '../shared/StrengthBandButtons'
import { SectionTitle } from '../shared/SectionTitle'
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

  // Organisational / intervention edge gate
  const isOrganisational = sourceKind === 'decision' && targetKind === 'option'
  const isIntervention = sourceKind === 'option' && targetKind === 'factor'

  // UI-SEM-029: Edge weight/direction defaults for display (0.5 / 'positive').
  const weight = edge?.data?.weight ?? 0.5
  const direction = edge?.data?.direction ?? 'positive'
  const signedValue = direction === 'negative' ? -weight : weight
  const beliefExists = edge?.data?.beliefExists ?? EDGE_CONSTRAINTS.beliefExists.default
  const strengthStd = edge?.data?.strengthStd ?? 0.15

  // Local slider state
  const [localStrength, setLocalStrength] = useState(signedValue)
  const [localBelief, setLocalBelief] = useState(beliefExists)
  const [localStd, setLocalStd] = useState(strengthStd)

  // Fragility check
  const isFragile = useMemo(() => {
    if (!robustness?.fragile_edges) return false
    return isEdgeFragile(
      edgeId ?? '',
      edge?.source ?? '',
      edge?.target ?? '',
      robustness.fragile_edges as import('../../../utils/fragileEdgeMatch').FragileEdgeCandidate[],
    )
  }, [robustness, edgeId, edge?.source, edge?.target])

  // E-value for this edge
  const edgeEValue = useMemo(() => {
    if (!edgeEValues || !edgeId) return null
    const entry = edgeEValues.find(ev => ev.edge_id === edgeId)
    return entry?.e_value ?? null
  }, [edgeEValues, edgeId])

  // Switch probability for fragile edge
  const fragileEdgeSwitchProb = useMemo(() => {
    if (!isFragile || !robustness?.fragile_edges) return null
    return getFragileEdgeSwitchProbability(
      edgeId ?? '',
      edge?.source ?? '',
      edge?.target ?? '',
      robustness.fragile_edges as unknown[],
    )
  }, [isFragile, robustness, edgeId, edge?.source, edge?.target])

  // Edit impact preview
  const { previewEdit, clearPreview } = useEditImpactPreview()
  const origStrengthRef = useRef(signedValue)

  // Handlers
  const handleStrengthChange = useCallback((v: number) => {
    setLocalStrength(v)
    mutations.setStrength(v)
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

  // ─── Render ──────────────────────────────────────────────────────

  return (
    <div>
      {/* ── Relationship header ──────────────────────────────────── */}
      <div className="flex items-center gap-2 mt-3 px-3 py-2 bg-panel-hover rounded-lg">
        <NodeShapeIndicator nodeKind={sourceKind} size={16} />
        <span className={`${typography.panelBody} text-text-body truncate`}>{sourceLabel}</span>
        <ArrowRight size={12} className="text-text-light flex-shrink-0" />
        <NodeShapeIndicator nodeKind={targetKind} size={16} />
        <span className={`${typography.panelBody} text-text-body truncate`}>{targetLabel}</span>
      </div>

      {/* ── Organisational / intervention link notices ────────── */}
      {isOrganisational ? (
        <div className="mt-3">
          <p className={`${typography.panelMeta} text-text-light`}>{EDGE_LINK_NOTICES.organisational.title}</p>
          <p className={`${typography.panelMeta} text-text-light mt-1`}>{EDGE_LINK_NOTICES.organisational.body}</p>
        </div>
      ) : isIntervention ? (
        <div className="mt-3" data-testid="intervention-edge-notice">
          <p className={`${typography.panelMeta} text-text-light`}>{EDGE_LINK_NOTICES.intervention.title}</p>
          <p className={`${typography.panelMeta} text-text-light mt-1`}>
            {resolveEdgeLinkTemplate({ sourceLabel, targetLabel })}
          </p>
        </div>
      ) : (
        <>
          {/* ── Context group ─────────────────────────────────── */}
          {isFragile && isResultsMode && (
            <PanelGroup kind="context" label={GROUP_LABELS.context}>
              <StaleGuardBanner isStale={isStale} hasResults={isResultsMode}>
                <div className="bg-panel border border-danger/30 p-2.5 rounded-lg">
                  <div className={`${typography.panelBody} font-medium text-danger flex items-center gap-1`}>
                    <AlertTriangle size={13} className="text-danger" />
                    {INLINE_LABELS.sensitiveAssumption}
                  </div>
                  <p className={`${typography.panelBody} text-text-body mt-1`}>
                    {EDGE_COPY.sensitiveContext}
                  </p>
                  {fragileEdgeSwitchProb !== null && (
                    <p
                      className={`${typography.panelMeta} text-danger mt-1.5`}
                      title={EDGE_COPY.flipRiskTooltip(Math.round(fragileEdgeSwitchProb * 100))}
                    >
                      {Math.round(fragileEdgeSwitchProb * 100)}% flip risk
                    </p>
                  )}
                  {edgeEValue != null && (
                    <p className={`${typography.panelMeta} mt-1.5 ${edgeEValue > 3 ? 'text-success' : edgeEValue >= 1.5 ? 'text-warning' : 'text-danger'}`}>
                      Assumption robustness: {edgeEValue.toFixed(1)}x
                      {!techMode && `. This assumption would need to be ${edgeEValue.toFixed(1)}x wrong to change the result`}
                    </p>
                  )}
                  <ExpertAnnotation techMode={techMode}>
                    switch_probability: {fragileEdgeSwitchProb?.toFixed(2) ?? 'n/a'} · in fragile_edges[]
                  </ExpertAnnotation>
                </div>
              </StaleGuardBanner>
              <div className="mt-2">
                <ResultsLink label={INLINE_LABELS.seeSensitivity} tab="results" />
              </div>
            </PanelGroup>
          )}

          {/* ── Your input group ──────────────────────────────── */}
          <PanelGroup kind="input" label={GROUP_LABELS.input}>
            {/* Strength — primary editing surface */}
            <PrimaryControlCard>
              <p className={`${typography.panelBody} text-text-body mb-1.5`}>
                {INLINE_LABELS.strengthQuestion}
              </p>
              <StrengthBandButtons value={localStrength} onChange={handleStrengthChange} />
              <ExpertAnnotation techMode={techMode} editable value={localStrength} onChange={(v) => { handleStrengthChange(v); }} suffix="β =" step={0.01} min={-1} max={1} />
              {/* Strength pill */}
              <div className="flex justify-between items-center mt-2">
                <span
                  className={`${typography.panelMeta} font-medium inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-transparent text-text-body`}
                  style={{ border: `1px solid ${localStrength >= 0 ? 'var(--success)' : 'var(--danger)'}4D` }}
                >
                  {localStrength >= 0 ? '\u2191' : '\u2193'} {getStrengthDescription(localStrength)}
                </span>
              </div>
              {/* Edit feedback */}
              {lastConfirmed?.field === 'strength' && (
                <div className="flex items-center gap-2 mt-1">
                  <EditConfirmation trigger={lastConfirmed.ts} />
                  <InlineRerunPrompt visible={isStaleAfterEdit} />
                </div>
              )}
              {/* Fine-tune slider */}
              <details className="mt-2">
                <summary className={`${typography.panelMeta} text-info cursor-pointer`}>
                  {INLINE_LABELS.fineTune}
                </summary>
                <div className="mt-1.5">
                  <div className="relative mb-2">
                    <UncertaintyBand strength={localStrength} std={localStd} />
                    <SignedStrengthSlider value={localStrength} onChange={handleStrengthChange} onBlur={handleStrengthBlur} std={localStd} techMode={techMode} />
                  </div>
                  <div className="flex justify-between">
                    <span className={`${typography.panelMeta} text-text-light`}>{EDGE_COPY.sliderStrongNegative}</span>
                    <span className={`${typography.panelMeta} text-text-light`}>{EDGE_COPY.sliderNoEffect}</span>
                    <span className={`${typography.panelMeta} text-text-light`}>{EDGE_COPY.sliderStrongPositive}</span>
                  </div>
                </div>
              </details>
            </PrimaryControlCard>

            {/* Existence slider — secondary control, outside card */}
            <div className="mt-3">
              <p className={`${typography.panelBody} text-text-body mb-1`} title={EDGE_COPY.existenceTooltip}>
                {INLINE_LABELS.existenceQuestion}
              </p>
              <div className="flex justify-between mb-1">
                <span className={`${typography.panelMeta} text-text-light`}>{EDGE_COPY.sliderMinUnlikely}</span>
                <span className={`${typography.panelMeta} text-text-light`}>{EDGE_COPY.sliderMaxVeryLikely}</span>
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
                <span className={`${typography.panelBody} min-w-[32px] text-right ${thresholdColor(localBelief)}`}>
                  {Math.round(localBelief * 100)}%
                </span>
              </div>
              <ExpertAnnotation techMode={techMode} editable value={localBelief} onChange={handleBeliefChange} suffix="P(exists) =" step={0.01} min={0} max={1} />
            </div>

            {/* Uncertainty — expert mode only */}
            {techMode && (
              <div className="mt-3">
                <p className={`${typography.panelMeta} text-text-light mb-1`}>
                  {INLINE_LABELS.strengthUncertainty}
                </p>
                <div className="flex justify-between mb-1">
                  <span className={`${typography.panelMeta} text-text-light`}>{EDGE_COPY.sliderMinPrecise}</span>
                  <span className={`${typography.panelMeta} text-text-light`}>{EDGE_COPY.sliderMaxUncertain}</span>
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
                  <ExpertAnnotation techMode={techMode} editable value={localStd} onChange={handleStdChange} suffix="σ =" step={0.01} min={0.01} max={0.5} />
                </div>
              </div>
            )}

            {/* Coaching */}
            <InspectorCoaching
              elementId={edgeId}
              panelType="edge"
              fallbackText={resolveCoaching('edgeWeight', { factorName: sourceLabel })}
              labelContext={{ label: `${sourceLabel} \u2192 ${targetLabel}`, sourceLabel, targetLabel }}
            />
          </PanelGroup>

          {/* ── Evidence group ─────────────────────────────────── */}
          <PanelGroup kind="evidence" label={GROUP_LABELS.evidence}>
            {/* Per-edge provenance is stripped by DraftChat (known limitation).
                Default to fixed copy for all edges until un-stripped. */}
            <div className="bg-panel border border-panel-border rounded-lg p-2.5">
              <span
                className={`${typography.panelMeta} font-medium inline-flex items-center px-2.5 py-0.5 rounded-full bg-transparent text-text-body`}
                style={{ border: '1px solid var(--warning)4D' }}
              >
                {EDGE_COPY.noEvidenceTitle}
              </span>
              <p className={`${typography.panelMeta} text-text-light mt-1.5`}>
                {EDGE_COPY.noEvidenceBody}
              </p>
            </div>

            {/* Calibration — contested validation */}
            {(() => {
              const validation = (edge?.data as Record<string, unknown>)?.validation as
                import('../../../../canvas/domain/validation').ValidationMetadata | undefined
              if (!validation || validation.status !== 'contested') return null
              return (
                <div className="mt-2 bg-panel border border-warning/30 rounded-lg p-2.5">
                  <div className={`${typography.panelBody} font-medium text-warning flex items-center gap-1`}>
                    <AlertTriangle size={13} className="text-warning" />
                    {EDGE_COPY.needsYourJudgement}
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
              )
            })()}
          </PanelGroup>

          {/* ── Expert-only model detail ───────────────────────── */}
          <TechnicalDisclosure visible={techMode} label={INLINE_LABELS.modelDetail}>
            <EdgeAdvancedEditor edgeId={edgeId} />
          </TechnicalDisclosure>
        </>
      )}

      {/* For org/intervention edges, still show tech disclosure */}
      {(isOrganisational || isIntervention) && (
        <TechnicalDisclosure visible={techMode} label={INLINE_LABELS.modelDetail}>
          <EdgeAdvancedEditor edgeId={edgeId} />
        </TechnicalDisclosure>
      )}

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
