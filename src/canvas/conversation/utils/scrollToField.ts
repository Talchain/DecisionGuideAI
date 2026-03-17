/**
 * scrollToField — Scroll to an inspector field element identified by data-field-id.
 *
 * Two-step: rAF + 100ms retry to survive React 18 batched renders where the
 * inspector may not yet be mounted when the action fires.
 *
 * On success: scrolls element into view, adds a 2s highlight ring, clears
 * the guidance store's inspectorDeepLinkField.
 */

import { useGuidanceStore } from '../../stores/guidanceStore'

function applyHighlight(el: Element): void {
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  el.classList.add('ring-2', 'ring-info/50', 'rounded')
  setTimeout(() => {
    el.classList.remove('ring-2', 'ring-info/50', 'rounded')
    useGuidanceStore.setState({ inspectorDeepLinkField: null })
  }, 2000)
}

export function scrollToField(field: string): void {
  const selector = `[data-field-id="${field}"]`
  requestAnimationFrame(() => {
    const el = document.querySelector(selector)
    if (el) {
      applyHighlight(el)
    } else {
      // Slow path — inspector may still be rendering; retry after 100ms
      setTimeout(() => {
        const retryEl = document.querySelector(selector)
        if (retryEl) applyHighlight(retryEl)
      }, 100)
    }
  })
}
