/**
 * ConversationPanel — Multi-turn conversation surface (v2 three-zone layout)
 *
 * Renders inside DraftChat's expanded panel when VITE_ENABLE_ORCHESTRATOR_V2
 * is ON. Renders a minimal header (collapse control) + ChatThread (Zone 2),
 * and ChatComposer (Zone 3).
 *
 * This component retains all patch handler callbacks and guidance store wiring.
 */

import { useRef, useState, useEffect, useCallback, useMemo, memo } from 'react'
import { useCanvasStore, selectResultsStatus } from '../store'
import { useGuidanceStore } from '../stores/guidanceStore'
import type { ActionChip, GraphPatchBlock } from './types'
import type { UseConversationReturn } from './useConversation'
import { applyAutoApplyPatch, applyValidatedGraph } from './utils/applyPatch'
import { buildAnalysisReadyPatch, applyAnalysisReadyPatch } from './utils/mirrorAnalysisReady'
import { extractTargetIdsFromPatch } from './utils/extractTargetIds'
import { plot } from '../../adapters/plot'
import { logger } from '../../lib/logger'
import { ChevronsRight } from 'lucide-react'
import { ChatThread } from './zones/ChatThread'
import { ChatComposer, type ChatComposerHandle } from './zones/ChatComposer'
import { useOptionalConversationContext } from './ConversationContext'
import { prefillInto } from './prefillTarget'
import type { BriefReadiness } from './hooks/useBriefSignals'
import { useThreadPersistence } from './hooks/useThreadPersistence'
import { beginInteractionChain, getUiSurfaceState, recordCrossSurfaceEvent, recordInteractionEvent, recordUserAction, type InteractionStateSnapshot } from '../../lib/debug-state'
import { canRunAnalysis as canRunAnalysisUtil, getRunButtonTooltip, computeCeeCannotSeeModel } from '../utils/canRunAnalysis'
import { useV2Run } from '../hooks/useV2Run'
import { useGraphReadiness } from '../hooks/useGraphReadiness'
import { isV5CanonicalRunPath } from '../../v5/eligibility'

interface ConversationPanelProps {
  conversation: UseConversationReturn
  onCollapse: () => void
  onAttach: () => void
  /**
   * When true, ChatComposer is not rendered. AI panel v2 (FF_AI_PANEL_V2)
   * uses this to swap in the compact AIInputBar from
   * `src/canvas/components/AIInputBar.tsx` while keeping the rest of
   * ConversationPanel (ChatThread + the patch/chip/feedback handler
   * matrix + guidanceStore registration) intact. Default false.
   */
  hideComposer?: boolean
  /**
   * When provided, overrides the default `_prefillChat` registration so
   * that external flows (inspector "Ask about this", analysis hero
   * prefill actions) populate the v2 AIInputBar instead of the
   * non-existent ChatComposer ref. Required-in-spirit when `hideComposer`
   * is true; without it, prefill silently no-ops.
   */
  prefillChat?: (text: string) => void
  /**
   * When true, ChatThread renders message body at panelBody (12px /
   * leading 1.5) instead of body (16px / leading 1.65) — DS v5
   * requirement for the AI panel v2 surface. Default false to preserve
   * legacy DraftChat rendering under FF off.
   */
  compact?: boolean
  /**
   * Externally-provided ref the panel mirrors the ChatThread scroll
   * container into so AI panel v2 can capture/restore scrollTop across
   * mode transitions. Optional — when omitted, the thread's own
   * smart-scroll runs unchanged.
   */
  scrollListRef?: React.MutableRefObject<HTMLDivElement | null>
}

function createPanelInteractionSnapshot(messagesCount: number): InteractionStateSnapshot {
  const store = useCanvasStore.getState()
  const ui = getUiSurfaceState('conversation')
  return {
    scenarioId: store.currentScenarioId ?? null,
    stagePill: store.currentStage ?? null,
    hasGraph: store.nodes.length > 0 || store.edges.length > 0,
    hasAnalysis: store.results.status === 'complete' && Boolean(store.results.hash ?? store.currentScenarioLastResultHash),
    hasAnalysisReady: Boolean(store.ceeAnalysisReady),
    firstDraftControlsVisible: ui?.firstDraftControlsVisible ?? false,
    staleFirstDraftGuidanceVisible: ui?.staleFirstDraftGuidanceVisible ?? false,
    aiPanelOpen: ui?.aiPanelOpen ?? true,
    composerHasText: ui?.composerHasText ?? false,
    composerTextLength: ui?.composerTextLength ?? 0,
    guidanceItemsVisible: ui?.guidanceItemsVisible ?? useGuidanceStore.getState().guidanceItems.length,
    chatMessagesCount: messagesCount,
  }
}

function extractTurnIdFromStateKey(stateKey: string, patchId: string): string {
  const suffix = `:${patchId}`
  if (stateKey.endsWith(suffix)) {
    return stateKey.slice(0, -suffix.length)
  }
  const separatorIndex = stateKey.indexOf(':')
  if (separatorIndex === -1) return stateKey
  return stateKey.slice(0, separatorIndex)
}

export const ConversationPanel = memo(function ConversationPanel({
  conversation,
  onCollapse,
  onAttach,
  hideComposer = false,
  prefillChat: prefillChatOverride,
  compact = false,
  scrollListRef,
}: ConversationPanelProps) {
  const {
    messages, isThinking, longRunningHint,
    sendMessage, sendSystemEvent, sendChip, dispatchAction, retryLast,
    patchBlockStates, setPatchBlockState,
    patchRejections, setPatchRejection,
  } = conversation

  const nodeCount = useCanvasStore((s) => s.nodes.length)
  const scenarioId = useCanvasStore((s) => s.currentScenarioId)
  const composerRef = useRef<ChatComposerHandle>(null)
  // Under `hideComposer` (AI panel v2) the legacy composerRef is never mounted —
  // the visible composer is AIInputBar, bound to ConversationContext `draft`. We
  // fall back to writing that draft so prefill actually populates the textarea.
  // setDraft is the stable useState setter, so it's safe in the register effect's deps.
  const setDraft = useOptionalConversationContext()?.setDraft
  const pendingBriefRef = useRef<string | null>(null)
  const generateInFlightRef = useRef(false)
  const wasThinkingRef = useRef(false)
  const { runV2Analysis, isRunning: isV2RunInFlight } = useV2Run()
  const { readiness } = useGraphReadiness()

  // Track 2: Thread persistence (best-effort, flag-gated)
  const { onBlockAction, onChipTaken } = useThreadPersistence(scenarioId, messages)

  // ── Chip handler ──────────────────────────────────────────────────────
  const handleChipClick = useCallback(
    async (chip: ActionChip): Promise<void> => {
      if (chip.id === 'retry') { retryLast(); return }
      await sendChip(chip)

      // Track 2: mark suggested action as taken
      let lastAssistant: typeof messages[number] | undefined
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === 'assistant') { lastAssistant = messages[i]; break }
      }
      if (lastAssistant) {
        onChipTaken(lastAssistant.id, chip.id)
      }
    },
    [sendChip, retryLast, messages, onChipTaken],
  )

  // ── Artefact action handler ─────────────────────────────────────────
  const handleArtefactMessage = useCallback(
    (text: string) => {
      void sendMessage(text, { debugSource: 'artefact_action' })
    },
    [sendMessage],
  )

  // ── Proposal confirm handler ──────────────────────────────────────
  const handleProposalConfirm = useCallback(
    (proposalId: string) => {
      void sendMessage(`confirm:${proposalId}`, {
        debugSource: 'proposal_confirm',
        debugVisibleText: 'Apply proposed changes',
      })
    },
    [sendMessage],
  )

  // Best-effort system-event dispatch: for background acks (patch_dismissed,
  // and — via useGraphEditEvents — direct_graph_edit) whose failure has no
  // user-facing surface. sendSystemEvent now REJECTS on a failed POST
  // (SystemEventSendError), so we must consume the rejection here to avoid an
  // unhandled promise rejection. Mirrors the existing best-effort `.catch()`
  // pattern for background events; not a silent drop for the failures that DO
  // own a surface (feedback → FeedbackRow revert, patch accept → NETWORK_ERROR).
  const sendSystemEventBestEffort = useCallback(
    (event: Parameters<typeof sendSystemEvent>[0]) => {
      // Promise.resolve() coerces the return so a non-thenable stub can't throw.
      void Promise.resolve(sendSystemEvent(event)).catch((err) => {
        if (import.meta.env.DEV) {
          console.warn('[ConversationPanel] Best-effort system event failed:', event.type, err)
        }
      })
    },
    [sendSystemEvent],
  )

  // ── Patch handlers (unchanged from previous version) ──────────────────
  const handlePatchAccept = useCallback(
    async (stateKey: string, block: GraphPatchBlock) => {
      // Notify CEE that the user accepted — AFTER the patch has been applied
      // optimistically. sendSystemEvent now rejects on a failed POST, so surface
      // that via the EXISTING NETWORK_ERROR retry affordance (block returns to
      // 'proposed' so the "Try again" control renders) rather than dropping the
      // failure silently. No new UI surface — same card as the validate-path
      // catch below. The applied graph stays applied; retry re-confirms.
      const notifyPatchAccepted = (payload: Record<string, unknown>) => {
        void Promise.resolve(sendSystemEvent({ type: 'patch_accepted', payload })).catch(() => {
          setPatchBlockState(stateKey, 'proposed')
          setPatchRejection(stateKey, {
            code: 'NETWORK_ERROR',
            message: 'Failed to apply — try again',
          })
        })
      }
      const chainId = beginInteractionChain({
        triggerSurface: 'proposal_accept',
        sourceSurface: 'ai_panel',
        initiatedBy: 'user',
        visibleTextSubmitted: block.summary ?? null,
        submittedText: block.summary ?? null,
        stateBefore: createPanelInteractionSnapshot(messages.length),
        setPending: true,
      })
      // Mirror CEE analysis_ready → canvas store + option-node data cache.
      // Uses shared utility (mirrorAnalysisReady.ts) so manual-accept and
      // auto-apply paths produce identical store mutations. See
      // docs/open-issues-root-cause-investigation-2026-04-09.md.
      const mirrorAnalysisReadyAfterAccept = () => {
        const patch = buildAnalysisReadyPatch(block)
        if (!patch) return
        applyAnalysisReadyPatch(patch, {
          patchId: block.patch_id,
          scenarioId: useCanvasStore.getState().currentScenarioId,
        })
      }

      try {
        const state = useCanvasStore.getState()
        const currentHash = state.currentScenarioLastResultHash
        if (block.target_graph_hash && currentHash && currentHash !== block.target_graph_hash) {
          if (import.meta.env.DEV) {
            console.warn('[ConversationPanel] Graph hash mismatch — patch may be stale')
          }
        }

        const KNOWN_OPS = new Set([
          'add_node', 'remove_node', 'update_node',
          'add_edge', 'remove_edge', 'update_edge',
        ])
        const unknownOps = block.operations.filter((op) => !KNOWN_OPS.has(op.op))
        if (unknownOps.length > 0) {
          setPatchBlockState(stateKey, 'rejected')
          setPatchRejection(stateKey, {
            code: 'UNSUPPORTED_OPERATION',
            message: `Unsupported operation: ${unknownOps[0].op}`,
          })
          sendSystemEventBestEffort({
            type: 'patch_dismissed',
            payload: { patch_id: block.patch_id, reason: 'unsupported_operation' },
          })
          return
        }

        const adapter = plot as any
        if (adapter.validatePatch && typeof adapter.validatePatch === 'function') {
          const result = await adapter.validatePatch({
            graph: { nodes: state.nodes, edges: state.edges },
            operations: block.operations,
          })

          if (result.valid) {
            const validatedGraph = result.graph ?? result.validated_graph
            useCanvasStore.getState().beginExternalGraphMutation('patch_apply')
            try {
              if (validatedGraph?.nodes && validatedGraph?.edges) {
                // Runs warning-only schema validation at the mutation boundary.
                applyValidatedGraph({ nodes: validatedGraph.nodes, edges: validatedGraph.edges }, block.operations)
              } else {
                if (import.meta.env.DEV) {
                  console.warn('[olumi] op-replay fallback: PLoT did not return full graph, applying operations individually')
                }
                // applyAutoApplyPatch calls `useCanvasStore.setState` directly
                // without going through `pushHistory`, so we push history here
                // to match the validatedGraph branch above and the auto-apply
                // path in useConversation.ts:1926. This is load-bearing for
                // the 2026-04-09 staleness guard: `pushToHistory` is the one
                // place that flips `graphEditedSinceLastRun: true` and
                // `analysisStateReady: false`. Without this call, the fallback
                // path would silently mutate the graph and the next turn
                // would ship stale analysis_state referencing the pre-patch
                // graph under the prior run's hash.
                useCanvasStore.getState().pushHistory()
                applyAutoApplyPatch(block)
              }
            } finally {
              useCanvasStore.getState().endExternalGraphMutation()
            }

            // Task 2 (2026-04-09): mirror CEE analysis_ready into the
            // canvas store + option-node cache after the patch lands.
            mirrorAnalysisReadyAfterAccept()

            setPatchBlockState(stateKey, 'accepted')
            recordInteractionEvent({
              chainId,
              kind: 'changes_applied',
              summary: block.patch_id,
              stateAfter: createPanelInteractionSnapshot(messages.length),
            })

            const { nodeIds, edgeIds } = extractTargetIdsFromPatch(block.operations)
            const allIds = [...nodeIds, ...edgeIds]
            if (allIds.length > 0) {
              useGuidanceStore.getState().clearItemsByTargetIds(allIds)
            }

            notifyPatchAccepted({
              patch_id: block.patch_id,
              operations: block.operations,
              applied_graph_hash: typeof result.graph_hash === 'string' ? result.graph_hash : undefined,
            })

            // Track 2: persist block state change
            const turnId = extractTurnIdFromStateKey(stateKey, block.patch_id)
            void onBlockAction(turnId, block.patch_id, 'accepted', `Accepted: "${block.summary}"`)
          } else {
            const violations = (result.violations ?? []).map(
              (v: { message: string }) => v.message,
            )
            setPatchBlockState(stateKey, 'rejected')
            setPatchRejection(stateKey, {
              code: result.code ?? 'VALIDATION_FAILED',
              message: result.message ?? 'Patch validation failed',
              violations,
            })
            sendSystemEventBestEffort({
              type: 'patch_dismissed',
              payload: { patch_id: block.patch_id, reason: 'validation_failed' },
            })

            // Track 2: persist block rejection
            const rejTurnId = extractTurnIdFromStateKey(stateKey, block.patch_id)
            void onBlockAction(rejTurnId, block.patch_id, 'rejected', 'Validation failed')
          }
        } else {
          useCanvasStore.getState().beginExternalGraphMutation('patch_apply')
          try {
            // Same pushHistory rationale as the op-replay fallback above —
            // applyAutoApplyPatch does not push history itself, so we must
            // invalidate graphEditedSinceLastRun + analysisStateReady here.
            useCanvasStore.getState().pushHistory()
            applyAutoApplyPatch(block)
          } finally {
            useCanvasStore.getState().endExternalGraphMutation()
          }

          // Task 2 (2026-04-09): same mirror step for the adapter-less
          // fallback path.
          mirrorAnalysisReadyAfterAccept()

          setPatchBlockState(stateKey, 'accepted')
          recordInteractionEvent({
            chainId,
            kind: 'changes_applied',
            summary: block.patch_id,
            stateAfter: createPanelInteractionSnapshot(messages.length),
          })

          const { nodeIds: nIds, edgeIds: eIds } = extractTargetIdsFromPatch(block.operations)
          const ids = [...nIds, ...eIds]
          if (ids.length > 0) {
            useGuidanceStore.getState().clearItemsByTargetIds(ids)
          }

          notifyPatchAccepted({
            patch_id: block.patch_id,
            operations: block.operations,
            applied_graph_hash: undefined,
          })

          // Track 2: persist block state change
          const fbTurnId = extractTurnIdFromStateKey(stateKey, block.patch_id)
          void onBlockAction(fbTurnId, block.patch_id, 'accepted', `Accepted: "${block.summary}"`)
        }
      } catch {
        setPatchRejection(stateKey, {
          code: 'NETWORK_ERROR',
          message: 'Failed to apply — try again',
        })
      }
    },
    [setPatchBlockState, setPatchRejection, sendSystemEvent, sendSystemEventBestEffort, onBlockAction],
  )

  const handlePatchDismiss = useCallback(
    (stateKey: string) => {
      beginInteractionChain({
        chainId: stateKey,
        triggerSurface: 'proposal_dismiss',
        sourceSurface: 'ai_panel',
        initiatedBy: 'user',
        visibleTextSubmitted: stateKey,
        submittedText: stateKey,
        stateBefore: createPanelInteractionSnapshot(messages.length),
        setPending: true,
      })
      setPatchBlockState(stateKey, 'dismissed')
      const message = messages.find((candidate) => candidate.id && stateKey.startsWith(`${candidate.id}:`))
      const patchId = message?.id ? stateKey.slice(message.id.length + 1) : stateKey
      sendSystemEventBestEffort({
        type: 'patch_dismissed',
        payload: { patch_id: patchId },
      })

      // Track 2: persist block dismissal
      const turnId = extractTurnIdFromStateKey(stateKey, patchId)
      void onBlockAction(turnId, patchId, 'dismissed', `Dismissed suggestion`)
    },
    [messages.length, setPatchBlockState, sendSystemEventBestEffort, onBlockAction],
  )

  const handleFeedback = useCallback(
    // Return the send promise so FeedbackRow can revert its optimistic vote if
    // the feedback turn fails to reach the server (the thumbs re-enable for
    // retry — no new surface). The typed 0.22 mapping lives in buildV5Payload
    // (feedback_submitted -> feedback wire event); this is the emitter half.
    (turnId: string, rating: 'up' | 'down') =>
      sendSystemEvent({
        type: 'feedback_submitted',
        payload: { turn_id: turnId, rating },
      }),
    [sendSystemEvent],
  )

  // ── Guidance / navigation callbacks ───────────────────────────────────
  const handleScrollToPatch = useCallback((patchId: string) => {
    // ChatThread manages its own scroll ref; fall back to document query
    const el = document.querySelector(`[data-patch-id="${patchId}"]`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [])

  const handleOpenInspector = useCallback((nodeId: string) => {
    recordUserAction({
      actionType: 'opened inspector',
      payloadSummary: { node_id: nodeId },
    })
    recordCrossSurfaceEvent({
      eventType: 'inspector_opened_from_recommendation',
      summary: `Inspector opened for ${nodeId}`,
      payloadSummary: { node_id: nodeId },
    })
    useCanvasStore.getState().selectNodeWithoutHistory(nodeId)
    useCanvasStore.getState().setShowInspectorPanel(true)
  }, [])

  // ── Unified run gating (mirrors OutputsDock) ─────────────────────────
  const resultsStatus = useCanvasStore(selectResultsStatus)
  const graphHealth = useCanvasStore((s) => s.graphHealth)
  const hasBlockers = useCanvasStore((s) => {
    const health = s.graphHealth
    return health?.issues?.some((i: any) => i.severity === 'error' || i.severity === 'blocker') ?? false
  })
  const isAnalysisRunning = resultsStatus === 'preparing' || resultsStatus === 'connecting' || resultsStatus === 'streaming'

  // Boolean selector: recomputes on store writes but only re-renders on a
  // flip. Same honest gate as OutputsDock — without it this surface's run
  // button re-created the exact panel-vs-engine contradiction #343 fixed.
  const ceeCannotSeeModel = useCanvasStore((s) => computeCeeCannotSeeModel(s.nodes))
  const runGateResult = useMemo(() => canRunAnalysisUtil({
    graphHealth: graphHealth ?? null,
    readiness,
    hasBlockers,
    nodeCount,
    isRunning: isAnalysisRunning,
    ceeCannotSeeModel,
  }), [graphHealth, readiness, hasBlockers, nodeCount, isAnalysisRunning, ceeCannotSeeModel])

  // In-flight takes priority over structural reasons: the composer button
  // is disabled for either cause, but the user-visible tooltip should explain
  // the active reason, not just the structural one.
  const runBlockedReason = isV2RunInFlight
    ? 'Analysis in progress'
    : (getRunButtonTooltip(runGateResult) ?? undefined)

  // ── Top bar callbacks ─────────────────────────────────────────────────
  const handleRunAnalysis = useCallback(() => {
    // Hotfix item 4 hardening: guard all run-trigger paths (composer button,
    // guidance store callback, any future caller) against structural readiness
    // AND in-flight state. The button's disabled prop already blocks the UI
    // path, but guidance chips route through useGuidanceStore's registered
    // _runAnalysis reference and must not bypass the in-flight check. F-77
    // inside useV2Run also aborts the prior run, but hard-blocking here is
    // the correct defensive pattern.
    if (!runGateResult.allowed || isV2RunInFlight) return
    const composerText = composerRef.current?.peekText().trim() ?? ''
    beginInteractionChain({
      triggerSurface: 'analyse_now',
      sourceSurface: 'ai_panel',
      initiatedBy: 'user',
      visibleTextSubmitted: null,
      submittedText: '[direct analysis run]',
      stateBefore: createPanelInteractionSnapshot(messages.length),
      payloadSummary: {
        composer_has_text: composerText.length > 0,
        composer_text_length: composerText.length,
      },
    })

    // v5-canonical-analysis brief: when canonical flag + V5 eligibility
    // are on, route through the existing chip-action dispatch so CEE
    // persists a run_analysis fact. Mirrors OutputsDock.handleRunAnalysis.
    // Same exact payload shape as suggested chips — never free-text.
    if (isV5CanonicalRunPath()) {
      void dispatchAction({
        action_type: 'run_analysis',
        label: 'Run analysis',
        message: 'Run analysis',
        source: 'chip',
      })
      return
    }
    void runV2Analysis()
  }, [messages.length, runGateResult.allowed, isV2RunInFlight, runV2Analysis, dispatchAction])

  useEffect(() => {
    const sendChipByLabelMessage = (label: string, message: string) =>
      sendChip({ id: `evidence-apply-${Date.now()}`, label, message, intent: 'primary' })
    // Prefill the visible composer (see prefillInto): the legacy ChatComposer
    // ref when mounted, else the ConversationContext draft AIInputBar renders
    // under `hideComposer`. Writing to the null ref was the silent no-op behind
    // inspector "Ask about this" / analysis-hero prefills doing nothing. A
    // caller-supplied override still wins when provided.
    const prefillChat = prefillChatOverride
      ?? ((text: string) => prefillInto(composerRef.current, setDraft, text))
    // The returned unregister is ownership-guarded (see guidanceStore): it
    // only clears the shared callbacks if THIS registration is still the
    // active one (token compare — callback identities are shared via the
    // conversation singleton, so they cannot discriminate hosts). The old
    // unconditional null-out here meant that with two hosts mounted
    // (floating panel + dock Olumi tab), whichever unmounted last killed the
    // survivor's live registration — silently breaking every cross-surface
    // run/ask CTA until a chat panel was reopened.
    const register = () =>
      useGuidanceStore.getState().registerConversationCallbacks(
        sendMessage,
        handleScrollToPatch,
        sendChipByLabelMessage,
        handleRunAnalysis,
        prefillChat,
        dispatchAction,
      )
    let unregister = register()
    // Survivor takeover: when ANOTHER host unmounts and legitimately clears
    // its own (later) registration, the shared callbacks go null while this
    // panel is still mounted. Re-register so cross-surface CTAs keep a live
    // dispatcher — the guarded unregister above makes this loop-free (the
    // subscription only fires on an actual null transition).
    const unsubscribe = useGuidanceStore.subscribe((state) => {
      if (state._registrationToken === null) {
        unregister = register()
      }
    })
    return () => {
      unsubscribe()
      unregister()
    }
  }, [sendMessage, handleScrollToPatch, sendChip, handleRunAnalysis, dispatchAction, prefillChatOverride, setDraft])

  const handleInsertText = useCallback((text: string) => {
    composerRef.current?.replaceText(text)
  }, [])

  // ── Generate model state ────────────────────────────────────────────
  // Note: generateState is derived in ChatComposer directly from composer.value
  // to avoid the useEffect lag that caused first-click silently disabled.

  const handleBriefStateChange = useCallback((readiness: BriefReadiness | null, ht: boolean) => {
    // User started typing — cancel any pending brief restore from a failed generate
    if (ht) pendingBriefRef.current = null
  }, [])

  const handleGenerateModel = useCallback(() => {
    if (isThinking || generateInFlightRef.current) return
    const brief = composerRef.current?.consumeBrief()
    // consumeBrief returns null if empty; require at least some text (CEE handles quality gating)
    if (brief && brief.length > 0) {
      generateInFlightRef.current = true
      pendingBriefRef.current = brief // save for restore if CEE returns no draft
      beginInteractionChain({
        triggerSurface: 'generate_model',
        sourceSurface: 'ai_panel',
        initiatedBy: 'user',
        visibleTextSubmitted: brief,
        submittedText: brief,
        stateBefore: createPanelInteractionSnapshot(messages.length),
        setPending: true,
      })
      // Send as a user message — the orchestrator processes framing-stage
      // messages as model generation input and responds with auto-apply
      // graph patches. Using sendMessage (not sendSystemEvent) because
      // CEE's v3 Zod schema does not include a 'generate_model' event type.
      sendMessage(brief, {
        turnType: 'explicit_generate',
        debugSource: 'generate_model',
        debugSourceSurface: 'ai_panel',
      }).finally(() => { generateInFlightRef.current = false })
    }
  }, [isThinking, sendMessage])

  // Restore brief text if Generate Model completed without producing a graph.
  // Only triggers on the falling edge of isThinking (true → false), not when
  // isThinking is already false — prevents premature restore before the
  // request has set isThinking=true.
  useEffect(() => {
    if (isThinking) {
      wasThinkingRef.current = true
    } else if (wasThinkingRef.current && pendingBriefRef.current) {
      wasThinkingRef.current = false
      const savedBrief = pendingBriefRef.current
      pendingBriefRef.current = null
      // Graph still empty → CEE didn't draft; restore so user can retry
      if (nodeCount === 0) {
        composerRef.current?.replaceText(savedBrief)
      }
    }
  }, [isThinking, nodeCount])

  // ── Render panel header + thread + composer ────────────────────────────
  // Tranche 1 item 30: ChatTopBar removed. Attach · Voice · Run analysis move
  // to the composer left cluster (item 31). Guide + Thinking mode move into
  // ComposerTools on the composer right. Collapse control moves to the
  // panel header corner.
  return (
    <>
      {!hideComposer && (
      <div
        className="flex items-center justify-end bg-panel flex-shrink-0"
        style={{
          height: 32,
          padding: '0 6px',
          borderBottom: '1px solid var(--border-default, #EEE6D8)',
        }}
        data-testid="chat-panel-header"
      >
        <button
          type="button"
          onClick={onCollapse}
          aria-label="Collapse panel"
          title="Collapse panel"
          className="flex items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-offset-2"
          style={{
            width: 28, height: 28,
            background: 'transparent',
            border: 'none',
            color: 'var(--text-light, #6E6B6B)',
            cursor: 'pointer',
            transition: 'all 150ms',
          }}
          data-testid="chat-panel-collapse"
        >
          <ChevronsRight className="w-4 h-4" strokeWidth={1.8} aria-hidden="true" />
        </button>
      </div>
      )}

      <ChatThread
        messages={messages}
        isThinking={isThinking}
        longRunningHint={longRunningHint}
        nodeCount={nodeCount}
        patchBlockStates={patchBlockStates}
        patchRejections={patchRejections}
        onChipClick={handleChipClick}
        onPatchAccept={handlePatchAccept}
        onPatchDismiss={handlePatchDismiss}
        onFeedback={handleFeedback}
        onRetry={retryLast}
        onArtefactMessage={handleArtefactMessage}
        onProposalConfirm={handleProposalConfirm}
        compact={compact}
        scrollListRef={scrollListRef}
      />

      {!hideComposer && (
        <ChatComposer
          ref={composerRef}
          conversation={conversation}
          onCollapse={onCollapse}
          onScrollToPatch={handleScrollToPatch}
          onOpenInspector={handleOpenInspector}
          onGenerateModel={handleGenerateModel}
          onBriefStateChange={handleBriefStateChange}
          onInsertText={handleInsertText}
          onAttach={onAttach}
          onRunAnalysis={handleRunAnalysis}
          canRunAnalysis={runGateResult.allowed && !isV2RunInFlight}
          runBlockedReason={runBlockedReason}
        />
      )}
    </>
  )
})
