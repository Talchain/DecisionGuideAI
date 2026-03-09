/**
 * ModelTabBody — redesigned "Model" tab for the outputs dock (v2)
 *
 * Tasks implemented:
 *  1. Goal headline at top
 *  2. Node breakdown colour bar (6px, 1px gaps)
 *  3. Health summary cards (connectivity + evidence coverage)
 *  4. Attention banner (post-analysis only, fragile/missing-source/default)
 *  5. Factor cards — human-readable values, source mapping, external prior
 *  6. Edge cards — Likelihood label, helps/hurts chips, provenance row, clickable labels
 *  7. Options/Risks/Outcomes collapsed reference section
 *  8. Strengthen section with canonical evidence counting
 *  9. Footer: search + Copy as text
 * 10. Inline editing mechanics (click → edit, blur/Enter saves, Escape cancels)
 *
 * Typography: panelHeader (14px/600) · panelBody (12px/400) · panelMeta (11px/400)
 * British English throughout. Sentence case.
 */

import {
  useState,
  useMemo,
  useCallback,
  useRef,
  useEffect,
  type ReactNode,
  type KeyboardEvent,
  type ChangeEvent,
} from 'react'
import { ChevronDown, ChevronRight, AlertTriangle, Settings, ArrowUpRight, GitBranch, Lightbulb, Link, Copy, ClipboardCopy } from 'lucide-react'
import type { Node, Edge } from '@xyflow/react'
import { typography } from '../../styles/typography'
import { useCanvasStore } from '../store'
import { getDisplayEdgeId, buildFragileEdgeLookup } from '../utils/edgeIdentity'
import { focusNodeById, focusEdgeById } from '../utils/focusHelpers'
import { countEdgesWithEvidence, NON_EVIDENCE_PROVENANCE } from '../utils/evidenceCoverage'
import { SectionErrorBoundary } from './GraphTextView'
import type { MappedRobustness } from '../../lib/mappers/types'
import type { CritiqueItemV1 } from '../../adapters/plot/types'
import { isModelCardLiteEnabled } from '../../flags'
import { ModelCardLite } from './ModelCardLite'
import { selectModelCardData } from '../adapters/modelCardAdapter'
import { trackGuidance } from '../../telemetry/guidanceEvents'

// ── Types ────────────────────────────────────────────────────────────────────

interface ModelTabBodyProps {
  showDebug: boolean
  hasDiagnostics: boolean
  diagnostics: any
  hasTrim: boolean
  effectiveCorrelationId: string | null | undefined
  correlationMismatch: boolean
  correlationIdHeader: string | null | undefined
  nodes: Node[]
  edges: Edge[]
  robustness: MappedRobustness | null
  /** PLoT critique items — used to surface constraint warnings in Strengthen */
  critique?: CritiqueItemV1[] | null
}

interface ObservedState {
  value?: number
  raw_value?: number
  baseline?: number
  unit?: string
  source?: string
  cap?: number
}

// ── Source mapping ────────────────────────────────────────────────────────────

const SOURCE_LABELS: Record<string, string> = {
  brief_extraction: 'From brief',
  cee_inference: 'AI estimate',
  user: 'User provided',
}

const SOURCE_TOOLTIPS: Record<string, string> = {
  brief_extraction: 'Source: brief_extraction',
  cee_inference: 'Source: cee_inference',
  user: 'Source: user',
}

function mapSourceToDisplay(source: string | undefined): string | null {
  if (!source) return null
  return SOURCE_LABELS[source] ?? source
}

function mapSourceToTooltip(source: string | undefined): string | undefined {
  if (!source) return undefined
  return SOURCE_TOOLTIPS[source] ?? `Source: ${source}`
}

// ── Value formatting ─────────────────────────────────────────────────────────

const CURRENCY_SYMBOLS = new Set(['£', '$', '€', '¥', '₹', '₩', '₽', '₺', '₴', '₦', '₫', '₿'])

/** Format value+unit: currency symbols prefix ("£49"), everything else suffixes ("9 months") */
function formatValueWithUnit(rawValue: number, unit: string): string {
  const trimmedUnit = unit.trim()
  if (CURRENCY_SYMBOLS.has(trimmedUnit) || /^[A-Z]{3}$/.test(trimmedUnit)) {
    return `${trimmedUnit}${formatSmartNumber(rawValue)}`
  }
  return `${formatSmartNumber(rawValue)} ${trimmedUnit}`
}

/** Smart number formatting: integers stay integer, decimals use minimal precision (max 2dp, no trailing zeros) */
function formatSmartNumber(n: number): string {
  if (Number.isInteger(n)) return String(n)
  // Up to 2 decimal places, strip trailing zeros
  const fixed = n.toFixed(2)
  return fixed.replace(/\.?0+$/, '')
}

// ── Entity colours (Design System v4 §3.8) ─────────────────────────────────

// Inline colour values used in the breakdown bar segments (CSS variable references)
const SEGMENT_COLOURS: Record<string, string> = {
  goal: 'var(--color-goal, #f59e0b)',
  decision: 'var(--color-info, #3b82f6)',
  option: 'var(--color-option, #8b5cf6)',
  factor: 'var(--color-factor, #6b7280)',
  risk: 'var(--color-danger, #ef4444)',
  outcome: 'var(--color-success, #10b981)',
}

// Tailwind classes for legend dots
const DOT_CLASSES: Record<string, string> = {
  goal: 'bg-goal',
  decision: 'bg-info',
  option: 'bg-option',
  factor: 'bg-factor',
  risk: 'bg-danger',
  outcome: 'bg-success',
}

const KIND_ORDER = ['goal', 'decision', 'option', 'factor', 'risk', 'outcome'] as const
type KindKey = typeof KIND_ORDER[number]

const KIND_LABELS: Record<KindKey, string> = {
  goal: 'Goal',
  decision: 'Decision',
  option: 'Option',
  factor: 'Factor',
  risk: 'Risk',
  outcome: 'Outcome',
}

// ── Inline edit hook ─────────────────────────────────────────────────────────

function useInlineEdit<T extends string | number>(
  savedValue: T,
  onSave: (val: T) => void,
  validate?: (val: string) => boolean,
) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<string>(String(savedValue ?? ''))
  const [invalid, setInvalid] = useState(false)

  const startEdit = useCallback(() => {
    setDraft(String(savedValue ?? ''))
    setInvalid(false)
    setEditing(true)
  }, [savedValue])

  const commit = useCallback(() => {
    if (validate && !validate(draft)) {
      setInvalid(true)
      return
    }
    setInvalid(false)
    setEditing(false)
    const coerced = (typeof savedValue === 'number' ? parseFloat(draft) : draft) as T
    if (draft !== String(savedValue)) onSave(coerced)
  }, [draft, savedValue, onSave, validate])

  const cancel = useCallback(() => {
    setDraft(String(savedValue ?? ''))
    setInvalid(false)
    setEditing(false)
  }, [savedValue])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') { e.preventDefault(); commit() }
      if (e.key === 'Escape') { e.preventDefault(); cancel() }
    },
    [commit, cancel],
  )

  return { editing, draft, invalid, setDraft, startEdit, commit, cancel, handleKeyDown }
}

// ── Inline text input ────────────────────────────────────────────────────────

interface InlineEditProps {
  value: string
  /** Override what is shown in read mode (e.g. a friendly display label). Edits still operate on `value`. */
  displayValue?: string
  placeholder?: string
  onSave: (val: string) => void
  validate?: (val: string) => boolean
  maxWidth?: string
  numeric?: boolean
  prefix?: string
  suffix?: string
  testId?: string
  /** Tooltip shown on the read-mode display element */
  tooltip?: string
}

function InlineEdit({
  value,
  displayValue,
  placeholder = '—',
  onSave,
  validate,
  maxWidth = 'max-w-[120px]',
  numeric = false,
  prefix,
  suffix,
  testId,
  tooltip,
}: InlineEditProps) {
  const { editing, draft, invalid, setDraft, startEdit, commit, cancel, handleKeyDown } =
    useInlineEdit(value, onSave, validate)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFocus = useCallback(() => {
    startEdit()
    setTimeout(() => inputRef.current?.select(), 0)
  }, [startEdit])

  if (editing) {
    return (
      <span className="inline-flex items-center gap-0.5">
        {prefix && <span className={`${typography.panelMeta} text-text-light`}>{prefix}</span>}
        <input
          ref={inputRef}
          type={numeric ? 'number' : 'text'}
          value={draft}
          autoFocus
          onChange={(e: ChangeEvent<HTMLInputElement>) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          className={`${maxWidth} ${typography.panelBody} text-text-header px-2 py-0.5 rounded-sm border ${
            invalid ? 'border-danger' : 'border-panel-border hover:border-info/30'
          } bg-panel focus:outline-none focus:ring-1 focus:ring-info/50`}
          data-testid={testId}
        />
        {suffix && <span className={`${typography.panelMeta} text-text-light`}>{suffix}</span>}
      </span>
    )
  }

  return (
    <span
      role="button"
      tabIndex={0}
      onClick={handleFocus}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleFocus() }}
      className="inline-flex items-center gap-0.5 cursor-text rounded-sm border border-transparent hover:bg-panel-hover hover:border-panel-border px-1 -mx-1 transition-colors"
      title={tooltip ?? 'Click to edit'}
      data-testid={testId ? `${testId}-display` : undefined}
    >
      {prefix && <span className={`${typography.panelMeta} text-text-light`}>{prefix}</span>}
      <span className={`${typography.panelBody} ${(displayValue ?? value) ? 'text-text-header' : 'text-text-light'}`}>
        {(displayValue ?? value) || placeholder}
      </span>
      {suffix && <span className={`${typography.panelMeta} text-text-light ml-0.5`}>{suffix}</span>}
    </span>
  )
}

// ── Add-source pill button ────────────────────────────────────────────────────

function AddSourcePill({ onSave }: { onSave: (val: string) => void }) {
  const { editing, draft, invalid, setDraft, startEdit, commit, handleKeyDown } =
    useInlineEdit('', onSave, (s) => s.trim().length > 0)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleClick = useCallback(() => {
    startEdit()
    setTimeout(() => inputRef.current?.focus(), 0)
  }, [startEdit])

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={draft}
        autoFocus
        placeholder="Enter source…"
        onChange={(e: ChangeEvent<HTMLInputElement>) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        className={`max-w-[140px] ${typography.panelBody} text-text-header px-2 py-0.5 rounded-sm border ${
          invalid ? 'border-danger' : 'border-panel-border'
        } bg-panel focus:outline-none focus:ring-1 focus:ring-info/50`}
      />
    )
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex items-center px-3 py-1 rounded-full border border-info/30 text-text-body hover:bg-panel-hover transition-colors ${typography.panelMeta} font-medium`}
    >
      + Add source
    </button>
  )
}

// ── Category badge ────────────────────────────────────────────────────────────

const CATEGORY_STYLES: Record<string, { border: string; label: string }> = {
  controllable: { border: 'border-info/30', label: 'Controllable' },
  observable: { border: 'border-factor/30', label: 'Observable' },
  external: { border: 'border-warning/30', label: 'External' },
}

function CategoryBadge({ category }: { category?: string }) {
  if (!category) return null
  const style = CATEGORY_STYLES[category]
  if (!style) return null
  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full ${typography.panelMeta} font-medium bg-transparent border ${style.border} text-text-body`}
    >
      {style.label}
    </span>
  )
}

// ── Synthesised prior lookup ──────────────────────────────────────────────────

interface SynthesisedPrior {
  rangeMin: number
  rangeMax: number
}

/**
 * Parse repair actions from ceePipelineTrace to find synthesised priors.
 * Actions look like: 'Reclassified unreachable factor "X" to external with synthesised prior [0, 0.14]'
 * Returns a map from node ID → { rangeMin, rangeMax }.
 */
function buildSynthesisedPriorMap(
  ceePipelineTrace: unknown,
  nodes: Node[],
): Map<string, SynthesisedPrior> {
  const map = new Map<string, SynthesisedPrior>()
  if (!ceePipelineTrace || typeof ceePipelineTrace !== 'object') return map

  const trace = ceePipelineTrace as Record<string, unknown>
  const repairSummary = trace.repair_summary ?? trace.repair
  if (!repairSummary || typeof repairSummary !== 'object') return map

  const summary = repairSummary as Record<string, unknown>
  const repairs = summary.deterministic_repairs
  if (!Array.isArray(repairs)) return map

  // Build label→id lookup for matching
  const labelToId = new Map<string, string>()
  for (const n of nodes) {
    const label = String((n.data as any)?.label ?? '').toLowerCase()
    if (label) labelToId.set(label, n.id)
  }

  for (const r of repairs) {
    if (!r || typeof r !== 'object') continue
    const repair = r as Record<string, unknown>

    // Structured fields (if CEE provides them)
    if (repair.node_id && repair.synthesised_range && Array.isArray(repair.synthesised_range)) {
      const [min, max] = repair.synthesised_range as number[]
      if (typeof min === 'number' && typeof max === 'number') {
        map.set(String(repair.node_id), { rangeMin: min, rangeMax: max })
        continue
      }
    }

    // Fallback: parse from action text
    const action = typeof repair.action === 'string' ? repair.action : ''
    const match = action.match(/synthesised prior\s*\[([^\]]+)\]/i)
    if (!match) continue
    const parts = match[1].split(',').map(s => parseFloat(s.trim()))
    if (parts.length !== 2 || parts.some(isNaN)) continue

    // Try to match by node_id first, then by quoted label in action text
    let nodeId = repair.node_id ? String(repair.node_id) : undefined
    if (!nodeId) {
      const labelMatch = action.match(/"([^"]+)"/)
      if (labelMatch) {
        nodeId = labelToId.get(labelMatch[1].toLowerCase())
      }
    }
    if (nodeId) {
      map.set(nodeId, { rangeMin: parts[0], rangeMax: parts[1] })
    }
  }

  return map
}

// ── Factor card ───────────────────────────────────────────────────────────────

function FactorCard({ node, synthesisedPrior, isHighlighted, onHover, onLeave }: {
  node: Node
  synthesisedPrior?: SynthesisedPrior
  isHighlighted?: boolean
  onHover?: (id: string) => void
  onLeave?: () => void
}) {
  const updateNode = useCanvasStore(s => s.updateNode)

  const data = node.data as any
  const label = String(data?.label ?? node.id)
  const category = data?.category as string | undefined
  const obs: ObservedState = (data?.observedState ?? data?.observed_state ?? {}) as ObservedState
  const isExternal = category === 'external'

  const explicitPriorMin: number | undefined = data?.prior?.range_min ?? data?.priorRangeMin
  const explicitPriorMax: number | undefined = data?.prior?.range_max ?? data?.priorRangeMax
  const priorSource: string | undefined = data?.prior?.source
  const hasExplicitPrior = explicitPriorMin !== undefined && explicitPriorMax !== undefined

  // Fall back to synthesised prior from repair summary when node has no explicit prior
  const priorRangeMin = hasExplicitPrior ? explicitPriorMin : synthesisedPrior?.rangeMin
  const priorRangeMax = hasExplicitPrior ? explicitPriorMax : synthesisedPrior?.rangeMax
  const hasPriorRange = priorRangeMin !== undefined && priorRangeMax !== undefined
  const isSynthesisedPrior = hasExplicitPrior
    ? priorSource === 'synthesised_from_observed_state'
    : synthesisedPrior !== undefined

  // Human-readable primary value: prefer raw_value+unit, then normalised value
  const primaryValue = obs.raw_value !== undefined && obs.unit
    ? formatValueWithUnit(obs.raw_value, obs.unit)
    : obs.raw_value !== undefined
      ? formatSmartNumber(obs.raw_value)
      : null

  const normalisedValue = obs.value !== undefined ? formatSmartNumber(obs.value) : null

  // Derive scale description from label parenthetical e.g. "(0–1)" or "(0/1)"
  const scaleMatch = label.match(/\(([^)]+)\)/)
  const scaleDesc = scaleMatch ? scaleMatch[1] : 'uniform'

  // Full-range external with no brief context
  const isFullRange = isExternal
    && (priorRangeMin === undefined || priorRangeMin === 0)
    && (priorRangeMax === undefined || priorRangeMax === 1)

  const validateNumeric = useCallback((s: string) => !isNaN(parseFloat(s)), [])

  const handleValueSave = useCallback((val: string) => {
    const num = parseFloat(val)
    if (isNaN(num)) return
    updateNode(node.id, { data: { ...data, observedState: { ...obs, value: num } } })
  }, [node.id, data, obs, updateNode])

  const handleBaselineSave = useCallback((val: string) => {
    const num = parseFloat(val)
    if (isNaN(num)) return
    updateNode(node.id, { data: { ...data, observedState: { ...obs, baseline: num } } })
  }, [node.id, data, obs, updateNode])

  const handleSourceSave = useCallback((val: string) => {
    updateNode(node.id, { data: { ...data, observedState: { ...obs, source: val || undefined } } })
  }, [node.id, data, obs, updateNode])

  const handlePriorMinSave = useCallback((val: string) => {
    const num = parseFloat(val)
    if (isNaN(num)) return
    updateNode(node.id, { data: { ...data, prior: { ...(data?.prior ?? {}), range_min: num } } })
  }, [node.id, data, updateNode])

  const handlePriorMaxSave = useCallback((val: string) => {
    const num = parseFloat(val)
    if (isNaN(num)) return
    updateNode(node.id, { data: { ...data, prior: { ...(data?.prior ?? {}), range_max: num } } })
  }, [node.id, data, updateNode])

  return (
    <div
      className={`bg-panel border border-factor/30 rounded-sm p-2.5 mb-1.5 hover:border-info/30 transition-all duration-200 ${
        isHighlighted ? 'bg-panel shadow-2' : ''
      }`}
      onMouseEnter={() => onHover?.(node.id)}
      onMouseLeave={onLeave}
    >
      {/* Header row: label as focus link + category badge */}
      <div className="flex items-start gap-2 mb-1.5">
        <button
          type="button"
          onClick={() => focusNodeById(node.id)}
          className={`${typography.panelHeader} text-info hover:underline flex-1 min-w-0 text-left leading-snug`}
        >
          {label}
        </button>
        <CategoryBadge category={category} />
      </div>

      {isExternal ? (
        /* External: prior range + scale description + source */
        <div className="space-y-0.5">
          <div className="flex items-center gap-1 flex-wrap">
            <span className={`${typography.panelMeta} text-text-light w-14 shrink-0`}>Prior</span>
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
                <span className={`${typography.panelMeta} text-text-light`}>
                  · {scaleDesc}{isSynthesisedPrior ? ' · from model repair' : ''}
                </span>
              </>
            ) : (
              /* No prior set — show implicit 0–1 uniform default, not "no range specified" */
              <>
                <span
                  className={`${typography.panelMeta} text-text-light`}
                  data-testid={`factor-${node.id}-default-range`}
                >
                  0 – 1 (uniform) · default range
                </span>
                <button
                  type="button"
                  onClick={() => focusNodeById(node.id)}
                  className={`inline-flex items-center px-3 py-1 rounded-full border border-info/30 text-text-body hover:bg-panel-hover transition-colors ${typography.panelMeta} font-medium`}
                  data-testid={`factor-${node.id}-refine-range`}
                >
                  Refine range
                </button>
              </>
            )}
          </div>
          {/* Source row — external factors can also have a source */}
          <div className="flex items-center gap-1 flex-wrap">
            <span className={`${typography.panelMeta} text-text-light w-14 shrink-0`}>Source</span>
            {obs.source ? (
              <InlineEdit
                value={obs.source}
                displayValue={mapSourceToDisplay(obs.source) ?? undefined}
                tooltip={mapSourceToTooltip(obs.source)}
                onSave={handleSourceSave}
                maxWidth="max-w-[160px]"
                testId={`factor-${node.id}-source`}
              />
            ) : (
              <AddSourcePill onSave={handleSourceSave} />
            )}
          </div>
        </div>
      ) : (
        /* Non-external: human-readable value row + normalised secondary + source */
        <div className="space-y-0.5">
          {/* Value row */}
          <div className="flex items-center gap-2 flex-wrap">
            {primaryValue !== null ? (
              <span className={`${typography.panelBody} text-text-header`}>{primaryValue}</span>
            ) : normalisedValue !== null ? (
              <span className={`${typography.panelBody} text-text-header`}>{normalisedValue}</span>
            ) : (
              <span className={`${typography.panelBody} text-text-light`}>—</span>
            )}
            {/* Normalised secondary — clickable to edit */}
            {primaryValue !== null && normalisedValue !== null && (
              <InlineEdit
                value={normalisedValue}
                onSave={handleValueSave}
                validate={validateNumeric}
                maxWidth="max-w-[70px]"
                numeric
                prefix="normalised:"
                testId={`factor-${node.id}-value`}
              />
            )}
            {primaryValue === null && normalisedValue === null && (
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
            {primaryValue === null && normalisedValue !== null && obs.unit && (
              <span className={`${typography.panelMeta} text-text-light`}>{obs.unit}</span>
            )}
          </div>

          {/* Baseline row (when value is present) */}
          {obs.baseline !== undefined && (
            <div className="flex items-center gap-1 flex-wrap">
              <span className={`${typography.panelMeta} text-text-light w-14 shrink-0`}>Baseline</span>
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

          {/* Source row */}
          <div className="flex items-center gap-1 flex-wrap">
            <span className={`${typography.panelMeta} text-text-light w-14 shrink-0`}>Source</span>
            {obs.source ? (
              <InlineEdit
                value={obs.source}
                displayValue={mapSourceToDisplay(obs.source) ?? undefined}
                tooltip={mapSourceToTooltip(obs.source)}
                onSave={handleSourceSave}
                maxWidth="max-w-[160px]"
                testId={`factor-${node.id}-source`}
              />
            ) : (
              <AddSourcePill onSave={handleSourceSave} />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Edge card ─────────────────────────────────────────────────────────────────

function EdgeCard({
  edge,
  nodes,
  fragileEdgeIds,
  fragileEdgeSwitchProbMap,
  hasRobustnessData,
  isHighlighted,
  onHover,
  onLeave,
}: {
  edge: Edge
  nodes: Node[]
  fragileEdgeIds: Set<string>
  fragileEdgeSwitchProbMap: Map<string, number>
  hasRobustnessData: boolean
  isHighlighted?: boolean
  onHover?: (id: string) => void
  onLeave?: () => void
}) {
  const updateEdge = useCanvasStore(s => s.updateEdge)

  const data = edge.data as any
  const edgeId = getDisplayEdgeId(edge)

  const isFragile = hasRobustnessData && fragileEdgeIds.has(edgeId)
  const switchProbability = fragileEdgeSwitchProbMap.get(edgeId)

  const sourceNode = nodes.find(n => n.id === edge.source)
  const targetNode = nodes.find(n => n.id === edge.target)
  const fromLabel = String((sourceNode?.data as any)?.label ?? edge.source)
  const toLabel = String((targetNode?.data as any)?.label ?? edge.target)

  const weight = data?.weight ?? 0.5
  const direction = data?.direction ?? 'positive'
  const signedMean = direction === 'negative' ? -weight : weight
  const strengthStd = data?.strengthStd ?? data?.strength_std

  // Likelihood = exists_probability (renamed from Confidence)
  const beliefExists = data?.beliefExists ?? data?.exists_probability ?? data?.confidence ?? data?.belief ?? 0.7
  const likelihoodPct = Math.round(beliefExists * 100)

  // Likelihood colour: evaluative thresholds (§11.6) — success ≥70%, warning 40–69%, danger <40%
  const likelihoodColour = likelihoodPct >= 70
    ? 'bg-success'
    : likelihoodPct >= 40
      ? 'bg-warning'
      : 'bg-danger'

  // Direction chip
  const isPositive = signedMean >= 0
  const directionChip = isPositive
    ? { label: 'helps', border: 'border-success/30' }
    : { label: 'hurts', border: 'border-danger/30' }

  // Provenance
  const provenance = data?.provenance as string | undefined
  const hasEvidence = provenance && !NON_EVIDENCE_PROVENANCE.includes(provenance)
  const origin = data?.origin as string | undefined

  const validateEffect = useCallback((s: string) => {
    const n = parseFloat(s)
    return !isNaN(n) && n >= -1 && n <= 1
  }, [])

  const validateLikelihood = useCallback((s: string) => {
    const n = parseFloat(s)
    return !isNaN(n) && n >= 0 && n <= 100
  }, [])

  const handleEffectSave = useCallback((val: string) => {
    const n = parseFloat(val)
    if (isNaN(n) || n < -1 || n > 1) return
    updateEdge(edgeId, {
      data: { ...data, weight: Math.abs(n), direction: n >= 0 ? 'positive' : 'negative' },
    })
  }, [edgeId, data, updateEdge])

  const handleLikelihoodSave = useCallback((val: string) => {
    const pct = parseFloat(val)
    if (isNaN(pct) || pct < 0 || pct > 100) return
    updateEdge(edgeId, { data: { ...data, beliefExists: pct / 100 } })
  }, [edgeId, data, updateEdge])

  const effectDisplay = signedMean >= 0 ? `+${signedMean.toFixed(2)}` : signedMean.toFixed(2)

  const fragileTooltip = switchProbability !== undefined
    ? `${Math.round(switchProbability * 100)}% chance of flipping the recommendation to a different option`
    : 'Fragile — sensitive to assumption changes'

  return (
    <div
      className={`bg-panel border border-panel-border rounded-sm p-2.5 mb-1.5 hover:border-info/30 transition-all duration-200 ${
        isHighlighted ? 'shadow-2' : ''
      }`}
      onMouseEnter={() => onHover?.(edgeId)}
      onMouseLeave={onLeave}
    >
      {/* Label row — clickable focus link */}
      <div className="flex items-start gap-1.5 mb-1">
        <button
          type="button"
          onClick={() => focusEdgeById(edgeId)}
          className={`${typography.panelBody} text-info hover:underline flex-1 min-w-0 text-left leading-snug`}
        >
          <span>{fromLabel}</span>
          <span className="text-text-light mx-1">→</span>
          <span>{toLabel}</span>
        </button>
        {isFragile && (
          <span
            className={`inline-flex items-center gap-0.5 px-3 py-1 rounded-full ${typography.panelMeta} font-medium bg-transparent border border-warning/30 text-text-body shrink-0`}
            title={fragileTooltip}
          >
            <AlertTriangle className="w-2.5 h-2.5 shrink-0" aria-hidden="true" />
            fragile
          </span>
        )}
      </div>

      {/* Effect + std + direction chip */}
      <div className="flex items-center gap-3 flex-wrap mb-0.5">
        <div className="flex items-center gap-1">
          <span className={`${typography.panelMeta} text-text-light`}>Effect</span>
          <InlineEdit
            value={effectDisplay}
            onSave={handleEffectSave}
            validate={validateEffect}
            maxWidth="max-w-[70px]"
            numeric
            testId={`edge-${edgeId}-effect`}
          />
          {strengthStd !== undefined && (
            <span className={`${typography.panelMeta} text-text-light`}>
              ±{strengthStd.toFixed(2)}
            </span>
          )}
        </div>
        <span
          className={`inline-flex items-center px-3 py-1 rounded-full ${typography.panelMeta} font-medium bg-transparent border ${directionChip.border} text-text-body`}
        >
          {directionChip.label}
        </span>
      </div>

      {/* Likelihood row with micro-bar */}
      <div className="flex items-center gap-2 mb-0.5">
        <span
          className={`${typography.panelMeta} text-text-light`}
          title="Probability this relationship exists (exists_probability)"
        >
          Likelihood
        </span>
        <InlineEdit
          value={String(likelihoodPct)}
          onSave={handleLikelihoodSave}
          validate={validateLikelihood}
          maxWidth="max-w-[55px]"
          numeric
          suffix="%"
          testId={`edge-${edgeId}-likelihood`}
        />
        {/* Micro-bar */}
        <div className="flex-1 h-1 bg-panel-border rounded-full overflow-hidden max-w-[40px]">
          <div
            className={`h-full rounded-full transition-all ${likelihoodColour}`}
            style={{ width: `${likelihoodPct}%` }}
          />
        </div>
      </div>

      {/* Provenance row — only show source when edge has evidence; absence is the signal */}
      {hasEvidence && (
        <div className={`${typography.panelMeta} flex items-center gap-1`}>
          <span className="text-text-light">Source: {provenance}{origin ? ` · origin: ${origin}` : ''}</span>
        </div>
      )}
    </div>
  )
}

// ── Node breakdown bar ────────────────────────────────────────────────────────

function NodeBreakdownBar({ grouped, totalCount }: {
  grouped: Record<KindKey, Node[]>
  totalCount: number
}) {
  if (totalCount === 0) return null

  return (
    <div>
      {/* Bar */}
      <div className="flex h-[6px] rounded-[3px] overflow-hidden" style={{ gap: '1px' }}>
        {KIND_ORDER.map(kind => {
          const count = grouped[kind].length
          if (count === 0) return null
          const pct = (count / totalCount) * 100
          return (
            <div
              key={kind}
              style={{ width: `${pct}%`, backgroundColor: SEGMENT_COLOURS[kind] }}
              className="shrink-0"
              title={`${KIND_LABELS[kind]}s: ${count}`}
            />
          )
        })}
      </div>
      {/* Legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
        {KIND_ORDER.map(kind => {
          const count = grouped[kind].length
          if (count === 0) return null
          return (
            <div key={kind} className="flex items-center gap-1">
              <div
                className={`w-2 h-2 rounded-full ${DOT_CLASSES[kind]}`}
                aria-hidden="true"
              />
              <span className={`${typography.panelMeta} text-text-light`}>
                {count} {KIND_LABELS[kind].toLowerCase()}{count !== 1 ? 's' : ''}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Health summary cards ──────────────────────────────────────────────────────

function HealthCard({
  label,
  value,
  subtext,
  subtextColour = 'text-text-light',
  progressPct,
  progressColour,
}: {
  label: string
  value: string
  subtext: string
  subtextColour?: string
  progressPct: number
  progressColour: string
}) {
  return (
    <div className="flex-1 min-w-0 bg-panel border border-panel-border rounded-xl px-2.5 py-2">
      <div className={`${typography.panelMeta} text-text-light mb-0.5`}>{label}</div>
      <div className={`${typography.panelHeader} text-text-header`}>{value}</div>
      <div className={`${typography.panelMeta} ${subtextColour} mt-0.5 mb-1`}>{subtext}</div>
      <div className="h-1 bg-panel-border rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${progressColour}`}
          style={{ width: `${Math.min(100, Math.max(0, progressPct))}%` }}
        />
      </div>
    </div>
  )
}

function HealthCards({ nodes, causalEdges }: { nodes: Node[]; causalEdges: Edge[] }) {
  // Connectivity: reachable from any root (depth-first from nodes with no incoming edges)
  const { connectedCount, totalCount: nodeTotal } = useMemo(() => {
    const allIds = new Set(nodes.map(n => n.id))
    // Build adjacency from edges in the full node list
    // We don't have edges here — caller passes causalEdges
    // Simple heuristic: nodes mentioned in any edge are "connected"
    const mentioned = new Set<string>()
    for (const e of causalEdges) {
      mentioned.add(e.source)
      mentioned.add(e.target)
    }
    // Nodes not in any edge are disconnected (unless total nodes = 0)
    const connected = nodes.filter(n => mentioned.has(n.id) || nodes.length === 1).length
    void allIds
    return { connectedCount: connected, totalCount: nodes.length }
  }, [nodes, causalEdges])

  const connectivityPct = nodeTotal > 0 ? Math.round((connectedCount / nodeTotal) * 100) : 0
  const disconnectedCount = nodeTotal - connectedCount
  const connectivitySub = disconnectedCount === 0
    ? 'All nodes connected'
    : `${disconnectedCount} disconnected from goal`
  const connectivitySubColour = disconnectedCount === 0 ? 'text-success' : 'text-warning'

  // Evidence coverage
  const { evidenced, total: edgeTotal } = useMemo(
    () => countEdgesWithEvidence(causalEdges),
    [causalEdges]
  )
  const evidencePct = edgeTotal > 0 ? Math.round((evidenced / edgeTotal) * 100) : 0
  const evidenceProgressColour = evidencePct >= 50
    ? 'bg-success'
    : evidencePct > 0
      ? 'bg-warning'
      : 'bg-panel'
  const evidenceSub = edgeTotal === 0
    ? 'No edges yet'
    : evidencePct === 0
      ? 'No edges with user evidence'
      : `${evidencePct}% of edges have user evidence`

  return (
    <div className="flex gap-2">
      <HealthCard
        label="Connectivity"
        value={`${connectedCount} of ${nodeTotal}`}
        subtext={connectivitySub}
        subtextColour={connectivitySubColour}
        progressPct={connectivityPct}
        progressColour={disconnectedCount === 0 ? 'bg-success' : 'bg-warning'}
      />
      <HealthCard
        label="Evidence coverage"
        value={`${evidenced} of ${edgeTotal}`}
        subtext={evidenceSub}
        progressPct={evidencePct}
        progressColour={evidenceProgressColour}
      />
    </div>
  )
}

// ── Collapsible section ───────────────────────────────────────────────────────

function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
  testId,
}: {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
  testId?: string
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div data-testid={testId}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 w-full text-left py-1 hover:bg-sand-50 rounded px-1 -mx-1 transition-colors"
        aria-expanded={open}
      >
        {open
          ? <ChevronDown className="w-3.5 h-3.5 text-text-light shrink-0" aria-hidden="true" />
          : <ChevronRight className="w-3.5 h-3.5 text-text-light shrink-0" aria-hidden="true" />}
        <span className={`${typography.panelHeader} text-text-header`}>{title}</span>
      </button>
      {open && <div className="mt-1 pl-4">{children}</div>}
    </div>
  )
}

// ── Reference node list ───────────────────────────────────────────────────────

function ReferenceNodeList({ nodes: nodeList, label }: { nodes: Node[]; label: string }) {
  if (nodeList.length === 0) return null
  return (
    <div className="mb-2">
      <div className={`${typography.panelMeta} text-text-light mb-1`}>{label}</div>
      <div className="space-y-0.5">
        {nodeList.map(n => (
          <button
            key={n.id}
            type="button"
            onClick={() => focusNodeById(n.id)}
            className="flex items-center gap-1.5 w-full text-left hover:bg-sand-50 rounded px-1 py-0.5"
          >
            <span className={`${typography.panelBody} text-text-header flex-1 truncate`}>
              {String((n.data as any)?.label ?? n.id)}
            </span>
            <ArrowUpRight className="w-3 h-3 text-info shrink-0" aria-hidden="true" />
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Section header with coloured circle icon ──────────────────────────────────

function SectionHeader({
  iconColour,
  icon,
  title,
}: {
  iconColour: string
  icon: ReactNode
  title: string
}) {
  return (
    <div className="flex items-center gap-2 mb-2" data-testid={`section-header-${title.split(' ')[0].toLowerCase()}`}>
      <span className={`w-4 h-4 shrink-0 ${iconColour}`} aria-hidden="true">
        {icon}
      </span>
      <span className={`${typography.panelHeader} text-text-header`}>{title}</span>
    </div>
  )
}

// ── Constraint critique codes (module-level to avoid react-hooks/exhaustive-deps warning)
const CONSTRAINT_CRITIQUE_CODES = ['MISSING_BASELINE', 'CONSTRAINT_NO_BASELINE', 'CONSTRAINT_INTERCEPT_DEFAULT', 'constraint_missing_baseline', 'CONSTRAINT_TARGET_NO_OBSERVED_VALUE']

// ── Main component ────────────────────────────────────────────────────────────

export function ModelTabBody({
  showDebug,
  hasDiagnostics,
  diagnostics,
  hasTrim,
  effectiveCorrelationId,
  correlationMismatch,
  correlationIdHeader,
  nodes,
  edges,
  robustness,
  critique,
}: ModelTabBodyProps) {
  const [searchQuery, setSearchQuery] = useState('')

  // Telemetry: fire MODEL_CARD_VIEWED once when the tab mounts
  useEffect(() => {
    const state = useCanvasStore.getState()
    trackGuidance('MODEL_CARD_VIEWED', {
      item_id: 'model_tab',
      item_type: 'trust',
      surface: 'model_tab',
      scenario_id: state.currentScenarioId ?? undefined,
      profile_stage: (state.currentStage ?? undefined) as 'frame' | 'ideate' | 'evaluate' | 'decide' | undefined,
    })
  }, [])

  const ceePipelineTrace = useCanvasStore(s => s.ceePipelineTrace)
  // Phase 2A: Model Card Lite data from store
  const hasCompletedFirstRun = useCanvasStore(s => s.hasCompletedFirstRun)
  const currentGraphHash = useCanvasStore(s => s.currentGraphHash)
  const lastAnalysisSeed = useCanvasStore(s => s.lastAnalysisSeed)
  const lastQualityMode = useCanvasStore(s => s.lastQualityMode)
  const repairsApplied = useCanvasStore(s => s.repairsApplied)
  const results = useCanvasStore(s => s.results)
  const modelCardData = useMemo(
    () => selectModelCardData({
      nodes, edges, currentGraphHash,
      lastAnalysisSeed, lastQualityMode, repairsApplied,
      results, hasCompletedFirstRun,
    }),
    [nodes, edges, currentGraphHash, lastAnalysisSeed, lastQualityMode, repairsApplied, results, hasCompletedFirstRun],
  )
  const highlightedNodes = useCanvasStore(s => s.highlightedNodes)
  const highlightedEdges = useCanvasStore(s => s.highlightedEdges)
  const setHighlightedNodes = useCanvasStore(s => s.setHighlightedNodes)
  const setHighlightedEdges = useCanvasStore(s => s.setHighlightedEdges)

  // ── Synthesised prior lookup from repair summary ───────────────────────────

  const synthesisedPriorMap = useMemo(
    () => buildSynthesisedPriorMap(ceePipelineTrace, nodes),
    [ceePipelineTrace, nodes],
  )

  // ── Node groups ───────────────────────────────────────────────────────────

  const grouped = useMemo<Record<KindKey, Node[]>>(() => {
    const g: Record<KindKey, Node[]> = {
      goal: [], decision: [], option: [], factor: [], risk: [], outcome: [],
    }
    for (const n of nodes) {
      const kind = (n.type ?? (n.data as any)?.kind ?? (n.data as any)?.type) as KindKey | undefined
      if (kind && kind in g) g[kind].push(n)
    }
    return g
  }, [nodes])

  // ── Causal edges (exclude organisational edges from/to decision/option) ───

  const decisionOptionIds = useMemo(() => {
    const ids = new Set<string>()
    for (const n of [...grouped.decision, ...grouped.option]) ids.add(n.id)
    return ids
  }, [grouped])

  const causalEdges = useMemo(
    () => edges.filter(e => !decisionOptionIds.has(e.source) && !decisionOptionIds.has(e.target)),
    [edges, decisionOptionIds]
  )

  // ── Causal nodes (exclude organisational: decision, option) ───────────────
  // Used for connectivity card — these are the nodes that participate in analysis

  const causalNodes = useMemo(
    () => nodes.filter(n => !decisionOptionIds.has(n.id)),
    [nodes, decisionOptionIds]
  )

  // ── Robustness data ───────────────────────────────────────────────────────

  const hasRobustnessData = robustness !== null

  // Build a lookup keyed by RF edge.id, matching by source+target when PLoT canonical IDs differ
  const fragileLookup = useMemo(() => {
    if (!robustness?.fragileEdges?.length) return new Map<string, import('../../lib/mappers/types').MappedFragileEdge>()
    return buildFragileEdgeLookup(edges, robustness.fragileEdges)
  }, [edges, robustness?.fragileEdges])

  const fragileEdgeIds = useMemo(() => new Set(fragileLookup.keys()), [fragileLookup])

  const fragileEdgeSwitchProbMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const [rfId, fe] of fragileLookup) {
      if (fe.switchProbability !== undefined) map.set(rfId, fe.switchProbability)
    }
    return map
  }, [fragileLookup])

  // ── Attention banner (post-analysis only) ─────────────────────────────────

  // Truly missing: null/undefined/empty string (excludes AI-estimated)
  const factorsTrulyMissingSource = useMemo(() => {
    return grouped.factor.filter(n => {
      const obs = (n.data as any)?.observedState ?? (n.data as any)?.observed_state
      return !obs?.source
    }).length
  }, [grouped.factor])

  // AI-estimated: source is 'cee_inference' — less severe than truly missing
  const factorsAiEstimated = useMemo(() => {
    return grouped.factor.filter(n => {
      const obs = (n.data as any)?.observedState ?? (n.data as any)?.observed_state
      return obs?.source === 'cee_inference'
    }).length
  }, [grouped.factor])

  const defaultedEdgeCount = useMemo(() => {
    return edges.filter(e => {
      const d = e.data as any
      const w = d?.weight
      const std = d?.strengthStd ?? d?.strength_std
      return w !== undefined && Math.abs(w - 0.5) < 0.01 && std !== undefined && Math.abs(std - 0.125) < 0.01
    }).length
  }, [edges])

  const fragileEdgeCount = hasRobustnessData ? fragileEdgeIds.size : 0

  const showAttentionBanner = hasRobustnessData && (
    fragileEdgeCount > 0 || factorsTrulyMissingSource > 0 || factorsAiEstimated > 0
  )

  // ── Factor sort: needs-attention first, then alpha ─────────────────────────

  const sortedFactors = useMemo(() => {
    return [...grouped.factor].sort((a, b) => {
      const srcA = (a.data as any)?.observedState?.source ?? (a.data as any)?.observed_state?.source
      const srcB = (b.data as any)?.observedState?.source ?? (b.data as any)?.observed_state?.source
      const extA = (a.data as any)?.category === 'external'
      const extB = (b.data as any)?.category === 'external'
      // Check explicit prior and synthesised prior fallback
      const priorMinA = (a.data as any)?.prior?.range_min ?? synthesisedPriorMap.get(a.id)?.rangeMin
      const priorMaxA = (a.data as any)?.prior?.range_max ?? synthesisedPriorMap.get(a.id)?.rangeMax
      const fullRangeA = extA && (priorMinA === undefined || priorMinA === 0) && (priorMaxA === undefined || priorMaxA === 1)
      const priorMinB = (b.data as any)?.prior?.range_min ?? synthesisedPriorMap.get(b.id)?.rangeMin
      const priorMaxB = (b.data as any)?.prior?.range_max ?? synthesisedPriorMap.get(b.id)?.rangeMax
      const fullRangeB = extB && (priorMinB === undefined || priorMinB === 0) && (priorMaxB === undefined || priorMaxB === 1)

      const needsA = (!srcA || srcA === 'cee_inference' || fullRangeA) ? 0 : 1
      const needsB = (!srcB || srcB === 'cee_inference' || fullRangeB) ? 0 : 1
      if (needsA !== needsB) return needsA - needsB
      const labelA = String((a.data as any)?.label ?? a.id)
      const labelB = String((b.data as any)?.label ?? b.id)
      return labelA.localeCompare(labelB)
    })
  }, [grouped.factor, synthesisedPriorMap])

  // ── Edge sort: fragile by switchProbability desc, then low likelihood, then high |effect| ─

  const sortedEdges = useMemo(() => {
    return [...causalEdges].sort((a, b) => {
      const aId = getDisplayEdgeId(a)
      const bId = getDisplayEdgeId(b)
      const aSwitchProb = fragileEdgeSwitchProbMap.get(aId) ?? -1
      const bSwitchProb = fragileEdgeSwitchProbMap.get(bId) ?? -1
      if (aSwitchProb !== bSwitchProb) return bSwitchProb - aSwitchProb

      const aData = a.data as any
      const bData = b.data as any
      const aConf = aData?.beliefExists ?? aData?.exists_probability ?? aData?.confidence ?? 0.7
      const bConf = bData?.beliefExists ?? bData?.exists_probability ?? bData?.confidence ?? 0.7
      if (Math.abs(aConf - bConf) > 0.001) return aConf - bConf

      const aWeight = aData?.weight ?? 0.5
      const bWeight = bData?.weight ?? 0.5
      return bWeight - aWeight
    })
  }, [causalEdges, fragileEdgeSwitchProbMap])

  // ── Evidence gaps (canonical) ─────────────────────────────────────────────

  const edgesWithoutEvidence = useMemo(() => {
    return causalEdges.filter(edge => {
      const provenance = (edge.data as any)?.provenance
      return !provenance || NON_EVIDENCE_PROVENANCE.includes(provenance)
    })
  }, [causalEdges])

  // Edges without evidence, excluding those already shown under Fragile edges
  const nonFragileEdgesWithoutEvidence = useMemo(() => {
    return edgesWithoutEvidence.filter(e => !fragileEdgeIds.has(getDisplayEdgeId(e)))
  }, [edgesWithoutEvidence, fragileEdgeIds])

  // Fragile edges sorted by switch_probability descending (for Strengthen section)
  const fragileSortedEdges = useMemo(() => {
    return [...fragileEdgeIds].map(rfId => {
      const edge = causalEdges.find(e => getDisplayEdgeId(e) === rfId)
      const switchProb = fragileEdgeSwitchProbMap.get(rfId) ?? 0
      return { edge, rfId, switchProb }
    }).filter((x): x is { edge: Edge; rfId: string; switchProb: number } => x.edge !== undefined)
      .sort((a, b) => b.switchProb - a.switchProb)
  }, [fragileEdgeIds, causalEdges, fragileEdgeSwitchProbMap])

  // Constraint warnings from PLoT critique — codes related to missing baseline or constraint issues
  const constraintWarnings = useMemo(() => {
    if (!critique?.length) return []
    return critique.filter(c =>
      CONSTRAINT_CRITIQUE_CODES.some(code => c.code?.toUpperCase().includes(code.toUpperCase())) ||
      c.message?.toLowerCase().includes('constraint') && c.message?.toLowerCase().includes('baseline')
    )
  }, [critique])

  // Factors truly missing source (for Strengthen — separate from AI-estimated)
  const factorsTrulyMissingSourceList = useMemo(() => {
    return grouped.factor.filter(n => {
      const obs = (n.data as any)?.observedState ?? (n.data as any)?.observed_state
      return !obs?.source
    })
  }, [grouped.factor])

  const showDefaultedWarning = defaultedEdgeCount > 2

  // ── Search filter ─────────────────────────────────────────────────────────

  const query = searchQuery.trim().toLowerCase()

  const visibleFactors = useMemo(() => {
    if (!query) return sortedFactors
    return sortedFactors.filter(n =>
      String((n.data as any)?.label ?? n.id).toLowerCase().includes(query)
    )
  }, [sortedFactors, query])

  const visibleEdges = useMemo(() => {
    if (!query) return sortedEdges
    return sortedEdges.filter(e => {
      const src = nodes.find(n => n.id === e.source)
      const tgt = nodes.find(n => n.id === e.target)
      const fromLabel = String((src?.data as any)?.label ?? e.source).toLowerCase()
      const toLabel = String((tgt?.data as any)?.label ?? e.target).toLowerCase()
      return fromLabel.includes(query) || toLabel.includes(query)
    })
  }, [sortedEdges, query, nodes])

  // ── Goal headline ─────────────────────────────────────────────────────────

  const goalNode = grouped.goal[0]
  const goalLabel = goalNode ? String((goalNode.data as any)?.label ?? goalNode.id) : null

  // ── Copy as text ──────────────────────────────────────────────────────────

  // ── Hover highlight dispatch (bidirectional: Model tab ↔ canvas) ──────────
  const handleNodeHover = useCallback((id: string) => setHighlightedNodes([id]), [setHighlightedNodes])
  const handleEdgeHover = useCallback((id: string) => setHighlightedEdges([id]), [setHighlightedEdges])
  const handleNodeLeave = useCallback(() => setHighlightedNodes([]), [setHighlightedNodes])
  const handleEdgeLeave = useCallback(() => setHighlightedEdges([]), [setHighlightedEdges])

  const [copied, setCopied] = useState<'text' | 'json' | false>(false)

  const handleCopyText = useCallback(() => {
    const lines: string[] = []
    if (goalLabel) lines.push(`Goal: ${goalLabel}`)
    lines.push('')
    lines.push('Factors:')
    for (const n of sortedFactors) {
      const lbl = String((n.data as any)?.label ?? n.id)
      const obs = (n.data as any)?.observedState ?? (n.data as any)?.observed_state ?? {}
      const src = obs.source ? ` [${mapSourceToDisplay(obs.source) ?? obs.source}]` : ' [no source]'
      lines.push(`  • ${lbl}${src}`)
    }
    lines.push('')
    lines.push('Edges:')
    for (const e of sortedEdges) {
      const src = nodes.find(n => n.id === e.source)
      const tgt = nodes.find(n => n.id === e.target)
      const fromLbl = String((src?.data as any)?.label ?? e.source)
      const toLbl = String((tgt?.data as any)?.label ?? e.target)
      lines.push(`  • ${fromLbl} → ${toLbl}`)
    }
    const text = lines.join('\n')
    navigator.clipboard?.writeText(text).then(() => {
      setCopied('text')
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }, [goalLabel, sortedFactors, sortedEdges, nodes])

  const handleCopyJson = useCallback(() => {
    const payload = {
      goal: goalLabel ?? null,
      factors: sortedFactors.map(n => ({
        id: n.id,
        label: String((n.data as any)?.label ?? n.id),
        category: (n.data as any)?.category ?? null,
        observedState: (n.data as any)?.observedState ?? (n.data as any)?.observed_state ?? null,
        prior: (n.data as any)?.prior ?? null,
      })),
      edges: sortedEdges.map(e => ({
        id: getDisplayEdgeId(e),
        source: e.source,
        target: e.target,
        weight: (e.data as any)?.weight ?? null,
        direction: (e.data as any)?.direction ?? null,
        beliefExists: (e.data as any)?.beliefExists ?? (e.data as any)?.exists_probability ?? null,
        provenance: (e.data as any)?.provenance ?? null,
      })),
    }
    const json = JSON.stringify(payload, null, 2)
    navigator.clipboard?.writeText(json).then(() => {
      setCopied('json')
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }, [goalLabel, sortedFactors, sortedEdges])

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4 pb-4" data-testid="model-tab">

      {/* ── Model Card Lite (Phase 2A) ────────────────────────────────────── */}
      {isModelCardLiteEnabled() && nodes.length > 0 && (
        <SectionErrorBoundary section="model card">
          <ModelCardLite data={modelCardData} />
        </SectionErrorBoundary>
      )}

      {/* ── Goal headline ─────────────────────────────────────────────────── */}
      {goalLabel && (
        <div className="flex items-center gap-1.5" data-testid="model-goal-headline">
          <div className="w-2.5 h-2.5 rounded-full bg-goal shrink-0" aria-hidden="true" />
          <span className={`${typography.panelHeader} text-text-header truncate`}>{goalLabel}</span>
        </div>
      )}

      {/* ── Node breakdown bar ─────────────────────────────────────────────── */}
      {nodes.length > 0 && (
        <SectionErrorBoundary section="node breakdown">
          <NodeBreakdownBar grouped={grouped} totalCount={nodes.length} />
        </SectionErrorBoundary>
      )}

      {/* ── Health cards ──────────────────────────────────────────────────── */}
      {nodes.length > 0 && (
        <SectionErrorBoundary section="health cards">
          <HealthCards nodes={causalNodes} causalEdges={causalEdges} />
        </SectionErrorBoundary>
      )}

      {/* ── Attention banner (post-analysis only) ─────────────────────────── */}
      {showAttentionBanner && (
        <div
          className="flex items-start gap-2 px-3 py-2 rounded-sm bg-warning/[0.08] border border-warning/[0.18]"
          data-testid="model-attention-banner"
        >
          <AlertTriangle className="w-3.5 h-3.5 text-warning shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex-1 min-w-0">
            <div className={`${typography.panelBody} text-text-body`}>
              {[
                factorsTrulyMissingSource > 0
                  ? `${factorsTrulyMissingSource} factor${factorsTrulyMissingSource !== 1 ? 's' : ''} missing source`
                  : null,
                factorsAiEstimated > 0
                  ? `${factorsAiEstimated} AI-estimated`
                  : null,
                fragileEdgeCount > 0
                  ? `${fragileEdgeCount} fragile edge${fragileEdgeCount !== 1 ? 's' : ''}`
                  : null,
              ].filter(Boolean).join(' · ')}
            </div>
            <a
              href="#strengthen"
              className={`${typography.panelMeta} text-info hover:underline`}
              onClick={(e) => {
                e.preventDefault()
                document.getElementById('model-strengthen')?.scrollIntoView({ behavior: 'smooth' })
              }}
            >
              Review in Strengthen ↓
            </a>
          </div>
        </div>
      )}

      {/* ── Factors section ───────────────────────────────────────────────── */}
      {sortedFactors.length > 0 && (
        <SectionErrorBoundary section="factors">
          <div data-testid="model-factors-section">
            <SectionHeader
              iconColour="text-text-light"
              icon={<Settings className="w-4 h-4" />}
              title={`Factors (${sortedFactors.length})`}
            />
            <div>
              {visibleFactors.map(n => (
                <FactorCard
                  key={n.id}
                  node={n}
                  synthesisedPrior={synthesisedPriorMap.get(n.id)}
                  isHighlighted={highlightedNodes.has(n.id)}
                  onHover={handleNodeHover}
                  onLeave={handleNodeLeave}
                />
              ))}
              {query && visibleFactors.length === 0 && (
                <p className={`${typography.panelMeta} text-text-light`}>No matching factors.</p>
              )}
            </div>
          </div>
        </SectionErrorBoundary>
      )}

      {/* ── Edges section ─────────────────────────────────────────────────── */}
      {sortedEdges.length > 0 && (
        <SectionErrorBoundary section="edges">
          <div data-testid="model-edges-section">
            <SectionHeader
              iconColour="text-text-light"
              icon={<GitBranch className="w-4 h-4" />}
              title={`Edges (${sortedEdges.length})`}
            />
            <div>
              {visibleEdges.map(e => (
                <EdgeCard
                  key={getDisplayEdgeId(e)}
                  edge={e}
                  nodes={nodes}
                  fragileEdgeIds={fragileEdgeIds}
                  fragileEdgeSwitchProbMap={fragileEdgeSwitchProbMap}
                  hasRobustnessData={hasRobustnessData}
                  isHighlighted={highlightedEdges.has(getDisplayEdgeId(e))}
                  onHover={handleEdgeHover}
                  onLeave={handleEdgeLeave}
                />
              ))}
              {query && visibleEdges.length === 0 && (
                <p className={`${typography.panelMeta} text-text-light`}>No matching edges.</p>
              )}
            </div>
          </div>
        </SectionErrorBoundary>
      )}

      {/* ── Options / Risks / Outcomes (collapsed reference) ──────────────── */}
      {(grouped.option.length > 0 || grouped.risk.length > 0 || grouped.outcome.length > 0) && (
        <CollapsibleSection
          title={[
            grouped.option.length > 0 ? `Options (${grouped.option.length})` : '',
            grouped.risk.length > 0 ? `Risks (${grouped.risk.length})` : '',
            grouped.outcome.length > 0 ? `Outcomes (${grouped.outcome.length})` : '',
          ].filter(Boolean).join(' · ')}
          defaultOpen={false}
          testId="model-reference-section"
        >
          <ReferenceNodeList nodes={grouped.option} label="Options" />
          <ReferenceNodeList nodes={grouped.risk} label="Risks" />
          <ReferenceNodeList nodes={grouped.outcome} label="Outcomes" />
        </CollapsibleSection>
      )}

      {/* ── Strengthen section ────────────────────────────────────────────── */}
      <div id="model-strengthen" className="border-t border-panel-border pt-3" data-testid="model-strengthen-section">
        <SectionHeader
          iconColour="text-info"
          icon={<Lightbulb className="w-4 h-4" />}
          title="Strengthen"
        />
        <div className={`${typography.panelMeta} text-text-light mb-3`}>
          Improve your model with evidence and refinements
        </div>

        {showDefaultedWarning && (
          <div
            className={`${typography.panelBody} text-text-body mb-3 px-2 py-2 bg-panel rounded border border-warning/30`}
            data-testid="model-defaulted-warning"
          >
            {defaultedEdgeCount} edge{defaultedEdgeCount !== 1 ? 's' : ''} use default AI-generated parameters. Adding evidence to these edges will have the greatest impact on analysis reliability.
          </div>
        )}

        {/* ── Needs attention: constraint warnings ── */}
        {constraintWarnings.length > 0 && (
          <div className="mb-3" data-testid="strengthen-constraint-warnings">
            <div className={`${typography.panelMeta} text-text-light mb-1`}>
              Needs attention ({constraintWarnings.length})
            </div>
            <div className="space-y-1">
              {constraintWarnings.map((c, i) => {
                const factorNode = c.node_id ? nodes.find(n => n.id === c.node_id) : undefined
                const factorLabel = factorNode
                  ? String((factorNode.data as any)?.label ?? c.node_id)
                  : (c.node_id ?? 'Unknown factor')
                return (
                  <div
                    key={c.code ?? i}
                    className="flex items-center gap-2 p-1.5 bg-panel border border-panel-border rounded-sm"
                    data-testid={`strengthen-constraint-${c.code ?? i}`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-danger shrink-0" aria-hidden="true" />
                    <span className={`${typography.panelBody} text-text-header flex-1 min-w-0`}>
                      {factorLabel} has a constraint but no baseline value — add an estimate
                    </span>
                    {c.node_id && (
                      <button
                        type="button"
                        onClick={() => focusNodeById(c.node_id!)}
                        className={`inline-flex items-center px-3 py-1 rounded-full bg-transparent border border-warning/30 text-text-body ${typography.panelMeta} font-medium hover:bg-panel-hover transition-colors shrink-0`}
                      >
                        Add estimate
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Fragile edges (post-analysis only) ── */}
        {hasRobustnessData && fragileSortedEdges.length > 0 && (
          <div className="mb-3" data-testid="strengthen-fragile-edges">
            <div className={`${typography.panelMeta} text-text-light mb-1`}>
              Fragile edges ({fragileSortedEdges.length})
            </div>
            <div className="space-y-1">
              {fragileSortedEdges.map(({ edge, rfId, switchProb }) => {
                const srcNode = nodes.find(n => n.id === edge.source)
                const tgtNode = nodes.find(n => n.id === edge.target)
                const edgeLabel = srcNode && tgtNode
                  ? `${String((srcNode.data as any)?.label ?? edge.source)} → ${String((tgtNode.data as any)?.label ?? edge.target)}`
                  : rfId
                return (
                  <div
                    key={rfId}
                    className="flex items-center gap-2 p-1.5 bg-panel border border-panel-border rounded-sm"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-warning shrink-0" aria-hidden="true" />
                    <span className={`${typography.panelBody} text-text-header flex-1 min-w-0 truncate`}>
                      {edgeLabel}
                    </span>
                    {switchProb > 0 && (
                      <span className={`${typography.panelMeta} text-warning shrink-0`}>
                        {Math.round(switchProb * 100)}%
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => focusEdgeById(rfId)}
                      className={`inline-flex items-center px-3 py-1 rounded-full bg-transparent border border-info/30 text-text-body ${typography.panelMeta} font-medium hover:bg-panel-hover transition-colors shrink-0`}
                    >
                      Add evidence
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Missing evidence: factors + remaining edges (excludes fragile edges shown above) ── */}
        {(factorsTrulyMissingSourceList.length > 0 || nonFragileEdgesWithoutEvidence.length > 0) ? (
          <div data-testid="strengthen-missing-evidence">
            <div className={`${typography.panelMeta} text-text-light mb-1`}>
              Missing evidence ({factorsTrulyMissingSourceList.length + nonFragileEdgesWithoutEvidence.length})
            </div>
            <div className="space-y-1">
              {factorsTrulyMissingSourceList.map(n => {
                const lbl = String((n.data as any)?.label ?? n.id)
                return (
                  <div
                    key={n.id}
                    className="flex items-center gap-2 p-1.5 bg-panel border border-panel-border rounded-sm"
                  >
                    <Link className="w-3.5 h-3.5 text-text-light shrink-0" aria-hidden="true" />
                    <span className={`${typography.panelBody} text-text-header flex-1 min-w-0 truncate`}>
                      {lbl}
                    </span>
                    <button
                      type="button"
                      onClick={() => focusNodeById(n.id)}
                      className={`inline-flex items-center px-3 py-1 rounded-full bg-transparent border border-info/30 text-text-body ${typography.panelMeta} font-medium hover:bg-panel-hover transition-colors shrink-0`}
                    >
                      Add source
                    </button>
                  </div>
                )
              })}
              {nonFragileEdgesWithoutEvidence.slice(0, 5).map(edge => {
                const edgeId = getDisplayEdgeId(edge)
                const srcNode = nodes.find(n => n.id === edge.source)
                const tgtNode = nodes.find(n => n.id === edge.target)
                const edgeLabel = srcNode && tgtNode
                  ? `${String((srcNode.data as any)?.label ?? edge.source)} → ${String((tgtNode.data as any)?.label ?? edge.target)}`
                  : edgeId
                return (
                  <div
                    key={edgeId}
                    className="flex items-center gap-2 p-1.5 bg-panel border border-panel-border rounded-sm"
                  >
                    <Link className="w-3.5 h-3.5 text-text-light shrink-0" aria-hidden="true" />
                    <span className={`${typography.panelBody} text-text-header flex-1 min-w-0 truncate`}>
                      {edgeLabel}
                    </span>
                    <button
                      type="button"
                      onClick={() => focusEdgeById(edgeId)}
                      className={`inline-flex items-center px-3 py-1 rounded-full bg-transparent border border-info/30 text-text-body ${typography.panelMeta} font-medium hover:bg-panel-hover transition-colors shrink-0`}
                    >
                      Add evidence
                    </button>
                  </div>
                )
              })}
              {nonFragileEdgesWithoutEvidence.length > 5 && (
                <p className={`${typography.panelMeta} text-text-light pl-1`}>
                  +{nonFragileEdgesWithoutEvidence.length - 5} more edges without evidence
                </p>
              )}
            </div>
            {/* Warning when all causal edges lack user evidence */}
            {nonFragileEdgesWithoutEvidence.length === causalEdges.length && causalEdges.length > 0 && (
              <div
                className={`${typography.panelBody} text-text-body bg-panel-hover rounded-sm px-2.5 py-2 mt-2.5 leading-relaxed`}
              >
                All edges currently rely on AI-generated parameters. Adding evidence to fragile edges first will have the greatest impact on analysis reliability.
              </div>
            )}
          </div>
        ) : (
          constraintWarnings.length === 0 && fragileSortedEdges.length === 0 && (
            <p className={`${typography.panelBody} text-text-light`}>
              All edges have supporting evidence.
            </p>
          )
        )}
      </div>

      {/* ── Streaming diagnostics (Shift+D) ───────────────────────────────── */}
      {showDebug && (
        <div className="border-t border-panel-border pt-3 space-y-1" data-testid="model-streaming-diagnostics">
          <div className={`${typography.panelHeader} text-text-header mb-2`}>
            Streaming diagnostics
          </div>
          <div className="flex items-center justify-between">
            <span className={`${typography.panelBody} text-text-light`}>Resumes</span>
            <span className={`${typography.panelBody} text-text-header tabular-nums`} data-testid="diag-resumes">
              {hasDiagnostics ? diagnostics?.resumes ?? 0 : 0}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className={`${typography.panelBody} text-text-light`}>Recovered events</span>
            <span className={`${typography.panelBody} text-text-header tabular-nums`} data-testid="diag-recovered">
              {hasDiagnostics ? diagnostics?.recovered_events ?? 0 : 0}
            </span>
          </div>
          <div className="flex items-center justify-between" data-testid="diag-trims">
            <span className={`${typography.panelBody} text-text-light`}>Buffer trimmed</span>
            <span className={`${typography.panelMeta} inline-flex items-center px-1.5 py-0.5 rounded border`}>
              {hasTrim
                ? <span className="bg-sun-50 text-sun-800 border-sun-200 px-1.5 py-0.5 rounded">Yes</span>
                : <span className="text-text-light border-panel-border px-1.5 py-0.5 rounded">No</span>}
            </span>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-panel-border">
            <span className={`${typography.panelBody} text-text-light`}>Correlation ID</span>
            <div className="flex items-center gap-2">
              <span
                className={`font-mono ${typography.code} text-text-header max-w-[10rem] truncate`}
                data-testid="diag-correlation-value"
              >
                {effectiveCorrelationId ?? '—'}
              </span>
              {effectiveCorrelationId && (
                <button
                  type="button"
                  onClick={() => {
                    try { navigator.clipboard?.writeText(effectiveCorrelationId) } catch {}
                  }}
                  className={`inline-flex items-center px-1.5 py-0.5 rounded border border-panel-border ${typography.code} text-text-light hover:bg-sand-50`}
                  data-testid="diag-correlation-copy"
                >
                  Copy
                </button>
              )}
            </div>
          </div>
          {correlationMismatch && (
            <p className={`${typography.code} text-sun-700`} data-testid="diag-correlation-mismatch">
              Correlation ID in diagnostics ({diagnostics?.correlation_id}) does not match header ({correlationIdHeader}).
            </p>
          )}
          <p className={`${typography.code} text-text-light`}>
            For deeper engine instrumentation, use the on-canvas diagnostics overlay via
            <code className="mx-1">?diag=1</code>.
          </p>
        </div>
      )}

      {!showDebug && (
        <p className={`${typography.panelMeta} text-text-light border-t border-panel-border pt-2`}>
          Press <kbd className={`px-1.5 py-0.5 bg-sand-100 rounded ${typography.panelMeta} font-mono`}>Shift+D</kbd> for streaming diagnostics
        </p>
      )}

      {/* ── Footer: search + copy ─────────────────────────────────────────── */}
      <div className="border-t border-panel-border pt-3 flex items-center gap-2" data-testid="model-footer">
        <input
          type="search"
          value={searchQuery}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
          placeholder="Search factors and edges…"
          className={`flex-1 ${typography.panelBody} text-text-header px-2 py-1 rounded-sm border border-panel-border bg-panel focus:outline-none focus:ring-1 focus:ring-info/50 placeholder:text-text-light`}
          data-testid="model-search"
        />
        <button
          type="button"
          onClick={handleCopyText}
          className={`inline-flex items-center gap-1 px-2 py-1 rounded border border-panel-border ${typography.panelMeta} text-text-body hover:bg-panel-hover transition-colors shrink-0`}
          data-testid="model-copy"
        >
          <Copy className="w-3 h-3 shrink-0" aria-hidden="true" />
          {copied === 'text' ? 'Copied!' : 'Text'}
        </button>
        <button
          type="button"
          onClick={handleCopyJson}
          className={`inline-flex items-center gap-1 px-2 py-1 rounded border border-panel-border ${typography.panelMeta} text-text-body hover:bg-panel-hover transition-colors shrink-0`}
          data-testid="model-copy-json"
        >
          <ClipboardCopy className="w-3 h-3 shrink-0" aria-hidden="true" />
          {copied === 'json' ? 'Copied!' : 'JSON'}
        </button>
      </div>
    </div>
  )
}
