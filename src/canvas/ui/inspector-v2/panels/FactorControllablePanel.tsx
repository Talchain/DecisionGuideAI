/**
 * FactorControllablePanel — Inspector for controllable factors (spec §7)
 * v6.2 Pattern B three-group layout: Context → Your input → Connections.
 * ImportanceBar + VoI fold into Context group (post-analysis), replacing
 * the separate Impact / Investigation value sections.
 */

import { memo, useState, useMemo, useCallback } from 'react'
import { Link } from 'lucide-react'
import { useCanvasStore } from '../../../store'
import type { NodeType, ObservedState, FactorNodeData } from '../../../domain/nodes'
import { useEditConfirmation } from '../useEditConfirmation'
import { EditConfirmation } from '../shared/EditConfirmation'
import { InlineRerunPrompt } from '../shared/InlineRerunPrompt'
import { InspectorCoaching } from '../shared/InspectorCoaching'
import { useNodeDisplayMetadata } from '../../../hooks/useNodeDisplayMetadata'
import { typography } from '../../../../styles/typography'
import { useNodeMutations } from '../useInspectorMutations'
import { shouldShowNormalised } from '../normalisedDisplay'
import { unwrapInterventionValue, classifyUnit } from '../../../utils/labelUtils'
import { factorDisplayText } from '../../../../utils/formatFactorDisplayValue'
import {
  GROUP_LABELS,
  DESCRIPTION_PLACEHOLDERS,
  getExtractionLabel,
  getProvenanceLabel,
} from '../inspectorStrings'
import { PanelGroup } from '../shared/PanelGroup'
import { PrimaryControlCard } from '../shared/PrimaryControlCard'
import { EmptyDescriptionPrompt } from '../shared/EmptyDescriptionPrompt'
import { ImportanceBar } from '../shared/ImportanceBar'
import { ConnectionRow } from '../shared/ConnectionRow'
import { StaleGuardBanner } from '../shared/StaleGuardBanner'
import { TechnicalDisclosure } from '../shared/TechnicalDisclosure'
import { DataBar } from '../../shared/DataBar'
import type { InspectorPanelProps } from '../types'
import { resolveCoaching } from '../coachingConfig'
import { FactorControllableEditor } from '../editors/FactorControllableEditor'
import { resolveEdgeSignedStrengthDisplay } from '../../../domain/edgeValueProvenance'

/**
 * Extract a non-empty string intervention value, accepting either a bare
 * string or a `{ value: string }` object. Used by the connections badge
 * which renders qualitative interventions verbatim. Returns null when no
 * non-empty string is present (so the caller can fall back to "no badge").
 */
function extractStringIntervention(raw: unknown): string | null {
  if (typeof raw === 'string') return raw.trim() === '' ? null : raw
  if (raw != null && typeof raw === 'object' && 'value' in raw) {
    const v = (raw as { value: unknown }).value
    if (typeof v === 'string') return v.trim() === '' ? null : v
  }
  return null
}

export const FactorControllablePanel = memo(function FactorControllablePanel({
  nodeId,
  techMode,
  onClose,
  onNavigate,
}: InspectorPanelProps) {
  const nodes = useCanvasStore(s => s.nodes)
  const edges = useCanvasStore(s => s.edges)
  const resultsStatus = useCanvasStore(s => s.results?.status)
  const isResultsMode = resultsStatus === 'complete'

  const node = nodeId ? nodes.find(n => n.id === nodeId) : undefined
  const mutations = useNodeMutations(nodeId ?? '')
  const { confirm: confirmEdit, lastConfirmed, isStaleAfterEdit } = useEditConfirmation()
  const displayMetadata = useNodeDisplayMetadata(nodeId ?? '', 'factor')

  // Shared display text with FactorNode and the debug bundle — routes through
  // formatFactorDisplayValue. See the priority order on
  // FactorDisplayInput.display_value: fresh raw_value + meaningful unit
  // (£26,000) outranks display_value; otherwise display_value wins over the
  // unitless-raw and value-only fallbacks (e.g. unitless raw_value=0 with
  // display_value="No acquisition pursued" renders the contextual text, not "0").
  const canonicalDisplayText = factorDisplayText(node?.data as Record<string, unknown> | undefined)

  // Canonical typing via FactorNodeData / ObservedState (canvas/domain/nodes).
  // The store still holds legacy extras beyond the schema, so we keep unwrap
  // helpers for defensive numeric coercion below.
  const factorData = node?.data as FactorNodeData | undefined
  const obs = factorData?.observedState as ObservedState | undefined
  // Defensive unwrap: observedState.raw_value / value / cap should be plain
  // numbers, but CEE/legacy paths can wrap them in `{ value, unit, ... }`
  // objects. Casting unknown→number lies; the values then reach the editable
  // input via `String(displayValue)` and render as "[object Object]".
  // unwrapInterventionValue is generic numeric defense (handles both number
  // and `{ value: number }`) and returns null when the input cannot resolve.
  const rawValue = unwrapInterventionValue(obs?.raw_value).value ?? undefined
  const value = unwrapInterventionValue(obs?.value).value ?? undefined
  const cap = unwrapInterventionValue(obs?.cap).value ?? undefined
  const unit = obs?.unit as string | undefined
  const source = obs?.source as string | undefined
  // Canonical location is observedState.uncertainty_drivers (per ObservedStateSchema).
  // Fall back to legacy top-level node.data.uncertainty_drivers for in-flight data
  // that predates the schema consolidation.
  const uncertaintyDrivers =
    (obs?.uncertainty_drivers ??
      ((factorData as unknown as { uncertainty_drivers?: string[] })?.uncertainty_drivers)) as
      | string[]
      | undefined

  // Description — EmptyDescriptionPrompt pattern (Pattern B parity)
  const [description, setDescription] = useState(String(node?.data?.description ?? ''))
  const [isEditingDescription, setIsEditingDescription] = useState(false)

  // Local draft for editable value input
  const inputDisplayValue = rawValue ?? value
  const [draftValue, setDraftValue] = useState<string>(inputDisplayValue != null ? String(inputDisplayValue) : '')
  const handleValueBlur = useCallback(() => {
    const parsed = parseFloat(draftValue)
    if (!isNaN(parsed) && parsed !== value) {
      mutations.setObservedValue(parsed)
      confirmEdit('value')
    }
  }, [draftValue, value, mutations, confirmEdit])

  // Connections: options that set this + outbound influences
  const setByOptions = useMemo(() => {
    return edges
      .filter(e => e.target === nodeId)
      .map(e => {
        const src = nodes.find(n => n.id === e.source)
        const kind = (src?.type || src?.data?.kind || 'factor') as NodeType
        if (kind !== 'option') return null
        // Interventions may be stored as plain numbers (legacy/analysis_ready),
        // as UIInterventionValue/CEEInterventionV3 objects ({ value, source,
        // ... }), or — for qualitative factors — as plain strings or
        // {value: string} objects. unwrapInterventionValue handles the numeric
        // path; the string-pass-through branch below covers the rest.
        // The connections badge is one of the few intervention display sites
        // that can render strings verbatim — the editable / arithmetic sites
        // (OptionPanel, OptionAdvancedEditor, FactorNode hover) require finite
        // numbers and correctly drop string entries.
        const ivs = (src?.data as Record<string, unknown>)?.interventions as Record<string, unknown> | undefined
        const raw = ivs?.[nodeId ?? '']
        const { value: interventionValue, displayValue: interventionDisplayValue } = unwrapInterventionValue(raw)
        const interventionStringValue =
          interventionValue == null ? extractStringIntervention(raw) : null
        return {
          nodeId: e.source,
          label: String(src?.data?.label ?? e.source),
          interventionValue,
          interventionDisplayValue,
          interventionStringValue,
          unit,
        }
      })
      .filter(Boolean) as Array<{
        nodeId: string
        label: string
        interventionValue: number | null
        interventionDisplayValue: string | null
        interventionStringValue: string | null
        unit?: string
      }>
  }, [edges, nodes, nodeId, unit])

  const influences = useMemo(() => {
    return edges
      .filter(e => e.source === nodeId)
      .map(e => {
        const tgt = nodes.find(n => n.id === e.target)
        const kind = (tgt?.type || tgt?.data?.kind || 'factor') as NodeType
        return {
          edgeId: e.id,
          nodeId: e.target,
          nodeKind: kind,
          label: String(tgt?.data?.label ?? e.target),
          strength: resolveEdgeSignedStrengthDisplay(e.data as Record<string, unknown> | undefined),
        }
      })
  }, [edges, nodes, nodeId])

  if (!nodeId || !node) return null

  // Contextual guidance sentence based on sensitivity rank
  const sensitivityGuidance = isResultsMode && displayMetadata.sensitivityRank != null
    ? displayMetadata.sensitivityRank <= 2
      ? 'This is one of the most influential factors in your model. Changes here noticeably affect the result.'
      : displayMetadata.sensitivityRank <= 5
      ? 'This factor has moderate influence on the results.'
      : null
    : null

  return (
    <div>
      {/* ── Context group ─────────────────────────────────────── */}
      <PanelGroup kind="context" label={GROUP_LABELS.context}>
        {/* Description — Pattern B (EmptyDescriptionPrompt) */}
        {description || isEditingDescription ? (
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            onBlur={() => {
              mutations.setDescription(description)
              if (!description.trim()) setIsEditingDescription(false)
            }}
            autoFocus={isEditingDescription && !description}
            placeholder={DESCRIPTION_PLACEHOLDERS.factor}
            rows={2}
            maxLength={500}
            className={`${typography.panelBody} w-full border border-panel-border rounded-lg px-2.5 py-1.5 bg-panel resize-none`}
          />
        ) : (
          <EmptyDescriptionPrompt
            placeholder={DESCRIPTION_PLACEHOLDERS.factor}
            onStartEditing={() => setIsEditingDescription(true)}
          />
        )}

        {/* Provenance pills: factor type identity + extraction source */}
        <div className="mt-2 flex gap-1.5 flex-wrap">
          {node.data?.factorType && (
            <span className={`${typography.panelMeta} font-medium inline-flex items-center px-2.5 py-0.5 rounded-full bg-transparent text-text-body border border-factor/30`}>
              {String(node.data.factorType)}
            </span>
          )}
          <span className={`${typography.panelMeta} font-medium inline-flex items-center px-2.5 py-0.5 rounded-full bg-transparent text-text-body border border-success/30`}>
            {getExtractionLabel(source)}
          </span>
        </div>

        {/* Post-analysis: ImportanceBar + VoI folded in (no separate bordered card) */}
        {isResultsMode && (displayMetadata.influence != null || displayMetadata.sensitivityRank != null) && (
          <StaleGuardBanner hasResults={isResultsMode}>
            <div className="mt-2 space-y-2">
              <ImportanceBar
                importanceScore={displayMetadata.influence}
                sensitivityRank={displayMetadata.sensitivityRank}
              />
              {displayMetadata.valueOfInformation !== null && (
                <div>
                  <DataBar
                    value={displayMetadata.valueOfInformation}
                    label="Investigation value"
                    colour="info"
                    trailingLabel={
                      displayMetadata.valueOfInformation >= 0.7 ? 'High'
                      : displayMetadata.valueOfInformation >= 0.4 ? 'Medium'
                      : 'Low'
                    }
                  />
                  <p className={`${typography.panelMeta} text-text-light mt-1`}>
                    {displayMetadata.valueOfInformation >= 0.7
                      ? 'Gathering more evidence here could significantly improve confidence.'
                      : displayMetadata.valueOfInformation >= 0.4
                      ? 'Additional evidence here would moderately sharpen the analysis.'
                      : 'Further investigation here is unlikely to change the outcome.'}
                  </p>
                </div>
              )}
            </div>
          </StaleGuardBanner>
        )}

        {/* Contextual guidance */}
        {sensitivityGuidance && (
          <p className={`${typography.panelBody} text-text-body mt-2`}>{sensitivityGuidance}</p>
        )}
      </PanelGroup>

      {/* ── Your input group ──────────────────────────────────── */}
      <PanelGroup kind="input" label={GROUP_LABELS.input}>
        <PrimaryControlCard>
          {canonicalDisplayText && (
            <div className={`${typography.panelBody} text-text-body mb-1.5`} data-testid="factor-display-text">
              {canonicalDisplayText}
            </div>
          )}
          <div className={`flex items-center ${unit && (unit === '\u00A3' || unit === '$' || unit === '\u20AC') ? 'gap-0' : 'gap-1.5'}`}>
            {unit && (unit === '\u00A3' || unit === '$' || unit === '\u20AC') && (
              <span className={`${typography.panelHeader} text-xl`}>{unit}</span>
            )}
            <input
              type="number"
              value={draftValue}
              onChange={e => setDraftValue(e.target.value)}
              onBlur={handleValueBlur}
              onKeyDown={e => { if (e.key === 'Enter') { e.currentTarget.blur() } }}
              placeholder="Enter value"
              className={`${typography.panelHeader} text-xl w-full bg-transparent border-b border-panel-border focus:border-primary outline-none py-0.5 transition-colors`}
            />
            {unit && unit !== '\u00A3' && unit !== '$' && unit !== '\u20AC' && (
              <span className={`${typography.panelMeta} text-text-light`}>{unit}</span>
            )}
          </div>
          {/* Provenance inline below value (no separate section title) */}
          {source && (
            <div className="flex items-center gap-1 mt-2 pt-2 border-t border-panel-border">
              <Link size={12} className="text-info" />
              <span className={`${typography.panelMeta} text-info`}>{getProvenanceLabel(source)}</span>
            </div>
          )}
          {uncertaintyDrivers && uncertaintyDrivers.length > 0 && (
            <div className="flex gap-1.5 flex-wrap mt-1.5">
              {uncertaintyDrivers.map((d, i) => (
                <span
                  key={i}
                  className={`${typography.panelMeta} font-medium inline-flex items-center px-2.5 py-0.5 rounded-full bg-transparent text-text-body`}
                  style={{ border: '1px solid var(--warning)4D' }}
                >
                  {d}
                </span>
              ))}
            </div>
          )}
        </PrimaryControlCard>

        {/* Edit feedback */}
        {lastConfirmed?.field === 'value' && (
          <div className="flex items-center gap-2 mt-1">
            <EditConfirmation trigger={lastConfirmed.ts} />
            <InlineRerunPrompt visible={isStaleAfterEdit} />
          </div>
        )}

        {/* Coaching — within Your input group, below the card */}
        <InspectorCoaching
          elementId={nodeId}
          panelType="factor-controllable"
          fallbackText={resolveCoaching('factorControllableEvidence', { factorName: String(node.data?.label ?? '') })}
          labelContext={{ label: String(node.data?.label ?? '') }}
        />
      </PanelGroup>

      {/* ── Connections group ─────────────────────────────────── */}
      <PanelGroup kind="connections" label={GROUP_LABELS.connections}>
        {setByOptions.length > 0 && (
          <>
            <div className={`${typography.panelMeta} text-text-light mb-1`}>Set by options:</div>
            {setByOptions.map(o => {
              // Precedence: CEE display_value (verbatim) > numeric (unit-prefixed
              // or bare) > qualitative string fallback. F.6 passthrough: when CEE
              // authored a label, render it without numeric re-formatting.
              const badgeContent = o.interventionDisplayValue
                ? o.interventionDisplayValue
                : o.interventionValue != null
                  ? (o.unit && classifyUnit(o.unit).kind !== 'placeholder' ? `${o.unit}${o.interventionValue.toLocaleString()}` : o.interventionValue)
                  : o.interventionStringValue != null
                    ? o.interventionStringValue
                    : null
              return (
                <ConnectionRow
                  key={o.nodeId}
                  nodeKind="option"
                  label={o.label}
                  badge={badgeContent != null ? (
                    <span className={`${typography.panelMeta} font-medium inline-flex items-center px-2 py-0.5 rounded-full bg-transparent text-text-body border border-option/30`}>
                      {badgeContent}
                    </span>
                  ) : undefined}
                  fullLabel
                  techMode={techMode}
                  onClick={() => onNavigate(o.nodeId)}
                />
              )
            })}
          </>
        )}
        {influences.length > 0 && (
          <>
            <div className={`${typography.panelMeta} text-text-light mb-1 ${setByOptions.length > 0 ? 'mt-2' : ''}`}>Influences:</div>
            {influences.map(conn => (
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
          </>
        )}
        {setByOptions.length === 0 && influences.length === 0 && (
          <p className={`${typography.panelMeta} text-text-light`}>No connections yet.</p>
        )}
      </PanelGroup>

      {/* ── Expert-only model detail ──────────────────────────── */}
      <TechnicalDisclosure visible={techMode}>
        <FactorControllableEditor nodeId={nodeId} />
        {/* Raw model values moved here from the value card — tech-mode only */}
        {shouldShowNormalised(techMode, rawValue) && value != null && (
          <div className={`${typography.panelMeta} text-text-light mt-2`}>
            System: model value: {value.toFixed(3)}
          </div>
        )}
        {cap != null && (
          <div className={`${typography.panelMeta} text-text-light mt-0.5`}>
            Cap: {cap.toLocaleString()}{unit ? ` ${unit}` : ''}
          </div>
        )}
      </TechnicalDisclosure>
    </div>
  )
})
