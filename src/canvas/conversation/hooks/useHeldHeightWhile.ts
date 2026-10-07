/**
 * Hold an element's last settled height while `active` (S-F; buddy r2: the shell footer's Re-analyse bar collapsing
 * mid-turn — the Run finishing inside a pending turn — grew the thread, and the browser clamped a bottom reader's
 * scroll position: the dialogue moved 50 px before the reply). While a turn is in flight the footer keeps its space;
 * what it SAYS is never held (a bar that would claim "Model changed" after the model is current simply leaves its
 * space empty). The space is released when the turn settles.
 *
 * The height is measured after every commit in which `active` is false, and read during render while it is true.
 */
import { useLayoutEffect, useRef, type CSSProperties, type RefObject } from 'react'

export function useHeldHeightWhile(active: boolean): { ref: RefObject<HTMLDivElement>; style: CSSProperties | undefined } {
  const ref = useRef<HTMLDivElement>(null)
  const settledHeight = useRef(0)
  useLayoutEffect(() => {
    if (!active && ref.current) settledHeight.current = ref.current.offsetHeight
  })
  return { ref, style: active && settledHeight.current > 0 ? { minHeight: settledHeight.current } : undefined }
}
