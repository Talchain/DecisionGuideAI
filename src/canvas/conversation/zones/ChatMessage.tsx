/**
 * ChatMessage — wraps MessageBubble with its one inline overflow control.
 *
 * ⛔ THE HOVER ACTION BAR IS GONE, and this header used to describe it
 * ("Tailwind `group` + `group-hover:opacity-100` to show MessageActions on
 * hover"). That bar was absolutely positioned, which is why every message
 * paid a 32px reserved gutter to keep it off the first line of text. Its four
 * actions now live in `MessageMenu`, inline and always present — so there is
 * no band to reserve and no hover state to discover. The `group` class stays:
 * inner surfaces still use it.
 *
 * ⛔ AND `isFirst` IS GONE WITH IT, because it was already dead and this file
 * was the only thing keeping it alive. `MessageActions` had carried
 * `/** @deprecated No longer used — kept for caller compatibility. *\/` on that
 * prop; this component still threaded it down, and `ChatThread` still computed
 * `i === 0` to supply it. A prop nobody reads, passed through one hop, reads to
 * the next person as a live positioning input. Removing the bar made it
 * UNUSED rather than merely pointless, and the typecheck ratchet said so.
 *
 * Messages are categorised (action, research, error, answer) via
 * data-message-category for test/automation selectors.
 */

import { memo } from 'react'
import { MessageBubble } from '../MessageBubble'
import type { HeldProposalSettlement } from '../../../v5/blocks/V5HeldProposalBlock'
import { MessageMenu } from './MessageMenu'
import { MESSAGE_ID_ATTRIBUTE } from '../hooks/useSmartScroll'
import type { ConversationMessage, ActionChip, GraphPatchBlock } from '../types'
import type { PatchBlockState, PatchRejectionInfo } from '../useConversation'

type MessageCategory = 'answer' | 'action' | 'research' | 'error'

/** Derive visual category from message content and metadata. */
function getMessageCategory(msg: ConversationMessage): MessageCategory {
  if (msg.role === 'user') return 'answer'
  if (msg.synthetic && msg.actionChips?.some(c => c.id === 'retry')) return 'error'
  if (!msg.blocks?.length) return 'answer'
  if (msg.blocks.some(b => b.type === 'graph_patch')) return 'action'
  if (msg.blocks.some(b => b.type === 'evidence' || b.type === 'fact')) return 'research'
  return 'answer'
}

const CATEGORY_BORDER: Record<MessageCategory, string> = {
  answer: '',
  action: '',
  research: '',
  error: '',
}

interface ChatMessageProps {
  message: ConversationMessage
  onChipClick: (chip: ActionChip) => Promise<void>
  onRetry: () => void
  patchBlockStates?: Map<string, PatchBlockState>
  patchRejections?: Map<string, PatchRejectionInfo>
  onPatchAccept?: (patchId: string, block: GraphPatchBlock) => void
  onPatchDismiss?: (patchId: string) => void
  onFeedback?: (turnId: string, rating: 'up' | 'down') => void
  onArtefactMessage?: (message: string) => void
  onProposalConfirm?: (proposalId: string) => void
  /** SENDABLE failure 5 — record a held proposal's settlement in the shared
   *  `patchBlockStates` registry, for every copy on screen when the user acts:
   *  both surfaces, and every earlier turn re-issuing the same handle. */
  onHeldProposalSettle?: (
    proposalId: string,
    settlement: HeldProposalSettlement,
    turnId?: string,
  ) => void
  /** AI panel v2 surface — render message body at panelBody (12px). */
  compact?: boolean
  /**
   * Transcript honesty (trust item #3): when true, this failed user message
   * is the one retryLast would resend — wire onRetry as the message's own
   * retry affordance. ChatThread sets this for at most ONE message.
   */
  showFailedSendRetry?: boolean
  /**
   * L-42: is this the NEWEST assistant turn? Only that turn's applied-edit card
   * may claim the staleness voice — see `stalenessVoice.ts`. ChatThread already
   * computes this identity (`msg === lastAssistantMsg`) for the chip row, so it
   * is threaded rather than re-derived.
   */
  isLatestAssistantTurn?: boolean
}

export const ChatMessage = memo(function ChatMessage({
  message,
  onChipClick,
  onRetry,
  patchBlockStates,
  patchRejections,
  onPatchAccept,
  onPatchDismiss,
  onFeedback,
  onArtefactMessage,
  onProposalConfirm,
  onHeldProposalSettle,
  compact,
  showFailedSendRetry,
  isLatestAssistantTurn = false,
}: ChatMessageProps) {
  const category = getMessageCategory(message)
  const borderClass = CATEGORY_BORDER[category]

  return (
    <div
      className={`group relative pointer-events-auto ${borderClass}`}
      /*
       * ⭐ THE 32px ACTION GUTTER IS GONE, and removing the REASON for it is
       * the point rather than the removal itself. L-73 reserved this band
       * unconditionally because the floating action bar was absolutely
       * positioned and would otherwise sit on the message's first line, and
       * opening the band on hover would reflow the thread under the pointer.
       * Both were correct given a floating bar. `MessageMenu` is INLINE, so
       * there is nothing to reserve space for — and a thread of N messages
       * gets back 32·N px of vertical space it was spending on emptiness.
       */
      style={{ marginBottom: 12 }}
      data-testid={`chat-message-${message.role}`}
      data-message-category={category !== 'answer' ? category : undefined}
      /* How `useSmartScroll` finds an arriving reply by identity, to put its
         first line at the top of the thread. */
      {...{ [MESSAGE_ID_ATTRIBUTE]: message.id }}
    >

      <MessageBubble
        message={message}
        onChipClick={onChipClick}
        patchBlockStates={patchBlockStates}
        patchRejections={patchRejections}
        onPatchAccept={onPatchAccept}
        onPatchDismiss={onPatchDismiss}
        onFeedback={onFeedback}
        onArtefactMessage={onArtefactMessage}
        onProposalConfirm={onProposalConfirm}
        onHeldProposalSettle={onHeldProposalSettle}
        compact={compact}
        onRetryFailedSend={showFailedSendRetry ? onRetry : undefined}
        isLatestAssistantTurn={isLatestAssistantTurn}
      />

      {/*
        One quiet overflow control per message, in the message's OWN flow —
        replacing both the floating Copy/Retry bar and the per-message
        "Explain more · Summarise" row. It is rendered at rest rather than on
        hover: see the MessageMenu header on why hover-only is refused here.
      */}
      <div className="mt-1 flex items-center">
        <MessageMenu
          role={message.role}
          content={message.content}
          onRetry={message.role === 'assistant' ? onRetry : undefined}
          /*
           * ⚠ THE OLD ROW'S GATE IS CARRIED OVER, NOT DROPPED. `FollowUpActions`
           * rendered only when the message was a non-synthetic, non-streaming
           * assistant turn with real content — asking "explain that in more
           * detail" of a half-streamed sentence, or of a system notice, offers
           * an act the turn cannot honour. Consolidating the surface must not
           * quietly widen when the act is offered, so the same conditions
           * decide whether the follow-up items exist at all.
           */
          onSendFollowUp={
            message.role === 'assistant' && !message.synthetic && !message.isStreaming
              ? onArtefactMessage
              : undefined
          }
        />
      </div>
    </div>
  )
})
