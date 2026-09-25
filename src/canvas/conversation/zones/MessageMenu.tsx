/**
 * MessageMenu — ONE discreet overflow control for everything a message affords.
 *
 * ## The defect, measured on deployed staging
 *
 * An assistant turn carried its actions on TWO separate surfaces:
 *
 *   · `MessageActions` — a floating bar of 44px circles (Copy, Retry),
 *     absolutely positioned, which forced `ChatMessage` to reserve a 32px
 *     EMPTY GUTTER above every message in the thread purely to hold it;
 *   · `FollowUpActions` — a persistent row of icon+label buttons
 *     ("Explain more", "Summarise") repeated under EVERY assistant message.
 *
 * A density census of one real turn at the real 416px dock counted EIGHT
 * always-visible controls. Screenshots of a live thread show the follow-up
 * pair repeating four times in a single viewport. That is the clutter: not
 * any one control, but the same four affordances restated per message, in two
 * different visual languages, on a surface 416px wide.
 *
 * ⭐ THE GUTTER IS THE LARGER WIN AND IT IS INVISIBLE IN A SCREENSHOT.
 * `ACTION_BAR_GUTTER_PX = 32` was padding-top on every message — reserved
 * unconditionally, because opening it on hover would reflow the thread under
 * the pointer. Moving the control INLINE removes the reason to reserve it, so
 * a thread of N messages gets back 32·N px of vertical space. Nothing about
 * the old bar was wrong; a bar that must not overlap text needs a band, and
 * a band costs what it costs. The fix is to stop needing the band.
 *
 * ## What is preserved, deliberately
 *
 * ⚠ EVERY ACTION SURVIVES. This consolidates presentation; it removes no
 * capability. Copy, Retry, Explain more and Summarise are all reachable, with
 * the same accessible names and the same handlers.
 *
 * ⚠ COPY STILL REPORTS WHAT HAPPENED. `navigator.clipboard` is unavailable on
 * insecure origins and can be permission-denied; the surface this replaces had
 * already been fixed once for swallowing both (L-72), and that fix is carried
 * over verbatim — outcome is announced in a polite live region, never inferred
 * from the icon having animated.
 *
 * ⚠ RETRY STAYS ASSISTANT-ONLY. Retrying a USER message means re-DELIVERING a
 * failed send, which has its own affordance on the bubble; two Retry controls
 * on one message meaning different things is the two-questions-under-one-name
 * shape this estate has paid for before. The asymmetry is inherited, not new.
 *
 * ⛔ NOT HOVER-ONLY. DS v5 §9.3 would hide a Tier 2 action until row hover
 * above a 400px panel, and the dock is 416px. Hover-only affordances are
 * undiscoverable, invisible to touch, and awkward on keyboard — the trigger is
 * always rendered and merely QUIET (`text-text-light`, 12px glyph), which is
 * what "discreet" has to mean on a surface people also use by finger.
 *
 * ⚠ REFINED AT THE CALL SITE (`ChatMessage.tsx`, `MENU_QUIET_AT_REST`): the
 * latest reply shows its trigger at rest; earlier messages reveal theirs on
 * hover, on keyboard focus, and always on touch (no-hover) devices. The trigger
 * stays rendered and in the tab order everywhere, so none of the three reasons
 * above is given up; only the repetition Paul saw ("…" under every message)
 * goes.
 *
 * Target size: the 24×24 trigger meets WCAG 2.2 SC 2.5.8 (Target Size
 * Minimum, AA, 24×24 CSS px). It does NOT meet SC 2.5.5 (Enhanced, AAA,
 * 44×44), which is what DS v5 §26.1 currently states for every target —
 * a bar the dense panel already fails at five controls out of eight. That
 * conflict is reported for §26.1 to resolve, not silently decided here.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { MoreHorizontal, Copy, RefreshCw, ListPlus, AlignLeft } from 'lucide-react'
import { ICON_DENSE, ICON_STROKE } from '../panelIcons'
import { typography } from '../../../styles/typography'

/** How long the copy outcome stays announced before the menu returns to rest. */
const COPY_FEEDBACK_MS = 2000

type CopyOutcome = null | 'copied' | 'failed'

export interface MessageMenuProps {
  role: 'user' | 'assistant'
  content: string
  onRetry?: () => void
  /** Sends a follow-up prompt on the user's behalf. Absent ⇒ no follow-up items. */
  onSendFollowUp?: (text: string) => void
}

interface MenuItem {
  key: string
  label: string
  icon: typeof Copy
  run: () => void
}

export function MessageMenu({ role, content, onRetry, onSendFollowUp }: MessageMenuProps) {
  const [open, setOpen] = useState(false)
  const [outcome, setOutcome] = useState<CopyOutcome>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

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

  const handleCopy = useCallback(async () => {
    // Carried over from MessageActions (L-72): the outcome is REPORTED. An
    // insecure origin or a denied permission must not look like a success.
    try {
      await navigator.clipboard.writeText(content)
      announce('copied')
    } catch {
      announce('failed')
    }
  }, [content, announce])

  // Close on Escape and on any click outside, and return focus to the trigger
  // so keyboard users are not dropped at the top of the document.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
    }
  }, [open])

  const items: MenuItem[] = [{ key: 'copy', label: 'Copy', icon: Copy, run: handleCopy }]
  if (role === 'assistant' && onRetry) {
    items.push({ key: 'retry', label: 'Retry', icon: RefreshCw, run: onRetry })
  }
  if (role === 'assistant' && onSendFollowUp) {
    items.push({
      key: 'explain',
      label: 'Explain more',
      icon: ListPlus,
      run: () => onSendFollowUp('Please explain that in more detail.'),
    })
    items.push({
      key: 'summarise',
      label: 'Summarise',
      icon: AlignLeft,
      run: () => onSendFollowUp('Please summarise that as concise bullets.'),
    })
  }

  return (
    <div className="relative inline-flex" ref={rootRef} data-testid="message-menu">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Message actions"
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid="message-menu-trigger"
        className="
          flex items-center justify-center w-6 h-6 rounded-md
          text-text-light hover:text-text-body hover:bg-panel-hover
          focus-visible:ring-2 focus-visible:ring-info focus-visible:outline-none
          transition-colors
        "
      >
        <MoreHorizontal size={ICON_DENSE} strokeWidth={ICON_STROKE} aria-hidden="true" />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Message actions"
          data-testid="message-menu-items"
          className="
            absolute left-0 top-7 z-20 min-w-[168px] py-1
            bg-panel border border-panel-border rounded-lg shadow-2
          "
        >
          {items.map(({ key, label, icon: Icon, run }) => (
            <button
              key={key}
              type="button"
              role="menuitem"
              data-testid={`message-menu-${key}`}
              onClick={() => {
                run()
                setOpen(false)
              }}
              className={`
                w-full flex items-center gap-2 px-3 py-1.5 text-left
                text-text-body hover:bg-panel-hover
                focus-visible:ring-2 focus-visible:ring-info focus-visible:outline-none
                ${typography.panelBody}
              `}
            >
              <Icon
                size={ICON_DENSE}
                strokeWidth={ICON_STROKE}
                className="flex-none text-text-light"
                aria-hidden="true"
              />
              {label}
            </button>
          ))}
        </div>
      )}

      {/* The outcome is ANNOUNCED, never swallowed — carried over from the
          surface this replaces. Visually hidden so the quiet trigger does not
          reflow, but a screen reader (and a spec) sees the result either way. */}
      <span
        className="sr-only"
        role="status"
        aria-live="polite"
        data-testid="message-action-status"
      >
        {outcome === 'copied'
          ? 'Message copied'
          : outcome === 'failed'
            ? "Couldn't copy — copy it manually"
            : ''}
      </span>
    </div>
  )
}
