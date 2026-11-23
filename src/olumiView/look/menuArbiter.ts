import { registerEscapeLayer } from '../v12/edit/escapeLayers'
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

export const isMenuOpen = (): boolean => active !== undefined

export function subscribeMenuOpen(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/** A canvas surface replaces the open menu unless that menu is handing off to its own form. */
export function dismissMenuForSurface(handoffOpener?: HTMLElement): void {
  if (active && active.opener !== handoffOpener) active.dismiss('replaced')
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
  const previous = active
  active = chain
  if (previous === undefined) {
    document.addEventListener('pointerdown', outsidePress, true)
    listeners.forEach((listener) => listener())
  }
  previous?.dismiss('replaced')
  if (chain.lane) {
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
