/**
 * useDebugFlags Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { getDebugFlags } from '../useDebugFlags'

describe('getDebugFlags', () => {
  const originalLocation = window.location

  beforeEach(() => {
    // Reset location for each test
    delete (window as any).location
    window.location = {
      ...originalLocation,
      search: '',
      hash: '',
    } as Location
  })

  afterEach(() => {
    window.location = originalLocation
  })

  it('returns false for both flags when no URL params', () => {
    window.location.search = ''
    window.location.hash = ''

    const flags = getDebugFlags()

    expect(flags.showDebugConsole).toBe(false)
    expect(flags.showUnsafe).toBe(false)
  })

  it('returns showDebugConsole=true when ?diag=1', () => {
    window.location.search = '?diag=1'

    const flags = getDebugFlags()

    expect(flags.showDebugConsole).toBe(true)
    expect(flags.showUnsafe).toBe(false)
  })

  it('returns both flags true when ?diag=1&unsafe=1', () => {
    window.location.search = '?diag=1&unsafe=1'

    const flags = getDebugFlags()

    expect(flags.showDebugConsole).toBe(true)
    expect(flags.showUnsafe).toBe(true)
  })

  it('returns showUnsafe=false when only ?unsafe=1 (no diag)', () => {
    window.location.search = '?unsafe=1'

    const flags = getDebugFlags()

    expect(flags.showDebugConsole).toBe(false)
    expect(flags.showUnsafe).toBe(false)
  })

  it('parses HashRouter query params (#/canvas?diag=1)', () => {
    window.location.search = ''
    window.location.hash = '#/canvas?diag=1'

    const flags = getDebugFlags()

    expect(flags.showDebugConsole).toBe(true)
  })

  it('parses HashRouter with both flags (#/canvas?diag=1&unsafe=1)', () => {
    window.location.search = ''
    window.location.hash = '#/canvas?diag=1&unsafe=1'

    const flags = getDebugFlags()

    expect(flags.showDebugConsole).toBe(true)
    expect(flags.showUnsafe).toBe(true)
  })

  it('hash params override regular params', () => {
    window.location.search = '?diag=0'
    window.location.hash = '#/canvas?diag=1'

    const flags = getDebugFlags()

    expect(flags.showDebugConsole).toBe(true)
  })
})
