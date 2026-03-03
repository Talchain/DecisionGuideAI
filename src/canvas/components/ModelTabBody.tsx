/**
 * ModelTabBody — redesigned "Model" tab for the outputs dock
 *
 * Replaces the three-lens (Causal Logic / Model Structure / Improvements) layout
 * with a flat, grouped, editable surface:
 *
 *  1. Summary line  — count by kind
 *  2. Attention banner  — defaulted-edge / missing-evidence warnings
 *  3. Factors section  — editable value, baseline, source per factor node
 *  4. Edges section  — editable signed effect and confidence per edge
 *  5. Options / Risks / Outcomes  — collapsible reference list (GraphTextView)
 *  6. Strengthen section  — evidence gaps + defaulted-values warning
 *  7. Debug diagnostics  — Shift+D only
 *
 * Store edit pattern: mirrors NodeInspector / EdgeInspector — calls
 *   updateNode(id, { data: { ...node.data, observedState: { ... } } })
 *   updateEdge(id, { data: { ...edge.data, weight, direction, beliefExists } })
 * Both already call pushToHistory(), which triggers analysisStale via useScenario.
 *
 * Typography: panelHeader (14px semibold) · panelBody (12px) · panelMeta (11px).
 * British English throughout. Sentence case.
 */

import {
  useState,
  useMemo,
  useCallback,
  useRef,
  type KeyboardEvent,
  type ChangeEvent,
} from 'react'
import { ChevronDown, ChevronRight, AlertTriangle, Check } from 'lucide-react'
import type { Node, Edge } from '@xyflow/react'
import { typography } from '../../styles/typography'
import { useCanvasStore } from '../store'
import { getDisplayEdgeId, buildFragileEdgeIdSet, buildRobustEdgeIdSet } from '../utils/edgeIdentity'
import { focusNodeById, focusEdgeById } from '../utils/focusHelpers'
import { NON_EVIDENCE_PROVENANCE } from '../utils/evidenceCoverage'
import { SectionErrorBoundary } from './GraphTextView'
import type { MappedRobustness } from '../../lib/mappers/types'

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
}

interface ObservedState {
  value?: number
  raw_value?: number
  baseline?: number
  unit?: string
  source?: string
  cap?: number
}

// ── Inline edit hook ─────────────────────────────────────────────────────────

/**
 * Manages the lifecycle of an inline editable field:
 * click → editing, blur/Enter → save, Escape → cancel.
 */
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
  placeholder?: string
  onSave: (val: string) => void
  validate?: (val: string) => boolean
  /** max-width class, e.g. 'max-w-[60px]' */
  maxWidth?: string
  numeric?: boolean
  prefix?: string
  suffix?: string
  testId?: string
}

function InlineEdit({
  value,
  placeholder = '—',
  onSave,
  validate,
  maxWidth = 'max-w-[120px]',
  numeric = false,
  prefix,
  suffix,
  testId,
}: InlineEditProps) {
  const { editing, draft, invalid, setDraft, startEdit, commit, cancel, handleKeyDown } =
    useInlineEdit(value, onSave, validate)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFocus = useCallback(() => {
    startEdit()
    // Let state settle, then focus
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
            invalid ? 'border-danger' : 'border-panel-border'
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
      onFocus={handleFocus}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleFocus() }}
      className={`inline-flex items-center gap-0.5 cursor-text rounded-sm hover:bg-sand-100 px-1 -mx-1`}
      title="Click to edit"
      data-testid={testId ? `${testId}-display` : undefined}
    >
      {prefix && <span className={`${typography.panelMeta} text-text-light`}>{prefix}</span>}
      <span className={`${typography.panelBody} ${value ? 'text-text-header' : 'text-text-light'}`}>
        {value || placeholder}
      </span>
      {suffix && <span className={`${typography.panelMeta} text-text-light ml-0.5`}>{suffix}</span>}
    </span>
  )
}

// ── Category badge ────────────────────────────────────────────────────────────

const CATEGORY_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  controllable: { bg: 'bg-info-light', text: 'text-info', label: 'Controllable' },
  observable: { bg: 'bg-factor-light', text: 'text-factor', label: 'Observable' },
  external: { bg: 'bg-warning-light', text: 'text-warning', label: 'External' },
}

function CategoryBadge({ category }: { category?: string }) {
  if (!category) return null
  const style = CATEGORY_STYLES[category]
  if (!style) return null
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full ${typography.panelMeta} font-medium ${style.bg} ${style.text}`}>
      {style.label}
    </span>
  )
}

// ── Focus link ────────────────────────────────────────────────────────────────

function FocusLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${typography.panelMeta} text-info hover:underline shrink-0`}
      aria-label="Focus on canvas"
    >
      ↗
    </button>
  )
}

// ── Factor card ───────────────────────────────────────────────────────────────

function FactorCard({ node }: { node: Node }) {
  const updateNode = useCanvasStore(s => s.updateNode)

  const data = node.data as any
  const label = String(data?.label ?? node.id)
  const category = data?.category as string | undefined

  // Read observed state — canvas stores as camelCase (observedState)
  const obs: ObservedState = (data?.observedState ?? data?.observed_state ?? {}) as ObservedState
  const isExternal = category === 'external'

  // Prior range for external factors
  const priorRangeMin = data?.prior?.range_min ?? data?.priorRangeMin
  const priorRangeMax = data?.prior?.range_max ?? data?.priorRangeMax

  const handleValueSave = useCallback((val: number | string) => {
    const num = typeof val === 'number' ? val : parseFloat(String(val))
    if (isNaN(num)) return
    updateNode(node.id, {
      data: {
        ...data,
        observedState: { ...obs, value: num },
      },
    })
  }, [node.id, data, obs, updateNode])

  const handleBaselineSave = useCallback((val: number | string) => {
    const num = typeof val === 'number' ? val : parseFloat(String(val))
    if (isNaN(num)) return
    updateNode(node.id, {
      data: {
        ...data,
        observedState: { ...obs, baseline: num },
      },
    })
  }, [node.id, data, obs, updateNode])

  const handleSourceSave = useCallback((val: string) => {
    updateNode(node.id, {
      data: {
        ...data,
        observedState: { ...obs, source: val || undefined },
      },
    })
  }, [node.id, data, obs, updateNode])

  const handlePriorMinSave = useCallback((val: number | string) => {
    const num = typeof val === 'number' ? val : parseFloat(String(val))
    if (isNaN(num)) return
    updateNode(node.id, {
      data: {
        ...data,
        prior: { ...(data?.prior ?? {}), range_min: num },
      },
    })
  }, [node.id, data, updateNode])

  const handlePriorMaxSave = useCallback((val: number | string) => {
    const num = typeof val === 'number' ? val : parseFloat(String(val))
    if (isNaN(num)) return
    updateNode(node.id, {
      data: {
        ...data,
        prior: { ...(data?.prior ?? {}), range_max: num },
      },
    })
  }, [node.id, data, updateNode])

  const validateNumeric = useCallback((s: string) => {
    const n = parseFloat(s)
    return !isNaN(n)
  }, [])

  return (
    <div className="py-2 border-b border-panel-border last:border-b-0">
      {/* Header row */}
      <div className="flex items-center gap-2 mb-1">
        <span className={`${typography.panelHeader} text-text-header flex-1 min-w-0 truncate`}>
          {label}
        </span>
        <CategoryBadge category={category} />
        <FocusLink onClick={() => focusNodeById(node.id)} />
      </div>

      {isExternal ? (
        /* External factors: show prior range */
        <div className="flex items-center gap-1 flex-wrap">
          <span className={`${typography.panelMeta} text-text-light`}>Prior:</span>
          <InlineEdit
            value={priorRangeMin !== undefined ? String(priorRangeMin) : ''}
            placeholder="min"
            onSave={handlePriorMinSave}
            validate={validateNumeric}
            maxWidth="max-w-[60px]"
            numeric
            testId={`factor-${node.id}-prior-min`}
          />
          <span className={`${typography.panelMeta} text-text-light`}>–</span>
          <InlineEdit
            value={priorRangeMax !== undefined ? String(priorRangeMax) : ''}
            placeholder="max"
            onSave={handlePriorMaxSave}
            validate={validateNumeric}
            maxWidth="max-w-[60px]"
            numeric
            testId={`factor-${node.id}-prior-max`}
          />
          <span className={`${typography.panelMeta} text-text-light`}>uniform</span>
        </div>
      ) : (
        /* Non-external: value, baseline, source */
        <div className="space-y-0.5">
          <div className="flex items-center gap-1 flex-wrap">
            <span className={`${typography.panelMeta} text-text-light w-14 shrink-0`}>Value</span>
            <InlineEdit
              value={obs.value !== undefined ? String(obs.value) : ''}
              placeholder="—"
              onSave={handleValueSave}
              validate={validateNumeric}
              maxWidth="max-w-[80px]"
              numeric
              suffix={obs.unit}
              testId={`factor-${node.id}-value`}
            />
            {obs.raw_value !== undefined && obs.cap !== undefined && (
              <span className={`${typography.panelMeta} text-text-light`}>
                of {obs.cap}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            <span className={`${typography.panelMeta} text-text-light w-14 shrink-0`}>Baseline</span>
            <InlineEdit
              value={obs.baseline !== undefined ? String(obs.baseline) : ''}
              placeholder="—"
              onSave={handleBaselineSave}
              validate={validateNumeric}
              maxWidth="max-w-[80px]"
              numeric
              suffix={obs.unit}
              testId={`factor-${node.id}-baseline`}
            />
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            <span className={`${typography.panelMeta} text-text-light w-14 shrink-0`}>Source</span>
            <InlineEdit
              value={obs.source && obs.source !== 'cee_inference' ? obs.source : ''}
              placeholder="Add source…"
              onSave={handleSourceSave}
              maxWidth="max-w-[160px]"
              testId={`factor-${node.id}-source`}
            />
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
  robustEdgeIds,
}: {
  edge: Edge
  nodes: Node[]
  fragileEdgeIds: Set<string>
  robustEdgeIds: Set<string>
}) {
  const updateEdge = useCanvasStore(s => s.updateEdge)

  const data = edge.data as any
  const edgeId = getDisplayEdgeId(edge)

  const isFragile = fragileEdgeIds.has(edgeId)
  const isRobust = robustEdgeIds.has(edgeId)

  const sourceNode = nodes.find(n => n.id === edge.source)
  const targetNode = nodes.find(n => n.id === edge.target)
  const fromLabel = String((sourceNode?.data as any)?.label ?? edge.source)
  const toLabel = String((targetNode?.data as any)?.label ?? edge.target)

  // Canvas stores weight (0-2, unsigned) + direction. Signed = weight * sign.
  const weight = data?.weight ?? 0.5
  const direction = data?.direction ?? 'positive'
  const signedMean = direction === 'negative' ? -weight : weight
  const strengthStd = data?.strengthStd ?? data?.strength_std

  // beliefExists is the canonical confidence field (0-1)
  const beliefExists = data?.beliefExists ?? data?.confidence ?? data?.belief ?? 0.7
  const confidencePct = Math.round(beliefExists * 100)

  const validateEffect = useCallback((s: string) => {
    const n = parseFloat(s)
    return !isNaN(n) && n >= -1 && n <= 1
  }, [])

  const validateConfidence = useCallback((s: string) => {
    const n = parseFloat(s)
    return !isNaN(n) && n >= 0 && n <= 100
  }, [])

  const handleEffectSave = useCallback((val: string) => {
    const n = parseFloat(val)
    if (isNaN(n) || n < -1 || n > 1) return
    const absWeight = Math.abs(n)
    const newDirection = n >= 0 ? 'positive' : 'negative'
    updateEdge(edgeId, {
      data: { ...data, weight: absWeight, direction: newDirection },
    })
  }, [edgeId, data, updateEdge])

  const handleConfidenceSave = useCallback((val: string) => {
    const pct = parseFloat(val)
    if (isNaN(pct) || pct < 0 || pct > 100) return
    const belief = pct / 100
    updateEdge(edgeId, {
      data: { ...data, beliefExists: belief },
    })
  }, [edgeId, data, updateEdge])

  // Format signed mean for display
  const effectDisplay = signedMean >= 0
    ? `+${signedMean.toFixed(2)}`
    : signedMean.toFixed(2)

  return (
    <div className="py-2 border-b border-panel-border last:border-b-0">
      {/* Header */}
      <div className="flex items-center gap-1.5 mb-1">
        <span className={`${typography.panelBody} text-text-header flex-1 min-w-0`}>
          <span className="truncate">{fromLabel}</span>
          <span className="text-text-light mx-1">→</span>
          <span className="truncate">{toLabel}</span>
        </span>
        {isFragile && (
          <span title="Fragile — sensitive to assumption changes">
            <AlertTriangle className="w-3 h-3 text-warning shrink-0" aria-hidden="true" />
          </span>
        )}
        {isRobust && !isFragile && (
          <span title="Stable assumption">
            <Check className="w-3 h-3 text-success shrink-0" aria-hidden="true" />
          </span>
        )}
        <FocusLink onClick={() => focusEdgeById(edgeId)} />
      </div>

      {/* Fields */}
      <div className="flex items-center gap-4 flex-wrap">
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
            <span
              className={`${typography.panelMeta} text-text-light`}
              title="Uncertainty about this effect size."
            >
              ±{strengthStd.toFixed(2)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <span className={`${typography.panelMeta} text-text-light`}>Confidence</span>
          <InlineEdit
            value={String(confidencePct)}
            onSave={handleConfidenceSave}
            validate={validateConfidence}
            maxWidth="max-w-[55px]"
            numeric
            suffix="%"
            testId={`edge-${edgeId}-confidence`}
          />
        </div>
      </div>
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

// ── Reference list (Options / Risks / Outcomes) ───────────────────────────────

function ReferenceNodeList({ nodes, label }: { nodes: Node[]; label: string }) {
  if (nodes.length === 0) return null
  return (
    <div className="mb-2">
      <div className={`${typography.panelMeta} text-text-light mb-1`}>{label}</div>
      <div className="space-y-0.5">
        {nodes.map(n => (
          <button
            key={n.id}
            type="button"
            onClick={() => focusNodeById(n.id)}
            className="flex items-center gap-1.5 w-full text-left hover:bg-sand-50 rounded px-1 py-0.5"
          >
            <span className={`${typography.panelBody} text-text-header flex-1 truncate`}>
              {String((n.data as any)?.label ?? n.id)}
            </span>
            <span className={`${typography.panelMeta} text-info`}>↗</span>
          </button>
        ))}
      </div>
    </div>
  )
}

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
}: ModelTabBodyProps) {
  // ── Derived sets ──────────────────────────────────────────────────────────

  const fragileEdgeIds = useMemo(() => {
    if (!robustness?.fragileEdges) return new Set<string>()
    return buildFragileEdgeIdSet(robustness.fragileEdges)
  }, [robustness?.fragileEdges])

  const robustEdgeIds = useMemo(() => {
    if (!robustness?.robustEdges) return new Set<string>()
    return buildRobustEdgeIdSet(robustness.robustEdges)
  }, [robustness?.robustEdges])

  // ── Node groups ───────────────────────────────────────────────────────────

  const grouped = useMemo(() => {
    const goal: Node[] = []
    const decision: Node[] = []
    const option: Node[] = []
    const factor: Node[] = []
    const risk: Node[] = []
    const outcome: Node[] = []
    const other: Node[] = []

    for (const n of nodes) {
      const kind = n.type ?? (n.data as any)?.kind ?? (n.data as any)?.type
      switch (kind) {
        case 'goal': goal.push(n); break
        case 'decision': decision.push(n); break
        case 'option': option.push(n); break
        case 'factor': factor.push(n); break
        case 'risk': risk.push(n); break
        case 'outcome': outcome.push(n); break
        default: other.push(n)
      }
    }
    return { goal, decision, option, factor, risk, outcome, other }
  }, [nodes])

  // ── Attention banner: defaulted edges ────────────────────────────────────

  // Count edges with default parameters: weight ≈ 0.5, strengthStd ≈ 0.125
  const defaultedEdgeCount = useMemo(() => {
    return edges.filter(e => {
      const data = e.data as any
      const weight = data?.weight
      const std = data?.strengthStd ?? data?.strength_std
      const hasDefaultWeight = weight !== undefined && Math.abs(weight - 0.5) < 0.01
      const hasDefaultStd = std !== undefined && Math.abs(std - 0.125) < 0.01
      return hasDefaultWeight && hasDefaultStd
    }).length
  }, [edges])

  // Count factors missing evidence (missing source or cee_inference)
  const factorsMissingEvidence = useMemo(() => {
    return grouped.factor.filter(n => {
      const obs = (n.data as any)?.observedState ?? (n.data as any)?.observed_state
      const src = obs?.source
      return !src || src === 'cee_inference'
    }).length
  }, [grouped.factor])

  const showAttentionBanner = defaultedEdgeCount > 2 || factorsMissingEvidence > 0

  // ── Factor sort: needs-attention first, then alpha ────────────────────────

  const sortedFactors = useMemo(() => {
    return [...grouped.factor].sort((a, b) => {
      const srcA = (a.data as any)?.observedState?.source ?? (a.data as any)?.observed_state?.source ?? ''
      const srcB = (b.data as any)?.observedState?.source ?? (b.data as any)?.observed_state?.source ?? ''
      const needsA = !srcA || srcA === 'cee_inference' ? 0 : 1
      const needsB = !srcB || srcB === 'cee_inference' ? 0 : 1
      if (needsA !== needsB) return needsA - needsB
      const labelA = String((a.data as any)?.label ?? a.id)
      const labelB = String((b.data as any)?.label ?? b.id)
      return labelA.localeCompare(labelB)
    })
  }, [grouped.factor])

  // ── Edge sort: fragile first, then by lowest confidence, then by highest |effect| ─

  const sortedEdges = useMemo(() => {
    return [...edges].sort((a, b) => {
      const aId = getDisplayEdgeId(a)
      const bId = getDisplayEdgeId(b)
      const aFragile = fragileEdgeIds.has(aId) ? 0 : 1
      const bFragile = fragileEdgeIds.has(bId) ? 0 : 1
      if (aFragile !== bFragile) return aFragile - bFragile

      const aData = a.data as any
      const bData = b.data as any
      const aConf = aData?.beliefExists ?? aData?.confidence ?? aData?.belief ?? 0.7
      const bConf = bData?.beliefExists ?? bData?.confidence ?? bData?.belief ?? 0.7
      if (Math.abs(aConf - bConf) > 0.001) return aConf - bConf

      const aWeight = aData?.weight ?? 0.5
      const bWeight = bData?.weight ?? 0.5
      return bWeight - aWeight
    })
  }, [edges, fragileEdgeIds])

  // ── Evidence gap filter (canonical countEdgesWithEvidence utility) ─────────

  const edgesWithoutEvidence = useMemo(() => {
    return edges.filter(edge => {
      const provenance = (edge.data as any)?.provenance
      return !provenance || NON_EVIDENCE_PROVENANCE.includes(provenance)
    })
  }, [edges])

  // ── Summary counts ────────────────────────────────────────────────────────

  const summaryParts: string[] = []
  if (grouped.goal.length) summaryParts.push(`${grouped.goal.length} goal`)
  if (grouped.decision.length) summaryParts.push(`${grouped.decision.length} decision`)
  if (grouped.option.length) summaryParts.push(`${grouped.option.length} option${grouped.option.length !== 1 ? 's' : ''}`)
  if (grouped.factor.length) summaryParts.push(`${grouped.factor.length} factor${grouped.factor.length !== 1 ? 's' : ''}`)
  if (grouped.risk.length) summaryParts.push(`${grouped.risk.length} risk${grouped.risk.length !== 1 ? 's' : ''}`)
  if (grouped.outcome.length) summaryParts.push(`${grouped.outcome.length} outcome${grouped.outcome.length !== 1 ? 's' : ''}`)

  // ── Strengthen section: defaulted values warning ──────────────────────────

  const showDefaultedWarning = defaultedEdgeCount > 2

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4 pb-4" data-testid="model-tab">

      {/* ── Summary line ──────────────────────────────────────────────────── */}
      <div className={`${typography.panelMeta} text-text-light`} data-testid="model-summary-line">
        {summaryParts.length > 0 ? summaryParts.join(' · ') : 'No nodes yet.'}
      </div>

      {/* ── Attention banner ──────────────────────────────────────────────── */}
      {showAttentionBanner && (
        <div
          className="flex items-start gap-2 px-2 py-2 rounded bg-warning-light border border-warning/30"
          data-testid="model-attention-banner"
        >
          <AlertTriangle className="w-3.5 h-3.5 text-warning shrink-0 mt-0.5" aria-hidden="true" />
          <div className={`${typography.panelBody} text-warning flex-1`}>
            {defaultedEdgeCount > 2 && (
              <span>{defaultedEdgeCount} edges have default values</span>
            )}
            {defaultedEdgeCount > 2 && factorsMissingEvidence > 0 && (
              <span> · </span>
            )}
            {factorsMissingEvidence > 0 && (
              <span>{factorsMissingEvidence} factor{factorsMissingEvidence !== 1 ? 's' : ''} missing evidence</span>
            )}
          </div>
        </div>
      )}

      {/* ── Factors section ───────────────────────────────────────────────── */}
      {sortedFactors.length > 0 && (
        <SectionErrorBoundary section="factors">
          <div data-testid="model-factors-section">
            <div className={`${typography.panelHeader} text-text-header mb-2`}>
              Factors ({sortedFactors.length})
            </div>
            <div>
              {sortedFactors.map(n => (
                <FactorCard key={n.id} node={n} />
              ))}
            </div>
          </div>
        </SectionErrorBoundary>
      )}

      {/* ── Edges section ─────────────────────────────────────────────────── */}
      {sortedEdges.length > 0 && (
        <SectionErrorBoundary section="edges">
          <div data-testid="model-edges-section">
            <div className={`${typography.panelHeader} text-text-header mb-2`}>
              Edges ({sortedEdges.length})
            </div>
            <div>
              {sortedEdges.map(e => (
                <EdgeCard
                  key={getDisplayEdgeId(e)}
                  edge={e}
                  nodes={nodes}
                  fragileEdgeIds={fragileEdgeIds}
                  robustEdgeIds={robustEdgeIds}
                />
              ))}
            </div>
          </div>
        </SectionErrorBoundary>
      )}

      {/* ── Options / Risks / Outcomes (collapsed reference) ─────────────── */}
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
      <div className="border-t border-panel-border pt-3" data-testid="model-strengthen-section">
        <div className={`${typography.panelHeader} text-text-header mb-2`}>Strengthen</div>

        {/* Defaulted values warning */}
        {showDefaultedWarning && (
          <div
            className={`${typography.panelBody} text-text-body mb-3 px-2 py-2 bg-warning-light rounded border border-warning/30`}
            data-testid="model-defaulted-warning"
          >
            {defaultedEdgeCount} edges appear to have default values. Adjusting effect sizes in the model above will improve accuracy.
          </div>
        )}

        {/* Evidence gaps using canonical countEdgesWithEvidence */}
        {edgesWithoutEvidence.length > 0 ? (
          <div data-testid="evidence-gaps-section">
            <div className={`${typography.panelBody} text-text-body mb-2`}>
              Strengthen your model
            </div>
            <div className="space-y-1">
              {edgesWithoutEvidence.slice(0, 5).map(edge => {
                const edgeId = getDisplayEdgeId(edge)
                const sourceNode = nodes.find(n => n.id === edge.source)
                const targetNode = nodes.find(n => n.id === edge.target)
                const edgeLabel = sourceNode && targetNode
                  ? `${String((sourceNode.data as any)?.label ?? edge.source)} → ${String((targetNode.data as any)?.label ?? edge.target)}`
                  : edgeId

                return (
                  <button
                    key={edgeId}
                    type="button"
                    onClick={() => focusEdgeById(edgeId)}
                    className="flex items-center gap-2 p-1.5 bg-panel border border-panel-border rounded w-full text-left hover:bg-sand-50 transition-colors"
                  >
                    <span className="text-text-light">◐</span>
                    <span className={`${typography.panelBody} text-text-header flex-1 min-w-0 truncate`}>
                      {edgeLabel}
                    </span>
                    <span className={`${typography.panelMeta} text-text-light shrink-0`}>Add evidence</span>
                  </button>
                )
              })}
              {edgesWithoutEvidence.length > 5 && (
                <p className={`${typography.panelMeta} text-text-light pl-1`}>
                  +{edgesWithoutEvidence.length - 5} more edges without evidence
                </p>
              )}
            </div>
          </div>
        ) : (
          <p className={`${typography.panelBody} text-text-light`}>
            All edges have supporting evidence.
          </p>
        )}
      </div>

      {/* ── Streaming diagnostics (Shift+D) ──────────────────────────────── */}
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
                    try {
                      if (navigator.clipboard?.writeText) {
                        navigator.clipboard.writeText(effectiveCorrelationId)
                      }
                    } catch {}
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
    </div>
  )
}
