import { describe, expect, it, vi } from 'vitest'
import {
  MIN_USABLE_MODEL_VIEWPORT_WIDTH,
  listenForFloatingOlumiRequests,
  needsSingleExpandedPanel,
  requestFloatingOlumiSurface,
} from '../panelComposition'

describe('panel composition usable-canvas contract', () => {
  it.each([
    [1280, 428, true],
    [1440, 428, true],
    [1512, 428, true],
    [1600, 428, false],
    [1920, 428, false],
  ])('viewport %i with dock inset %i => constrained=%s', (viewportWidth, dockInset, expected) => {
    expect(needsSingleExpandedPanel({
      viewportWidth,
      dockInset,
      floatingPanelWidth: 400,
      dockExpanded: true,
    })).toBe(expected)
  })

  it('collapsed Outputs leaves floating Olumi and the model unconstrained', () => {
    expect(needsSingleExpandedPanel({
      viewportWidth: 1280,
      dockInset: 52,
      floatingPanelWidth: 400,
      dockExpanded: false,
    })).toBe(false)
  })

  it('derives the minimum usable width from the canonical model and label floor', () => {
    expect(MIN_USABLE_MODEL_VIEWPORT_WIDTH).toBe(641)
  })

  it('lets the shell sequence a constrained floating reveal', () => {
    const reveal = vi.fn()
    const stop = listenForFloatingOlumiRequests((deferredReveal) => {
      expect(deferredReveal).toBe(reveal)
      deferredReveal()
      return true
    })
    requestFloatingOlumiSurface(reveal)
    expect(reveal).toHaveBeenCalledTimes(1)
    stop()
  })

  it('reveals immediately when no shell claims the request', () => {
    const reveal = vi.fn()
    requestFloatingOlumiSurface(reveal)
    expect(reveal).toHaveBeenCalledTimes(1)
  })
})
