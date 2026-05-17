/**
 * AIZone — the AI conversation surface inside the right panel.
 *
 * The `useConversation()` singleton lives in AIPanelV2Layout (one level
 * up) so the same instance can be threaded into both the embedded
 * OutputsDock (for its pre-analysis chip-fires) and AIZone (the main
 * chat surface). AIZone receives that instance as a prop and renders
 * one of two states based on `messages.length`:
 *
 *   • welcome  — first-use centred composer + guidance text
 *   • standard — pinned ConversationPanel + bottom AIInputBar
 *
 * Welcome state registers _prefillChat + _sendMessage on guidanceStore
 * directly so inspector "Ask about this" and context-menu Ask AI work
 * before the first message lands. ConversationPanel's effect takes over
 * the registration once it mounts in the standard state.
 */

import { memo, useCallback, useEffect, useRef } from 'react'
import { typography } from '../../styles/typography'
import { ConversationPanel } from '../conversation/ConversationPanel'
import type { UseConversationReturn } from '../conversation/useConversation'
import { useGuidanceStore } from '../stores/guidanceStore'
import { AIInputBar, type AIInputBarHandle } from './AIInputBar'
import { SelectionPill } from './SelectionPill'
import { StaleAnalysisBadge } from './StaleAnalysisBadge'
import type { AIPanelMode } from './constants'

const WELCOME_GUIDANCE =
  'Describe your decision, the options you’re weighing, and what a good outcome looks like.'

interface AIZoneProps {
  conversation: UseConversationReturn
  /**
   * Current panel mode (compact/conversation/focus). Used to close any
   * open cog popover when the user switches modes — the popover's own
   * outside-click handler covers pointer paths, this prop covers
   * keyboard activation (Enter/Space) of the mode tabs which never
   * fires pointer events.
   */
  activeMode?: AIPanelMode
}

export const AIZone = memo(function AIZone({ conversation, activeMode }: AIZoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const inputBarRef = useRef<AIInputBarHandle>(null)
  const welcomeInputRef = useRef<AIInputBarHandle>(null)

  // Close cog popover when the active mode changes (belt-and-braces
  // alongside CogPopover's capture-phase pointerdown listener).
  useEffect(() => {
    inputBarRef.current?.closePopover()
    welcomeInputRef.current?.closePopover()
  }, [activeMode])

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
    ;(inputBarRef.current ?? welcomeInputRef.current)?.setText(text)
  }, [])

  const showWelcome = conversation.messages.length === 0

  // Welcome-state cross-surface registration. Inspector "Ask about
  // this" / context-menu Ask AI / analysis hero actions all read
  // _sendMessage + _prefillChat from guidanceStore. ConversationPanel
  // doesn't mount in welcome state, so its registration effect never
  // fires — register here instead. When the user sends the first
  // message and ConversationPanel mounts, its own effect re-registers
  // the same callbacks (idempotent overwrite).
  useEffect(() => {
    if (!showWelcome) return
    const sendForExternals = (text: string) => {
      void conversation.sendMessage(text, { debugSource: 'ai_panel_v2_welcome_external' })
    }
    useGuidanceStore.setState({
      _prefillChat: handlePrefill,
      _sendMessage: sendForExternals,
    })
    return () => {
      const state = useGuidanceStore.getState()
      if (state._prefillChat === handlePrefill) {
        useGuidanceStore.setState({ _prefillChat: null })
      }
      if (state._sendMessage === sendForExternals) {
        useGuidanceStore.setState({ _sendMessage: null })
      }
    }
  }, [showWelcome, handlePrefill, conversation])

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
