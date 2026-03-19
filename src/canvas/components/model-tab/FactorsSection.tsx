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

import { useCallback, useContext, useMemo } from 'react'
import type { Node } from '@xyflow/react'
import { typography } from '../../../styles/typography'
import { useCanvasStore } from '../../store'
import { SectionErrorBoundary } from '../GraphTextView'
import { focusNodeById } from '../../utils/focusHelpers'
import { formatSmartNumber, formatValueWithUnit, getPrimaryValue } from './utils'
import { InlineEdit } from './InlineEdit'
import { SourceProvenancePill } from './SourceProvenancePill'
import { InfluenceBar } from './InfluenceBar'
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
}: {
  node: Node
  influence: number | undefined
  synthesisedPrior?: SynthesisedPrior
}) {
  const { showDetail } = useContext(DetailToggleContext)
  const updateNode = useCanvasStore(s => s.updateNode)

  const data = node.data as Record<string, unknown>
  const label = String(data?.label ?? node.id)
  const category = data?.category as string | undefined
  const obs: ObservedState = ((data?.observedState ?? data?.observed_state ?? {}) as ObservedState)
  const isExternal = category === 'external'

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
      className="bg-panel-hover rounded-lg p-2.5 mb-2 last:mb-0"
      data-testid={`factor-card-${node.id}`}
    >
      {/* Header row: label + category badge */}
      <div className="flex items-start gap-2 mb-1.5">
        <button
          type="button"
          onClick={() => focusNodeById(node.id)}
          className={`${typography.panelHeader} text-text-header hover:text-info hover:underline flex-1 min-w-0 text-left leading-snug transition-colors`}
        >
          {label}
        </button>
        <CategoryBadge category={category} />
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
                  onSave={handlePriorMinSave}
                  validate={validateNumeric}
                  maxWidth="max-w-[60px]"
                  numeric
                  testId={`factor-${node.id}-prior-min`}
                />
                <span className={`${typography.panelMeta} text-text-light`}>–</span>
                <InlineEdit
                  value={String(priorRangeMax)}
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
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`${typography.panelMeta} text-text-light w-12 shrink-0`}>Source</span>
            <SourceProvenancePill source={obs.source} />
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
            ) : (
              <InlineEdit
                value=""
                placeholder="—"
                onSave={handleValueSave}
                validate={validateNumeric}
                maxWidth="max-w-[80px]"
                numeric
                testId={`factor-${node.id}-value`}
              />
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

          {/* Source provenance */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`${typography.panelMeta} text-text-light w-12 shrink-0`}>Source</span>
            <SourceProvenancePill source={obs.source} />
          </div>

          {/* Influence bar (post-analysis only) */}
          {influence !== undefined && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={`${typography.panelMeta} text-text-light w-12 shrink-0`}>Influence</span>
              <InfluenceBar influence={influence} />
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
            <span className={`${typography.panelMeta} text-text-light`}>Node ID</span>
            <span className={`${typography.panelMeta} text-[10px] text-text-body font-mono text-right truncate`}>
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
}

function FactorsSectionInner({ factorNodes, factorInfluence, synthesisedPriorMap }: FactorsSectionProps) {
  if (factorNodes.length === 0) return null

  const sorted = useMemo(() => {
    if (factorInfluence && factorInfluence.size > 0) {
      // Post-analysis: sort by influence score descending
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
  }, [factorNodes, factorInfluence])

  return (
    <div className="bg-panel border border-panel-border rounded-xl p-3" data-testid="model-factors-section">
      {/* Section header */}
      <div className="flex items-center gap-2 mb-2">
        <div className="w-3 h-3 bg-factor rounded-full shrink-0" aria-hidden="true" />
        <span className={`${typography.panelHeader} text-text-header`}>Factors</span>
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full bg-transparent border border-panel-border text-text-body ${typography.panelMeta} font-medium`}>
          {factorNodes.length}
        </span>
      </div>

      {sorted.map(node => (
        <FactorCard
          key={node.id}
          node={node}
          influence={factorInfluence?.get(node.id)}
          synthesisedPrior={synthesisedPriorMap?.get(node.id)}
        />
      ))}
    </div>
  )
}

export function FactorsSection({ factorNodes, factorInfluence, synthesisedPriorMap }: FactorsSectionProps) {
  return (
    <SectionErrorBoundary section="factors">
      <FactorsSectionInner
        factorNodes={factorNodes}
        factorInfluence={factorInfluence}
        synthesisedPriorMap={synthesisedPriorMap}
      />
    </SectionErrorBoundary>
  )
}
