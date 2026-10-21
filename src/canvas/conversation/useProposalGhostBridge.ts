/**
 * Suggestion preview: the bridge from the conversation to the canvas ghost (DL ruling 5941839936).
 *
 * The ghost follows the latest reply's preview, while its consent chip is still offered (`previewOfLatestReply`).
 * A later reply (Accept, decline, amend, any new turn) or a reload (which keeps no preview) clears it; so does
 * unmounting the thread.
 */
import { useEffect, useMemo } from 'react'
import { consentChipsFor, previewOfLatestReply } from './proposalPreview'
import { useProposalGhostStore } from '../stores/proposalGhostStore'
import type { ConversationMessage } from './types'

export function useProposalGhostBridge(messages: readonly ConversationMessage[]): void {
  const preview = useMemo(() => previewOfLatestReply(messages), [messages])
  // The chips the chat card presses, for the ghost's own buttons (same objects, same path).
  const chips = useMemo(() => (preview === null ? null : consentChipsFor(messages, preview.proposalId)), [messages, preview])
  useEffect(() => {
    if (preview === null) return
    const { showGhost, clearGhost } = useProposalGhostStore.getState()
    showGhost(preview, chips)
    return () => clearGhost(preview.proposalId)
  }, [preview, chips])
}
