import { useEffect, useRef, type KeyboardEvent } from 'react'
import { usePopupLayer } from './popupLayers'
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
  popup?: boolean
}

export function useDialogFocus<T extends HTMLElement>(options: DialogFocusOptions) {
  const {
    open = true, onEscape, containFocus = true, restoreFocus = true,
  } = options
  const dialogRef = useRef<T>(null)
  const latest = useRef(options)
  latest.current = options
  useEscapeLayer(open && !options.popup && onEscape !== undefined, () => latest.current.onEscape?.())
  usePopupLayer('dialog', open && options.popup === true, dialogRef,
    () => latest.current.opener?.() ?? null, () => latest.current.onEscape?.())

  useEffect(() => {
    const dialog = dialogRef.current
    if (!open || dialog === null) return
    const { initialFocus, opener, popup, selectInput } = latest.current
    const active = document.activeElement
    const trigger = opener?.() ?? (active instanceof HTMLElement ? active : null)
    const initial = initialFocus?.() ?? dialog
    initial.focus()
    if (popup && !dialog.contains(document.activeElement)) dialog.focus()
    if (selectInput && initial instanceof HTMLInputElement) initial.select()
    const keepFocus = (event: FocusEvent) => {
      if (event.target instanceof Node && !dialog.contains(event.target)) dialog.focus({ preventScroll: true })
    }
    if (popup && containFocus) document.addEventListener('focusin', keepFocus)
    return () => {
      if (popup && containFocus) document.removeEventListener('focusin', keepFocus)
      const focused = document.activeElement
      if (restoreFocus && trigger?.isConnected && (focused === document.body || dialog.contains(focused))) {
        trigger.focus({ preventScroll: true })
      }
    }
  }, [containFocus, open, restoreFocus])

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
