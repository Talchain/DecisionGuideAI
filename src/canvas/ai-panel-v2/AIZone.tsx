/**
 * AIZone — owns the right-panel AI conversation surface.
 *
 * Calls `useConversation()` exactly once and routes its instance into
 * either:
 *   • the welcome state (centred composer + guidance text) when no
 *     messages exist yet, or
 *   • the standard state (ConversationPanel + ChatThread + pinned bottom
 *     AIInputBar) once the conversation has at least one message.
 *
 * Prefill target: AIZone provides `prefillChat` to ConversationPanel so
 * external flows (inspector "Ask about this", analysis hero prefill)
 * populate the visible AIInputBar instead of the unmounted composerRef.
 *
 * Singleton invariant (correction #9): exactly one `useConversation()`
 * call per active AI surface. Under FF on, DraftChat is unmounted, so
 * this is the only instance.
 */

import { memo, useCallback, useEffect, useRef } from 'react'
import { typography } from '../../styles/typography'
import { ConversationPanel } from '../conversation/ConversationPanel'
import { useConversation } from '../conversation/useConversation'
import { useGuidanceStore } from '../stores/guidanceStore'
import { AIInputBar, type AIInputBarHandle } from './AIInputBar'
import { SelectionPill } from './SelectionPill'
import { StaleAnalysisBadge } from './StaleAnalysisBadge'

const WELCOME_GUIDANCE =
  'Describe your decision, the options you’re weighing, and what a good outcome looks like.'

export const AIZone = memo(function AIZone() {
  const conversation = useConversation()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const inputBarRef = useRef<AIInputBarHandle>(null)
  const welcomeInputRef = useRef<AIInputBarHandle>(null)

  const handleAttach = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleSend = useCallback(
    async (text: string) => {
      await conversation.sendMessage(text, { debugSource: 'ai_panel_v2_input' })
    },
    [conversation],
  )

  const handlePrefill = useCallback((text: string) => {
    // Whichever input bar is currently mounted receives the prefill. The
    // welcome bar is mounted only when messages.length === 0; otherwise
    // the standard compact bar is mounted. Both expose the same handle.
    ;(inputBarRef.current ?? welcomeInputRef.current)?.setText(text)
  }, [])

  const showWelcome = conversation.messages.length === 0

  // In welcome state ConversationPanel is not mounted, so its
  // _prefillChat registration never fires. Register it from AIZone so
  // external flows (inspector "Ask about this", analysis hero prefill)
  // still populate the welcome composer's textarea. Once a message lands
  // and the standard variant mounts, ConversationPanel's effect takes
  // over (same callback, idempotent overwrite).
  useEffect(() => {
    if (!showWelcome) return
    useGuidanceStore.setState({ _prefillChat: handlePrefill })
    return () => {
      if (useGuidanceStore.getState()._prefillChat === handlePrefill) {
        useGuidanceStore.setState({ _prefillChat: null })
      }
    }
  }, [showWelcome, handlePrefill])

  if (showWelcome) {
    return (
      <div
        data-testid="ai-panel-v2-zone"
        data-state="welcome"
        className="flex flex-col h-full min-h-0 items-stretch justify-center px-2 py-4"
      >
        <div className="flex flex-col gap-3 items-center text-center">
          <p
            className={`${typography.panelBody} text-text-light max-w-prose px-2`}
            data-testid="ai-panel-v2-welcome-guidance"
          >
            {WELCOME_GUIDANCE}
          </p>
          <div className="w-full">
            <AIInputBar
              ref={welcomeInputRef}
              variant="welcome"
              onSend={handleSend}
              isThinking={conversation.isThinking}
              onAttach={handleAttach}
            />
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          aria-hidden="true"
          tabIndex={-1}
          data-testid="ai-panel-v2-file-input"
        />
      </div>
    )
  }

  return (
    <div data-testid="ai-panel-v2-zone" data-state="standard" className="flex flex-col h-full min-h-0">
      <SelectionPill />
      <ConversationPanel
        conversation={conversation}
        onCollapse={noop}
        onAttach={handleAttach}
        hideComposer
        prefillChat={handlePrefill}
      />
      <StaleAnalysisBadge />
      <AIInputBar
        ref={inputBarRef}
        onSend={handleSend}
        isThinking={conversation.isThinking}
        onAttach={handleAttach}
      />
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
        data-testid="ai-panel-v2-file-input"
      />
    </div>
  )
})

function noop() {
  /* persistent right-panel zone has no collapse affordance */
}
