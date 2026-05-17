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

import { memo, useCallback, useEffect, useLayoutEffect, useRef } from 'react'
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
  // Scroll preservation across mode transitions. ChatThread mirrors its
  // scroll container into `threadScrollRef`. Before activeMode changes
  // we cache scrollTop into `savedScrollTopRef`; after the new mode's
  // layout commits we restore it. Without this, the user loses their
  // place when toggling Focus ↔ Compact because the scrollable container
  // is briefly non-scrollable (content fits) in Focus, then becomes
  // scrollable again in Compact at scrollTop=0.
  const threadScrollRef = useRef<HTMLDivElement | null>(null)
  const savedScrollTopRef = useRef<number | null>(null)
  const prevActiveModeRef = useRef<AIPanelMode | undefined>(activeMode)

  // Close cog popover when the active mode changes (belt-and-braces
  // alongside CogPopover's capture-phase pointerdown listener).
  // Also capture the thread's current scrollTop BEFORE React commits the
  // new mode's layout — useEffect runs after commit, so we read here as
  // soon as we detect a pending mode change (via the prev-mode ref).
  useEffect(() => {
    inputBarRef.current?.closePopover()
    welcomeInputRef.current?.closePopover()
  }, [activeMode])

  // Save scrollTop on every render where the mode is about to change.
  // Synchronous read so we capture the OLD layout's offset.
  if (prevActiveModeRef.current !== activeMode && threadScrollRef.current) {
    savedScrollTopRef.current = threadScrollRef.current.scrollTop
  }
  prevActiveModeRef.current = activeMode

  // After the new mode's layout commits, if the scroll container is now
  // scrollable (content overflows), restore the saved offset clamped to
  // the new scrollHeight - clientHeight range. useLayoutEffect runs
  // before paint so the restore is invisible.
  useLayoutEffect(() => {
    const el = threadScrollRef.current
    const saved = savedScrollTopRef.current
    if (!el || saved == null) return
    const maxScroll = el.scrollHeight - el.clientHeight
    if (maxScroll > 0) {
      el.scrollTop = Math.min(saved, maxScroll)
    }
    // Don't clear savedScrollTopRef — a subsequent mode change should
    // overwrite it with the fresh capture, but if the thread re-mounts
    // (e.g. transitioning through welcome state) we still have the last
    // known offset to restore.
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
        compact
        scrollListRef={threadScrollRef}
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
