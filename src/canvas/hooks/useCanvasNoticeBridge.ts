import { useEffect } from 'react'
import { CANVAS_TOAST_EVENT, takeHeldCanvasNotices, type CanvasNoticeLevel } from '../utils/heldCanvasNotices'

/**
 * The canvas's toast bridge: shows `topbar:show-toast` notices raised outside the ToastProvider (TopBar, store, drains),
 * marks each as shown (`preventDefault`, read by `showCanvasNoticeOrHold`), and on mount shows any notice that was held
 * because no canvas was mounted when it was raised (the user had left the model).
 */
export function useCanvasNoticeBridge(showToast: (message: string, level: CanvasNoticeLevel) => void): void {
  useEffect(() => {
    const handler = (e: Event) => {
      const { message, level } = (e as CustomEvent).detail ?? {}
      if (!message) return
      showToast(message, level ?? 'info')
      e.preventDefault()
    }
    window.addEventListener(CANVAS_TOAST_EVENT, handler)
    for (const notice of takeHeldCanvasNotices()) showToast(notice.message, notice.level)
    return () => window.removeEventListener(CANVAS_TOAST_EVENT, handler)
  }, [showToast])
}
