/**
 * Thread Persistence Service -- Track 2 of 3
 *
 * Wraps the append_thread_entries and update_thread_block_state RPCs
 * plus BIL Phase 1 normalised persistence (create_snapshot, insert_conversation_turn).
 * Best-effort: logs errors and returns null/void, never throws.
 * Legacy thread calls are gated by the threadPersist feature flag.
 * Normalised persistence (snapshots, turns) is always-on.
 */

import { supabase } from '../lib/supabase'
import { isThreadPersistEnabled } from '../flags'
import type {
  ThreadEntry,
  ThreadEntryInput,
  BlockState,
} from '../canvas/journey/threadTypes'
import type { ConversationBlock } from '../canvas/conversation/types'

// ---------------------------------------------------------------------------
// append_thread_entries
// ---------------------------------------------------------------------------

/**
 * Batch-append thread entries to a scenario.
 * Returns entries with server-assigned seq/timestamp, or null on failure.
 * Returns null immediately if the feature flag is off.
 */
export async function appendThreadEntries(
  scenarioId: string,
  entries: ThreadEntryInput[],
): Promise<ThreadEntry[] | null> {
  if (!isThreadPersistEnabled()) return null
  if (!scenarioId || entries.length === 0) return null

  try {
    const { data, error } = await supabase.rpc('append_thread_entries', {
      p_scenario_id: scenarioId,
      p_entries: entries as unknown as Record<string, unknown>,
    })

    if (error) {
      console.warn('[ThreadService] append_thread_entries failed:', error.message)
      return null
    }

    // RPC returns JSONB array of entries with seq/timestamp
    return (data as unknown as ThreadEntry[]) ?? null
  } catch (err) {
    console.warn('[ThreadService] append_thread_entries exception:', err)
    return null
  }
}

// ---------------------------------------------------------------------------
// update_thread_block_state
// ---------------------------------------------------------------------------

/**
 * Update a block's state in-place within a thread entry.
 * Best-effort: logs errors, never throws.
 * Returns immediately if the feature flag is off.
 */
export async function updateThreadBlockState(
  scenarioId: string,
  entryId: string,
  blockId: string,
  newState: BlockState,
): Promise<void> {
  if (!isThreadPersistEnabled()) return
  if (!scenarioId || !entryId || !blockId) return

  try {
    const { error } = await supabase.rpc('update_thread_block_state', {
      p_scenario_id: scenarioId,
      p_entry_id: entryId,
      p_block_id: blockId,
      p_new_state: newState,
    })

    if (error) {
      console.warn('[ThreadService] update_thread_block_state failed:', error.message)
    }
  } catch (err) {
    console.warn('[ThreadService] update_thread_block_state exception:', err)
  }
}

// ---------------------------------------------------------------------------
// BIL Phase 1: Normalised persistence (always-on, not flag-gated)
// ---------------------------------------------------------------------------

/**
 * Create an immutable snapshot of graph + analysis state.
 * Returns the snapshot UUID, or null on failure.
 * Best-effort: never throws.
 */
export async function createSnapshot(params: {
  scenarioId: string
  graph: unknown
  graphHash: string
  analysis?: unknown
  briefText?: string
  briefHash?: string
  seed?: number
  qualityMode?: string
}): Promise<string | null> {
  if (!params.scenarioId) return null

  try {
    const { data, error } = await supabase.rpc('create_snapshot', {
      p_scenario_id: params.scenarioId,
      p_graph: params.graph as Record<string, unknown>,
      p_graph_hash: params.graphHash,
      p_analysis: (params.analysis as Record<string, unknown>) ?? null,
      p_brief_text: params.briefText ?? null,
      p_brief_hash: params.briefHash ?? null,
      p_seed: params.seed ?? null,
      p_quality_mode: params.qualityMode ?? null,
    })

    if (error) {
      console.warn('[ThreadService] create_snapshot failed:', error.message)
      return null
    }

    return (data as string) ?? null
  } catch (err) {
    console.warn('[ThreadService] create_snapshot exception:', err)
    return null
  }
}

/**
 * Insert a single conversation turn into the normalised table.
 * Uses client_turn_id for idempotency (ON CONFLICT DO NOTHING).
 * Returns the turn UUID (null if deduplicated or on failure).
 * Best-effort: never throws.
 */
/** Scenario IDs that returned 403 — suppress further insertConversationTurn calls */
const _suppressedScenarioIds = new Set<string>()

/** Clear suppression for a scenario (e.g. after successful persistence) */
export function clearSuppressedScenarioId(id: string): void {
  _suppressedScenarioIds.delete(id)
}

export async function insertConversationTurn(params: {
  scenarioId: string
  role: 'user' | 'assistant' | 'system'
  content?: string
  structuredBlocks?: ConversationBlock[]
  snapshotId?: string
  analysisSnapshotId?: string
  clientTurnId?: string
}): Promise<string | null> {
  if (!params.scenarioId) return null
  if (_suppressedScenarioIds.has(params.scenarioId)) return null

  try {
    const { data, error } = await supabase.rpc('insert_conversation_turn', {
      p_scenario_id: params.scenarioId,
      p_role: params.role,
      p_content: params.content ?? null,
      p_structured_blocks: (params.structuredBlocks as unknown as Record<string, unknown>) ?? null,
      p_snapshot_id: params.snapshotId ?? null,
      p_analysis_snapshot_id: params.analysisSnapshotId ?? null,
      p_client_turn_id: params.clientTurnId ?? null,
    })

    if (error) {
      // Suppress future calls for unpersisted scenarios (403/forbidden)
      if (error.code === '42501' || error.message?.includes('forbidden') || error.message?.includes('not owned')) {
        _suppressedScenarioIds.add(params.scenarioId)
        if (import.meta.env.DEV) {
          console.debug('[ThreadService] Suppressing insertConversationTurn for unpersisted scenario:', params.scenarioId)
        }
      } else {
        console.warn('[ThreadService] insert_conversation_turn failed:', error.message)
      }
      return null
    }

    return (data as string) ?? null
  } catch (err) {
    console.warn('[ThreadService] insert_conversation_turn exception:', err)
    return null
  }
}
