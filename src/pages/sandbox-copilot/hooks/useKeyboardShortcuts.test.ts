/**
 * Tests for useKeyboardShortcuts hook
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useKeyboardShortcuts, KEYBOARD_SHORTCUTS } from './useKeyboardShortcuts'
import { useCopilotStore } from './useCopilotStore'
import { useCanvasStore } from '@/canvas/store'

// Mock dependencies
vi.mock('@/canvas/hooks/useResultsRun', () => ({
  useResultsRun: () => ({
    run: vi.fn(),
  }),
}))

describe('useKeyboardShortcuts', () => {
  beforeEach(() => {
    // Reset stores
    useCopilotStore.setState({
      journeyStage: 'building',
      selectedElement: null,
      panelExpanded: true,
      compareMode: false,
    })

    useCanvasStore.setState({
      nodes: [],
      edges: [],
    })
  })

  it('should initialize with help hidden', () => {
    const { result } = renderHook(() => useKeyboardShortcuts())
    expect(result.current.showHelp).toBe(false)
  })

  it('should toggle help on ? key press', () => {
    const { result } = renderHook(() => useKeyboardShortcuts())

    act(() => {
      const event = new KeyboardEvent('keydown', { key: '?' })
      window.dispatchEvent(event)
    })

    expect(result.current.showHelp).toBe(true)

    act(() => {
      const event = new KeyboardEvent('keydown', { key: '?' })
      window.dispatchEvent(event)
    })

    expect(result.current.showHelp).toBe(false)
  })

  it('should close help on Escape when help is open', () => {
    const { result } = renderHook(() => useKeyboardShortcuts())

    act(() => {
      result.current.setShowHelp(true)
    })

    expect(result.current.showHelp).toBe(true)

    act(() => {
      const event = new KeyboardEvent('keydown', { key: 'Escape' })
      window.dispatchEvent(event)
    })

    expect(result.current.showHelp).toBe(false)
  })

  it('should clear selection on Escape when element is selected', () => {
    const { result } = renderHook(() => useKeyboardShortcuts())

    act(() => {
      useCopilotStore.getState().selectElement('node-1')
    })

    expect(useCopilotStore.getState().selectedElement).toBe('node-1')

    act(() => {
      const event = new KeyboardEvent('keydown', { key: 'Escape' })
      window.dispatchEvent(event)
    })

    expect(useCopilotStore.getState().selectedElement).toBe(null)
  })

  it('should clear selection on c key press', () => {
    const { result } = renderHook(() => useKeyboardShortcuts())

    act(() => {
      useCopilotStore.getState().selectElement('node-1')
    })

    expect(useCopilotStore.getState().selectedElement).toBe('node-1')

    act(() => {
      const event = new KeyboardEvent('keydown', { key: 'c' })
      window.dispatchEvent(event)
    })

    expect(useCopilotStore.getState().selectedElement).toBe(null)
  })

  it('should export KEYBOARD_SHORTCUTS constant', () => {
    expect(KEYBOARD_SHORTCUTS).toBeDefined()
    expect(Array.isArray(KEYBOARD_SHORTCUTS)).toBe(true)
    expect(KEYBOARD_SHORTCUTS.length).toBeGreaterThan(0)

    // Check structure
    KEYBOARD_SHORTCUTS.forEach((shortcut) => {
      expect(shortcut).toHaveProperty('key')
      expect(shortcut).toHaveProperty('description')
      expect(typeof shortcut.key).toBe('string')
      expect(typeof shortcut.description).toBe('string')
    })
  })
})
