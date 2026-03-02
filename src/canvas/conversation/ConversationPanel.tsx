/**
 * ConversationPanel — Multi-turn conversation surface
 *
 * Renders inside DraftChat's expanded panel when VITE_ENABLE_ORCHESTRATOR_V2
 * is ON. Shows a scrollable message list, typing indicator, inline blocks,
 * action chips, and a growing single-line input.
 */

import { useRef, useEffect, useState, useCallback, memo } from 'react'
import { typography } from '../../styles/typography'
import { useCanvasStore } from '../store'
import { MessageBubble } from './MessageBubble'
import { GrowingInput } from './GrowingInput'
import type { ActionChip, GraphPatchBlock, PatchOperation } from './types'
import type { UseConversationReturn, PatchRejectionInfo } from './useConversation'
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
    async (patchId: string, block: GraphPatchBlock) => {
      const stateKey = block.patch_id // turnId not available here, use patch_id
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
            payload: { patch_id: patchId, reason: 'unsupported_operation' },
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
            // Accept either key name (endpoint shape not yet finalised).
            const validatedGraph = result.graph ?? result.validated_graph
            if (validatedGraph?.nodes && validatedGraph?.edges) {
              const store = useCanvasStore.getState()
              store.pushHistory()
              useCanvasStore.setState({
                nodes: validatedGraph.nodes,
                edges: validatedGraph.edges,
              })
            } else {
              // Fallback: replay ops locally
              applyPatchOperations(block.operations, () => useCanvasStore.getState())
            }

            setPatchBlockState(stateKey, 'accepted')
            sendSystemEvent({
              type: 'patch_accepted',
              payload: { patch_id: patchId },
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
              payload: { patch_id: patchId, reason: 'validation_failed' },
            })
          }
        } else {
          // No validate-patch endpoint — apply directly (optimistic)
          applyPatchOperations(block.operations, () => useCanvasStore.getState())
          setPatchBlockState(stateKey, 'accepted')
          sendSystemEvent({
            type: 'patch_accepted',
            payload: { patch_id: patchId },
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
    (patchId: string) => {
      setPatchBlockState(patchId, 'dismissed')
      sendSystemEvent({
        type: 'patch_dismissed',
        payload: { patch_id: patchId },
      })
    },
    [setPatchBlockState, sendSystemEvent],
  )

  const canSend = inputValue.trim().length > 0 && !isThinking

  return (
    <>
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

      {/* Input bar */}
      <div className={styles.inputBar}>
        <GrowingInput
          value={inputValue}
          onChange={setInputValue}
          onSend={handleSend}
          onCollapse={onCollapse}
          disabled={isThinking}
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
