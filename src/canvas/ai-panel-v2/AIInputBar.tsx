import {
  memo,
  useCallback,
  useEffect,
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
}

export const AIInputBar = memo(function AIInputBar({
  onSend,
  isThinking,
  onAttach,
}: AIInputBarProps) {
  const placeholder = useStageAwarePlaceholder()
  const [value, setValue] = useState('')
  const [cogOpen, setCogOpen] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const cogButtonRef = useRef<HTMLButtonElement>(null)

  // Auto-grow: measure scrollHeight after every value change, clamp between
  // resting and max so the textarea grows up to ~3 lines then scrolls.
  useLayoutEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    const next = Math.min(MAX_HEIGHT_PX, Math.max(RESTING_HEIGHT_PX, el.scrollHeight))
    el.style.height = `${next}px`
  }, [value])

  const handleSend = useCallback(() => {
    const trimmed = value.trim()
    if (!trimmed || isThinking) return
    void onSend(trimmed)
    setValue('')
  }, [value, isThinking, onSend])

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

  const canSend = value.trim().length > 0 && !isThinking

  return (
    <div
      className="relative flex-shrink-0 px-3 py-2 bg-panel border-t border-panel-border"
      data-testid="ai-panel-v2-input-bar"
    >
      <CogPopover
        open={cogOpen}
        anchorRef={cogButtonRef}
        onClose={handleCogClose}
        onAttach={onAttach}
      />
      <div className="relative flex items-stretch bg-panel border border-panel-border rounded-lg focus-within:border-info/40 transition-colors">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isThinking}
          rows={1}
          className={`flex-1 min-w-0 resize-none bg-transparent px-3 py-2 pr-12 ${typography.panelBody} text-text-body placeholder:text-text-light focus:outline-none disabled:opacity-60`}
          style={{ height: `${RESTING_HEIGHT_PX}px`, maxHeight: `${MAX_HEIGHT_PX}px` }}
          aria-label="Ask the AI"
          data-testid="ai-panel-v2-textarea"
        />
        {/* Vertical icon stack inside the right corner of the field. The
            cog sits above the send button so it doesn't get hidden behind
            the cursor on long input. */}
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
})
