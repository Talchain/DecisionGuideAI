import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import { FloatingPanel } from '../FloatingPanel'

// jsdom doesn't define PointerEvent. Polyfill via MouseEvent (which has
// clientX/clientY) so React's onPointerDown handler can read the
// coordinates. Real browsers use the native PointerEvent class.
if (typeof window.PointerEvent === 'undefined') {
  ;(window as unknown as { PointerEvent: typeof MouseEvent }).PointerEvent = class extends MouseEvent {
    constructor(type: string, init?: MouseEventInit) {
      super(type, init)
    }
  }
}
import {
  FLOATING_DEFAULT_HEIGHT,
  FLOATING_DEFAULT_RIGHT_OFFSET,
  FLOATING_DEFAULT_WIDTH,
  FLOATING_MAX_HEIGHT_FRACTION,
  FLOATING_MAX_WIDTH_FRACTION,
  FLOATING_MIN_HEIGHT,
  FLOATING_MIN_WIDTH,
} from '../constants'

// Integration test that drives the FloatingPanel through real pointer
// events at known viewport dimensions and asserts position + size stay
// within the viewport-bound clamping rules from the brief:
//   • Default size 400×500; min 320×300; max 60%vw × 80%vh
//   • Cannot be dragged off-screen (left/top >= 0; right/bottom <= vp)
//   • Resize handle in bottom-right; drag handle is the header

function setViewport(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true })
  Object.defineProperty(window, 'innerHeight', { value: height, configurable: true })
}

function rect(): { left: number; top: number; width: number; height: number } {
  const el = screen.getByTestId('ai-panel-v2-floating') as HTMLElement
  return {
    left: parseInt(el.style.left, 10),
    top: parseInt(el.style.top, 10),
    width: parseInt(el.style.width, 10),
    height: parseInt(el.style.height, 10),
  }
}

function dispatchPointerMove(clientX: number, clientY: number) {
  const ev = new Event('pointermove') as PointerEvent
  Object.defineProperty(ev, 'clientX', { value: clientX })
  Object.defineProperty(ev, 'clientY', { value: clientY })
  document.dispatchEvent(ev)
}

afterEach(() => cleanup())

describe('FloatingPanel — drag + resize integration', () => {
  beforeEach(() => {
    setViewport(1600, 1000)
  })

  it('mounts at default size anchored near the right edge', () => {
    render(<FloatingPanel onDock={vi.fn()}><div /></FloatingPanel>)
    const r = rect()
    expect(r.width).toBe(FLOATING_DEFAULT_WIDTH)
    expect(r.height).toBe(FLOATING_DEFAULT_HEIGHT)
    expect(r.left).toBe(1600 - FLOATING_DEFAULT_WIDTH - FLOATING_DEFAULT_RIGHT_OFFSET)
  })

  it('header pointerdown + pointermove updates position', () => {
    render(<FloatingPanel onDock={vi.fn()}><div /></FloatingPanel>)
    const before = rect()
    const header = screen.getByTestId('ai-panel-v2-floating-header')
    act(() => { fireEvent.pointerDown(header, { button: 0, clientX: 1200, clientY: 100 }) })
    act(() => dispatchPointerMove(1100, 150))
    const after = rect()
    expect(after.left).toBe(before.left - 100)
    expect(after.top).toBe(before.top + 50)
    act(() => { document.dispatchEvent(new Event('pointerup')) })
  })

  it('cannot be dragged past the left edge of the viewport', () => {
    render(<FloatingPanel onDock={vi.fn()}><div /></FloatingPanel>)
    const header = screen.getByTestId('ai-panel-v2-floating-header')
    act(() => { fireEvent.pointerDown(header, { button: 0, clientX: 1200, clientY: 100 }) })
    act(() => dispatchPointerMove(-9999, 100))
    expect(rect().left).toBe(0)
    act(() => { document.dispatchEvent(new Event('pointerup')) })
  })

  it('cannot be dragged past the right edge of the viewport', () => {
    render(<FloatingPanel onDock={vi.fn()}><div /></FloatingPanel>)
    const header = screen.getByTestId('ai-panel-v2-floating-header')
    act(() => { fireEvent.pointerDown(header, { button: 0, clientX: 1200, clientY: 100 }) })
    act(() => dispatchPointerMove(99999, 100))
    const r = rect()
    expect(r.left + r.width).toBeLessThanOrEqual(1600)
  })

  it('cannot be dragged past the top or bottom edges', () => {
    render(<FloatingPanel onDock={vi.fn()}><div /></FloatingPanel>)
    const header = screen.getByTestId('ai-panel-v2-floating-header')
    act(() => { fireEvent.pointerDown(header, { button: 0, clientX: 1200, clientY: 100 }) })
    act(() => dispatchPointerMove(1200, -9999))
    expect(rect().top).toBe(0)
    act(() => dispatchPointerMove(1200, 99999))
    const r = rect()
    expect(r.top + r.height).toBeLessThanOrEqual(1000)
    act(() => { document.dispatchEvent(new Event('pointerup')) })
  })

  it('resize handle grows the panel up to 60%vw × 80%vh, then clamps', () => {
    setViewport(1600, 1000)
    render(<FloatingPanel onDock={vi.fn()}><div /></FloatingPanel>)
    const handle = screen.getByTestId('ai-panel-v2-floating-resize')
    act(() => { fireEvent.pointerDown(handle, { button: 0, clientX: 1500, clientY: 600 }) })
    act(() => dispatchPointerMove(99999, 99999))
    const r = rect()
    expect(r.width).toBeLessThanOrEqual(Math.floor(1600 * FLOATING_MAX_WIDTH_FRACTION))
    expect(r.height).toBeLessThanOrEqual(Math.floor(1000 * FLOATING_MAX_HEIGHT_FRACTION))
    act(() => { document.dispatchEvent(new Event('pointerup')) })
  })

  it('resize handle shrinks the panel down to MIN_WIDTH × MIN_HEIGHT, then clamps', () => {
    render(<FloatingPanel onDock={vi.fn()}><div /></FloatingPanel>)
    const handle = screen.getByTestId('ai-panel-v2-floating-resize')
    act(() => { fireEvent.pointerDown(handle, { button: 0, clientX: 1500, clientY: 600 }) })
    act(() => dispatchPointerMove(-99999, -99999))
    const r = rect()
    expect(r.width).toBe(FLOATING_MIN_WIDTH)
    expect(r.height).toBe(FLOATING_MIN_HEIGHT)
    act(() => { document.dispatchEvent(new Event('pointerup')) })
  })

  it('initial position re-clamps after the viewport shrinks (handles window resize)', () => {
    setViewport(1600, 1000)
    render(<FloatingPanel onDock={vi.fn()}><div /></FloatingPanel>)
    // Shrink the viewport to less than the panel's right edge.
    setViewport(800, 600)
    act(() => { window.dispatchEvent(new Event('resize')) })
    const r = rect()
    expect(r.left + r.width).toBeLessThanOrEqual(800)
    expect(r.top + r.height).toBeLessThanOrEqual(600)
  })
})
