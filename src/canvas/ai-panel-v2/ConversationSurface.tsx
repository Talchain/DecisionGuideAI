import { forwardRef, memo, useCallback, useImperativeHandle, useRef } from 'react'
import { ConversationPanel } from '../conversation/ConversationPanel'
import type { UseConversationReturn } from '../conversation/useConversation'
import { AIInputBar, type AIInputBarHandle } from './AIInputBar'
import { SelectionPill } from './SelectionPill'
import { StaleAnalysisBadge } from './StaleAnalysisBadge'

// Reusable conversation subtree: ChatThread (via ConversationPanel +
// hideComposer) + AIInputBar pinned to the bottom + SelectionPill +
// StaleAnalysisBadge between them. Used by AIPanelV2Layout in BOTH the
// docked AI-zone and the FloatingPanel so the same subtree shape is
// rendered consistently.
//
// State that needs to survive across dock/undock (draft text, scroll
// position) is OWNED by the layout and threaded in via props, so the
// content does not get lost when the parent container changes.

interface ConversationSurfaceProps {
  conversation: UseConversationReturn
  draftText: string
  onDraftChange: (next: string) => void
  scrollListRef: React.MutableRefObject<HTMLDivElement | null>
  onAttach: () => void
  onPrefill: (text: string) => void
  onSend: (text: string) => Promise<void> | void
}

export interface ConversationSurfaceHandle {
  setInputText: (text: string) => void
  focusInput: () => void
  closePopover: () => void
}

export const ConversationSurface = memo(
  forwardRef<ConversationSurfaceHandle, ConversationSurfaceProps>(function ConversationSurface(
    { conversation, draftText, onDraftChange, scrollListRef, onAttach, onPrefill, onSend },
    ref,
  ) {
    const inputBarRef = useRef<AIInputBarHandle>(null)

    const handlePrefill = useCallback(
      (text: string) => {
        onPrefill(text)
        // Routes through the controlled value path: parent updates
        // draftText, the input re-renders with the new content, focus
        // returns to the textarea.
        queueMicrotask(() => inputBarRef.current?.focus())
      },
      [onPrefill],
    )

    useImperativeHandle(
      ref,
      () => ({
        setInputText: (text: string) => {
          onDraftChange(text)
          queueMicrotask(() => inputBarRef.current?.focus())
        },
        focusInput: () => inputBarRef.current?.focus(),
        closePopover: () => inputBarRef.current?.closePopover(),
      }),
      [onDraftChange],
    )

    return (
      <div
        data-testid="ai-panel-v2-conversation-surface"
        className="flex flex-col flex-1 min-h-0"
      >
        <SelectionPill />
        <ConversationPanel
          conversation={conversation}
          onCollapse={noop}
          onAttach={onAttach}
          hideComposer
          prefillChat={handlePrefill}
          compact
          scrollListRef={scrollListRef}
        />
        <StaleAnalysisBadge />
        <AIInputBar
          ref={inputBarRef}
          onSend={onSend}
          isThinking={conversation.isThinking}
          onAttach={onAttach}
          value={draftText}
          onValueChange={onDraftChange}
        />
      </div>
    )
  }),
)

function noop() {
  /* persistent right-panel zone has no collapse affordance */
}
