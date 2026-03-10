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
import { useCanvasStore } from '../store'
import { useGuidanceStore } from '../stores/guidanceStore'
import { useStagePill } from '../hooks/useStagePill'
import type { ActionChip, GraphPatchBlock } from './types'
import type { UseConversationReturn } from './useConversation'
import { applyAutoApplyPatch } from './utils/applyPatch'
import { extractTargetIdsFromPatch } from './utils/extractTargetIds'
import { plot } from '../../adapters/plot'
import { ChatTopBar, type GenerateState } from './zones/ChatTopBar'
import { ChatThread } from './zones/ChatThread'
import { ChatComposer, type ChatComposerHandle } from './zones/ChatComposer'
import type { BriefReadiness } from './hooks/useBriefSignals'
import { useThreadPersistence } from './hooks/useThreadPersistence'

interface ConversationPanelProps {
  conversation: UseConversationReturn
  onCollapse: () => void
  onAttach: () => void
}

export const ConversationPanel = memo(function ConversationPanel({
  conversation,
  onCollapse,
  onAttach,
}: ConversationPanelProps) {
  const {
    messages, isThinking, longRunningHint,
    sendMessage, sendSystemEvent, sendChip, retryLast,
    patchBlockStates, setPatchBlockState,
    patchRejections, setPatchRejection,
  } = conversation

  const nodeCount = useCanvasStore((s) => s.nodes.length)
  const scenarioId = useCanvasStore((s) => s.currentScenarioId)
  const { stage } = useStagePill()
  const composerRef = useRef<ChatComposerHandle>(null)

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

  // ── Patch handlers (unchanged from previous version) ──────────────────
  const handlePatchAccept = useCallback(
    async (stateKey: string, block: GraphPatchBlock) => {
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

            setPatchBlockState(stateKey, 'accepted')

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
            const turnId = stateKey.includes(':') ? stateKey.split(':')[0] : stateKey
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
            const rejTurnId = stateKey.includes(':') ? stateKey.split(':')[0] : stateKey
            void onBlockAction(rejTurnId, block.patch_id, 'rejected', 'Validation failed')
          }
        } else {
          useCanvasStore.getState().beginExternalGraphMutation('patch_apply')
          try {
            applyAutoApplyPatch(block)
          } finally {
            useCanvasStore.getState().endExternalGraphMutation()
          }
          setPatchBlockState(stateKey, 'accepted')

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
          const fbTurnId = stateKey.includes(':') ? stateKey.split(':')[0] : stateKey
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
      setPatchBlockState(stateKey, 'dismissed')
      const patchId = stateKey.includes(':') ? stateKey.split(':').slice(1).join(':') : stateKey
      sendSystemEvent({
        type: 'patch_dismissed',
        payload: { patch_id: patchId },
      })

      // Track 2: persist block dismissal
      const turnId = stateKey.includes(':') ? stateKey.split(':')[0] : stateKey
      void onBlockAction(turnId, patchId, 'dismissed', `Dismissed suggestion`)
    },
    [setPatchBlockState, sendSystemEvent, onBlockAction],
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
    useCanvasStore.getState().selectNodeWithoutHistory(nodeId)
    useCanvasStore.getState().setShowInspectorPanel(true)
  }, [])

  useEffect(() => {
    useGuidanceStore.getState().registerConversationCallbacks(sendMessage, handleScrollToPatch)
    return () => {
      useGuidanceStore.setState({ _sendMessage: null, _scrollToPatch: null })
    }
  }, [sendMessage, handleScrollToPatch])

  // ── Top bar callbacks ─────────────────────────────────────────────────
  const handleRunAnalysis = useCallback(() => {
    sendMessage('run it', { hidden: true })
  }, [sendMessage])

  const handleInsertText = useCallback((text: string) => {
    composerRef.current?.replaceText(text)
  }, [])

  // ── Generate model state ────────────────────────────────────────────
  const [briefReadiness, setBriefReadiness] = useState<BriefReadiness | null>(null)
  const [hasText, setHasText] = useState(false)

  const handleBriefStateChange = useCallback((readiness: BriefReadiness | null, ht: boolean) => {
    setBriefReadiness(readiness)
    setHasText(ht)
  }, [])

  const generateState: GenerateState = useMemo(() => {
    if (isThinking) return 'loading'
    if ((briefReadiness === 'medium' || briefReadiness === 'high') && hasText) return 'active'
    return 'disabled'
  }, [isThinking, briefReadiness, hasText])

  const handleGenerateModel = useCallback(() => {
    const brief = composerRef.current?.consumeBrief()
    if (brief) {
      // Send as a user message — the orchestrator processes framing-stage
      // messages as model generation input and responds with auto-apply
      // graph patches. Using sendMessage (not sendSystemEvent) because
      // CEE's v3 Zod schema does not include a 'generate_model' event type.
      sendMessage(brief)
    }
  }, [sendMessage])

  // ── Render three zones ────────────────────────────────────────────────
  return (
    <>
      <ChatTopBar
        stage={stage}
        isThinking={isThinking}
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
      />

      <ChatComposer
        ref={composerRef}
        conversation={conversation}
        generateState={generateState}
        onCollapse={onCollapse}
        onScrollToPatch={handleScrollToPatch}
        onOpenInspector={handleOpenInspector}
        onGenerateModel={handleGenerateModel}
        onBriefStateChange={handleBriefStateChange}
      />
    </>
  )
})
