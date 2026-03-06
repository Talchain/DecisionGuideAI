/**
 * ConversationPanel — Multi-turn conversation surface
 *
 * Renders inside DraftChat's expanded panel when VITE_ENABLE_ORCHESTRATOR_V2
 * is ON. Shows a scrollable message list, typing indicator, inline blocks,
 * action chips, and a growing single-line input.
 */

import { useRef, useEffect, useState, useCallback, useMemo, memo } from 'react'
import { typography } from '../../styles/typography'
import { useCanvasStore } from '../store'
import { useGuidanceStore } from '../stores/guidanceStore'
import { usePanelsStore } from '../stores/panelsStore'
import { useStagePill } from '../hooks/useStagePill'
import type { ScenarioStage } from '../../types/scenario'
import { useDebounce } from '../../hooks/useDebounce'
import { extractRealtimeSignals } from '../../signals/realtime-signals'
import { isFramingStage } from '../../signals/stage-helpers'
import { MessageBubble } from './MessageBubble'
import { GrowingInput } from './GrowingInput'
import { GuidanceStrip } from './GuidanceStrip'
import { ActionStrip } from './ActionStrip'
import { ReadinessPill } from './ReadinessPill'
import { BiasAlertIcon } from './BiasAlertIcon'
import type { NavigateTarget } from './ActionStrip'
import type { ActionChip, GraphPatchBlock, PatchOperation } from './types'
import type { UseConversationReturn, PatchRejectionInfo } from './useConversation'
import { extractTargetIdsFromPatch } from './utils/extractTargetIds'
import { generateGraphHash } from '../utils/graphHash'
import { plot } from '../../adapters/plot'
import styles from './Conversation.module.css'

// ---------------------------------------------------------------------------
// Patch apply helper — shared by validated and optimistic branches
// ---------------------------------------------------------------------------

function applyPatchOperations(
  operations: PatchOperation[],
  getState: () => ReturnType<typeof useCanvasStore.getState>,
): void {
  for (const op of operations) {
    const s = getState()
    switch (op.op) {
      case 'add_node': {
        // Store generates its own ID via addNode; we immediately patch the
        // new node with the orchestrator-provided target_id and full data.
        s.addNode(undefined, (op.data.type as string) || 'decision')
        const nodes = getState().nodes
        const newNode = nodes[nodes.length - 1]
        if (newNode) {
          s.updateNode(newNode.id, { id: op.target_id, data: op.data } as any)
        }
        break
      }
      case 'remove_node':
        s.deleteNodeById(op.target_id)
        break
      case 'update_node':
        s.updateNode(op.target_id, { data: op.data } as any)
        break
      case 'add_edge':
        s.addEdge({
          source: op.data.source as string,
          target: op.data.target as string,
          data: op.data,
        } as any)
        break
      case 'remove_edge':
        s.deleteEdgeById(op.target_id)
        break
      case 'update_edge':
        s.updateEdgeData(op.target_id, op.data as any)
        break
    }
  }
}

interface ConversationPanelProps {
  conversation: UseConversationReturn
  onCollapse: () => void
}

const WELCOME_TEXT =
  "Describe the decision you're facing \u2014 what you're trying to decide, the options you're considering, and what matters most."

/** Per-stage placeholder text per Conversational Orchestrator v3 §14.3 */
const STAGE_PLACEHOLDERS: Record<ScenarioStage, string> = {
  frame:    'What decision are you facing?',
  ideate:   'Add options, explore alternatives...',
  evaluate: 'Say \'run it\' to analyse, or keep refining',
  decide:   'Ask about results, or challenge the recommendation',
  optimise: 'Edit the brief, share it, or start a new scenario',
}

const DEFAULT_PLACEHOLDER = 'What decision are you facing?'

export const ConversationPanel = memo(function ConversationPanel({
  conversation,
  onCollapse,
}: ConversationPanelProps) {
  const {
    messages, isThinking, longRunningHint, lastFailedInput,
    sendMessage, sendSystemEvent, sendChip, retryLast,
    patchBlockStates, setPatchBlockState,
    patchRejections, setPatchRejection,
  } = conversation
  const [inputValue, setInputValue] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const listEndRef = useRef<HTMLDivElement>(null)
  const [showNewMessageIndicator, setShowNewMessageIndicator] = useState(false)
  const userScrolledUpRef = useRef(false)
  const nodeCount = useCanvasStore((s) => s.nodes.length)

  // Stage-aware placeholder (§14.3)
  const { stage } = useStagePill()
  const inputPlaceholder = STAGE_PLACEHOLDERS[stage] ?? DEFAULT_PLACEHOLDER

  // Brief readiness signals — 800ms debounce, framing stage only.
  // Always compute during framing (even when empty) so the pill shows "Low"
  // with all-missing feedback. Skip extraction only outside framing stage.
  const debouncedInput = useDebounce(inputValue, 800)
  const briefSignals = useMemo(() => {
    if (!isFramingStage(stage)) return null
    if (!debouncedInput || !debouncedInput.trim()) {
      return extractRealtimeSignals('')
    }
    return extractRealtimeSignals(debouncedInput)
  }, [debouncedInput, stage])

  // Restore input text when a send fails so the user can edit and resend
  useEffect(() => {
    if (lastFailedInput) setInputValue(lastFailedInput)
  }, [lastFailedInput])

  // Show welcome message only when empty and no graph
  const showWelcome = messages.length === 0 && nodeCount === 0

  // Auto-scroll logic: only auto-scroll if user is near the bottom
  const scrollToBottom = useCallback(() => {
    listEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    setShowNewMessageIndicator(false)
    userScrolledUpRef.current = false
  }, [])

  useEffect(() => {
    if (messages.length === 0) return

    if (userScrolledUpRef.current) {
      setShowNewMessageIndicator(true)
    } else {
      scrollToBottom()
    }
  }, [messages.length, isThinking, scrollToBottom])

  const handleScroll = useCallback(() => {
    const el = listRef.current
    if (!el) return
    const isNearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 80
    userScrolledUpRef.current = !isNearBottom
    if (isNearBottom) {
      setShowNewMessageIndicator(false)
    }
  }, [])

  const handleSend = useCallback(() => {
    const text = inputValue.trim()
    if (!text) return
    setInputValue('')
    sendMessage(text)
  }, [inputValue, sendMessage])

  const handleChipClick = useCallback(
    (chip: ActionChip) => {
      if (chip.id === 'retry') {
        retryLast()
        return
      }
      sendChip(chip)
    },
    [sendChip, retryLast],
  )

  // GraphPatchBlock handlers
  const handlePatchAccept = useCallback(
    async (stateKey: string, block: GraphPatchBlock) => {
      try {
        // Check staleness: current graph hash vs target_graph_hash
        const state = useCanvasStore.getState()
        const currentHash = state.currentScenarioLastResultHash
        if (block.target_graph_hash && currentHash && currentHash !== block.target_graph_hash) {
          // Warn but don't block — user may still want to apply
          if (import.meta.env.DEV) {
            console.warn('[ConversationPanel] Graph hash mismatch — patch may be stale')
          }
        }

        // Guard: reject patches with unknown operations before any mutation
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

        // Call PLoT validate-patch
        const adapter = plot as any
        if (adapter.validatePatch && typeof adapter.validatePatch === 'function') {
          const result = await adapter.validatePatch({
            graph: { nodes: state.nodes, edges: state.edges },
            operations: block.operations,
          })

          if (result.valid) {
            // Prefer PLoT's validated graph when available — avoids state drift
            // from store-generated IDs and implicit normalisation during local replay.
            const validatedGraph = result.graph ?? result.validated_graph
            // A.7: Suppress direct_graph_edit during patch-apply
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
                // Fallback: replay ops locally
                if (import.meta.env.DEV) {
                  console.warn('[olumi] op-replay fallback: PLoT did not return full graph, applying operations individually')
                }
                applyPatchOperations(block.operations, () => useCanvasStore.getState())
              }
            } finally {
              useCanvasStore.getState().endExternalGraphMutation()
            }

            setPatchBlockState(stateKey, 'accepted')

            // Auto-clear guidance items targeting modified elements
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
                // Use only the confirmed field from PLoT validate-patch response
                applied_graph_hash: typeof result.graph_hash === 'string' ? result.graph_hash : undefined,
              },
            })
          } else {
            // Validation failed — show rejection inline
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
          }
        } else {
          // No validate-patch endpoint — apply directly (optimistic)
          // A.7: Suppress direct_graph_edit during patch-apply
          useCanvasStore.getState().beginExternalGraphMutation('patch_apply')
          try {
            applyPatchOperations(block.operations, () => useCanvasStore.getState())
          } finally {
            useCanvasStore.getState().endExternalGraphMutation()
          }
          setPatchBlockState(stateKey, 'accepted')

          // Auto-clear guidance items targeting modified elements
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
        }
      } catch {
        // Network failure — keep in proposed state with retry option
        setPatchRejection(stateKey, {
          code: 'NETWORK_ERROR',
          message: 'Failed to apply — try again',
        })
      }
    },
    [setPatchBlockState, setPatchRejection, sendSystemEvent],
  )

  const handlePatchDismiss = useCallback(
    (stateKey: string) => {
      setPatchBlockState(stateKey, 'dismissed')
      // Extract original patch_id from composite key (turnId:patchId or bare patchId)
      const patchId = stateKey.includes(':') ? stateKey.split(':').slice(1).join(':') : stateKey
      sendSystemEvent({
        type: 'patch_dismissed',
        payload: { patch_id: patchId },
      })
    },
    [setPatchBlockState, sendSystemEvent],
  )

  // A.7: Feedback handler — sends feedback_submitted system event (non-blocking)
  const handleFeedback = useCallback(
    (turnId: string, rating: 'up' | 'down') => {
      sendSystemEvent({
        type: 'feedback_submitted',
        payload: { turn_id: turnId, rating },
      })
    },
    [sendSystemEvent],
  )

  const canSend = inputValue.trim().length > 0 && !isThinking

  // Guidance strip callbacks
  const setActiveGuidanceItem = useGuidanceStore((s) => s.setActiveGuidanceItem)

  const handleScrollToPatch = useCallback((patchId: string) => {
    const el = listRef.current?.querySelector(`[data-patch-id="${patchId}"]`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    } else {
      // Fallback: scroll to bottom where latest message is
      scrollToBottom()
    }
  }, [scrollToBottom])

  const handleOpenInspector = useCallback((nodeId: string) => {
    useCanvasStore.getState().selectNodeWithoutHistory(nodeId)
    useCanvasStore.getState().setShowInspectorPanel(true)
  }, [])

  // Register conversation callbacks in the guidance store so InspectorGuidanceSection
  // can trigger sendMessage and scrollToPatch without prop drilling through InspectorModal.
  // Clear on unmount so stale closures don't execute after the panel is gone.
  useEffect(() => {
    useGuidanceStore.getState().registerConversationCallbacks(sendMessage, handleScrollToPatch)
    return () => {
      useGuidanceStore.setState({ _sendMessage: null, _scrollToPatch: null })
    }
  }, [sendMessage, handleScrollToPatch])

  // ActionStrip navigation handler
  const handleNavigate = useCallback((target: NavigateTarget) => {
    switch (target) {
      case 'guidance':
        usePanelsStore.getState().setShowIssuesPanel(true)
        break
      case 'patch': {
        // Scroll to the first *pending* patch block (not any accepted/dismissed one)
        let targetPatchId: string | null = null
        for (const msg of messages) {
          if (targetPatchId) break
          if (!msg.blocks) continue
          for (const block of msg.blocks) {
            if (block.type !== 'graph_patch') continue
            const pb = block as GraphPatchBlock
            const key = msg.id ? `${msg.id}:${pb.patch_id}` : pb.patch_id
            if ((patchBlockStates.get(key) ?? 'proposed') === 'proposed') {
              targetPatchId = pb.patch_id
              break
            }
          }
        }
        if (targetPatchId) {
          const el = listRef.current?.querySelector(`[data-testid="block-graph-patch-${targetPatchId}"]`)
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        }
        break
      }
      case 'results':
        usePanelsStore.getState().setShowResultsPanel(true)
        break
      case 'brief': {
        // Scroll to last brief block in conversation
        const briefs = listRef.current?.querySelectorAll('[data-testid="block-brief"]')
        const last = briefs?.[briefs.length - 1]
        if (last) last.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        break
      }
    }
  }, [messages, patchBlockStates])

  return (
    <>
      {/* Action strip — ambient awareness bar above message list */}
      <ActionStrip
        messages={messages}
        patchBlockStates={patchBlockStates}
        onNavigate={handleNavigate}
      />

      {/* Brief readiness row — framing stage only, minimal vertical footprint */}
      {isFramingStage(stage) && briefSignals && (
        <div className="flex items-center gap-2 px-4 py-1" data-testid="readiness-row">
          <ReadinessPill signals={briefSignals} briefText={debouncedInput} />
          <BiasAlertIcon bias={briefSignals.bias_detected} />
        </div>
      )}

      {/* Message list */}
      <div
        ref={listRef}
        className={styles.messageList}
        onScroll={handleScroll}
        role="log"
        aria-label="Conversation"
        aria-live="polite"
      >
        {showWelcome && (
          <div className={styles.welcomeMessage} data-testid="welcome-message">
            <p className={typography.body}>{WELCOME_TEXT}</p>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            onChipClick={handleChipClick}
            patchBlockStates={patchBlockStates}
            patchRejections={patchRejections}
            onPatchAccept={handlePatchAccept}
            onPatchDismiss={handlePatchDismiss}
            onFeedback={handleFeedback}
          />
        ))}

        {isThinking && (
          <div className={styles.typingIndicator} data-testid="typing-indicator">
            <span className={styles.typingDot} />
            <span className={styles.typingDot} />
            <span className={styles.typingDot} />
            {longRunningHint && (
              <span className={styles.longRunningHint}>{longRunningHint}</span>
            )}
          </div>
        )}

        {showNewMessageIndicator && (
          <button
            type="button"
            className={styles.newMessageIndicator}
            onClick={scrollToBottom}
            data-testid="new-message-indicator"
          >
            New message ↓
          </button>
        )}

        <div ref={listEndRef} />
      </div>

      {/* Guidance strip — next best step, above input */}
      <GuidanceStrip
        onSendMessage={sendMessage}
        onSetActive={setActiveGuidanceItem}
        onScrollToPatch={handleScrollToPatch}
        onOpenInspector={handleOpenInspector}
      />

      {/* Input bar */}
      <div className={styles.inputBar}>
        <GrowingInput
          value={inputValue}
          onChange={setInputValue}
          onSend={handleSend}
          onCollapse={onCollapse}
          disabled={isThinking}
          placeholder={inputPlaceholder}
        />
        <button
          type="button"
          className={canSend ? styles.sendButtonActive : styles.sendButtonDisabled}
          onClick={handleSend}
          disabled={!canSend}
          aria-label="Send message"
          title="Press Enter to send"
        >
          {isThinking ? (
            <div className={styles.sendButtonSpinner} />
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
      </div>
    </>
  )
})
