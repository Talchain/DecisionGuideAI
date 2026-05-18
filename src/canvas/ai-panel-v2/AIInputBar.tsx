import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { ArrowUp, Settings } from 'lucide-react'
import { typography } from '../../styles/typography'
import { useStageAwarePlaceholder } from './hooks/useStageAwarePlaceholder'
import { CogPopover } from './CogPopover'

// Brief mockup (§5.1):
//
//   +----------------------------------------------+
//   | [placeholder text]                      ⚙  ↑ |
//   +----------------------------------------------+
//
// • Auto-grow textarea: 40px resting, max ~72px (3 lines) before internal scroll
// • Settings cog + send button stacked vertically in the right corner
// • Stage-aware placeholder (useStageAwarePlaceholder)
// • Field: bg-panel + panel-border + rounded-lg, panelBody typography
// • Send: Enter; newline: Shift+Enter
// • Disabled while a turn is in flight

const RESTING_HEIGHT_PX = 40
const MAX_HEIGHT_PX = 72

interface AIInputBarProps {
  // Send is wired to useConversation().sendMessage by the parent (AIZone), so
  // the singleton invariant holds — exactly one sender, one network call.
  onSend: (text: string) => Promise<void> | void
  // True while a turn is in flight. Disables the textarea + send button.
  isThinking: boolean
  // Attachment trigger, surfaced via the cog popover.
  onAttach: () => void
  /**
   * 'compact' (default) is the pinned bottom-of-zone bar used during a
   * live conversation. 'welcome' is the centred, larger variant used as
   * the first-use entry point when no messages exist yet.
   */
  variant?: 'compact' | 'welcome'
  /**
   * Optional controlled value + change handler. When BOTH are provided
   * the textarea becomes controlled — useful for lifting the draft up
   * so it survives across dock/undock view transitions in Batch 2.
   * When omitted (the default) the bar keeps its own internal value
   * state for backward compatibility.
   */
  value?: string
  onValueChange?: (next: string) => void
}

// Imperative handle so external flows (inspector "Ask about this", analysis
// hero prefill actions) routed through guidanceStore._prefillChat can
// populate the visible textarea instead of a non-existent ChatComposer ref.
export interface AIInputBarHandle {
  setText: (text: string) => void
  focus: () => void
  /**
   * Force-close any open cog popover. Belt-and-braces companion to the
   * popover's own capture-phase outside-click handler — keyboard
   * activation of the mode tabs (Enter / Space) does not fire pointer
   * events, so the outside-click handler alone can miss those paths.
   */
  closePopover: () => void
}

export const AIInputBar = memo(forwardRef<AIInputBarHandle, AIInputBarProps>(function AIInputBar({
  onSend,
  isThinking,
  onAttach,
  variant = 'compact',
  value: controlledValue,
  onValueChange,
}, ref) {
  // In welcome variant the guidance text above the field carries the
  // "Describe your decision..." copy, so an additional stage-aware
  // placeholder inside the textarea would be a redundant duplicate.
  const stagePlaceholder = useStageAwarePlaceholder()
  const placeholder = variant === 'welcome' ? '' : stagePlaceholder
  const isControlled = controlledValue !== undefined && onValueChange !== undefined
  const [internalValue, setInternalValue] = useState('')
  const value = isControlled ? controlledValue : internalValue
  const setValue = useCallback(
    (next: string | ((prev: string) => string)) => {
      if (isControlled) {
        const resolved = typeof next === 'function' ? next(controlledValue ?? '') : next
        onValueChange?.(resolved)
      } else {
        setInternalValue(next)
      }
    },
    [isControlled, controlledValue, onValueChange],
  )
  const [cogOpen, setCogOpen] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const cogButtonRef = useRef<HTMLButtonElement>(null)

  // Auto-grow: measure scrollHeight after every value change, clamp between
  // resting and max so the textarea grows up to ~3 lines (compact) or ~6
  // lines (welcome) then scrolls.
  const isWelcomeVariant = variant === 'welcome'
  useLayoutEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    const minH = isWelcomeVariant ? 96 : RESTING_HEIGHT_PX
    const maxH = isWelcomeVariant ? 168 : MAX_HEIGHT_PX
    const next = Math.min(maxH, Math.max(minH, el.scrollHeight))
    el.style.height = `${next}px`
  }, [value, isWelcomeVariant])

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

  const handleCogClick = useCallback(() => {
    setCogOpen(prev => !prev)
  }, [])

  const handleCogClose = useCallback(() => {
    setCogOpen(false)
    // Return focus to the cog button per correction #7.
    cogButtonRef.current?.focus()
  }, [])

  // If the input becomes disabled mid-edit (turn started elsewhere), don't
  // strand a stale value; users see isThinking grey-out and can wait.
  useEffect(() => {
    if (!isThinking) return
    // Intentionally leave `value` alone so the user can resume after the
    // turn completes — no auto-clear surprises.
  }, [isThinking])

  useImperativeHandle(ref, () => ({
    setText: (text: string) => {
      setValue(text)
      // Focus the textarea after a microtask so React commits the value
      // first; otherwise the cursor lands at the wrong position.
      queueMicrotask(() => textareaRef.current?.focus())
    },
    focus: () => textareaRef.current?.focus(),
    closePopover: () => setCogOpen(false),
  }), [setValue])

  const canSend = value.trim().length > 0 && !isThinking
  const isWelcome = variant === 'welcome'

  // Welcome variant has a taller default textarea height + more padding
  // to feel like the obvious starting point of a fresh conversation.
  const welcomeRestingHeight = 96
  const welcomeMaxHeight = 168
  const restingHeight = isWelcome ? welcomeRestingHeight : RESTING_HEIGHT_PX
  const maxHeight = isWelcome ? welcomeMaxHeight : MAX_HEIGHT_PX

  return (
    <div
      className={
        isWelcome
          ? 'relative w-full px-6 py-2'
          : 'relative flex-shrink-0 px-3 py-2 bg-panel border-t border-default'
      }
      data-testid="ai-panel-v2-input-bar"
      data-variant={variant}
    >
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
          placeholder={placeholder}
          disabled={isThinking}
          rows={1}
          className={`flex-1 min-w-0 resize-none bg-transparent px-3 py-2 pr-12 ${typography.panelBody} text-text-body placeholder:text-text-light focus:outline-none disabled:opacity-60`}
          style={{ height: `${restingHeight}px`, maxHeight: `${maxHeight}px` }}
          aria-label="Ask the AI"
          data-testid="ai-panel-v2-textarea"
          autoFocus={isWelcome}
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
            data-testid="ai-panel-v2-cog"
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
            data-testid="ai-panel-v2-send"
          >
            <ArrowUp className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  )
}))
