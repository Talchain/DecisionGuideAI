import { forwardRef, memo, useCallback, useImperativeHandle, useRef, useState } from 'react'
import { ArrowUp, ChevronUp, Settings } from 'lucide-react'
import { typography } from '../../styles/typography'
import { CogPopover } from './CogPopover'
import { MINIMISED_BAR_HEIGHT } from './constants'
import { useStageAwarePlaceholder } from './hooks/useStageAwarePlaceholder'

// State 4 — collapsed AI bar at the bottom of the right panel.
//
// 48px tall, single line of input + cog + send + expand. No chat
// history, no message bubbles. Analysis zone expands to fill the rest
// of the panel. Clicking the expand icon OR focusing the input restores
// the previous state (State 2 or State 3 ratios — handled by the
// parent via `onExpand`).
//
// Send behaviour matches AIInputBar: Enter sends, Shift+Enter newline
// (the textarea handles \n natively; the bar visually clamps to one
// line via overflow-hidden, but a multi-line draft is preserved if the
// user expands back later — the parent owns the draft via the
// AIInputBarHandle.setText pattern).
//
// Focus management: when the user focuses the input, the parent
// expands the bar back to State 2/3 (per brief: "Clicking the expand
// icon or focusing the input restores the previous state"). The
// `onExpand` callback fires on either trigger.

export interface MinimisedBarHandle {
  setText: (text: string) => void
  focus: () => void
  closePopover: () => void
}

interface MinimisedBarProps {
  onSend: (text: string) => Promise<void> | void
  onExpand: () => void
  onAttach: () => void
  isThinking: boolean
  /**
   * Optional controlled value + setter. When BOTH are provided the
   * input becomes controlled and shares the layout-owned draft with
   * the docked AIInputBar and the floating ConversationSurface —
   * required for the brief's "draft text preserved across dock/undock"
   * contract. Omitted → falls back to internal state for legacy use.
   */
  value?: string
  onValueChange?: (next: string) => void
}

export const MinimisedBar = memo(
  forwardRef<MinimisedBarHandle, MinimisedBarProps>(function MinimisedBar(
    { onSend, onExpand, onAttach, isThinking, value: controlledValue, onValueChange },
    ref,
  ) {
    const isControlled = controlledValue !== undefined && onValueChange !== undefined
    const [internalValue, setInternalValue] = useState('')
    const value = isControlled ? controlledValue : internalValue
    const setValue = useCallback(
      (next: string) => {
        if (isControlled) onValueChange?.(next)
        else setInternalValue(next)
      },
      [isControlled, onValueChange],
    )
    const [cogOpen, setCogOpen] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)
    const cogButtonRef = useRef<HTMLButtonElement>(null)
    const placeholder = useStageAwarePlaceholder()

    const handleSend = useCallback(() => {
      const trimmed = value.trim()
      if (!trimmed || isThinking) return
      void onSend(trimmed)
      setValue('')
    }, [value, isThinking, onSend, setValue])

    const handleKeyDown = useCallback(
      (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
          event.preventDefault()
          handleSend()
        }
      },
      [handleSend],
    )

    const handleFocus = useCallback(() => {
      // Brief: "Clicking the expand icon or focusing the input restores
      // the previous state." We trigger expand on first focus so the
      // user lands in the full surface with their cursor still in the
      // input (the parent should focus the standard AIInputBar).
      onExpand()
    }, [onExpand])

    const handleCogClick = useCallback(() => setCogOpen(prev => !prev), [])
    const handleCogClose = useCallback(() => {
      setCogOpen(false)
      cogButtonRef.current?.focus()
    }, [])

    useImperativeHandle(
      ref,
      () => ({
        setText: (text: string) => {
          setValue(text)
          queueMicrotask(() => inputRef.current?.focus())
        },
        focus: () => inputRef.current?.focus(),
        closePopover: () => setCogOpen(false),
      }),
      [setValue],
    )

    const canSend = value.trim().length > 0 && !isThinking

    return (
      <div
        data-testid="ai-panel-v2-minimised-bar"
        className="relative flex items-center gap-1.5 flex-shrink-0 px-2 bg-panel border-t border-default"
        style={{ height: MINIMISED_BAR_HEIGHT }}
      >
        <CogPopover
          open={cogOpen}
          anchorRef={cogButtonRef}
          onClose={handleCogClose}
          onAttach={onAttach}
        />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          placeholder={placeholder}
          disabled={isThinking}
          aria-label="Ask the AI"
          data-testid="ai-panel-v2-minimised-input"
          className={`flex-1 min-w-0 bg-transparent px-2 py-1 ${typography.panelBody} text-text-body placeholder:text-text-light focus:outline-none disabled:opacity-60`}
        />
        <button
          ref={cogButtonRef}
          type="button"
          onClick={handleCogClick}
          aria-label="Input options"
          aria-expanded={cogOpen}
          aria-haspopup="menu"
          title="Input options"
          className="inline-flex items-center justify-center w-7 h-7 rounded text-text-light hover:text-text-body focus:outline-none focus-visible:ring-2 focus-visible:ring-info"
          data-testid="ai-panel-v2-minimised-cog"
        >
          <Settings className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          aria-label="Send message"
          title="Send message (Enter)"
          className="inline-flex items-center justify-center w-7 h-7 rounded bg-primary text-text-on-color hover:opacity-90 disabled:bg-primary-disabled disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-info"
          data-testid="ai-panel-v2-minimised-send"
        >
          <ArrowUp className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onExpand}
          aria-label="Expand assistant"
          title="Expand assistant"
          className="inline-flex items-center justify-center w-7 h-7 rounded text-text-light hover:text-text-body hover:bg-panel-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-info"
          data-testid="ai-panel-v2-minimised-expand"
        >
          <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>
    )
  }),
)
