/**
 * R25 basics 1 (Paul 7 Nov, item "the right panel reaches the bottom of the window"): on the core lane the dock's bottom reserve
 * (`--bottombar-h`, 72px at :root for routes with a bottom bar) is zero while the lane's canvas is mounted, and the value it had is
 * restored when the canvas leaves, so other routes keep their bar. Real geometry is witnessed by the audit (panel gap 72 -> 0).
 */
import { afterEach, describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { BOTTOMBAR_VAR, useDockFullHeight } from '../dockFullHeight'

const root = () => document.documentElement
afterEach(() => { root().style.removeProperty(BOTTOMBAR_VAR) })

describe('the dock reaches the window bottom on the core lane', () => {
  it('catch: mounted, the reserve is 0px', () => {
    root().style.setProperty(BOTTOMBAR_VAR, '72px')
    renderHook(() => useDockFullHeight())
    expect(root().style.getPropertyValue(BOTTOMBAR_VAR)).toBe('0px')
  })
  it('must not change: leaving the canvas restores the reserve another route set', () => {
    root().style.setProperty(BOTTOMBAR_VAR, '72px')
    const { unmount } = renderHook(() => useDockFullHeight())
    unmount()
    expect(root().style.getPropertyValue(BOTTOMBAR_VAR)).toBe('72px')
  })
})
