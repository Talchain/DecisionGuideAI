/**
 * FactorsSection — factor cards sorted by influence (post-analysis) or alphabetically.
 *
 * Each card shows:
 *   - Label (clickable → canvas focus)
 *   - Category pill (Controllable / Observable / External)
 *   - Value chip (editable, auto-tags source: 'user')
 *   - Source provenance pill
 *   - Influence bar (post-analysis only)
 *
 * External factors show prior range instead of value.
 * "Show full detail" expansion: normalised value, cap, uncertainty drivers, node ID.
 */

import { useCallback, useContext, useEffect, useMemo, useRef } from 'react'
import type { Node } from '@xyflow/react'
import { Info } from 'lucide-react'
import { typography } from '../../../styles/typography'
import { useCanvasStore } from '../../store'
import { SectionErrorBoundary } from '../GraphTextView'
import { focusNodeById } from '../../utils/focusHelpers'
import { formatSmartNumber, formatValueWithUnit, getPrimaryValue, countFactorsToVerify } from './utils'
import { InlineEdit } from './InlineEdit'
import { SourceProvenancePill } from './SourceProvenancePill'
import { DataBar } from '../../ui/shared/DataBar'
import { DetailToggleContext } from './DetailToggleContext'
import type { ObservedState, FactorInfluenceMap } from './types'

// ── Category badge ─────────────────────────────────────────────────────────────

const CATEGORY_STYLES: Record<string, { border: string; label: string }> = {
  controllable: { border: 'border-info/30', label: 'Controllable' },
  observable:   { border: 'border-factor/30', label: 'Observable' },
  external:     { border: 'border-warning/30', label: 'External' },
}

function CategoryBadge({ category }: { category?: string }) {
  if (!category) return null
  const style = CATEGORY_STYLES[category]
  if (!style) return null
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full ${typography.panelMeta} font-medium bg-transparent border ${style.border} text-text-body`}
    >
      {style.label}
    </span>
  )
}

// ── Attribution stability pill ────────────────────────────────────────────────

const STABILITY_STYLES: Record<string, { border: string; label: string }> = {
  high:       { border: 'border-success/30', label: 'High stability' },
  moderate:   { border: 'border-info/30', label: 'Moderate stability' },
  low:        { border: 'border-warning/30', label: 'Low stability' },
  negligible: { border: 'border-danger/30', label: 'Negligible stability' },
}

function AttributionStabilityPill({ level }: { level: string | undefined }) {
  if (!level) return null
  const style = STABILITY_STYLES[level]
  if (!style) return null
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full ${typography.panelMeta} font-medium bg-transparent border ${style.border} text-text-body`}
      data-testid="attribution-stability-pill"
    >
      {style.label}
    </span>
  )
}

// ── Range derivation badge ───────────────────────────────────────────────────

/** Non-confirmed tiers that warrant an "Estimated range" badge */
const ESTIMATED_RANGE_SOURCES = new Set([
  'inferred_baseline', 'inferred_value', 'inferred_spread', 'default',
])

function RangeDerivationBadge({ source }: { source: string | undefined }) {
  if (!source || !ESTIMATED_RANGE_SOURCES.has(source)) return null
  const tooltip = `Range estimated from ${source.replace(/_/g, ' ')}. Consider confirming the plausible range.`
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full ${typography.panelMeta} font-medium bg-transparent border border-danger/30 text-text-body`}
      title={tooltip}
      data-testid="range-derivation-badge"
    >
      Estimated range
    </span>
  )
}

// ── Synthesised prior ─────────────────────────────────────────────────────────

export interface SynthesisedPrior {
  rangeMin: number
  rangeMax: number
}

// ── Factor card ────────────────────────────────────────────────────────────────

function FactorCard({
  node,
  influence,
  synthesisedPrior,
  isSelected,
  evpiPp,
  attributionStability,
  showAttributionStability,
  hasAnalysisData,
  elasticity,
  rankFlipRate,
  factorConfidence,
}: {
  node: Node
  influence: number | undefined
  synthesisedPrior?: SynthesisedPrior
  isSelected?: boolean
  /** EVPI in percentage points (from evpi_percentage_points or VOI * 100 fallback) */
  evpiPp?: number
  /** Attribution stability label from PLoT (when present) */
  attributionStability?: string
  /** Whether to show the stability pill — hidden when all factors share same label */
  showAttributionStability?: boolean
  /** Whether post-analysis data is available */
  hasAnalysisData?: boolean
  /** Elasticity value from PLoT */
  elasticity?: number
  /** Rank flip rate from PLoT bootstrap */
  rankFlipRate?: number
  /** Factor confidence from PLoT (0-1) */
  factorConfidence?: number
}) {
  const cardRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (isSelected) {
      cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [isSelected])
  const { showDetail } = useContext(DetailToggleContext)
  const updateNode = useCanvasStore(s => s.updateNode)

  const data = node.data as Record<string, unknown>
  const label = String(data?.label ?? node.id)
  const category = data?.category as string | undefined
  const obs: ObservedState = ((data?.observedState ?? data?.observed_state ?? {}) as ObservedState)
  const isExternal = category === 'external'
  const rangeDerivationSource = obs.range_derivation_source as string | undefined

  const explicitPriorMin: number | undefined = (data?.prior as Record<string, unknown>)?.range_min as number | undefined
  const explicitPriorMax: number | undefined = (data?.prior as Record<string, unknown>)?.range_max as number | undefined
  const hasExplicitPrior = explicitPriorMin !== undefined && explicitPriorMax !== undefined
  const priorSource = (data?.prior as Record<string, unknown>)?.source as string | undefined

  // Fall back to synthesised prior when no explicit prior set
  const priorRangeMin = hasExplicitPrior ? explicitPriorMin : synthesisedPrior?.rangeMin
  const priorRangeMax = hasExplicitPrior ? explicitPriorMax : synthesisedPrior?.rangeMax
  const hasPriorRange = priorRangeMin !== undefined && priorRangeMax !== undefined
  const isSynthesisedPrior = hasExplicitPrior
    ? priorSource === 'synthesised_from_observed_state'
    : synthesisedPrior !== undefined

  const primaryValue = getPrimaryValue(obs)
  const normalisedValue = obs.value !== undefined ? formatSmartNumber(obs.value) : null

  const validateNumeric = useCallback((s: string) => !isNaN(parseFloat(s)), [])

  const handleValueSave = useCallback((val: string) => {
    const num = parseFloat(val)
    if (isNaN(num)) return
    updateNode(node.id, {
      data: { ...data, observedState: { ...obs, value: num, source: 'user' } },
    })
  }, [node.id, data, obs, updateNode])

  const handleRawValueSave = useCallback((val: string) => {
    const num = parseFloat(val)
    if (isNaN(num)) return
    updateNode(node.id, {
      data: { ...data, observedState: { ...obs, raw_value: num, source: 'user' } },
    })
  }, [node.id, data, obs, updateNode])

  const handleBaselineSave = useCallback((val: string) => {
    const num = parseFloat(val)
    if (isNaN(num)) return
    updateNode(node.id, {
      data: { ...data, observedState: { ...obs, baseline: num, source: 'user' } },
    })
  }, [node.id, data, obs, updateNode])

  const handlePriorMinSave = useCallback((val: string) => {
    const num = parseFloat(val)
    if (isNaN(num)) return
    const prior = (data?.prior as Record<string, unknown>) ?? {}
    updateNode(node.id, {
      data: { ...data, prior: { ...prior, range_min: num } },
    })
  }, [node.id, data, updateNode])

  const handlePriorMaxSave = useCallback((val: string) => {
    const num = parseFloat(val)
    if (isNaN(num)) return
    const prior = (data?.prior as Record<string, unknown>) ?? {}
    updateNode(node.id, {
      data: { ...data, prior: { ...prior, range_max: num } },
    })
  }, [node.id, data, updateNode])

  const uncertaintyDrivers = obs.uncertainty_drivers

  return (
    <div
      ref={cardRef}
      className={`bg-panel-hover rounded-lg p-2.5 mb-2 last:mb-0 transition-shadow${isSelected ? ' ring-1 ring-info/50' : ''}`}
      data-testid={`factor-card-${node.id}`}
    >
      {/* Header row: label + badges */}
      <div className="flex items-start gap-1.5 mb-1.5 flex-wrap">
        <button
          type="button"
          onClick={() => focusNodeById(node.id)}
          className={`${typography.panelHeader} text-text-header hover:text-info hover:underline flex-1 min-w-0 text-left leading-snug transition-colors`}
        >
          {label}
        </button>
        <CategoryBadge category={category} />
        <SourceProvenancePill source={obs.source} />
        <RangeDerivationBadge source={rangeDerivationSource} />
      </div>

      {isExternal ? (
        /* External: prior range */
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`${typography.panelMeta} text-text-light w-12 shrink-0`}>Prior</span>
            {hasPriorRange ? (
              <>
                <InlineEdit
                  value={String(priorRangeMin)}
                  displayValue={formatSmartNumber(priorRangeMin!)}
                  onSave={handlePriorMinSave}
                  validate={validateNumeric}
                  maxWidth="max-w-[60px]"
                  numeric
                  testId={`factor-${node.id}-prior-min`}
                />
                <span className={`${typography.panelMeta} text-text-light`}>–</span>
                <InlineEdit
                  value={String(priorRangeMax)}
                  displayValue={formatSmartNumber(priorRangeMax!)}
                  onSave={handlePriorMaxSave}
                  validate={validateNumeric}
                  maxWidth="max-w-[60px]"
                  numeric
                  testId={`factor-${node.id}-prior-max`}
                />
                {isSynthesisedPrior && (
                  <span className={`${typography.panelMeta} text-text-light`}>· from model repair</span>
                )}
              </>
            ) : (
              <>
                <span
                  className={`${typography.panelMeta} text-text-light`}
                  data-testid={`factor-${node.id}-default-range`}
                >
                  0 – 1 (uniform)
                </span>
                <button
                  type="button"
                  onClick={() => focusNodeById(node.id)}
                  className={`inline-flex items-center px-2 py-0.5 rounded-full border border-info/30 text-text-body hover:bg-panel-hover transition-colors ${typography.panelMeta} font-medium`}
                  data-testid={`factor-${node.id}-refine-range`}
                >
                  Refine range
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        /* Non-external: value + baseline + source + influence */
        <div className="space-y-1">
          {/* Value row */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`${typography.panelMeta} text-text-light w-12 shrink-0`}>Value</span>
            {primaryValue !== null ? (
              <InlineEdit
                value={String(obs.raw_value ?? obs.value ?? '')}
                displayValue={primaryValue}
                onSave={handleRawValueSave}
                validate={validateNumeric}
                maxWidth="max-w-[100px]"
                numeric
                tooltip="Click to edit value"
                testId={`factor-${node.id}-raw-value`}
              />
            ) : normalisedValue !== null ? (
              <>
                <InlineEdit
                  value={String(obs.value ?? '')}
                  displayValue={normalisedValue}
                  onSave={handleValueSave}
                  validate={validateNumeric}
                  maxWidth="max-w-[80px]"
                  numeric
                  tooltip="Click to edit value"
                  testId={`factor-${node.id}-value`}
                />
                <span className={`${typography.panelMeta} text-text-light`} data-testid={`factor-${node.id}-normalised-label`}>(normalised)</span>
              </>
            ) : (
              <span
                className={`${typography.panelBody} text-text-light`}
                data-testid={`factor-${node.id}-not-set`}
              >
                Not set
              </span>
            )}
          </div>

          {/* Baseline row */}
          {obs.baseline !== undefined && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={`${typography.panelMeta} text-text-light w-12 shrink-0`}>Baseline</span>
              <InlineEdit
                value={String(obs.baseline)}
                onSave={handleBaselineSave}
                validate={validateNumeric}
                maxWidth="max-w-[80px]"
                numeric
                suffix={obs.unit}
                testId={`factor-${node.id}-baseline`}
              />
            </div>
          )}

          {/* Influence bar + stability pill (post-analysis only) */}
          {influence !== undefined && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={`${typography.panelMeta} text-text-light w-12 shrink-0`}>Influence</span>
              <DataBar value={influence} label="Influence" colour="info" trailingLabel={`${Math.round(influence * 100)}%`} />
              {hasAnalysisData && showAttributionStability && <AttributionStabilityPill level={attributionStability} />}
            </div>
          )}

          {/* EVPI chip (post-analysis only) — only when >= 1pp meaningful improvement */}
          {hasAnalysisData && evpiPp != null && Math.round(evpiPp) >= 1 && (
            <div
              className="flex items-start gap-1.5 mt-1.5 p-2 rounded-lg bg-info/[0.06] border border-info/25"
              data-testid={`factor-${node.id}-evpi`}
            >
              <Info className="w-3.5 h-3.5 text-info shrink-0 mt-0.5" aria-hidden="true" />
              <span className={`${typography.panelMeta} text-info leading-relaxed`}>
                Worth {evpiPp}pp if resolved: your knowledge of {label} would improve confidence by {evpiPp} percentage points
              </span>
            </div>
          )}
        </div>
      )}

      {/* Full detail expansion */}
      {showDetail && (
        <div className="mt-2 pt-2 border-t border-panel-border">
          <div className={`${typography.panelMeta} text-text-light font-mono mb-1`}>Factor detail</div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
            {obs.value !== undefined && (
              <>
                <span className={`${typography.panelMeta} text-text-light`}>Normalised value</span>
                <span className={`${typography.panelMeta} text-text-body font-mono text-right`}>
                  {obs.value.toFixed(4)}
                </span>
              </>
            )}
            {obs.cap !== undefined && (
              <>
                <span className={`${typography.panelMeta} text-text-light`}>Cap</span>
                <span className={`${typography.panelMeta} text-text-body font-mono text-right`}>
                  {obs.unit ? formatValueWithUnit(obs.cap, obs.unit) : formatSmartNumber(obs.cap)}
                </span>
              </>
            )}
            {uncertaintyDrivers && uncertaintyDrivers.length > 0 && (
              <>
                <span className={`${typography.panelMeta} text-text-light`}>Uncertainty drivers</span>
                <span className={`${typography.panelMeta} text-text-body text-right`}>
                  {uncertaintyDrivers.join(', ')}
                </span>
              </>
            )}
            {evpiPp != null && (
              <>
                <span className={`${typography.panelMeta} text-text-light`}>EVPI</span>
                <span className={`${typography.panelMeta} text-text-body font-mono text-right`}>
                  {evpiPp}pp
                </span>
              </>
            )}
            {elasticity != null && (
              <>
                <span className={`${typography.panelMeta} text-text-light`}>Elasticity</span>
                <span className={`${typography.panelMeta} text-text-body font-mono text-right`}>
                  {elasticity.toFixed(4)}
                </span>
              </>
            )}
            {rankFlipRate != null && (
              <>
                <span className={`${typography.panelMeta} text-text-light`}>Rank flip rate</span>
                <span className={`${typography.panelMeta} text-text-body font-mono text-right`}>
                  {rankFlipRate.toFixed(4)}
                </span>
              </>
            )}
            {factorConfidence != null && (
              <>
                <span className={`${typography.panelMeta} text-text-light`}>Confidence</span>
                <span className={`${typography.panelMeta} text-text-body font-mono text-right`}>
                  {(factorConfidence * 100).toFixed(0)}%
                </span>
              </>
            )}
            <span className={`${typography.panelMeta} text-text-light`}>Node ID</span>
            <span className={`${typography.panelMeta} text-text-body font-mono text-right truncate`}>
              {node.id}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Section ────────────────────────────────────────────────────────────────────

interface FactorsSectionProps {
  factorNodes: Node[]
  factorInfluence?: FactorInfluenceMap
  synthesisedPriorMap?: Map<string, SynthesisedPrior>
  selectedNodeIds?: Set<string>
  /** EVPI map: factorId → percentage points */
  evpiMap?: Map<string, number>
  /** Attribution stability map: factorId → level string */
  attributionStabilityMap?: Map<string, string>
  /** Elasticity map: factorId → raw elasticity */
  elasticityMap?: Map<string, number>
  /** Rank flip rate map: factorId → rate */
  rankFlipRateMap?: Map<string, number>
  /** Factor confidence map: factorId → confidence (0-1) */
  factorConfidenceMap?: Map<string, number>
  /** Whether post-analysis data is available */
  hasAnalysisData?: boolean
}

function FactorsSectionInner({
  factorNodes, factorInfluence, synthesisedPriorMap, selectedNodeIds,
  evpiMap, attributionStabilityMap, elasticityMap, rankFlipRateMap, factorConfidenceMap,
  hasAnalysisData,
}: FactorsSectionProps) {
  // All hooks must run before any conditional return (Rules of Hooks)

  // Only show stability pills when there is differentiation across factors.
  // If every factor has the same label (or none have data), pills add no information.
  const showAttributionStability = useMemo(() => {
    if (!attributionStabilityMap || attributionStabilityMap.size === 0) return false
    const labels = new Set(attributionStabilityMap.values())
    return labels.size > 1
  }, [attributionStabilityMap])

  const sorted = useMemo(() => {
    // Post-analysis with EVPI data: sort by EVPI descending (gated on analysis state)
    if (hasAnalysisData && evpiMap && evpiMap.size > 0) {
      return [...factorNodes].sort((a, b) => {
        const ea = evpiMap.get(a.id) ?? -1
        const eb = evpiMap.get(b.id) ?? -1
        return eb - ea
      })
    }
    // Post-analysis with influence (no EVPI): sort by influence descending
    if (hasAnalysisData && factorInfluence && factorInfluence.size > 0) {
      return [...factorNodes].sort((a, b) => {
        const ia = factorInfluence.get(a.id) ?? -1
        const ib = factorInfluence.get(b.id) ?? -1
        return ib - ia
      })
    }
    // Pre-analysis: alphabetical
    return [...factorNodes].sort((a, b) => {
      const la = String((a.data as Record<string, unknown>)?.label ?? a.id).toLowerCase()
      const lb = String((b.data as Record<string, unknown>)?.label ?? b.id).toLowerCase()
      return la.localeCompare(lb)
    })
  }, [factorNodes, factorInfluence, evpiMap, hasAnalysisData])

  const toVerifyCount = useMemo(() => countFactorsToVerify(factorNodes), [factorNodes])

  if (factorNodes.length === 0) return null

  return (
    <div className="bg-panel border border-panel-border rounded-xl p-3" data-testid="model-factors-section">
      {/* Section header */}
      <div className="flex items-center gap-2 mb-2">
        <div className="w-3 h-3 bg-factor rounded-full shrink-0" aria-hidden="true" />
        <span className={`${typography.panelHeader} text-text-header`}>Factors</span>
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full bg-transparent border border-panel-border text-text-body ${typography.panelMeta} font-medium`}>
          {factorNodes.length}
        </span>
        {toVerifyCount > 0 && (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full bg-transparent border border-warning/30 text-text-body ${typography.panelMeta} font-medium`}
            data-testid="factors-to-verify-badge"
          >
            {toVerifyCount} to verify
          </span>
        )}
      </div>

      {sorted.map(node => (
        <FactorCard
          key={node.id}
          node={node}
          influence={factorInfluence?.get(node.id)}
          synthesisedPrior={synthesisedPriorMap?.get(node.id)}
          isSelected={selectedNodeIds?.has(node.id)}
          evpiPp={evpiMap?.get(node.id)}
          attributionStability={attributionStabilityMap?.get(node.id)}
          showAttributionStability={showAttributionStability}
          elasticity={elasticityMap?.get(node.id)}
          rankFlipRate={rankFlipRateMap?.get(node.id)}
          factorConfidence={factorConfidenceMap?.get(node.id)}
          hasAnalysisData={hasAnalysisData}
        />
      ))}
    </div>
  )
}

export function FactorsSection(props: FactorsSectionProps) {
  return (
    <SectionErrorBoundary section="factors">
      <FactorsSectionInner {...props} />
    </SectionErrorBoundary>
  )
}
