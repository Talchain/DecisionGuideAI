import { describe, it, expect, vi, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { FloatingPanel } from '../FloatingPanel'
import {
  FLOATING_DEFAULT_HEIGHT,
  FLOATING_DEFAULT_WIDTH,
  FLOATING_MIN_HEIGHT,
  FLOATING_MIN_WIDTH,
} from '../constants'

afterEach(() => cleanup())

describe('FloatingPanel (State 5)', () => {
  it('renders the dock button + draggable header + resize handle', () => {
    render(
      <FloatingPanel onDock={vi.fn()}>
        <div data-testid="floating-body" />
      </FloatingPanel>,
    )
    expect(screen.getByTestId('ai-panel-v2-floating')).toBeInTheDocument()
    expect(screen.getByTestId('ai-panel-v2-floating-header')).toBeInTheDocument()
    expect(screen.getByTestId('ai-panel-v2-floating-dock')).toBeInTheDocument()
    expect(screen.getByTestId('ai-panel-v2-floating-resize')).toBeInTheDocument()
    expect(screen.getByTestId('floating-body')).toBeInTheDocument()
  })

  it('clicking dock fires onDock', () => {
    const onDock = vi.fn()
    render(
      <FloatingPanel onDock={onDock}>
        <div />
      </FloatingPanel>,
    )
    screen.getByTestId('ai-panel-v2-floating-dock').click()
    expect(onDock).toHaveBeenCalledTimes(1)
  })

  it('opens at the default size (clamped to viewport / min)', () => {
    render(
      <FloatingPanel onDock={vi.fn()}>
        <div />
      </FloatingPanel>,
    )
    const panel = screen.getByTestId('ai-panel-v2-floating')
    const width = parseInt(panel.style.width, 10)
    const height = parseInt(panel.style.height, 10)
    expect(width).toBeGreaterThanOrEqual(FLOATING_MIN_WIDTH)
    expect(width).toBeLessThanOrEqual(FLOATING_DEFAULT_WIDTH)
    expect(height).toBeGreaterThanOrEqual(FLOATING_MIN_HEIGHT)
    expect(height).toBeLessThanOrEqual(FLOATING_DEFAULT_HEIGHT)
  })

  it('dock button pointerdown does NOT start a drag (stopPropagation on header)', () => {
    render(
      <FloatingPanel onDock={vi.fn()}>
        <div />
      </FloatingPanel>,
    )
    const dockBtn = screen.getByTestId('ai-panel-v2-floating-dock')
    fireEvent.pointerDown(dockBtn, { button: 0, bubbles: true })
    const panel = screen.getByTestId('ai-panel-v2-floating')
    expect(panel.getAttribute('data-dragging')).toBe('false')
  })
})
