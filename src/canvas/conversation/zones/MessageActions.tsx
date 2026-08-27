/**
 * MessageActions — hover/focus action bar on messages.
 *
 * ## Control parity (L-72)
 *
 * Both roles get Copy. Only assistant messages get Retry, and that asymmetry is
 * a product decision rather than an omission: retrying a USER message is a
 * different act — it is re-DELIVERING a send that failed — and it already has
 * its own affordance on the bubble itself ("Not delivered → Retry",
 * `MessageBubble`), wired to the same `retryLast`. Two Retry controls on one
 * user bubble, one meaning "resend" and one meaning "regenerate", is the
 * two-questions-under-one-name shape this platform has already paid for.
 *
 * Copy no longer fails silently. `navigator.clipboard` is unavailable on
 * insecure origins and can be permission-denied; the previous handler swallowed
 * both, which is exactly the "reportedly fail" report in L-72 — the icon
 * animated, nothing was copied, and nothing said so. The control now reports
 * what happened, in a polite live region.
 *
 * ## Geometry (L-73) — the controls must never cover message text
 *
 * The bar used to be `absolute top-0`, i.e. sitting directly ON the first line
 * of the message. It is now positioned inside a RESERVED GUTTER that
 * `ChatMessage` opens above every bubble, and the arithmetic that guarantees
 * no overlap is stated ONCE, here, as exported constants:
 *
 *     ACTION_BAR_TOP_OFFSET_PX + ACTION_BAR_HEIGHT_PX <= ACTION_BAR_GUTTER_PX
 *
 * The offset is negative, so the bar reaches up into the inter-message gap and
 * the reserved band stays small. jsdom cannot prove visibility (platform trap
 * 3), so the spec binds THIS INVARIANT rather than pretending to measure
 * layout — and it binds the same constants the component and its host consume,
 * so the guard cannot agree with a copy of the rule instead of the rule.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { Copy, RefreshCw } from 'lucide-react'
import { ICON_STROKE } from '../panelIcons'

/** 44px touch target (DS v5 §8.11) — unchanged; the fix is where it sits, not its size. */
export const ACTION_BAR_HEIGHT_PX = 44
/** How far the bar reaches ABOVE the reserved band, into the inter-message gap. */
export const ACTION_BAR_TOP_OFFSET_PX = -12
/** Vertical space `ChatMessage` reserves above the bubble for the bar. */
export const ACTION_BAR_GUTTER_PX = 32
/** How long the copy outcome stays announced before the bar returns to rest. */
const COPY_FEEDBACK_MS = 2000

type CopyOutcome = null | 'copied' | 'failed'

interface MessageActionsProps {
  role: 'user' | 'assistant'
  content: string
  onRetry?: () => void
  /** @deprecated No longer used — kept for caller compatibility. */
  isFirst?: boolean
}

export function MessageActions({ role, content, onRetry }: MessageActionsProps) {
  const [outcome, setOutcome] = useState<CopyOutcome>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    },
    [],
  )

  const announce = useCallback((next: CopyOutcome) => {
    setOutcome(next)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setOutcome(null), COPY_FEEDBACK_MS)
  }, [])

  const handleCopy = useCallback(() => {
    // Availability is checked rather than assumed: `navigator.clipboard` is
    // undefined on an insecure origin, so calling straight through would throw
    // synchronously and never reach the rejection handler.
    const clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : undefined
    if (!clipboard?.writeText) {
      announce('failed')
      return
    }
    clipboard.writeText(content).then(
      () => announce('copied'),
      () => announce('failed'),
    )
  }, [content, announce])

  return (
    <div
      className={`
        flex items-center absolute z-10 pointer-events-auto
        ${role === 'user' ? 'right-0' : 'left-0'}
      `}
      style={{ top: ACTION_BAR_TOP_OFFSET_PX, height: ACTION_BAR_HEIGHT_PX }}
      role="toolbar"
      aria-label="Message actions"
      data-testid="message-actions"
    >
      <ActionButton
        icon={Copy}
        label="Copy"
        onClick={handleCopy}
        testId="message-action-copy"
      />
      {role === 'assistant' && onRetry && (
        <ActionButton
          icon={RefreshCw}
          label="Retry"
          onClick={onRetry}
          testId="message-action-retry"
        />
      )}
      {/* Outcome is ANNOUNCED, never swallowed. Visually hidden: the bar itself
          is a hover surface and a text label would reflow it, but a screen
          reader (and a spec) can see the result of the action either way. */}
      <span className="sr-only" role="status" aria-live="polite" data-testid="message-action-status">
        {outcome === 'copied' ? 'Message copied' : outcome === 'failed' ? "Couldn't copy — copy it manually" : ''}
      </span>
    </div>
  )
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  testId,
}: {
  icon: React.ElementType
  label: string
  onClick: () => void
  testId: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      data-testid={testId}
      style={{ width: ACTION_BAR_HEIGHT_PX, height: ACTION_BAR_HEIGHT_PX }}
      className="
        group/action flex items-center justify-center
        cursor-pointer
        focus-visible:ring-2 focus-visible:ring-info focus-visible:outline-none
        rounded-full
      "
    >
      {/* 26px visual circle inside the 44px touch target (DS v5 §8.11) */}
      <span
        className="
          w-[26px] h-[26px] flex items-center justify-center rounded-full
          bg-panel text-text-light shadow-1
          border border-panel-border
          group-hover/action:border-info group-hover/action:text-info
          transition-all duration-100
        "
        aria-hidden="true"
      >
        <Icon className="w-3 h-3" strokeWidth={ICON_STROKE} />
      </span>
    </button>
  )
}
