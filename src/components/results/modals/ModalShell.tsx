/**
 * Shared modal scaffold for the Analysis-tab parity dialogs (prototype
 * `.overlay` + `.modal-card`, build-ready v6): Define success (#successModal)
 * and Record the decision (#decisionModal).
 *
 * Chrome per spec: full-screen scrim rgba(38,38,38,.28) (the prototype's
 * exact overlay colour — #262626 at 28%; kept as the literal the spec
 * demands), centred card min(430px,100%), max-height 90vh, padding 13px,
 * radius 12, bg-panel, shadow-2; head = 14/600 title + subtitle + 28x28
 * info-blue x icon-button (aria-label "Close").
 *
 * Accessibility BEYOND the prototype (its own spec flags all four as gaps to
 * fix in build): Escape closes, backdrop click closes, Tab is trapped inside
 * the card, focus moves into the dialog on open ([data-autofocus] first,
 * else the first enabled focusable) and returns to the invoking element on
 * close. role="dialog" + aria-modal + aria-labelledby per spec.
 *
 * The toast is self-contained (prototype chrome — fixed bottom-centre dark
 * pill, role="status", auto-hide 1800ms) because ToastProvider is not
 * mounted in the live results tree — same pattern as AskOlumiDrawer.
 */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react'
import { X } from 'lucide-react'

import { typography } from '../../../styles/typography'

const TOAST_MS = 1800

const FOCUSABLE_SELECTOR =
  'button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])'

function enabledFocusables(card: HTMLElement | null): HTMLElement[] {
  if (!card) return []
  return Array.from(card.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => !el.hasAttribute('disabled'),
  )
}

/** Prototype `.field` input treatment: radius 9, panel bg, focus border-info. */
export const FIELD_INPUT_CLASS = `w-full rounded-[9px] border border-panel-border bg-panel px-2 py-[7px] ${typography.panelBody} text-text-header focus:border-info focus:outline-none disabled:cursor-not-allowed disabled:opacity-50`

/** Prototype ghost button (Cancel). */
export const GHOST_BUTTON_CLASS = `inline-flex items-center gap-1.5 rounded-full border border-panel-border bg-transparent px-2.5 py-1.5 ${typography.panelBody} text-text-body hover:bg-panel-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info`

/** DS v5 primary button: info blue with white text, success-green hover. */
export const PRIMARY_BUTTON_CLASS = `inline-flex items-center justify-center gap-1.5 rounded-full border border-primary bg-primary px-[11px] py-[7px] ${typography.buttonSmall} text-text-on-color hover:border-primary-hover hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info`

export function FieldLabel({
  htmlFor,
  children,
}: {
  htmlFor: string
  children: ReactNode
}) {
  return (
    <label htmlFor={htmlFor} className={`${typography.panelMeta} text-text-light`}>
      {children}
    </label>
  )
}

/** Inline field-level validation error: 11px danger text (brief §7.3). */
export function FieldError({
  id,
  show,
  children,
}: {
  id: string
  show: boolean
  children: ReactNode
}) {
  if (!show) return null
  return (
    <p id={id} className={`${typography.panelMeta} text-danger`} aria-live="polite">
      {children}
    </p>
  )
}

/**
 * Self-contained toast (kept OUTSIDE the conditional dialog render so it
 * survives the modal closing on save).
 */
export function useModalToast(testId: string): {
  showToast: (text: string) => void
  toastElement: ReactNode
} {
  const [toast, setToast] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback((text: string) => {
    setToast(text)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setToast(null), TOAST_MS)
  }, [])

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    },
    [],
  )

  const toastElement = toast ? (
    <div
      role="status"
      data-testid={testId}
      className={`pointer-events-none fixed bottom-[18px] left-1/2 z-[40] max-w-[min(90vw,430px)] -translate-x-1/2 rounded-full bg-text-header px-[13px] py-2 ${typography.panelBody} text-text-on-color opacity-95`}
    >
      {toast}
    </div>
  ) : null

  return { showToast, toastElement }
}

export interface ModalShellProps {
  isOpen: boolean
  onClose: () => void
  title: string
  subtitle: string
  titleId: string
  testId: string
  children: ReactNode
}

export function ModalShell({
  isOpen,
  onClose,
  title,
  subtitle,
  titleId,
  testId,
  children,
}: ModalShellProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  // Focus management: remember the opener, move focus into the dialog
  // ([data-autofocus] first — e.g. the first form field), restore on close.
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement | null
      const card = cardRef.current
      const preferred = card?.querySelector<HTMLElement>(
        '[data-autofocus]:not([disabled])',
      )
      const target = preferred ?? enabledFocusables(card)[0]
      target?.focus()
    } else {
      previousFocusRef.current?.focus?.()
      previousFocusRef.current = null
    }
  }, [isOpen])

  // Escape closes (document-level, like AskOlumiDrawer).
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  // Tab trap: cycle within the card's enabled focusables.
  const handleKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab') return
    const focusables = enabledFocusables(cardRef.current)
    if (focusables.length === 0) return
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  if (!isOpen) return null

  return (
    <div
      data-testid={`${testId}-overlay`}
      className="fixed inset-0 z-[30] flex items-center justify-center bg-[rgba(38,38,38,0.28)] p-[18px]"
      onMouseDown={(e) => {
        // Backdrop click closes; clicks inside the card never do.
        if (e.target === e.currentTarget) onClose()
      }}
      onKeyDown={handleKeyDown}
    >
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid={testId}
        className="max-h-[90vh] w-[min(430px,100%)] overflow-auto rounded-xl border border-panel-border bg-panel p-[13px] shadow-2"
      >
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className={`${typography.panelHeader} text-text-header`}>
              {title}
            </h2>
            <p className={`mt-[3px] ${typography.panelBody} text-text-body`}>{subtitle}</p>
          </div>
          <button
            type="button"
            aria-label="Close"
            title="Close"
            onClick={onClose}
            className="flex h-7 w-7 flex-none items-center justify-center rounded-lg border border-panel-border bg-transparent text-info hover:bg-panel-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info"
          >
            <X size={15} aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
