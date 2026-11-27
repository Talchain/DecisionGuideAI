import { registerEscapeLayer } from '../v12/edit/escapeLayers'
import { dismissTip, higherThanMenuOpen } from './popupLayers'
import { useLaneInspector } from '../v12/edit/inspectorStore'

export type MenuDismissal = 'outside' | 'replaced' | 'escape' | 'tab' | 'action' | 'opener'

interface MenuChain {
  opener: HTMLElement | null
  lane: boolean
  contains: (target: Node) => boolean
  dismiss: (reason: MenuDismissal) => void
  escape: () => void
}

let active: MenuChain | undefined
const listeners = new Set<() => void>()

export const menuOpenerFor = (target: Node): HTMLElement | null =>
  active?.contains(target) ? active.opener : null

export const menuLaneForTarget = (target: Node): boolean | undefined =>
  active?.contains(target) ? active.lane : undefined

export const isMenuOpen = (): boolean => active !== undefined

export function subscribeMenuOpen(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/** A sheet or dialog replaces the open menu. */
export function dismissMenuForSurface(): void {
  active?.dismiss('replaced')
}

/** Returns true when this click closes the chain anchored to the button. */
export function dismissMenuFromOpener(opener: HTMLElement): boolean {
  if (active?.opener !== opener) return false
  active.dismiss('opener')
  return true
}

export function escapeMenu(target: Node): boolean {
  if (!active?.contains(target)) return false
  active.escape()
  return true
}

function outsidePress(event: PointerEvent): void {
  if (active && event.target instanceof Node && !active.opener?.contains(event.target) && !active.contains(event.target)) {
    active.dismiss('outside')
  }
}

/** One root chain owns dismissal. Submenus are surfaces within that chain. */
export function registerMenu(chain: MenuChain): () => void {
  if (chain.lane && higherThanMenuOpen()) {
    chain.dismiss('replaced')
    return () => undefined
  }
  const previous = active
  active = chain
  if (previous === undefined) {
    document.addEventListener('pointerdown', outsidePress, true)
    listeners.forEach((listener) => listener())
  }
  previous?.dismiss('replaced')
  if (chain.lane) {
    dismissTip()
    const inspector = useLaneInspector.getState()
    if (inspector.peek) inspector.clearPeek(inspector.peek.id)
  }
  const unregisterEscape = registerEscapeLayer(chain.escape)

  return () => {
    unregisterEscape()
    if (active !== chain) return
    active = undefined
    document.removeEventListener('pointerdown', outsidePress, true)
    listeners.forEach((listener) => listener())
  }
}
