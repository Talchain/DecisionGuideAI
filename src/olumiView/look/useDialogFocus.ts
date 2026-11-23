import { useEffect, useRef, type KeyboardEvent } from 'react'
import { useEscapeLayer } from '../v12/edit/escapeLayers'

const TAB_STOP = 'a[href], button, input:not([type="hidden"]), select, textarea, summary, [contenteditable="true"], [tabindex]'

interface DialogFocusOptions {
  open?: boolean
  initialFocus?: () => HTMLElement | null
  opener?: () => HTMLElement | null | undefined
  onEscape?: () => void
  selectInput?: boolean
  containFocus?: boolean
  restoreFocus?: boolean
}

export function useDialogFocus<T extends HTMLElement>(options: DialogFocusOptions) {
  const {
    open = true, onEscape, containFocus = true, restoreFocus = true,
  } = options
  const dialogRef = useRef<T>(null)
  const latest = useRef(options)
  latest.current = options
  useEscapeLayer(open && onEscape !== undefined, () => latest.current.onEscape?.())

  useEffect(() => {
    const dialog = dialogRef.current
    if (!open || dialog === null) return
    const { initialFocus, opener, selectInput } = latest.current
    const active = document.activeElement
    const trigger = opener?.() ?? (active instanceof HTMLElement ? active : null)
    const initial = initialFocus?.() ?? dialog
    initial.focus()
    if (selectInput && initial instanceof HTMLInputElement) initial.select()
    return () => {
      const focused = document.activeElement
      if (restoreFocus && trigger?.isConnected && (focused === document.body || dialog.contains(focused))) {
        trigger.focus({ preventScroll: true })
      }
    }
  }, [open, restoreFocus])

  const onKeyDown = (event: KeyboardEvent<T>) => {
    if (!containFocus || event.defaultPrevented || event.key !== 'Tab') return
    const dialog = event.currentTarget
    const stops = Array.from(dialog.querySelectorAll<HTMLElement>(TAB_STOP)).filter((element) => {
      if (element.tabIndex < 0 || element.matches(':disabled') || element.closest('[hidden], [inert], [aria-hidden="true"]')) return false
      const { display, visibility } = getComputedStyle(element)
      return display !== 'none' && visibility !== 'hidden' && visibility !== 'collapse'
    })
    const active = document.activeElement
    const first = stops[0], last = stops[stops.length - 1]
    if (!stops.some((element) => element === active) || active === (event.shiftKey ? first : last)) {
      event.preventDefault()
      const next = event.shiftKey ? last : first
      if (next === undefined) dialog.focus()
      else next.focus()
    }
  }

  return { dialogRef, onKeyDown }
}
