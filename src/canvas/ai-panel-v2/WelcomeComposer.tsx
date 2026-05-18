import { forwardRef, memo, useCallback, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react'
import { ArrowUp, Settings } from 'lucide-react'
import { typography } from '../../styles/typography'
import { CogPopover } from './CogPopover'

// State 1 (welcome): rendered when the conversation is empty AND the
// canvas has no nodes. The entire right panel is the AI zone — the
// analysis zone is HIDDEN entirely (not just empty/blank).
//
// Layout:
//   • Vertical centring via flexbox justify-center on the parent
//   • Guidance copy (`typo('panelBody')`, `text-text-light`) centred
//   • Generous composer below: minimum 3 visible lines, panelBody text,
//     bg-panel, border-default, rounded-lg
//   • Cog + send stacked vertically in the input's right corner (same
//     pattern as AIInputBar — kept consistent visually)
//   • No mode control, no minimise, no float — the AI is the only thing
//
// On send, the parent flips conversation state to non-empty and the
// layout transitions to State 2/3 automatically.

const WELCOME_GUIDANCE =
  'Describe your decision, the options you’re weighing, and what a good outcome looks like.'

// Minimum 3 visible lines @ panelBody (12px × 1.5 line-height = 18px/line)
// plus 16px vertical padding (py-2 × 2) = 70px. Bumped to 96px for the
// "generous" feel the brief asked for.
const WELCOME_RESTING_HEIGHT_PX = 96
const WELCOME_MAX_HEIGHT_PX = 224 // ~9 lines before internal scroll

export interface WelcomeComposerHandle {
  setText: (text: string) => void
  focus: () => void
  closePopover: () => void
}

interface WelcomeComposerProps {
  onSend: (text: string) => Promise<void> | void
  isThinking: boolean
  onAttach: () => void
  /**
   * Optional controlled value + setter. When BOTH are provided the
   * textarea shares the layout-owned draft text so a partial entry
   * written here survives a state transition (e.g. user adds a node
   * to the canvas before sending the welcome message).
   */
  value?: string
  onValueChange?: (next: string) => void
}

export const WelcomeComposer = memo(
  forwardRef<WelcomeComposerHandle, WelcomeComposerProps>(function WelcomeComposer(
    { onSend, isThinking, onAttach, value: controlledValue, onValueChange },
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
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const cogButtonRef = useRef<HTMLButtonElement>(null)

    useLayoutEffect(() => {
      const el = textareaRef.current
      if (!el) return
      el.style.height = 'auto'
      const next = Math.min(
        WELCOME_MAX_HEIGHT_PX,
        Math.max(WELCOME_RESTING_HEIGHT_PX, el.scrollHeight),
      )
      el.style.height = `${next}px`
    }, [value])

    const handleSend = useCallback(() => {
      const trimmed = value.trim()
      if (!trimmed || isThinking) return
      void onSend(trimmed)
      setValue('')
    }, [value, isThinking, onSend, setValue])

    const handleKeyDown = useCallback(
      (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
          event.preventDefault()
          handleSend()
        }
      },
      [handleSend],
    )

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
          queueMicrotask(() => textareaRef.current?.focus())
        },
        focus: () => textareaRef.current?.focus(),
        closePopover: () => setCogOpen(false),
      }),
      [setValue],
    )

    const canSend = value.trim().length > 0 && !isThinking

    return (
      <div
        data-testid="ai-panel-v2-welcome"
        className="flex flex-col h-full min-h-0 items-stretch justify-center px-6"
      >
        <div className="flex flex-col gap-4 items-stretch max-w-[360px] mx-auto w-full">
          <p
            className={`${typography.panelBody} text-text-light text-center`}
            data-testid="ai-panel-v2-welcome-guidance"
          >
            {WELCOME_GUIDANCE}
          </p>
          <div className="relative">
            <CogPopover
              open={cogOpen}
              anchorRef={cogButtonRef}
              onClose={handleCogClose}
              onAttach={onAttach}
            />
            <div className="relative flex items-stretch bg-panel border border-default rounded-lg focus-within:border-info/40 transition-colors">
              <textarea
                ref={textareaRef}
                value={value}
                onChange={e => setValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder=""
                disabled={isThinking}
                rows={3}
                className={`flex-1 min-w-0 resize-none bg-transparent px-3 py-2 pr-12 ${typography.panelBody} text-text-body placeholder:text-text-light focus:outline-none disabled:opacity-60`}
                style={{ height: `${WELCOME_RESTING_HEIGHT_PX}px`, maxHeight: `${WELCOME_MAX_HEIGHT_PX}px` }}
                aria-label="Ask the AI"
                data-testid="ai-panel-v2-welcome-textarea"
                autoFocus
              />
              <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex flex-col gap-0.5">
                <button
                  ref={cogButtonRef}
                  type="button"
                  onClick={handleCogClick}
                  aria-label="Input options"
                  aria-expanded={cogOpen}
                  aria-haspopup="menu"
                  title="Input options"
                  className="inline-flex items-center justify-center w-7 h-7 rounded text-text-light hover:text-text-body focus:outline-none focus-visible:ring-2 focus-visible:ring-info"
                  data-testid="ai-panel-v2-welcome-cog"
                >
                  <Settings className="w-4 h-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!canSend}
                  aria-label="Send message"
                  title="Send message (Enter)"
                  className="inline-flex items-center justify-center w-7 h-7 rounded bg-primary text-text-on-color hover:opacity-90 disabled:bg-primary-disabled disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-info"
                  data-testid="ai-panel-v2-welcome-send"
                >
                  <ArrowUp className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }),
)
