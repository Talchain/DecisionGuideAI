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
import { unwrapInterventionValue } from '../../../utils/labelUtils'
import { factorDisplayText } from '../../../../utils/formatFactorDisplayValue'
import {
  getProvenanceLabel,
  getExtractionLabel,
  GROUP_LABELS,
  getInputGroupLabel,
  INLINE_LABELS,
  DESCRIPTION_PLACEHOLDERS,
} from '../inspectorStrings'
import { PanelGroup } from '../shared/PanelGroup'
import { PrimaryControlCard } from '../shared/PrimaryControlCard'
import { InlineNumberEditor } from '../shared/InlineNumberEditor'
import { InlineSectionLabel } from '../shared/InlineSectionLabel'
import { ImportanceBar } from '../shared/ImportanceBar'
import { EmptyDescriptionPrompt } from '../shared/EmptyDescriptionPrompt'
import { ConnectionRow } from '../shared/ConnectionRow'
import { StaleGuardBanner } from '../shared/StaleGuardBanner'
import { TechnicalDisclosure } from '../shared/TechnicalDisclosure'
import { DataBar } from '../../shared/DataBar'
import type { InspectorPanelProps } from '../types'
import {
  investigationValueTier,
  INVESTIGATION_VALUE_LABEL,
  INVESTIGATION_VALUE_COMPARISON,
  INVESTIGATION_VALUE_STEM,
  INVESTIGATION_VALUE_TOP_RANK_NOTE,
} from '../../../domain/investigationValue'
import { resolveCoaching } from '../coachingConfig'
import { FactorObservableEditor } from '../editors/FactorObservableEditor'
import { resolveEdgeSignedStrengthDisplay } from '../../../domain/edgeValueProvenance'
import { useParticipantName } from '../../../../collab/useParticipantName'
import { useCitedEvidence } from '../../../../collab/citedEvidenceCache'
import { CitedEvidenceNote } from '../../../../collab/CitedEvidenceNote'
import { resolveElementLabel } from '../../../domain/elementLabel'

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
  const { confirm: confirmEdit, lastConfirmed, isStaleAfterEdit } = useEditConfirmation()
  const displayMetadata = useNodeDisplayMetadata(nodeId ?? '', 'factor')

  /**
   * ⭐ ONE LADDER, SHARED. The tier decision used to be typed out twice in this
   * file and four more times in the two sibling factor panels — six copies of
   * `>= 0.7` / `>= 0.4` over one field. The WORDS below stay here, because they
   * differ by factor category on purpose; only the boundary moved.
   */
  const voiTier =
    displayMetadata.valueOfInformation === null
      ? null
      : investigationValueTier(displayMetadata.valueOfInformation)

  // Shared display text with FactorNode and the debug bundle — see the
  // priority order on FactorDisplayInput.display_value: fresh raw_value +
  // meaningful unit (£26,000) outranks display_value; otherwise display_value
  // wins over the unitless-raw and value-only fallbacks.
  const canonicalDisplayText = factorDisplayText(node?.data as Record<string, unknown> | undefined)

  const factorData = node?.data as FactorNodeData | undefined
  const obs = factorData?.observedState as ObservedState | undefined
  // Defensive unwrap: handles both plain numbers and `{ value, unit, ... }` objects.
  const rawValue = unwrapInterventionValue(obs?.raw_value).value ?? undefined
  const value = unwrapInterventionValue(obs?.value).value ?? undefined
  const cap = unwrapInterventionValue(obs?.cap).value ?? undefined
  const unit = obs?.unit as string | undefined
  const source = obs?.source as string | undefined
  /**
   * D1 — resolve a `panel_elicited` value's AUTHOR to a name, at render.
   *
   * Called unconditionally and before this component's `!nodeId || !node` early
   * return, because it is a hook. For every non-panel value it is a no-op: no
   * `elicited_from` means `no_attribution`, which fetches nothing and leaves
   * both labels below byte-identical to what they rendered before.
   */
  const attributedTo = useParticipantName(obs?.elicited_from)
  /**
   * The CITATION the owner recorded when they applied this value — a colleague's
   * note or link. Called unconditionally (it is a hook) and, like the name
   * resolution above, a no-op for every value that carries no citation: no
   * `evidence_event_id` means `no_citation`, which fetches nothing and renders
   * nothing, leaving this panel byte-identical to what it rendered before.
   */
  const citedEvidence = useCitedEvidence(obs?.elicited_from)

  // Description — conditional edit state for EmptyDescriptionPrompt pattern
  const [description, setDescription] = useState(String(node?.data?.description ?? ''))
  const [isEditingDescription, setIsEditingDescription] = useState(false)

  // Click-to-edit value (shared InlineNumberEditor); observation-first.
  const displayValue = rawValue ?? value

  const handleValueSave = useCallback((parsed: number) => {
    mutations.setObservedValue(parsed)
    confirmEdit('value')
  }, [mutations, confirmEdit])

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
          label: resolveElementLabel(tgt?.data),
          strength: resolveEdgeSignedStrengthDisplay(e.data as Record<string, unknown> | undefined),
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
          <span className={`${typography.panelMeta} inline-flex items-center px-2.5 py-0.5 rounded-full bg-transparent text-text-body border border-factor/30`}>
            You measure this
          </span>
          {source && (
            <span className={`${typography.panelMeta} inline-flex items-center px-2.5 py-0.5 rounded-full bg-transparent text-text-body border border-success/30`}>
              {getExtractionLabel(source, attributedTo)}
            </span>
          )}
        </div>

        {/* Post-analysis: ImportanceBar + VoI folded in (no separate bordered card) */}
        <StaleGuardBanner hasResults={isResultsMode}>
          {/* ⭐ GROUPING, NOT DECORATION — 4px WITHIN a pair, 16px BETWEEN.
          Both bars in this stack put their label BELOW their own value,
          and each group then ENDS WITH ITS OWN GUIDANCE SENTENCE.

          ⚠ AN EARLIER VERSION OF THIS COMMENT SAID "`ImportanceBar` ends
          with its label; the VoI block does the same". The first half is
          true at the bytes; the second is FALSE - the VoI block ends with
          a guidance `<p>`, a third `mt-1` item. That "two pairs" model is
          exactly what made the influence sentence's placement invisible to
          the author: a group modelled as a PAIR has no room in it for the
          third element that was actually there. At `space-y-2` the gap BETWEEN pairs was 8px while the
          gap WITHIN a pair was `mt-1` = 4px — only 2x — so a reader
          scanning down met:

          100%                  <- influence value
          Influence on results  <- ITS label
          Low                   <- the VoI value
          Investigation value   <- ITS label

          and paired "Influence on results" with the "Low" beneath it,
          reading "influence: Low" directly under "100%".

          ⚠ THE DATA WAS NEVER WRONG and this is NOT a data fix. Influence
          and value-of-information are different quantities and both were
          rendered correctly. But the misreading is reproducible and has
          now caught THREE independent readers: a reviewer who nearly
          filed it as a data-integrity defect, the author who documented
          that near-miss at `inspectorStrings.ts:404`, and a lane that
          re-filed it as a "100% vs Low contradiction" from a deployed
          capture on 7 Sep 2026. A presentation that reliably produces a
          false reading is a defect even when every number in it is right.

          Adding the `Investigation value` label (the prior fix) told the
          reader the second bar HAS a name; it could not tell them which
          bar each name belongs to, because proximity still said
          otherwise. 4px within a group vs 16px between them makes proximity say
            the true thing - but ONLY once every sentence sits inside the
            group it describes, which is the change below and is what the
            first cut of this fix missed. */}
          <div className="mt-2 space-y-4">
            {/* ⚠ THE GUIDANCE SENTENCE IS PART OF THIS GROUP, AND MOVING IT HERE IS
                THE WHOLE REPAIR. It was rendered as the container's next SIBLING at
                `mt-2` = 8px, while the two groups inside sit `space-y-4` = 16px
                apart — so a sentence about INFLUENCE ended up twice as close to the
                value-of-information group as the two groups are to each other, and
                proximity is comparative. `inspectorStrings.ts:403-419` names exactly
                this juxtaposition: *"'influence: Low' directly above 'one of the most
                influential'"*.

                SAFE BY DERIVATION, not by inspection — and the derivation here is
                SIMPLER than the one in `FactorControllablePanel`, which is why this
                paragraph no longer copies it. ⚠ IT DID COPY IT, and review caught the
                copy: it cited a container gate of `isResultsMode && (influence != null
                || sensitivityRank != null)`, which is real CODE in Controllable
                (`:437`) and appears in THIS file only inside that borrowed sentence.
                A comment that describes its neighbour's code is the same defect one
                level down from the one this fix exists to close.
                What is true here: this panel's `<StaleGuardBanner>` is UNCONDITIONAL —
                it takes `hasResults` as a prop and is not behind any `&&` — so the
                container always renders and nothing can be lost by moving the guidance
                inside, whatever `sensitivityGuidance` evaluates to. ⚠ THAT PROOF IS PANEL-SPECIFIC and
                does NOT hold for `FactorExternalPanel`, whose guidance is
                unconditional and is not always about influence — it is separated
                there instead. The three panels look identical and are not; treating
                them as one is what produced this defect.

                Typography is deliberately UNCHANGED (`panelBody`/`text-text-body`).
                This is a change of POSITION, not of type — sizing the sentence to
                its neighbours is a separate question and is not smuggled in here. */}
            <div>
              <ImportanceBar
              importanceScore={displayMetadata.influence}
              sensitivityRank={displayMetadata.sensitivityRank}
              />
              {sensitivityGuidance && (
                <p className={`${typography.panelBody} text-text-body mt-1`}>{sensitivityGuidance}</p>
              )}
            </div>
            {voiTier !== null && (
              <div>
                <DataBar
                  value={displayMetadata.valueOfInformation}
                  label={INLINE_LABELS.investigationValue}
                  colour="info"
                  trailingLabel={INVESTIGATION_VALUE_LABEL[voiTier]}
                />
                {/* Its own label, in the same place ImportanceBar puts its own —
                    without it, that bar's label reads as this bar's. */}
                <div className={`${typography.panelMeta} text-text-light mt-1`}>
                  {INLINE_LABELS.investigationValue}
                </div>
                <p className={`${typography.panelMeta} text-text-light mt-1`}>
                  {INVESTIGATION_VALUE_STEM.measurement}{INVESTIGATION_VALUE_COMPARISON[voiTier]}
                  {displayMetadata.voiRank !== null && ` ${INVESTIGATION_VALUE_TOP_RANK_NOTE}`}
                </p>
              </div>
            )}
          </div>
        </StaleGuardBanner>

      </PanelGroup>

      {/* ── Your input group ──────────────────────────────────── */}
      {/* The header is a CLAIM about who supplied this number, not a static
          caption. "Your input" over an Olumi estimate is false attribution —
          see getInputGroupLabel (inspectorStrings.ts) for both directions. */}
      <PanelGroup kind="input" label={getInputGroupLabel(source, displayValue != null)}>
        <PrimaryControlCard>
          {/* CEE-canonical display text above value */}
          {canonicalDisplayText && (
            <div className={`${typography.panelBody} text-text-body mb-1.5`} data-testid="factor-display-text">
              {canonicalDisplayText}
            </div>
          )}

          {/* Click-to-edit value — observation-first (shared InlineNumberEditor) */}
          <InlineNumberEditor
            readout={displayValue != null ? formatValue(displayValue) : null}
            placeholder="No value set. Click to enter."
            // Exact raw value (no scale conversion here) → unchanged-blur is a no-op (P1-4).
            value={displayValue ?? null}
            onSave={handleValueSave}
            displayTestId="observable-value-display"
            inputTestId="observable-value-input"
            title="Click to enter a value"
          />

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
              <span className={`${typography.panelMeta} text-info`}>{getProvenanceLabel(source, attributedTo)}</span>
            </div>
          )}

          {/* What the owner cited when they applied it. Renders only when a
              citation resolved; never gated on `source`, because the citation is
              a fact about the apply and not about the extraction kind. */}
          <CitedEvidenceNote resolution={citedEvidence} />
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
