/**
 * FactorControllablePanel — Inspector for controllable factors (spec §7)
 * v6.2 Pattern B three-group layout: Context → Your input → Connections.
 * ImportanceBar + VoI fold into Context group (post-analysis), replacing
 * the separate Impact / Investigation value sections.
 */

import { memo, useState, useMemo, useCallback } from 'react'
import { Link, MessageSquare } from 'lucide-react'
import Tooltip from '../../../../components/Tooltip'
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
import { useOptionalConversationContext } from '../../../conversation/ConversationContext'
import {
  acceptsElicitedBelief,
  buildFactorValueEditEvent,
  resolveValueInputSeed,
  type ValueInputSeedBasis,
} from '../../../conversation/factorValueEdit'
import { captureOptimisticFactorEdit } from '../../../conversation/optimisticFactorEdit'
import { useBeliefElicitation } from '../../../hooks/useBeliefElicitation'
import {
  BeliefElicitationField,
  describeInWordsToggleLabel,
} from '../../../components/BeliefElicitationField'

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

  // Local draft for editable value input.
  //
  // The seed (and, critically, WHICH SCALE it is in) comes from
  // resolveValueInputSeed — the single definition shared with the wire emitter.
  // It used to be an inline `rawValue ?? value` here, with the commit guard
  // below comparing the typed number against `value` alone. That mismatch was
  // load-bearing: on a capped factor the input shows the USER-UNIT magnitude
  // (30000) while `value` holds the MODEL-scale number (1), so
  // `parsed !== value` was true for every commit AND for every re-commit of an
  // unchanged number. Comparing against the seed the input actually displayed
  // is what makes "commit the same value → nothing happens" true.
  const { seed: inputDisplayValue } = resolveValueInputSeed(node?.data)
  const [draftValue, setDraftValue] = useState<string>(inputDisplayValue != null ? String(inputDisplayValue) : '')

  // ROADMAP 1.346 — the inspector value-commit is a REAL TURN.
  //
  // Optional by design: the inspector renders in surfaces that are not inside
  // the ConversationProvider (and in unit tests), and a missing provider must
  // degrade to "local edit only", never throw. Same pattern as WhatChangedChip.
  const sendSystemEvent = useOptionalConversationContext()?.sendSystemEvent

  // ── "say it in words" (ROADMAP 2.391) ────────────────────────────────────
  //
  // The elicitation affordance was pre-analysis-ONLY until this panel got it:
  // its only host, `pre-analysis-v3`'s CalibrateDrillIn, unmounts on "Analyse
  // first pass" (measured on deployed `1730c6c5` and again on `33594598`). This
  // panel is where a user IS when they want to revise a belief — after they
  // have seen a result — so the loop "elicit → Use this → analysis goes stale"
  // is only reachable at all from here.
  const [inWords, setInWords] = useState(false)
  const [phrase, setPhrase] = useState('')
  const elicitation = useBeliefElicitation({
    nodeId: nodeId ?? '',
    nodeLabel: String(node?.data?.label ?? ''),
  })

  /**
   * May this factor be asked about in words? The SAME predicate the pre-analysis
   * surface uses, read the SAME way: reactively, from the store, returning a
   * BOOLEAN (a fresh object per render is what the zustand-selector guard
   * exists to stop). Capless AND unitless only — see `acceptsElicitedBelief`
   * for why, and for what widening it would actually take.
   */
  const canDescribeInWords = useCanvasStore(s =>
    acceptsElicitedBelief(s.nodes.find(n => n.id === nodeId)?.data),
  )

  /**
   * ONE commit path for both affordances on this panel.
   *
   * Extracted from `handleValueBlur` verbatim rather than copied beside it: two
   * handlers building the same event from the same node would be the mirror
   * that lets an optimistic write and a wire event drift apart on one edit.
   * `seedBasis` is NOT a second scale rule — it tells the single scale authority
   * WHICH number the committing control was displaying, the one thing that
   * authority cannot derive for itself.
   */
  const commitValue = useCallback(
    (
      typedValue: number,
      opts: {
        seedBasis?: ValueInputSeedBasis
        /**
         * Write `typedValue` as the LOCAL display anchor too. Only the elicited
         * path passes it, and only because the affordance is gated to factors
         * with no unit and no cap — the shape where CEE itself persists
         * `raw_value = value`. So this MIRRORS what the server will hold; it
         * does not derive it. Without it, `setObservedValue` clears both
         * `display_value` copies and leaves no anchor, and the row shows NO
         * NUMBER where one used to be (#572 review, A2).
         */
        writeRawAnchor?: boolean
      } = {},
    ): void => {
      // ONE derivation feeds BOTH the local store write and the wire, so the two
      // cannot disagree about the same edit. Building it first (rather than
      // writing locally and re-deriving for the send) is what makes that
      // structural instead of a convention someone has to remember.
      const event = buildFactorValueEditEvent({
        // `nodeId` is optional on InspectorPanelProps (the router renders the
        // panel before a selection resolves). An empty id is unencodable and the
        // builder returns null for it — fail closed rather than emit a mutation
        // with no target.
        nodeId: nodeId ?? '',
        typedValue,
        // Read the node as it was BEFORE the local write: the factor's own scale
        // metadata (cap/unit) is what decides the scale of what the user typed.
        nodeData: node?.data,
        ...(opts.seedBasis ? { seedBasis: opts.seedBasis } : {}),
      })
      // Fail CLOSED. This is also where the STRUCTURAL belt lands for the
      // elicited path: `buildFactorValueEditEvent` refuses a `model_scale`
      // commit outside [0,1] or on a magnitude-scaled factor, for every caller,
      // and a null event means no local write, no wire, no receipt.
      if (!event) return
      const { value: modelValue, raw_value: rawMagnitude } = event.payload as {
        value: number
        raw_value?: number
      }

      // ROADMAP 2.129 (b) — the undo for the optimistic write, captured from the
      // pre-write node data. The defect was live-proven on the Model tab, but this
      // is the same fire-and-forget shape against the same endpoint: a refusal
      // leaves the panel showing a number the engine declined. Fixing one twin and
      // leaving the other armed is how this class keeps coming back.
      const undo = captureOptimisticFactorEdit(nodeId ?? '', modelValue, node?.data)

      // Local store write first, so the canvas and the freshness overlay reflect
      // the edit immediately even if the turn is slow or fails. Note this writes
      // the MODEL-scale number into `value` — the live defect wrote the display
      // magnitude (300000) there, which is exactly what CEE's validator refuses.
      mutations.setObservedValue(modelValue, opts.writeRawAnchor ? typedValue : rawMagnitude)
      confirmEdit('value')

      // Then the wire. Before this, the chain ENDED at the store write: the edit
      // never reached CEE, its graph_hash never moved, and the rerun the
      // freshness strip invited could not possibly reflect the change.
      if (!sendSystemEvent) return
    // Fire-and-forget: the response is ingested by the shared turn path
    // (applyV5State applies graph_patch + analysis_ready for system-event turns
    // exactly as it does for message turns). Awaiting here would block the blur
    // handler on a network round-trip.
    //
    // ⚠ The catch below is NOT the safety net it looks like, and an earlier
    // version of this comment wrongly implied it was. It only catches GENUINE
    // failures — network rejects, 4xx/5xx, parse errors — which reject as
    // `SystemEventSendError`. It does NOT catch a send blocked by the
    // dispatcher's in-flight lock: that path resolves. An edit committed during
    // a running analysis therefore never reaches this catch, and used to be
    // dropped outright. What actually protects it is the dispatcher's deferral
    // buffer, which queues the send and flushes it when the lock clears (and
    // holds the freshness overlay dirty until it does). See
    // `useConversation`'s `deferredSystemSendsRef`.
      void Promise.resolve(
        sendSystemEvent(event, undo ? { optimisticFactorEdit: undo } : undefined),
      ).catch(() => {
        // Swallowed deliberately: a genuine send failure is already recorded by
        // the conversation's own failure channel. Re-throwing from a blur handler
        // would surface as an unhandled rejection and tell the user nothing they
        // are not already being told. A server REFUSAL is not a failure and never
        // reaches here — the dispatcher reverts the optimistic write instead.
      })
    },
    [mutations, confirmEdit, sendSystemEvent, nodeId, node?.data],
  )

  const handleValueBlur = useCallback(() => {
    const parsed = parseFloat(draftValue)
    // Commit ONCE per genuinely-changed value. `inputDisplayValue` is the
    // number the field was showing, so a re-blur after a commit — and a commit
    // of an unchanged number — are both no-ops here. That is the mechanism
    // behind the negative control (a same-value edit must not claim a change);
    // CEE's noop dedup is the backstop, not the mechanism.
    if (isNaN(parsed) || parsed === inputDisplayValue) return
    commitValue(parsed)
  }, [draftValue, inputDisplayValue, commitValue])

  /**
   * Accept an elicited number — the SAME commit and the SAME wire event as the
   * typed field, differing only in which SCALE the committed number is in.
   *
   * NO SHAPE RE-CHECK HERE, deliberately, and this is a decision rather than an
   * omission: `canDescribeInWords` is a REACTIVE store selector, so the moment a
   * factor stops being a chance the whole affordance unmounts and there is no
   * button left to click (pinned by the reactive-gate test). An accept-time copy
   * of the predicate would be unreachable — and an unreachable guard that no
   * mutant can kill is guarantee theatre. The STRUCTURAL refusal lives one layer
   * down in `buildFactorValueEditEvent`, where it covers every caller.
   *
   * The draft sync at the end is NOT cosmetic. The number input was seeded at
   * mount from the PREVIOUS value and does not re-seed; without this line the
   * user's next blur on that field would commit the old number straight back
   * over the value they just accepted.
   */
  const acceptElicited = useCallback(
    (suggestedValue: number): void => {
      commitValue(suggestedValue, { seedBasis: 'model_scale', writeRawAnchor: true })
      elicitation.reset()
      setInWords(false)
      setPhrase('')
      setDraftValue(String(suggestedValue))
    },
    [commitValue, elicitation],
  )

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
            {/*
              ON THE VALUE ROW, beside the number rather than replacing it: the
              two are alternatives, and hiding the direct input behind a mode
              toggle would make the fast path slower for anyone who already
              knows their number. HIDDEN, never disabled, when the factor is not
              a chance \u2014 a disabled control with no explanation is a mystery.
            */}
            {canDescribeInWords && (
              <Tooltip content="Say what you think in plain words" delay={300}>
                <button
                  type="button"
                  aria-label={describeInWordsToggleLabel(String(node.data?.label ?? ''))}
                  aria-pressed={inWords}
                  onClick={() => {
                    setInWords(open => {
                      if (open) {
                        setPhrase('')
                        elicitation.reset()
                      }
                      return !open
                    })
                  }}
                  className="inline-flex h-7 w-7 flex-none items-center justify-center rounded-full outline-none transition-colors text-text-light hover:text-text-header hover:bg-panel-hover focus-visible:text-text-header focus-visible:bg-panel-hover focus-visible:ring-2 focus-visible:ring-info/40"
                >
                  <MessageSquare className="h-3.5 w-3.5" aria-hidden />
                </button>
              </Tooltip>
            )}
          </div>

          {inWords && canDescribeInWords && (
            <div className="mt-2">
              <BeliefElicitationField
                testId="inspector-in-words"
                label={String(node.data?.label ?? '')}
                phrase={phrase}
                onPhraseChange={next => {
                  setPhrase(next)
                  elicitation.request(next)
                }}
                onEscape={() => {
                  setInWords(false)
                  setPhrase('')
                  elicitation.reset()
                }}
                elicitation={elicitation}
                onAccept={acceptElicited}
              />
            </div>
          )}
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
