/** A hover card never sits under the Outputs dock (link hover card clipped, served c95fb40d, 20 Oct 2026). */
import { describe, it, expect, afterEach } from 'vitest'
import { placeHoverCard, viewportSize } from '../hoverCardPlacement'

function mountDock(left: number) {
  const dock = document.createElement('aside')
  dock.setAttribute('aria-label', 'Outputs dock')
  dock.getBoundingClientRect = () => ({ left, top: 0, right: window.innerWidth, bottom: window.innerHeight, width: window.innerWidth - left, height: window.innerHeight, x: left, y: 0, toJSON: () => ({}) })
  document.body.appendChild(dock)
}
afterEach(() => { document.body.innerHTML = '' })

describe('the hover card keeps clear of the dock', () => {
  it('the usable width ends at the dock', () => {
    mountDock(window.innerWidth - 360)
    expect(viewportSize().width).toBe(window.innerWidth - 360)
  })

  it('a link near the dock gets its card on the left, wholly outside the dock', () => {
    mountDock(window.innerWidth - 360)
    const x = window.innerWidth - 420
    const p = placeHoverCard({ left: x, top: 300, right: x + 8, bottom: 308 }, { width: 260, height: 140 }, viewportSize(), [])
    expect(p.left + 260).toBeLessThanOrEqual(window.innerWidth - 360)
  })

  it('CONTRAST: with no dock open, the whole window is usable', () => {
    expect(viewportSize().width).toBe(window.innerWidth)
  })
})
