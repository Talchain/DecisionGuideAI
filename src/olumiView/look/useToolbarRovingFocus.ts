import { useLayoutEffect, useRef, type FocusEvent, type KeyboardEvent } from 'react'

/** Keep one Tab entry per rail, including when a slotted action appears or disappears. */
export function useToolbarRovingFocus(enabled: boolean) {
  const ref = useRef<HTMLElement>(null)
  const entry = useRef<HTMLButtonElement | null>(null)
  const faces = () => Array.from(ref.current?.querySelectorAll<HTMLButtonElement>('button.toolbar-face:not(:disabled)') ?? [])

  const setEntry = (buttons: HTMLButtonElement[], button: HTMLButtonElement | null) => {
    entry.current = button
    for (const face of buttons) face.tabIndex = face === button ? 0 : -1
  }

  useLayoutEffect(() => {
    if (!enabled || ref.current === null) return
    const sync = () => {
      const buttons = faces()
      setEntry(buttons, entry.current && buttons.includes(entry.current) ? entry.current : buttons[0] ?? null)
    }
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(ref.current, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [enabled])

  const onFocus = (e: FocusEvent<HTMLElement>) => {
    const buttons = faces()
    const face = buttons.find((button) => button === e.target)
    if (face) setEntry(buttons, face)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.defaultPrevented) return
    const buttons = faces()
    const index = buttons.findIndex((button) => button === e.target)
    if (index < 0) return

    let next: number
    switch (e.key) {
      case 'ArrowDown': next = (index + 1) % buttons.length; break
      case 'ArrowUp': next = (index + buttons.length - 1) % buttons.length; break
      case 'Home': next = 0; break
      case 'End': next = buttons.length - 1; break
      default: return
    }
    e.preventDefault()
    buttons[next]?.focus()
  }

  return enabled ? { ref, onFocus, onKeyDown } : {}
}
