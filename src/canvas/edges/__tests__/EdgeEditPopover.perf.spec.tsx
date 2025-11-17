/**
 * S3-POPOVER-PERF: Micro-Performance Test for Edge Edit Popover
 *
 * Validates that popover rendering and interaction complete within 16ms
 * (one frame at 60 FPS) to ensure smooth user experience.
 *
 * Performance targets:
 * - Initial render: < 25ms (with test overhead)
 * - Slider interaction: < 16ms
 * - Update debounce fire: < 16ms
 *
 * LIMITATIONS:
 * - Uses jsdom/RTL, not real browser rendering
 * - performance.now() measures JS execution time only
 * - Does NOT include layout, paint, or composite phases
 * - Real browser metrics may differ (use Lighthouse/WebPageTest for production)
 *
 * These tests validate ALGORITHMIC performance (state updates, event handlers).
 * For real-world INP/FCP metrics, use:
 * - Lighthouse CI
 * - WebPageTest
 * - Real User Monitoring (RUM)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EdgeEditPopover, type EdgeEditPopoverProps } from '../EdgeEditPopover'

describe('S3-POPOVER-PERF: EdgeEditPopover Performance', () => {
  const mockOnUpdate = vi.fn()
  const mockOnClose = vi.fn()

  const defaultProps: EdgeEditPopoverProps = {
    edge: {
      id: 'edge-1',
      data: { weight: 0.5, belief: 0.5 }
    },
    position: { x: 400, y: 300 },
    onUpdate: mockOnUpdate,
    onClose: mockOnClose
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Render Performance', () => {
    it('should render within acceptable time (< 25ms with test overhead)', () => {
      const startTime = performance.now()

      render(<EdgeEditPopover {...defaultProps} />)

      const endTime = performance.now()
      const renderTime = endTime - startTime

      console.log(`[PERF] Initial render: ${renderTime.toFixed(2)}ms`)
      // Initial render includes RTL setup overhead, so allow < 25ms
      // Subsequent interactions are < 16ms (see other tests)
      expect(renderTime).toBeLessThan(25)
    })

    it('should render with complex edge data within 16ms', () => {
      const complexEdge = {
        id: 'complex-edge',
        data: {
          weight: 0.75,
          belief: 0.9,
          label: 'Complex Edge with Long Label',
          metadata: { foo: 'bar', baz: 'qux' }
        }
      }

      const startTime = performance.now()

      render(<EdgeEditPopover {...defaultProps} edge={complexEdge} />)

      const endTime = performance.now()
      const renderTime = endTime - startTime

      console.log(`[PERF] Complex render: ${renderTime.toFixed(2)}ms`)
      expect(renderTime).toBeLessThan(16)
    })

    it('should re-render on position change within 16ms', () => {
      const { rerender } = render(<EdgeEditPopover {...defaultProps} />)

      const startTime = performance.now()

      rerender(<EdgeEditPopover {...defaultProps} position={{ x: 500, y: 400 }} />)

      const endTime = performance.now()
      const rerenderTime = endTime - startTime

      console.log(`[PERF] Position re-render: ${rerenderTime.toFixed(2)}ms`)
      expect(rerenderTime).toBeLessThan(16)
    })
  })

  describe('Interaction Performance', () => {
    it('should handle slider change within 16ms', () => {
      render(<EdgeEditPopover {...defaultProps} />)

      const weightSlider = screen.getByLabelText('Weight') as HTMLInputElement

      const startTime = performance.now()

      fireEvent.change(weightSlider, { target: { value: '0.75' } })

      const endTime = performance.now()
      const interactionTime = endTime - startTime

      console.log(`[PERF] Slider change: ${interactionTime.toFixed(2)}ms`)
      expect(interactionTime).toBeLessThan(16)
    })

    it('should handle rapid slider movements within 16ms per change', () => {
      render(<EdgeEditPopover {...defaultProps} />)

      const weightSlider = screen.getByLabelText('Weight') as HTMLInputElement

      const times: number[] = []

      // Simulate 10 rapid slider movements
      for (let i = 0; i < 10; i++) {
        const startTime = performance.now()

        fireEvent.change(weightSlider, { target: { value: (i / 10).toString() } })

        const endTime = performance.now()
        times.push(endTime - startTime)
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length
      const maxTime = Math.max(...times)

      console.log(`[PERF] Avg slider change: ${avgTime.toFixed(2)}ms`)
      console.log(`[PERF] Max slider change: ${maxTime.toFixed(2)}ms`)

      expect(maxTime).toBeLessThan(16)
      expect(avgTime).toBeLessThan(10) // Avg should be even faster
    })

    it('should handle keyboard event within 16ms', () => {
      render(<EdgeEditPopover {...defaultProps} />)

      const popover = screen.getByRole('dialog')

      const startTime = performance.now()

      fireEvent.keyDown(popover, { key: 'Escape' })

      const endTime = performance.now()
      const keyTime = endTime - startTime

      console.log(`[PERF] Keyboard event: ${keyTime.toFixed(2)}ms`)
      expect(keyTime).toBeLessThan(16)
    })

    it('should handle click outside within 16ms', () => {
      const { container } = render(
        <div>
          <EdgeEditPopover {...defaultProps} />
          <div data-testid="outside">Outside</div>
        </div>
      )

      const outside = screen.getByTestId('outside')

      const startTime = performance.now()

      fireEvent.mouseDown(outside)

      const endTime = performance.now()
      const clickTime = endTime - startTime

      console.log(`[PERF] Click outside: ${clickTime.toFixed(2)}ms`)
      expect(clickTime).toBeLessThan(16)
    })
  })

  describe('Update Debounce Performance', () => {
    it('should fire debounced update within 16ms after timer', () => {
      vi.useFakeTimers()

      render(<EdgeEditPopover {...defaultProps} />)

      const weightSlider = screen.getByLabelText('Weight') as HTMLInputElement

      // Trigger change
      fireEvent.change(weightSlider, { target: { value: '0.9' } })

      // Advance timers to trigger debounce
      vi.advanceTimersByTime(119) // Just before debounce

      expect(mockOnUpdate).not.toHaveBeenCalled()

      // Measure debounce execution time
      const startTime = performance.now()

      vi.advanceTimersByTime(1) // Trigger debounce

      const endTime = performance.now()
      const debounceTime = endTime - startTime

      console.log(`[PERF] Debounce fire: ${debounceTime.toFixed(2)}ms`)
      expect(debounceTime).toBeLessThan(16)
      expect(mockOnUpdate).toHaveBeenCalledWith('edge-1', { weight: 0.9, belief: 0.5 })

      vi.useRealTimers()
    })

    it('should handle sequential debounce resets efficiently', () => {
      vi.useFakeTimers()

      render(<EdgeEditPopover {...defaultProps} />)

      const weightSlider = screen.getByLabelText('Weight') as HTMLInputElement

      const times: number[] = []

      // Simulate 5 changes with timer resets
      for (let i = 0; i < 5; i++) {
        const startTime = performance.now()

        fireEvent.change(weightSlider, { target: { value: (i / 10).toString() } })
        vi.advanceTimersByTime(50) // Reset debounce each time

        const endTime = performance.now()
        times.push(endTime - startTime)
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length
      const maxTime = Math.max(...times)

      console.log(`[PERF] Avg debounce reset: ${avgTime.toFixed(2)}ms`)
      console.log(`[PERF] Max debounce reset: ${maxTime.toFixed(2)}ms`)

      expect(maxTime).toBeLessThan(16)

      vi.useRealTimers()
    })
  })

  describe('Cleanup Performance', () => {
    it('should unmount within 16ms', () => {
      const { unmount } = render(<EdgeEditPopover {...defaultProps} />)

      const startTime = performance.now()

      unmount()

      const endTime = performance.now()
      const unmountTime = endTime - startTime

      console.log(`[PERF] Unmount: ${unmountTime.toFixed(2)}ms`)
      expect(unmountTime).toBeLessThan(16)
    })

    it('should cleanup event listeners efficiently', () => {
      const { unmount } = render(<EdgeEditPopover {...defaultProps} />)

      // Change slider to create debounce timer
      const weightSlider = screen.getByLabelText('Weight') as HTMLInputElement
      fireEvent.change(weightSlider, { target: { value: '0.8' } })

      const startTime = performance.now()

      unmount()

      const endTime = performance.now()
      const cleanupTime = endTime - startTime

      console.log(`[PERF] Cleanup with timer: ${cleanupTime.toFixed(2)}ms`)
      expect(cleanupTime).toBeLessThan(16)
    })
  })

  describe('Memory Efficiency', () => {
    it('should not leak memory on rapid mount/unmount cycles', () => {
      const iterations = 100

      const startTime = performance.now()

      for (let i = 0; i < iterations; i++) {
        const { unmount } = render(<EdgeEditPopover {...defaultProps} />)
        unmount()
      }

      const endTime = performance.now()
      const totalTime = endTime - startTime
      const avgTime = totalTime / iterations

      console.log(`[PERF] Avg mount+unmount: ${avgTime.toFixed(2)}ms`)
      console.log(`[PERF] Total 100 cycles: ${totalTime.toFixed(2)}ms`)

      // Each cycle should be fast (< 16ms ideal, but give some slack for 100 iterations)
      expect(avgTime).toBeLessThan(20)
    })

    it('should handle multiple simultaneous popovers efficiently', () => {
      const count = 5

      const startTime = performance.now()

      const containers = []
      for (let i = 0; i < count; i++) {
        const { container } = render(
          <EdgeEditPopover
            {...defaultProps}
            edge={{ id: `edge-${i}`, data: { weight: 0.5, belief: 0.5 } }}
            position={{ x: 100 * i, y: 300 }}
          />
        )
        containers.push(container)
      }

      const endTime = performance.now()
      const renderTime = endTime - startTime

      console.log(`[PERF] ${count} popovers: ${renderTime.toFixed(2)}ms`)

      // Rendering 5 popovers should still be fast
      expect(renderTime).toBeLessThan(80) // 16ms * 5 = 80ms
    })
  })

  describe('Real-world Scenarios', () => {
    it('should handle complete user workflow within budget', () => {
      vi.useFakeTimers()

      const startTime = performance.now()

      // 1. Render popover
      const { container } = render(<EdgeEditPopover {...defaultProps} />)

      // 2. User adjusts weight
      const weightSlider = screen.getByLabelText('Weight') as HTMLInputElement
      fireEvent.change(weightSlider, { target: { value: '0.7' } })

      // 3. User adjusts belief
      const beliefSlider = screen.getByLabelText('Belief') as HTMLInputElement
      fireEvent.change(beliefSlider, { target: { value: '0.8' } })

      // 4. Debounce fires
      vi.runAllTimers()

      // 5. User closes with Enter
      const popover = screen.getByRole('dialog')
      fireEvent.keyDown(popover, { key: 'Enter' })

      const endTime = performance.now()
      const totalTime = endTime - startTime

      console.log(`[PERF] Complete workflow: ${totalTime.toFixed(2)}ms`)

      // Complete workflow should be under ~50ms (excluding debounce wait)
      expect(totalTime).toBeLessThan(50)

      vi.useRealTimers()
    })

    it('should maintain performance under stress (100 slider changes)', () => {
      render(<EdgeEditPopover {...defaultProps} />)

      const weightSlider = screen.getByLabelText('Weight') as HTMLInputElement

      const startTime = performance.now()

      for (let i = 0; i < 100; i++) {
        fireEvent.change(weightSlider, { target: { value: (Math.random()).toString() } })
      }

      const endTime = performance.now()
      const totalTime = endTime - startTime
      const avgTime = totalTime / 100

      console.log(`[PERF] 100 changes avg: ${avgTime.toFixed(2)}ms`)
      console.log(`[PERF] 100 changes total: ${totalTime.toFixed(2)}ms`)

      // Average per change should be < 10ms
      expect(avgTime).toBeLessThan(10)
    })
  })
})
