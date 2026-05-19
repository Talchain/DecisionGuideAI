import { describe, it, expect, beforeEach } from 'vitest'
import { useFloatingPanelState, canAutoDock } from '../useFloatingPanelState'

describe('useFloatingPanelState', () => {
  beforeEach(() => {
    useFloatingPanelState.getState().reset()
  })

  it('starts closed with default size and source=user', () => {
    const s = useFloatingPanelState.getState()
    expect(s.isOpen).toBe(false)
    expect(s.userRepositioned).toBe(false)
    expect(s.source).toBe('user')
    expect(s.size).toEqual({ width: 400, height: 500 })
    expect(s.position).toBeNull()
  })

  it('open() records source and clears userRepositioned', () => {
    useFloatingPanelState.getState().setPosition({ x: 100, y: 100 })
    expect(useFloatingPanelState.getState().userRepositioned).toBe(true)

    useFloatingPanelState.getState().open('system-first-use')
    const s = useFloatingPanelState.getState()
    expect(s.isOpen).toBe(true)
    expect(s.source).toBe('system-first-use')
    expect(s.userRepositioned).toBe(false)
  })

  it('setPosition flips userRepositioned to true', () => {
    useFloatingPanelState.getState().open('system-first-use')
    expect(useFloatingPanelState.getState().userRepositioned).toBe(false)
    useFloatingPanelState.getState().setPosition({ x: 50, y: 80 })
    expect(useFloatingPanelState.getState().userRepositioned).toBe(true)
    expect(useFloatingPanelState.getState().position).toEqual({ x: 50, y: 80 })
  })

  it('setSize flips userRepositioned to true', () => {
    useFloatingPanelState.getState().open('system-first-use')
    useFloatingPanelState.getState().setSize({ width: 600, height: 700 })
    expect(useFloatingPanelState.getState().userRepositioned).toBe(true)
    expect(useFloatingPanelState.getState().size).toEqual({ width: 600, height: 700 })
  })

  it('toggle() opens with source=user', () => {
    useFloatingPanelState.getState().toggle()
    const s = useFloatingPanelState.getState()
    expect(s.isOpen).toBe(true)
    expect(s.source).toBe('user')
  })

  it('toggle() closes when open', () => {
    useFloatingPanelState.getState().open('system-first-use')
    useFloatingPanelState.getState().toggle()
    expect(useFloatingPanelState.getState().isOpen).toBe(false)
  })
})

describe('canAutoDock', () => {
  it('returns true for system-first-use + not repositioned', () => {
    expect(canAutoDock({ source: 'system-first-use', userRepositioned: false })).toBe(true)
  })

  it('returns false when user opened (source=user)', () => {
    expect(canAutoDock({ source: 'user', userRepositioned: false })).toBe(false)
  })

  it('returns false when user has dragged/resized (userRepositioned=true)', () => {
    expect(canAutoDock({ source: 'system-first-use', userRepositioned: true })).toBe(false)
  })

  it('returns false when both conditions fail', () => {
    expect(canAutoDock({ source: 'user', userRepositioned: true })).toBe(false)
  })
})
