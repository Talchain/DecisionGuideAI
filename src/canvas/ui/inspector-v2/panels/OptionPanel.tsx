/**
 * OptionPanel — Inspector panel for option nodes (spec §6, v6.2 three-group layout)
 * Groups: Context → Input (what this option changes) → Impact (post-analysis) → Connections
 * Primary editing surface: intervention inputs MUST remain editable.
 */

import { memo, useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { useCanvasStore } from '../../../store'
import type { NodeType, OptionNodeData } from '../../../domain/nodes'
import { InspectorCoaching } from '../shared/InspectorCoaching'
import { useNodeDisplayMetadata } from '../../../hooks/useNodeDisplayMetadata'
import { typography } from '../../../../styles/typography'
import { useNodeMutations } from '../useInspectorMutations'
import { useStaleGuard } from '../useStaleGuard'
import {
  GROUP_LABELS,
  DESCRIPTION_PLACEHOLDERS,
  EMPTY_STATES,
  OPTION_STRINGS,
} from '../inspectorStrings'
import { formatFactorValue, unwrapInterventionValue, formatWinProbability } from '../../../utils/labelUtils'
import { detectBaseline } from '../../../utils/baselineDetection'
import { PanelGroup } from '../shared/PanelGroup'
import { PrimaryControlCard } from '../shared/PrimaryControlCard'
import { EmptyDescriptionPrompt } from '../shared/EmptyDescriptionPrompt'
import { ConnectionRow } from '../shared/ConnectionRow'
import { InterventionRow } from '../shared/InterventionRow'
import { StaleGuardBanner } from '../shared/StaleGuardBanner'
import { TechnicalDisclosure } from '../shared/TechnicalDisclosure'
import type { InspectorPanelProps } from '../types'
import { COACHING } from '../coachingConfig'
import { OptionAdvancedEditor } from '../editors/OptionAdvancedEditor'
import { ResultsLink } from '../shared/ResultsLink'

export const OptionPanel = memo(function OptionPanel({
  nodeId,
  techMode,
  onClose,
  onNavigate,
}: InspectorPanelProps) {
  const nodes = useCanvasStore(s => s.nodes)
  const edges = useCanvasStore(s => s.edges)
  const resultsStatus = useCanvasStore(s => s.results?.status)
  const isResultsMode = resultsStatus === 'complete'
  const optionComparison = useCanvasStore(s => s.results?.report?.option_comparison)
  const storyHeadlines = useCanvasStore(s => s.results?.report?.story_headlines)

  const node = nodeId ? nodes.find(n => n.id === nodeId) : undefined
  const mutations = useNodeMutations(nodeId ?? '')
  const { isStale } = useStaleGuard()
  const displayMetadata = useNodeDisplayMetadata(nodeId ?? '', 'option')

  // Description — EmptyDescriptionPrompt pattern
  const [description, setDescription] = useState(String(node?.data?.description ?? ''))
  const [isEditingDescription, setIsEditingDescription] = useState(false)

  // Dropdown state for "Add a change"
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    if (!showDropdown) return
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showDropdown])

  // Interventions
  // Map values may be plain numbers (legacy/analysis_ready) or
  // UIInterventionValue/CEEInterventionV3 objects ({ value, source, ... });
  // unwrapInterventionValue normalises both. Entries that fail to unwrap
  // (malformed objects, non-finite numbers) are dropped — InterventionRow
  // requires a finite numeric `currentValue`.
  const interventions = useMemo(() => {
    const raw = (node?.data as Record<string, unknown>)?.interventions as Record<string, unknown> | undefined
    if (!raw) return []
    return Object.entries(raw).flatMap(([factorId, rawValue]) => {
      const { value, displayValue } = unwrapInterventionValue(rawValue)
      if (value == null) return []
      const factorNode = nodes.find(n => n.id === factorId)
      const obs = (factorNode?.data as Record<string, unknown>)?.observedState as Record<string, unknown> | undefined
      // Defensive unwrap: observedState.value / .raw_value should be plain
      // numbers, but legacy/wrapped shapes ({ value: 0.5, unit: 'scale' })
      // would otherwise flow into InterventionRow as the baseline prop and
      // render as "[object Object]" via .toLocaleString(). Same helper as
      // the intervention value above — generic numeric defense.
      return [{
        factorId,
        factorLabel: String(factorNode?.data?.label ?? factorId),
        baseline: unwrapInterventionValue(obs?.value).value ?? undefined,
        rawBaseline: unwrapInterventionValue(obs?.raw_value).value ?? undefined,
        unit: obs?.unit as string | undefined,
        value,
        displayValue: displayValue ?? undefined,
      }]
    })
  }, [node?.data, nodes])

  // Set of already-intervened factor IDs for the dropdown and connection filter
  const interventionIds = useMemo(() => {
    const raw = (node?.data as Record<string, unknown>)?.interventions as Record<string, unknown> | undefined
    return new Set(raw ? Object.keys(raw) : [])
  }, [node?.data])

  // Non-intervention outbound connections. Excludes edges to the decision
  // parent (implicit organisational link) and to factors already shown in
  // Input group as InterventionRows (avoids redundant display).
  const outboundConnections = useMemo(() => {
    return edges
      .filter(e => e.source === nodeId)
      .map(e => {
        const tgt = nodes.find(n => n.id === e.target)
        if (!tgt) return null
        const kind = (tgt.type || tgt.data?.kind || 'factor') as NodeType
        if (kind === 'decision') return null
        if (interventionIds.has(e.target)) return null
        return {
          edgeId: e.id,
          nodeId: e.target,
          nodeKind: kind,
          label: String(tgt.data?.label ?? e.target),
          strength: { weight: e.data?.weight ?? 0, direction: (e.data?.direction ?? 'positive') as 'positive' | 'negative' },
        }
      })
      .filter(Boolean) as Array<{
        edgeId: string
        nodeId: string
        nodeKind: NodeType
        label: string
        strength: { weight: number; direction: 'positive' | 'negative' }
      }>
  }, [edges, nodes, nodeId, interventionIds])

  // Controllable factors available to add
  const controllableFactors = useMemo(() => {
    return nodes
      .filter(n => (n.data?.category as string | undefined) === 'controllable' && n.id !== nodeId)
      .map(n => {
        const obs = (n.data as Record<string, unknown>)?.observedState as Record<string, unknown> | undefined
        const valueDisplay = formatFactorValue(obs as Parameters<typeof formatFactorValue>[0])
        return {
          id: n.id,
          label: String(n.data?.label ?? n.id),
          valueDisplay,
          // Defensive unwrap: see the interventions memo above. baseline flows
          // into mutations.setIntervention as the initial intervention value
          // for newly-added factor changes; passing an object would corrupt the
          // store and propagate "[object Object]" through downstream renders.
          baseline: unwrapInterventionValue(obs?.value).value ?? undefined,
        }
      })
  }, [nodes, nodeId])

  const handleAddFactor = useCallback((factorId: string, baseline: number | undefined) => {
    mutations.setIntervention(factorId, baseline ?? 0)
    setShowDropdown(false)
  }, [mutations])

  // All option results for comparison bars
  const allOptions = useMemo(() => {
    if (!optionComparison || !Array.isArray(optionComparison)) return []
    return (optionComparison as Array<{ option_id: string; win_probability?: number; label?: string }>).map(o => ({
      id: o.option_id,
      label: String(nodes.find(n => n.id === o.option_id)?.data?.label ?? o.label ?? o.option_id),
      // winPct: integer percent used for bar width + close-call gap arithmetic.
      // winLabel: user-facing string; routes through formatWinProbability so a
      // non-zero probability that rounds to 0 renders as "< 1%" rather than "0%".
      winPct: typeof o.win_probability === 'number' ? Math.round(o.win_probability * 100) : null,
      winLabel: typeof o.win_probability === 'number' ? formatWinProbability(o.win_probability) : null,
      isCurrent: o.option_id === nodeId,
    }))
  }, [optionComparison, nodes, nodeId])

  const headline = storyHeadlines && typeof storyHeadlines === 'object' && nodeId
    ? (storyHeadlines as Record<string, string>)[nodeId]
    : undefined

  // Baseline indication — mirrors OptionNode.tsx. Explicit `is_baseline` wins;
  // regex fallback only fires when the flag is absent (null/undefined).
  const optionData = node?.data as OptionNodeData | undefined
  const explicitIsBaseline = optionData?.is_baseline
  const isBaselineOption =
    explicitIsBaseline ?? detectBaseline(String(optionData?.label ?? '')).isBaseline

  if (!nodeId || !node) return null

  return (
    <div>
      {/* ── Context group ─────────────────────────────────────── */}
      <PanelGroup kind="context" label={GROUP_LABELS.context}>
        {isBaselineOption && (
          <div className="mb-2" data-testid="option-baseline-badge">
            <span className={`${typography.panelMeta} font-medium inline-flex items-center px-2.5 py-0.5 rounded-full bg-transparent text-text-body border border-panel-border`}>
              Baseline option
            </span>
          </div>
        )}

        {description || isEditingDescription ? (
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            onBlur={() => {
              mutations.setDescription(description)
              if (!description.trim()) setIsEditingDescription(false)
            }}
            autoFocus={isEditingDescription && !description}
            placeholder={DESCRIPTION_PLACEHOLDERS.option}
            rows={2}
            maxLength={500}
            className={`${typography.panelBody} w-full border border-panel-border rounded-lg px-2.5 py-1.5 bg-panel resize-none`}
          />
        ) : (
          <EmptyDescriptionPrompt
            placeholder={DESCRIPTION_PLACEHOLDERS.option}
            onStartEditing={() => setIsEditingDescription(true)}
          />
        )}
      </PanelGroup>

      {/* ── Input group (what this option changes) ─────────────── */}
      <PanelGroup kind="input" label={GROUP_LABELS.whatThisChanges}>
        <PrimaryControlCard>
          {interventions.length === 0 ? (
            <p className={`${typography.panelMeta} text-text-light py-2 text-center`}>
              {EMPTY_STATES.noInterventions}
            </p>
          ) : (
            interventions.map(iv => (
              <InterventionRow
                key={iv.factorId}
                factorId={iv.factorId}
                factorLabel={iv.factorLabel}
                baseline={iv.baseline}
                currentValue={iv.value}
                displayValue={iv.displayValue}
                unit={iv.unit}
                onChange={v => mutations.setIntervention(iv.factorId, v)}
                onNavigate={() => onNavigate(iv.factorId)}
                disabled={false}
                techMode={techMode}
                /* normalisedValue intentionally omitted — raw system values
                   live in TechnicalDisclosure via OptionAdvancedEditor. */
              />
            ))
          )}

          {/* Add a change — inside PrimaryControlCard as the list footer */}
          <div className="relative mt-1" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setShowDropdown(v => !v)}
              className={`${typography.panelMeta} w-full py-2 -mx-3 px-3 border-t border-dashed border-panel-border text-info hover:bg-panel-hover transition-colors`}
            >
              + Add a change
            </button>

            {showDropdown && (
              <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-panel border border-panel-border rounded-lg shadow-lg overflow-hidden max-h-48 overflow-y-auto">
                {controllableFactors.length === 0 ? (
                  <div className={`${typography.panelMeta} text-text-light px-3 py-2`}>
                    No controllable factors in this model
                  </div>
                ) : (
                  controllableFactors.map(f => {
                    const alreadySet = interventionIds.has(f.id)
                    return (
                      <button
                        key={f.id}
                        type="button"
                        disabled={alreadySet}
                        onClick={() => !alreadySet && handleAddFactor(f.id, f.baseline)}
                        className={`w-full flex items-center justify-between px-3 py-2 text-left transition-colors ${
                          alreadySet
                            ? 'opacity-40 cursor-not-allowed'
                            : 'hover:bg-panel-hover cursor-pointer'
                        }`}
                      >
                        <span className={`${typography.panelBody} text-text-body truncate`}>{f.label}</span>
                        <span className={`${typography.panelMeta} text-text-light ml-2 shrink-0`}>
                          {alreadySet ? 'Already set' : (f.valueDisplay ?? '—')}
                        </span>
                      </button>
                    )
                  })
                )}
              </div>
            )}
          </div>
        </PrimaryControlCard>

        {interventions.length > 0 && (
          <InspectorCoaching
            elementId={nodeId}
            panelType="option"
            fallbackText={COACHING.optionCoverage}
            labelContext={{ label: String(node.data?.label ?? '') }}
          />
        )}
      </PanelGroup>

      {/* ── Impact group — post-analysis only, absent from DOM otherwise ──
          When results are complete but impact data is missing (winRate null,
          no headline, no comparison bars) the group still renders with a
          fallback message rather than showing an empty bordered section —
          mirrors GoalPanel Task 1 pattern. */}
      {isResultsMode && (() => {
        const hasImpactContent =
          displayMetadata.winRate !== null
          || !!headline
          || (allOptions.length > 1 && allOptions.some(o => o.winPct != null))
        return (
        <PanelGroup kind="impact" label={GROUP_LABELS.impact}>
          <StaleGuardBanner isStale={isStale} hasResults={isResultsMode}>
            {hasImpactContent ? (
            <div>
              {/* Win probability hero */}
              {displayMetadata.winRate !== null && (
                <div className="flex items-center gap-3">
                  <div className="text-center">
                    <div className={`${typography.panelHeader} text-2xl`} style={{ color: 'var(--option)' }}>
                      {formatWinProbability(displayMetadata.winRate)}
                    </div>
                    <div className={`${typography.panelMeta} text-text-light`}>Chance of leading</div>
                    <ResultsLink label="Compare all options" tab="compare" />
                  </div>
                </div>
              )}

              {/* Comparative context */}
              {displayMetadata.winRate !== null && allOptions.length > 1 && (() => {
                const myPct = Math.round(displayMetadata.winRate * 100)
                const leader = allOptions.reduce((best, o) => (o.winPct ?? 0) > (best.winPct ?? 0) ? o : best, allOptions[0])
                const leaderPct = leader.winPct ?? 0
                const gap = leaderPct - myPct
                if (leader.isCurrent) {
                  return <p className={`${typography.panelBody} text-success mt-1`}>Currently the leading option.</p>
                }
                if (gap <= 5) {
                  return <p className={`${typography.panelBody} text-text-body mt-1`}>Within {gap}pp of the leading option. Small model changes could shift this.</p>
                }
                if (gap > 10) {
                  return <p className={`${typography.panelBody} text-text-light mt-1`}>Behind {leader.label} by {gap}pp.</p>
                }
                return null
              })()}

              {/* Story headline */}
              {headline && (
                <div className="bg-panel border rounded-lg p-2.5 mt-2" style={{ borderColor: 'var(--option)4D' }}>
                  <p className={`${typography.panelBody} italic text-text-body`}>&ldquo;{headline}&rdquo;</p>
                </div>
              )}

              {/* Comparison bars */}
              {allOptions.length > 1 && allOptions.some(o => o.winPct != null) && (
                <div className="mt-2">
                  {allOptions.map(o => (
                    <div key={o.id} className="flex items-center gap-2 py-0.5">
                      <span
                        className={`${typography.panelMeta} w-[110px] truncate ${o.isCurrent ? 'font-semibold' : ''} text-text-light`}
                      >
                        {o.label}
                      </span>
                      <div className="flex-1 h-1.5 bg-panel-border rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${o.winPct ?? 0}%`,
                            background: o.isCurrent ? 'var(--option)' : 'var(--text-light)',
                          }}
                        />
                      </div>
                      <span className={`${typography.panelMeta} w-7 text-right ${o.isCurrent ? 'font-semibold' : ''} text-text-light`}>
                        {o.winLabel ?? '—'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            ) : (
              <p className={`${typography.panelMeta} text-text-light`}>{OPTION_STRINGS.impactUnavailable}</p>
            )}
          </StaleGuardBanner>
        </PanelGroup>
        )
      })()}

      {/* ── Connections group ─────────────────────────────────── */}
      <PanelGroup kind="connections" label={GROUP_LABELS.connections}>
        {outboundConnections.map(conn => (
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
        {outboundConnections.length === 0 && (
          <p className={`${typography.panelMeta} text-text-light`}>No connections yet.</p>
        )}
      </PanelGroup>

      {/* ── Expert-only model detail ──────────────────────────── */}
      <TechnicalDisclosure visible={techMode}>
        <OptionAdvancedEditor nodeId={nodeId} />
      </TechnicalDisclosure>
    </div>
  )
})
