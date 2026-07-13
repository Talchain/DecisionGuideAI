/**
 * Parity O — self-contained toast for the decision-overview surface.
 *
 * Mirrors the AskOlumiDrawer pattern (fixed bottom-centre dark pill,
 * role="status", auto-hide 1800ms) because ToastProvider is not mounted in
 * the live results tree — useShowToastSafe silently no-ops there, which is
 * how the menu's rerun failure toasts never surfaced.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

import { typography } from '../../../styles/typography'

const TOAST_MS = 1800

export function useSelfToast(): {
  showToast: (text: string) => void
  toastElement: ReactNode
} {
  const [toast, setToast] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback((text: string) => {
    setToast(text)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setToast(null), TOAST_MS)
  }, [])

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  const toastElement = toast ? (
    <div
      role="status"
      data-testid="decision-overview-toast"
      className={`${typography.panelBody} pointer-events-none fixed bottom-[18px] left-1/2 z-[30] max-w-[min(90vw,430px)] -translate-x-1/2 rounded-full bg-text-header px-[13px] py-2 text-text-on-color opacity-95`}
    >
      {toast}
    </div>
  ) : null

  return { showToast, toastElement }
}
