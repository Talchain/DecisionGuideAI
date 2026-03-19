/**
 * RelationshipsSection — edge cards with strength bar, semantic label, and fragile pill.
 *
 * Each edge card shows:
 *   - "A → B" label (clickable → canvas focus)
 *   - Fragile pill (post-analysis, when switch probability exists)
 *   - StrengthBar (visual effect size)
 *   - Semantic strength label ("Strong positive", "Moderate negative", etc.)
 *   - Likelihood (exists probability), editable
 *   - Provenance when evidence present
 *
 * Sort: fragile first (by switch probability desc), then by effect magnitude desc.
 * "Show full detail" expansion: std, signed effect, node IDs, provenance raw value.
 */

import { useCallback, useContext, useEffect, useMemo, useRef } from 'react'
import type { Edge, Node } from '@xyflow/react'
import { AlertTriangle } from 'lucide-react'
import { typography } from '../../../styles/typography'
import { useCanvasStore } from '../../store'
import { SectionErrorBoundary } from '../GraphTextView'
import { getDisplayEdgeId } from '../../utils/edgeIdentity'
import { focusEdgeById } from '../../utils/focusHelpers'
import { NON_EVIDENCE_PROVENANCE } from '../../utils/evidenceCoverage'
import { strengthSemanticLabel } from './utils'
import { InlineEdit } from './InlineEdit'
import { DetailToggleContext } from './DetailToggleContext'
import { StrengthBar } from '../../ui/inspector/StrengthBar'

interface RelationshipsSectionProps {
  edges: Edge[]
  nodes: Node[]
  /** Set of fragile edge IDs (from robustness data) */
  fragileEdgeIds?: Set<string>
  /** Map of edge ID → switch probability */
  fragileEdgeSwitchProbMap?: Map<string, number>
  /** Set of selected edge IDs (from canvas store) — triggers scroll-into-view */
  selectedEdgeIds?: Set<string>
}

// ── Edge card ──────────────────────────────────────────────────────────────────

function EdgeCard({
  edge,
  nodes,
  isFragile,
  switchProbability,
  isSelected,
}: {
  edge: Edge
  nodes: Node[]
  isFragile: boolean
  switchProbability: number | undefined
  isSelected?: boolean
}) {
  const cardRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (isSelected) {
      cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [isSelected])
  const { showDetail } = useContext(DetailToggleContext)
  const updateEdge = useCanvasStore(s => s.updateEdge)

  const edgeId = getDisplayEdgeId(edge)
  const data = edge.data as Record<string, unknown>

  const sourceNode = nodes.find(n => n.id === edge.source)
  const targetNode = nodes.find(n => n.id === edge.target)
  const fromLabel = String((sourceNode?.data as Record<string, unknown>)?.label ?? edge.source)
  const toLabel = String((targetNode?.data as Record<string, unknown>)?.label ?? edge.target)

  // Read raw values — treat absent fields as truly unset (no silent defaults)
  const rawWeight = data?.weight as number | undefined
  const rawDirection = data?.direction as string | undefined
  const safeDirection: 'positive' | 'negative' =
    rawDirection === 'negative' ? 'negative' : rawDirection === 'positive' ? 'positive' : 'positive'
  const strengthStd = data?.strengthStd ?? data?.strength_std

  const hasStrength = rawWeight !== undefined
  const signedMean = hasStrength ? (safeDirection === 'negative' ? -rawWeight! : rawWeight!) : undefined

  // Likelihood — absent means unset, not 70%
  const rawBelief = data?.beliefExists ?? data?.exists_probability ?? data?.confidence ?? data?.belief
  const hasLikelihood = rawBelief !== undefined
  const beliefExists = hasLikelihood ? (rawBelief as number) : undefined
  const likelihoodPct = hasLikelihood ? Math.round(beliefExists! * 100) : undefined

  const likelihoodColour = likelihoodPct === undefined
    ? 'bg-panel-border'
    : likelihoodPct >= 70 ? 'bg-success' : likelihoodPct >= 40 ? 'bg-warning' : 'bg-danger'

  const provenance = data?.provenance as string | undefined
  const hasEvidence = provenance && !NON_EVIDENCE_PROVENANCE.includes(provenance)

  const fragileTooltip = switchProbability !== undefined
    ? `${Math.round(switchProbability * 100)}% chance of flipping the recommendation`
    : 'Fragile — sensitive to assumption changes'

  const validateWeight = useCallback((s: string) => {
    const n = parseFloat(s)
    return !isNaN(n) && n >= 0 && n <= 2
  }, [])

  const validateLikelihood = useCallback((s: string) => {
    const n = parseFloat(s)
    return !isNaN(n) && n >= 0 && n <= 100
  }, [])

  const handleWeightSave = useCallback((val: string) => {
    const n = parseFloat(val)
    if (isNaN(n) || n < 0 || n > 2) return
    updateEdge(edgeId, { data: { ...data, weight: n } })
  }, [edgeId, data, updateEdge])

  const handleDirectionToggle = useCallback((dir: 'positive' | 'negative') => {
    updateEdge(edgeId, { data: { ...data, direction: dir } })
  }, [edgeId, data, updateEdge])

  const handleLikelihoodSave = useCallback((val: string) => {
    const pct = parseFloat(val)
    if (isNaN(pct) || pct < 0 || pct > 100) return
    updateEdge(edgeId, { data: { ...data, beliefExists: pct / 100 } })
  }, [edgeId, data, updateEdge])

  return (
    <div
      ref={cardRef}
      className={`bg-panel-hover rounded-lg p-2.5 mb-2 last:mb-0 transition-shadow${isSelected ? ' ring-1 ring-info/50' : ''}`}
      data-testid={`edge-card-${edgeId}`}
    >
      {/* Label row */}
      <div className="flex items-start gap-1.5 mb-2">
        <button
          type="button"
          onClick={() => focusEdgeById(edgeId)}
          className={`${typography.panelBody} text-text-body hover:text-info transition-colors flex-1 min-w-0 text-left leading-snug`}
        >
          <span>{fromLabel}</span>
          <span className="text-text-light mx-1" aria-hidden="true">→</span>
          <span>{toLabel}</span>
        </button>
        {isFragile && (
          <span
            className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full ${typography.panelMeta} font-medium bg-transparent border border-warning/30 text-text-body shrink-0`}
            title={fragileTooltip}
          >
            <AlertTriangle className="w-2.5 h-2.5 shrink-0" aria-hidden="true" />
            fragile
          </span>
        )}
      </div>

      {/* Strength row — editable weight + direction toggle */}
      <div className="mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`${typography.panelMeta} text-text-light`}>Strength</span>
          {hasStrength ? (
            <>
              <InlineEdit
                value={rawWeight!.toFixed(2)}
                onSave={handleWeightSave}
                validate={validateWeight}
                maxWidth="max-w-[55px]"
                numeric
                tooltip="Weight (0–2). Click to edit."
                testId={`edge-${edgeId}-weight`}
              />
              {/* Direction toggle */}
              <div className="inline-flex rounded overflow-hidden border border-panel-border" role="group" aria-label="Direction">
                <button
                  type="button"
                  onClick={() => handleDirectionToggle('positive')}
                  className={`px-2 py-0.5 ${typography.panelMeta} transition-colors ${
                    safeDirection === 'positive'
                      ? 'bg-success/20 text-success border-r border-panel-border'
                      : 'text-text-light hover:bg-panel border-r border-panel-border'
                  }`}
                  data-testid={`edge-${edgeId}-dir-positive`}
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={() => handleDirectionToggle('negative')}
                  className={`px-2 py-0.5 ${typography.panelMeta} transition-colors ${
                    safeDirection === 'negative'
                      ? 'bg-danger/20 text-danger'
                      : 'text-text-light hover:bg-panel'
                  }`}
                  data-testid={`edge-${edgeId}-dir-negative`}
                >
                  −
                </button>
              </div>
              <StrengthBar weight={rawWeight!} direction={safeDirection} />
            </>
          ) : (
            <button
              type="button"
              onClick={() => updateEdge(edgeId, { data: { ...data, weight: 0.5, direction: 'positive' } })}
              className={`inline-flex items-center px-2 py-0.5 rounded-full border border-panel-border text-text-light hover:bg-panel-hover transition-colors ${typography.panelMeta}`}
              data-testid={`edge-${edgeId}-weight-unset`}
            >
              unset — click to add
            </button>
          )}
        </div>
        {signedMean !== undefined && (
          <div className="mt-1">
            <span className={`${typography.panelMeta} ${signedMean >= 0 ? 'text-success' : 'text-danger'}`}>
              {strengthSemanticLabel(signedMean)}
            </span>
            {strengthStd !== undefined && (
              <span className={`${typography.panelMeta} text-text-light ml-1`}>
                ±{(strengthStd as number).toFixed(2)}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Likelihood row */}
      <div className="flex items-center gap-2">
        <span className={`${typography.panelMeta} text-text-light`} title="How confident you are that this relationship exists">
          Likelihood
        </span>
        {hasLikelihood ? (
          <>
            <InlineEdit
              value={String(likelihoodPct)}
              onSave={handleLikelihoodSave}
              validate={validateLikelihood}
              maxWidth="max-w-[55px]"
              numeric
              suffix="%"
              testId={`edge-${edgeId}-likelihood`}
            />
            <div className="h-1 bg-panel-border rounded-full overflow-hidden w-10">
              <div
                className={`h-full rounded-full transition-all ${likelihoodColour}`}
                style={{ width: `${likelihoodPct}%` }}
              />
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => updateEdge(edgeId, { data: { ...data, beliefExists: 0.7 } })}
            className={`inline-flex items-center px-2 py-0.5 rounded-full border border-panel-border text-text-light hover:bg-panel-hover transition-colors ${typography.panelMeta}`}
            data-testid={`edge-${edgeId}-likelihood-unset`}
          >
            unset — click to add
          </button>
        )}
      </div>

      {/* Provenance (evidence only) */}
      {hasEvidence && (
        <div className={`${typography.panelMeta} text-text-light mt-1`}>
          Source: {provenance}
        </div>
      )}

      {/* Full detail expansion */}
      {showDetail && (
        <div className="mt-2 pt-2 border-t border-panel-border">
          <div className={`${typography.panelMeta} text-text-light font-mono mb-1`}>Edge detail</div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
            {signedMean !== undefined && (
              <>
                <span className={`${typography.panelMeta} text-text-light`}>Signed effect</span>
                <span className={`${typography.panelMeta} text-text-body font-mono text-right`}>
                  {signedMean >= 0 ? '+' : ''}{signedMean.toFixed(3)}
                </span>
              </>
            )}
            {strengthStd !== undefined && (
              <>
                <span className={`${typography.panelMeta} text-text-light`}>Std</span>
                <span className={`${typography.panelMeta} text-text-body font-mono text-right`}>
                  {(strengthStd as number).toFixed(3)}
                </span>
              </>
            )}
            <span className={`${typography.panelMeta} text-text-light`}>Provenance</span>
            <span className={`${typography.panelMeta} text-text-body text-right`}>
              {(provenance as string | undefined) ?? '—'}
            </span>
            <span className={`${typography.panelMeta} text-text-light`}>Edge ID</span>
            <span className={`${typography.panelMeta} text-[10px] text-text-body font-mono text-right truncate`}>
              {edgeId}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Section ────────────────────────────────────────────────────────────────────

function RelationshipsSectionInner({
  edges,
  nodes,
  fragileEdgeIds = new Set(),
  fragileEdgeSwitchProbMap = new Map(),
  selectedEdgeIds,
}: RelationshipsSectionProps) {
  // Only causal edges (exclude hierarchy/structural types)
  const causalEdges = useMemo(() =>
    edges.filter(e => {
      const t = (e.data as Record<string, unknown>)?.type as string | undefined
      return !t || !['hierarchy', 'containment', 'structural'].includes(t)
    }),
    [edges]
  )

  const sorted = useMemo(() => {
    return [...causalEdges].sort((a, b) => {
      const aId = getDisplayEdgeId(a)
      const bId = getDisplayEdgeId(b)
      const aSwitchProb = fragileEdgeSwitchProbMap.get(aId) ?? -1
      const bSwitchProb = fragileEdgeSwitchProbMap.get(bId) ?? -1
      if (aSwitchProb !== bSwitchProb) return bSwitchProb - aSwitchProb

      const aData = a.data as Record<string, unknown>
      const bData = b.data as Record<string, unknown>
      const aWeight = (aData?.weight as number | undefined) ?? 0.5
      const bWeight = (bData?.weight as number | undefined) ?? 0.5
      return bWeight - aWeight
    })
  }, [causalEdges, fragileEdgeSwitchProbMap])

  if (causalEdges.length === 0) return null

  return (
    <div className="bg-panel border border-panel-border rounded-xl p-3" data-testid="model-relationships-section">
      {/* Section header */}
      <div className="flex items-center gap-2 mb-2">
        <div className="w-3 h-3 bg-info rounded-full shrink-0" aria-hidden="true" />
        <span className={`${typography.panelHeader} text-text-header`}>Relationships</span>
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full bg-transparent border border-panel-border text-text-body ${typography.panelMeta} font-medium`}>
          {causalEdges.length}
        </span>
        {fragileEdgeIds.size > 0 && (
          <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-transparent border border-warning/30 text-text-body ${typography.panelMeta} font-medium`}>
            <AlertTriangle className="w-2.5 h-2.5 shrink-0" aria-hidden="true" />
            {fragileEdgeIds.size} fragile
          </span>
        )}
      </div>

      {sorted.map(edge => {
        const edgeId = getDisplayEdgeId(edge)
        return (
          <EdgeCard
            key={edgeId}
            edge={edge}
            nodes={nodes}
            isFragile={fragileEdgeIds.has(edgeId)}
            switchProbability={fragileEdgeSwitchProbMap.get(edgeId)}
            isSelected={selectedEdgeIds?.has(edgeId)}
          />
        )
      })}
    </div>
  )
}

export function RelationshipsSection(props: RelationshipsSectionProps) {
  return (
    <SectionErrorBoundary section="relationships">
      <RelationshipsSectionInner {...props} />
    </SectionErrorBoundary>
  )
}
