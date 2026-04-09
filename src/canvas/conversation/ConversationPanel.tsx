/**
 * ConversationPanel — Multi-turn conversation surface (v2 three-zone layout)
 *
 * Renders inside DraftChat's expanded panel when VITE_ENABLE_ORCHESTRATOR_V2
 * is ON. Delegates to three zones: ChatTopBar (Zone 1), ChatThread (Zone 2),
 * and ChatComposer (Zone 3).
 *
 * This component retains all patch handler callbacks and guidance store wiring.
 */

import { useRef, useState, useEffect, useCallback, useMemo, memo } from 'react'
import { useCanvasStore, selectResultsStatus } from '../store'
import { useGuidanceStore } from '../stores/guidanceStore'
import { useStagePill } from '../hooks/useStagePill'
import type { ActionChip, GraphPatchBlock } from './types'
import type { UseConversationReturn } from './useConversation'
import { applyAutoApplyPatch } from './utils/applyPatch'
import { backfillInterventionsOntoOptionNodes, backfillGoalThresholdOntoGoalNode } from '../utils/applyDraftResult'
import { extractTargetIdsFromPatch } from './utils/extractTargetIds'
import { plot } from '../../adapters/plot'
import { logger } from '../../lib/logger'
import { ChatTopBar } from './zones/ChatTopBar'
import { ChatThread } from './zones/ChatThread'
import { ChatComposer, type ChatComposerHandle } from './zones/ChatComposer'
import type { BriefReadiness } from './hooks/useBriefSignals'
import { useThreadPersistence } from './hooks/useThreadPersistence'
import { beginInteractionChain, getUiSurfaceState, recordCrossSurfaceEvent, recordInteractionEvent, recordUserAction, type InteractionStateSnapshot } from '../../lib/debug-state'
import { canRunAnalysis as canRunAnalysisUtil, getRunButtonTooltip } from '../utils/canRunAnalysis'
import { useV2Run } from '../hooks/useV2Run'
import { useGraphReadiness } from '../hooks/useGraphReadiness'

interface ConversationPanelProps {
  conversation: UseConversationReturn
  onCollapse: () => void
  onAttach: () => void
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
}: ConversationPanelProps) {
  const {
    messages, isThinking, longRunningHint,
    sendMessage, sendSystemEvent, sendChip, dispatchAction, retryLast,
    patchBlockStates, setPatchBlockState,
    patchRejections, setPatchRejection,
  } = conversation

  const nodeCount = useCanvasStore((s) => s.nodes.length)
  const scenarioId = useCanvasStore((s) => s.currentScenarioId)
  const { stage } = useStagePill()
  const composerRef = useRef<ChatComposerHandle>(null)
  const pendingBriefRef = useRef<string | null>(null)
  const generateInFlightRef = useRef(false)
  const wasThinkingRef = useRef(false)
  const { runV2Analysis } = useV2Run()
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

  // ── Patch handlers (unchanged from previous version) ──────────────────
  const handlePatchAccept = useCallback(
    async (stateKey: string, block: GraphPatchBlock) => {
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
      // Extracted as a local closure so both the PLoT-validated success path
      // and the op-replay / adapter-less fallbacks share the same post-apply
      // mirroring step. Without this, an AI-added option accepted via a
      // non-auto-apply patch lands on the canvas with empty
      // node.data.interventions — the pre-run reconciler then synthesises
      // the option as 'needs_user_mapping' and the run gate blocks with
      // MISSING_INTERVENTIONS. Mirrors the draft-apply path at
      // applyDraftResult.ts:187 and the auto-apply handleEnvelope path in
      // useConversation.ts (backfill call post-setCeeAnalysisReady). See
      // docs/open-issues-root-cause-investigation-2026-04-09.md.
      const mirrorAnalysisReadyAfterAccept = () => {
        const resolvedAnalysisReady = block.analysis_ready ?? null
        if (!resolvedAnalysisReady) return
        useCanvasStore.getState().setCeeAnalysisReady(resolvedAnalysisReady)
        const backfillResult = backfillInterventionsOntoOptionNodes(resolvedAnalysisReady)
        if (backfillResult.interventionBackfilledCount > 0) {
          logger.warn('patch_accept.intervention_backfill', {
            patchId: block.patch_id,
            scenarioId: useCanvasStore.getState().currentScenarioId ?? null,
            interventionBackfilledCount: backfillResult.interventionBackfilledCount,
            baselineOnlyUpdatedCount: backfillResult.baselineOnlyUpdatedCount,
            totalOptionsInPayload: resolvedAnalysisReady.options?.length ?? 0,
          })
        }
        // Goal threshold cache mirror — same pattern, same contract.
        backfillGoalThresholdOntoGoalNode(resolvedAnalysisReady)
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
          sendSystemEvent({
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
                const store = useCanvasStore.getState()
                store.pushHistory()
                useCanvasStore.setState({
                  nodes: validatedGraph.nodes,
                  edges: validatedGraph.edges,
                })
              } else {
                if (import.meta.env.DEV) {
                  console.warn('[olumi] op-replay fallback: PLoT did not return full graph, applying operations individually')
                }
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

            sendSystemEvent({
              type: 'patch_accepted',
              payload: {
                patch_id: block.patch_id,
                operations: block.operations,
                applied_graph_hash: typeof result.graph_hash === 'string' ? result.graph_hash : undefined,
              },
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
            sendSystemEvent({
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

          sendSystemEvent({
            type: 'patch_accepted',
            payload: {
              patch_id: block.patch_id,
              operations: block.operations,
              applied_graph_hash: undefined,
            },
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
    [setPatchBlockState, setPatchRejection, sendSystemEvent, onBlockAction],
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
      sendSystemEvent({
        type: 'patch_dismissed',
        payload: { patch_id: patchId },
      })

      // Track 2: persist block dismissal
      const turnId = extractTurnIdFromStateKey(stateKey, patchId)
      void onBlockAction(turnId, patchId, 'dismissed', `Dismissed suggestion`)
    },
    [messages.length, setPatchBlockState, sendSystemEvent, onBlockAction],
  )

  const handleFeedback = useCallback(
    (turnId: string, rating: 'up' | 'down') => {
      sendSystemEvent({
        type: 'feedback_submitted',
        payload: { turn_id: turnId, rating },
      })
    },
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

  const runGateResult = useMemo(() => canRunAnalysisUtil({
    graphHealth: graphHealth ?? null,
    readiness,
    hasBlockers,
    nodeCount,
    isRunning: isAnalysisRunning,
  }), [graphHealth, readiness, hasBlockers, nodeCount, isAnalysisRunning])

  const runBlockedReason = getRunButtonTooltip(runGateResult) ?? undefined

  // ── Top bar callbacks ─────────────────────────────────────────────────
  const handleRunAnalysis = useCallback(() => {
    if (!runGateResult.allowed) return
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
    void runV2Analysis()
  }, [messages.length, runGateResult.allowed, runV2Analysis])

  useEffect(() => {
    const sendChipByLabelMessage = (label: string, message: string) =>
      sendChip({ id: `evidence-apply-${Date.now()}`, label, message, intent: 'primary' })
    const prefillChat = (text: string) => composerRef.current?.replaceText(text)
    useGuidanceStore.getState().registerConversationCallbacks(
      sendMessage,
      handleScrollToPatch,
      sendChipByLabelMessage,
      handleRunAnalysis,
      prefillChat,
      dispatchAction,
    )
    return () => {
      useGuidanceStore.setState({ _sendMessage: null, _runAnalysis: null, _sendChip: null, _scrollToPatch: null, _prefillChat: null, _dispatchAction: null })
    }
  }, [sendMessage, handleScrollToPatch, sendChip, handleRunAnalysis, dispatchAction])

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

  // ── Render three zones ────────────────────────────────────────────────
  return (
    <>
      <ChatTopBar
        stage={stage}
        isThinking={isThinking}
        canRunAnalysis={runGateResult.allowed}
        runBlockedReason={runBlockedReason}
        onCollapse={onCollapse}
        onAttach={onAttach}
        onRunAnalysis={handleRunAnalysis}
        onInsertText={handleInsertText}
      />

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
      />

      <ChatComposer
        ref={composerRef}
        conversation={conversation}
        onCollapse={onCollapse}
        onScrollToPatch={handleScrollToPatch}
        onOpenInspector={handleOpenInspector}
        onGenerateModel={handleGenerateModel}
        onBriefStateChange={handleBriefStateChange}
      />
    </>
  )
})
