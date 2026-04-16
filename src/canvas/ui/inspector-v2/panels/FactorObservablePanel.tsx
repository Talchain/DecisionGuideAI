/**
 * FactorObservablePanel — Inspector for observable factors (spec §8)
 * v6.2 three-group layout: Context → Your input → Influences
 * Value is observation-first (user reports what they see). Click-to-edit.
 */

import { memo, useState, useMemo, useCallback } from 'react'
import { Link } from 'lucide-react'
import { useCanvasStore } from '../../../store'
import type { NodeType, ObservedState, FactorNodeData } from '../../../domain/nodes'
import { InspectorCoaching } from '../shared/InspectorCoaching'
import { useNodeDisplayMetadata } from '../../../hooks/useNodeDisplayMetadata'
import { typography } from '../../../../styles/typography'
import { useNodeMutations } from '../useInspectorMutations'
import { useEditConfirmation } from '../useEditConfirmation'
import { EditConfirmation } from '../shared/EditConfirmation'
import { InlineRerunPrompt } from '../shared/InlineRerunPrompt'
import { useStaleGuard } from '../useStaleGuard'
import { unwrapInterventionValue } from '../../../utils/labelUtils'
import { factorDisplayText } from '../../../../utils/formatFactorDisplayValue'
import {
  getProvenanceLabel,
  getExtractionLabel,
  GROUP_LABELS,
  INLINE_LABELS,
  DESCRIPTION_PLACEHOLDERS,
} from '../inspectorStrings'
import { PanelGroup } from '../shared/PanelGroup'
import { PrimaryControlCard } from '../shared/PrimaryControlCard'
import { InlineSectionLabel } from '../shared/InlineSectionLabel'
import { ImportanceBar } from '../shared/ImportanceBar'
import { EmptyDescriptionPrompt } from '../shared/EmptyDescriptionPrompt'
import { ConnectionRow } from '../shared/ConnectionRow'
import { StaleGuardBanner } from '../shared/StaleGuardBanner'
import { TechnicalDisclosure } from '../shared/TechnicalDisclosure'
import { DataBar } from '../../shared/DataBar'
import type { InspectorPanelProps } from '../types'
import { resolveCoaching } from '../coachingConfig'
import { FactorObservableEditor } from '../editors/FactorObservableEditor'

export const FactorObservablePanel = memo(function FactorObservablePanel({
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
  const { isStale } = useStaleGuard()
  const { confirm: confirmEdit, lastConfirmed, isStaleAfterEdit } = useEditConfirmation()
  const displayMetadata = useNodeDisplayMetadata(nodeId ?? '', 'factor')

  // Shared display text with FactorNode — `display_value` takes priority.
  const canonicalDisplayText = factorDisplayText(node?.data as Record<string, unknown> | undefined)

  const factorData = node?.data as FactorNodeData | undefined
  const obs = factorData?.observedState as ObservedState | undefined
  // Defensive unwrap: handles both plain numbers and `{ value, unit, ... }` objects.
  const rawValue = unwrapInterventionValue(obs?.raw_value).value ?? undefined
  const value = unwrapInterventionValue(obs?.value).value ?? undefined
  const cap = unwrapInterventionValue(obs?.cap).value ?? undefined
  const unit = obs?.unit as string | undefined
  const source = obs?.source as string | undefined

  // Description — conditional edit state for EmptyDescriptionPrompt pattern
  const [description, setDescription] = useState(String(node?.data?.description ?? ''))
  const [isEditingDescription, setIsEditingDescription] = useState(false)

  // Click-to-edit value state
  const displayValue = rawValue ?? value
  const [isEditingValue, setIsEditingValue] = useState(false)
  const [draftValue, setDraftValue] = useState<string>(displayValue != null ? String(displayValue) : '')

  const handleValueSave = useCallback(() => {
    const parsed = parseFloat(draftValue)
    if (!isNaN(parsed)) {
      mutations.setObservedValue(parsed)
      confirmEdit('value')
    }
    setIsEditingValue(false)
  }, [draftValue, mutations, confirmEdit])

  const formatValue = useCallback((v: number) => {
    if (unit === '\u00A3' || unit === '$' || unit === '\u20AC') return `${unit}${v.toLocaleString()}`
    return unit ? `${v.toLocaleString()} ${unit}` : `${v}`
  }, [unit])

  // Outbound influences
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
          strength: { weight: e.data?.weight ?? 0, direction: (e.data?.direction ?? 'positive') as 'positive' | 'negative' },
        }
      })
  }, [edges, nodes, nodeId])

  if (!nodeId || !node) return null

  // Contextual guidance based on sensitivity rank
  const sensitivityGuidance = isResultsMode && displayMetadata.sensitivityRank != null
    ? displayMetadata.sensitivityRank <= 2
      ? 'This is one of the most influential measurements in your model.'
      : displayMetadata.sensitivityRank <= 5
      ? 'This measurement has moderate influence on the results.'
      : null
    : null

  return (
    <div>
      {/* ── Context group ─────────────────────────────────────── */}
      <PanelGroup kind="context" label={GROUP_LABELS.context}>
        {/* Description — textarea when editing or content exists, EmptyDescriptionPrompt when empty */}
        {description || isEditingDescription ? (
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            onBlur={() => {
              mutations.setDescription(description)
              if (!description.trim()) setIsEditingDescription(false)
            }}
            autoFocus={isEditingDescription && !description}
            placeholder="Describe this observable factor..."
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

        {/* Provenance pills: category identity + data source */}
        <div className="mt-2 flex gap-1.5 flex-wrap">
          <span className={`${typography.panelMeta} font-medium inline-flex items-center px-2.5 py-0.5 rounded-full bg-transparent text-text-body border border-factor/30`}>
            You measure this
          </span>
          {source && (
            <span className={`${typography.panelMeta} font-medium inline-flex items-center px-2.5 py-0.5 rounded-full bg-transparent text-text-body border border-success/30`}>
              {getExtractionLabel(source)}
            </span>
          )}
        </div>

        {/* Post-analysis: ImportanceBar + VoI folded in (no separate bordered card) */}
        <StaleGuardBanner isStale={isStale} hasResults={isResultsMode}>
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
                    ? 'Updating this measurement could significantly improve the analysis.'
                    : displayMetadata.valueOfInformation >= 0.4
                    ? 'More recent data here would moderately sharpen the analysis.'
                    : 'Further investigation here is unlikely to change the outcome.'}
                </p>
              </div>
            )}
          </div>
        </StaleGuardBanner>

        {/* Contextual guidance */}
        {sensitivityGuidance && (
          <p className={`${typography.panelBody} text-text-body mt-2`}>{sensitivityGuidance}</p>
        )}
      </PanelGroup>

      {/* ── Your input group ──────────────────────────────────── */}
      <PanelGroup kind="input" label={GROUP_LABELS.input}>
        <PrimaryControlCard>
          {/* CEE-canonical display text above value */}
          {canonicalDisplayText && (
            <div className={`${typography.panelBody} text-text-body mb-1.5`} data-testid="factor-display-text">
              {canonicalDisplayText}
            </div>
          )}

          {/* Click-to-edit value — observation-first */}
          {!isEditingValue ? (
            <button
              type="button"
              data-testid="observable-value-display"
              className={`${typography.panelHeader} text-xl text-left w-full cursor-text hover:bg-panel-hover rounded px-0.5 -mx-0.5 transition-colors`}
              onClick={() => {
                setDraftValue(String(displayValue ?? ''))
                setIsEditingValue(true)
              }}
              title="Click to enter a value"
            >
              {displayValue != null
                ? formatValue(displayValue)
                : <span className={`${typography.panelMeta} text-text-light italic font-normal text-sm`}>No value set. Click to enter.</span>
              }
            </button>
          ) : (
            <input
              type="number"
              data-testid="observable-value-input"
              value={draftValue}
              autoFocus
              onChange={e => setDraftValue(e.target.value)}
              onBlur={handleValueSave}
              onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
              className={`${typography.panelHeader} text-xl w-full bg-transparent border-b border-panel-border focus:border-primary outline-none py-0.5 transition-colors`}
            />
          )}

          {/* Edit feedback */}
          {lastConfirmed?.field === 'value' && (
            <div className="flex items-center gap-2 mt-1">
              <EditConfirmation trigger={lastConfirmed.ts} />
              <InlineRerunPrompt visible={isStaleAfterEdit} />
            </div>
          )}

          {/* Provenance inline below value */}
          {source && (
            <div className="flex items-center gap-1 mt-2 pt-2 border-t border-panel-border">
              <Link size={12} className="text-info" />
              <span className={`${typography.panelMeta} text-info`}>{getProvenanceLabel(source)}</span>
            </div>
          )}
        </PrimaryControlCard>

        {/* Coaching — within Your input group, below the card */}
        <InspectorCoaching
          elementId={nodeId}
          panelType="factor-observable"
          fallbackText={resolveCoaching('factorObservableData', { factorName: String(node.data?.label ?? '') })}
          labelContext={{ label: String(node.data?.label ?? '') }}
        />
      </PanelGroup>

      {/* ── Influences group ──────────────────────────────────── */}
      <PanelGroup kind="connections" label={GROUP_LABELS.connections}>
        <InlineSectionLabel>{INLINE_LABELS.influences}</InlineSectionLabel>
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
        {influences.length === 0 && (
          <p className={`${typography.panelMeta} text-text-light`}>No outbound influences</p>
        )}
      </PanelGroup>

      {/* ── Expert-only model detail ──────────────────────────── */}
      <TechnicalDisclosure visible={techMode}>
        <FactorObservableEditor nodeId={nodeId} />
      </TechnicalDisclosure>
    </div>
  )
})
