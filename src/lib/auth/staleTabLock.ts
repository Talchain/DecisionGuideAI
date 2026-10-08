import { IDENTITY_EPOCH_KEY, isIdentityEpochStaleForThisTab } from '../../canvas/store/scenarios'

// Document-lifetime latch. An observer stays locked until this document reloads.
let locked = false
const listeners = new Set<() => void>()
const INPUT_EVENTS = [
  'pointerdown', 'pointerup', 'pointermove', 'mousedown', 'mouseup', 'mousemove',
  'click', 'dblclick', 'contextmenu', 'touchstart', 'touchmove', 'touchend', 'wheel',
  'keydown', 'keyup', 'keypress', 'beforeinput', 'input', 'change', 'submit',
  'dragstart', 'dragover', 'drop', 'paste', 'cut', 'compositionstart', 'compositionend', 'focusin', 'blur', 'focusout',
] as const

export function isStaleTabLocked(): boolean { return locked }

/** Auth identity relays lock even when they arrive before the shared epoch changes. */
export function lockStaleTab(): boolean {
  if (!locked) {
    locked = true // before listeners mount/focus the overlay and blur a pending editor
    listeners.forEach(listener => listener())
  }
  return locked
}

export function checkStaleTabLock(): boolean {
  if (!locked && isIdentityEpochStaleForThisTab()) lockStaleTab()
  return locked
}

function blockUnderlyingInput(event: Event): void {
  if (!locked) return
  const dialog = document.querySelector('[data-stale-tab-dialog]')
  const reload = dialog?.querySelector<HTMLButtonElement>('button')
  const inside = event.target instanceof Node && dialog?.contains(event.target)
  if (event.type === 'focusin') {
    if (!inside) {
      event.stopImmediatePropagation()
      reload?.focus()
    }
    return
  }
  if (event instanceof KeyboardEvent) {
    // Even keys on Reload must not reach window shortcuts such as Save or the palette.
    event.stopImmediatePropagation()
    const activatesReload = inside && event.target === reload && (event.key === 'Enter' || event.key === ' ')
    if (!activatesReload) event.preventDefault()
    if (event.key === 'Tab') reload?.focus()
    return
  }
  if (!inside) {
    event.preventDefault()
    event.stopImmediatePropagation()
  }
}

function onStorage(event: StorageEvent): void {
  if (event.key === IDENTITY_EPOCH_KEY) checkStaleTabLock()
}
function onVisible(): void {
  if (document.visibilityState === 'visible') checkStaleTabLock()
}
function onIdentityChange(): void { checkStaleTabLock() }

export function subscribeStaleTabLock(listener: () => void): () => void {
  listeners.add(listener)
  if (listeners.size === 1) {
    // Installed at shell layout commit, before canvas shortcut effects, and kept even before the lock is up.
    INPUT_EVENTS.forEach(type => window.addEventListener(type, blockUnderlyingInput, { capture: true, passive: false }))
    window.addEventListener('storage', onStorage)
    window.addEventListener('focus', onIdentityChange)
    window.addEventListener('olumi:identity-epoch-changed', onIdentityChange)
    document.addEventListener('visibilitychange', onVisible)
  }
  checkStaleTabLock()
  return () => {
    listeners.delete(listener)
    if (listeners.size !== 0) return
    INPUT_EVENTS.forEach(type => window.removeEventListener(type, blockUnderlyingInput, true))
    window.removeEventListener('storage', onStorage)
    window.removeEventListener('focus', onIdentityChange)
    window.removeEventListener('olumi:identity-epoch-changed', onIdentityChange)
    document.removeEventListener('visibilitychange', onVisible)
  }
}
