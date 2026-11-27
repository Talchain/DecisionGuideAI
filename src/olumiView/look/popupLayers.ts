import { useLayoutEffect, useRef, type RefObject } from 'react'
import { registerEscapeLayer } from '../v12/edit/escapeLayers'
import { dismissMenuForSurface, isMenuOpen } from './menuArbiter'
import { isSheetSurface, surfaceBusy, useLaneInspector } from '../v12/edit/inspectorStore'

type Kind = 'tip' | 'sheet' | 'dialog' | 'float'
type Close = () => void
const active: Partial<Record<Kind, Close>> = {}

export const dialogOpen = (): boolean => active.dialog !== undefined
export const higherThanMenuOpen = (): boolean =>
  dialogOpen() || active.sheet !== undefined || isSheetSurface(useLaneInspector.getState().current)

export const tipBlocked = (): boolean =>
  higherThanMenuOpen() || isMenuOpen() || useLaneInspector.getState().current !== null

let tipGeneration = 0
export const currentTipGeneration = (): number => tipGeneration
export const dismissTip = (): void => {
  tipGeneration++
  active.tip?.()
}
export const dismissChromeSheet = (): void => { active.sheet?.() }

/** A pointer press inside the surface or on its opener belongs to that control. */
export function onOutsidePress(surface: Element | null, opener: Element | null, close: Close): Close {
  const outside = (event: PointerEvent) => {
    const target = event.target
    if (!(target instanceof Node) || surface?.contains(target) || opener?.contains(target)) return
    close()
  }
  document.addEventListener('pointerdown', outside, true)
  return () => document.removeEventListener('pointerdown', outside, true)
}

/** Register the visible lifetime with the shared Escape stack. */
export function registerPopup(kind: Kind, close: Close, surface: Element | null, opener: Element | null, options: { parentOwnsEscape?: boolean } = {}): Close {
  active[kind]?.()
  const dismiss = () => { unregister(); close() }
  const removeEscape = options.parentOwnsEscape ? undefined : registerEscapeLayer(dismiss)
  const removeOutside = onOutsidePress(surface, opener, dismiss)
  const unregister = () => {
    if (active[kind] === dismiss) delete active[kind]
    removeEscape?.()
    removeOutside()
  }
  active[kind] = dismiss
  return unregister
}

/** Modal dialogs and the canvas settings sheet share precedence with the canvas slot. */
export function usePopupLayer<T extends HTMLElement>(
  kind: 'dialog' | 'sheet', open: boolean, ref: RefObject<T>, opener: () => HTMLElement | null, close: Close,
): void {
  const latest = useRef({ opener, close })
  latest.current = { opener, close }
  useLayoutEffect(() => {
    if (!open || ref.current === null) return
    const inspector = useLaneInspector.getState()
    if (kind === 'sheet' && (dialogOpen() || surfaceBusy(inspector.current))) {
      latest.current.close()
      return
    }
    const trigger = latest.current.opener()
    const unregister = registerPopup(kind, () => latest.current.close(), ref.current, kind === 'sheet' ? trigger : null)
    if (kind === 'dialog') dismissChromeSheet()
    dismissMenuForSurface()
    dismissTip()
    inspector.dismiss(false)
    if (inspector.peek !== null) inspector.clearPeek(inspector.peek.id)
    return unregister
  }, [kind, open, ref])
}
