import { useSwitchFactorNodes } from '../../../hooks/useSwitchFactorNodes'
/**
 * FactorObservablePanel — Inspector for observable factors (spec §8)
 * Anatomy: summary → primary control → influence → connections; detail stays in More.
 * Value is observation-first (user reports what they see). Click-to-edit.
 */

import { memo, useState, useMemo, useCallback } from 'react'
import { useCanvasStore } from '../../../store'
import type { NodeType, ObservedState, FactorNodeData } from '../../../domain/nodes'
import { InspectorCoaching } from '../shared/InspectorCoaching'
import { useNodeDisplayMetadata } from '../../../hooks/useNodeDisplayMetadata'
import { typography } from '../../../../styles/typography'
import { controls } from '../../../../styles/controls'
import { useNodeMutations } from '../useInspectorMutations'
import { useEditConfirmation } from '../useEditConfirmation'
import { EditConfirmation } from '../shared/EditConfirmation'
import { InlineRerunPrompt } from '../shared/InlineRerunPrompt'
import { unwrapInterventionValue } from '../../../utils/labelUtils'
import { factorDisplayText } from '../../../../utils/formatFactorDisplayValue'
import {
  factorValueSourceLabel,
  GROUP_LABELS,
  getInputGroupLabel,
  INLINE_LABELS,
} from '../inspectorStrings'
import { PanelGroup } from '../shared/PanelGroup'
import { PrimaryControlCard } from '../shared/PrimaryControlCard'
import { OlumiScaleLine } from '../shared/OlumiScaleLine'
import { InlineNumberEditor } from '../shared/InlineNumberEditor'
import { formatNumber } from '../../../utils/formatValueWithUnit'
import { InlineSectionLabel } from '../shared/InlineSectionLabel'
import { ImportanceBar } from '../shared/ImportanceBar'
import { ConnectionRow } from '../shared/ConnectionRow'
import { InspectorConnectPicker } from '../shared/InspectorConnectPicker'
import { StaleGuardBanner } from '../shared/StaleGuardBanner'
import { FactorTurningPointInspectorLine } from '../shared/FactorTurningPointInspectorLine'
import { TechnicalDisclosure } from '../shared/TechnicalDisclosure'
import { DataBar } from '../../shared/DataBar'
import type { InspectorPanelProps } from '../types'
import {
  investigationValueTier,
  INVESTIGATION_VALUE_LABEL,
  INVESTIGATION_VALUE_INVITATION,
} from '../../../domain/investigationValue'
import { resolveCoaching } from '../coachingConfig'
import { FactorObservableEditor } from '../editors/FactorObservableEditor'
import { resolveEdgeSignedStrengthDisplay } from '../../../domain/edgeValueProvenance'
import { useParticipantName } from '../../../../collab/useParticipantName'
import { useCitedEvidence } from '../../../../collab/citedEvidenceCache'
import { CitedEvidenceNote } from '../../../../collab/CitedEvidenceNote'
import { resolveElementLabel } from '../../../domain/elementLabel'
import { InspectorMoreItems } from '../shared/InspectorMore'
import { FactorAnatomySummary } from './FactorAnatomy'
import { isAcceptedOlumiFigure } from '../../../domain/valueProvenance'
import anatomyStyles from './FactorAnatomy.module.css'
import { resolveValueInputSeed } from '../../../conversation/factorValueEdit'
import {
  useModelEditAuthority,
  type FactorValueProposalOutcome,
} from '../../../hooks/useModelEditAuthority'
import { ANALYSIS_NEW_COPY } from '../../../../components/results/analysisNew/analysisNewCopy'

/**
 * What the panel says after a value commit — the SAME three sentences every
 * other `proposeFactorValue` surface uses (`ModelStrip`'s value editor), read
 * from the register rather than re-typed. A `Record` over the authority's own
 * outcome union, so a fourth outcome fails the typecheck instead of silently
 * borrowing one of these.
 */
const VALUE_COMMIT_RECEIPT: Record<FactorValueProposalOutcome, string> = {
  dispatched: ANALYSIS_NEW_COPY.modelStrip.valueDispatched,
  local_only: ANALYSIS_NEW_COPY.modelStrip.valueLocalOnly,
  not_encodable: ANALYSIS_NEW_COPY.modelStrip.valueNotEncodable,
}

export const FactorObservablePanel = memo(function FactorObservablePanel({
  nodeId,
  techMode,
  summaryContext,
  onNavigate,
  /**
   * ⛔ A DUTY, NOT A PERMISSION (see `InspectorPanelProps`). The Router no
   * longer wraps this pane, so every control that reaches a mutation WITHOUT a
   * durable carrier sits behind this panel's own fence: the description and the
   * advanced editor. The headline value is left live because it now commits
   * through `factor_value_edit` — the same carrier `FactorControllablePanel`'s
   * value uses.
   */
  readOnly = false,
}: InspectorPanelProps) {
  const nodes = useSwitchFactorNodes()
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

  /**
   * ⭐⭐ THE SEED IS THE SCALE AUTHORITY'S, NOT THIS PANEL'S.
   *
   * `buildFactorValueEditEvent` decides whether the committed number is a
   * USER-UNIT magnitude or a MODEL-scale one by asking `resolveValueInputSeed`
   * which number the input was showing. So the input must show exactly that
   * number, or the builder would read a typed £60 as a 0-1 value (or a typed
   * 0.6 as pounds). `FactorControllablePanel` seeds from the same call for the
   * same reason. It is also the no-op baseline: committing the seed unchanged
   * sends nothing.
   */
  const { seed: valueInputSeed } = resolveValueInputSeed(node?.data)

  /**
   * ⭐⭐ THE VALUE COMMIT GOES THROUGH THE SHARED WRITER, NOT A SECOND ONE.
   *
   * This was `mutations.setObservedValue(parsed)` — a bare local store write
   * with no wire carrier, so the next server rehydrate discarded it (and the
   * Router's blanket fence made it unreachable anyway). It now calls
   * `useModelEditAuthority.proposeFactorValue`, the writer the factor card, the
   * Model tab and the Reasoning tab already share: `buildFactorValueEditEvent`
   * (the scale contract) → `captureOptimisticFactorEdit` (the undo) →
   * `setObservedValue` → `sendSystemEvent` → `factor_value_edit`. CEE resolves
   * the target by node id, so an observable factor needs nothing new.
   *
   * ⚠ THE OUTCOME IS NEVER FLATTENED TO "UPDATED". The authority answers
   * `dispatched | local_only | not_encodable`; each gets its own sentence, and
   * only a commit that wrote something arms the re-run prompt.
   */
  const authority = useModelEditAuthority(nodeId ?? null)
  const [valueCommitOutcome, setValueCommitOutcome] = useState<FactorValueProposalOutcome | null>(null)

  const handleValueSave = useCallback((parsed: number) => {
    const outcome = authority.proposeFactorValue(parsed)
    setValueCommitOutcome(outcome)
    if (outcome !== 'not_encodable') confirmEdit('value')
  }, [authority, confirmEdit])

  /**
   * ⛔ ONLY THE UNITLESS FALLBACK CHANGED, AND THE OTHER TWO BRANCHES ARE LEFT
   * ALONE DELIBERATELY.
   *
   * The fallback was a bare `${v}` — a raw IEEE-754 double straight onto
   * the panel's headline value. It is the same defect the founder read on the
   * edge panel (*"Olumi's current estimate is 0.5428571428571428"*), reached by
   * a different route: here it fires on exactly the factors that carry NO unit,
   * which is most of them (3 of 34 in the shipped starter corpus carry one).
   * It now takes `formatNumber`, the canonical module's four-decimal house
   * bound.
   *
   * ⚠ THE ['£','$','€'] PREFIX SET IS NOT A SCATTER TO CONSOLIDATE, AND IT IS
   * NOT TOUCHED. `labelUtils.ts:347-355` names this file explicitly and rules
   * it *"a narrower UX-intentional set for inline inspector-input prefix
   * treatment… a structural UX choice, not a tech-debt scatter — leave it"*;
   * `InspectorRouter.spec.tsx` asserts the paired behaviour that an ISO code
   * renders as a TRAILING SPAN rather than a fused prefix glyph. Routing these
   * two branches through `formatValueWithUnit` would move that grammar and
   * would additionally replace a 0-1 value with a qualitative WORD. Both
   * branches already bound their own output via `toLocaleString`, so neither
   * carries the raw-double defect this change exists to close.
   *
   * ⚠ READOUT ONLY. `InlineNumberEditor` seeds its buffer from the `value`
   * prop, never from this string — pinned by `InlineNumberEditor.precision.spec
   * .tsx`, which exists because seeding from a rounded readout once destroyed
   * producer precision on blur.
   */
  const formatValue = useCallback((v: number) => {
    if (unit === '\u00A3' || unit === '$' || unit === '\u20AC') return `${unit}${v.toLocaleString()}`
    if (unit) return `${v.toLocaleString()} ${unit}`
    // ⛔ The house bound alone erases a non-zero magnitude below 5e-5 (and a
    // negative one to `-0`, sign kept, quantity lost). Reasoning stated once at
    // `EdgePanel.tsx` `currentEstimatedWeightDisplay`; the large-value case is
    // why significant digits are NOT applied unconditionally, and it is pinned
    // as a control in `inspectorRawFloatDisplay.spec.tsx`.
    const housed = formatNumber(v)
    return Number(housed) === 0 && v !== 0 ? formatNumber(v, 2) : housed
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

  const sourceLabel = factorValueSourceLabel(node.data, attributedTo)
  const inputLabel = getInputGroupLabel(source, displayValue != null, isAcceptedOlumiFigure(node.data))

  return (
    <div>
      <FactorAnatomySummary
        label={resolveElementLabel(node.data)}
        displayText={canonicalDisplayText}
        hasStoredValue={value !== undefined || rawValue !== undefined}
        sourceLabel={sourceLabel}
        summaryContext={summaryContext}
      />
      {description.trim() && (
        <p className={`${typography.panelBody} text-text-body mt-2`}>{description}</p>
      )}

      <PanelGroup kind="input" label={inputLabel === GROUP_LABELS.input ? 'What you believe' : inputLabel}>
        <PrimaryControlCard>
          {/* Click-to-edit value — observation-first (shared InlineNumberEditor) */}
          <div data-testid="factor-value-row" className={anatomyStyles.valueRow}>
            <InlineNumberEditor
              readout={displayValue != null ? formatValue(displayValue) : null}
              placeholder="No value set. Click to enter."
              // The scale authority's seed, unrounded (P1-4): the number the
              // builder will assume the input showed, and the no-op baseline.
              value={valueInputSeed ?? null}
              onSave={handleValueSave}
              displayTestId="observable-value-display"
              inputTestId="observable-value-input"
              title="Click to enter a value"
            />
          </div>

          {/* Edit feedback — WHAT HAPPENED, never a bare "Updated". The old
              success tick fired on the local write alone, over an edit the
              server never heard about. */}
          {lastConfirmed?.field === 'value' && valueCommitOutcome !== null && valueCommitOutcome !== 'not_encodable' && (
            <div className="flex items-center gap-2 mt-1">
              <EditConfirmation
                trigger={lastConfirmed.ts}
                label={VALUE_COMMIT_RECEIPT[valueCommitOutcome]}
                tone="pending"
              />
            </div>
          )}
          {valueCommitOutcome === 'not_encodable' && (
            <p
              className={`${typography.panelMeta} text-text-light mt-1`}
              data-testid="observable-value-not-applied"
              role="status"
            >
              {VALUE_COMMIT_RECEIPT.not_encodable}
            </p>
          )}

          <InlineRerunPrompt elementId={nodeId} visible={isStaleAfterEdit} />

          {/* Beat 1 (Canvas lane, 4 Oct 2026): the inline provenance line that sat here said the SAME value's source a
              second time — "Generated from your brief" under the pill's "From your brief". The source pill above is the
              one statement (`factorValueSourceLabel`, the card's answer); every shown value already carries it. */}

          {/* What the owner cited when they applied it. Renders only when a
              citation resolved; never gated on `source`, because the citation is
              a fact about the apply and not about the extraction kind. */}
          <CitedEvidenceNote resolution={citedEvidence} />
        </PrimaryControlCard>
        <OlumiScaleLine label={String(node.data?.label ?? '')} observedState={obs} />

        {/* Coaching — within Your input group, below the card */}
        <InspectorCoaching
          elementId={nodeId}
          panelType="factor-observable"
          fallbackText={resolveCoaching('factorObservableData', { factorName: String(node.data?.label ?? '') })}
          labelContext={{ label: String(node.data?.label ?? '') }}
        />
      </PanelGroup>

      {isResultsMode && (displayMetadata.influence != null || displayMetadata.sensitivityRank != null) && (
        <StaleGuardBanner hasResults={isResultsMode}>
          <ImportanceBar
            importanceScore={displayMetadata.influence}
            sensitivityRank={displayMetadata.sensitivityRank}
            influenceProvenance={displayMetadata.influenceProvenance}
          />
        </StaleGuardBanner>
      )}

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
        <InspectorConnectPicker nodeId={nodeId} />
      </PanelGroup>

      <InspectorMoreItems>
        <PanelGroup kind="context">
          {canonicalDisplayText && (
            <div className={`${typography.panelMeta} text-text-light`} data-testid="factor-display-text">
              Stored as: {canonicalDisplayText}
            </div>
          )}
          <div className="mt-2 flex gap-1.5 flex-wrap">
            <span className={`${typography.panelMeta} inline-flex items-center px-2.5 py-0.5 rounded-full bg-transparent text-text-body border border-factor/30`}>
              You measure this
            </span>
            {Boolean(node.data?.factorType) && (
              <span className={`${typography.panelMeta} inline-flex items-center px-2.5 py-0.5 rounded-full bg-transparent text-text-body border border-factor/30`}>
                {String(node.data.factorType)}
              </span>
            )}
            {(canonicalDisplayText || displayValue != null) && (
              <span data-testid="observable-source-pill" className={`${typography.panelMeta} inline-flex items-center px-2.5 py-0.5 rounded-full bg-transparent text-text-body border border-success/30`}>
                {sourceLabel}
              </span>
            )}
          </div>
          {/* This writer stays behind the same fence after moving into More. */}
          <fieldset disabled={readOnly} className="contents" data-writer-fence="description">
            {description.trim() || isEditingDescription ? (
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
                className={`${typography.panelBody} ${controls.editableTextarea}`}
              />
            ) : !readOnly ? (
              <button type="button" className={`${typography.panelMeta} text-text-light hover:text-info`} onClick={() => setIsEditingDescription(true)}>
                Add a description
              </button>
            ) : null}
          </fieldset>
          {isResultsMode && displayMetadata.valueOfInformation !== null && voiTier !== null && (
            <div className="mt-2">
              <DataBar
                value={displayMetadata.valueOfInformation}
                label={INLINE_LABELS.investigationValue}
                colour="info"
                trailingLabel={INVESTIGATION_VALUE_LABEL[voiTier]}
              />
              <div className={`${typography.panelMeta} text-text-light mt-1`}>{INLINE_LABELS.investigationValue}</div>
              <p className={`${typography.panelMeta} text-text-light mt-1`}>{INVESTIGATION_VALUE_INVITATION.measurement}</p>
            </div>
          )}
          <FactorTurningPointInspectorLine nodeId={nodeId} />
        </PanelGroup>

      {/* ── Expert-only model detail ──────────────────────────── */}
      <TechnicalDisclosure visible={techMode}>
        {/* ⚠ EVERY SETTER IN THIS EDITOR IS A BARE `updateNode` — including
            `setObservedValue`, which writes the SAME slot as the headline value
            WITHOUT the `factor_value_edit` send. Fenced, as
            `FactorControllablePanel` fences its own advanced editor. */}
        <fieldset disabled={readOnly} className="contents" data-writer-fence="advanced-editor">
          <FactorObservableEditor nodeId={nodeId} />
        </fieldset>
      </TechnicalDisclosure>
      </InspectorMoreItems>
    </div>
  )
})
