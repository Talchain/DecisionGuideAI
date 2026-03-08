/**
 * useThreadPersistence -- Track 2 of 3
 *
 * Captures conversation activity and writes thread entries to Supabase.
 * Best-effort: never affects conversation UI on failure.
 *
 * Integration: called from ConversationPanel with messages + scenarioId.
 * Observes new messages via ref diff, constructs ThreadEntry objects,
 * buffers with 2s debounce, flushes via appendThreadEntries RPC.
 */

import { useRef, useEffect, useCallback } from 'react'
import { isThreadPersistEnabled } from '../../../flags'
import { getUserId } from '../../../lib/supabase'
import { appendThreadEntries, updateThreadBlockState } from '../../../services/threadService'
import type {
  ThreadEntryInput,
  PersistedBlock,
  SuggestedAction,
  BlockType,
  BlockState,
} from '../../journey/threadTypes'
import type { ConversationMessage, ConversationBlock, ActionChip } from '../types'

// ---------------------------------------------------------------------------
// Helpers: map conversation types to thread persistence types
// ---------------------------------------------------------------------------

function mapBlockType(type: ConversationBlock['type']): BlockType {
  // ConversationBlock types map 1:1 to BlockType
  return type as BlockType
}

function toPersistedBlock(block: ConversationBlock): PersistedBlock {
  const { type, ...content } = block
  // Use block_id or patch_id if available, otherwise generate
  const blockId =
    ('block_id' in block && typeof block.block_id === 'string' && block.block_id) ||
    ('patch_id' in block && typeof block.patch_id === 'string' && block.patch_id) ||
    crypto.randomUUID()

  return {
    block_id: blockId,
    block_type: mapBlockType(type),
    content_schema_version: 1,
    content: content as Record<string, unknown>,
    state: 'proposed',
  }
}

function toSuggestedAction(chip: ActionChip): SuggestedAction {
  return {
    action_id: chip.id,
    label: chip.label,
    taken: false,
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const DEBOUNCE_MS = 2_000
const MAX_CONSECUTIVE_FAILURES = 3

export function useThreadPersistence(
  scenarioId: string | null | undefined,
  messages: ConversationMessage[],
): {
  onBlockAction: (
    messageId: string,
    blockId: string,
    newState: BlockState,
    detail?: string,
  ) => void
  onChipTaken: (messageId: string, chipId: string) => void
} {
  // Refs for buffer management (survive re-renders)
  const bufferRef = useRef<ThreadEntryInput[]>([])
  const persistedIdsRef = useRef<Set<string>>(new Set())
  const messageToEntryIdRef = useRef<Map<string, string>>(new Map())
  const prevMessageCountRef = useRef(0)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const consecutiveFailuresRef = useRef(0)
  const cachedUserIdRef = useRef<string | undefined>(undefined)
  const scenarioIdRef = useRef(scenarioId)
  scenarioIdRef.current = scenarioId

  // Cache user ID on first call
  const resolveUserId = useCallback(async (): Promise<string | undefined> => {
    if (cachedUserIdRef.current) return cachedUserIdRef.current
    const uid = await getUserId()
    if (uid) cachedUserIdRef.current = uid
    return uid ?? undefined
  }, [])

  // Flush buffered entries to Supabase
  const flush = useCallback(async () => {
    const sid = scenarioIdRef.current
    if (!sid || bufferRef.current.length === 0) return
    if (consecutiveFailuresRef.current >= MAX_CONSECUTIVE_FAILURES) return

    const entries = [...bufferRef.current]
    bufferRef.current = []

    const result = await appendThreadEntries(sid, entries)
    if (result) {
      consecutiveFailuresRef.current = 0
      for (const entry of result) {
        persistedIdsRef.current.add(entry.entry_id)
      }
    } else {
      // Put entries back for retry
      consecutiveFailuresRef.current += 1
      bufferRef.current = [...entries, ...bufferRef.current]
      if (consecutiveFailuresRef.current >= MAX_CONSECUTIVE_FAILURES) {
        console.warn('[ThreadPersistence] Stopped retrying after 3 consecutive failures')
      }
    }
  }, [])

  // Schedule debounced flush
  const scheduleFlush = useCallback(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    debounceTimerRef.current = setTimeout(flush, DEBOUNCE_MS)
  }, [flush])

  // Enqueue an entry for persistence
  const enqueue = useCallback(
    (entry: ThreadEntryInput) => {
      if (persistedIdsRef.current.has(entry.entry_id)) return
      bufferRef.current.push(entry)
      scheduleFlush()
    },
    [scheduleFlush],
  )

  // Observe new messages via count diff
  useEffect(() => {
    if (!isThreadPersistEnabled() || !scenarioId) return
    if (messages.length <= prevMessageCountRef.current) {
      prevMessageCountRef.current = messages.length
      return
    }

    const newMessages = messages.slice(prevMessageCountRef.current)
    prevMessageCountRef.current = messages.length

    // Process new messages async (need user ID)
    void (async () => {
      const userId = await resolveUserId()

      for (const msg of newMessages) {
        // Skip synthetic messages (welcome, error, undo confirmations)
        if (msg.synthetic) continue

        const entryId = crypto.randomUUID()
        messageToEntryIdRef.current.set(msg.id, entryId)

        if (msg.role === 'user') {
          enqueue({
            entry_id: entryId,
            entry_schema_version: 1,
            role: 'user',
            origin: 'conversation',
            actor_user_id: userId,
            entry_status: 'complete',
            user_message: msg.content,
            turn_id: msg.clientTurnId,
            redaction_state: 'full',
          })
        } else if (msg.role === 'assistant') {
          const blocks = msg.blocks?.map(toPersistedBlock)
          const suggestedActions = msg.actionChips?.map(toSuggestedAction)

          enqueue({
            entry_id: entryId,
            entry_schema_version: 1,
            role: 'assistant',
            origin: 'conversation',
            entry_status: 'complete',
            assistant_text: msg.content || undefined,
            blocks: blocks && blocks.length > 0 ? blocks : undefined,
            suggested_actions:
              suggestedActions && suggestedActions.length > 0
                ? suggestedActions
                : undefined,
            turn_id: msg.clientTurnId,
            redaction_state: 'full',
          })
        }
      }
    })()
  }, [messages, scenarioId, enqueue, resolveUserId])

  // Flush on unmount and beforeunload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (bufferRef.current.length > 0 && scenarioIdRef.current) {
        // Best-effort: fire async call, browser may or may not complete it
        void appendThreadEntries(scenarioIdRef.current, bufferRef.current)
        bufferRef.current = []
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      // Flush remaining entries on unmount
      void flush()
    }
  }, [flush])

  // Reset state on scenario change
  useEffect(() => {
    persistedIdsRef.current.clear()
    messageToEntryIdRef.current.clear()
    prevMessageCountRef.current = 0
    bufferRef.current = []
    consecutiveFailuresRef.current = 0
  }, [scenarioId])

  // Block action callback
  const onBlockAction = useCallback(
    async (
      messageId: string,
      blockId: string,
      newState: BlockState,
      detail?: string,
    ) => {
      if (!isThreadPersistEnabled() || !scenarioId) return

      // 1. In-place state update on the original assistant entry
      const originalEntryId = messageToEntryIdRef.current.get(messageId)
      if (originalEntryId) {
        void updateThreadBlockState(scenarioId, originalEntryId, blockId, newState)
      }

      // 2. Append block_action origin entry
      const userId = await resolveUserId()
      enqueue({
        entry_id: crypto.randomUUID(),
        entry_schema_version: 1,
        role: 'user',
        origin: 'block_action',
        actor_user_id: userId,
        entry_status: 'complete',
        system_event_detail: detail ?? `Block ${blockId} ${newState}`,
        related_event_ids: originalEntryId ? [originalEntryId] : undefined,
        redaction_state: 'full',
      })
    },
    [scenarioId, enqueue, resolveUserId],
  )

  // Suggested action tracking callback
  const onChipTaken = useCallback(
    async (messageId: string, chipId: string) => {
      if (!isThreadPersistEnabled() || !scenarioId) return

      // Find the entry in the buffer or mark for update on next flush.
      // For entries already persisted, we'd need a separate RPC to update
      // suggested_actions in-place. For the PoC, we track via a block_action entry.
      const entryId = messageToEntryIdRef.current.get(messageId)
      if (!entryId) return

      // Update the buffered entry if it's still in the buffer
      const buffered = bufferRef.current.find((e) => e.entry_id === entryId)
      if (buffered?.suggested_actions) {
        const action = buffered.suggested_actions.find((a) => a.action_id === chipId)
        if (action) {
          action.taken = true
          action.taken_at = new Date().toISOString()
        }
      }

      // Also log as a block_action entry for audit trail
      const userId = await resolveUserId()
      enqueue({
        entry_id: crypto.randomUUID(),
        entry_schema_version: 1,
        role: 'user',
        origin: 'block_action',
        actor_user_id: userId,
        entry_status: 'complete',
        system_event_detail: `Suggested action taken: ${chipId}`,
        related_event_ids: [entryId],
        redaction_state: 'full',
      })
    },
    [scenarioId, enqueue, resolveUserId],
  )

  return { onBlockAction, onChipTaken }
}
