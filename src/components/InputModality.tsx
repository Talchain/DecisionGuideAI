import { useEffect } from 'react'

const KEYBOARD_KEYS = new Set(['Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', ' ', 'Spacebar'])
const POINTER_EVENTS = ['pointerdown', 'mousedown', 'touchstart'] as const

/** Mounted once above the app's routes, so text-input focus can distinguish a click from keyboard navigation. */
export function InputModality() {
  useEffect(() => {
    const root = document.documentElement
    const previous = root.getAttribute('data-input-modality')
    root.setAttribute('data-input-modality', 'pointer')
    const keyboard = (event: KeyboardEvent) => {
      if (KEYBOARD_KEYS.has(event.key)) root.setAttribute('data-input-modality', 'keyboard')
    }
    const pointer = () => root.setAttribute('data-input-modality', 'pointer')
    // Capture runs before controls focus themselves or stop propagation.
    document.addEventListener('keydown', keyboard, true)
    for (const event of POINTER_EVENTS) document.addEventListener(event, pointer, true)
    return () => {
      document.removeEventListener('keydown', keyboard, true)
      for (const event of POINTER_EVENTS) document.removeEventListener(event, pointer, true)
      if (previous === null) root.removeAttribute('data-input-modality')
      else root.setAttribute('data-input-modality', previous)
    }
  }, [])
  return null
}
