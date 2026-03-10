/**
 * hydrateThread -- Convert persisted ThreadEntry[] into ConversationMessage[] for display.
 *
 * Track 3: Read path for thread persistence. Reconstructs the conversation
 * from persisted entries, including block state, stale detection, and
 * session boundary markers.
 *
 * Entries skipped during hydration:
 * - origin: 'block_action' (audit records, not visual messages)
 * - redaction_state: 'hash_only' (nothing to display)
 */

import type { ConversationMessage, ConversationBlock, GraphPatchBlock } from '../types'
import type { PatchBlockState } from '../useConversation'
import type {
  ThreadEntry,
  PersistedBlock,
  BlockState,
} from '../../journey/threadTypes'

// ---------------------------------------------------------------------------
// Result shape
// ---------------------------------------------------------------------------

export interface HydrationResult {
  messages: ConversationMessage[]
  blockStates: Map<string, PatchBlockState>
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Map persisted BlockState to the UI's PatchBlockState.
 * applied/stale/superseded are collapsed into accepted/dismissed.
 */
function toUiBlockState(state: BlockState): PatchBlockState {
  switch (state) {
    case 'proposed': return 'proposed'
    case 'accepted':
    case 'applied': return 'accepted'
    case 'dismissed':
    case 'stale':
    case 'superseded': return 'dismissed'
    case 'rejected': return 'rejected'
    default: return 'proposed'
  }
}

/**
 * Reconstruct a ConversationBlock from a PersistedBlock.
 * The content field holds the original block data (minus the `type` discriminator).
 */
function toConversationBlock(pb: PersistedBlock): ConversationBlock {
  const base = pb.content ?? {}

  switch (pb.block_type) {
    case 'graph_patch':
      return {
        type: 'graph_patch',
        patch_id: (base.patch_id as string) ?? pb.block_id,
        summary: (base.summary as string) ?? '',
        operations: Array.isArray(base.operations) ? base.operations as GraphPatchBlock['operations'] : [],
        target_graph_hash: (base.target_graph_hash as string) ?? '',
        auto_apply: base.auto_apply as boolean | undefined,
        block_id: pb.block_id,
        graph_hash_at_proposal: (base.graph_hash_at_proposal as string) ?? (base.target_graph_hash as string) ?? undefined,
      }

    case 'commentary':
      return {
        type: 'commentary',
        text: (base.text as string) ?? '',
        tone: base.tone as 'neutral' | 'warning' | 'positive' | undefined,
      }

    case 'review_card':
      return {
        type: 'review_card',
        title: (base.title as string) ?? '',
        body: (base.body as string) ?? '',
        variant: (base.variant as 'info' | 'alert') ?? 'info',
        priority: base.priority as 'critical' | 'high' | 'medium' | 'low' | undefined,
      }

    case 'fact':
      return {
        type: 'fact',
        label: (base.label as string) ?? '',
        value: (base.value as string) ?? '',
        source: base.source as string | undefined,
      }

    case 'framing':
      return {
        type: 'framing',
        goal: (base.goal as string) ?? '',
        options: Array.isArray(base.options) ? base.options as string[] : [],
        constraints: Array.isArray(base.constraints) ? base.constraints as string[] : undefined,
        key_risks: Array.isArray(base.key_risks) ? base.key_risks as string[] : undefined,
      }

    case 'brief':
      return {
        type: 'brief',
        title: (base.title as string) ?? '',
        summary: (base.summary as string) ?? '',
        brief_url: base.brief_url as string | undefined,
      }

    default:
      // Unknown block type: render as commentary fallback
      return {
        type: 'commentary',
        text: `[${pb.block_type}] ${(base.summary as string) ?? (base.text as string) ?? ''}`.trim(),
        tone: 'neutral',
      }
  }
}

/**
 * Determine if a proposed block is stale by comparing graph hashes.
 */
function isBlockStale(
  pb: PersistedBlock,
  currentGraphHash: string | undefined,
): boolean {
  if (!currentGraphHash) return false
  if (pb.state !== 'proposed') return false
  const blockHash =
    (pb.content?.target_graph_hash as string) ??
    (pb.content?.graph_hash_at_proposal as string)
  if (!blockHash) return false
  return blockHash !== currentGraphHash
}

// ---------------------------------------------------------------------------
// Main mapper
// ---------------------------------------------------------------------------

/**
 * Convert persisted thread entries into the conversation panel's internal format.
 *
 * @param thread - Raw ThreadEntry[] from scenario row
 * @param currentGraphHash - Current analysis_provenance.graph_hash (for stale detection)
 */
export function hydrateMessagesFromThread(
  thread: ThreadEntry[],
  currentGraphHash: string | undefined,
): HydrationResult {
  const messages: ConversationMessage[] = []
  const blockStates = new Map<string, PatchBlockState>()

  // Sort by seq (server-assigned order)
  const sorted = [...thread].sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0))

  for (const entry of sorted) {
    // Skip block_action audit entries (visual state handled via in-place block state)
    if (entry.origin === 'block_action') continue
    // Skip hash_only entries (nothing to display)
    if (entry.redaction_state === 'hash_only') continue

    const msgId = `hydrated-${entry.entry_id}`
    const timestamp = entry.timestamp ? new Date(entry.timestamp) : new Date()

    // ── Session boundary ───────────────────────────────────────────────
    if (entry.origin === 'session_boundary') {
      messages.push({
        id: msgId,
        role: 'assistant', // Arbitrary; rendered as divider, not bubble
        content: '',
        timestamp,
        synthetic: true,
        sessionDivider: entry.system_event_detail ?? formatSessionTime(timestamp),
        _threadMeta: {
          entryId: entry.entry_id,
          origin: entry.origin,
          entryStatus: entry.entry_status,
          redactionState: entry.redaction_state,
        },
      })
      continue
    }

    // ── System events ──────────────────────────────────────────────────
    if (entry.role === 'system') {
      // Render as a visual marker (centred muted text, like session divider)
      const detail = entry.system_event_detail ?? entry.system_event_type ?? 'System event'
      messages.push({
        id: msgId,
        role: 'assistant',
        content: '',
        timestamp,
        synthetic: true,
        sessionDivider: detail,
        _threadMeta: {
          entryId: entry.entry_id,
          origin: entry.origin,
          entryStatus: entry.entry_status,
          redactionState: entry.redaction_state,
        },
      })
      continue
    }

    // ── User messages ──────────────────────────────────────────────────
    if (entry.role === 'user') {
      let content: string
      if (entry.redaction_state === 'redacted') {
        content = 'Message content not stored'
      } else {
        content = entry.user_message ?? ''
      }

      messages.push({
        id: msgId,
        role: 'user',
        content,
        timestamp,
        clientTurnId: entry.turn_id,
        _threadMeta: {
          entryId: entry.entry_id,
          origin: entry.origin,
          entryStatus: entry.entry_status,
          redactionState: entry.redaction_state,
        },
      })
      continue
    }

    // ── Assistant messages ──────────────────────────────────────────────
    if (entry.role === 'assistant') {
      let content: string
      const blocks: ConversationBlock[] = []

      if (entry.redaction_state === 'redacted') {
        const blockCount = entry.blocks?.length ?? 0
        content = blockCount > 0
          ? `AI responded with ${blockCount} suggestion${blockCount !== 1 ? 's' : ''}`
          : 'AI response content not stored'
      } else if (entry.entry_status === 'partial') {
        content = entry.assistant_text ?? 'Incomplete response'
      } else if (entry.entry_status === 'failed') {
        content = entry.assistant_text ?? 'Response failed'
      } else {
        content = entry.assistant_text ?? ''
      }

      // Reconstruct blocks (only for complete, non-redacted entries)
      if (entry.blocks && entry.entry_status === 'complete' && entry.redaction_state === 'full') {
        for (const pb of entry.blocks) {
          const convBlock = toConversationBlock(pb)
          blocks.push(convBlock)

          // Set block state for graph_patch blocks
          if (pb.block_type === 'graph_patch') {
            const patchId = (pb.content?.patch_id as string) ?? pb.block_id
            const stateKey = `${msgId}:${patchId}`

            if (isBlockStale(pb, currentGraphHash)) {
              blockStates.set(stateKey, 'dismissed')
            } else {
              blockStates.set(stateKey, toUiBlockState(pb.state))
            }
          }
        }
      }

      // For redacted entries, render block type labels only
      if (entry.blocks && entry.redaction_state === 'redacted') {
        for (const pb of entry.blocks) {
          blocks.push({
            type: 'commentary',
            text: `[${pb.block_type}] ${toUiBlockState(pb.state)}`,
            tone: 'neutral',
          })
        }
      }

      // Note: actionChips are intentionally NOT hydrated here.
      // The persisted SuggestedAction schema stores only { action_id, label, taken } —
      // the `message` field (wire dispatch payload) is not persisted to the database.
      // Without `message`, chips cannot be dispatched and would be filtered by both
      // ActionChipRow and SuggestedChips render guards. Chips only appear on live responses.
      messages.push({
        id: msgId,
        role: 'assistant',
        content,
        blocks: blocks.length > 0 ? blocks : undefined,
        timestamp,
        clientTurnId: entry.turn_id,
        _threadMeta: {
          entryId: entry.entry_id,
          origin: entry.origin,
          entryStatus: entry.entry_status,
          redactionState: entry.redaction_state,
        },
      })
    }
  }

  return { messages, blockStates }
}

// ---------------------------------------------------------------------------
// Session boundary formatting
// ---------------------------------------------------------------------------

/**
 * Format a session boundary timestamp.
 * Returns "Session resumed - 7 Mar, 14:22" format.
 */
export function formatSessionBoundary(date: Date): string {
  const day = date.getDate()
  const month = date.toLocaleString('en-GB', { month: 'short' })
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `Session resumed - ${day} ${month}, ${hours}:${minutes}`
}

function formatSessionTime(date: Date): string {
  const day = date.getDate()
  const month = date.toLocaleString('en-GB', { month: 'short' })
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${day} ${month}, ${hours}:${minutes}`
}
