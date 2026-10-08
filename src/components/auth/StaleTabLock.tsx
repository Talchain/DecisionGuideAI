import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { checkStaleTabLock, isStaleTabLocked, subscribeStaleTabLock } from '../../lib/auth/staleTabLock'

export const STALE_TAB_LOCK_MESSAGE = 'Someone signed in or out in another tab. Reload this tab to carry on.'

export default function StaleTabLock() {
  const [locked, setLocked] = useState(checkStaleTabLock)
  const [portal] = useState(() => document.createElement('div'))
  const button = useRef<HTMLButtonElement>(null)

  useLayoutEffect(() => subscribeStaleTabLock(() => setLocked(isStaleTabLocked())), [])
  useLayoutEffect(() => {
    if (!locked) return
    document.body.appendChild(portal)
    const previous = new Map<Element, { inert: string | null; hidden: string | null }>()
    const hideUnderlying = () => {
      for (const sibling of document.body.children) {
        if (sibling === portal || previous.has(sibling)) continue
        previous.set(sibling, { inert: sibling.getAttribute('inert'), hidden: sibling.getAttribute('aria-hidden') })
        sibling.setAttribute('inert', '')
        sibling.setAttribute('aria-hidden', 'true')
      }
    }
    hideUnderlying()
    // Portalled menus and dialogs can be added after the boundary too.
    const observer = new MutationObserver(hideUnderlying)
    observer.observe(document.body, { childList: true })
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    button.current?.focus()
    return () => {
      observer.disconnect()
      for (const [element, attrs] of previous) {
        if (attrs.inert === null) element.removeAttribute('inert')
        else element.setAttribute('inert', attrs.inert)
        if (attrs.hidden === null) element.removeAttribute('aria-hidden')
        else element.setAttribute('aria-hidden', attrs.hidden)
      }
      document.body.style.overflow = overflow
      portal.remove()
    }
  }, [locked, portal])

  if (!locked) return null
  return createPortal(
    <div data-stale-tab-dialog role="alertdialog" aria-modal="true" aria-label={STALE_TAB_LOCK_MESSAGE}
      style={{ position: 'fixed', inset: 0, zIndex: 2147483647, display: 'grid', placeItems: 'center',
        background: 'rgba(15, 23, 42, 0.75)', pointerEvents: 'auto', padding: 24 }}>
      <div style={{ background: '#fff', color: '#0f172a', borderRadius: 12, padding: 24, maxWidth: 440 }}>
        <p>{STALE_TAB_LOCK_MESSAGE}</p>
        <button ref={button} type="button" onClick={() => location.reload()}
          style={{ marginTop: 16, padding: '10px 20px', borderRadius: 6, background: '#0f172a', color: '#fff' }}>
          Reload
        </button>
      </div>
    </div>, portal,
  )
}
