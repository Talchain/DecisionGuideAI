/**
 * Thread Persistence Service -- Track 2 of 3
 *
 * Wraps the append_thread_entries and update_thread_block_state RPCs.
 * Best-effort: logs errors and returns null/void, never throws.
 * All calls are gated by the threadPersist feature flag.
 */

import { supabase } from '../lib/supabase'
import { isThreadPersistEnabled } from '../flags'
import type {
  ThreadEntry,
  ThreadEntryInput,
  BlockState,
} from '../canvas/journey/threadTypes'

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
