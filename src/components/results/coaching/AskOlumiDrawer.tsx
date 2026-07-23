/**
 * Parity P1 — "Work through it with Olumi" drawer (prototype #olumiDrawer,
 * build-ready v6).
 *
 * Anatomy per spec: fixed bottom-right, min(370px, 100vw−36px), radius 12,
 * shadow-2; head = 14/600 title + × icon-button; body = context box with an
 * info border (radius 9), prefilled EDITABLE textarea (min-height 64px),
 * right-aligned actions "Focus on canvas" (ghost, only when the target
 * resolves) + "Send" (primary).
 *
 * Send dispatches a conversation-typed turn via the guidance store degrade
 * chain (_dispatchAction → _sendMessage); when neither callback is
 * registered the Send button is disabled with an honest hint rather than a
 * silent no-op (the audit's dead-button class). Focus on canvas resolves
 * node/edge/PLoT-arrow ids via focusModelTarget (fail-closed).
 *
 * Accessibility beyond the prototype (its own spec flags these as gaps to
 * fix in build): Escape closes, focus moves to the textarea on open and
 * returns to the prior element on close.
 *
 * Toast: self-contained (prototype chrome — fixed bottom-centre dark pill,
 * role="status", auto-hide 1800ms) because ToastProvider is not mounted in
 * the live results tree.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'

import { useGuidanceStore } from '../../../canvas/stores/guidanceStore'
import { focusModelTarget } from '../../../canvas/utils/focusHelpers'
import { V7_MODEL_LIMIT_CAVEAT } from '../v7/v7GuidanceCopy'
import { useAskOlumiStore } from './askOlumiStore'

const TOAST_MS = 1800

export function AskOlumiDrawer() {
  const isOpen = useAskOlumiStore((s) => s.isOpen)
  const context = useAskOlumiStore((s) => s.context)
  const draft = useAskOlumiStore((s) => s.draft)
  const label = useAskOlumiStore((s) => s.label)
  const targetId = useAskOlumiStore((s) => s.targetId)
  const parameters = useAskOlumiStore((s) => s.parameters)
  const source = useAskOlumiStore((s) => s.source)
  const setDraft = useAskOlumiStore((s) => s.setDraft)
  const close = useAskOlumiStore((s) => s.close)

  const dispatchAction = useGuidanceStore((s) => s._dispatchAction)
  const sendMessage = useGuidanceStore((s) => s._sendMessage)
  const canSend = dispatchAction !== null || sendMessage !== null

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback((message: string) => {
    setToast(message)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS)
  }, [])

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
  }, [])

  // Focus management: remember the opener, focus the textarea, restore on close.
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement | null
      textareaRef.current?.focus()
    } else {
      previousFocusRef.current?.focus?.()
      previousFocusRef.current = null
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, close])

  const handleSend = () => {
    const text = draft.trim()
    if (!text || !canSend) return
    if (dispatchAction) {
      // Conversation-typed turn: chip_metadata (the contextual-session
      // carrier) survives ONLY on this turn type.
      void dispatchAction({
        action_type: 'discuss',
        parameters,
        label,
        message: text,
        source,
      })
    } else if (sendMessage) {
      sendMessage(text)
    }
    showToast('Sent to Olumi with the relevant model context')
    close()
  }

  const handleFocusCanvas = () => {
    if (!targetId) return
    const ok = focusModelTarget(targetId)
    showToast(
      ok
        ? 'Focused the relevant model elements on the canvas'
        : 'That element is no longer on the canvas',
    )
  }

  const targetResolvable = targetId !== null && targetId !== ''

  return (
    <>
      {isOpen && (
        <aside
          data-testid="ask-olumi-drawer"
          role="dialog"
          aria-label="Work through it with Olumi"
          className="fixed bottom-[18px] right-[18px] z-[25] w-[min(370px,calc(100vw-36px))] rounded-xl border border-panel-border bg-panel shadow-2"
        >
          <div className="flex items-center gap-2 px-[11px] pt-[10px]">
            <h2 className="flex-1 text-sm font-semibold text-text-header">
              Work through it with Olumi
            </h2>
            <button
              type="button"
              aria-label="Close"
              onClick={close}
              className="rounded-lg p-1 text-text-light hover:bg-panel-hover hover:text-text-header"
            >
              <X size={15} aria-hidden="true" />
            </button>
          </div>
          <div className="px-[11px] pb-[10px] pt-2">
            {context && (
              <p
                data-testid="ask-olumi-context"
                className="mb-2 rounded-[9px] border border-info px-2.5 py-2 text-xs text-text-body"
              >
                {context}
              </p>
            )}
            {/* Row 15: the drawer ALWAYS carries the model-limit caveat, so a
                work-through never reads as a real-world forecast. Copy only. */}
            <p
              data-testid="ask-olumi-model-limit"
              className="mb-2 text-[11px] leading-snug text-text-light"
            >
              {V7_MODEL_LIMIT_CAVEAT}
            </p>
            <textarea
              ref={textareaRef}
              data-testid="ask-olumi-draft"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              className="min-h-[64px] w-full resize-y rounded-[9px] border border-panel-border bg-transparent px-2.5 py-2 text-xs text-text-body focus:border-info focus:outline-none"
            />
            {!canSend && (
              <p className="mt-1 text-[11px] leading-snug text-text-light">
                Open the Olumi chat to send this — the conversation is not
                available right now.
              </p>
            )}
            <div className="mt-2 flex items-center justify-end gap-2">
              {targetResolvable && (
                <button
                  type="button"
                  onClick={handleFocusCanvas}
                  className="rounded-full border border-panel-border bg-transparent px-2.5 py-1.5 text-xs text-text-body hover:bg-panel-hover"
                >
                  Focus on canvas
                </button>
              )}
              <button
                type="button"
                onClick={handleSend}
                disabled={!canSend || draft.trim() === ''}
                className="inline-flex items-center gap-1.5 rounded-full border border-primary bg-primary px-[11px] py-[7px] text-xs font-semibold text-text-on-color hover:border-primary-hover hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
              >
                Send
              </button>
            </div>
          </div>
        </aside>
      )}
      {toast && (
        <div
          role="status"
          data-testid="ask-olumi-toast"
          className="pointer-events-none fixed bottom-[18px] left-1/2 z-[30] max-w-[min(90vw,430px)] -translate-x-1/2 rounded-full bg-text-header px-[13px] py-2 text-xs text-text-on-color opacity-95"
        >
          {toast}
        </div>
      )}
    </>
  )
}
