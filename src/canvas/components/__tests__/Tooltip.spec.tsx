/**
 * Tooltip - Test suite
 *
 * Tests for:
 * - Hover and focus triggers
 * - Positioning
 * - Event handler merging (not clobbering)
 * - aria-describedby (not aria-label)
 * - Accessibility
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Tooltip } from '../Tooltip'

describe('Tooltip', () => {
  describe('Trigger Behavior', () => {
    it('shows tooltip on mouse enter', () => {
      render(
        <Tooltip content="Helpful tip">
          <button>Trigger</button>
        </Tooltip>
      )

      const trigger = screen.getByText('Trigger')
      fireEvent.mouseEnter(trigger)

      expect(screen.getByRole('tooltip')).toBeInTheDocument()
      expect(screen.getByText('Helpful tip')).toBeInTheDocument()
    })

    it('hides tooltip on mouse leave', () => {
      render(
        <Tooltip content="Helpful tip">
          <button>Trigger</button>
        </Tooltip>
      )

      const trigger = screen.getByText('Trigger')
      fireEvent.mouseEnter(trigger)
      expect(screen.getByRole('tooltip')).toBeInTheDocument()

      fireEvent.mouseLeave(trigger)
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    })

    it('shows tooltip on focus', () => {
      render(
        <Tooltip content="Helpful tip">
          <button>Trigger</button>
        </Tooltip>
      )

      const trigger = screen.getByText('Trigger')
      fireEvent.focus(trigger)

      expect(screen.getByRole('tooltip')).toBeInTheDocument()
    })

    it('hides tooltip on blur', () => {
      render(
        <Tooltip content="Helpful tip">
          <button>Trigger</button>
        </Tooltip>
      )

      const trigger = screen.getByText('Trigger')
      fireEvent.focus(trigger)
      expect(screen.getByRole('tooltip')).toBeInTheDocument()

      fireEvent.blur(trigger)
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    })
  })

  describe('Event Handler Merging', () => {
    it('preserves existing onMouseEnter handler', () => {
      const existingHandler = vi.fn()

      render(
        <Tooltip content="Helpful tip">
          <button onMouseEnter={existingHandler}>Trigger</button>
        </Tooltip>
      )

      const trigger = screen.getByText('Trigger')
      fireEvent.mouseEnter(trigger)

      expect(existingHandler).toHaveBeenCalledTimes(1)
      expect(screen.getByRole('tooltip')).toBeInTheDocument()
    })

    it('preserves existing onMouseLeave handler', () => {
      const existingHandler = vi.fn()

      render(
        <Tooltip content="Helpful tip">
          <button onMouseLeave={existingHandler}>Trigger</button>
        </Tooltip>
      )

      const trigger = screen.getByText('Trigger')
      fireEvent.mouseEnter(trigger)
      fireEvent.mouseLeave(trigger)

      expect(existingHandler).toHaveBeenCalledTimes(1)
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    })

    it('preserves existing onFocus handler', () => {
      const existingHandler = vi.fn()

      render(
        <Tooltip content="Helpful tip">
          <button onFocus={existingHandler}>Trigger</button>
        </Tooltip>
      )

      const trigger = screen.getByText('Trigger')
      fireEvent.focus(trigger)

      expect(existingHandler).toHaveBeenCalledTimes(1)
      expect(screen.getByRole('tooltip')).toBeInTheDocument()
    })

    it('preserves existing onBlur handler', () => {
      const existingHandler = vi.fn()

      render(
        <Tooltip content="Helpful tip">
          <button onBlur={existingHandler}>Trigger</button>
        </Tooltip>
      )

      const trigger = screen.getByText('Trigger')
      fireEvent.focus(trigger)
      fireEvent.blur(trigger)

      expect(existingHandler).toHaveBeenCalledTimes(1)
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    })

    it('calls both tooltip and existing handlers in correct order', () => {
      const existingHandler = vi.fn()

      render(
        <Tooltip content="Helpful tip">
          <button onMouseEnter={existingHandler}>Trigger</button>
        </Tooltip>
      )

      const trigger = screen.getByText('Trigger')
      fireEvent.mouseEnter(trigger)

      // Tooltip should show
      expect(screen.getByRole('tooltip')).toBeInTheDocument()
      // Existing handler should be called
      expect(existingHandler).toHaveBeenCalled()
    })
  })

  describe('Accessibility', () => {
    it('uses aria-describedby instead of aria-label', () => {
      render(
        <Tooltip content="Helpful tip">
          <button>Trigger</button>
        </Tooltip>
      )

      const trigger = screen.getByText('Trigger')

      // Should not have aria-label (preserves existing semantics)
      expect(trigger).not.toHaveAttribute('aria-label')

      // Show tooltip
      fireEvent.mouseEnter(trigger)

      // Should have aria-describedby pointing to tooltip
      expect(trigger).toHaveAttribute('aria-describedby')

      const describedById = trigger.getAttribute('aria-describedby')
      expect(describedById).toBeTruthy()

      // Tooltip should have matching ID
      const tooltip = screen.getByRole('tooltip')
      expect(tooltip).toHaveAttribute('id', describedById)
    })

    it('clears aria-describedby when tooltip is hidden', () => {
      render(
        <Tooltip content="Helpful tip">
          <button>Trigger</button>
        </Tooltip>
      )

      const trigger = screen.getByText('Trigger')

      fireEvent.mouseEnter(trigger)
      expect(trigger).toHaveAttribute('aria-describedby')

      fireEvent.mouseLeave(trigger)
      expect(trigger).not.toHaveAttribute('aria-describedby')
    })

    it('preserves existing aria-label on child', () => {
      render(
        <Tooltip content="Helpful tip">
          <button aria-label="Important button">Trigger</button>
        </Tooltip>
      )

      const trigger = screen.getByLabelText('Important button')
      expect(trigger).toHaveAttribute('aria-label', 'Important button')

      fireEvent.mouseEnter(trigger)

      // Should still have original aria-label
      expect(trigger).toHaveAttribute('aria-label', 'Important button')
      // And also have aria-describedby
      expect(trigger).toHaveAttribute('aria-describedby')
    })

    it('makes non-focusable children focusable', () => {
      render(
        <Tooltip content="Helpful tip">
          <span>Not focusable</span>
        </Tooltip>
      )

      const trigger = screen.getByText('Not focusable')
      expect(trigger).toHaveAttribute('tabIndex', '0')
    })

    it('preserves existing tabIndex', () => {
      render(
        <Tooltip content="Helpful tip">
          <div tabIndex={-1}>Custom tabindex</div>
        </Tooltip>
      )

      const trigger = screen.getByText('Custom tabindex')
      expect(trigger).toHaveAttribute('tabIndex', '-1')
    })

    it('has proper tooltip role', () => {
      render(
        <Tooltip content="Helpful tip">
          <button>Trigger</button>
        </Tooltip>
      )

      fireEvent.mouseEnter(screen.getByText('Trigger'))

      const tooltip = screen.getByRole('tooltip')
      expect(tooltip).toBeInTheDocument()
    })
  })

  describe('Positioning', () => {
    it('positions tooltip on top by default', () => {
      render(
        <Tooltip content="Helpful tip">
          <button>Trigger</button>
        </Tooltip>
      )

      fireEvent.mouseEnter(screen.getByText('Trigger'))

      const tooltip = screen.getByRole('tooltip')
      const styles = tooltip.style

      expect(styles.bottom).toBe('100%')
      expect(styles.left).toBe('50%')
      expect(styles.transform).toContain('translateX(-50%)')
    })

    it('positions tooltip on bottom when specified', () => {
      render(
        <Tooltip content="Helpful tip" position="bottom">
          <button>Trigger</button>
        </Tooltip>
      )

      fireEvent.mouseEnter(screen.getByText('Trigger'))

      const tooltip = screen.getByRole('tooltip')
      const styles = tooltip.style

      expect(styles.top).toBe('100%')
      expect(styles.left).toBe('50%')
      expect(styles.transform).toContain('translateX(-50%)')
    })

    it('positions tooltip on left when specified', () => {
      render(
        <Tooltip content="Helpful tip" position="left">
          <button>Trigger</button>
        </Tooltip>
      )

      fireEvent.mouseEnter(screen.getByText('Trigger'))

      const tooltip = screen.getByRole('tooltip')
      const styles = tooltip.style

      expect(styles.right).toBe('100%')
      expect(styles.top).toBe('50%')
      expect(styles.transform).toContain('translateY(-50%)')
    })

    it('positions tooltip on right when specified', () => {
      render(
        <Tooltip content="Helpful tip" position="right">
          <button>Trigger</button>
        </Tooltip>
      )

      fireEvent.mouseEnter(screen.getByText('Trigger'))

      const tooltip = screen.getByRole('tooltip')
      const styles = tooltip.style

      expect(styles.left).toBe('100%')
      expect(styles.top).toBe('50%')
      expect(styles.transform).toContain('translateY(-50%)')
    })
  })

  describe('Content', () => {
    it('displays tooltip content', () => {
      render(
        <Tooltip content="This is a helpful message">
          <button>Trigger</button>
        </Tooltip>
      )

      fireEvent.mouseEnter(screen.getByText('Trigger'))

      expect(screen.getByText('This is a helpful message')).toBeInTheDocument()
    })

    it('renders child element unchanged', () => {
      render(
        <Tooltip content="Helpful tip">
          <button className="custom-class">Click me</button>
        </Tooltip>
      )

      const button = screen.getByText('Click me')
      expect(button).toHaveClass('custom-class')
    })
  })

  describe('Visual Style', () => {
    it('uses Olumi brand tokens', () => {
      render(
        <Tooltip content="Helpful tip">
          <button>Trigger</button>
        </Tooltip>
      )

      fireEvent.mouseEnter(screen.getByText('Trigger'))

      const tooltip = screen.getByRole('tooltip')
      const styles = tooltip.style

      expect(styles.backgroundColor).toContain('var(--olumi-bg')
      expect(styles.color).toContain('var(--olumi-text')
    })

    it('has pointer-events: none to prevent interaction', () => {
      render(
        <Tooltip content="Helpful tip">
          <button>Trigger</button>
        </Tooltip>
      )

      fireEvent.mouseEnter(screen.getByText('Trigger'))

      const tooltip = screen.getByRole('tooltip')
      expect(tooltip.className).toContain('pointer-events-none')
    })

    it('has high z-index for visibility', () => {
      render(
        <Tooltip content="Helpful tip">
          <button>Trigger</button>
        </Tooltip>
      )

      fireEvent.mouseEnter(screen.getByText('Trigger'))

      const tooltip = screen.getByRole('tooltip')
      expect(tooltip.className).toContain('z-[9000]')
    })
  })
})
