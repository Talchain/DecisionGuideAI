/**
 * Suggestion preview: the bridge from the conversation to the canvas ghost (DL ruling 5941839936).
 *
 * The ghost follows the latest reply's preview, while its consent chip is still offered (`previewOfLatestReply`).
 * A later reply (Accept, decline, amend, any new turn) or a reload (which keeps no preview) clears it; so does
 * unmounting the thread.
 */
import { useEffect, useMemo } from 'react'
import { previewOfLatestReply } from './proposalPreview'
import { useProposalGhostStore } from '../stores/proposalGhostStore'
import type { ConversationMessage } from './types'

export function useProposalGhostBridge(messages: readonly ConversationMessage[]): void {
  const preview = useMemo(() => previewOfLatestReply(messages), [messages])
  useEffect(() => {
    if (preview === null) return
    const { showGhost, clearGhost } = useProposalGhostStore.getState()
    showGhost(preview)
    return () => clearGhost(preview.proposalId)
  }, [preview])
}
