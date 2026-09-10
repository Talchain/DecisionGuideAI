/**
 * FactorControllablePanel — Inspector for controllable factors (spec §7)
 * v6.2 Pattern B three-group layout: Context → Your input → Connections.
 * ImportanceBar + VoI fold into Context group (post-analysis), replacing
 * the separate Impact / Investigation value sections.
 */

import { memo, useState, useMemo, useCallback, useRef } from 'react'
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
import { unwrapInterventionValue } from '../../../utils/labelUtils'
import { getFactorOptionRows } from '../../../utils/factorOptionSetting'
import { factorDisplayText } from '../../../../utils/formatFactorDisplayValue'
import {
  GROUP_LABELS,
  getInputGroupLabel,
  DESCRIPTION_PLACEHOLDERS,
  EMPTY_STATES,
  getExtractionLabel,
  getProvenanceLabel,
  INLINE_LABELS,
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
import {
  investigationValueTier,
  INVESTIGATION_VALUE_LABEL,
  INVESTIGATION_VALUE_INVITATION,
} from '../../../domain/investigationValue'
import { resolveCoaching } from '../coachingConfig'
import { FactorControllableEditor } from '../editors/FactorControllableEditor'
import { resolveEdgeSignedStrengthDisplay } from '../../../domain/edgeValueProvenance'
import { useOptionalConversationContext } from '../../../conversation/ConversationContext'
import { SEND_BLOCKED } from '../../../conversation/useConversation'
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
import { useParticipantName } from '../../../../collab/useParticipantName'
import { useCitedEvidence } from '../../../../collab/citedEvidenceCache'
import { CitedEvidenceNote } from '../../../../collab/CitedEvidenceNote'
import { resolveElementLabel } from '../../../domain/elementLabel'

export const FactorControllablePanel = memo(function FactorControllablePanel({
  nodeId,
  techMode,
  onClose,
  onNavigate,
  /**
   * ⛔ A DUTY, NOT A PERMISSION (see `InspectorPanelProps`). The Router no
   * longer wraps this pane, so every control that reaches a mutation WITHOUT a
   * durable carrier must sit behind this panel's own fence. What the opt-in
   * buys is the ability to leave the rest alive: the value control that DOES
   * have a carrier, plus navigation, disclosure and coaching, all of which the
   * blanket wrap was disabling for a reason that was never about them.
   */
  readOnly = false,
}: InspectorPanelProps) {
  const nodes = useCanvasStore(s => s.nodes)
  const edges = useCanvasStore(s => s.edges)
  const ceeOptions = useCanvasStore(s => s.ceeAnalysisReady?.options)
  const resultsStatus = useCanvasStore(s => s.results?.status)
  const isResultsMode = resultsStatus === 'complete'

  const node = nodeId ? nodes.find(n => n.id === nodeId) : undefined
  const mutations = useNodeMutations(nodeId ?? '')
  const { confirm: confirmEdit, lastConfirmed, isStaleAfterEdit } = useEditConfirmation()
  /**
   * ⭐⭐ WHAT ACTUALLY HAPPENED TO THE LAST VALUE COMMIT — because `dispatched`
   * IS NOT `saved`, and the panel used to say otherwise.
   *
   * `useEditConfirmation` records that a LOCAL STORE WRITE happened. On its own
   * that rendered "Updated ✓" in success green the instant the field blurred,
   * whether the turn had been issued, deferred behind the dispatcher's
   * in-flight lock, or never attempted at all because no conversation provider
   * was mounted. Three outcomes, one green tick.
   *
   * ⚠ `local_only` IS THE ONE THAT MATTERED. There the write reaches the store
   * and nothing else — the next server rehydrate silently discards it — and the
   * old copy called that "Updated". This is the exact shape of the July defect
   * (#513) that made these edits real turns in the first place: a confident
   * receipt over a change the server never heard about.
   */
  /**
   * ⚠⚠ THREE STATES, NOT TWO — MEASURED ON THE DEPLOYED BUILD AND THE TWO-STATE
   * VERSION WAS WRONG IN THE OTHER DIRECTION.
   *
   * The first version set `local_only` provisionally and upgraded to `sent`
   * when the dispatcher resolved. Driving staging as a guest, the turn takes
   * ~1.8s (measured: 1756ms / 1801ms / 2019ms) — so for nearly two seconds the
   * panel told the user **"Not sent to Olumi"** about an edit that was in
   * flight and about to land. It then flipped to "Sent" and faded.
   *
   * The brief was "show save failures without claiming success". A pessimistic
   * provisional obeys the letter and breaks the spirit: it claims FAILURE
   * without knowing, which is the same defect mirrored — and it is the more
   * alarming half, because the user is told their work was lost while it is
   * being saved.
   *
   * `sending` is the honest state while the promise is open. It is not a
   * success claim: no tick, no success tone.
   */
  const [valueCommitOutcome, setValueCommitOutcome] = useState<'sending' | 'sent' | 'local_only' | null>(null)
  /**
   * Which commit the notice belongs to. The wire attempt is fire-and-forget,
   * so its outcome can land after a later commit — or after the person has
   * moved to another factor. Both make the resolution stale, and a stale
   * resolution writing "Sent to Olumi" over a different edit is the same
   * class of untrue receipt this state exists to prevent.
   */
  const valueCommitSeqRef = useRef(0)
  /** Always the factor on screen, so a late resolution can tell it moved. */
  const shownNodeIdRef = useRef(nodeId)
  shownNodeIdRef.current = nodeId
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
  /**
   * D1 — resolve a `panel_elicited` value's AUTHOR to a name, at render.
   *
   * Called unconditionally and before this component's `!nodeId || !node` early
   * return, because it is a hook. For every non-panel value it is a no-op: no
   * `elicited_from` means `no_attribution`, which fetches nothing and leaves
   * both labels below byte-identical to what they rendered before.
   */
  const attributedTo = useParticipantName(obs?.elicited_from as unknown)
  /**
   * The CITATION the owner recorded when they applied this value. A no-op for
   * every value carrying no citation: `no_citation` fetches nothing and renders
   * nothing, leaving this panel byte-identical to what it rendered before.
   */
  const citedEvidence = useCitedEvidence(obs?.elicited_from as unknown)
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
      // ⚠ Provisional = `local_only` ONLY where there is no dispatcher at all,
      // because then nothing further will resolve and the edit really is local.
      // Where a dispatcher exists the state below moves to `sending` and waits.
      setValueCommitOutcome('local_only')

      // Then the wire. Before this, the chain ENDED at the store write: the edit
      // never reached CEE, its graph_hash never moved, and the rerun the
      // freshness strip invited could not possibly reflect the change.
      if (!sendSystemEvent) return

      // ⚠ THE PRESENCE OF THE FUNCTION IS NOT A DISPATCH, AND AN EARLIER VERSION
      // OF THIS COMMITTED 'sent' RIGHT HERE — i.e. because the provider existed.
      // `sendSystemEvent` returns `SEND_BLOCKED` as a RESOLVED value on two
      // paths that never reach the wire (`useConversation.ts:5935` when the
      // orchestrator is off, `:5945` when the event type is not serialisable),
      // and the `.catch` below cannot see either. So the outcome is read off
      // what the dispatcher actually returns, and only a genuine dispatch or a
      // deferral — which the deferral buffer WILL flush — is allowed to say
      // "Sent to Olumi".
      const commitSeq = ++valueCommitSeqRef.current
      const commitNodeId = nodeId
      setValueCommitOutcome('sending')
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
      ).then(outcome => {
        // A later commit, or a move to another factor, owns the notice now.
        if (commitSeq !== valueCommitSeqRef.current || commitNodeId !== shownNodeIdRef.current) return
        setValueCommitOutcome(outcome === SEND_BLOCKED ? 'local_only' : 'sent')
      }).catch(() => {
        // A genuine send failure leaves the edit local. Saying so is the whole
        // point of this state — the store write did happen, the wire one did not.
        if (commitSeq === valueCommitSeqRef.current && commitNodeId === shownNodeIdRef.current) {
          setValueCommitOutcome('local_only')
        }
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

  // Full counterpart of the factor preview, including options without a setting.
  const setByOptions = useMemo(
    () => getFactorOptionRows(nodeId ?? '', nodes, ceeOptions, obs),
    [nodeId, nodes, ceeOptions, obs],
  )

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
        {/* `mutations.setDescription` writes to the local store ONLY — there is
            no `description` carrier, so the next server rehydrate overwrites it.
            Fenced HERE rather than at the Router so the value control beside it,
            which DOES have one, can stay live.

            ⚠ THE FENCE WRAPS BOTH BRANCHES, INCLUDING THE EMPTY PROMPT. That
            prompt performs no write itself — it opens the editor — so a fence
            scoped to the textarea alone would still pass a self-fencing audit
            while leaving a button whose whole purpose is to invite text that
            cannot be saved. Inviting the input is the harm; the write is only
            where it lands. */}
        <fieldset disabled={readOnly} className="contents" data-writer-fence="description">
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
        </fieldset>

        {/* Provenance pills: factor type identity + extraction source */}
        <div className="mt-2 flex gap-1.5 flex-wrap">
          {node.data?.factorType && (
            <span className={`${typography.panelMeta} inline-flex items-center px-2.5 py-0.5 rounded-full bg-transparent text-text-body border border-factor/30`}>
              {String(node.data.factorType)}
            </span>
          )}
          <span className={`${typography.panelMeta} inline-flex items-center px-2.5 py-0.5 rounded-full bg-transparent text-text-body border border-success/30`}>
            {getExtractionLabel(source, attributedTo)}
          </span>
        </div>

        {/* Post-analysis: ImportanceBar + VoI folded in (no separate bordered card) */}
        {isResultsMode && (displayMetadata.influence != null || displayMetadata.sensitivityRank != null) && (
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

                SAFE BY DERIVATION, not by inspection: `sensitivityGuidance` is
                non-null only when `isResultsMode && sensitivityRank != null`, and the
                container renders on `isResultsMode && (influence != null ||
                sensitivityRank != null)`. The first implies the second, so nothing
                can be lost by moving it inside. ⚠ THAT PROOF IS PANEL-SPECIFIC and
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
              {/* ⚠ BOTH CONJUNCTS, AND THE FIRST ONE IS NOT REDUNDANT. `voiTier`
                  is derived from this value, so a human reads the second as
                  implying the first — but TypeScript does not narrow through a
                  derived local, and `DataBar` takes `number`, not `number | null`.
                  Dropping either one is a type error, which is the compiler
                  making the same point. */}
              {displayMetadata.valueOfInformation !== null && voiTier !== null && (
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
                    {INVESTIGATION_VALUE_INVITATION.evidence}
                  </p>
                </div>
              )}
            </div>
          </StaleGuardBanner>
        )}

      </PanelGroup>

      {/* ── Your input group ──────────────────────────────────── */}
      {/* The header is a CLAIM about who supplied this number, not a static
          caption. "Your input" over an Olumi estimate is false attribution —
          see getInputGroupLabel (inspectorStrings.ts) for both directions. */}
      <PanelGroup kind="input" label={getInputGroupLabel(source, (rawValue ?? value) != null)}>
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
              <span className={`${typography.panelMeta} text-info`}>{getProvenanceLabel(source, attributedTo)}</span>
            </div>
          )}

          {/* What the owner cited when they applied it. Renders only when a
              citation resolved; never gated on `source`, because the citation is
              a fact about the apply and not about the extraction kind. */}
          <CitedEvidenceNote resolution={citedEvidence} />
          {uncertaintyDrivers && uncertaintyDrivers.length > 0 && (
            <div className="flex gap-1.5 flex-wrap mt-1.5">
              {uncertaintyDrivers.map((d, i) => (
                <span
                  key={i}
                  className={`${typography.panelMeta} inline-flex items-center px-2.5 py-0.5 rounded-full bg-transparent text-text-body`}
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
            {/* ⚠ NEITHER BRANCH CLAIMS "SAVED", AND THAT IS DELIBERATE. The
                value has a durable carrier, so `sent` is a true and useful
                thing to say — but this panel cannot observe the server
                APPLYING it, and a receipt derived from our own optimistic
                write would be an optimistic write wearing a confirmation.
                Settling `sent` against the canonical applied value is real
                work and is rowed separately; overstating it here in the
                meantime is exactly the defect being removed. */}
            {/* ⚠ "Saved on this device only" until `guestStorageClaims.spec.ts`
                refused the same claim one file over. It is FALSE — a guest's
                graph also exists server-side — and it evaded that guard only
                because its regex is verb-specific ("stays on", not "saved on").
                Reported to the guard's owner rather than left as a near-miss.
                The label now states what this app did, which is the part we
                can actually vouch for. */}
            {valueCommitOutcome === 'sending' ? (
              <EditConfirmation trigger={lastConfirmed.ts} label="Sending to Olumi…" tone="pending" hold />
            ) : valueCommitOutcome === 'local_only' ? (
              <EditConfirmation trigger={lastConfirmed.ts} label="Not sent to Olumi" tone="pending" />
            ) : (
              <EditConfirmation trigger={lastConfirmed.ts} label="Sent to Olumi" tone="pending" />
            )}
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
            <div className={`${typography.panelMeta} text-text-light mb-1`}>Option values:</div>
            {setByOptions.map(o => {
              const badgeContent = o.displayValue
              return (
                <ConnectionRow
                  key={o.id}
                  nodeKind="option"
                  label={o.label}
                  badge={badgeContent != null ? (
                    <span className={`${typography.panelMeta} inline-flex items-center px-2 py-0.5 rounded-full bg-transparent text-text-body border border-option/30`}>
                      {badgeContent}
                    </span>
                  ) : undefined}
                  fullLabel
                  techMode={techMode}
                  onClick={() => onNavigate(o.id)}
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
          <p className={`${typography.panelMeta} text-text-light`}>{EMPTY_STATES.noConnectionsFlat}</p>
        )}
      </PanelGroup>

      {/* ── Expert-only model detail ──────────────────────────── */}
      {/* ⚠⚠ WRITERS 2–15 OF 15, AND THE FOURTEEN A FILE-SCOPED SWEEP MISSES.
          `FactorControllableEditor` holds 14 `mutations.set*` call sites, every
          one a bare `updateNode` with NO wire carrier — including
          `setObservedValue`, which writes the SAME field as the headline value
          control without the `factor_value_edit` send and clears
          `display_value` on the way. None of them is spelled in this file, and
          a review caught them after I enumerated only the controls written
          here. Audit the tree, not the file — the identical omission was
          caught on the sibling pane and is recorded at `OptionPanel.tsx:71`. */}
      <TechnicalDisclosure visible={techMode}>
        <fieldset disabled={readOnly} className="contents" data-writer-fence="advanced-editor">
          <FactorControllableEditor nodeId={nodeId} />
        </fieldset>
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
