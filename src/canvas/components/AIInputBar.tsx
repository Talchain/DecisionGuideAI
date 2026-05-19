import {
  forwardRef,
  memo,
  useCallback,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  type KeyboardEvent,
} from 'react'
import { ArrowUp, ChevronUp, Settings } from 'lucide-react'
import { typo } from '../../styles/typography'
import { useCanvasStore } from '../store'
import { useConversationContext } from '../conversation/ConversationContext'
import { useStageAwarePlaceholder } from '../hooks/useStageAwarePlaceholder'

export type AIInputBarVariant = 'strip' | 'docked-tab' | 'floating' | 'first-use'

export interface AIInputBarHandle {
  focus(): void
  /** Synchronously read current draft text (without committing through state). */
  peek(): string
}

export interface AIInputBarProps {
  /** Layout variant — affects padding and chrome (cog, chevron). */
  variant: AIInputBarVariant
  /** Override the stage-aware placeholder. Optional. */
  placeholder?: string
  /** Disabled state — when true, the textarea is read-only and submit blocked. */
  disabled?: boolean
  /** Click handler for the cog icon. Owner decides whether it opens a popover.
   *  Receives the button element so the popover can anchor to it. */
  onCogClick?: (anchorEl: HTMLElement) => void
  /** Click handler for the chevron icon (strip only). Opens floating panel. */
  onChevronClick?: () => void
  /** Hides the chevron icon (used by floating + first-use + docked-tab variants). */
  hideChevron?: boolean
  /** Optional id for the textarea (for label/test wiring). */
  textareaId?: string
  /** Optional test id for the wrapping container. */
  testId?: string
  /** Optional aria-label for the textarea. */
  ariaLabel?: string
  /** Fires after a non-empty submit has been dispatched (sendMessage called,
   *  draft cleared). Used by FirstUseComposer to record an explicit
   *  "user submitted via this composer" signal — preferred over inferring
   *  from message-count effects, which can mis-fire under thread hydration
   *  if historic non-synthetic messages are restored before graph nodes. */
  onAfterSend?: (text: string) => void
}

const MAX_LINES = 2
const LINE_HEIGHT_PX = 18

/**
 * AIInputBar — single shared composer used by the persistent strip, the docked
 * Olumi tab (currently unused — strip handles), the floating Olumi panel, and
 * the first-use centred composer. Owns no message state; reads draft from
 * ConversationContext so the draft survives surface switches (e.g. typing in
 * the strip → opening floating → docking → strip still has the text).
 *
 * The variant only affects chrome (padding, which icons are visible). The
 * input logic — auto-grow up to 2 lines, Enter-to-send, Shift+Enter newline —
 * is identical across variants.
 */
export const AIInputBar = memo(
  forwardRef<AIInputBarHandle, AIInputBarProps>(function AIInputBar(
    {
      variant,
      placeholder,
      disabled = false,
      onCogClick,
      onChevronClick,
      hideChevron = false,
      textareaId,
      testId,
      ariaLabel,
      onAfterSend,
    },
    ref,
  ) {
    const { draft, setDraft, clearDraft, sendMessage, isThinking } = useConversationContext()
    const stagePlaceholder = useStageAwarePlaceholder()
    const textareaRef = useRef<HTMLTextAreaElement | null>(null)
    // Empty canvas → the user's send should DRAFT a model (not chat).
    // Mirrors ConversationPanel.handleGenerateModel's wiring at
    // ConversationPanel.tsx:428 — same turn type + debug source so the
    // orchestrator routes the brief through the model-generation path
    // and emits auto-apply graph patches.
    const nodeCount = useCanvasStore((s) => s.nodes.length)

    useImperativeHandle(
      ref,
      () => ({
        focus: () => textareaRef.current?.focus(),
        peek: () => textareaRef.current?.value ?? draft,
      }),
      [draft],
    )

    // Auto-grow up to MAX_LINES, then scroll inside.
    useLayoutEffect(() => {
      const el = textareaRef.current
      if (!el) return
      el.style.height = 'auto'
      const max = LINE_HEIGHT_PX * MAX_LINES + 8
      el.style.height = `${Math.min(el.scrollHeight, max)}px`
    }, [draft])

    const handleSend = useCallback(() => {
      const text = draft.trim()
      if (!text || disabled || isThinking) return
      if (nodeCount === 0) {
        // Empty canvas: drafting a model, not chatting.
        sendMessage(text, {
          turnType: 'explicit_generate',
          debugSource: 'generate_model',
          debugSourceSurface: 'ai_panel',
        })
      } else {
        sendMessage(text)
      }
      clearDraft()
      onAfterSend?.(text)
    }, [draft, disabled, isThinking, nodeCount, sendMessage, clearDraft, onAfterSend])

    const handleKeyDown = useCallback(
      (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault()
          handleSend()
        }
      },
      [handleSend],
    )

    const containerClasses = (() => {
      switch (variant) {
        case 'strip':
          return 'flex items-end gap-1 px-2 pb-2 pt-1'
        case 'docked-tab':
          return 'flex items-end gap-1 px-3 pb-3 pt-2'
        case 'floating':
          return 'flex items-end gap-1 px-3 pb-3 pt-2 border-t border-panel-border'
        case 'first-use':
          return 'flex items-end gap-1 px-3 pb-3 pt-2'
      }
    })()

    // Empty canvas + isThinking === a model-generation turn is in flight.
    // The brief: composer must not invite a new decision while generating.
    // We disable typing + replace the placeholder. Chat-mode thinking
    // (nodeCount > 0) keeps the existing behaviour (Enter blocked via
    // handleSend; typing still allowed so the user can compose follow-up).
    const isGenerating = isThinking && nodeCount === 0
    const inputDisabled = disabled || isGenerating
    const effectivePlaceholder = isGenerating
      ? 'Generating your decision model…'
      : placeholder ?? stagePlaceholder
    const canSend = draft.trim().length > 0 && !inputDisabled && !isThinking

    return (
      <div className={containerClasses} data-testid={testId ?? `ai-input-bar-${variant}`}>
        <div className="relative flex-1 bg-panel border border-panel-border rounded-lg focus-within:ring-2 focus-within:ring-info">
          <textarea
            ref={textareaRef}
            id={textareaId}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={effectivePlaceholder}
            rows={1}
            disabled={inputDisabled}
            aria-label={ariaLabel ?? 'Chat message'}
            data-testid={`${testId ?? `ai-input-bar-${variant}`}-textarea`}
            className={typo(
              'panelBody',
              'w-full resize-none bg-transparent outline-none text-text-body placeholder:text-text-light py-2 pl-3 pr-16',
            )}
            style={{ minHeight: 36, maxHeight: LINE_HEIGHT_PX * MAX_LINES + 16 }}
          />
          <div className="absolute right-1.5 bottom-1 flex flex-col items-center gap-0.5">
            {onCogClick ? (
              <button
                type="button"
                onClick={(e) => onCogClick(e.currentTarget)}
                disabled={disabled}
                className="inline-flex items-center justify-center w-6 h-6 rounded-sm text-text-light hover:text-text-body hover:bg-panel-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-info disabled:opacity-50"
                aria-label="Settings"
                data-testid={`${testId ?? `ai-input-bar-${variant}`}-cog`}
              >
                <Settings className="w-4 h-4" aria-hidden="true" />
              </button>
            ) : null}
            <button
              type="button"
              onClick={handleSend}
              disabled={!canSend}
              className="inline-flex items-center justify-center w-6 h-6 rounded-sm text-text-light hover:text-text-body hover:bg-panel-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-info disabled:opacity-40 disabled:hover:bg-transparent"
              aria-label="Send"
              data-testid={`${testId ?? `ai-input-bar-${variant}`}-send`}
            >
              <ArrowUp className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>
        {variant === 'strip' && !hideChevron && onChevronClick ? (
          <button
            type="button"
            onClick={onChevronClick}
            disabled={disabled}
            className="inline-flex items-center justify-center w-7 h-7 rounded-sm text-text-light hover:text-text-body hover:bg-panel-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-info"
            aria-label="Open Olumi in floating panel"
            data-testid={`${testId ?? `ai-input-bar-${variant}`}-chevron`}
            title="Open in floating window"
          >
            <ChevronUp className="w-4 h-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    )
  }),
)

/** Ensure the displayName shows up nicely in React DevTools. */
AIInputBar.displayName = 'AIInputBar'

/**
 * Re-export of effect that callers can wire — disables sending while thinking.
 * (Lives here so consumers don't need to re-derive from context.)
 */
export function useIsSendDisabled(): boolean {
  const { isThinking } = useConversationContext()
  return isThinking
}

// Re-exported so unit tests / Storybook can import the constant directly.
export { LINE_HEIGHT_PX, MAX_LINES }
