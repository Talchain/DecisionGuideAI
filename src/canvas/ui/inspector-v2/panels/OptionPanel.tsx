/**
 * OptionPanel — Inspector panel for option nodes (spec §6, v6.2 three-group layout)
 * Groups: Context → Input (what this option changes) → Impact (post-analysis) → Connections
 * Primary editing surface: intervention inputs MUST remain editable.
 */

import { memo, useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { Sparkles } from 'lucide-react'
import { useCanvasStore } from '../../../store'
import { parseDraftingNotes, composeDescription } from '../draftingNote'
import type { NodeType, OptionNodeData } from '../../../domain/nodes'
import { InspectorCoaching } from '../shared/InspectorCoaching'
import { useNodeDisplayMetadata } from '../../../hooks/useNodeDisplayMetadata'
import { typography } from '../../../../styles/typography'
import { COMPARATIVE_COPY } from '../../../../components/results/utils/goalAnchorCopy'
import { useNodeMutations } from '../useInspectorMutations'
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
import { deriveDecisionVerdict, type DecisionVerdictReportLike } from '../../../../lib/decisionVerdict'
import { resolveEdgeSignedStrengthDisplay } from '../../../domain/edgeValueProvenance'
import type { EdgeValueDisplay } from '../../../domain/edgeValueProvenance'
import { resolveElementLabel, resolveFirstStatedLabel } from '../../../domain/elementLabel'

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
  // SINGLE VERDICT: the shared "is there a leading option?" answer, derived
  // from the same PLoT report the canvas badge and results panel read.
  const resultsReport = useCanvasStore(s => s.results?.report)

  const verdict = useMemo(
    () => deriveDecisionVerdict(resultsReport as DecisionVerdictReportLike | null | undefined, {
      visibleOptionIds: new Set(
        nodes.filter(n => n.type === 'option' || n.data?.type === 'option').map(n => n.id),
      ),
    }),
    [resultsReport, nodes],
  )

  const node = nodeId ? nodes.find(n => n.id === nodeId) : undefined
  const mutations = useNodeMutations(nodeId ?? '')
  const displayMetadata = useNodeDisplayMetadata(nodeId ?? '', 'option')

  // ROADMAP 2.1204 — the drafter's rephrase-absorption notes are separated
  // from the user's description. CEE APPENDS `\n\n<note>` per absorbed twin
  // (option-rephrase-merge.ts:459-462), so before this split they rendered
  // inside the editable textarea: unattributed (indistinguishable from the
  // user's own prose) and destroyed the moment the user typed over them.
  // `notes` render as attributed lines below; only `body` is editable, and
  // every commit recomposes the two in the producer's format.
  const rawDescription = node?.data?.description as string | undefined
  const { notes: draftingNotes, body: descriptionBody } = useMemo(
    () => parseDraftingNotes(rawDescription),
    [rawDescription],
  )

  // Description — EmptyDescriptionPrompt pattern
  const [description, setDescription] = useState(descriptionBody)
  const [isEditingDescription, setIsEditingDescription] = useState(false)

  const commitDescription = useCallback(
    (next: string) => mutations.setDescription(composeDescription(draftingNotes, next)),
    [mutations, draftingNotes],
  )

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
        factorLabel: resolveElementLabel(factorNode?.data),
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
          label: resolveElementLabel(tgt.data),
          strength: resolveEdgeSignedStrengthDisplay(e.data as Record<string, unknown> | undefined),
        }
      })
      .filter(Boolean) as Array<{
        edgeId: string
        nodeId: string
        nodeKind: NodeType
        label: string
        strength: EdgeValueDisplay
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
          label: resolveElementLabel(n.data),
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
      // Two legitimate name sources, then honest absence — never the id. The
      // graph node's own label wins; the analysis payload's `label` is the
      // fallback for an option the graph no longer holds; `o.option_id` is NOT
      // a third source, it is a database key and has been dropped.
      label: resolveFirstStatedLabel(nodes.find(n => n.id === o.option_id)?.data, { label: o.label }),
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
            <span className={`${typography.panelMeta} inline-flex items-center px-2.5 py-0.5 rounded-full bg-transparent text-text-body border border-panel-border`}>
              Baseline option
            </span>
          </div>
        )}

        {/* ROADMAP 2.1204 — the absorption disclosure, attributed. The sentence
            is the wire's, verbatim; the attribution is what tells the reader a
            drafter wrote it rather than them. Option panel only: no other node
            type carries a drafter absorption note. */}
        {draftingNotes.length > 0 && (
          <div
            className="mb-2 flex items-start gap-1.5"
            data-testid="option-drafting-note"
          >
            <Sparkles size={12} className="text-info mt-0.5 shrink-0" aria-hidden="true" />
            <p className={`${typography.panelMeta} text-text-light`}>
              <span className="text-text-body">
                {OPTION_STRINGS.draftingNoteAttribution}
              </span>
              {' — '}
              {draftingNotes.join('; ')}
            </p>
          </div>
        )}

        {description || isEditingDescription ? (
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            onBlur={() => {
              commitDescription(description)
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
            /* L-40 — the empty state is derived from THE SAME edge data the
               Connections group below reads (`outboundConnections`), not from
               `data.interventions` alone. An add-path option carries real
               factor edges and no intervention map, so the old copy denied
               three "Very strong +" connections that were on screen inches
               below it. Two data sources, one user-facing question, is how a
               panel comes to contradict itself. */
            outboundConnections.length > 0 ? (
              <p
                data-testid="option-links-without-values"
                className={`${typography.panelMeta} text-text-light py-2 text-center`}
              >
                {OPTION_STRINGS.linksWithoutValues
                  .replace('{count}', String(outboundConnections.length))
                  .replace('{s}', outboundConnections.length === 1 ? '' : 's')}
              </p>
            ) : (
              <p className={`${typography.panelMeta} text-text-light py-2 text-center`}>
                {EMPTY_STATES.noInterventions}
              </p>
            )
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
        // L-24 — every branch below is derived PER NODE. Previously the only
        // per-node signal was `hasImpactContent`; the fallback sentence was
        // shared, so an option ADDED SINCE the run and an option the run
        // covered-and-returned-nothing-for read identically. They are
        // different situations and only one of them is the user's to fix.
        // Was THIS node in the run's own comparison? `allOptions` is built
        // from `option_comparison`, i.e. the run's own record of what it
        // analysed — not from the canvas, and not from global mode.
        const runCoveredSomething = allOptions.length > 0
        const nodeWasInRun = allOptions.some(o => o.isCurrent)
        const addedSinceRun = runCoveredSomething && !nodeWasInRun
        // ⚠ THE THIRD DISJUNCT WAS RUN-LEVEL, NOT PER-NODE (review D2), so the
        // fix above never fired on the mainline shape. A run compares two or
        // more options; the user then adds a third. `allOptions.length > 1 &&
        // some(winPct != null)` is true of THE RUN, so the new option scored
        // as having impact content and rendered the OTHER options' bars —
        // foreign data under its own heading — instead of saying it was added
        // afterwards. The first round's fixture used a ONE-option comparison,
        // the single shape in which the old predicate happened to be false.
        // Gating on `nodeWasInRun` makes the whole predicate per-node.
        const hasImpactContent =
          displayMetadata.winRate !== null
          || !!headline
          || (nodeWasInRun && allOptions.length > 1 && allOptions.some(o => o.winPct != null))
        return (
        <PanelGroup kind="impact" label={GROUP_LABELS.impact}>
          <StaleGuardBanner hasResults={isResultsMode}>
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
                // The NUMBER, for the pp arithmetic below.
                const myPct = Math.round(displayMetadata.winRate * 100)
                // The STRING, from the shared formatter the hero readout at
                // the top of this panel already uses. Hand-formatting it a
                // second time is how one surface came to print "0%" where the
                // other printed "< 1%" for the same win rate, three lines
                // apart in one panel.
                const myReadout = formatWinProbability(displayMetadata.winRate)
                const leader = allOptions.reduce((best, o) => (o.winPct ?? 0) > (best.winPct ?? 0) ? o : best, allOptions[0])
                const leaderPct = leader.winPct ?? 0
                const gap = leaderPct - myPct
                if (leader.isCurrent) {
                  // SINGLE VERDICT (2026-07-25): the inspector may only say
                  // "the leading option" when the shared verdict says one
                  // exists. Previously this fired on being the local win-max,
                  // so it could assert a leader in the same session where the
                  // results panel said "no clear leading option".
                  if (verdict.hasLeadingOption === false) return null
                  return (
                    <p className={`${typography.panelBody} text-success mt-1`}>
                      {COMPARATIVE_COPY.sentence(myReadout)}
                    </p>
                  )
                }
                // ROADMAP 1.223: both remaining branches presuppose a leading
                // option — one names it ("the leading option"), one names the
                // option that is ahead ("Behind {label} by Npp"). Each was
                // ungated, firing off the local win-max and its own 5pp/10pp
                // threshold, so on a withheld turn they reinstated exactly the
                // claim the branch above had just declined to make. Same gate,
                // same silent-omission convention.
                if (verdict.hasLeadingOption === false) return null
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
                        className={`${typography.panelMeta} w-[110px] truncate text-text-light`}
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
                      <span className={`${typography.panelMeta} w-7 text-right text-text-light`}>
                        {o.winLabel ?? '—'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            ) : addedSinceRun ? (
              <p
                data-testid="option-impact-not-in-run"
                className={`${typography.panelMeta} text-text-light`}
              >
                {OPTION_STRINGS.impactNotInLastRun}
              </p>
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
          <p className={`${typography.panelMeta} text-text-light`}>{EMPTY_STATES.noConnectionsFlat}</p>
        )}
      </PanelGroup>

      {/* ── Expert-only model detail ──────────────────────────── */}
      <TechnicalDisclosure visible={techMode}>
        <OptionAdvancedEditor nodeId={nodeId} />
      </TechnicalDisclosure>
    </div>
  )
})
