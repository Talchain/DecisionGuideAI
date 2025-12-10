/**
 * Tests for useComparisonDetection hook
 * Validates comparison prompt triggering logic
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useComparisonDetection } from '../useComparisonDetection'
import { useCanvasStore } from '../../store'

describe('useComparisonDetection', () => {
  beforeEach(() => {
    // Reset store to clean state
    useCanvasStore.setState({
      nodes: [],
      runMeta: {
        ceeReview: null,
      },
    })
  })

  describe('structure-based detection', () => {
    it('returns shouldPrompt=true when graph has 1 decision and 2+ options', () => {
      useCanvasStore.setState({
        nodes: [
          { id: 'd1', type: 'decision', data: { label: 'Decision' }, position: { x: 0, y: 0 } },
          { id: 'o1', type: 'option', data: { label: 'Option A' }, position: { x: 0, y: 0 } },
          { id: 'o2', type: 'option', data: { label: 'Option B' }, position: { x: 0, y: 0 } },
        ],
      })

      const { result } = renderHook(() => useComparisonDetection())

      expect(result.current.shouldPrompt).toBe(true)
      expect(result.current.reason).toBe('structure')
      expect(result.current.canCompare).toBe(true)
    })

    it('returns shouldPrompt=false when graph has no decision node', () => {
      useCanvasStore.setState({
        nodes: [
          { id: 'o1', type: 'option', data: { label: 'Option A' }, position: { x: 0, y: 0 } },
          { id: 'o2', type: 'option', data: { label: 'Option B' }, position: { x: 0, y: 0 } },
        ],
      })

      const { result } = renderHook(() => useComparisonDetection())

      expect(result.current.shouldPrompt).toBe(false)
      expect(result.current.reason).toBe(null)
      expect(result.current.canCompare).toBe(false)
    })

    it('returns shouldPrompt=false when graph has fewer than 2 options', () => {
      useCanvasStore.setState({
        nodes: [
          { id: 'd1', type: 'decision', data: { label: 'Decision' }, position: { x: 0, y: 0 } },
          { id: 'o1', type: 'option', data: { label: 'Option A' }, position: { x: 0, y: 0 } },
        ],
      })

      const { result } = renderHook(() => useComparisonDetection())

      expect(result.current.shouldPrompt).toBe(false)
      expect(result.current.canCompare).toBe(false)
    })

    it('returns shouldPrompt=false when graph has multiple decisions', () => {
      useCanvasStore.setState({
        nodes: [
          { id: 'd1', type: 'decision', data: { label: 'Decision 1' }, position: { x: 0, y: 0 } },
          { id: 'd2', type: 'decision', data: { label: 'Decision 2' }, position: { x: 0, y: 0 } },
          { id: 'o1', type: 'option', data: { label: 'Option A' }, position: { x: 0, y: 0 } },
          { id: 'o2', type: 'option', data: { label: 'Option B' }, position: { x: 0, y: 0 } },
        ],
      })

      const { result } = renderHook(() => useComparisonDetection())

      expect(result.current.shouldPrompt).toBe(false)
      expect(result.current.canCompare).toBe(false)
    })
  })

  describe('CEE-based detection', () => {
    it('returns reason=cee when uiFlags.comparison_suggested is true', () => {
      useCanvasStore.setState({
        nodes: [
          { id: 'd1', type: 'decision', data: { label: 'Decision' }, position: { x: 0, y: 0 } },
          { id: 'o1', type: 'option', data: { label: 'Option A' }, position: { x: 0, y: 0 } },
          { id: 'o2', type: 'option', data: { label: 'Option B' }, position: { x: 0, y: 0 } },
        ],
        runMeta: {
          ceeReview: {
            uiFlags: {
              comparison_suggested: true,
            },
          } as any,
        },
      })

      const { result } = renderHook(() => useComparisonDetection())

      expect(result.current.shouldPrompt).toBe(true)
      expect(result.current.reason).toBe('cee')
    })

    it('CEE suggestion takes priority over structure detection', () => {
      useCanvasStore.setState({
        nodes: [
          { id: 'd1', type: 'decision', data: { label: 'Decision' }, position: { x: 0, y: 0 } },
          { id: 'o1', type: 'option', data: { label: 'Option A' }, position: { x: 0, y: 0 } },
          { id: 'o2', type: 'option', data: { label: 'Option B' }, position: { x: 0, y: 0 } },
        ],
        runMeta: {
          ceeReview: {
            uiFlags: {
              comparison_suggested: true,
            },
          } as any,
        },
      })

      const { result } = renderHook(() => useComparisonDetection())

      // Should be 'cee' not 'structure' since CEE takes priority
      expect(result.current.reason).toBe('cee')
    })

    it('ignores CEE suggestion when uiFlags.comparison_suggested is false', () => {
      useCanvasStore.setState({
        nodes: [
          { id: 'd1', type: 'decision', data: { label: 'Decision' }, position: { x: 0, y: 0 } },
          { id: 'o1', type: 'option', data: { label: 'Option A' }, position: { x: 0, y: 0 } },
          { id: 'o2', type: 'option', data: { label: 'Option B' }, position: { x: 0, y: 0 } },
        ],
        runMeta: {
          ceeReview: {
            uiFlags: {
              comparison_suggested: false,
            },
          } as any,
        },
      })

      const { result } = renderHook(() => useComparisonDetection())

      // Falls back to structure detection
      expect(result.current.reason).toBe('structure')
    })
  })

  describe('optionNodes extraction', () => {
    it('returns option nodes with id and label', () => {
      useCanvasStore.setState({
        nodes: [
          { id: 'd1', type: 'decision', data: { label: 'Decision' }, position: { x: 0, y: 0 } },
          { id: 'o1', type: 'option', data: { label: 'Option Alpha' }, position: { x: 0, y: 0 } },
          { id: 'o2', type: 'option', data: { label: 'Option Beta' }, position: { x: 0, y: 0 } },
          { id: 'o3', type: 'option', data: { label: 'Option Gamma' }, position: { x: 0, y: 0 } },
        ],
      })

      const { result } = renderHook(() => useComparisonDetection())

      expect(result.current.optionNodes).toHaveLength(3)
      expect(result.current.optionNodes).toContainEqual({ id: 'o1', label: 'Option Alpha' })
      expect(result.current.optionNodes).toContainEqual({ id: 'o2', label: 'Option Beta' })
      expect(result.current.optionNodes).toContainEqual({ id: 'o3', label: 'Option Gamma' })
    })

    it('uses fallback label when data.label is missing', () => {
      useCanvasStore.setState({
        nodes: [
          { id: 'd1', type: 'decision', data: { label: 'Decision' }, position: { x: 0, y: 0 } },
          { id: 'o1', type: 'option', data: {}, position: { x: 0, y: 0 } },
          { id: 'o2', type: 'option', data: { label: 'Option B' }, position: { x: 0, y: 0 } },
        ],
      })

      const { result } = renderHook(() => useComparisonDetection())

      expect(result.current.optionNodes).toContainEqual({ id: 'o1', label: 'Option o1' })
      expect(result.current.optionNodes).toContainEqual({ id: 'o2', label: 'Option B' })
    })
  })

  describe('empty state', () => {
    it('returns empty optionNodes for empty graph', () => {
      useCanvasStore.setState({
        nodes: [],
      })

      const { result } = renderHook(() => useComparisonDetection())

      expect(result.current.shouldPrompt).toBe(false)
      expect(result.current.optionNodes).toHaveLength(0)
    })
  })
})
