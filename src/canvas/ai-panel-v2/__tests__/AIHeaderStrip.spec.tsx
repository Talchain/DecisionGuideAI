import { describe, it, expect, vi, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { AIHeaderStrip } from '../AIHeaderStrip'
import { ARROW_KEY_RESIZE_PX } from '../constants'

afterEach(() => cleanup())

function setup(overrides: Partial<Parameters<typeof AIHeaderStrip>[0]> = {}) {
  const onStartDrag = overrides.onStartDrag ?? vi.fn()
  const onAdjustByPx = overrides.onAdjustByPx ?? vi.fn()
  const onMinimise = overrides.onMinimise ?? vi.fn()
  const onFloat = overrides.onFloat ?? vi.fn()
  render(
    <AIHeaderStrip
      onStartDrag={onStartDrag}
      onAdjustByPx={onAdjustByPx}
      onMinimise={onMinimise}
      onFloat={onFloat}
    />,
  )
  return { onStartDrag, onAdjustByPx, onMinimise, onFloat }
}

describe('AIHeaderStrip', () => {
  it('renders minimise + float icons with accessible labels', () => {
    setup()
    expect(screen.getByTestId('ai-panel-v2-minimise')).toHaveAttribute(
      'aria-label',
      'Minimise assistant',
    )
    expect(screen.getByTestId('ai-panel-v2-float')).toHaveAttribute(
      'aria-label',
      'Undock assistant',
    )
  })

  it('the strip itself is a horizontal separator with ns-resize cursor', () => {
    setup()
    const strip = screen.getByTestId('ai-panel-v2-header-strip')
    expect(strip).toHaveAttribute('role', 'separator')
    expect(strip).toHaveAttribute('aria-orientation', 'horizontal')
    expect(strip.className).toContain('cursor-ns-resize')
  })

  it('clicking minimise fires onMinimise', () => {
    const { onMinimise } = setup()
    screen.getByTestId('ai-panel-v2-minimise').click()
    expect(onMinimise).toHaveBeenCalledTimes(1)
  })

  it('clicking float fires onFloat', () => {
    const { onFloat } = setup()
    screen.getByTestId('ai-panel-v2-float').click()
    expect(onFloat).toHaveBeenCalledTimes(1)
  })

  it('pointer-down on the strip background fires onStartDrag', () => {
    const { onStartDrag } = setup()
    const strip = screen.getByTestId('ai-panel-v2-header-strip')
    fireEvent.pointerDown(strip, { button: 0 })
    expect(onStartDrag).toHaveBeenCalled()
  })

  it('pointer-down on the icon buttons stops drag propagation', () => {
    const { onStartDrag } = setup()
    const minBtn = screen.getByTestId('ai-panel-v2-minimise')
    fireEvent.pointerDown(minBtn, { button: 0, bubbles: true })
    expect(onStartDrag).not.toHaveBeenCalled()
  })

  it('ArrowUp / ArrowDown on the strip adjusts the ratio by ±ARROW_KEY_RESIZE_PX', () => {
    const { onAdjustByPx } = setup()
    const strip = screen.getByTestId('ai-panel-v2-header-strip')
    fireEvent.keyDown(strip, { key: 'ArrowUp' })
    expect(onAdjustByPx).toHaveBeenCalledWith(-ARROW_KEY_RESIZE_PX)
    fireEvent.keyDown(strip, { key: 'ArrowDown' })
    expect(onAdjustByPx).toHaveBeenCalledWith(ARROW_KEY_RESIZE_PX)
  })
})
